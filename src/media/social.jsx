// media/social.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useRef, useState, useEffect } from 'react';
import { Pause, Play, RotateCcw, Minimize2, Maximize2, ExternalLink, ZoomOut, ZoomIn, VolumeX, Volume2, Instagram, Music2, Facebook } from 'lucide-react';
import { T, mono, body } from '../base/tema';
import { useKioskVoltar } from '../base/kiosk';
import { cleanFolder } from './organizacao';

/* ---------------------------------------------------------------
   FUTCHANNELYOUT — vídeos das jornadas incorporados a partir de
   um canal do YouTube (link a link, sem integração automática de
   canal — o YouTube não expõe isso sem uma API key própria).
---------------------------------------------------------------- */
export function parseYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /[?&]v=([a-zA-Z0-9_-]{6,})/,
    /embed\/([a-zA-Z0-9_-]{6,})/,
    /shorts\/([a-zA-Z0-9_-]{6,})/,
    // Diretos e jogos transmitidos em direto: youtube.com/live/<id>
    // (o link que o YouTube dá ao partilhar uma transmissão). Só com o
    // domínio do YouTube à frente, para não apanhar links de outras redes.
    /youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* ---------------------------------------------------------------
   INSTAGRAM / TIKTOK — tal como o YouTube, tocados sempre dentro
   da app através do endpoint público de embed de cada plataforma
   (iframe direto, sem SDK/script externo — mesma filosofia usada
   acima para o YouTube, para não depender de scripts bloqueados
   por CSP). Não há forma pública de obter uma miniatura (thumbnail)
   destas duas plataformas sem chave de API, por isso a lista lateral
   mostra um ícone da rede em vez de uma imagem de pré-visualização.
   Nota: links curtos do TikTok (vm.tiktok.com/vt.tiktok.com) não são
   suportados — o browser não consegue seguir o redirecionamento por
   causa de CORS; é preciso o link completo com "/video/{id}".
---------------------------------------------------------------- */
/* O Instagram tem três caminhos de publicação e o embed responde no
   MESMO caminho: /reel/, /p/ (publicação normal, incluindo vídeos) e /tv/
   (IGTV). Antes guardava-se só o código e montava-se sempre um link
   /reel/…/embed — o que funciona para reels mas falha nos vídeos
   publicados como /p/, que é exatamente o caso dos que não reproduziam.

   Agora o tipo viaja com o código. Os links de partilha novos
   (instagram.com/share/…) também são reconhecidos; nesses não dá para
   saber o tipo pelo endereço, por isso assume-se /reel/, que é o formato
   da esmagadora maioria dos vídeos partilhados. */
export function parseInstagramId(url) {
  if (!url) return null;
  const direto = url.match(/instagram\.com\/(reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/);
  if (direto) {
    const tipo = direto[1] === 'reels' ? 'reel' : direto[1];
    return { id: direto[2], tipo };
  }
  const partilha = url.match(/instagram\.com\/share\/(?:(reel|reels|p|tv)\/)?([a-zA-Z0-9_-]+)/);
  if (partilha) {
    const tipo = partilha[1] ? (partilha[1] === 'reels' ? 'reel' : partilha[1]) : 'reel';
    return { id: partilha[2], tipo };
  }
  return null;
}

export function parseTikTokId(url) {
  if (!url) return null;
  const patterns = [
    /tiktok\.com\/@[^/]+\/video\/(\d+)/,
    /tiktok\.com\/player\/v\d+\/(\d+)/,
    /tiktok\.com\/embed(?:\/v2)?\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* FACEBOOK — vídeos e reels públicos, pelo leitor oficial de embed
   (facebook.com/plugins/video.php?href=…). O leitor recebe o endereço
   completo da publicação, por isso guarda-se o link normalizado além do
   número. Links curtos fb.watch não são suportados, pela mesma razão dos
   do TikTok: o browser não consegue seguir o redirecionamento.
   Formatos aceites:
     facebook.com/reel/123…            → reel (vertical)
     facebook.com/watch/?v=123…        → vídeo
     facebook.com/<página>/videos/123… → vídeo
     facebook.com/share/r/… e /share/v/… (links de partilha do telemóvel) */
export function parseFacebookVideo(url) {
  let u;
  try { u = new URL(String(url).trim()); } catch (e) { return null; }
  if (!/(^|\.)facebook\.com$/.test(u.hostname)) return null;
  const caminho = u.pathname;
  let m = caminho.match(/\/reels?\/(\d+)/);
  if (m) return { id: m[1], tipo: 'reel', url: `https://www.facebook.com/reel/${m[1]}` };
  const v = u.searchParams.get('v');
  if (/^\/watch/.test(caminho) && /^\d+$/.test(v || '')) return { id: v, tipo: 'video', url: `https://www.facebook.com/watch/?v=${v}` };
  m = caminho.match(/\/videos\/(?:[^/]+\/)?(\d+)/);
  if (m) return { id: m[1], tipo: 'video', url: `https://www.facebook.com${caminho.replace(/\/+$/, '')}/` };
  m = caminho.match(/\/share\/(r|v)\/([A-Za-z0-9_-]+)/);
  if (m) return { id: m[2], tipo: m[1] === 'r' ? 'reel' : 'video', url: `https://www.facebook.com/share/${m[1]}/${m[2]}/` };
  return null;
}

// Deteta automaticamente a rede social a partir do link colado.
export function detectSocialEmbed(url) {
  if (!url) return null;
  if (/facebook\.com/.test(url)) {
    const info = parseFacebookVideo(url);
    return info ? { platform: 'facebook', id: info.id, tipo: info.tipo, url: info.url } : null;
  }
  if (/instagram\.com/.test(url)) {
    const info = parseInstagramId(url);
    return info ? { platform: 'instagram', id: info.id, tipo: info.tipo } : null;
  }
  if (/tiktok\.com/.test(url)) {
    const id = parseTikTokId(url);
    return id ? { platform: 'tiktok', id } : null;
  }
  return null;
}

/* TikTok: passámos do embed antigo (/embed/v2/) para o "Embed Player"
   oficial (/player/v1/), documentado em developers.tiktok.com/doc/embed-player.
   Motivo: o embed antigo é um CARTÃO — tem cabeçalho com a conta, legenda e
   um botão "Discover more on TikTok", e ao pausar/terminar mostrava
   sugestões que levavam o utilizador para fora do vídeo partilhado. O
   player oficial é só o vídeo + controlos, e aceita parâmetros:
     rel=0        → as sugestões passam a ser só do próprio autor do vídeo
                    (atenção: segundo a documentação da TikTok, rel=0 NÃO
                    elimina as sugestões, só as restringe ao mesmo autor —
                    não há parâmetro para as desligar por completo)
     loop=1       → o vídeo recomeça em vez de terminar, por isso nunca
                    chega ao ecrã final com sugestões
     description=0 / music_info=0 → sem legenda nem faixa de música
     native_context_menu=0 → sem menu do browser por cima do vídeo
   Isto resolve as duas coisas: fica fixo no vídeo partilhado e o embed
   deixa de ter cabeçalho/rodapé, ficando o vídeo com o ecrã todo. */
export const TIKTOK_PLAYER_PARAMS = 'rel=0&loop=1&description=0&music_info=0&controls=1&native_context_menu=0';

/* O EMBED DO INSTAGRAM NÃO É RESPONSIVO — desenha-se sempre à mesma
   largura fixa (~328px), venha o iframe à volta com o tamanho que vier.
   Num ecrã largo isso já se nota; em telemóvel, onde o cartão do vídeo
   ocupa a largura toda do ecrã, sobra uma faixa preta bem visível dos
   dois lados. Como não há forma de pedir ao Instagram para desenhar
   maior, este componente MEDE o espaço disponível e amplia o iframe
   inteiro com `transform: scale()` até encher esse espaço — o mesmo
   truque que se usa para qualquer conteúdo de largura fixa que se
   precise de esticar. */
export function InstagramEmbedResponsivo({ src, titulo, tipo }) {
  const wrapRef = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const medir = () => { if (wrapRef.current) setLargura(wrapRef.current.offsetWidth); };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  const NATIVO = 328; // largura a que o Instagram desenha o embed, sempre
  const escala = largura ? largura / NATIVO : 1;
  // Reels e IGTV são vídeos verticais (perto de 9:16) — bem mais altos
  // do que uma publicação normal (perto de 4:5/1:1). Sem distinguir os
  // dois, a "janela" calculada para um Reel ficava curta de mais, e o
  // que devia ficar escondido por baixo da borda (a legenda "Ver mais
  // no Instagram") acabava a aparecer a meio do vídeo, em vez de fora
  // da vista.
  const ehVertical = tipo === 'reel' || tipo === 'reels' || tipo === 'tv';
  const proporcao = ehVertical ? 1.78 : 1.25;
  const alturaNativa = NATIVO * proporcao;
  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', paddingTop: `${proporcao * 100}%`, background: '#000', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: NATIVO, height: alturaNativa, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
        <iframe
          src={src}
          title={titulo || 'media'}
          style={{ width: NATIVO, height: alturaNativa, border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          playsInline
          scrolling="no"
          sandbox={INSTAGRAM_SANDBOX}
          loading="lazy"
        />
      </div>
    </div>
  );
}

/* CLIPE DO YOUTUBE NA COLUNA (vista "Ver tudo aberto" e Adversário no
   Portal). Antes usava o `end=` do YouTube: parava no fim do corte, mas
   ao carregar em "repetir" o YouTube tocava o jogo inteiro. Agora o
   leitor não tem controlos próprios, a barra só anda dentro do corte e,
   no fim, volta ao início e continua a tocar. */
export function CorteYoutubeEmbutido({ item }) {
  const iframeRef = useRef(null);
  // ECRÃ INTEIRO direto da caixa pequena: vai para ecrã inteiro a própria
  // caixa (o mesmo leitor, o vídeo não recomeça), com a barra do corte e
  // a lupa. No iPhone a caixa cobre o ecrã por CSS.
  const caixaRef = useRef(null);
  const areaRef = useRef(null);
  const [cheio, setCheio] = useState(false);
  const [cheioCss, setCheioCss] = useState(false);
  const emCheio = cheio || cheioCss;
  const lupa = useLupa(areaRef, emCheio);
  useEffect(() => {
    const aoMudar = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      setCheio(!!el && el === caixaRef.current);
    };
    document.addEventListener('fullscreenchange', aoMudar);
    document.addEventListener('webkitfullscreenchange', aoMudar);
    return () => {
      document.removeEventListener('fullscreenchange', aoMudar);
      document.removeEventListener('webkitfullscreenchange', aoMudar);
    };
  }, []);
  useKioskVoltar(cheioCss, () => setCheioCss(false));
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
    } else setCheioCss(true);
  };
  const inicio = Math.max(0, item.clipInicio || 0);
  const fim = Math.max(inicio + 1, item.clipFim || inicio + 1);
  const duracao = fim - inicio;
  const [tempo, setTempo] = useState(inicio);
  const [aTocar, setATocar] = useState(false);
  const [arrasto, setArrasto] = useState(null);
  const saltoRef = useRef(0);
  const comando = (func, args) => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  };
  const irPara = (seg) => {
    const alvo = Math.min(fim - 0.2, Math.max(inicio, seg));
    saltoRef.current = Date.now(); comando('seekTo', [alvo, true]); setTempo(alvo);
  };
  useEffect(() => {
    const aoMsg = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return;
      const win = iframeRef.current && iframeRef.current.contentWindow;
      if (!win || event.source !== win) return;
      let data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data) return;
      if (data.event === 'onStateChange' && typeof data.info === 'number') {
        setATocar(data.info === 1 || data.info === 3);
        if (data.info === 0) { irPara(inicio); comando('playVideo'); }
      }
      if (data.event === 'infoDelivery' && data.info) {
        if (typeof data.info.playerState === 'number') setATocar(data.info.playerState === 1 || data.info.playerState === 3);
        const t = data.info.currentTime;
        if (typeof t === 'number') {
          const aSaltar = Date.now() - saltoRef.current < 800;
          if (!aSaltar && (t >= fim - 0.15 || t < inicio - 0.5)) {
            const tocava = data.info.playerState === 1 || data.info.playerState === 3;
            irPara(inicio); if (tocava) comando('playVideo');
          } else setTempo(Math.min(fim, Math.max(inicio, t)));
        }
      }
    };
    window.addEventListener('message', aoMsg);
    return () => window.removeEventListener('message', aoMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim]);
  const aoCarregar = () => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  };
  const btn = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 };
  const pos = arrasto != null ? arrasto : Math.max(0, tempo - inicio);
  const src = React.useMemo(() => `https://www.youtube.com/embed/${item.youtubeId}?start=${Math.floor(inicio)}&rel=0&playsinline=1&controls=0&disablekb=1&enablejsapi=1&fs=0&iv_load_policy=3`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id]);
  const alternarPlay = () => comando(aTocar ? 'pauseVideo' : 'playVideo');
  return (
    <div ref={caixaRef} style={{
      background: '#000', display: 'flex', flexDirection: 'column',
      ...(emCheio ? {
        width: cheioCss ? '100vw' : '100%', height: cheioCss ? '100dvh' : '100%',
        ...(cheioCss ? { position: 'fixed', inset: 0, zIndex: 9500, paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxSizing: 'border-box' } : {}),
      } : {}),
    }}>
      <div ref={areaRef} style={{ position: 'relative', width: '100%', overflow: 'hidden', ...(emCheio ? { flex: 1, minHeight: 0 } : { paddingTop: '56.25%' }) }}>
        <div style={{ position: 'absolute', inset: 0, transform: lupa.transform || 'none', transformOrigin: '0 0', transition: lupa.aArrastar ? 'none' : 'transform 0.2s ease-out' }}>
          <iframe
            ref={iframeRef} onLoad={aoCarregar} src={src} title={item.title || 'Corte'}
            allow="autoplay; encrypted-media; picture-in-picture"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            scrolling="no" loading="lazy"
          />
        </div>
        {emCheio ? (
          <>
            <div {...lupa.handlers(alternarPlay)} style={{ position: 'absolute', inset: 0, zIndex: 5, touchAction: 'none', cursor: lupa.lupa.z > 1 ? (lupa.aArrastar ? 'grabbing' : 'grab') : 'pointer' }} />
            <ControlosLupa {...lupa} />
          </>
        ) : (
          <div onClick={alternarPlay} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#111', flexShrink: 0 }}>
        <button onClick={() => comando(aTocar ? 'pauseVideo' : 'playVideo')} title={aTocar ? 'Pausar' : 'Reproduzir'} style={btn}>
          {aTocar ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => irPara(inicio)} title="Voltar ao início do corte" style={btn}><RotateCcw size={14} /></button>
        <input
          type="range" min={0} max={duracao} step={0.1} value={pos}
          onChange={e => { const v = Number(e.target.value); setArrasto(v); irPara(inicio + v); }}
          onPointerUp={() => setArrasto(null)} onTouchEnd={() => setArrasto(null)} onKeyUp={() => setArrasto(null)}
          aria-label="Posição no corte"
          style={{ flex: 1, minWidth: 0, accentColor: T.gold, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11.5, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>{fmtMMSS(pos)} / {fmtMMSS(duracao)}</span>
        <button onClick={alternarEcra} title={emCheio ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'} aria-label={emCheio ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'} style={btn}>
          {emCheio ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}

/* Um item aberto, para a vista em coluna contínua.

   Ao contrário do visualizador principal (um ficheiro de cada vez, com
   controlos), aqui cada item aparece já aberto e percorre-se a rolar, como
   numa rede social. É a forma natural de rever material de vídeo: não se
   escolhe o que ver primeiro, passa-se por tudo.

   Deliberadamente simples — sem ecrã inteiro nem detecção de bloqueio —
   porque o objetivo é passar os olhos, não estudar um ficheiro. Para isso
   há o botão que abre o item no visualizador completo. */
export function MediaFeedItem({ item, onOpen }) {
  // Num clipe, `end=` faz o próprio YouTube parar no fim do corte — aqui
  // não há a barra própria nem o ciclo do visualizador completo, e sem
  // controlos nativos (ver `youtubeEmbedSrc`) não se sai do corte.
  const fonte = item.youtubeId
    ? youtubeEmbedSrc(item, typeof item.clipFim === 'number' ? `end=${Math.ceil(item.clipFim)}` : '')
    : item.social
      ? socialEmbedSrc(item.social)
      : (item.kind === 'drive' && item.drive) ? driveEmbedSrc(item.drive) : null;
  // Num clipe não há "Abrir original": levava ao jogo inteiro no YouTube.
  const externo = item.youtubeId
    ? (typeof item.clipInicio === 'number' ? null : `https://www.youtube.com/watch?v=${item.youtubeId}`)
    : (item.social ? socialExternalUrl(item.social) : (item.kind === 'drive' ? driveOpenSrc(item.drive) : null));

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '11px 13px 9px' }}>
        <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600 }}>{item.title || item.fileName || '(sem título)'}</div>
        {(item.jornada || cleanFolder(item.pasta)) && (
          <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 2 }}>
            {[item.jornada, cleanFolder(item.pasta)].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {item.youtubeId && typeof item.clipInicio === 'number' && typeof item.clipFim === 'number' && item.clipFim > item.clipInicio ? (
        <CorteYoutubeEmbutido item={item} />
      ) : item.social && item.social.platform === 'instagram' ? (
        <InstagramEmbedResponsivo src={fonte} titulo={item.title} tipo={item.social.tipo} />
      ) : fonte ? (
        <div style={{
          position: 'relative', width: '100%', background: '#000',
          // O Drive reserva a sua própria barra de controlos (play/pause,
          // volume, legendas) por baixo do vídeo — dentro de uma caixa
          // apertada a 16:9 essa barra ficava cortada no fundo. Dá-se-lhe
          // mais altura (75% em vez de 56.25%) só a ele; YouTube e as
          // redes sociais continuam com o rácio que já tinham.
          paddingTop: item.social ? '125%' : (item.kind === 'drive' ? '75%' : '56.25%'),
        }}>
          <iframe
            src={fonte}
            title={item.title || 'media'}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            playsInline
            /* Sem barra de scroll dentro do vídeo: a roda do rato tem de
               fazer avançar a coluna, não o interior do embed — senão fica-se
               preso no primeiro vídeo ao tentar passar para o seguinte. */
            scrolling="no"
            // Mesma sandbox do visualizador: o vídeo toca, mas um clique
            // no embed não substitui a app (ver INSTAGRAM_SANDBOX).
            sandbox={item.social && item.social.platform === 'instagram' ? INSTAGRAM_SANDBOX : undefined}
            loading="lazy"
          />
        </div>
      ) : item.kind === 'image' && item.dataUrl ? (
        <img src={item.dataUrl} alt={item.title || ''} style={{ display: 'block', width: '100%' }} />
      ) : item.kind === 'video' && item.dataUrl ? (
        /* Vídeo carregado como ficheiro — toca aqui mesmo, como os do
           YouTube, em vez de obrigar a abrir o visualizador. `preload
           metadata`: numa coluna com muitos vídeos não se descarrega
           nenhum por inteiro antes de se carregar no play. */
        <VideoComBarra src={item.dataUrl} preload="metadata" videoStyle={{ maxHeight: '70vh' }} />
      ) : (
        <div style={{ padding: '18px 13px', fontSize: 12.5, color: T.mutedDim }}>
          {item.kind === 'video' && !item.dataUrl
            ? 'Este vídeo foi carregado como ficheiro e não está disponível aqui.'
            : 'Este ficheiro abre-se no visualizador.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 13px' }}>
        <button
          onClick={() => onOpen(item)}
          style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, ...body, padding: 0 }}
        >Abrir no visualizador</button>
        {externo && (
          <a
            href={externo} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: T.mutedDim, textDecoration: 'none', ...body }}
          ><ExternalLink size={12} /> Abrir original</a>
        )}
      </div>
    </div>
  );
}

/* Endereço da publicação original, para quando o Instagram recusa mostrar
   o vídeo dentro da app (acontece em contas privadas e, cada vez mais, em
   publicações normais, porque a plataforma passou a exigir sessão iniciada
   para muitos embeds). É a única saída possível do nosso lado. */
export function socialExternalUrl(social) {
  if (!social) return null;
  if (social.platform === 'instagram') {
    return `https://www.instagram.com/${social.tipo || 'reel'}/${social.id}/`;
  }
  if (social.platform === 'tiktok') return `https://www.tiktok.com/@_/video/${social.id}`;
  if (social.platform === 'facebook') return social.url || null;
  return null;
}

// Constrói o src do embed do YouTube — junta start/end quando o item é um
// CLIPE (ver `clipInicio`/`clipFim`, criados em "Criar clipe" na Biblioteca),
// para o próprio YouTube cortar a reprodução nesses pontos, sem precisar de
// nenhuma lógica extra no lado do leitor.
export function youtubeEmbedSrc(item, extra) {
  if (!item || !item.youtubeId) return '';
  const bits = ['rel=0', 'playsinline=1'];
  if (typeof item.clipInicio === 'number') {
    bits.push(`start=${Math.max(0, Math.floor(item.clipInicio))}`);
    // Num CLIPE, a barra nativa do YouTube mostrava (e deixava percorrer)
    // o jogo inteiro. Sem controlos nativos (e sem atalhos de teclado,
    // que também saltavam para qualquer lado), a única forma de andar
    // para a frente/trás é a nossa barra própria, limitada ao intervalo
    // do corte (ver "BARRA DO CLIPE" em MediaLibrary). Tocar no vídeo
    // continua a pôr em pausa/retomar.
    bits.push('controls=0', 'disablekb=1');
  }
  // Sem `end=`, de propósito: esse parâmetro do próprio YouTube tem um
  // problema conhecido de gaguejar/repetir o último segundo em vez de
  // simplesmente parar. O fim do corte é vigiado à parte (ver o efeito
  // logo abaixo de `active`, que faz o salto de volta ao início) —
  // dá mais controlo e é o que permite o corte VOLTAR ao início sozinho
  // em vez de só parar.
  if (extra) bits.push(extra);
  return `https://www.youtube.com/embed/${item.youtubeId}?${bits.join('&')}`;
}

/* LUPA — aproximar o vídeo em ecrã inteiro (Biblioteca e cortes).
   Botões − / + (e a percentagem, que volta a 100%), roda do rato sobre o
   vídeo, e no telemóvel/tablet o gesto de pinça com dois dedos. Com zoom,
   arrasta-se para ver outra zona; um toque sem arrastar põe em pausa ou
   retoma. Até 4×; nunca deixa sair do vídeo (sem margens pretas). */
export function useLupa(areaRef, ativo) {
  const [lupa, setLupa] = useState({ z: 1, x: 0, y: 0 });
  const gestoRef = useRef(null);
  const ptrsRef = useRef(new Map());
  const [aArrastar, setAArrastar] = useState(false);
  useEffect(() => { if (!ativo) { setLupa({ z: 1, x: 0, y: 0 }); ptrsRef.current.clear(); gestoRef.current = null; setAArrastar(false); } }, [ativo]);
  const caixa = () => { const el = areaRef.current; const r = el ? el.getBoundingClientRect() : null; return r || { left: 0, top: 0, width: 0, height: 0 }; };
  const limitar = (z, x, y) => {
    const r = caixa();
    const zz = Math.min(4, Math.max(1, z));
    if (zz <= 1.01) return { z: 1, x: 0, y: 0 };
    return { z: zz, x: Math.min(0, Math.max(r.width - r.width * zz, x)), y: Math.min(0, Math.max(r.height - r.height * zz, y)) };
  };
  const zoomEm = (fator, px, py) => setLupa(l => {
    const z2 = Math.min(4, Math.max(1, l.z * fator));
    const k = z2 / l.z;
    return limitar(z2, px - (px - l.x) * k, py - (py - l.y) * k);
  });
  const noCentro = (fator) => { const r = caixa(); zoomEm(fator, r.width / 2, r.height / 2); };
  const local = (e) => { const r = caixa(); return [e.clientX - r.left, e.clientY - r.top]; };
  const aoRodar = (e) => { if (!ativo) return; const [px, py] = local(e); zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, px, py); };
  const handlers = (aoTocar) => ({
    onPointerDown: (e) => {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
      ptrsRef.current.set(e.pointerId, local(e));
      const pts = [...ptrsRef.current.values()];
      setLupa(l => { gestoRef.current = { l, pts, moveu: pts.length > 1 }; return l; });
      setAArrastar(true);
    },
    onPointerMove: (e) => {
      if (!ptrsRef.current.has(e.pointerId) || !gestoRef.current) return;
      ptrsRef.current.set(e.pointerId, local(e));
      const g = gestoRef.current;
      const pts = [...ptrsRef.current.values()];
      if (pts.length >= 2 && g.pts.length >= 2) {
        // Pinça: zoom pelo afastamento dos dedos, à volta do ponto do meio.
        const d0 = Math.hypot(g.pts[0][0] - g.pts[1][0], g.pts[0][1] - g.pts[1][1]) || 1;
        const d1 = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1;
        const mx = (g.pts[0][0] + g.pts[1][0]) / 2; const my = (g.pts[0][1] + g.pts[1][1]) / 2;
        const nx = (pts[0][0] + pts[1][0]) / 2; const ny = (pts[0][1] + pts[1][1]) / 2;
        const z2 = Math.min(4, Math.max(1, g.l.z * (d1 / d0)));
        const k = z2 / g.l.z;
        g.moveu = true;
        setLupa(limitar(z2, nx - (mx - g.l.x) * k, ny - (my - g.l.y) * k));
        return;
      }
      const [x0, y0] = g.pts[0];
      const [x1, y1] = pts[0];
      if (Math.abs(x1 - x0) + Math.abs(y1 - y0) > 6) g.moveu = true;
      if (g.moveu) setLupa(limitar(g.l.z, g.l.x + (x1 - x0), g.l.y + (y1 - y0)));
    },
    onPointerUp: (e) => {
      ptrsRef.current.delete(e.pointerId);
      const g = gestoRef.current;
      if (ptrsRef.current.size === 0) {
        gestoRef.current = null;
        setAArrastar(false);
        if (g && !g.moveu && aoTocar) aoTocar(e);
      } else {
        // Ficou um dedo depois da pinça: recomeça daqui, sem saltos.
        setLupa(l => { gestoRef.current = { l, pts: [...ptrsRef.current.values()], moveu: true }; return l; });
      }
    },
    onPointerCancel: (e) => { ptrsRef.current.delete(e.pointerId); if (!ptrsRef.current.size) { gestoRef.current = null; setAArrastar(false); } },
    onWheel: aoRodar,
  });
  const transform = lupa.z > 1 ? `translate3d(${lupa.x}px, ${lupa.y}px, 0) scale(${lupa.z})` : null;
  return {
    lupa, transform, aArrastar, handlers, aoRodar,
    mais: () => noCentro(1.4), menos: () => noCentro(1 / 1.4), repor: () => setLupa({ z: 1, x: 0, y: 0 }),
  };
}

export function ControlosLupa({ lupa, mais, menos, repor }) {
  const b = {
    width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0,
  };
  return (
    <div onPointerDown={e => e.stopPropagation()} style={{
      position: 'absolute', top: 10, right: 10, zIndex: 8, display: 'flex', alignItems: 'center', gap: 2,
      background: 'rgba(0,0,0,0.6)', borderRadius: 18, padding: '0 4px', backdropFilter: 'blur(4px)',
    }}>
      <button type="button" onClick={menos} disabled={lupa.z <= 1} title="Afastar" style={{ ...b, opacity: lupa.z <= 1 ? 0.4 : 1 }}><ZoomOut size={16} /></button>
      <button type="button" onClick={repor} title="Voltar a 100%" style={{ ...b, width: 'auto', padding: '0 4px', fontSize: 11.5, ...mono }}>{Math.round(lupa.z * 100)}%</button>
      <button type="button" onClick={mais} disabled={lupa.z >= 4} title="Aproximar (também com a roda do rato ou dois dedos)" style={{ ...b, opacity: lupa.z >= 4 ? 0.4 : 1 }}><ZoomIn size={16} /></button>
    </div>
  );
}

/* VÍDEO CARREGADO COM A BARRA DA APP — em vez dos controlos nativos
   do browser (cada browser desenha os seus, com cores próprias), a
   mesma barra amarela dos clipes: reproduzir/pausa, posição, tempo,
   som e ecrã inteiro. Tocar no vídeo também põe em pausa/retoma.
   `semEcraInteiro`: quando quem o usa já tem o seu botão de ecrã
   inteiro (o visualizador da Biblioteca). */
export function VideoComBarra({ src, preload, autoPlay, style, videoStyle, semEcraInteiro, onTimeUpdate, poster, onPronto, pausado }) {
  const wrapRef = useRef(null);
  /* Ao trocar de vídeo, o novo fica invisível até ter a primeira imagem
     pronta: por trás vê-se a miniatura (poster) em vez de um ecrã preto
     com "00:00 / 00:00". Depois entra num desvanecer curto. */
  const [imagemPronta, setImagemPronta] = useState(false);
  useEffect(() => { setImagemPronta(false); }, [src]);
  useEffect(() => { if (pausado && videoRef.current && !videoRef.current.paused) videoRef.current.pause(); }, [pausado]);
  const videoRef = useRef(null);
  const [aTocar, setATocar] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [emEcraInteiro, setEmEcraInteiro] = useState(false);
  const areaRef = useRef(null);
  const lupaV = useLupa(areaRef, emEcraInteiro);

  useEffect(() => {
    const aoMudar = () => setEmEcraInteiro(!!wrapRef.current && document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  const alternar = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause();
  };
  const irPara = (t) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duracao || t, t));
    setTempo(v.currentTime);
  };
  const lerDuracao = (e) => { const d = e.currentTarget.duration; setDuracao(Number.isFinite(d) ? d : 0); };
  const ecraInteiro = () => {
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); return; }
    const w = wrapRef.current;
    const v = videoRef.current;
    if (w && w.requestFullscreen) w.requestFullscreen().catch(() => {});
    // iPhone: só o próprio vídeo entra em ecrã inteiro (com os controlos do sistema).
    else if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  };
  const btn = {
    background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0,
  };

  return (
    <div ref={wrapRef} style={{
      display: 'flex', flexDirection: 'column', background: '#000',
      ...style, ...(emEcraInteiro ? { height: '100%', width: '100%' } : {}),
    }}>
      <div ref={areaRef} onWheel={emEcraInteiro ? lupaV.aoRodar : undefined} style={{
        position: 'relative', overflow: 'hidden', ...(emEcraInteiro ? { flex: 1, minHeight: 0 } : {}),
        // A miniatura com o mesmo enquadramento do vídeo (contain), para a
        // imagem não saltar quando o vídeo aparece por cima.
        ...(poster ? { backgroundImage: `url("${poster}")`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: '#000' } : {}),
      }}>
      <video
        ref={videoRef} src={src} playsInline preload={preload} autoPlay={autoPlay}
        onLoadedData={() => { setImagemPronta(true); if (onPronto) onPronto(); }} onCanPlay={() => { setImagemPronta(true); if (onPronto) onPronto(); }}
        onClick={alternar}
        onPlay={() => setATocar(true)} onPause={() => setATocar(false)}
        onLoadedMetadata={lerDuracao} onDurationChange={lerDuracao}
        onVolumeChange={e => setMudo(e.currentTarget.muted)}
        onTimeUpdate={e => { const t = e.currentTarget.currentTime; setTempo(t); if (onTimeUpdate) onTimeUpdate(t); }}
        style={{
          display: 'block', width: '100%', minHeight: 0, objectFit: 'contain', background: poster ? 'transparent' : '#000', cursor: 'pointer',
          ...videoStyle, ...(emEcraInteiro ? { maxHeight: 'none', height: '100%' } : {}),
          transform: lupaV.transform || 'none', transformOrigin: '0 0',
          opacity: poster && !imagemPronta ? 0 : 1,
          transition: `${lupaV.aArrastar ? '' : 'transform 0.2s ease-out, '}opacity .15s ease-out`,
        }}
      />
      {/* Em ecrã inteiro, uma camada por cima apanha a pinça (o zoom começa
          com dois dedos, também a 100%), o arrastar e o toque, que continua
          a pausar/retomar. */}
      {emEcraInteiro && (
        <div {...lupaV.handlers(alternar)} style={{ position: 'absolute', inset: 0, zIndex: 2, touchAction: 'none', cursor: lupaV.lupa.z > 1 ? (lupaV.aArrastar ? 'grabbing' : 'grab') : 'pointer' }} />
      )}
      {emEcraInteiro && <ControlosLupa {...lupaV} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
        <button onClick={alternar} title={aTocar ? 'Pausar' : 'Reproduzir'} style={btn}>
          {aTocar ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input
          type="range" min={0} max={duracao || 0} step={0.1} value={Math.min(tempo, duracao || 0)}
          onChange={e => irPara(Number(e.target.value))}
          aria-label="Posição no vídeo" disabled={!duracao}
          style={{ flex: 1, minWidth: 0, accentColor: T.gold, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11.5, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>
          {fmtMMSS(tempo)} / {fmtMMSS(duracao)}
        </span>
        <button
          onClick={() => { const v = videoRef.current; if (v) v.muted = !v.muted; }}
          title={mudo ? 'Ligar o som' : 'Tirar o som'} style={btn}
        >{mudo ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
        {!semEcraInteiro && (
          <button onClick={ecraInteiro} title={emEcraInteiro ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'} style={btn}>
            {emEcraInteiro ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* LINK DE UM CORTE — aponta para uma página da própria app
   (`?corte=`, ver `PaginaCorte`), não para o YouTube. Um link do YouTube
   (mesmo o /embed/ com start/end) é apanhado pela app do YouTube no
   telemóvel, que abre o jogo inteiro. A nossa página abre no browser e
   usa o mesmo leitor dos clipes: só o intervalo, com a barra amarela, e
   volta ao início no fim. Tudo o que a página precisa vai no próprio
   link (vídeo, início, fim, título): não lê nada da base de dados. */
/* ENDEREÇO PÚBLICO DA APP — base de todos os links partilhados (igual a
   URL_PUBLICA_APP no AnalisadorVideo.jsx). Fixo de propósito: partilhar
   a partir de um endereço de pré-visualização do Vercel, ou do
   computador em desenvolvimento, dava links que não abrem a quem os recebe. */
export const URL_PUBLICA_APP = 'https://misterjp.vercel.app/';

/* LINK DE UM "VÍDEO JUNTO" (Os meus vídeos, Portal do Atleta).
   O link LEVA O VÍDEO DENTRO: a lista dos clipes (vídeo do YouTube,
   início, fim, título) vai no próprio endereço, em base64. Abre sem login
   e sem base de dados (ver PaginaVideoJunto), e funciona para sempre —
   mesmo que o jogador apague o vídeo na app. */
export function codificarJunto(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function linkDoVideoJunto(nome, segmentos) {
  // 1.º campo: o id do YouTube, ou o link do ficheiro (vídeo carregado).
  const s = (segmentos || []).map(x => [x.youtubeId || x.src, Math.round(Number(x.inicio) * 10) / 10, Math.round(Number(x.fim) * 10) / 10, String(x.titulo || '').slice(0, 40)]);
  return `${URL_PUBLICA_APP}?junto=${codificarJunto({ n: String(nome || '').slice(0, 80), s })}`;
}

export function linkDoCorteYoutube(youtubeId, inicio, fim, titulo) {
  const ini = Math.max(0, Math.floor(Number(inicio) || 0));
  const f = Math.max(ini + 1, Math.ceil(Number(fim) || 0));
  const q = new URLSearchParams({ corte: youtubeId, i: String(ini), f: String(f) });
  if (titulo) q.set('t', titulo);
  return `${URL_PUBLICA_APP}?${q.toString()}`;
}

// mm:ss a partir de segundos — só para os marcadores de "Criar clipe".
export function fmtMMSS(seg) {
  const s = Math.max(0, Math.round(seg || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function socialEmbedSrc(social) {
  if (!social) return '';
  if (social.platform === 'instagram') {
    // Vídeos antigos, guardados antes desta correção, não têm `tipo`
    // guardado — mantêm o comportamento de sempre (/reel/).
    const tipo = social.tipo || 'reel';
    return `https://www.instagram.com/${tipo}/${social.id}/embed`;
  }
  if (social.platform === 'tiktok') return `https://www.tiktok.com/player/v1/${social.id}?${TIKTOK_PLAYER_PARAMS}`;
  if (social.platform === 'facebook') return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(social.url || '')}&show_text=false`;
  return '';
}

export const socialMeta = {
  instagram: { label: 'Instagram', Icon: Instagram, color: '#E1306C' },
  tiktok: { label: 'TikTok', Icon: Music2, color: '#00F2EA' },
  facebook: { label: 'Facebook', Icon: Facebook, color: '#1877F2' },
};

/* O TikTok resolveu-se com o player oficial (/player/v1/), que é só o vídeo.
   O Instagram NÃO tem equivalente: a Meta só publica o oEmbed, que devolve
   o cartão completo (cabeçalho com a conta + rodapé branco com "Ver mais no
   Instagram", gostos e comentários) e não aceita parâmetros para esconder
   essas partes nem para repetir o vídeo.

   Como não dá para pedir ao Instagram um player limpo, fazemos o efeito do
   lado de cá: o iframe fica dentro de uma "janela" que mostra apenas a zona
   do vídeo — o cabeçalho fica acima do recorte e o rodapé branco fica
   abaixo dele. Em ecrã inteiro sobra só o vídeo.

   ATENÇÃO — os dois valores do Instagram são ESTIMATIVAS, medidas a partir
   de uma captura de ecrã real; a Meta não publica nada disto, pode mudá-lo,
   e a zona do vídeo varia com o formato do próprio Reel. É por isso que
   existem os controlos ▲ ▼ (alinhar) e − / + (quanto se corta) em ecrã
   inteiro. */
export const SOCIAL_CROP = {
  instagram: {
    headerPx: 54,     // altura do cabeçalho com o nome da conta
    mediaRatio: 1.09, // altura da zona do vídeo ÷ largura do iframe
    extraPx: 700,     // folga em baixo, só para o embed se desenhar todo
  },
  tiktok: { headerPx: 0, mediaRatio: 16 / 9, extraPx: 0 },
  // O leitor do Facebook é só o vídeo: reels ao alto, vídeos ao largo.
  facebook: { headerPx: 0, mediaRatio: 16 / 9, extraPx: 0 },
  facebook_video: { headerPx: 0, mediaRatio: 9 / 16, extraPx: 0 },
};

// Medidas a usar para cada vídeo (no Facebook dependem de ser reel ou não).
export const socialCropKey = (social) => (social && social.platform === 'facebook' && social.tipo !== 'reel' ? 'facebook_video' : (social && social.platform));

/* SANDBOX DO INSTAGRAM — equilíbrio entre tocar e não fugir.

   O embed do Instagram tenta levar os cliques para fora da app (cabeçalho,
   rodapé e sobretudo o ecrã do fim do vídeo). O atributo `sandbox` do
   browser trava isso: sem `allow-top-navigation`, o iframe não consegue
   mudar a página onde está.

   Ao mesmo tempo, uma sandbox demasiado apertada impede o próprio leitor
   de arrancar e o vídeo nunca toca — que é o problema oposto e o que se
   estava a notar. Daí a lista ser a mais permissiva possível SEM abrir a
   porta que interessa manter fechada:

   - allow-scripts / allow-same-origin  → o leitor arranca e reproduz
   - allow-presentation                 → ecrã inteiro do próprio vídeo
   - allow-forms                        → alguns embeds precisam para o
                                          consentimento de cookies
   - allow-popups + ...-to-escape-sandbox → um clique que insista em ir
                                          para o Instagram abre um
                                          separador NOVO em vez de roubar
                                          a app; assim não se perde o que
                                          se estava a fazer
   - (sem allow-top-navigation)         → nunca substitui esta página

   Se um vídeo continuar sem tocar depois disto, a causa já não é nossa: o
   Instagram exige sessão iniciada para uma parte das publicações e
   simplesmente recusa mostrá-las fora da app deles. */
export const INSTAGRAM_SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-presentation',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
].join(' ');

// Contas partilhadas pelas duas funções abaixo, para não divergirem.
export function socialCropMetrics(platform, boxSize, zoom, barH) {
  const c = SOCIAL_CROP[platform] || SOCIAL_CROP.instagram;
  const avail = Math.max(200, (boxSize.h || 600) - barH);
  const w = Math.round(Math.min(boxSize.w || 360, avail / c.mediaRatio) * zoom);
  const mediaH = Math.round(w * c.mediaRatio);
  return { c, avail, w, mediaH, clipH: Math.min(avail, mediaH) };
}

// Medidas da "janela" de recorte: SEMPRE ativa, dentro e fora do ecrã
// inteiro — mostra só a zona do vídeo, centrada.
//
// Antes só se aplicava em ecrã inteiro; fora dele o iframe era esticado a
// 100%×100% da caixa, sem recorte nenhum, e era aí que o rodapé branco do
// Instagram ("Ver mais no Instagram") aparecia a meio do vídeo — a caixa
// normal (560px) nunca bate certo com a altura real do cartão do Instagram,
// por isso o rodapé calha algures no meio em vez de ficar fora da vista.
export function socialClipStyle(platform, isFullscreen, boxSize, zoom, barH) {
  const { w, clipH } = socialCropMetrics(platform, boxSize, zoom, barH);
  return { position: 'relative', width: w, height: clipH, overflow: 'hidden', flexShrink: 0 };
}

// O iframe é maior do que a janela e fica deslocado para cima, para o
// cabeçalho da plataforma cair fora do recorte. O rodapé fica abaixo.
export function socialInnerStyle(platform, isFullscreen, boxSize, zoom, barH, offset) {
  const { c, mediaH } = socialCropMetrics(platform, boxSize, zoom, barH);
  return {
    position: 'absolute', left: 0, top: -(c.headerPx + offset),
    width: '100%', height: c.headerPx + mediaH + c.extraPx,
  };
}

export function parseDriveId(url) {
  if (!url) return null;
  const u = String(url).trim();
  if (!/drive\.google\.com|docs\.google\.com/.test(u)) return null;
  // Formatos habituais:
  //   drive.google.com/file/d/<ID>/view?usp=sharing
  //   drive.google.com/open?id=<ID>
  //   docs.google.com/presentation/d/<ID>/edit
  //   drive.google.com/uc?id=<ID>
  const byPath = /\/d\/([a-zA-Z0-9_-]{10,})/.exec(u);
  if (byPath) return { id: byPath[1], kind: /docs\.google\.com\/presentation/.test(u) ? 'slides' : 'file' };
  const byQuery = /[?&]id=([a-zA-Z0-9_-]{10,})/.exec(u);
  if (byQuery) return { id: byQuery[1], kind: 'file' };
  return null;
}

// URL de pré-visualização embutida. Para ficheiros no Drive é
// /file/d/<id>/preview; para apresentações Google é /presentation/d/<id>/embed.
export function driveEmbedSrc(drive) {
  if (!drive || !drive.id) return null;
  return drive.kind === 'slides'
    ? `https://docs.google.com/presentation/d/${drive.id}/embed?start=false&loop=false`
    : `https://drive.google.com/file/d/${drive.id}/preview`;
}

export function driveOpenSrc(drive) {
  if (!drive || !drive.id) return null;
  return drive.kind === 'slides'
    ? `https://docs.google.com/presentation/d/${drive.id}/edit`
    : `https://drive.google.com/file/d/${drive.id}/view`;
}

