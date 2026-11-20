/* Aba Favoritos: um cartão por time marcado com ★ (último resultado e próximo jogo). */
import { useEffect, useState } from 'react'
import { loadFavoriteTeam, type TeamGame, type TeamSummary } from '../espn/teamSchedule'

const when = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Line({ label, g }: { label: string; g: TeamGame | null }) {
  if (!g) return <div className="ftline muted">{label}: —</div>
  const vs = `${g.home ? 'x' : '@'} ${g.opponent.name}`
  return (
    <div className="ftline">
      <span className="ftlabel">{label}</span>
      {g.result && <i className={`f-${g.result}`}>{g.result}</i>}
      {g.result ? <b>{g.us}–{g.them}</b> : g.live ? <b className="ftlive">ao vivo</b> : <span>{when.format(new Date(g.date))}</span>}
      <span className="ftvs">{vs}</span>
      {g.league && <span className="ftlg">{g.league}</span>}
    </div>
  )
}

export function FavoriteTeams({ favs }: { favs: Set<string> }) {
  const keys = [...favs].sort()
  const sig = keys.join(',')
  const [teams, setTeams] = useState<Record<string, TeamSummary | 'erro'>>({})
  useEffect(() => {
    let alive = true
    for (const k of sig ? sig.split(',') : []) {
      loadFavoriteTeam(k).then(s => alive && setTeams(t => ({ ...t, [k]: s })))
        .catch(() => alive && setTeams(t => ({ ...t, [k]: 'erro' })))
    }
    return () => { alive = false }
  }, [sig])

  if (!keys.length) return <p className="soon">Você ainda não tem favoritos. Toque na ★ ao lado de um time para marcá-lo.</p>
  return (
    <div className="favteams">
      {keys.map(k => {
        const t = teams[k]
        if (!t) return <div key={k} className="ftcard muted">Carregando…</div>
        if (t === 'erro') return <div key={k} className="ftcard muted">Não foi possível carregar este time.</div>
        return (
          <div key={k} className="ftcard">
            <div className="fthead">{t.logo && <img src={t.logo} alt="" />}<b>{t.name}</b></div>
            <Line label="Próximo" g={t.next} />
            <Line label="Último" g={t.last} />
          </div>
        )
      })}
    </div>
  )
}
