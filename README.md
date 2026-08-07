# Época App — SC Salgueiros U19

## O que mudou para ficar pronto a publicar
O `window.storage` (só existe dentro do Claude) foi trocado por `localStorage`
do próprio browser. Continua a guardar tudo "neste dispositivo", exatamente
como antes — só que agora funciona em qualquer browser/telemóvel.

## Publicar no Vercel (recomendado, grátis)

**Opção A — sem terminal, só com GitHub**
1. Cria uma conta em github.com (se não tiveres).
2. Cria um repositório novo (ex: `epoca-app`) e faz upload desta pasta toda
   (arrasta os ficheiros para a página do GitHub, "Add file → Upload files").
3. Vai a vercel.com → "Add New Project" → autoriza o Vercel a aceder ao
   GitHub → escolhe o repositório `epoca-app`.
4. O Vercel deteta automaticamente que é um projeto Vite. Não mudes nada,
   clica "Deploy".
5. Em ~1 minuto tens um link tipo `epoca-app.vercel.app`, já em HTTPS,
   que funciona em qualquer browser e telemóvel (Android e iPhone).
6. Sempre que atualizares o repositório no GitHub, o Vercel publica
   automaticamente a nova versão.

**Opção B — com terminal (mais rápido se já usas linha de comandos)**
```
npm install -g vercel
cd epoca-app
vercel          # primeira publicação (perguntas simples, aceita os defaults)
vercel --prod   # publicações seguintes
```

## Alternativas ao Vercel
- **Netlify** — processo quase idêntico ao Vercel (liga o GitHub, deploy automático). Igualmente bom.
- **Cloudflare Pages** — mesma ideia, rede da Cloudflare, também grátis.
- **GitHub Pages** — grátis mas dá mais trabalho a configurar rotas; só compensa se já usas GitHub Actions.

Vercel e Netlify são a forma mais simples para quem não é programador de
formação — daí a recomendação.

## Usar como "app" no telemóvel (sem loja de apps)
Depois de publicado, o site já é uma PWA instalável:
- **Android (Chrome):** abre o link → menu (⋮) → "Adicionar ao ecrã principal".
- **iPhone (Safari):** abre o link → ícone de partilha → "Adicionar ao ecrã principal".

Fica com ícone próprio e abre em ecrã inteiro, sem barra do browser.

## Multi-utilizador com Supabase — espaço partilhado (já configurado no código)

Toda a equipa técnica (Mister JP, Fábio, Nuno, ou quem mais precisares)
entra com a sua própria conta, mas **todos veem e editam os mesmos dados
da época** — plantel, sessões, jogos, etc. Cada bloco de dados guarda quem
foi a última pessoa a editá-lo e quando, visível na Visão Geral, num
cartão "Última atividade". As alterações aparecem aos outros em tempo
real (não é preciso recarregar a página).

### 1. Criar o projeto Supabase
1. Vai a supabase.com → "New project".
2. Escolhe nome, palavra-passe da base de dados e região (Europe se possível).
3. Espera ~2 minutos até o projeto ficar pronto.

### 2. Criar as tabelas e as regras de acesso
1. No painel do projeto, vai a "SQL Editor" → "New query".
2. Cola o conteúdo do ficheiro `supabase/schema.sql` (vem nesta pasta) e
   clica "Run".
3. Isto cria uma tabela por secção (jogadores, sessões, jogos, ...) mais
   uma tabela de histórico (`audit_log`), ativa o tempo real, e dá acesso
   de leitura/escrita a qualquer conta autenticada — é isto que faz o
   espaço ser partilhado por toda a equipa técnica, com o registo de quem
   editou o quê ao nível de cada jogador/sessão/jogo individual.

Se já tinhas corrido uma versão anterior deste schema (com uma tabela
única `app_storage`), este script apaga-a e recria tudo no novo formato.
Se já lá tens dados importantes que não queres perder, avisa-me antes de
correr o script — preparamos uma migração em vez de um apagar.

### 3. Ativar o login por email
1. Vai a "Authentication" → "Providers" → confirma que "Email" está ativo
   (vem ativo por omissão).
2. Opcional: em "Authentication" → "Settings", podes desligar "Confirm
   email" se quiseres que as contas fiquem ativas de imediato, sem
   confirmação por email (mais simples para uma equipa pequena e fechada).

### 4. Ligar a app à tua conta Supabase
1. Em "Project Settings" → "API", copia o "Project URL" e a chave "anon public".
2. Cria um ficheiro `.env` na raiz do projeto (usa o `.env.example` como
   modelo) e cola os dois valores:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=a-tua-chave-anon-public
   ```
3. No Vercel, adiciona as mesmas duas variáveis em "Project Settings" →
   "Environment Variables", e faz novo deploy (Vercel → "Deployments" →
   "Redeploy").

### 5. Criar utilizadores
Cada pessoa da equipa técnica abre a app publicada, clica "Ainda não tens
conta? Cria uma", mete o email e uma palavra-passe, e fica com acesso ao
mesmo espaço de trabalho. Se preferires ser tu a controlar quem entra,
desativa os registos livres em "Authentication" → "Settings" e cria as
contas manualmente em "Authentication" → "Users" → "Add user".

### Como funciona o "quem editou por último" (por registo individual)
Cada secção (Plantel, Sessões, Jogos, ...) passou a guardar **uma linha
por registo** (um jogador, uma sessão, um jogo) em vez de um bloco único —
por isso a app sabe exatamente qual jogador/sessão/jogo mudou, quem mudou,
e quando. Isso aparece em dois sítios:

- **Visão Geral → "Última atividade"**: resumo por secção (ex: "Plantel ·
  fabio@... · há 12 min").
- **Plantel → ícone de relógio em cada jogador**: abre o histórico
  completo desse jogador — todas as edições, quem as fez, e mesmo os
  campos exatos que mudaram (ex: `posição: MC → MDC`). Este histórico
  nunca se perde, mesmo que o registo seja apagado depois.
- Tudo isto chega **em tempo real** a toda a gente com a app aberta.

O mesmo padrão (tabela por registo + histórico completo) já está pronto
no backend para todas as secções — Sessões, Jogos, Convocatórias,
Scouting, Vídeos, Monitorização, Diário e Exercícios. Só o ecrã de
Plantel tem, por agora, o botão de histórico ligado na interface (era o
exemplo que deste). Diz-me em que outros ecrãs queres o mesmo botão que
eu ligo — é rápido, porque a parte difícil (a base de dados) já está
feita para todos.

## Segurança — o que já está feito e o que falta configurar
- **Ficheiro `.gitignore` incluído**: garante que o `.env` (com as tuas
  chaves Supabase) nunca é enviado para o GitHub por engano.
- **RLS ativo em todas as tabelas**: sem sessão iniciada, ninguém lê nem
  escreve nada — mesmo que alguém descubra a URL do teu Supabase.
- **A chave usada no browser é sempre a "anon public"**, nunca a
  "service_role" (essa dá acesso total e nunca deve sair do backend).

**O que precisas de configurar tu, no painel do Supabase (não dá para
fazer por código):**
1. **Authentication → Settings → desativar registos públicos** (ou deixar
   ativo só temporariamente enquanto crias as contas da equipa técnica, e
   desligar depois). Isto é o mais importante: como o espaço é
   partilhado, qualquer conta criada vê todos os dados do clube — não
   queres que seja alguém de fora a criar-se sozinho.
2. **Authentication → Settings → "Leaked Password Protection"**: ativa,
   se disponível no teu plano — bloqueia palavras-passe que já apareceram
   em fugas de dados conhecidas.
3. Mantém o repositório do GitHub **privado** (não público), para o
   código-fonte não ficar visível a qualquer pessoa.

## Sobre proteger a ideia em si (não só o acesso)
Isto já é mais uma questão legal do que técnica, e não sou advogado —
para algo com peso (registo de marca, contratos com colaboradores,
proteção de propriedade intelectual do modelo de negócio), vale a pena
falar com um advogado especializado em propriedade intelectual/direito
digital em Portugal.

Do lado técnico, há um limite real: uma aplicação web corre no browser de
quem a usa, o que significa que o código (HTML/JS) é sempre visível a
quem souber olhar (inspecionar elemento, separador "Network"). Isto é
inerente a qualquer site ou app web, não é uma falha desta app em
particular. O que dá para fazer:
- O código já sai **minificado** no build de produção (`npm run build`),
  o que dificulta ligeiramente a leitura, mas não impede alguém
  determinado.
- O que **não** é visível de fora é a tua base de dados, a lógica do
  Supabase (schema, triggers, RLS) e os dados reais — isso está protegido
  como descrito acima.
- Ideias e conceitos de negócio, por si só, não se protegem por copyright
  (só a expressão concreta — o código, os textos, o design). Nome e marca
  podem ser protegidos por registo de marca; funcionamento técnico
  específico, por vezes, por patente (raro em software de gestão); e
  relações com colaboradores/investidores, por contratos de
  confidencialidade (NDA).
```
npm install
npm run dev       # abre em localhost, com recarregamento automático
npm run build     # gera a versão final em /dist
```
