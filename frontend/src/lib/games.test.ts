import { describe, expect, it } from 'vitest'
import type { Game, GameStatus, Side } from '../types'
import { countLive, filterGames, formatLocalTime, groupGames, needsFastPoll } from './games'

const side = (name: string, abbrev: string, favorite = false): Side => ({
  team_id: abbrev, name, short_name: name, abbrev, logo: null, score: null, record: null, rank: null, favorite,
})

const game = (id: string, league: string, status: GameStatus, start = '2026-11-19T20:00:00Z',
  home = side('Arsenal', 'ARS'), away = side('Chelsea', 'CHE')): Game => ({
  id, league, sport: 'soccer', start_utc: start, status, status_detail: '', venue: null, home, away,
})

const all = { tab: 'todos' as const, leagues: new Set<string>(), query: '' }

describe('filterGames', () => {
  const games = [
    game('1', 'PL', 'live'),
    game('2', 'PL', 'scheduled'),
    game('3', 'ESP', 'final', undefined, side('Atlético Madrid', 'ATM'), side('Sevilla', 'SEV')),
    game('4', 'ESP', 'postponed'),
    game('5', 'ITA', 'canceled', undefined, side('Inter', 'INT', true), side('Milan', 'MIL')),
  ]

  it('filters live tab', () => {
    expect(filterGames(games, { ...all, tab: 'ao_vivo' }).map(g => g.id)).toEqual(['1'])
  })
  it('proximos is scheduled only', () => {
    expect(filterGames(games, { ...all, tab: 'proximos' }).map(g => g.id)).toEqual(['2'])
  })
  it('encerrados includes postponed and canceled', () => {
    expect(filterGames(games, { ...all, tab: 'encerrados' }).map(g => g.id)).toEqual(['3', '4', '5'])
  })
  it('favorites tab', () => {
    expect(filterGames(games, { ...all, tab: 'favoritos' }).map(g => g.id)).toEqual(['5'])
  })
  it('league filter', () => {
    expect(filterGames(games, { ...all, leagues: new Set(['ESP']) }).map(g => g.id)).toEqual(['3', '4'])
  })
  it('query ignores accents and case', () => {
    expect(filterGames(games, { ...all, query: 'ATLETICO' }).map(g => g.id)).toEqual(['3'])
  })
  it('query matches abbreviation and league name', () => {
    expect(filterGames(games, { ...all, query: 'sev' }).map(g => g.id)).toEqual(['3'])
    expect(filterGames(games, { ...all, query: 'la liga' }, { ESP: 'La Liga' }).map(g => g.id)).toEqual(['3', '4'])
  })
  it('empty input returns empty', () => {
    expect(filterGames([], all)).toEqual([])
  })
})

describe('groupGames', () => {
  it('group by league follows order', () => {
    const gs = [game('1', 'PL', 'live'), game('2', 'NBA', 'live'), game('3', 'PL', 'final')]
    const groups = groupGames(gs, 'liga', ['NBA', 'PL'], { NBA: 'NBA', PL: 'Premier League' })
    expect(groups.map(g => g.title)).toEqual(['NBA', 'Premier League'])
    expect(groups[1].games.map(g => g.id)).toEqual(['1', '3'])
  })
  it('group by hour uses Sao Paulo time', () => {
    const gs = [game('1', 'PL', 'scheduled', '2026-11-20T02:30:00Z'), game('2', 'PL', 'scheduled', '2026-11-19T18:10:00Z')]
    const groups = groupGames(gs, 'horario', ['PL'], {})
    expect(groups.map(g => g.title)).toEqual(['15:00', '23:00'])
  })
})

describe('helpers', () => {
  it('countLive', () => {
    expect(countLive([game('1', 'PL', 'live'), game('2', 'PL', 'final')])).toBe(1)
  })
  it('formatLocalTime', () => {
    expect(formatLocalTime('2026-11-20T02:30:00Z')).toBe('23:30')
  })
})

describe('needsFastPoll', () => {
  const now = new Date('2026-11-19T20:05:00Z')
  it('true when a game is live', () => {
    expect(needsFastPoll([game('1', 'PL', 'live')], now)).toBe(true)
  })
  it('true when a scheduled game has passed its start time', () => {
    expect(needsFastPoll([game('1', 'PL', 'scheduled', '2026-11-19T20:00:00Z')], now)).toBe(true)
  })
  it('false for future or finished games', () => {
    expect(needsFastPoll([game('1', 'PL', 'scheduled', '2026-11-19T21:00:00Z'), game('2', 'PL', 'final')], now)).toBe(false)
  })
  it('false for a scheduled game that started more than 6h ago', () => {
    expect(needsFastPoll([game('1', 'PL', 'scheduled', '2026-11-19T13:00:00Z')], now)).toBe(false)
  })
})
