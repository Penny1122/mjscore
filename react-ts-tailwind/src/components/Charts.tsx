import { useState, type PointerEvent } from 'react'
import { formatAmount, formatDate } from '../lib/format'
import type { MonthStat, PlayerGame } from '../lib/profile'

/**
 * 圖表顏色：贏／輸用 green-400 / red-400（色盲辨識度在可接受範圍，
 * 且一定搭配正負號與零線位置，不只靠顏色）；單一數量用 cyan。
 * 色值定義在 index.css，隨主題切換；SVG 線條用 style 套用，presentation attribute 不支援 var()。
 */
const GAIN = 'var(--chart-gain)'
const LOSS = 'var(--chart-loss)'
const ACCENT = 'var(--chart-accent)'
const GRID = 'var(--chart-grid)'
const CURSOR = 'var(--chart-cursor)'

/** 累計輸贏折線：x 為第幾場，y 為累計總分；按住或滑過顯示該場 */
export function CumulativeChart({ games }: { games: PlayerGame[] }) {
  const [active, setActive] = useState<number | null>(null)
  if (games.length < 2) {
    return <p className="py-6 text-center text-sm text-slate-500">至少 2 場才畫得出走勢</p>
  }

  const W = 320
  const H = 140
  const pad = { top: 12, right: 8, bottom: 8, left: 8 }
  const values = games.map((g) => g.cumulative)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const x = (i: number) => pad.left + (i / (games.length - 1)) * (W - pad.left - pad.right)
  const y = (v: number) => pad.top + ((max - v) / span) * (H - pad.top - pad.bottom)
  const points = games.map((g, i) => `${x(i).toFixed(1)},${y(g.cumulative).toFixed(1)}`).join(' ')
  const last = games[games.length - 1]
  // 讀數固定在圖上方，不蓋住線；沒有游標時顯示最新一場
  const current = active ?? games.length - 1
  const shown = games[current]

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const i = Math.round(((ratio * W - pad.left) / (W - pad.left - pad.right)) * (games.length - 1))
    setActive(Math.max(0, Math.min(games.length - 1, i)))
  }

  return (
    <figure>
      <p role="status" className="mb-1 flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="text-slate-400">
          第 {current + 1} 場 · {formatDate(shown.date).slice(5)}
          {active === null && <span className="text-slate-600">（最新）</span>}
        </span>
        <span className="text-slate-200">
          該場 {formatAmount(shown.score)} · 累計 {formatAmount(shown.cumulative)}
        </span>
      </p>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-36 w-full touch-none"
          preserveAspectRatio="none"
          role="img"
          aria-label={`累計輸贏走勢，共 ${games.length} 場，目前 ${formatAmount(last.cumulative)}`}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
        >
          {/* 零線 */}
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={y(0)}
            y2={y(0)}
            style={{ stroke: GRID }}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={points}
            fill="none"
            style={{ stroke: ACCENT }}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={pad.top}
              y2={H - pad.bottom}
              style={{ stroke: CURSOR }}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* 端點與游標點用 HTML 畫，才不會被 preserveAspectRatio 壓扁 */}
        {[current].map((i) => (
          <span
            key={i}
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-slate-900"
            style={{
              left: `${(x(i) / W) * 100}%`,
              top: `${(y(games[i].cumulative) / H) * 100}%`,
              background: ACCENT,
            }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-slate-500 tabular-nums">
        <span>{formatDate(games[0].date).slice(0, 10)}</span>
        <span>
          最高 {formatAmount(Math.max(...values))} · 最低 {formatAmount(Math.min(...values))}
        </span>
        <span>{formatDate(last.date).slice(0, 10)}</span>
      </figcaption>
    </figure>
  )
}

/** 名次分布：橫條，單一顏色，直接標數字 */
export function RankBars({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts)
  const total = counts.reduce((a, b) => a + b, 0)
  return (
    <ul className="space-y-1.5" aria-label="名次分布">
      {counts.map((count, i) => (
        <li key={i} className="flex items-center gap-2 text-sm" title={`第 ${i + 1} 名 ${count} 次`}>
          <span className="w-12 shrink-0 text-slate-400">第 {i + 1} 名</span>
          <span className="h-4 flex-1">
            {count > 0 && (
              <span
                className="block h-full rounded-r"
                style={{ width: `${(count / max) * 100}%`, background: ACCENT }}
              />
            )}
          </span>
          <span className="w-16 shrink-0 text-right text-slate-300 tabular-nums">
            {count} 次
            <span className="ml-1 text-xs text-slate-500">
              {total ? Math.round((count / total) * 100) : 0}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 每月表現：以中間為零，贏往右、輸往左，數字帶正負號 */
export function MonthBars({ months }: { months: MonthStat[] }) {
  const max = Math.max(1, ...months.map((m) => Math.abs(m.total)))
  return (
    <ul className="space-y-1.5" aria-label="每月表現">
      {months.map((m) => {
        const width = `${(Math.abs(m.total) / max) * 50}%`
        return (
          <li
            key={m.month}
            className="flex items-center gap-2 text-sm"
            title={`${m.month}：${m.games} 場，${formatAmount(m.total)}`}
          >
            <span className="w-16 shrink-0 text-slate-400 tabular-nums">{m.month.replace('-', '/')}</span>
            <span className="relative h-4 flex-1">
              <span className="absolute inset-y-0 left-1/2 w-px bg-slate-700" />
              {m.total !== 0 && (
                <span
                  className={`absolute inset-y-0 ${m.total > 0 ? 'left-1/2 rounded-r' : 'right-1/2 rounded-l'}`}
                  style={{ width, background: m.total > 0 ? GAIN : LOSS }}
                />
              )}
            </span>
            <span className="w-24 shrink-0 text-right tabular-nums">
              <span className="text-slate-200">{formatAmount(m.total)}</span>
              <span className="ml-1 text-xs text-slate-500">{m.games} 場</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
