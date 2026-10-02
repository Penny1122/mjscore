import { useState } from 'react'
import type { Streak } from '../lib/stats'
import type { Title, TitleTone } from '../lib/titles'
import type { HeadToHead } from '../lib/profile'

/** 所有小標籤共用：固定高度、內容垂直置中 */
const PILL = 'inline-flex h-6 items-center rounded-full px-2 text-xs leading-none whitespace-nowrap'

const TONE_CLASS: Record<TitleTone, string> = {
  gold: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  good: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  bad: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  neutral: 'border-slate-600 bg-slate-800 text-slate-300',
}

/** 預設最多顯示幾個稱號，其他收成「+N」 */
const VISIBLE_TITLES = 4

/** 稱號標籤；limit 設成 Infinity 就全部顯示 */
export function TitleLabels({ titles, limit = VISIBLE_TITLES }: { titles: Title[]; limit?: number }) {
  const [expanded, setExpanded] = useState(false)
  if (titles.length === 0) return null

  const hidden = titles.length - limit
  const shown = expanded || hidden <= 0 ? titles : titles.slice(0, limit)

  return (
    <ul className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="稱號">
      {shown.map((t) => (
        <li key={t.label} data-testid="title" className={`${PILL} border ${TONE_CLASS[t.tone]}`}>
          {t.label}
        </li>
      ))}
      {hidden > 0 && (
        <li className="flex">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? '收合稱號' : `顯示其他 ${hidden} 個稱號`}
            onClick={() => setExpanded((v) => !v)}
            className={`${PILL} border border-dashed border-slate-600 text-slate-400 active:bg-slate-800`}
          >
            {expanded ? '收合' : `+${hidden}`}
          </button>
        </li>
      )}
    </ul>
  )
}

/** 連續 2 場以上才顯示 */
const MIN_STREAK = 2

export function StreakLabel({ streak }: { streak: Streak }) {
  if (streak.kind === 'none' || streak.count < MIN_STREAK) return null
  const win = streak.kind === 'win'
  return (
    <span
      data-testid="streak"
      className={`${PILL} shrink-0 font-medium ${
        win ? 'bg-orange-500/15 text-orange-300' : 'bg-sky-500/15 text-sky-300'
      }`}
    >
      {win ? '🔥' : '❄️'} {streak.count} 連{win ? '勝' : '敗'}
    </span>
  )
}

/** 剋星（對戰勝負最差）與提款機（對戰勝負最好） */
export function RivalLabels({ nemesis, atm }: { nemesis?: HeadToHead; atm?: HeadToHead }) {
  if (!nemesis && !atm) return null
  return (
    <ul className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="對戰">
      {nemesis && (
        <li data-testid="nemesis" className={`${PILL} border border-violet-400/30 bg-violet-400/10 text-violet-200`}>
          😈 剋星：{nemesis.opponent}
        </li>
      )}
      {atm && (
        <li data-testid="atm" className={`${PILL} border border-teal-400/30 bg-teal-400/10 text-teal-200`}>
          🏧 提款機：{atm.opponent}
        </li>
      )}
    </ul>
  )
}
