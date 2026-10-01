import type { PlayerResult, RankedPlayerResult } from '../types'

/** 依分數高到低排名，同分同名次，下一名次跳號（1, 1, 3, 4） */
export function rankPlayers(players: PlayerResult[]): RankedPlayerResult[] {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const countByScore = new Map<number, number>()
  for (const p of sorted) countByScore.set(p.score, (countByScore.get(p.score) ?? 0) + 1)

  let rank = 0
  return sorted.map((player, index) => {
    if (index === 0 || player.score !== sorted[index - 1].score) rank = index + 1
    return { ...player, rank, isTied: (countByScore.get(player.score) ?? 0) > 1 }
  })
}
