/* Peças de filtro e de estado comuns às telas de ranking. */
import { useEffect, useState } from 'react'
import { HistoryMissing, loadHistory, loadMeta } from '../history/loadHistory'
import type { LeagueFile, Meta } from '../history/types'
import { dataAge } from '../rankings/compute'

export function Seg<T extends string | number>({ value, options, onChange, disabled }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: (v: T) => boolean
}) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} disabled={disabled?.(o.value)}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function LineStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1 })
  return (
    <div className="stepper">
      <button aria-label="Diminuir linha" onClick={() => onChange(Math.max(0.5, value - 0.5))}>−</button>
      <b>{fmt(value)}</b>
      <button aria-label="Aumentar linha" onClick={() => onChange(value + 0.5)}>+</button>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="rfield"><span>{label}</span>{children}</label>
}

/** Estado salvo no aparelho (filtros). Falha de armazenamento: só memória. */
export function usePref<T extends object>(key: string, initial: T): [T, (patch: Partial<T>) => void] {
  const [v, setV] = useState<T>(() => {
    try { return { ...initial, ...JSON.parse(localStorage.getItem(key) ?? '{}') } } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignora */ } }, [key, v])
  return [v, patch => setV(prev => ({ ...prev, ...patch }))]
}

/** Carrega os arquivos das ligas pedidas; ligas que falharem vão para `errors`. */
export function useHistory(keys: string[]) {
  const [state, setState] = useState<{ files: LeagueFile[]; errors: string[]; missing: boolean; loading: boolean; meta: Meta | null }>(
    { files: [], errors: [], missing: false, loading: true, meta: null })
  const [attempt, setAttempt] = useState(0)
  const k = keys.join(',')
  useEffect(() => {
    let alive = true
    setState(s => ({ ...s, loading: true }))
    Promise.all([Promise.allSettled(k.split(',').map(loadHistory)), loadMeta().catch(() => null)]).then(([res, meta]) => {
      if (!alive) return
      const files: LeagueFile[] = [], errors: string[] = []
      let missing = false
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') files.push(r.value)
        else { errors.push(`${k.split(',')[i]}: ${r.reason?.message ?? r.reason}`); if (r.reason instanceof HistoryMissing) missing = true }
      })
      setState({ files, errors, missing: missing && !files.length, loading: false, meta })
    })
    return () => { alive = false }
  }, [k, attempt])
  return { ...state, retry: () => setAttempt(a => a + 1) }
}

export function DataStatus({ meta, games, loading, errors, missing, onRetry }: {
  meta: Meta | null; games: number; loading: boolean; errors: string[]; missing: boolean; onRetry: () => void
}) {
  if (loading) return <p className="empty">Carregando histórico…</p>
  if (missing) return <p className="empty">O histórico ainda está sendo montado. Volte mais tarde.</p>
  const age = meta ? dataAge(meta.updated_at, new Date()) : null
  return (
    <>
      {age && (
        <p className={`nage ${age.stale ? 'stale' : ''}`}>
          {age.stale ? `${age.label.replace('Dados até', 'Dados de')} — o robô diário pode estar parado.` : age.label}
          {' · '}{games.toLocaleString('pt-BR')} jogos considerados
        </p>
      )}
      {errors.length > 0 && (
        <div className="dwarn">
          Não foi possível carregar: {errors.join('; ')}. <button className="linkbtn" onClick={onRetry}>Tentar de novo</button>
        </div>
      )}
    </>
  )
}
