// treino/IdeiaModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useRef } from 'react';
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import { temMomento } from '../dominio/treino';
import { uid, todayStr, fmtDate } from '../base/utilidades';
import { Modal, Field, Input, Select, Btn } from '../base/ui';
import { DiagramEditor } from '../tatico/DiagramEditor';
import { T, body, mono } from '../base/tema';
import { Copy, Check } from 'lucide-react';
import { jogoNaoJogado } from '../dominio/estadoJogos';
import { CamposMomento, EXERCISE_PHASES, planoNomeJogo, useFecharSemSaltar } from './comum';
import { EscolherParaCopiar } from './EscolherParaCopiar';

export function IdeiaModal({ ideia, allIdeias = [], meta, onClose, onSave, matches = [], jogoInicial = null }) {
  const [f, setF] = useState(ideia || { name: '', phase: EXERCISE_PHASES[0], diagram: { elements: [], arrows: [] }, ...(jogoInicial ? { jogoId: jogoInicial } : {}) });
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_ideia_${ideia?.id || 'novo'}`, f, setF);
  // Tal como no ExerciseModal, a cor ativa do editor vive aqui (no modal) e
  // não dentro do DiagramEditor, para não poder ser reposta a meio.
  const [diagramColor, setDiagramColor] = useState('A');
  const [importOpen, setImportOpen] = useState(false);
  const [importNotice, setImportNotice] = useState('');

  // Só as da mesma fase de jogo que está escolhida aqui.
  const importable = allIdeias.filter(x => x && x.id !== (ideia && ideia.id) && x.diagram && temMomento(x, f.phase));
  const [fecharSemSaltar, espacoSemSaltar] = useFecharSemSaltar();
  const botaoCopiarRef = useRef(null);
  const alternarCopiar = () => {
    setImportNotice('');
    if (importOpen) fecharSemSaltar(botaoCopiarRef.current, () => setImportOpen(false));
    else setImportOpen(true);
  };
  const nomeIdeia = (x) => (x.name && x.name.trim()) || `Ideia ${allIdeias.findIndex(i => i.id === x.id) + 1}`;
  const desenhoAtualIdeia = !!(f.diagram && ((f.diagram.elements || []).length || (f.diagram.arrows || []).length));

  // Copia a fase e o esquema tático de outra ideia já criada. Cópia
  // profunda com ids novos, para editar aqui nunca mexer no original; a
  // animação gravada não vem junto — os ícones entram nas posições finais
  // e a coreografia recomeça a partir daqui (mesma regra dos exercícios).
  const importFromIdeia = (src, label) => {
    const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
    const srcDiagram = clone(src.diagram) || { elements: [], arrows: [] };
    const idMap = {};
    const remapped = {
      ...srcDiagram,
      elements: (srcDiagram.elements || []).map(el => {
        const nid = uid();
        idMap[el.id] = nid;
        return { ...el, id: nid };
      }),
      arrows: (srcDiagram.arrows || []).map(a => ({
        ...a, id: uid(),
        ...(a.ownerId ? { ownerId: idMap[a.ownerId] || a.ownerId } : {}),
      })),
      sequence: [],
    };
    setF(prev => ({
      ...prev,
      // O nome só é sugerido se ainda estiver vazio, para não apagar sem
      // aviso um título que já tenhas escrito.
      name: (prev.name && prev.name.trim()) ? prev.name : `${label} (cópia)`,
      phase: src.phase || prev.phase,
      phase2: src.phase2 || '',
      diagram: remapped,
    }));
    setImportOpen(false);
    setImportNotice(`Copiado de "${label}". Os jogadores ficam nas posições finais e a animação recomeça a partir daqui.`);
  };

  return (
    <Modal title={ideia ? 'Editar ideia' : 'Nova ideia'} onClose={onClose} wide xwide fullPage larguraMax="92vw">
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      <div style={{ marginBottom: 12 }}>
        <Field label="Nome"><Input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex: Construção a 3 com médio a cair" /></Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <CamposMomento f={f} setF={setF} rotulo="Fase de jogo" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Field label="Esquema tático" bloco>
          <DiagramEditor
            value={f.diagram || { elements: [], arrows: [] }}
            onChange={d => setF(prev => ({ ...prev, diagram: d }))}
            exerciseInfo={{ name: f.name, phase: f.phase, phase2: f.phase2 }}
            activeColor={diagramColor}
            onColorChange={setDiagramColor}
            jogoId={f.jogoId || null}
          />
        </Field>
      </div>

      <div style={{ marginBottom: 16 }}>
        {/* `bloco`: o Field normal é um <label>, e um <label> passa
            qualquer clique "no vazio" lá dentro (fundo da caixa, texto,
            barra de posição…) para o primeiro botão que contém — o
            "Copiar ideia existente". Era isso que fechava a lista a meio
            de uma pesquisa. */}
        <Field label="Partir de uma ideia existente" bloco>
          <button
            ref={botaoCopiarRef}
            type="button"
            onClick={alternarCopiar}
            disabled={importable.length === 0}
            title={importable.length === 0 ? `Ainda não há outras ideias de ${f.phase}.` : 'Copiar o esquema de uma ideia já criada desta fase'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              cursor: importable.length === 0 ? 'not-allowed' : 'pointer',
              padding: '8px 14px', borderRadius: 8,
              border: `1px solid ${importOpen ? T.gold : T.line}`,
              background: importOpen ? `${T.crimson}33` : T.surfaceRaise,
              color: importable.length === 0 ? T.mutedDim : T.cream,
              opacity: importable.length === 0 ? 0.55 : 1,
              fontSize: 13, ...body,
            }}
          >
            <Copy size={14} /> Copiar ideia existente
            <span style={{ ...mono, fontSize: 11.5, opacity: .7 }}>{importable.length}</span>
          </button>
          {importNotice && (
            <div style={{ fontSize: 12, color: T.warn, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} /> {importNotice}
            </div>
          )}
          {importOpen && importable.length > 0 && (
            <EscolherParaCopiar
              key={f.phase}
              itens={importable}
              tipo="ideia"
              fase={f.phase}
              meta={meta}
              nomeDe={nomeIdeia}
              temDesenhoAtual={desenhoAtualIdeia}
              onUsar={(x) => fecharSemSaltar(botaoCopiarRef.current, () => importFromIdeia(x, nomeIdeia(x)))}
            />
          )}
        </Field>
      </div>

      {/* PARTILHADA COM OS ATLETAS — nada fica visível no Portal do
          Atleta por omissão. Só as ideias que o treinador marcar aqui é
          que aparecem lá, exatamente como as fichas de scouting nunca
          saem daqui para fora sem se querer.

          Dois interruptores independentes, não um só: a mesma ideia
          pode interessar ao "Ideia de Jogo" geral, ao "Plano de Jogo"
          dentro de Jogos, aos dois, ou a nenhum — o conteúdo é o
          mesmo, só o SÍTIO onde aparece no Portal é que se escolhe
          aqui, sem duplicar nada. */}
      {/* GERAL ou PARA UM JOGO. Uma ideia para um jogo fica no plano
          desse jogo (Ideia de Jogo › Planos de Jogo) e não aparece na
          Ideia de Jogo geral. O Portal → Plano de Jogo é sempre o plano
          do próximo jogo (escolhido nos Planos, não aqui). */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="Esta ideia é">
          <Select value={f.jogoId || ''} onChange={e => setF({ ...f, jogoId: e.target.value || null, ...(e.target.value ? { visivelAtletas: false } : {}) })}>
            <option value="">Ideia de Jogo geral (identidade da equipa)</option>
            {(() => {
              const hoje = todayStr();
              const jogos = (matches || []).filter(m => m && m.date && (!jogoNaoJogado(m) || m.id === f.jogoId));
              const prox = jogos.filter(m => m.date >= hoje).sort((a, b) => a.date.localeCompare(b.date));
              const pas = jogos.filter(m => m.date < hoje).sort((a, b) => b.date.localeCompare(a.date));
              return [...prox, ...pas].map(m => <option key={m.id} value={m.id}>Para o jogo {planoNomeJogo(m)} · {fmtDate(m.date)}</option>);
            })()}
          </Select>
        </Field>
        {f.jogoId ? (
          <div style={{ fontSize: 12.5, color: T.mutedDim, lineHeight: 1.5 }}>
            Fica no plano deste jogo e não aparece na Ideia de Jogo geral. Os jogadores veem-na no Portal → Plano de Jogo enquanto este for o próximo jogo.
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!f.visivelAtletas}
              onChange={e => setF({ ...f, visivelAtletas: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: T.crimson, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: T.cream }}>Visível no Portal → Ideia de Jogo</span>
          </label>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={!f.name || !f.name.trim()} onClick={() => { limpar(); onSave(f.jogoId ? { ...f, visivelAtletas: false } : f); }}><Check size={15} /> Guardar</Btn>
      </div>
      {espacoSemSaltar}
    </Modal>
  );
}

