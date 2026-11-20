import { beforeEach, describe, expect, it } from 'vitest'
import type { Game } from '../types'
import { fixture } from '../espn/testFixtures'
import { _resetNewsCache, loadNews, NEWS_URL, newsAge, newsForGame, newsForTeams, relativeTime } from './loadNews'
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

  it('resumos da liga (mais de 3 times marcados) não contam como notícia do time', () => {
    const many = Array.from({ length: 24 }, (_, i) => `basketball:${i + 1}`)
    const f = file([
      it_('top10', '2026-11-19T12:00:00.000Z', many),
      it_('jogo', '2026-11-19T11:00:00.000Z', ['basketball:13', 'basketball:26']),
    ])
    expect(newsForTeams(f, new Set(['basketball:13'])).map(i => i.url)).toEqual(['jogo'])
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
    expect(newsAge(file([], '2026-11-19T20:30:00.000Z'), now)).toEqual({ label: 'atualizado há 30 min', stale: false, live: false })
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

describe('loadNews: ESPN direto quando o robô está parado', () => {
  beforeEach(() => _resetNewsCache())
  const now = new Date('2026-11-20T12:00:00Z')
  const old = '2026-11-19T21:41:00.000Z' // mais de 3 h antes

  const fake = (robot: NewsFile, calls: string[] = []) => async (url: string) => {
    calls.push(url)
    if (url.includes('raw.githubusercontent') || url === NEWS_URL) return robot
    if (url.includes('/soccer/eng.1/news')) return fixture('news/espn_PL_pt.json')
    if (url.includes('/soccer/eng.1/standings')) return fixture('standings_PL.json')
    throw new Error('respondeu 500')
  }

  it('robô velho: junta as notícias da ESPN buscadas agora e marca live_at', async () => {
    const robotItem = it_('https://x.com/a', '2026-11-19T20:00:00.000Z', [])
    const f = await loadNews({ fetch: fake(file([robotItem], old)), now })
    expect(f.updated_at).toBe(old)                       // o horário do robô não muda
    expect(f.live_at).toBe(now.toISOString())
    expect(f.items.some(i => i.url === 'https://x.com/a')).toBe(true)
    const espn = f.items.filter(i => i.source === 'espn' && i.url !== 'https://x.com/a')
    expect(espn.length).toBeGreaterThan(0)
    expect(espn.every(i => i.leagues.includes('PL'))).toBe(true)
  })

  it('robô em dia: não busca a ESPN', async () => {
    const calls: string[] = []
    const f = await loadNews({ fetch: fake(file([], '2026-11-20T11:00:00.000Z'), calls), now })
    expect(calls).toHaveLength(1)
    expect(f.live_at).toBeUndefined()
  })

  it('ESPN fora do ar: devolve o arquivo do robô sem erro', async () => {
    const robot = file([], old)
    const f = await loadNews({ fetch: async (u: string) => { if (u === NEWS_URL) return robot; throw new Error('500') }, now })
    expect(f).toEqual(robot)
  })

  it('newsAge avisa quando a ESPN veio direto', () => {
    const f = { ...file([], old), live_at: now.toISOString() }
    expect(newsAge(f, now)).toMatchObject({ stale: true, live: true })
    expect(newsAge(file([], old), now).live).toBe(false)
  })
})
