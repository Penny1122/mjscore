import type { GameRecord } from '../types'
import { rankPlayers } from './ranking'
import { chronological } from './stats'

/** 他在某一筆紀錄的成績 */
export type PlayerGame = {
  recordId: string
  date: string
  venue?: string
  score: number
  rounds: number
  /** 該筆名次，同分同名次 */
  rank: number
  /** 該筆人數 */
  players: number
  /** 打完這場後的累計總分 */
  cumulative: number
}

/** 跟某位對手同桌的對戰紀錄：同一場誰金額高誰贏 */
export type HeadToHead = {
  opponent: string
  /** 同桌場數 */
  together: number
  wins: number
  losses: number
  draws: number
  /** 同桌那幾場，我的金額加總 */
  myTotal: number
}

export type VenueStat = {
  venue: string
  games: number
  total: number
  wins: number
  winRate: number
}

export type MonthStat = {
  /** YYYY-MM */
  month: string
  games: number
  total: number
}

export type Profile = {
  name: string
  /** 舊到新 */
  games: PlayerGame[]
  /** 第 1～N 名各幾次，index 0 = 第 1 名 */
  rankCounts: number[]
  avgRank: number
  headToHead: HeadToHead[]
  /** 對戰勝負最差的對手 */
  nemesis?: HeadToHead
  /** 對戰勝負最好的對手 */
  atm?: HeadToHead
  venues: VenueStat[]
  /** 表現最好的場地 */
  home?: VenueStat
  /** 表現最差的場地 */
  away?: VenueStat
  /** 舊到新 */
  months: MonthStat[]
}

/** 同桌至少幾場才列入剋星／提款機 */
export const MIN_TOGETHER = 3
/** 場地至少幾場才列入主場／客場魔咒 */
export const MIN_VENUE_GAMES = 2

const net = (h: HeadToHead) => h.wins - h.losses

/**
 * 剋星：淨勝場（勝 − 負）最低且為負；提款機：最高且為正。
 * 同分時同桌越多越優先，再依名字，讓結果固定只有一位。
 */
function pickRival(list: HeadToHead[], kind: 'nemesis' | 'atm'): HeadToHead | undefined {
  const eligible = list.filter(
    (h) => h.together >= MIN_TOGETHER && (kind === 'nemesis' ? net(h) < 0 : net(h) > 0),
  )
  return eligible.sort(
    (a, b) =>
      (kind === 'nemesis' ? net(a) - net(b) : net(b) - net(a)) ||
      b.together - a.together ||
      a.opponent.localeCompare(b.opponent),
  )[0]
}

/** 主場：總分最高且為正；客場魔咒：最低且為負 */
function pickVenue(list: VenueStat[], kind: 'home' | 'away'): VenueStat | undefined {
  const eligible = list.filter(
    (v) => v.games >= MIN_VENUE_GAMES && (kind === 'home' ? v.total > 0 : v.total < 0),
  )
  return eligible.sort(
    (a, b) =>
      (kind === 'home' ? b.total - a.total : a.total - b.total) ||
      b.games - a.games ||
      a.venue.localeCompare(b.venue),
  )[0]
}

export function computeProfile(records: GameRecord[], name: string): Profile {
  const games: PlayerGame[] = []
  const h2h = new Map<string, HeadToHead>()
  const venues = new Map<string, VenueStat>()
  const months = new Map<string, MonthStat>()
  let cumulative = 0

  for (const record of chronological(records)) {
    const me = record.players.find((p) => p.name === name)
    if (!me) continue

    cumulative += me.score
    const rank = rankPlayers(record.players).find((p) => p.name === name)!.rank
    games.push({
      recordId: record.id,
      date: record.date,
      venue: record.venue,
      score: me.score,
      rounds: me.rounds,
      rank,
      players: record.players.length,
      cumulative,
    })

    for (const other of record.players) {
      if (other.name === name) continue
      const h = h2h.get(other.name) ?? {
        opponent: other.name,
        together: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        myTotal: 0,
      }
      h.together += 1
      h.myTotal += me.score
      if (me.score > other.score) h.wins += 1
      else if (me.score < other.score) h.losses += 1
      else h.draws += 1
      h2h.set(other.name, h)
    }

    if (record.venue) {
      const v = venues.get(record.venue) ?? { venue: record.venue, games: 0, total: 0, wins: 0, winRate: 0 }
      v.games += 1
      v.total += me.score
      if (me.score > 0) v.wins += 1
      v.winRate = v.wins / v.games
      venues.set(record.venue, v)
    }

    const month = record.date.slice(0, 7)
    const m = months.get(month) ?? { month, games: 0, total: 0 }
    m.games += 1
    m.total += me.score
    months.set(month, m)
  }

  const maxRank = Math.max(0, ...games.map((g) => g.rank))
  const rankCounts = Array.from({ length: maxRank }, (_, i) => games.filter((g) => g.rank === i + 1).length)

  const headToHead = [...h2h.values()].sort(
    (a, b) => b.together - a.together || net(b) - net(a) || a.opponent.localeCompare(b.opponent),
  )
  const venueList = [...venues.values()].sort(
    (a, b) => b.games - a.games || b.total - a.total || a.venue.localeCompare(b.venue),
  )

  return {
    name,
    games,
    rankCounts,
    avgRank: games.length ? games.reduce((s, g) => s + g.rank, 0) / games.length : 0,
    headToHead,
    nemesis: pickRival(headToHead, 'nemesis'),
    atm: pickRival(headToHead, 'atm'),
    venues: venueList,
    home: pickVenue(venueList, 'home'),
    away: pickVenue(venueList, 'away'),
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
  }
}
