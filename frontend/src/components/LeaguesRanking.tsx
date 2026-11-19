import { LEAGUES } from '../espn/leagues'
import { leagueRanking } from '../rankings/compute'
import { defaultLine, metricsFor, PERIOD_LABELS, periodsFor, type Measure, type PeriodId } from '../rankings/metrics'
import type { Sport } from '../types'
import { DataStatus, Field, LineStepper, Seg, useHistory, usePref } from './RankingFilters'

const SPORTS: { value: Sport; label: string }[] = [
  { value: 'soccer', label: 'Futebol' }, { value: 'basketball', label: 'NBA' }, { value: 'football', label: 'NFL' },
]
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR')}%`)
const dec = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))

interface Prefs {
  sport: Sport; metricId: string; period: PeriodId; measure: 'avg' | 'over' | 'under'; line: number | null; window: 'season' | '30d'
}

export function LeaguesRanking() {
  const [p, set] = usePref<Prefs>('painel.rank_ligas',
    { sport: 'soccer', metricId: 'goals', period: 'full', measure: 'over', line: null, window: 'season' })
  const metrics = metricsFor(p.sport)
  const metric = metrics.find(m => m.id === p.metricId) ?? metrics[0]
  const periods = periodsFor(metric, p.sport)
  const period = periods.includes(p.period) ? p.period : 'full'
  const line = p.line ?? defaultLine(metric, p.sport, period)
  const keys = LEAGUES.filter(l => l.sport === p.sport).map(l => l.key)
  const h = useHistory(keys)

  const measure: Measure = metric.kind !== 'count' || p.measure === 'avg' ? { kind: 'avg' } : { kind: p.measure, line }
  const rows = h.loading ? [] : leagueRanking(h.files, metric.id, period, measure, p.window, new Date())
  const name = (k: string) => LEAGUES.find(l => l.key === k)?.name ?? k

  return (
    <section className="rank-page">
      <div className="toolbar rfilters">
        <Seg value={p.sport} options={SPORTS} onChange={sport => set({ sport, metricId: metricsFor(sport)[0].id, period: 'full', line: null })} />
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
        {metric.kind === 'count' && (
          <div className="rrow">
            <Seg value={p.measure} onChange={measure => set({ measure })}
              options={[{ value: 'avg', label: 'Média' }, { value: 'over', label: 'Mais de' }, { value: 'under', label: 'Menos de' }]} />
            {p.measure !== 'avg' && <LineStepper value={line} onChange={l => set({ line: l })} />}
          </div>
        )}
        <Seg value={p.window} onChange={window => set({ window })}
          options={[{ value: 'season', label: 'Temporada' }, { value: '30d', label: 'Últimos 30 dias' }]} />
      </div>
      <div className="list">
        <DataStatus meta={h.meta} games={rows.reduce((s, r) => s + r.games, 0)} loading={h.loading}
          errors={h.errors} missing={h.missing} onRetry={h.retry} />
        {!h.loading && !h.missing && (rows.length === 0
          ? <p className="empty">Sem jogos para esses filtros.</p>
          : (
            <div className="dsec">
              <div className="tscroll">
                <table className="tbl rank">
                  <thead>
                    <tr>
                      <th className="pn">Liga</th><th>J</th>
                      {metric.kind === 'count' && <th>Média</th>}
                      {metric.kind === 'count' && measure.kind !== 'avg' && <th>{measure.kind === 'over' ? 'Mais de' : 'Menos de'} {dec(line)}</th>}
                      {metric.kind === 'btts' && <th>Ambas marcam</th>}
                      {metric.kind === 'result' && <><th>Casa</th><th>Empate</th><th>Fora</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.league}>
                        <th className="pn">{name(r.league)}</th>
                        <td>{r.games}</td>
                        {metric.kind === 'count' && <td className={measure.kind === 'avg' ? 'tot' : ''}>{dec(r.avg)}</td>}
                        {metric.kind === 'count' && measure.kind !== 'avg' && <td className="tot">{pct(r.pct)}</td>}
                        {metric.kind === 'btts' && <td className="tot">{pct(r.pct)}</td>}
                        {metric.kind === 'result' && <><td className="tot">{pct(r.result?.home ?? null)}</td>
                          <td>{pct(r.result?.draw ?? null)}</td><td>{pct(r.result?.away ?? null)}</td></>}
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
