import { formationLayout } from '../../analysis/formation'
import type { GameDetail, Lineup } from '../../espn/detailTypes'
import type { Game } from '../../types'
import { Lineups } from '../detail/Lineups'

const shortName = (n: string) => { const parts = n.split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : n }

function Pitch({ title, l, side }: { title: string; l: Lineup; side: 'home' | 'away' }) {
  const rows = formationLayout(l.formation, l.starters)
  return (
    <div className="pitchwrap">
      <div className="lhead"><b>{title}</b>{l.formation && <span>{l.formation}</span>}</div>
      <div className={`pitch ${side}`}>
        {[...rows].reverse().map((row, i) => (
          <div key={i} className="prow">
            {row.map((p, j) => (
              <div key={p.id ?? j} className="pp" title={`${p.name}${p.position ? ` · ${p.position}` : ''}`}>
                <span className="pnum">{p.number ?? ''}</span>
                <span className="pname">{shortName(p.name)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LineupTab({ game, detail }: { game: Game; detail: GameDetail | null }) {
  const l = detail?.lineups
  if (!l) return <p className="soon">Escalação ainda não divulgada.</p>
  return (
    <>
      <div className="pitches">
        <Pitch title={game.home.short_name || game.home.name} l={l.home} side="home" />
        <Pitch title={game.away.short_name || game.away.name} l={l.away} side="away" />
      </div>
      <Lineups game={game} lineups={l} />
    </>
  )
}
