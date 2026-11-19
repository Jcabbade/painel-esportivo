import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixture } from './testFixtures'
import { loadDay, refreshLive } from './loadDay'
import { _resetMemory, toggleFavorite } from './store'

const NOW = new Date('2026-11-08T20:00:00Z')

/** fetch falso: devolve fixtures por liga; standings da PL; o resto vazio. */
function fakeFetch(opts: { fail?: string[]; payload?: Record<string, unknown> } = {}) {
  const calls: string[] = []
  const fn = async (url: string) => {
    calls.push(url)
    const key = url.includes('/eng.1/') ? 'PL' : url.includes('/nba/') ? 'NBA' : 'OTHER'
    if (opts.fail?.includes(key)) throw new Error('ESPN respondeu 503')
    if (url.includes('/standings')) return key === 'PL' ? fixture('standings_PL.json') : {}
    if (opts.payload?.[key]) return opts.payload[key]
    if (key === 'PL' && url.endsWith('dates=20261108')) return fixture('sb_PL_20261108.json')
    return { events: [] }
  }
  return { fn, calls }
}

describe('loadDay', () => {
  beforeEach(() => { _resetMemory(); vi.stubGlobal('localStorage', undefined) })
  afterEach(() => vi.unstubAllGlobals())

  it('fetches D-1 and D for each league', async () => {
    const f = fakeFetch()
    await loadDay('2026-11-08', { fetch: f.fn, now: NOW, leagues: ['PL'] })
    const sb = f.calls.filter(u => u.includes('scoreboard'))
    expect(sb.map(u => u.slice(-8)).sort()).toEqual(['20261107', '20261108'])
  })

  it('returns games with rank, sorted, not stale', async () => {
    const r = await loadDay('2026-11-08', { fetch: fakeFetch().fn, now: NOW })
    expect(r.date).toBe('2026-11-08')
    expect(r.games).toHaveLength(5)
    expect(r.games.every(g => typeof g.home.rank === 'number')).toBe(true)
    const starts = r.games.map(g => g.start_utc)
    expect(starts).toEqual([...starts].sort())
    expect(r.stale).toBe(false)
    expect(r.errors).toEqual([])
    expect(r.updated_at).toBe('2026-11-08T20:00:00Z')
  })

  it('filters by Sao Paulo day', async () => {
    const payload = fixture('sb_PL_20261108.json')
    payload.events = payload.events.slice(0, 2)
    payload.events[0].date = '2026-11-09T02:30Z' // 23:30 de 08/11 em Brasília
    payload.events[1].date = '2026-11-09T03:30Z' // 00:30 de 09/11
    const f = fakeFetch({ payload: { PL: payload } })
    const d8 = await loadDay('2026-11-08', { fetch: f.fn, now: NOW, leagues: ['PL'] })
    const d9 = await loadDay('2026-11-09', { fetch: f.fn, now: NOW, leagues: ['PL'] })
    expect(d8.games.map(g => g.id)).toEqual([payload.events[0].id])
    expect(d9.games.map(g => g.id)).toEqual([payload.events[1].id])
  })

  it('keeps other leagues when one fails', async () => {
    const nba = fixture('sb_NBA_20261117.json')
    for (const ev of nba.events) ev.date = '2026-11-08T22:00Z'
    const r = await loadDay('2026-11-08', { fetch: fakeFetch({ fail: ['PL'], payload: { NBA: nba } }).fn, now: NOW })
    expect(r.games.filter(g => g.league === 'NBA')).toHaveLength(5)
    expect(r.errors.map(e => e.league)).toEqual(['PL'])
    expect(r.errors[0].message).toBe('ESPN respondeu 503')
    expect(r.stale).toBe(true)
  })

  it('applies favorite', async () => {
    const first = await loadDay('2026-11-08', { fetch: fakeFetch().fn, now: NOW })
    const g = first.games[0]
    toggleFavorite('soccer', g.home.team_id)
    const r = await loadDay('2026-11-08', { fetch: fakeFetch().fn, now: NOW })
    expect(r.games.find(x => x.id === g.id)!.home.favorite).toBe(true)
  })
})

describe('refreshLive', () => {
  beforeEach(() => { _resetMemory(); vi.stubGlobal('localStorage', undefined) })
  afterEach(() => vi.unstubAllGlobals())

  it('only refetches live leagues and merges', async () => {
    const pl = fixture('sb_PL_20261108.json')
    pl.events = pl.events.slice(0, 1)
    pl.events[0].date = '2026-11-08T19:30Z'
    pl.events[0].status.type.state = 'in'
    pl.events[0].status.type.shortDetail = "30'"
    const nba = fixture('sb_NBA_20261117.json')
    nba.events = nba.events.slice(0, 1)
    nba.events[0].date = '2026-11-08T23:00Z'
    const first = await loadDay('2026-11-08', { fetch: fakeFetch({ payload: { PL: pl, NBA: nba } }).fn, now: NOW })
    expect(first.games).toHaveLength(2)

    pl.events[0].status.type.shortDetail = "31'"
    const f = fakeFetch({ payload: { PL: pl, NBA: nba } })
    const r = await refreshLive(first, { fetch: f.fn, now: NOW })
    expect(f.calls.every(u => u.includes('/eng.1/'))).toBe(true)
    expect(r.games).toHaveLength(2)
    expect(r.games.find(g => g.league === 'PL')!.status_detail).toBe("31'")
  })
})
