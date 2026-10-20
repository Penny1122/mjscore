import { useEffect, useState } from 'react'
import type { GameRecord } from '../types'
import { lineShareUrl, recordToText } from '../lib/share'

type ShareButtonsProps = {
  record: GameRecord
  /** 精簡模式用於卡片 */
  compact?: boolean
}

/** 舊瀏覽器或非 https 沒有 navigator.clipboard，退回 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function ShareButtons({ record, compact = false }: ShareButtonsProps) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const size = compact ? 'h-9 text-sm' : 'h-12'

  return (
    <div className="grid grid-cols-2 gap-2">
      <a
        href={lineShareUrl(recordToText(record))}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center rounded-xl bg-[#06C755] font-medium text-white active:opacity-80 ${size}`}
      >
        分享到 LINE
      </a>
      <button
        type="button"
        onClick={async () => setCopied((await copyText(recordToText(record))) ? 'ok' : 'fail')}
        className={`rounded-xl border border-slate-700 font-medium text-slate-300 active:bg-slate-800 ${size}`}
      >
        {copied === 'ok' ? '已複製 ✓' : copied === 'fail' ? '複製失敗' : '複製文字'}
      </button>
    </div>
  )
}
