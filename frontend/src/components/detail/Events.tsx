import type { SoccerEvent, SoccerEventKind } from '../../espn/detailTypes'
import { Section } from './Section'

const ICON: Record<SoccerEventKind, string> = {
  goal: '⚽', penalty_goal: '⚽', own_goal: '⚽', penalty_miss: '✖', yellow: '🟨', red: '🟥', sub: '⇄', halftime: '',
}
const NOTE: Partial<Record<SoccerEventKind, string>> = {
  penalty_goal: '(pênalti)', own_goal: '(contra)', penalty_miss: 'pênalti perdido',
}

export function Events({ events }: { events: SoccerEvent[] }) {
  return (
    <Section title="Lances">
      <ol className="events">
        {events.map((e, i) => e.kind === 'halftime'
          ? <li key={i} className="ev-ht">Intervalo</li>
          : (
            <li key={i} className={`ev ev-${e.side ?? 'none'}`}>
              <span className="ev-min">{e.minute}</span>
              <span className="ev-ico" aria-hidden>{ICON[e.kind]}</span>
              <span className="ev-txt">
                {e.kind === 'sub'
                  ? <><b className="in">↑ {e.player ?? '—'}</b> <span className="out">↓ {e.playerOut ?? '—'}</span></>
                  : <><b>{e.player ?? '—'}</b> {NOTE[e.kind] && <small>{NOTE[e.kind]}</small>}</>}
              </span>
            </li>
          ))}
      </ol>
    </Section>
  )
}
