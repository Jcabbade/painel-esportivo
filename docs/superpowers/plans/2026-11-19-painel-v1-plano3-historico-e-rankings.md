# Painel Esportivo v1 — Plano 3: histórico diário e rankings de ligas e times

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um robô diário no GitHub guarda uma ficha de cada jogo encerrado das 7 ligas, e o site ganha as abas "Ligas" e "Times", com rankings no estilo StatsHub calculados no navegador a partir dessas fichas.

**Architecture:** `src/history/` transforma o `summary` da ESPN numa ficha compacta (`GameRecord`) e atualiza um arquivo por liga, de forma incremental e retomável. Ele roda no Node pelo `vite-node`, chamado pelo workflow, que guarda os arquivos no ramo `data` e os copia para `public/data/` antes do build. `src/rankings/` tem só funções puras: definição das estatísticas e cálculo dos rankings. As telas carregam o JSON da liga e chamam essas funções.

**Tech Stack:** React 19 + TypeScript + Vite + Vitest (existentes); `vite-node` (fixar como devDependency na versão já instalada); GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-19-painel-esportivo-design.md` (§2 itens 4–5 e tabela "Estatísticas para os rankings", §3 anti-objetivos, §5 Histórico/Competições misturadas, §9)

## Global Constraints

- Nada estimado: estatística que a ESPN não mandou num jogo **não conta** naquele jogo (nem como 0). A soma de quartos ou de cartões amarelos e vermelhos é permitida, porque soma números reais.
- Os rankings sempre mostram o nº de jogos considerados e "Dados até DD/MM HH:MM". Se os dados tiverem mais de 36 h, aparece um aviso.
- Um ranking só compara ligas do mesmo esporte. Nos rankings de times, "Todas" significa todas as ligas de futebol, somando os jogos do mesmo time em todas elas.
- "Últimos 5/10/15/20" contam os jogos mais recentes, mesmo atravessando temporadas. "Temporada" usa só a temporada atual da liga, ou seja, o maior `season` no arquivo dela.
- Períodos:
  - Futebol: gols, ambas marcam e resultado têm jogo todo, 1º tempo e 2º tempo. As outras estatísticas só têm jogo todo.
  - NBA/NFL: pontos têm jogo todo, 1º tempo (Q1+Q2), 2º tempo (Q3+Q4, sem prorrogação) e Q1 a Q4. As outras estatísticas só têm jogo todo.
  - Período indisponível aparece desabilitado.
- NBA/NFL: jogos de `season.type` 1 (pré-temporada) ficam de fora. Jogos com um time que não está na classificação atual da liga (All-Star, Pro Bowl) também ficam de fora.
- Textos em português, fuso `America/Sao_Paulo`, commits com o e-mail noreply.
- Carga inicial a partir de **2025-07-01** para as 7 ligas. Isso cobre a temporada atual e a anterior.

## Formato dos dados (`public/data/`)

```ts
// games-<LIGA>.json
interface LeagueFile {
  league: string                       // 'PL', 'NBA', ...
  updated_at: string                   // ISO UTC
  scanned_until: string | null         // último dia ESPN (YYYY-MM-DD) já varrido
  teams: Record<string, { name: string; abbrev: string; logo: string | null }>
  games: GameRecord[]                  // ordenados por date
}
interface GameRecord {
  id: string; date: string; season: number
  h: string; a: string                 // ids dos times
  hs: number; as: number               // placar final (com prorrogação)
  hp: number[]; ap: number[]           // por período: tempos (futebol) ou quartos (+OT) — vazio se a ESPN não mandou
  st: { h: Record<string, number>; a: Record<string, number> }   // só as chaves abaixo que vieram
}
// meta.json
interface Meta { updated_at: string; leagues: Record<string, { games: number; scanned_until: string | null; error: string | null }> }
```

Chaves de `st` (de `boxscore.teams[].statistics[].name`; valor `"a-b"` → número antes do hífen):
- Futebol: `wonCorners`, `yellowCards`, `redCards`, `totalShots`, `shotsOnTarget`, `foulsCommitted`, `offsides`.
- NBA: `totalRebounds`, `assists`, `threePointFieldGoalsMade` (de `threePointFieldGoalsMade-threePointFieldGoalsAttempted`).
- NFL: `totalYards`, `turnovers`, `sacksTaken` (de `sacksYardsLost`, primeiro número = sacks sofridos).

## Estatísticas dos rankings (`src/rankings/metrics.ts`)

| id | Rótulo | Esporte | Valor por lado | Períodos |
|---|---|---|---|---|
| goals | Gols | futebol | placar / `hp`,`ap` | jogo, 1T, 2T |
| corners | Escanteios | futebol | `wonCorners` | jogo |
| cards | Cartões | futebol | `yellowCards`+`redCards` (só se os dois vierem) | jogo |
| shots | Chutes | futebol | `totalShots` | jogo |
| shotsOnTarget | Chutes no gol | futebol | `shotsOnTarget` | jogo |
| fouls | Faltas | futebol | `foulsCommitted` | jogo |
| offsides | Impedimentos | futebol | `offsides` | jogo |
| btts | Ambas marcam | futebol | sim/não | jogo, 1T, 2T |
| result | Resultado | futebol, NBA, NFL | V/E/D | jogo, 1T, 2T |
| points | Pontos | NBA, NFL | placar / quartos | jogo, 1T, 2T, Q1–Q4 |
| rebounds | Rebotes | NBA | `totalRebounds` | jogo |
| assists | Assistências | NBA | `assists` | jogo |
| threes | Cestas de 3 | NBA | `threePointFieldGoalsMade` | jogo |
| yards | Jardas totais | NFL | `totalYards` | jogo |
| turnovers | Turnovers | NFL | `turnovers` | jogo |
| sacks | Sacks | NFL | feitos = `sacksTaken` do adversário; sofridos = `sacksTaken` próprio | jogo |

Visões das estatísticas de contagem:
- **Total**: os dois times somados.
- **Feitos**: só o time.
- **Sofridos**: só o adversário.

Medidas:
- **Média**.
- **Mais de X** e **Menos de X**: % de jogos acima ou abaixo da linha, com a linha ajustável em passos de 0,5. Linhas padrão: goals 2,5 · corners 9,5 · cards 4,5 · shots 24,5 · shotsOnTarget 8,5 · fouls 22,5 · offsides 3,5 · points NBA 225,5 / NFL 44,5 · rebounds 89,5 · assists 50,5 · threes 25,5 · yards 650,5 · turnovers 2,5 · sacks 4,5. Por período, a linha padrão é ⌊padrão ÷ nº de períodos⌋ + 0,5. Exemplos: gols 1T → 1,5; pontos NBA Q1 → 56,5.

Estatísticas especiais:
- **btts** só tem o %.
- **result** mostra três colunas:
  - Ligas: % vitória do mandante, % empate, % vitória do visitante.
  - Times: % V, % E, % D.

## Review Focus

1. **Estatística ausente num jogo** (a ESPN não mandou escanteios): o jogo sai da amostra daquela estatística e não conta como 0, e o nº de jogos mostrado reflete isso. → `missing stat is excluded, not zero` (Task 4).
2. **Execução interrompida ou limite de buscas atingido**: a próxima execução continua de onde parou, sem duplicar nem pular jogos. → `update resumes after cap without duplicates` (Task 2).
3. **Jogo que termina depois da varredura** (ainda ao vivo na hora do robô): é pego na execução seguinte. → `update rescans last 3 days` (Task 2).
4. **Adiado, cancelado ou abandonado**: nunca vira ficha. → `update skips non-final games` (Task 2).
5. **Time em várias competições** (La Liga + Champions) com "Todas": os jogos dele se somam numa linha só. Com uma liga escolhida, contam só os jogos dela. → `all soccer merges a team across leagues` (Task 4).
6. **Robô parado**: dados com mais de 36 h mostram aviso. → `stale data warning after 36h` (Task 4).

---

### Task 1: Ficha do jogo

**Files:**
- Create: `frontend/src/history/types.ts` (tipos `LeagueFile`, `GameRecord`, `Meta`, acima), `frontend/src/history/record.ts`
- Test: `frontend/src/history/record.test.ts`

**Interfaces:**
- Produces:
  - `toRecord(game: Game, summary: unknown): { record: GameRecord; teams: LeagueFile['teams'] } | null`.
  - Devolve `null` quando:
    - `game.status !== 'final'`;
    - é NBA/NFL com `header.season.type === 1`;
    - o placar não é número.
  - `season` vem de `header.season.year`. `hp`/`ap` vêm de `header.competitions[0].competitors[].linescores[].displayValue` (números). `st` usa só as chaves da tabela "Chaves de st" que vieram com valor numérico.

- [ ] **Step 1: Testes que falham:**
  - `soccer record`: PL 401879244 → `hs 2, as 0, hp [2,0], ap [0,0], season 2026`, `st.h.wonCorners 7`, `st.a.wonCorners 3`, `st.h.yellowCards 4`; não tem chaves fora da lista.
  - `nba record`: `hp` com 4 números que somam `hs`; `st.a.threePointFieldGoalsMade` = número antes do hífen do fixture.
  - `nfl record`: `st` tem `totalYards`, `turnovers`, `sacksTaken` (Chargers `2` de `"2-2"`).
  - `preseason excluded`: NBA com `header.season.type = 1` → `null`.
  - `not final excluded`: `sum_PL_scheduled` com status `scheduled` → `null`.
  - `missing stat key absent`: remove `wonCorners` de um lado → a chave não existe em `st.h` (nada de 0).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: ficha compacta de jogo para o histórico`.

### Task 2: Atualizador incremental

**Files:**
- Create: `frontend/src/history/update.ts`, `frontend/scripts/update-data.ts`
- Modify: `frontend/package.json` (devDependency `vite-node` fixada; script `"update-data": "vite-node scripts/update-data.ts"`)
- Test: `frontend/src/history/update.test.ts`

**Interfaces:**
- Consumes: Task 1 (`toRecord`); `parseScoreboard`, `LEAGUES`, `fetchJson`, `ESPN_SITE`/`ESPN_STANDINGS`, `parseStandings`.
- Produces:
  ```ts
  updateLeague(file: LeagueFile | null, leagueKey: string, opts: {
    fetch: Fetcher; today: string /* YYYY-MM-DD Brasília */; start?: string /* padrão '2025-07-01' */
    maxSummaries?: number /* padrão 3000 */; now?: Date; log?: (msg: string) => void
  }): Promise<{ file: LeagueFile; done: boolean; added: number }>
  ```
  - Varre os dias ESPN de `max(start, scanned_until - 3 dias)` até `today - 1`, um scoreboard por dia, em ordem.
  - Para cada jogo `final` ainda não gravado, busca o `summary` e grava a ficha, até `maxSummaries` buscas.
  - `scanned_until` avança só até o último dia **inteiramente** processado. Ao bater o limite, para e devolve `done: false`.
  - NBA/NFL: busca a classificação uma vez e descarta jogos com time fora dela.
  - Erro num `summary` isolado: o jogo fica para a próxima execução e `scanned_until` não passa daquele dia.
  - Pausa de 150 ms entre requisições (injetável: `opts.sleep`, padrão real).
  - Script `scripts/update-data.ts <dir>`:
    - lê `<dir>/games-*.json` e `meta.json` existentes;
    - roda `updateLeague` nas 7 ligas em sequência;
    - um erro numa liga vai para `meta.leagues[k].error` e as outras continuam;
    - grava os arquivos JSON compactos e imprime um resumo;
    - sai com código 0 mesmo com erro numa liga, e 1 só se todas falharem.

- [ ] **Step 1: Testes que falham** (fetch falso que serve scoreboards e summaries montados a partir das fixtures, com ids e datas controlados; `sleep` sem espera):
  - `update builds file from scratch`: 2 dias com 1 jogo final cada → 2 fichas ordenadas por data, `teams` com os 4 times, `scanned_until` = último dia.
  - `update skips non-final games`: adiado, cancelado, agendado e ao vivo no scoreboard → nenhum `summary` buscado para eles e nenhuma ficha.
  - `update resumes after cap without duplicates`: `maxSummaries: 1` com 3 jogos em 3 dias:
    - 1ª chamada → 1 ficha, `done: false`;
    - 2ª e 3ª chamadas → 3 fichas no total, ids únicos, `done: true`.
  - `update rescans last 3 days`: arquivo com `scanned_until = D`; um jogo do dia D-1 que antes estava `live` agora é `final` → é gravado.
  - `summary error leaves day for next run`: o summary do dia D2 lança erro → `scanned_until` fica em D1, e a próxima chamada (sem erro) grava o jogo.
  - `nba drops teams outside standings`: jogo com um time fora da classificação (All-Star) → descartado.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `update.ts` e o script.
- [ ] **Step 4:** `npm test` → PASS. **Rodada real curta:** `npm run update-data -- <scratchpad>/data` com `UPDATE_START=2026-11-01` e `UPDATE_MAX=40` → arquivos criados, fichas conferidas contra um jogo conhecido (PL 08/11 Brighton 2×0 Brentford).
- [ ] **Step 5:** Commit `feat: atualizador incremental do histórico`.

### Task 3: Robô no GitHub Actions

**Files:**
- Modify: `.github/workflows/pages.yml`

- [ ] **Step 1:** Workflow:
  - Gatilhos: `push` na `main`, `schedule: cron '0 12 * * *'` (09:00 de Brasília) e `workflow_dispatch`.
  - Permissões: `contents: write`, `pages: write`, `id-token: write`.
  - Passos:
    1. Checkout da `main`.
    2. Checkout do ramo `data` em `data-store/` (se o ramo não existir, cria uma pasta vazia).
    3. `npm ci`, `npm test`.
    4. **Só em schedule/dispatch:** `npm run update-data -- ../data-store` (timeout do job: 5 h).
    5. **Só em schedule/dispatch:** commit e push do `data-store` no ramo `data` (órfão na primeira vez), com o autor `github-actions[bot]` e a mensagem `dados: <data>`.
    6. Copiar `data-store/*.json` para `frontend/public/data/`, `npm run build`, upload e deploy.
  - Se a carga inicial não terminar numa execução (`done: false` em alguma liga), o próximo disparo continua. Na primeira vez, disparar manualmente até completar.
- [ ] **Step 2:** **Confirmar com o usuário antes do primeiro push deste workflow** (ele cria o ramo `data` e começa a rodar todo dia). Então: push, `gh workflow run "Publicar painel"`, `gh run watch`. Repetir enquanto o log disser que alguma liga não terminou.
- [ ] **Step 3: Verificação:**
  - `https://jcabbade.github.io/painel-esportivo/data/meta.json` responde, com as 7 ligas.
  - Número de jogos coerente: PL 2025-26 tem 380 jogos.
  - Conferir 3 fichas contra os placares reais.
- [ ] **Step 4:** Commit `ci: robô diário de histórico`. O workflow vai junto no push do Step 2.

### Task 4: Cálculo dos rankings

**Files:**
- Create: `frontend/src/rankings/metrics.ts`, `frontend/src/rankings/compute.ts`
- Test: `frontend/src/rankings/compute.test.ts` (fichas montadas à mão)

**Interfaces:**
- Consumes: tipos da Task 1.
- Produces:
  ```ts
  type PeriodId = 'full' | 'h1' | 'h2' | 'q1' | 'q2' | 'q3' | 'q4'
  type View = 'total' | 'for' | 'against'
  type Measure = { kind: 'avg' } | { kind: 'over' | 'under'; line: number }
  METRICS: Metric[]  // tabela acima; Metric = { id, label, sports: Sport[], periods: PeriodId[], kind: 'count'|'btts'|'result', defaultLine: Partial<Record<Sport, number>> }
  defaultLine(metric, sport, period): number
  sideValue(g: GameRecord, side: 'h'|'a', metric, period, sport): number | null   // null = sem dado
  leagueRanking(files: LeagueFile[], metricId, period, measure, window: 'season'|'30d', now: Date): LeagueRow[]
  // LeagueRow = { league, games, avg: number|null, pct: number|null, result?: { home: number; draw: number; away: number } }
  teamRanking(files: LeagueFile[], opts: { metricId; period; view: View; measure: Measure; last: 5|10|15|20|'season'; venue: 'all'|'home'|'away'; order: 'desc'|'asc' }): TeamRow[]
  // TeamRow = { teamId, name, logo, games, avg, pct, hits, result?: {w,d,l}, form: ('V'|'E'|'D')[] }  (form: últimos 5 do mesmo filtro, mais recente primeiro)
  dataAge(updatedAt: string, now: Date): { label: string /* 'Dados até 19/11 09:00' */; stale: boolean /* > 36 h */ }
  ```

- [ ] **Step 1: Testes que falham:**
  - `league avg and over`: 3 jogos com total de gols 1, 3 e 4 → `avg 2.67` (2 casas), `over 2.5 → pct 66.7`, `games 3`.
  - `periods use halves and quarters`: gols 1T = `hp[0]+ap[0]`. Pontos 1T NBA = Q1+Q2. Pontos 2T sem a prorrogação (`hp` com 5 itens).
  - `missing stat is excluded, not zero`: 3 jogos, um sem `wonCorners` num dos lados → `games 2`.
  - `cards sums yellow and red only when both present`.
  - `sacks for = opponent sacksTaken`.
  - `window 30d and season`: fichas de duas temporadas e datas variadas → filtra certo.
  - `team last N crosses seasons`: `last: 5` pega os 5 mais recentes mesmo de temporadas diferentes. `'season'` pega só a maior temporada.
  - `team venue and view`: `home` conta só jogos em casa. `for`/`against`/`total` corretos.
  - `team form and result`: forma `['V','E','D',…]` do mais recente para o mais antigo. Na NFL, empate vira `'E'`.
  - `all soccer merges a team across leagues`: o mesmo `teamId` em ESP e UCL → uma linha com os jogos somados. Só ESP → só os jogos da ESP.
  - `btts and result in league ranking`.
  - `order and ties`: desempate por nº de jogos (desc) e depois por nome.
  - `stale data warning after 36h`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: cálculo dos rankings de ligas e times`.

### Task 5: Telas Ligas e Times

**Files:**
- Create: `frontend/src/history/loadHistory.ts`, `frontend/src/components/RankingFilters.tsx`, `frontend/src/components/LeaguesRanking.tsx`, `frontend/src/components/TeamsRanking.tsx`
- Modify: `frontend/src/App.tsx` (navegação **Jogos · Tabela · Notícias · Ligas · Times** — "Tabela" e "Notícias" já vêm do Plano 2b; no celular a barra rola na horizontal), `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 4; `public/data/*.json`.
- Produces:
  - `loadHistory(leagueKey): Promise<LeagueFile>`: busca `${import.meta.env.BASE_URL}data/games-<K>.json` e guarda em memória enquanto a aba estiver aberta.
  - `loadMeta(): Promise<Meta>`.
  - Erro de carga → mensagem + "Tentar de novo".
  - Sem arquivo ainda (404) → "O histórico ainda está sendo montado."

- [ ] **Step 1:**
  - **Ligas:**
    - Esporte (Futebol | NBA | NFL), estatística (lista do esporte), período (opções do esporte; as indisponíveis ficam desabilitadas), medida (Média | Mais de | Menos de) com linha ajustável (− / +, passo 0,5), recorte (Temporada | 30 dias).
    - Tabela: liga · jogos · média · % (ou as 3 colunas do resultado).
    - O cabeçalho mostra `dataAge`. Se `stale`, aviso amarelo "Dados de DD/MM — o robô diário pode estar parado."
  - **Times:**
    - Liga (Futebol: todas | PL | UCL | ESP | ITA | ALE | NBA | NFL), estatística, período, visão (Total | Feitos | Sofridos; não aparece em ambas marcam e resultado), medida e linha, últimos (5 | 10 | 15 | 20 | Temporada), mando (Geral | Casa | Fora), ordem (↓ | ↑).
    - Tabela: # · time (escudo) · J · média ou % · acertos `7/10` · forma (5 bolinhas V/E/D).
    - Favoritos destacados.
  - **Os dois:**
    - Filtros lembrados no aparelho (`painel.rank_ligas`, `painel.rank_times`).
    - Em 390 px, os filtros quebram em linhas e a tabela rola dentro da seção.
- [ ] **Step 2:** `npm test` e `npm run build` → sem erros.
- [ ] **Step 3: Verificação manual** com os dados reais:
  - Copiar os JSON publicados para `public/data/` localmente, só para o teste, sem commit; `public/data/` entra no `.gitignore`.
  - Rodar `npm run dev`:
    - gols da PL "Mais de 2,5" → conferir 1 liga na mão com as fichas;
    - um time na mão: últimos 5 em casa;
    - NBA pontos Q1;
    - NFL sacks;
    - largura 390 px.
- [ ] **Step 4:** Commit `feat: telas de rankings de ligas e times`. Depois da revisão final: merge na `main`, push (publica), `gh run watch` verde e verificação rápida no site publicado.
