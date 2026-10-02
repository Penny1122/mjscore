-- 牌咖改名
-- 在 Supabase 後台 SQL Editor 整段執行一次（要先執行過 0003_venue_required.sql）
--
-- 改名會更新所有紀錄（含已軟刪除的）裡的名字，以及牌咖名單。
-- 新名字已在名單中時視為合併：兩人的紀錄變成同一人，名單只留新名字。
-- 有紀錄同時出現兩個名字時不能合併（同一筆不能有重複的人），回傳 name_conflict。

create function public.rename_player(p_password text, p_old_name text, p_new_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
  v_old    text := btrim(coalesce(p_old_name, ''));
  v_new    text := btrim(coalesce(p_new_name, ''));
  v_merged boolean;
  v_count  integer;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;
  if v_old = '' or length(v_new) not between 1 and 30 then
    return jsonb_build_object('error', 'invalid_name');
  end if;
  if v_old = v_new then
    return jsonb_build_object('ok', true, 'merged', false, 'records', 0);
  end if;

  -- 已刪除的紀錄也要檢查：unique (record_id, name) 涵蓋所有資料列
  if exists (
    select 1
    from public.record_players a
    join public.record_players b on b.record_id = a.record_id
    where a.name = v_old and b.name = v_new
  ) then
    return jsonb_build_object('error', 'name_conflict');
  end if;

  update public.record_players set name = v_new where name = v_old;
  get diagnostics v_count = row_count;

  v_merged := exists (select 1 from public.known_players where name = v_new);
  if v_merged then
    -- greatest / least 會略過 null
    update public.known_players k
    set last_played_at = greatest(k.last_played_at, o.last_played_at),
        created_at = least(k.created_at, o.created_at)
    from public.known_players o
    where k.name = v_new and o.name = v_old;

    delete from public.known_players where name = v_old;
  else
    update public.known_players set name = v_new where name = v_old;
  end if;

  return jsonb_build_object('ok', true, 'merged', v_merged, 'records', v_count);
end;
$$;

revoke all on function public.rename_player(text, text, text) from public;
grant execute on function public.rename_player(text, text, text) to anon, authenticated;
