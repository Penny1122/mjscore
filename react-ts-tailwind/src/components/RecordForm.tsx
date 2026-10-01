import { useMemo, useState, type FormEvent } from 'react'
import type { GameRecord, GameRecordInput, KnownPlayer, Venue } from '../types'
import { createId } from '../lib/id'
import { amountColorClass, formatAmount, todayString } from '../lib/format'
import { rankPlayers } from '../lib/ranking'
import {
  MIN_PLAYERS,
  parseInteger,
  validateDraft,
  type PlayerDraft,
  type RecordDraft,
} from '../lib/validation'
import { RankedList } from './RankedList'

type RecordFormProps = {
  /** 編輯時帶入既有紀錄 */
  initial?: GameRecord
  knownPlayers: KnownPlayer[]
  /** 場地名單，最近用過的在前 */
  venues: Venue[]
  submitLabel: string
  /** 送出中，按鈕停用 */
  busy?: boolean
  onSubmit: (input: GameRecordInput) => void
  onCancel?: () => void
}

const emptyRow = (): PlayerDraft => ({ id: createId(), name: '', score: '', rounds: '' })

/** 新增時預設帶入最近一次用過的場地 */
function toDraft(record: GameRecord | undefined, venues: Venue[]): RecordDraft {
  if (!record) {
    return {
      date: todayString(),
      venue: venues.find((v) => v.lastUsedAt)?.name ?? '',
      players: Array.from({ length: MIN_PLAYERS }, emptyRow),
      houseFee: '',
      houseFeeInTotal: false,
    }
  }
  return {
    date: record.date,
    venue: record.venue ?? '',
    players: record.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: String(p.score),
      rounds: String(p.rounds),
    })),
    houseFee: record.houseFee === undefined ? '' : String(record.houseFee),
    houseFeeInTotal: record.houseFeeInTotal ?? false,
  }
}

/** 全形數字與減號轉半形，只留數字（allowMinus 時保留開頭的負號） */
function sanitizeNumber(value: string, allowMinus: boolean): string {
  const half = value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−ー]/g, '-')
  const negative = allowMinus && half.trimStart().startsWith('-')
  const digits = half.replace(/\D/g, '')
  return negative ? `-${digits}` : digits
}

function toggleSign(value: string): string {
  return value.startsWith('-') ? value.slice(1) : `-${value}`
}

const inputBase =
  'h-12 w-full rounded-xl border bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30'

function inputClass(hasError: boolean) {
  return `${inputBase} ${hasError ? 'border-rose-500' : 'border-slate-700'}`
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-rose-400">{message}</p>
}

export function RecordForm({
  initial,
  knownPlayers,
  venues,
  submitLabel,
  busy = false,
  onSubmit,
  onCancel,
}: RecordFormProps) {
  const [draft, setDraft] = useState<RecordDraft>(() => toDraft(initial, venues))
  const [attempted, setAttempted] = useState(false)
  const [focusedNameId, setFocusedNameId] = useState<string | null>(null)

  const validation = useMemo(() => validateDraft(draft), [draft])

  const preview = useMemo(
    () =>
      rankPlayers(
        draft.players.flatMap((p, index) => {
          const score = parseInteger(p.score)
          if (score === null) return []
          const rounds = Number(p.rounds)
          return [
            {
              id: p.id,
              name: p.name.trim() || `玩家 ${index + 1}`,
              score,
              rounds: Number.isInteger(rounds) && rounds > 0 ? rounds : 0,
            },
          ]
        }),
      ),
    [draft.players],
  )

  /** 送出過、或欄位已經有內容時才顯示錯誤，避免一打開就整片紅 */
  const visible = (message: string | undefined, value: string) =>
    attempted || value.trim() !== '' ? message : undefined

  const updatePlayer = (id: string, patch: Partial<PlayerDraft>) =>
    setDraft((d) => ({
      ...d,
      players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))

  const addPlayer = () => setDraft((d) => ({ ...d, players: [...d.players, emptyRow()] }))

  const removePlayer = (id: string) =>
    setDraft((d) =>
      d.players.length <= MIN_PLAYERS
        ? d
        : { ...d, players: d.players.filter((p) => p.id !== id) },
    )

  const suggestionsFor = (row: PlayerDraft) => {
    const usedElsewhere = new Set(
      draft.players.filter((p) => p.id !== row.id).map((p) => p.name.trim()),
    )
    const query = row.name.trim().toLowerCase()
    return knownPlayers
      .filter((k) => !usedElsewhere.has(k.name))
      .filter((k) => k.name !== row.name.trim())
      .filter((k) => !query || k.name.toLowerCase().includes(query))
      .slice(0, 12)
  }

  const pickName = (row: PlayerDraft, name: string) => {
    updatePlayer(row.id, { name })
    setFocusedNameId(null)
    document.getElementById(`score-${row.id}`)?.focus()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setAttempted(true)
    if (validation.input) onSubmit(validation.input)
  }

  const balanced = validation.allScoresValid && validation.balance === 0
  const feeAmount = /^\d+$/.test(draft.houseFee) ? Number(draft.houseFee) : 0
  const totalLabel = draft.houseFeeInTotal
    ? `玩家 ${formatAmount(validation.total)} ＋ 東錢 ${feeAmount}`
    : '分數總和'
  const canSave = validation.input !== undefined

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="record-date" className="mb-1.5 block text-sm text-slate-400">
          日期
        </label>
        <input
          id="record-date"
          type="date"
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          className={inputClass(Boolean(attempted && validation.dateError))}
        />
        <FieldError message={attempted ? validation.dateError : undefined} />
      </div>

      <div>
        <label htmlFor="record-venue" className="mb-1.5 block text-sm text-slate-400">
          場地 <span className="text-slate-600">（選填）</span>
        </label>
        <div className="relative">
          <input
            id="record-venue"
            placeholder="點選下方場地，或輸入新場地"
            value={draft.venue}
            autoComplete="off"
            enterKeyHint="next"
            onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))}
            className={`${inputClass(Boolean(visible(validation.venueError, draft.venue)))} pr-12`}
          />
          {draft.venue && (
            <button
              type="button"
              aria-label="清除場地"
              onClick={() => setDraft((d) => ({ ...d, venue: '' }))}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-slate-500"
            >
              ×
            </button>
          )}
        </div>
        <FieldError message={visible(validation.venueError, draft.venue)} />
        {venues.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" aria-label="場地名單">
            {venues.slice(0, 12).map((v) => {
              const selected = draft.venue.trim() === v.name
              return (
                <button
                  key={v.name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDraft((d) => ({ ...d, venue: selected ? '' : v.name }))}
                  className={`h-9 rounded-full border px-3.5 text-sm ${
                    selected
                      ? 'border-cyan-300 bg-cyan-400 font-medium text-slate-950'
                      : 'border-slate-700 text-slate-300 active:bg-slate-800'
                  }`}
                >
                  {v.name}
                </button>
              )
            })}
          </div>
        )}
        {draft.venue.trim() && !venues.some((v) => v.name === draft.venue.trim()) && (
          <p className="mt-1.5 text-xs text-slate-500">新場地，存檔後會加入場地名單</p>
        )}
      </div>

      <section aria-labelledby="players-heading">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="players-heading" className="text-sm text-slate-400">
            玩家（{draft.players.length} 人）
          </h2>
          <span className="text-xs text-slate-500">至少 {MIN_PLAYERS} 人</span>
        </div>

        <ul className="space-y-3">
          {draft.players.map((row, index) => {
            const errors = validation.playerErrors[row.id] ?? {}
            const nameError = visible(errors.name, row.name)
            const scoreError = visible(errors.score, row.score)
            const roundsError = visible(errors.rounds, row.rounds)
            const suggestions = focusedNameId === row.id ? suggestionsFor(row) : []
            const score = parseInteger(row.score)

            return (
              <li
                key={row.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-3"
                data-testid="player-row"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label={`第 ${index + 1} 位玩家名字`}
                      placeholder={`玩家 ${index + 1} 名字`}
                      value={row.name}
                      autoComplete="off"
                      enterKeyHint="next"
                      onChange={(e) => updatePlayer(row.id, { name: e.target.value })}
                      onFocus={() => setFocusedNameId(row.id)}
                      onBlur={() => setFocusedNameId((id) => (id === row.id ? null : id))}
                      className={inputClass(Boolean(nameError))}
                    />
                    <FieldError message={nameError} />
                  </div>
                  <button
                    type="button"
                    aria-label={`移除第 ${index + 1} 位玩家`}
                    disabled={draft.players.length <= MIN_PLAYERS}
                    onClick={() => removePlayer(row.id)}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-500 active:bg-slate-800 disabled:opacity-25"
                  >
                    ×
                  </button>
                </div>

                {suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2" aria-label="牌咖名單">
                    {suggestions.map((k) => (
                      <button
                        key={k.name}
                        type="button"
                        // 防止按下時名字欄位先失焦把清單收起來
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => pickName(row, k.name)}
                        className="h-9 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3.5 text-sm text-cyan-100 active:bg-cyan-500/25"
                      >
                        {k.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-start gap-2">
                  <button
                    type="button"
                    aria-label="切換正負號"
                    onClick={() => updatePlayer(row.id, { score: toggleSign(row.score) })}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold active:bg-slate-800 ${
                      row.score.startsWith('-')
                        ? 'border-rose-500/50 text-rose-400'
                        : 'border-slate-700 text-slate-300'
                    }`}
                  >
                    ±
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="relative">
                      <input
                        id={`score-${row.id}`}
                        aria-label={`第 ${index + 1} 位玩家金額`}
                        placeholder="金額"
                        inputMode="numeric"
                        autoComplete="off"
                        value={row.score}
                        onChange={(e) =>
                          updatePlayer(row.id, { score: sanitizeNumber(e.target.value, true) })
                        }
                        className={`${inputClass(Boolean(scoreError))} pr-9 text-right text-lg font-semibold tabular-nums placeholder:text-base placeholder:font-normal ${
                          score === null ? '' : amountColorClass(score)
                        }`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
                        元
                      </span>
                    </div>
                    <FieldError message={scoreError} />
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="relative">
                      <input
                        aria-label={`第 ${index + 1} 位玩家打幾將`}
                        placeholder="將數"
                        inputMode="numeric"
                        autoComplete="off"
                        value={row.rounds}
                        onChange={(e) =>
                          updatePlayer(row.id, { rounds: sanitizeNumber(e.target.value, false) })
                        }
                        className={`${inputClass(Boolean(roundsError))} pr-8 text-right tabular-nums`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
                        將
                      </span>
                    </div>
                    <FieldError message={roundsError} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={addPlayer}
          className="mt-3 h-12 w-full rounded-2xl border border-dashed border-slate-700 text-slate-300 active:bg-slate-900"
        >
          ＋ 新增玩家
        </button>
      </section>

      <div>
        <label htmlFor="house-fee" className="mb-1.5 block text-sm text-slate-400">
          東錢 <span className="text-slate-600">（選填，不計入勝負）</span>
        </label>
        <div className="relative">
          <input
            id="house-fee"
            placeholder="0"
            inputMode="numeric"
            autoComplete="off"
            value={draft.houseFee}
            onChange={(e) =>
              setDraft((d) => ({ ...d, houseFee: sanitizeNumber(e.target.value, false) }))
            }
            className={`${inputClass(Boolean(visible(validation.houseFeeError, draft.houseFee)))} pr-9 text-right tabular-nums`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
            元
          </span>
        </div>
        <FieldError message={visible(validation.houseFeeError, draft.houseFee)} />

        <button
          type="button"
          role="switch"
          aria-checked={draft.houseFeeInTotal}
          aria-label="東錢計入加總"
          onClick={() => setDraft((d) => ({ ...d, houseFeeInTotal: !d.houseFeeInTotal }))}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left"
        >
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              draft.houseFeeInTotal ? 'bg-cyan-400' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 size-5 rounded-full bg-white transition-all ${
                draft.houseFeeInTotal ? 'left-6' : 'left-1'
              }`}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-slate-200">東錢計入加總</span>
            <span className="block text-xs text-slate-500">
              {draft.houseFeeInTotal ? '玩家金額 ＋ 東錢 ＝ 0' : '只看玩家金額加總 ＝ 0'}
            </span>
          </span>
        </button>
      </div>

      {preview.length > 0 && (
        <section
          aria-labelledby="preview-heading"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <h2 id="preview-heading" className="mb-1 text-sm text-slate-400">
            排名預覽
          </h2>
          <RankedList players={preview} />
        </section>
      )}

      {attempted && validation.messages.length > 0 && (
        <ul
          role="alert"
          className="space-y-1 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300"
        >
          {validation.messages.map((m) => (
            <li key={m}>・{m}</li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px))] -mx-4 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-sm" data-testid="total">
          <span className="min-w-0 truncate text-slate-400">{totalLabel}</span>
          {!validation.allScoresValid ? (
            <span className="shrink-0 text-slate-500">尚未填完</span>
          ) : balanced ? (
            <span className="shrink-0 font-semibold text-emerald-400">＝ 0 ✓ 平衡</span>
          ) : (
            <span className="shrink-0 font-semibold text-amber-400">
              ＝ {formatAmount(validation.balance)}，需為 0
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-12 flex-1 rounded-xl border border-slate-700 font-medium text-slate-200 active:bg-slate-800"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className={`h-12 flex-[2] rounded-xl font-semibold transition disabled:opacity-60 ${
              canSave
                ? 'bg-cyan-400 text-slate-950 active:bg-cyan-300'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {busy ? '儲存中…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
