import React, { useState, useRef, useEffect } from 'react';
import { SEG_PADRAO_DESENHO, JANELA_PARAGEM, FERRAMENTAS_DE_ARRASTAR, formaAcidental, temParagem, segDe, formasParaPausas, shapeVisivelEm } from './media/pausas';
export { SEG_PADRAO_DESENHO, formaAcidental, temParagem, segDe, formasParaPausas, shapeVisivelEm };
import { planoDoCorte } from './media/planoDesenhos';
import { podeDescarregarComDesenhos, pedirMp4ComDesenhos } from './media/descargaDesenhos';
import { corrigirDuracaoMp4 } from './media/duracaoMp4';
import { escolherPartilha } from './base/escolherPartilha';
import { createPortal } from 'react-dom';
import { supabase } from './supabaseClient';
import { offerUndo, UNDO_SECONDS } from './base/ui';
import { comMp4Proprio } from './media/organizacao';
import { YoutubeComoVideo } from './media/youtubeComoVideo';
import { linkDoVideoJunto } from './media/social';
import { dataApagar, diasParaApagar, DIAS_AVISO, DIAS_PROLONGAR, espacoJogosUsado, formatarGB, dataCurtaPt } from './media/retencao';
import {
  Play, Pause, Scissors, Circle, ArrowUpRight, Minus, Eraser, Trash2,
  Copy, Check, Video, Upload, Tag, X, Flag, RotateCcw, Loader2, Film,
  Maximize2, Minimize2, Square, Type, Pencil, Lasso, Waypoints, Undo2, Redo2, ArrowLeft, Eye, User, Share2,
  Target, Crosshair, SkipBack, SkipForward, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download, LayoutGrid, Ruler, Link2, Plus, MoreHorizontal, Tv,
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
/* Cartões de jogo (ficheiro e link) com a MESMA altura fixa, e a grelha
   sempre com o espaço de uma fila: mudar Ficheiros ↔ Links não mexe. */
const ALTURA_CARTAO_JOGO = 190; // miniatura 97 (com os ícones por cima) + nome em 2 linhas + 2 linhas de informação
const ALTURA_MINIATURA_JOGO = 97;
// Margem direita do texto que fica para a coluna de ações (22 px + folgas).
const LARGURA_ICONES_JOGO = 34;
const LARGURA_ICONES_1 = 32;
const LARGURA_ICONES_2 = 47;
// Corpo dos cartões de cortes e clipes: duas linhas de texto e a grelha
// 2×2 de ações (2 × 20 + 1) cabem sem o cartão mudar de altura.
const ALTURA_CORPO_CORTE = 54; // altura fixa: o cartão alarga para encher a linha sem mudar de altura
// Uma só fila de cartões (o resto em "Ver mais"), a toda a largura.
const ALTURA_GRELHA_JOGOS = ALTURA_CARTAO_JOGO;

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
/* Ícone do TUBO — um feixe vertical sobre um jogador (como o "holofote"
   das transmissões). Desenhado aqui por não haver um igual nos ícones. */
function IconeTubo({ size = 16, color = 'currentColor', strokeWidth = 2, ...resto }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...resto}>
      <path d="M8 3 L8 18" /><path d="M16 3 L16 18" /><ellipse cx="12" cy="18.5" rx="4" ry="1.8" /><path d="M8 3 L16 3" strokeOpacity="0.5" />
    </svg>
  );
}

export const FERRAMENTAS = [
  ['seta', ArrowUpRight, 'Seta'],
  ['linha', Minus, 'Linha'],
  ['circulo', Circle, 'Círculo'],
  ['retangulo', Square, 'Zona'],
  ['cone', Eye, 'Visão'],
  ['tubo', IconeTubo, 'Tubo'],
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
/* SEGUIR JOGADOR — rede de segurança do lado da app. Quando o jogador sai
   do ecrã e volta, o serviço às vezes "agarra" outro (até de outra
   equipa) e o tubo salta para ele. Um salto destes é impossível a correr:
   a partir do primeiro, o seguimento pára (melhor não mostrar nada do
   que mostrar o jogador errado) e corrige-se tocando no jogador certo
   nesse momento, com a ferramenta Seguir. Também deixa de se ver o tubo
   antes do início e depois do fim do seguimento, e nos buracos em que o
   jogador não foi visto. */
const VEL_MAX_SEGUIR = 0.6; // fração do ecrã por segundo (muito acima de um sprint, mesmo com a câmara a rodar)
export function limparTrajetoria(pontos) {
  const ps = (pontos || []).filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.t - b.t);
  const out = [];
  let cortado = false;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    // Um toque de correção ("ancora") recomeça o seguimento dali, certo.
    if (p.ancora) { out.push(p); cortado = false; continue; }
    if (cortado) continue;
    if (out.length) {
      const a = out[out.length - 1];
      const dt = Math.max(0.04, p.t - a.t);
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d > Math.max(0.06, VEL_MAX_SEGUIR * dt)) { cortado = true; continue; } // trocou de jogador
    }
    out.push(p);
  }
  return out;
}
const BURACO_SEGUIR = 0.7; // segundos sem o jogador = não se mostra o tubo nesse intervalo
function posicaoNaTrajetoria(pontos, tempo) {
  if (!pontos || pontos.length === 0) return null;
  if (tempo < pontos[0].t - 0.1 || tempo > pontos[pontos.length - 1].t + 0.3) return null;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i], b = pontos[i + 1];
    if (tempo >= a.t && tempo <= b.t) {
      if (b.t - a.t > BURACO_SEGUIR) return tempo >= b.t - 0.05 ? b : null; // no próprio instante da retoma já se vê
      const frac = b.t === a.t ? 0 : (tempo - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
  }
  return tempo < pontos[0].t ? pontos[0] : pontos[pontos.length - 1];
}

/* SEGUIMENTO QUE PAROU ANTES DO FIM: o serviço pára quando perde o
   jogador (aglomerado, tapado) em vez de adivinhar quem é. Este aviso diz
   onde parou e leva lá; o treinador avança até o jogador voltar a
   aparecer e toca nele ("Continuar seguimento"): o tubo segue daí. */
function AvisoSeguimentoParou({ pontos, fim, onIr }) {
  const ps = limparTrajetoria(pontos);
  if (!ps.length || !(fim > 0)) return null;
  const tParou = ps[ps.length - 1].t;
  if (tParou >= fim - 0.8) return null;
  return (
    <div style={{ background: TV.surfaceRaise, border: `1px solid ${TV.line}`, borderRadius: 7, padding: 9, color: TV.cream, fontSize: 12, lineHeight: 1.4, ...body }}>
      O seguimento parou em {fmt(tParou)}: o jogador ficou tapado ou saiu da imagem. Avança até ele voltar a aparecer, para o vídeo e toca em «Continuar seguimento».
      {onIr && (
        <button type="button" onClick={() => onIr(tParou)} style={{ display: 'block', marginTop: 6, background: 'transparent', border: `1px solid ${TV.line}`, borderRadius: 6, color: TV.cream, padding: '4px 9px', fontSize: 11.5, cursor: 'pointer', ...body }}>
          Ir para {fmt(tParou)}
        </button>
      )}
    </div>
  );
}

// TEMPORÁRIO — enquanto o Upstash não estiver configurado (ver
// seguir-jogador-iniciar.js / seguir-jogador-estado.js), chama-se
// diretamente o endpoint antigo (/api/seguir-jogador), que espera pela
// resposta toda de uma vez. Quando o Upstash estiver pronto, troca-se
// só o corpo desta função pela versão com fila (guardada mais abaixo,
// em comentário) — nada mais precisa de mudar.
/* ONDE COMEÇA MESMO UM CORTE no tempo do jogo. O corte não recodifica e
   começa no fotograma-chave anterior ao marcado (às vezes segundos antes):
   `origemInicioReal` (medido no servidor) é o 0 do ficheiro do corte.
   Cortes antigos sem essa medida usam o marcado (e são medidos depois). */
export function inicioRealDoCorte(c) {
  if (!c) return 0;
  if (typeof c.origemInicioReal === 'number') return c.origemInicioReal;
  return typeof c.origemInicio === 'number' ? c.origemInicio : 0;
}
function duracaoDoCorte(c) {
  if (!c) return 0;
  if (typeof c.origemFim === 'number') return Math.max(0, c.origemFim - inicioRealDoCorte(c));
  return c.duracao || 0;
}

/* As funções do servidor (/api/cortar-clipe, /api/seguir-jogador) só
   aceitam pedidos de quem tem sessão iniciada: vai o token da sessão do
   Supabase, que o servidor confirma. Sem isto, qualquer pessoa com o
   endereço podia pedir cortes de vídeos privados ou gastar o Modal. */
async function cabecalhosComSessao() {
  const h = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    const t = data && data.session && data.session.access_token;
    if (t) h.Authorization = `Bearer ${t}`;
  } catch (e) { /* sem sessão: o servidor recusa e a app mostra o erro */ }
  return h;
}

/* A equipa ativa vai no pedido: o servidor confirma que a pessoa é
   membro dela e conta o seguimento no uso dessa equipa (limites por
   plano, ver api/seguir-jogador.js). */
let EQUIPA_DO_ANALISADOR = '';
async function seguirJogadorAssincrono(pedido) {
  const resp = await fetch('/api/seguir-jogador', {
    method: 'POST',
    headers: await cabecalhosComSessao(),
    body: JSON.stringify({ ...pedido, ...(EQUIPA_DO_ANALISADOR ? { team_id: EQUIPA_DO_ANALISADOR } : {}) }),
  });
  /* Quando o servidor desiste por tempo (a Vercel corta a função ao fim
     de 5 minutos), a resposta não é JSON: antes isso dava um erro técnico
     ("Unexpected token…"). Agora diz o que aconteceu e o que fazer. */
  const texto = await resp.text();
  let json = null;
  try { json = JSON.parse(texto); } catch (e) { /* resposta que não é JSON */ }
  if (!resp.ok || !json) {
    if (resp.status === 504 || /FUNCTION_INVOCATION_TIMEOUT/.test(texto)) {
      throw new Error('demorou mais do que o servidor permite. Experimenta seguir um troço mais curto.');
    }
    throw new Error((json && json.error) || `o servidor respondeu com erro ${resp.status}.`);
  }
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
function MarcadorTrajetoria({ videoRef, pontos, cor }) {
  const [tempo, setTempo] = useState(0);
  // Só aparece quando já há imagem (antes, o tubo surgia sobre o preto
  // enquanto o vídeo ainda carregava).
  const [comImagem, setComImagem] = useState(false);
  useEffect(() => {
    let ativo = true;
    const passo = () => {
      if (!ativo) return;
      if (videoRef.current) { setTempo(videoRef.current.currentTime); setComImagem(videoRef.current.readyState >= 2); }
      requestAnimationFrame(passo);
    };
    const id = requestAnimationFrame(passo);
    return () => { ativo = false; cancelAnimationFrame(id); };
  }, [videoRef]);

  const limpos = React.useMemo(() => limparTrajetoria(pontos), [pontos]);
  const pos = posicaoNaTrajetoria(limpos, tempo);
  if (!pos || !comImagem) return null;
  const px = pos.x * 100, py = pos.y * 56.25;
  const largTopo = 3.4;  // metade da largura do tubo lá em cima do ecrã
  const largBase = 2.2;  // metade da largura mesmo por cima dos pés — mais estreito, não converge num ponto
  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* holofote — um tubo de luz, transparência igual de cima a baixo,
         a tocar no relvado mesmo por baixo dos pés do jogador (que
         ficam sempre exatamente ao centro, na horizontal) */}
      <polygon points={`${px - largTopo},0 ${px + largTopo},0 ${px + largBase},${py} ${px - largBase},${py}`} fill={cor || TV.crimsonBright} opacity={0.22} />
    </g>
  );
}

// Cursor da borracha — uma borracha a sério, em vez do símbolo de
// "proibido" que o browser mostra por omissão.
const CURSOR_BORRACHA = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><g transform='rotate(-35 13 13)'><rect x='5' y='8' width='16' height='10' rx='2.2' fill='white' stroke='%23222222' stroke-width='1.4'/><rect x='5' y='8' width='16' height='4.4' rx='2.2' fill='%23e84c62'/></g></svg>\") 6 20, auto";
const display = { fontFamily: "'Oswald', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

// "Jogo X - 1A Parte", "_parte_2", "Part 1", "(2.ª parte)"… no fim do título.
const RE_PARTE_CORTE = /\s*[-_–(]*\s*(?:(?:parte|part|pt)[\s_.-]*(\d+)|(\d+)\s*(?:\.?\s*[ªa°º])?\s*parte)\s*\)?\s*$/i;
const TAGS = [
  { id: 'org_of', label: 'Organização Ofensiva', color: '#2BA59A' },
  { id: 'org_def', label: 'Organização Defensiva', color: '#7C8DB0' },
  { id: 'trans_of', label: 'Transição Ofensiva', color: '#E07A2E' },
  { id: 'trans_def', label: 'Transição Defensiva', color: TV.crimsonBright },
  { id: 'golo', label: 'Golo', color: TV.good },
  { id: 'remate', label: 'Remate', color: TV.gold },
  { id: 'bp', label: 'Esquemas Táticos', color: TV.teamB },
  { id: 'perda', label: 'Perda', color: TV.bad },
  { id: 'recuperacao', label: 'Recuperação', color: TV.teamD },
  { id: 'individual', label: 'Ação Individual', color: TV.teamC },
  { id: 'posicionamento', label: 'Posicionamento', color: '#5FA8D3' },
  { id: 'cobertura', label: 'Cobertura', color: '#9BB85A' },
  { id: 'duelo', label: 'Duelo', color: '#D97BA8' },
  // Antiga: "Erro" passou a "Posicionamento" (os clipes antigos mantêm-na).
  { id: 'erro', label: 'Erro', color: TV.bad, antiga: true },
  // Antiga: os clipes já marcados com "Transição" continuam a mostrá-la,
  // mas já não se escolhe (passou a Transição Ofensiva / Defensiva).
  { id: 'transicao', label: 'Transição', color: TV.crimsonBright, antiga: true },
];
// As que se podem escolher (sem as antigas).
const TAGS_ATIVAS = TAGS.filter(t => !t.antiga);
export { TAGS as TAGS_ANALISE };
/* CODIFICAR — como a "janela de código" das ferramentas profissionais:
   botões de lance agrupados (momentos do jogo e ações). Um toque cria o
   clipe com X s antes e Y s depois do instante (ajustável por etiqueta). */
const GRUPOS_CODIFICAR = [
  { titulo: 'Momentos do jogo', ids: ['org_of', 'org_def', 'trans_of', 'trans_def', 'bp'] },
  { titulo: 'Ações', ids: ['golo', 'remate', 'perda', 'recuperacao', 'individual', 'posicionamento', 'cobertura', 'duelo'] },
];
const TEMPOS_CODIFICAR_PADRAO = { antes: 10, depois: 5 };
const CHAVE_TEMPOS_CODIFICAR = 'mjp-codificar-tempos';
function lerTemposCodificar() {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_TEMPOS_CODIFICAR) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
}

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

/* TEMPO ESCRITO À MÃO (Início/Fim dos clipes). Aceita "6:21", "06:21",
   "1:02:03" e também "6.21", "6,21" ou "6 21" (o teclado numérico do
   telemóvel não tem ":"). Um número sozinho conta como minutos ("6" →
   06:00). Devolve segundos, ou null se não for um tempo válido. */
function lerTempoEscrito(texto) {
  const s = String(texto == null ? '' : texto).trim().replace(/[.,\s]+/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
  if (!s || !/^\d+(:\d{1,2}){0,2}$/.test(s)) return null;
  const p = s.split(':').map(Number);
  if (p.length === 1) return p[0] * 60;
  if (p.slice(1).some(n => n > 59)) return null;
  return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
}

/* Caixinha de tempo editável (mm:ss). Só aplica ao sair da caixa ou com
   Enter; Esc desfaz. Um valor inválido fica a vermelho e não muda nada. */
function CampoTempo({ valor, onEscolher, max, rotulo, cor }) {
  const textoDe = (v) => (v == null ? '' : fmt(v));
  const [texto, setTexto] = useState(textoDe(valor));
  const [erro, setErro] = useState(false);
  const focadoRef = useRef(false);
  useEffect(() => {
    if (!focadoRef.current) { setTexto(textoDe(valor)); setErro(false); }
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const aplicar = () => {
    if (!texto.trim()) { setTexto(textoDe(valor)); setErro(false); return; }
    const t = lerTempoEscrito(texto);
    if (t == null || (Number.isFinite(max) && max > 0 && t > max)) { setErro(true); return; }
    setErro(false);
    setTexto(fmt(t));
    onEscolher(t);
  };
  return (
    <input
      value={texto}
      inputMode="decimal"
      placeholder="mm:ss"
      aria-label={rotulo}
      title={`${rotulo} — escreve o tempo (ex.: 6:21)`}
      onFocus={e => { focadoRef.current = true; e.currentTarget.select(); }}
      onChange={e => { setTexto(e.target.value); setErro(false); }}
      onBlur={() => { focadoRef.current = false; aplicar(); }}
      onKeyDown={e => {
        // As teclas ficam na caixa: não disparam atalhos do leitor nem o Esc que fecha.
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); setTexto(textoDe(valor)); setErro(false); focadoRef.current = false; e.currentTarget.blur(); }
      }}
      style={{
        width: 66, flexShrink: 0, boxSizing: 'border-box', textAlign: 'center',
        background: TV.surface, color: erro ? TV.bad : TV.cream,
        border: `1px solid ${erro ? TV.bad : (cor || TV.line)}`, borderRadius: 7,
        padding: '6px 4px', fontSize: 12.5, ...mono,
      }}
    />
  );
}

/* BARRA DE TEMPO — desenhada à mão (em vez do <input range>), para a
   bolinha chegar MESMO ao fim quando o clipe acaba (no range nativo
   ficava sempre um bocadinho antes). A mesma da Sala de Vídeo (App.jsx ›
   BarraTempoSala). Arrastar com o rato ou com o dedo. */
function BarraTempo({ min, max, value, onChange, disabled, rotulo, cor }) {
  const ref = useRef(null);
  const span = Math.max(0.001, max - min);
  const pct = Math.min(1, Math.max(0, (value - min) / span));
  const KNOB = 14;
  const dourado = cor || T.gold;
  const valorEm = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left - KNOB / 2) / Math.max(1, r.width - KNOB)));
    return min + f * span;
  };
  const aoPremir = (e) => {
    if (disabled) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    onChange(valorEm(e.clientX));
  };
  const aoMover = (e) => {
    if (disabled) return;
    if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) onChange(valorEm(e.clientX));
  };
  return (
    <div ref={ref} role="slider" aria-label={rotulo} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      onPointerDown={aoPremir} onPointerMove={aoMover}
      style={{ position: 'relative', flex: 1, minWidth: 0, height: 22, cursor: disabled ? 'default' : 'pointer', touchAction: 'none', opacity: disabled ? 0.5 : 1 }}>
      <div style={{ position: 'absolute', left: KNOB / 2, right: KNOB / 2, top: '50%', height: 4, marginTop: -2, borderRadius: 2, background: '#ffffff40' }} />
      <div style={{ position: 'absolute', left: KNOB / 2, top: '50%', height: 4, marginTop: -2, borderRadius: 2, background: dourado, width: `calc((100% - ${KNOB}px) * ${pct})` }} />
      <div style={{ position: 'absolute', top: '50%', width: KNOB, height: KNOB, marginTop: -KNOB / 2, borderRadius: '50%', background: dourado, left: `calc((100% - ${KNOB}px) * ${pct})` }} />
    </div>
  );
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
  if (sh.tool === 'tubo' && b) {
    const meia = Math.max(1.6, Math.min(15, Math.hypot(b.x - a.x, b.y - a.y)));
    const fundo = a.y + meia * 0.32;
    if (p.x >= a.x - meia && p.x <= a.x + meia && p.y <= fundo) return 0; // dentro do tubo
    const dx = p.x < a.x - meia ? a.x - meia - p.x : (p.x > a.x + meia ? p.x - (a.x + meia) : 0);
    const dy = p.y > fundo ? p.y - fundo : 0;
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
  if (sh.tool === 'tubo') {
    /* TUBO — feixe de luz do chão até ao céu sobre um jogador. O 1.º ponto
       é onde se toca (os pés); arrastar para o lado dá a largura. Sobe
       sempre até ao cimo da imagem. Translúcido, para o jogador continuar
       a ver-se lá dentro, e um pouco mais forte em baixo, junto aos pés. */
    const meia = Math.max(1.6, Math.min(15, Math.hypot(b.x - a.x, b.y - a.y)));
    const c = sh.color || COR_DESENHO;
    const ry = meia * 0.32;
    const gid = `tubo-${i}-${Math.round(a.x * 10)}-${Math.round(a.y * 10)}`;
    return (
      <g key={i}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={0.26} />
            <stop offset="75%" stopColor={c} stopOpacity={0.3} />
            <stop offset="100%" stopColor={c} stopOpacity={0.42} />
          </linearGradient>
        </defs>
        <rect x={a.x - meia} y={0} width={meia * 2} height={Math.max(0, a.y)} fill={`url(#${gid})`} />
        <line x1={a.x - meia} y1={0} x2={a.x - meia} y2={a.y} stroke={c} strokeOpacity={0.55} strokeWidth={CONTORNO_FINO} />
        <line x1={a.x + meia} y1={0} x2={a.x + meia} y2={a.y} stroke={c} strokeOpacity={0.55} strokeWidth={CONTORNO_FINO} />
        <ellipse cx={a.x} cy={a.y} rx={meia} ry={ry} fill={c} fillOpacity={0.35} stroke={c} strokeOpacity={0.8} strokeWidth={CONTORNO_FINO} />
      </g>
    );
  }
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
/* ONDE ESTÁ A IMAGEM DO VÍDEO. O leitor ocupa a caixa toda, mas a imagem
   (16:9, 4:3…) fica centrada com barras pretas dos lados (ou em cima e em
   baixo). Os desenhos têm de ficar presos à IMAGEM, não à caixa: senão um
   círculo posto num jogador aparece noutro sítio quando a caixa tem outra
   forma (outro ecrã, ecrã inteiro, o leitor do clipe). Devolve o retângulo
   da imagem dentro do elemento <video>, em px, relativo ao mesmo "pai". */
export function useRetanguloVideo(videoRef) {
  const [ret, setRet] = useState(null);
  const elRef = useRef(null);
  useEffect(() => {
    let ro = null;
    const medir = () => {
      const v = videoRef.current;
      if (!v) return;
      const W = v.clientWidth, H = v.clientHeight, vw = v.videoWidth, vh = v.videoHeight;
      if (!W || !H || !vw || !vh) return;
      const ar = vw / vh;
      let w = W, h = W / ar;
      if (h > H) { h = H; w = H * ar; }
      const n = { left: v.offsetLeft + (W - w) / 2, top: v.offsetTop + (H - h) / 2, width: w, height: h };
      setRet(r => (r && Math.abs(r.left - n.left) < 0.5 && Math.abs(r.top - n.top) < 0.5 && Math.abs(r.width - n.width) < 0.5 && Math.abs(r.height - n.height) < 0.5 ? r : n));
    };
    const ligar = () => {
      const v = videoRef.current;
      if (v === elRef.current) { medir(); return; }
      if (elRef.current) { elRef.current.removeEventListener('loadedmetadata', medir); elRef.current.removeEventListener('resize', medir); }
      if (ro) { ro.disconnect(); ro = null; }
      elRef.current = v;
      if (v) {
        v.addEventListener('loadedmetadata', medir);
        v.addEventListener('resize', medir);
        if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(medir); ro.observe(v); }
      }
      medir();
    };
    ligar();
    // O <video> pode mudar (outro vídeo) e a janela pode mudar de tamanho.
    const tm = setInterval(ligar, 700);
    window.addEventListener('resize', medir);
    return () => {
      clearInterval(tm); window.removeEventListener('resize', medir);
      if (ro) ro.disconnect();
      if (elRef.current) { elRef.current.removeEventListener('loadedmetadata', medir); elRef.current.removeEventListener('resize', medir); }
      elRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ret;
}
// Estilo da camada de desenho: exatamente por cima da imagem do vídeo.
export const estiloSobreImagem = (ret) => (ret
  ? { position: 'absolute', left: ret.left, top: ret.top, width: ret.width, height: ret.height }
  : { position: 'absolute', inset: 0, width: '100%', height: '100%' });

export function useZoomCirculo(formasVisiveis, ativo = true, ret = null) {
  const origem = useRef('50% 50%');
  const c = ativo ? (formasVisiveis || []).find(f => f && f.tool === 'circulo' && Number(f.zoom) > 1 && f.points && f.points[0]) : null;
  if (c) {
    const p = c.points[0];
    const fx = Math.max(0, Math.min(100, p.x)) / 100, fy = Math.max(0, Math.min(56.25, p.y)) / 56.25;
    origem.current = ret
      ? `${ret.left + fx * ret.width}px ${ret.top + fy * ret.height}px`
      : `${fx * 100}% ${fy * 100}%`;
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

// shapeVisivelEm vive em media/pausas.js (o MP4 com desenhos do servidor usa-a).


/* PARAGENS DOS DESENHOS (como na Sala de Vídeo). Um desenho com `seg`
   faz o vídeo PARAR no instante em que foi desenhado: os itens desse
   instante aparecem com a imagem parada, cada um fica os seus segundos
   no ecrã, e o vídeo continua sozinho quando sai o último.
   (Revisto) Todos os itens param o vídeo, também os dos clipes antigos
   (feitos antes das paragens): esses usam o tempo que tinham no ecrã
   ("visível até ao minuto"), ou 5 s se eram "sempre visíveis". Exceções:
   as guias do campo e os itens marcados "Sem parar", que acompanham o
   vídeo a andar. */
const SAIDA_ZOOM = 0.9; // o zoom começa a sair antes de o círculo desaparecer
// (19/11) As regras das paragens passaram para media/pausas.js, para o
// Portal as usar sem carregar este ficheiro inteiro.
export function formaVisivel(sh, tempo, parado, congelado) {
  if (!temParagem(sh)) return shapeVisivelEm(sh, tempo);
  const a = sh.criadoEmTempo ?? 0;
  if (congelado) return Math.abs(a - congelado.A) < JANELA_PARAGEM && segDe(sh) > congelado.dec;
  return !!parado && Math.abs(tempo - a) < JANELA_PARAGEM;
}
// Para o zoom: o círculo deixa de "puxar" a imagem um pouco antes de sair,
// para o vídeo só voltar a andar com a imagem já no tamanho normal.
export function formasParaZoom(lista, congelado) {
  if (!congelado) return lista;
  return lista.filter(sh => sh.tool !== 'circulo' || !temParagem(sh) || segDe(sh) - congelado.dec > SAIDA_ZOOM);
}
/* `semParagemNoPlayRef`: a desenhar, dar play parado em cima de uma
   paragem segue em frente (como na Sala de Vídeo); fora do desenho, dar
   play em cima de uma paragem mostra-a. Puxar a barra para trás faz as
   paragens que ficam à frente voltarem TODAS a parar. */
/* LINKS DO YOUTUBE (17/11): em vez de parar, CÂMARA LENTA (como na Sala
   de Vídeo). Um YouTube parado mostra o botão de pausa e o título por cima
   da imagem; a 0,25× continua "a tocar" e os desenhos leem-se na mesma.
   No fim da paragem volta à velocidade que tinha. `congelado.lento` diz
   aos ecrãs que é câmara lenta e não vídeo parado. */
export const VELOCIDADE_LENTA_LINK = 0.25; // o mínimo que o YouTube aceita
export function usePausasDesenho(videoRef, formas, ativo = true, semParagemNoPlayRef = null) {
  const [congelado, setCongelado] = useState(null); // { A, dec, total, lento } enquanto o vídeo está parado (ou lento) num desenho
  const formasRef = useRef(formas);
  formasRef.current = formas;
  const ativoRef = useRef(ativo);
  ativoRef.current = ativo;
  const st = useRef({ prev: null, congel: null, proprio: false, el: null, ultimaA: null });
  // Câmara lenta a acabar (ou cortada): a velocidade de antes.
  const repor = (s) => {
    if (s.congel && s.congel.lento && s.el) { try { s.el.playbackRate = s.congel.taxa || 1; } catch (e) { /* nada */ } }
  };
  // Larga a paragem em curso e deixa o vídeo parado onde está (para editar).
  const cancelar = React.useCallback(() => {
    const s = st.current;
    if (s.congel) {
      const lento = s.congel.lento;
      repor(s); s.ultimaA = s.congel.A; s.congel = null; setCongelado(null);
      if (lento && s.el && !s.el.paused) s.el.pause();
    }
  }, []);
  useEffect(() => { if (!ativo) cancelar(); }, [ativo, cancelar]);
  useEffect(() => {
    let raf = 0;
    let ultimoDec = -1;
    const aoTocar = () => {
      const s = st.current; const v = s.el;
      if (!v) return;
      const t = v.currentTime;
      if (s.proprio) { s.proprio = false; s.prev = t; return; }
      if (s.congel) { repor(s); s.ultimaA = s.congel.A; s.congel = null; setCongelado(null); s.prev = t; return; } // play a meio de uma paragem = seguir já
      const naUltima = s.ultimaA != null && Math.abs(t - s.ultimaA) < JANELA_PARAGEM;
      const saltar = naUltima || !!(semParagemNoPlayRef && semParagemNoPlayRef.current);
      s.prev = saltar ? t + 0.001 : t - 0.05; // fora do desenho, play em cima de um desenho mostra a paragem
    };
    const aoProcurar = () => {
      const s = st.current;
      if (s.congel) { repor(s); s.congel = null; setCongelado(null); }
      s.ultimaA = null;
      s.prev = null;
    };
    const ligar = (v) => {
      const s = st.current;
      if (s.el === v) return;
      if (s.el) { s.el.removeEventListener('play', aoTocar); s.el.removeEventListener('seeking', aoProcurar); }
      if (s.congel) { repor(s); s.congel = null; setCongelado(null); }
      s.el = v; s.prev = null; s.ultimaA = null;
      if (v) { v.addEventListener('play', aoTocar); v.addEventListener('seeking', aoProcurar); }
    };
    const passo = () => {
      raf = requestAnimationFrame(passo);
      const v = videoRef.current;
      ligar(v || null);
      if (!v) return;
      const s = st.current;
      if (s.congel && s.congel.lento) {
        // Câmara lenta: pausa a meio (o utilizador) = acabou a paragem.
        const dec = (performance.now() - s.congel.t0) / 1000;
        if (v.paused || dec >= s.congel.total) {
          repor(s);
          s.ultimaA = s.congel.A; s.congel = null; setCongelado(null); ultimoDec = -1;
          s.prev = v.currentTime;
          return;
        }
        const d = Math.floor(dec * 10) / 10;
        if (d !== ultimoDec) { ultimoDec = d; setCongelado(c => (c ? { ...c, dec } : c)); }
        return;
      }
      if (s.congel) {
        const dec = (performance.now() - s.congel.t0) / 1000;
        if (dec >= s.congel.total) {
          s.ultimaA = s.congel.A;
          s.congel = null; setCongelado(null); ultimoDec = -1;
          s.proprio = true;
          const p = v.play(); if (p && p.catch) p.catch(() => { s.proprio = false; });
          return;
        }
        const d = Math.floor(dec * 10) / 10;
        if (d !== ultimoDec) { ultimoDec = d; setCongelado(c => (c ? { ...c, dec } : c)); }
        return;
      }
      if (!ativoRef.current || v.paused || v.seeking) return;
      const t = v.currentTime;
      let prev = s.prev;
      if (prev != null && t < prev) { prev = Math.max(-0.01, t - 0.05); s.ultimaA = null; } // voltou ao início (ex.: repetição do clipe)
      // 1.ª imagem a tocar: um desenho logo no início do clipe (tempo 0)
      // também pára (antes perdia-se, se o vídeo arrancasse sozinho).
      if (prev == null && t < 1) { s.prev = -0.05; return; }
      if (prev == null || t - prev > 1.5) { s.prev = t; return; } // salto grande = não passou "a ver"
      /* Itens do MESMO momento (a menos de 0,3 s uns dos outros) fazem UMA
         paragem, com o tempo do mais longo: 3 s + 3 s = 3 s. Antes, se a
         imagem em que se parou caía entre os dois, o segundo voltava a
         parar a seguir (3 s + 3 s = 6 s). Os da paragem que acabou de
         passar já não contam. */
      const lista = (formasRef.current || []).filter(temParagem)
        .filter(sh => s.ultimaA == null || Math.abs((sh.criadoEmTempo ?? 0) - s.ultimaA) >= JANELA_PARAGEM);
      let A = null;
      lista.forEach(sh => { const a = sh.criadoEmTempo ?? 0; if (a > prev && a <= t + 0.001 && (A == null || a < A)) A = a; });
      s.prev = t;
      if (A == null) return;
      const grupo = (formasRef.current || []).filter(temParagem).filter(sh => Math.abs((sh.criadoEmTempo ?? 0) - A) < JANELA_PARAGEM);
      const total = Math.max(...grupo.map(segDe));
      if (v.ehYoutube) {
        const taxa = v.playbackRate || 1;
        v.playbackRate = VELOCIDADE_LENTA_LINK;
        s.congel = { A, t0: performance.now(), total, lento: true, taxa };
        ultimoDec = 0;
        setCongelado({ A, dec: 0, total, lento: true });
        return;
      }
      v.pause();
      s.congel = { A, t0: performance.now(), total };
      ultimoDec = 0;
      setCongelado({ A, dec: 0, total });
    };
    raf = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(raf); ligar(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [congelado, cancelar];
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
/* UMA LINHA POR JOGO QUE DESLIZA, sem barra de deslizar à vista e sem
   cartões cortados. Com `larguraBase`, os cartões ESTICAM para encher a
   largura toda (quantos cabem com essa largura mínima), menos a coluna das
   setas à direita: a fila acaba na mesma margem que o resto da página. Os
   filhos usam `width: var(--mjp-cartao-fila)`. Anda uma "página" de cada
   vez e pára sempre no início de um cartão. */
function FilaDeslizante({ children, gap = 10, larguraBase = 160 }) {
  const caixaRef = useRef(null);
  const ref = useRef(null);
  const [pontas, setPontas] = useState({ esq: false, dir: false });
  const [cartao, setCartao] = useState(larguraBase);
  const SETAS = 44;
  const medir = () => {
    const el = ref.current; const caixa = caixaRef.current;
    if (!el || !caixa) return;
    const total = caixa.clientWidth;
    if (total > 0) {
      const util = total - SETAS;
      const cabem = Math.max(1, Math.floor((util + gap) / (larguraBase + gap)));
      const w = Math.floor(((util - gap * (cabem - 1)) / cabem) * 10) / 10;
      setCartao(prev => (Math.abs(prev - w) < 0.5 ? prev : w));
    }
    const esq = el.scrollLeft > 4;
    const dir = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setPontas(p => (p.esq === esq && p.dir === dir ? p : { esq, dir }));
  };
  useEffect(() => {
    medir();
    const caixa = caixaRef.current;
    if (!caixa || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => medir());
    ro.observe(caixa);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Mais ou menos cartões: volta a medir.
  useEffect(() => { medir(); });
  const andar = (dir) => { const el = ref.current; if (el) el.scrollBy({ left: dir * (el.clientWidth + gap), behavior: 'smooth' }); };
  const haSetas = pontas.esq || pontas.dir;
  const seta = (dir, Icone, ativa) => (
    <button type="button" aria-label={dir < 0 ? 'Anteriores' : 'Seguintes'} onClick={() => andar(dir)} disabled={!ativa}
      style={{
        width: 32, height: 32, borderRadius: '50%', border: `1px solid ${T.line}`, background: 'rgba(0,0,0,.65)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: ativa ? 'pointer' : 'default', opacity: ativa ? 1 : 0.25,
      }}><Icone size={16} /></button>
  );
  return (
    <div ref={caixaRef} style={{ display: 'flex', alignItems: 'center', gap: 0, '--mjp-cartao-fila': `${cartao}px` }}>
      <style>{'.mjp-fila::-webkit-scrollbar{display:none}.mjp-fila>*{scroll-snap-align:start}'}</style>
      <div ref={ref} className="mjp-fila" onScroll={medir}
        style={{ display: 'flex', gap, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', minWidth: 0, flex: 1 }}>
        {children}
      </div>
      {/* A coluna das setas existe sempre (a fila acaba sempre no mesmo sítio). */}
      <div style={{ width: SETAS, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, visibility: haSetas ? 'visible' : 'hidden' }}>
        {seta(1, ChevronRight, pontas.dir)}
        {seta(-1, ChevronLeft, pontas.esq)}
      </div>
    </div>
  );
}

function useFecharComEsc(onClose, ativo = true) {
  useEffect(() => {
    if (!ativo) return undefined;
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose, ativo]);
}

/* EQUIPAS DE UM JOGO, PELO TÍTULO DO VÍDEO.
   "USC Paredes vs AFS - 8a Jornada" → ["USC Paredes", "AFS"]. Só uma
   sugestão: o treinador confirma ou corrige (ver EquipasDoJogoModal). */
export function equipasDoTitulo(titulo) {
  const t = String(titulo || '').replace(/[_]+/g, ' ').trim();
  const m = t.split(/\s+(?:vs\.?|v\.?|x|contra)\s+/i);
  if (m.length !== 2) return [];
  const limpar = (x) => x.replace(/\s+[-–|·]\s+.*$/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
  const a = limpar(m[0]); const b = limpar(m[1]);
  return a && b ? [a, b] : [];
}
const semAcentosEq = (s0) => String(s0 || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(sc|fc|cf|sl|ad|ud|gd|cd|clube|sport|futebol)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
// A nossa equipa? Compara sem acentos e sem siglas (SC, FC…): "Salgueiros" = "SC Salgueiros".
export function ehNossaEquipa(nome, nossa) {
  const a = semAcentosEq(nome); const b = semAcentosEq(nossa);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
}

/* As duas equipas de um vídeo, para os cortes irem para a ficha certa. */
function EquipasDoJogoModal({ titulo, equipas, onGuardar, onClose }) {
  const sugestao = (equipas && equipas.length ? equipas : equipasDoTitulo(titulo));
  const [a, setA] = useState(sugestao[0] || '');
  const [b, setB] = useState(sugestao[1] || '');
  useFecharComEsc(onClose);
  const campo = { width: '100%', boxSizing: 'border-box', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', color: T.cream, fontSize: 13, ...body };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, ...body }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.cream }}>Equipas do jogo</div>
          <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ fontSize: 12, color: T.mutedDim, lineHeight: 1.5 }}>{titulo}. Os cortes de cada equipa vão para a ficha dela em Scouting › Adversários.</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
          Equipa A
          <input value={a} onChange={e => setA(e.target.value)} maxLength={60} style={campo} placeholder="Ex.: USC Paredes" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
          Equipa B
          <input value={b} onChange={e => setB(e.target.value)} maxLength={60} style={campo} placeholder="Ex.: AFS" />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="solid" disabled={!a.trim() && !b.trim()} onClick={() => onGuardar([a.trim(), b.trim()].filter(Boolean))}><Check size={14} /> Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

/* ENVIAR UM CLIPE PARA A SALA DE VÍDEO (Canal da Biblioteca).
   Dois destinos: um ADVERSÁRIO (por omissão) ou um JOGO nosso. Temas
   ficou de fora: um corte de jogo não faz sentido numa pasta de temas.
   Um ADVERSÁRIO (vai para a ficha da equipa, e vê-se também no Canal ›
   Adversários). O clipe não volta a ser carregado: o Canal passa a
   apontar para o mesmo MP4. */
/* PARA ONDE VAI UM JOGO INTEIRO (da Análise para a Sala de Vídeo): igual
   ao "Adicionar vídeo" da Sala — "Jogo nosso" (Canal › Jogos, com o jogo
   do calendário) ou "Jogo de adversário" (Canal › Adversários, com as duas
   equipas). Os jogos inteiros nunca vão para a ficha de Scouting: para lá
   só vão os cortes. Tudo com altura fixa: nada mexe ao trocar. */
function useDestinoJogo(inicial) {
  const [destino, setDestino] = useState(inicial || 'jogo');
  const [jogoId, setJogoId] = useState('');
  const [eqs, setEqs] = useState(['', '']);
  return { destino, setDestino, jogoId, setJogoId, eqs, setEqs };
}
function validarDestinoJogo(dj, jogos) {
  if (dj.destino === 'jogo') {
    if (!dj.jogoId) return { erro: 'Escolhe o jogo do calendário.' };
    return { dados: { destino: 'jogo', jogoId: dj.jogoId, rotulo: `Jogos › ${((jogos || []).find(j => j.id === dj.jogoId) || {}).rotulo || ''}` } };
  }
  if (dj.destino === 'jogoAdversario') {
    const eqs = dj.eqs.map(x => x.trim()).filter(Boolean);
    if (!eqs.length) return { erro: 'Escolhe as equipas do jogo.' };
    return { dados: { destino: 'jogoAdversario', equipasJogo: eqs, rotulo: `Adversários › ${eqs.join(' vs ')}` } };
  }
  return { dados: { destino: null } };
}
function CamposDestinoJogo({ dj, jogos, equipas, comAnalise }) {
  const campo = { width: '100%', boxSizing: 'border-box', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', color: T.cream, fontSize: 13, height: 36, ...body };
  const rotuloCampo = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim };
  const nomes = equipas || [];
  const opcao = (id, label) => (
    <button type="button" onClick={() => dj.setDestino(id)} style={{
      flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, ...body,
      background: dj.destino === id ? T.crimson || '#B5393F' : 'transparent', color: dj.destino === id ? '#fff' : T.muted,
      border: `1px solid ${dj.destino === id ? (T.crimson || '#B5393F') : T.line}`,
    }}>{label}</button>
  );
  const equipaCampo = (i) => (nomes.length ? (
    <select value={dj.eqs[i]} onChange={e => dj.setEqs(prev => prev.map((x, k) => (k === i ? e.target.value : x)))} style={campo}>
      <option value="">{`Equipa ${i + 1}…`}</option>
      {nomes.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  ) : (
    <input value={dj.eqs[i]} onChange={e => dj.setEqs(prev => prev.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`Equipa ${i + 1}`} maxLength={80} style={campo} />
  ));
  return (
    <>
      <div style={rotuloCampo}>
        Para onde vai
        <div style={{ display: 'flex', gap: 6 }}>
          {comAnalise && opcao('analise', 'Só na Análise')}
          {opcao('jogo', 'Jogo nosso')}
          {opcao('jogoAdversario', 'Jogo de adversário')}
        </div>
      </div>
      <div style={{ ...rotuloCampo, height: 58 }}>
        {dj.destino === 'jogo' ? 'Jogo do calendário (Canal › Jogos)' : dj.destino === 'jogoAdversario' ? 'As duas equipas (Canal › Adversários)' : 'Destino'}
        {dj.destino === 'jogo' ? (
          <select value={dj.jogoId} onChange={e => dj.setJogoId(e.target.value)} style={campo}>
            <option value="">Escolhe o jogo…</option>
            {(jogos || []).map(j => <option key={j.id} value={j.id}>{j.rotulo}</option>)}
          </select>
        ) : dj.destino === 'jogoAdversario' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{equipaCampo(0)}{equipaCampo(1)}</div>
        ) : (
          <div style={{ ...campo, color: T.mutedDim, display: 'flex', alignItems: 'center' }}>Fica só aqui na Análise, para trabalhar</div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: T.mutedDim, lineHeight: 1.5, height: 36, overflow: 'hidden' }}>
        {dj.destino === 'jogo' ? 'Vai para a Sala de Vídeo, no cartão do jogo, e aparece no Portal dos jogadores.'
          : dj.destino === 'jogoAdversario' ? 'Vai para a Sala de Vídeo › Adversários, no cartão de cada equipa (não vai para o Scouting).'
            : 'Mais tarde podes enviá-lo (ou os clipes) para a Sala de Vídeo.'}
      </div>
    </>
  );
}

/* COLAR LINK (modo Links da Análise): link, nome e para onde vai. */
/* NOVO JOGO: o MESMO formulário para colar um link e para carregar um
   ficheiro (nome do jogo, para onde vai, destino). No ficheiro, a linha do
   link mostra o ficheiro escolhido (mesma altura). */
function ColarLinkModal({ destinos, equipas, onGuardar, onClose, ficheiro = null }) {
  const d = destinos || { jogos: [] };
  const [titulo, setTitulo] = useState(() => (ficheiro ? ficheiro.name.replace(/\.[^.]+$/, '') : ''));
  const [url, setUrl] = useState('');
  const dj = useDestinoJogo('analise');
  const [erro, setErro] = useState('');
  useFecharComEsc(onClose);
  const campo = { width: '100%', boxSizing: 'border-box', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', color: T.cream, fontSize: 13, ...body };
  const rotuloCampo = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim };
  const guardar = () => {
    setErro('');
    if (!ficheiro && !url.trim()) { setErro('Cola o link do vídeo.'); return; }
    if (!titulo.trim()) { setErro('Dá um nome ao jogo.'); return; }
    const v = validarDestinoJogo(dj, d.jogos);
    if (v.erro) { setErro(v.erro); return; }
    try {
      onGuardar({ titulo: titulo.trim(), url: url.trim(), ...v.dados });
      onClose();
    } catch (e) { setErro(e.message || String(e)); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, ...body }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.cream, display: 'flex', alignItems: 'center', gap: 8 }}>{ficheiro ? <><Upload size={16} /> Carregar ficheiro</> : <><Link2 size={16} /> Colar link</>}</div>
          <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
        </div>
        {ficheiro ? (
          <label style={rotuloCampo}>
            Ficheiro
            <div style={{ ...campo, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ficheiro.name}>
              {ficheiro.name} · {ficheiro.size >= 1e9 ? formatarGB(ficheiro.size) : `${Math.max(1, Math.round(ficheiro.size / 1e6))} MB`}
            </div>
          </label>
        ) : (
          <label style={rotuloCampo}>
            Link do vídeo
            <input value={url} onChange={e => setUrl(e.target.value)} autoFocus placeholder="https://youtu.be/…" style={campo} />
          </label>
        )}
        <label style={rotuloCampo}>
          Nome do jogo
          <input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus={!!ficheiro} maxLength={120} placeholder="Ex.: 9.ª jornada · AFS vs Salgueiros (1.ª parte)" style={campo} />
        </label>
        <CamposDestinoJogo dj={dj} jogos={d.jogos} equipas={equipas} comAnalise />
        <div style={{ fontSize: 12.5, color: T.bad, minHeight: 18 }}>{erro}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="solid" onClick={guardar}>{ficheiro ? <><Upload size={14} /> Carregar</> : <><Check size={14} /> Guardar</>}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ONDE ESTÁ NA SALA, COM "RETIRAR" (17/11). Uma linha por sítio para onde
   foi enviado. Retirar pede confirmação na própria linha (a janela não
   cresce nem mexe). `marcas`: [{ rotulo, ... }]. */
function NaSalaLista({ marcas, onRetirar }) {
  const [aConfirmar, setAConfirmar] = useState(-1);
  const [aTirar, setATirar] = useState(false);
  if (!marcas || !marcas.length) return null;
  const botao = (cor) => ({ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: cor, ...body });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: T.mutedDim }}>Já está na Sala</div>
      {marcas.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26, padding: '2px 8px', borderRadius: 6, background: T.surfaceRaise }}>
          <Check size={13} color={T.good} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.rotulo}>{m.rotulo || 'Sala de Vídeo'}</span>
          {onRetirar && (aConfirmar === i ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: T.muted }}>Tirar da Sala?</span>
              <button type="button" disabled={aTirar} style={botao(T.bad)} onClick={async () => {
                try { setATirar(true); await onRetirar(m); } finally { setATirar(false); setAConfirmar(-1); }
              }}>Sim</button>
              <button type="button" style={botao(T.muted)} onClick={() => setAConfirmar(-1)}>Não</button>
            </span>
          ) : (
            <button type="button" style={{ ...botao(T.muted), flexShrink: 0 }} onClick={() => setAConfirmar(i)} title="Tirar da Sala de Vídeo (o original fica na Análise)">
              <X size={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />Retirar
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ENVIAR UM JOGO INTEIRO PARA A SALA DE VÍDEO (ficheiro do Estúdio ou link). */
function EnviarJogoModal({ jogo, destinos, equipas, onEnviar, onClose, onRetirar }) {
  const d = destinos || { jogos: [] };
  const [titulo, setTitulo] = useState(jogo.titulo || '');
  const dj = useDestinoJogo('jogo');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [feito, setFeito] = useState('');
  useFecharComEsc(onClose);
  const campo = { width: '100%', boxSizing: 'border-box', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', color: T.cream, fontSize: 13, ...body };
  const enviar = async () => {
    setErro('');
    const v = validarDestinoJogo(dj, d.jogos);
    if (v.erro) { setErro(v.erro); return; }
    try {
      setAEnviar(true);
      await onEnviar({ titulo: titulo.trim() || jogo.titulo || 'Jogo', ...v.dados });
      setFeito(v.dados.rotulo);
    } catch (e) { setErro(e.message || String(e)); } finally { setAEnviar(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, ...body }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.cream, display: 'flex', alignItems: 'center', gap: 8 }}><Tv size={16} /> Enviar o jogo para a Sala de Vídeo</div>
          <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
          Título na Sala de Vídeo
          <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120} style={campo} />
        </label>
        <CamposDestinoJogo dj={dj} jogos={d.jogos} equipas={equipas} />
        <NaSalaLista marcas={jogo.enviadoSala || []} onRetirar={onRetirar} />
        <div style={{ fontSize: 12, minHeight: 18, color: erro ? T.bad : T.good }}>
          {erro || (feito ? `✓ Enviado: ${feito}` : '')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>{feito ? 'Fechar' : 'Cancelar'}</Btn>
          {!feito && <Btn variant="solid" onClick={enviar} disabled={aEnviar}>{aEnviar ? <Loader2 size={14} className="spin" /> : <Tv size={14} />} Enviar</Btn>}
        </div>
      </div>
    </div>
  );
}

function EnviarSalaModal({ clip, tag, destinos, onEnviar, onClose, destinoInicial, onRetirar }) {
  const d = destinos || { pastas: [], jogos: [], fichas: [] };
  const [titulo, setTitulo] = useState(() => (clip.note || '').trim() || [tag && tag.label, clip.originalTitulo].filter(Boolean).join(' · ') || 'Clipe');
  // Por omissão, Adversários (é para lá que vai a maior parte dos cortes).
  const [destino, setDestino] = useState(destinoInicial || 'adversario');
  const [pasta, setPasta] = useState(() => (d.pastas || [])[0] || '');
  const [pastaNova, setPastaNova] = useState('');
  const [jogoId, setJogoId] = useState('');
  const [scoutId, setScoutId] = useState('');
  // Sem fichas ainda, começa logo em "Nova equipa".
  const [fichaId, setFichaId] = useState(() => ((d.fichas || []).length ? '' : '__nova__'));
  const [nomeFichaNova, setNomeFichaNova] = useState('');
  // Equipa nova: escolhida das equipas das competições da app (sem ficha),
  // ou escrita à mão em "Outra equipa…".
  const equipasLista = d.equipasSemFicha || [];
  const [equipaNovaSel, setEquipaNovaSel] = useState(() => (equipasLista.length ? '' : '__outra__'));
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');
  useFecharComEsc(onClose);
  const campo = { width: '100%', boxSizing: 'border-box', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', color: T.cream, fontSize: 13, ...body };
  const [aEnviar, setAEnviar] = useState(false);
  const enviar = async () => {
    setErro('');
    try {
      const pastaFinal = pasta === '__nova__' ? pastaNova : pasta;
      const nomeNovo = equipaNovaSel && equipaNovaSel !== '__outra__' ? equipaNovaSel : nomeFichaNova;
      const fichaNova = destino === 'adversario' && fichaId === '__nova__' ? { nome: String(nomeNovo || '').trim() } : null;
      if (fichaNova && !fichaNova.nome) { setErro(equipaNovaSel === '__outra__' || !equipasLista.length ? 'Escreve o nome da equipa.' : 'Escolhe a equipa.'); return; }
      const rotulo = destino === 'jogo' ? `Jogos › ${(d.jogos.find(j => j.id === jogoId) || {}).rotulo || ''}`
        : destino === 'adversario' ? `Adversários › ${fichaNova ? fichaNova.nome : ((d.fichas.find(f => f.id === fichaId) || {}).rotulo || '')}`
          : destino === 'scout' ? `Scouting › ${((d.scouts || []).find(x => x.id === scoutId) || {}).rotulo || ''}`
          : `Temas › ${pastaFinal}`;
      if (destino === 'scout' && !scoutId) { setErro('Escolhe o jogador.'); return; }
      // `onEnviar` pode ser assíncrono (jogo por ficheiro: pede o link ao servidor).
      const r = onEnviar({ titulo, destino, pasta: pastaFinal, jogoId, fichaId: fichaNova ? '' : fichaId, fichaNova, rotulo, scoutId });
      if (r && typeof r.then === 'function') { setAEnviar(true); await r; }
      setFeito(destino === 'adversario' ? `${rotulo} (e ficha da equipa)` : rotulo);
    } catch (e) { setErro(e.message || String(e)); } finally { setAEnviar(false); }
  };
  const opcao = (id, label) => (
    <button type="button" onClick={() => { setDestino(id); setErro(''); }} style={{
      flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, ...body,
      background: destino === id ? T.crimson || '#B5393F' : 'transparent', color: destino === id ? '#fff' : T.muted,
      border: `1px solid ${destino === id ? (T.crimson || '#B5393F') : T.line}`,
    }}>{label}</button>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, ...body }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.cream }}>Enviar para a Sala de Vídeo</div>
          <Btn variant="plain" onClick={onClose}><X size={16} /></Btn>
        </div>
        {feito ? (
          <>
            <div style={{ fontSize: 13, color: T.cream, lineHeight: 1.5 }}>
              <Check size={14} color={T.good} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Enviado para <b>{feito}</b>.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setFeito('')}>Enviar para outro sítio</Btn>
              <Btn variant="solid" onClick={onClose}>Fechar</Btn>
            </div>
          </>
        ) : (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
              Título no Canal
              {/* Na ficha do adversário o nome é o do corte (a nota ou a etiqueta). */}
              <input value={destino === 'adversario' ? ((clip.note || '').trim() || (tag && tag.label) || 'Clipe') : titulo} disabled={destino === 'adversario'} onChange={e => setTitulo(e.target.value)} maxLength={120} style={{ ...campo, opacity: destino === 'adversario' ? 0.6 : 1 }} />
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {opcao('adversario', 'Adversários')}
              {opcao('jogo', 'Jogos')}
              {opcao('scout', 'Jogador (Scouting)')}
            </div>
            {destino === 'scout' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
                Jogador observado (vídeos da ficha)
                <select value={scoutId} onChange={e => setScoutId(e.target.value)} style={campo}>
                  <option value="">{(d.scouts || []).length ? 'Escolhe o jogador…' : 'Ainda não há jogadores em Scouting'}</option>
                  {(d.scouts || []).map(x => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                </select>
                <span style={{ fontSize: 11.5, color: T.mutedDim }}>Fica nos vídeos da ficha em Scouting. Não aparece no Canal nem no Portal.</span>
              </label>
            )}
            {destino === 'tema' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
                Pasta
                <select value={pasta} onChange={e => setPasta(e.target.value)} style={campo}>
                  {(d.pastas || []).map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__nova__">+ Pasta nova…</option>
                </select>
                {(pasta === '__nova__' || !(d.pastas || []).length) && (
                  <input value={pastaNova} onChange={e => { setPastaNova(e.target.value); if (pasta !== '__nova__') setPasta('__nova__'); }} placeholder="Nome da pasta (ex.: Bola parada)" style={campo} />
                )}
              </label>
            )}
            {destino === 'jogo' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
                Jogo
                <select value={jogoId} onChange={e => setJogoId(e.target.value)} style={campo}>
                  <option value="">Escolhe o jogo…</option>
                  {(d.jogos || []).map(j => <option key={j.id} value={j.id}>{j.rotulo}</option>)}
                </select>
              </label>
            )}
            {destino === 'adversario' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: T.mutedDim }}>
                Equipa (ficha do adversário)
                <select value={fichaId} onChange={e => setFichaId(e.target.value)} style={campo}>
                  <option value="">Escolhe a equipa…</option>
                  {(d.fichas || []).map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                  <option value="__nova__">+ Nova equipa…</option>
                </select>
                {/* FICHA NOVA, SIMPLES: só o nome. Cria a ficha do adversário e
                    o clipe vai logo para lá; o resto preenche-se depois em
                    Scouting › Adversários. */}
                {fichaId === '__nova__' && (
                  <>
                    {equipasLista.length > 0 && (
                      <select value={equipaNovaSel} onChange={e => setEquipaNovaSel(e.target.value)} style={campo}>
                        <option value="">Escolhe a equipa da competição…</option>
                        {equipasLista.map(n => <option key={n} value={n}>{n}</option>)}
                        <option value="__outra__">Outra equipa (escrever o nome)…</option>
                      </select>
                    )}
                    {(equipaNovaSel === '__outra__' || !equipasLista.length) && (
                      <input value={nomeFichaNova} onChange={e => setNomeFichaNova(e.target.value)} placeholder="Nome da equipa (ex.: FC Maia Lidador)"
                        maxLength={80} autoFocus style={campo} onKeyDown={e => { if (e.key === 'Enter') enviar(); }} />
                    )}
                    <span style={{ fontSize: 11.5, color: T.mutedDim }}>Cria a ficha do adversário com este nome e o clipe vai logo para lá. O resto da ficha preenche-se em Scouting › Adversários.</span>
                  </>
                )}
              </label>
            )}
            <NaSalaLista marcas={marcasNaSala(clip)} onRetirar={onRetirar} />
            {erro && <div style={{ fontSize: 12.5, color: T.bad }}>{erro}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
              <Btn variant="solid" onClick={enviar} disabled={aEnviar}>{aEnviar ? <Loader2 size={14} className="spin" /> : <Tv size={14} />} Enviar</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* O Estúdio está fora da vista? Só aí se rola a página até ele (abrir um
   clipe ou desenhar com o Estúdio à vista NÃO mexe a página). */
/* O EDITOR CABE NO ECRÃ (17/11). A altura do editor é o espaço que sobra
   do sítio onde ele começa até ao fundo do ecrã, com a página no topo:
   título, barra e editor inteiros à vista, sem deslocar. Quem desloca é o
   <main> (computador) ou a janela (telemóvel). Ao abrir um vídeo, a página
   volta ao topo uma vez. */
function paiQueDesloca(el) {
  let p = el && el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
}
const MARGEM_FUNDO_EDITOR = 16;
const ALTURA_MIN_EDITOR = 420;
function useAlturaAteAoFundo(ref, ativo, chave) {
  const [altura, setAltura] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!ativo || !el) { setAltura(null); return undefined; }
    const pai = paiQueDesloca(el);
    // Ao abrir: página no topo (o editor fica todo à vista).
    try { if (pai) pai.scrollTop = 0; else window.scrollTo(0, 0); } catch (e) { /* nada */ }
    const medir = () => {
      const r = el.getBoundingClientRect();
      const topoPai = pai ? pai.getBoundingClientRect().top : 0;
      const desl = pai ? pai.scrollTop : window.scrollY;
      const visivel = pai ? pai.clientHeight : window.innerHeight;
      const inicio = r.top - topoPai + desl; // onde começa o editor, com a página no topo
      setAltura(Math.max(ALTURA_MIN_EDITOR, Math.floor(visivel - inicio - MARGEM_FUNDO_EDITOR)));
    };
    medir();
    window.addEventListener('resize', medir);
    const ro = typeof ResizeObserver !== 'undefined' && pai ? new ResizeObserver(medir) : null;
    if (ro) ro.observe(pai);
    return () => { window.removeEventListener('resize', medir); if (ro) ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, chave]);
  return altura;
}

function estudioForaDaVista(el) {
  const r = el.getBoundingClientRect();
  return r.bottom < 80 || r.top > window.innerHeight - 80;
}

/* `soVer`: só tocar, com os desenhos (Portal do jogador e cartões da análise
   individual) — sem partilhar, editar, desenhar nem apagar. */
export function ClipPlayerModal({ clip, tag, onClose, onShare, onRemove, copied, onChangeTag, onSaveEdit, originais, originalSugeridoId, onChangeTrajetoria, editarAoAbrir, onEnviarSala, onDesenhar, onSeguirNoDesenho, embutido, onEcraInteiro, ecraInteiroExterno, equipasDoClipe, onChangeEquipa, nomeNossaEquipa = '', aMudarEquipa, soVer = false }) {
  // Ecrã estreito (telemóvel): o painel vai para baixo do vídeo.
  const [estreitoPlayer, setEstreitoPlayer] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const f = () => setEstreitoPlayer(window.innerWidth < 900);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
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
    const novo = inicioRealDoCorte(clip) + (videoRef.current?.currentTime || 0);
    setInicioEd(novo);
    if (fimEd <= novo) setFimEd(novo + 1);
  };
  const marcarFimEd = () => {
    const novo = inicioRealDoCorte(clip) + (videoRef.current?.currentTime || 0);
    setFimEd(novo);
    if (inicioEd >= novo) setInicioEd(Math.max(0, novo - 1));
  };
  // Tempos ESCRITOS à mão (mm:ss do vídeo original) — mesmas regras das
  // bandeiras. Se o tempo cair dentro deste clipe, o leitor salta para lá.
  const escreverInicioEd = (novo) => {
    setInicioEd(novo);
    if (fimEd <= novo) setFimEd(novo + 1);
    const rel = novo - inicioRealDoCorte(clip);
    if (rel >= 0 && (!duracaoVideo || rel <= duracaoVideo)) irPara(rel);
  };
  const escreverFimEd = (novo) => {
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
  // Clipe de um jogo por link: o YouTube faz de <video> (youtubeComoVideo).
  const ehYt = ehCorteYoutube(clip);
  useEffect(() => {
    if (!ehYt) return undefined;
    const v = videoRef.current;
    if (!v) return undefined;
    const tocar = () => setATocar(true); const parar = () => setATocar(false);
    const tempo = () => setT(v.currentTime); const dur = () => { const d = v.duration; setDuracaoVideo(Number.isFinite(d) ? d : 0); };
    v.addEventListener('play', tocar); v.addEventListener('pause', parar); v.addEventListener('timeupdate', tempo);
    v.addEventListener('loadedmetadata', dur); v.addEventListener('seeked', tempo);
    dur();
    return () => {
      v.removeEventListener('play', tocar); v.removeEventListener('pause', parar); v.removeEventListener('timeupdate', tempo);
      v.removeEventListener('loadedmetadata', dur); v.removeEventListener('seeked', tempo);
    };
  }, [ehYt, clip.id, clip.origemInicio, clip.origemFim]);
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
  const [congeladoClip] = usePausasDesenho(videoRef, clip.shapes || [], !aEditar);
  const formasClipeVisiveis = (clip.shapes || []).filter(sh => formaVisivel(sh, t, !aTocar, congeladoClip));
  const retClipe = useRetanguloVideo(videoRef);
  const estiloZoomClipe = useZoomCirculo(formasParaZoom(formasClipeVisiveis, congeladoClip), !aEditar, retClipe);
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
  /* MP4 COM DESENHOS FEITO NO SERVIDOR (19/11): nos cortes de vídeos
     carregados, em vez de gravar o separador (só no computador, em tempo
     real), o serviço de vídeo faz o MP4 com os desenhos, as paragens e o
     zoom (media/descargaDesenhos.js). Quando fica pronto, o botão passa a
     "Enviar": o toque abre a partilha (no telemóvel, a partilha só abre a
     partir de um toque). */
  const [mp4Desenhos, setMp4Desenhos] = useState(null); // null | { texto } | { blob } | 'erro'
  const mp4DesenhosVivoRef = useRef(true);
  useEffect(() => { mp4DesenhosVivoRef.current = true; return () => { mp4DesenhosVivoRef.current = false; }; }, []);
  const servidorDesenhos = !ehYt && (clip.shapes || []).length > 0 && podeDescarregarComDesenhos(clip.publicUrl);
  const pedirMp4Desenhos = async () => {
    if (mp4Desenhos && mp4Desenhos.blob) { await entregarVideo(mp4Desenhos.blob, nomeClipe()); return; }
    if (mp4Desenhos) return;
    const dur = duracaoVideo || Number(clip.duracao) || 0;
    if (!(dur > 0)) return;
    setMp4Desenhos({ texto: 'A preparar…' });
    try {
      const url = await pedirMp4ComDesenhos({
        src: clip.publicUrl, inicio: 0, fim: dur, plano: planoDoCorte(clip.shapes || [], dur), nome: nomeClipe(),
        onEstado: (texto) => { if (mp4DesenhosVivoRef.current) setMp4Desenhos({ texto }); },
        cancelado: () => !mp4DesenhosVivoRef.current,
      });
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`ficheiro_${resp.status}`);
      const blob = new Blob([await resp.blob()], { type: 'video/mp4' });
      if (mp4DesenhosVivoRef.current) setMp4Desenhos({ blob });
    } catch (e) {
      if (!mp4DesenhosVivoRef.current) return;
      setMp4Desenhos('erro');
      setTimeout(() => { if (mp4DesenhosVivoRef.current) setMp4Desenhos(null); }, 2500);
    }
  };
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
      let novosPontos = (resultado.pontos || []).map((p, i) => (i === 0 ? { ...p, ancora: true } : p));
      if (tInicial > 0 && clip.trajetoriaFoco?.pontos) {
        // um reancorar a meio — mantém a trajetória antiga até este
        // instante, e substitui-a a partir daqui pela nova
        const antigos = clip.trajetoriaFoco.pontos.filter(p => p.t < tInicial);
        novosPontos = [...antigos, ...novosPontos];
      }
      // Mantém a cor escolhida no Estúdio (os clipes antigos não têm: ficam a vermelho).
      onChangeTrajetoria({ pontos: novosPontos, duracao: resultado.duracao, ...(clip.trajetoriaFoco?.cor ? { cor: clip.trajetoriaFoco.cor } : {}) });
      setModoSeguir('normal');
    } catch (e) {
      setErroSeguir(`Não consegui seguir o jogador: ${e.message || e}`);
      setModoSeguir('normal');
    }
  };
  const aoTocarNoVideo = (e) => {
    if (modoSeguir !== 'a_escolher' && modoSeguir !== 'a_corrigir') return;
    const rect = caixaVideoRef.current.getBoundingClientRect();
    // Relativo à imagem do vídeo (sem as barras pretas), como os desenhos.
    const r = retClipe || { left: 0, top: 0, width: rect.width, height: rect.height };
    escolherJogador((e.clientX - rect.left - r.left) / r.width, (e.clientY - rect.top - r.top) / r.height);
  };

  /* O CLIPE ABRE NO ESTÚDIO: o vídeo à esquerda (a maior parte do ecrã)
     e, à direita, o painel do clipe (ações, texto, seguir e etiqueta) —
     o mesmo conceito do editor. Aberto a partir do Estúdio, fica DENTRO
     dele (também em ecrã inteiro); sozinho, ocupa a janela toda. */
  const botaoAcao = (Icone, rotulo, fn, opc = {}) => (
    <button type="button" onClick={opc.disabled ? undefined : fn} title={opc.title || rotulo} disabled={opc.disabled} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '7px 4px', minHeight: 50,
      borderRadius: 8, cursor: opc.disabled ? 'default' : 'pointer', opacity: opc.disabled ? 0.5 : 1, ...body,
      background: opc.ativo ? TV.surfaceRaise : 'transparent', border: `1px solid ${opc.perigo ? `${TV.bad}88` : TV.line}`, color: opc.perigo ? TV.bad : TV.cream,
    }}>
      {Icone}
      <span style={{ fontSize: 10.5, lineHeight: 1.1, textAlign: 'center' }}>{rotulo}</span>
    </button>
  );
  const emEcraInteiroAgora = embutido ? !!ecraInteiroExterno : emEcraInteiro;
  return (
    <BancadaVideo.Provider value>
    <div style={{
      ...(embutido ? { position: 'absolute', inset: 0, zIndex: 30 } : { position: 'fixed', inset: 0, zIndex: 1000 }),
      background: TV.surface, display: 'flex', flexDirection: estreitoPlayer ? 'column' : 'row',
    }}>
      {/* ===== ESQUERDA: vídeo + barra ===== */}
      <div ref={fsRef} style={{ flex: estreitoPlayer ? 'none' : 1, height: estreitoPlayer ? 'min(62vw, 58vh)' : undefined, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#000' }}>
        <div ref={areaRef} style={{ flex: 1, minHeight: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div ref={caixaVideoRef} style={{ position: 'relative', width: caixa.w || '100%', height: caixa.h || 'auto', ...estiloZoomClipe }}>
            {ehYt ? (
              <YoutubeComoVideo youtubeId={clip.youtubeId} inicio={clip.origemInicio || 0} fim={clip.origemFim} videoRef={videoRef} autoPlay onClick={alternar} />
            ) : (
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
            )}
            <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ ...estiloSobreImagem(retClipe), pointerEvents: 'none' }}>
              {formasClipeVisiveis.map(renderShape)}
              {temTrajetoria && <MarcadorTrajetoria videoRef={videoRef} pontos={clip.trajetoriaFoco.pontos} cor={clip.trajetoriaFoco.cor} />}
            </svg>
            {(modoSeguir === 'a_escolher' || modoSeguir === 'a_corrigir') && (
              <div onClick={aoTocarNoVideo}
                style={{ position: 'absolute', inset: 0, cursor: 'crosshair', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <span style={{ marginTop: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, ...body }}>
                  Toca no jogador {modoSeguir === 'a_corrigir' ? 'neste momento: o seguimento continua daqui' : 'que queres seguir'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: TV.surface, flexShrink: 0 }}>
          <button onClick={alternar} title={aTocar ? 'Pausa' : 'Reproduzir'}
            style={{ background: TV.gold, border: 'none', color: '#111', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, display: 'flex' }}>
            {aTocar ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={() => irPara(0)} title="Voltar ao início"
            style={{ background: 'none', border: `1px solid ${TV.line}`, color: TV.cream, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, display: 'flex' }}>
            <RotateCcw size={14} />
          </button>
          <BarraTempo min={0} max={duracaoVideo || 1} value={Math.min(t, duracaoVideo || 0)}
            onChange={(v) => irPara(v)} disabled={!duracaoVideo} rotulo="Posição no clipe" cor={TV.gold} />
          <span style={{ fontSize: 12, color: TV.muted, ...mono, flexShrink: 0 }}>{mmss(t)} / {mmss(duracaoVideo)}</span>
          <button onClick={() => (onEcraInteiro ? onEcraInteiro() : alternarEcraInteiro(videoRef.current))} title={emEcraInteiroAgora ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}
            style={{ background: 'none', border: `1px solid ${TV.line}`, color: TV.cream, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, display: 'flex', flexShrink: 0 }}>
            {emEcraInteiroAgora ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* ===== DIREITA: painel do clipe ===== */}
      <div style={{
        width: estreitoPlayer ? '100%' : 310, flex: estreitoPlayer ? 1 : 'none', minHeight: 0, display: 'flex', flexDirection: 'column',
        borderLeft: estreitoPlayer ? 'none' : `1px solid ${TV.line}`, borderTop: estreitoPlayer ? `1px solid ${TV.line}` : 'none', background: TV.surface,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px 8px', paddingTop: estreitoPlayer ? 10 : 'calc(10px + env(safe-area-inset-top, 0px))', borderBottom: `1px solid ${TV.line}`, flexShrink: 0 }}>
          <button type="button" onClick={onClose} title={embutido ? 'Voltar ao editor' : 'Fechar'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: `1px solid ${TV.line}`, borderRadius: 8,
            color: TV.cream, cursor: 'pointer', padding: '6px 9px', fontSize: 12, ...body, flexShrink: 0,
          }}>{embutido ? <><ArrowLeft size={13} /> Editor</> : <X size={14} />}</button>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: tag ? corTextoEtiqueta(tag.color) : TV.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...body }}>
              {tag?.label || (soVer ? (clip.titulo || 'Clipe') : 'Sem etiqueta')} · {Math.round(clip.duracao)}s
            </span>
            {clip.originalTitulo && <span style={{ display: 'block', fontSize: 10.5, color: TV.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...body }}>{clip.originalTitulo}{typeof clip.origemInicio === 'number' ? ` · ${fmt(clip.origemInicio)}–${fmt(clip.origemFim)}` : ''}</span>}
          </span>
        </div>
        <div className="mjp-sem-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, scrollbarWidth: 'none' }}>
          {!soVer && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {botaoAcao(copied ? <Check size={15} color={TV.good} /> : <Share2 size={15} />, copied ? 'Copiado' : 'Partilhar', onShare, { title: 'Partilhar o link do clipe' })}
            {!ehYt && botaoAcao(estadoMp4 === 'a-preparar' ? <Loader2 size={15} className="spin" /> : <Download size={15} />, estadoMp4 === 'erro' ? 'Falhou' : 'MP4', async () => {
              setEstadoMp4('a-preparar');
              try { await descarregarClipeMp4(clip); setEstadoMp4(null); } catch (e) { setEstadoMp4('erro'); setTimeout(() => setEstadoMp4(null), 2500); }
            }, { disabled: estadoMp4 === 'a-preparar', title: 'Descarregar / partilhar o MP4 (qualidade total, sem desenhos)' })}
            {servidorDesenhos && botaoAcao(
              mp4Desenhos && mp4Desenhos.texto ? <Loader2 size={15} className="spin" /> : mp4Desenhos && mp4Desenhos.blob ? <Check size={15} color={TV.good} /> : <Download size={15} />,
              mp4Desenhos === 'erro' ? 'Falhou' : mp4Desenhos && mp4Desenhos.texto ? mp4Desenhos.texto : mp4Desenhos && mp4Desenhos.blob ? 'Enviar' : 'MP4 c/ desenhos',
              pedirMp4Desenhos,
              { disabled: !!(mp4Desenhos && mp4Desenhos.texto), title: 'MP4 com os desenhos, as paragens e o zoom (feito no servidor)' })}
            {!servidorDesenhos && (clip.shapes || []).length > 0 && podeGravarSeparador() && botaoAcao(
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: gravacaoClipe ? TV.bad : '#fff', display: 'inline-block', margin: 2 }} />,
              gravacaoClipe ? 'Parar' : 'Vídeo c/ desenhos', gravacaoClipe ? pararGravacaoClipe : gravarClipeComDesenhos,
              { ativo: !!gravacaoClipe, title: 'Gravar um vídeo com os desenhos (grava este ecrã enquanto o clipe toca)' })}
            {onDesenhar && botaoAcao(<ArrowUpRight size={15} />, `Desenhar${(clip.shapes || []).length ? ` (${clip.shapes.length})` : ''}`, onDesenhar)}
            {onEnviarSala && botaoAcao(clipeNaSala(clip) ? <Check size={15} color={TV.good} /> : <Tv size={15} />, 'Sala de Vídeo', onEnviarSala, { title: clipeNaSala(clip) ? `Na Sala de Vídeo: ${textoNaSala(clip)}` : 'Enviar para a Sala de Vídeo' })}
            {botaoAcao(<Pencil size={15} />, aEditar ? 'Fechar edição' : 'Editar', aEditar ? () => setAEditar(false) : abrirEdicao, { ativo: aEditar, title: 'Editar texto e tempos' })}
            {botaoAcao(<Trash2 size={15} />, 'Apagar', onRemove, { perigo: true })}
          </div>}

          {aEditar && !soVer ? (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, ...body }}>
              <textarea value={notaEd} onChange={e => setNotaEd(e.target.value)} rows={3} maxLength={2000}
                placeholder="Texto do clipe (ex.: Abrir espaços)"
                style={{ background: TV.surfaceRaise, border: `1px solid ${TV.line}`, borderRadius: 8, padding: '7px 10px', color: TV.cream, fontSize: 12.5, resize: 'vertical', ...body }} />
              {/* Início/Fim: a bandeira marca no ponto atual do clipe; a
                  caixa ao lado deixa escrever o tempo à mão (mm:ss do
                  vídeo original). */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 130px', display: 'flex', gap: 4, minWidth: 0 }}>
                  <Btn variant="ghost" onClick={marcarInicioEd} title="Marcar o início no ponto atual do clipe" style={{ flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 12 }}><Flag size={13} color={TV.good} /> Início</Btn>
                  <CampoTempo rotulo="Início do clipe" valor={inicioEd} onEscolher={escreverInicioEd} />
                </div>
                <div style={{ flex: '1 1 130px', display: 'flex', gap: 4, minWidth: 0 }}>
                  <Btn variant="ghost" onClick={marcarFimEd} title="Marcar o fim no ponto atual do clipe" style={{ flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 12 }}><Flag size={13} color={TV.bad} /> Fim</Btn>
                  <CampoTempo rotulo="Fim do clipe" valor={fimEd} onEscolher={escreverFimEd} />
                </div>
              </div>
              {!ehYt && <select value={originalEd || ''} onChange={e => setOriginalEd(e.target.value || null)} aria-label="Vídeo original"
                style={{ width: '100%', background: TV.surfaceRaise, border: `1px solid ${originalEd ? TV.line : TV.warn}`, borderRadius: 8, padding: '6px 8px', color: TV.cream, fontSize: 12, ...body }}>
                <option value="">Escolhe o vídeo original…</option>
                {(originais || []).map(v => <option key={v.id} value={v.id}>{v.titulo || '(sem nome)'}</option>)}
              </select>}
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="ghost" onClick={() => setAEditar(false)} disabled={aGuardar} style={{ flex: 1, justifyContent: 'center', padding: '6px 8px', fontSize: 12 }}>Cancelar</Btn>
                <Btn variant="solid" onClick={guardarEdicao} disabled={aGuardar} style={{ flex: 1, justifyContent: 'center', padding: '6px 8px', fontSize: 12 }}>
                  {aGuardar ? <><Loader2 size={13} className="spin" /> A guardar…</> : <><Check size={13} /> Guardar</>}
                </Btn>
              </div>
              {erroEd
                ? <div style={{ fontSize: 12, color: TV.bad }}>{erroEd}</div>
                : (
                  <div style={{ fontSize: 11, color: TV.mutedDim, lineHeight: 1.4 }}>
                    {ehYt
                      ? 'Os tempos são do jogo no YouTube; os desenhos acompanham.'
                      : originalEd
                      ? 'Mudar os tempos volta a cortar o vídeo original (uns segundos); os desenhos acompanham.'
                      : 'Não encontrei o vídeo original deste clipe. Escolhe-o na lista para mudar os tempos; sem isso, só muda o texto.'}
                  </div>
                )}
            </div>
          ) : (
            clip.note && <div style={{ marginTop: 12, fontSize: 12.5, color: TV.cream, lineHeight: 1.45, ...body }}>{clip.note}</div>
          )}

          {!aEditar && !soVer && !ehYt && (
            <>
              <div style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: TV.mutedDim, margin: '14px 0 8px', ...body }}>Seguir jogador</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {onSeguirNoDesenho ? (
                  // Uma só maneira de seguir: no desenho do clipe, como os outros desenhos.
                  <Btn variant={temTrajetoria ? 'ghost' : 'solid'} onClick={onSeguirNoDesenho} style={{ padding: '6px 10px', fontSize: 12 }}>
                    <Target size={13} /> {temTrajetoria ? 'Mudar seguimento' : 'Seguir jogador'}
                  </Btn>
                ) : (
                <Btn variant={temTrajetoria ? 'ghost' : 'solid'} onClick={comecarEscolha} disabled={modoSeguir === 'a_processar'} style={{ padding: '6px 10px', fontSize: 12 }}>
                  <Target size={13} /> {temTrajetoria ? 'Seguir outra vez' : 'Seguir jogador'}
                </Btn>
                )}
                {temTrajetoria && !onSeguirNoDesenho && (
                  <Btn variant="ghost" onClick={comecarCorrecao} disabled={modoSeguir === 'a_processar'} style={{ padding: '6px 10px', fontSize: 12 }}>
                    <Crosshair size={13} /> Continuar seguimento
                  </Btn>
                )}
              </div>
              {temTrajetoria && modoSeguir === 'normal' && !onSeguirNoDesenho && (
                <div style={{ marginTop: 8 }}>
                  <AvisoSeguimentoParou pontos={clip.trajetoriaFoco.pontos} fim={duracaoVideo}
                    onIr={(tp) => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = tp; } }} />
                </div>
              )}
              {erroSeguir && (
                <div style={{ marginTop: 8, background: TV.surfaceRaise, border: `1px solid ${TV.bad}`, borderRadius: 7, padding: 9, color: TV.cream, fontSize: 12 }}>{erroSeguir}</div>
              )}
              <div style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: TV.mutedDim, margin: '14px 0 8px', ...body }}>Etiqueta</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5 }}>
                {TAGS_ATIVAS.map(tg => (
                  <button key={tg.id} onClick={() => onChangeTag(tg.id)}
                    style={{
                      padding: '5px 3px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', ...body,
                      width: '100%', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      border: `1px solid ${tg.color}`, background: clip.tagId === tg.id ? tg.color : 'transparent',
                      color: clip.tagId === tg.id ? TEXT_ON_ACCENT : tg.color,
                    }}>
                    {tg.label}
                  </button>
                ))}
              </div>
              {/* EQUIPA DO CORTE: corrigir um engano. Mudar aqui muda a ficha
                  de adversário onde o corte está (sai de uma, entra na outra). */}
              {onChangeEquipa && (equipasDoClipe || []).length > 0 && (
                <>
                  <div style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: TV.mutedDim, margin: '14px 0 8px', ...body }}>Equipa da ação · ficha do adversário</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 5 }}>
                    {[...(equipasDoClipe || []).slice(0, 2), ''].map((nome, i) => {
                      const nossa = nome && ehNossaEquipa(nome, nomeNossaEquipa);
                      const on = nome ? clip.equipa === nome : !clip.equipa;
                      return (
                        <button key={i} type="button" disabled={aMudarEquipa} onClick={() => onChangeEquipa(nome)}
                          title={nossa ? 'A nossa equipa: o corte fica só aqui' : (nome ? `Pôr na ficha de ${nome}` : 'Tirar da ficha do adversário')}
                          style={{
                            padding: '5px 4px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', ...body,
                            width: '100%', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            border: `1px solid ${on ? TV.gold : TV.line}`, background: on ? `${TV.gold}26` : 'transparent', color: on ? TV.gold : TV.cream,
                          }}>{nome || 'Nenhuma'}{nossa ? ' (nós)' : ''}</button>
                      );
                    })}
                  </div>
                  <div style={{ height: 16, marginTop: 5, fontSize: 11, color: TV.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...body }}>
                    {aMudarEquipa ? 'A preparar a ficha do adversário…' : (clip.equipa ? <>Está na ficha de <b style={{ color: TV.cream }}>{clip.equipa}</b>.</> : 'Não está em nenhuma ficha de adversário.')}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </BancadaVideo.Provider>
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
/* Já está na Sala de Vídeo? Por um envio a Jogos (enviadoSala) ou por
   ter uma equipa, que o põe na ficha desse adversário (e no Canal ›
   Adversários). */
const clipeNaSala = (c) => !!c && (((c.enviadoSala || []).length > 0) || !!c.equipa);
/* Os sítios da Sala onde está um corte: a ficha do adversário (`equipa`,
   sincronizada sozinha) e os envios (`enviadoSala`). */
const marcasNaSala = (c) => [
  ...(c && c.equipa ? [{ destino: 'fichaEquipa', rotulo: `Adversários › ${c.equipa}` }] : []),
  ...((c && c.enviadoSala) || []).filter(e => e && e.destino !== 'adversario'),
];
const textoNaSala = (c) => [c && c.equipa ? `Adversários › ${c.equipa}` : null, ...((c && c.enviadoSala) || []).filter(e => e && e.destino !== 'adversario').map(e => e.rotulo)].filter(Boolean).join('; ');

/* JOGADORES POR POSIÇÃO (17/11): a mesma ordem do Plantel (GR, DC, DE…,
   e dentro de cada posição pelo número). Cópia de `POSITIONS` de
   dominio/jogadores.jsx, para a Análise não puxar esse módulo. */
const ORDEM_POSICOES = ['GR', 'DC', 'DE', 'DD', 'MD', 'MC', 'MOC', 'EE', 'ED', 'PL'];
function gruposPorPosicao(jogadores) {
  const i = (j) => { const k = ORDEM_POSICOES.indexOf(String((j && j.position) || '').toUpperCase()); return k === -1 ? ORDEM_POSICOES.length : k; };
  const ord = [...(jogadores || [])].sort((a, b) => (i(a) - i(b)) || ((Number(a.number) || 99) - (Number(b.number) || 99)) || String(a.name || '').localeCompare(String(b.name || ''), 'pt'));
  const grupos = [];
  ord.forEach(j => {
    const pos = ORDEM_POSICOES[i(j)] || 'Sem posição';
    const g = grupos[grupos.length - 1];
    if (g && g[0] === pos) g[1].push(j); else grupos.push([pos, [j]]);
  });
  return grupos;
}

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

/* MINIATURA DE UM CLIPE SEM IMAGEM (clipes dos jogadores feitos sobre um
   jogo carregado). Antes era um <video> direto: cada vez que o cartão
   voltava a montar (ex.: ao escolher o jogador, a lista passa a vir por
   jogo) o vídeo carregava de novo e o cartão ficava PRETO até chegar a
   imagem. Agora:
   - o <video> fica invisível até ter a imagem (por baixo fica o fundo do
     cartão, não preto);
   - a imagem é guardada (canvas → JPEG pequeno) numa cache da sessão, e da
     vez seguinte aparece logo, sem vídeo nenhum.
   Se o servidor não deixar ler a imagem (CORS), volta a tentar sem isso:
   não se guarda, mas também não fica preto. */
const cacheMiniaturasClipe = new Map();
export function MiniaturaClipeVideo({ chave, src, t, style }) {
  const [img, setImg] = useState(() => cacheMiniaturasClipe.get(chave) || null);
  const [visivel, setVisivel] = useState(false);
  const [semCors, setSemCors] = useState(false);
  if (img) return <img src={img} alt="" decoding="sync" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }} />;
  const aoTerImagem = (e) => {
    const v = e.currentTarget;
    setVisivel(true);
    if (semCors || !v.videoWidth) return;
    try {
      const w = 320, h = Math.round((w * v.videoHeight) / v.videoWidth) || 180;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(v, 0, 0, w, h);
      const url = cv.toDataURL('image/jpeg', 0.72);
      cacheMiniaturasClipe.set(chave, url);
      // Fica no <video> já visível; a imagem guardada serve a próxima vez.
    } catch (err) { /* sem CORS: não dá para guardar */ }
  };
  return (
    <video key={semCors ? 'sem' : 'com'} src={`${src}#t=${t}`} muted playsInline preload="metadata"
      onLoadedMetadata={() => setTimeout(() => setVisivel(true), 1500)}
      crossOrigin={semCors ? undefined : 'anonymous'}
      onLoadedData={aoTerImagem} onSeeked={aoTerImagem}
      onError={() => { if (!semCors) setSemCors(true); }}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'transparent', pointerEvents: 'none', opacity: visivel ? 1 : 0, transition: 'opacity 120ms', ...style }} />
  );
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
  // Telemóvel: folha do sistema; computador: WhatsApp / Email / Copiar link.
  const r = await escolherPartilha({ titulo, texto, url });
  return r === 'copiado' ? 'copiado' : 'partilhado';
}

// Clipe de atleta: a página própria da app (?corte=, ver `PaginaCorte`
// no App), que mostra só o intervalo. Um link do YouTube abriria o jogo
// inteiro na app do YouTube do telemóvel. A mensagem é o título do clipe.
function partilharClipeAtleta(clip) {
  const titulo = clip.titulo || 'Clipe';
  /* Clipe sobre um vídeo carregado (17/11): uma página da app, nunca o
     endereço do ficheiro. Posto pelo treinador → a página do corte de onde
     veio (?clipe=); de outra forma → o leitor dos vídeos juntos com este
     troço (?junto=). */
  if (!clip.youtubeId && clip.dataUrl) {
    const url = clip.criadoPorStaff && clip.corteOrigemId
      ? `${URL_PUBLICA_APP}?clipe=${encodeURIComponent(clip.corteOrigemId)}`
      : linkDoVideoJunto(titulo, [{ src: clip.dataUrl, inicio: Number(clip.clipInicio) || 0, fim: Number(clip.clipFim) || 0, titulo }]);
    return partilharLink({ titulo, texto: titulo, url });
  }
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

/* RECORTE SEM REGION CAPTURE (17/11). O `cropTo` só funciona quando se
   partilha o PRÓPRIO separador. Na app instalada (janela própria, como o
   Portal do Atleta) ou quando se escolhe outra superfície, o browser
   recusa e gravava-se o ecrã todo. Aqui recorta-se à mão: a imagem
   partilhada passa por um <canvas> que copia só o retângulo do vídeo
   (calculado a cada imagem, a partir da posição da caixa no ecrã) e é
   esse canvas que se grava. O som segue tal como vem. */
async function recortarPorCanvas(stream, faixa, elemento) {
  const st = (faixa.getSettings && faixa.getSettings()) || {};
  const sup = st.displaySurface || 'browser';
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true;
  v.srcObject = new MediaStream([faixa]);
  try { await v.play(); } catch (e) { return null; }
  if (!v.videoWidth) await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 1500); });
  const regiao = () => {
    const W = v.videoWidth; const H = v.videoHeight;
    if (!W || !H) return null;
    const r = elemento.getBoundingClientRect();
    const bordaX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
    let esc; let ox = 0; let oy = 0;
    if (sup === 'monitor') {
      esc = W / (window.screen.width || window.outerWidth);
      ox = (window.screenX + bordaX) * esc;
      oy = (window.screenY + Math.max(0, window.outerHeight - window.innerHeight - bordaX)) * esc;
    } else if (sup === 'window') {
      esc = W / (window.outerWidth || window.innerWidth);
      ox = bordaX * esc;
      oy = Math.max(0, H - (window.innerHeight + bordaX) * esc);
    } else {
      esc = W / window.innerWidth;
    }
    const sx = Math.max(0, ox + r.left * esc); const sy = Math.max(0, oy + r.top * esc);
    const sw = Math.min(W - sx, r.width * esc); const sh = Math.min(H - sy, r.height * esc);
    return sw > 8 && sh > 8 ? { sx, sy, sw, sh } : null;
  };
  const r0 = regiao();
  if (!r0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(r0.sw / 2) * 2);
  canvas.height = Math.max(2, Math.round(r0.sh / 2) * 2);
  const ctx = canvas.getContext('2d');
  const desenhar = () => {
    const g = regiao();
    if (!g) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Mantém a proporção da caixa (ex.: ao entrar em ecrã inteiro).
    const k = Math.min(canvas.width / g.sw, canvas.height / g.sh);
    const w = g.sw * k; const h = g.sh * k;
    ctx.drawImage(v, g.sx, g.sy, g.sw, g.sh, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  };
  desenhar();
  const relogio = setInterval(desenhar, 1000 / 30);
  const saida = canvas.captureStream(30);
  stream.getAudioTracks().forEach(t => saida.addTrack(t));
  return {
    stream: saida,
    parar: () => { clearInterval(relogio); saida.getVideoTracks().forEach(t => t.stop()); try { v.pause(); v.srcObject = null; } catch (e) { /* nada */ } },
  };
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
  let recortado = false;
  try {
    if (elemento && window.CropTarget && faixa && typeof faixa.cropTo === 'function') {
      const alvo = await window.CropTarget.fromElement(elemento);
      await faixa.cropTo(alvo);
      recortado = true;
    }
  } catch (e) { /* sem Region Capture: recorta-se no canvas, abaixo */ }
  let streamGravar = stream;
  let pararRecorte = () => {};
  if (!recortado && elemento && faixa && typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.captureStream) {
    try {
      const rc = await recortarPorCanvas(stream, faixa, elemento);
      if (rc) { streamGravar = rc.stream; pararRecorte = rc.parar; }
    } catch (e) { /* grava o que veio */ }
  }
  const tipos = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mime = tipos.find(t => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t)) || '';
  const rec = new window.MediaRecorder(streamGravar, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined);
  const partes = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
  let resolver;
  const acabou = new Promise(res => { resolver = res; });
  rec.onstop = () => {
    pararRecorte();
    stream.getTracks().forEach(t => t.stop());
    // Com a duração escrita no cabeçalho (ver media/duracaoMp4.js).
    corrigirDuracaoMp4(new Blob(partes, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] })).then(resolver);
  };
  const terminar = () => {
    if (rec.state !== 'inactive') rec.stop();
    else { pararRecorte(); stream.getTracks().forEach(t => t.stop()); resolver(null); }
  };
  // "Parar partilha" na barra do browser também acaba a gravação.
  if (faixa) faixa.addEventListener('ended', terminar);
  return {
    // `comecar` também retoma uma gravação em pausa (listas de clipes).
    comecar: () => { if (rec.state === 'inactive') rec.start(500); else if (rec.state === 'paused') rec.resume(); },
    pausar: () => { if (rec.state === 'recording') rec.pause(); },
    parar: () => { terminar(); return acabou; },
    acabou,
  };
}

// Entrega o ficheiro: partilha nativa (telemóvel) ou descarga.
export async function entregarVideo(blob, nomeBase, { soDescarregar = false } = {}) {
  if (!blob || !blob.size) return 'vazio';
  const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
  const nome = `${String(nomeBase || 'video').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'video'}.${ext}`;
  // Partilhar: no telemóvel a folha do sistema (com o ficheiro); no
  // computador a nossa janela (ver base/escolherPartilha.js).
  if (!soDescarregar) return escolherPartilha({ titulo: nomeBase || 'Vídeo', ficheiro: new File([blob], nome, { type: blob.type }) });
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

/* JOGOS POR LINK NO EDITOR (todos os do YouTube): o jogo do
   YouTube faz de "vídeo original" no editor dos ficheiros. Os cortes
   feitos nele ficam na mesma coleção dos cortes, com `fonte: 'youtube'`,
   o id do YouTube e os tempos do jogo (não há ficheiro: o YouTube não
   deixa cortar nem ler a imagem). Aparecem no separador Clipes. */
export const ehCorteYoutube = (c) => !!c && c.fonte === 'youtube' && !!c.youtubeId;
export function linkParaEditor(v) {
  if (!v || !v.youtubeId) return null;
  return { id: v.id, titulo: v.title || 'Jogo', youtubeId: v.youtubeId, fonte: 'youtube', pronto: true, criadoEm: v.criadoEm || null };
}
export const miniaturaYoutube = (id) => (id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null);
/* Os desenhos do editor (tempos do clipe, a partir de 0) passam para as
   "paragens" da Sala de Vídeo (anotacoesPausa, tempos do jogo): itens a
   menos de 0,3 s uns dos outros são a mesma paragem. */

function partilharClipeFicheiro(clip) {
  if (ehCorteYoutube(clip)) {
    const tagY = TAGS.find(t => t.id === clip.tagId);
    const tituloY = (clip.note || '').trim() || (tagY ? tagY.label : 'Clipe');
    return partilharLink({ titulo: tituloY, texto: [tituloY, (clip.originalTitulo || '').trim()].filter(Boolean).join('\n'), url: `https://youtu.be/${clip.youtubeId}?t=${Math.floor(clip.origemInicio || 0)}` });
  }
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
function ClipAtletaModal({ clip: clipBase, onClose, onRemove, posicao, onAnterior, onSeguinte, onFimClipe }) {
  // MP4 próprio do clipe (sobrevive ao jogo), quando cobre os tempos.
  const clip = React.useMemo(() => comMp4Proprio(clipBase), [clipBase]);
  const iframeRef = useRef(null);
  const inicio = Math.max(0, Number(clip.clipInicio) || 0);
  const fim = Math.max(inicio + 1, Number(clip.clipFim) || 0);
  const [tempo, setTempo] = useState(inicio);
  const [aTocar, setATocar] = useState(false);
  const saltoRef = useRef(0); // evita pedir vários saltos seguidos enquanto o primeiro não chega
  const [copiado, setCopiado] = useState(false);
  const emSequencia = !!posicao;
  /* FIM DO CLIPE NA SEQUÊNCIA: o vídeo PARA no fim (a barra chega ao
     fim) e aparece "Repetir / Seguinte" — avança-se à mão. Antes passava
     sozinho ao seguinte (ainda com a barra a meio do último segundo) e
     não dava para puxar para trás para rever com o jogador. */
  const [terminado, setTerminado] = useState(false);
  const terminadoRef = useRef(false);
  const marcarTerminado = (v) => { terminadoRef.current = v; setTerminado(v); };

  // O leitor só é recarregado quando o clipe seguinte é de OUTRO vídeo.
  // No mesmo jogo, salta-se dentro do leitor já aberto — a passagem de
  // um clipe para o outro fica quase imediata, sem ecrã preto.
  const [clipeDoLeitor, setClipeDoLeitor] = useState(clip);
  useEffect(() => {
    saltoRef.current = Date.now();
    setTempo(inicio);
    marcarTerminado(false);
    // O mesmo vídeo (do YouTube, ou o mesmo ficheiro carregado): salta-se no leitor aberto.
    if ((clip.youtubeId || clip.dataUrl) === (clipeDoLeitor.youtubeId || clipeDoLeitor.dataUrl)) {
      if (clip.id !== clipeDoLeitor.id) {
        comando('seekTo', [inicio, true]);
        comando('playVideo');
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

  /* Vídeo carregado (ficheiro): um <video> no lugar do iframe; os mesmos
     comandos e as mesmas regras de tempo (ver `processarTempo`). */
  const eFicheiro = !clipeDoLeitor.youtubeId && !!clipeDoLeitor.dataUrl;
  function comando(func, args) {
    const el = iframeRef.current;
    if (el && el.tagName === 'VIDEO') {
      try {
        if (func === 'seekTo') el.currentTime = Math.max(0, Number(args && args[0]) || 0);
        else if (func === 'playVideo') { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
        else if (func === 'pauseVideo') el.pause();
      } catch (e) { /* nada */ }
      return;
    }
    const win = el && el.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  }
  const irPara = (seg) => {
    saltoRef.current = Date.now();
    // Puxar para trás depois do fim volta a deixar ver (sai do "terminado").
    if (terminadoRef.current && seg < fim - 0.3) marcarTerminado(false);
    comando('seekTo', [seg, true]); setTempo(seg);
  };
  // Reproduzir / pausa (botão da barra, tecla Espaço). No fim do clipe,
  // "reproduzir" recomeça do início.
  const alternarReproducao = () => {
    if (terminadoRef.current) { marcarTerminado(false); irPara(inicio); comando('playVideo'); return; }
    comando(aTocarRef.current ? 'pauseVideo' : 'playVideo');
  };
  const aTocarRef = useRef(false);
  aTocarRef.current = aTocar;

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
        if (typeof data.info.currentTime === 'number') processarTempoRef.current(data.info.currentTime);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, inicio, fim, emSequencia]);

  const processarTempo = (t) => {
    const aSaltar = Date.now() - saltoRef.current < 800;
    if (emSequencia && terminadoRef.current) {
      // Já parado no fim: não mexe (o utilizador decide).
    } else if (!aSaltar && t >= fim - 0.25 && emSequencia) {
      comando('pauseVideo');
      setTempo(fim); // a barra chega mesmo ao fim
      marcarTerminado(true);
    } else if (!aSaltar && (t >= fim - 0.15 || t < inicio - 0.5)) irPara(inicio);
    else setTempo(Math.min(fim, Math.max(inicio, t)));
  };
  const processarTempoRef = useRef(processarTempo);
  processarTempoRef.current = processarTempo;
  // Ficheiro a tocar: lê-se o tempo a cada 100 ms (o 'timeupdate' é de ~¼ s).
  useEffect(() => {
    if (!eFicheiro || !aTocar) return undefined;
    const h = setInterval(() => { const el = iframeRef.current; if (el && el.tagName === 'VIDEO') processarTempoRef.current(el.currentTime); }, 100);
    return () => clearInterval(h);
  }, [eFicheiro, aTocar]);

  const aoCarregar = () => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  };

  const src = `https://www.youtube.com/embed/${clipeDoLeitor.youtubeId}?start=${Math.floor(Math.max(0, Number(clipeDoLeitor.clipInicio) || 0))}&autoplay=1&rel=0&playsinline=1&controls=0&disablekb=1&enablejsapi=1&fs=0`;
  const duracao = fim - inicio;
  const [areaRef, caixa] = useCaixaNaArea(16 / 9);
  const [fsRef, emEcraInteiro, alternarEcraInteiro] = useEcraInteiro();
  useFecharComEsc(onClose, !emEcraInteiro);

  /* TECLA ESPAÇO = reproduzir / pausa, venha o clique de onde vier (do
     botão da barra, da barra de tempo…). Só não atua a escrever num
     campo de texto. Se o último clique foi DENTRO do vídeo, o teclado
     fica com o YouTube e a app não o recebe — aí, clicar no vídeo é que
     pausa (como já acontecia). */
  const alternarRef = useRef(alternarReproducao);
  alternarRef.current = alternarReproducao;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      const el = e.target;
      const tag = el && el.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)
        || (tag === 'INPUT' && !['range', 'button', 'checkbox'].includes(String(el.type).toLowerCase()))) return;
      e.preventDefault(); // não "carrega" de novo no botão focado nem desliza a página
      alternarRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
            {eFicheiro ? (
              <video
                key={clipeDoLeitor.dataUrl} ref={iframeRef} src={clipeDoLeitor.dataUrl} title={clip.titulo || 'Clipe'}
                autoPlay playsInline preload="auto"
                onLoadedMetadata={e => { try { e.currentTarget.currentTime = inicio; } catch (err) { /* nada */ } }}
                onTimeUpdate={e => processarTempo(e.currentTarget.currentTime)}
                onPlay={() => setATocar(true)} onPause={() => setATocar(false)}
                onClick={alternarReproducao}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000', objectFit: 'contain', cursor: 'pointer' }}
              />
            ) : (
            <iframe
              ref={iframeRef} onLoad={aoCarregar}
              src={src} title={clip.titulo || 'Clipe'}
              allow="autoplay; encrypted-media; picture-in-picture"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
            )}
            {/* FIM DO CLIPE (sequência): parado, à espera de decisão.
                Fica por cima do vídeo só nesse momento. */}
            {emSequencia && terminado && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', padding: 12 }}>
                  <Btn variant="ghost" onClick={() => { marcarTerminado(false); irPara(inicio); comando('playVideo'); }} style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <RotateCcw size={15} /> Repetir
                  </Btn>
                  {posicao.indice < posicao.total - 1 ? (
                    <Btn onClick={onSeguinte}><SkipForward size={15} /> Clipe seguinte</Btn>
                  ) : (
                    <Btn variant="ghost" onClick={onClose} style={{ background: 'rgba(0,0,0,0.6)' }}><Check size={15} /> Último clipe — fechar</Btn>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* BARRA DO CLIPE — só o intervalo do corte. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <button onClick={(e) => { e.currentTarget.blur(); alternarReproducao(); }} title={terminado ? 'Ver outra vez' : aTocar ? 'Pausa (Espaço)' : 'Reproduzir (Espaço)'}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex' }}>
            {aTocar ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={(e) => { e.currentTarget.blur(); irPara(inicio); }} title="Voltar ao início do clipe"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <RotateCcw size={15} />
          </button>
          <BarraTempo min={0} max={duracao} value={Math.max(0, tempo - inicio)}
            onChange={(v) => irPara(inicio + v)} rotulo="Posição no clipe" />
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

export default function AnalisadorVideo({ teamId, videosOriginais = [], setVideosOriginais, clipes = [], setClipes, uploadVideoEstado, iniciarUploadVideo, askConfirm, destinosSala, enviarParaSala, clipesUsadosNaSala, recuperarOriginal, nomeNossaEquipa = '', garantirFichaAdversario, criarFichaAdversario, jogosLink = [], cortesLink = [], jogadores = [], criarJogoLink = null, enviarLinkParaCanal = null, abrirLink = null, apagarLink = null, renomearLink = null, renderPainelLinks = null, enviarJogoFicheiroParaCanal = null, equipasCompeticao = [], quotaJogosBytes = 30e9, retirarDaSala = null }) {
  EQUIPA_DO_ANALISADOR = teamId || '';
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
  /* REDE DE SEGURANÇA DO VIDEO-WORKER (serviço à parte, no Railway).
     Um vídeo novo fica "A preparar…" (pronto: false) até o worker o
     recodificar. Se o worker estiver em baixo, isso nunca acontecia e o
     vídeo ficava preso para sempre. Agora:
       · "Abrir já, sem esperar" abre-o logo, tal como foi carregado
         (só nesta sessão — se o worker acabar depois, fica o preparado);
       · ao fim de PRAZO_PREPARACAO_MIN sem resposta, passa sozinho a
         disponível, com a nota de que não foi preparado. */
  const [abrirSemEsperar, setAbrirSemEsperar] = useState(() => new Set());
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
      const resultado = await seguirJogadorAssincrono({ video_url: urlEditorRef.current || signedUrl, x_inicial: xFrac, y_inicial: yFrac, t_inicial: tInicial, t_fim: tFim });
      setTrajetoriaFocoPendente(prev => {
        const novosPontos = (resultado.pontos || []).map((p, i) => (i === 0 ? { ...p, ancora: true } : p));
        // se já havia uma trajetória pendente, este toque conta como
        // reancorar a partir daqui — mantém a parte anterior a tInicial
        const anteriores = prev ? prev.pontos.filter(p => p.t < tInicial) : [];
        // A cor do tubo é a que está escolhida em COR quando se segue.
        return { pontos: [...anteriores, ...novosPontos], duracao: resultado.duracao, cor: (prev && prev.cor) || corAtual, tFimPedido: tFim };
      });
    } catch (e) {
      setErroSeguirFoco(`Não consegui seguir o jogador: ${e.message || e}`);
    } finally {
      setProcessandoFoco(false);
    }
  };

  const [modoDesenho, setModoDesenho] = useState(false);
  /* DESENHAR NUM CLIPE JÁ CRIADO: abre-se o vídeo original no editor, no
     troço do clipe, com os desenhos que o clipe já tem (passados para o
     tempo do jogo). Ao guardar, só mudam os desenhos (e o texto e a
     etiqueta): o vídeo do clipe não volta a ser cortado. */
  const [clipeEmDesenho, setClipeEmDesenho] = useState(null);
  // O vídeo do editor: o do corte, quando se desenha/segue num corte.
  // Jogo por link (YouTube) aberto no editor; a desenhar num corte de link,
  // o "vídeo" é só o troço do corte (tempo 0 = início do corte).
  const linkNoEditor = React.useMemo(() => (jogosLink || []).find(v => v && v.id === originalAtivoId && v.youtubeId) || null, [jogosLink, originalAtivoId]);
  const ytEditor = clipeEmDesenho && ehCorteYoutube(clipeEmDesenho)
    ? { id: clipeEmDesenho.youtubeId, inicio: clipeEmDesenho.origemInicio || 0, fim: clipeEmDesenho.origemFim }
    : (linkNoEditor ? { id: linkNoEditor.youtubeId, inicio: 0, fim: null } : null);
  const urlEditor = ytEditor ? `youtube:${ytEditor.id}:${ytEditor.inicio}:${ytEditor.fim}`
    : (clipeEmDesenho && clipeEmDesenho.publicUrl ? clipeEmDesenho.publicUrl : signedUrl);
  const urlEditorRef = useRef(null);
  urlEditorRef.current = urlEditor;
  const [zoomPrevia, setZoomPrevia] = useState(null); // id do círculo cujo zoom se está a pré-visualizar
  const zoomPreviaTimer = useRef(null);
  const seekPendenteRef = useRef(null);
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
  const [segNovos, setSegNovos] = useState(SEG_PADRAO_DESENHO); // segundos com o vídeo parado dos itens desenhados a seguir
  const [editandoDuracaoIndex, setEditandoDuracaoIndex] = useState(null);
  const [duracaoInputTexto, setDuracaoInputTexto] = useState('');
  const drawState = useRef(null);
  const dragState = useRef(null);
  const handleDragState = useRef(null); // arrastar um dos dois "pegas" de uma forma selecionada, para a redimensionar
  const apagando = useRef(false); // a borracha está a ser arrastada — continua a apagar tudo por onde passar
  const [hoverMove, setHoverMove] = useState(false); // o cursor está em cima de um desenho já colocado — mostra que dá para o mover
  const [fullscreen, setFullscreen] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  // Clipe a enviar para a Sala de Vídeo (janela de escolha do destino).
  const [clipeParaSala, setClipeParaSala] = useState(null);
  const enviarClipeSala = (clip, dados) => {
    /* ADVERSÁRIOS: um só caminho. Escolher a ficha aqui é o mesmo que
       escolher a equipa da ação: o clipe fica com essa equipa e a
       sincronização põe-no (uma vez) na ficha. Antes criava-se um segundo
       vídeo na ficha, e o mesmo corte aparecia duas vezes. */
    if (dados.destino === 'adversario') {
      // Equipa NOVA (sem ficha ainda): cria-se a ficha só com o nome e o
      // clipe fica com essa equipa (vai para a ficha como os outros).
      let equipa = '';
      if (dados.fichaNova && dados.fichaNova.nome) {
        if (!criarFichaAdversario) throw new Error('Não foi possível criar a ficha aqui. Cria-a em Scouting › Adversários.');
        equipa = criarFichaAdversario(dados.fichaNova.nome) || '';
        if (!equipa) throw new Error('Escreve o nome da equipa.');
      } else {
        const f = ((destinosSala && destinosSala.fichas) || []).find(x => x.id === dados.fichaId);
        if (!f) throw new Error('Escolhe a equipa.');
        equipa = f.rotulo;
      }
      setClipes(prev => prev.map(c => (c.id === clip.id ? { ...c, equipa, envioFicha: null } : c)));
      setClipeAReproduzir(prev => (prev && prev.id === clip.id ? { ...prev, equipa, envioFicha: null } : prev));
      setClipeParaSala(prev => (prev && prev.id === clip.id ? { ...prev, equipa, envioFicha: null } : prev));
      return;
    }
    // Clipe de link feito no editor: vai como link (YouTube) com os tempos e as paragens dos desenhos.
    const clipCanal = ehCorteYoutube(clip) ? {
      linkAnalise: true, id: clip.id, title: dados.titulo || (clip.note || '').trim() || ((TAGS.find(t => t.id === clip.tagId) || {}).label) || 'Clipe',
      youtubeId: clip.youtubeId, clipInicio: clip.origemInicio || 0, clipFim: clip.origemFim, clipOrigemTitulo: clip.originalTitulo || '',
      note: clip.note || '', anotacoesPausa: formasParaPausas(clip.shapes || [], clip.origemInicio || 0),
    } : clip;
    const item = enviarParaSala({ clip: clipCanal, ...dados });
    const rotulo = dados.rotulo || (dados.destino === 'jogo' ? 'Jogos' : dados.destino === 'adversario' ? 'Adversários' : `Temas › ${dados.pasta}`);
    const marca = { destino: dados.destino, rotulo, itemId: item && item.id, em: new Date().toISOString() };
    const juntar = c => ({ ...c, enviadoSala: [...(c.enviadoSala || []), marca] });
    setClipes(prev => prev.map(c => (c.id === clip.id ? juntar(c) : c)));
    setClipeAReproduzir(prev => (prev && prev.id === clip.id ? juntar(prev) : prev));
    setClipeParaSala(prev => (prev && prev.id === clip.id ? juntar(prev) : prev));
  };
  /* Tirar um corte da Sala: da ficha do adversário (sai sozinho quando o
     corte deixa de ter equipa) ou de um envio (a cópia no Canal). */
  const retirarCorteDaSala = (clip, marca) => {
    const atualizar = (fn) => {
      setClipes(prev => prev.map(c => (c.id === clip.id ? fn(c) : c)));
      setClipeAReproduzir(prev => (prev && prev.id === clip.id ? fn(prev) : prev));
      setClipeParaSala(prev => (prev && prev.id === clip.id ? fn(prev) : prev));
    };
    if (marca.destino === 'fichaEquipa') { atualizar(c => ({ ...c, equipa: null, envioFicha: null })); return; }
    if (retirarDaSala) retirarDaSala({ tipo: 'clipe', id: clip.id, marca });
    const igual = (e) => (marca.itemId ? e.itemId === marca.itemId : (e.rotulo === marca.rotulo && e.em === marca.em));
    atualizar(c => ({ ...c, enviadoSala: (c.enviadoSala || []).filter(e => !igual(e)) }));
  };
  const [clipeAReproduzir, setClipeAReproduzir] = useState(null);
  const [editarClipeAoAbrir, setEditarClipeAoAbrir] = useState(false); // lápis no cartão: abre o clipe já em edição
  const [filtroTag, setFiltroTag] = useState(null);
  // Separadores dos cortes: por separador { jogo, aberto, pesquisa, verMais }.
  const [cortesVista, setCortesVista] = useState({});
  const [menuCorteId, setMenuCorteId] = useState(null); // corte com o menu "⋯" aberto
  const [atletaSel, setAtletaSel] = useState(null); // Análise individual: chave do jogador escolhido
  const [pesquisaAtleta, setPesquisaAtleta] = useState('');
  const [verTodosAtletas, setVerTodosAtletas] = useState(false);
  const [verMaisClipesAtleta, setVerMaisClipesAtleta] = useState(false);
  useEffect(() => {
    if (!menuCorteId) return undefined;
    const fechar = () => setMenuCorteId(null);
    const tecla = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('click', fechar);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('click', fechar); window.removeEventListener('keydown', tecla); };
  }, [menuCorteId]);
  // Separador da biblioteca de clipes: 'staff' (os clipes cortados aqui)
  // ou 'atletas' (Análise individual em clipes, criados no Portal).
  const [separadorClipes, setSeparadorClipes] = useState('staff');
  const areaCortesRef = useRef(null);
  const [alturaAreaCortes, setAlturaAreaCortes] = useState(0);
  // Antes de mudar um filtro (etiqueta, jogo, jogador, "Ver mais"): a área
  // dos cortes guarda a altura que tem, para a página não encolher e os
  // separadores não subirem.
  const fixarAlturaCortes = () => { const el = areaCortesRef.current; if (el) { const h = el.getBoundingClientRect().height; setAlturaAreaCortes(a => Math.max(a, h)); } };
  // Quantos cartões de vídeo cabem numa linha (172px + 10px de espaço).
  const grelhaOriginaisRef = useRef(null);
  const [porLinhaOriginais, setPorLinhaOriginais] = useState(6);
  const [verTodosOriginais, setVerTodosOriginais] = useState(false);
  useEffect(() => {
    const medir = () => {
      const el = grelhaOriginaisRef.current;
      /* A Análise de Vídeo fica montada mas ESCONDIDA quando se está
         noutro separador: aí a grelha mede 0 de largura. Medir nesse
         estado reduzia a grelha a 1 vídeo; ao voltar, voltava a crescer e
         os cartões novos apareciam sem imagem durante uns instantes (era
         esse o piscar). Escondida, mantém-se a última medida boa. */
      const w = el ? el.getBoundingClientRect().width : 0;
      if (w > 0) setPorLinhaOriginais(Math.max(1, Math.floor((w + 10) / 182)));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  });
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
  // Cortes MP4 (separador Cortes) e clipes de links feitos no editor (separador Clipes).
  const cortesFicheiro = clipesStaff.filter(c => !ehCorteYoutube(c));
  const clipesLinkEditor = clipesStaff.filter(c => ehCorteYoutube(c));
  /* CORTES ORGANIZADOS POR JOGO: um bloco por jogo (as duas partes do
     mesmo jogo juntas), do jogo mais recente para o mais antigo; dentro de
     cada jogo, pela ordem em que os lances acontecem (parte e minuto). */
  const parteDoTitulo = (t) => { const m = String(t || '').match(RE_PARTE_CORTE); return m ? Number(m[1] || m[2]) : 0; };
  const jogoDoTitulo = (t) => String(t || '').replace(RE_PARTE_CORTE, '').replace(/[\s_\-–]+$/, '').trim();
  // Os que o treinador apagou deixam de aparecer aqui — mas o jogador
  // continua a tê-los no Portal (ver removerClipe).
  const clipesAtletas = clipes.filter(c => ehClipeAtleta(c) && !c.apagadoPeloTreinador);
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
      if (!porAtleta.has(chave)) porAtleta.set(chave, { chave, atletaId: c.atletaId || null, nome: c.atletaNome || 'Atleta sem nome', clipes: [] });
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

  /* As linhas dos clipes de um cartão (usadas no cartão — os primeiros
     CLIPES_VISIVEIS — e no painel "Ver todos", com a lista inteira). */
  // compacto (no cartão): sem separadores de jogo e cada linha com a mesma
  // altura — os cartões ficam todos iguais, tenham os clipes que tiverem.
  const ALTURA_LINHA_CARTAO = 64;
  const renderClipesCartao = (g, lista, compacto) => lista.map((c, ci, arr) => {
                      // Separador de jogo: quando o jogador tem clipes de
                      // mais de um jogo, cada bloco começa com o nome do
                      // jogo e um play que vê só os clipes dele desse jogo.
                      const jogo = jogoDoClipeAtleta(c);
                      const novoJogo = !compacto && g.nJogos > 1 && (ci === 0 || jogoDoClipeAtleta(arr[ci - 1]).chave !== jogo.chave);
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
                      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${T.line}`, ...(compacto ? { height: ALTURA_LINHA_CARTAO, overflow: 'hidden', boxSizing: 'border-box' } : {}) }}>
                      <button onClick={() => setClipeAtletaAberto(c)}
                        style={{
                          flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '9px 4px 9px 12px', cursor: 'pointer',
                          background: 'transparent', border: 'none', ...body,
                        }}>
                        {!c.youtubeId && c.dataUrl ? (
                          <span style={{ width: 56, height: 42, borderRadius: 4, flexShrink: 0, overflow: 'hidden', background: T.surfaceRaise, display: 'block' }}>
                            <MiniaturaClipeVideo chave={`${c.id}:${c.dataUrl}:${c.clipInicio}`} src={c.dataUrl} t={(Number(c.clipInicio) || 0) + 0.5} />
                          </span>
                        ) : (
                          <img src={`https://img.youtube.com/vi/${c.youtubeId}/default.jpg`} alt=""
                            style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: T.surfaceRaise }} />
                        )}
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
                            {c.criadoPorStaff && <span style={{ ...body, marginLeft: 4, color: T.gold }}>· staff</span>}
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
                        title="Apagar o clipe só daqui (o jogador continua a tê-lo no Portal)" aria-label={`Apagar o clipe ${c.titulo || ''}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px 10px 2px', display: 'flex', flexShrink: 0 }}>
                        <Trash2 size={15} color={T.muted} />
                      </button>
                      </div>
                      </React.Fragment>
                      );
  });
  /* "VER TODOS" ABRE UM PAINEL POR CIMA, em vez de esticar o cartão: a
     grelha nunca muda de tamanho, por isso a página não mexe nada. */
  const [cartaoPainel, setCartaoPainel] = useState(null); // { chave, left, width, top } — onde abrir a coluna

  const originalFicheiro = videosOriginais.find(v => v.id === originalAtivoId) || null;
  const originalLink = React.useMemo(() => linkParaEditor(linkNoEditor), [linkNoEditor]);
  const originalAtivo = originalFicheiro || originalLink;
  const ehLinkNoEditor = !!(originalAtivo && originalAtivo.fonte === 'youtube');
  // Ao abrir um link, larga as ferramentas que só existem nos ficheiros.
  useEffect(() => {
    if (!ehLinkNoEditor) return;
    if (['foraDeJogo', 'medida', 'seguir'].includes(tool)) setTool('seta');
    setPainelRelvado(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehLinkNoEditor]);
  // Apagado (90 dias) enquanto estava aberto: fecha o editor.
  useEffect(() => {
    if (originalAtivo && originalAtivo.ficheiroApagado) setOriginalAtivoId(null);
  }, [originalAtivo]);
  /* EQUIPA DOS CORTES. O vídeo guarda as duas equipas do jogo (ou
     sugerem-se pelo título) e a equipa escolhida para os cortes; cada
     corte novo leva essa equipa e vai sozinho para a ficha dela em
     Scouting › Adversários. Fica escolhida para os cortes seguintes. */
  const equipasDoAtivo = originalAtivo
    ? ((originalAtivo.equipas && originalAtivo.equipas.length) ? originalAtivo.equipas : equipasDoTitulo(originalAtivo.titulo))
    : [];
  const equipaDosCortes = originalAtivo && originalAtivo.equipaCortes && equipasDoAtivo.includes(originalAtivo.equipaCortes) ? originalAtivo.equipaCortes : '';
  const [editarEquipas, setEditarEquipas] = useState(false);
  const [aGarantirFicha, setAGarantirFicha] = useState(false);
  const escolherEquipaCortes = async (nome) => {
    if (!originalAtivo || aGarantirFicha) return;
    const id = originalAtivo.id;
    const guardar = (extra) => setVideosOriginais(prev => prev.map(v => (v.id === id ? { ...v, ...extra } : v)));
    if (!nome || ehNossaEquipa(nome, nomeNossaEquipa) || !garantirFichaAdversario) { guardar({ equipaCortes: nome || '', equipas: equipasDoAtivo }); return; }
    // Sem ficha para esta equipa: a app pede para a criar (ou associar) uma vez.
    setAGarantirFicha(true);
    let r = null;
    try { r = await garantirFichaAdversario({ equipa: nome, equipas: equipasDoAtivo, titulo: originalAtivo.titulo }); } finally { setAGarantirFicha(false); }
    if (!r) return;
    const eqs = (r.equipas && r.equipas.length) ? r.equipas : equipasDoAtivo;
    guardar({ equipaCortes: eqs.includes(r.equipa) ? r.equipa : nome, equipas: eqs });
  };
  const desenhosDoOriginalAtivo = () => {
    const o = videosOriginais.find(v => v.id === originalAtivoId);
    // Sem os desenhos acidentais (toques sem arrastar) que tenham ficado
    // guardados — são invisíveis e só faziam o vídeo parar.
    return (o && Array.isArray(o.desenhos)) ? o.desenhos.filter(sh => !formaAcidental(sh)) : [];
  };
  // O seguimento (tubo) também fica guardado no vídeo, como os desenhos.
  const seguimentoDoOriginalAtivo = () => {
    const o = videosOriginais.find(v => v.id === originalAtivoId);
    return (o && o.seguimento && Array.isArray(o.seguimento.pontos) && o.seguimento.pontos.length) ? o.seguimento : null;
  };
  // Ao abrir um vídeo, vêm os desenhos que lá ficaram (a não ser que se
  // esteja a desenhar num clipe, que traz os seus).
  const clipeEmDesenhoRef = useRef(null);
  clipeEmDesenhoRef.current = clipeEmDesenho;
  const shapesRef = useRef([]);
  shapesRef.current = shapes;
  useEffect(() => {
    if (clipeEmDesenhoRef.current) return;
    setShapes(desenhosDoOriginalAtivo());
    setTrajetoriaFocoPendente(seguimentoDoOriginalAtivo());
    setHistorico([]); setFuturo([]); // o "Retroceder" não passa de um vídeo para outro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalAtivoId]);
  // E cada alteração fica gravada no vídeo (pouco depois, para não gravar a cada traço).
  useEffect(() => {
    if (!originalAtivoId || clipeEmDesenho) return undefined;
    const id = originalAtivoId;
    const tm = setTimeout(() => {
      if (clipeEmDesenhoRef.current) return;
      const atuais = shapesRef.current || [];
      setVideosOriginais(prev => prev.map(v => {
        if (v.id !== id) return v;
        if (JSON.stringify(v.desenhos || []) === JSON.stringify(atuais)) return v;
        return { ...v, desenhos: atuais };
      }));
    }, 700);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, originalAtivoId, clipeEmDesenho]);
  // O seguimento grava-se no vídeo da mesma forma (null = tirado).
  const trajetoriaFocoPendenteRef = useRef(null);
  trajetoriaFocoPendenteRef.current = trajetoriaFocoPendente;
  useEffect(() => {
    if (!originalAtivoId || clipeEmDesenho) return undefined;
    const id = originalAtivoId;
    const tm = setTimeout(() => {
      if (clipeEmDesenhoRef.current) return;
      const atual = trajetoriaFocoPendenteRef.current || null;
      setVideosOriginais(prev => prev.map(v => {
        if (v.id !== id) return v;
        if (JSON.stringify(v.seguimento || null) === JSON.stringify(atual)) return v;
        return { ...v, seguimento: atual };
      }));
    }, 700);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajetoriaFocoPendente, originalAtivoId, clipeEmDesenho]);
  // Só entram no clipe os desenhos que caem dentro dele.
  const dentroDoClipe = (sh, ini, fim) => {
    const a = sh.criadoEmTempo ?? 0;
    if (temParagem(sh)) return a >= ini - 0.05 && a <= fim;
    const ate = sh.mostrarAte != null ? sh.mostrarAte : (sh.duracao != null ? a + sh.duracao : Infinity);
    return a <= fim && ate >= ini;
  };
  // Outro vídeo = outro enquadramento: a calibração e a referência recomeçam.
  useEffect(() => { setCalibracao(null); setCalibrando(null); setRefFJ(null); }, [originalAtivoId]);

  // Enquanto houver algum vídeo "a preparar" (pronto: false), confirma-se
  // a cada 15 segundos se já ficou pronto — sem esperar pela rede de
  // segurança geral da app (essa só corre de 20 em 20 minutos, pensada
  // para casos gerais, não para alguém a olhar para o ecrã à espera de
  // UM vídeo específico agora mesmo). O Realtime continua a ser o
  // caminho normal; isto é só um reforço para quando ele falha em
  // silêncio.
  // Vídeos à espera há demasiado tempo → disponíveis tal como vieram.
  const PRAZO_PREPARACAO_MIN = 180;
  const libertarPresos = () => {
    const limite = Date.now() - PRAZO_PREPARACAO_MIN * 60 * 1000;
    const presos = videosOriginais.filter(v => v.pronto === false && v.criadoEm && new Date(v.criadoEm).getTime() < limite);
    if (!presos.length) return;
    const ids = new Set(presos.map(v => v.id));
    setVideosOriginais(prev => prev.map(v => (ids.has(v.id) && v.pronto === false
      ? { ...v, pronto: true, erroPreparacao: 'O serviço de preparação não respondeu — o vídeo ficou disponível tal como foi carregado.' }
      : v)));
  };
  useEffect(() => {
    libertarPresos();
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
      libertarPresos();
      setVideosOriginais(prev => prev.map(v => {
        const atualizado = data.find(r => r.id === v.id);
        return atualizado ? { ...atualizado.data, id: v.id } : v;
      }));
    }, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videosOriginais.map(v => `${v.id}:${v.pronto}`).join(',')]);
  // Lista dos vídeos: do mais recente para o mais antigo (data de carregamento).
  const originaisPorData = React.useMemo(() => [...videosOriginais].sort((a, b) =>
    (new Date(b.criadoEm || 0).getTime() || 0) - (new Date(a.criadoEm || 0).getTime() || 0)), [videosOriginais]);
  /* A GRELHA DE JOGOS: carregados (ficheiro) e por link (YouTube) juntos,
     o mais recente primeiro, com o mesmo cartão. */
  /* DUAS FORMAS DE TRABALHAR (14/11): "Estúdio" (ficheiros, o editor
     profissional) e "Links" (YouTube, com as ferramentas da Sala de Vídeo).
     O cartão escolhido decide a grelha de jogos e o cartão de adicionar.
     Os cortes das duas juntam-se em baixo. */
  const temLinks = !!renderPainelLinks;
  const [modo, setModoBase] = useState(() => { try { return localStorage.getItem('mjp-analise-modo') === 'links' ? 'links' : 'estudio'; } catch (e) { return 'estudio'; } });
  const setModo = (m) => { setModoBase(m); try { localStorage.setItem('mjp-analise-modo', m); } catch (e) { /* nada */ } };
  const modoEfetivo = temLinks ? modo : 'estudio';
  const grelhaJogos = React.useMemo(() => (modoEfetivo === 'links'
    ? (jogosLink || []).map(v => ({ tipo: 'link', v, em: v.criadoEm }))
    : videosOriginais.map(v => ({ tipo: 'ficheiro', v, em: v.criadoEm }))
  ).sort((a, b) => (new Date(b.em || 0).getTime() || 0) - (new Date(a.em || 0).getTime() || 0)), [videosOriginais, jogosLink, modoEfetivo]);
  const [colarLinkAberto, setColarLinkAberto] = useState(false);
  const [linkAberto, setLinkAberto] = useState(null); // jogo/corte por link aberto no palco
  const [jogoParaCanal, setJogoParaCanal] = useState(null); // { tipo: 'ficheiro', v } — jogo carregado a enviar
  const [linkParaCanal, setLinkParaCanal] = useState(null); // jogo/corte por link a enviar para o Canal
  const painelLinksRef = useRef(null);
  const cabecaLinkRef = useRef(null);
  const gruposCortesLink = React.useMemo(() => {
    const m = new Map();
    [...(cortesLink || [])].sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).forEach(c => {
      const nome = c.clipOrigemTitulo || 'Jogo por link';
      if (!m.has(nome)) m.set(nome, { nome, cortes: [] });
      m.get(nome).cortes.push(c);
    });
    return [...m.values()];
  }, [cortesLink]);
  // O leitor dos links (MediaLibrary da Sala). Vive no palco (Links) ou,
  // aberto a partir do separador "Clipes", logo por baixo da fila desse
  // jogo: o clipe abre ali mesmo e nada acima dele mexe.
  const painelLinksConteudo = () => renderPainelLinks && renderPainelLinks((v) => {
            const enviado = (v.enviadoSala || []).length > 0;
            return (
              <button type="button" onClick={() => setLinkParaCanal(v)}
                title={enviado ? `No Canal: ${(v.enviadoSala || []).map(e => e.rotulo).join('; ')}. Carrega para enviar para outro sítio.` : 'Enviar para o Canal (Jogos ou Adversários)'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer', ...body, fontSize: 11, fontWeight: 600,
                  padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                  border: `1px solid ${enviado ? T.good : T.gold}`, background: 'transparent', color: enviado ? T.good : T.gold,
                }}>
                {enviado ? <><Check size={12} /> No Canal</> : <><Tv size={12} /> Enviar para o Canal</>}
              </button>
            );
          });
  const abrirJogoLink = (id) => {
    setLinkAberto(id);
    if (abrirLink) abrirLink(id);
  };
  /* Abrir um clipe a partir do separador "Clipes": abre em cima, no
     palco (como o Estúdio abre o editor de um ficheiro). Só se desliza a
     página até lá se o leitor estiver fora da vista. */
  const abrirClipeLinkNoPalco = (id) => {
    if (originalAtivoId) { setOriginalAtivoId(null); limparMarcas(); }
    if (modoEfetivo !== 'links') setModo('links');
    abrirJogoLink(id);
    setTimeout(() => {
      const el = cabecaLinkRef.current;
      if (el && estudioForaDaVista(el)) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };
  // Apagado o que estava aberto: volta à grelha.
  useEffect(() => {
    if (linkAberto && !(jogosLink || []).some(x => x.id === linkAberto) && !(cortesLink || []).some(x => x.id === linkAberto)) setLinkAberto(null);
  }, [linkAberto, jogosLink, cortesLink]);
  // Cartão de um jogo por link: igual ao dos carregados (imagem, nome,
  // lápis para mudar o nome, estado e ✕). Abre no separador "Jogos por link".
  /* Jogo por link do YouTube: abre no editor dos ficheiros (todos os
     jogos). Os clipes antigos de links continuam a abrir no leitor dos
     links (separador Clipes). Outros links (redes sociais): leitor antigo. */
  const abrirLinkOuEditor = (v) => {
    if (v && v.youtubeId) { setLinkAberto(null); setOriginalAtivoId(v.id); limparMarcas(); return; }
    abrirJogoLink(v.id);
  };
  /* CARTÃO DE JOGO (ficheiro e link), o mesmo desenho: nome inteiro em
     até duas linhas, por baixo os ícones diretos (Mudar o nome, Enviar
     para a Sala, Apagar) e a informação. */
  const estiloNome2Linhas = {
    fontSize: 12.5, fontWeight: 600, color: T.cream, lineHeight: '16px', height: 32, overflow: 'hidden',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere',
  };
  /* Ícones diretos (sem menu): no cartão do jogo, na linha da informação;
     nos cortes e clipes, num grupo escuro no canto da imagem. */
  const iconeAcao = ([Icone, titulo, acao, cor], i, sobreImagem, lado = 22) => (
    <button key={i} type="button" title={titulo} aria-label={titulo} onClick={(e) => { e.stopPropagation(); acao(); }}
      style={{
        width: sobreImagem ? 26 : lado, height: sobreImagem ? 26 : lado, borderRadius: sobreImagem ? 13 : 6, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
        background: sobreImagem ? 'rgba(0,0,0,0.62)' : 'transparent', color: cor || (sobreImagem ? '#fff' : T.muted),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <Icone size={sobreImagem ? 13 : 13} />
    </button>
  );
  const iconesJogo = (acoes) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 'auto' }}>
      {acoes.filter(Boolean).map((a, i) => iconeAcao(a, i, false))}
    </span>
  );
  /* Ações na zona do texto, encostadas à direita (fora da imagem): a
     imagem fica limpa e os ícones leem-se como parte do cartão. Ficam fora
     do botão do cartão (um botão não pode ter botões dentro), por cima da
     margem direita que o texto deixa livre (LARGURA_ICONES_*).
     `topo` (px desde o topo do cartão) ou, sem ele, presos ao fundo.
     `colunas`: 1 = pilha vertical; 2 = grelha 2×2. */
  /* `esticar` (cartões de jogo): a coluna vai do título à última linha,
     com o primeiro ícone ao nível do nome e o último ao nível da data. */
  const iconesNoCorpo = (acoes, { topo = null, colunas = 1, esticar = false } = {}) => (
    <span style={{
      position: 'absolute', right: colunas > 1 ? 3 : 5,
      ...(esticar ? { top: topo, bottom: 6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }
        : { ...(topo != null ? { top: topo } : { bottom: 4 }), display: 'grid', gridTemplateColumns: `repeat(${colunas}, ${colunas > 1 ? 20 : 22}px)`, gap: colunas > 1 ? 1 : 2 }),
    }}>
      {acoes.filter(Boolean).map((a, i) => iconeAcao(a, i, false, colunas > 1 ? 20 : 22))}
    </span>
  );
  const cartaoLink = (v) => (
    <div key={v.id} style={{ position: 'relative', minWidth: 0 }}>
    <div role="button" tabIndex={0} onClick={() => abrirLinkOuEditor(v)} title={v.title || 'Jogo'}
      onKeyDown={e => { if (e.key === 'Enter') abrirLinkOuEditor(v); }}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, height: ALTURA_CARTAO_JOGO, boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', padding: 0, ...body, overflow: 'hidden',
        borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface,
      }}>
      <div style={{ position: 'relative', width: '100%', height: ALTURA_MINIATURA_JOGO, flexShrink: 0, background: T.surfaceRaise }}>
        {v.youtubeId ? (
          <img src={`https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Link2 size={20} color={T.mutedDim} /></div>
        )}
      </div>
      <div style={{ padding: `8px ${LARGURA_ICONES_JOGO}px 8px 10px`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {editandoNomeId === v.id ? (
          <input autoFocus value={nomeEditado} onChange={e => setNomeEditado(e.target.value)} onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter') { if (renomearLink && nomeEditado.trim()) renomearLink(v.id, nomeEditado.trim()); setEditandoNomeId(null); } if (e.key === 'Escape') setEditandoNomeId(null); }}
            onBlur={() => { if (renomearLink && nomeEditado.trim()) renomearLink(v.id, nomeEditado.trim()); setEditandoNomeId(null); }}
            style={{ width: '100%', background: T.campoFundo, color: T.campoTexto, border: `1px solid ${T.crimsonBright}`, borderRadius: 4, padding: '3px 6px', fontSize: 12.5, ...body }} />
        ) : (
          <div style={estiloNome2Linhas}>{v.title || 'Jogo'}</div>
        )}
        <div aria-hidden style={{ minHeight: 16 }} />
        {/* Sem data (um link não se apaga): a informação vai no fundo, a amarelo. O ícone de link já diz que é do YouTube. */}
        <div title={(v.enviadoSala || []).map(e => e.rotulo).join('; ')} style={{ fontSize: 11, lineHeight: '16px', color: T.gold, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Link2 size={11} style={{ flexShrink: 0 }} />
          {(v.enviadoSala || []).length ? `No Canal · ${String((v.enviadoSala || [])[(v.enviadoSala || []).length - 1].rotulo || '').split(' › ')[0] || 'Sala'}` : 'Só na Análise'}
        </div>
      </div>
    </div>
    {/* Ações diretas, em coluna à direita do texto. */}
    {iconesNoCorpo([
      renomearLink && [Pencil, 'Mudar o nome', () => { setNomeEditado(v.title || ''); setEditandoNomeId(v.id); }],
      enviarLinkParaCanal && [(v.enviadoSala || []).length ? Check : Tv, (v.enviadoSala || []).length ? 'Na Sala de Vídeo (enviar ou retirar)' : 'Enviar para a Sala de Vídeo', () => setLinkParaCanal(v), (v.enviadoSala || []).length ? '#7fe0a0' : undefined],
      apagarLink && [X, 'Apagar', () => apagarLink(v), '#ff8a8a'],
    ], { topo: ALTURA_MINIATURA_JOGO + 5, esticar: true })}
    </div>
  );

  useEffect(() => {
    const aoMudar = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);
  // Janelas que abrem fora do Estúdio (confirmar, enviar para a Sala) não
  // se veem em ecrã inteiro: sai-se dele primeiro.
  const sairDoEcraInteiro = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  const alternarEcraInteiro = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  // Assim que se escolhe um vídeo original, gera-se um signed URL —
  // o bucket `videos-originais` é privado, o browser precisa de um
  // link temporário para o poder reproduzir.
  useEffect(() => {
    setSignedUrl(null);
    if (!originalAtivo || originalAtivo.fonte === 'youtube' || (originalAtivo.pronto === false && !abrirSemEsperar.has(originalAtivo.id))) return;
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
  }, [originalAtivo?.id, originalAtivo?.pronto, originalAtivo && abrirSemEsperar.has(originalAtivo.id)]);

  useEffect(() => {
    // Outro vídeo: o tempo e a duração do anterior não podem ficar na
    // barra (ex.: vinha de 21:12 num jogo de 43 min e o novo tem 25 s —
    // a barra amarela aparecia cheia até se dar play).
    setCurrent(0); setDuration(0); setPlaying(false);
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => {
      setDuration(v.duration || 0);
      if (seekPendenteRef.current != null) { v.currentTime = seekPendenteRef.current; seekPendenteRef.current = null; }
      setCurrent(v.currentTime || 0);
    };
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
  }, [urlEditor]);

  // Paragens dos desenhos também no editor, fora do modo de desenho.
  // Também a desenhar (como na Sala de Vídeo): puxar a barra para trás e
  // dar play mostra as paragens; tocar no vídeo para desenhar larga-as.
  const semParagemNoPlayRef = useRef(false);
  semParagemNoPlayRef.current = modoDesenho;
  const retEditor = useRetanguloVideo(videoRef);
  const svgDesenhoRef = useRef(null);
  // (as paragens — usePausasDesenho — calculam-se mais abaixo, junto dos
  // desenhos dos cortes, que também param o jogo completo)
  const visivelNoEditor = (sh, i) => editandoDuracaoIndex === i || formaVisivel(sh, current, !playing, congeladoEditor);
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
  // Tempos ESCRITOS à mão (mm:ss). Início: o vídeo salta para lá, para se
  // ver onde começa. Fim antes do início: o início recua 8 s (como a
  // bandeira faz quando ainda não há início).
  const escreverIn = (t) => { setInPoint(t); if (outPoint != null && outPoint <= t) setOutPoint(null); seekTo(t); };
  const escreverOut = (t) => { setOutPoint(t); if (inPoint == null || inPoint >= t) setInPoint(Math.max(0, t - 8)); };
  /* Os desenhos ficam guardados NO VÍDEO (jogo completo), mesmo sem criar
     clipe: limpar as marcas de início/fim já não os apaga. Só ao sair de
     "desenhar num clipe" é que se repõem os desenhos do vídeo. */
  const limparMarcas = () => {
    // O seguimento é do vídeo (como os desenhos): limpar as marcas não o
    // apaga; ao sair de "desenhar num clipe", volta o do vídeo.
    if (clipeEmDesenho) {
      setShapes(desenhosDoOriginalAtivo()); setTrajetoriaFocoPendente(seguimentoDoOriginalAtivo());
      if (typeof clipeEmDesenho.origemInicio === 'number') seekPendenteRef.current = clipeEmDesenho.origemInicio;
    }
    setClipeEmDesenho(null); setInPoint(null); setOutPoint(null); setPendingTag(null); setNote(''); setTextoPendente(null); setErroSeguirFoco('');
  };

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

  /* VÍDEOS ENVIADOS SEM REGISTO. Com a versão anterior, um vídeo que o
     Supabase demorasse a disponibilizar ficava no Storage mas nunca
     aparecia aqui. Procura-se na pasta da equipa os vídeos que não estão
     na lista (só ficheiros de vídeo, dos últimos 30 dias) e oferece-se
     recuperá-los. É o treinador que escolhe: nada se junta sozinho. */
  const [semRegisto, setSemRegisto] = useState([]);
  const procurouRef = useRef(false);
  useEffect(() => {
    if (!teamId || !recuperarOriginal || procurouRef.current) return undefined;
    let cancelado = false;
    const t = setTimeout(async () => {
      procurouRef.current = true;
      try {
        const { data, error } = await supabase.storage.from('videos-originais').list(teamId, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
        if (error || !data || cancelado) return;
        const conhecidos = new Set((videosOriginais || []).map(v => v && v.storagePath).filter(Boolean));
        const limite = Date.now() - 30 * 24 * 3600 * 1000;
        const lista = data.filter(o => o && o.name && /\.(mp4|mov|m4v|mkv|avi|webm|mts|3gp)$/i.test(o.name)
          && !conhecidos.has(`${teamId}/${o.name}`)
          && (!o.created_at || new Date(o.created_at).getTime() > limite)
          && Date.now() - new Date(o.created_at || 0).getTime() > 2 * 60 * 1000);
        if (!cancelado) setSemRegisto(lista.map(o => ({
          caminho: `${teamId}/${o.name}`,
          // Nome do ficheiro sem o prefixo único que a app lhe junta.
          titulo: o.name.replace(/^[^-]+-/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim() || o.name,
          tamanho: o.metadata && o.metadata.size,
          criado: o.created_at,
        })));
      } catch (e) { /* sem permissão para listar: não mostra nada */ }
    }, 4000);
    return () => { cancelado = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, recuperarOriginal, videosOriginais.length]);
  /* REJEITAR: "Ignorar" esconde o aviso desse ficheiro neste aparelho
     (fica guardado); "Apagar" tira o ficheiro do Supabase de vez, o que
     também liberta o espaço que ocupa. */
  const chaveIgnorados = `misterjp:videos-sem-registo-ignorados:${teamId || ''}`;
  const [ignorados, setIgnorados] = useState(() => {
    try { return JSON.parse(localStorage.getItem(chaveIgnorados) || '[]'); } catch (e) { return []; }
  });
  const ignorarSemRegisto = (caminho) => {
    setIgnorados(prev => {
      const lista = [...new Set([...(prev || []), caminho])];
      try { localStorage.setItem(chaveIgnorados, JSON.stringify(lista)); } catch (e) { /* sem memória: só esconde agora */ }
      return lista;
    });
  };
  const apagarSemRegisto = (o) => {
    const executar = async () => {
      try { await supabase.storage.from('videos-originais').remove([o.caminho]); } catch (e) { /* esconde na mesma */ }
      setSemRegisto(prev => prev.filter(x => x.caminho !== o.caminho));
    };
    if (askConfirm) {
      askConfirm({
        title: 'Apagar este vídeo do Supabase?',
        label: `Vídeo "${o.titulo}"`,
        note: 'O ficheiro é apagado de vez e deixa de ocupar espaço. Não aparece em lado nenhum da app, por isso nada mais muda.',
        confirmLabel: 'Apagar',
        onConfirm: executar,
      });
    } else if (window.confirm(`Apagar o vídeo "${o.titulo}" do Supabase? O ficheiro é apagado de vez.`)) {
      executar();
    }
  };
  const semRegistoVisiveis = semRegisto.filter(o => !(videosOriginais || []).some(v => v && v.storagePath === o.caminho) && !(ignorados || []).includes(o.caminho));

  /* APAGAR COM "ANULAR" (como no resto da app): o registo sai já, fica a
     barra "Anular" uns segundos, e só depois de ela passar é que se apaga
     o ficheiro no Storage (senão não havia nada para repor). */
  const apagarComAnular = (rotulo, { remover, repor, depois }) => {
    let anulado = false;
    remover();
    offerUndo(`${rotulo} apagado.`, () => { anulado = true; repor(); });
    if (depois) setTimeout(() => { if (!anulado) depois(); }, (UNDO_SECONDS + 3) * 1000);
  };
  /* 90 DIAS (media/retencao.js). */
  const espacoUsado = espacoJogosUsado(videosOriginais);
  const aApagarEmBreve = (videosOriginais || []).filter(v => v && !v.ficheiroApagado && v.pronto !== false && (diasParaApagar(v) ?? 999) <= DIAS_AVISO);
  const prolongarJogo = (v) => {
    setVideosOriginais(prev => (prev || []).map(x => (x.id === v.id && !x.prolongadoEm ? { ...x, prolongadoEm: new Date().toISOString() } : x)));
  };
  // Uma linha por cartão (sempre a mesma altura): até quando fica o jogo,
  // o aviso com "Manter +30 dias" (uma vez), ou quantos cortes ficaram.
  const linhaRetencao = (v) => {
    const estilo = { fontSize: 10.5, minHeight: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, whiteSpace: 'nowrap' };
    if (v.ficheiroApagado) {
      const n = (clipes || []).filter(c => c.originalId === v.id).length;
      return <div style={{ ...estilo, color: T.mutedDim }}>{v.recusadoQuota ? 'Apaga este registo' : `${n} ${n === 1 ? 'corte guardado' : 'cortes guardados'}`}</div>;
    }
    const quando = dataApagar(v);
    if (!quando || v.pronto === false) return <div style={estilo} />;
    const dias = diasParaApagar(v);
    if (dias > DIAS_AVISO) return <div style={{ ...estilo, color: T.mutedDim }}>Disponível até {dataCurtaPt(quando)}</div>;
    return (
      <div style={{ ...estilo, color: T.warn }}>
        <span>{dias === 0 ? 'Apaga hoje' : `Apaga em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</span>
        {!v.prolongadoEm && (
          <span role="button" tabIndex={0} title={`Manter o jogo completo mais ${DIAS_PROLONGAR} dias (só uma vez)`}
            onClick={(e) => { e.stopPropagation(); prolongarJogo(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); prolongarJogo(v); } }}
            style={{ color: T.gold, fontWeight: 600, cursor: 'pointer' }}>+{DIAS_PROLONGAR} dias</span>
        )}
      </div>
    );
  };

  const apagarOriginal = (video) => {
    const executar = () => {
      if (originalAtivoId === video.id) { setOriginalAtivoId(null); limparMarcas(); }
      apagarComAnular(`Vídeo "${video.titulo}"`, {
        remover: () => setVideosOriginais(prev => prev.filter(v => v.id !== video.id)),
        repor: () => setVideosOriginais(prev => (prev.some(v => v.id === video.id) ? prev : [video, ...prev])),
        // O serviço de vídeo salva primeiro os clipes que apontam para este
        // jogo (MP4 próprio), tira as cópias do Canal e só depois apaga o
        // ficheiro. Sem serviço (ou se falhar), apaga-se só o ficheiro.
        depois: async () => {
          if (video.ficheiroApagado) return;
          const URL_WORKER = import.meta.env.VITE_VIDEO_WORKER_URL;
          if (URL_WORKER) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const r = await fetch(`${URL_WORKER}/apagar-jogo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(session && session.access_token) || ''}` },
                body: JSON.stringify({ teamId, storagePath: video.storagePath }),
              });
              if (r.ok) return;
            } catch (e) { /* segue para o caminho simples */ }
          }
          try { await supabase.storage.from('videos-originais').remove([video.storagePath]); } catch (e) { /* fica órfão */ }
        },
      });
    };
    if (askConfirm) {
      askConfirm({
        title: 'Apagar vídeo?',
        label: `Vídeo "${video.titulo}"`,
        note: video.ficheiroApagado ? 'O jogo completo já tinha sido apagado. Sai só o registo; os cortes ficam.' : 'Os cortes e clipes feitos dele ficam guardados. Só o jogo completo desaparece.',
        confirmLabel: 'Apagar',
        onConfirm: executar,
      });
    } else if (window.confirm(`Apagar o vídeo "${video.titulo}"? Os clipes já cortados dele mantêm-se — só o vídeo completo desaparece.`)) {
      executar();
    }
  };

  /* Um texto escrito mas ainda sem "OK" também conta: ao guardar, entra
     nos desenhos em vez de se perder. */
  const shapesComTextoPendente = () => {
    const t = textoPendente;
    if (t && t.valor && t.valor.trim()) {
      return [...shapes, { id: uid(), tool: 'texto', color: corAtual, points: [t.pt], texto: t.valor.trim(), criadoEmTempo: current, mostrarAte: null, seg: segNovos }];
    }
    return shapes;
  };
  /* ---- Guardar clipe: chama a função que corta sem recodificar ---- */
  /* Corta e grava um clipe do vídeo aberto, de `ini` a `fim` (segundos do
     jogo). Usado pelo corte à mão e pela codificação (um toque numa
     etiqueta). Os desenhos do vídeo que caem dentro entram no clipe. */
  const [gravacoesCodif, setGravacoesCodif] = useState([]); // [{ id, label, cor }] a cortar agora
  /* ANÁLISE INDIVIDUAL AO CORTAR: escolhe-se um jogador e cada corte
     gravado vai também para a análise individual dele (cartão aqui e
     Portal dele, só para ver). Fica escolhido até se mudar. */
  const [atletaParaClipe, setAtletaParaClipe] = useState('');
  const seletorAnaliseInd = (compacto) => (
    <label title="Cada corte gravado vai também para a análise individual deste jogador (e para o Portal dele)."
      style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10.5, color: TV.mutedDim, letterSpacing: 0.3, minWidth: 0, ...body, ...(compacto ? { flexBasis: '100%' } : {}) }}>
      <span style={{ textTransform: 'uppercase' }}>Análise individual</span>
      <select value={atletaParaClipe} onChange={e => setAtletaParaClipe(e.target.value)}
        style={{ width: '100%', background: TV.surface, border: `1px solid ${atletaParaClipe ? TV.gold : TV.line}`, borderRadius: 7, color: atletaParaClipe ? TV.gold : TV.cream, padding: '6px 8px', fontSize: 12, height: 32, ...body }}>
        <option value="">Não (só corte)</option>
        {gruposPorPosicao(jogadores).map(([pos, lista]) => (
          <optgroup key={pos} label={pos}>
            {lista.map(j => <option key={j.id} value={String(j.id)}>{j.number ? `${j.number}. ` : ''}{j.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
  const seletorEtiquetaCorte = () => {
    const tg = TAGS.find(t => t.id === pendingTag);
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10.5, color: TV.mutedDim, letterSpacing: 0.3, minWidth: 0, ...body }}>
        <span style={{ textTransform: 'uppercase' }}>Etiqueta</span>
        <select value={pendingTag || ''} onChange={e => setPendingTag(e.target.value || null)}
          style={{ width: '100%', minWidth: 0, background: TV.surface, border: `1px solid ${tg ? tg.color : TV.line}`, borderRadius: 7, color: tg ? tg.color : TV.cream, padding: '6px 8px', fontSize: 12, height: 32, ...body }}>
          <option value="">Sem etiqueta</option>
          {TAGS_ATIVAS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
    );
  };
  const [avisoCodif, setAvisoCodif] = useState(null); // { texto, cor } — "Clipe gravado", some sozinho
  const avisoCodifTimer = useRef(null);
  const gravarIntervalo = async (ini, fim, tagId, nota) => {
    if (!originalAtivo || ini == null || fim == null) return false;
    if (fim - ini < 1) { setErro('O clipe tem de ter pelo menos 1 segundo: marca o fim um pouco mais à frente.'); return false; }
    const tag = TAGS.find(t => t.id === tagId) || null;
    const idGrav = uid();
    setGravacoesCodif(g => [...g, { id: idGrav, label: tag ? tag.label : 'Clipe', cor: tag ? tag.color : TV.gold }]);
    setErro('');
    const todasAsFormas = shapesComTextoPendente();
    if (todasAsFormas !== shapes) setShapes(todasAsFormas);
    const shapesFinais = todasAsFormas.filter(sh => dentroDoClipe(sh, ini, fim));
    if (originalAtivo.fonte === 'youtube') {
      /* JOGO POR LINK: o clipe é o próprio link com os tempos (sem cortar
         nada no servidor). Os desenhos ficam no tempo do clipe (0 = início). */
      const relativo = shapesFinais.map(sh => ({
        ...sh,
        criadoEmTempo: sh.criadoEmTempo == null ? null : Math.max(0, sh.criadoEmTempo - ini),
        mostrarAte: sh.mostrarAte == null ? null : Math.max(0, sh.mostrarAte - ini),
      }));
      const novoY = {
        id: uid(), fonte: 'youtube', youtubeId: originalAtivo.youtubeId, tagId: tag ? tag.id : null,
        thumbUrl: miniaturaYoutube(originalAtivo.youtubeId),
        origemInicio: ini, origemFim: fim, duracao: fim - ini, note: nota || '', shapes: relativo, trajetoriaFoco: null,
        originalId: originalAtivo.id, originalTitulo: originalAtivo.titulo, criadoEm: new Date().toISOString(),
        equipa: equipaDosCortes && !ehNossaEquipa(equipaDosCortes, nomeNossaEquipa) ? equipaDosCortes : null,
      };
      const jogadorY = atletaParaClipe ? (jogadores || []).find(j => String(j.id) === atletaParaClipe) : null;
      const clipeIndY = jogadorY ? {
        id: uid(), origem: 'atleta', criadoPorStaff: true, atletaId: String(jogadorY.id), atletaNome: jogadorY.name || '',
        titulo: (nota || '').trim() || (tag ? tag.label : 'Clipe'), note: '', corteOrigemId: novoY.id, originalTitulo: originalAtivo.titulo || '',
        youtubeId: originalAtivo.youtubeId, clipInicio: ini, clipFim: fim, duracao: fim - ini, thumbUrl: novoY.thumbUrl,
        ...(relativo.length ? { shapes: relativo, anotacoesPausa: formasParaPausas(relativo, ini) } : {}), criadoEm: new Date().toISOString(),
      } : null;
      setClipes(prev => [...(clipeIndY ? [clipeIndY] : []), novoY, ...(prev || [])]);
      if (avisoCodifTimer.current) clearTimeout(avisoCodifTimer.current);
      setAvisoCodif({ texto: `Clipe gravado · ${tag ? tag.label : 'sem etiqueta'} · ${fmt(ini)}–${fmt(fim)}${jogadorY ? ` · análise de ${jogadorY.name}` : ''}`, cor: tag ? tag.color : TV.good });
      avisoCodifTimer.current = setTimeout(() => setAvisoCodif(null), 2800);
      setGravacoesCodif(g => g.filter(x => x.id !== idGrav));
      return true;
    }
    try {
      const resp = await fetch('/api/cortar-clipe', {
        method: 'POST',
        headers: await cabecalhosComSessao(),
        body: JSON.stringify({ teamId, storagePath: originalAtivo.storagePath, start: ini, end: fim }),
      });
      let json = {};
      try { json = await resp.json(); } catch (e) { /* resposta sem JSON (ex.: tempo esgotado no servidor) */ }
      if (!resp.ok) throw new Error(json.error || `o servidor respondeu ${resp.status}${resp.status === 504 ? ' (demorou demasiado)' : ''}`);
      // O 0 do ficheiro do corte (pode ser uns segundos antes do marcado).
      const k0 = typeof json.inicioReal === 'number' ? json.inicioReal : ini;
      const novoClipe = {
        id: uid(), tagId: tag ? tag.id : null, storagePath: json.storagePath, publicUrl: json.publicUrl, thumbUrl: json.thumbUrl || null,
        origemInicio: ini, origemFim: fim, duracao: fim - k0,
        ...(typeof json.inicioReal === 'number' ? { origemInicioReal: json.inicioReal } : {}),
        note: nota || '',
        // Os tempos dos desenhos passam a contar a partir do 0 do ficheiro do corte.
        shapes: shapesFinais.map(sh => ({
          ...sh,
          criadoEmTempo: sh.criadoEmTempo == null ? null : Math.max(0, sh.criadoEmTempo - k0),
          mostrarAte: sh.mostrarAte == null ? null : Math.max(0, sh.mostrarAte - k0),
        })),
        trajetoriaFoco: trajetoriaFocoPendente ? {
          pontos: trajetoriaFocoPendente.pontos
            .filter(pt => pt.t >= k0 && pt.t <= fim)
            .map(pt => ({ ...pt, t: Math.max(0, pt.t - k0) })),
          duracao: fim - k0,
          ...(trajetoriaFocoPendente.cor ? { cor: trajetoriaFocoPendente.cor } : {}),
        } : null,
        originalId: originalAtivo.id, originalTitulo: originalAtivo.titulo, criadoEm: new Date().toISOString(),
        // De que equipa é a ação: o corte vai sozinho para a ficha dela em
        // Scouting (ver a sincronização em App). A nossa equipa não vai.
        equipa: equipaDosCortes && !ehNossaEquipa(equipaDosCortes, nomeNossaEquipa) ? equipaDosCortes : null,
      };
      const jogadorInd = atletaParaClipe ? (jogadores || []).find(j => String(j.id) === atletaParaClipe) : null;
      const clipeInd = jogadorInd ? {
        id: uid(), origem: 'atleta', criadoPorStaff: true, atletaId: String(jogadorInd.id), atletaNome: jogadorInd.name || '',
        titulo: (nota || '').trim() || (tag ? tag.label : 'Clipe'), note: '', corteOrigemId: novoClipe.id, originalTitulo: originalAtivo.titulo || '',
        kind: 'video', dataUrl: novoClipe.publicUrl, clipNoFicheiro: true, clipInicio: 0, clipFim: novoClipe.duracao || 0, duracao: novoClipe.duracao || 0,
        thumbUrl: novoClipe.thumbUrl, ...(novoClipe.shapes.length ? { shapes: novoClipe.shapes } : {}), criadoEm: new Date().toISOString(),
      } : null;
      setClipes(prev => [...(clipeInd ? [clipeInd] : []), novoClipe, ...(prev || [])]);
      if (avisoCodifTimer.current) clearTimeout(avisoCodifTimer.current);
      setAvisoCodif({ texto: `Clipe gravado · ${tag ? tag.label : 'sem etiqueta'} · ${fmt(ini)}–${fmt(fim)}${jogadorInd ? ` · análise de ${jogadorInd.name}` : ''}`, cor: tag ? tag.color : TV.good });
      avisoCodifTimer.current = setTimeout(() => setAvisoCodif(null), 2800);
      return true;
    } catch (e) {
      setErro(`Não consegui gravar o clipe: ${e.message || e}`);
      return false;
    } finally {
      setGravacoesCodif(g => g.filter(x => x.id !== idGrav));
    }
  };
  // Corte à mão (Início/Fim marcados).
  const guardarClipe = async (tagId) => {
    if (inPoint == null || outPoint == null || outPoint <= inPoint) return;
    setAGuardarClipe(true);
    const ok = await gravarIntervalo(inPoint, outPoint, typeof tagId === 'string' ? tagId : pendingTag, note);
    setAGuardarClipe(false);
    if (ok) limparMarcas();
  };
  // Um toque numa etiqueta: com Início e Fim marcados grava esse corte com
  // a etiqueta; sem marcas, grava à volta deste instante (antes/depois).
  const [temposCodif, setTemposCodif] = useState(lerTemposCodificar);
  const temposDe = (id) => ({ ...TEMPOS_CODIFICAR_PADRAO, ...(temposCodif[id] || {}) });
  const mudarTempoCodif = (id, campo, delta) => {
    setTemposCodif(prev => {
      const atual = { ...TEMPOS_CODIFICAR_PADRAO, ...(prev[id] || {}) };
      const novo = { ...prev, [id]: { ...atual, [campo]: Math.max(campo === 'antes' ? 0 : 1, Math.min(60, atual[campo] + delta)) } };
      try { localStorage.setItem(CHAVE_TEMPOS_CODIFICAR, JSON.stringify(novo)); } catch (e) { /* sem armazenamento: vale só agora */ }
      return novo;
    });
  };
  const codificar = (tagId) => {
    if (inPoint != null && outPoint != null && outPoint > inPoint) { guardarClipe(tagId); return; }
    const v = videoRef.current;
    const t = v ? v.currentTime : current;
    const { antes, depois } = temposDe(tagId);
    const ini = Math.max(0, t - antes);
    const fim = Math.min(duration || t + depois, t + depois);
    gravarIntervalo(ini, fim, tagId, '');
  };

  // Muda (ou atribui pela primeira vez) a etiqueta de um clipe já guardado.
  /* Equipas possíveis para um corte: as do vídeo de onde saiu (ou as do
     título), mais a que o corte já tem, se for outra. */
  const equipasDoClipeDe = (clip) => {
    if (!clip) return [];
    const o = originalDoClipe(clip);
    const base = o ? ((o.equipas && o.equipas.length) ? o.equipas : equipasDoTitulo(o.titulo)) : equipasDoTitulo(clip.originalTitulo);
    const lista = [...base];
    if (clip.equipa && !lista.includes(clip.equipa)) lista.unshift(clip.equipa);
    return lista.slice(0, 2);
  };
  // Corrigir a equipa de um corte (sai de uma ficha e entra na outra).
  const mudarEquipaClipe = async (clip, nome) => {
    if (!clip || aGarantirFicha) return;
    let equipa = nome || null;
    if (equipa && ehNossaEquipa(equipa, nomeNossaEquipa)) equipa = null;
    if (equipa && garantirFichaAdversario) {
      setAGarantirFicha(true);
      let r = null;
      try { r = await garantirFichaAdversario({ equipa, equipas: equipasDoClipeDe(clip), titulo: clip.originalTitulo || '' }); } finally { setAGarantirFicha(false); }
      if (!r) return;
      equipa = r.equipa || equipa;
    }
    // Sem a marca do envio anterior: escolhido de novo à mão, volta a entrar
    // na ficha mesmo que lá tenha sido apagado antes.
    const novo = { ...clip, equipa, envioFicha: null };
    setClipes(prev => prev.map(c => (c.id === clip.id ? { ...c, equipa, envioFicha: null } : c)));
    setClipeAReproduzir(prev => (prev && prev.id === clip.id ? novo : prev));
  };
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

  // Usado na Sala de Vídeo (Canal ou ficha de adversário)?
  // Envios antigos para Adversários já não contam aqui: passaram a seguir o
  // clipe (saem da ficha quando ele é apagado). Um vídeo que ainda esteja
  // na Sala por outro envio aparece em `clipesUsadosNaSala`.
  // Também conta como "em uso" se estiver na análise individual de algum
  // jogador (o clipe dele aponta para o MESMO ficheiro MP4).
  const clipeUsadoNaSala = (clip) => !!clip && ((clipesUsadosNaSala && clipesUsadosNaSala.has(clip.id)) || (clip.enviadoSala || []).some(e => e && e.destino !== 'adversario')
    || clipes.some(c => c && c.criadoPorStaff && c.corteOrigemId === clip.id));
  // Apaga o vídeo do clipe E a miniatura (o mesmo nome, em .jpg).
  const apagarFicheirosClipe = async (storagePath) => {
    const ficheiros = [storagePath];
    if (/\.mp4$/i.test(storagePath)) ficheiros.push(storagePath.replace(/\.mp4$/i, '.jpg'));
    try { await supabase.storage.from('videos-clipes').remove(ficheiros); } catch (e) { /* fica órfão, sem mal */ }
  };
  const removerClipe = (clip, onRemovido) => {
    sairDoEcraInteiro();
    /* CLIPE DE UM JOGADOR: cada lado apaga só para si. O jogador, no
       Portal, marca `apagadoPeloAtleta` (o treinador continua a vê-lo);
       o treinador, aqui, marca `apagadoPeloTreinador` (o jogador continua a
       tê-lo). O registo só é apagado de vez quando os DOIS o apagaram. */
    if (ehClipeAtleta(clip)) {
      const executarAtleta = () => {
        // Feito pelo staff (análise individual): apaga de vez, também no Portal.
        apagarComAnular('Clipe', {
          remover: () => {
            if (clip.apagadoPeloAtleta || clip.criadoPorStaff) setClipes(prev => prev.filter(c => c.id !== clip.id));
            else setClipes(prev => prev.map(c => (c.id === clip.id ? { ...c, apagadoPeloTreinador: true } : c)));
          },
          // Repõe exatamente como estava (mesmo id).
          repor: () => setClipes(prev => (prev.some(c => c.id === clip.id) ? prev.map(c => (c.id === clip.id ? clip : c)) : [clip, ...prev])),
        });
        onRemovido?.();
      };
      const msg = clip.criadoPorStaff ? 'Foi o staff que o pôs na análise deste jogador: sai daqui e do Portal dele. O corte original fica.'
        : clip.apagadoPeloAtleta ? 'O jogador já o tinha apagado no Portal — fica apagado de vez.' : 'Sai daqui, mas o jogador continua a tê-lo no Portal.';
      if (askConfirm) askConfirm({ title: 'Apagar clipe?', label: 'Este clipe', confirmLabel: 'Apagar', onConfirm: executarAtleta, note: msg });
      else if (window.confirm(`Apagar este clipe? ${msg}`)) executarAtleta();
      return;
    }
    /* Um clipe já enviado para a Sala de Vídeo continua a ser usado lá (e
       na ficha do adversário): apaga-se o registo daqui, mas o ficheiro
       FICA no Storage, senão o vídeo ficava partido na Sala de Vídeo. */
    const naSala = clipeUsadoNaSala(clip);
    const executar = () => {
      apagarComAnular('Corte', {
        remover: () => setClipes(prev => prev.filter(c => c.id !== clip.id)),
        repor: () => setClipes(prev => (prev.some(c => c.id === clip.id) ? prev : [clip, ...prev])),
        // O ficheiro só se apaga depois de passar o "Anular" (e se não estiver
        // em uso na Sala de Vídeo nem numa análise individual).
        depois: clip.storagePath && !naSala ? () => apagarFicheirosClipe(clip.storagePath) : null,
      });
      onRemovido?.();
    };
    const notaSala = naSala ? 'Este clipe foi enviado para a Sala de Vídeo: sai da Análise de Vídeo, mas continua na Sala de Vídeo (o ficheiro não é apagado). Para o tirar de lá, apaga-o também na Sala de Vídeo.'
      : (clip.equipa ? `Sai também da ficha do adversário (${clip.equipa}) em Scouting.` : undefined);
    if (askConfirm) {
      askConfirm({ title: 'Apagar clipe?', label: 'Este clipe', confirmLabel: 'Apagar', onConfirm: executar, note: notaSala });
    } else if (window.confirm('Apagar este clipe?')) {
      executar();
    }
  };

  /* ORIGINAL DE UM CLIPE — pelo id (clipes novos) ou, nos antigos que
     não o guardavam, pelo título, só se houver exatamente um com esse
     título (dois vídeos com o mesmo nome e o corte podia sair do errado). */
  /* DESENHAR / SEGUIR NUM CORTE: trabalha-se sobre o ficheiro do próprio
     corte (clip.publicUrl), no tempo do corte — não sobre o jogo inteiro.
     O Estúdio do vídeo original serve só de "mesa" (ferramentas, painel). */
  const desenharNoClipe = (clip, opcoes = {}) => {
    const orig = originalDoClipe(clip);
    if (!clip.publicUrl && !ehCorteYoutube(clip)) { window.alert('Este corte ainda não tem vídeo disponível.'); return; }
    if (!orig || (!orig.storagePath && orig.fonte !== 'youtube') || orig.ficheiroApagado) {
      window.alert('Não encontrei o vídeo original deste clipe, por isso não dá para desenhar nele. Abre o clipe, carrega no lápis e escolhe o vídeo original.');
      return;
    }
    const durClipe = duracaoDoCorte(clip);
    const ini = 0;
    const fim = durClipe;
    setClipeAReproduzir(null);
    setEditarClipeAoAbrir(false);
    setTextoPendente(null);
    // O seguimento do clipe entra no desenho (no tempo do jogo) e é guardado
    // com os desenhos: seguir aqui é seguir NO CLIPE, como os outros desenhos.
    const tf = clip.trajetoriaFoco;
    setTrajetoriaFocoPendente(tf && tf.pontos && tf.pontos.length
      ? { pontos: tf.pontos, duracao: fim, cor: tf.cor, tFimPedido: fim }
      : null);
    setInPoint(ini); setOutPoint(fim);
    setPendingTag(clip.tagId || null);
    setNote(clip.note || '');
    setShapes((clip.shapes || []).filter(sh => !formaAcidental(sh)));
    setClipeEmDesenho(clip);
    // O vídeo passa a ser o do corte (ver urlEditor): começa no 0 dele.
    videoRef.current?.pause();
    seekPendenteRef.current = 0; setCurrent(0);
    if (originalAtivoId !== orig.id) setOriginalAtivoId(orig.id);
    setModoDesenho(true);
    if (opcoes.seguir) setTool('seguir');
    // A página só se mexe se o Estúdio estiver fora da vista (ex.: veio de um corte lá em baixo).
    setTimeout(() => { if (containerRef.current && estudioForaDaVista(containerRef.current)) containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  };
  const guardarDesenhosClipe = () => {
    const clip = clipeEmDesenho;
    if (!clip) return;
    // Já se desenhou no tempo do próprio corte: guarda-se tal e qual.
    const novos = shapesComTextoPendente();
    const tf = trajetoriaFocoPendente;
    const durClipe = duracaoDoCorte(clip);
    const trajetoriaFoco = tf && tf.pontos && tf.pontos.length
      ? { pontos: tf.pontos.map(({ ...pt }) => pt), duracao: durClipe, ...(tf.cor ? { cor: tf.cor } : {}) } : null;
    const atualizado = { ...clip, shapes: novos, note, tagId: pendingTag || null, trajetoriaFoco };
    setClipes(prev => prev.map(c => (c.id === clip.id ? atualizado : c)));
    setTrajetoriaFocoPendente(null);
    setClipeEmDesenho(null);
    limparMarcas();
    fecharDesenho();
    setClipeAReproduzir(atualizado); // volta ao corte que estava aberto
  };
  const cancelarDesenhosClipe = () => {
    const clip = clipeEmDesenho;
    setClipeEmDesenho(null); setTrajetoriaFocoPendente(null); limparMarcas(); fecharDesenho();
    if (clip) setClipeAReproduzir(clip); // volta ao corte que estava aberto
  };
  const originalDoClipe = (clip) => {
    if (!clip) return null;
    if (clip.originalId) return videosOriginais.find(v => v.id === clip.originalId) || linkParaEditor((jogosLink || []).find(v => v && v.id === clip.originalId)) || null;
    const mesmos = videosOriginais.filter(v => v.titulo && v.titulo === clip.originalTitulo);
    return mesmos.length === 1 ? mesmos[0] : null;
  };
  const agruparCortes = (base, { semEtiqueta = false } = {}) => {
    const lista = filtroTag && !semEtiqueta ? base.filter(c => c.tagId === filtroTag) : base;
    const porJogo = new Map();
    lista.forEach(c => {
      const orig = originalDoClipe(c);
      const tituloOrig = (orig && orig.titulo) || c.originalTitulo || '';
      const titulo = jogoDoTitulo(tituloOrig) || 'Sem jogo';
      const chave = titulo.toLowerCase();
      if (!porJogo.has(chave)) porJogo.set(chave, { chave, titulo, clipes: [], recente: 0 });
      const g = porJogo.get(chave);
      g.clipes.push({ c, parte: parteDoTitulo(tituloOrig), t: typeof c.origemInicio === 'number' ? c.origemInicio : 0 });
      const quando = new Date((orig && orig.criadoEm) || c.criadoEm || 0).getTime() || 0;
      if (quando > g.recente) g.recente = quando;
    });
    return [...porJogo.values()]
      .sort((a, b) => b.recente - a.recente)
      .map(g => ({ ...g, clipes: g.clipes.sort((x, y) => (x.parte - y.parte) || (x.t - y.t)).map(x => x.c) }));
  };
  /* Os cartões dos cortes (filtro por etiqueta e uma fila por jogo): para
     os cortes MP4 (separador Cortes) e para os clipes de links feitos no
     editor (separador Clipes). */
  /* JOGO CARREGADO COM DESTINO ESCOLHIDO AO CARREGAR (`destinoPendente`):
     quando fica preparado, vai sozinho para a Sala de Vídeo, como se se
     tivesse usado o botão do cartão. */
  const aEnviarPendentesRef = useRef(new Set());
  useEffect(() => {
    if (!enviarJogoFicheiroParaCanal) return;
    (videosOriginais || []).forEach(o => {
      if (!o || !o.destinoPendente || o.pronto === false || o.erroPreparacao || o.ficheiroApagado || aEnviarPendentesRef.current.has(o.id)) return;
      aEnviarPendentesRef.current.add(o.id);
      const semPendente = (x) => { const { destinoPendente, ...resto } = x; return resto; };
      Promise.resolve(enviarJogoFicheiroParaCanal(o, { titulo: o.titulo || 'Jogo', ...o.destinoPendente }))
        .then(() => setVideosOriginais(prev => (prev || []).map(x => (x.id === o.id ? semPendente(x) : x))))
        .catch(e => setVideosOriginais(prev => (prev || []).map(x => (x.id === o.id ? { ...semPendente(x), destinoPendenteErro: String((e && e.message) || e).slice(0, 160) } : x))));
    });
  }, [videosOriginais, enviarJogoFicheiroParaCanal, setVideosOriginais]);

  /* ANÁLISE INDIVIDUAL (fase B). */
  const cartaoClipeAtleta = (c, comNome) => {
    const dur = Math.max(0, (Number(c.clipFim) || 0) - (Number(c.clipInicio) || 0));
    const jogo = jogoDoClipeAtleta(c);
    return (
      <div key={c.id} style={{ position: 'relative', minWidth: 0 }}>
        <button type="button" onClick={() => setClipeAtletaAberto(c)}
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: 0, display: 'block', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', ...body }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: T.surfaceRaise }}>
            {c.thumbUrl ? (
              <img src={c.thumbUrl} alt="" decoding="sync" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : c.youtubeId ? (
              <img src={miniaturaYoutube(c.youtubeId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : c.dataUrl ? (
              <MiniaturaClipeVideo chave={`${c.id}:${c.dataUrl}:${c.clipInicio}`} src={c.dataUrl} t={(Number(c.clipInicio) || 0) + 0.5} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={22} color={T.mutedDim} /></div>
            )}
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.criadoPorStaff ? T.gold : T.line }} />
            {c.criadoPorStaff && <span style={{ position: 'absolute', top: 7, left: 7, fontSize: 10, fontWeight: 700, color: '#111', background: T.goldFundo, borderRadius: 4, padding: '1px 5px', ...body }}>STAFF</span>}
            {c.apagadoPeloAtleta && <span title="O jogador apagou este clipe no Portal. Continua disponível aqui." style={{ position: 'absolute', bottom: 5, left: 6, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.65)', borderRadius: 4, padding: '1px 5px', ...body }}>Apagado no Portal</span>}
            <span style={{ position: 'absolute', bottom: 5, right: 6, fontSize: 10.5, color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 5px', ...mono }}>{Math.round(dur)}s</span>
          </div>
          <div style={{ padding: `7px ${LARGURA_ICONES_1}px 8px 9px`, minHeight: ALTURA_CORPO_CORTE, boxSizing: 'border-box' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comNome ? (c.atletaNome || 'Atleta') : (c.titulo || '(sem título)')}</div>
            <div style={{ fontSize: 11, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {comNome ? `${jogo.nome}` : `${mmss(c.clipInicio)}–${mmss(c.clipFim)}${dataCurta(c.criadoEm) ? ` · ${dataCurta(c.criadoEm)}` : ''}`}
            </div>
          </div>
        </button>
        {iconesNoCorpo([
          [copiedId === c.id ? Check : Share2, copiedId === c.id ? 'Copiado' : 'Partilhar', async () => { if (await partilharClipeAtleta(c) === 'copiado') { setCopiedId(c.id); setTimeout(() => setCopiedId(null), 1600); } }],
          [X, 'Apagar daqui (o jogador continua a tê-lo no Portal)', () => removerClipe(c), '#ff8a8a'],
        ], { colunas: 1 })}
      </div>
    );
  };
  const blocoAnaliseIndividual = () => {
    const cols = Math.max(1, porLinhaOriginais);
    const termo = String(pesquisaAtleta || '').trim().toLowerCase();
    const jogadoresF = cartoesAtletas.filter(g => !termo || g.nome.toLowerCase().includes(termo));
    const sel = cartoesAtletas.find(g => g.chave === atletaSel) || null;
    const limiteJog = cols * 2;
    const jogVisiveis = verTodosAtletas ? jogadoresF : jogadoresF.slice(0, limiteJog);
    const semanaPassada = Date.now() - 7 * 864e5;
    const recentes = [...cartoesAtletas.flatMap(g => g.clipes)].sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
    const listaClipes = sel ? sel.clipes : recentes;
    const limiteClipes = cols * 2;
    const campo = { background: T.campoFundo, color: T.campoTexto, border: `1px solid ${T.line}`, borderRadius: 8, padding: '0 10px', height: 36, fontSize: 13, ...body, boxSizing: 'border-box' };
    const iniciais = (n) => String(n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    const fotoAtleta = (g) => { const j = (jogadores || []).find(x => g.atletaId && String(x.id) === String(g.atletaId)); return (j && j.photo) || null; };
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <select value={jogoFiltroEfetivo} onChange={e => { fixarAlturaCortes(); setJogoFiltroAtletas(e.target.value); }} aria-label="Jogo" style={{ ...campo, flex: '1 1 220px', maxWidth: 360 }}>
            <option value="todos">Todos os jogos ({clipesAtletas.length})</option>
            {jogosAtletas.map(j => <option key={j.chave} value={j.chave}>{j.nome} ({j.total})</option>)}
          </select>
          <input value={pesquisaAtleta} onChange={e => setPesquisaAtleta(e.target.value)} placeholder="Procurar jogador" aria-label="Procurar jogador" style={{ ...campo, flex: '1 1 200px', maxWidth: 320 }} />
        </div>
        {/* JOGADORES: cartões pequenos com as mesmas colunas da página. */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
          {jogVisiveis.map(g => {
            const on = g.chave === atletaSel;
            const novos = g.clipes.some(c => new Date(c.criadoEm || 0).getTime() > semanaPassada);
            return (
              <div key={g.chave} role="button" tabIndex={0} onClick={() => { fixarAlturaCortes(); setAtletaSel(on ? null : g.chave); setVerMaisClipesAtleta(false); }}
                onKeyDown={e => { if (e.key === 'Enter') { fixarAlturaCortes(); setAtletaSel(on ? null : g.chave); setVerMaisClipesAtleta(false); } }}
                title={on ? `${g.nome} · toca outra vez para ver todos` : g.nome}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 10px', minWidth: 0, cursor: 'pointer', textAlign: 'left', ...body,
                  background: on ? T.surfaceRaise : T.surface, border: `1px solid ${on ? T.gold : T.line}`, borderRadius: 10, boxSizing: 'border-box',
                }}>
                <span style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: on ? T.goldFundo : T.surfaceRaise, color: on ? '#111' : T.gold, border: `1.5px solid ${T.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, boxSizing: 'border-box' }}>
                  {/* Fotografia do jogador (Plantel), se tiver; senão, as iniciais. */}
                  {fotoAtleta(g)
                    ? <img src={fotoAtleta(g)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                    : iniciais(g.nome)}
                  {/* Escolhido: a própria fotografia vira o "ver seguidos"
                      (play dourado por cima), sem botões a mais na página. */}
                  {on && g.clipes.length > 1 && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSequenciaAtleta({ clipes: g.clipes, indice: 0 }); }}
                      title={`Ver os ${g.clipes.length} clipes de ${g.nome} seguidos`} aria-label={`Ver os ${g.clipes.length} clipes de ${g.nome} seguidos`}
                      style={{ position: 'absolute', inset: -1.5, borderRadius: '50%', cursor: 'pointer', background: 'rgba(201,162,39,0.88)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <Play size={14} fill="#111" color="#111" style={{ marginLeft: 2 }} />
                    </button>
                  )}
                  {novos && <span title="Clipes novos esta semana" style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 5, background: T.good, border: `2px solid ${T.surface}` }} />}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.nome}</span>
                  <span style={{ display: 'block', fontSize: 11, color: on && g.clipes.length > 1 ? T.gold : T.mutedDim, whiteSpace: 'nowrap', ...mono }}>{g.clipes.length} {g.clipes.length === 1 ? 'clipe' : 'clipes'}</span>
                </span>
              </div>
            );
          })}
        </div>
        {jogadoresF.length > limiteJog && (
          <button type="button" onClick={() => { fixarAlturaCortes(); setVerTodosAtletas(v => !v); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: 0, height: 28, marginTop: 6, ...body }}>
            {verTodosAtletas ? <><ChevronUp size={14} /> Ver menos jogadores</> : <><ChevronDown size={14} /> Ver todos os jogadores ({jogadoresF.length})</>}
          </button>
        )}
        {/* CLIPES: do jogador escolhido, ou os mais recentes de todos. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 10px', minHeight: 40 }}>
          {sel ? (
            <span style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: T.mutedDim, ...body }}>
              Clipes de {sel.nome} · {sel.clipes.length} {sel.clipes.length === 1 ? 'clipe' : 'clipes'}{sel.nJogos > 1 ? ` · ${sel.nJogos} jogos` : ''}{sel.clipes.length > 1 ? ' · ▶ na fotografia para ver seguidos' : ''} · toca outra vez no jogador para ver todos
            </span>
          ) : (
            <span style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: T.mutedDim, ...body }}>Clipes mais recentes · escolhe um jogador para ver só os dele</span>
          )}
        </div>
        {sel ? (
          /* Jogador escolhido: os clipes separados POR JOGO (o mais recente
             primeiro), cada jogo com o seu "ver seguidos". */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(() => {
              const porJogo = [];
              sel.clipes.forEach(c => {
                const j = jogoDoClipeAtleta(c);
                let g = porJogo.find(x => x.chave === j.chave);
                if (!g) { g = { ...j, clipes: [] }; porJogo.push(g); }
                g.clipes.push(c);
              });
              return porJogo.map(jg => (
                <div key={jg.chave}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 26 }}>
                    <span style={{ width: 3, height: 16, borderRadius: 2, background: T.gold, flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: T.cream, ...body, minWidth: 0, overflowWrap: 'anywhere' }}>{jg.nome}</span>
                    <span style={{ fontSize: 11.5, color: T.mutedDim, flexShrink: 0, ...mono }}>{jg.clipes.length} {jg.clipes.length === 1 ? 'clipe' : 'clipes'}</span>
                    {jg.clipes.length > 1 && (
                      <button type="button" onClick={() => setSequenciaAtleta({ clipes: jg.clipes, indice: 0 })}
                        title={`Ver os ${jg.clipes.length} clipes de ${sel.nome} neste jogo, seguidos`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer', ...body, background: 'transparent', border: `1px solid ${T.gold}`, color: T.gold, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                        <Play size={10} fill={T.gold} /> {jg.clipes.length}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
                    {jg.clipes.map(c => cartaoClipeAtleta(c, false))}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
          {(verMaisClipesAtleta ? listaClipes : listaClipes.slice(0, limiteClipes)).map(c => cartaoClipeAtleta(c, !sel))}
        </div>
        )}
        {!sel && listaClipes.length > limiteClipes && (
          <button type="button" onClick={() => { fixarAlturaCortes(); setVerMaisClipesAtleta(v => !v); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: 0, height: 28, marginTop: 6, ...body }}>
            {verMaisClipesAtleta ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver mais ({listaClipes.length - limiteClipes})</>}
          </button>
        )}
      </div>
    );
  };
  /* CORTES (ficheiros e links): filtros em cima (jogo, pesquisa, etiqueta)
     e uma grelha com as mesmas colunas dos cartões dos jogos, duas filas e
     "Ver mais". Com "Todos os jogos", cada jogo é uma linha fechada e só o
     que se abre mostra os cartões: a página fica curta, haja 3 ou 30
     jogos. Cada cartão tem um só botão "⋯" com as ações. */
  const vistaCortesDe = (sep) => cortesVista[sep] || {};
  const mudarVistaCortes = (sep, mudanca) => { fixarAlturaCortes(); setCortesVista(p => ({ ...p, [sep]: { ...(p[sep] || {}), ...mudanca } })); };
  const cartaoCorte = (clip) => {
    const tag = TAGS.find(t => t.id === clip.tagId);
    const naSala = clipeNaSala(clip);
    return (
      <div key={clip.id} style={{ position: 'relative', minWidth: 0 }}>
        <button type="button" onClick={() => { setEditarClipeAoAbrir(false); setClipeAReproduzir(clip); }}
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: 0, display: 'block', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', ...body }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: T.surfaceRaise }}>
            {clip.thumbUrl ? (
              <img src={clip.thumbUrl} alt="" decoding="sync" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={22} color={T.mutedDim} /></div>
            )}
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tag?.color || T.line }} />
            <span style={{ position: 'absolute', bottom: 5, right: 6, fontSize: 10.5, color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 5px', ...mono }}>
              {Math.round(clip.duracao || 0)}s
            </span>
          </div>
          <div style={{ padding: `7px ${LARGURA_ICONES_2}px 8px 9px`, minHeight: ALTURA_CORPO_CORTE, boxSizing: 'border-box' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: corTextoEtiqueta(tag?.color) || T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tag?.label || 'Sem etiqueta'}</div>
            <div style={{ fontSize: 11, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clip.note || `Minuto ${typeof clip.origemInicio === 'number' ? fmt(clip.origemInicio) : '—'}${parteDoTitulo(clip.originalTitulo) ? ` · ${parteDoTitulo(clip.originalTitulo)}.ª parte` : ''}`}
            </div>
          </div>
        </button>
        {iconesNoCorpo([
          [copiedId === clip.id ? Check : Share2, copiedId === clip.id ? 'Copiado' : 'Partilhar', async () => { if (await partilharClipeFicheiro(clip) === 'copiado') { setCopiedId(clip.id); setTimeout(() => setCopiedId(null), 1600); } }],
          [Pencil, 'Editar', () => { setEditarClipeAoAbrir(true); setClipeAReproduzir(clip); }],
          enviarParaSala && [naSala ? Check : Tv, naSala ? `Na Sala de Vídeo: ${textoNaSala(clip)} (enviar ou retirar)` : 'Enviar para a Sala de Vídeo', () => setClipeParaSala(clip), naSala ? '#7fe0a0' : undefined],
          [X, 'Apagar', () => removerClipe(clip), '#ff8a8a'],
        ], { colunas: 2 })}
      </div>
    );
  };
  // Grelha com as colunas dos jogos; fechada mostra duas filas.
  const grelhaCortes = (lista, sep, chave) => {
    const vista = vistaCortesDe(sep);
    const abertos = vista.verMais || {};
    const cols = Math.max(1, porLinhaOriginais);
    const limite = cols * 2;
    const todos = !!abertos[chave];
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
          {(todos ? lista : lista.slice(0, limite)).map(cartaoCorte)}
        </div>
        {lista.length > limite && (
          <button type="button" onClick={() => mudarVistaCortes(sep, { verMais: { ...abertos, [chave]: !todos } })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: 0, height: 28, marginTop: 6, ...body }}>
            {todos ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver mais ({lista.length - limite})</>}
          </button>
        )}
      </>
    );
  };
  const blocoCortes = (listaC, sep = 'staff') => {
    const vista = vistaCortesDe(sep);
    const gruposTodos = agruparCortes(listaC, { semEtiqueta: true });
    const termo = String(vista.pesquisa || '').trim().toLowerCase();
    const filtrada = termo ? listaC.filter(c => {
      const tg = TAGS.find(t => t.id === c.tagId);
      return [c.note, tg && tg.label, c.originalTitulo].filter(Boolean).join(' ').toLowerCase().includes(termo);
    }) : listaC;
    const grupos = agruparCortes(filtrada);
    // Por omissão: todos os jogos (cada um numa linha fechada).
    const jogoSel = vista.jogo && (vista.jogo === 'todos' || gruposTodos.some(g => g.chave === vista.jogo)) ? vista.jogo : 'todos';
    const campo = { background: T.campoFundo, color: T.campoTexto, border: `1px solid ${T.line}`, borderRadius: 8, padding: '0 10px', height: 36, fontSize: 13, ...body, boxSizing: 'border-box' };
    const pilula = (ativo, cor, rotulo, onClick, key) => (
      <button key={key} type="button" onClick={onClick}
        style={{
          flex: '0 0 auto', padding: '0 12px', height: 32, borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...body, whiteSpace: 'nowrap',
          border: `1px solid ${cor}`, background: ativo ? cor : 'transparent', color: ativo ? (cor === T.muted ? T.bg : TEXT_ON_ACCENT) : (cor === T.muted ? T.muted : corTextoEtiqueta(cor)),
        }}>{rotulo}</button>
    );
    const g1 = jogoSel !== 'todos' ? grupos.find(g => g.chave === jogoSel) : null;
    return (
      <div>
        {/* FILTROS: sempre na mesma linha e com a mesma altura. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <select value={jogoSel} onChange={e => mudarVistaCortes(sep, { jogo: e.target.value, aberto: null })} aria-label="Jogo" style={{ ...campo, minWidth: 0, flex: '1 1 220px', maxWidth: 360 }}>
            {gruposTodos.map(g => <option key={g.chave} value={g.chave}>{g.titulo} ({g.clipes.length})</option>)}
            <option value="todos">Todos os jogos ({listaC.length})</option>
          </select>
          <input value={vista.pesquisa || ''} onChange={e => mudarVistaCortes(sep, { pesquisa: e.target.value })} placeholder="Procurar no texto dos cortes" aria-label="Procurar"
            style={{ ...campo, flex: '1 1 200px', maxWidth: 320 }} />
        </div>
        <div className="mjp-sem-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
          {pilula(filtroTag == null, T.muted, 'Todas as etiquetas', () => { fixarAlturaCortes(); setFiltroTag(null); }, 'todas')}
          {TAGS.filter(tag => listaC.some(c => c.tagId === tag.id)).map(tag => pilula(filtroTag === tag.id, tag.color, tag.label, () => { fixarAlturaCortes(); setFiltroTag(tag.id); }, tag.id))}
        </div>
        {jogoSel !== 'todos' ? (
          g1 && g1.clipes.length ? grelhaCortes(g1.clipes, sep, g1.chave) : (
            <div style={{ color: T.mutedDim, fontSize: 13, padding: '12px 0', ...body }}>Nenhum corte deste jogo com estes filtros.</div>
          )
        ) : grupos.length === 0 ? (
          <div style={{ color: T.mutedDim, fontSize: 13, padding: '12px 0', ...body }}>Nenhum corte com estes filtros.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grupos.map(g => {
              const aberto = vista.aberto === g.chave;
              const cores = [...new Set(g.clipes.map(c => (TAGS.find(t => t.id === c.tagId) || {}).color).filter(Boolean))];
              return (
                <div key={g.chave} style={{ border: `1px solid ${aberto ? T.gold : T.line}`, borderRadius: 10, background: T.surface }}>
                  <button type="button" onClick={() => mudarVistaCortes(sep, { aberto: aberto ? null : g.chave })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '0 12px', height: 46, background: 'none', border: 'none', cursor: 'pointer', color: T.cream, textAlign: 'left', ...body }}>
                    {aberto ? <ChevronUp size={16} color={T.gold} /> : <ChevronDown size={16} color={T.muted} />}
                    <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{g.titulo}</span>
                    <span style={{ fontSize: 11.5, color: T.mutedDim, flexShrink: 0, ...mono }}>{g.clipes.length} {g.clipes.length === 1 ? 'corte' : 'cortes'}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
                      {cores.slice(0, 6).map(cor => <span key={cor} style={{ width: 8, height: 8, borderRadius: 4, background: cor }} />)}
                    </span>
                  </button>
                  {aberto && <div style={{ padding: '0 12px 12px' }}>{grelhaCortes(g.clipes, sep, g.chave)}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
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
    if (ehCorteYoutube(clip)) {
      // Link: mudar os tempos é só mudar os números (não há ficheiro).
      const desvioY = (clip.origemInicio || 0) - inicio;
      const novoY = {
        ...clip, note: novaNota, origemInicio: inicio, origemFim: fim, duracao: fim - inicio, editadoEm: new Date().toISOString(),
        shapes: (clip.shapes || []).map(sh => ({
          ...sh,
          criadoEmTempo: sh.criadoEmTempo == null ? null : Math.max(0, sh.criadoEmTempo + desvioY),
          mostrarAte: sh.mostrarAte == null ? null : Math.max(0, sh.mostrarAte + desvioY),
        })),
      };
      setClipes(prev => prev.map(c => (c.id === clip.id ? novoY : c)));
      setClipeAReproduzir(prev => (prev && prev.id === clip.id ? novoY : prev));
      return;
    }
    const original = escolhido || originalDoClipe(clip);
    if (!original || !original.storagePath || original.ficheiroApagado) throw new Error(original && original.ficheiroApagado ? 'O jogo completo deste corte já foi apagado (90 dias). Dá para mudar o texto, não os tempos.' : 'Escolhe o vídeo original para mudar os tempos. Sem ele, só dá para mudar o texto.');
    const resp = await fetch('/api/cortar-clipe', {
      method: 'POST',
      headers: await cabecalhosComSessao(),
      body: JSON.stringify({ teamId, storagePath: original.storagePath, start: inicio, end: fim }),
    });
    let json = {};
    try { json = await resp.json(); } catch (e) { /* resposta sem corpo */ }
    if (!resp.ok) throw new Error(`Não consegui voltar a cortar o clipe: ${json.error || resp.status}`);
    // Os desenhos estão guardados relativos ao 0 do ficheiro: acompanham a mudança.
    const k0Novo = typeof json.inicioReal === 'number' ? json.inicioReal : inicio;
    const desvio = inicioRealDoCorte(clip) - k0Novo;
    const { origemInicioReal: _antigoReal, ...clipSemReal } = clip; // eslint-disable-line no-unused-vars
    const novo = {
      ...clipSemReal,
      note: novaNota,
      storagePath: json.storagePath, publicUrl: json.publicUrl, thumbUrl: json.thumbUrl || null,
      origemInicio: inicio, origemFim: fim, duracao: fim - k0Novo,
      ...(typeof json.inicioReal === 'number' ? { origemInicioReal: json.inicioReal } : {}),
      originalId: original.id, originalTitulo: original.titulo,
      shapes: (clip.shapes || []).map(sh => ({
        ...sh,
        criadoEmTempo: sh.criadoEmTempo == null ? null : Math.max(0, sh.criadoEmTempo + desvio),
        mostrarAte: sh.mostrarAte == null ? null : Math.max(0, sh.mostrarAte + desvio),
      })),
      trajetoriaFoco: (clip.trajetoriaFoco && !mudouOriginal) ? {
        pontos: clip.trajetoriaFoco.pontos
          .map(p => ({ ...p, t: p.t + desvio }))
          .filter(p => p.t >= 0 && p.t <= fim - k0Novo),
        duracao: fim - k0Novo,
      } : null,
      editadoEm: new Date().toISOString(),
    };
    setClipes(prev => prev.map(c => (c.id === clip.id ? novo : c)));
    setClipeAReproduzir(prev => (prev && prev.id === clip.id ? novo : prev));
    // O ficheiro antigo só se apaga depois de o novo estar gravado — e
    // não se apaga se o clipe já foi enviado para a Sala de Vídeo (lá
    // continua a versão que foi enviada).
    if (clip.storagePath && clip.storagePath !== json.storagePath && !clipeUsadoNaSala(clip)) {
      await apagarFicheirosClipe(clip.storagePath);
    }
  };



  /* ---- Telestração ---- */
  const getPoint = (e) => {
    // Relativo à IMAGEM do vídeo (a camada de desenho), não à caixa toda.
    const rect = (svgDesenhoRef.current || canvasWrapRef.current).getBoundingClientRect();
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
      if (clipeEmDesenhoRef.current) return; // no corte sai-se por "Guardar no clipe" ou "Cancelar"
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
    setShapes(s => [...s, { id: uid(), tool: pontosEmCurso.tool, color: corAtual, points: pontosEmCurso.points, criadoEmTempo: current, mostrarAte: null, seg: segNovos }]);
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
    largarParagemEditor();
    setEditandoDuracaoIndex(index);
    const atual = shapes[index]?.mostrarAte;
    setDuracaoInputTexto(fmt(atual != null ? atual : current + 3));
  };
  const confirmarDuracaoShape = () => {
    const seg = parseMMSS(duracaoInputTexto);
    if (seg != null && editandoDuracaoIndex != null) {
      setShapes(s => s.map((sh, i) => (i === editandoDuracaoIndex ? { ...sh, mostrarAte: seg, seg: null, semParar: true } : sh)));
    }
    setEditandoDuracaoIndex(null);
  };
  // Segundos no ecrã com o vídeo parado (null = sem parar, a acompanhar o vídeo).
  const mudarSegShape = (seg) => {
    if (editandoDuracaoIndex == null) return;
    pushHistorico();
    setShapes(s => s.map((sh, i) => {
      if (i !== editandoDuracaoIndex) return sh;
      const { semParar, ...resto } = sh; // eslint-disable-line no-unused-vars
      return seg ? { ...resto, seg, mostrarAte: null } : { ...resto, seg: null, mostrarAte: null, semParar: true };
    }));
  };
  const marcarSempreVisivelShape = () => {
    if (editandoDuracaoIndex != null) setShapes(s => s.map((sh, i) => (i === editandoDuracaoIndex ? { ...sh, mostrarAte: null, seg: null, semParar: true } : sh)));
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
    // Com a ferramenta Seguir, a cor muda também o tubo do jogador seguido.
    if (tool === 'seguir' && trajetoriaFocoPendente) setTrajetoriaFocoPendente(t => (t ? { ...t, cor } : t));
    if (editandoDuracaoIndex != null && shapes[editandoDuracaoIndex]) {
      pushHistorico();
      setShapes(s => s.map((sh, i) => (i === editandoDuracaoIndex ? { ...sh, color: cor } : sh)));
    }
  };
  // Zoom do círculo selecionado (1 = sem zoom).
  const mudarZoom = (z) => {
    if (editandoDuracaoIndex == null) return;
    const alvo = shapes[editandoDuracaoIndex];
    if (zoomPreviaTimer.current) clearTimeout(zoomPreviaTimer.current);
    if (alvo && z > 1) {
      setZoomPrevia(alvo.id);
      zoomPreviaTimer.current = setTimeout(() => setZoomPrevia(null), 2600);
    } else setZoomPrevia(null);
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
        setShapes(s => [...s, { id: uid(), tool: 'texto', color: corAtual, points: [t.pt], texto: t.valor.trim(), criadoEmTempo: current, mostrarAte: null, seg: segNovos }]);
      }
      return null;
    });
  };

  const startDraw = (e) => {
    // Tocar no vídeo durante uma paragem: ela fica parada para editar
    // (os itens dela continuam à vista e os novos juntam-se a ela).
    largarParagemEditor();
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
      shapes.forEach((sh, i) => { if (!visivelNoEditor(sh, i)) return; const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
      if (melhorI >= 0) setShapes(s => s.filter((_, i) => i !== melhorI));
      apagando.current = true; // continua a apagar enquanto se arrasta o dedo/rato
      return;
    }
    if (tool === 'texto') {
      // Sem isto, o clique/toque no vídeo tirava logo o foco à caixa de
      // texto acabada de abrir: o que se escrevia perdia-se e o "OK"
      // não gravava nada.
      if (e.cancelable) e.preventDefault();
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
    shapes.forEach((sh, i) => { if (!visivelNoEditor(sh, i)) return; const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
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
      setShapes(s => [...s, { id: uid(), tool: 'foraDeJogo', color: corAtual, points: [pt], fj: r, criadoEmTempo: current, mostrarAte: null, seg: segNovos }]);
      return;
    }
    if (tool === 'medida' && !matrizRelvado) return;
    pushHistorico();
    drawState.current = { id: uid(), tool, color: corAtual, points: [pt], criadoEmTempo: current, mostrarAte: null, seg: segNovos, ...chaoParaNova(tool) };
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
      shapes.forEach((sh, i) => { if (!visivelNoEditor(sh, i)) return; const d = distanciaShape(sh, pt); if (d < melhorD) { melhorD = d; melhorI = i; } });
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
    // A forma já está no array e atualizada. Se foi só um toque (ou um
    // arrasto minúsculo), não fica um desenho invisível: sai, e o
    // "Retroceder" volta ao que estava antes do toque.
    const nova = drawState.current;
    drawState.current = null;
    if (nova && formaAcidental(nova)) {
      setShapes(s => s.filter(sh => sh.id !== nova.id));
      setHistorico(h => h.slice(0, -1));
    }
  };

  const pct = (t) => (duration ? (t / duration) * 100 : 0);
  // Aplica-se sempre o limite de tempo definido — mesmo dentro do modo de
  // desenho — para o que se vê ao testar ser igual ao que vai acontecer
  // depois. A única exceção é a forma que está com o popup de duração
  // aberto: essa fica sempre visível, para não desaparecer a meio de a
  // estares a ajustar.
  /* LARGURA DA BANCADA — em ecrãs largos, os controlos do clipe e as
     etiquetas ficam nas faixas pretas ao lado do vídeo (que fica com a
     altura toda); abaixo de ~900 px vão para baixo da barra. */
  const [estreitoBancada, setEstreitoBancada] = useState(false);
  const alturaEditor = useAlturaAteAoFundo(containerRef, !!originalAtivo && !fullscreen && !estreitoBancada, originalAtivoId);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    // Escondida (outro separador) mede 0: não conta, senão ao voltar o
    // leitor mudava de arrumação por um instante.
    const medir = () => { if (el.clientWidth > 0) setEstreitoBancada(el.clientWidth < 900); };
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
  }, [originalAtivoId, signedUrl]);
  const marcadoClipe = inPoint != null && outPoint != null && outPoint > inPoint;
  const nDesenhosClipe = marcadoClipe ? (clipeEmDesenho ? shapes.length : shapes.filter(sh => dentroDoClipe(sh, inPoint, outPoint)).length) : 0;
  const tituloPainel = (t) => <div style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: TV.mutedDim, ...body }}>{t}</div>;
  const btnPainel = { width: '100%', justifyContent: 'flex-start', padding: '7px 10px', fontSize: 12.5 };
  // Painel do CLIPE: marcar, nota e guardar.
  const painelClipe = (baixo) => (
    <div className="mjp-sem-scroll" style={baixo
      ? { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }
      : { width: 200, flexShrink: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, borderRight: `1px solid ${TV.line}`, overflowY: 'auto', scrollbarWidth: 'none', boxSizing: 'border-box' }}>
      {!baixo && tituloPainel(clipeEmDesenho ? 'Desenhos do clipe' : 'Novo clipe')}
      <Btn variant="ghost" onClick={markIn} style={baixo ? {} : btnPainel}><Flag size={14} color={TV.good} /> Início <span style={{ ...mono, marginLeft: 'auto', color: TV.muted }}>{inPoint == null ? '--:--' : fmt(inPoint)}</span></Btn>
      <Btn variant="ghost" onClick={markOut} style={baixo ? {} : btnPainel}><Flag size={14} color={TV.bad} /> Fim <span style={{ ...mono, marginLeft: 'auto', color: TV.muted }}>{outPoint == null ? '--:--' : fmt(outPoint)}</span></Btn>
      <div style={{ fontSize: 11.5, color: TV.mutedDim, ...mono }}>
        {marcadoClipe ? `${Math.round(outPoint - inPoint)}s${nDesenhosClipe > 0 ? ` · ${nDesenhosClipe} desenho(s)` : ''}` : 'Marca o início e o fim'}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota…" rows={baixo ? 2 : 4}
        style={{ width: baixo ? '100%' : '100%', flexBasis: baixo ? '100%' : undefined, background: TV.surface, border: `1px solid ${TV.line}`, borderRadius: 7, color: TV.cream, padding: 8, fontSize: 12.5, resize: 'none', boxSizing: 'border-box', ...body }} />
      {!clipeEmDesenho && (jogadores || []).length > 0 && seletorAnaliseInd(baixo)}
      {erro && <div style={{ background: TV.surface, border: `1px solid ${TV.bad}`, borderRadius: 7, padding: 8, color: TV.cream, fontSize: 12 }}>{erro}</div>}
      {erroSeguirFoco && <div style={{ background: TV.surface, border: `1px solid ${TV.bad}`, borderRadius: 7, padding: 8, color: TV.cream, fontSize: 12 }}>{erroSeguirFoco}</div>}
      {clipeEmDesenho ? (
        <>
          <Btn variant="solid" onClick={guardarDesenhosClipe} style={baixo ? {} : { ...btnPainel, justifyContent: 'center' }}><Check size={14} /> Guardar no clipe</Btn>
          <Btn variant="plain" onClick={cancelarDesenhosClipe} style={baixo ? {} : { ...btnPainel, justifyContent: 'center' }}><X size={14} /> Cancelar</Btn>
        </>
      ) : (
        <>
          <Btn variant="solid" onClick={guardarClipe} disabled={aGuardarClipe || !marcadoClipe} style={baixo ? {} : { ...btnPainel, justifyContent: 'center' }}>
            {aGuardarClipe ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {aGuardarClipe ? 'A cortar…' : 'Guardar clipe'}
          </Btn>
          <Btn variant="plain" onClick={limparMarcas} disabled={aGuardarClipe || (inPoint == null && outPoint == null)} style={baixo ? {} : { ...btnPainel, justifyContent: 'center' }}><X size={14} /> Limpar marcas</Btn>
        </>
      )}
    </div>
  );
  // Painel da DIREITA: desenhar, seguimento e etiquetas (uma por linha, todas à vista).
  const painelLadoDireito = (baixo) => (
    <div className="mjp-sem-scroll" style={baixo
      ? { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }
      : { width: 190, flexShrink: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: `1px solid ${TV.line}`, overflowY: 'auto', scrollbarWidth: 'none', boxSizing: 'border-box' }}>
      <Btn variant="ghost" onClick={abrirDesenho} style={baixo ? {} : { ...btnPainel, justifyContent: 'center' }}>
        <Pencil size={14} /> Desenhar {shapes.length > 0 && `(${shapes.length})`}
        {trajetoriaFocoPendente && <Target size={13} color={trajetoriaFocoPendente.cor || TV.crimsonBright} style={{ marginLeft: 2 }} />}
      </Btn>
      {trajetoriaFocoPendente && !processandoFoco && (
        <>
          <Btn variant="ghost" onClick={() => { videoRef.current?.pause(); setModoDesenho(true); setTool('seguir'); }} style={baixo ? {} : btnPainel}>
            <Target size={14} color={TV.crimsonBright} /> Continuar seguimento
          </Btn>
          <Btn variant="plain" onClick={() => setTrajetoriaFocoPendente(null)} style={baixo ? {} : btnPainel}><X size={14} /> Tirar seguimento</Btn>
          <AvisoSeguimentoParou pontos={trajetoriaFocoPendente.pontos} fim={Math.min(duration || 0, trajetoriaFocoPendente.tFimPedido ?? Infinity)}
            onIr={(tp) => { videoRef.current?.pause(); seekTo(tp); }} />
        </>
      )}
      {!baixo && <div style={{ height: 4 }} />}
      {tituloPainel('Etiqueta')}
      {TAGS_ATIVAS.map(tag => {
        const on = pendingTag === tag.id;
        return (
          <button key={tag.id} type="button" onClick={() => setPendingTag(t => (t === tag.id ? null : tag.id))}
            style={{
              width: baixo ? 'auto' : '100%', textAlign: 'left', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', ...body,
              border: `1px solid ${tag.color}`, background: on ? tag.color : 'transparent', color: on ? TEXT_ON_ACCENT : tag.color, flexShrink: 0,
            }}>
            {tag.label}
          </button>
        );
      })}
    </div>
  );
  /* ===== ESTÚDIO: separadores, barra, linha do tempo ===== */
  const [aba, setAba] = useState('codificar');
  // O separador Desenhar É o modo de desenho (abrir/fechar um abre/fecha o outro).
  const abaAtiva = modoDesenho ? 'desenhar' : (aba === 'desenhar' ? 'codificar' : aba);
  const irParaAba = (id) => {
    if (id === 'desenhar') { abrirDesenho(); return; }
    if (modoDesenho) fecharDesenho();
    setAba(id);
  };
  // O clipe abre DENTRO do Estúdio (também em ecrã inteiro), quando há um vídeo aberto.
  const estudioEl = originalAtivo && containerRef.current ? containerRef.current : null;
  useEffect(() => {
    if (!clipeAReproduzir) return;
    videoRef.current?.pause();
    if (containerRef.current && !document.fullscreenElement) {
      if (estudioForaDaVista(containerRef.current)) containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [clipeAReproduzir && clipeAReproduzir.id]);
  const [velocidade, setVelocidade] = useState(1);
  const mudarVelocidade = (v) => { setVelocidade(v); if (videoRef.current) videoRef.current.playbackRate = v; };
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = velocidade; }, [urlEditor, velocidade]);
  const saltarVideo = (d) => { const v = videoRef.current; if (v) seekTo((v.currentTime || 0) + d); };
  const irParaTempo = (t) => { const v = videoRef.current; if (v) v.pause(); seekTo(t); };
  const [verTemposCodif, setVerTemposCodif] = useState(false);
  const botaoBarra = {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'transparent',
    border: `1px solid ${TV.line}`, borderRadius: 8, color: TV.cream, cursor: 'pointer', fontSize: 12, ...body,
  };
  const tituloSecao = (t, mt = 0) => <div style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: TV.mutedDim, margin: `${mt}px 0 8px`, ...body }}>{t}</div>;
  const clipesDoVideo = originalAtivo ? clipesStaff.filter(c => { const o = originalDoClipe(c); return o && o.id === originalAtivo.id && typeof c.origemInicio === 'number'; }) : [];
  // Momentos com desenhos (itens a menos de 0,3 s = o mesmo momento).
  const paragensDoVideo = (() => {
    const lista = [...shapes].filter(sh => sh && sh.tool !== 'guias').sort((a, b) => (a.criadoEmTempo ?? 0) - (b.criadoEmTempo ?? 0));
    const grupos = [];
    lista.forEach(sh => {
      const t = sh.criadoEmTempo ?? 0;
      const g = grupos[grupos.length - 1];
      if (g && t - g.t < 0.3) g.formas.push(sh); else grupos.push({ t, formas: [sh] });
    });
    return grupos;
  })();
  const marcasMinutos = (() => {
    const totalMin = (duration || 0) / 60;
    if (!totalMin) return [];
    const passo = totalMin > 60 ? 15 : totalMin > 20 ? 10 : totalMin > 6 ? 2 : 1;
    const out = [];
    for (let m = 0; m < totalMin - passo * 0.3; m += passo) out.push(m);
    return out;
  })();
  // Corte à mão: Início / Fim, nota e guardar (também a desenhar).
  // Ao aparecer o formulário, o painel desloca-se até ele (a página não mexe).
  const formCorteRef = useRef(null);
  useEffect(() => {
    if (!marcadoClipe || !formCorteRef.current) return;
    const el = formCorteRef.current;
    const pai = el.closest('.mjp-sem-scroll');
    if (!pai) return;
    const r = el.getBoundingClientRect(); const rp = pai.getBoundingClientRect();
    if (r.bottom > rp.bottom) pai.scrollTop += r.bottom - rp.bottom + 8;
  }, [marcadoClipe]);
  const corteAMao = () => (
    <div style={{ marginTop: 14 }}>
      {tituloSecao('Corte à mão')}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {/* A bandeira marca no instante atual do vídeo; a caixa ao lado
            deixa escrever o tempo à mão (mm:ss). */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={markIn} title="Marcar o início no instante atual" style={botaoBarra}><Flag size={13} color={TV.good} /> Início</button>
          <CampoTempo rotulo="Início do corte" valor={inPoint} max={duration} onEscolher={escreverIn} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={markOut} title="Marcar o fim no instante atual" style={botaoBarra}><Flag size={13} color={TV.bad} /> Fim</button>
          <CampoTempo rotulo="Fim do corte" valor={outPoint} max={duration} onEscolher={escreverOut} />
        </div>
        {(inPoint != null || outPoint != null) && !clipeEmDesenho && !marcadoClipe && (
          <button type="button" onClick={limparMarcas} style={botaoBarra}><X size={13} /> Limpar</button>
        )}
      </div>
      {marcadoClipe && !clipeEmDesenho && (
        <div ref={formCorteRef} style={{ background: TV.surfaceRaise, borderRadius: 8, padding: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: TV.muted, whiteSpace: 'nowrap', ...mono }}>
              {fmt(inPoint)}–{fmt(outPoint)} · {Math.round(outPoint - inPoint)}s{nDesenhosClipe > 0 ? ` · ${nDesenhosClipe} desenho${nDesenhosClipe === 1 ? '' : 's'}` : ''}
            </span>
            <button type="button" onClick={limparMarcas} title="Limpar o início e o fim" aria-label="Limpar o início e o fim" style={{ ...botaoBarra, padding: '4px 6px' }}><X size={13} /></button>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opcional)…" rows={1}
            style={{ width: '100%', height: 34, background: TV.surface, border: `1px solid ${TV.line}`, borderRadius: 7, color: TV.cream, padding: '7px 8px', fontSize: 12.5, resize: 'none', boxSizing: 'border-box', ...body }} />
          {/* Etiqueta escolhida aqui (17/11): ir a Codificar a meio do corte
              gravava outros tempos. Lado a lado com a análise individual,
              para o painel não crescer. */}
          <div style={{ display: 'grid', gridTemplateColumns: (jogadores || []).length > 0 ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 6, marginTop: 6 }}>
            {seletorEtiquetaCorte()}
            {(jogadores || []).length > 0 && seletorAnaliseInd(false)}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn variant="solid" onClick={() => guardarClipe(pendingTag)} disabled={aGuardarClipe} style={{ padding: '6px 10px', fontSize: 12 }}>
              {aGuardarClipe ? <Loader2 size={13} className="spin" /> : <Check size={13} />} {aGuardarClipe ? 'A gravar…' : (pendingTag ? 'Guardar corte' : 'Guardar sem etiqueta')}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
  const linhaClipe = (c) => {
    const tg = TAGS.find(t => t.id === c.tagId);
    const n = (c.shapes || []).length;
    return (
      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, borderRadius: 9, background: TV.surfaceRaise }}>
        <button type="button" onClick={() => { setEditarClipeAoAbrir(false); setClipeAReproduzir(c); }} style={{
          display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0, textAlign: 'left', padding: 7, borderRadius: 9, cursor: 'pointer', ...body,
          background: 'transparent', border: 'none', color: TV.cream,
        }}>
          <span style={{ width: 70, height: 40, borderRadius: 6, flexShrink: 0, position: 'relative', overflow: 'hidden', background: c.thumbUrl ? `#222 center/cover url(${c.thumbUrl})` : '#222' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: tg ? tg.color : TV.muted }} />
            {!c.thumbUrl && <Film size={14} color={TV.mutedDim} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(c.note || '').trim() || (tg ? tg.label : 'Sem etiqueta')}</span>
            <span style={{ display: 'block', fontSize: 11, color: TV.muted, ...mono }}>{fmt(c.origemInicio)}–{fmt(c.origemFim)} · {Math.round(c.duracao || (c.origemFim - c.origemInicio))}s{n ? ` · ${n} desenho(s)` : ''}</span>
          </span>
        </button>
        {/* Apagar logo daqui, sem abrir o clipe. */}
        <button type="button" onClick={() => removerClipe(c)} title="Apagar clipe" aria-label="Apagar clipe" style={{
          flexShrink: 0, width: 32, height: 32, marginRight: 6, display: 'grid', placeItems: 'center', borderRadius: 7, cursor: 'pointer',
          background: 'transparent', border: `1px solid ${TV.line}`, color: TV.muted,
        }}><Trash2 size={14} /></button>
      </div>
    );
  };

  /* O QUE SE FEZ NOS CORTES TAMBÉM SE VÊ NO JOGO COMPLETO, no momento de
     cada corte, e comporta-se como lá: paragens, zoom do círculo, duração
     (só para ver: muda-se no próprio corte). Não se copia nada, por isso
     não há duas versões do mesmo desenho. */
  const formasDosCortes = React.useMemo(() => (clipeEmDesenho ? [] : clipesDoVideo.flatMap(c => {
    const ini = inicioRealDoCorte(c);
    const fimCorte = typeof c.origemFim === 'number' ? c.origemFim : null;
    return (c.shapes || []).filter(sh => !formaAcidental(sh)).map(sh => {
      const a = (sh.criadoEmTempo ?? 0) + ini;
      const ate = sh.mostrarAte != null ? sh.mostrarAte + ini
        : sh.duracao != null ? a + sh.duracao
        // "sempre visível" dentro do corte = até ao fim do corte no jogo
        : (!temParagem(sh) ? fimCorte : null);
      return { ...sh, id: `corte-${c.id}-${sh.id}`, criadoEmTempo: a, mostrarAte: ate, duracao: undefined, doCorte: true };
    });
  })), [clipesDoVideo, clipeEmDesenho]);
  // Paragens dos desenhos: os do vídeo e os dos cortes.
  const formasComParagem = React.useMemo(() => (formasDosCortes.length ? [...shapes, ...formasDosCortes] : shapes), [shapes, formasDosCortes]);
  const [congeladoEditor, largarParagemEditor] = usePausasDesenho(videoRef, formasComParagem, editandoDuracaoIndex == null && !textoPendente, semParagemNoPlayRef);
  const shapesVisiveis = shapes.filter((sh, i) => visivelNoEditor(sh, i));
  const formasDosCortesVisiveis = formasDosCortes.filter(sh => formaVisivel(sh, current, !playing, congeladoEditor));
  const tubosDosCortes = React.useMemo(() => (clipeEmDesenho ? [] : clipesDoVideo
    .filter(c => c.trajetoriaFoco && Array.isArray(c.trajetoriaFoco.pontos) && c.trajetoriaFoco.pontos.length)
    .map(c => ({ id: c.id, cor: c.trajetoriaFoco.cor, pontos: c.trajetoriaFoco.pontos.map(pt => ({ ...pt, t: pt.t + inicioRealDoCorte(c) })) }))), [clipesDoVideo, clipeEmDesenho]);
  /* Cortes antigos (sem `origemInicioReal`) com desenhos ou seguimento:
     mede-se uma vez, no servidor, onde começam de facto, e guarda-se. */
  const cortesMedidosRef = useRef(new Set());
  useEffect(() => {
    if (!originalAtivo || !originalAtivo.storagePath || clipeEmDesenho) return;
    const porMedir = clipesDoVideo.filter(c => typeof c.origemInicioReal !== 'number' && typeof c.origemInicio === 'number'
      && !cortesMedidosRef.current.has(c.id)
      && ((c.shapes || []).length || (c.trajetoriaFoco && (c.trajetoriaFoco.pontos || []).length)));
    if (!porMedir.length) return;
    porMedir.forEach(c => cortesMedidosRef.current.add(c.id));
    (async () => {
      for (const c of porMedir) {
        try {
          const resp = await fetch('/api/cortar-clipe', {
            method: 'POST', headers: await cabecalhosComSessao(),
            body: JSON.stringify({ teamId, storagePath: originalAtivo.storagePath, start: c.origemInicio, medir: true }),
          });
          const json = await resp.json().catch(() => ({}));
          if (resp.ok && typeof json.inicioReal === 'number') {
            setClipes(prev => prev.map(x => (x.id === c.id ? { ...x, origemInicioReal: json.inicioReal } : x)));
          }
        } catch (e) { /* fica com o tempo marcado; tenta-se noutra sessão */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalAtivo && originalAtivo.id, clipesDoVideo.length, clipeEmDesenho]);
  // A ver (fora do desenho), o círculo com zoom aproxima a imagem, como no
  // clipe final. A desenhar, escolher o zoom de um círculo mostra-o logo
  // uns segundos (pré-visualização).
  const formaZoomPrevia = zoomPrevia ? shapes.find(sh => sh.id === zoomPrevia) : null;
  const estiloZoomEditor = useZoomCirculo(
    formaZoomPrevia ? [formaZoomPrevia] : formasParaZoom(formasDosCortesVisiveis.length ? [...shapesVisiveis, ...formasDosCortesVisiveis] : shapesVisiveis, congeladoEditor),
    // Também a desenhar quando o vídeo para sozinho num item (a ver como
    // ficou): o zoom tem de aparecer igual ao da reprodução final.
    !!formaZoomPrevia || !modoDesenho || !!congeladoEditor,
    retEditor,
  );

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files[0];
          if (f) { setFicheiroPendente(f); setNomeVideoInput(f.name.replace(/\.[^.]+$/, '')); }
          e.target.value = '';
        }} />

      {(erro || uploadVideoEstado?.erro) && <div style={{ background: T.surfaceRaise, border: `1px solid ${T.bad}`, borderRadius: 8, padding: 10, marginBottom: 12, color: T.cream, fontSize: 13 }}>{erro || uploadVideoEstado.erro}</div>}

      {/* Vídeos originais carregados — caixas retangulares com pré-visualização,
         só visíveis quando não há nenhum aberto (para não ocupar espaço por
         cima do leitor). Com um vídeo aberto, mostra-se só uma barra fina
         com "Voltar", sempre à vista sem ser preciso subir a página. */}
      {!originalAtivo && semRegistoVisiveis.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.warn}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12, ...body }}>
          <div style={{ fontSize: 13, color: T.cream, marginBottom: 8 }}>
            {semRegistoVisiveis.length === 1 ? 'Há 1 vídeo que foi enviado mas não aparece na lista.' : `Há ${semRegistoVisiveis.length} vídeos que foram enviados mas não aparecem na lista.`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {semRegistoVisiveis.map(o => (
              <div key={o.caminho} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</span>
                <span style={{ fontSize: 11.5, color: T.mutedDim }}>
                  {[o.tamanho ? `${(o.tamanho / 1e9).toFixed(2).replace('.', ',')} GB` : '', o.criado ? new Date(o.criado).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''].filter(Boolean).join(' · ')}
                </span>
                <Btn variant="solid" onClick={() => recuperarOriginal(o.caminho, o.titulo, o.tamanho)}><Upload size={13} /> Recuperar</Btn>
                <Btn variant="ghost" onClick={() => ignorarSemRegisto(o.caminho)} title="Deixar de mostrar este aviso (o ficheiro fica no Supabase)">Ignorar</Btn>
                <Btn variant="ghost" onClick={() => apagarSemRegisto(o)} title="Apagar o ficheiro do Supabase de vez" style={{ color: T.bad }}><X size={13} /> Apagar</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      {!originalAtivo ? (
        <>
        {/* AS DUAS FORMAS DE TRABALHAR: um comutador único, com o realce a
            deslizar de um lado para o outro. Altura fixa: mudar de modo não
            mexe em nada na página. */}
        {temLinks && (
          <div role="tablist" aria-label="Forma de trabalhar" style={{
            position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: 14, height: 60,
            borderRadius: 16, border: `1px solid ${T.line}`, background: T.surface, padding: 4, boxSizing: 'border-box', overflow: 'hidden',
          }}>
            <span aria-hidden style={{
              position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)', borderRadius: 12,
              background: T.surfaceRaise, boxShadow: `0 0 0 1px ${T.gold} inset, 0 6px 18px rgba(0,0,0,.25)`,
              transform: modoEfetivo === 'links' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .28s cubic-bezier(.4,.1,.2,1)',
            }} />
            {[
              { id: 'estudio', titulo: 'Ficheiros', Icon: Film, n: videosOriginais.length },
              { id: 'links', titulo: 'Links', Icon: Link2, n: (jogosLink || []).length },
            ].map(m => {
              const on = modoEfetivo === m.id;
              return (
                <button key={m.id} type="button" role="tab" aria-selected={on}
                  onClick={() => { if (!on) { setModo(m.id); setVerTodosOriginais(false); setLinkAberto(null); } }}
                  style={{
                    position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', minWidth: 0,
                    background: 'transparent', border: 'none', cursor: on ? 'default' : 'pointer', textAlign: 'left', ...body, color: T.cream,
                  }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? T.gold : T.bg, color: on ? TEXT_ON_ACCENT : T.muted, transition: 'background .28s, color .28s' }}>
                    <m.Icon size={19} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: on ? T.cream : T.muted, transition: 'color .28s' }}>{m.titulo}</span>
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: on ? T.gold : T.mutedDim, flexShrink: 0, fontVariantNumeric: 'tabular-nums', transition: 'color .28s' }}>{m.n}</span>
                </button>
              );
            })}
          </div>
        )}
        {/* O PALCO: a mesma altura nos dois modos (duas filas de cartões e
            a linha do "Ver mais", sempre reservadas). Só o conteúdo troca,
            com um esbater rápido. Um jogo por link abre aqui mesmo, no
            lugar da grelha (como o Estúdio abre o editor). */}
        <style>{'@keyframes mjpPalco{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'}</style>
        {modoEfetivo === 'links' && linkAberto ? (
          /* A mesma cabeça do editor dos ficheiros (Estúdio). */
          <div ref={cabecaLinkRef} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap', scrollMarginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setLinkAberto(null)}><ArrowLeft size={14} /> Vídeos e clipes</Btn>
            <span style={{ fontSize: 12.5, color: T.muted, ...body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {((jogosLink || []).concat(cortesLink || []).find(x => x.id === linkAberto) || {}).title || ''}
            </span>
            {criarJogoLink && (
              <Btn variant="ghost" onClick={() => setColarLinkAberto(true)} style={{ marginLeft: 'auto' }}><Link2 size={14} /> Colar link</Btn>
            )}
          </div>
        ) : (
        <div key={modoEfetivo} style={{ animation: 'mjpPalco .22s ease' }}>
        {/* Grelha a toda a largura (as colunas esticam até à margem dos cartões
            Ficheiros | Links); fechada, só uma fila. */}
        <div ref={grelhaOriginaisRef} style={{ display: 'grid', gridTemplateColumns: `repeat(${porLinhaOriginais}, minmax(0, 1fr))`, alignContent: 'start', gap: 10, marginBottom: 10, minHeight: temLinks ? ALTURA_GRELHA_JOGOS : undefined }}>
          {(verTodosOriginais ? grelhaJogos : grelhaJogos.slice(0, Math.max(0, porLinhaOriginais - 1))).map(({ tipo, v }) => (tipo === 'link' ? cartaoLink(v) : (
            <div key={v.id} style={{ position: 'relative', minWidth: 0 }}>
            <button type="button" onClick={() => { if (v.ficheiroApagado) return; setOriginalAtivoId(v.id); limparMarcas(); }}
              title={v.ficheiroApagado ? 'O jogo completo já foi apagado. Os cortes e clipes ficaram guardados.' : (v.titulo || undefined)}
              style={{
                display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, height: ALTURA_CARTAO_JOGO, boxSizing: 'border-box', textAlign: 'left', cursor: v.ficheiroApagado ? 'default' : 'pointer', padding: 0, ...body, overflow: 'hidden',
                borderRadius: 10, border: `1px solid ${v.id === originalAtivoId ? T.crimsonBright : T.line}`,
                background: v.id === originalAtivoId ? T.surfaceRaise : T.surface,
              }}>
              <div style={{ position: 'relative', width: '100%', height: ALTURA_MINIATURA_JOGO, flexShrink: 0, background: T.surfaceRaise }}>
                {v.thumbUrl ? (
                  <img src={v.thumbUrl} alt="" decoding="sync" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(v.ficheiroApagado ? { opacity: 0.35, filter: 'grayscale(1)' } : {}) }} />
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
              <div style={{ padding: `8px ${LARGURA_ICONES_JOGO}px 8px 10px`, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  <div style={estiloNome2Linhas}>{v.titulo}</div>
                )}
                {/* Informação (as ações ficam na coluna à direita). */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 16 }}>
                  {v.ficheiroApagado ? (
                    <span style={{ fontSize: 11, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      {v.recusadoQuota ? 'Não carregado (limite)' : 'Jogo completo apagado'}
                    </span>
                  ) : v.pronto === false ? (
                    <span title={v.destinoPendente ? `Quando estiver pronto vai para: ${v.destinoPendente.rotulo || 'Sala de Vídeo'}` : undefined} style={{ fontSize: 11, color: T.warn, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      A preparar…{v.destinoPendente ? ` → ${v.destinoPendente.rotulo || 'Sala'}` : ''}
                    </span>
                  ) : v.destinoPendenteErro && !(v.enviadoSala || []).length ? (
                    <span title={v.destinoPendenteErro} style={{ fontSize: 11, color: T.bad, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Não foi para a Sala · usa o botão</span>
                  ) : (v.enviadoSala || []).length ? (
                    <span title={(v.enviadoSala || []).map(e => e.rotulo).join('; ')} style={{ fontSize: 11, color: T.gold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      {/* Onde está: "Jogos › J10 · …" ou "Adversários › …". */}
                      {(v.enviadoSala || [])[(v.enviadoSala || []).length - 1].rotulo || 'No Canal'}
                    </span>
                  ) : <span style={{ fontSize: 11, color: T.mutedDim }}>Pronto</span>}
                </div>
                {linhaRetencao(v)}
              </div>
            </button>
            {/* Ações diretas, em coluna à direita do texto. */}
            {iconesNoCorpo([
              !v.ficheiroApagado && [Pencil, 'Mudar o nome', () => { setNomeEditado(v.titulo); setEditandoNomeId(v.id); }],
              enviarJogoFicheiroParaCanal && v.pronto !== false && !v.ficheiroApagado && [(v.enviadoSala || []).length ? Check : Tv, (v.enviadoSala || []).length ? 'Na Sala de Vídeo (enviar ou retirar)' : 'Enviar para a Sala de Vídeo (e Portal)', () => setJogoParaCanal({ tipo: 'ficheiro', v }), (v.enviadoSala || []).length ? '#7fe0a0' : undefined],
              [X, v.ficheiroApagado ? 'Tirar o registo' : 'Apagar', () => apagarOriginal(v), '#ff8a8a'],
            ], { topo: ALTURA_MINIATURA_JOGO + 5, esticar: true })}
            </div>
          )))}
          {/* CARTÃO DE ADICIONAR, conforme a forma de trabalhar: no Estúdio
              carrega um ficheiro (com o progresso), em Links cola um link. */}
          {modoEfetivo === 'links' ? (
            <button type="button" onClick={() => setColarLinkAberto(true)}
              style={{
                width: '100%', minWidth: 0, height: ALTURA_CARTAO_JOGO, boxSizing: 'border-box', borderRadius: 10, border: `1px dashed ${T.line}`, background: 'transparent', color: T.muted, ...body,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', fontSize: 12,
              }}>
              <Link2 size={16} />
              Colar link
            </button>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadVideoEstado?.ativo}
              style={{
                width: '100%', minWidth: 0, height: ALTURA_CARTAO_JOGO, boxSizing: 'border-box', borderRadius: 10, border: `1px dashed ${T.line}`, background: 'transparent', color: T.muted, ...body,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: uploadVideoEstado?.ativo ? 'default' : 'pointer', fontSize: 12,
              }}>
              {uploadVideoEstado?.ativo ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              {uploadVideoEstado?.ativo ? (uploadVideoEstado.finalizando ? 'A finalizar…' : `A carregar… ${uploadVideoEstado.progresso}%`) : 'Carregar ficheiro'}
              <span title="Espaço dos jogos inteiros da equipa. Os cortes e clipes não contam."
                style={{ fontSize: 10.5, color: espacoUsado >= quotaJogosBytes ? T.bad : espacoUsado >= quotaJogosBytes * 0.8 ? T.warn : T.mutedDim }}>
                {formatarGB(espacoUsado)} de {formatarGB(quotaJogosBytes)}
              </span>
            </button>
          )}
        </div>
        {grelhaJogos.length > porLinhaOriginais - 1 ? (
          <button onClick={() => setVerTodosOriginais(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: '0', height: 24, marginBottom: 6, ...body }}>
            {verTodosOriginais
              ? <><ChevronUp size={14} /> Ver menos</>
              : <><ChevronDown size={14} /> Ver mais ({grelhaJogos.length - (porLinhaOriginais - 1)})</>}
          </button>
        ) : <div style={{ height: 24, marginBottom: 6 }} />}
        {/* AVISO DOS 90 DIAS (Estúdio) e nota dos links: sempre a mesma
            altura (duas linhas no telemóvel), para a página não mexer. */}
        {modoEfetivo === 'links' ? (
          <div style={{ minHeight: 34, lineHeight: '17px', marginBottom: 6, fontSize: 12, color: T.mutedDim, ...body }}>
            {(jogosLink || []).length === 0 ? 'Cola o link do YouTube de um jogo para fazeres cortes e desenhos sem carregar nada.' : 'Os links do YouTube ficam sempre e não ocupam espaço.'}
          </div>
        ) : (
          <div style={{ minHeight: 34, lineHeight: '17px', marginBottom: 6, fontSize: 12, color: aApagarEmBreve.length ? T.warn : T.mutedDim, ...body }}>
            {aApagarEmBreve.length
              ? `${aApagarEmBreve.length === 1 ? '1 jogo completo vai ser apagado' : `${aApagarEmBreve.length} jogos completos vão ser apagados`} nos próximos ${DIAS_AVISO} dias. Os cortes e clipes ficam. Corta o que ainda queres guardar.`
              : videosOriginais.length === 0
                ? 'Carrega o vídeo de um jogo ou treino para começares a marcar cortes. Os jogos completos ficam 90 dias.'
                : 'Os jogos completos ficam 90 dias. Os cortes e clipes ficam sempre.'}
          </div>
        )}
        </div>
        )}
        </>
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

      {!originalAtivo && !temLinks && modoEfetivo === 'estudio' && videosOriginais.length === 0 && (
        <div style={{ color: T.mutedDim, fontSize: 13, padding: '30px 0', textAlign: 'center' }}>
          Carrega o vídeo de um jogo ou treino para começares a marcar cortes.
        </div>
      )}

      {originalAtivo && (
        <BancadaVideo.Provider value={true}>
        {/* ESTÚDIO DE ANÁLISE — à esquerda o vídeo (a maior parte do ecrã),
            com a barra e a linha do tempo do jogo por baixo; à direita um
            painel com três separadores: Codificar, Desenhar e Clipes. */}
        <div ref={containerRef} style={{
          position: 'relative',
          background: TV.surface, borderRadius: fullscreen ? 0 : 12, border: `1px solid ${TV.line}`, overflow: 'hidden',
          display: 'flex', flexDirection: estreitoBancada ? 'column' : 'row',
          height: fullscreen ? '100vh' : (estreitoBancada ? 'auto' : (alturaEditor ? alturaEditor : 'calc(100vh - 120px)')),
          minHeight: estreitoBancada || fullscreen ? undefined : ALTURA_MIN_EDITOR,
        }}>
          <style>{'.mjp-sem-scroll::-webkit-scrollbar{display:none}'}</style>

          {/* ===== ESQUERDA: vídeo + barra + linha do tempo ===== */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#000' }}>
            <div style={{
              position: 'relative', display: 'flex', minHeight: 0,
              flex: estreitoBancada && !fullscreen ? 'none' : 1,
              height: estreitoBancada && !fullscreen ? 'min(58vw, 60vh)' : undefined,
            }}>
            <div ref={canvasWrapRef} style={{ position: 'relative', background: '#000', flex: 1, minHeight: 0, width: '100%', touchAction: modoDesenho ? 'none' : 'auto', transition: 'width 0.2s ease', boxSizing: 'border-box', overflow: 'hidden' }}
              onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerLeave={endDraw} onPointerCancel={endDraw}>
              {/* Vídeo + desenho juntos numa caixa: é ela que se aproxima no zoom do círculo. */}
              {/* (Sem a margem de 18px à direita em ecrã inteiro — era a barra preta;
                 servia quando a coluna da direita desaparecia em ecrã inteiro.) */}
              <div style={{ position: 'absolute', inset: 0, ...estiloZoomEditor }}>
              {!clipeEmDesenho && originalAtivo?.pronto === false && !abrirSemEsperar.has(originalAtivo.id) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: TV.muted, gap: 10, textAlign: 'center', padding: 20 }}>
                  <Loader2 size={20} className="spin" />
                  <span style={{ fontSize: 12.5, ...body, maxWidth: 460, lineHeight: 1.5 }}>
                    A preparar o vídeo…
                  </span>
                  <button type="button"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setAbrirSemEsperar(prev => new Set(prev).add(originalAtivo.id)); }}
                    style={{ marginTop: 4, background: 'none', border: `1px solid ${TV.muted}`, color: '#fff', borderRadius: 16, padding: '6px 14px', cursor: 'pointer', fontSize: 12.5, ...body }}>
                    Abrir já
                  </button>
                </div>
              ) : urlEditor ? (
                <>
                  {ytEditor ? (
                    <YoutubeComoVideo youtubeId={ytEditor.id} inicio={ytEditor.inicio} fim={ytEditor.fim} videoRef={videoRef}
                      onLoadStart={() => setVideoPronto(false)} onCanPlay={() => setVideoPronto(true)} />
                  ) : (
                  <video ref={videoRef} src={urlEditor} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} playsInline
                    onLoadStart={() => setVideoPronto(false)} onCanPlay={() => setVideoPronto(true)} />
                  )}
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
              <svg ref={svgDesenhoRef} viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ ...estiloSobreImagem(retEditor), overflow: 'visible', pointerEvents: modoDesenho ? 'auto' : 'none', cursor: modoDesenho ? (tool === 'apagar' ? CURSOR_BORRACHA : hoverMove ? 'move' : 'crosshair') : 'default' }}>
                {shapesVisiveis.map(renderShape)}
                {formasDosCortesVisiveis.length > 0 && <g style={{ pointerEvents: 'none' }}>{formasDosCortesVisiveis.map((sh, i) => renderShape(sh, `c${i}`))}</g>}
                {tubosDosCortes.map(tb => <MarcadorTrajetoria key={tb.id} videoRef={videoRef} pontos={tb.pontos} cor={tb.cor} />)}
                {trajetoriaFocoPendente && <MarcadorTrajetoria videoRef={videoRef} pontos={trajetoriaFocoPendente.pontos} cor={trajetoriaFocoPendente.cor} />}
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
                {editandoDuracaoIndex != null && shapes[editandoDuracaoIndex] && ['seta', 'linha', 'circulo', 'cone', 'tubo', 'zonalivre', 'linhaPontos', 'medida'].includes(shapes[editandoDuracaoIndex].tool) &&
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
                    {trajetoriaFocoPendente ? 'Toca no jogador, neste momento: o seguimento continua daqui' : 'Toca no jogador que queres seguir'}
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
                    ref={el => { if (el && document.activeElement !== el) setTimeout(() => { if (document.activeElement !== el) el.focus(); }, 0); }}
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }} title="Ao reproduzir, o vídeo pára neste momento e o item fica estes segundos no ecrã">
                    <span style={{ fontSize: 12, color: '#fff', ...body }}>Vídeo parado:</span>
                    {[1, 2, 3, 5, 8, 10].map(sg => {
                      const on = temParagem(shapes[editandoDuracaoIndex]) && segDe(shapes[editandoDuracaoIndex]) === sg;
                      return (
                        <button key={sg} type="button" onClick={() => mudarSegShape(sg)} style={{
                          background: on ? TV.gold : 'none', color: on ? '#111' : '#fff', border: `1px solid ${on ? TV.gold : TV.line}`,
                          borderRadius: 4, padding: '2px 7px', fontSize: 11.5, cursor: 'pointer', ...mono,
                        }}>{sg}s</button>
                      );
                    })}
                    <button type="button" onClick={() => mudarSegShape(null)} title="Sem parar o vídeo: o item acompanha o vídeo a andar" style={{
                      background: !temParagem(shapes[editandoDuracaoIndex]) ? TV.gold : 'none', color: !temParagem(shapes[editandoDuracaoIndex]) ? '#111' : '#fff',
                      border: `1px solid ${!temParagem(shapes[editandoDuracaoIndex]) ? TV.gold : TV.line}`,
                      borderRadius: 4, padding: '2px 7px', fontSize: 11.5, cursor: 'pointer', ...body,
                    }}>Sem parar</button>
                  </span>
                  {!temParagem(shapes[editandoDuracaoIndex]) && (
                    <>
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
                    </>
                  )}
                  <Btn variant="solid" onClick={() => setEditandoDuracaoIndex(null)} style={{ padding: '5px 10px', fontSize: 12 }}><Check size={13} /> Feito</Btn>
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

              {/* Avisos por cima do vídeo (não apanham toques). */}
              <div style={{ position: 'absolute', left: 10, top: 10, display: 'flex', gap: 6, flexWrap: 'wrap', pointerEvents: 'none', zIndex: 7, maxWidth: '70%' }}>
                {congeladoEditor && (
                  <span style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 11.5, ...body }}>
                    {congeladoEditor.lento ? 'Câmara lenta' : 'Vídeo parado'} · {Math.max(0, Math.ceil(congeladoEditor.total - congeladoEditor.dec))}s
                  </span>
                )}
                {gravacoesCodif.map(g => (
                  <span key={g.id} style={{ background: 'rgba(0,0,0,0.65)', border: `1px solid ${g.cor}`, color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6, ...body }}>
                    <Loader2 size={11} className="spin" /> A gravar · {g.label}
                  </span>
                ))}
                {avisoCodif && !gravacoesCodif.length && (
                  <span style={{ background: 'rgba(0,0,0,0.65)', border: `1px solid ${avisoCodif.cor}`, color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6, ...body }}>
                    <Check size={12} color={avisoCodif.cor} /> {avisoCodif.texto}
                  </span>
                )}
              </div>
            </div>

            {/* Barra de reprodução */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 2px', background: TV.surface, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => saltarVideo(-10)} title="Recuar 10 s" style={botaoBarra}><SkipBack size={14} /> 10s</button>
              <button type="button" onClick={togglePlay} title={playing ? 'Pausa' : 'Reproduzir'} style={{ ...botaoBarra, background: TV.gold, borderColor: TV.gold, color: '#111', padding: '6px 14px' }}>
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button type="button" onClick={() => saltarVideo(10)} title="Avançar 10 s" style={botaoBarra}>10s <SkipForward size={14} /></button>
              <span style={{ fontSize: 12, color: TV.muted, ...mono, marginLeft: 6 }}>{fmt(current)} <span style={{ color: TV.mutedDim }}>/ {fmt(duration)}</span></span>
              <span style={{ flex: 1 }} />
              {[0.5, 1, 2].map(v => (
                <button key={v} type="button" onClick={() => mudarVelocidade(v)} style={{ ...botaoBarra, ...(velocidade === v ? { borderColor: TV.gold, color: TV.gold } : {}) }}>
                  {String(v).replace('.', ',')}×
                </button>
              ))}
              <button type="button" onClick={alternarEcraInteiro} title="Ecrã inteiro" style={botaoBarra}>
                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>

            {/* LINHA DO TEMPO do jogo: barra, clipes (na cor da etiqueta) e
                paragens dos desenhos (losangos). Toca para lá ir. */}
            <div style={{ padding: '2px 12px 10px', background: TV.surface, userSelect: 'none' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative', height: 14, ...mono, fontSize: 9.5, color: TV.mutedDim }}>
                  {marcasMinutos.map(m => (
                    <span key={m} style={{ position: 'absolute', left: `${pct(m * 60)}%`, transform: 'translateX(-1px)' }}>{m}'</span>
                  ))}
                </div>
                <div onPointerDown={startScrub} onPointerMove={dragScrub} onPointerUp={endScrub} onPointerCancel={endScrub}
                  style={{ height: 22, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', touchAction: 'none' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: TV.line, borderRadius: 3 }} />
                  <div style={{ position: 'absolute', left: 0, width: `${pct(current)}%`, height: 6, background: TV.gold, borderRadius: 3 }} />
                  {inPoint != null && <div style={{ position: 'absolute', left: `${pct(inPoint)}%`, top: 2, width: 2, height: 18, background: TV.good }} />}
                  {outPoint != null && <div style={{ position: 'absolute', left: `${pct(outPoint)}%`, top: 2, width: 2, height: 18, background: TV.bad }} />}
                  <div style={{ position: 'absolute', left: `${pct(current)}%`, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: TV.gold, border: `2px solid ${TV.cream}` }} />
                </div>
                {[
                  ['Clipes', (
                    <>
                      {inPoint != null && outPoint != null && outPoint > inPoint && (
                        <div style={{ position: 'absolute', left: `${pct(inPoint)}%`, width: `${Math.max(0.4, pct(outPoint) - pct(inPoint))}%`, top: 3, bottom: 3, border: `1px dashed ${TV.cream}`, borderRadius: 3 }} />
                      )}
                      {!clipeEmDesenho && clipesDoVideo.map(c => {
                        const tg = TAGS.find(t => t.id === c.tagId);
                        return (
                          <button key={c.id} type="button" title={`${tg ? tg.label : 'Sem etiqueta'} · ${fmt(c.origemInicio)}–${fmt(c.origemFim)}`}
                            onClick={() => irParaTempo(c.origemInicio)}
                            style={{ position: 'absolute', left: `${pct(c.origemInicio)}%`, width: `${Math.max(0.5, pct(c.origemFim) - pct(c.origemInicio))}%`, minWidth: 6, top: 3, bottom: 3, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer', background: tg ? tg.color : TV.muted }} />
                        );
                      })}
                    </>
                  )],
                  ['Desenhos', paragensDoVideo.map(g => (
                    <button key={g.t} type="button" title={`${fmt(g.t)} · ${g.formas.length} ${g.formas.length === 1 ? 'item' : 'itens'}`}
                      onClick={() => irParaTempo(g.t)}
                      style={{ position: 'absolute', left: `${pct(g.t)}%`, top: '50%', width: 10, height: 10, transform: 'translate(-50%, -50%) rotate(45deg)', background: Math.abs(current - g.t) < 0.4 ? TV.gold : '#fff', border: 'none', padding: 0, cursor: 'pointer', borderRadius: 1 }} />
                  ))],
                ].map(([rotulo, conteudo]) => (
                  <div key={rotulo} style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 9.5, color: TV.mutedDim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2, ...body }}>{rotulo}</div>
                    <div style={{ position: 'relative', height: 18, background: TV.surfaceRaise, borderRadius: 4 }}>{conteudo}</div>
                  </div>
                ))}
                {/* Linha do instante atual, por cima das faixas. */}
                <div style={{ position: 'absolute', left: `${pct(current)}%`, top: 24, bottom: 0, width: 2, background: 'rgba(255,255,255,0.75)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          {/* ===== DIREITA: painel com separadores ===== */}
          <div style={{
            // No telemóvel o painel tem altura fixa: trocar de separador não muda a altura da página.
            width: estreitoBancada ? '100%' : 310, flexShrink: 0, minHeight: 0, height: estreitoBancada ? 560 : undefined, display: 'flex', flexDirection: 'column',
            borderLeft: estreitoBancada ? 'none' : `1px solid ${TV.line}`, borderTop: estreitoBancada ? `1px solid ${TV.line}` : 'none', background: TV.surface,
          }}>
            <div role="tablist" style={{ display: clipeEmDesenho ? 'none' : 'flex', gap: 4, padding: 10, borderBottom: `1px solid ${TV.line}`, flexShrink: 0 }}>
              {[['codificar', 'Codificar'], ['desenhar', 'Desenhar'], ['clipes', `Clipes · ${clipesDoVideo.length}`]].map(([id, rotulo]) => {
                const on = abaAtiva === id;
                return (
                  <button key={id} role="tab" aria-selected={on} type="button" onClick={() => irParaAba(id)} style={{
                    flex: 1, padding: '8px 6px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, ...body,
                    background: on ? TV.surfaceRaise : 'transparent', color: on ? TV.cream : TV.muted,
                    boxShadow: on ? `inset 0 -2px 0 ${TV.gold}` : 'none',
                  }}>{rotulo}</button>
                );
              })}
            </div>
            <div className="mjp-sem-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, scrollbarWidth: 'none' }}>
              {erro && <div style={{ background: TV.surfaceRaise, border: `1px solid ${TV.bad}`, borderRadius: 7, padding: 9, marginBottom: 10, color: TV.cream, fontSize: 12.5 }}>{erro}</div>}
              {erroSeguirFoco && <div style={{ background: TV.surfaceRaise, border: `1px solid ${TV.bad}`, borderRadius: 7, padding: 9, marginBottom: 10, color: TV.cream, fontSize: 12.5 }}>{erroSeguirFoco}</div>}

              {abaAtiva === 'codificar' && (
                <>
                  {originalAtivo && (() => {
                    const eqs = equipasDoAtivo;
                    const alvo = equipaDosCortes && !ehNossaEquipa(equipaDosCortes, nomeNossaEquipa) ? equipaDosCortes : '';
                    const semEquipa = clipesDoVideo.filter(c => !c.equipa);
                    const chip = (nome, i) => {
                      const on = nome ? equipaDosCortes === nome : !equipaDosCortes;
                      const nossa = nome && ehNossaEquipa(nome, nomeNossaEquipa);
                      const texto = nome || (i < 2 ? `Equipa ${i === 0 ? 'A' : 'B'}` : 'Nenhuma');
                      return (
                        <button key={i} type="button" disabled={aGarantirFicha}
                          onClick={() => (i < 2 && !nome ? setEditarEquipas(true) : escolherEquipaCortes(nome))}
                          title={i < 2 && !nome ? 'Escrever as equipas do jogo' : (nossa ? 'A nossa equipa: os cortes ficam só aqui' : (nome ? `Cortes para a ficha de ${nome}` : 'Os cortes ficam só na Análise'))}
                          style={{
                            padding: '5px 4px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', ...body,
                            overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center',
                            border: `1px solid ${on ? TV.gold : TV.line}`, background: on ? `${TV.gold}26` : 'transparent',
                            color: on ? TV.gold : (i < 2 && !nome ? TV.mutedDim : TV.cream),
                          }}>{texto}{nossa ? ' (nós)' : ''}</button>
                      );
                    };
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                          {tituloSecao('Equipa da ação · vai para a ficha')}
                          <button type="button" onClick={() => setEditarEquipas(true)} title="Equipas do jogo" style={{ background: 'none', border: 'none', color: TV.gold, cursor: 'pointer', padding: 0, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, ...body }}>
                            <Pencil size={11} /> Equipas
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 5 }}>
                          {chip(eqs[0] || '', 0)}{chip(eqs[1] || '', 1)}{chip('', 2)}
                        </div>
                        {/* Altura fixa: o texto muda e nada à volta se mexe. */}
                        <div style={{ height: 16, marginTop: 5, fontSize: 11, color: TV.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...body }}>
                          {aGarantirFicha ? 'A preparar a ficha do adversário…'
                            : alvo
                              ? (semEquipa.length
                                ? <button type="button" onClick={() => { const ids = new Set(semEquipa.map(c => c.id)); setClipes(prev => prev.map(c => (ids.has(c.id) ? { ...c, equipa: alvo, envioFicha: null } : c))); }}
                                  style={{ background: 'none', border: 'none', color: TV.gold, cursor: 'pointer', padding: 0, fontSize: 11, ...body }}>
                                  Enviar {semEquipa.length === 1 ? 'o corte' : `os ${semEquipa.length} cortes`} já feitos para {alvo}
                                </button>
                                : <>Os cortes vão para a ficha de <b style={{ color: TV.cream }}>{alvo}</b>.</>)
                              : (equipaDosCortes ? 'A nossa equipa: os cortes ficam só aqui.' : 'Os cortes ficam só na Análise de Vídeo.')}
                        </div>
                      </div>
                    );
                  })()}
                  {(jogadores || []).length > 0 && <div style={{ marginBottom: 12 }}>{seletorAnaliseInd(false)}</div>}
                  {tituloSecao('Codificar · um toque cria o clipe')}
                  {GRUPOS_CODIFICAR.map(g => (
                    <div key={g.titulo} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: TV.mutedDim, letterSpacing: 0.5, textTransform: 'uppercase', margin: '4px 0 6px', ...body }}>{g.titulo}</div>
                      {/* Todas com a mesma largura, em duas colunas alinhadas. */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5 }}>
                        {g.ids.map(id => TAGS.find(t => t.id === id)).filter(Boolean).map(tag => (
                          <button key={tag.id} type="button" onClick={() => codificar(tag.id)}
                            title={marcadoClipe ? `Gravar ${fmt(inPoint)}–${fmt(outPoint)} como ${tag.label}` : `Gravar ${temposDe(tag.id).antes}s antes e ${temposDe(tag.id).depois}s depois deste instante`}
                            style={{
                              padding: '5px 3px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', ...body,
                              border: `1px solid ${tag.color}`, background: 'transparent', color: tag.color,
                              width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                            {tag.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, color: TV.muted, margin: '2px 0 4px', lineHeight: 1.5, ...body }}>
                    {marcadoClipe
                      ? <>Com início e fim marcados, a etiqueta grava <b style={{ color: TV.cream }}>{fmt(inPoint)}–{fmt(outPoint)}</b>.</>
                      : <>Grava <b style={{ color: TV.cream }}>{TEMPOS_CODIFICAR_PADRAO.antes}s antes</b> e <b style={{ color: TV.cream }}>{TEMPOS_CODIFICAR_PADRAO.depois}s depois</b> do instante (ou os tempos de cada etiqueta). </>}
                    <button type="button" onClick={() => setVerTemposCodif(v => !v)} style={{ background: 'none', border: 'none', color: TV.gold, cursor: 'pointer', padding: 0, fontSize: 11.5, ...body }}>
                      {verTemposCodif ? 'Fechar tempos' : 'Ajustar tempos'}
                    </button>
                  </div>
                  {verTemposCodif && (
                    <div style={{ background: TV.surfaceRaise, borderRadius: 8, padding: 8, margin: '4px 0 8px' }}>
                      {GRUPOS_CODIFICAR.flatMap(g => g.ids).map(id => TAGS.find(t => t.id === id)).filter(Boolean).map(tag => {
                        const tp = temposDe(tag.id);
                        const passo = (campo, d) => (
                          <button type="button" onClick={() => mudarTempoCodif(tag.id, campo, d)} style={{ background: 'none', border: `1px solid ${TV.line}`, borderRadius: 4, color: TV.cream, width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>{d < 0 ? '−' : '+'}</button>
                        );
                        return (
                          <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0', fontSize: 11.5, ...body }}>
                            <span style={{ flex: 1, minWidth: 0, color: tag.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tag.label}</span>
                            <span style={{ color: TV.mutedDim }}>antes</span>{passo('antes', -1)}<span style={{ ...mono, color: TV.cream, width: 26, textAlign: 'center' }}>{tp.antes}s</span>{passo('antes', 1)}
                            <span style={{ color: TV.mutedDim, marginLeft: 4 }}>depois</span>{passo('depois', -1)}<span style={{ ...mono, color: TV.cream, width: 26, textAlign: 'center' }}>{tp.depois}s</span>{passo('depois', 1)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {corteAMao()}
                  {tituloSecao('Últimos clipes deste vídeo', 14)}
                  {clipesDoVideo.length === 0
                    ? <div style={{ fontSize: 12, color: TV.mutedDim, ...body }}>Ainda sem clipes neste vídeo.</div>
                    : [...clipesDoVideo].sort((a, b) => (new Date(b.criadoEm || 0).getTime() || 0) - (new Date(a.criadoEm || 0).getTime() || 0)).slice(0, 5).map(linhaClipe)}
                </>
              )}

              {abaAtiva === 'desenhar' && (
                <>
                  {clipeEmDesenho && (
                    <div style={{ background: TV.surfaceRaise, border: `1px solid ${TV.gold}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: TV.cream, marginBottom: 8, ...body }}>A desenhar no corte {typeof clipeEmDesenho.origemInicio === 'number' ? `${fmt(clipeEmDesenho.origemInicio)}–${fmt(clipeEmDesenho.origemFim)}` : ''} (só neste corte)</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn variant="solid" onClick={guardarDesenhosClipe} style={{ padding: '6px 10px', fontSize: 12 }}><Check size={13} /> Guardar no clipe</Btn>
                        <Btn variant="plain" onClick={cancelarDesenhosClipe} style={{ padding: '6px 10px', fontSize: 12 }}><X size={13} /> Cancelar</Btn>
                      </div>
                    </div>
                  )}
                  {tituloSecao('Ferramentas')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                    {/* Ficheiros: o tubo vem do Seguir. Links (YouTube): não há Seguir (não dá para ler a imagem), há o Tubo à mão, como na Sala. */}
                    {FERRAMENTAS.filter(([id]) => id !== 'linha' && (ehLinkNoEditor || id !== 'tubo')).map(([id, Icon, titulo]) => (
                      <ToolBtn compacto key={id} icon={Icon} label={titulo} active={tool === id} onClick={() => setTool(id)} />
                    ))}
                    <ToolBtn compacto icon={Type} label="Texto" active={tool === 'texto'} onClick={() => setTool('texto')} />
                    {!ehLinkNoEditor && <ToolBtn compacto icon={Target} label="Seguir" active={tool === 'seguir'} onClick={() => setTool('seguir')} />}
                    {/* Relvado, Fora de jogo e Medir: só nos ficheiros (precisam da imagem parada e medida). */}
                    {!ehLinkNoEditor && <ToolBtn compacto icon={LayoutGrid} label={calibracao ? 'Relvado ✓' : 'Relvado'} active={painelRelvado || !!calibrando} onClick={() => setPainelRelvado(v => !v)} />}
                    {!ehLinkNoEditor && <ToolBtn compacto icon={Flag} label="Fora de jogo" active={tool === 'foraDeJogo'} onClick={() => setTool('foraDeJogo')} />}
                    {!ehLinkNoEditor && calibracao && <ToolBtn compacto icon={Ruler} label="Medir" active={tool === 'medida'} onClick={() => setTool('medida')} />}
                    <ToolBtn compacto icon={Eraser} label="Apagar" active={tool === 'apagar'} onClick={() => setTool('apagar')} />
                  </div>
                  {tituloSecao('Cor', 12)}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {PALETA_DESENHO.map(pc => (
                      <button key={pc.id} type="button" onClick={() => mudarCor(pc.cor)} title={pc.id} style={{
                        width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', padding: 0, background: pc.cor,
                        border: `1px solid ${TV.line}`, outline: corAtual === pc.cor ? `2px solid ${TV.gold}` : 'none', outlineOffset: 2,
                      }} />
                    ))}
                  </div>
                  {tituloSecao(ehLinkNoEditor ? 'Câmara lenta nos novos itens' : 'Vídeo parado nos novos itens', 12)}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }} title="Para mudar um item já feito, toca nele no vídeo.">
                    {[1, 2, 3, 5, 8, 10].map(sg => (
                      <button key={sg} type="button" onClick={() => setSegNovos(sg)} style={{ ...botaoBarra, ...(segNovos === sg ? { background: TV.gold, borderColor: TV.gold, color: '#111' } : {}) }}>{sg}s</button>
                    ))}
                  </div>
                  {/* Painel compacto (17/11): Recuar, Avançar e Limpar numa só linha,
                      para o painel caber na altura do editor sem deslocar. */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                    <button type="button" onClick={retroceder} disabled={!(historico.length > 0 || !!pontosEmCurso)} style={{ ...botaoBarra, padding: '6px 8px', opacity: historico.length > 0 || pontosEmCurso ? 1 : 0.5 }}><Undo2 size={14} /> Recuar</button>
                    <button type="button" onClick={avancar} disabled={!(futuro.length > 0 || pontosDesfeitos.current.length > 0)} style={{ ...botaoBarra, padding: '6px 8px', opacity: futuro.length > 0 || pontosDesfeitos.current.length > 0 ? 1 : 0.5 }}><Redo2 size={14} /> Avançar</button>
                    <span style={{ flex: 1 }} />
                    <button type="button" title="Apagar todos os desenhos deste vídeo" onClick={() => { largarParagemEditor(); pushHistorico(); setShapes([]); setEditandoDuracaoIndex(null); }} disabled={!shapes.length} style={{ ...botaoBarra, padding: '6px 8px', opacity: shapes.length ? 1 : 0.5 }}><Trash2 size={14} /> Limpar</button>
                  </div>
                  {trajetoriaFocoPendente && !processandoFoco && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => { videoRef.current?.pause(); setTool('seguir'); }} style={botaoBarra}><Target size={14} color={TV.crimsonBright} /> Continuar seguimento aqui</button>
                      <button type="button" onClick={() => setTrajetoriaFocoPendente(null)} style={botaoBarra}><X size={14} /> Tirar seguimento</button>
                    </div>
                  )}
                  {trajetoriaFocoPendente && !processandoFoco && (
                    <div style={{ marginTop: 8 }}>
                      <AvisoSeguimentoParou pontos={trajetoriaFocoPendente.pontos} fim={Math.min(duration || 0, trajetoriaFocoPendente.tFimPedido ?? Infinity)}
                        onIr={(tp) => { videoRef.current?.pause(); seekTo(tp); }} />
                    </div>
                  )}
                  {tituloSecao(`Desenhos neste vídeo · ${paragensDoVideo.length}`, 14)}
                  {paragensDoVideo.length === 0 && <div style={{ fontSize: 12, color: TV.mutedDim, ...body }}>{ehLinkNoEditor ? 'Para o vídeo no momento certo e desenha. Ao ver, o vídeo passa a câmara lenta nesses momentos.' : 'Para o vídeo no momento certo e desenha. Cada momento com desenhos aparece aqui.'}</div>}
                  {/* Com muitas paragens, a lista desloca-se sozinha (cabem 3). */}
                  <div className="mjp-sem-scroll" style={{ maxHeight: 3 * 46, overflowY: 'auto', scrollbarWidth: 'none' }}>
                  {paragensDoVideo.map(g => {
                    const aqui = Math.abs(current - g.t) < 0.4;
                    const nomes = [...new Set(g.formas.map(f => (FERRAMENTAS.find(([id]) => id === f.tool) || [null, null, f.tool === 'texto' ? 'Texto' : f.tool])[2]))].filter(Boolean).join(' + ');
                    const zoomC = g.formas.find(f => f.tool === 'circulo' && Number(f.zoom) > 1);
                    return (
                      <button key={g.t} type="button" onClick={() => irParaTempo(g.t)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 40, boxSizing: 'border-box', textAlign: 'left', padding: '0 10px', marginBottom: 6, borderRadius: 8, cursor: 'pointer', ...body,
                        background: TV.surfaceRaise, border: `1px solid ${aqui ? TV.gold : 'transparent'}`, color: TV.cream,
                      }}>
                        <span style={{ ...mono, color: TV.gold, fontSize: 12.5, width: 46 }}>{fmt(g.t)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomes || 'Desenho'}{zoomC ? ` · zoom ${String(zoomC.zoom).replace('.', ',')}×` : ''}</span>
                          <span style={{ display: 'block', fontSize: 11, color: TV.muted }}>{g.formas.some(temParagem) ? `${Math.max(...g.formas.filter(temParagem).map(segDe))}s ${ehLinkNoEditor ? 'em câmara lenta' : 'parado'}` : 'sem parar'}</span>
                        </span>
                      </button>
                    );
                  })}
                  </div>
                  {corteAMao()}
                </>
              )}

              {abaAtiva === 'clipes' && (
                <>
                  {tituloSecao(`Clipes deste vídeo · ${clipesDoVideo.length}`)}
                  {clipesDoVideo.length === 0
                    ? <div style={{ fontSize: 12, color: TV.mutedDim, ...body }}>Ainda sem clipes neste vídeo. Usa o Codificar para os criar com um toque.</div>
                    : [...clipesDoVideo].sort((a, b) => (a.origemInicio || 0) - (b.origemInicio || 0)).map(linhaClipe)}
                  <div style={{ fontSize: 11.5, color: TV.mutedDim, marginTop: 8, ...body }}>Todos os cortes, de todos os jogos, estão por baixo, em "Cortes".</div>
                </>
              )}
            </div>
          </div>
        </div>
        </BancadaVideo.Provider>
      )}

      {/* LINKS: o leitor da Sala de Vídeo (lista de jogos e cortes por link,
          "Criar clipe", desenho com paragens). Sempre montado — escondido com
          altura 0 fora do modo Links, para não perder o que estava aberto e
          para a janela de edição (posição fixa) aparecer na mesma. */}
      {renderPainelLinks && (
        <div ref={painelLinksRef} style={modoEfetivo === 'links' && !originalAtivo && linkAberto
          // Aberto: na mesma moldura do editor dos ficheiros.
          ? { animation: 'mjpPalco .22s ease', background: TV.surface, borderRadius: 12, border: `1px solid ${TV.line}`, padding: 14 }
          : { height: 0, overflow: 'hidden' }}>
          {painelLinksConteudo()}
        </div>
      )}

      {/* Biblioteca de cortes — permanente, independente do vídeo original.
          A área guarda a maior altura que já teve, para trocar entre
          "Cortes" e "Análise individual" sem a página encolher e saltar. */}
      <div ref={areaCortesRef} style={{ marginTop: originalAtivo ? 26 : 14, minHeight: alturaAreaCortes || undefined }}>
        <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            // Totais SEM filtros: o rótulo não muda de largura ao escolher uma etiqueta.
            { id: 'staff', label: `Cortes de ficheiros (${cortesFicheiro.length})`, Icon: Tag },
            // Clipes dos jogos por link (YouTube), feitos em Links.
            ...(temLinks ? [{ id: 'clipes', label: `Cortes de links (${(cortesLink || []).length + clipesLinkEditor.length})`, Icon: Scissors }] : []),
            { id: 'atletas', label: `Análise individual (${clipesAtletas.length})`, Icon: User },
          ].map(({ id, label, Icon }) => {
            const on = separadorClipes === id;
            return (
              <button key={id} role="tab" aria-selected={on} onClick={() => {
                if (areaCortesRef.current) setAlturaAreaCortes(h => Math.max(h, areaCortesRef.current.getBoundingClientRect().height));
                setSeparadorClipes(id);
              }}
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

        {/* O STAFF TAMBÉM CRIA ANÁLISE INDIVIDUAL: escolhe o jogador (com
            cartão ou ainda sem nada) e os cortes. Aparecem no cartão dele e
            no Portal dele, como dele, só para ver. */}
        {/* ANÁLISE INDIVIDUAL: em cima os jogadores (um cartão pequeno cada,
            com o nº de clipes); escolhido um, por baixo os clipes dele numa
            grelha com os mesmos cartões dos cortes. Sem jogador escolhido,
            os clipes mais recentes de todos. */}
        {separadorClipes === 'atletas' && (
          clipesAtletas.length === 0 ? (
            <div style={{ color: T.mutedDim, fontSize: 13, padding: '18px 0', ...body }}>
              Ainda não há análise individual. Ao gravar um corte, escolhe o jogador em "Análise individual"; os jogadores também a criam no Portal do Atleta.
            </div>
          ) : blocoAnaliseIndividual()
        )}

        {separadorClipes === 'staff' && cortesFicheiro.length === 0 && <div style={{ color: T.mutedDim, fontSize: 13, padding: '18px 0' }}>Ainda não há cortes guardados.</div>}

        {separadorClipes === 'staff' && cortesFicheiro.length > 0 && blocoCortes(cortesFicheiro)}

        {/* Clipes dos jogos por link feitos no EDITOR: os mesmos cartões dos Cortes. */}
        {separadorClipes === 'clipes' && clipesLinkEditor.length > 0 && blocoCortes(clipesLinkEditor, 'clipes')}

        {/* CORTES DOS JOGOS POR LINK (YouTube): juntos dos cortes MP4, por
            jogo. Daqui vão para o Canal (Jogos ou Adversários) ou para a
            análise individual de um jogador. Não têm etiqueta: com um filtro
            de etiqueta escolhido, não aparecem. */}
        {separadorClipes === 'clipes' && gruposCortesLink.length === 0 && clipesLinkEditor.length === 0 && (
          <div style={{ color: T.mutedDim, fontSize: 13, padding: '18px 0', ...body }}>
            Ainda não há cortes de links. Em Links, abre um jogo e marca os cortes em Codificar (ou com Início e Fim).
          </div>
        )}
        {separadorClipes === 'clipes' && gruposCortesLink.length > 0 && (
          <div style={clipesLinkEditor.length ? { marginTop: 22 } : undefined}>
            {clipesLinkEditor.length > 0 && (
              <div style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: T.mutedDim, margin: '0 0 10px', ...body }}>Clipes de antes do editor</div>
            )}
            {gruposCortesLink.map(g => (
              <div key={g.nome} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, ...body }}>
                  <Link2 size={13} color={T.mutedDim} style={{ alignSelf: 'center' }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.cream }}>{g.nome}</span>
                  <span style={{ fontSize: 12, color: T.mutedDim, fontFamily: 'monospace' }}>{g.cortes.length} {g.cortes.length === 1 ? 'clipe' : 'clipes'} · YouTube</span>
                </div>
                <FilaDeslizante larguraBase={220}>
                  {g.cortes.map(c => {
                    const enviado = (c.enviadoSala || []).length > 0;
                    const dur = Math.max(0, (Number(c.clipFim) || 0) - (Number(c.clipInicio) || 0));
                    const botaoMini = (Icone, titulo, acao, cor) => (
                      <button type="button" title={titulo} onClick={(e) => { e.stopPropagation(); acao(); }}
                        style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,.6)', color: cor || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icone size={14} />
                      </button>
                    );
                    return (
                      <div key={c.id} style={{ flex: '0 0 auto', width: 'var(--mjp-cartao-fila, 230px)', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', ...body }}>
                        <div onClick={() => abrirClipeLinkNoPalco(c.id)} style={{ position: 'relative', aspectRatio: '16/9', background: T.surfaceRaise, cursor: 'pointer' }}>
                          {c.youtubeId && <img src={`https://img.youtube.com/vi/${c.youtubeId}/mqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                          <span style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 10.5, background: 'rgba(0,0,0,.65)', color: '#fff', borderRadius: 6, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Play size={10} /> YouTube</span>
                          <span style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 11, background: 'rgba(0,0,0,.65)', color: '#fff', borderRadius: 6, padding: '2px 7px', fontFamily: 'monospace' }}>{Math.round(dur)}s</span>
                          <div style={{ position: 'absolute', left: 8, top: 8, display: 'flex', gap: 6 }}>
                            {enviarLinkParaCanal && botaoMini(enviado ? Check : Tv, enviado ? `No Canal: ${(c.enviadoSala || []).map(e => e.rotulo).join('; ')}` : 'Enviar para o Canal', () => setLinkParaCanal(c), enviado ? T.good : undefined)}
                            {apagarLink && botaoMini(Trash2, 'Apagar clipe', () => apagarLink(c))}
                          </div>
                        </div>
                        <div style={{ padding: '8px 10px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'Corte'}</div>
                          <div style={{ fontSize: 11.5, color: enviado ? T.good : T.mutedDim, marginTop: 2 }}>{enviado ? `✓ ${(c.enviadoSala || []).map(e => e.rotulo).join('; ')}` : 'Só na Análise'}</div>
                        </div>
                      </div>
                    );
                  })}
                </FilaDeslizante>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clipe posto pelo staff a partir de um corte MP4 com desenhos: toca
          no leitor dos cortes, com os desenhos, só para ver. */}
      {sequenciaAtleta && (() => { const c = sequenciaAtleta.clipes[sequenciaAtleta.indice]; return c && c.criadoPorStaff && (c.shapes || []).length > 0 && c.dataUrl; })() && (
        <ClipPlayerModal soVer
          clip={{ ...sequenciaAtleta.clipes[sequenciaAtleta.indice], publicUrl: sequenciaAtleta.clipes[sequenciaAtleta.indice].dataUrl }}
          tag={null} onClose={() => setSequenciaAtleta(null)} />
      )}
      {sequenciaAtleta && sequenciaAtleta.clipes[sequenciaAtleta.indice] && !(() => { const c = sequenciaAtleta.clipes[sequenciaAtleta.indice]; return c.criadoPorStaff && (c.shapes || []).length > 0 && c.dataUrl; })() && (
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
        (() => { const el = (
        <ClipPlayerModal
          clip={clipeAReproduzir}
          tag={TAGS.find(t => t.id === clipeAReproduzir.tagId)}
          onClose={() => { setClipeAReproduzir(null); setEditarClipeAoAbrir(false); }}
          copied={copiedId === clipeAReproduzir.id}
          onShare={async () => { if (await partilharClipeFicheiro(clipeAReproduzir) === 'copiado') { setCopiedId(clipeAReproduzir.id); setTimeout(() => setCopiedId(null), 1600); } }}
          onSaveEdit={(dados) => editarClipeFicheiro(clipeAReproduzir, dados)}
          editarAoAbrir={editarClipeAoAbrir}
          originais={videosOriginais.filter(v => v.storagePath && !v.ficheiroApagado)}
          originalSugeridoId={(originalDoClipe(clipeAReproduzir) || {}).id || null}
          onRemove={() => removerClipe(clipeAReproduzir, () => setClipeAReproduzir(null))}
          onChangeTag={novoTagId => mudarTagClipe(clipeAReproduzir, novoTagId)}
          equipasDoClipe={equipasDoClipeDe(clipeAReproduzir)}
          onChangeEquipa={ehClipeAtleta(clipeAReproduzir) ? undefined : (nome => mudarEquipaClipe(clipeAReproduzir, nome))}
          nomeNossaEquipa={nomeNossaEquipa}
          aMudarEquipa={aGarantirFicha}
          onChangeTrajetoria={trajetoria => mudarTrajetoriaClipe(clipeAReproduzir, trajetoria)}
          onEnviarSala={enviarParaSala ? () => { sairDoEcraInteiro(); setClipeParaSala(clipeAReproduzir); } : undefined}
          onDesenhar={() => desenharNoClipe(clipeAReproduzir)}
          onSeguirNoDesenho={() => desenharNoClipe(clipeAReproduzir, { seguir: true })}
          embutido={!!estudioEl}
          onEcraInteiro={estudioEl ? alternarEcraInteiro : undefined}
          ecraInteiroExterno={fullscreen}
        />
        ); return estudioEl ? createPortal(el, estudioEl) : el; })()
      )}
      {editarEquipas && originalAtivo && (
        <EquipasDoJogoModal
          titulo={originalAtivo.titulo}
          equipas={originalAtivo.equipas}
          onClose={() => setEditarEquipas(false)}
          onGuardar={(eqs) => {
            const id = originalAtivo.id;
            setVideosOriginais(prev => prev.map(v => (v.id === id ? { ...v, equipas: eqs, equipaCortes: eqs.includes(v.equipaCortes) ? v.equipaCortes : '' } : v)));
            setEditarEquipas(false);
          }}
        />
      )}
      {colarLinkAberto && criarJogoLink && (
        <ColarLinkModal destinos={destinosSala} equipas={equipasCompeticao} onClose={() => setColarLinkAberto(false)} onGuardar={dados => criarJogoLink(dados)} />
      )}
      {/* Carregar ficheiro: o mesmo formulário do "Colar link" (nome, para
          onde vai, destino), numa janela por cima: a página não mexe. */}
      {ficheiroPendente && (
        <ColarLinkModal ficheiro={ficheiroPendente} destinos={destinosSala} equipas={equipasCompeticao}
          onClose={() => setFicheiroPendente(null)}
          onGuardar={({ titulo, url, ...dest }) => { iniciarUploadVideo(ficheiroPendente, titulo, dest); setFicheiroPendente(null); }} />
      )}
      {linkParaCanal && enviarLinkParaCanal && typeof linkParaCanal.clipInicio !== 'number' && (
        <EnviarJogoModal
          key={`linkjogo-${linkParaCanal.id}`}
          jogo={{ titulo: linkParaCanal.title || '', enviadoSala: ((jogosLink || []).find(x => x.id === linkParaCanal.id) || linkParaCanal).enviadoSala || [] }}
          destinos={destinosSala} equipas={equipasCompeticao}
          onEnviar={dados => { enviarLinkParaCanal(linkParaCanal, dados); }}
          onRetirar={retirarDaSala ? (marca => retirarDaSala({ tipo: 'link', id: linkParaCanal.id, marca })) : null}
          onClose={() => setLinkParaCanal(null)}
        />
      )}
      {linkParaCanal && enviarLinkParaCanal && typeof linkParaCanal.clipInicio === 'number' && (
        <EnviarSalaModal
          key={`link-${linkParaCanal.id}`}
          clip={{ id: linkParaCanal.id, note: linkParaCanal.title || '', originalTitulo: linkParaCanal.clipOrigemTitulo || '', enviadoSala: ((cortesLink || []).find(x => x.id === linkParaCanal.id) || linkParaCanal).enviadoSala || [] }}
          tag={null}
          destinos={destinosSala}
          onEnviar={dados => { enviarLinkParaCanal(linkParaCanal, dados); }}
          onRetirar={retirarDaSala ? (marca => retirarDaSala({ tipo: 'link', id: linkParaCanal.id, marca })) : null}
          onClose={() => setLinkParaCanal(null)}
        />
      )}
      {jogoParaCanal && enviarJogoFicheiroParaCanal && (
        <EnviarJogoModal
          key={`jogo-${jogoParaCanal.v.id}`}
          jogo={{ titulo: jogoParaCanal.v.titulo || '', enviadoSala: ((videosOriginais || []).find(x => x.id === jogoParaCanal.v.id) || jogoParaCanal.v).enviadoSala || [] }}
          destinos={destinosSala} equipas={equipasCompeticao}
          onEnviar={dados => enviarJogoFicheiroParaCanal(jogoParaCanal.v, dados)}
          onRetirar={retirarDaSala ? (marca => retirarDaSala({ tipo: 'original', id: jogoParaCanal.v.id, marca })) : null}
          onClose={() => setJogoParaCanal(null)}
        />
      )}
      {clipeParaSala && enviarParaSala && (
        <EnviarSalaModal
          key={clipeParaSala.id}
          clip={(clipes || []).find(c => c.id === clipeParaSala.id) || clipeParaSala}
          tag={TAGS.find(t => t.id === clipeParaSala.tagId)}
          destinos={destinosSala}
          onEnviar={dados => enviarClipeSala(clipeParaSala, dados)}
          onRetirar={marca => retirarCorteDaSala(clipeParaSala, marca)}
          onClose={() => setClipeParaSala(null)}
        />
      )}
    </div>
  );
}
