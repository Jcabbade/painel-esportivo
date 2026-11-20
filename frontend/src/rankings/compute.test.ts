import { describe, expect, it } from 'vitest'
import type { GameRecord, LeagueFile, Meta } from '../history/types'
import { dataAge, dataStatus, leagueRanking, teamRanking } from './compute'
import { defaultLine, METRICS, sideValue } from './metrics'

let seq = 0
function g(p: Partial<GameRecord> & { h: string; a: string }): GameRecord {
  seq++
  return {
    id: `g${seq}`, date: `2026-11-${String(seq % 28 + 1).padStart(2, '0')}T20:00:00Z`, season: 2026,
    hs: 0, as: 0, hp: [], ap: [], st: { h: {}, a: {} }, ...p,
  }
}
function file(league: string, games: GameRecord[], names: Record<string, string> = {}): LeagueFile {
  const teams: LeagueFile['teams'] = {}
  for (const x of games) for (const id of [x.h, x.a]) teams[id] = { name: names[id] ?? `Time ${id}`, abbrev: id, logo: null }
  return { league, updated_at: '2026-11-19T12:00:00Z', scanned_until: '2026-11-18', teams, games }
}
const metric = (id: string) => METRICS.find(m => m.id === id)!
const now = new Date('2026-11-30T12:00:00Z')

describe('metrics', () => {
  it('periods use halves and quarters', () => {
    const soccer = g({ h: '1', a: '2', hs: 3, as: 1, hp: [1, 2], ap: [0, 1] })
    expect(sideValue(soccer, 'h', metric('goals'), 'h1', 'soccer')).toBe(1)
    expect(sideValue(soccer, 'a', metric('goals'), 'h2', 'soccer')).toBe(1)
    const nba = g({ h: '1', a: '2', hs: 120, as: 118, hp: [30, 25, 28, 27, 10], ap: [20, 30, 30, 28, 10] })
    expect(sideValue(nba, 'h', metric('points'), 'h1', 'basketball')).toBe(55)
    expect(sideValue(nba, 'h', metric('points'), 'h2', 'basketball')).toBe(55)   // sem a prorrogação
    expect(sideValue(nba, 'a', metric('points'), 'q3', 'basketball')).toBe(30)
    expect(sideValue(nba, 'h', metric('points'), 'full', 'basketball')).toBe(120)
    expect(sideValue(g({ h: '1', a: '2', hp: [] }), 'h', metric('goals'), 'h1', 'soccer')).toBeNull()
  })

  it('cards sums yellow and red only when both present', () => {
    expect(sideValue(g({ h: '1', a: '2', st: { h: { yellowCards: 3, redCards: 1 }, a: {} } }), 'h', metric('cards'), 'full', 'soccer')).toBe(4)
    expect(sideValue(g({ h: '1', a: '2', st: { h: { yellowCards: 3 }, a: {} } }), 'h', metric('cards'), 'full', 'soccer')).toBeNull()
  })

  it('sacks for = opponent sacksTaken', () => {
    const x = g({ h: '1', a: '2', st: { h: { sacksTaken: 2 }, a: { sacksTaken: 5 } } })
    expect(sideValue(x, 'h', metric('sacks'), 'full', 'football')).toBe(5)
    expect(sideValue(x, 'a', metric('sacks'), 'full', 'football')).toBe(2)
  })

  it('default lines per period', () => {
    expect(defaultLine(metric('goals'), 'soccer', 'full')).toBe(2.5)
    expect(defaultLine(metric('goals'), 'soccer', 'h1')).toBe(1.5)
    expect(defaultLine(metric('points'), 'basketball', 'q1')).toBe(56.5)
    expect(defaultLine(metric('points'), 'football', 'full')).toBe(44.5)
  })
})

describe('leagueRanking', () => {
  it('league avg and over', () => {
    const f = file('PL', [g({ h: '1', a: '2', hs: 1, as: 0 }), g({ h: '1', a: '3', hs: 2, as: 1 }), g({ h: '2', a: '3', hs: 2, as: 2 })])
    const [row] = leagueRanking([f], 'goals', 'full', { kind: 'over', line: 2.5 }, 'season', now)
    expect(row).toMatchObject({ league: 'PL', games: 3, avg: 2.67, pct: 66.7 })
    const [under] = leagueRanking([f], 'goals', 'full', { kind: 'under', line: 2.5 }, 'season', now)
    expect(under.pct).toBe(33.3)
  })

  it('missing stat is excluded, not zero', () => {
    const f = file('PL', [
      g({ h: '1', a: '2', st: { h: { wonCorners: 5 }, a: { wonCorners: 5 } } }),
      g({ h: '1', a: '3', st: { h: { wonCorners: 6 }, a: { wonCorners: 4 } } }),
      g({ h: '2', a: '3', st: { h: { wonCorners: 9 }, a: {} } }),
    ])
    const [row] = leagueRanking([f], 'corners', 'full', { kind: 'avg' }, 'season', now)
    expect(row.games).toBe(2)
    expect(row.avg).toBe(10)
  })

  it('window 30d and season', () => {
    const f = file('PL', [
      g({ h: '1', a: '2', hs: 4, as: 0, season: 2025, date: '2026-05-01T20:00:00Z' }),
      g({ h: '1', a: '2', hs: 1, as: 0, season: 2026, date: '2026-08-20T20:00:00Z' }),
      g({ h: '1', a: '2', hs: 3, as: 0, season: 2026, date: '2026-11-20T20:00:00Z' }),
    ])
    expect(leagueRanking([f], 'goals', 'full', { kind: 'avg' }, 'season', now)[0]).toMatchObject({ games: 2, avg: 2 })
    expect(leagueRanking([f], 'goals', 'full', { kind: 'avg' }, '30d', now)[0]).toMatchObject({ games: 1, avg: 3 })
  })

  it('btts and result in league ranking', () => {
    const f = file('PL', [
      g({ h: '1', a: '2', hs: 2, as: 1 }), g({ h: '1', a: '3', hs: 1, as: 1 }),
      g({ h: '2', a: '3', hs: 0, as: 2 }), g({ h: '3', a: '1', hs: 3, as: 0 }),
    ])
    expect(leagueRanking([f], 'btts', 'full', { kind: 'avg' }, 'season', now)[0]).toMatchObject({ games: 4, pct: 50 })
    expect(leagueRanking([f], 'result', 'full', { kind: 'avg' }, 'season', now)[0].result).toEqual({ home: 50, draw: 25, away: 25 })
  })

  it('sorts leagues by value', () => {
    const a = file('PL', [g({ h: '1', a: '2', hs: 1, as: 0 })])
    const b = file('ESP', [g({ h: '1', a: '2', hs: 3, as: 1 })])
    expect(leagueRanking([a, b], 'goals', 'full', { kind: 'avg' }, 'season', now).map(r => r.league)).toEqual(['ESP', 'PL'])
  })
})

describe('teamRanking', () => {
  const base = { metricId: 'goals', period: 'full' as const, view: 'for' as const, measure: { kind: 'avg' } as const,
    last: 'season' as const, venue: 'all' as const, order: 'desc' as const }

  it('team last N crosses seasons', () => {
    const games = [
      g({ h: '1', a: '2', hs: 9, as: 0, season: 2025, date: '2026-04-01T20:00:00Z' }),
      g({ h: '1', a: '2', hs: 1, as: 0, season: 2026, date: '2026-09-01T20:00:00Z' }),
      g({ h: '2', a: '1', hs: 0, as: 1, season: 2026, date: '2026-09-08T20:00:00Z' }),
    ]
    const f = file('PL', games)
    const t1 = (opts: object) => teamRanking([f], { ...base, ...opts }).find(r => r.teamId === '1')!
    expect(t1({ last: 5 })).toMatchObject({ games: 3, avg: 3.67 })
    expect(t1({ last: 'season' })).toMatchObject({ games: 2, avg: 1 })
    expect(t1({ last: 5 }).form).toEqual(['V', 'V', 'V'])
  })

  it('team venue and view', () => {
    const f = file('PL', [g({ h: '1', a: '2', hs: 2, as: 1 }), g({ h: '3', a: '1', hs: 4, as: 0 })])
    const t1 = (opts: object) => teamRanking([f], { ...base, ...opts }).find(r => r.teamId === '1')!
    expect(t1({ venue: 'home' })).toMatchObject({ games: 1, avg: 2 })
    expect(t1({ venue: 'away', view: 'against' })).toMatchObject({ games: 1, avg: 4 })
    expect(t1({ view: 'total' })).toMatchObject({ games: 2, avg: 3.5 })
    expect(t1({ measure: { kind: 'over', line: 1.5 } })).toMatchObject({ pct: 50, hits: 1 })
  })

  it('team form and result', () => {
    const f = file('NFL', [
      g({ h: '1', a: '2', hs: 20, as: 20, date: '2026-11-01T20:00:00Z' }),
      g({ h: '1', a: '3', hs: 10, as: 20, date: '2026-11-08T20:00:00Z' }),
      g({ h: '4', a: '1', hs: 7, as: 30, date: '2026-11-15T20:00:00Z' }),
    ])
    const t1 = teamRanking([f], { ...base, metricId: 'result' }).find(r => r.teamId === '1')!
    expect(t1.form).toEqual(['V', 'D', 'E'])
    expect(t1.result).toEqual({ w: 33.3, d: 33.3, l: 33.3 })
  })

  it('all soccer merges a team across leagues', () => {
    const esp = file('ESP', [g({ h: '86', a: '1', hs: 2, as: 0 })], { 86: 'Real Madrid' })
    const ucl = file('UCL', [g({ h: '5', a: '86', hs: 1, as: 3 })], { 86: 'Real Madrid' })
    const all = teamRanking([esp, ucl], base).find(r => r.teamId === '86')!
    expect(all).toMatchObject({ name: 'Real Madrid', games: 2, avg: 2.5 })
    expect(teamRanking([esp], base).find(r => r.teamId === '86')).toMatchObject({ games: 1, avg: 2 })
  })

  it('teams without games in the current season are not ranked', () => {
    const f = file('PL', [
      g({ h: '1', a: '2', hs: 5, as: 0, season: 2025, date: '2026-04-01T20:00:00Z' }),   // 2 foi rebaixado
      g({ h: '1', a: '3', hs: 1, as: 0, season: 2026, date: '2026-09-01T20:00:00Z' }),
    ])
    const ids = teamRanking([f], { ...base, last: 5 }).map(r => r.teamId)
    expect(ids).not.toContain('2')
    expect(teamRanking([f], { ...base, last: 5 }).find(r => r.teamId === '1')).toMatchObject({ games: 2, avg: 3 })
  })

  it('order and ties', () => {
    const f = file('PL', [
      g({ h: '1', a: '9', hs: 2, as: 0 }), g({ h: '1', a: '9', hs: 2, as: 0 }),
      g({ h: '2', a: '9', hs: 2, as: 0 }),
      g({ h: '3', a: '9', hs: 1, as: 0 }),
    ], { 1: 'B', 2: 'A', 3: 'C', 9: 'Z' })
    const desc = teamRanking([f], base).map(r => r.teamId)
    expect(desc.slice(0, 3)).toEqual(['1', '2', '3'])     // 1 e 2 empatam em 2,0; 1 tem mais jogos
    expect(teamRanking([f], { ...base, order: 'asc' })[0].teamId).toBe('9')
  })

  it('minGames: time eliminado na copa com 1 jogo não lidera o ranking', () => {
    const f = file('CDB', [
      g({ h: '50', a: '51', hs: 6, as: 0 }),                       // clube pequeno, 1 jogo
      g({ h: '1', a: '2', hs: 2, as: 0 }), g({ h: '2', a: '1', hs: 0, as: 2 }), g({ h: '1', a: '3', hs: 1, as: 1 }),
    ])
    const ids = teamRanking([f], { ...base, minGames: 3 }).map(r => r.teamId)
    expect(ids).toEqual(['1'])
    expect(teamRanking([f], base).map(r => r.teamId)[0]).toBe('50')  // sem mínimo: comportamento antigo
  })
})

describe('dataStatus', () => {
  const lf = (league: string, scanned: string | null): LeagueFile => ({ ...file(league, []), scanned_until: scanned })
  const now = new Date('2026-11-20T15:00:00Z')   // 20/11 em Brasília

  it('label uses the oldest scanned day of the shown leagues', () => {
    const s = dataStatus([lf('PL', '2026-11-19'), lf('ESP', '2026-11-18')], null, now)
    expect(s.label).toBe('Jogos até 18/11')
    expect(s.stale).toBe(false)
  })

  it('stale when a league stopped advancing', () => {
    const s = dataStatus([lf('PL', '2026-11-19'), lf('NBA', '2026-11-13')], null, now)
    expect(s.stale).toBe(true)
    expect(s.label).toBe('Jogos até 13/11')
  })

  it('reports league errors and pending loads from meta', () => {
    const meta: Meta = { updated_at: '2026-11-20T12:00:00Z', leagues: {
      PL: { games: 10, scanned_until: '2026-11-19', error: null, pending: true },
      NBA: { games: 5, scanned_until: '2026-11-19', error: 'ESPN respondeu 500', pending: false },
      NFL: { games: 5, scanned_until: '2026-11-19', error: 'outra liga', pending: false },
    } }
    const s = dataStatus([lf('PL', '2026-11-19'), lf('NBA', '2026-11-19')], meta, now)
    expect(s.problems).toEqual(['Premier League: carga do histórico em andamento', 'NBA: última atualização falhou (ESPN respondeu 500)'])
  })

  it('no scanned day yet', () => {
    expect(dataStatus([lf('PL', null)], null, now)).toMatchObject({ label: 'Histórico ainda sem jogos', stale: true })
  })
})

describe('dataAge', () => {
  it('stale data warning after 36h', () => {
    expect(dataAge('2026-11-19T12:00:00Z', new Date('2026-11-19T20:00:00Z'))).toEqual({ label: 'Dados até 19/11 09:00', stale: false })
    expect(dataAge('2026-11-19T12:00:00Z', new Date('2026-11-21T01:00:00Z')).stale).toBe(true)
  })
})
