/* Escanteios por faixa de 10 minutos (só jogos com a narração completa). */
import { CORNER_BUCKETS } from '../history/players'
import type { LeagueFile } from '../history/types'
import { teamGames, type Venue } from './pregame'

const r2 = (n: number) => Math.round(n * 100) / 100

export function cornerProfile(files: LeagueFile[], teamId: string,
  opts: { last: number; venue: Venue; view: 'for' | 'against' | 'total'; before?: string }) {
  const games = teamGames(files, teamId, { venue: opts.venue, last: Number.MAX_SAFE_INTEGER, before: opts.before })
    .filter(e => e.g.cb).slice(0, opts.last)
  const totals = Array(CORNER_BUCKETS.length).fill(0) as number[]
  for (const { g, side } of games) {
    const mine = side === 'h' ? g.cb!.h : g.cb!.a, theirs = side === 'h' ? g.cb!.a : g.cb!.h
    for (let i = 0; i < totals.length; i++) {
      totals[i] += opts.view === 'for' ? mine[i] : opts.view === 'against' ? theirs[i] : mine[i] + theirs[i]
    }
  }
  const n = games.length
  return { n, buckets: CORNER_BUCKETS.map((label, i) => ({ label, total: totals[i], avg: n ? r2(totals[i] / n) : 0 })) }
}
