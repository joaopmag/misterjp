// atleta/Cacifo.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { todayStr, addDays } from '../base/utilidades';
import { T, body } from '../base/tema';
import { activeCompetitionOf, competitionTable } from '../competicao/dados';
import { ChevronLeft, Trophy } from 'lucide-react';
import { aquecerPortal, hashCurto } from './portalRpc';
import { PKH_CSS, PKH_LARGO, PKH_LARGURA_LARGA, PKH_LARGURA_TABLET, PKH_TABLET_ALTO, PkhFaixasLaterais, usePkhMedia } from './KioskHome';
import { coresCamisola } from './ecras';

/* O MEU CACIFO — a página de conteúdos do Portal do Atleta, a seguir ao
   balneário. Ao entrar, a fechadura roda, a porta abre sozinha e a luz do
   cacifo acende; ao voltar de uma área, o cacifo já está aberto.

   · DENTRO DO CACIFO: o caderno (Ideia de Jogo), o tablet (Sala de Vídeo),
     a camisola pendurada (Jogo: convocatória), a caixa das chuteiras com
     as estatísticas da época (Competição) e — só quando há uma janela
     aberta e algo por responder — a garrafa do Wellness/PSE.
   · DENTRO DA PORTA: a folha do treino de hoje, a classificação, a
     prancheta das Tarefas e a ficha do Desenvolvimento.
   · POR FORA: a foto num visor, a placa com o número e o nome, a
     fechadura de código e o emblema.

   Tudo é desenhado num palco de tamanho FIXO (300×480) que depois se
   escala para caber no ecrã — o mesmo desenho no telemóvel, no tablet e
   no computador, sem nada a mexer quando os dados chegam (cada texto tem
   o seu espaço reservado). O cacifo é um objeto escuro de propósito: não
   muda com o modo claro, como o placard e a TV do balneário.

   Os dados vêm do que o quiosque já tem (convocatória, competição,
   tarefas, Wellness/PSE) e de três pedidos pequenos guardados neste
   aparelho (treino do dia, autoavaliação, vídeos), que só se repetem de
   tempos a tempos — para não pesar na Egress. */
export const CACIFO_W = 300;

export const CACIFO_H = 480;

export const CACIFO_CSS = `
  .cf-palco { position: relative; width: ${CACIFO_W}px; height: ${CACIFO_H}px; perspective: 1300px; transform-origin: 0 0; }
  .cf-rig { position: absolute; top: 0; left: 75px; width: 150px; height: ${CACIFO_H}px; transition: left .7s ease .1s; }
  .cf-aberto .cf-rig { left: 150px; }
  .cf-corpo { position: absolute; inset: 0; background: #0f1612; border: 5px solid #2c4336; border-radius: 6px; overflow: hidden; pointer-events: none; }
  .cf-aberto .cf-corpo { pointer-events: auto; }
  .cf-porta { position: absolute; inset: 0; transform-origin: left center; transform-style: preserve-3d; -webkit-transform-style: preserve-3d; transition: transform 1.2s cubic-bezier(.35,.75,.25,1) .45s; z-index: 5; pointer-events: none; }
  .cf-aberto .cf-porta { transform: rotateY(-165deg); }
  .cf-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 6px; overflow: hidden; }
  .cf-tras { background: #243a2e; transform: rotateY(180deg); border: 1px solid #4e6a58; }
  .cf-aberto .cf-tras { pointer-events: auto; }
  .cf-roda { transition: transform .8s cubic-bezier(.45,1.5,.5,1); transform-origin: 116px 300px; }
  .cf-aberto .cf-roda { transform: rotate(-290deg); }
  .cf-luz { position: absolute; top: 0; left: 0; display: block; pointer-events: none; opacity: 0; }
  .cf-aberto .cf-luz { opacity: 1; animation: cf-ligar .6s ease-out .55s both; }
  .cf-cone { opacity: 0; }
  .cf-aberto .cf-cone { opacity: 1; animation: cf-cone .5s ease-out .8s both; }
  /* A luz acende SUAVE, à medida que a porta abre. Antes piscava
     (0 → 0,85 → 0,2 → 1), e via-se o interior escuro aos soluços. */
  @keyframes cf-ligar { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cf-cone { from { opacity: 0; } to { opacity: 1; } }
  .cf-ja .cf-luz, .cf-ja .cf-cone { animation: none !important; }
  .cf-it { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
  .cf-aberto .cf-it { opacity: 1; transform: none; }
  .cf-ja .cf-rig, .cf-ja .cf-porta, .cf-ja .cf-roda, .cf-ja .cf-luz, .cf-ja .cf-it { transition: none !important; }
  @media (prefers-reduced-motion: reduce) {
    .cf-rig, .cf-porta, .cf-roda, .cf-luz, .cf-it { transition: none !important; }
    .cf-luz, .cf-cone { animation: none !important; }
    .cf-pisca { animation: none !important; }
  }
  .cf-obj { position: absolute; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; font: inherit; color: inherit;
    text-align: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; }
  .cf-obj:active { filter: brightness(1.2); }
  .cf-obj:focus-visible { outline: 2px solid #C9A227; outline-offset: 2px; border-radius: 4px; }
  .cf-lab { font-size: 9.5px; font-weight: 600; color: #F1EBDA; line-height: 1.2; overflow-wrap: anywhere; }
  .cf-mini { font-size: 8px; color: #C9A227; line-height: 1.25; margin-top: 1px; overflow-wrap: anywhere; }
  .cf-papel { position: absolute; background: #F4EEDC; color: #2a2418; border-radius: 2px; box-sizing: border-box; }
  .cf-papel small { display: block; font-size: 10.5px; color: #6b5e45; }
  .cf-mao { font-family: 'Caveat', cursive; }
  .cf-iman { position: absolute; top: -4px; left: 50%; margin-left: -6px; width: 12px; height: 8px; border-radius: 3px; background: #C9A227; }
  .cf-pisca { animation: cf-pisca 1.2s infinite; }
  @keyframes cf-pisca { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
`;

/* A letra manuscrita (Caveat) carrega UMA vez, logo ao abrir a app, e
   fica na página: antes vinha num @import dentro do cacifo, voltava a ser
   pedida cada vez que o cacifo aparecia e os papéis ("Sem treino hoje",
   "Missão cumprida") mudavam de letra à frente do atleta. */
export const CACIFO_FONTE = '';

if (typeof document !== 'undefined' && !document.getElementById('mjp-fonte-caveat')) {
  const ln = document.createElement('link');
  ln.id = 'mjp-fonte-caveat'; ln.rel = 'stylesheet';
  ln.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap';
  document.head.appendChild(ln);
  ln.onload = () => { try { document.fonts && document.fonts.load('700 16px Caveat'); document.fonts && document.fonts.load('500 16px Caveat'); } catch (e) { /* nada */ } };
}

export function lerCacheCacifo(chave) {
  try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { return null; }
}

export function gravarCacheCacifo(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem espaço: volta a pedir */ }
}

export function chaveCacifo(tipo, teamId, code) {
  return `misterjp:cacifo:${tipo}:${teamId}:${hashCurto(String(code || ''))}`;
}

// Depois de submeter a autoavaliação, a ficha do cacifo tem de mudar logo.
export function esquecerCacheCacifo(tipo, teamId, code) {
  try { localStorage.removeItem(chaveCacifo(tipo, teamId, code)); } catch (e) { /* nada */ }
}

/* Um pedido pequeno com cópia neste aparelho: mostra logo o que se viu da
   última vez e só volta a pedir ao servidor quando a cópia tem mais de
   `minutos`. `reduzir` guarda só o que o cacifo precisa. */
export function useDadoCacifo(rpc, args, chave, minutos, reduzir) {
  const [dado, setDado] = useState(() => { const c = lerCacheCacifo(chave); return c ? c.d : null; });
  useEffect(() => {
    const c = lerCacheCacifo(chave);
    if (c) setDado(c.d);
    if (c && Date.now() - (c.t || 0) < minutos * 60000) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(rpc, args);
        if (cancelado || error) return;
        let d = data;
        if (Array.isArray(d)) d = d[0];
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
        const r = reduzir ? reduzir(d || null) : (d || null);
        setDado(r);
        gravarCacheCacifo(chave, { t: Date.now(), d: r });
      } catch (e) { /* fica com a cópia */ }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return dado;
}

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function quandoCurto(data, hora) {
  if (!data) return '';
  const hoje = todayStr();
  const dia = data === hoje ? 'Hoje' : data === addDays(hoje, 1) ? 'Amanhã'
    : DIAS_CURTOS[new Date(`${data}T12:00:00`).getDay()] || '';
  const h = String(hora || '').trim().replace(/^(\d{1,2})[:h](\d{2}).*$/, '$1h$2').replace(/h00$/, 'h');
  return [dia, h].filter(Boolean).join(' ');
}

export function PlayerCacifo({
  player, equipa, code, teamId, animar, onAberto, onBack, onAbrir, onAbrirWellness, onAbrirRpe,
  dadosConv, dadosComp, missoes, nTarefas, session, doneWellness, doneRpe, wellnessWindow, rpeWindow,
}) {
  /* ---------- tamanho do ecrã: o mesmo enquadramento da entrada ---------- */
  const largo = usePkhMedia(PKH_LARGO);
  const tablet = usePkhMedia(PKH_TABLET_ALTO);
  const g = usePkhMedia('(min-height: 820px)') && (largo || tablet);
  const areaRef = useRef(null);
  // O cacifo (porta + interior) escala para caber no espaço que sobra.
  const [escala, setEscala] = useState(0);
  React.useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const v = Math.max(0.5, Math.min(w / CACIFO_W, h / CACIFO_H, 2.6));
      setEscala(prev => (Math.abs(prev - v) < 0.002 ? prev : v));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // As áreas do cacifo ficam já carregadas enquanto a porta abre.
  useEffect(() => { aquecerPortal(code, teamId); }, [code, teamId]);

  /* ---------- abrir: com animação na entrada, já aberto ao voltar ---------- */
  const [aberto, setAberto] = useState(!animar);
  useEffect(() => {
    if (!animar) return undefined;
    // 0,15 s com o cacifo fechado (antes 0,35 s); o resto da abertura igual.
    const a = setTimeout(() => setAberto(true), 150);
    const b = setTimeout(() => { if (onAberto) onAberto(); }, 2400);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- dados ---------- */
  const hoje = todayStr();
  const plano = useDadoCacifo('checkin_plano_dia', { p_code: code, p_team: teamId, p_date: hoje },
    `${chaveCacifo('treino', teamId, code)}:${hoje}`, 15,
    (d) => {
      const s = d && d.sessao;
      return s ? { phase: s.phase || '', n: (s.exercicios || []).length } : { vazio: true };
    });
  const dev = useDadoCacifo('checkin_desenvolvimento', { p_code: code, p_team: teamId },
    chaveCacifo('dev', teamId, code), 30,
    (d) => ({ registoId: (d && d.registoId) || null, enviado: !!(d && d.enviado) }));

  // Vídeos: a mesma cópia que a Sala de Vídeo usa para abrir logo
  // (`misterjp:portal-bib:…`). Só se pede ao servidor de 30 em 30 minutos.
  const chaveBib = `misterjp:portal-bib:${teamId}:${hashCurto(String(code || ''))}`;
  const chaveVistos = chaveCacifo('vistos', teamId, code);
  const [idsVideos, setIdsVideos] = useState(() => {
    const c = lerCacheCacifo(chaveBib);
    return c && Array.isArray(c.videos) ? c.videos.map(v => v && v.id).filter(Boolean) : null;
  });
  useEffect(() => {
    const chaveT = chaveCacifo('bib-t', teamId, code);
    const t = Number(lerCacheCacifo(chaveT) || 0);
    if (Date.now() - t < 30 * 60000 && idsVideos) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_biblioteca', { p_code: code, p_team: teamId });
        if (cancelado || error) return;
        let d = data;
        if (Array.isArray(d)) d = d[0];
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
        const videos = ((d && d.videos) || []).slice();
        const antiga = lerCacheCacifo(chaveBib) || {};
        gravarCacheCacifo(chaveBib, { videos, meus: Array.isArray(antiga.meus) ? antiga.meus : [] });
        gravarCacheCacifo(chaveT, Date.now());
        setIdsVideos(videos.map(v => v && v.id).filter(Boolean));
      } catch (e) { /* fica com a cópia */ }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, code]);
  // Na primeira vez neste aparelho, o que já lá está não conta como novo.
  const [vistos, setVistos] = useState(() => lerCacheCacifo(chaveVistos));
  useEffect(() => {
    if (idsVideos && !Array.isArray(vistos)) { setVistos(idsVideos); gravarCacheCacifo(chaveVistos, idsVideos); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsVideos]);
  const novosVideos = idsVideos && Array.isArray(vistos) ? idsVideos.filter(id => !vistos.includes(id)).length : 0;
  const abrirSalaVideo = () => {
    if (idsVideos) gravarCacheCacifo(chaveVistos, idsVideos.slice(-400));
    onAbrir('biblioteca');
  };

  /* ---------- o que cada objeto mostra ---------- */
  const nomeCompleto = String((player && player.name) || '').trim();
  const primeiro = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : 'Atleta';
  const iniciais = nomeCompleto ? nomeCompleto.split(/\s+/).filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase() : '?';
  const numero = player && player.number != null && String(player.number).trim() !== '' ? String(player.number).trim() : '';
  const cor = coresCamisola(T.corEquipa);
  const foto = (player && player.photo) || '';
  const logo = (equipa && equipa.logo) || '';
  const clube = String((equipa && (equipa.clube || equipa.nome)) || '').trim();
  const sigla = clube ? clube.split(/\s+/).filter(w => w.length > 2 || /^[A-Z]{2,}$/.test(w)).map(w => w[0]).join('').toUpperCase().slice(0, 3) : '';

  // Jogo: a próxima convocatória partilhada (hoje ou depois).
  const proxConv = ((dadosConv && dadosConv.convocatorias) || [])
    .filter(c => c && c.data && c.data >= hoje)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;

  // Competição: as três linhas à volta da nossa equipa.
  const nossoClube = (dadosComp && dadosComp.clube) || clube;
  const tabela = (() => {
    try {
      const comp = activeCompetitionOf(dadosComp && dadosComp.standings);
      const equipas = competitionTable(comp);
      if (!equipas.length) return [];
      const b = String(nossoClube || '').toLowerCase();
      const eNos = (t) => !!(b && t && t.name && (String(t.name).toLowerCase() === b || String(t.name).toLowerCase().includes(b) || b.includes(String(t.name).toLowerCase())));
      let i = equipas.findIndex(eNos);
      if (i < 0) i = 0;
      const ini = Math.max(0, Math.min(i - 1, equipas.length - 3));
      return equipas.slice(ini, ini + 3).map((t, k) => ({ pos: ini + k + 1, nome: t.name || '', pts: t.P != null ? t.P : '', nos: eNos(t) }));
    } catch (e) { return []; }
  })();
  const est = (dadosComp && dadosComp.estatisticas) || null;

  // Treino de hoje.
  const treinoTxt = !plano ? '…' : plano.vazio ? 'Sem treino hoje'
    : plano.phase === 'Descanso' ? 'Dia de descanso'
      : [plano.phase, plano.n ? `${plano.n} ex.` : ''].filter(Boolean).join(' · ') || 'Ver o plano';

  // Desenvolvimento.
  const devTxt = !dev ? '…' : dev.enviado ? 'Submetida' : dev.registoId ? 'Por fazer' : 'Sem avaliação aberta';
  const devFalta = !!(dev && dev.registoId && !dev.enviado);

  // Garrafa: só com uma janela aberta e algo por responder (regras do ecrã inicial).
  const isRestDay = !!(session && session.phase === 'Descanso');
  const wAberto = !!(wellnessWindow && wellnessWindow.open) && !doneWellness;
  const pAberto = !!(rpeWindow && rpeWindow.open) && !!session && !isRestDay && !doneRpe;
  const mostraGarrafa = wAberto || pAberto;
  const legendaGarrafa = wAberto && pAberto ? 'W · PSE' : wAberto ? 'Wellness' : 'PSE';
  const corPonto = (feito, emFalta) => (feito ? '#1D9E75' : emFalta ? '#D14056' : '#6f7c74');

  const postits = (missoes || []).slice(0, 2).map(m => String(m.titulo || 'Missão'));
  const nT = nTarefas || 0;

  /* Os objetos de dentro entram logo que a porta passa do meio da volta
     (por volta de 1,1 s): antes só apareciam aos 1,8–2,3 s e, com a porta
     já aberta, o cacifo ficava uns instantes vazio. */
  const atraso = (s) => (animar ? { transitionDelay: `${s}s` } : undefined);
  const nomePlaca = primeiro.toUpperCase();
  const tamNome = nomePlaca.length <= 5 ? 15 : nomePlaca.length <= 8 ? 12.5 : 10.5;

  const marcas = Array.from({ length: 40 }, (_, i) => {
    const a = (i * 9 * Math.PI) / 180, longa = i % 5 === 0, r1 = longa ? 9.5 : 11.8, r2 = 14.3;
    return (
      <line key={i} x1={116 + r1 * Math.sin(a)} y1={300 - r1 * Math.cos(a)} x2={116 + r2 * Math.sin(a)} y2={300 - r2 * Math.cos(a)}
        stroke={i === 0 ? '#C9A227' : '#e8e3d2'} strokeWidth={longa ? 1.1 : 0.6} />
    );
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1, background: T.bg, overflow: 'hidden', overscrollBehavior: 'none',
      touchAction: 'manipulation', ...body,
    }}>
      <style>{`${CACIFO_FONTE}${PKH_CSS}${CACIFO_CSS}`}</style>
      {largo && <PkhFaixasLaterais larguraConteudo={PKH_LARGURA_LARGA} />}
      <div style={{
        position: 'relative', height: '100%', maxWidth: largo ? PKH_LARGURA_LARGA : tablet ? PKH_LARGURA_TABLET : 460, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: g ? 12 : 8, boxSizing: 'border-box',
        padding: largo
          ? `calc(${g ? 20 : 12}px + env(safe-area-inset-top, 0px)) 0 calc(${g ? 18 : 10}px + env(safe-area-inset-bottom, 0px))`
          : tablet
            ? 'calc(22px + env(safe-area-inset-top, 0px)) 24px calc(18px + env(safe-area-inset-bottom, 0px))'
            : 'calc(14px + env(safe-area-inset-top, 0px)) 14px calc(12px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${T.line}`,
            borderRadius: 8, color: T.cream, padding: g ? '8px 14px' : '6px 11px', cursor: 'pointer', ...body, fontSize: g ? 14 : 12.5, flexShrink: 0,
          }}>
            <ChevronLeft size={g ? 16 : 14} /> Balneário
          </button>
        </div>

        <div ref={areaRef} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: CACIFO_W * escala, height: CACIFO_H * escala, flexShrink: 0, visibility: escala ? 'visible' : 'hidden' }}>
            <div className={`cf-palco${aberto ? ' cf-aberto' : ''}${animar ? '' : ' cf-ja'}`} style={{ transform: `scale(${escala || 1})` }}>
              <div className="cf-rig">
                {/* ---------------- DENTRO DO CACIFO ---------------- */}
                <div className="cf-corpo">
                  {/* LUZ: calha embutida no teto com fita LED quente e brilho
                      difuso, um cone de luz suave a cair pelo cacifo, reflexo nas
                      arestas de cima e cantos mais escuros. Acende com um piscar
                      curto (como um LED a ligar) e o cone aparece a seguir. */}
                  <svg className="cf-luz" width="140" height="470" viewBox="0 0 140 470" aria-hidden="true">
                    <defs>
                      <linearGradient id="cf-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE7A3" stopOpacity=".22" /><stop offset=".55" stopColor="#FFE7A3" stopOpacity=".08" /><stop offset="1" stopColor="#FFE7A3" stopOpacity="0" /></linearGradient>
                      <linearGradient id="cf-aresta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE7A3" stopOpacity=".45" /><stop offset="1" stopColor="#FFE7A3" stopOpacity="0" /></linearGradient>
                      <radialGradient id="cf-vinheta" cx=".5" cy=".15" r=".95"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
                      <filter id="cf-brilho" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="2.2" /></filter>
                    </defs>
                    <rect x="0" y="0" width="140" height="470" fill="url(#cf-vinheta)" />
                    <g className="cf-cone">
                      <path d="M10 8 L130 8 L140 330 L0 330 Z" fill="url(#cf-cone)" />
                      <ellipse cx="70" cy="120" rx="58" ry="4" fill="#FFE7A3" opacity=".12" />
                      <rect x="0" y="8" width="2" height="90" fill="url(#cf-aresta)" /><rect x="138" y="8" width="2" height="90" fill="url(#cf-aresta)" />
                    </g>
                    <rect x="6" y="0" width="128" height="9" rx="2" fill="#1b231f" />
                    <rect x="10" y="5" width="120" height="3" rx="1.5" fill="#FFF3CF" />
                    <rect x="10" y="4" width="120" height="5" rx="2.5" fill="#FFE7A3" opacity=".55" filter="url(#cf-brilho)" />
                  </svg>

                  <button type="button" className="cf-obj cf-it" onClick={() => onAbrir('ideiaJogo')} aria-label="Ideia de Jogo"
                    style={{ left: 2, top: 24, width: 68, height: 94, ...atraso(1.05) }}>
                    {/* Caderno e tablet: desenho com a mesma altura (sem encolher)
                        e legenda na mesma linha. O tablet tem ainda, por baixo,
                        a linha dos vídeos novos. */}
                    {/* Caderno tático aberto: notas e uma lâmpada à esquerda,
                        meio campo com cruzes, bola e seta à direita. */}
                    <svg width="54" height="42" viewBox="0 0 64 50" style={{ display: 'block', margin: '3px auto 0', flexShrink: 0 }} aria-hidden="true">
                      <path d="M32 8 L32 46" stroke="#14281f" strokeWidth="2" />
                      <path d="M4 10 Q18 6 32 10 L32 46 Q18 42 4 46 Z" fill="#F4EEDC" />
                      <path d="M32 10 Q46 6 60 10 L60 46 Q46 42 32 46 Z" fill="#ECE5CF" />
                      <g stroke="#c9bfa3" strokeWidth=".8"><path d="M8 18 H28" /><path d="M8 24 H28" /><path d="M8 30 H28" /><path d="M8 36 H24" /></g>
                      <circle cx="14" cy="27" r="5" fill="none" stroke="#C9A227" strokeWidth="1.4" />
                      <path d="M12.5 33 h3" stroke="#C9A227" strokeWidth="1.4" />
                      <rect x="36" y="14" width="20" height="28" fill="none" stroke="#3B6D11" strokeWidth="1" />
                      <path d="M36 28 H56" stroke="#3B6D11" strokeWidth=".8" />
                      <circle cx="46" cy="28" r="3.5" fill="none" stroke="#3B6D11" strokeWidth=".8" />
                      <g stroke="#A6192E" strokeWidth="1.4"><path d="M39 17 l3 3 M42 17 l-3 3" /><path d="M49 33 l3 3 M52 33 l-3 3" /></g>
                      <circle cx="44" cy="37" r="1.8" fill="none" stroke="#1c2226" strokeWidth="1.2" />
                      <path d="M41 21 Q46 26 49 32" fill="none" stroke="#1c2226" strokeWidth="1" strokeDasharray="2 1.5" />
                      <path d="M30 6 L30 2 L34 2 L34 6" fill="#A6192E" />
                    </svg>
                    <div className="cf-lab" style={{ marginTop: 9 }}>Ideia<br />de Jogo</div>
                  </button>

                  <button type="button" className="cf-obj cf-it" onClick={abrirSalaVideo} aria-label="Sala de Vídeo"
                    style={{ left: 72, top: 24, width: 66, height: 94, ...atraso(1.12) }}>
                    {/* Tablet com um lance pausado. */}
                    <svg width="54" height="42" viewBox="0 0 64 50" style={{ display: 'block', margin: '3px auto 0', flexShrink: 0 }} aria-hidden="true">
                      <rect x="3" y="5" width="58" height="40" rx="5" fill="#1c2226" />
                      <rect x="7" y="9" width="50" height="30" rx="1.5" fill="#2E6B3F" />
                      <g stroke="#7FB08A" strokeWidth=".7" fill="none"><path d="M32 9 V39" /><circle cx="32" cy="24" r="5" /><rect x="7" y="17" width="7" height="14" /><rect x="50" y="17" width="7" height="14" /></g>
                      <g fill="#D14056"><circle cx="20" cy="20" r="1.8" /><circle cx="25" cy="30" r="1.8" /></g>
                      <g fill="#F1EBDA"><circle cx="40" cy="16" r="1.8" /><circle cx="44" cy="28" r="1.8" /></g>
                      <circle cx="32" cy="24" r="8" fill="#0f1612" fillOpacity=".55" />
                      <path d="M29.5 20 L36 24 L29.5 28 Z" fill="#C9A227" />
                      <rect x="9" y="35" width="46" height="1.6" rx=".8" fill="#ffffff44" />
                      <rect x="9" y="35" width="19" height="1.6" rx=".8" fill="#C9A227" />
                    </svg>
                    <div className="cf-lab" style={{ marginTop: 9 }}>Sala<br />de Vídeo</div>
                    <div className="cf-mini" style={{ minHeight: 10 }}>{novosVideos > 0 ? `${novosVideos} ${novosVideos === 1 ? 'novo' : 'novos'}` : ''}</div>
                  </button>

                  <div style={{ position: 'absolute', left: 0, right: 0, top: 122, height: 5, background: '#2c4336' }} />
                  {/* VARÃO de lado a lado, cromado, com os dois suportes. */}
                  <div style={{ position: 'absolute', left: 3, top: 141, width: 5, height: 10, borderRadius: 1.5, background: '#3a4a40' }} />
                  <div style={{ position: 'absolute', right: 3, top: 141, width: 5, height: 10, borderRadius: 1.5, background: '#3a4a40' }} />
                  <div style={{ position: 'absolute', left: 4, right: 4, top: 144, height: 4, borderRadius: 2, background: 'linear-gradient(180deg, #E6EAEC, #9AA3A8 50%, #5E676C)' }} />

                  <button type="button" className="cf-obj cf-it" onClick={() => onAbrir('jogos')} aria-label="Jogo"
                    style={{ left: 0, top: 144, width: 140, height: 186, ...atraso(1.2) }}>
                    {/* A CAMISOLA PENDURADA: cruzeta de madeira nos ombros (vê-se
                        pela gola), gancho de balneário em "J" com porca giratória
                        pousado no varão, sombra na parede, volume nas laterais e
                        mangas e ligeira inclinação. Cor da equipa (coresCamisola);
                        nas cores claras, o contorno passa a escuro. */}
                    <svg width="108" height="128" viewBox="0 0 132 156" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }} aria-hidden="true">
                      <defs>
                        <linearGradient id="cf-madeira" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C48A4E" /><stop offset="1" stopColor="#7A4A22" /></linearGradient>
                        <linearGradient id="cf-cromo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F4F6F7" /><stop offset=".5" stopColor="#B8BFC3" /><stop offset="1" stopColor="#E2E6E8" /></linearGradient>
                        <radialGradient id="cf-sombra" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
                        <linearGradient id="cf-dobra" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".22" /><stop offset=".25" stopColor="#000" stopOpacity="0" /><stop offset=".75" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".22" /></linearGradient>
                      </defs>
                      <ellipse cx="70" cy="96" rx="52" ry="62" fill="url(#cf-sombra)" />
                      {(() => {
                        const clara = cor.texto !== '#FFFFFF';
                        const borda = clara ? cor.contorno : '#C9A227';
                        return (
                          <g transform="rotate(-2 66 2.4)">
                            <path d="M51 26 Q66 19 81 26 Q66 39 51 26 Z" fill={cor.contorno} />
                            <path d="M26 44 Q46 31 66 30 Q86 31 106 44" fill="none" stroke="url(#cf-madeira)" strokeWidth="4.5" strokeLinecap="round" />
                            <g transform="translate(0,16)">
                              <path d="M36 16 L52 10 Q66 20 80 10 L96 16 L124 40 L108 58 L98 50 L98 136 L34 136 L34 50 L24 58 L8 40 Z" fill={cor.base} stroke={borda} strokeWidth="2" />
                              <path d="M34 50 L98 50 L98 136 L34 136 Z" fill="url(#cf-dobra)" />
                              <path d="M36 16 L24 58 L8 40 Z" fill="#000" opacity=".12" /><path d="M96 16 L108 58 L124 40 Z" fill="#000" opacity=".12" />
                              <path d="M38 17 L50 12.5 M94 17 L82 12.5" stroke="#000" strokeOpacity=".25" strokeWidth="1.2" />
                              <path d="M52 10 Q66 24 80 10" fill="none" stroke={borda} strokeWidth="3" />
                              <text x="66" y="44" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="12.5" letterSpacing="1" fill={cor.texto}>{nomePlaca.slice(0, 12)}</text>
                              <text x="66" y={numero.length > 2 ? 86 : 92} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={numero.length > 2 ? 34 : 46} fill={cor.texto}>{numero || iniciais.slice(0, 2)}</text>
                            </g>
                            {/* gancho: porca giratória, haste e "J" de borracha escura pousado no varão */}
                            <rect x="63.2" y="25.5" width="5.6" height="4.6" rx="1" fill="#8d969b" />
                            <path d="M66 26 L66 12.5" stroke="url(#cf-cromo)" strokeWidth="2.6" strokeLinecap="round" />
                            <path d="M66 12.5 C66 2.5 70 -1.6 75 -1.6 C80 -1.6 82.5 1.4 82.5 5.4" fill="none" stroke="#454b50" strokeWidth="4.2" strokeLinecap="round" />
                            <path d="M67.5 9.5 C68 3.5 71 0.4 75 0" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.1" strokeLinecap="round" />
                          </g>
                        );
                      })()}
                    </svg>
                    <div style={{ height: 15, marginTop: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {proxConv && (proxConv.convocado === true ? (
                        <span style={{ background: '#C9A227', color: '#1A2A1F', fontSize: 9, fontWeight: 600, borderRadius: 9, padding: '1px 7px' }}>Convocado</span>
                      ) : proxConv.convocado === false ? (
                        <span style={{ border: '1px solid #6f7c74', color: '#b9c4bc', fontSize: 9, borderRadius: 9, padding: '0 6px' }}>Não convocado</span>
                      ) : null)}
                    </div>
                    <div className="cf-lab" style={{ marginTop: 2, padding: '0 6px' }}>{proxConv ? `Jogo · ${quandoCurto(proxConv.data, proxConv.horaJogo)}` : 'Jogo'}</div>
                    <div className="cf-mini" style={{ padding: '0 6px' }}>{proxConv ? `vs ${proxConv.adversario || 'Adversário'}` : 'Sem jogo marcado'}</div>
                  </button>

                  <div style={{ position: 'absolute', left: 0, right: 0, top: 336, height: 5, background: '#2c4336' }} />

                  <button type="button" className="cf-obj cf-it" onClick={() => onAbrir('competicao', 'estatisticas')} aria-label="Estatísticas da época"
                    style={{ left: mostraGarrafa ? 2 : 6, top: mostraGarrafa ? 356 : 346, width: mostraGarrafa ? 92 : 128, height: mostraGarrafa ? 96 : 120, ...atraso(1.3) }}>
                    {/* A CHUTEIRA DOURADA DA ÉPOCA: troféu num pedestal escuro com a
                        placa dos números (Jogos · Min. · Golos · Assist.). */}
                    {/* Ocupa a largura do compartimento (mais pequena só quando a garrafa
                        do Wellness/PSE também está lá), para os números lerem bem. */}
                    <svg width={mostraGarrafa ? 90 : 126} height={mostraGarrafa ? 66 : 92} viewBox="0 0 166 121" style={{ display: 'block', margin: '0 auto' }} aria-hidden="true">
                      <defs>
                        <linearGradient id="cf-ouro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF3C4" /><stop offset=".35" stopColor="#F0C94E" /><stop offset=".7" stopColor="#C79A22" /><stop offset="1" stopColor="#7d5d0f" /></linearGradient>
                        <linearGradient id="cf-ouro-esc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8901f" /><stop offset="1" stopColor="#5e450a" /></linearGradient>
                        <linearGradient id="cf-ouro-br" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
                        <linearGradient id="cf-ped" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2d3236" /><stop offset="1" stopColor="#111315" /></linearGradient>
                        <radialGradient id="cf-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFE6A0" stopOpacity=".35" /><stop offset="1" stopColor="#FFE6A0" stopOpacity="0" /></radialGradient>
                      </defs>
                      <ellipse cx="83" cy="40" rx="70" ry="34" fill="url(#cf-halo)" />
                      <g transform="translate(23,8)">
                        <path d="M6 46 Q4 52 12 53 L104 53 Q118 52 120 45 Q114 47 100 47 L14 47 Z" fill="url(#cf-ouro-esc)" />
                        <g fill="#6b4f0c"><path d="M13 53 L14 58 L18 58 L19 53 Z" /><path d="M27 53 L28 58 L32 58 L33 53 Z" /><path d="M75 53 L76 58 L80 58 L81 53 Z" /><path d="M89 53 L90 58 L94 58 L95 53 Z" /><path d="M103 52 L104 57 L108 57 L109 52 Z" /></g>
                        <path d="M10 47 L9 24 Q9 14 18 13 L30 12 Q36 12 39 17 L44 23 Q58 24 72 27 Q94 31 108 36 Q119 40 120 45 Q114 47 100 47 Z" fill="url(#cf-ouro)" stroke="#6b520c" strokeWidth=".9" />
                        <path d="M30 12 Q34 7 40 9 L48 22 L44 23 Z" fill="url(#cf-ouro-esc)" />
                        <g stroke="#fff8e0" strokeWidth="1.6" strokeLinecap="round"><path d="M41 19 L47 24" /><path d="M47 20 L43 24" /><path d="M47 22 L53 27" /><path d="M53 23 L49 27" /><path d="M53 24 L59 29" /><path d="M59 25 L55 29" /><path d="M59 26 L65 30" /><path d="M65 27 L61 30" /></g>
                        <g fill="#6b520c"><circle cx="41" cy="19" r="1" /><circle cx="47" cy="22" r="1" /><circle cx="53" cy="24" r="1" /><circle cx="59" cy="26" r="1" /><circle cx="65" cy="28" r="1" /></g>
                        <path d="M10 47 L10 26 Q16 30 20 47 Z" fill="url(#cf-ouro-esc)" opacity=".7" />
                        <path d="M96 33 Q112 36 120 45 Q110 46 98 46 Q94 40 96 33 Z" fill="url(#cf-ouro-esc)" opacity=".45" />
                        <path d="M22 40 Q50 30 86 38" fill="none" stroke="#6b520c" strokeWidth="2.2" opacity=".55" />
                        <path d="M12 44 L116 44" stroke="#6b520c" strokeWidth=".6" strokeDasharray="2 1.5" opacity=".7" />
                        <path d="M14 18 Q40 22 70 28 Q95 33 112 40" fill="none" stroke="url(#cf-ouro-br)" strokeWidth="3" opacity=".8" />
                        <circle cx="104" cy="38" r="1.6" fill="#fff" opacity=".9" />
                      </g>
                      <path d="M30 68 L136 68 L142 76 L24 76 Z" fill="#3a3f44" />
                      <rect x="14" y="76" width="138" height="44" rx="3" fill="url(#cf-ped)" />
                      <rect x="20" y="81" width="126" height="34" rx="2" fill="none" stroke="#C9A227" strokeWidth="1" />
                      <g textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="600">
                        <g fontSize="15" fill="#FFD86A">
                          <text x="38" y="100">{est ? (est.jogos || 0) : 0}</text><text x="68" y="100" fontSize={String((est && est.minutos) || 0).length > 3 ? 12 : 15}>{est ? `${est.minutos || 0}'` : "0'"}</text>
                          <text x="98" y="100">{est ? (est.golos || 0) : 0}</text><text x="128" y="100">{est ? (est.assistencias || 0) : 0}</text>
                        </g>
                        <g fontSize="6" fill="#a89a74" fontFamily="Inter, sans-serif" fontWeight="600">
                          <text x="38" y="109">JOGOS</text><text x="68" y="109">MIN.</text><text x="98" y="109">GOLOS</text><text x="128" y="109">ASSIST.</text>
                        </g>
                      </g>
                    </svg>
                    <div className="cf-lab" style={{ marginTop: 4 }}>Estatísticas</div>
                  </button>

                  {mostraGarrafa && (
                    <button type="button" className="cf-obj cf-it" onClick={() => (wAberto ? onAbrirWellness() : onAbrirRpe())}
                      aria-label={wAberto ? 'Responder ao Wellness' : 'Responder à PSE'}
                      style={{ left: 94, top: 356, width: 42, height: 96, ...atraso(1.36) }}>
                      {/* Mesma linha de base da chuteira: a garrafa assenta no fundo do
                          espaço do desenho (66 px) e a legenda fica à altura de "Estatísticas". */}
                      <svg width="25" height="55" viewBox="0 0 34 78" style={{ display: 'block', margin: '11px auto 0' }} aria-hidden="true">
                        <rect x="14" y="0" width="6" height="7" rx="1.5" fill="#1c2226" />
                        <rect x="9" y="6" width="16" height="9" rx="2" fill="#1c2226" />
                        <rect x="8" y="14" width="18" height="3" fill="#C9A227" />
                        <path d="M7 19 Q7 17 10 17 L24 17 Q27 17 27 19 L28 30 Q25 34 25 38 Q25 42 28 46 L28 73 Q28 77 24 77 L10 77 Q6 77 6 73 L6 46 Q9 42 9 38 Q9 34 6 30 Z" fill={cor.base} />
                        <path d="M6.3 30 L27.7 30 M6.3 46 L27.7 46" stroke="#C9A227" strokeWidth="1.5" />
                        <rect x="7" y="51" width="20" height="16" rx="2" fill="#F1EBDA" />
                        <circle cx="12.5" cy="59" r="3.4" fill={corPonto(doneWellness, wAberto)} className={wAberto ? 'cf-pisca' : undefined} />
                        <circle cx="21.5" cy="59" r="3.4" fill={corPonto(doneRpe, pAberto)} className={pAberto ? 'cf-pisca' : undefined} />
                        <path d="M10 20 L10 27" stroke="#ffffff" strokeOpacity=".3" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <div className="cf-lab cf-pisca" style={{ marginTop: 4, color: '#F09595', whiteSpace: 'nowrap' }}>{legendaGarrafa}</div>
                    </button>
                  )}
                </div>

                {/* ---------------- A PORTA ---------------- */}
                <div className="cf-porta">
                  <div className="cf-face">
                    <svg width="150" height={CACIFO_H} viewBox={`0 0 150 ${CACIFO_H}`} style={{ display: 'block' }} aria-hidden="true">
                      <defs>
                        <clipPath id="cf-visor"><rect x="40" y="80" width="70" height="90" rx="4" /></clipPath>
                      </defs>
                      <rect x="0" y="0" width="150" height={CACIFO_H} rx="6" fill="#2c4336" />
                      <rect x="8" y="8" width="134" height={CACIFO_H - 16} rx="4" fill="#33503f" stroke="#4e6a58" />
                      <g fill="#9aa69e"><rect x="0" y="42" width="4" height="26" rx="1" /><rect x="0" y="227" width="4" height="26" rx="1" /><rect x="0" y="412" width="4" height="26" rx="1" /></g>
                      <g fill="#1d2e24"><path d="M28 22 h94 l-4 6 h-94z" /><path d="M28 34 h94 l-4 6 h-94z" /><path d="M28 46 h94 l-4 6 h-94z" /></g>
                      <rect x="33" y="73" width="84" height="104" rx="8" fill="#C9A227" />
                      <rect x="37" y="77" width="76" height="96" rx="6" fill="#8A6A0E" />
                      <rect x="40" y="80" width="70" height="90" rx="4" fill="#5d7266" />
                      {foto ? (
                        <image href={foto} x="40" y="80" width="70" height="90" preserveAspectRatio="xMidYMid slice" clipPath="url(#cf-visor)" />
                      ) : (
                        <g>
                          <circle cx="75" cy="111" r="15" fill="#c8b9a0" />
                          <path d="M47 170 Q49 135 75 132 Q101 135 103 170 Z" fill={cor.base} />
                          <text x="75" y="116" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="12" fill="#5d4a2e">{iniciais}</text>
                        </g>
                      )}
                      <path d="M84 80 L110 80 L110 95 L64 170 L46 170 Z" fill="#ffffff" opacity=".07" />
                      <g fill="#8A6A0E"><circle cx="38" cy="78" r="1.6" /><circle cx="112" cy="78" r="1.6" /><circle cx="38" cy="172" r="1.6" /><circle cx="112" cy="172" r="1.6" /></g>
                      <rect x="27" y="190" width="96" height="40" rx="3" fill="#C9A227" />
                      <rect x="31" y="194" width="88" height="32" rx="2" fill="none" stroke="#8A6A0E" />
                      <text x="49" y="219" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={numero.length > 2 ? 15 : 22} fill="#1A2A1F">{numero || iniciais.slice(0, 2)}</text>
                      <line x1="62" y1="199" x2="62" y2="221" stroke="#8A6A0E" />
                      <text x="90" y="216" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={tamNome} fill="#1A2A1F">{nomePlaca.slice(0, 11)}</text>
                      <circle cx="116" cy="300" r="20" fill="#1d2e24" />
                      <circle cx="116" cy="300" r="18.5" fill="#c3ccc6" />
                      <circle cx="116" cy="300" r="16.5" fill="#7d8a82" />
                      <circle cx="116" cy="300" r="15.5" fill="#121618" />
                      <g className="cf-roda">
                        {marcas}
                        <circle cx="116" cy="300" r="7.5" fill="#2a2f33" />
                        <circle cx="116" cy="300" r="7.5" fill="none" stroke="#6f7c74" strokeWidth="2" strokeDasharray="1.2 1.2" />
                        <circle cx="116" cy="300" r="4.5" fill="#3a4045" />
                      </g>
                      <path d="M116 284 l-2.4 -4 h4.8 z" fill="#C9A227" />
                      {logo ? (
                        <image href={logo} x="55" y="360" width="40" height="40" preserveAspectRatio="xMidYMid meet" opacity=".35" style={{ filter: 'grayscale(1)' }} />
                      ) : (
                        <g>
                          <circle cx="75" cy="380" r="20" fill="none" stroke="#4e6a58" strokeWidth="1.5" />
                          <text x="75" y="385" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="13" fill="#4e6a58">{sigla}</text>
                        </g>
                      )}
                      <g fill="#1d2e24"><path d="M28 422 h94 l-4 6 h-94z" /><path d="M28 434 h94 l-4 6 h-94z" /><path d="M28 446 h94 l-4 6 h-94z" /></g>
                    </svg>
                  </div>

                  {/* -------- dentro da porta -------- */}
                  <div className="cf-face cf-tras">
                    <button type="button" className="cf-obj cf-papel" onClick={() => onAbrir('treino')} aria-label="Treino de hoje"
                      style={{ left: 14, top: 14, width: 116, height: 58, padding: '9px 8px 6px', transform: 'rotate(-2deg)', textAlign: 'left' }}>
                      <span className="cf-iman" />
                      <small>Treino de hoje</small>
                      <div className="cf-mao" style={{ fontSize: treinoTxt.length > 20 ? 13.5 : 16, lineHeight: 1.05 }}>{treinoTxt}</div>
                    </button>

                    <button type="button" className="cf-obj cf-papel" onClick={() => onAbrir('competicao')} aria-label="Classificação"
                      style={{ left: 10, top: 117, width: 130, height: 70, padding: '6px 6px 5px', transform: 'rotate(1.5deg)', textAlign: 'left' }}>
                      <span className="cf-iman" />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, color: '#6b5e45', marginBottom: 2 }}>
                        <Trophy size={11} color="#8A6A0E" /> Classificação
                      </div>
                      {tabela.length ? tabela.map(l => (
                        <div key={l.pos} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 3, fontSize: 10, padding: '1px 3px', background: l.nos ? '#C9A227' : 'transparent', borderRadius: 2 }}>
                          <span>{l.pos}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: l.nos ? 600 : 400, fontSize: l.nome.length > 17 ? 8 : l.nome.length > 14 ? 9 : 10, alignSelf: 'center' }}>{l.nome}</span>
                          <span>{l.pts}</span>
                        </div>
                      )) : (
                        <div className="cf-mao" style={{ fontSize: 16, marginTop: 6 }}>Ainda sem tabela</div>
                      )}
                    </button>

                    <button type="button" className="cf-obj" onClick={() => onAbrir('tarefas')} aria-label={`Tarefas${nT ? `: ${nT} por fazer` : ''}`}
                      style={{ left: 16, top: 234, width: 118, height: 78 }}>
                      <div style={{ background: '#6b4a2e', borderRadius: 4, padding: '14px 6px 6px', position: 'relative', height: 60, boxSizing: 'border-box', textAlign: 'left', overflow: 'hidden' }}>
                        <span style={{ position: 'absolute', top: -3, left: 45, width: 28, height: 8, background: '#9aa69e', borderRadius: 2 }} />
                        {postits.length ? postits.map((p, k) => (
                          <span key={k} className="cf-mao" style={{
                            display: 'inline-block', width: 50, maxHeight: 34, verticalAlign: 'top', overflow: 'hidden', lineHeight: 1,
                            background: k ? '#9FE1CB' : '#F2D35B', color: k ? '#04342C' : '#3a2e05', fontSize: 13, padding: '2px 4px', marginRight: 4,
                            transform: `rotate(${k ? 3 : -4}deg)`,
                          }}>{p}</span>
                        )) : (
                          <span className="cf-mao" style={{ display: 'inline-block', alignSelf: 'flex-start', background: '#dfe9d6', color: '#27500A', fontSize: 13.5, padding: '1px 6px', whiteSpace: 'nowrap', transform: 'rotate(-2deg)' }}>Missão cumprida</span>
                        )}
                      </div>
                      {nT > 0 && (
                        <span style={{ position: 'absolute', top: -8, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: '#D14056', color: '#fff', fontSize: 10.5, fontWeight: 600, display: 'grid', placeItems: 'center', padding: '0 4px', boxSizing: 'border-box' }}>{nT}</span>
                      )}
                      <div className="cf-lab" style={{ marginTop: 4 }}>Tarefas</div>
                    </button>

                    <button type="button" className="cf-obj" onClick={() => onAbrir('desenvolvimento')} aria-label="Desenvolvimento"
                      style={{ left: 12, top: 357, width: 126, height: 104, background: '#1d2a22', border: '1px solid #4e6a58', borderRadius: 6, padding: 6, boxSizing: 'border-box' }}>
                      <svg width="74" height="64" viewBox="0 0 84 74" style={{ display: 'block', margin: '0 auto' }} aria-hidden="true">
                        <g fill="none" stroke="#4e6a58"><polygon points="42,4 78,28 64,70 20,70 6,28" /><polygon points="42,20 62,33 54,58 30,58 22,33" /></g>
                        <polygon points="42,10 70,30 56,62 26,58 16,32" fill="#C9A22755" stroke="#C9A227" strokeWidth="1.5" />
                        <polygon points="42,16 64,32 50,58 32,62 20,30" fill="none" stroke="#9FE1CB" strokeWidth="1.2" strokeDasharray="3 2" />
                      </svg>
                      <div className="cf-lab">Desenvolvimento</div>
                      <div className="cf-mini" style={{ color: devFalta ? '#F2D35B' : '#9FE1CB' }}>{devTxt}</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

