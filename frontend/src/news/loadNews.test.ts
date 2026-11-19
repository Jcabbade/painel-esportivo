import { beforeEach, describe, expect, it } from 'vitest'
import type { Game } from '../types'
import { _resetNewsCache, loadNews, newsAge, newsForGame, newsForTeams, relativeTime } from './loadNews'
import type { NewsFile, NewsItem } from './types'

const it_ = (url: string, published: string, teams: string[]): NewsItem => ({
  id: url, source: 'espn', title: url, summary: '', url, image: null, published, video: false, leagues: [], teams,
})
const file = (items: NewsItem[], updated = '2026-11-19T21:00:00.000Z'): NewsFile =>
  ({ updated_at: updated, sources: {} as NewsFile['sources'], items })

const side = (id: string) => ({ team_id: id, name: id, short_name: id, abbrev: id, logo: null, score: null, record: null, rank: null, favorite: false })
const game: Game = {
  id: '1', league: 'ESP', sport: 'soccer', start_utc: '2026-11-21T20:00:00Z', status: 'scheduled', status_detail: '',
  venue: null, home: side('86'), away: side('83'),
}

describe('news selectors', () => {
  it('newsForTeams filters and sorts', () => {
    const f = file([
      it_('a', '2026-11-19T10:00:00.000Z', ['soccer:86']),
      it_('b', '2026-11-19T12:00:00.000Z', ['soccer:1']),
      it_('c', '2026-11-19T15:00:00.000Z', ['soccer:86', 'soccer:83']),
      it_('d', '2026-11-19T09:00:00.000Z', ['soccer:83']),
    ])
    expect(newsForTeams(f, new Set(['soccer:86', 'soccer:83'])).map(i => i.url)).toEqual(['c', 'a', 'd'])
    expect(newsForTeams(f, new Set(['soccer:86']), 1).map(i => i.url)).toEqual(['c'])
    expect(newsForTeams(f, new Set())).toEqual([])
  })

  it('newsForGame uses both teams and sport', () => {
    const f = file([
      it_('a', '2026-11-19T10:00:00.000Z', ['basketball:86']),
      it_('b', '2026-11-19T11:00:00.000Z', ['soccer:83']),
      it_('c', '2026-11-19T12:00:00.000Z', ['soccer:86']),
    ])
    expect(newsForGame(f, game).map(i => i.url)).toEqual(['c', 'b'])
  })

  it('relative time labels', () => {
    const now = new Date('2026-11-19T21:00:00Z')
    expect(relativeTime('2026-11-19T20:59:30Z', now)).toBe('agora')
    expect(relativeTime('2026-11-19T20:48:00Z', now)).toBe('há 12 min')
    expect(relativeTime('2026-11-19T18:00:00Z', now)).toBe('há 3 h')
    expect(relativeTime('2026-11-18T23:00:00Z', now)).toBe('ontem')       // 18/11 20:00 em Brasília
    expect(relativeTime('2026-11-12T15:00:00Z', now)).toBe('12/11')
  })

  it('stale news after 3h', () => {
    const now = new Date('2026-11-19T21:00:00Z')
    expect(newsAge(file([], '2026-11-19T20:30:00.000Z'), now)).toEqual({ label: 'atualizado há 30 min', stale: false })
    expect(newsAge(file([], '2026-11-19T17:30:00.000Z'), now).stale).toBe(true)
  })
})

describe('loadNews', () => {
  beforeEach(() => _resetNewsCache())

  it('loadNews caches 5 min', async () => {
    let calls = 0
    const f = async () => { calls++; return file([]) }
    await loadNews({ fetch: f, now: new Date('2026-11-19T21:00:00Z') })
    await loadNews({ fetch: f, now: new Date('2026-11-19T21:04:00Z') })
    expect(calls).toBe(1)
    await loadNews({ fetch: f, now: new Date('2026-11-19T21:06:00Z') })
    expect(calls).toBe(2)
  })
})
