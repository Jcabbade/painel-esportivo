# Futebol brasileiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incluir Brasileirão, Copa do Brasil, Libertadores e Sul-Americana em todas as telas do painel.

**Architecture:** Todas as telas e robôs leem `LEAGUES` (`frontend/src/espn/leagues.ts`); basta acrescentar quatro itens,
marcar a Copa do Brasil como mata-mata (sem tabela) e trocar a liga inicial da aba Tabela. O backend local recebe a mesma lista.

**Tech Stack:** React + TypeScript + Vitest (frontend), Python + pytest (backend).

**Spec:** `docs/superpowers/specs/2026-11-20-futebol-brasileiro-design.md`

## Global Constraints

- Chaves/caminhos: `BRA` `soccer/bra.1` "Brasileirão"; `CDB` `soccer/bra.copa_do_brazil` "Copa do Brasil"; `LIB` `soccer/conmebol.libertadores` "Libertadores"; `SUL` `soccer/conmebol.sudamericana` "Sul-Americana".
- Ordem: NFL, NBA, BRA, CDB, LIB, SUL, PL, UCL, ESP, ITA, ALE.
- Texto da Copa do Brasil na Tabela, exato: `Competição em mata-mata, sem tabela de classificação.`
- Tabela abre em `BRA` quando não há preferência salva válida.

## Review Focus

1. Preferência salva antiga (`'PL'`) na aba Tabela continua valendo; valor inválido ou ausente cai em `BRA` — teste em `initialStandingsKey` (Task 1).
2. Copa do Brasil selecionada na Tabela não chama a ESPN nem mostra "A ESPN não trouxe classificação" — verificado na tela (Task 1, Step 6).
3. Libertadores/Sul-Americana mostram os grupos A–H — verificado na tela (Task 1, Step 6).
4. Robô de notícias e de histórico rodam com as 11 ligas sem erro — `npm test` e uma execução manual do workflow após o push (Task 2).
5. Times sem jogo na temporada (copas eliminadas) não quebram rankings — já tratado pelo código atual; conferir em "Por liga" na tela (Task 1, Step 6).

---

### Task 1: Ligas novas no frontend

**Files:**
- Modify: `frontend/src/espn/leagues.ts`
- Modify: `frontend/src/components/StandingsPage.tsx`
- Create: `frontend/src/espn/leagues.test.ts`

**Interfaces:**
- Produces: `EspnLeague.knockout?: boolean`; `initialStandingsKey(saved: string | null): string` em `leagues.ts`.

- [ ] **Step 1: Write the failing test** (`leagues.test.ts`)

```ts
it('ordem e caminhos', () => {
  expect(LEAGUES.map(l => l.key)).toEqual(['NFL','NBA','BRA','CDB','LIB','SUL','PL','UCL','ESP','ITA','ALE'])
  expect(league('BRA').path).toBe('soccer/bra.1')
  expect(league('CDB').path).toBe('soccer/bra.copa_do_brazil')
  expect(league('LIB').path).toBe('soccer/conmebol.libertadores')
  expect(league('SUL').path).toBe('soccer/conmebol.sudamericana')
  expect(['BRA','CDB','LIB','SUL'].every(k => league(k).sport === 'soccer')).toBe(true)
})
it('só a Copa do Brasil é mata-mata', () => {
  expect(LEAGUES.filter(l => l.knockout).map(l => l.key)).toEqual(['CDB'])
})
it('liga inicial da tabela', () => {
  expect(initialStandingsKey(null)).toBe('BRA')
  expect(initialStandingsKey('xyz')).toBe('BRA')
  expect(initialStandingsKey('PL')).toBe('PL')
})
```

- [ ] **Step 2: Run** `npm test -- leagues` em `frontend/` — Expected: FAIL.
- [ ] **Step 3: Implement** os quatro itens em `LEAGUES` (ordem das Global Constraints), `knockout: true` só em `CDB`, e `initialStandingsKey`.
- [ ] **Step 4: StandingsPage:** estado inicial via `initialStandingsKey(saved)`; se `lg.knockout`, não chamar `loadStandings` e mostrar `<p className="empty">Competição em mata-mata, sem tabela de classificação.</p>`.
- [ ] **Step 5: Run** `npm test && npm run build && npx eslint .` — Expected: tudo passa (ajustar testes existentes que dependam da ordem/quantidade de ligas).
- [ ] **Step 6: Verificar na tela** (`npm run dev`): botões novos em Jogos; Tabela abre no Brasileirão; Copa do Brasil mostra o aviso; Libertadores mostra grupos A–H; Ligas › "Por liga" lista as novas sem erro no console.
- [ ] **Step 7: Commit** `feat: Brasileirão, Copa do Brasil, Libertadores e Sul-Americana`

### Task 2: Backend local e publicação

**Files:**
- Modify: `backend/painel/config.py`, `backend/tests/test_db.py:15`

- [ ] **Step 1:** Em `test_db.py`, `assert len(config.LEAGUES) == 11`; rodar `backend/.venv/Scripts/python -m pytest backend/tests -q` — Expected: FAIL.
- [ ] **Step 2:** Acrescentar as quatro `League(...)` em `config.py`, mesma ordem e valores do frontend.
- [ ] **Step 3:** Rodar pytest — Expected: PASS.
- [ ] **Step 4: Commit** `feat(backend): mesmas ligas novas do site`, push, e disparar `gh workflow run pages.yml` para carregar o histórico das novas competições; conferir que termina com sucesso e que `meta.json` no ramo `data` tem `BRA`, `CDB`, `LIB`, `SUL`.
