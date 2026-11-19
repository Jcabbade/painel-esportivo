/* Leitores das fontes de notícias. Só funções puras: recebem o corpo da resposta e devolvem NewsItem[]. */
import { XMLParser } from 'fast-xml-parser'
import { league as leagueOf } from '../espn/leagues'
import type { Sport } from '../types'
import { PLACAR_SECTIONS } from './sources'
import { matchTeams, type TeamIndex } from './teams'
import type { NewsItem, SourceId } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ParseCtx { index: TeamIndex; league?: string }

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
}

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** HTML → texto puro numa linha, cortado em `max` (com reticências). */
export function toText(html: string, max = 280): string {
  const t = decode(String(html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

const TRACKING = /^(utm_.*|fbclid|gclid)$/i
const PLACAR_TRACKING = new Set(['source', 'media', 'content'])

/** Só http(s); tira parâmetros de rastreio. */
export function normalizeUrl(url: string): string | null {
  let u: URL
  try { u = new URL(String(url).trim()) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  for (const k of [...u.searchParams.keys()]) {
    if (TRACKING.test(k) || (u.hostname.endsWith('placar.com.br') && PLACAR_TRACKING.has(k))) u.searchParams.delete(k)
  }
  u.hash = ''
  return u.toString().replace(/\?$/, '')
}

function iso(date: unknown): string | null {
  const ms = Date.parse(String(date ?? ''))
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

function item(source: SourceId, f: {
  title: string; summary?: string; url: unknown; image?: unknown; published: unknown
  video?: boolean; leagues?: string[]; teams?: string[]
}): NewsItem | null {
  const url = normalizeUrl(String(f.url ?? ''))
  const published = iso(f.published)
  const title = toText(f.title, 200)
  if (!url || !published || !title) return null
  const image = f.image ? normalizeUrl(String(f.image)) : null
  return {
    id: url, source, title, summary: toText(f.summary ?? '', 280), url, image, published,
    video: !!f.video, leagues: f.leagues ?? [], teams: [...new Set(f.teams ?? [])],
  }
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, trimValues: true })
const arr = <T>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x])
const txt = (x: any): string => (x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x))

function rssItems(body: string): any[] {
  const doc = xml.parse(body)
  return arr(doc?.rss?.channel?.item)
}

function rssImage(it: any): string | null {
  for (const m of [...arr(it['media:content']), ...arr(it['media:thumbnail']), ...arr(it.enclosure)]) {
    const url = m?.['@_url']
    const type = String(m?.['@_type'] ?? m?.['@_medium'] ?? 'image')
    if (url && /image/.test(type)) return url
  }
  const html = txt(it['content:encoded']) || txt(it.description)
  return /<img[^>]+src="([^"]+)"/i.exec(html)?.[1] ?? null
}

type Rule = { keep: boolean; leagues: string[]; sport?: Sport; strict?: boolean }

function parseRss(source: SourceId, body: string, ctx: ParseCtx, rule: (url: string, text: string) => Rule): NewsItem[] {
  const out: NewsItem[] = []
  for (const it of rssItems(body)) {
    try {
    const title = txt(it.title)
    const summary = txt(it.description) || txt(it['content:encoded'])
    const url = normalizeUrl(txt(it.link))
    if (!url) continue
    const text = `${toText(title)} ${toText(summary)}`
    const r = rule(url, text)
    if (!r.keep) continue
    const teams = matchTeams(text, ctx.index, r.sport, { strict: r.strict })
    const n = item(source, { title, summary, url, image: rssImage(it), published: txt(it.pubDate), leagues: r.leagues, teams })
    if (n) out.push(n)
    } catch (e) {
      console.warn(`[noticias] item de ${source} ignorado:`, e) // um item ruim não derruba a fonte
    }
  }
  return out
}

function parseEspn(body: unknown, ctx: ParseCtx): NewsItem[] {
  const lg = ctx.league ? leagueOf(ctx.league) : null
  const out: NewsItem[] = []
  for (const a of (body as any)?.articles ?? []) {
    try {
      const tagged = (a.categories ?? [])
        .filter((c: any) => c?.type === 'team' && c.teamId != null && lg)
        .map((c: any) => `${lg!.sport}:${c.teamId}`)
      const text = `${a.headline ?? ''} ${a.description ?? ''}`
      const n = item('espn', {
        title: a.headline ?? '', summary: a.description ?? '', url: a.links?.web?.href,
        image: a.images?.[0]?.url, published: a.published,
        video: a.type === 'Media', leagues: lg ? [lg.key] : [],
        teams: [...tagged, ...matchTeams(text, ctx.index, lg?.sport, { strict: true })],
      })
      if (n) out.push(n)
    } catch (e) {
      console.warn('[noticias] item ESPN ignorado:', e)
    }
  }
  return out
}

function parseTelegram(body: string, ctx: ParseCtx): NewsItem[] {
  const out: NewsItem[] = []
  for (const b of body.split('class="tgme_widget_message_wrap').slice(1)) {
    try {
    const post = /data-post="([\w]+\/\d+)"/.exec(b)?.[1]
    const time = /<time[^>]*datetime="([^"]+)"/.exec(b)?.[1]
    const html = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(b)?.[1]
    if (!post || !time || !html) continue
    const lines = html.split(/<br\s*\/?>/i).map(l => toText(l, 1000)).filter(Boolean)
    if (!lines.length || /^\W*new youtube video uploaded/i.test(lines[0])) continue
    const photo = /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/.exec(b)?.[1] ?? null
    const full = lines.join(' ')
    const n = item('fabrizio_tg', {
      // Primeira linha longa: o título é cortado, então o resumo começa pelo texto todo.
      title: toText(lines[0], 120), summary: lines[0].length > 120 ? full : lines.slice(1).join(' '),
      url: `https://t.me/${post}`,
      image: photo, published: time, video: /tgme_widget_message_video/.test(b),
      teams: matchTeams(full, ctx.index, 'soccer'), // Fabrizio cobre futebol: "Eagles"/"Saints" não viram NFL
    })
    if (n) out.push(n)
    } catch (e) {
      console.warn('[noticias] post do Telegram ignorado:', e)
    }
  }
  return out
}

function parseYouTube(body: string, ctx: ParseCtx): NewsItem[] {
  const doc = xml.parse(body)
  const out: NewsItem[] = []
  for (const e of arr(doc?.feed?.entry)) {
    try {
    const g = e['media:group'] ?? {}
    const title = txt(e.title)
    const summary = txt(g['media:description'])
    const n = item('fabrizio_yt', {
      title, summary, url: arr(e.link)[0]?.['@_href'], image: g['media:thumbnail']?.['@_url'],
      published: txt(e.published), video: true, teams: matchTeams(title, ctx.index, 'soccer'),
    })
    if (n) out.push(n)
    } catch (err) {
      console.warn('[noticias] vídeo do YouTube ignorado:', err)
    }
  }
  return out
}

function placarRule(url: string, text: string, index: TeamIndex) {
  const section = new URL(url).pathname.split('/')[1] ?? ''
  if (!(section in PLACAR_SECTIONS)) return { keep: false, leagues: [] }
  const lg = PLACAR_SECTIONS[section]
  const sport: Sport = lg === 'NBA' ? 'basketball' : lg === 'NFL' ? 'football' : 'soccer'
  if (lg) return { keep: true, leagues: [lg], sport }
  return { keep: matchTeams(text, index, 'soccer', { strict: true }).length > 0, leagues: [], sport, strict: true }
}

export function parseSource(id: SourceId, body: unknown, ctx: ParseCtx): NewsItem[] {
  switch (id) {
    case 'espn': return parseEspn(body, ctx)
    case 'fabrizio_tg': return parseTelegram(String(body), ctx)
    case 'fabrizio_yt': return parseYouTube(String(body), ctx)
    case 'hoops':
    case 'jumper': return parseRss(id, String(body), ctx, () => ({ keep: true, leagues: ['NBA'], sport: 'basketball' }))
    case 'placar': return parseRss(id, String(body), ctx, (url, text) => placarRule(url, text, ctx.index))
    case 'ge': return parseRss(id, String(body), ctx, (_url, text) =>
      ({ keep: matchTeams(text, ctx.index, 'soccer', { strict: true }).length > 0, leagues: [], sport: 'soccer', strict: true }))
  }
}
