import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Play, Pause, Scissors, Circle, ArrowUpRight, Minus, Eraser, Trash2,
  Link2, Copy, Check, Video, Upload, Tag, X, Flag, RotateCcw, Loader2, Film,
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

/* PROPS ESPERADAS — passadas do App principal, tal como `documentos`/
   `setDocumentos` já são passadas ao `DocumentosApp`:
   teamId, videosOriginais, setVideosOriginais, clipes, setClipes
   (os dois últimos pares vêm de `useCollectionSync('video_originais', …)`
   e `useCollectionSync('video_clips', …)` no App principal). */
export default function AnalisadorVideo({ teamId, videosOriginais = [], setVideosOriginais, clipes = [], setClipes, uploadVideoEstado, iniciarUploadVideo }) {
  const videoRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const fileInputRef = useRef(null);

  const [originalAtivoId, setOriginalAtivoId] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
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
  const drawState = useRef(null);

  const [copiedId, setCopiedId] = useState(null);
  const [clipeAReproduzir, setClipeAReproduzir] = useState(null);

  const originalAtivo = videosOriginais.find(v => v.id === originalAtivoId) || null;

  // Assim que se escolhe um vídeo original, gera-se um signed URL —
  // o bucket `videos-originais` é privado, o browser precisa de um
  // link temporário para o poder reproduzir.
  useEffect(() => {
    setSignedUrl(null);
    if (!originalAtivo) return;
    let cancelado = false;
    supabase.storage.from('videos-originais').createSignedUrl(originalAtivo.storagePath, 3600)
      .then(({ data, error }) => { if (!cancelado && !error) setSignedUrl(data.signedUrl); });
    return () => { cancelado = true; };
  }, [originalAtivo?.id]);

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
  const limparMarcas = () => { setInPoint(null); setOutPoint(null); setPendingTag(null); setNote(''); setShapes([]); };

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

  const apagarOriginal = async (video) => {
    if (!window.confirm(`Apagar o vídeo "${video.titulo}"? Os clipes já cortados dele mantêm-se — só o vídeo completo desaparece.`)) return;
    try { await supabase.storage.from('videos-originais').remove([video.storagePath]); } catch (e) { /* apaga o registo à mesma */ }
    setVideosOriginais(prev => prev.filter(v => v.id !== video.id));
    if (originalAtivoId === video.id) { setOriginalAtivoId(null); limparMarcas(); }
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
        note, shapes, originalTitulo: originalAtivo.titulo, criadoEm: new Date().toISOString(),
      };
      setClipes(prev => [novoClipe, ...(prev || [])]);
      limparMarcas();
    } catch (e) {
      setErro(`Não consegui guardar o clipe: ${e.message || e}`);
    } finally {
      setAGuardarClipe(false);
    }
  };

  const removerClipe = async (clip) => {
    if (!window.confirm('Apagar este clipe?')) return;
    try { await supabase.storage.from('videos-clipes').remove([clip.storagePath]); } catch (e) { /* apaga o registo à mesma */ }
    setClipes(prev => prev.filter(c => c.id !== clip.id));
  };

  const copiarLink = (clip) => {
    if (navigator.clipboard) navigator.clipboard.writeText(clip.publicUrl).catch(() => {});
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  /* ---- Telestração ---- */
  const getPoint = (e) => {
    const rect = canvasWrapRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    // x vai de 0 a 100, y vai de 0 a 56.25 — tem de bater certo com o
    // viewBox do SVG ali em baixo (que usa esses números para manter a
    // proporção 16:9 sem esticar os desenhos). Antes isto devolvia y
    // também em 0-100, por isso o traço aparecia sempre deslocado.
    return { x: ((p.clientX - rect.left) / rect.width) * 100, y: ((p.clientY - rect.top) / rect.height) * 56.25 };
  };
  const abrirDesenho = () => { videoRef.current?.pause(); setModoDesenho(true); };
  const fecharDesenho = () => setModoDesenho(false);

  const startDraw = (e) => { if (!modoDesenho) return; videoRef.current?.pause(); drawState.current = { tool, color: T.crimsonBright, points: [getPoint(e)] }; };
  const moveDraw = (e) => {
    if (!modoDesenho || !drawState.current) return;
    const pt = getPoint(e); const st = drawState.current;
    if (st.tool === 'livre') st.points.push(pt); else st.points[1] = pt;
    setShapes(s => [...s.filter(x => x !== st), { ...st }]);
  };
  const endDraw = () => {
    const st = drawState.current;
    if (!st) return;
    setShapes(s => [...s.filter(x => x !== st), { ...st }]);
    drawState.current = null;
  };
  const renderShape = (sh, i) => {
    if (!sh || !sh.points || sh.points.length === 0) return null;
    const [a, b] = sh.points;
    if (!a) return null;
    const cor = { stroke: sh.color, fill: 'none' };
    if (sh.tool === 'livre') {
      const d = sh.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return <path key={i} d={d} style={cor} strokeWidth={0.6} strokeLinecap="round" />;
    }
    if (!b) return null;
    if (sh.tool === 'circulo') return <circle key={i} cx={a.x} cy={a.y} r={Math.hypot(b.x - a.x, b.y - a.y)} style={cor} strokeWidth={0.6} />;
    if (sh.tool === 'linha') return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={cor} strokeWidth={0.6} />;
    const angle = Math.atan2(b.y - a.y, b.x - a.x); const ah = 2.2;
    const p1 = { x: b.x - ah * Math.cos(angle - 0.4), y: b.y - ah * Math.sin(angle - 0.4) };
    const p2 = { x: b.x - ah * Math.cos(angle + 0.4), y: b.y - ah * Math.sin(angle + 0.4) };
    return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={cor} strokeWidth={0.6} />
      <path d={`M ${b.x} ${b.y} L ${p1.x} ${p1.y} M ${b.x} ${b.y} L ${p2.x} ${p2.y}`} style={cor} strokeWidth={0.6} strokeLinecap="round" /></g>;
  };

  const pct = (t) => (duration ? (t / duration) * 100 : 0);

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
            <X size={12} color={T.bad} onClick={(e) => { e.stopPropagation(); apagarOriginal(v); }} />
          </button>
        ))}
        <Btn variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadVideoEstado?.ativo}>
          {uploadVideoEstado?.ativo ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {uploadVideoEstado?.ativo ? `A carregar… ${uploadVideoEstado.progresso}%` : 'Carregar vídeo'}
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
        <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
          {modoDesenho && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${T.line}`, background: T.surfaceRaise }}>
              <span style={{ fontSize: 12.5, color: T.muted, ...mono }}>Modo de desenho — vídeo em pausa</span>
              <Btn variant="solid" onClick={fecharDesenho}><Check size={14} /> Concluído</Btn>
            </div>
          )}

          <div style={{ display: 'flex' }}>
            {modoDesenho && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRight: `1px solid ${T.line}` }}>
                {[['seta', ArrowUpRight], ['circulo', Circle], ['linha', Minus]].map(([id, Icon]) => (
                  <Btn key={id} variant="ghost" active={tool === id} onClick={() => setTool(id)} style={{ padding: 10 }} title={id}><Icon size={18} /></Btn>
                ))}
                <Btn variant="ghost" active={tool === 'livre'} onClick={() => setTool('livre')} style={{ padding: 10 }} title="livre">Livre</Btn>
                <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
                <Btn variant="plain" onClick={() => setShapes([])} style={{ padding: 10 }} title="apagar tudo"><Eraser size={18} /></Btn>
              </div>
            )}
            <div ref={canvasWrapRef} style={{ position: 'relative', background: '#000', aspectRatio: '16/9', width: '100%' }}
              onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}>
              {signedUrl ? (
                <video ref={videoRef} src={signedUrl} style={{ width: '100%', height: '100%', display: 'block' }} playsInline />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: T.muted }}><Loader2 size={20} className="spin" /></div>
              )}
              <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: modoDesenho ? 'auto' : 'none', cursor: modoDesenho ? 'crosshair' : 'default' }}>
                {shapes.map(renderShape)}
              </svg>
            </div>
          </div>

          {!modoDesenho && (
            <>
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
        <div onClick={() => setClipeAReproduzir(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.line}`, maxWidth: 720, width: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontSize: 12.5, color: T.muted, ...body }}>{TAGS.find(t => t.id === clipeAReproduzir.tagId)?.label} · {Math.round(clipeAReproduzir.duracao)}s</span>
              <Btn variant="plain" onClick={() => setClipeAReproduzir(null)}><X size={16} /></Btn>
            </div>
            <video src={clipeAReproduzir.publicUrl} controls autoPlay style={{ width: '100%', display: 'block', background: '#000' }} />
            {clipeAReproduzir.note && <div style={{ padding: 12, fontSize: 13, color: T.cream }}>{clipeAReproduzir.note}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
