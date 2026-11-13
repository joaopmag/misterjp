// scouting/Scouting.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, body, TEXT_ON_ACCENT, display, mono } from '../base/tema';
import { useState, useEffect } from 'react';
import { useDetailBack } from '../base/historico';
import { uid, fmtDate } from '../base/utilidades';
import { trocarJanela, removeWithUndo, itemLabel, Btn, SectionHeader, EmptyState } from '../base/ui';
import { buildShareableHtmlDoc, shareOrDownloadHtml } from '../base/partilha';
import { Plus, Download, Users, Shield, Target, Share2, Printer, Pencil, Trash2 } from 'lucide-react';
import { ESTILO_BOTAO_PEQUENO, ICONE_BOTAO_PEQUENO } from '../plantel/Prancheta';
import { SubTabs } from '../base/ui-extra';
import { age } from '../plantel/PlayerModal';
import { createPortal } from 'react-dom';
import { NecessidadesEquipa, necEstaAtiva, necPrioridade, necQueEncaixam } from './Necessidades';
import { RATING_LEVELS, RatingStars, SCOUT_PILLARS, buildScoutReportHtml, exportScoutingCSV, pillarAverage, starsText } from './comum';
import { ScoutPlayerForm, ScoutSheetPage } from './ScoutSheet';
import { AdversariosApp } from '../adversarios/Adversarios';

export function Scouting({ abaInicial, scouting, setScouting, adversarios, setAdversarios, videos, setVideos, players = [], clinico = [], teamId, necApi = { estado: 'a-verificar', itens: [], set: null, pronto: false, autorizar: null } }) {
  const botaoCartao = { background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 5, display: 'flex', borderRadius: 6 };
  const umaLinhaEstilo = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
  const [subTab, setSubTab] = useState(abaInicial === 'adversarios' ? 'adversarios' : 'jogadores');
  useEffect(() => { if (abaInicial === 'adversarios') setSubTab('adversarios'); }, [abaInicial]);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('');
  const [printScout, setPrintScout] = useState(null);
  const [viewing, setViewing] = useState(null); // ficha completa em ecrã
  const [editandoAdversario, setEditandoAdversario] = useState(null); // 'new' | adversário — ver nota no botão partilhado, mais abaixo
  const fecharFicha = useDetailBack(!!viewing, () => setViewing(null));
  // NECESSIDADES (módulo novo, isolado): ligação à tabela própria; o
  // resto do Scouting só lê daqui (contagem e etiqueta nos cartões).
  const [necVista, setNecVista] = useState(null); // null (lista) | { tipo: 'form', inicial } | { tipo: 'detalhe', id }
  const necCarregado = necApi.estado === 'ok' && necApi.pronto;
  const necAtivas = necApi.estado === 'ok' ? (necApi.itens || []).filter(necEstaAtiva) : [];

  const save = (data) => {
    const isEdicao = !!data.id;
    if (isEdicao) setScouting(prev => prev.map(x => x.id === data.id ? data : x));
    else setScouting(prev => [...prev, { ...data, id: uid() }]);
    // Editar mantém no jogador (volta à ficha, não à lista); só criar de
    // novo é que fecha de vez, porque nunca houve uma ficha para voltar.
    if (isEdicao) trocarJanela(() => setModal(null), () => setViewing(data));
    else setModal(null);
  };
  const remove = (id) => removeWithUndo(scouting, setScouting, id, itemLabel(scouting.find(x => x.id === id), 'Jogador observado'));

  const doShare = (x) => {
    const title = x.name || 'Jogador observado';
    // Sem subtítulo: a linha corrida de dados repetia a tabela de
    // identificação que vem logo a seguir.
    const html = buildShareableHtmlDoc({
      title, metaLines: [], blocks: [], extraHtml: buildScoutReportHtml(x),
    });
    shareOrDownloadHtml(`scouting_${title.replace(/[^\w-]+/g, '_')}.html`, html, title);
  };
  const doPrint = (x) => {
    setPrintScout(x);
    setTimeout(() => window.print(), 80);
  };
  /* A folha tem de sair do body depois de imprimir — senão fica montada
     e a impressão seguinte (mesmo de outra coisa qualquer, como um
     adversário) leva-a colada. Mesmo padrão usado nas outras folhas. */
  useEffect(() => {
    if (!printScout) return undefined;
    const limpar = () => setPrintScout(null);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [printScout]);

  const visible = [...scouting]
    .filter(x => !filter || x.position === filter)
    .sort((a, b) => (b.potential || 0) - (a.potential || 0));
  const positionsUsed = [...new Set(scouting.map(x => x.position).filter(Boolean))];

  return (
    <div>
      {/* A ação de cada separador fica no cabeçalho, no mesmo sítio do
          "Novo exercício" e das outras páginas. "Exportar CSV" fica por
          baixo de "Adicionar jogador", pequeno, por cima do espaço livre
          da linha dos separadores (posição absoluta): o cabeçalho tem a
          mesma altura em todos os separadores e nada mexe ao trocar. */}
      <SectionHeader title="Scouting" subtitle="Jogadores e adversários para acompanhar ao longo da época."
        action={
          !viewing && !modal && subTab === 'jogadores' ? (
            <div style={{ position: 'relative' }}>
              <Btn onClick={() => setModal('new')}><Plus size={15} /> Adicionar jogador</Btn>
              {scouting.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 2px)', right: 0, zIndex: 1 }}>
                  <Btn variant="ghost" onClick={() => exportScoutingCSV(scouting)} style={ESTILO_BOTAO_PEQUENO}><Download size={ICONE_BOTAO_PEQUENO} /> Exportar CSV</Btn>
                </div>
              )}
            </div>
          ) : !viewing && !modal && subTab === 'adversarios' && !editandoAdversario ? (
            <Btn onClick={() => setEditandoAdversario('new')}><Plus size={15} /> Adicionar adversário</Btn>
          ) : !viewing && !modal && subTab === 'necessidades' && !necVista && necApi.estado !== 'sem-tabela' && necApi.estado !== 'erro' ? (
            <Btn onClick={() => setNecVista({ tipo: 'form', inicial: {} })} disabled={!necCarregado}><Plus size={15} /> Lançar necessidade</Btn>
          ) : null
        } />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <SubTabs
          value={subTab}
          onChange={(v) => {
            // Trocar de valência enquanto uma ficha de jogador está aberta
            // — ou a meio de a criar/editar, dos dois lados (jogador ou
            // adversário) — não fazia nada visível: o ecrã continuava
            // preso a essa ficha ou àquele formulário (`viewing`/`modal`/
            // `editandoAdversario` tinham sempre prioridade sobre `subTab`
            // a decidir o que mostrar). Ao trocar, fecham-se os três.
            setSubTab(v);
            setViewing(null);
            setModal(null);
            setEditandoAdversario(null);
            setNecVista(null);
          }}
          tabs={[
            { id: 'jogadores', label: 'Jogadores', icon: Users, count: scouting.length },
            { id: 'adversarios', label: 'Adversários', icon: Shield, count: adversarios.length },
            // A contagem tem sempre lugar ("–" enquanto carrega), para o
            // separador não mudar de largura quando o número chega.
            { id: 'necessidades', label: 'Necessidades', icon: Target, count: necCarregado ? necAtivas.length : '–' },
          ]}
          semMargem
        />
        {/* As ações só fazem sentido junto da lista — nem quando se vê a
            ficha de um jogador em concreto, nem a meio de a editar.
            "Adicionar adversário" vive aqui (não dentro do
            AdversariosApp) exatamente pela mesma razão: fica na mesma
            linha dos separadores, alinhada do lado oposto, como as
            ações de "Jogadores". */}
      </div>

      {viewing ? (
        <ScoutSheetPage
          player={viewing}
          videos={videos} setVideos={setVideos}
          onBack={fecharFicha}
          onEdit={() => trocarJanela(() => setViewing(null), () => setModal(viewing))}
          onShare={() => doShare(viewing)}
          onPrint={() => doPrint(viewing)}
        />
      ) : modal ? (
        <ScoutPlayerForm
          player={modal === 'new' ? null : modal}
          onBack={() => (modal === 'new' ? setModal(null) : trocarJanela(() => setModal(null), () => setViewing(modal)))}
          onSave={save}
        />
      ) : subTab === 'adversarios' ? (
        <AdversariosApp
          adversarios={adversarios} setAdversarios={setAdversarios} scouting={scouting} setScouting={setScouting}
          videos={videos} setVideos={setVideos}
          editando={editandoAdversario} setEditando={setEditandoAdversario}
        />
      ) : subTab === 'necessidades' ? (
        <NecessidadesEquipa api={necApi} scouting={scouting} players={players} clinico={clinico}
          vista={necVista} setVista={setNecVista}
          onVerJogador={(x) => setViewing(x)} />
      ) : (
      <>
      {positionsUsed.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={() => setFilter('')} style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
            background: filter === '' ? '#B5393F' : 'transparent', color: filter === '' ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${filter === '' ? '#B5393F' : T.line}`,
          }}>Todas</button>
          {positionsUsed.map(ph => (
            <button key={ph} onClick={() => setFilter(ph)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
              background: filter === ph ? '#B5393F' : 'transparent', color: filter === ph ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${filter === ph ? '#B5393F' : T.line}`,
            }}>{ph}</button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState text="Ainda sem jogadores adversários registados." action={<Btn onClick={() => setModal('new')}><Plus size={15} /> Adicionar o primeiro</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {visible.map(x => {
            const playerAge = x.birthYear ? age(x.birthYear) : (x.age || null);
            const avg = pillarAverage(x);
            return (
              /* CARTÃO DE SCOUTING — todos iguais: cada bloco tem sempre o
                 mesmo lugar e a mesma altura, preenchido ou não.
                 · Nome e duas linhas de identificação:
                   clube · posição(ões) · pé / país · ano · idade.
                 · Potencial (estrelas) e média, lado a lado.
                 · Os quatro pilares, cada um com a nota e uma barra.
                 · Ações em cima, ao lado do nome, juntas; no nome aparece
                   o primeiro e o último (o completo ao passar o rato).
                 Sem cor de clube (o jogador pode mudar de clube) e sem o
                 texto livre (características e observações), que fica só
                 na ficha completa. */
              <div key={x.id} onClick={() => setViewing(x)} title="Ver ficha completa"
                style={{
                  overflow: 'hidden', cursor: 'pointer', minWidth: 0,
                  background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, display: 'flex', flexDirection: 'column',
                }}>
                {(() => {
                  const posicoes = x.position ? `${x.position}${x.secondaryPosition ? `/${x.secondaryPosition}` : ''}` : null;
                  const linhaUm = [
                    x.club || 'Clube desconhecido',
                    posicoes,
                    x.dominantFoot ? `Pé ${x.dominantFoot.toLowerCase()}` : null,
                  ].filter(Boolean).join(' · ');
                  const linhaDois = [x.nationality, x.birthYear || null, playerAge ? `${playerAge} anos` : null].filter(Boolean).join(' · ');
                  const umaLinha = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
                  // No cartão, só o primeiro e o último nome (o completo
                  // fica na ficha e ao passar o rato).
                  const palavras = String(x.name || '').trim().split(/\s+/).filter(Boolean);
                  const nomeCurto = palavras.length > 2 ? `${palavras[0]} ${palavras[palavras.length - 1]}` : (x.name || '');
                  return (
                    <div style={{ padding: '14px 12px 10px 16px' }}>
                      <div style={{ minWidth: 0 }}>
                        {/* Nome e ações na mesma linha; os ícones ficam juntos
                            para deixar o máximo de espaço ao nome. */}
                        {/* Linha do nome com 26px (era 22px): com 22px o "corte" do
                            texto numa linha (overflow) apanhava as pernas das
                            letras como o g, o p ou o j. A margem por baixo
                            desce os mesmos 4px, por isso o cartão fica igual. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <div title={x.name} style={{ flex: 1, color: T.cream, ...display, fontWeight: 600, fontSize: 18, lineHeight: '26px', ...umaLinha }}>{nomeCurto}</div>
                          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'default' }}>
                            {(() => {
                              // Etiqueta das Necessidades: encaixa numa necessidade ativa.
                              const encaixa = necAtivas.length ? necQueEncaixam(x, necAtivas) : [];
                              return encaixa.length > 0 ? (
                                <button onClick={() => setSubTab('necessidades')} title={`Encaixa em: ${encaixa.map(n => `${n.posicao} (${necPrioridade(n.prioridade).label.toLowerCase()})`).join(', ')}`} style={{ ...botaoCartao, color: T.gold }}><Target size={13} /></button>
                              ) : null;
                            })()}
                            <button onClick={() => doShare(x)} title="Partilhar ficha do jogador" style={botaoCartao}><Share2 size={13} /></button>
                            <button onClick={() => doPrint(x)} title="Imprimir ficha do jogador" style={botaoCartao}><Printer size={13} /></button>
                            <button onClick={() => setModal(x)} title="Editar jogador" style={botaoCartao}><Pencil size={13} /></button>
                            <button onClick={() => remove(x.id)} title="Apagar jogador" style={botaoCartao}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <div title={linhaUm} style={{ color: T.muted, fontSize: 12, lineHeight: '18px', height: 18, ...umaLinha }}>{linhaUm}</div>
                        <div title={linhaDois || undefined} style={{ color: T.mutedDim, fontSize: 11.5, lineHeight: '17px', height: 17, marginTop: 4, ...umaLinha }}>{linhaDois || '\u00a0'}</div>
                      </div>
                    </div>
                  );
                })()}
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px' }}>
                    <RatingStars value={x.potential || 0} />
                    <span style={{ color: T.mutedDim, fontSize: 11 }}>Potencial</span>
                    <span style={{ flex: 1 }} />
                    <span title="Média dos quatro pilares" style={{
                      fontSize: 11.5, color: avg !== null ? T.cream : T.mutedDim, background: T.surfaceRaise,
                      borderRadius: 999, padding: '2px 9px', ...mono, whiteSpace: 'nowrap',
                    }}>Média {avg !== null ? avg : '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                    {SCOUT_PILLARS.map(p => {
                      const v = Number(x[`${p.key}Rating`]) || 0;
                      return (
                        <div key={p.key} style={{ background: T.surfaceRaise, borderRadius: 8, padding: '7px 10px 8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ color: T.mutedDim, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, ...umaLinhaEstilo }}>{p.label}</span>
                            <span style={{ color: v ? T.warn : T.mutedDim, fontWeight: 700, fontSize: 14, ...mono }}>{v || '—'}</span>
                          </div>
                          {/* Barra de 1 a 5 — a nota lê-se de relance. */}
                          <div style={{ height: 4, borderRadius: 2, background: T.line, marginTop: 5, overflow: 'hidden' }}>
                            <div style={{ width: `${(v / 5) * 100}%`, height: '100%', background: T.warn, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>
      )}

      {printScout && createPortal(
        <div className="print-sheet">
          <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>{printScout.name || 'Jogador observado'}</h2>

          <div>
            <h3 style={{ fontSize: 14, margin: '0 0 6px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Identificação</h3>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 14 }}>
            <table style={{ fontSize: 12.5, flex: '0 1 auto', width: 'auto' }}>
              <tbody>
                {[
                  ['Clube atual', printScout.club],
                  ['Ano de nascimento', printScout.birthYear],
                  ['Idade', printScout.birthYear ? `${age(printScout.birthYear)} anos` : (printScout.age || '')],
                  ['País', printScout.nationality],
                  ['Fim de contrato', printScout.contractEnd],
                  ['Posição principal', printScout.position],
                  ['Posição secundária', printScout.secondaryPosition],
                  ['Pé dominante', printScout.dominantFoot],
                  ['Data de observação', printScout.observationDate ? fmtDate(printScout.observationDate) : ''],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <tr key={k}>
                    <th style={{ textAlign: 'left', padding: '3px 16px 3px 0', fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</th>
                    <td style={{ padding: '3px 0' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {printScout.photo && (
              <img src={printScout.photo} alt="Fotografia" style={{
                width: 150, flex: '0 0 auto', aspectRatio: '3 / 4', objectFit: 'cover',
                borderRadius: 8, border: '1px solid #ccc',
              }} />
            )}
            </div>

            <h3 style={{ fontSize: 14, margin: '0 0 6px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Potencial geral</h3>
            <p style={{ fontSize: 12.5, margin: '0 0 14px' }}>
              {printScout.potential
                ? `${printScout.potential}/5  ${starsText(printScout.potential)}${(RATING_LEVELS.find(r => r.value === Number(printScout.potential)) || {}).label ? ` — ${(RATING_LEVELS.find(r => r.value === Number(printScout.potential)) || {}).label}` : ''}`
                : 'Sem classificação'}
            </p>

            {SCOUT_PILLARS.map(p => {
              const rating = printScout[`${p.key}Rating`];
              const notes = printScout[`${p.key}Notes`];
              if (!rating && !notes) return null;
              return (
                <div key={p.key} style={{ marginBottom: 10 }}>
                  <h3 style={{ fontSize: 13.5, margin: '0 0 3px' }}>
                    {p.label} — {rating ? `${rating}/5  ${starsText(rating)}` : 'sem avaliação'}
                  </h3>
                  {notes && <p style={{ fontSize: 12.5, margin: 0, whiteSpace: 'pre-wrap' }}>{notes}</p>}
                </div>
              );
            })}

            {pillarAverage(printScout) !== null && (
              <p style={{ fontSize: 12.5, margin: '14px 0 0', fontWeight: 600 }}>Média dos 4 pilares: {pillarAverage(printScout)}</p>
            )}
          </div>

          {printScout.traits && (
            <>
              <h3 style={{ fontSize: 14, margin: '14px 0 4px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Características</h3>
              <p style={{ fontSize: 12.5, margin: 0, whiteSpace: 'pre-wrap' }}>{printScout.traits}</p>
            </>
          )}
          {printScout.notes && (
            <>
              <h3 style={{ fontSize: 14, margin: '12px 0 4px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Notas gerais</h3>
              <p style={{ fontSize: 12.5, margin: 0, whiteSpace: 'pre-wrap' }}>{printScout.notes}</p>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

