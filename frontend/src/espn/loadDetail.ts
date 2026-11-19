/* Busca o detalhe de um jogo na ESPN. */
import type { Game } from '../types'
import { ESPN_SITE, fetchJson, type Fetcher } from './client'
import type { GameDetail } from './detailTypes'
import { league } from './leagues'
import { parseSummary } from './summary'

export async function loadDetail(game: Game, opts: { fetch?: Fetcher } = {}): Promise<GameDetail> {
  const lg = league(game.league)
  const payload = await (opts.fetch ?? fetchJson)(`${ESPN_SITE}/${lg.path}/summary?event=${game.id}`)
  return parseSummary(game, payload)
}

/** Carregador que descarta respostas antigas: se outra busca começou depois, devolve null. */
export function createDetailLoader(fetcher?: Fetcher) {
  let seq = 0
  return {
    async load(game: Game): Promise<GameDetail | null> {
      const mine = ++seq
      try {
        const detail = await loadDetail(game, { fetch: fetcher })
        return mine === seq ? detail : null
      } catch (e) {
        if (mine !== seq) return null // erro de uma busca antiga não interessa mais
        throw e
      }
    },
    /** Invalida buscas em andamento (ex.: jogo fechado). */
    cancel() { seq++ },
  }
}

export interface DetailState { detail: GameDetail | null; error: string | null }
export type DetailResult = { ok: true; detail: GameDetail } | { ok: false; message: string }

/** Atualização falhou: mantém o último detalhe e só registra o erro. */
export function nextDetailState(prev: DetailState, result: DetailResult): DetailState {
  return result.ok ? { detail: result.detail, error: null } : { detail: prev.detail, error: result.message }
}
