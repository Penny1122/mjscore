import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameRecord, GameRecordInput, KnownPlayer, Venue } from '../types'

export type ApiErrorCode =
  | 'invalid_password'
  | 'too_many_attempts'
  | 'password_not_set'
  | 'password_too_short'
  | 'invalid_record'
  | 'invalid_name'
  | 'record_not_found'
  | 'network'
  | 'unknown'

const MESSAGES: Record<ApiErrorCode, string> = {
  invalid_password: '密碼錯誤',
  too_many_attempts: '密碼錯誤次數太多，請 10 分鐘後再試',
  password_not_set: '尚未設定編輯密碼，請先在 Supabase 執行 set-password.sql',
  password_too_short: '新密碼至少要 8 個字元',
  invalid_record: '資料不正確',
  invalid_name: '名稱需為 1 到 30 個字',
  record_not_found: '找不到這筆紀錄，可能已被刪除',
  network: '無法連線，請檢查網路後再試',
  unknown: '發生錯誤，請稍後再試',
}

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]}：${detail}` : MESSAGES[code])
    this.code = code
    this.name = 'ApiError'
  }
}

/** 密碼錯誤或尚未設定：前端要回到唯讀 */
export function isPasswordError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'invalid_password' || error.code === 'password_not_set')
  )
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const message =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return new ApiError('network')
  }
  const invalid = /invalid_record:\s*(.*)/.exec(message)
  if (invalid) return new ApiError('invalid_record', invalid[1])
  if (message.includes('record_not_found')) return new ApiError('record_not_found')
  return new ApiError('unknown', message || undefined)
}

const KNOWN_CODES = new Set<string>(Object.keys(MESSAGES))

type RecordRow = {
  id: string
  date: string
  venue: string | null
  house_fee: number | null
  house_fee_in_total: boolean
  created_at: string
  updated_at: string
  record_players: { id: string; position: number; name: string; score: number; rounds: number }[]
}

type KnownPlayerRow = { name: string; last_played_at: string | null; created_at: string }
type VenueRow = { name: string; last_used_at: string | null; created_at: string }

/** 最近用過的排前面；還沒用過的依新增時間（新到舊）排在後面 */
function byRecent<T extends { created_at: string }>(usedAt: (row: T) => string | null) {
  return (a: T, b: T) => {
    const ua = usedAt(a)
    const ub = usedAt(b)
    if (ua && ub) return ub.localeCompare(ua)
    if (ua) return -1
    if (ub) return 1
    return b.created_at.localeCompare(a.created_at)
  }
}

export function toGameRecord(row: RecordRow): GameRecord {
  return {
    id: row.id,
    date: row.date,
    venue: row.venue ?? undefined,
    players: [...row.record_players]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ id: p.id, name: p.name, score: p.score, rounds: p.rounds })),
    houseFee: row.house_fee ?? undefined,
    houseFeeInTotal: row.house_fee_in_total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const RECORD_COLUMNS =
  'id, date, venue, house_fee, house_fee_in_total, created_at, updated_at, record_players (id, position, name, score, rounds)'

export function createApi(client: SupabaseClient) {
  /** 呼叫寫入函式。函式以 {"ok": true} 或 {"error": code} 回應 */
  async function rpc(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    let result
    try {
      result = await client.rpc(fn, args)
    } catch (e) {
      throw toApiError(e)
    }
    if (result.error) throw toApiError(result.error)
    const data = (result.data ?? {}) as Record<string, unknown>
    if (typeof data.error === 'string') {
      throw new ApiError(KNOWN_CODES.has(data.error) ? (data.error as ApiErrorCode) : 'unknown')
    }
    return data
  }

  return {
    async fetchRecords(): Promise<GameRecord[]> {
      try {
        const { data, error } = await client
          .from('records')
          .select(RECORD_COLUMNS)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
        if (error) throw error
        return (data as RecordRow[]).map(toGameRecord)
      } catch (e) {
        throw toApiError(e)
      }
    },

    async fetchKnownPlayers(): Promise<KnownPlayer[]> {
      try {
        const { data, error } = await client
          .from('known_players')
          .select('name, last_played_at, created_at')
        if (error) throw error
        return (data as KnownPlayerRow[])
          .sort(byRecent((p) => p.last_played_at))
          .map((p) => ({ name: p.name, lastPlayedAt: p.last_played_at }))
      } catch (e) {
        throw toApiError(e)
      }
    },

    async fetchVenues(): Promise<Venue[]> {
      try {
        const { data, error } = await client.from('venues').select('name, last_used_at, created_at')
        if (error) throw error
        return (data as VenueRow[])
          .sort(byRecent((v) => v.last_used_at))
          .map((v) => ({ name: v.name, lastUsedAt: v.last_used_at }))
      } catch (e) {
        throw toApiError(e)
      }
    },

    async verifyPassword(password: string): Promise<void> {
      await rpc('verify_edit_password', { p_password: password })
    },

    /** 新增（id 為 null）或編輯，回傳紀錄 id */
    async saveRecord(password: string, id: string | null, input: GameRecordInput): Promise<string> {
      const data = await rpc('save_record', {
        p_password: password,
        p_record_id: id,
        p_date: input.date,
        p_venue: input.venue ?? null,
        p_house_fee: input.houseFee ?? null,
        p_house_fee_in_total: input.houseFeeInTotal ?? false,
        p_players: input.players.map((p) => ({ name: p.name, score: p.score, rounds: p.rounds })),
      })
      return String(data.id)
    },

    async deleteRecord(password: string, id: string): Promise<void> {
      await rpc('delete_record', { p_password: password, p_record_id: id })
    },

    async addPlayer(password: string, name: string): Promise<void> {
      await rpc('add_player', { p_password: password, p_name: name })
    },

    async forgetPlayer(password: string, name: string): Promise<void> {
      await rpc('forget_player', { p_password: password, p_name: name })
    },

    async addVenue(password: string, name: string): Promise<void> {
      await rpc('add_venue', { p_password: password, p_name: name })
    },

    async forgetVenue(password: string, name: string): Promise<void> {
      await rpc('forget_venue', { p_password: password, p_name: name })
    },

    async changePassword(oldPassword: string, newPassword: string): Promise<void> {
      await rpc('change_edit_password', {
        p_old_password: oldPassword,
        p_new_password: newPassword,
      })
    },
  }
}

export type Api = ReturnType<typeof createApi>
