import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../types'
import { computeStandings } from './stats'
import { computeTitles, type TitleId } from './titles'

let seq = 0
const record = (date: string, scores: Record<string, number>, venue?: string): GameRecord => ({
  id: `r${seq++}`,
  date,
  venue,
  players: Object.entries(scores).map(([name, score], i) => ({ id: `p${i}`, name, score, rounds: 1 })),
  createdAt: date,
  updatedAt: date,
})

/*
 * A：幾乎都贏，起伏最大
 * B：輸多贏少，有一場平手
 * C：連輸 5 場，兩場平手，總分最低
 * D：連輸 5 場，起伏最小
 * E：只打 1 場（新手）
 * F：只在 8 月打過 1 場（新手、好久不見）
 */
const records = [
  record('2026-08-01', { A: 100, B: -100, F: 0, C: 0 }),
  record('2026-09-01', { A: 500, B: -200, C: -200, D: -100 }, '樹窩'),
  record('2026-09-02', { A: 300, B: -100, C: -100, D: -100 }, '樹窩'),
  record('2026-09-03', { A: -100, B: 300, C: -100, D: -100 }, '公司'),
  record('2026-09-04', { A: 400, B: -100, C: -200, D: -100 }),
  record('2026-09-05', { A: 200, B: 0, C: -100, D: -100 }),
  record('2026-09-06', { A: 100, B: -100, C: 0, D: 100, E: -100 }),
]

const titles = computeTitles(records, computeStandings(records), '2026-10-01')
const labels = (name: string) => (titles.get(name) ?? []).map((t) => t.label)
const holdersOf = (id: TitleId) => [...titles].filter(([, ts]) => ts.some((t) => t.id === id)).map(([n]) => n).sort()

describe('computeTitles', () => {
  it('A 拿到的稱號：榮譽類先、中性類最後，同類依說明順序', () => {
    expect(labels('A')).toEqual([
      '👑 牌王',
      '🏆 冠軍收集者 ×6',
      '🏠 地頭蛇・樹窩',
      '💰 每將最賺',
      '🚀 單場爆發 +500',
      '🎯 常勝軍',
      '🪑 全勤獎',
      '⏳ 耐力王',
      '🎢 雲霄飛車',
    ])
  })

  it('排行類：只頒給第一名，同分都算', () => {
    expect(holdersOf('king')).toEqual(['A'])
    expect(holdersOf('charity')).toEqual(['C'])
    expect(holdersOf('attendance')).toEqual(['A', 'B', 'C'])
    expect(holdersOf('peace')).toEqual(['C'])
  })

  it('紀錄保持類：同分都算，標籤帶數字', () => {
    expect(holdersOf('worstGame')).toEqual(['B', 'C'])
    expect(labels('C')).toContain('💣 單場重傷 -200')
  })

  it('風格類：至少 5 場才列入', () => {
    expect(holdersOf('sharpshooter')).toEqual(['A'])
    expect(holdersOf('steady')).toEqual(['D'])
    expect(holdersOf('rollercoaster')).toEqual(['A'])
  })

  it('新手與好久不見', () => {
    expect(holdersOf('rookie')).toEqual(['E', 'F'])
    expect(holdersOf('longTimeNoSee')).toEqual(['F'])
  })

  it('地頭蛇：場地至少 2 場才頒', () => {
    expect(holdersOf('localBoss')).toEqual(['A'])
    expect(labels('A').some((l) => l.includes('公司'))).toBe(false)
  })
})

describe('不該頒的情況', () => {
  const four = (date: string, a: number, b: number, c: number, d: number) =>
    record(date, { A: a, B: b, C: c, D: d })

  it('大家場數一樣時沒有全勤獎、耐力王', () => {
    const rs = [four('2026-09-01', 100, -100, 0, 0)]
    const t = computeTitles(rs, computeStandings(rs), '2026-09-02')
    expect([...t.values()].flat().map((x) => x.id)).not.toContain('attendance')
    expect([...t.values()].flat().map((x) => x.id)).not.toContain('endurance')
  })

  it('紀錄少於 3 筆時不頒新手', () => {
    const rs = [four('2026-09-01', 100, -100, 0, 0), four('2026-09-02', 100, -100, 0, 0)]
    const t = computeTitles(rs, computeStandings(rs), '2026-09-03')
    expect([...t.values()].flat().map((x) => x.id)).not.toContain('rookie')
  })

  it('沒有人打滿 5 場時沒有風格類', () => {
    const rs = [four('2026-09-01', 100, -100, 0, 0)]
    const t = computeTitles(rs, computeStandings(rs), '2026-09-02')
    const all = [...t.values()].flat().map((x) => x.id)
    expect(all).not.toContain('sharpshooter')
    expect(all).not.toContain('steady')
  })

  it('沒有紀錄', () => {
    expect(computeTitles([], [], '2026-10-01').size).toBe(0)
  })
})
