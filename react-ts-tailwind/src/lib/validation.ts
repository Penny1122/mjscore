import type { GameRecordInput, PlayerResult } from '../types'

export const MIN_PLAYERS = 4
/** 牌咖、場地名字的長度上限，與資料庫一致 */
export const NAME_MAX = 30

/** 表單中的玩家列，欄位都是字串以便輸入中途的狀態（例如只打了「-」） */
export type PlayerDraft = {
  id: string
  name: string
  score: string
  rounds: string
}

export type RecordDraft = {
  date: string
  /** 場地，空字串代表不指定 */
  venue: string
  players: PlayerDraft[]
  houseFee: string
  /** 東錢是否算進加總 */
  houseFeeInTotal: boolean
}

export type PlayerFieldErrors = {
  name?: string
  score?: string
  rounds?: string
}

export type DraftValidation = {
  /** 每位玩家的欄位錯誤，key 為玩家列 id */
  playerErrors: Record<string, PlayerFieldErrors>
  dateError?: string
  venueError?: string
  houseFeeError?: string
  countError?: string
  /** 已填且格式正確的玩家金額加總 */
  total: number
  /** 要等於 0 的數字：玩家金額加總，東錢計入加總時再加上東錢 */
  balance: number
  /** 所有分數都填好且正確時才為 true，總和檢查只在這時有意義 */
  allScoresValid: boolean
  totalError?: string
  /** 所有錯誤訊息，依畫面順序 */
  messages: string[]
  /** 驗證通過時的送出內容 */
  input?: GameRecordInput
}

const INTEGER = /^-?\d+$/
const POSITIVE_INTEGER = /^\d+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** 解析整數字串，格式不對回傳 null */
export function parseInteger(value: string): number | null {
  const v = value.trim()
  if (!INTEGER.test(v)) return null
  const n = Number(v)
  return Number.isSafeInteger(n) ? (n === 0 ? 0 : n) : null
}

export function validateDraft(draft: RecordDraft): DraftValidation {
  const playerErrors: Record<string, PlayerFieldErrors> = {}
  const messages: string[] = []
  const players: PlayerResult[] = []
  let total = 0
  let allScoresValid = true

  const dateError = DATE.test(draft.date) ? undefined : '請選擇日期'
  if (dateError) messages.push(dateError)

  const venue = draft.venue.trim()
  const venueError = venue.length > NAME_MAX ? `場地名稱最多 ${NAME_MAX} 個字` : undefined
  if (venueError) messages.push(venueError)

  const countError =
    draft.players.length < MIN_PLAYERS ? `至少要 ${MIN_PLAYERS} 位玩家` : undefined
  if (countError) messages.push(countError)

  const nameCount = new Map<string, number>()
  for (const p of draft.players) {
    const name = p.name.trim()
    if (name) nameCount.set(name, (nameCount.get(name) ?? 0) + 1)
  }

  draft.players.forEach((p, index) => {
    const label = p.name.trim() || `第 ${index + 1} 位玩家`
    const errors: PlayerFieldErrors = {}
    const name = p.name.trim()

    if (!name) errors.name = '請輸入名字'
    else if (name.length > NAME_MAX) errors.name = `名字最多 ${NAME_MAX} 個字`
    else if ((nameCount.get(name) ?? 0) > 1) errors.name = '名字重複'

    const score = parseInteger(p.score)
    if (!p.score.trim()) errors.score = '請輸入金額'
    else if (score === null) errors.score = '金額需為整數'

    const rounds = p.rounds.trim()
    if (!rounds) errors.rounds = '請輸入將數'
    else if (!POSITIVE_INTEGER.test(rounds) || Number(rounds) < 1) errors.rounds = '將數需為正整數'

    if (score === null) allScoresValid = false
    else total += score

    if (errors.name) messages.push(`${label}：${errors.name}`)
    if (errors.score) messages.push(`${label}：${errors.score}`)
    if (errors.rounds) messages.push(`${label}：${errors.rounds}`)
    if (errors.name || errors.score || errors.rounds) playerErrors[p.id] = errors

    if (score !== null) players.push({ id: p.id, name, score, rounds: Number(rounds) })
  })

  let houseFee: number | undefined
  let houseFeeError: string | undefined
  if (draft.houseFee.trim()) {
    const fee = draft.houseFee.trim()
    if (POSITIVE_INTEGER.test(fee)) houseFee = Number(fee)
    else houseFeeError = '東錢需為 0 以上的整數'
  }
  if (houseFeeError) messages.push(houseFeeError)

  const feeInTotal = draft.houseFeeInTotal ? (houseFee ?? 0) : 0
  const balance = total + feeInTotal
  const totalError =
    allScoresValid && !houseFeeError && draft.players.length > 0 && balance !== 0
      ? `${draft.houseFeeInTotal ? '玩家金額加東錢' : '分數總和'}需為 0，目前 ${balance > 0 ? '+' : ''}${balance}`
      : undefined
  if (totalError) messages.push(totalError)

  const result: DraftValidation = {
    playerErrors,
    dateError,
    venueError,
    houseFeeError,
    countError,
    total,
    balance,
    allScoresValid,
    totalError,
    messages,
  }
  if (messages.length === 0) {
    result.input = {
      date: draft.date,
      venue: venue || undefined,
      players,
      houseFee,
      houseFeeInTotal: draft.houseFeeInTotal,
    }
  }
  return result
}
