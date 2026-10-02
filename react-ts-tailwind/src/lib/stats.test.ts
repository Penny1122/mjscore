import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../types'
import { computeStandings, countBy, formatPercent, summarize } from './stats'

let seq = 0
const record = (
  date: string,
  players: [name: string, score: number, rounds: number][],
  venue?: string,
): GameRecord => ({
  id: `r${seq++}`,
  date,
  venue,
  players: players.map(([name, score, rounds], i) => ({ id: `p${i}`, name, score, rounds })),
  createdAt: date,
  updatedAt: date,
})

const records = [
  record(
    '2026-09-01',
    [
      ['阿明', 1200, 2],
      ['小美', -300, 2],
      ['老王', -500, 2],
      ['阿華', -400, 2],
    ],
    '樹窩',
  ),
  record(
    '2026-09-08',
    [
      ['阿明', -200, 3],
      ['小美', 600, 3],
      ['老王', -100, 1],
      ['阿華', -300, 3],
      ['小陳', 0, 2],
    ],
    '樹窩',
  ),
  record('2026-10-01', [
    ['阿明', 100, 1],
    ['小美', -100, 1],
    ['老王', 0, 1],
    ['阿華', 0, 1],
  ]),
]

describe('computeStandings', () => {
  const standings = computeStandings(records)
  const by = (name: string) => standings.find((s) => s.name === name)!

  it('依總分高到低', () => {
    expect(standings.map((s) => s.name)).toEqual(['阿明', '小美', '小陳', '老王', '阿華'])
  })

  it('加總總分、場數、總將數', () => {
    expect(by('阿明')).toMatchObject({ totalScore: 1100, games: 3, totalRounds: 6 })
    expect(by('小陳')).toMatchObject({ totalScore: 0, games: 1, totalRounds: 2 })
  })

  it('勝率 = 贏錢場數 ÷ 場數，0 元不算贏也不算輸', () => {
    expect(by('阿明')).toMatchObject({ wins: 2, losses: 1 })
    expect(by('阿明').winRate).toBeCloseTo(2 / 3)
    expect(by('老王')).toMatchObject({ wins: 0, losses: 2, winRate: 0 })
    expect(by('小陳')).toMatchObject({ wins: 0, losses: 0 })
  })

  it('每將平均四捨五入', () => {
    expect(by('阿明').perRound).toBe(183) // 1100 / 6
    expect(by('阿華').perRound).toBe(-117) // -700 / 6
  })

  it('同分同名次', () => {
    const tied = computeStandings([
      record('2026-10-01', [
        ['A', 100, 1],
        ['B', 100, 1],
        ['C', -200, 1],
        ['D', 0, 1],
      ]),
    ])
    expect(tied.map((s) => s.rank)).toEqual([1, 1, 3, 4])
  })

  it('沒有紀錄', () => expect(computeStandings([])).toEqual([]))
})

describe('連勝／連敗', () => {
  // 故意打亂順序傳入，確認會依日期排
  const r = (date: string, a: number) =>
    record(date, [
      ['A', a, 1],
      ['B', -a, 1],
      ['C', 0, 1],
      ['D', 0, 1],
    ])
  const seq = [
    r('2026-09-05', 100), // A 勝
    r('2026-09-01', -100), // A 敗
    r('2026-09-06', 100), // A 勝
    r('2026-09-02', -100), // A 敗
    r('2026-09-03', -100), // A 敗
    r('2026-09-04', 100), // A 勝
  ]
  const by = (name: string, rs = seq) => computeStandings(rs).find((s) => s.name === name)!

  it('目前連勝：從最近一場往回數', () => {
    expect(by('A').streak).toEqual({ kind: 'win', count: 3 })
    expect(by('B').streak).toEqual({ kind: 'loss', count: 3 })
  })

  it('打平中斷連續', () => {
    const withDraw = [...seq, r('2026-09-07', 0)]
    expect(by('A', withDraw).streak).toEqual({ kind: 'none', count: 0 })
    expect(by('C').streak).toEqual({ kind: 'none', count: 0 })
  })

  it('同一天依建立時間排', () => {
    const first = { ...r('2026-10-01', -100), createdAt: '2026-10-01T10:00:00Z' }
    const second = { ...r('2026-10-01', 100), createdAt: '2026-10-01T12:00:00Z' }
    expect(by('A', [second, first]).streak).toEqual({ kind: 'win', count: 1 })
  })
})

describe('summarize', () => {
  it('場數、總將數（每筆取最高）、最近日期', () => {
    expect(summarize(records)).toEqual({ games: 3, totalRounds: 2 + 3 + 1, lastDate: '2026-10-01' })
  })
  it('沒有紀錄', () => expect(summarize([])).toEqual({ games: 0, totalRounds: 0, lastDate: undefined }))
})

describe('countBy', () => {
  it('每個場地出現幾筆', () => {
    const venues = countBy(records, (r) => (r.venue ? [r.venue] : []))
    expect(venues.get('樹窩')).toBe(2)
  })
  it('每位牌咖出場幾筆', () => {
    const players = countBy(records, (r) => r.players.map((p) => p.name))
    expect(players.get('阿明')).toBe(3)
    expect(players.get('小陳')).toBe(1)
  })
})

describe('formatPercent', () => {
  it('四捨五入到整數', () => expect(formatPercent(2 / 3)).toBe('67%'))
  it('0', () => expect(formatPercent(0)).toBe('0%'))
})
