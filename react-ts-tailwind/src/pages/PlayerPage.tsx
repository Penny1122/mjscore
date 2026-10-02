import type { ReactNode } from 'react'
import type { GameRecord } from '../types'
import { amountColorClass, formatAmount, formatDate, todayString } from '../lib/format'
import { computeStandings, formatPercent } from '../lib/stats'
import { computeTitles } from '../lib/titles'
import { computeProfile, MIN_TOGETHER, MIN_VENUE_GAMES } from '../lib/profile'
import { RankBadge } from '../components/RankedList'
import { RivalLabels, StreakLabel, TitleLabels } from '../components/Badges'
import { CumulativeChart, MonthBars, RankBars } from '../components/Charts'

type PlayerPageProps = {
  records: GameRecord[]
  name: string
  onOpenRecord: (id: string) => void
  onOpenPlayer: (name: string) => void
}

/** 最近幾場 */
const RECENT = 10

const cardClass = 'rounded-2xl border border-slate-800 bg-slate-900 p-4'

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className={cardClass} aria-label={title}>
      <h2 className="mb-3 font-medium text-slate-100">{title}</h2>
      {children}
      {note && <p className="mt-3 text-xs leading-5 text-slate-600">{note}</p>}
    </section>
  )
}

function Stat({ label, value, className = 'text-slate-100' }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/60 px-2.5 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 truncate font-semibold tabular-nums ${className}`}>{value}</dd>
    </div>
  )
}

export function PlayerPage({ records, name, onOpenRecord, onOpenPlayer }: PlayerPageProps) {
  const standings = computeStandings(records)
  const me = standings.find((s) => s.name === name)
  if (!me) {
    return <p className="py-20 text-center text-slate-400">{name} 還沒有任何紀錄</p>
  }

  const titles = computeTitles(records, standings, todayString()).get(name) ?? []
  const profile = computeProfile(records, name)
  const recent = [...profile.games].reverse().slice(0, RECENT)

  return (
    <div className="space-y-4">
      {/* A. 頁首 */}
      <section className={cardClass} aria-label="個人總覽">
        <div className="flex items-center gap-3">
          <RankBadge rank={me.rank} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-xl font-semibold text-slate-50">{name}</h2>
              <StreakLabel streak={me.streak} />
            </div>
            <p className="text-sm text-slate-500">
              第 {me.rank} 名 · 共 {standings.length} 人
            </p>
          </div>
          <span className={`shrink-0 text-2xl font-bold tabular-nums ${amountColorClass(me.totalScore)}`}>
            {formatAmount(me.totalScore)}
          </span>
        </div>
        <RivalLabels nemesis={profile.nemesis} atm={profile.atm} />
        <TitleLabels titles={titles} limit={Infinity} />
      </section>

      {/* B. 數據格 */}
      <dl className="grid grid-cols-4 gap-2" aria-label="個人數據">
        <Stat label="場數" value={`${me.games}`} />
        <Stat label="總將數" value={`${me.totalRounds}`} />
        <Stat label="勝率" value={formatPercent(me.winRate)} />
        <Stat label="每將" value={formatAmount(me.perRound)} className={amountColorClass(me.perRound)} />
        <Stat label="平均名次" value={profile.avgRank.toFixed(1)} />
        <Stat label="冠軍" value={`${me.firstPlaces} 次`} />
        <Stat label="單場最高" value={formatAmount(me.bestGame)} className={amountColorClass(me.bestGame)} />
        <Stat label="單場最低" value={formatAmount(me.worstGame)} className={amountColorClass(me.worstGame)} />
      </dl>

      {/* C. 名次分布 */}
      <Section title="名次分布">
        <RankBars counts={profile.rankCounts} />
      </Section>

      {/* D. 累計輸贏走勢 */}
      <Section title="累計輸贏走勢" note="按住或滑過圖表看每一場。">
        <CumulativeChart games={profile.games} />
      </Section>

      {/* E. 最近 10 場 */}
      <Section title={`最近 ${Math.min(RECENT, recent.length)} 場`}>
        <ul className="-mx-2 divide-y divide-slate-800" aria-label="最近場次">
          {recent.map((g) => (
            <li key={g.recordId}>
              <button
                type="button"
                onClick={() => onOpenRecord(g.recordId)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left active:bg-slate-800"
              >
                <RankBadge rank={g.rank} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-200">{formatDate(g.date)}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {g.venue ?? '未指定場地'} · {g.players} 人 · {g.rounds} 將
                  </span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${amountColorClass(g.score)}`}>
                  {formatAmount(g.score)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {/* F. 對戰分析 */}
      <Section
        title="對戰分析"
        note={`同一場金額比對方高算贏。剋星／提款機需同桌至少 ${MIN_TOGETHER} 場，取淨勝場（勝 − 負）最差／最好的對手。`}
      >
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1.5 font-normal">對手</th>
                <th className="py-1.5 text-right font-normal">同桌</th>
                <th className="py-1.5 text-right font-normal">勝負</th>
                <th className="py-1.5 text-right font-normal">我的總分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {profile.headToHead.map((h) => {
                const isNemesis = profile.nemesis?.opponent === h.opponent
                const isAtm = profile.atm?.opponent === h.opponent
                return (
                  <tr key={h.opponent} data-testid="h2h">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => onOpenPlayer(h.opponent)}
                        className="text-left text-slate-100 underline decoration-slate-600 underline-offset-4"
                      >
                        {h.opponent}
                      </button>
                      {isNemesis && <span className="ml-1.5" aria-label="剋星">😈</span>}
                      {isAtm && <span className="ml-1.5" aria-label="提款機">🏧</span>}
                    </td>
                    <td className="py-2 text-right text-slate-400 tabular-nums">{h.together}</td>
                    <td className="py-2 text-right tabular-nums">
                      <span className="text-slate-200">{h.wins}</span>
                      <span className="text-slate-500"> 勝 </span>
                      <span className="text-slate-200">{h.losses}</span>
                      <span className="text-slate-500"> 負</span>
                      {h.draws > 0 && <span className="text-slate-500"> {h.draws} 平</span>}
                    </td>
                    <td className={`py-2 text-right font-medium tabular-nums ${amountColorClass(h.myTotal)}`}>
                      {formatAmount(h.myTotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* G. 場地表現 */}
      {profile.venues.length > 0 && (
        <Section
          title="場地表現"
          note={`主場／客場魔咒需該場地至少 ${MIN_VENUE_GAMES} 場，取總分最高（需為正）／最低（需為負）。`}
        >
          {(profile.home || profile.away) && (
            <ul className="mb-3 flex flex-wrap gap-1" aria-label="主場與客場">
              {profile.home && (
                <li
                  data-testid="home"
                  className="inline-flex h-6 items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 text-xs leading-none text-amber-200"
                >
                  🏠 主場：{profile.home.venue}
                </li>
              )}
              {profile.away && (
                <li
                  data-testid="away"
                  className="inline-flex h-6 items-center rounded-full border border-slate-600 bg-slate-800 px-2 text-xs leading-none text-slate-300"
                >
                  👻 客場魔咒：{profile.away.venue}
                </li>
              )}
            </ul>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1.5 font-normal">場地</th>
                <th className="py-1.5 text-right font-normal">場數</th>
                <th className="py-1.5 text-right font-normal">勝率</th>
                <th className="py-1.5 text-right font-normal">總分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {profile.venues.map((v) => (
                <tr key={v.venue} data-testid="venue-stat">
                  <td className="max-w-0 truncate py-2 text-slate-100">{v.venue}</td>
                  <td className="py-2 text-right text-slate-400 tabular-nums">{v.games}</td>
                  <td className="py-2 text-right text-slate-300 tabular-nums">{formatPercent(v.winRate)}</td>
                  <td className={`py-2 text-right font-medium tabular-nums ${amountColorClass(v.total)}`}>
                    {formatAmount(v.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* H. 每月表現 */}
      <Section title="每月表現">
        <MonthBars months={profile.months} />
      </Section>
    </div>
  )
}
