// adversarios/Adversarios.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useEffect } from 'react';
import { useDetailBack } from '../base/historico';
import { buildShareableHtmlDoc, shareOrDownloadHtml } from '../base/partilha';
import { uid } from '../base/utilidades';
import { fichaRepetida } from '../media/organizacao';
import { removeWithUndo, itemLabel, Btn, EmptyState, trocarJanela, Modal, Field, Input, Select, FIELD_GRID, TextArea } from '../base/ui';
import { createPortal } from 'react-dom';
import { Plus, Eye, EyeOff, Share2, Printer, Pencil, Trash2, ChevronLeft, X } from 'lucide-react';
import { T, display, body, mono } from '../base/tema';
import { distribuirPlantel, TATICA_OMISSAO } from '../tatico/prancheta';
import { PrancheteDoPlantel, EditorPrancheta } from '../plantel/Prancheta';
import { DiagramThumb } from '../treino/diagramas';
import { ExercisePresentation } from '../treino/ExercisePresentation';
import { MediaLibrary } from '../media/MediaLibrary';
import { EXERCISE_PHASES } from '../treino/comum';
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import { DiagramEditor } from '../tatico/DiagramEditor';
import { POSITIONS } from '../dominio/jogadores';
import { DOMINANT_FEET, buildAdversarioReportHtml } from '../scouting/comum';
import { CORES_CLUBE, COR_CLUBE_OMISSAO, corDoClube, iniciaisDoClube, textoSobreCor } from './comum';
import { useSubColecao } from '../base/subcolecao';

export function AdversariosApp({ adversarios, setAdversarios, scouting, setScouting, videos, setVideos, editando, setEditando }) {
  const [viewing, setViewing] = useState(null); // ficha em consulta — página cheia
  const [printAdversario, setPrintAdversario] = useState(null);
  const fecharEdicao = useDetailBack(!!editando, () => setEditando(null));
  const fecharFicha = useDetailBack(!!viewing, () => setViewing(null));

  const chaveDe = (a) => (scouting || []).filter(x => (a.jogadoresChaveIds || []).includes(x.id));
  const doShare = (a) => {
    const title = a.nome || 'Adversário';
    const html = buildShareableHtmlDoc({
      title, metaLines: [a.escalao, a.prova, a.quadroTatica].filter(Boolean), blocks: [],
      extraHtml: buildAdversarioReportHtml(a, chaveDe(a)),
    });
    shareOrDownloadHtml(`adversario_${title.replace(/[^\w-]+/g, '_')}.html`, html, title);
  };
  const doPrint = (a) => {
    setPrintAdversario(a);
    setTimeout(() => window.print(), 80);
  };
  /* A folha tem de sair do body depois de imprimir — senão fica montada
     e a impressão seguinte leva-a colada (por exemplo, à de um jogador
     do Scouting). Mesmo padrão usado nas outras folhas. */
  useEffect(() => {
    if (!printAdversario) return undefined;
    const limpar = () => setPrintAdversario(null);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [printAdversario]);

  /* Guardar resolve os jogadores-chave escritos no formulário: cada
     linha com um nome que já existe em "Jogadores" (comparado sem
     maiúsculas/minúsculas) liga-se a essa ficha; um nome novo cria uma
     ficha lá, só com nome e posição — nunca antes disto, só ao
     guardar.

     O quadro de posições, no formulário, trabalhou com um `localId`
     próprio de cada linha (as fichas ainda não existiam para terem um
     id real). Aqui troca-se cada `localId` pelo id definitivo — o da
     ficha encontrada ou criada agora mesmo — antes de gravar os
     "mexidos à mão" do quadro. */
  const save = (dados, linhasChave, quadroTatica, quadroOverridesLocal) => {
    const scoutingFinal = [...scouting];
    const jogadoresChaveIds = [];
    const idFinalPorLocalId = {};
    (linhasChave || []).forEach(l => {
      const nome = (l.nome || '').trim();
      if (!nome) return;
      const idx = scoutingFinal.findIndex(x => (x.name || '').trim().toLowerCase() === nome.toLowerCase());
      let idFinal;
      const clube = String((dados && dados.nome) || '').trim();
      const camisola = String(l.camisola || '').trim();
      if (idx >= 0) {
        // Ficha que já existe: completa o que faltar (posição, clube) e o
        // número, que é o que se escreveu agora.
        const x = scoutingFinal[idx];
        /* Características: numa ficha que já estava ligada a este
           adversário, o texto do formulário É o da ficha (foi de lá que
           veio) — substitui. Numa ficha que só agora se liga pelo nome, o
           que se escreveu aqui junta-se ao que já lá estava, sem apagar. */
        const textoNovo = String(l.caracteristicas || '').trim();
        const textoAtual = String(x.traits || '').trim();
        const jaLigada = l.localId === x.id;
        let traits = x.traits;
        if (jaLigada) { if (textoNovo !== textoAtual) traits = textoNovo; }
        else if (textoNovo && textoNovo !== textoAtual && !textoAtual.includes(textoNovo)) traits = textoAtual ? `${textoAtual}\n\n${textoNovo}` : textoNovo;
        const novaX = {
          ...x,
          ...(!x.position && l.posicao ? { position: l.posicao } : {}),
          ...(!x.club && clube ? { club: clube } : {}),
          ...(camisola !== String(x.camisola || '') ? { camisola } : {}),
          ...(l.pe && l.pe !== x.dominantFoot ? { dominantFoot: l.pe } : {}),
          ...(traits !== x.traits ? { traits } : {}),
        };
        if (Object.keys(novaX).some(k => novaX[k] !== x[k])) scoutingFinal[idx] = novaX;
        idFinal = x.id;
      } else {
        // Ficha nova no Scouting: o clube é este adversário.
        const novo = {
          id: uid(), name: nome, position: l.posicao || '', club: clube, camisola,
          ...(l.pe ? { dominantFoot: l.pe } : {}),
          ...(String(l.caracteristicas || '').trim() ? { traits: String(l.caracteristicas).trim() } : {}),
        };
        scoutingFinal.push(novo);
        idFinal = novo.id;
      }
      jogadoresChaveIds.push(idFinal);
      idFinalPorLocalId[l.localId] = idFinal;
    });
    if (scoutingFinal.length !== scouting.length || scoutingFinal.some((x, i) => x !== scouting[i])) setScouting(scoutingFinal);

    const quadroOverrides = {};
    Object.entries(quadroOverridesLocal || {}).forEach(([localId, lugarId]) => {
      const idFinal = idFinalPorLocalId[localId];
      if (idFinal) quadroOverrides[idFinal] = lugarId;
    });

    const registo = { ...dados, jogadoresChaveIds, quadroTatica, quadroOverrides };
    if (fichaRepetida(registo.nome, adversarios, registo.id)) return; // o formulário já avisa
    if (registo.id) {
      setAdversarios(prev => prev.map(a => (a.id === registo.id ? registo : a)));
      if (viewing && viewing.id === registo.id) setViewing(registo);
    } else {
      registo.id = uid();
      setAdversarios(prev => [...prev, registo]);
    }
    fecharEdicao();
  };
  const remove = (id) => {
    const a = adversarios.find(x => x.id === id);
    removeWithUndo(adversarios, setAdversarios, id, itemLabel(a, 'Adversário'));
    setViewing(null);
    setEditando(null);
  };

  if (editando) {
    return (
      <>
        <AdversarioForm
          adversario={editando === 'new' ? null : editando}
          scouting={scouting}
          adversarios={adversarios}
          onBack={fecharEdicao}
          onSave={save}
          onAbrirExistente={(a) => { fecharEdicao(); setViewing(a); }}
        />
        {printAdversario && createPortal(
          <FolhaImpressaoAdversario adversario={printAdversario} chave={chaveDe(printAdversario)} />,
          document.body
        )}
      </>
    );
  }

  if (viewing) {
    const atual = adversarios.find(a => a.id === viewing.id) || viewing;
    return (
      <>
        <AdversarioPage
          adversario={atual} scouting={scouting} videos={videos} setVideos={setVideos}
          onBack={fecharFicha}
          onEdit={() => setEditando(atual)}
          onRemove={() => remove(atual.id)}
          onShare={() => doShare(atual)}
          onPrint={() => doPrint(atual)}
          onUpdate={(patch) => {
            const registo = { ...atual, ...patch };
            setAdversarios(prev => prev.map(a => (a.id === atual.id ? registo : a)));
            setViewing(registo);
          }}
        />
        {printAdversario && createPortal(
          <FolhaImpressaoAdversario adversario={printAdversario} chave={chaveDe(printAdversario)} />,
          document.body
        )}
      </>
    );
  }

  return (
    <div>
      {adversarios.length === 0 ? (
        <EmptyState text="Ainda sem adversários registados." action={<Btn onClick={() => setEditando('new')}><Plus size={15} /> Adicionar o primeiro</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {adversarios.map(a => {
            const cor = corDoClube(a.cor);
            const botao = { background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 6 };
            return (
            /* CARTÃO DE ADVERSÁRIO — um "escudo" com as iniciais do clube,
               na cor do clube (escolhida na ficha; cinzento se não tiver),
               e o nome inteiro numa linha. As ações passam para uma
               faixa por baixo, para não roubarem espaço ao nome. */
            <div key={a.id} onClick={() => setViewing(a)} title="Ver ficha do adversário" style={{
              position: 'relative', overflow: 'hidden', cursor: 'pointer',
              background: `linear-gradient(135deg, ${corDoClube(a.cor, 0.16)} 0%, ${T.surface} 55%)`,
              border: `1px solid ${T.line}`, borderRadius: 12,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: cor }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px 14px 20px' }}>
                <div aria-hidden="true" style={{
                  width: 44, height: 50, flexShrink: 0,
                  clipPath: 'polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)',
                  background: `linear-gradient(160deg, ${cor} 0%, ${corDoClube(a.cor, 0.7)} 100%)`,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 11, boxSizing: 'border-box',
                  color: textoSobreCor(a.cor), ...display, fontSize: 17, fontWeight: 700, letterSpacing: 0.5,
                }}>{iniciaisDoClube(a.nome)}</div>
                <div title={a.nome} style={{
                  flex: 1, minWidth: 0, color: T.cream, ...display, fontSize: 19, fontWeight: 600, letterSpacing: 0.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{a.nome || 'Adversário sem nome'}</div>
              </div>
              <div onClick={e => e.stopPropagation()} style={{
                display: 'flex', alignItems: 'center', gap: 2, padding: '4px 10px 6px 16px', marginTop: 'auto',
                borderTop: `1px solid ${T.line}`, cursor: 'default',
              }}>
                <button
                  onClick={() => setAdversarios(prev => prev.map(x => (x.id === a.id ? { ...x, visivelAtletas: !x.visivelAtletas } : x)))}
                  title={a.visivelAtletas ? 'Visível no Portal do Atleta. Clicar para esconder' : 'Tornar visível no Portal do Atleta'}
                  style={{ ...botao, gap: 6, alignItems: 'center', color: a.visivelAtletas ? T.gold : T.mutedDim, fontSize: 11.5, ...body }}
                >{a.visivelAtletas ? <Eye size={14} /> : <EyeOff size={14} />} {a.visivelAtletas ? 'No Portal' : 'Só staff'}</button>
                <span style={{ flex: 1 }} />
                <button onClick={() => doShare(a)} title="Partilhar ficha do adversário" style={botao}><Share2 size={14} /></button>
                <button onClick={() => doPrint(a)} title="Imprimir ficha do adversário" style={botao}><Printer size={14} /></button>
                <button onClick={() => setEditando(a)} title="Editar adversário" style={botao}><Pencil size={14} /></button>
                <button onClick={() => remove(a.id)} title="Apagar adversário" style={botao}><Trash2 size={14} /></button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {printAdversario && createPortal(
        <FolhaImpressaoAdversario adversario={printAdversario} chave={chaveDe(printAdversario)} />,
        document.body
      )}
    </div>
  );
}

/* A FOLHA DE IMPRESSÃO É PARTILHADA PELOS TRÊS RAMOS (lista, ficha,
   formulário) — antes só vivia no ramo da lista, e imprimir a partir
   da ficha (o botão mais usado) mandava a app para `window.print()`
   sem NADA de classe `print-sheet` montado, porque esse ramo nunca
   chegava a desenhar-se: `AdversariosApp` devolvia a ficha e parava
   ali. Saía sempre em branco. */
export function FolhaImpressaoAdversario({ adversario: printAdversario, chave: chaveDe }) {
  return (
    <div className="print-sheet">
      <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>{printAdversario.nome || 'Adversário'}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5 }}>
        {[printAdversario.escalao, printAdversario.prova, printAdversario.quadroTatica].filter(Boolean).join(' · ')}
      </p>
      {printAdversario.quadroTatica && (
        <>
          <h3 style={{ fontSize: 14, margin: '0 0 8px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Estrutura habitual</h3>
          <div style={{ marginBottom: 14 }}>
            <PrancheteDoPlantel
              lugares={distribuirPlantel({
                players: chaveDe, attendance: chaveDe.map(x => x.id),
                overrides: printAdversario.quadroOverrides, tatica: printAdversario.quadroTatica,
              })}
              maxLargura={480}
              cor={printAdversario.cor}
            />
          </div>
        </>
      )}
      {printAdversario.pontosFortes && (
        <>
          <h3 style={{ fontSize: 14, margin: '0 0 4px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Pontos fortes</h3>
          <p style={{ fontSize: 12.5, margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{printAdversario.pontosFortes}</p>
        </>
      )}
      {printAdversario.pontosFracos && (
        <>
          <h3 style={{ fontSize: 14, margin: '0 0 4px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Pontos fracos</h3>
          <p style={{ fontSize: 12.5, margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{printAdversario.pontosFracos}</p>
        </>
      )}
      {chaveDe.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: '0 0 6px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Jogadores-chave</h3>
          <ul style={{ fontSize: 12.5, margin: 0, paddingLeft: 18 }}>
            {chaveDe.map(x => (
              <li key={x.id}>{x.name}{x.position ? ` — ${x.position}` : ''}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function AdversarioPage({ adversario: a, scouting, videos, setVideos, onBack, onEdit, onRemove, onShare, onPrint, onUpdate }) {
  const chave = (scouting || []).filter(x => (a.jogadoresChaveIds || []).includes(x.id));
  const taticas = a.taticas || [];
  const [taticaModal, setTaticaModal] = useState(null); // null | 'new' | tática a editar
  const [taticaModalVoltarViewing, setTaticaModalVoltarViewing] = useState(false); // true só quando abriu a partir da pré-visualização
  const [taticaViewing, setTaticaViewing] = useState(null);
  /* A fatia dos vídeos DESTE adversário — qualquer vídeo criado aqui
     dentro (pelo MediaLibrary, que não sabe nada de adversários) fica
     automaticamente marcado com o `adversarioId` certo, sem aparecer no
     Canal geral da Biblioteca. Ver `useSubColecao`. */
  const [videosDoAdversario, setVideosDoAdversarioBase] = useSubColecao(videos, setVideos, v => v.adversarioId === a.id);
  const setVideosDoAdversario = (novoOuFn) => {
    setVideosDoAdversarioBase(prev => {
      const novo = typeof novoOuFn === 'function' ? novoOuFn(prev) : novoOuFn;
      return novo.map(v => (v.adversarioId ? v : { ...v, adversarioId: a.id }));
    });
  };

  const labelTatica = (t) => (t.nome && t.nome.trim()) ? t.nome.trim() : `Dinâmica ${taticas.indexOf(t) + 1}`;
  const saveTatica = (dados) => {
    const isEdicao = !!dados.id;
    if (isEdicao) onUpdate({ taticas: taticas.map(t => (t.id === dados.id ? dados : t)) });
    else onUpdate({ taticas: [...taticas, { ...dados, id: uid() }] });
    if (isEdicao && taticaModalVoltarViewing) trocarJanela(() => setTaticaModal(null), () => setTaticaViewing(dados));
    else setTaticaModal(null);
  };
  const removeTatica = (id) => onUpdate({ taticas: taticas.filter(t => t.id !== id) });

  const bloco = (titulo, texto) => texto && (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{titulo}</div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: T.cream, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{texto}</div>
    </div>
  );

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Adversários
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ ...display, fontSize: 20, color: T.cream }}>{a.nome}</div>
        <div style={{ color: T.mutedDim, fontSize: 12.5, marginTop: 4 }}>
          {[a.escalao, a.prova, a.quadroTatica].filter(Boolean).join(' · ') || 'Sem detalhes ainda'}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          {onShare && <button onClick={onShare} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: 0 }}><Share2 size={15} /> Partilhar</button>}
          {onPrint && <button onClick={onPrint} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: 0 }}><Printer size={15} /> Imprimir</button>}
          <button onClick={onEdit} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: 0 }}><Pencil size={15} /> Editar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* ESTRUTURA HABITUAL — o mesmo quadro montado na edição, aqui só
            para consulta — nada para tocar. Ajusta-se em "Editar". `tela`:
            isto é para ver no ecrã, não para imprimir — sem isso, o
            quadro saía com o fundo branco pensado para papel, destoando
            do resto da página escura. */}
        <div>
          <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Estrutura habitual</div>
          {!a.quadroTatica ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim }}>
              Escolhe uma formação para veres aqui a estrutura provável.
            </div>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
              <PrancheteDoPlantel
                lugares={distribuirPlantel({
                  players: chave, attendance: chave.map(x => x.id), overrides: a.quadroOverrides, tatica: a.quadroTatica,
                })}
                escala={1.25}
                maxLargura={900}
                tela
                cor={a.cor}
              />
            </div>
          )}
        </div>

        <div>
          {bloco('Pontos fortes', a.pontosFortes)}
          {bloco('Pontos fracos', a.pontosFracos)}

          {/* JOGADORES-CHAVE */}
          <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Jogadores-chave
          </div>
          {chave.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>
              Nenhum jogador-chave marcado ainda. Toca em "Editar" para os acrescentar.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
              {chave.map(x => (
                <div key={x.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ color: T.cream, fontWeight: 500, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.camisola ? <span style={{ color: '#E84A5F', fontWeight: 800, marginRight: 6, ...mono }}>{x.camisola}</span> : null}{x.name}
                  </div>
                  <div style={{ color: T.mutedDim, fontSize: 11.5, marginTop: 2 }}>{x.position || ''}{x.club ? ` · ${x.club}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!a.pontosFortes && !a.pontosFracos && (
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>
          Ainda sem notas de análise. Toca em "Editar" para as acrescentar.
        </div>
      )}

      {/* TÁTICAS — o mesmo editor de prancheta e a mesma apresentação
          animada da Ideia de Jogo (`DiagramEditor`, `ExercisePresentation`),
          só que aqui o que se desenha é o que O ADVERSÁRIO faz — a saída
          de bola dele, o pressing, uma bola parada que sofreram — não o
          nosso plano. Nada de motor novo, só outro propósito. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
        <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em' }}>Dinâmicas</div>
        <Btn variant="ghost" onClick={() => { setTaticaModalVoltarViewing(false); setTaticaModal('new'); }}><Plus size={14} /> Adicionar dinâmica</Btn>
      </div>
      {taticas.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>
          Ainda sem dinâmicas registadas para este adversário.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          {taticas.map(t => (
            <div key={t.id} onClick={() => setTaticaViewing(t)} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
              <div style={{ color: T.cream, fontWeight: 500, fontSize: 13.5, marginBottom: 6 }}>{labelTatica(t)}</div>
              {t.phase && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-block', fontSize: 10.5, color: T.warn, background: `${T.crimson}55`, padding: '2px 8px', borderRadius: 12 }}>{t.phase}</span>
                </div>
              )}
              <DiagramThumb diagram={t.diagram} />
              <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'flex-end' }}>
                <button onClick={(e) => { e.stopPropagation(); setTaticaModalVoltarViewing(false); setTaticaModal(t); }} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Pencil size={13} /></button>
                <button onClick={(e) => { e.stopPropagation(); removeTatica(t.id); }} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {taticaModal && (
        <TaticaAdversarioModal
          tatica={taticaModal === 'new' ? null : taticaModal}
          onClose={() => (taticaModalVoltarViewing ? trocarJanela(() => setTaticaModal(null), () => setTaticaViewing(taticaModal)) : setTaticaModal(null))}
          onSave={saveTatica}
        />
      )}
      {taticaViewing && (
        <ExercisePresentation
          exercise={{ ...taticaViewing, name: labelTatica(taticaViewing) }}
          onClose={() => setTaticaViewing(null)}
          onEdit={() => { setTaticaModalVoltarViewing(true); trocarJanela(() => setTaticaViewing(null), () => setTaticaModal(taticaViewing)); }}
        />
      )}

      {/* VÍDEOS — a mesma Biblioteca (Canal), com a mesma forma de
          adicionar (colar link do YouTube/Instagram/TikTok, ou carregar
          um ficheiro) — só que filtrada a este adversário, e sem
          aparecer no Canal geral da equipa. */}
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>
        Vídeos
      </div>
      <MediaLibrary
        items={videosDoAdversario} setItems={setVideosDoAdversario}
        addLabel="Adicionar vídeo"
        addButtonVariant="ghost"
        semCatalogo
        emptyText="Ainda sem vídeos deste adversário. Cola o link do YouTube, Instagram, TikTok ou Facebook, ou carrega um ficheiro."
        emptyFirstLabel="Adicionar o primeiro vídeo"
      />
    </div>
  );
}

export function TaticaAdversarioModal({ tatica, onClose, onSave }) {
  const [f, setF] = useState(tatica || { nome: '', phase: EXERCISE_PHASES[0], diagram: { elements: [], arrows: [] } });
  const [diagramColor, setDiagramColor] = useState('A');
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_dinamica_${tatica?.id || 'novo'}`, f, setF);

  return (
    <Modal title={tatica ? 'Editar dinâmica' : 'Nova dinâmica'} onClose={onClose} wide xwide fullPage>
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      <div style={{ marginBottom: 12 }}>
        <Field label="Nome"><Input value={f.nome || ''} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex: Saída de bola a 3, pressing alto" /></Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Momento de jogo">
          <Select value={f.phase} onChange={e => setF({ ...f, phase: e.target.value })}>
            {EXERCISE_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Esquema tático" bloco>
          <DiagramEditor
            value={f.diagram || { elements: [], arrows: [] }}
            onChange={d => setF(prev => ({ ...prev, diagram: d }))}
            exerciseInfo={{ name: f.nome, phase: f.phase }}
            activeColor={diagramColor}
            onColorChange={setDiagramColor}
          />
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={() => { limpar(); onSave(f); }}>Guardar</Btn>
      </div>
    </Modal>
  );
}

/* Formulário de página inteira — cria/edita o adversário e, na mesma
   página, os jogadores-chave (nome + posição). Um nome que já exista
   em "Jogadores" (comparado sem maiúsculas/minúsculas) liga-se a essa
   ficha ao Guardar; um nome novo cria lá uma ficha nova, só com nome e
   posição — NUNCA antes disso, só no momento de guardar. */
export function AdversarioForm({ adversario, scouting, adversarios, onBack, onSave, onAbrirExistente }) {
  const [f, setF] = useState(adversario || { nome: '', escalao: '', prova: '', pontosFortes: '', pontosFracos: '', notas: '' });
  const [linhas, setLinhas] = useState(() => {
    const iniciais = ((adversario && adversario.jogadoresChaveIds) || [])
      .map(id => scouting.find(x => x.id === id))
      .filter(Boolean)
      // O id real da ficha já existente serve logo como `localId` — é
      // estável e não muda ao guardar, ao contrário de uma linha nova.
      .map(x => ({ localId: x.id, nome: x.name || '', posicao: x.position || '', camisola: x.camisola || '', pe: x.dominantFoot || '', caracteristicas: x.traits || '' }));
    return iniciais.length ? iniciais : [{ localId: uid(), nome: '', posicao: '', camisola: '', pe: '', caracteristicas: '' }];
  });
  // O quadro de posições precisa de UM id por jogador para arrumar os
  // "mexidos à mão" — mas os jogadores-chave só ganham um id real (o da
  // ficha em "Jogadores") ao Guardar. Por isso usa-se aqui um `localId`
  // próprio, só desta sessão de edição; ao guardar, `onSave` troca essas
  // chaves locais pelos ids reais — ver `AdversariosApp.save`.
  const [quadroTatica, setQuadroTatica] = useState((adversario && adversario.quadroTatica) || TATICA_OMISSAO);
  const [quadroOverrides, setQuadroOverrides] = useState(() => {
    if (!adversario || !adversario.quadroOverrides) return {};
    // Reconstrói as chaves locais a partir dos ids reais gravados — os
    // localId das linhas iniciais SÃO esses ids reais (ver em cima).
    return adversario.quadroOverrides;
  });
  // Já há ficha para esta equipa? Então não se cria outra (ver fichaRepetida).
  const repetida = fichaRepetida(f.nome, adversarios, adversario && adversario.id);
  const valido = String(f.nome || '').trim().length > 0 && !repetida;

  const nomesExistentes = (scouting || []).map(x => x.name).filter(Boolean);
  const atualizarLinha = (i, campo, valor) => setLinhas(linhas.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  const removerLinha = (i) => setLinhas(linhas.filter((_, idx) => idx !== i));

  const guardar = () => {
    if (!valido) return;
    onSave(f, linhas, quadroTatica, quadroOverrides);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Adversários
      </button>

      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 20 }}>
        {adversario ? 'Editar adversário' : 'Novo adversário'}
      </div>

      <div style={{ marginBottom: 14 }}>
        <Field label="Clube / Equipa" bloco solto>
          <Input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex: FC Padroense" autoFocus />
        </Field>
        {repetida && (
          <div style={{ marginTop: 8, padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.warn}66`, background: `${T.warn}14`, fontSize: 12.5, color: T.cream, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 220px' }}>Já existe uma ficha para esta equipa: <strong>{repetida.nome}</strong>.</span>
            {onAbrirExistente && (
              <button type="button" onClick={() => onAbrirExistente(repetida)} style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, ...body, padding: 0 }}>Abrir essa ficha</button>
            )}
          </div>
        )}
      </div>
      <div style={{ marginBottom: 14 }}>
        <Field label="Cor do clube" bloco solto>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {CORES_CLUBE.map(c => {
              const on = (f.cor || '').toLowerCase() === c.cor.toLowerCase();
              return (
                <button key={c.cor} type="button" onClick={() => setF({ ...f, cor: c.cor })} title={c.nome} aria-label={c.nome} aria-pressed={on}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c.cor, cursor: 'pointer', padding: 0,
                    border: on ? `2px solid ${T.cream}` : `1px solid ${T.line}`, boxShadow: on ? `0 0 0 2px ${T.bg} inset` : 'none',
                  }} />
              );
            })}
            {/* Outra cor qualquer, no seletor do sistema. */}
            <label title="Outra cor" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.muted, cursor: 'pointer', ...body }}>
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(f.cor || '') ? f.cor : COR_CLUBE_OMISSAO}
                onChange={e => setF({ ...f, cor: e.target.value })}
                style={{ width: 32, height: 28, padding: 0, border: `1px solid ${T.line}`, borderRadius: 6, background: 'transparent', cursor: 'pointer' }} />
              Outra
            </label>
            {f.cor && (
              <button type="button" onClick={() => setF({ ...f, cor: '' })}
                style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', ...body }}>
                Sem cor
              </button>
            )}
          </div>
        </Field>
      </div>
      <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
        <Field label="Escalão">
          <Input value={f.escalao} onChange={e => setF({ ...f, escalao: e.target.value })} placeholder="Ex: Sub-19" />
        </Field>
        <Field label="Prova">
          <Input value={f.prova} onChange={e => setF({ ...f, prova: e.target.value })} placeholder="Ex: Campeonato Distrital" />
        </Field>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Field label="Pontos fortes" bloco solto>
          <TextArea value={f.pontosFortes} onChange={e => setF({ ...f, pontosFortes: e.target.value })} style={{ minHeight: 64 }} />
        </Field>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Field label="Pontos fracos" bloco solto>
          <TextArea value={f.pontosFracos} onChange={e => setF({ ...f, pontosFracos: e.target.value })} style={{ minHeight: 64 }} />
        </Field>
      </div>

      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
        Jogadores-chave
      </div>
      <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 12, lineHeight: 1.5 }}>
        Um nome que já exista em "Jogadores" liga-se a essa ficha; um nome novo cria lá uma ficha com nome, número,
        posição e o clube (este adversário). O pé dominante e as características que escreveres aqui ficam também
        na ficha do jogador.
      </div>
      <datalist id="jogadores-scouting-existentes">
        {nomesExistentes.map(nome => <option key={nome} value={nome} />)}
      </datalist>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {linhas.map((l, i) => (
          <div key={l.localId} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, background: T.surface }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Nº da camisola — aparece no campo, à frente do nome. */}
            <Input
              type="number" inputMode="numeric" min={1} max={99} value={l.camisola || ''}
              onChange={e => atualizarLinha(i, 'camisola', e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="Nº" title="Número da camisola" style={{ width: 58, flexShrink: 0, textAlign: 'center' }}
            />
            <Input
              list="jogadores-scouting-existentes" value={l.nome} onChange={e => atualizarLinha(i, 'nome', e.target.value)}
              placeholder="Nome do jogador" style={{ flex: 2, minWidth: 0 }}
            />
            <Select value={l.posicao} onChange={e => atualizarLinha(i, 'posicao', e.target.value)} style={{ flex: 1, minWidth: 90 }}>
              <option value="">Posição</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            <button onClick={() => removerLinha(i)} title="Remover esta linha" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
          {/* O QUE SE OBSERVOU DO JOGADOR — vai direto para a ficha dele em
              "Jogadores" (Pé dominante e Características), ao Guardar. Numa
              ficha que já existia, o texto que aparece aqui É o da ficha:
              editar aqui é editar lá. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Select value={l.pe || ''} onChange={e => atualizarLinha(i, 'pe', e.target.value)} title="Pé dominante" style={{ width: 150, flexShrink: 0 }}>
              <option value="">Pé dominante</option>
              {DOMINANT_FEET.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            <TextArea
              value={l.caracteristicas || ''} onChange={e => atualizarLinha(i, 'caracteristicas', e.target.value)}
              placeholder="Características: perfil físico, com bola, sem bola, pontos fortes/fracos... (fica na ficha do jogador)"
              style={{ flex: '1 1 260px', minHeight: 64 }}
            />
          </div>
          </div>
        ))}
      </div>
      <Btn variant="ghost" onClick={() => setLinhas([...linhas, { localId: uid(), nome: '', posicao: '', camisola: '', pe: '', caracteristicas: '' }])}>
        <Plus size={14} /> Adicionar jogador-chave
      </Btn>

      {/* ESTRUTURA HABITUAL — o mesmo quadro de posições do plantel, só que
          aqui arruma os jogadores-chave escritos em cima, não o nosso
          plantel. Como nenhum deles ainda tem uma ficha gravada (isso só
          acontece ao Guardar), usa-se o `localId` de cada linha como se
          fosse o id do jogador — o `EditorPrancheta` nem sabe que está a
          lidar com fichas por criar. A dropdown da tática AQUI é que
          define a estrutura habitual do adversário — deixou de haver um
          campo de texto à parte para não haver duas fontes da mesma
          informação, sempre a poderem dizer coisas diferentes. */}
      <div style={{ marginTop: 24 }}>
        <EditorPrancheta
          titulo="Estrutura habitual"
          players={linhas.filter(l => l.nome.trim()).map(l => ({ id: l.localId, name: l.nome.trim(), position: l.posicao, camisola: l.camisola }))}
          attendance={linhas.filter(l => l.nome.trim()).map(l => l.localId)}
          convidados={[]}
          overrides={quadroOverrides}
          tatica={quadroTatica}
          onChange={setQuadroOverrides}
          onTatica={setQuadroTatica}
          cor={f.cor}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28, paddingTop: 18, borderTop: `1px solid ${T.line}` }}>
        <Btn variant="ghost" onClick={onBack}>Cancelar</Btn>
        <Btn onClick={guardar} disabled={!valido}>Guardar</Btn>
      </div>
    </div>
  );
}

