// base/fotos.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { body, T, display } from './tema';
import { ZoomOut, ZoomIn, Check, Upload, Move, X } from 'lucide-react';
import { Btn } from './ui';
import { fileToPhotoDataUrl } from './anexos';

/* Campo de fotografia reutilizável (ficha de scouting e ficha do plantel).
   Guarda a foto como data URL já redimensionada em `value`. */
/* ENQUADRAR A FOTO NA BOLA. Ao anexar (ou em "Ajustar"), a foto abre
   numa janela com o círculo da bola: arrasta-se para centrar a cara e
   aproxima-se com a barra (ou a roda do rato / dois dedos não: a barra
   chega e funciona em todo o lado). Guarda-se já recortada em quadrado
   (512 px), por isso aparece bem em TODAS as bolas da app e do Portal,
   sem mudar nada no servidor. */
export function fotoParaEnquadrar(file, maxLado = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.onload = () => {
        const esc = Math.min(1, maxLado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * esc)); c.height = Math.max(1, Math.round(img.height * esc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        try { resolve(c.toDataURL('image/jpeg', 0.9)); } catch (e) { resolve(reader.result); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function EnquadrarFoto({ src, onUsar, onCancelar }) {
  const F = 260; // lado da janela de enquadramento (px)
  const [dim, setDim] = useState(null); // { w, h }
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const arrasto = useRef(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const d = { w: img.naturalWidth, h: img.naturalHeight };
      setDim(d);
      // Foto ao alto: começa mais em cima (é onde costuma estar a cara).
      const s0 = F / Math.min(d.w, d.h);
      const sobra = (d.h * s0 - F) / 2;
      setOff({ x: 0, y: sobra > 0 ? sobra * 0.55 : 0 });
    };
    img.src = src;
  }, [src]);
  const s0 = dim ? F / Math.min(dim.w, dim.h) : 1;
  const dw = dim ? dim.w * s0 * zoom : F, dh = dim ? dim.h * s0 * zoom : F;
  const prender = (o, z = zoom) => {
    if (!dim) return o;
    const mx = Math.max(0, (dim.w * s0 * z - F) / 2), my = Math.max(0, (dim.h * s0 * z - F) / 2);
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) };
  };
  const mudarZoom = (z) => { const nz = Math.max(1, Math.min(4, z)); setZoom(nz); setOff(o => prender(o, nz)); };
  const usar = () => {
    if (!dim) return;
    const img = new Image();
    img.onload = () => {
      const k = s0 * zoom; // px no ecrã por px da imagem
      const lado = F / k;
      const sx = dim.w / 2 - (F / 2 + off.x) / k, sy = dim.h / 2 - (F / 2 + off.y) / k;
      const out = Math.min(512, Math.max(64, Math.round(lado)));
      const c = document.createElement('canvas');
      c.width = out; c.height = out;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out, out);
      ctx.drawImage(img, sx, sy, lado, lado, 0, 0, out, out);
      try { onUsar(c.toDataURL('image/jpeg', 0.86)); } catch (e) { onUsar(src); }
    };
    img.src = src;
  };
  return createPortal(
    // Os cliques não passam para a janela de trás (a ficha do jogador).
    <div onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onCancelar(); }} onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, ...body }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, width: '100%', maxWidth: 320, boxSizing: 'border-box' }}>
        <div style={{ ...display, fontSize: 18, color: T.cream, marginBottom: 4 }}>Enquadrar a foto</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>Arrasta para centrar a cara na bola.</div>
        <div
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); arrasto.current = { px: e.clientX, py: e.clientY, o: off }; }}
          onPointerMove={e => { const a = arrasto.current; if (!a) return; setOff(prender({ x: a.o.x + e.clientX - a.px, y: a.o.y + e.clientY - a.py })); }}
          onPointerUp={() => { arrasto.current = null; }}
          onPointerCancel={() => { arrasto.current = null; }}
          onWheel={e => mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          style={{ position: 'relative', width: F, height: F, margin: '0 auto', overflow: 'hidden', borderRadius: 10, background: '#111', cursor: 'grab', touchAction: 'none', userSelect: 'none' }}>
          {dim && (
            <img src={src} alt="" draggable={false} style={{
              position: 'absolute', left: (F - dw) / 2 + off.x, top: (F - dh) / 2 + off.y, width: dw, height: dh, maxWidth: 'none', pointerEvents: 'none',
            }} />
          )}
          {/* A bola: fora dela fica escurecido. */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 6, borderRadius: '50%', boxShadow: '0 0 0 400px rgba(0,0,0,.55)', border: '2px solid #ffffffcc', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 16px' }}>
          <ZoomOut size={15} color={T.muted} />
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={e => mudarZoom(Number(e.target.value))} style={{ flex: 1, accentColor: T.gold }} aria-label="Aproximar" />
          <ZoomIn size={15} color={T.muted} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
          <Btn onClick={usar} disabled={!dim}><Check size={15} /> Usar</Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PhotoField({ label = 'Fotografia', value, onChange, hint }) {
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  const [aEnquadrar, setAEnquadrar] = useState(null); // imagem a enquadrar

  const pick = async (file) => {
    setErr('');
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) { setErr('Só são aceites imagens (JPG, PNG…).'); return; }
    if (file.size > 12 * 1024 * 1024) { setErr('Imagem demasiado grande (máx. 12 MB).'); return; }
    try {
      setAEnquadrar(await fotoParaEnquadrar(file));
    } catch (e) {
      try { onChange(await fileToPhotoDataUrl(file)); } catch (e2) { setErr('Não foi possível ler a imagem.'); }
    }
  };

  return (
    <div style={{ ...body }}>
      <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {value ? (
          <img src={value} alt="Fotografia" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '50%', border: `2px solid ${T.line}`, background: '#000' }} />
        ) : (
          <div style={{
            width: 80, height: 80, borderRadius: '50%', border: `1px dashed ${T.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mutedDim, fontSize: 10.5, textAlign: 'center',
          }}>sem foto</div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => inputRef.current && inputRef.current.click()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.line}`,
            background: T.surfaceRaise, color: T.cream, fontSize: 13, ...body,
          }}>
            <Upload size={14} /> {value ? 'Substituir foto' : 'Anexar foto'}
          </button>
          {value && (
            <button type="button" onClick={() => { setErr(''); setAEnquadrar(value); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.line}`,
              background: 'transparent', color: T.cream, fontSize: 13, ...body,
            }}>
              <Move size={14} /> Ajustar
            </button>
          )}
          {value && (
            <button type="button" onClick={() => { onChange(null); setErr(''); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.line}`,
              background: 'transparent', color: T.mutedDim, fontSize: 13, ...body,
            }}>
              <X size={14} /> Remover
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      </div>
      {hint && <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6 }}>{hint}</div>}
      {err && <div style={{ fontSize: 12, color: T.bad, marginTop: 6 }}>{err}</div>}
      {aEnquadrar && (
        <EnquadrarFoto src={aEnquadrar}
          onUsar={(url) => { setAEnquadrar(null); onChange(url); }}
          onCancelar={() => setAEnquadrar(null)} />
      )}
    </div>
  );
}

/* A altura é fixada de propósito: sem ela, um <select> (com a seta), um
   input de data/hora (com o ícone do calendário) e um input de texto
   simples ficam com alturas diferentes, e numa linha de campos lado a
   lado nota-se logo que umas caixas são mais baixas do que outras. */
// Altura da barra superior em mobile (fixa no topo + espaçador).
export const MOBILE_BAR_H = 62;

