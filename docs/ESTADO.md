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
| 4 | Competição → `src/competicao/` (Jogos, MatchModal, FichaJogo, Escalacao, Convocatorias, Classificacao, RelatoriosJogo, MatchDashboard, dados); partilhados → `dominio/` (plantel, estatisticas, convidados, estadoJogos), `base/` (partilha, ui-extra), `tatico/impressaoCampo.jsx`. Função nova `consumirMissaoPendente()` (Tarefas limpa o pedido de missão) | feito, à espera de "ok" |
| 5 | Treino: Planeamento, Exercícios, Sessões, Ideia de jogo | por fazer |
| 6 | Plantel: Plantel, Presenças, Monitorização, Desenvolvimento, Clínico | por fazer |
| 7 | Scouting, Diário, Tarefas, Gestão de equipa | por fazer |
| 8 | Atleta: Portal, Check-in, Cacifo | por fazer |

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

Provas feitas no passo 1, a repetir nos seguintes:
- as linhas de código antes e depois são as mesmas (58.885), só mudam as
  importações;
- o verificador dá 0 problemas, compila, e o tamanho da app é igual;
- a app antiga e a nova, arrancadas com um Supabase fictício (sem rede),
  mostram o mesmo nas páginas `/`, `/app/` e `/portal/`, nos temas escuro
  e claro, sem erros.

**A seguir à divisão (combinado a 12/11):** rascunhos nos formulários
longos (Diário, Sessões, relatórios e notas de jogo, Tarefas, Scouting,
Desenvolvimento individual). Hoje só existem em Exercício, Ideia de jogo
e Dinâmica tática (`useRascunho`, em `base/sincronizacao.jsx`). Os
rascunhos ficam no dispositivo: nas áreas sensíveis (clínico, diário)
apagam-se ao sair da sessão e nunca ficam em dispositivos de atletas.
Fica num passo próprio, sem misturar com a divisão.

**Também a seguir à divisão:** "Criar clipe" na Biblioteca para vídeos
carregados como ficheiro. Hoje só existe para o YouTube (cortes com início
e fim sobre o vídeo, sem cortar ficheiro). Fazer o mesmo para ficheiros,
com as mesmas ferramentas (desenhos, paragens, partilha).

Depois, como decisão à parte: carregar cada área só quando é usada, o que
reduz o peso inicial da app e do Portal.

## Correções fora da divisão (commits próprios)

- 12/11: Monitorização → "Plantel — estado atual": a coluna Estado passa a
  mostrar primeiro o boletim clínico (ocorrência aberta hoje: Indisponível,
  Condicionado ou Vigilância, com o resumo ao passar o rato). Sem
  ocorrência, decide o wellness como antes.

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
6. **Partir o `App.jsx`:** em curso.

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
