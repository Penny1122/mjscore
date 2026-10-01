-- 麻將記分：資料表、權限、寫入函式
-- 在 Supabase 後台 SQL Editor 整段執行一次。設計說明見 docs/supabase-design.md
--
-- 權限模型：
--   anon 只能讀 public 的資料表；所有寫入都經過 security definer 函式，函式先檢查編輯密碼。
--   密碼只存 bcrypt 雜湊，放在不對外開放的 private schema。
--
-- 寫入函式統一回傳 jsonb：
--   成功：{"ok": true, ...}
--   密碼問題：{"error": "invalid_password" | "too_many_attempts" | "password_not_set"}
--   密碼錯誤不用 raise，否則交易回滾會把「失敗次數」一起回滾，限制就失效了。
--   資料不合法則 raise exception（前端已先驗證，正常不會發生）。

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 資料表
-- ============================================================

create table public.records (
  id                 uuid primary key default gen_random_uuid(),
  date               date not null,
  house_fee          integer check (house_fee >= 0),
  house_fee_in_total boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index records_list_idx on public.records (date desc, created_at desc)
  where deleted_at is null;

create table public.record_players (
  id        uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records (id) on delete cascade,
  position  integer not null,
  name      text not null check (length(btrim(name)) > 0),
  score     integer not null,
  rounds    integer not null check (rounds > 0),
  unique (record_id, name)
);

create index record_players_record_idx on public.record_players (record_id);

create table public.known_players (
  name           text primary key check (length(btrim(name)) > 0),
  last_played_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.settings (
  id                  boolean primary key default true check (id),
  password_hash       text not null,
  password_changed_at timestamptz not null default now()
);

create table private.password_attempts (
  ip           text not null,
  attempted_at timestamptz not null default now()
);

create index password_attempts_ip_idx on private.password_attempts (ip, attempted_at);

-- ============================================================
-- RLS：anon 只能讀
-- ============================================================

alter table public.records        enable row level security;
alter table public.record_players enable row level security;
alter table public.known_players  enable row level security;

create policy "anyone can read" on public.records
  for select to anon, authenticated
  using (deleted_at is null);

create policy "anyone can read" on public.record_players
  for select to anon, authenticated
  using (exists (
    select 1 from public.records r
    where r.id = record_id and r.deleted_at is null
  ));

create policy "anyone can read" on public.known_players
  for select to anon, authenticated
  using (true);

-- 沒有 insert / update / delete policy 就已經寫不進去；再收回權限多一層保險
revoke insert, update, delete, truncate on public.records, public.record_players, public.known_players
  from anon, authenticated;

-- ============================================================
-- 密碼檢查（內部使用）
-- ============================================================

-- 回傳 'ok' | 'invalid_password' | 'too_many_attempts' | 'password_not_set'
-- 同一個 IP 10 分鐘內失敗 10 次，暫停 10 分鐘
create function private.check_password(p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip      text := coalesce(
    v_headers ->> 'cf-connecting-ip',
    nullif(btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
  v_hash    text;
  v_failed  integer;
begin
  delete from private.password_attempts where attempted_at < now() - interval '1 day';

  select count(*) into v_failed
  from private.password_attempts
  where ip = v_ip and attempted_at > now() - interval '10 minutes';

  if v_failed >= 10 then
    return 'too_many_attempts';
  end if;

  select password_hash into v_hash from private.settings where id;
  if v_hash is null then
    return 'password_not_set';
  end if;

  if p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    insert into private.password_attempts (ip) values (v_ip);
    return 'invalid_password';
  end if;

  return 'ok';
end;
$$;

revoke all on function private.check_password(text) from public, anon, authenticated;

-- ============================================================
-- 對外函式
-- ============================================================

create function public.verify_edit_password(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 新增（p_record_id 為 null）或編輯一筆紀錄
-- p_players: [{"name": "阿明", "score": 1200, "rounds": 2}, ...]，依陣列順序存 position
create function public.save_record(
  p_password           text,
  p_record_id          uuid,
  p_date               date,
  p_house_fee          integer,
  p_house_fee_in_total boolean,
  p_players            jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status   text := private.check_password(p_password);
  v_id       uuid;
  v_count    integer;
  v_distinct integer;
  v_total    bigint;
  v_balance  bigint;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  -- 規則與前端 src/lib/validation.ts 一致
  if p_date is null then
    raise exception 'invalid_record: 缺少日期';
  end if;
  if p_house_fee is not null and p_house_fee < 0 then
    raise exception 'invalid_record: 東錢不可為負';
  end if;
  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception 'invalid_record: 玩家資料格式錯誤';
  end if;

  select count(*), count(distinct btrim(p ->> 'name')), coalesce(sum((p ->> 'score')::integer), 0)
    into v_count, v_distinct, v_total
  from jsonb_array_elements(p_players) as p;

  if v_count < 4 then
    raise exception 'invalid_record: 至少要 4 位玩家';
  end if;
  if v_distinct <> v_count then
    raise exception 'invalid_record: 玩家名字重複';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_players) as p
    where coalesce(btrim(p ->> 'name'), '') = ''
       or jsonb_typeof(p -> 'score') <> 'number'
       or jsonb_typeof(p -> 'rounds') <> 'number'
       or (p ->> 'score')::numeric <> trunc((p ->> 'score')::numeric)
       or (p ->> 'rounds')::numeric <> trunc((p ->> 'rounds')::numeric)
       or (p ->> 'rounds')::integer < 1
  ) then
    raise exception 'invalid_record: 名字、金額或將數不正確';
  end if;
  -- 注意：if 條件裡不能放 case ... then，PL/pgSQL 會把 case 的 then 當成 if 的 then
  v_balance := v_total;
  if p_house_fee_in_total then
    v_balance := v_balance + coalesce(p_house_fee, 0);
  end if;
  if v_balance <> 0 then
    raise exception 'invalid_record: 加總不為 0';
  end if;

  if p_record_id is null then
    insert into public.records (date, house_fee, house_fee_in_total)
    values (p_date, p_house_fee, coalesce(p_house_fee_in_total, false))
    returning id into v_id;
  else
    update public.records
    set date = p_date,
        house_fee = p_house_fee,
        house_fee_in_total = coalesce(p_house_fee_in_total, false),
        updated_at = now()
    where id = p_record_id and deleted_at is null
    returning id into v_id;

    if v_id is null then
      raise exception 'record_not_found';
    end if;

    delete from public.record_players where record_id = v_id;
  end if;

  insert into public.record_players (record_id, position, name, score, rounds)
  select v_id, t.ord, btrim(t.p ->> 'name'), (t.p ->> 'score')::integer, (t.p ->> 'rounds')::integer
  from jsonb_array_elements(p_players) with ordinality as t (p, ord);

  insert into public.known_players (name, last_played_at)
  select btrim(p ->> 'name'), now()
  from jsonb_array_elements(p_players) as p
  on conflict (name) do update set last_played_at = excluded.last_played_at;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 軟刪除：只標記 deleted_at，誤刪可從後台把 deleted_at 設回 null 救回
create function public.delete_record(p_password text, p_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  update public.records set deleted_at = now()
  where id = p_record_id and deleted_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

create function public.forget_player(p_password text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  delete from public.known_players where name = p_name;

  return jsonb_build_object('ok', true);
end;
$$;

create function public.change_edit_password(p_old_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_old_password);
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;
  if p_new_password is null or length(p_new_password) < 8 then
    return jsonb_build_object('error', 'password_too_short');
  end if;

  update private.settings
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      password_changed_at = now()
  where id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 函式預設對 public 開放執行；明確限定給 anon / authenticated
revoke all on function public.verify_edit_password(text) from public;
revoke all on function public.save_record(text, uuid, date, integer, boolean, jsonb) from public;
revoke all on function public.delete_record(text, uuid) from public;
revoke all on function public.forget_player(text, text) from public;
revoke all on function public.change_edit_password(text, text) from public;

grant execute on function public.verify_edit_password(text) to anon, authenticated;
grant execute on function public.save_record(text, uuid, date, integer, boolean, jsonb) to anon, authenticated;
grant execute on function public.delete_record(text, uuid) to anon, authenticated;
grant execute on function public.forget_player(text, text) to anon, authenticated;
grant execute on function public.change_edit_password(text, text) to anon, authenticated;
