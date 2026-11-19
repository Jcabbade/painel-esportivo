import { useCallback, useEffect, useMemo, useState } from 'react'
import { getGames, getLeagues, setFavorite } from './api'
import { DayBar } from './components/DayBar'
import { DetailPane } from './components/DetailPane'
import { GameList } from './components/GameList'
import { StaleBanner } from './components/StaleBanner'
import { Toolbar } from './components/Toolbar'
import { localToday } from './lib/dates'
import { countLive, filterGames, formatLocalTime, groupGames, type GroupMode, type Tab } from './lib/games'
import type { Game, GamesResponse, League, Side } from './types'

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
  const [leagues, setLeagues] = useState<League[]>([])
  const [data, setData] = useState<GamesResponse | null>(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const leagueNames = useMemo(() => Object.fromEntries(leagues.map(l => [l.key, l.name])), [leagues])
  const leagueOrder = useMemo(() => leagues.map(l => l.key), [leagues])

  useEffect(() => { document.documentElement.dataset.theme = theme; writePref('painel.theme', theme) }, [theme])
  useEffect(() => { writePref('painel.group', group) }, [group])
  useEffect(() => { getLeagues().then(setLeagues).catch(() => setOffline(true)) }, [])
  useEffect(() => {
    const t = setInterval(() => setToday(localToday()), 60_000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await getGames(day)
      setData(r)
      setOffline(false)
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [day])

  useEffect(() => { setLoading(true); setData(null); setSelectedId(null); load() }, [load])

  const games = useMemo(() => data?.date === day ? data.games : [], [data, day])
  const live = countLive(games)
  useEffect(() => {
    const t = setInterval(load, day === today && live > 0 ? LIVE_POLL : IDLE_POLL)
    return () => clearInterval(t)
  }, [load, day, today, live])

  const visible = filterGames(games, { tab, leagues: selLeagues, query }, leagueNames)
  const groups = groupGames(visible, group, leagueOrder, leagueNames)
  const selected = games.find(g => g.id === selectedId) ?? null

  const toggleLeague = (k: string) => setSelLeagues(prev => {
    const n = new Set(prev)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })

  const onFavorite = async (g: Game, side: Side) => {
    const on = !side.favorite
    setData(d => d && {
      ...d,
      games: d.games.map(x => x.sport !== g.sport ? x : {
        ...x,
        home: x.home.team_id === side.team_id ? { ...x.home, favorite: on } : x.home,
        away: x.away.team_id === side.team_id ? { ...x.away, favorite: on } : x.away,
      }),
    })
    try { await setFavorite(g.sport, side.team_id, on) } catch { setOffline(true) }
    load()
  }

  const emptyText = loading ? 'Carregando…'
    : !data ? 'Não foi possível carregar os jogos deste dia.'
      : games.length === 0 ? 'Nenhum jogo neste dia.' : 'Nenhum jogo com esses filtros.'

  return (
    <div className="app">
      <header className="top">
        <div className="brand">Painel<span>.</span>esportivo</div>
        <DayBar today={today} selected={day} onSelect={setDay} />
        <button className="theme" aria-label="Alternar tema"
          onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>◐</button>
      </header>
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
    </div>
  )
}
