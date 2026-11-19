import { describe, expect, it } from 'vitest'
import { fixture } from '../espn/testFixtures'
import type { Game, GameStatus, Sport } from '../types'
import { cornerBuckets, toPlayers } from './players'
import { toRecord } from './record'

/* eslint-disable @typescript-eslint/no-explicit-any */
function gameOf(payload: any, league: string, sport: Sport, status: GameStatus = 'final'): Game {
  const comp = payload.header.competitions[0]
  const side = (ha: string) => {
    const c = comp.competitors.find((x: any) => x.homeAway === ha)
    return { team_id: String(c.team.id), name: c.team.displayName, short_name: '', abbrev: '', logo: null, score: null, record: null, rank: null, favorite: false }
  }
  return { id: String(comp.id), league, sport, start_utc: '2026-11-08T14:00:00Z', status, status_detail: '', venue: null, home: side('home'), away: side('away') }
}

describe('corner buckets', () => {
  const full = fixture('sum_PL_401879244_full.json')

  it('corner buckets only when commentary matches wonCorners', () => {
    const cb = cornerBuckets(full, 'Brighton & Hove Albion', 'Brentford')!
    expect(cb.h).toHaveLength(10)
    expect(cb.h.reduce((a, b) => a + b, 0)).toBe(7)
    expect(cb.a.reduce((a, b) => a + b, 0)).toBe(3)
    expect(cb.h[0]).toBeGreaterThanOrEqual(1)   // 6' do Brighton
    expect(cb.a[1]).toBeGreaterThanOrEqual(1)   // 13' do Brentford
    const broken = structuredClone(full)
    broken.commentary = broken.commentary.slice(1)
    expect(cornerBuckets(broken, 'Brighton & Hove Albion', 'Brentford')).toBeNull()
  })

  it('record carries cb for soccer', () => {
    const r = toRecord(gameOf(full, 'PL', 'soccer'), full)!
    expect(r.record.cb?.h.reduce((a, b) => a + b, 0)).toBe(7)
  })

  it('second half and stoppage time buckets', () => {
    const mk = (period: number, secs: number, team: string) =>
      ({ play: { type: { type: 'corner-awarded' }, period: { number: period }, clock: { value: secs }, team: { displayName: team } } })
    const s = {
      boxscore: { teams: [
        { homeAway: 'home', team: { displayName: 'A' }, statistics: [{ name: 'wonCorners', displayValue: '3' }] },
        { homeAway: 'away', team: { displayName: 'B' }, statistics: [{ name: 'wonCorners', displayValue: '1' }] },
      ] },
      commentary: [mk(1, 47 * 60, 'A'), mk(2, 46 * 60, 'A'), mk(2, 93 * 60, 'A'), mk(1, 30, 'B')],
    }
    const cb = cornerBuckets(s, 'A', 'B')!
    expect(cb.h[4]).toBe(1)   // 45+2 do 1º tempo → 40–Int
    expect(cb.h[5]).toBe(1)   // 46' → 45–55
    expect(cb.h[9]).toBe(1)   // 90+3 → 85–Fim
    expect(cb.a[0]).toBe(1)
  })
})

describe('toPlayers', () => {
  it('players soccer', () => {
    const full = fixture('sum_PL_401879244_full.json')
    const g = gameOf(full, 'PL', 'soccer')
    const ps = toPlayers(g, full)
    expect(ps.length).toBeGreaterThanOrEqual(22)
    expect(ps.every(p => p.t === g.home.team_id || p.t === g.away.team_id)).toBe(true)
    expect(ps.find(p => p.n === 'Bart Verbruggen')).toMatchObject({ s: true })
    expect(typeof ps[0].st.foulsCommitted).toBe('number')
  })

  it('bench players without appearance are skipped', () => {
    const full = structuredClone(fixture('sum_PL_401879244_full.json'))
    const bench = full.rosters[0].roster.find((p: any) => !p.starter)
    bench.subbedIn = false
    bench.stats = bench.stats.map((s: any) => (s.name === 'appearances' ? { ...s, value: 0, displayValue: '0' } : s))
    const ps = toPlayers(gameOf(full, 'PL', 'soccer'), full)
    expect(ps.some(p => p.n === bench.athlete.displayName)).toBe(false)
  })

  it('players nba', () => {
    const nba = fixture('sum_NBA_401910002.json')
    const ps = toPlayers(gameOf(nba, 'NBA', 'basketball'), nba)
    expect(ps.some(p => p.n === 'Kyle Anderson')).toBe(false)
    expect(ps.find(p => p.n === 'OG Anunoby')?.st.PTS).toBe(16)
    expect(typeof ps.find(p => p.n === 'OG Anunoby')?.st['3PM']).toBe('number')
  })

  it('players nfl', () => {
    const nfl = fixture('sum_NFL_401873065.json')
    const ps = toPlayers(gameOf(nfl, 'NFL', 'football'), nfl)
    expect(ps.find(p => p.n === 'Justin Herbert')?.st.passYds).toBe(129)
  })
})
