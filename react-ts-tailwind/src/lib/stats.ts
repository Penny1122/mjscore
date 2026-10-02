import type { GameRecord } from '../types'
import { rankPlayers } from './ranking'

/** 目前的連續狀態：從最近一場往回數。打平（0 元）會中斷 */
export type Streak = { kind: 'win' | 'loss' | 'none'; count: number }

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
  /** 目前幾連勝／幾連敗 */
  streak: Streak
  /** 打平（0 元）的場數 */
  draws: number
  /** 單場拿第一名的次數（同分並列第一也算） */
  firstPlaces: number
  /** 單場最高金額 */
  bestGame: number
  /** 單場最低金額 */
  worstGame: number
  /** 每場輸贏起伏：金額的標準差（元），四捨五入 */
  volatility: number
  /** 最後一次上桌的日期 YYYY-MM-DD */
  lastDate: string
}

/** 舊到新：日期，同日期依建立時間 */
export function chronological(records: GameRecord[]): GameRecord[] {
  return [...records].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  )
}

type Accumulator = Omit<PlayerStanding, 'rank' | 'winRate' | 'perRound' | 'volatility'> & {
  sumSquares: number
}

export function computeStandings(records: GameRecord[]): PlayerStanding[] {
  const byName = new Map<string, Accumulator>()

  // 依時間順序走過，連勝／連敗才算得對
  for (const record of chronological(records)) {
    const firstPlaceNames = new Set(
      rankPlayers(record.players)
        .filter((p) => p.rank === 1)
        .map((p) => p.name),
    )

    for (const p of record.players) {
      const s: Accumulator = byName.get(p.name) ?? {
        name: p.name,
        games: 0,
        totalScore: 0,
        totalRounds: 0,
        wins: 0,
        losses: 0,
        streak: { kind: 'none', count: 0 },
        draws: 0,
        firstPlaces: 0,
        bestGame: p.score,
        worstGame: p.score,
        lastDate: record.date,
        sumSquares: 0,
      }
      s.games += 1
      s.totalScore += p.score
      s.totalRounds += p.rounds
      s.sumSquares += p.score * p.score
      if (p.score > 0) s.wins += 1
      if (p.score < 0) s.losses += 1
      if (p.score === 0) s.draws += 1
      if (firstPlaceNames.has(p.name)) s.firstPlaces += 1
      s.bestGame = Math.max(s.bestGame, p.score)
      s.worstGame = Math.min(s.worstGame, p.score)
      s.lastDate = record.date

      const kind = p.score > 0 ? 'win' : p.score < 0 ? 'loss' : 'none'
      s.streak =
        kind === 'none'
          ? { kind, count: 0 }
          : { kind, count: s.streak.kind === kind ? s.streak.count + 1 : 1 }

      byName.set(p.name, s)
    }
  }

  const sorted = [...byName.values()]
    .map(({ sumSquares, ...s }) => {
      const mean = s.totalScore / s.games
      return {
        ...s,
        winRate: s.wins / s.games,
        perRound: s.totalRounds ? Math.round(s.totalScore / s.totalRounds) : 0,
        // 母體標準差；浮點誤差可能讓變異數略小於 0
        volatility: Math.round(Math.sqrt(Math.max(0, sumSquares / s.games - mean * mean))),
      }
    })
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
