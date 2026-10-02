import type { RankedPlayerResult } from '../types'
import { amountColorClass, formatAmount } from '../lib/format'

/** 金銀銅不隨底色主題變，顏色定義在 index.css 的 --medal-* */
const RANK_BADGE: Record<number, string> = {
  1: 'bg-(--medal-gold) text-(--medal-ink)',
  2: 'bg-(--medal-silver) text-(--medal-ink)',
  3: 'bg-(--medal-bronze) text-(--medal-bronze-ink)',
}

export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        RANK_BADGE[rank] ?? 'bg-slate-800 text-slate-300'
      }`}
      aria-label={`第 ${rank} 名`}
    >
      {rank}
    </span>
  )
}

type RankedListProps = {
  players: RankedPlayerResult[]
  /** 精簡模式用於卡片 */
  compact?: boolean
}

export function RankedList({ players, compact = false }: RankedListProps) {
  return (
    <ol className={compact ? 'space-y-1.5' : 'divide-y divide-slate-800'}>
      {players.map((p) => (
        <li key={p.id} className={`flex items-center gap-3 ${compact ? '' : 'py-3'}`}>
          <RankBadge rank={p.rank} />
          <span className="min-w-0 flex-1 truncate text-slate-100">
            {p.name}
            {p.isTied && <span className="ml-1.5 text-xs text-slate-500">同分</span>}
          </span>
          <span className="shrink-0 text-sm text-slate-500">{p.rounds} 將</span>
          <span
            className={`w-20 shrink-0 text-right font-semibold tabular-nums ${amountColorClass(p.score)} ${
              compact ? '' : 'text-lg'
            }`}
          >
            {formatAmount(p.score)}
          </span>
        </li>
      ))}
    </ol>
  )
}
