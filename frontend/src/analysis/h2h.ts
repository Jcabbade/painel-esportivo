/* Confronto direto e forma recente, a partir do histórico. */
import type { GameRecord, LeagueFile } from '../history/types'
import { teamGames } from './pregame'

export interface H2HResult { games: GameRecord[]; aWins: number; draws: number; bWins: number }

/** Jogos entre a e b (mais recentes primeiro). 'aHome' = a mandante; 'bHome' = b mandante. */
export function headToHead(files: LeagueFile[], aId: string, bId: string, filter: 'total' | 'aHome' | 'bHome', before?: string): H2HResult {
  const seen = new Set<string>()
  const games: GameRecord[] = []
  for (const f of files) for (const g of f.games) {
    const pair = (g.h === aId && g.a === bId) || (g.h === bId && g.a === aId)
    if (!pair || seen.has(g.id) || (before && g.date >= before)) continue
    if (filter === 'aHome' && g.h !== aId) continue
    if (filter === 'bHome' && g.h !== bId) continue
    seen.add(g.id)
    games.push(g)
  }
  games.sort((x, y) => y.date.localeCompare(x.date))
  let aWins = 0, draws = 0, bWins = 0
  for (const g of games) {
    const a = g.h === aId ? g.hs : g.as, b = g.h === aId ? g.as : g.hs
    if (a > b) aWins++; else if (a < b) bWins++; else draws++
  }
  return { games, aWins, draws, bWins }
}

/** Em quais jogos olhar os "últimos jogos" de cada time, conforme o filtro do H2H. */
export function recentVenue(filter: 'total' | 'aHome' | 'bHome', team: 'home' | 'away'): 'all' | 'home' | 'away' {
  if (filter === 'total') return 'all'
  const aIsHome = filter === 'aHome'
  return team === 'home' ? (aIsHome ? 'home' : 'away') : (aIsHome ? 'away' : 'home')
}

export interface FormRow { date: string; league: string; home: boolean; oppId: string; oppName: string; gf: number; ga: number; res: 'V' | 'E' | 'D' }

export function form(files: LeagueFile[], teamId: string, n = 10, venue: 'all' | 'home' | 'away' = 'all', before?: string): FormRow[] {
  const names = new Map<string, string>()
  for (const f of files) for (const [id, t] of Object.entries(f.teams)) if (!names.has(id)) names.set(id, t.name)
  return teamGames(files, teamId, { venue, last: n, before }).map(({ g, side, league }) => {
    const gf = side === 'h' ? g.hs : g.as, ga = side === 'h' ? g.as : g.hs
    const oppId = side === 'h' ? g.a : g.h
    return { date: g.date, league, home: side === 'h', oppId, oppName: names.get(oppId) ?? oppId, gf, ga,
      res: gf > ga ? 'V' : gf < ga ? 'D' : 'E' }
  })
}
