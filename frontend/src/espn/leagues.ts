import type { League } from '../types'

export interface EspnLeague extends League {
  path: string
}

export const LEAGUES: EspnLeague[] = [
  { key: 'NFL', path: 'football/nfl', name: 'NFL', sport: 'football' },
  { key: 'NBA', path: 'basketball/nba', name: 'NBA', sport: 'basketball' },
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
