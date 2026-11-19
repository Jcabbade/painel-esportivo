import { LEAGUES, league as leagueOf } from '../espn/leagues'
import { getFavorites } from '../espn/store'
import { teamRanking, type TeamOpts } from '../rankings/compute'
import { defaultLine, metricsFor, PERIOD_LABELS, periodsFor, type Measure, type PeriodId, type View } from '../rankings/metrics'
import type { Sport } from '../types'
import { DataStatus, Field, LineStepper, Seg, useHistory, usePref } from './RankingFilters'

const SOCCER_ALL = 'FUT'
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR')}%`)
const dec = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))

interface Prefs {
  scope: string; metricId: string; period: PeriodId; view: View; measure: 'avg' | 'over' | 'under'; line: number | null
  last: TeamOpts['last']; venue: TeamOpts['venue']; order: TeamOpts['order']
}

const scopeSport = (scope: string): Sport => (scope === SOCCER_ALL ? 'soccer' : leagueOf(scope).sport)
const scopeKeys = (scope: string) => (scope === SOCCER_ALL ? LEAGUES.filter(l => l.sport === 'soccer').map(l => l.key) : [scope])

export function TeamsRanking() {
  const [p, set] = usePref<Prefs>('painel.rank_times', {
    scope: SOCCER_ALL, metricId: 'goals', period: 'full', view: 'for', measure: 'avg', line: null,
    last: 10, venue: 'all', order: 'desc',
  })
  const sport = scopeSport(LEAGUES.some(l => l.key === p.scope) || p.scope === SOCCER_ALL ? p.scope : SOCCER_ALL)
  const metrics = metricsFor(sport)
  const metric = metrics.find(m => m.id === p.metricId) ?? metrics[0]
  const periods = periodsFor(metric, sport)
  const period = periods.includes(p.period) ? p.period : 'full'
  const isCount = metric.kind === 'count'
  // Linha da visão "Total" é a do jogo; em Feitos/Sofridos, metade (arredondada para x,5).
  const baseLine = defaultLine(metric, sport, period)
  const line = p.line ?? (p.view === 'total' ? baseLine : Math.floor(baseLine / 2) + 0.5)
  const h = useHistory(scopeKeys(p.scope))

  const measure: Measure = !isCount || p.measure === 'avg' ? { kind: 'avg' } : { kind: p.measure, line }
  const rows = h.loading ? [] : teamRanking(h.files, {
    metricId: metric.id, period, view: p.view, measure, last: p.last, venue: p.venue, order: p.order,
  })
  const favs = getFavorites()
  const scopes = [{ value: SOCCER_ALL, label: 'Futebol (todas)' }, ...LEAGUES.map(l => ({ value: l.key, label: l.name }))]

  return (
    <section className="rank-page">
      <div className="toolbar rfilters">
        <div className="chips">
          {scopes.map(s => (
            <button key={s.value} className={`chip ${p.scope === s.value ? 'on' : ''}`}
              onClick={() => { const sp = scopeSport(s.value); set(sp === sport ? { scope: s.value } : { scope: s.value, metricId: metricsFor(sp)[0].id, period: 'full', line: null }) }}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="rrow">
          <Field label="Estatística">
            <select value={metric.id} onChange={e => set({ metricId: e.target.value, period: 'full', line: null })}>
              {metrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          {periods.length > 1 && (
            <Field label="Período">
              <select value={period} onChange={e => set({ period: e.target.value as PeriodId, line: null })}>
                {periods.map(x => <option key={x} value={x}>{PERIOD_LABELS[x]}</option>)}
              </select>
            </Field>
          )}
        </div>
        {isCount && (
          <Seg value={p.view} onChange={view => set({ view, line: null })}
            options={[{ value: 'for', label: 'Feitos' }, { value: 'against', label: 'Sofridos' }, { value: 'total', label: 'Total' }]} />
        )}
        {isCount && (
          <div className="rrow">
            <Seg value={p.measure} onChange={measure => set({ measure })}
              options={[{ value: 'avg', label: 'Média' }, { value: 'over', label: 'Mais de' }, { value: 'under', label: 'Menos de' }]} />
            {p.measure !== 'avg' && <LineStepper value={line} onChange={l => set({ line: l })} />}
          </div>
        )}
        <div className="rrow">
          <Seg value={p.last} onChange={last => set({ last })}
            options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 15, label: '15' }, { value: 20, label: '20' }, { value: 'season', label: 'Temp.' }]} />
          <Seg value={p.venue} onChange={venue => set({ venue })}
            options={[{ value: 'all', label: 'Geral' }, { value: 'home', label: 'Casa' }, { value: 'away', label: 'Fora' }]} />
          <Seg value={p.order} onChange={order => set({ order })} options={[{ value: 'desc', label: '↓' }, { value: 'asc', label: '↑' }]} />
        </div>
      </div>
      <div className="list">
        <DataStatus files={h.files} meta={h.meta} games={h.files.reduce((s, f) => s + f.games.length, 0)} gamesLabel="jogos no histórico (a coluna J mostra os de cada time)" loading={h.loading}
          errors={h.errors} missing={h.missing} onRetry={h.retry} />
        {!h.loading && !h.missing && (rows.length === 0
          ? <p className="empty">Sem jogos para esses filtros.</p>
          : (
            <div className="dsec">
              <div className="tscroll">
                <table className="tbl rank">
                  <thead>
                    <tr>
                      <th className="rk">#</th><th className="pn">Time</th><th>J</th>
                      {isCount && <th>Média</th>}
                      {isCount && measure.kind !== 'avg' && <th>{measure.kind === 'over' ? '+' : '−'}{dec(line)}</th>}
                      {metric.kind === 'btts' && <th>Ambas</th>}
                      {metric.kind === 'result' && <><th>V</th><th>E</th><th>D</th></>}
                      {(measure.kind !== 'avg' || !isCount) && metric.kind !== 'result' && <th>Acertos</th>}
                      <th>Forma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.teamId} className={favs.has(`${sport}:${r.teamId}`) ? 'hl' : ''}>
                        <td className="rk">{i + 1}</td>
                        <th className="pn">
                          <span className="steam">
                            {r.logo ? <img className="logo" src={r.logo} alt="" width={18} height={18} loading="lazy" /> : null}
                            <span>{r.name}</span>
                          </span>
                        </th>
                        <td>{r.games}</td>
                        {isCount && <td className={measure.kind === 'avg' ? 'tot' : ''}>{dec(r.avg)}</td>}
                        {isCount && measure.kind !== 'avg' && <td className="tot">{pct(r.pct)}</td>}
                        {metric.kind === 'btts' && <td className="tot">{pct(r.pct)}</td>}
                        {metric.kind === 'result' && <><td className="tot">{pct(r.result?.w ?? null)}</td>
                          <td>{pct(r.result?.d ?? null)}</td><td>{pct(r.result?.l ?? null)}</td></>}
                        {(measure.kind !== 'avg' || !isCount) && metric.kind !== 'result' && <td>{r.hits}/{r.games}</td>}
                        <td><span className="form">{r.form.map((f, j) => <i key={j} className={`f-${f}`}>{f}</i>)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>
      <footer className="foot">Calculado a partir dos jogos encerrados registrados pela ESPN</footer>
    </section>
  )
}
