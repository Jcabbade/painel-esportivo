import { describe, expect, it } from 'vitest'
import { fixture } from './testFixtures'
import { loadFavoriteTeam, summarizeSchedule } from './teamSchedule'

const now = new Date('2026-11-20T03:30:00Z')

describe('agenda do time favorito', () => {
  it('NFL: último resultado e próximo jogo', () => {
    const s = summarizeSchedule([fixture('sched_NFL_12.json')], '12', now)
    expect(s.name).toBe('Kansas City Chiefs')
    expect(s.last).toMatchObject({ date: '2026-11-15T18:00Z', home: false, us: 35, them: 13, result: 'V' })
    expect(s.next).toMatchObject({ date: '2026-11-22T18:00Z', home: true, us: null, them: null, result: null })
    expect(s.next!.opponent.id).toBe('22')
  })

  it('futebol: junta jogos passados e futuros e diz a competição', () => {
    const s = summarizeSchedule([fixture('sched_ESP_86_past.json'), fixture('sched_ESP_86_next.json')], '86', now)
    expect(s.next).toMatchObject({ date: '2026-11-21T20:00Z', home: true, league: 'LALIGA' })
    expect(s.next!.opponent.name).toMatch(/Celta/)
    expect(s.last).not.toBeNull()
    expect(Date.parse(s.last!.date)).toBeLessThan(now.getTime())
  })

  it('futebol: 2 buscas na rota de todas as competições', async () => {
    const calls: string[] = []
    const s = await loadFavoriteTeam('soccer:86', {
      now,
      fetch: async (u: string) => {
        calls.push(u)
        if (u.endsWith('/soccer/all/teams/86/schedule')) return fixture('sched_ESP_86_past.json')
        if (u.endsWith('/soccer/all/teams/86/schedule?fixture=true')) return fixture('sched_ESP_86_next.json')
        throw new Error('404')
      },
    })
    expect(calls).toHaveLength(2)
    expect(s.name).toBe('Real Madrid')
    expect(s.next?.date).toBe('2026-11-21T20:00Z')
  })

  it('futebol: se a rota de todas falhar, busca liga por liga e ignora as que falham', async () => {
    const calls: string[] = []
    const s = await loadFavoriteTeam('soccer:86', {
      now,
      fetch: async (u: string) => {
        calls.push(u)
        if (u.includes('/soccer/all/')) throw new Error('500')
        if (u.endsWith('/soccer/esp.1/teams/86/schedule')) return fixture('sched_ESP_86_past.json')
        if (u.endsWith('/soccer/esp.1/teams/86/schedule?fixture=true')) return fixture('sched_ESP_86_next.json')
        throw new Error('404')
      },
    })
    expect(calls.length).toBe(20) // 2 da rota geral + 9 ligas × (passados + próximos)
    expect(s.name).toBe('Real Madrid')
    expect(s.next?.date).toBe('2026-11-21T20:00Z')
  })

  it('nenhuma resposta: erro', async () => {
    await expect(loadFavoriteTeam('basketball:13', { now, fetch: async () => { throw new Error('500') } })).rejects.toThrow()
  })
})
