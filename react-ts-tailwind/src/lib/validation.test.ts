import { describe, expect, it } from 'vitest'
import { parseInteger, validateDraft, type PlayerDraft, type RecordDraft } from './validation'

const row = (id: string, name: string, score: string, rounds = '1'): PlayerDraft => ({
  id,
  name,
  score,
  rounds,
})

const draft = (players: PlayerDraft[], houseFee = '', houseFeeInTotal = false): RecordDraft => ({
  date: '2026-10-01',
  venue: '',
  players,
  houseFee,
  houseFeeInTotal,
})

const valid = () => [
  row('1', 'A', '1200'),
  row('2', 'B', '-400'),
  row('3', 'C', '-300'),
  row('4', 'D', '-500'),
]

describe('parseInteger', () => {
  it('整數', () => expect(parseInteger(' -12 ')).toBe(-12))
  it('-0 當作 0', () => expect(Object.is(parseInteger('-0'), 0)).toBe(true))
  it('只有負號不算', () => expect(parseInteger('-')).toBeNull())
  it('小數不算', () => expect(parseInteger('1.5')).toBeNull())
})

describe('validateDraft', () => {
  it('合法紀錄回傳 input', () => {
    const v = validateDraft(draft(valid(), '200'))
    expect(v.messages).toEqual([])
    expect(v.input?.houseFee).toBe(200)
    expect(v.input?.players[0]).toEqual({ id: '1', name: 'A', score: 1200, rounds: 1 })
  })

  it('可超過 4 人', () => {
    const v = validateDraft(draft([...valid(), row('5', 'E', '0', '2')]))
    expect(v.input?.players).toHaveLength(5)
  })

  it('少於 4 人不行', () => {
    const v = validateDraft(draft([row('1', 'A', '100'), row('2', 'B', '-100')]))
    expect(v.countError).toBeDefined()
    expect(v.input).toBeUndefined()
  })

  it('總和不為 0 不行，並回傳總和', () => {
    const players = valid()
    players[0].score = '1300'
    const v = validateDraft(draft(players))
    expect(v.total).toBe(100)
    expect(v.totalError).toContain('+100')
    expect(v.input).toBeUndefined()
  })

  it('東錢不計入總和', () => {
    const v = validateDraft(draft(valid(), '5000'))
    expect(v.total).toBe(0)
    expect(v.input).toBeDefined()
  })

  it('東錢計入加總：玩家金額 + 東錢 = 0 才能存', () => {
    const players = valid()
    players[0].score = '800' // 玩家合計 -400
    const ok = validateDraft(draft(players, '400', true))
    expect(ok.total).toBe(-400)
    expect(ok.balance).toBe(0)
    expect(ok.input?.houseFeeInTotal).toBe(true)

    const bad = validateDraft(draft(players, '300', true))
    expect(bad.balance).toBe(-100)
    expect(bad.totalError).toContain('玩家金額加東錢需為 0，目前 -100')
    expect(bad.input).toBeUndefined()
  })

  it('東錢計入加總但沒填東錢時，玩家合計需為 0', () => {
    expect(validateDraft(draft(valid(), '', true)).input).toBeDefined()
  })

  it('東錢不計入時，有東錢也只看玩家合計', () => {
    const players = valid()
    players[0].score = '800'
    expect(validateDraft(draft(players, '400', false)).totalError).toBeDefined()
  })

  it('分數還沒填完時不顯示總和錯誤', () => {
    const players = valid()
    players[3].score = ''
    const v = validateDraft(draft(players))
    expect(v.allScoresValid).toBe(false)
    expect(v.totalError).toBeUndefined()
    expect(v.playerErrors['4'].score).toBeDefined()
  })

  it('名字重複（忽略前後空白）', () => {
    const players = valid()
    players[1].name = ' A '
    const v = validateDraft(draft(players))
    expect(v.playerErrors['1'].name).toBe('名字重複')
    expect(v.playerErrors['2'].name).toBe('名字重複')
  })

  it('將數需為正整數', () => {
    const players = valid()
    players[0].rounds = '0'
    players[1].rounds = '-1'
    players[2].rounds = ''
    const v = validateDraft(draft(players))
    expect(v.playerErrors['1'].rounds).toBeDefined()
    expect(v.playerErrors['2'].rounds).toBeDefined()
    expect(v.playerErrors['3'].rounds).toBeDefined()
  })

  it('東錢不可為負', () => {
    expect(validateDraft(draft(valid(), '-1')).houseFeeError).toBeDefined()
  })

  it('場地去空白，空白為未指定', () => {
    expect(validateDraft({ ...draft(valid()), venue: '  阿明家 ' }).input?.venue).toBe('阿明家')
    expect(validateDraft({ ...draft(valid()), venue: '   ' }).input?.venue).toBeUndefined()
  })

  it('場地與名字長度上限 30 字', () => {
    expect(validateDraft({ ...draft(valid()), venue: 'x'.repeat(31) }).venueError).toBeDefined()
    const players = valid()
    players[0].name = 'x'.repeat(31)
    expect(validateDraft(draft(players)).playerErrors['1'].name).toContain('最多')
  })

  it('東錢空白為未填', () => {
    expect(validateDraft(draft(valid(), '')).input?.houseFee).toBeUndefined()
  })
})
