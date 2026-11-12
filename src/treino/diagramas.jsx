// treino/diagramas.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useRef, useEffect } from 'react';
import { Pause, Play } from 'lucide-react';
import { uid } from '../base/utilidades';
import { SpaceZone, stepElements, stepStaticArrows, iconScaleForPhase, ESTICAR_IMPRESSAO_MEIO, VistaCampo, PitchMarkings, DiagramElements, planearCoreografiaAnim, aspetoSemBancos, viewBoxSemBancos } from '../tatico/campo';
import ReactDOMServer from 'react-dom/server';

/* MINIATURA COM ANIMAÇÃO — o mesmo desenho do DiagramThumb, com um botão
   ▶ por cima quando a ideia/exercício tem movimentos gravados. Carregar
   reproduz a coreografia ali mesmo, no cartão pequeno (os mesmos
   fotogramas da apresentação e da partilha), sem abrir nada. Os
   fotogramas só se calculam ao carregar no ▶. */
export function DiagramThumbAnimado({ diagram, space, phase, height = 110, fill = false }) {
  const temAnimacao = !!(diagram && Array.isArray(diagram.sequence) && diagram.sequence.length);
  const [frames, setFrames] = useState(null);
  const [idx, setIdx] = useState(0);
  const [aTocar, setATocar] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  /* EXERCÍCIO ALTERADO = FOTOGRAMAS NOVOS. Os fotogramas ficavam guardados
     desde o primeiro ▶ e o cartão continuava a mostrar a animação antiga
     depois de se gravar uma correção (por exemplo, feita em "desde
     animar"). Agora, se o conteúdo do desenho mudar, deitam-se fora e o
     próximo ▶ volta a calculá-los. Compara-se o conteúdo, não o objeto,
     para não recomeçar a meio só porque a lista voltou a desenhar-se. */
  const assinatura = React.useMemo(() => { try { return JSON.stringify(diagram || {}); } catch (e) { return String(Math.random()); } }, [diagram]);
  const assinaturaRef = useRef(assinatura);
  useEffect(() => {
    if (assinaturaRef.current === assinatura) return;
    assinaturaRef.current = assinatura;
    clearTimeout(timerRef.current);
    setFrames(null);
    setIdx(0);
    setATocar(false);
  }, [assinatura]);
  useEffect(() => {
    if (!aTocar || !frames) return undefined;
    const f = frames[idx];
    if (!f) { setATocar(false); return undefined; }
    timerRef.current = setTimeout(() => {
      if (idx + 1 < frames.length) setIdx(idx + 1);
      else setATocar(false);
    }, Math.max(30, f.holdMs || 55));
    return () => clearTimeout(timerRef.current);
  }, [aTocar, idx, frames]);
  const tocar = (e) => {
    e.stopPropagation();
    if (aTocar) { setATocar(false); return; }
    let fr = frames;
    if (!fr) {
      try { fr = computeDiagramAnimationFrames(diagram || {}, getSpaceZones(diagram, space), phase, { cartao: true }).frames; } catch (err) { fr = null; }
      setFrames(fr);
    }
    if (!fr || !fr.length) return;
    setIdx(0);
    setATocar(true);
  };
  const mostrarFotograma = frames && (aTocar || idx > 0);
  // Coluna flex: o desenho parado e os fotogramas ocupam EXATAMENTE a
  // mesma altura (sem a folga de linha que um <svg> solto deixa por
  // baixo) — carregar no ▶ não faz o cartão mexer.
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {mostrarFotograma && frames[idx] ? (
        <svg viewBox={viewBoxCartao(diagram && diagram.vista)} preserveAspectRatio={fill ? 'xMidYMid slice' : 'xMidYMid meet'}
          style={{ width: '100%', ...(fill ? { height } : { height: 'auto', aspectRatio: aspetoCartao(diagram && diagram.vista) }), background: '#1e3a24', borderRadius: 6, marginBottom: 8, display: 'block' }}
          dangerouslySetInnerHTML={{ __html: frames[idx].svg }} />
      ) : (
        <DiagramThumb diagram={diagram} space={space} phase={phase} height={height} fill={fill} />
      )}
      {temAnimacao && (
        // <span> e não <button>: este ▶ também vive dentro de cartões que
        // já são botões (copiar existente) — um botão dentro de outro não
        // é válido e alguns browsers perdem o clique.
        <span role="button" tabIndex={0} onClick={tocar}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tocar(e); } }}
          title={aTocar ? 'Parar' : 'Reproduzir a animação aqui'}
          style={{
            /* No cantinho do campo, encostado às linhas sem lhes tocar: a
               linha lateral e a de fundo ficam a ~4 % da borda do desenho (e
               o desenho tem 8 px de margem por baixo). */
            position: 'absolute',
            // Mesmo sítio em relação às linhas do campo: no campo inteiro, 1% para
            // dentro da linha de baliza e 1,6% acima da lateral; no meio-campo
            // (linhas laterais e do meio-campo mais junto às bordas do cartão),
            // a mesma distância às linhas.
            ...(diagram && diagram.vista === 'meio'
              ? { right: 'calc(4.8% + 2px)', bottom: 'calc(8px + 2.7% + 2px)' }
              : { right: 'calc(4% + 2px)', bottom: 'calc(8px + 3.8% + 2px)' }),
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          }}>
          {aTocar ? <Pause size={11} /> : <Play size={11} style={{ marginLeft: 1 }} />}
        </span>
      )}
    </div>
  );
}

/* Espaços com nome, escritos por extenso no campo "Espaço" em vez de um
   "20x20". As medidas e a posição saem das marcações reais do relvado
   (ver PitchMarkings: o campo ocupa x 1→106 e y 1→69, ou seja 105×68 m,
   com centro em 53.5,35), por isso o tracejado assenta exatamente por
   cima das linhas verdadeiras em vez de ser um retângulo aproximado.

   As frações são medidas ao COMPRIMENTO e encostadas à baliza da
   esquerda — é assim que se usam no treino ("trabalhar em 3/4 de campo"
   é da baliza até três quartos, não um retângulo no meio).

   "Campo inteiro" é o único que não desenha nada: o campo já está lá. */
export const NAMED_SPACES = [
  { re: /campo\s*(inteiro|todo|completo)|todo\s*o\s*campo/, label: 'Campo inteiro', fullPitch: true },
  { re: /grande\s*[áa]rea/, label: 'Grande área', w: 16.5, h: 40.32, cx: 9.25, cy: 35 },
  { re: /pequena\s*[áa]rea/, label: 'Pequena área', w: 5.5, h: 18.32, cx: 3.75, cy: 35 },
  { re: /meio[\s-]*campo|1\s*\/\s*2\s*campo/, label: 'Meio campo', w: 52.5, h: 68, cx: 27.25, cy: 35 },
  { re: /3\s*\/\s*4/, label: '3/4 de campo', w: 78.75, h: 68, cx: 40.375, cy: 35 },
  { re: /1\s*\/\s*4/, label: '1/4 de campo', w: 26.25, h: 68, cx: 14.125, cy: 35 },
];

export function parseNamedSpace(str) {
  const raw = String(str || '').toLowerCase().trim();
  if (!raw) return null;
  const achado = NAMED_SPACES.find(sp => sp.re.test(raw));
  if (!achado) return null;
  if (achado.fullPitch) return { fullPitch: true, label: achado.label };
  return {
    label: achado.label, w: achado.w, h: achado.h,
    dx: achado.cx - 53.5, dy: achado.cy - 35,
  };
}

export function parseSpace(str) {
  if (!str) return null;
  // Os nomes têm prioridade sobre o "WxH": "grande área" não tem números.
  const named = parseNamedSpace(str);
  if (named) return named.fullPitch ? null : { w: named.w, h: named.h, dx: named.dx, dy: named.dy, label: named.label };
  const m = String(str).toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const w = parseFloat(m[1].replace(',', '.'));
  const h = parseFloat(m[2].replace(',', '.'));
  if (!w || !h) return null;
  return { w, h };
}

// Sufixo opcional "(N)" no fim do texto do campo Espaço (ex.: "20x20 (2)"
// → 2 zonas). Sem sufixo, ou sufixo inválido, assume-se 1 zona.
export function parseSpaceCount(str) {
  const m = String(str || '').match(/\((\d+)\)\s*$/);
  if (!m) return 1;
  return Math.max(1, Math.min(8, parseInt(m[1], 10) || 1));
}

// Distribui N zonas W×H em grelha, centradas no meio-campo, com um pequeno
// espaçamento entre elas — usado quando o treinador escreve no campo
// Espaço (ex.: "20x20 (2)") em vez de desenhar cada quadrado à mão.
export function layoutSpaceZones(w, h, count) {
  const n = Math.max(1, count);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = 3;
  const zones = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    zones.push({
      id: uid(), w, h,
      dx: (col - (cols - 1) / 2) * (w + gap),
      dy: (row - (rows - 1) / 2) * (h + gap),
    });
  }
  return zones;
}

// Texto a mostrar/gravar no campo Espaço a partir da lista de zonas
// atualmente desenhadas no campo: tamanho único → "WxH" (ou "WxH (N)" se
// forem várias iguais); tamanhos diferentes → rótulo genérico "Vários
// reduzidos", já que deixa de fazer sentido um único WxH.
export function describeSpaceZones(zones) {
  if (!zones || !zones.length) return '';
  const fmt = (n) => {
    const r = Math.round(n * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ','));
  };
  const first = zones[0];
  const sameSize = zones.every(z => Math.abs(z.w - first.w) < 0.05 && Math.abs(z.h - first.h) < 0.05);
  if (!sameSize) return 'Vários reduzidos';
  return zones.length > 1 ? `${fmt(first.w)}x${fmt(first.h)} (${zones.length})` : `${fmt(first.w)}x${fmt(first.h)}`;
}

// Lista de zonas a desenhar no campo, com compatibilidade para exercícios
// gravados antes de existir a possibilidade de várias zonas (só tinham uma,
// via spaceOffset associado ao WxH do campo Espaço).
export function getSpaceZones(diagram, spaceText) {
  if (diagram?.spaceZones?.length) return diagram.spaceZones;
  const meters = parseSpace(spaceText);
  if (!meters) return [];
  /* Um espaço com nome traz a sua própria posição (a grande área fica na
     grande área, não no meio-campo). Um deslocamento gravado à mão pelo
     treinador continua a mandar sobre ela. */
  const off = diagram?.spaceOffset || {};
  return [{
    id: 'legacy', w: meters.w, h: meters.h, label: meters.label,
    dx: off.dx !== undefined ? off.dx : (meters.dx || 0),
    dy: off.dy !== undefined ? off.dy : (meters.dy || 0),
  }];
}

// Substitui, em qualquer sítio só de leitura (fichas impressas, miniaturas,
// apresentação do exercício), a antiga única <SpaceZone> por uma por cada
// zona gravada — mantém a mesma aparência de antes quando só há uma.
export function SpaceZonesReadOnly({ diagram, spaceText, printMode }) {
  const zones = getSpaceZones(diagram, spaceText);
  return (
    <>
      {zones.map(z => (
        <SpaceZone key={z.id} meters={{ w: z.w, h: z.h }} label={z.label} center={{ x: 53.5 + (z.dx || 0), y: 35 + (z.dy || 0) }} interactive={false} printMode={printMode} />
      ))}
    </>
  );
}

/* Posições espalhadas em grelha simples dentro de uma faixa do campo — usada
   para separar visualmente cada grupo/cor quando há mais do que um. */
export function autoPositions(n, laneIndex = 0, laneCount = 1) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const laneWidth = 90 / laneCount;
  const laneStart = 5 + laneIndex * laneWidth;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    pts.push({
      x: laneStart + laneWidth * 0.15 + (cols > 1 ? col * (laneWidth * 0.7 / (cols - 1)) : laneWidth * 0.35),
      y: 14 + (row * (38 / Math.max(1, rows - 1 || 1))),
    });
  }
  return pts;
}

/* ENQUADRAMENTO DOS CARTÕES (miniaturas de exercícios, ideias, etc.):
   só o campo — sem a folga à volta nem os bancos — para o relvado encher
   o cartão. Mesma proporção nas duas vistas (o meio-campo vertical ganha
   margem dos lados), para todos os cartões terem a mesma altura. */
export const CARTAO_VIEWBOX = '-2.3 -0.6 111.6 71.2';

// Meio-campo no cartão: a MESMA proporção do campo inteiro (cartões todos
// do mesmo tamanho) e o meio-campo todo à vista, até à linha do meio-campo,
// com folga mínima em cima e em baixo; a largura que sobra fica dos lados.
export const CARTAO_MEIO_V0 = -1.8;

export const CARTAO_MEIO_H = 53.5 + 0.6 - CARTAO_MEIO_V0;

export const CARTAO_MEIO_W = CARTAO_MEIO_H * 111.6 / 71.2;

export const CARTAO_VIEWBOX_MEIO = `${(35 - CARTAO_MEIO_W / 2).toFixed(3)} ${CARTAO_MEIO_V0} ${CARTAO_MEIO_W.toFixed(3)} ${CARTAO_MEIO_H.toFixed(3)}`;

// Linhas laterais no cartão com a MESMA margem que o campo inteiro tem dos
// lados no cartão (fora das linhas de baliza: 1 − (−2,3) = 3,3).
export const ESTICAR_CARTAO_MEIO = (CARTAO_MEIO_W / 2 - 3.3) / 34;

export const CARTAO_ASPECT = '111.6 / 71.2';

export function viewBoxCartao(vista) { return vista === 'meio' ? CARTAO_VIEWBOX_MEIO : CARTAO_VIEWBOX; }

export function aspetoCartao() { return CARTAO_ASPECT; }

// Altura (px) do que rodeia o campo na janela da apresentação: cabeçalho
// da janela, etiquetas, descrição e a linha dos controlos por baixo.
export const CHROME_APRESENTACAO_PX = 250; // sem scroll na janela

export const APRESENTACAO_BOX_MEIO = { x: -2.5, y: -2.5, w: 75, h: 59.5 };

export const APRESENTACAO_VIEWBOX_MEIO = `${APRESENTACAO_BOX_MEIO.x} ${APRESENTACAO_BOX_MEIO.y} ${APRESENTACAO_BOX_MEIO.w} ${APRESENTACAO_BOX_MEIO.h}`;

// Estado do campo num instante de um plano: { passo, elementos, setas }.
export function animEstadoNoPasso(p, ms) {
  const pos = p.posicoes(ms);
  return p.base.map(el => (pos.has(el.id) ? { ...el, ...pos.get(el.id) } : el));
}

/* O DESENHO A IMPRIMIR: O PRIMEIRO PASSO, NÃO O ÚLTIMO.

   O `diagram.elements` guarda as posições ATUAIS — ou seja, onde tudo
   ficou depois de o treinador desenhar a última seta. Numa prancheta com
   animação, isso é o fim da jogada: na folha saía o resultado, não o
   ponto de partida, e quem a lê não percebe de onde se partiu.

   Com sequência gravada, imprime-se o primeiro passo. Sem sequência, o
   desenho é o que é. */
export function diagramaParaImpressao(diagram) {
  const seq = (diagram && diagram.sequence) || [];
  if (!seq.length) return { elements: (diagram && diagram.elements) || [], arrows: (diagram && diagram.arrows) || [] };
  /* As setas do passo vêm de `stepStaticArrows`, a MESMA função que a
     pré-visualização usa para o primeiro fotograma. Eu tinha lido
     `seq[0].arrows`, que é outra coisa — as setas a ANIMAR nesse passo,
     e não as que ficam desenhadas. Daí a folha sair com as posições
     certas e sem setas nenhumas. */
  return {
    elements: stepElements(seq[0], diagram),
    arrows: stepStaticArrows(seq[0], diagram),
  };
}

// Devolve { frames, hasAnimation } — frames é a lista de fotogramas SVG
// (markup já pronto) que, mostrados um a seguir ao outro com o "holdMs"
// indicado, reconstroem passo a passo a coreografia gravada no editor
// (diagram.sequence). Sem sequência gravada, devolve só o fotograma final.
export function computeDiagramAnimationFrames(diagram, zones, phase, opcoes = {}) {
  const iconEscala = iconScaleForPhase(phase, diagram);
  const cartao = !!opcoes.cartao; // miniaturas: campo com riscas, sem bancos
  const sequence = diagram.sequence || [];
  const frames = [];

  const pushFrame = (elements, holdMs, staticArrows = diagram.arrows || []) => {
    frames.push({
      svg: ReactDOMServer.renderToStaticMarkup(
        <VistaCampo vista={diagram.vista} esticar={cartao ? ESTICAR_CARTAO_MEIO : ESTICAR_IMPRESSAO_MEIO}>
          <PitchMarkings cartao={cartao} semBancos={!cartao} />
          {zones.map(z => (
            <SpaceZone key={z.id} meters={{ w: z.w, h: z.h }} label={z.label} center={{ x: 53.5 + (z.dx || 0), y: 35 + (z.dy || 0) }} interactive={false} />
          ))}
          <DiagramElements elements={elements} arrows={staticArrows} interactive={false} iconScale={iconEscala} />
        </VistaCampo>
      ),
      holdMs,
    });
  };

  if (sequence.length === 0) {
    pushFrame(diagram.elements || [], 0);
    return { frames, hasAnimation: false };
  }

  /* Com o motor partilhado (planearCoreografiaAnim): movimentos contínuos,
     bola ao dobro da velocidade, o que foi arrastado desliza e sem pausa
     entre passos. 25 fotogramas por segundo (antes 18, aos saltos). */
  const FRAME_MS = 40;
  const { passos } = planearCoreografiaAnim(diagram);
  passos.forEach((p) => {
    const nSteps = Math.max(1, Math.round(p.dur / FRAME_MS));
    for (let f = 0; f <= nSteps; f++) {
      if (f === 0 && frames.length) continue; // o fim do anterior já é o início deste
      pushFrame(animEstadoNoPasso(p, (f / nSteps) * p.dur), FRAME_MS, p.setasFixas);
    }
    if (p.pausa) frames[frames.length - 1].holdMs = FRAME_MS + p.pausa;
  });
  pushFrame(diagram.elements || [], 0); // fotograma final: exatamente como o exercício está guardado hoje
  return { frames, hasAnimation: true };
}

// Constrói o bloco (campo + eventual botão "Apresentar") para um único
// esquema tático, com um id único (blockId) para não colidir quando há
// vários exercícios no mesmo ficheiro (caso da sessão de treino).
export function buildDiagramBlockHtml(diagram, space, blockId, phase) {
  const zones = getSpaceZones(diagram, space);
  const { frames, hasAnimation } = computeDiagramAnimationFrames(diagram || {}, zones, phase);
  const html = `
    <div class="pitch-wrap" style="aspect-ratio:${aspetoSemBancos(diagram && diagram.vista).replace(/ /g, '')}">
      <svg id="pitch-${blockId}" viewBox="${viewBoxSemBancos(diagram && diagram.vista)}" preserveAspectRatio="xMidYMid meet">${frames[0] ? frames[0].svg : ''}</svg>
    </div>
    ${hasAnimation ? `
    <div class="controls">
      <button class="play-btn" data-block="${blockId}">▶ Apresentar esquema tático</button>
    </div>` : ''}
  `;
  return { html, blockId, frames: hasAnimation ? frames : null };
}

export function DiagramThumb({ diagram, space, phase, height = 95, fill = false }) {
  const zones = getSpaceZones(diagram, space);
  const hasDiagram = diagram && (diagram.elements?.length || diagram.arrows?.length);
  if (!hasDiagram && !zones.length) return null;
  return (
    /* CARTÃO: só o campo, à proporção do campo (a altura sai da largura),
       com riscas e sem bancos. Com `fill` mantém a altura pedida. */
    <svg
      viewBox={viewBoxCartao(diagram && diagram.vista)}
      preserveAspectRatio={fill ? 'xMidYMid slice' : 'xMidYMid meet'}
      style={{ width: '100%', ...(fill ? { height } : { height: 'auto', aspectRatio: aspetoCartao(diagram && diagram.vista) }), background: '#1e3a24', borderRadius: 6, marginBottom: 8, display: 'block' }}
    >
      <VistaCampo vista={diagram && diagram.vista} esticar={ESTICAR_CARTAO_MEIO}>
      <PitchMarkings cartao />
      {zones.map(z => (
        <SpaceZone key={z.id} meters={{ w: z.w, h: z.h }} label={z.label} center={{ x: 53.5 + (z.dx || 0), y: 35 + (z.dy || 0) }} interactive={false} />
      ))}
      <DiagramElements elements={diagram?.elements || []} arrows={diagram?.arrows || []} interactive={false} iconScale={iconScaleForPhase(phase, diagram)} />
      </VistaCampo>
    </svg>
  );
}

