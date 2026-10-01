import type { RankedPlayerResult } from '../types'
import { amountColorClass, formatAmount } from '../lib/format'

const RANK_BADGE: Record<number, string> = {
  1: 'bg-amber-400 text-slate-950',
  2: 'bg-slate-300 text-slate-950',
  3: 'bg-orange-700 text-orange-50',
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
