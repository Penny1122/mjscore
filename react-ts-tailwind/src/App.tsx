import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { GameRecord, GameRecordInput, KnownPlayer, Venue } from './types'
import { api } from './lib/supabase'
import { isPasswordError, toApiError, type Api } from './lib/api'
import { clearEditPassword, loadEditPassword, saveEditPassword } from './lib/editPassword'
import { RecordForm } from './components/RecordForm'
import { HistoryPage } from './pages/HistoryPage'
import { DetailPage } from './pages/DetailPage'
import { RosterPage } from './pages/RosterPage'
import { ThemePicker } from './components/ThemePicker'
import { UnlockPage } from './pages/UnlockPage'
import { ConfirmDialog } from './components/ConfirmDialog'
import { OverviewPage } from './pages/OverviewPage'
import { PlayerPage } from './pages/PlayerPage'

type View =
  | { name: 'overview' }
  | { name: 'new' }
  | { name: 'history' }
  | { name: 'roster' }
  | { name: 'unlock' }
  | { name: 'detail'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'player'; player: string }

type Tab = 'overview' | 'new' | 'history' | 'roster' | 'unlock'

/** 導覽列圖示（24×24 線條圖，跟著文字顏色） */
const ICON_PATHS: Record<Tab, string> = {
  overview: 'M3 20h18M6 20V11M11 20V5M16 20v-6M21 20V9',
  new: 'M12 5v14M5 12h14',
  history: 'M4 6h16M4 12h16M4 18h10',
  roster:
    'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74',
  unlock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
}

const EDIT_TABS: { tab: Tab; label: string }[] = [
  { tab: 'overview', label: '總覽' },
  { tab: 'new', label: '新增紀錄' },
  { tab: 'history', label: '歷史紀錄' },
  { tab: 'roster', label: '名單' },
]

const READ_ONLY_TABS: { tab: Tab; label: string }[] = [
  { tab: 'overview', label: '總覽' },
  { tab: 'history', label: '歷史紀錄' },
  { tab: 'roster', label: '名單' },
  { tab: 'unlock', label: '解鎖' },
]

const TITLES: Record<View['name'], string> = {
  overview: '總覽',
  new: '新增紀錄',
  history: '歷史紀錄',
  roster: '牌咖與場地',
  unlock: '解鎖編輯',
  detail: '紀錄明細',
  edit: '編輯紀錄',
  player: '牌咖',
}

/** 需要解鎖才能進入的頁面 */
const EDIT_ONLY = new Set<View['name']>(['new', 'edit'])

/** 底部導覽亮哪一個：看這一串頁面是從哪個分頁開始的 */
function activeTab(root: View): Tab {
  if (root.name === 'detail' || root.name === 'edit') return 'history'
  if (root.name === 'player') return 'overview'
  return root.name
}

/** 沒有上一頁可回時，返回鍵要去的地方 */
function fallbackBack(view: View): View | undefined {
  if (view.name === 'detail') return { name: 'history' }
  if (view.name === 'edit') return { name: 'detail', id: view.id }
  if (view.name === 'player') return { name: 'overview' }
  return undefined
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="py-20 text-center text-slate-400">{children}</div>
}

export default function App() {
  if (!api) {
    return (
      <div className="min-h-dvh bg-slate-950 px-4 py-20 text-center text-slate-300">
        <p>尚未設定 Supabase 連線。</p>
        <p className="mt-2 text-sm text-slate-500">
          請複製 .env.example 為 .env.local 並填入專案的 URL 與 publishable key，然後重新啟動。
        </p>
      </div>
    )
  }
  return <ConnectedApp api={api} />
}

function ConnectedApp({ api }: { api: Api }) {
  const [password, setPassword] = useState<string | null>(loadEditPassword)
  // 一進來先看總覽
  // 頁面堆疊：最後一個是目前頁面；點進去用 push，返回用 pop，切換分頁就重設
  const [stack, setStack] = useState<View[]>([{ name: 'overview' }])
  const view = stack[stack.length - 1]
  const [records, setRecords] = useState<GameRecord[]>([])
  const [knownPlayers, setKnownPlayers] = useState<KnownPlayer[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null)
  const [confirmingLock, setConfirmingLock] = useState(false)
  const loadedOnce = useRef(false)

  const canEdit = password !== null

  const refresh = useCallback(async () => {
    try {
      const [r, k, v] = await Promise.all([
        api.fetchRecords(),
        api.fetchKnownPlayers(),
        api.fetchVenues(),
      ])
      setRecords(r)
      setKnownPlayers(k)
      setVenues(v)
      setStatus('ready')
      loadedOnce.current = true
    } catch (e) {
      if (loadedOnce.current) setError(toApiError(e).message)
      else setStatus('error')
    }
  }, [api])

  // 啟動時載入；切回這個分頁時重新載入，才看得到別人剛存的紀錄
  useEffect(() => {
    // refresh 的 setState 都在 await 之後，不是在 effect 中同步更新
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const lock = useCallback((notice: string | null = null) => {
    clearEditPassword()
    setPassword(null)
    setUnlockNotice(notice)
  }, [])

  // 記住的密碼可能已在別的裝置被更改，啟動時確認一次（網路錯誤時先保留）
  useEffect(() => {
    const stored = loadEditPassword()
    if (!stored) return
    api.verifyPassword(stored).catch((e) => {
      if (isPasswordError(e)) lock('編輯密碼已變更，請重新解鎖。')
    })
  }, [api, lock])

  const navigate = (next: View[]) => {
    setError(null)
    setStack(next)
    window.scrollTo({ top: 0 })
  }
  /** 切換到某一頁（清掉返回紀錄） */
  const go = (next: View) => navigate([next])
  /** 點進下一層 */
  const push = (next: View) => navigate([...stack, next])
  /** 回上一頁 */
  const pop = () => {
    if (stack.length > 1) navigate(stack.slice(0, -1))
    else {
      const fallback = fallbackBack(view)
      if (fallback) go(fallback)
    }
  }

  /** 執行寫入，完成後重新載入。密碼失效時回到唯讀 */
  const runWrite = async (action: (password: string) => Promise<void>): Promise<boolean> => {
    if (!password || busy) return false
    setBusy(true)
    setError(null)
    try {
      await action(password)
      return true
    } catch (e) {
      if (isPasswordError(e)) {
        lock('編輯密碼已變更，請重新解鎖。')
        go({ name: 'unlock' })
      } else {
        setError(toApiError(e).message)
        window.scrollTo({ top: 0 })
      }
      return false
    } finally {
      await refresh()
      setBusy(false)
    }
  }

  const handleUnlock = async (input: string): Promise<string | null> => {
    try {
      await api.verifyPassword(input)
    } catch (e) {
      return toApiError(e).message
    }
    saveEditPassword(input)
    setPassword(input)
    setUnlockNotice(null)
    go({ name: 'new' })
    return null
  }

  const handleCreate = async (input: GameRecordInput) => {
    let id = ''
    if (await runWrite(async (pw) => void (id = await api.saveRecord(pw, null, input)))) {
      // 存檔後看明細，返回到歷史紀錄
      navigate([{ name: 'history' }, { name: 'detail', id }])
    }
  }

  const handleUpdate = async (id: string, input: GameRecordInput) => {
    if (await runWrite((pw) => api.saveRecord(pw, id, input).then(() => undefined))) pop()
  }

  const handleDelete = async (id: string) => {
    // 刪除後回到上一頁（歷史紀錄或牌咖頁）；直接打開明細時回歷史紀錄
    if (await runWrite((pw) => api.deleteRecord(pw, id))) {
      if (stack.length > 1) pop()
      else go({ name: 'history' })
    }
  }

  // 唯讀時進到需要解鎖的頁面，改顯示解鎖畫面
  const shown: View = !canEdit && EDIT_ONLY.has(view.name) ? { name: 'unlock' } : view
  const current =
    shown.name === 'detail' || shown.name === 'edit'
      ? records.find((r) => r.id === shown.id)
      : undefined

  const back = shown === view && (stack.length > 1 || fallbackBack(view)) ? pop : undefined

  let content
  if (status === 'loading') {
    content = <Centered>載入中…</Centered>
  } else if (status === 'error') {
    content = (
      <Centered>
        <p>無法載入紀錄，請檢查網路。</p>
        <button
          type="button"
          onClick={() => {
            setStatus('loading')
            void refresh()
          }}
          className="mt-4 h-12 rounded-xl border border-slate-700 px-6 text-slate-200 active:bg-slate-800"
        >
          重試
        </button>
      </Centered>
    )
  } else {
    switch (shown.name) {
      case 'unlock':
        content = <UnlockPage notice={unlockNotice} onUnlock={handleUnlock} />
        break
      case 'new':
        content = (
          <RecordForm
            knownPlayers={knownPlayers}
            venues={venues}
            submitLabel="存檔"
            busy={busy}
            onSubmit={handleCreate}
          />
        )
        break
      case 'overview':
        content = (
          <OverviewPage
            records={records}
            players={knownPlayers}
            venues={venues}
            onOpenPlayer={(player) => push({ name: 'player', player })}
          />
        )
        break
      case 'player':
        content = (
          <PlayerPage
            key={shown.player}
            records={records}
            name={shown.player}
            onOpenRecord={(id) => push({ name: 'detail', id })}
            onOpenPlayer={(player) => push({ name: 'player', player })}
          />
        )
        break
      case 'history':
        content = (
          <HistoryPage
            records={records}
            canEdit={canEdit}
            onOpen={(id) => push({ name: 'detail', id })}
            onCreate={() => go({ name: 'new' })}
          />
        )
        break
      case 'roster':
        content = (
          <RosterPage
            onOpenPlayer={(player) => push({ name: 'player', player })}
            players={knownPlayers}
            venues={venues}
            canEdit={canEdit}
            busy={busy}
            onAdd={(kind, name) =>
              runWrite((pw) =>
                kind === 'players' ? api.addPlayer(pw, name) : api.addVenue(pw, name),
              )
            }
            onForget={(kind, name) =>
              void runWrite((pw) =>
                kind === 'players' ? api.forgetPlayer(pw, name) : api.forgetVenue(pw, name),
              )
            }
            onRenamePlayer={(oldName, newName) =>
              runWrite((pw) => api.renamePlayer(pw, oldName, newName))
            }
          />
        )
        break
      case 'detail':
        content = current ? (
          <DetailPage
            record={current}
            canEdit={canEdit}
            busy={busy}
            onEdit={() => push({ name: 'edit', id: current.id })}
            onDelete={() => void handleDelete(current.id)}
          />
        ) : (
          <Centered>找不到這筆紀錄</Centered>
        )
        break
      case 'edit':
        content = current ? (
          <RecordForm
            key={current.id}
            initial={current}
            knownPlayers={knownPlayers}
            venues={venues}
            submitLabel="儲存修改"
            busy={busy}
            onSubmit={(input) => void handleUpdate(current.id, input)}
            onCancel={pop}
          />
        ) : (
          <Centered>找不到這筆紀錄</Centered>
        )
        break
    }
  }

  const tab = shown.name === 'unlock' ? 'unlock' : activeTab(stack[0])
  const tabs = canEdit ? EDIT_TABS : READ_ONLY_TABS

  return (
    <div
      className="min-h-dvh bg-slate-950 text-slate-100"
      style={{ '--nav-h': '4rem' } as CSSProperties}
    >
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          {back && (
            <button
              type="button"
              onClick={back}
              aria-label="返回"
              className="-ml-2 flex size-10 items-center justify-center rounded-lg text-2xl text-slate-300 active:bg-slate-800"
            >
              ‹
            </button>
          )}
          <h1 className="truncate text-lg font-semibold">
            {shown.name === 'player' ? shown.player : TITLES[shown.name]}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {shown.name === 'history' && records.length > 0 && (
              <span className="text-sm text-slate-500">{records.length} 筆</span>
            )}
            <ThemePicker />
            {!canEdit && shown.name !== 'unlock' && (
              <button
                type="button"
                onClick={() => go({ name: 'unlock' })}
                className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400 active:bg-slate-800"
              >
                唯讀
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setConfirmingLock(true)}
                className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200 active:bg-cyan-400/20"
              >
                已解鎖
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4 pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+1.5rem)]">
        {unlockNotice && !canEdit && shown.name !== 'unlock' && (
          <button
            type="button"
            role="status"
            onClick={() => go({ name: 'unlock' })}
            className="mb-4 block w-full rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm text-amber-200"
          >
            {unlockNotice}（點這裡解鎖）
          </button>
        )}
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300"
          >
            {error}
          </p>
        )}
        {content}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950 pb-[env(safe-area-inset-bottom,0px)]">
        <div
          className="mx-auto grid h-[var(--nav-h)] max-w-xl"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => (
            <button
              key={t.tab}
              type="button"
              onClick={() => go({ name: t.tab } as View)}
              aria-current={tab === t.tab ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs ${
                tab === t.tab ? 'text-cyan-300' : 'text-slate-500'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="size-6 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
              >
                <path d={ICON_PATHS[t.tab]} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <ConfirmDialog
        open={confirmingLock}
        title="鎖定這台裝置？"
        message="鎖定後回到唯讀，要再編輯需重新輸入密碼。"
        confirmLabel="鎖定"
        onCancel={() => setConfirmingLock(false)}
        onConfirm={() => {
          setConfirmingLock(false)
          lock()
          go({ name: 'overview' })
        }}
      />
    </div>
  )
}
