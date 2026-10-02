import { useState, type FormEvent } from 'react'

type UnlockPageProps = {
  /** 額外提示，例如「密碼已變更，請重新解鎖」 */
  notice?: string | null
  /** 回傳錯誤訊息；成功回傳 null */
  onUnlock: (password: string) => Promise<string | null>
}

export function UnlockPage({ notice, onUnlock }: UnlockPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    const message = await onUnlock(password)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-4">
      <div className="space-y-2 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-slate-300">目前為唯讀模式</p>
        <p className="text-sm text-slate-500">輸入編輯密碼後，才能新增、編輯、刪除紀錄。</p>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
        >
          {notice}
        </p>
      )}

      <div>
        <label htmlFor="edit-password" className="mb-1.5 block text-sm text-slate-400">
          編輯密碼
        </label>
        <input
          id="edit-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`h-12 w-full rounded-xl border bg-slate-950 px-3 text-base text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${
            error ? 'border-rose-500' : 'border-slate-700'
          }`}
        />
        {error && (
          <p role="alert" className="mt-1.5 text-sm text-rose-400">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!password || busy}
        className="h-12 w-full rounded-xl bg-cyan-400 font-semibold text-slate-950 active:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500"
      >
        {busy ? '確認中…' : '解鎖'}
      </button>

      <p className="text-center text-xs text-slate-600">解鎖後這台裝置會記住，點右上角「已解鎖」可以鎖定。</p>
    </form>
  )
}
