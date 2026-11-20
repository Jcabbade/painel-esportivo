/* Agenda de um time favorito (último resultado e próximo jogo), da rota /teams/{id}/schedule da ESPN. */
import { ESPN_SITE, fetchJson, type Fetcher } from './client'
import { LEAGUES } from './leagues'
import type { Sport } from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TeamGame {
  id: string
  date: string
  live: boolean
  home: boolean
  league: string | null
  opponent: { id: string; name: string; logo: string | null }
  us: number | null
  them: number | null
  result: 'V' | 'E' | 'D' | null
}

export interface TeamSummary { name: string; logo: string | null; last: TeamGame | null; next: TeamGame | null }

const num = (s: any): number | null => {
  const v = typeof s === 'object' && s !== null ? s.value ?? s.displayValue : s
  const n = Number(v)
  return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n
}

function toGame(e: any, teamId: string): TeamGame | null {
  const c = e?.competitions?.[0]
  const me = c?.competitors?.find((t: any) => String(t?.team?.id) === teamId)
  const op = c?.competitors?.find((t: any) => String(t?.team?.id) !== teamId)
  if (!me || !op || !e.date) return null
  const state = c.status?.type?.state
  const done = state === 'post'
  const us = done ? num(me.score) : null, them = done ? num(op.score) : null
  return {
    id: String(e.id), date: e.date, live: state === 'in', home: me.homeAway === 'home',
    league: e.league?.abbreviation ?? e.league?.shortName ?? null,
    opponent: {
      id: String(op.team.id), name: op.team.shortDisplayName ?? op.team.displayName ?? '',
      logo: op.team.logos?.[0]?.href ?? op.team.logo ?? null,
    },
    us, them,
    result: us === null || them === null ? null : us > them ? 'V' : us < them ? 'D' : 'E',
  }
}

/** Junta as agendas (uma por liga/rota) e escolhe o último jogo encerrado e o próximo (ou o que está em andamento). */
export function summarizeSchedule(payloads: any[], teamId: string, now: Date): TeamSummary {
  const team = payloads.find(p => p?.team)?.team ?? {}
  const byId = new Map<string, { g: TeamGame; state: string }>()
  for (const p of payloads) {
    for (const e of p?.events ?? []) {
      const g = toGame(e, teamId)
      if (g) byId.set(g.id, { g, state: e.competitions[0].status?.type?.state ?? '' })
    }
  }
  const all = [...byId.values()]
  const past = all.filter(x => x.state === 'post').map(x => x.g).sort((a, b) => b.date.localeCompare(a.date))
  const ahead = all.filter(x => x.state === 'in' || (x.state === 'pre' && Date.parse(x.g.date) > now.getTime() - 4 * 3600_000))
    .map(x => x.g).sort((a, b) => Number(b.live) - Number(a.live) || a.date.localeCompare(b.date))
  return {
    name: team.displayName ?? '', logo: team.logo ?? team.logos?.[0]?.href ?? null,
    last: past[0] ?? null, next: ahead[0] ?? null,
  }
}

/** `key` = 'soccer:86'. Futebol: procura nas 5 ligas (passados e próximos); NBA/NFL: uma rota só. */
export async function loadFavoriteTeam(key: string, opts: { fetch?: Fetcher; now?: Date } = {}): Promise<TeamSummary> {
  const [sport, id] = key.split(':') as [Sport, string]
  const fetch = opts.fetch ?? fetchJson
  const urls = LEAGUES.filter(l => l.sport === sport).flatMap(l => {
    const base = `${ESPN_SITE}/${l.path}/teams/${id}/schedule`
    return sport === 'soccer' ? [base, `${base}?fixture=true`] : [base]
  })
  const got = (await Promise.all(urls.map(u => fetch(u).catch(() => null)))).filter(p => p && Array.isArray((p as any).events))
  if (!got.length) throw new Error('agenda do time indisponível')
  return summarizeSchedule(got, id, opts.now ?? new Date())
}
