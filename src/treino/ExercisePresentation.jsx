// treino/ExercisePresentation.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { iconScaleForPhase, stepStaticArrows, planearCoreografiaAnim, buildAnimationChainsPure, stepElements, EDITOR_VIEWBOX, EDITOR_BOX, PITCH_FIT, VistaCampo, PitchMarkings, SpaceZone, DiagramElements } from '../tatico/campo';
import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useBlobUrl, PdfCanvasViewer } from '../media/leitores';
import { Modal, Btn } from '../base/ui';
import { T, mono, T_ESCURO, body, TEXT_ON_ACCENT } from '../base/tema';
import { momentoTexto } from '../dominio/treino';
import { BookOpen, Square, ChevronLeft, ChevronRight, Play, Minimize2, Maximize2, Pencil } from 'lucide-react';
import { hrefDescarga } from '../base/anexos';
import { AnimOverlay } from '../tatico/DiagramEditor';
import { APRESENTACAO_BOX_MEIO, APRESENTACAO_VIEWBOX_MEIO, CHROME_APRESENTACAO_PX, getSpaceZones } from './diagramas';

/* Apresentação de leitura do exercício: mostra a informação (nome, fase,
   descrição, espaço, material) e reproduz na prancheta, passo a passo, os
   movimentos gravados durante a criação (cada vez que se usou "Animar" no
   editor). Não depende de vídeo gravado — a coreografia fica guardada como
   dados (posições + setas de cada passo) e é reconstruída aqui em direto,
   o que funciona em qualquer ecrã e não ocupa espaço de armazenamento. */
export function ExercisePresentation({ exercise, onClose, onEdit }) {
  const diagram = exercise.diagram || { elements: [], arrows: [] };
  const sequence = diagram.sequence || [];
  const zones = getSpaceZones(diagram, exercise.space);
  const iconEscala = iconScaleForPhase(exercise.phase, diagram);
  /* Os desenhos fixos deixam de ser fixos: acompanham o passo, para uma
     linha só aparecer a partir do momento em que foi traçada. */
  const [frameArrows, setFrameArrows] = useState(
    sequence.length ? stepStaticArrows(sequence[0], diagram) : (diagram.arrows || [])
  );

  const [frameElements, setFrameElements] = useState(sequence.length ? sequence[0].elements : (diagram.elements || []));
  const [animItems, setAnimItems] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(sequence.length === 0);
  /* PAUSA.

     Parar e retomar não é o mesmo que parar e recomeçar: o que interessa
     numa reunião é congelar a imagem para explicar, e depois seguir dali.

     Guardam-se duas coisas: em que passo se estava (`passoAtual`) e quanto
     tempo já tinha decorrido dentro desse passo (`decorridoRef`). Ao
     retomar, o passo volta a correr a partir desse instante em vez de
     recomeçar do princípio. */
  const [paused, setPaused] = useState(false);
  const passoAtualRef = useRef(0);
  const decorridoRef = useRef(0);
  const planoAnim = React.useMemo(() => planearCoreografiaAnim(diagram), [diagram]);
  /* SEM SOLUÇOS: durante cada fase, só as peças que andam se mexem (um
     `transform` direto no desenho de cada uma), sem redesenhar o campo
     todo a cada imagem. Antes o React redesenhava tudo 60 vezes por
     segundo e, com muitos itens em campo, perdia imagens (os soluços dos
     exercícios antigos). O campo só é redesenhado na passagem de fase. */
  const limparDeslocados = () => {
    const raiz = pitchWrapRef.current;
    if (raiz) raiz.querySelectorAll('[data-anim-id][transform]').forEach(n => n.removeAttribute('transform'));
  };
  const mostrarCampo = (els) => {
    try { flushSync(() => setFrameElements(els)); } catch (e) { setFrameElements(els); }
    limparDeslocados();
  };
  /* O plano pode ter mais fases do que passos gravados (a reposição antes
     de um passo antigo). `passoAtualRef` continua a ser o número do PASSO
     (para Anterior/Seguinte); `faseRef` é a fase do plano a correr. */
  const faseRef = useRef(0);
  const faseDoPasso = (k) => {
    const i = planoAnim.passos.findIndex(x => x.indice === k);
    return i < 0 ? 0 : i;
  };
  const attachmentBlobUrl = useBlobUrl(exercise.attachment && exercise.attachment.type !== 'image' ? exercise.attachment.dataUrl : null);
  const animRef = React.useRef(null);
  const timeoutRef = React.useRef(null);
  const pitchWrapRef = useRef(null);
  const [isFull, setIsFull] = useState(false);
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  /* Ecrã inteiro: usa a API nativa do browser quando existe (esconde
     mesmo a barra do sistema no telemóvel e no TV) e, se falhar ou não
     for suportada, cai num modo "ecrã cheio" só com CSS — o resultado
     visual é praticamente o mesmo dentro da app. */
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = async () => {
    const node = pitchWrapRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFull(false);
      } else if (node && node.requestFullscreen) {
        await node.requestFullscreen();
        setIsFull(true);
      } else {
        setIsFull(v => !v); // sem API disponível: modo CSS
      }
    } catch (e) {
      setIsFull(v => !v);
    }
  };
  // Tecla Esc fecha o modo CSS (no modo nativo o browser trata disto).
  useEffect(() => {
    if (!isFull) return;
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) setIsFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFull]);
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  // Mesma lógica de "cadeias" usada no editor (ver buildAnimationChains em
  // DiagramEditor): agrupa setas encadeadas do mesmo tipo para as tocar em
  // sequência, uma a seguir à outra, em vez de todas ao mesmo tempo.
  // Mesma implementação partilhada usada pelo editor (ver
  // buildAnimationChainsPure), para a reprodução aqui ser exatamente igual
  // à que se viu ao criar o exercício — incluindo a regra do dono da seta.
  const buildAnimationChains = (arrowList) => buildAnimationChainsPure(arrowList);

  /* Com o motor partilhado (planearCoreografiaAnim): cada passo começa
     onde o anterior acabou, o que foi arrastado desliza, a bola anda ao
     dobro e não há pausa entre passos. O último "passo" pode ser o deslize
     final até ao campo guardado. */
  const runStep = (idx, offsetMs = 0) => {
    faseRef.current = idx;
    const p = planoAnim.passos[idx];
    if (p) passoAtualRef.current = p.indice != null ? p.indice : passoAtualRef.current;
    const acabar = () => {
      // Último passo: fica exatamente como o exercício está guardado hoje,
      // já com todos os desenhos.
      mostrarCampo(diagram.elements || []);
      setFrameArrows(diagram.arrows || []);
      setAnimItems([]);
      animRef.current = null;
      decorridoRef.current = 0;
      setPlaying(false);
      setPaused(false);
      passoAtualRef.current = 0;
      setFinished(true);
    };
    if (!p) { acabar(); return; }
    setFrameArrows(p.setasFixas);
    mostrarCampo(p.base);
    const nos = new Map();
    if (pitchWrapRef.current) pitchWrapRef.current.querySelectorAll('[data-anim-id]').forEach(n => nos.set(n.getAttribute('data-anim-id'), n));
    const baseMap = new Map(p.base.map(el => [el.id, el]));
    // `offsetMs` recua o relógio: retomar em 3s é o mesmo que ter
    // começado 3s antes de agora.
    const start = performance.now() - offsetMs;
    const tick = (now) => {
      const elapsed = now - start;
      decorridoRef.current = elapsed;
      p.posicoes(Math.min(elapsed, p.dur)).forEach((v, id) => {
        const n = nos.get(id), b = baseMap.get(id);
        if (n && b) n.setAttribute('transform', `translate(${(v.x - b.x).toFixed(3)} ${(v.y - b.y).toFixed(3)})`);
      });
      // Depois do movimento, a pausa do passo (se houver), parado.
      const total = p.dur + (p.pausa || 0);
      if (elapsed < total) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        decorridoRef.current = 0;
        if (idx + 1 < planoAnim.passos.length) {
          // O seguinte começa já, com o tempo que sobrou deste (sem uma
          // imagem repetida na passagem).
          runStep(idx + 1, Math.max(0, elapsed - total));
        } else acabar();
      }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (sequence.length === 0) return;
    setFinished(false);
    setPlaying(true);
    setPaused(false);
    passoAtualRef.current = 0;
    faseRef.current = 0;
    decorridoRef.current = 0;
    mostrarCampo(planoAnim.passos[0] ? planoAnim.passos[0].base : sequence[0].elements);
    setFrameArrows(stepStaticArrows(sequence[0], diagram));
    timeoutRef.current = setTimeout(() => runStep(0), 200);
  };
  const stop = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    animRef.current = null;
    setPlaying(false);
    setPaused(false);
    passoAtualRef.current = 0;
    decorridoRef.current = 0;
    setAnimItems([]);
  };

  /* Pausa: congela onde está. Ao contrário do "Parar", guarda a posição
     para se poder continuar dali. */
  const pause = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    animRef.current = null;
    timeoutRef.current = null;
    setPaused(true);
    setPlaying(false);
  };

  const resume = () => {
    if (!sequence.length) return;
    setPaused(false);
    setPlaying(true);
    runStep(faseRef.current, decorridoRef.current);
  };

  /* BARRA DE ESPAÇO = reproduzir / pausar / continuar, como num leitor
     de vídeo. Lê sempre o estado mais recente (ref), e ignora quando se
     está a escrever num campo. Tira o foco de um botão focado, para o
     espaço não o "carregar" também (seria play e pausa ao mesmo tempo). */
  const espacoRef = useRef(null);
  espacoRef.current = () => {
    if (!sequence.length) return;
    if (playing) pause(); else if (paused) resume(); else restart();
  };
  useEffect(() => {
    const aoTecla = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat) { e.preventDefault(); return; }
      const a = document.activeElement;
      const tag = a && a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a && a.isContentEditable)) return;
      e.preventDefault();
      if (a && (tag === 'BUTTON' || a.getAttribute('role') === 'button') && a.blur) a.blur();
      if (espacoRef.current) espacoRef.current();
    };
    window.addEventListener('keydown', aoTecla, true);
    return () => window.removeEventListener('keydown', aoTecla, true);
  }, []);

  /* ANDAR PARA A FRENTE E PARA TRÁS, passo a passo.

     A apresentação corrida serve para mostrar a ideia; explicá-la é outra
     coisa — obriga a voltar atrás, a repetir um movimento, a ficar parado
     num momento enquanto se fala. Sem isto, a única forma de rever o
     terceiro passo era ver os dois primeiros de novo.

     Ir para um passo CONGELA a apresentação nesse ponto: mostra-se o
     estado final desse passo, sem animação. Quem quiser ver o movimento
     carrega em Continuar a partir dali. */
  const irParaPasso = (idx) => {
    if (!sequence.length) return;
    const alvo = Math.max(0, Math.min(sequence.length - 1, idx));
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    animRef.current = null;
    timeoutRef.current = null;

    passoAtualRef.current = alvo;
    // Continuar a partir daqui corre a jogada deste passo (a reposição já
    // está feita: o campo mostra o início do passo).
    const faseJogada = planoAnim.passos.findIndex(x => x.indice === alvo && !x.reposicao);
    faseRef.current = faseJogada < 0 ? faseDoPasso(alvo) : faseJogada;
    decorridoRef.current = 0;
    setPlaying(false);
    setPaused(true);
    setFinished(false);
    setAnimItems([]);

    /* Mostra o campo COMO FICA no fim do passo anterior — que é o mesmo
       que dizer: como está no início do passo escolhido. É a fotografia
       do passo, com o conteúdo atual (ver stepElements). */
    const step = sequence[alvo];
    // O início do passo = onde o anterior acabou (com o que foi arrastado
    // ainda no sítio de partida: desliza quando se carregar em Continuar).
    const pa = planoAnim.passos[faseRef.current];
    mostrarCampo(pa ? pa.base : stepElements(step, diagram));
    setFrameArrows([...stepStaticArrows(step, diagram), ...(step.arrows || [])]);
  };


  const passoSeguinte = () => {
    const proximo = passoAtualRef.current + 1;
    if (proximo >= sequence.length) {
      // Depois do último passo fica o estado final, tal como está gravado.
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      animRef.current = null;
      passoAtualRef.current = sequence.length - 1;
      setPlaying(false);
      setPaused(false);
      setFinished(true);
      setAnimItems([]);
      mostrarCampo(diagram.elements || []);
      setFrameArrows(diagram.arrows || []);
      return;
    }
    irParaPasso(proximo);
  };

  const passoAnterior = () => {
    // Vindo do fim, o "anterior" é o último passo e não o penúltimo.
    if (finished) { irParaPasso(sequence.length - 1); return; }
    irParaPasso(passoAtualRef.current - 1);
  };
  // Repetir do início: garante que nenhuma animação anterior fica pendente
  // (era isso que impedia o segundo "play" logo a seguir ao fim).
  const restart = () => { stop(); setTimeout(start, 30); };

  // Enquadramento da apresentação: o do editor (sem bancos), nas duas vistas.
  const vistaMeio = !!(exercise.diagram && exercise.diagram.vista === 'meio');
  /* Meio-campo: a moldura passa a ter a forma do meio-campo, com a mesma
     margem de 3,5 m à volta toda (linhas laterais u 1–69; linha de baliza
     v 1 e linha do meio-campo v 53,5), para o campo crescer para os lados. */
  const vbApresentacao = vistaMeio ? APRESENTACAO_VIEWBOX_MEIO : EDITOR_VIEWBOX;
  const caixaApres = vistaMeio ? APRESENTACAO_BOX_MEIO : EDITOR_BOX;
  const vbNums = vbApresentacao.split(' ').map(Number);
  return (
    <Modal title={exercise.name} onClose={onClose} wide xwide fullPage>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: T.warn, background: `${T.crimson}55`, padding: '2px 9px', borderRadius: 12 }}>{momentoTexto(exercise)}</span>
        {exercise.space && <span style={{ fontSize: 11.5, color: T.mutedDim, ...mono }}>📐 {exercise.space}</span>}
        {exercise.playersCount && <span style={{ fontSize: 11.5, color: T.mutedDim, ...mono }}>👥 {exercise.playersCount}</span>}
        {exercise.material && <span style={{ fontSize: 11.5, color: T.mutedDim, ...mono }}>🎒 {exercise.material}</span>}
        {exercise.defaultDuration && <span style={{ fontSize: 11.5, color: T.mutedDim, ...mono }}>⏱ {exercise.defaultDuration} min</span>}
      </div>
      {exercise.description && (
        <p style={{ color: T.mutedDim, fontSize: 13.5, lineHeight: 1.55, margin: '0 0 14px' }}>{exercise.description}</p>
      )}

      {exercise.attachment && (
        <div style={{ marginBottom: 14 }}>
          {exercise.attachment.type === 'image' ? (
            <img src={exercise.attachment.dataUrl} alt={exercise.attachment.name} style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8, border: `1px solid ${T.line}`, background: '#000' }} />
          ) : (
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: T.surfaceRaise }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.cream }}><BookOpen size={14} /> {exercise.attachment.name}</span>
                <a href={hrefDescarga(exercise.attachment.dataUrl, exercise.attachment.name)} download={exercise.attachment.name} style={{ fontSize: 12, color: T.gold, textDecoration: 'none' }}>Descarregar</a>
              </div>
              <div style={{ height: 420 }}>
                <PdfCanvasViewer dataUrl={attachmentBlobUrl} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* O campo pode passar a ecrã inteiro (útil para mostrar a animação
          ao grupo, num TV ou projetor). Em ecrã inteiro os controlos de
          reprodução ficam por cima, no rodapé. */}
      <div ref={pitchWrapRef} style={
        isFull
          ? { position: 'fixed', inset: 0, zIndex: 100, background: '#0e1a12', display: 'flex', flexDirection: 'column', padding: 12 }
          /* Sem bancos: o mesmo enquadramento do editor (a mesma margem de
             relvado à volta toda). A largura sai da altura do ecrã menos o
             que está à volta (título, etiquetas, descrição e controlos),
             para o campo e os botões de reproduzir/fechar caberem todos. */
          : { position: 'relative', ...PITCH_FIT, aspectRatio: `${caixaApres.w} / ${caixaApres.h}`, maxWidth: `min(100%, calc((100vh - ${CHROME_APRESENTACAO_PX}px) * ${caixaApres.w} / ${caixaApres.h}))` }
      }>
        <svg viewBox={vbApresentacao} preserveAspectRatio="xMidYMid meet" style={
          isFull
            ? { flex: 1, width: '100%', minHeight: 0, background: '#1e3a24', borderRadius: 8, border: `1px solid ${T.line}` }
            : { position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#1e3a24', borderRadius: 8, border: `1px solid ${T.line}` }
        }>
          <VistaCampo vista={exercise.diagram && exercise.diagram.vista}>
          <PitchMarkings semBancos />
          {zones.map(z => (
            <SpaceZone key={z.id} meters={{ w: z.w, h: z.h }} label={z.label} center={{ x: 53.5 + (z.dx || 0), y: 35 + (z.dy || 0) }} interactive={false} />
          ))}
          <DiagramElements elements={frameElements.filter(el => !animItems.some(it => it.mover?.id === el.id))} arrows={frameArrows} interactive={false} iconScale={iconEscala} />
          <AnimOverlay items={animItems} iconScale={iconEscala} />
          </VistaCampo>
          {/* Marca dentro do próprio SVG: assim acompanha o campo em ecrã
              inteiro e aparece também quando se guarda a imagem. */}
          {/* Fora das quatro linhas. Campo inteiro: na margem de baixo, à
              direita (antes do canto). Meio-campo: ao alto, na margem do
              lado direito, de baixo para cima, em letra mais pequena. */}
          <text
            {...(vistaMeio
              ? { x: vbNums[0] + vbNums[2] - 0.8, y: vbNums[1] + vbNums[3] - 1, transform: `rotate(-90 ${vbNums[0] + vbNums[2] - 0.8} ${vbNums[1] + vbNums[3] - 1})`, textAnchor: 'start', fontSize: 1.5 }
              : { x: 103, y: vbNums[1] + vbNums[3] - 0.9, textAnchor: 'end', fontSize: 2 })}
            fill="#ffffff55"
            style={{ fontFamily: "'Oswald', sans-serif", letterSpacing: '0.08em', pointerEvents: 'none' }}
          >™ Mister JP</text>
        </svg>

        {/* Em ecrã inteiro os controlos ficam no TOPO: no Android o sistema
            mostra um aviso permanente no rodapé ("para sair do ecrã
            inteiro...") que tapava o botão de Apresentar/Repetir. */}
        <div style={{
          position: 'absolute', top: isFull ? 16 : 10, right: isFull ? 16 : 10, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* Os mesmos três estados da janela normal: em ecrã inteiro é
              onde a pausa mais faz falta, porque é aqui que se apresenta ao
              grupo e se precisa de congelar para explicar. */}
          {isFull && sequence.length > 0 && (
            <>
              {(playing || paused) && (
                <button
                  type="button"
                  onClick={stop}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
                    background: '#0e1a12CC', border: `1px solid ${T_ESCURO.line}`,
                    color: T_ESCURO.cream, cursor: 'pointer', fontSize: 13, fontWeight: 600, ...body,
                  }}
                ><Square size={14} /> Parar</button>
              )}
              {/* As mesmas setas do modo normal. Em ecrã inteiro fazem
                  ainda mais falta: é aqui que se apresenta ao grupo e se
                  precisa de voltar atrás sem sair da apresentação. */}
              {[
                { onClick: passoAnterior, icone: <ChevronLeft size={16} />, rotulo: 'Anterior', off: !finished && passoAtualRef.current <= 0 && !playing },
                { onClick: passoSeguinte, icone: <ChevronRight size={16} />, rotulo: 'Seguinte', off: finished },
              ].map(b => (
                <button
                  key={b.rotulo}
                  type="button"
                  onClick={b.onClick}
                  disabled={b.off}
                  aria-label={b.rotulo}
                  title={b.rotulo}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 38, borderRadius: 8,
                    background: '#0e1a12CC', border: `1px solid ${T_ESCURO.line}`,
                    color: b.off ? T_ESCURO.mutedDim : T_ESCURO.cream, cursor: b.off ? 'default' : 'pointer',
                  }}
                >{b.icone}</button>
              ))}
              <button
                type="button"
                onClick={() => (playing ? pause() : paused ? resume() : restart())}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
                  background: playing ? '#0e1a12CC' : '#B5393F', border: `1px solid ${playing ? T_ESCURO.line : '#B5393F'}`,
                  color: playing ? T_ESCURO.cream : TEXT_ON_ACCENT, cursor: 'pointer', fontSize: 13, fontWeight: 600, ...body,
                }}
              >
                {playing
                  ? <><Square size={14} /> Pausa</>
                  : paused
                    ? <><Play size={14} /> Continuar</>
                    : <><Play size={14} /> {finished ? 'Repetir' : 'Apresentar'}</>}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFull ? 'Sair do ecrã inteiro' : 'Ver em ecrã inteiro'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8,
              background: '#0e1a12CC', border: `1px solid ${T_ESCURO.line}`, color: T_ESCURO.cream, cursor: 'pointer',
              fontSize: 12, ...body,
            }}
          >
            {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFull ? 'Sair' : 'Ecrã inteiro'}
          </button>
        </div>
      </div>

      {/* No telemóvel os botões não cabiam numa linha e o "Apresentar"
          ficava cortado à direita, meio fora do ecrã — justamente o que
          se quer carregar. Passam a poder quebrar e a ocupar a largura
          toda, o que também os torna mais fáceis de acertar com o dedo. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
        {sequence.length === 0 ? (
          <div style={{ fontSize: 12, color: T.mutedDim }}>
            Sem sequência de movimento gravada. Abre em "Editar" e usa "Animar" enquanto colocas as setas — cada animação fica guardada e passa a fazer parte desta apresentação.
          </div>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
          {onEdit && <Btn variant="ghost" onClick={onEdit}><Pencil size={14} /> Editar</Btn>}

          {sequence.length > 0 && (
            <>
              {/* Pausa só faz sentido a meio; Parar só faz sentido se
                  houver alguma coisa a decorrer ou congelada.

                  As setas andam passo a passo e estão SEMPRE disponíveis:
                  é com elas que se explica, e ter de carregar em Pausa
                  antes de poder recuar era um passo a mais no meio de uma
                  conversa. */}
              <Btn variant="ghost" onClick={passoAnterior} disabled={!finished && passoAtualRef.current <= 0 && !playing}>
                <ChevronLeft size={14} /> Anterior
              </Btn>
              <Btn variant="ghost" onClick={passoSeguinte} disabled={finished}>
                Seguinte <ChevronRight size={14} />
              </Btn>
              {(playing || paused) && (
                <Btn variant="ghost" onClick={stop}><Square size={14} /> Parar</Btn>
              )}
              {playing ? (
                <Btn onClick={pause}><Square size={14} /> Pausa</Btn>
              ) : paused ? (
                <Btn onClick={resume}><Play size={14} /> Continuar</Btn>
              ) : (
                <Btn onClick={restart}><Play size={14} /> {finished ? 'Repetir apresentação' : 'Apresentar'}</Btn>
              )}
              {/* A contagem "animar 2 de 6" saiu: num ecrã estreito era mais
                  um item a empurrar os botões para fora, e quem está a
                  apresentar a uma equipa olha para o campo, não para o
                  número do passo. As setas Anterior/Seguinte já dizem que
                  se anda passo a passo. */}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

