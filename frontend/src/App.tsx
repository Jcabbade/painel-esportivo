import { useCallback, useEffect, useMemo, useState } from 'react'
import { DayBar } from './components/DayBar'
import { DetailPane } from './components/DetailPane'
import { GameList } from './components/GameList'
import { StaleBanner } from './components/StaleBanner'
import { StandingsPage } from './components/StandingsPage'
import { Toolbar } from './components/Toolbar'
import { followToday, localToday } from './lib/dates'
import { countLive, filterGames, formatLocalTime, groupGames, needsFastPoll, type GroupMode, type Tab } from './lib/games'
import { LEAGUES } from './espn/leagues'
import { loadDay, refreshLive, withFavorites } from './espn/loadDay'
import { toggleFavorite } from './espn/store'
import type { Game, GamesResponse, Side } from './types'

type View = 'jogos' | 'classificacao'

const LIVE_POLL = 30_000
const IDLE_POLL = 300_000

function readPref(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* sem armazenamento: ignora */ }
}

export default function App() {
  const [today, setToday] = useState(localToday())
  const [day, setDay] = useState(today)
  const [tab, setTab] = useState<Tab>('todos')
  const [query, setQuery] = useState('')
  const [selLeagues, setSelLeagues] = useState<Set<string>>(new Set())
  const [group, setGroup] = useState<GroupMode>((readPref('painel.group') as GroupMode) || 'liga')
  const [theme, setTheme] = useState(readPref('painel.theme') || 'dark')
  const [data, setData] = useState<GamesResponse | null>(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>(readPref('painel.view') === 'classificacao' ? 'classificacao' : 'jogos')

  const leagues = LEAGUES
  const leagueNames = useMemo(() => Object.fromEntries(LEAGUES.map(l => [l.key, l.name])), [])
  const leagueOrder = useMemo(() => LEAGUES.map(l => l.key), [])

  useEffect(() => { document.documentElement.dataset.theme = theme; writePref('painel.theme', theme) }, [theme])
  useEffect(() => { writePref('painel.group', group) }, [group])
  useEffect(() => { writePref('painel.view', view) }, [view])
  useEffect(() => {
    const t = setInterval(() => {
      const next = localToday()
      setToday(prev => {
        if (prev !== next) setDay(d => followToday(prev, next, d))
        return next
      })
    }, 60_000)
    return () => clearInterval(t)
  }, [])

  const apply = useCallback((r: GamesResponse) => {
    // Todas as ligas falharam: provavelmente sem internet. Mantém o que já estava na tela.
    const allFailed = r.errors.length === LEAGUES.length
    setOffline(allFailed)
    setData(prev => (allFailed && prev?.date === r.date ? { ...prev, stale: true, errors: r.errors } : r))
  }, [])

  const load = useCallback(async () => {
    try {
      apply(await loadDay(day))
    } finally {
      setLoading(false)
    }
  }, [day, apply])

  const loadLive = useCallback(async () => {
    if (data?.date !== day) return load()
    apply(await refreshLive(data))
  }, [data, day, load, apply])

  useEffect(() => { setLoading(true); setData(null); setSelectedId(null); load() }, [load])

  const games = useMemo(() => data?.date === day ? data.games : [], [data, day])
  const live = countLive(games)
  const fast = needsFastPoll(games)
  useEffect(() => {
    const t = setInterval(fast ? loadLive : load, fast ? LIVE_POLL : IDLE_POLL)
    return () => clearInterval(t)
  }, [load, loadLive, fast])

  const visible = filterGames(games, { tab, leagues: selLeagues, query }, leagueNames)
  const groups = groupGames(visible, group, leagueOrder, leagueNames)
  const selected = games.find(g => g.id === selectedId) ?? null

  const toggleLeague = (k: string) => setSelLeagues(prev => {
    const n = new Set(prev)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })

  const onFavorite = (g: Game, side: Side) => {
    toggleFavorite(g.sport, side.team_id)
    setData(d => d && withFavorites(d))
  }

  const emptyText = loading ? 'Carregando…'
    : !data ? 'Não foi possível carregar os jogos deste dia.'
      : games.length === 0 ? 'Nenhum jogo neste dia.' : 'Nenhum jogo com esses filtros.'

  return (
    <div className="app">
      <header className="top">
        <div className="brand">Painel<span>.</span>esportivo</div>
        <nav className="views seg">
          <button className={view === 'jogos' ? 'on' : ''} onClick={() => setView('jogos')}>Jogos</button>
          <button className={view === 'classificacao' ? 'on' : ''} onClick={() => setView('classificacao')}>Classificação</button>
        </nav>
        {view === 'jogos' ? <DayBar today={today} selected={day} onSelect={setDay} /> : <div className="spacer" />}
        <button className="theme" aria-label="Alternar tema"
          onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>◐</button>
      </header>
      {view === 'classificacao' ? <main className="body single"><StandingsPage /></main> : <>
      <StaleBanner offline={offline} stale={!!data?.stale} errors={data?.errors ?? []} leagueNames={leagueNames} />
      <main className={`body ${selected ? 'has-detail' : ''}`}>
        <section className="left">
          <Toolbar tab={tab} onTab={setTab} liveCount={live} query={query} onQuery={setQuery}
            leagues={leagues} selected={selLeagues} onToggleLeague={toggleLeague} group={group} onGroup={setGroup} />
          <GameList groups={groups} selectedId={selectedId} onSelect={g => setSelectedId(g.id)}
            onFavorite={onFavorite} emptyText={emptyText} />
          <footer className="foot">
            {data?.updated_at ? `Dados ESPN · atualizado às ${formatLocalTime(data.updated_at)}` : 'Dados ESPN · aguardando a primeira atualização'}
          </footer>
        </section>
        <DetailPane game={selected} leagueName={selected ? leagueNames[selected.league] ?? '' : ''}
          onClose={() => setSelectedId(null)} />
      </main>
      </>}
    </div>
  )
}
