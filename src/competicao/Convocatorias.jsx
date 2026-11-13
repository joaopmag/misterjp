// competicao/Convocatorias.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useEffect } from 'react';
import { uid, fmtDate } from '../base/utilidades';
import { removeWithUndo, itemLabel, askConfirm, Btn, EmptyState, Modal, FIELD_GRID, Field, Input, Select, FIELD_FULL } from '../base/ui';
import { convidadosDe, sortByPosition } from '../dominio/jogadores';
import { T, body, mono } from '../base/tema';
import { Trash2, Eye, EyeOff, Printer, ClipboardList, Pencil, Check } from 'lucide-react';
import { competitionLabel, isFriendlyMatch, FRIENDLY } from '../dominio/jogos';
import { createPortal } from 'react-dom';
import { tamanhoDaFormacao } from '../tatico/Simulador';
import { estadoClinicoParaJogo } from '../dominio/clinico';
import { clubeSemEscalao, competitionByName, competitionGameDate, competitionOptions, competitionRoundLabels, competitionTeamNames, syncConvocatoriaMatch, titularesPorLugar } from './dados';
import { CartaoPlanoDoJogo, EscalacaoNoCampo, EscalacaoPrint, TODOS_OS_JOGADORES, castigadosParaJogo, comQuemLaEsteve, escalacaoDaConvocatoria, escalacaoDoJogo, escalacaoNovaFormacao } from './Escalacao';
import { CaptainArmband, ordenarPorCamisola, sincronizarVisivelNoJogo } from '../dominio/plantel';
import { SelectAllBar, nomesDosConvidados } from '../dominio/convidados';

export function Convocatorias({ convocatorias, setConvocatorias, autorizarLimparConvocatorias, players, season, standings, matches, setMatches, clinico, subTabs }) {
  const [modal, setModal] = useState(null);
  const [printConvocatoria, setPrintConvocatoria] = useState(null);

  const save = (data) => {
    const registo = data.id ? data : { ...data, id: uid() };
    if (data.id) setConvocatorias(prev => prev.map(c => c.id === data.id ? registo : c));
    else setConvocatorias(prev => [...prev, registo]);
    // Cria/atualiza o jogo correspondente, para a convocatória alimentar o
    // Planeamento, os Jogos e a tabela de presenças.
    // Com TODOS os jogadores (também quem saiu): o onze do jogo sai das
    // posições deles; só com os ativos, quem saiu caía do onze ao gravar.
    if (setMatches) setMatches(syncConvocatoriaMatch(registo, matches, (TODOS_OS_JOGADORES.lista && TODOS_OS_JOGADORES.lista.length) ? TODOS_OS_JOGADORES.lista : players));
    setModal(null);
  };
  const remove = (id) => removeWithUndo(convocatorias, setConvocatorias, id, itemLabel(convocatorias.find(x => x.id === id), 'Convocatória'));
  /* DUAS FOLHAS DIFERENTES, DO MESMO REGISTO.

     A convocatória (`lista`) é o que se afixa e se envia aos atletas: os
     nomes, sem revelar o onze. A ficha técnica (`ficha`) é a que fica com
     o treinador e com a equipa de arbitragem: onze inicial, suplentes e
     quem leva a braçadeira.

     Distinguir uma da outra evita o erro clássico de afixar a folha errada
     no balneário e o onze ser conhecido antes do tempo. */
  const doPrint = (c, tipo = 'lista') => {
    setPrintConvocatoria({ ...c, __tipo: tipo });
    setTimeout(() => window.print(), 80);
  };
  /* A folha tem de sair do body depois de imprimir — mesmo padrão usado
     nas outras folhas. */
  useEffect(() => {
    if (!printConvocatoria) return undefined;
    const limpar = () => setPrintConvocatoria(null);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [printConvocatoria]);

  const list = [...convocatorias].sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));

  /* CONVOCATÓRIAS REPETIDAS — o mesmo jogo com duas fichas.

     Aconteceu uma vez e a causa está corrigida na sincronização (ver a
     guarda da remoção de fantasmas em `apanharAtraso`): registos criados
     em bloco chegaram a desaparecer do ecrã enquanto ainda estavam a ser
     gravados, e a gravação seguinte, a olhar para uma lista já sem eles,
     criou-os outra vez com ids novos. Ao recarregar a página, voltaram os
     dois conjuntos.

     Corrigir a causa não desfaz o que já ficou feito, e apagar quinze
     linhas à mão numa tabela é o tipo de trabalho que se faz mal. Daí
     esta limpeza.

     A REGRA É CONSERVADORA. Duas convocatórias são a mesma quando têm a
     mesma DATA, o mesmo ADVERSÁRIO e a mesma JORNADA. De cada grupo fica
     a que tem mais gente convocada — e só se apagam as que estão
     VAZIAS. Uma cópia onde alguém já escolheu jogadores não é lixo, é
     trabalho: fica, e a linha por baixo do botão diz que ficou. */
  const grupoDeConvocatoria = (c) => [
    (c.data || '').trim(),
    (c.adversario || '').trim().toLowerCase(),
    (c.jornada || '').trim().toLowerCase(),
  ].join('|');
  const pessoasEm = (c) => (c.convocados || []).length + convidadosDe(c).length;
  const repetidas = (() => {
    const porGrupo = new Map();
    convocatorias.forEach(c => {
      if (!(c.data || '').trim()) return; // sem data não há grupo fiável
      const k = grupoDeConvocatoria(c);
      if (!porGrupo.has(k)) porGrupo.set(k, []);
      porGrupo.get(k).push(c);
    });
    const aApagar = [];
    let porDecidir = 0;
    porGrupo.forEach(grupo => {
      if (grupo.length < 2) return;
      const ordenado = [...grupo].sort((a, b) => pessoasEm(b) - pessoasEm(a));
      ordenado.slice(1).forEach(c => {
        if (pessoasEm(c) === 0) aApagar.push(c.id);
        else porDecidir += 1;
      });
    });
    return { aApagar, porDecidir };
  })();

  const limparRepetidas = () => {
    if (!repetidas.aApagar.length) return;
    askConfirm({
      label: `${repetidas.aApagar.length} ${repetidas.aApagar.length === 1 ? 'convocatória repetida' : 'convocatórias repetidas'}, todas sem ninguém convocado`,
      note: 'De cada jogo fica uma. Os jogos, as presenças e os relatórios não são tocados.',
      onConfirm: () => {
        // Apagar em bloco é exatamente o que o travão de segurança da
        // sincronização trava por omissão. Aqui a remoção É intencional,
        // por isso abre-se a porta para esta gravação e só para esta.
        if (autorizarLimparConvocatorias) autorizarLimparConvocatorias();
        const fora = new Set(repetidas.aApagar);
        setConvocatorias(prev => prev.filter(c => !fora.has(c.id)));
      },
    });
  };

  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` };
  const td = { padding: '10px 12px', fontSize: 13, color: T.mutedDim };

  return (
    <div>
      {/* O cabeçalho (título, Novo jogo, separadores) vem de Jogos. */}
      {subTabs}

      {/* Só aparece quando há mesmo o que limpar — não é uma ferramenta
          de manutenção permanente, é a resposta a um estranho. */}
      {(repetidas.aApagar.length > 0 || repetidas.porDecidir > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: T.surface, border: `1px solid ${T.warn}55`, borderRadius: 8,
          padding: '10px 14px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 12.5, color: T.cream, ...body, flex: 1, minWidth: 220, lineHeight: 1.5 }}>
            {repetidas.aApagar.length > 0 && (
              <>Há {repetidas.aApagar.length} {repetidas.aApagar.length === 1 ? 'convocatória repetida' : 'convocatórias repetidas'} para jogos que já têm outra.{' '}</>
            )}
            {repetidas.porDecidir > 0 && (
              <span style={{ color: T.mutedDim }}>
                {repetidas.porDecidir} {repetidas.porDecidir === 1 ? 'repetida tem' : 'repetidas têm'} jogadores convocados e {repetidas.porDecidir === 1 ? 'fica' : 'ficam'} como {repetidas.porDecidir === 1 ? 'está' : 'estão'} — apaga à mão a que não quiseres.
              </span>
            )}
          </div>
          {repetidas.aApagar.length > 0 && (
            <Btn variant="ghost" onClick={limparRepetidas}>
              <Trash2 size={13} /> Limpar {repetidas.aApagar.length}
            </Btn>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, marginBottom: 18, borderBottom: `1px solid ${T.line}` }}>
        <span style={{
          padding: '10px 0', fontSize: 14, fontWeight: 600, color: T.cream, ...body,
          borderBottom: `2px solid ${T.crimsonBright}`,
        }}>Seleção</span>
      </div>

      {players.length === 0 ? (
        <EmptyState text="Adiciona jogadores ao plantel antes de criar uma convocatória." />
      ) : list.length === 0 ? (
        <EmptyState text="Sem convocatórias. Nascem com cada jogo oficial; para um amigável, marca &quot;Gerar convocatória&quot; ao registar o jogo em Jogos." />
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${T.line}`, borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: T.surface }}>
                {['Data', 'Adversário', 'Competição', 'Jornada', 'Local', 'Convocados', ''].map(h => <th key={h} style={{ ...th, whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ ...td, color: T.cream, whiteSpace: 'nowrap' }}>{c.data ? fmtDate(c.data) : '—'}</td>
                  <td style={{ ...td, color: T.cream, whiteSpace: 'nowrap' }}>{c.adversario || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{competitionLabel(c.competicao) || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.jornada || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.localJogo || '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{(c.convocados || []).length + convidadosDe(c).length}</td>
                  {/* Célula estreita e sem quebra: sem isto, no telemóvel os
                      três ícones empilhavam-se um debaixo do outro. */}
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          const querido = !c.visivelAtletas;
                          setConvocatorias(prev => prev.map(x => (x.id === c.id ? { ...x, visivelAtletas: querido } : x)));
                          sincronizarVisivelNoJogo(c.data, c.adversario, querido, matches, setMatches);
                        }}
                        title={c.visivelAtletas ? 'Visível no Portal do Atleta — clicar para esconder' : 'Tornar visível no Portal do Atleta'}
                        style={{ background: 'none', border: 'none', color: c.visivelAtletas ? T.gold : T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}
                      >{c.visivelAtletas ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                      <button onClick={() => doPrint(c, 'lista')} title="Imprimir a convocatória (só os nomes, para afixar)" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Printer size={14} /></button>
                      <button onClick={() => doPrint(c, 'ficha')} title="Imprimir a ficha técnica (onze, suplentes e capitães)" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><ClipboardList size={14} /></button>
                      <button onClick={() => setModal(c)} title="Editar convocatória" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Pencil size={14} /></button>
                      <button onClick={() => remove(c.id)} title="Apagar convocatória" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ConvocatoriaModal
          convocatoria={modal === 'new' ? null : modal}
          players={players}
          season={season}
          standings={standings}
          clinico={clinico}
          matches={matches}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {printConvocatoria && createPortal(
        <div className="print-sheet">
          <h2 style={{ margin: '0 0 4px', fontSize: 24 }}>
            {printConvocatoria.adversario
              ? `${clubeSemEscalao(season && season.club) || 'Equipa'} vs ${printConvocatoria.adversario}`
              : 'Convocatória'}
          </h2>
          <div style={{ fontSize: 12.5, color: '#444', margin: '0 0 14px' }}>
            {[
              printConvocatoria.epoca,
              competitionLabel(printConvocatoria.competicao),
              printConvocatoria.escalao,
              printConvocatoria.jornada,
            ].filter(Boolean).join(' · ')}
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '4px 24px',
            margin: '0 0 14px', fontSize: 12.5, borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', padding: '8px 0',
          }}>
            {printConvocatoria.data && <div><strong>Data:</strong> {fmtDate(printConvocatoria.data)}</div>}
            {printConvocatoria.horaJogo && <div><strong>Hora do jogo:</strong> {printConvocatoria.horaJogo}</div>}
            {printConvocatoria.localJogo && <div><strong>Local do jogo:</strong> {printConvocatoria.localJogo}</div>}
            {printConvocatoria.horaConcentracao && <div><strong>Hora de concentração:</strong> {printConvocatoria.horaConcentracao}</div>}
            {printConvocatoria.localConcentracao && <div><strong>Local de concentração:</strong> {printConvocatoria.localConcentracao}</div>}
          </div>

          {printConvocatoria.outrasInfo && (
            <p style={{ margin: '0 0 14px', fontSize: 12.5, whiteSpace: 'pre-wrap' }}><strong>Outras informações:</strong> {printConvocatoria.outrasInfo}</p>
          )}

          {(() => {
            const ids = printConvocatoria.convocados || [];
            // Jogadores à experiência (ainda sem ficha no Plantel) vêm à
            // parte, só com o nome — aparecem sempre no fim da lista de
            // convocados (ou dos suplentes, na ficha técnica), nunca
            // misturados na ordem de quem já tem número.
            const experiencia = nomesDosConvidados(printConvocatoria);
            // Uma linha alinhada a sério — número numa coluna própria,
            // de largura fixa, e o nome sempre a começar no mesmo sítio.
            // Antes, número e nome saíam no mesmo texto corrido
            // ("27 · Nome"), e um "1" ao lado de um "27" desalinhava
            // tudo o que vinha a seguir — a numeração em si não muda,
            // só passa a ter o seu próprio espaço reservado.
            const linha = (numero, texto, key) => (
              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ width: 20, flexShrink: 0, textAlign: 'right', color: '#888' }}>{numero || ''}</span>
                <span>{numero ? '·' : ''}</span>
                <span>{texto}</span>
              </div>
            );
            const nome = (pid, sufixo) => {
              const p = players.find(pl => pl.id === pid);
              return p ? linha(p.number, `${p.name}${sufixo || ''}`, pid) : null;
            };
            const bracadeira = (pid) => (
              printConvocatoria.capitao === pid ? ' (C)'
                : printConvocatoria.subcapitao === pid ? ' (SC)' : ''
            );

            // Folha para afixar: só os nomes, sem revelar o onze.
            // Ordenados pelo NÚMERO DA CAMISOLA (antes, por posição — e a
            // lista parecia não ter ordem nenhuma a quem a lia).
            if (printConvocatoria.__tipo !== 'ficha') {
              const idsOrdenados = ordenarPorCamisola(
                ids.map(pid => players.find(pl => pl.id === pid)).filter(Boolean),
              ).map(p => p.id);
              return (
                <>
                  {/* DUAS COLUNAS: convocados e assinatura. Cada jogador tem
                      uma linha própria para assinar, com 9 mm de altura (a
                      medida habitual de uma linha de assinatura em
                      formulários), e nenhuma linha é partida entre páginas. */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 16 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontSize: 15, fontWeight: 700, padding: '0 0 6px', width: '50%' }}>
                          Convocados {(ids.length + experiencia.length) ? `(${ids.length + experiencia.length})` : ''}
                        </th>
                        <th style={{ textAlign: 'left', fontSize: 15, fontWeight: 700, padding: '0 0 6px 16px', width: '50%' }}>Assinatura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...idsOrdenados.map(pid => {
                          const p = players.find(pl => pl.id === pid);
                          return p ? { key: pid, numero: p.number, texto: p.name, foto: p.photo || null } : null;
                        }).filter(Boolean),
                        ...experiencia.map((n, i) => ({ key: `x-${i}`, numero: null, texto: `${n} (exp)` })),
                      ].map(r => (
                        <tr key={r.key} style={{ height: '9mm', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <td style={{ verticalAlign: 'bottom', padding: '0 0 3px' }}>
                            {/* Foto, número e nome de cada convocado. */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ width: '7mm', height: '7mm', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid #888', background: '#eee', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt', fontWeight: 700 }}>
                                {r.foto ? <img src={r.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (r.numero || '')}
                              </span>
                              <span style={{ width: 22, flexShrink: 0, textAlign: 'right', color: '#666', fontWeight: 600 }}>{r.numero || ''}</span>
                              <span>{r.texto}</span>
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'bottom', padding: '0 0 0 16px' }}>
                            <div style={{ borderBottom: '1px solid #555', height: '7mm' }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            }

            /* Ficha técnica: onze, banco e braçadeiras.

               O ONZE É O DO JOGO. Quando o jogo desta convocatória já tem
               titulares escolhidos (na ficha do jogo ou no Planeamento), o
               onze impresso são esses, pela ordem do campo; o banco são os
               restantes convocados. Antes eram sempre os onze primeiros da
               lista de convocados, e mudar o onze no jogo não mudava nada
               aqui. Sem titulares no jogo, mantém-se a regra antiga. */
            const jogoLigado = (matches || []).find(m => m.sourceConvocatoriaId === printConvocatoria.id)
              || (printConvocatoria.jogoId ? (matches || []).find(m => m.id === printConvocatoria.jogoId) : null)
              || (matches || []).find(m => m.date === printConvocatoria.data && !isFriendlyMatch(m));
            const onzeDoJogo = jogoLigado ? titularesPorLugar(jogoLigado, players).map(p => p.id) : [];
            const onzeIds = onzeDoJogo.length ? onzeDoJogo : ids.slice(0, 11);
            // Sem limite — antes parava nos 20 primeiros (onze + 9 do
            // banco), e com convocatórias maiores (ex.: pré-época, com
            // 35) os últimos ficavam de fora da ficha sem aviso nenhum.
            const bancoIds = onzeDoJogo.length ? ids.filter(id => !onzeDoJogo.includes(id)) : ids.slice(11);
            // Na folha, onze e suplentes saem PELO NÚMERO DA CAMISOLA.
            const pelaCamisola = (lista) => ordenarPorCamisola(lista.map(pid => players.find(pl => pl.id === pid)).filter(Boolean)).map(p => p.id);
            const onze = pelaCamisola(onzeIds);
            const banco = pelaCamisola(bancoIds);
            // Onze no campo + suplentes com foto (o mesmo desenho do ecrã).
            const escPrint = (jogoLigado && (jogoLigado.starters || []).length)
              ? escalacaoDoJogo(jogoLigado, players)
              : escalacaoDaConvocatoria(printConvocatoria, players);
            if (escPrint.slots.some(Boolean)) {
              return (
                <EscalacaoPrint players={players} formacao={escPrint.formacao} slots={escPrint.slots}
                  banco={ordenarPorCamisola(escPrint.banco.map(id => players.find(p => p.id === id)).filter(Boolean)).map(p => p.id)}
                  capitao={printConvocatoria.capitao} subcapitao={printConvocatoria.subcapitao} />
              );
            }
            return (
              <>
                {/* UMA COLUNA, e não uma grelha que se espalha pela folha.

                    Uma ficha técnica lê-se de cima para baixo, à procura de
                    um nome ou de um número. Em três colunas a ordem quebra-se
                    e é preciso saltar de coluna para seguir a numeração.
                    Vinte nomes numa coluna cabem folgadamente numa A4. */}
                <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Onze inicial ({onze.length})</h3>
                <div style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.65 }}>
                  {onze.map((pid) => nome(pid, bracadeira(pid)))}
                </div>

                <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Suplentes ({banco.length + experiencia.length})</h3>
                <div style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.65 }}>
                  {banco.map(pid => nome(pid, bracadeira(pid)))}
                  {experiencia.map((n, i) => linha(null, `${n} (exp)`, `x-${i}`))}
                </div>

                <div style={{ fontSize: 12.5, marginBottom: 14 }}>
                  <strong>Capitão:</strong> {nome(printConvocatoria.capitao) || '—'}
                  {'   '}
                  <strong>Subcapitão:</strong> {nome(printConvocatoria.subcapitao) || '—'}
                </div>
              </>
            );
          })()}

          <div style={{ fontSize: 12.5, borderTop: '1px solid #ccc', paddingTop: 8 }}>
            {printConvocatoria.treinador && <div><strong>Treinador:</strong> {printConvocatoria.treinador}</div>}
            {printConvocatoria.teamManager && <div><strong>Team Manager:</strong> {printConvocatoria.teamManager}</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function ConvocatoriaModal({ convocatoria, players: playersAtivosDaConv, season, standings, onClose, onSave, clinico, matches = [] }) {
  // Convocatória passada: mostra também quem lá esteve e já saiu do clube.
  const players = React.useMemo(() => comQuemLaEsteve(playersAtivosDaConv, convocatoria), [playersAtivosDaConv, convocatoria]);
  const [f, setF] = useState(convocatoria || {
    epoca: season?.name || '', competicao: FRIENDLY, escalao: 'Sub-19', adversario: '', casaFora: 'Casa',
    jornada: '', data: '', horaJogo: '', localJogo: '', horaConcentracao: '',
    localConcentracao: '', outrasInfo: '', convocados: [], treinador: 'João Pedro', teamManager: 'Américo',
  });

  /* A ORDEM DOS CLIQUES É A CONVOCATÓRIA.

     Os primeiros 11 escolhidos são o onze inicial; os seguintes, até 9,
     são suplentes. É a forma como o treinador pensa a convocatória — não
     escolhe "vinte nomes" e depois separa, escolhe o onze e depois o
     banco — e evita uma segunda lista para arrastar jogadores entre
     grupos.

     A ordem vive no próprio array `convocados`, por isso não há campo
     novo a manter sincronizado: tirar um titular promove automaticamente
     o primeiro suplente. */
  const TITULARES = 11;
  const MAX_CONVOCADOS = 20;
  // Escalação no campo (formação + lugares + banco até 9).
  /* ONZE VERDADEIRO DE UMA CONVOCATÓRIA ANTIGA. As convocatórias antigas
     não guardam o onze lugar a lugar ("alinhamento"): a app calculava-o na
     hora com os 11 primeiros convocados e as posições da ficha — e um
     extremo que jogou a lateral ficava num lugar de extremo, deixando o de
     lateral "livre". O jogo ligado a esta convocatória guarda o onze tal
     como foi (lugar a lugar): sem onze próprio, mostra-se o do jogo. */
  const jogoLigado = (matches || []).find(m => m && (
    (convocatoria && m.sourceConvocatoriaId === convocatoria.id)
    || (f.jogoId && m.id === f.jogoId)
    || (m.date === f.data && f.adversario && m.opponent === f.adversario))) || null;
  const fParaCampo = (() => {
    if (Array.isArray(f.alinhamento) || !jogoLigado || !Array.isArray(jogoLigado.alinhamento)) return f;
    const fm = jogoLigado.formacao || f.formacao || '4-3-3';
    if (jogoLigado.alinhamento.length !== (tamanhoDaFormacao(fm) || 11)) return f;
    return { ...f, formacao: fm, alinhamento: jogoLigado.alinhamento };
  })();
  const escConv = escalacaoDaConvocatoria(fParaCampo, players);
  const aplicarConv = ({ slots, banco }) => setF(prev => {
    const convocados = [...slots.filter(Boolean), ...banco];
    const ficam = new Set(convocados);
    return {
      // Grava também o sistema que está no campo: sem ele, uma convocatória
      // que mostrava o sistema do jogo (ex.: 4-2-3-1) voltava ao 4-3-3 por
      // omissão ao mexer num jogador, e a estrutura trocava.
      ...prev, convocados, alinhamento: slots, formacao: escConv.formacao,
      capitao: ficam.has(prev.capitao) ? prev.capitao : undefined,
      subcapitao: ficam.has(prev.subcapitao) ? prev.subcapitao : undefined,
    };
  });
  const formacaoConv = (fm) => setF(prev => {
    const e = escalacaoNovaFormacao(escalacaoDaConvocatoria(Array.isArray(prev.alinhamento) ? prev : fParaCampo, players), fm, players);
    return { ...prev, formacao: fm, alinhamento: e.slots, convocados: [...e.slots.filter(Boolean), ...e.banco] };
  });
  // O jogo desta convocatória (mesma data e adversário), para o cartão do plano.
  const jogoDaConvocatoria = (matches || []).find(m => m.date === f.data && f.adversario && m.opponent === f.adversario) || null;
  const titulares = f.convocados.slice(0, TITULARES);
  const suplentes = f.convocados.slice(TITULARES, MAX_CONVOCADOS);
  const excedentes = f.convocados.slice(MAX_CONVOCADOS);

  const toggleConvocado = (pid) => {
    const inList = f.convocados.includes(pid);
    const next = inList ? f.convocados.filter(id => id !== pid) : [...f.convocados, pid];
    // Tirar um jogador da lista tira-lhe também a braçadeira.
    setF({
      ...f,
      convocados: next,
      capitao: next.includes(f.capitao) ? f.capitao : undefined,
      subcapitao: next.includes(f.subcapitao) ? f.subcapitao : undefined,
    });
  };

  /* Braçadeiras do JOGO (ver CAPTAIN_RANKS para a hierarquia do plantel).
     Um clique atribui, outro tira; o capitão e o subcapitão nunca podem
     ser a mesma pessoa. Escolhi cliques e não arrastar: no telemóvel,
     arrastar sobre uma lista que rola é frustrante, e aqui não há nada
     que o arrastar acrescente. */
  const setBracadeira = (pid, papel) => {
    setF(prev => {
      const outro = papel === 'capitao' ? 'subcapitao' : 'capitao';
      const jaTem = prev[papel] === pid;
      return {
        ...prev,
        [papel]: jaTem ? undefined : pid,
        [outro]: prev[outro] === pid ? undefined : prev[outro],
      };
    });
  };
  // As competições vêm das que estão configuradas em Jogos.
  const compAtual = competitionLabel(f.competicao);
  const compOptions = [...new Set([...competitionOptions(standings), ...(compAtual ? [compAtual] : [])])];

  // Igual ao Novo jogo: com uma competição configurada, o adversário e a
  // jornada passam a listas com as equipas e jornadas lá criadas, e a data
  // vem do calendário da competição.
  const comp = competitionByName(standings, f.competicao);
  const equipas = competitionTeamNames(comp, season && season.club);
  const jornadas = competitionRoundLabels(comp);
  const setFixture = (patch) => {
    const next = { ...f, ...patch };
    const data = competitionGameDate(comp, next.jornada, next.adversario);
    setF(data ? { ...next, data } : next);
  };

  return (
    <Modal title={convocatoria ? 'Editar convocatória' : 'Nova convocatória'} onClose={onClose} wide xwide fullPage>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Jogo</div>
        <div style={{ ...FIELD_GRID }}>
          <Field label="Época"><Input value={f.epoca} onChange={e => setF({ ...f, epoca: e.target.value })} placeholder="2026/2027" /></Field>
          <Field label="Competição">
            <Select value={compAtual} onChange={e => setF({ ...f, competicao: e.target.value, adversario: '', jornada: '' })}>
              <option value="">— sem competição —</option>
              {compOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Escalão"><Input value={f.escalao} onChange={e => setF({ ...f, escalao: e.target.value })} placeholder="Sub-19" /></Field>
          <Field label="Adversário">
            {equipas.length > 0 ? (
              <Select value={f.adversario || ''} onChange={e => setFixture({ adversario: e.target.value })}>
                <option value="">— escolher equipa —</option>
                {equipas.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            ) : (
              <Input value={f.adversario} onChange={e => setF({ ...f, adversario: e.target.value })} />
            )}
          </Field>
          <Field label="Casa / Fora">
            <Select value={f.casaFora} onChange={e => setF({ ...f, casaFora: e.target.value })}>
              <option value="Casa">Casa</option>
              <option value="Fora">Fora</option>
            </Select>
          </Field>
          <Field label="Jornada">
            {jornadas.length > 0 ? (
              <Select value={f.jornada || ''} onChange={e => setFixture({ jornada: e.target.value })}>
                <option value="">— sem jornada —</option>
                {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
              </Select>
            ) : (
              <Input value={f.jornada} onChange={e => setF({ ...f, jornada: e.target.value })} placeholder="ex: Jornada 12" />
            )}
          </Field>
          <Field label="Data"><Input type="date" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Field>
          <Field label="Hora do jogo"><Input type="time" value={f.horaJogo} onChange={e => setF({ ...f, horaJogo: e.target.value })} /></Field>
          <Field label="Local do jogo"><Input value={f.localJogo} onChange={e => setF({ ...f, localJogo: e.target.value })} /></Field>
          <Field label="Hora de concentração"><Input type="time" value={f.horaConcentracao} onChange={e => setF({ ...f, horaConcentracao: e.target.value })} /></Field>
          <div style={FIELD_FULL}>
            <Field label="Local de concentração"><Input value={f.localConcentracao} onChange={e => setF({ ...f, localConcentracao: e.target.value })} /></Field>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          {/* Largura fixa: o número a mudar não empurra os botões ao lado. */}
          <span style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', minWidth: '15em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            Lista de convocados · {f.convocados.length}
          </span>
          {players.length > 0 && (
            <SelectAllBar
              onSelectAll={() => {
                // Sem indisponíveis (Boletim Clínico) nem castigados.
                const castigoC = castigadosParaJogo(matches, f.data, jogoDaConvocatoria && jogoDaConvocatoria.id);
                const ok = players.filter(p => { const e = estadoClinicoParaJogo(p.id, f.data, clinico); return !(e && e.avisaJogo) && !castigoC.has(p.id); });
                setF({ ...f, convocados: sortByPosition(ok).map(p => p.id), alinhamento: null });
              }}
              onClear={() => setF({ ...f, convocados: [], alinhamento: null, capitao: undefined, subcapitao: undefined })}
            />
          )}
          <div style={{ marginLeft: 'auto' }}>
            <CartaoPlanoDoJogo jogo={jogoDaConvocatoria} />
          </div>
        </div>
        <div style={{ height: 6 }} />
        {players.length === 0 ? (
          <div style={{ fontSize: 13, color: T.mutedDim }}>Adiciona jogadores ao plantel antes de criar uma convocatória.</div>
        ) : (
          <>
            <EscalacaoNoCampo
              players={players}
              formacao={escConv.formacao}
              slots={escConv.slots}
              banco={escConv.banco}
              onChange={aplicarConv}
              onFormacao={formacaoConv}
              clinico={clinico}
              data={f.data}
              maxBanco={9}
              castigados={castigadosParaJogo(matches, f.data, jogoDaConvocatoria && jogoDaConvocatoria.id)}
            />

            {/* LISTAS QUE NÃO MEXEM: o Onze inicial reserva sempre as 11
                linhas e os Suplentes as 9 (linhas vazias "—" até serem
                preenchidas). Antes, as listas só apareciam com o 1.º
                convocado e cresciam a cada jogador, empurrando tudo o que
                está por baixo (Responsáveis…) para baixo. */}
            {(
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { titulo: `Onze inicial · ${titulares.length}/${TITULARES}`, ids: titulares, cor: T.gold, reserva: TITULARES },
                  { titulo: `Suplentes · ${suplentes.length}/9`, ids: suplentes, cor: T.muted, reserva: 9 },
                  { titulo: `A mais — não entram na ficha · ${excedentes.length}`, ids: excedentes, cor: T.bad, reserva: 0 },
                ].filter(g => g.reserva > 0 || g.ids.length > 0).map(grupo => (
                  <div key={grupo.titulo.split(' · ')[0]}>
                    <div style={{ fontSize: 10.5, color: grupo.cor, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{grupo.titulo}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Array.from({ length: Math.max(grupo.reserva, grupo.ids.length) }, (_, i) => grupo.ids[i] || null).map((pid, i) => {
                        const jog = pid ? players.find(x => x.id === pid) : null;
                        if (!jog) {
                          // Linha vazia com a MESMA altura de uma linha preenchida.
                          return (
                            <div key={`vazio-${i}`} aria-hidden="true" style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px',
                              border: `1px dashed ${T.line}`, borderRadius: 7, opacity: 0.5,
                            }}>
                              <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim, width: 16 }}>{grupo.reserva === TITULARES ? i + 1 : ''}</span>
                              <span style={{ flex: 1, fontSize: 12.5, color: T.mutedDim }}>—</span>
                              <span style={{ padding: '2px 8px', fontSize: 10.5, border: '1px solid transparent', visibility: 'hidden', ...mono }}>C</span>
                            </div>
                          );
                        }
                        const eCapitao = f.capitao === pid;
                        const eSub = f.subcapitao === pid;
                        return (
                          <div key={pid} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px',
                            background: T.bg, border: `1px solid ${T.line}`, borderRadius: 7,
                          }}>
                            <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim, width: 16 }}>
                              {grupo.ids === titulares ? i + 1 : ''}
                            </span>
                            <CaptainArmband rank={jog.captainRank} size={14} />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {jog.position ? `${jog.position} · ` : ''}{jog.name}
                            </span>
                            {/* Braçadeira do jogo: um clique põe, outro tira. */}
                            {[
                              { papel: 'capitao', etiqueta: 'C', ativo: eCapitao, dica: 'Capitão neste jogo' },
                              { papel: 'subcapitao', etiqueta: 'SC', ativo: eSub, dica: 'Subcapitão neste jogo' },
                            ].map(b => (
                              <button
                                key={b.papel}
                                type="button"
                                onClick={() => setBracadeira(pid, b.papel)}
                                title={b.dica}
                                style={{
                                  padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', ...mono,
                                  background: b.ativo ? T.goldFundo : 'transparent',
                                  color: b.ativo ? '#1A1A1A' : T.mutedDim,
                                  border: `1px solid ${b.ativo ? T.gold : T.line}`,
                                }}
                              >{b.etiqueta}</button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Responsáveis</div>
        <div style={{ ...FIELD_GRID }}>
          <Field label="Treinador"><Input value={f.treinador} onChange={e => setF({ ...f, treinador: e.target.value })} /></Field>
          <Field label="Team Manager"><Input value={f.teamManager} onChange={e => setF({ ...f, teamManager: e.target.value })} /></Field>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={!f.adversario} onClick={() => onSave(f)}><Check size={15} /> Guardar convocatória</Btn>
      </div>
    </Modal>
  );
}

