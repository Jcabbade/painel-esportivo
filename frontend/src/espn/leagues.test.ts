import { describe, expect, it } from 'vitest'
import { LEAGUES, initialStandingsKey, league } from './leagues'

describe('ligas', () => {
  it('ordem e caminhos', () => {
    expect(LEAGUES.map(l => l.key)).toEqual(['NFL', 'NBA', 'BRA', 'CDB', 'LIB', 'SUL', 'PL', 'UCL', 'ESP', 'ITA', 'ALE'])
    expect(league('BRA').path).toBe('soccer/bra.1')
    expect(league('CDB').path).toBe('soccer/bra.copa_do_brazil')
    expect(league('LIB').path).toBe('soccer/conmebol.libertadores')
    expect(league('SUL').path).toBe('soccer/conmebol.sudamericana')
    expect(['BRA', 'CDB', 'LIB', 'SUL'].every(k => league(k).sport === 'soccer')).toBe(true)
  })

  it('só a Copa do Brasil é mata-mata', () => {
    expect(LEAGUES.filter(l => l.knockout).map(l => l.key)).toEqual(['CDB'])
  })

  it('liga inicial da tabela', () => {
    expect(initialStandingsKey(null)).toBe('BRA')
    expect(initialStandingsKey('xyz')).toBe('BRA')
    expect(initialStandingsKey('PL')).toBe('PL')
  })
})
