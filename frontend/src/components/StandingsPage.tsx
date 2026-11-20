import { useCallback, useEffect, useState } from 'react'
import { LEAGUES, initialStandingsKey, league as leagueOf } from '../espn/leagues'
import { loadStandings, type StandingGroup, type StandingsLevel } from '../espn/standings'
import { getFavorites } from '../espn/store'
import { StandingsTable } from './StandingsTable'

function readPref(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* sem armazenamento: ignora */ }
}

export function StandingsPage() {
  const saved = readPref('painel.liga_classificacao')
  const [key, setKey] = useState(() => initialStandingsKey(saved))
  const [level, setLevel] = useState<StandingsLevel>('conference')
  const [groups, setGroups] = useState<StandingGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lg = leagueOf(key)

  const load = useCallback(() => {
    let alive = true
    setGroups(null)
    setError(null)
    if (leagueOf(key).knockout) return () => { alive = false }
    loadStandings(key, level)
      .then(g => { if (alive) setGroups(g) })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [key, level])

  useEffect(() => load(), [load])
  useEffect(() => { writePref('painel.liga_classificacao', key) }, [key])

  const favs = getFavorites()
  const highlight = new Set((groups ?? []).flatMap(g => g.rows)
    .filter(r => favs.has(`${lg.sport}:${r.teamId}`)).map(r => r.teamId))
  const zones = [...new Map((groups ?? []).flatMap(g => g.rows).filter(r => r.zone)
    .map(r => [r.zone!.label, r.zone!.color])).entries()]

  return (
    <section className="standings-page">
      <div className="toolbar">
        <div className="chips">
          {LEAGUES.map(l => (
            <button key={l.key} className={`chip ${l.key === key ? 'on' : ''}`} onClick={() => setKey(l.key)}>{l.name}</button>
          ))}
        </div>
        {lg.sport !== 'soccer' && (
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button className={level === 'conference' ? 'on' : ''} onClick={() => setLevel('conference')}>Conferência</button>
            <button className={level === 'division' ? 'on' : ''} onClick={() => setLevel('division')}>Divisão</button>
          </div>
        )}
      </div>
      <div className="list">
        {lg.knockout && <p className="empty">Competição em mata-mata, sem tabela de classificação.</p>}
        {!lg.knockout && !groups && !error && <p className="empty">Carregando…</p>}
        {error && (
          <div className="derr">
            <p>Não foi possível carregar a classificação ({error}).</p>
            <button onClick={load}>Tentar de novo</button>
          </div>
        )}
        {groups && groups.length === 0 && <p className="empty">A ESPN não trouxe classificação para esta liga.</p>}
        {groups && groups.length > 0 && (
          <div className="dsec">
            <StandingsTable groups={groups} sport={lg.sport} highlight={highlight} />
            {zones.length > 0 && (
              <ul className="zones">
                {zones.map(([label, color]) => <li key={label}><i style={{ background: color }} />{label}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
      <footer className="foot">Dados ESPN</footer>
    </section>
  )
}
