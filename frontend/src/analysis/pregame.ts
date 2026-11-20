/* Pré-jogo: jogos recentes de um time, comparativo de médias e "oportunidades". Funções puras. */
import { league as leagueOf } from '../espn/leagues'
import type { GameRecord, LeagueFile } from '../history/types'
import { defaultLine, metricsFor, sideValue, type Side } from '../rankings/metrics'
import type { Sport } from '../types'

export type Venue = 'all' | 'home' | 'away'
export interface TeamGame { g: GameRecord; side: Side; league: string; sport: Sport }

const r2 = (n: number) => Math.round(n * 100) / 100
const avg = (v: number[]) => (v.length ? r2(v.reduce((s, x) => s + x, 0) / v.length) : null)
const other = (s: Side): Side => (s === 'h' ? 'a' : 'h')

/** Jogos do time (mais recentes primeiro), em todas as ligas recebidas. */
/** `before` (ISO): só jogos que começaram antes (pré-jogo de um jogo passado não vê o futuro). */
export function teamGames(files: LeagueFile[], teamId: string, opts: { venue: Venue; last: number; before?: string }): TeamGame[] {
  const out: TeamGame[] = []
  for (const f of files) {
    const sport = leagueOf(f.league).sport
    for (const g of f.games) {
      if (opts.before && g.date >= opts.before) continue
      if (g.h === teamId && opts.venue !== 'away') out.push({ g, side: 'h', league: f.league, sport })
      else if (g.a === teamId && opts.venue !== 'home') out.push({ g, side: 'a', league: f.league, sport })
    }
  }
  return out.sort((x, y) => y.g.date.localeCompare(x.g.date)).slice(0, opts.last)
}

const countMetrics = (sport: Sport) => metricsFor(sport).filter(m => m.kind === 'count')

export interface CompareRow {
  metric: string
  label: string
  home: { for: number | null; against: number | null; n: number }
  away: { for: number | null; against: number | null; n: number }
}

export function compare(files: LeagueFile[], homeId: string, awayId: string, sport: Sport,
  opts: { last: number; venueSplit: boolean; before?: string }): CompareRow[] {
  const side = (id: string, venue: Venue) => {
    const games = teamGames(files, id, { venue: opts.venueSplit ? venue : 'all', last: opts.last, before: opts.before })
    return (m: ReturnType<typeof countMetrics>[number]) => {
      const fr: number[] = [], ag: number[] = []
      for (const e of games) {
        const a = sideValue(e.g, e.side, m, 'full', e.sport), b = sideValue(e.g, other(e.side), m, 'full', e.sport)
        if (a !== null && b !== null) { fr.push(a); ag.push(b) }
      }
      return { for: avg(fr), against: avg(ag), n: fr.length }
    }
  }
  const h = side(homeId, 'home'), a = side(awayId, 'away')
  return countMetrics(sport).map(m => ({ metric: m.id, label: m.label, home: h(m), away: a(m) }))
}

export interface Opportunity { metric: string; label: string; kind: 'over' | 'under'; line: number; hits: number; n: number; avg: number }

/** Estatísticas (feitos) em que o time mais bateu a linha nos últimos jogos: ≥ 70% e ≥ 5 jogos. */
export function opportunities(files: LeagueFile[], teamId: string, sport: Sport,
  opts: { last: number; venue: Venue; before?: string }): Opportunity[] {
  const games = teamGames(files, teamId, { venue: opts.venue, last: opts.last, before: opts.before })
  const out: Opportunity[] = []
  for (const m of countMetrics(sport)) {
    const vals = games.map(e => sideValue(e.g, e.side, m, 'full', e.sport)).filter((v): v is number => v !== null)
    if (vals.length < 5) continue
    const line = Math.floor(defaultLine(m, sport, 'full') / 2) + 0.5
    const over = vals.filter(v => v > line).length, under = vals.filter(v => v < line).length
    const best = over >= under ? { kind: 'over' as const, hits: over } : { kind: 'under' as const, hits: under }
    if (best.hits / vals.length < 0.7) continue
    out.push({ metric: m.id, label: m.label, ...best, line, n: vals.length, avg: avg(vals)! })
  }
  return out.sort((a, b) => b.hits / b.n - a.hits / a.n || b.n - a.n).slice(0, 5)
}
