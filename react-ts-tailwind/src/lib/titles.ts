import type { GameRecord } from '../types'
import { formatAmount } from './format'
import type { PlayerStanding } from './stats'

/** 標籤顏色 */
export type TitleTone = 'gold' | 'good' | 'bad' | 'neutral'

export type Title = {
  id: TitleId
  /** 顯示在標籤上的文字，含 emoji */
  label: string
  tone: TitleTone
}

export type TitleId =
  | 'king'
  | 'charity'
  | 'champion'
  | 'attendance'
  | 'endurance'
  | 'perRound'
  | 'bestGame'
  | 'worstGame'
  | 'sharpshooter'
  | 'steady'
  | 'rollercoaster'
  | 'peace'
  | 'rookie'
  | 'longTimeNoSee'
  | 'localBoss'

/** 「至少打幾場」的門檻，避免打一兩場就拿到 */
export const MIN_GAMES_FOR_STYLE = 5
export const ROOKIE_GAMES = 3
export const AWAY_DAYS = 30
export const MIN_VENUE_GAMES = 2

/** 稱號說明，依顯示順序 */
export const TITLE_RULES: { id: TitleId; name: string; rule: string }[] = [
  { id: 'king', name: '👑 牌王', rule: '總分第一（需為正）' },
  { id: 'charity', name: '💸 慈善家', rule: '總分最低（需為負）' },
  { id: 'champion', name: '🏆 冠軍收集者', rule: '單場拿第一名的次數最多' },
  { id: 'attendance', name: '🪑 全勤獎', rule: '出場場數最多' },
  { id: 'endurance', name: '⏳ 耐力王', rule: '總將數最多' },
  { id: 'perRound', name: '💰 每將最賺', rule: '每將平均最高（需為正）' },
  { id: 'bestGame', name: '🚀 單場爆發', rule: '單場贏最多的紀錄保持人' },
  { id: 'worstGame', name: '💣 單場重傷', rule: '單場輸最多的紀錄保持人' },
  { id: 'sharpshooter', name: '🎯 常勝軍', rule: `勝率 60% 以上（至少 ${MIN_GAMES_FOR_STYLE} 場）` },
  { id: 'steady', name: '⚖️ 穩如老狗', rule: `每場輸贏起伏最小（至少 ${MIN_GAMES_FOR_STYLE} 場）` },
  { id: 'rollercoaster', name: '🎢 雲霄飛車', rule: `每場輸贏起伏最大（至少 ${MIN_GAMES_FOR_STYLE} 場）` },
  { id: 'peace', name: '🕊️ 和平使者', rule: '打平（0 元）次數最多' },
  { id: 'rookie', name: '🐣 新手上路', rule: `出場不到 ${ROOKIE_GAMES} 場` },
  { id: 'longTimeNoSee', name: '💤 好久不見', rule: `超過 ${AWAY_DAYS} 天沒上桌` },
  { id: 'localBoss', name: '🏠 地頭蛇', rule: `在某個場地總分最高（該場地至少 ${MIN_VENUE_GAMES} 場，需為正）` },
]

const ORDER = new Map(TITLE_RULES.map((r, i) => [r.id, i]))

/** 顯示優先順序：榮譽類先，中性類最後；同類再依 TITLE_RULES 的順序 */
const TONE_PRIORITY: Record<TitleTone, number> = { gold: 0, good: 1, bad: 1, neutral: 2 }

/**
 * 找出某項數值最高（或最低）的人，同分都算。
 * 所有人都一樣時不頒（例如大家場數相同，「全勤獎」沒有意義）。
 */
function holders<T extends { name: string }>(
  eligible: T[],
  value: (s: T) => number,
  direction: 'max' | 'min',
): T[] {
  if (eligible.length === 0) return []
  const values = eligible.map(value)
  const best = direction === 'max' ? Math.max(...values) : Math.min(...values)
  const winners = eligible.filter((s) => value(s) === best)
  if (eligible.length > 1 && winners.length === eligible.length) return []
  return winners
}

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** 每位牌咖拿到的稱號，依顯示優先順序排好 */
export function computeTitles(
  records: GameRecord[],
  standings: PlayerStanding[],
  today: string,
): Map<string, Title[]> {
  const result = new Map<string, Title[]>()
  const give = (name: string, id: TitleId, label: string, tone: TitleTone) => {
    const list = result.get(name) ?? []
    list.push({ id, label, tone })
    result.set(name, list)
  }
  const award = (
    winners: PlayerStanding[],
    id: TitleId,
    label: (s: PlayerStanding) => string,
    tone: TitleTone,
  ) => winners.forEach((s) => give(s.name, id, label(s), tone))

  // 排行類
  const king = holders(standings, (s) => s.totalScore, 'max').filter((s) => s.totalScore > 0)
  award(king, 'king', () => '👑 牌王', 'gold')

  const charity = holders(standings, (s) => s.totalScore, 'min').filter((s) => s.totalScore < 0)
  award(charity, 'charity', () => '💸 慈善家', 'bad')

  const champion = holders(standings, (s) => s.firstPlaces, 'max').filter((s) => s.firstPlaces > 0)
  award(champion, 'champion', (s) => `🏆 冠軍收集者 ×${s.firstPlaces}`, 'gold')

  award(holders(standings, (s) => s.games, 'max'), 'attendance', () => '🪑 全勤獎', 'neutral')
  award(holders(standings, (s) => s.totalRounds, 'max'), 'endurance', () => '⏳ 耐力王', 'neutral')

  const perRound = holders(standings, (s) => s.perRound, 'max').filter((s) => s.perRound > 0)
  award(perRound, 'perRound', () => '💰 每將最賺', 'good')

  // 紀錄保持類
  const best = holders(standings, (s) => s.bestGame, 'max').filter((s) => s.bestGame > 0)
  award(best, 'bestGame', (s) => `🚀 單場爆發 ${formatAmount(s.bestGame)}`, 'good')

  const worst = holders(standings, (s) => s.worstGame, 'min').filter((s) => s.worstGame < 0)
  award(worst, 'worstGame', (s) => `💣 單場重傷 ${formatAmount(s.worstGame)}`, 'bad')


  // 風格類
  const veterans = standings.filter((s) => s.games >= MIN_GAMES_FOR_STYLE)
  award(
    veterans.filter((s) => s.winRate >= 0.6),
    'sharpshooter',
    () => '🎯 常勝軍',
    'good',
  )
  // 起伏要跟別人比才有意義，至少 2 人符合門檻
  if (veterans.length >= 2) {
    award(holders(veterans, (s) => s.volatility, 'min'), 'steady', () => '⚖️ 穩如老狗', 'neutral')
    award(
      holders(veterans, (s) => s.volatility, 'max'),
      'rollercoaster',
      () => '🎢 雲霄飛車',
      'neutral',
    )
  }

  const peace = holders(standings, (s) => s.draws, 'max').filter((s) => s.draws > 0)
  award(peace, 'peace', () => '🕊️ 和平使者', 'neutral')

  // 紀錄還很少時大家都是新手，不頒
  if (records.length >= ROOKIE_GAMES) {
    award(
      standings.filter((s) => s.games < ROOKIE_GAMES),
      'rookie',
      () => '🐣 新手上路',
      'neutral',
    )
  }

  award(
    standings.filter((s) => daysBetween(s.lastDate, today) > AWAY_DAYS),
    'longTimeNoSee',
    () => '💤 好久不見',
    'neutral',
  )

  // 場地類：每個場地各一位
  const venues = new Map<string, { games: number; totals: Map<string, number> }>()
  for (const r of records) {
    if (!r.venue) continue
    const v = venues.get(r.venue) ?? { games: 0, totals: new Map() }
    v.games += 1
    for (const p of r.players) v.totals.set(p.name, (v.totals.get(p.name) ?? 0) + p.score)
    venues.set(r.venue, v)
  }
  for (const [venue, v] of [...venues].sort(([a], [b]) => a.localeCompare(b))) {
    if (v.games < MIN_VENUE_GAMES) continue
    const players = [...v.totals].map(([name, total]) => ({ name, total }))
    for (const p of holders(players, (x) => x.total, 'max').filter((x) => x.total > 0)) {
      give(p.name, 'localBoss', `🏠 地頭蛇・${venue}`, 'gold')
    }
  }

  for (const list of result.values()) {
    list.sort(
      (a, b) =>
        TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone] ||
        (ORDER.get(a.id) ?? 0) - (ORDER.get(b.id) ?? 0),
    )
  }
  return result
}
