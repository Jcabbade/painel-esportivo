/* Fontes de notícias seguidas pelo robô. Para incluir/tirar uma fonte, mexer só aqui (e no leitor, se for de tipo novo). */
import { ESPN_SITE } from '../espn/client'
import { LEAGUES } from '../espn/leagues'
import type { SourceId } from './types'

export interface SourceDef {
  id: SourceId
  name: string
  kind: 'espn' | 'telegram' | 'youtube' | 'rss'
  /** Para a ESPN, uma URL por liga (mesma ordem de `leagues`). */
  urls: string[]
  leagues: string[]
}

export const SOURCES: SourceDef[] = [
  {
    id: 'espn', name: 'ESPN Brasil', kind: 'espn',
    urls: LEAGUES.map(l => `${ESPN_SITE}/${l.path}/news?lang=pt&region=br&limit=50`),
    leagues: LEAGUES.map(l => l.key),
  },
  { id: 'fabrizio_tg', name: 'Fabrizio Romano (Telegram)', kind: 'telegram', urls: ['https://t.me/s/FabrizioRomanoTG'], leagues: [] },
  {
    id: 'fabrizio_yt', name: 'Fabrizio Romano (YouTube)', kind: 'youtube',
    urls: ['https://www.youtube.com/feeds/videos.xml?channel_id=UCX1em-uaFMS02Rrk_Bowyng'], leagues: [],
  },
  { id: 'hoops', name: 'Hoops Brasil', kind: 'rss', urls: ['https://hoopsbrasil.com.br/feed/'], leagues: ['NBA'] },
  { id: 'placar', name: 'Placar', kind: 'rss', urls: ['https://placar.com.br/rss.xml'], leagues: [] },
  { id: 'ge', name: 'ge', kind: 'rss', urls: ['https://ge.globo.com/rss/ge/futebol/'], leagues: [] },
  { id: 'jumper', name: 'Jumper Brasil', kind: 'rss', urls: ['https://jumperbrasil.com.br/?feed=rss2'], leagues: ['NBA'] },
]

export const SOURCE_NAMES: Record<SourceId, string> =
  Object.fromEntries(SOURCES.map(s => [s.id, s.name])) as Record<SourceId, string>

/** Seções do Placar (primeiro trecho do endereço) → liga. `null` = entra só se citar time coberto. */
export const PLACAR_SECTIONS: Record<string, string | null> = {
  'campeonato-ingles': 'PL',
  'campeonato-espanhol': 'ESP',
  'champions-league': 'UCL',
  'nba': 'NBA',
  'nfl': 'NFL',
  'futebol-europeu': null,
  'futebol-internacional': null,
  'mercado-da-bola': null,
}
