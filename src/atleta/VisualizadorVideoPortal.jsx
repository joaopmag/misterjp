// atleta/VisualizadorVideoPortal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useRef, useState, useEffect } from 'react';
import { ehClipe } from '../media/organizacao';
import { useLupa, socialEmbedSrc, socialExternalUrl, INSTAGRAM_SANDBOX, ControlosLupa, fmtMMSS } from '../media/social';
import { useKioskVoltar } from '../base/kiosk';
import { createPortal } from 'react-dom';
import { T, body, mono } from '../base/tema';
import { Minimize2, Maximize2, X, Pause, Play, RotateCcw, ExternalLink } from 'lucide-react';

/* VISUALIZADOR DE VÍDEO DO PORTAL (YouTube e redes sociais).

   Abre por cima de tudo, com o vídeo o maior possível e um botão de ecrã
   inteiro sempre visível. O ecrã inteiro é pedido à CAIXA (não ao
   iframe), por isso funciona também nos clipes. Onde o browser não deixa
   pôr uma caixa em ecrã inteiro (iPhone), a caixa ocupa o ecrã por CSS.

   CLIPES: nunca se sai do corte. Sem controlos do YouTube (que deixavam
   percorrer e repetir o jogo inteiro), com a barra da app limitada ao
   corte; ao chegar ao fim volta sozinho ao início e continua a tocar,
   sempre no mesmo corte (a mesma lógica da página pública do corte).

   LUPA: em ecrã inteiro dá para aproximar com dois dedos, roda do rato
   ou os botões + e −, e arrastar a imagem; um toque pausa/retoma. */
export function VisualizadorVideoPortal({ item, onClose }) {
  const caixaRef = useRef(null);
  const areaRef = useRef(null);
  const iframeRef = useRef(null);
  const [cheio, setCheio] = useState(false);     // ecrã inteiro do browser
  const [cheioCss, setCheioCss] = useState(false); // alternativa por CSS
  const emCheio = cheio || cheioCss;

  const ehYt = !!item.youtubeId;
  const ehClipe = ehYt && typeof item.clipInicio === 'number' && typeof item.clipFim === 'number' && item.clipFim > item.clipInicio;
  const inicio = ehClipe ? Math.max(0, item.clipInicio) : 0;
  const fim = ehClipe ? item.clipFim : 0;
  const duracao = fim - inicio;

  const [tempo, setTempo] = useState(inicio);
  const [aTocar, setATocar] = useState(false);
  const [aArrastarBarra, setAArrastarBarra] = useState(null); // posição durante o arrasto
  const saltoRef = useRef(0);

  const lupa = useLupa(areaRef, ehYt && emCheio);

  const comando = (func, args) => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  };
  const irPara = (seg) => {
    const alvo = ehClipe ? Math.min(fim - 0.2, Math.max(inicio, seg)) : seg;
    saltoRef.current = Date.now();
    comando('seekTo', [alvo, true]);
    setTempo(alvo);
  };
  const alternarPlay = () => comando(aTocar ? 'pauseVideo' : 'playVideo');

  // Mensagens do leitor: estado (a tocar/pausa) e tempo. Num clipe, ao
  // passar o fim (ou se por algum motivo saltar para fora), volta ao
  // início do corte e continua.
  useEffect(() => {
    if (!ehYt) return undefined;
    const aoMsg = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return;
      const win = iframeRef.current && iframeRef.current.contentWindow;
      if (win && event.source !== win) return;
      let data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data) return;
      if (data.event === 'onStateChange' && typeof data.info === 'number') {
        setATocar(data.info === 1 || data.info === 3);
        // Terminou (estado 0) dentro de um clipe: recomeça o corte.
        if (ehClipe && data.info === 0) { irPara(inicio); comando('playVideo'); }
      }
      if (data.event === 'infoDelivery' && data.info) {
        if (typeof data.info.playerState === 'number') setATocar(data.info.playerState === 1 || data.info.playerState === 3);
        const t = data.info.currentTime;
        if (typeof t === 'number') {
          if (!ehClipe) { setTempo(t); return; }
          const aSaltar = Date.now() - saltoRef.current < 800;
          if (!aSaltar && (t >= fim - 0.15 || t < inicio - 0.5)) { irPara(inicio); comando('playVideo'); }
          else setTempo(Math.min(fim, Math.max(inicio, t)));
        }
      }
    };
    window.addEventListener('message', aoMsg);
    return () => window.removeEventListener('message', aoMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehYt, ehClipe, inicio, fim]);

  const aoCarregar = () => {
    if (!ehYt) return;
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  };

  // Ao fechar com o ecrã inteiro ligado, sai primeiro dele.
  const fechar = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) { /* nada */ }
    onClose();
  };
  // Gesto de retroceder no Portal: sai do ecrã inteiro ou fecha.
  useKioskVoltar(true, () => { if (cheioCss) setCheioCss(false); else fechar(); });

  useEffect(() => {
    const aoMudar = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      setCheio(!!el && el === caixaRef.current);
    };
    document.addEventListener('fullscreenchange', aoMudar);
    document.addEventListener('webkitfullscreenchange', aoMudar);
    const aoTecla = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) { if (cheioCss) setCheioCss(false); else onClose(); } };
    window.addEventListener('keydown', aoTecla);
    return () => {
      document.removeEventListener('fullscreenchange', aoMudar);
      document.removeEventListener('webkitfullscreenchange', aoMudar);
      window.removeEventListener('keydown', aoTecla);
    };
  }, [cheioCss, onClose]);

  const alternarEcra = () => {
    if (cheio) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    if (cheioCss) { setCheioCss(false); return; }
    const el = caixaRef.current;
    const pedir = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (pedir) {
      try {
        const r = pedir.call(el);
        if (r && typeof r.catch === 'function') r.catch(() => setCheioCss(true));
      } catch (e) { setCheioCss(true); }
    } else {
      setCheioCss(true);
    }
  };

  // O endereço não muda enquanto o visualizador está aberto (senão o
  // vídeo recomeçava). `fs=0`: o ecrã inteiro é sempre o nosso, com lupa.
  const fonte = React.useMemo(() => {
    if (!ehYt) return socialEmbedSrc(item.social);
    const bits = [`rel=0`, `playsinline=1`, `enablejsapi=1`, `fs=0`, `autoplay=1`, `iv_load_policy=3`];
    if (ehClipe) bits.push(`start=${Math.floor(inicio)}`, 'controls=0', 'disablekb=1');
    return `https://www.youtube.com/embed/${item.youtubeId}?${bits.join('&')}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  const externo = ehYt ? `https://www.youtube.com/watch?v=${item.youtubeId}` : socialExternalUrl(item.social);
  const vertical = !!item.social;

  const btn = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 };
  const posBarra = aArrastarBarra != null ? aArrastarBarra : Math.max(0, tempo - inicio);

  return createPortal(
    <div
      onClick={fechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        ref={caixaRef}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden',
          ...(emCheio
            ? { position: cheioCss ? 'fixed' : 'relative', inset: cheioCss ? 0 : undefined, zIndex: 9001, width: cheioCss ? '100vw' : '100%', height: cheioCss ? '100dvh' : '100%', borderRadius: 0, paddingBottom: cheioCss ? 'env(safe-area-inset-bottom, 0px)' : 0, boxSizing: 'border-box' }
            : {
                width: vertical ? 'min(100%, calc((100dvh - 160px) * 0.5625))' : 'min(100%, 1280px, calc((100dvh - 160px) * 1.7778))',
                borderRadius: 12, border: `1px solid ${T.line}`,
              }),
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
          background: '#111', borderBottom: `1px solid ${T.line}`, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...body }}>
              {item.title || item.fileName || 'Vídeo'}
            </div>
            {item.jornada && <div style={{ fontSize: 11.5, color: T.mutedDim, ...body }}>{item.jornada}</div>}
          </div>
          <button onClick={alternarEcra} title={emCheio ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#fff', ...body,
            background: 'rgba(255,255,255,.08)', border: `1px solid ${T.line}`, borderRadius: 8, padding: '7px 11px', cursor: 'pointer', flexShrink: 0,
          }}>
            {emCheio ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {emCheio ? 'Sair' : 'Ecrã inteiro'}
          </button>
          <button onClick={fechar} aria-label="Fechar" title="Fechar" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, flexShrink: 0,
            background: 'rgba(255,255,255,.08)', border: `1px solid ${T.line}`, borderRadius: 8, color: '#fff', cursor: 'pointer',
          }}><X size={16} /></button>
        </div>

        <div ref={areaRef} style={{
          position: 'relative', overflow: 'hidden',
          ...(emCheio ? { flex: 1, minHeight: 0 } : { paddingTop: vertical ? '177.78%' : '56.25%' }),
        }}>
          {fonte ? (
            <div style={{
              position: 'absolute', inset: 0,
              transform: lupa.transform || 'none', transformOrigin: '0 0',
              transition: lupa.aArrastar ? 'none' : 'transform 0.2s ease-out',
            }}>
              <iframe
                ref={iframeRef}
                onLoad={aoCarregar}
                src={fonte}
                title={item.title || 'vídeo'}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                playsInline
                sandbox={item.social && item.social.platform === 'instagram' ? INSTAGRAM_SANDBOX : undefined}
              />
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mutedDim, fontSize: 13 }}>
              Não foi possível abrir este vídeo aqui.
            </div>
          )}
          {/* Clipe fora do ecrã inteiro: um toque no vídeo pausa/retoma
              (o leitor sem controlos não deixa sair do corte). */}
          {ehClipe && !emCheio && (
            <div onClick={alternarPlay} style={{ position: 'absolute', inset: 0, zIndex: 4, cursor: 'pointer' }} />
          )}
          {/* LUPA em ecrã inteiro: camada que apanha a pinça, a roda e o
              arrastar; um toque pausa/retoma. Num vídeo completo, a 100%,
              deixa livre a faixa de baixo com a barra do YouTube. */}
          {ehYt && emCheio && (
            <div {...lupa.handlers(alternarPlay)} style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              bottom: !ehClipe && lupa.lupa.z <= 1 ? '18%' : 0,
              zIndex: 5, touchAction: 'none',
              cursor: lupa.lupa.z > 1 ? (lupa.aArrastar ? 'grabbing' : 'grab') : 'pointer',
            }} />
          )}
          {ehYt && emCheio && <ControlosLupa {...lupa} />}
        </div>

        {/* BARRA DO CLIPE: só anda dentro do corte. */}
        {ehClipe && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
            <button onClick={alternarPlay} title={aTocar ? 'Pausar' : 'Reproduzir'} style={btn}>
              {aTocar ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={() => irPara(inicio)} title="Voltar ao início do corte" style={btn}><RotateCcw size={16} /></button>
            <input
              type="range" min={0} max={duracao} step={0.1} value={posBarra}
              onChange={e => { const v = Number(e.target.value); setAArrastarBarra(v); irPara(inicio + v); }}
              onPointerUp={() => setAArrastarBarra(null)}
              onTouchEnd={() => setAArrastarBarra(null)}
              onKeyUp={() => setAArrastarBarra(null)}
              aria-label="Posição no corte"
              style={{ flex: 1, minWidth: 0, accentColor: T.gold, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>
              {fmtMMSS(posBarra)} / {fmtMMSS(duracao)}
            </span>
          </div>
        )}

        {externo && !emCheio && !ehClipe && (
          <div style={{ padding: '8px 12px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
            <a href={externo} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: T.mutedDim, textDecoration: 'none', ...body,
            }}><ExternalLink size={12} /> Abrir original</a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

