# Painel Esportivo — Design (v1)

Data: 2026-11-19

## 1. Intenção

Um painel pessoal para acompanhar **placares ao vivo, agenda e estatísticas** de NFL, NBA e futebol, inspirado no StatsHub (app.statshub.com.br) e no Sofascore. O usuário quer **dados reais**, para analisar jogos e times, e **custo zero** (nenhum serviço pago). Uso pessoal: roda no PC dele e é acessado pelo navegador do PC e do celular (mesma rede Wi-Fi).

O projeto vai em etapas. Este documento cobre a **v1**; a etapa 2 está listada só para orientar a arquitetura.

## 2. Escopo

### Campeonatos
- **NFL** e **NBA** (temporada regular + playoffs).
- **Futebol:** Premier League, UEFA Champions League, La Liga, Serie A (Itália), Bundesliga.
- A lista de campeonatos é configuração (não código), para incluir outros depois.

### v1 — o que entra
1. **Jogos do Dia**
   - Barra de dias (navegar dias anteriores/seguintes; hoje em destaque).
   - Abas: Todos · Favoritos · Ao vivo (com contagem) · Próximos · Encerrados.
   - Busca por time ou liga.
   - Agrupar **por liga** ou **por horário**.
   - Cada jogo: horário ou status/relógio ao vivo, times com escudo e **posição na tabela**, placar, estrela de favorito.
   - Layout dividido: lista à esquerda, detalhes do jogo selecionado à direita (no celular, o detalhe abre em tela cheia).
   - Placares ao vivo atualizam sozinhos.
2. **Página/painel do jogo**
   - Cabeçalho: times, placar, status, data/hora, estádio.
   - Futebol: lances (gols com minuto e autor, cartões, substituições), estatísticas do jogo, escalações, confronto direto (H2H), classificação da liga, placar do jogo de ida em mata-mata.
   - NBA/NFL: placar por quarto, estatísticas dos times, líderes/box score de jogadores, H2H, classificação.
   - O que a ESPN não trouxer para um jogo fica oculto (não mostrar seção vazia nem estimar).
3. **Classificação** de cada liga (tabela do futebol; conferências/divisões da NBA e NFL).
4. **Rankings de Ligas** (estilo StatsHub "Ligas"): escolher estatística, medida (Média / Mais de / Menos de + linha ajustável), período, recorte (temporada atual / últimos 30 dias); lista as ligas com % de jogos que bateram a linha, médias e nº de jogos.
5. **Rankings de Times** (estilo StatsHub "Times"): mesma lógica, por time; filtros: liga (ou todas), últimos 5/10/15/20/temporada, mando (geral/casa/fora), ordem; mostra forma recente (últimos 5: V/E/D).
6. **Favoritos:** marcar times; aba Favoritos e destaque dos jogos deles.
7. **Status dos dados:** página/indicador com última sincronização por campeonato, erros da fonte e progresso da carga/recuperação.

### Estatísticas para os rankings
| Esporte | Estatísticas | Períodos |
|---|---|---|
| Futebol | Gols, escanteios, cartões, chutes, chutes no gol, faltas, impedimentos, ambas marcam, resultado (V/E/D) | Gols e resultado: jogo todo, 1º e 2º tempo. Demais: só jogo todo |
| NBA | Pontos (total do jogo, do time, sofridos), rebotes, assistências, cestas de 3 | Pontos: jogo todo, 1º/2º tempo, por quarto. Demais: só jogo todo |
| NFL | Pontos (total, do time, sofridos), jardas totais, turnovers, sacks | Pontos: jogo todo, 1º/2º tempo, por quarto. Demais: só jogo todo |

Para cada estatística, quando fizer sentido: total (dos dois times), do time (feitos), sofridos (adversário). Uma opção de período sem dado na fonte aparece desabilitada — nunca estimada.

### Etapa 2 (fora da v1, mas a arquitetura deve permitir)
Raio-X do jogo (pontos fortes/fracos), estatísticas do árbitro, props de jogadores (rankings por jogador), critérios com notificações no navegador.

## 3. Não-objetivos e anti-objetivos

**Não-objetivos:** odds e qualquer coisa de aposta (alerta de odd, melhores linhas, gestão de banca); serviços pagos; login/multiusuário; hospedagem na internet; outros esportes/ligas na v1; estatísticas por tempo além de gols/pontos; escanteios por faixa de minuto.

**Anti-objetivos (seria fracasso mesmo funcionando):**
- Mostrar dado inventado ou estimado como se fosse real.
- Mostrar dado velho como se fosse atual: telas ao vivo mostram "atualizado às HH:MM"; se a fonte falhar, o painel avisa em vez de exibir o último valor silenciosamente.
- Rankings sobre amostra incompleta sem avisar: sempre mostrar o nº de jogos considerados, e avisar enquanto a recuperação de jogos perdidos estiver em andamento.
- Copiar marca, logo ou identidade visual do StatsHub ou Sofascore. Inspiração de layout sim; identidade própria.

## 4. Abordagens consideradas

| | Fonte | Prós | Contras | Decisão |
|---|---|---|---|---|
| **A** | **ESPN** (endpoints JSON públicos usados pelo site/app, sem chave) como fonte principal; **football-data.co.uk** e **nflverse** para conferência | Grátis; dados oficiais da ESPN; cobre os 7 campeonatos, incluindo a Champions; ao vivo, agenda, lances, escalações, classificação, estatísticas por jogo e box score | Não é produto oficial com contrato: pode mudar sem aviso; sem estatísticas por tempo além de gols/pontos | **Escolhida**: o usuário exige tudo grátis, com fontes confiáveis |
| B | API-Sports: só futebol (~US$ 19/mês) + ESPN, ou os três esportes (~US$ 50/mês) | Serviço comercial documentado e completo | Pago; o plano grátis não libera a temporada atual (só 2022–2024) | Rejeitada: o usuário não quer nada pago |
| C | API interna do Sofascore | Dados mais ricos (notas, pressão, mapa de calor) | Não oficial, contra os termos, bloqueia acessos | Rejeitada |

Uso das fontes de conferência: football-data.co.uk (Premier, La Liga, Serie A, Bundesliga) e nflverse (NFL) servem para validar os números da ESPN e, se a ESPN falhar em algum jogo histórico, completar a lacuna, desde que o dado seja equivalente. A Champions e a NBA dependem só da ESPN.

## 5. Decisões de como construir (chamadas do Claude, corrigíveis)

- **Backend:** Python 3.12 + FastAPI, rodando localmente, escutando em `0.0.0.0` para acesso pelo celular na rede local.
- **Execução em segundo plano:** o servidor sobe junto com o Windows (tarefa agendada no logon, sem janela) e grava os jogos assim que terminam. Um atalho abre o painel no navegador. Se o PC ficar desligado, ao subir ele roda a **recuperação**: busca jogos encerrados desde a última execução sem estatísticas finais e atualiza agenda e classificações. Enquanto isso, a tela mostra o progresso e os rankings avisam que a amostra está sendo completada.
- **Banco:** SQLite (arquivo local). Guarda jogos, times, ligas, classificações, estatísticas por jogo/time/período, eventos, escalações e favoritos. Rankings são consultas SQL sobre esse histórico.
- **Frontend:** React + TypeScript + Vite; o build vira arquivos estáticos servidos pelo próprio FastAPI. Tema escuro padrão, claro opcional; responsivo.
- **Camada de fonte de dados isolada:** um adaptador por fonte convertendo para um modelo interno único. Se a ESPN mudar ou for trocada, só o adaptador muda.
- **Sincronização (enquanto o servidor estiver aberto):**
  - Carga inicial: temporada atual e anterior dos 7 campeonatos (jogos + estatísticas dos encerrados). Sem cota, mas com intervalo entre requisições para não sobrecarregar a fonte; pode levar algum tempo, com progresso visível.
  - Ao vivo: consulta a cada ~30 s somente enquanto houver jogo ao vivo.
  - Pós-jogo: ao terminar um jogo, busca estatísticas, eventos e box score finais.
- **Histórico:** "Últimos 5/10/15/20" contam os jogos mais recentes, mesmo atravessando de uma temporada para a outra; o filtro "Temporada" usa só a atual. O H2H é buscado quando o jogo é aberto, com cache.
- **Competições misturadas nos rankings de times:** com a liga em "Todas", contam todos os jogos do time nos campeonatos cobertos (ex.: La Liga + Champions). Com uma liga escolhida, contam só os jogos dela. A forma recente segue o mesmo filtro.
- **Favoritos:** guardados no servidor, iguais no PC e no celular.
- **Fuso:** horários em America/Sao_Paulo.

## 6. Pontos a confirmar na fonte (primeira tarefa do plano)
1. Para cada esporte, quais estatísticas de time os endpoints da ESPN trazem por jogo, e com quais nomes.
2. Até quantas temporadas para trás a ESPN entrega jogos e estatísticas dos 7 campeonatos.
3. Se o H2H e o placar do jogo de ida vêm prontos ou precisam ser montados a partir do histórico.

Estatística que não existir de forma consistente na fonte sai da v1 e o usuário é informado; não se substitui por estimativa.

## 7. Deixado para o construtor
Estrutura de pastas, esquema exato das tabelas, componentes de UI, biblioteca de gráficos (se precisar), estratégia de testes, porta do servidor, intervalo entre requisições da carga, visual (cores/tipografia próprias, inspirado no protótipo em `prototipo/painel.html` e nos prints do StatsHub, sem copiar a marca).

## 8. Revisão (2026-11-19): acesso pelo celular sem o notebook

O usuário quer abrir o painel no celular sem depender do notebook ligado. O painel continua sendo de **uso só dele** (não será compartilhado).

**Fato que viabiliza:** a API da ESPN responde com `Access-Control-Allow-Origin: *`, então o navegador do celular pode buscar os dados direto nela.

**Abordagens consideradas:**
| | Como | Decisão |
|---|---|---|
| **A** | Site estático grátis (GitHub Pages); o navegador busca placares, agenda, classificação e detalhes direto na ESPN; rankings (Plano 3) gerados 1×/dia por GitHub Actions e publicados como JSON junto do site | **Escolhida** |
| B | Servidor sempre ligado grátis (Oracle Cloud Always Free) rodando o código atual | Rejeitada: pede cartão, exige manter um servidor Linux, risco de desligamento |
| C | Notebook + Tailscale | Rejeitada: continua dependendo do notebook ligado |

**O que muda no design:**
- O **frontend deixa de depender do servidor**: uma camada de dados no próprio navegador busca a ESPN, interpreta (mesmas regras do parser Python: status, placar, campanha, posição) e aplica os mesmos avisos de dado desatualizado/falha por liga.
- **Favoritos** ficam no próprio aparelho (armazenamento do navegador); não sincronizam entre celular e notebook. Aceito pelo usuário.
- **Hospedagem:** repositório público no GitHub do usuário + GitHub Pages, publicado por GitHub Actions a cada push. Endereço `https://<usuario>.github.io/painel-esportivo/`, sem divulgação. Commits com o e-mail anônimo do GitHub (o e-mail pessoal não pode ficar público).
- Instalável na tela inicial do celular (manifesto web com ícone e nome).
- **Backend Python:** deixa de ser necessário para a tela. Passa a ser a base do job diário de histórico/rankings do Plano 3 (rodando no GitHub Actions). O servidor local e a tarefa de inicialização podem ser desligados quando o site estiver no ar (decisão do usuário).
- Anti-objetivos continuam valendo: nada estimado, aviso quando uma liga falha ou o dado está velho.
