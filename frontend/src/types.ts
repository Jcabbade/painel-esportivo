export type Sport = 'soccer' | 'basketball' | 'football'
export type GameStatus = 'scheduled' | 'live' | 'final' | 'postponed' | 'canceled'

export interface Side {
  team_id: string
  name: string
  short_name: string
  abbrev: string
  logo: string | null
  score: number | null
  record: string | null
  rank: number | null
  favorite: boolean
}

export interface Game {
  id: string
  league: string
  sport: Sport
  start_utc: string
  status: GameStatus
  status_detail: string
  venue: string | null
  home: Side
  away: Side
}

export interface League {
  key: string
  name: string
  sport: Sport
}

export interface SyncError {
  league: string
  message: string | null
  at: string | null
}

export interface GamesResponse {
  date: string
  games: Game[]
  updated_at: string | null
  stale: boolean
  errors: SyncError[]
}
