import { useState } from 'react'
import type { GameRecord } from '../types'
import { formatDate, formatDateTime } from '../lib/format'
import { rankPlayers } from '../lib/ranking'
import { RankedList } from '../components/RankedList'
import { ConfirmDialog } from '../components/ConfirmDialog'

type DetailPageProps = {
  record: GameRecord
  /** 唯讀時不顯示編輯、刪除 */
  canEdit: boolean
  busy: boolean
  onEdit: () => void
  onDelete: () => void
}

export function DetailPage({ record, canEdit, busy, onEdit, onDelete }: DetailPageProps) {
  const [confirming, setConfirming] = useState(false)
  const ranked = rankPlayers(record.players)
  /** 總將數為所有玩家中最高的將數 */
  const totalRounds = Math.max(...record.players.map((p) => p.rounds))

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">{formatDate(record.date)}</h2>
          <span className="text-sm text-slate-500">{record.players.length} 人</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-400">
          {record.venue ? `📍 ${record.venue}` : '未指定場地'}
        </p>
        <div className="mt-1">
          <RankedList players={ranked} />
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <dt className="text-slate-500">東錢</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-200 tabular-nums">
            {record.houseFee === undefined ? '—' : `${record.houseFee} 元`}
          </dd>
          {record.houseFee !== undefined && (
            <dd className="mt-0.5 text-xs text-slate-500">
              {record.houseFeeInTotal ? '計入加總' : '不計入加總'}
            </dd>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <dt className="text-slate-500">總將數</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-200 tabular-nums">
            {totalRounds} 將
          </dd>
        </div>
      </dl>

      <p className="space-y-0.5 px-1 text-xs text-slate-600">
        <span className="block">建立：{formatDateTime(record.createdAt)}</span>
        {record.updatedAt !== record.createdAt && (
          <span className="block">修改：{formatDateTime(record.updatedAt)}</span>
        )}
      </p>

      {canEdit && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="h-12 rounded-xl border border-rose-500/50 font-medium text-rose-400 active:bg-rose-500/10 disabled:opacity-50"
          >
            {busy ? '處理中…' : '刪除'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className="h-12 rounded-xl bg-cyan-400 font-semibold text-slate-950 active:bg-cyan-300 disabled:opacity-50"
          >
            編輯
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="刪除這筆紀錄？"
        message={`${formatDate(record.date)} 的紀錄刪除後無法復原。`}
        confirmLabel="刪除"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          onDelete()
        }}
      />
    </div>
  )
}
