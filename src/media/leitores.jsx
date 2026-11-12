// media/leitores.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, SkipForward, Check, SkipBack, Printer, Minimize2, Maximize2, Download, ExternalLink, Presentation } from 'lucide-react';
import { T, body } from '../base/tema';
import { Btn } from '../base/ui';
import { VideoComBarra, driveEmbedSrc, driveOpenSrc } from './social';
import { hrefDescarga } from '../base/anexos';

/* ---------------------------------------------------------------
   APRESENTAÇÕES — mesmo layout da TV (painel principal
   à esquerda + lista de itens à direita), mas para ficheiros
   carregados diretamente (PDF, PowerPoint, vídeo) em vez de links
   do YouTube. PDFs e vídeos abrem e reproduzem dentro da própria
   app; ficheiros PowerPoint não podem ser pré-visualizados por um
   browser sem estarem alojados publicamente, por isso mostram um
   cartão com o nome do ficheiro e um botão para abrir/descarregar.
---------------------------------------------------------------- */
export function presentationKind(file) {
  const type = file.type || '';
  const name = (file.name || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/.test(name)) return 'video';
  if (
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    type === 'application/vnd.ms-powerpoint' ||
    /\.(pptx|ppt)$/.test(name)
  ) return 'pptx';
  return null;
}

/* Converte um data URL (base64) num blob: URL. É preciso para o PDF —
   o Chrome (sobretudo no telemóvel) recusa-se a mostrar um PDF embutido
   num iframe quando o src é um data: URI (trata-o como navegação
   bloqueada e mostra apenas o cartão "Abrir" em vez do conteúdo). Um
   blob: URL não tem essa restrição e funciona em todos os browsers. */
export function useBlobUrl(dataUrl) {
  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    if (!dataUrl) { setBlobUrl(null); return undefined; }
    // Ficheiro no Storage: já é um link, o leitor de PDF abre-o diretamente.
    if (!/^data:/.test(dataUrl)) { setBlobUrl(dataUrl); return undefined; }
    try {
      const [header, base64] = dataUrl.split(',');
      const mimeMatch = /data:([^;]+);base64/.exec(header || '');
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch (e) {
      setBlobUrl(null);
      return undefined;
    }
  }, [dataUrl]);
  return blobUrl;
}

// Duas fontes possíveis para o pdf.js, com uma versão real e estável
// (3.11.174) — a versão "4.0.379" usada antes não existe naquele CDN, daí
// o script falhar sempre a carregar e a pré-visualização nunca aparecer,
// em nenhum browser (não era só um problema do Android). Se a primeira
// fonte falhar (bloqueio de rede, CDN em baixo), tenta-se a segunda antes
// de desistir.
export const PDFJS_CDN_CANDIDATES = [
  {
    lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  },
  {
    lib: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  },
];

export function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha a carregar ${src}`));
    document.head.appendChild(script);
  });
}

export let pdfJsLoadPromise = null;

// Carrega o pdf.js (Mozilla) a partir de um CDN, uma única vez, e prepara o
// worker. Ficamos com uma única instância partilhada por toda a app.
export function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem window'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfJsLoadPromise) return pdfJsLoadPromise;
  pdfJsLoadPromise = (async () => {
    let lastErr = null;
    for (const candidate of PDFJS_CDN_CANDIDATES) {
      try {
        await loadScriptOnce(candidate.lib);
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = candidate.worker;
          return window.pdfjsLib;
        }
      } catch (err) {
        lastErr = err;
      }
    }
    // Nenhuma das fontes resultou — liberta a promessa para que uma
    // próxima tentativa (por exemplo, abrir o PDF outra vez) não fique
    // presa a esta falha para sempre.
    pdfJsLoadPromise = null;
    throw lastErr || new Error('Não foi possível carregar o pdf.js');
  })();
  return pdfJsLoadPromise;
}

export function PdfCanvasViewer({ dataUrl }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);

  // Carrega o documento PDF sempre que o dataUrl muda.
  useEffect(() => {
    if (!dataUrl) return undefined;
    let cancelled = false;
    setStatus('loading');
    setNumPages(0);
    setPageNum(1);
    loadPdfJs()
      .then(pdfjsLib => (cancelled ? null : pdfjsLib.getDocument(dataUrl).promise))
      .then((pdf) => {
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Erro ao carregar o PDF', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      if (pdfDocRef.current) { try { pdfDocRef.current.destroy(); } catch (e) { /* ignore */ } }
      pdfDocRef.current = null;
    };
  }, [dataUrl]);

  // Desenha só a página atual, ajustada por inteiro ao contentor (largura
  // E altura), numa resolução bem acima do tamanho de exibição —
  // multiplicada pelo devicePixelRatio do ecrã (para não desfocar em ecrãs
  // retina/telemóvel, limitado a 3x) e por um fator extra de nitidez, já
  // que só há uma página de cada vez para desenhar — ao contrário da
  // versão anterior, que desenhava todas empilhadas e por isso tinha de
  // poupar resolução por cada uma.
  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !container || !canvas) return;
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch (e) { /* ignore */ } }
    try {
      const page = await pdf.getPage(pageNum);
      const width = Math.max(280, container.clientWidth || 600);
      const height = Math.max(280, container.clientHeight || 800);
      const unscaled = page.getViewport({ scale: 1 });
      const fitScale = Math.min(width / unscaled.width, height / unscaled.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const QUALITY = 1.5;
      const renderScale = fitScale * dpr * QUALITY;
      const viewport = page.getViewport({ scale: renderScale });
      // Desenha primeiro numa tela escondida e só no fim passa para a do
      // ecrã, de uma vez. Antes, o pdf.js pintava a página de branco e ia
      // desenhando por cima à vista de todos: dava um clarão branco ao
      // escolher uma apresentação (e ao mudar de página).
      const escondida = document.createElement('canvas');
      escondida.width = Math.ceil(viewport.width);
      escondida.height = Math.ceil(viewport.height);
      const task = page.render({ canvasContext: escondida.getContext('2d'), viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
      if (canvasRef.current !== canvas) return;
      canvas.width = escondida.width;
      canvas.height = escondida.height;
      canvas.style.width = `${Math.ceil(fitScale * unscaled.width)}px`;
      canvas.style.height = `${Math.ceil(fitScale * unscaled.height)}px`;
      canvas.getContext('2d').drawImage(escondida, 0, 0);
    } catch (err) {
      if (err && err.name !== 'RenderingCancelledException') {
        console.error('Erro ao mostrar a página do PDF', err);
      }
    }
  }, [pageNum]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    renderPage();
    const onResize = () => renderPage();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [status, renderPage]);

  const goPrev = useCallback(() => setPageNum(p => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPageNum(p => Math.min(numPages || 1, p + 1)), [numPages]);

  // Navegação por teclado — ignora quando o foco está num campo de texto,
  // para não interferir com o resto da app.
  useEffect(() => {
    if (status !== 'ready' || numPages <= 1) return undefined;
    const onKeyDown = (e) => {
      const active = document.activeElement;
      const tag = active && active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, numPages, goNext, goPrev]);

  /* Deslizar para mudar de página (telemóvel/tablet). O canvas do PDF não
     tem scroll próprio, por isso o gesto era ignorado — só funcionavam as
     setas e o teclado. touchAction:'pan-y' deixa o scroll vertical da
     página continuar a funcionar fora do ecrã inteiro. */
  const touchRef = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    touchRef.current = t ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  };
  const onTouchEnd = (e) => {
    const startPt = touchRef.current;
    touchRef.current = null;
    if (!startPt || numPages <= 1) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startPt.x;
    const dy = t.clientY - startPt.y;
    // Só conta como deslize horizontal se for claramente mais horizontal
    // do que vertical e com alguma amplitude.
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0) goNext(); else goPrev();
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y',
      }}
    >
      {status === 'ready' && <canvas ref={canvasRef} style={{ display: 'block' }} />}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ddd', fontSize: 12.5 }}>
          A carregar o PDF…
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ddd', fontSize: 12.5, textAlign: 'center', padding: 20 }}>
          Não foi possível mostrar a pré-visualização deste PDF. Usa "Abrir / descarregar" abaixo.
        </div>
      )}
      {status === 'ready' && numPages > 1 && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', borderRadius: 20,
          background: 'rgba(0,0,0,0.6)',
        }}>
          <button
            type="button" onClick={goPrev} disabled={pageNum <= 1}
            style={{ background: 'none', border: 'none', color: pageNum <= 1 ? 'rgba(255,255,255,0.35)' : '#fff', cursor: pageNum <= 1 ? 'default' : 'pointer', display: 'flex', padding: 2 }}
            title="Página anterior (seta esquerda)"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 12, color: '#fff', minWidth: 46, textAlign: 'center' }}>{pageNum} / {numPages}</span>
          <button
            type="button" onClick={goNext} disabled={pageNum >= numPages}
            style={{ background: 'none', border: 'none', color: pageNum >= numPages ? 'rgba(255,255,255,0.35)' : '#fff', cursor: pageNum >= numPages ? 'default' : 'pointer', display: 'flex', padding: 2 }}
            title="Página seguinte (seta direita)"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/* TROCAR DE VÍDEO SEM PISCAR. O vídeo novo carrega escondido, por trás
   do que já está a ser mostrado (que fica parado na imagem em que estava);
   só quando o novo tem a primeira imagem pronta é que troca. Antes, cada
   troca mostrava um ecrã preto (ou a miniatura) durante o carregamento,
   que nos MP4 do Storage chega a demorar 1 a 3 segundos.
   Os dois leitores vivem na mesma lista, pela chave do vídeo: o que estava
   a carregar passa a ser o mostrado sem ser montado de novo (não recarrega). */
export function VideoSemPiscar({ item, proporcao }) {
  const [mostradoId, setMostradoId] = useState(item.id);
  const [itens, setItens] = useState(() => ({ [item.id]: item }));
  const alvoId = item.id;
  useEffect(() => {
    setItens(prev => (prev[alvoId] ? { ...prev, [alvoId]: item } : { ...prev, [alvoId]: item }));
    if (alvoId === mostradoId) return undefined;
    // Rede de segurança: se o novo demorar muito, troca na mesma.
    const t = setTimeout(() => setMostradoId(alvoId), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoId, item.dataUrl]);
  // Fica só o mostrado e o que está a carregar (os outros desmontam-se).
  useEffect(() => {
    setItens(prev => {
      const keep = {};
      [mostradoId, alvoId].forEach(id => { if (prev[id]) keep[id] = prev[id]; });
      return Object.keys(keep).length === Object.keys(prev).length ? prev : keep;
    });
  }, [mostradoId, alvoId]);
  const ids = [mostradoId, alvoId].filter((id, i, a) => a.indexOf(id) === i && itens[id]);
  return (
    <>
      {ids.map(id => {
        const it = itens[id];
        const visivel = id === mostradoId;
        return (
          <div key={id} style={visivel
            ? (proporcao ? { display: 'flex', flexDirection: 'column' } : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' })
            : { position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column' }}>
            <VideoComBarra
              /* Sem miniatura por trás: a miniatura dos cortes é tirada de outro
                 instante do vídeo, e ao começar a imagem trocava por outra
                 (parecia que a câmara se mexia). Fica o quadro preto, do
                 tamanho final, até à primeira imagem — como no YouTube. */
              src={it.dataUrl} poster={undefined}
              preload={visivel ? undefined : 'auto'} semEcraInteiro style={proporcao ? undefined : { flex: 1, minHeight: 0 }}
              videoStyle={proporcao ? { aspectRatio: '16 / 9', height: 'auto' } : undefined}
              pausado={!visivel || id !== alvoId}
              onPronto={id === alvoId && id !== mostradoId ? () => setMostradoId(id) : undefined}
            />
          </div>
        );
      })}
    </>
  );
}

/* BARRA DE TEMPO DA SALA — desenhada à mão (em vez do <input range>), para
   a bolinha chegar MESMO ao fim quando o clipe acaba (no range nativo
   ficava sempre um bocadinho antes). Arrastar com o rato ou o dedo. */
export function BarraTempoSala({ min, max, value, onChange, onLargar, disabled, rotulo }) {
  const ref = useRef(null);
  const span = Math.max(0.001, max - min);
  const pct = Math.min(1, Math.max(0, (value - min) / span));
  const KNOB = 14;
  const valorEm = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left - KNOB / 2) / Math.max(1, r.width - KNOB)));
    return min + f * span;
  };
  const aoPremir = (e) => {
    if (disabled) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    onChange(valorEm(e.clientX));
  };
  const aoMover = (e) => { if (disabled || !(e.buttons & 1) && e.pointerType === 'mouse') return; if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) onChange(valorEm(e.clientX)); };
  const aoLargarP = () => { if (onLargar) onLargar(); };
  return (
    <div ref={ref} role="slider" aria-label={rotulo} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      onPointerDown={aoPremir} onPointerMove={aoMover} onPointerUp={aoLargarP} onPointerCancel={aoLargarP}
      style={{ position: 'relative', flex: 1, minWidth: 0, height: 22, cursor: disabled ? 'default' : 'pointer', touchAction: 'none' }}>
      <div style={{ position: 'absolute', left: KNOB / 2, right: KNOB / 2, top: '50%', height: 4, marginTop: -2, borderRadius: 2, background: '#ffffff40' }} />
      <div style={{ position: 'absolute', left: KNOB / 2, top: '50%', height: 4, marginTop: -2, borderRadius: 2, background: T.gold, width: `calc((100% - ${KNOB}px) * ${pct})` }} />
      <div style={{ position: 'absolute', top: '50%', width: KNOB, height: KNOB, marginTop: -KNOB / 2, borderRadius: '50%', background: T.gold, left: `calc((100% - ${KNOB}px) * ${pct})` }} />
    </div>
  );
}

/* FIM DO CLIPE — o MESMO aspeto do leitor da Análise individual em
   clipes (AnalisadorVideo › ClipAtletaModal): véu escuro, "Repetir" e
   "Clipe seguinte"; no último, só "Repetir". Usado na Sala de Vídeo
   (cortes do YouTube e clipes em vídeo). */
export function FimDoClipe({ onRepetir, onSeguinte }) {
  // Botões com o estilo EXATO do Btn "ghost" do AnalisadorVideo
  // (transparente, contorno fino, texto claro, cantos de 7 px).
  const estilo = (desligado) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 7, padding: '8px 12px',
    fontSize: 13, fontWeight: 500, cursor: desligado ? 'not-allowed' : 'pointer', opacity: desligado ? 0.45 : 1,
    background: 'transparent', color: T.cream, border: `1px solid ${T.line}`, ...body,
  });
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', padding: 12 }}>
        <button type="button" onClick={onRepetir} style={{ ...estilo(false), background: 'rgba(0,0,0,0.6)' }}>
          <RotateCcw size={15} /> Repetir
        </button>
        {onSeguinte
          ? <button type="button" onClick={onSeguinte} style={estilo(false)}><SkipForward size={15} /> Clipe seguinte</button>
          : <button type="button" disabled style={{ ...estilo(true), background: 'rgba(0,0,0,0.6)' }}><Check size={15} /> Último clipe</button>}
      </div>
    </div>
  );
}

/* CLIPE EM VÍDEO (MP4) NA SALA DE VÍDEO — como na Análise individual em
   clipes: começa a tocar, ao chegar ao fim PÁRA na última imagem e
   aparece "Repetir" / "Clipe seguinte" (avança-se à mão). */
export function LeitorClipeSala({ item, posicao, onAnterior, onSeguinte }) {
  const ref = useRef(null);
  const [noFim, setNoFim] = useState(false);
  // Sozinho (sem lista) repete sem parar, como na Análise individual.
  const emLista = !!posicao;
  const repetir = () => {
    const v = ref.current; if (!v) return;
    setNoFim(false);
    try { v.currentTime = 0; v.play(); } catch (e) { /* nada */ }
  };
  return (
    <div style={{ width: '100%', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
      {/* A mesma barra de cima do leitor da Análise individual em clipes. */}
      {posicao && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.surface, borderBottom: `1px solid ${T.line}` }}>
          <span style={{ fontSize: 12.5, color: T.muted, ...body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong style={{ color: T.gold, fontWeight: 700 }}>Clipe {posicao.indice + 1} de {posicao.total} · </strong>
            {item.title || 'Clipe'}
          </span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Btn escuro variant="ghost" onClick={onAnterior || undefined} disabled={!onAnterior} style={{ padding: '6px 10px' }} title="Clipe anterior"><SkipBack size={14} /></Btn>
            <Btn escuro variant="ghost" onClick={onSeguinte || undefined} disabled={!onSeguinte} style={{ padding: '6px 10px' }} title="Clipe seguinte"><SkipForward size={14} /></Btn>
          </div>
        </div>
      )}
      <div style={{ position: 'relative' }}>
      <video ref={ref} src={item.dataUrl} controls autoPlay playsInline loop={!emLista}
        onEnded={() => setNoFim(true)} onPlay={() => setNoFim(false)}
        style={{ width: '100%', maxHeight: '70vh', display: 'block', background: '#000' }} />
      {noFim && posicao && <FimDoClipe onRepetir={repetir} onSeguinte={onSeguinte} />}
      </div>
    </div>
  );
}

export function AttachmentPreview({ item, tall }) {
  const boxRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pdfBlobUrl = useBlobUrl(item && item.kind === 'pdf' ? item.dataUrl : null);

  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(!!fsEl && fsEl === boxRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  if (!item) return null;

  // O wrapper (não o iframe/vídeo em si) é que entra em ecrã inteiro —
  // assim a barra com o botão fica sempre por baixo do conteúdo, nunca
  // sobreposta aos controlos nativos do leitor de PDF/vídeo (que incluem
  // o próprio botão de imprimir do browser), e continua visível depois
  // de entrar em ecrã inteiro para se poder clicar outra vez e sair.
  const wrapStyle = {
    width: '100%', borderRadius: 10, overflow: 'hidden',
    border: `1px solid ${T.line}`, background: '#000',
    height: tall ? 460 : 300,
    display: 'flex', flexDirection: 'column',
  };
  const toggleFs = (e) => {
    e.stopPropagation();
    const el = boxRef.current;
    if (!el) return;
    if (isFullscreen) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };
  /* IMPRIMIR documentos.

     Um PDF não se imprime a partir da nossa página: quem o desenha é o
     leitor de PDF do browser (ou o do Google, no caso do Drive), e só
     esse é que tem o comando de impressão. Por isso abrimos o documento
     num separador novo e pedimos a impressão aí. Se o browser bloquear a
     janela, o separador fica aberto à mesma e basta usar o botão de
     imprimir do próprio leitor.

     No iPhone o Safari não permite disparar a impressão por código —
     abre o documento e usa-se o botão de partilha › Imprimir. */
  const canPrint = item.kind === 'pdf' || item.kind === 'drive';
  const doPrintDoc = (e) => {
    e.stopPropagation();
    const url = item.kind === 'drive' ? driveOpenSrc(item.drive) : (pdfBlobUrl || item.dataUrl);
    if (!url) return;
    const win = window.open(url, '_blank');
    if (!win) return; // janela bloqueada — o utilizador abre pelo botão do lado
    // Dá tempo ao leitor de PDF para carregar antes de pedir a impressão.
    setTimeout(() => {
      try { win.focus(); win.print(); } catch (err) { /* o leitor tem o seu próprio botão */ }
    }, 1500);
  };
  const PrintBtn = canPrint ? (
    <button
      onClick={doPrintDoc}
      title="Abrir num separador novo e imprimir"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
      }}
    >
      <Printer size={14} /> Imprimir
    </button>
  ) : null;

  const FsBar = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
      padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
    }}>
      <button
        onClick={toggleFs}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
        }}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {isFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'}
      </button>
    </div>
  );
  if (item.kind === 'image') {
    return (
      <div ref={boxRef} style={wrapStyle}>
        <div style={{ flex: 1, minHeight: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            key={item.id}
            src={item.dataUrl}
            alt={item.title || item.fileName || 'Imagem'}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
        }}>
          <a
            href={hrefDescarga(item.dataUrl, item.fileName || 'imagem.jpg')} download={item.fileName || 'imagem.jpg'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', textDecoration: 'none' }}
          >
            <Download size={13} /> Abrir / descarregar
          </a>
          <button
            onClick={toggleFs}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'}
          </button>
        </div>
      </div>
    );
  }
  if (item.kind === 'video') {
    /* MESMO TAMANHO DO LEITOR DO YOUTUBE: a imagem num quadro 16:9 da
       largura toda, a barra de reprodução e a do ecrã inteiro por baixo.
       Antes a caixa tinha 300 px de altura fixa e a imagem ficava mais
       pequena; e enquanto o vídeo carregava, o quadro começava baixo e
       crescia, o que fazia o cartão piscar. Com o 16:9 desde o início, a
       altura não muda ao carregar. Em ecrã inteiro ocupa tudo, como antes. */
    return (
      <div ref={boxRef} style={isFullscreen ? wrapStyle : { ...wrapStyle, height: 'auto' }}>
        <div style={isFullscreen
          ? { flex: 1, minHeight: 0, background: '#000', display: 'flex', flexDirection: 'column', position: 'relative' }
          : { background: '#000', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <VideoSemPiscar item={item} proporcao={!isFullscreen} />
        </div>
        {FsBar}
      </div>
    );
  }
  if (item.kind === 'drive' && item.drive) {
    // Visualizador do próprio Google. Não conseguimos controlar páginas
    // nem gestos aqui dentro — o iframe é de outro domínio.
    const src = driveEmbedSrc(item.drive);
    return (
      <div ref={boxRef} style={wrapStyle}>
        <div style={{ flex: 1, minHeight: 0, background: '#fff' }}>
          <iframe
            key={item.id}
            src={src}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; fullscreen"
            allowFullScreen
            title={item.title || 'Documento do Google Drive'}
          />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
        }}>
          <a
            href={driveOpenSrc(item.drive)} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', textDecoration: 'none' }}
          >
            <ExternalLink size={13} /> Abrir no Drive
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {PrintBtn}
          <button
            onClick={toggleFs}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'}
          </button>
          </div>
        </div>
      </div>
    );
  }
  if (item.kind === 'pdf') {
    return (
      <div ref={boxRef} style={wrapStyle}>
        <div style={{ flex: 1, minHeight: 0, background: '#fff', position: 'relative' }}>
          {pdfBlobUrl ? (
            <PdfCanvasViewer key={item.id} dataUrl={pdfBlobUrl} />
          ) : (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.mutedDim, fontSize: 12.5,
            }}>
              A preparar o PDF…
            </div>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
        }}>
          {/* Alguns browsers/apps móveis (WebViews dentro de outras apps,
              navegadores mais antigos) continuam a não conseguir mostrar o
              PDF embutido mesmo com blob: URL — este link garante que há
              sempre uma forma de o abrir/descarregar. */}
          <a
            href={hrefDescarga(item.dataUrl, item.fileName || 'documento.pdf')} download={item.fileName || 'documento.pdf'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', textDecoration: 'none' }}
          >
            <Download size={13} /> Abrir / descarregar
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {PrintBtn}
          <button
            onClick={toggleFs}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'}
          </button>
          </div>
        </div>
      </div>
    );
  }
  // pptx — sem pré-visualização possível a partir de um ficheiro local
  return (
    <div style={{ ...wrapStyle, background: T.surfaceRaise, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, textAlign: 'center' }}>
      <Presentation size={38} color={T.mutedDim} />
      <div style={{ fontSize: 13, color: T.cream, fontWeight: 500 }}>{item.fileName}</div>
      <div style={{ fontSize: 12, color: T.mutedDim, maxWidth: 320 }}>
        Ficheiros PowerPoint não podem ser pré-visualizados diretamente no browser. Abre ou descarrega para veres a apresentação.
      </div>
      <a
        href={hrefDescarga(item.dataUrl, item.fileName)} download={item.fileName}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.warn, textDecoration: 'none', border: `1px solid ${T.gold}55`, borderRadius: 8, padding: '7px 14px' }}
      >
        <Download size={14} /> Abrir / descarregar
      </a>
    </div>
  );
}

