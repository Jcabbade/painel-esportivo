/* Notícias no navegador: lê o news.json do robô e filtra por favoritos e por jogo. */
import type { Fetcher } from '../espn/client'
import { fetchJson } from '../espn/client'
import { addDays, localToday } from '../lib/dates'
import type { Game } from '../types'
import { buildNews } from './build'
import { fetchLiveEspn } from './live'
import type { NewsFile, NewsItem } from './types'

export const NEWS_URL: string = import.meta.env.VITE_NEWS_URL
  ?? 'https://raw.githubusercontent.com/Jcabbade/painel-esportivo/news/news.json'

const TTL = 5 * 60 * 1000
const STALE_AFTER = 3 * 3600 * 1000
let cache: { at: number; file: NewsFile } | null = null

/** Só para testes. */
export function _resetNewsCache(): void { cache = null }

export async function loadNews(opts: { fetch?: Fetcher; now?: Date } = {}): Promise<NewsFile> {
  const now = (opts.now ?? new Date()).getTime()
  if (cache && now - cache.at < TTL) return cache.file
  const fetch = opts.fetch ?? fetchJson
  let file = await fetch(NEWS_URL) as NewsFile
  if (!file || !Array.isArray(file.items)) throw new Error('arquivo de notícias inválido')
  if (now - Date.parse(file.updated_at) > STALE_AFTER) {
    // Robô parado: completa com a ESPN buscada agora; o horário do robô fica, para o aviso continuar certo.
    try {
      const items = await fetchLiveEspn(fetch)
      const at = new Date(now)
      file = { ...buildNews(file, [{ id: 'espn', items }], at), updated_at: file.updated_at, live_at: at.toISOString() }
    } catch (e) { console.warn('[noticias] ESPN direto falhou:', e) }
  }
  cache = { at: now, file }
  return file
}

const newest = (a: NewsItem, b: NewsItem) => b.published.localeCompare(a.published)

export function newsForTeams(file: NewsFile, keys: Set<string>, limit = Infinity): NewsItem[] {
  if (!keys.size) return []
  return file.items.filter(i => i.teams.some(t => keys.has(t))).sort(newest).slice(0, limit)
}

export function newsForGame(file: NewsFile, game: Game, limit = 6): NewsItem[] {
  return newsForTeams(file, new Set([`${game.sport}:${game.home.team_id}`, `${game.sport}:${game.away.team_id}`]), limit)
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })

export function relativeTime(iso: string, now: Date): string {
  const t = new Date(iso)
  const diff = now.getTime() - t.getTime()
  if (diff < 60_000) return 'agora'
  if (diff < 3600_000) return `há ${Math.floor(diff / 60_000)} min`
  const today = localToday(now), day = localToday(t)
  if (day === today) return `há ${Math.floor(diff / 3600_000)} h`
  if (day === addDays(today, -1)) return 'ontem'
  return dayMonth.format(t)
}

export function newsAge(file: NewsFile, now: Date): { label: string; stale: boolean; live: boolean } {
  const rel = relativeTime(file.updated_at, now)
  const label = rel === 'agora' ? 'atualizado agora'
    : rel.startsWith('há') || rel === 'ontem' ? `atualizado ${rel}` : `atualizado em ${rel}`
  return { label, stale: now.getTime() - Date.parse(file.updated_at) > STALE_AFTER, live: !!file.live_at }
}
