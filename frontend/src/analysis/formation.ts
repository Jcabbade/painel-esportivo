/* Distribui os titulares nas linhas do esquema tático, do goleiro ao ataque, da esquerda para a direita. */
import type { LineupPlayer } from '../espn/detailTypes'

function depth(pos: string | null): number {
  const p = (pos ?? '').toUpperCase().replace(/-[LR]$/, '')
  if (p === 'G' || p === 'GK') return 0
  if (/^(RB|LB|CD|CB|RWB|LWB|SW|D)$/.test(p)) return 1
  if (/^(DM|CDM)$/.test(p)) return 2
  if (/^(CM|LM|RM|M)$/.test(p)) return 3
  if (/^(AM|CAM|LW|RW|W)$/.test(p)) return 4
  if (/^(F|CF|ST|FW|S)$/.test(p)) return 5
  return 3 // desconhecida: meio de campo
}

function lateral(pos: string | null): number {
  const p = (pos ?? '').toUpperCase()
  if (p.endsWith('-L') || /^L(B|M|W|WB)$/.test(p)) return 0
  if (p.endsWith('-R') || /^R(B|M|W|WB)$/.test(p)) return 2
  return 1
}

export function formationLayout(formation: string | null, starters: LineupPlayer[]): LineupPlayer[][] {
  const order = starters.map((p, i) => ({ p, i, d: depth(p.position) }))
  const keepers = order.filter(x => x.d === 0)
  const gk = keepers.slice(0, 1)
  const outfield = order.filter(x => !gk.includes(x)).sort((a, b) => a.d - b.d || a.i - b.i)
  const sizes = (formation ?? '').split('-').map(Number)
  const valid = sizes.length >= 2 && sizes.every(n => Number.isInteger(n) && n > 0)
    && sizes.reduce((s, n) => s + n, 0) === outfield.length
  let rows: typeof outfield[] = []
  if (valid) {
    let k = 0
    for (const n of sizes) { rows.push(outfield.slice(k, k + n)); k += n }
  } else {
    const byDepth = new Map<number, typeof outfield>()
    for (const x of outfield) { if (!byDepth.has(x.d)) byDepth.set(x.d, []); byDepth.get(x.d)!.push(x) }
    rows = [...byDepth.keys()].sort((a, b) => a - b).map(d => byDepth.get(d)!)
  }
  const sortRow = (r: typeof outfield) => [...r].sort((a, b) => lateral(a.p.position) - lateral(b.p.position) || a.i - b.i).map(x => x.p)
  return [...(gk.length ? [gk.map(x => x.p)] : []), ...rows.filter(r => r.length).map(sortRow)]
}
