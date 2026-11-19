import type { Game, Side } from '../types'
import { GameRow } from './GameRow'

interface Props {
  groups: { title: string; games: Game[] }[]
  selectedId: string | null
  onSelect: (g: Game) => void
  onFavorite: (g: Game, side: Side) => void
  emptyText: string
}

export function GameList({ groups, selectedId, onSelect, onFavorite, emptyText }: Props) {
  if (groups.length === 0) return <div className="empty">{emptyText}</div>
  return (
    <div className="list">
      {groups.map(gr => (
        <section key={gr.title} className="group">
          <h3>{gr.title} <small>{gr.games.length} {gr.games.length === 1 ? 'jogo' : 'jogos'}</small></h3>
          {gr.games.map(g => (
            <GameRow key={g.id} game={g} selected={g.id === selectedId} onSelect={() => onSelect(g)}
              onFavorite={side => onFavorite(g, side)} />
          ))}
        </section>
      ))}
    </div>
  )
}
