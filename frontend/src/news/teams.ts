/* Times citados num texto de notícia, pelo nome (sem acento, com limite de palavra). */
import type { Sport } from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Nome em português → displayName da ESPN. */
export const ALIASES: Record<string, string> = {
  'Bayern de Munique': 'Bayern Munich',
  'Inter de Milão': 'Internazionale',
  'Inter': 'Internazionale',
  'Barça': 'Barcelona',
  'Atlético de Madrid': 'Atlético Madrid',
  'Milan': 'AC Milan',
  'Juve': 'Juventus',
  'Tottenham': 'Tottenham Hotspur',
  'PSG': 'Paris Saint-Germain',
  'Leverkusen': 'Bayer Leverkusen',
  'Dortmund': 'Borussia Dortmund',
}

/** Nomes de time que são palavras comuns em português: nunca contam. */
const COMMON_WORDS = new Set(['como', 'levante', 'granada'])

export interface TeamIndex {
  /** nome normalizado → chaves 'sport:id' (mais de uma = ambíguo) */
  names: Map<string, Set<string>>
}

export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function buildTeamIndex(standings: { league: string; sport: Sport; payload: unknown }[]): TeamIndex {
  const names = new Map<string, Set<string>>()
  const byDisplay = new Map<string, Set<string>>()
  const add = (name: unknown, key: string) => {
    if (typeof name !== 'string' || name.trim().length < 3) return
    const n = norm(name.trim())
    if (COMMON_WORDS.has(n)) return
    if (!names.has(n)) names.set(n, new Set())
    names.get(n)!.add(key)
  }
  const walk = (node: any, sport: Sport) => {
    for (const e of node?.standings?.entries ?? []) {
      const t = e?.team
      if (t?.id == null) continue
      const key = `${sport}:${t.id}`
      for (const n of [t.displayName, t.shortDisplayName, t.name]) add(n, key)
      if (typeof t.displayName === 'string') {
        const d = norm(t.displayName)
        if (!byDisplay.has(d)) byDisplay.set(d, new Set())
        byDisplay.get(d)!.add(key)
      }
    }
    for (const c of node?.children ?? []) walk(c, sport)
  }
  for (const s of standings) for (const c of (s.payload as any)?.children ?? []) walk(c, s.sport)
  for (const [alias, display] of Object.entries(ALIASES)) {
    for (const key of byDisplay.get(norm(display)) ?? []) add(alias, key)
  }
  return { names }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Chaves 'sport:id' dos times citados, sem repetir, na ordem em que aparecem. */
export function matchTeams(text: string, index: TeamIndex, sport?: Sport): string[] {
  const t = norm(text)
  const found = new Map<string, number>()
  for (const [name, keys] of index.names) {
    const cand = [...keys].filter(k => !sport || k.startsWith(`${sport}:`))
    if (cand.length !== 1) continue // nome ambíguo (ou de outro esporte): não conta sozinho
    const m = new RegExp(`(^|[^a-z0-9])${escape(name)}($|[^a-z0-9])`).exec(t)
    if (!m) continue
    const pos = m.index + m[1].length
    const key = cand[0]
    if (!found.has(key) || pos < found.get(key)!) found.set(key, pos)
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k)
}
