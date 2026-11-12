// treino/Planeamento.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useIsMobile, trocarJanela, removeWithUndo, itemLabel, Btn, EmptyState, SectionHeader, inputStyle, BotaoTopo } from '../base/ui';
import React, { useRef, useState, useEffect } from 'react';
import { todayStr, fmtDate, escapeHtmlText, uid, addDays, toLocalISODate, fmtShort } from '../base/utilidades';
import { esperarImagensDoStorage } from '../base/impressao';
import { buildMatchShareHtml, FichaJogo, PrintFichaJogo, EquipaEmColunasPrint } from '../competicao/FichaJogo';
import { shareOrDownloadHtml, buildShareableHtmlDoc } from '../base/partilha';
import { momentoTexto } from '../dominio/treino';
import { equipaDoAmigavel, campoDaEquipaHtml, equipaEmColunasHtml, ASPECT_CAMPO_PRINT, MarcacoesCampoPrint, posCampoPrint } from '../tatico/impressaoCampo';
import { nomesDosConvidados, integrarConvidado } from '../dominio/convidados';
import { podarPresencasForaDosConvocados, syncMatchConvocatoria, ensureMatchSession } from '../competicao/dados';
import { numDoJogo } from '../media/organizacao';
import { isFriendlyMatch, jogoRealDaSessao, competitionLabel } from '../dominio/jogos';
import { mono, T, body, TEXT_ON_ACCENT, display } from '../base/tema';
import { Plus, ChevronRight, Trophy, Trash2, Shuffle, Share2, Printer, Pencil, ChevronLeft, TrendingUp } from 'lucide-react';
import { convidadosDe, sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { Simulador, LAYOUT_FORMACAO, rotuloDoLugar } from '../tatico/Simulador';
import { escalacaoNovaFormacao, escalacaoDoJogo, comQuemLaEsteve } from '../competicao/Escalacao';
import { MatchModal } from '../competicao/MatchModal';
import { createPortal } from 'react-dom';
import { distribuirPlantel } from '../tatico/prancheta';
import { viewBoxSemBancos, aspetoSemBancos, ESTICAR_IMPRESSAO_MEIO, VistaCampo, PitchMarkings, iconScaleForPhase, DiagramElements } from '../tatico/campo';
import { LINHAS } from '../dominio/plantel';
import { useDetailBack } from '../base/historico';
import { CARTAO_AGENDA, COR_INTENSIDADE, GRUPOS_POSICAO_PRINT, INTENSITIES, intensityLabel, intensityText, numeroMicrociclo, rotuloMicrociclo, tempoJogoText, tituloDiaDeJogo } from './comum';
import { SpaceZonesReadOnly, buildDiagramBlockHtml, diagramaParaImpressao } from './diagramas';
import { DayModal, SessionModal, dayLabel } from './SessionModal';
import { PrancheteDoPlantel } from '../plantel/Prancheta';
import { PdfComoImagens } from '../media/pdf';

export function Planeamento({ sessions, setSessions, exercises, setExercises, exercisesMeta, players, setPlayers, matches, setMatches, standings, season, clinico, convocatorias, setConvocatorias }) {
  const isMobile = useIsMobile(700);
  // Ecrã inteiro do Simulador tem scroll próprio (é um overlay `position:
  // fixed`, não faz parte do <main> normal) — precisa da sua própria
  // referência para o botão "voltar ao topo" saber o que rolar.
  const simuladorScrollRef = useRef(null);
  const [modal, setModal] = useState(null); // null | 'new' | {presetDate} | session object
  const [modalVoltarDia, setModalVoltarDia] = useState(false); // true só quando abriu a partir da janela do dia
  const [matchModal, setMatchModal] = useState(null); // null | jogo a editar (a partir da agenda)
  const [matchModalVoltarFicha, setMatchModalVoltarFicha] = useState(false); // true só quando o editor abriu a partir da ficha
  // Ficha de leitura do jogo — o mesmo conceito usado em Jogos: o cartão
  // abre a ficha (resultado, formação, destaques); o lápis continua a
  // abrir a edição direta. Como `matches` é o MESMO estado partilhado
  // entre Jogos e Planeamento, um jogo criado ou editado aqui aparece tal
  // e qual em Jogos, e vice-versa — não há duas cópias dos dados.
  const [ficha, setFicha] = useState(null);
  /* Dia para o qual o Simulador está aberto. `null` = fechado. Deixou de
     ser separador próprio: é uma ferramenta que se aplica a um dia, e o
     dia vem do cartão em que se carregou. */
  const [simuladorDia, setSimuladorDia] = useState(null);
  const fecharSimulador = useDetailBack(!!simuladorDia, () => setSimuladorDia(null));
  const [printSession, setPrintSession] = useState(null);
  /* A ficha do JOGO em papel (a mesma que Jogos usa), para o botão
     Imprimir da janela de leitura do jogo. É diferente da folha da SESSÃO
     que os ícones do cartão imprimem: aquela é o plano do dia de treino,
     esta é a ficha do encontro. */
  const [printMatch, setPrintMatch] = useState(null);
  const [dayModalDate, setDayModalDate] = useState(null); // data (YYYY-MM-DD) do dia a ver em detalhe
  const [printDayDate, setPrintDayDate] = useState(null);
  /* Folhas soltas de um dia: só as presenças, ou só a prancheta. São
     impressões diferentes e não recortes da folha do dia — quem leva as
     presenças para o campo não quer o plano de treino atrás. */
  const [printFolha, setPrintFolha] = useState(null); // { date, tipo }

  const doPrintFolha = (date, tipo) => {
    setPrintSession(null);
    setPrintDayDate(null);
    setPrintFolha({ date, tipo });
    setTimeout(() => window.print(), 90);
  };
  useEffect(() => {
    if (!printFolha) return undefined;
    const limpar = () => setPrintFolha(null);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [printFolha]); // data a imprimir com todas as sessões desse dia
  const [view, setView] = useState('lista'); // 'lista' | 'agenda'
  const [weekStart, setWeekStart] = useState(getMonday(todayStr()));
  // No telemóvel os cartões da lista partem-se em dois andares (ver abaixo).
  const isNarrow = useIsMobile(700);

  /* SEMANAS FECHADAS + ABRIR JÁ NA SEMANA ATUAL.

     Antes a Lista mostrava a época toda desde o início — abrir
     Planeamento a meio da época obrigava a rolar por semanas e semanas
     já passadas até chegar ao dia de hoje. Agora:

       1. Uma semana já terminada (o domingo dela já passou) começa
          FECHADA — só o cabeçalho, sem os cartões. Toca no cabeçalho
          para abrir e consultar; toca outra vez para voltar a fechar.
          A semana atual e as futuras começam sempre abertas.
       2. Ao entrar no ecrã, salta-se automaticamente para a semana
          atual (ou a próxima semana com sessões, se não houver nada
          marcado exatamente para esta) — sem precisar de rolar até lá.

     `toggledWeeks` guarda só as semanas em que o treinador MEXEU no
     estado por omissão (abriu uma fechada, ou fechou a atual) — assim
     o comportamento por omissão continua a reagir ao calendário indo
     avançando, em vez de ficar preso ao que era true/false no dia em
     que se tocou. */
  const [toggledWeeks, setToggledWeeks] = useState(() => new Set());
  const toggleWeek = (weekKey) => setToggledWeeks(prev => {
    const next = new Set(prev);
    if (next.has(weekKey)) next.delete(weekKey); else next.add(weekKey);
    return next;
  });
  const weekRefs = useRef({});
  const scrolledRef = useRef(false);

  const doPrint = (s) => {
    setPrintDayDate(null);
    setPrintSession(s);
    setTimeout(() => {
      esperarImagensDoStorage().then(() => {
        window.print();
      });
    }, 80);
  };

  // Imprime TODAS as sessões de um dia numa única ficha; qualquer imagem
  // anexada aos exercícios sai na própria ficha, e qualquer PDF anexado
  // é aberto e impresso à parte, numa aba própria.
  const doPrintDay = (date) => {
    const daySessions = sessions.filter(s => s.date === date);
    setPrintSession(null);
    setPrintDayDate(date);
    setTimeout(() => {
      esperarImagensDoStorage().then(() => {
        window.print();
      });
    }, 80);
  };

  const doPrintMatch = (m) => {
    setPrintSession(null);
    setPrintDayDate(null);
    setPrintMatch(m);
    setTimeout(() => window.print(), 80);
  };
  /* As folhas de impressão vivem fora da app, montadas no body. Se
     ficassem lá depois de imprimir, a impressão seguinte levava as duas
     coladas. `afterprint` dispara quando o diálogo fecha, imprima-se ou
     cancele-se. */
  useEffect(() => {
    if (!printMatch) return undefined;
    const limpar = () => setPrintMatch(null);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [printMatch]);
  const doShareMatch = (m) => {
    const { title, html } = buildMatchShareHtml({ match: m, players, season });
    shareOrDownloadHtml(`jogo_${(m.opponent || 'adversario').replace(/[^\w-]+/g, '_')}_${m.date}.html`, html, title);
  };

  const doShare = (s) => {
    const meta = [fmtDate(s.date), s.phase, tempoJogoText(s), intensityText(s), s.opponent && `vs ${s.opponent}`].filter(Boolean);
    const exBlocks = (s.exerciseIds || []).map((e, i) => {
      const ex = exercises.find(x => x.id === e.exId);
      if (!ex) return null;
      const block = buildDiagramBlockHtml(ex.diagram, ex.space, `ex${i}`, ex.phase);
      const exMeta = [momentoTexto(ex), `Duração na sessão: ${e.duration} min`, ex.space, ex.playersCount && `👥 ${ex.playersCount}`, ex.material && `🎒 ${ex.material}`].filter(Boolean);
      return {
        ...block,
        heading: `${i + 1}. ${ex.name}`,
        html: `<div class="meta">${exMeta.map(escapeHtmlText).join(' · ')}</div>${ex.description ? `<p class="desc">${escapeHtmlText(ex.description)}</p>` : ''}${block.html}`,
      };
    }).filter(Boolean);
    const attendanceNames = (s.attendance || [])
      .map(pid => { const p = players.find(pl => pl.id === pid); return p ? (p.number ? `${p.number} ` : '') + p.name : null; })
      .filter(Boolean);
    /* As equipas guardadas pelo Simulador entram também no ficheiro
       partilhável, e não só na impressão: é o mesmo conteúdo e quem
       partilha a sessão quer levar as equipas com ela. */
    const equipasHtml = (s.equipasSimulador && (s.equipasSimulador.equipas || []).length)
      ? `<h2>Equipas</h2>${s.equipasSimulador.equipas.map(g => {
          const cabeca = [g.exercicio, g.zona ? `zona ${g.zona}` : '', g.turno ? `turno ${g.turno}` : '', g.equipa + (g.guardaRedes ? ' (GR)' : ''), g.minutos ? `${g.minutos} min` : '']
            .filter(Boolean).join(' · ');
          return `<p class="desc"><strong>${escapeHtmlText(cabeca)}:</strong> ${escapeHtmlText(g.jogadores.join(', '))}</p>`;
        }).join('')}`
      : '';
    /* Num amigável não há exercícios — a secção "Equipa" mostra antes o
       onze que jogou (titulares) e quem ficou no banco (suplentes). Vai
       buscá-los por `equipaDoAmigavel`, a mesma função da ficha impressa,
       para as duas nunca dizerem coisas diferentes. */
    const equipa = ehDiaDeJogo(s)
      ? equipaDoAmigavel({ session: s, jogo: jogoDaSessao(s), players })
      : null;
    const jogoHtml = equipa
      ? `<h2>Formação</h2>${campoDaEquipaHtml(equipa)}`
        + `<h2>Equipa</h2>${equipaEmColunasHtml(equipa.titulares, equipa.suplentes)}`
        + `<h2>Ideias para o jogo</h2><p class="desc">${escapeHtmlText(String(ideiasDaSessao(s) || '').trim() || '—')}</p>`
      : '';
    /* Num amigável a lista com toda a gente não entra: são os mesmos nomes
       que já saem em Titulares e Suplentes. Num treino é a única lista de
       presenças que existe, e mantém-se. */
    const presencasHtml = ehDiaDeJogo(s)
      ? ''
      : `<h2>Presenças</h2><p class="desc">${attendanceNames.length ? escapeHtmlText(attendanceNames.join(', ')) : 'Sem registo'}</p>`;
    const convidadosSessao = [...nomesDosConvidados(s), ...nomesDosConvidados(jogoDaSessao(s))];
    const convidadosHtml = convidadosSessao.length
      ? `<p class="desc"><strong>À experiência:</strong> ${escapeHtmlText(convidadosSessao.join(', '))}</p>`
      : '';
    const extraHtml = `${jogoHtml}${equipasHtml}${presencasHtml}${convidadosHtml}`;
    const sessionTitle = s.phase === 'Descanso' ? 'Folga' : (ehDiaDeJogo(s) ? tituloDiaDeJogo(jogoDaSessao(s)) : (s.focus || 'Sessão de treino'));
    const html = buildShareableHtmlDoc({ title: sessionTitle, metaLines: meta, blocks: exBlocks, extraHtml });
    shareOrDownloadHtml(`${(s.focus || 'sessao').replace(/[^\w-]+/g, '_')}_${s.date}.html`, html, sessionTitle);
  };

  const save = (data) => {
    const isEdicao = !!data.id;
    if (isEdicao) setSessions(prev => prev.map(s => s.id === data.id ? data : s));
    else setSessions(prev => [...prev, { ...data, id: uid() }]);
    if (isEdicao && modalVoltarDia) trocarJanela(() => setModal(null), () => setDayModalDate(data.date));
    else setModal(null);
  };
  const remove = (id) => removeWithUndo(sessions, setSessions, id, itemLabel(sessions.find(x => x.id === id), 'Sessão'));

  const saveMatch = (data) => {
    const isEdicao = !!data.id;
    const registo = podarPresencasForaDosConvocados(isEdicao ? data : { ...data, id: uid() });
    // As notas da equipa técnica só se escrevem no seu separador (Relatórios
    // de jogo): fica sempre a versão mais recente delas, nunca a do modal.
    if (isEdicao) setMatches(prev => prev.map(m => (m.id === data.id ? { ...registo, notasEquipaTecnica: m.notasEquipaTecnica } : m)));
    else setMatches(prev => [...prev, registo]);
    if (setConvocatorias) setConvocatorias(prev => syncMatchConvocatoria(registo, prev, season));
    setSessions(prev => ensureMatchSession(registo, prev));
    if (isEdicao && matchModalVoltarFicha) trocarJanela(() => setMatchModal(null), () => setFicha(registo));
    else setMatchModal(null);
  };

  /* A lista mostra treinos E jogos, para o calendário da semana ficar
     completo. Os jogos entram marcados com __match para se distinguirem
     das sessões (têm cartão e ações próprias) e não entram nas contas do
     resumo semanal, que é sobre carga de treino. */
  const matchItems = (matches || [])
    .filter(m => m.date)
    .map(m => ({ ...m, __match: true }));
  /* HISTÓRICO ORGANIZADO POR MÊS.

     Com o passar da época a lista ia acumulando semanas soltas umas por
     baixo das outras. Agora:
     - no topo, a semana atual e as próximas (abertas) — onde se trabalha;
     - depois, o histórico agrupado por mês, do mais recente para o mais
       antigo; cada mês fecha-se/abre-se, e só o mais recente vem aberto;
     - cada semana fechada mostra um resumo (sessões, minutos, jogos) em
       vez de só "N registos";
     - "Ir para" salta para qualquer data, abrindo o mês e a semana.

     As semanas passam a ter como chave a data da segunda-feira (ISO),
     e não o texto "Semana de 10/08" — esse texto repetia-se de uma época
     para a outra e juntava semanas de anos diferentes. */
  const grouped = {};
  [...sessions, ...matchItems]
    .filter(s => s.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach(s => { const k = getMonday(s.date); (grouped[k] = grouped[k] || []).push(s); });
  const primeiraSegunda = Object.keys(grouped)[0] || null;
  const rotuloSemana = (monday) => rotuloMicrociclo(monday, primeiraSegunda);
  /* A sessão que qualquer jogo cria automaticamente (ver ensureMatchSession,
     amigável ou oficial) continua a contar para a carga da semana — por
     isso entra em `grouped` tal e qual. Mas na Lista o jogo já tem o seu
     próprio cartão (com troféu, adversário e resultado); mostrar também a
     sessão dava duas linhas para o mesmo dia. `idsDeJogos` identifica
     essas sessões pelo `sourceMatchId` para esconder só o cartão a mais,
     sem tocar nos dados nem no resumo semanal. */
  const idsDeJogos = new Set((matches || []).map(m => m.id));

  // Segunda-feira de cada semana já agrupada, para decidir por omissão
  // se está terminada (fechada) e para encontrar a semana atual.
  const weekMondays = Object.fromEntries(Object.keys(grouped).map(w => [w, w]));
  const currentMonday = getMonday(todayStr());
  const isWeekPast = (week) => addDays(weekMondays[week], 6) < todayStr();
  const isWeekCollapsed = (week) => toggledWeeks.has(week) ? !isWeekPast(week) : isWeekPast(week);

  // Semana para onde saltar ao abrir o ecrã: a de hoje, senão a próxima
  // com algo marcado, senão a mais recente (para quem só tem passado).
  const orderedWeekKeys = Object.keys(grouped);
  const targetWeekKey = orderedWeekKeys.find(w => weekMondays[w] === currentMonday)
    || orderedWeekKeys.find(w => weekMondays[w] > currentMonday)
    || orderedWeekKeys[orderedWeekKeys.length - 1]
    || null;

  // A semana atual já está no topo — não é preciso saltar para ela ao
  // abrir. O salto agora é o do "Ir para" (ver `irParaData`).
  void scrolledRef; void targetWeekKey;

  const semanasAtuais = orderedWeekKeys.filter(w => !isWeekPast(w));
  const semanasPassadas = orderedWeekKeys.filter(w => isWeekPast(w)).reverse();
  const mesesHistorico = [];
  semanasPassadas.forEach(w => {
    const k = w.slice(0, 7);
    const ultimo = mesesHistorico[mesesHistorico.length - 1];
    if (ultimo && ultimo.key === k) ultimo.semanas.push(w);
    else mesesHistorico.push({ key: k, semanas: [w] });
  });
  const mesMaisRecente = mesesHistorico.length ? mesesHistorico[0].key : null;
  const [toggledMeses, setToggledMeses] = useState(() => new Set());
  const mesAberto = (k) => (toggledMeses.has(k) ? k !== mesMaisRecente : k === mesMaisRecente);
  const toggleMes = (k) => setToggledMeses(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const rotuloMes = (k) => {
    const [y, m] = k.split('-').map(Number);
    const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long' });
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${y}`;
  };
  const contarSemana = (items) => {
    const sess = items.filter(s => !s.__match);
    const min = sess.reduce((sum, s) => sum + (s.exerciseIds || []).reduce((a, e) => a + (Number(e.duration) || 0), 0), 0);
    return { sess: sess.length, min, jogos: items.filter(s => s.__match) };
  };
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const resumoSemana = (items) => {
    const c = contarSemana(items);
    const partes = [plural(c.sess, 'sessão', 'sessões'), `${c.min} min`];
    c.jogos.forEach(m => {
      const nj = numDoJogo(m);
      const etiqueta = isFriendlyMatch(m) ? 'Amigável' : (nj != null ? `J${nj}` : '');
      partes.push([etiqueta, m.opponent || 'Jogo', String(m.result || '').trim()].filter(Boolean).join(' '));
    });
    return partes.join(' · ');
  };
  const resumoMes = (semanas) => {
    let sess = 0; let jogos = 0;
    semanas.forEach(w => { const c = contarSemana(grouped[w]); sess += c.sess; jogos += c.jogos.length; });
    return [plural(semanas.length, 'semana', 'semanas'), plural(sess, 'sessão', 'sessões'), jogos ? plural(jogos, 'jogo', 'jogos') : '']
      .filter(Boolean).join(' · ');
  };

  // IR PARA — abre o mês e a semana da data escolhida e faz scroll até lá
  // (se nessa semana não houver nada, vai para a semana mais próxima).
  const [saltarPara, setSaltarPara] = useState(null);
  // Trocar de separador mantém a página exatamente onde estava.
  const scrollAntesRef = useRef(null);
  const trocarVista = (id) => {
    scrollAntesRef.current = window.scrollY;
    setView(id);
  };
  React.useLayoutEffect(() => {
    if (scrollAntesRef.current == null) return;
    window.scrollTo(0, scrollAntesRef.current);
    scrollAntesRef.current = null;
  }, [view]);
  const irParaData = (d) => {
    if (!d || !orderedWeekKeys.length) return;
    const alvo = getMonday(d);
    const w = orderedWeekKeys.includes(alvo)
      ? alvo
      : orderedWeekKeys.reduce((best, x) => (Math.abs(new Date(x) - new Date(alvo)) < Math.abs(new Date(best) - new Date(alvo)) ? x : best), orderedWeekKeys[0]);
    if (isWeekPast(w)) {
      const mk = w.slice(0, 7);
      if (!mesAberto(mk)) toggleMes(mk);
      if (isWeekCollapsed(w)) toggleWeek(w);
    } else {
      // Semana atual/futura vive no separador Microciclo.
      setView('lista');
      if (isWeekCollapsed(w)) toggleWeek(w);
    }
    setSaltarPara(w);
  };
  useEffect(() => {
    if (!saltarPara) return;
    const el = weekRefs.current[saltarPara];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setSaltarPara(null);
  }, [saltarPara]);

  const cabecalhoBloco = (texto) => (
    <div style={{ ...mono, fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.08em', margin: '4px 0 12px' }}>{texto}</div>
  );
  /* SEPARADORES: "Microciclo" é a semana atual e as próximas (onde se
     trabalha no dia a dia); "Histórico" são as semanas já terminadas,
     agrupadas por mês. */
  const renderListaPlaneamento = (renderSemana) => (view === 'lista' ? (
    semanasAtuais.length > 0
      ? <div>{semanasAtuais.map(w => renderSemana(w, grouped[w]))}</div>
      : <EmptyState
          text="Ainda não há nada planeado para esta semana nem para as próximas."
          action={<Btn onClick={() => { setModalVoltarDia(false); setModal('new'); }}><Plus size={15} /> Nova sessão</Btn>}
        />
  ) : (
    <>
      {mesesHistorico.length === 0 && (
        <EmptyState text="Ainda sem histórico — as semanas aparecem aqui depois de terminarem." />
      )}
      {mesesHistorico.length > 0 && (
        <div>
          {mesesHistorico.map(mes => {
            const aberto = mesAberto(mes.key);
            return (
              <div key={mes.key} style={{ marginBottom: 10 }}>
                <button
                  type="button" onClick={() => toggleMes(mes.key)}
                  style={{
                    /* Seta | mês, e o resumo SEMPRE na linha de baixo,
                       alinhado com o nome do mês (antes saltava de linha
                       num mês e não noutro, conforme o comprimento). */
                    display: 'grid', gridTemplateColumns: '15px minmax(0,1fr)', columnGap: 10, rowGap: 2, alignItems: 'center', width: '100%',
                    background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10,
                    padding: '11px 14px', cursor: 'pointer', textAlign: 'left', ...body,
                  }}
                >
                  <ChevronRight size={15} color={T.mutedDim} style={{ flexShrink: 0, transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                  <span style={{ fontSize: 14.5, color: T.cream, fontWeight: 600 }}>{rotuloMes(mes.key)}</span>
                  <span style={{ gridColumn: 2, fontSize: 12, color: T.mutedDim }}>{resumoMes(mes.semanas)}</span>
                </button>
                {aberto && (
                  <div style={{ padding: '14px 0 0 14px', borderLeft: `1px solid ${T.line}`, marginLeft: 20, marginTop: 6 }}>
                    {mes.semanas.map(w => renderSemana(w, grouped[w]))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  ));

  /* O caminho inverso de `sessaoDoJogo`: dada a sessão de um jogo
     (amigável ou oficial), qual é o jogo que lhe deu origem. É de lá que
     vêm as "Ideias para o jogo" para a ficha impressa — a sessão não as
     tem. Sessões antigas, ou criadas à mão antes de existir
     `sourceMatchId`, ainda se apanham pela data. */
  const jogoDaSessao = (s) => jogoRealDaSessao(s, matches);
  const ideiasDaSessao = (s) => { const m = jogoDaSessao(s); return m ? m.ideias : ''; };

  /* "Jogo" é UMA DAS OPÇÕES de "Fase de jogo (foco)" ao criar uma sessão
     normal — serve para marcar um treino de jogos condicionados, torneio,
     etc. Isso é diferente de a sessão SER um jogo a sério (amigável ou
     oficial), que é o que `jogoDaSessao` confirma (encontra o jogo que
     lhe deu origem). Confundir as duas coisas foi o que fazia uma sessão
     de treino normal, só porque tinha essa fase escolhida, imprimir a
     folha vazia de "Formação/Titulares/Suplentes" em vez dos exercícios
     e presenças que tinha a sério. Só quando HÁ um jogo por trás é que
     faz sentido mostrar a folha do jogo em vez da folha de treino. */
  const ehDiaDeJogo = (s) => !!jogoDaSessao(s);

  const isEditing = modal && modal !== 'new' && modal.id;
  const presetDate = modal && modal !== 'new' && !modal.id ? modal.presetDate : undefined;

  /* A sessão que o jogo criou (ou aproveitou) automaticamente — é dela que
     saem as equipas guardadas pelo Simulador, as presenças, e é nela que
     `doPrint`/`doShare` já sabem trabalhar (são as mesmas funções da
     ficha de uma sessão normal). Um jogo sem sessão associada (por
     exemplo, uma competição oficial num dia sem treino) simplesmente não
     tem o que imprimir/partilhar por aqui. */
  const sessaoDoJogo = (m) => (sessions || []).find(x => x.sourceMatchId === m.id) || (sessions || []).find(x => x.date === m.date);
  const temEquipasSessao = (s) => !!(s && s.equipasSimulador && (s.equipasSimulador.equipas || []).length > 0);

  return (
    <div>
      <SectionHeader title="Planeamento" subtitle="A semana de treino, sessão a sessão."
        action={<Btn onClick={() => { setModalVoltarDia(false); setModal('new'); }}><Plus size={15} /> Nova sessão</Btn>} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {orderedWeekKeys.length > 0 && (
          // Está sempre lá (só se vê no Histórico) — assim a linha dos
          // separadores tem sempre a mesma altura e nada salta ao trocar.
          <label style={{
            order: 2, marginLeft: isNarrow ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.mutedDim, ...body,
            visibility: view === 'historico' ? 'visible' : 'hidden',
          }}>
            Ir para
            <input
              type="date"
              onChange={e => { irParaData(e.target.value); }}
              style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
            />
          </label>
        )}
        {[['lista', 'Microciclo'], ['agenda', 'Agenda'], ['historico', 'Histórico']].map(([id, label]) => (
          <button key={id} onClick={() => trocarVista(id)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
            background: view === id ? '#B5393F' : 'transparent', color: view === id ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${view === id ? '#B5393F' : T.line}`,
          }}>{label}</button>
        ))}
      </div>

      {/* Altura mínima de um ecrã: ao trocar de separador, um conteúdo
          mais curto não encolhe a página nem a faz saltar para cima. */}
      <div style={{ minHeight: '100vh' }}>
      {view === 'agenda' ? (
        <WeekAgenda
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          sessions={sessions}
          matches={matches}
          onEdit={(s) => { setModalVoltarDia(false); setModal(s); }}
          onAddForDate={(d) => { setModalVoltarDia(false); setModal({ presetDate: d }); }}
          onEditMatch={(m) => { setMatchModalVoltarFicha(false); setMatchModal(m); }}
          season={season}
          primeiraSegunda={primeiraSegunda}
        />
      ) : sessions.length === 0 && matchItems.length === 0 ? (
        <EmptyState text="Ainda não há sessões planeadas." action={<Btn onClick={() => { setModalVoltarDia(false); setModal('new'); }}><Plus size={15} /> Criar a primeira sessão</Btn>} />
      ) : (
        renderListaPlaneamento((week, items) => {
          const collapsed = isWeekCollapsed(week);
          return (
          <div key={week} ref={el => { weekRefs.current[week] = el; }} style={{ marginBottom: 22 }}>
            <button
              type="button" onClick={() => toggleWeek(week)}
              style={{
                /* Seta | microciclo, e o resumo por baixo, alinhado com o
                   texto do microciclo (antes ficava ao lado, desalinhado). */
                display: 'grid', gridTemplateColumns: '13px minmax(0,1fr)', columnGap: 6, rowGap: 3, alignItems: 'center', width: '100%',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', marginBottom: 8, ...body,
              }}
            >
              <ChevronRight size={13} color={T.mutedDim} style={{ flexShrink: 0, transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform .15s' }} />
              <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rotuloSemana(week)}</span>
              {collapsed && (
                <span style={{ gridColumn: 2, fontSize: 12, color: T.muted, minWidth: 0, lineHeight: 1.45 }}>
                  {resumoSemana(items)}
                </span>
              )}
            </button>
            {!collapsed && (
              <>
            <WeekSummary items={items} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.filter(s => s.__match || !(s.sourceMatchId && idsDeJogos.has(s.sourceMatchId))).map(s => s.__match ? (() => {
                const sessaoJogo = sessaoDoJogo(s);
                const equipasDoJogo = temEquipasSessao(sessaoJogo);
                return (
                <div key={`m-${s.id}`} onClick={() => setFicha(s)} style={{
                  background: T.surface, border: `1px solid ${T.warn}55`, borderRadius: 10, padding: 14, cursor: 'pointer',
                  display: 'flex', gap: 10,
                  ...(isNarrow
                    ? { flexDirection: 'column', alignItems: 'stretch' }
                    : { justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }),
                }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                    <div style={{ textAlign: 'center', width: 46, flexShrink: 0 }}>
                      <div style={{ ...display, color: T.warn, fontSize: 18, fontWeight: 600 }}>{new Date(s.date + 'T00:00:00').getDate()}</div>
                      <div style={{ fontSize: 10, color: T.mutedDim, textTransform: 'uppercase' }}>{new Date(s.date + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short' })}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.cream, fontSize: 14.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Trophy size={13} color={T.warn} /> vs {s.opponent || 'Adversário por definir'}
                      </div>
                      <div style={{ color: T.mutedDim, fontSize: 12 }}>
                        {[competitionLabel(s.competition) || 'Jogo', s.atHome === undefined ? null : (s.atHome ? 'Casa' : 'Fora'), s.result].filter(Boolean).join(' · ')}
                        {/* Mesmo sinal que já existia nas sessões de treino —
                            só que este jogo tinha o cartão próprio escondido,
                            e o sinal nunca aparecia em lado nenhum. */}
                        {equipasDoJogo && (
                          <span style={{ color: T.warn }} title="Equipas do Simulador guardadas — saem na ficha impressa"> · equipas guardadas</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    ...(isNarrow ? { justifyContent: 'space-between', paddingLeft: 60 } : { gap: 8 }),
                  }}>
                    <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(s.convocados || []).length + convidadosDe(s).length} {isFriendlyMatch(s) ? 'presentes' : 'convocados'}
                    </span>
                    {/* OS ÍCONES VIVEM NUM BLOCO PRÓPRIO.

                        Soltos ao lado do texto, o `space-between` do
                        telemóvel espalhava-os um a um pela largura toda e
                        cada cartão os punha num sítio diferente. Fechados
                        aqui dentro são UM só elemento: o texto encosta à
                        esquerda, o grupo encosta à direita, com o mesmo
                        espaçamento dos cartões de treino — que é como
                        estão em toda a app.

                        `stopPropagation` em todos: sem isto, cada ícone
                        abria também a ficha do jogo por baixo.
                        Partilhar/Imprimir usam a sessão do jogo (mesmas
                        funções da ficha de uma sessão normal) — só
                        aparecem se existir essa sessão. */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                      {equipasDoJogo && (
                        <button onClick={e => { e.stopPropagation(); setSessions(prev => prev.map(x => (x.id === sessaoJogo.id ? { ...x, equipasSimulador: null, simuladorConfig: null } : x))); }} title="Apagar equipas guardadas" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Trash2 size={14} /></button>
                      )}
                      {sessaoJogo && (
                        <>
                          <button onClick={e => { e.stopPropagation(); setSimuladorDia(sessaoJogo.date); }} title="Distribuir equipas para este jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Shuffle size={14} /></button>
                          {/* Imprimir e partilhar dão a FICHA DO JOGO — a mesma de
                              Jogos e de abrir o jogo aqui ("Imprimir"). Antes davam a
                              folha da sessão do dia, com outro cabeçalho. O onze
                              escolhido no Simulador já passa para o jogo, por isso
                              aparece na mesma. */}
                          <button onClick={e => { e.stopPropagation(); doShareMatch(s); }} title="Partilhar ficha do jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Share2 size={14} /></button>
                          <button onClick={e => { e.stopPropagation(); doPrintMatch(s); }} title="Imprimir ficha do jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Printer size={14} /></button>
                        </>
                      )}
                      {/* Jogos gravados antes de `ensureMatchSession` passar
                          a cobrir também os oficiais (ou sem `setSessions`
                          disponível) podem ainda não ter sessão associada
                          — por isso ficavam sem nenhum ícone de partilhar
                          ou imprimir aqui. `doShareMatch`/`doPrintMatch` já
                          existiam (usados pela janela de leitura do jogo);
                          faltava só pô-los também no cartão, para não
                          obrigar a abrir a ficha primeiro só para imprimir. */}
                      {!sessaoJogo && (
                        <>
                          <button onClick={e => { e.stopPropagation(); doShareMatch(s); }} title="Partilhar ficha do jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Share2 size={14} /></button>
                          <button onClick={e => { e.stopPropagation(); doPrintMatch(s); }} title="Imprimir ficha do jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Printer size={14} /></button>
                        </>
                      )}
                      <button onClick={e => { e.stopPropagation(); setMatchModalVoltarFicha(false); setMatchModal(s); }} title="Editar jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Pencil size={14} /></button>
                    </div>
                  </div>
                </div>
                );
              })() : (
                /* No telemóvel o cartão parte-se em dois andares: em cima a
                   data e o título, em baixo o resumo à esquerda e os ícones
                   à direita. Assim os ícones ficam na mesma coluna em todos
                   os cartões, em vez de saltarem conforme o comprimento do
                   texto (era o caso do "Dia de folga", muito mais curto). */
                <div key={s.id} style={{
                  background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14,
                  display: 'flex', gap: 10,
                  ...(isNarrow
                    ? { flexDirection: 'column', alignItems: 'stretch' }
                    : { justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }),
                }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                    <div
                      onClick={() => setDayModalDate(s.date)}
                      title="Ver todos os treinos deste dia"
                      style={{ textAlign: 'center', width: 46, flexShrink: 0, cursor: 'pointer' }}
                    >
                      <div style={{ ...display, color: T.warn, fontSize: 18, fontWeight: 600 }}>{new Date(s.date + 'T00:00:00').getDate()}</div>
                      <div style={{ fontSize: 10, color: T.mutedDim, textTransform: 'uppercase' }}>{new Date(s.date + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short' })}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.cream, fontSize: 14.5, fontWeight: 500 }}>{s.phase === 'Descanso' ? 'Folga' : (s.focus || 'Sessão de treino')}</div>
                      <div style={{ color: T.mutedDim, fontSize: 12 }}>{[s.phase, s.opponent && `vs ${s.opponent}`, intensityText(s)].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    ...(isNarrow ? { justifyContent: 'space-between', paddingLeft: 60 } : { gap: 8 }),
                  }}>
                    <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {/* O total inclui os convidados: quem lê "23 presentes"
                          quer saber quantas pessoas vão estar no campo, não
                          quantas pertencem ao plantel. A distinção continua
                          a fazer-se onde importa — nas médias, de onde eles
                          nunca entram. */}
                      {s.phase === 'Descanso' ? 'Dia de folga' : `${(s.exerciseIds || []).length} exercícios · ${(s.attendance || []).length + convidadosDe(s).length} presentes`}
                      {/* Sinal de que o Simulador já deixou aqui as equipas.
                          Sem isto, o "Guardar equipas no treino" parecia não
                          fazer nada: a informação existia mas só aparecia na
                          ficha impressa. */}
                      {s.equipasSimulador && (s.equipasSimulador.equipas || []).length > 0 && (
                        <span style={{ color: T.warn }} title="Equipas do Simulador guardadas — saem na ficha impressa">
                          {' · '}equipas guardadas
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                      {temEquipasSessao(s) && (
                        <button onClick={() => setSessions(prev => prev.map(x => (x.id === s.id ? { ...x, equipasSimulador: null, simuladorConfig: null } : x)))} title="Apagar equipas guardadas" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Trash2 size={14} /></button>
                      )}
                      {/* O Simulador abre A PARTIR DO DIA, com a data já
                          escolhida. Quando era separador próprio, o dia
                          escolhia-se lá dentro e começava em hoje — bastava
                          esquecer de o mudar para o "Guardar equipas" não
                          encontrar sessão nenhuma e não fazer nada. Vindo
                          daqui, esse engano deixa de ser possível. */}
                      <button onClick={() => setSimuladorDia(s.date)} title="Distribuir equipas para este treino" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Shuffle size={14} /></button>
                      <button onClick={() => doShare(s)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }} title="Partilhar como ficheiro"><Share2 size={14} /></button>
                      <button onClick={() => doPrint(s)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }} title="Imprimir ficha"><Printer size={14} /></button>
                      <button onClick={() => { setModalVoltarDia(false); setModal(s); }} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }} title="Editar sessão"><Pencil size={14} /></button>
                      <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }} title="Apagar sessão"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
              </>
            )}
          </div>
          );
        })
      )}
      </div>

      {/* O SIMULADOR EM ECRÃ INTEIRO, POR CIMA DO PLANEAMENTO.

          Precisa da largura toda — 37 chips de jogadores, os blocos do
          plano, a grelha de equipas. Num canto não cabia. O que muda em
          relação ao separador que era é só o caminho: abre-se de um dia
          concreto e fecha-se de volta para ele. */}
      {simuladorDia && (
        <div ref={simuladorScrollRef} style={{
          position: 'fixed', inset: 0, zIndex: 60, background: T.bg,
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 20px 60px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <Btn variant="ghost" onClick={fecharSimulador}>
                <ChevronLeft size={15} /> Voltar ao Planeamento
              </Btn>
            </div>
            <Simulador
              players={players}
              exercises={exercises}
              sessions={sessions}
              setSessions={setSessions}
              matches={matches}
              setMatches={setMatches}
              clinico={clinico}
              diaInicial={simuladorDia}
            />
          </div>
          <BotaoTopo alvoRef={simuladorScrollRef} isMobile={isMobile} onFechar={fecharSimulador} soAlvo />
        </div>
      )}

      {modal && (
        <SessionModal
          session={isEditing ? modal : null}
          presetDate={presetDate}
          exercises={exercises}
          setExercises={setExercises}
          exercisesMeta={exercisesMeta}
          sessions={sessions}
          setSessions={setSessions}
          matches={matches}
          players={players}
          clinico={clinico}
          onIntegrarConvidado={(c, setLista, lista) => integrarConvidado({
            convidado: c, players, setPlayers,
            aoRetirar: () => setLista && setLista((lista || []).filter(x => x.id !== c.id)),
          })}
          onClose={() => (isEditing && modalVoltarDia ? trocarJanela(() => setModal(null), () => setDayModalDate(modal.date)) : setModal(null))}
          onSave={save}
        />
      )}

      {/* A ficha lê sempre a versão mais recente do jogo: se for editado
          por baixo (aqui ou em Jogos, é o mesmo estado), o que se vê aqui
          acompanha. */}
      {ficha && (() => {
        const atual = (matches || []).find(m => m.id === ficha.id);
        if (!atual) return null;
        // Mexer no onze na ficha grava no jogo E na convocatória (ver Jogos).
        const mudarJogoNaFicha = (jogo, patch) => {
          // Lugares e titulares andam sempre juntos: os titulares são quem
          // está nos lugares.
          if (Array.isArray(patch.alinhamento) && !patch.starters) patch = { ...patch, starters: patch.alinhamento.filter(Boolean) };
          const novo = podarPresencasForaDosConvocados({ ...jogo, ...patch });
          setMatches(prev => prev.map(m => (m.id === jogo.id ? { ...m, ...patch } : m)));
          if (setConvocatorias) setConvocatorias(prev => syncMatchConvocatoria(novo, prev, season));
        };
        return (
          <FichaJogo
            match={atual}
            players={players}
            season={season}
            onClose={() => setFicha(null)}
            onEdit={() => { setMatchModalVoltarFicha(true); trocarJanela(() => setFicha(null), () => setMatchModal(atual)); }}
            onShare={() => doShareMatch(atual)}
            onPrint={() => doPrintMatch(atual)}
            onFormacao={(fm) => {
              // Mudar o sistema mantém os mesmos titulares (reencaixados), nunca
              // os troca nem os tira do onze.
              const e = escalacaoNovaFormacao(escalacaoDoJogo(atual, comQuemLaEsteve(players, atual)), fm, comQuemLaEsteve(players, atual));
              const titulares = e.slots.filter(Boolean);
              const banco = (atual.convocados || []).filter(id => !titulares.includes(id));
              mudarJogoNaFicha(atual, { formacao: fm, alinhamento: e.slots, starters: titulares, convocados: [...titulares, ...banco] });
            }}
            onAlinhamento={(lista) => mudarJogoNaFicha(atual, { alinhamento: lista })}
            onStarters={(lista) => mudarJogoNaFicha(atual, { starters: lista })}
            onEscalacao={(patch) => mudarJogoNaFicha(atual, patch)}
            onIdeias={(texto) => setMatches(prev => prev.map(m => (m.id === atual.id ? { ...m, ideias: texto } : m)))}
            clinico={clinico}
            matches={matches}
          />
        );
      })()}

      {matchModal && (
        <MatchModal matches={matches}
          match={matchModal}
          players={players}
          standings={standings}
          season={season}
          clinico={clinico}
          onClose={() => (matchModalVoltarFicha ? trocarJanela(() => setMatchModal(null), () => setFicha(matchModal)) : setMatchModal(null))}
          onSave={saveMatch}
        />
      )}

      {printFolha && createPortal(
        (() => {
          const doDia = sessions.filter(x => x.date === printFolha.date);
          const presentes = players.filter(p => doDia.some(x => (x.attendance || []).includes(p.id)));
          const convidados = doDia.flatMap(x => convidadosDe(x));

          if (printFolha.tipo === 'prancheta') {
            /* A TÁCTICA E AS ARRUMAÇÕES VÊM DA MESMA SESSÃO.

               Antes procurava-se cada uma por sua conta: a táctica na
               primeira sessão que tivesse táctica, as arrumações na
               primeira que tivesse arrumações. Num dia com dois treinos,
               podiam vir de sessões diferentes — e uma arrumação feita
               num 4-4-2 aplicada a um 4-3-3 manda gente para lugares que
               nessa formação não existem, e daí para "Sem lugar".

               É a sessão que pediu o quadro que manda nos dois. */
            const dona = doDia.find(x => x.imprimirPlantel) || doDia[0] || {};
            const lugares = distribuirPlantel({
              players,
              attendance: doDia.flatMap(x => x.attendance || []),
              convidados,
              overrides: dona.prancheta,
              tatica: dona.pranchetaTatica,
            });
            return (
              <div className="print-sheet">
                <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Plantel</h2>
                <p style={{ margin: '0 0 16px', fontSize: 12.5 }}>{fmtDate(printFolha.date)}</p>
                <PrancheteDoPlantel lugares={lugares} escala={1.35} maxLargura={400} />

                {/* OS DESENHOS TÁCTICOS DO DIA, A SEGUIR AO QUADRO.

                    Quem leva esta folha para o campo tem ali quem está e
                    onde — falta o que se vai fazer. Sai o primeiro
                    momento de cada exercício do dia, pela ordem do plano,
                    que é o suficiente para reconhecer o exercício sem
                    trazer o plano todo atrás. */}
                {(() => {
                  /* `exerciseIds` guarda `{ exId, duration }` e não ids,
                     apesar do nome — está documentado mais abaixo e eu
                     voltei a cair nele: procurava `ref.id`, que não
                     existe, e a lista saía sempre vazia. Daí os desenhos
                     nunca aparecerem na folha.

                     Sem repetidos: o mesmo exercício em duas sessões do
                     mesmo dia é o mesmo desenho. */
                  const vistos = new Set();
                  const desenhos = [];
                  doDia.forEach(sessao => {
                    (sessao.exerciseIds || []).forEach(item => {
                      const exId = item && (item.exId || item.id);
                      if (!exId || vistos.has(exId)) return;
                      const ex = exercises.find(e => e.id === exId);
                      if (ex && ex.diagram) { vistos.add(exId); desenhos.push(ex); }
                    });
                  });
                  if (!desenhos.length) return null;
                  return (
                    <div style={{ marginTop: 22 }}>
                      {/* Dois em cima e dois em baixo.

                          Com três por linha cabia mais, mas cada desenho
                          ficava pequeno de mais para se distinguirem os
                          jogadores — e uma folha que não se lê não serve de
                          nada, por mais que caiba. A dois por linha o campo
                          de cima tem de encolher, e é o que faz o conjunto
                          caber numa página. */}
                      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Exercícios do dia</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {desenhos.map((ex, i) => {
                          const d = diagramaParaImpressao(ex.diagram);
                          return (
                            <div key={`${ex.id}-${i}`} style={{ breakInside: 'avoid' }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                                {i + 1}. {ex.name}
                              </div>
                              <svg
                                viewBox={viewBoxSemBancos(ex.diagram && ex.diagram.vista)}
                                style={{
                                  width: '100%', aspectRatio: aspetoSemBancos(ex.diagram && ex.diagram.vista), display: 'block',
                                  background: '#fff', border: '1px solid #ccc', borderRadius: 6,
                                }}
                              >
                                <VistaCampo esticar={ESTICAR_IMPRESSAO_MEIO} vista={ex.diagram && ex.diagram.vista}>
                                <PitchMarkings printMode semBancos />
                                <SpaceZonesReadOnly diagram={ex.diagram} spaceText={ex.space} printMode />
                                <DiagramElements
                                  elements={d.elements} arrows={d.arrows}
                                  interactive={false} iconScale={iconScaleForPhase(ex.phase, ex.diagram)} printMode
                                />
                                </VistaCampo>
                              </svg>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* AS EQUIPAS GUARDADAS PELO SIMULADOR SAEM TAMBÉM AQUI.

                    Já saem na folha do plano do dia, junto a cada
                    exercício — e saem aqui também, porque a prancheta é
                    outra folha (para outro momento: o campo com o
                    plantel distribuído por lugares) e fica incompleta
                    sem dizer quem joga em cada equipa de cada exercício.
                    Um treinador que leve só a prancheta para o campo não
                    devia ficar sem essa informação. */}
                {(() => {
                  const blocos = [];
                  doDia.forEach(sessao => {
                    (sessao.exerciseIds || []).forEach(item => {
                      const exId = item && (item.exId || item.id);
                      if (!exId) return;
                      const ex = exercises.find(e => e.id === exId);
                      if (!ex) return;
                      const equipas = equipasDoExercicio((sessao.equipasSimulador || {}).equipas, ex);
                      if (equipas.length) blocos.push({ key: `${sessao.id}-${exId}`, nome: ex.name, equipas });
                    });
                  });
                  if (!blocos.length) return null;
                  return (
                    <div style={{ marginTop: 22 }}>
                      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Equipas</h3>
                      {blocos.map(b => (
                        <div key={b.key} style={{ marginBottom: 14, breakInside: 'avoid' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{b.nome}</div>
                          <PrintEquipasBlock equipas={b.equipas} />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          }

          /* FOLHA DE PRESENÇAS PARA ASSINALAR À MÃO.

             Não é a lista de quem está — é a lista de TODO o plantel com
             uma caixa ao lado. Quem a leva para o campo ainda não sabe
             quem apareceu; é isso que vai marcar. Uma folha só com os
             presentes não serviria para nada. */
          return (
            <div className="print-sheet">
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Presenças</h2>
              <p style={{ margin: '0 0 16px', fontSize: 12.5 }}>
                {fmtDate(printFolha.date)}{presentes.length ? ` · ${presentes.length} marcados na app` : ''}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 26px' }}>
                {sortByPosition(players).map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '5px 0', borderBottom: '1px solid #e6e6e6', fontSize: 12,
                  }}>
                    <span style={{ width: 13, height: 13, border: '1px solid #555', borderRadius: 3, flexShrink: 0 }} />
                    <span style={{ width: 22, color: '#888', textAlign: 'right', flexShrink: 0 }}>{p.number || ''}</span>
                    <span style={{ width: 26, color: '#888', flexShrink: 0 }}>{p.position || ''}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </div>
                ))}
              </div>
              {convidados.length > 0 && (
                <>
                  <h3 style={{ fontSize: 14, margin: '18px 0 6px' }}>À experiência</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 26px' }}>
                    {convidados.map(c => (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '5px 0', borderBottom: '1px solid #e6e6e6', fontSize: 12,
                      }}>
                        <span style={{ width: 13, height: 13, border: '1px solid #555', borderRadius: 3, flexShrink: 0 }} />
                        <span style={{ width: 26, color: '#888', flexShrink: 0 }}>{c.position || ''}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>{c.nome}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })(),
        document.body,
      )}
      {printMatch && createPortal(
        <PrintFichaJogo match={printMatch} players={players} season={season} />,
        document.body,
      )}

      {printSession && createPortal(
        <div className="print-sheet">
          <h2 style={{ margin: '0 0 4px', fontSize: 24 }}>
            {printSession.phase === 'Descanso' ? 'Folga' : (ehDiaDeJogo(printSession) ? tituloDiaDeJogo(jogoDaSessao(printSession)) : (printSession.focus || 'Sessão de treino'))}
          </h2>
          <p style={{ margin: '0 0 18px', fontSize: 13 }}>
            {[fmtDate(printSession.date), printSession.phase, tempoJogoText(printSession), intensityText(printSession), printSession.opponent && `vs ${printSession.opponent}`].filter(Boolean).join(' · ')}
          </p>

          {ehDiaDeJogo(printSession) ? (
            <PrintOnzeAmigavel session={printSession} jogo={jogoDaSessao(printSession)} players={players} ideias={ideiasDaSessao(printSession)} />
          ) : (
            <>
              <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Exercícios</h3>
              {(printSession.exerciseIds || []).map((e, i) => (
                <PrintExerciseBlock
                  key={e.exId}
                  e={e}
                  ex={exercises.find(x => x.id === e.exId)}
                  index={i}
                  equipas={equipasDoExercicio(
                    (printSession.equipasSimulador || {}).equipas,
                    exercises.find(x => x.id === e.exId),
                  )}
                  trocas={((printSession.equipasSimulador || {}).trocas || []).filter(t => {
                    const ex = exercises.find(x => x.id === e.exId);
                    return ex && t.exercicio === ex.name;
                  })}
                />
              ))}
              {/* As equipas do Simulador saem aqui E também na Prancheta
                  (ver mais abaixo, `printFolha.tipo === 'prancheta'`) — o
                  plano de treino continua a mostrá-las junto do exercício
                  a que pertencem, tal como sempre foi. */}
            </>
          )}

          {/* Num amigável esta lista era repetição pura: os mesmos nomes
              já saem em Titulares e Suplentes, logo acima. Num treino
              continua a ser a única lista de presenças que há, e fica. */}
          {/* A PRANCHETA NÃO SAI AQUI.

              A folha da sessão é o plano de treino. O quadro de posições
              é outra coisa e imprime-se à parte, pelo botão "Prancheta"
              no dia — quem leva o plano para o campo não quer um campo de
              nomes atrás, e quem quer o campo de nomes não quer o plano. */}

          {!ehDiaDeJogo(printSession) && (
            <>
              <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Presenças</h3>
              <PrintPresencasPorPosicao
                presentPlayers={(printSession.attendance || []).map(pid => players.find(pl => pl.id === pid)).filter(Boolean)}
                allPlayers={players}
              />
              {/* Numa lista à parte e identificados: quem leva o papel para
                  o campo precisa deles, mas não pode confundi-los com o
                  plantel ao contar. */}
              {nomesDosConvidados(printSession).length > 0 && (
                <p style={{ fontSize: 13, margin: '10px 0 0' }}>
                  <strong>À experiência:</strong> {nomesDosConvidados(printSession).join(', ')}
                </p>
              )}
            </>
          )}
        </div>,
        document.body
      )}

      {dayModalDate && (
        <DayModal
          date={dayModalDate}
          daySessions={sessions.filter(s => s.date === dayModalDate)}
          exercises={exercises}
          players={players}
          onClose={() => setDayModalDate(null)}
          onPrint={() => doPrintDay(dayModalDate)}
          onPrintPresencas={() => doPrintFolha(dayModalDate, 'presencas')}
          onPrintPrancheta={() => doPrintFolha(dayModalDate, 'prancheta')}
          onEditSession={(s) => { setModalVoltarDia(true); trocarJanela(() => setDayModalDate(null), () => setModal(s)); }}
        />
      )}

      {printDayDate && createPortal(
        <div className="print-sheet">
          <h2 style={{ margin: '0 0 4px', fontSize: 24 }}>{fmtDate(printDayDate)}</h2>
          {sessions.filter(s => s.date === printDayDate).map(s => (
            <div key={s.id} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 17, margin: '0 0 4px' }}>{s.phase === 'Descanso' ? 'Folga' : (ehDiaDeJogo(s) ? tituloDiaDeJogo(jogoDaSessao(s)) : (s.focus || 'Sessão de treino'))}</h3>
              <p style={{ margin: '0 0 12px', fontSize: 13 }}>
                {[s.phase, tempoJogoText(s), intensityText(s), s.opponent && `vs ${s.opponent}`].filter(Boolean).join(' · ')}
              </p>
              {ehDiaDeJogo(s) ? (
                <PrintOnzeAmigavel session={s} jogo={jogoDaSessao(s)} players={players} ideias={ideiasDaSessao(s)} />
              ) : (
                (s.exerciseIds || []).map((e, i) => (
                  <PrintExerciseBlock key={e.exId} e={e} ex={exercises.find(x => x.id === e.exId)} index={i} />
                ))
              )}
            </div>
          ))}
          {/* Num dia só de amigável os nomes já saíram em Titulares e
              Suplentes — repeti-los aqui em baixo não acrescenta nada. Se
              o dia também tiver treino (ou uma sessão só com a fase de
              jogo escolhida como foco, mas sem jogo a sério por trás), a
              lista mantém-se: aí é mesmo a única folha de presenças. */}
          {sessions.some(s => s.date === printDayDate && !ehDiaDeJogo(s)) && (
            <>
              <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Presenças</h3>
              <PrintPresencasPorPosicao
                presentPlayers={players.filter(p => sessions.some(s => s.date === printDayDate && !ehDiaDeJogo(s) && (s.attendance || []).includes(p.id)))}
                allPlayers={players}
              />
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export function WeekSummary({ itemsRaw, items: itemsProp }) {
  const todos = itemsProp || itemsRaw || [];

  /* OS JOGOS CONTAM PARA A CARGA DA SEMANA.

     Antes eram excluídos, e o resumo dizia "1× Alta" numa semana com dois
     amigáveis — a leitura ficava errada precisamente onde mais interessa,
     que é perceber quanto é que a equipa levou.

     Um jogo é carga alta por definição: 90 minutos em competição pesam
     mais do que qualquer treino. Por isso entram como fase "Jogo" e
     intensidade alta, sem ser preciso lançar nada à mão.

     Os minutos ficam de fora: o total em minutos é a soma das durações
     dos exercícios planeados, e um jogo não tem exercícios. Somar-lhe 90
     minutos misturaria duas coisas que se medem de maneiras diferentes. */
  const sessoes = todos.filter(s => !s.__match);
  const jogos = todos.filter(s => s.__match);
  const items = sessoes;

  const totalMin = items.reduce((sum, s) => sum + (s.exerciseIds || []).reduce((a, e) => a + (Number(e.duration) || 0), 0), 0);
  const phaseCounts = {};
  items.forEach(s => { phaseCounts[s.phase] = (phaseCounts[s.phase] || 0) + 1; });
  if (jogos.length) phaseCounts.Jogo = (phaseCounts.Jogo || 0) + jogos.length;

  const intensityCounts = { baixa: 0, media: 0, alta: 0 };
  items.forEach(s => { if (intensityCounts[s.intensity] != null) intensityCounts[s.intensity]++; });
  intensityCounts.alta += jogos.length;
  const intensitySummary = INTENSITIES.filter(i => intensityCounts[i.value] > 0).map(i => `${intensityCounts[i.value]}× ${i.label}`).join(' · ');
  // Lista vertical: em coluna, cada indicador na sua linha — em ecrã
  // estreito a versão em linha partia-se a meio e ficava confusa.
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim,
      marginBottom: 8, padding: '10px 12px', background: T.surface, borderRadius: 8, border: `1px solid ${T.line}`,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.cream }}>
        <TrendingUp size={12} color={T.warn} /> {items.length} {items.length === 1 ? 'sessão' : 'sessões'} · {totalMin} min
        {jogos.length > 0 && <span style={{ color: T.mutedDim }}> · {jogos.length} {jogos.length === 1 ? 'jogo' : 'jogos'}</span>}
      </span>
      {intensitySummary && <span>Intensidade: <span style={{ color: T.warn }}>{intensitySummary}</span></span>}
      {Object.entries(phaseCounts).map(([ph, c]) => (
        <span key={ph}>{ph}: <span style={{ color: T.warn }}>{c}</span></span>
      ))}
    </div>
  );
}

export function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalISODate(d);
}

/* ---------------------------------------------------------------
   AGENDA SEMANAL — vista de calendário Seg-Dom, criada a partir
   do Planeamento, com edição direta de cada sessão.
---------------------------------------------------------------- */
export function WeekAgenda({ weekStart, setWeekStart, sessions, matches, onEdit, onAddForDate, onEditMatch, season, primeiraSegunda }) {
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
  const currentDayStr = todayStr();
  // No telemóvel a semana passa a 3 colunas (3 dias em cima, 3 no meio e o
  // domingo em baixo) — assim vê-se a semana inteira sem arrastar para o
  // lado. Em ecrã largo mantém-se a linha única com os 7 dias.
  const isMobile = useIsMobile(700);
  // Mesma lógica da Lista: a sessão que um amigável cria sozinho não
  // aparece aqui também — o jogo já tem o seu próprio cartão no dia.
  const idsDeJogos = new Set((matches || []).map(m => m.id));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 6, color: T.cream, cursor: 'pointer', padding: '4px 6px' }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ ...display, color: T.warn, fontSize: 15, fontWeight: 600 }}>
          {numeroMicrociclo(weekStart, primeiraSegunda) ? `Microciclo ${numeroMicrociclo(weekStart, primeiraSegunda)} · ` : 'Semana de '}{fmtShort(days[0])} a {fmtShort(days[6])}
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 6, color: T.cream, cursor: 'pointer', padding: '4px 6px' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{
        display: 'grid', gap: 8,
        /* No TELEMÓVEL, um dia por linha (agenda), com os cartões à
           largura toda: em três colunas os nomes ficavam em reticências. */
        ...(isMobile
          ? { gridTemplateColumns: '1fr' }
          : { gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', overflowX: 'auto' }),
      }}>
        {days.map(d => {
          const daySessions = sessions.filter(s => s.date === d && !(s.sourceMatchId && idsDeJogos.has(s.sourceMatchId)));
          const dayMatches = (matches || []).filter(m => m.date === d);
          const isToday = d === currentDayStr;
          return (
            <div key={d} style={{
              background: T.surface, border: `1px solid ${isToday ? T.gold : T.line}`, borderRadius: 8, padding: isMobile ? 10 : 8, minHeight: isMobile ? 0 : 140,
              // Coluna: os cartões em cima e o "+ sessão" SEMPRE no fundo
              // (marginTop auto) — como todos os dias da linha têm a mesma
              // altura, os "+ sessão" ficam alinhados de ponta a ponta.
              display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 10 : 0,
            }}>
              <div style={isMobile ? { width: 46, flexShrink: 0 } : undefined}>
                <div style={{ fontSize: 10.5, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.04em' }}>{isMobile ? dayLabel(d).slice(0, 3) : dayLabel(d)}</div>
                <div style={{ ...mono, fontSize: isMobile ? 18 : 15, color: isToday ? T.warn : T.cream, marginBottom: 8 }}>{new Date(d + 'T00:00:00').getDate()}</div>
              </div>
              <div style={isMobile ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } : { display: 'contents' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 6 }}>
                {/* JOGO — cartão CLARO (fundo creme, texto escuro), com a
                    etiqueta "JOGO": fica fora das três cores de intensidade
                    dos treinos, por isso nunca se confunde com um treino
                    de intensidade alta, e salta à vista na semana. */}
                {dayMatches.map(m => (
                  <button key={m.id} onClick={() => onEditMatch(m)} style={{
                    ...CARTAO_AGENDA, ...body,
                    color: T.sobreCream, background: T.cream, border: `1px solid ${T.cream}`,
                    flexDirection: 'row', alignItems: 'flex-start', gap: 5, fontWeight: 600,
                  }}>
                    <Trophy size={11} color={T.sobreCream} style={{ marginTop: 1, flexShrink: 0 }} />
                    {/* Adversário numa linha e a competição em até duas, em
                        baixo — assim o nome do campeonato cabe inteiro. */}
                    <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignSelf: 'stretch' }}>
                      <span style={isMobile ? undefined : LINHAS(1)}>vs {m.opponent || 'Adversário'}</span>
                      <span
                        title={m.result || competitionLabel(m.competition) || 'Jogo'}
                        style={{ ...(isMobile ? {} : LINHAS(2)), fontSize: isMobile ? 11.5 : 9.5, color: T.sobreCream, opacity: 0.67, marginTop: 'auto', fontWeight: 400 }}
                      >{isMobile ? [m.result, competitionLabel(m.competition)].filter(Boolean).join(' · ') || 'Jogo' : (m.result || competitionLabel(m.competition) || 'Jogo')}</span>
                    </span>
                  </button>
                ))}
                {daySessions.map(s => {
                  // Dia de folga: mostra "Folga" em vez de "Sessão" — não há
                  // treino nem foco a apresentar.
                  const isRest = s.phase === 'Descanso';
                  // Cor pela intensidade: alta vermelho, média amarelo,
                  // baixa verde. Sem intensidade marcada fica neutro.
                  const cor = isRest ? null : COR_INTENSIDADE[s.intensity];
                  return (
                    <button key={s.id} onClick={() => onEdit(s)} title={cor ? `Carga ${intensityLabel(s.intensity).toLowerCase()}` : undefined} style={{
                      ...CARTAO_AGENDA, ...body,
                      color: isRest ? T.mutedDim : T.cream,
                      background: isRest ? T.bg : (cor ? `${cor}2E` : T.surfaceRaise || T.bg),
                      border: `1px solid ${isRest ? T.line : (cor ? `${cor}AA` : T.line)}`,
                      borderLeft: `4px solid ${isRest ? T.line : (cor || T.line)}`,
                    }}>
                      <span style={LINHAS(2)}>{isRest ? 'Folga' : (s.focus || 'Sessão')}</span>
                      {/* O momento/fase sempre no fundo do cartão — fica na
                          mesma linha em todos os dias, com título de uma ou
                          de duas linhas. */}
                      <span style={{ ...LINHAS(1), fontSize: 9.5, color: T.mutedDim, marginTop: 'auto' }}>{isRest ? 'Descanso total' : s.phase}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => onAddForDate(d)} style={{
                marginTop: 'auto',
                width: '100%', fontSize: 11, color: T.mutedDim, background: 'none',
                border: `1px dashed ${T.line}`, borderRadius: 6, padding: '4px 0', cursor: 'pointer', ...body,
              }}>+ sessão</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 11.5, color: T.mutedDim }}>
        {[['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']].map(([v, l]) => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COR_INTENSIDADE[v] }} /> Carga {l.toLowerCase()}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: T.cream }} /> Jogo
        </span>
      </div>
    </div>
  );
}

// Bloco de impressão de um exercício dentro de uma ficha de sessão/dia.
// Se houver imagem anexada, mostra-a em vez do esquema tático (tal como
// na impressão do exercício isolado); se for PDF, fica uma nota — o
// ficheiro em si é impresso à parte (ver openAndPrintPdfSequential).
/* As equipas guardadas no Simulador para ESTE exercício, agrupadas por
   turno. Vêm com o nome do exercício lá dentro, por isso filtra-se por
   ele — o Simulador não guarda o id. */
/* Presenças em 4 colunas — GR, Defesas, Médios, Avançados — cada
   jogador na coluna da sua posição, sem número de camisola (o nome já
   identifica; o número só ajudava a ler devagar uma lista corrida).
   Usado na folha impressa do treino. */
export function PrintPresencasPorPosicao({ presentPlayers, allPlayers }) {
  if (!presentPlayers || !presentPlayers.length) {
    return <p style={{ fontSize: 13 }}>Sem registo</p>;
  }
  const universo = allPlayers || presentPlayers;
  const grupos = GRUPOS_POSICAO_PRINT.map(g => ({
    ...g,
    jogadores: sortByPosition(presentPlayers.filter(p => g.posicoes.includes(p.position))),
  }));
  const semGrupo = sortByPosition(presentPlayers.filter(p => !GRUPOS_POSICAO_PRINT.some(g => g.posicoes.includes(p.position))));
  const colunas = semGrupo.length ? [...grupos, { grupo: 'SEM', label: 'Sem posição', jogadores: semGrupo }] : grupos;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colunas.length}, 1fr)`, gap: '0 16px' }}>
      {colunas.map(c => {
        /* DUAS COLUNAS DENTRO DE CADA GRUPO DE POSIÇÃO.

           Uma coluna só, uma embaixo da outra, ficava com uma "Defesas"
           bem mais alta do que as outras assim que o plantel tivesse
           mais do que uns 4 ou 5 defesas — desequilibrava a folha toda
           por causa de UM grupo. Passados 4 nomes, os seguintes passam
           para uma segunda coluna ao lado, dentro do mesmo grupo — até
           8 nomes por posição em vez de uma lista comprida.

           Quando o total é ímpar, é a coluna da ESQUERDA que fica com o
           nome a mais (5+4, não 4+5) — para ler de cima para baixo,
           esquerda primeiro, sem "saltar" para a direita a meio de uma
           contagem desigual. */
        const dividir = c.jogadores.length > 4;
        const metade = dividir ? Math.ceil(c.jogadores.length / 2) : c.jogadores.length;
        const col1 = c.jogadores.slice(0, metade);
        const col2 = dividir ? c.jogadores.slice(metade) : [];
        return (
          <div key={c.grupo}>
            <div style={{ fontSize: 11, fontWeight: 700, borderBottom: '1px solid #999', paddingBottom: 2, marginBottom: 4 }}>
              {c.label}
            </div>
            {c.jogadores.length === 0 ? (
              <div style={{ fontSize: 11, color: '#999' }}>—</div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {col1.map(p => (
                    <div key={p.id} style={{ fontSize: 12, lineHeight: 1.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {shortPlayerName(p, universo)}
                    </div>
                  ))}
                </div>
                {col2.length > 0 && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {col2.map(p => (
                      <div key={p.id} style={{ fontSize: 12, lineHeight: 1.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shortPlayerName(p, universo)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function equipasDoExercicio(equipas, ex) {
  const nome = String((ex && ex.name) || '').trim().toLowerCase();
  if (!nome) return [];
  const minhas = (equipas || []).filter(g => String(g.exercicio || '').trim().toLowerCase() === nome);
  const porTurno = new Map();
  minhas.forEach(g => {
    const chave = `${g.turno || 1}|${g.zona || ''}`;
    if (!porTurno.has(chave)) porTurno.set(chave, { turno: g.turno, zona: g.zona, minutos: g.minutos, grupos: [] });
    porTurno.get(chave).grupos.push(g);
  });
  return [...porTurno.values()];
}

/* Bloco de equipas em colunas A/B/C/D — usado tanto a seguir a um
   exercício (ficha do treino) como na prancheta (ver mais abaixo, onde
   as equipas guardadas pelo Simulador passaram a sair). */
export function PrintEquipasBlock({ equipas }) {
  if (!equipas || !equipas.length) return null;
  return (
    <>
      {equipas.map((t, i) => (
        <div key={i} style={{ marginTop: 10, breakInside: 'avoid' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 5 }}>
            {t.turno ? `Turno ${t.turno}` : 'Equipas'}
            {t.zona ? ` · zona ${t.zona}` : ''}
            {t.minutos ? ` · ${t.minutos} min` : ''}
          </div>
          <div style={{
            display: 'grid', gap: '0 16px',
            gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, t.grupos.length))}, minmax(0, 1fr))`,
          }}>
            {t.grupos.map((g, k) => (
              <div key={k}>
                <div style={{
                  fontSize: 11, fontWeight: 700, borderBottom: '1px solid #999',
                  paddingBottom: 2, marginBottom: 3,
                }}>
                  {g.equipa}{g.guardaRedes ? ' (GR)' : ''}
                </div>
                {g.jogadores.map((n, z) => (
                  <div key={z} style={{ fontSize: 10.5, lineHeight: 1.55 }}>{n}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function PrintExerciseBlock({ e, ex, index, equipas, trocas }) {
  if (!ex) return <p style={{ fontSize: 13, margin: '0 0 14px' }}>{index + 1}. —</p>;
  return (
    <div style={{ margin: '0 0 20px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{index + 1}. {ex.name}</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: '4px 24px',
        margin: '0 0 8px', fontSize: 12, borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', padding: '6px 0',
      }}>
        {ex.phase && <div style={{ gridColumn: 1, gridRow: 1 }}><strong>Fase de jogo:</strong> {momentoTexto(ex)}</div>}
        <div style={{ gridColumn: 2, gridRow: 1 }}><strong>Duração na sessão:</strong> {e.duration} min</div>
        {ex.space && <div style={{ gridColumn: 3, gridRow: 1 }}><strong>Espaço:</strong> {ex.space}</div>}
        {ex.playersCount && <div style={{ gridColumn: 1, gridRow: 2 }}><strong>Nº jogadores:</strong> {ex.playersCount}</div>}
        {ex.material && <div style={{ gridColumn: 2, gridRow: 2 }}><strong>Material:</strong> {ex.material}</div>}
      </div>
      {ex.description && (
        <p style={{ margin: '0 0 8px', fontSize: 12, whiteSpace: 'pre-wrap' }}>{ex.description}</p>
      )}

      {/* COM PDF ANEXADO, A PRANCHETA NÃO SAI.

          O PDF é o documento que interessa e sai na própria folha,
          desenhado como imagem (ver `PdfComoImagens`). Manter a
          prancheta aqui punha dois desenhos a competir pela mesma
          explicação — e, quase sempre, uma prancheta vazia ou por acabar,
          porque quem anexa um PDF já lá tem o exercício desenhado.

          Fica só a informação do exercício e a nota a dizer onde está o
          documento. */}
      {ex.attachment && ex.attachment.type === 'image' ? (
        <img
          src={ex.attachment.dataUrl}
          alt={ex.attachment.name}
          style={{ width: '82%', display: 'block', margin: '0 auto', background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
        />
      ) : (ex.attachment && ex.attachment.type === 'pdf') ? (
        ex.attachment.dataUrl ? (
          <PdfComoImagens url={ex.attachment.dataUrl}
            estiloImg={{ width: '82%', display: 'block', margin: '0 auto 8px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, breakInside: 'avoid' }} />
        ) : null
      ) : (
        // Só aqui, na ficha do treino — reduzido de 100% para 82% da
        // largura para caber mais exercícios por folha, sem ficarem
        // pequenos demais para se perceber o desenho. Os outros sítios
        // que usam este mesmo diagrama (Ficha de Jogador, Prancheta)
        // ficam exatamente como estavam.
        <svg viewBox={viewBoxSemBancos(ex.diagram && ex.diagram.vista)} style={{ width: '82%', aspectRatio: aspetoSemBancos(ex.diagram && ex.diagram.vista), display: 'block', margin: '0 auto', background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}>
          <VistaCampo esticar={ESTICAR_IMPRESSAO_MEIO} vista={ex.diagram && ex.diagram.vista}>
          <PitchMarkings printMode semBancos />
          <SpaceZonesReadOnly diagram={ex.diagram} spaceText={ex.space} printMode />
          {(() => {
            const d = diagramaParaImpressao(ex.diagram);
            return (
              <DiagramElements
                elements={d.elements}
                arrows={d.arrows}
                interactive={false}
                iconScale={iconScaleForPhase(ex.phase, ex.diagram)}
                printMode
              />
            );
          })()}
          </VistaCampo>
        </svg>
      )}
      {/* Sem marca por baixo de cada campo: chega a do fundo da página. */}

      {/* AS EQUIPAS FICAM COM O EXERCÍCIO A QUE PERTENCEM.

          Saem aqui, no plano do dia — e saem também, à parte, na
          Prancheta (`printFolha.tipo === 'prancheta'`, mais abaixo),
          porque um treinador leva às vezes só o plano e às vezes só a
          prancheta, e cada folha continua completa sozinha.

          Ao lado do desenho do exercício, em colunas A B C D, lê-se de
          relance quem joga em cada grupo; cada turno é um bloco, porque
          as equipas mudam entre turnos e misturá-las era voltar ao
          problema de antes (uma lista corrida onde era preciso ler o
          nome do exercício em cada linha para saber quem fazia o quê). */}
      <PrintEquipasBlock equipas={equipas} />
      {trocas && trocas.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Trocas</div>
          {trocas.map((t, i) => (
            <div key={i} style={{ fontSize: 10.5, color: '#333' }}>
              {t.turno ? `Turno ${t.turno}: ` : ''}{t.sai} → {t.entra}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PrintOnzeAmigavel({ session, jogo, players, ideias }) {
  const { formacao, lugares, titulares, suplentes } = equipaDoAmigavel({ session, jogo, players });
  // Os convidados podem estar no jogo (amigável) ou na sessão do dia.
  const convidados = [...nomesDosConvidados(jogo), ...nomesDosConvidados(session)];
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];

  return (
    <div style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Formação</h3>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480, aspectRatio: ASPECT_CAMPO_PRINT,
        background: '#fff', margin: '0 auto 14px',
      }}>
        <MarcacoesCampoPrint />
        {lugares.map((l, i) => {
          const [fx, fy] = l.ponto || layout[i] || [0.5, 0.5];
          return (
            <div key={i} style={{
              position: 'absolute', ...posCampoPrint(fx, fy),
              transform: 'translate(-50%, -50%)', textAlign: 'center', maxWidth: '20%',
            }}>
              <div style={{ fontSize: 8.5, color: '#888' }}>{rotuloDoLugar(l.lugar)}</div>
              <div style={{
                fontSize: 10.5, fontWeight: 600, lineHeight: 1.15, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', color: l.nome ? '#111' : '#bbb',
              }}>
                {l.nome || '—'}
              </div>
            </div>
          );
        })}
      </div>
      <EquipaEmColunasPrint titulares={titulares} suplentes={suplentes} capitaoId={jogo && jogo.capitao} subcapitaoId={jogo && jogo.subcapitao} />

      {(session.equipasSimulador && session.equipasSimulador.trocas || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Trocas previstas</div>
          {session.equipasSimulador.trocas.map((t, i) => (
            <div key={i} style={{ fontSize: 10.5, color: '#333' }}>
              {t.turno ? `${t.turno}ª parte: ` : ''}{t.sai} → {t.entra}
            </div>
          ))}
        </div>
      )}

      {convidados.length > 0 && (
        <p style={{ fontSize: 12.5, margin: '0 0 14px' }}>
          <strong>À experiência:</strong> {convidados.join(', ')}
        </p>
      )}

      {/* O título aparece mesmo sem nada escrito: numa folha impressa, um
          espaço em branco por baixo de "Ideias para o jogo" é útil — é
          onde se escreve à mão o que ainda não foi lançado na app. */}
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Ideias para o jogo</h3>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 16px', minHeight: 34 }}>
        {String(ideias || '').trim() || '—'}
      </p>
    </div>
  );
}

