import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { league } from './leagues'
import { parseScoreboard, parseStandings } from './parse'

export const FIX_DIR = resolve(__dirname, '../../../backend/tests/fixtures')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fixture = (name: string): any => JSON.parse(readFileSync(resolve(FIX_DIR, name), 'utf-8'))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withStatus(payload: any, state: string, name: string, short = '') {
  const p = structuredClone(payload)
  p.events = p.events.slice(0, 1)
  const t = p.events[0].status.type
  t.state = state
  t.name = name
  if (short) t.shortDetail = short
  return p
}

describe('parseScoreboard', () => {
  it('soccer final', () => {
    const games = parseScoreboard(league('PL'), fixture('sb_PL_20261108.json'))
    expect(games).toHaveLength(5)
    for (const g of games) {
      expect(g.status).toBe('final')
      expect(g.sport).toBe('soccer')
      expect(g.league).toBe('PL')
      expect(g.start_utc).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)
      expect(Number.isInteger(g.home.score)).toBe(true)
      expect(Number.isInteger(g.away.score)).toBe(true)
      expect(g.home.rank).toBeNull()
      expect(g.home.favorite).toBe(false)
    }
    expect(games.some(g => g.venue)).toBe(true)
  })

  it('nba records', () => {
    const games = parseScoreboard(league('NBA'), fixture('sb_NBA_20261117.json'))
    expect(games).toHaveLength(5)
    for (const g of games) expect(g.home.record).toMatch(/^\d+-\d+$/)
  })

  it('scheduled has no score', () => {
    const [g] = parseScoreboard(league('NFL'), withStatus(fixture('sb_NFL_20261116.json'), 'pre', 'STATUS_SCHEDULED'))
    expect(g.status).toBe('scheduled')
    expect(g.home.score).toBeNull()
    expect(g.away.score).toBeNull()
  })

  it('live uses shortDetail', () => {
    const [g] = parseScoreboard(league('PL'), withStatus(fixture('sb_PL_20261108.json'), 'in', 'STATUS_SECOND_HALF', "67'"))
    expect(g.status).toBe('live')
    expect(g.status_detail).toBe("67'")
    expect(Number.isInteger(g.home.score)).toBe(true)
  })

  it('postponed, suspended and canceled have no score', () => {
    const sb = fixture('sb_PL_20261108.json')
    for (const [name, status] of [['STATUS_POSTPONED', 'postponed'], ['STATUS_SUSPENDED', 'postponed'],
      ['STATUS_CANCELED', 'canceled']] as const) {
      const [g] = parseScoreboard(league('PL'), withStatus(sb, 'post', name))
      expect(g.status).toBe(status)
      expect(g.home.score).toBeNull()
    }
  })

  it('skips malformed event', () => {
    const p = withStatus(fixture('sb_PL_20261108.json'), 'post', 'STATUS_FINAL')
    p.events.unshift({ id: 'x', status: { type: { state: 'pre' } } })
    expect(parseScoreboard(league('PL'), p)).toHaveLength(1)
  })

  it('empty or missing events', () => {
    expect(parseScoreboard(league('PL'), {})).toEqual([])
    expect(parseScoreboard(league('PL'), null)).toEqual([])
  })
})

describe('parseStandings', () => {
  it('ranks 1..20', () => {
    const ranks = parseStandings(fixture('standings_PL.json'))
    expect(Object.keys(ranks)).toHaveLength(20)
    expect(Object.values(ranks).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })
  it('empty', () => expect(parseStandings({})).toEqual({}))
})
