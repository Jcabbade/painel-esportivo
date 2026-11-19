/* Detalhe de um jogo, já interpretado. Seção vazia (lista vazia ou null) não é desenhada. */

export interface StatRow { label: string; home: string; away: string }

export type SoccerEventKind =
  'goal' | 'penalty_goal' | 'own_goal' | 'penalty_miss' | 'yellow' | 'red' | 'sub' | 'halftime'

export interface SoccerEvent {
  minute: string
  kind: SoccerEventKind
  side: 'home' | 'away' | null
  player: string | null
  playerOut: string | null
}

export interface LineupPlayer {
  id: string | null
  name: string
  number: string | null
  position: string | null
  subbedIn: boolean
  subbedOut: boolean
}

export interface Lineup { formation: string | null; starters: LineupPlayer[]; bench: LineupPlayer[] }

export interface H2HGame { date: string; home: string; away: string; homeScore: number | null; awayScore: number | null }
export interface H2H { summary: string | null; games: H2HGame[] }

export interface Aggregate { leg: string | null; round: string | null; home: number; away: number }

export interface BoxPlayer { name: string; starter: boolean; stats: string[]; dnp: string | null }
export interface BoxGroup { title: string; labels: string[]; players: BoxPlayer[] }

export interface GameDetail {
  stats: StatRow[]
  events: SoccerEvent[]
  lineups: { home: Lineup; away: Lineup } | null
  periods: { labels: string[]; home: string[]; away: string[] } | null
  box: { home: BoxGroup[]; away: BoxGroup[] } | null
  h2h: H2H | null
  aggregate: Aggregate | null
  attendance: number | null
  /** Escanteios por faixa de 10 min (só se a narração bater com o total oficial). */
  corners: { h: number[]; a: number[] } | null
}
