import { STANDING_COLUMNS, type StandingGroup } from '../espn/standings'
import type { Sport } from '../types'

const COMPACT: Record<Sport, string[]> = {
  soccer: ['gamesPlayed', 'pointDifferential', 'points'],
  basketball: ['wins', 'losses', 'gamesBehind'],
  football: ['wins', 'losses', 'ties'],
}

interface Props {
  groups: StandingGroup[]
  sport: Sport
  highlight?: Set<string>
  compact?: boolean
}

export function StandingsTable({ groups, sport, highlight, compact }: Props) {
  const cols = STANDING_COLUMNS[sport].filter(c => !compact || COMPACT[sport].includes(c.key))
  return (
    <>
      {groups.map(g => (
        <div key={g.name} className="sgroup">
          {groups.length > 1 || sport !== 'soccer' ? <div className="lsub">{g.name}</div> : null}
          <div className="tscroll">
            <table className="tbl standings">
              <thead>
                <tr><th className="rk">#</th><th className="pn">Time</th>{cols.map(c => <th key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {g.rows.map(r => (
                  <tr key={r.teamId} className={highlight?.has(r.teamId) ? 'hl' : ''}>
                    <td className="rk" title={r.zone?.label}
                      style={r.zone ? { boxShadow: `inset 3px 0 0 ${r.zone.color}` } : undefined}>{r.rank}</td>
                    <th className="pn">
                      <span className="steam">
                        {r.logo ? <img className="logo" src={r.logo} alt="" width={18} height={18} loading="lazy" /> : null}
                        <span>{r.name}</span>
                      </span>
                    </th>
                    {cols.map(c => <td key={c.key} className={c.key === 'points' ? 'tot' : ''}>{r.cells[c.key] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}
