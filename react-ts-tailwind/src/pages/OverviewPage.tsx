import type { GameRecord, KnownPlayer, Venue } from '../types'
import { amountColorClass, formatAmount, formatDate, todayString } from '../lib/format'
import { computeStandings, countBy, formatPercent, summarize } from '../lib/stats'
import { computeProfile, MIN_TOGETHER } from '../lib/profile'
import { RankBadge } from '../components/RankedList'
import { computeTitles, TITLE_RULES } from '../lib/titles'
import { RivalLabels, StreakLabel, TitleLabels } from '../components/Badges'

type OverviewPageProps = {
  records: GameRecord[]
  players: KnownPlayer[]
  venues: Venue[]
  onOpenPlayer: (name: string) => void
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
  onOpen,
}: {
  title: string
  items: { name: string }[]
  counts: Map<string, number>
  unit: string
  empty: string
  /** 有傳就可以點標籤 */
  onOpen?: (name: string) => void
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
            const pillClass =
              'inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 pr-1 pl-3 text-sm text-slate-200'
            const inner = (
              <>
                {item.name}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    count ? 'bg-cyan-400/15 text-cyan-200' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {count} {unit}
                </span>
              </>
            )
            // 沒上過桌的牌咖沒有個人數據可看
            return (
              <li key={item.name} className="flex">
                {onOpen && count > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpen(item.name)}
                    className={`${pillClass} active:bg-slate-700`}
                  >
                    {inner}
                  </button>
                ) : (
                  <span className={pillClass}>{inner}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function OverviewPage({ records, players, venues, onOpenPlayer }: OverviewPageProps) {
  const standings = computeStandings(records)
  const titles = computeTitles(records, standings, todayString())
  const rivals = new Map(
    standings.map((s) => {
      const p = computeProfile(records, s.name)
      return [s.name, { nemesis: p.nemesis, atm: p.atm }]
    }),
  )
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
                <li key={s.name} className="flex items-start gap-3 py-3" data-testid="standing">
                  <span className="pt-0.5">
                    <RankBadge rank={s.rank} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenPlayer(s.name)}
                      aria-label={`查看 ${s.name} 的個人數據`}
                      className="-mx-2 -my-1 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left active:bg-slate-800"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-slate-100">{s.name}</span>
                          <StreakLabel streak={s.streak} />
                        </span>
                        <span
                          className={`shrink-0 text-lg font-semibold tabular-nums ${amountColorClass(s.totalScore)}`}
                        >
                          {formatAmount(s.totalScore)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                        <span className="flex gap-1">
                          <span>場數</span>
                          <span className="text-slate-300">{s.games}</span>
                        </span>
                        <span className="flex gap-1">
                          <span>總將數</span>
                          <span className="text-slate-300">{s.totalRounds}</span>
                        </span>
                        <span className="flex gap-1">
                          <span>勝率</span>
                          <span className="text-slate-300">
                            {formatPercent(s.winRate)}（{s.wins}/{s.games}）
                          </span>
                        </span>
                        <span className="flex gap-1">
                          <span>每將</span>
                          <span className={amountColorClass(s.perRound)}>
                            {formatAmount(s.perRound)}
                          </span>
                        </span>
                      </span>
                    </button>
                    <RivalLabels {...rivals.get(s.name)} />
                    <TitleLabels titles={titles.get(s.name) ?? []} />
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              點名字看個人數據。總分為所有紀錄金額加總，不含東錢。勝率 = 贏錢場數 ÷ 出場場數（0
              元不算贏）。連勝／連敗從最近一場往回數，打平會中斷。 剋星／提款機：同桌至少{' '}
              {MIN_TOGETHER} 場，同一場金額比對方高算贏，淨勝場最差／最好的對手。
            </p>
            <details className="group mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer list-none py-1 text-slate-400 select-none">
                <span className="inline-block transition group-open:rotate-90">›</span> 稱號說明
              </summary>
              <dl className="mt-1 space-y-1">
                {TITLE_RULES.map((r) => (
                  <div key={r.id} className="flex gap-2">
                    <dt className="w-28 shrink-0 text-slate-300">{r.name}</dt>
                    <dd>{r.rule}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-slate-600">同分時大家都拿得到；所有人都一樣時不頒。</p>
            </details>
          </>
        )}
      </section>

      <Labels
        title="牌咖"
        items={players}
        counts={playerCounts}
        unit="場"
        empty="還沒有牌咖"
        onOpen={onOpenPlayer}
      />
      <Labels title="場地" items={venues} counts={venueCounts} unit="場" empty="還沒有場地" />
    </div>
  )
}
