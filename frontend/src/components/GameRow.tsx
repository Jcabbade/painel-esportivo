import { statusText } from '../lib/status'
import type { Game, Side } from '../types'

interface Props {
  game: Game
  selected: boolean
  onSelect: () => void
  onFavorite: (side: Side) => void
}

export function TeamLogo({ side, size = 22 }: { side: Side; size?: number }) {
  return side.logo
    ? <img className="logo" src={side.logo} alt="" width={size} height={size} loading="lazy" />
    : <span className="logo ph" style={{ width: size, height: size }}>{side.abbrev.slice(0, 3)}</span>
}

function extra(game: Game, side: Side) {
  if (game.sport === 'soccer') return side.rank ? `${side.rank}º` : ''
  return side.record ?? ''
}

export function GameRow({ game, selected, onSelect, onFavorite }: Props) {
  const showScore = game.status === 'live' || game.status === 'final'
  const leader = showScore && game.home.score !== game.away.score
    ? ((game.home.score ?? 0) > (game.away.score ?? 0) ? 'home' : 'away') : null

  const team = (side: Side, which: 'home' | 'away') => (
    <div className={`team ${leader && leader !== which ? 'dim' : ''}`}>
      <TeamLogo side={side} />
      <span className="tname">{side.name}</span>
      <span className="extra">{extra(game, side)}</span>
      <button className={`star ${side.favorite ? 'on' : ''}`}
        aria-label={side.favorite ? `Remover ${side.name} dos favoritos` : `Favoritar ${side.name}`}
        onClick={e => { e.stopPropagation(); onFavorite(side) }}>{side.favorite ? '★' : '☆'}</button>
      {showScore && <span className="score">{side.score}</span>}
    </div>
  )

  return (
    <div className={`game ${selected ? 'sel' : ''} st-${game.status}`} role="button" tabIndex={0}
      onClick={onSelect} onKeyDown={e => { if (e.key === 'Enter') onSelect() }}>
      <div className="when">{statusText(game)}</div>
      <div className="teams">
        {team(game.home, 'home')}
        {team(game.away, 'away')}
      </div>
    </div>
  )
}
