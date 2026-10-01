import type { GameRecord } from '../types'
import { amountColorClass, formatAmount, formatDate } from '../lib/format'
import { rankPlayers } from '../lib/ranking'
import { RankedList } from './RankedList'

type RecordCardProps = {
  record: GameRecord
  onOpen: () => void
}

export function RecordCard({ record, onOpen }: RecordCardProps) {
  const ranked = rankPlayers(record.players)
  const winners = ranked.filter((p) => p.rank === 1)

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="record-card"
      className="block w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition active:scale-[0.99] active:bg-slate-800/80"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-medium text-slate-200">{formatDate(record.date)}</span>
          {record.venue && (
            <span className="block truncate text-sm text-slate-400">📍 {record.venue}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-slate-500">
          {record.houseFee !== undefined && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
              東錢 {record.houseFee}
              {record.houseFeeInTotal && ' · 計入'}
            </span>
          )}
          <span>{record.players.length} 人</span>
        </span>
      </div>

      {winners.length > 0 && (
        <div className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-amber-400/10 px-3 py-2">
          <span className="min-w-0 truncate text-amber-200">
            <span className="mr-1.5">🏆</span>
            {winners.map((w) => w.name).join('、')}
          </span>
          <span className={`shrink-0 text-xl font-bold tabular-nums ${amountColorClass(winners[0].score)}`}>
            {formatAmount(winners[0].score)}
          </span>
        </div>
      )}

      <div className="mt-3">
        <RankedList players={ranked} compact />
      </div>
    </button>
  )
}
