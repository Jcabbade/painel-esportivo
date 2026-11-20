import { cornerProfile } from '../../analysis/corners'
import { historyNotice } from '../../analysis/notice'
import type { GameDetail } from '../../espn/detailTypes'
import { CORNER_BUCKETS } from '../../history/players'
import type { LeagueFile } from '../../history/types'
import type { Game } from '../../types'
import { Section } from '../detail/Section'
import { Seg, usePref } from '../RankingFilters'
import { dec, HistoryGate, teamName, useSportHistory } from './common'

type View = 'for' | 'against' | 'total'

function Profile({ files, id, title, venue, view, before }: { files: LeagueFile[]; id: string; title: string; venue: 'all' | 'home' | 'away'; view: View; before: string }) {
  const p = cornerProfile(files, id, { last: 10, venue, view, before })
  return (
    <div className="cprof">
      <div className="lhead"><b>{title}</b><span>{p.n} jogos</span></div>
      {p.n === 0 ? <p className="muted small">Sem jogos com escanteios por minuto no histórico.</p> : (
        <div className="tscroll">
          <table className="tbl cbk">
            <thead><tr><th className="pn">Faixa</th><th>Média</th><th>Total</th></tr></thead>
            <tbody>
              {p.buckets.map(b => (
                <tr key={b.label}><th className="pn">{b.label}</th><td className="tot">{dec(b.avg)}</td><td>{b.total}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function CornersTab({ game, detail }: { game: Game; detail: GameDetail | null }) {
  const h = useSportHistory('soccer')
  const [p, set] = usePref('painel.escanteios', { view: 'for' as View, split: false })
  const cur = detail?.corners
  return (
    <HistoryGate h={h}>
      <div className="rrow tabfilters">
        <Seg value={p.view} onChange={view => set({ view })} options={[{ value: 'for', label: 'Feitos' }, { value: 'against', label: 'Sofridos' }, { value: 'total', label: 'Total' }]} />
        <Seg value={p.split ? 'split' : 'all'} onChange={v => set({ split: v === 'split' })}
          options={[{ value: 'all', label: 'Geral' }, { value: 'split', label: 'Mandante em casa · visitante fora' }]} />
      </div>
      {cur && (
        <Section title="Neste jogo">
          <div className="tscroll">
            <table className="tbl cbk">
              <thead><tr><th className="pn">Time</th>{CORNER_BUCKETS.map(b => <th key={b}>{b}</th>)}</tr></thead>
              <tbody>
                <tr><th className="pn">{teamName(game, 'home')}</th>{cur.h.map((v, i) => <td key={i}>{v}</td>)}</tr>
                <tr><th className="pn">{teamName(game, 'away')}</th>{cur.a.map((v, i) => <td key={i}>{v}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {historyNotice(h.files, h.meta)?.kind === 'old'
        ? <p className="soon">Os escanteios por minuto chegam quando o histórico terminar de ser atualizado.</p>
        : <Section title="Escanteios por faixa de 10 minutos (últimos 10 jogos)">
        <div className="oppgrid">
          <Profile files={h.files} id={game.home.team_id} title={teamName(game, 'home')} venue={p.split ? 'home' : 'all'} view={p.view} before={game.start_utc} />
          <Profile files={h.files} id={game.away.team_id} title={teamName(game, 'away')} venue={p.split ? 'away' : 'all'} view={p.view} before={game.start_utc} />
        </div>
      </Section>}
    </HistoryGate>
  )
}
