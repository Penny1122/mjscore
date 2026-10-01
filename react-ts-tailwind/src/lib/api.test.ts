import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError, createApi, isPasswordError, toApiError, toGameRecord } from './api'

type Result = { data: unknown; error: unknown }

/** 模擬 supabase-js：from().select().order()... 可 await，rpc() 回傳設定好的結果 */
function fakeClient(opts: { select?: Result; rpc?: Result | Error }) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (r: Result) => unknown) =>
      Promise.resolve(opts.select ?? { data: [], error: null }).then(resolve),
  }
  const rpc = vi.fn(async () => {
    if (opts.rpc instanceof Error) throw opts.rpc
    return opts.rpc ?? { data: { ok: true }, error: null }
  })
  const client = { from: vi.fn(() => builder), rpc } as unknown as SupabaseClient
  return { client, rpc, builder }
}

const row = {
  id: 'r1',
  date: '2026-10-01',
  venue: null,
  house_fee: null,
  house_fee_in_total: false,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  record_players: [
    { id: 'b', position: 2, name: 'B', score: -100, rounds: 1 },
    { id: 'a', position: 1, name: 'A', score: 100, rounds: 2 },
  ],
}

describe('toGameRecord', () => {
  it('轉換欄位並依 position 排序', () => {
    const r = toGameRecord(row)
    expect(r.players.map((p) => p.name)).toEqual(['A', 'B'])
    expect(r.houseFee).toBeUndefined()
    expect(r.venue).toBeUndefined()
    expect(r.houseFeeInTotal).toBe(false)
    expect(r.createdAt).toBe('2026-10-01T10:00:00Z')
  })

  it('東錢有值', () => {
    expect(toGameRecord({ ...row, house_fee: 400, house_fee_in_total: true })).toMatchObject({
      houseFee: 400,
      houseFeeInTotal: true,
    })
  })
})

describe('toApiError', () => {
  it('網路錯誤', () => expect(toApiError(new TypeError('Failed to fetch')).code).toBe('network'))
  it('資料庫驗證錯誤帶出原因', () => {
    const e = toApiError({ message: 'invalid_record: 加總不為 0' })
    expect(e.code).toBe('invalid_record')
    expect(e.message).toContain('加總不為 0')
  })
  it('找不到紀錄', () => expect(toApiError({ message: 'record_not_found' }).code).toBe('record_not_found'))
  it('其他錯誤', () => expect(toApiError({ message: 'boom' }).code).toBe('unknown'))
})

describe('createApi', () => {
  it('fetchRecords', async () => {
    const { client } = fakeClient({ select: { data: [row], error: null } })
    const records = await createApi(client).fetchRecords()
    expect(records[0].id).toBe('r1')
  })

  it('fetchRecords 錯誤轉成 ApiError', async () => {
    const { client } = fakeClient({ select: { data: null, error: { message: 'Failed to fetch' } } })
    await expect(createApi(client).fetchRecords()).rejects.toMatchObject({ code: 'network' })
  })

  it('fetchKnownPlayers：最近上桌的在前，沒上過桌的依新增時間排在後', async () => {
    const { client } = fakeClient({
      select: {
        data: [
          { name: 'new-old', last_played_at: null, created_at: '2026-01-01' },
          { name: 'played-old', last_played_at: '2026-09-01', created_at: '2026-01-01' },
          { name: 'new-new', last_played_at: null, created_at: '2026-10-01' },
          { name: 'played-new', last_played_at: '2026-10-01', created_at: '2026-01-01' },
        ],
        error: null,
      },
    })
    const players = await createApi(client).fetchKnownPlayers()
    expect(players.map((p) => p.name)).toEqual(['played-new', 'played-old', 'new-new', 'new-old'])
    expect(players[2].lastPlayedAt).toBeNull()
  })

  it('fetchVenues 轉換欄位', async () => {
    const { client } = fakeClient({
      select: { data: [{ name: '阿明家', last_used_at: null, created_at: 't' }], error: null },
    })
    expect(await createApi(client).fetchVenues()).toEqual([{ name: '阿明家', lastUsedAt: null }])
  })

  it('saveRecord 送出參數並回傳 id', async () => {
    const { client, rpc } = fakeClient({ rpc: { data: { ok: true, id: 'new-id' }, error: null } })
    const id = await createApi(client).saveRecord('pw', null, {
      date: '2026-10-01',
      venue: '阿明家',
      players: [{ id: 'x', name: 'A', score: 0, rounds: 1 }],
      houseFee: undefined,
      houseFeeInTotal: true,
    })
    expect(id).toBe('new-id')
    expect(rpc).toHaveBeenCalledWith('save_record', {
      p_password: 'pw',
      p_record_id: null,
      p_date: '2026-10-01',
      p_venue: '阿明家',
      p_house_fee: null,
      p_house_fee_in_total: true,
      p_players: [{ name: 'A', score: 0, rounds: 1 }],
    })
  })

  it('密碼錯誤', async () => {
    const { client } = fakeClient({ rpc: { data: { error: 'invalid_password' }, error: null } })
    const err = await createApi(client).verifyPassword('x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('invalid_password')
    expect(isPasswordError(err)).toBe(true)
  })

  it('錯誤次數太多不算密碼錯誤（不需要鎖定）', async () => {
    const { client } = fakeClient({ rpc: { data: { error: 'too_many_attempts' }, error: null } })
    const err = await createApi(client).deleteRecord('x', 'r1').catch((e) => e)
    expect(err.code).toBe('too_many_attempts')
    expect(isPasswordError(err)).toBe(false)
  })

  it('rpc 丟出例外', async () => {
    const { client } = fakeClient({ rpc: new TypeError('Failed to fetch') })
    await expect(createApi(client).forgetPlayer('pw', 'A')).rejects.toMatchObject({ code: 'network' })
  })
})
