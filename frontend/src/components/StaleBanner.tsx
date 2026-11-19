import type { SyncError } from '../types'

interface Props {
  offline: boolean
  stale: boolean
  errors: SyncError[]
  leagueNames: Record<string, string>
}

export function StaleBanner({ offline, stale, errors, leagueNames }: Props) {
  if (offline) {
    return <div className="banner err">Sem conexão com o servidor do painel. Mostrando a última lista carregada.</div>
  }
  if (!stale) return null
  const names = errors.map(e => leagueNames[e.league] ?? e.league)
  return (
    <div className="banner warn">
      {names.length
        ? `Dados podem estar desatualizados: falha ao atualizar ${names.join(', ')}.`
        : 'Dados podem estar desatualizados: a última atualização tem mais de 15 minutos.'}
    </div>
  )
}
