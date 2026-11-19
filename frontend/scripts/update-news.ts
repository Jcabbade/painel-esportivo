/* Robô de notícias: busca as fontes, junta com o arquivo anterior e grava.
   Uso: npm run update-news -- <caminho/news.json> */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ESPN_STANDINGS } from '../src/espn/client'
import { LEAGUES } from '../src/espn/leagues'
import { buildNews, type SourceResult } from '../src/news/build'
import { parseSource } from '../src/news/parse'
import { SOURCES } from '../src/news/sources'
import { buildTeamIndex } from '../src/news/teams'
import type { NewsFile, NewsItem } from '../src/news/types'

const UA = 'PainelEsportivo/1.0'
const TIMEOUT = 20_000

async function get(url: string, json: boolean): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error(`respondeu ${r.status}`)
    return json ? await r.json() : await r.text()
  } catch (e) {
    throw new Error(ctrl.signal.aborted ? 'não respondeu a tempo' : e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  const out = process.argv[2]
  if (!out) throw new Error('informe o arquivo de saída: npm run update-news -- <news.json>')
  const prev: NewsFile | null = existsSync(out) ? JSON.parse(readFileSync(out, 'utf-8')) : null

  const standings = []
  for (const l of LEAGUES) {
    try {
      standings.push({ league: l.key, sport: l.sport, payload: await get(`${ESPN_STANDINGS}/${l.path}/standings`, true) })
    } catch (e) {
      console.warn(`classificação ${l.key}: ${(e as Error).message}`)
    }
  }
  const index = buildTeamIndex(standings)

  const results: SourceResult[] = []
  for (const s of SOURCES) {
    const items: NewsItem[] = []
    const errors: string[] = []
    for (let i = 0; i < s.urls.length; i++) {
      try {
        const body = await get(s.urls[i], s.kind === 'espn')
        items.push(...parseSource(s.id, body, { index, league: s.kind === 'espn' ? s.leagues[i] : undefined }))
      } catch (e) {
        errors.push(`${s.kind === 'espn' ? s.leagues[i] + ': ' : ''}${(e as Error).message}`)
      }
    }
    // Fonte com várias URLs (ESPN): falha só se todas falharem.
    results.push(errors.length === s.urls.length ? { id: s.id, error: errors.join('; ') } : { id: s.id, items })
    console.log(`${s.name}: ${items.length} itens${errors.length ? ` (falhas: ${errors.join('; ')})` : ''}`)
  }

  const file = buildNews(prev, results, new Date())
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(file))
  console.log(`gravado ${out}: ${file.items.length} notícias`)
  if (results.every(r => r.error)) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
