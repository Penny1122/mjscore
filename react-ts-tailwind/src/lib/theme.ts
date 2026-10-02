/**
 * 底色主題，每台裝置各自記住。
 * 顏色定義在 index.css 的 html[data-theme='…']；深色是預設，不設 data-theme。
 * index.html 開頭有一段內嵌 script 用同一個 key 先套用，避免載入時閃一下深色；新增主題時兩邊都要加。
 */

export type ThemeId = 'dark' | 'sky' | 'lavender' | 'mint'

export type Theme = {
  id: ThemeId
  label: string
  /** 選單色塊：底色、卡片色 */
  swatch: [string, string]
  /** 手機瀏覽器網址列顏色 */
  themeColor: string
}

export const THEMES: Theme[] = [
  { id: 'dark', label: '深色', swatch: ['#020617', '#0f172a'], themeColor: '#0b1120' },
  { id: 'sky', label: '淺藍', swatch: ['#e8f2fb', '#ffffff'], themeColor: '#e8f2fb' },
  { id: 'lavender', label: '薰衣草', swatch: ['#e3c8ff', '#fbf7ff'], themeColor: '#e3c8ff' },
  { id: 'mint', label: '薄荷', swatch: ['#d0eaea', '#f7fcfc'], themeColor: '#d0eaea' },
]

const KEY = 'mjscore.theme'

function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function loadTheme(): ThemeId {
  try {
    const value = localStorage.getItem(KEY)
    return isThemeId(value) ? value : 'dark'
  } catch {
    return 'dark'
  }
}

export function saveTheme(id: ThemeId): void {
  try {
    if (id === 'dark') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, id)
  } catch {
    // 無法儲存時只在這次開啟期間有效
  }
}

/** 套用到頁面：html 的 data-theme 與網址列顏色 */
export function applyTheme(id: ThemeId): void {
  const root = document.documentElement
  if (id === 'dark') delete root.dataset.theme
  else root.dataset.theme = id
  const theme = THEMES.find((t) => t.id === id)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme?.themeColor ?? '')
}
