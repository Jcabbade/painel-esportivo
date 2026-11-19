import { describe, expect, it } from 'vitest'
import { addDays, dayLabel, followToday, localToday } from './dates'

describe('dates', () => {
  it('localToday uses Sao Paulo', () => {
    expect(localToday(new Date('2026-11-20T02:30:00Z'))).toBe('2026-11-19')
    expect(localToday(new Date('2026-11-20T03:30:00Z'))).toBe('2026-11-20')
  })
  it('addDays crosses month and year', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
  it('dayLabel', () => {
    const today = '2026-11-19'
    expect(dayLabel('2026-11-19', today)).toEqual({ top: 'Hoje', bottom: '19/11' })
    expect(dayLabel('2026-11-20', today)).toEqual({ top: 'Amanhã', bottom: '20/11' })
    expect(dayLabel('2026-11-18', today)).toEqual({ top: 'Ontem', bottom: '18/11' })
    expect(dayLabel('2026-11-22', today)).toEqual({ top: 'Dom', bottom: '22/11' })
  })
})

describe('followToday', () => {
  it('moves selection along when it was on the old today', () => {
    expect(followToday('2026-11-19', '2026-11-20', '2026-11-19')).toBe('2026-11-20')
  })
  it('keeps a chosen day that is still in range', () => {
    expect(followToday('2026-11-19', '2026-11-20', '2026-11-22')).toBe('2026-11-22')
  })
  it('falls back to today when the chosen day left the bar range', () => {
    expect(followToday('2026-11-19', '2026-11-23', '2026-11-19')).toBe('2026-11-23')
    expect(followToday('2026-11-19', '2026-11-23', '2026-11-17')).toBe('2026-11-23')
  })
})
