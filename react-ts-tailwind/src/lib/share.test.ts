import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../types'
import { lineShareUrl, recordToText } from './share'

const base: GameRecord = {
  id: 'r1',
  date: '2026-10-17',
  venue: '小明家',
  houseFee: 200,
  houseFeeInTotal: false,
  players: [
    { id: 'a', name: '大雄', score: -1000, rounds: 8 },
    { id: 'b', name: '阿明', score: 1200, rounds: 8 },
    { id: 'c', name: '阿美', score: -500, rounds: 8 },
    { id: 'd', name: '小華', score: 300, rounds: 8 },
  ],
  createdAt: '2026-10-17T12:00:00Z',
  updatedAt: '2026-10-17T12:00:00Z',
}

describe('recordToText', () => {
  it('完整格式', () => {
    expect(recordToText(base)).toBe(
      [
        '🀄 2026/10/17（六）',
        '📍 小明家',
        '',
        '🥇 阿明　+1200（8 將）',
        '🥈 小華　+300（8 將）',
        '🥉 阿美　-500（8 將）',
        '4. 大雄　-1000（8 將）',
        '',
        '共 8 將',
      ].join('\n'),
    )
  })

  it('沒有場地與東錢', () => {
    const text = recordToText({
      ...base,
      venue: undefined,
      houseFee: undefined,
    })
    expect(text).not.toContain('📍')
    expect(text).not.toContain('東錢')
    expect(text.endsWith('共 8 將')).toBe(true)
  })

  it('同分標註', () => {
    const text = recordToText({
      ...base,
      players: [
        { id: 'a', name: '甲', score: 500, rounds: 4 },
        { id: 'b', name: '乙', score: 500, rounds: 4 },
        { id: 'c', name: '丙', score: -1000, rounds: 4 },
      ],
    })
    expect(text).toContain('🥇 甲　+500（4 將）同分')
    expect(text).toContain('🥇 乙　+500（4 將）同分')
    expect(text).toContain('🥉 丙　-1000（4 將）')
  })
})

describe('lineShareUrl', () => {
  it('文字經過編碼', () => {
    expect(lineShareUrl('a b\n🀄')).toBe('https://line.me/R/share?text=a%20b%0A%F0%9F%80%84')
  })
})
