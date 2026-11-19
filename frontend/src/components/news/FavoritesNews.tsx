import { newsForTeams } from '../../news/loadNews'
import type { NewsFile } from '../../news/types'
import { NewsCard } from './NewsCard'

interface Props {
  file: NewsFile | null
  favs: Set<string>
  onSeeAll: () => void
  /** 'strip' = faixa horizontal (aba Favoritos); 'list' = lista vertical (painel da direita). */
  layout: 'strip' | 'list'
}

/** "Notícias dos seus times". Sem favoritos: não aparece. */
export function FavoritesNews({ file, favs, onSeeAll, layout }: Props) {
  if (!favs.size || !file) return null
  const items = newsForTeams(file, favs, layout === 'strip' ? 5 : 8)
  const now = new Date()
  return (
    <section className={`favnews ${layout}`}>
      <div className="favnews-head">
        <b>Notícias dos seus times</b>
        {items.length > 0 && <button className="linkbtn" onClick={onSeeAll}>Ver todas ›</button>}
      </div>
      {items.length === 0
        ? <p className="muted small">Sem notícias recentes dos seus times.</p>
        : <div className={layout === 'strip' ? 'nstrip' : 'nlist'}>
          {items.map(i => <NewsCard key={i.id} item={i} now={now} compact={layout === 'strip'} />)}
        </div>}
    </section>
  )
}
