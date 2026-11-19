/* Classificação das ligas (tabelas), direto da ESPN. */
import type { Sport } from '../types'
import { ESPN_STANDINGS, fetchJson, type Fetcher } from './client'
import { league } from './leagues'
import { parseStandings } from './parse'
import { setCachedRanks } from './store'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface StandingRow {
  teamId: string
  name: string
  logo: string | null
  rank: number
  cells: Record<string, string>
  zone: { color: string; label: string } | null
}
export interface StandingGroup { name: string; rows: StandingRow[] }
export type StandingsLevel = 'conference' | 'division'

export const STANDING_COLUMNS: Record<Sport, { key: string; label: string }[]> = {
  soccer: [
    { key: 'gamesPlayed', label: 'J' }, { key: 'wins', label: 'V' }, { key: 'ties', label: 'E' },
    { key: 'losses', label: 'D' }, { key: 'pointsFor', label: 'GP' }, { key: 'pointsAgainst', label: 'GC' },
    { key: 'pointDifferential', label: 'SG' }, { key: 'points', label: 'Pts' },
  ],
  basketball: [
    { key: 'wins', label: 'V' }, { key: 'losses', label: 'D' }, { key: 'winPercent', label: '%' },
    { key: 'gamesBehind', label: 'GB' }, { key: 'streak', label: 'Seq' },
  ],
  football: [
    { key: 'wins', label: 'V' }, { key: 'losses', label: 'D' }, { key: 'ties', label: 'E' },
    { key: 'winPercent', label: '%' }, { key: 'streak', label: 'Seq' },
  ],
}

const RANK_STAT: Record<Sport, string> = { soccer: 'rank', basketball: 'playoffSeed', football: 'playoffSeed' }

function parseRows(sport: Sport, entries: any[]): StandingRow[] {
  const rows: (StandingRow & { order: number })[] = []
  entries.forEach((e, order) => {
    const id = e?.team?.id
    if (id == null) return
    const cells: Record<string, string> = {}
    let rank = NaN
    for (const s of e.stats ?? []) {
      if (!s?.name) continue
      if (s.displayValue != null) cells[s.name] = String(s.displayValue)
      if (s.name === RANK_STAT[sport]) rank = Math.trunc(Number(s.value ?? s.displayValue))
    }
    const note = e.note
    rows.push({
      teamId: String(id),
      name: e.team.displayName ?? e.team.name ?? '',
      logo: e.team.logos?.[0]?.href ?? e.team.logo ?? null,
      rank: Number.isNaN(rank) ? order + 1 : rank,
      cells,
      zone: note?.color && note?.description ? { color: note.color, label: note.description } : null,
      order,
    })
  })
  rows.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return rows.map(({ order: _o, ...r }) => r)
}

export function parseStandingsTable(sport: Sport, payload: unknown): StandingGroup[] {
  const groups: StandingGroup[] = []
  const walk = (node: any, depth: number) => {
    const entries = node?.standings?.entries
    if (Array.isArray(entries) && entries.length) {
      let rows = parseRows(sport, entries)
      // Divisão: a ESPN manda só o seed da conferência; a posição na divisão segue esse seed.
      if (depth > 0) rows = rows.map((r, i) => ({ ...r, rank: i + 1 }))
      groups.push({ name: node.name ?? '', rows })
      return
    }
    for (const child of node?.children ?? []) walk(child, depth + 1)
  }
  for (const child of (payload as any)?.children ?? []) walk(child, 0)
  return groups
}

const TTL = 10 * 60 * 1000
const cache = new Map<string, { at: number; groups: StandingGroup[] }>()

/** Só para testes. */
export function _resetStandingsCache(): void { cache.clear() }

export async function loadStandings(
  leagueKey: string, level: StandingsLevel = 'conference', opts: { fetch?: Fetcher; now?: Date } = {},
): Promise<StandingGroup[]> {
  const lg = league(leagueKey)
  const now = opts.now ?? new Date()
  const useLevel = level === 'division' && lg.sport !== 'soccer'
  const key = `${lg.key}:${useLevel ? 'division' : 'conference'}`
  const hit = cache.get(key)
  if (hit && now.getTime() - hit.at < TTL) return hit.groups
  const payload = await (opts.fetch ?? fetchJson)(`${ESPN_STANDINGS}/${lg.path}/standings${useLevel ? '?level=3' : ''}`)
  const groups = parseStandingsTable(lg.sport, payload)
  cache.set(key, { at: now.getTime(), groups })
  if (lg.sport === 'soccer') setCachedRanks(lg.key, parseStandings(payload), now)
  return groups
}
