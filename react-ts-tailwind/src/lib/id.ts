/** 產生唯一 id。crypto.randomUUID 只在 https / localhost 可用，手機用區網 IP 開啟時要退回 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // 非安全環境會丟錯，往下退回
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
