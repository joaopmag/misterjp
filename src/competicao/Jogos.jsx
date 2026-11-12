// competicao/Jogos.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useRef, useState, useEffect } from 'react';
import { todayStr, addDays, uid, fmtDate } from '../base/utilidades';
import { competitionLabel, isFriendlyMatch } from '../dominio/jogos';
import { trocarJanela, removeWithUndo, itemLabel, Btn, SectionHeader, EmptyState } from '../base/ui';
import { Plus, Trophy, ClipboardList, Pencil, Share2, Printer, Trash2 } from 'lucide-react';
import { body, TEXT_ON_ACCENT, T } from '../base/tema';
import { convidadosDe } from '../dominio/jogadores';
import { createPortal } from 'react-dom';
import { jogoNaoJogado, jogosSemEstatisticas } from '../dominio/estadoJogos';
import { AlertaRelatorios, PREF_MISSAO_RELATORIOS, RelatoriosJogo, comResultado, estadoRelatorio, haMissaoDeRelatorios, notasDoJogo, pedirNovaMissao, relatoriosEmFalta } from './RelatoriosJogo';
import { FichaJogo, PrintFichaJogo, buildMatchShareHtml } from './FichaJogo';
import { shareOrDownloadHtml } from '../base/partilha';
import { ensureMatchSession, normalizeStandings, podarPresencasForaDosConvocados, syncMatchConvocatoria, syncMatchIntoCompetition } from './dados';
import { SubTabs } from '../base/ui-extra';
import { Convocatorias } from './Convocatorias';
import { LeagueStandings } from './Classificacao';
import { MatchDashboard } from './MatchDashboard';
import { comQuemLaEsteve, escalacaoDoJogo, escalacaoNovaFormacao } from './Escalacao';
import { integrarConvidado } from '../dominio/convidados';
import { MatchModal } from './MatchModal';

export function Jogos({ matches, setMatches, players, setPlayers, standings, setStandings, standingsMeta, season, setSeason, sessions, setSessions, convocatorias, setConvocatorias, autorizarLimparConvocatorias, clinico, abaInicial, tarefas, souDono, userEmail, voltarOrigem }) {
  // A janela do jogo foi aberta por uma missão: ao fechar, volta-se de onde se veio.
  const modalDaMissao = useRef(false);
  const fecharModal = () => {
    setModal(null);
    if (modalDaMissao.current && voltarOrigem) { modalDaMissao.current = false; voltarOrigem(); return true; }
    modalDaMissao.current = false;
    return false;
  };
  /* Convocatórias deixaram de ter separador próprio e vivem aqui: nascem
     com o jogo (`syncMatchConvocatoria` mantém-lhes adversário, data e
     jornada sincronizados), por isso eram já a outra vista da mesma
     coisa. */
  const [aba, setAba] = useState(abaInicial === 'convocatorias' ? 'convocatorias' : (abaInicial === 'estatisticas' || abaInicial === 'analisejogo') ? 'relatorios' : 'jogos');
  const [modal, setModal] = useState(null);
  const [abrirRelatorio, setAbrirRelatorio] = useState(null);
  /* Chegou pela missão "Introduzir as estatísticas": abre logo o editor do
     jogo mais recente que ainda não tem estatísticas (ou, se já estão
     todas, o último jogo realizado). */
  // Antes de pintar (useLayoutEffect): abre logo o sítio certo, sem mostrar a lista primeiro.
  React.useLayoutEffect(() => {
    if (abaInicial !== 'estatisticas') return;
    const hoje = todayStr();
    const alvo = jogosSemEstatisticas(matches, addDays(hoje, 1))[0]
      || [...(matches || [])].filter(m => m.date && m.date <= hoje).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    setAba('relatorios');
    if (alvo) setAbrirRelatorio(alvo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaInicial]);
  /* Chegou pela missão "Escrever a análise do jogo": abre Relatórios de
     jogo com a caixa da análise aberta no jogo mais recente ainda sem
     nenhuma análise (ou, se já têm todos, no último jogo realizado). */
  const [abrirAnalise, setAbrirAnalise] = useState(null);
  // Antes de pintar (useLayoutEffect): abre logo o sítio certo, sem mostrar a lista primeiro.
  React.useLayoutEffect(() => {
    if (abaInicial !== 'analisejogo') return;
    const hoje = todayStr();
    const jogados = [...(matches || [])].filter(m => m && m.date && m.date <= hoje)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const alvo = jogados.find(m => !notasDoJogo(m).length) || jogados[0];
    setAba('relatorios');
    if (alvo) setAbrirAnalise(alvo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaInicial]);
  const [modalVoltarFicha, setModalVoltarFicha] = useState(false); // true só quando o editor abriu a partir da ficha
  /* Chegou pela missão "Escrever as ideias para o jogo": abre o editor do
     próximo jogo que ainda não tem ideias (é lá que está o campo). */
  // Antes de pintar (useLayoutEffect): abre logo o sítio certo, sem mostrar a lista primeiro.
  React.useLayoutEffect(() => {
    if (abaInicial !== 'ideiasjogo') return;
    const hoje = todayStr();
    const proximos = [...(matches || [])].filter(m => m && m.date && m.date >= hoje && !jogoNaoJogado(m))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const alvo = proximos.find(m => !String(m.ideias || '').trim()) || proximos[0];
    setAba('jogos');
    if (alvo) { setModalVoltarFicha(false); setModal(alvo); modalDaMissao.current = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaInicial]);
  const [ficha, setFicha] = useState(null);
  /* O jogo a imprimir. A folha vive fora da app (montada no body) e só
     existe enquanto a impressão acontece — o mesmo padrão do Planeamento.
     O `setTimeout` dá ao React o tempo de a desenhar antes de chamar o
     diálogo de impressão; sem ele imprime-se a folha vazia. */
  const [printMatch, setPrintMatch] = useState(null);

  const doPrintMatch = (m) => {
    setPrintMatch(m);
    setTimeout(() => window.print(), 80);
  };
  /* Ver a nota em MatchDashboard: sem isto a ficha ficava montada no body
     e colava-se à impressão seguinte (por exemplo, à das estatísticas). */
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

  const save = (data) => {
    const isEdicao = !!data.id;
    const registo = podarPresencasForaDosConvocados(isEdicao ? data : { ...data, id: uid() });
    // As notas da equipa técnica só se escrevem no seu separador (Relatórios
    // de jogo): fica sempre a versão mais recente delas, nunca a do modal.
    if (isEdicao) setMatches(prev => prev.map(m => (m.id === data.id ? { ...registo, notasEquipaTecnica: m.notasEquipaTecnica } : m)));
    else setMatches(prev => [...prev, registo]);
    // Todo o jogo entra também na agenda como sessão, amigável ou oficial
    // (ver ensureMatchSession) — é o que faz o PSE aparecer sozinho no
    // check-in no dia do jogo, sem o treinador ter de criar a sessão à
    // mão em Planeamento. A Lista do Planeamento esconde o cartão
    // repetido — a sessão continua a existir para a carga de treino e as
    // presenças.
    if (setSessions) setSessions(prev => ensureMatchSession(registo, prev));
    // Jogo oficial com convocados: gera/atualiza a convocatória.
    if (setConvocatorias) setConvocatorias(prev => syncMatchConvocatoria(registo, prev, season));
    /* O encontro entra na jornada da competição, se ela existir, E o jogo
       fica a saber qual é — sem essa ligação, a tabela criaria um segundo
       jogo para o mesmo encontro (ver syncMatchIntoCompetition). */
    if (setStandings) {
      const antes = normalizeStandings(standings);
      const depois = syncMatchIntoCompetition(registo, antes, season, matches);
      if (JSON.stringify(depois.competitions) !== JSON.stringify(antes.competitions)) {
        setStandings(depois);
        const jornada = (registo.jornada || '').trim();
        const nomeComp = competitionLabel(registo.competition);
        const comp = depois.competitions.find(c => (c.name || '').trim().toLowerCase() === nomeComp.toLowerCase());
        const ronda = comp && (comp.rounds || []).find((r, i) => (r.label || `Jornada ${i + 1}`) === jornada);
        const encontro = ronda && (ronda.games || []).find(g => g.id === registo.id);
        if (encontro) {
          setMatches(prev => prev.map(m => (m.id === registo.id ? { ...m, sourceGameId: encontro.id } : m)));
        }
      }
    }
    if (isEdicao && modalVoltarFicha) trocarJanela(() => setModal(null), () => setFicha(registo));
    else fecharModal();
  };
  const remove = (id) => removeWithUndo(matches, setMatches, id, itemLabel(matches.find(x => x.id === id), 'Jogo'));

  const sorted = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));

  /* Separadores por competição.

     Com uma época inteira, a lista corrida obriga a percorrer amigáveis e
     taças para chegar ao campeonato. Os separadores saem das competições
     que os jogos REALMENTE têm — não de uma lista fixa — para não haver
     separadores vazios nem jogos sem sítio.

     Dentro de cada um, do mais recente para o mais antigo: é o último jogo
     que se vai ver, não o primeiro. */
  const [compAberta, setCompAberta] = useState('Todas');
  const competicoesComJogos = Array.from(new Set(
    matches.map(m => competitionLabel(m.competition)).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'pt'));
  const separadores = ['Todas', ...competicoesComJogos];
  const visiveis = compAberta === 'Todas'
    ? sorted
    : sorted.filter(m => competitionLabel(m.competition) === compAberta);

  // Relatórios já inseridos: jogos com dados no relatório (completos ou a meio).
  const relatoriosInseridos = (matches || []).filter(m => m && estadoRelatorio(comResultado(m, standings)).id !== 'vazio').length;

  /* O MESMO CABEÇALHO nos três separadores (título, "Novo jogo" e os
     separadores). Antes, "Novo jogo" só existia em Jogos e os separadores
     subiam e desciam ao trocar. Em Convocatórias e Relatórios, "Novo jogo"
     leva a Jogos e abre o editor. */
  const cabecalhoJogos = (
    <>
      <SectionHeader title="Jogos" subtitle="A competição, classificação e os dados de cada jogo."
        action={<Btn onClick={() => { setAba('jogos'); setModalVoltarFicha(false); setModal('new'); }} disabled={players.length === 0}><Plus size={15} /> Novo jogo</Btn>} />
      <SubTabs
        value={aba}
        onChange={setAba}
          tabs={[
            { id: 'jogos', label: 'Jogos', icon: Trophy, count: (matches || []).length },
            { id: 'convocatorias', label: 'Convocatórias', icon: ClipboardList, count: (convocatorias || []).length },
            // O número é o dos relatórios já inseridos (com dados), como em Jogos e Convocatórias.
            { id: 'relatorios', label: 'Relatórios de jogo', curto: 'Relatórios', icon: Pencil, count: relatoriosInseridos },
          ]}
      />
    </>
  );

  if (aba === 'relatorios') {
    return (
      <div>
        {cabecalhoJogos}
        {souDono && !haMissaoDeRelatorios(tarefas) && (
          <AlertaRelatorios emFalta={relatoriosEmFalta(matches, standings)} onCriar={(rep) => pedirNovaMissao(PREF_MISSAO_RELATORIOS(rep))} />
        )}
        <RelatoriosJogo
          matches={matches} players={players} season={season} standings={standings}
          onSave={save} abrirId={abrirRelatorio} onAberto={() => setAbrirRelatorio(null)}
          userEmail={userEmail} setMatches={setMatches}
          abrirAnaliseId={abrirAnalise} onAnaliseAberta={() => setAbrirAnalise(null)}
        />
      </div>
    );
  }

  if (aba === 'convocatorias') {
    return (
      <div>
        <Convocatorias
          convocatorias={convocatorias} setConvocatorias={setConvocatorias}
          autorizarLimparConvocatorias={autorizarLimparConvocatorias}
          players={players} season={season} standings={standings}
          matches={matches} setMatches={setMatches} clinico={clinico}
          subTabs={cabecalhoJogos}
        />
      </div>
    );
  }

  return (
    <div>
      {cabecalhoJogos}

      <div style={{ marginBottom: 20 }}>
        <LeagueStandings standings={standings} setStandings={setStandings} standingsMeta={standingsMeta} matches={matches} setMatches={setMatches} season={season} convocatorias={convocatorias} setConvocatorias={setConvocatorias} sessions={sessions} setSessions={setSessions} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <MatchDashboard players={players} matches={matches} />
      </div>
      {players.length === 0 ? (
        <EmptyState text="Adiciona jogadores no Plantel antes de registares um jogo." />
      ) : sorted.length === 0 ? (
        <EmptyState text="Ainda sem jogos registados." action={<Btn onClick={() => { setModalVoltarFicha(false); setModal('new'); }}><Plus size={15} /> Registar o primeiro jogo</Btn>} />
      ) : (
        <>
          {separadores.length > 2 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {separadores.map(c => {
                const n = c === 'Todas' ? sorted.length : sorted.filter(m => competitionLabel(m.competition) === c).length;
                const on = compAberta === c;
                return (
                  <button key={c} onClick={() => setCompAberta(c)} style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
                    background: on ? '#B5393F' : 'transparent',
                    color: on ? TEXT_ON_ACCENT : T.muted,
                    border: `1px solid ${on ? '#B5393F' : T.line}`,
                  }}>{c} ({n})</button>
                );
              })}
            </div>
          )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visiveis.map(m => {
            const reports = m.convocados ? m.convocados.map(pid => (m.report && m.report[pid]) || {}) : [];
            const goals = reports.reduce((a, r) => a + (Number(r.goals) || 0), 0);
            return (
              /* O cartão inteiro abre a ficha do jogo. O lápis continua a
                 abrir a edição: ver e editar são coisas diferentes, e a
                 mais usada — ver — merece o alvo maior. */
              <div key={m.id} onClick={() => setFicha(m)} style={{
                background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: T.cream, fontSize: 15, fontWeight: 500 }}>
                      vs {m.opponent || 'Adversário por definir'}
                      {m.atHome !== undefined && (
                        <span style={{ fontSize: 11, color: T.mutedDim, marginLeft: 8 }}>{m.atHome ? '(casa)' : '(fora)'}</span>
                      )}
                    </div>
                    <div style={{ color: T.mutedDim, fontSize: 12 }}>
                      {fmtDate(m.date)}{m.competition ? ` · ${competitionLabel(m.competition)}` : ''}{m.result ? ` · ${m.result}` : ''} · {(m.convocados || []).length + convidadosDe(m).length} {isFriendlyMatch(m) ? 'presentes' : 'convocados'}
                    </div>
                  </div>
                  {/* `stopPropagation`: sem isto, carregar no lápis abria
                      a edição E a ficha por baixo.

                      `marginLeft: 'auto'` + `flexShrink: 0`: no telemóvel o
                      nome do adversário e a linha de baixo empurram os
                      ícones para uma segunda linha; sem isto caíam
                      encostados à esquerda, ao contrário de todos os
                      outros cartões da app. */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); doShareMatch(m); }} title="Partilhar ficha do jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Share2 size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); doPrintMatch(m); }} title="Imprimir ficha do jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Printer size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); setModalVoltarFicha(false); setModal(m); }} title="Editar jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Pencil size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); remove(m.id); }} title="Apagar jogo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* A ficha lê sempre a versão mais recente do jogo: se for editado
          por baixo, o que se vê aqui acompanha. */}
      {ficha && (() => {
        const atual = matches.find(m => m.id === ficha.id);
        if (!atual) return null;
        /* Mexer no onze NA FICHA DO JOGO grava logo no jogo E na
           convocatória (o mesmo onze nos dois sítios), tal como gravar na
           janela "Editar jogo". Antes só mudava o jogo: a convocatória
           ficava com o onze antigo. */
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
            onEdit={() => { setModalVoltarFicha(true); trocarJanela(() => setFicha(null), () => setModal(atual)); }}
            onShare={() => doShareMatch(atual)}
            onPrint={() => doPrintMatch(atual)}
              /* Mudar de formação limpa o alinhamento manual: os lugares
               passam a ser outros e as posições antigas deixam de fazer
               sentido. A equipa é recolocada pela sugestão automática. */
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

      {modal && (
        <MatchModal matches={matches}
          match={modal === 'new' ? null : modal}
          players={players}
          standings={standings}
          season={season}
          clinico={clinico}
          onIntegrarConvidado={setPlayers ? (c) => integrarConvidado({ convidado: c, players, setPlayers }) : null}
          onClose={() => (modalVoltarFicha ? trocarJanela(() => setModal(null), () => setFicha(modal)) : fecharModal())}
          onSave={save}
        />
      )}

      {printMatch && createPortal(
        <PrintFichaJogo match={printMatch} players={players} season={season} />,
        document.body,
      )}
    </div>
  );
}

