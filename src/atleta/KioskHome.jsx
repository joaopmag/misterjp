// atleta/KioskHome.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr } from '../base/utilidades';
import { T, mono, body, display, T_ESCURO } from '../base/tema';
import { Flame, PartyPopper, Megaphone, ChevronRight, Check, Clock, ArrowRight, LogOut, Play } from 'lucide-react';
import { P } from '../tatico/prancheta';
import React, { useState, useEffect, useRef } from 'react';
import { CHECKIN_WINDOWS, fmtMinutesOfDay, greetingNow } from './janelas';
import { BolaFutebol, coresCamisola } from './ecras';
import { entradaRecente } from './PortalEntrada';
import { pkhBalneario } from './balneario';
import { dataDeHojeExtenso } from '../base/formatos';

/* SEQUÊNCIA DE RESPOSTAS — substitui o calendário antigo.

   Sem "responder por trás" (CHECKIN_ALLOW_BACKFILL a false), um
   calendário onde só o dia de hoje é clicável não servia para nada —
   os dias passados eram só histórico visual preso atrás de um
   seletor. Isto é mais direto: conta quantos dias seguidos, a contar
   de hoje para trás, o atleta respondeu ao Wellness (o questionário
   que existe todos os dias, ao contrário do RPE, que só existe em
   dias com sessão). Se hoje ainda não respondeu, a sequência conta a
   partir de ontem — não fica a zero só porque ainda é cedo.

   Limitada aos mesmos `CHECKIN_DAYS_BACK` dias que a app já trazia
   para o histórico — não é preciso pedir mais nada ao servidor. */
/* `sequenciaWellness` deixou de ser usada pelo StreakCard — a chama
   passou a seguir a mesma regra (Wellness + PSE, autónomo, com o mesmo
   reinício) que a tarefa da sequência (META_SEQUENCIA dias), calculada no servidor por
   `checkin_sequencia_wellness_pse` (o "autónomo" depende de
   updated_by_email, que o quiosque não recebe). Fica cá só por se
   algures ainda for útil um dia — não faz mal nenhum ficar sem uso. */
export function sequenciaWellness(recentDates, dayStatus) {
  const hoje = todayStr();
  let i = recentDates.length - 1;
  if (recentDates[i] === hoje && !(dayStatus[recentDates[i]] && dayStatus[recentDates[i]].wellness)) i--;
  let count = 0;
  for (; i >= 0; i--) {
    if (dayStatus[recentDates[i]] && dayStatus[recentDates[i]].wellness) count++;
    else break;
  }
  return count;
}

/* Frases motivacionais do cartão da chama — uma por dia, escolhida de
   forma determinística a partir da data (mesmo texto o dia inteiro,
   muda sozinho à meia-noite). Não precisa de nada guardado na base de
   dados: cada telemóvel calcula a mesma conta a partir da mesma data e
   chega sempre à mesma frase. */
export const CHAMA_MENSAGENS = [
  'Não deixes a chama apagar hoje!',
  'Um dia de cada vez, a chama continua acesa.',
  'Protege a tua sequência a todo o custo.',
  'O esforço de hoje garante a chama de amanhã.',
  'A chama não se acende sozinha, precisa da tua ação.',
  'Disciplina é manter o fogo aceso mesmo quando não apetece.',
  'Não quebres a corrente. Tu consegues.',
  'A consistência é o que transforma uma faísca numa fogueira.',
  'O teu futuro agradece o esforço que fazes hoje.',
  'Pequenos passos diários criam grandes mudanças.',
  'A chama brilha mais forte a cada dia que vences.',
  'Chama acesa, foco no treino. Só faltas tu responder.',
  'Mantém a corrente. O teu recorde continua hoje.',
  'Minuto 90: Última oportunidade para manter a chama viva!',
  'Atleta de elite não falha a rotina. Mantém o teu fogo aceso.',
  'O teu rendimento começa aqui. Atualiza o teu estado físico.',
  'Evita lesões, joga sempre. Responde ao questionário do dia.',
  'Consistência no telemóvel, consistência no relvado. Segue a sequência.',
  'Mostra a tua disciplina. Alimenta a chama do teu progresso.',
  'Capitão da consistência: mantém a tua chama ao mais alto nível.',
  'A equipa não falha. Garante os teus 3 pontos de hoje no questionário.',
  'Quem tem a chama mais forte no balneário? Não deixes a tua apagar.',
  'Treino invisível: é muito importante para a tua evolução.',
  'Rumo ao topo. Cada dia respondido é uma vitória na tua rotina.',
  'Como acordou o craque? Alimenta a tua chama e avalia o teu sono!',
  'Check-in matinal: diz-nos como te sentes e garante mais um dia rumo ao teu objetivo.',
  'Corpo descansado, chama acesa. Responde ao questionário de hoje.',
  'Mantém o foco: falta pouco para desbloqueares o teu prémio!',
  'A caminho do bónus! Mantém a chama acesa hoje e protege o teu recorde.',
  'Disciplina de elite: quem for mais consistente, vai ter sucesso!',
  'O teu corpo é a tua ferramenta de trabalho. Cuida dele hoje.',
  'Craque não falha nos pormenores. Faz o teu check-in diário.',
  'Dormir bem e recuperar também é treinar.',
  'O profissionalismo mede-se nas pequenas rotinas diárias.',
  'Quem quer jogar ao mais alto nível, não facilita no descanso.',
  'Monitorizar o corpo é o primeiro passo para evitar a bancada.',
  'Não fiques para trás. O balneário já está todo focado!',
  'Ganha a titularidade na disciplina. Alimenta a chama hoje.',
  'No relvado dás tudo, no telemóvel não podes falhar.',
  'Deixas a chama apagar ou vais aguentar a pressão?',
  'Menos desculpas, mais consistência. Responde ao questionário.',
  'Mostra a raça de campeão também fora das quatro linhas.',
  'O esforço de ontem determina a recuperação de hoje. Diz-nos como estás.',
  'Escuta o teu corpo antes que ele te obrigue a parar.',
  'Sentes dores ou cansaço? O mister precisa de saber para te proteger.',
  'Ajustar a carga de treino hoje é garantir o teu golo no fim de semana.',
  'Como está o motor hoje? Regista o teu nível de energia.',
  'A chama continua a arder e o prémio está cada vez mais perto!',
  'Só os mais disciplinados vão receber o prémio final. Vais ser um deles?',
];

export function mensagemChamaDoDia(hoje) {
  // Hash simples e estável (não precisa de ser criptográfico, só de dar
  // sempre o mesmo número para a mesma data em qualquer telemóvel).
  let h = 0;
  for (let i = 0; i < hoje.length; i++) h = (h * 31 + hoje.charCodeAt(i)) >>> 0;
  return CHAMA_MENSAGENS[h % CHAMA_MENSAGENS.length];
}

export function StreakCard({ dias }) {
  dias = dias || 0;
  const mensagem = mensagemChamaDoDia(todayStr());
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22,
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px',
    }}>
      <Flame size={26} color={dias > 0 ? T.gold : T.mutedDim} strokeWidth={1.6} style={{ flexShrink: 0 }} />
      <span>
        <span style={{ display: 'block', fontSize: 13, color: T.cream, lineHeight: 1.4 }}>{mensagem}</span>
        {dias > 0 && (
          <span style={{ display: 'block', fontSize: 11, color: T.mutedDim, marginTop: 3 }}>
            {dias} {dias === 1 ? 'dia seguido' : 'dias seguidos'} a responder ao Wellness.
          </span>
        )}
      </span>
    </div>
  );
}

/* ===================================================================
   PÁGINA INICIAL DO PORTAL — "O DIA É UM JOGO"
   ===================================================================
   O dia do atleta tem a forma de um jogo: o Wellness é a 1.ª parte
   (CHECKIN_WINDOWS.wellness), o PSE é a 2.ª (CHECKIN_WINDOWS.rpe) e os
   minutos entre as duas são o intervalo. Tudo num só ecrã, fixo, sem
   scroll — nada mexe a página quando se toca em alguma coisa.
   · PLACARD: as horas, a parte do dia e quanto falta para fechar; por
     baixo, o resultado Wellness–PSE (cada questionário respondido é um
     golo).
   · PAINEL LED DO MISTER (colado à linha lateral da prancheta): a voz do
     mister, sempre a correr. Em véspera/dia de jogo anuncia o jogo e leva
     à área Jogo do Portal; com missões por fazer, leva a cada missão;
     sem nada, "Sem missões pendentes". Várias mensagens passam uma de
     cada vez e o toque vai para a que está a passar.
   · PRANCHETA: o campo como linha do tempo — o íman do jogador anda com
     a hora do dia; cada baliza é um questionário.
   · GRAFISMO DA SEQUÊNCIA: os dias seguidos da chama + a frase do dia.
   · BALNEÁRIO: a entrada do Portal. A TV da análise ao fundo, e o cacifo
     do próprio jogador iluminado, com a camisola dele (nome e número) e a
     fotografia do plantel.
   Os horários vêm sempre de CHECKIN_WINDOWS: mudar lá muda aqui. */
export const PKH_TICKER = 'IDEIA DE JOGO · TREINO · SALA DE VÍDEO · JOGO · COMPETIÇÃO · DESENVOLVIMENTO · TAREFAS';

// Ecrã fixo, sem scroll: não se reserva o espaço da barra de scroll (a regra
// geral do Portal "scrollbar-gutter: stable" deixava aqui uma faixa branca
// à direita, muito visível na app instalada) e o fundo da janela é o da app.
export const PKH_CSS = `
  html, body { overflow: hidden !important; overscroll-behavior: none; }
  html { scrollbar-gutter: auto !important; background: ${T.bg}; }
  body { background: ${T.bg}; }
  @keyframes pkh-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(201,162,39,.55); } 50% { box-shadow: 0 0 0 8px rgba(201,162,39,0); } }
  @keyframes pkh-pisca { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  @keyframes pkh-subir {
    0% { transform: translateY(calc(108vh - var(--y))) rotate(var(--rot)); }
    100% { transform: translateY(calc(-1 * var(--y) - 12vh)) rotate(calc(var(--rot) + 220deg)); }
  }
`;

// Posição (x) do íman no campo para um minuto do dia; null = antes de abrir.
export function pkhXDoMinuto(m) {
  const W = CHECKIN_WINDOWS.wellness, P = CHECKIN_WINDOWS.rpe;
  if (m < W.startMin) return null;
  if (m <= W.endMin) return 12 + ((m - W.startMin) / Math.max(1, W.endMin - W.startMin)) * 134;
  if (m < P.startMin) return 150;
  if (m <= P.endMin) return 154 + ((m - P.startMin) / Math.max(1, P.endMin - P.startMin)) * 134;
  return 288;
}

export const pkhY = (x) => 75 + 24 * Math.sin(((x - 12) / 276) * Math.PI * 3);

/* PLACARD (fino): só o que um placard a sério mostra — a hora à esquerda,
   o resultado do dia ao centro (Wellness – PSE) e a chama dos dias
   seguidos à direita. A parte do dia vê-se no campo, logo por baixo. */
export function PkhPlacard({ hora, golosW, golosP, dias, g }) {
  const led = { ...mono, color: '#FFC23D' };
  return (
    <div style={{
      flexShrink: 0, height: g ? 46 : 38, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      padding: g ? '0 16px' : '0 12px', background: '#07090a', border: '3px solid #2a2f33', borderBottom: 0, borderRadius: '12px 12px 0 0',
      backgroundImage: 'radial-gradient(rgba(255,194,61,.08) 1px, transparent 1.3px)', backgroundSize: '5px 5px',
    }}>
      <span style={{ ...led, fontSize: g ? 15 : 12.5, letterSpacing: '.12em', opacity: 0.85 }}>{hora}</span>
      <span style={{ ...led, fontSize: g ? 27 : 21, fontWeight: 700, letterSpacing: '.06em', lineHeight: 1 }} aria-label={`Wellness ${golosW}, PSE ${golosP}`}>{golosW} – {golosP}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }} title={`${dias} ${dias === 1 ? 'dia seguido' : 'dias seguidos'}`}>
        <Flame size={g ? 18 : 15} color={dias > 0 ? '#C9A227' : '#5f6b63'} />
        <span style={{ ...mono, fontSize: g ? 16 : 13, fontWeight: 700, color: dias > 0 ? '#F2EDE0' : '#8A9A8C' }}>{dias}</span>
      </span>
    </div>
  );
}

export function PkhBolaMini({ size = 13, color = '#1A2A1F' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2" />
      <path d="M12 7.5 L16 10.4 L14.5 15 L9.5 15 L8 10.4 Z" fill={color} />
    </svg>
  );
}

/* MISTER — só aparece quando tem algo a dizer (jogo, missão, aniversário).
   Texto parado, numa frase; com mais de uma mensagem, a seta passa à
   seguinte. Tocar no texto leva ao sítio da mensagem. */
export function PkhMister({ mensagens, g, estilo }) {
  const lista = (mensagens || []).filter(m => m && m.tipo !== 'nada');
  const [idx, setIdx] = useState(0);
  const chave = lista.map(m => `${m.tipo}:${m.texto}`).join('|');
  useEffect(() => { setIdx(0); }, [chave]);
  if (!lista.length) return null;
  const atual = lista[idx % lista.length];
  const tocavel = typeof atual.onTocar === 'function';
  const frase = String(atual.texto || '').replace(/\s*▸\s*/g, '. ').trim();
  const cor = atual.tipo === 'jogo' ? '#F2EDE0' : '#FFC23D';
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'stretch', minHeight: g ? 44 : 36, background: '#050607', border: '2px solid #2a2f33',
      borderRadius: 8, overflow: 'hidden', ...(estilo || {}),
    }}>
      <span style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: g ? '0 12px' : '0 8px', background: T.goldFundo,
        color: '#1A2A1F', fontSize: g ? 13 : 11, fontWeight: 600, letterSpacing: '.04em', ...body,
      }}>
        {atual.tipo === 'jogo' ? <PkhBolaMini /> : atual.tipo === 'festa' ? <PartyPopper size={13} /> : <Megaphone size={13} />}
        Mister
      </span>
      <button type="button" onClick={() => { if (tocavel) atual.onTocar(); }} style={{
        flex: 1, minWidth: 0, background: 'none', border: 0, padding: g ? '7px 12px' : '5px 10px', textAlign: 'left', cursor: tocavel ? 'pointer' : 'default',
        ...body, fontSize: g ? 14.5 : 12, lineHeight: 1.3, color: cor, display: 'flex', alignItems: 'center',
      }}>
        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{frase}</span>
      </button>
      {lista.length > 1 && (
        <button type="button" onClick={() => setIdx(i => i + 1)} aria-label="Mensagem seguinte" style={{
          flexShrink: 0, background: 'none', border: 0, borderLeft: '1px solid #2a2f33', color: '#8A9A8C', padding: '0 9px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 2, ...mono, fontSize: 11,
        }}>{(idx % lista.length) + 1}/{lista.length}<ChevronRight size={13} /></button>
      )}
    </div>
  );
}

/* O CAMPO = os dois questionários. Cada metade (da linha lateral à linha
   do meio-campo, entre as duas linhas de fundo) é o botão do Wellness e o
   da PSE. A metade por responder AGORA tem contorno dourado e pisca
   devagar; a outra fica escurecida, com o estado escrito. */
export function PkhCampo({ apagado, noite, wEstado, wTexto, pEstado, pTexto, semSegunda, onWellness, onPse, g, largo }) {
  /* O CAMPO EM PERSPETIVA, NOITE DE JOGO (a combinar com o balneário
     premium): visto da bancada, com bancada escura e público na cor da
     equipa ao fundo, placas LED douradas, relva às riscas, linhas
     branco-quente com brilho, balizas nas pontas e holofotes quentes nos
     cantos. Cada metade é o botão do Wellness e o da PSE: por responder =
     dourado a pulsar; feito = verde com ✓; fechado = escurecido.
     O desenho continua para os lados do quadro (relva e bancada): em ecrãs
     largos o painel enche-se sem esticar nem achatar o campo. */
  const eq = coresCamisola(T.corEquipa);
  /* Largura do desenho = proporção real do painel (altura fixa 170): em
     ecrãs largos o campo alarga-se em perspetiva (como visto da bancada
     lateral), em vez de ficar pequeno ao centro. */
  const caixaRef = useRef(null);
  const [W, setW] = useState(300);
  /* Medido ANTES de pintar (useLayoutEffect): com useEffect, ao voltar ao
     ecrã inicial via-se primeiro o campo estreito (300) e logo a seguir o
     campo alargado — a imagem dava um salto. */
  React.useLayoutEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const nw = Math.round(Math.max(300, Math.min(620, (170 * w) / h)));
      setW(v => (Math.abs(v - nw) > 2 ? nw : v));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  const TP = { y: 34, x0: W * 0.193, x1: W * 0.807 }, BT = { y: 162, x0: 6, x1: W - 6 };
  const P = (u, v) => {
    const xt = TP.x0 + (TP.x1 - TP.x0) * u, xb = BT.x0 + (BT.x1 - BT.x0) * u;
    return [xt + (xb - xt) * v, TP.y + (BT.y - TP.y) * v];
  };
  const pp = a => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const quad = (u0, u1, v0, v1) => pp([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]);
  const elipse = (cu, cv, ru, rv) => pp(Array.from({ length: 41 }, (_, i) => { const t = (i / 40) * 2 * Math.PI; return P(cu + ru * Math.cos(t), cv + rv * Math.sin(t)); }));
  const linhas = (
    <>
      <polygon points={quad(0, 1, 0, 1)} /><polyline points={pp([P(0.5, 0), P(0.5, 1)])} /><polyline points={elipse(0.5, 0.5, 0.075, 0.16)} />
      <polygon points={quad(0, 0.15, 0.22, 0.78)} /><polygon points={quad(0.85, 1, 0.22, 0.78)} />
      <polygon points={quad(0, 0.055, 0.37, 0.63)} /><polygon points={quad(0.945, 1, 0.37, 0.63)} />
    </>
  );
  const baliza = (u, dir) => {
    const a = P(u, 0.42), b = P(u, 0.58), h = (b[1] - a[1]) * 0.55 + 6, d = dir * 7;
    return (
      <g key={u}>
        <polygon points={pp([a, b, [b[0] + d, b[1] - 3], [a[0] + d, a[1] - 3]])} fill="rgba(255,255,255,.12)" />
        <polyline points={pp([a, [a[0], a[1] - h], [b[0], b[1] - h], b])} fill="none" stroke={apagado ? "#5d6b66" : "#fff"} strokeWidth="1.5" />
      </g>
    );
  };
  const metade = (lado, nome, estado, texto, onClick) => {
    const aberto = estado === 'aberto', feito = estado === 'feito';
    const t = String(texto || '');
    const [cx, cy] = P(lado === 'w' ? 0.27 : 0.73, 0.5);
    const corTxt = feito ? '#8EE6A0' : aberto ? '#FFC23D' : 'rgba(255,255,255,.75)';
    const halo = { stroke: apagado ? '#0d2117' : '#163d27', strokeWidth: 3.2, paintOrder: 'stroke', strokeLinejoin: 'round' };
    const zona = lado === 'w' ? quad(0, 0.5, 0, 1) : quad(0.5, 1, 0, 1);
    return (
      <g role="button" tabIndex={aberto ? 0 : -1} aria-label={`${nome}: ${t}`} aria-disabled={!aberto}
        onClick={() => { if (aberto && onClick) onClick(); }}
        onKeyDown={(e) => { if (aberto && onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
        style={{ cursor: aberto ? 'pointer' : 'default', outline: 'none' }}>
        <polygon points={zona}
          fill={feito ? 'rgba(120,220,140,.16)' : aberto ? 'rgba(201,162,39,.18)' : 'rgba(0,0,0,.28)'}
          stroke={aberto ? '#E9C24A' : feito ? '#8EE6A0' : 'none'} strokeWidth={aberto ? 2.4 : 1.6}>
          {aberto && <animate attributeName="stroke-opacity" values="1;.35;1" dur="1.8s" repeatCount="indefinite" />}
        </polygon>
        <text x={cx} y={cy - 6} dominantBaseline="central" textAnchor="middle" fontSize="16" fontWeight="600" letterSpacing="1"
          fill={feito || aberto ? '#fff' : 'rgba(255,255,255,.82)'} fontFamily="Oswald, sans-serif" style={halo}>{nome}</text>
        <text x={cx} y={cy + 10} dominantBaseline="central" textAnchor="middle" fontSize="8.5" fill={corTxt} fontFamily="Inter, sans-serif" style={halo}>{feito ? `✓ ${t}` : t}</text>
      </g>
    );
  };
  // Público na bancada: pontinhos na cor da equipa (de -300 a 600 para encher ecrãs largos).
  const publico = [];
  for (let i = -60; i < Math.ceil(W / 5) + 60; i++) publico.push(<rect key={i} x={i * 5 + 1} y={15 + (((i % 3) + 3) % 3) * 5} width="3" height="3" fill={apagado ? '#1c211f' : (i % 4 ? eq.escuro : eq.base)} opacity=".8" />);
  return (
    <div style={{
      background: '#0b0d0c', border: '3px solid #2a2f33', borderTop: 0, borderRadius: '0 0 12px 12px', overflow: 'hidden', flexShrink: 0,
      filter: noite ? 'brightness(.5) saturate(.6)' : 'none', transition: 'filter .8s',
    }}>
      <svg ref={caixaRef} viewBox={`0 0 ${W} 170`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: largo ? (g ? '24dvh' : '27dvh') : 'auto', aspectRatio: largo ? undefined : '300 / 170', maxHeight: largo ? 280 : '30dvh' }}>
        <defs>
          <filter id="pkh-campo-led" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
          <radialGradient id="pkh-campo-hol" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFE6A0" stopOpacity=".6" /><stop offset="1" stopColor="#FFE6A0" stopOpacity="0" /></radialGradient>
          <linearGradient id="pkh-campo-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0d0c" /><stop offset="1" stopColor="#151a17" /></linearGradient>
        </defs>
        <g aria-hidden="true">
          <rect x="-300" y="0" width={W + 600} height="170" fill="url(#pkh-campo-ceu)" />
          <rect x="-300" y="12" width={W + 600} height="20" fill="#141a17" />
          {publico}
          <rect x="-300" y="30" width={W + 600} height="5" fill={apagado ? '#2a2618' : '#FFC23D'} />{!apagado && <rect x="-300" y="31.5" width={W + 600} height="2" fill="#FFF4D6" opacity=".6" />}
          <rect x="-300" y="35" width={W + 600} height="135" fill={apagado ? '#132e20' : '#2a6142'} />
          {Array.from({ length: W > 420 ? 16 : 12 }, (_, k, arr) => (k % 2 ? <polygon key={k} points={quad(k / (W > 420 ? 16 : 12), (k + 1) / (W > 420 ? 16 : 12), -0.01, 1.07)} fill={apagado ? '#10281b' : '#24563a'} /> : null))}
          {!apagado && <g fill="none" stroke="#FFF4D6" strokeWidth="3.4" opacity=".35" filter="url(#pkh-campo-led)">{linhas}</g>}
          <g fill="none" stroke={apagado ? '#9fb0c8' : '#FFF4D6'} strokeWidth="1.4" opacity={apagado ? 0.35 : 0.9}>{linhas}</g>
          {baliza(0, -1)}{baliza(1, 1)}
        </g>
        {metade('w', 'WELLNESS', wEstado, wTexto, onWellness)}
        {metade('p', semSegunda ? 'FOLGA' : 'PSE', pEstado, pTexto, onPse)}
        <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
          {!apagado && <><ellipse cx="18" cy="16" rx="60" ry="34" fill="url(#pkh-campo-hol)" /><ellipse cx={W - 18} cy="16" rx="60" ry="34" fill="url(#pkh-campo-hol)" /></>}
          <rect x="8" y="6" width="20" height="7" rx="1.5" fill={apagado ? '#3a3f3c' : '#FFF4D6'} /><rect x={W - 28} y="6" width="20" height="7" rx="1.5" fill={apagado ? '#3a3f3c' : '#FFF4D6'} />
          {apagado && <><circle cx={W / 2 + 70} cy="12" r="5" fill="#dfe6f0" opacity=".85" /><circle cx={W / 2 + 72} cy="10.5" r="4.4" fill="#0b0d0c" /></>}
        </g>
      </svg>
    </div>
  );
}

export function PkhBotaoQuestionario({ nome, estado, texto, onClick, g }) {
  // estado: 'feito' | 'aberto' | 'fechado'
  const corBorda = estado === 'feito' ? T.good : estado === 'aberto' ? T.gold : T.line;
  return (
    <button type="button" onClick={onClick} disabled={estado !== 'aberto'} style={{
      flex: 1, minWidth: 0, height: g ? 70 : 54, boxSizing: 'border-box', borderRadius: 12, padding: g ? '10px 16px' : '7px 10px', textAlign: 'left',
      background: T.surface, border: `1px solid ${corBorda}`, cursor: estado === 'aberto' ? 'pointer' : 'default', overflow: 'hidden', ...body,
    }}>
      <div style={{ ...display, fontSize: g ? 23 : 18, fontWeight: 600, color: T.cream, lineHeight: 1.15 }}>{nome}</div>
      <div style={{
        fontSize: g ? 14 : 11.5, lineHeight: 1.3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 4,
        color: estado === 'feito' ? T.good : estado === 'aberto' ? T.gold : T.warn,
      }}>
        {estado === 'feito' ? <Check size={12} style={{ flexShrink: 0 }} /> : estado === 'fechado' ? <Clock size={12} style={{ flexShrink: 0 }} /> : null}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{texto}</span>
        {estado === 'aberto' && <ArrowRight size={12} style={{ flexShrink: 0 }} />}
      </div>
    </button>
  );
}

export function PkhSequencia({ dias, g }) {
  const frase = mensagemChamaDoDia(todayStr());
  return (
    <div style={{ flexShrink: 0, height: g ? 64 : 58, display: 'flex', alignItems: 'stretch' }}>
      <div style={{
        flexShrink: 0, width: g ? 104 : 76, background: T.goldFundo, clipPath: 'polygon(0 0,100% 0,84% 100%,0 100%)', borderRadius: '8px 0 0 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingRight: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Flame size={18} color={dias > 0 ? '#8a3a12' : '#5f4b10'} />
          <span style={{ ...display, fontSize: g ? 30 : 26, fontWeight: 600, color: '#1A2A1F', lineHeight: 1 }}>{dias}</span>
        </div>
        <div style={{ fontSize: 11, color: '#3b2f0a', lineHeight: 1.1, textAlign: 'center', ...body }}>{dias === 1 ? 'dia seguido' : 'dias seguidos'}</div>
      </div>
      <div style={{
        flex: 1, minWidth: 0, marginLeft: -10, background: '#0d120f', clipPath: 'polygon(13px 0,100% 0,100% 100%,0 100%)',
        padding: '4px 10px 4px 20px', display: 'flex', alignItems: 'center', borderRadius: '0 8px 8px 0',
        borderBottom: `3px solid ${T.gold}`, boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: g ? 14 : 11.5, color: T_ESCURO.cream, lineHeight: 1.28, ...body,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>«{frase}»</div>
      </div>
    </div>
  );
}

/* FAIXAS LATERAIS (só em ecrã largo): o mesmo fundo do ecrã inteiro da
   missão — marcas de giz brancas, quase transparentes, a subir devagar e a
   rodar —, aqui com objetos de futebol desenhados a giz (chuteiras, bolas,
   braçadeiras, meias, balizas, apitos, cones, troféus, camisolas) entre as
   cruzes, círculos e setas. Sem cor, como na missão e na credencial. Ficam
   só nas faixas que sobram: nunca passam por cima do conteúdo. Com
   "reduzir movimento", ficam parados onde estão. */
export const PKH_OBJETOS = ['bola', 'chuteira', 'luvas', 'x', 'bracadeira', 'meia', 'caneleira', 'seta', 'baliza', 'calcoes', 'apito', 'o', 'garrafa', 'cronometro', 'trofeu', 'camisola', 'bandeirola', 'medalha', 'cone'];

export function PkhObjeto({ tipo, tam }) {
  if (tipo === 'bola') return <BolaFutebol tamanho={tam} />;
  const desenho = {
    x: <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>,
    o: <circle cx="12" cy="12" r="8" />,
    seta: <><path d="M4 18 Q10 6 19 7" /><path d="M14 4 L19 7 L15.5 11.5" /></>,
    cone: <><path d="M12 3 L18 19 L6 19 Z" /><path d="M8.6 12.5 L15.4 12.5" /><path d="M4 21 L20 21" /></>,
    chuteira: <><path d="M2 15 Q2.5 11 6 10.5 L11 9.5 Q13 7 15 7 L17 7 Q18 10.5 20.5 12 Q23 13.5 22.5 16 L22.5 17 L2.5 17 Q1.6 16.5 2 15 Z" /><path d="M10 12 L14.5 9.6 M12 13.6 L16.5 11.2" /><path d="M4.5 19.5 h1 M9 19.5 h1 M14.5 19.5 h1 M19 19.5 h1" /></>,
    bracadeira: <><path d="M2 9 Q12 6 22 9 L22 15 Q12 18 2 15 Z" /><path d="M14 10.6 Q12.2 9.7 10.8 10.6 Q9.4 12 10.8 13.4 Q12.2 14.3 14 13.4" /></>,
    meia: <><path d="M9 2 H15 V13 Q15 15 16.5 16 L20 18 Q22.5 20 20.5 21.8 Q19 22.8 16.5 21.6 L9.6 18.4 Q8.4 17.6 8.8 15.8 Z" /><path d="M9 5 H15" /></>,
    baliza: <><path d="M3 19 V6 H21 V19" /><path d="M1 19 H23" /><path d="M7.5 6 V19 M12 6 V19 M16.5 6 V19 M3 10.5 H21 M3 15 H21" strokeWidth="1" opacity=".7" /></>,
    apito: <><path d="M9 9.5 H21 V13.5 H13.5" /><circle cx="9" cy="14" r="5" /><circle cx="9" cy="14" r="1.2" /><path d="M6 4 Q2.5 6.5 5.5 9.5" /></>,
    trofeu: <><path d="M7 3 H17 V9 Q17 14 12 14.5 Q7 14 7 9 Z" /><path d="M7 5 Q3 5 4 8.5 Q5 11 7.5 10.5 M17 5 Q21 5 20 8.5 Q19 11 16.5 10.5" /><path d="M12 14.5 V18 M9 18 H15 V21 H9 Z" /></>,
    camisola: <path d="M7.5 3 L4 5 L2 10 L5 11 V21 H19 V11 L22 10 L20 5 L16.5 3 Q12 6 7.5 3 Z" />,
    luvas: <><path d="M7 21 V12 L5 9.5 Q4 8 5.5 7.3 L8 9.5 V4.5 Q8 3 9.3 3 Q10.6 3 10.6 4.5 V9 M10.6 4 Q10.6 2.5 11.9 2.5 Q13.2 2.5 13.2 4 V9 M13.2 4.5 Q13.2 3 14.5 3 Q15.8 3 15.8 4.5 V9.5 M15.8 6 Q15.8 4.8 17 4.8 Q18.2 4.8 18.2 6 V14 Q18.2 18 15 19 V21 Z" /><path d="M7 17.5 H15.5" /></>,
    caneleira: <><path d="M8 3 Q12 1.5 16 3 L17 17 Q12 22.5 7 17 Z" /><path d="M10 7.5 H14 M10.5 11 H13.5" /></>,
    calcoes: <><path d="M4 4 H20 L21.5 19 H14 L12 11 L10 19 H2.5 Z" /><path d="M4 7 H20" /></>,
    garrafa: <><path d="M10 2 H14 V4 L15.5 6.5 V21 H8.5 V6.5 L10 4 Z" /><path d="M8.5 11 H15.5 M8.5 15 H15.5" /></>,
    cronometro: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 13.5 L15 10.5 M10 2.5 H14 M12 2.5 V6 M18.3 6.2 L19.8 4.7" /></>,
    bandeirola: <><path d="M6 22 V2" /><path d="M6 3 L18.5 6.5 L6 10" /><path d="M3 22 H10" /></>,
    medalha: <><path d="M8 2 L12 9 L16 2" /><circle cx="12" cy="15" r="6" /><path d="M12 12.4 L12.9 14.3 L15 14.5 L13.4 15.9 L13.9 18 L12 16.9 L10.1 18 L10.6 15.9 L9 14.5 L11.1 14.3 Z" strokeWidth="1.2" /></>,
  }[tipo];
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true">
      <g fill="none" stroke={T.giz} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{desenho}</g>
    </svg>
  );
}

/* As marcas de giz das faixas laterais são as MESMAS em todos os ecrãs do
   Portal (balneário, cacifo…) e o movimento segue o relógio: ao passar de
   um ecrã para o outro continuam exatamente onde estavam, em vez de
   saltarem para posições novas (antes eram sorteadas a cada ecrã). */
export const PKH_FAIXAS_ITENS = (() => {
  let semente = 20261017;
  const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
  return [0, 1].flatMap(lado => Array.from({ length: 17 }, (_, k) => ({
    lado, k,
    tipo: PKH_OBJETOS[(k + lado * 9) % PKH_OBJETOS.length],
    left: 6 + rnd() * 70,
    y: rnd() * 100,
    tam: Math.round(24 + rnd() * 26),
    dur: 18 + rnd() * 14,
    rot: Math.round(rnd() * 360),
    op: 0.12 + rnd() * 0.14,
  })));
})();

export function PkhFaixasLaterais({ larguraConteudo }) {
  const itens = PKH_FAIXAS_ITENS;
  // Fase de cada marca a partir do relógio (igual em qualquer ecrã que a desenhe).
  const t0 = React.useMemo(() => Date.now() / 1000, []);
  const larg = `calc((100vw - ${larguraConteudo}) / 2)`;
  return (
    <>
      {[0, 1].map(lado => (
        <div key={lado} aria-hidden="true" style={{
          position: 'absolute', top: 0, bottom: 0, [lado ? 'right' : 'left']: 0, width: larg,
          overflow: 'hidden', pointerEvents: 'none',
        }}>
          {itens.filter(i => i.lado === lado).map(i => (
            <div key={i.k} style={{
              position: 'absolute', left: `${i.left}%`, top: `${i.y}vh`, lineHeight: 0,
              opacity: i.tipo === 'bola' ? i.op + 0.08 : i.op,
              '--y': `${i.y}vh`, '--rot': `${i.rot}deg`,
              // atraso negativo = cada marca já começa a meio do caminho
              animation: `pkh-subir ${i.dur.toFixed(1)}s linear ${(-(((108 - i.y) / 120) * i.dur + t0) % i.dur).toFixed(2)}s infinite`,
            }}>
              <PkhObjeto tipo={i.tipo} tam={i.tam} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/* Ecrã largo = computador (ou tablet deitado). Aí a página alarga-se e
   aparecem as faixas laterais; no telemóvel fica tudo como estava. */
export const PKH_LARGO = '(min-width: 1000px) and (min-aspect-ratio: 5/4)';

export const PKH_LARGURA_LARGA = 'min(41vw, 820px)';

/* Tablet ao alto (iPad na vertical): largo o suficiente para não ficar
   espremido na coluna do telemóvel (460), mas sem as faixas laterais do
   computador. */
export const PKH_TABLET_ALTO = '(min-width: 700px) and (max-aspect-ratio: 5/4)';

export const PKH_LARGURA_TABLET = 'min(88vw, 720px)';

// Imagens do balneário (emblema, fotografia) já carregadas, por endereço.
// Ao reconstruir o SVG, a <image> nova é trocada pela antiga, que já está
// descodificada e pinta logo, em vez de aparecer só um frame depois.
export const PKH_IMG_MEM = new Map();

export function pkhReusarImagens(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('image').forEach(nova => {
    const href = nova.getAttribute('href') || nova.getAttribute('xlink:href');
    if (!href) return;
    const velha = PKH_IMG_MEM.get(href);
    if (!velha || velha === nova) { PKH_IMG_MEM.set(href, nova); return; }
    if (velha.isConnected) return;
    try {
      Array.from(velha.attributes).forEach(at => { if (at.name !== 'href' && at.name !== 'xlink:href' && !nova.hasAttribute(at.name)) velha.removeAttribute(at.name); });
      Array.from(nova.attributes).forEach(at => { if (at.name !== 'href' && at.name !== 'xlink:href') velha.setAttribute(at.name, at.value); });
      nova.replaceWith(velha);
    } catch (e) { PKH_IMG_MEM.set(href, nova); }
  });
}

// Último enquadramento medido do balneário: ao voltar ao ecrã inicial já
// desenha no tamanho certo, sem reajuste no segundo frame.
export const PKH_ENQ_MEM = { v: null };

export function usePkhMedia(q) {
  const [largo, setLargo] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const f = () => setLargo(m.matches);
    f();
    if (m.addEventListener) m.addEventListener('change', f); else m.addListener(f);
    return () => { if (m.removeEventListener) m.removeEventListener('change', f); else m.removeListener(f); };
  }, [q]);
  return largo;
}

export function PlayerKioskHome({ player, equipa, session, selectedDate, doneWellness, doneRpe, wellnessWindow, rpeWindow, onOpenWellness, onOpenRpe, onOpenPortal, onLogout, tarefasPendentes, mensagensMister, diasSequenciaChama }) {
  const isToday = selectedDate === todayStr();
  const isRestDay = !!(session && session.phase === 'Descanso');
  const W = CHECKIN_WINDOWS.wellness, P = CHECKIN_WINDOWS.rpe;
  const agora = new Date();
  const mins = agora.getHours() * 60 + agora.getMinutes();
  const hora = fmtMinutesOfDay(mins);

  const wWin = wellnessWindow || { open: true, reason: '' };
  const rWin = rpeWindow || { open: true, reason: '' };
  const wellnessEnabled = wWin.open && !doneWellness;
  const rpeEnabled = rWin.open && !!session && !isRestDay && !doneRpe;

  // Estados e textos dos dois botões (mesmas regras de sempre).
  const wEstado = doneWellness ? 'feito' : wellnessEnabled ? 'aberto' : 'fechado';
  const wTexto = doneWellness ? 'Golo! Respondido'
    : wellnessEnabled ? `Responder · até ${fmtMinutesOfDay(W.endMin)}`
      : !isToday ? 'Só no próprio dia'
        : mins < W.startMin ? `Abre às ${fmtMinutesOfDay(W.startMin)}` : 'Fechou · fala com o staff';
  const pEstado = doneRpe ? 'feito' : rpeEnabled ? 'aberto' : 'fechado';
  const pTexto = doneRpe ? 'Golo! Respondido'
    : isRestDay ? 'Folga · sem PSE'
      : rpeEnabled ? `Responder · até ${fmtMinutesOfDay(P.endMin)}`
        : !isToday ? 'Só no próprio dia'
          : mins < P.startMin ? `Abre às ${fmtMinutesOfDay(P.startMin)}`
            : mins > P.endMin ? 'Fechou · fala com o staff'
              : 'Ainda sem sessão para hoje';

  // A linha de cima do placard: a parte do dia e o que falta.
  const legenda = !isToday ? 'DIA JÁ FECHADO · SÓ HOJE'
    : mins < W.startMin ? `ESTÁDIO FECHADO · ABRE ÀS ${fmtMinutesOfDay(W.startMin)}`
      : mins <= W.endMin ? (doneWellness ? '1.ª PARTE · JÁ MARCASTE' : '1.ª PARTE')
        : mins < P.startMin ? (isRestDay ? 'FOLGA · SEM 2.ª PARTE' : `INTERVALO · 2.ª PARTE ÀS ${fmtMinutesOfDay(P.startMin)}`)
          : isRestDay ? 'FOLGA · SEM 2.ª PARTE'
            : doneRpe ? '2.ª PARTE · JÁ MARCASTE'
              : mins > P.endMin ? `FIM DO DIA · VOLTA ÀS ${fmtMinutesOfDay(W.startMin)}`
                : !session ? '2.ª PARTE · AINDA SEM SESSÃO'
                  : '2.ª PARTE';

  /* A frase da chama só aparece quando faz falta: a sequência está em risco
     (Wellness por responder e menos de 2 h para fechar) ou bate um número
     redondo (10, 20, 30…) depois de responder. */
  const dias = diasSequenciaChama || 0;
  const fraseChama = (isToday && wellnessEnabled && dias > 0 && mins >= W.endMin - 120)
    ? `O Wellness fecha às ${fmtMinutesOfDay(W.endMin)}. Responde para manteres ${dias === 1 ? 'o dia seguido' : `os ${dias} dias seguidos`}.`
    : (isToday && doneWellness && dias > 0 && dias % 10 === 0)
      ? `${dias} dias seguidos! ${mensagemChamaDoDia(todayStr())}`
      : '';
  const pendente = wellnessEnabled || rpeEnabled;
  const nomeCompleto = String((player && player.name) || '').trim();
  const primeiro = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : 'Atleta';
  const iniciais = nomeCompleto ? nomeCompleto.split(/\s+/).filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase() : '?';
  const numero = player && player.number != null && String(player.number).trim() !== '' ? String(player.number).trim() : '';
  const cor = coresCamisola(T.corEquipa);
  const clube = String((equipa && (equipa.clube || equipa.nome)) || '').trim();
  const nBadge = (tarefasPendentes || []).length;
  /* ENQUADRAMENTO DO BALNEÁRIO. O desenho tem 300×215 e o espaço que
     sobra no ecrã muda de telemóvel para telemóvel. Cortar sempre ao
     centro levava o teto (e o emblema) nos ecrãs mais largos do que
     altos. Aqui mede-se o espaço e escolhe-se a janela: a faixa que
     interessa (do emblema, em cima, até à camisola do jogador) fica
     sempre à vista; o que sobra corta-se no chão. */
  const largo = usePkhMedia(PKH_LARGO);
  const tablet = usePkhMedia(PKH_TABLET_ALTO);
  // Letra maior só se também houver altura (portáteis baixos ficam com os
  // tamanhos do telemóvel, para tudo caber sem cortar o balneário).
  const g = usePkhMedia('(min-height: 820px)') && (largo || tablet);
  const balRef = useRef(null);
  const [enq, setEnqBase] = useState(() => PKH_ENQ_MEM.v || { W: 300, H: 215, vb: '0 0 300 215' });
  const setEnq = f => setEnqBase(prev => { const n = f(prev); PKH_ENQ_MEM.v = n; return n; });
  /* CHEGADA PELA PORTA: o balneário começa no tamanho e no sítio da porta
     e cresce até ao lugar dele; o resto do ecrã aparece logo a seguir. */
  const [chegada] = useState(() => entradaRecente());
  const [faseChegada, setFaseChegada] = useState(chegada ? 'inicio' : 'fim');
  useEffect(() => {
    if (!chegada) return undefined;
    const fim = () => setFaseChegada('fim');
    window.addEventListener('mjp-entrada-fim', fim);
    const seguranca = setTimeout(fim, 4000);
    return () => { window.removeEventListener('mjp-entrada-fim', fim); clearTimeout(seguranca); };
  }, [chegada]);
  const aparecer = undefined;
  React.useLayoutEffect(() => {
    const el = balRef.current;
    if (!el) return undefined;
    const calcular = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      // Ecrã largo: a sala alarga-se (até 780) em vez de se cortar.
      const W = (largo || tablet) ? Math.round(Math.max(300, Math.min(780, (215 * w) / h))) : 300;
      const alturaVisivel = (W * h) / w;
      // Mais alto do que o desenho: a sala estica na vertical (até 420) —
      // nada se corta dos lados e a TV continua ao centro.
      const novo = alturaVisivel >= 215
        ? { W, H: Math.round(Math.min(420, alturaVisivel)), vb: `0 0 ${W} ${Math.round(Math.min(420, alturaVisivel))}` }
        : {
          W, H: 215,
          // Espaço baixo (não cabe do emblema à camisola): o teto fica
          // sempre inteiro e corta-se só o chão.
          vb: `0 ${(alturaVisivel < 162 ? 3 : Math.max(0, Math.min(215 - alturaVisivel, 84 - alturaVisivel / 2))).toFixed(1)} ${W} ${alturaVisivel.toFixed(1)}`,
        };
      /* O botão "Entrar no Portal" fica SEMPRE ao centro, em baixo, por
         baixo da TV e do rodapé. Se não houver espaço (telemóveis baixos),
         a TV sobe e encolhe o necessário — nunca é o botão a mudar de sítio. */
      novo.tv = null;
      if (alturaVisivel < 215) {
        const y0 = Number(novo.vb.split(' ')[1]);
        const unidadesBotao = (46 * alturaVisivel) / h; // ~31 px de botão + margens
        const limite = y0 + alturaVisivel - unidadesBotao;
        const fundoTv = 47.5 + 8 + 78; // fundo natural da TV no desenho
        const fundoVisivel = y0 + alturaVisivel - 3;
        const jogador = fundoVisivel < 153 ? Math.max(0.55, (fundoVisivel - 48) / (153 - 48)) : 1;
        if (limite < fundoTv || jogador < 1) {
          const topo = limite < fundoTv ? 49.5 : 47.5 + 8;
          const escala = limite < fundoTv ? Math.max(0.55, Math.min(1, (limite - topo) / 78)) : 1;
          novo.tv = { topo, escala, jogador };
        }
      }
      const tvChave = t => (t ? `${t.topo}:${t.escala.toFixed(3)}:${t.jogador.toFixed(3)}` : '');
      setEnq(prev => (prev.W === novo.W && prev.H === novo.H && prev.vb === novo.vb && tvChave(prev.tv) === tvChave(novo.tv) ? prev : novo));
    };
    calcular();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', calcular);
      return () => window.removeEventListener('resize', calcular);
    }
    const ro = new ResizeObserver(calcular);
    ro.observe(el);
    return () => ro.disconnect();
  }, [largo, tablet]);
  const luzesApagadas = isToday && mins < W.startMin;
  const svgBalneario = React.useMemo(() => pkhBalneario({
    cor, numero, nome: primeiro, foto: (player && player.photo) || '', iniciais,
    logo: (equipa && equipa.logo) || '', inicialClube: clube ? clube[0].toUpperCase() : '', badge: nBadge,
    /* Vindo da porta: a TV dá as boas-vindas enquanto o balneário cresce e,
       já com o ecrã inteiro, desvanece-se e deixa ver o Portal do Atleta
       (antes era um corte seco). O desenho não muda no fim — só a
       opacidade do grupo, por CSS — para a transição poder correr. */
    boasVindas: chegada ? primeiro : '',
    apagado: luzesApagadas ? 'presenca' : false,
  }, enq.W, enq.H, enq.tv), [luzesApagadas, T.corEquipa, numero, primeiro, player && player.photo, iniciais, equipa && equipa.logo, clube, nBadge, enq.W, enq.H, enq.tv && enq.tv.escala, enq.tv && enq.tv.jogador, chegada]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Emblema no teto e fotografia: reaproveita as mesmas imagens já
     carregadas da visita anterior, para aparecerem no primeiro frame ao
     voltar ao ecrã inicial (uma imagem nova só pinta um frame depois). */
  const svgBalRef = useRef(null);
  React.useLayoutEffect(() => { pkhReusarImagens(svgBalRef.current); }, [svgBalneario]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1, background: T.bg, overflow: 'hidden', overscrollBehavior: 'none',
      touchAction: 'manipulation', ...body,
    }}>
      <style>{PKH_CSS}</style>
      {chegada && <style>{`.pkh-boasvindas { transition: opacity .7s ease-in-out .35s; opacity: ${faseChegada === 'fim' ? 0 : 1}; }`}</style>}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexShrink: 0, ...aparecer }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...display, fontSize: g ? 30 : 22, fontWeight: 600, color: T.cream, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{greetingNow()}, {primeiro}!</div>
            <div style={{ fontSize: g ? 14 : 12, color: T.mutedDim }}>{dataDeHojeExtenso()}</div>
          </div>
          <button type="button" onClick={onLogout} title="Terminar sessão" style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${T.line}`,
            borderRadius: 8, color: T.mutedDim, padding: g ? '8px 14px' : '6px 10px', cursor: 'pointer', ...body, fontSize: g ? 13.5 : 11.5, flexShrink: 0,
          }}>
            <LogOut size={g ? 15 : 13} /> Sair
          </button>
        </div>

        {/* O JOGO DO DIA — placard fino colado ao campo; cada metade do
            campo é o botão do questionário. */}
        <div style={{ flexShrink: 0, ...aparecer }}>
          <PkhPlacard hora={hora} golosW={doneWellness ? 1 : 0} golosP={doneRpe ? 1 : 0} dias={dias} g={g} />
          <PkhCampo
            /* Da meia-noite até abrir o Wellness (06:30) está tudo fechado:
               as luzes do estádio apagam-se (e as do balneário ficam só com
               a luz de presença). */
            apagado={luzesApagadas}
            wEstado={wEstado} wTexto={wTexto} pEstado={pEstado} pTexto={pTexto} semSegunda={isRestDay}
            onWellness={onOpenWellness} onPse={onOpenRpe} g={g} largo={largo}
          />
        </div>

        <PkhMister mensagens={mensagensMister} g={g} estilo={aparecer} />

        {fraseChama && (
          <div style={{ ...aparecer, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: g ? 14 : 12, color: T.muted, lineHeight: 1.3, padding: '0 2px', ...body }}>
            <Flame size={g ? 17 : 15} color={T.gold} style={{ flexShrink: 0 }} />
            <span>{fraseChama}</span>
          </div>
        )}

        {/* BALNEÁRIO — a entrada do Portal (sempre disponível, sem janela horária). */}
        <button ref={balRef} data-entrada-foco="1" type="button" onClick={onOpenPortal} aria-label="Entrar no Portal do Atleta" style={{
          flex: 1, minHeight: g ? 160 : 96, position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.line}`,
          background: '#121614', padding: 0, cursor: 'pointer', display: 'block', width: '100%',
        }}>
          <svg
            viewBox={enq.vb} preserveAspectRatio="xMinYMid slice" width="100%" height="100%"
            style={{ display: 'block', position: 'absolute', inset: 0 }} aria-hidden="true" ref={svgBalRef}
            dangerouslySetInnerHTML={{ __html: svgBalneario }}
          />
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: enq.tv ? 6 : 9, display: 'flex', justifyContent: 'center' }}>
            <span style={{
              background: pendente ? 'rgba(13,18,15,.82)' : T.goldFundo, color: pendente ? '#F2EDE0' : '#1A2A1F',
              border: `1.5px solid ${T.goldFundo}`, borderRadius: 999, padding: g ? '10px 22px' : enq.tv ? '6px 15px' : '7px 16px', fontSize: g ? 16 : 13.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, animation: pendente ? 'none' : 'pkh-pulso 2s ease-in-out infinite', ...body,
            }}>
              <Play size={14} fill={pendente ? T.goldFundo : '#1A2A1F'} color={pendente ? T.goldFundo : '#1A2A1F'} /> Entrar
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

