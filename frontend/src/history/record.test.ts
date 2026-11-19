import { describe, expect, it } from 'vitest'
import { fixture } from '../espn/testFixtures'
import type { Game, GameStatus, Sport } from '../types'
import { toRecord } from './record'

/* eslint-disable @typescript-eslint/no-explicit-any */
function gameOf(payload: any, league: string, sport: Sport, status: GameStatus = 'final'): Game {
  const comp = payload.header.competitions[0]
  const side = (ha: string) => {
    const c = comp.competitors.find((x: any) => x.homeAway === ha)
    return { team_id: String(c.team.id), name: '', short_name: '', abbrev: '', logo: null, score: null, record: null, rank: null, favorite: false }
  }
  return { id: String(comp.id), league, sport, start_utc: '2026-11-08T14:00:00Z', status, status_detail: '', venue: null, home: side('home'), away: side('away') }
}

const SOCCER_KEYS = ['wonCorners', 'yellowCards', 'redCards', 'totalShots', 'shotsOnTarget', 'foulsCommitted', 'offsides']

describe('toRecord', () => {
  it('soccer record', () => {
    const pl = fixture('sum_PL_401879244.json')
    const r = toRecord(gameOf(pl, 'PL', 'soccer'), pl)!
    expect(r.record).toMatchObject({ id: '401879244', season: 2026, hs: 2, as: 0, hp: [2, 0], ap: [0, 0] })
    expect(r.record.date).toBe('2026-11-08T14:00:00Z')
    expect(r.record.st.h.wonCorners).toBe(7)
    expect(r.record.st.a.wonCorners).toBe(3)
    expect(r.record.st.h.yellowCards).toBe(4)
    for (const k of Object.keys(r.record.st.h)) expect(SOCCER_KEYS).toContain(k)
    expect(r.teams[r.record.h]).toMatchObject({ name: 'Brighton & Hove Albion', abbrev: 'BHA' })
  })

  it('nba record', () => {
    const nba = fixture('sum_NBA_401910002.json')
    const r = toRecord(gameOf(nba, 'NBA', 'basketball'), nba)!
    expect(r.record.hp).toHaveLength(4)
    expect(r.record.hp.reduce((a, b) => a + b, 0)).toBe(r.record.hs)
    const knicks = nba.boxscore.teams.find((t: any) => String(t.team.id) === r.record.a)
    const raw = knicks.statistics.find((s: any) => s.name === 'threePointFieldGoalsMade-threePointFieldGoalsAttempted').displayValue
    expect(r.record.st.a.threePointFieldGoalsMade).toBe(Number(raw.split('-')[0]))
    expect(typeof r.record.st.h.totalRebounds).toBe('number')
    expect(r.record.season).toBe(2027)
  })

  it('nfl record', () => {
    const nfl = fixture('sum_NFL_401873065.json')
    const r = toRecord(gameOf(nfl, 'NFL', 'football'), nfl)!
    expect(Object.keys(r.record.st.a).sort()).toEqual(['sacksTaken', 'totalYards', 'turnovers'])
    expect(r.record.st.a.sacksTaken).toBe(2)
    expect(r.record.hs).toBe(20)
    expect(r.record.as).toBe(23)
  })

  it('preseason excluded', () => {
    const nba = structuredClone(fixture('sum_NBA_401910002.json'))
    nba.header.season.type = 1
    expect(toRecord(gameOf(nba, 'NBA', 'basketball'), nba)).toBeNull()
  })

  it('not final excluded', () => {
    const sch = fixture('sum_PL_scheduled.json')
    expect(toRecord(gameOf(sch, 'PL', 'soccer', 'scheduled'), sch)).toBeNull()
  })

  it('missing stat key absent', () => {
    const pl = structuredClone(fixture('sum_PL_401879244.json'))
    const g = gameOf(pl, 'PL', 'soccer')
    const home = pl.boxscore.teams.find((t: any) => String(t.team.id) === g.home.team_id)
    home.statistics = home.statistics.filter((s: any) => s.name !== 'wonCorners')
    const r = toRecord(g, pl)!
    expect('wonCorners' in r.record.st.h).toBe(false)
    expect(r.record.st.a.wonCorners).toBe(3)
  })
})
