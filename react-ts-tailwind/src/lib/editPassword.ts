/**
 * 記住這台裝置的編輯密碼，下次打開不用再輸入。
 * 這只是方便，不是安全機制：真正的權限檢查在資料庫函式裡。
 */

const KEY = 'mjscore.editPassword'

export function loadEditPassword(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveEditPassword(password: string): void {
  try {
    localStorage.setItem(KEY, password)
  } catch {
    // 無法儲存時只在這次開啟期間有效
  }
}

export function clearEditPassword(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 同上
  }
}
