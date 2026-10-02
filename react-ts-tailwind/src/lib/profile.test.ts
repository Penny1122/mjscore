import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../types'
import { computeProfile } from './profile'

let seq = 0
const record = (date: string, scores: Record<string, number>, venue?: string): GameRecord => ({
  id: `r${seq++}`,
  date,
  venue,
  players: Object.entries(scores).map(([name, score], i) => ({ id: `p${i}`, name, score, rounds: 2 })),
  createdAt: date,
  updatedAt: date,
})

// 故意打亂順序
const records = [
  record('2026-09-10', { A: -300, B: 400, C: -100, D: 0 }, '公司'),
  record('2026-08-01', { A: 500, B: -200, C: -200, D: -100 }, '樹窩'),
  record('2026-08-15', { A: 200, B: 300, C: -400, D: -100 }, '樹窩'),
  record('2026-09-01', { A: -100, B: 200, C: 0, D: -100 }, '公司'),
  record('2026-09-20', { B: 100, C: -100, D: 0, E: 0 }), // A 沒打
]

describe('computeProfile', () => {
  const a = computeProfile(records, 'A')

  it('只算有出場的紀錄，依時間排序並累計', () => {
    expect(a.games.map((g) => g.date)).toEqual(['2026-08-01', '2026-08-15', '2026-09-01', '2026-09-10'])
    expect(a.games.map((g) => g.cumulative)).toEqual([500, 700, 600, 300])
  })

  it('每場名次與名次分布', () => {
    expect(a.games.map((g) => g.rank)).toEqual([1, 2, 3, 4])
    expect(a.rankCounts).toEqual([1, 1, 1, 1])
    expect(a.avgRank).toBe(2.5)
  })

  it('對戰：同一場誰金額高誰贏', () => {
    const vsB = a.headToHead.find((h) => h.opponent === 'B')!
    expect(vsB).toMatchObject({ together: 4, wins: 1, losses: 3, draws: 0, myTotal: 300 })
    const vsC = a.headToHead.find((h) => h.opponent === 'C')!
    expect(vsC).toMatchObject({ together: 4, wins: 2, losses: 2 })
    const vsD = a.headToHead.find((h) => h.opponent === 'D')!
    expect(vsD).toMatchObject({ wins: 2, losses: 1, draws: 1 })
    expect(a.headToHead.some((h) => h.opponent === 'E')).toBe(false)
  })

  it('剋星與提款機', () => {
    expect(a.nemesis?.opponent).toBe('B')
    expect(a.atm?.opponent).toBe('D')
  })

  it('場地表現（場數多的在前，同場數總分高的在前）、主場與客場魔咒', () => {
    expect(a.venues).toEqual([
      { venue: '樹窩', games: 2, total: 700, wins: 2, winRate: 1 },
      { venue: '公司', games: 2, total: -400, wins: 0, winRate: 0 },
    ])
    expect(a.home?.venue).toBe('樹窩')
    expect(a.away?.venue).toBe('公司')
  })

  it('每月表現', () => {
    expect(a.months).toEqual([
      { month: '2026-08', games: 2, total: 700 },
      { month: '2026-09', games: 2, total: -400 },
    ])
  })

  it('同桌不到 3 場不列入剋星／提款機', () => {
    const e = computeProfile(records, 'E')
    expect(e.headToHead).toHaveLength(3)
    expect(e.nemesis).toBeUndefined()
    expect(e.atm).toBeUndefined()
  })

  it('淨勝場為 0 不算剋星也不算提款機', () => {
    const c = computeProfile(records, 'C')
    const vsA = c.headToHead.find((h) => h.opponent === 'A')!
    expect(vsA.wins - vsA.losses).toBe(0)
    expect(c.nemesis?.opponent).not.toBe('A')
    expect(c.atm?.opponent).not.toBe('A')
  })

  it('沒有出場的人', () => {
    const z = computeProfile(records, 'Z')
    expect(z).toMatchObject({ games: [], rankCounts: [], avgRank: 0, headToHead: [], months: [] })
  })
})
