import { addDays } from '../lib/dates'
import { localToday } from '../lib/dates'
import { needsFastPoll } from '../lib/games'
import type { Game, GamesResponse, SyncError } from '../types'
import { ESPN_SITE, ESPN_STANDINGS, fetchJson, type Fetcher } from './client'
import { LEAGUES, type EspnLeague } from './leagues'
import { parseScoreboard, parseStandings } from './parse'
import { getCachedRanks, getFavorites, setCachedRanks } from './store'

export interface LoadOpts {
  leagues?: string[]
  fetch?: Fetcher
  now?: Date
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
const compact = (day: string) => day.split('-').join('')

async function ranksFor(lg: EspnLeague, get: Fetcher, now: Date): Promise<Record<string, number>> {
  if (lg.sport !== 'soccer') return {}
  const cached = getCachedRanks(lg.key, now)
  if (cached) return cached
  try {
    const ranks = parseStandings(await get(`${ESPN_STANDINGS}/${lg.path}/standings`))
    setCachedRanks(lg.key, ranks, now)
    return ranks
  } catch {
    return {} // sem classificação: a posição só não aparece; o placar continua valendo
  }
}

async function loadLeague(lg: EspnLeague, day: string, get: Fetcher, now: Date): Promise<Game[]> {
  // A ESPN agrupa pelo dia dos EUA, atrasado em relação a Brasília: buscar D-1 e D.
  const payloads = await Promise.all([addDays(day, -1), day].map(d =>
    get(`${ESPN_SITE}/${lg.path}/scoreboard?dates=${compact(d)}`)))
  const ranks = await ranksFor(lg, get, now)
  const byId = new Map<string, Game>()
  for (const p of payloads) for (const g of parseScoreboard(lg, p)) byId.set(g.id, g)
  return [...byId.values()]
    .filter(g => localToday(new Date(g.start_utc)) === day)
    .map(g => ({
      ...g,
      home: { ...g.home, rank: ranks[g.home.team_id] ?? null },
      away: { ...g.away, rank: ranks[g.away.team_id] ?? null },
    }))
}

function applyFavorites(games: Game[]): Game[] {
  const favs = getFavorites()
  return games.map(g => ({
    ...g,
    home: { ...g.home, favorite: favs.has(`${g.sport}:${g.home.team_id}`) },
    away: { ...g.away, favorite: favs.has(`${g.sport}:${g.away.team_id}`) },
  }))
}

const byStart = (a: Game, b: Game) => a.start_utc.localeCompare(b.start_utc) || a.league.localeCompare(b.league)

/** Jogos de um dia (Brasília) das ligas pedidas, buscados direto na ESPN. */
export async function loadDay(day: string, opts: LoadOpts = {}): Promise<GamesResponse> {
  const get = opts.fetch ?? fetchJson
  const now = opts.now ?? new Date()
  const leagues = LEAGUES.filter(l => !opts.leagues || opts.leagues.includes(l.key))
  const results = await Promise.allSettled(leagues.map(l => loadLeague(l, day, get, now)))
  const games: Game[] = []
  const errors: SyncError[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') games.push(...r.value)
    else errors.push({ league: leagues[i].key, message: (r.reason as Error)?.message ?? 'falha', at: iso(now) })
  })
  return { date: day, games: applyFavorites(games).sort(byStart), updated_at: iso(now), stale: errors.length > 0, errors }
}

/** Atualização rápida: rebusca só as ligas com jogo em andamento e mescla com o que já está na tela. */
export async function refreshLive(prev: GamesResponse, opts: LoadOpts = {}): Promise<GamesResponse> {
  const now = opts.now ?? new Date()
  const live = [...new Set(prev.games.filter(g => needsFastPoll([g], now)).map(g => g.league))]
  if (live.length === 0) return prev
  const fresh = await loadDay(prev.date, { ...opts, now, leagues: live })
  const failed = new Set(fresh.errors.map(e => e.league))
  const kept = prev.games.filter(g => !live.includes(g.league) || failed.has(g.league))
  const errors = [...prev.errors.filter(e => !live.includes(e.league)), ...fresh.errors]
  return { ...prev, games: [...kept, ...fresh.games].sort(byStart), updated_at: fresh.updated_at,
    stale: errors.length > 0, errors }
}

/** Reaplica os favoritos (após marcar/desmarcar) sem buscar de novo. */
export function withFavorites(r: GamesResponse): GamesResponse {
  return { ...r, games: applyFavorites(r.games) }
}
