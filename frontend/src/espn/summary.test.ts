import { describe, expect, it } from 'vitest'
import type { Game, GameStatus, Sport } from '../types'
import { parseSummary } from './summary'
import { fixture } from './testFixtures'

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Monta o Game a partir do header do próprio summary (ids dos times e lados). */
function gameOf(payload: any, league: string, sport: Sport, status: GameStatus): Game {
  const comp = payload.header.competitions[0]
  const side = (ha: string) => {
    const c = comp.competitors.find((x: any) => x.homeAway === ha)
    return {
      team_id: String(c.team.id), name: c.team.displayName, short_name: c.team.displayName, abbrev: c.team.abbreviation ?? '',
      logo: null, score: null, record: null, rank: null, favorite: false,
    }
  }
  return {
    id: String(comp.id), league, sport, start_utc: '2026-11-08T14:00:00Z', status, status_detail: '',
    venue: null, home: side('home'), away: side('away'),
  }
}

describe('parseSummary — futebol', () => {
  const pl = fixture('sum_PL_401879244.json')
  const plGame = gameOf(pl, 'PL', 'soccer', 'final')

  it('soccer final has translated stats', () => {
    const d = parseSummary(plGame, pl)
    expect(d.stats).toContainEqual({ label: 'Escanteios', home: '7', away: '3' })
    expect(d.stats.find(s => s.label === 'Posse de bola (%)')?.home).toBe('75.3')
    const allowed = ['Posse de bola (%)', 'Finalizações', 'No alvo', 'Escanteios', 'Faltas', 'Cartões amarelos',
      'Cartões vermelhos', 'Impedimentos', 'Defesas', 'Passes', 'Passes certos', 'Desarmes', 'Interceptações']
    for (const s of d.stats) expect(allowed).toContain(s.label)
    expect(d.stats.length).toBe(allowed.length)
  })

  it('soccer events in order', () => {
    const d = parseSummary(plGame, pl)
    expect(d.events[0]).toEqual({ minute: "5'", kind: 'yellow', side: 'away', player: 'Kristoffer Ajer', playerOut: null })
    expect(d.events).toContainEqual({ minute: "15'", kind: 'goal', side: 'home', player: 'Diego Gómez', playerOut: null })
    expect(d.events.find(e => e.kind === 'red')).toMatchObject({ minute: "23'", side: 'away', player: 'Igor Thiago' })
    expect(d.events.find(e => e.kind === 'penalty_goal')).toMatchObject({ minute: "42'", side: 'home' })
    expect(d.events.some(e => e.kind === 'halftime')).toBe(true)
    expect(d.events.find(e => e.kind === 'sub' && e.side === 'away'))
      .toMatchObject({ minute: "45'", player: 'Yehor Yarmoliuk', playerOut: 'Dango Ouattara' })
    expect(d.attendance).toBe(31629)
  })

  it('soccer events skip noise and unknown types', () => {
    const base = parseSummary(plGame, pl).events.length
    const extra = structuredClone(pl)
    extra.keyEvents.push(
      { type: { type: 'var-check' }, clock: { displayValue: "60'" }, team: { id: plGame.home.team_id } },
      { type: { type: 'goal' }, clock: { displayValue: "61'" }, team: { id: plGame.away.team_id }, scoringPlay: true },
      { clock: { displayValue: "62'" } },
    )
    const d = parseSummary(plGame, extra)
    for (const k of ['kickoff', 'start-delay', 'end-delay', 'start-2nd-half', 'end-regular-time'])
      expect(d.events.map(e => e.kind)).not.toContain(k)
    expect(d.events.length).toBe(base + 1)
    expect(d.events[d.events.length - 1]).toEqual({ minute: "61'", kind: 'goal', side: 'away', player: null, playerOut: null })
  })

  it('soccer lineups', () => {
    const d = parseSummary(plGame, pl)
    expect(d.lineups?.home.formation).toBe('4-2-3-1')
    expect(d.lineups?.home.starters).toHaveLength(11)
    expect(d.lineups?.home.starters[0]).toMatchObject({ name: 'Bart Verbruggen', number: '1', position: 'G' })
    expect(d.lineups?.home.bench.length).toBe(20 - 11)
    expect(d.lineups?.away.starters).toHaveLength(11)
  })

  it('soccer h2h', () => {
    const d = parseSummary(plGame, pl)
    expect(d.h2h?.summary).toBe('BHA leads series 2-1-2')
    expect(d.h2h?.games).toHaveLength(5)
    for (const g of d.h2h!.games) {
      expect(g.home).not.toBe('')
      expect(Number.isInteger(g.homeScore)).toBe(true)
      expect(Number.isInteger(g.awayScore)).toBe(true)
    }
    expect(d.periods).toBeNull()
    expect(d.box).toBeNull()
  })

  it('ucl second leg aggregate', () => {
    const ucl = fixture('sum_UCL_401862582.json')
    const d = parseSummary(gameOf(ucl, 'UCL', 'soccer', 'final'), ucl)
    expect(d.aggregate).toEqual({ leg: '2º jogo', round: 'Round of 16', home: 8, away: 3 })
    expect(parseSummary(plGame, pl).aggregate).toBeNull()
  })

  it('scheduled game hides game sections', () => {
    const sch = fixture('sum_PL_scheduled.json')
    const d = parseSummary(gameOf(sch, 'PL', 'soccer', 'scheduled'), sch)
    expect(d.stats).toEqual([])
    expect(d.events).toEqual([])
    expect(d.lineups).toBeNull()
    expect(d.periods).toBeNull()
    expect(d.box).toBeNull()
    expect(d.h2h?.games.length).toBeGreaterThan(0)
  })
})

describe('parseSummary — NBA e NFL', () => {
  const nba = fixture('sum_NBA_401910002.json')
  const nbaGame = gameOf(nba, 'NBA', 'basketball', 'final')
  const nfl = fixture('sum_NFL_401873065.json')
  const nflGame = gameOf(nfl, 'NFL', 'football', 'final')

  it('nba periods', () => {
    const d = parseSummary(nbaGame, nba)
    expect(d.periods).toEqual({ labels: ['1º', '2º', '3º', '4º'], home: ['29', '21', '33', '19'], away: ['23', '31', '26', '31'] })
    const ot = structuredClone(nba)
    for (const c of ot.header.competitions[0].competitors) c.linescores.push({ displayValue: '10' }, { displayValue: '8' })
    expect(parseSummary(nbaGame, ot).periods?.labels).toEqual(['1º', '2º', '3º', '4º', 'OT', '2OT'])
  })

  it('nba stats', () => {
    const d = parseSummary(nbaGame, nba)
    const fg = d.stats.find(s => s.label === 'Arremessos')!
    const knicks = nba.boxscore.teams.find((t: any) => t.team.id === nbaGame.away.team_id)
    const fgKnicks = knicks.statistics.find((s: any) => s.name === 'fieldGoalsMade-fieldGoalsAttempted').displayValue
    expect(fg.away).toBe(fgKnicks)
    expect([fg.home, fg.away]).toContain('41-78')
    expect(d.stats.some(s => s.label === 'Rebotes')).toBe(true)
    expect(d.events).toEqual([])
    expect(d.lineups).toBeNull()
  })

  it('nba box marks did-not-play', () => {
    const d = parseSummary(nbaGame, nba)
    expect(d.box?.home).toHaveLength(1)
    expect(d.box?.away).toHaveLength(1)
    expect(d.box!.away[0].labels[0]).toBe('MIN')
    expect(d.box!.away[0].players.find(p => p.name === 'OG Anunoby')).toMatchObject({ starter: true, dnp: null })
    expect(d.box!.away[0].players.find(p => p.name === 'OG Anunoby')!.stats[1]).toBe('16')
    expect(d.box!.home[0].players.find(p => p.name === 'Kyle Anderson'))
      .toMatchObject({ stats: [], dnp: "COACH'S DECISION" })
    expect(d.h2h?.games.length).toBeGreaterThan(0)
  })

  it('nfl box groups', () => {
    const d = parseSummary(nflGame, nfl)
    expect(d.box!.away.map(g => g.title)).toEqual(['Passe', 'Corrida', 'Recepção', 'Defesa', 'Interceptações',
      'Chutes', 'Punts', 'Retorno de kickoff', 'Retorno de punt', 'Fumbles'].filter(t => d.box!.away.some(g => g.title === t)))
    expect(d.box!.away[0].title).toBe('Passe')
    expect(d.box!.away[0].players[0].name).toBe('Justin Herbert')
    expect(d.box!.away[0].players[0].stats.slice(0, 2)).toEqual(['12/18', '129'])
    expect(d.periods?.labels).toEqual(['1º', '2º', '3º', '4º'])
  })

  it('nfl has no h2h', () => {
    expect(parseSummary(nflGame, nfl).h2h).toBeNull()
  })

  it('nfl stats', () => {
    const d = parseSummary(nflGame, nfl)
    expect(d.stats.some(s => s.label === 'Jardas totais')).toBe(true)
    expect(d.stats).toContainEqual({ label: 'Posse de bola', home: '29:58', away: '30:02' })
  })
})
