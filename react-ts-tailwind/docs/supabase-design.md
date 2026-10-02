# 雲端儲存設計（Supabase）

需求規格見 [mahjong-score-system.md](mahjong-score-system.md)，開發進度見 [tasks.md](tasks.md)。

## 目標

- 紀錄存在 Supabase（PostgreSQL），換手機、換瀏覽器都看得到同一份資料。
- 分享網址給其他人：**任何人都能觀看**。
- **輸入密碼才能解除唯讀**，解鎖後才能新增、編輯、刪除。
- 不做帳號登入。

## 權限模型

| 狀態 | 可以做的事 |
| --- | --- |
| 唯讀（預設） | 看歷史紀錄、紀錄明細 |
| 已解鎖 | 上述全部 ＋ 新增、編輯、刪除紀錄，管理常用玩家 |

- 只有一組共用密碼，所有可編輯的人用同一組。
- 解鎖後該裝置會記住，下次打開不用再輸入；按「鎖定」或密碼被更改後才需要重新輸入。
- 唯讀時，畫面上不顯示新增、編輯、刪除按鈕，標題列顯示「唯讀」。
- 底部導覽：唯讀為「總覽／歷史紀錄／名單／解鎖」，解鎖後為「總覽／新增紀錄／歷史紀錄／名單」。
- 解鎖後標題列顯示「已解鎖」，點了確認即可鎖定。畫面上不提供改密碼，改密碼用 `set-password.sql`（資料庫的 `change_edit_password` 函式保留但前端不再使用）。

### 為什麼密碼一定要在資料庫端檢查

前端用的 Supabase anon key 是公開的，任何人都能從網頁裡取得，並且直接呼叫 Supabase API。
如果密碼只在前端檢查，懂一點技術的人就能略過畫面直接改資料。所以：

1. 資料表對 anon **只開放讀取（SELECT）**，不開放直接新增、修改、刪除。
2. 所有寫入都透過資料庫函式（RPC）進行，函式第一件事就是檢查密碼，密碼錯就拒絕。
3. 密碼只存 **bcrypt 雜湊**，放在 anon 讀不到的 `private` schema。

## 資料表

```sql
-- 一筆紀錄
create table public.records (
  id                 uuid primary key default gen_random_uuid(),
  date               date not null,
  venue              text,                                    -- 場地名字，null = 未指定（0002）
  house_fee          integer check (house_fee >= 0),         -- 東錢，null = 未填
  house_fee_in_total boolean not null default false,          -- 東錢是否計入加總
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz                              -- 軟刪除，見下方說明
);

-- 每筆紀錄中每位玩家的成績
create table public.record_players (
  id         uuid primary key default gen_random_uuid(),
  record_id  uuid not null references public.records(id) on delete cascade,
  position   integer not null,                  -- 輸入時的順序
  name       text not null check (length(trim(name)) > 0),
  score      integer not null,                  -- 金額（元）
  rounds     integer not null check (rounds > 0),
  unique (record_id, name)
);

-- 牌咖名單
create table public.known_players (
  name           text primary key,
  last_played_at timestamptz,                   -- 手動新增、還沒上過桌為 null（0002）
  created_at     timestamptz not null default now()
);

-- 場地名單（0002）
create table public.venues (
  name         text primary key,                -- 1～30 字
  last_used_at timestamptz,                     -- 還沒用過為 null
  created_at   timestamptz not null default now()
);

-- 編輯密碼（anon 讀不到）
create schema private;
create table private.settings (
  id            boolean primary key default true check (id), -- 只允許一列
  password_hash text not null,
  password_changed_at timestamptz not null default now()
);
```

紀錄裡的場地存的是名字，不是指向 `venues` 的外鍵；從名單刪掉場地，舊紀錄的場地照樣保留。牌咖名單也是同樣做法。

### 刪除採軟刪除

共用密碼代表任何拿到密碼的人都能刪資料，而且沒有記錄是誰刪的。
所以刪除只寫入 `deleted_at`，畫面上看不到，但資料還在，誤刪時可以從 Supabase 後台救回來。

## RLS 規則

```sql
alter table public.records        enable row level security;
alter table public.record_players enable row level security;
alter table public.known_players  enable row level security;

create policy "anyone can read" on public.records
  for select using (deleted_at is null);
create policy "anyone can read" on public.record_players
  for select using (exists (
    select 1 from public.records r where r.id = record_id and r.deleted_at is null));
create policy "anyone can read" on public.known_players
  for select using (true);

-- 不建立 insert / update / delete 的 policy → anon 無法直接寫入
```

## 資料庫函式（RPC）

全部用 `security definer` 執行，函式內先檢查密碼。

| 函式 | 用途 |
| --- | --- |
| `verify_edit_password(password)` | 解鎖時檢查密碼，回傳對或錯 |
| `save_record(password, record_id, date, venue, house_fee, house_fee_in_total, players)` | 新增（`record_id` 為 null）或編輯紀錄；同時更新牌咖與場地名單 |
| `delete_record(password, record_id)` | 軟刪除 |
| `add_player(password, name)` | 新增牌咖 |
| `forget_player(password, name)` | 從牌咖名單移除 |
| `add_venue(password, name)` | 新增場地 |
| `forget_venue(password, name)` | 從場地名單移除 |
| `change_edit_password(old_password, new_password)` | 更改密碼 |

`save_record` 在資料庫端也會再驗證一次規則，和前端一致：

- 玩家至少 4 人、名字不重複、將數為正整數。
- 加總為 0（東錢計入加總時，玩家合計 + 東錢 = 0）。

### 密碼被猜的風險

anon 可以一直呼叫 `verify_edit_password` 試密碼。降低風險的做法：

- 密碼至少 8 個字元，建議用一句話或隨機字串，不要用生日、電話。
- 用 bcrypt 雜湊，每次比對都有固定成本。
- 依來源 IP 限制失敗次數（例：10 分鐘內失敗 10 次就暫停該 IP 10 分鐘）。

## 前端改動

- 新增 `@supabase/supabase-js`。
- 資料存取放在 `src/lib/api.ts`，全部是 async。
- App 啟動時載入紀錄、牌咖、場地；新增、編輯、刪除後重新載入。
- 載入中、網路錯誤、密碼錯誤都要有畫面提示。
- 解鎖狀態存在 localStorage（`mjscore.editPassword`），只是方便，不是安全機制；真正的權限檢查在資料庫。
- 連線設定放在 `.env.local`（不進 git）：

  ```bash
  VITE_SUPABASE_URL=https://xxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=xxxx
  ```

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `supabase/migrations/0001_init.sql` | 資料表、RLS、函式，在 SQL Editor 執行一次 |
| `supabase/migrations/0002_venues_and_players.sql` | 場地名單、紀錄的場地欄位、手動新增牌咖 |
| `supabase/migrations/0003_venue_required.sql` | `save_record` 要求必填場地 |
| `supabase/set-password.sql` | 設定或重設編輯密碼 |
| `src/lib/api.ts` | 前端呼叫 Supabase 的函式 |
| `src/lib/supabase.ts` | 建立 Supabase client |
| `e2e/fakeSupabase.ts` | 瀏覽器測試用的假 Supabase |

讀取失敗時 supabase-js 會自動重試 3 次（約 7 秒）才顯示錯誤畫面。

## 舊資料

第一版存在瀏覽器 localStorage 的紀錄只是測試資料，不匯入 Supabase（原本做的匯入功能已移除）。

## 不在本次範圍

- 帳號登入、每個人不同權限
- 即時同步（別人存檔後，你要重新整理才看得到）
- 離線時可新增紀錄、上線後自動同步
- 操作紀錄（誰在什麼時候改了什麼）

## 需要你處理的事

1. 到 [supabase.com](https://supabase.com) 建立專案（免費方案即可）。
2. 把 Project URL 和 anon public key 給我，或自己填進 `.env.local`。
3. 想好編輯密碼。我會給你一段 SQL，在 Supabase 後台的 SQL Editor 執行，用來設定密碼；密碼不需要告訴我。
4. 要分享給別人，網站需要放到網路上（例：Vercel、Netlify、Cloudflare Pages，都有免費方案）。這部分另外處理。
