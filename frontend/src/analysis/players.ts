/* Ranking de jogadores por média nos últimos jogos em que entraram. */
import type { PlayersFile } from '../history/types'

export interface PlayerRow { id: string; name: string; team: string; avg: number; n: number; seq: number[] }

export const PLAYER_STATS: Record<string, { key: string; label: string }[]> = {
  soccer: [
    { key: 'foulsCommitted', label: 'Faltas' }, { key: 'foulsSuffered', label: 'Faltas sofridas' },
    { key: 'totalShots', label: 'Chutes' }, { key: 'shotsOnTarget', label: 'Chutes no gol' },
    { key: 'yellowCards', label: 'Cartões amarelos' }, { key: 'saves', label: 'Defesas' },
    { key: 'totalGoals', label: 'Gols' }, { key: 'goalAssists', label: 'Assistências' },
  ],
  basketball: [{ key: 'PTS', label: 'Pontos' }, { key: 'REB', label: 'Rebotes' }, { key: 'AST', label: 'Assistências' }, { key: '3PM', label: 'Cestas de 3' }],
  football: [{ key: 'passYds', label: 'Jardas de passe' }, { key: 'rushYds', label: 'Jardas corridas' }, { key: 'recYds', label: 'Jardas recebidas' }, { key: 'rec', label: 'Recepções' }],
}

/** Jogadores cuja aparição mais recente foi por um dos times pedidos. */
export function playerRanking(pf: PlayersFile, teamIds: string[], stat: string,
  opts: { last: number; onlyIds?: Set<string>; before?: string }): PlayerRow[] {
  const teams = new Set(teamIds)
  const apps = new Map<string, { date: string; t: string; n: string; v: number | undefined }[]>()
  for (const g of pf.games) {
    if (opts.before && g.date >= opts.before) continue
    for (const p of g.p) {
    if (!apps.has(p.id)) apps.set(p.id, [])
    apps.get(p.id)!.push({ date: g.date, t: p.t, n: p.n, v: p.st[stat] })
    }
  }
  const rows: PlayerRow[] = []
  for (const [id, list] of apps) {
    if (opts.onlyIds && !opts.onlyIds.has(id)) continue
    list.sort((a, b) => b.date.localeCompare(a.date))
    if (!teams.has(list[0].t)) continue
    const seq = list.filter(a => typeof a.v === 'number').slice(0, opts.last).map(a => a.v as number)
    if (!seq.length) continue
    rows.push({ id, name: list[0].n, team: list[0].t, n: seq.length, seq,
      avg: Math.round((seq.reduce((s, v) => s + v, 0) / seq.length) * 100) / 100 })
  }
  return rows.sort((a, b) => b.avg - a.avg || b.n - a.n || a.name.localeCompare(b.name))
}
