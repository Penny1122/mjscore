import { useState, type FormEvent } from 'react'
import { NAME_MAX } from '../lib/validation'

type RenameDialogProps = {
  /** 要改名的牌咖，null 時不顯示 */
  name: string | null
  /** 名單中的所有名字，用來判斷是否為合併 */
  existing: string[]
  busy: boolean
  onSubmit: (oldName: string, newName: string) => Promise<void>
  onCancel: () => void
}

export function RenameDialog({ name, ...rest }: RenameDialogProps) {
  if (name === null) return null
  // 換人時重新掛載，輸入框回到新的名字
  return <RenameForm key={name} name={name} {...rest} />
}

function RenameForm({
  name,
  existing,
  busy,
  onSubmit,
  onCancel,
}: Omit<RenameDialogProps, 'name'> & { name: string }) {
  const [value, setValue] = useState(name)
  const next = value.trim()
  const error = !next
    ? '請輸入名字'
    : next.length > NAME_MAX
      ? `最多 ${NAME_MAX} 個字`
      : undefined
  const merging = next !== name && existing.includes(next)
  const canSubmit = !error && next !== name && !busy

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (canSubmit) await onSubmit(name, next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        noValidate
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rename-title" className="text-lg font-semibold text-slate-100">
          幫「{name}」改名
        </h2>
        <input
          aria-label="新名字"
          value={value}
          maxLength={NAME_MAX + 10}
          autoComplete="off"
          autoFocus
          enterKeyHint="done"
          onChange={(e) => setValue(e.target.value)}
          className={`mt-4 h-12 w-full rounded-xl border bg-slate-950 px-3 text-base text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${
            error ? 'border-rose-500' : 'border-slate-700'
          }`}
        />
        {error ? (
          <p className="mt-1.5 text-sm text-rose-400">{error}</p>
        ) : merging ? (
          <p className="mt-2 text-sm leading-6 text-amber-300">
            「{next}」已在名單中，兩人的紀錄會合併成同一人，合併後無法自動分開。
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-400">所有紀錄裡的名字都會一起改。</p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-xl border border-slate-700 font-medium text-slate-200 active:bg-slate-800"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`h-12 rounded-xl font-semibold disabled:bg-slate-800 disabled:text-slate-500 ${
              merging
                ? 'bg-amber-400 text-slate-950 active:bg-amber-300'
                : 'bg-cyan-400 text-slate-950 active:bg-cyan-300'
            }`}
          >
            {merging ? '合併' : '改名'}
          </button>
        </div>
      </form>
    </div>
  )
}
