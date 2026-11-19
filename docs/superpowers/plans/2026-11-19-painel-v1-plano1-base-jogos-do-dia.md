# Painel Esportivo v1 — Plano 1 de 3: Base de dados + Jogos do Dia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um painel local que mostra, com dados reais da ESPN, os jogos de qualquer dia dos 7 campeonatos, com placar ao vivo atualizando sozinho, filtros, busca, agrupamento, posição na tabela e times favoritos.

**Architecture:** Servidor Python (FastAPI) que sincroniza os scoreboards e classificações da ESPN para um SQLite local e expõe uma API JSON; frontend React servido pelo mesmo servidor. A ESPN só é tocada pelo sincronizador — a tela lê sempre do banco, e cada resposta diz quando os dados foram atualizados e se a última sincronização falhou.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, httpx, sqlite3 (stdlib), pytest; Node 24, Vite, React 18, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-painel-esportivo-design.md`

### Roteiro da v1 (3 planos, cada um entrega software funcionando)
1. **Este plano:** base, sincronização ao vivo, Jogos do Dia, favoritos, início com o Windows.
2. Plano 2: painel de detalhes do jogo (lances, estatísticas, escalações, box score, H2H a partir do histórico) e página de Classificação.
3. Plano 3: carga histórica (temporada atual + anterior) das estatísticas por jogo, recuperação de jogos perdidos, rankings de Ligas e de Times, página de status completa.

## Global Constraints

- Somente fontes grátis; neste plano, só a ESPN: `https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard?dates=YYYYMMDD` (uma data por chamada — intervalo de datas retorna 400) e `https://site.api.espn.com/apis/v2/sports/{path}/standings`.
- Campeonatos (chave → path ESPN → nome exibido): `NFL`→`football/nfl`→"NFL"; `NBA`→`basketball/nba`→"NBA"; `PL`→`soccer/eng.1`→"Premier League"; `UCL`→`soccer/uefa.champions`→"Champions League"; `ESP`→`soccer/esp.1`→"La Liga"; `ITA`→`soccer/ita.1`→"Serie A"; `ALE`→`soccer/ger.1`→"Bundesliga". A lista vive em `backend/painel/config.py`, nunca espalhada no código.
- Fuso de exibição e de "dia": `America/Sao_Paulo`. O banco guarda horários em UTC (ISO 8601).
- Nunca mostrar dado estimado. Dado ausente na fonte = campo `null` e a tela oculta.
- Toda resposta de dados ao vivo carrega `updated_at`; se a última sincronização de algum campeonato falhou depois do último sucesso, a resposta traz o erro e a tela mostra aviso.
- Intervalo mínimo de 0,5 s entre requisições à ESPN; header `User-Agent: Mozilla/5.0 (painel-esportivo pessoal)`.
- Servidor escuta em `0.0.0.0:8765`.
- Textos da interface em português do Brasil. Identidade visual própria (não usar marca/logo/cores do StatsHub ou Sofascore).
- Odds/apostas: fora do escopo; ignorar os campos `odds`/`pickcenter` da ESPN.

## Review Focus

1. **Jogo perto da meia-noite** (ex.: NBA 22:30 ET = 00:30 de Brasília do dia seguinte): deve aparecer no dia de Brasília correto. → teste `test_games_for_local_day_uses_sao_paulo_midnight` (Task 3) e a janela de datas do sincronizador (Task 4).
2. **ESPN fora do ar ou devolvendo erro**: a tela continua mostrando o que tem, com "atualizado às HH:MM" e aviso de falha; o servidor não cai. → `test_sync_records_error_and_keeps_games` (Task 4), `test_games_endpoint_reports_stale` (Task 5).
3. **Jogo adiado/cancelado**: não aparece como "Encerrado 0 x 0" nem como ao vivo. → `test_parse_postponed_status` (Task 2).
4. **IDs de times iguais em esportes diferentes** (o id 1 da NBA não é o id 1 do futebol): favoritos e times são identificados por `(sport, team_id)`. → `test_favorites_keyed_by_sport` (Task 3).
5. **Dia sem jogos / filtro sem resultado**: mensagem clara, nunca tela em branco. → `filterGames` com lista vazia (Task 7) e verificação manual (Task 8).

---

## Estrutura de arquivos

```
backend/
  pyproject.toml
  painel/
    __init__.py
    config.py          # LEAGUES, TZ, PORT, DB_PATH, intervalos
    models.py          # dataclasses Game, TeamSide
    db.py              # connect(), init_schema()
    espn/__init__.py
    espn/client.py     # EspnClient (HTTP, throttle)
    espn/parse.py      # parse_scoreboard(), parse_standings()
    repo.py            # gravação/leitura no SQLite
    sync.py            # Syncer + next_live_interval()
    api.py             # create_app()
    main.py            # entrada: app + laços de sincronização + uvicorn
  tests/
    fixtures/          # JSON reais gravados da ESPN
    record_fixtures.py
    test_*.py
frontend/
  (Vite React TS) src/types.ts, src/api.ts, src/lib/games.ts, src/lib/games.test.ts,
  src/App.tsx, src/components/*.tsx, src/styles.css
scripts/
  iniciar-painel.ps1
  instalar-inicializacao.ps1
```

---

### Task 1: Esqueleto do backend, configuração e banco

**Files:**
- Create: `.gitignore`, `backend/pyproject.toml`, `backend/painel/__init__.py`, `backend/painel/config.py`, `backend/painel/models.py`, `backend/painel/db.py`
- Test: `backend/tests/test_db.py`

**Interfaces:**
- Produces:
  - `config.LEAGUES: list[League]`, `League` = dataclass `(key: str, path: str, name: str, sport: Literal["soccer","basketball","football"])`; `config.league(key) -> League`.
  - `config.TZ = ZoneInfo("America/Sao_Paulo")`, `config.PORT = 8765`, `config.DB_PATH = Path(__file__).parents[1] / "data" / "painel.db"`.
  - `models.TeamSide(team_id: str, name: str, short_name: str, abbrev: str, logo: str | None, score: int | None, record: str | None)`.
  - `models.Game(id: str, league: str, sport: str, start_utc: datetime, status: Literal["scheduled","live","final","postponed","canceled"], status_detail: str, home: TeamSide, away: TeamSide, venue: str | None)`.
  - `db.connect(path: Path | str) -> sqlite3.Connection` (row_factory = sqlite3.Row, foreign keys on, cria a pasta) e `db.init_schema(conn) -> None` (idempotente).
  - Tabelas: `teams(sport, team_id, name, short_name, abbrev, logo, PK(sport,team_id))`; `games(id PK, league, sport, start_utc TEXT, status, status_detail, home_team_id, away_team_id, home_score INT NULL, away_score INT NULL, home_record NULL, away_record NULL, venue NULL, updated_at TEXT)` + índice em `start_utc`; `standings(league, team_id, rank INT, updated_at, PK(league,team_id))`; `favorites(sport, team_id, PK(sport,team_id))`; `sync_log(league, kind TEXT, ok INT, message TEXT NULL, at TEXT)`.

- [ ] **Step 1:** `git init` na raiz do projeto; `.gitignore` com `backend/.venv/`, `backend/data/`, `frontend/node_modules/`, `frontend/dist/`, `__pycache__/`, `.pytest_cache/`.
- [ ] **Step 2:** `backend/pyproject.toml` com dependências `fastapi`, `uvicorn[standard]`, `httpx`, `tzdata` e extra `dev` = `pytest`. Criar venv: `cd backend; python -m venv .venv; .venv\Scripts\pip install -e .[dev]`. Esperado: instala sem erro.
- [ ] **Step 3: Teste que falha** — `test_init_schema_creates_tables` (abre `tmp_path/"t.db"`, roda `init_schema` duas vezes, confere que as 5 tabelas existem) e `test_league_lookup` (`config.league("UCL").path == "soccer/uefa.champions"`, `len(config.LEAGUES) == 7`).
- [ ] **Step 4:** Rodar `.venv\Scripts\pytest tests/test_db.py -v` → FAIL (módulos inexistentes).
- [ ] **Step 5:** Implementar `config.py`, `models.py`, `db.py` conforme Interfaces.
- [ ] **Step 6:** Rodar de novo → PASS.
- [ ] **Step 7:** Commit `feat: esqueleto do backend, configuração e schema SQLite`.

---

### Task 2: Cliente ESPN e parser do scoreboard e da classificação

**Files:**
- Create: `backend/painel/espn/__init__.py`, `backend/painel/espn/client.py`, `backend/painel/espn/parse.py`, `backend/tests/record_fixtures.py`, `backend/tests/fixtures/*.json`
- Test: `backend/tests/test_parse.py`, `backend/tests/test_client.py`

**Interfaces:**
- Consumes: `config.League`, `models.Game`, `models.TeamSide`.
- Produces:
  - `EspnClient(http: httpx.Client | None = None, min_interval: float = 0.5)` com `scoreboard(league: League, day: date) -> dict` e `standings(league: League) -> dict`. Lança `EspnError(str)` para status ≠ 200, timeout ou JSON inválido. Espera `min_interval` entre chamadas.
  - `parse_scoreboard(league: League, payload: dict) -> list[Game]`.
  - `parse_standings(payload: dict) -> dict[str, int]` (team_id → rank; vazio se não houver `children`).

- [ ] **Step 1: Gravar fixtures reais.** `record_fixtures.py` baixa e salva em `tests/fixtures/`: `sb_PL_20261108.json`, `sb_NBA_20261117.json`, `sb_NFL_20261116.json`, `sb_UCL_20261104.json`, `standings_PL.json`. Rodar uma vez: `.venv\Scripts\python tests/record_fixtures.py`. Esperado: 5 arquivos, cada um > 1 KB.
- [ ] **Step 2: Testes que falham** (`test_parse.py`):
  - `test_parse_soccer_final`: `sb_PL_20261108` → 5 jogos; todos `status == "final"`, `sport == "soccer"`, `start_utc.tzinfo` não nulo, `home.score` e `away.score` inteiros, `venue` preenchido quando a ESPN traz.
  - `test_parse_nba_records`: `sb_NBA_20261117` → 5 jogos; `home.record` no formato `"\d+-\d+"`.
  - `test_parse_scheduled_has_no_score`: copiar um evento da fixture NFL, trocar `status.type.state` para `"pre"` e `name` para `"STATUS_SCHEDULED"` → `status == "scheduled"` e os dois `score is None`.
  - `test_parse_live_status`: `state "in"` → `status == "live"`, `status_detail == status.type.shortDetail`.
  - `test_parse_postponed_status`: `state "post"`, `name "STATUS_POSTPONED"` → `status == "postponed"` e scores `None`; `"STATUS_CANCELED"` → `"canceled"`.
  - `test_parse_standings_ranks`: `standings_PL.json` → 20 times; o rank do primeiro entry é 1.
- [ ] **Step 3:** Rodar `pytest tests/test_parse.py -v` → FAIL.
- [ ] **Step 4: Implementar o parser.** Mapeamento de status: `state=="pre"`→scheduled; `"in"`→live; `"post"` com `name` em {`STATUS_POSTPONED`,`STATUS_DELAYED`}→postponed, em {`STATUS_CANCELED`,`STATUS_ABANDONED`,`STATUS_FORFEIT`}→canceled, senão final. Score só para live/final (`int(competitor["score"])`). `record` = primeiro item de `competitor["records"]` com `type=="total"` (ou o primeiro), `summary`. Logo = `team["logo"]`. `rank` da classificação vem de `stats` com `name=="rank"`.
- [ ] **Step 5:** Rodar → PASS.
- [ ] **Step 6: Testes do cliente** (`test_client.py`, com `httpx.MockTransport`): `test_scoreboard_builds_url` (URL termina em `/soccer/eng.1/scoreboard?dates=20261108`, header User-Agent presente); `test_error_status_raises` (503 → `EspnError`); `test_throttle` (duas chamadas com `min_interval=0.2` levam ≥ 0,2 s).
- [ ] **Step 7:** Implementar `client.py`; rodar `pytest -v` → PASS.
- [ ] **Step 8:** Commit `feat: cliente e parser da ESPN com fixtures reais`.

---

### Task 3: Repositório (gravação e consultas)

**Files:**
- Create: `backend/painel/repo.py`
- Test: `backend/tests/test_repo.py`

**Interfaces:**
- Consumes: `db.connect/init_schema`, `models.Game`.
- Produces (todas recebem `conn` como 1º parâmetro):
  - `upsert_games(conn, games: list[Game], now: datetime) -> None` (também faz upsert em `teams`).
  - `games_for_local_day(conn, day: date) -> list[dict]` — jogos com `start_utc` em `[day 00:00, day+1 00:00)` de `America/Sao_Paulo`, ordenados por horário; cada dict no formato `GameOut` abaixo.
  - `set_standings(conn, league: str, ranks: dict[str,int], now) -> None`.
  - `add_favorite(conn, sport, team_id)`, `remove_favorite(conn, sport, team_id)`, `list_favorites(conn) -> list[dict]` (`{sport, team_id, name, logo}`).
  - `log_sync(conn, league, kind: Literal["scoreboard","standings"], ok: bool, message: str | None, now)`; `sync_health(conn) -> list[dict]` (`{league, last_ok, last_error, last_error_at, failing: bool}` — `failing` = último erro mais recente que o último sucesso).
  - `has_live_games(conn) -> bool`.
- `GameOut` (contrato com o frontend): `{id, league, sport, start_utc (ISO com Z), status, status_detail, venue, home: {team_id, name, short_name, abbrev, logo, score, record, rank, favorite}, away: {...}}`. `rank` = posição em `standings` da mesma liga (ou `null`); `favorite` = bool.

- [ ] **Step 1: Testes que falham:**
  - `test_upsert_is_idempotent_and_updates_score`: grava um jogo, regrava com placar novo → 1 linha, placar novo.
  - `test_games_for_local_day_uses_sao_paulo_midnight`: jogo às `2026-11-20T02:30Z` (23:30 de 19/11 em Brasília) aparece em `19/11` e não em `20/11`; jogo às `2026-11-20T03:30Z` aparece em `20/11`.
  - `test_rank_and_favorite_in_output`: com standings `{team_id: 3}` e favorito marcado → `home.rank == 3`, `home.favorite is True`.
  - `test_favorites_keyed_by_sport`: favoritar `("basketball","1")` não marca o time `("soccer","1")`.
  - `test_sync_health_failing`: sucesso às 10:00 e erro às 10:05 → `failing True`; novo sucesso às 10:10 → `failing False`.
- [ ] **Step 2:** `pytest tests/test_repo.py -v` → FAIL.
- [ ] **Step 3:** Implementar `repo.py`.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat: repositório SQLite de jogos, classificação, favoritos e saúde da sincronização`.

---

### Task 4: Sincronizador

**Files:**
- Create: `backend/painel/sync.py`
- Test: `backend/tests/test_sync.py`

**Interfaces:**
- Consumes: `EspnClient`, `parse_scoreboard`, `parse_standings`, funções de `repo`.
- Produces:
  - `espn_dates_for_local_day(day: date) -> list[date]` → `[day - 1, day]` (as datas da ESPN seguem o dia dos EUA, atrasado em relação a Brasília).
  - `Syncer(conn, client: EspnClient, leagues: list[League], clock: Callable[[], datetime])` com:
    - `sync_local_days(days: Iterable[date]) -> None` — para cada liga e cada data ESPN distinta necessária, busca, faz parse, `upsert_games`, `log_sync(ok=True)`; em `EspnError` faz `log_sync(ok=False, message)` e **continua** com as demais.
    - `sync_live() -> None` — re-sincroniza só as ligas com jogo `live` no banco, para `espn_dates_for_local_day(hoje)`.
    - `sync_standings() -> None` — só ligas `sport == "soccer"`.
  - `next_live_interval(has_live: bool) -> int` → `30` se há jogo ao vivo, senão `600`.

- [ ] **Step 1: Testes que falham** (cliente falso que devolve as fixtures por liga/data e pode ser configurado para lançar `EspnError`):
  - `test_espn_dates_for_local_day`: `date(2026,11,19)` → `[date(2026,11,18), date(2026,11,19)]`.
  - `test_sync_local_days_dedupes_dates`: dias 19 e 20 → para cada liga, a ESPN é chamada para 18, 19, 20 (3 chamadas, não 4).
  - `test_sync_records_error_and_keeps_games`: grava jogos, depois a liga PL passa a falhar → jogos antigos continuam no banco, `sync_health` mostra PL `failing True`, NBA segue `ok`.
  - `test_sync_live_only_live_leagues`: só a liga com jogo `live` é consultada.
  - `test_next_live_interval`: `True`→30, `False`→600.
- [ ] **Step 2:** `pytest tests/test_sync.py -v` → FAIL.
- [ ] **Step 3:** Implementar `sync.py`.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat: sincronizador com janela de datas, ao vivo e tolerância a falhas`.

---

### Task 5: API HTTP

**Files:**
- Create: `backend/painel/api.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `repo`, `config`.
- Produces: `create_app(conn_factory: Callable[[], sqlite3.Connection], static_dir: Path | None) -> FastAPI` com:
  - `GET /api/leagues` → `[{key, name, sport}]` na ordem de `config.LEAGUES`.
  - `GET /api/games?date=YYYY-MM-DD` (padrão: hoje em Brasília) → `{date, games: GameOut[], updated_at, stale: bool, errors: [{league, message, at}]}`. `updated_at` = sucesso mais antigo entre as ligas (o dado é tão novo quanto a liga mais atrasada); `stale` = alguma liga `failing` ou `updated_at` com mais de 15 min.
  - `GET /api/favorites` → `list_favorites`; `PUT /api/favorites/{sport}/{team_id}` e `DELETE /api/favorites/{sport}/{team_id}` → 204.
  - `GET /api/status` → `sync_health`.
  - Se `static_dir` existir: serve o build do frontend em `/` (com fallback para `index.html`).
  - Data inválida → 422.

- [ ] **Step 1: Testes que falham** (`fastapi.testclient.TestClient`, banco temporário com jogos da fixture):
  - `test_games_endpoint_shape`: `GET /api/games?date=2026-11-08` → 200, jogos com `home.rank`, `home.favorite`, `start_utc` terminando em `Z`.
  - `test_games_endpoint_reports_stale`: com PL `failing` → `stale True` e `errors[0].league == "PL"`.
  - `test_favorites_roundtrip`: PUT → aparece no GET e em `home.favorite`; DELETE → some.
  - `test_invalid_date_422`.
- [ ] **Step 2:** `pytest tests/test_api.py -v` → FAIL.
- [ ] **Step 3:** Implementar `api.py`.
- [ ] **Step 4:** Rodar todos os testes `pytest -v` → PASS.
- [ ] **Step 5:** Commit `feat: API de jogos, favoritos e status`.

---

### Task 6: Execução do servidor e início com o Windows

**Files:**
- Create: `backend/painel/main.py`, `scripts/iniciar-painel.ps1`, `scripts/instalar-inicializacao.ps1`

**Interfaces:**
- Consumes: `create_app`, `Syncer`, `next_live_interval`, `config`.
- Produces: `python -m painel.main` sobe tudo. No startup (lifespan): `init_schema`; tarefa em segundo plano que roda `sync_local_days(hoje-3 … hoje+7)` + `sync_standings()`, depois repete a janela a cada 10 min e as classificações a cada 6 h; outra tarefa roda `sync_live()` e dorme `next_live_interval(has_live_games())`. Chamadas bloqueantes da ESPN em `asyncio.to_thread`. Exceções nos laços são registradas em log e o laço continua.

- [ ] **Step 1:** Implementar `main.py` (uvicorn em `0.0.0.0:8765`, log em `backend/data/painel.log`).
- [ ] **Step 2: Verificação real:** `cd backend; .venv\Scripts\python -m painel.main`. Em outro terminal: `curl http://localhost:8765/api/status` → 7 ligas, todas com `last_ok` preenchido em até ~2 min; `curl "http://localhost:8765/api/games?date=<hoje>"` → jogos reais de hoje (conferir 2 placares contra o site da ESPN).
- [ ] **Step 3:** `iniciar-painel.ps1`: roda `backend\.venv\Scripts\pythonw.exe -m painel.main` com o diretório `backend` (sem janela). `instalar-inicializacao.ps1`: registra a tarefa agendada `PainelEsportivo` (gatilho: logon do usuário atual, sem privilégios elevados) chamando o script anterior, e cria na Área de Trabalho o atalho "Painel Esportivo" para `http://localhost:8765`.
- [ ] **Step 4:** **Perguntar ao usuário** antes de rodar `instalar-inicializacao.ps1`. Para acesso pelo celular, informar o comando de regra de firewall (porta 8765, perfil Privado; precisa de administrador) e deixar que ele decida executar.
- [ ] **Step 5:** Commit `feat: servidor com laços de sincronização e início automático no Windows`.

---

### Task 7: Frontend — projeto e lógica de filtros

**Files:**
- Create: `frontend/` (Vite React TS), `frontend/src/types.ts`, `frontend/src/api.ts`, `frontend/src/lib/games.ts`
- Test: `frontend/src/lib/games.test.ts`

**Interfaces:**
- Consumes: contrato `GameOut` e endpoints da Task 5.
- Produces:
  - `types.ts`: `Game`, `Side`, `League`, `GamesResponse` espelhando a Task 5.
  - `api.ts`: `getLeagues()`, `getGames(date: string)`, `setFavorite(sport, teamId, on: boolean)`.
  - `lib/games.ts`:
    - `type Tab = "todos" | "favoritos" | "ao_vivo" | "proximos" | "encerrados"`.
    - `filterGames(games: Game[], opts: {tab: Tab; leagues: Set<string>; query: string}) -> Game[]` — `proximos` = scheduled; `encerrados` = final, postponed e canceled; `favoritos` = algum lado `favorite`; `leagues` vazio = todas; `query` ignora acentos e caixa e casa com nome do time, abreviação ou nome da liga.
    - `groupGames(games: Game[], mode: "liga" | "horario", leagueOrder: string[]) -> {title: string; games: Game[]}[]` — por liga na ordem de `leagueOrder`; por horário agrupa pela hora local (`HH:00`) em Brasília.
    - `countLive(games) -> number`.
    - `formatLocalTime(iso: string) -> string` (`HH:mm` em America/Sao_Paulo).

- [ ] **Step 1:** `npm create vite@latest frontend -- --template react-ts`; `npm i -D vitest`; script `"test": "vitest run"`; em `vite.config.ts`, proxy de `/api` para `http://localhost:8765`.
- [ ] **Step 2: Testes que falham:** `filters live tab`, `encerrados includes postponed and canceled`, `query ignores accents` ("atletico" acha "Atlético Madrid"), `favorites tab`, `empty input returns empty`, `group by league follows order`, `group by hour uses Sao Paulo time` (`2026-11-20T02:30:00Z` → grupo `"23:00"`), `countLive`.
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** Implementar `types.ts`, `api.ts`, `lib/games.ts`.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: frontend base com lógica de filtros e agrupamento`.

---

### Task 8: Frontend — tela Jogos do Dia

**Files:**
- Create: `frontend/src/App.tsx`, `frontend/src/styles.css`, `frontend/src/components/DayBar.tsx`, `Toolbar.tsx`, `GameList.tsx`, `GameRow.tsx`, `DetailPane.tsx`, `StaleBanner.tsx`

**Interfaces:**
- Consumes: `api.ts`, `lib/games.ts`.
- Produces: a tela completa de Jogos do Dia; `DetailPane` recebe `game: Game | null` e, neste plano, mostra só cabeçalho (times, escudos, placar, status, horário, estádio) ou "Selecione um jogo". O Plano 2 preenche o conteúdo.

Comportamento:
- **DayBar:** de hoje −3 a hoje +7, rótulo "Hoje"/"Amanhã"/"Ontem" ou dia da semana + `dd/mm`; setas; hoje selecionado ao abrir.
- **Toolbar:** abas Todos · Favoritos · Ao vivo (n) · Próximos · Encerrados; busca; chips de liga (multisseleção); alternância "Por liga / Por horário".
- **GameRow:** horário (`formatLocalTime`) ou `status_detail` em destaque vermelho se ao vivo; "Adiado"/"Cancelado"/"Encerrado"; escudo + nome + `rank`º (futebol) ou `record` (NBA/NFL); placar; estrela que chama `setFavorite` e atualiza a lista.
- **Layout:** ≥ 900 px, lista à esquerda e `DetailPane` à direita; < 900 px, o detalhe abre por cima em tela cheia com botão Voltar. Sem rolagem horizontal em 360 px.
- **Atualização:** se o dia escolhido é hoje e `countLive > 0`, refaz `getGames` a cada 30 s; caso contrário, a cada 5 min. Rodapé: "Atualizado às HH:MM".
- **StaleBanner:** se `stale`, faixa de aviso "Dados podem estar desatualizados: falha ao atualizar {ligas}". Se a API não responder, mantém a última lista e mostra "Sem conexão com o servidor".
- **Vazio:** "Nenhum jogo neste dia" ou "Nenhum jogo com esses filtros".
- **Tema:** escuro por padrão, com alternância para claro (preferência no `localStorage`, com try/catch).
- Build: `npm run build` gera `frontend/dist`; `main.py` passa `static_dir = <raiz>/frontend/dist`.

- [ ] **Step 1:** Implementar os componentes e estilos.
- [ ] **Step 2:** `npm test` e `npm run build` → sem erros.
- [ ] **Step 3: Verificação manual** com o servidor real rodando e `http://localhost:8765` no navegador: (a) hoje mostra os jogos reais e a contagem ao vivo bate com a ESPN; (b) navegar para +2 dias e −2 dias; (c) cada aba e a busca "atletico"; (d) favoritar um time, recarregar a página e ver que continua marcado; (e) largura 360 px no DevTools, abrindo e fechando um jogo; (f) parar a internet por um ciclo e ver o aviso de dados desatualizados; (g) abrir pelo celular em `http://<IP-do-PC>:8765` (se a regra de firewall foi criada).
- [ ] **Step 4:** Commit `feat: tela Jogos do Dia`.
