import { describe, expect, it } from 'vitest'
import type { Game } from '../types'
import { createDetailLoader, loadDetail, nextDetailState } from './loadDetail'
import { parseSummary } from './summary'
import { fixture } from './testFixtures'

const side = (id: string) => ({ team_id: id, name: id, short_name: id, abbrev: id, logo: null, score: null, record: null, rank: null, favorite: false })
const game = (id: string): Game => ({
  id, league: 'PL', sport: 'soccer', start_utc: '2026-11-08T14:00:00Z', status: 'final', status_detail: 'FT',
  venue: null, home: side('331'), away: side('337'),
})

describe('loadDetail', () => {
  it('loadDetail builds summary url', async () => {
    const urls: string[] = []
    const payload = fixture('sum_PL_401879244.json')
    const d = await loadDetail(game('401879244'), { fetch: async u => { urls.push(u); return payload } })
    expect(urls).toEqual(['https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=401879244'])
    expect(d).toEqual(parseSummary(game('401879244'), payload))
  })

  it('loadDetail ignores stale response', async () => {
    const payload = fixture('sum_PL_401879244.json')
    let releaseA!: () => void
    const gate = new Promise<void>(r => { releaseA = r })
    const loader = createDetailLoader(async u => {
      if (u.endsWith('event=A')) await gate
      return payload
    })
    const a = loader.load(game('A'))
    const b = await loader.load(game('B'))
    releaseA()
    expect(b).not.toBeNull()
    expect(await a).toBeNull()
  })

  it('detail keeps last data on refresh error', () => {
    const detail = parseSummary(game('1'), fixture('sum_PL_401879244.json'))
    const kept = nextDetailState({ detail, error: null }, { ok: false, message: 'sem conexão com a ESPN' })
    expect(kept).toEqual({ detail, error: 'sem conexão com a ESPN' })
    expect(nextDetailState(kept, { ok: true, detail })).toEqual({ detail, error: null })
    expect(nextDetailState({ detail: null, error: null }, { ok: false, message: 'x' })).toEqual({ detail: null, error: 'x' })
  })
})
