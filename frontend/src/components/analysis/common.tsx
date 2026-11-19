/* Peças comuns às abas de análise. */
import { LEAGUES } from '../../espn/leagues'
import type { LeagueFile } from '../../history/types'
import type { Game, Sport } from '../../types'
import { useHistory } from '../RankingFilters'

export const dec = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Arquivos de histórico de todas as ligas do esporte do jogo. */
export function useSportHistory(sport: Sport) {
  return useHistory(LEAGUES.filter(l => l.sport === sport).map(l => l.key))
}

export function HistoryGate({ h, children }: {
  h: { loading: boolean; missing: boolean; errors: string[]; files: LeagueFile[]; retry: () => void }
  children: React.ReactNode
}) {
  if (h.loading) return <p className="soon">Carregando histórico…</p>
  if (h.missing) return <p className="soon">O histórico ainda está sendo montado. Volte mais tarde.</p>
  if (!h.files.length) {
    return (
      <div className="derr">
        <p>Não foi possível carregar o histórico ({h.errors.join('; ')}).</p>
        <button onClick={h.retry}>Tentar de novo</button>
      </div>
    )
  }
  return <>{children}</>
}

export function FormDots({ res }: { res: ('V' | 'E' | 'D')[] }) {
  return <span className="form">{res.map((r, i) => <i key={i} className={`f-${r}`}>{r}</i>)}</span>
}

export const teamName = (g: Game, side: 'home' | 'away') => g[side].short_name || g[side].name
