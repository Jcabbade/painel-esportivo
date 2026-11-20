import { useEffect, useState } from 'react'
import { newsAge } from '../news/loadNews'
import { SOURCES } from '../news/sources'
import type { NewsFile, SourceId } from '../news/types'
import { NewsCard } from './news/NewsCard'

interface Props {
  file: NewsFile | null
  error: string | null
  favs: Set<string>
  onlyFavs: boolean
  onOnlyFavs: (v: boolean) => void
  onRetry: () => void
}

const PAGE = 20

function readSource(): SourceId | 'todas' {
  try {
    const v = JSON.parse(localStorage.getItem('painel.noticias') ?? '{}').source
    return SOURCES.some(s => s.id === v) ? v : 'todas'
  } catch { return 'todas' }
}

export function NewsPage({ file, error, favs, onlyFavs, onOnlyFavs, onRetry }: Props) {
  const [source, setSource] = useState<SourceId | 'todas'>(readSource)
  const [shown, setShown] = useState(PAGE)
  useEffect(() => {
    try { localStorage.setItem('painel.noticias', JSON.stringify({ source, fav: onlyFavs })) } catch { /* ignora */ }
    setShown(PAGE)
  }, [source, onlyFavs])

  const now = new Date()
  const items = (file?.items ?? [])
    .filter(i => source === 'todas' || i.source === source)
    .filter(i => !onlyFavs || i.teams.some(t => favs.has(t)))
  const age = file ? newsAge(file, now) : null

  return (
    <section className="news-page">
      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${onlyFavs ? 'on' : ''}`} onClick={() => onOnlyFavs(!onlyFavs)}>★ Só favoritos</button>
          <button className={`chip ${source === 'todas' ? 'on' : ''}`} onClick={() => setSource('todas')}>Todas</button>
          {SOURCES.map(s => {
            const st = file?.sources?.[s.id]
            const down = st && !st.ok
            return (
              <button key={s.id} className={`chip ${source === s.id ? 'on' : ''} ${down ? 'down' : ''}`}
                title={down ? `Fora do ar: ${st.error ?? ''}` : undefined} onClick={() => setSource(s.id)}>
                {s.name}{down ? ' ⚠' : ''}
              </button>
            )
          })}
        </div>
      </div>
      <div className="list">
        {age && <p className={`nage ${age.stale ? 'stale' : ''}`}>
          {age.stale && age.live ? `ESPN Brasil buscada agora; as outras fontes estão paradas (${age.label}).`
            : age.stale ? `Notícias ${age.label.replace('atualizado', 'atualizadas')} — o robô pode estar parado.` : `Notícias ${age.label.replace('atualizado', 'atualizadas')}`}
        </p>}
        {!file && !error && <p className="empty">Carregando…</p>}
        {!file && error && (
          <div className="derr">
            <p>Não foi possível carregar as notícias ({error}).</p>
            <button onClick={onRetry}>Tentar de novo</button>
          </div>
        )}
        {file && items.length === 0 && (
          <p className="empty">{onlyFavs && !favs.size ? 'Marque times com ★ para ver as notícias deles.' : 'Nenhuma notícia com esses filtros.'}</p>
        )}
        <div className="nlist">
          {items.slice(0, shown).map(i => <NewsCard key={i.id} item={i} now={now} />)}
        </div>
        {items.length > shown && <button className="more" onClick={() => setShown(n => n + PAGE)}>Mostrar mais</button>}
      </div>
      <footer className="foot">Notícias de ESPN Brasil, Fabrizio Romano, Hoops Brasil, Placar, ge e Jumper Brasil · os links abrem o site original</footer>
    </section>
  )
}
