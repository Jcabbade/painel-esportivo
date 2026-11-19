/* Ficha compacta de um jogo encerrado, a partir do summary da ESPN. Só números que a ESPN mandou. */
import type { Game, Sport } from '../types'
import { cornerBuckets } from './players'
import type { GameRecord, LeagueFile } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Estatísticas guardadas: nome no boxscore da ESPN → chave na ficha. Valor "a-b" → número antes do hífen. */
const STAT_KEYS: Record<Sport, [string, string][]> = {
  soccer: [
    ['wonCorners', 'wonCorners'], ['yellowCards', 'yellowCards'], ['redCards', 'redCards'],
    ['totalShots', 'totalShots'], ['shotsOnTarget', 'shotsOnTarget'], ['foulsCommitted', 'foulsCommitted'],
    ['offsides', 'offsides'],
  ],
  basketball: [
    ['totalRebounds', 'totalRebounds'], ['assists', 'assists'],
    ['threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'threePointFieldGoalsMade'],
  ],
  football: [['totalYards', 'totalYards'], ['turnovers', 'turnovers'], ['sacksYardsLost', 'sacksTaken']],
}

function num(v: unknown): number | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (s === '') return null
  const first = /^-?\d+(\.\d+)?/.exec(s)?.[0]
  if (first === undefined) return null
  const n = Number(first)
  return Number.isFinite(n) ? n : null
}

function isoUtc(value: unknown, fallback: string): string {
  const ms = Date.parse(String(value ?? ''))
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function toRecord(game: Game, summary: unknown): { record: GameRecord; teams: LeagueFile['teams'] } | null {
  if (game.status !== 'final') return null
  const p = summary as any
  const season = p?.header?.season
  if (game.sport !== 'soccer' && Number(season?.type) === 1) return null // pré-temporada
  const year = Number(season?.year)
  if (!Number.isInteger(year)) return null
  const comp = p?.header?.competitions?.[0]
  const sideOf = (ha: 'home' | 'away') => (comp?.competitors ?? []).find((c: any) => c?.homeAway === ha)
  const home = sideOf('home'), away = sideOf('away')
  if (!home || !away) return null
  if (String(home.team?.id) !== game.home.team_id || String(away.team?.id) !== game.away.team_id) return null
  const hs = num(home.score), as = num(away.score)
  if (hs === null || as === null) return null

  const periods = (c: any): number[] => {
    const vals = (c.linescores ?? []).map((l: any) => num(l?.displayValue ?? l?.value))
    return vals.every((v: number | null) => v !== null) ? vals as number[] : []
  }

  const st: GameRecord['st'] = { h: {}, a: {} }
  for (const t of p?.boxscore?.teams ?? []) {
    const id = String(t?.team?.id)
    const key = id === game.home.team_id ? 'h' : id === game.away.team_id ? 'a' : null
    if (!key) continue
    const byName = new Map((t.statistics ?? []).map((s: any) => [s?.name, s?.displayValue]))
    for (const [espn, mine] of STAT_KEYS[game.sport]) {
      const v = num(byName.get(espn))
      if (v !== null) st[key][mine] = v
    }
  }

  const team = (c: any) => ({
    name: c.team?.displayName ?? c.team?.name ?? '',
    abbrev: c.team?.abbreviation ?? '',
    logo: c.team?.logos?.[0]?.href ?? c.team?.logo ?? null,
  })

  const cb = game.sport === 'soccer'
    ? cornerBuckets(p, home.team?.displayName ?? '', away.team?.displayName ?? '') : null
  return {
    record: {
      id: String(game.id), date: isoUtc(comp?.date, game.start_utc), season: year,
      h: game.home.team_id, a: game.away.team_id, hs, as,
      hp: periods(home), ap: periods(away), st, ...(cb ? { cb } : {}),
    },
    teams: { [game.home.team_id]: team(home), [game.away.team_id]: team(away) },
  }
}
