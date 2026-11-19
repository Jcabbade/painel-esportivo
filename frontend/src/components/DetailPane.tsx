import { statusText } from '../lib/status'
import type { Game } from '../types'
import { TeamLogo } from './GameRow'

interface Props {
  game: Game | null
  leagueName: string
  onClose: () => void
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
})

export function DetailPane({ game, leagueName, onClose }: Props) {
  if (!game) {
    return (
      <aside className="detail placeholder">
        <p><b>Nenhum jogo selecionado</b></p>
        <p>Clique em uma partida da lista para ver os detalhes.</p>
      </aside>
    )
  }
  const showScore = game.status === 'live' || game.status === 'final'
  return (
    <aside className="detail open">
      <button className="back" onClick={onClose}>‹ Voltar</button>
      <div className="dleague">{leagueName}</div>
      <div className="dhead">
        <div className="dteam"><TeamLogo side={game.home} size={56} /><span>{game.home.name}</span></div>
        <div className="dscore">
          {showScore ? <b>{game.home.score} – {game.away.score}</b> : <b>×</b>}
          <span className={`dstatus st-${game.status}`}>{statusText(game)}</span>
        </div>
        <div className="dteam"><TeamLogo side={game.away} size={56} /><span>{game.away.name}</span></div>
      </div>
      <dl className="dinfo">
        <dt>Data</dt><dd>{dateFmt.format(new Date(game.start_utc))}</dd>
        {game.venue && <><dt>Local</dt><dd>{game.venue}</dd></>}
      </dl>
      <p className="soon">Estatísticas, lances e escalações chegam na próxima etapa.</p>
    </aside>
  )
}
