/* Interpreta as respostas da ESPN. Mesmas regras de backend/painel/espn/parse.py. */
import type { Game, GameStatus, Side } from '../types'
import type { EspnLeague } from './leagues'

/* eslint-disable @typescript-eslint/no-explicit-any */
const POSTPONED = new Set(['STATUS_POSTPONED', 'STATUS_DELAYED', 'STATUS_SUSPENDED'])
const CANCELED = new Set(['STATUS_CANCELED', 'STATUS_ABANDONED', 'STATUS_FORFEIT'])

function status(t: any): GameStatus {
  if (t?.state === 'pre') return 'scheduled'
  if (t?.state === 'in') return 'live'
  if (POSTPONED.has(t?.name)) return 'postponed'
  if (CANCELED.has(t?.name)) return 'canceled'
  return 'final'
}

/** "2026-11-08T14:00Z" → "2026-11-08T14:00:00Z" */
function isoUtc(value: string): string {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`data inválida: ${value}`)
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function record(c: any): string | null {
  const recs: any[] = c.records ?? []
  const total = recs.find(r => r?.type === 'total' && r?.summary)
  return total?.summary ?? recs[0]?.summary ?? null
}

function side(c: any, withScore: boolean): Side {
  const t = c.team
  if (t?.id == null) throw new Error('time sem id')
  const raw = c.score
  const score = withScore && raw !== undefined && raw !== null && raw !== '' ? Math.trunc(Number(raw)) : null
  if (score !== null && Number.isNaN(score)) throw new Error(`placar inválido: ${raw}`)
  return {
    team_id: String(t.id),
    name: t.displayName ?? t.name ?? '',
    short_name: t.shortDisplayName ?? t.displayName ?? '',
    abbrev: t.abbreviation ?? '',
    logo: t.logo ?? null,
    score,
    record: record(c),
    rank: null,
    favorite: false,
  }
}

function parseEvent(league: EspnLeague, ev: any): Game {
  const comp = ev.competitions[0]
  const st = status(ev.status?.type)
  const withScore = st === 'live' || st === 'final'
  const sides: Record<string, Side> = {}
  for (const c of comp.competitors) sides[c.homeAway] = side(c, withScore)
  if (!sides.home || !sides.away) throw new Error('evento sem mandante/visitante')
  return {
    id: String(ev.id),
    league: league.key,
    sport: league.sport,
    start_utc: isoUtc(ev.date),
    status: st,
    status_detail: ev.status?.type?.shortDetail ?? ev.status?.type?.detail ?? '',
    venue: comp.venue?.fullName ?? null,
    home: sides.home,
    away: sides.away,
  }
}

/** Eventos em formato inesperado são ignorados (um evento ruim não derruba a liga). */
export function parseScoreboard(league: EspnLeague, payload: any): Game[] {
  const games: Game[] = []
  for (const ev of payload?.events ?? []) {
    try {
      games.push(parseEvent(league, ev))
    } catch (e) {
      console.warn(`[painel] evento ignorado em ${league.key}:`, e)
    }
  }
  return games
}

export function parseStandings(payload: any): Record<string, number> {
  const ranks: Record<string, number> = {}
  for (const child of payload?.children ?? []) {
    for (const entry of child?.standings?.entries ?? []) {
      const rank = (entry.stats ?? []).find((s: any) => s?.name === 'rank')
      if (rank?.value != null && entry.team?.id != null) ranks[String(entry.team.id)] = Math.trunc(rank.value)
    }
  }
  return ranks
}
