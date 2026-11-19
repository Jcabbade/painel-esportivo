import type { StatRow } from '../../espn/detailTypes'
import { Section } from './Section'

const num = (v: string) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null)

export function Stats({ stats }: { stats: StatRow[] }) {
  return (
    <Section title="Estatísticas">
      <div className="stats">
        {stats.map(s => {
          const h = num(s.home), a = num(s.away)
          const total = h !== null && a !== null && h + a > 0 ? h + a : null
          return (
            <div key={s.label} className="stat">
              <div className="stat-top"><b>{s.home}</b><span>{s.label}</span><b>{s.away}</b></div>
              {total !== null && h !== null && a !== null && (
                <div className="stat-bar">
                  <i className={h >= a ? 'lead' : ''} style={{ width: `${(h / total) * 100}%` }} />
                  <i className={a >= h ? 'lead' : ''} style={{ width: `${(a / total) * 100}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}
