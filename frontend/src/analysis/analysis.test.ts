import { describe, expect, it } from 'vitest'
import { parseSummary } from '../espn/summary'
import { fixture } from '../espn/testFixtures'
import type { GameRecord, LeagueFile, PlayersFile } from '../history/types'
import type { Game } from '../types'
import { cornerProfile } from './corners'
import { formationLayout } from './formation'
import { headToHead, form } from './h2h'
import { playerRanking } from './players'
import { compare, opportunities, teamGames } from './pregame'

let seq = 0
function g(p: Partial<GameRecord> & { h: string; a: string }): GameRecord {
  seq++
  return { id: `g${seq}`, date: `2026-10-${String(seq % 28 + 1).padStart(2, '0')}T20:00:00Z`, season: 2026,
    hs: 0, as: 0, hp: [], ap: [], st: { h: {}, a: {} }, ...p }
}
const file = (league: string, games: GameRecord[]): LeagueFile => ({
  v: 2, league, updated_at: '', scanned_until: '2026-11-18', games,
  teams: Object.fromEntries(games.flatMap(x => [x.h, x.a]).map(id => [id, { name: `Time ${id}`, abbrev: id, logo: null }])),
})
const corners = (h: number, a: number) => ({ st: { h: { wonCorners: h }, a: { wonCorners: a } } })

describe('pregame', () => {
  it('compare uses venue split', () => {
    const f = file('PL', [
      g({ h: '1', a: '9', ...corners(8, 2), date: '2026-10-01T20:00:00Z' }),   // 1 em casa
      g({ h: '9', a: '1', ...corners(6, 4), date: '2026-10-08T20:00:00Z' }),   // 1 fora
      g({ h: '9', a: '2', ...corners(5, 3), date: '2026-10-09T20:00:00Z' }),   // 2 fora
    ])
    const all = compare([f], '1', '2', 'soccer', { last: 10, venueSplit: false }).find(r => r.metric === 'corners')!
    expect(all.home).toEqual({ for: 6, against: 4, n: 2 })
    const split = compare([f], '1', '2', 'soccer', { last: 10, venueSplit: true }).find(r => r.metric === 'corners')!
    expect(split.home).toEqual({ for: 8, against: 2, n: 1 })
    expect(split.away).toEqual({ for: 3, against: 5, n: 1 })
  })

  it('opportunities picks best side and threshold', () => {
    const games = Array.from({ length: 10 }, (_, i) => g({
      h: '1', a: '9', date: `2026-10-${String(i + 1).padStart(2, '0')}T20:00:00Z`,
      st: { h: { wonCorners: i < 9 ? 7 : 2, yellowCards: 1, redCards: 0, foulsCommitted: i % 2 ? 20 : 5 }, a: {} },
    }))
    const ops = opportunities([file('PL', games)], '1', 'soccer', { last: 10, venue: 'all' })
    const c = ops.find(o => o.label === 'Escanteios')!
    expect(c).toMatchObject({ kind: 'over', line: 4.5, hits: 9, n: 10 })
    const cards = ops.find(o => o.label === 'Cartões')!
    expect(cards).toMatchObject({ kind: 'under', line: 2.5, hits: 10, n: 10 })
    expect(ops.some(o => o.label === 'Faltas')).toBe(false)     // 5/10 de cada lado: não é oportunidade
    expect(ops.length).toBeLessThanOrEqual(5)
  })

  it('only games before kickoff count', () => {
    const f = file('PL', [
      g({ h: '1', a: '2', ...corners(8, 2), date: '2026-10-01T20:00:00Z' }),
      g({ h: '1', a: '2', ...corners(0, 9), date: '2026-10-20T20:00:00Z' }),   // o próprio jogo / depois dele
    ])
    expect(teamGames([f], '1', { venue: 'all', last: 10, before: '2026-10-20T20:00:00Z' })).toHaveLength(1)
    const row = compare([f], '1', '2', 'soccer', { last: 10, venueSplit: false, before: '2026-10-20T20:00:00Z' }).find(r => r.metric === 'corners')!
    expect(row.home).toEqual({ for: 8, against: 2, n: 1 })
    expect(headToHead([f], '1', '2', 'total', '2026-10-20T20:00:00Z').games).toHaveLength(1)
    expect(form([f], '1', 10, 'all', '2026-10-20T20:00:00Z')).toHaveLength(1)
    expect(cornerProfile([f], '1', { last: 10, venue: 'all', view: 'for', before: '2026-10-20T20:00:00Z' }).n).toBe(0)
  })

  it('analysis handles team without history', () => {
    const f = file('PL', [g({ h: '1', a: '2' })])
    expect(teamGames([f], '77', { venue: 'all', last: 10 })).toEqual([])
    expect(compare([f], '77', '78', 'soccer', { last: 10, venueSplit: false }).every(r => r.home.n === 0 && r.away.n === 0)).toBe(true)
    expect(opportunities([f], '77', 'soccer', { last: 10, venue: 'all' })).toEqual([])
    expect(cornerProfile([f], '77', { last: 10, venue: 'all', view: 'for' }).n).toBe(0)
    expect(form([f], '77')).toEqual([])
    expect(headToHead([f], '77', '78', 'total').games).toEqual([])
  })
})

describe('h2h', () => {
  it('head to head counts and filters', () => {
    const f = file('PL', [
      g({ h: '1', a: '2', hs: 2, as: 0 }), g({ h: '2', a: '1', hs: 1, as: 1 }),
      g({ h: '2', a: '1', hs: 3, as: 0 }), g({ h: '1', a: '3', hs: 5, as: 0 }),
    ])
    const t = headToHead([f], '1', '2', 'total')
    expect(t).toMatchObject({ aWins: 1, draws: 1, bWins: 1 })
    expect(t.games).toHaveLength(3)
    expect(headToHead([f], '1', '2', 'aHome').games).toHaveLength(1)
    expect(headToHead([f], '1', '2', 'bHome').games).toHaveLength(2)
    const fm = form([f], '1', 10)
    expect(fm[0]).toMatchObject({ gf: expect.any(Number), res: expect.stringMatching(/^[VED]$/) })
    expect(fm).toHaveLength(4)
  })
})

describe('corners', () => {
  it('corner profile ignores games without cb', () => {
    const b = (x: number) => { const a = Array(10).fill(0); a[0] = x; return a }
    const f = file('PL', [
      g({ h: '1', a: '2', cb: { h: b(2), a: b(1) } }),
      g({ h: '3', a: '1', cb: { h: b(0), a: b(1) } }),
      g({ h: '1', a: '4' }),   // sem cb
    ])
    const pf = cornerProfile([f], '1', { last: 10, venue: 'all', view: 'for' })
    expect(pf.n).toBe(2)
    expect(pf.buckets[0]).toMatchObject({ label: '0–10', avg: 1.5, total: 3 })
    expect(cornerProfile([f], '1', { last: 10, venue: 'all', view: 'total' }).buckets[0].total).toBe(4)
  })
})

describe('players', () => {
  it('player ranking uses last 10 appearances', () => {
    const pf: PlayersFile = { league: 'PL', v: 2, games: Array.from({ length: 12 }, (_, i) => ({
      id: `x${i}`, date: `2026-10-${String(i + 1).padStart(2, '0')}T20:00:00Z`, season: 2026,
      p: [
        { id: 'a', n: 'Atacante', t: '1', s: true, st: { totalShots: i < 2 ? 100 : 2 } },
        ...(i % 2 ? [{ id: 'b', n: 'Reserva', t: '1', s: false, st: { totalShots: 4 } }] : []),
        { id: 'c', n: 'Outro time', t: '9', s: true, st: { totalShots: 9 } },
      ],
    })) }
    const r = playerRanking(pf, ['1'], 'totalShots', { last: 10 })
    expect(r.map(x => x.id)).toEqual(['b', 'a'])
    expect(r[1]).toMatchObject({ avg: 2, n: 10 })
    expect(r[1].seq).toHaveLength(10)
    expect(r[0]).toMatchObject({ avg: 4, n: 6 })
    expect(playerRanking(pf, ['1'], 'totalShots', { last: 10, onlyIds: new Set(['a']) }).map(x => x.id)).toEqual(['a'])
  })
})

describe('formation', () => {
  const full = fixture('sum_PL_401879244_full.json')
  const side = (ha: string) => ({ team_id: String(full.header.competitions[0].competitors.find((c: { homeAway: string }) => c.homeAway === ha).team.id),
    name: '', short_name: '', abbrev: '', logo: null, score: null, record: null, rank: null, favorite: false })
  const game: Game = { id: '401879244', league: 'PL', sport: 'soccer', start_utc: '', status: 'final', status_detail: '', venue: null, home: side('home'), away: side('away') }
  const d = parseSummary(game, full)

  it('formation layout 4-2-3-1 from fixture', () => {
    const rows = formationLayout(d.lineups!.home.formation, d.lineups!.home.starters)
    expect(rows.map(r => r.length)).toEqual([1, 4, 2, 3, 1])
    expect(rows[4][0].name).toBe('Charalambos Kostoulas')
    expect(rows[0][0].position).toBe('G')
    const away = formationLayout(d.lineups!.away.formation, d.lineups!.away.starters)
    expect(away.map(r => r.length)).toEqual([1, 4, 4, 2])
  })

  it('formation layout keeps all 11 players', () => {
    const starters = d.lineups!.home.starters.map((p, i) => ({ ...p, position: i === 0 ? 'G' : `X${i}` }))
    const rows = formationLayout(null, starters)
    expect(rows.flat()).toHaveLength(11)
    const rows2 = formationLayout('3-5-2', d.lineups!.home.starters.slice(0, 9))
    expect(rows2.flat()).toHaveLength(9)
  })
})
