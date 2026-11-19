export const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports'
export const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports'

export type Fetcher = (url: string) => Promise<unknown>

/** GET na ESPN com tempo limite; erros com mensagem em português. */
export async function fetchJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let r: Response
  try {
    r = await fetch(url, { signal: ctrl.signal })
  } catch {
    throw new Error(ctrl.signal.aborted ? 'ESPN não respondeu a tempo' : 'sem conexão com a ESPN')
  } finally {
    clearTimeout(timer)
  }
  if (!r.ok) throw new Error(`ESPN respondeu ${r.status}`)
  try {
    return await r.json()
  } catch {
    throw new Error('resposta inválida da ESPN')
  }
}
