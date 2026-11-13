// media/LeitorJunto.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { escolherPartilha } from '../base/escolherPartilha';
import React, { useRef, useState, useEffect } from 'react';
import { T, body, mono, TEXT_ON_ACCENT } from '../base/tema';
import { Pause, Play, RotateCcw, X, Minimize2, Maximize2, Film, Plus, Pencil, Share2, Download, Trash2, Loader2, Check } from 'lucide-react';
import { uid } from '../base/utilidades';
import { Btn, Input } from '../base/ui';
import { ControlosLupa, URL_PUBLICA_APP, fmtMMSS, linkDoVideoJunto, useLupa } from './social';
import { gravarCompilacoes, lerCompilacoes, mmss } from './organizacao';

/* LEITOR "VÍDEO JUNTO" — vários clipes num SÓ leitor, com UMA barra.

   Usado no lugar do leitor da Biblioteca quando o jogador abre um dos
   "Os meus vídeos": mesmo aspeto (barra amarela, -2s/+2s, tempo, Ecrã
   inteiro), mas a barra vai de 0 ao total de todos os clipes, com uma
   risca onde cada um começa.

   COMO A PASSAGEM FICA CONTÍNUA (afinado em out/2026 com o treinador,
   com um diagnóstico no ecrã que já foi retirado):
   · UM LEITOR DO YOUTUBE POR CLIPE, todos carregados LOGO ao abrir, cada
     um parado (sem som) uns segundos antes do início do seu clipe. Ficam
     uns por cima dos outros; só o do clipe atual se vê.
     (Com só dois leitores, o de trás tinha de carregar o clipe seguinte
     DURANTE a reprodução — e isso roubava rede ao da frente, que
     encravava 10+ s. Carregar tudo antes de começar evita isso.)
   · ARRANQUE ESCONDIDO: PRE_ROLL segundos antes do fim do clipe atual, o
     leitor do seguinte começa a tocar sem som e invisível, alinhado para
     chegar ao início exato quando o atual acaba. O título, o círculo e o
     símbolo de play do YouTube passam aí, escondidos. Na troca só se
     muda qual se vê e liga-se o som — sem saltar.
   · Clipes que começam nos primeiros segundos do vídeo (não há PRE_ROLL
     segundos antes): o escondido arranca na mesma PRE_ROLL segundos antes
     da troca, do início do vídeo — e entra ADIANTADO (o clipe entra até
     PRE_ROLL s depois do início dele). Testado: recuar para acertar
     (seekTo) faz o YouTube voltar a mostrar o título e o símbolo; câmara
     lenta encravava ao voltar ao normal; começar mais tarde deixava o
     símbolo. Entrar uns segundos depois é a única forma limpa.
   · O leitor escondido nunca fica 100% transparente (opacidade 0,01):
     tapado por completo dava ecrã preto; transparente a 100% nem sempre
     avança. */
export const PRE_ROLL_JUNTO = 5;

export function LeitorJunto({ segmentos, titulo, onFechar, isNarrow }) {
  /* Clipes (do 2.º em diante) que começam nos primeiros PRE_ROLL s do
     vídeo entram PRE_ROLL s depois (ver acima). A barra conta-os a partir
     daí — senão saltava esses segundos na passagem. */
  /* Segmentos do YouTube (`youtubeId`) ou de vídeos carregados (`src`,
     link do ficheiro): o mesmo leitor, com um <video> no lugar do iframe.
     O ajuste dos clipes do início do vídeo só é preciso no YouTube. */
  const segs = React.useMemo(() => (segmentos || [])
    .filter(s => s && (s.youtubeId || s.src) && s.fim > s.inicio)
    .map((s, k) => (s.youtubeId && k > 0 && s.inicio < PRE_ROLL_JUNTO && s.fim - 0.5 > s.inicio
      ? { ...s, inicio: Math.min(PRE_ROLL_JUNTO, s.fim - 0.5) } : s)), [segmentos]);
  const durs = segs.map(s => s.fim - s.inicio);
  const offs = durs.reduce((acc, d, k) => { acc.push(k ? acc[k - 1] + durs[k - 1] : 0); return acc; }, []);
  const total = durs.reduce((t, d) => t + d, 0);
  const parqueDe = (k) => Math.max(0, segs[k].inicio - PRE_ROLL_JUNTO);

  const iframesRef = useRef([]);
  const caixaRef = useRef(null);
  const [vis, setVis] = useState(0);
  const [local, setLocal] = useState(segs[0] ? segs[0].inicio : 0);
  const [aTocar, setATocar] = useState(false);
  const [ecraInteiro, setEcraInteiro] = useState(false);
  // Ecrã inteiro "à mão" (iPhone: sem ecrã inteiro do browser) — e se o
  // telemóvel estiver ao alto, roda-se o leitor para ocupar o ecrã deitado.
  const [deitarCss, setDeitarCss] = useState(false);
  const areaRef = useRef(null);
  const lupa = useLupa(areaRef, ecraInteiro && !deitarCss);
  /* PREENCHER O ECRÃ: num telemóvel deitado o ecrã é mais comprido do que
     16:9 e o vídeo ficava com barras pretas dos lados. Em ecrã inteiro,
     amplia-se o vídeo até encher a largura (corta um pouco em cima e em
     baixo, como as apps de vídeo fazem no telemóvel). */
  const [encher, setEncher] = useState(1);
  useEffect(() => {
    if (!ecraInteiro) { setEncher(1); return undefined; }
    const medir = () => {
      const el = areaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = deitarCss ? r.height : r.width;
      const h = deitarCss ? r.width : r.height;
      if (!w || !h) return;
      const asp = w / h;
      setEncher(asp > 16 / 9 ? asp / (16 / 9) : 1);
    };
    const t = setTimeout(medir, 150);
    window.addEventListener('resize', medir);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); };
  }, [ecraInteiro, deitarCss]);
  // BARRA SEM SALTOS: o YouTube só diz o tempo ~4 vezes por segundo; entre
  // avisos, a barra avança sozinha ao ritmo do relógio.
  const ultimoRef = useRef({ t: segmentos && segmentos[0] ? segmentos[0].inicio : 0, quando: Date.now() });
  const [, setQuadro] = useState(0);
  const n = segs.length;
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = {
      vis: 0, salto: 0, aTocar: false, comecou: false,
      pronto: Array(n).fill(false), aRodar: Array(n).fill(false), tempo: Array(n).fill(0), estado: Array(n).fill(null),
      alinhado: Array(n).fill(false),
    };
  }
  useEffect(() => { ref.current.aTocar = aTocar; }, [aTocar]);
  useEffect(() => {
    if (!aTocar) return undefined;
    let id = 0;
    const passo = () => { setQuadro(x => (x + 1) % 1000000); id = requestAnimationFrame(passo); };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [aTocar]);
  const marcarLocal = (t) => { ultimoRef.current = { t, quando: Date.now() }; setLocal(t); };

  const cmd = (k, func, args) => {
    const el = iframesRef.current[k];
    if (el && el.tagName === 'VIDEO') {
      try {
        if (func === 'mute') el.muted = true;
        else if (func === 'unMute') el.muted = false;
        else if (func === 'seekTo') el.currentTime = Math.max(0, Number(args && args[0]) || 0);
        else if (func === 'playVideo') { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
        else if (func === 'pauseVideo') el.pause();
      } catch (e) { /* nada */ }
      return;
    }
    const win = el && el.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  };
  // Parado, sem som, no ponto de espera do clipe k (para o arranque escondido).
  const estacionar = (k) => {
    if (k < 0 || k >= n) return;
    const r = ref.current;
    r.aRodar[k] = false;
    cmd(k, 'mute'); cmd(k, 'seekTo', [parqueDe(k), true]);
    setTimeout(() => { if (ref.current.vis !== k && !ref.current.aRodar[k]) cmd(k, 'pauseVideo'); }, 500);
  };
  const mostrar = (k) => { ref.current.vis = k; setVis(k); };

  // Tocar o clipe k a partir do segundo t (início, ou um salto na barra).
  const tocarEm = (k, t, tocar) => {
    const r = ref.current;
    const antigo = r.vis;
    r.salto = Date.now();
    r.comecou = true;
    if (antigo !== k) { cmd(antigo, 'pauseVideo'); cmd(antigo, 'mute'); }
    mostrar(k);
    marcarLocal(t);
    r.aRodar[k] = false;
    cmd(k, 'unMute'); cmd(k, 'seekTo', [t, true]);
    if (tocar) cmd(k, 'playVideo'); else setTimeout(() => cmd(k, 'pauseVideo'), 300);
    if (k + 1 < n && r.aRodar[k + 1]) estacionar(k + 1);
  };
  // Fim do clipe atual: troca para o seguinte, que já vem a tocar escondido.
  const avancar = () => {
    const r = ref.current;
    const k = r.vis + 1;
    if (k >= n) {
      cmd(r.vis, 'pauseVideo');
      tocarEm(0, segs[0].inicio, false);
      return;
    }
    const antigo = r.vis;
    const tp = r.tempo[k];
    // Clipes do início do vídeo vêm adiantados (até PRE_ROLL s): entram aí.
    const jaNoSitio = r.aRodar[k] && tp >= segs[k].inicio - 1.5 && tp <= Math.max(segs[k].inicio, PRE_ROLL_JUNTO) + 1;
    r.salto = Date.now();
    mostrar(k);
    marcarLocal(jaNoSitio ? Math.max(segs[k].inicio, tp) : segs[k].inicio);
    cmd(k, 'unMute');
    if (!jaNoSitio) {
      cmd(k, 'seekTo', [segs[k].inicio, true]);
      // Se já vem a tocar, basta acertar a posição (sem "play", que mostrava o símbolo).
      if (!r.aRodar[k]) cmd(k, 'playVideo');
    }
    r.aRodar[k] = false;
    cmd(antigo, 'pauseVideo'); cmd(antigo, 'mute');
  };
  const irParaGlobal = (g) => {
    const gg = Math.max(0, Math.min(total - 0.05, g));
    let k = 0;
    while (k < n - 1 && gg >= offs[k] + durs[k]) k++;
    tocarEm(k, segs[k].inicio + (gg - offs[k]), ref.current.aTocar);
  };

  useEffect(() => {
    const onMessage = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return;
      const k = iframesRef.current.findIndex(el => el && event.source === el.contentWindow);
      if (k < 0) return;
      let data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data) return;
      const r = ref.current;
      if (data.event === 'infoDelivery' && data.info) {
        if (typeof data.info.currentTime === 'number') r.tempo[k] = data.info.currentTime;
        if (typeof data.info.playerState === 'number') r.estado[k] = data.info.playerState;
      }
      if (data.event === 'onStateChange' && typeof data.info === 'number') r.estado[k] = data.info;
      processarTempo(k, data.event === 'infoDelivery' && data.info && typeof data.info.currentTime === 'number' ? data.info.currentTime : null);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentos]);

  /* O que acontece a cada leitura de tempo do leitor k (vem das mensagens
     do YouTube, ou dos eventos do <video> nos vídeos carregados). */
  const processarTempo = (k, t) => {
      const r = ref.current;
      if (k !== r.vis) return; // os outros só esperam
      if (typeof r.estado[k] === 'number') setATocar(r.estado[k] === 1 || r.estado[k] === 3);
      if (t == null) return;
      const seg = segs[k];
      const aSaltar = Date.now() - r.salto < 900;
      // ARRANQUE ESCONDIDO do seguinte, alinhado com o fim deste.
      const prox = k + 1;
      if (!aSaltar && prox < n && r.pronto[prox] && !r.aRodar[prox] && r.estado[k] === 1
        && t >= seg.fim - PRE_ROLL_JUNTO && t < seg.fim - 0.12) {
        const falta = seg.fim - t;
        const pos = segs[prox].inicio - falta;
        r.aRodar[prox] = true;
        r.alinhado[prox] = pos >= 0; // no início do vídeo não dá: vai adiantado
        cmd(prox, 'mute');
        cmd(prox, 'seekTo', [Math.max(0, pos), true]);
        cmd(prox, 'playVideo');
      }
      if (!aSaltar && t >= seg.fim - 0.12) avancar();
      else if (!aSaltar && t < seg.inicio - 1.6) cmd(k, 'seekTo', [seg.inicio, true]);
      else marcarLocal(Math.min(seg.fim, Math.max(seg.inicio, t)));
  };
  // Vídeos carregados: os eventos do <video> fazem o papel das mensagens.
  const doVideo = (k, el) => {
    if (!el) return;
    const r = ref.current;
    r.tempo[k] = el.currentTime;
    r.estado[k] = el.paused ? 2 : (el.readyState < 3 ? 3 : 1);
    processarTempo(k, el.currentTime);
  };
  // A tocar, lê-se o vídeo visível a cada 100 ms (o 'timeupdate' é de ~¼ s).
  useEffect(() => {
    if (!aTocar) return undefined;
    const h = setInterval(() => {
      const k = ref.current.vis;
      const el = iframesRef.current[k];
      if (el && el.tagName === 'VIDEO') doVideo(k, el);
    }, 100);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aTocar]);

  const aoCarregar = (k) => {
    const el = iframesRef.current[k];
    if (el && el.tagName !== 'VIDEO') {
      const win = el.contentWindow;
      if (!win) return;
      win.postMessage(JSON.stringify({ event: 'listening', id: k + 1, channel: 'widget' }), '*');
    } else if (el) {
      try { el.currentTime = k === 0 ? segs[0].inicio : parqueDe(k); } catch (e) { /* nada */ }
    }
    setTimeout(() => {
      ref.current.pronto[k] = true;
      // Ao carregar em "Ver", o vídeo começa logo a tocar.
      if (k === 0 && !ref.current.comecou) tocarEm(0, segs[0].inicio, true);
      else if (k !== ref.current.vis) estacionar(k);
    }, 350);
  };

  useEffect(() => {
    const aoMudar = () => setEcraInteiro(!!caixaRef.current && document.fullscreenElement === caixaRef.current);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);
  /* ECRÃ INTEIRO DEITADO: no Android pede-se ecrã inteiro e trava-se o
     ecrã na horizontal; no iPhone (sem ecrã inteiro para páginas) ocupa a
     janela e, se o telemóvel estiver ao alto, roda-se o leitor 90°. */
  const alternarEcra = () => {
    const el = caixaRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nada */ }
      if (document.exitFullscreen) document.exitFullscreen();
      return;
    }
    if (ecraInteiro) { setEcraInteiro(false); setDeitarCss(false); return; }
    const aMao = () => { setEcraInteiro(true); setDeitarCss(window.innerHeight > window.innerWidth); };
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => {
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ }
      }).catch(aMao);
    } else aMao();
  };
  useEffect(() => {
    if (!ecraInteiro || document.fullscreenElement) return undefined;
    const aoRodar = () => setDeitarCss(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', aoRodar);
    return () => window.removeEventListener('resize', aoRodar);
  }, [ecraInteiro]);

  if (!n) return <div style={{ fontSize: 12.5, color: T.mutedDim, padding: 10 }}>Os clipes deste vídeo já não existem.</div>;
  const seg = segs[vis] || segs[0];
  const localSuave = aTocar ? Math.min(seg.fim, ultimoRef.current.t + (Date.now() - ultimoRef.current.quando) / 1000) : local;
  const global = offs[vis] + Math.max(0, Math.min(seg.fim, localSuave) - seg.inicio);
  const btn = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0 };
  const cssInteiro = !ecraInteiro || document.fullscreenElement ? {}
    : deitarCss
      ? { position: 'fixed', top: 0, left: 0, width: '100vh', height: '100vw', transform: 'rotate(90deg) translateY(-100%)', transformOrigin: 'top left', zIndex: 80, borderRadius: 0 }
      : { position: 'fixed', inset: 0, zIndex: 80, borderRadius: 0 };
  const alternarPlay = () => {
    const r = ref.current;
    if (aTocar) { cmd(r.vis, 'pauseVideo'); return; }
    if (!r.comecou) { tocarEm(0, segs[0].inicio, true); return; }
    cmd(r.vis, 'unMute'); cmd(r.vis, 'playVideo');
  };
  const prontos = ref.current.pronto.filter(Boolean).length;

  return (
    <div>
      <div ref={caixaRef} style={{ position: 'relative', overflow: 'hidden', background: '#000', display: 'flex', flexDirection: 'column', borderRadius: 8, ...(ecraInteiro ? { height: '100%' } : {}), ...cssInteiro }}>
        <div ref={areaRef} style={{ position: 'relative', width: '100%', overflow: 'hidden', ...(ecraInteiro ? { flex: 1, minHeight: 0 } : { paddingTop: '56.25%' }) }}>
          {/* LUPA (ecrã inteiro): pinça, roda do rato e arrastar, como nos clipes. */}
          <div style={{ position: 'absolute', inset: 0, transform: lupa.transform || 'none', transformOrigin: '0 0', transition: lupa.aArrastar ? 'none' : 'transform 0.2s ease-out' }}>
          <div style={{ position: 'absolute', inset: 0, transform: encher > 1.001 ? `scale(${encher})` : 'none', transformOrigin: '50% 50%' }}>
          {segs.map((s, k) => (s.src && !s.youtubeId ? (
            <video
              key={k} ref={el => { iframesRef.current[k] = el; }} title={`${titulo || 'O meu vídeo'} ${k + 1}`}
              src={s.src} playsInline preload="auto" muted={k !== 0}
              onLoadedMetadata={() => aoCarregar(k)}
              onTimeUpdate={e => doVideo(k, e.currentTarget)}
              onPlay={e => doVideo(k, e.currentTarget)} onPause={e => doVideo(k, e.currentTarget)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000', opacity: vis === k ? 1 : 0.01, pointerEvents: 'none', zIndex: vis === k ? 1 : 0 }}
            />
          ) : (
            <iframe
              key={k} ref={el => { iframesRef.current[k] = el; }} onLoad={() => aoCarregar(k)} title={`${titulo || 'O meu vídeo'} ${k + 1}`}
              src={`https://www.youtube.com/embed/${s.youtubeId}?start=${Math.floor(k === 0 ? s.inicio : parqueDe(k))}&rel=0&playsinline=1&controls=0&disablekb=1&enablejsapi=1&fs=0&iv_load_policy=3${k === 0 ? '' : '&mute=1'}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, opacity: vis === k ? 1 : 0.01, pointerEvents: 'none', zIndex: vis === k ? 1 : 0 }}
            />
          )))}
          </div>
          </div>
          {prontos < n && !ref.current.comecou && (
            <div style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 3, background: '#000a', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 10, pointerEvents: 'none', ...body }}>
              A preparar {prontos}/{n}…
            </div>
          )}
          {/* Toque no vídeo = pausar / retomar (os leitores não recebem toques).
              Em ecrã inteiro a mesma camada também faz a lupa. */}
          {ecraInteiro && !deitarCss
            ? <div {...lupa.handlers(alternarPlay)} style={{ position: 'absolute', inset: 0, zIndex: 4, touchAction: 'none', cursor: lupa.lupa.z > 1 ? (lupa.aArrastar ? 'grabbing' : 'grab') : 'pointer' }} />
            : <div onClick={alternarPlay} style={{ position: 'absolute', inset: 0, zIndex: 4, cursor: 'pointer' }} />}
          {ecraInteiro && !deitarCss && <ControlosLupa {...lupa} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? 6 : 10, padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
          <button onClick={alternarPlay} title={aTocar ? 'Pausar' : 'Reproduzir'} style={btn}>{aTocar ? <Pause size={16} /> : <Play size={16} />}</button>
          <button onClick={() => tocarEm(0, segs[0].inicio, aTocar)} title="Voltar ao início" style={btn}><RotateCcw size={14} /></button>
          {!isNarrow && <button onClick={() => irParaGlobal(global - 2)} title="Recuar 2 segundos" style={{ ...btn, fontSize: 11.5, ...mono }}>-2s</button>}
          <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <input
              type="range" min={0} max={total} step={0.1} value={Math.min(total, global)}
              onChange={e => irParaGlobal(Number(e.target.value))}
              aria-label="Posição no vídeo"
              style={{ width: '100%', accentColor: T.gold, cursor: 'pointer' }}
            />
            {offs.slice(1).map((o, k) => (
              <span key={k} style={{ position: 'absolute', top: '50%', height: 10, marginTop: -5, width: 2, left: `calc(${(o / total) * 100}% - 1px)`, background: '#fff', opacity: 0.6, pointerEvents: 'none', borderRadius: 1 }} />
            ))}
          </div>
          {!isNarrow && <button onClick={() => irParaGlobal(global + 2)} title="Avançar 2 segundos" style={{ ...btn, fontSize: 11.5, ...mono }}>+2s</button>}
          <span style={{ fontSize: 11.5, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>{fmtMMSS(global)} / {fmtMMSS(total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
          <span />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {onFechar && !ecraInteiro && (
              <button onClick={onFechar} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', ...body }}><X size={13} /> Fechar</button>
            )}
            <button onClick={alternarEcra} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', ...body }}>
              {ecraInteiro ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {ecraInteiro ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}
            </button>
          </div>
        </div>
      </div>
      {!ecraInteiro && (
        <div style={{ marginTop: 10 }}>
          {/* Só o título — sem quantos clipes tem nem qual está a tocar. */}
          <div style={{ fontSize: 16, color: T.cream, fontWeight: 600, ...body }}>{titulo}</div>
        </div>
      )}
    </div>
  );
}

export function CompilacoesAtleta({ clipes, chave, api, onVer, onParar, aTocar, onGravar, aGravar, aberto, onAbrir, onFecharAberto }) {
  /* Guardados NO SERVIDOR (api, ver os_meus_videos.sql), para aparecerem
     em qualquer aparelho. Se o servidor ainda não tiver as funções (ou não
     houver rede), guarda-se NESTE aparelho e avisa-se. Os que já estavam
     guardados no aparelho sobem para o servidor sozinhos, uma vez. */
  /* A PÁGINA NÃO PODE MEXER: a lista do servidor chega uns instantes
     depois de abrir — e o painel crescia, empurrando tudo. Mostra-se logo
     a última lista conhecida (guardada neste aparelho) e só se troca
     quando chega a do servidor; o texto de "ainda não tens vídeos" só
     aparece depois de se saber de certeza. */
  const chaveCache = `${chave}:servidor`;
  const [lista, setLista] = useState(() => { const loc = lerCompilacoes(chave); return loc.length ? loc : lerCompilacoes(`${chave}:servidor`); });
  const [carregado, setCarregado] = useState(false);
  const [noServidor, setNoServidor] = useState(false);
  const [aviso, setAviso] = useState('');
  const [editar, setEditar] = useState(null); // { id?, nome, ids }
  const [aGuardar, setAGuardar] = useState(false);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!api) { setLista(lerCompilacoes(chave)); return; }
      try {
        let doServidor = await api.ler();
        const locais = lerCompilacoes(chave);
        if (locais.length) {
          for (const v of [...locais].reverse()) {
            try { await api.guardar({ nome: v.nome, ids: v.ids }); } catch (e) { /* clipe já apagado, etc. */ }
          }
          gravarCompilacoes(chave, []);
          doServidor = await api.ler();
        }
        if (cancelado) return;
        setLista(doServidor); setNoServidor(true); setAviso(''); setCarregado(true);
      } catch (e) {
        if (cancelado) return;
        setLista(lerCompilacoes(chave)); setNoServidor(false); setCarregado(true);
        setAviso('Por agora os teus vídeos ficam guardados só neste aparelho.');
      }
    })();
    return () => { cancelado = true; };
  }, [chave, api]);
  const guardarLocal = (nova) => { setLista(nova); gravarCompilacoes(chave, nova); };
  // Cópia da lista do servidor neste aparelho, para a próxima abertura.
  useEffect(() => { if (noServidor) gravarCompilacoes(chaveCache, lista); }, [lista, noServidor, chaveCache]);
  const porId = new Map(clipes.map(c => [c.id, c]));
  const duracao = (ids) => ids.reduce((t, id) => { const c = porId.get(id); return t + (c ? Math.max(0, (c.clipFim || 0) - (c.clipInicio || 0)) : 0); }, 0);
  const validos = (ids) => (ids || []).filter(id => porId.has(id));
  const aTocarId = aTocar && lista.find(v => JSON.stringify(validos(v.ids)) === JSON.stringify(aTocar));

  const guardar = async () => {
    if (!editar || !editar.ids.length || aGuardar) return;
    const nome = (editar.nome || '').trim() || `O meu vídeo ${lista.length + 1}`;
    if (noServidor) {
      setAGuardar(true);
      try {
        const v = await api.guardar({ id: editar.id, nome, ids: editar.ids });
        setLista(prev => (editar.id ? prev.map(x => (x.id === v.id ? v : x)) : [v, ...prev]));
        setEditar(null); setAviso('');
      } catch (e) {
        setAviso('O vídeo não ficou guardado. Verifica a internet e tenta outra vez.');
      }
      setAGuardar(false);
      return;
    }
    if (editar.id) guardarLocal(lista.map(v => (v.id === editar.id ? { ...v, nome, ids: editar.ids } : v)));
    else guardarLocal([{ id: uid(), nome, ids: editar.ids, criadoEm: new Date().toISOString() }, ...lista]);
    setEditar(null);
  };
  const apagar = async (v) => {
    if (!window.confirm(`Apagar "${v.nome}"? Os clipes continuam lá.`)) return;
    if (noServidor) {
      try { await api.apagar(v.id); setLista(prev => prev.filter(x => x.id !== v.id)); } catch (e) { setAviso('Não foi possível apagar. Tenta outra vez.'); }
      return;
    }
    guardarLocal(lista.filter(x => x.id !== v.id));
  };
  const alternar = (id) => setEditar(e => ({ ...e, ids: e.ids.includes(id) ? e.ids.filter(x => x !== id) : [...e.ids, id] }));
  const mover = (i, d) => setEditar(e => {
    const ids = [...e.ids]; const j = i + d;
    if (j < 0 || j >= ids.length) return e;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return { ...e, ids };
  });
  const btnIcone = { background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 4, display: 'inline-flex' };
  /* PARTILHAR: no telemóvel abre a folha de partilha do sistema (WhatsApp,
     Instagram, Mensagens, Guardar…); no computador copia o link. O link
     leva o vídeo dentro (ver linkDoVideoJunto) — o jogador fica com ele. */
  const partilhar = async (nome, ids) => {
    const segmentos = ids.map(id => { const c = porId.get(id); return { youtubeId: c.youtubeId, src: c.clipNoFicheiro ? c.dataUrl : undefined, inicio: c.clipInicio, fim: c.clipFim, titulo: c.title }; });
    /* Link CURTO (site + nome do vídeo + 4 letras): o vídeo tem de estar no
       servidor. Se não estiver (ou o servidor ainda não tiver a função),
       usa-se o link comprido, que leva o vídeo dentro. */
    let url = null;
    const v = lista.find(x => x.nome === nome && JSON.stringify(validos(x.ids)) === JSON.stringify(ids));
    if (noServidor && api && api.partilhar && v && v.id) {
      try { const codigo = await api.partilhar(v.id); if (codigo) url = `${URL_PUBLICA_APP}?video=${encodeURIComponent(codigo)}`; } catch (e) { /* link comprido */ }
    }
    if (!url) url = linkDoVideoJunto(nome, segmentos);
    await escolherPartilha({ titulo: nome, texto: nome, url });
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: lista.length || editar ? 10 : 0 }}>
        <Film size={16} color={T.gold} />
        <span style={{ fontSize: 14, color: T.cream, fontWeight: 600, flex: 1, minWidth: 140 }}>Os meus vídeos</span>
        {!editar && (
          <Btn variant="ghost" onClick={() => setEditar({ nome: '', ids: [] })}><Plus size={14} /> Juntar clipes num vídeo</Btn>
        )}
      </div>
      {!editar && !lista.length && carregado && (
        <div style={{ fontSize: 12.5, color: T.mutedDim, lineHeight: 1.5 }}>Junta os teus clipes — do mesmo jogo ou de jogos diferentes — num vídeo só, com uma barra só, como se fosse um clipe.</div>
      )}
      {aviso && <div style={{ fontSize: 12, color: T.warn, margin: '4px 0 8px' }}>{aviso}</div>}

      {!editar && lista.map(v => {
        const ids = validos(v.ids);
        const aDar = aTocarId && aTocarId.id === v.id;
        return (
          <React.Fragment key={v.id}>
          {/* Em cima: o nome e os ícones. Em baixo: "3 clipes · 2:23" numa
              linha só, à esquerda, e Ver/Fechar à direita. Cabe em
              qualquer ecrã sem partir linhas nem mexer na página. */}
          <div style={{ padding: '8px 0', borderTop: `1px solid ${T.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome}</div>
            <button type="button" title="Editar" onClick={() => setEditar({ id: v.id, nome: v.nome, ids })} style={btnIcone}><Pencil size={14} /></button>
            <button type="button" title="Partilhar este vídeo (envia um link — abre em qualquer telemóvel, sem login)" disabled={!ids.length}
              onClick={() => partilhar(v.nome, ids)} style={{ ...btnIcone, opacity: !ids.length ? 0.4 : 1 }}><Share2 size={14} /></button>
            {onGravar && (
              <button type="button" title="Gravar este vídeo num ficheiro (computador)" disabled={!ids.length || aGravar} onClick={() => onGravar(ids, v.nome)} style={{ ...btnIcone, opacity: !ids.length || aGravar ? 0.4 : 1 }}><Download size={14} /></button>
            )}
            <button type="button" title="Apagar" onClick={() => apagar(v)} style={btnIcone}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...mono }}>{ids.length} {ids.length === 1 ? 'clipe' : 'clipes'} · {mmss(duracao(ids))}</div>
            {aberto === v.id ? (
              <Btn variant="ghost" onClick={onFecharAberto} style={{ minWidth: 96, justifyContent: 'center' }}><X size={13} /> Fechar</Btn>
            ) : (
              <Btn disabled={!ids.length} style={{ minWidth: 96, justifyContent: 'center' }} onClick={() => {
                if (aDar) onParar();
                onAbrir({
                  id: v.id, nome: v.nome,
                  segmentos: ids.map(id => { const c = porId.get(id); return { youtubeId: c.youtubeId, src: c.clipNoFicheiro ? c.dataUrl : undefined, inicio: Number(c.clipInicio), fim: Number(c.clipFim), titulo: c.title }; }),
                });
              }}><Play size={13} /> Ver</Btn>
            )}
          </div>
          </div>
          </React.Fragment>
        );
      })}

      {editar && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input value={editar.nome} onChange={e => setEditar({ ...editar, nome: e.target.value })} placeholder="Nome do vídeo (ex.: As minhas jogadas)" />
          <div style={{ fontSize: 12, color: T.muted }}>Toca nos clipes pela ordem em que os queres ver. Para mudar a ordem, toca para tirar e volta a tocar (passa para o fim).</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {clipes.map(c => {
              const pos = editar.ids.indexOf(c.id);
              const on = pos >= 0;
              return (
                <button key={c.id} type="button" onClick={() => alternar(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', ...body,
                  background: on ? `${T.gold}1F` : T.bg, border: `1px solid ${on ? T.gold : T.line}`, borderRadius: 8, padding: '8px 10px',
                }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', ...mono, fontSize: 11.5, fontWeight: 700,
                    background: on ? T.gold : 'transparent', color: on ? TEXT_ON_ACCENT : T.mutedDim, border: on ? 'none' : `1px solid ${T.line}` }}>{on ? pos + 1 : ''}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: T.mutedDim }}>{[c.clipOrigemTitulo, mmss(Math.max(0, (c.clipFim || 0) - (c.clipInicio || 0)))].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {/* Sem lista "Ordem" à parte: o número em cada clipe já é a ordem
              (tocar para tirar e voltar a tocar põe-no no fim). A lista
              aparecia/desaparecia e fazia a página saltar. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Btn disabled={!editar.ids.length || aGuardar} onClick={guardar}>{aGuardar ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Guardar vídeo</Btn>
            <Btn variant="ghost" onClick={() => setEditar(null)}>Cancelar</Btn>
            {editar.ids.length > 0 && <span style={{ fontSize: 12, color: T.mutedDim, ...mono }}>{editar.ids.length} {editar.ids.length === 1 ? 'clipe' : 'clipes'} · {mmss(duracao(editar.ids))}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

