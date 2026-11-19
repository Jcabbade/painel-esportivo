import type { Game } from '../types'

export type Tab = 'todos' | 'favoritos' | 'ao_vivo' | 'proximos' | 'encerrados'
export type GroupMode = 'liga' | 'horario'

export interface FilterOpts {
  tab: Tab
  leagues: Set<string>
  query: string
}

export const TZ = 'America/Sao_Paulo'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function matchesTab(g: Game, tab: Tab): boolean {
  switch (tab) {
    case 'ao_vivo': return g.status === 'live'
    case 'proximos': return g.status === 'scheduled'
    case 'encerrados': return g.status === 'final' || g.status === 'postponed' || g.status === 'canceled'
    case 'favoritos': return g.home.favorite || g.away.favorite
    default: return true
  }
}

export function filterGames(games: Game[], opts: FilterOpts, leagueNames: Record<string, string> = {}): Game[] {
  const q = fold(opts.query.trim())
  return games.filter(g => {
    if (!matchesTab(g, opts.tab)) return false
    if (opts.leagues.size > 0 && !opts.leagues.has(g.league)) return false
    if (!q) return true
    const hay = [g.home.name, g.home.short_name, g.home.abbrev, g.away.name, g.away.short_name, g.away.abbrev,
      g.league, leagueNames[g.league] ?? '']
    return hay.some(h => fold(h).includes(q))
  })
}

const hourFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function formatLocalTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

export function groupGames(games: Game[], mode: GroupMode, leagueOrder: string[],
  leagueNames: Record<string, string>): { title: string; games: Game[] }[] {
  const groups = new Map<string, Game[]>()
  for (const g of games) {
    const key = mode === 'liga' ? g.league : `${hourFmt.format(new Date(g.start_utc))}:00`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(g)
  }
  const keys = [...groups.keys()]
  if (mode === 'liga') {
    const pos = (k: string) => { const i = leagueOrder.indexOf(k); return i < 0 ? Infinity : i }
    keys.sort((a, b) => pos(a) - pos(b))
  } else {
    keys.sort()
  }
  return keys.map(k => ({ title: mode === 'liga' ? (leagueNames[k] ?? k) : k, games: groups.get(k)! }))
}

export function countLive(games: Game[]): number {
  return games.filter(g => g.status === 'live').length
}

const SIX_HOURS = 6 * 3600 * 1000

/** Atualização rápida: há jogo ao vivo ou um jogo agendado que já passou do horário (pode ter começado). */
export function needsFastPoll(games: Game[], now: Date = new Date()): boolean {
  const t = now.getTime()
  return games.some(g => g.status === 'live' || (g.status === 'scheduled'
    && Date.parse(g.start_utc) <= t && t - Date.parse(g.start_utc) < SIX_HOURS))
}
