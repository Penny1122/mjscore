import type { GameRecord } from '../types'
import { formatAmount, formatDate } from './format'
import { rankPlayers } from './ranking'

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

/** 單筆紀錄轉成可貼到 LINE 的文字 */
export function recordToText(record: GameRecord): string {
  const ranked = rankPlayers(record.players)
  const totalRounds = Math.max(...record.players.map((p) => p.rounds))

  const lines = [`🀄 ${formatDate(record.date)}`]
  if (record.venue) lines.push(`📍 ${record.venue}`)
  lines.push('')
  for (const p of ranked) {
    const mark = MEDALS[p.rank] ?? `${p.rank}.`
    lines.push(`${mark} ${p.name}　${formatAmount(p.score)}（${p.rounds} 將）${p.isTied ? '同分' : ''}`)
  }
  lines.push('')

  lines.push(`共 ${totalRounds} 將`)
  return lines.join('\n')
}

/** LINE 分享連結：手機會開啟 LINE 選擇傳送對象 */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`
}
