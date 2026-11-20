import { compare, opportunities, type Opportunity } from '../../analysis/pregame'
import type { Game } from '../../types'
import { Section } from '../detail/Section'
import { Seg, usePref } from '../RankingFilters'
import { dec, HistoryGate, teamName, useSportHistory } from './common'

function OppCard({ title, items }: { title: string; items: Opportunity[] }) {
  return (
    <div className="oppcard">
      <div className="lsub">{title}</div>
      {items.length === 0
        ? <p className="muted small">Nenhuma estatística bateu a linha em 70% dos últimos jogos.</p>
        : items.map(o => (
          <div key={o.metric} className="opp">
            <span><b>{o.label}</b><small>{o.kind === 'over' ? 'Mais de' : 'Menos de'} {dec(o.line)} · média {dec(o.avg)}</small></span>
            <b className="opp-hits">{o.hits}/{o.n}</b>
          </div>
        ))}
    </div>
  )
}

export function PregameTab({ game }: { game: Game }) {
  const h = useSportHistory(game.sport)
  const [p, set] = usePref('painel.prejogo', { last: 10 as 5 | 10, split: false })
  const rows = compare(h.files, game.home.team_id, game.away.team_id, game.sport, { last: p.last, venueSplit: p.split, before: game.start_utc })
  const nH = Math.max(0, ...rows.map(r => r.home.n)), nA = Math.max(0, ...rows.map(r => r.away.n))
  const opp = (id: string, venue: 'home' | 'away') =>
    opportunities(h.files, id, game.sport, { last: 10, venue: p.split ? venue : 'all', before: game.start_utc })
  const hi = (a: number | null, b: number | null) => (a !== null && b !== null && a > b ? 'hi' : '')
  return (
    <HistoryGate h={h}>
      <div className="rrow tabfilters">
        <Seg value={p.last} onChange={last => set({ last })} options={[{ value: 5, label: 'Últimos 5' }, { value: 10, label: 'Últimos 10' }]} />
        <Seg value={p.split ? 'split' : 'all'} onChange={v => set({ split: v === 'split' })}
          options={[{ value: 'all', label: 'Geral' }, { value: 'split', label: 'Mandante em casa · visitante fora' }]} />
      </div>
      <Section title="Comparativo de médias">
        {nH === 0 && nA === 0
          ? <p className="muted small">Sem jogos no histórico para estes times.</p>
          : (
            <div className="tscroll">
              <table className="tbl cmp">
                <thead>
                  <tr><th rowSpan={2} className="pn">Estatística</th><th colSpan={2}>{teamName(game, 'home')} ({nH})</th><th colSpan={2}>{teamName(game, 'away')} ({nA})</th></tr>
                  <tr><th>Feitos</th><th>Sofridos</th><th>Feitos</th><th>Sofridos</th></tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.metric}>
                      <th className="pn">{r.label}</th>
                      <td className={hi(r.home.for, r.away.for)}>{dec(r.home.for)}</td><td>{dec(r.home.against)}</td>
                      <td className={hi(r.away.for, r.home.for)}>{dec(r.away.for)}</td><td>{dec(r.away.against)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Section>
      <Section title="Oportunidades (últimos 10 jogos)">
        <div className="oppgrid">
          <OppCard title={`${teamName(game, 'home')} · mandante`} items={opp(game.home.team_id, 'home')} />
          <OppCard title={`${teamName(game, 'away')} · visitante`} items={opp(game.away.team_id, 'away')} />
        </div>
      </Section>
    </HistoryGate>
  )
}
