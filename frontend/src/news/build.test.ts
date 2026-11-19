import { describe, expect, it } from 'vitest'
import { buildNews } from './build'
import type { NewsItem, SourceId } from './types'

const now = new Date('2026-11-19T21:00:00Z')
const mk = (source: SourceId, url: string, published: string): NewsItem => ({
  id: url, source, title: url, summary: '', url, image: null, published, video: false, leagues: [], teams: [],
})

describe('buildNews', () => {
  it('dedupes by normalized url', () => {
    const first = buildNews(null, [{ id: 'placar', items: [mk('placar', 'https://p.com/a', '2026-11-19T20:00:00.000Z')] }], now)
    const second = buildNews(first, [{ id: 'placar', items: [mk('placar', 'https://p.com/a', '2026-11-19T20:00:00.000Z')] }], now)
    expect(second.items).toHaveLength(1)
  })

  it('same article in two leagues keeps both tags', () => {
    const a = { ...mk('espn', 'https://e.com/x', '2026-11-19T20:00:00.000Z'), leagues: ['PL'], teams: ['soccer:360'] }
    const b = { ...mk('espn', 'https://e.com/x', '2026-11-19T20:00:00.000Z'), leagues: ['UCL'], teams: ['soccer:86'] }
    const f = buildNews(null, [{ id: 'espn', items: [a, b] }], now)
    expect(f.items).toHaveLength(1)
    expect(f.items[0].leagues).toEqual(['PL', 'UCL'])
    expect(f.items[0].teams).toEqual(['soccer:360', 'soccer:86'])
  })

  it('failed source keeps previous items', () => {
    const prev = buildNews(null, [{
      id: 'placar', items: ['a', 'b', 'c'].map(x => mk('placar', `https://p.com/${x}`, '2026-11-19T19:00:00.000Z')),
    }], new Date('2026-11-19T20:00:00Z'))
    const next = buildNews(prev, [{ id: 'placar', error: 'ESPN respondeu 500' }, { id: 'hoops', items: [] }], now)
    expect(next.items.filter(i => i.source === 'placar')).toHaveLength(3)
    expect(next.sources.placar).toMatchObject({ ok: false, error: 'ESPN respondeu 500', last_ok: '2026-11-19T20:00:00.000Z' })
    expect(next.sources.hoops).toMatchObject({ ok: true, error: null, last_ok: now.toISOString(), count: 0 })
    expect(next.sources.placar.name).toBe('Placar')
  })

  it('source that succeeds replaces nothing but adds new items', () => {
    const prev = buildNews(null, [{ id: 'ge', items: [mk('ge', 'https://g.com/old', '2026-11-18T10:00:00.000Z')] }], now)
    const next = buildNews(prev, [{ id: 'ge', items: [mk('ge', 'https://g.com/new', '2026-11-19T10:00:00.000Z')] }], now)
    expect(next.items.map(i => i.url)).toEqual(['https://g.com/new', 'https://g.com/old'])
    expect(next.sources.ge.count).toBe(2)
  })

  it('drops items older than 7 days and caps 400', () => {
    const old = mk('ge', 'https://g.com/velho', '2026-11-12T20:59:00.000Z')
    const many = Array.from({ length: 450 }, (_, i) =>
      mk('espn', `https://e.com/${i}`, new Date(now.getTime() - i * 60_000).toISOString()))
    const f = buildNews(null, [{ id: 'ge', items: [old] }, { id: 'espn', items: many }], now)
    expect(f.items.some(i => i.url === old.url)).toBe(false)
    expect(f.items).toHaveLength(400)
  })

  it('sorted newest first', () => {
    const f = buildNews(null, [{
      id: 'hoops', items: [mk('hoops', 'https://h.com/1', '2026-11-19T10:00:00.000Z'), mk('hoops', 'https://h.com/2', '2026-11-19T12:00:00.000Z')],
    }], now)
    expect(f.items.map(i => i.url)).toEqual(['https://h.com/2', 'https://h.com/1'])
    expect(f.updated_at).toBe(now.toISOString())
  })
})
