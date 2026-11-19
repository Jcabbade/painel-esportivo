import { describe, expect, it } from 'vitest'
import { fixture } from '../espn/testFixtures'
import { buildTeamIndex, matchTeams } from './teams'

const index = buildTeamIndex([
  { league: 'PL', sport: 'soccer', payload: fixture('standings_PL.json') },
  { league: 'UCL', sport: 'soccer', payload: fixture('standings_UCL.json') },
  { league: 'NBA', sport: 'basketball', payload: fixture('standings_NBA.json') },
  { league: 'NFL', sport: 'football', payload: fixture('standings_NFL.json') },
])

const team = (id: string, displayName: string, shortDisplayName = displayName, name = displayName) =>
  ({ team: { id, displayName, shortDisplayName, name } })
const handIndex = buildTeamIndex([{
  league: 'UCL', sport: 'soccer',
  payload: { children: [{ standings: { entries: [
    team('160', 'Paris Saint-Germain', 'PSG'), team('132', 'Bayern Munich', 'Bayern'),
    team('110', 'Internazionale', 'Inter Milan'), team('999', 'Como'),
  ] } }] },
}])

describe('matchTeams', () => {
  it('matches full names accent-insensitive', () => {
    expect(matchTeams('Pochettino chega ao Manchester United', index)).toEqual(['soccer:360'])
    expect(matchTeams('Atlético de Madrid e ATLETICO MADRID', index)).toEqual(['soccer:1068'])
  })

  it('ambiguous short names do not match alone', () => {
    expect(matchTeams('United vence fora', index)).toEqual([])
    expect(matchTeams('City perde', index)).toEqual([])
    expect(matchTeams('Real empata', index)).toEqual([])
  })

  it('nba nicknames match', () => {
    const lakers = matchTeams('Lakers vencem os Celtics em casa', index)
    expect(lakers).toHaveLength(2)
    expect(lakers.every(k => k.startsWith('basketball:'))).toBe(true)
  })

  it('aliases', () => {
    expect(matchTeams('PSG e Bayern de Munique empatam', handIndex)).toEqual(['soccer:160', 'soccer:132'])
    expect(matchTeams('Inter de Milão lidera', handIndex)).toEqual(['soccer:110'])
  })

  it('word boundary', () => {
    expect(matchTeams('Interessante a partida', handIndex)).toEqual([])
    expect(matchTeams('Bayernfest', handIndex)).toEqual([])
  })

  it('common portuguese words are not team names', () => {
    expect(matchTeams('Veja como foi o jogo', handIndex)).toEqual([])
  })

  it('brazilian clubs do not match european ones', () => {
    expect(matchTeams('Cruzeiro x Atlético-MG: final do Mineiro', index)).toEqual([])
    expect(matchTeams('Inter vence o Grêmio no Beira-Rio', handIndex)).toEqual([])
    expect(matchTeams('Atlético de Madrid vence', index)).toEqual(['soccer:1068'])
  })

  it('nba short nicknames', () => {
    expect(matchTeams('De volta ao Blazers, Lillard', index, 'basketball')).toHaveLength(1)
    expect(matchTeams('Sixers vencem', index, 'basketball')).toHaveLength(1)
  })

  it('sport filter', () => {
    const giants = matchTeams('Giants perdem de novo', index, 'football')
    expect(giants).toHaveLength(1)
    expect(matchTeams('Giants perdem de novo', index, 'soccer')).toEqual([])
  })
})
