import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Play, Pause, Scissors, Circle, ArrowUpRight, Minus, Eraser, Trash2,
  Link2, Copy, Check, Video, Upload, Tag, X, Flag, RotateCcw, Loader2, Film,
  Maximize2, Minimize2, Square, Type,
} from 'lucide-react';

/* ---------------------------------------------------------------
   TOKENS — herdados da MisterJP, para a ferramenta parecer o mesmo
   produto, não um anexo à parte.
---------------------------------------------------------------- */
const T = {
  bg: '#182619', surface: '#202F22', surfaceRaise: '#2B402D', line: '#3A4F3D',
  crimson: '#A6192E', crimsonBright: '#D14056', gold: '#C9A227', cream: '#ECEFEA',
  muted: '#8FA091', mutedDim: '#6B7A6D', good: '#4CA86B', warn: '#D9A72E', bad: '#C25A5A',
  teamB: '#3A6FC4', teamC: '#D9A72E', teamD: '#8C3F9E',
};
const TEXT_ON_ACCENT = '#FBF3F0';
const COR_DESENHO = '#FFFFFF'; // branco — antes era vermelho por omissão
const display = { fontFamily: "'Oswald', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

const TAGS = [
  { id: 'golo', label: 'Golo', color: T.good },
  { id: 'remate', label: 'Remate', color: T.gold },
  { id: 'bp', label: 'Bola Parada', color: T.teamB },
  { id: 'perda', label: 'Perda', color: T.bad },
  { id: 'recuperacao', label: 'Recuperação', color: T.teamD },
  { id: 'transicao', label: 'Transição', color: T.crimsonBright },
  { id: 'individual', label: 'Ação Individual', color: T.teamC },
  { id: 'erro', label: 'Erro', color: T.bad },
];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function fmt(t) {
  if (!Number.isFinite(t)) return '00:00';
  const m = Math.floor(t / 60).toString().padStart(2, '0');
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
function parseMMSS(str) {
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec((str || '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function Btn({ children, onClick, variant = 'ghost', active, disabled, style, title }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 7,
    padding: '8px 12px', fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500, opacity: disabled ? 0.45 : 1, ...body,
  };
  const variants = {
    solid: { background: T.crimson, color: TEXT_ON_ACCENT },
    ghost: { background: active ? T.surfaceRaise : 'transparent', color: T.cream, border: `1px solid ${T.line}` },
    plain: { background: 'transparent', color: T.muted },
  };
  return (
    <button title={title} disabled={disabled} onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

/* ---- Geometria para a borracha parcial (distância de um ponto a uma forma) ---- */
function distPontoSegmento(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx, py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}
function distanciaShape(sh, p) {
  const pts = sh.points || [];
  const [a, b] = pts;
  if (!a) return Infinity;
  if (sh.tool === 'texto') return Math.hypot(p.x - a.x, p.y - a.y);
  if (sh.tool === 'circulo' && b) {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    const dCentro = Math.hypot(p.x - a.x, p.y - a.y);
    return dCentro <= r ? 0 : dCentro - r; // dentro do círculo conta sempre como acerto
  }
  if (sh.tool === 'retangulo' && b) {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) return 0; // dentro da zona conta sempre como acerto
    const c = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    return Math.min(distPontoSegmento(p, c[0], c[1]), distPontoSegmento(p, c[1], c[2]), distPontoSegmento(p, c[2], c[3]), distPontoSegmento(p, c[3], c[0]));
  }
  if (sh.tool === 'livre') {
    let min = Infinity;
    for (let k = 0; k < pts.length - 1; k++) min = Math.min(min, distPontoSegmento(p, pts[k], pts[k + 1]));
    return min;
  }
  if (b) return distPontoSegmento(p, a, b);
  return Infinity;
}

/* Desenha uma forma no SVG — usado tanto no editor como na reprodução do
   clipe já guardado (por isso vive fora do componente principal). */
function renderShape(sh, i) {
  if (!sh || !sh.points || sh.points.length === 0) return null;
  const [a, b] = sh.points;
  if (!a) return null;
  const cor = { stroke: sh.color || COR_DESENHO, fill: 'none' };
  if (sh.tool === 'texto') {
    return <text key={i} x={a.x} y={a.y} fill={sh.color || COR_DESENHO} fontSize={3.4} fontWeight={700} style={{ fontFamily: "'Inter', sans-serif", paintOrder: 'stroke', stroke: '#00000099', strokeWidth: 0.5 }}>{sh.texto}</text>;
  }
  if (sh.tool === 'livre') {
    const d = sh.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return <path key={i} d={d} style={cor} strokeWidth={0.6} strokeLinecap="round" />;
  }
  if (!b) return null;
  if (sh.tool === 'circulo') return <circle key={i} cx={a.x} cy={a.y} r={Math.hypot(b.x - a.x, b.y - a.y)} style={cor} strokeWidth={0.6} />;
  if (sh.tool === 'linha') return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={cor} strokeWidth={0.6} />;
  if (sh.tool === 'retangulo') {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    return <rect key={i} x={x} y={y} width={w} height={h} fill={sh.color || COR_DESENHO} fillOpacity={0.22} stroke={sh.color || COR_DESENHO} strokeWidth={0.6} />;
  }
  const angle = Math.atan2(b.y - a.y, b.x - a.x); const ah = 2.2;
  const p1 = { x: b.x - ah * Math.cos(angle - 0.4), y: b.y - ah * Math.sin(angle - 0.4) };
  const p2 = { x: b.x - ah * Math.cos(angle + 0.4), y: b.y - ah * Math.sin(angle + 0.4) };
  return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={cor} strokeWidth={0.6} />
    <path d={`M ${b.x} ${b.y} L ${p1.x} ${p1.y} M ${b.x} ${b.y} L ${p2.x} ${p2.y}`} style={cor} strokeWidth={0.6} strokeLinecap="round" /></g>;
}

function shapeVisivelEm(sh, tempo) {
  const inicio = sh.criadoEmTempo ?? 0;
  if (tempo < inicio) return false;
  if (sh.mostrarAte != null) return tempo <= sh.mostrarAte;
  if (sh.duracao != null) return tempo <= inicio + sh.duracao; // compatibilidade com clipes guardados antes desta alteração
  return true; // sem limite definido = sempre visível
}

/* ---- Leitor do clipe já guardado — com os desenhos a aparecerem/
   desaparecerem no tempo certo, tal como foram marcados. ---- */
function ClipPlayerModal({ clip, tag, onClose }) {
  const [t, setT] = useState(0);
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.line}`, maxWidth: 720, width: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${T.line}` }}>
          <span style={{ fontSize: 12.5, color: T.muted, ...body }}>{tag?.label} · {Math.round(clip.duracao)}s</span>
          <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ position: 'relative' }}>
          <video src={clip.publicUrl} controls autoPlay onTimeUpdate={e => setT(e.currentTarget.currentTime)}
            style={{ width: '100%', display: 'block', background: '#000' }} />
          <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {(clip.shapes || []).filter(sh => shapeVisivelEm(sh, t)).map(renderShape)}
          </svg>
        </div>
        {clip.note && <div style={{ padding: 12, fontSize: 13, color: T.cream }}>{clip.note}</div>}
      </div>
    </div>
  );
}

/* PROPS ESPERADAS — passadas do App principal, tal como `documentos`/
   `setDocumentos` já são passadas ao `DocumentosApp`:
   teamId, videosOriginais, setVideosOriginais, clipes, setClipes
   (os dois últimos pares vêm de `useCollectionSync('video_originais', …)`
   e `useCollectionSync('video_clips', …)` no App principal). */
export default function AnalisadorVideo({ teamId, videosOriginais = [], setVideosOriginais, clipes = [], setClipes, uploadVideoEstado, iniciarUploadVideo, askConfirm }) {
  const videoRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [originalAtivoId, setOriginalAtivoId] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const [videoPronto, setVideoPronto] = useState(false);
  const [erro, setErro] = useState('');

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const [inPoint, setInPoint] = useState(null);
  const [outPoint, setOutPoint] = useState(null);
  const [pendingTag, setPendingTag] = useState(null);
  const [note, setNote] = useState('');
  const [aGuardarClipe, setAGuardarClipe] = useState(false);

  const [modoDesenho, setModoDesenho] = useState(false);
  const [tool, setTool] = useState('seta');
  const [shapes, setShapes] = useState([]);
  const [textoPendente, setTextoPendente] = useState(null);
  const [editandoDuracaoIndex, setEditandoDuracaoIndex] = useState(null);
  const [duracaoInputTexto, setDuracaoInputTexto] = useState('');
  const drawState = useRef(null);
  const dragState = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  const [clipeAReproduzir, setClipeAReproduzir] = useState(null);

  const originalAtivo = videosOriginais.find(v => v.id === originalAtivoId) || null;

  // Enquanto houver algum vídeo "a preparar" (pronto: false), confirma-se
  // a cada 15 segundos se já ficou pronto — sem esperar pela rede de
  // segurança geral da app (essa só corre de 20 em 20 minutos, pensada
  // para casos gerais, não para alguém a olhar para o ecrã à espera de
  // UM vídeo específico agora mesmo). O Realtime continua a ser o
  // caminho normal; isto é só um reforço para quando ele falha em
  // silêncio.
  useEffect(() => {
    const idsAPreparar = videosOriginais.filter(v => v.pronto === false).map(v => v.id);
    if (idsAPreparar.length === 0) return undefined;
    let falhasSeguidas = 0;
    const intervalo = setInterval(async () => {
      const { data, error } = await supabase.from('video_originais').select('id, data').in('id', idsAPreparar);
      if (error || !data) {
        // Depois de várias falhas seguidas (ex.: sessão de login expirou
        // numa aba deixada aberta muito tempo), desiste — martelar o
        // mesmo pedido de 15 em 15 segundos para sempre não ajuda nada
        // nesse caso, só enche os registos de erros. Um simples refresh
        // da página resolve (renova a sessão).
        falhasSeguidas += 1;
        if (falhasSeguidas >= 4) clearInterval(intervalo);
        return;
      }
      falhasSeguidas = 0;
      setVideosOriginais(prev => prev.map(v => {
        const atualizado = data.find(r => r.id === v.id);
        return atualizado ? { ...atualizado.data, id: v.id } : v;
      }));
    }, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videosOriginais.map(v => `${v.id}:${v.pronto}`).join(',')]);

  useEffect(() => {
    const aoMudar = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);
  const alternarEcraInteiro = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  // Assim que se escolhe um vídeo original, gera-se um signed URL —
  // o bucket `videos-originais` é privado, o browser precisa de um
  // link temporário para o poder reproduzir.
  useEffect(() => {
    setSignedUrl(null);
    if (!originalAtivo || originalAtivo.pronto === false) return;
    let cancelado = false;
    const tentar = async () => {
      for (let tentativa = 0; tentativa < 5 && !cancelado; tentativa++) {
        const { data, error } = await supabase.storage.from('videos-originais').createSignedUrl(originalAtivo.storagePath, 3600);
        if (cancelado) return;
        if (!error) { setSignedUrl(data.signedUrl); return; }
        await new Promise(r => setTimeout(r, 3000));
      }
      if (!cancelado) setErro('Este vídeo ainda não está disponível no servidor. Espera um pouco e volta a escolhê-lo na lista.');
    };
    tentar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalAtivo?.id, originalAtivo?.pronto]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [signedUrl]);

  const togglePlay = () => { const v = videoRef.current; if (v) { v.paused ? v.play() : v.pause(); } };
  const seekTo = (t) => { const v = videoRef.current; if (v) { v.currentTime = Math.max(0, Math.min(duration || t, t)); setCurrent(v.currentTime); } };
  const onScrubClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * (duration || 0));
  };

  const markIn = () => { setInPoint(current); if (outPoint != null && outPoint < current) setOutPoint(null); };
  const markOut = () => { setOutPoint(current); if (inPoint == null) setInPoint(Math.max(0, current - 8)); };
  const limparMarcas = () => { setInPoint(null); setOutPoint(null); setPendingTag(null); setNote(''); setShapes([]); setTextoPendente(null); };

  // Seleciona automaticamente o vídeo assim que o upload (gerido lá em
  // cima, no App, para sobreviver à troca de separador) terminar com êxito.
  const aCarregarAntesRef = useRef(uploadVideoEstado?.ativo);
  useEffect(() => {
    if (aCarregarAntesRef.current && !uploadVideoEstado?.ativo && !uploadVideoEstado?.erro) {
      const ultimo = videosOriginais[videosOriginais.length - 1];
      if (ultimo) setOriginalAtivoId(ultimo.id);
    }
    aCarregarAntesRef.current = uploadVideoEstado?.ativo;
  }, [uploadVideoEstado?.ativo]); // eslint-disable-line react-hooks/exhaustive-deps

  const apagarOriginal = (video) => {
    const executar = async () => {
      try { await supabase.storage.from('videos-originais').remove([video.storagePath]); } catch (e) { /* apaga o registo à mesma */ }
      setVideosOriginais(prev => prev.filter(v => v.id !== video.id));
      if (originalAtivoId === video.id) { setOriginalAtivoId(null); limparMarcas(); }
    };
    if (askConfirm) {
      askConfirm({
        title: 'Apagar vídeo?',
        label: `Vídeo "${video.titulo}"`,
        note: 'Os clipes já cortados dele mantêm-se — só o vídeo completo desaparece.',
        confirmLabel: 'Apagar',
        onConfirm: executar,
      });
    } else if (window.confirm(`Apagar o vídeo "${video.titulo}"? Os clipes já cortados dele mantêm-se — só o vídeo completo desaparece.`)) {
      executar();
    }
  };

  /* ---- Guardar clipe: chama a função que corta sem recodificar ---- */
  const guardarClipe = async () => {
    if (!originalAtivo || inPoint == null || outPoint == null || outPoint <= inPoint) return;
    setAGuardarClipe(true); setErro('');
    try {
      const resp = await fetch('/api/cortar-clipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, storagePath: originalAtivo.storagePath, start: inPoint, end: outPoint }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Falha ao cortar');

      const tag = TAGS.find(t => t.id === pendingTag) || TAGS[0];
      const novoClipe = {
        id: uid(), tagId: tag.id, storagePath: json.storagePath, publicUrl: json.publicUrl,
        origemInicio: inPoint, origemFim: outPoint, duracao: outPoint - inPoint,
        note,
        // Os tempos dos desenhos foram marcados relativamente ao vídeo
        // ORIGINAL (0 = início do jogo todo) — o clipe cortado começa
        // sempre em 0, por isso passam a ser relativos ao início do clipe.
        shapes: shapes.map(s => ({
          ...s,
          criadoEmTempo: s.criadoEmTempo == null ? null : Math.max(0, s.criadoEmTempo - inPoint),
          mostrarAte: s.mostrarAte == null ? null : Math.max(0, s.mostrarAte - inPoint),
        })),
        originalTitulo: originalAtivo.titulo, criadoEm: new Date().toISOString(),
      };
      setClipes(prev => [novoClipe, ...(prev || [])]);
      limparMarcas();
    } catch (e) {
      setErro(`Não consegui guardar o clipe: ${e.message || e}`);
    } finally {
      setAGuardarClipe(false);
    }
  };

  const removerClipe = (clip) => {
    const executar = async () => {
      try { await supabase.storage.from('videos-clipes').remove([clip.storagePath]); } catch (e) { /* apaga o registo à mesma */ }
      setClipes(prev => prev.filter(c => c.id !== clip.id));
    };
    if (askConfirm) {
      askConfirm({ title: 'Apagar clipe?', label: 'Este clipe', confirmLabel: 'Apagar', onConfirm: executar });
    } else if (window.confirm('Apagar este clipe?')) {
      executar();
    }
  };

  const copiarLink = (clip) => {
    if (navigator.clipboard) navigator.clipboard.writeText(clip.publicUrl).catch(() => {});
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  /* ---- Telestração ---- */
  const getPoint = (e) => {
    const rect = canvasWrapRef.current.getBoundingClientRect();
    // x vai de 0 a 100, y vai de 0 a 56.25 — tem de bater certo com o
    // viewBox do SVG ali em baixo (que usa esses números para manter a
    // proporção 16:9 sem esticar os desenhos).
    return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 56.25 };
  };
  const abrirDesenho = () => { videoRef.current?.pause(); setModoDesenho(true); };
  const fecharDesenho = () => { setModoDesenho(false); setTextoPendente(null); setEditandoDuracaoIndex(null); };

  // Abre-se ao clicar (sem arrastar) num desenho já existente, para
  // definir ou ajustar até quando fica visível.
  const abrirPopupDuracao = (index) => {
    setEditandoDuracaoIndex(index);
    const atual = shapes[index]?.mostrarAte;
    setDuracaoInputTexto(fmt(atual != null ? atual : current + 3));
  };
  const confirmarDuracaoShape = () => {
    const seg = parseMMSS(duracaoInputTexto);
    if (seg != null && editandoDuracaoIndex != null) {
      setShapes(s => s.map((sh, i) => (i === editandoDuracaoIndex ? { ...sh, mostrarAte: seg } : sh)));
    }
    setEditandoDuracaoIndex(null);
  };
  const marcarSempreVisivelShape = () => {
    if (editandoDuracaoIndex != null) setShapes(s => s.map((sh, i) => (i === editandoDuracaoIndex ? { ...sh, mostrarAte: null } : sh)));
    setEditandoDuracaoIndex(null);
  };
  // Dá para dar play, deixar correr até ao ponto certo, pausar, e usar esse
  // momento exato — em vez de teres de escrever o minuto de cabeça.
  const usarTempoAtualComoLimite = () => setDuracaoInputTexto(fmt(current));

  const confirmarTexto = () => {
    setTextoPendente(t => {
      if (t && t.valor.trim()) {
        setShapes(s => [...s, { tool: 'texto', color: COR_DESENHO, points: [t.pt], texto: t.valor.trim(), criadoEmTempo: current, mostrarAte: null }]);
      }
      return null;
    });
  };

  const startDraw = (e) => {
    if (!modoDesenho) return;
    if (editandoDuracaoIndex != null) setEditandoDuracaoIndex(null); // fecha um popup pendente antes de continuar
    if (textoPendente) { confirmarTexto(); return; }
    videoRef.current?.pause();
    const pt = getPoint(e);
    if (tool === 'apagar') {
      let melhorI = -1, melhorD = 6;
      shapes.forEach((sh, i) => { const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
      if (melhorI >= 0) setShapes(s => s.filter((_, i) => i !== melhorI));
      return;
    }
    if (tool === 'texto') {
      const rect = canvasWrapRef.current.getBoundingClientRect();
      setTextoPendente({ pt, xPix: e.clientX - rect.left, yPix: e.clientY - rect.top, valor: '' });
      return;
    }
    // Antes de desenhar algo novo, vê-se se o toque caiu em cima de um
    // desenho já existente — nesse caso é para mexer nele (arrastando) ou
    // para o selecionar (um toque simples, sem arrastar), em vez de criar
    // um desenho novo por cima. Funciona com qualquer ferramenta ativa.
    let melhorI = -1, melhorD = 6;
    shapes.forEach((sh, i) => { const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
    if (melhorI >= 0) {
      dragState.current = { index: melhorI, inicio: pt, pontosIniciais: shapes[melhorI].points.map(p => ({ ...p })), moveu: false };
      return;
    }
    drawState.current = { tool, color: COR_DESENHO, points: [pt], criadoEmTempo: current, mostrarAte: null };
  };
  const moveDraw = (e) => {
    if (!modoDesenho) return;
    if (dragState.current) {
      const pt = getPoint(e);
      const { index, inicio, pontosIniciais } = dragState.current;
      const dx = pt.x - inicio.x, dy = pt.y - inicio.y;
      if (Math.hypot(dx, dy) > 2.5) dragState.current.moveu = true; // margem maior — um toque real nunca fica 100% parado
      setShapes(s => s.map((sh, i) => (i === index ? { ...sh, points: pontosIniciais.map(p => ({ x: p.x + dx, y: p.y + dy })) } : sh)));
      return;
    }
    if (!drawState.current) return;
    const pt = getPoint(e); const st = drawState.current;
    if (st.tool === 'livre') st.points.push(pt); else st.points[1] = pt;
    setShapes(s => [...s.filter(x => x !== st), { ...st }]);
  };
  const endDraw = () => {
    if (dragState.current) {
      const { index, moveu } = dragState.current;
      dragState.current = null;
      if (!moveu) abrirPopupDuracao(index); // foi um toque simples, sem arrastar — abre o tempo desse desenho
      return;
    }
    const st = drawState.current;
    if (!st) return;
    setShapes(s => [...s.filter(x => x !== st), { ...st }]);
    drawState.current = null;
  };

  const pct = (t) => (duration ? (t / duration) * 100 : 0);
  const shapesVisiveis = modoDesenho ? shapes : shapes.filter(sh => shapeVisivelEm(sh, current));

  const FERRAMENTAS = [['seta', ArrowUpRight, 'Seta'], ['circulo', Circle, 'Círculo'], ['linha', Minus, 'Linha'], ['retangulo', Square, 'Retângulo']];

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files[0]; if (f) iniciarUploadVideo(f); e.target.value = ''; }} />

      {(erro || uploadVideoEstado?.erro) && <div style={{ background: T.surfaceRaise, border: `1px solid ${T.bad}`, borderRadius: 8, padding: 10, marginBottom: 12, color: T.cream, fontSize: 13 }}>{erro || uploadVideoEstado.erro}</div>}

      {/* Vídeos originais carregados (temporários) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        {videosOriginais.map(v => (
          <button key={v.id} onClick={() => { setOriginalAtivoId(v.id); limparMarcas(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', ...body,
              border: `1px solid ${v.id === originalAtivoId ? T.crimsonBright : T.line}`,
              background: v.id === originalAtivoId ? T.surfaceRaise : 'transparent', color: T.cream,
            }}>
            <Film size={12} color={T.muted} /> {v.titulo}
            {v.pronto === false && <Loader2 size={11} className="spin" color={T.warn} title="A preparar…" />}
            <X size={12} color={T.bad} onClick={(e) => { e.stopPropagation(); apagarOriginal(v); }} />
          </button>
        ))}
        <Btn variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadVideoEstado?.ativo}>
          {uploadVideoEstado?.ativo ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {uploadVideoEstado?.ativo ? (uploadVideoEstado.finalizando ? 'A finalizar no servidor…' : `A carregar… ${uploadVideoEstado.progresso}%`) : 'Carregar vídeo'}
        </Btn>
      </div>

      {uploadVideoEstado?.ativo && (
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: -10, marginBottom: 14 }}>
          Podes navegar para outro separador — o carregamento continua em segundo plano.
        </div>
      )}

      {!originalAtivo && (
        <div style={{ color: T.mutedDim, fontSize: 13, padding: '30px 0', textAlign: 'center' }}>
          Carrega o vídeo de um jogo ou treino para começares a marcar clipes.
        </div>
      )}

      {originalAtivo && (
        <div ref={containerRef} style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.line}`, overflow: 'hidden', ...(fullscreen ? { display: 'flex', flexDirection: 'column', height: '100vh' } : {}) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${T.line}`, background: modoDesenho ? T.surfaceRaise : 'transparent' }}>
            <span style={{ fontSize: 12.5, color: T.muted, ...mono }}>{modoDesenho ? 'Modo de desenho — vídeo em pausa' : ''}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={alternarEcraInteiro} style={{ padding: 8 }} title="Ecrã inteiro">
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </Btn>
              {modoDesenho && <Btn variant="solid" onClick={fecharDesenho}><Check size={14} /> Concluído</Btn>}
            </div>
          </div>

          <div style={{ display: 'flex', flex: fullscreen ? 1 : undefined, minHeight: 0 }}>
            {modoDesenho && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRight: `1px solid ${T.line}`, overflowY: 'auto' }}>
                {FERRAMENTAS.map(([id, Icon, titulo]) => (
                  <Btn key={id} variant="ghost" active={tool === id} onClick={() => setTool(id)} style={{ padding: 10 }} title={titulo}><Icon size={18} /></Btn>
                ))}
                <Btn variant="ghost" active={tool === 'livre'} onClick={() => setTool('livre')} style={{ padding: 10, fontSize: 11 }} title="Traço livre">Livre</Btn>
                <Btn variant="ghost" active={tool === 'texto'} onClick={() => setTool('texto')} style={{ padding: 10 }} title="Texto"><Type size={18} /></Btn>
                <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
                <Btn variant="ghost" active={tool === 'apagar'} onClick={() => setTool('apagar')} style={{ padding: 10 }} title="Apagar um desenho (clica nele)"><Eraser size={18} /></Btn>
                <Btn variant="plain" onClick={() => setShapes([])} style={{ padding: 10 }} title="Apagar tudo"><Trash2 size={18} /></Btn>
              </div>
            )}
            <div ref={canvasWrapRef} style={{ position: 'relative', background: '#000', aspectRatio: fullscreen ? undefined : '16/9', flex: fullscreen ? 1 : undefined, width: '100%', touchAction: modoDesenho ? 'none' : 'auto' }}
              onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerLeave={endDraw} onPointerCancel={endDraw}>
              {originalAtivo?.pronto === false ? (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: T.muted, gap: 8, textAlign: 'center', padding: 20 }}>
                  <Loader2 size={20} className="spin" />
                  <span style={{ fontSize: 12.5, ...body }}>
                    A preparar este vídeo para arrancar depressa (só acontece uma vez) — pode demorar alguns minutos, dependendo do tamanho.
                  </span>
                </div>
              ) : signedUrl ? (
                <>
                  <video ref={videoRef} src={signedUrl} style={{ width: '100%', height: '100%', display: 'block', objectFit: fullscreen ? 'contain' : 'fill' }} playsInline
                    onLoadStart={() => setVideoPronto(false)} onCanPlay={() => setVideoPronto(true)} />
                  {!videoPronto && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.muted, pointerEvents: 'none' }}>
                      <Loader2 size={20} className="spin" />
                      <span style={{ fontSize: 12, ...body }}>A carregar o vídeo…</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: T.muted }}><Loader2 size={20} className="spin" /></div>
              )}
              <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: modoDesenho ? 'auto' : 'none', cursor: modoDesenho ? (tool === 'apagar' ? 'not-allowed' : 'crosshair') : 'default' }}>
                {shapesVisiveis.map(renderShape)}
              </svg>
              {textoPendente && (
                <div onPointerDown={e => e.stopPropagation()}
                  style={{ position: 'absolute', left: textoPendente.xPix, top: textoPendente.yPix, transform: 'translate(-4px,-50%)', display: 'flex', gap: 4, zIndex: 5 }}>
                  <input
                    autoFocus
                    value={textoPendente.valor}
                    onChange={e => setTextoPendente(t => ({ ...t, valor: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') confirmarTexto(); if (e.key === 'Escape') setTextoPendente(null); }}
                    placeholder="Escreve o texto…"
                    style={{
                      background: 'rgba(0,0,0,0.85)', color: '#fff',
                      border: `1px solid ${COR_DESENHO}`, borderRadius: 4, padding: '3px 7px', fontSize: 14,
                      minWidth: 100, outline: 'none', ...body,
                    }}
                  />
                  <Btn variant="solid" onClick={confirmarTexto} style={{ padding: '4px 8px', fontSize: 12 }}>OK</Btn>
                </div>
              )}
              {editandoDuracaoIndex != null && (
                <div onPointerDown={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.88)', border: `1px solid ${COR_DESENHO}`, borderRadius: 8,
                    padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, zIndex: 6, flexWrap: 'wrap', justifyContent: 'center',
                  }}>
                  <span style={{ fontSize: 12, color: '#fff', ...body }}>Visível até ao minuto:</span>
                  <Btn variant="ghost" onClick={usarTempoAtualComoLimite} style={{ padding: '5px 8px', fontSize: 12 }} title="Dá play, pausa no momento certo, e usa esse ponto">
                    {playing ? <Pause size={13} /> : <Play size={13} />} Usar este momento
                  </Btn>
                  <input
                    autoFocus
                    value={duracaoInputTexto}
                    onChange={e => setDuracaoInputTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmarDuracaoShape(); }}
                    placeholder="mm:ss"
                    style={{ width: 62, background: '#111', color: '#fff', border: `1px solid ${T.line}`, borderRadius: 4, padding: '3px 6px', fontSize: 13, textAlign: 'center', ...mono }}
                  />
                  <Btn variant="solid" onClick={confirmarDuracaoShape} style={{ padding: '5px 10px', fontSize: 12 }}>OK</Btn>
                  <Btn variant="ghost" onClick={marcarSempreVisivelShape} style={{ padding: '5px 10px', fontSize: 12 }}>Sempre visível</Btn>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '10px 14px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Btn variant="ghost" onClick={togglePlay} style={{ padding: 8 }}>{playing ? <Pause size={16} /> : <Play size={16} />}</Btn>
            <span style={{ fontSize: 12, color: T.muted, ...mono, minWidth: 44 }}>{fmt(current)}</span>
            <div onClick={onScrubClick} style={{ flex: 1, height: 22, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: T.line, borderRadius: 3 }} />
              <div style={{ position: 'absolute', left: 0, width: `${pct(current)}%`, height: 6, background: T.crimson, borderRadius: 3 }} />
              {inPoint != null && <div style={{ position: 'absolute', left: `${pct(inPoint)}%`, top: -4, width: 2, height: 14, background: T.good }} />}
              {outPoint != null && <div style={{ position: 'absolute', left: `${pct(outPoint)}%`, top: -4, width: 2, height: 14, background: T.bad }} />}
            </div>
            <span style={{ fontSize: 12, color: T.mutedDim, ...mono, minWidth: 44 }}>{fmt(duration)}</span>
          </div>

          {!modoDesenho && (
            <>
              <div style={{ padding: '8px 14px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: `1px solid ${T.line}` }}>
                <Btn variant="ghost" onClick={markIn}><Flag size={14} color={T.good} /> Marcar início ({fmt(inPoint ?? 0)})</Btn>
                <Btn variant="ghost" onClick={markOut}><Flag size={14} color={T.bad} /> Marcar fim ({fmt(outPoint ?? 0)})</Btn>
                <Btn variant="ghost" onClick={limparMarcas} disabled={inPoint == null && outPoint == null}><RotateCcw size={14} /> Limpar</Btn>
                <div style={{ width: 1, background: T.line, margin: '0 4px' }} />
                <Btn variant="ghost" onClick={abrirDesenho}><Scissors size={14} /> Desenhar {shapes.length > 0 && `(${shapes.length})`}</Btn>
              </div>

              <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TAGS.map(tag => (
                  <button key={tag.id} onClick={() => setPendingTag(tag.id)}
                    style={{
                      padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', ...body,
                      border: `1px solid ${tag.color}`, background: pendingTag === tag.id ? tag.color : 'transparent',
                      color: pendingTag === tag.id ? TEXT_ON_ACCENT : tag.color,
                    }}>
                    {tag.label}
                  </button>
                ))}
              </div>

              {inPoint != null && outPoint != null && outPoint > inPoint && (
                <div style={{ margin: '0 14px 16px', background: T.surfaceRaise, borderRadius: 10, padding: 12, border: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 8, ...mono }}>
                    Novo clipe · {fmt(inPoint)} – {fmt(outPoint)} ({Math.round(outPoint - inPoint)}s) {shapes.length > 0 && `· ${shapes.length} desenho(s)`}
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota…"
                    style={{ width: '100%', minHeight: 54, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 7, color: T.cream, padding: 8, fontSize: 13, resize: 'vertical', ...body }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Btn variant="solid" onClick={guardarClipe} disabled={aGuardarClipe}>
                      {aGuardarClipe ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {aGuardarClipe ? 'A cortar…' : 'Guardar clipe'}
                    </Btn>
                    <Btn variant="plain" onClick={limparMarcas} disabled={aGuardarClipe}><X size={14} /> Descartar</Btn>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Biblioteca de clipes — permanente, independente do vídeo original */}
      <div style={{ marginTop: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Tag size={16} color={T.gold} />
          <h2 style={{ fontSize: 15, margin: 0, ...display, fontWeight: 600 }}>Clipes ({clipes.length})</h2>
        </div>
        {clipes.length === 0 && <div style={{ color: T.mutedDim, fontSize: 13, padding: '18px 0' }}>Ainda não há clipes guardados.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clipes.map(clip => {
            const tag = TAGS.find(t => t.id === clip.tagId);
            return (
              <div key={clip.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag?.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: tag?.color, minWidth: 88, ...body }}>{tag?.label}</span>
                <span style={{ fontSize: 12.5, color: T.muted, ...mono }}>{Math.round(clip.duracao)}s</span>
                <span style={{ fontSize: 11.5, color: T.mutedDim }}>{clip.originalTitulo}</span>
                {clip.note && <span style={{ fontSize: 12.5, color: T.cream, flex: '1 1 200px' }}>{clip.note}</span>}
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <Btn variant="ghost" onClick={() => setClipeAReproduzir(clip)} style={{ padding: '6px 10px' }}><Play size={12} /></Btn>
                  <Btn variant="ghost" onClick={() => copiarLink(clip)} style={{ padding: '6px 10px' }}>
                    {copiedId === clip.id ? <Check size={12} color={T.good} /> : <Link2 size={12} />}
                  </Btn>
                  <Btn variant="plain" onClick={() => removerClipe(clip)} style={{ padding: '6px 10px' }}><Trash2 size={12} color={T.bad} /></Btn>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {clipeAReproduzir && (
        <ClipPlayerModal clip={clipeAReproduzir} tag={TAGS.find(t => t.id === clipeAReproduzir.tagId)} onClose={() => setClipeAReproduzir(null)} />
      )}
    </div>
  );
}
