import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetMemory, getCachedRanks, getFavorites, setCachedRanks, toggleFavorite } from './store'

class MemStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

describe('store', () => {
  beforeEach(() => { _resetMemory(); vi.stubGlobal('localStorage', new MemStorage()) })
  afterEach(() => vi.unstubAllGlobals())

  it('toggles favorites keyed by sport', () => {
    expect(toggleFavorite('basketball', '1')).toBe(true)
    expect(getFavorites().has('basketball:1')).toBe(true)
    expect(getFavorites().has('soccer:1')).toBe(false)
    expect(toggleFavorite('basketball', '1')).toBe(false)
    expect(getFavorites().size).toBe(0)
  })

  it('favorites persist in storage', () => {
    toggleFavorite('soccer', '86')
    _resetMemory()
    expect(getFavorites().has('soccer:86')).toBe(true)
  })

  it('favorites survive storage errors', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('bloqueado') },
      setItem() { throw new Error('bloqueado') },
      removeItem() { throw new Error('bloqueado') },
    })
    expect(toggleFavorite('soccer', '2')).toBe(true)
    expect(getFavorites().has('soccer:2')).toBe(true)
  })

  it('ranks cache expires after 6h', () => {
    const t0 = new Date('2026-11-19T12:00:00Z')
    setCachedRanks('PL', { '1': 3 }, t0)
    expect(getCachedRanks('PL', new Date('2026-11-19T17:59:00Z'))).toEqual({ '1': 3 })
    expect(getCachedRanks('PL', new Date('2026-11-19T18:01:00Z'))).toBeNull()
    expect(getCachedRanks('ESP', t0)).toBeNull()
  })
})
