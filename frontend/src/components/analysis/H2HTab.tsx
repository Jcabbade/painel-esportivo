import { form, headToHead, recentVenue } from '../../analysis/h2h'
import type { LeagueFile } from '../../history/types'
import type { Game } from '../../types'
import { Section } from '../detail/Section'
import { Seg, usePref } from '../RankingFilters'
import { FormDots, HistoryGate, teamName, useSportHistory } from './common'

const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit' })

function Recent({ files, id, title, venue, before }: { files: LeagueFile[]; id: string; title: string; venue: 'all' | 'home' | 'away'; before: string }) {
  const rows = form(files, id, 10, venue, before)
  return (
    <div className="recent">
      <div className="lhead"><b>{title}</b><FormDots res={rows.slice(0, 5).map(r => r.res)} /></div>
      {rows.length === 0 ? <p className="muted small">Sem jogos no histórico.</p> : (
        <ul className="h2h">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="h2h-date">{fmt.format(new Date(r.date))}</span>
              <span className="h2h-home">{r.home ? 'Casa' : 'Fora'} · {r.oppName}</span>
              <b className="h2h-score">{r.gf} – {r.ga}</b>
              <span><i className={`f-${r.res} dot`}>{r.res}</i></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function H2HTab({ game }: { game: Game }) {
  const h = useSportHistory(game.sport)
  const [p, set] = usePref('painel.h2h', { filter: 'total' as 'total' | 'aHome' | 'bHome' })
  const a = game.home.team_id, b = game.away.team_id
  const r = headToHead(h.files, a, b, p.filter, game.start_utc)
  const names = new Map(h.files.flatMap(f => Object.entries(f.teams).map(([id, t]) => [id, t.name] as const)))
  const total = r.aWins + r.draws + r.bWins
  return (
    <HistoryGate h={h}>
      <div className="rrow tabfilters">
        <Seg value={p.filter} onChange={filter => set({ filter })} options={[
          { value: 'total', label: 'Total' },
          { value: 'aHome', label: `${teamName(game, 'home')} em casa` },
          { value: 'bHome', label: `${teamName(game, 'away')} em casa` },
        ]} />
      </div>
      <Section title="Confrontos diretos (histórico)">
        {total === 0 ? <p className="muted small">Nenhum confronto entre os dois no histórico (desde jul/2025).</p> : (
          <>
            <div className="h2hbar">
              <span>{r.aWins} vitória{r.aWins === 1 ? '' : 's'}</span><span>{r.draws} empate{r.draws === 1 ? '' : 's'}</span><span>{r.bWins} vitória{r.bWins === 1 ? '' : 's'}</span>
            </div>
            <div className="h2hmeter">
              <i style={{ flex: r.aWins }} className="a" /><i style={{ flex: r.draws }} className="d" /><i style={{ flex: r.bWins }} className="b" />
            </div>
            <ul className="h2h">
              {r.games.map(g => (
                <li key={g.id}>
                  <span className="h2h-date">{fmt.format(new Date(g.date))}</span>
                  <span className="h2h-home">{names.get(g.h) ?? g.h}</span>
                  <b className="h2h-score">{g.hs} – {g.as}</b>
                  <span className="h2h-away">{names.get(g.a) ?? g.a}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
      <Section title="Últimos jogos">
        <div className="oppgrid">
          <Recent files={h.files} id={a} title={teamName(game, 'home')} venue={recentVenue(p.filter, 'home')} before={game.start_utc} />
          <Recent files={h.files} id={b} title={teamName(game, 'away')} venue={recentVenue(p.filter, 'away')} before={game.start_utc} />
        </div>
      </Section>
    </HistoryGate>
  )
}
