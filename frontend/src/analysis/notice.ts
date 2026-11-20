/* Aviso quando o histórico é de versão antiga ou ainda está sendo carregado (números parciais). */
import { HISTORY_VERSION, type LeagueFile, type Meta } from '../history/types'

export function historyNotice(files: LeagueFile[], meta: Meta | null): { kind: 'old' | 'partial'; text: string } | null {
  if (files.some(f => f.v !== HISTORY_VERSION)) {
    return { kind: 'old', text: 'O histórico está sendo atualizado para a nova versão; alguns números ainda não aparecem.' }
  }
  if (files.some(f => meta?.leagues?.[f.league]?.pending)) {
    return { kind: 'partial', text: 'O histórico ainda está sendo montado: números parciais.' }
  }
  return null
}
