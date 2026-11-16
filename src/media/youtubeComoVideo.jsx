// src/media/youtubeComoVideo.jsx
//
// O YOUTUBE A FAZER DE <video>.
//
// O editor da Análise (e o leitor dos cortes) foi feito à volta de um
// <video>: lê e muda `currentTime`, `paused`, `duration`, `playbackRate`,
// chama `play()`/`pause()` e ouve 'timeupdate', 'play', 'pause',
// 'loadedmetadata', 'seeking'… Para um jogo por link do YouTube, em vez de
// reescrever o editor, o próprio <iframe> do YouTube passa a ter essas
// propriedades e a disparar esses eventos (é um elemento do DOM a sério:
// ResizeObserver, clientWidth, offsetLeft continuam a funcionar).
//
// Fala com o leitor do YouTube por postMessage ('listening' / 'command' /
// 'infoDelivery'), sem o script oficial (fica bloqueado em alguns sítios).
//
// `inicio`/`fim` (opcionais): um CORTE dentro do jogo. O tempo 0 do
// "vídeo" é o `inicio` no YouTube, a duração é fim − inicio, e ao chegar ao
// fim pára e dispara 'ended' — como o ficheiro de um corte.
//
// O que NÃO dá: ler a imagem (desenhar o vídeo num canvas). Por isso, num
// link, não há Seguir jogador nem gravar MP4 com os desenhos.

import React, { useCallback, useEffect, useRef } from 'react';

const ESTADO_A_TOCAR = 1;
const ESTADO_A_CARREGAR = 3;

export function srcYoutubeEditor(youtubeId, inicio = 0) {
  const base = (typeof window !== 'undefined' && window.__MJP_YT_EMBED) || 'https://www.youtube.com/embed/';
  const origem = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
  return `${base}${encodeURIComponent(youtubeId)}?enablejsapi=1&controls=0&disablekb=1&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&fs=0&start=${Math.max(0, Math.floor(inicio || 0))}&origin=${origem}`;
}

/* Transforma o iframe num "vídeo". Devolve a função que desliga tudo. */
export function ligarYoutubeComoVideo(iframe, { inicio = 0, fim = null, autoPlay = false } = {}) {
  const off = Math.max(0, Number(inicio) || 0);
  const limite = Number.isFinite(Number(fim)) && Number(fim) > off ? Number(fim) : null;
  const st = {
    t: off, tEm: performance.now(), aTocar: false, taxa: 1, dur: 0, pronto: false,
    procurando: false, mudo: false, preparar: null, // preparar: tempo (pode ser 0) a que voltar desligado: false, iniciou: false,
  };
  const enviar = (func, args = []) => {
    const w = iframe.contentWindow;
    if (!w) return;
    try { w.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch (e) { /* iframe a fechar */ }
  };
  const disparar = (nome) => { try { iframe.dispatchEvent(new Event(nome)); } catch (e) { /* nada */ } };
  // Tempo atual NO YOUTUBE (estimado entre mensagens enquanto toca).
  const agoraYt = () => (st.aTocar ? st.t + ((performance.now() - st.tEm) / 1000) * st.taxa : st.t);
  const durTotal = () => (limite != null ? limite - off : Math.max(0, st.dur - off));

  const props = {
    currentTime: {
      get: () => Math.max(0, Math.min(durTotal() || Infinity, agoraYt() - off)),
      set: (v) => {
        const alvo = off + Math.max(0, Number(v) || 0);
        st.t = limite != null ? Math.min(alvo, limite) : alvo; st.tEm = performance.now();
        st.procurando = true; disparar('seeking');
        enviar('seekTo', [st.t, true]);
        setTimeout(() => { st.procurando = false; disparar('seeked'); disparar('timeupdate'); }, 60);
      },
    },
    duration: { get: () => durTotal() || NaN },
    paused: { get: () => !st.aTocar },
    ended: { get: () => limite != null && agoraYt() >= limite - 0.05 },
    seeking: { get: () => st.procurando },
    readyState: { get: () => (st.pronto ? 4 : 0) },
    videoWidth: { get: () => 1280 },
    videoHeight: { get: () => 720 },
    playbackRate: {
      get: () => st.taxa,
      set: (v) => { st.t = agoraYt(); st.tEm = performance.now(); st.taxa = Number(v) || 1; enviar('setPlaybackRate', [st.taxa]); disparar('ratechange'); },
    },
    muted: { get: () => st.mudo, set: (v) => { st.mudo = !!v; enviar(v ? 'mute' : 'unMute'); } },
    volume: { get: () => 1, set: () => {} },
    play: {
      value: () => {
        // No fim do corte, play recomeça do início (como um <video>).
        if (limite != null && agoraYt() >= limite - 0.05) { st.t = off; enviar('seekTo', [off, true]); }
        st.t = agoraYt(); st.tEm = performance.now();
        if (!st.aTocar) { st.aTocar = true; disparar('play'); disparar('playing'); }
        enviar('playVideo');
        return Promise.resolve();
      },
    },
    pause: {
      value: () => {
        st.t = agoraYt(); st.tEm = performance.now();
        enviar('pauseVideo');
        if (st.aTocar) { st.aTocar = false; disparar('pause'); }
      },
    },
    load: { value: () => {} },
    ehYoutube: { value: true },
  };
  Object.entries(props).forEach(([k, d]) => { try { Object.defineProperty(iframe, k, { configurable: true, ...d }); } catch (e) { /* nada */ } });

  // Mensagens do leitor.
  const aoReceber = (event) => {
    if (event.source !== iframe.contentWindow) return;
    let data = event.data;
    try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch { return; }
    if (!data || !data.event) return;
    if (data.event === 'onReady') { st.pronto = true; }
    if (data.event === 'onStateChange' && typeof data.info === 'number') estado(data.info);
    if ((data.event === 'infoDelivery' || data.event === 'initialDelivery') && data.info) {
      const i = data.info;
      if (typeof i.duration === 'number' && i.duration > 0 && !(st.dur > 0)) {
        st.dur = i.duration;
        st.pronto = true;
        disparar('loadedmetadata'); disparar('durationchange'); disparar('resize'); disparar('canplay');
        if (st.preparar != null) {
          // Já se sabe a duração: pára, volta ao sítio e devolve o som.
          const alvo = st.preparar; st.preparar = null;
          enviar('pauseVideo'); enviar('seekTo', [alvo, true]); if (!st.mudo) enviar('unMute');
          st.aTocar = false; st.t = alvo; st.tEm = performance.now();
          if (autoPlay) setTimeout(() => iframe.play(), 120);
          return;
        }
      }
      if (typeof i.currentTime === 'number' && !st.procurando) { st.t = i.currentTime; st.tEm = performance.now(); }
      if (typeof i.playbackRate === 'number' && i.playbackRate > 0) st.taxa = i.playbackRate;
      if (typeof i.playerState === 'number' && st.preparar == null) estado(i.playerState);
    }
  };
  const estado = (n) => {
    if (st.preparar != null) return;
    const toca = n === ESTADO_A_TOCAR || n === ESTADO_A_CARREGAR;
    if (toca !== st.aTocar) { st.t = agoraYt(); st.tEm = performance.now(); st.aTocar = toca; disparar(toca ? 'play' : 'pause'); }
    if (n === 0 && limite == null) disparar('ended');
  };
  window.addEventListener('message', aoReceber);

  // Relógio: 'timeupdate' e o fim do corte.
  const relogio = setInterval(() => {
    if (!st.aTocar) return;
    if (limite != null && agoraYt() >= limite) {
      st.t = limite; st.tEm = performance.now();
      enviar('pauseVideo'); st.aTocar = false;
      disparar('timeupdate'); disparar('pause'); disparar('ended');
      return;
    }
    disparar('timeupdate');
  }, 100);

  // Handshake, e "preparar": o YouTube só diz a duração depois de tocar.
  const aoCarregar = () => {
    const w = iframe.contentWindow;
    if (!w) return;
    const hs = () => { try { w.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) { /* nada */ } };
    hs(); setTimeout(hs, 300); setTimeout(hs, 1000);
    setTimeout(() => {
      if (st.desligado || st.dur > 0) return;
      st.preparar = off;
      enviar('mute'); enviar('playVideo');
      setTimeout(() => { if (st.preparar != null) { st.preparar = null; enviar('pauseVideo'); if (!st.mudo) enviar('unMute'); } }, 6000);
    }, 700);
  };
  iframe.addEventListener('load', aoCarregar);
  disparar('loadstart');

  return () => {
    st.desligado = true;
    clearInterval(relogio);
    window.removeEventListener('message', aoReceber);
    iframe.removeEventListener('load', aoCarregar);
  };
}

/* O componente: um iframe do YouTube que fica em `videoRef.current` como
   se fosse um <video>. Uma camada por cima apanha os toques (o YouTube não
   mostra os seus menus) e põe a tocar / em pausa. */
export function YoutubeComoVideo({ youtubeId, videoRef, inicio = 0, fim = null, autoPlay = false, style, onLoadStart, onCanPlay, onClick, camadaToques = true }) {
  const ifr = useRef(null);
  const chamadas = useRef({ onLoadStart, onCanPlay });
  chamadas.current = { onLoadStart, onCanPlay };
  // Ligar no ref (antes dos efeitos dos pais, que já leem videoRef.current).
  const desligarRef = useRef(null);
  // useCallback: um ref "novo" a cada render faria o React desligar e voltar
  // a ligar o leitor sempre que o editor se redesenha.
  const aoMontar = useCallback((el) => {
    if (desligarRef.current) { desligarRef.current(); desligarRef.current = null; }
    ifr.current = el;
    if (el) {
      desligarRef.current = ligarYoutubeComoVideo(el, { inicio, fim, autoPlay });
      const pronto = () => { if (chamadas.current.onCanPlay) chamadas.current.onCanPlay(); };
      el.addEventListener('canplay', pronto);
      if (chamadas.current.onLoadStart) chamadas.current.onLoadStart();
    }
    if (videoRef) videoRef.current = el;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId, inicio, fim]);
  useEffect(() => () => { if (desligarRef.current) desligarRef.current(); }, []);
  return (
    <>
      <iframe key={`${youtubeId}:${inicio}:${fim}`} ref={aoMontar} src={srcYoutubeEditor(youtubeId, inicio)} title="Vídeo do YouTube"
        allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
        style={{ border: 0, width: '100%', height: '100%', display: 'block', ...style }} />
      {camadaToques && (
        <div aria-hidden onClick={(e) => {
          if (onClick) { onClick(e); return; }
          const v = ifr.current; if (v && v.play) { if (v.paused) v.play(); else v.pause(); }
        }} style={{ position: 'absolute', inset: 0, background: 'transparent' }} />
      )}
    </>
  );
}
