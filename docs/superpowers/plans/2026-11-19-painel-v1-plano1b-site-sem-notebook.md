# Painel Esportivo v1 — Plano 1b: site no GitHub Pages, dados direto da ESPN

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tela Jogos do Dia funciona como site estático no GitHub Pages, buscando a ESPN direto do navegador, sem depender do notebook.

**Architecture:** Uma camada de dados em TypeScript (`frontend/src/espn/`) substitui a API local: busca scoreboards e classificações na ESPN, interpreta com as mesmas regras do parser Python e devolve o mesmo formato `GamesResponse` que a tela já usa. Favoritos passam para o `localStorage`. O build do Vite é publicado no GitHub Pages por um workflow do GitHub Actions.

**Tech Stack:** React 19 + TypeScript + Vite + Vitest (existentes); GitHub Actions (`actions/upload-pages-artifact`, `actions/deploy-pages`); GitHub CLI (`gh`).

**Spec:** `docs/superpowers/specs/2026-11-19-painel-esportivo-design.md` (§8)

## Global Constraints

- Todas as regras do Plano 1 continuam: 7 ligas e paths ESPN, fuso `America/Sao_Paulo`, nada estimado, aviso por liga quando falhar, "atualizado às".
- O `GamesResponse` e o `Game` de `frontend/src/types.ts` não mudam: os componentes da tela não são reescritos.
- Ligas: `NFL football/nfl`, `NBA basketball/nba`, `PL soccer/eng.1`, `UCL soccer/uefa.champions`, `ESP soccer/esp.1`, `ITA soccer/ita.1`, `ALE soccer/ger.1` — em `frontend/src/espn/leagues.ts`, mesma ordem.
- Status: `pre`→scheduled; `in`→live; `post` + `STATUS_POSTPONED|STATUS_DELAYED|STATUS_SUSPENDED`→postponed; `post` + `STATUS_CANCELED|STATUS_ABANDONED|STATUS_FORFEIT`→canceled; demais `post`→final. Placar só em live/final.
- Dia local D = jogos com início em `[D 00:00, D+1 00:00)` de Brasília, buscados nas datas ESPN `D-1` e `D`.
- Commits publicados com o e-mail anônimo do GitHub; o e-mail pessoal não pode ir para o repositório público.
- Repositório `painel-esportivo`, público, na conta do usuário; site em `https://<usuario>.github.io/painel-esportivo/`.

## Review Focus

1. **Jogo perto da meia-noite** continua caindo no dia certo, agora filtrado no navegador. → `loadDay filters by Sao Paulo day` (Task 2).
2. **Uma liga falhando** (rede do celular instável, ESPN fora) não apaga as outras e gera aviso com o nome da liga. → `loadDay keeps other leagues when one fails` (Task 2).
3. **Formato inesperado** de um evento não derruba a liga inteira silenciosamente. → `parse skips malformed event` (Task 1).
4. **Armazenamento indisponível** (aba anônima no celular): favoritos e cache de classificação degradam sem erro. → `favorites survive storage errors` (Task 2).
5. **Caminho do site** (`/painel-esportivo/`): arquivos e ícone carregam fora da raiz. → verificação no site publicado (Task 4).

---

### Task 1: Parser da ESPN em TypeScript

**Files:**
- Create: `frontend/src/espn/leagues.ts`, `frontend/src/espn/parse.ts`
- Test: `frontend/src/espn/parse.test.ts` (lê as fixtures reais de `backend/tests/fixtures/` com `fs`)

**Interfaces:**
- Produces: `LEAGUES: League[]` (com `path`), `parseScoreboard(league: League, payload: unknown): Game[]` (jogos com `rank: null`, `favorite: false`; evento malformado é ignorado e contado), `parseStandings(payload: unknown): Record<string, number>`.

- [ ] **Step 1:** Testes que falham, espelhando `backend/tests/test_parse.py`: PL 08/11 → 5 jogos final com placar inteiro e `start_utc` terminando em `Z`; NBA 17/11 → `record` `\d+-\d+`; scheduled sem placar; live com `status_detail` = `shortDetail`; postponed/suspended/canceled sem placar; standings PL → 20 times, ranks 1..20; `parse skips malformed event` (um evento sem `competitions` + 1 válido → 1 jogo).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar. `start_utc` normalizado para `YYYY-MM-DDTHH:MM:SSZ`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: parser da ESPN no navegador`.

### Task 2: Camada de dados no navegador

**Files:**
- Create: `frontend/src/espn/client.ts`, `frontend/src/espn/store.ts`, `frontend/src/espn/loadDay.ts`
- Test: `frontend/src/espn/loadDay.test.ts`, `frontend/src/espn/store.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `fetchJson(url: string, timeoutMs = 15000): Promise<unknown>` (lança `Error` com mensagem em português para status ≠ 200, timeout ou JSON inválido).
  - `store.ts`: `getFavorites(): Set<string>` (chaves `"sport:team_id"`), `toggleFavorite(sport, teamId): boolean`, `getCachedRanks(league): Record<string,number> | null` e `setCachedRanks(league, ranks)` (validade 6 h). Tudo em try/catch: sem armazenamento, favoritos vivem só na memória da aba.
  - `loadDay(day: string, opts: {leagues?: string[]; fetch?: typeof fetchJson; now?: Date}): Promise<GamesResponse>` — busca as datas ESPN `D-1` e `D` das ligas pedidas (todas por padrão), em paralelo; filtra pelo dia de Brasília; aplica `rank` (classificação em cache ou buscada) e `favorite`; ordena por horário. `errors` = ligas que falharam (`{league, message, at}`); `stale` = algum erro; `updated_at` = agora.
  - `refreshLive(prev: GamesResponse, opts)` — rebusca só as ligas com jogo `live` ou agendado já iniciado (mesma regra de `needsFastPoll`) e mescla com `prev`.

- [ ] **Step 1:** Testes que falham com `fetch` falso servindo as fixtures: `loadDay filters by Sao Paulo day`; `loadDay keeps other leagues when one fails` (PL lança → jogos NBA presentes, `errors[0].league == "PL"`, `stale` true); `applies rank and favorite` (favorito marcado via `toggleFavorite`); `refreshLive only refetches live leagues`; `favorites survive storage errors` (`localStorage` que lança → `toggleFavorite` funciona na memória); `ranks cache expires after 6h`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: camada de dados ESPN no navegador com favoritos locais`.

### Task 3: Tela usando a nova camada

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/components/StaleBanner.tsx`
- Delete: `frontend/src/api.ts`

- [ ] **Step 1:** `App` usa `LEAGUES` em vez de `getLeagues`, `loadDay` no carregamento e na troca de dia, `refreshLive` no polling rápido e `loadDay` no lento, `toggleFavorite` na estrela (atualiza a lista na hora). Rodapé: "Dados ESPN · atualizado às HH:MM". `StaleBanner`: "Sem conexão com a internet" quando todas as ligas falham; senão a mensagem por liga.
- [ ] **Step 2:** `npm test` e `npm run build` → sem erros.
- [ ] **Step 3: Verificação manual** com `npm run dev` (sem o servidor Python): hoje com jogos reais; trocar de dia; favoritar e recarregar; desligar a rede do navegador (DevTools offline) → aviso.
- [ ] **Step 4:** Commit `feat: tela busca a ESPN direto do navegador`.

### Task 4: Publicação no GitHub Pages

**Files:**
- Create: `.github/workflows/pages.yml`, `frontend/public/manifest.webmanifest`, `frontend/public/icon.svg`
- Modify: `frontend/vite.config.ts` (`base: '/painel-esportivo/'`), `frontend/index.html` (manifest, ícone, `theme-color`, `apple-mobile-web-app-capable`)

- [ ] **Step 1:** Workflow: em push na `main`, `npm ci` + `npm test` + `npm run build` em `frontend/`, `upload-pages-artifact` de `frontend/dist`, `deploy-pages`. Versões fixas das actions.
- [ ] **Step 2:** `npm run build` local → `dist/index.html` referencia `/painel-esportivo/assets/...`.
- [ ] **Step 3:** **Passos do usuário:** instalar o GitHub CLI (`winget install GitHub.cli`) e rodar `! gh auth login`. Descobrir o usuário com `gh api user --jq .login,.id`.
- [ ] **Step 4:** Configurar o e-mail do repositório como `<id>+<usuario>@users.noreply.github.com` e reescrever o autor de todos os commits locais (`git rebase -r --root --exec "git commit --amend --no-edit --reset-author"`). Conferir com `git log --format='%ae' | sort -u` → só o e-mail anônimo.
- [ ] **Step 5:** **Confirmar com o usuário** antes de publicar. Então `gh repo create painel-esportivo --public --source . --push` e `gh api -X POST repos/<usuario>/painel-esportivo/pages -f build_type=workflow`.
- [ ] **Step 6: Verificação:** o workflow termina verde (`gh run watch`); abrir `https://<usuario>.github.io/painel-esportivo/` no Chrome: jogos de hoje carregam, ícone e CSS carregam, console sem erros.
- [ ] **Step 7:** Informar o endereço ao usuário com instruções para "Adicionar à tela inicial" no celular, e perguntar se desliga a tarefa `PainelEsportivo` do notebook.
