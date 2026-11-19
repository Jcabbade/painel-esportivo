import type { Game } from '../types'
import { formatLocalTime } from './games'

const ORD: Record<string, string> = { '1st': '1º', '2nd': '2º', '3rd': '3º', '4th': '4º' }

function translateLive(detail: string): string {
  const d = detail.trim()
  if (/^(halftime|ht)$/i.test(d)) return 'Intervalo'
  let m = d.match(/^End of (1st|2nd|3rd|4th)$/i)
  if (m) return `Fim do ${ORD[m[1].toLowerCase()]} Q`
  m = d.match(/^([\d:.]+) - (1st|2nd|3rd|4th)$/i)
  if (m) return `${ORD[m[2].toLowerCase()]} Q · ${m[1]}`
  m = d.match(/^([\d:.]+) - OT$/i)
  if (m) return `Prorrogação · ${m[1]}`
  return d
}

export function statusText(g: Pick<Game, 'status' | 'status_detail' | 'start_utc'>): string {
  switch (g.status) {
    case 'scheduled': return formatLocalTime(g.start_utc)
    case 'final': return 'Encerrado'
    case 'postponed': return 'Adiado'
    case 'canceled': return 'Cancelado'
    default: return translateLive(g.status_detail)
  }
}
