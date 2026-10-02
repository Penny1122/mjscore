-- 場地改為必填
-- 在 Supabase 後台 SQL Editor 整段執行一次（要先執行過 0002_venues_and_players.sql）
--
-- 只改 save_record：新增、編輯時一定要有場地。
-- records.venue 欄位仍允許 null，已存在、沒有場地的舊紀錄照樣保留；之後編輯時要補上場地才能存。
-- 參數沒變，用 create or replace，權限設定沿用 0002。

-- 新增（p_record_id 為 null）或編輯一筆紀錄
-- p_players: [{"name": "阿明", "score": 1200, "rounds": 2}, ...]，依陣列順序存 position
-- p_venue: 場地名字，必填（0003 起）；不在名單裡會自動加入
create or replace function public.save_record(
  p_password           text,
  p_record_id          uuid,
  p_date               date,
  p_venue              text,
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
  v_venue    text := nullif(btrim(coalesce(p_venue, '')), '');
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
  if v_venue is null then
    raise exception 'invalid_record: 請選擇場地';
  end if;
  if length(v_venue) > 30 then
    raise exception 'invalid_record: 場地名稱最多 30 個字';
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
       or length(btrim(p ->> 'name')) > 30
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
    insert into public.records (date, venue, house_fee, house_fee_in_total)
    values (p_date, v_venue, p_house_fee, coalesce(p_house_fee_in_total, false))
    returning id into v_id;
  else
    update public.records
    set date = p_date,
        venue = v_venue,
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

  insert into public.venues (name, last_used_at)
  values (v_venue, now())
  on conflict (name) do update set last_used_at = excluded.last_used_at;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
