/* Plano B: quando o arquivo do robô está velho, o navegador busca a ESPN Brasil direto (CORS liberado). */
import { ESPN_STANDINGS, fetchJson, type Fetcher } from '../espn/client'
import { LEAGUES } from '../espn/leagues'
import { parseSource } from './parse'
import { SOURCES } from './sources'
import { buildTeamIndex } from './teams'
import type { NewsItem } from './types'

/** Notícias da ESPN de todas as ligas. Falha só se todas as ligas falharem. */
export async function fetchLiveEspn(fetch: Fetcher = fetchJson): Promise<NewsItem[]> {
  const espn = SOURCES.find(s => s.id === 'espn')!
  const standings = (await Promise.all(LEAGUES.map(l =>
    fetch(`${ESPN_STANDINGS}/${l.path}/standings`)
      .then(payload => ({ league: l.key, sport: l.sport, payload }))
      .catch(() => null),
  ))).filter(s => s !== null)
  const index = buildTeamIndex(standings)
  const results = await Promise.all(espn.urls.map((url, i) =>
    fetch(url).then(body => parseSource('espn', body, { index, league: espn.leagues[i] })).catch(() => null)))
  if (results.every(r => r === null)) throw new Error('ESPN não respondeu')
  return results.flatMap(r => r ?? [])
}
