import { describe, expect, it } from 'vitest'
import { updateLeague } from './update'

/* eslint-disable @typescript-eslint/no-explicit-any */

type State = 'pre' | 'in' | 'post'
interface FakeGame { id: string; day: string; home: string; away: string; state: State; name?: string; hs?: number; as?: number }

const ev = (g: FakeGame) => ({
  id: g.id, date: `${g.day}T20:00Z`,
  status: { type: { state: g.state, name: g.name ?? (g.state === 'post' ? 'STATUS_FINAL' : 'STATUS_SCHEDULED'), shortDetail: '' } },
  competitions: [{ competitors: [
    { homeAway: 'home', team: { id: g.home, displayName: `T${g.home}` }, score: String(g.hs ?? 1) },
    { homeAway: 'away', team: { id: g.away, displayName: `T${g.away}` }, score: String(g.as ?? 0) },
  ] }],
})

const summary = (g: FakeGame) => ({
  header: {
    season: { year: 2026, type: 2 },
    competitions: [{ date: `${g.day}T20:00Z`, competitors: [
      { homeAway: 'home', team: { id: g.home, displayName: `T${g.home}`, abbreviation: `A${g.home}` }, score: String(g.hs ?? 1), linescores: [{ displayValue: '1' }, { displayValue: '0' }] },
      { homeAway: 'away', team: { id: g.away, displayName: `T${g.away}`, abbreviation: `A${g.away}` }, score: String(g.as ?? 0), linescores: [{ displayValue: '0' }, { displayValue: '0' }] },
    ] }],
  },
  boxscore: { teams: [
    { team: { id: g.home }, statistics: [{ name: 'wonCorners', displayValue: '5' }] },
    { team: { id: g.away }, statistics: [{ name: 'wonCorners', displayValue: '4' }] },
  ] },
})

function fakeEspn(games: () => FakeGame[], opts: { failSummary?: Set<string>; standingsTeams?: string[] } = {}) {
  const calls: string[] = []
  const fetch = async (url: string): Promise<unknown> => {
    calls.push(url)
    const sb = /scoreboard\?dates=(\d{4})(\d{2})(\d{2})/.exec(url)
    if (sb) {
      const day = `${sb[1]}-${sb[2]}-${sb[3]}`
      return { events: games().filter(g => g.day === day).map(ev) }
    }
    const sm = /summary\?event=(\w+)/.exec(url)
    if (sm) {
      if (opts.failSummary?.has(sm[1])) throw new Error('ESPN respondeu 500')
      return summary(games().find(g => g.id === sm[1])!)
    }
    if (url.includes('/standings')) {
      return { children: [{ standings: { entries: (opts.standingsTeams ?? []).map(id => ({ team: { id }, stats: [] })) } }] }
    }
    throw new Error(`url inesperada ${url}`)
  }
  return { fetch, calls }
}

const base = { start: '2026-11-01', today: '2026-11-04', sleep: async () => {}, now: new Date('2026-11-04T12:00:00Z') }

describe('updateLeague', () => {
  it('update builds file from scratch', async () => {
    const games: FakeGame[] = [
      { id: 'g2', day: '2026-11-02', home: '3', away: '4', state: 'post' },
      { id: 'g1', day: '2026-11-01', home: '1', away: '2', state: 'post' },
    ]
    const { fetch } = fakeEspn(() => games)
    const { file, done, added } = await updateLeague(null, 'PL', { ...base, fetch })
    expect(done).toBe(true)
    expect(added).toBe(2)
    expect(file.games.map(g => g.id)).toEqual(['g1', 'g2'])
    expect(Object.keys(file.teams).sort()).toEqual(['1', '2', '3', '4'])
    expect(file.scanned_until).toBe('2026-11-03')
    expect(file.games[0].st.h.wonCorners).toBe(5)
  })

  it('update skips non-final games', async () => {
    const games: FakeGame[] = [
      { id: 'adiado', day: '2026-11-01', home: '1', away: '2', state: 'post', name: 'STATUS_POSTPONED' },
      { id: 'cancelado', day: '2026-11-01', home: '3', away: '4', state: 'post', name: 'STATUS_CANCELED' },
      { id: 'agendado', day: '2026-11-02', home: '1', away: '3', state: 'pre' },
      { id: 'aovivo', day: '2026-11-03', home: '2', away: '4', state: 'in' },
    ]
    const { fetch, calls } = fakeEspn(() => games)
    const { file } = await updateLeague(null, 'PL', { ...base, fetch })
    expect(file.games).toEqual([])
    expect(calls.some(u => u.includes('summary'))).toBe(false)
  })

  it('update resumes after cap without duplicates', async () => {
    const games: FakeGame[] = ['01', '02', '03'].map((d, i) =>
      ({ id: `g${i}`, day: `2026-11-${d}`, home: '1', away: '2', state: 'post' as State }))
    const { fetch } = fakeEspn(() => games)
    const opts = { ...base, fetch, maxSummaries: 1 }
    let r = await updateLeague(null, 'PL', opts)
    expect(r.file.games).toHaveLength(1)
    expect(r.done).toBe(false)
    r = await updateLeague(r.file, 'PL', opts)
    r = await updateLeague(r.file, 'PL', opts)
    expect(r.file.games.map(g => g.id)).toEqual(['g0', 'g1', 'g2'])
    r = await updateLeague(r.file, 'PL', opts)
    expect(r.done).toBe(true)
    expect(r.added).toBe(0)
  })

  it('update rescans last 3 days', async () => {
    const games: FakeGame[] = [{ id: 'tarde', day: '2026-11-02', home: '1', away: '2', state: 'in' }]
    const { fetch } = fakeEspn(() => games)
    let r = await updateLeague(null, 'PL', { ...base, fetch })
    expect(r.file.games).toEqual([])
    expect(r.file.scanned_until).toBe('2026-11-03')
    games[0].state = 'post'
    r = await updateLeague(r.file, 'PL', { ...base, today: '2026-11-05', fetch })
    expect(r.file.games.map(g => g.id)).toEqual(['tarde'])
  })

  it('summary error leaves day for next run', async () => {
    const games: FakeGame[] = [
      { id: 'a', day: '2026-11-01', home: '1', away: '2', state: 'post' },
      { id: 'b', day: '2026-11-02', home: '3', away: '4', state: 'post' },
    ]
    const bad = fakeEspn(() => games, { failSummary: new Set(['b']) })
    let r = await updateLeague(null, 'PL', { ...base, fetch: bad.fetch })
    expect(r.file.games.map(g => g.id)).toEqual(['a'])
    expect(r.file.scanned_until).toBe('2026-11-01')
    const good = fakeEspn(() => games)
    r = await updateLeague(r.file, 'PL', { ...base, fetch: good.fetch })
    expect(r.file.games.map(g => g.id)).toEqual(['a', 'b'])
    expect(r.file.scanned_until).toBe('2026-11-03')
  })

  it('stops at the deadline and resumes next run', async () => {
    const games: FakeGame[] = [{ id: 'g1', day: '2026-11-01', home: '1', away: '2', state: 'post' }]
    const { fetch } = fakeEspn(() => games)
    const r = await updateLeague(null, 'PL', { ...base, fetch, deadline: 0 })
    expect(r.done).toBe(false)
    expect(r.file.games).toEqual([])
    expect(r.file.scanned_until).toBeNull()
    const r2 = await updateLeague(r.file, 'PL', { ...base, fetch })
    expect(r2.file.games.map(g => g.id)).toEqual(['g1'])
  })

  it('a game that keeps failing is given up after 3 runs', async () => {
    const games: FakeGame[] = [
      { id: 'a', day: '2026-11-01', home: '1', away: '2', state: 'post' },
      { id: 'quebrado', day: '2026-11-02', home: '3', away: '4', state: 'post' },
    ]
    const bad = fakeEspn(() => games, { failSummary: new Set(['quebrado']) })
    let r = await updateLeague(null, 'PL', { ...base, fetch: bad.fetch })
    expect(r.file.scanned_until).toBe('2026-11-01')
    r = await updateLeague(r.file, 'PL', { ...base, fetch: bad.fetch })
    expect(r.file.scanned_until).toBe('2026-11-01')
    r = await updateLeague(r.file, 'PL', { ...base, fetch: bad.fetch })
    expect(r.file.scanned_until).toBe('2026-11-03')          // 3ª falha: deixa o jogo de lado
    expect(r.file.games.map(g => g.id)).toEqual(['a'])       // nada inventado no lugar
    const good = fakeEspn(() => games)
    r = await updateLeague(r.file, 'PL', { ...base, fetch: good.fetch })
    expect(r.file.games.map(g => g.id)).toEqual(['a', 'quebrado'])   // se voltar a responder na janela, entra
  })

  it('nba drops teams outside standings', async () => {
    const games: FakeGame[] = [
      { id: 'ok', day: '2026-11-01', home: '1', away: '2', state: 'post' },
      { id: 'allstar', day: '2026-11-02', home: '31', away: '32', state: 'post' },
    ]
    const { fetch, calls } = fakeEspn(() => games, { standingsTeams: ['1', '2'] })
    const { file } = await updateLeague(null, 'NBA', { ...base, fetch })
    expect(file.games.map(g => g.id)).toEqual(['ok'])
    expect(calls.filter(u => u.includes('/standings'))).toHaveLength(1)
    expect(calls.some(u => u.includes('event=allstar'))).toBe(false)
  })
})

describe('updateLeague v2', () => {
  const base2 = { start: '2026-11-01', today: '2026-11-03', sleep: async () => {}, now: new Date('2026-11-03T12:00:00Z') }

  it('v1 file triggers full reload', async () => {
    const games = [{ id: 'g1', day: '2026-11-01', home: '1', away: '2', state: 'post' as const }]
    const espn = fakeEspnV2(() => games)
    const v1 = { league: 'PL', updated_at: '', scanned_until: '2026-11-02', teams: {}, games: [] }
    const r = await updateLeague(v1 as any, 'PL', { ...base2, fetch: espn })
    expect(r.file.v).toBe(2)
    expect(r.file.games.map(g => g.id)).toEqual(['g1'])
  })

  it('players file accumulates without duplicates', async () => {
    const games = [{ id: 'g1', day: '2026-11-01', home: '1', away: '2', state: 'post' as const }]
    const espn = fakeEspnV2(() => games)
    let r = await updateLeague(null, 'PL', { ...base2, fetch: espn })
    r = await updateLeague(r.file, 'PL', { ...base2, fetch: espn, players: r.players })
    expect(r.players.v).toBe(2)
    expect(r.players.games.map(g => g.id)).toEqual(['g1'])
    expect(r.players.games[0].p.map(p => p.n)).toEqual(['Jogador 1'])
  })
})

/* Igual ao fakeEspn, com um jogador no summary. */
function fakeEspnV2(games: () => { id: string; day: string; home: string; away: string; state: 'post' }[]) {
  const { fetch } = fakeEspn(games as any)
  return async (url: string) => {
    const r: any = await fetch(url)
    if (url.includes('summary')) {
      const g = games().find(x => url.endsWith(x.id))!
      r.rosters = [{ homeAway: 'home', team: { id: g.home }, roster: [
        { starter: true, athlete: { id: 'p1', displayName: 'Jogador 1' }, stats: [{ name: 'appearances', value: 1 }, { name: 'foulsCommitted', value: 2 }] },
      ] }]
    }
    return r
  }
}
