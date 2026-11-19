import type { GamesResponse, League, Sport } from './types'

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json() as Promise<T>
}

export const getLeagues = () => fetch('/api/leagues').then(r => json<League[]>(r))

export const getGames = (date: string) =>
  fetch(`/api/games?date=${encodeURIComponent(date)}`).then(r => json<GamesResponse>(r))

export async function setFavorite(sport: Sport, teamId: string, on: boolean): Promise<void> {
  const r = await fetch(`/api/favorites/${sport}/${encodeURIComponent(teamId)}`, { method: on ? 'PUT' : 'DELETE' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}
