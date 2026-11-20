/* Notícias gravadas pelo robô (news.json no ramo `news`). */

export type SourceId = 'espn' | 'fabrizio_tg' | 'fabrizio_yt' | 'hoops' | 'placar' | 'ge' | 'jumper'

export interface NewsItem {
  id: string            // url normalizada
  source: SourceId
  title: string
  summary: string       // até 280 caracteres, texto puro
  url: string
  image: string | null
  published: string     // ISO UTC
  video: boolean
  leagues: string[]     // chaves de LEAGUES
  teams: string[]       // 'soccer:359'
}

export interface SourceStatus {
  name: string
  ok: boolean
  error: string | null
  count: number
  last_ok: string | null
}

export interface NewsFile {
  updated_at: string
  /** Quando o navegador buscou a ESPN direto porque o arquivo do robô estava velho. */
  live_at?: string
  sources: Record<SourceId, SourceStatus>
  items: NewsItem[]
}
