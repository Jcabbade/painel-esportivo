import { describe, expect, it } from 'vitest'
import { fixture, fixtureText } from '../espn/testFixtures'
import { parseSource, normalizeUrl, toText } from './parse'
import { buildTeamIndex } from './teams'

const index = buildTeamIndex([
  { league: 'PL', sport: 'soccer', payload: fixture('standings_PL.json') },
  { league: 'UCL', sport: 'soccer', payload: fixture('standings_UCL.json') },
  { league: 'NBA', sport: 'basketball', payload: fixture('standings_NBA.json') },
  { league: 'NFL', sport: 'football', payload: fixture('standings_NFL.json') },
])
const ctx = { index }

describe('parseSource', () => {
  it('espn items with team tags', () => {
    const items = parseSource('espn', fixture('news/espn_PL_pt.json'), { ...ctx, league: 'PL' })
    expect(items.length).toBeGreaterThan(10)
    for (const it of items) {
      expect(it.url).toMatch(/^https:\/\/www\.espn\.com\.br\//)
      expect(it.leagues).toEqual(['PL'])
    }
    const first = items.find(i => i.title.startsWith('Futuro do gol da Inglaterra'))!
    expect(first.teams).toEqual(expect.arrayContaining(['soccer:363', 'soccer:357']))
    expect(first.video).toBe(true)
    expect(first.image).toMatch(/^https:/)
  })

  it('telegram posts', () => {
    const items = parseSource('fabrizio_tg', fixtureText('news/fabrizio_tg.html'), ctx)
    expect(items.length).toBeGreaterThanOrEqual(10)
    for (const it of items) {
      expect(it.url).toMatch(/^https:\/\/t\.me\/FabrizioRomanoTG\/\d+$/)
      expect(Number.isNaN(Date.parse(it.published))).toBe(false)
      expect(it.title.length).toBeGreaterThan(0)
      expect(it.title.length).toBeLessThanOrEqual(120)
      expect(it.title).not.toContain('<')
    }
    expect(items.some(i => /New YouTube Video Uploaded/i.test(i.title))).toBe(false)
  })

  it('youtube entries', () => {
    const items = parseSource('fabrizio_yt', fixtureText('news/fabrizio_yt.xml'), ctx)
    expect(items).toHaveLength(15)
    expect(items.every(i => i.video && i.image?.startsWith('https://') && /^https:\/\/www\.youtube\.com\/(watch|shorts)/.test(i.url))).toBe(true)
  })

  it('hoops rss', () => {
    const items = parseSource('hoops', fixtureText('news/hoops.xml'), ctx)
    expect(items).toHaveLength(10)
    expect(items.every(i => i.leagues.join() === 'NBA')).toBe(true)
    const lillard = items.find(i => i.title.includes('Blazers'))
    expect(lillard?.teams.some(t => t.startsWith('basketball:'))).toBe(true)
  })

  it('placar sections', () => {
    const items = parseSource('placar', fixtureText('news/placar.xml'), ctx)
    expect(items.every(i => !i.url.includes('?'))).toBe(true)
    expect(items.some(i => i.url.includes('/brasileirao/'))).toBe(false)
    const pl = items.filter(i => i.url.includes('/campeonato-ingles/'))
    expect(pl.length).toBeGreaterThan(0)
    expect(pl.every(i => i.leagues.includes('PL'))).toBe(true)
    for (const i of items.filter(i => /\/(futebol-europeu|futebol-internacional|mercado-da-bola)\//.test(i.url)))
      expect(i.teams.length).toBeGreaterThan(0)
  })

  it('ge only covered teams', () => {
    const items = parseSource('ge', fixtureText('news/ge_futebol.xml'), ctx)
    expect(items.every(i => i.teams.length > 0 && i.teams.every(t => t.startsWith('soccer:')))).toBe(true)
  })

  it('jumper rss', () => {
    const items = parseSource('jumper', fixtureText('news/jumper.xml'), ctx)
    expect(items).toHaveLength(10)
  })

  it('sanitizes html and rejects non-http links', () => {
    const rss = (link: string) => `<?xml version="1.0"?><rss><channel><item><title>T &amp; t</title><link>${link}</link>
      <description><![CDATA[<script>alert(1)</script><b>Oi</b>]]></description><pubDate>Thu, 19 Nov 2026 20:37:00 +0000</pubDate></item></channel></rss>`
    const ok = parseSource('jumper', rss('https://x.com/a?utm_source=z&b=1'), ctx)
    expect(ok).toHaveLength(1)
    expect(ok[0].summary).toBe('Oi')
    expect(ok[0].title).toBe('T & t')
    expect(ok[0].url).toBe('https://x.com/a?b=1')
    expect(parseSource('jumper', rss('javascript:alert(1)'), ctx)).toEqual([])
  })
})

describe('helpers', () => {
  it('normalizeUrl', () => {
    expect(normalizeUrl('https://placar.com.br/x/y?source=mooh&media=tv&content=geral')).toBe('https://placar.com.br/x/y')
    expect(normalizeUrl('ftp://a')).toBeNull()
    expect(normalizeUrl('nada')).toBeNull()
  })
  it('toText', () => {
    expect(toText('<p>a&nbsp;b</p><br/>c', 280)).toBe('a b c')
    expect(toText('x'.repeat(300), 280)).toHaveLength(280)
  })
})
