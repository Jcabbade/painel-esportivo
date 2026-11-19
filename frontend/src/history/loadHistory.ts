/* Histórico publicado junto com o site (public/data/), lido pelo navegador. */
import type { LeagueFile, Meta } from './types'

export class HistoryMissing extends Error {
  constructor() { super('O histórico ainda está sendo montado.') }
}

const files = new Map<string, Promise<LeagueFile>>()
let meta: Promise<Meta> | null = null

async function getJson<T>(name: string): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${import.meta.env.BASE_URL}data/${name}`, { cache: 'no-cache' })
  } catch {
    throw new Error('sem conexão')
  }
  if (r.status === 404) throw new HistoryMissing()
  if (!r.ok) throw new Error(`o site respondeu ${r.status}`)
  try { return await r.json() as T } catch { throw new Error('arquivo de histórico inválido') }
}

/** Fica em memória enquanto a aba estiver aberta (o robô atualiza 1×/dia). Falha não fica guardada. */
export function loadHistory(leagueKey: string): Promise<LeagueFile> {
  let p = files.get(leagueKey)
  if (!p) {
    p = getJson<LeagueFile>(`games-${leagueKey}.json`)
    p.catch(() => files.delete(leagueKey))
    files.set(leagueKey, p)
  }
  return p
}

export function loadMeta(): Promise<Meta> {
  if (!meta) {
    meta = getJson<Meta>('meta.json')
    meta.catch(() => { meta = null })
  }
  return meta
}
