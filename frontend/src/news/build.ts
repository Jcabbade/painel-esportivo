/* Junta o resultado de uma execução do robô com o arquivo anterior. */
import { SOURCES } from './sources'
import type { NewsFile, NewsItem, SourceId, SourceStatus } from './types'

export const MAX_AGE_DAYS = 7
export const MAX_ITEMS = 400

export interface SourceResult { id: SourceId; items?: NewsItem[]; error?: string }

export function buildNews(prev: NewsFile | null, results: SourceResult[], now: Date): NewsFile {
  const byId = new Map<string, NewsItem>()
  // Itens anteriores ficam (inclusive de fontes que falharam agora); os novos substituem pelo mesmo id.
  for (const it of prev?.items ?? []) byId.set(it.id, it)
  const fresh = new Map<string, NewsItem>()
  for (const r of results) {
    for (const it of r.items ?? []) {
      const seen = fresh.get(it.id)
      // A mesma matéria pode vir em mais de uma liga (ESPN): junta as marcações.
      fresh.set(it.id, seen ? {
        ...seen,
        leagues: [...new Set([...seen.leagues, ...it.leagues])],
        teams: [...new Set([...seen.teams, ...it.teams])],
      } : it)
    }
  }
  for (const [id, it] of fresh) byId.set(id, it)

  const cutoff = now.getTime() - MAX_AGE_DAYS * 86_400_000
  const items = [...byId.values()]
    .filter(i => Date.parse(i.published) >= cutoff)
    .sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id))
    .slice(0, MAX_ITEMS)

  const results_ = new Map(results.map(r => [r.id, r]))
  const sources = {} as Record<SourceId, SourceStatus>
  for (const s of SOURCES) {
    const r = results_.get(s.id)
    const before = prev?.sources?.[s.id]
    const count = items.filter(i => i.source === s.id).length
    if (!r) sources[s.id] = before ? { ...before, name: s.name, count } : { name: s.name, ok: false, error: 'ainda não buscada', count, last_ok: null }
    else if (r.error) sources[s.id] = { name: s.name, ok: false, error: r.error, count, last_ok: before?.last_ok ?? null }
    else sources[s.id] = { name: s.name, ok: true, error: null, count, last_ok: now.toISOString() }
  }
  return { updated_at: now.toISOString(), sources, items }
}
