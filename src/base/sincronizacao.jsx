// base/sincronizacao.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { supabase } from '../supabaseClient';
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { T, body } from './tema';
import { ACTIVITY_LABELS } from './utilidades';
import { Btn } from './ui';

// A Época é um registo único (não uma lista) — vive numa linha fixa
// (id='default') na tabela season_config.
/* Devolve { ok, value, editedBy, editedAt }. O `ok` é o que interessa.

   ISTO ERA UM CAMINHO REAL DE PERDA DE DADOS. Antes, uma leitura falhada
   devolvia o `fallback` — classificação vazia, época por omissão — sem
   distinção nenhuma de uma leitura bem-sucedida. Bastava o treinador
   mexer num campo a seguir para essa versão vazia ser gravada por cima da
   classificação verdadeira, com todas as jornadas e resultados da época.

   Ao contrário das coleções (onde o snapshot vazio impedia eliminações),
   aqui não havia nada a travar a escrita. Com `ok: false`, o hook não fica
   pronto e a gravação nunca chega a acontecer. */
/* REGISTO ÚNICO — MAS ÚNICO POR EQUIPA.

   A Época e a Classificação viviam numa linha fixa, `id='default'`. Com
   várias equipas isso deixa de funcionar: o `id` é chave primária da
   tabela inteira, portanto só podia existir uma no sistema todo — a
   segunda equipa a gravar a época esmagava a da primeira.

   A busca passa a ser pelo `team_id` e não pelo `id`. As linhas antigas
   mantêm o `id='default'` que já tinham (por isso `loadSingleton`
   devolve o id encontrado, para a gravação lhe voltar a acertar); as de
   equipas novas nascem com o id igual ao da equipa. Assim não é preciso
   migrar nada do que já existe. */
export async function loadSingleton(table, fallback, teamId) {
  try {
    // Token válido primeiro — sem ele a RLS aplica o papel `anon` e a
    // resposta vem vazia, sem erro. Ver a nota em ensureSession.
    const sessao = await ensureSession();
    if (!sessao) throw new Error('Sem sessão válida — o token expirou e não foi possível renovar.');
    if (!teamId) throw new Error('Sem equipa ativa.');

    const { data, error } = await supabase
      .from(table).select('id, data, updated_by_email, updated_at')
      .eq('team_id', teamId).maybeSingle();
    if (error) throw error;
    return data
      ? { ok: true, rowId: data.id, value: data.data, editedBy: data.updated_by_email, editedAt: data.updated_at }
      : { ok: true, rowId: null, value: fallback, editedBy: null, editedAt: null };
  } catch (e) {
    console.error('Falha ao carregar', table, e);
    reportReadError(table, e);
    return { ok: false, rowId: null, value: fallback, editedBy: null, editedAt: null };
  }
}

export async function saveSingleton(table, value, teamId, rowId) {
  try {
    if (!teamId) return;
    const { error } = await supabase.from(table)
      .upsert({ id: rowId || teamId, data: value, team_id: teamId }, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) {
    console.error('Falha ao guardar', table, e);
  }
}

// Versão genérica do padrão usado para a Época: carrega, grava (debounced
// pelo próprio efeito de mudança de valor) e escuta alterações em tempo
// real feitas por outra pessoa, para uma tabela de registo único
// (colunas id='default', data jsonb, updated_by_email, updated_at).
export function useSingletonSync(table, fallback, notifyEdit, teamId) {
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState({ email: null, at: null });
  // Id da linha desta equipa. Nulo até se saber — ver loadSingleton.
  const rowIdRef = useRef(null);
  /* CICLO INFINITO — o Supabase Realtime devolve-nos as NOSSAS próprias
     escritas. Como `row.data` chega sempre como um objeto novo, o
     setValue mudava a identidade do estado, o efeito de gravação
     disparava outra vez, gravava, o realtime devolvia... sem fim. O
     sintoma era a "Última atividade" a piscar com "agora mesmo"
     permanente. A solução é guardar a assinatura JSON do último valor
     sincronizado e ignorar tudo o que for igual — nos dois sentidos. */
  const syncedRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!teamId) { setReady(false); return () => { cancelled = true; }; }
    (async () => {
      const s = await loadSingleton(table, fallback, teamId);
      if (cancelled) return;
      rowIdRef.current = s.rowId;
      syncedRef.current = jsonEstavel(s.value);
      setValue(s.value);
      setMeta(s.editedBy ? { email: s.editedBy, at: s.editedAt } : { email: null, at: null });
      // Só fica pronto (= só autoriza gravar) se a leitura correu bem.
      if (s.ok) setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, teamId]);

  useEffect(() => {
    if (!ready) return;
    const signature = jsonEstavel(value);
    // Nada mudou de facto (ex.: veio do realtime, ou é o valor acabado de
    // carregar) — não voltar a gravar nem marcar nova atividade.
    if (signature === syncedRef.current) return;
    syncedRef.current = signature;
    saveSingleton(table, value, teamId, rowIdRef.current);
    if (!rowIdRef.current) rowIdRef.current = teamId;
    if (notifyEdit) notifyEdit(table);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready]);

  useEffect(() => {
    if (!teamId) return undefined;
    /* O filtro é do lado do servidor: sem ele receberíamos as alterações
       de todas as equipas e a época de outro clube entrava aqui. O nome
       do canal leva a equipa para que trocar de equipa crie um canal
       novo em vez de reaproveitar o antigo. */
    const channel = supabase.channel(`${table}_rt_${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `team_id=eq.${teamId}` }, (payload) => {
        const row = payload.new;
        if (!row) return;
        const signature = jsonEstavel(row.data);
        if (signature === syncedRef.current) return; // é o eco da nossa própria gravação
        syncedRef.current = signature;
        rowIdRef.current = row.id;
        setValue(row.data);
        setMeta({ email: row.updated_by_email, at: row.updated_at });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, teamId]);

  return [value, setValue, ready, meta];
}

// Hook genérico de sincronização para as listas (jogadores, sessões,
// jogos, ...). Cada registo da lista vira UMA LINHA na respetiva tabela,
// o que permite saber quem editou cada registo individual — não só "a
// lista mudou". Compara a lista atual com a última versão sincronizada
// e só grava (upsert/apagar) o que realmente mudou; as alterações feitas
// por outra pessoa chegam sozinhas via tempo real.
/* AVISO DE GRAVAÇÃO FALHADA — quando o Supabase recusa uma gravação (tabela
   em falta, permissões/RLS, ou payload demasiado grande, como acontece com
   ficheiros grandes guardados em base64), a app tem de o dizer. Sem isto o
   ecrã mostrava tudo bem e o conteúdo desaparecia no refresh seguinte. */
export const SYNC_ERROR_EVENT = 'mrjp-sync-error';

export function reportSyncError(table, error, kind = 'write') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, {
    detail: { table, kind, message: (error && error.message) || 'erro desconhecido' },
  }));
}

/* LEITURA FALHADA — o caso mais perigoso de todos, porque não parece um
   erro: parece que não há dados.

   Se a sessão expirou ou a RLS recusa a leitura, o Supabase devolve muitas
   vezes `data: []` SEM erro. A app mostrava "Sem exercícios" e o treinador
   concluía, com razão, que tinha perdido tudo — quando na verdade os
   registos estão intactos na base de dados e o que falhou foi o acesso.

   Daí valer a pena distinguir os dois casos e dizê-lo por palavras. */
export function reportReadError(table, error) {
  reportSyncError(table, error, 'read');
}

/* SESSÃO VÁLIDA ANTES DE LER — a correção da causa raiz.

   O que acontecia: o portão de autenticação monta a app assim que o
   getSession() responde, e a app dispara logo a seguir as treze leituras
   das treze tabelas, todas ao mesmo tempo. Se a app esteve fechada tempo
   suficiente para o token caducar, essas leituras saem antes de a
   renovação ter terminado — e uma leitura sem token válido não dá erro:
   o Postgres aplica a RLS do papel `anon` e devolve lista VAZIA.

   Daí o padrão exato que se via: `players`, `sessions` e `monitoring`
   continuavam a funcionar (têm política `anon`), e tudo o resto aparecia
   em branco.

   `getSession()` do supabase-js renova o token se estiver caducado, e
   devolve a sessão só depois disso. Esperar por ele antes de cada leitura
   custa milissegundos e fecha a corrida.

   A promessa é partilhada por todas as tabelas (não são treze renovações
   em paralelo, é uma só à qual todas se juntam). */
export let sessaoPendente = null;

export async function ensureSession() {
  if (!sessaoPendente) {
    sessaoPendente = supabase.auth.getSession()
      .then(({ data }) => (data && data.session) || null)
      .catch(() => null)
      .finally(() => { sessaoPendente = null; });
  }
  return sessaoPendente;
}

export function SyncErrorBanner() {
  const [err, setErr] = useState(null);
  useEffect(() => {
    const onErr = (e) => setErr(e.detail);
    window.addEventListener(SYNC_ERROR_EVENT, onErr);
    return () => window.removeEventListener(SYNC_ERROR_EVENT, onErr);
  }, []);
  if (!err) return null;
  return (
    <div style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 80,
      background: T.fundoErro, border: `1px solid ${T.bad}`, borderRadius: 10,
      padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
      boxShadow: '0 12px 40px #00000080', maxWidth: 620, margin: '0 auto',
    }}>
      <div style={{ flex: 1, ...body }}>
        <div style={{ color: T.bad, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {err.kind === 'read'
            ? `Não foi possível ler os dados (${ACTIVITY_LABELS[err.table] || err.table})`
            : `Não foi possível guardar (${ACTIVITY_LABELS[err.table] || err.table})`}
        </div>
        <div style={{ color: T.cream, fontSize: 12.5, lineHeight: 1.5 }}>
          {err.kind === 'read' ? (
            <>
              Esta secção pode aparecer vazia, mas <strong>os teus dados não foram apagados</strong> —
              o que falhou foi o acesso à base de dados. Sai da conta e volta a entrar.
              Enquanto isto durar, esta secção está bloqueada para escrita, para não gravar
              por cima do que lá está. Detalhe: {err.message}
            </>
          ) : (
            <>
              O que acabaste de introduzir está no ecrã mas NÃO ficou gravado — vai perder-se
              se recarregares a página. Detalhe: {err.message}
            </>
          )}
        </div>
      </div>
      <button onClick={() => setErr(null)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><X size={16} /></button>
    </div>
  );
}

/* Toda a leitura por aqui exige sessão válida — sem exceções.

   Houve um tempo em que o quiosque do questionário lia estas tabelas sem
   login e era preciso abrir uma exceção. Deixou de ser: o quiosque passou
   a usar as funções checkin_bootstrap/checkin_save (ver checkin_rpc.sql)
   e não toca em tabela nenhuma. Sem exceção, não há forma de contornar a
   verificação de sessão por engano. */
/* JSON ESTÁVEL — as chaves sempre pela mesma ordem, ordenadas
   alfabeticamente, tanto para objetos como para o que vier dentro de
   arrays; e os números sempre com a MESMA representação de texto.

   O Postgres (jsonb) NÃO guarda os campos na ordem em que foram
   escritos — pode devolvê-los canonicalizados numa ordem diferente da
   nossa. Comparar `JSON.stringify` normal (que respeita a ordem de
   inserção do objeto local) contra o que veio da base de dados dava
   "diferente" só por causa da ordem, mesmo quando o CONTEÚDO era
   exatamente igual — e isso fazia a gravação achar sempre que havia
   qualquer coisa por gravar, escrevendo o mesmo registo vezes sem
   conta, em ciclo.

   Ordenar as chaves não chegou sozinho: os diagramas das ideias têm
   dezenas de coordenadas decimais (posições de jogadores e setas), e
   um número como 0.1 pode voltar do Postgres escrito de forma
   ligeiramente diferente da nossa (mais ou menos casas decimais,
   ainda que o VALOR seja rigorosamente o mesmo) — e cada uma dessas
   pequenas diferenças de texto também contava como "isto mudou",
   mantendo o ciclo de reescrita vivo. Arredondar todos os números à
   mesma precisão antes de comparar tira essa última fonte de
   "diferenças" que não são diferenças nenhumas. */
export function jsonEstavel(valor) {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const chaves = Object.keys(valor).sort();
    return `{${chaves.map(k => `${JSON.stringify(k)}:${jsonEstavel(valor[k])}`).join(',')}}`;
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    // 9 casas decimais chegam e sobram para qualquer coordenada ou nota
    // desta app — é só para tirar ruído de vírgula flutuante, não para
    // arredondar valores a sério.
    return JSON.stringify(Math.round(valor * 1e9) / 1e9);
  }
  return JSON.stringify(valor);
}

/* LER TUDO, EM BLOCOS — nunca confiar no limite por omissão.

   O Supabase (PostgREST) devolve no máximo 1000 linhas por pedido, salvo
   se se disser o contrário — e isso não é um aviso, é simplesmente o que
   vem. Uma equipa com uma temporada de Wellness + PSE diários acumula
   isso depressa (30 jogadores × 2 registos por dia passam de 1000 em
   pouco mais de dois meses). Como a leitura ficava ordenada do mais
   antigo para o mais novo, ao passar dos 1000 registos os MAIS RECENTES
   — as respostas de hoje — ficavam sempre de fora, silenciosamente: sem
   erro nenhum, só ausentes. Foi isto que fez respostas gravadas
   corretamente nunca aparecerem como respondidas, por mais vezes que se
   desse refresh.

   A correção não é subir o limite (isso só adia o mesmo problema para
   quando a equipa acumular mais um tanto) — é ir buscar tudo, às fatias,
   até a última fatia vir mais pequena do que o pedido, o que só acontece
   quando já não há mais nada por trazer. */
export async function fetchAllRows(table, teamId) {
  const PAGE = 1000;
  let offset = 0;
  const todas = [];
  for (;;) {
    const { data, error } = await supabase.from(table)
      .select('id, data, updated_by_email, updated_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const pagina = data || [];
    todas.push(...pagina);
    if (pagina.length < PAGE) break;
    offset += PAGE;
  }
  return todas;
}

/* RASCUNHOS: guarda a edição em curso no localStorage deste dispositivo,
   para não se perder trabalho se saíres da página a meio (troca de
   separador, botão de retroceder do browser, fechar sem querer, a bateria
   acabar). Ao voltar a abrir o mesmo formulário, aparece a pergunta
   "Continuar rascunho / Começar do zero".

   Só local ao dispositivo: não sincroniza com o Supabase nem aparece para
   outras pessoas da equipa. É uma rede de segurança para ti, neste
   aparelho.

   Regras:
   · só se guarda quando há mesmo alterações (abrir e fechar sem mexer não
     deixa rascunho, nem pergunta da próxima vez);
   · a chave leva a equipa ativa: rascunhos de uma equipa nunca aparecem
     noutra, no mesmo aparelho;
   · apaga-se ao guardar (`limpar`) e ao escolher "Começar do zero";
   · rascunhos com mais de 14 dias são esquecidos;
   · ÁREAS SENSÍVEIS (`{ sensivel: true }`: Diário, Boletim Clínico): o
     rascunho apaga-se ao sair da sessão, dura no máximo 12 horas, e
     nunca se guarda em páginas do Portal/Check-in (aparelhos de atletas).
   · o que a app preenche sozinha no primeiro meio segundo (ex.: o
     próximo adversário da sessão) conta como ponto de partida;
   · ao fechar ou esconder a página, o que ainda não tinha sido guardado
     (os últimos 0,8 s) grava-se logo. */
const RASCUNHO_PREFIXO_SENSIVEL = 'mjp-rascunho-sensivel:';
const RASCUNHO_VALIDADE = 14 * 24 * 3600 * 1000;
const RASCUNHO_VALIDADE_SENSIVEL = 12 * 3600 * 1000;

function paginaDeAtleta() {
  try {
    const l = window.location;
    return /^\/portal(\/|$)/.test(l.pathname) || /[?&](portal|checkin)=/.test(l.search);
  } catch (e) { return false; }
}

export function limparRascunhosSensiveis() {
  try {
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(RASCUNHO_PREFIXO_SENSIVEL)) chaves.push(k);
    }
    chaves.forEach(k => localStorage.removeItem(k));
  } catch (e) { /* sem localStorage: nada a limpar */ }
}

// Ao sair da sessão (botão Sair, inatividade, sessão expirada), os
// rascunhos das áreas sensíveis desaparecem deste aparelho.
if (typeof window !== 'undefined') {
  try {
    supabase.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') limparRascunhosSensiveis(); });
  } catch (e) { /* sem cliente: os rascunhos sensíveis caducam sozinhos (12 h) */ }
}

export function useRascunho(chave, f, setF, ativo = true, opcoes = {}) {
  const sensivel = !!(opcoes && opcoes.sensivel);
  const ligado = ativo && !(sensivel && paginaDeAtleta());
  const equipa = T.equipaId || '';
  const chaveFinal = (sensivel ? RASCUNHO_PREFIXO_SENSIVEL : '') + chave + (equipa ? `@${equipa}` : '');
  const validade = sensivel ? RASCUNHO_VALIDADE_SENSIVEL : RASCUNHO_VALIDADE;
  const [rascunhoEncontrado, setRascunhoEncontrado] = useState(null);
  const verificada = useRef(null); // chave já lida nesta abertura
  const base = useRef(null);       // o formulário tal como abriu (JSON)
  const pendente = useRef(null);   // gravação à espera dos 0,8 s
  const abertoEm = useRef(0);

  // Ao abrir (ou ao mudar de registo): procura rascunho e fixa o ponto de partida.
  useEffect(() => {
    if (!ligado) { verificada.current = null; setRascunhoEncontrado(null); return; }
    if (verificada.current === chaveFinal) return;
    verificada.current = chaveFinal;
    base.current = jsonEstavel(f);
    abertoEm.current = Date.now();
    setRascunhoEncontrado(null);
    try {
      let bruto = localStorage.getItem(chaveFinal);
      // Rascunhos de antes desta regra (sem equipa na chave): passam para a chave nova.
      if (!bruto && !sensivel && equipa) {
        bruto = localStorage.getItem(chave);
        if (bruto) { localStorage.removeItem(chave); localStorage.setItem(chaveFinal, bruto); }
      }
      if (!bruto) return;
      const guardado = JSON.parse(bruto);
      const velho = !guardado || !guardado.f || Date.now() - (guardado.guardadoEm || 0) > validade;
      if (velho || jsonEstavel(guardado.f) === base.current) { localStorage.removeItem(chaveFinal); return; }
      setRascunhoEncontrado(guardado);
    } catch (e) { /* rascunho corrompido — ignora, como se não existisse */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFinal, ligado]);

  useEffect(() => {
    if (!ligado || verificada.current !== chaveFinal) return undefined;
    /* O que muda sozinho logo ao abrir (ex.: o próximo adversário que a
       sessão preenche) faz parte do ponto de partida, não é edição. */
    if (Date.now() - abertoEm.current < 500) { base.current = jsonEstavel(f); return undefined; }
    if (jsonEstavel(f) === base.current) { pendente.current = null; return undefined; }
    const gravar = () => {
      if (pendente.current !== gravar) return; // entretanto guardou-se ou descartou-se
      pendente.current = null;
      try { localStorage.setItem(chaveFinal, JSON.stringify({ f, guardadoEm: Date.now() })); } catch (e) { /* ex.: localStorage cheio — sem drama, só não fica rascunho desta vez */ }
    };
    pendente.current = gravar;
    const t = setTimeout(gravar, 800);
    return () => clearTimeout(t);
  }, [chaveFinal, f, ligado]);

  // Fechar o separador ou mudar de app no telemóvel: grava já o que faltava.
  useEffect(() => {
    if (!ligado) return undefined;
    const agora = () => { if (pendente.current) pendente.current(); };
    const aoEsconder = () => { if (document.visibilityState === 'hidden') agora(); };
    window.addEventListener('pagehide', agora);
    document.addEventListener('visibilitychange', aoEsconder);
    return () => { window.removeEventListener('pagehide', agora); document.removeEventListener('visibilitychange', aoEsconder); };
  }, [ligado]);

  const limpar = () => {
    pendente.current = null;
    base.current = jsonEstavel(f);
    try { localStorage.removeItem(chaveFinal); } catch (e) { /* nada */ }
  };
  const restaurar = () => { if (rascunhoEncontrado) { setF(rascunhoEncontrado.f); setRascunhoEncontrado(null); } };
  const descartar = () => { limpar(); setRascunhoEncontrado(null); };

  return { rascunhoEncontrado, restaurar, descartar, limpar };
}

// Banner mostrado quando se encontra um rascunho não guardado ao abrir um
// destes editores.
export function BannerRascunho({ rascunho, onRestaurar, onDescartar }) {
  if (!rascunho) return null;
  const minutos = Math.max(1, Math.round((Date.now() - (rascunho.guardadoEm || Date.now())) / 60000));
  const quando = minutos < 60 ? `há ${minutos} min` : `há ${Math.round(minutos / 60)}h`;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: `${T.gold}22`, border: `1px solid ${T.gold}`, borderRadius: 8,
      padding: '10px 12px', marginBottom: 14, fontSize: 13, color: T.cream, ...body,
    }}>
      <span style={{ flex: 1, minWidth: 200 }}>Encontrámos uma edição não guardada, de {quando}. Continuar dela ou começar do zero?</span>
      <Btn variant="solid" onClick={onRestaurar} style={{ padding: '6px 12px', fontSize: 12.5 }}>Continuar rascunho</Btn>
      <Btn variant="ghost" onClick={onDescartar} style={{ padding: '6px 12px', fontSize: 12.5 }}>Começar do zero</Btn>
    </div>
  );
}

export function useCollectionSync(table, notifyEdit, teamId) {
  /* `exercises` e `players` são, de longe, as coleções mais pesadas da
     app (fotografias de jogadores, diagramas/anexos de exercícios) —
     quase 5 MB combinadas, contra menos de 600 KB somando TODAS as
     outras. Isso não muda de 5 em 5 minutos, por isso não faz sentido
     recarregá-las por inteiro com a mesma frequência da rede de
     segurança normal (ver `INTERVALO_MINIMO`/o `setInterval` de 20 min,
     mais abaixo) — cada vez que alguém desbloqueava o telemóvel, estas
     duas tabelas sozinhas já pesavam mais do que as outras 11 juntas.
     Uma mudança a sério (nova foto, novo exercício) continua a chegar na
     hora a quem está a ver o ecrã, através do Realtime — isto só atrasa
     a REDE DE SEGURANÇA contra uma ligação morta, não o normal. */
  const COLECOES_PESADAS = { exercises: true, players: true };
  const ehPesada = !!COLECOES_PESADAS[table];
  const [items, setItems] = useState([]);
  /* Autorização de UMA remoção em massa (ver o travão de segurança mais
     abaixo). Fica num ref e não no estado porque não afeta o que se vê e
     tem de estar disponível na gravação seguinte, sem esperar por um
     novo desenho do ecrã. */
  const remocaoAutorizada = useRef(false);
  const [ready, setReady] = useState(false);
  const [recordMeta, setRecordMeta] = useState({}); // id -> { email, at }
  const snapshot = useRef(new Map()); // id -> JSON da última versão gravada
  /* IDs com uma gravação nossa em curso.

     Sem isto, carregar depressa na mesma célula fazia-a saltar para trás.
     A sequência: clico (falta) → grava; clico (escalão) → grava; e então
     chega o eco de Realtime da PRIMEIRA gravação, que traz "falta" e
     substitui o estado local, já em "escalão". O ecrã anda para trás
     sozinho e parece que o clique falhou.

     Enquanto uma gravação nossa estiver a decorrer, os ecos dessa linha
     são ignorados: o que temos localmente é mais recente do que qualquer
     coisa que o servidor nos possa devolver desse id. Os ecos de OUTRAS
     linhas, e de outros dispositivos, continuam a entrar normalmente. */
  const aGravar = useRef(new Set());
  /* UM CICLO DE GRAVAÇÃO DE CADA VEZ, nunca dois ao mesmo tempo.

     Marcar sete ideias visíveis de uma só vez (ver `alternarFase`)
     muda `items` uma vez, mas grava sete registos UM A UM (mais
     abaixo, de propósito — ver esse comentário). Enquanto o registo #1
     ainda está a gravar, o eco de Realtime da SUA PRÓPRIA escrita
     confirmada faz `setItems` disparar de novo — e o React volta a
     correr este efeito, com `items` a apontar para o mesmo objeto de
     sempre (ainda com os sete marcados) mas ainda a meio da primeira
     passagem pelo ciclo. Sem proteção, arrancava um SEGUNDO ciclo em
     paralelo com o primeiro, os dois a decidir "isto ainda não foi
     escrito" a partir do mesmo `snapshot` desatualizado — e conforme a
     ordem por que cada um chegava ao servidor, um dos dois podia achar
     que um registo já tinha mudado de outra forma e reescrevê-lo com
     um valor antigo. Era isto que fazia alguns itens "perderem" a
     marcação sozinhos, sem se tocar em mais nada.

     `aEscrever` deixa só UM ciclo ativo; se `items` mudar outra vez
     enquanto esse ciclo ainda decorre, fica um pedido pendente que o
     próprio ciclo relê no fim, em vez de arrancar um segundo em
     paralelo. */
  const aEscrever = useRef(false);
  const pedidoPendente = useRef(false);
  /* CONTADOR DE ESCRITAS NOSSAS CONFIRMADAS.

     Serve só para a rede de segurança do `apanharAtraso` saber se
     gravámos alguma coisa ENQUANTO ela estava a ler o servidor. Ver aí o
     motivo — é o que impede que uma leitura já desatualizada apague do
     ecrã registos criados no meio dela. */
  const escritasConfirmadas = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  /* A HORA (`updated_at`) de cada registo é a fonte de verdade mais
     fiável para saber se um eco do Realtime é mesmo mais recente do
     que o que já temos — mais fiável do que "vai um tempo desde que
     gravámos" (a proteção anterior, `aGravar` com um prazo), que podia
     ainda assim deixar passar um eco atrasado depois de várias
     gravações seguidas em pouco tempo. Um eco com uma hora IGUAL ou
     MAIS ANTIGA do que a que já temos localmente nunca é mais recente
     do que o que já sabemos — é sempre seguro ignorá-lo. */
  const ultimaHoraConhecida = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    /* TROCAR DE EQUIPA COMEÇA POR ESQUECER TUDO.

       Sem isto, os registos da equipa anterior ficavam em `items` até a
       nova leitura chegar — e, pior, no `snapshot`: a gravação seguinte
       compararia a lista nova com a antiga, concluiria que dezenas de
       registos "desapareceram" e tentaria apagá-los na equipa errada. O
       travão de eliminação em massa apanharia o caso, mas isto não pode
       depender de um travão. */
    snapshot.current = new Map();
    aGravar.current = new Set();
    setItems([]);
    setRecordMeta({});
    setReady(false);
    if (!teamId) return () => { cancelled = true; };
    (async () => {
      /* Três tentativas antes de desistir. Uma falha de rede a meio de um
         arranque não deve deixar a secção vazia para o resto da sessão. */
      let ultimo = null;
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        // Token válido primeiro; sem isto a leitura pode sair como `anon`
        // e o Postgres devolve lista vazia sem erro nenhum.
        const sessao = await ensureSession();
        if (cancelled) return;
        if (!sessao) {
          ultimo = { message: 'Sem sessão válida — o token expirou e não foi possível renovar.' };
          await new Promise(r => setTimeout(r, 400 * (tentativa + 1)));
          if (cancelled) return;
          continue;
        }

        /* O filtro por equipa está aqui E na RLS, de propósito. A RLS é
           a fronteira de segurança; este filtro é correção e velocidade —
           não traz para o browser o que não vai ser usado. Se um dia um
           deles falhar, o outro ainda segura.

           `fetchAllRows` (e não um `.select()` direto) — ver o comentário
           ao lado da função: sem paginação, uma tabela com mais de 1000
           registos perdia sempre os mais recentes. */
        let data, error;
        try {
          data = await fetchAllRows(table, teamId);
        } catch (e) {
          error = e;
        }
        if (cancelled) return;
        if (!error) {
          const rows = data || [];

          /* ZERO REGISTOS SEM ERRO — o caso silencioso.

             Quando o token expira ou a RLS recusa a leitura, o Supabase
             pode devolver uma lista vazia SEM erro nenhum. É
             indistinguível de "esta tabela está mesmo vazia", e é a
             explicação mais provável para conteúdo que "desaparece" e
             volta sozinho a seguir.

             Não conseguimos distinguir os dois casos pelo resultado, mas
             conseguimos perguntar se ainda há sessão válida. Se não
             houver, isto não é uma tabela vazia — é uma leitura falhada,
             e trata-se como tal (sem `ready`, portanto sem escrita). */
          if (rows.length === 0) {
            const sess = await ensureSession();
            if (cancelled) return;
            if (!sess) {
              reportReadError(table, { message: 'A sessão expirou durante a leitura.' });
              return;
            }
          }

          const snap = new Map();
          const meta = {};
          rows.forEach(r => {
            snap.set(r.id, jsonEstavel(r.data));
            meta[r.id] = { email: r.updated_by_email, at: r.updated_at };
            if (r.updated_at) ultimaHoraConhecida.current.set(r.id, r.updated_at);
          });
          snapshot.current = snap;
          setRecordMeta(meta);
          setItems(rows.map(r => ({ ...r.data, id: r.id })));
          setReady(true);
          return;
        }
        ultimo = error;
        await new Promise(r => setTimeout(r, 400 * (tentativa + 1)));
        if (cancelled) return;
      }

      /* Falhou as três vezes. `ready` FICA A FALSE de propósito: é ele que
         autoriza o efeito de gravação. Com ele a false, esta tabela fica em
         modo só-leitura e é impossível escrever (ou apagar) por cima de
         dados que não conseguimos sequer ler. Antes punha-se ready=true
         aqui, o que abria a porta a gravar sobre um estado vazio. */
      console.error(table, ultimo);
      reportReadError(table, ultimo);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, teamId]);

  useEffect(() => {
    if (!teamId) return undefined;
    const channel = supabase.channel(`${table}_rt_${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `team_id=eq.${teamId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = payload.old.id;
          snapshot.current.delete(id);
          setItems(prev => prev.filter(it => it.id !== id));
          setRecordMeta(prev => { const n = { ...prev }; delete n[id]; return n; });
        } else {
          const row = payload.new || {};
          /* O Realtime do Supabase tem um limite de tamanho por registo
             (max_record_bytes, 1 MB por omissão). Registos acima disso não
             são enviados por inteiro: chega um evento com "errors" e com o
             registo vazio ou só com a chave. Se aplicássemos isso ao estado,
             o item bom que temos em memória era substituído por um vazio —
             perdia o título, a pasta e o próprio ficheiro — e a gravação
             seguinte escrevia esse vazio por cima do registo correto na base
             de dados. Era isto que fazia os ficheiros grandes "desaparecer"
             e ficarem como linhas em branco.
             Nesse caso ignoramos o evento e vamos buscar a versão completa
             diretamente à base de dados. */
          const truncated = (payload.errors && payload.errors.length) || row.data == null;
          const rowId = row.id || (payload.old && payload.old.id);
          if (truncated) {
            if (!rowId) return;
            supabase.from(table).select('id, data, updated_by_email, updated_at').eq('id', rowId).maybeSingle()
              .then(({ data: full, error }) => {
                if (error || !full || full.data == null) return; // mantém o que já temos
                applyRow(full);
              });
            return;
          }
          applyRow(row);
        }

        function applyRow(row) {
          if (aGravar.current.has(row.id)) return;
          // Um eco tão antigo (ou mais) do que o que já temos nunca traz
          // nada de novo — só um risco de repor uma versão ultrapassada
          // por cima de uma edição local mais recente. Isto substitui a
          // antiga proteção por tempo fixo (`aGravar` com prazo), que
          // ainda falhava depois de várias gravações seguidas em pouco
          // tempo — esta compara mesmo a HORA real de cada registo, não
          // um relógio à parte.
          const conhecida = ultimaHoraConhecida.current.get(row.id);
          if (conhecida && row.updated_at && row.updated_at <= conhecida) return;
          if (row.updated_at) ultimaHoraConhecida.current.set(row.id, row.updated_at);
          snapshot.current.set(row.id, jsonEstavel(row.data));
          setItems(prev => {
            const item = { ...row.data, id: row.id };
            return prev.some(it => it.id === row.id) ? prev.map(it => it.id === row.id ? item : it) : [...prev, item];
          });
          setRecordMeta(prev => ({ ...prev, [row.id]: { email: row.updated_by_email, at: row.updated_at } }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, teamId]);

  /* REDE DE SEGURANÇA CONTRA UM WEBSOCKET MORTO EM SILÊNCIO.

     A ligação em tempo real (`.channel(...)` acima) pode cair sem avisar
     — o telemóvel bloqueia o ecrã, o browser suspende a aba em segundo
     plano, muda-se de wifi para dados móveis. A aba continua aberta e
     parece normal, mas deixou de receber ecos de gravações feitas por
     outras pessoas (ou por um atleta a responder a um questionário) até
     se recarregar a página à mão.

     Isto foi apanhado como possível causa de "o atleta respondeu, mas o
     treinador não via como respondido": o treinador tinha o ecrã de
     Monitorização aberto há horas, a ligação tinha morrido nesse
     intervalo, e a resposta nova nunca chegou a aparecer sozinha.

     A correção não depende de perceber PORQUE é que o WebSocket caiu —
     só verifica, sempre que a aba volta a ficar visível (e, por garantia
     extra, a cada poucos minutos mesmo sem isso), se há alguma coisa mais
     recente no servidor do que aquilo que já temos, e junta-a. Usa a
     MESMA regra de "só aceitar o que for mesmo mais recente" que os ecos
     do Realtime — nunca risco de repor uma edição local por cima. */
  useEffect(() => {
    if (!teamId) return undefined;
    let cancelled = false;
    /* Não repetir uma leitura completa se a anterior foi há pouco tempo
       — sem isto, trocar de aba várias vezes seguidas (ou o foco a
       disparar por qualquer motivo do browser) multiplicava leituras
       completas da tabela toda, cada uma a contar para o limite de dados
       transferidos (Egress) do Supabase. Isto acontece em cada uma das
       ~16-17 coleções da app AO MESMO TEMPO sempre que o telemóvel volta
       ao ecrã (desbloquear, trocar de app e voltar) — por isso um
       intervalo curto custava caro, multiplicado por essa quantidade de
       tabelas e por todos os telemóveis/tablets com a app aberta. 5
       minutos continua a apanhar uma ligação morta a tempo (é só uma
       rede de segurança, o Realtime já trata do normal), mas já não
       repete a leitura toda de 16 tabelas cada vez que alguém desbloqueia
       o telemóvel várias vezes seguidas. */
    let ultimoFetch = 0;
    const INTERVALO_MINIMO = (ehPesada ? 60 : 5) * 60 * 1000;
    const apanharAtraso = async (forcar = false) => {
      if (!ready || document.visibilityState === 'hidden') return;
      const agora = Date.now();
      if (!forcar && agora - ultimoFetch < INTERVALO_MINIMO) return;
      ultimoFetch = agora;
      /* MARCA DE INÍCIO — ver a guarda da remoção, mais abaixo. */
      const escritasAoComecar = escritasConfirmadas.current;
      const escreviaAoComecar = aEscrever.current;
      let data, error;
      try {
        data = await fetchAllRows(table, teamId);
      } catch (e) {
        error = e;
      }
      if (cancelled || error) return;
      (data || []).forEach(row => {
        if (aGravar.current.has(row.id)) return;
        const conhecida = ultimaHoraConhecida.current.get(row.id);
        if (conhecida && row.updated_at && row.updated_at <= conhecida) return;
        if (row.updated_at) ultimaHoraConhecida.current.set(row.id, row.updated_at);
        snapshot.current.set(row.id, jsonEstavel(row.data));
        setItems(prev => {
          const item = { ...row.data, id: row.id };
          return prev.some(it => it.id === row.id) ? prev.map(it => it.id === row.id ? item : it) : [...prev, item];
        });
        setRecordMeta(prev => ({ ...prev, [row.id]: { email: row.updated_by_email, at: row.updated_at } }));
      });
      /* Também remove quem foi apagado por outra pessoa nesse intervalo.

         O que este ciclo traz é sempre a fotografia completa do servidor
         — quem já não lá está foi apagado. Sem isto, um registo apagado
         por outra pessoa enquanto a ligação estava morta ficava "fantasma"
         no ecrã (visível, mas já não existe na base de dados) até um
         refresh a sério. Não se toca em nada que esteja a ser gravado
         agora mesmo (`aGravar`), para nunca fazer desaparecer algo que o
         próprio utilizador acabou de criar e ainda não confirmou.

         SÓ quando a leitura trouxe alguma coisa: uma lista vazia pode ser
         a equipa mesmo sem registos, mas pode também ser uma leitura
         silenciosamente recusada (RLS, token expirado) — ver o mesmo
         cuidado tomado na leitura inicial, mais acima. Sem esta guarda,
         uma leitura falhada em silêncio apagaria tudo do ecrã por engano. */
      /* E SÓ SE NÃO GRAVÁMOS NADA ENQUANTO ESTA LEITURA DECORRIA.

         Foi isto que apagou 15 convocatórias do ecrã de uma só vez, e
         fez disparar o travão de eliminação em massa na gravação
         seguinte. A sequência: lançar uma volta inteira de jogos cria
         dezenas de registos novos, que são gravados UM A UM (de
         propósito, ver mais acima); o ciclo demora vários segundos. Se
         uma leitura destas começar a meio, a fotografia que traz é de
         ANTES desses registos existirem — e `aGravar` só protege o
         registo que está a ser escrito nesse instante, não os catorze
         que já foram escritos depois de a leitura ter partido. Os
         registos desapareciam do ecrã, mas continuavam no `snapshot`,
         e o ciclo seguinte lia isso como "foram apagados".

         A regra é simples: uma fotografia só serve para decidir quem
         desapareceu se, entretanto, ninguém tiver mexido no álbum. Se
         houve escritas nossas durante a leitura, ou se já havia um
         ciclo de gravação a decorrer quando ela começou, ignora-se a
         remoção e espera-se pela leitura seguinte — um registo fantasma
         a mais durante uns minutos é incomparavelmente melhor do que
         fazer desaparecer trabalho acabado de introduzir.

         A parte de ACRESCENTAR o que veio de novo fica de fora desta
         guarda: juntar é sempre seguro. */
      const houveEscritasNossas = escritasConfirmadas.current !== escritasAoComecar
        || escreviaAoComecar || aEscrever.current;
      if ((data || []).length > 0 && !houveEscritasNossas) {
        const idsNoServidor = new Set(data.map(r => r.id));
        setItems(prev => {
          const alguemFalta = prev.some(it => !idsNoServidor.has(it.id) && !aGravar.current.has(it.id));
          if (!alguemFalta) return prev;
          return prev.filter(it => idsNoServidor.has(it.id) || aGravar.current.has(it.id));
        });
      }
    };
    const aoFocar = () => apanharAtraso(false);
    document.addEventListener('visibilitychange', aoFocar);
    window.addEventListener('focus', aoFocar);
    /* Alguns browsers/webviews não disparam `visibilitychange` de forma
       fiável (sobretudo em apps embutidas) — por isso há também esta
       verificação periódica, independente de qualquer evento. Mas não
       precisa de ser frequente: é só uma rede de segurança para quando o
       WebSocket morre e ninguém troca de aba durante muito tempo (ex.: um
       ecrã de Monitorização deixado aberto o dia inteiro, sem ninguém a
       tocar-lhe). 20 minutos continua a apanhar isso bem a tempo, e reduz
       para uma fração o consumo de dados (Egress) desta rede de
       segurança em 16 coleções × todas as pessoas com a app aberta ao
       mesmo tempo, que era o que estava a esgotar a quota gratuita do
       Supabase. */
    const intervalo = setInterval(() => apanharAtraso(true), (ehPesada ? 60 : 20) * 60 * 1000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', aoFocar);
      window.removeEventListener('focus', aoFocar);
      clearInterval(intervalo);
    };
  }, [table, teamId, ready]);

  useEffect(() => {
    if (!ready || !teamId) return;
    if (aEscrever.current) { pedidoPendente.current = true; return; }
    aEscrever.current = true;
    (async () => {
      // Sempre a versão MAIS RECENTE de `items` — se, enquanto este
      // ciclo escreve, chegar outra alteração local (um clique a mais,
      // ou o eco da própria escrita a repor `items`), o pedido fica
      // marcado em `pedidoPendente` e este `do/while` relê-a no fim, em
      // vez de um segundo efeito arrancar um ciclo à parte.
      do {
        pedidoPendente.current = false;
        const items = itemsRef.current;
      const currentIds = new Set(items.map(it => it.id));
      const toUpsert = [];
      for (const it of items) {
        const { id, ...rest } = it;
        // Nunca gravar um registo que ficou sem conteúdo nenhum. Um item só
        // com id é sempre sinal de que algo correu mal a montante (ver o
        // limite do Realtime acima) — gravá-lo destruiria o registo bom que
        // está na base de dados.
        if (Object.keys(rest).length === 0 && snapshot.current.has(id)) continue;
        const json = jsonEstavel(rest);
        /* O `team_id` vai em cada gravação. É também o que a política de
           INSERT valida no WITH CHECK: sem ele, ou com o de outra equipa,
           o Postgres recusa a linha. */
        if (snapshot.current.get(id) !== json) toUpsert.push({ id, data: rest, team_id: teamId });
      }
      const toDelete = [];
      for (const id of snapshot.current.keys()) if (!currentIds.has(id)) toDelete.push(id);

      /* UM REGISTO DE CADA VEZ, e não todos num único upsert.

         Um upsert com vários registos é UMA instrução SQL: se um deles for
         enorme (um vídeo ou um PDF em base64) e rebentar o tempo limite do
         Postgres, a instrução inteira é cancelada e NADA fica gravado —
         nem os registos pequenos que iam à boleia. Era isto que fazia
         falhar coisas triviais como criar uma pasta ou colar um link do
         Drive: iam no mesmo lote de um ficheiro grande.

         Assim, cada registo é gravado por si. Um grande que falhe não
         arrasta os outros, e o aviso passa a dizer QUAL falhou. */
      const failed = [];
      for (const rec of toUpsert) {
        aGravar.current.add(rec.id);
        const gravarUm = () => supabase.from(table).upsert([rec], { onConflict: 'id' })
          .select('id, data, updated_by_email, updated_at');
        let { data, error } = await gravarUm();
        /* ERROS DE SESSÃO ("JWT issued at future", "JWT expired"): costumam
           ser momentâneos, logo a seguir à renovação automática da sessão
           (pequena diferença de relógio). Volta a tentar até 2 vezes, com
           uns segundos de intervalo (e renovando a sessão se expirou),
           antes de mostrar o aviso. O registo é o mesmo: gravar de novo
           não duplica nada. */
        for (let t = 0; error && /JWT/i.test(error.message || '') && t < 2; t++) {
          await new Promise(r => setTimeout(r, 1500 * (t + 1)));
          if (/expired/i.test(error.message || '')) { try { await supabase.auth.refreshSession(); } catch (e) { /* tenta na mesma */ } }
          ({ data, error } = await gravarUm());
        }
        /* NÃO se tira já a proteção deste id — só passados uns instantes.

           O eco de Realtime da NOSSA PRÓPRIA gravação costuma chegar
           quase de imediato, mas não é garantido: uma rede mais lenta,
           ou várias gravações seguidas (clicar duas vezes seguidas no
           mesmo momento) podem atrasá-lo o suficiente para chegar DEPOIS
           de já se ter tirado a proteção — e nessa altura ele já não é
           reconhecido como "nosso", é tratado como uma alteração vinda
           de fora e aplicado por cima do que já estava (uma versão mais
           antiga a substituir uma mais recente, perdendo a marcação).
           Um segundo de folga chega para cobrir essa demora sem
           atrapalhar gravações a sério de outra pessoa, que continuam a
           reconhecer-se por serem de um id diferente. */
        setTimeout(() => aGravar.current.delete(rec.id), 1200);
        if (error) {
          console.error(table, rec.id, error);
          const nome = (rec.data && (rec.data.title || rec.data.name || rec.data.nome)) || rec.id;
          /* O motivo real, não uma suposição.

             Isto dizia sempre "ficheiros grandes não cabem", fosse qual
             fosse o motivo verdadeiro — o que já enganou uma vez um
             diagnóstico (um registo pequeníssimo a falhar por outra
             razão, RLS por exemplo, e o aviso continuava a apontar para
             o tamanho). Só se assume tamanho quando o registo É mesmo
             grande; caso contrário mostra-se a mensagem que o Postgres
             deu, que é sempre mais útil do que adivinhar. */
          const tamanhoBytes = JSON.stringify(rec.data || {}).length;
          const ehGrande = tamanhoBytes > 1.5 * 1024 * 1024;
          const motivo = ehGrande
            ? `ficheiro grande (~${Math.round(tamanhoBytes / 1024 / 1024)} MB) — não cabe numa linha da base de dados; usa o Storage ou o Google Drive`
            : (error.message || error.hint || 'motivo desconhecido — vê a consola do browser (F12) para o erro completo');
          failed.push(`${nome}: ${motivo}`);
          continue;
        }
        escritasConfirmadas.current += 1;
        (data || []).forEach(r => {
          snapshot.current.set(r.id, jsonEstavel(r.data));
          if (r.updated_at) ultimaHoraConhecida.current.set(r.id, r.updated_at);
          setRecordMeta(prev => ({ ...prev, [r.id]: { email: r.updated_by_email, at: r.updated_at } }));
        });
      }
      if (failed.length) {
        reportSyncError(table, {
          message: `Não ficou gravado: ${failed.join(' · ')}.`,
        });
      }
      if (toDelete.length) {
        /* TRAVÃO DE SEGURANÇA.

           Apagar três ou mais registos de uma vez quase nunca é
           deliberado: costuma vir de o estado local ter ficado vazio ou
           truncado por engano (uma sessão que caiu a meio, um erro de
           renderização, um bug nesta mesma função). Nesses casos não se
           apaga nada e avisa-se, porque o custo de errar é assimétrico:
           não apagar deixa lixo recuperável na base de dados, apagar por
           engano destrói trabalho de uma época inteira.

           MAS há uma exceção legítima, e ela nasceu com o Desenvolvimento
           Individual: apagar um momento de avaliação apaga também a linha
           de cada jogador — dezenas de registos de uma vez. Sem porta de
           saída, o travão tornava impossível apagar um momento, e a
           mensagem parecia um erro quando era a proteção a funcionar.

           `remocaoAutorizada` abre a porta para UMA gravação, e é ligada
           pelo código que sabe que a remoção é intencional. Nunca fica
           ligada de forma permanente — é isso que a mantém uma exceção e
           não um buraco. */
        if (toDelete.length >= 3 && !remocaoAutorizada.current) {
          console.error(table, 'eliminação em massa bloqueada:', toDelete);
          reportSyncError(table, {
            message: `Foi travada a eliminação de ${toDelete.length} registos de uma só vez. `
              + 'Nada foi apagado. Recarrega a página — se os registos voltarem, estava tudo bem.',
          });
        } else {
          // Consome a autorização: vale para esta gravação e mais nenhuma.
          remocaoAutorizada.current = false;
          const { error } = await supabase.from(table).delete().in('id', toDelete);
          escritasConfirmadas.current += 1;
          if (!error) toDelete.forEach(id => snapshot.current.delete(id));
          else { console.error(table, error); reportSyncError(table, error); }
        }
      }
      if (toUpsert.length || toDelete.length) notifyEdit(table);
      } while (pedidoPendente.current);
      aEscrever.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ready]);

  return [items, setItems, ready, recordMeta, () => { remocaoAutorizada.current = true; }];
}

