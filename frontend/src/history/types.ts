/* Histórico gravado pelo robô diário (ramo `data`, servido em public/data/). */

export interface GameRecord {
  id: string
  date: string              // ISO UTC do início
  season: number            // header.season.year da ESPN
  h: string                 // id do mandante
  a: string                 // id do visitante
  hs: number                // placar final (com prorrogação)
  as: number
  hp: number[]              // por período: tempos (futebol) ou quartos (+OT); vazio se a ESPN não mandou
  ap: number[]
  st: { h: Record<string, number>; a: Record<string, number> }   // só as estatísticas que vieram
}

export interface TeamInfo { name: string; abbrev: string; logo: string | null }

export interface LeagueFile {
  league: string
  updated_at: string
  scanned_until: string | null   // último dia ESPN (YYYY-MM-DD) inteiramente processado
  teams: Record<string, TeamInfo>
  games: GameRecord[]            // ordenados por date
}

export interface Meta {
  updated_at: string
  leagues: Record<string, { games: number; scanned_until: string | null; error: string | null }>
}
