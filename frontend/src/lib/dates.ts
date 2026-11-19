import { TZ } from './games'

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Dia atual em Brasília, no formato YYYY-MM-DD. */
export function localToday(now: Date = new Date()): string {
  return ymd.format(now)
}

/** Soma dias a uma data YYYY-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function dayLabel(day: string, today: string): { top: string; bottom: string } {
  const [y, m, d] = day.split('-').map(Number)
  const bottom = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  const special: Record<string, string> = {
    [today]: 'Hoje', [addDays(today, 1)]: 'Amanhã', [addDays(today, -1)]: 'Ontem',
  }
  const top = special[day] ?? WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return { top, bottom }
}
