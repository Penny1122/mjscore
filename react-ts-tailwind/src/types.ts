export type PlayerResult = {
  id: string
  name: string
  /** 最終金額（元），所有玩家加總必須為 0 */
  score: number
  /** 打幾將 */
  rounds: number
}

export type GameRecord = {
  id: string
  /** YYYY-MM-DD */
  date: string
  players: PlayerResult[]
  /** 在哪裡打，未指定為 undefined */
  venue?: string
  /** 東錢（元），整筆一個數字，不計入勝負 */
  houseFee?: number
  /** 東錢是否算進「加總為 0」：true 時玩家金額 + 東錢 = 0。舊資料沒有此欄位視為 false */
  houseFeeInTotal?: boolean
  createdAt: string
  updatedAt: string
}

/** 新增或編輯時送出的內容 */
export type GameRecordInput = Pick<
  GameRecord,
  'date' | 'venue' | 'players' | 'houseFee' | 'houseFeeInTotal'
>

export type RankedPlayerResult = PlayerResult & {
  rank: number
  isTied: boolean
}

/** 牌咖名單 */
export type KnownPlayer = {
  name: string
  /** 最近一次出現在紀錄中的時間；手動新增、還沒上過桌為 null */
  lastPlayedAt: string | null
}

/** 場地名單 */
export type Venue = {
  name: string
  /** 最近一次被紀錄使用的時間；還沒用過為 null */
  lastUsedAt: string | null
}
