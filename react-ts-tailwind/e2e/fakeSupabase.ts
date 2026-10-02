import type { BrowserContext, Route } from '@playwright/test'

/** playwright.config.ts 讓 dev server 連到這個網址，所有請求都被這裡攔截，不會碰到真的資料庫 */
export const FAKE_URL = 'https://fake.supabase.test'
export const TEST_PASSWORD = 'correct-horse-battery'

type PlayerRow = { id: string; position: number; name: string; score: number; rounds: number }

export type RecordRow = {
  id: string
  date: string
  venue: string | null
  house_fee: number | null
  house_fee_in_total: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  record_players: PlayerRow[]
}

type Args = Record<string, unknown>

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, x-supabase-api-version',
}

type NameRow = { name: string; last_used: string | null; created_at: string }

/** 模擬 supabase/migrations 的資料表與函式行為 */
export class FakeSupabase {
  records: RecordRow[] = []
  /** 牌咖名單；last_used 對應資料庫的 last_played_at */
  players: NameRow[] = []
  /** 場地名單；last_used 對應資料庫的 last_used_at */
  venues: NameRow[] = []
  password = TEST_PASSWORD
  /** 讓讀取失敗，模擬斷線 */
  failReads = false
  rpcCalls: string[] = []
  private seq = 0

  async attach(context: BrowserContext) {
    await context.route(`${FAKE_URL}/**`, (route) => this.handle(route))
  }

  private now() {
    // 每次遞增 1 秒，確保建立時間有先後
    return new Date(Date.UTC(2026, 9, 1, 0, 0, this.seq++)).toISOString()
  }

  private async handle(route: Route) {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })

    if (req.method() === 'GET' && this.failReads) return route.abort('internetdisconnected')

    if (req.method() === 'GET' && path === '/rest/v1/records') {
      const visible = this.records
        .filter((r) => r.deleted_at === null)
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
      return json(visible.map(({ deleted_at: _deleted, ...r }) => r))
    }

    // 排序由前端處理，這裡故意不排
    if (req.method() === 'GET' && path === '/rest/v1/known_players') {
      return json(
        this.players.map((p) => ({ name: p.name, last_played_at: p.last_used, created_at: p.created_at })),
      )
    }

    if (req.method() === 'GET' && path === '/rest/v1/venues') {
      return json(
        this.venues.map((v) => ({ name: v.name, last_used_at: v.last_used, created_at: v.created_at })),
      )
    }

    const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(path)
    if (req.method() === 'POST' && rpc) {
      this.rpcCalls.push(rpc[1])
      return json(this.rpc(rpc[1], (req.postDataJSON() ?? {}) as Args))
    }

    return json({ message: `fake: unhandled ${req.method()} ${path}` }, 404)
  }

  /** 名單中有就更新最近使用時間，沒有就加入 */
  private touch(list: NameRow[], name: string, at: string): NameRow[] {
    const existing = list.find((x) => x.name === name)
    if (existing) {
      existing.last_used = at
      return list
    }
    return [...list, { name, last_used: at, created_at: at }]
  }

  private rpc(fn: string, a: Args): unknown {
    const pw = fn === 'change_edit_password' ? a.p_old_password : a.p_password
    if (pw !== this.password) return { error: 'invalid_password' }

    switch (fn) {
      case 'verify_edit_password':
        return { ok: true }

      case 'save_record': {
        const players = a.p_players as { name: string; score: number; rounds: number }[]
        const at = this.now()
        let record = this.records.find((r) => r.id === a.p_record_id && r.deleted_at === null)
        if (a.p_record_id && !record) throw new Error('record_not_found')
        if (!record) {
          record = {
            id: `rec-${this.seq}`,
            date: '',
            venue: null,
            house_fee: null,
            house_fee_in_total: false,
            created_at: at,
            updated_at: at,
            deleted_at: null,
            record_players: [],
          }
          this.records.push(record)
        }
        const venue = String(a.p_venue ?? '').trim() || null
        record.date = a.p_date as string
        record.venue = venue
        record.house_fee = (a.p_house_fee as number | null) ?? null
        record.house_fee_in_total = Boolean(a.p_house_fee_in_total)
        if (a.p_record_id) record.updated_at = at
        record.record_players = players.map((p, i) => ({
          id: `${record.id}-p${i}`,
          position: i + 1,
          ...p,
        }))
        for (const p of players) this.players = this.touch(this.players, p.name, at)
        if (venue) this.venues = this.touch(this.venues, venue, at)
        return { ok: true, id: record.id }
      }

      case 'add_player':
      case 'add_venue': {
        const name = String(a.p_name ?? '').trim()
        if (!name || name.length > 30) return { error: 'invalid_name' }
        const list = fn === 'add_player' ? this.players : this.venues
        const existed = list.some((x) => x.name === name)
        if (!existed) list.push({ name, last_used: null, created_at: this.now() })
        return { ok: true, existed }
      }

      case 'forget_venue':
        this.venues = this.venues.filter((v) => v.name !== a.p_name)
        return { ok: true }

      case 'delete_record': {
        const r = this.records.find((x) => x.id === a.p_record_id)
        if (r) r.deleted_at = this.now()
        return { ok: true }
      }

      case 'forget_player':
        this.players = this.players.filter((p) => p.name !== a.p_name)
        return { ok: true }

      case 'rename_player': {
        const from = String(a.p_old_name ?? '').trim()
        const to = String(a.p_new_name ?? '').trim()
        if (!from || !to || to.length > 30) return { error: 'invalid_name' }
        if (from === to) return { ok: true, merged: false, records: 0 }
        const conflict = this.records.some(
          (r) =>
            r.record_players.some((p) => p.name === from) &&
            r.record_players.some((p) => p.name === to),
        )
        if (conflict) return { error: 'name_conflict' }
        let count = 0
        for (const r of this.records)
          for (const p of r.record_players)
            if (p.name === from) {
              p.name = to
              count++
            }
        const old = this.players.find((p) => p.name === from)
        const target = this.players.find((p) => p.name === to)
        if (target && old) {
          if (old.last_used && (!target.last_used || old.last_used > target.last_used))
            target.last_used = old.last_used
          this.players = this.players.filter((p) => p !== old)
        } else if (old) old.name = to
        return { ok: true, merged: Boolean(target), records: count }
      }

      case 'change_edit_password':
        if (String(a.p_new_password).length < 8) return { error: 'password_too_short' }
        this.password = String(a.p_new_password)
        return { ok: true }
    }
    return { error: 'unknown' }
  }
}
