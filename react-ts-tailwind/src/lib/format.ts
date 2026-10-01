/** 金額加正負號，不加千分位：+1200、-800、0 */
export function formatAmount(amount: number): string {
  return amount > 0 ? `+${amount}` : String(amount)
}

/** 正分綠、負分紅、零為中性色 */
export function amountColorClass(amount: number): string {
  if (amount > 0) return 'text-emerald-400'
  if (amount < 0) return 'text-rose-400'
  return 'text-slate-300'
}

/** 今天的本地日期 YYYY-MM-DD */
export function todayString(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 2026-10-01 → 2026/10/01（四） */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${weekday}）`
}

export function formatDateTime(iso: string): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return iso
  return t.toLocaleString('zh-TW', { hour12: false })
}
