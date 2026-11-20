# Futebol brasileiro e sul-americano no painel — design (mudança pequena)

## Intenção
Acompanhar no painel o futebol brasileiro: Brasileirão Série A, Copa do Brasil, Libertadores e Sul-Americana,
com o mesmo tratamento das ligas europeias (jogos do dia, detalhe/análise, tabela, rankings, favoritos, notícias).

## Abordagens consideradas
- **A) Mais quatro ligas na lista atual (escolhida).** Cada competição vira um item de `LEAGUES`; todas as telas
  já leem dessa lista. Pouco código, nenhuma mudança visual além de mais botões.
- B) Agrupar o futebol em "Brasil e América do Sul" e "Europa" (duas fileiras de botões, filtro "Futebol (Brasil)"
  nos rankings). Mais organizado com muitas ligas, mas mexe em quatro telas; fica para depois, se a lista crescer.

## Decisões
- Competições (caminhos da ESPN, conferidos em 20/11/2026):
  `BRA` Brasileirão (`soccer/bra.1`), `CDB` Copa do Brasil (`soccer/bra.copa_do_brazil`),
  `LIB` Libertadores (`soccer/conmebol.libertadores`), `SUL` Sul-Americana (`soccer/conmebol.sudamericana`).
- Ordem: NFL, NBA, Brasileirão, Copa do Brasil, Libertadores, Sul-Americana, depois as europeias.
- A aba Tabela abre no Brasileirão quando não há preferência salva (antes: Premier League).
- Copa do Brasil é só mata-mata e a ESPN não tem tabela: a aba Tabela mostra
  "Competição em mata-mata, sem tabela de classificação." (marcada na liga, sem chamar a ESPN).
- Libertadores e Sul-Americana: a ESPN entrega grupos (A–H); a tabela já mostra vários grupos, sem mudança.
- Rankings: as quatro entram em "Por liga" e no ranking de times; "Futebol (todas)" passa a misturar Brasil e Europa.
- Notícias: a fonte ESPN ganha automaticamente as quatro competições (uma URL por liga); o ge já é fonte.
- Histórico: o robô diário carrega as novas competições desde 01/07/2025 (início padrão já existente);
  a primeira carga é mais longa, uma vez só.
- O backend local (`backend/painel/config.py`) recebe a mesma lista, para não divergir.

## Fora do escopo
Série B, estaduais, chaveamento visual do mata-mata, separação Brasil/Europa nas telas.

## Custo
Nenhum em dinheiro (repositório público: Actions e Pages gratuitos; API da ESPN aberta).
