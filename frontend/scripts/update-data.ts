/* Robô diário do histórico: atualiza games-<LIGA>.json e meta.json na pasta indicada.
   Uso: npm run update-data -- <pasta>   (UPDATE_START=AAAA-MM-DD e UPDATE_MAX=n são opcionais, para testes) */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LEAGUES } from '../src/espn/leagues'
import { localToday } from '../src/lib/dates'
import type { LeagueFile, Meta } from '../src/history/types'
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

const readJson = <T>(path: string): T | null => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) as T : null)

async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('informe a pasta: npm run update-data -- <pasta>')
  mkdirSync(dir, { recursive: true })
  const meta: Meta = readJson<Meta>(join(dir, 'meta.json')) ?? { updated_at: '', leagues: {} }
  const today = localToday()
  const max = process.env.UPDATE_MAX ? Number(process.env.UPDATE_MAX) : undefined
  const start = process.env.UPDATE_START || undefined
  let failures = 0, pending = 0

  for (const l of LEAGUES) {
    const path = join(dir, `games-${l.key}.json`)
    const prev = readJson<LeagueFile>(path)
    try {
      const { file, done } = await updateLeague(prev, l.key, { fetch: get, today, start, maxSummaries: max, log: console.log })
      writeFileSync(path, JSON.stringify(file))
      meta.leagues[l.key] = { games: file.games.length, scanned_until: file.scanned_until, error: null }
      if (!done) pending++
    } catch (e) {
      failures++
      const msg = (e as Error).message
      console.error(`${l.key}: ERRO ${msg}`)
      meta.leagues[l.key] = { games: prev?.games.length ?? 0, scanned_until: prev?.scanned_until ?? null, error: msg }
    }
  }
  meta.updated_at = new Date().toISOString()
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta))
  console.log(`concluído: ${LEAGUES.length - failures} ligas ok, ${failures} com erro, ${pending} com carga pendente`)
  if (pending) console.log('CARGA_PENDENTE')
  if (failures === LEAGUES.length) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
