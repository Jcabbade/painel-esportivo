import { useState } from 'react'
import type { BoxGroup } from '../../espn/detailTypes'
import type { Game } from '../../types'
import { Section } from './Section'

const REASONS: Record<string, string> = { "COACH'S DECISION": 'decisão do técnico' }

function Group({ g, showTitle }: { g: BoxGroup; showTitle: boolean }) {
  return (
    <div className="bgroup">
      {showTitle && <div className="lsub">{g.title}</div>}
      <div className="tscroll">
        <table className="tbl box">
          <thead><tr><th className="pn">Jogador</th>{g.labels.map((l, i) => <th key={i}>{l}</th>)}</tr></thead>
          <tbody>
            {g.players.map((p, i) => (
              <tr key={i} className={p.starter ? 'starter' : ''}>
                <th className="pn">{p.name}</th>
                {p.dnp
                  ? <td colSpan={g.labels.length} className="dnp">Não jogou – {REASONS[p.dnp] ?? p.dnp.toLowerCase()}</td>
                  : g.labels.map((_, j) => <td key={j}>{p.stats[j] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function BoxScore({ game, box }: { game: Game; box: { home: BoxGroup[]; away: BoxGroup[] } }) {
  const [side, setSide] = useState<'home' | 'away'>(box.home.length ? 'home' : 'away')
  return (
    <Section title="Box score">
      <div className="seg boxseg">
        {(['home', 'away'] as const).map(s => (
          <button key={s} className={side === s ? 'on' : ''} disabled={!box[s].length} onClick={() => setSide(s)}>
            {game[s].short_name}
          </button>
        ))}
      </div>
      {box[side].map(g => <Group key={g.title} g={g} showTitle={game.sport === 'football'} />)}
    </Section>
  )
}
