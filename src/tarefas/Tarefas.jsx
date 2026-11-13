// tarefas/Tarefas.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useEffect } from 'react';
import { getMonday } from '../treino/Planeamento';
import { addDays, semAcentos, fmtShort, todayStr, uid, timeAgo } from '../base/utilidades';
import { MESES_PT, offerAviso } from '../plantel/comum';
import { shortPlayerName, sortByPosition } from '../dominio/jogadores';
import { T, body, display, mono } from '../base/tema';
import { CheckCircle2, ChevronRight, ChevronDown, Check, Plus, Calendar, CalendarDays, Users } from 'lucide-react';
import { Select, Input, offerUndo, removeWithUndo, Btn, SectionHeader, Panel, EmptyState } from '../base/ui';
import { LINHAS } from '../dominio/plantel';
import { missaoPendente, consumirMissaoPendente, haMissaoDeRelatorios, relatoriosEmFalta, PREF_MISSAO_RELATORIOS, AlertaRelatorios } from '../competicao/RelatoriosJogo';
import { linkWhatsApp } from '../dominio/mensagens';
import { SubTabs } from '../base/ui-extra';
import { nomeDoMembro, registarCoresMembros } from '../gestao/membros';
import { agruparMissoes, feitaNoGrupo } from './missoesRegras';
import { TEXTO_AVISO_CONCLUSAO, alvoDoLembrete, avisaCriadorAoConcluir, conclusaoPorVerPara, eSemanal, grupoDaTarefa, lembreteRecente, podeConcluirTarefa, podeGerirTarefa, semanaisPendentes, semanalConcluidaEstaSemana, tarefaAtivaHoje, tarefaFeitaHoje, telefoneDoMembro } from './regras';
import { LinhaTarefa, TarefasCalendario } from './Calendario';
import { MissaoModal } from './MissaoModal';
import { TarefaModal } from './TarefaModal';

/* ARQUIVO DAS CONCLUÍDAS. Com uma época inteira, a lista corrida das
   concluídas ficava infinita. Agora:
   1. agrupada por SEMANA em que foi feita ("Esta semana", "Semana
      passada", e depois por mês), com só "Esta semana" aberta;
   2. uma LINHA por missão (✓ título · quem · data), e a mesma missão
      feita por várias pessoas no mesmo dia numa linha só ("4 jogadores"),
      que abre para mostrar quem;
   3. FILTROS em cima: quem (todos, equipa técnica, jogadores ou uma pessoa)
      e pesquisa pelo título. Com um filtro ativo, os grupos abrem sozinhos. */
export function dataDaConclusao(t) {
  const cands = [t.feitaEm, t.notaSubmetidaEm, (t.concluidasEm || []).slice().sort().pop(), t.prazo];
  const d = cands.find(Boolean);
  return d ? String(d).slice(0, 10) : '';
}

export function ArquivoConcluidas({ feitas, membros, euId, players, hoje, onAbrir, onAlternar, podeConcluir }) {
  const [quem, setQuem] = useState('todos');
  const [procura, setProcura] = useState('');
  const [abertos, setAbertos] = useState(() => new Set(['semana']));
  const [expandidos, setExpandidos] = useState(() => new Set());
  const seg = getMonday(hoje);
  const segPassada = addDays(seg, -7);

  // Os registos de cada item (um grupo tem vários).
  const registosDe = (t) => (t._grupo ? t._grupo : [t]);
  const eJog = (r) => !!r.jogadorId;
  const casaQuem = (t) => {
    if (quem === 'todos') return true;
    return registosDe(t).some(r => (quem === 'staff' ? !eJog(r) : quem === 'jogadores' ? eJog(r) : (r.jogadorId === quem || (!r.jogadorId && r.responsavel === quem))));
  };
  const termo = semAcentos(procura.trim());
  const visiveis = feitas.filter(t => casaQuem(t) && (!termo || semAcentos(t.titulo || '').includes(termo)));
  const filtrado = quem !== 'todos' || !!termo;

  // Grupos por semana / mês.
  const grupoDe = (d) => {
    if (!d) return { k: 'sem', rot: 'Sem data', ord: '0000' };
    if (d >= seg) return { k: 'semana', rot: 'Esta semana', ord: '9999-2' };
    if (d >= segPassada) return { k: 'passada', rot: 'Semana passada', ord: '9999-1' };
    const [a, m] = d.split('-');
    return { k: `${a}-${m}`, rot: `${MESES_PT[Number(m) - 1]}${a !== hoje.slice(0, 4) ? ` ${a}` : ''}`, ord: `${a}-${m}` };
  };
  const grupos = new Map();
  visiveis.forEach(t => {
    const d = dataDaConclusao(t);
    const g = grupoDe(d);
    if (!grupos.has(g.k)) grupos.set(g.k, { ...g, itens: [] });
    grupos.get(g.k).itens.push({ t, d });
  });
  const listaGrupos = [...grupos.values()].sort((a, b) => b.ord.localeCompare(a.ord));

  // Dentro de um grupo: a mesma missão (título) no mesmo dia, junta.
  const juntar = (itens) => {
    const m = new Map();
    itens.forEach(({ t, d }) => {
      const k = t._grupo ? `g:${t.id}` : `${semAcentos(t.titulo || '')}|${d}|${t.jogadorId ? 'j' : 's'}`;
      if (!m.has(k)) m.set(k, { k, d, titulo: t.titulo, itens: [] });
      m.get(k).itens.push(t);
    });
    return [...m.values()].sort((a, b) => String(b.d).localeCompare(String(a.d)));
  };
  const nomeDe = (r) => (r.jogadorId
    ? shortPlayerName((players || []).find(p => p.id === r.jogadorId) || {}, players)
    : nomeDoMembro(r.responsavel, membros, euId));
  const contagem = (itens) => {
    const regs = itens.flatMap(registosDe);
    const nj = regs.filter(eJog).length;
    const ns = regs.length - nj;
    return [ns ? `${ns} equipa técnica` : '', nj ? `${nj} ${nj === 1 ? 'jogador' : 'jogadores'}` : ''].filter(Boolean).join(' · ');
  };
  const alternar = (setFn, k) => setFn(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  /* Colunas fixas à direita (quem · data · seta), iguais em todas as
     linhas, para a informação ficar alinhada. A seta tem sempre o seu
     lugar, mesmo nas linhas que não abrem. */
  const linha = { display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) 150px 48px 16px', alignItems: 'center', columnGap: 10, padding: '7px 10px', borderRadius: 7 };
  const visto = <CheckCircle2 size={15} color={T.good} style={{ flexShrink: 0 }} />;

  return (
    <div>
      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '0 1 240px', minWidth: 180 }}>
          <Select value={quem} onChange={e => setQuem(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="staff">Equipa técnica</option>
            <option value="jogadores">Jogadores</option>
            <optgroup label="Equipa técnica">
              {(membros || []).map(m => <option key={m.user_id} value={m.user_id}>{nomeDoMembro(m.user_id, membros, euId)}</option>)}
            </optgroup>
            <optgroup label="Jogadores">
              {sortByPosition(players || []).map(p => <option key={p.id} value={p.id}>{shortPlayerName(p, players)}</option>)}
            </optgroup>
          </Select>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Input value={procura} onChange={e => setProcura(e.target.value)} placeholder="Procurar pelo título" />
        </div>
      </div>

      {/* ALTURA FIXA: abrir e fechar grupos (ou filtrar) muda o que está
          dentro desta caixa, que desliza por dentro; a página à volta não
          mexe. */}
      <div style={{ height: 'min(560px, 65vh)', overflowY: 'auto', paddingRight: 4 }}>
      {listaGrupos.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim, padding: '6px 2px' }}>{filtrado ? 'Nada encontrado com estes filtros.' : 'Ainda sem tarefas concluídas.'}</div>
      ) : listaGrupos.map(g => {
        const aberto = filtrado || abertos.has(g.k);
        const juntos = juntar(g.itens);
        return (
          <div key={g.k} style={{ borderTop: `1px solid ${T.line}` }}>
            <button type="button" onClick={() => alternar(setAbertos, g.k)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 4px', background: 'none', border: 'none',
              cursor: 'pointer', ...body, textAlign: 'left',
            }}>
              <ChevronRight size={15} color={T.mutedDim} style={{ transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
              <span style={{ ...display, fontSize: 14.5, color: T.cream }}>{g.rot}</span>
              <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim }}>{g.itens.length}</span>
              <span style={{ fontSize: 11.5, color: T.mutedDim, marginLeft: 'auto', textAlign: 'right' }}>{contagem(g.itens.map(x => x.t))}</span>
            </button>
            {aberto && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0 10px 22px' }}>
                {juntos.map(j => {
                  const varios = j.itens.length > 1 || (j.itens[0] && j.itens[0]._grupo);
                  const regs = j.itens.flatMap(registosDe);
                  const exp = expandidos.has(j.k);
                  return (
                    <div key={j.k}>
                      <div style={{ ...linha, cursor: 'pointer' }}
                        onClick={() => (varios ? alternar(setExpandidos, j.k) : onAbrir(j.itens[0]))}
                        onMouseEnter={e => { e.currentTarget.style.background = T.surfaceRaise || 'rgba(255,255,255,.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        {visto}
                        <span style={{ minWidth: 0, fontSize: 13.5, color: T.muted, ...LINHAS(1) }}>{j.titulo}</span>
                        <span style={{ fontSize: 12, color: T.gold, textAlign: 'right', ...LINHAS(1) }}>
                          {varios ? `${regs.length} ${regs.every(eJog) ? 'jogadores' : regs.some(eJog) ? 'pessoas' : 'pessoas'}` : nomeDe(regs[0])}
                        </span>
                        <span style={{ ...mono, fontSize: 11, color: T.mutedDim, textAlign: 'right' }}>{j.d ? fmtShort(j.d) : ''}</span>
                        {varios ? <ChevronDown size={14} color={T.mutedDim} style={{ transform: exp ? 'rotate(180deg)' : 'none' }} /> : <span />}
                      </div>
                      {varios && exp && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '4px 10px 8px 35px' }}>
                          {/* Num grupo, mostra-se logo QUEM concluiu (um nome por
                              atleta, clica-se para abrir a resposta dele), em vez
                              de um botão "Ver o grupo" que obrigava a mais um clique. */}
                          {j.itens.flatMap(t => (t._grupo ? t._grupo.filter(feitaNoGrupo) : [t])).map(r => (
                            <button key={r.id} type="button" onClick={() => onAbrir(r)} title={`Abrir a tarefa de ${nomeDe(r)}`}
                              style={{ ...body, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.cream, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 14, padding: '2px 9px', cursor: 'pointer' }}>
                              <Check size={11} color={T.good} style={{ flexShrink: 0 }} />{nomeDe(r)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

export function Tarefas({ tarefas, setTarefas, membros, euId, sessions, matches, players, monitoring, standings }) {
  registarCoresMembros(membros);
  const [modal, setModal] = useState(null); // 'new' | tarefa
  // Dia já escolhido para uma tarefa nova criada a partir do Calendário.
  const [novoDia, setNovoDia] = useState('');
  // Ocorrência semanal de onde a tarefa foi aberta no Calendário ({ base, dia }).
  const [ocorrencia, setOcorrencia] = useState(null);
  // 'calendario' | 'prazo' | 'pessoa' — o Calendário é o primeiro (e abre nele).
  /* Lembra-se do separador em que se estava: abrir uma tarefa (página
     inteira) e fechá-la volta ao mesmo separador, mesmo que a página das
     Tarefas tenha sido montada de novo pelo caminho. */
  const [vista, setVistaEstado] = useState(() => {
    try { const v = sessionStorage.getItem('tarefas-vista'); return v && v !== 'balneario' ? v : 'calendario'; } catch (e) { return 'calendario'; }
  });
  const setVista = (v) => {
    setVistaEstado(v);
    try { sessionStorage.setItem('tarefas-vista', v); } catch (e) { /* sem memória: fica só nesta página */ }
  };
  const porPessoa = vista === 'pessoa';
  const [verFeitas, setVerFeitas] = useState(false);
  const hoje = todayStr();
  const ctx = { sessions, matches, players, monitoring };
  const souDono = ((membros || []).find(m => m.user_id === euId) || {}).papel === 'owner';
  // Nova missão pedida noutro separador (ex.: o alerta dos relatórios).
  const [prefMissao, setPrefMissao] = useState(null);
  useEffect(() => {
    const abrirPendente = () => {
      if (!missaoPendente) return;
      const pref = missaoPendente;
      consumirMissaoPendente();
      setPrefMissao(pref); setNovoDia(''); setOcorrencia(null); setModal('new');
    };
    abrirPendente();
    window.addEventListener('mjp-nova-missao', abrirPendente);
    return () => window.removeEventListener('mjp-nova-missao', abrirPendente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const relFalta = souDono && !haMissaoDeRelatorios(tarefas) ? relatoriosEmFalta(matches, standings) : [];
  /* CONCLUÍDAS POR VER — o aviso a quem criou. Agora inclui as missões
     dos JOGADORES: quando um jogador conclui uma missão que criei (submete
     a resposta, a autoavaliação, grava o clipe ou abre o que lhe pedi),
     aparece aqui e no badge até eu a abrir ou carregar em "Visto". */
  const quandoPorVer = (t) => (t.conclusaoPorVer ? t.conclusaoPorVer.em : (t.notaSubmetidaEm || t.atualizadoEm || ''));
  const porVer = tarefas.filter(t => conclusaoPorVerPara(t, euId)
    || (t.jogadorId && t.notaSubmetida && !t.notaRevista && t.criadoPor === euId))
    .sort((a, b) => String(quandoPorVer(b)).localeCompare(String(quandoPorVer(a))));
  // As missões do mesmo grupo (a mesma missão para vários) num só cartão.
  const vistaM = agruparMissoes(tarefas);
  const doGrupo = (t) => (t && t._grupo ? t._grupo : [t]);
  const podeConcluir = (t) => (t && t._grupo ? t._grupo.every(r => podeConcluirTarefa(r, euId, souDono)) : podeConcluirTarefa(t, euId, souDono));
  const lembrar = (t) => {
    const alvo = alvoDoLembrete(t, euId, membros, players, hoje);
    if (!alvo || lembreteRecente(t)) return;
    // Abrir já, ainda dentro do clique: fora dele o browser bloqueia a janela.
    const link = alvo.link;
    if (link) window.open(link, '_blank', 'noopener');
    setTarefas(prev => prev.map(x => (x.id === t.id
      ? { ...x, lembrete: { de: euId, em: new Date().toISOString(), visto: false, whatsapp: !!link, alvo: alvo.tipo } }
      : x)));
  };

  const save = (dados) => {
    const antes = dados.id ? tarefas.find(x => x.id === dados.id) : null;
    const concluiuAgora = !!antes && !antes.recorrencia && antes.estado !== 'feita' && dados.estado === 'feita';
    if (dados.estado === 'feita') dados = { ...dados, lembrete: null };
    else if (antes && antes.estado === 'feita') dados = { ...dados, conclusaoPorVer: null };
    if (dados.id) setTarefas(prev => prev.map(t => (t.id === dados.id ? dados : t)));
    else setTarefas(prev => [...prev, { ...dados, id: uid(), criadoPor: euId, criadoEm: new Date().toISOString() }]);
    setModal(null);
    setNovoDia('');
    if (concluiuAgora) aoConcluir(dados, antes);
  };
  /* Gravar o que vem do editor de missões: várias cópias novas, cópias
     atualizadas e cópias tiradas (pessoas retiradas do grupo). Uma só
     missão editada segue o caminho de sempre (`save`), por causa dos
     avisos de conclusão. */
  const guardarMissoes = ({ upserts, removidos }) => {
    const existentes = new Set(tarefas.map(t => t.id));
    if (upserts.length === 1 && !removidos.length && existentes.has(upserts[0].id)) { save(upserts[0]); return; }
    const porId = new Map(upserts.map(u => [u.id, u]));
    setTarefas(prev => [
      ...prev.filter(x => !removidos.includes(x.id)).map(x => (porId.has(x.id) ? porId.get(x.id) : x)),
      ...upserts.filter(u => !existentes.has(u.id)),
    ]);
    setModal(null); setNovoDia(''); setOcorrencia(null);
  };
  const removerGrupo = (g) => {
    const ids = new Set(g._grupo.map(r => r.id));
    const copia = g._grupo;
    setTarefas(prev => prev.filter(x => !ids.has(x.id)));
    setModal(null);
    offerUndo(`Missão apagada para ${copia.length}.`, () => setTarefas(prev => [...prev, ...copia]));
  };
  const remove = (id) => {
    const t = tarefas.find(x => x.id === id);
    removeWithUndo(tarefas, setTarefas, id, t ? t.titulo : 'Tarefa');
    setModal(null);
  };
  /* Abrir uma tarefa cuja nota está por rever marca-a logo como revista
     — é a forma mais natural de "marcar como lida": basta abrir para ver
     o que o atleta escreveu, sem precisar de mais nenhum clique. */
  const marcarConclusaoVista = (ids) => {
    setTarefas(prev => prev.map(x => (ids.includes(x.id)
      ? { ...x, conclusaoPorVer: null, ...(x.jogadorId && x.notaSubmetida ? { notaRevista: true } : {}) }
      : x)));
  };
  const abrir = (t, oc) => {
    setOcorrencia(oc || null);
    if (t && t._grupo) {
      // Abrir o grupo conta como ver as respostas que lá estão.
      const ids = t._grupo.filter(r => r.jogadorId && r.notaSubmetida && !r.notaRevista && r.criadoPor === euId).map(r => r.id);
      if (ids.length) setTarefas(prev => prev.map(x => (ids.includes(x.id) ? { ...x, notaRevista: true } : x)));
      setModal(t);
      return;
    }
    if (conclusaoPorVerPara(t, euId)) marcarConclusaoVista([t.id]);
    // O responsável abriu a tarefa: o lembrete fica visto (deixa de estar
    // destacado), mas a tarefa continua por fazer até ele a concluir.
    if (t.lembrete && !t.lembrete.visto && t.responsavel === euId) {
      setTarefas(prev => prev.map(x => (x.id === t.id ? { ...x, lembrete: { ...x.lembrete, visto: true } } : x)));
    }
    if (t.jogadorId && t.notaSubmetida && !t.notaRevista && t.criadoPor === euId) {
      setTarefas(prev => prev.map(x => (x.id === t.id ? { ...x, notaRevista: true } : x)));
    }
    setModal(t);
  };
  /* Numa recorrente, "concluir" marca só o DIA DE HOJE
     (`concluidasEm`) — nunca o estado geral da tarefa, que fica sempre
     "aberta". É assim que ela volta sozinha a "por fazer" no dia
     seguinte, sem ninguém ter de a reabrir. Numa tarefa normal,
     continua a ser o `estado` de sempre. */
  /* Chamar logo a seguir a uma conclusão (não a uma reabertura). Marca o
     aviso para quem criou e oferece o WhatsApp a quem concluiu. `antes`
     é a tarefa como estava, para o "Anular". */
  function aoConcluir(t, antes) {
    if (!avisaCriadorAoConcluir(t, euId)) {
      offerUndo('Tarefa concluída.', () => setTarefas(prev => prev.map(x => (x.id === antes.id ? antes : x))));
      return;
    }
    const marca = { por: euId, em: new Date().toISOString() };
    setTarefas(prev => prev.map(x => (x.id === t.id ? { ...x, conclusaoPorVer: marca } : x)));
    const nomeCriador = nomeDoMembro(t.criadoPor, membros, euId);
    const href = linkWhatsApp(telefoneDoMembro(t.criadoPor, membros), TEXTO_AVISO_CONCLUSAO(t, membros));
    offerAviso({
      message: href ? 'Tarefa concluída.' : `Tarefa concluída. ${nomeCriador} vai ver o aviso na app.`,
      acao: href ? { label: `Avisar ${nomeCriador.split(' ')[0]}`, href } : null,
      onUndo: () => setTarefas(prev => prev.map(x => (x.id === antes.id ? antes : x))),
    });
  }

  /* Concluir / reabrir um GRUPO: aplica-se a todas as cópias (sem um aviso
     por cada uma, que quem conclui em bloco é quem as criou). */
  const alternarGrupo = (g, chave) => {
    const ids = new Set(g._grupo.map(r => r.id));
    if (g.recorrencia) {
      const k = chave || hoje;
      const todos = g._grupo.every(r => (r.concluidasEm || []).includes(k));
      setTarefas(prev => prev.map(x => (ids.has(x.id)
        ? { ...x, concluidasEm: todos ? (x.concluidasEm || []).filter(d => d !== k) : [...new Set([...(x.concluidasEm || []), k])] }
        : x)));
      return;
    }
    const feita = g.estado === 'feita';
    setTarefas(prev => prev.map(x => (ids.has(x.id)
      ? { ...x, estado: feita ? 'aberta' : 'feita', feitaEm: feita ? null : new Date().toISOString(), lembrete: null, ...(feita ? { conclusaoPorVer: null } : {}) }
      : x)));
    offerUndo(feita ? 'Missão reaberta para todos.' : 'Missão concluída para todos.', () => {
      const antes = new Map(g._grupo.map(r => [r.id, r]));
      setTarefas(prev => prev.map(x => antes.get(x.id) || x));
    });
  };
  const alternar = (t) => {
    if (!podeConcluir(t)) return;
    if (t._grupo) {
      const base = eSemanal(t) ? ((semanaisPendentes(t, hoje)[0] || {}).base || (semanalConcluidaEstaSemana(t, hoje) || {}).base) : null;
      alternarGrupo(t, base);
      return;
    }
    /* Semanal, na lista: concluir fecha a ocorrência pendente mais
       antiga; se já não há nenhuma (está em "Concluídas"), desfazer
       reabre a desta semana. */
    if (eSemanal(t)) {
      const p = semanaisPendentes(t, hoje)[0];
      const desta = p ? null : semanalConcluidaEstaSemana(t, hoje);
      const base = p ? p.base : (desta && desta.base);
      if (!base) return;
      alternarEm(t, null, base);
      return;
    }
    if (t.recorrencia) {
      const feitaHoje = tarefaFeitaHoje(t, hoje);
      const lista = feitaHoje ? (t.concluidasEm || []).filter(d => d !== hoje) : [...(t.concluidasEm || []), hoje];
      setTarefas(prev => prev.map(x => (x.id === t.id ? { ...x, concluidasEm: lista } : x)));
      return;
    }
    const vaiConcluir = t.estado !== 'feita';
    setTarefas(prev => prev.map(x => (x.id === t.id
      ? {
        ...x, estado: x.estado === 'feita' ? 'aberta' : 'feita', feitaEm: x.estado === 'feita' ? null : new Date().toISOString(), lembrete: null,
        ...(vaiConcluir ? {} : { conclusaoPorVer: null }),
      }
      : x)));
    if (vaiConcluir) aoConcluir(t, t);
  };

  /* No Calendário, cada dia tem a sua caixa: numa recorrente marca-se
     ESSE dia (não necessariamente hoje); numa normal é o mesmo que na
     lista. */
  // `base`: nas semanais, a ocorrência (pode estar mudada para outro dia).
  function alternarEm(t, dia, base) {
    if (!podeConcluir(t)) return;
    if (t._grupo) { alternarGrupo(t, base || dia); return; }
    if (!t.recorrencia || (eSemanal(t) && !base)) { alternar(t); return; }
    const chave = base || dia;
    const vaiConcluir = !(t.concluidasEm || []).includes(chave);
    const lista = vaiConcluir
      ? [...(t.concluidasEm || []), chave]
      : (t.concluidasEm || []).filter(d => d !== chave);
    setTarefas(prev => prev.map(x => (x.id === t.id
      ? { ...x, concluidasEm: lista, lembrete: null, ...(vaiConcluir ? {} : { conclusaoPorVer: null }) }
      : x)));
    if (vaiConcluir && eSemanal(t)) aoConcluir(t, t);
  }
  const novaNoDia = (dia) => { setNovoDia(dia); setModal('new'); };

  /* Mudar o dia a uma tarefa arrastando-a no Calendário: mexe só no
     `prazo`. As recorrentes não têm prazo, por isso ficam de fora. */
  const mover = (id, prazo) => {
    const gid = String(id).startsWith('grupo:') ? String(id).slice(6) : null;
    const eEsta = (x) => (gid ? x.grupoId === gid : x.id === id);
    setTarefas(prev => prev.map(x => (eEsta(x) && !x.recorrencia && (x.prazo || '') !== prazo ? { ...x, prazo } : x)));
  };
  /* Semanal arrastada no Calendário: muda só ESSA semana. Voltar a pô-la
     no dia habitual apaga a exceção. */
  const moverOcorrencia = (id, base, novoDia) => {
    const gid = String(id).startsWith('grupo:') ? String(id).slice(6) : null;
    setTarefas(prev => prev.map(x => {
      if ((gid ? x.grupoId !== gid : x.id !== id) || !eSemanal(x)) return x;
      const mudancas = { ...(x.recorrencia.mudancas || {}) };
      if (novoDia === base) delete mudancas[base];
      else mudancas[base] = novoDia;
      return { ...x, recorrencia: { ...x.recorrencia, mudancas } };
    }));
  };

  /* As recorrentes só aparecem nos dias em que a regra delas está
     mesmo ativa (ver `tarefaAtivaHoje`) — nos outros dias, ficam
     invisíveis, não é "atrasada" nem "por fazer", é simplesmente um
     dia que não lhes diz respeito. Dentro de um dia ativo, uma
     concluída HOJE passa para "Concluídas"; volta a "abertas" sozinha
     amanhã, sem ninguém mexer em nada. */
  const estaAberta = (t) => {
    if (t.estado === 'feita') return false;
    if (!t.recorrencia) return true;
    if (eSemanal(t)) return semanaisPendentes(t, hoje).length > 0;
    return tarefaAtivaHoje(t, hoje, ctx) && !tarefaFeitaHoje(t, hoje);
  };
  const abertas = vistaM.filter(estaAberta);
  // "Por pessoa" mostra a cópia de cada um, não o grupo.
  const abertasCadaUm = tarefas.filter(estaAberta);
  const feitas = [
    ...vistaM.filter(t => eSemanal(t) && t.estado !== 'feita' && semanaisPendentes(t, hoje).length === 0 && semanalConcluidaEstaSemana(t, hoje)),
    ...vistaM.filter(t => t.recorrencia && !eSemanal(t) && tarefaAtivaHoje(t, hoje, ctx) && tarefaFeitaHoje(t, hoje)),
    ...vistaM.filter(t => !t.recorrencia && t.estado === 'feita'),
  ].sort((a, b) => String(b.feitaEm || hoje).localeCompare(String(a.feitaEm || hoje)));

  /* Por prazo: os grupos saem pela ordem definida em `grupoDaTarefa`, e
     dentro de cada um pela data. Sem prazo fica no fim das abertas — não
     é urgente por definição, mas também não desaparece. */
  const gruposPorPrazo = () => {
    const mapa = new Map();
    abertas.forEach(t => {
      const g = grupoDaTarefa(t, hoje);
      if (!mapa.has(g.id)) mapa.set(g.id, { ...g, lista: [] });
      mapa.get(g.id).lista.push(t);
    });
    return [...mapa.values()]
      .sort((a, b) => a.ordem - b.ordem)
      .map(g => ({ ...g, lista: g.lista.sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999'))) }));
  };

  /* Por pessoa: a mesma lista, outro corte. Toda a gente aparece, mesmo
     sem tarefas — ver que alguém está a zero é informação. */
  const gruposPorPessoa = () => {
    const ids = [...new Set([...(membros || []).map(m => m.user_id), ...abertasCadaUm.map(t => t.responsavel)])];
    return ids.map(id => ({
      id: id || 'sem',
      rotulo: nomeDoMembro(id, membros, euId),
      userId: id,
      lista: abertasCadaUm.filter(t => (t.responsavel || null) === (id || null))
        .sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999'))),
    })).filter(g => g.userId || g.lista.length);
  };

  const grupos = porPessoa ? gruposPorPessoa() : gruposPorPrazo();

  return (
    <div>
      <SectionHeader
        title="Tarefas"
        subtitle="Missões para a equipa técnica e para os jogadores."
        action={<Btn onClick={() => setModal('new')}><Plus size={15} /> Nova missão</Btn>}
      />
      <AlertaRelatorios emFalta={relFalta} onCriar={(r) => { setPrefMissao(PREF_MISSAO_RELATORIOS(r)); setNovoDia(''); setOcorrencia(null); setModal('new'); }} />

      {/* CONCLUÍDAS POR VER — tarefas que criei e que outra pessoa
          concluiu. Ficam aqui, e no badge, até eu as abrir ou dar como
          vistas. */}
      {porVer.length > 0 && (
        <>
          <Panel
            title={`Concluídas por ver (${porVer.length})`}
            action={porVer.length > 1 ? <Btn variant="ghost" onClick={() => marcarConclusaoVista(porVer.map(t => t.id))}>Marcar todas como vistas</Btn> : null}
          >
            {porVer.map(t => (
              <div key={t.id} style={{
                display: 'flex', gap: 11, alignItems: 'center', flexWrap: 'wrap',
                padding: '10px 13px', background: T.bg, borderRadius: 9,
                border: `1px solid ${T.good}`, marginBottom: 8,
              }}>
                <CheckCircle2 size={17} color={T.good} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => abrir(t)}>
                  <div style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.4 }}>{t.titulo}</div>
                  <div style={{ fontSize: 11.5, color: T.good, marginTop: 3 }}>
                    {t.conclusaoPorVer
                      ? `Concluída por ${nomeDoMembro(t.conclusaoPorVer.por, membros, euId)} · ${timeAgo(t.conclusaoPorVer.em)}`
                      : `Feita por ${shortPlayerName((players || []).find(p => p.id === t.jogadorId) || {}, players)}${t.notaSubmetidaEm ? ` · ${timeAgo(t.notaSubmetidaEm)}` : ''}${t.notaAtleta ? ' · tem resposta' : ''}`}
                  </div>
                </div>
                <Btn variant="ghost" onClick={() => marcarConclusaoVista([t.id])}><Check size={14} /> Visto</Btn>
              </div>
            ))}
          </Panel>
          <div style={{ height: 16 }} />
        </>
      )}

      <SubTabs
        value={vista}
        onChange={setVista}
        tabs={[
          { id: 'calendario', label: 'Calendário', icon: Calendar },
          { id: 'prazo', label: 'Por prazo', icon: CalendarDays },
          { id: 'pessoa', label: 'Por pessoa', icon: Users },
        ]}
      />

      <Panel title={vista === 'pessoa' ? 'Quem está com a missão' : (vista === 'calendario' ? 'Calendário' : 'Quando se executa')}>
        {vista === 'calendario' ? (
          <TarefasCalendario
            tarefas={vistaM} hoje={hoje} ctx={ctx}
            membros={membros} euId={euId} players={players}
            podeConcluir={podeConcluir} onLembrar={lembrar}
            onAbrir={abrir} onAlternarEm={alternarEm} onMover={mover} onMoverOcorrencia={moverOcorrencia} onNovaNoDia={novaNoDia}
          />
        ) : abertas.length === 0 ? (
          <EmptyState
            text="Nada por fazer. Cria a primeira missão."
            action={<Btn onClick={() => setModal('new')}><Plus size={15} /> Nova missão</Btn>}
          />
        ) : (
          grupos.map(g => (
            <div key={g.id} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
                <span style={{
                  ...display, fontSize: 14, fontWeight: 600,
                  color: g.id === 'atraso' ? T.bad : (g.id === 'hoje' ? T.warn : T.cream),
                }}>{g.rotulo}</span>
                <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>{g.lista.length}</span>
                <span style={{ flex: 1, height: 1, background: T.line }} />
              </div>
              {g.lista.length === 0 ? (
                <div style={{ fontSize: 12, color: T.mutedDim, fontStyle: 'italic', padding: '4px 2px 10px' }}>
                  Sem tarefas pendentes.
                </div>
              ) : g.lista.map(t => (
                <LinhaTarefa
                  key={t.id} tarefa={t} membros={membros} euId={euId} hoje={hoje} players={players}
                  onAbrir={abrir} onAlternar={alternar}
                  podeConcluir={podeConcluir(t)} onLembrar={lembrar}
                />
              ))}
            </div>
          ))
        )}
      </Panel>

      <div style={{ height: 16 }} />

      <Panel
        title={`Concluídas (${feitas.length})`}
        action={feitas.length ? <Btn variant="ghost" onClick={() => setVerFeitas(v => !v)}>{verFeitas ? 'Esconder' : 'Ver'}</Btn> : null}
      >
        {feitas.length === 0 ? (
          <EmptyState text="Ainda sem tarefas concluídas." />
        ) : !verFeitas ? (
          <div style={{ fontSize: 12.5, color: T.mutedDim }}>{feitas.length} {feitas.length === 1 ? 'tarefa concluída' : 'tarefas concluídas'}.</div>
        ) : (
          <ArquivoConcluidas
            feitas={feitas} membros={membros} euId={euId} players={players} hoje={hoje}
            onAbrir={abrir} onAlternar={alternar} podeConcluir={podeConcluir}
          />
        )}
      </Panel>

      {modal && (modal === 'new' || modal._grupo || !(Array.isArray(modal.missoes) && modal.missoes.length > 1)) && (
        <MissaoModal
          alvo={modal === 'new' ? null : modal}
          inicial={modal === 'new' ? (prefMissao || (novoDia ? { prazo: novoDia } : null)) : null}
          ocorrencia={modal !== 'new' ? ocorrencia : null}
          podeConcluir={modal === 'new' ? true : podeConcluir(modal)}
          podeGerir={modal === 'new' ? true : doGrupo(modal).every(r => podeGerirTarefa(r, euId, souDono))}
          membros={membros}
          players={players}
          euId={euId}
          tarefas={tarefas}
          matches={matches}
          onClose={() => { setModal(null); setNovoDia(''); setOcorrencia(null); setPrefMissao(null); }}
          onGuardar={(ops) => { setPrefMissao(null); guardarMissoes(ops); }}
          onRemove={modal === 'new' ? null : (modal._grupo ? () => removerGrupo(modal) : () => remove(modal.id))}
        />
      )}
      {/* Tarefas antigas com vários passos: ficam no editor antigo até acabarem. */}
      {modal && modal !== 'new' && !modal._grupo && Array.isArray(modal.missoes) && modal.missoes.length > 1 && (
        <TarefaModal
          tarefa={modal === 'new' ? null : modal}
          inicial={modal === 'new' && novoDia ? { prazo: novoDia } : null}
          ocorrencia={modal !== 'new' ? ocorrencia : null}
          podeConcluir={modal === 'new' ? true : podeConcluir(modal)}
          membros={membros}
          players={players}
          euId={euId}
          tarefas={tarefas}
          onClose={() => { setModal(null); setNovoDia(''); setOcorrencia(null); }}
          onSave={save}
          onRemove={modal !== 'new' ? () => remove(modal.id) : null}
        />
      )}
    </div>
  );
}

