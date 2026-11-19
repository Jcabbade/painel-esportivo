import { beforeEach, describe, expect, it } from 'vitest'
import { _resetStandingsCache, loadStandings, parseStandingsTable } from './standings'
import { fixture } from './testFixtures'

describe('standings', () => {
  beforeEach(() => _resetStandingsCache())

  it('soccer table', () => {
    const [g, ...rest] = parseStandingsTable('soccer', fixture('standings_PL.json'))
    expect(rest).toEqual([])
    expect(g.rows).toHaveLength(20)
    expect(g.rows.map(r => r.rank)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    const ars = g.rows[0]
    expect(ars.name).toBe('Arsenal')
    expect(ars.cells.points).toBe('27')
    expect(ars.cells.pointDifferential).toBe('+10')
    expect(ars.zone).toEqual({ color: '#81D6AC', label: 'Champions League' })
    expect(g.rows.some(r => r.zone === null)).toBe(true)
  })

  it('ucl league phase', () => {
    const groups = parseStandingsTable('soccer', fixture('standings_UCL.json'))
    expect(groups.map(g => g.name)).toEqual(['League Phase'])
    expect(groups[0].rows).toHaveLength(36)
  })

  it('nba conferences', () => {
    const groups = parseStandingsTable('basketball', fixture('standings_NBA.json'))
    expect(groups.map(g => g.name)).toEqual(['Eastern Conference', 'Western Conference'])
    for (const g of groups) {
      expect(g.rows).toHaveLength(15)
      expect(g.rows.map(r => r.rank)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
      expect(g.rows[0].cells.playoffSeed).toBe('1')
    }
  })

  it('nfl divisions', () => {
    const groups = parseStandingsTable('football', fixture('standings_NFL_div.json'))
    expect(groups).toHaveLength(8)
    expect(groups[0].name).toBe('AFC East')
    for (const g of groups) expect(g.rows).toHaveLength(4)
  })

  it('loadStandings caches 10 min', async () => {
    let calls = 0
    const f = async () => { calls++; return fixture('standings_PL.json') }
    const t0 = new Date('2026-11-19T12:00:00Z')
    await loadStandings('PL', 'conference', { fetch: f, now: t0 })
    await loadStandings('PL', 'conference', { fetch: f, now: new Date('2026-11-19T12:05:00Z') })
    expect(calls).toBe(1)
    await loadStandings('PL', 'conference', { fetch: f, now: new Date('2026-11-19T12:11:00Z') })
    expect(calls).toBe(2)
  })

  it('loadStandings division uses level=3', async () => {
    const urls: string[] = []
    const f = async (u: string) => { urls.push(u); return fixture('standings_NFL_div.json') }
    const groups = await loadStandings('NFL', 'division', { fetch: f })
    expect(urls[0]).toBe('https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3')
    expect(groups).toHaveLength(8)
  })
})
