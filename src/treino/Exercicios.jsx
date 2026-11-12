// treino/Exercicios.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState } from 'react';
import { uid } from '../base/utilidades';
import { trocarJanela, removeWithUndo, itemLabel, Btn, SectionHeader, EmptyState } from '../base/ui';
import { imprimirComNome } from '../base/impressao';
import { momentoTexto, temMomento } from '../dominio/treino';
import { buildShareableHtmlDoc, shareOrDownloadHtml } from '../base/partilha';
import { Plus, BookOpen, Share2, Printer, Clock, Pencil, Trash2 } from 'lucide-react';
import { T, T_ESCURO } from '../base/tema';
import { createPortal } from 'react-dom';
import { viewBoxSemBancos, aspetoSemBancos, ESTICAR_IMPRESSAO_MEIO, VistaCampo, PitchMarkings, iconScaleForPhase, DiagramElements } from '../tatico/campo';
import { CARTAO_ASPECT, DiagramThumbAnimado, SpaceZonesReadOnly, aspetoCartao, buildDiagramBlockHtml } from './diagramas';
import { EXERCISE_PHASES, MomentoFilter, RotulosMomento } from './comum';
import { PdfComoImagens } from '../media/pdf';
import { ExerciseModal } from './ExerciseModal';
import { HistoryModal } from '../base/historico';
import { ExercisePresentation } from './ExercisePresentation';

/* ---------------------------------------------------------------
   EXERCÍCIOS
---------------------------------------------------------------- */
export function Exercicios({ exercises, setExercises, meta }) {
  const [modal, setModal] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState('Todas');
  const [printExercise, setPrintExercise] = useState(null);
  const [historyFor, setHistoryFor] = useState(null); // exercício a ver o histórico de alterações

  const save = (data) => {
    const isEdicao = !!data.id;
    if (isEdicao) setExercises(prev => prev.map(x => x.id === data.id ? data : x));
    else setExercises(prev => [...prev, { ...data, id: uid() }]);
    if (isEdicao) trocarJanela(() => setModal(null), () => setViewing(data));
    else setModal(null);
  };
  const remove = (id) => removeWithUndo(exercises, setExercises, id, itemLabel(exercises.find(x => x.id === id), 'Exercício'));
  const doPrint = (x) => {
    // Um PDF anexado sai na própria folha, desenhado como imagem (ver
    // `PdfComoImagens`); a impressão espera que as páginas fiquem prontas.
    setPrintExercise(x);
    imprimirComNome(x.name);
  };
  const doShare = (x) => {
    const meta = [momentoTexto(x), x.space && `📐 ${x.space}`, x.playersCount && `👥 ${x.playersCount}`, x.material && `🎒 ${x.material}`, x.defaultDuration && `⏱ ${x.defaultDuration} min`].filter(Boolean);
    const block = buildDiagramBlockHtml(x.diagram, x.space, 'ex', x.phase);
    const html = buildShareableHtmlDoc({ title: x.name || 'Exercício', metaLines: meta, description: x.description, blocks: [block] });
    shareOrDownloadHtml(`${(x.name || 'exercicio').replace(/[^\w-]+/g, '_')}.html`, html, x.name || 'Exercício');
  };
  /* Mais recentes primeiro. A lista chega do servidor por ordem de
     criação (created_at) e os novos entram no fim — por isso basta
     inverter. Editar um exercício não o tira do sítio. */
  // As versões arquivadas (antigas, guardadas só para as sessões
  // passadas, ver "GRAVAR POR CIMA" na sessão) não aparecem na biblioteca.
  const ativos = exercises.filter(x => x && !x.arquivado);
  const visible = (filter === 'Todas' ? ativos : ativos.filter(x => temMomento(x, filter))).slice().reverse();

  return (
    <div>
      <SectionHeader title="Exercícios" subtitle="A tua biblioteca de treino."
        action={<Btn onClick={() => setModal('new')}><Plus size={15} /> Novo exercício</Btn>} />

      {/* Grelha de duas colunas: com nomes de comprimentos muito diferentes,
          a lista em linha ficava aos saltos. Assim ficam alinhados, metade
          de cada lado. */}
      {/* "Descanso" é uma fase de sessão (dia de folga), não classifica
          exercícios — por isso não entra nos filtros da biblioteca. */}
      <MomentoFilter value={filter} onChange={setFilter} options={EXERCISE_PHASES} />

      {visible.length === 0 ? (
        <EmptyState text="Nenhum exercício aqui ainda." action={<Btn onClick={() => setModal('new')}><Plus size={15} /> Criar exercício</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {visible.map(x => {
            return (
            <div key={x.id} onClick={() => setViewing(x)} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
              {/* Nome sozinho na primeira linha; a fase e os ícones ficam
                  por baixo, para o título não ser cortado a meio. Altura
                  fixa (2 linhas) — mesmo critério já usado na Ideia de
                  Jogo, para os cartões ficarem todos do mesmo tamanho. */}
              {/* Título numa só linha (o nome completo aparece ao passar o
                  rato e no detalhe): sem o espaço vazio que a 2.ª linha
                  reservada deixava nos nomes curtos. */}
              <div title={x.name} style={{
                color: T.cream, fontWeight: 500, fontSize: 15, marginBottom: 10, lineHeight: '20px', height: 20,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{x.name}</div>
              {/* CARTÃO SIMPLIFICADO — sem espaço, nº de jogadores, material
                  nem "editado por" (continuam no detalhe e no histórico).
                  Todas as zonas têm altura fixa (título 2 linhas, imagem
                  130px, ícones, descrição 3 linhas), por isso os cartões
                  ficam todos do mesmo tamanho, tenham ou não descrição,
                  anexo ou esquema. */}
              <div style={{ width: '100%', aspectRatio: aspetoCartao(x.diagram && x.diagram.vista), borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                {(x.diagram && ((x.diagram.elements || []).length || (x.diagram.arrows || []).length)) ? (
                  <DiagramThumbAnimado diagram={x.diagram} space={x.space} phase={x.phase} height={130} />
                ) : (x.attachment && x.attachment.type === 'image') ? (
                  <img src={x.attachment.dataUrl} alt={x.attachment.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (x.attachment && x.attachment.type === 'pdf' && x.attachment.dataUrl) ? (
                  <div style={{ width: '100%', height: '100%', background: '#fff' }}>
                    <PdfComoImagens url={x.attachment.dataUrl} so1 largura={600}
                      estiloImg={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                      vazio={(
                        <div style={{ width: '100%', height: '100%', background: '#1e3a24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 12px', boxSizing: 'border-box', fontSize: 11.5, color: T_ESCURO.mutedDim }}>
                          <BookOpen size={13} style={{ flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.attachment.name}</span>
                        </div>
                      )} />
                  </div>
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: CARTAO_ASPECT, background: '#1e3a24',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 12px', boxSizing: 'border-box',
                    fontSize: 11.5, color: T_ESCURO.mutedDim, textAlign: 'center',
                  }}>
                    {x.attachment ? (<><BookOpen size={13} style={{ flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.attachment.name}</span></>) : 'Sem esquema'}
                  </div>
                )}
              </div>
              <p style={{
                color: T.mutedDim, fontSize: 12.5, lineHeight: 1.5, margin: '10px 0 0', height: 56,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{x.description}</p>
              {/* Ícones no fundo do cartão, encostados à direita — por baixo
                  da descrição, a pedido. */}
              {/* O MOMENTO passa para baixo do campo, à esquerda, na linha
                  dos ícones (a pedido) — o campo sobe para logo a seguir
                  ao título. */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'center' }}>
                <RotulosMomento x={x} />
                <span style={{ flex: 1 }} />
                <button onClick={(e) => { e.stopPropagation(); doShare(x); }} title="Partilhar como ficheiro" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Share2 size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); doPrint(x); }} title="Imprimir exercício" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Printer size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); setHistoryFor(x); }} title="Histórico de alterações" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Clock size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); setModal(x); }} title="Editar" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); remove(x.id); }} title="Apagar" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Trash2 size={14} /></button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ExerciseModal
          exercise={modal === 'new' ? null : modal}
          allExercises={exercises}
          meta={meta}
          onClose={() => (modal === 'new' ? setModal(null) : trocarJanela(() => setModal(null), () => setViewing(modal)))}
          onSave={save}
        />
      )}
      {historyFor && <HistoryModal table="exercises" recordId={historyFor.id} title={`Histórico · ${historyFor.name}`} onClose={() => setHistoryFor(null)} />}
      {viewing && (
        <ExercisePresentation
          exercise={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => trocarJanela(() => setViewing(null), () => setModal(viewing))}
        />
      )}

      {printExercise && createPortal(
        <div className="print-sheet">
          {printExercise.name && <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>{printExercise.name}</h2>}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: '4px 24px',
            margin: '0 0 14px', fontSize: 12.5, borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', padding: '8px 0',
          }}>
            {printExercise.phase && <div style={{ gridColumn: 1, gridRow: 1 }}><strong>Fase de jogo:</strong> {momentoTexto(printExercise)}</div>}
            {printExercise.defaultDuration && <div style={{ gridColumn: 2, gridRow: 1 }}><strong>Duração:</strong> {printExercise.defaultDuration} min</div>}
            {printExercise.space && <div style={{ gridColumn: 3, gridRow: 1 }}><strong>Espaço:</strong> {printExercise.space}</div>}
            {printExercise.playersCount && <div style={{ gridColumn: 1, gridRow: 2 }}><strong>Nº jogadores:</strong> {printExercise.playersCount}</div>}
            {printExercise.material && <div style={{ gridColumn: 2, gridRow: 2 }}><strong>Material:</strong> {printExercise.material}</div>}
          </div>
          {printExercise.description && (
            <p style={{ margin: '0 0 14px', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{printExercise.description}</p>
          )}
          {printExercise.attachment && printExercise.attachment.type === 'image' ? (
            <img
              src={printExercise.attachment.dataUrl}
              alt={printExercise.attachment.name}
              style={{ width: '100%', display: 'block', background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
            />
          ) : (printExercise.attachment && printExercise.attachment.type === 'pdf' && printExercise.attachment.dataUrl) ? (
            <PdfComoImagens url={printExercise.attachment.dataUrl}
              estiloImg={{ width: '100%', display: 'block', background: '#fff', border: '1px solid #ccc', borderRadius: 8, marginBottom: 8, breakInside: 'avoid' }} />
          ) : (
            <svg viewBox={viewBoxSemBancos(printExercise.diagram && printExercise.diagram.vista)} style={{ width: '100%', aspectRatio: aspetoSemBancos(printExercise.diagram && printExercise.diagram.vista), display: 'block', background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}>
              <VistaCampo esticar={ESTICAR_IMPRESSAO_MEIO} vista={printExercise.diagram && printExercise.diagram.vista}>
              <PitchMarkings printMode semBancos />
              <SpaceZonesReadOnly diagram={printExercise.diagram} spaceText={printExercise.space} printMode />
              <DiagramElements
                elements={printExercise.diagram?.elements || []}
                arrows={printExercise.diagram?.arrows || []}
                interactive={false}
                iconScale={iconScaleForPhase(printExercise.phase, printExercise.diagram)}
                printMode
              />
              </VistaCampo>
            </svg>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

