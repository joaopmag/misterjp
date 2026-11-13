// atleta/ecras.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { TEMA_ATUAL, T, body, display, T_ESCURO, TEXT_ON_ACCENT, mono } from '../base/tema';
import React, { useState, useRef, useEffect } from 'react';
import { age } from '../plantel/PlayerModal';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { destinoMissao } from '../tarefas/regras';
import { todayStr } from '../base/utilidades';
import { PE_TC_PORTA } from './temaPorta';

/* ===================================================================
   DIA DE ANOS — "A CAMISOLA DOS ANOS" + "O GOLO DOS PARABÉNS"
   ===================================================================
   No dia de anos, ao entrar no Portal, o jogador não vê o menu: vê uma
   página só dele.
   · A CAMISOLA: uma camisola do clube, vista de costas, entra a rodar —
     com o nome dele em cima e, no lugar do número, a IDADE que faz hoje.
   · O GOLO: por baixo, uma baliza e uma bola. "Remata para celebrar":
     um toque na bola e ela vai ao fundo das redes — a rede abana, o
     telemóvel vibra, aparece "GOLO!" e rebenta uma chuva de papelinhos
     nas cores do clube. Só depois aparece o "Entrar no Portal".
   · A mensagem da equipa técnica.
   Aparece em cada entrada nesse dia (como a missão), e por cima de tudo. */
// Cores da camisola a partir da cor do clube (T.corEquipa): tecido com
// um degradê da própria cor, e números/nome em branco — ou em escuro,
// quando o clube veste uma cor clara (branco, amarelo…).
export function coresCamisola(hex) {
  const h = String(hex || '#B5393F').replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const misturar = (f) => `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v * f)))).map(v => v.toString(16).padStart(2, '0')).join('')}`;
  const luz = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const clara = luz > 0.62;
  return {
    claro: misturar(1.15), base: `#${n}`, escuro: misturar(0.62), contorno: misturar(0.45),
    texto: clara ? '#1B1B1B' : '#FFFFFF', mangas: clara ? misturar(0.55) : '#FFFFFF',
  };
}

// Em claro, o branco e o creme não se viam no fundo claro: trocam por verde e dourado-escuro.
export const CORES_FESTA = TEMA_ATUAL === 'claro'
  ? ['#C8102E', '#2E7D4A', '#C9A227', '#E84A5F', '#8A6A0E']
  : ['#C8102E', '#FFFFFF', '#C9A227', '#E84A5F', '#F3E3A0'];

/* Bola de futebol "a sério" (o padrão clássico de pentágonos pretos e
   hexágonos brancos), com sombra para parecer redonda. */
export function BolaFutebol({ tamanho = 46 }) {
  const c = 50, R = 46;
  const poli = (cx, cy, r, rot) => Array.from({ length: 5 }, (_, k) => {
    const a = rot + (k * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const centro = poli(c, c, 14, -Math.PI / 2);
  const fora = Array.from({ length: 5 }, (_, k) => {
    const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    return poli(c + 41 * Math.cos(a), c + 41 * Math.sin(a), 13, a + Math.PI);
  });
  const txt = (pts) => pts.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho}>
      <defs>
        <radialGradient id="bola-luz" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset=".55" stopColor="#ECECEC" /><stop offset="1" stopColor="#9C9C9C" />
        </radialGradient>
        <radialGradient id="bola-sombra" cx="50%" cy="50%" r="50%">
          <stop offset=".72" stopColor="rgba(0,0,0,0)" /><stop offset="1" stopColor="rgba(0,0,0,.38)" />
        </radialGradient>
        <clipPath id="bola-corte"><circle cx={c} cy={c} r={R} /></clipPath>
      </defs>
      <circle cx={c} cy={c} r={R} fill="url(#bola-luz)" />
      <g clipPath="url(#bola-corte)">
        {/* COSTURAS dos hexágonos brancos:
            · entre cada dois pentágonos de fora, os cantos mais próximos ligam-se;
            · do meio dessa ligação, uma costura até ao canto do pentágono central;
            · dos cantos de fora de cada pentágono, costuras para a borda da bola. */}
        {fora.map((A, k) => {
          const B = fora[(k + 1) % 5];
          let melhor = null;
          A.forEach(pa => B.forEach(pb => {
            const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
            if (!melhor || d < melhor.d) melhor = { d, pa, pb };
          }));
          const meio = [(melhor.pa[0] + melhor.pb[0]) / 2, (melhor.pa[1] + melhor.pb[1]) / 2];
          // canto do pentágono central virado para este par
          const ang = Math.atan2(meio[1] - c, meio[0] - c);
          let canto = centro[0], dm = Infinity;
          centro.forEach(q => { const dd = Math.abs(Math.atan2(Math.sin(Math.atan2(q[1] - c, q[0] - c) - ang), Math.cos(Math.atan2(q[1] - c, q[0] - c) - ang))); if (dd < dm) { dm = dd; canto = q; } });
          return (
            <g key={`c${k}`} stroke="#3A3A3A" strokeWidth="1.6" strokeLinecap="round">
              <line x1={melhor.pa[0]} y1={melhor.pa[1]} x2={melhor.pb[0]} y2={melhor.pb[1]} />
              <line x1={canto[0]} y1={canto[1]} x2={meio[0]} y2={meio[1]} />
            </g>
          );
        })}
        {fora.map((A, k) => {
          // os dois cantos mais afastados do centro seguem para a borda
          const ordenados = [...A].sort((p1, p2) => Math.hypot(p2[0] - c, p2[1] - c) - Math.hypot(p1[0] - c, p1[1] - c)).slice(0, 2);
          return ordenados.map((q, j) => {
            const a2 = Math.atan2(q[1] - c, q[0] - c);
            return <line key={`b${k}${j}`} x1={q[0]} y1={q[1]} x2={c + (R + 6) * Math.cos(a2)} y2={c + (R + 6) * Math.sin(a2)} stroke="#3A3A3A" strokeWidth="1.6" />;
          });
        })}
        <polygon points={txt(centro)} fill="#151515" stroke="#151515" strokeWidth="1.5" strokeLinejoin="round" />
        {fora.map((pts, k) => <polygon key={`p${k}`} points={txt(pts)} fill="#151515" stroke="#151515" strokeWidth="1.5" strokeLinejoin="round" />)}
      </g>
      <circle cx={c} cy={c} r={R} fill="url(#bola-sombra)" />
      <circle cx={c} cy={c} r={R} fill="none" stroke="#2A2A2A" strokeWidth="1.5" />
      <ellipse cx="36" cy="28" rx="12" ry="7" fill="#FFFFFF" opacity=".55" transform="rotate(-25 36 28)" />
    </svg>
  );
}

export function EcraAniversario({ player, onEntrar }) {
  const [golo, setGolo] = useState(false);
  /* PÁGINA FIXA: nada desliza ao tocar. Em vez de deslizar nos ecrãs
     baixos, o conteúdo encolhe o necessário para caber inteiro. */
  const festaFora = useRef(null), festaDentro = useRef(null);
  const [festaEscala, setFestaEscala] = useState(1);
  React.useLayoutEffect(() => {
    const fora = festaFora.current, dentro = festaDentro.current;
    if (!fora || !dentro) return undefined;
    const medir = () => {
      const h = fora.clientHeight, c = dentro.scrollHeight;
      const e = c > h && c > 0 ? Math.max(0.55, h / c) : 1;
      setFestaEscala(prev => (Math.abs(prev - e) < 0.005 ? prev : e));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir); ro.observe(fora); ro.observe(dentro);
    return () => ro.disconnect();
  }, []);
  const nome = String(player.name || '').trim();
  const primeiro = nome.split(/\s+/)[0] || 'Campeão';
  // Nas costas da camisola, o MESMO nome da mensagem ("Parabéns, Telmo!").
  const apelido = primeiro.toUpperCase();
  const idade = age(player.birthdate);
  /* GUARDA-REDES: em vez de marcar, DEFENDE. A camisola é de guarda-redes
     (outra cor, como em campo) e o jogo é ao contrário: as luvas estão na
     baliza, o remate vai ao ângulo e um toque nas luvas faz a defesa —
     "DEFESA!" em vez de "GOLO!". */
  const eGR = String(player.position || '').toUpperCase() === 'GR';
  const corGR = (() => {
    // verde de guarda-redes; se o clube já for verde, laranja
    const h = String(T.corEquipa || '').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return g > r && g > b ? '#E8833A' : '#2FA866';
  })();
  const cc = coresCamisola(eGR ? corGR : T.corEquipa);
  const papelinhos = React.useMemo(() => Array.from({ length: 46 }, (_, k) => ({
    k, left: Math.random() * 100, atraso: Math.random() * 5, dur: 4 + Math.random() * 4,
    cor: CORES_FESTA[k % CORES_FESTA.length], larg: 6 + Math.random() * 6, rot: Math.random() * 360,
  })), []);
  const explosao = React.useMemo(() => Array.from({ length: 60 }, (_, k) => {
    const ang = (Math.PI * 2 * k) / 60 + Math.random() * 0.3;
    const dist = 120 + Math.random() * 170;
    return { k, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist - 60, cor: CORES_FESTA[k % CORES_FESTA.length], rot: Math.random() * 720 };
  }), []);
  const rematar = () => {
    if (golo) return;
    setGolo(true);
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) { /* sem vibração */ }
  };
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90, overflow: 'hidden', overscrollBehavior: 'none', touchAction: 'manipulation', ...body,
      background: `radial-gradient(circle at 50% 0%, ${cc.contorno} 0%, ${T.bg} 70%)`,
    }} ref={festaFora}>
      <style>{`
        html, body { overflow: hidden !important; overscroll-behavior: none; }
        html { scrollbar-gutter: auto !important; }
        @keyframes festa-cair { 0% { transform: translateY(-10vh) rotate(0deg); } 100% { transform: translateY(110vh) rotate(720deg); } }
        @keyframes festa-camisola { 0% { transform: perspective(700px) rotateY(-180deg) scale(.6); opacity: 0; } 60% { opacity: 1; } 100% { transform: perspective(700px) rotateY(0deg) scale(1); opacity: 1; } }
        @keyframes festa-flutuar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes festa-remate { 0% { transform: translate(0,0) scale(1) rotate(0); } 100% { transform: translate(94px,-146px) scale(.42) rotate(540deg); } }
        @keyframes festa-rede { 0%,100% { transform: scaleY(1); } 30% { transform: scaleY(1.08) translateY(-3px); } 60% { transform: scaleY(.96); } }
        @keyframes festa-golo { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes festa-explode { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
        @keyframes festa-pulsar { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.45); } 50% { box-shadow: 0 0 0 12px rgba(255,255,255,0); } }
        @keyframes festa-entrar { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: none; } }
        @keyframes festa-voo { 0% { transform: translate(0,0) rotate(0); } 100% { transform: translate(80px,-38px) rotate(-24deg) scale(.88); } }
        /* o remate vai ao ângulo, bate nas luvas e sai PARA FORA da baliza */
        @keyframes festa-remate-gr {
          0% { transform: translate(0,0) scale(1) rotate(0); }
          55% { transform: translate(80px,-134px) scale(.5) rotate(300deg); }
          100% { transform: translate(168px,-92px) scale(.42) rotate(520deg); opacity: .9; }
        }
        @keyframes festa-luvas-espera { 0%,100% { transform: translateX(-6px); } 50% { transform: translateX(6px); } }
      `}</style>
      {/* chuva de papelinhos, sempre */}
      {papelinhos.map(c => (
        <span key={c.k} data-festa-papel="" style={{
          position: 'fixed', top: 0, left: `${c.left}%`, width: c.larg, height: c.larg * 0.45, background: c.cor, borderRadius: 1,
          opacity: 0.85, transform: `rotate(${c.rot}deg)`, animation: `festa-cair ${c.dur}s linear ${c.atraso}s infinite both`, pointerEvents: 'none',
        }} />
      ))}
      {/* Centrado na vertical: em ecrãs altos (iPad ao alto) o conteúdo
          ficava todo em cima, com metade do ecrã vazia por baixo. Em ecrãs
          baixos continua a começar em cima e a deslizar, como antes. */}
      <div ref={festaDentro} style={{
        position: 'relative', maxWidth: 420, minHeight: festaEscala < 1 ? 0 : '100%', boxSizing: 'border-box', margin: '0 auto',
        padding: 'calc(30px + env(safe-area-inset-top, 0px)) 20px calc(40px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10,
        transform: festaEscala < 1 ? `scale(${festaEscala})` : undefined, transformOrigin: 'top center',
      }}>
        <div style={{ fontSize: 11, color: T.gold, letterSpacing: '.24em', textTransform: 'uppercase' }}>Hoje é dia de festa</div>
        {/* A CAMISOLA DOS ANOS */}
        {/* data-entrada-anima: a camisola entra enquanto a porta abre (é uma
            animação leve), em vez de deixar um buraco vazio até ao fim. */}
        <div data-entrada-anima="" style={{ animation: 'festa-camisola 1.4s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ animation: 'festa-flutuar 3s ease-in-out 1.4s infinite' }}>
            <svg viewBox="0 0 200 210" width="210" height="220" aria-label={`Camisola ${apelido} ${idade ?? ''}`}>
              <defs>
                <linearGradient id="festa-tecido" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={cc.claro} /><stop offset=".55" stopColor={cc.base} /><stop offset="1" stopColor={cc.escuro} />
                </linearGradient>
              </defs>
              <path d="M60 18 L82 8 Q100 20 118 8 L140 18 L190 48 L172 86 L150 74 L150 200 L50 200 L50 74 L28 86 L10 48 Z"
                fill="url(#festa-tecido)" stroke={cc.contorno} strokeWidth="2" />
              <path d="M10 48 L28 86 L50 74 L50 60 Z M190 48 L172 86 L150 74 L150 60 Z" fill={cc.mangas} opacity=".92" />
              <path d="M82 8 Q100 22 118 8" fill="none" stroke={cc.mangas} strokeWidth="5" />
              <text x="100" y="62" textAnchor="middle" fill={cc.texto} fontSize={apelido.length > 9 ? 13 : 17} fontWeight="800"
                style={{ fontFamily: "'Oswald', 'Inter', sans-serif", letterSpacing: '2px' }}>{apelido}</text>
              <text x="100" y="158" textAnchor="middle" fill={cc.texto} fontSize="86" fontWeight="800"
                style={{ fontFamily: "'Oswald', 'Inter', sans-serif" }} stroke={cc.contorno} strokeWidth="2">{idade ?? '🎉'}</text>
            </svg>
          </div>
        </div>
        {/* No modo claro, os textos brancos passam a dourado (o branco
            desaparecia no fundo claro). No escuro fica tudo como estava. */}
        <div style={{ ...display, fontSize: 34, color: TEMA_ATUAL === 'claro' ? T.gold : '#fff', lineHeight: 1.05, marginTop: 2 }}>Parabéns, {primeiro}!</div>
        {idade ? (
          <div style={{ ...display, fontSize: 22, color: T.gold, letterSpacing: '.04em', textAlign: 'center' }}>{idade} anos</div>
        ) : null}
        {/* A mensagem é CENTRADA, como o resto do ecrã (título, idade,
            camisola, baliza). Alinhada à esquerda nunca ficava bem: o
            navegador dá ao bloco a largura máxima, as linhas acabam antes
            dessa largura, e o texto fica sempre a parecer puxado para a
            esquerda. O `balance` deixa as linhas com comprimentos parecidos,
            para não ficar uma palavra sozinha na última. */}
        <div style={{
          fontSize: 14.5, color: TEMA_ATUAL === 'claro' ? T.gold : 'rgba(255,255,255,.8)', lineHeight: 1.6, maxWidth: 'min(320px, 100%)',
          textAlign: 'center', textWrap: 'balance', margin: '0 auto', alignSelf: 'center',
        }}>
          Esta camisola é só tua. Toda a equipa técnica deseja-te um dia em grande, dentro e fora do campo.
        </div>

        {/* O GOLO DOS PARABÉNS */}
        <div style={{ position: 'relative', width: 280, height: 220, marginTop: 14 }}>
          {/* A BALIZA: postes e trave redondos (com luz e sombra), rede em
              losango com profundidade (fundo e laterais), relva às riscas e
              a linha de golo. Só a rede abana no golo — os postes ficam. */}
          <svg viewBox="0 0 280 130" width="280" height="130" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <defs>
              <linearGradient id="fb-poste" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#F1F1EE" /><stop offset="1" stopColor="#B9BDC2" /></linearGradient>
              <linearGradient id="fb-trave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#F1F1EE" /><stop offset="1" stopColor="#B9BDC2" /></linearGradient>
              <pattern id="fb-rede" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M0 0 L0 9 M0 0 L9 0" stroke="rgba(255,255,255,.42)" strokeWidth="1" />
              </pattern>
              <linearGradient id="fb-fundo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(0,0,0,.35)" /><stop offset="1" stopColor="rgba(0,0,0,.15)" /></linearGradient>
              <linearGradient id="fb-relva" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7a3c" /><stop offset="1" stopColor="#1f5a2b" /></linearGradient>
              <clipPath id="fb-boca"><rect x="30" y="10" width="220" height="100" /></clipPath>
            </defs>
            <rect x="0" y="108" width="280" height="22" fill="url(#fb-relva)" />
            <g opacity=".25">
              {[0, 80, 160, 240].map(x => <rect key={x} x={x} y="108" width="40" height="22" fill="#5fae5f" />)}
            </g>
            <line x1="0" y1="110" x2="280" y2="110" stroke="#fff" strokeWidth="2" />
            <g style={{ transformOrigin: '50% 0', transformBox: 'fill-box', animation: golo && !eGR ? 'festa-rede .7s ease-out .55s 2' : 'none' }}>
              <rect x="30" y="10" width="220" height="100" fill="url(#fb-fundo)" />
              <polygon points="30,10 52,24 52,106 30,110" fill="rgba(255,255,255,.05)" />
              <polygon points="250,10 228,24 228,106 250,110" fill="rgba(255,255,255,.05)" />
              <g clipPath="url(#fb-boca)"><rect x="30" y="10" width="220" height="100" fill="url(#fb-rede)" /></g>
              <path d="M52 24 L228 24 M52 24 L52 106 M228 24 L228 106 M30 10 L52 24 M250 10 L228 24" stroke="rgba(255,255,255,.35)" strokeWidth="1" fill="none" />
            </g>
            <ellipse cx="140" cy="113" rx="122" ry="4" fill="rgba(0,0,0,.35)" />
            <rect x="24" y="6" width="7" height="105" rx="3" fill="url(#fb-poste)" />
            <rect x="249" y="6" width="7" height="105" rx="3" fill="url(#fb-poste)" />
            <rect x="24" y="5" width="232" height="7" rx="3" fill="url(#fb-trave)" />
          </svg>
          {/* a bola */}
          {/* GR: as luvas na baliza (é nelas que se toca) */}
          {eGR && (
            <button type="button" onClick={rematar} aria-label="Defender" style={{
              position: 'absolute', left: '50%', top: 66, width: 90, height: 57, marginLeft: -45, marginTop: -28, zIndex: 2,
              border: 'none', padding: 0, background: 'transparent', cursor: golo ? 'default' : 'pointer',
              animation: golo ? 'festa-voo .42s cubic-bezier(.2,.8,.3,1) forwards' : 'festa-luvas-espera 1.4s ease-in-out infinite',
            }}>
              {/* Luvas de guarda-redes vistas de frente (as palmas viradas
                  para o remate): um só contorno de mão, com dedos largos e
                  arredondados e o polegar aberto; palma de látex clara com
                  sombra, o rebordo na cor das luvas (como o "roll finger") e
                  o punho com a fita na cor do clube. */}
              <svg viewBox="0 0 120 76" width="90" height="57">
                <defs>
                  <linearGradient id="luva-latex" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#F7F7F4" /><stop offset=".6" stopColor="#E2E3E0" /><stop offset="1" stopColor="#BFC2C4" />
                  </linearGradient>
                  <radialGradient id="luva-palma" cx="50%" cy="60%" r="55%">
                    <stop offset="0" stopColor="rgba(0,0,0,0)" /><stop offset="1" stopColor="rgba(0,0,0,.18)" />
                  </radialGradient>
                </defs>
                {[0, 1].map(k => (
                  <g key={k} transform={k ? 'translate(118,0) scale(-1,1)' : 'translate(2,0)'}>
                    <path d="M15 60 C9 56 4 49 4 42 C4 37 6 33 9.5 32.5 C13 32 15 35 16 39 L15.5 13 C15.5 7.5 24.5 7.5 24.5 13 L24.8 24 L25.2 9 C25.2 3 35 3 35 9 L34.8 24 L35.4 12 C35.4 6.5 44.4 6.5 44.4 12 L44.2 27 L44.8 19 C44.8 14.5 52.6 14.5 52.6 19 L52.6 44 C52.6 52 50 57 46.5 60 Z" fill="url(#luva-latex)" stroke={corGR} strokeWidth="3.2" strokeLinejoin="round" style={{ paintOrder: 'stroke' }} />
                    <path d="M15 60 C9 56 4 49 4 42 C4 37 6 33 9.5 32.5 C13 32 15 35 16 39 L15.5 13 C15.5 7.5 24.5 7.5 24.5 13 L24.8 24 L25.2 9 C25.2 3 35 3 35 9 L34.8 24 L35.4 12 C35.4 6.5 44.4 6.5 44.4 12 L44.2 27 L44.8 19 C44.8 14.5 52.6 14.5 52.6 19 L52.6 44 C52.6 52 50 57 46.5 60 Z" fill="url(#luva-palma)" />
                    <path d="M15 60 C9 56 4 49 4 42 C4 37 6 33 9.5 32.5 C13 32 15 35 16 39 L15.5 13 C15.5 7.5 24.5 7.5 24.5 13 L24.8 24 L25.2 9 C25.2 3 35 3 35 9 L34.8 24 L35.4 12 C35.4 6.5 44.4 6.5 44.4 12 L44.2 27 L44.8 19 C44.8 14.5 52.6 14.5 52.6 19 L52.6 44 C52.6 52 50 57 46.5 60 Z" fill="none" stroke="#14301f" strokeWidth=".8" strokeLinejoin="round" />
                    <path d="M24.8 24 L24.8 34 M34.8 24 L34.8 34 M44.2 27 L44.2 36" stroke="#9aa0a3" strokeWidth=".9" strokeLinecap="round" />
                    <path d="M19 44 Q30 50 46 44" fill="none" stroke="#9aa0a3" strokeWidth=".9" strokeLinecap="round" />
                    <path d="M14.5 58 L47 58 L48 74 Q31 77 14 74 Z" fill={corGR} stroke="#14301f" strokeWidth=".8" />
                    <path d="M14.3 63 L47.6 63 L47.9 68 L14.1 68 Z" fill={T.corEquipa} stroke="#14301f" strokeWidth=".6" />
                  </g>
                ))}
              </svg>
            </button>
          )}
          <button type="button" onClick={eGR ? undefined : rematar} aria-label={eGR ? 'Bola' : 'Rematar'} style={{
            position: 'absolute', left: '50%', top: 170, width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: '50%',
            border: 'none', padding: 0, cursor: golo || eGR ? 'default' : 'pointer', background: 'transparent',
            animation: golo
              ? (eGR ? 'festa-remate-gr .5s cubic-bezier(.3,.6,.4,1) forwards' : 'festa-remate .55s cubic-bezier(.3,.6,.4,1) forwards')
              : (eGR ? 'none' : 'festa-pulsar 1.6s ease-in-out infinite'),
          }}>
            <BolaFutebol tamanho={46} />
          </button>
          {/* explosão de papelinhos no golo */}
          {golo && explosao.map(c => (
            <span key={`e${c.k}`} style={{
              position: 'absolute', left: '50%', top: 60, width: 8, height: 4, background: c.cor, borderRadius: 1, pointerEvents: 'none',
              '--dx': `${c.dx}px`, '--dy': `${c.dy}px`, '--rot': `${c.rot}deg`,
              animation: 'festa-explode 1.3s cubic-bezier(.1,.7,.3,1) .5s both',
            }} />
          ))}
          {golo ? (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 30, ...display, fontSize: 44, color: T.gold, animation: 'festa-golo .5s ease-out .55s both', textShadow: '0 3px 0 #5c0614' }}>{eGR ? 'DEFESA!' : 'GOLO!'}</div>
          ) : (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 200, fontSize: 12.5, color: TEMA_ATUAL === 'claro' ? T.gold : 'rgba(255,255,255,.75)' }}>
              {eGR ? 'Vem aí o remate — toca nas luvas e defende 🧤' : 'Toca na bola — remata para celebrar ⚽'}
            </div>
          )}
        </div>

        {/* Lugar fixo para o botão de baixo: "Saltar" (pequeno) e "Entrar
            no Portal" (grande, depois do golo) ocupam a mesma altura, por
            isso o ecrã não sobe quando se marca o golo. */}
        <div style={{ marginTop: 18, width: '100%', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {golo ? (
            <button type="button" onClick={onEntrar} style={{
              width: '100%', height: '100%', padding: '0 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: '#fff', color: '#7a0c1c', fontSize: 15.5, fontWeight: 800, ...body,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'festa-entrar .5s ease-out 1.2s both',
            }}>Entrar no Portal <ArrowRight size={18} /></button>
          ) : (
            <button type="button" onClick={onEntrar} style={{ background: 'none', border: 'none', color: TEMA_ATUAL === 'claro' ? T.gold : 'rgba(255,255,255,.45)', opacity: TEMA_ATUAL === 'claro' ? 0.75 : 1, fontSize: 12, cursor: 'pointer', ...body }}>Saltar</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   A MISSÃO — "A PRANCHETA DO MISTER"
   ===================================================================
   A tarefa chega como chegam as instruções num balneário: numa prancheta.
   · Em cima, o quadro verde com o campo a giz: o íman do jogador (com o
     número dele) e, do outro lado, o OBJETIVO — um círculo com o ícone do
     destino (autoavaliação, wellness, vídeo…). O mister desenha a jogada:
     uma seta de giz vai-se traçando do jogador até ao objetivo.
   · Por baixo, a folha da prancheta (papel pautado) com as instruções:
     o título, as notas, e o prazo carimbado no canto.
   · O botão "Bora! …" leva ao sítio onde se faz. "Mais tarde" esconde
     até à próxima entrada no Portal.
   · Várias missões = várias folhas presas na mola: "1 de 3", e a folha
     vira-se ao passar à seguinte. */
/* ECRÃ DE JOGO — véspera e dia de jogo. Tem de ser diferente da
   prancheta das missões: aquilo é o mister a dar trabalho, isto é o
   jogo a chegar. A ideia é um estádio à noite:
   - as luzes dos postes acendem uma a uma ao entrar (com o tremeluzir
     das lâmpadas de estádio a aquecer);
   - na bancada, flashes de telemóveis a piscar;
   - o PLACARD em luzes LED, com os dois clubes e a contagem decrescente
     para o apito (véspera: horas, minutos e segundos; dia: "apito às");
   - por baixo, o BILHETE do jogador com o nome e o número, o jogo e a
     concentração. Ao carregar em "Bora", o canhoto do bilhete rasga-se
     (como à entrada do estádio) e só depois leva o jogador a Jogo. */
export function EcraJogo({ player, missao, onIr, onAdiar }) {
  const info = missao._info || {};
  const [agora, setAgora] = useState(() => Date.now());
  const [rasgar, setRasgar] = useState(false);
  useEffect(() => {
    const h = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  /* ATÉ AO FUNDO DO ECRÃ NO TELEMÓVEL. Por defeito a página acaba por cima
     da barra de gestos do Android e essa faixa fica com a cor da página
     (escura). Enquanto este ecrã está aberto: desenha-se por baixo das
     barras (viewport-fit=cover), o fundo da página passa a verde-relva e a
     barra de cima fica da cor do céu do estádio. Ao sair repõe-se tudo. */
  React.useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const html = document.documentElement, corpo = document.body;
    const vp = document.querySelector('meta[name="viewport"]');
    const tc = document.querySelector('meta[name="theme-color"]');
    const antes = {
      vp: vp && vp.getAttribute('content'), tc: tc && tc.getAttribute('content'),
      html: html.style.getPropertyValue('background'), htmlP: html.style.getPropertyPriority('background'),
      corpo: corpo ? corpo.style.getPropertyValue('background') : '', corpoP: corpo ? corpo.style.getPropertyPriority('background') : '',
    };
    try {
      if (vp && !/viewport-fit/.test(antes.vp || '')) vp.setAttribute('content', `${antes.vp}, viewport-fit=cover`);
      if (tc) tc.setAttribute('content', '#05080b');
      html.style.setProperty('background', '#1f5532', 'important');
      if (corpo) corpo.style.setProperty('background', '#1f5532', 'important');
    } catch (e) { /* sem efeito: fica como estava */ }
    return () => {
      try {
        if (vp && antes.vp != null) vp.setAttribute('content', antes.vp);
        // Se entrou pela porta, a cor guardada era a da porta: volta à da app.
        if (tc && antes.tc != null) tc.setAttribute('content', (antes.tc === PE_TC_PORTA.escuro || antes.tc === PE_TC_PORTA.claro) ? T.bg : antes.tc);
        if (antes.html) html.style.setProperty('background', antes.html, antes.htmlP); else html.style.removeProperty('background');
        if (corpo) { if (antes.corpo) corpo.style.setProperty('background', antes.corpo, antes.corpoP); else corpo.style.removeProperty('background'); }
      } catch (e) { /* nada */ }
    };
  }, []);
  const flashes = React.useMemo(() => Array.from({ length: 46 }, (_, k) => ({
    k, left: Math.random() * 100, top: Math.random() * 100, atraso: Math.random() * 6, dur: 2.5 + Math.random() * 4,
    tam: 1.5 + Math.random() * 2.5, dourado: Math.random() < 0.3,
  })), []);

  const nomeJ = String((player && player.name) || '').trim();
  const primeiro = nomeJ ? nomeJ.split(/\s+/)[0] : 'Jogador';
  const numero = player && player.number ? String(player.number) : '';
  const cor = coresCamisola(T.corEquipa);
  const fora = info.casaFora === 'Fora';
  const nos = String(info.nos || 'Nós');
  const adv = String(info.adv || 'Adversário');
  const casa = fora ? { nome: adv, nosso: false, lado: 'Casa' } : { nome: nos, nosso: true, lado: 'Casa' };
  const vis = fora ? { nome: nos, nosso: true, lado: 'Fora' } : { nome: adv, nosso: false, lado: 'Fora' };

  // Contagem para o apito. Sem hora marcada, conta para a meia-noite do dia do jogo.
  const mh = /^(\d{1,2})[:h](\d{2})/.exec(String(info.hora || '').trim());
  const alvo = info.data ? new Date(`${info.data}T${mh ? `${mh[1].padStart(2, '0')}:${mh[2]}` : '00:00'}:00`).getTime() : null;
  const falta = alvo ? Math.max(0, alvo - agora) : null;
  const dois = (n) => String(n).padStart(2, '0');
  const hh = falta != null ? Math.floor(falta / 3600000) : 0;
  const mm = falta != null ? Math.floor((falta % 3600000) / 60000) : 0;
  const ss = falta != null ? Math.floor((falta % 60000) / 1000) : 0;
  // Igual nos dois dias: a contagem para o apito inicial. Sem hora marcada
  // não há para onde contar, e fica só "Amanhã" / "Hoje".
  const ledLinha2 = !alvo || !mh ? (info.vespera ? 'AMANHÃ' : 'HOJE') : (falta > 0 ? `${dois(hh)}:${dois(mm)}:${dois(ss)}` : 'EM JOGO');
  const ledLegenda = !alvo || !mh ? '' : (falta > 0 ? 'para o apito inicial' : 'a bola já rola');

  const ir = () => {
    if (rasgar) return;
    setRasgar(true);
    setTimeout(() => onIr(missao), 650);
  };
  const led = { fontFamily: "'JetBrains Mono', 'Courier New', monospace", color: '#FFC23D', textShadow: '0 0 6px rgba(255,170,40,.85), 0 0 14px rgba(255,140,20,.45)' };
  /* Sem emblemas: obrigava a carregar o de todos os adversários, e não é
     essa a ideia da app. Cada lado leva só o que um placard a sério tem:
     CASA / FORA por cima e o nome. O nosso lado tem a barra na cor da
     equipa e, se a equipa tiver emblema carregado, o emblema ao lado do
     nome (o do adversário nunca se pede). */
  const ladoPlacard = (eq) => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* O nosso emblema (se a equipa o tiver), centrado por cima do nome.
          Do lado do adversário fica um espaço da mesma altura, para os dois
          nomes ficarem alinhados. Sem emblema, esta linha não existe. */}
      {info.logo ? (
        <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {eq.nosso ? <img src={info.logo} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} /> : null}
        </div>
      ) : null}
      {/* O nome NUNCA corta: a letra encolhe com o ecrã e, se mesmo assim
          não couber, passa para duas linhas (ex.: "SC" / "SALGUEIROS").
          A barra sublinha o nome à largura do texto, centrada. */}
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', maxWidth: '100%' }}>
        <div style={{
          ...led, fontSize: 'clamp(11px, 3.5vw, 14px)', lineHeight: 1.25, letterSpacing: '.04em', textTransform: 'uppercase',
          textAlign: 'center', whiteSpace: 'normal', overflowWrap: 'anywhere', textWrap: 'balance',
        }}>{eq.nome}</div>
        <div style={{
          height: 3, borderRadius: 2, marginTop: 4,
          background: eq.nosso ? cor.base : 'rgba(255,194,61,.18)', boxShadow: eq.nosso ? `0 0 8px ${cor.base}` : 'none',
        }} />
      </div>
    </div>
  );

  /* Rótulo e valor numa grelha: a coluna dos rótulos mede o maior
     ("Concentração"), por isso o texto nunca fica por cima do rótulo. */
  const linhaBilhete = (rotulo, valor) => valor ? (
    <React.Fragment key={rotulo}>
      <span style={{ color: '#7a6f5c', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', paddingTop: 3, whiteSpace: 'nowrap' }}>{rotulo}</span>
      <span style={{ color: '#1d2018', fontWeight: 600, fontSize: 13.5, lineHeight: 1.4, minWidth: 0 }}>{valor}</span>
    </React.Fragment>
  ) : null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))', zIndex: 75, overflowY: 'auto', overflowX: 'hidden', ...body,
      background: 'linear-gradient(180deg, #05080b 0%, #0b1712 45%, #10261a 100%)',
    }}>
      <style>{`
        @keyframes ej-acender { 0% { opacity: 0; } 8% { opacity: .9; } 12% { opacity: .1; } 20% { opacity: .8; } 26% { opacity: .25; } 40%, 100% { opacity: 1; } }
        @keyframes ej-flash { 0%, 86%, 100% { opacity: 0; transform: scale(.4); } 90% { opacity: 1; transform: scale(1.4); } 94% { opacity: .2; transform: scale(1); } }
        @keyframes ej-placard { from { opacity: 0; transform: translateY(-16px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes ej-bilhete { from { opacity: 0; transform: translateY(40px) rotate(3deg); } to { opacity: 1; transform: rotate(-1.2deg); } }
        @keyframes ej-carimbo { 0% { transform: rotate(-14deg) scale(2); opacity: 0; } 100% { transform: rotate(-14deg) scale(1); opacity: .85; } }
        @keyframes ej-rasgar { 0% { transform: none; } 30% { transform: translateX(6px) rotate(4deg); } 100% { transform: translate(60px, 140px) rotate(38deg); opacity: 0; } }
        @keyframes ej-piscar { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @media (prefers-reduced-motion: reduce) { .ej-anim { animation: none !important; opacity: 1 !important; } }
      `}</style>

      {/* A BANCADA: flashes de telemóveis */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: 0, height: '38%', pointerEvents: 'none', opacity: .9 }}>
        {flashes.map(f => (
          <span key={f.k} className="ej-anim" style={{
            position: 'absolute', left: `${f.left}%`, top: `${f.top}%`, width: f.tam, height: f.tam, borderRadius: '50%',
            background: f.dourado ? '#FFD27A' : '#fff', boxShadow: `0 0 ${f.tam * 3}px ${f.dourado ? '#FFC23D' : '#fff'}`,
            opacity: 0, animation: `ej-flash ${f.dur}s ease-in-out ${f.atraso}s infinite`,
          }} />
        ))}
      </div>

      {/* OS POSTES DE LUZ: acendem um de cada vez */}
      {[{ lado: 'left', atraso: 0.1 }, { lado: 'right', atraso: 0.55 }].map(pl => (
        <div key={pl.lado} className="ej-anim" style={{
          position: 'fixed', top: 0, [pl.lado]: 0, width: '62%', height: '78%', pointerEvents: 'none',
          opacity: 0, animation: `ej-acender 1.4s linear ${pl.atraso}s both`,
        }}>
          <div style={{
            position: 'absolute', top: 18, [pl.lado]: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 7px)', gap: 3,
            padding: 4, background: '#1a1f22', borderRadius: 3, boxShadow: '0 0 24px rgba(255,250,225,.55)',
          }}>
            {Array.from({ length: 8 }, (_, k) => <span key={k} style={{ width: 7, height: 7, borderRadius: 2, background: '#FFFBEA', boxShadow: '0 0 6px #fff' }} />)}
          </div>
          <div style={{
            position: 'absolute', top: 30, [pl.lado]: 0, width: '100%', height: '100%',
            background: 'linear-gradient(180deg, rgba(255,250,225,.20) 0%, rgba(255,250,225,0) 80%)',
            clipPath: pl.lado === 'left' ? 'polygon(4% 0, 14% 0, 100% 100%, 20% 100%)' : 'polygon(86% 0, 96% 0, 80% 100%, 0 100%)',
          }} />
        </div>
      ))}

      {/* O RELVADO, em perspetiva, ao fundo. Desce até ao fundo do ecrã
          (por baixo da barra de gestos do telemóvel) e é mais alto no
          telemóvel, para não ficar uma faixa vazia por baixo do bilhete. */}
      <div style={{ position: 'fixed', left: '-20%', right: '-20%', bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px) - 2px)', height: 'calc(min(44%, 380px) + env(safe-area-inset-bottom, 0px))', pointerEvents: 'none', perspective: 400 }}>
        <div style={{
          position: 'absolute', inset: 0, transform: 'rotateX(52deg)', transformOrigin: '50% 100%',
          background: 'repeating-linear-gradient(90deg, #1e5130 0 60px, #23603a 60px 120px)',
          boxShadow: 'inset 0 30px 40px rgba(5,8,11,.9)',
        }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.45)' }} />
          <div style={{ position: 'absolute', left: '50%', top: '40%', width: 120, height: 120, marginLeft: -60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)' }} />
        </div>
      </div>

      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(56px + env(safe-area-inset-top, 0px)) 16px calc(28px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ textAlign: 'center', color: T_ESCURO.gold, fontSize: 11.5, fontWeight: 800, letterSpacing: '.26em', textTransform: 'uppercase' }}>
            Jogo{info.jornada ? ` · ${info.jornada}` : ''}{missao._teste ? ' · teste' : ''}
          </div>

          {/* O PLACARD */}
          <div className="ej-anim" style={{
            position: 'relative', borderRadius: 12, padding: '16px 14px 14px', border: '3px solid #2a2f33',
            background: '#07090a', backgroundImage: 'radial-gradient(rgba(255,194,61,.07) 1px, transparent 1.3px)', backgroundSize: '5px 5px',
            boxShadow: '0 18px 40px rgba(0,0,0,.6), inset 0 0 30px rgba(0,0,0,.8)', animation: 'ej-placard .6s ease-out 1s both',
          }}>
            {/* Os dois lados alinham pelo topo (os nomes à mesma altura,
                mesmo que um passe a duas linhas); o VS fica ao meio. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {ladoPlacard(casa)}
              <div style={{ ...led, alignSelf: 'center', flexShrink: 0, fontSize: 20, fontWeight: 700, animation: 'ej-piscar 1.6s ease-in-out infinite' }} className="ej-anim">VS</div>
              {ladoPlacard(vis)}
            </div>
            <div style={{ height: 1, background: 'rgba(255,194,61,.18)', margin: '14px 0 10px' }} />
            <div style={{ ...led, textAlign: 'center', fontSize: 30, fontWeight: 700, letterSpacing: '.08em', lineHeight: 1.1 }}>{ledLinha2}</div>
            {ledLegenda && <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: 'rgba(255,194,61,.7)', letterSpacing: '.18em', textTransform: 'uppercase' }}>{ledLegenda}</div>}
          </div>

          {/* O BILHETE */}
          <div className="ej-anim" style={{ display: 'flex', filter: 'drop-shadow(0 14px 26px rgba(0,0,0,.55))', animation: 'ej-bilhete .7s cubic-bezier(.2,.9,.3,1.2) 1.4s both' }}>
            <div style={{
              flex: 1, minWidth: 0, position: 'relative', background: '#F6EEDB', borderRadius: '10px 0 0 10px', padding: '14px 14px 14px 16px',
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(160,130,80,.05) 0 6px, transparent 6px 12px)',
            }}>
              <div style={{ fontSize: 10, color: '#8a7a5c', letterSpacing: '.22em', textTransform: 'uppercase' }}>Bilhete de jogador</div>
              <div style={{ ...display, fontSize: 26, color: '#14231a', lineHeight: 1.15, margin: '2px 0 10px' }}>
                {primeiro}{numero ? <span style={{ color: cor.base, marginLeft: 8 }}>#{numero}</span> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 10, rowGap: 4, alignItems: 'start' }}>
                {/* Só o adversário: o placard por cima já mostra quem joga em casa. */}
                {linhaBilhete('Jogo', `vs ${adv}`)}
                {linhaBilhete('Hora', [info.hora, info.local].filter(Boolean).join(' · '))}
                {linhaBilhete('Concentração', [info.horaConc, info.localConc].filter(Boolean).join(' · '))}
              </div>
              {/* Os três numa só linha, em três caixas iguais. Sem ícones e com a
                  letra a acompanhar a largura do ecrã, o texto cabe sempre
                  dentro da caixa. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginTop: 12 }}>
                {['Convocatória', 'Plano de jogo', 'Adversário'].map(t => (
                  <span key={t} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minWidth: 0,
                    fontSize: 'clamp(8.5px, 2.5vw, 10.5px)', fontWeight: 600, color: '#3b3a2c', lineHeight: 1.15,
                    border: '1px solid #cfc2a4', borderRadius: 999, padding: '4px 4px', whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>{t}</span>
                ))}
              </div>
              {info.convocado && (
                <div className="ej-anim" style={{
                  position: 'absolute', right: 10, top: 12, border: '2px solid #2E6B3A', color: '#2E6B3A', borderRadius: 6,
                  padding: '2px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                  animation: 'ej-carimbo .35s ease-out 2.1s both',
                }}>Convocado</div>
              )}
            </div>
            {/* o canhoto, com o picotado entre os dois */}
            <div className={rasgar ? '' : 'ej-anim'} style={{
              width: 60, flexShrink: 0, background: '#F6EEDB', borderRadius: '0 10px 10px 0', position: 'relative',
              borderLeft: '2px dashed #b9aa88', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0',
              transformOrigin: '0 0', animation: rasgar ? 'ej-rasgar .65s ease-in both' : 'none',
            }}>
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, letterSpacing: '.3em', color: '#8a7a5c', textTransform: 'uppercase' }}>Entrada</div>
              <div style={{ width: 34, height: 52, background: 'repeating-linear-gradient(90deg, #1d2018 0 2px, transparent 2px 4px, #1d2018 4px 5px, transparent 5px 8px, #1d2018 8px 11px, transparent 11px 12px)' }} />
              <div style={{ ...display, fontSize: 18, color: cor.base }}>{numero || '★'}</div>
            </div>
          </div>

          <button type="button" onClick={ir} style={{
            width: '100%', padding: '15px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: T.crimson, color: TEXT_ON_ACCENT, fontSize: 16, fontWeight: 800, ...body,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 20px rgba(0,0,0,.35)',
          }}>
            Bora! {missao.acao || 'Ver o jogo'} <ArrowRight size={18} />
          </button>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" onClick={() => onAdiar(missao.id)} style={{
              background: 'none', border: 'none', color: T_ESCURO.mutedDim, cursor: 'pointer', fontSize: 13.5, ...body, padding: 6,
            }}>Mais tarde</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Também serve a EQUIPA TÉCNICA (sem Portal): `destinoDe` troca o destino
   do Portal pelo caminho da app, `cabecalho` o título da prancheta e
   `dicaDe` a frase por baixo do botão. */
export function EcraMissao({ player, tarefas, janelas = {}, onIr, onAdiar, destinoDe, cabecalho, dicaDe }) {
  const [i, setI] = useState(0);
  const [folha, setFolha] = useState(0); // muda a cada página → reinicia as animações
  /* O FUNDO DA PÁGINA TODA MEXE, como os papelinhos dos anos — mas aqui
     são as marcas de giz de um quadro tático (cruzes, bolas, setas) a
     subir devagar, a rodar, quase transparentes. */
  const marcasGiz = React.useMemo(() => Array.from({ length: 22 }, (_, k) => ({
    k, tipo: ['bola', 'x', 'seta', 'cone', 'o', 'bola'][k % 6], left: Math.random() * 100, atraso: -Math.random() * 22,
    dur: 16 + Math.random() * 14, tam: 16 + Math.random() * 18, rot: Math.random() * 360, op: 0.08 + Math.random() * 0.12,
  })), []);
  const t = tarefas[Math.min(i, tarefas.length - 1)];
  if (!t) return null;
  const d = destinoDe ? destinoDe(t) : destinoMissao(t.destino);
  const Ic = d.icon;
  const fechadoAgora = (d.rota === 'wellness' && janelas.wellness && !janelas.wellness.open)
    || (d.rota === 'rpe' && janelas.rpe && !janelas.rpe.open);
  const prazoDe = (tt) => {
    if (!tt.prazo) return null;
    const dias = Math.round((new Date(`${tt.prazo}T00:00:00`) - new Date(`${todayStr()}T00:00:00`)) / 86400000);
    if (dias < 0) return { txt: 'Atrasada', cor: '#B3261E' };
    if (dias === 0) return { txt: 'Hoje', cor: '#9A6A00' };
    if (dias === 1) return { txt: 'Amanhã', cor: '#9A6A00' };
    return { txt: `${dias} dias`, cor: '#2E6B3A' };
  };
  const prazo = prazoDe(t);
  const titulo = String(t.titulo || '').trim();
  const tituloBonito = titulo ? titulo.charAt(0).toUpperCase() + titulo.slice(1) : d.rotulo;
  const nomeJ = String((player && player.name) || '').trim();
  const marca = (player && player.number) ? String(player.number) : (nomeJ ? nomeJ.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() : '★');
  const mudar = (n) => { setI(n); setFolha(f => f + 1); };
  const giz = 'rgba(255,255,255,.82)';
  // Onde está o íman: o guarda-redes na pequena área; os outros, no meio-campo.
  const eGR = String((player && player.position) || '').toUpperCase() === 'GR';
  const pos = eGR ? { x: 21, y: 80 } : { x: 78, y: 112 };
  const corIman = coresCamisola(T.corEquipa);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 75, overflowY: 'auto', overflowX: 'hidden', ...body,
      background: `radial-gradient(circle at 50% 30%, ${T.brilhoMissao} 0%, ${T.bg} 75%)`,
    }}>
      {marcasGiz.map(m => (
        m.tipo === 'bola' ? (
          // A bola a sério (a mesma dos anos), pequena e quase transparente.
          <div key={m.k} style={{
            position: 'fixed', left: `${m.left}%`, bottom: -40, opacity: m.op + 0.08, pointerEvents: 'none', lineHeight: 0,
            animation: `pr-subir ${m.dur}s linear ${m.atraso}s infinite`, '--rot': `${m.rot}deg`,
          }}><BolaFutebol tamanho={m.tam} /></div>
        ) : (
          <svg key={m.k} viewBox="0 0 24 24" width={m.tam} height={m.tam} style={{
            position: 'fixed', left: `${m.left}%`, bottom: -40, opacity: m.op, pointerEvents: 'none',
            animation: `pr-subir ${m.dur}s linear ${m.atraso}s infinite`, '--rot': `${m.rot}deg`,
          }}>
            <g fill="none" stroke={T.giz} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {m.tipo === 'x' && <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>}
              {m.tipo === 'o' && <circle cx="12" cy="12" r="8" />}
              {m.tipo === 'seta' && <><path d="M4 18 Q10 6 19 7" /><path d="M14 4 L19 7 L15.5 11.5" /></>}
              {m.tipo === 'cone' && <><path d="M12 3 L18 19 L6 19 Z" /><path d="M8.6 12.5 L15.4 12.5" /><path d="M4 21 L20 21" /></>}
            </g>
          </svg>
        )
      ))}
      {/* centrado na página (na vertical e na horizontal); com ecrãs
          baixos, desliza normalmente */}
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px 28px', boxSizing: 'border-box', position: 'relative' }}>
      <style>{`
        @keyframes pr-giz { from { stroke-dashoffset: 260; } to { stroke-dashoffset: 0; } }
        @keyframes pr-ponta { 0%, 70% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes pr-alvo { 0%, 55% { transform: scale(.4); opacity: 0; } 80% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pr-alvo-pulsar { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.35); } 50% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } }
        @keyframes pr-folha { from { transform: perspective(900px) rotateX(-75deg); opacity: 0; } to { transform: perspective(900px) rotateX(0); opacity: 1; } }
        @keyframes pr-carimbo { 0% { transform: rotate(-12deg) scale(1.8); opacity: 0; } 100% { transform: rotate(-12deg) scale(1); opacity: .9; } }
        @keyframes pr-subir { 0% { transform: translateY(0) rotate(var(--rot)); } 100% { transform: translateY(-120vh) rotate(calc(var(--rot) + 220deg)); } }
        @keyframes pr-entrar { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      `}</style>
      {/* data-entrada-anima: a prancheta entra enquanto a porta abre (como a
          camisola dos parabéns). Em pausa, ficava invisível até a porta
          acabar e o ecrã parecia vazio durante quase 1 s. */}
      <div data-entrada-anima="" style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14, animation: 'pr-entrar .5s ease-out both' }}>

        {/* A PRANCHETA */}
        <div style={{ position: 'relative', background: 'linear-gradient(160deg, #3b2a1d 0%, #24180f 100%)', borderRadius: 18, padding: '30px 14px 16px', boxShadow: '0 20px 44px rgba(0,0,0,.5)' }}>
          {/* o título no topo da prancheta: só as letras, a amarelo */}
          <div style={{
            position: 'absolute', top: 9, left: 0, right: 0, textAlign: 'center', whiteSpace: 'nowrap',
            color: T.gold, fontSize: 11, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase',
          }}>{cabecalho || 'Instruções do mister'}{tarefas.length > 1 ? ` · ${i + 1}/${tarefas.length}` : ''}</div>

          {/* o quadro verde, com o campo a giz */}
          <div key={`q${folha}`} style={{ position: 'relative', background: 'linear-gradient(160deg, #2f5d3a 0%, #1f4429 100%)', borderRadius: 10, overflow: 'hidden', border: '3px solid #6b4b2e' }}>
            <svg viewBox="0 0 300 160" width="100%" style={{ display: 'block' }}>
              {/* O campo todo a giz: linhas, meio-campo, grandes e pequenas
                  áreas, marcas e arcos de penálti, cantos e as balizas. */}
              <g stroke={giz} strokeWidth="1.6" fill="none" opacity=".55" strokeLinecap="round">
                <rect x="10" y="10" width="280" height="140" rx="1" />
                <line x1="150" y1="10" x2="150" y2="150" />
                <circle cx="150" cy="80" r="20" />
                {/* grandes áreas */}
                <rect x="10" y="44" width="38" height="72" />
                <rect x="252" y="44" width="38" height="72" />
                {/* pequenas áreas */}
                <rect x="10" y="64" width="14" height="32" />
                <rect x="276" y="64" width="14" height="32" />
                {/* arcos da grande área */}
                <path d="M48 69.5 A16 16 0 0 1 48 90.5" />
                <path d="M252 69.5 A16 16 0 0 0 252 90.5" />
                {/* cantos */}
                <path d="M10 15 A5 5 0 0 0 15 10" /><path d="M285 10 A5 5 0 0 0 290 15" />
                <path d="M10 145 A5 5 0 0 1 15 150" /><path d="M285 150 A5 5 0 0 1 290 145" />
              </g>
              {/* marcas de penálti e o centro */}
              <g fill={giz} opacity=".7">
                <circle cx="36" cy="80" r="1.6" /><circle cx="264" cy="80" r="1.6" /><circle cx="150" cy="80" r="1.6" />
              </g>
              {/* as balizas (fora da linha de fundo, com rede) */}
              <g stroke={giz} fill="none" opacity=".75" strokeWidth="1.6">
                <rect x="3" y="70" width="7" height="20" />
                <rect x="290" y="70" width="7" height="20" />
              </g>
              <g stroke={giz} opacity=".3" strokeWidth=".8">
                {[73.5, 77, 80.5, 84, 87.5].map(y => <g key={y}><line x1="3" y1={y} x2="10" y2={y} /><line x1="290" y1={y} x2="297" y2={y} /></g>)}
              </g>
              {/* os adversários (cruzes de giz) */}
              <g stroke={giz} strokeWidth="2" strokeLinecap="round" opacity=".7">
                {[[160, 52], [185, 118], [210, 82]].map(([x, y], k) => (
                  <g key={k}><line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} /><line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} /></g>
                ))}
              </g>
              {/* a jogada: do jogador ao objetivo */}
              <path d={`M${pos.x} ${pos.y} C ${pos.x + 42} ${pos.y + 23}, 165 30, 228 64`} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"
                strokeDasharray="6 5" style={{ strokeDasharray: 260, animation: 'pr-giz 1.3s ease-out .35s both' }} />
              <path d="M219 56 L230 65 L216 69" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'pr-ponta 1.7s ease-out both' }} />
            </svg>
            {/* o íman do jogador */}
            <div style={{
              position: 'absolute', left: `${(pos.x / 300) * 100}%`, top: `${(pos.y / 160) * 100}%`, transform: 'translate(-50%,-50%)',
              // Íman na cor do clube (a mesma da app): brilho, cor e sombra tirados dela,
              // e o número a branco ou escuro conforme a cor seja escura ou clara.
              width: 34, height: 34, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${corIman.claro}, ${corIman.base} 60%, ${corIman.contorno})`,
              border: '2px solid #fff', boxShadow: '0 3px 6px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: corIman.texto, fontSize: 13, fontWeight: 800, ...mono,
            }}>{marca}</div>
            {/* o objetivo (o destino da missão) */}
            <div style={{
              position: 'absolute', left: `${(242 / 300) * 100}%`, top: `${(60 / 160) * 100}%`, transform: 'translate(-50%,-50%)',
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', border: '2.5px dashed #fff', background: 'rgba(255,255,255,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pr-alvo 1.9s ease-out both, pr-alvo-pulsar 2s ease-in-out 2s infinite',
              }}><Ic size={22} color="#fff" /></div>
            </div>
          </div>
          {/* O objetivo, escrito na madeira por baixo do quadro (dentro do
              quadro ficava em cima da linha lateral e não se lia). */}
          <div style={{ marginTop: 7, textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,.72)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
            Objetivo
          </div>

          {/* AS FOLHAS — todas empilhadas no mesmo sítio (só a da missão
              atual se vê). Assim a prancheta tem sempre a altura da folha
              mais comprida e a página NÃO MEXE ao passar de uma missão para
              outra; os botões em baixo também ficam sempre no mesmo sítio. */}
          <div style={{ display: 'grid', marginTop: 12 }}>
            {tarefas.map((tt, k) => {
              const ativa = k === Math.min(i, tarefas.length - 1);
              const pz = prazoDe(tt);
              const tit = String(tt.titulo || '').trim();
              const tb = tit ? tit.charAt(0).toUpperCase() + tit.slice(1) : (destinoDe ? destinoDe(tt) : destinoMissao(tt.destino)).rotulo;
              return (
          <div data-entrada-anima="" key={ativa ? `f${folha}` : `o${tt.id}`} aria-hidden={!ativa} style={{
            gridArea: '1 / 1', visibility: ativa ? 'visible' : 'hidden',
            /* ESCRITO NAS LINHAS: a folha tem uma linha a cada 26 px e todo o
               texto anda nesse mesmo passo (altura de linha 26 px, sem margens
               soltas) — as letras assentam nas linhas, como à mão. */
            position: 'relative', background: '#FBF8EF', borderRadius: 6, padding: '8px 16px 26px 26px', color: '#1d2a22',
            /* A risca fica 1 px abaixo da linha de base do texto (≈18 px dentro
               de cada linha de 26 px), para as letras pousarem nela. */
            backgroundImage: 'linear-gradient(180deg, transparent 0, transparent 19.5px, rgba(60,110,170,.26) 19.5px, rgba(60,110,170,.26) 20.5px, transparent 20.5px)',
            backgroundSize: '100% 26px', backgroundPosition: '0 8px', backgroundRepeat: 'repeat-y',
            boxShadow: '0 2px 0 #e7e1cf, 0 4px 0 #ddd6c2', transformOrigin: '50% 0', animation: ativa ? 'pr-folha .55s ease-out both' : 'none',
          }}>
            <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 1.5, background: 'rgba(200,60,60,.45)' }} />
            {pz && (
              <div style={{
                position: 'absolute', right: 12, top: 12, border: `2px solid ${pz.cor}`, color: pz.cor, borderRadius: 6,
                padding: '2px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                animation: ativa ? 'pr-carimbo .4s ease-out .9s both' : 'none',
              }}>Prazo · {pz.txt}</div>
            )}
            <div style={{ fontSize: 11, color: '#6b6b5f', letterSpacing: '.12em', textTransform: 'uppercase', lineHeight: '26px' }}>
              Para {nomeJ ? nomeJ.split(/\s+/)[0] : 'ti'}{tt.passoTxt ? ` · ${tt.passoTxt}` : ''}
            </div>
            <div style={{ ...display, fontSize: 23, lineHeight: '26px', color: '#14231a', paddingRight: pz ? 92 : 0, position: 'relative', top: -5 }}>{tb}</div>
            {tt.notas && <div style={{ fontSize: 14.5, lineHeight: '26px', color: '#2b3a30', whiteSpace: 'pre-wrap' }}>{tt.notas}</div>}
          </div>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={() => onIr(t)} disabled={fechadoAgora} style={{
          width: '100%', padding: '15px 18px', borderRadius: 14, border: 'none', cursor: fechadoAgora ? 'default' : 'pointer',
          background: fechadoAgora ? T.surfaceRaise : T.crimson, color: fechadoAgora ? T.mutedDim : TEXT_ON_ACCENT,
          fontSize: 16, fontWeight: 800, ...body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: fechadoAgora ? 'none' : '0 8px 20px rgba(0,0,0,.35)',
        }}>
          {fechadoAgora ? 'Ainda fechado — volta mais tarde' : <>Bora! {t.acao || d.acao} <ArrowRight size={18} /></>}
        </button>
        {/* sempre no lugar (só se esconde) — para os botões de baixo não saltarem entre missões */}
        {dicaDe ? (
          <div style={{ fontSize: 11.5, color: T.mutedDim, textAlign: 'center', marginTop: -6, minHeight: 17, lineHeight: 1.45 }}>{dicaDe(t) || ''}</div>
        ) : (
          <div style={{ fontSize: 11.5, color: T.mutedDim, textAlign: 'center', marginTop: -6, visibility: d.auto && !t._jogo && !fechadoAgora ? 'visible' : 'hidden' }}>{t.destino === 'clipe' ? 'Fica feita quando gravares o clipe.' : 'Fica feita assim que submeteres.'}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: tarefas.length > 1 ? 'space-between' : 'center', gap: 10 }}>
          <button type="button" onClick={() => { onAdiar(t.id); mudar(0); }} style={{
            background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', fontSize: 13.5, ...body, padding: 6,
          }}>Mais tarde</button>
          {tarefas.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" disabled={i === 0} onClick={() => mudar(Math.max(0, i - 1))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, padding: 6, cursor: 'pointer', opacity: i === 0 ? 0.35 : 1, display: 'flex' }}><ChevronLeft size={15} /></button>
              <div style={{ display: 'flex', gap: 5 }}>
                {tarefas.map((x, k) => <span key={x.id} style={{ width: 7, height: 7, borderRadius: '50%', background: k === i ? T.warn : T.line }} />)}
              </div>
              <button type="button" disabled={i >= tarefas.length - 1} onClick={() => mudar(Math.min(tarefas.length - 1, i + 1))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, padding: 6, cursor: 'pointer', opacity: i >= tarefas.length - 1 ? 0.35 : 1, display: 'flex' }}><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

