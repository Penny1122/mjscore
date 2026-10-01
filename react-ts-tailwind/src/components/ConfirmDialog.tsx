type ConfirmDialogProps = {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-slate-100">
          {title}
        </h2>
        {message && <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-xl border border-slate-700 font-medium text-slate-200 active:bg-slate-800"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="h-12 rounded-xl bg-rose-600 font-semibold text-white active:bg-rose-700"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
