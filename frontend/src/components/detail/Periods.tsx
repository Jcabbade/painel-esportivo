import type { GameDetail } from '../../espn/detailTypes'
import type { Game } from '../../types'
import { Section } from './Section'

export function Periods({ game, periods }: { game: Game; periods: NonNullable<GameDetail['periods']> }) {
  const row = (name: string, vals: string[], total: number | null) => (
    <tr><th>{name}</th>{vals.map((v, i) => <td key={i}>{v}</td>)}<td className="tot">{total ?? ''}</td></tr>
  )
  return (
    <Section title="Placar por período">
      <div className="tscroll">
        <table className="tbl periods">
          <thead><tr><th />{periods.labels.map(l => <th key={l}>{l}</th>)}<th className="tot">T</th></tr></thead>
          <tbody>
            {row(game.home.abbrev || game.home.short_name, periods.home, game.home.score)}
            {row(game.away.abbrev || game.away.short_name, periods.away, game.away.score)}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
