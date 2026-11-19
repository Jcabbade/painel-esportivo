import { describe, expect, it } from 'vitest'
import { statusText } from './status'

const g = (status: string, detail: string, sport = 'basketball') =>
  ({ status, status_detail: detail, sport, start_utc: '2026-11-20T01:00:00Z' }) as never

describe('statusText', () => {
  it('scheduled shows local time', () => expect(statusText(g('scheduled', '11/19 - 8:00 PM EST'))).toBe('22:00'))
  it('final', () => expect(statusText(g('final', 'Final'))).toBe('Encerrado'))
  it('postponed', () => expect(statusText(g('postponed', 'Postponed'))).toBe('Adiado'))
  it('canceled', () => expect(statusText(g('canceled', 'Canceled'))).toBe('Cancelado'))
  it('halftime', () => {
    expect(statusText(g('live', 'Halftime'))).toBe('Intervalo')
    expect(statusText(g('live', 'HT', 'soccer'))).toBe('Intervalo')
  })
  it('quarters', () => {
    expect(statusText(g('live', '4:12 - 3rd'))).toBe('3º Q · 4:12')
    expect(statusText(g('live', 'End of 1st'))).toBe('Fim do 1º Q')
  })
  it('soccer minute passes through', () => expect(statusText(g('live', "67'", 'soccer'))).toBe("67'"))
})
