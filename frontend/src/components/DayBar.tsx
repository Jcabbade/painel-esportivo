import { useEffect, useRef } from 'react'
import { addDays, dayLabel } from '../lib/dates'

interface Props {
  today: string
  selected: string
  onSelect: (day: string) => void
}

const RANGE = Array.from({ length: 11 }, (_, i) => i - 3) // hoje −3 … hoje +7

export function DayBar({ today, selected, onSelect }: Props) {
  const days = RANGE.map(n => addDays(today, n))
  const idx = days.indexOf(selected)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector('.day.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected])

  return (
    <div className="daybar">
      <button className="arrow" aria-label="Dia anterior" disabled={idx <= 0}
        onClick={() => onSelect(days[idx - 1])}>‹</button>
      <div className="days" ref={ref}>
        {days.map(d => {
          const { top, bottom } = dayLabel(d, today)
          return (
            <button key={d} className={`day ${d === selected ? 'on' : ''} ${d === today ? 'today' : ''}`}
              onClick={() => onSelect(d)}>
              <span>{top}</span><b>{bottom}</b>
            </button>
          )
        })}
      </div>
      <button className="arrow" aria-label="Próximo dia" disabled={idx >= days.length - 1}
        onClick={() => onSelect(days[idx + 1])}>›</button>
    </div>
  )
}
