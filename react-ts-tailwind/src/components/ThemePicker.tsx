import { useState } from 'react'
import { createPortal } from 'react-dom'
import { THEMES, applyTheme, loadTheme, saveTheme, type ThemeId } from '../lib/theme'

/** 頁首的底色按鈕，點了從下方開出選單，選了立刻套用並記在這台裝置 */
export function ThemePicker() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<ThemeId>(loadTheme)

  const choose = (id: ThemeId) => {
    setCurrent(id)
    saveTheme(id)
    applyTheme(id)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-label="選擇底色"
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-full text-slate-400 active:bg-slate-800"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
        >
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.3-4-7.7-9-7.7Z" />
          <circle cx="7.5" cy="11.5" r="1" />
          <circle cx="10.5" cy="7.5" r="1" />
          <circle cx="15.5" cy="8.5" r="1" />
        </svg>
      </button>

      {/* 掛到 body：頁首有 backdrop-blur，fixed 定位會被限制在頁首範圍內 */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="theme-title"
              className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="theme-title" className="text-lg font-semibold text-slate-100">
                選擇底色
              </h2>
              <p className="mt-1 text-sm text-slate-500">只會改這台裝置，不影響其他人。</p>
              <div role="radiogroup" aria-label="底色" className="mt-4 grid grid-cols-2 gap-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={current === t.id}
                    onClick={() => choose(t.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-2 text-sm ${
                      current === t.id
                        ? 'border-cyan-400 text-slate-100 ring-2 ring-cyan-400/30'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-full items-end justify-center rounded-lg border border-black/10 p-1.5"
                      style={{ background: t.swatch[0] }}
                    >
                      <span className="h-4 w-full rounded" style={{ background: t.swatch[1] }} />
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 h-12 w-full rounded-xl border border-slate-700 font-medium text-slate-200 active:bg-slate-800"
              >
                關閉
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
