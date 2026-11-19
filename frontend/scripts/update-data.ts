/* Robô diário do histórico: atualiza games-<LIGA>.json e meta.json na pasta indicada.
   Uso: npm run update-data -- <pasta>   (UPDATE_START=AAAA-MM-DD e UPDATE_MAX=n são opcionais, para testes) */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LEAGUES } from '../src/espn/leagues'
import { localToday } from '../src/lib/dates'
import type { LeagueFile, Meta, PlayersFile } from '../src/history/types'
import { updateLeague } from '../src/history/update'

const UA = 'PainelEsportivo/1.0'

async function get(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20_000)
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } })
      if (!r.ok) throw new Error(`ESPN respondeu ${r.status}`)
      return await r.json()
    } catch (e) {
      if (attempt >= 3) throw new Error(ctrl.signal.aborted ? 'ESPN não respondeu a tempo' : (e as Error).message)
      await new Promise(r => setTimeout(r, 2000 * attempt))
    } finally {
      clearTimeout(t)
    }
  }
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf-8')) as T } catch (e) {
    console.error(`${path} ilegível (${(e as Error).message}): recomeçando esta liga`)
    return null
  }
}

/** Grava num arquivo temporário e renomeia: uma interrupção nunca deixa JSON pela metade. */
function writeJson(path: string, data: unknown) {
  writeFileSync(`${path}.tmp`, JSON.stringify(data))
  renameSync(`${path}.tmp`, path)
}

async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('informe a pasta: npm run update-data -- <pasta>')
  mkdirSync(dir, { recursive: true })
  const meta: Meta = readJson<Meta>(join(dir, 'meta.json')) ?? { updated_at: '', leagues: {} }
  const today = localToday()
  const max = process.env.UPDATE_MAX ? Number(process.env.UPDATE_MAX) : undefined
  const start = process.env.UPDATE_START || undefined
  // Tempo máximo de trabalho (o passo do GitHub tem 300 min): para antes, sempre gravando o que fez.
  const deadline = Date.now() + Number(process.env.UPDATE_BUDGET_MIN ?? 240) * 60_000
  let failures = 0, pending = 0

  for (const l of LEAGUES) {
    const path = join(dir, `games-${l.key}.json`)
    const ppath = join(dir, `players-${l.key}.json`)
    const prev = readJson<LeagueFile>(path)
    const prevPlayers = readJson<PlayersFile>(ppath)
    try {
      const { file, players, done } = await updateLeague(prev, l.key,
        { fetch: get, today, start, maxSummaries: max, log: console.log, deadline, players: prevPlayers })
      writeJson(path, file)
      writeJson(ppath, players)
      meta.leagues[l.key] = { games: file.games.length, scanned_until: file.scanned_until, error: null, pending: !done }
      if (!done) pending++
    } catch (e) {
      failures++
      const msg = (e as Error).message
      console.error(`${l.key}: ERRO ${msg}`)
      meta.leagues[l.key] = { games: prev?.games.length ?? 0, scanned_until: prev?.scanned_until ?? null, error: msg, pending: meta.leagues[l.key]?.pending ?? true }
    }
  }
  meta.updated_at = new Date().toISOString()
  writeJson(join(dir, 'meta.json'), meta)
  console.log(`concluído: ${LEAGUES.length - failures} ligas ok, ${failures} com erro, ${pending} com carga pendente`)
  if (pending) console.log('CARGA_PENDENTE')
  if (failures === LEAGUES.length) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
