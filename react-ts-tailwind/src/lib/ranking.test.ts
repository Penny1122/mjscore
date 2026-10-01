import { describe, expect, it } from 'vitest'
import { rankPlayers } from './ranking'

const p = (name: string, score: number) => ({ id: name, name, score, rounds: 1 })

describe('rankPlayers', () => {
  it('依分數高到低排序', () => {
    const ranked = rankPlayers([p('A', -800), p('B', 1200), p('C', 400), p('D', -800)])
    expect(ranked.map((r) => r.name)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('同分同名次，下一名次跳號', () => {
    const ranked = rankPlayers([p('A', 1200), p('B', 1200), p('C', -800), p('D', -1600)])
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3, 4])
    expect(ranked.map((r) => r.isTied)).toEqual([true, true, false, false])
  })

  it('中段同分', () => {
    const ranked = rankPlayers([p('A', 900), p('B', -300), p('C', -300), p('D', -300), p('E', 0)])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 3, 3])
  })

  it('不修改原陣列', () => {
    const input = [p('A', -1), p('B', 1)]
    rankPlayers(input)
    expect(input.map((x) => x.name)).toEqual(['A', 'B'])
  })
})
