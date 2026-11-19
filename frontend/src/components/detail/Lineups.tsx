import type { Lineup, LineupPlayer } from '../../espn/detailTypes'
import type { Game } from '../../types'
import { Section } from './Section'

function Player({ p }: { p: LineupPlayer }) {
  return (
    <li>
      <span className="num">{p.number ?? ''}</span>
      <span className="pname">{p.name}</span>
      {p.subbedIn && <span className="in" title="Entrou">↑</span>}
      {p.subbedOut && <span className="out" title="Saiu">↓</span>}
      <span className="pos">{p.position ?? ''}</span>
    </li>
  )
}

function Col({ name, l }: { name: string; l: Lineup }) {
  return (
    <div className="lcol">
      <div className="lhead"><b>{name}</b>{l.formation && <span>{l.formation}</span>}</div>
      <ul className="plist">{l.starters.map((p, i) => <Player key={i} p={p} />)}</ul>
      {l.bench.length > 0 && <>
        <div className="lsub">Reservas</div>
        <ul className="plist bench">{l.bench.map((p, i) => <Player key={i} p={p} />)}</ul>
      </>}
    </div>
  )
}

export function Lineups({ game, lineups }: { game: Game; lineups: { home: Lineup; away: Lineup } }) {
  return (
    <Section title="Escalações">
      <div className="lineups">
        <Col name={game.home.short_name} l={lineups.home} />
        <Col name={game.away.short_name} l={lineups.away} />
      </div>
    </Section>
  )
}
