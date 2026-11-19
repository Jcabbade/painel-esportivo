/* Extratores do summary para o histórico v2: escanteios por faixa de tempo e números por jogador. */
import type { Game } from '../types'
import type { PlayerLine } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const CORNER_BUCKETS = ['0–10', '10–20', '20–30', '30–40', '40–Int', '45–55', '55–65', '65–75', '75–85', '85–Fim']

function num(v: unknown): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null
  const m = /^-?\d+(\.\d+)?/.exec(String(v).trim())
  return m ? Number(m[0]) : null
}

function bucket(period: number, secs: number): number | null {
  const m = Math.floor(secs / 60)
  if (period === 1) return m < 10 ? 0 : m < 20 ? 1 : m < 30 ? 2 : m < 40 ? 3 : 4
  if (period === 2) return m < 55 ? 5 : m < 65 ? 6 : m < 75 ? 7 : m < 85 ? 8 : 9
  return null // prorrogação: fora das faixas
}

/** Escanteios por faixa; null se a narração não bater com o total oficial de algum lado (nada estimado). */
export function cornerBuckets(summary: unknown, homeName: string, awayName: string): { h: number[]; a: number[] } | null {
  const p = summary as any
  const official: Partial<Record<'h' | 'a', number>> = {}
  for (const t of p?.boxscore?.teams ?? []) {
    const side = t?.homeAway === 'home' ? 'h' : t?.homeAway === 'away' ? 'a' : null
    const v = num((t?.statistics ?? []).find((s: any) => s?.name === 'wonCorners')?.displayValue)
    if (side && v !== null) official[side] = v
  }
  if (official.h === undefined || official.a === undefined) return null
  const cb = { h: Array(10).fill(0) as number[], a: Array(10).fill(0) as number[] }
  const counted = { h: 0, a: 0 }
  for (const c of p?.commentary ?? []) {
    const play = c?.play
    if (play?.type?.type !== 'corner-awarded') continue
    const name = play.team?.displayName
    const side = name === homeName ? 'h' : name === awayName ? 'a' : null
    const b = bucket(Number(play.period?.number), Number(play.clock?.value ?? c?.time?.value))
    if (!side || b === null) return null // lance que não sabemos encaixar: não arrisca
    cb[side][b]++
    counted[side]++
  }
  return counted.h === official.h && counted.a === official.a ? cb : null
}

const SOCCER_STATS = ['foulsCommitted', 'foulsSuffered', 'totalShots', 'shotsOnTarget', 'yellowCards', 'redCards', 'saves', 'totalGoals', 'goalAssists']

function soccerPlayers(game: Game, p: any): PlayerLine[] {
  const out: PlayerLine[] = []
  for (const r of p?.rosters ?? []) {
    const t = r?.homeAway === 'home' ? game.home.team_id : r?.homeAway === 'away' ? game.away.team_id : String(r?.team?.id ?? '')
    if (t !== game.home.team_id && t !== game.away.team_id) continue
    for (const pl of r.roster ?? []) {
      const byName = new Map((pl?.stats ?? []).map((s: any) => [s?.name, num(s?.value ?? s?.displayValue)]))
      // Só quem entrou em campo: "appearances" quando a ESPN manda; senão, titular ou quem entrou.
      const apps = byName.get('appearances') as number | null | undefined
      if (apps === 0 || ((apps === null || apps === undefined) && !pl?.starter && !pl?.subbedIn)) continue
      const id = pl?.athlete?.id, n = pl?.athlete?.displayName
      if (id == null || !n) continue
      const st: Record<string, number> = {}
      for (const k of SOCCER_STATS) { const v = byName.get(k); if (typeof v === 'number') st[k] = v }
      out.push({ id: String(id), n, t, s: !!pl.starter, st })
    }
  }
  return out
}

function boxPlayers(game: Game, p: any): PlayerLine[] {
  const byId = new Map<string, PlayerLine>()
  for (const team of p?.boxscore?.players ?? []) {
    const t = String(team?.team?.id ?? '')
    if (t !== game.home.team_id && t !== game.away.team_id) continue
    for (const g of team.statistics ?? []) {
      const labels: string[] = (g?.labels ?? []).map(String)
      const col = (l: string) => labels.indexOf(l)
      for (const a of g?.athletes ?? []) {
        if (a?.didNotPlay || !a?.stats?.length) continue
        const id = a?.athlete?.id, n = a?.athlete?.displayName
        if (id == null || !n) continue
        const line: PlayerLine = byId.get(String(id)) ?? { id: String(id), n, t, s: !!a.starter, st: {} }
        const take = (label: string, key: string) => {
          const i = col(label)
          const v = i >= 0 ? num(a.stats[i]) : null
          if (v !== null) line.st[key] = v
        }
        if (game.sport === 'basketball') {
          take('PTS', 'PTS'); take('REB', 'REB'); take('AST', 'AST'); take('3PT', '3PM')
        } else if (g?.name === 'passing') take('YDS', 'passYds')
        else if (g?.name === 'rushing') take('YDS', 'rushYds')
        else if (g?.name === 'receiving') { take('YDS', 'recYds'); take('REC', 'rec') }
        byId.set(String(id), line)
      }
    }
  }
  return [...byId.values()].filter(l => Object.keys(l.st).length > 0)
}

export function toPlayers(game: Game, summary: unknown): PlayerLine[] {
  return game.sport === 'soccer' ? soccerPlayers(game, summary) : boxPlayers(game, summary)
}
