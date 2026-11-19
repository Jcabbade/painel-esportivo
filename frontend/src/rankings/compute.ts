/* Rankings de ligas e times, calculados a partir das fichas. Funções puras. */
import { league as leagueOf } from '../espn/leagues'
import type { GameRecord, LeagueFile, Meta } from '../history/types'
import { addDays, localToday } from '../lib/dates'
import type { Sport } from '../types'
import { METRICS, scoreIn, sideValue, type Measure, type Metric, type PeriodId, type Side, type View } from './metrics'

export interface LeagueRow {
  league: string
  games: number
  avg: number | null
  pct: number | null
  result?: { home: number; draw: number; away: number }
}

export interface TeamRow {
  teamId: string
  name: string
  logo: string | null
  games: number
  avg: number | null
  pct: number | null
  hits: number | null
  result?: { w: number; d: number; l: number }
  form: ('V' | 'E' | 'D')[]
}

export interface TeamOpts {
  metricId: string
  period: PeriodId
  view: View
  measure: Measure
  last: 5 | 10 | 15 | 20 | 'season'
  venue: 'all' | 'home' | 'away'
  order: 'desc' | 'asc'
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10
const pctOf = (k: number, n: number) => r1((k / n) * 100)
const metricById = (id: string): Metric => {
  const m = METRICS.find(x => x.id === id)
  if (!m) throw new Error(`estatística desconhecida: ${id}`)
  return m
}
const sportOf = (f: LeagueFile): Sport => leagueOf(f.league).sport
const maxSeason = (f: LeagueFile) => f.games.reduce((m, g) => Math.max(m, g.season), -Infinity)
const hit = (v: number, m: Measure) => (m.kind === 'over' ? v > m.line : m.kind === 'under' ? v < m.line : false)

/** Resumo de uma lista de valores conforme a medida. */
function summarize(values: number[], measure: Measure) {
  const n = values.length
  if (!n) return { games: 0, avg: null, pct: null, hits: null }
  const avg = r2(values.reduce((s, v) => s + v, 0) / n)
  if (measure.kind === 'avg') return { games: n, avg, pct: null, hits: null }
  const hits = values.filter(v => hit(v, measure)).length
  return { games: n, avg, pct: pctOf(hits, n), hits }
}

export function leagueRanking(files: LeagueFile[], metricId: string, period: PeriodId, measure: Measure,
  window: 'season' | '30d', now: Date): LeagueRow[] {
  const m = metricById(metricId)
  const since = now.getTime() - 30 * 86_400_000
  const rows: LeagueRow[] = []
  for (const f of files) {
    const sport = sportOf(f)
    if (!m.periods[sport]) continue
    const season = maxSeason(f)
    const games = f.games.filter(g => (window === 'season' ? g.season === season : Date.parse(g.date) >= since))
    if (m.kind === 'count') {
      const vals: number[] = []
      for (const g of games) {
        const h = sideValue(g, 'h', m, period, sport), a = sideValue(g, 'a', m, period, sport)
        if (h !== null && a !== null) vals.push(h + a)
      }
      const s = summarize(vals, measure)
      rows.push({ league: f.league, games: s.games, avg: s.avg, pct: s.pct })
    } else {
      let n = 0, both = 0, home = 0, draw = 0, away = 0
      for (const g of games) {
        const h = scoreIn(g, 'h', period, sport), a = scoreIn(g, 'a', period, sport)
        if (h === null || a === null) continue
        n++
        if (h > 0 && a > 0) both++
        if (h > a) home++; else if (h < a) away++; else draw++
      }
      rows.push(m.kind === 'btts'
        ? { league: f.league, games: n, avg: null, pct: n ? pctOf(both, n) : null }
        : { league: f.league, games: n, avg: null, pct: n ? pctOf(home, n) : null,
          result: n ? { home: pctOf(home, n), draw: pctOf(draw, n), away: pctOf(away, n) } : undefined })
    }
  }
  const key = (r: LeagueRow) => (measureKey(m, measure) === 'avg' ? r.avg : r.pct) ?? -Infinity
  return rows.filter(r => r.games > 0).sort((a, b) => key(b) - key(a) || b.games - a.games || a.league.localeCompare(b.league))
}

const measureKey = (m: Metric, measure: Measure) => (m.kind === 'count' && measure.kind === 'avg' ? 'avg' : 'pct')

interface Entry { g: GameRecord; side: Side; sport: Sport; current: boolean }

export function teamRanking(files: LeagueFile[], o: TeamOpts): TeamRow[] {
  const m = metricById(o.metricId)
  const byTeam = new Map<string, Entry[]>()
  const currentTeams = new Set<string>()
  const info = new Map<string, { name: string; logo: string | null }>()
  for (const f of files) {
    const sport = sportOf(f)
    if (!m.periods[sport]) continue
    const season = maxSeason(f)
    for (const g of f.games) {
      if (g.season === season) { currentTeams.add(g.h); currentTeams.add(g.a) }
      for (const side of ['h', 'a'] as Side[]) {
        if (o.venue === 'home' && side !== 'h') continue
        if (o.venue === 'away' && side !== 'a') continue
        const id = side === 'h' ? g.h : g.a
        if (!byTeam.has(id)) byTeam.set(id, [])
        byTeam.get(id)!.push({ g, side, sport, current: g.season === season })
        const t = f.teams[id]
        if (t && !info.has(id)) info.set(id, { name: t.name, logo: t.logo })
      }
    }
  }

  const rows: TeamRow[] = []
  for (const [teamId, all] of byTeam) {
    // Só times com jogo na temporada atual (rebaixados/eliminados não aparecem com jogos antigos).
    if (!currentTeams.has(teamId)) continue
    all.sort((a, b) => b.g.date.localeCompare(a.g.date))
    const form = all.slice(0, 5).map(e => outcome(e.g.hs, e.g.as, e.side))
    const picked = o.last === 'season' ? all.filter(e => e.current) : all.slice(0, o.last)
    const row: TeamRow = { teamId, name: info.get(teamId)?.name ?? teamId, logo: info.get(teamId)?.logo ?? null,
      games: 0, avg: null, pct: null, hits: null, form }
    if (m.kind === 'count') {
      const vals: number[] = []
      for (const e of picked) {
        const mine = sideValue(e.g, e.side, m, o.period, e.sport)
        const theirs = sideValue(e.g, e.side === 'h' ? 'a' : 'h', m, o.period, e.sport)
        const v = o.view === 'for' ? mine : o.view === 'against' ? theirs : mine !== null && theirs !== null ? mine + theirs : null
        if (v !== null) vals.push(v)
      }
      Object.assign(row, summarize(vals, o.measure))
    } else {
      let n = 0, both = 0, w = 0, d = 0, l = 0
      for (const e of picked) {
        const mine = scoreIn(e.g, e.side, o.period, e.sport)
        const theirs = scoreIn(e.g, e.side === 'h' ? 'a' : 'h', o.period, e.sport)
        if (mine === null || theirs === null) continue
        n++
        if (mine > 0 && theirs > 0) both++
        if (mine > theirs) w++; else if (mine < theirs) l++; else d++
      }
      row.games = n
      if (n && m.kind === 'btts') { row.pct = pctOf(both, n); row.hits = both }
      if (n && m.kind === 'result') { row.pct = pctOf(w, n); row.hits = w; row.result = { w: pctOf(w, n), d: pctOf(d, n), l: pctOf(l, n) } }
    }
    if (row.games > 0) rows.push(row)
  }

  const key = (r: TeamRow) => (measureKey(m, o.measure) === 'avg' ? r.avg : r.pct) ?? 0
  const dir = o.order === 'desc' ? 1 : -1
  return rows.sort((a, b) => dir * (key(b) - key(a)) || b.games - a.games || a.name.localeCompare(b.name))
}

function outcome(hs: number, as: number, side: Side): 'V' | 'E' | 'D' {
  const mine = side === 'h' ? hs : as, theirs = side === 'h' ? as : hs
  return mine > theirs ? 'V' : mine < theirs ? 'D' : 'E'
}

const dayFmt = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

/** Até que dia os dados das ligas mostradas vão (a mais atrasada manda) e problemas por liga. */
export function dataStatus(files: LeagueFile[], meta: Meta | null, now: Date):
  { label: string; stale: boolean; problems: string[] } {
  const days = files.map(f => f.scanned_until)
  const problems: string[] = []
  for (const f of files) {
    const m = meta?.leagues?.[f.league]
    const name = leagueOf(f.league).name
    if (m?.pending) problems.push(`${name}: carga do histórico em andamento`)
    if (m?.error) problems.push(`${name}: última atualização falhou (${m.error})`)
  }
  if (!days.length || days.some(d => !d)) return { label: 'Histórico ainda sem jogos', stale: true, problems }
  const oldest = (days as string[]).sort()[0]
  // O robô roda às 9h e varre até ontem: anteontem ainda é normal; antes disso, está atrasado.
  const stale = oldest < addDays(localToday(now), -2)
  return { label: `Jogos até ${dayFmt(oldest)}`, stale, problems }
}

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

export function dataAge(updatedAt: string, now: Date): { label: string; stale: boolean } {
  const label = `Dados até ${fmt.format(new Date(updatedAt)).replace(',', '')}`
  return { label, stale: now.getTime() - Date.parse(updatedAt) > 36 * 3600 * 1000 }
}
