# Painel Esportivo v1 — Plano 2: página do jogo e classificação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar num jogo, o painel mostra os detalhes reais da ESPN (lances, estatísticas, escalações, placar por período, box score, confronto direto, agregado do mata-mata, classificação), e há uma tela de Classificação por liga.

**Architecture:** Mesma linha do Plano 1b: tudo no navegador. `espn/summary.ts` interpreta `.../summary?event=ID` num tipo `GameDetail` próprio (seções vazias = ocultas); `espn/standings.ts` interpreta `.../standings` em tabelas. Os componentes React só desenham o que o parser entregou. A tela ganha a navegação "Jogos | Classificação".

**Tech Stack:** React 19 + TypeScript + Vite + Vitest (existentes). Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-11-19-painel-esportivo-design.md` (§2 itens 2 e 3; §8)

## Global Constraints

- Fonte: só ESPN, chamada direto do navegador (`ESPN_SITE`/`ESPN_STANDINGS` de `espn/client.ts`, `fetchJson`). Nada estimado nem calculado além de reorganizar o que a ESPN mandou.
- "O que a ESPN não trouxer para um jogo fica oculto (não mostrar seção vazia nem estimar)."
- Textos da tela em português; fuso `America/Sao_Paulo`.
- `Game`/`GamesResponse` de `types.ts` não mudam.
- Fixtures reais em `backend/tests/fixtures/` (já baixadas e enxugadas): `sum_PL_401879244.json` (Brighton 2×0 Brentford, encerrado), `sum_UCL_401862582.json` (Barcelona × Newcastle, 2º jogo, agregado 8–3), `sum_NBA_401910002.json` (TOR 111 × GSW 102... ver header), `sum_NFL_401873065.json` (LAC 20 × BAL 23), `sum_PL_scheduled.json` (Hull, agendado), `standings_PL/UCL/NBA/NFL.json` (conferência), `standings_NBA_div.json`, `standings_NFL_div.json` (`?level=3`).
- Commits com o e-mail noreply já configurado no repositório; push na `main` publica o site.

## O que a ESPN entrega (recon de 19/11)

- `header.competitions[0]`: `competitors[].linescores[].displayValue` (por período, NBA/NFL), `competitors[].aggregateScore`, `leg.displayValue` ("2nd Leg"), `series[0].title` ("Round of 16").
- `keyEvents[]` (futebol): `type.type` ∈ `goal`, `penalty---scored`, `yellow-card`, `red-card`, `substitution`, `halftime`, `kickoff`, `start-delay`… ; `clock.displayValue` ("45'+5'"); `team.id`; `participants[].athlete.displayName` (substituição: [0] entra, [1] sai); `scoringPlay`.
- `boxscore.teams[].statistics[]` `{name, label, displayValue}`; **antes do jogo traz estatísticas da temporada** (`totalGoals`…), não do jogo.
- `boxscore.players[]` (NBA/NFL): `statistics[]` = grupos `{name, labels[], athletes[{athlete.displayName, starter, stats[], didNotPlay, reason}]}`. NBA: 1 grupo sem nome. NFL: passing, rushing, receiving, fumbles, defensive, interceptions, kickReturns, puntReturns, kicking, punting.
- `rosters[]` (futebol): `homeAway`, `formation`, `roster[{starter, jersey, athlete.displayName, position.abbreviation, subbedIn, subbedOut}]`; vazio antes da escalação sair.
- `seasonseries[0]` (futebol "Last 5 Matchups" / NBA "Regular Season Series"): `summary`, `events[{date, statusType.state, competitors[{homeAway, team.displayName/abbreviation, score}]}]`. NFL: `null`.
- Standings: `children[]` = conferências (ou fase da UCL); com `?level=3`, `children[].children[]` = divisões. Entradas: `team{id,displayName,logos}`, `stats[{name, displayValue}]`, `note{color, description}`.

## Decisões deste plano (minhas, para conferir)

- **Placar do jogo de ida:** a ESPN entrega o agregado e qual jogo é ("2º jogo · Oitavas · agregado 8–3"). Mostro isso, sem subtrair placares para "deduzir" a ida.
- **Estatísticas do jogo** só com status `live` ou `final` (antes do jogo a ESPN manda números da temporada, que enganariam). Lista curta e traduzida por esporte (abaixo); estatística fora da lista não aparece.
- **H2H** = `seasonseries` da ESPN (últimos 5 no futebol, série da temporada na NBA). Na NFL a ESPN não manda: seção oculta.
- **Classificação dentro do jogo:** tabela da liga (futebol) ou da conferência dos dois times (NBA/NFL), com os dois times destacados.
- **Tela Classificação:** escolha da liga em botões; NBA/NFL com alternância Conferência / Divisão.
- Detalhe de jogo ao vivo atualiza a cada 30 s; se a atualização falhar, mantém o último dado e mostra aviso discreto.

Rótulos das estatísticas (`name` ESPN → texto):
- Futebol: `possessionPct` Posse de bola (%), `totalShots` Finalizações, `shotsOnTarget` No alvo, `wonCorners` Escanteios, `foulsCommitted` Faltas, `yellowCards` Cartões amarelos, `redCards` Cartões vermelhos, `offsides` Impedimentos, `saves` Defesas, `totalPasses` Passes, `accuratePasses` Passes certos, `totalTackles` Desarmes, `interceptions` Interceptações.
- NBA: `fieldGoalsMade-fieldGoalsAttempted` Arremessos, `threePointFieldGoalsMade-threePointFieldGoalsAttempted` Bolas de 3, `freeThrowsMade-freeThrowsAttempted` Lances livres, `totalRebounds` Rebotes, `offensiveRebounds` Rebotes ofensivos, `assists` Assistências, `steals` Roubos, `blocks` Tocos, `turnovers` Erros (turnovers), `fouls` Faltas, `pointsInPaint` Pontos no garrafão, `fastBreakPoints` Contra-ataque, `largestLead` Maior vantagem.
- NFL: `firstDowns` First downs, `totalYards` Jardas totais, `netPassingYards` Jardas de passe, `rushingYards` Jardas corridas, `thirdDownEff` 3ª descida, `fourthDownEff` 4ª descida, `redZoneAttempts` Red zone, `turnovers` Turnovers, `totalPenaltiesYards` Faltas (jardas), `sacksYardsLost` Sacks, `possessionTime` Posse de bola.

## Review Focus

1. **Jogo agendado** (sem lances, escalação vazia, estatísticas de temporada no boxscore): só cabeçalho, H2H e classificação aparecem. → `scheduled game hides game sections` (Task 1).
2. **Jogador que não jogou** (NBA `didNotPlay`, `stats: []`): aparece como "Não jogou – motivo", sem quebrar a tabela. → `nba box marks did-not-play` (Task 2).
3. **Troca rápida de jogo selecionado:** resposta atrasada do jogo anterior não pode sobrescrever o atual. → `loadDetail ignores stale response` (Task 4).
4. **Falha ao buscar o detalhe** (ESPN fora/rede do celular): mensagem com "Tentar de novo"; ao vivo, mantém o último dado. → `detail keeps last data on refresh error` (Task 4).
5. **Lance de tipo desconhecido** ou sem atleta (atrasos, VAR): ignorado sem derrubar a lista de lances. → `soccer events skip noise and unknown types` (Task 1).

---

### Task 1: Parser do detalhe — futebol

**Files:**
- Create: `frontend/src/espn/summary.ts`, `frontend/src/espn/detailTypes.ts`
- Modify: `frontend/src/espn/testFixtures.ts` (se precisar de helper para os novos nomes)
- Test: `frontend/src/espn/summary.test.ts`

**Interfaces:**
- Produces (`detailTypes.ts`):
  ```ts
  interface StatRow { label: string; home: string; away: string }
  interface SoccerEvent { minute: string; kind: 'goal'|'penalty_goal'|'own_goal'|'penalty_miss'|'yellow'|'red'|'sub'|'halftime'; side: 'home'|'away'|null; player: string|null; playerOut: string|null }
  interface LineupPlayer { name: string; number: string|null; position: string|null; subbedIn: boolean; subbedOut: boolean }
  interface Lineup { formation: string|null; starters: LineupPlayer[]; bench: LineupPlayer[] }
  interface H2HGame { date: string; home: string; away: string; homeScore: number|null; awayScore: number|null }
  interface H2H { summary: string|null; games: H2HGame[] }
  interface Aggregate { leg: string|null; round: string|null; home: number; away: number }
  interface BoxGroup { title: string; labels: string[]; players: { name: string; starter: boolean; stats: string[]; dnp: string|null }[] }
  interface GameDetail {
    stats: StatRow[]; events: SoccerEvent[]; lineups: { home: Lineup; away: Lineup } | null
    periods: { labels: string[]; home: string[]; away: string[] } | null
    box: { home: BoxGroup[]; away: BoxGroup[] } | null
    h2h: H2H | null; aggregate: Aggregate | null; attendance: number | null
  }
  ```
- Produces (`summary.ts`): `parseSummary(game: Game, payload: unknown): GameDetail` — usa `game.home.team_id`/`game.away.team_id` para saber o lado; `game.status` decide se `stats` é preenchido.

- [ ] **Step 1: Testes que falham** (`summary.test.ts`, fixtures via `readFixture`; `Game` montado com `parseScoreboard` do scoreboard correspondente ou à mão com os ids certos):
  - `soccer final has translated stats`: PL 401879244 → `stats` contém `{label:'Escanteios', home:'7', away:<valor do fixture>}` e `{label:'Posse de bola (%)', home:'75.3', …}`; nenhum rótulo fora da lista do plano.
  - `soccer events in order`: primeiro evento `{minute:"5'", kind:'yellow', side:'away', player:'Kristoffer Ajer'}`; contém `{minute:"15'", kind:'goal', side:'home', player:'Diego Gómez'}`, `{minute:"23'", kind:'red', side:'away'}`, `{minute:"42'", kind:'penalty_goal', side:'home'}`, `{kind:'halftime'}`; substituição de 45' do Brentford → `player:'Yehor Yarmoliuk', playerOut:'Dango Ouattara'`.
  - `soccer events skip noise and unknown types`: nenhum evento com `kickoff/start-delay/end-delay/start-2nd-half/end-regular-time`; um `keyEvents` extra com `type.type:'var-check'` e outro sem `participants` de tipo `goal` → o primeiro some, o segundo vira gol com `player:null`; os demais continuam.
  - `soccer lineups`: casa `formation:'4-2-3-1'`, 11 titulares, primeiro `{name:'Bart Verbruggen', number:'1', position:'G'}`; reservas = o resto.
  - `soccer h2h`: `h2h.summary === 'BHA leads series 2-1-2'`, 5 jogos, cada um com nomes e placares inteiros.
  - `ucl second leg aggregate`: UCL 401862582 → `aggregate = {leg:'2º jogo', round:'Round of 16', home:8, away:3}` (traduz `"1st Leg"/"2nd Leg"` → `"1º jogo"/"2º jogo"`; outro texto passa como veio). PL → `aggregate === null`.
  - `scheduled game hides game sections`: `sum_PL_scheduled` com `game.status='scheduled'` → `stats=[]`, `events=[]`, `lineups=null`, `periods=null`, `box=null`, `h2h` preenchido.
- [ ] **Step 2:** `npm test` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `parseSummary` (parte futebol + campos comuns: `h2h`, `aggregate`, `attendance` de `gameInfo.attendance`). Tipos de lance: `goal`→goal; `penalty---scored`→penalty_goal; `own-goal`→own_goal; `penalty---missed`/`penalty---saved`→penalty_miss; `yellow-card`→yellow; `red-card` e `yellow-red-card`→red; `substitution`→sub; `halftime`→halftime; demais ignorados. `lineups` só quando os dois rosters têm jogadores. Cada lance/jogador malformado é pulado com `console.warn` (como `parseScoreboard`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: parser do detalhe do jogo (futebol)`.

### Task 2: Parser do detalhe — NBA e NFL

**Files:**
- Modify: `frontend/src/espn/summary.ts`
- Test: `frontend/src/espn/summary.test.ts`

**Interfaces:**
- Consumes: Task 1 (`GameDetail`, `parseSummary`).
- Produces: `periods` e `box` preenchidos para basquete/futebol americano.

- [ ] **Step 1: Testes que falham:**
  - `nba periods`: NBA 401910002 → `periods.labels = ['1º','2º','3º','4º']`, `home = ['29','21','33','19']`, `away = ['23','31','26','31']`. Prorrogação: 5º período em diante vira `'OT'`, `'2OT'`… (teste com payload montado de 5 linescores → labels termina em `'OT'`).
  - `nba stats`: contém `{label:'Arremessos', home:'41-78', …}` e `{label:'Rebotes', home:'44', …}`.
  - `nba box marks did-not-play`: `box.home`/`box.away` com 1 grupo, `labels[0]==='MIN'`; titular `OG Anunoby` com `stats[1]==='16'`; jogador com `didNotPlay` → `stats: []`, `dnp: 'COACH\'S DECISION'`.
  - `nfl box groups`: NFL 401873065 → grupos na ordem passing, rushing, receiving, defensive, interceptions, kicking, punting, kickReturns, puntReturns, fumbles, com títulos `Passe, Corrida, Recepção, Defesa, Interceptações, Chutes, Punts, Retorno de kickoff, Retorno de punt, Fumbles`; passe do LAC = `Justin Herbert` `['12/18','129',…]`.
  - `nfl has no h2h`: `h2h === null` (`seasonseries` null).
  - `nfl stats`: contém `{label:'Jardas totais', …}` e `{label:'Posse de bola', home|away:'30:02'}`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar. Lados dos `boxscore.players[]` por `team.id`. Grupos ausentes no payload não aparecem.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: parser do detalhe para NBA e NFL`.

### Task 3: Classificação — dados

**Files:**
- Create: `frontend/src/espn/standings.ts`
- Test: `frontend/src/espn/standings.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface StandingRow { teamId: string; name: string; logo: string|null; rank: number; cells: Record<string,string>; zone: { color: string; label: string } | null }
  interface StandingGroup { name: string; rows: StandingRow[] }
  type StandingsLevel = 'conference' | 'division'
  parseStandingsTable(sport: Sport, payload: unknown): StandingGroup[]
  loadStandings(leagueKey: string, level?: StandingsLevel, opts?: { fetch?: Fetcher; now?: Date }): Promise<StandingGroup[]>
  STANDING_COLUMNS: Record<Sport, { key: string; label: string }[]>
  ```
  Colunas — futebol: `gamesPlayed` J, `wins` V, `ties` E, `losses` D, `pointsFor` GP, `pointsAgainst` GC, `pointDifferential` SG, `points` Pts. NBA: `wins` V, `losses` D, `winPercent` %, `gamesBehind` GB, `streak` Seq. NFL: `wins` V, `losses` D, `ties` E, `winPercent` %, `streak` Seq.
- `loadStandings` usa `?level=3` para `division`; guarda em memória por 10 min por `(liga, nível)`; também chama `setCachedRanks` com os ranks (mantém o rank da lista de jogos fresco).

- [ ] **Step 1: Testes que falham:**
  - `soccer table`: PL → 1 grupo, 20 linhas, ordenadas por `rank` 1..20; Arsenal `cells.points==='27'`, `cells.pointDifferential==='+10'`; `zone = {color:'#81D6AC', label:'Champions League'}`; linha sem `note` → `zone null`.
  - `ucl league phase`: 1 grupo `League Phase`, 36 linhas.
  - `nba conferences`: 2 grupos (`Eastern Conference`, `Western Conference`), 15 linhas cada, ordenadas por `playoffSeed`; `rank` = seed.
  - `nfl divisions`: `standings_NFL_div` → 8 grupos (`AFC East`…), 4 linhas cada.
  - `loadStandings caches 10 min`: fetch falso contado; 2ª chamada em 5 min não busca; em 11 min busca.
  - `loadStandings division uses level=3`: URL contém `standings?level=3`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar. Ordenação: `rank` (futebol) ou `playoffSeed` (NBA/NFL); empate ou ausência → ordem do payload.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: classificação das ligas a partir da ESPN`.

### Task 4: Tela do jogo

**Files:**
- Create: `frontend/src/espn/loadDetail.ts`, `frontend/src/components/detail/` (`Events.tsx`, `Stats.tsx`, `Lineups.tsx`, `Periods.tsx`, `BoxScore.tsx`, `H2H.tsx`, `MiniStandings.tsx`), `frontend/src/components/StandingsTable.tsx`
- Modify: `frontend/src/components/DetailPane.tsx`, `frontend/src/styles.css`
- Test: `frontend/src/espn/loadDetail.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`parseSummary`, `GameDetail`, `loadStandings`, `StandingGroup`).
- Produces:
  - `loadDetail(game: Game, opts?: { fetch?: Fetcher }): Promise<GameDetail>` (URL `${ESPN_SITE}/${league.path}/summary?event=${game.id}`).
  - `createDetailLoader(fetcher?)` → `{ load(game): Promise<GameDetail | null> }`: devolve `null` quando outra chamada mais nova já começou (resposta velha descartada).
  - `<StandingsTable groups sport highlight?: Set<string> compact?: boolean />` (usado também na Task 5).

- [ ] **Step 1: Testes que falham** (`loadDetail.test.ts`):
  - `loadDetail builds summary url`: fetch falso registra a URL → `.../soccer/eng.1/summary?event=401879244`; resultado = `parseSummary` do fixture.
  - `loadDetail ignores stale response`: loader; chamada A (lenta, resolve depois) e B (rápida) → B devolve detalhe, A devolve `null`.
  - `detail keeps last data on refresh error`: função pura `nextDetailState(prev: {detail, error}, result: {ok:true, detail}|{ok:false, message})` → erro com `prev.detail` existente mantém o detalhe e preenche `error`; sucesso limpa `error`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `loadDetail.ts` e a tela. `DetailPane` busca ao abrir o jogo e a cada 30 s se `game.status === 'live'`. Ordem das seções: cabeçalho (com agregado e público quando houver) → Placar por período → Lances → Estatísticas (barras lado a lado: casa à esquerda) → Escalações → Box score (abas por time) → Confronto direto → Classificação (`MiniStandings`: grupo que contém algum dos dois times, `compact`, times destacados). Seção sem dado não é desenhada. Carregando: "Carregando detalhes…". Erro sem dado: "Não foi possível carregar os detalhes (motivo)." + botão "Tentar de novo". Remover o texto "chegam na próxima etapa".
- [ ] **Step 4:** `npm test` e `npm run build` → sem erros.
- [ ] **Step 5: Verificação manual** com `npm run dev` no Chrome: jogo de futebol encerrado (lances, estatísticas, escalações, H2H, classificação); jogo NBA (períodos, box score, DNP); jogo NFL (grupos do box score, sem H2H); jogo agendado (só cabeçalho/H2H/classificação); largura 390 px (detalhe em tela cheia, "‹ Voltar" funciona, tabelas com rolagem horizontal dentro da seção, não da página).
- [ ] **Step 6:** Commit `feat: página do jogo com lances, estatísticas, escalações e box score`.

### Task 5: Tela Classificação e publicação

**Files:**
- Create: `frontend/src/components/StandingsPage.tsx`
- Modify: `frontend/src/App.tsx` (navegação Jogos | Classificação, lembrada em `painel.view`), `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 3 (`loadStandings`, `STANDING_COLUMNS`), Task 4 (`StandingsTable`).

- [ ] **Step 1:** `StandingsPage`: botões das 7 ligas (lembrada em `painel.liga_classificacao`, padrão PL); NBA/NFL mostram "Conferência | Divisão"; favoritos destacados (via `getFavorites`); legenda das zonas (cor + descrição) abaixo da tabela de futebol; "Carregando…"/erro com "Tentar de novo"; rodapé "Dados ESPN". No cabeçalho, "Jogos | Classificação" ao lado da marca; a barra de dias só aparece em Jogos.
- [ ] **Step 2:** `npm test` e `npm run build` → sem erros.
- [ ] **Step 3: Verificação manual** com `npm run dev`: as 7 ligas carregam; NBA/NFL alternam conferência/divisão; recarregar mantém a aba e a liga; 390 px sem rolagem horizontal da página.
- [ ] **Step 4:** Commit `feat: tela de classificação` e `git push` (publica). `gh run watch` verde; abrir `https://jcabbade.github.io/painel-esportivo/` e repetir a verificação rápida (um jogo de cada esporte e a Classificação), console sem erros.
