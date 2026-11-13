// plantel/Monitorizacao.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useEffect } from 'react';
import { uid, todayStr, addDays, fmtDate, formatShortDatePt } from '../base/utilidades';
import { removeWithUndo, Btn, SectionHeader, Panel, EmptyState, FIELD_GRID, Field, Input, FIELD_FULL, Modal } from '../base/ui';
import { jogoNaoJogado } from '../dominio/estadoJogos';
import { POSITIONS, sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { T, mono, body, TEXT_ON_ACCENT } from '../base/tema';
import { Plus, MessageCircle, EyeOff, Eye, Trash2 } from 'lucide-react';
import { ToggleBtn } from '../base/ui-extra';
import { estadoClinicoEm, resumoClinico } from '../dominio/clinico';
import { intensityText } from '../treino/comum';
import { RPE_CONTEXTO_LABEL, rpeContexto, tdStyle, wellnessAvg } from './comum';
import { MonitorizacaoGps } from './Gps';
import { ComposicaoCorporal } from './Composicao';
import { TEXTO_LEMBRETE_PSE, TEXTO_LEMBRETE_WELLNESS, linkWhatsApp } from '../dominio/mensagens';
import { PlantelHistorico } from './Historico';
import { ManualCheckinBoard } from './CheckinManual';

/* ---------------------------------------------------------------
   MONITORIZAÇÃO
---------------------------------------------------------------- */
export function Monitorizacao({ players, setPlayers, monitoring, setMonitoring, sessions, matches = [], teamId, clinico = [] }) {
  // Contexto de cada PSE (treino ou jogo) — ver rpeContexto.
  const ctx = { matches, sessions };
  const [modal, setModal] = useState(false);
  const [modalType, setModalType] = useState('wellness');
  // "Sessão de hoje" fica fechada por omissão — é consulta pontual, não
  // precisa de estar sempre à vista (ver a nota grande junto ao Panel).
  const [mostrarSessaoHoje, setMostrarSessaoHoje] = useState(false);
  // Mesma lógica: a tabela de respostas é longa e só se costuma abrir
  // para consultar um caso específico, não para estar sempre visível.
  const [mostrarRespostas, setMostrarRespostas] = useState(false);
  // Duas vistas sobre a MESMA coleção `monitoring`: Wellness/PSE (dos
  // questionários) e Composição Corporal (pesagens). Um separador simples
  // em vez de duas rotas — é a mesma área, só muda o que se está a olhar.
  const [subTab, setSubTab] = useState('wellness');
  // O GPS começa a carregar por trás meio segundo depois de abrir a
  // Monitorização (para não atrasar o que se vê primeiro).
  const [gpsMontado, setGpsMontado] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGpsMontado(true), 500); return () => clearTimeout(t); }, []);
  const openBoard = (type) => { setModalType(type); setModal(true); };
  /* FILA DE LEMBRETES — uma conversa de cada vez, sempre.

     O WhatsApp não tem um link que abra várias conversas ao mesmo
     tempo — isso só a API oficial do WhatsApp Business faz, e essa
     exige conta verificada pela Meta e um servidor próprio a guardar
     credenciais, isto é, uma infraestrutura à parte da app.

     O que dá para fazer sem isso é encadear os lembretes: mostra-se um
     jogador de cada vez, com um botão a abrir o WhatsApp já com a
     mensagem escrita (um verdadeiro toque do treinador, por isso nunca
     é bloqueado como pop-up) e "Seguinte" avança para o próximo. Não é
     "enviar a todos de uma vez", mas tira o trabalho de ir à procura de
     cada jogador na tabela, um a um. */
  const [filaLembretes, setFilaLembretes] = useState(null); // { lista: [{ player, url }], indice }

  /* O link do Portal do Atleta (e o botão para o abrir) passou para
     Equipa › Membros e convite, junto dos códigos de acesso: já não é só
     o questionário de wellness, é a porta de entrada dos atletas. */

  // Registo manual: substitui o registo do mesmo jogador/dia/tipo em vez de
  // duplicar linhas — o quadro fica aberto para o jogador seguinte.
  const save = (data) => {
    setMonitoring(prev => {
      const idx = prev.findIndex(m => m.playerId === data.playerId && m.date === data.date && m.type === data.type);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...prev[idx], ...data };
        return copy;
      }
      return [...prev, { ...data, id: uid() }];
    });
  };
  const remove = (id) => removeWithUndo(monitoring, setMonitoring, id, 'Registo de monitorização');

  const todayDateStr = todayStr();
  /* DATA DO ÚLTIMO TREINO E DO ÚLTIMO JOGO da equipa, para as colunas
     "Últ. PSE". Conta um dia já passado, ou o de hoje se alguém já tiver
     respondido ao PSE (antes disso, hoje ainda não "aconteceu" e via-se a
     coluna toda vazia de manhã). */
  const ultimasDatasPse = React.useMemo(() => {
    const comPse = (d, c) => monitoring.some(m => m.date === d && typeof m.pse === 'number' && rpeContexto(m, ctx) === c);
    const valida = (d, c) => d && d <= todayDateStr && (d < todayDateStr || comPse(d, c));
    const treinos = [...new Set(sessions.filter(x => x.date && x.phase !== 'Descanso' && x.phase !== 'Jogo').map(x => x.date))]
      .filter(d => !matches.some(m => m.date === d))
      .sort().reverse();
    const jogos = [...new Set([
      ...matches.filter(m => m.date && !jogoNaoJogado(m)).map(m => m.date),
      ...sessions.filter(x => x.date && x.phase === 'Jogo').map(x => x.date),
    ])].sort().reverse();
    return { treino: treinos.find(d => valida(d, 'treino')) || null, jogo: jogos.find(d => valida(d, 'jogo')) || null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoring, sessions, matches, todayDateStr]);
  const yesterdayDateStr = addDays(todayDateStr, -1);
  // Índice tático do jogador, para ordenar as respostas da mesma forma que
  // o resto da app (GR, defesas, médios, avançados).
  const posRank = (playerId) => {
    const p = players.find(x => x.id === playerId);
    const i = p ? POSITIONS.indexOf(p.position) : -1;
    return i === -1 ? POSITIONS.length : i;
  };
  const nameOf = (playerId) => {
    const p = players.find(x => x.id === playerId);
    return p ? p.name : '';
  };
  // A tabela de respostas mostra apenas a véspera e o próprio dia — é o
  // que interessa para decidir o treino de hoje. O histórico completo
  // continua guardado; só não é listado aqui. Ordena por posição (e não
  // por dia): cada jogador aparece com todas as suas linhas juntas, mais
  // recente primeiro.
  /* Intervalo de datas das respostas. Por omissão continua a mostrar
     ontem e hoje, que é o que interessa no dia a dia; o intervalo serve
     para ir buscar uma semana atrás sem sair do ecrã. */
  const [deData, setDeData] = useState(yesterdayDateStr);
  const [ateData, setAteData] = useState(todayDateStr);
  const dentroDoIntervalo = (d) => !!d && (!deData || d >= deData) && (!ateData || d <= ateData);

  const sorted = [...monitoring]
    .filter(m => dentroDoIntervalo(m.date))
    .sort((a, b) => {
      const byPos = posRank(a.playerId) - posRank(b.playerId);
      if (byPos !== 0) return byPos;
      const byName = nameOf(a.playerId).localeCompare(nameOf(b.playerId), 'pt');
      if (byName !== 0) return byName;
      if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
      return String(a.type || '').localeCompare(String(b.type || ''));
    });
  const todaySession = sessions.find(s => s.date === todayDateStr);

  const th2 = { textAlign: 'left', padding: '9px 12px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` };
  const td2 = { padding: '9px 12px', fontSize: 13, color: T.mutedDim };

  return (
    <div>
      <SectionHeader title="Monitorização" subtitle={subTab === 'wellness' ? 'Wellness e RPE' : subTab === 'gps' ? 'GPS e carga' : 'Composição corporal'}
        action={subTab === 'gps' ? null : subTab === 'wellness'
          ? <Btn onClick={() => openBoard('wellness')} disabled={players.length === 0}><Plus size={15} /> Novo registo</Btn>
          : <Btn onClick={() => openBoard('composicao')} disabled={players.length === 0}><Plus size={15} /> Nova pesagem</Btn>} />

      {/* Separador simples: as duas vistas partilham o resto do ecrã
          (o modal de registo manual, o botão de ação) e só diferem no
          conteúdo abaixo. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <ToggleBtn active={subTab === 'wellness'} onClick={() => setSubTab('wellness')}>Wellness / PSE</ToggleBtn>
        <ToggleBtn active={subTab === 'composicao'} onClick={() => setSubTab('composicao')}>Composição Corporal</ToggleBtn>
        <ToggleBtn active={subTab === 'gps'} onClick={() => setSubTab('gps')}>GPS / Carga</ToggleBtn>
      </div>

      {/* GPS SEM ESPERA. Carrega por trás logo que se entra na Monitorização
          e fica montado (escondido) nos outros separadores: ao carregar em
          "GPS / Carga" os dados já lá estão, em vez de "A preparar…" e
          "A carregar os dados de GPS…" de cada vez. Não tem nada que meça
          larguras, por isso pode estar escondido sem estragar o desenho. */}
      {(gpsMontado || subTab === 'gps') && (
        <div style={{ display: subTab === 'gps' ? 'block' : 'none' }}>
          <MonitorizacaoGps players={players} sessions={sessions} matches={matches} monitoring={monitoring} clinico={clinico} teamId={teamId} />
        </div>
      )}
      {subTab === 'gps' ? null : subTab === 'composicao' ? (
        <ComposicaoCorporal players={players} monitoring={monitoring} setMonitoring={setMonitoring} onNovaPesagem={() => openBoard('composicao')} />
      ) : (
      <>

      {players.length > 0 && (
        <Panel title="Plantel — estado atual">
          {(() => {
            // Um treino/jogo marcado para hoje é o que diz se o PSE faz
            // sentido hoje — sem sessão, não há PSE nenhum para lembrar.
            const sessaoHoje = sessions.find(s => s.date === todayDateStr);
            const precisaPseHoje = !!sessaoHoje && sessaoHoje.phase !== 'Descanso';
            // A mesma lista que dá os ícones individuais da tabela,
            // calculada uma vez aqui para o botão "Lembrar todos" e
            // reaproveitada célula a célula mais abaixo. Um jogador pode
            // entrar duas vezes (falta o Wellness E o PSE) — são dois
            // lembretes diferentes, não um só.
            const pendentes = [];
            sortByPosition(players).forEach(p => {
              const recs = monitoring.filter(m => m.playerId === p.id);
              const todayWellness = recs.find(r => r.date === todayDateStr && typeof r.sono === 'number');
              if (!todayWellness) {
                const url = linkWhatsApp(p.contact, TEXTO_LEMBRETE_WELLNESS(p));
                if (url) pendentes.push({ player: p, url, tipo: 'Wellness' });
              }
              if (precisaPseHoje) {
                const todayPse = recs.find(r => r.date === todayDateStr && typeof r.pse === 'number');
                if (!todayPse) {
                  const url = linkWhatsApp(p.contact, TEXTO_LEMBRETE_PSE(p));
                  if (url) pendentes.push({ player: p, url, tipo: 'PSE' });
                }
              }
            });
            return pendentes.length > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <Btn variant="ghost" onClick={() => setFilaLembretes({ lista: pendentes, indice: 0 })}>
                  <MessageCircle size={15} color="#25D366" /> Lembrar todos ({pendentes.length})
                </Btn>
              </div>
            ) : null;
          })()}
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={th2}>Estado</th>
                  <th style={th2}>Jogador</th>
                  <th style={th2}>Wellness (hoje)</th>
                  <th style={th2}>Últ. PSE treino{ultimasDatasPse.treino ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>({fmtDate(ultimasDatasPse.treino)})</span> : null}</th>
                  <th style={th2}>Últ. PSE jogo{ultimasDatasPse.jogo ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>({fmtDate(ultimasDatasPse.jogo)})</span> : null}</th>
                  <th style={th2}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sessaoHoje = sessions.find(s => s.date === todayDateStr);
                  const precisaPseHoje = !!sessaoHoje && sessaoHoje.phase !== 'Descanso';
                  return sortByPosition(players).map(p => {
                  /* Só o ÚLTIMO treino e o ÚLTIMO jogo da equipa (ver
                     `ultimasDatasPse`, mais acima): quem não treinou ou não
                     respondeu nesse dia fica sem nada, em vez de mostrar
                     um PSE antigo de outro dia. */
                  const recs = monitoring.filter(m => m.playerId === p.id).sort((a, b) => new Date(b.date) - new Date(a.date));
                  const lastWellness = recs.find(r => typeof r.sono === 'number');
                  const pseRecs = recs.filter(r => typeof r.pse === 'number');
                  const lastRpeTreino = ultimasDatasPse.treino ? pseRecs.find(r => r.date === ultimasDatasPse.treino && rpeContexto(r, ctx) === 'treino') : null;
                  const lastRpeJogo = ultimasDatasPse.jogo ? pseRecs.find(r => r.date === ultimasDatasPse.jogo && rpeContexto(r, ctx) === 'jogo') : null;
                  const todayWellness = recs.find(r => r.date === todayDateStr && typeof r.sono === 'number');
                  const wellnessToday = wellnessAvg(todayWellness);
                  const avg = wellnessAvg(lastWellness);
                  const corWellness = avg === null ? T.good : avg >= 3.5 ? T.good : avg >= 2.2 ? T.warn : T.bad;
                  const rotuloWellness = avg === null ? 'Apto' : avg >= 3.5 ? 'Apto' : avg >= 2.2 ? 'Atenção' : 'Risco';
                  /* O boletim clínico manda: com uma ocorrência aberta hoje
                     (lesão, doença…), o estado é o nível dela, mesmo que o
                     wellness diga "Apto". Sem ocorrência, decide o wellness. */
                  const clinicoHoje = estadoClinicoEm(p.id, todayDateStr, clinico);
                  const statusColor = clinicoHoje ? clinicoHoje.cor : corWellness;
                  const statusLabel = clinicoHoje ? clinicoHoje.curto : rotuloWellness;
                  const statusTitulo = clinicoHoje
                    ? `${resumoClinico(clinicoHoje)}${avg !== null ? ` · Wellness: ${rotuloWellness}` : ''}`
                    : undefined;
                  // Só faz sentido lembrar quem ainda não respondeu hoje e
                  // tem um contacto guardado — sem as duas coisas, não há
                  // nada para onde mandar nem nada por que lembrar.
                  const lembreteWellnessUrl = wellnessToday === null
                    ? linkWhatsApp(p.contact, TEXTO_LEMBRETE_WELLNESS(p))
                    : null;
                  const todayPse = recs.find(r => r.date === todayDateStr && typeof r.pse === 'number');
                  const lembretePseUrl = (precisaPseHoje && !todayPse)
                    ? linkWhatsApp(p.contact, TEXTO_LEMBRETE_PSE(p))
                    : null;
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                      <td style={td2} title={statusTitulo}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ ...td2, color: T.cream }} title={p.name}>{p.position ? `${p.position} · ` : ''}{shortPlayerName(p, players)}</td>
                      <td style={{ ...td2, ...mono }}>{wellnessToday !== null ? wellnessToday.toFixed(1) : '—'}</td>
                      <td style={{ ...td2, ...mono }} title={lastRpeTreino ? fmtDate(lastRpeTreino.date) : undefined}>{lastRpeTreino ? lastRpeTreino.pse : '—'}</td>
                      <td style={{ ...td2, ...mono, color: lastRpeJogo ? T.warn : T.mutedDim }} title={lastRpeJogo ? fmtDate(lastRpeJogo.date) : undefined}>{lastRpeJogo ? lastRpeJogo.pse : '—'}</td>
                      <td style={td2}>
                        <span style={{ display: 'inline-flex', gap: 8 }}>
                          {lembreteWellnessUrl && (
                            <a href={lembreteWellnessUrl} target="_blank" rel="noopener noreferrer" title="Lembrar Wellness por WhatsApp"
                              style={{ display: 'inline-flex', color: '#25D366' }}>
                              <MessageCircle size={16} />
                            </a>
                          )}
                          {lembretePseUrl && (
                            <a href={lembretePseUrl} target="_blank" rel="noopener noreferrer" title="Lembrar PSE por WhatsApp"
                              style={{ display: 'inline-flex', color: '#25D366', opacity: 0.65 }}>
                              <MessageCircle size={16} />
                            </a>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div style={{ height: 16 }} />

      {/* Por baixo do "Plantel — estado atual" (o que se consulta
          primeiro), sempre aberto — é só uma ou duas linhas, não compensa
          ter de carregar em "Mostrar" para as ver. */}
      <Panel title="Sessão de hoje (usada no RPE)">
        {todaySession ? (
          <div style={{ fontSize: 13, color: T.cream, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontWeight: 500 }}>{todaySession.phase === 'Descanso' ? 'Folga' : (todaySession.focus || todaySession.phase || 'Sessão de treino')}</div>
            <div style={{ fontSize: 12, color: T.mutedDim }}>
              {[todaySession.phase, intensityText(todaySession)].filter(Boolean).join(' · ')}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: T.mutedDim }}>
            Ainda não há sessão criada para hoje em Planeamento. O RPE dos atletas fica associado automaticamente à sessão do dia — cria a sessão de hoje em Planeamento para que fiquem ligados.
          </div>
        )}
      </Panel>

      <div style={{ height: 16 }} />

      <Panel title="Respostas"
        action={<button onClick={() => setMostrarRespostas(!mostrarRespostas)} style={{ background: 'none', border: 'none', color: T.warn, cursor: 'pointer', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5 }}>
          {mostrarRespostas ? <><EyeOff size={13} /> Ocultar</> : <><Eye size={13} /> Mostrar</>}
        </button>}>
      {!mostrarRespostas ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim, padding: '4px 0' }}>
          {sorted.length} {sorted.length === 1 ? 'resposta' : 'respostas'} entre {formatShortDatePt(deData)} e {formatShortDatePt(ateData)} — clica em "Mostrar" para consultar.
        </div>
      ) : players.length === 0 ? (
        <EmptyState text="Adiciona jogadores no Plantel antes de registar dados de monitorização." />
      ) : (
        <>
          {/* Mesma grelha e mesmos atalhos do histórico do plantel, mais
              abaixo: dois filtros de data com aspetos diferentes na mesma
              página obrigam a reaprender o mesmo gesto duas vezes. */}
          <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
            <Field label="Data de início">
              <Input type="date" value={deData} max={ateData || undefined} onChange={e => setDeData(e.target.value)} />
            </Field>
            <Field label="Data de fim">
              <Input type="date" value={ateData} min={deData || undefined} onChange={e => setAteData(e.target.value)} />
            </Field>
            <div style={{ ...FIELD_FULL, display: 'flex', gap: 6 }}>
              {[['Ontem e hoje', 1], ['7 dias', 6], ['14 dias', 13], ['30 dias', 29]].map(([label, back]) => {
                const ativo = deData === addDays(todayDateStr, -back) && ateData === todayDateStr;
                return (
                  <button
                    key={label}
                    onClick={() => { setDeData(addDays(todayDateStr, -back)); setAteData(todayDateStr); }}
                    style={{
                      flex: 1, height: 38, padding: '0 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', ...body,
                      background: ativo ? '#B5393F' : 'transparent',
                      color: ativo ? TEXT_ON_ACCENT : T.muted,
                      border: `1px solid ${ativo ? '#B5393F' : T.line}`,
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.mutedDim, margin: '0 0 10px' }}>
            {formatShortDatePt(deData)} a {formatShortDatePt(ateData)} · {sorted.length} {sorted.length === 1 ? 'resposta' : 'respostas'}
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              text={`Sem respostas entre ${formatShortDatePt(deData)} e ${formatShortDatePt(ateData)}.`}
              action={<Btn onClick={() => setModal(true)}><Plus size={15} /> Registar agora</Btn>}
            />
          ) : (
          <>
          <div style={{ overflowX: 'auto', border: `1px solid ${T.line}`, borderRadius: 10 }}>
          <table>
            <thead>
              <tr style={{ background: T.surface }}>
                {['Data', 'Jogador', 'Tipo', 'PSE', 'Sono', 'Fadiga', 'Dor musc.', 'Humor', 'Stress', 'Estado', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => {
                const p = players.find(pl => pl.id === m.playerId);
                const avg = wellnessAvg(m);
                const color = avg === null ? T.mutedDim : avg >= 4 ? T.good : avg >= 2.5 ? T.warn : T.bad;
                const contexto = m.type === 'rpe' || typeof m.pse === 'number' ? rpeContexto(m, ctx) : null;
                const typeLabel = m.type === 'wellness'
                  ? 'Wellness'
                  : (m.type === 'rpe' ? `PSE · ${RPE_CONTEXTO_LABEL[contexto]}` : 'Manual');
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <td style={tdStyle}>{fmtDate(m.date)}</td>
                    <td style={{ ...tdStyle, color: T.cream }} title={p ? p.name : undefined}>{p ? `${p.position ? `${p.position} · ` : ''}${shortPlayerName(p, players)}` : '—'}</td>
                    <td style={{ ...tdStyle, color: contexto === 'jogo' ? T.warn : undefined }}>{typeLabel}</td>
                    <td style={{ ...tdStyle, ...mono }}>{typeof m.pse === 'number' ? `${m.pse}/10` : '—'}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.sono ?? '—'}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.fadiga ?? '—'}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.dor ?? '—'}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.humor ?? '—'}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.stress ?? '—'}</td>
                    <td style={tdStyle}>{avg !== null && <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />}</td>
                    <td style={tdStyle}>
                      <button onClick={() => remove(m.id)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </>
          )}
        </>
      )}
      </Panel>

      {players.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <PlantelHistorico players={players} monitoring={monitoring} matches={matches} sessions={sessions} />
        </>
      )}
      </>
      )}

      {modal && (
        <ManualCheckinBoard
          initialType={modalType}
          players={players} monitoring={monitoring} sessions={sessions} matches={matches}
          onClose={() => setModal(false)} onSave={save}
        />
      )}

      {filaLembretes && (
        <FilaDeLembretes fila={filaLembretes} onAvancar={setFilaLembretes} onFechar={() => setFilaLembretes(null)} />
      )}
    </div>
  );
}

/* Um jogador de cada vez, sempre — ver a nota no "FILA DE LEMBRETES" lá
   em cima, em Monitorizacao, sobre porque não dá para abrir todas as
   conversas de uma só vez. */
export function FilaDeLembretes({ fila, onAvancar, onFechar }) {
  const { lista, indice } = fila;
  const atual = lista[indice];
  const ultimo = indice === lista.length - 1;

  if (!atual) return null;

  return (
    <Modal title={`Lembrar ${atual.tipo} por WhatsApp`} subtitle={`${indice + 1} de ${lista.length}`} onClose={onFechar}>
      <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
        <div style={{ fontSize: 16, color: T.cream, fontWeight: 600, marginBottom: 4 }}>
          {atual.player.position ? `${atual.player.position} · ` : ''}{atual.player.name}
        </div>
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 22 }}>
          {atual.tipo === 'PSE' ? 'Ainda não respondeu ao PSE de hoje' : 'Ainda não respondeu ao Wellness de hoje'}
        </div>
        <a
          href={atual.url} target="_blank" rel="noopener noreferrer"
          onClick={() => {
            // Um toque = uma conversa aberta e avançada. Se o treinador
            // preferir não mandar a este, "Saltar" (abaixo) avança sem abrir.
            setTimeout(() => {
              if (ultimo) onFechar(); else onAvancar({ lista, indice: indice + 1 });
            }, 300);
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 10,
            background: '#25D366', color: '#0b1a10', fontWeight: 600, fontSize: 14.5, textDecoration: 'none', ...body,
          }}
        >
          <MessageCircle size={18} /> Abrir WhatsApp
        </a>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
        <button
          onClick={() => (ultimo ? onFechar() : onAvancar({ lista, indice: indice + 1 }))}
          style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', fontSize: 13, ...body }}
        >
          Saltar {!ultimo && '(sem abrir)'}
        </button>
        <button onClick={onFechar} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', fontSize: 13, ...body }}>
          Parar aqui
        </button>
      </div>
    </Modal>
  );
}

