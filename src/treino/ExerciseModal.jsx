// treino/ExerciseModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useIsMobile, Modal, FIELD_GRID, FIELD_FULL, Field, Input, TextArea, Btn } from '../base/ui';
import { useState, useRef } from 'react';
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import { temMomento } from '../dominio/treino';
import { uid } from '../base/utilidades';
import { ficheiroParaAnexo } from '../base/anexos';
import { parsePlayersCount, TEAMS, nextKeeperNumber } from '../tatico/campo';
import { DiagramEditor } from '../tatico/DiagramEditor';
import { T, body, mono } from '../base/tema';
import { Upload, Copy, BookOpen, X, Check } from 'lucide-react';
import { CamposMomento, PHASES, TempoInput, useFecharSemSaltar } from './comum';
import { autoPositions, describeSpaceZones, layoutSpaceZones, parseNamedSpace, parseSpace, parseSpaceCount } from './diagramas';
import { EscolherParaCopiar } from './EscolherParaCopiar';

export function ExerciseModal({ exercise, allExercises = [], meta, onClose, onSave }) {
  const ecraEstreito = useIsMobile();
  const [f, setF] = useState(exercise || { name: '', phase: PHASES[0], description: '', space: '', playersCount: '', material: '', defaultDuration: 15, diagram: { elements: [], arrows: [] }, attachment: null });
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_exercicio_${exercise?.id || 'novo'}`, f, setF);
  // A cor ativa do editor tático vive aqui (no modal, que não é recriado
  // durante a edição) e não dentro do DiagramEditor, para nunca poder ser
  // reposta para o valor por omissão a meio da colocação de jogadores.
  const [diagramColor, setDiagramColor] = useState('A');
  const [attachError, setAttachError] = useState('');
  const [aCarregarAnexo, setACarregarAnexo] = useState(false);
  // Importar de um exercício já existente na biblioteca.
  const [importOpen, setImportOpen] = useState(false);
  const [importNotice, setImportNotice] = useState('');

  // Só faz sentido copiar de outros exercícios — nunca do próprio.
  // ... e só os da mesma fase de jogo que está escolhida aqui.
  const importable = allExercises.filter(x => x && !x.arquivado && x.id !== (exercise && exercise.id) && x.name && temMomento(x, f.phase));
  const [fecharSemSaltar, espacoSemSaltar] = useFecharSemSaltar();
  const botaoCopiarRef = useRef(null);
  const alternarCopiar = () => {
    setImportNotice('');
    if (importOpen) fecharSemSaltar(botaoCopiarRef.current, () => setImportOpen(false));
    else setImportOpen(true);
  };
  const detalhesExercicio = (x) => [x.space && `📐 ${x.space}`, x.playersCount && `👥 ${x.playersCount}`, x.defaultDuration && `⏱ ${x.defaultDuration}'`, x.material].filter(Boolean);
  const desenhoAtualExercicio = !!(f.diagram && ((f.diagram.elements || []).length || (f.diagram.arrows || []).length));

  // Copia TODA a informação do exercício escolhido para este formulário:
  // fase, descrição, espaço, nº de jogadores, material, duração, esquema
  // tático (incluindo animação gravada) e anexo. Cópia profunda + ids novos
  // nos elementos do desenho, para que editar aqui nunca mexa no original.
  const importFromExercise = (src) => {
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
      // A coreografia gravada no exercício de origem NÃO vem junto: os
      // ícones entram nas posições finais em que ficaram, e a animação
      // recomeça daqui. É o que se pretende ao partir de um exercício já
      // feito — continuar a partir daquele momento, e não repetir os
      // movimentos que já tinham sido gravados lá.
      sequence: [],
    };
    setF(prev => ({
      ...prev,
      // O nome só é preenchido se ainda estiver vazio, para não apagar sem
      // aviso um título que já tenhas escrito.
      name: prev.name && prev.name.trim() ? prev.name : `${src.name} (cópia)`,
      phase: src.phase || prev.phase,
      phase2: src.phase2 || '',
      description: src.description || '',
      space: src.space || '',
      playersCount: src.playersCount || '',
      material: src.material || '',
      defaultDuration: src.defaultDuration ?? prev.defaultDuration,
      diagram: remapped,
      attachment: clone(src.attachment) || null,
    }));
    setImportOpen(false);
    setImportNotice(`Copiado de "${src.name}". Os jogadores ficam nas posições finais e a animação recomeça a partir daqui.`);
  };

  const handleAttachmentFile = async (file) => {
    setAttachError('');
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      setAttachError('Só são aceites imagens ou ficheiros PDF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAttachError('Ficheiro demasiado grande (máx. 8 MB).');
      return;
    }
    setACarregarAnexo(true);
    try {
      const { campos } = await ficheiroParaAnexo(file, { pasta: 'exercicios' });
      setF(prev => ({ ...prev, attachment: { name: file.name, type: isPdf ? 'pdf' : 'image', ...campos } }));
    } finally {
      setACarregarAnexo(false);
    }
  };

  const autoInsertPlayers = () => {
    setF(prev => {
      const diagram = prev.diagram || { elements: [], arrows: [] };
      const els = diagram.elements || [];
      const hasPlayers = els.some(e => e.kind === 'player' || e.kind === 'keeper');
      if (hasPlayers) return prev; // nunca substitui o que já foi colocado manualmente
      const parsed = parsePlayersCount(prev.playersCount);
      if (!parsed || !parsed.groups.length) return prev;
      const newEls = [];
      const laneCount = parsed.groups.length;
      let keeperSide = 0;
      parsed.groups.forEach((g, i) => {
        const team = g.team || TEAMS[i % TEAMS.length].id;
        if (g.isKeeper) {
          for (let k = 0; k < g.count; k++) {
            const x = keeperSide % 2 === 0 ? 6 : 94;
            const y = 32.5 + Math.floor(keeperSide / 2) * 9 - (Math.ceil(g.count / 2) - 1) * 4.5;
            newEls.push({ id: uid(), kind: 'keeper', team, number: nextKeeperNumber([...els, ...newEls], team), x, y });
            keeperSide++;
          }
          return;
        }
        const positions = autoPositions(g.count, i, laneCount);
        positions.forEach((p, k) => newEls.push({ id: uid(), kind: 'player', team, number: k + 2, x: p.x, y: p.y }));
      });
      return { ...prev, diagram: { ...diagram, elements: [...els, ...newEls] } };
    });
  };

  const handleClearAll = () => {
    setF(prev => ({ ...prev, space: '', playersCount: '' }));
  };
  // Sempre que uma zona é arrastada, redimensionada, criada (ferramenta
  // "quadrado") ou apagada diretamente no campo, atualiza o texto do campo
  // Espaço para refletir o que lá está — "WxH" ou "WxH (N)" se forem várias
  // iguais, "Vários reduzidos" se tiverem tamanhos diferentes.
  const handleSpaceZonesChange = (zones) => {
    setF(prev => ({ ...prev, space: describeSpaceZones(zones) }));
  };
  // Ao sair do campo Espaço, interpreta o texto escrito ("20x20",
  // "20x20 (2)") e (re)gera as zonas no campo — substitui as que lá
  // estivessem, para o campo de texto continuar a ser a forma rápida de
  // definir quantas zonas e de que tamanho. Se o texto não for uma medida
  // reconhecível (por exemplo já está a mostrar "Vários reduzidos", gerado
  // automaticamente a partir de zonas desenhadas à mão), não mexe nas
  // zonas — evita apagar por engano um layout feito à mão no campo.
  const applySpaceText = () => {
    const text = f.space.trim();
    if (!text) {
      setF(prev => ({ ...prev, diagram: { ...(prev.diagram || {}), spaceZones: [], spaceOffset: undefined } }));
      return;
    }

    /* Espaços com nome ("1/4", "grande área", "meio campo") têm posição
       própria e são tratados à parte. Sem este ramo, ao sair do campo o
       texto era convertido em medidas e a zona passava pelo
       layoutSpaceZones, que centra tudo no meio-campo — ou seja, o
       tracejado saltava da baliza para o centro e o nome desaparecia.
       O texto é normalizado para o nome completo ("1/4" → "1/4 de
       campo"), para ficar igual escreva-se como se escrever. */
    const named = parseNamedSpace(text);
    if (named) {
      setF(prev => ({
        ...prev,
        space: named.label,
        diagram: {
          ...(prev.diagram || {}),
          // "Campo inteiro" não desenha zona nenhuma: o campo já é a zona.
          spaceZones: named.fullPitch
            ? []
            : [{ id: uid(), w: named.w, h: named.h, dx: named.dx, dy: named.dy, label: named.label }],
          spaceOffset: undefined,
        },
      }));
      return;
    }

    const meters = parseSpace(text);
    if (!meters) return;
    const count = parseSpaceCount(text);
    const newZones = layoutSpaceZones(meters.w, meters.h, count);
    setF(prev => ({ ...prev, space: describeSpaceZones(newZones), diagram: { ...(prev.diagram || {}), spaceZones: newZones, spaceOffset: undefined } }));
  };

  return (
    <Modal title={exercise ? 'Editar exercício' : 'Novo exercício'} onClose={onClose} wide xwide fullPage larguraMax="92vw">
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      <div style={{ ...FIELD_GRID, marginBottom: 16 }}>
        <div style={FIELD_FULL}>
          <Field label="Nome"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex: Jogo posicional 5v5+3" /></Field>
        </div>
        {/* "Momento" (era "Fase de jogo") e com duas colunas de largura:
            "Organização Defensiva" ficava cortado na caixa. */}
        {/* No computador, Momento, 2.º momento, Tempo, Espaço, Nº jogadores
            e Material numa só linha (os dois momentos um pouco mais largos,
            para "Organização Defensiva" caber). No telemóvel, a grelha de
            sempre. */}
        <div style={ecraEstreito ? { ...FIELD_FULL, ...FIELD_GRID } : { ...FIELD_FULL, display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.4fr) repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <CamposMomento f={f} setF={setF} celula={{ minWidth: 0, ...(ecraEstreito ? { gridColumn: 'span 2' } : {}) }} />
        <Field label="Tempo (min)"><TempoInput value={f.defaultDuration} onChange={v => setF({ ...f, defaultDuration: v })} placeholder="Ex: 15 ou 7+7" /></Field>
        <Field label="Espaço"><Input value={f.space} onChange={e => setF({ ...f, space: e.target.value })} onBlur={applySpaceText} placeholder="20x20 ou 20x20 (2)" /></Field>
        <Field label="Nº jogadores">
          <Input value={f.playersCount} onChange={e => setF({ ...f, playersCount: e.target.value })} onBlur={autoInsertPlayers} placeholder="4x4, 4+1, 3 Gr" />
        </Field>
        <Field label="Material"><Input value={f.material} onChange={e => setF({ ...f, material: e.target.value })} placeholder="Coletes, cones, balizas, estacas" /></Field>
        </div>
        <div style={FIELD_FULL}>
          <Field label="Descrição / instruções"><TextArea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Objetivo, regras, condicionantes..." /></Field>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Esquema tático" bloco>
          <DiagramEditor
            value={f.diagram || { elements: [], arrows: [] }}
            onChange={d => setF(prev => ({ ...prev, diagram: d }))}
            spaceMeters={parseSpace(f.space)}
            exerciseInfo={{ name: f.name, phase: f.phase, phase2: f.phase2, space: f.space, material: f.material, description: f.description, playersCount: f.playersCount, defaultDuration: f.defaultDuration }}
            onClearAll={handleClearAll}
            onSpaceZonesChange={handleSpaceZonesChange}
            activeColor={diagramColor}
            onColorChange={setDiagramColor}
          />
        </Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Anexo (imagem, PDF ou exercício existente)" bloco>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.line}`,
              background: T.surfaceRaise, color: T.cream, fontSize: 13, ...body,
            }}>
              <Upload size={14} />
              {f.attachment ? 'Substituir ficheiro' : 'Carregar imagem ou PDF'}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={e => { handleAttachmentFile(e.target.files?.[0]); e.target.value = ''; }}
                style={{ display: 'none' }}
              />
            </label>
            {/* Anexar um exercício já criado: copia automaticamente toda a
                informação dele (fase, descrição, espaço, jogadores, material,
                duração, esquema tático e anexo) para este formulário. */}
            <button
              ref={botaoCopiarRef}
              type="button"
              onClick={alternarCopiar}
              disabled={importable.length === 0}
              title={importable.length === 0 ? `Ainda não há outros exercícios de ${f.phase}.` : 'Copiar a informação de um exercício já criado desta fase'}
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
              <Copy size={14} /> Anexar exercício existente
              <span style={{ ...mono, fontSize: 11.5, opacity: .7 }}>{importable.length}</span>
            </button>
            {f.attachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {f.attachment.type === 'image' ? (
                  <img src={f.attachment.dataUrl} alt={f.attachment.name} style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.line}` }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surfaceRaise, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={18} color={T.mutedDim} />
                  </div>
                )}
                <span style={{ fontSize: 12, color: T.mutedDim, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.attachment.name}</span>
                <button onClick={() => setF(prev => ({ ...prev, attachment: null }))} title="Remover anexo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><X size={15} /></button>
              </div>
            )}
          </div>
          {attachError && <div style={{ fontSize: 12, color: T.bad, marginTop: 6 }}>{attachError}</div>}
          {aCarregarAnexo && <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 6 }}>A carregar o anexo…</div>}
          {importNotice && (
            <div style={{ fontSize: 12, color: T.warn, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} /> {importNotice}
            </div>
          )}

          {importOpen && importable.length > 0 && (
            <EscolherParaCopiar
              key={f.phase}
              itens={importable}
              tipo="exercicio"
              fase={f.phase}
              meta={meta}
              nomeDe={(x) => x.name}
              detalhesDe={detalhesExercicio}
              temDesenhoAtual={desenhoAtualExercicio}
              onUsar={(x) => fecharSemSaltar(botaoCopiarRef.current, () => importFromExercise(x))}
            />
          )}
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={!f.name || aCarregarAnexo} onClick={() => { limpar(); onSave(f); }}><Check size={15} /> Guardar</Btn>
      </div>
      {espacoSemSaltar}
    </Modal>
  );
}

