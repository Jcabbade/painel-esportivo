import { useEffect, useState } from 'react'
import { PLAYER_STATS, playerRanking } from '../../analysis/players'
import type { GameDetail } from '../../espn/detailTypes'
import { HistoryMissing, loadPlayers } from '../../history/loadHistory'
import type { PlayersFile } from '../../history/types'
import type { Game } from '../../types'
import { Section } from '../detail/Section'
import { Seg, usePref } from '../RankingFilters'
import { dec, teamName } from './common'

export function PlayersTab({ game, detail }: { game: Game; detail: GameDetail | null }) {
  const stats = PLAYER_STATS[game.sport]
  const [p, set] = usePref('painel.jogadores', { stat: stats[0].key, team: 'both' as 'both' | 'home' | 'away', onlyLineup: true })
  const stat = stats.some(s => s.key === p.stat) ? p.stat : stats[0].key
  const [pf, setPf] = useState<PlayersFile | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setPf(null); setErr(null)
    loadPlayers(game.league).then(f => { if (alive) setPf(f) })
      .catch(e => { if (alive) setErr(e instanceof HistoryMissing ? 'missing' : (e as Error).message) })
    return () => { alive = false }
  }, [game.league, attempt])

  const starters = detail?.lineups
    ? new Set([...detail.lineups.home.starters, ...detail.lineups.away.starters].map(x => x.id).filter((x): x is string => !!x)) : null
  const teams = p.team === 'home' ? [game.home.team_id] : p.team === 'away' ? [game.away.team_id] : [game.home.team_id, game.away.team_id]
  const rows = pf ? playerRanking(pf, teams, stat, { last: 10, onlyIds: p.onlyLineup && starters?.size ? starters : undefined }) : []
  const teamLabel = (id: string) => (id === game.home.team_id ? game.home.abbrev : id === game.away.team_id ? game.away.abbrev : id)

  if (err === 'missing') return <p className="soon">O histórico de jogadores ainda está sendo montado. Volte mais tarde.</p>
  if (err) return <div className="derr"><p>Não foi possível carregar os jogadores ({err}).</p><button onClick={() => setAttempt(a => a + 1)}>Tentar de novo</button></div>
  if (!pf) return <p className="soon">Carregando jogadores…</p>
  return (
    <>
      <div className="chips tabfilters">
        {stats.map(s => <button key={s.key} className={`chip ${stat === s.key ? 'on' : ''}`} onClick={() => set({ stat: s.key })}>{s.label}</button>)}
      </div>
      <div className="rrow tabfilters">
        <Seg value={p.team} onChange={team => set({ team })} options={[
          { value: 'both', label: 'Ambos' }, { value: 'home', label: teamName(game, 'home') }, { value: 'away', label: teamName(game, 'away') }]} />
        {starters && starters.size > 0 && (
          <Seg value={p.onlyLineup ? 'y' : 'n'} onChange={v => set({ onlyLineup: v === 'y' })}
            options={[{ value: 'y', label: 'Só titulares' }, { value: 'n', label: '+ Elenco' }]} />
        )}
      </div>
      <Section title={`Média nos últimos 10 jogos em que entraram (${game.league})`}>
        {rows.length === 0 ? <p className="muted small">Sem jogadores com esse número no histórico.</p> : (
          <ul className="plrank">
            {rows.slice(0, 40).map((r, i) => (
              <li key={r.id}>
                <span className="rk">{i + 1}º</span>
                <span className="plname"><b>{r.name}</b><small>{teamLabel(r.team)} · média {dec(r.avg)} · {r.n} jogos</small></span>
                <span className="plseq">{r.seq.map((v, j) => <i key={j} className={v > 0 ? 'on' : ''}>{v}</i>)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
