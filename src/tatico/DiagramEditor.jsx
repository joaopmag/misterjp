// tatico/DiagramEditor.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useRef, useEffect } from 'react';
import { useIsMobile, Select } from '../base/ui';
import { flushSync, createPortal } from 'react-dom';
import { uid, todayStr, fmtShort } from '../base/utilidades';
import { body, T, mono, TEXT_ON_ACCENT, display } from '../base/tema';
import { Square, Play, RotateCw, Maximize2, Copy, Undo2, Redo2, Printer, Trash2, Clock, RefreshCw } from 'lucide-react';
import { ANIM_DESLIZE_MIN, ANIM_MATERIAL_ESTATICO, BASE_TOOLS, CHROME_EDITOR_PX, DiagramElements, EDITOR_BOX, EDITOR_MEIO_X_MAX, EDITOR_MEIO_X_MIN, EDITOR_VIEWBOX, EDITOR_VIEWBOX_MEIO, EDITOR_Y_MAX, EDITOR_Y_MIN, ESTICAR_IMPRESSAO_MEIO, ICON_SCALE_BASE, KEEPER_NUMBERS, LINE_LABELS, LINE_TOOLS, MARKER_TOOLS, PITCH_BOX, PITCH_FIT, PitchMarkings, ROTULOS_JOGADOR, SpaceZone, TEAMS, TriondaBall, VISTA_MEIO, VistaCampo, aspetoSemBancos, buildAnimationChainsPure, carimbarRotulos, clampTextElement, elementLabel, iconScaleForPhase, nextKeeperNumber, nextPlayerNumber, planearCoreografiaAnim, planearPassoAnim, rotuloIcone, stepElements, stepStaticArrows, teamInfo, textBoxMetrics, useRodarTexto, viewBoxDaVista, viewBoxSemBancos } from './campo';
import { TreinosParaEditorCtx, elementosDaSessao, elementosDoJogo, nomeNoIcone, sessoesParaCarregar } from './prancheta';
import { imprimirComNome } from '../base/impressao';
import { momentoTexto } from '../dominio/treino';

export function DiagramEditor({ value, onChange, spaceMeters, exerciseInfo, onClearAll, onSpaceZonesChange, activeColor, onColorChange, jogoId }) {
  /* A APRESENTAÇÃO PODE DEMORAR VÁRIOS SEGUNDOS A CORRER (um passo atrás
     do outro, com pausas). `runPresentStep` chama-se A SI PRÓPRIA por
     `setTimeout` para passar ao passo seguinte — e cada uma dessas
     chamadas futuras fica presa à versão de `value` que existia no
     preciso render em que foi agendada, não à mais recente. Editar o
     conteúdo de uma caixa de texto e, JÁ DEPOIS, carregar em "Apresentar
     tudo" não devia sofrer disto — mas para nunca depender de o React já
     ter propagado a edição a tempo, `valueRef` dá sempre acesso ao
     `value` mais recente possível, e é isso que `stepElements` passa a
     usar dentro da apresentação, em vez do parâmetro fechado na função. */
  const valueRef = React.useRef(value);
  valueRef.current = value;
  // Bola Parada trabalha-se dentro da grande área: ícones a 60% (ver
  // iconScaleForPhase). Reage à fase escolhida no formulário, em direto.
  const iconEscala = iconScaleForPhase(exerciseInfo?.phase, value);
  const isNarrowEditor = useIsMobile(760);

  /* ÍCONES MAIORES NO TELEMÓVEL.

     Num ecrã de 380 px o campo inteiro tem a largura de um cartão de
     crédito, e os jogadores ficam com 3 mm — impossíveis de acertar com o
     dedo e de distinguir uns dos outros.

     Aumentar as posições não resolveria nada (o campo é o mesmo); o que se
     aumenta é o TAMANHO DESENHADO dos ícones. As coordenadas não mudam,
     por isso um exercício feito no telemóvel abre igual no computador —
     só com os ícones à escala certa para cada ecrã. */
  const escalaEcra = isNarrowEditor ? 1.45 : 1;

  /* O TAMANHO DO CAMPO JÁ NÃO É MEDIDO — é só CSS (ver PITCH_FIT: width
     100% + aspectRatio). Havia aqui antes um ResizeObserver a medir
     `editorRef` (o editor inteiro) para calcular uma altura máxima e
     aplicá-la como `maxWidth` na prancheta (`campoRef`). O problema é que
     `campoRef` está DENTRO de `editorRef`: mudar o tamanho da prancheta
     mudava também a altura do editor inteiro, o que disparava o próprio
     ResizeObserver outra vez, com um valor ligeiramente diferente — um
     ciclo que nunca estabilizava e se via como a prancheta a tremer/
     encolher e crescer repetidamente ao abrir o editor. Como o CSS já
     resolve sozinho o ajuste à largura disponível, esta medição em
     JavaScript era redundante e é isso que causava o tremor. */
  const svgRef = React.useRef(null);
  const [tool, setTool] = useState('select');
  // 'activeColor' já não é estado local — vem do componente pai (ExerciseModal)
  // via props, exatamente para que uma eventual remontagem deste editor não
  // consiga repor a cor para o valor por omissão.
  const selectColor = (id, e) => {
    onColorChange(id, e);
  };
  const [dragId, setDragId] = useState(null);
  const [dragMoved, setDragMoved] = useState(false);
  /* SELECIONAR VÁRIOS (ferramenta "Vários"): o grupo escolhido, o
     retângulo a ser desenhado e o arrasto do grupo (de onde partiu e as
     posições originais de cada um, para as distâncias se manterem). */
  const [grupo, setGrupo] = useState([]);
  const [laco, setLaco] = useState(null); // { x1, y1, x2, y2 }
  const arrastoGrupoRef = useRef(null);   // { start, orig: Map, moveu }
  const [aArrastarGrupo, setAArrastarGrupo] = useState(false);
  // Ao sair da ferramenta "Vários", o grupo desfaz-se.
  useEffect(() => { if (tool !== 'multi') { setGrupo([]); setLaco(null); } }, [tool]);
  const [dragArrowId, setDragArrowId] = useState(null);
  const [arrowMoved, setArrowMoved] = useState(false);
  const [dragHandle, setDragHandle] = useState(null); // { id, which: 'start'|'end' }
  const [goalDrag, setGoalDrag] = useState(null); // { id, mode: 'rotate'|'resize' }
  const [isPlaying, setIsPlaying] = useState(false);
  const [animItems, setAnimItems] = useState([]); // [{ id, type: 'arrow-pass'|'arrow-run', x, y, mover }]
  // O campo a meio do "Animar" (motor partilhado): todos os elementos, já
  // com as posições deste instante. null = sem animação a correr.
  const [animFrame, setAnimFrame] = useState(null);
  const animRef = React.useRef(null);
  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);
  const [dragZoneId, setDragZoneId] = useState(null);
  const [resizingZoneId, setResizingZoneId] = useState(null);
  const [liveZoneSize, setLiveZoneSize] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedArrowId, setSelectedArrowId] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [erasing, setErasing] = useState(false);
  const dragStartRef = React.useRef(null);
  const dragArrowRef = React.useRef(null);
  const dragZoneRef = React.useRef(null);
  const painelSelecaoRef = React.useRef(null);

  /* O painel de seleção (onde aparece a caixa de texto, as cores, o
     tamanho…) vive por baixo do campo. Agora que o editor de exercício
     abre a página inteira, há muito conteúdo por cima dele — ao tocar
     num elemento no campo (ou ao acabar de o colocar), o painel podia
     ficar fora do ecrã visível, obrigando a procurá-lo a rolar às
     cegas. `block:'nearest'` só desloca o preciso para o mostrar, sem
     saltar quando já está à vista — o mesmo cuidado da caixa de texto,
     aplicado aqui ao painel inteiro. */
  useEffect(() => {
    if (!selectedId || !painelSelecaoRef.current) return;
    try { painelSelecaoRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (err) { /* browsers antigos */ }
  }, [selectedId]);

  /* INSERIR UM ELEMENTO A PARTIR DE UM PASSO JÁ GRAVADO.

     Cada passo da animação guarda uma fotografia do campo (`step.elements`).
     Um elemento colocado depois de a coreografia estar feita só existia no
     estado final — e ao rever a animação desde o início, aparecia do nada
     no fim.

     Com `inserirDesde` escolhido, o elemento é escrito também na fotografia
     desse passo e de todos os seguintes: passa a estar em campo a partir
     dali até ao fim, que é o que se quer para testar uma variante sem
     desfazer o que já está feito.

     `inserirDesde` é o índice do passo (0 = antes do primeiro). Começa
     já a apontar para o ÚLTIMO passo existente (não para null) — ao abrir
     um exercício com animação já feita, colocar ou apagar algo sem tocar
     em mais nada afeta o passo mais recente por omissão, que é o que
     interessa na esmagadora maioria das vezes. Cada vez que se grava um
     passo novo (`Animar`, desfazer, refazer) isto é atualizado sozinho —
     ver esses três sítios. */
  const [inserirDesde, setInserirDesde] = useState(() => {
    const n = (value.sequence || []).length;
    return n > 0 ? n - 1 : null;
  });

  /* RECUAR NO TEMPO: escolher "desde animar N" (com N a meio da
     coreografia, não o último passo) devolve a prancheta às posições
     desse passo, para se poder desenhar dali um caminho novo — sem
     apagar os passos que já vinham a seguir. É o mesmo "desde" que já
     servia para colocar e apagar elementos; aqui serve também para VER
     e continuar a animar a partir de um ponto anterior.

     `emRecuo` só é verdade quando o passo escolhido NÃO é o último —
     escolher o mais recente (o que já acontece sozinho depois de cada
     "Animar") continua a mostrar a prancheta tal como está agora,
     sem qualquer recuo visual.

     `inserirDesde` vem de um `useState` que só é inicializado uma vez —
     se este editor for reaproveitado para outro exercício (ou depois de
     se apagarem passos), pode ficar a apontar para um índice que já não
     existe. Sem esta validação, um valor perdido no ar era lido como
     "estou em recuo" para sempre, e o painel de edição (número, texto,
     rotação, a baliza) ficava bloqueado sem se perceber porquê — foi
     isto que aconteceu depois da correção anterior. Um `inserirDesde`
     fora do intervalo válido conta sempre como "não há recuo nenhum". */
  const ultimoIndicePasso = (value.sequence || []).length - 1;
  const desdeValido = inserirDesde != null && inserirDesde >= 0 && inserirDesde <= ultimoIndicePasso ? inserirDesde : null;
  const emRecuo = desdeValido != null && desdeValido < ultimoIndicePasso;
  const elementosRecuo = emRecuo ? stepElements(value.sequence[desdeValido], value) : null;
  /* Onde cada coisa estava no FIM do passo anterior ao que se vai gravar
     (o último, ou o "desde" em recuo). Quem estiver agora noutro sítio foi
     arrastado e desliza no próximo Animar (ver planearPassoAnim). */
  const indicePassoNovo = emRecuo ? desdeValido : (value.sequence || []).length;
  const fimAnteriorMemo = React.useMemo(() => {
    if (!indicePassoNovo) return null;
    try { return planearCoreografiaAnim(value, { ate: indicePassoNovo, semFinal: true }).fimAnterior; } catch (e) { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.sequence, indicePassoNovo]);
  const fimDoPassoAnterior = () => fimAnteriorMemo;

  /* Corrige sozinho um `inserirDesde` que ficou a apontar para um passo
     que já não existe (ver a nota acima) — sem isto, o valor inválido
     ficava guardado para sempre no estado, mesmo já não afetando o
     ecrã (graças a `desdeValido`), e voltava a poder confundir mais
     tarde se a coreografia voltasse a crescer até esse índice. */
  useEffect(() => {
    if (inserirDesde !== desdeValido) setInserirDesde(desdeValido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inserirDesde, desdeValido]);

  const elements = value?.elements || [];
  const arrows = value?.arrows || [];
  // Há alguma coisa arrastada desde o último Animar? (o Animar aparece
  // também só com arrastos)
  const haArrastos = !emRecuo && !!fimAnteriorMemo && (elementosRecuo || elements).some(el => {
    if (ANIM_MATERIAL_ESTATICO.has(el.kind)) return false;
    const a = fimAnteriorMemo.get(el.id);
    return a && Math.hypot(a.x - el.x, a.y - el.y) > ANIM_DESLIZE_MIN;
  });
  const selectedEl = elements.find(e => e.id === selectedId) || null;
  const selectedArrow = arrows.find(a => a.id === selectedArrowId) || null;
  // Lista de zonas de espaço reduzido desenhadas no campo. Compatibilidade
  // com exercícios antigos: se ainda não houver 'spaceZones' guardadas mas
  // existir o par clássico spaceOffset + WxH (no campo Espaço), mostra-se
  // essa única zona na mesma — passa a "zona real" assim que for arrastada,
  // redimensionada ou apagada.
  const zones = value?.spaceZones && value.spaceZones.length
    ? value.spaceZones
    : (spaceMeters ? [{
        id: 'legacy', w: spaceMeters.w, h: spaceMeters.h, label: spaceMeters.label,
        dx: value?.spaceOffset?.dx !== undefined ? value.spaceOffset.dx : (spaceMeters.dx || 0),
        dy: value?.spaceOffset?.dy !== undefined ? value.spaceOffset.dy : (spaceMeters.dy || 0),
      }] : []);
  // Distância mínima de um ponto a um segmento de reta (para apagar setas
  // "ao roçar" durante o arrastamento da borracha).
  const distToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  };
  // Distância a uma SETA — reta ou curva. Uma seta curvada não segue o
  // segmento reto ponta a ponta; sem amostrar a curva, a borracha só
  // apagava se se roçasse nessa reta imaginária, nunca no arco a sério
  // que se vê desenhado.
  const distToArrow = (px, py, a) => {
    const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
    const curvaX = a.cx != null ? a.cx : mx, curvaY = a.cy != null ? a.cy : my;
    if (a.cx == null && a.cy == null) return distToSegment(px, py, a.x1, a.y1, a.x2, a.y2);
    const N = 10;
    let melhor = Infinity;
    let prev = { x: a.x1, y: a.y1 };
    for (let i = 1; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const pt = { x: u * u * a.x1 + 2 * u * t * curvaX + t * t * a.x2, y: u * u * a.y1 + 2 * u * t * curvaY + t * t * a.y2 };
      melhor = Math.min(melhor, distToSegment(px, py, prev.x, prev.y, pt.x, pt.y));
      prev = pt;
    }
    return melhor;
  };
  /* BORRACHA EXATA. Cada toque apaga UM só item: aquele em que se tocou
     (quando o toque cai em cima dele) ou, num toque no relvado, o mais
     perto — e só se estiver mesmo por baixo do dedo/rato (raio do tamanho
     do ícone, que é mais pequeno na Bola Parada e no meio-campo). Antes
     apagava tudo o que estivesse num raio fixo de 2,6 m (num grupo de
     jogadores e bolas ia mais do que um) e, se o "largar" do rato se
     perdia, continuava a apagar só de passar o rato por cima. Agora só
     apaga com o botão carregado (ver `apagarAoMover`).
     Arrastar com o botão carregado continua a apagar o que se for tocando,
     um de cada vez. Lê sempre o desenho mais recente (valueRef), para um
     movimento rápido não "ressuscitar" o que acabou de apagar. */
  const raioBorracha = 2.0 * (iconEscala / ICON_SCALE_BASE);
  const raioBorrachaSeta = 1.2 * (iconEscala / ICON_SCALE_BASE);
  const eraseAt = (p, alvo = null) => {
    const v = valueRef.current || value;
    const els = v.elements || [];
    const sets = v.arrows || [];
    /* ONDE OS ITENS SE VEEM. A ver um passo anterior da animação ("A ver
       o início do Animar 1…"), o campo mostra as posições DESSE passo, mas
       a borracha media a distância às posições de agora (o fim da
       animação): apagava itens longe do cursor, no caminho por onde se
       mexem na animação. Mede-se agora no sítio onde cada um está
       desenhado; apaga-se pelo id. */
    let vistos = els;
    if (desdeValido != null && desdeValido < (v.sequence || []).length - 1) {
      try { vistos = stepElements(v.sequence[desdeValido], v) || els; } catch (err) { vistos = els; }
    }
    const idsAtuais = new Set(els.map(el => el.id));
    let apagarEl = null, apagarSeta = null;
    if (alvo && alvo.tipo === 'el') apagarEl = els.find(el => el.id === alvo.id) || null;
    else if (alvo && alvo.tipo === 'seta') apagarSeta = sets.find(a => a.id === alvo.id) || null;
    else {
      let melhorEl = null, dEl = Infinity;
      vistos.filter(el => idsAtuais.has(el.id)).forEach(el => { const d = Math.hypot(el.x - p.x, el.y - p.y); if (d < raioBorracha && d < dEl) { dEl = d; melhorEl = el; } });
      let melhorSeta = null, dSeta = Infinity;
      sets.forEach(a => { const d = distToArrow(p.x, p.y, a); if (d < raioBorrachaSeta && d < dSeta) { dSeta = d; melhorSeta = a; } });
      // O mais perto dos dois (a seta conta pela sua distância à linha).
      if (melhorEl && (!melhorSeta || dEl / raioBorracha <= dSeta / raioBorrachaSeta)) apagarEl = melhorEl;
      else if (melhorSeta) apagarSeta = melhorSeta;
    }
    if (!apagarEl && !apagarSeta) return;
    if (apagarEl && selectedId === apagarEl.id) setSelectedId(null);
    if (apagarSeta && selectedArrowId === apagarSeta.id) setSelectedArrowId(null);
    const novo = {
      ...v,
      elements: apagarEl ? els.filter(el => el.id !== apagarEl.id) : els,
      arrows: apagarSeta ? sets.filter(a => a.id !== apagarSeta.id) : sets,
      // Sai também de todos os passos gravados (ver limparDosPassos) — ou,
      // com "desde" escolhido, só a partir desse passo.
      sequence: apagarEl ? limparDosPassos(v.sequence, new Set([apagarEl.id]), desdeValido) : v.sequence,
    };
    valueRef.current = novo;
    commit(novo);
  };
  // Só se apaga ao mover com o botão do rato carregado (ou o dedo no ecrã).
  const apagarAoMover = (e) => !(e.pointerType === 'mouse' && !(e.buttons & 1));

  // ---- Undo / Redo -------------------------------------------------
  // 'past'/'future' guardam snapshots de 'value'. Ações discretas
  // (colocar, apagar, mudar número/rotação/tamanho, limpar) gravam de
  // imediato via commit(). Gestos contínuos (arrastar jogador/seta/
  // baliza, rodar, redimensionar por arrasto) gravam UM único snapshot
  // no início do gesto (beginGesture) e depois vão atualizando com
  // onChange normal, para não encher o histórico com passos intermédios.
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const HISTORY_LIMIT = 60;

  /* PASSOS DA ANIMAÇÃO ANULADOS.

     O Ctrl+Z geral só desfaz o que se fez NESTA sessão de edição: ao abrir
     um exercício já gravado, o histórico está vazio, e por isso não havia
     forma de tirar um passo de animação gravado noutro dia — só apagando
     a animação toda e refazendo-a de raiz.

     Estes dois botões trabalham diretamente sobre `value.sequence`. Cada
     passo guarda tudo o que é preciso para desfazer o que ele próprio fez:
     `elements` (as posições ANTES do movimento), `arrows` (as setas de
     passe/corrida que a animação consumiu) e `staticArrows` (os desenhos
     fixos que existiam nessa altura). Repor esses três campos devolve o
     campo exatamente ao estado anterior ao passo. */
  const [passosAnulados, setPassosAnulados] = useState([]);

  const anularUltimoPasso = () => {
    const seq = value.sequence || [];
    if (!seq.length) return;
    const ultimo = seq[seq.length - 1];
    setPassosAnulados(p => [...p, ultimo]);
    commit({
      ...value,
      elements: (ultimo.elements || []).map(el => ({ ...el })),
      // As setas animadas voltam ao campo, para se poderem corrigir.
      arrows: [...(ultimo.staticArrows || []), ...(ultimo.arrows || [])],
      sequence: seq.slice(0, -1),
    });
    // A referência de "desde" acompanha o passo que passou a ser o
    // último — sem isto, ficava presa a um passo que já não existe.
    setInserirDesde(seq.length > 1 ? seq.length - 2 : null);
    setSelectedId(null);
    setSelectedArrowId(null);
  };

  const refazerPasso = () => {
    if (!passosAnulados.length) return;
    const passo = passosAnulados[passosAnulados.length - 1];
    setPassosAnulados(p => p.slice(0, -1));
    // Recoloca o passo e volta a pôr os elementos no fim do movimento.
    const movidos = new Map();
    (passo.arrows || []).forEach(a => { if (a.ownerId) movidos.set(a.ownerId, { x: a.x2, y: a.y2 }); });
    const animadas = new Set((passo.arrows || []).map(a => a.id));
    commit({
      ...value,
      elements: (passo.elements || []).map(el => (movidos.has(el.id) ? { ...el, x: movidos.get(el.id).x, y: movidos.get(el.id).y } : { ...el })),
      arrows: (value.arrows || []).filter(a => !animadas.has(a.id)),
      sequence: [...(value.sequence || []), passo],
    });
    setInserirDesde((value.sequence || []).length);
    setSelectedId(null);
    setSelectedArrowId(null);
  };
  const commit = (newValue) => {
    setPast(p => [...p.slice(-HISTORY_LIMIT + 1), value]);
    setFuture([]);
    onChange(newValue);
  };
  // VISTA DO CAMPO (ver VistaCampo): gravada no próprio desenho, para a
  // ficha, a impressão, a apresentação e as miniaturas mostrarem igual.
  const vistaCampo = value && value.vista === 'meio' ? 'meio' : 'completo';
  // Moldura do editor SEMPRE sem os bancos e fixa: arrastar um jogador
  // até à borda já não troca o enquadramento (o campo encolhia e apareciam
  // os bancos de suplentes). Os itens ficam presos dentro desta moldura.
  const editorCompacto = true;
  const caixaEditor = editorCompacto ? EDITOR_BOX : PITCH_BOX;
  const viewBoxEditor = editorCompacto ? (vistaCampo === 'meio' ? EDITOR_VIEWBOX_MEIO : EDITOR_VIEWBOX) : viewBoxDaVista(vistaCampo);
  const gVistaRef = useRef(null);
  const mudarVista = (v) => { if (v !== vistaCampo) commit({ ...value, vista: v === 'meio' ? 'meio' : undefined }); };
  // O QUE APARECE NO CÍRCULO (ver ROTULOS_JOGADOR), para o esquema inteiro.
  const rotulosEsquema = value && (value.rotulos === 'numero' || value.rotulos === 'cor') ? value.rotulos : 'posicao';
  const mudarRotulos = (m) => { if (m !== rotulosEsquema) commit(carimbarRotulos(value || { elements: [], arrows: [] }, m)); };
  // Próximo número de camisola livre, na cor (para jogadores colocados à mão em "Nº").
  const proximaCamisola = (team, isKeeper) => {
    const usados = new Set((elements || []).filter(el => el && (el.kind === 'player' || el.kind === 'keeper') && (el.team || 'A') === (team || 'A'))
      .map(el => Number(rotuloIcone({ ...el, rotulo: 'numero' }))).filter(n => n > 0));
    if (isKeeper && !usados.has(1)) return 1;
    for (let n = isKeeper ? 1 : 2; n < 100; n++) if (!usados.has(n)) return n;
    return 1;
  };
  const comRotulo = (novo) => (rotulosEsquema === 'posicao' ? novo : {
    ...novo, rotulo: rotulosEsquema,
    ...(rotulosEsquema === 'numero' && novo.camisola == null && !novo.convidado ? { camisola: proximaCamisola(novo.team, novo.kind === 'keeper') } : {}),
  });
  // JOGADORES DO TREINO (ver elementosDaSessao): junta ao campo os presentes
  // de uma sessão, na cor escolhida, nos lugares do Quadro de posições.
  const treinosCtx = React.useContext(TreinosParaEditorCtx);
  const sessoesCarregaveis = sessoesParaCarregar(treinosCtx.sessions);
  // CONVOCADOS DO JOGO (só numa ideia ligada a um jogo).
  const jogoDoEsquema = jogoId ? (treinosCtx.matches || []).find(m => m && m.id === jogoId) || null : null;
  const convocadosDoJogo = jogoDoEsquema
    ? (jogoDoEsquema.convocados || []).map(id => (treinosCtx.players || []).find(p => p && p.id === id)).filter(Boolean)
    : [];
  const carregarConvocados = () => {
    const novos = elementosDoJogo(jogoDoEsquema, treinosCtx.players || [], activeColor || 'A');
    if (!novos.length) return;
    // No plano de um jogo, o esquema passa a mostrar os números.
    commit(carimbarRotulos({ ...value, elements: [...elements, ...novos] }, 'numero'));
  };
  // "Quem é": dá a um jogador do campo o número e o nome de um convocado.
  const atribuirConvocado = (pid) => {
    if (!selectedEl) return;
    const p = convocadosDoJogo.find(x => x.id === pid);
    const dados = p
      ? { playerId: p.id, nome: nomeNoIcone(p), camisola: p.number != null && String(p.number).trim() !== '' ? String(p.number).trim() : undefined }
      : { playerId: undefined, nome: undefined };
    const mudar = (lista) => (lista || []).map(el => (el && el.id === selectedEl.id ? { ...el, ...dados } : el));
    commit({ ...value, elements: mudar(elements), sequence: Array.isArray(value.sequence) ? value.sequence.map(st => (st && st.elements ? { ...st, elements: mudar(st.elements) } : st)) : value.sequence });
  };
  const carregarSessao = (id) => {
    const s = sessoesCarregaveis.find(x => x.id === id);
    if (!s) return;
    const novos = elementosDaSessao(s, treinosCtx.players || [], activeColor || 'A').map(comRotulo);
    if (!novos.length) return;
    commit({ ...value, elements: [...elements, ...novos] });
  };
  const beginGesture = () => {
    setPast(p => [...p.slice(-HISTORY_LIMIT + 1), value]);
    setFuture([]);
  };
  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [...f, value]);
    onChange(previous);
    /* `commitZones` avisa o formulário (campo "Espaço") sempre que as
       zonas mudam, para o texto "15×15" acompanhar o desenho — mas
       "Anular"/"Refazer" trocam o diagrama inteiro de uma vez, por fora
       do `commitZones`, e esse aviso nunca chegava a sair. O campo
       "Espaço" ficava com o valor antigo, e como o desenho da zona usa
       esse campo como reserva quando não há zonas explícitas, uma zona
       recém-colocada e depois anulada "reaparecia" sozinha — não
       porque o anular tivesse falhado, mas porque o campo de texto ao
       lado nunca soube que tinha de mudar também. */
    if (onSpaceZonesChange) onSpaceZonesChange(previous.spaceZones || []);
    setSelectedId(null);
    setSelectedArrowId(null);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture(f => f.slice(0, -1));
    setPast(p => [...p, value]);
    onChange(next);
    if (onSpaceZonesChange) onSpaceZonesChange(next.spaceZones || []);
    setSelectedId(null);
    setSelectedArrowId(null);
  };
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [past, future, value]);

  /* Onde o dedo/rato tocou, em coordenadas do campo.

     Usa-se a matriz do próprio SVG (`getScreenCTM`) e não uma regra de
     três sobre o retângulo do elemento. A regra de três só está certa se o
     desenho preencher o elemento exatamente; com `preserveAspectRatio`
     em "meet" pode haver faixas mortas nas bordas, e aí o cursor e o
     ícone colocado deixam de coincidir. A matriz sabe disso e converte
     sempre bem, qualquer que seja o enquadramento. */
  const toPoint = (e) => {
    const svg = svgRef.current;
    const { x: vx, y: vy, w: vw, h: vh } = PITCH_BOX;
    // No meio-campo vertical só se coloca na metade que se vê (x ≥ ~49).
    const xMin = vistaCampo === 'meio' ? (editorCompacto ? EDITOR_MEIO_X_MIN : 107 - (VISTA_MEIO.v0 + VISTA_MEIO.h)) : vx;
    const xMax = vistaCampo === 'meio' ? (editorCompacto ? EDITOR_MEIO_X_MAX : 107 - VISTA_MEIO.v0) : vx + vw;
    const limitar = (px, py) => ({
      x: Math.max(xMin, Math.min(xMax, px)),
      // Com a moldura sem bancos, não se coloca nada onde não se vê.
      y: Math.max(editorCompacto ? EDITOR_Y_MIN : vy, Math.min(editorCompacto ? EDITOR_Y_MAX : vy + vh, py)),
    });
    if (!svg) return limitar(0, 0);
    try {
      // A matriz do <g> da vista já inclui a rotação do meio-campo: dá
      // logo as coordenadas do campo, rodado ou não.
      const ctm = (gVistaRef.current || svg).getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const p = pt.matrixTransform(ctm.inverse());
        return limitar(p.x, p.y);
      }
    } catch (err) { /* browsers sem createSVGPoint: usa-se o cálculo abaixo */ }
    const rect = svg.getBoundingClientRect();
    if (vistaCampo === 'meio') {
      const u = ((e.clientX - rect.left) / rect.width) * VISTA_MEIO.w + VISTA_MEIO.u0;
      const v = ((e.clientY - rect.top) / rect.height) * VISTA_MEIO.h + VISTA_MEIO.v0;
      return limitar(107 - v, u);
    }
    return limitar(
      ((e.clientX - rect.left) / rect.width) * vw + vx,
      ((e.clientY - rect.top) / rect.height) * vh + vy,
    );
  };
  // Converte um ponto local (lx, ly), definido antes da rotação, para a
  // posição real no campo — usado para colocar os manípulos de rotação e
  // redimensionamento da baliza exatamente sobre a forma já rodada.
  const localToWorld = (el, lx, ly) => {
    const rad = (el.rotation || 0) * Math.PI / 180;
    return {
      x: el.x + (lx * Math.cos(rad) - ly * Math.sin(rad)),
      y: el.y + (lx * Math.sin(rad) + ly * Math.cos(rad)),
    };
  };

  // "Encadeamento": quando se começa a desenhar uma nova seta de passe/
  // corrida perto do fim de uma seta existente do mesmo tipo, o toque de um
  // dedo raramente cai no pixel exato desse fim — fica sempre a um ou dois
  // "metros" de distância. Essa pequena folga é o suficiente para o
  // buildAnimationChains (mais abaixo) não reconhecer as duas setas como a
  // mesma cadeia, e a animação passa a mover uma bola "fantasma" em cada
  // seta ao mesmo tempo, em vez de uma bola só a percorrer a sequência
  // toda. Para evitar isto, ao começar a desenhar fazemos "snap": se o
  // toque inicial cair perto do fim de uma seta do mesmo tipo, arrancamos
  // exatamente desse ponto, garantindo uma cadeia sem falhas.
  const SNAP_DIST = 3.2;
  const snapChainStart = (type, x, y) => {
    // Quem está debaixo do dedo neste momento — é este que vai ser o dono
    // da seta nova.
    const rawOwner = type === 'arrow-run'
      ? nearestElementOfKind(['player', 'keeper', 'text'], x, y, SNAP_DIST)
      : nearestElementOfKind(['ball'], x, y, SNAP_DIST);
    let best = null, bestD = SNAP_DIST;
    for (const a of arrows) {
      if (a.type !== type) continue;
      // Nunca cola o início da seta ao fim da seta de OUTRO elemento: se o
      // DD começa a correr onde a corrida do EX acabou, a seta do DD tem de
      // ficar no sítio onde o DD está, e não agarrada à do EX.
      if (rawOwner && a.ownerId && a.ownerId !== rawOwner.id) continue;
      const d = Math.hypot(a.x2 - x, a.y2 - y);
      if (d <= bestD) { bestD = d; best = { x: a.x2, y: a.y2 }; }
    }
    return best || { x, y };
  };

  // Encontra o elemento (jogador/guarda-redes ou bola, conforme os tipos
  // pedidos) mais próximo do início de uma seta, para saber quem se desloca
  // na animação — e para, no final, o deixar mesmo colocado no destino.
  /* Qual o elemento a que este ponto pertence.

     Para jogadores e bolas basta a distância ao centro. Para uma CAIXA DE
     TEXTO não: a caixa pode ter 20 m de largura e o treinador começa a
     seta em cima da palavra, longe do centro. Media-se a distância ao
     centro e a caixa nunca era apanhada — daí o texto não ficar animável.
     Aqui a distância é medida à borda da caixa, não ao seu meio. */
  const nearestElementOfKind = (kinds, x, y, maxDist) => {
    // Em recuo, procura entre as posições desse passo antigo, não nas
    // atuais — para o "dono" da seta ser sempre quem está mesmo
    // desenhado no ecrã naquele momento.
    const fonte = elementosRecuo || elements;
    let best = null, bestD = Infinity;
    for (const el of fonte) {
      if (!kinds.includes(el.kind)) continue;
      let d;
      if (el.kind === 'text') {
        /* Distância à BORDA da caixa, e à posição onde ela está mesmo
           desenhada (ver textBoxMetrics). Uma caixa larga tem o centro
           longe da palavra onde se começa a seta; medir ao centro fazia
           com que nunca fosse apanhada. */
        const m = textBoxMetrics(el);
        const dx = Math.max(0, Math.abs(m.cx - x) - m.w / 2);
        const dy = Math.max(0, Math.abs(m.cy - y) - m.h / 2);
        d = Math.hypot(dx, dy);
      } else {
        d = Math.hypot(el.x - x, el.y - y);
      }
      if (d < bestD) { bestD = d; best = el; }
    }
    return best && bestD <= maxDist ? best : null;
  };
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const stopAnimation = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    setIsPlaying(false);
    setAnimItems([]);
    setAnimFrame(null);
    limparDeslocadosEditor();
  };
  // Agrupa setas encadeadas (o fim de uma coincide com o início da
  // seguinte, do mesmo tipo) em "cadeias", para que a animação as toque
  // uma a seguir à outra em vez de todas ao mesmo tempo — assim um passe
  // que segue outro só começa quando o anterior chega ao destino, tal
  // como aconteceria num lance real.
  // Uma única implementação, partilhada com a apresentação do exercício e
  // com o ficheiro exportado (buildAnimationChainsPure, mais acima). Antes
  // existiam três cópias desta lógica e uma correção numa delas não chegava
  // às outras — a regra do dono de cada seta ficava por aplicar.
  const buildAnimationChains = (arrowList) => buildAnimationChainsPure(arrowList);
  const playAnimation = () => {
    const animArrows = arrows.filter(a => a.type === 'arrow-pass' || a.type === 'arrow-run');
    /* Em recuo: o ponto de partida do movimento vem das posições do
       passo escolhido em "desde" (`elementosRecuo`), não das posições
       "atuais" — é assim que desenhar um caminho novo a partir do
       Animar 2, por exemplo, anima a partir de onde as coisas estavam
       nessa altura, e não de onde acabaram por ficar depois de mais
       passos terem sido gravados. */
    const elementosBase = elementosRecuo || elements;
    /* ARRASTAR TAMBÉM É MOVIMENTO: quem foi arrastado desde o fim do passo
       anterior desliza neste passo (ver planearPassoAnim). Por isso o
       Animar também funciona só com arrastos, sem nenhuma seta. */
    const curvasPendentes = value.deslizeCurvas || {};
    // Em "desde animar", arrastar é CORRIGIR o passo, não um movimento.
    const planoPasso = planearPassoAnim(elementosBase, animArrows, emRecuo ? null : fimDoPassoAnterior(), { curvas: curvasPendentes });
    if (animArrows.length === 0 && planoPasso.movers.size === 0) return;
    // Elementos de base desta animação: os que já existiam mais qualquer
    // bola nova criada agora mesmo, na posição de partida do passe (um
    // "Passe" representa sempre a bola a deslocar-se; sem bola colocada,
    // cria-se uma para o passe deixar uma bola a sério no destino).
    const baseElements = [...elementosBase, ...planoPasso.novasBolas.map(b => ({ ...b }))];
    // Regista este "passo" da sequência de criação (posições antes do
    // movimento + as setas que vão animar). É assim que a apresentação do
    // exercício, mais tarde, consegue reproduzir toda a coreografia de
    // movimentos sem depender de um vídeo gravado — basta reler os passos.
    const stepSnapshot = {
      v: 2, // gravado com o motor novo (ver planearCoreografiaAnim)
      elements: baseElements.map(el => ({ ...el })),
      arrows: animArrows.map(a => ({ ...a })),
      /* Desenhos fixos (linhas, zonas de pressão, setas sem animação) que
         JÁ existem no momento em que este passo é gravado. Sem isto, a
         apresentação desenhava todos os traços do exercício desde o
         primeiro fotograma — mesmo os que só foram feitos no fim. */
      staticArrows: arrows.filter(a => !animArrows.some(x => x.id === a.id)).map(a => ({ ...a })),
      // Quem foi arrastado para este passo (e de onde vinha): só esses deslizam.
      ...(Object.keys(planoPasso.deslizados).length ? { de: planoPasso.deslizados } : {}),
      // Curvas dos caminhos de quem foi arrastado (o ponto do meio puxado).
      ...(Object.keys(curvasPendentes).some(id => planoPasso.movers.has(id))
        ? { curvas: Object.fromEntries(Object.entries(curvasPendentes).filter(([id]) => planoPasso.movers.has(id))) } : {}),
    };
    setIsPlaying(true);
    try { flushSync(() => setAnimFrame(planoPasso.base)); } catch (e) { setAnimFrame(planoPasso.base); }
    limparDeslocadosEditor();
    const mexer = animarNos(planoPasso, planoPasso.base);
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      mexer(Math.min(elapsed, planoPasso.dur));
      if (elapsed < planoPasso.dur) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        // A animação terminou: quem se deslocou (jogador ou bola) fica
        // mesmo colocado no destino final da cadeia, em vez de voltar ao
        // sítio de onde partiu.
        const elementosFinais = planoPasso.fim;
        const animatedIds = new Set(animArrows.map(a => a.id));
        let indiceGravado;
        if (emRecuo) {
          /* EDITAR A MEIO DA COREOGRAFIA = RECOMEÇAR DALI.

             A prancheta está a mostrar o campo tal como estava no início do
             Animar k+1 (o "desde animar k+1" escolhido). Animar agora:
               · mantém tudo o que vem ANTES (Animar 1 … k) como estava;
               · o movimento novo PASSA A SER o Animar k+1;
               · os passos que vinham a seguir são apagados — a jogada
                 seguiu outro caminho. A partir daqui continua-se a animar
                 normalmente, se se quiser mais passos.
             Antes, o movimento novo era metido a meio e o resto da
             coreografia antiga continuava a correr por cima dele, o que
             dava jogadas sem sentido (e linhas que não animavam). O aviso
             por cima do campo diz isto antes de se animar, e "Anular"
             repõe tudo. */
          const seq = value.sequence || [];
          const k = desdeValido;
          indiceGravado = k;
          // Desenhos fixos que só nasceram em passos DEPOIS deste também
          // desaparecem com eles.
          const idsDoPasso = new Set(((seq[k] && seq[k].staticArrows) || []).map(a => a.id));
          const idsPosteriores = new Set();
          seq.slice(k + 1).forEach(s => (s.staticArrows || []).forEach(a => { if (!idsDoPasso.has(a.id)) idsPosteriores.add(a.id); }));
          const fixasFinais = arrows.filter(a => !animatedIds.has(a.id) && !idsPosteriores.has(a.id));
          const novoPasso = {
            ...stepSnapshot,
            staticArrows: fixasFinais.map(a => ({ ...a })),
          };
          commit({
            ...value,
            elements: elementosFinais,
            arrows: fixasFinais,
            sequence: [...seq.slice(0, k), novoPasso],
            deslizeCurvas: {},
          });
        } else {
          indiceGravado = (value.sequence || []).length;
          commit({
            ...value,
            elements: elementosFinais,
            // As setas de passe/corrida usadas na animação desaparecem no final,
            // já que o movimento que representavam já aconteceu.
            arrows: arrows.filter(a => !animatedIds.has(a.id)),
            sequence: [...(value.sequence || []), stepSnapshot],
            deslizeCurvas: {},
          });
        }
        /* O passo que se acaba de gravar passa a ser a referência por
           omissão de "desde" — sem isto, colocar e apagar usavam um
           ponto de referência DIFERENTE por omissão (colocar entrava só
           a partir de agora; apagar tirava de toda a coreografia), e só
           ficavam consistentes se a pessoa fosse a um menu escolher o
           mesmo passo dos dois lados, coisa fácil de esquecer. Agora os
           dois seguem sozinhos o passo mais recente — colocar uma caixa
           de texto e mais tarde apagá-la (sem tocar em mais nada) já
           mantém sozinho as duas coisas certas: fica nos passos onde
           esteve, desaparece só a partir de onde se apagou. Continua a
           poder escolher-se outro passo à mão, para os casos em que se
           precisa mesmo de recuar mais no tempo. */
        setInserirDesde(indiceGravado);
        // Um passo novo fecha a possibilidade de refazer os anulados —
        // a partir daqui a coreografia seguiu outro caminho.
        setPassosAnulados([]);
        if (selectedArrowId && animatedIds.has(selectedArrowId)) setSelectedArrowId(null);
        setIsPlaying(false);
        setAnimItems([]);
        try { flushSync(() => setAnimFrame(null)); } catch (e) { setAnimFrame(null); }
        limparDeslocadosEditor();
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  // Pré-visualização da apresentação completa (todos os passos já
  // gravados através de sucessivos "Animar"), tal como fica depois de
  // guardado — para conferir a coreografia toda antes de sair do editor,
  // sem ser preciso guardar e abrir "Apresentar" para ver.
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentElements, setPresentElements] = useState(null);
  // Desenhos fixos a mostrar durante a pré-visualização (acompanham o passo).
  const [presentArrows, setPresentArrows] = useState(null);
  const [presentAnimItems, setPresentAnimItems] = useState([]);
  const presentAnimRef = React.useRef(null);
  const presentTimeoutRef = React.useRef(null);
  useEffect(() => () => {
    if (presentAnimRef.current) cancelAnimationFrame(presentAnimRef.current);
    if (presentTimeoutRef.current) clearTimeout(presentTimeoutRef.current);
  }, []);
  const stopPresentation = () => {
    limparDeslocadosEditor();
    if (presentAnimRef.current) cancelAnimationFrame(presentAnimRef.current);
    if (presentTimeoutRef.current) clearTimeout(presentTimeoutRef.current);
    presentAnimRef.current = null;
    setIsPresenting(false);
    setPresentElements(null);
    setPresentArrows(null);
    setPresentAnimItems([]);
  };
  /* Com o motor partilhado (planearCoreografiaAnim): cada passo começa
     onde o anterior acabou, o que foi arrastado desliza, a bola anda ao
     dobro e não há pausa entre passos. O plano é feito a partir de
     `valueRef.current` (o conteúdo mais recente das caixas de texto). */
  // Só as peças que andam se mexem (transform direto), sem redesenhar o
  // campo a cada imagem (ver ExercisePresentation).
  const limparDeslocadosEditor = () => {
    const raiz = svgRef.current;
    if (raiz) raiz.querySelectorAll('[data-anim-id][transform]').forEach(n => n.removeAttribute('transform'));
  };
  const animarNos = (p, base) => {
    const nos = new Map();
    if (svgRef.current) svgRef.current.querySelectorAll('[data-anim-id]').forEach(n => nos.set(n.getAttribute('data-anim-id'), n));
    const baseMap = new Map(base.map(el => [el.id, el]));
    return (ms) => p.posicoes(ms).forEach((v, id) => {
      const n = nos.get(id), b = baseMap.get(id);
      if (n && b) n.setAttribute('transform', `translate(${(v.x - b.x).toFixed(3)} ${(v.y - b.y).toFixed(3)})`);
    });
  };
  const runPresentStep = (idx, plano, sobraMs = 0) => {
    const p = plano.passos[idx];
    if (!p) { limparDeslocadosEditor(); stopPresentation(); return; }
    setPresentArrows(p.setasFixas);
    try { flushSync(() => setPresentElements(p.base)); } catch (e) { setPresentElements(p.base); }
    limparDeslocadosEditor();
    const mexer = animarNos(p, p.base);
    const start = performance.now() - sobraMs;
    const tick = (now) => {
      const elapsed = now - start;
      mexer(Math.min(elapsed, p.dur));
      const total = p.dur + (p.pausa || 0);
      if (elapsed < total) {
        presentAnimRef.current = requestAnimationFrame(tick);
      } else {
        presentAnimRef.current = null;
        if (idx + 1 < plano.passos.length) runPresentStep(idx + 1, plano, Math.max(0, elapsed - total));
        // Terminou: volta a mostrar o quadro tal como está agora no editor,
        // incluindo setas por animar que ainda não tenham sido "Animadas".
        else { try { flushSync(() => stopPresentation()); } catch (e) { stopPresentation(); } limparDeslocadosEditor(); }
      }
    };
    presentAnimRef.current = requestAnimationFrame(tick);
  };
  const startPresentation = () => {
    const seq = value.sequence || [];
    if (seq.length === 0) return;
    const plano = planearCoreografiaAnim(valueRef.current || value);
    if (!plano.passos.length) return;
    setIsPresenting(true);
    setPresentElements(plano.passos[0].base);
    setPresentArrows(plano.passos[0].setasFixas);
    presentTimeoutRef.current = setTimeout(() => runPresentStep(0, plano), 200);
  };

  /* INSERIR UM ELEMENTO A PARTIR DE UM PASSO JÁ GRAVADO. (ver a nota
     completa mais abaixo, onde `inserirDesde` costumava estar — foi
     movido para aqui em cima porque `elements`/`playAnimation` também
     precisam dele, para "recuar no tempo" — ver `emRecuo` a seguir.) */

  /* APAGAR TEM DE APAGAR TAMBÉM DOS PASSOS GRAVADOS — MAS SÓ A PARTIR DE
     ONDE SE ESTÁ A EDITAR.

     Cada passo da animação guarda uma fotografia do campo. Apagar um
     elemento só do estado atual tirava-o do editor mas deixava-o em todas
     as fotografias — e ao apresentar a animação ele reaparecia, mesmo
     depois de guardar.

     Mas apagar de TODAS as fotografias, sempre, também não estava certo:
     um elemento colocado no "animar 4" e apagado enquanto se editava a
     partir do "animar 6" tinha de continuar a aparecer nos passos 4 e 5
     — esteve mesmo lá nessa altura — e só desaparecer a partir do 6. O
     seletor "desde" (o mesmo que serve para inserir a partir de um passo)
     é reaproveitado aqui: indica também a partir de onde uma remoção
     deve valer. Sem ele escolhido, mantém-se o comportamento antigo —
     apaga-se de toda a coreografia, que é o correto quando não se está a
     testar uma variante a partir de um ponto concreto. */
  const limparDosPassos = (sequencia, idsApagados, desde = null) => {
    if (!sequencia || !sequencia.length || !idsApagados.size) return sequencia;
    return sequencia.map((step, i) => {
      /* Com "desde" escolhido, um passo ANTERIOR ao ponto de corte fica
         tal como estava — o elemento continua lá, porque esteve mesmo em
         campo nessa altura. Só os passos a partir do ponto de corte é que
         perdem o elemento. Sem "desde" (comportamento antigo), apaga-se de
         toda a coreografia, do primeiro ao último passo. */
      if (desde != null && i < desde) return step;
      return {
        ...step,
        elements: (step.elements || []).filter(el => !idsApagados.has(el.id)),
        arrows: (step.arrows || []).filter(a => !a.ownerId || !idsApagados.has(a.ownerId)),
        staticArrows: (step.staticArrows || []).filter(a => !a.ownerId || !idsApagados.has(a.ownerId)),
      };
    });
  };

  /* ELEMENTOS ÓRFÃOS — resíduo de exercícios gravados antes da correção
     acima existir.

     Um elemento só devia aparecer numa fotografia de um passo se também
     estiver no campo atual (`value.elements`): as fotografias são
     cumulativas até ao estado de hoje. Se um id aparece nalgum passo mas
     já não está no campo, é porque foi apagado antes de `limparDosPassos`
     ter sido chamado — exatamente o caso de um jogador metido a partir de
     "inserir desde" e depois apagado, que ficava preso num frame.

     Isto detecta esses ids e o botão "Reparar animação" (mais abaixo)
     limpa-os de todas as fotografias, sem tocar em mais nada. */
  const idsOrfaosDaAnimacao = () => {
    const atuais = new Set((value.elements || []).map(el => el.id));
    const orfaos = new Set();
    (value.sequence || []).forEach(step => {
      (step.elements || []).forEach(el => { if (!atuais.has(el.id)) orfaos.add(el.id); });
    });
    return orfaos;
  };

  const repararAnimacao = () => {
    const orfaos = idsOrfaosDaAnimacao();
    if (!orfaos.size) return;
    commit({ ...value, sequence: limparDosPassos(value.sequence, orfaos) });
  };

  const colocarElemento = (novo) => {
    const seq = value.sequence || [];
    const desde = desdeValido;
    const sequencia = (desde == null || !seq.length)
      ? seq
      : seq.map((step, i) => (i < desde ? step : { ...step, elements: [...(step.elements || []), { ...novo }] }));
    commit({ ...value, elements: [...elements, novo], sequence: sequencia });
    return novo.id;
  };

  const handleBgPointerDown = (e) => {
    if (isPresenting) return;
    // Impede o "clique fantasma" de compatibilidade que alguns browsers/
    // webviews móveis podem disparar pouco depois do toque, nas mesmas
    // coordenadas — se esse clique caísse por acaso sobre outro elemento
    // (por exemplo depois de a lista de elementos mudar), podia acionar
    // ações que nada têm a ver com este toque.
    if (e.cancelable) e.preventDefault();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = toPoint(e);
    if (tool === 'multi') {
      // Retângulo novo: começa uma seleção nova.
      setGrupo([]);
      setLaco({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else if (tool === 'eraser') {
      setErasing(true);
      eraseAt(p);
    } else if (tool === 'player') {
      const number = nextPlayerNumber(elements, activeColor);
      colocarElemento(comRotulo({ id: uid(), kind: 'player', team: activeColor, number, x: p.x, y: p.y }));
    } else if (tool === 'keeper') {
      const number = nextKeeperNumber(elements, activeColor);
      colocarElemento(comRotulo({ id: uid(), kind: 'keeper', team: activeColor, number, x: p.x, y: p.y }));
    } else if (tool === 'goalmarker') {
      const newId = uid();
      colocarElemento({ id: newId, kind: 'goalmarker', rotation: 0, w: 3.6, h: 2.2, x: p.x, y: p.y });
      // Seleciona logo a baliza acabada de colocar, para os manípulos de
      // rotação/redimensionamento aparecerem de imediato, sem ser preciso
      // mudar para "Mover / Selecionar" e tocar nela outra vez.
      setSelectedId(newId);
    } else if (tool === 'space-square') {
      // Usa o tamanho da última zona colocada (ou 15x15 por omissão) —
      // pode ser redimensionada a seguir arrastando o canto.
      const last = zones[zones.length - 1];
      const w = last ? last.w : 15;
      const h = last ? last.h : 15;
      commitZones([...zones, { id: uid(), w, h, dx: p.x - 53.5, dy: p.y - 35 }]);
    } else if (tool === 'text') {
      // Caixa de texto: entra com um texto de exemplo e fica logo
      // selecionada, para se escrever no campo do painel de baixo.
      const newId = uid();
      /* Nasce com "Texto" para se ver a caixa, mas o campo de escrita
         abaixo recebe o foco COM O TEXTO TODO SELECIONADO (ver o textarea
         do painel): a primeira tecla substitui a palavra, sem ser preciso
         apagá-la nem clicar na caixa. */
      colocarElemento({ id: newId, kind: 'text', x: p.x, y: p.y, text: 'Texto', size: 3 });
      setSelectedId(newId);
    } else if (MARKER_TOOLS.includes(tool)) {
      colocarElemento({ id: uid(), kind: tool, x: p.x, y: p.y });
    } else if (LINE_TOOLS.includes(tool)) {
      // Só faz sentido "colar" ao fim de uma seta anterior para os tipos
      // que entram em cadeias de animação (passe/corrida); linhas simples
      // são só desenho estático e não precisam disto.
      const start = (tool === 'arrow-pass' || tool === 'arrow-run')
        ? snapChainStart(tool, p.x, p.y)
        : p;
      // Regista já aqui, no início do traço, qual jogador/guarda-redes
      // (seta de corrida) ou bola (seta de passe) está mais próximo do
      // ponto de partida, e grava-o na própria seta como "dono" do
      // movimento. Sem isto, a animação só conseguia adivinhar o dono mais
      // tarde, por proximidade — e quando dois marcadores de equipas
      // diferentes ficam perto um do outro (ex.: dois "MC" sobrepostos),
      // podia agarrar o jogador errado e deslocá-lo ao longo da seta do
      // outro. Guardando o dono exato aqui, essa ambiguidade desaparece.
      let ownerId = null;
      if (tool === 'arrow-run') {
        const owner = nearestElementOfKind(['player', 'keeper', 'text'], start.x, start.y, 3.2);
        ownerId = owner ? owner.id : null;
      } else if (tool === 'arrow-pass') {
        const owner = nearestElementOfKind(['ball'], start.x, start.y, 3.2);
        ownerId = owner ? owner.id : null;
      }
      setDrawing({ type: tool, x1: start.x, y1: start.y, x2: start.x, y2: start.y, ownerId });
    } else {
      setSelectedId(null);
      setSelectedArrowId(null);
    }
  };
  const handleBgPointerMove = (e) => {
    if (laco) {
      const p = toPoint(e);
      setLaco(l => (l ? { ...l, x2: p.x, y2: p.y } : l));
      return;
    }
    if (aArrastarGrupo && arrastoGrupoRef.current) {
      const p = toPoint(e);
      const g = arrastoGrupoRef.current;
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (Math.hypot(dx, dy) > 0.6) g.moveu = true;
      if (!g.moveu) return;
      let curvas = value.deslizeCurvas;
      g.orig.forEach((_, id) => {
        if (curvas && curvas[id]) { const { [id]: _f, ...r } = curvas; curvas = r; }
      });
      onChange({
        ...value,
        elements: elements.map(el => (g.orig.has(el.id) ? { ...el, x: g.orig.get(el.id).x + dx, y: g.orig.get(el.id).y + dy } : el)),
        deslizeCurvas: curvas,
      });
      return;
    }
    if (erasing) {
      // Rato sem botão carregado = o "largar" perdeu-se: pára de apagar.
      if (!apagarAoMover(e)) setErasing(false);
      else eraseAt(toPoint(e));
    } else if (drawing) {
      const p = toPoint(e);
      setDrawing({ ...drawing, x2: p.x, y2: p.y });
    } else if (dragId) {
      const p = toPoint(e);
      if (dragStartRef.current && Math.hypot(p.x - dragStartRef.current.x, p.y - dragStartRef.current.y) > 0.6) setDragMoved(true);
      if (emRecuo) {
        /* Em recuo, arrastar corrige a posição a partir do passo que se
           está a ver até ao fim — a mesma regra "desde" já usada para
           texto, colocar e apagar. Sem isto, a correção só entrava no
           estado atual (invisível, porque a prancheta mostra o passo
           antigo) e nunca chegava a aparecer nem a valer para nada.

           Mas "desde" para a posição não pode ser igual a "desde" para o
           texto: texto CONGELA no valor novo dali para a frente (faz
           sentido, uma legenda não "continua a mudar" sozinha). Posição
           é diferente — se congelasse a mesma posição em todos os passos
           seguintes, a fotografia de cada passo dizia "ficou aqui
           parado", mas a seta gravada desse passo continuava a dizer
           "andou até ali", e a apresentação saltava entre as duas coisas
           contraditórias (o "flash" reportado).

           A correção certa é DESLOCAR o resto do percurso pela mesma
           distância, mantendo a forma do movimento já coreografado, só
           ancorado no novo ponto de partida — em vez de o apagar. */
        const atualRecuo = (elementosRecuo || []).find(el => el.id === dragId);
        const dx = atualRecuo ? p.x - atualRecuo.x : 0;
        const dy = atualRecuo ? p.y - atualRecuo.y : 0;
        const seq = value.sequence || [];
        const sequencia = seq.map((step, i) => {
          if (i < desdeValido) return step;
          return {
            ...step,
            elements: (step.elements || []).map(el => {
              if (el.id !== dragId) return el;
              return i === desdeValido ? { ...el, x: p.x, y: p.y } : { ...el, x: el.x + dx, y: el.y + dy };
            }),
            arrows: (step.arrows || []).map(a => {
              if (a.ownerId !== dragId) return a;
              /* No próprio passo que se está a corrigir, a seta é a que
                 TRAZ o jogador até aqui — só o PONTO DE CHEGADA (x2,y2)
                 acompanha a nova posição; o ponto de partida (x1,y1) fica
                 tal como estava, porque continua a começar no passo
                 anterior, que não mudou. Nos passos seguintes, já é o
                 caminho inteiro que se desloca pelo mesmo tanto, para a
                 forma do movimento se manter igual, só deslocada. */
              return i === desdeValido
                ? { ...a, x2: p.x, y2: p.y, cx: a.cx != null ? a.cx + dx : a.cx, cy: a.cy != null ? a.cy + dy : a.cy }
                : { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy, cx: a.cx != null ? a.cx + dx : a.cx, cy: a.cy != null ? a.cy + dy : a.cy };
            }),
          };
        });
        onChange({ ...value, elements: elements.map(el => (el.id === dragId ? { ...el, x: p.x, y: p.y } : el)), sequence: sequencia, deslizeCurvas: semCurvaDe(dragId) });
      } else {
        onChange({ ...value, elements: elements.map(el => (el.id === dragId ? { ...el, x: p.x, y: p.y } : el)), deslizeCurvas: semCurvaDe(dragId) });
      }
    } else if (dragHandle) {
      const p = toPoint(e);
      if (dragHandle.which === 'deslize') {
        /* O ponto puxado é o MEIO da curva; o controlo da curva fica a
           2·meio − (início+fim)/2, para a curva passar mesmo pelo dedo. */
        const ant = fimAnteriorMemo && fimAnteriorMemo.get(dragHandle.id);
        const el = (elementosRecuo || elements).find(x => x.id === dragHandle.id);
        if (ant && el) {
          onChange({ ...value, deslizeCurvas: { ...(value.deslizeCurvas || {}), [dragHandle.id]: { cx: 2 * p.x - (ant.x + el.x) / 2, cy: 2 * p.y - (ant.y + el.y) / 2 } } });
        }
      } else if (dragHandle.which === 'curve') {
        onChange({ ...value, arrows: arrows.map(a => a.id === dragHandle.id ? { ...a, cx: p.x, cy: p.y } : a) });
      } else {
        const key1 = dragHandle.which === 'start' ? 'x1' : 'x2';
        const key2 = dragHandle.which === 'start' ? 'y1' : 'y2';
        onChange({ ...value, arrows: arrows.map(a => a.id === dragHandle.id ? { ...a, [key1]: p.x, [key2]: p.y } : a) });
      }
    } else if (dragArrowId) {
      const p = toPoint(e);
      const ref = dragArrowRef.current;
      if (!ref) return;
      const dx = p.x - ref.start.x;
      const dy = p.y - ref.start.y;
      if (Math.hypot(dx, dy) > 0.6) setArrowMoved(true);
      onChange({
        ...value,
        arrows: arrows.map(a => (a.id === dragArrowId ? {
          ...a,
          x1: ref.orig.x1 + dx, y1: ref.orig.y1 + dy,
          x2: ref.orig.x2 + dx, y2: ref.orig.y2 + dy,
          // A curva (se alguma vez foi mexida) viaja junto com a seta —
          // senão, mover uma seta já curvada deixava a curva para trás,
          // desalinhada da nova posição.
          ...(ref.orig.cx != null ? { cx: ref.orig.cx + dx, cy: ref.orig.cy + dy } : {}),
        } : a)),
      });
    } else if (resizingZoneId) {
      const zone = zones.find(z => z.id === resizingZoneId);
      if (!zone) return;
      const p = toPoint(e);
      const cx = 53.5 + (zone.dx || 0), cy = 35 + (zone.dy || 0);
      const halfW = Math.max(2, Math.abs(p.x - cx));
      const halfH = Math.max(2, Math.abs(p.y - cy));
      setLiveZoneSize({ w: Math.round(halfW * 2), h: Math.round(halfH * 2) });
    } else if (dragZoneId) {
      const p = toPoint(e);
      const ref = dragZoneRef.current;
      if (!ref) return;
      const dx = ref.orig.dx + (p.x - ref.start.x);
      const dy = ref.orig.dy + (p.y - ref.start.y);
      onChange({ ...value, spaceZones: zones.map(z => (z.id === dragZoneId ? { ...z, dx, dy } : z)), spaceOffset: undefined });
    } else if (goalDrag) {
      const el = (elementosRecuo || elements).find(x => x.id === goalDrag.id);
      if (!el) return;
      const p = toPoint(e);
      const dx = p.x - el.x, dy = p.y - el.y;
      // Em recuo, a correção aplica-se do passo em vista até ao fim —
      // mesma regra "desde" já usada para arrastar, texto, colocar e
      // apagar (ver a nota junto do arrastar normal, mais acima). Recebe
      // um objeto com todos os campos de uma vez (não um a um), para
      // rodar/redimensionar nunca ter duas gravações seguidas a
      // pisarem-se uma à outra.
      const aplicar = (campos) => {
        if (emRecuo) {
          const seq = value.sequence || [];
          const sequencia = seq.map((step, i) => (i < desdeValido ? step : {
            ...step,
            elements: (step.elements || []).map(x => (x.id === el.id ? { ...x, ...campos } : x)),
          }));
          onChange({ ...value, elements: elements.map(x => x.id === el.id ? { ...x, ...campos } : x), sequence: sequencia });
        } else {
          onChange({ ...value, elements: elements.map(x => x.id === el.id ? { ...x, ...campos } : x) });
        }
      };
      if (goalDrag.mode === 'rotate') {
        // 0° = manípulo diretamente acima da baliza; roda livremente 0-360°
        let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
        deg = Math.round((deg + 360) % 360);
        aplicar({ rotation: deg });
      } else if (goalDrag.mode === 'resize') {
        // Traduz o ponteiro para o referencial local da baliza (des-roda),
        // para que arrastar o canto redimensione largura/altura de forma
        // independente e intuitiva, mesmo com a baliza rodada.
        const rad = (el.rotation || 0) * Math.PI / 180;
        const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
        const localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
        const w = Math.max(1.4, Math.min(16, +(Math.abs(localX) * 2).toFixed(2)));
        const h = Math.max(0.9, Math.min(11, +(Math.abs(localY) * 2).toFixed(2)));
        aplicar({ w, h });
      }
    }
  };
  const finishInteraction = (e) => {
    try { svgRef.current.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (laco) {
      // Entram todos os que ficam dentro do retângulo (menos as zonas).
      const x1 = Math.min(laco.x1, laco.x2), x2 = Math.max(laco.x1, laco.x2);
      const y1 = Math.min(laco.y1, laco.y2), y2 = Math.max(laco.y1, laco.y2);
      if (x2 - x1 > 0.8 || y2 - y1 > 0.8) {
        setGrupo(elements.filter(el => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2).map(el => el.id));
      }
      setLaco(null);
    }
    if (aArrastarGrupo) {
      const g = arrastoGrupoRef.current;
      // Toque sem arrastar num que já estava no grupo: sai do grupo.
      if (g && !g.moveu && g.tocado && g.jaEstava) setGrupo(gr => gr.filter(id => id !== g.tocado));
      arrastoGrupoRef.current = null;
      setAArrastarGrupo(false);
    }
    // Sempre, sem depender do estado lido neste render (um toque rápido
    // podia acabar antes de `erasing` ficar verdadeiro aqui).
    setErasing(false);
    if (drawing) {
      if (Math.hypot(drawing.x2 - drawing.x1, drawing.y2 - drawing.y1) > 0.8) {
        const novoId = uid();
        commit({ ...value, arrows: [...arrows, { id: novoId, ...drawing }] });
        // Fica logo selecionada — é assim que a pega de curvar (o ponto do
        // meio) aparece de imediato, sem ser preciso tocar na seta outra
        // vez só para a poder curvar.
        setSelectedArrowId(novoId);
        setSelectedId(null);
      }
      setDrawing(null);
    }
    if (dragId) {
      if (tool === 'select' && !dragMoved) setSelectedId(dragId);
      setDragId(null);
    }
    if (dragHandle) setDragHandle(null);
    if (dragZoneId) setDragZoneId(null);
    if (resizingZoneId) {
      if (liveZoneSize) {
        commitZones(zones.map(z => (z.id === resizingZoneId ? { ...z, w: liveZoneSize.w, h: liveZoneSize.h } : z)));
      }
      setResizingZoneId(null);
      setLiveZoneSize(null);
    }
    if (dragArrowId) {
      if (tool === 'select' && !arrowMoved) setSelectedArrowId(dragArrowId);
      setDragArrowId(null);
    }
    if (goalDrag) setGoalDrag(null);
  };
  // Placing an element on top of an existing one, or using "select"/edit,
  // always allows dragging it right away — no tool switch required.
  const onElementDown = (e, id) => {
    e.stopPropagation();
    if (tool === 'multi') {
      if (emRecuo) return; // em "desde animar" arrastar é corrigir: não há grupos
      try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      // Tocar num que não está no grupo junta-o; tocar e arrastar mexe o grupo todo.
      const jaEstava = grupo.includes(id);
      const novoGrupo = jaEstava ? grupo : [...grupo, id];
      if (!jaEstava) setGrupo(novoGrupo);
      beginGesture();
      arrastoGrupoRef.current = {
        start: toPoint(e), moveu: false, tocado: id, jaEstava,
        orig: new Map(elements.filter(el => novoGrupo.includes(el.id)).map(el => [el.id, { x: el.x, y: el.y }])),
      };
      setAArrastarGrupo(true);
      return;
    }
    if (tool === 'eraser') {
      try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      setErasing(true);
      // Tocou em cima deste: apaga exatamente este, e só este.
      eraseAt(toPoint(e), { tipo: 'el', id });
      return;
    }
    beginGesture();
    // Traz o elemento tocado para cima de tudo o resto que não seja
    // bola — sem isto, quem foi colocado mais cedo ficava sempre por
    // baixo de quem veio depois, mesmo arrastando um por cima do
    // outro agora. A bola é a única exceção a este "por cima de quem
    // se mexeu por último": fica sempre por cima de tudo, mesmo que se
    // lhe toque — ver o ordenamento usado no desenho, mais abaixo.
    const semEste = elements.filter(el => el.id !== id);
    const este = elements.find(el => el.id === id);
    if (este) onChange({ ...value, elements: [...semEste, este] });
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    dragStartRef.current = toPoint(e);
    setDragMoved(false);
    setDragId(id);
  };
  const onArrowDown = (e, id) => {
    e.stopPropagation();
    if (tool === 'eraser') {
      try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      setErasing(true);
      eraseAt(toPoint(e), { tipo: 'seta', id });
      return;
    }
    beginGesture();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const arrow = arrows.find(a => a.id === id);
    if (!arrow) return;
    dragArrowRef.current = { start: toPoint(e), orig: { x1: arrow.x1, y1: arrow.y1, x2: arrow.x2, y2: arrow.y2, cx: arrow.cx, cy: arrow.cy } };
    setArrowMoved(false);
    setDragArrowId(id);
  };
  // A curva de um arrasto só vale para a posição em que foi feita.
  const semCurvaDe = (id) => {
    const c = value.deslizeCurvas;
    if (!c || !c[id]) return c;
    const { [id]: _fora, ...resto } = c;
    return resto;
  };
  // Puxar o ponto do meio do caminho de quem foi arrastado.
  const onDeslizeDown = (e, id) => {
    e.stopPropagation();
    beginGesture();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    setDragHandle({ id, which: 'deslize' });
  };
  const onHandleDown = (e, id, which) => {
    e.stopPropagation();
    beginGesture();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    setSelectedArrowId(id);
    setDragHandle({ id, which });
  };
  const onGoalRotateDown = (e, id) => {
    e.stopPropagation();
    beginGesture();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    setSelectedId(id);
    setGoalDrag({ id, mode: 'rotate' });
  };
  const onGoalResizeDown = (e, id) => {
    e.stopPropagation();
    beginGesture();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    setSelectedId(id);
    setGoalDrag({ id, mode: 'resize' });
  };
  const onZonePointerDown = (e, zoneId) => {
    e.stopPropagation();
    beginGesture();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const zone = zones.find(z => z.id === zoneId);
    dragZoneRef.current = { start: toPoint(e), orig: { dx: zone?.dx || 0, dy: zone?.dy || 0 } };
    setDragZoneId(zoneId);
  };
  const onZoneResizeDown = (e, zoneId) => {
    e.stopPropagation();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const zone = zones.find(z => z.id === zoneId);
    setLiveZoneSize(zone ? { w: zone.w, h: zone.h } : { w: 20, h: 20 });
    setResizingZoneId(zoneId);
  };
  const changeSelectedNumber = (delta) => {
    if (!selectedEl) return;
    if (rotulosEsquema === 'numero' && (selectedEl.kind === 'player' || selectedEl.kind === 'keeper')) {
      // Número da camisola (1–99). É a identidade do jogador, por isso
      // muda também nos passos da animação.
      const atual = Number(rotuloIcone(selectedEl)) || 1;
      const n = ((atual - 1 + delta + 99) % 99) + 1;
      const mudar = (lista) => (lista || []).map(el => (el && el.id === selectedEl.id ? { ...el, camisola: n } : el));
      commit({ ...value, elements: mudar(elements), sequence: Array.isArray(value.sequence) ? value.sequence.map(st => (st && st.elements ? { ...st, elements: mudar(st.elements) } : st)) : value.sequence });
      return;
    }
    if (selectedEl.kind === 'player') {
      const n = Math.max(2, Math.min(11, (selectedEl.number || 2) + delta));
      commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? { ...el, number: n } : el)) });
    } else if (selectedEl.kind === 'keeper') {
      const idx = KEEPER_NUMBERS.indexOf(selectedEl.number);
      const nextIdx = ((idx === -1 ? 0 : idx) + delta + KEEPER_NUMBERS.length) % KEEPER_NUMBERS.length;
      commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? { ...el, number: KEEPER_NUMBERS[nextIdx] } : el)) });
    }
  };
  const changeSelectedText = (text) => {
    if (!selectedEl || selectedEl.kind !== 'text') return;
    const novoEl = clampTextElement({ ...selectedEl, text });
    const seq = value.sequence || [];
    const desde = desdeValido;
    /* Mesma lógica de "desde" usada para colocar e para apagar: a
       edição só vale a partir do passo mais recente (ou do que estiver
       escolhido à mão) — os passos anteriores mantêm o texto tal como
       estava quando foram gravados, exatamente como já acontece com a
       posição. Sem isto, mudar o texto reescrevia sozinho o histórico
       inteiro da animação. */
    const sequencia = (desde == null || !seq.length)
      ? seq
      : seq.map((step, i) => (i < desde ? step : {
          ...step,
          elements: (step.elements || []).map(el => (el.id === selectedEl.id ? { ...el, text: novoEl.text, w: novoEl.w, h: novoEl.h } : el)),
        }));
    commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? novoEl : el)), sequence: sequencia });
  };
  // Largura da caixa em caracteres por linha: é o que permite ter uma
  // legenda estreita e alta em vez de uma faixa que atravessa o campo.
  const changeSelectedTextWrap = (delta) => {
    if (!selectedEl || selectedEl.kind !== 'text') return;
    const wrap = Math.max(8, Math.min(60, (selectedEl.wrap || 26) + delta));
    commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? clampTextElement({ ...el, wrap }) : el)) });
  };

  /* Duplicar: a cópia é um elemento novo, com id próprio, e por isso pode
     receber setas de movimento e entrar na animação como qualquer outro.
     Fica ligeiramente ao lado, para não tapar o original. */
  const duplicateSelected = () => {
    if (!selectedEl) return;
    const copia = { ...selectedEl, id: uid(), x: selectedEl.x + 3, y: selectedEl.y + 2.5 };
    commit({ ...value, elements: [...elements, copia] });
    setSelectedId(copia.id);
  };

  const changeSelectedTextSize = (delta) => {
    if (!selectedEl || selectedEl.kind !== 'text') return;
    const size = Math.max(1.5, Math.min(8, (selectedEl.size || 3) + delta));
    commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? { ...el, size } : el)) });
  };
  const changeSelectedRotation = (delta) => {
    if (!selectedEl) return;
    const r = ((selectedEl.rotation || 0) + delta + 360) % 360;
    commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? { ...el, rotation: r } : el)) });
  };
  const setSelectedRotation = (deg) => {
    if (!selectedEl) return;
    commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? { ...el, rotation: deg } : el)) });
  };
  const changeSelectedScale = (delta) => {
    if (!selectedEl) return;
    const curW = selectedEl.w != null ? selectedEl.w : 3.6 * (selectedEl.scale || 1);
    const curH = selectedEl.h != null ? selectedEl.h : 2.2 * (selectedEl.scale || 1);
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    const w = Math.max(1.4, Math.min(16, +(curW * factor).toFixed(2)));
    const h = Math.max(0.9, Math.min(11, +(curH * factor).toFixed(2)));
    commit({ ...value, elements: elements.map(el => (el.id === selectedEl.id ? { ...el, w, h } : el)) });
  };
  const deleteSelected = () => {
    commit({
      ...value,
      elements: elements.filter(el => el.id !== selectedId),
      // Ver limparDosPassos: com "desde" escolhido, mantém-se nos passos
      // anteriores e só sai a partir desse ponto da animação.
      sequence: limparDosPassos(value.sequence, new Set([selectedId]), desdeValido),
    });
    setSelectedId(null);
  };
  const deleteSelectedArrow = () => {
    commit({ ...value, arrows: arrows.filter(a => a.id !== selectedArrowId) });
    setSelectedArrowId(null);
  };
  const doPrint = () => {
    setPrintOpen(true);
    imprimirComNome([exerciseInfo?.name, exerciseInfo?.phase].filter(Boolean).join(' · '));
  };
  const clearAll = () => {
    // Limpa os itens, mas mantém a vista (meio-campo fica em meio-campo) e
    // o que se mostra nos círculos (Posição / Nº / Cor).
    commit({ elements: [], arrows: [], sequence: [], ...(value && value.vista ? { vista: value.vista } : {}), ...(value && value.rotulos ? { rotulos: value.rotulos } : {}) });
    setSelectedId(null);
    setSelectedArrowId(null);
    if (onClearAll) onClearAll();
  };
  // Aplica uma nova lista de zonas de espaço reduzido e avisa o formulário
  // pai (para atualizar o texto mostrado no campo Espaço, derivado das
  // zonas atuais — ver describeSpaceZones).
  const commitZones = (newZones) => {
    /* Assim que uma zona é mexida à mão, deixa de ser "a grande área" e
       passa a ser um retângulo qualquer: tira-se o nome, para o rótulo
       desenhado não contradizer o texto do campo Espaço (que a partir daí
       mostra medidas). */
    const semNome = newZones.map(z => (z.label ? { ...z, label: undefined } : z));
    commit({ ...value, spaceZones: semNome, spaceOffset: undefined });
    if (onSpaceZonesChange) onSpaceZonesChange(semNome);
  };
  const deleteZone = (zoneId) => {
    commitZones(zones.filter(z => z.id !== zoneId));
  };

  // O botão Animar (no telemóvel numa linha própria; no computador na linha das animações).
  const botaoAnimar = (arrows.some(a => a.type === 'arrow-pass' || a.type === 'arrow-run') || haArrastos || isPlaying) ? (
          <button
            type="button"
            onClick={isPlaying ? stopAnimation : playAnimation}
            title={isPlaying ? 'Parar animação' : 'Animar deslocamentos (bola no passe, jogador na corrida, e quem foi arrastado desliza)'}
            style={{
              padding: '7px 14px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', ...body,
              background: isPlaying ? T.bad : T.crimsonBright,
              color: T.cream, border: `1px solid ${isPlaying ? T.bad : T.crimsonBright}`,
              display: 'flex', alignItems: 'center', gap: 6, minHeight: 34,
            }}
          >
            {isPlaying ? <Square size={13} /> : <Play size={13} />}
            {isPlaying ? 'Parar' : 'Animar'}
          </button>
  ) : null;
  /* Painéis do elemento e da linha selecionados (ver onde são mostrados). */
  const painelElemento = selectedEl ? (
        <div>
        {/* NUNCA quebra para uma segunda linha (nowrap + scroll horizontal
            em vez de flexWrap).

            Isto tinha `flexWrap: 'wrap'`: em ecrãs mais estreitos, ou com
            texto/baliza selecionados (que têm mais controlos), a linha não
            cabia e quebrava para duas — o painel ficava mais alto do que o
            espaço reservado ali em baixo (`minHeight: 92`), e era isso que
            fazia o campo encolher ao selecionar o primeiro item. Com altura
            sempre igual (uma linha só), o campo deixa de reagir. */}
        {/* NO TELEMÓVEL QUEBRA EM RETÂNGULO; EM ECRÃ LARGO FICA NUMA LINHA.

            Estava sempre numa linha com scroll horizontal: para chegar ao
            "Horizontal" ou ao zoom era preciso arrastar a barra para o
            lado, às cegas, sem sinal de que havia mais à direita. Uma
            barra de ferramentas que se descobre por acaso não é uma barra
            de ferramentas.

            A razão original para a linha única continua válida — altura
            variável fazia o campo encolher ao selecionar um elemento — e
            por isso o que muda não é deixar o conteúdo mandar na altura,
            é reservar mais espaço no telemóvel e deixá-lo quebrar dentro
            desse espaço. */}
        <div className="mjp-painel-selecao" ref={painelSelecaoRef} style={{
          display: 'flex', alignItems: 'center', gap: isNarrowEditor ? 8 : 10,
          padding: isNarrowEditor ? '7px 8px' : '0 10px', background: T.bg,
          border: `1px solid ${T.line}`, borderRadius: '7px 7px 0 0',
          flexWrap: isNarrowEditor ? 'wrap' : 'nowrap',
          overflowX: isNarrowEditor ? 'visible' : 'auto',
          overflowY: isNarrowEditor ? 'visible' : 'hidden',
          /* Altura fixa e não `padding` a decidi-la: com `height` (em vez de
             deixar o conteúdo esticar a caixa), uma barra de scroll
             horizontal fica DENTRO dos 38px, nunca a acrescentar-lhes.
             É isto, mais a barra escondida acima, que impede o painel de
             ultrapassar os 92px reservados — e por consequência, que impede
             o campo de encolher ao selecionar a Baliza ou abrir o texto. */
          ...(isNarrowEditor ? { minHeight: 38 } : { height: 38 }),
          boxSizing: 'border-box',
        }}>
          <span style={{ fontSize: 12, color: T.cream, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {selectedEl.kind === 'player' || selectedEl.kind === 'keeper'
              ? `${teamInfo(selectedEl.team)?.label} · ${selectedEl.rotulo === 'numero' ? `nº ${rotuloIcone(selectedEl)}` : elementLabel(selectedEl.number, selectedEl.kind === 'keeper')}${selectedEl.nome ? ` · ${selectedEl.nome}` : ''}`
              : selectedEl.kind === 'goalmarker' ? 'Baliza' : selectedEl.kind === 'stake' ? 'Estaca' : selectedEl.kind === 'coach' ? 'Treinador' : selectedEl.kind === 'text' ? 'Texto' : selectedEl.kind === 'cone' ? 'Cone' : 'Bola'}
          </span>
          {selectedEl.kind === 'text' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              ...(isNarrowEditor
                ? { flexWrap: 'wrap', width: '100%' }
                : { marginLeft: 'auto', flexWrap: 'nowrap' }),
            }}>
              {/* Área de texto e não campo de linha: o Enter passa a
                  baixar de linha em vez de não fazer nada. */}
              <textarea
                value={selectedEl.text || ''}
                onChange={e => changeSelectedText(e.target.value)}
                placeholder="Escreve aqui (Enter para nova linha)"
                rows={1}
                /* SEM `autoFocus`.

                   O atributo `autoFocus` do HTML dá o foco assim que o
                   elemento aparece e ARRASTA A JANELA para o trazer à vista.
                   Como este campo está por baixo da prancheta, colocar uma
                   caixa de texto fazia o editor saltar para baixo — e não há
                   opção para o desligar.

                   O foco é dado aqui em baixo, à mão, com `preventScroll`:
                   o cursor fica no sítio certo e a janela não se mexe. */
                ref={(el) => {
                  if (!el || el.dataset.iniciado === '1') return;
                  el.dataset.iniciado = '1';
                  if ((selectedEl.text || '') === 'Texto') {
                    /* `preventScroll` é essencial: sem ele o browser rola a
                       janela para trazer o campo à vista, e o editor salta
                       de sítio a meio de um desenho. */
                    try { el.focus({ preventScroll: true }); el.setSelectionRange(0, el.value.length); } catch (err) { /* sem suporte: escreve-se normalmente */ }
                  }
                }}
                style={{
                  background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, padding: '5px 8px',
                  color: T.cream, fontSize: 12.5, ...body, outline: 'none', width: 170, flexShrink: 0,
                  /* "resize: vertical" deixava o próprio user arrastar a
                     caixa mais alta, o que voltava a fazer o painel
                     ultrapassar a altura reservada — mesmo bug, causa
                     diferente. A caixa continua a aceitar várias linhas
                     (Enter), só se rola dentro dela, não cresce. */
                  resize: 'none', overflowY: 'auto', overflowX: 'hidden', lineHeight: 1.35,
                  /* No telemóvel: linha própria, largura toda e três linhas
                     de altura. Com 22px de altura via-se uma linha e o
                     resto do que se escrevia ficava escondido — escrever
                     às cegas dentro de uma caixa de 2 cm. */
                  ...(isNarrowEditor
                    ? { width: '100%', flex: '1 1 100%', minHeight: 54, maxHeight: 72 }
                    : { maxHeight: 22 }),
                }}
                onFocus={(e) => {
                  /* O teclado do telemóvel ocupa metade do ecrã e tapa
                     esta caixa. Agora que o editor abre a página inteira
                     (não uma janela pequena), a página à volta é bem mais
                     comprida — usar sempre `block:'center'` recentrava a
                     caixa a meio da página TODA, um salto grande e visível
                     mesmo quando a caixa já estava perto de estar visível.
                     `block:'nearest'` só mexe o mínimo preciso para tirá-la
                     de baixo do teclado.

                     Em vez de um tempo fixo a adivinhar quando o teclado
                     abriu, ouve-se o `visualViewport` (dispara quando o
                     teclado encolhe mesmo o ecrã) — mais fiável entre
                     telemóveis. Um temporizador fica de rede de segurança
                     para quem não suporta essa API (e no desktop, onde
                     nunca há teclado a abrir, só confirma que já está à
                     vista, sem mexer em nada). */
                  const alvo = e.currentTarget;
                  const scrollParaVista = () => {
                    try { alvo.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (err) { /* browsers antigos */ }
                  };
                  const vv = window.visualViewport;
                  if (vv) {
                    let feito = false;
                    const aoRedimensionar = () => { if (feito) return; feito = true; scrollParaVista(); };
                    vv.addEventListener('resize', aoRedimensionar, { once: true });
                    setTimeout(() => {
                      if (feito) return;
                      feito = true;
                      vv.removeEventListener('resize', aoRedimensionar);
                      scrollParaVista();
                    }, 500);
                  } else {
                    setTimeout(scrollParaVista, 320);
                  }
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: isNarrowEditor ? 'wrap' : 'nowrap' }}>
                <span style={{ fontSize: 10.5, color: T.mutedDim, whiteSpace: 'nowrap' }}>Tam.</span>
                <button type="button" onClick={() => changeSelectedTextSize(-0.5)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>−</button>
                <button type="button" onClick={() => changeSelectedTextSize(0.5)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>+</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: isNarrowEditor ? 'wrap' : 'nowrap' }}>
                <span style={{ fontSize: 10.5, color: T.mutedDim, whiteSpace: 'nowrap' }} title="Largura da caixa: menos = caixa mais estreita e mais linhas">Largura</span>
                <button type="button" onClick={() => changeSelectedTextWrap(-4)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>−</button>
                <button type="button" onClick={() => changeSelectedTextWrap(4)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>+</button>
              </div>
            </div>
          )}
          {(selectedEl.kind === 'player' || selectedEl.kind === 'keeper') && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              ...(isNarrowEditor ? { flexShrink: 1, minWidth: 0 } : { marginLeft: 'auto', flexShrink: 0 }),
            }}>
              <button type="button" onClick={() => changeSelectedNumber(-1)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>−</button>
              <span style={{ ...mono, color: T.warn, width: 30, textAlign: 'center', flexShrink: 0 }}>{rotulosEsquema === 'numero' ? rotuloIcone(selectedEl) : elementLabel(selectedEl.number, selectedEl.kind === 'keeper')}</span>
              <button type="button" onClick={() => changeSelectedNumber(1)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>+</button>
              {convocadosDoJogo.length > 0 && (
                <Select value={selectedEl.playerId || ''} onChange={e => atribuirConvocado(e.target.value)} title="Quem é este jogador (dá-lhe o número e o nome)"
                  style={{ width: 'auto', maxWidth: 170, height: 24, lineHeight: '22px', fontSize: 11.5, padding: '0 6px', borderRadius: 6, marginLeft: 4 }}>
                  <option value="">Quem é…</option>
                  {[...convocadosDoJogo].sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999)).map(p => (
                    <option key={p.id} value={p.id}>{p.number != null && String(p.number).trim() !== '' ? `${p.number} · ` : ''}{nomeNoIcone(p)}</option>
                  ))}
                </Select>
              )}
            </div>
          )}
          {selectedEl.kind === 'goalmarker' && (
            <div
              title="Arrasta o ponto dourado de cima para rodar livremente · arrasta o quadrado do canto para redimensionar"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                /* A CAIXA TEM DE PODER ENCOLHER PARA OS FILHOS QUEBRAREM.

                   Estava com `flexShrink: 0`: quebrava por dentro, mas ela
                   própria recusava-se a ficar mais estreita do que o
                   conteúdo, e por isso saía para fora do ecrã com o zoom
                   pendurado à direita. Dar-lhe a largura toda e deixá-la
                   encolher é o que faz os grupos passarem para a linha de
                   baixo em vez de transbordarem. */
                ...(isNarrowEditor
                  ? { flexWrap: 'wrap', width: '100%', flexShrink: 1, minWidth: 0 }
                  : { flexWrap: 'nowrap', flexShrink: 0, marginLeft: 'auto' }),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: isNarrowEditor ? 'wrap' : 'nowrap' }}>
                <RotateCw size={12} color={T.mutedDim} />
                <button type="button" onClick={() => changeSelectedRotation(-15)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>↺</button>
                <button type="button" onClick={() => changeSelectedRotation(15)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>↻</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, flexWrap: isNarrowEditor ? 'wrap' : 'nowrap' }}>
                {[
                  { deg: 0, label: 'Vertical' },
                  { deg: 45, label: 'Diagonal' },
                  { deg: 90, label: 'Horizontal' },
                ].map(o => (
                  <button
                    key={o.deg}
                    type="button"
                    title={o.label}
                    onClick={() => setSelectedRotation(o.deg)}
                    style={{
                      padding: '3px 8px', borderRadius: 5, fontSize: 10.5, cursor: 'pointer', ...body,
                      background: (selectedEl.rotation || 0) === o.deg ? '#B5393F' : 'transparent',
                      color: (selectedEl.rotation || 0) === o.deg ? TEXT_ON_ACCENT : T.cream,
                      border: `1px solid ${(selectedEl.rotation || 0) === o.deg ? '#B5393F' : T.line}`,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: isNarrowEditor ? 'wrap' : 'nowrap' }}>
                <Maximize2 size={12} color={T.mutedDim} />
                <button type="button" onClick={() => changeSelectedScale(-0.2)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>−</button>
                <button type="button" onClick={() => changeSelectedScale(0.2)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, cursor: 'pointer', flexShrink: 0 }}>+</button>
              </div>
            </div>
          )}
          <button type="button" onClick={duplicateSelected} title="Cria uma cópia — pode receber setas e entrar na animação como qualquer elemento" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.cream, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: (selectedEl.kind === 'player' || selectedEl.kind === 'keeper' || selectedEl.kind === 'goalmarker') ? 0 : 'auto' }}><Copy size={12} /> Duplicar</button>
          <button type="button" onClick={deleteSelected} style={{ fontSize: 11.5, color: T.bad, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Apagar</button>
          <button type="button" onClick={() => setSelectedId(null)} style={{ fontSize: 11.5, color: T.mutedDim, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Fechar</button>
        </div>
        </div>
  ) : null;
  const painelSeta = selectedArrow ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '7px 10px', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 7 }}>
          <span style={{ fontSize: 12, color: T.cream }}>{LINE_LABELS[selectedArrow.type] || 'Linha'} — arrasta as pontas douradas para mudar o ângulo e o comprimento</span>
          <button type="button" onClick={deleteSelectedArrow} style={{ fontSize: 11.5, color: T.bad, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>Apagar</button>
          <button type="button" onClick={() => setSelectedArrowId(null)} style={{ fontSize: 11.5, color: T.mutedDim, background: 'none', border: 'none', cursor: 'pointer' }}>Fechar</button>
        </div>
  ) : null;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: T.mutedDim }}>Cor:</span>
        {TEAMS.map(tm => (
          <button
            key={tm.id}
            type="button"
            // Responde a pointerdown (tal como o campo) em vez de onClick:
            // evita reagir a um clique de compatibilidade que alguns
            // browsers/webviews móveis podem disparar noutro elemento
            // pouco depois de o ecrã mudar (ex.: ao colocar um jogador).
            onPointerDown={(e) => { e.preventDefault(); selectColor(tm.id, e); }}
            title={tm.label}
            style={{
              width: 24, height: 24, borderRadius: '50%', background: tm.fill, cursor: 'pointer', padding: 0,
              border: activeColor === tm.id ? `2px solid ${T.gold}` : '1px solid #00000055',
              boxShadow: activeColor === tm.id ? '0 0 0 2px #12100C' : 'none', flexShrink: 0,
            }}
          />
        ))}
        <span style={{ fontSize: 11, color: T.warn }}>{teamInfo(activeColor).label}</span>
        {/* O QUE APARECE NO CÍRCULO DOS JOGADORES — para o esquema inteiro
            (ver ROTULOS_JOGADOR). Fica nesta linha, que tinha espaço livre,
            para as ferramentas e o campo não mexerem. */}
        <div title="O que aparece no círculo dos jogadores (no esquema todo)" style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: T.mutedDim }}>Mostrar:</span>
          <div style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 16, overflow: 'hidden' }}>
            {ROTULOS_JOGADOR.map(r => (
              <button key={r.id} type="button" title={r.title} onPointerDown={(e) => { e.preventDefault(); mudarRotulos(r.id); }}
                style={{
                  padding: '0 10px', height: 22, fontSize: 12, cursor: 'pointer', border: 'none', ...body,
                  background: rotulosEsquema === r.id ? T.gold : 'transparent', color: rotulosEsquema === r.id ? TEXT_ON_ACCENT : T.muted,
                  fontWeight: rotulosEsquema === r.id ? 600 : 400,
                }}>{r.label}</button>
            ))}
          </div>
        </div>
        {/* Empurra o resto (convocados, treino, vista) para a direita. */}
        <span aria-hidden="true" style={{ flex: 1, minWidth: 0 }} />
        {/* CONVOCADOS DO JOGO — só numa ideia para um jogo específico. */}
        {jogoDoEsquema && (
          <button type="button" onClick={carregarConvocados} disabled={!convocadosDoJogo.length}
            title={convocadosDoJogo.length ? 'Junta os convocados: titulares nos lugares do onze, suplentes numa fila fora do campo, com número e nome' : 'Este jogo ainda não tem convocados'}
            style={{
              height: 24, padding: '0 12px', borderRadius: 16, fontSize: 12, ...body, flexShrink: 0,
              border: `1px solid ${T.line}`, background: 'transparent', color: convocadosDoJogo.length ? T.cream : T.mutedDim,
              cursor: convocadosDoJogo.length ? 'pointer' : 'not-allowed', opacity: convocadosDoJogo.length ? 1 : 0.55,
            }}>Convocados do jogo</button>
        )}
        {/* JOGADORES DO TREINO — carrega os presentes de uma sessão do
            Planeamento (hoje primeiro), nos lugares do Quadro de posições. */}
        {sessoesCarregaveis.length > 0 && (
          <Select value="" onChange={e => { carregarSessao(e.target.value); e.target.value = ''; }}
            title="Junta ao campo os jogadores presentes num treino do Planeamento, com o nome e nos lugares do Quadro de posições, na cor escolhida"
            style={{ width: 'auto', maxWidth: 260, height: 30, lineHeight: '28px', fontSize: 12, padding: '0 8px', borderRadius: 16 }}>
            <option value="">Jogadores do treino…</option>
            {sessoesCarregaveis.map(s => {
              const n = (s.attendance || []).length + (s.convidados || []).length;
              const quando = s.date === todayStr() ? 'Hoje' : fmtShort(s.date);
              return <option key={s.id} value={s.id}>{quando}{s.focus ? ` · ${String(s.focus).slice(0, 28)}` : ''} · {n} jogadores</option>;
            })}
          </Select>
        )}
        {/* VISTA DO CAMPO — campo inteiro (horizontal) ou meio-campo
            (vertical). Só muda o enquadramento: nada do desenho se perde. */}
        <div style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 16, overflow: 'hidden', flexShrink: 0 }}>
          {[['completo', 'Campo inteiro'], ['meio', 'Meio-campo']].map(([id, rot]) => (
            <button key={id} type="button" onPointerDown={(e) => { e.preventDefault(); mudarVista(id); }}
              title={id === 'meio' ? 'Meio-campo na vertical, com a baliza em cima' : 'Campo inteiro na horizontal'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', border: 'none', cursor: 'pointer', ...body, fontSize: 12,
                background: vistaCampo === id ? T.gold : 'transparent', color: vistaCampo === id ? TEXT_ON_ACCENT : T.muted,
              }}>
              <svg width={id === 'meio' ? 11 : 16} height={id === 'meio' ? 14 : 11} viewBox={id === 'meio' ? '0 0 11 14' : '0 0 16 11'} aria-hidden="true">
                {id === 'meio'
                  ? <><rect x="0.75" y="0.75" width="9.5" height="12.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="3" y="0.75" width="5" height="3" fill="none" stroke="currentColor" strokeWidth="1" /></>
                  : <><rect x="0.75" y="0.75" width="14.5" height="9.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><line x1="8" y1="0.75" x2="8" y2="10.25" stroke="currentColor" strokeWidth="1" /></>}
              </svg>
              {rot}
            </button>
          ))}
        </div>
      </div>

      {/* No telemóvel os botões entram numa grelha de colunas iguais: com
          `flex-wrap` cada linha ficava com uma largura diferente e o bloco
          parecia desalinhado. Em ecrã largo mantém-se a linha corrida. */}
      {/* `minmax(0, 1fr)` e não `1fr`.

          Um `1fr` é na verdade `minmax(auto, 1fr)`, e esse `auto` é a
          largura MÍNIMA do conteúdo. Com um botão a dizer
          "Mover / Selecionar" sem quebra de linha, a coluna era forçada a
          essa largura, as quatro colunas somavam mais do que o ecrã e a
          grelha transbordava — daí os botões terem tamanhos diferentes e a
          página arrastar-se de lado.

          Com `minmax(0, 1fr)` as colunas podem encolher abaixo do
          conteúdo, ficam todas iguais, e o texto quebra em duas linhas
          quando é preciso. */}
      <div style={{
        marginBottom: 8,
        ...(isNarrowEditor
          ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }
          : { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }),
      }}>
        {BASE_TOOLS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={t.title || t.label}
            style={{
              padding: t.symbol ? '6px 8px' : '6px 6px', borderRadius: 7, fontSize: isNarrowEditor ? 12 : 12.5, cursor: 'pointer', ...body,
              background: tool === t.id ? '#B5393F' : 'transparent',
              color: tool === t.id ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${tool === t.id ? '#B5393F' : T.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 34,
              // No telemóvel o texto pode quebrar; em linha corrida não.
              whiteSpace: isNarrowEditor ? 'normal' : 'nowrap',
              textAlign: 'center', lineHeight: 1.15, minWidth: 0, overflow: 'hidden',
            }}
          >
            {t.symbol === 'solid' && (
              <svg width="18" height="10" viewBox="0 0 18 10"><line x1="1" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="2" /></svg>
            )}
            {t.symbol === 'dashed' && (
              <svg width="18" height="10" viewBox="0 0 18 10"><line x1="1" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.1,5" /></svg>
            )}
            {t.symbol === 'square' && (
              <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1.6" y="1.6" width="10.8" height="10.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4,1.8" /></svg>
            )}
            {!t.symbol && (isNarrowEditor && t.curto ? t.curto : t.label)}
          </button>
        ))}
        {/* DESFAZER / REFAZER / IMPRIMIR / LIMPAR TUDO — ações sobre o
            DESENHO, não sobre a animação (essa tem a sua própria linha,
            mais abaixo). Estavam antes numa linha à parte, por baixo do
            campo; seguem agora a par das restantes ferramentas, no fim da
            mesma linha.

            Um SÓ grupo, com `flexWrap: 'nowrap'` — "Limpar tudo" era um
            item separado do resto (undo/redo/imprimir), e o wrap decide-se
            por item, não pelo espaço que sobra na linha: "Limpar tudo"
            saltava sozinho para a linha de baixo mesmo havendo espaço
            visível a seguir ao imprimir. Agrupados, ou cabem todos juntos
            ou quebram todos juntos — nunca um sozinho, à parte. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Retroceder (Ctrl+Z)"
              style={{
                width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: `1px solid ${T.line}`,
                color: canUndo ? T.cream : T.mutedDim, cursor: canUndo ? 'pointer' : 'not-allowed',
                opacity: canUndo ? 1 : 0.5, flexShrink: 0,
              }}
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Y)"
              style={{
                width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: `1px solid ${T.line}`,
                color: canRedo ? T.cream : T.mutedDim, cursor: canRedo ? 'pointer' : 'not-allowed',
                opacity: canRedo ? 1 : 0.5, flexShrink: 0,
              }}
            >
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              onClick={doPrint}
              title="Imprimir prancheta"
              style={{
                width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#B5393F', border: '1px solid #B5393F', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Printer size={14} color={TEXT_ON_ACCENT} />
            </button>
          </div>
          {/* Sempre presente (apagado quando não há nada): antes só aparecia
              com algo no campo, a barra ficava mais comprida ao colocar o
              primeiro jogador, partia para a linha de baixo e a página mexia. */}
          {(() => {
            const temAlgo = elements.length > 0 || arrows.length > 0 || zones.length > 0;
            return (
              <button
                type="button"
                onClick={temAlgo ? clearAll : undefined}
                disabled={!temAlgo}
                title="Limpar tudo"
                style={{
                  width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: `1px solid ${T.line}`, color: T.mutedDim, cursor: temAlgo ? 'pointer' : 'not-allowed', flexShrink: 0,
                  opacity: temAlgo ? 1 : 0.5,
                }}
              >
                <Trash2 size={14} />
              </button>
            );
          })()}
        </div>
      </div>
      {tool === 'multi' ? (
        /* "Vários": atalhos para escolher uma equipa inteira de uma vez. */
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: isNarrowEditor ? 'wrap' : 'nowrap', overflow: 'hidden', minHeight: 26, marginBottom: 6, fontSize: 11.5, color: T.mutedDim, ...body }}>
          {emRecuo ? (
            <span style={{ color: T.warn }}>Em "desde animar" arrastar serve para corrigir o passo. Para mexer vários em bloco, escolhe "só agora".</span>
          ) : (
            <>
              <span>Desenha um retângulo à volta (ou toca em cada um) e arrasta o grupo. Depois, Animar.</span>
              {TEAMS.filter(t => elements.some(el => (el.kind === 'player' || el.kind === 'keeper') && (el.team || 'A') === t.id)).map(t => (
                <button key={t.id} type="button"
                  onClick={() => setGrupo(elements.filter(el => (el.kind === 'player' || el.kind === 'keeper') && (el.team || 'A') === t.id).map(el => el.id))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.line}`, background: 'transparent', color: T.cream, fontSize: 11.5, cursor: 'pointer', ...body }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.fill, border: '1px solid #ffffff55' }} /> Equipa
                </button>
              ))}
              {grupo.length > 0 && (
                <>
                  <span style={{ color: T.gold }}>{grupo.length} no grupo</span>
                  <button type="button" onClick={() => setGrupo([])}
                    style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 11.5, cursor: 'pointer', ...body }}>Limpar</button>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        /* Mesma altura da linha da ferramenta "Vários" (26 px): trocar de
           ferramenta não mexe no campo. */
        <div style={{ fontSize: 10.5, color: T.mutedDim, marginBottom: 6, minHeight: 26, display: 'flex', alignItems: 'center' }}>
          Escolhe a cor, depois "Jogador" ou "Guarda-redes" (ou outro ícone), e toca no campo para colocar.
        </div>
      )}

      {/* Aviso claro de que a prancheta está a mostrar um passo antigo,
          não o estado mais recente — sem isto, era fácil desenhar uma
          seta sem perceber de onde ela ia partir de verdade. Desaparece
          sozinho assim que "desde" voltar a apontar para o último passo
          (o que acontece sozinho a seguir a um novo "Animar"). */}
      {emRecuo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px',
          borderRadius: 8, background: `${T.gold}22`, border: `1px solid ${T.gold}`, color: T.gold,
          fontSize: 12, ...body,
        }}>
          <Clock size={14} />
          {(() => {
            const total = (value.sequence || []).length;
            const seguinte = desdeValido + 2;
            const antes = desdeValido === 0 ? '' : desdeValido === 1 ? ' O Animar 1 fica como está.' : ` Os Animar 1 a ${desdeValido} ficam como estão.`;
            /* Duas maneiras de editar a partir daqui, e o aviso diz as duas:
               CORRIGIR um item (arrastar, rodar, mudar o número/texto,
               apagar) vale deste passo até ao fim e não mexe em mais nada;
               ANIMAR um movimento novo recomeça a jogada daqui. */
            return `A ver o início do Animar ${desdeValido + 1}. Para corrigir só um item (arrastar a baliza, rodar, mudar o número…), mexe nele: fica corrigido do Animar ${desdeValido + 1} ao ${total} e o resto fica igual. Se animares um movimento novo, ele passa a ser o Animar ${desdeValido + 1} e ${seguinte === total ? `o Animar ${total} é apagado` : `os Animar ${seguinte} a ${total} são apagados`}.${antes} O desfazer (↶) repõe tudo.`;
          })()}
        </div>
      )}

      {/* A largura sai da altura disponível, para a proporção nunca mudar:
          limitar a altura diretamente deixaria o elemento com a largura
          toda e uma forma diferente da declarada — e o desenho esticava. */}
      <div
        style={{
          ...PITCH_FIT,
          /* TUDO NUM SÓ ECRÃ (computador): o campo fica com a altura do ecrã
             menos o que está à volta dele no editor (cores, ferramentas,
             dica, linha das animações, painel do selecionado), ver
             CHROME_EDITOR_PX.
             Assim as ferramentas e o campo inteiro veem-se sem scroll. */
          /* A moldura tem SEMPRE a mesma forma (a do campo inteiro do
             editor), nas duas vistas e mesmo no enquadramento antigo: a
             altura nunca muda e nada à volta mexe. */
          aspectRatio: `${EDITOR_BOX.w} / ${EDITOR_BOX.h}`,
          ...(isNarrowEditor ? {} : { maxWidth: `min(100%, calc((100vh - ${CHROME_EDITOR_PX}px) * ${EDITOR_BOX.w} / ${EDITOR_BOX.h}))` }),
          position: 'relative',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={viewBoxEditor}
          /* "meet" e não "none": mesmo que o contentor fique com uma
             proporção ligeiramente diferente (arredondamentos, limites de
             largura), o desenho encaixa dentro sem esticar. Com "none" um
             desvio de meio por cento transformava os jogadores em elipses. */
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            background: '#1e3a24', borderRadius: 8,
            border: `1px solid ${T.line}`, touchAction: 'none',
            cursor: tool === 'select' ? 'default' : 'crosshair',
            userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none',
            WebkitUserDrag: 'none', KhtmlUserSelect: 'none',
            /* PISCAR NO iPAD

               Ao tocar para colocar um ícone, o Safari desenha o realce de
               toque e o menu de seleção por cima do campo — no iPad isso
               lê-se como um flash da janela inteira a cada toque. Estas
               três propriedades desligam esses efeitos nativos; o toque
               continua a funcionar porque é tratado por eventos de
               ponteiro, não pelo comportamento por omissão do browser. */
            WebkitTapHighlightColor: 'transparent',
            WebkitTouchCallout: 'none',
            /* O campo passa a ter camada de composição PRÓPRIA no GPU.

               `willChange: contents` não chegou no iPad. O `translateZ(0)`
               força mesmo a criação da camada, e o `backfaceVisibility`
               impede o Safari de a descartar e voltar a criar a cada toque
               — que é o que produzia o flash da janela inteira.

               Também se desliga a ampliação por duplo toque: no iPad, um
               toque rápido para colocar dois ícones seguidos era
               interpretado como duplo toque e o Safari respondia com um
               salto de zoom. */
            transform: 'translateZ(0)',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            touchAction: 'none',
          }}
          draggable="false"
          onDragStart={(e) => e.preventDefault()}
          onPointerDown={handleBgPointerDown}
          onPointerMove={handleBgPointerMove}
          onPointerUp={finishInteraction}
          onPointerCancel={finishInteraction}
          onLostPointerCapture={() => setErasing(false)}
        >
          <VistaCampo vista={vistaCampo} gRef={gVistaRef}>
          <PitchMarkings semBancos={editorCompacto} />
          {zones.map(z => {
            const meters = resizingZoneId === z.id && liveZoneSize ? liveZoneSize : { w: z.w, h: z.h };
            return (
              <SpaceZone
                key={z.id}
                meters={meters}
                label={z.label}
                center={{ x: 53.5 + (z.dx || 0), y: 35 + (z.dy || 0) }}
                onPointerDown={(e) => onZonePointerDown(e, z.id)}
                onResizeDown={(e) => onZoneResizeDown(e, z.id)}
                onDelete={() => deleteZone(z.id)}
                interactive={tool === 'select'}
              />
            );
          })}
          {/* CAMINHO DE QUEM FOI ARRASTADO desde o último Animar: tracejado
              do sítio onde estava até onde está, com um ponto a meio para o
              curvar. É este o caminho por onde desliza no próximo Animar.
              Fica por BAIXO dos jogadores, para não os tapar. */}
          {!isPresenting && !isPlaying && !emRecuo && fimAnteriorMemo && elements.map(el => {
            if (ANIM_MATERIAL_ESTATICO.has(el.kind)) return null;
            const ant = fimAnteriorMemo.get(el.id);
            if (!ant || Math.hypot(ant.x - el.x, ant.y - el.y) <= ANIM_DESLIZE_MIN) return null;
            const c = (value.deslizeCurvas || {})[el.id];
            const cx = c ? c.cx : (ant.x + el.x) / 2, cy = c ? c.cy : (ant.y + el.y) / 2;
            const mx = 0.25 * ant.x + 0.5 * cx + 0.25 * el.x, my = 0.25 * ant.y + 0.5 * cy + 0.25 * el.y;
            return (
              <g key={`deslize-${el.id}`}>
                <path d={`M ${ant.x} ${ant.y} Q ${cx} ${cy} ${el.x} ${el.y}`} fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="0.22" strokeDasharray="0.9,0.7" style={{ pointerEvents: 'none' }} />
                <circle cx={ant.x} cy={ant.y} r="0.45" fill="#FFFFFF" fillOpacity="0.45" style={{ pointerEvents: 'none' }} />
                {/* O ponto do meio só aparece em caminhos com alguma distância:
                    num arrasto curto ficava em cima do jogador e tapava-o. */}
                {tool === 'select' && Math.hypot(ant.x - el.x, ant.y - el.y) > 5 && (
                  <circle cx={mx} cy={my} r="0.95" fill="#3A6FC4" stroke="#FFFFFF" strokeWidth="0.2"
                    onPointerDown={(e) => onDeslizeDown(e, el.id)} style={{ cursor: 'grab', touchAction: 'none' }} />
                )}
              </g>
            );
          })}
          <DiagramElements
            elements={(isPresenting ? presentElements || [] : (animFrame || elementosRecuo || elements)).filter(el => !(isPresenting ? presentAnimItems : animItems).some(it => it.mover?.id === el.id))}
            arrows={isPresenting && presentArrows ? presentArrows : arrows}
            iconScale={iconEscala * escalaEcra}
            onElementDown={onElementDown} onArrowDown={onArrowDown} onHandleDown={onHandleDown}
            selectedArrowId={selectedArrowId} interactive={!isPresenting}
            placingActive={tool !== 'select' && tool !== 'eraser' && tool !== 'multi'}
          />
          {/* Vários: quem está no grupo leva um anel, e o retângulo a ser desenhado. */}
          {tool === 'multi' && !isPresenting && !isPlaying && elements.filter(el => grupo.includes(el.id)).map(el => (
            <circle key={`grupo-${el.id}`} cx={el.x} cy={el.y} r="2.7" fill="#C9A22722" stroke="#C9A227" strokeWidth="0.3" strokeDasharray="0.8,0.5" style={{ pointerEvents: 'none' }} />
          ))}
          {laco && (
            <rect x={Math.min(laco.x1, laco.x2)} y={Math.min(laco.y1, laco.y2)} width={Math.abs(laco.x2 - laco.x1)} height={Math.abs(laco.y2 - laco.y1)}
              fill="#C9A22714" stroke="#C9A227" strokeWidth="0.25" strokeDasharray="1,0.7" style={{ pointerEvents: 'none' }} />
          )}
          {selectedEl && selectedEl.kind !== 'goalmarker' && (
            <circle cx={selectedEl.x} cy={selectedEl.y} r="3.2" fill="none" stroke={T.warn} strokeWidth="0.3" strokeDasharray="0.8,0.6" />
          )}
          {selectedEl && selectedEl.kind === 'goalmarker' && (() => {
            const w = selectedEl.w != null ? selectedEl.w : 3.6 * (selectedEl.scale || 1);
            const h = selectedEl.h != null ? selectedEl.h : 2.2 * (selectedEl.scale || 1);
            const rotHandle = localToWorld(selectedEl, 0, -h / 2 - 1.5);
            const resizeHandle = localToWorld(selectedEl, w / 2, h / 2);
            const topMid = localToWorld(selectedEl, 0, -h / 2);
            return (
              <g>
                {/* retângulo de seleção tracejado, acompanha a rotação atual */}
                <rect
                  x={-w / 2 - 0.4} y={-h / 2 - 0.4} width={w + 0.8} height={h + 0.8}
                  transform={`translate(${selectedEl.x} ${selectedEl.y}) rotate(${selectedEl.rotation || 0})`}
                  fill="none" stroke={T.warn} strokeWidth="0.25" strokeDasharray="0.7,0.5" style={{ pointerEvents: 'none' }}
                />
                {/* linha-guia até ao manípulo de rotação */}
                <line x1={topMid.x} y1={topMid.y} x2={rotHandle.x} y2={rotHandle.y}
                  stroke={T.warn} strokeWidth="0.15" opacity="0.8" style={{ pointerEvents: 'none' }} />
                {/* manípulo de rotação — arrasta à volta para rodar livremente 360° */}
                <circle cx={rotHandle.x} cy={rotHandle.y} r="1.5" fill={T.warn} stroke={TEXT_ON_ACCENT} strokeWidth="0.25"
                  onPointerDown={(e) => onGoalRotateDown(e, selectedEl.id)}
                  style={{ cursor: 'grab', touchAction: 'none' }} />
                {/* manípulo de redimensionamento — arrasta para ajustar largura/altura */}
                <rect x={resizeHandle.x - 1.1} y={resizeHandle.y - 1.1} width="2.2" height="2.2"
                  transform={`rotate(${selectedEl.rotation || 0} ${resizeHandle.x} ${resizeHandle.y})`}
                  fill={T.warn} stroke={TEXT_ON_ACCENT} strokeWidth="0.25"
                  onPointerDown={(e) => onGoalResizeDown(e, selectedEl.id)}
                  style={{ cursor: 'nwse-resize', touchAction: 'none' }} />
              </g>
            );
          })()}
          {drawing && (
            <line x1={drawing.x1} y1={drawing.y1} x2={drawing.x2} y2={drawing.y2}
              stroke="#C9A227" strokeWidth={drawing.type === 'line-dashed' ? '0.42' : '0.3'}
              strokeLinecap={drawing.type === 'line-dashed' ? 'round' : 'butt'}
              strokeDasharray={drawing.type === 'line-dashed' ? '0.1,2.1' : (drawing.type === 'arrow-run' ? '2,1.5' : '1,1')} />
          )}
          <AnimOverlay items={animItems} iconScale={iconEscala * escalaEcra} />
          <AnimOverlay items={presentAnimItems} iconScale={iconEscala * escalaEcra} />
          </VistaCampo>
        </svg>
      </div>

      {/* Undo/Redo/Imprimir/Limpar tudo — por baixo do campo, à esquerda,
          para não competir por espaço com a barra de ferramentas em cima
          (que já é apertada em ecrãs pequenos). */}
      {/* `minWidth: 0` nos filhos é o que lhes permite encolher: sem isso
          um item recusa-se a passar abaixo da largura do seu conteúdo e
          empurra a barra para fora do ecrã, mesmo com `flexWrap`. */}
      {/* O ANIMAR DEIXOU DE ESTAR NA BARRA DE CIMA.

          Aparecia assim que houvesse a primeira seta e desaparecia ao
          apagá-la — e como estava ACIMA do campo, cada vez que aparecia
          empurrava a prancheta para baixo. No telemóvel isso é o desenho a
          fugir por baixo do dedo a meio de o fazer.

          Agora fica por baixo do campo, encostado à direita, e o espaço é
          SEMPRE reservado (`minHeight`): mesmo sem setas nenhumas, nada se
          mexe quando ele nasce. */}
      {/* No computador o Animar passou para a linha das animações (à
          direita): eram duas linhas por baixo do campo, uma quase vazia. */}
      {isNarrowEditor && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, minHeight: 34, alignItems: 'center' }}>
        {botaoAnimar}
      </div>
      )}

      {/* GESTÃO DAS ANIMAÇÕES — linha própria, alinhada à esquerda.

          Estava na mesma linha do desfazer/refazer/imprimir, e o conjunto
          ficava tão comprido que no telemóvel saía do ecrã. Separadas,
          cada uma cabe na sua largura e lê-se o que é: em cima o que se faz
          ao DESENHO, em baixo o que se faz à ANIMAÇÃO. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
        flexWrap: 'wrap', minWidth: 0, maxWidth: '100%',
        // No computador esta linha também leva o Animar (à direita) e tem
        // sempre a mesma altura, com ou sem botões.
        ...(isNarrowEditor ? {} : { minHeight: 34 }),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          {/* A contagem abre a linha das animações: diz de imediato com
              quantas se está a lidar, antes dos botões que lhes mexem. */}
          {((value.sequence || []).length > 0 || passosAnulados.length > 0) && (
            <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>
              {(value.sequence || []).length} {(value.sequence || []).length === 1 ? 'animação' : 'animações'}
            </span>
          )}

          {/* A partir de que passo vale o que se fizer a seguir — tanto
              colocar como apagar.

              Sem isto, um elemento acrescentado depois da coreografia
              pronta só existia no fim: ao rever a animação desde o
              princípio, aparecia do nada. Escolher um passo aqui mete-o em
              campo desde esse momento até ao fim, o que permite testar uma
              variante sem desmanchar o que já está feito.

              O mesmo seletor serve também para apagar: escolhido um
              passo, apagar um elemento só o tira a partir dali — continua
              a aparecer nos passos anteriores, onde esteve mesmo em
              campo. */}
          {(value.sequence || []).length > 0 && (
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: desdeValido == null ? T.mutedDim : T.gold }}
              title="Vale para o que colocares e para o que apagares a seguir: passa a aplicar-se a partir deste passo da animação, não só agora"
            >
              desde
              <Select
                value={desdeValido == null ? '' : String(desdeValido)}
                onChange={ev => setInserirDesde(ev.target.value === '' ? null : Number(ev.target.value))}
                style={{ width: 92, minWidth: 0, height: 26, lineHeight: '24px', fontSize: 11.5, padding: '0 4px' }}
              >
                {/* O índice é o do passo, começando em 0.

                    A primeira versão usava `i + 1` e o elemento entrava
                    só DEPOIS do passo escolhido — escolher o último passo
                    não propagava para lado nenhum e o item aparecia apenas
                    no fim, que foi exatamente o que se notou. */}
                {/* "Animar N" e não "passo N": é o nome do botão que os
                    cria, e é assim que o treinador os conta. */}
                <option value="">só agora</option>
                {(value.sequence || []).map((_, i) => (
                  <option key={i} value={i}>desde animar {i + 1}</option>
                ))}
              </Select>
            </label>
          )}
          {(value.sequence || []).length > 0 && (
            <button
              type="button"
              onClick={anularUltimoPasso}
              title="Retira o último passo da animação e devolve as setas ao campo para as poderes corrigir"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 26,
                borderRadius: 6, fontSize: 11.5, cursor: 'pointer', ...body,
                background: 'transparent', color: T.cream, border: `1px solid ${T.line}`,
              }}
            ><Undo2 size={12} /> Anular</button>
          )}
          {passosAnulados.length > 0 && (
            <button
              type="button"
              onClick={refazerPasso}
              title="Repõe o passo que acabaste de anular"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 26,
                borderRadius: 6, fontSize: 11.5, cursor: 'pointer', ...body,
                background: 'transparent', color: T.cream, border: `1px solid ${T.line}`,
              }}
            ><Redo2 size={12} /> Refazer</button>
          )}
          {(value.sequence || []).length > 0 && (
            <button
              type="button"
              onClick={isPresenting ? stopPresentation : startPresentation}
              title={isPresenting ? 'Parar apresentação' : 'Pré-visualiza a apresentação completa (todos os passos já animados, em sequência) antes de guardar'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', height: 26, borderRadius: 6, fontSize: 11.5, cursor: 'pointer', ...body,
                background: isPresenting ? T.bad : 'transparent',
                color: isPresenting ? T.cream : T.cream,
                border: `1px solid ${isPresenting ? T.bad : T.line}`,
              }}
            >
              {isPresenting ? <Square size={12} /> : <Play size={12} />}
              {isPresenting ? 'Parar' : 'Apresentar tudo'}
            </button>
          )}
          {(value.sequence || []).length > 0 && idsOrfaosDaAnimacao().size > 0 && (
            <button
              type="button"
              onClick={repararAnimacao}
              title="Remove elementos que ficaram presos numa fotografia da animação (ex: um jogador inserido a partir de um passo e depois apagado antes de esta correção existir)"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 26,
                borderRadius: 6, fontSize: 11.5, cursor: 'pointer', ...body,
                background: `${T.warn}18`, color: T.warn, border: `1px solid ${T.warn}`,
              }}
            ><RefreshCw size={12} /> Reparar animação</button>
          )}
        </div>
        {!isNarrowEditor && <div style={{ marginLeft: 'auto', display: 'flex' }}>{botaoAnimar}</div>}
      </div>

      {/* SALTO DE SCROLL AO CLICAR FORA DA PRANCHETA

          Este painel aparecia e desaparecia conforme houvesse ou não um
          elemento selecionado. Clicar no campo para desmarcar tirava-o do
          fluxo, a página encolhia de repente e o browser reposicionava o
          scroll — lia-se como "salta sozinho para cima".

          Agora o espaço fica sempre reservado (`minHeight`), com ou sem
          seleção. A altura da página deixa de mudar e o scroll fica quieto. */}
      {/* A altura reservada é a do MAIOR painel — o do texto, com a caixa
          de escrita e os botões de tamanho e largura. Reservar menos fazia
          a página crescer ao selecionar um texto, e o scroll saltava.

          Está no mínimo possível: a caixa de escrita passou a uma linha (o
          texto continua a poder ter várias, só se rola dentro dela) para
          esta faixa não roubar altura ao campo quando nada está
          selecionado. */}
      {/* `marginTop: 8` fica aqui, no wrapper que existe SEMPRE — e não no
          bloco de baixo, que só nasce quando `selectedEl` é verdadeiro.
          Estava ao contrário: a margem só existia com o painel aberto, e
          como este `<div>` não tem padding nem borda, essa margem "fugia"
          para fora dele (colapso de margens) e empurrava a altura do editor
          uns 8px só nesse momento — o resíduo de encolhimento que ainda
          sobrava mesmo com a altura da faixa já fixa em 38px. Com a margem
          sempre presente, a altura deste wrapper é 100% constante entre
          aberto e fechado. */}
      {/* O espaço reservado cresce no telemóvel, porque lá a barra quebra
          em duas ou três linhas. Continua a ser um número FIXO por ecrã e
          não o conteúdo a mandar — é isso que impede o campo de encolher
          quando se seleciona um elemento. */}
      {/* Painel do elemento selecionado, por baixo do campo, com o espaço
          sempre reservado (o campo e a página não mexem ao selecionar). */}
      {/* No computador o painel tem sempre uma linha (38 px), por isso basta
          reservar 46: os 92 de antes deixavam uma faixa vazia e roubavam
          altura ao campo. */}
      <div style={{ minHeight: isNarrowEditor ? 200 : 46, marginTop: 4 }}>
      {painelElemento}
      </div>

      {painelSeta}

      <div style={{ textAlign: 'right', marginTop: 8 }}>
        <span style={{ ...display, fontSize: 11, color: T.mutedDim, letterSpacing: '.04em' }}>™ Mister JP</span>
      </div>

      {printOpen && createPortal(
        <div className="print-sheet">
          {exerciseInfo?.name && <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>{exerciseInfo.name}</h2>}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: '4px 24px',
            margin: '0 0 14px', fontSize: 12.5, borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', padding: '8px 0',
          }}>
            {exerciseInfo?.phase && <div style={{ gridColumn: 1, gridRow: 1 }}><strong>Fase de jogo:</strong> {momentoTexto(exerciseInfo)}</div>}
            {exerciseInfo?.defaultDuration && <div style={{ gridColumn: 2, gridRow: 1 }}><strong>Duração:</strong> {exerciseInfo.defaultDuration} min</div>}
            {exerciseInfo?.space && <div style={{ gridColumn: 3, gridRow: 1 }}><strong>Espaço:</strong> {exerciseInfo.space}</div>}
            {exerciseInfo?.playersCount && <div style={{ gridColumn: 1, gridRow: 2 }}><strong>Nº jogadores:</strong> {exerciseInfo.playersCount}</div>}
            {exerciseInfo?.material && <div style={{ gridColumn: 2, gridRow: 2 }}><strong>Material:</strong> {exerciseInfo.material}</div>}
            {emRecuo && <div style={{ gridColumn: 3, gridRow: 2 }}><strong>Momento:</strong> Animar {desdeValido + 1} de {(value.sequence || []).length}</div>}
          </div>
          {exerciseInfo?.description && (
            <p style={{ margin: '0 0 14px', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{exerciseInfo.description}</p>
          )}
          <svg viewBox={viewBoxSemBancos(vistaCampo)} style={{ width: '100%', aspectRatio: aspetoSemBancos(vistaCampo), display: 'block', background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}>
            <VistaCampo esticar={ESTICAR_IMPRESSAO_MEIO} vista={vistaCampo}>
            <PitchMarkings printMode semBancos />
            {zones.map(z => (
              <SpaceZone key={z.id} meters={{ w: z.w, h: z.h }} label={z.label} center={{ x: 53.5 + (z.dx || 0), y: 35 + (z.dy || 0) }} interactive={false} printMode />
            ))}
            {/* Imprime O QUE SE ESTÁ A VER: com "desde animar N" escolhido
                (a meio da coreografia), sai o início do Animar N — as
                posições desse momento, os desenhos fixos que já existiam e
                as setas do movimento desse passo. Sem recuo, sai o campo
                tal como está agora. */}
            <DiagramElements
              elements={emRecuo ? elementosRecuo : elements}
              arrows={emRecuo
                ? [...stepStaticArrows(value.sequence[desdeValido], value), ...((value.sequence[desdeValido].arrows) || [])]
                : arrows}
              interactive={false} iconScale={iconEscala} printMode
            />
            </VistaCampo>
          </svg>
        </div>,
        document.body
      )}
    </div>
  );
}

/* Bola/jogador "fantasma" que se desloca durante a animação de um passe
   ou corrida — usado tanto no editor tático como na apresentação do
   exercício, para não duplicar a mesma lógica de desenho. */
export function AnimOverlay({ items, iconScale = 1 }) {
  const k = iconScale || 1;
  const rodarTexto = useRodarTexto();
  return (
    <>
      {items.map(it => {
        if (it.type === 'arrow-pass') {
          return (
            <g key={it.id} style={{ pointerEvents: 'none' }}>
              <TriondaBall cx={it.x} cy={it.y} r={1.6 * k} />
            </g>
          );
        }
        /* Caixa de texto em movimento: desenha-se como no campo, para não
           se transformar num círculo a meio da animação. */
        if (it.mover && it.mover.kind === 'text') {
          // A caixa em movimento é desenhada no ponto da animação, mas com
          // as MESMAS medidas que tem parada — só muda o centro.
          const m = textBoxMetrics(it.mover);
          const size = m.size * k;
          const linhas = m.linhas;
          const alturaLinha = m.alturaLinha * k;
          const folgaY = m.folgaY * k;
          const boxW = m.w * k;
          const boxH = m.h * k;
          const topo = it.y - boxH / 2;
          return (
            <g key={it.id} style={{ pointerEvents: 'none' }} opacity="0.95">
              <rect x={it.x - boxW / 2} y={topo} width={boxW} height={boxH} rx={size * 0.32}
                fill="#12241ACC" stroke="#F0E7D655" strokeWidth="0.18" />
              <text x={it.x} textAnchor="middle" fontSize={size} fontWeight="600" fill="#F0E7D6"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                {linhas.map((linha, li) => (
                  <tspan key={li} x={it.x} y={topo + folgaY + alturaLinha * (li + 0.66)}>{linha}</tspan>
                ))}
              </text>
            </g>
          );
        }
        const tm = it.mover ? teamInfo(it.mover.team) : null;
        const isKeeper = it.mover?.kind === 'keeper';
        return (
          <g key={it.id} style={{ pointerEvents: 'none' }}>
            {isKeeper ? (
              <rect x={it.x - 2 * k} y={it.y - 2 * k} width={4 * k} height={4 * k} rx={0.8 * k}
                fill={tm ? tm.fill : T.warn} stroke="#F0E7D6" strokeWidth={0.4 * k} opacity="0.92" />
            ) : (
              <circle cx={it.x} cy={it.y} r={2 * k} fill={tm ? tm.fill : T.warn} stroke={TEXT_ON_ACCENT} strokeWidth={0.28 * k} opacity="0.92" />
            )}
            {it.mover && (
              <text x={it.x} y={it.y + 0.72 * k} transform={rodarTexto(it.x, it.y)} textAnchor="middle" fontSize={(rotuloIcone(it.mover).length > 2 ? 1.45 : 2.05) * k} fontWeight="700" fill={tm.text} style={{ fontFamily: "'Oswald', sans-serif" }}>
                {rotuloIcone(it.mover)}
              </text>
            )}
            {it.mover && it.mover.nome && (
              <text x={it.x} y={it.y + 3.75 * k} transform={rodarTexto(it.x, it.y)} textAnchor="middle" fontSize={1.45 * k} fontWeight="600"
                fill="#F0E7D6" stroke="#12241A" strokeWidth={0.35 * k} paintOrder="stroke" style={{ fontFamily: "'Inter', sans-serif" }}>
                {it.mover.nome}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

