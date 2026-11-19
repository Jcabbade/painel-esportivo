/* Atualiza o histórico de uma liga: varre os dias da ESPN e grava a ficha de cada jogo encerrado.
   Incremental e retomável: `scanned_until` só avança até o último dia inteiramente processado. */
import { ESPN_SITE, ESPN_STANDINGS, type Fetcher } from '../espn/client'
import { league as leagueOf } from '../espn/leagues'
import { parseScoreboard } from '../espn/parse'
import { addDays } from '../lib/dates'
import { toPlayers } from './players'
import { toRecord } from './record'
import { HISTORY_VERSION, type GameRecord, type LeagueFile, type PlayersFile } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DEFAULT_START = '2025-07-01'
export const RESCAN_DAYS = 3
/** Depois de tantas execuções com falha no summary, o jogo deixa de travar a varredura (fica fora das contas). */
export const GIVE_UP_AFTER = 3

export interface UpdateOpts {
  fetch: Fetcher
  today: string                 // YYYY-MM-DD (Brasília)
  start?: string
  maxSummaries?: number
  now?: Date
  log?: (msg: string) => void
  sleep?: (ms: number) => Promise<void>
  /** Horário-limite (ms desde 1970): ao passar, para como no limite de buscas e devolve done: false. */
  deadline?: number
  /** Arquivo de jogadores anterior (players-<LIGA>.json). */
  players?: PlayersFile | null
}

const realSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const compact = (day: string) => day.split('-').join('')

function teamIds(payload: any): Set<string> {
  const ids = new Set<string>()
  const walk = (n: any) => {
    for (const e of n?.standings?.entries ?? []) if (e?.team?.id != null) ids.add(String(e.team.id))
    for (const c of n?.children ?? []) walk(c)
  }
  for (const c of payload?.children ?? []) walk(c)
  return ids
}

export async function updateLeague(fileIn: LeagueFile | null, leagueKey: string, opts: UpdateOpts):
  Promise<{ file: LeagueFile; players: PlayersFile; done: boolean; added: number }> {
  const lg = leagueOf(leagueKey)
  // Histórico de versão antiga: recarrega do zero (jogadores e escanteios por faixa precisam de todos os summaries).
  const file = fileIn?.v === HISTORY_VERSION ? fileIn : null
  const playersIn = file && opts.players?.v === HISTORY_VERSION ? opts.players : null
  const playerGames = new Map((playersIn?.games ?? []).map(g => [g.id, g]))
  const sleep = opts.sleep ?? realSleep
  const max = opts.maxSummaries ?? 3000
  const log = opts.log ?? (() => {})
  const get = async (url: string) => { await sleep(150); return opts.fetch(url) }

  const games = new Map<string, GameRecord>((file?.games ?? []).map(g => [g.id, g]))
  const teams = { ...(file?.teams ?? {}) }
  const failures: Record<string, number> = { ...(file?.failures ?? {}) }
  const start = opts.start ?? DEFAULT_START
  const last = addDays(opts.today, -1)
  let day = file?.scanned_until ? addDays(file.scanned_until, -RESCAN_DAYS) : start
  if (day < start) day = start

  // NBA/NFL: só jogos entre times da liga (fora All-Star, Pro Bowl, amistosos internacionais).
  const allowed = lg.sport === 'soccer' ? null : teamIds(await get(`${ESPN_STANDINGS}/${lg.path}/standings`))
  if (allowed && allowed.size === 0) throw new Error('classificação sem times')

  let fetched = 0, added = 0, capped = false
  let scanned = file?.scanned_until ?? null
  let blocked = false   // um dia ficou incompleto: scanned_until não passa dele

  const late = () => opts.deadline !== undefined && Date.now() >= opts.deadline
  for (; day <= last && !capped; day = addDays(day, 1)) {
    if (late()) { capped = true; break }
    const sb = await get(`${ESPN_SITE}/${lg.path}/scoreboard?dates=${compact(day)}`)
    let complete = true
    for (const g of parseScoreboard(lg, sb)) {
      if (g.status !== 'final' || games.has(g.id)) continue
      if (allowed && (!allowed.has(g.home.team_id) || !allowed.has(g.away.team_id))) continue
      if (fetched >= max || late()) { capped = true; complete = false; break }
      fetched++
      try {
        const summary = await get(`${ESPN_SITE}/${lg.path}/summary?event=${g.id}`)
        const r = toRecord(g, summary)
        delete failures[g.id]
        if (r) {
          games.set(r.record.id, r.record)
          const p = toPlayers(g, summary)
          if (p.length) playerGames.set(r.record.id, { id: r.record.id, date: r.record.date, season: r.record.season, p })
          Object.assign(teams, r.teams)
          added++
        }
      } catch (e) {
        const n = (failures[g.id] ?? 0) + 1
        failures[g.id] = n
        // Falha passageira: o dia fica para a próxima execução. Falha repetida: segue sem o jogo (nada estimado).
        if (n < GIVE_UP_AFTER) complete = false
        log(`${lg.key} ${day} jogo ${g.id}: ${(e as Error).message}${n >= GIVE_UP_AFTER ? ' — deixado de lado' : ` (tentativa ${n})`}`)
      }
    }
    if (!complete) blocked = true
    else if (!blocked && (!scanned || day > scanned)) scanned = day
  }

  const sorted = [...games.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  log(`${lg.key}: +${added} jogos (total ${sorted.length}), varrido até ${scanned ?? '-'}${capped ? ' — continua na próxima execução' : ''}`)
  const players: PlayersFile = {
    league: lg.key, v: HISTORY_VERSION,
    games: [...playerGames.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
  }
  return {
    players,
    file: {
      v: HISTORY_VERSION, league: lg.key, updated_at: (opts.now ?? new Date()).toISOString(), scanned_until: scanned,
      teams, games: sorted, failures,
    },
    done: !capped,
    added,
  }
}
