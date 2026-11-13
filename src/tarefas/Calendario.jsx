// tarefas/Calendario.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { getMonday } from '../treino/Planeamento';
import { T, mono, body, display } from '../base/tema';
import { Check, Lock, UserCheck, PartyPopper, Bell, Repeat, MessageCircle, X, ChevronLeft, ChevronRight, Trophy, Moon, Dumbbell, Flame, FileText, Flag, RefreshCw, ArrowRight } from 'lucide-react';
import { LINHAS } from '../dominio/plantel';
import { shortPlayerName } from '../dominio/jogadores';
import { dayLabel } from '../treino/SessionModal';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../base/ui';
import { addDays, fmtShort, timeAgo } from '../base/utilidades';
import { irParaSeparador } from '../base/ui-extra';
import { RECORRENCIA_LABEL, alvoDoLembrete, aniversariantesEm, eSemanal, lembreteRecente, ocorrenciasSemanais, prazoTexto, semanaisPendentes, tarefaAtivaHoje, tarefaFeitaHoje } from './regras';
import { corDoMembro, nomeDoMembro } from '../gestao/membros';
import { CRITERIO_STAFF, ResumoGrupo, caminhoStaff, caminhoVerificavel } from './missoesRegras';

/* ================================================================
   CALENDÁRIO — a semana das Tarefas, de segunda a domingo.
   ================================================================

   A mesma grelha da agenda semanal do Planeamento (7 colunas, 3 no
   telemóvel), com as tarefas no dia delas:
   - Uma tarefa normal aparece no dia do seu `prazo`, aberta ou já
     concluída (riscada), para a semana mostrar o que se fez e o que falta.
   - Uma tarefa que se repete aparece em TODOS os dias em que a regra
     dela está ativa, também nas semanas seguintes. É assim que o
     "observar o adversário à quinta" está sempre lá, semana após semana,
     sem ninguém o voltar a criar. A conclusão marca-se só para esse dia
     (`concluidasEm`), como na lista.
   - Uma repetição só começa no dia em que foi criada (`recorrencia.desde`
     ou, nas tarefas antigas, `criadoEm`): não enche as semanas passadas
     de tarefas que ainda não existiam.
   - Dias futuros de uma tarefa que se repete não se podem dar como
     feitos: ainda não chegaram.
   - "Enquanto faltar Wellness/PSE" depende das respostas de HOJE, por
     isso só aparece no dia de hoje.
   - No topo de cada dia, sem botões, o jogo e o treino ou folga desse
     dia, para contexto.
   - "+ tarefa" no fundo de cada dia abre uma tarefa nova já com esse dia.
   - No computador, arrastar uma tarefa normal para outro dia muda-lhe o
     prazo. Arrastar uma SEMANAL muda só essa semana (ver a nota junto de
     `eSemanal`); no telemóvel faz-se ao abrir a tarefa, em "Só esta
     semana". As outras repetições não se arrastam: o dia delas é a regra.
   - Uma semanal por concluir de dias anteriores fica a vermelho no dia
     dela, e se for de semanas anteriores aparece também por baixo da
     grelha, até ser concluída.
   - Por baixo da grelha ficam as que não têm lugar nela: sem prazo e,
     na semana de hoje, as atrasadas de semanas anteriores. */
export function dataInicioRepeticao(t) {
  const r = t.recorrencia || {};
  if (r.desde) return r.desde;
  if (t.criadoEm) return String(t.criadoEm).slice(0, 10);
  return null;
}

export function repeteNoDia(t, dia, hoje, ctx) {
  if (!t.recorrencia) return false;
  /* Os aniversários são factos do calendário, não trabalho que "ainda não
     existia": aparecem também nas semanas antes de a tarefa ter sido
     criada. Assim, se a tarefa automática for apagada e a app a criar de
     novo, os aniversários que já passaram não desaparecem. */
  const inicio = t.recorrencia.tipo === 'aniversario' ? null : dataInicioRepeticao(t);
  if (inicio && dia < inicio) return false;
  if (t.recorrencia.tipo === 'wellness_pse') return dia === hoje && tarefaAtivaHoje(t, hoje, ctx);
  return tarefaAtivaHoje(t, dia, ctx);
}

export function CartaoTarefaCalendario({ tarefa, dia, ocorrencia, hoje, membros, euId, players, podeConcluir = true, onLembrar, onAbrir, onAlternarEm, arrastavel, aArrastar, onDragStart, onDragEnd }) {
  const repete = !!tarefa.recorrencia;
  const chave = ocorrencia ? ocorrencia.base : dia;
  const feita = repete ? (tarefa.concluidasEm || []).includes(chave) : tarefa.estado === 'feita';
  // Uma semanal pode concluir-se antes do dia, dentro da semana de hoje;
  // as outras repetições só no próprio dia ou depois.
  const futuro = repete && (ocorrencia ? getMonday(dia) > getMonday(hoje) : dia > hoje);
  const atrasada = !feita && (ocorrencia ? dia < hoje : (!repete && tarefa.prazo && tarefa.prazo < hoje));
  const mudada = ocorrencia && ocorrencia.dia !== ocorrencia.base;
  /* A QUEM ESTÁ ATRIBUÍDA, sempre por nome. Numa tarefa de um jogador o
     nome que interessa é o do atleta (é ele quem a faz, no Portal), por
     isso aparece primeiro, a dourado; o responsável da equipa técnica
     fica por baixo, como quem acompanha. */
  // Nas que se repetem não há jogador: a resposta dele seria uma só e
  // aparecia (com o visto de submetida) em todos os dias da repetição.
  const jogador = !repete && tarefa.jogadorId ? (players || []).find(p => p.id === tarefa.jogadorId) : null;
  // Numa tarefa de aniversário, quem faz anos NESSE dia (não hoje).
  const aniversariantes = repete && tarefa.recorrencia.tipo === 'aniversario'
    ? aniversariantesEm(players, dia)
    : [];
  const cor = corDoMembro(tarefa.responsavel);
  const nome = nomeDoMembro(tarefa.responsavel, membros, euId);
  // Depois de `nome` existir: usá-lo antes desta linha rebenta o ecrã
  // ("Cannot access … before initialization").
  const nomeCurto = tarefa.responsavel ? nome.split(' ')[0] : 'Sem responsável';
  const bloqueada = !podeConcluir;
  const lembreteParaMim = !feita && tarefa.lembrete && tarefa.lembrete.alvo !== 'jogador'
    && tarefa.responsavel === euId && !tarefa.lembrete.visto;
  const alvo = !feita && onLembrar ? alvoDoLembrete(tarefa, euId, membros, players, hoje) : null;
  const possoLembrar = !!alvo;
  const lembrado = lembreteRecente(tarefa);
  const temWhatsApp = !!(alvo && alvo.link);

  return (
    <div
      draggable={arrastavel}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex', gap: 6, alignItems: 'flex-start',
        background: T.bg, borderRadius: 6, padding: '4px 6px',
        border: `1px solid ${lembreteParaMim ? T.crimsonBright : (atrasada ? T.bad : T.line)}`,
        opacity: aArrastar ? 0.45 : 1, cursor: arrastavel ? 'grab' : undefined,
      }}
    >
      <button
        onClick={() => !futuro && !bloqueada && onAlternarEm(tarefa, dia, ocorrencia ? ocorrencia.base : undefined)}
        disabled={futuro || bloqueada}
        title={bloqueada
          ? `Só ${nome} pode ${feita ? 'reabrir' : 'concluir'}`
          : (futuro ? 'Ainda não chegou este dia' : (feita ? 'Desmarcar' : 'Marcar como concluída'))}
        aria-label={bloqueada ? `Só ${nome} pode concluir` : (feita ? 'Desmarcar' : 'Marcar como concluída')}
        style={{
          width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 1, padding: 0,
          cursor: futuro ? 'default' : (bloqueada ? 'not-allowed' : 'pointer'), opacity: futuro ? 0.4 : 1,
          background: feita ? T.good : 'transparent', border: `1.5px solid ${feita ? T.good : T.line}`,
          display: 'grid', placeItems: 'center',
        }}
      >{feita ? <Check size={9} style={{ color: T.sobreVerde }} /> : (bloqueada && <Lock size={8} style={{ color: T.mutedDim }} />)}</button>
      <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => onAbrir(tarefa, ocorrencia)}>
        <div style={{
          ...LINHAS(2), fontSize: 11.5, lineHeight: 1.22,
          color: feita ? T.mutedDim : T.cream, textDecoration: feita ? 'line-through' : 'none',
        }}>{tarefa.titulo}</div>
        {tarefa._grupo && <ResumoGrupo tarefa={tarefa} membros={membros} euId={euId} players={players} pequeno />}
        {jogador && (
          <div
            title={`Atribuída a ${jogador.name}`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 10.5, lineHeight: 1.25, color: T.gold, fontWeight: 600, minWidth: 0 }}
          >
            <UserCheck size={10} style={{ flexShrink: 0 }} />
            <span style={LINHAS(1)}>{shortPlayerName(jogador, players)}</span>
            {tarefa.notaSubmetida && <Check size={10} style={{ flexShrink: 0 }} aria-label="Nota submetida" />}
          </div>
        )}
        {aniversariantes.length > 0 && (
          <div
            title={aniversariantes.map(p => p.name).join(', ')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 2, fontSize: 10.5, color: T.gold, lineHeight: 1.25 }}
          >
            <PartyPopper size={10} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={LINHAS(2)}>{aniversariantes.map(p => shortPlayerName(p, players)).join(', ')}</span>
          </div>
        )}
        <div style={{ display: (tarefa._grupo && !tarefa._paraJogadores) ? 'none' : 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 10, lineHeight: 1.25, color: T.mutedDim, minWidth: 0 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%', background: cor, flexShrink: 0,
            display: 'grid', placeItems: 'center', fontSize: 7, color: '#0d140e', fontWeight: 600, ...mono,
          }}>{nome.charAt(0).toUpperCase()}</span>
          <span style={{ ...LINHAS(1), minWidth: 0 }} title={jogador ? `Acompanha: ${nome}` : nome}>{nomeCurto}</span>
          {lembreteParaMim && <Bell size={10} style={{ flexShrink: 0, color: T.crimsonBright }} aria-label="Tens um lembrete" />}
          {repete && <Repeat size={10} style={{ flexShrink: 0, marginLeft: 'auto' }} aria-label="Repete" />}
        </div>
        {possoLembrar && (
          <button
            onClick={e => { e.stopPropagation(); if (!lembrado) onLembrar(tarefa); }}
            disabled={lembrado}
            title={lembrado
              ? 'Já houve um lembrete nas últimas 12 horas'
              : (temWhatsApp ? `Lembrar ${alvo.nome} por WhatsApp` : `Lembrar ${alvo.nome} na app (sem telemóvel na ficha da equipa)`)}
            style={{
              ...body, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3,
              fontSize: 9.5, lineHeight: 1.3, padding: '0 6px', borderRadius: 10, background: 'transparent',
              border: `1px solid ${T.line}`, color: lembrado ? T.mutedDim : T.cream,
              cursor: lembrado ? 'default' : 'pointer',
            }}
          >{temWhatsApp && !lembrado ? <MessageCircle size={9} color="#25D366" /> : <Bell size={9} />} {lembrado ? 'Enviado' : 'Lembrar'}</button>
        )}
        {mudada && (
          <div style={{ fontSize: 9.5, lineHeight: 1.25, color: T.warn, marginTop: 2 }}>
            só esta semana (habitual: {dayLabel(ocorrencia.base)})
          </div>
        )}
      </div>
    </div>
  );
}

/* LISTA DE UM DIA DO CALENDÁRIO, SEM BARRA DE DESLIZAR.
   O dia tem altura fixa. Mostram-se os cartões que cabem inteiros; os
   restantes ficam escondidos e aparece um "+N" ao lado do "+ tarefa". Ao clicar,
   a lista completa abre POR CIMA do dia (não empurra nada na página) e
   fecha com o X, com Esc ou clicando fora. As concluídas vão sempre para
   o fim da lista, por isso são as primeiras a ficar escondidas.
   Mede-se depois de desenhar (todos os cartões estão lá, os que não cabem
   só ficam invisíveis), por isso a medição não muda a altura de nada. */
export function ListaDoDiaSemScroll({ cartoes, aberto, aArrastar, onAbrir, onFechar, onNova }) {
  const caixa = useRef(null);
  const painel = useRef(null);
  const [cabem, setCabem] = useState(cartoes.length);
  // O "+N mais" fica na linha do "+ tarefa", por isso não ocupa espaço da lista.
  const RESERVA = 0;
  const medir = useCallback(() => {
    const el = caixa.current;
    if (!el) return;
    const H = el.clientHeight;
    const filhos = [...el.children].filter(c => !c.dataset.mais);
    const fundo = (c) => c.offsetTop + c.offsetHeight;
    if (!filhos.length || fundo(filhos[filhos.length - 1]) <= H) { setCabem(filhos.length); return; }
    let n = 0;
    while (n < filhos.length && fundo(filhos[n]) <= H - RESERVA) n += 1;
    setCabem(n);
  }, []);
  React.useLayoutEffect(medir);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => medir());
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir]);
  // O painel é desenhado por cima da página (fora da grelha, que cortava
  // o que passasse dos limites), alinhado com o dia.
  const [pos, setPos] = useState(null);
  React.useLayoutEffect(() => {
    if (!aberto) { setPos(null); return; }
    const dia = caixa.current && caixa.current.closest('[data-dia-cal]');
    if (!dia) return;
    const r = dia.getBoundingClientRect();
    const width = Math.max(r.width, 230);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const top = Math.max(8, r.top);
    setPos({ top, left, width, maxHeight: window.innerHeight - top - 12 });
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return undefined;
    // Se a página deslizar ou a janela mudar de tamanho, fecha (para não
    // ficar a flutuar fora do sítio).
    const fecharJa = (e) => { if (painel.current && e && e.target && painel.current.contains(e.target)) return; onFechar(); };
    window.addEventListener('scroll', fecharJa, true);
    window.addEventListener('resize', fecharJa);
    return () => { window.removeEventListener('scroll', fecharJa, true); window.removeEventListener('resize', fecharJa); };
  }, [aberto, onFechar]);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (painel.current && !painel.current.contains(e.target)) onFechar(); };
    const esc = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto, onFechar]);
  const escondidos = Math.max(0, cartoes.length - cabem);
  return (
    <>
      <div ref={caixa} style={{
        position: 'relative', flex: '1 1 auto', minHeight: 0, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6,
      }}>
        {cartoes.map((c, i) => (
          <div key={c.key || i} style={{ flexShrink: 0, visibility: i < cabem ? 'visible' : 'hidden' }}>{c}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 'auto' }}>
        {escondidos > 0 && (
          <button type="button" onClick={onAbrir} title="Ver todas as tarefas deste dia" style={{
            flex: '0 0 auto', fontSize: 11, fontWeight: 600, color: T.cream, background: T.surfaceRaise || T.surface,
            border: `1px solid ${T.line}`, borderRadius: 6, padding: '4px 7px', cursor: 'pointer', ...body,
          }}>+{escondidos}</button>
        )}
        <button type="button" onClick={onNova} style={{
          flex: 1, minWidth: 0, fontSize: 11, color: T.mutedDim, background: 'none',
          border: `1px dashed ${T.line}`, borderRadius: 6, padding: '4px 0', cursor: 'pointer', ...body,
        }}>+ tarefa</button>
      </div>
      {aberto && pos && createPortal(
        <div ref={painel} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, overflowY: 'auto', scrollbarWidth: 'thin', zIndex: 1000,
          background: T.surface, border: `1px solid ${T.gold}`, borderRadius: 8, padding: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,.45)', display: 'flex', flexDirection: 'column', gap: 5,
          // Enquanto se arrasta um cartão, o painel deixa passar o rato para
          // se poder largar nos dias que estão por baixo.
          pointerEvents: aArrastar ? 'none' : 'auto', opacity: aArrastar ? 0.55 : 1,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: T.mutedDim }}>{cartoes.length} tarefas</span>
            <button type="button" onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', padding: 2 }}><X size={14} /></button>
          </div>
          {cartoes}
        </div>,
        document.body,
      )}
    </>
  );
}

export function TarefasCalendario({ tarefas, hoje, ctx, membros, euId, players, podeConcluir, onLembrar, onAbrir, onAlternarEm, onMover, onMoverOcorrencia, onNovaNoDia }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(hoje));
  const [arrastada, setArrastada] = useState(null);
  const [sobre, setSobre] = useState(null);
  // Dia com a lista toda aberta por cima (o "+N mais").
  const [diaAberto, setDiaAberto] = useState(null);
  const isMobile = useIsMobile(700);
  /* ARRASTAR PARA OUTRA SEMANA. Leva-se a tarefa até à seta (‹ ou ›) e
     deixa-se lá parada: ao fim de meio segundo a semana muda, e continua
     a mudar enquanto ela lá ficar. Depois larga-se no dia certo.
     Só para tarefas normais: nas que se repetem toda a semana, mover uma
     ocorrência para outra semana ia chocar com a ocorrência dessa semana,
     por isso essas continuam a mudar só dentro da própria semana. */
  const [setaArmada, setSetaArmada] = useState(0); // -1, 0, 1
  const timerSeta = useRef(null);
  const pararSeta = () => { if (timerSeta.current) { clearInterval(timerSeta.current); timerSeta.current = null; } setSetaArmada(0); };
  const podeMudarSemana = !!arrastada && !arrastada.base;
  const setaDragOver = (dir) => (e) => {
    if (!podeMudarSemana) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (timerSeta.current) return;
    setSetaArmada(dir);
    const passo = () => setWeekStart(w => addDays(w, 7 * dir));
    timerSeta.current = setTimeout(() => {
      passo();
      timerSeta.current = setInterval(passo, 900);
    }, 550);
  };
  // O cartão arrastado sai do ecrã quando a semana muda, e aí o navegador
  // já não avisa o fim do arrasto ao cartão: limpa-se aqui, na janela.
  useEffect(() => {
    if (!arrastada) return undefined;
    const fim = () => { setArrastada(null); setSobre(null); setDiaAberto(null); pararSeta(); };
    window.addEventListener('dragend', fim);
    window.addEventListener('drop', fim);
    return () => { window.removeEventListener('dragend', fim); window.removeEventListener('drop', fim); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastada]);
  useEffect(() => () => pararSeta(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDiaAberto(null); }, [weekStart]);
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
  const estaSemana = weekStart === getMonday(hoje);
  const { sessions, matches } = ctx;
  const idsDeJogos = new Set((matches || []).map(m => m.id));
  const alturaContexto = isMobile ? 0 : Math.max(0, ...days.map(d => {
    const nm = (matches || []).filter(m => m.date === d).length;
    const ns = (sessions || []).filter(x => x.date === d && !(x.sourceMatchId && idsDeJogos.has(x.sourceMatchId))).length;
    const n = nm + ns;
    return n ? nm * 18 + ns * 15 + (n - 1) * 3 : 0;
  }));

  // Ocorrências semanais desta semana, já no dia onde caem (mudado ou não).
  const semanais = tarefas
    .filter(t => eSemanal(t) && t.estado !== 'feita')
    .flatMap(t => ocorrenciasSemanais(t, weekStart, addDays(weekStart, 6), hoje).map(oc => ({ t, oc })));

  const doDia = (d) => {
    const normais = tarefas.filter(t => !t.recorrencia && t.prazo === d).map(t => ({ t, oc: null }));
    const repetidas = tarefas
      .filter(t => t.recorrencia && !eSemanal(t) && t.estado !== 'feita' && repeteNoDia(t, d, hoje, ctx))
      .map(t => ({ t, oc: null }));
    const destas = semanais.filter(x => x.oc.dia === d);
    const feitaNoDia = ({ t, oc }) => (t.recorrencia ? (t.concluidasEm || []).includes(oc ? oc.base : d) : t.estado === 'feita');
    return [...normais, ...destas, ...repetidas].sort((a, b) => Number(feitaNoDia(a)) - Number(feitaNoDia(b)));
  };

  const semPrazo = tarefas.filter(t => !t.recorrencia && !t.prazo && t.estado !== 'feita');
  const atrasadasAntes = estaSemana
    ? tarefas.filter(t => (eSemanal(t)
      ? t.estado !== 'feita' && semanaisPendentes(t, hoje).some(o => o.dia < weekStart)
      : !t.recorrencia && t.prazo && t.prazo < weekStart && t.estado !== 'feita'))
    : [];

  const navBtn = { background: 'none', border: `1px solid ${T.line}`, borderRadius: 6, color: T.cream, cursor: 'pointer', padding: '4px 6px' };
  /* As setas têm SEMPRE o mesmo tamanho (o grande, bom para largar uma
     tarefa em cima). Antes cresciam só ao começar a arrastar, e o
     calendário inteiro descia uns píxeis: era isso que fazia a página
     mexer. Durante o arrasto muda só a cor e o tracejado. */
  const setaBtn = { ...navBtn, padding: '8px 10px' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior"
          onDragOver={setaDragOver(-1)} onDragLeave={pararSeta} onDrop={e => { e.preventDefault(); pararSeta(); }}
          style={{ ...setaBtn, ...(podeMudarSemana ? { borderStyle: 'dashed', borderColor: T.gold, color: T.warn } : {}), ...(setaArmada === -1 ? { background: 'rgba(201,162,39,.18)' } : {}) }}><ChevronLeft size={16} style={{ pointerEvents: 'none', display: 'block' }} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ ...display, color: T.warn, fontSize: 15, fontWeight: 600 }}>
            Semana de {fmtShort(days[0])} a {fmtShort(days[6])}
          </div>
          {/* O botão "Hoje" ocupa sempre o seu lugar (só fica invisível na
              semana atual), para o título não saltar ao mudar de semana. */}
          <button onClick={() => setWeekStart(getMonday(hoje))} tabIndex={estaSemana ? -1 : 0} aria-hidden={estaSemana}
            style={{ ...navBtn, ...body, fontSize: 11.5, padding: '3px 9px', color: T.muted, visibility: estaSemana ? 'hidden' : 'visible', pointerEvents: estaSemana ? 'none' : 'auto' }}>Hoje</button>
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana seguinte"
          onDragOver={setaDragOver(1)} onDragLeave={pararSeta} onDrop={e => { e.preventDefault(); pararSeta(); }}
          style={{ ...setaBtn, ...(podeMudarSemana ? { borderStyle: 'dashed', borderColor: T.gold, color: T.warn } : {}), ...(setaArmada === 1 ? { background: 'rgba(201,162,39,.18)' } : {}) }}><ChevronRight size={16} style={{ pointerEvents: 'none', display: 'block' }} /></button>
      </div>

      <div style={{
        display: 'grid', gap: 8,
        /* No TELEMÓVEL, um dia por linha (como uma agenda), com os cartões
           à largura toda: em três colunas não cabia nada e o texto ficava
           cortado em reticências. */
        ...(isMobile
          ? { gridTemplateColumns: '1fr' }
          : { gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', overflowX: 'auto' }),
      }}>
        {/* ALINHAMENTO: o espaço do "contexto do dia" (jogo, treino, folga)
            tem a mesma altura em todos os dias da semana, a do dia que
            tiver mais. Assim os cartões das tarefas começam todos à mesma
            altura, mesmo nos dias sem nada marcado. */}
        {days.map(d => {
          const lista = doDia(d);
          const isToday = d === hoje;
          const dayMatches = (matches || []).filter(m => m.date === d);
          const daySessions = (sessions || []).filter(s => s.date === d && !(s.sourceMatchId && idsDeJogos.has(s.sourceMatchId)));
          const destacado = sobre === d;
          return (
            <div
              key={d}
              data-dia-cal={d}
              onDragOver={e => {
                if (!arrastada) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (sobre !== d) setSobre(d);
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSobre(s => (s === d ? null : s)); }}
              onDrop={e => {
                e.preventDefault();
                const a = arrastada;
                setSobre(null); setArrastada(null);
                if (!a) return;
                if (a.base) onMoverOcorrencia(a.id, a.base, d);
                else onMover(a.id, d);
              }}
              style={{
                background: destacado ? 'rgba(201,162,39,.08)' : T.surface,
                border: `1px ${destacado ? 'dashed' : 'solid'} ${destacado || isToday ? T.gold : T.line}`,
                /* ALTURA FIXA no computador: todos os dias têm sempre a mesma
                   altura, cheios ou vazios. Largar uma tarefa num dia já não
                   faz o calendário crescer nem empurra a página para baixo.
                   Cabem 3 cartões; quando há mais, aparece um "+N" ao lado
                   do "+ tarefa" (sem barra de deslizar), ver ListaDoDiaSemScroll. */
                borderRadius: 8, padding: isMobile ? '10px 10px' : 8, minWidth: 0,
                ...(isMobile ? { minHeight: 0 } : { height: 356 + alturaContexto, position: 'relative' }),
                display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 10 : 0,
              }}
            >
              <div style={isMobile ? { width: 46, flexShrink: 0 } : undefined}>
                <div style={{ fontSize: 10.5, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.04em' }}>{isMobile ? dayLabel(d).slice(0, 3) : dayLabel(d)}</div>
                <div style={{ ...mono, fontSize: isMobile ? 18 : 15, color: isToday ? T.warn : T.cream, marginBottom: 6 }}>{new Date(d + 'T00:00:00').getDate()}</div>
              </div>
              <div style={isMobile ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } : { display: 'contents' }}>

              {/* Contexto do dia, sem botões: o que já está marcado. */}
              {(dayMatches.length > 0 || daySessions.length > 0 || alturaContexto > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6, minHeight: alturaContexto }}>
                  {dayMatches.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600,
                      color: T.sobreCream, background: T.cream, borderRadius: 4, padding: '2px 5px', minWidth: 0,
                    }}>
                      <Trophy size={9} color={T.sobreCream} style={{ flexShrink: 0 }} />
                      <span style={LINHAS(1)}>vs {m.opponent || 'Adversário'}</span>
                    </div>
                  ))}
                  {daySessions.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.mutedDim, minWidth: 0 }}>
                      {s.phase === 'Descanso' ? <Moon size={9} style={{ flexShrink: 0 }} /> : <Dumbbell size={9} style={{ flexShrink: 0 }} />}
                      <span style={LINHAS(1)}>{s.phase === 'Descanso' ? 'Folga' : (s.focus || s.phase || 'Treino')}</span>
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const cartao = ({ t, oc }) => {
                  const arrastavel = !isMobile && (!t.recorrencia || !!oc);
                  const chave = { id: t.id, base: oc ? oc.base : null };
                  return (
                    <CartaoTarefaCalendario
                      key={`${t.id}-${oc ? oc.base : d}`}
                      tarefa={t} dia={d} ocorrencia={oc} hoje={hoje} membros={membros} euId={euId} players={players}
                      podeConcluir={podeConcluir(t)} onLembrar={onLembrar}
                      onAbrir={onAbrir} onAlternarEm={onAlternarEm}
                      arrastavel={arrastavel}
                      aArrastar={!!arrastada && arrastada.id === t.id && arrastada.base === chave.base}
                      onDragStart={arrastavel ? (e => {
                        // Firefox só começa a arrastar com algum dado lá dentro.
                        e.dataTransfer.setData('text/plain', t.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setArrastada(chave);
                      }) : undefined}
                      onDragEnd={arrastavel ? (() => { setArrastada(null); setSobre(null); }) : undefined}
                    />
                  );
                };
                if (isMobile) {
                  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 6 }}>{lista.map(cartao)}</div>;
                }
                return (
                  <ListaDoDiaSemScroll
                    cartoes={lista.map(cartao)}
                    aberto={diaAberto === d}
                    aArrastar={!!arrastada}
                    onAbrir={() => setDiaAberto(d)}
                    onFechar={() => setDiaAberto(null)}
                    onNova={() => onNovaNoDia(d)}
                  />
                );
              })()}

              {isMobile && <button onClick={() => onNovaNoDia(d)} style={{
                marginTop: 'auto', width: '100%', fontSize: 11, color: T.mutedDim, background: 'none',
                border: `1px dashed ${T.line}`, borderRadius: 6, padding: '4px 0', cursor: 'pointer', ...body,
              }}>+ tarefa</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 11.5, color: T.mutedDim, alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Repeat size={12} /> Repete</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${T.bad}` }} /> Atrasada
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: T.cream }} /> Jogo
        </span>
        {!isMobile && <span>Arrasta uma tarefa para outro dia. Para outra semana, leva-a até à seta ‹ ou › e espera. Nas que se repetem, muda só essa semana.</span>}
      </div>

      {(atrasadasAntes.length > 0 || semPrazo.length > 0) && (
        <div style={{ marginTop: 20 }}>
          {atrasadasAntes.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: T.bad, marginBottom: 8, fontWeight: 600 }}>Atrasadas de semanas anteriores · {atrasadasAntes.length}</div>
              {atrasadasAntes.map(t => (
                <LinhaTarefa key={t.id} tarefa={t} membros={membros} euId={euId} hoje={hoje} players={players}
                  onAbrir={onAbrir} onAlternar={x => onAlternarEm(x, hoje)}
                  podeConcluir={podeConcluir(t)} onLembrar={onLembrar} />
              ))}
            </div>
          )}
          {semPrazo.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 600 }}>Sem dia marcado · {semPrazo.length}</div>
              {semPrazo.map(t => (
                <LinhaTarefa key={t.id} tarefa={t} membros={membros} euId={euId} hoje={hoje} players={players}
                  onAbrir={onAbrir} onAlternar={x => onAlternarEm(x, hoje)}
                  podeConcluir={podeConcluir(t)} onLembrar={onLembrar} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Uma linha. A caixa à esquerda fecha a tarefa sem abrir nada — é o
   gesto mais frequente de todos e não devia custar dois cliques. */
// Hora local (HH:MM) de um instante ISO, para o "adiada 3×".
export const horaMinTarefa = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function LinhaTarefa({ tarefa, membros, euId, hoje, players, onAbrir, onAlternar, podeConcluir = true, onLembrar }) {
  const semanal = eSemanal(tarefa);
  const pendentes = semanal ? semanaisPendentes(tarefa, hoje) : [];
  const feita = semanal
    ? pendentes.length === 0
    : (tarefa.recorrencia ? tarefaFeitaHoje(tarefa, hoje) : tarefa.estado === 'feita');
  const atrasada = semanal
    ? !feita && pendentes[0].dia < hoje
    : !tarefa.recorrencia && !feita && tarefa.prazo && tarefa.prazo < hoje;
  const paraHoje = !tarefa.recorrencia && !feita && tarefa.prazo === hoje;
  const cor = corDoMembro(tarefa.responsavel);
  // Numa tarefa de "Aniversário de jogador", diz-se logo aqui quem faz
  // anos hoje — sem isto, o título sozinho ("Há aniversário no
  // plantel") obrigava a abrir a tarefa para saber de quem se trata.
  const aniversariantes = tarefa.recorrencia && tarefa.recorrencia.tipo === 'aniversario'
    ? aniversariantesEm(players, hoje)
    : [];
  const jogadorAtribuido = tarefa.jogadorId ? (players || []).find(p => p.id === tarefa.jogadorId) : null;
  const porRever = tarefa.jogadorId && tarefa.notaSubmetida && !tarefa.notaRevista && tarefa.criadoPor === euId;
  const nomeResp = nomeDoMembro(tarefa.responsavel, membros, euId);
  const lembrete = !feita && tarefa.lembrete ? tarefa.lembrete : null;
  const lembreteAoJogador = lembrete && lembrete.alvo === 'jogador';
  const lembreteParaMim = lembrete && !lembreteAoJogador && tarefa.responsavel === euId && !lembrete.visto;
  const alvo = !feita && onLembrar ? alvoDoLembrete(tarefa, euId, membros, players, hoje) : null;
  const possoLembrar = !!alvo;
  const temWhatsApp = !!(alvo && alvo.link);
  const nomeAlvo = alvo ? alvo.nome : nomeResp;

  return (
    <div style={{
      display: 'flex', gap: 11, alignItems: 'flex-start',
      padding: '11px 13px', background: T.bg, borderRadius: 9,
      border: `1px solid ${porRever || lembreteParaMim ? T.crimsonBright : T.line}`, marginBottom: 8,
    }}>
      <button
        onClick={() => podeConcluir && onAlternar(tarefa)}
        disabled={!podeConcluir}
        title={!podeConcluir
          ? `Só ${nomeResp} pode ${feita ? 'reabrir' : 'concluir'}`
          : (feita ? (tarefa.recorrencia ? 'Desmarcar hoje' : 'Reabrir') : 'Marcar como concluída')}
        aria-label={!podeConcluir ? `Só ${nomeResp} pode concluir` : (feita ? 'Reabrir' : 'Marcar como concluída')}
        style={{
          width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 2,
          cursor: podeConcluir ? 'pointer' : 'not-allowed',
          background: feita ? T.good : 'transparent',
          border: `1.5px solid ${feita ? T.good : T.line}`,
          display: 'grid', placeItems: 'center', padding: 0,
          opacity: !podeConcluir && !feita ? 0.7 : 1,
        }}
      >{feita ? <Check size={11} style={{ color: T.sobreVerde }} /> : (!podeConcluir && <Lock size={9} style={{ color: T.mutedDim }} />)}</button>

      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onAbrir(tarefa)}>
        <div style={{
          fontSize: 13.5, lineHeight: 1.45,
          color: feita ? T.mutedDim : T.cream,
          textDecoration: feita ? 'line-through' : 'none',
        }}>{tarefa.titulo}</div>

        {lembrete && (
          <div style={{
            fontSize: 11.5, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5,
            color: lembreteParaMim ? T.crimsonBright : T.mutedDim, fontWeight: lembreteParaMim ? 600 : 400,
          }}>
            <Bell size={12} />
            {lembreteAoJogador
              ? `Lembrete enviado a ${jogadorAtribuido ? shortPlayerName(jogadorAtribuido, players) : 'o jogador'} ${timeAgo(lembrete.em)} por WhatsApp`
              : tarefa.responsavel === euId
                ? `Lembrete de ${nomeDoMembro(lembrete.de, membros, euId)} · ${timeAgo(lembrete.em)}`
                : `Lembrete enviado ${timeAgo(lembrete.em)}${lembrete.whatsapp ? ' por WhatsApp' : ''}`}
          </div>
        )}

        {aniversariantes.length > 0 && (
          <div style={{ fontSize: 11.5, color: T.gold, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <PartyPopper size={12} /> {aniversariantes.map(p => p.name).join(', ')}
          </div>
        )}

        {(tarefa.marco === 'streak30' || tarefa.marco === 'streak60') && tarefa.jogadorNome && (
          <div style={{ fontSize: 11.5, color: T.gold, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Flame size={12} /> {tarefa.jogadorNome}
          </div>
        )}

        {tarefa._grupo && <ResumoGrupo tarefa={tarefa} membros={membros} euId={euId} players={players} />}
        {jogadorAtribuido && (
          <div style={{ fontSize: 11.5, color: porRever ? T.crimsonBright : T.gold, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5, fontWeight: porRever ? 600 : 400 }}>
            <UserCheck size={12} /> {shortPlayerName(jogadorAtribuido, players)}
            {tarefa.notaSubmetida ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 2 }}>
                <Check size={11} /> {porRever ? 'nota nova — ver' : 'concluído'}
              </span>
            ) : tarefa.notaAtleta && <FileText size={11} style={{ color: T.mutedDim, marginLeft: 2 }} />}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 7, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.muted }}>
            <span style={{
              width: 19, height: 19, borderRadius: '50%', background: cor, flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 9, color: '#0d140e', fontWeight: 600, ...mono,
            }}>{nomeDoMembro(tarefa.responsavel, membros, euId).charAt(0).toUpperCase()}</span>
            {nomeDoMembro(tarefa.responsavel, membros, euId)}
          </span>
          {tarefa.estado === 'curso' && (
            <span style={{ fontSize: 11.5, color: T.warn }}>• iniciada</span>
          )}
          {tarefa.obrigatoria && (
            <span style={{ fontSize: 11, color: T.bad, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Flag size={10} /> prioritária</span>
          )}
          {caminhoVerificavel(tarefa) && !feita && (
            <span style={{ fontSize: 11, color: T.good }} title={`Fecha sozinha quando ${CRITERIO_STAFF[tarefa.caminho]}`}>• fecha sozinha</span>
          )}
          {/* Quem criou vê quantas vezes a pessoa entrou e adiou. */}
          {!feita && (tarefa.adiadaEm || []).length > 0 && (tarefa.criadoPor === euId || tarefa.responsavel === euId) && (
            <span style={{ fontSize: 11, color: T.mutedDim }} title={(tarefa.adiadaEm || []).map(d => (String(d).length > 10 ? `${fmtShort(String(d).slice(0, 10))} ${horaMinTarefa(d)}` : fmtShort(d))).join(', ')}>
              adiada {(tarefa.adiadaEm || []).length}×
            </span>
          )}
          {tarefa.recorrencia && (
            <span style={{ fontSize: 11, color: T.mutedDim, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={10} /> {RECORRENCIA_LABEL[tarefa.recorrencia.tipo]}
            </span>
          )}
          {tarefa.notas ? <FileText size={12} style={{ color: T.mutedDim }} /> : null}
          {/* Missão da equipa técnica com caminho: atalho direto para lá. */}
          {!tarefa.jogadorId && !tarefa._paraJogadores && tarefa.caminho && (
            <button type="button" onClick={e => { e.stopPropagation(); irParaSeparador(tarefa.caminho); }} style={{
              ...body, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '1px 8px', borderRadius: 10,
              background: 'transparent', border: `1px solid ${T.gold}`, color: T.warn, cursor: 'pointer',
            }}>{caminhoStaff(tarefa.caminho).rotulo} <ArrowRight size={10} /></button>
          )}
        </div>
      </div>

      {/* À DIREITA: o tempo em cima, o Lembrar em baixo. */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between',
        alignSelf: 'stretch', gap: 8, flexShrink: 0,
      }}>
          <span style={{
            ...mono, fontSize: 11, flexShrink: 0,
            color: feita ? T.mutedDim : (atrasada ? T.bad : (paraHoje ? T.warn : T.mutedDim)),
          }}>
            {semanal
              ? (feita
                ? 'concluída esta semana'
                : `${pendentes[0].dia < hoje ? `desde ${prazoTexto(pendentes[0].dia, hoje)}` : 'hoje'}${pendentes.length > 1 ? ` · ${pendentes.length} por concluir` : ''}`)
              : tarefa.recorrencia
              ? (feita ? 'concluída hoje' : 'hoje')
              : (feita ? `concluída${tarefa.feitaEm ? ` · ${fmtShort(tarefa.feitaEm.slice(0, 10))}` : ''}` : prazoTexto(tarefa.prazo, hoje))}
          </span>
        {possoLembrar && (
            <button
              onClick={e => { e.stopPropagation(); if (!lembreteRecente(tarefa)) onLembrar(tarefa); }}
              disabled={lembreteRecente(tarefa)}
              title={lembreteRecente(tarefa)
                ? 'Já houve um lembrete nas últimas 12 horas'
                : (temWhatsApp ? `Lembrar ${nomeAlvo} por WhatsApp` : `Lembrar ${nomeAlvo} na app (sem telemóvel na ficha da equipa)`)}
              style={{
                ...body, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, whiteSpace: 'nowrap', marginTop: 'auto',
                padding: '2px 8px', borderRadius: 12, background: 'transparent',
                border: `1px solid ${T.line}`, color: lembreteRecente(tarefa) ? T.mutedDim : T.cream,
                cursor: lembreteRecente(tarefa) ? 'default' : 'pointer',
              }}
            >{temWhatsApp && !lembreteRecente(tarefa) ? <MessageCircle size={11} color="#25D366" /> : <Bell size={11} />} {lembreteRecente(tarefa) ? 'Enviado' : 'Lembrar'}</button>
          )}
      </div>
    </div>
  );
}

