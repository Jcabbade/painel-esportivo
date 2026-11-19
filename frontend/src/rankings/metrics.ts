/* Estatísticas dos rankings: como tirar o valor de um lado de um jogo. Nada estimado: sem dado → null. */
import type { GameRecord } from '../history/types'
import type { Sport } from '../types'

export type PeriodId = 'full' | 'h1' | 'h2' | 'q1' | 'q2' | 'q3' | 'q4'
export type View = 'total' | 'for' | 'against'
export type Measure = { kind: 'avg' } | { kind: 'over' | 'under'; line: number }
export type Side = 'h' | 'a'

export const PERIOD_LABELS: Record<PeriodId, string> = {
  full: 'Jogo todo', h1: '1º tempo', h2: '2º tempo', q1: '1º quarto', q2: '2º quarto', q3: '3º quarto', q4: '4º quarto',
}

export interface Metric {
  id: string
  label: string
  kind: 'count' | 'btts' | 'result'
  periods: Partial<Record<Sport, PeriodId[]>>   // esportes em que existe, e seus períodos
  defaultLine: Partial<Record<Sport, number>>
  /** Valor de um lado no jogo todo (estatísticas que não são placar). */
  stat?: (g: GameRecord, side: Side) => number | null
}

const HALVES: PeriodId[] = ['full', 'h1', 'h2']
const QUARTERS: PeriodId[] = ['full', 'h1', 'h2', 'q1', 'q2', 'q3', 'q4']
const FULL: PeriodId[] = ['full']

const other = (s: Side): Side => (s === 'h' ? 'a' : 'h')
const st = (key: string) => (g: GameRecord, side: Side) => g.st[side][key] ?? null

export const METRICS: Metric[] = [
  { id: 'goals', label: 'Gols', kind: 'count', periods: { soccer: HALVES }, defaultLine: { soccer: 2.5 } },
  { id: 'corners', label: 'Escanteios', kind: 'count', periods: { soccer: FULL }, defaultLine: { soccer: 9.5 }, stat: st('wonCorners') },
  {
    id: 'cards', label: 'Cartões', kind: 'count', periods: { soccer: FULL }, defaultLine: { soccer: 4.5 },
    stat: (g, side) => {
      const y = g.st[side].yellowCards, r = g.st[side].redCards
      return y == null || r == null ? null : y + r
    },
  },
  { id: 'shots', label: 'Chutes', kind: 'count', periods: { soccer: FULL }, defaultLine: { soccer: 24.5 }, stat: st('totalShots') },
  { id: 'shotsOnTarget', label: 'Chutes no gol', kind: 'count', periods: { soccer: FULL }, defaultLine: { soccer: 8.5 }, stat: st('shotsOnTarget') },
  { id: 'fouls', label: 'Faltas', kind: 'count', periods: { soccer: FULL }, defaultLine: { soccer: 22.5 }, stat: st('foulsCommitted') },
  { id: 'offsides', label: 'Impedimentos', kind: 'count', periods: { soccer: FULL }, defaultLine: { soccer: 3.5 }, stat: st('offsides') },
  { id: 'btts', label: 'Ambas marcam', kind: 'btts', periods: { soccer: HALVES }, defaultLine: {} },
  { id: 'points', label: 'Pontos', kind: 'count', periods: { basketball: QUARTERS, football: QUARTERS }, defaultLine: { basketball: 225.5, football: 44.5 } },
  { id: 'rebounds', label: 'Rebotes', kind: 'count', periods: { basketball: FULL }, defaultLine: { basketball: 89.5 }, stat: st('totalRebounds') },
  { id: 'assists', label: 'Assistências', kind: 'count', periods: { basketball: FULL }, defaultLine: { basketball: 50.5 }, stat: st('assists') },
  { id: 'threes', label: 'Cestas de 3', kind: 'count', periods: { basketball: FULL }, defaultLine: { basketball: 25.5 }, stat: st('threePointFieldGoalsMade') },
  { id: 'yards', label: 'Jardas totais', kind: 'count', periods: { football: FULL }, defaultLine: { football: 650.5 }, stat: st('totalYards') },
  { id: 'turnovers', label: 'Turnovers', kind: 'count', periods: { football: FULL }, defaultLine: { football: 2.5 }, stat: st('turnovers') },
  // Sacks "feitos" = sacks que o adversário sofreu.
  { id: 'sacks', label: 'Sacks', kind: 'count', periods: { football: FULL }, defaultLine: { football: 4.5 }, stat: (g, side) => g.st[other(side)].sacksTaken ?? null },
  { id: 'result', label: 'Resultado', kind: 'result', periods: { soccer: HALVES, basketball: HALVES, football: HALVES }, defaultLine: {} },
]

export const metricsFor = (sport: Sport) => METRICS.filter(m => m.periods[sport])
export const periodsFor = (m: Metric, sport: Sport): PeriodId[] => m.periods[sport] ?? []

/** Linha padrão; por período, proporcional: ⌊padrão ÷ nº de períodos⌋ + 0,5. */
export function defaultLine(m: Metric, sport: Sport, period: PeriodId): number {
  const full = m.defaultLine[sport] ?? 0.5
  if (period === 'full') return full
  const parts = period.startsWith('q') ? 4 : 2
  return Math.floor(full / parts) + 0.5
}

/** Placar de um lado no período (gols/pontos). */
export function scoreIn(g: GameRecord, side: Side, period: PeriodId, sport: Sport): number | null {
  const total = side === 'h' ? g.hs : g.as
  if (period === 'full') return total
  const p = side === 'h' ? g.hp : g.ap
  const pick = (...idx: number[]) => (idx.every(i => typeof p[i] === 'number') ? idx.reduce((s, i) => s + p[i], 0) : null)
  if (sport === 'soccer') return period === 'h1' ? pick(0) : period === 'h2' ? pick(1) : null
  switch (period) {
    case 'h1': return pick(0, 1)
    case 'h2': return pick(2, 3)
    case 'q1': return pick(0)
    case 'q2': return pick(1)
    case 'q3': return pick(2)
    case 'q4': return pick(3)
  }
}

export function sideValue(g: GameRecord, side: Side, m: Metric, period: PeriodId, sport: Sport): number | null {
  if (m.stat) return period === 'full' ? m.stat(g, side) : null
  return scoreIn(g, side, period, sport)
}
