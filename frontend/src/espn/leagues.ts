import type { League } from '../types'

export interface EspnLeague extends League {
  path: string
  /** Só mata-mata: a ESPN não tem tabela de classificação. */
  knockout?: boolean
}

export const LEAGUES: EspnLeague[] = [
  { key: 'NFL', path: 'football/nfl', name: 'NFL', sport: 'football' },
  { key: 'NBA', path: 'basketball/nba', name: 'NBA', sport: 'basketball' },
  { key: 'BRA', path: 'soccer/bra.1', name: 'Brasileirão', sport: 'soccer' },
  { key: 'CDB', path: 'soccer/bra.copa_do_brazil', name: 'Copa do Brasil', sport: 'soccer', knockout: true },
  { key: 'LIB', path: 'soccer/conmebol.libertadores', name: 'Libertadores', sport: 'soccer' },
  { key: 'SUL', path: 'soccer/conmebol.sudamericana', name: 'Sul-Americana', sport: 'soccer' },
  { key: 'PL', path: 'soccer/eng.1', name: 'Premier League', sport: 'soccer' },
  { key: 'UCL', path: 'soccer/uefa.champions', name: 'Champions League', sport: 'soccer' },
  { key: 'ESP', path: 'soccer/esp.1', name: 'La Liga', sport: 'soccer' },
  { key: 'ITA', path: 'soccer/ita.1', name: 'Serie A', sport: 'soccer' },
  { key: 'ALE', path: 'soccer/ger.1', name: 'Bundesliga', sport: 'soccer' },
]

export function league(key: string): EspnLeague {
  const l = LEAGUES.find(x => x.key === key)
  if (!l) throw new Error(`liga desconhecida: ${key}`)
  return l
}

/** Liga em que a aba Tabela abre: a escolhida antes, se ainda existir; senão o Brasileirão. */
export function initialStandingsKey(saved: string | null): string {
  return saved && LEAGUES.some(l => l.key === saved) ? saved : 'BRA'
}
