import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Play, Pause, Scissors, Circle, ArrowUpRight, Minus, Eraser, Trash2,
  Copy, Check, Video, Upload, Tag, X, Flag, RotateCcw, Loader2, Film,
  Maximize2, Minimize2, Square, Type, Pencil, Lasso, Waypoints, Undo2, Redo2, ArrowLeft, Eye, User, Share2,
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

// Cursor da borracha — uma borracha a sério, em vez do símbolo de
// "proibido" que o browser mostra por omissão.
const CURSOR_BORRACHA = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><g transform='rotate(-35 13 13)'><rect x='5' y='8' width='16' height='10' rx='2.2' fill='white' stroke='%23222222' stroke-width='1.4'/><rect x='5' y='8' width='16' height='4.4' rx='2.2' fill='%23e84c62'/></g></svg>\") 6 20, auto";
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

// Cores à escolha para os desenhos — útil para distinguir, por exemplo,
// os movimentos da nossa equipa (branco) dos do adversário (vermelho).
const PALETA_DESENHO = [
  { id: 'branco', cor: '#FFFFFF' },
  { id: 'vermelho', cor: T.crimsonBright },
  { id: 'amarelo', cor: T.gold },
  { id: 'azul', cor: T.teamB },
  { id: 'verde', cor: T.good },
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

// Botão de ferramenta de desenho — ícone + etiqueta sempre visível (não
// só tooltip, que não aparece ao toque) e área de toque generosa.
function ToolBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        width: '100%', minHeight: 42, padding: '6px 3px', borderRadius: 8, cursor: 'pointer', ...body,
        border: `1px solid ${active ? T.crimsonBright : T.line}`,
        background: active ? T.surfaceRaise : 'transparent', color: active ? T.cream : T.muted,
      }}>
      <Icon size={16} />
      <span style={{ fontSize: 9, lineHeight: 1, whiteSpace: 'nowrap' }}>{label}</span>
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
// Roda um ponto à volta de um centro, em graus — usado para a Zona
// rotativa: tanto para desenhar como para saber se um toque lhe acertou.
function girar(p, centro, graus) {
  if (!graus) return p;
  const rad = (graus * Math.PI) / 180;
  const dx = p.x - centro.x, dy = p.y - centro.y;
  return {
    x: centro.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: centro.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
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
    // Roda o ponto tocado para o referencial "sem rotação" da zona, antes
    // de comparar com o retângulo — assim continua a acertar-se numa zona
    // que já foi rodada.
    const centro = { x: x + w / 2, y: y + h / 2 };
    const pLocal = sh.rotacao ? girar(p, centro, -sh.rotacao) : p;
    if (pLocal.x >= x && pLocal.x <= x + w && pLocal.y >= y && pLocal.y <= y + h) return 0; // dentro da zona conta sempre como acerto
    const c = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    return Math.min(distPontoSegmento(pLocal, c[0], c[1]), distPontoSegmento(pLocal, c[1], c[2]), distPontoSegmento(pLocal, c[2], c[3]), distPontoSegmento(pLocal, c[3], c[0]));
  }
  if (sh.tool === 'livre' || sh.tool === 'zonalivre' || sh.tool === 'linhaPontos') {
    let min = Infinity;
    for (let k = 0; k < pts.length - 1; k++) min = Math.min(min, distPontoSegmento(p, pts[k], pts[k + 1]));
    if (sh.tool === 'zonalivre' && pts.length > 2) min = Math.min(min, distPontoSegmento(p, pts[pts.length - 1], pts[0])); // o traço fecha, junta o último ponto ao primeiro
    return min;
  }
  if (b) return distPontoSegmento(p, a, b);
  return Infinity;
}

/* Desenha uma forma no SVG — usado tanto no editor como na reprodução do
   clipe já guardado (por isso vive fora do componente principal). */
const ESPESSURA = 0.35; // mais fino do que antes (era 0.6), em todas as formas
const RAIO_TOQUE = 1.5; // distância máxima (era 6, depois 3) para um toque "acertar" num desenho já feito — mais exato ainda, tem de se tocar mesmo em cima

function renderShape(sh, i) {
  if (!sh || !sh.points || sh.points.length === 0) return null;
  const [a, b] = sh.points;
  if (!a) return null;
  const cor = { stroke: sh.color || COR_DESENHO, fill: 'none' };
  if (sh.tool === 'texto') {
    return <text key={i} x={a.x} y={a.y} fill={sh.color || COR_DESENHO} fontSize={3.4} fontWeight={700} style={{ fontFamily: "'Inter', sans-serif", paintOrder: 'stroke', stroke: '#00000099', strokeWidth: 0.5 }}>{sh.texto}</text>;
  }
  if (sh.tool === 'livre' || sh.tool === 'zonalivre' || sh.tool === 'linhaPontos') {
    const fechado = sh.tool === 'zonalivre';
    const d = sh.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (fechado ? ' Z' : '');
    return (
      <g key={i}>
        <path d={d}
          stroke={sh.color || COR_DESENHO} fill={fechado ? (sh.color || COR_DESENHO) : 'none'} fillOpacity={fechado ? 0.22 : undefined}
          strokeWidth={ESPESSURA} strokeLinecap="round" strokeLinejoin="round" />
        {/* "Ligar pontos" mostra sempre os vértices, para se ver onde estão os pontos ligados */}
        {sh.tool === 'linhaPontos' && sh.points.map((p, pi) => (
          <circle key={pi} cx={p.x} cy={p.y} r={0.4} fill={sh.color || COR_DESENHO} />
        ))}
      </g>
    );
  }
  if (!b) return null;
  if (sh.tool === 'circulo') return <circle key={i} cx={a.x} cy={a.y} r={Math.hypot(b.x - a.x, b.y - a.y)} style={cor} strokeWidth={ESPESSURA} />;
  if (sh.tool === 'linha') return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={cor} strokeWidth={ESPESSURA} />;
  if (sh.tool === 'retangulo') {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    const corZona = sh.color || COR_DESENHO;
    const idPadrao = `hachura-${sh.id || i}`;
    const cx = x + w / 2, cy = y + h / 2;
    return (
      <g key={i}>
        <defs>
          <pattern id={idPadrao} patternUnits="userSpaceOnUse" width={2.2} height={2.2} patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={2.2} stroke={corZona} strokeWidth={0.35} />
          </pattern>
        </defs>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${idPadrao})`} fillOpacity={0.6}
          stroke={sh.semContorno ? 'none' : corZona} strokeWidth={sh.semContorno ? 0 : ESPESSURA}
          transform={sh.rotacao ? `rotate(${sh.rotacao} ${cx} ${cy})` : undefined} />
      </g>
    );
  }
  if (sh.tool === 'cone') {
    // Cone de visão — sai de `a` (o jogador) em direção a `b`, alargando
    // à medida que se afasta, como o campo de visão dele.
    const corCone = sh.color || COR_DESENHO;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const angBase = Math.atan2(b.y - a.y, b.x - a.x);
    const meioAngulo = 0.5; // ~29° para cada lado — largura do cone
    const p1 = { x: a.x + dist * Math.cos(angBase - meioAngulo), y: a.y + dist * Math.sin(angBase - meioAngulo) };
    const p2 = { x: a.x + dist * Math.cos(angBase + meioAngulo), y: a.y + dist * Math.sin(angBase + meioAngulo) };
    return <path key={i} d={`M ${a.x} ${a.y} L ${p1.x} ${p1.y} A ${dist} ${dist} 0 0 1 ${p2.x} ${p2.y} Z`}
      fill={corCone} fillOpacity={0.3} stroke={corCone} strokeWidth={ESPESSURA} strokeLinejoin="round" />;
  }
  const angle = Math.atan2(b.y - a.y, b.x - a.x); const ah = 1.7;
  const p1 = { x: b.x - ah * Math.cos(angle - 0.4), y: b.y - ah * Math.sin(angle - 0.4) };
  const p2 = { x: b.x - ah * Math.cos(angle + 0.4), y: b.y - ah * Math.sin(angle + 0.4) };
  return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={cor} strokeWidth={ESPESSURA} />
    <path d={`M ${b.x} ${b.y} L ${p1.x} ${p1.y} M ${b.x} ${b.y} L ${p2.x} ${p2.y}`} style={cor} strokeWidth={ESPESSURA} strokeLinecap="round" /></g>;
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
/* JANELA INTEIRA DOS LEITORES DE CLIPES — o vídeo ocupa o maior
   retângulo que cabe na área disponível, mantendo a proporção. Os
   desenhos (SVG por cima) têm de ficar exatamente sobre o vídeo, por isso
   a caixa é medida em vez de deixar o vídeo encolher dentro dela. */
function useCaixaNaArea(proporcao) {
  const areaRef = useRef(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.width, r.height * proporcao));
      setTam({ w, h: w / proporcao });
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (ro) ro.observe(el); else window.addEventListener('resize', medir);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', medir); };
  }, [proporcao]);
  return [areaRef, tam];
}

// Esc fecha o leitor (em janela inteira já não há fundo onde clicar).
function useFecharComEsc(onClose, ativo = true) {
  useEffect(() => {
    if (!ativo) return undefined;
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose, ativo]);
}

function ClipPlayerModal({ clip, tag, onClose, onShare, onRemove, copied, onChangeTag, onSaveEdit, originais, originalSugeridoId }) {
  const [t, setT] = useState(0);
  // EDITAR — texto e tempos (em mm:ss, relativos ao vídeo original).
  const [aEditar, setAEditar] = useState(false);
  const [notaEd, setNotaEd] = useState('');
  const [inicioEd, setInicioEd] = useState('');
  const [fimEd, setFimEd] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [erroEd, setErroEd] = useState('');
  const [originalEd, setOriginalEd] = useState(null);
  const abrirEdicao = () => {
    setOriginalEd(originalSugeridoId || null);
    setNotaEd(clip.note || '');
    setInicioEd(fmt(clip.origemInicio || 0));
    setFimEd(fmt(clip.origemFim || 0));
    setErroEd('');
    setAEditar(true);
  };
  const guardarEdicao = async () => {
    const ini = parseMMSS(inicioEd);
    const f = parseMMSS(fimEd);
    if (ini == null || f == null) { setErroEd('Escreve os tempos como mm:ss (ex.: 12:05).'); return; }
    if (f - ini < 1) { setErroEd('O fim tem de ser pelo menos 1 segundo depois do início.'); return; }
    setAGuardar(true); setErroEd('');
    try {
      await onSaveEdit({ note: notaEd.trim(), inicio: ini, fim: f, originalId: originalEd });
      setAEditar(false);
    } catch (e) {
      setErroEd((e && e.message) || 'Não foi possível guardar. Tenta outra vez.');
    } finally {
      setAGuardar(false);
    }
  };
  const videoRef = useRef(null);
  const [aTocar, setATocar] = useState(false);
  const [duracaoVideo, setDuracaoVideo] = useState(0);
  const alternar = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause();
  };
  const irPara = (seg) => { const v = videoRef.current; if (v) { v.currentTime = seg; setT(seg); } };
  const lerDuracao = (e) => { const d = e.currentTarget.duration; setDuracaoVideo(Number.isFinite(d) ? d : 0); };
  // Proporção real do vídeo (16:9 até se saber) — a caixa segue-a.
  const [proporcao, setProporcao] = useState(16 / 9);
  const [areaRef, caixa] = useCaixaNaArea(proporcao);
  useFecharComEsc(onClose, !aEditar);
  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', borderBottom: `1px solid ${T.line}`, background: T.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: T.muted, ...body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tag?.label || 'Sem etiqueta'} · {Math.round(clip.duracao)}s{clip.originalTitulo ? ` · ${clip.originalTitulo}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" onClick={onShare} style={{ padding: '6px 10px' }} title="Partilhar o clipe">
              {copied ? <Check size={14} color={T.good} /> : <Share2 size={14} />}
            </Btn>
            <Btn variant="ghost" onClick={aEditar ? () => setAEditar(false) : abrirEdicao} active={aEditar} style={{ padding: '6px 10px' }} title="Editar texto e tempos">
              <Pencil size={14} />
            </Btn>
            <Btn variant="ghost" onClick={onRemove} style={{ padding: '6px 10px' }} title="Apagar clipe"><Trash2 size={14} color={T.bad} /></Btn>
            <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
          </div>
        </div>
        <div ref={areaRef} style={{ flex: 1, minHeight: '25vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: caixa.w || '100%', height: caixa.h || 'auto' }}>
            <video ref={videoRef} src={clip.publicUrl} autoPlay playsInline onClick={alternar}
              onPlay={() => setATocar(true)} onPause={() => setATocar(false)}
              onLoadedMetadata={e => {
                lerDuracao(e);
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) setProporcao(v.videoWidth / v.videoHeight);
              }}
              onDurationChange={lerDuracao}
              onTimeUpdate={e => setT(e.currentTarget.currentTime)}
              style={{ width: '100%', height: '100%', display: 'block', background: '#000', cursor: 'pointer' }} />
            <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {(clip.shapes || []).filter(sh => shapeVisivelEm(sh, t)).map(renderShape)}
            </svg>
          </div>
        </div>
        {/* A mesma barra amarela de todos os vídeos da app. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <button onClick={alternar} title={aTocar ? 'Pausa' : 'Reproduzir'}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex' }}>
            {aTocar ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={() => irPara(0)} title="Voltar ao início"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <RotateCcw size={15} />
          </button>
          <input type="range" min={0} max={duracaoVideo || 0} step={0.1} value={Math.min(t, duracaoVideo || 0)}
            onChange={e => irPara(Number(e.target.value))} disabled={!duracaoVideo}
            aria-label="Posição no clipe"
            style={{ flex: 1, minWidth: 0, accentColor: T.gold, cursor: 'pointer' }} />
          <span style={{ fontSize: 12, color: '#fff', ...mono, flexShrink: 0 }}>{mmss(t)} / {mmss(duracaoVideo)}</span>
        </div>
        {/* Texto, edição e etiquetas — por baixo do vídeo, com a sua
            própria rolagem para nunca empurrar o vídeo para fora do ecrã. */}
        <div style={{ flexShrink: 0, maxHeight: '60vh', overflowY: 'auto', background: T.surface, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {aEditar ? (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: `1px solid ${T.line}`, ...body }}>
            <textarea value={notaEd} onChange={e => setNotaEd(e.target.value)} rows={2} maxLength={2000}
              placeholder="Texto do clipe (ex.: Abrir espaços)"
              style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '7px 10px', color: T.cream, fontSize: 13, resize: 'vertical', ...body }} />
            {/* Tempos, vídeo original e botões numa só linha (parte-se em
                ecrãs estreitos) — a edição tem de caber sem tapar o vídeo. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: T.mutedDim }}>De</span>
              <input value={inicioEd} onChange={e => setInicioEd(e.target.value)} disabled={!originalEd} aria-label="Início no vídeo original (mm:ss)"
                style={{ width: 64, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 8px', color: T.cream, fontSize: 13, textAlign: 'center', ...mono, opacity: originalEd ? 1 : 0.5 }} />
              <span style={{ fontSize: 12, color: T.mutedDim }}>até</span>
              <input value={fimEd} onChange={e => setFimEd(e.target.value)} disabled={!originalEd} aria-label="Fim no vídeo original (mm:ss)"
                style={{ width: 64, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 8px', color: T.cream, fontSize: 13, textAlign: 'center', ...mono, opacity: originalEd ? 1 : 0.5 }} />
              <span style={{ fontSize: 12, color: T.mutedDim }}>em</span>
              <select value={originalEd || ''} onChange={e => setOriginalEd(e.target.value || null)} aria-label="Vídeo original"
                style={{ maxWidth: 240, minWidth: 0, background: T.bg, border: `1px solid ${originalEd ? T.line : T.warn}`, borderRadius: 8, padding: '6px 8px', color: T.cream, fontSize: 12.5, ...body }}>
                <option value="">Escolhe o vídeo original…</option>
                {(originais || []).map(v => <option key={v.id} value={v.id}>{v.titulo || '(sem nome)'}</option>)}
              </select>
              <span style={{ flex: 1 }} />
              <Btn variant="ghost" onClick={() => setAEditar(false)} disabled={aGuardar}>Cancelar</Btn>
              <Btn variant="solid" onClick={guardarEdicao} disabled={aGuardar}>
                {aGuardar ? <><Loader2 size={14} className="spin" /> A guardar…</> : <><Check size={14} /> Guardar alterações</>}
              </Btn>
            </div>
            {erroEd
              ? <div style={{ fontSize: 12.5, color: T.bad }}>{erroEd}</div>
              : (
                <div style={{ fontSize: 11.5, color: T.mutedDim }}>
                  {originalEd
                    ? 'Mudar os tempos volta a cortar o vídeo original (uns segundos); os desenhos acompanham.'
                    : 'Não encontrei o vídeo original deste clipe. Escolhe-o na lista para mudar os tempos; sem isso, só muda o texto.'}
                </div>
              )}
          </div>
        ) : (
          clip.note && <div style={{ padding: '12px 12px 0', fontSize: 13, color: T.cream }}>{clip.note}</div>
        )}
        {/* Etiqueta — pode-se atribuir ou mudar aqui, mesmo depois de o
           clipe já estar guardado sem nenhuma. */}
        <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TAGS.map(tg => (
            <button key={tg.id} onClick={() => onChangeTag(tg.id)}
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', ...body,
                border: `1px solid ${tg.color}`, background: clip.tagId === tg.id ? tg.color : 'transparent',
                color: clip.tagId === tg.id ? TEXT_ON_ACCENT : tg.color,
              }}>
              {tg.label}
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}

/* CLIPES DOS ATLETAS — criados no Portal do Atleta (Biblioteca), sobre
   vídeos de jogos do YouTube. Não são ficheiros cortados: guardam só
   `youtubeId` + `clipInicio`/`clipFim`, com `origem: 'atleta'`, o
   jogador que o criou (`atletaId`/`atletaNome`), o título e o texto
   livre dele (`note`). Vivem na mesma tabela `video_clips`, mas não
   entram na lista de clipes do staff: têm o separador próprio
   "Análise individual em clipes", com um cartão por jogador. */
const ehClipeAtleta = (c) => !!c && c.origem === 'atleta';

function mmss(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function dataCurta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* LEITOR DO CLIPE DE ATLETA — preso ao intervalo do corte.

   Sem controlos nativos do YouTube (controls=0, disablekb=1): a barra
   nativa mostrava e deixava percorrer o jogo inteiro. A nossa barra vai
   só do início ao fim do corte e, ao chegar ao fim, volta ao início
   (o mesmo comportamento dos cortes do Canal). O tempo chega por
   postMessage (enablejsapi=1), o mesmo mecanismo usado no App. */
/* ENDEREÇO PÚBLICO DA APP — base de todos os links partilhados (tem de
   ser igual a URL_PUBLICA_APP no App.jsx). Fixo de propósito: partilhar a
   partir de um endereço de pré-visualização do Vercel, ou do computador
   em desenvolvimento, dava links que não abrem para quem os recebe. */
const URL_PUBLICA_APP = 'https://misterjp.vercel.app/';

/* PARTILHAR — o sistema (telemóvel) ou, sem ele, copiar para a área de
   transferência. Devolve 'copiado' quando copiou, para o botão mostrar o ✓. */
async function partilharLink({ titulo, texto, url }) {
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: texto, url }); } catch (e) { /* cancelado */ }
    return 'partilhado';
  }
  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(texto ? `${texto}\n${url}` : url); return 'copiado'; } catch (e) { /* abre */ }
  }
  window.open(url, '_blank');
  return 'aberto';
}

// Clipe de atleta: a página própria da app (?corte=, ver `PaginaCorte`
// no App), que mostra só o intervalo. Um link do YouTube abriria o jogo
// inteiro na app do YouTube do telemóvel. A mensagem é o título do clipe.
function partilharClipeAtleta(clip) {
  const titulo = clip.titulo || 'Clipe';
  const q = new URLSearchParams({
    corte: clip.youtubeId,
    i: String(Math.floor(Number(clip.clipInicio) || 0)),
    f: String(Math.ceil(Number(clip.clipFim) || 0)),
    t: titulo,
  });
  return partilharLink({ titulo, texto: titulo, url: `${URL_PUBLICA_APP}?${q.toString()}` });
}

// Clipe cortado aqui (ficheiro): link curto para a página da app
// (?clipe=<id>, ver `PaginaClipe` no App), que vai buscar o ficheiro pela
// função `clipe_publico`. O endereço do ficheiro no Supabase era enorme.
// Como o id do clipe não muda ao editar, o link continua a funcionar.
// A mensagem é o texto do clipe (ou a etiqueta, se não tiver texto) e,
// por baixo, o nome dado ao vídeo quando foi carregado.
function partilharClipeFicheiro(clip) {
  const tag = TAGS.find(t => t.id === clip.tagId);
  const titulo = (clip.note || '').trim() || (tag ? tag.label : 'Clipe');
  const texto = [titulo, (clip.originalTitulo || '').trim()].filter(Boolean).join('\n');
  return partilharLink({ titulo, texto, url: `${URL_PUBLICA_APP}?clipe=${encodeURIComponent(clip.id)}` });
}

function ClipAtletaModal({ clip, onClose, onRemove }) {
  const iframeRef = useRef(null);
  const inicio = Math.max(0, Number(clip.clipInicio) || 0);
  const fim = Math.max(inicio + 1, Number(clip.clipFim) || 0);
  const [tempo, setTempo] = useState(inicio);
  const [aTocar, setATocar] = useState(false);
  const saltoRef = useRef(0); // evita pedir vários saltos seguidos enquanto o primeiro não chega
  const [copiado, setCopiado] = useState(false);

  const partilhar = async () => {
    const r = await partilharClipeAtleta(clip);
    if (r === 'copiado') { setCopiado(true); setTimeout(() => setCopiado(false), 1600); }
  };

  const comando = (func, args) => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  };
  const irPara = (seg) => { saltoRef.current = Date.now(); comando('seekTo', [seg, true]); setTempo(seg); };

  useEffect(() => {
    const onMessage = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return;
      const win = iframeRef.current && iframeRef.current.contentWindow;
      if (win && event.source !== win) return;
      let data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data) return;
      if (data.event === 'onStateChange' && typeof data.info === 'number') setATocar(data.info === 1 || data.info === 3);
      if (data.event === 'infoDelivery' && data.info) {
        if (typeof data.info.playerState === 'number') setATocar(data.info.playerState === 1 || data.info.playerState === 3);
        const t = data.info.currentTime;
        if (typeof t === 'number') {
          const aSaltar = Date.now() - saltoRef.current < 800;
          if (!aSaltar && (t >= fim - 0.15 || t < inicio - 0.5)) irPara(inicio);
          else setTempo(Math.min(fim, Math.max(inicio, t)));
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, inicio, fim]);

  const aoCarregar = () => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  };

  const src = `https://www.youtube.com/embed/${clip.youtubeId}?start=${Math.floor(inicio)}&autoplay=1&rel=0&playsinline=1&controls=0&disablekb=1&enablejsapi=1&fs=0`;
  const duracao = fim - inicio;
  const [areaRef, caixa] = useCaixaNaArea(16 / 9);
  useFecharComEsc(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', borderBottom: `1px solid ${T.line}`, background: T.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: T.muted, ...body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clip.atletaNome || 'Atleta'} · {mmss(inicio)}–{mmss(fim)} ({Math.round(duracao)}s)
          </span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Btn variant="ghost" onClick={partilhar} style={{ padding: '6px 10px' }} title="Partilhar só o corte">
              {copiado ? <Check size={14} color={T.good} /> : <Share2 size={14} />}
            </Btn>
            <Btn variant="ghost" onClick={onRemove} style={{ padding: '6px 10px' }} title="Apagar clipe"><Trash2 size={14} color={T.bad} /></Btn>
            <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
          </div>
        </div>
        <div ref={areaRef} style={{ flex: 1, minHeight: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: caixa.w || '100%', height: caixa.h || 'auto', aspectRatio: caixa.w ? undefined : '16/9' }}>
            <iframe
              ref={iframeRef} onLoad={aoCarregar}
              src={src} title={clip.titulo || 'Clipe'}
              allow="autoplay; encrypted-media; picture-in-picture"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
        </div>
        {/* BARRA DO CLIPE — só o intervalo do corte. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <button onClick={() => comando(aTocar ? 'pauseVideo' : 'playVideo')} title={aTocar ? 'Pausa' : 'Reproduzir'}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex' }}>
            {aTocar ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={() => irPara(inicio)} title="Voltar ao início do clipe"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <RotateCcw size={15} />
          </button>
          <input type="range" min={0} max={duracao} step={0.1} value={Math.max(0, tempo - inicio)}
            onChange={e => irPara(inicio + Number(e.target.value))}
            aria-label="Posição no clipe"
            style={{ flex: 1, accentColor: T.gold }} />
          <span style={{ fontSize: 12, color: '#fff', ...mono, flexShrink: 0 }}>{mmss(tempo - inicio)} / {mmss(duracao)}</span>
        </div>
        <div style={{ padding: 14, paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, maxHeight: '40vh', overflowY: 'auto', background: T.surface }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.cream, ...body }}>{clip.titulo || '(sem título)'}</div>
          {clip.originalTitulo && <div style={{ fontSize: 12, color: T.mutedDim, ...body }}>{clip.originalTitulo}</div>}
          {clip.note
            ? <div style={{ fontSize: 13, color: T.cream, whiteSpace: 'pre-wrap', lineHeight: 1.5, ...body }}>{clip.note}</div>
            : <div style={{ fontSize: 12.5, color: T.mutedDim, fontStyle: 'italic', ...body }}>O jogador não escreveu nada sobre este clipe.</div>}
        </div>
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
  const [ficheiroPendente, setFicheiroPendente] = useState(null); // ficheiro escolhido, à espera do nome antes de começar o envio
  const [editandoNomeId, setEditandoNomeId] = useState(null); // id do vídeo cujo nome está a ser editado agora
  const [nomeEditado, setNomeEditado] = useState('');
  const [nomeVideoInput, setNomeVideoInput] = useState('');

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
  const [corAtual, setCorAtual] = useState(COR_DESENHO);
  const [shapes, setShapes] = useState([]);
  const [historico, setHistorico] = useState([]); // pilha para o "Retroceder" — cada entrada é um estado anterior de shapes
  const [futuro, setFuturo] = useState([]); // pilha para o "Avançar" — os estados que se desfizeram com o Retroceder
  const [pontosEmCurso, setPontosEmCurso] = useState(null); // { tool, points } — a construir a "Zona livre" ou "Ligar pontos" por toques
  const [textoPendente, setTextoPendente] = useState(null);
  const [editandoDuracaoIndex, setEditandoDuracaoIndex] = useState(null);
  const [duracaoInputTexto, setDuracaoInputTexto] = useState('');
  const drawState = useRef(null);
  const dragState = useRef(null);
  const handleDragState = useRef(null); // arrastar um dos dois "pegas" de uma forma selecionada, para a redimensionar
  const apagando = useRef(false); // a borracha está a ser arrastada — continua a apagar tudo por onde passar
  const [hoverMove, setHoverMove] = useState(false); // o cursor está em cima de um desenho já colocado — mostra que dá para o mover
  const [fullscreen, setFullscreen] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  const [clipeAReproduzir, setClipeAReproduzir] = useState(null);
  const [filtroTag, setFiltroTag] = useState(null);
  // Separador da biblioteca de clipes: 'staff' (os clipes cortados aqui)
  // ou 'atletas' (Análise individual em clipes, criados no Portal).
  const [separadorClipes, setSeparadorClipes] = useState('staff');
  const [clipeAtletaAberto, setClipeAtletaAberto] = useState(null);

  const clipesStaff = clipes.filter(c => !ehClipeAtleta(c));
  const clipesAtletas = clipes.filter(ehClipeAtleta);
  // Um cartão por jogador, criado sozinho a partir do primeiro clipe
  // dele. Ordem alfabética; dentro do cartão, o clipe mais recente primeiro.
  const cartoesAtletas = (() => {
    const porAtleta = new Map();
    clipesAtletas.forEach(c => {
      const chave = c.atletaId || c.atletaNome || 'sem-atleta';
      if (!porAtleta.has(chave)) porAtleta.set(chave, { chave, nome: c.atletaNome || 'Atleta sem nome', clipes: [] });
      porAtleta.get(chave).clipes.push(c);
    });
    const lista = [...porAtleta.values()];
    lista.forEach(g => g.clipes.sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))));
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  })();

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
        if (!error) {
          // A Supabase recomenda o endereço direto de storage para
          // ficheiros grandes — evita um salto extra por um gateway
          // (Kong) que fica no caminho do endereço normal. Isto pode
          // ser o que torna lento o seek perto do fim de vídeos longos.
          const urlDireto = data.signedUrl.replace('.supabase.co/storage', '.storage.supabase.co/storage');
          setSignedUrl(urlDireto);
          return;
        }
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

  // Arrastar o dedo/rato ao longo da barra para navegar — antes só se
  // podia clicar num ponto exato, o que é difícil de acertar ao toque
  // num vídeo longo. Pausa-se enquanto se arrasta, e retoma-se a
  // reproduzir no fim se já estava a tocar antes.
  const scrubDragState = useRef(null);
  const startScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    scrubDragState.current = { wasPlaying: !!(videoRef.current && !videoRef.current.paused) };
    videoRef.current?.pause();
    seekTo(((e.clientX - rect.left) / rect.width) * (duration || 0));
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const dragScrub = (e) => {
    if (!scrubDragState.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * (duration || 0));
  };
  const endScrub = () => {
    if (!scrubDragState.current) return;
    if (scrubDragState.current.wasPlaying) videoRef.current?.play();
    scrubDragState.current = null;
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

  // Muda o nome de um vídeo já carregado — não mexe no ficheiro em si,
  // só no nome que a app mostra.
  const renomearVideo = (id, novoNome) => {
    if (!novoNome.trim()) { setEditandoNomeId(null); return; }
    setVideosOriginais(prev => prev.map(v => (v.id === id ? { ...v, titulo: novoNome.trim() } : v)));
    setEditandoNomeId(null);
  };

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

      const tag = TAGS.find(t => t.id === pendingTag) || null;
      const novoClipe = {
        id: uid(), tagId: tag ? tag.id : null, storagePath: json.storagePath, publicUrl: json.publicUrl, thumbUrl: json.thumbUrl || null,
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
        originalId: originalAtivo.id, originalTitulo: originalAtivo.titulo, criadoEm: new Date().toISOString(),
      };
      setClipes(prev => [novoClipe, ...(prev || [])]);
      limparMarcas();
    } catch (e) {
      setErro(`Não consegui guardar o clipe: ${e.message || e}`);
    } finally {
      setAGuardarClipe(false);
    }
  };

  // Muda (ou atribui pela primeira vez) a etiqueta de um clipe já guardado.
  const mudarTagClipe = (clip, novoTagId) => {
    setClipes(prev => prev.map(c => (c.id === clip.id ? { ...c, tagId: novoTagId } : c)));
    setClipeAReproduzir(prev => (prev && prev.id === clip.id ? { ...prev, tagId: novoTagId } : prev));
  };

  const removerClipe = (clip, onRemovido) => {
    const executar = async () => {
      // Os clipes dos atletas não têm ficheiro (são só marcas no YouTube).
      if (clip.storagePath) {
        try { await supabase.storage.from('videos-clipes').remove([clip.storagePath]); } catch (e) { /* apaga o registo à mesma */ }
      }
      setClipes(prev => prev.filter(c => c.id !== clip.id));
      onRemovido?.();
    };
    if (askConfirm) {
      askConfirm({ title: 'Apagar clipe?', label: 'Este clipe', confirmLabel: 'Apagar', onConfirm: executar });
    } else if (window.confirm('Apagar este clipe?')) {
      executar();
    }
  };

  /* ORIGINAL DE UM CLIPE — pelo id (clipes novos) ou, nos antigos que
     não o guardavam, pelo título, só se houver exatamente um com esse
     título (dois vídeos com o mesmo nome e o corte podia sair do errado). */
  const originalDoClipe = (clip) => {
    if (!clip) return null;
    if (clip.originalId) return videosOriginais.find(v => v.id === clip.originalId) || null;
    const mesmos = videosOriginais.filter(v => v.titulo && v.titulo === clip.originalTitulo);
    return mesmos.length === 1 ? mesmos[0] : null;
  };

  // Editar um clipe cortado: texto sempre; tempos, voltando a cortar o
  // original. Mantém o mesmo id (os links partilhados continuam válidos).
  const editarClipeFicheiro = async (clip, { note: novaNota, inicio, fim, originalId }) => {
    const escolhido = originalId ? videosOriginais.find(v => v.id === originalId) : null;
    const mudouOriginal = !!escolhido && escolhido.id !== (originalDoClipe(clip) || {}).id;
    const mudouTempos = mudouOriginal || Math.round(inicio) !== Math.round(clip.origemInicio || 0) || Math.round(fim) !== Math.round(clip.origemFim || 0);
    if (!mudouTempos) {
      const novo = { ...clip, note: novaNota };
      setClipes(prev => prev.map(c => (c.id === clip.id ? novo : c)));
      setClipeAReproduzir(prev => (prev && prev.id === clip.id ? novo : prev));
      return;
    }
    const original = escolhido || originalDoClipe(clip);
    if (!original || !original.storagePath) throw new Error('Escolhe o vídeo original para mudar os tempos. Sem ele, só dá para mudar o texto.');
    const resp = await fetch('/api/cortar-clipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, storagePath: original.storagePath, start: inicio, end: fim }),
    });
    let json = {};
    try { json = await resp.json(); } catch (e) { /* resposta sem corpo */ }
    if (!resp.ok) throw new Error(`Não consegui voltar a cortar o clipe: ${json.error || resp.status}`);
    // Os desenhos estão guardados relativos ao início do clipe: acompanham a mudança.
    const desvio = (clip.origemInicio || 0) - inicio;
    const novo = {
      ...clip,
      note: novaNota,
      storagePath: json.storagePath, publicUrl: json.publicUrl, thumbUrl: json.thumbUrl || null,
      origemInicio: inicio, origemFim: fim, duracao: fim - inicio,
      originalId: original.id, originalTitulo: original.titulo,
      shapes: (clip.shapes || []).map(sh => ({
        ...sh,
        criadoEmTempo: sh.criadoEmTempo == null ? null : Math.max(0, sh.criadoEmTempo + desvio),
        mostrarAte: sh.mostrarAte == null ? null : Math.max(0, sh.mostrarAte + desvio),
      })),
      editadoEm: new Date().toISOString(),
    };
    setClipes(prev => prev.map(c => (c.id === clip.id ? novo : c)));
    setClipeAReproduzir(prev => (prev && prev.id === clip.id ? novo : prev));
    // O ficheiro antigo só se apaga depois de o novo estar gravado.
    if (clip.storagePath && clip.storagePath !== json.storagePath) {
      try { await supabase.storage.from('videos-clipes').remove([clip.storagePath]); } catch (e) { /* fica órfão, sem mal */ }
    }
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
  const fecharDesenho = () => { setModoDesenho(false); setTextoPendente(null); setEditandoDuracaoIndex(null); setPontosEmCurso(null); };

  // Guarda o estado anterior antes de qualquer alteração (criar, mover,
  // redimensionar, apagar) — o "Retroceder" repõe o último estado guardado.
  // Até 20 passos, para não crescer sem limite. Uma ação nova apaga o que
  // se podia "Avançar", tal como num editor normal.
  const pushHistorico = () => { setHistorico(h => [...h.slice(-19), shapes]); setFuturo([]); };
  const retroceder = () => {
    // A meio de colocar pontos (Zona livre / Ligar pontos), "Retroceder"
    // tira o último ponto colocado — voltar a um estado de ANTES de
    // começar a forma não faria sentido, já que a forma ainda nem existe.
    if (pontosEmCurso) { apagarUltimoPonto(); return; }
    setHistorico(h => {
      if (h.length === 0) return h;
      setFuturo(f => [...f, shapes]);
      setShapes(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };
  const avancar = () => {
    setFuturo(f => {
      if (f.length === 0) return f;
      setHistorico(h => [...h, shapes]);
      setShapes(f[f.length - 1]);
      return f.slice(0, -1);
    });
  };

  // "Zona livre" e "Ligar pontos" constroem-se por toques sucessivos —
  // cada toque acrescenta um vértice, e "Concluir" fecha a forma.
  const concluirPontos = () => {
    if (!pontosEmCurso) return;
    const minimo = pontosEmCurso.tool === 'zonalivre' ? 3 : 2;
    if (pontosEmCurso.points.length < minimo) return;
    pushHistorico();
    setShapes(s => [...s, { id: uid(), tool: pontosEmCurso.tool, color: corAtual, points: pontosEmCurso.points, criadoEmTempo: current, mostrarAte: null }]);
    setPontosEmCurso(null);
  };
  const apagarUltimoPonto = () => setPontosEmCurso(p => (p && p.points.length > 1 ? { ...p, points: p.points.slice(0, -1) } : null));

  // Cancela uma construção por pontos a meio, se se mudar de ferramenta.
  useEffect(() => { setPontosEmCurso(null); }, [tool]);

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
  // Liga/desliga o contorno da Zona — sem contorno, fica só com as linhas
  // diagonais a marcar a área, sem a moldura à volta.
  const alternarContornoZona = () => {
    if (editandoDuracaoIndex == null) return;
    pushHistorico();
    setShapes(s => s.map((sh, i) => (i === editandoDuracaoIndex ? { ...sh, semContorno: !sh.semContorno } : sh)));
  };
  // Dá para dar play, deixar correr até ao ponto certo, pausar, e usar esse
  // momento exato — em vez de teres de escrever o minuto de cabeça.
  const usarTempoAtualComoLimite = () => setDuracaoInputTexto(fmt(current));

  const confirmarTexto = () => {
    setTextoPendente(t => {
      if (t && t.valor.trim()) {
        pushHistorico();
        setShapes(s => [...s, { id: uid(), tool: 'texto', color: corAtual, points: [t.pt], texto: t.valor.trim(), criadoEmTempo: current, mostrarAte: null }]);
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

    // A construir uma "Zona livre" ou "Ligar pontos" — cada toque só
    // acrescenta mais um vértice (conclui-se com o botão "Concluir").
    if (pontosEmCurso) {
      setPontosEmCurso(p => ({ ...p, points: [...p.points, pt] }));
      return;
    }
    if (tool === 'apagar') {
      pushHistorico();
      let melhorI = -1, melhorD = RAIO_TOQUE;
      shapes.forEach((sh, i) => { const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
      if (melhorI >= 0) setShapes(s => s.filter((_, i) => i !== melhorI));
      apagando.current = true; // continua a apagar enquanto se arrasta o dedo/rato
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
    // um desenho novo por cima. Funciona com qualquer ferramenta ativa,
    // incluindo as duas ferramentas por pontos.
    let melhorI = -1, melhorD = RAIO_TOQUE;
    shapes.forEach((sh, i) => { const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
    if (melhorI >= 0) {
      pushHistorico();
      dragState.current = { index: melhorI, inicio: pt, pontosIniciais: shapes[melhorI].points.map(p => ({ ...p })), moveu: false };
      return;
    }
    if (tool === 'zonalivre' || tool === 'linhaPontos') { setPontosEmCurso({ tool, points: [pt] }); return; }
    pushHistorico();
    drawState.current = { id: uid(), tool, color: corAtual, points: [pt], criadoEmTempo: current, mostrarAte: null };
    setShapes(s => [...s, drawState.current]);
  };
  // Arrastar uma das "pegas" de uma forma selecionada (aparecem junto ao
  // popup de duração) — para a redimensionar ou reorientar. Na Zona há
  // ainda uma pega extra só para rodar.
  const startHandleDrag = (index, ponto, e, tipo) => {
    e.stopPropagation();
    pushHistorico();
    handleDragState.current = { index, ponto, tipo };
  };
  const moveDraw = (e) => {
    if (!modoDesenho) return;
    if (apagando.current) {
      const pt = getPoint(e);
      let melhorI = -1, melhorD = RAIO_TOQUE;
      shapes.forEach((sh, i) => { const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
      if (melhorI >= 0) setShapes(s => s.filter((_, i) => i !== melhorI));
      return;
    }
    if (handleDragState.current) {
      const pt = getPoint(e);
      const { index, ponto, tipo } = handleDragState.current;
      setShapes(s => s.map((sh, i) => {
        if (i !== index) return sh;
        if (tipo === 'rotacao' && sh.points[0] && sh.points[1]) {
          const [pa, pb] = sh.points;
          const cx = (Math.min(pa.x, pb.x) + Math.max(pa.x, pb.x)) / 2, cy = (Math.min(pa.y, pb.y) + Math.max(pa.y, pb.y)) / 2;
          const graus = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90; // a pega fica acima do centro
          return { ...sh, rotacao: graus };
        }
        if (sh.tool === 'retangulo' && sh.rotacao) {
          // A pega aparece na posição já rodada — roda o toque de volta ao
          // referencial original da zona antes de o guardar como canto.
          const [pa, pb] = sh.points;
          const cx = (Math.min(pa.x, pb.x) + Math.max(pa.x, pb.x)) / 2, cy = (Math.min(pa.y, pb.y) + Math.max(pa.y, pb.y)) / 2;
          const pLocal = girar(pt, { x: cx, y: cy }, -sh.rotacao);
          return { ...sh, points: sh.points.map((p, pi) => (pi === ponto ? pLocal : p)) };
        }
        return { ...sh, points: sh.points.map((p, pi) => (pi === ponto ? pt : p)) };
      }));
      return;
    }
    if (dragState.current) {
      const pt = getPoint(e);
      const { index, inicio, pontosIniciais } = dragState.current;
      const dx = pt.x - inicio.x, dy = pt.y - inicio.y;
      if (Math.hypot(dx, dy) > 2.5) dragState.current.moveu = true; // margem maior — um toque real nunca fica 100% parado
      setShapes(s => s.map((sh, i) => (i === index ? { ...sh, points: pontosIniciais.map(p => ({ x: p.x + dx, y: p.y + dy })) } : sh)));
      return;
    }
    if (drawState.current) {
      const pt = getPoint(e); const st = drawState.current;
      if (st.tool === 'livre') st.points.push(pt); else st.points[1] = pt;
      // Substitui SEMPRE a mesma entrada (pelo id, criado uma única vez em
      // startDraw) — nunca acrescenta uma cópia nova.
      setShapes(s => s.map(sh => (sh.id === st.id ? { ...st, points: [...st.points] } : sh)));
      return;
    }
    // Nada a arrastar/desenhar neste momento — só a ver se o cursor está
    // em cima de um desenho já feito, para mostrar que dá para o mover.
    if (tool !== 'apagar' && tool !== 'texto' && !pontosEmCurso) {
      const pt = getPoint(e);
      let perto = false;
      for (const sh of shapes) { if (distanciaShape(sh, pt) < RAIO_TOQUE) { perto = true; break; } }
      setHoverMove(h => (h === perto ? h : perto));
    }
  };
  const endDraw = () => {
    if (apagando.current) { apagando.current = false; return; }
    if (handleDragState.current) { handleDragState.current = null; return; }
    if (dragState.current) {
      const { index, moveu } = dragState.current;
      dragState.current = null;
      if (!moveu) abrirPopupDuracao(index); // foi um toque simples, sem arrastar — abre o tempo desse desenho (e mostra as pegas, se a forma tiver)
      return;
    }
    drawState.current = null; // a forma já está no array e atualizada — nada mais a fazer
  };

  const pct = (t) => (duration ? (t / duration) * 100 : 0);
  // Aplica-se sempre o limite de tempo definido — mesmo dentro do modo de
  // desenho — para o que se vê ao testar ser igual ao que vai acontecer
  // depois. A única exceção é a forma que está com o popup de duração
  // aberto: essa fica sempre visível, para não desaparecer a meio de a
  // estares a ajustar.
  const shapesVisiveis = shapes.filter((sh, i) => editandoDuracaoIndex === i || shapeVisivelEm(sh, current));

  const FERRAMENTAS = [
    ['seta', ArrowUpRight, 'Seta'],
    ['linha', Minus, 'Linha'],
    ['circulo', Circle, 'Círculo'],
    ['retangulo', Square, 'Zona'],
    ['cone', Eye, 'Visão'],
    ['livre', Pencil, 'Traço'],
    ['zonalivre', Lasso, 'Zona livre'],
    ['linhaPontos', Waypoints, 'Ligar pontos'],
  ];

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files[0];
          if (f) { setFicheiroPendente(f); setNomeVideoInput(f.name.replace(/\.[^.]+$/, '')); }
          e.target.value = '';
        }} />

      {(erro || uploadVideoEstado?.erro) && <div style={{ background: T.surfaceRaise, border: `1px solid ${T.bad}`, borderRadius: 8, padding: 10, marginBottom: 12, color: T.cream, fontSize: 13 }}>{erro || uploadVideoEstado.erro}</div>}

      {/* Nome do vídeo — pede-se antes de começar a enviar, para a lista
         não ficar cheia de nomes de ficheiro em bruto do telemóvel. */}
      {ficheiroPendente && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: T.muted, ...body }}>Nome do vídeo:</span>
          <input
            autoFocus
            value={nomeVideoInput}
            onChange={e => setNomeVideoInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nomeVideoInput.trim()) { iniciarUploadVideo(ficheiroPendente, nomeVideoInput.trim()); setFicheiroPendente(null); } }}
            style={{ flex: '1 1 180px', background: '#111', color: '#fff', border: `1px solid ${T.line}`, borderRadius: 4, padding: '6px 9px', fontSize: 13, ...body }}
          />
          <Btn variant="solid" disabled={!nomeVideoInput.trim()} onClick={() => { iniciarUploadVideo(ficheiroPendente, nomeVideoInput.trim()); setFicheiroPendente(null); }}>
            <Upload size={13} /> Carregar
          </Btn>
          <Btn variant="ghost" onClick={() => setFicheiroPendente(null)}>Cancelar</Btn>
        </div>
      )}

      {/* Vídeos originais carregados — caixas retangulares com pré-visualização,
         só visíveis quando não há nenhum aberto (para não ocupar espaço por
         cima do leitor). Com um vídeo aberto, mostra-se só uma barra fina
         com "Voltar", sempre à vista sem ser preciso subir a página. */}
      {!originalAtivo ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {videosOriginais.map(v => (
            <button key={v.id} onClick={() => { setOriginalAtivoId(v.id); limparMarcas(); }}
              style={{
                display: 'flex', flexDirection: 'column', width: 172, textAlign: 'left', cursor: 'pointer', padding: 0, ...body, overflow: 'hidden',
                borderRadius: 10, border: `1px solid ${v.id === originalAtivoId ? T.crimsonBright : T.line}`,
                background: v.id === originalAtivoId ? T.surfaceRaise : T.surface,
              }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: T.surfaceRaise }}>
                {v.thumbUrl ? (
                  <img src={v.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Film size={20} color={T.mutedDim} />
                  </div>
                )}
                {v.pronto === false && (
                  <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 size={16} className="spin" color="#fff" />
                  </span>
                )}
              </div>
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {editandoNomeId === v.id ? (
                  <input
                    autoFocus
                    value={nomeEditado}
                    onChange={e => setNomeEditado(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Enter') renomearVideo(v.id, nomeEditado); if (e.key === 'Escape') setEditandoNomeId(null); }}
                    onBlur={() => renomearVideo(v.id, nomeEditado)}
                    style={{ width: '100%', background: '#111', color: '#fff', border: `1px solid ${T.crimsonBright}`, borderRadius: 4, padding: '3px 6px', fontSize: 12.5, ...body }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: T.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{v.titulo}</span>
                    <Pencil size={11} color={T.mutedDim} style={{ flexShrink: 0 }}
                      onClick={(e) => { e.stopPropagation(); setNomeEditado(v.titulo); setEditandoNomeId(v.id); }} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {v.pronto === false ? (
                    <span style={{ fontSize: 11, color: T.warn }}>A preparar…</span>
                  ) : <span style={{ fontSize: 11, color: T.mutedDim }}>Pronto</span>}
                  <X size={13} color={T.bad} onClick={(e) => { e.stopPropagation(); apagarOriginal(v); }} />
                </div>
              </div>
            </button>
          ))}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadVideoEstado?.ativo}
            style={{
              width: 172, minHeight: 62, borderRadius: 10, border: `1px dashed ${T.line}`, background: 'transparent', color: T.muted, ...body,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: uploadVideoEstado?.ativo ? 'not-allowed' : 'pointer', fontSize: 12,
            }}>
            {uploadVideoEstado?.ativo ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            {uploadVideoEstado?.ativo ? (uploadVideoEstado.finalizando ? 'A finalizar…' : `A carregar… ${uploadVideoEstado.progresso}%`) : 'Carregar vídeo'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={() => setOriginalAtivoId(null)}>
            <ArrowLeft size={14} /> Vídeos e clipes
          </Btn>
          <span style={{ fontSize: 12.5, color: T.muted, ...body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{originalAtivo.titulo}</span>
          <Btn variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadVideoEstado?.ativo} style={{ marginLeft: 'auto' }}>
            {uploadVideoEstado?.ativo ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {uploadVideoEstado?.ativo ? (uploadVideoEstado.finalizando ? 'A finalizar…' : `${uploadVideoEstado.progresso}%`) : 'Carregar vídeo'}
          </Btn>
        </div>
      )}

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
        <div ref={containerRef} style={{
          background: T.surface, borderRadius: 12, border: `1px solid ${T.line}`, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          // Cabe sempre na janela, sem ser preciso descer a página — antes
          // o vídeo tirava a altura só da largura do ecrã (16:9 "deitado"),
          // o que em ecrãs largos o fazia enorme e empurrava os controlos
          // todos para fora da vista.
          height: fullscreen ? '100vh' : 'calc(100vh - 140px)',
          maxHeight: fullscreen ? '100vh' : 'calc(100vh - 140px)',
        }}>
          <div style={{
            maxHeight: modoDesenho ? 60 : 0, opacity: modoDesenho ? 1 : 0, overflow: 'hidden', flexShrink: 0,
            transition: 'max-height 0.2s ease, opacity 0.15s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${T.line}`, background: T.surfaceRaise }}>
              <span style={{ fontSize: 12.5, color: T.muted, ...mono }}>Modo de desenho — vídeo em pausa</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" onClick={retroceder} disabled={historico.length === 0} style={{ padding: 8 }} title="Retroceder">
                  <Undo2 size={16} />
                </Btn>
                <Btn variant="ghost" onClick={avancar} disabled={futuro.length === 0} style={{ padding: 8 }} title="Avançar">
                  <Redo2 size={16} />
                </Btn>
                <Btn variant="solid" onClick={fecharDesenho}><Check size={14} /> Concluído</Btn>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div style={{
              maxWidth: modoDesenho ? 90 : 0, opacity: modoDesenho ? 1 : 0, overflow: 'hidden', flexShrink: 0,
              transition: 'max-width 0.2s ease, opacity 0.15s ease',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRight: `1px solid ${T.line}`, overflowY: 'auto', overflowX: 'hidden', width: 90 }}>
                {FERRAMENTAS.map(([id, Icon, titulo]) => (
                  <ToolBtn key={id} icon={Icon} label={titulo} active={tool === id} onClick={() => setTool(id)} />
                ))}

                {/* Em ecrã inteiro não há coluna à direita (ficaria fora do
                   alcance do rato/dedo num ecrã grande) — texto, cores e
                   apagar vêm todos para aqui. Fora de ecrã inteiro, ficam
                   à direita (ver abaixo). */}
                {fullscreen && (
                  <>
                    <ToolBtn icon={Type} label="Texto" active={tool === 'texto'} onClick={() => setTool('texto')} />
                    <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center', padding: '2px 0' }}>
                      {PALETA_DESENHO.map(p => (
                        <button key={p.id} onClick={() => setCorAtual(p.cor)} title={p.id}
                          style={{
                            width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0,
                            background: p.cor, border: corAtual === p.cor ? `2px solid ${T.crimsonBright}` : `1px solid ${T.line}`,
                          }} />
                      ))}
                    </div>
                    <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
                    <ToolBtn icon={Eraser} label="Apagar" active={tool === 'apagar'} onClick={() => setTool('apagar')} />
                    <ToolBtn icon={Trash2} label="Limpar tudo" active={false} onClick={() => { pushHistorico(); setShapes([]); }} />
                  </>
                )}
              </div>
            </div>
            <div ref={canvasWrapRef} style={{ position: 'relative', background: '#000', flex: 1, minHeight: 0, width: '100%', touchAction: modoDesenho ? 'none' : 'auto', transition: 'width 0.2s ease, padding 0.2s ease', paddingRight: fullscreen ? 18 : 0, boxSizing: 'border-box' }}
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
                  <video ref={videoRef} src={signedUrl} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} playsInline
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
              <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: modoDesenho ? 'auto' : 'none', cursor: modoDesenho ? (tool === 'apagar' ? CURSOR_BORRACHA : hoverMove ? 'move' : 'crosshair') : 'default' }}>
                {shapesVisiveis.map(renderShape)}

                {/* Pré-visualização da "Zona livre" / "Ligar pontos" a meio da construção */}
                {pontosEmCurso && pontosEmCurso.points.length > 0 && (
                  <g>
                    {pontosEmCurso.points.length > 1 && (
                      <path
                        d={pontosEmCurso.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (pontosEmCurso.tool === 'zonalivre' && pontosEmCurso.points.length > 2 ? ' Z' : '')}
                        stroke={corAtual} strokeWidth={0.5} strokeDasharray="1.6,1.2" strokeLinejoin="round"
                        fill={pontosEmCurso.tool === 'zonalivre' ? corAtual : 'none'} fillOpacity={pontosEmCurso.tool === 'zonalivre' ? 0.18 : undefined}
                      />
                    )}
                    {pontosEmCurso.points.map((p, idx) => (
                      <circle key={idx} cx={p.x} cy={p.y} r={0.55} fill={corAtual} stroke="#000" strokeWidth={0.2} />
                    ))}
                  </g>
                )}

                {/* Pegas para mover/redimensionar a forma selecionada (a mesma que tem o popup de duração aberto) —
                   para a Zona livre e o Ligar pontos, aparece uma pega por cada vértice já colocado.
                   Mais pequenas e finas do que antes, para não tapar o vídeo. */}
                {editandoDuracaoIndex != null && shapes[editandoDuracaoIndex] && shapes[editandoDuracaoIndex].tool === 'retangulo' && shapes[editandoDuracaoIndex].points[1] && (() => {
                  const forma = shapes[editandoDuracaoIndex];
                  const [pa, pb] = forma.points;
                  const x = Math.min(pa.x, pb.x), y = Math.min(pa.y, pb.y), w = Math.abs(pb.x - pa.x), h = Math.abs(pb.y - pa.y);
                  const centro = { x: x + w / 2, y: y + h / 2 };
                  const rot = forma.rotacao || 0;
                  const p0 = girar(pa, centro, rot), p1 = girar(pb, centro, rot);
                  const topoMeio = girar({ x: centro.x, y }, centro, rot);
                  const pegaRodar = girar({ x: centro.x, y: y - 6 }, centro, rot);
                  return (
                    <g>
                      <line x1={topoMeio.x} y1={topoMeio.y} x2={pegaRodar.x} y2={pegaRodar.y} stroke={T.gold} strokeWidth={0.15} />
                      <circle cx={p0.x} cy={p0.y} r={0.55} fill={T.crimsonBright} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, 0, e)} style={{ cursor: 'pointer', touchAction: 'none' }} />
                      <circle cx={p1.x} cy={p1.y} r={0.55} fill={T.crimsonBright} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, 1, e)} style={{ cursor: 'pointer', touchAction: 'none' }} />
                      <circle cx={pegaRodar.x} cy={pegaRodar.y} r={0.55} fill={T.gold} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, null, e, 'rotacao')} style={{ cursor: 'grab', touchAction: 'none' }} />
                    </g>
                  );
                })()}
                {editandoDuracaoIndex != null && shapes[editandoDuracaoIndex] && ['seta', 'linha', 'circulo', 'cone', 'zonalivre', 'linhaPontos'].includes(shapes[editandoDuracaoIndex].tool) &&
                  shapes[editandoDuracaoIndex].points.map((p, pi) => (
                    <circle key={pi} cx={p.x} cy={p.y} r={['zonalivre', 'linhaPontos'].includes(shapes[editandoDuracaoIndex].tool) ? 0.4 : 0.55} fill={T.crimsonBright} stroke="#fff" strokeWidth={0.15}
                      onPointerDown={e => startHandleDrag(editandoDuracaoIndex, pi, e)}
                      style={{ cursor: 'pointer', touchAction: 'none' }} />
                  ))}
              </svg>
              {pontosEmCurso && (
                <div onPointerDown={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.88)', border: `1px solid ${corAtual}`, borderRadius: 8,
                    padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, zIndex: 6, flexWrap: 'wrap', justifyContent: 'center',
                  }}>
                  <span style={{ fontSize: 12, color: '#fff', ...body }}>
                    {pontosEmCurso.points.length} ponto{pontosEmCurso.points.length === 1 ? '' : 's'} — toca no vídeo para acrescentar
                  </span>
                  <Btn variant="ghost" onClick={apagarUltimoPonto} disabled={pontosEmCurso.points.length < 2} style={{ padding: '5px 8px', fontSize: 12 }}>Apagar último</Btn>
                  <Btn variant="solid" onClick={concluirPontos} disabled={pontosEmCurso.points.length < (pontosEmCurso.tool === 'zonalivre' ? 3 : 2)} style={{ padding: '5px 10px', fontSize: 12 }}>
                    <Check size={13} /> Concluir
                  </Btn>
                  <Btn variant="ghost" onClick={() => setPontosEmCurso(null)} style={{ padding: '5px 10px', fontSize: 12 }}>Cancelar</Btn>
                </div>
              )}
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
                      border: `1px solid ${corAtual}`, borderRadius: 4, padding: '3px 7px', fontSize: 14,
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
                    value={duracaoInputTexto}
                    onChange={e => setDuracaoInputTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmarDuracaoShape(); }}
                    placeholder="mm:ss"
                    style={{ width: 62, background: '#111', color: '#fff', border: `1px solid ${T.line}`, borderRadius: 4, padding: '3px 6px', fontSize: 13, textAlign: 'center', ...mono }}
                  />
                  <Btn variant="solid" onClick={confirmarDuracaoShape} style={{ padding: '5px 10px', fontSize: 12 }}>OK</Btn>
                  <Btn variant="ghost" onClick={marcarSempreVisivelShape} style={{ padding: '5px 10px', fontSize: 12 }}>Sempre visível</Btn>
                  {shapes[editandoDuracaoIndex]?.tool === 'retangulo' && (
                    <Btn variant={shapes[editandoDuracaoIndex]?.semContorno ? 'solid' : 'ghost'} onClick={alternarContornoZona} style={{ padding: '5px 10px', fontSize: 12 }}>
                      {shapes[editandoDuracaoIndex]?.semContorno ? 'Sem contorno' : 'Com contorno'}
                    </Btn>
                  )}
                </div>
              )}
            </div>
            <div style={{
              maxWidth: (modoDesenho && !fullscreen) ? 90 : 0, opacity: (modoDesenho && !fullscreen) ? 1 : 0, overflow: 'hidden', flexShrink: 0,
              transition: 'max-width 0.2s ease, opacity 0.15s ease',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderLeft: `1px solid ${T.line}`, justifyContent: 'center', width: 90 }}>
                <ToolBtn icon={Type} label="Texto" active={tool === 'texto'} onClick={() => setTool('texto')} />
                <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center', padding: '2px 0' }}>
                  {PALETA_DESENHO.map(p => (
                    <button key={p.id} onClick={() => setCorAtual(p.cor)} title={p.id}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0,
                        background: p.cor, border: corAtual === p.cor ? `2px solid ${T.crimsonBright}` : `1px solid ${T.line}`,
                      }} />
                  ))}
                </div>
                <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
                <ToolBtn icon={Eraser} label="Apagar" active={tool === 'apagar'} onClick={() => setTool('apagar')} />
                <ToolBtn icon={Trash2} label="Limpar tudo" active={false} onClick={() => { pushHistorico(); setShapes([]); }} />
              </div>
            </div>
          </div>

          <div style={{ padding: '10px 14px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Btn variant="ghost" onClick={togglePlay} style={{ padding: 8 }}>{playing ? <Pause size={16} /> : <Play size={16} />}</Btn>
            <span style={{ fontSize: 12, color: T.muted, ...mono, minWidth: 44 }}>{fmt(current)}</span>
            <div onPointerDown={startScrub} onPointerMove={dragScrub} onPointerUp={endScrub} onPointerCancel={endScrub}
              style={{ flex: 1, height: 36, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', touchAction: 'none' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: T.line, borderRadius: 3 }} />
              <div style={{ position: 'absolute', left: 0, width: `${pct(current)}%`, height: 6, background: T.gold, borderRadius: 3 }} />
              {inPoint != null && <div style={{ position: 'absolute', left: `${pct(inPoint)}%`, top: -4, width: 2, height: 14, background: T.good }} />}
              {outPoint != null && <div style={{ position: 'absolute', left: `${pct(outPoint)}%`, top: -4, width: 2, height: 14, background: T.bad }} />}
              <div style={{
                position: 'absolute', left: `${pct(current)}%`, transform: 'translateX(-50%)',
                width: 16, height: 16, borderRadius: '50%', background: T.gold,
                border: `2px solid ${T.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </div>
            <span style={{ fontSize: 12, color: T.mutedDim, ...mono, minWidth: 44 }}>{fmt(duration)}</span>
            <Btn variant="ghost" onClick={alternarEcraInteiro} style={{ padding: 8 }} title="Ecrã inteiro">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Btn>
          </div>

          <div style={{ padding: '8px 14px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: `1px solid ${T.line}` }}>
            <Btn variant="ghost" onClick={markIn}><Flag size={14} color={T.good} /> Marcar início ({fmt(inPoint ?? 0)})</Btn>
            <Btn variant="ghost" onClick={markOut}><Flag size={14} color={T.bad} /> Marcar fim ({fmt(outPoint ?? 0)})</Btn>
            <Btn variant="ghost" onClick={limparMarcas} disabled={inPoint == null && outPoint == null}><RotateCcw size={14} /> Limpar</Btn>
            {!modoDesenho && (
              <>
                <div style={{ width: 1, background: T.line, margin: '0 4px' }} />
                <Btn variant="ghost" onClick={abrirDesenho}><Scissors size={14} /> Desenhar {shapes.length > 0 && `(${shapes.length})`}</Btn>
              </>
            )}
          </div>

          {!modoDesenho && (
            <>
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
                  {erro && (
                    <div style={{ background: T.surface, border: `1px solid ${T.bad}`, borderRadius: 7, padding: 9, marginTop: 8, color: T.cream, fontSize: 12.5 }}>{erro}</div>
                  )}
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
        <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { id: 'staff', label: `Clipes (${(filtroTag ? clipesStaff.filter(c => c.tagId === filtroTag) : clipesStaff).length})`, Icon: Tag },
            { id: 'atletas', label: `Análise individual em clipes (${clipesAtletas.length})`, Icon: User },
          ].map(({ id, label, Icon }) => {
            const on = separadorClipes === id;
            return (
              <button key={id} role="tab" aria-selected={on} onClick={() => setSeparadorClipes(id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                  ...display, fontSize: 14, fontWeight: 600,
                  border: `1px solid ${on ? T.gold : T.line}`, background: on ? T.surfaceRaise : 'transparent', color: on ? T.cream : T.muted,
                }}>
                <Icon size={15} color={on ? T.gold : T.muted} /> {label}
              </button>
            );
          })}
        </div>

        {separadorClipes === 'atletas' && (
          clipesAtletas.length === 0 ? (
            <div style={{ color: T.mutedDim, fontSize: 13, padding: '18px 0', ...body }}>
              Ainda nenhum jogador criou clipes. No Portal do Atleta, em Biblioteca, os jogadores podem marcar lances nos vídeos dos jogos. Cada jogador que gravar um clipe ganha aqui o seu cartão.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {cartoesAtletas.map(g => (
                <div key={g.chave} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: `1px solid ${T.line}` }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: '50%', background: T.surfaceRaise, color: T.gold, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, ...body,
                    }}>
                      {g.nome.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: T.cream, ...body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.nome}</span>
                    <span style={{ fontSize: 12, color: T.mutedDim, ...body, flexShrink: 0 }}>{g.clipes.length} {g.clipes.length === 1 ? 'clipe' : 'clipes'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 340, overflowY: 'auto' }}>
                    {g.clipes.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${T.line}` }}>
                      <button onClick={() => setClipeAtletaAberto(c)}
                        style={{
                          flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '9px 4px 9px 12px', cursor: 'pointer',
                          background: 'transparent', border: 'none', ...body,
                        }}>
                        <img src={`https://img.youtube.com/vi/${c.youtubeId}/default.jpg`} alt=""
                          style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: T.surfaceRaise }} />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 13, color: T.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titulo || '(sem título)'}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.mutedDim, ...mono }}>
                            <Scissors size={10} /> {mmss(c.clipInicio)}–{mmss(c.clipFim)}
                            {dataCurta(c.criadoEm) && <span style={{ ...body, marginLeft: 4 }}>· {dataCurta(c.criadoEm)}</span>}
                          </span>
                          {c.note
                            ? <span style={{ display: 'block', fontSize: 11.5, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.note}</span>
                            : c.originalTitulo && <span style={{ display: 'block', fontSize: 11.5, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.originalTitulo}</span>}
                        </span>
                      </button>
                      <button
                        onClick={async () => { if (await partilharClipeAtleta(c) === 'copiado') { setCopiedId(c.id); setTimeout(() => setCopiedId(null), 1600); } }}
                        title="Partilhar só o corte" aria-label={`Partilhar o clipe ${c.titulo || ''}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', display: 'flex', flexShrink: 0 }}>
                        {copiedId === c.id ? <Check size={15} color={T.good} /> : <Share2 size={15} color={T.muted} />}
                      </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {separadorClipes === 'staff' && clipesStaff.length === 0 && <div style={{ color: T.mutedDim, fontSize: 13, padding: '18px 0' }}>Ainda não há clipes guardados.</div>}

        {separadorClipes === 'staff' && clipesStaff.length > 0 && (
          <>
            {/* Filtro por etiqueta — só mostra as etiquetas que têm pelo
               menos um clipe, para não encher a tira de opções vazias. */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, WebkitOverflowScrolling: 'touch' }}>
              <button onClick={() => setFiltroTag(null)}
                style={{
                  flex: '0 0 auto', padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...body, whiteSpace: 'nowrap',
                  border: `1px solid ${T.muted}`, background: filtroTag == null ? T.muted : 'transparent', color: filtroTag == null ? T.bg : T.muted,
                }}>
                Todos
              </button>
              {TAGS.filter(tag => clipesStaff.some(c => c.tagId === tag.id)).map(tag => (
                <button key={tag.id} onClick={() => setFiltroTag(tag.id)}
                  style={{
                    flex: '0 0 auto', padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...body, whiteSpace: 'nowrap',
                    border: `1px solid ${tag.color}`, background: filtroTag === tag.id ? tag.color : 'transparent', color: filtroTag === tag.id ? TEXT_ON_ACCENT : tag.color,
                  }}>
                  {tag.label}
                </button>
              ))}
            </div>

            {/* Cartões com miniatura, em tira horizontal — desliza-se com
               o dedo, tal como numa galeria. Toca-se num cartão para abrir
               o clipe. */}
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}>
              {(filtroTag ? clipesStaff.filter(c => c.tagId === filtroTag) : clipesStaff).map(clip => {
                const tag = TAGS.find(t => t.id === clip.tagId);
                return (
                  <div key={clip.id} style={{ position: 'relative', flex: '0 0 auto', width: 148, scrollSnapAlign: 'start' }}>
                  <button onClick={() => setClipeAReproduzir(clip)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer', padding: 0, display: 'block',
                      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', ...body,
                    }}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: T.surfaceRaise }}>
                      {clip.thumbUrl ? (
                        <img src={clip.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Film size={22} color={T.mutedDim} />
                        </div>
                      )}
                      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tag?.color || T.line }} />
                      <span style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 10.5, color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 5px', ...mono }}>
                        {Math.round(clip.duracao)}s
                      </span>
                    </div>
                    <div style={{ padding: '7px 9px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: tag?.color || T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tag?.label || 'Sem etiqueta'}</div>
                      {clip.note ? (
                        <div style={{ fontSize: 11, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip.note}</div>
                      ) : (
                        <div style={{ fontSize: 11, color: T.mutedDim }}>{clip.originalTitulo}</div>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={async () => { if (await partilharClipeFicheiro(clip) === 'copiado') { setCopiedId(clip.id); setTimeout(() => setCopiedId(null), 1600); } }}
                    title="Partilhar o clipe" aria-label="Partilhar o clipe"
                    style={{
                      position: 'absolute', top: 7, left: 6, width: 26, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}>
                    {copiedId === clip.id ? <Check size={13} color={T.good} /> : <Share2 size={13} color="#fff" />}
                  </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {clipeAtletaAberto && (
        <ClipAtletaModal
          clip={clipeAtletaAberto}
          onClose={() => setClipeAtletaAberto(null)}
          onRemove={() => removerClipe(clipeAtletaAberto, () => setClipeAtletaAberto(null))}
        />
      )}

      {clipeAReproduzir && (
        <ClipPlayerModal
          clip={clipeAReproduzir}
          tag={TAGS.find(t => t.id === clipeAReproduzir.tagId)}
          onClose={() => setClipeAReproduzir(null)}
          copied={copiedId === clipeAReproduzir.id}
          onShare={async () => { if (await partilharClipeFicheiro(clipeAReproduzir) === 'copiado') { setCopiedId(clipeAReproduzir.id); setTimeout(() => setCopiedId(null), 1600); } }}
          onSaveEdit={(dados) => editarClipeFicheiro(clipeAReproduzir, dados)}
          originais={videosOriginais.filter(v => v.storagePath)}
          originalSugeridoId={(originalDoClipe(clipeAReproduzir) || {}).id || null}
          onRemove={() => removerClipe(clipeAReproduzir, () => setClipeAReproduzir(null))}
          onChangeTag={novoTagId => mudarTagClipe(clipeAReproduzir, novoTagId)}
        />
      )}
    </div>
  );
}
