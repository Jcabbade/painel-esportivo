/* Interpreta o summary da ESPN (detalhe de um jogo). Só reorganiza o que veio; nada é calculado. */
import type { Game, Sport } from '../types'
import type {
  Aggregate, GameDetail, H2H, Lineup, LineupPlayer, SoccerEvent, SoccerEventKind, StatRow,
} from './detailTypes'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Estatísticas mostradas, na ordem, com o texto em português. */
const STAT_LABELS: Record<Sport, [string, string][]> = {
  soccer: [
    ['possessionPct', 'Posse de bola (%)'], ['totalShots', 'Finalizações'], ['shotsOnTarget', 'No alvo'],
    ['wonCorners', 'Escanteios'], ['foulsCommitted', 'Faltas'], ['yellowCards', 'Cartões amarelos'],
    ['redCards', 'Cartões vermelhos'], ['offsides', 'Impedimentos'], ['saves', 'Defesas'],
    ['totalPasses', 'Passes'], ['accuratePasses', 'Passes certos'], ['totalTackles', 'Desarmes'],
    ['interceptions', 'Interceptações'],
  ],
  basketball: [],
  football: [],
}

const EVENT_KINDS: Record<string, SoccerEventKind> = {
  'goal': 'goal',
  'penalty---scored': 'penalty_goal',
  'own-goal': 'own_goal',
  'penalty---missed': 'penalty_miss',
  'penalty---saved': 'penalty_miss',
  'yellow-card': 'yellow',
  'red-card': 'red',
  'yellow-red-card': 'red',
  'substitution': 'sub',
  'halftime': 'halftime',
}

type SideKey = 'home' | 'away'

function sideOf(game: Game, teamId: unknown): SideKey | null {
  if (teamId == null) return null
  const id = String(teamId)
  if (id === game.home.team_id) return 'home'
  if (id === game.away.team_id) return 'away'
  return null
}

function warn(what: string, e: unknown) {
  console.warn(`[painel] ${what} ignorado:`, e)
}

function parseStats(game: Game, payload: any): StatRow[] {
  if (game.status !== 'live' && game.status !== 'final') return []
  const bySide: Partial<Record<SideKey, Map<string, string>>> = {}
  for (const t of payload?.boxscore?.teams ?? []) {
    const s = sideOf(game, t?.team?.id)
    if (!s) continue
    bySide[s] = new Map((t.statistics ?? []).map((x: any) => [x?.name, x?.displayValue]))
  }
  const { home, away } = bySide
  if (!home || !away) return []
  const rows: StatRow[] = []
  for (const [name, label] of STAT_LABELS[game.sport]) {
    const h = home.get(name), a = away.get(name)
    if (h != null && a != null && h !== '' && a !== '') rows.push({ label, home: String(h), away: String(a) })
  }
  return rows
}

function parseEvents(game: Game, payload: any): SoccerEvent[] {
  const out: SoccerEvent[] = []
  for (const ev of payload?.keyEvents ?? []) {
    try {
      const kind = EVENT_KINDS[ev?.type?.type]
      if (!kind) continue
      const names: string[] = (ev.participants ?? []).map((p: any) => p?.athlete?.displayName).filter(Boolean)
      out.push({
        minute: ev.clock?.displayValue ?? '',
        kind,
        side: kind === 'halftime' ? null : sideOf(game, ev.team?.id),
        player: names[0] ?? null,
        playerOut: kind === 'sub' ? names[1] ?? null : null,
      })
    } catch (e) {
      warn('lance', e)
    }
  }
  return out
}

function parseLineups(game: Game, payload: any): { home: Lineup; away: Lineup } | null {
  const res: Partial<Record<SideKey, Lineup>> = {}
  for (const r of payload?.rosters ?? []) {
    const s: SideKey | null = r?.homeAway === 'home' || r?.homeAway === 'away' ? r.homeAway : sideOf(game, r?.team?.id)
    if (!s) continue
    const starters: LineupPlayer[] = [], bench: LineupPlayer[] = []
    for (const p of r.roster ?? []) {
      const name = p?.athlete?.displayName
      if (!name) continue
      const pl: LineupPlayer = {
        name, number: p.jersey ?? null, position: p.position?.abbreviation ?? null,
        subbedIn: !!p.subbedIn, subbedOut: !!p.subbedOut,
      }
      ;(p.starter ? starters : bench).push(pl)
    }
    if (starters.length) res[s] = { formation: r.formation ?? null, starters, bench }
  }
  return res.home && res.away ? { home: res.home, away: res.away } : null
}

function score(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Math.trunc(Number(v))
  return Number.isNaN(n) ? null : n
}

function parseH2H(payload: any): H2H | null {
  const s = payload?.seasonseries?.[0]
  if (!s) return null
  const games = []
  for (const ev of s.events ?? []) {
    try {
      const c = (ha: string) => ev.competitors.find((x: any) => x?.homeAway === ha)
      const h = c('home'), a = c('away')
      if (!h || !a) continue
      const played = (ev.statusType?.state ?? ev.status) === 'post'
      games.push({
        date: ev.date,
        home: h.team?.displayName ?? h.team?.abbreviation ?? '',
        away: a.team?.displayName ?? a.team?.abbreviation ?? '',
        homeScore: played ? score(h.score) : null,
        awayScore: played ? score(a.score) : null,
      })
    } catch (e) {
      warn('confronto', e)
    }
  }
  return games.length ? { summary: s.summary ?? null, games } : null
}

const LEGS: Record<string, string> = { '1st Leg': '1º jogo', '2nd Leg': '2º jogo' }

function parseAggregate(payload: any): Aggregate | null {
  const comp = payload?.header?.competitions?.[0]
  const c = (ha: string) => comp?.competitors?.find((x: any) => x?.homeAway === ha)
  const h = score(c('home')?.aggregateScore), a = score(c('away')?.aggregateScore)
  if (h === null || a === null) return null
  const leg = comp.leg?.displayValue ?? null
  const series = Array.isArray(comp.series) ? comp.series[0] : comp.series
  return { leg: leg ? LEGS[leg] ?? leg : null, round: series?.title ?? null, home: h, away: a }
}

export function parseSummary(game: Game, payload: unknown): GameDetail {
  const p = payload as any
  const attendance = score(p?.gameInfo?.attendance)
  return {
    stats: parseStats(game, p),
    events: game.sport === 'soccer' ? parseEvents(game, p) : [],
    lineups: game.sport === 'soccer' ? parseLineups(game, p) : null,
    periods: null,
    box: null,
    h2h: parseH2H(p),
    aggregate: parseAggregate(p),
    attendance: attendance && attendance > 0 ? attendance : null,
  }
}
