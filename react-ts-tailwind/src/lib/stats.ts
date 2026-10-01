import type { GameRecord } from '../types'

/** 一位牌咖在所有紀錄中的戰績 */
export type PlayerStanding = {
  name: string
  /** 依總分排名，同分同名次 */
  rank: number
  /** 出場場數（出現在幾筆紀錄） */
  games: number
  /** 總分（元），東錢不計入 */
  totalScore: number
  /** 總將數：此人每筆紀錄打的將數加總 */
  totalRounds: number
  /** 贏錢（金額 > 0）的場數 */
  wins: number
  /** 輸錢（金額 < 0）的場數 */
  losses: number
  /** 勝率 = 贏錢場數 ÷ 出場場數，0～1 */
  winRate: number
  /** 每將平均（元），四捨五入到整數 */
  perRound: number
}

export function computeStandings(records: GameRecord[]): PlayerStanding[] {
  const byName = new Map<string, Omit<PlayerStanding, 'rank' | 'winRate' | 'perRound'>>()

  for (const record of records) {
    for (const p of record.players) {
      const s = byName.get(p.name) ?? {
        name: p.name,
        games: 0,
        totalScore: 0,
        totalRounds: 0,
        wins: 0,
        losses: 0,
      }
      s.games += 1
      s.totalScore += p.score
      s.totalRounds += p.rounds
      if (p.score > 0) s.wins += 1
      if (p.score < 0) s.losses += 1
      byName.set(p.name, s)
    }
  }

  const sorted = [...byName.values()]
    .map((s) => ({
      ...s,
      winRate: s.games ? s.wins / s.games : 0,
      perRound: s.totalRounds ? Math.round(s.totalScore / s.totalRounds) : 0,
    }))
    // 總分高到低；同分時勝率高的在前，再依名字排，讓順序固定
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore || b.winRate - a.winRate || a.name.localeCompare(b.name),
    )

  let rank = 0
  return sorted.map((s, i) => {
    if (i === 0 || s.totalScore !== sorted[i - 1].totalScore) rank = i + 1
    return { ...s, rank }
  })
}

export type Summary = {
  /** 紀錄筆數 */
  games: number
  /** 所有紀錄的總將數加總（每筆取該筆最高將數） */
  totalRounds: number
  /** 最近一筆的日期 YYYY-MM-DD */
  lastDate?: string
}

export function summarize(records: GameRecord[]): Summary {
  return {
    games: records.length,
    totalRounds: records.reduce(
      (sum, r) => sum + Math.max(0, ...r.players.map((p) => p.rounds)),
      0,
    ),
    lastDate: records.reduce<string | undefined>(
      (latest, r) => (!latest || r.date > latest ? r.date : latest),
      undefined,
    ),
  }
}

/** 每個名字出現在幾筆紀錄 */
export function countBy(records: GameRecord[], key: (r: GameRecord) => string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of records) {
    for (const k of new Set(key(r))) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/** 0.583 → 58% */
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
