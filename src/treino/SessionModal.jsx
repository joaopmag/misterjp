// treino/SessionModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import React, { useState, useRef, useEffect } from 'react';
import { comQuemLaEsteve } from '../competicao/Escalacao';
import { todayStr, uid, fmtDate } from '../base/utilidades';
import { temMomento, momentoTexto } from '../dominio/treino';
import { Modal, FIELD_GRID, Field, Input, Select, Btn } from '../base/ui';
import { T, body, display, mono } from '../base/tema';
import { Moon, Check, X, ChevronLeft, Printer, Pencil, BookOpen } from 'lucide-react';
import { convidadosDe, PlayerChipList, sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { SelectAllBar, ConvidadosEditor } from '../dominio/convidados';
import { estadoClinicoEm } from '../dominio/clinico';
import { createPortal } from 'react-dom';
import { aspetoSemBancos, viewBoxSemBancos, ESTICAR_IMPRESSAO_MEIO, VistaCampo, PitchMarkings, iconScaleForPhase, DiagramElements } from '../tatico/campo';
import { INTENSITIES, PHASES, intensityText, tempoJogoText } from './comum';
import { EscolherParaCopiar } from './EscolherParaCopiar';
import { EditorPrancheta } from '../plantel/Prancheta';
import { ExerciseModal } from './ExerciseModal';
import { PdfComoImagens } from '../media/pdf';
import { SpaceZonesReadOnly, diagramaParaImpressao } from './diagramas';

export function dayLabel(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
}

export function SessionModal({ session, presetDate, exercises, players: playersAtivosDoTreino, onClose, onSave, clinico, onIntegrarConvidado, setExercises, exercisesMeta, sessions, setSessions, matches }) {
  const players = React.useMemo(() => comQuemLaEsteve(playersAtivosDoTreino, session), [playersAtivosDoTreino, session]);
  const [f, setF] = useState(session || {
    date: presetDate || todayStr(), focus: '', phase: PHASES[0],
    intensity: 'media', opponent: '', exerciseIds: [], attendance: [], ratings: {},
  });
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_sessao_${session?.id || `novo_${presetDate || ''}`}`, f, setF);

  const toggleExercise = (exId) => {
    const exists = f.exerciseIds.find(e => e.exId === exId);
    if (exists) setF({ ...f, exerciseIds: f.exerciseIds.filter(e => e.exId !== exId) });
    else {
      const ex = exercises.find(x => x.id === exId);
      setF({ ...f, exerciseIds: [...f.exerciseIds, { exId, duration: ex?.defaultDuration || 15 }] });
    }
  };
  const setDuration = (exId, duration) => {
    setF({ ...f, exerciseIds: f.exerciseIds.map(e => e.exId === exId ? { ...e, duration } : e) });
  };
  const toggleAttendance = (pid) => {
    const present = f.attendance.includes(pid);
    setF({ ...f, attendance: present ? f.attendance.filter(id => id !== pid) : [...f.attendance, pid] });
  };

  const totalMin = f.exerciseIds.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);

  /* A LISTA DE EXERCÍCIOS SEGUE A FASE ESCOLHIDA EM CIMA.

     Antes mostrava sempre os exercícios todos, de qualquer fase, e quem
     estava a montar uma sessão de "Transição Defensiva" tinha de
     procurar entre exercícios de Bola Parada e Organização Ofensiva
     pelo meio. Por omissão só aparecem os da mesma fase da sessão —
     mas um exercício já escolhido nunca desaparece só por se ter
     mudado a fase depois (senão perdia-se a escolha sem se dar conta).
     "Mostrar todas as fases" continua a existir para quando se quer
     mesmo juntar, por exemplo, um exercício de Ativação a uma sessão
     de outra fase. */
  const [verTodasAsFases, setVerTodasAsFases] = useState(false);
  /* PRÓXIMO ADVERSÁRIO AUTOMÁTICO: o primeiro jogo marcado no dia da
     sessão ou depois. Só preenche se o campo estiver vazio ou ainda
     tiver o valor que foi posto automaticamente (mudar a data troca-o);
     o que o treinador escrever à mão nunca é substituído. */
  const proximoJogoSessao = React.useMemo(() => {
    if (!f.date) return null;
    return (matches || [])
      .filter(m => m && m.date && m.date >= f.date && String(m.opponent || '').trim())
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0] || null;
  }, [matches, f.date]);
  const adversarioAutoRef = useRef(null);
  useEffect(() => {
    if (f.phase === 'Descanso') return;
    const auto = proximoJogoSessao ? String(proximoJogoSessao.opponent).trim() : '';
    const atual = String(f.opponent || '').trim();
    const podeMudar = !atual || (adversarioAutoRef.current != null && atual === adversarioAutoRef.current);
    if (!podeMudar || atual === auto) { if (atual === auto && auto) adversarioAutoRef.current = auto; return; }
    adversarioAutoRef.current = auto || null;
    setF(prev => ({ ...prev, opponent: auto }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proximoJogoSessao, f.phase]);
  /* EDITAR UM EXERCÍCIO A PARTIR DA SESSÃO (lápis no cartão). Abre o
     mesmo editor de exercício. Ao guardar com alterações, pergunta:
     gravar por cima (o exercício muda em todo o lado) ou criar um
     exercício novo (o original fica como estava e esta sessão passa a
     usar o novo, no mesmo lugar e com os mesmos minutos). */
  const [editarEx, setEditarEx] = useState(null);
  const [escolhaGravar, setEscolhaGravar] = useState(null); // dados editados à espera da escolha
  /* GRAVAR POR CIMA, DAQUI PARA A FRENTE. O exercício muda nesta sessão
     e nas de data igual ou posterior. As sessões de data ANTERIOR que o
     usavam ficam como estavam: guarda-se uma cópia da versão antiga
     (arquivada, não aparece na biblioteca nem nas escolhas) e essas
     sessões passam a apontar para ela. Assim o histórico de treinos não
     é reescrito. */
  const sessoesAnterioresCom = (exId) => (sessions || []).filter(s => s && s.id !== f.id && s.date && f.date && s.date < f.date
    && (s.exerciseIds || []).some(e => e.exId === exId));
  const gravarPorCima = (data) => {
    const original = exercises.find(x => x.id === data.id);
    const passadas = original && setSessions ? sessoesAnterioresCom(data.id) : [];
    if (passadas.length) {
      const arquivo = { ...original, id: uid(), arquivado: true, versaoDe: original.id, arquivadoEm: todayStr() };
      const ids = new Set(passadas.map(s => s.id));
      setExercises(prev => [...prev.map(x => (x.id === data.id ? data : x)), arquivo]);
      setSessions(prev => (prev || []).map(s => (ids.has(s.id)
        ? { ...s, exerciseIds: (s.exerciseIds || []).map(e => (e.exId === data.id ? { ...e, exId: arquivo.id } : e)) }
        : s)));
    } else {
      setExercises(prev => prev.map(x => (x.id === data.id ? data : x)));
    }
    setEscolhaGravar(null); setEditarEx(null);
  };
  const gravarComoNovo = (data) => {
    const original = exercises.find(x => x.id === data.id);
    const nome = (data.name || '').trim();
    const novo = {
      ...data, id: uid(),
      name: original && nome === (original.name || '').trim() ? `${nome} (cópia)` : nome,
    };
    setExercises(prev => [...prev, novo]);
    setF(prev => {
      const tem = prev.exerciseIds.some(e => e.exId === data.id);
      return {
        ...prev,
        exerciseIds: tem
          ? prev.exerciseIds.map(e => (e.exId === data.id ? { ...e, exId: novo.id } : e))
          : [...prev.exerciseIds, { exId: novo.id, duration: novo.defaultDuration || 15 }],
      };
    });
    setEscolhaGravar(null); setEditarEx(null);
  };
  const exerciciosVisiveis = verTodasAsFases
    ? exercises.filter(x => !x.arquivado || f.exerciseIds.some(e => e.exId === x.id))
    : exercises.filter(x => (temMomento(x, f.phase) && !x.arquivado) || f.exerciseIds.some(e => e.exId === x.id));

  return (
    <Modal title={session ? 'Editar sessão' : 'Nova sessão'} onClose={onClose} wide xwide fullPage>
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      <div style={{ ...FIELD_GRID, marginBottom: 16 }}>
        <Field label="Data"><Input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Fase de jogo (foco)">
          <Select value={f.phase} onChange={e => {
            const phase = e.target.value;
            // "Descanso" é um dia de folga total: sem exercícios, sem
            // presenças e sem intensidade — por isso limpamos a intensidade
            // ao mudar para esta fase, e devolvemos um valor por omissão
            // sensato ('media') se o treinador voltar a escolher outra fase.
            setF({ ...f, phase, intensity: phase === 'Descanso' ? null : (f.intensity || 'media') });
          }}>
            {PHASES.map(p => <option key={p} value={p}>{p === 'Descanso' ? 'Descanso (Folga)' : p}</option>)}
          </Select>
        </Field>
        {f.phase !== 'Descanso' && (
          <Field label="Intensidade">
            <Select value={f.intensity} onChange={e => setF({ ...f, intensity: e.target.value })}>
              {INTENSITIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </Select>
          </Field>
        )}
        {f.phase !== 'Descanso' && (
          <>
            <Field label="Título / foco da sessão"><Input value={f.focus} onChange={e => setF({ ...f, focus: e.target.value })} placeholder="Ex: Pressing alto e coberturas" /></Field>
            <Field label="Próximo adversário (opcional)">
              <Input value={f.opponent} onChange={e => setF({ ...f, opponent: e.target.value })} placeholder="Ex: FC Foz"
                title={proximoJogoSessao && String(f.opponent || '').trim() === String(proximoJogoSessao.opponent).trim()
                  ? `Do próximo jogo marcado: ${fmtDate(proximoJogoSessao.date)}` : undefined} />
            </Field>
          </>
        )}
      </div>

      {f.phase === 'Descanso' ? (
        <div style={{
          marginBottom: 18, padding: '12px 14px', background: T.surface, border: `1px solid ${T.line}`,
          borderRadius: 8, fontSize: 13, color: T.mutedDim, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Moon size={15} color={T.mutedDim} /> Dia de folga — descanso total: sem exercícios, sem intensidade, sem presenças a registar.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Exercícios da sessão {totalMin ? `· ${totalMin} min total` : ''}
              </div>
              {exercises.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.mutedDim, cursor: 'pointer' }}>
                  <input type="checkbox" checked={verTodasAsFases} onChange={e => setVerTodasAsFases(e.target.checked)} />
                  Mostrar todas as fases
                </label>
              )}
            </div>
            {exercises.length === 0 ? (
              <div style={{ fontSize: 13, color: T.mutedDim }}>Cria exercícios primeiro no separador Exercícios.</div>
            ) : exerciciosVisiveis.length === 0 ? (
              <div style={{ fontSize: 13, color: T.mutedDim }}>
                Sem exercícios em "{f.phase}".{' '}
                <button type="button" onClick={() => setVerTodasAsFases(true)} style={{ background: 'none', border: 'none', padding: 0, color: T.gold, cursor: 'pointer', fontSize: 13, textDecoration: 'underline', ...body }}>
                  Mostrar todas as fases
                </button>
              </div>
            ) : (
              <>
                {/* OS CARTÕES, como em "Anexar exercício existente": esquema
                    em miniatura com ▶, procura, A–Z / Criação. Tocar no
                    cartão junta à sessão; voltar a tocar tira. Os
                    escolhidos mostram o número da ordem e os minutos no
                    próprio cartão, e "Na sessão" mostra só esses. Não há
                    lista à parte: escolher não muda a altura de nada. */}
                <EscolherParaCopiar
                  key={`${f.phase}|${verTodasAsFases ? 'todas' : 'fase'}`}
                  itens={exerciciosVisiveis}
                  tipo="exercicio"
                  fase={verTodasAsFases ? 'todas as fases' : f.phase}
                  nomeDe={(x) => x.name}
                  detalhesDe={(x) => [x.space && `📐 ${x.space}`, x.playersCount && `👥 ${x.playersCount}`, x.defaultDuration && `⏱ ${x.defaultDuration}'`, x.material].filter(Boolean)}
                  selecionados={f.exerciseIds.map(e => e.exId)}
                  onAlternar={(x) => toggleExercise(x.id)}
                  minutosDe={(x) => { const e = f.exerciseIds.find(z => z.exId === x.id); return e ? e.duration : ''; }}
                  onMinutos={(x, v) => setDuration(x.id, v)}
                  onEditar={setExercises ? (x) => setEditarEx(x) : undefined}
                  onLimparTodos={() => setF(prev => ({ ...prev, exerciseIds: [] }))}
                />
              </>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Presenças {f.attendance.length ? `· ${f.attendance.length}/${players.length}${convidadosDe(f).length ? ` +${convidadosDe(f).length}` : ''}` : ''}
              </span>
              {players.length > 0 && (
                <SelectAllBar
                  onSelectAll={() => setF({ ...f, attendance: [...new Set([...(f.attendance || []).filter(id => !players.some(p => p.id === id)), ...players.map(p => p.id)])] })}
                  onClear={() => setF({ ...f, attendance: [] })}
                />
              )}
            </div>
            {players.length === 0 ? (
              <div style={{ fontSize: 13, color: T.mutedDim }}>Adiciona jogadores primeiro no separador Plantel.</div>
            ) : (
              <PlayerChipList
                players={players}
                isOn={p => f.attendance.includes(p.id)}
                onToggle={p => toggleAttendance(p.id)}
                estadoClinico={p => estadoClinicoEm(p.id, f.date, clinico)}
              />
            )}
          </div>

          <ConvidadosEditor
            convidados={f.convidados}
            onChange={(lista) => setF({ ...f, convidados: lista })}
            onIntegrar={onIntegrarConvidado ? (c) => onIntegrarConvidado(c, (lista) => setF(prev => ({ ...prev, convidados: lista })), f.convidados) : null}
          />

          {/* A prancheta do plantel na folha impressa.

              Guardado como imprimirPlantel na sessão, e não como
              preferência global: há treinos em que interessa (o primeiro
              da semana, com o plantel todo) e outros em que é uma folha a
              mais. Fica desligado por omissão — quem quiser liga. */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            padding: '11px 13px', background: T.bg, borderRadius: 8,
            border: `1px solid ${T.line}`, marginBottom: 18,
          }}>
            <input
              type="checkbox"
              checked={!!f.imprimirPlantel}
              onChange={e => setF({ ...f, imprimirPlantel: e.target.checked })}
              style={{ width: 16, height: 16, marginTop: 1, flexShrink: 0, accentColor: '#B5393F' }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, color: T.cream }}>
                Quadro de posições para este treino
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: T.mutedDim, marginTop: 3, lineHeight: 1.6 }}>
                Um campo com os presentes distribuídos pelos lugares, para arrumares quem quiseres.
                Imprime-se à parte, pelo botão "Prancheta" no dia.
              </span>
            </span>
          </label>

          {f.imprimirPlantel && (
            <EditorPrancheta
              players={players}
              attendance={f.attendance}
              convidados={f.convidados}
              overrides={f.prancheta}
              tatica={f.pranchetaTatica}
              onChange={(ov) => setF({ ...f, prancheta: ov })}
              onTatica={(t) => setF({ ...f, pranchetaTatica: t })}
            />
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={!f.date} onClick={() => { limpar(); onSave(f); }}><Check size={15} /> Guardar sessão</Btn>
      </div>

      {/* O editor fica montado enquanto se escolhe como guardar: "Voltar
          à edição" volta exatamente ao que estava a ser feito. */}
      {editarEx && (
        <ExerciseModal
          exercise={editarEx}
          allExercises={exercises}
          meta={exercisesMeta}
          onClose={() => { setEscolhaGravar(null); setEditarEx(null); }}
          onSave={(data) => {
            // Sem alterações: fecha, sem perguntar nada.
            const original = exercises.find(x => x.id === editarEx.id) || editarEx;
            let igual = false;
            try { igual = JSON.stringify(data) === JSON.stringify(original); } catch (e) { igual = false; }
            if (igual) { setEditarEx(null); return; }
            setEscolhaGravar(data);
          }}
        />
      )}
      {/* A PERGUNTA não é uma janela "Modal": essas entram no histórico do
          browser, e fechar a terceira janela empilhada (sessão > exercício
          > pergunta) fazia o histórico recuar e fechava também a sessão,
          voltando ao Planeamento. Esta caixa fica por cima, sem mexer no
          histórico: o X e "Voltar à edição" voltam ao editor do exercício. */}
      {escolhaGravar && editarEx && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-label="Guardar as alterações" style={{
          width: '100%', maxWidth: 460, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 20, boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <h3 style={{ ...display, color: T.warn, fontSize: 19, fontWeight: 600, margin: 0 }}>Guardar as alterações</h3>
            <button type="button" onClick={() => setEscolhaGravar(null)} aria-label="Voltar à edição" title="Voltar à edição" style={{
              background: 'none', border: 'none', color: T.muted, cursor: 'pointer', display: 'flex', padding: 2,
            }}><X size={18} /></button>
          </div>
          <div style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.55, marginBottom: 6 }}>
            Alteraste <strong>{(editarEx && editarEx.name) || 'este exercício'}</strong>. Como queres guardar?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0 18px' }}>
            <button type="button" onClick={() => gravarPorCima(escolhaGravar)} style={{
              textAlign: 'left', padding: '11px 13px', borderRadius: 8, cursor: 'pointer', ...body,
              border: `1px solid ${T.line}`, background: T.surfaceRaise, color: T.cream,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Gravar por cima</div>
              <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 3 }}>
                {(() => {
                  const n = editarEx ? sessoesAnterioresCom(editarEx.id).length : 0;
                  return n
                    ? `O exercício fica alterado a partir desta sessão. ${n === 1 ? 'A sessão anterior que o usa fica' : `As ${n} sessões anteriores que o usam ficam`} com a versão antiga.`
                    : 'O exercício fica alterado a partir desta sessão, também nas sessões seguintes que o usam.';
                })()}
              </div>
            </button>
            <button type="button" onClick={() => gravarComoNovo(escolhaGravar)} style={{
              textAlign: 'left', padding: '11px 13px', borderRadius: 8, cursor: 'pointer', ...body,
              border: `1px solid ${T.line}`, background: T.surfaceRaise, color: T.cream,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Criar novo exercício</div>
              <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 3 }}>O original fica como estava. Esta sessão passa a usar o novo, no mesmo lugar e com os mesmos minutos.</div>
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEscolhaGravar(null)}><ChevronLeft size={14} /> Voltar à edição</Btn>
          </div>
        </div>
        </div>,
        document.body
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------
   DIA — ao clicar na data de uma sessão no Planeamento, mostra todos
   os treinos desse dia (pode haver mais do que uma sessão na mesma
   data), com a informação de cada um e o esquema tático de cada
   exercício, incluindo imagens/PDFs anexados.
---------------------------------------------------------------- */
export function DayModal({ date, daySessions, exercises, players, onClose, onPrint, onPrintPresencas, onPrintPrancheta, onEditSession }) {
  const totalMin = daySessions.reduce((sum, s) => sum + (s.exerciseIds || []).reduce((a, e) => a + (Number(e.duration) || 0), 0), 0);
  const presentPlayers = players.filter(p => daySessions.some(s => (s.attendance || []).includes(p.id)));
  // Convidados à experiência de qualquer sessão do dia — um convidado que
  // apareça em duas sessões do mesmo dia só conta uma vez.
  const presentGuests = (() => {
    const vistos = new Set();
    const lista = [];
    daySessions.forEach(s => convidadosDe(s).forEach(c => {
      if (!vistos.has(c.id)) { vistos.add(c.id); lista.push(c); }
    }));
    return lista;
  })();

  return (
    <Modal title={fmtDate(date)} onClose={onClose} wide fullPage>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: T.mutedDim }}>
          {daySessions.length} {daySessions.length === 1 ? 'sessão' : 'sessões'} · {totalMin} min total
        </span>
        {/* Três impressões diferentes, e cada uma serve um momento: o dia
            inteiro para preparar, as presenças para levar na prancheta, e
            o campo com o plantel para ver quem se tem em cada zona.
            Estavam todas escondidas dentro de uma só. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onPrintPresencas && (
            <Btn variant="ghost" onClick={onPrintPresencas} title="Folha de presenças para assinalar no campo">
              <Printer size={14} /> Presenças
            </Btn>
          )}
          {onPrintPrancheta && daySessions.some(s => s.imprimirPlantel) && (
            <Btn variant="ghost" onClick={onPrintPrancheta} title="Campo com o plantel presente por posição">
              <Printer size={14} /> Prancheta
            </Btn>
          )}
          <Btn onClick={onPrint}><Printer size={14} /> Imprimir</Btn>
        </div>
      </div>

      {daySessions.map((s, si) => (
        <div key={s.id} style={{ marginBottom: 22, paddingBottom: 18, borderBottom: si < daySessions.length - 1 ? `1px solid ${T.line}` : 'none' }}>
          {/* Sem quebra de linha: no telemóvel o subtítulo (fase · intensidade
              · adversário) é comprido e, com flexWrap, atirava o lápis para
              uma linha só dele, desalinhado. Agora o texto quebra dentro do
              seu próprio bloco e o lápis fica sempre em linha, à direita. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.cream, fontSize: 16, fontWeight: 600 }}>{s.phase === 'Descanso' ? 'Folga' : (s.focus || 'Sessão de treino')}</div>
              <div style={{ color: T.mutedDim, fontSize: 12 }}>
                {[s.phase, tempoJogoText(s), intensityText(s), s.opponent && `vs ${s.opponent}`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button onClick={() => onEditSession(s)} title="Editar sessão" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0, marginTop: 4 }}>
              <Pencil size={14} />
            </button>
          </div>

          {s.phase === 'Descanso' ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim }}>Dia de folga — sem treino.</div>
          ) : (s.exerciseIds || []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim }}>Sem exercícios associados a esta sessão.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {s.exerciseIds.map((e, i) => {
                const ex = exercises.find(x => x.id === e.exId);
                if (!ex) return null;
                return (
                  <div key={e.exId} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: T.cream, fontSize: 13.5, fontWeight: 500 }}>{i + 1}. {ex.name}</span>
                      <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim }}>{e.duration} min</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: T.mutedDim, marginBottom: 8, ...mono }}>
                      {ex.phase && <span>{momentoTexto(ex)}</span>}
                      {ex.space && <span>📐 {ex.space}</span>}
                      {ex.playersCount && <span>👥 {ex.playersCount}</span>}
                      {ex.material && <span>🎒 {ex.material}</span>}
                    </div>
                    {ex.description && (
                      <p style={{ fontSize: 12.5, color: T.mutedDim, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{ex.description}</p>
                    )}
                    {ex.attachment && (
                      <div style={{ marginBottom: 8 }}>
                        {ex.attachment.type === 'image' ? (
                          <img src={ex.attachment.dataUrl} alt={ex.attachment.name} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6, border: `1px solid ${T.line}`, background: '#000' }} />
                        ) : (
                          <>
                            <a href={ex.attachment.dataUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.gold, textDecoration: 'none', marginBottom: 6 }}>
                              <BookOpen size={13} /> {ex.attachment.name}
                            </a>
                            {ex.attachment.dataUrl && (
                              <PdfComoImagens url={ex.attachment.dataUrl}
                                estiloImg={{ width: '100%', display: 'block', borderRadius: 6, border: `1px solid ${T.line}`, background: '#fff', marginBottom: 6 }} />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {/* Com anexo, o campo só aparece se tiver alguma coisa desenhada. */}
                    {(!ex.attachment || (ex.diagram && ((ex.diagram.elements || []).length || (ex.diagram.arrows || []).length))) && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: aspetoSemBancos(ex.diagram && ex.diagram.vista) }}>
                      <svg viewBox={viewBoxSemBancos(ex.diagram && ex.diagram.vista)} preserveAspectRatio="xMidYMid meet" style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        background: '#1e3a24', borderRadius: 6, border: `1px solid ${T.line}`,
                      }}>
                        <VistaCampo esticar={ESTICAR_IMPRESSAO_MEIO} vista={ex.diagram && ex.diagram.vista}>
                        <PitchMarkings semBancos />
                        <SpaceZonesReadOnly diagram={ex.diagram} spaceText={ex.space} />
                        {(() => {
                          const d = diagramaParaImpressao(ex.diagram);
                          return <DiagramElements elements={d.elements} arrows={d.arrows} interactive={false} iconScale={iconScaleForPhase(ex.phase, ex.diagram)} />;
                        })()}
                        </VistaCampo>
                      </svg>
                    </div>
                    )}
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <span style={{ fontSize: 10.5, color: T.mutedDim, letterSpacing: '.04em' }}>™ Mister JP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Presenças</div>
      {presentPlayers.length === 0 && presentGuests.length === 0 ? (
        <p style={{ fontSize: 13, color: T.mutedDim, margin: 0 }}>Sem registo</p>
      ) : (
        /* Por posição, jogadores do plantel e convidados à experiência
           juntos numa lista só (marcada "exp" para se distinguir quem é
           quem) — mesmo padrão de nome curto e posição da Monitorização.

           EM DUAS COLUNAS, a da esquerda com o nome a mais quando o total
           é ímpar (ver o mesmo critério em `PrintPresencasPorPosicao`):
           lê-se de cima para baixo, esquerda primeiro, sem a lista ficar
           comprida demais para caber no ecrã dum telemóvel. */
        (() => {
          const todos = sortByPosition([
            ...presentPlayers.map(p => ({ id: p.id, position: p.position, number: p.number, label: shortPlayerName(p, players), exp: false })),
            ...presentGuests.map(c => ({ id: `c:${c.id}`, position: c.position, number: null, label: c.nome, exp: true })),
          ]);
          const metade = Math.ceil(todos.length / 2);
          const col1 = todos.slice(0, metade);
          const col2 = todos.slice(metade);
          const linha = (j) => (
            <div key={j.id} style={{ fontSize: 13, color: T.mutedDim }}>
              {j.position ? `${j.position} · ` : ''}{j.label}{j.exp ? <span style={{ opacity: 0.6 }}> exp</span> : null}
            </div>
          );
          return (
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>{col1.map(linha)}</div>
              {col2.length > 0 && (
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>{col2.map(linha)}</div>
              )}
            </div>
          );
        })()
      )}
    </Modal>
  );
}

