# MisterJP: estado do trabalho

Lê isto primeiro, em qualquer conta ou sessão, antes de mexer no código.
Atualiza-se no fim de cada passo. Última atualização: 12/11/2026.

## Regra n.º 1

Todas as alterações protegem as funções que já existem. Sem regressões,
sempre como prioridade. Cada mudança é a mínima necessária, compila, passa
o verificador e é testada pela Adelaide antes de avançar.

## Como se trabalha (até os repositórios serem ligados ao Claude)

Há **dois repositórios**, ambos no GitHub Desktop da Adelaide:
- **misterjp:** a app (Vercel), as funções `api/`, o Modal (`modal/`) e
  os SQL (`supabase/`);
- **video-worker:** o serviço de vídeo no Railway.

Cada passo diz sempre a que repositório pertence.

1. **Partir sempre do que está no GitHub.** No início de cada passo, a
   Adelaide faz "Fetch origin" e "Pull" no GitHub Desktop. Se o último
   commit do histórico for o do passo anterior deste trabalho, a sessão
   continua da sua cópia. Se houver commits de outra conta ou sessão, a
   Adelaide comprime a pasta do repositório **sem** `node_modules`, `.git`
   e ficheiros `.env` (em "Repository → Show in Finder/Explorer") e envia-a,
   e parte-se dela. Nunca se parte de cópias antigas.
2. O Claude devolve um `.zip` com os ficheiros e pastas alterados, na
   mesma estrutura do repositório.
3. A Adelaide copia esse conteúdo para a pasta do repositório,
   substituindo o que lá está. No GitHub Desktop, confirma na lista de
   alterações que só mudou o que o passo diz, escreve o resumo do passo,
   faz "Commit to main" e depois "Push origin". O histórico do GitHub
   Desktop permite reverter um passo ("Revert changes in commit").
4. A Vercel (misterjp) ou o Railway (video-worker) publica sozinho. A
   Adelaide testa a lista do passo e diz "ok". Só depois se avança.
5. Nunca duas contas ou sessões a mexer no mesmo passo ao mesmo tempo.

## Verificações obrigatórias em cada entrega

- `npm run verificar`: **0 problemas**. Acusa nomes usados sem estarem
  definidos ou importados no ficheiro. A app compila na mesma com esse
  erro e só rebenta quando alguém abre o ecrã, por isso este verificador
  é a rede de segurança principal da divisão do `App.jsx`.
- `npx vite build`: compila sem erros. Os avisos "Duplicate key" já
  existiam e não rebentam a app.
- As páginas `/`, `/app/` e `/portal/` abrem sem erros de JavaScript. O
  erro "supabaseUrl is required" sem o `.env` é esperado.
- Lista de testes do passo, feita pela Adelaide com sessão iniciada.

Referência antes da divisão: `main` com 2.488 kB (723 kB comprimido),
`App.jsx` com 62.101 linhas, verificador com 0 problemas.

## Plano em curso: partir o `App.jsx` (ponto 6)

Só se muda código de sítio: nenhuma lógica muda. (A Competição passou à frente do Treino porque o Planeamento abre fichas de jogo: assim não há ficheiros a depender uns dos outros em círculo.) Cada ficheiro novo só
ganha as importações de que precisa. Ordem combinada:

| Passo | O que sai do `App.jsx` | Estado |
|---|---|---|
| 0 | Nada. Verificador, este ficheiro, servidor do Modal e SQL no repositório | feito |
| 1 | Base → `src/base/`: `tema.jsx`, `utilidades.js`, `ui.jsx`, `sincronizacao.jsx` | feito |
| 2 | Tático → `src/tatico/` (campo, DiagramEditor, QuadroTaticoLivre, Simulador, prancheta); regras partilhadas → `src/dominio/` (jogadores, clínico, jogos, treino); `base/impressao.js`, `base/arrastar.js` | feito |
| 3 | Média → `src/media/` (MediaLibrary, MediaModal, LeitorJunto, leitores, social, organização, ações); `base/anexos.jsx`, `base/kiosk.js` | feito |
| 4 | Competição → `src/competicao/` (Jogos, MatchModal, FichaJogo, Escalacao, Convocatorias, Classificacao, RelatoriosJogo, MatchDashboard, dados); partilhados → `dominio/` (plantel, estatisticas, convidados, estadoJogos), `base/` (partilha, ui-extra), `tatico/impressaoCampo.jsx`. Função nova `consumirMissaoPendente()` (Tarefas limpa o pedido de missão) | feito |
| 5 | Treino → `src/treino/` (Planeamento, SessionModal, Exercicios, ExerciseModal, ExercisePresentation, IdeiaJogo, IdeiaModal, EscolherParaCopiar, diagramas, comum); `plantel/Prancheta.jsx`; partilhados `dominio/relato.jsx`, `base/historico.jsx`, `base/botoes.jsx`, `media/pdf.jsx` | feito |
| 6 | Plantel → `src/plantel/` (Plantel, PlayerProfilePage, PlayerModal, avaliacao, Desenvolvimento, Clinico, clinicoDados, Presencas, Monitorizacao, Gps, Composicao, Historico, CheckinManual, comum); questionários do quiosque → `atleta/questionarios.jsx`; partilhados `base/fotos.jsx`, `dominio/mensagens.js`, `dominio/faltas.jsx` | feito |
| 7 | `src/scouting/` (Scouting, Necessidades, ScoutSheet, comum), `src/adversarios/`, `src/tarefas/` (Tarefas, TarefaModal, MissaoModal, Calendario, regras, missoesRegras), `src/diario/Diario.jsx`, `src/gestao/` (GestaoEquipa, membros, documentos Word/Excel); `base/subcolecao.js`, `dominio/aniversarios.js` | feito |
| 8 | Atleta → `src/atleta/`: CheckinApp (entrada do Portal e o arranque instalável), PortalEntrada (porta, cartão, PIN, biometria), temaPorta, CheckinKiosk, CheckinLogin, KioskHome, balneario, ecras (aniversário, jogo, missão), Cacifo, vistas (treino, biblioteca, jogos, competição, desenvolvimento, tarefas), separadoresJogo (convocatória, plano de jogo, adversário, ideia de jogo), VisualizadorVideoPortal, portalRpc, janelas; partilhados `base/formatos.js`, `base/equipaGuardada.js` | feito |

### Como se move código (ferramenta usada no passo 1)

A divisão faz-se com uma ferramenta que lê o código (não à mão):
- leva cada bloco de topo com os comentários de cima, pela ordem original;
- gera as importações de cada ficheiro novo e do `App.jsx`;
- **recusa** se um ficheiro novo usar algo que fica no `App.jsx`, se
  houver ciclos entre ficheiros novos, ou se uma variável `let` for
  alterada fora do ficheiro onde vai ficar. Nesse caso cria-se uma função
  para a alterar. No passo 1: `definirModalHandoff()`, em `base/ui.jsx`.
- as instruções soltas de topo (ex.: aplicar o tema claro) vão com o
  módulo de que dependem.

No passo 8 a ferramenta passou a aceitar `__soltas__` no plano (linha de
início → módulo) para as instruções soltas que não usam nada do topo (a
fonte do Cacifo e os estilos do Portal), que de outra forma ficavam no
`App.jsx`.

Provas feitas no passo 1, a repetir nos seguintes:
- as linhas de código antes e depois são as mesmas (58.885), só mudam as
  importações;
- o verificador dá 0 problemas, compila, e o tamanho da app é igual;
- a app antiga e a nova, arrancadas com um Supabase fictício (sem rede),
  mostram o mesmo nas páginas `/`, `/app/` e `/portal/`, nos temas escuro
  e claro, sem erros.

**Rascunhos nos formulários longos (13/11, à espera de "ok"):**
`useRascunho` (em `base/sincronizacao.jsx`) passa a ser usado também em
Sessão, Jogo, Relatório de jogo, Tarefa, ficha de Scouting, Diário e
Boletim Clínico (nova ocorrência e atualização/alta/recaída), além de
Exercício, Ideia de jogo e Dinâmica tática. Regras novas do rascunho:
só se guarda com alterações reais (o que a app preenche no primeiro meio
segundo conta como ponto de partida); chave com a equipa ativa (os
rascunhos antigos passam para a chave nova); esquecido aos 14 dias;
grava logo ao fechar ou esconder a página. Áreas sensíveis
(`{ sensivel: true }`: Diário e Clínico): apagam-se ao sair da sessão
(`limparRascunhosSensiveis`, no evento SIGNED_OUT), duram no máximo 12 h e
nunca se guardam em páginas do Portal/Check-in.
Ficaram de fora, de propósito: Desenvolvimento individual (cada resposta
já se grava na hora), notas de jogo (texto curto) e MissaoModal (estado
repartido; ver depois, se fizer falta).

**Também a seguir à divisão (13/11), junto com as "Fotos Fase B":**
enquadrar a foto do jogador sem perder a original. Hoje, "Usar" guarda só
o recorte (512 px) e o "Ajustar" seguinte trabalha sobre o recorte (não
dá para afastar). Guardar a original no Storage privado (link temporário)
e a posição/zoom do enquadramento, e o "Ajustar" parte sempre da original.
Não guardar a original dentro da ficha do jogador (pesava o plantel em
todos os ecrãs e no Portal).

**Vídeos carregados = vídeos por link (13/11, à espera de "ok"):** um vídeo
carregado (público, link http) usa o MESMO leitor da Biblioteca que o
YouTube (`temLeitorBib`, `eVideoFicheiroBib`): um `<video>` no lugar do
iframe, e `enviarComandoYoutube` traduz os quatro comandos (saltar, tocar,
pausar, velocidade) para ele; os eventos do vídeo fazem de 'infoDelivery'.
Por isso tudo é igual: barra própria (tempo do corte), Criar clipe, cortes
em seguida, Repetir / Clipe seguinte, desenhos e paragens, ecrã inteiro,
miniaturas (fotograma do ficheiro). O clipe aponta para o MESMO ficheiro
(`clipNoFicheiro`), sem copiar nada no Storage. Partilhar o link envia o
ficheiro com `#t=início,fim`. 2.ª parte (13/11): `LeitorJunto` ("Os meus vídeos" e a página pública do
vídeo junto) toca segmentos de ficheiro (`src`) além do YouTube; o link
`?junto=` leva o link do ficheiro, e a página pública só aceita ficheiros
do Storage público deste projeto (`ficheiroDaApp`). No Portal, o atleta
pode criar clipes sobre vídeos carregados e os clipes de ficheiro entram
em "Os meus clipes" (`clipeAtletaParaCanal` lê `dataUrl`). Servidor:
`supabase/migracoes/2026-11_05_clipes_em_ficheiros.sql` muda só
`checkin_clipe_criar` (aceita vídeo carregado; o clipe guarda o `dataUrl`
do vídeo gravado na base, nunca do pedido, e `clipNoFicheiro`) e
`video_publico` (segmentos com `src`). As outras funções já devolvem o
`data` inteiro e não mudam. Testado num Postgres local com as definições
reais (YouTube, ficheiro, corte de ficheiro aceites; clipe da Análise e
base64 recusados). No staff, a "Análise individual em clipes"
(`ClipAtletaModal`) também toca clipes de ficheiro e partilha o troço.
Gravar/descarregar clipes de vídeos carregados (sem desenhos): já não
grava o ecrã — `media/gravarFicheiro.js` toca cada troço num <video>
escondido, copia para um canvas e grava (MediaRecorder), só a imagem e o
som. Se o Storage não deixar ler a imagem (CORS), avisa e o clique
seguinte usa a gravação do separador como antes. Com desenhos ou com
cortes do YouTube continua a gravação do separador.
Partilhar (13/11): `base/escolherPartilha.js` é o único caminho. No
telemóvel, a folha do sistema (com o ficheiro do vídeo, quando há). No
computador, uma janela própria: WhatsApp (wa.me com a mensagem e o link),
Email (mailto com o link), Copiar link, Descarregar o vídeo, Outras apps.
A folha do Windows mostrava contactos vazios e abria o Outlook sem anexo.
Usado em: "Vídeo pronto" (`entregarVideo`), "Os meus vídeos", cortes e
clipes (`shareMediaItem`, `partilharLink`). A barra branca "A partilhar
este separador" é do Chrome e não se pode esconder: só aparece quando se
grava o separador (cortes do YouTube ou com desenhos).
"Vídeo pronto" de "Os meus vídeos": a partilha leva também o link do
vídeo junto (WhatsApp/Email enviam o link; o ficheiro descarrega-se para
anexar). Email abre numa janela à parte (com um site de email ligado ao
mailto, a página da app já não é substituída). `LeitorJunto`: num clipe de
ficheiro não há arranque escondido nem "entrar adiantado" (só YouTube) —
espera parado no início exato; a barra deixou de saltar na passagem. Vídeos privados: não há nada a
fazer, a Biblioteca guarda sempre no Storage público (o privado é só do
Diário).

**Também a seguir à divisão (pedido a 13/11):** a cor de destaque da app
(Definições) deve chegar a tudo o que hoje fica vermelho fixo: as barras de
escolha de jogadores, as pílulas dos separadores e os botões de adicionar
campos. Trocar o vermelho escrito no código pela cor do tema.

**Código que nada usa (visto no passo 8, fica para decidir depois):**
`CheckinLogin`, `sequenciaWellness`, `StreakCard`, `PkhSequencia`,
`PkhBotaoQuestionario`, `pkhXDoMinuto`, `pkhY`, `PKH_TICKER` (foram para
`src/atleta/` tal como estavam), `POTENTIAL_LEVELS` e `ESTADOS_TAREFA`
(ficaram no `App.jsx`). Confirmar e apagar num commit próprio.

Depois, como decisão à parte: carregar cada área só quando é usada, o que
reduz o peso inicial da app e do Portal.

## Correções fora da divisão (commits próprios)

- 12/11: Monitorização → "Plantel — estado atual": a coluna Estado passa a
  mostrar primeiro o boletim clínico (ocorrência aberta hoje: Indisponível,
  Condicionado ou Vigilância, com o resumo ao passar o rato). Sem
  ocorrência, decide o wellness como antes.
- 12/11: Ficha de jogo com onze no campo (impressão e partilha): passam a
  aparecer golos, assistências, cartões e saídas junto de cada titular;
  nos suplentes, entrada, quem substituíram (pelo minuto da saída),
  acontecimentos e minutos; a impressão ganha os Destaques.
  `EscalacaoPrint` aceita `extra(pid, 'campo'|'banco')`.
- 12/11: Relatórios de jogo: cada jogo tem atalhos para imprimir e
  partilhar a ficha do jogo (as mesmas do separador Jogos).
- 12/11: Ficha de jogo: substituição com ícone (círculo verde ↑ entra,
  vermelho ↓ sai) e assistência com chuteira dourada; na partilha, os
  acontecimentos dos suplentes ficam à direita do cartão.
- 13/11: "Copiar ideia/exercício existente": a pré-visualização cresce para
  mostrar o esquema e os botões inteiros (antes ficava com scroll).
- 13/11: Jogos (amigáveis e oficiais): quem tem minutos no relatório
  conta sempre como estando no jogo (`convocadosDoJogo` e `idsComMinutos`,
  em `dominio/jogos.js`): onze ou banco no "Editar jogo", ficha do jogo,
  relatório e estatísticas. Os cartões mostram os minutos.
  Risco visto no código (não foi a causa do DD): marcar L (Boletim →
  "Atualizar as presenças") ou falta/escalão nas Presenças tirava o
  jogador dos convocados, e a gravação seguinte
  (`podarPresencasForaDosConvocados`) tirava-o também do onze. Regras
  novas:
  · lesão no próprio dia do jogo: fica registada nesse dia, mas o jogador
    não sai do onze nem do banco desse jogo (não leva L nesse jogo) e só
    aparece como indisponível a partir do dia seguinte
    (`estadoClinicoParaJogo`, em `dominio/clinico.js`, usado no Editar
    jogo, na ficha e nas Convocatórias);
  · amigável: vão todos. Quem não está no onze é suplente (sem limite),
    fizesse ou não minutos; não há "Não convocados". À parte, só os
    indisponíveis e quem tem falta, L ou escalão marcado nas Presenças
    desse jogo (que no amigável já não se apagam ao gravar).
  Lugar vazio no "Editar jogo" (`competicao/historicoDoJogo.js`, lê o
  Relato): mostra quem lá estava, quando foi tirado e por quem, com "Repor
  no lugar". Se o jogador já não existe em lado nenhum (nem nos que saíram
  do clube), diz que foi APAGADO da app: `limparRastoDoJogador` tira-o de
  todos os jogos e deixa o lugar vazio, de propósito (RGPD). Foi o caso do
  DD do amigável com o UD Sousense (apagado a 21/10). Os apagados
  encontram-se em qualquer lugar do histórico (`apagadosDoOnze`, mesmo
  depois de uma troca de sistema) e o nome vem da linha "apagou" do
  Relato (`nomesDosApagados`).
  Retirado: o aviso "Rever e repor" em Jogos (RepararJogos), que adivinhava
  pelo histórico e propôs jogadores errados (Roque, Rui). A causa que eu
  tinha suposto para o DD (L/falta) não era a verdadeira.
  Minutos no campo num selo na foto (ao lado do nome encavalitavam).
- 13/11: Plantel → repor jogador APAGADO como "saiu do clube"
  (`plantel/RecuperarApagados.jsx`): a partir do Relato, refaz a ficha
  (mesmo id, data de saída = dia em que foi apagado, sem fotografia) e
  devolve-o aos jogos, treinos e convocatórias de onde a limpeza
  (`limparRastoDoJogador`) o tirou: lugar no onze (se livre; senão banco),
  titulares, convocados, presenças e, quando o histórico os guardou,
  minutos e notas (`report`). Não volta o que é de saúde (bem-estar, PSE,
  clínico, desenvolvimento): o histórico não guarda esses valores. Pedido
  para o João Passos (apagado a 21/10, devia ter saído do clube).
- 13/11: Documentos: os modelos saíam sem o emblema do clube (com a
  inicial ou o nome no lugar). O emblema é um endereço de outro site, e o
  browser não deixa ler os pixéis dessa imagem (CORS). Nova função
  `api/emblema.js`: vai buscar o emblema gravado na equipa do lado do
  servidor (sessão e membro da equipa; só https público, só imagens, até
  3 MB) e `carregarLogoEquipaParaDoc` usa-a quando a leitura direta falha.
- 13/11: Adversários: as bolas da estrutura habitual usam a cor do clube
  adversário no ecrã, na edição e na impressão (cores claras, como o
  branco ou o amarelo, levam contorno e texto escuro).
  `PrancheteDoPlantel` e `EditorPrancheta` aceitam `cor`.
- 12/11: Gravação (`base/sincronizacao.jsx`): erros de sessão ("JWT
  issued at future", "JWT expired") tentam de novo até 2 vezes, com uns
  segundos de intervalo, antes de mostrar o aviso.

## Pontos para a versão comercial

1. **Marca no código:** feito. "MisterJP" é o nome provisório e o nome da
   equipa aparece na Visão geral.
2. **Manifesto antigo:** mantido. Feito.
3. **RLS, funções e prémio:** feito. Os SQL estão em `supabase/migracoes/`
   e já foram corridos. Falta pôr o esquema real da base no repositório.
4. **Anexos fora da base:** feito. Buckets `anexos` (público, 70 MB) e
   `anexos-privados` (10 MB), com envio retomável acima de 6 MB e
   "fallback" para base64.
5. **Seguimento, fila, worker e limites:** feito (ver abaixo).
6. **Partir o `App.jsx`:** feito (13/11). O `App.jsx` passou de 62 101 para 5 499 linhas.

Pendentes já identificados: links que não expiram em `videos-clipes`
(bucket público); apagar ficheiros do Storage quando se apaga um atleta
(RGPD); fotos no Portal com links assinados (Fase B); retirar o
`server.js.js` do video-worker depois de confirmar que o Railway arranca
pelo `server.js`.

## Peças fora deste repositório

- **video-worker** (repositório próprio, no Railway, também no GitHub
  Desktop): o código real está
  em `server.js`; `server.js.js` é só um ponto de entrada provisório.
  Tem fila justa por equipa (`MAX_EM_PARALELO`) e o endereço `/estado`.
- **Modal**: o código está em `modal/servico_seguidor_v2.py`. Publica-se
  com `modal deploy modal/servico_seguidor_v2.py`. A Vercel aponta para
  ele pela variável `MODAL_SEGUIDOR_URL`. A versão aparece na resposta
  (`"versao"`). Atual: **2.8**.
- **Vercel**: `api/seguir-jogador.js` (limite mensal por equipa em
  `planos_equipa` e `uso_servicos`) e `api/cortar-clipe.js`.

## Aprendizagens que custaram a descobrir (não repetir)

- **Cortes começam antes do marcado.** O corte é feito sem recodificar
  (`-c copy`) e começa no fotograma-chave anterior, às vezes segundos
  antes nos vídeos Veo. `api/cortar-clipe.js` mede o início real
  (`inicioReal`) antes de cortar e corta até ao fim pedido. A app guarda
  `origemInicioReal` no corte e usa `inicioRealDoCorte(c)` para tudo o
  que liga tempos entre o corte e o jogo. Os cortes antigos são medidos
  sozinhos quando se abre o jogo completo.
- **Desenhar e seguir num corte faz-se sobre o ficheiro do corte**, no
  tempo do corte. No jogo completo, os desenhos e tubos dos cortes
  aparecem só para ver, sem cópia, e comportam-se como no corte
  (paragens, zoom do círculo, duração).
- **O seguimento (tubo) do vídeo completo fica gravado no vídeo**, no
  campo `seguimento`, como os desenhos.
- **Seguimento de jogador (Modal), versões 2.x:**
  - Os testes locais não reproduzem o detetor do Modal (GPU). Quando
    falhar, pedir a resposta com o `"diagnostico"` (motivo, segundo e quem
    estava perto) e repetir o caso com esses dados, em vez de adivinhar.
  - A regra da cor não pode tratar como troca alguém que passa À FRENTE
    do jogador. Só é troca se, ao lado, houver outro número com a cor
    dele (2.7).
  - O reconhecimento por aparência (ReID) foi testado e piorou. Não usar.
  - A retoma automática longa (4 s) apanhou jogadores errados. Na dúvida
    o tubo para, e o treinador continua com "Continuar seguimento".
  - A memória das deteções (`modal.Dict`) usa o caminho do vídeo sem o
    token, porque os links assinados mudam a cada pedido.
- **Testes de seguimento no Modal:** confirmar que a resposta traz a
  `"versao"` certa. Já houve testes feitos sem querer na versão antiga.
