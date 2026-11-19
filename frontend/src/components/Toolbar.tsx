import type { GroupMode, Tab } from '../lib/games'
import type { League } from '../types'

interface Props {
  tab: Tab
  onTab: (t: Tab) => void
  liveCount: number
  query: string
  onQuery: (q: string) => void
  leagues: League[]
  selected: Set<string>
  onToggleLeague: (key: string) => void
  group: GroupMode
  onGroup: (g: GroupMode) => void
}

const ICON: Record<string, string> = { soccer: '⚽', basketball: '🏀', football: '🏈' }

export function Toolbar(p: Props) {
  const tabs: [Tab, string][] = [
    ['todos', 'Todos'], ['favoritos', '★ Favoritos'], ['ao_vivo', `Ao vivo · ${p.liveCount}`],
    ['proximos', 'Próximos'], ['encerrados', 'Encerrados'],
  ]
  return (
    <div className="toolbar">
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={p.tab === k}
            className={`tab ${p.tab === k ? 'on' : ''} ${k === 'ao_vivo' && p.liveCount > 0 ? 'has-live' : ''}`}
            onClick={() => p.onTab(k)}>{label}</button>
        ))}
      </div>
      <div className="row">
        <input className="search" type="search" placeholder="Buscar time ou liga…" value={p.query}
          onChange={e => p.onQuery(e.target.value)} />
        <div className="seg">
          <button className={p.group === 'liga' ? 'on' : ''} onClick={() => p.onGroup('liga')}>Por liga</button>
          <button className={p.group === 'horario' ? 'on' : ''} onClick={() => p.onGroup('horario')}>Por horário</button>
        </div>
      </div>
      <div className="chips">
        {p.leagues.map(l => (
          <button key={l.key} className={`chip ${p.selected.has(l.key) ? 'on' : ''}`}
            onClick={() => p.onToggleLeague(l.key)}>{ICON[l.sport]} {l.name}</button>
        ))}
      </div>
    </div>
  )
}
