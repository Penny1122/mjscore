import { useState, type FormEvent } from 'react'

type SettingsPageProps = {
  busy: boolean
  onLock: () => void
  /** 回傳錯誤訊息；成功回傳 null */
  onChangePassword: (newPassword: string) => Promise<string | null>
}

const sectionClass = 'space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4'
const inputClass =
  'h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30'

export function SettingsPage({
  busy,
  onLock,
  onChangePassword,
}: SettingsPageProps) {
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const mismatch = confirm !== '' && next !== confirm
  const canChange = next.length >= 8 && next === confirm && !busy

  const handleChange = async (e: FormEvent) => {
    e.preventDefault()
    if (!canChange) return
    setMessage(null)
    const error = await onChangePassword(next)
    if (error) {
      setMessage({ ok: false, text: error })
    } else {
      setNext('')
      setConfirm('')
      setMessage({ ok: true, text: '密碼已更改。其他裝置需要用新密碼重新解鎖。' })
    }
  }

  return (
    <div className="space-y-4">
      <form className={sectionClass} onSubmit={handleChange} noValidate aria-labelledby="pw-heading">
        <h2 id="pw-heading" className="font-medium text-slate-100">
          更改編輯密碼
        </h2>
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm text-slate-400">
            新密碼（至少 8 個字元）
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm text-slate-400">
            再輸入一次
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          {mismatch && <p className="mt-1 text-xs text-rose-400">兩次輸入不一樣</p>}
        </div>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={!canChange}
          className="h-12 w-full rounded-xl border border-slate-700 font-medium text-slate-200 active:bg-slate-800 disabled:opacity-40"
        >
          更改密碼
        </button>
      </form>

      <section className={sectionClass} aria-labelledby="lock-heading">
        <h2 id="lock-heading" className="font-medium text-slate-100">
          鎖定
        </h2>
        <p className="text-sm text-slate-400">這台裝置回到唯讀，要再編輯需重新輸入密碼。</p>
        <button
          type="button"
          onClick={onLock}
          className="h-12 w-full rounded-xl border border-rose-500/50 font-medium text-rose-400 active:bg-rose-500/10"
        >
          鎖定此裝置
        </button>
      </section>
    </div>
  )
}
