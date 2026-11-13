// atleta/CheckinKiosk.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useEffect, useRef } from 'react';
import { todayStr, uid, addDays } from '../base/utilidades';
import { KIOSK_VOLTAR_INTERNO } from '../base/kiosk';
import { herdarOuEmpurrarMarca, modalHandoffAtivo, Btn } from '../base/ui';
import { inferirDestinoMissao, destinoMissao } from '../tarefas/regras';
import { normalizeStandings } from '../competicao/dados';
import { competitionLabel, FRIENDLY } from '../dominio/jogos';
import { supabase } from '../supabaseClient';
import { display, T, mono, body } from '../base/tema';
import { Flame, X, Check, Loader2 } from 'lucide-react';
import { WellnessWizard, RpeWizard } from './questionarios';
import { isBirthdayToday } from '../dominio/aniversarios';
import { usePortalFetch } from './portalRpc';
import { PlayerBibliotecaView, PlayerCompeticaoView, PlayerDesenvolvimentoView, PlayerJogosHome, PlayerTarefasView, PlayerTreinoView, submeterAutoavaliacaoSeCompleta } from './vistas';
import { PlayerCacifo, esquecerCacheCacifo } from './Cacifo';
import { APP_BUILD, CHECKIN_ALLOW_BACKFILL, CHECKIN_DAYS_BACK, checkinWindowState } from './janelas';
import { PlayerIdeiaJogoView } from './separadoresJogo';
import { EcraAniversario, EcraJogo, EcraMissao } from './ecras';
import { PortaAEspera, TransicaoEntrada, entradaRecente } from './PortalEntrada';
import { PlayerKioskHome } from './KioskHome';

/* Recebe SÓ o jogador que se autenticou, e não o plantel inteiro.

   Antes, o quiosque carregava a tabela `players` completa para o browser
   do atleta e fazia o `find` pelo código em JavaScript. A interface só
   mostrava o próprio nome, mas os dados de todos estavam na resposta de
   rede — bastava abrir as ferramentas de programador. Agora a validação
   do código acontece no servidor (função checkin_bootstrap) e o que chega
   ao browser é apenas o registo de quem entrou. */
export function CheckinKiosk({ player, monitoring, sessions, onSave, onLogout, diagnostico, code, teamId, equipa }) {
  const loggedPlayerId = player && player.id;
  const [activeType, setActiveType] = useState(null); // null = ecrã pessoal, 'wellness' | 'rpe' = questionário aberto
  /* O CACIFO abre-se com a animação só quando se vem do balneário; ao
     voltar de uma área (Treino, Jogo…) já está aberto. Volta a animar
     depois de se regressar ao ecrã inicial. */
  const [cacifoAberto, setCacifoAberto] = useState(false);
  useEffect(() => { if (activeType === null) setCacifoAberto(false); }, [activeType]);
  /* DE ONDE SE VEIO: o "retroceder" de qualquer área (tarefas, missão,
     jogo, Wellness/PSE…) volta ao sítio de onde ela foi aberta.
     null = ecrã inicial (Mister, missões, campo do Wellness/PSE);
     'portal' = cacifo. Dentro de uma área (ex.: das Tarefas para uma
     missão) mantém-se a origem de quem abriu as Tarefas. */
  const [origem, setOrigem] = useState(null);
  /* Voltar do cacifo ao balneário: o ecrã inicial entra a desvanecer (0,3 s)
     em vez de aparecer de golpe. Só opacidade (sem transform), para não
     mexer nos elementos fixos do ecrã. */
  const [voltouCacifo, setVoltouCacifo] = useState(false);
  useEffect(() => { if (!voltouCacifo) return undefined; const t = setTimeout(() => setVoltouCacifo(false), 450); return () => clearTimeout(t); }, [voltouCacifo]);
  /* Missão aberta a partir das Tarefas: o retroceder (ou o X) dessa área
     volta às Tarefas; das Tarefas volta-se depois à origem de antes. */
  const [deTarefas, setDeTarefas] = useState(false);
  const voltar = () => {
    if (deTarefas && activeType !== 'tarefas') { setDeTarefas(false); setActiveType('tarefas'); return; }
    setDeTarefas(false);
    setActiveType(origem);
  };
  // Onde abrir uma área vinda do cacifo (ex.: Competição › estatísticas).
  const [focoArea, setFocoArea] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  // Quando a notificação do ecrã inicial é tocada, guarda aqui a tarefa a
  // abrir de imediato — o PlayerTarefasView lê isto e já entra direto no
  // detalhe, em vez de mostrar primeiro a lista.
  const [tarefaParaAbrir, setTarefaParaAbrir] = useState(null);
  /* GESTO DE RETROCEDER DO TELEMÓVEL (Android) e botão retroceder do
     browser: dentro de uma área do Portal fazem o mesmo que o "Voltar"
     da app, em vez de sair da app. Uma só marca no histórico enquanto se
     está numa área; depois de cada retroceder que ainda deixa o jogador
     dentro do Portal (ex.: de uma missão para as Tarefas), volta a pôr-se
     a marca. Vistas com passos internos (uma ideia aberta em ecrã
     inteiro, o passo 2 do Wellness) registam-se com `useKioskVoltar` e
     o gesto fecha primeiro esse passo. */
  const emArea = activeType !== null;
  const gestoVoltarRef = useRef(null);
  gestoVoltarRef.current = () => {
    const interno = KIOSK_VOLTAR_INTERNO[KIOSK_VOLTAR_INTERNO.length - 1];
    if (interno) { interno(); return true; }
    if (activeType === 'portal') { setVoltouCacifo(true); setActiveType(null); return false; }
    const destino = deTarefas && activeType !== 'tarefas' ? 'tarefas' : origem;
    if (activeType === 'competicao') setFocoArea(null);
    voltar();
    return destino !== null;
  };
  useEffect(() => {
    if (!emArea || typeof window === 'undefined') return undefined;
    let meu = herdarOuEmpurrarMarca();
    let peloPop = false;
    const onPop = () => {
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meu) return; // fechou-se uma janela por cima, não a área
      const fica = gestoVoltarRef.current();
      if (fica) {
        meu = uid();
        window.history.pushState({ mjpMarker: meu }, '', window.location.hash);
      } else peloPop = true;
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (peloPop || modalHandoffAtivo) return;
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meu) window.history.back();
    };
  }, [emArea]);

  // Pedido às tarefas atribuídas a este atleta, feito aqui em cima (e não
  // só dentro de PlayerTarefasView) porque a notificação no ecrã inicial
  // (PlayerKioskHome) também precisa de saber quantas há por fazer — sem
  // isto, o atleta só saberia que tem uma tarefa depois de já ter entrado
  // no Portal, o que não serve de notificação nenhuma.
  const [estadoTarefas, dadosTarefas] = usePortalFetch('checkin_tarefas', code, teamId);
  // Autoavaliação já toda respondida mas por submeter: fecha-se sozinha.
  const autoavaliacaoSubmetidaRef = useRef(null);
  useEffect(() => {
    // Em silêncio: ao entrar, o jogador não deve ver outra vez "Missão cumprida".
    if (code && teamId) submeterAutoavaliacaoSeCompleta(code, teamId).then(ok => { if (ok && autoavaliacaoSubmetidaRef.current) autoavaliacaoSubmetidaRef.current({ silencioso: true }); });
  }, [code, teamId]);
  // Ajustes feitos DEPOIS deste pedido (rascunhos gravados, submissões)
  // ficam aqui por cima — sem isto, sair de Tarefas e voltar a entrar
  // mostrava outra vez os dados de quando o quiosque abriu, como se a
  // nota nunca tivesse sido gravada (o pedido não se repete sozinho).
  const [tarefasAjustes, setTarefasAjustes] = useState({});
  const listaTarefas = ((dadosTarefas && dadosTarefas.tarefas) || [])
    .map(t => (tarefasAjustes[t.id] ? { ...t, ...tarefasAjustes[t.id] } : t));
  // Notificação (bolinha vermelha + banner do ecrã inicial): desliga-se
  // assim que o atleta SUBMETE a nota, mesmo que o staff ainda não tenha
  // marcado a tarefa como concluída — do lado do atleta, a parte dele
  // está feita, não faz sentido continuar a incomodá-lo por causa de uma
  // tarefa que já respondeu.
  const tarefasPorFazer0 = listaTarefas.filter(t => t.estado !== 'feita' && !t.notaSubmetida);
  /* MISSÕES — o destino de cada tarefa chega por uma função própria
     (`checkin_tarefas_destinos`), que só devolve destinos das tarefas que
     a `checkin_tarefas` já mostra a este atleta. Sem ela (SQL por correr),
     tudo funciona como antes. */
  const [, dadosDestinos] = usePortalFetch('checkin_tarefas_destinos', code, teamId);
  const destinosTarefas = (dadosDestinos && dadosDestinos.destinos) || {};
  // A função devolve o destino (texto, versão antiga) ou { destino, missoes }.
  const comDestino = (t) => {
    const info = destinosTarefas[t.id];
    const missoes = info && typeof info === 'object' && Array.isArray(info.missoes) && info.missoes.length ? info.missoes : null;
    const destino = (info && typeof info === 'object' ? info.destino : info) || (missoes && missoes[0].destino)
      || inferirDestinoMissao(`${t.titulo || ''} ${t.notas || ''}`);
    return { ...t, ...(destino ? { destino } : {}), ...(missoes ? { missoes } : {}) };
  };
  const tarefasPorFazer = tarefasPorFazer0.map(comDestino);
  /* PASSOS de uma tarefa (as várias missões dentro dela). Os feitos ficam
     marcados na nota do atleta ("✓ Passo 2 · …"), que a equipa técnica lê;
     a tarefa só é submetida quando o último passo estiver feito. */
  const passosDe = (t) => {
    const lista = (Array.isArray(t.missoes) && t.missoes.length)
      ? t.missoes
      : [{ id: 'unico', destino: t.destino || 'nota', instrucoes: '' }];
    const nota = String(t.notaAtleta || '');
    const varios = lista.length > 1;
    return lista.map((m, k) => ({
      ...m, id: m.id || `p${k}`, ordem: k, total: lista.length,
      feito: varios ? nota.includes(`Passo ${k + 1} ·`) : false,
    }));
  };
  // Cada passo por fazer = uma "missão" (uma folha da prancheta).
  /* "Passo X de Y" conta SÓ os passos que ainda faltam. Se ele fez um
     de dois, saiu e voltou mais tarde, o que sobra aparece como uma
     missão simples, sem "Passo 2 de 2": para ele já é a única. */
  const itemMissao = (t, passo) => {
    const pend = passosDe(t).filter(p => !p.feito);
    const pos = pend.findIndex(p => p.id === passo.id);
    return {
      id: `${t.id}:${passo.id}`, titulo: t.titulo, prazo: t.prazo, destino: passo.destino || 'nota',
      notas: passo.instrucoes || (passo.total === 1 ? t.notas : ''),
      passoTxt: pend.length > 1 && pos >= 0 ? `Passo ${pos + 1} de ${pend.length}` : '',
      _tarefa: t, _passo: passo,
    };
  };
  const missoesPorFazer = tarefasPorFazer.flatMap(t => passosDe(t).filter(p => !p.feito).map(p => itemMissao(t, p)));
  /* VÉSPERA E DIA DE JOGO — missão automática, sem o treinador ter de
     criar nada. Quando há uma convocatória partilhada para AMANHÃ (véspera)
     ou para HOJE (dia de jogo), cada jogador recebe à entrada uma missão
     que o leva a Jogo (convocatória, plano de jogo, adversário), em vez de
     ter de ir à procura. Vai para todos os que a convocatória mostra,
     convocados ou não (os não convocados também devem ver o adversário).
     SÓ JOGOS OFICIAIS: amigável nunca gera a missão. A convocatória que
     chega ao Portal não diz a competição, por isso o jogo só conta se
     estiver no calendário oficial (`checkin_competicao`): um jogo nesse
     dia contra esse adversário. Se não estiver lá (amigável, ou calendário
     por carregar), não há missão. Mais vale faltar do que mandar para um
     amigável.
     APARECE UMA VEZ: uma na véspera, uma no dia. Conta como vista assim
     que aparece no ecrã, carregue ele em "Bora" ou em "Mais tarde".
     No dia do jogo desaparece à hora do jogo: depois disso já não serve.
     Não é uma tarefa: não conta para o limite de duas missões nem aparece
     em Tarefas da equipa técnica. */
  const [estadoConvJogo, dadosConvJogo] = usePortalFetch('checkin_convocatoria', code, teamId);
  const [estadoCompJogo, dadosCompJogo] = usePortalFetch('checkin_competicao', code, teamId);
  // O jogo da competição que corresponde a esta convocatória (mesmo dia,
  // mesmo adversário), com a jornada. null = não está no calendário oficial.
  const jogoDoCalendario = (c) => {
    const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    const palavras = (x) => norm(x).split(/\s+/).filter(w => w.length >= 4 && !['clube', 'futebol', 'sport', 'sporting', 'grupo', 'desportivo', 'associacao', 'uniao'].includes(w));
    /* ADVERSÁRIOS DE NOME CURTO. Só contavam palavras com 4+ letras, e um
       nome como "AFS SAD (B)" não tem nenhuma: o jogo nunca era reconhecido
       como oficial e o ecrã de dia de jogo não abria (com ?testejogo abria,
       porque o teste não verifica isto). Agora: palavras longas, se houver;
       senão, todas as palavras do nome (2+ letras) têm de lá estar; e, em
       último caso, basta haver um jogo nosso no calendário nesse dia (numa
       competição não há dois jogos nossos no mesmo dia). */
    const adv = palavras(c.adversario);
    const advCurto = norm(c.adversario).split(/\s+/).filter(w => w.length >= 2);
    if (!c.data) return null;
    const { competitions } = normalizeStandings(dadosCompJogo && dadosCompJogo.standings);
    const daJornada = (rounds, k) => {
      const lbl = String(rounds[k].label || '').trim();
      const num = (/(\d+)/.exec(lbl) || [])[1] || (!lbl ? String(k + 1) : '');
      return { jornada: num ? `${num}.ª jornada` : lbl };
    };
    const nesseDia = (g) => g && String(g.date || '').slice(0, 10) === c.data;
    for (const comp of (competitions || [])) {
      const rounds = comp.rounds || [];
      for (let k = 0; k < rounds.length; k++) {
        const achou = (rounds[k].games || []).some(g => {
          if (!nesseDia(g)) return false;
          const lados = ` ${norm(g.home)} ${norm(g.away)} `;
          if (adv.length) return adv.some(w => lados.includes(w));
          if (advCurto.length) return advCurto.every(w => lados.includes(` ${w} `) || lados.includes(w));
          return false;
        });
        if (achou) return daJornada(rounds, k);
      }
    }
    // Último recurso: um jogo do calendário nesse dia com a nossa equipa.
    const nosso = norm((dadosConvJogo && dadosConvJogo.clube) || '').split(/\s+/).filter(w => w.length >= 4);
    for (const comp of (competitions || [])) {
      const rounds = comp.rounds || [];
      for (let k = 0; k < rounds.length; k++) {
        const achou = (rounds[k].games || []).some(g => {
          if (!nesseDia(g)) return false;
          if (!nosso.length) return true;
          const lados = `${norm(g.home)} ${norm(g.away)}`;
          return nosso.some(w => lados.includes(w));
        });
        if (achou) return daJornada(rounds, k);
      }
    }
    return null;
  };
  const jogoOficial = (c) => (c.competicao ? competitionLabel(c.competicao) !== FRIENDLY : !!jogoDoCalendario(c));
  // Já passou a hora do jogo de hoje? (sem hora, fica o dia todo)
  const jaComecou = (c) => {
    const m = /^(\d{1,2})[:h](\d{2})/.exec(String(c.horaJogo || '').trim());
    if (!m || c.data !== todayStr()) return false;
    const agora = new Date();
    return agora.getHours() * 60 + agora.getMinutes() >= Number(m[1]) * 60 + Number(m[2]);
  };
  const [missoesJogoVistas, setMissoesJogoVistas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mjp_missoes_jogo_vistas') || '[]'); } catch (e) { return []; }
  });
  const marcarMissaoJogoVista = (id) => setMissoesJogoVistas(prev => {
    if (prev.includes(id)) return prev;
    const novo = [...prev, id].slice(-60);
    try { localStorage.setItem('mjp_missoes_jogo_vistas', JSON.stringify(novo)); } catch (e) { /* sem armazenamento: volta a aparecer, não faz mal */ }
    return novo;
  });
  /* Todas as missões de jogo de hoje/amanhã, vistas ou não. O ecrã inteiro
     (EcraJogo) só usa as ainda não vistas — aparece uma vez —, mas o
     painel LED do mister no ecrã inicial continua a anunciar o jogo o dia
     todo (até à hora do jogo), com o toque a levar à área Jogo. */
  const missoesJogoTodas = (() => {
    const hoje = todayStr();
    const amanha = addDays(hoje, 1);
    const nossoClube = (dadosConvJogo && dadosConvJogo.clube) || 'Nós';
    return ((dadosConvJogo && dadosConvJogo.convocatorias) || [])
      .filter(c => c && c.data && (c.data === hoje || c.data === amanha))
      .filter(c => jogoOficial(c) && !jaComecou(c))
      .map(c => {
        const vespera = c.data === amanha;
        const id = `jogo:${c.id}:${hoje}:${loggedPlayerId || ''}`;
        const jogo = c.casaFora === 'Fora' ? `${c.adversario} vs ${nossoClube}` : `${nossoClube} vs ${c.adversario}`;
        const quando = [c.horaJogo, c.localJogo].filter(Boolean).join(' · ');
        const conc = !vespera && (c.horaConcentracao || c.localConcentracao)
          ? `\nConcentração: ${[c.horaConcentracao, c.localConcentracao].filter(Boolean).join(' · ')}` : '';
        return {
          id, _jogo: true, destino: 'jogos', prazo: c.data, passoTxt: '',
          _info: {
            vespera, nos: nossoClube, adv: c.adversario || 'Adversário', casaFora: c.casaFora || '',
            data: c.data, hora: c.horaJogo || '', local: c.localJogo || '',
            horaConc: c.horaConcentracao || '', localConc: c.localConcentracao || '', convocado: c.convocado === true,
            jornada: (jogoDoCalendario(c) || {}).jornada || '', logo: (equipa && equipa.logo) || '',
          },
          titulo: vespera ? 'Amanhã há jogo' : 'Hoje é dia de jogo',
          acao: 'Preparar o jogo',
          notas: `${jogo}${quando ? `\n${quando}` : ''}${conc}\nVê a convocatória, o plano de jogo e o adversário.`,
        };
      });
  })();
  /* O ecrã do jogo aparece em TODAS as entradas, desde que a convocatória
     fica visível (véspera e dia do jogo) até à hora do jogo. "Bora" ou
     "Mais tarde" só o tiram da frente nesta entrada. */
  const missoesJogo = missoesJogoTodas;
  /* MODO DE TESTE do ecrã de jogo, sem esperar por um jogo a sério:
     abrir o Portal com ?testejogo=vespera ou ?testejogo=dia no fim do
     endereço. Usa a primeira convocatória que houver (ou um jogo de
     exemplo), não verifica se é oficial e não fica marcada como vista,
     por isso aparece em todas as entradas enquanto o endereço o tiver. */
  const modoTesteJogo = (() => {
    /* Lido do endereço inteiro (parte ? ou #), porque o link do Portal já
       traz um "?portal=…": o teste tem de ir com "&", mas se alguém puser
       um segundo "?" também funciona. */
    try {
      const m = /[?&#]testejogo=(vespera|véspera|dia)\b/i.exec(decodeURIComponent(window.location.href));
      return m ? (/^dia$/i.test(m[1]) ? 'dia' : 'vespera') : '';
    } catch (e) { return ''; }
  })();
  if (modoTesteJogo && !missoesJogo.length) {
    const vespera = modoTesteJogo !== 'dia';
    const c = ((dadosConvJogo && dadosConvJogo.convocatorias) || [])[0] || {};
    const hoje = todayStr();
    const daqui = new Date(Date.now() + 3 * 3600000);
    const horaEx = `${String(daqui.getHours()).padStart(2, '0')}:${String(daqui.getMinutes()).padStart(2, '0')}`;
    missoesJogo.push({
      id: `teste:jogo:${modoTesteJogo}`, _jogo: true, _teste: true, destino: 'jogos', prazo: vespera ? addDays(hoje, 1) : hoje, passoTxt: '',
      titulo: vespera ? 'Amanhã há jogo' : 'Hoje é dia de jogo', acao: 'Preparar o jogo',
      _info: {
        vespera, nos: (dadosConvJogo && dadosConvJogo.clube) || 'Nós', adv: c.adversario || 'FC Exemplo', casaFora: c.casaFora || 'Casa',
        data: vespera ? addDays(hoje, 1) : hoje, hora: c.horaJogo || horaEx, local: c.localJogo || 'Estádio de teste',
        horaConc: c.horaConcentracao || '', localConc: c.localConcentracao || '', convocado: c.convocado !== false,
        jornada: (c.adversario && c.data ? (jogoDoCalendario(c) || {}).jornada : '') || '5.ª jornada', logo: (equipa && equipa.logo) || '',
      },
    });
  }
  const [missaoAtiva, setMissaoAtiva] = useState(null); // a tarefa cujo destino está aberto
  const [missaoCumprida, setMissaoCumprida] = useState(null); // título, para o ecrã "Missão cumprida"
  /* "MAIS TARDE" = SÓ AGORA. A missão sai do ecrã nesta entrada no
     Portal; no próximo login (código), aparece outra vez — até estar
     feita. Ir à missão e voltar sem a fazer também não a reabre por cima
     nesta entrada (fica o cartão "Tens uma tarefa nova"). */
  const [missoesAdiadas, setMissoesAdiadas] = useState([]);
  const adiarMissao = (id) => setMissoesAdiadas(prev => (prev.includes(id) ? prev : [...prev, id]));
  // Aniversário: a página da festa aparece em cada entrada nesse dia.
  const [aniversarioVisto, setAniversarioVisto] = useState(false);
  // Sair e voltar a entrar (novo código) recomeça: a missão volta a aparecer.
  useEffect(() => { setMissoesAdiadas([]); setAniversarioVisto(false); }, [loggedPlayerId, code]);
  /* Missão de jogo que apareceu = vista. Grava-se já no dispositivo (para
     não voltar na próxima entrada), mas não sai do ecrã agora: o jogador
     ainda a está a ler. */
  const idsJogoNoEcra = missoesJogo.filter(m => !m._teste).map(m => m.id).join('|');
  useEffect(() => {
    if (!idsJogoNoEcra) return;
    try {
      const ja = JSON.parse(localStorage.getItem('mjp_missoes_jogo_vistas') || '[]');
      const novo = [...ja, ...idsJogoNoEcra.split('|').filter(id => !ja.includes(id))].slice(-60);
      localStorage.setItem('mjp_missoes_jogo_vistas', JSON.stringify(novo));
    } catch (e) { /* sem armazenamento: volta a aparecer, não faz mal */ }
  }, [idsJogoNoEcra]);
  // Nova entrada (outro código / outro jogador): relê o que já foi visto.
  useEffect(() => {
    try { setMissoesJogoVistas(JSON.parse(localStorage.getItem('mjp_missoes_jogo_vistas') || '[]')); } catch (e) { /* fica como está */ }
  }, [loggedPlayerId, code]);
  const missoesEmCurso = useRef(new Set());
  const notasMissaoRef = useRef({});
  // Conclui UM passo (item da missão). Recebe o item ou, por compatibilidade, a tarefa.
  const completarMissao = async (item, texto, { silencioso = false } = {}) => {
    if (!item) return;
    const it = item._tarefa ? item : (() => {
      const pend = passosDe(item).filter(p => !p.feito);
      return pend.length ? itemMissao(item, pend[0]) : null;
    })();
    if (!it || missoesEmCurso.current.has(it.id)) return;
    missoesEmCurso.current.add(it.id);
    const t = it._tarefa, p = it._passo;
    const agora = new Date();
    const quando = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const acao = texto || destinoMissao(p.destino).acao;
    const linha = p.total > 1 ? `✓ Passo ${p.ordem + 1} · ${acao} — feito na app (${quando})` : `✓ ${acao} — feito na app (${quando})`;
    /* A nota mais recente desta tarefa (também a de um passo acabado de
       fechar nesta mesma ronda, que o estado ainda não mostra). */
    const notaAntes = String(notasMissaoRef.current[t.id] || (tarefasAjustes[t.id] && tarefasAjustes[t.id].notaAtleta) || t.notaAtleta || '').trim();
    const nota = notaAntes ? `${notaAntes}\n${linha}` : linha;
    const restantes = passosDe({ ...t, notaAtleta: nota }).filter(x => !x.feito);
    const submeter = p.total === 1 || restantes.length === 0;
    try {
      const { data, error } = await supabase.rpc('checkin_tarefa_nota', {
        p_code: code, p_team: teamId, p_tarefa_id: t.id, p_nota: nota, p_submeter: submeter,
      });
      if (error || !(data && data.ok)) throw (error || new Error('recusado'));
      notasMissaoRef.current[t.id] = nota;
      setTarefasAjustes(prev => ({ ...prev, [t.id]: { ...prev[t.id], notaAtleta: nota, ...(submeter ? { notaSubmetida: true } : {}) } }));
      setMissaoAtiva(m => (m && m.id === it.id ? null : m));
      if (!silencioso) setMissaoCumprida(submeter
        ? (t.titulo || 'Missão')
        : `${t.titulo || 'Missão'} — passo ${p.ordem + 1} feito. ${restantes.length === 1 ? 'Falta 1 passo.' : `Faltam ${restantes.length} passos.`}`);
      return true;
    } catch (e) {
      missoesEmCurso.current.delete(it.id);
      return false;
    }
  };
  /* CLIPE CRIADO: a missão "Criar um clipe" só fecha quando o clipe fica
     mesmo gravado no servidor. Não há "Já fiz" para carregar. */
  /* Cada clipe fecha UMA missão, e a do jogo certo: se o mister pediu um
     clipe do jogo X, só um clipe feito num vídeo do jogo X a fecha. As
     missões sem jogo escolhido aceitam um clipe de qualquer jogo. Antes,
     dois clipes do mesmo jogo fechavam as duas missões (Lavrense e
     Paredes), mesmo sem nenhum clipe do outro jogo. */
  const clipeCriado = (titulo, jogoId) => {
    const pendentes = missoesPorFazer.filter(x => x.destino === 'clipe');
    const jogoDe = (x) => (x._passo && x._passo.jogoId) || null;
    const it = (jogoId && pendentes.find(x => jogoDe(x) === jogoId)) || pendentes.find(x => !jogoDe(x));
    if (it) completarMissao(it, `Clipe criado: ${titulo}`);
  };
  /* AUTOAVALIAÇÃO SUBMETIDA = FEITA, DE UMA VEZ. Uma submissão fecha TODAS
     as missões de autoavaliação por fazer (a mesma tarefa pode ter mais de
     um passo de autoavaliação, ou haver duas tarefas para o mesmo
     momento). Antes fechava só uma: a outra voltava logo ao ecrã e, no
     login seguinte, aparecia outra vez "Autoavaliação submetida".
     Saem já do ecrã (não piscam enquanto o servidor responde) e há um só
     "Missão cumprida". `silencioso`: ao entrar na app, sem festa. */
  const autoavaliacaoSubmetida = async ({ silencioso = false } = {}) => {
    esquecerCacheCacifo('dev', teamId, code);
    const its = missoesPorFazer.filter(x => x.destino === 'autoavaliacao');
    if (!its.length) return;
    its.forEach(x => adiarMissao(x.id));
    let algum = false;
    for (const it of its) {
      // eslint-disable-next-line no-await-in-loop
      if (await completarMissao(it, 'Autoavaliação submetida', { silencioso: true })) algum = true;
    }
    if (algum && !silencioso) setMissaoCumprida((its[0]._tarefa && its[0]._tarefa.titulo) || 'Autoavaliação submetida');
  };
  /* Missões de autoavaliação que ficaram por fechar de antes (a
     autoavaliação já está submetida): fecham-se em silêncio assim que as
     tarefas chegam. Antes só se verificava uma vez ao abrir, muitas vezes
     ANTES de as tarefas chegarem, e a missão ficava. */
  const idsMissoesAuto = missoesPorFazer.filter(x => x.destino === 'autoavaliacao').map(x => x.id).join('|');
  useEffect(() => {
    if (!idsMissoesAuto || !code || !teamId) return undefined;
    let cancelado = false;
    submeterAutoavaliacaoSeCompleta(code, teamId)
      .then(ok => { if (!cancelado && ok && autoavaliacaoSubmetidaRef.current) autoavaliacaoSubmetidaRef.current({ silencioso: true }); });
    return () => { cancelado = true; };
  }, [idsMissoesAuto, code, teamId]);
  autoavaliacaoSubmetidaRef.current = autoavaliacaoSubmetida;
  useEffect(() => {
    if (!missaoCumprida) return undefined;
    const h = setTimeout(() => setMissaoCumprida(null), 2600);
    return () => clearTimeout(h);
  }, [missaoCumprida]);

  // Sequência do cartão da chama, calculada no servidor (a mesma regra
  // da tarefa da sequência (META_SEQUENCIA dias): autónomo, com o mesmo
  // reinício) — ver o comentário grande junto de `checkin_sequencia_wellness_pse.sql`.
  const [, dadosSequencia] = usePortalFetch('checkin_sequencia_wellness_pse', code, teamId);
  const diasSequenciaChama = (dadosSequencia && dadosSequencia.dias) || 0;

  /* FOTOGRAFIA DO PLANTEL para o cacifo do ecrã inicial. Se a
     `checkin_bootstrap` já a trouxer em `player.photo`, usa-se essa; se
     não, pede-se à parte à `checkin_foto` (ver checkin_foto.sql). Sem a
     função (SQL por correr) ou sem fotografia, o cacifo mostra as
     iniciais — nada parte. */
  const [fotoPlantel, setFotoPlantel] = useState(null);
  const temFotoNoBootstrap = !!(player && player.photo);
  useEffect(() => {
    setFotoPlantel(null);
    if (!code || !teamId || temFotoNoBootstrap) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_foto', { p_code: code, p_team: teamId });
        if (cancelado || error) return;
        let d = Array.isArray(data) ? data[0] : data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
        if (d && typeof d.photo === 'string' && d.photo) setFotoPlantel(d.photo);
      } catch (e) { /* sem a função: fica com as iniciais */ }
    })();
    return () => { cancelado = true; };
  }, [code, teamId, temFotoNoBootstrap]);

  // Relógio interno: as janelas horárias abrem/fecham sozinhas sem o atleta
  // ter de recarregar a página (ex.: está no ecrã às 12:59 e às 13:00 o
  // Wellness fecha e o PSE passa a estar disponível às 13:10).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  // Se o dia virar com o ecrã aberto, volta automaticamente para hoje.
  useEffect(() => {
    const today = todayStr();
    if (selectedDate !== today && !CHECKIN_ALLOW_BACKFILL) setSelectedDate(today);
  }, [nowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Cinto de segurança: sem jogador não há nada a mostrar, mas também não
     se deixa a página em branco.

     Fica AQUI, depois de todos os hooks, e não no topo da função: uma
     saída antecipada antes dos hooks faz o número de hooks variar entre
     renderizações, e o React rebenta com isso — trocaríamos um ecrã
     branco por outro. */
  if (!loggedPlayerId) {
    // Mostra-se o que chegou, em vez de só dizer que falhou: sem isto, um
    // erro que só acontece no telemóvel de outra pessoa é indiagnosticável.
    const detalhe = (() => {
      try {
        return JSON.stringify({
          build: APP_BUILD,
          player,
          nMonitoring: Array.isArray(monitoring) ? monitoring.length : typeof monitoring,
          nSessions: Array.isArray(sessions) ? sessions.length : typeof sessions,
          ...(diagnostico || {}),
        }, null, 1).slice(0, 600);
      } catch (e) { return `build ${APP_BUILD} · não foi possível ler os dados`; }
    })();
    return (
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '50px 20px', textAlign: 'center' }}>
        <div style={{ ...display, fontSize: 19, color: T.cream, marginBottom: 8 }}>Não foi possível abrir</div>
        <div style={{ fontSize: 13.5, color: T.mutedDim, marginBottom: 16 }}>
          Os teus dados não chegaram completos. Tenta outra vez ou fala com o staff.
        </div>
        <pre style={{
          background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: 10,
          fontSize: 10.5, color: T.muted, textAlign: 'left', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', ...mono,
        }}>{detalhe}</pre>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Btn onClick={() => { try { navigator.clipboard.writeText(detalhe); } catch (e) { /* seleciona à mão */ } }}>Copiar</Btn>
          <Btn variant="ghost" onClick={onLogout}>Voltar</Btn>
        </div>
      </div>
    );
  }

  const now = new Date(nowTick);
  const wellnessWindow = checkinWindowState('wellness', selectedDate, now);
  const rpeWindow = checkinWindowState('rpe', selectedDate, now);

  const sessionForDate = sessions.find(s => s.date === selectedDate);

  const hasDate = (type, date) => monitoring.some(m => m.playerId === loggedPlayerId && m.date === date &&
    (type === 'wellness' ? typeof m.sono === 'number' : typeof m.pse === 'number'));

  const recentDates = Array.from({ length: CHECKIN_DAYS_BACK + 1 }, (_, i) => addDays(todayStr(), -(CHECKIN_DAYS_BACK - i)));
  const dayStatus = {};
  recentDates.forEach(d => { dayStatus[d] = { wellness: hasDate('wellness', d), rpe: hasDate('rpe', d) }; });

  // A gravação vai ao servidor: é lá que se verifica de quem é o registo
  // e se o dia está dentro da janela permitida.
  const upsert = (type, fields) => onSave(type, fields, selectedDate);

  /* BARRA DA MISSÃO — por baixo do sítio para onde a missão levou o
     jogador: nas que fecham sozinhas lembra que basta submeter; nas
     outras tem o "Já fiz". */
  const comBarraMissao = (vista) => {
    const m = missaoAtiva;
    // Nas que fecham sozinhas (questionários) não há barra: tapava os
    // botões do próprio questionário, e basta submeter.
    if (!m || m.destino !== 'clipe') return vista;
    const d = destinoMissao(m.destino);
    return (
      <>
        {vista}
        <div style={{
          position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 65, maxWidth: 640, margin: '0 auto',
          background: T.surfaceRaise, border: `1px solid ${T.gold}`, borderRadius: 12, padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.45)', ...body,
        }}>
          <Flame size={18} color={T.warn} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: T.warn, textTransform: 'uppercase', letterSpacing: '.08em' }}>Missão</div>
            <div style={{ fontSize: 13, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</div>
          </div>
          <span style={{ fontSize: 11.5, color: T.mutedDim, textAlign: 'right' }}>Fecha sozinha<br />{m.destino === 'clipe' ? 'quando gravares o clipe' : 'quando submeteres'}</span>
          <button type="button" onClick={() => setMissaoAtiva(null)} title="Esconder" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 4 }}><X size={15} /></button>
        </div>
      </>
    );
  };

  const irParaMissao = (alvo) => {
    // Missão automática de véspera / dia de jogo: marca como vista e vai.
    if (alvo && alvo._jogo) {
      marcarMissaoJogoVista(alvo.id);
      adiarMissao(alvo.id); // nesta entrada já não volta a abrir por cima
      setActiveType('jogos');
      return;
    }
    // Pode vir um passo (da prancheta) ou uma tarefa (cartão/lista): na
    // tarefa, vai-se ao primeiro passo por fazer.
    const t = alvo && alvo._tarefa ? alvo : (() => {
      const tt = comDestino(alvo);
      const pend = passosDe(tt).filter(p => !p.feito);
      return pend.length ? itemMissao(tt, pend[0]) : itemMissao(tt, passosDe(tt)[0]);
    })();
    const d = destinoMissao(t.destino);
    if (!t.destino || t.destino === 'nota' || !d.rota) { setTarefaParaAbrir(t._tarefa.id); setActiveType('tarefas'); return; }
    adiarMissao(t.id); // ao voltar, não reabre por cima nesta entrada — fica o cartão
    if (!d.auto) {
      // Leitura: chegar lá É a missão. Fica registado "Abriu …", sem festa.
      completarMissao(t, `Abriu: ${d.rotulo}`, { silencioso: true });
    } else {
      setMissaoAtiva(t);
    }
    setActiveType(d.rota);
  };
  // Missões e mensagens abertas a partir do ecrã inicial voltam ao ecrã inicial.
  const irParaMissaoDoInicio = (alvo) => { setOrigem(null); setDeTarefas(false); irParaMissao(alvo); };
  if (activeType === 'wellness') {
    const existing = monitoring.find(m => m.playerId === loggedPlayerId && m.date === selectedDate && typeof m.sono === 'number');
    const lastWellness = existing || monitoring
      .filter(m => m.playerId === loggedPlayerId && typeof m.sono === 'number')
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return comBarraMissao(
      <WellnessWizard
        player={player} initial={lastWellness} date={selectedDate}
        onBack={voltar}
        onSubmit={fields => upsert('wellness', fields)}
      />
    );
  }

  if (activeType === 'rpe') {
    return comBarraMissao(
      <RpeWizard
        player={player} session={sessionForDate} date={selectedDate}
        /* O quiosque não conhece a lista de Jogos (ver checkin_rpc.sql:
           só recebe as sessões). A fase "Jogo" na sessão é o que permite
           ao atleta responder ao PSE do jogo em vez do de treino. */
        contexto={sessionForDate && sessionForDate.phase === 'Jogo' ? 'jogo' : 'treino'}
        onBack={voltar}
        onSubmit={fields => upsert('rpe', fields)}
      />
    );
  }

  if (activeType === 'ideiaJogo') {
    return comBarraMissao(<PlayerIdeiaJogoView code={code} teamId={teamId} onBack={voltar} fecharVolta={deTarefas} />);
  }

  if (activeType === 'treino') {
    return comBarraMissao(<PlayerTreinoView code={code} teamId={teamId} onBack={voltar} />);
  }

  if (activeType === 'biblioteca') {
    return comBarraMissao(<PlayerBibliotecaView code={code} teamId={teamId} onBack={voltar} onClipeCriado={clipeCriado} />);
  }

  if (activeType === 'jogos') {
    return comBarraMissao(<PlayerJogosHome code={code} teamId={teamId} onBack={voltar} jogadorId={loggedPlayerId} logo={(equipa && equipa.logo) || ''} infoJogo={jogoDoCalendario} />);
  }

  if (activeType === 'competicao') {
    return <PlayerCompeticaoView code={code} teamId={teamId} foco={focoArea} onBack={() => { setFocoArea(null); voltar(); }} />;
  }

  if (activeType === 'desenvolvimento') {
    return comBarraMissao(<PlayerDesenvolvimentoView code={code} teamId={teamId} onBack={voltar} onSubmetido={autoavaliacaoSubmetida} />);
  }

  if (activeType === 'tarefas') {
    return (
      <PlayerTarefasView
        code={code} teamId={teamId} onBack={voltar}
        tarefas={listaTarefas.map(comDestino)} estado={estadoTarefas}
        onIrMissao={(alvo) => { setDeTarefas(true); irParaMissao(alvo); }}
        tarefaAbrirId={tarefaParaAbrir} onTarefaAberta={() => setTarefaParaAbrir(null)}
        onNotaGravada={(id, patch) => setTarefasAjustes(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
      />
    );
  }

  if (activeType === 'portal') {
    return (
      <PlayerCacifo
        player={fotoPlantel ? { ...player, photo: fotoPlantel } : player}
        equipa={equipa} code={code} teamId={teamId}
        animar={!cacifoAberto} onAberto={() => setCacifoAberto(true)}
        onBack={() => { setVoltouCacifo(true); setActiveType(null); }}
        onAbrir={(id, foco) => { setCacifoAberto(true); setOrigem('portal'); setDeTarefas(false); setFocoArea(foco || null); setActiveType(id); }}
        onAbrirWellness={() => { if (wellnessWindow.open) { setCacifoAberto(true); setOrigem('portal'); setActiveType('wellness'); } }}
        onAbrirRpe={() => { if (rpeWindow.open) { setCacifoAberto(true); setOrigem('portal'); setActiveType('rpe'); } }}
        dadosConv={dadosConvJogo} dadosComp={dadosCompJogo}
        missoes={missoesPorFazer} nTarefas={tarefasPorFazer.length}
        session={sessionForDate}
        doneWellness={hasDate('wellness', selectedDate)} doneRpe={hasDate('rpe', selectedDate)}
        wellnessWindow={wellnessWindow} rpeWindow={rpeWindow}
      />
    );
  }

  /* MISSÃO EM ECRÃ INTEIRO — ao entrar, a primeira coisa que o jogador
     vê é a tarefa por fazer, com um botão para o sítio certo. "Mais
     tarde" esconde-a até ao dia seguinte (fica o cartão no ecrã inicial). */
  // A missão de jogo vem primeiro: é a que tem hora marcada.
  const missoesParaMostrar = [...missoesJogo, ...missoesPorFazer]
    .filter(t => !missoesAdiadas.includes(t.id) && !(t._tarefa && missoesAdiadas.includes(t._tarefa.id)));
  const jogoNoEcra = missoesParaMostrar.find(t => t._jogo);
  const tarefasNoEcra = missoesParaMostrar.filter(t => !t._jogo);
  const ecraMissao = jogoNoEcra ? (
    <EcraJogo player={player} missao={jogoNoEcra} onIr={irParaMissaoDoInicio} onAdiar={adiarMissao} />
  ) : tarefasNoEcra.length > 0 ? (
    <EcraMissao
      player={player}
      tarefas={tarefasNoEcra}
      janelas={{ wellness: wellnessWindow, rpe: rpeWindow }}
      onIr={irParaMissaoDoInicio}
      onAdiar={adiarMissao}
    />
  ) : null;
  const toastCumprida = missaoCumprida ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, background: T.veuMissao, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10, ...body, padding: 24, textAlign: 'center',
    }} onClick={() => setMissaoCumprida(null)}>
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: `${T.good}33`, border: `2px solid ${T.good}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={40} color={T.good} />
      </div>
      <div style={{ ...display, fontSize: 26, color: T.cream }}>Missão cumprida</div>
      <div style={{ fontSize: 14, color: T.muted, maxWidth: 360 }}>{missaoCumprida}</div>
    </div>
  ) : null;

  /* Enquanto as tarefas ainda estão a chegar, não se mostra o ecrã
     inicial (senão aparecia primeiro a página e só depois a missão, aos
     saltos): fica um ecrã de entrada limpo, e a seguir entra-se logo no
     que interessa — a missão, se houver, ou o ecrã inicial. */
  /* Também se espera pela convocatória e pela competição: é delas que vem a
     mensagem do Mister sobre o jogo, e a caixa do Mister só existe quando
     há mensagem — se chegasse depois, o balneário saltava para baixo. */
  if (estadoTarefas === 'a-carregar' || estadoConvJogo === 'a-carregar' || estadoCompJogo === 'a-carregar') {
    if (entradaRecente()) return <PortaAEspera />;
    return (
      <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, ...body }}>
        <Loader2 size={26} className="animate-spin" color={T.warn} />
        <div style={{ fontSize: 13, color: T.mutedDim }}>A entrar…</div>
      </div>
    );
  }

  // DIA DE ANOS: antes de tudo (até da missão), a página da festa.
  if (player && isBirthdayToday(player.birthdate) && !aniversarioVisto) {
    return <TransicaoEntrada focoInteiro><EcraAniversario player={player} onEntrar={() => setAniversarioVisto(true)} /></TransicaoEntrada>;
  }

  /* PAINEL LED DO MISTER (ecrã inicial) — a voz do mister, por ordem:
     1) véspera / dia de jogo → leva à área Jogo do Portal (convocatória,
        plano de jogo, adversário). Usa as mesmas regras da missão de jogo
        (só jogos oficiais, desaparece à hora do jogo), mas fica o dia todo,
        mesmo depois de o ecrã inteiro já ter sido visto;
     2) cada missão por fazer (passo a passo) → irParaMissao, o mesmo
        caminho da prancheta e de Tarefas;
     3) dia de anos → os parabéns da equipa técnica (sem toque);
     4) nada disto → "Sem missões pendentes · Bom treino" (sem toque). */
  const jogoNoPainel = missoesJogoTodas[0] || missoesJogo.find(m => m._teste) || null;
  const mensagensMister = [];
  // Ordem: o aniversário primeiro, depois o jogo, depois as tarefas.
  if (player && isBirthdayToday(player.birthdate)) {
    // Sem o nome: já aparece no cumprimento por cima.
    mensagensMister.push({ tipo: 'festa', texto: 'Parabéns! Toda a equipa técnica deseja-te um ótimo dia.' });
  }
  if (jogoNoPainel) {
    const i = jogoNoPainel._info || {};
    // Curta, na voz do Mister: quando, contra quem e um empurrão.
    mensagensMister.push({
      tipo: 'jogo',
      texto: `${i.vespera ? 'Amanhã' : 'Hoje'} há jogo${i.adv ? ` vs ${i.adv}` : ''}. ${i.vespera ? 'Prepara-te!' : 'Foco total!'}`,
      onTocar: () => { if (!jogoNoPainel._teste) marcarMissaoJogoVista(jogoNoPainel.id); setOrigem(null); setActiveType('jogos'); },
    });
  }
  missoesPorFazer.forEach(it => {
    mensagensMister.push({
      tipo: 'missao',
      texto: `${it.titulo || 'Missão'}${it.passoTxt ? ` (${it.passoTxt})` : ''} ▸ Toca para começar`,
      onTocar: () => irParaMissaoDoInicio(it),
    });
  });
  if (!jogoNoPainel && !missoesPorFazer.length) {
    mensagensMister.push({ tipo: 'nada', texto: 'Sem missões pendentes · Bom treino' });
  }

  return (
    <TransicaoEntrada focoInteiro={!!ecraMissao}>
    {voltouCacifo && <style>{'@keyframes mjp-voltar { from { opacity: 0; } to { opacity: 1; } }'}</style>}
    <div style={voltouCacifo ? { animation: 'mjp-voltar .32s ease-out both' } : undefined}>
    {ecraMissao}
    {toastCumprida}
    <PlayerKioskHome
      player={fotoPlantel ? { ...player, photo: fotoPlantel } : player}
      equipa={equipa}
      session={sessionForDate}
      selectedDate={selectedDate}
      doneWellness={hasDate('wellness', selectedDate)} doneRpe={hasDate('rpe', selectedDate)}
      wellnessWindow={wellnessWindow} rpeWindow={rpeWindow}
      onOpenWellness={() => { if (wellnessWindow.open) { setOrigem(null); setActiveType('wellness'); } }}
      onOpenRpe={() => { if (rpeWindow.open) { setOrigem(null); setActiveType('rpe'); } }}
      onOpenPortal={() => setActiveType('portal')}
      onLogout={onLogout}
      tarefasPendentes={tarefasPorFazer}
      mensagensMister={mensagensMister}
      diasSequenciaChama={diasSequenciaChama}
    />
    </div>
    </TransicaoEntrada>
  );
}

