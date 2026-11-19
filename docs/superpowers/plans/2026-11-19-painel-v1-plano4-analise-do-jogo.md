# Painel Esportivo v1 — Plano 4: análise do jogo em abas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O detalhe do jogo ganha as abas Pré-jogo, H2H, Escalação, Jogadores e Escanteios, calculadas a partir do histórico real (ramo `data`), que passa a guardar escanteios por faixa de tempo e os números de cada jogador.

**Architecture:**
- `src/history/` ganha dois extratores puros a partir do `summary`: escanteios por faixa (`cornerBuckets`) e números por jogador (`toPlayers`).
- O atualizador grava `games-<L>.json` (versão 2, com `cb`) e `players-<L>.json`.
- `src/analysis/` reúne as funções puras de cada aba.
- `components/analysis/` desenha as abas.

**Tech Stack:** a mesma de sempre (React 19, TypeScript, Vite, Vitest). Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-11-19-painel-esportivo-design.md` §11 (e §3, §5, §9).

## Global Constraints

- Nada estimado:
  - estatística ausente sai da amostra, nunca conta como 0;
  - o `cb` só é gravado quando a contagem da narração bate com o `wonCorners` daquele lado;
  - todas as abas mostram o nº de jogos.
- Faixas de escanteio (10): `0–10`, `10–20`, `20–30`, `30–40`, `40–Int` (1º tempo, inclui acréscimos), `45–55`, `55–65`, `65–75`, `75–85`, `85–Fim`. O minuto é `floor(clock.value / 60)`, e o tempo do jogo vem de `period.number`.
- Jogadores:
  - **Futebol:** as chaves de `roster[].stats` foulsCommitted, foulsSuffered, totalShots, shotsOnTarget, yellowCards, redCards, saves, totalGoals, goalAssists. Só entra quem tem `appearances ≥ 1`.
  - **NBA:** PTS, REB, AST e 3PM (número antes do hífen em `3PT`), de `boxscore.players`. Só entra quem tem `didNotPlay` falso e `stats` não vazio.
  - **NFL:** grupo `passing` YDS → `passYds`, `rushing` YDS → `rushYds`, `receiving` YDS → `recYds` e REC → `rec`.
- Histórico versão 2: arquivo sem `v: 2` é recarregado do zero na próxima execução do robô. É uma carga única, de ~30 min.
- Pré-jogo, H2H e forma usam os arquivos de todas as ligas do esporte do jogo. A aba Jogadores usa só `players-<liga do jogo>.json`.
- Textos em português; no celular, as abas rolam na horizontal.

## Formatos novos

```ts
// GameRecord (games-<L>.json, v: 2): + cb?: { h: number[]; a: number[] }   // 10 faixas
// LeagueFile: + v: 2
// players-<L>.json
interface PlayersFile { league: string; v: 2; games: { id: string; date: string; season: number; p: PlayerLine[] }[] }
interface PlayerLine { id: string; n: string; t: string /* team id */; s: boolean /* titular */; st: Record<string, number> }
```

## Review Focus

1. **A narração não bate com o total oficial** (escanteio sem lance na narração): o jogo não entra na aba Escanteios. → `corner buckets only when commentary matches wonCorners` (Task 1).
2. **Histórico antigo (v1) no ramo `data`:** o robô recarrega sem quebrar e as abas mostram "histórico sendo montado" enquanto isso. → `v1 file triggers full reload` (Task 1).
3. **Jogador que não entrou** (no banco, DNP): não conta como 0 na média dele. → `bench players without appearance are skipped` (Task 1).
4. **Time sem jogos no histórico** (recém-promovido, primeiro jogo da Champions): as abas mostram "sem jogos no histórico" em vez de quebrar. → `analysis handles team without history` (Task 2).
5. **Esquema tático desconhecido ou posição não reconhecida:** o campo ainda distribui os 11 nas linhas do esquema, sem perder jogador. → `formation layout keeps all 11 players` (Task 2).

---

### Task 1: Histórico v2 (escanteios por faixa e jogadores)

**Files:**
- Create: `frontend/src/history/players.ts`
- Modify: `frontend/src/history/types.ts`, `frontend/src/history/record.ts`, `frontend/src/history/update.ts`, `frontend/scripts/update-data.ts`
- Test: `frontend/src/history/record.test.ts`, `frontend/src/history/players.test.ts`, `frontend/src/history/update.test.ts`
- Fixture: `backend/tests/fixtures/sum_PL_401879244_full.json` (já salvo: inclui `rosters[].stats` e os lances de escanteio da narração)

**Interfaces:**
- `cornerBuckets(summary, homeName, awayName): { h: number[]; a: number[] } | null`. O time vem de `play.team.displayName` comparado ao `displayName` do header. Devolve `null` se algum lado não bater com `wonCorners`.
- `toRecord` passa a incluir `cb` (futebol), quando houver.
- `toPlayers(game: Game, summary: unknown): PlayerLine[]`.
- `updateLeague` devolve também `players: PlayersFile`:
  - recebe `playersFile` anterior em `opts.players`;
  - grava `v: 2`;
  - se o `file` vier sem `v === 2`, começa do zero.

- [ ] **Step 1: Testes que falham:**
  - `corner buckets only when commentary matches wonCorners`:
    - fixture `_full` → `cb.h` soma 7 e `cb.a` soma 3; o escanteio de 6' cai na faixa 0 do mandante e o de 13' na faixa 1 do visitante;
    - removendo um lance da narração → `cb` ausente.
  - `players soccer`: o fixture `_full` traz só jogadores com `appearances ≥ 1` (titulares e quem entrou), com `t` = id do time e `st.foulsCommitted` numérico.
  - `bench players without appearance are skipped`: jogador com `appearances: 0` não aparece.
  - `players nba`: com `sum_NBA_401910002`, Kyle Anderson (DNP) não aparece e OG Anunoby tem `st.PTS === 16`.
  - `players nfl`: Justin Herbert tem `st.passYds === 129`.
  - `v1 file triggers full reload`: `updateLeague` com um arquivo sem `v` refaz a varredura desde `start` e grava `v: 2`.
  - `players file accumulates without duplicates`: duas execuções seguidas → cada jogo aparece uma vez em `players.games`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar. O script grava `players-<L>.json` da mesma forma atômica e o workflow já publica `*.json`.
- [ ] **Step 4:** `npm test` → PASS. Rodada real curta: `UPDATE_START=2026-11-01 UPDATE_MAX=30` → `cb` presente na maioria dos jogos de futebol e arquivos `players-*.json` com tamanho medido. Anotar no ledger o tamanho estimado para a temporada inteira.
- [ ] **Step 5:** Commit `feat: histórico v2 com escanteios por faixa e números de jogadores`.

### Task 2: Funções de análise

**Files:**
- Create: `frontend/src/analysis/pregame.ts`, `frontend/src/analysis/h2h.ts`, `frontend/src/analysis/corners.ts`, `frontend/src/analysis/players.ts`, `frontend/src/analysis/formation.ts`
- Test: `frontend/src/analysis/analysis.test.ts`

**Interfaces:**
- `teamGames(files: LeagueFile[], teamId: string, opts: { venue: 'all'|'home'|'away'; last: number }): { g: GameRecord; side: 'h'|'a'; league: string }[]`, com os mais recentes primeiro.
- `compare(files, homeId, awayId, sport, opts: { last: 5|10; venueSplit: boolean }): { metric: string; label: string; home: { for: number|null; against: number|null; n: number }; away: {…} }[]`. Com `venueSplit`, conta só os jogos do mandante em casa e do visitante fora. Usa as métricas de contagem do esporte (de `rankings/metrics`).
- `opportunities(files, teamId, sport, opts: { last: 10; venue }): { label: string; kind: 'over'|'under'; line: number; hits: number; n: number; avg: number }[]`:
  - para cada métrica de contagem (visão "feitos", linha padrão do time = ⌊linha do jogo ÷ 2⌋ + 0,5), testa "mais de" e "menos de" e fica com a melhor;
  - devolve as 5 melhores com `hits/n ≥ 0,7` e `n ≥ 5`, ordenadas por `hits/n`.
- `headToHead(files, aId, bId, filter: 'total'|'aHome'|'bAway'): { games: …; aWins; draws; bWins }`.
- `form(files, teamId, n = 10)`: lista com data, adversário, placar e V/E/D.
- `cornerProfile(files, teamId, opts: { last: 10; venue; view: 'for'|'against'|'total' }): { buckets: { label: string; avg: number; total: number }[]; n: number }`, só com os jogos que têm `cb`.
- `playerRanking(pf: PlayersFile, teamIds: string[], stat: string, opts: { last: 10; onlyIds?: Set<string> }): { id; name; team; avg; n; seq: number[] }[]`. Considera os últimos 10 jogos em que o jogador entrou e ordena por média.
- `formationLayout(formation: string | null, starters: LineupPlayer[]): LineupPlayer[][]`:
  - devolve as linhas do goleiro ao ataque, cada uma da esquerda para a direita;
  - a ordem por profundidade é G < defensores (B, CD, WB, SW) < volantes (DM) < meias (CM, M) < meias ofensivos (AM, W) < atacantes (F, CF, ST);
  - as linhas seguem o tamanho do esquema;
  - esquema inválido → linhas por grupo de posição.
- `LineupPlayer` ganha `position` (já existe).

- [ ] **Step 1: Testes que falham** (fichas montadas à mão, como em `rankings/compute.test.ts`):
  - `compare uses venue split`;
  - `opportunities picks best side and threshold`;
  - `head to head counts and filters`;
  - `corner profile ignores games without cb`;
  - `player ranking uses last 10 appearances`;
  - `formation layout 4-2-3-1 from fixture`: linhas com 1, 4, 2, 3 e 1 jogadores, com Kostoulas sozinho no ataque;
  - `formation layout keeps all 11 players` com esquema `null` e posições desconhecidas;
  - `analysis handles team without history`: tudo vazio, `n: 0`, sem exceção.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: funções de análise do jogo`.

### Task 3: Abas no detalhe do jogo

**Files:**
- Create: `frontend/src/components/analysis/` (`DetailTabs.tsx`, `PregameTab.tsx`, `H2HTab.tsx`, `LineupTab.tsx` (com `Pitch.tsx`), `PlayersTab.tsx`, `CornersTab.tsx`), `frontend/src/history/loadPlayers.ts`
- Modify: `frontend/src/components/DetailPane.tsx`, `frontend/src/styles.css`

- [ ] **Step 1:** Abas:
  - Barra **Jogo · Pré-jogo · H2H · Escalação · Jogadores · Escanteios**. Escalação e Escanteios só no futebol. A aba escolhida fica lembrada (`painel.aba_jogo`); ao trocar de jogo, ela é mantida se existir no novo esporte.
  - **Pré-jogo:**
    - filtros últimos 5 | 10 e "Geral | Mandante em casa e visitante fora";
    - tabela comparativa com feitos e sofridos de cada time, destacando o maior;
    - abaixo, "Oportunidades" em dois cartões (mandante e visitante), com acertos x/n e média.
  - **H2H:**
    - barra "x vitórias · y empates · z vitórias";
    - filtros Total | mandante em casa | visitante fora;
    - lista dos confrontos;
    - dois blocos "Últimos jogos" com bolinhas V/E/D.
  - **Escalação:** campo verde em CSS com os titulares (número e nome) e, abaixo, a lista atual com as reservas. Antes da escalação sair: "Escalação ainda não divulgada".
  - **Jogadores:**
    - chips de estatística, "Time: ambos | mandante | visitante" e "Só escalação | + reservas" (quando houver escalação);
    - lista com posição, nome, time, média, nº de jogos e a sequência dos 10 valores em bolinhas.
  - **Escanteios:**
    - filtros Feitos | Sofridos | Total e Geral | Casa/Fora;
    - para cada time, uma tabela das 10 faixas (média e total) com a faixa 0–10 em destaque e o nº de jogos;
    - se o jogo atual tiver a narração completa, a linha "Neste jogo".
  - Em todas: "Carregando…", "O histórico ainda está sendo montado" e "Sem jogos no histórico para este time".
- [ ] **Step 2:** `npm test` e `npm run build` → sem erros.
- [ ] **Step 3: Verificação manual** com dados reais gerados localmente (UPDATE_START=2026-07-01) em `public/data/`:
  - um jogo da PL da próxima rodada (Pré-jogo, H2H, Escalação "ainda não divulgada", Jogadores, Escanteios);
  - um jogo encerrado (Escalação no campo e "Neste jogo");
  - um jogo da NBA (Pré-jogo, H2H, Jogadores);
  - largura de 390 px;
  - conferir 1 número de cada aba na mão.
- [ ] **Step 4:** Commit `feat: abas de análise no detalhe do jogo`.
- [ ] **Step 5:** Revisão final, correções, merge, push e disparo do robô (`gh workflow run pages.yml`). A carga v2 leva ~30 min. Repetir o disparo enquanto o log mostrar `CARGA_PENDENTE`. Depois, verificar as abas no site publicado.
