import { describe, expect, it } from 'vitest'
import { formatAmount, formatDate, todayString } from './format'

describe('formatAmount', () => {
  it('正數加 +，不加千分位', () => expect(formatAmount(12000)).toBe('+12000'))
  it('負數', () => expect(formatAmount(-800)).toBe('-800'))
  it('零', () => expect(formatAmount(0)).toBe('0'))
})

describe('todayString', () => {
  it('補零', () => expect(todayString(new Date(2026, 0, 5))).toBe('2026-01-05'))
})

describe('formatDate', () => {
  it('含星期', () => expect(formatDate('2026-10-01')).toBe('2026/10/01（四）'))
})
