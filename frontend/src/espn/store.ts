/* Dados guardados no aparelho: favoritos e cache de classificação.
   Sem armazenamento (aba anônima, bloqueio), tudo funciona só na memória da aba. */

const FAV_KEY = 'painel.favoritos'
const RANKS_KEY = (league: string) => `painel.classificacao.${league}`
const RANKS_TTL = 6 * 3600 * 1000

let favMemory: Set<string> | null = null
const ranksMemory = new Map<string, { at: number; ranks: Record<string, number> }>()

function read(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null } catch { return null }
}
function write(key: string, value: string): void {
  try { globalThis.localStorage?.setItem(key, value) } catch { /* sem armazenamento: só memória */ }
}

/** Só para testes: esquece o que está em memória. */
export function _resetMemory(): void {
  favMemory = null
  ranksMemory.clear()
}

export function getFavorites(): Set<string> {
  if (!favMemory) {
    try { favMemory = new Set(JSON.parse(read(FAV_KEY) ?? '[]') as string[]) } catch { favMemory = new Set() }
  }
  return favMemory
}

/** Liga/desliga o favorito; devolve o novo estado. */
export function toggleFavorite(sport: string, teamId: string): boolean {
  const favs = getFavorites()
  const key = `${sport}:${teamId}`
  const on = !favs.has(key)
  if (on) favs.add(key); else favs.delete(key)
  write(FAV_KEY, JSON.stringify([...favs]))
  return on
}

export function getCachedRanks(league: string, now: Date = new Date()): Record<string, number> | null {
  let entry = ranksMemory.get(league)
  if (!entry) {
    try { entry = JSON.parse(read(RANKS_KEY(league)) ?? 'null') ?? undefined } catch { entry = undefined }
  }
  if (!entry || now.getTime() - entry.at > RANKS_TTL) return null
  return entry.ranks
}

export function setCachedRanks(league: string, ranks: Record<string, number>, now: Date = new Date()): void {
  const entry = { at: now.getTime(), ranks }
  ranksMemory.set(league, entry)
  write(RANKS_KEY(league), JSON.stringify(entry))
}
