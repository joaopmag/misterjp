import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Play, Pause, Scissors, Circle, ArrowUpRight, Minus, Eraser, Trash2,
  Copy, Check, Video, Upload, Tag, X, Flag, RotateCcw, Loader2, Film,
  Maximize2, Minimize2, Square, Type, Pencil, Lasso, Waypoints, Undo2, Redo2, ArrowLeft, Eye, User, Share2,
  Target, Crosshair, SkipBack, SkipForward, ChevronDown, ChevronUp, Download, LayoutGrid, Ruler,
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
  goldFundo: '#C9A227',               // dourado de fundo (texto escuro por cima): igual nos dois temas
  campoFundo: '#111', campoTexto: '#fff', // caixas de texto fora do vídeo
};
const TEXT_ON_ACCENT = '#FBF3F0';

/* MODO CLARO — segue a escolha feita na app (mesma chave 'mjp-tema').
   `TV` é a paleta escura fixa: a bancada do vídeo (leitor, barra de
   ferramentas, etiquetas, painel do relvado) fica sempre escura, como
   em qualquer editor de vídeo. O resto (lista de vídeos, clipes,
   janelas) acompanha o tema. Os valores claros são os mesmos da App.jsx:
   se mudarem lá, mudar também aqui. */
const TV = { ...T };
const TEMA = T;
const BancadaVideo = React.createContext(false);
const AV_CLARO = (() => {
  try {
    const v = localStorage.getItem('mjp-tema');
    return v === 'claro' || (v === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  } catch (e) { return false; }
})();
// Etiquetas amarelas/douradas sobre fundo branco: o texto escurece para
// se ler (o traço e o fundo da etiqueta mantêm a cor original).
const ESCURECER_ETIQUETA = { '#C9A227': '#8A6A0E', '#D9A72E': '#A6750F' };
function corTextoEtiqueta(c) {
  return AV_CLARO ? (ESCURECER_ETIQUETA[String(c || '').toUpperCase()] || c) : c;
}
if (AV_CLARO) {
  Object.assign(T, {
    bg: '#F2F4EF', surface: '#FFFFFF', surfaceRaise: '#E7ECE4', line: '#C9D3C6',
    crimson: '#A6192E', crimsonBright: '#B8243A', gold: '#8A6A0E', cream: '#1B2A1D',
    muted: '#4F6352', mutedDim: '#5F7062', good: '#2E7D4A', warn: '#A6750F', bad: '#B23A3A',
    campoFundo: '#FFFFFF', campoTexto: '#1B2A1D',
  });
}

// As ferramentas de desenho em si — estático, não depende de nada do
// componente, por isso também dá para reaproveitar noutros sítios que
// precisem de desenhar por cima de vídeo (ver a Biblioteca).
export const FERRAMENTAS = [
  ['seta', ArrowUpRight, 'Seta'],
  ['linha', Minus, 'Linha'],
  ['circulo', Circle, 'Círculo'],
  ['retangulo', Square, 'Zona'],
  ['cone', Eye, 'Visão'],
  ['livre', Pencil, 'Traço'],
  ['zonalivre', Lasso, 'Zona livre'],
  ['linhaPontos', Waypoints, 'Ligar pontos'],
];
export const COR_DESENHO = '#FFFFFF'; // branco — antes era vermelho por omissão

// O serviço de seguimento automático de jogador é chamado através do
// "porteiro" (/api/seguir-jogador) — a app nunca fala diretamente com
// o Modal, nem sabe o endereço nem a chave secreta dele.

// Onde está o jogador em foco num instante `tempo`, interpolando entre
// os dois pontos mais próximos da trajetória devolvida pelo serviço de
// seguimento. Antes/depois do intervalo conhecido, fica parado no
// primeiro/último ponto, em vez de desaparecer.
function posicaoNaTrajetoria(pontos, tempo) {
  if (!pontos || pontos.length === 0) return null;
  if (tempo <= pontos[0].t) return pontos[0];
  if (tempo >= pontos[pontos.length - 1].t) return pontos[pontos.length - 1];
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i], b = pontos[i + 1];
    if (tempo >= a.t && tempo <= b.t) {
      const frac = b.t === a.t ? 0 : (tempo - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
  }
  return pontos[pontos.length - 1];
}

// TEMPORÁRIO — enquanto o Upstash não estiver configurado (ver
// seguir-jogador-iniciar.js / seguir-jogador-estado.js), chama-se
// diretamente o endpoint antigo (/api/seguir-jogador), que espera pela
// resposta toda de uma vez. Quando o Upstash estiver pronto, troca-se
// só o corpo desta função pela versão com fila (guardada mais abaixo,
// em comentário) — nada mais precisa de mudar.
async function seguirJogadorAssincrono(pedido) {
  const resp = await fetch('/api/seguir-jogador', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedido),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || 'Falha ao seguir o jogador');
  return json; // { pontos, duracao }
}

// ---- versão com fila (Upstash) — usar quando estiver configurado ----
// async function seguirJogadorAssincrono(pedido) {
//   const respInicio = await fetch('/api/seguir-jogador-iniciar', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(pedido),
//   });
//   const jsonInicio = await respInicio.json();
//   if (!respInicio.ok) throw new Error(jsonInicio.error || 'Falha ao iniciar o seguimento');
//   const { jobId } = jsonInicio;
//
//   for (let tentativa = 0; tentativa < 200; tentativa++) { // 200 × 3s ≈ 10 minutos, bem mais do que devia demorar
//     await new Promise(r => setTimeout(r, 3000));
//     const respEstado = await fetch(`/api/seguir-jogador-estado?jobId=${jobId}`);
//     const estado = await respEstado.json();
//     if (estado.estado === 'concluido') return estado;
//     if (estado.estado === 'erro') throw new Error(estado.mensagem || 'Falha ao seguir o jogador');
//     // 'pendente' ou 'a_processar' — continua a perguntar
//   }
//   throw new Error('O seguimento está a demorar demasiado tempo.');
// }

// O jogador em foco — sombra colorida nos pés + holofote a convergir de
// cima, como uma luz de destaque. A posição atualiza a cada fotograma
// real do ecrã (requestAnimationFrame, a ler o vídeo diretamente), não
// a cada vez que o próprio vídeo avisa — o aviso do vídeo só chega
// umas 4 vezes por segundo, o que fazia o efeito "saltar" em vez de
// deslizar continuamente.
function MarcadorTrajetoria({ videoRef, pontos }) {
  const [tempo, setTempo] = useState(0);
  useEffect(() => {
    let ativo = true;
    const passo = () => {
      if (!ativo) return;
      if (videoRef.current) setTempo(videoRef.current.currentTime);
      requestAnimationFrame(passo);
    };
    const id = requestAnimationFrame(passo);
    return () => { ativo = false; cancelAnimationFrame(id); };
  }, [videoRef]);

  const pos = posicaoNaTrajetoria(pontos, tempo);
  if (!pos) return null;
  const px = pos.x * 100, py = pos.y * 56.25;
  const largTopo = 3.4;  // metade da largura do tubo lá em cima do ecrã
  const largBase = 2.2;  // metade da largura mesmo por cima dos pés — mais estreito, não converge num ponto
  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* holofote — um tubo de luz, transparência igual de cima a baixo,
         a tocar no relvado mesmo por baixo dos pés do jogador (que
         ficam sempre exatamente ao centro, na horizontal) */}
      <polygon points={`${px - largTopo},0 ${px + largTopo},0 ${px + largBase},${py} ${px - largBase},${py}`} fill={TV.crimsonBright} opacity={0.22} />
    </g>
  );
}

// Cursor da borracha — uma borracha a sério, em vez do símbolo de
// "proibido" que o browser mostra por omissão.
const CURSOR_BORRACHA = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><g transform='rotate(-35 13 13)'><rect x='5' y='8' width='16' height='10' rx='2.2' fill='white' stroke='%23222222' stroke-width='1.4'/><rect x='5' y='8' width='16' height='4.4' rx='2.2' fill='%23e84c62'/></g></svg>\") 6 20, auto";
const display = { fontFamily: "'Oswald', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

const TAGS = [
  { id: 'golo', label: 'Golo', color: TV.good },
  { id: 'remate', label: 'Remate', color: TV.gold },
  { id: 'bp', label: 'Bola Parada', color: TV.teamB },
  { id: 'perda', label: 'Perda', color: TV.bad },
  { id: 'recuperacao', label: 'Recuperação', color: TV.teamD },
  { id: 'transicao', label: 'Transição', color: TV.crimsonBright },
  { id: 'individual', label: 'Ação Individual', color: TV.teamC },
  { id: 'erro', label: 'Erro', color: TV.bad },
];

// Cores à escolha para os desenhos — útil para distinguir, por exemplo,
// os movimentos da nossa equipa (branco) dos do adversário (vermelho).
export const PALETA_DESENHO = [
  { id: 'branco', cor: '#FFFFFF' },
  { id: 'vermelho', cor: TV.crimsonBright },
  { id: 'amarelo', cor: TV.gold },
  { id: 'azul', cor: TV.teamB },
  { id: 'verde', cor: TV.good },
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
  const T = React.useContext(BancadaVideo) ? TV : TEMA;
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
export function ToolBtn({ icon: Icon, label, active, onClick, compacto }) {
  return (
    <button onClick={onClick} title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: compacto ? 3 : 2,
        width: '100%', minWidth: 0, minHeight: compacto ? 40 : 42, padding: compacto ? '5px 2px' : '6px 3px', borderRadius: 8, cursor: 'pointer', ...body,
        border: `1px solid ${active ? TV.crimsonBright : TV.line}`,
        background: active ? TV.surfaceRaise : 'transparent', color: active ? TV.cream : TV.muted,
      }}>
      <Icon size={compacto ? 15 : 16} />
      <span style={{
        fontSize: compacto ? 8.5 : 9, lineHeight: 1.05, whiteSpace: compacto ? 'normal' : 'nowrap', textAlign: 'center',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</span>
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
export function girar(p, centro, graus) {
  if (!graus) return p;
  const rad = (graus * Math.PI) / 180;
  const dx = p.x - centro.x, dy = p.y - centro.y;
  return {
    x: centro.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: centro.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}
export const TAMANHO_FONTE_TEXTO = 3.4;

/* ===================================================================
   RELVADO CALIBRADO — perspetiva real do chão numa imagem parada.

   Tocam-se 4 pontos de um retângulo do campo cuja medida se conhece
   (os cantos da grande área: 40,32 × 16,5 m). Com esses 4 pares
   (ponto na imagem ↔ ponto no relvado, em metros) calcula-se uma
   HOMOGRAFIA: uma matriz 3×3 que traduz qualquer ponto do ecrã para
   metros no relvado, e a inversa, de metros para o ecrã. Não precisa de
   ver a imagem (funciona com o YouTube) — é só conta.

   As formas desenhadas "no chão" guardam essa matriz (`chao.H`,
   imagem → relvado) e desenham-se a partir dela: a Zona é um retângulo
   verdadeiro no relvado, o Círculo um anel no chão (elipse), a Seta e
   a Linha ficam pintadas, mais estreitas ao fundo.
   =================================================================== */
export const MODELOS_CALIBRACAO = [
  {
    id: 'grandeArea', nome: 'Grande área', W: 40.32, D: 16.5,
    passos: [
      'Um canto da grande área (qualquer um)',
      'O canto SEGUINTE, a dar a volta à área',
      'O canto seguinte, na mesma volta',
      'O último canto',
    ],
  },
  {
    id: 'pequenaArea', nome: 'Pequena área', W: 18.32, D: 5.5,
    passos: [
      'Um canto da pequena área (qualquer um)',
      'O canto SEGUINTE, a dar a volta à área',
      'O canto seguinte, na mesma volta',
      'O último canto',
    ],
  },
  {
    id: 'medida', nome: 'Retângulo à medida', W: null, D: null,
    passos: [
      'Canto 1 do retângulo (o mais perto, à esquerda)',
      'Canto 2 — ao lado do 1, na mesma linha (a "largura")',
      'Canto 3 — em frente ao 2 (a "profundidade")',
      'Canto 4 — em frente ao 1',
    ],
  },
];

// Resolve o sistema linear A·x = b (eliminação de Gauss com pivô).
function resolverLinear(A, b) {
  const n = b.length;
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((linha, i) => linha[n] / linha[i]);
}

// Homografia que leva os 4 pontos `de` para os 4 pontos `para`.
export function homografia(de, para) {
  if (!de || !para || de.length !== 4 || para.length !== 4) return null;
  /* Os pontos de partida passam primeiro para "à volta do centro deles".
     Sem isto, quando o horizonte da imagem passa pelo canto (0,0) do
     ecrã a conta não tinha solução (acontece com uma área de frente,
     simétrica). Depois desfaz-se a mudança. */
  const cx = de.reduce((s, p) => s + p.x, 0) / 4, cy = de.reduce((s, p) => s + p.y, 0) / 4;
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const x = de[i].x - cx, y = de[i].y - cy;
    const { x: u, y: v } = para[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
  }
  const h = resolverLinear(A, b);
  if (!h) return null;
  const [a1, b1, c1, d1, e1, f1, g1, h1] = h;
  // H = H' · T, com T a translação de (−cx, −cy).
  return [
    a1, b1, c1 - a1 * cx - b1 * cy,
    d1, e1, f1 - d1 * cx - e1 * cy,
    g1, h1, 1 - g1 * cx - h1 * cy,
  ];
}

export function inverterH(H) {
  if (!H) return null;
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv = [
    A, -(b * i - c * h), b * f - c * e,
    B, a * i - c * g, -(a * f - c * d),
    C, -(a * h - b * g), a * e - b * d,
  ];
  return inv.map(v => v / det);
}

// Aplica H a um ponto. `w` (o denominador) diz de que lado do horizonte
// o ponto está — pontos "atrás da câmara" não se desenham.
export function aplicarH(H, p) {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-9) return null;
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w, w };
}

// Retângulo do relvado (em metros) que corresponde a uma calibração.
export function planoDaCalibracao(cal) {
  const W = Number(cal && cal.W), D = Number(cal && cal.D);
  if (!(W > 0) || !(D > 0)) return null;
  return [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }];
}

/* ---------- VERIFICAÇÃO DA CALIBRAÇÃO ----------
   Os 4 pontos definem SEMPRE uma perspetiva — mesmo errados. Para apanhar
   o erro antes de confirmar, usa-se a geometria da própria câmara: num
   retângulo visto em perspetiva, as direções dos dois pares de lados
   são perpendiculares no relvado, e isso diz qual é a "distância focal"
   da câmara e qual é a PROPORÇÃO verdadeira do retângulo marcado
   (método de Zhang & He). Se essa proporção não bater com a da área
   escolhida (grande área 2,44 : 1, pequena 3,33 : 1), os pontos não são
   os cantos certos. Também se apanha a ordem trocada (forma torcida) e
   perspetivas impossíveis. */
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const esc = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function validarCalibracao(img, W, D) {
  const avisos = [];
  if (!img || img.length !== 4 || !(W > 0) || !(D > 0)) return { ok: false, avisos: ['Faltam pontos.'] };
  // 1) Forma convexa e sem se cruzar (ordem dos cantos certa).
  let sinal = 0, convexo = true;
  for (let k = 0; k < 4; k++) {
    const p = img[k], q = img[(k + 1) % 4], r = img[(k + 2) % 4];
    const z = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
    if (Math.abs(z) < 1e-6) continue;
    if (!sinal) sinal = Math.sign(z); else if (Math.sign(z) !== sinal) convexo = false;
  }
  if (!convexo) {
    avisos.push('A forma marcada cruza-se: toca nos cantos a dar a volta à área, um a seguir ao outro.');
    return { ok: false, avisos, desvio: Infinity };
  }
  // 2) Proporção real do retângulo marcado (centro da imagem = eixo da câmara).
  const u0 = 50, v0 = 56.25 / 2;
  const m1 = [img[0].x, img[0].y, 1], m2 = [img[1].x, img[1].y, 1], m3 = [img[3].x, img[3].y, 1], m4 = [img[2].x, img[2].y, 1];
  const k2 = esc(cruz(m1, m4), m3) / esc(cruz(m2, m4), m3);
  const k3 = esc(cruz(m1, m4), m2) / esc(cruz(m3, m4), m2);
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
  const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
  let proporcao, focal = null;
  const denom = n2[2] * n3[2];
  const tam = Math.hypot(...n2) * Math.hypot(...n3);
  // Normaliza pela câmara (A⁻¹ n) e compara os comprimentos.
  const proporcaoCom = (f) => {
    const norm = (n) => {
      const x = (n[0] - u0 * n[2]) / f, y = (n[1] - v0 * n[2]) / f, z = n[2];
      return x * x + y * y + z * z;
    };
    return Math.sqrt(norm(n2) / norm(n3));
  };
  let tolerancia = 0.28;
  if (Math.abs(denom) < 1e-4 * tam) {
    /* Caso comum: a linha de fundo aparece direita na imagem (paralela ao
       ecrã) — aí a lente não se consegue deduzir. Usa-se uma lente típica
       (~70°) e uma tolerância mais larga. */
    proporcao = proporcaoCom(70);
    tolerancia = 0.3;
  } else {
    const f2 = -((n2[0] * n3[0] - (n2[0] * n3[2] + n2[2] * n3[0]) * u0 + n2[2] * n3[2] * u0 * u0)
      + (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)) / denom;
    if (!(f2 > 0)) {
      avisos.push('Estes 4 pontos dão uma perspetiva impossível para uma câmara — confirma que são os cantos certos da área.');
      return { ok: false, avisos, desvio: Infinity };
    }
    focal = Math.sqrt(f2);
    proporcao = proporcaoCom(focal);
    // Lente: campo de visão entre ~8° e ~130° (fora disso, os pontos estão mal).
    if (focal < 20 || focal > 700) {
      avisos.push('A perspetiva resultante não parece a de uma câmara normal — verifica os pontos.');
    }
  }
  /* 3) Um círculo no relvado tem de aparecer como uma elipse "deitada"
     (eixo comprido quase na horizontal) — as câmaras de futebol não estão
     tortas. Se a elipse sair inclinada na diagonal, a perspetiva está
     errada (foi o caso dos círculos na diagonal). */
  try {
    const Hm = homografia(img, [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }]);
    const Hi = Hm && inverterH(Hm);
    if (Hi) {
      const r = Math.min(W, D) / 3, cxp = W / 2, cyp = D / 2;
      const pts = [];
      for (let k = 0; k < 36; k++) {
        const t = (k / 36) * Math.PI * 2;
        const q = aplicarH(Hi, { x: cxp + r * Math.cos(t), y: cyp + r * Math.sin(t) });
        if (q) pts.push(q);
      }
      if (pts.length > 20) {
        const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        let sxx = 0, syy = 0, sxy = 0;
        pts.forEach(p => { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my); });
        const ang = Math.abs((0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI);
        const tr = sxx + syy, det = sxx * syy - sxy * sxy;
        const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
        const alongada = l2 > 0 ? Math.sqrt(l1 / l2) : 99;
        if (alongada > 1.25 && ang > 25 && ang < 155) {
          avisos.push('Com estes pontos, um círculo no relvado ficaria inclinado na diagonal — sinal de que os pontos não estão nas linhas certas da área.');
        }
      }
    }
  } catch (e) { /* verificação extra: se falhar, ignora */ }
  const esperado = W / D;
  const desvio = Math.abs(Math.log(proporcao / esperado));
  if (desvio > tolerancia) {
    avisos.push(`A forma marcada tem proporção ${proporcao.toFixed(2).replace('.', ',')} : 1, mas a área escolhida tem ${esperado.toFixed(2).replace('.', ',')} : 1. Os pontos não parecem ser os cantos desta área (é a grande ou a pequena?).`);
  }
  return { ok: avisos.length === 0, avisos, proporcao, esperado, focal, desvio };
}

/* QUALQUER ORIENTAÇÃO DO CAMPO. A câmara pode estar atrás da baliza
   (linha de fundo "deitada") ou na bancada lateral (baliza à esquerda ou
   à direita, linha de fundo "em pé"). Em vez de obrigar a uma ordem fixa,
   tocam-se os 4 cantos a dar a volta à área, começando em qualquer um. A
   app experimenta as maneiras possíveis de os ler e fica com a que dá a
   proporção certa da área (os lados compridos são a largura). Entre a
   linha de baliza e a linha da frente (mesma proporção), a de baliza é a
   que fica mais longe do centro da imagem — a câmara está quase sempre
   virada para o jogo, não para fora do campo. `trocarBaliza` inverte
   essa escolha, se for o caso. */
export function ordenarCantosAuto(img, W, D, trocarBaliza = false) {
  if (!img || img.length !== 4) return null;
  const opcoes = [];
  for (const sentido of [1, -1]) {
    for (let r = 0; r < 4; r++) {
      const c = [0, 1, 2, 3].map(k => img[((r + sentido * k) % 4 + 4) % 4]);
      opcoes.push({ cantos: c, verif: validarCalibracao(c, W, D) });
    }
  }
  const validas = opcoes.filter(o => Number.isFinite(o.verif.desvio));
  if (!validas.length) return { cantos: img, verif: validarCalibracao(img, W, D) };
  const melhorDesvio = Math.min(...validas.map(o => o.verif.desvio));
  // As de proporção certa (empatadas: baliza de um lado ou do outro, e sentido).
  const boas = validas.filter(o => o.verif.desvio <= melhorDesvio + 1e-6 || Math.abs(o.verif.desvio - melhorDesvio) < 0.02);
  const longeDoCentro = (o) => {
    const m = { x: (o.cantos[0].x + o.cantos[1].x) / 2, y: (o.cantos[0].y + o.cantos[1].y) / 2 };
    return Math.hypot(m.x - 50, m.y - 28.125);
  };
  boas.sort((x, y) => longeDoCentro(y) - longeDoCentro(x));
  const escolhida = trocarBaliza ? (boas.find(o => Math.abs(longeDoCentro(o) - longeDoCentro(boas[0])) > 1) || boas[0]) : boas[0];
  return escolhida;
}

/* ---------- CALIBRAR POR LINHAS ----------
   Em vez dos 4 cantos (muitas vezes tapados por jogadores ou fora do
   enquadramento), tocam-se 2 pontos em cada uma das 4 linhas da área —
   em qualquer sítio dela. Os cantos são os cruzamentos dessas linhas,
   mesmo que fiquem fora do ecrã. Ordem das linhas: linha de fundo, lado
   direito, linha da frente, lado esquerdo. */
export const LINHAS_CALIBRACAO = ['uma das linhas da área (qualquer uma)', 'a linha SEGUINTE, a dar a volta à área', 'a linha seguinte, na mesma volta', 'a última linha'];
const retaDe = (p, q) => cruz([p.x, p.y, 1], [q.x, q.y, 1]);
export function cantosDasLinhas(pontos) {
  if (!pontos || pontos.length < 8) return null;
  const L = [0, 1, 2, 3].map(k => retaDe(pontos[2 * k], pontos[2 * k + 1]));
  const cruzar = (a, b) => {
    const h = cruz(a, b);
    if (Math.abs(h[2]) < 1e-9) return null;
    return { x: h[0] / h[2], y: h[1] / h[2] };
  };
  // P1 = fundo∩esquerdo, P2 = fundo∩direito, P3 = frente∩direito, P4 = frente∩esquerdo
  const c = [cruzar(L[0], L[3]), cruzar(L[0], L[1]), cruzar(L[2], L[1]), cruzar(L[2], L[3])];
  return c.every(Boolean) && c.every(p => Math.abs(p.x) < 2000 && Math.abs(p.y) < 2000) ? c : null;
}


/* ---------- FORA DE JOGO POR REFERÊNCIA ----------
   Não precisa da calibração completa (que exige filmagens "perfeitas").
   Basta uma ou duas linhas do campo PARALELAS À LINHA DE BALIZA que se
   vejam na imagem (a linha da grande área, a da pequena área, a própria
   linha de baliza). Com duas, cruzam-se no "ponto de fuga" dessa
   direção: a linha de fora de jogo é a reta que vai dos pés do jogador
   a esse ponto — a perspetiva certa, com a câmara torta ou não. Com uma
   só, a linha sai paralela a ela (aproximação boa em planos abertos). A
   forma guarda o ponto de fuga (`fj.V`) ou a direção (`fj.dir`). */
export function referenciaForaDeJogo(l1, l2) {
  if (!l1 || l1.length < 2) return null;
  const d1 = { x: l1[1].x - l1[0].x, y: l1[1].y - l1[0].y };
  if (Math.hypot(d1.x, d1.y) < 0.5) return null;
  if (l2 && l2.length === 2) {
    const r1 = cruz([l1[0].x, l1[0].y, 1], [l1[1].x, l1[1].y, 1]);
    const r2 = cruz([l2[0].x, l2[0].y, 1], [l2[1].x, l2[1].y, 1]);
    const v = cruz(r1, r2);
    if (Math.abs(v[2]) > 1e-9) {
      const V = { x: v[0] / v[2], y: v[1] / v[2] };
      // Ponto de fuga muito longe = linhas quase paralelas: usa a direção.
      if (Math.hypot(V.x - 50, V.y - 28) < 5000) return { V };
    }
  }
  return { dir: d1 };
}
// Troço visível da linha de fora de jogo (no ecrã), com a largura nas pontas.
export function segmentoForaDeJogo(sh) {
  const P = sh.points && sh.points[0];
  const fj = sh.fj;
  if (!P || !fj) return null;
  const d = fj.V ? { x: fj.V.x - P.x, y: fj.V.y - P.y } : fj.dir;
  if (!d || Math.hypot(d.x, d.y) < 1e-6) return null;
  // Interseção da reta P + t·d com a imagem [0,100]×[0,56.25].
  let t0 = -Infinity, t1 = Infinity;
  const lim = [[d.x, P.x, 0, 100], [d.y, P.y, 0, 56.25]];
  for (const [dd, pp, mn, mx] of lim) {
    if (Math.abs(dd) < 1e-9) { if (pp < mn || pp > mx) return null; continue; }
    const ta = (mn - pp) / dd, tb = (mx - pp) / dd;
    t0 = Math.max(t0, Math.min(ta, tb));
    t1 = Math.min(t1, Math.max(ta, tb));
  }
  if (fj.V) t1 = Math.min(t1, 0.98); // não passa do horizonte (o ponto de fuga)
  if (!(t1 > t0)) return null;
  const em = (t) => ({ x: P.x + d.x * t, y: P.y + d.y * t });
  // Mais grossa perto da câmara, mais fina ao fundo (proporcional à distância ao ponto de fuga).
  const larg = (t) => (fj.V ? Math.min(1.1, Math.max(0.06, 0.34 * (1 - t))) : 0.3);
  return { a: em(t0), b: em(t1), la: larg(t0), lb: larg(t1), pe: P };
}

// Matriz imagem → relvado de uma calibração (4 pontos na imagem).
export function matrizDaCalibracao(cal) {
  if (!cal || !cal.img || cal.img.length !== 4) return null;
  const plano = planoDaCalibracao(cal);
  return plano ? homografia(cal.img, plano) : null;
}

/* Projeta pontos do relvado para o ecrã, só se ficarem do lado certo do
   horizonte (o mesmo lado que o ponto de referência). */
function projetor(Hi, ref) {
  const r = aplicarH(Hi, ref);
  const sinal = r ? Math.sign(r.w) : 1;
  return (q) => {
    const p = aplicarH(Hi, q);
    return p && Math.sign(p.w) === sinal ? { x: p.x, y: p.y } : null;
  };
}
const rodarEm = (q, c, graus) => {
  if (!graus) return q;
  const r = (graus * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  return { x: c.x + (q.x - c.x) * cs - (q.y - c.y) * sn, y: c.y + (q.x - c.x) * sn + (q.y - c.y) * cs };
};

/* GEOMETRIA DE UMA FORMA NO CHÃO — tudo em coordenadas do ecrã, pronto
   a desenhar e a acertar com o dedo. Devolve null se não der (forma
   que fugiu para lá do horizonte, matriz inválida…). */
export function geometriaNoChao(sh) {
  const H = sh && sh.chao && sh.chao.H;
  if (!H || !sh.points || !sh.points[0]) return null;
  const Hi = inverterH(H);
  if (!Hi) return null;
  const A = aplicarH(H, sh.points[0]);
  if (!A) return null;
  const proj = projetor(Hi, A);
  const projTodos = (lista) => {
    const r = lista.map(proj);
    return r.every(Boolean) ? r : null;
  };
  // Pontos de uma linha comprida no relvado, já no ecrã (corta o que
  // passar para lá do horizonte, em vez de desenhar disparates).
  const linhaLonga = (q1, q2, n = 24) => {
    const pts = [];
    for (let s = 0; s <= n; s++) {
      const r = proj({ x: q1.x + ((q2.x - q1.x) * s) / n, y: q1.y + ((q2.y - q1.y) * s) / n });
      if (r) pts.push(r);
    }
    return pts;
  };
  const campo = (sh.chao && sh.chao.campo) || {};
  const cx = Number.isFinite(Number(campo.cx)) ? Number(campo.cx) : A.x; // centro da baliza (largura)
  /* LINHA DE FORA DE JOGO: um toque nos pés do jogador → a linha
     paralela à linha de fundo que passa por ali, de lado a lado do campo
     (68 m), na perspetiva certa. */
  if (sh.tool === 'foraDeJogo') {
    const pts = linhaLonga({ x: cx - 36, y: A.y }, { x: cx + 36, y: A.y }, 32);
    if (pts.length < 2) return null;
    const faixa = projTodos([{ x: A.x - 1.2, y: A.y - 0.9 }, { x: A.x + 1.2, y: A.y - 0.9 }, { x: A.x + 1.2, y: A.y + 0.9 }, { x: A.x - 1.2, y: A.y + 0.9 }]);
    return { tipo: 'foraDeJogo', linha: pts, contorno: faixa || pts.slice(0, 4), pe: proj(A) };
  }
  /* CORREDORES E TERÇOS: as linhas das áreas prolongadas pelo campo
     todo (os 5 corredores) e as linhas a 1/3 e 2/3 do comprimento. */
  if (sh.tool === 'guias') {
    const L = Number(campo.L) > 0 ? Number(campo.L) : 100;
    const faixas = [];
    const xs = [cx - 34, cx - 20.16, cx - 9.16, cx + 9.16, cx + 20.16, cx + 34];
    if (sh.corredores) {
      for (let k = 0; k < 5; k++) {
        if (k % 2 === 1) continue; // corredores 1, 3 e 5 levemente pintados
        const poli = [];
        const esq = linhaLonga({ x: xs[k], y: 0 }, { x: xs[k], y: L }, 20);
        const dir = linhaLonga({ x: xs[k + 1], y: L }, { x: xs[k + 1], y: 0 }, 20);
        poli.push(...esq, ...dir);
        if (poli.length > 3) faixas.push(poli);
      }
    }
    const linhas = [];
    if (sh.corredores) xs.slice(1, 5).forEach(x => { const l = linhaLonga({ x, y: 0 }, { x, y: L }); if (l.length > 1) linhas.push(l); });
    if (sh.tercos) [L / 3, (2 * L) / 3].forEach(y => { const l = linhaLonga({ x: cx - 34, y }, { x: cx + 34, y }); if (l.length > 1) linhas.push(l); });
    return { tipo: 'guias', faixas, linhas, contorno: [] };
  }
  if (!sh.points[1]) return null;
  const B = aplicarH(H, sh.points[1]);
  if (!B) return null;
  /* MEDIR: distância real entre dois pontos do relvado, em metros. */
  if (sh.tool === 'medida') {
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    if (len < 0.05) return null;
    const nx = -dy / len, ny = dx / len;
    const pa = proj(A), pb = proj(B);
    if (!pa || !pb) return null;
    const tick = (P) => projTodos([{ x: P.x + nx * 0.7, y: P.y + ny * 0.7 }, { x: P.x - nx * 0.7, y: P.y - ny * 0.7 }]);
    const meio = proj({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
    const contorno = projTodos([{ x: A.x + nx * 0.8, y: A.y + ny * 0.8 }, { x: B.x + nx * 0.8, y: B.y + ny * 0.8 }, { x: B.x - nx * 0.8, y: B.y - ny * 0.8 }, { x: A.x - nx * 0.8, y: A.y - ny * 0.8 }]);
    return { tipo: 'medida', a: pa, b: pb, ticks: [tick(A), tick(B)].filter(Boolean), meio, metros: len, contorno: contorno || [pa, pb] };
  }
  if (sh.tool === 'retangulo') {
    const x0 = Math.min(A.x, B.x), x1 = Math.max(A.x, B.x), y0 = Math.min(A.y, B.y), y1 = Math.max(A.y, B.y);
    const c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    const rot = sh.rotacao || 0;
    const cantos = projTodos([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }].map(q => rodarEm(q, c, rot)));
    if (!cantos) return null;
    // Riscas diagonais no próprio relvado (x − y = k), cortadas pela zona.
    const riscas = [];
    const passo = Math.max(1.2, Math.min(x1 - x0, y1 - y0) / 5);
    for (let k = x0 - y1; k <= x1 - y0; k += passo) {
      const xa = Math.max(x0, y0 + k), xb = Math.min(x1, y1 + k);
      if (xb - xa < 0.05) continue;
      const p1 = proj(rodarEm({ x: xa, y: xa - k }, c, rot));
      const p2 = proj(rodarEm({ x: xb, y: xb - k }, c, rot));
      if (p1 && p2) riscas.push([p1, p2]);
    }
    return { tipo: 'zona', contorno: cantos, riscas, centroChao: c, rot, metros: { w: x1 - x0, d: y1 - y0 }, proj, H, Hi };
  }
  if (sh.tool === 'circulo') {
    const r = Math.hypot(B.x - A.x, B.y - A.y);
    const pts = [];
    for (let k = 0; k < 64; k++) {
      const t = (k / 64) * Math.PI * 2;
      const q = proj({ x: A.x + r * Math.cos(t), y: A.y + r * Math.sin(t) });
      if (q) pts.push(q);
    }
    return pts.length > 8 ? { tipo: 'anel', contorno: pts, raio: r } : null;
  }
  if (sh.tool === 'seta' || sh.tool === 'linha') {
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    if (len < 0.2) return null;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const meia = 0.32; // meia-largura do traço, em metros
    const em = (p, s, n) => ({ x: p.x + nx * n + ux * s, y: p.y + ny * n + uy * s });
    let poli;
    if (sh.tool === 'seta') {
      const cab = Math.min(2.6, len * 0.45), meiaCab = 1.15;
      const S = { x: B.x - ux * cab, y: B.y - uy * cab };
      poli = [em(A, 0, meia), em(S, 0, meia), em(S, 0, meiaCab), B, em(S, 0, -meiaCab), em(S, 0, -meia), em(A, 0, -meia)];
    } else {
      poli = [em(A, 0, meia), em(B, 0, meia), em(B, 0, -meia), em(A, 0, -meia)];
    }
    const contorno = projTodos(poli);
    return contorno ? { tipo: 'traco', contorno, metros: len } : null;
  }
  return null;
}

// Uma pega de uma Zona no chão rodada: onde aparece no ecrã.
export function pegaZonaNoChao(sh, indice) {
  const g = geometriaNoChao(sh);
  if (!g || g.tipo !== 'zona') return sh.points[indice];
  const q = aplicarH(g.H, sh.points[indice]);
  return (q && g.proj(rodarEm(q, g.centroChao, g.rot))) || sh.points[indice];
}
// Ponto do ecrã → ponto "sem rotação" da zona (para mover um canto).
export function desrodarNaZonaNoChao(sh, p) {
  const g = geometriaNoChao(sh);
  if (!g || g.tipo !== 'zona' || !g.rot) return p;
  const q = aplicarH(g.H, p);
  if (!q) return p;
  const r = aplicarH(g.Hi, rodarEm(q, g.centroChao, -g.rot));
  return r ? { x: r.x, y: r.y } : p;
}
// Pega de rodar de uma Zona no chão (por cima, a uns metros do lado de cima).
export function pegaRodarZonaNoChao(sh) {
  const g = geometriaNoChao(sh);
  if (!g || g.tipo !== 'zona') return null;
  const meia = g.metros.d / 2;
  return { pega: g.proj(rodarEm({ x: g.centroChao.x, y: g.centroChao.y - meia - 3 }, g.centroChao, g.rot)), base: g.proj(rodarEm({ x: g.centroChao.x, y: g.centroChao.y - meia }, g.centroChao, g.rot)), g };
}
// Ângulo (em graus) para a pega de rodar estar sob o ponto p.
export function anguloRodarZonaNoChao(sh, p) {
  const g = geometriaNoChao(sh);
  if (!g || g.tipo !== 'zona') return sh.rotacao || 0;
  const q = aplicarH(g.H, p);
  if (!q) return sh.rotacao || 0;
  return (Math.atan2(q.y - g.centroChao.y, q.x - g.centroChao.x) * 180) / Math.PI + 90;
}

const dentroPoligono = (p, pts) => {
  let dentro = false;
  for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) {
    const pk = pts[k], pj = pts[j];
    if (((pk.y > p.y) !== (pj.y > p.y)) && (p.x < ((pj.x - pk.x) * (p.y - pk.y)) / ((pj.y - pk.y) || 1e-9) + pk.x)) dentro = !dentro;
  }
  return dentro;
};

export function distanciaShape(sh, p) {
  // As guias (corredores/terços) são fundo: nunca se agarram.
  if (sh && sh.tool === 'guias') return Infinity;
  if (sh && sh.tool === 'foraDeJogo' && sh.fj) {
    const s = segmentoForaDeJogo(sh);
    return s ? distPontoSegmento(p, s.a, s.b) : Infinity;
  }
  // Formas no chão: acerta-se no contorno real (ou dentro dele).
  if (sh && sh.chao) {
    const g = geometriaNoChao(sh);
    if (g) {
      if (dentroPoligono(p, g.contorno)) return 0;
      let m = Infinity;
      for (let k = 0; k < g.contorno.length; k++) m = Math.min(m, distPontoSegmento(p, g.contorno[k], g.contorno[(k + 1) % g.contorno.length]));
      return m;
    }
  }
  const pts = sh.points || [];
  const [a, b] = pts;
  if (!a) return Infinity;
  if (sh.tool === 'texto') {
    // Uma caixa à volta do texto todo (não só o pontinho onde começa a
    // escrever-se) — sem isto, só dava para lhe tocar bem no início da
    // palavra, nunca no meio ou no fim, o que parecia "não se conseguir
    // mover". Não há como saber a largura exata sem medir no ecrã, por
    // isso usa-se uma estimativa a partir do nº de letras.
    const largura = Math.max(TAMANHO_FONTE_TEXTO, (sh.texto || '').length * TAMANHO_FONTE_TEXTO * 0.55);
    const x1 = a.x, x2 = a.x + largura, y1 = a.y - TAMANHO_FONTE_TEXTO, y2 = a.y;
    if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) return 0;
    const dx = p.x < x1 ? x1 - p.x : (p.x > x2 ? p.x - x2 : 0);
    const dy = p.y < y1 ? y1 - p.y : (p.y > y2 ? p.y - y2 : 0);
    return Math.hypot(dx, dy);
  }
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
  if (sh.tool === 'zonalivre' && pts.length > 2) {
    // Zona livre é uma área preenchida: tocar DENTRO dela também a agarra,
    // tal como na Zona (retângulo).
    let dentro = false;
    for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) {
      const pk = pts[k], pj = pts[j];
      if (((pk.y > p.y) !== (pj.y > p.y)) && (p.x < ((pj.x - pk.x) * (p.y - pk.y)) / ((pj.y - pk.y) || 1e-9) + pk.x)) dentro = !dentro;
    }
    if (dentro) return 0;
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
/* Inclinação de uma Zona sem valor guardado (a de sempre). */
export function inclinacaoPadrao(w, h) {
  return w > 0 ? Math.min(0.17, (h * 0.9) / w) : 0.17;
}

export const ESPESSURA = 0.35;
export const CONTORNO_FINO = 0.12; // rebordo da Zona e da Zona livre // mais fino do que antes (era 0.6), em todas as formas
export const RAIO_TOQUE = 1.5; // distância máxima (era 6, depois 3) para um toque "acertar" num desenho já feito — mais exato ainda, tem de se tocar mesmo em cima

export function renderShape(sh, i) {
  if (!sh || !sh.points || sh.points.length === 0) return null;
  if (sh.tool === 'foraDeJogo' && sh.fj) {
    const s = segmentoForaDeJogo(sh);
    if (!s) return null;
    const cor = sh.color || COR_DESENHO;
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const poli = [
      { x: s.a.x + nx * s.la / 2, y: s.a.y + ny * s.la / 2 }, { x: s.b.x + nx * s.lb / 2, y: s.b.y + ny * s.lb / 2 },
      { x: s.b.x - nx * s.lb / 2, y: s.b.y - ny * s.lb / 2 }, { x: s.a.x - nx * s.la / 2, y: s.a.y - ny * s.la / 2 },
    ].map(q => `${q.x},${q.y}`).join(' ');
    return (
      <g key={i}>
        <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={cor} strokeOpacity={0.3} strokeWidth={Math.max(s.la, s.lb) * 2.2} strokeLinecap="round" style={{ mixBlendMode: 'overlay' }} />
        <polygon points={poli} fill={cor} />
        <circle cx={s.pe.x} cy={s.pe.y} r={0.45} fill={cor} stroke="#000" strokeWidth={0.1} />
      </g>
    );
  }
  if (sh.chao) {
    const g = geometriaNoChao(sh);
    if (g) return renderNoChao(sh, g, i);
    if (['medida', 'foraDeJogo', 'guias'].includes(sh.tool)) return null; // só existem no chão
  }
  const [a, b] = sh.points;
  if (!a) return null;
  const cor = { stroke: sh.color || COR_DESENHO, fill: 'none' };
  if (sh.tool === 'texto') {
    return <text key={i} x={a.x} y={a.y} fill={sh.color || COR_DESENHO} fontSize={TAMANHO_FONTE_TEXTO} fontWeight={700} style={{ fontFamily: "'Inter', sans-serif", paintOrder: 'stroke', stroke: '#00000099', strokeWidth: 0.5 }}>{sh.texto}</text>;
  }
  if (sh.tool === 'livre' || sh.tool === 'zonalivre' || sh.tool === 'linhaPontos') {
    const fechado = sh.tool === 'zonalivre';
    const d = sh.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (fechado ? ' Z' : '');
    return (
      <g key={i}>
        {fechado ? (
          <>
            {/* Zona livre também "pintada no chão" (ver a Zona). */}
            <path d={d} stroke="none" fill={sh.color || COR_DESENHO} fillOpacity={0.45} style={{ mixBlendMode: 'overlay' }} />
            {/* Rebordo muito fino — não tapa os jogadores. */}
            <path d={d} fill="none" stroke={sh.color || COR_DESENHO} strokeOpacity={0.85} strokeWidth={CONTORNO_FINO} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <path d={d}
            stroke={sh.color || COR_DESENHO} fill="none"
            strokeWidth={ESPESSURA} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* "Ligar pontos" mostra sempre os vértices, para se ver onde estão os pontos ligados */}
        {sh.tool === 'linhaPontos' && sh.points.map((p, pi) => (
          <circle key={pi} cx={p.x} cy={p.y} r={0.4} fill={sh.color || COR_DESENHO} />
        ))}
      </g>
    );
  }
  if (!b) return null;
  if (sh.tool === 'circulo') {
    /* CÍRCULO A RODAR — como os das transmissões: um anel fino fixo e, por
       cima, segmentos que dão a volta ao jogador sem parar. */
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    const c = sh.color || COR_DESENHO;
    return (
      <g key={i}>
        <circle cx={a.x} cy={a.y} r={r} fill="none" stroke={c} strokeOpacity={0.5} strokeWidth={CONTORNO_FINO * 1.4} />
        <circle cx={a.x} cy={a.y} r={r} pathLength={100} fill="none" stroke={c} strokeWidth={ESPESSURA}
          strokeLinecap="round" strokeDasharray="14 11">
          <animate attributeName="stroke-dashoffset" from="0" to="-100" dur="3.2s" repeatCount="indefinite" />
        </circle>
      </g>
    );
  }
  if (sh.tool === 'linha') return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={cor} strokeWidth={ESPESSURA} />;
  if (sh.tool === 'retangulo') {
    /* ZONA PINTADA NO RELVADO. Em vez de um retângulo chapado por cima da
       imagem, desenha-se em perspetiva, como as marcações das transmissões
       de TV: o lado de baixo (mais perto da câmara) é o mais largo e o de
       cima estreita, com as riscas diagonais a acompanhar. A caixa que se
       arrasta continua a ser a mesma (os cantos e a rotação não mudam). */
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    const corZona = sh.color || COR_DESENHO;
    const cx = x + w / 2, cy = y + h / 2;
    /* INCLINAÇÃO (rodar "para cima e para baixo"): quanto um dos lados
       estreita, em fração da largura. Positivo = o lado de cima fica ao
       fundo (o normal num relvado visto da bancada); negativo = ao
       contrário. Sem valor guardado, usa o de sempre. */
    const inc = Number.isFinite(Number(sh.inclinacao)) ? Number(sh.inclinacao) : inclinacaoPadrao(w, h);
    const recolhaCima = Math.max(0, inc) * w, recolhaBaixo = Math.max(0, -inc) * w;
    const BL = { x: x + recolhaBaixo, y: y + h }, BR = { x: x + w - recolhaBaixo, y: y + h };
    const TR = { x: x + w - recolhaCima, y }, TL = { x: x + recolhaCima, y };
    const naAltura = (f) => ({ // f: 0 = perto (baixo) … 1 = fundo (cima)
      yy: y + h - h * f,
      xl: BL.x + (TL.x - BL.x) * f,
      xr: BR.x + (TR.x - BR.x) * f,
    });
    /* Riscas DIAGONAIS (como sempre foram), mas em perspetiva: cada
       risca vai de um ponto do lado de baixo a um ponto do lado de cima
       deslocado — assim acompanham o estreitar da zona e parecem
       pintadas no chão. O que sai da zona é cortado (clipPath). */
    const linhas = [];
    const N = Math.max(6, Math.round(w / 2.2)); // densidade parecida com a de antes
    const desvio = 0.45; // inclinação das riscas
    const larguraTopo = TR.x - TL.x;
    for (let k = 0; k <= N + Math.ceil(N * desvio); k++) {
      const u = k / N;
      linhas.push(<line key={k} x1={BL.x + (BR.x - BL.x) * u} y1={BL.y} x2={TL.x + larguraTopo * (u - desvio)} y2={TL.y}
        stroke={corZona} strokeOpacity={0.6} strokeWidth={0.14} />);
    }
    const pts = `${BL.x},${BL.y} ${BR.x},${BR.y} ${TR.x},${TR.y} ${TL.x},${TL.y}`;
    const idGrad = `relva-${sh.id || i}`;
    const idClip = `relva-corte-${sh.id || i}`;
    return (
      <g key={i} transform={sh.rotacao ? `rotate(${sh.rotacao} ${cx} ${cy})` : undefined}>
        <defs>
          {/* Mais forte perto da câmara, a desvanecer para o fundo. */}
          <linearGradient id={idGrad} x1="0" y1={inc >= 0 ? 1 : 0} x2="0" y2={inc >= 0 ? 0 : 1}>
            <stop offset="0%" stopColor={corZona} stopOpacity={0.14} />
            <stop offset="100%" stopColor={corZona} stopOpacity={0.05} />
          </linearGradient>
          <clipPath id={idClip}><polygon points={pts} /></clipPath>
        </defs>
        {/* "Por baixo dos jogadores": o preenchimento e as riscas
            misturam-se com a imagem (overlay) em vez de a taparem — a
            relva aclara, mas os jogadores (cores fortes, sombras)
            continuam a ver-se através, como tinta no chão. */}
        <g style={{ mixBlendMode: 'overlay' }}>
          <polygon points={pts} fill={`url(#${idGrad})`} stroke="none" />
          <g clipPath={`url(#${idClip})`}>{linhas}</g>
        </g>
        {/* Rebordo muito fino — não tapa os jogadores. */}
        {!sh.semContorno && (
          <polygon points={pts} fill="none" stroke={corZona} strokeOpacity={0.85} strokeWidth={CONTORNO_FINO} strokeLinejoin="round" />
        )}
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

/* ZOOM NO CÍRCULO (igual ao da Biblioteca): com um círculo com `zoom`
   visível, a imagem aproxima-se suavemente do centro dele e afasta-se
   quando ele sai. Aqui o vídeo é nosso (não é o YouTube), por isso a
   saída também pode ser animada sem problemas. Devolve o estilo para a
   caixa que contém o vídeo e o desenho. */
export function useZoomCirculo(formasVisiveis, ativo = true) {
  const origem = useRef('50% 50%');
  const c = ativo ? (formasVisiveis || []).find(f => f && f.tool === 'circulo' && Number(f.zoom) > 1 && f.points && f.points[0]) : null;
  if (c) {
    const p = c.points[0];
    origem.current = `${Math.max(0, Math.min(100, p.x))}% ${Math.max(0, Math.min(100, (p.y / 56.25) * 100))}%`;
  }
  return {
    transform: c ? `translate3d(0,0,0) scale(${Number(c.zoom)})` : 'translate3d(0,0,0) scale(1)',
    transformOrigin: origem.current,
    transition: c ? 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)' : 'transform 0.9s cubic-bezier(0.65, 0, 0.35, 1)',
    willChange: 'transform',
  };
}

function renderNoChao(sh, g, i) {
  const cor = sh.color || COR_DESENHO;
  const pts = g.contorno.map(p => `${p.x},${p.y}`).join(' ');
  if (g.tipo === 'zona') {
    return (
      <g key={i}>
        <g style={{ mixBlendMode: 'overlay' }}>
          <polygon points={pts} fill={cor} fillOpacity={0.12} stroke="none" />
          {g.riscas.map(([p1, p2], k) => (
            <line key={k} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={cor} strokeOpacity={0.6} strokeWidth={0.14} />
          ))}
        </g>
        {!sh.semContorno && <polygon points={pts} fill="none" stroke={cor} strokeOpacity={0.85} strokeWidth={CONTORNO_FINO} strokeLinejoin="round" />}
      </g>
    );
  }
  if (g.tipo === 'anel') {
    /* ANEL NO CHÃO, A RODAR — como os das transmissões. Três camadas:
       um brilho suave no relvado que "respira", um anel fino fixo e, por
       cima, segmentos que dão a volta ao jogador. Os segmentos correm ao
       longo do próprio contorno (que já está em perspetiva), por isso a
       rotação acompanha o chão: mais lentos e apertados ao fundo, mais
       abertos à frente. `pathLength=100` torna os traços independentes do
       tamanho do anel. */
    const d = `M ${g.contorno.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
    return (
      <g key={i}>
        <path d={d} fill={cor} stroke="none" style={{ mixBlendMode: 'overlay' }}>
          <animate attributeName="fill-opacity" values="0.10;0.22;0.10" dur="2.4s" repeatCount="indefinite" />
        </path>
        <path d={d} fill="none" stroke={cor} strokeOpacity={0.55} strokeWidth={CONTORNO_FINO * 1.4} strokeLinejoin="round" />
        <path d={d} pathLength={100} fill="none" stroke={cor} strokeWidth={ESPESSURA * 1.1}
          strokeLinecap="round" strokeDasharray="14 11" strokeLinejoin="round">
          <animate attributeName="stroke-dashoffset" from="0" to="-100" dur="3.2s" repeatCount="indefinite" />
        </path>
      </g>
    );
  }
  if (g.tipo === 'medida') {
    const etiqueta = `${g.metros.toFixed(1).replace('.', ',')} m`;
    return (
      <g key={i}>
        <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke={cor} strokeWidth={0.22} strokeDasharray="0.9 0.6" strokeLinecap="round" />
        {g.ticks.map((t, k) => <line key={k} x1={t[0].x} y1={t[0].y} x2={t[1].x} y2={t[1].y} stroke={cor} strokeWidth={0.26} strokeLinecap="round" />)}
        {g.meio && (
          <text x={g.meio.x} y={g.meio.y - 0.9} textAnchor="middle" fill="#fff" fontSize={2.3} fontWeight={800}
            style={{ fontFamily: "'Inter', sans-serif", paintOrder: 'stroke', stroke: '#000000cc', strokeWidth: 0.55 }}>{etiqueta}</text>
        )}
      </g>
    );
  }
  if (g.tipo === 'foraDeJogo') {
    const d = g.linha.map((p, k) => `${k ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
    return (
      <g key={i}>
        <path d={d} fill="none" stroke={cor} strokeOpacity={0.35} strokeWidth={0.9} strokeLinecap="round" style={{ mixBlendMode: 'overlay' }} />
        <path d={d} fill="none" stroke={cor} strokeWidth={0.26} strokeLinecap="round" />
        {g.pe && <circle cx={g.pe.x} cy={g.pe.y} r={0.45} fill={cor} stroke="#000" strokeWidth={0.1} />}
      </g>
    );
  }
  if (g.tipo === 'guias') {
    const caminho = (l) => l.map((p, k) => `${k ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
    return (
      <g key={i} style={{ pointerEvents: 'none' }}>
        {g.faixas.map((f, k) => <polygon key={`f${k}`} points={f.map(p => `${p.x},${p.y}`).join(' ')} fill={cor} fillOpacity={0.16} stroke="none" style={{ mixBlendMode: 'overlay' }} />)}
        {g.linhas.map((l, k) => <path key={`l${k}`} d={caminho(l)} fill="none" stroke={cor} strokeOpacity={0.7} strokeWidth={0.14} strokeDasharray="1.2 0.8" />)}
      </g>
    );
  }
  // Seta / linha pintadas no relvado.
  return <polygon key={i} points={pts} fill={cor} fillOpacity={0.9} stroke="none" />;
}

export function shapeVisivelEm(sh, tempo) {
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

/* ECRÃ INTEIRO do vídeo + barra (não do leitor todo): a barra amarela e
   os desenhos continuam lá. No iPhone só o próprio <video> pode entrar
   em ecrã inteiro, e aí os desenhos não aparecem. */
function useEcraInteiro() {
  const fsRef = useRef(null);
  const [emEcraInteiro, setEmEcraInteiro] = useState(false);
  useEffect(() => {
    const aoMudar = () => setEmEcraInteiro(!!fsRef.current && document.fullscreenElement === fsRef.current);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);
  const alternar = (videoEl) => {
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); return; }
    const el = fsRef.current;
    if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (videoEl && videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();
  };
  return [fsRef, emEcraInteiro, alternar];
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

function ClipPlayerModal({ clip, tag, onClose, onShare, onRemove, copied, onChangeTag, onSaveEdit, originais, originalSugeridoId, onChangeTrajetoria, editarAoAbrir }) {
  const [t, setT] = useState(0);
  // EDITAR — texto e tempos (em mm:ss, relativos ao vídeo original).
  const [aEditar, setAEditar] = useState(false);
  const [notaEd, setNotaEd] = useState('');
  const [inicioEd, setInicioEd] = useState(0);
  const [fimEd, setFimEd] = useState(0);
  const [aGuardar, setAGuardar] = useState(false);
  const [erroEd, setErroEd] = useState('');
  const [originalEd, setOriginalEd] = useState(null);
  const abrirEdicao = () => {
    setOriginalEd(originalSugeridoId || null);
    setNotaEd(clip.note || '');
    setInicioEd(clip.origemInicio || 0);
    setFimEd(clip.origemFim || 0);
    setErroEd('');
    setAEditar(true);
  };
  // Marca a partir de onde o próprio clipe já vai (dá play, pausa no
  // momento certo, toca aqui) — em vez de escrever mm:ss à mão. Só
  // consegue marcar dentro do que já está neste clipe; para alargar
  // para fora disso, ainda é preciso escolher outro vídeo original.
  const marcarInicioEd = () => {
    const novo = (clip.origemInicio || 0) + (videoRef.current?.currentTime || 0);
    setInicioEd(novo);
    if (fimEd <= novo) setFimEd(novo + 1);
  };
  const marcarFimEd = () => {
    const novo = (clip.origemInicio || 0) + (videoRef.current?.currentTime || 0);
    setFimEd(novo);
    if (inicioEd >= novo) setInicioEd(Math.max(0, novo - 1));
  };
  // Aberto pelo lápis do cartão: entra logo no modo de edição.
  useEffect(() => {
    if (editarAoAbrir) abrirEdicao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const guardarEdicao = async () => {
    if (fimEd - inicioEd < 1) { setErroEd('O fim tem de ser pelo menos 1 segundo depois do início.'); return; }
    setAGuardar(true); setErroEd('');
    try {
      await onSaveEdit({ note: notaEd.trim(), inicio: inicioEd, fim: fimEd, originalId: originalEd });
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
  const [fsRef, emEcraInteiro, alternarEcraInteiro] = useEcraInteiro();
  // Em ecrã inteiro, o Esc sai do ecrã inteiro (é o browser que o faz), não fecha o leitor.
  useFecharComEsc(onClose, !aEditar && !emEcraInteiro);
  const estiloZoomClipe = useZoomCirculo((clip.shapes || []).filter(sh => shapeVisivelEm(sh, t)), !aEditar);
  const [estadoMp4, setEstadoMp4] = useState(null); // null | 'a-preparar' | 'erro'
  // Gravação com desenhos: do início ao fim do clipe, uma vez, e entrega.
  const [gravacaoClipe, setGravacaoClipe] = useState(null);
  const gravacaoClipeRef = useRef(null);
  const nomeClipe = () => {
    const tagC = TAGS.find(x => x.id === clip.tagId);
    return `${(clip.note || '').trim() || (tagC ? tagC.label : 'Clipe')} (com desenhos)`;
  };
  const acabarGravacaoClipe = async () => {
    const g = gravacaoClipeRef.current;
    if (!g) return;
    gravacaoClipeRef.current = null;
    setGravacaoClipe(null);
    const v = videoRef.current;
    if (v) { v.loop = g.loopAntes; v.pause(); }
    const blob = await g.ctl.parar();
    await entregarVideo(blob, nomeClipe());
  };
  const pararGravacaoClipe = () => { acabarGravacaoClipe(); };
  const gravarClipeComDesenhos = async () => {
    const v = videoRef.current;
    if (!v) return;
    let ctl;
    try { ctl = await prepararGravacaoSeparador(caixaVideoRef.current); } catch (e) { return; } // recusou a partilha
    const g = { ctl, loopAntes: v.loop };
    gravacaoClipeRef.current = g;
    setGravacaoClipe(g);
    ctl.acabou.then(() => { if (gravacaoClipeRef.current === g) acabarGravacaoClipe(); });
    v.loop = false;
    v.pause();
    v.currentTime = 0;
    setTimeout(() => {
      if (gravacaoClipeRef.current !== g) return;
      ctl.comecar();
      v.play().catch(() => {});
    }, 600);
  };
  // Fim do clipe = fim da gravação.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const aoAcabar = () => { if (gravacaoClipeRef.current) acabarGravacaoClipe(); };
    v.addEventListener('ended', aoAcabar);
    return () => v.removeEventListener('ended', aoAcabar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  // SEGUIR JOGADOR — deteção automática (serviço à parte, no Modal),
  // com toque para escolher quem seguir e para corrigir a meio.
  const [modoSeguir, setModoSeguir] = useState('normal'); // normal | a_escolher | a_corrigir | a_processar
  const [erroSeguir, setErroSeguir] = useState('');
  const caixaVideoRef = useRef(null); // a caixa do vídeo em si (para converter o toque em fração 0-1)
  const temTrajetoria = clip.trajetoriaFoco?.pontos?.length > 0;

  const comecarEscolha = () => {
    const v = videoRef.current;
    if (v) { v.pause(); v.currentTime = 0; }
    setErroSeguir('');
    setModoSeguir('a_escolher');
  };
  const comecarCorrecao = () => {
    videoRef.current?.pause();
    setErroSeguir('');
    setModoSeguir('a_corrigir');
  };
  const escolherJogador = async (xFrac, yFrac) => {
    const tInicial = modoSeguir === 'a_corrigir' ? (videoRef.current?.currentTime || 0) : 0;
    setModoSeguir('a_processar');
    try {
      const resultado = await seguirJogadorAssincrono({ video_url: clip.publicUrl, x_inicial: xFrac, y_inicial: yFrac, t_inicial: tInicial });
      let novosPontos = resultado.pontos || [];
      if (tInicial > 0 && clip.trajetoriaFoco?.pontos) {
        // um reancorar a meio — mantém a trajetória antiga até este
        // instante, e substitui-a a partir daqui pela nova
        const antigos = clip.trajetoriaFoco.pontos.filter(p => p.t < tInicial);
        novosPontos = [...antigos, ...novosPontos];
      }
      onChangeTrajetoria({ pontos: novosPontos, duracao: resultado.duracao });
      setModoSeguir('normal');
    } catch (e) {
      setErroSeguir(`Não consegui seguir o jogador: ${e.message || e}`);
      setModoSeguir('normal');
    }
  };
  const aoTocarNoVideo = (e) => {
    if (modoSeguir !== 'a_escolher' && modoSeguir !== 'a_corrigir') return;
    const rect = caixaVideoRef.current.getBoundingClientRect();
    escolherJogador((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', borderBottom: `1px solid ${T.line}`, background: T.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: T.muted, ...body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tag?.label || 'Sem etiqueta'} · {Math.round(clip.duracao)}s{clip.originalTitulo ? ` · ${clip.originalTitulo}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" onClick={onShare} style={{ padding: '6px 10px' }} title="Partilhar o link do clipe">
              {copied ? <Check size={14} color={T.good} /> : <Share2 size={14} />}
            </Btn>
            {/* MP4 em qualidade total (sem desenhos). */}
            <Btn variant="ghost" disabled={estadoMp4 === 'a-preparar'} onClick={async () => {
              setEstadoMp4('a-preparar');
              try { await descarregarClipeMp4(clip); setEstadoMp4(null); } catch (e) { setEstadoMp4('erro'); setTimeout(() => setEstadoMp4(null), 2500); }
            }} style={{ padding: '6px 10px' }} title="Descarregar / partilhar o MP4 (qualidade total, sem desenhos)">
              {estadoMp4 === 'a-preparar' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
              <span style={{ fontSize: 11.5 }}>{estadoMp4 === 'erro' ? 'Falhou' : 'MP4'}</span>
            </Btn>
            {/* Vídeo COM os desenhos e o zoom: grava o leitor a reproduzir. */}
            {(clip.shapes || []).length > 0 && podeGravarSeparador() && (
              <Btn variant="ghost" active={!!gravacaoClipe} onClick={gravacaoClipe ? pararGravacaoClipe : gravarClipeComDesenhos}
                style={{ padding: '6px 10px' }} title="Gravar um vídeo com os desenhos (grava este ecrã enquanto o clipe toca)">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: gravacaoClipe ? T.bad : '#fff', display: 'inline-block' }} />
                <span style={{ fontSize: 11.5 }}>{gravacaoClipe ? 'A gravar… parar' : 'Vídeo c/ desenhos'}</span>
              </Btn>
            )}
            <Btn variant="ghost" onClick={aEditar ? () => setAEditar(false) : abrirEdicao} active={aEditar} style={{ padding: '6px 10px' }} title="Editar texto e tempos">
              <Pencil size={14} />
            </Btn>
            <Btn variant="ghost" onClick={onRemove} style={{ padding: '6px 10px' }} title="Apagar clipe"><Trash2 size={14} color={T.bad} /></Btn>
            <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
          </div>
        </div>
        <div ref={fsRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#000' }}>
        <div ref={areaRef} style={{ flex: 1, minHeight: '25vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div ref={caixaVideoRef} style={{ position: 'relative', width: caixa.w || '100%', height: caixa.h || 'auto', ...estiloZoomClipe }}>
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
              {temTrajetoria && <MarcadorTrajetoria videoRef={videoRef} pontos={clip.trajetoriaFoco.pontos} />}
            </svg>
            {(modoSeguir === 'a_escolher' || modoSeguir === 'a_corrigir') && (
              <div onClick={aoTocarNoVideo}
                style={{ position: 'absolute', inset: 0, cursor: 'crosshair', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <span style={{ marginTop: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, ...body }}>
                  Toca no jogador {modoSeguir === 'a_corrigir' ? 'certo, neste momento' : 'que queres seguir'}
                </span>
              </div>
            )}
            {modoSeguir === 'a_processar' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff' }}>
                <Loader2 size={22} className="spin" />
                <span style={{ fontSize: 12.5, ...body, textAlign: 'center', padding: '0 20px' }}>A seguir o jogador — pode demorar alguns minutos…</span>
              </div>
            )}
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
          <button onClick={() => alternarEcraInteiro(videoRef.current)} title={emEcraInteiro ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
            {emEcraInteiro ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
        </div>
        {/* Texto, edição e etiquetas — por baixo do vídeo, numa zona de
            ALTURA FIXA: abrir e fechar a edição não mexe no tamanho do
            vídeo. O que não couber ganha rolagem dentro da zona. */}
        <div style={{ flexShrink: 0, height: 'calc(158px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', background: T.surface, paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxSizing: 'border-box' }}>
        {aEditar ? (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, ...body }}>
            <textarea value={notaEd} onChange={e => setNotaEd(e.target.value)} rows={2} maxLength={2000}
              placeholder="Texto do clipe (ex.: Abrir espaços)"
              style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '7px 10px', color: T.cream, fontSize: 13, resize: 'vertical', ...body }} />
            {/* Tempos, vídeo original e botões numa só linha (parte-se em
                ecrãs estreitos) — a edição tem de caber sem tapar o vídeo. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={marcarInicioEd} style={{ padding: '6px 10px', fontSize: 12.5 }}>
                <Flag size={13} color={T.good} /> Início ({fmt(inicioEd)})
              </Btn>
              <span style={{ fontSize: 12, color: T.mutedDim }}>até</span>
              <Btn variant="ghost" onClick={marcarFimEd} style={{ padding: '6px 10px', fontSize: 12.5 }}>
                <Flag size={13} color={T.bad} /> Fim ({fmt(fimEd)})
              </Btn>
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
        {/* Seguir jogador automaticamente — escondido durante a edição,
           pela mesma razão das etiquetas a seguir. */}
        {!aEditar && (
          <div style={{ padding: '10px 12px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant={temTrajetoria ? 'ghost' : 'solid'} onClick={comecarEscolha} disabled={modoSeguir === 'a_processar'} style={{ padding: '6px 10px', fontSize: 12.5 }}>
              <Target size={13} /> {temTrajetoria ? 'Seguir outra vez' : 'Seguir jogador'}
            </Btn>
            {temTrajetoria && (
              <Btn variant="ghost" onClick={comecarCorrecao} disabled={modoSeguir === 'a_processar'} style={{ padding: '6px 10px', fontSize: 12.5 }}>
                <Crosshair size={13} /> Corrigir aqui
              </Btn>
            )}
          </div>
        )}
        {erroSeguir && !aEditar && (
          <div style={{ margin: '8px 12px 0', background: T.surfaceRaise, border: `1px solid ${T.bad}`, borderRadius: 7, padding: 9, color: T.cream, fontSize: 12.5 }}>{erroSeguir}</div>
        )}
        {/* Etiqueta — pode-se atribuir ou mudar aqui, mesmo depois de o
           clipe já estar guardado sem nenhuma. Escondida durante a edição,
           para a edição caber na mesma altura. */}
        {!aEditar && <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TAGS.map(tg => (
            <button key={tg.id} onClick={() => onChangeTag(tg.id)}
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', ...body,
                border: `1px solid ${tg.color}`, background: clip.tagId === tg.id ? tg.color : 'transparent',
                color: clip.tagId === tg.id ? TEXT_ON_ACCENT : corTextoEtiqueta(tg.color),
              }}>
              {tg.label}
            </button>
          ))}
        </div>}
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

/* JOGO DE UM CLIPE DE ATLETA — para catalogar os clipes por jogo. O
   clipe guarda o título do vídeo onde foi feito (`originalTitulo`, ex.:
   "SC Salgueiros vs UD Lavrense_Parte_1"). As partes do mesmo jogo
   (Parte_1, Parte_2…) são o MESMO jogo, por isso tira-se o "_Parte_N"
   (a mesma regra de `tituloSemParte` no App). Sem título, agrupa-se pelo
   vídeo do YouTube. */
function jogoDoClipeAtleta(c) {
  const nome = String((c && c.originalTitulo) || '').replace(/\s*[-_–]?\s*parte[\s_]*\d+\s*$/i, '').replace(/_/g, ' ').trim();
  if (nome) {
    const chave = 'j:' + nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
    return { chave, nome };
  }
  return { chave: 'yt:' + ((c && c.youtubeId) || 'sem-video'), nome: 'Jogo sem nome' };
}

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
/* ===================================================================
   EXPORTAR VÍDEO — gravar a área do vídeo deste separador.

   Os cortes do YouTube não são ficheiros (são "do minuto X ao Y" sobre o
   vídeo de outra pessoa) e o YouTube não deixa descarregá-los nem ler a
   imagem. A forma legítima de ter um ficheiro é a mesma de uma gravação
   de ecrã: o browser pede autorização para partilhar ESTE separador com
   a app, a app reproduz o corte (com desenhos, pausas e zoom) e grava.
   No Chrome recorta-se só a caixa do vídeo (Region Capture); noutros
   browsers grava-se o separador inteiro.
   Sai em MP4 onde o browser o sabe gravar (Safari, Chrome recente) e em
   WebM no resto — o WhatsApp aceita os dois.
   =================================================================== */
export function podeGravarSeparador() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === 'function'
    && typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
}

// Pede o separador e prepara a gravação (ainda sem gravar: `comecar()`).
export async function prepararGravacaoSeparador(elemento) {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser', frameRate: 30, cursor: 'never' },
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
  });
  const [faixa] = stream.getVideoTracks();
  try {
    if (elemento && window.CropTarget && faixa && typeof faixa.cropTo === 'function') {
      const alvo = await window.CropTarget.fromElement(elemento);
      await faixa.cropTo(alvo);
    }
  } catch (e) { /* sem recorte: grava o separador inteiro */ }
  const tipos = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mime = tipos.find(t => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t)) || '';
  const rec = new window.MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined);
  const partes = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
  let resolver;
  const acabou = new Promise(res => { resolver = res; });
  rec.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    resolver(new Blob(partes, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] }));
  };
  const terminar = () => {
    if (rec.state !== 'inactive') rec.stop();
    else { stream.getTracks().forEach(t => t.stop()); resolver(null); }
  };
  // "Parar partilha" na barra do browser também acaba a gravação.
  if (faixa) faixa.addEventListener('ended', terminar);
  return {
    comecar: () => { if (rec.state === 'inactive') rec.start(500); },
    parar: () => { terminar(); return acabou; },
    acabou,
  };
}

// Entrega o ficheiro: partilha nativa (telemóvel) ou descarga.
export async function entregarVideo(blob, nomeBase, { soDescarregar = false } = {}) {
  if (!blob || !blob.size) return 'vazio';
  const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
  const nome = `${String(nomeBase || 'video').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'video'}.${ext}`;
  if (!soDescarregar) try {
    const ficheiro = new File([blob], nome, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [ficheiro] })) {
      await navigator.share({ files: [ficheiro], title: nomeBase });
      return 'partilhado';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelado';
    // Sem gesto do utilizador (gravação longa) o browser recusa — descarrega.
  }
  const url = URL.createObjectURL(blob);
  const ligacao = document.createElement('a');
  ligacao.href = url;
  ligacao.download = nome;
  document.body.appendChild(ligacao);
  ligacao.click();
  ligacao.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'descarregado';
}

/* MP4 VERDADEIRO dos clipes da Análise de Vídeo: o ficheiro já existe
   (foi cortado pelo serviço de vídeo e está no vosso armazenamento) —
   aqui só se vai buscar e entrega-se tal como está, em qualidade total
   (sem os desenhos, que vivem por cima do vídeo). */
async function descarregarClipeMp4(clip) {
  const tag = TAGS.find(t => t.id === clip.tagId);
  const titulo = (clip.note || '').trim() || (tag ? tag.label : 'Clipe');
  const resp = await fetch(clip.publicUrl);
  if (!resp.ok) throw new Error(`Não foi possível ir buscar o vídeo (${resp.status}).`);
  const blob = await resp.blob();
  const tipo = blob.type && blob.type.startsWith('video/') ? blob.type : 'video/mp4';
  return entregarVideo(new Blob([blob], { type: tipo }), titulo);
}

function partilharClipeFicheiro(clip) {
  const tag = TAGS.find(t => t.id === clip.tagId);
  const titulo = (clip.note || '').trim() || (tag ? tag.label : 'Clipe');
  const texto = [titulo, (clip.originalTitulo || '').trim()].filter(Boolean).join('\n');
  return partilharLink({ titulo, texto, url: `${URL_PUBLICA_APP}?clipe=${encodeURIComponent(clip.id)}` });
}

/* SEQUÊNCIA ("Ver seguidos"): com `posicao` = { indice, total }, o
   modal mostra "Clipe X de N", os botões anterior/seguinte e, ao chegar
   ao fim de um clipe, passa sozinho ao seguinte (`onFimClipe`) em vez
   de voltar ao início. Sem `posicao`, é o comportamento de sempre (um
   clipe só, em ciclo). */
function ClipAtletaModal({ clip, onClose, onRemove, posicao, onAnterior, onSeguinte, onFimClipe }) {
  const iframeRef = useRef(null);
  const inicio = Math.max(0, Number(clip.clipInicio) || 0);
  const fim = Math.max(inicio + 1, Number(clip.clipFim) || 0);
  const [tempo, setTempo] = useState(inicio);
  const [aTocar, setATocar] = useState(false);
  const saltoRef = useRef(0); // evita pedir vários saltos seguidos enquanto o primeiro não chega
  const [copiado, setCopiado] = useState(false);
  const emSequencia = !!posicao;
  const onFimClipeRef = useRef(onFimClipe);
  onFimClipeRef.current = onFimClipe;

  // O leitor só é recarregado quando o clipe seguinte é de OUTRO vídeo.
  // No mesmo jogo, salta-se dentro do leitor já aberto — a passagem de
  // um clipe para o outro fica quase imediata, sem ecrã preto.
  const [clipeDoLeitor, setClipeDoLeitor] = useState(clip);
  useEffect(() => {
    saltoRef.current = Date.now();
    setTempo(inicio);
    if (clip.youtubeId === clipeDoLeitor.youtubeId) {
      if (clip.id !== clipeDoLeitor.id) {
        const win = iframeRef.current && iframeRef.current.contentWindow;
        if (win) {
          win.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [inicio, true] }), '*');
          win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        }
      }
    } else {
      setClipeDoLeitor(clip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

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
          if (!aSaltar && t >= fim - 0.15 && emSequencia && onFimClipeRef.current) {
            saltoRef.current = Date.now(); // não pedir a passagem duas vezes
            onFimClipeRef.current();
          } else if (!aSaltar && (t >= fim - 0.15 || t < inicio - 0.5)) irPara(inicio);
          else setTempo(Math.min(fim, Math.max(inicio, t)));
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, inicio, fim, emSequencia]);

  const aoCarregar = () => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  };

  const src = `https://www.youtube.com/embed/${clipeDoLeitor.youtubeId}?start=${Math.floor(Math.max(0, Number(clipeDoLeitor.clipInicio) || 0))}&autoplay=1&rel=0&playsinline=1&controls=0&disablekb=1&enablejsapi=1&fs=0`;
  const duracao = fim - inicio;
  const [areaRef, caixa] = useCaixaNaArea(16 / 9);
  const [fsRef, emEcraInteiro, alternarEcraInteiro] = useEcraInteiro();
  useFecharComEsc(onClose, !emEcraInteiro);

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', borderBottom: `1px solid ${T.line}`, background: T.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: T.muted, ...body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {emSequencia && <strong style={{ color: T.gold, fontWeight: 700 }}>Clipe {posicao.indice + 1} de {posicao.total} · </strong>}
            {clip.atletaNome || 'Atleta'} · {mmss(inicio)}–{mmss(fim)} ({Math.round(duracao)}s)
          </span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {emSequencia && (
              <>
                <Btn variant="ghost" onClick={onAnterior} disabled={posicao.indice === 0} style={{ padding: '6px 10px' }} title="Clipe anterior"><SkipBack size={14} /></Btn>
                <Btn variant="ghost" onClick={onSeguinte} disabled={posicao.indice >= posicao.total - 1} style={{ padding: '6px 10px' }} title="Clipe seguinte"><SkipForward size={14} /></Btn>
              </>
            )}
            <Btn variant="ghost" onClick={partilhar} style={{ padding: '6px 10px' }} title="Partilhar só o corte">
              {copiado ? <Check size={14} color={T.good} /> : <Share2 size={14} />}
            </Btn>
            <Btn variant="ghost" onClick={onRemove} style={{ padding: '6px 10px' }} title="Apagar clipe"><Trash2 size={14} color={T.bad} /></Btn>
            <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
          </div>
        </div>
        <div ref={fsRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#000' }}>
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
          <button onClick={() => alternarEcraInteiro(null)} title={emEcraInteiro ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
            {emEcraInteiro ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
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
/* ===================================================================
   RELVADO — peças de ecrã (usadas pela Análise de Vídeo).
   =================================================================== */

// Grelha de verificação, pontos da calibração, linha de baliza e a
// referência do fora de jogo — tudo dentro do <svg> do vídeo.
function CamadaRelvado({ calibrando, calibracao, cantosCrus, cantos, refFJ, onAgarrarPonto }) {
  const cal = cantos ? { W: calibrando.W, D: calibrando.D, img: cantos } : (!calibrando ? calibracao : null);
  const H = cal ? matrizDaCalibracao(cal) : null;
  const Hi = H ? inverterH(H) : null;
  const linhas = [];
  if (Hi) {
    const W = Number(cal.W), D = Number(cal.D);
    const ref = aplicarH(Hi, { x: W / 2, y: D / 2 });
    const sinal = ref ? Math.sign(ref.w) : 1;
    const proj = (q) => { const r = aplicarH(Hi, q); return r && Math.sign(r.w) === sinal ? r : null; };
    const traco = (q1, q2, forte, k) => {
      const pts = [];
      for (let s = 0; s <= 24; s++) {
        const r = proj({ x: q1.x + ((q2.x - q1.x) * s) / 24, y: q1.y + ((q2.y - q1.y) * s) / 24 });
        if (r) pts.push(`${r.x},${r.y}`);
      }
      if (pts.length > 1) {
        linhas.push(<polyline key={k} points={pts.join(' ')} fill="none" stroke={forte ? TV.gold : '#ffffff'}
          strokeOpacity={forte ? 0.95 : 0.28} strokeWidth={forte ? 0.22 : 0.1} style={{ pointerEvents: 'none' }} />);
      }
    };
    for (let x = -15; x <= W + 15; x += 5) traco({ x, y: -3 }, { x, y: D + 30 }, false, `gx${x}`);
    for (let y = 0; y <= D + 30; y += 5) traco({ x: -15, y }, { x: W + 15, y }, false, `gy${y}`);
    const r4 = planoDaCalibracao(cal);
    r4.forEach((q, k) => traco(q, r4[(k + 1) % 4], true, `r${k}`));
  }
  const reta = (p1, p2, cor, k, larg = 0.18) => {
    const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
    const ex = (dx / len) * 300, ey = (dy / len) * 300;
    return <line key={k} x1={p1.x - ex} y1={p1.y - ey} x2={p2.x + ex} y2={p2.y + ey} stroke={cor} strokeWidth={larg} strokeDasharray="0.8 0.5" style={{ pointerEvents: 'none' }} />;
  };
  const porLinhas = calibrando && calibrando.modo === 'linhas';
  return (
    <g>
      {linhas}
      {porLinhas && [0, 2, 4, 6].filter(k => calibrando.pontos[k + 1]).map(k => reta(calibrando.pontos[k], calibrando.pontos[k + 1], '#4FC3F7', `rl${k}`))}
      {/* À espera da linha de baliza: os 4 lados a azul. */}
      {calibrando && calibrando.ladoBaliza == null && cantosCrus && cantosCrus.map((q, k) => {
        const r = cantosCrus[(k + 1) % 4];
        return <line key={`lado${k}`} x1={q.x} y1={q.y} x2={r.x} y2={r.y} stroke="#4FC3F7" strokeWidth={0.45} strokeLinecap="round" style={{ pointerEvents: 'none' }} />;
      })}
      {cantos && (
        <g style={{ pointerEvents: 'none' }}>
          <line x1={cantos[0].x} y1={cantos[0].y} x2={cantos[1].x} y2={cantos[1].y} stroke={TV.crimsonBright} strokeWidth={0.5} strokeLinecap="round" />
          <text x={(cantos[0].x + cantos[1].x) / 2} y={(cantos[0].y + cantos[1].y) / 2 - 1} textAnchor="middle" fill="#fff" fontSize={1.8} fontWeight={700}
            style={{ ...body, paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.35 }}>baliza</text>
        </g>
      )}
      {calibrando && calibrando.pontos.map((q, k) => (
        <g key={`cal${k}`}>
          <circle cx={q.x} cy={q.y} r={0.7} fill={TV.gold} stroke="#000" strokeWidth={0.15} style={{ pointerEvents: 'none' }} />
          <text x={q.x + 1} y={q.y - 0.9} fill="#fff" fontSize={1.8} fontWeight={700}
            style={{ ...body, paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.35, pointerEvents: 'none' }}>
            {porLinhas ? `L${Math.floor(k / 2) + 1}` : k + 1}
          </text>
          <circle cx={q.x} cy={q.y} r={2.2} fill="transparent" onPointerDown={e => onAgarrarPonto(k, e)}
            style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'all' }} />
        </g>
      ))}
      {refFJ && [refFJ.l1 || [], refFJ.l2 || []].map((l, k) => (
        <g key={`refj${k}`} style={{ pointerEvents: 'none' }}>
          {l.length === 2 && reta(l[0], l[1], '#4FC3F7', `rf${k}`, 0.16)}
          {l.map((q, j) => <circle key={j} cx={q.x} cy={q.y} r={0.6} fill="#4FC3F7" stroke="#000" strokeWidth={0.12} />)}
        </g>
      ))}
    </g>
  );
}

const estiloCaixaRelvado = {
  position: 'absolute', top: 12, zIndex: 7, width: 300, maxWidth: 'calc(100% - 40px)',
  background: 'rgba(0,0,0,0.9)', border: `1px solid ${TV.line}`, borderRadius: 10, padding: 12,
  color: '#fff', fontSize: 12.5, ...body, display: 'flex', flexDirection: 'column', gap: 8,
};
const BotaoRelvado = ({ rotulo, onClick, on, desligado }) => (
  <button type="button" onClick={onClick} disabled={desligado} style={{
    background: on ? TV.gold : 'transparent', color: on ? '#111' : '#fff', border: `1px solid ${on ? TV.gold : TV.line}`,
    borderRadius: 6, padding: '5px 9px', fontSize: 12, cursor: desligado ? 'default' : 'pointer', opacity: desligado ? 0.4 : 1, ...body,
  }}>{rotulo}</button>
);

// Painel: escolher a área, marcar, verificar, confirmar; depois as opções.
function PainelRelvado({
  calibrando, setCalibrando, calibracao, setCalibracao, cantos, modoCalib, setModoCalib,
  noChao, setNoChao, grelha, setGrelha, guias, alternarGuia, comprimentoCampo, setComprimentoCampo,
  ultimaCalibracao, onComecar, onConfirmar, onFechar,
}) {
  // Fica do lado contrário aos pontos, para não tapar a área a marcar.
  const pts = calibrando ? calibrando.pontos : [];
  const mediaX = pts.length ? pts.reduce((s, q) => s + q.x, 0) / pts.length : 0;
  const caixa = { ...estiloCaixaRelvado, ...(pts.length && mediaX < 50 ? { right: 12 } : { left: 12 }) };
  if (calibrando) {
    const modelo = MODELOS_CALIBRACAO.find(m => m.id === calibrando.tipo);
    const porLinhas = calibrando.modo === 'linhas';
    const total = porLinhas ? 8 : 4;
    const n = calibrando.pontos.length;
    const verif = cantos ? validarCalibracao(cantos, calibrando.W, calibrando.D) : null;
    const linhaAtual = Math.floor(n / 2);
    return (
      <div style={caixa} onPointerDown={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700 }}>Calibrar — {modelo ? modelo.nome : ''} · {porLinhas ? 'por linhas' : 'por cantos'}</div>
        <div style={{ color: TV.cream, lineHeight: 1.4 }}>
          {n === total && calibrando.ladoBaliza == null
            ? <><b>Agora toca na linha de baliza</b> — o lado da área colado à baliza (as linhas a azul).</>
            : n < total
              ? (porLinhas
                ? <>Linha <b>{linhaAtual + 1} de 4</b> — {LINHAS_CALIBRACAO[linhaAtual]}: toca no <b>{n % 2 === 0 ? '1.º' : '2.º'} ponto</b>, em qualquer sítio da linha (afasta bem os dois).</>
                : <>Toca no canto <b>{n + 1} de 4</b>: {modelo ? modelo.passos[n] : ''}</>)
              : 'Arrasta os pontos até a grelha amarela bater certo com as linhas do campo.'}
        </div>
        {verif && verif.ok && <div style={{ color: TV.good, lineHeight: 1.4 }}>✓ Bate certo com a {modelo ? modelo.nome.toLowerCase() : 'área'}. A linha de baliza é a vermelha.</div>}
        {verif && !verif.ok && verif.avisos.map((t, k) => <div key={k} style={{ color: TV.warn, lineHeight: 1.4 }}>⚠ {t}</div>)}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <BotaoRelvado rotulo={verif && !verif.ok ? 'Confirmar mesmo assim' : 'Confirmar'} onClick={onConfirmar} on={!(verif && !verif.ok)} desligado={!cantos} />
          {cantos && <BotaoRelvado rotulo="Mudar linha de baliza" onClick={() => setCalibrando(c => ({ ...c, ladoBaliza: null }))} />}
          <BotaoRelvado rotulo="Recuar ponto" onClick={() => setCalibrando(c => ({ ...c, pontos: c.pontos.slice(0, -1), ladoBaliza: null }))} desligado={n === 0} />
          <BotaoRelvado rotulo="Recomeçar" onClick={() => setCalibrando(c => ({ ...c, pontos: [], ladoBaliza: null }))} desligado={n === 0} />
          <BotaoRelvado rotulo="Cancelar" onClick={() => setCalibrando(null)} />
        </div>
      </div>
    );
  }
  return (
    <div style={caixa} onPointerDown={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>Relvado</span>
        <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', color: TV.mutedDim, cursor: 'pointer', padding: 0 }}><X size={15} /></button>
      </div>
      {calibracao ? (
        <>
          {calibracao.duvidosa
            ? <div style={{ color: TV.warn, lineHeight: 1.4 }}>⚠ Calibrado com avisos — os desenhos no chão ficaram desligados (sairiam tortos). Recalibra até aparecer o ✓.</div>
            : <div style={{ color: TV.good }}>✓ Calibrado ({(MODELOS_CALIBRACAO.find(m => m.id === calibracao.tipo) || {}).nome || 'retângulo'})</div>}
          <div style={{ color: TV.mutedDim, lineHeight: 1.4 }}>Zona, Círculo, Seta e Linha desenham-se no chão, com a perspetiva do campo.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <BotaoRelvado rotulo={noChao ? 'No chão: sim' : 'No chão: não'} onClick={() => setNoChao(v => !v)} on={noChao} />
            <BotaoRelvado rotulo={grelha ? 'Grelha: sim' : 'Grelha: não'} onClick={() => setGrelha(v => !v)} on={grelha} />
          </div>
          <div style={{ color: TV.mutedDim, marginTop: 2 }}>Linhas de campo:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <BotaoRelvado rotulo="5 corredores" onClick={() => alternarGuia('corredores')} on={!!(guias && guias.corredores)} />
            <BotaoRelvado rotulo="Terços" onClick={() => alternarGuia('tercos')} on={!!(guias && guias.tercos)} />
            <span style={{ color: TV.mutedDim, fontSize: 11.5 }}>campo</span>
            <input value={comprimentoCampo} inputMode="numeric"
              onChange={e => setComprimentoCampo(Number(String(e.target.value).replace(/\D/g, '').slice(0, 3)) || 0)}
              style={{ width: 44, background: '#111', color: '#fff', border: `1px solid ${TV.line}`, borderRadius: 4, padding: '3px 5px', fontSize: 12, textAlign: 'center' }} />
            <span style={{ color: TV.mutedDim, fontSize: 11.5 }}>m</span>
          </div>
          <div style={{ color: TV.mutedDim, lineHeight: 1.4, fontSize: 11.5 }}>
            Na barra: <b style={{ color: TV.cream }}>Medir</b> (arrasta entre dois pontos → metros) e <b style={{ color: TV.cream }}>Fora de jogo</b> (toca nos pés do jogador).
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <BotaoRelvado rotulo="Recalibrar" onClick={() => onComecar(MODELOS_CALIBRACAO.find(m => m.id === calibracao.tipo) || MODELOS_CALIBRACAO[0], calibracao.W, calibracao.D, calibracao.modo || modoCalib)} />
            <BotaoRelvado rotulo="Tirar calibração" onClick={() => setCalibracao(null)} />
          </div>
        </>
      ) : (
        <>
          <div style={{ color: TV.mutedDim, lineHeight: 1.4 }}>
            Com o vídeo parado, marca uma área que se veja bem. A partir daí, as formas ficam assentes no relvado e dá para medir em metros.
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: TV.mutedDim }}>Marcar por:</span>
            <BotaoRelvado rotulo="Cantos" onClick={() => setModoCalib('cantos')} on={modoCalib === 'cantos'} />
            <BotaoRelvado rotulo="Linhas" onClick={() => setModoCalib('linhas')} on={modoCalib === 'linhas'} />
          </div>
          <div style={{ color: TV.mutedDim, fontSize: 11.5, lineHeight: 1.35 }}>
            {modoCalib === 'linhas'
              ? 'Linhas: 2 toques em cada linha da área, a dar a volta — serve com os cantos tapados ou fora do ecrã.'
              : 'Cantos: os 4 cantos da área, a dar a volta, a começar em qualquer um.'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MODELOS_CALIBRACAO.filter(m => m.W).map(m => <BotaoRelvado key={m.id} rotulo={m.nome} onClick={() => onComecar(m)} />)}
          </div>
          <form onSubmit={e => {
            e.preventDefault();
            const W = parseFloat(String(e.currentTarget.elements.w.value).replace(',', '.'));
            const D = parseFloat(String(e.currentTarget.elements.d.value).replace(',', '.'));
            if (W > 0 && D > 0) onComecar(MODELOS_CALIBRACAO.find(m => m.id === 'medida'), W, D);
          }} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: TV.mutedDim }}>À medida:</span>
            <input name="w" placeholder="largura m" inputMode="decimal" style={{ width: 70, background: '#111', color: '#fff', border: `1px solid ${TV.line}`, borderRadius: 4, padding: '3px 6px', fontSize: 12 }} />
            <span>×</span>
            <input name="d" placeholder="prof. m" inputMode="decimal" style={{ width: 62, background: '#111', color: '#fff', border: `1px solid ${TV.line}`, borderRadius: 4, padding: '3px 6px', fontSize: 12 }} />
            <button type="submit" style={{ background: 'transparent', color: '#fff', border: `1px solid ${TV.line}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Marcar</button>
          </form>
          {ultimaCalibracao && <div><BotaoRelvado rotulo="Usar a calibração anterior" onClick={() => setCalibracao(ultimaCalibracao)} /></div>}
        </>
      )}
    </div>
  );
}

// Fora de jogo: pedir a referência (se faltar) ou mostrar que está feita.
function AjudaForaDeJogo({ refFJ, setRefFJ, temCalibracaoBoa }) {
  const pronto = refFJ && refFJ.pronto;
  if (!pronto && temCalibracaoBoa) return null; // a referência sai da calibração
  const base = { position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 7, ...body };
  if (pronto) {
    return (
      <div onPointerDown={e => e.stopPropagation()} style={{
        ...base, background: 'rgba(0,0,0,0.85)', border: `1px solid ${TV.line}`, borderRadius: 18, padding: '5px 8px 5px 12px',
        color: TV.cream, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        Referência ✓ ({refFJ.l2 && refFJ.l2.length === 2 ? '2 linhas' : '1 linha'}) — toca nos pés do jogador
        <BotaoRelvado rotulo="Refazer" onClick={() => setRefFJ(null)} />
      </div>
    );
  }
  const n1 = refFJ ? refFJ.l1.length : 0;
  const n2 = refFJ ? refFJ.l2.length : 0;
  return (
    <div onPointerDown={e => e.stopPropagation()} style={{
      ...base, width: 360, maxWidth: 'calc(100% - 40px)', background: 'rgba(0,0,0,0.9)', border: `1px solid ${TV.line}`,
      borderRadius: 10, padding: 12, color: '#fff', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.4,
    }}>
      <div style={{ fontWeight: 700 }}>Fora de jogo — referência</div>
      <div style={{ color: TV.cream }}>
        {n1 < 2
          ? <>Toca em <b>2 pontos de uma linha paralela à linha de baliza</b> (a linha da grande área, por exemplo) — bem afastados.</>
          : <>Agora, se se vir, <b>2 pontos noutra linha paralela</b> (linha de baliza ou da pequena área) — fica muito mais certo. Ou usa só esta.</>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {n1 === 2 && n2 === 0 && <BotaoRelvado rotulo="Usar só uma linha" on onClick={() => setRefFJ(r => ({ ...r, pronto: true }))} />}
        {(n1 + n2) > 0 && <BotaoRelvado rotulo="Recomeçar" onClick={() => setRefFJ(null)} />}
      </div>
    </div>
  );
}

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

  const [trajetoriaFocoPendente, setTrajetoriaFocoPendente] = useState(null); // { pontos, duracao } | null

  // SEGUIR JOGADOR — mais uma ferramenta de desenho, não um botão à
  // parte: escolhe-se como as outras (Seta, Círculo, ...), e o toque
  // no jogador acontece onde o vídeo já estiver nesse momento (não
  // força voltar ao início) — para poder começar a seguir a meio do
  // clipe, se for isso que interessa.
  const [processandoFoco, setProcessandoFoco] = useState(false);
  const [erroSeguirFoco, setErroSeguirFoco] = useState('');
  const escolherJogadorFoco = async (xFrac, yFrac) => {
    const tInicial = current;
    // Sem fim marcado, usa-se uma janela razoável (30s) para nunca
    // mandar analisar mais do que isso de cada vez.
    const tFim = outPoint != null && outPoint > tInicial ? outPoint : tInicial + 30;
    setTool('seta');
    setProcessandoFoco(true);
    setErroSeguirFoco('');
    try {
      const resultado = await seguirJogadorAssincrono({ video_url: signedUrl, x_inicial: xFrac, y_inicial: yFrac, t_inicial: tInicial, t_fim: tFim });
      setTrajetoriaFocoPendente(prev => {
        const novosPontos = resultado.pontos || [];
        // se já havia uma trajetória pendente, este toque conta como
        // reancorar a partir daqui — mantém a parte anterior a tInicial
        const anteriores = prev ? prev.pontos.filter(p => p.t < tInicial) : [];
        return { pontos: [...anteriores, ...novosPontos], duracao: resultado.duracao };
      });
    } catch (e) {
      setErroSeguirFoco(`Não consegui seguir o jogador: ${e.message || e}`);
    } finally {
      setProcessandoFoco(false);
    }
  };

  const [modoDesenho, setModoDesenho] = useState(false);
  /* ===== RELVADO — calibração, Medir, Fora de jogo, corredores/terços =====
     Só aqui, na Análise de Vídeo (o trabalho mais ao pormenor). A
     calibração vale para o enquadramento atual: cada forma desenhada no
     chão leva a perspetiva consigo (`chao.H`), por isso continua certa
     no clipe mesmo depois de a câmara mexer e se recalibrar. */
  const [calibracao, setCalibracao] = useState(null);
  const [calibrando, setCalibrando] = useState(null); // { tipo, W, D, modo, pontos, ladoBaliza }
  const [painelRelvado, setPainelRelvado] = useState(false);
  const [grelhaRelvado, setGrelhaRelvado] = useState(true);
  const [noChao, setNoChao] = useState(true);
  const [modoCalib, setModoCalib] = useState('cantos');
  const [comprimentoCampo, setComprimentoCampo] = useState(100);
  const [refFJ, setRefFJ] = useState(null); // { l1:[p,q], l2:[p,q], pronto }
  const arrastoCalib = useRef(null);
  const ultimaCalibracao = useRef(null);
  const matrizRelvado = calibracao ? matrizDaCalibracao(calibracao) : null;
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
  const [editarClipeAoAbrir, setEditarClipeAoAbrir] = useState(false); // lápis no cartão: abre o clipe já em edição
  const [filtroTag, setFiltroTag] = useState(null);
  // Separador da biblioteca de clipes: 'staff' (os clipes cortados aqui)
  // ou 'atletas' (Análise individual em clipes, criados no Portal).
  const [separadorClipes, setSeparadorClipes] = useState('staff');
  const [clipeAtletaAberto, setClipeAtletaAberto] = useState(null);
  // "Ver seguidos": { clipes, indice } — todos os clipes de um jogador,
  // um atrás do outro, na ordem do cartão.
  const [sequenciaAtleta, setSequenciaAtleta] = useState(null);
  const [jogoFiltroAtletas, setJogoFiltroAtletas] = useState('todos'); // 'todos' ou a chave de um jogo (ver jogoDoClipeAtleta)
  // Cartões sem barra de scroll: mostram os primeiros CLIPES_VISIVEIS e
  // um botão "Mostrar mais" que abre o cartão inteiro.
  const CLIPES_VISIVEIS = 3;
  const [cartoesAbertos, setCartoesAbertos] = useState(() => new Set());
  // Abrir/fechar um cartão SEM a página saltar: guarda-se onde está o
  // cabeçalho do cartão no ecrã, muda-se, e no fotograma seguinte
  // compensa-se o scroll (da janela ou do contentor com scroll mais
  // próximo) para o cabeçalho ficar exatamente no mesmo sítio.
  const cartaoRefs = useRef({});
  // FECHAR UM CARTÃO SEM A PÁGINA SUBIR. Ao fechar, a página fica mais
  // curta; se se estava perto do fundo, o browser é obrigado a subir a
  // página (já não há conteúdo para mostrar ali) e tudo mexe. Por isso,
  // ao fechar, a grelha guarda a altura que tinha (min-height) — a página
  // não encolhe e nada sobe. A reserva sai ao abrir outro cartão ou ao
  // mudar o filtro de jogo (aí a página muda de qualquer forma).
  const grelhaAtletasRef = useRef(null);
  const [alturaReservadaGrelha, setAlturaReservadaGrelha] = useState(0);
  const alternarCartao = (chave) => {
    const el = cartaoRefs.current[chave];
    const antes = el ? el.getBoundingClientRect().top : null;
    const aFechar = cartoesAbertos.has(chave);
    if (aFechar && grelhaAtletasRef.current) {
      setAlturaReservadaGrelha(Math.max(alturaReservadaGrelha, grelhaAtletasRef.current.getBoundingClientRect().height));
    } else if (!aFechar) {
      setAlturaReservadaGrelha(0);
    }
    setCartoesAbertos(prev => {
      const n = new Set(prev);
      if (n.has(chave)) n.delete(chave); else n.add(chave);
      return n;
    });
    if (!el || antes == null) return;
    requestAnimationFrame(() => {
      const depois = el.getBoundingClientRect().top;
      const delta = depois - antes;
      if (Math.abs(delta) < 1) return;
      let pai = el.parentElement;
      while (pai && pai !== document.body) {
        const st = getComputedStyle(pai);
        if (/(auto|scroll)/.test(st.overflowY) && pai.scrollHeight > pai.clientHeight) { pai.scrollTop += delta; return; }
        pai = pai.parentElement;
      }
      window.scrollBy(0, delta);
    });
  };

  const clipesStaff = clipes.filter(c => !ehClipeAtleta(c));
  const clipesAtletas = clipes.filter(ehClipeAtleta);
  // Um cartão por jogador, criado sozinho a partir do primeiro clipe
  // dele. Ordem alfabética; dentro do cartão, o clipe mais recente primeiro.
  // Jogos com clipes de atletas — mais recente primeiro (o do último clipe
  // feito). Alimenta o filtro "Jogo" e a ordem dos clipes em cada cartão.
  const jogosAtletas = (() => {
    const m = new Map();
    clipesAtletas.forEach(c => {
      const j = jogoDoClipeAtleta(c);
      if (!m.has(j.chave)) m.set(j.chave, { ...j, total: 0, recente: '' });
      const e = m.get(j.chave);
      e.total += 1;
      if (String(c.criadoEm || '') > e.recente) e.recente = String(c.criadoEm || '');
    });
    return [...m.values()].sort((a, b) => b.recente.localeCompare(a.recente));
  })();
  const ordemJogo = new Map(jogosAtletas.map((j, i) => [j.chave, i]));
  const jogoFiltroEfetivo = jogosAtletas.some(j => j.chave === jogoFiltroAtletas) ? jogoFiltroAtletas : 'todos';
  const cartoesAtletas = (() => {
    const porAtleta = new Map();
    clipesAtletas
      .filter(c => jogoFiltroEfetivo === 'todos' || jogoDoClipeAtleta(c).chave === jogoFiltroEfetivo)
      .forEach(c => {
      const chave = c.atletaId || c.atletaNome || 'sem-atleta';
      if (!porAtleta.has(chave)) porAtleta.set(chave, { chave, nome: c.atletaNome || 'Atleta sem nome', clipes: [] });
      porAtleta.get(chave).clipes.push(c);
    });
    const lista = [...porAtleta.values()];
    // Dentro do cartão: agrupado por jogo (o mais recente primeiro) e, em
    // cada jogo, o clipe mais recente primeiro.
    lista.forEach(g => {
      g.clipes.sort((a, b) => {
        const ja = ordemJogo.get(jogoDoClipeAtleta(a).chave) ?? 0, jb = ordemJogo.get(jogoDoClipeAtleta(b).chave) ?? 0;
        if (ja !== jb) return ja - jb;
        return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
      });
      g.nJogos = new Set(g.clipes.map(c => jogoDoClipeAtleta(c).chave)).size;
    });
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  })();

  const originalAtivo = videosOriginais.find(v => v.id === originalAtivoId) || null;
  // Outro vídeo = outro enquadramento: a calibração e a referência recomeçam.
  useEffect(() => { setCalibracao(null); setCalibrando(null); setRefFJ(null); }, [originalAtivoId]);

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
  const limparMarcas = () => { setInPoint(null); setOutPoint(null); setPendingTag(null); setNote(''); setShapes([]); setTextoPendente(null); setTrajetoriaFocoPendente(null); setErroSeguirFoco(''); };

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
        // O mesmo desvio para a trajetória do jogador em foco, se tiver
        // sido marcada antes de cortar — os pontos fora do intervalo do
        // clipe (não deviam existir, mas por segurança) ficam de fora.
        trajetoriaFoco: trajetoriaFocoPendente ? {
          pontos: trajetoriaFocoPendente.pontos
            .filter(p => p.t >= inPoint && p.t <= outPoint)
            .map(p => ({ ...p, t: Math.max(0, p.t - inPoint) })),
          duracao: outPoint - inPoint,
        } : null,
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

  // Guarda a trajetória do jogador em foco (o resultado do serviço de
  // seguimento automático) num clipe já guardado.
  const mudarTrajetoriaClipe = (clip, trajetoria) => {
    setClipes(prev => prev.map(c => (c.id === clip.id ? { ...c, trajetoriaFoco: trajetoria } : c)));
    setClipeAReproduzir(prev => (prev && prev.id === clip.id ? { ...prev, trajetoriaFoco: trajetoria } : prev));
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
      trajetoriaFoco: (clip.trajetoriaFoco && !mudouOriginal) ? {
        pontos: clip.trajetoriaFoco.pontos
          .map(p => ({ ...p, t: p.t + desvio }))
          .filter(p => p.t >= 0 && p.t <= fim - inicio),
        duracao: fim - inicio,
      } : null,
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
  /* Como na Biblioteca: do modo de desenho só se sai pelo botão "Sair do
     desenho" ou com Esc (a escrever um texto, o Esc só fecha o texto). */
  const fecharDesenhoRef = useRef(null);
  fecharDesenhoRef.current = fecharDesenho;
  useEffect(() => {
    if (!modoDesenho) return undefined;
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      const alvo = e.target;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      fecharDesenhoRef.current();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [modoDesenho]);

  // Guarda o estado anterior antes de qualquer alteração (criar, mover,
  // redimensionar, apagar) — o "Retroceder" repõe o último estado guardado.
  // Até 20 passos, para não crescer sem limite. Uma ação nova apaga o que
  // se podia "Avançar", tal como num editor normal.
  const pushHistorico = () => { setHistorico(h => [...h.slice(-19), shapes]); setFuturo([]); pontosDesfeitos.current = []; };
  // Pontos tirados com "Retroceder" a meio de uma Zona livre / Ligar
  // pontos — o "Avançar" volta a pô-los, um a um.
  const pontosDesfeitos = useRef([]);
  const retroceder = () => {
    // A meio de colocar pontos (Zona livre / Ligar pontos), "Retroceder"
    // tira o último ponto colocado — voltar a um estado de ANTES de
    // começar a forma não faria sentido, já que a forma ainda nem existe.
    if (pontosEmCurso) {
      const ult = pontosEmCurso.points[pontosEmCurso.points.length - 1];
      if (ult) pontosDesfeitos.current = [...pontosDesfeitos.current, { tool: pontosEmCurso.tool, ponto: ult }];
      setPontosEmCurso(p => (p && p.points.length > 1 ? { ...p, points: p.points.slice(0, -1) } : null));
      return;
    }
    setHistorico(h => {
      if (h.length === 0) return h;
      setFuturo(f => [...f, shapes]);
      setShapes(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };
  const avancar = () => {
    if (pontosDesfeitos.current.length) {
      const { tool: ft, ponto } = pontosDesfeitos.current[pontosDesfeitos.current.length - 1];
      pontosDesfeitos.current = pontosDesfeitos.current.slice(0, -1);
      setPontosEmCurso(p => (p && p.tool === ft ? { ...p, points: [...p.points, ponto] } : { tool: ft, points: [ponto] }));
      return;
    }
    setFuturo(f => {
      if (f.length === 0) return f;
      setHistorico(h => [...h, shapes]);
      setShapes(f[f.length - 1]);
      return f.slice(0, -1);
    });
  };

  // "Zona livre" e "Ligar pontos" constroem-se por toques sucessivos —
  // cada toque acrescenta um vértice, e "Concluir" fecha a forma.
  const concluirPontos = (selecionar) => {
    if (!pontosEmCurso) return;
    const minimo = pontosEmCurso.tool === 'zonalivre' ? 3 : 2;
    if (pontosEmCurso.points.length < minimo) return;
    pushHistorico();
    const n = shapes.length;
    setShapes(s => [...s, { id: uid(), tool: pontosEmCurso.tool, color: corAtual, points: pontosEmCurso.points, criadoEmTempo: current, mostrarAte: null }]);
    setPontosEmCurso(null);
    // "Fechar zona" / "Terminar linha": fica logo selecionada, pronta a
    // arrastar (como na Biblioteca).
    if (selecionar === true) abrirPopupDuracao(n);
  };
  const apagarUltimoPonto = () => setPontosEmCurso(p => (p && p.points.length > 1 ? { ...p, points: p.points.slice(0, -1) } : null));

  // Mudar de ferramenta com uma zona livre / ligar pontos a meio: se já
  // tiver pontos que cheguem, fica feita (junta-se aos outros desenhos)
  // em vez de se perder; se não, cancela-se.
  useEffect(() => {
    if (pontosEmCurso && pontosEmCurso.points.length >= (pontosEmCurso.tool === 'zonalivre' ? 3 : 2)) concluirPontos();
    else setPontosEmCurso(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

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
  // ---------- Relvado: funções ----------
  const cantosCrus = (c) => {
    if (!c) return null;
    return c.modo === 'linhas' ? (c.pontos.length === 8 ? cantosDasLinhas(c.pontos) : null) : (c.pontos.length === 4 ? c.pontos : null);
  };
  // A linha de baliza escolhe-se com um toque (P1–P2), não se adivinha.
  const cantosCalib = (c) => {
    const cr = cantosCrus(c);
    if (!cr || c.ladoBaliza == null) return null;
    return [0, 1, 2, 3].map(k => cr[(c.ladoBaliza + k) % 4]);
  };
  const comecarCalibracao = (modelo, W, D, modo = modoCalib) => {
    setCalibrando({ tipo: modelo.id, W: modelo.W || W, D: modelo.D || D, pontos: [], modo, ladoBaliza: null });
    videoRef.current?.pause();
    setEditandoDuracaoIndex(null);
    setPontosEmCurso(null);
  };
  const confirmarCalibracao = () => {
    const c = calibrando;
    const cantos = cantosCalib(c);
    if (!cantos) return;
    const verif = validarCalibracao(cantos, c.W, c.D);
    const duvidosa = !(verif && verif.ok);
    const cal = { tipo: c.tipo, W: c.W, D: c.D, img: cantos, modo: c.modo, ...(duvidosa ? { duvidosa: true } : {}) };
    if (!matrizDaCalibracao(cal)) return;
    setCalibracao(cal);
    ultimaCalibracao.current = cal;
    setCalibrando(null);
    setGrelhaRelvado(true);
    setNoChao(!duvidosa); // com avisos, não desenha no chão (sairia torto)
  };
  const FERR_CHAO = ['retangulo', 'circulo', 'seta', 'linha', 'medida'];
  const campoCal = () => ({ cx: calibracao ? Number(calibracao.W) / 2 : 0, L: comprimentoCampo });
  const chaoParaNova = (t) => (matrizRelvado && (noChao || t === 'medida') && FERR_CHAO.includes(t) ? { chao: { H: matrizRelvado, campo: campoCal() } } : {});
  // Fora de jogo: referência marcada, ou (se a calibração for boa) tirada dela.
  const referenciaFJAtual = () => {
    if (refFJ && refFJ.pronto && refFJ.l1 && refFJ.l1.length === 2) {
      return referenciaForaDeJogo(refFJ.l1, refFJ.l2 && refFJ.l2.length === 2 ? refFJ.l2 : null);
    }
    if (matrizRelvado && calibracao && !calibracao.duvidosa) {
      const Hi = inverterH(matrizRelvado);
      const cx = Number(calibracao.W) / 2;
      const pr = (q) => { const r = Hi && aplicarH(Hi, q); return r ? { x: r.x, y: r.y } : null; };
      const a1 = pr({ x: cx - 20, y: 0 }), b1 = pr({ x: cx + 20, y: 0 }), a2 = pr({ x: cx - 20, y: 16 }), b2 = pr({ x: cx + 20, y: 16 });
      if (a1 && b1 && a2 && b2) return referenciaForaDeJogo([a1, b1], [a2, b2]);
    }
    return null;
  };
  // Corredores / terços: uma forma de fundo (fica por baixo de tudo).
  const guiasAtuais = shapes.find(f => f.tool === 'guias' && shapeVisivelEm(f, current));
  const alternarGuia = (chave) => {
    if (!matrizRelvado) return;
    pushHistorico();
    setShapes(prev => {
      const atual = prev.find(f => f.tool === 'guias' && shapeVisivelEm(f, current));
      const base = atual || { id: uid(), tool: 'guias', color: '#FFFFFF', points: [{ x: 50, y: 28 }], corredores: false, tercos: false, criadoEmTempo: current, mostrarAte: null };
      const novo = { ...base, [chave]: !base[chave], chao: { H: matrizRelvado, campo: campoCal() } };
      const resto = prev.filter(f => f !== atual);
      return (novo.corredores || novo.tercos) ? [novo, ...resto] : resto;
    });
  };
  // Cor: com um desenho selecionado, muda também a cor dele.
  const mudarCor = (cor) => {
    setCorAtual(cor);
    if (editandoDuracaoIndex != null && shapes[editandoDuracaoIndex]) {
      pushHistorico();
      setShapes(s => s.map((sh, i) => (i === editandoDuracaoIndex ? { ...sh, color: cor } : sh)));
    }
  };
  // Zoom do círculo selecionado (1 = sem zoom).
  const mudarZoom = (z) => {
    if (editandoDuracaoIndex == null) return;
    pushHistorico();
    setShapes(s => s.map((sh, i) => {
      if (i !== editandoDuracaoIndex) return sh;
      const { zoom, ...resto } = sh; // eslint-disable-line no-unused-vars
      return z > 1 ? { ...resto, zoom: z } : resto;
    }));
  };

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
    if (modoDesenho && tool === 'seguir') {
      const pt = getPoint(e);
      escolherJogadorFoco(pt.x / 100, pt.y / 56.25);
      return;
    }
    if (!modoDesenho) return;
    if (editandoDuracaoIndex != null) setEditandoDuracaoIndex(null); // fecha um popup pendente antes de continuar
    if (textoPendente) { confirmarTexto(); return; }
    videoRef.current?.pause();
    const pt = getPoint(e);

    // RELVADO — a calibrar: cada toque é um ponto; depois, um toque na linha de baliza.
    if (calibrando) {
      const maximo = calibrando.modo === 'linhas' ? 8 : 4;
      if (calibrando.pontos.length < maximo) { setCalibrando(c => ({ ...c, pontos: [...c.pontos, pt] })); return; }
      if (calibrando.ladoBaliza == null) {
        const cr = cantosCrus(calibrando);
        if (!cr) return;
        let melhor = -1, dist = Infinity;
        for (let k = 0; k < 4; k++) {
          const d = distPontoSegmento(pt, cr[k], cr[(k + 1) % 4]);
          if (d < dist) { dist = d; melhor = k; }
        }
        if (melhor >= 0 && dist < 8) setCalibrando(c => ({ ...c, ladoBaliza: melhor }));
      }
      return;
    }
    // FORA DE JOGO — sem referência ainda: os toques marcam-na.
    if (tool === 'foraDeJogo' && !referenciaFJAtual()) {
      setRefFJ(prev => {
        const ref = prev || { l1: [], l2: [], pronto: false };
        if (ref.l1.length < 2) return { ...ref, l1: [...ref.l1, pt] };
        if (ref.l2.length < 2) { const l2 = [...ref.l2, pt]; return { ...ref, l2, pronto: l2.length === 2 }; }
        return ref;
      });
      return;
    }

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
    if (tool === 'zonalivre' || tool === 'linhaPontos') { pontosDesfeitos.current = []; setPontosEmCurso({ tool, points: [pt] }); return; }
    // Fora de jogo: um toque nos pés do jogador → a linha.
    if (tool === 'foraDeJogo') {
      const r = referenciaFJAtual();
      if (!r) return;
      pushHistorico();
      setShapes(s => [...s, { id: uid(), tool: 'foraDeJogo', color: corAtual, points: [pt], fj: r, criadoEmTempo: current, mostrarAte: null }]);
      return;
    }
    if (tool === 'medida' && !matrizRelvado) return;
    pushHistorico();
    drawState.current = { id: uid(), tool, color: corAtual, points: [pt], criadoEmTempo: current, mostrarAte: null, ...chaoParaNova(tool) };
    setShapes(s => [...s, drawState.current]);
  };
  // Arrastar uma das "pegas" de uma forma selecionada (aparecem junto ao
  // popup de duração) — para a redimensionar ou reorientar. Na Zona há
  // ainda uma pega extra só para rodar.
  const startHandleDrag = (index, ponto, e, tipo) => {
    e.stopPropagation();
    pushHistorico();
    const st = { index, ponto, tipo };
    if (tipo === 'inclinacao') {
      const sh = shapes[index];
      const [pa, pb] = sh.points;
      const w = Math.abs(pb.x - pa.x), h = Math.abs(pb.y - pa.y);
      st.y0 = getPoint(e).y;
      st.h = h;
      st.inc0 = Number.isFinite(Number(sh.inclinacao)) ? Number(sh.inclinacao) : inclinacaoPadrao(w, h);
    }
    handleDragState.current = st;
  };
  const moveDraw = (e) => {
    if (!modoDesenho) return;
    if (arrastoCalib.current != null) {
      const pt = getPoint(e);
      const k = arrastoCalib.current;
      setCalibrando(c => (c ? { ...c, pontos: c.pontos.map((q, i) => (i === k ? pt : q)) } : c));
      return;
    }
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
      if (tipo === 'inclinacao') {
        // Para cima = o lado de cima foge para o fundo; para baixo endireita e inverte.
        const { y0, h, inc0 } = handleDragState.current;
        const inc = Math.max(-0.45, Math.min(0.45, inc0 + ((y0 - pt.y) / Math.max(4, h)) * 0.5));
        setShapes(s => s.map((sh, i) => (i === index ? { ...sh, inclinacao: Math.round(inc * 1000) / 1000 } : sh)));
        return;
      }
      setShapes(s => s.map((sh, i) => {
        if (i !== index) return sh;
        // Zona no chão: roda e mexe nos cantos no próprio relvado.
        if (tipo === 'rotacao' && sh.chao) return { ...sh, rotacao: anguloRodarZonaNoChao(sh, pt) };
        if (sh.tool === 'retangulo' && sh.chao) {
          const pLocal = sh.rotacao ? desrodarNaZonaNoChao(sh, pt) : pt;
          return { ...sh, points: sh.points.map((p, pi) => (pi === ponto ? pLocal : p)) };
        }
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
    if (arrastoCalib.current != null) { arrastoCalib.current = null; return; }
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
  // A ver (fora do desenho), o círculo com zoom aproxima a imagem, como no clipe final.
  const estiloZoomEditor = useZoomCirculo(shapesVisiveis, !modoDesenho);

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
            style={{ flex: '1 1 180px', background: T.campoFundo, color: T.campoTexto, border: `1px solid ${T.line}`, borderRadius: 4, padding: '6px 9px', fontSize: 13, ...body }}
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
                    style={{ width: '100%', background: T.campoFundo, color: T.campoTexto, border: `1px solid ${T.crimsonBright}`, borderRadius: 4, padding: '3px 6px', fontSize: 12.5, ...body }}
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
        <BancadaVideo.Provider value={true}>
        <div ref={containerRef} style={{
          background: TV.surface, borderRadius: 12, border: `1px solid ${TV.line}`, overflow: 'hidden',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${TV.line}`, background: TV.surfaceRaise }}>
              <span style={{ fontSize: 12.5, color: TV.muted, ...mono }}>Modo de desenho — vídeo em pausa</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Botões simples: o Btn trava cliques seguidos (e aqui recuam-se vários pontos de rajada). */}
                {[
                  { on: historico.length > 0 || !!pontosEmCurso, fn: retroceder, Ic: Undo2, t: 'Recuar' },
                  { on: futuro.length > 0 || pontosDesfeitos.current.length > 0, fn: avancar, Ic: Redo2, t: 'Avançar' },
                ].map(({ on, fn, Ic, t: rotulo }) => (
                  <button key={rotulo} type="button" onClick={fn} disabled={!on} title={rotulo} aria-label={rotulo} style={{
                    padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent',
                    border: `1px solid ${TV.line}`, borderRadius: 8, color: on ? TV.cream : TV.mutedDim, opacity: on ? 1 : 0.45, cursor: on ? 'pointer' : 'default',
                  }}><Ic size={16} /></button>
                ))}
                <Btn variant="solid" onClick={fecharDesenho} title="Sair do modo de desenho (ou Esc)"><X size={14} /> Sair do desenho</Btn>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* BARRA DE FERRAMENTAS — UMA SÓ COLUNA. Para caber tudo saiu a
                ferramenta "Linha" (a Seta e o Traço cobrem esse uso) e os
                botões são um pouco mais compactos. Em ecrã inteiro fica igual:
                esta barra à esquerda e a das cores/texto/apagar à direita.
                Se mesmo assim faltar altura (ecrã baixo), a barra desliza. */}
            <div style={{
              maxWidth: modoDesenho ? 90 : 0, opacity: modoDesenho ? 1 : 0, overflow: 'hidden', flexShrink: 0,
              transition: 'max-width 0.2s ease, opacity 0.15s ease',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 5, padding: 8,
                borderRight: `1px solid ${TV.line}`, overflowY: 'auto', overflowX: 'hidden', width: 90, height: '100%', boxSizing: 'border-box',
              }}>
                {FERRAMENTAS.filter(([id]) => id !== 'linha').map(([id, Icon, titulo]) => (
                  <ToolBtn compacto key={id} icon={Icon} label={titulo} active={tool === id} onClick={() => setTool(id)} />
                ))}
                <ToolBtn compacto icon={Target} label="Seguir" active={tool === 'seguir'} onClick={() => setTool('seguir')} />
                <div style={{ height: 1, background: TV.line, margin: '2px 0', flexShrink: 0 }} />
                <ToolBtn compacto icon={LayoutGrid} label={calibracao ? 'Relvado ✓' : 'Relvado'} active={painelRelvado || !!calibrando} onClick={() => setPainelRelvado(v => !v)} />
                <ToolBtn compacto icon={Flag} label="Fora de jogo" active={tool === 'foraDeJogo'} onClick={() => setTool('foraDeJogo')} />
                {calibracao && <ToolBtn compacto icon={Ruler} label="Medir" active={tool === 'medida'} onClick={() => setTool('medida')} />}
              </div>
            </div>
            <div ref={canvasWrapRef} style={{ position: 'relative', background: '#000', flex: 1, minHeight: 0, width: '100%', touchAction: modoDesenho ? 'none' : 'auto', transition: 'width 0.2s ease', boxSizing: 'border-box', overflow: 'hidden' }}
              onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerLeave={endDraw} onPointerCancel={endDraw}>
              {/* Vídeo + desenho juntos numa caixa: é ela que se aproxima no zoom do círculo. */}
              {/* (Sem a margem de 18px à direita em ecrã inteiro — era a barra preta;
                 servia quando a coluna da direita desaparecia em ecrã inteiro.) */}
              <div style={{ position: 'absolute', inset: 0, ...estiloZoomEditor }}>
              {originalAtivo?.pronto === false ? (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: TV.muted, gap: 8, textAlign: 'center', padding: 20 }}>
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
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: TV.muted, pointerEvents: 'none' }}>
                      <Loader2 size={20} className="spin" />
                      <span style={{ fontSize: 12, ...body }}>A carregar o vídeo…</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: TV.muted }}><Loader2 size={20} className="spin" /></div>
              )}
              <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: modoDesenho ? 'auto' : 'none', cursor: modoDesenho ? (tool === 'apagar' ? CURSOR_BORRACHA : hoverMove ? 'move' : 'crosshair') : 'default' }}>
                {shapesVisiveis.map(renderShape)}
                {trajetoriaFocoPendente && <MarcadorTrajetoria videoRef={videoRef} pontos={trajetoriaFocoPendente.pontos} />}
                {modoDesenho && (
                  <CamadaRelvado calibrando={calibrando} calibracao={grelhaRelvado ? calibracao : null}
                    cantosCrus={cantosCrus(calibrando)} cantos={cantosCalib(calibrando)}
                    refFJ={tool === 'foraDeJogo' ? refFJ : null}
                    onAgarrarPonto={(k, e) => { e.stopPropagation(); arrastoCalib.current = k; }} />
                )}

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
                {editandoDuracaoIndex != null && shapes[editandoDuracaoIndex] && shapes[editandoDuracaoIndex].tool === 'retangulo' && shapes[editandoDuracaoIndex].chao && shapes[editandoDuracaoIndex].points[1] && (() => {
                  // Zona no chão: cantos e pega de rodar na perspetiva do relvado (sem inclinar).
                  const forma = shapes[editandoDuracaoIndex];
                  const c0 = pegaZonaNoChao(forma, 0), c1 = pegaZonaNoChao(forma, 1);
                  const rc = pegaRodarZonaNoChao(forma);
                  return (
                    <g>
                      {rc && rc.base && rc.pega && <line x1={rc.base.x} y1={rc.base.y} x2={rc.pega.x} y2={rc.pega.y} stroke={TV.gold} strokeWidth={0.15} />}
                      <circle cx={c0.x} cy={c0.y} r={0.55} fill={TV.crimsonBright} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, 0, e)} style={{ cursor: 'pointer', touchAction: 'none' }} />
                      <circle cx={c1.x} cy={c1.y} r={0.55} fill={TV.crimsonBright} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, 1, e)} style={{ cursor: 'pointer', touchAction: 'none' }} />
                      {rc && rc.pega && (
                        <circle cx={rc.pega.x} cy={rc.pega.y} r={0.55} fill={TV.gold} stroke="#fff" strokeWidth={0.15}
                          onPointerDown={e => startHandleDrag(editandoDuracaoIndex, null, e, 'rotacao')} style={{ cursor: 'grab', touchAction: 'none' }} />
                      )}
                    </g>
                  );
                })()}
                {editandoDuracaoIndex != null && shapes[editandoDuracaoIndex] && shapes[editandoDuracaoIndex].tool === 'retangulo' && !shapes[editandoDuracaoIndex].chao && shapes[editandoDuracaoIndex].points[1] && (() => {
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
                      <line x1={topoMeio.x} y1={topoMeio.y} x2={pegaRodar.x} y2={pegaRodar.y} stroke={TV.gold} strokeWidth={0.15} />
                      <circle cx={p0.x} cy={p0.y} r={0.55} fill={TV.crimsonBright} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, 0, e)} style={{ cursor: 'pointer', touchAction: 'none' }} />
                      <circle cx={p1.x} cy={p1.y} r={0.55} fill={TV.crimsonBright} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, 1, e)} style={{ cursor: 'pointer', touchAction: 'none' }} />
                      <circle cx={pegaRodar.x} cy={pegaRodar.y} r={0.55} fill={TV.gold} stroke="#fff" strokeWidth={0.15}
                        onPointerDown={e => startHandleDrag(editandoDuracaoIndex, null, e, 'rotacao')} style={{ cursor: 'grab', touchAction: 'none' }} />
                      {/* Pega de INCLINAR (rodar para cima/baixo), ao lado direito. */}
                      {(() => {
                        const pd = girar({ x: x + w + 2.6, y: centro.y }, centro, rot);
                        return (
                          <g>
                            <rect x={pd.x - 0.75} y={pd.y - 1.6} width={1.5} height={3.2} rx={0.75} fill="#fff" stroke={TV.crimsonBright} strokeWidth={0.2} style={{ pointerEvents: 'none' }} />
                            <circle cx={pd.x} cy={pd.y} r={1.6} fill="transparent"
                              onPointerDown={e => startHandleDrag(editandoDuracaoIndex, null, e, 'inclinacao')} style={{ cursor: 'ns-resize', touchAction: 'none' }} />
                          </g>
                        );
                      })()}
                    </g>
                  );
                })()}
                {editandoDuracaoIndex != null && shapes[editandoDuracaoIndex] && ['seta', 'linha', 'circulo', 'cone', 'zonalivre', 'linhaPontos', 'medida'].includes(shapes[editandoDuracaoIndex].tool) &&
                  shapes[editandoDuracaoIndex].points.map((p, pi) => (
                    <circle key={pi} cx={p.x} cy={p.y} r={['zonalivre', 'linhaPontos'].includes(shapes[editandoDuracaoIndex].tool) ? 0.4 : 0.55} fill={TV.crimsonBright} stroke="#fff" strokeWidth={0.15}
                      onPointerDown={e => startHandleDrag(editandoDuracaoIndex, pi, e)}
                      style={{ cursor: 'pointer', touchAction: 'none' }} />
                  ))}
              </svg>
              </div>
              {modoDesenho && tool === 'seguir' && !processandoFoco && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ marginTop: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, ...body }}>
                    Toca no jogador que queres seguir
                  </span>
                </div>
              )}
              {processandoFoco && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff' }}>
                  <Loader2 size={22} className="spin" />
                  <span style={{ fontSize: 12.5, ...body, textAlign: 'center', padding: '0 20px' }}>A seguir o jogador — pode demorar alguns minutos…</span>
                </div>
              )}
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
                  <Btn variant="solid" onClick={() => concluirPontos(true)} disabled={pontosEmCurso.points.length < (pontosEmCurso.tool === 'zonalivre' ? 3 : 2)} style={{ padding: '5px 10px', fontSize: 12 }}>
                    <Check size={13} /> {pontosEmCurso.tool === 'zonalivre' ? 'Fechar zona' : 'Terminar linha'}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setPontosEmCurso(null)} style={{ padding: '5px 10px', fontSize: 12 }}>Cancelar</Btn>
                </div>
              )}
              {modoDesenho && (painelRelvado || calibrando) && (
                <PainelRelvado
                  calibrando={calibrando} setCalibrando={setCalibrando} calibracao={calibracao} setCalibracao={setCalibracao}
                  cantos={cantosCalib(calibrando)} modoCalib={modoCalib} setModoCalib={setModoCalib}
                  noChao={noChao} setNoChao={setNoChao} grelha={grelhaRelvado} setGrelha={setGrelhaRelvado}
                  guias={guiasAtuais} alternarGuia={alternarGuia}
                  comprimentoCampo={comprimentoCampo} setComprimentoCampo={(n) => {
                    setComprimentoCampo(n);
                    if (n >= 60) setShapes(prev => prev.map(f => (f.tool === 'guias' && f.chao ? { ...f, chao: { ...f.chao, campo: { ...f.chao.campo, L: n } } } : f)));
                  }}
                  ultimaCalibracao={ultimaCalibracao.current}
                  onComecar={comecarCalibracao} onConfirmar={confirmarCalibracao} onFechar={() => setPainelRelvado(false)} />
              )}
              {modoDesenho && tool === 'foraDeJogo' && (
                <AjudaForaDeJogo refFJ={refFJ} setRefFJ={setRefFJ} temCalibracaoBoa={!!(calibracao && !calibracao.duvidosa)} />
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
                    style={{ width: 62, background: '#111', color: '#fff', border: `1px solid ${TV.line}`, borderRadius: 4, padding: '3px 6px', fontSize: 13, textAlign: 'center', ...mono }}
                  />
                  <Btn variant="solid" onClick={confirmarDuracaoShape} style={{ padding: '5px 10px', fontSize: 12 }}>OK</Btn>
                  <Btn variant="ghost" onClick={marcarSempreVisivelShape} style={{ padding: '5px 10px', fontSize: 12 }}>Sempre visível</Btn>
                  {shapes[editandoDuracaoIndex]?.tool === 'circulo' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Ao reproduzir, a imagem aproxima-se deste círculo enquanto ele estiver visível">
                      <span style={{ fontSize: 12, color: '#fff', ...body }}>Zoom:</span>
                      {[[1, 'Sem'], [1.5, '1,5×'], [2, '2×'], [3, '3×']].map(([z, r]) => {
                        const on = (Number(shapes[editandoDuracaoIndex]?.zoom) || 1) === z;
                        return (
                          <button key={z} type="button" onClick={() => mudarZoom(z)} style={{
                            background: on ? TV.gold : 'none', color: on ? '#111' : '#fff', border: `1px solid ${on ? TV.gold : TV.line}`,
                            borderRadius: 4, padding: '2px 7px', fontSize: 11.5, cursor: 'pointer', ...mono,
                          }}>{r}</button>
                        );
                      })}
                    </span>
                  )}
                  {shapes[editandoDuracaoIndex]?.tool === 'retangulo' && (
                    <Btn variant={shapes[editandoDuracaoIndex]?.semContorno ? 'solid' : 'ghost'} onClick={alternarContornoZona} style={{ padding: '5px 10px', fontSize: 12 }}>
                      {shapes[editandoDuracaoIndex]?.semContorno ? 'Sem contorno' : 'Com contorno'}
                    </Btn>
                  )}
                </div>
              )}
            </div>
            <div style={{
              maxWidth: modoDesenho ? 90 : 0, opacity: modoDesenho ? 1 : 0, overflow: 'hidden', flexShrink: 0,
              transition: 'max-width 0.2s ease, opacity 0.15s ease',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderLeft: `1px solid ${TV.line}`, justifyContent: 'center', width: 90 }}>
                <ToolBtn icon={Type} label="Texto" active={tool === 'texto'} onClick={() => setTool('texto')} />
                <div style={{ height: 1, background: TV.line, margin: '4px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center', padding: '2px 0' }}>
                  {PALETA_DESENHO.map(p => (
                    <button key={p.id} onClick={() => mudarCor(p.cor)} title={p.id}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0,
                        background: p.cor, border: corAtual === p.cor ? `2px solid ${TV.crimsonBright}` : `1px solid ${TV.line}`,
                      }} />
                  ))}
                </div>
                <div style={{ height: 1, background: TV.line, margin: '4px 0' }} />
                <ToolBtn icon={Eraser} label="Apagar" active={tool === 'apagar'} onClick={() => setTool('apagar')} />
                <ToolBtn icon={Trash2} label="Limpar tudo" active={false} onClick={() => { pushHistorico(); setShapes([]); }} />
              </div>
            </div>
          </div>

          <div style={{ padding: '10px 14px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Btn variant="ghost" onClick={togglePlay} style={{ padding: 8 }}>{playing ? <Pause size={16} /> : <Play size={16} />}</Btn>
            <span style={{ fontSize: 12, color: TV.muted, ...mono, minWidth: 44 }}>{fmt(current)}</span>
            <div onPointerDown={startScrub} onPointerMove={dragScrub} onPointerUp={endScrub} onPointerCancel={endScrub}
              style={{ flex: 1, height: 36, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', touchAction: 'none' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: TV.line, borderRadius: 3 }} />
              <div style={{ position: 'absolute', left: 0, width: `${pct(current)}%`, height: 6, background: TV.gold, borderRadius: 3 }} />
              {inPoint != null && <div style={{ position: 'absolute', left: `${pct(inPoint)}%`, top: -4, width: 2, height: 14, background: TV.good }} />}
              {outPoint != null && <div style={{ position: 'absolute', left: `${pct(outPoint)}%`, top: -4, width: 2, height: 14, background: TV.bad }} />}
              <div style={{
                position: 'absolute', left: `${pct(current)}%`, transform: 'translateX(-50%)',
                width: 16, height: 16, borderRadius: '50%', background: TV.gold,
                border: `2px solid ${TV.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </div>
            <span style={{ fontSize: 12, color: TV.mutedDim, ...mono, minWidth: 44 }}>{fmt(duration)}</span>
            <Btn variant="ghost" onClick={alternarEcraInteiro} style={{ padding: 8 }} title="Ecrã inteiro">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Btn>
          </div>

          <div style={{ padding: '8px 14px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: `1px solid ${TV.line}` }}>
            <Btn variant="ghost" onClick={markIn}><Flag size={14} color={TV.good} /> Marcar início ({fmt(inPoint ?? 0)})</Btn>
            <Btn variant="ghost" onClick={markOut}><Flag size={14} color={TV.bad} /> Marcar fim ({fmt(outPoint ?? 0)})</Btn>
            <Btn variant="ghost" onClick={limparMarcas} disabled={inPoint == null && outPoint == null}><RotateCcw size={14} /> Limpar</Btn>
            {!modoDesenho && (
              <>
                <div style={{ width: 1, background: TV.line, margin: '0 4px' }} />
                <Btn variant="ghost" onClick={abrirDesenho}>
                  <Scissors size={14} /> Desenhar {shapes.length > 0 && `(${shapes.length})`}
                  {trajetoriaFocoPendente && <Target size={13} color={TV.crimsonBright} style={{ marginLeft: 2 }} />}
                </Btn>
              </>
            )}
          </div>
          {erroSeguirFoco && (
            <div style={{ margin: '0 14px 10px', background: TV.surfaceRaise, border: `1px solid ${TV.bad}`, borderRadius: 7, padding: 9, color: TV.cream, fontSize: 12.5 }}>{erroSeguirFoco}</div>
          )}

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
                <div style={{ margin: '0 14px 16px', background: TV.surfaceRaise, borderRadius: 10, padding: 12, border: `1px solid ${TV.line}` }}>
                  <div style={{ fontSize: 12.5, color: TV.muted, marginBottom: 8, ...mono }}>
                    Novo clipe · {fmt(inPoint)} – {fmt(outPoint)} ({Math.round(outPoint - inPoint)}s) {shapes.length > 0 && `· ${shapes.length} desenho(s)`}
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota…"
                    style={{ width: '100%', minHeight: 54, background: TV.surface, border: `1px solid ${TV.line}`, borderRadius: 7, color: TV.cream, padding: 8, fontSize: 13, resize: 'vertical', ...body }} />
                  {erro && (
                    <div style={{ background: TV.surface, border: `1px solid ${TV.bad}`, borderRadius: 7, padding: 9, marginTop: 8, color: TV.cream, fontSize: 12.5 }}>{erro}</div>
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
        </BancadaVideo.Provider>
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
            <>
            {/* alignItems 'start': abrir um cartão já não estica o do lado.
                overflowAnchor 'none': o browser deixa de "corrigir" o scroll
                sozinho quando a lista cresce (era isso que fazia a página
                mexer toda ao carregar em "Mostrar mais"). */}
            <div ref={grelhaAtletasRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignItems: 'start', overflowAnchor: 'none', minHeight: alturaReservadaGrelha || undefined }}>
              {cartoesAtletas.map(g => (
                <div key={g.chave} ref={el => { if (el) cartaoRefs.current[g.chave] = el; else delete cartaoRefs.current[g.chave]; }}
                  style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* CABEÇALHO — nome sempre inteiro (pode ocupar duas linhas),
                     com o nº de clipes por baixo; o "Ver seguidos" passou a
                     um botão redondo de play, para não roubar espaço ao nome. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 14px', borderBottom: `1px solid ${T.line}` }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: '50%', background: T.surfaceRaise, color: T.gold, flexShrink: 0,
                      border: `1.5px solid ${T.gold}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, ...body,
                    }}>
                      {g.nome.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: T.cream, ...body, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{g.nome}</span>
                      <span style={{ fontSize: 12, color: T.mutedDim, ...body }}>
                        {g.clipes.length} {g.clipes.length === 1 ? 'clipe' : 'clipes'}
                        {g.nJogos > 1 && <> · {g.nJogos} jogos</>}
                      </span>
                    </span>
                    {g.clipes.length > 1 && (
                      <button onClick={() => setSequenciaAtleta({ clipes: g.clipes, indice: 0 })}
                        title={`Ver os ${g.clipes.length} clipes de ${g.nome} seguidos`}
                        aria-label={`Ver os ${g.clipes.length} clipes de ${g.nome} seguidos`}
                        style={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                          background: T.goldFundo, border: 'none', color: '#111',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                        }}>
                        <Play size={17} fill="#111" style={{ marginLeft: 2 }} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(cartoesAbertos.has(g.chave) ? g.clipes : g.clipes.slice(0, CLIPES_VISIVEIS)).map((c, ci, arr) => {
                      // Separador de jogo: quando o jogador tem clipes de
                      // mais de um jogo, cada bloco começa com o nome do
                      // jogo e um play que vê só os clipes dele desse jogo.
                      const jogo = jogoDoClipeAtleta(c);
                      const novoJogo = g.nJogos > 1 && (ci === 0 || jogoDoClipeAtleta(arr[ci - 1]).chave !== jogo.chave);
                      const doJogo = novoJogo ? g.clipes.filter(x => jogoDoClipeAtleta(x).chave === jogo.chave) : null;
                      return (
                      <React.Fragment key={c.id}>
                      {novoJogo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px 6px 14px', background: T.surfaceRaise, borderBottom: `1px solid ${T.line}` }}>
                          <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: T.gold, flexShrink: 0 }} />
                          <span title={jogo.nome} style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: T.cream, ...body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{jogo.nome}</span>
                          <button onClick={() => setSequenciaAtleta({ clipes: doJogo, indice: 0 })}
                            title={`Ver os ${doJogo.length} clipes de ${g.nome} neste jogo`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer', ...body,
                              background: 'transparent', border: `1px solid ${T.gold}`, color: T.gold,
                              borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                            }}>
                            <Play size={10} fill={T.gold} /> {doJogo.length}
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${T.line}` }}>
                      <button onClick={() => setClipeAtletaAberto(c)}
                        style={{
                          flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '9px 4px 9px 12px', cursor: 'pointer',
                          background: 'transparent', border: 'none', ...body,
                        }}>
                        <img src={`https://img.youtube.com/vi/${c.youtubeId}/default.jpg`} alt=""
                          style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: T.surfaceRaise }} />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 13, color: T.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{c.titulo || '(sem título)'}</span>
                            {/* O jogador apagou-o no Portal: para ele desaparece,
                               mas o treinador continua a tê-lo (marcado pelo
                               servidor em `apagadoPeloAtleta`). */}
                            {c.apagadoPeloAtleta && (
                              <span title="O jogador apagou este clipe no Portal. Continua disponível aqui para o treinador."
                                style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: T.mutedDim, border: `1px solid ${T.line}`, borderRadius: 4, padding: '0 5px', lineHeight: '15px' }}>
                                Apagado no Portal
                              </span>
                            )}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.mutedDim, ...mono, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            <Scissors size={10} style={{ flexShrink: 0 }} /> {mmss(c.clipInicio)}–{mmss(c.clipFim)}
                            {dataCurta(c.criadoEm) && <span style={{ ...body, marginLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>· {dataCurta(c.criadoEm)}</span>}
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
                      <button
                        onClick={() => removerClipe(c)}
                        title="Apagar o clipe (também desaparece para o jogador)" aria-label={`Apagar o clipe ${c.titulo || ''}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px 10px 2px', display: 'flex', flexShrink: 0 }}>
                        <Trash2 size={15} color={T.muted} />
                      </button>
                      </div>
                      </React.Fragment>
                      );
                    })}
                  </div>
                  {g.clipes.length > CLIPES_VISIVEIS && (
                    <button onClick={() => alternarCartao(g.chave)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', ...body,
                        background: 'transparent', border: 'none', color: T.muted, padding: '9px 12px', fontSize: 12.5, fontWeight: 600,
                      }}>
                      {cartoesAbertos.has(g.chave)
                        ? <><ChevronUp size={14} /> Mostrar menos</>
                        : <><ChevronDown size={14} /> Mostrar mais {g.clipes.length - CLIPES_VISIVEIS}</>}
                    </button>
                  )}
                </div>
              ))}
            </div>
            </>
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
                    border: `1px solid ${tag.color}`, background: filtroTag === tag.id ? tag.color : 'transparent', color: filtroTag === tag.id ? TEXT_ON_ACCENT : corTextoEtiqueta(tag.color),
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
                  <button onClick={() => { setEditarClipeAoAbrir(false); setClipeAReproduzir(clip); }}
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
                      <div style={{ fontSize: 12, fontWeight: 600, color: corTextoEtiqueta(tag?.color) || T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tag?.label || 'Sem etiqueta'}</div>
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
                  {/* Editar e apagar, ao lado do partilhar (mesmo estilo). */}
                  <button
                    onClick={() => { setEditarClipeAoAbrir(true); setClipeAReproduzir(clip); }}
                    title="Editar o clipe" aria-label="Editar o clipe"
                    style={{
                      position: 'absolute', top: 7, left: 38, width: 26, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}>
                    <Pencil size={13} color="#fff" />
                  </button>
                  <button
                    onClick={() => removerClipe(clip)}
                    title="Apagar o clipe" aria-label="Apagar o clipe"
                    style={{
                      position: 'absolute', top: 7, left: 70, width: 26, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}>
                    <Trash2 size={13} color="#fff" />
                  </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {sequenciaAtleta && sequenciaAtleta.clipes[sequenciaAtleta.indice] && (
        <ClipAtletaModal
          clip={sequenciaAtleta.clipes[sequenciaAtleta.indice]}
          posicao={{ indice: sequenciaAtleta.indice, total: sequenciaAtleta.clipes.length }}
          onAnterior={() => setSequenciaAtleta(s => ({ ...s, indice: Math.max(0, s.indice - 1) }))}
          onSeguinte={() => setSequenciaAtleta(s => ({ ...s, indice: Math.min(s.clipes.length - 1, s.indice + 1) }))}
          // No fim do último clipe, recomeça do primeiro (fica em ciclo,
          // como um clipe sozinho) — dá para deixar a correr numa conversa.
          onFimClipe={() => setSequenciaAtleta(s => ({ ...s, indice: s.indice + 1 < s.clipes.length ? s.indice + 1 : 0 }))}
          onClose={() => setSequenciaAtleta(null)}
          onRemove={() => {
            const alvo = sequenciaAtleta.clipes[sequenciaAtleta.indice];
            removerClipe(alvo, () => setSequenciaAtleta(s => {
              if (!s) return s;
              const restantes = s.clipes.filter(c => c.id !== alvo.id);
              if (restantes.length === 0) return null;
              return { clipes: restantes, indice: Math.min(s.indice, restantes.length - 1) };
            }));
          }}
        />
      )}

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
          onClose={() => { setClipeAReproduzir(null); setEditarClipeAoAbrir(false); }}
          copied={copiedId === clipeAReproduzir.id}
          onShare={async () => { if (await partilharClipeFicheiro(clipeAReproduzir) === 'copiado') { setCopiedId(clipeAReproduzir.id); setTimeout(() => setCopiedId(null), 1600); } }}
          onSaveEdit={(dados) => editarClipeFicheiro(clipeAReproduzir, dados)}
          editarAoAbrir={editarClipeAoAbrir}
          originais={videosOriginais.filter(v => v.storagePath)}
          originalSugeridoId={(originalDoClipe(clipeAReproduzir) || {}).id || null}
          onRemove={() => removerClipe(clipeAReproduzir, () => setClipeAReproduzir(null))}
          onChangeTag={novoTagId => mudarTagClipe(clipeAReproduzir, novoTagId)}
          onChangeTrajetoria={trajetoria => mudarTrajetoriaClipe(clipeAReproduzir, trajetoria)}
        />
      )}
    </div>
  );
}
