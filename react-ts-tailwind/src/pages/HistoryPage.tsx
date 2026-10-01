import type { GameRecord } from '../types'
import { RecordCard } from '../components/RecordCard'

type HistoryPageProps = {
  records: GameRecord[]
  /** 唯讀時不顯示「新增第一筆」 */
  canEdit: boolean
  onOpen: (id: string) => void
  onCreate: () => void
}

export function HistoryPage({ records, canEdit, onOpen, onCreate }: HistoryPageProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-4xl">🀄</p>
        <p className="text-slate-400">還沒有任何紀錄</p>
        {canEdit && (
          <button
            type="button"
            onClick={onCreate}
            className="h-12 rounded-xl bg-cyan-400 px-6 font-semibold text-slate-950 active:bg-cyan-300"
          >
            新增第一筆
          </button>
        )}
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {records.map((r) => (
        <li key={r.id}>
          <RecordCard record={r} onOpen={() => onOpen(r.id)} />
        </li>
      ))}
    </ul>
  )
}
