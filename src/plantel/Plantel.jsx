// plantel/Plantel.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useEffect, useRef } from 'react';
import { useDetailBack } from '../base/historico';
import { buildShareableHtmlDoc, shareOrDownloadHtml } from '../base/partilha';
import { playerStats } from '../dominio/estatisticas';
import { uid, todayStr, timeAgo } from '../base/utilidades';
import { trocarJanela, askConfirm, itemLabel, offerUndo, UNDO_SECONDS, Btn, SectionHeader, EmptyState } from '../base/ui';
import { sortByPosition, shortFullName } from '../dominio/jogadores';
import { T, display, mono } from '../base/tema';
import { Trash2, Plus, ChevronUp, ChevronDown, Share2, Printer, Pencil } from 'lucide-react';
import { CaptainArmband } from '../dominio/plantel';
import { createPortal } from 'react-dom';
import { PlayerPrintSheet, PlayerProfilePage, buildPlayerReportHtml, jogosOficiaisDe } from './PlayerProfilePage';
import { Badge, contarRastoDoJogador, limparRastoDoJogador } from './comum';
import { apagarMp4DoAtleta } from '../media/videoJunto';
import { RecuperarApagados } from './RecuperarApagados';
import { FichaOcorrencia, OcorrenciaModal, proporMarcacaoClinica } from './Clinico';
import { PlayerModal, playerBirthLine } from './PlayerModal';

/* ---------------------------------------------------------------
   PLANTEL
---------------------------------------------------------------- */
export function Plantel({ players, setPlayers, sessions, setSessions, matches, setMatches, convocatorias, setConvocatorias, monitoring, setMonitoring, meta, clinico, setClinico, desenvolvimento, setDesenvolvimento, diario = [], autorizarApagarRasto, teamId }) {
  const [modal, setModal] = useState(null); // null | 'new' | player object (edit)
  const [modalVoltarPerfil, setModalVoltarPerfil] = useState(false); // true só quando abriu a partir do perfil
  const [statsFor, setStatsFor] = useState(null); // player object (view stats)
  const fecharPerfil = useDetailBack(!!statsFor, () => setStatsFor(null));
  const [printPlayer, setPrintPlayer] = useState(null); // ficha a imprimir

  // Mesma lógica do Scouting: partilha um ficheiro HTML autónomo com a
  // ficha do jogador, ou imprime/guarda em PDF.
  const doShare = (p) => {
    const title = p.name || 'Jogador';
    const html = buildShareableHtmlDoc({
      title, metaLines: [], blocks: [],
      extraHtml: buildPlayerReportHtml(p, playerStats(p, sessions, jogosOficiaisDe(matches))),
    });
    shareOrDownloadHtml(`jogador_${title.replace(/[^\w-]+/g, '_')}.html`, html, title);
  };
  const doPrint = (p) => {
    setPrintPlayer(p);
    setTimeout(() => window.print(), 80);
  };
  /* A folha tem de sair do body depois de imprimir — mesmo padrão usado
     nas outras folhas (ver Simulador, Planeamento, Jogos). */
  useEffect(() => {
    if (!printPlayer) return undefined;
    const limpar = () => setPrintPlayer(null);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [printPlayer]);

  const save = (data) => {
    const isEdicao = !!data.id;
    if (isEdicao) {
      setPlayers(prev => prev.map(p => p.id === data.id ? data : p));
    } else {
      setPlayers(prev => [...prev, { ...data, id: uid() }]);
    }
    if (isEdicao && modalVoltarPerfil) trocarJanela(() => setModal(null), () => setStatsFor(data));
    else setModal(null);
  };
  /* APAGAR UM JOGADOR APAGA MESMO O JOGADOR.

     Antes tirava-se a linha do plantel e ficava tudo o resto: presenças,
     notas, minutos, wellness, boletim clínico. Invisível, porque as
     vistas percorrem o plantel e um id que já não existe não aparece — e
     é essa invisibilidade que fazia disto um problema a sério e não uma
     arrumação por fazer.

     A confirmação diz os números antes de apagar. "Isto apaga 499
     registos de bem-estar" faz parar quem estava a clicar por hábito, o
     que uma frase genérica não faz.

     O anular do `removeWithUndo` devolve o JOGADOR, não o rasto — por
     isso o rasto só se limpa depois de a janela de anulação passar. Sem
     isso, anular deixava o jogador de volta e o histórico dele apagado,
     que é pior do que qualquer um dos dois estados. */
  /* SAÍDA DO CLUBE: com "Data de saída" (até hoje), o jogador fica só aqui,
     no Plantel — numa secção "Saíram do clube", fechada por defeito — com a
     ficha e o histórico. Em tudo o resto da app já não aparece (ver
     `playersAtivos` no App). */
  const [mostrarSaidos, setMostrarSaidos] = useState(false);
  /* FECHAR "SAÍRAM DO CLUBE" SEM MEXER NA PÁGINA. Ao fechar, a página
     ficava mais curta e o browser puxava o scroll para cima — os cartões
     de cima mexiam. Agora, ao fechar, fica por baixo um espaço vazio com a
     altura do que se fechou (medido antes de pintar, por isso nada salta);
     esse espaço sai sozinho quando deixa de estar à vista. */
  const gridPlantelRef = useRef(null);
  const reservaPlantelRef = useRef(null);
  const alturaAntesDeFecharRef = useRef(null);
  const [reservaPlantel, setReservaPlantel] = useState(0);
  const alternarSaidos = () => {
    if (mostrarSaidos && gridPlantelRef.current) alturaAntesDeFecharRef.current = gridPlantelRef.current.offsetHeight;
    else setReservaPlantel(0);
    setMostrarSaidos(v => !v);
  };
  React.useLayoutEffect(() => {
    const antes = alturaAntesDeFecharRef.current;
    alturaAntesDeFecharRef.current = null;
    if (antes == null || !gridPlantelRef.current) return;
    setReservaPlantel(Math.max(0, antes - gridPlantelRef.current.offsetHeight));
  }, [mostrarSaidos]);
  useEffect(() => {
    if (!reservaPlantel) return undefined;
    const verificar = () => {
      const el = reservaPlantelRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight) setReservaPlantel(0);
    };
    window.addEventListener('scroll', verificar, true);
    return () => window.removeEventListener('scroll', verificar, true);
  }, [reservaPlantel]);
  const hojePlantel = todayStr();
  const saiuDoClube = (p) => !!(p && p.exitDate && p.exitDate <= hojePlantel);
  const ativosPlantel = players.filter(p => !saiuDoClube(p));
  const saidosPlantel = players.filter(saiuDoClube);
  const SEP_SAIDOS = '__saidos__';
  const listaPlantel = [...sortByPosition(ativosPlantel), ...(saidosPlantel.length ? [SEP_SAIDOS] : []), ...(mostrarSaidos ? sortByPosition(saidosPlantel) : [])];
  const remove = (id) => {
    const jogador = players.find(x => x.id === id);
    if (!jogador) return;
    const c = contarRastoDoJogador({
      playerId: id, sessions, matches, convocatorias, monitoring, clinico, desenvolvimento,
    });
    const partes = [
      c.dias && `${c.dias} ${c.dias === 1 ? 'dia de presenças' : 'dias de presenças'}`,
      c.jogos && `${c.jogos} ${c.jogos === 1 ? 'jogo' : 'jogos'}`,
      c.convocatorias && `${c.convocatorias} ${c.convocatorias === 1 ? 'convocatória' : 'convocatórias'}`,
      c.wellness && `${c.wellness} de bem-estar`,
      c.clinico && `${c.clinico} do boletim clínico`,
      c.desenvolvimento && `${c.desenvolvimento} de desenvolvimento`,
    ].filter(Boolean);

    askConfirm({
      label: itemLabel(jogador, 'Jogador'),
      note: partes.length
        ? `Apaga também o histórico dele: ${partes.join(', ')}. Se o jogador SAIU DO CLUBE, não apagues: edita-o e preenche a "Data de saída" — o histórico fica. Podes anular durante alguns segundos.`
        : undefined,
      onConfirm: () => {
        setPlayers(prev => prev.filter(x => x.id !== id));
        let anulado = false;
        offerUndo(`${itemLabel(jogador, 'Jogador')} apagado.`, () => {
          anulado = true;
          setPlayers(prev => (prev.some(x => x.id === id) ? prev : [...prev, jogador]));
        });
        /* Espera-se a barra INTEIRA mais três segundos de folga. Ler a
           duração da constante em vez de repetir o número evita o caso
           silencioso: alguém aumenta a barra para 20s, isto continua em
           12, e quem anula ao segundo 15 fica com o jogador de volta e o
           histórico apagado. */
        setTimeout(() => {
          if (anulado) return;
          limparRastoDoJogador({
            playerId: id,
            sessions, setSessions, matches, setMatches,
            convocatorias, setConvocatorias, monitoring, setMonitoring,
            clinico, setClinico, desenvolvimento, setDesenvolvimento,
            autorizar: autorizarApagarRasto,
          });
          // Os MP4 de "Os meus vídeos" dele (Storage), por RGPD.
          apagarMp4DoAtleta(T.equipaId, id);
        }, (UNDO_SECONDS + 3) * 1000);
      },
    });
  };

  /* Lesão aberta a partir da página do jogador: a mesma ficha do Boletim
     Clínico, por cima do perfil. Guardar grava UMA ocorrência e propõe
     acertar os L, como no Boletim. */
  const [lesaoPerfil, setLesaoPerfil] = useState(null); // null | { tipo: 'ficha' | 'dados', id }
  const lesaoEmFicha = lesaoPerfil && lesaoPerfil.tipo === 'ficha' ? (clinico || []).find(o => o.id === lesaoPerfil.id) : null;
  const lesaoEmDados = lesaoPerfil && lesaoPerfil.tipo === 'dados' ? (clinico || []).find(o => o.id === lesaoPerfil.id) : null;
  const mudarLesaoPara = (proximo) => trocarJanela(() => {}, () => setLesaoPerfil(proximo));
  const gravarLesao = (registo) => {
    setClinico(prev => (prev || []).map(o => (o.id === registo.id ? registo : o)));
    proporMarcacaoClinica({
      ocorrencia: registo, sessions, matches, setSessions, setMatches,
      jogador: players.find(p => p.id === registo.playerId),
    });
  };

  /* REGISTOS ÓRFÃOS: wellness/PSE, boletim clínico e desenvolvimento de
     jogadores que já não estão no plantel. Ficam assim quando a limpeza ao
     apagar um jogador foi travada (o travão de segurança das gravações em
     massa, antes de existir a autorização para este caso). Mostra-se um
     aviso com um botão para os apagar de vez. */
  const idsPlantel = new Set((players || []).map(p => p.id));
  const orfaos = (players || []).length ? {
    monitoring: (monitoring || []).filter(m => m.playerId && !idsPlantel.has(m.playerId)).length,
    clinico: (clinico || []).filter(m => m.playerId && !idsPlantel.has(m.playerId)).length,
    desenvolvimento: (desenvolvimento || []).filter(m => m.playerId && !idsPlantel.has(m.playerId)).length,
  } : { monitoring: 0, clinico: 0, desenvolvimento: 0 };
  const totalOrfaos = orfaos.monitoring + orfaos.clinico + orfaos.desenvolvimento;
  const limparOrfaos = () => {
    if (!window.confirm(`Apagar ${totalOrfaos} registos de jogadores que já foram apagados do plantel? Isto não se pode desfazer.`)) return;
    const az = autorizarApagarRasto || {};
    const tira = (setter, chave) => {
      if (!setter) return;
      setter(prev => {
        const resto = prev.filter(x => !x.playerId || idsPlantel.has(x.playerId));
        if (prev.length - resto.length >= 3 && typeof az[chave] === 'function') az[chave]();
        return resto.length === prev.length ? prev : resto;
      });
    };
    tira(setMonitoring, 'monitoring');
    tira(setClinico, 'clinico');
    tira(setDesenvolvimento, 'desenvolvimento');
  };

  return (
    <div>
      {!statsFor && (
        <RecuperarApagados players={players} setPlayers={setPlayers} matches={matches} setMatches={setMatches}
          sessions={sessions} setSessions={setSessions} convocatorias={convocatorias} setConvocatorias={setConvocatorias} teamId={teamId} />
      )}
      {totalOrfaos > 0 && !statsFor && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.warn}`, background: T.surface }}>
          <span style={{ fontSize: 13, color: T.cream, flex: 1, minWidth: 220 }}>
            Há {totalOrfaos} registos (wellness, PSE, clínico ou desenvolvimento) de jogadores que já foram apagados do plantel.
          </span>
          <Btn variant="ghost" onClick={limparOrfaos}><Trash2 size={14} /> Apagar esses registos</Btn>
        </div>
      )}
      {/* Um jogador selecionado ocupa a página toda — troca-se a grelha do
          plantel pelo perfil dele, com "Voltar" a repor a grelha; não é uma
          janela por cima como as outras fichas, é a própria página a
          mudar de conteúdo. */}
      {statsFor ? (
        <PlayerProfilePage
          player={statsFor} sessions={sessions} matches={matches} clinico={clinico}
          monitoring={monitoring} desenvolvimento={desenvolvimento} diario={diario} convocatorias={convocatorias}
          onAbrirLesao={(id) => setLesaoPerfil({ tipo: 'ficha', id })}
          onBack={fecharPerfil}
          onShare={() => doShare(statsFor)}
          onPrint={() => { const p = statsFor; doPrint(p); }}
          onEdit={() => { const p = statsFor; setModalVoltarPerfil(true); trocarJanela(() => setStatsFor(null), () => setModal(p)); }}
        />
      ) : null}
      {statsFor && lesaoEmFicha && (
        <FichaOcorrencia
          key={lesaoEmFicha.id}
          ocorrencia={lesaoEmFicha}
          jogador={players.find(p => p.id === lesaoEmFicha.playerId)}
          onClose={() => setLesaoPerfil(null)}
          onGuardar={gravarLesao}
          onEditarDados={() => mudarLesaoPara({ tipo: 'dados', id: lesaoEmFicha.id })}
        />
      )}
      {statsFor && lesaoEmDados && (
        <OcorrenciaModal
          ocorrencia={lesaoEmDados}
          players={players}
          onClose={() => mudarLesaoPara({ tipo: 'ficha', id: lesaoEmDados.id })}
          onSave={(registo) => { gravarLesao(registo); mudarLesaoPara({ tipo: 'ficha', id: registo.id }); }}
        />
      )}
      {statsFor ? null : (
        <>
      <SectionHeader title="Plantel" subtitle={`${ativosPlantel.length} jogador${ativosPlantel.length === 1 ? '' : 'es'} inscrito${ativosPlantel.length === 1 ? '' : 's'}${saidosPlantel.length ? ` · ${saidosPlantel.length} saíram do clube` : ''}`}
        action={<Btn onClick={() => { setModalVoltarPerfil(false); setModal('new'); }}><Plus size={15} /> Adicionar jogador</Btn>} />

      {players.length === 0 ? (
        <EmptyState text="O plantel está vazio." action={<Btn onClick={() => { setModalVoltarPerfil(false); setModal('new'); }}><Plus size={15} /> Adicionar o primeiro jogador</Btn>} />
      ) : (
        <>
        <div ref={gridPlantelRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {listaPlantel.map(p => {
            if (p === SEP_SAIDOS) {
              return (
                <button key={SEP_SAIDOS} type="button" onClick={alternarSaidos}
                  style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 2px', background: 'none', border: 'none', borderTop: `1px solid ${T.line}`, color: T.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'left' }}>
                  {mostrarSaidos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Saíram do clube ({saidosPlantel.length})
                  <span style={{ textTransform: 'none', letterSpacing: 0, color: T.mutedDim, fontSize: 11.5 }}>— só a ficha e o histórico; não aparecem em mais nada da app</span>
                </button>
              );
            }
            const stats = playerStats(p, sessions, jogosOficiaisDe(matches));
            const attColor = stats.attendancePct === null ? T.mutedDim : stats.attendancePct >= 80 ? T.good : stats.attendancePct >= 60 ? T.warn : T.bad;
            const m = meta && meta[p.id];
            return (
              <div key={p.id} onClick={() => setStatsFor(p)} style={{
                background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {/* Cartão em três andares: nome, subtítulo (ano · idade) e
                    ações. Com os ícones ao lado do nome, o nome ficava
                    cortado com reticências em quase todos os jogadores. */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <Badge label={p.position} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div title={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.cream, fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortFullName(p.name)}</span>
                      <CaptainArmband rank={p.captainRank} />
                    </div>
                    <div style={{ color: T.mutedDim, fontSize: 12, marginTop: 2 }}>{playerBirthLine(p)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 9 }}>
                      <button onClick={(e) => { e.stopPropagation(); doShare(p); }} title="Partilhar ficha do jogador" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Share2 size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); doPrint(p); }} title="Imprimir ficha do jogador" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Printer size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setModalVoltarPerfil(false); setModal(p); }} title="Editar jogador" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Pencil size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); remove(p.id); }} title="Remover jogador" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  {/* FOTOGRAFIA — o canto que sobrava vazio à direita do
                      cartão. Iniciais como recurso para quem ainda não
                      tem foto carregada, para o espaço não ficar em
                      branco nem o cartão saltar de tamanho consoante o
                      jogador tem ou não fotografia. */}
                  {p.photo ? (
                    <img src={p.photo} alt="Fotografia" style={{
                      width: 52, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 7,
                      border: `1px solid ${T.line}`, background: '#000', flexShrink: 0,
                    }} />
                  ) : (
                    <div style={{
                      width: 52, aspectRatio: '3 / 4', borderRadius: 7, background: T.surfaceRaise, border: `1px solid ${T.line}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      fontSize: 14, fontWeight: 600, color: T.mutedDim, ...display,
                    }}>
                      {(p.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11.5, ...mono, borderTop: `1px solid ${T.line}`, paddingTop: 9 }}>
                  <span style={{ color: attColor }}>Assid. {stats.attendancePct === null ? '—' : `${stats.attendancePct}%`}</span>
                  <span style={{ color: T.mutedDim }}>⚽ {stats.goals}</span>
                  <span style={{ color: T.mutedDim }}>🅰 {stats.assists}</span>
                  <span style={{ color: T.mutedDim }}>Nota {stats.avgMatchRating ?? '—'}</span>
                </div>
                {m && m.email && (
                  <div style={{ fontSize: 10.5, color: T.mutedDim, borderTop: `1px solid ${T.line}`, paddingTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Editado por {m.email} · {timeAgo(m.at)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {reservaPlantel > 0 && <div ref={reservaPlantelRef} aria-hidden="true" style={{ height: reservaPlantel }} />}
        </>
      )}

      {modal && (
        <PlayerModal
          player={modal === 'new' ? null : modal}
          onClose={() => (modalVoltarPerfil ? trocarJanela(() => setModal(null), () => setStatsFor(modal)) : setModal(null))}
          onSave={save}
        />
      )}
        </>
      )}

      {printPlayer && createPortal(
        <PlayerPrintSheet player={printPlayer} stats={playerStats(printPlayer, sessions, jogosOficiaisDe(matches))} />,
        document.body
      )}
    </div>
  );
}

