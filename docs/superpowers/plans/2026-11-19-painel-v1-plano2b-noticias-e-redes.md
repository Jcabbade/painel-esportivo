# Painel Esportivo v1 — Plano 2b: notícias e redes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notícias em português dos times favoritos e do jogo clicado, e uma aba "Notícias" com ESPN Brasil, Fabrizio Romano (Telegram e YouTube), Hoops Brasil, Placar, ge e Jumper Brasil. Um robô atualiza tudo a cada 30 minutos.

**Architecture:** `src/news/` tem só funções puras: o índice de times com apelidos, a identificação de times citados num texto, os leitores de cada fonte e a montagem do arquivo final. Um script (`vite-node`) chama essas funções num workflow agendado, que grava `news.json` no ramo `news`. O site busca esse arquivo em `raw.githubusercontent.com` e o filtra por favoritos e por jogo.

**Tech Stack:** React 19 + TypeScript + Vite + Vitest (existentes); `vite-node` e `fast-xml-parser`, como devDependencies em versão fixa; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-19-painel-esportivo-design.md` §10 (fontes, regras e telas); §3 anti-objetivos.

## Global Constraints

- Cada notícia mostra só título, resumo de até 280 caracteres em texto puro, foto, fonte, horário e link para o original. O texto completo nunca é copiado. O HTML vira texto no robô, e o React escapa o que for exibido.
- Só links `http(s)`. Remover do link os parâmetros de rastreio (`?source=…` do Placar e qualquer `utm_*`).
- Notícias com mais de 7 dias saem, com um máximo de 400 itens. Os itens ficam em ordem de publicação, os mais novos primeiro.
- Se uma fonte falhar, os itens dela da execução anterior continuam, e o status fica `ok: false` com a mensagem de erro. Uma fonte nunca derruba as outras.
- Times no formato `"sport:team_id"`, igual aos favoritos (`store.ts`).
- Textos da tela em português, fuso `America/Sao_Paulo`, commits com o e-mail noreply.
- URL do arquivo no site: `https://raw.githubusercontent.com/Jcabbade/painel-esportivo/news/news.json` (constante `NEWS_URL`).

## Formato (`news.json`)

```ts
interface NewsItem {
  id: string            // url normalizada
  source: SourceId      // 'espn' | 'fabrizio_tg' | 'fabrizio_yt' | 'hoops' | 'placar' | 'ge' | 'jumper'
  title: string
  summary: string       // ≤ 280, texto puro, pode ser ''
  url: string
  image: string | null
  published: string     // ISO UTC
  video: boolean
  leagues: string[]     // chaves de LEAGUES
  teams: string[]       // 'soccer:359'
}
interface NewsFile {
  updated_at: string
  sources: Record<SourceId, { name: string; ok: boolean; error: string | null; count: number; last_ok: string | null }>
  items: NewsItem[]
}
```

## Fontes (`src/news/sources.ts`)

| id | Nome na tela | URL | Ligas | Regra de inclusão |
|---|---|---|---|---|
| espn | ESPN Brasil | `${ESPN_SITE}/<path>/news?lang=pt&region=br&limit=50` (7 ligas) | a da URL | tudo; times = `categories[type=team].teamId` → `"<sport>:<id>"` (mais os citados no texto) |
| fabrizio_tg | Fabrizio Romano (Telegram) | `https://t.me/s/FabrizioRomanoTG` | [] | tudo; `video` se o post tiver vídeo |
| fabrizio_yt | Fabrizio Romano (YouTube) | `https://www.youtube.com/feeds/videos.xml?channel_id=UCX1em-uaFMS02Rrk_Bowyng` | [] | tudo; `video: true` |
| hoops | Hoops Brasil | `https://hoopsbrasil.com.br/feed/` | NBA | tudo |
| placar | Placar | `https://placar.com.br/rss.xml` | pela seção | `campeonato-ingles`→PL, `campeonato-espanhol`→ESP, `champions-league`→UCL, `nba`→NBA, `nfl`→NFL entram sempre; `futebol-europeu`, `futebol-internacional`, `mercado-da-bola` só se citarem time coberto; demais seções saem |
| ge | ge | `https://ge.globo.com/rss/ge/futebol/` | [] | só se citar time de futebol coberto |
| jumper | Jumper Brasil | `https://jumperbrasil.com.br/?feed=rss2` | NBA | tudo |

Detecção de times citados (`matchTeams`):
- Compara título + resumo, sem diferenciar maiúsculas nem acentos, com limite de palavra.
- Usa o nome completo (`displayName`), o nome curto (`shortDisplayName`), o apelido NBA/NFL (o `name` da ESPN, ex. "Lakers") e a tabela `ALIASES` de nomes em português.
- Um nome curto ou apelido que pertença a mais de um time coberto não conta sozinho. Exemplos: "United" e "City".
- `ALIASES` iniciais:
  - `Bayern de Munique`→Bayern;
  - `Inter de Milão`, `Inter`→Internazionale;
  - `Barça`→Barcelona;
  - `Atlético de Madrid`→Atlético Madrid;
  - `Milan`→AC Milan;
  - `Juve`→Juventus;
  - `Tottenham`→Tottenham Hotspur;
  - `PSG`→Paris Saint-Germain;
  - `Leverkusen`→Bayer Leverkusen;
  - `Dortmund`→Borussia Dortmund.
  - A chave é o nome em português; o valor é o `displayName` da ESPN.
- O índice de times vem das classificações atuais das 7 ligas (`ESPN_STANDINGS`), buscadas pelo robô a cada execução.

## Review Focus

1. **Fonte fora do ar ou com formato mudado** (Telegram muda o HTML, feed devolve página de erro): os itens anteriores dela continuam, o status vira "fora do ar" e as outras fontes não são afetadas. → `failed source keeps previous items` (Task 3).
2. **Nome curto ambíguo** ("United", "City", "Real"): não marca time nenhum sozinho. "Manchester United" marca. → `ambiguous short names do not match alone` (Task 1).
3. **Notícia duplicada** (mesma matéria em duas execuções ou com parâmetros de rastreio diferentes): aparece uma vez só. → `dedupes by normalized url` (Task 3).
4. **Texto com HTML ou script** no feed: vira texto puro, e links que não são `http(s)` são descartados. → `sanitizes html and rejects non-http links` (Task 2).
5. **Arquivo velho** (robô parado): a aba mostra "atualizado há X" e um aviso depois de 3 h. → `stale news after 3h` (Task 4).

---

### Task 1: Índice de times e detecção nos textos

**Files:**
- Create: `frontend/src/news/teams.ts`, `frontend/src/news/types.ts` (tipos acima)
- Test: `frontend/src/news/teams.test.ts`

**Interfaces:**
- Produces:
  - `buildTeamIndex(standings: { league: string; sport: Sport; payload: unknown }[]): TeamIndex`, que lê `children[].standings.entries[].team` e também `children[].children[]`.
  - `matchTeams(text: string, index: TeamIndex, sport?: Sport): string[]`, que devolve chaves `"sport:id"` sem repetição, na ordem em que aparecem no texto.

- [ ] **Step 1: Testes que falham** (índice montado com `standings_PL/UCL/NBA/NFL.json`):
  - `matches full names accent-insensitive`: "Pochettino chega ao Manchester United" → `['soccer:360']`.
  - `ambiguous short names do not match alone`: "United vence fora" → `[]`; "City perde" → `[]`.
  - `nba nicknames match`: "Lakers vencem os Celtics" → as duas chaves de basquete.
  - `aliases`: "PSG e Bayern de Munique": PSG tem que estar no índice (veio da UCL) → chave do PSG; Bayern de Munique entra só se o Bayern estiver no índice. Testar com um índice montado à mão com os dois.
  - `word boundary`: "Interessante" não marca Inter.
  - `sport filter`: "Giants" com `sport: 'football'` → só a NFL.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: identificação de times citados em notícias`.

### Task 2: Leitores das fontes

**Files:**
- Create: `frontend/src/news/sources.ts`, `frontend/src/news/parse.ts`
- Create (fixtures reais, baixadas no Step 1): `backend/tests/fixtures/news/espn_PL_pt.json`, `fabrizio_tg.html`, `fabrizio_yt.xml`, `hoops.xml`, `placar.xml`, `ge_futebol.xml`, `jumper.xml`
- Modify: `frontend/package.json` (`fast-xml-parser` e `vite-node` como devDependencies fixas)
- Test: `frontend/src/news/parse.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `SOURCES: { id: SourceId; name: string; urls: string[]; kind: 'espn'|'telegram'|'youtube'|'rss'; leagues: string[] }[]`;
  - `parseSource(id: SourceId, body: string | unknown, ctx: { index: TeamIndex; league?: string }): NewsItem[]`, que aplica as regras de inclusão da tabela;
  - `normalizeUrl(url: string): string | null`, que devolve `null` se o link não for `http(s)`;
  - `toText(html: string, max = 280): string`.

- [ ] **Step 1:** Baixar as fixtures, uma requisição por fonte, guardando a resposta como veio. Depois escrever os testes que falham:
  - `espn items with team tags`: lê o fixture → título e link `espn.com.br`. Cada item com `categories` de time tem `teams` contendo `"soccer:<id>"`, e `leagues: ['PL']`.
  - `telegram posts`: ≥ 10 itens; cada um com `url` `https://t.me/FabrizioRomanoTG/<n>`, `published` em ISO e título = primeira linha do texto (até 120 caracteres), com o restante no resumo.
  - `youtube entries`: 15 itens, `video: true`, `image` = miniatura.
  - `hoops rss`: 10 itens, `leagues: ['NBA']`, times da NBA marcados quando o título cita o time.
  - `placar sections`: o item `campeonato-ingles/...` entra com `leagues ['PL']`; um `brasileirao/...` não entra; um `futebol-europeu/...` só entra se citar time coberto; o link sai sem `?source=`.
  - `ge only covered teams`: todos os itens que saem têm `teams.length > 0`.
  - `sanitizes html and rejects non-http links`: um item montado com `<script>alert(1)</script><b>Oi</b>` no resumo e `javascript:` no link → resumo `"Oi"` e o item descartado.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
  - RSS/Atom com `fast-xml-parser`. Imagem de `media:content`, `media:thumbnail` ou `enclosure`; se não houver, a primeira `<img>` do conteúdo.
  - Telegram por expressão regular sobre os blocos `tgme_widget_message`: `data-post`, `<time datetime>`, `tgme_widget_message_text` e `background-image` da foto.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: leitores das fontes de notícias`.

### Task 3: Robô de notícias

**Files:**
- Create: `frontend/src/news/build.ts`, `frontend/scripts/update-news.ts`, `.github/workflows/news.yml`
- Modify: `frontend/package.json` (script `"update-news": "vite-node scripts/update-news.ts"`)
- Test: `frontend/src/news/build.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `buildNews(prev: NewsFile | null, results: { id: SourceId; items?: NewsItem[]; error?: string }[], now: Date): NewsFile`. Mescla com o arquivo anterior, tira duplicados pelo `id`, mantém os itens de fonte que falhou, remove os com mais de 7 dias, ordena e limita a 400.
  - `scripts/update-news.ts <arquivo>`:
    1. lê o arquivo anterior, se existir;
    2. busca as 7 classificações e monta o índice;
    3. busca cada fonte, com tempo limite de 20 s e User-Agent genérico `PainelEsportivo/1.0` (sem dados pessoais);
    4. grava o arquivo e imprime um resumo por fonte.
  - Sai com código 1 só se todas as fontes falharem.
- `news.yml`:
  - gatilhos `schedule: '*/30 * * * *'` e `workflow_dispatch`; `permissions: contents: write`; `concurrency: news`;
  - checkout da `main` e do ramo `news` em `news-store/` (pasta vazia se o ramo não existir);
  - `npm ci`, `npm run update-news -- ../news-store/news.json`;
  - commit e push no ramo `news` (órfão na primeira vez), com o autor `github-actions[bot]`, só se o arquivo mudou.

- [ ] **Step 1: Testes que falham:**
  - `dedupes by normalized url`: o mesmo link com e sem `?utm_source=x` em duas execuções → 1 item.
  - `failed source keeps previous items`: o anterior tem 3 itens do `placar`; a execução atual tem `placar` com erro → os 3 itens continuam, `sources.placar.ok === false`, `error` preenchido, `last_ok` mantido.
  - `drops items older than 7 days and caps 400`.
  - `sorted newest first`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `build.ts`, o script e o workflow.
- [ ] **Step 4:** `npm test` → PASS. **Rodada real local:** `npm run update-news -- <scratchpad>/news.json` → as 7 fontes com status. Jumper com 0 itens novos é esperado; os itens com mais de 7 dias saem. Conferir 3 itens contra os sites.
- [ ] **Step 5:** Commit `feat: robô de notícias a cada 30 minutos`. **Confirmar com o usuário antes do push** que liga o agendamento e cria o ramo `news`. Depois do push: `gh workflow run news.yml`, `gh run watch` e conferir que `NEWS_URL` responde.

### Task 4: Notícias na tela

**Files:**
- Create: `frontend/src/news/loadNews.ts`, `frontend/src/components/news/NewsCard.tsx`, `frontend/src/components/news/NewsList.tsx`, `frontend/src/components/NewsPage.tsx`
- Modify:
  - `frontend/src/App.tsx`: aba "Notícias" na navegação, ficando **Jogos · Tabela · Notícias**. "Classificação" vira "Tabela".
  - `frontend/src/components/DetailPane.tsx`: seção "Notícias" e, sem jogo aberto, as notícias dos favoritos.
  - `frontend/src/components/GameList.tsx`, ou o ponto em `App` que renderiza a aba Favoritos: o bloco "Notícias dos seus times".
  - `frontend/src/styles.css`.
- Test: `frontend/src/news/loadNews.test.ts`

**Interfaces:**
- Consumes: tipos da Task 1; `getFavorites`.
- Produces:
  - `loadNews(opts?: { fetch?: Fetcher; now?: Date }): Promise<NewsFile>`: busca `NEWS_URL` e guarda em memória por 5 minutos;
  - `newsForTeams(file: NewsFile, keys: Set<string>, limit?: number): NewsItem[]`;
  - `newsForGame(file: NewsFile, game: Game, limit = 6): NewsItem[]`, com os itens que citam `"<sport>:<home>"` ou `"<sport>:<away>"`;
  - `relativeTime(iso: string, now: Date): string`: "agora", "há 12 min", "há 3 h", "ontem", "12/11";
  - `newsAge(file: NewsFile, now: Date): { label: string; stale: boolean }`, com `stale` acima de 3 h.

- [ ] **Step 1: Testes que falham:**
  - `newsForTeams filters and sorts`: só os itens com time favorito, os mais novos primeiro, respeitando `limit`.
  - `newsForGame uses both teams and sport`: `soccer:86` não traz um item `basketball:86`.
  - `relative time labels`: os 5 formatos acima.
  - `stale news after 3h`.
  - `loadNews caches 5 min`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
  - `NewsCard`:
    - foto, que some se a imagem falhar;
    - selo "vídeo";
    - fonte · tempo relativo;
    - título;
    - resumo de 2 linhas;
    - o card inteiro é um link `target="_blank" rel="noopener noreferrer"`.
  - Aba Favoritos: bloco "Notícias dos seus times" com até 5 itens e "Ver todas", que abre a aba Notícias já filtrada por favoritos.
    - Sem favoritos: o bloco não aparece.
    - Sem notícias: "Sem notícias recentes dos seus times".
  - Detalhe do jogo: seção "Notícias" no fim, que não aparece se não houver item.
  - Painel da direita no computador, sem jogo aberto: "Notícias dos seus times", ou o texto atual se não houver favoritos.
  - `NewsPage`:
    - chips de fonte, com a fonte "fora do ar" esmaecida e com dica;
    - chip "★ Só favoritos";
    - lista paginada de 20 em 20 ("Mostrar mais");
    - topo com "atualizado há X" e aviso amarelo se `stale`;
    - erro com "Tentar de novo".
  - Filtros lembrados em `painel.noticias`.
- [ ] **Step 4:** `npm test` e `npm run build` → sem erros.
- [ ] **Step 5: Verificação manual** com `npm run dev`, lendo o `news.json` real publicado no Step 5 da Task 3:
  - favoritar um time que tenha notícias (ex.: Manchester United) → o bloco aparece na aba Favoritos;
  - abrir um jogo desse time → a seção "Notícias" aparece;
  - aba Notícias: filtros funcionam e os links abrem o original;
  - largura de 390 px;
  - console sem erros.
- [ ] **Step 6:** Commit `feat: notícias dos favoritos, do jogo e aba Notícias`. Depois da revisão final: merge na `main`, push (publica), `gh run watch` verde e verificação rápida no site publicado.
