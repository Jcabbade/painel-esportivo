import { useCallback, useEffect, useRef, useState } from 'react'
import type { Aggregate } from '../espn/detailTypes'
import { createDetailLoader, nextDetailState, type DetailState } from '../espn/loadDetail'
import { statusText } from '../lib/status'
import type { Game } from '../types'
import { BoxScore } from './detail/BoxScore'
import { Events } from './detail/Events'
import { H2H } from './detail/H2H'
import { Lineups } from './detail/Lineups'
import { MiniStandings } from './detail/MiniStandings'
import { Periods } from './detail/Periods'
import { Stats } from './detail/Stats'
import { TeamLogo } from './GameRow'
import { FavoritesNews } from './news/FavoritesNews'
import { NewsCard } from './news/NewsCard'
import { newsForGame } from '../news/loadNews'
import type { NewsFile } from '../news/types'
import { Section } from './detail/Section'

interface Props {
  game: Game | null
  leagueName: string
  onClose: () => void
  news: NewsFile | null
  favs: Set<string>
  onSeeAllNews: () => void
}

const LIVE_REFRESH = 30_000

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
})

const ROUNDS: Record<string, string> = {
  'Round of 16': 'Oitavas de final', 'Quarterfinals': 'Quartas de final', 'Semifinals': 'Semifinal',
  'Final': 'Final', 'Knockout Round Playoffs': 'Playoffs',
}

function aggText(a: Aggregate): string {
  return [a.leg, a.round ? ROUNDS[a.round] ?? a.round : null, `agregado ${a.home}–${a.away}`].filter(Boolean).join(' · ')
}

export function DetailPane({ game, leagueName, onClose, news, favs, onSeeAllNews }: Props) {
  const [state, setState] = useState<DetailState>({ detail: null, error: null })
  const [loading, setLoading] = useState(false)
  const loader = useRef(createDetailLoader())
  const current = useRef(game)
  current.current = game

  const fetchDetail = useCallback(async () => {
    const g = current.current
    if (!g) return
    try {
      const detail = await loader.current.load(g)
      if (!detail) return // resposta de um jogo anterior: a busca atual continua valendo
      setState(s => nextDetailState(s, { ok: true, detail }))
    } catch (e) {
      setState(s => nextDetailState(s, { ok: false, message: e instanceof Error ? e.message : String(e) }))
    }
    setLoading(false)
  }, [])

  const id = game?.id
  const live = game?.status === 'live'
  useEffect(() => {
    setState({ detail: null, error: null })
    if (!id) { loader.current.cancel(); return }
    setLoading(true)
    fetchDetail()
  }, [id, fetchDetail])

  // Quando o jogo termina (live → final) busca mais uma vez para pegar os números finais.
  const status = game?.status
  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current === 'live' && status === 'final') fetchDetail()
    prevStatus.current = status
  }, [status, fetchDetail])

  useEffect(() => {
    if (!id || !live) return
    const t = setInterval(fetchDetail, LIVE_REFRESH)
    return () => clearInterval(t)
  }, [id, live, fetchDetail])

  if (!game) {
    if (news && favs.size > 0) {
      return (
        <aside className="detail">
          <FavoritesNews file={news} favs={favs} onSeeAll={onSeeAllNews} layout="list" />
        </aside>
      )
    }
    return (
      <aside className="detail placeholder">
        <p><b>Nenhum jogo selecionado</b></p>
        <p>Clique em uma partida da lista para ver os detalhes.</p>
      </aside>
    )
  }
  const showScore = game.status === 'live' || game.status === 'final'
  const gameNews = news ? newsForGame(news, game) : []
  const d = state.detail
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
      {d?.aggregate && <p className="dagg">{aggText(d.aggregate)}</p>}
      <dl className="dinfo">
        <dt>Data</dt><dd>{dateFmt.format(new Date(game.start_utc))}</dd>
        {game.venue && <><dt>Local</dt><dd>{game.venue}</dd></>}
        {d?.attendance && <><dt>Público</dt><dd>{d.attendance.toLocaleString('pt-BR')}</dd></>}
      </dl>

      {!d && loading && <p className="soon">Carregando detalhes…</p>}
      {!d && !loading && state.error && (
        <div className="derr">
          <p>Não foi possível carregar os detalhes ({state.error}).</p>
          <button onClick={() => { setLoading(true); fetchDetail() }}>Tentar de novo</button>
        </div>
      )}
      {d && state.error && <p className="dwarn">Não deu para atualizar agora ({state.error}); mostrando a última versão.</p>}

      {d && <div key={game.id}>
        {d.periods && <Periods game={game} periods={d.periods} />}
        {d.events.length > 0 && <Events events={d.events} />}
        {d.stats.length > 0 && <Stats stats={d.stats} />}
        {d.lineups && <Lineups game={game} lineups={d.lineups} />}
        {d.box && <BoxScore game={game} box={d.box} />}
        {d.h2h && <H2H h2h={d.h2h} title={game.sport === 'soccer' ? 'Confronto direto' : 'Série da temporada'} />}
      </div>}
      <MiniStandings key={game.league} game={game} />
      {gameNews.length > 0 && (
        <Section title="Notícias">
          <div className="nlist">
            {gameNews.map(i => <NewsCard key={i.id} item={i} now={new Date()} />)}
          </div>
        </Section>
      )}
    </aside>
  )
}
