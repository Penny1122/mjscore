import { useState, type FormEvent } from 'react'
import type { KnownPlayer, Venue } from '../types'
import { formatDateTime } from '../lib/format'
import { NAME_MAX } from '../lib/validation'
import { ConfirmDialog } from '../components/ConfirmDialog'

export type RosterKind = 'players' | 'venues'

type RosterPageProps = {
  players: KnownPlayer[]
  venues: Venue[]
  /** 唯讀時不能新增、刪除 */
  canEdit: boolean
  busy: boolean
  /** 成功回傳 true */
  onAdd: (kind: RosterKind, name: string) => Promise<boolean>
  onForget: (kind: RosterKind, name: string) => void
}

type Item = { name: string; detail: string }

const LABELS: Record<RosterKind, { tab: string; unit: string; placeholder: string; empty: string }> = {
  players: {
    tab: '牌咖',
    unit: '牌咖',
    placeholder: '輸入牌咖名字',
    empty: '還沒有牌咖。存檔時會自動記住上桌的人，也可以在這裡先新增。',
  },
  venues: {
    tab: '場地',
    unit: '場地',
    placeholder: '輸入場地名稱，例：阿明家',
    empty: '還沒有場地。可以在這裡新增，或記錄時直接輸入。',
  },
}

export function RosterPage({ players, venues, canEdit, busy, onAdd, onForget }: RosterPageProps) {
  const [kind, setKind] = useState<RosterKind>('players')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const label = LABELS[kind]
  const items: Item[] =
    kind === 'players'
      ? players.map((p) => ({
          name: p.name,
          detail: p.lastPlayedAt ? `最近上桌：${formatDateTime(p.lastPlayedAt)}` : '尚未上桌',
        }))
      : venues.map((v) => ({
          name: v.name,
          detail: v.lastUsedAt ? `最近使用：${formatDateTime(v.lastUsedAt)}` : '尚未使用',
        }))

  const switchKind = (next: RosterKind) => {
    setKind(next)
    setName('')
    setError(null)
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    if (trimmed.length > NAME_MAX) return setError(`最多 ${NAME_MAX} 個字`)
    if (items.some((i) => i.name === trimmed)) return setError(`「${trimmed}」已在名單中`)
    setError(null)
    if (await onAdd(kind, trimmed)) setName('')
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1">
        {(Object.keys(LABELS) as RosterKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => switchKind(k)}
            className={`h-10 rounded-lg text-sm font-medium transition ${
              kind === k ? 'bg-slate-700 text-slate-50' : 'text-slate-400'
            }`}
          >
            {LABELS[k].tab}（{k === 'players' ? players.length : venues.length}）
          </button>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} noValidate>
          <div className="flex gap-2">
            <input
              aria-label={`新增${label.unit}`}
              placeholder={label.placeholder}
              value={name}
              maxLength={NAME_MAX + 10}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              className={`h-12 min-w-0 flex-1 rounded-xl border bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${
                error ? 'border-rose-500' : 'border-slate-700'
              }`}
            />
            <button
              type="submit"
              disabled={!name.trim() || busy}
              className="h-12 shrink-0 rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 active:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500"
            >
              新增
            </button>
          </div>
          {error && <p className="mt-1.5 text-sm text-rose-400">{error}</p>}
        </form>
      )}

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm leading-6 text-slate-500">{label.empty}</p>
      ) : (
        <ul
          className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900"
          aria-label={`${label.unit}名單`}
        >
          {items.map((item) => (
            <li key={item.name} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-slate-100">{item.name}</p>
                <p className="text-xs text-slate-600">{item.detail}</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`刪除 ${item.name}`}
                  disabled={busy}
                  onClick={() => setPending(item.name)}
                  className="h-10 rounded-lg px-3 text-sm text-rose-400 active:bg-rose-500/10 disabled:opacity-50"
                >
                  刪除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && items.length > 0 && (
        <p className="px-1 text-xs text-slate-600">從名單刪除不會影響已存的紀錄。</p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={`從${label.unit}名單移除「${pending ?? ''}」？`}
        message="已存的紀錄不受影響。"
        confirmLabel="移除"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onForget(kind, pending)
          setPending(null)
        }}
      />
    </div>
  )
}
