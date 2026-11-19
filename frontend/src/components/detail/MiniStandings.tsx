import { useEffect, useState } from 'react'
import { loadStandings, type StandingGroup } from '../../espn/standings'
import type { Game } from '../../types'
import { StandingsTable } from '../StandingsTable'
import { Section } from './Section'

/** Tabela da liga (ou da conferência dos dois times), com os dois destacados. Sem dado: não aparece. */
export function MiniStandings({ game }: { game: Game }) {
  const [groups, setGroups] = useState<StandingGroup[] | null>(null)
  useEffect(() => {
    let alive = true
    setGroups(null)
    loadStandings(game.league).then(g => { if (alive) setGroups(g) }).catch(() => { if (alive) setGroups([]) })
    return () => { alive = false }
  }, [game.league])
  const ids = new Set([game.home.team_id, game.away.team_id])
  const mine = (groups ?? []).filter(g => g.rows.some(r => ids.has(r.teamId)))
  if (!mine.length) return null
  return (
    <Section title="Classificação">
      <StandingsTable groups={mine} sport={game.sport} highlight={ids} compact />
    </Section>
  )
}
