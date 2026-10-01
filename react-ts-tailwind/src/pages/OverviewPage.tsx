import type { GameRecord, KnownPlayer, Venue } from '../types'
import { amountColorClass, formatAmount, formatDate } from '../lib/format'
import { computeStandings, countBy, formatPercent, summarize } from '../lib/stats'
import { RankBadge } from '../components/RankedList'

type OverviewPageProps = {
  records: GameRecord[]
  players: KnownPlayer[]
  venues: Venue[]
}

const cardClass = 'rounded-2xl border border-slate-800 bg-slate-900 p-4'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold text-slate-100 tabular-nums">{value}</dd>
    </div>
  )
}

function Labels({
  title,
  items,
  counts,
  unit,
  empty,
}: {
  title: string
  items: { name: string }[]
  counts: Map<string, number>
  unit: string
  empty: string
}) {
  return (
    <section className={cardClass} aria-labelledby={`labels-${title}`}>
      <h2 id={`labels-${title}`} className="mb-3 flex items-baseline justify-between">
        <span className="font-medium text-slate-100">{title}</span>
        <span className="text-sm text-slate-500">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={`${title}標籤`}>
          {items.map((item) => {
            const count = counts.get(item.name) ?? 0
            return (
              <li
                key={item.name}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 pr-1 pl-3 text-sm text-slate-200"
              >
                {item.name}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    count ? 'bg-cyan-400/15 text-cyan-200' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {count} {unit}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function OverviewPage({ records, players, venues }: OverviewPageProps) {
  const standings = computeStandings(records)
  const summary = summarize(records)
  const playerCounts = countBy(records, (r) => r.players.map((p) => p.name))
  const venueCounts = countBy(records, (r) => (r.venue ? [r.venue] : []))

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="總場數" value={`${summary.games} 場`} />
        <Stat label="總將數" value={`${summary.totalRounds} 將`} />
        <Stat
          label="最近一場"
          value={summary.lastDate ? formatDate(summary.lastDate).slice(5, 10) : '—'}
        />
      </dl>

      <section className={cardClass} aria-labelledby="standings-heading">
        <h2 id="standings-heading" className="mb-1 font-medium text-slate-100">
          戰績排行
        </h2>
        {standings.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">還沒有任何紀錄</p>
        ) : (
          <>
            <ol className="divide-y divide-slate-800" aria-label="戰績排行">
              {standings.map((s) => (
                <li key={s.name} className="flex items-center gap-3 py-3" data-testid="standing">
                  <RankBadge rank={s.rank} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-slate-100">{s.name}</span>
                      <span
                        className={`shrink-0 text-lg font-semibold tabular-nums ${amountColorClass(s.totalScore)}`}
                      >
                        {formatAmount(s.totalScore)}
                      </span>
                    </div>
                    <dl className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                      <div className="flex gap-1">
                        <dt>場數</dt>
                        <dd className="text-slate-300">{s.games}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>總將數</dt>
                        <dd className="text-slate-300">{s.totalRounds}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>勝率</dt>
                        <dd className="text-slate-300">
                          {formatPercent(s.winRate)}（{s.wins}/{s.games}）
                        </dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>每將</dt>
                        <dd className={amountColorClass(s.perRound)}>{formatAmount(s.perRound)}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              總分為所有紀錄金額加總，不含東錢。勝率 = 贏錢場數 ÷ 出場場數（0 元不算贏）。
            </p>
          </>
        )}
      </section>

      <Labels
        title="牌咖"
        items={players}
        counts={playerCounts}
        unit="場"
        empty="還沒有牌咖"
      />
      <Labels title="場地" items={venues} counts={venueCounts} unit="場" empty="還沒有場地" />
    </div>
  )
}
