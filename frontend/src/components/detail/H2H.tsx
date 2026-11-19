import type { H2H as H2HData } from '../../espn/detailTypes'
import { Section } from './Section'

const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })

export function H2H({ h2h, title }: { h2h: H2HData; title: string }) {
  return (
    <Section title={title}>
      <ul className="h2h">
        {h2h.games.map((g, i) => (
          <li key={i}>
            <span className="h2h-date">{fmt.format(new Date(g.date))}</span>
            <span className="h2h-home">{g.home}</span>
            <b className="h2h-score">{g.homeScore !== null && g.awayScore !== null ? `${g.homeScore} – ${g.awayScore}` : '×'}</b>
            <span className="h2h-away">{g.away}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
