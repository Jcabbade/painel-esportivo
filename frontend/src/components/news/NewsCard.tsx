import { useState } from 'react'
import { relativeTime } from '../../news/loadNews'
import { SOURCE_NAMES } from '../../news/sources'
import type { NewsItem } from '../../news/types'

export function NewsCard({ item, now, compact }: { item: NewsItem; now: Date; compact?: boolean }) {
  const [imgOk, setImgOk] = useState(true)
  return (
    <a className={`ncard ${compact ? 'compact' : ''}`} href={item.url} target="_blank" rel="noopener noreferrer">
      {item.image && imgOk && (
        <span className="nimg">
          <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
          {item.video && <span className="nvideo">▶ vídeo</span>}
        </span>
      )}
      <span className="nbody">
        <span className="nmeta">
          {SOURCE_NAMES[item.source] ?? item.source} · {relativeTime(item.published, now)}
          {item.video && !(item.image && imgOk) && ' · vídeo'}
        </span>
        <b className="ntitle">{item.title}</b>
        {!compact && item.summary && <span className="nsum">{item.summary}</span>}
      </span>
    </a>
  )
}
