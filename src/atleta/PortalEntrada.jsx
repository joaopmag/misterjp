// atleta/PortalEntrada.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, mono, body, display, TEMA_ATUAL, trocarTema, IconeTema } from '../base/tema';
import { supabase } from '../supabaseClient';
import React, { useState, useRef, useEffect } from 'react';
import { Fingerprint } from 'lucide-react';
import { URL_PUBLICA_APP } from '../media/social';
import { CHECKIN_DAYS_BACK, CHECKIN_WINDOWS } from './janelas';
import { pkhBalneario } from './balneario';
import { coresCamisola } from './ecras';
import { PE_TC_PORTA } from './temaPorta';

/* ===================================================================
   ENTRADA DO PORTAL — CARTÃO DE ATLETA (fase 2 da segurança)
   ===================================================================
   O conceito é o centro de treinos do clube:
   · RECEÇÃO (1.ª vez num telemóvel): o jogador escreve o código de
     ativação que o staff lhe deu no Plantel (6 dígitos, uso único,
     expira em 48 h). → `checkin_cartao_ver`
   · CARTÃO DE ATLETA: o cartão "chega-lhe à mão" (cor do clube, foto,
     nome, número) e ele escolhe um PIN pessoal de 6 dígitos, duas vezes.
     → `checkin_cartao_ativar` devolve um TOKEN, guardado só neste
     telemóvel (localStorage, por equipa).
   · PORTA DO BALNEÁRIO (todos os dias): o cartão com o nome no topo, a
     porta de vidro fosco com o emblema e o PIN por baixo. PIN certo →
     `checkin_cartao_entrar` devolve uma CHAVE DE SESSÃO temporária; a
     porta abre para o balneário (a TV diz "Bem-vindo") e entra-se com
     essa chave no lugar do código antigo — por isso todo o resto do
     Portal funciona sem alterações (ver checkin_jogador, fase 2).
   · Os códigos antigos continuam a entrar (ligação "Entrar com o código
     antigo") até o staff ligar "Entrada só com cartão de atleta".
   5 PIN errados bloqueiam o cartão neste telemóvel; o staff gera um
   código novo. Nada disto guarda o PIN no telemóvel. */
export const PE_CSS = `
  html, body { overflow: hidden !important; overscroll-behavior: none; }
  html { scrollbar-gutter: auto !important; background: ${T.bg}; }
  body { background: ${T.bg}; }
  @keyframes pe-chega { 0% { transform: translateY(-40px) rotateY(-75deg) rotateX(20deg); opacity: 0; } 70% { transform: translateY(4px) rotateY(6deg) rotateX(-3deg); opacity: 1; } 100% { transform: none; opacity: 1; } }
  @keyframes pe-brilho { 0% { left: -60%; } 100% { left: 130%; } }
  @keyframes pe-treme { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
  @keyframes pe-respira { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  @keyframes pe-onda { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -60; } }
  @keyframes pe-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(201,162,39,.55); } 50% { box-shadow: 0 0 0 12px rgba(201,162,39,0); } }
  @keyframes pe-anel { 0% { transform: scale(.55); opacity: .95; } 80% { opacity: 0; } 100% { transform: scale(1.65); opacity: 0; } }
  @keyframes pe-varre { 0% { top: 10%; } 50% { top: 86%; } 100% { top: 10%; } }
  @keyframes pe-dedo { 0% { opacity: 0; transform: translate(26px, 30px); } 15% { opacity: 1; transform: translate(10px, 12px); }
    25% { transform: translate(0, 0) scale(.9); } 32% { transform: translate(0, 0) scale(1); } 42% { transform: translate(0, 0) scale(.9); } 50% { transform: translate(0, 0) scale(1); }
    80% { opacity: 1; transform: translate(0, 0); } 100% { opacity: 0; transform: translate(10px, 14px); } }
`;

/* ONDE O CARTÃO FICA GUARDADO NESTE TELEMÓVEL/COMPUTADOR.
   O Portal e a plataforma do staff partilham o mesmo endereço e, por
   isso, a mesma memória do navegador (localStorage, limitada). Com a
   fotografia junto, o cartão podia não caber e perdia-se sem aviso — e o
   atleta voltava à Receção. Agora:
   · o cartão em si é pequeno (a chave e o nome, sem foto);
   · fica em DOIS sítios: localStorage e um cookie (memória separada, que
     não conta para o mesmo limite) — se um falhar, o outro chega;
   · a fotografia vai à parte e é dispensável (sem ela, mostram-se as
     iniciais). */
export const peChave = (teamId) => `mjp-cartao:${teamId || 'sem-equipa'}`;

export const peChaveFoto = (teamId) => `mjp-cartao-foto:${teamId || 'sem-equipa'}`;

export const peCookie = (teamId) => `mjp_cartao_${String(teamId || 'sem-equipa').replace(/[^a-zA-Z0-9-]/g, '')}`;

export function peLerCookie(nome) {
  try {
    const m = document.cookie.split('; ').find(c => c.startsWith(`${nome}=`));
    return m ? decodeURIComponent(m.slice(nome.length + 1)) : null;
  } catch (e) { return null; }
}

export function peLerCartao(teamId) {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(peChave(teamId)) || 'null'); } catch (e) { v = null; }
  if (!v || !v.token) { try { v = JSON.parse(peLerCookie(peCookie(teamId)) || 'null'); } catch (e) { v = null; } }
  if (!v || !v.token) return null;
  let foto = null;
  try { foto = localStorage.getItem(peChaveFoto(teamId)); } catch (e) { foto = null; }
  return { ...v, jogador: { ...(v.jogador || {}), foto: (v.jogador && v.jogador.foto) || foto || null } };
}

// Devolve true se ficou guardado em pelo menos um dos dois sítios.
export function peGuardarCartao(teamId, cartao) {
  const j = (cartao && cartao.jogador) || {};
  const pequeno = JSON.stringify({ token: cartao.token, bio: !!cartao.bio, jogador: { nome: j.nome || '', numero: j.numero || '', posicao: j.posicao || '' } });
  try { localStorage.setItem(peChave(teamId), pequeno); } catch (e) { /* sem espaço ou modo privado */ }
  try {
    const seguro = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${peCookie(teamId)}=${encodeURIComponent(pequeno)}; Max-Age=${60 * 60 * 24 * 400}; Path=/; SameSite=Lax${seguro}`;
  } catch (e) { /* cookies bloqueados */ }
  try { if (j.foto) localStorage.setItem(peChaveFoto(teamId), j.foto); } catch (e) { /* a foto é dispensável */ }
  const lido = peLerCartao(teamId);
  return !!(lido && lido.token === cartao.token);
}

export function peApagarCartao(teamId) {
  try { localStorage.removeItem(peChave(teamId)); localStorage.removeItem(peChaveFoto(teamId)); } catch (e) { /* nada */ }
  try { document.cookie = `${peCookie(teamId)}=; Max-Age=0; Path=/; SameSite=Lax`; } catch (e) { /* nada */ }
}

export async function peRpc(nome, args) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  let d = data;
  if (Array.isArray(d)) d = d[0];
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
  return d || {};
}

export function peIniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export function peEpoca() {
  const h = new Date(); const y = h.getMonth() >= 6 ? h.getFullYear() : h.getFullYear() - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

export function PeEmblema({ logo, cor, tam = 40, branco = false }) {
  if (logo) {
    return <img src={logo} alt="" style={{ height: tam, width: 'auto', display: 'block', filter: branco ? 'grayscale(1) brightness(2.4)' : 'none' }} />;
  }
  return (
    <svg viewBox="0 0 40 44" height={tam} aria-hidden="true">
      <path d="M2 2 H38 V22 Q38 36 20 42 Q2 36 2 22 Z" fill={branco ? 'rgba(255,255,255,.28)' : '#fff'} stroke={branco ? 'rgba(255,255,255,.95)' : cor.base} strokeWidth={branco ? 1.2 : 3} />
      <path d="M8 8 H32 V22 Q32 32 20 36 Q8 32 8 22 Z" fill={branco ? 'rgba(255,255,255,.18)' : cor.base} />
    </svg>
  );
}

/* `extra` ocupa a tecla vazia em baixo à esquerda (ex.: a impressão
   digital na porta), como nos teclados de PIN dos bancos: um símbolo no
   próprio teclado em vez de uma frase por baixo. */
export function PeTeclado({ onTecla, desativado, extra }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, width: '100%' }}>
      {teclas.map((k, i) => (!k && extra ? (
        <button key={i} type="button" disabled={extra.desativado} onClick={extra.onClick} aria-label={extra.rotulo} title={extra.rotulo} style={{
          height: 'clamp(38px, 5.6dvh, 50px)', borderRadius: 10, background: '#0d120f', border: '1px solid #2a2f33', color: '#FFC23D',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: extra.desativado ? 'default' : 'pointer', opacity: extra.desativado ? 0.5 : 1,
        }}><extra.Icon size={24} strokeWidth={1.7} /></button>
      ) : k ? (
        <button key={i} type="button" disabled={desativado} onClick={() => onTecla(k)} aria-label={k === '⌫' ? 'Apagar' : k} style={{
          height: 'clamp(38px, 5.6dvh, 50px)', borderRadius: 10, background: '#0d120f', border: '1px solid #2a2f33', color: '#FFC23D',
          ...mono, fontSize: 19, fontWeight: 500, cursor: desativado ? 'default' : 'pointer', opacity: desativado ? 0.5 : 1,
        }}>{k}</button>
      ) : <div key={i} />))}
    </div>
  );
}

/* As caixas do código e do PIN: a mesma identidade nas duas (rebordo
   vermelho à medida que se escreve; o PIN mostra pontos). */
export function PeCaixas({ valor, ocultar, cor }) {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{
          width: 30, height: 36, borderRadius: 6, background: '#121815',
          border: `1.5px solid ${cor || (i < valor.length ? '#FF4B5A' : '#3a4440')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontWeight: 500, fontSize: 17, color: cor || '#FFC23D',
        }}>{i < valor.length ? (ocultar ? '●' : valor[i]) : ''}</div>
      ))}
    </div>
  );
}

export function PePainel({ rotulo, corRotulo, children, tremer }) {
  return (
    <div style={{
      background: 'rgba(7,9,10,.92)', border: '1px solid #3a4440', borderRadius: 10, padding: '7px 10px 9px', textAlign: 'center',
      boxShadow: '0 0 16px rgba(255,75,90,.25)', animation: tremer ? 'pe-treme .45s' : 'none',
    }}>
      <div style={{ fontSize: 11, letterSpacing: '.1em', color: corRotulo || '#9aa8a0', lineHeight: 1.3, marginBottom: 6, textTransform: 'uppercase', ...body }}>{rotulo}</div>
      {children}
    </div>
  );
}

export function PeRececao({ cor, logo, clube }) {
  const base = cor.base;
  return (
    <svg viewBox="0 0 300 220" width="100%" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <radialGradient id="pe-sala" cx="50%" cy="30%" r="80%"><stop offset="0" stopColor="#26342b" /><stop offset="1" stopColor="#0e1310" /></radialGradient>
        <linearGradient id="pe-led" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0d120f" /><stop offset=".5" stopColor={base} /><stop offset="1" stopColor="#0d120f" /></linearGradient>
        <linearGradient id="pe-tampo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f2ec" /><stop offset="1" stopColor="#bdb8ad" /></linearGradient>
        <linearGradient id="pe-frente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b211e" /><stop offset="1" stopColor="#0b0f0d" /></linearGradient>
        <linearGradient id="pe-chao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18201b" /><stop offset="1" stopColor="#0b0f0d" /></linearGradient>
        <filter id="pe-desfoca" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <rect width="300" height="220" fill="url(#pe-sala)" />
      <ellipse cx="150" cy="10" rx="120" ry="14" fill="none" stroke="#FFE6A0" strokeWidth="3" opacity=".8" />
      <ellipse cx="150" cy="10" rx="120" ry="14" fill="none" stroke="#FFE6A0" strokeWidth="12" opacity=".25" filter="url(#pe-desfoca)" />
      <path d="M40 34 Q150 22 260 34 L260 124 Q150 114 40 124 Z" fill="url(#pe-led)" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <path key={i} d={`M40 ${40 + i * 10} Q150 ${29 + i * 10} 260 ${40 + i * 10}`} fill="none" stroke="#fff" strokeWidth=".5" opacity=".08" />)}
      <path d="M40 34 Q150 22 260 34 L260 124 Q150 114 40 124 Z" fill="none" stroke="#FFC23D" strokeWidth="1.2" opacity=".6" />
      <g style={{ animation: 'pe-respira 3.5s ease-in-out infinite' }}>
        <circle cx="150" cy="70" r="34" fill="#fff" opacity=".08" />
        {logo
          ? <image href={logo} x="124" y="44" width="52" height="54" preserveAspectRatio="xMidYMid meet" />
          : <g transform="translate(150,70)"><path d="M-20 -24 H20 V2 Q20 20 0 28 Q-20 20 -20 2 Z" fill="#fff" /><path d="M-14 -18 H14 V2 Q14 15 0 21 Q-14 15 -14 2 Z" fill={base} /></g>}
      </g>
      <text x="150" y="114" textAnchor="middle" fontSize="9" fontWeight="600" fill="#F3ECDA" fontFamily="Oswald, sans-serif" letterSpacing="3" opacity=".85">{clube ? String(clube).toUpperCase() : 'CENTRO DE TREINOS'}</text>
      {[16, 278].map(x => (
        <g key={x}><rect x={x} y="30" width="6" height="140" rx="3" fill="#FFE6A0" opacity=".55" /><rect x={x} y="30" width="6" height="140" rx="3" fill="#FFE6A0" opacity=".35" filter="url(#pe-desfoca)" /></g>
      ))}
      <rect x="0" y="168" width="300" height="52" fill="url(#pe-chao)" />
      <ellipse cx="150" cy="190" rx="110" ry="12" fill={base} opacity=".2" filter="url(#pe-desfoca)" />
      <path d="M30 138 Q150 126 270 138 L270 146 Q150 134 30 146 Z" fill="url(#pe-tampo)" />
      <path d="M34 146 Q150 134 266 146 L262 186 Q150 176 38 186 Z" fill="url(#pe-frente)" />
      <path d="M38 180 Q150 170 262 180" fill="none" stroke="#FF4B5A" strokeWidth="2.5" strokeDasharray="40 20" style={{ animation: 'pe-onda 2.5s linear infinite' }} />
      <path d="M38 180 Q150 170 262 180" fill="none" stroke="#FF4B5A" strokeWidth="8" opacity=".35" filter="url(#pe-desfoca)" />
    </svg>
  );
}

export function PeCartao({ jogador, cor, logo, clube }) {
  const nome = String((jogador && jogador.nome) || '').trim();
  const partes = nome.split(/\s+/).filter(Boolean);
  const linha1 = partes[0] || '';
  const linha2 = partes.length > 1 ? partes[partes.length - 1] : '';
  const texto = cor.texto || '#fff';
  return (
    <div style={{ perspective: 800 }}>
      <div style={{
        position: 'relative', width: 'min(300px, 86vw)', aspectRatio: '1.586', borderRadius: 14, overflow: 'hidden', color: texto,
        background: `linear-gradient(135deg, ${cor.escuro || cor.base} 0%, ${cor.base} 45%, ${cor.escuro || cor.base} 100%)`,
        boxShadow: '0 16px 34px rgba(0,0,0,.55)', animation: 'pe-chega 1.1s cubic-bezier(.2,.8,.2,1) both', ...body,
      }}>
        <div style={{ position: 'absolute', right: '-10%', top: '-4%', height: '108%', opacity: 0.12, display: 'flex' }}>
          <PeEmblema logo={logo} cor={cor} tam={190} branco />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.04) 0 8px, transparent 8px 16px)' }} />
        <div style={{ position: 'absolute', left: '5%', top: '7%', display: 'flex', alignItems: 'center', gap: 7 }}>
          <PeEmblema logo={logo} cor={cor} tam={24} />
          <div>
            <div style={{ ...display, fontSize: 13, fontWeight: 600, lineHeight: 1.05, letterSpacing: '.04em' }}>{(clube || 'O MEU CLUBE').toUpperCase()}</div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', opacity: 0.85 }}>CARTÃO DE ATLETA</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: '5%', top: '8%', width: 30, height: 22, borderRadius: 5, background: 'linear-gradient(135deg,#f1d27a,#b8902e)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.25)' }} />
        <div style={{ position: 'absolute', left: '5%', top: '30%', width: '25%', height: '52%', borderRadius: 8, overflow: 'hidden', background: '#1A2A1F', border: '2px solid #F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {jogador && jogador.foto
            ? <img src={jogador.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ ...display, fontSize: 26, fontWeight: 600, color: '#FFD86A' }}>{peIniciais(nome)}</span>}
        </div>
        <div style={{ position: 'absolute', left: '34%', top: '31%', right: '26%' }}>
          <div style={{ ...display, fontSize: 21, fontWeight: 600, lineHeight: 1.02, textTransform: 'uppercase', overflow: 'hidden' }}>{linha1}{linha2 && <><br />{linha2}</>}</div>
          {jogador && jogador.posicao && <div style={{ fontSize: 12, opacity: 0.9, marginTop: 5 }}>{jogador.posicao}</div>}
        </div>
        {jogador && jogador.numero && (
          <div style={{ position: 'absolute', right: '6%', top: '32%', ...display, fontSize: 54, fontWeight: 600, lineHeight: 1, color: '#F3ECDA', textShadow: '0 2px 0 rgba(0,0,0,.25)' }}>{jogador.numero}</div>
        )}
        <div style={{ position: 'absolute', left: '34%', bottom: '8%', fontSize: 11, letterSpacing: '.12em', opacity: 0.9 }}>ÉPOCA {peEpoca()}</div>
        <div style={{ position: 'absolute', top: '-20%', bottom: '-20%', width: '40%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent)', transform: 'skewX(-18deg)', animation: 'pe-brilho 2.8s ease-in-out 1.2s infinite' }} />
      </div>
    </div>
  );
}

/* PASSAGEM DA PORTA PARA O ECRÃ INICIAL. Quando a porta acaba de abrir,
   guarda-se onde está o balneário no ecrã (e o desenho). O ecrã de
   carregamento mostra-o no mesmo sítio e o ecrã inicial faz crescer o
   balneário dali até ao lugar dele — como se fosse o mesmo ecrã. */
/* A ENTRADA PELA PORTA — o ecrã seguinte está mesmo atrás da porta.
   Com o PIN certo (ou a impressão digital), o resto do ecrã da porta
   apaga-se e fica só o vidro. Quando o Portal está pronto, o ecrã que vem
   a seguir (o balneário da página inicial, os parabéns ou a missão) já está
   desenhado ATRÁS do vidro, encaixado no buraco da porta; o vidro abre e,
   ainda a abrir, esse ecrã cresce até à página inteira. É sempre o mesmo
   ecrã, por isso não há imagens trocadas nem paragens a meio. */
export let ENTRADA = null; // { rect, fundo: { svg, H }, logo, cor, t }

/* Quando o acesso foi autorizado (para a barra de cima do sistema não
   piscar na passagem da porta para o Portal: ver o ecrã da porta). */
export let ENTRADA_T = 0;

/* PRÉ-BUSCA: com o PIN certo, os pedidos que o Portal faz ao abrir partem
   todos logo, em paralelo (antes iam um a seguir ao outro, já com a porta
   à espera). Quando o Portal os pede, já estão prontos (ou a caminho). */
export const PREBUSCA = new Map();

export function prebuscarPortal(code, teamId) {
  if (!code || !teamId) return;
  const chamar = (rpc, args) => {
    const k = `${rpc}|${code}|${teamId}`;
    if (!PREBUSCA.has(k)) PREBUSCA.set(k, { t: Date.now(), p: Promise.resolve(supabase.rpc(rpc, args)) });
  };
  chamar('checkin_bootstrap', { p_code: code, p_days: CHECKIN_DAYS_BACK, p_team: teamId });
  ['checkin_tarefas', 'checkin_tarefas_destinos', 'checkin_convocatoria', 'checkin_competicao']
    .forEach(r => chamar(r, { p_code: code, p_team: teamId }));
}

export function tirarPrebusca(rpc, code, teamId) {
  const k = `${rpc}|${code}|${teamId}`;
  const v = PREBUSCA.get(k);
  if (!v) return null;
  PREBUSCA.delete(k);
  return Date.now() - v.t < 30000 ? v.p : null;
}

export const entradaRecente = () => !!(ENTRADA && Date.now() - ENTRADA.t < 20000);

// A porta fechada enquanto o Portal acaba de carregar (igual à da entrada).
export function PortaAEspera() {
  const [ent] = useState(() => ENTRADA);
  if (!ent) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg }}>
      <style>{PE_SEM_GUTTER}</style>
      {ent.resto && <PeRestoEntrada html={ent.resto} apagar={false} />}
      <PortaVidroSo rect={ent.rect} aberto={false} logo={ent.logo} cor={ent.cor} fundo={ent.fundo} tamEmblema={ent.tam} />
    </div>
  );
}

/* O RESTO DO ECRÃ DE ENTRADA (cabeçalho com a bola verde, letreiro
   "ACESSO AUTORIZADO", impressão digital…) continua à vista enquanto o
   Portal carrega: é uma cópia fiel do ecrã, tirada no momento da entrada.
   Só se desvanece quando a porta abre, ao mesmo tempo que o vidro. A
   camada isola-se (isolation) para ficar sempre por baixo da porta. */
/* Enquanto a porta está em cena, a página não reserva o espaço da barra de
   scroll. O ecrã de entrada já não o reserva, mas o Portal sim
   ("scrollbar-gutter: stable"): na troca de um para o outro, a largura útil
   encolhia e tudo o que está centrado saltava uns pixéis para a esquerda
   antes de a porta abrir. */
export const PE_SEM_GUTTER = `html, body { overflow: hidden !important; } html { scrollbar-gutter: auto !important; background: ${T.bg}; }`;

export function PeRestoEntrada({ html, apagar }) {
  return (
    <div aria-hidden="true" data-resto-entrada="" style={{
      position: 'fixed', inset: 0, zIndex: 0, isolation: 'isolate', pointerEvents: 'none',
      opacity: apagar ? 0 : 1, transition: 'opacity .55s cubic-bezier(.4,0,.2,1)', willChange: 'opacity',
    }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// O vidro da porta, sozinho, no sítio exato onde estava. Com `caixa`, é
// desenhado noutro referencial (dentro do ecrã que cresce): left/top/
// width/height/tam/raio já vêm nessas unidades.
export function PortaVidroSo({ rect, aberto, logo, cor, caixa, fundo, tamEmblema, recolhido }) {
  const c = caixa || { left: rect.left, top: rect.top, width: rect.width, height: rect.height, tam: tamEmblema || Math.round(rect.height * 0.78), raio: 3, fixo: true };
  /* CADA FOLHA LEVA CONSIGO A SUA METADE DO QUE SE VÊ ATRÁS DO VIDRO (o
     balneário, desfocado). Assim a imagem da porta nunca muda: quando as
     folhas deslizam, o ecrã novo vai aparecendo na abertura, à medida que
     a porta abre — como numa porta de verdade. Vale para todos os ecrãs que
     saem da porta (ecrã inicial, parabéns, missão, jogo).
     O desfoque é um filtro fixo na imagem (e não um backdrop-filter, que
     tinha de ser recalculado a cada frame enquanto o ecrã cresce). */
  const folha = {
    position: 'absolute', top: 0, bottom: 0, width: '50%', overflow: 'hidden', willChange: 'transform',
    // Arranca devagar e trava devagar (ease-in-out).
    // No último terço do caminho, a folha também se apaga: não fica um fio
    // branco agarrado às bordas enquanto o ecrã cresce.
    // Folhas mais rápidas (0,65 s) e já invisíveis aos 0,55 s: o desfoque
    // delas a andar por cima do ecrã que cresce custava frames.
    transition: 'transform .65s cubic-bezier(.65,0,.35,1), opacity .25s ease-in .3s',
  };
  const metade = (lado) => (
    <>
      {fundo && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: lado === 'E' ? 0 : '-100%', width: '200%', overflow: 'hidden', background: '#121614' }}>
          <svg viewBox={`0 0 300 ${fundo.H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%"
            style={{ display: 'block', position: 'absolute', inset: 0, filter: `blur(${c.desfoque || 7}px)`, transform: 'scale(1.06)' }}
            dangerouslySetInnerHTML={{ __html: fundo.svg }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(225,240,248,.6), rgba(170,200,215,.4))' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: lado === 'E' ? 0 : '-100%', width: '200%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: logo ? 0.6 : 1 }}>
        <PeEmblema logo={logo} cor={cor} tam={c.tam} branco />
      </div>
    </>
  );
  return (
    /* Dentro do ecrã que cresce (`caixa`), o vidro tem os cantos RETOS: a
       janela por onde se vê o ecrã novo também é reta, e com os cantos
       arredondados o ecrã de trás espreitava pelos quatro cantos (viam-se
       letras) antes de a porta abrir. A janela corta tudo o que passa da
       borda, por isso, de fora, a porta continua igual. */
    <div aria-hidden="true" style={{ position: c.fixo ? 'fixed' : 'absolute', left: c.left, top: c.top, width: c.width, height: c.height, overflow: 'hidden', borderRadius: c.fixo ? c.raio : 0, zIndex: 9999, pointerEvents: 'none' }}>
      {/* Depois de abertas (já fora do buraco da porta), as folhas saem de cena. */}
      {!recolhido && <div data-folha="E" style={{ ...folha, left: 0, transform: aberto ? 'translateX(-101%)' : 'none', opacity: aberto ? 0 : 1 }}>{metade('E')}</div>}
      {!recolhido && <div data-folha="D" style={{ ...folha, right: 0, transform: aberto ? 'translateX(101%)' : 'none', opacity: aberto ? 0 : 1 }}>{metade('D')}</div>}
      {/* A junta das folhas: 1 px no ecrã (nas unidades da caixa, 1/esc0). */}
      {!recolhido && <div data-junta="" style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: c.fixo ? 1 : c.raio / 3, background: 'rgba(255,255,255,.9)', opacity: aberto ? 0 : 1, transition: 'opacity .12s' }} />}
    </div>
  );
}

/* Envolve o primeiro ecrã do Portal. Sem entrada pela porta, não faz nada.
   `focoInteiro`: o ecrã todo vai para o buraco da porta (parabéns, missão);
   senão vai o elemento marcado com data-entrada-foco (o balneário). */
export function TransicaoEntrada({ focoInteiro, children }) {
  /* Duas camadas: a "janela" (o buraco da porta, que cresce até ao ecrã) e
     o conteúdo lá dentro (que encolhe na mesma medida e se desloca, para o
     foco ficar sempre certo). Tudo com transform — o browser anima isto sem
     redesenhar o ecrã a cada frame, por isso não engasga mesmo em ecrãs
     pesados como o do jogo. Os passos são calculados à mão (com a curva já
     aplicada) para a janela e o conteúdo andarem sempre certos um com o
     outro. */
  const janelaRef = useRef(null), conteudoRef = useRef(null);
  const [ent] = useState(() => (entradaRecente() ? ENTRADA : null));
  const [ativa, setAtiva] = useState(!!ent);
  const [vidroAberto, setVidroAberto] = useState(false);
  const [vidroRecolhido, setVidroRecolhido] = useState(false);
  const [caixaVidro, setCaixaVidro] = useState(null);
  React.useLayoutEffect(() => {
    if (!ent) return undefined;
    // Onde a porta está agora (o ecrã anterior registou-o ao sair).
    const rectAgora = (ENTRADA && ENTRADA.rect) || ent.rect;
    ENTRADA = null;
    const jan = janelaRef.current, con = conteudoRef.current;
    const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const acabar = () => { setAtiva(false); window.dispatchEvent(new CustomEvent('mjp-entrada-fim')); };
    if (!jan || !con || reduzir || typeof jan.animate !== 'function') { acabar(); return undefined; }
    // Medidas reais da janela (no telemóvel, 100vh pode não ser a altura visível).
    const vw = jan.clientWidth || window.innerWidth, vh = jan.clientHeight || window.innerHeight;
    const alvoEl = !focoInteiro ? con.querySelector('[data-entrada-foco]') : null;
    const f = alvoEl ? alvoEl.getBoundingClientRect() : { left: 0, top: 0, width: vw, height: vh };
    const d = rectAgora;
    const esc0 = Math.max(d.width / f.width, d.height / f.height);
    const fcx = f.left + f.width / 2, fcy = f.top + f.height / 2;
    const tx0 = (d.left + d.width / 2) - esc0 * fcx, ty0 = (d.top + d.height / 2) - esc0 * fcy;
    const lerp = (a1, b1, p) => a1 + (b1 - a1) * p;
    // Curva suave nas duas pontas (sem arranque seco nem travagem brusca).
    const curva = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    const passo = (p) => {
      const wl = lerp(d.left, 0, p), wt = lerp(d.top, 0, p), ww = lerp(d.width, vw, p), wh = lerp(d.height, vh, p);
      const sx = ww / vw, sy = wh / vh;
      const esc = lerp(esc0, 1, p), tx = lerp(tx0, 0, p), ty = lerp(ty0, 0, p);
      return {
        janela: `translate(${wl}px, ${wt}px) scale(${sx}, ${sy})`,
        conteudo: `scale(${1 / sx}, ${1 / sy}) translate(${tx - wl}px, ${ty - wt}px) scale(${esc})`,
      };
    };
    const inicio = passo(0);
    jan.style.transform = inicio.janela;
    con.style.transform = inicio.conteudo;
    // O buraco da porta nas medidas do ecrã de trás (antes de encolher).
    setCaixaVidro({
      left: fcx - d.width / 2 / esc0, top: fcy - d.height / 2 / esc0,
      width: d.width / esc0, height: d.height / esc0, tam: (ent.tam || d.height * 0.78) / esc0, raio: 3 / esc0,
      /* O desfoque também tem de estar nestas unidades: o ecrã de trás está
         encolhido (esc0) e, com 7 px fixos, o balneário ficava mais nítido
         (e parecia mais claro) no instante em que a porta passava para aqui. */
      desfoque: 7 / esc0,
    });
    let cancelado = false;
    /* Espera que o ecrã de trás acabe de se montar (o do jogo é pesado)
       antes de abrir: assim a abertura nunca apanha um engasgo.
       Com a porta fechada nada muda: o balneário continua atrás do vidro.
       No MESMO instante: o vidro abre, o balneário dá lugar ao ecrã que
       entra (o jogo, os parabéns, a missão ou o ecrã inicial), o resto do
       ecrã de entrada desvanece-se e a janela cresce até à página inteira. */
    let r1 = 0, r2 = 0, tempo = 0;
    /* SÓ ABRE COM O BROWSER LIVRE. Ecrãs pesados (o do jogo) continuam a
       trabalhar depois de aparecerem (efeitos, contagem, imagens): se a
       porta abrisse logo, a animação corria "às escuras" durante esse
       trabalho e o primeiro frame visível já mostrava o ecrã quase inteiro,
       sem se ver a porta a abrir. Aqui espera-se por 4 frames seguidos
       fluidos (no máximo 2 s), com a porta fechada e o "acesso autorizado"
       à vista; depois a abertura é igual em todos os ecrãs. */
    const esperarCalma = (seguir) => {
      let ult = 0, bons = 0, ini = 0;
      const f = (t) => {
        if (cancelado) return;
        if (!ini) { ini = t; ult = t; r1 = requestAnimationFrame(f); return; }
        bons = (t - ult) < 34 ? bons + 1 : 0;
        ult = t;
        if (bons >= 4 || t - ini > 2000) seguir(); else r1 = requestAnimationFrame(f);
      };
      r1 = requestAnimationFrame(f);
    };
    /* RELÓGIO COM TRAVÃO. A abertura é desenhada frame a frame com um
       relógio próprio que nunca avança mais de 34 ms por frame. Se o
       browser se atrasar (ecrãs pesados, como o do jogo, ainda a ser
       desenhados), a porta abranda nesse instante em vez de saltar para a
       frente; com frames normais, as durações são as de sempre. Assim todos
       os ecrãs que saem da porta se comportam exatamente como o dos
       parabéns.
       Passagem, no relógio da animação:
         0 ms    as folhas começam a abrir (0,65 s), cada uma com a sua
                 metade da imagem da porta (que nunca muda); o ecrã novo vai
                 aparecendo na abertura; o resto do ecrã de entrada
                 desvanece-se (0,55 s);
         300 ms  o ecrã cresce até à página inteira (1 s, a acelerar e a
                 travar devagar); as folhas apagam-se enquanto saem
                 (até aos 550 ms);
         600 ms  as folhas, já invisíveis, saem de cena;
         1300 ms fim. */
    const lim = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const entrada = (p) => p * p;
    const saida = (p) => 1 - Math.pow(1 - p, 3);
    esperarCalma(() => {
      if (cancelado) return;
      const folhas = Array.from(con.querySelectorAll('[data-folha]'));
      const junta = con.querySelector('[data-junta]');
      const resto = document.querySelector('[data-resto-entrada]');
      [...folhas, junta, resto].forEach(el => { if (el) el.style.transition = 'none'; });
      let v = 0, ult = 0, recolhidas = false;
      const quadro = (t) => {
        if (cancelado) return;
        if (ult) v += Math.min(t - ult, 34);
        ult = t;
        const pf = curva(lim(v / 650)), of = 1 - entrada(lim((v - 300) / 250));
        if (!recolhidas) folhas.forEach(el => {
          el.style.transform = `translateX(${el.dataset.folha === 'E' ? -101 * pf : 101 * pf}%)`;
          el.style.opacity = String(of);
        });
        if (junta) junta.style.opacity = String(1 - lim(v / 120));
        if (resto) resto.style.opacity = String(1 - saida(lim(v / 550)));
        if (!recolhidas && v >= 600) {
          recolhidas = true;
          folhas.forEach(el => { el.style.display = 'none'; });
          if (junta) junta.style.display = 'none';
        }
        const q = passo(curva(lim((v - 300) / 1000)));
        jan.style.transform = q.janela;
        con.style.transform = q.conteudo;
        if (v >= 1300) { jan.style.transform = ''; con.style.transform = ''; acabar(); return; }
        r2 = requestAnimationFrame(quadro);
      };
      r2 = requestAnimationFrame(quadro);
    });
    return () => { cancelado = true; clearTimeout(tempo); cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {/* Enquanto a porta abre, as animações do próprio ecrã (flashes do
          estádio, placard a cair, bilhete a entrar…) ficam em pausa: cada uma
          obrigava a redesenhar a camada que está a crescer, e era isso que
          engasgava. Arrancam quando o ecrã já está na página inteira. */}
      {ativa && <style>{PE_SEM_GUTTER}</style>}
      {ativa && <style>{`.mjp-entrada-ativa *, .mjp-entrada-ativa *::before, .mjp-entrada-ativa *::after { animation-play-state: paused !important; } .mjp-entrada-ativa [data-entrada-anima] { animation-play-state: running !important; } .mjp-entrada-ativa [data-festa-papel] { visibility: hidden !important; }`}</style>}
      {/* O resto do ecrã de entrada fica por baixo da janela que cresce e
          desvanece-se enquanto a porta abre. */}
      {ativa && ent && ent.resto && <PeRestoEntrada html={ent.resto} apagar={vidroAberto} />}
      <div ref={janelaRef} className={ativa ? 'mjp-entrada-ativa' : undefined} style={ativa ? { position: 'fixed', inset: 0, overflow: 'hidden', transformOrigin: '0 0', background: T.bg, willChange: 'transform' } : undefined}>
        {/* will-change: as duas camadas ficam prontas (já desenhadas) antes de
            o crescimento arrancar. Sem isto, o browser preparava-as no
            primeiro frame da animação e havia um pequeno engasgo. */}
        <div ref={conteudoRef} style={ativa ? { position: 'absolute', inset: 0, transformOrigin: '0 0', willChange: 'transform' } : undefined}>
          {children}
          {/* O vidro está no mesmo referencial do ecrã: abre, apaga-se e,
              enquanto isso, cresce e é cortado com ele — nada fica preso no
              sítio da porta. */}
          {ativa && ent && <PortaVidroSo rect={ent.rect} caixa={caixaVidro || undefined} aberto={vidroAberto} recolhido={vidroRecolhido} logo={ent.logo} cor={ent.cor} fundo={ent.fundo} />}
        </div>
      </div>
    </>
  );
}

/* Porta automática de vidro fosco com o emblema do clube a toda a altura,
   cada metade do emblema numa folha. Atrás, o balneário da página inicial
   (com o cacifo do jogador) e a TV a dar as boas-vindas. */
export function PePorta({ aberta, jogador, cor, logo, clube, largura, altura, faceId = 'desligado', onEmblema, pista }) {
  const caixaRef = useRef(null);
  const portaRef = useRef(null);

  const [tam, setTam] = useState({ w: 260, h: 180 });
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const medir = () => { if (el.clientWidth && el.clientHeight) setTam(t => (t.w === el.clientWidth && t.h === el.clientHeight ? t : { w: el.clientWidth, h: el.clientHeight })); };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.max(215, Math.min(420, (300 * tam.h) / Math.max(1, tam.w))));
  // A porta é agora deitada (como o quadro da equipa técnica): o emblema
  // ocupa 42 % da altura do vidro (o Face ID, à volta, 52 %). O mesmo
  // tamanho passa para a abertura.
  const tamEmblema = Math.round(tam.h * (largura ? 0.42 : 0.78));
  const nome = String((jogador && jogador.nome) || '').trim();
  const primeiro = nome ? nome.split(/\s+/)[0] : '';
  const numero = jogador && jogador.numero != null && String(jogador.numero).trim() !== '' ? String(jogador.numero).trim() : '';
  const svg = React.useMemo(() => pkhBalneario({
    cor, numero, nome: primeiro, foto: (jogador && jogador.foto) || '', iniciais: peIniciais(nome),
    logo: logo || '', inicialClube: clube ? String(clube)[0].toUpperCase() : '', badge: 0, boasVindas: primeiro || 'Atleta',
    // A mesma luz do ecrã inicial (de madrugada, só a luz de presença): a imagem da porta não muda ao abrir.
    apagado: (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() < CHECKIN_WINDOWS.wellness.startMin ? 'presenca' : false; })(),
  }, 300, H), [T.corEquipa, numero, primeiro, jogador && jogador.foto, logo, clube, H]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Acesso autorizado: guarda onde está o vidro (o ecrã seguinte vai
     aparecer atrás dele) e o resto da porta apaga-se. O vidro só abre já
     com o Portal pronto por trás (ver TransicaoEntrada). */
  /* Acesso autorizado: o resto do ecrã apaga-se e a porta fica onde está.
     Guarda-se o sítio do vidro e o que se vê atrás dele (o balneário), para
     o ecrã seguinte começar exatamente daqui. */
  useEffect(() => {
    if (!aberta) { ENTRADA = null; return undefined; }
    const el = caixaRef.current;
    if (!el) return undefined;
    const r = el.getBoundingClientRect();
    ENTRADA_T = Date.now();
    ENTRADA = {
      rect: { left: r.left, top: r.top, width: r.width, height: r.height }, fundo: { svg, H },
      tam: tamEmblema, logo: logo || '', cor, t: Date.now(),
    };
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);
  /* Com o acesso autorizado, o letreiro, a moldura e a base ficam à vista
     (o letreiro fica verde). Só se desvanecem quando a porta abre, já no
     Portal (ver PeRestoEntrada). */
  const apagar = {};
  const vidro = {
    position: 'absolute', top: 0, bottom: 0, width: '50%', overflow: 'hidden',
    background: 'linear-gradient(160deg, rgba(225,240,248,.6), rgba(170,200,215,.4))',
    transition: 'transform 1.1s cubic-bezier(.4,.1,.2,1)',
  };
  // O emblema ocupa a porta toda; cada folha mostra a sua metade.
  const emblemaNoVidro = (lado) => (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: lado === 'E' ? 0 : '-100%', width: '200%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: logo ? 0.6 : 1 }}>
      <PeEmblema logo={logo} cor={cor} tam={tamEmblema} branco />
    </div>
  );
  const corSinal = aberta ? '#4CAF6A' : '#FF5A4E';
  // (o sinal verde e o letreiro mudam no instante em que o acesso é autorizado)
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...(largura ? { flex: 'none' } : { flex: 1, minHeight: 0 }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0d120f', border: '1px solid #3a4440', borderRadius: 8, padding: largura ? '6px 16px' : '5px 12px', boxShadow: '0 0 14px rgba(255,194,61,.15)', marginBottom: largura ? 14 : 8, flexShrink: 0, boxSizing: 'border-box', ...apagar }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: corSinal, boxShadow: `0 0 8px ${corSinal}`, transition: 'all .3s' }} />
        <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
          <div style={{ fontSize: 11, letterSpacing: '.18em', color: aberta ? '#8EE6A0' : '#8A9A8C', transition: 'color .3s', ...body }}>{aberta ? 'ACESSO AUTORIZADO' : 'ACESSO RESERVADO'}</div>
          <div style={{ ...display, fontSize: 17, fontWeight: 600, letterSpacing: largura ? '.3em' : '.24em', color: aberta ? '#8EE6A0' : '#FFC23D', transition: 'color .3s' }}>PLANTEL</div>
        </div>
      </div>
      {/* Proporção de porta (5:6): com menos altura fica mais estreita, em
          vez de achatada (iPad deitado, telemóveis baixos). */}
      <div ref={portaRef} style={largura ? {
        position: 'relative', zIndex: 2, flex: 'none', width: largura + 14, height: altura + 14, borderRadius: 8, padding: 7, boxSizing: 'border-box', display: 'flex',
      } : {
        position: 'relative', zIndex: 2, flex: 1, minHeight: 120, maxHeight: 'min(48dvh, 520px)', aspectRatio: '5 / 6', width: 'auto', maxWidth: '100%', borderRadius: 8, padding: 7, boxSizing: 'border-box', display: 'flex',
      }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 8, ...(largura && TEMA_ATUAL === 'claro'
          ? { background: 'linear-gradient(90deg,#AEB7B1,#E2E7E3 50%,#AEB7B1)', boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,.8), 0 14px 26px rgba(30,40,30,.28)' }
          : { background: 'linear-gradient(90deg,#3a423d,#59635d 50%,#3a423d)', boxShadow: '0 10px 24px rgba(0,0,0,.45)' }), ...apagar }} />
        <div ref={caixaRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', borderRadius: 3, background: '#121614' }}>
          {/* Desfocado com o MESMO filtro das folhas da porta que abre no
              Portal (PortaVidroSo): a imagem fica idêntica na passagem. */}
          <svg viewBox={`0 0 300 ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block', position: 'absolute', inset: 0, filter: 'blur(7px)', transform: 'scale(1.06)' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
          <div style={{ ...vidro, left: 0 }}>{emblemaNoVidro('E')}</div>
          <div style={{ ...vidro, right: 0 }}>{emblemaNoVidro('D')}</div>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.9)' }} />
        </div>
        {/* O EMBLEMA É O FACE ID (o "pontapé de saída", como na equipa
            técnica): os quatro cantos, a onda de luz e, nas primeiras vezes,
            um dedo que toca. Saem quando o acesso é autorizado — não vão na
            cópia do ecrã que fica por baixo da porta a abrir. */}
        {largura && !aberta && onEmblema && (() => {
          const t = Math.round(altura * 0.52), c = Math.round(t * 0.22);
          const corC = faceId === 'ok' ? '#8EE6A0' : '#C9A227';
          const canto = (o) => ({ position: 'absolute', width: c, height: c, borderColor: corC, borderStyle: 'solid', borderWidth: 0, boxSizing: 'border-box', ...o });
          return (
            <>
              {faceId !== 'desligado' && (
                <div aria-hidden="true" style={{ position: 'absolute', left: 7 + largura / 2 - t / 2, top: 7 + altura / 2 - t / 2, width: t, height: t, pointerEvents: 'none', zIndex: 3,
                  animation: faceId === 'pronto' ? 'pe-respira 2.2s ease-in-out infinite' : 'none' }}>
                  {faceId === 'pronto' && <div style={{ position: 'absolute', inset: '4%', borderRadius: '50%', boxSizing: 'border-box', border: '2.5px solid rgba(255,214,120,.95)', boxShadow: '0 0 16px rgba(255,214,120,.65), inset 0 0 10px rgba(255,214,120,.35)', animation: 'pe-anel 2.2s cubic-bezier(.2,.6,.3,1) infinite' }} />}
                  <div style={canto({ left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 8 })} />
                  <div style={canto({ right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 8 })} />
                  <div style={canto({ left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 8 })} />
                  <div style={canto({ right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 8 })} />
                  {pista && faceId === 'pronto' && (
                    <svg width="34" height="40" viewBox="0 0 24 28" aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -4, marginTop: 2, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.6))', animation: 'pe-dedo 2.6s ease-in-out .8s 2 both' }}>
                      <path d="M9 2.5a2 2 0 0 1 4 0V12l1.2-.6a2 2 0 0 1 2.6.9l.3.6 1.4-.4a2 2 0 0 1 2.4 1.5l.1.6.9-.1a2 2 0 0 1 2.1 2v4.3c0 3.9-3.2 7-7.1 7H14c-2.3 0-4.4-1.1-5.7-3L3.6 18.3a2 2 0 0 1 .4-2.8 2 2 0 0 1 2.6.2L9 18V2.5z" fill="#FBF3F0" stroke="#0D120F" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                  )}
                  {faceId === 'a-ler' && <div style={{ position: 'absolute', left: '8%', right: '8%', height: 2, background: '#FFC23D', boxShadow: '0 0 8px #FFC23D', animation: 'pe-varre 1s ease-in-out infinite' }} />}
                </div>
              )}
              <button type="button" onClick={onEmblema} aria-label={faceId === 'desligado' ? 'Entrar com o PIN' : `Entrar com ${PE_BIO_TXT.comArtigo}`}
                style={{ position: 'absolute', left: 7 + largura / 2 - altura * 0.2, top: 7 + altura / 2 - altura * 0.2, width: altura * 0.4, height: altura * 0.4, borderRadius: '50%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', zIndex: 4 }} />
            </>
          );
        })()}
      </div>
      {!largura && <div style={{ width: 'min(60%, 220px)', height: 8, borderRadius: '0 0 4px 4px', background: '#2a332d', flexShrink: 0, ...apagar }} />}
    </div>
  );
}

/* INSTALAR O PORTAL NO TELEMÓVEL (ícone no ecrã inicial). Assim o atleta
   abre sempre pelo mesmo sítio e o cartão fica lá guardado de vez.
   · Android/Chrome: o navegador oferece "Instalar" (evento guardado em
     window.__mjpInstalar, ver prepararPortalInstalavel).
   · iPhone: não há botão automático — mostram-se os passos (Partilhar →
     Adicionar ao ecrã principal). O ícone do iPhone tem a memória separada
     do Safari: na 1.ª vez que abrir pelo ícone, recupera o cartão com o
     código antigo e o PIN.
   Já instalado (aberto pelo ícone): não aparece. */
export function peEstaInstalado() {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; }
}

export function PeInstalar({ estilo, aoAbrir }) {
  const [pedido, setPedido] = useState(() => (typeof window !== 'undefined' ? window.__mjpInstalar || null : null));
  const [ajuda, setAjuda] = useState(false);
  useEffect(() => {
    const f = () => setPedido(window.__mjpInstalar || null);
    window.addEventListener('mjp-instalavel', f);
    return () => window.removeEventListener('mjp-instalavel', f);
  }, []);
  if (typeof window === 'undefined' || peEstaInstalado()) return null;
  const ua = navigator.userAgent || '';
  const iphone = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const instalar = async () => {
    if (pedido) {
      try { pedido.prompt(); await pedido.userChoice; } catch (e) { /* cancelado */ }
      window.__mjpInstalar = null; setPedido(null);
      if (aoAbrir) aoAbrir();
      return;
    }
    setAjuda(true);
  };
  return (
    <>
      <button type="button" onClick={instalar} style={estilo}>Instalar app no dispositivo</button>
      {ajuda && (
        <div onClick={() => setAjuda(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '18px 18px 14px', color: T.cream, ...body }}>
            <div style={{ ...display, fontSize: 19, fontWeight: 600, marginBottom: 10 }}>Instalar app no dispositivo</div>
            {iphone ? (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: T.muted }}>
                <li>Abre este link no <strong style={{ color: T.cream }}>Safari</strong>.</li>
                <li>Toca em <strong style={{ color: T.cream }}>Partilhar</strong> (o quadrado com a seta para cima).</li>
                <li>Escolhe <strong style={{ color: T.cream }}>Adicionar ao ecrã principal</strong>.</li>
                <li>Abre o Portal pelo ícone novo. Na primeira vez, usa <strong style={{ color: T.cream }}>Entrar com o código antigo</strong> e o teu PIN.</li>
              </ol>
            ) : android ? (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: T.muted }}>
                <li>Abre este link no <strong style={{ color: T.cream }}>Chrome</strong> (se estiveres dentro do WhatsApp, toca nos três pontos e escolhe abrir no navegador).</li>
                <li>Toca nos <strong style={{ color: T.cream }}>três pontos</strong> do canto.</li>
                <li>Escolhe <strong style={{ color: T.cream }}>Instalar app</strong> ou <strong style={{ color: T.cream }}>Adicionar ao ecrã principal</strong>.</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: T.muted }}>
                <li>Usa o <strong style={{ color: T.cream }}>Chrome</strong> ou o <strong style={{ color: T.cream }}>Edge</strong> (o Safari e o Firefox do computador não instalam apps).</li>
                <li>Na barra do endereço, à direita, toca no ícone de <strong style={{ color: T.cream }}>instalar</strong> (um ecrã com uma seta), ou abre o menu <strong style={{ color: T.cream }}>⋮</strong> e escolhe <strong style={{ color: T.cream }}>Instalar Portal do Atleta</strong>.</li>
                <li>Se não aparecer essa opção, a app já está instalada neste computador: procura <strong style={{ color: T.cream }}>Portal</strong> nas aplicações.</li>
              </ol>
            )}
            <button type="button" onClick={() => setAjuda(false)} style={{ marginTop: 14, width: '100%', padding: 11, borderRadius: 12, border: 'none', background: T.goldFundo, color: '#1A2A1F', ...display, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Percebi</button>
          </div>
        </div>
      )}
    </>
  );
}

/* Gerador de QR code compacto (modo byte, correção L, versões 1–10).
   Chega para o link de ligação do cartão (~90 caracteres). */
export function qrMatriz(texto) {
  const bytes = Array.from(new TextEncoder().encode(texto));
  const TAB = { 1: [7, [[1, 19]]], 2: [10, [[1, 34]]], 3: [15, [[1, 55]]], 4: [20, [[1, 80]]], 5: [26, [[1, 108]]], 6: [18, [[2, 68]]], 7: [20, [[2, 78]]], 8: [24, [[2, 97]]], 9: [30, [[2, 116]]], 10: [18, [[2, 68], [2, 69]]] };
  const ALINH = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  let v = 1, dadosCw = 0;
  for (; v <= 10; v++) {
    dadosCw = TAB[v][1].reduce((s, [n, c]) => s + n * c, 0);
    const bitsConta = v < 10 ? 8 : 16;
    if (4 + bitsConta + bytes.length * 8 <= dadosCw * 8) break;
  }
  if (v > 10) throw new Error('Texto demasiado longo para o QR');
  const bits = [];
  const poe = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  poe(4, 4); poe(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => poe(b, 8));
  for (let i = 0; i < 4 && bits.length < dadosCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let k = 0; cw.length < dadosCw; k++) cw.push(k % 2 ? 0x11 : 0xEC);
  // Reed-Solomon em GF(256)
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  const ecN = TAB[v][0];
  let gen = [1];
  for (let i = 0; i < ecN; i++) {
    const g = new Array(gen.length + 1).fill(0);
    gen.forEach((c, j) => { g[j] ^= c; g[j + 1] ^= mul(c, EXP[i]); });
    gen = g;
  }
  const blocos = [], ecs = [];
  let pos = 0;
  TAB[v][1].forEach(([n, c]) => {
    for (let b = 0; b < n; b++) {
      const d = cw.slice(pos, pos + c); pos += c; blocos.push(d);
      const r = d.concat(new Array(ecN).fill(0));
      for (let i = 0; i < d.length; i++) { const f = r[i]; if (f) gen.forEach((g, j) => { r[i + j] ^= mul(g, f); }); }
      ecs.push(r.slice(d.length));
    }
  });
  const fim = [];
  const maxD = Math.max(...blocos.map(b => b.length));
  for (let i = 0; i < maxD; i++) blocos.forEach(b => { if (i < b.length) fim.push(b[i]); });
  for (let i = 0; i < ecN; i++) ecs.forEach(e => fim.push(e[i]));
  // matriz
  const N = 17 + 4 * v;
  const M = Array.from({ length: N }, () => new Array(N).fill(null));
  const fixo = Array.from({ length: N }, () => new Array(N).fill(false));
  const set = (r, c, val) => { M[r][c] = val; fixo[r][c] = true; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const dentro = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const anel = dentro && (r === 0 || r === 6 || c === 0 || c === 6);
      const meio = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(rr, cc, dentro && (anel || meio) ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) { set(6, i, i % 2 ? 0 : 1); set(i, 6, i % 2 ? 0 : 1); }
  const al = ALINH[v];
  al.forEach(r => al.forEach(c => {
    if ((r === 6 && c === 6) || (r === 6 && c === N - 7) || (r === N - 7 && c === 6)) return;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) === 1 ? 0 : 1);
  }));
  set(N - 8, 8, 1); // módulo escuro
  for (let i = 0; i < 9; i++) { if (!fixo[8][i]) set(8, i, 0); if (!fixo[i][8]) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { set(8, N - 1 - i, 0); set(N - 1 - i, 8, 0); }
  if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { set(i, N - 11 + j, 0); set(N - 11 + j, i, 0); }
  // dados em zigue-zague
  const dbits = [];
  fim.forEach(b => { for (let i = 7; i >= 0; i--) dbits.push((b >> i) & 1); });
  let k = 0, sobe = true;
  for (let c = N - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let i = 0; i < N; i++) {
      const r = sobe ? N - 1 - i : i;
      for (let d = 0; d < 2; d++) {
        const cc = c - d;
        if (!fixo[r][cc]) { M[r][cc] = k < dbits.length ? dbits[k] : 0; k++; }
      }
    }
    sobe = !sobe;
  }
  const mascaras = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  const bch = (dados, polinomio, nBits) => {
    let x = dados << nBits;
    const grau = Math.floor(Math.log2(polinomio));
    while (Math.floor(Math.log2(x || 1)) >= grau && x) x ^= polinomio << (Math.floor(Math.log2(x)) - grau);
    return (dados << nBits) | x;
  };
  const aplica = (m) => {
    const A = M.map(l => l.slice());
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!fixo[r][c] && mascaras[m](r, c)) A[r][c] ^= 1;
    const fmt = bch((0b01 << 3) | m, 0x537, 10) ^ 0x5412;
    const fb = i => (fmt >> i) & 1;
    for (let i = 0; i <= 5; i++) A[8][i] = fb(14 - i);
    A[8][7] = fb(8); A[8][8] = fb(7); A[7][8] = fb(6);
    for (let i = 9; i <= 14; i++) A[14 - i][8] = fb(14 - i);
    for (let i = 0; i <= 7; i++) A[N - 1 - i][8] = fb(14 - i);
    for (let i = 8; i <= 14; i++) A[8][N - 15 + i] = fb(14 - i);
    if (v >= 7) {
      const vi = bch(v, 0x1f25, 12);
      for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1; const a = Math.floor(i / 3), bb = i % 3 + N - 11; A[a][bb] = b; A[bb][a] = b; }
    }
    return A;
  };
  const penal = (A) => {
    let p = 0;
    for (let r = 0; r < N; r++) for (const lin of [A[r], A.map(l => l[r])]) {
      let run = 1;
      for (let i = 1; i < N; i++) { if (lin[i] === lin[i - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      const s = lin.join('');
      p += 40 * ((s.match(/10111010000/g) || []).length + (s.match(/00001011101/g) || []).length);
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const s = A[r][c] + A[r + 1][c] + A[r][c + 1] + A[r + 1][c + 1]; if (s === 0 || s === 4) p += 3; }
    const escuros = A.reduce((s, l) => s + l.reduce((a, b) => a + b, 0), 0);
    p += Math.floor(Math.abs(escuros * 100 / (N * N) - 50) / 5) * 10;
    return p;
  };
  let melhor = null, melhorP = Infinity;
  for (let m = 0; m < 8; m++) { const A = aplica(m); const p = penal(A); if (p < melhorP) { melhorP = p; melhor = A; } }
  return melhor;
}

export function PeQr({ texto, tam = 180 }) {
  let m = null;
  try { m = qrMatriz(texto); } catch (e) { m = null; }
  if (!m) return null;
  const N = m.length, q = 2; // margem branca de 2 módulos
  let d = '';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (m[r][c]) d += `M${c + q} ${r + q}h1v1h-1z`;
  return (
    <svg viewBox={`0 0 ${N + 2 * q} ${N + 2 * q}`} width={tam} height={tam} shapeRendering="crispEdges" role="img" aria-label="QR code para ligar o outro aparelho" style={{ display: 'block', background: '#fff', borderRadius: 8 }}>
      <path d={d} fill="#0d120f" />
    </svg>
  );
}

/* O NOME DE CADA APARELHO na lista "Os teus aparelhos", para o atleta
   saber qual remover: sistema e tipo ("iPhone", "Android", "Computador
   Windows", "Computador Mac"…), o modelo quando o navegador o diz (o
   Chrome no Android, via userAgentData — ex.: "Samsung SM-A536B"), o
   navegador, e "ícone" quando o Portal está instalado no ecrã inicial. */
export async function peDescricaoAparelho() {
  try {
    const ua = navigator.userAgent || '';
    const ipad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    let aparelho = /iphone/i.test(ua) ? 'iPhone' : ipad ? 'iPad'
      : /android/i.test(ua) ? (/mobile/i.test(ua) ? 'Android' : 'Tablet Android')
        : /windows/i.test(ua) ? 'Computador Windows' : /cros/i.test(ua) ? 'Chromebook'
          : /macintosh|mac os x/i.test(ua) ? 'Computador Mac' : /linux/i.test(ua) ? 'Computador Linux' : 'Computador';
    // Modelo do telemóvel (só o Chrome/Edge no Android o revelam).
    try {
      let modelo = '';
      if (/android/i.test(ua) && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const h = await navigator.userAgentData.getHighEntropyValues(['model']);
        modelo = String((h && h.model) || '').trim();
      }
      if ((!modelo || modelo === 'K') && /android/i.test(ua)) {
        const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
        modelo = m ? m[1].trim() : '';
      }
      if (modelo && modelo !== 'K') aparelho = /^SM-/i.test(modelo) ? `Samsung ${modelo}` : modelo;
    } catch (e) { /* sem modelo: fica o tipo */ }
    const nav = /edg\//i.test(ua) ? 'Edge' : /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /opr\//i.test(ua) ? 'Opera'
      : /firefox|fxios/i.test(ua) ? 'Firefox' : /crios|chrome/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'navegador';
    return `${aparelho} · ${peEstaInstalado() ? 'ícone' : nav}`;
  } catch (e) { return 'Aparelho'; }
}

// Regista (ou atualiza) o nome deste aparelho no servidor. Nunca falha alto.
export function peDescreverAparelho(token, teamId) {
  peDescricaoAparelho()
    .then(d => peRpc('checkin_cartao_descrever', { p_token: token, p_team: teamId, p_descricao: d }))
    .catch(() => {});
}

/* IMPRESSÃO DIGITAL / FACE ID (fase 3). O navegador fala com o leitor do
   aparelho (WebAuthn); a Edge Function "portal-biometria" gera os desafios
   e verifica as assinaturas. Aqui só se convertem os dados entre o formato
   do navegador (bytes) e o do servidor (texto base64url). */
export function peB64uParaBuf(s) {
  const b = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}

export function peBufParaB64u(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function peBioDisponivel() {
  try {
    return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (e) { return false; }
}

/* Erros da Edge Function com o motivo à vista (para se perceber logo se é
   a verificação JWT ligada — 401 —, a função não publicada — 404 — ou
   falta de ligação), em vez de só "não foi possível". */
export async function peBioFn(corpo) {
  const { data, error } = await supabase.functions.invoke('portal-biometria', { body: corpo });
  if (error) {
    const estado = error.context && error.context.status;
    let motivo = estado === 401 ? 'erro 401 · verificação JWT da função ligada'
      : estado === 404 ? 'erro 404 · função portal-biometria não encontrada'
        : estado ? `erro ${estado}`
          : /FunctionsFetchError/.test(error.name || '') ? 'sem ligação à função (verificação JWT ou função não publicada)'
            : (error.message || 'erro desconhecido');
    try {
      const corpoErro = error.context && typeof error.context.json === 'function' ? await error.context.json() : null;
      if (corpoErro && (corpoErro.erro || corpoErro.message || corpoErro.msg)) motivo += ` · ${corpoErro.erro || corpoErro.message || corpoErro.msg}`;
    } catch (e) { /* sem corpo */ }
    const e = new Error(motivo); e.diag = motivo; throw e;
  }
  return typeof data === 'string' ? JSON.parse(data) : (data || {});
}

export async function peBioRegistar(o) {
  const cred = await navigator.credentials.create({ publicKey: {
    ...o,
    challenge: peB64uParaBuf(o.challenge),
    user: { ...o.user, id: peB64uParaBuf(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: peB64uParaBuf(c.id) })),
  } });
  return {
    id: cred.id, rawId: peBufParaB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: peBufParaB64u(cred.response.clientDataJSON),
      attestationObject: peBufParaB64u(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
  };
}

export async function peBioAutenticar(o) {
  const cred = await navigator.credentials.get({ publicKey: {
    ...o,
    challenge: peB64uParaBuf(o.challenge),
    allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: peB64uParaBuf(c.id) })),
  } });
  return {
    id: cred.id, rawId: peBufParaB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: peBufParaB64u(cred.response.clientDataJSON),
      authenticatorData: peBufParaB64u(cred.response.authenticatorData),
      signature: peBufParaB64u(cred.response.signature),
      userHandle: cred.response.userHandle ? peBufParaB64u(cred.response.userHandle) : undefined,
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
  };
}

export const peBioRecusa = (teamId) => `mjp-bio-recusa:${teamId || 'sem-equipa'}`;

/* Desafio preparado antes do toque: válido por pouco tempo, para não se
   usar um que o servidor já tenha dado como expirado. */
export const PE_BIO_VALIDADE_MS = 60 * 1000;

/* Abrir o leitor sozinho só onde o navegador o permite sem toque. No
   iPhone/iPad (todos os navegadores são WebKit) e no Safari do Mac, a
   Apple obriga a que o pedido nasça de um toque. */
export function pePodeAutoAbrirBio() {
  try {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPR|SamsungBrowser|Android/.test(ua);
    return !ios && !safari;
  } catch (e) { return false; }
}

/* Nome do desbloqueio conforme o aparelho. O site não escolhe entre dedo
   e cara: é o sistema que usa o desbloqueio forte que tiver. No Android
   isso é quase sempre a impressão digital (o desbloqueio facial da maioria
   dos Android não é considerado seguro o suficiente para isto). */
export function peBioTextos() {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      return { nome: 'Face ID ou Touch ID', comArtigo: 'o Face ID ou o Touch ID', gesto: 'usar a cara ou o dedo' };
    }
    if (/Macintosh/.test(ua)) return { nome: 'Touch ID', comArtigo: 'o Touch ID', gesto: 'usar o dedo' };
    // "Windows Hello" não diz nada a um jogador: fala-se do gesto que ele já
    // conhece (a cara, o dedo ou o PIN com que desbloqueia o computador).
    if (/Windows/.test(ua)) return { nome: 'desbloqueio do computador', comArtigo: 'o desbloqueio do computador', gesto: 'confirmar como desbloqueias o computador' };
  } catch (e) { /* segue para o habitual */ }
  return { nome: 'impressão digital', comArtigo: 'a impressão digital', gesto: 'usar o dedo' };
}

export const PE_BIO_TXT = peBioTextos();

// Uma só abertura automática por carregamento da página: se o atleta
// cancelar, não volta a aparecer sozinho (fica o botão para tocar).
export let peBioAutoFeito = false;

/* ===================================================================
   A CAMISOLA DO ATLETA, PENDURADA POR BAIXO DA PORTA (porta do Portal)
   ===================================================================
   É a mesma lógica da credencial da equipa técnica: de costas, a
   identidade (nome em cima, número ao meio) e a impressão digital no
   fundo; virada, o emblema ao peito e o PIN com o teclado (a tecla vazia
   leva a impressão digital e vira a camisola outra vez). Nas cores do
   clube (coresCamisola). Só visual: o PIN e a impressão digital continuam
   a passar pelas mesmas funções de sempre (tecla, entrarComBio).
   Desenhada a 300 × 330 e ajustada ao ecrã com `escala`. */
export const PE_FORMA_CAMISOLA = 'M120 32 Q150 42 180 32 L226 52 Q244 60 250 82 L262 156 Q262 162 256 163 L232 168 '
  + 'Q226 168 225 162 L218 118 L220 314 Q150 326 80 314 L82 118 L75 162 Q74 168 68 168 '
  + 'L44 163 Q38 162 38 156 L50 82 Q56 60 74 52 Z';

export const PE_ICONE_DEDO = (
  <>
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" />
    <path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </>
);

export const PE_ICONE_TECLADO = (
  <>
    <rect x="3" y="3" width="5" height="5" rx="1" /><rect x="9.5" y="3" width="5" height="5" rx="1" /><rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="9.5" width="5" height="5" rx="1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><rect x="16" y="9.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="16" width="5" height="5" rx="1" />
  </>
);

export const PE_ICONE_VIRAR = (<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>);

export function PeDesenhoCamisola({ cor, lado, id }) {
  const vivo = cor.mangas || '#FFFFFF';
  const frente = lado === 'frente';
  return (
    <svg width="300" height="330" viewBox="0 0 300 330" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block', filter: 'drop-shadow(0 16px 20px rgba(0,0,0,.55))' }}>
      <defs>
        <clipPath id={`${id}f`}><path d={PE_FORMA_CAMISOLA} /></clipPath>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".32" /><stop offset=".26" stopColor="#000" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".07" /><stop offset=".74" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".34" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".1" /><stop offset=".3" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".24" /></linearGradient>
        <pattern id={`${id}m`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="#000" fillOpacity=".13" /></pattern>
      </defs>
      <g clipPath={`url(#${id}f)`}>
        <rect width="300" height="330" fill={cor.base} />
        <path d="M74 52 Q56 60 50 82 L38 156 Q38 162 44 163 L68 168 Q74 168 75 162 L84 112 Z" fill={cor.escuro} opacity=".5" />
        <path d="M226 52 Q244 60 250 82 L262 156 Q262 162 256 163 L232 168 Q226 168 225 162 L216 112 Z" fill={cor.escuro} opacity=".5" />
        <path d="M74 52 Q86 84 84 118" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="1.5" />
        <path d="M226 52 Q214 84 216 118" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="1.5" />
        {!frente && <path d="M86 124 L88 314" fill="none" stroke={vivo} strokeWidth="2" opacity=".85" />}
        {!frente && <path d="M214 124 L212 314" fill="none" stroke={vivo} strokeWidth="2" opacity=".85" />}
        <rect width="300" height="330" fill={`url(#${id}m)`} />
        <rect width="300" height="330" fill={`url(#${id}v)`} />
        <rect width="300" height="330" fill={`url(#${id}l)`} />
        <path d="M112 48 Q118 130 112 300" fill="none" stroke="#000" strokeOpacity=".1" strokeWidth="7" />
        <path d="M190 48 Q182 140 190 300" fill="none" stroke="#000" strokeOpacity=".09" strokeWidth="6" />
      </g>
      <path d="M41 150 Q56 156 72 156" fill="none" stroke={vivo} strokeWidth="6" strokeLinecap="round" />
      <path d="M259 150 Q244 156 228 156" fill="none" stroke={vivo} strokeWidth="6" strokeLinecap="round" />
      <path d="M80 314 Q150 326 220 314" fill="none" stroke={cor.contorno} strokeWidth="3" opacity=".7" />
      {frente
        ? <path d="M122 32 Q150 56 178 32 Q150 24 122 32 Z" fill={cor.contorno} />
        : <path d="M122 32 Q150 18 178 32 Q150 30 122 32 Z" fill={cor.contorno} />}
      <path d={frente ? 'M120 32 Q150 58 180 32' : 'M120 32 Q150 44 180 32'} fill="none" stroke={vivo} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/* O GANCHO E O TUBO. O gancho de ferro preto continua preso por baixo da
   porta; da ponta dele (com uma pequena abraçadeira) desce um tubo fino de
   borracha preta transparente até à gola, para a camisola não parecer
   solta no ar. O espaço ocupado é o mesmo de antes (nada mexe no ecrã): o
   tubo passa para dentro da caixa da camisola e acaba escondido atrás da
   gola. `k` é a escala da camisola. */
export function PeGancho({ k = 1 }) {
  const fim = 34 + 14 + Math.round(26 * k); // altura do gancho + margem de baixo + até à gola
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 40, height: 34, flexShrink: 0, margin: '-1px auto 14px', pointerEvents: 'none' }}>
      <svg width="40" height={fim} viewBox={`0 0 40 ${fim}`} style={{ position: 'absolute', left: 0, top: 0, display: 'block', overflow: 'visible' }}>
        {/* o tubo: preto a 50 %, com um reflexo leve de um lado */}
        <rect x="19" y="28" width="2" height={fim - 28} rx="1" fill="#000" fillOpacity=".5" />
        <path d={`M19.6 31 L19.6 ${fim - 2}`} stroke="#fff" strokeOpacity=".22" strokeWidth=".4" strokeLinecap="round" />
        {/* a abraçadeira na ponta do gancho */}
        <rect x="18" y="27" width="4" height="3" rx="1" fill="#1d201f" />
        <rect x="18.3" y="27.5" width="3.4" height=".7" fill="#4A4F4C" />
        {/* o gancho */}
        <rect x="7" y="0" width="26" height="8" rx="2" fill="#141615" />
        <rect x="8" y="1" width="24" height="1.5" rx=".75" fill="#4A4F4C" />
        <path d="M20 8 L20 15" stroke="#141615" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M20 20 q-9 0 -9 -6 q0 -6 8 -6" fill="none" stroke="#141615" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M20 20 L20 28" stroke="#141615" strokeWidth="3.5" />
        <path d="M19 22 L19 27" stroke="#4A4F4C" strokeWidth="1" />
      </svg>
    </div>
  );
}

export function PeCamisola({ jogador, cor, logo, virada, sensor, pin, rotulo, corRotulo, aberta, teclado }) {
  const nome = String((jogador && jogador.nome) || '').trim();
  const primeiro = (nome ? nome.split(/\s+/)[0] : 'Atleta').toUpperCase();
  const numero = jogador && jogador.numero != null && String(jogador.numero).trim() !== '' ? String(jogador.numero).trim() : '';
  const corNum = cor.texto || '#FFFFFF';
  const face = { position: 'absolute', inset: 0, WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' };
  const corSensor = aberta ? '#8EE6A0' : '#C9A227';
  const tecla = (k, i) => {
    const base = {
      height: 34, borderRadius: 8, background: 'rgba(13,18,15,.9)', border: '1px solid #2a2f33', color: '#FFC23D', padding: 0, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 16, fontWeight: 500,
      cursor: teclado.desativado ? 'default' : 'pointer', opacity: teclado.desativado ? 0.55 : 1,
    };
    if (!k) {
      const ex = teclado.extra;
      return (
        <button key={i} type="button" disabled={!virada || teclado.desativado} onClick={ex.onClick} aria-label={ex.rotulo} title={ex.rotulo} style={base}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ex.icone}</svg>
        </button>
      );
    }
    return <button key={i} type="button" disabled={!virada || teclado.desativado} onClick={() => teclado.onTecla(k)} aria-label={k === '⌫' ? 'Apagar' : k} style={base}>{k}</button>;
  };
  return (
    <div style={{ position: 'relative', width: 300, height: 330, perspective: 1000 }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: virada ? 'rotateY(180deg)' : 'none', transition: 'transform .65s cubic-bezier(.4,.1,.2,1)' }}>
        {/* COSTAS: nome, número e o sensor no fundo */}
        <div style={face} aria-hidden={virada}>
          <PeDesenhoCamisola cor={cor} lado="costas" id="pe-cam-c" />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 56, textAlign: 'center', ...display, fontWeight: 600, fontSize: 24, letterSpacing: '.16em', color: corNum, textShadow: '0 1px 0 rgba(0,0,0,.25)', overflow: 'hidden', whiteSpace: 'nowrap', padding: '0 70px', boxSizing: 'border-box', textOverflow: 'ellipsis' }}>{primeiro}</div>
          {numero && <div style={{ position: 'absolute', left: 0, right: 0, top: 88, textAlign: 'center', ...display, fontWeight: 700, fontSize: 104, lineHeight: 1, color: corNum, WebkitTextStroke: `2px ${cor.contorno}`, paintOrder: 'stroke fill', textShadow: '0 3px 0 rgba(0,0,0,.18)' }}>{numero}</div>}
          <button type="button" onClick={sensor.onClick || undefined} disabled={virada || !sensor.onClick} aria-label={sensor.rotulo}
            style={{ position: 'absolute', left: 118, top: 222, width: 64, height: 64, borderRadius: 14, padding: 0, boxSizing: 'border-box', background: '#0D120F', border: `2px solid ${corSensor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sensor.onClick ? 'pointer' : 'default',
              animation: sensor.pulsar ? 'pe-pulso 2s ease-in-out infinite' : 'none', transition: 'border-color .3s' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={corSensor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ animation: sensor.aLer ? 'pe-respira .5s ease-in-out infinite' : 'none' }}>{sensor.icone}</svg>
          </button>
        </div>
        {/* FRENTE: emblema ao peito e o PIN */}
        <div style={{ ...face, transform: 'rotateY(180deg)' }} aria-hidden={!virada}>
          <PeDesenhoCamisola cor={cor} lado="frente" id="pe-cam-f" />
          <div style={{ position: 'absolute', left: 178, top: 64 }}><PeEmblema logo={logo} cor={cor} tam={30} /></div>
          <div style={{ position: 'absolute', left: 84, width: 132, top: 104, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', color: corRotulo || corNum, ...body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontWeight: 600 }}>{rotulo}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} style={{ width: 17, height: 21, borderRadius: 4, boxSizing: 'border-box', background: 'rgba(13,18,15,.85)', border: `1.5px solid ${aberta ? '#8EE6A0' : (i < pin.length ? '#FFC23D' : '#3a4440')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: aberta ? '#8EE6A0' : '#FFC23D' }}>{(aberta || i < pin.length) ? '●' : ''}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, width: '100%', marginTop: 2 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(tecla)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Medidas da porta e da camisola: tudo cabe no ecrã, sem deslizar, até ao
   "Mais opções". Primeiro encolhe a porta; se ainda não chegar, encolhe a
   camisola (nunca abaixo de 62 %). Em ecrãs altos a camisola cresce até
   15 %, para o teclado ficar mais confortável. */
export function usePortaMedidas() {
  /* Medidas da porta e da camisola: tudo cabe no ecrã, sem deslizar, até
     ao "Mais opções", numa coluna de até 420 px. Primeiro encolhe a porta;
     se ainda não chegar, encolhe a camisola (nunca abaixo de 62 %). Em
     ecrãs altos a camisola cresce até 15 %. A porta da equipa técnica
     (AuthScreen) usa EXATAMENTE a mesma regra para o quadro. */
  const medir = () => {
    const vw = Math.min(window.innerWidth, 420), vh = window.innerHeight;
    // Espaço no topo: o mesmo da porta da equipa técnica (mesma grelha).
    const S = Math.max(0, Math.min(28, Math.round((vh - 640) * 0.12)));
    /* A porta e a camisola ocupam TODO o espaço disponível, juntas: a
       camisola tem sempre 330/251 da altura da porta. (Antes reservava-se
       espaço para uma camisola de tamanho normal e depois ela encolhia —
       e esse espaço ficava vazio.) */
    const fixo = 251 + S;
    const hLargura = (vw - 32 - 14) * 254 / 348;
    const H = Math.round(Math.max(120, Math.min(hLargura, (vh - fixo) / (1 + 330 / 251))));
    const k = Math.max(0.55, Math.min(1.15, H / 251));
    return { W: Math.round(H * 348 / 254), H, k, S };
  };
  const [m, setM] = useState(medir);
  useEffect(() => {
    const f = () => setM(medir());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}

export function PortalEntrada({ entrar, equipa, teamId }) {
  const cor = coresCamisola(T.corEquipa);
  const logo = (equipa && equipa.logo) || '';
  const clube = String((equipa && (equipa.clube || equipa.nome)) || '').trim();
  const [cartao, setCartao] = useState(() => peLerCartao(teamId));
  const [ecra, setEcra] = useState(() => {
    if (peLerCartao(teamId)) return 'porta';
    try { if (/^\d{6}$/.test(new URLSearchParams(window.location.search).get('ligar') || '')) return 'ligar-pin'; } catch (e) { /* nada */ }
    return 'rececao';
  });
  const [codigo, setCodigo] = useState('');
  const [jogador, setJogador] = useState(null);
  const [pin, setPin] = useState('');
  const [pin1, setPin1] = useState('');
  const [aviso, setAviso] = useState('');
  const [corAviso, setCorAviso] = useState('');
  const [tremer, setTremer] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aberta, setAberta] = useState(false);
  const ecraRef = useRef(null);
  const [codigoAntigo, setCodigoAntigo] = useState('');
  // Navegador que não guarda nada (janela privada, cookies bloqueados…).
  const [semMemoria, setSemMemoria] = useState(false);
  // Ligar outro aparelho / gerir aparelhos.
  const [codigoLigacao, setCodigoLigacao] = useState(() => {
    try { const c = new URLSearchParams(window.location.search).get('ligar'); return /^\d{6}$/.test(c || '') ? c : ''; } catch (e) { return ''; }
  });
  const [pinOutro, setPinOutro] = useState('');
  const [dadosLigacao, setDadosLigacao] = useState(null); // { codigo, expira_em, cheio, aparelhos }
  const [agora, setAgora] = useState(Date.now());

  const mostrarErro = (msg) => { setAviso(msg); setCorAviso('#FF5A4E'); setTremer(true); setTimeout(() => setTremer(false), 500); };
  const limpar = () => { setAviso(''); setCorAviso(''); };
  const erroDe = (e) => ((e && e.message && /tentativas/i.test(e.message)) ? e.message : 'Não foi possível ligar. Verifica a internet e tenta outra vez.');

  // PIN certo → a porta abre, a TV diz bem-vindo, e entra-se com a sessão.
  const abrirEEntrar = async (sessao) => {
    setAberta(true);
    setAviso('ACESSO AUTORIZADO'); setCorAviso('#8EE6A0');
    // Os pedidos do Portal partem já, todos ao mesmo tempo; enquanto isso,
    // o resto do ecrã apaga-se (0,3 s) e a porta fica fechada no seu sítio.
    // O vidro abre com o ecrã seguinte já pronto atrás dele.
    prebuscarPortal(sessao, teamId);
    /* O estado autorizado (bolas verdes, letreiro e aviso a verde) fica à
       vista pelo menos 0,65 s; os pedidos do Portal já correm em paralelo.
       Depois tira-se uma cópia do ecrã, que fica por baixo da porta até
       ela abrir (ver PeRestoEntrada). */
    await new Promise(r => setTimeout(r, 650));
    try {
      if (ENTRADA && ecraRef.current) {
        // Sem o <style> do ecrã (regras globais do html/body não vão na cópia).
        const copia = ecraRef.current.cloneNode(true);
        copia.querySelectorAll('style').forEach(n => n.remove());
        ENTRADA.resto = copia.outerHTML;
      }
    } catch (e) { /* sem cópia, fica só a porta */ }
    const ok = await entrar(sessao);
    if (!ok || ok === 'saiu') { ENTRADA = null; setAberta(false); setPin(''); mostrarErro(ok === 'saiu' ? 'Este acesso terminou: já saíste do clube.' : 'Não foi possível entrar. Tenta outra vez.'); }
  };

  const validarCodigo = async () => {
    if (codigo.length !== 6 || ocupado) return;
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_ver', { p_codigo: codigo, p_team: teamId });
      // Código já usado por quem tem o cartão ativo: em vez de "inválido",
      // pede o PIN e liga este aparelho ao mesmo cartão.
      if (r.ja_ativado) { setJogador(r.jogador || {}); setPin(''); setPin1(''); setEcra('reativar'); return; }
      if (!r.ok) { mostrarErro(r.erro || 'Código de ativação inválido.'); setCodigo(''); return; }
      setJogador(r.jogador || {}); setPin(''); setPin1(''); setEcra('cartao');
    } catch (e) { mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  const ativar = async (pinEscolhido) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_ativar', { p_codigo: codigo, p_team: teamId, p_pin: pinEscolhido });
      if (!r.ok) {
        mostrarErro(r.erro || 'Não foi possível ativar o cartão.');
        setPin(''); setPin1('');
        if (/ativação/i.test(r.erro || '')) { setCodigo(''); setEcra('rececao'); }
        return;
      }
      const novo = { token: r.token, jogador: r.jogador || jogador || {} };
      setSemMemoria(!peGuardarCartao(teamId, novo));
      peDescreverAparelho(r.token, teamId);
      setCartao(novo);
      setCodigo(''); setPin1('');
      setEcra('porta');
      if (!peLerCartao(teamId)) { setPin(''); return; } // não ficou guardado: fica na porta com o aviso
      const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: pinEscolhido });
      if (e.ok && e.sessao) { setPin(pinEscolhido); await abrirEEntrar(e.sessao); } else { setPin(''); }
    } catch (e) { mostrarErro(erroDe(e)); setPin(''); } finally { setOcupado(false); }
  };

  /* MESMO CARTÃO NOUTRO APARELHO, COM O CÓDIGO DE ATIVAÇÃO JÁ USADO.
     O jogador volta a escrever o código que o staff lhe deu (é o natural)
     e o servidor pede o PIN: código + PIN certos ligam este aparelho ao
     cartão que já tem, sem desligar os outros (máximo de 3, como na
     ligação por QR). PIN errado conta para o bloqueio de 5 tentativas. */
  const reativar = async (valor) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_reativar', { p_codigo: codigo, p_team: teamId, p_pin: valor });
      if (r.ok && r.token) {
        const novo = { token: r.token, jogador: r.jogador || jogador || {} };
        setSemMemoria(!peGuardarCartao(teamId, novo));
        peDescreverAparelho(r.token, teamId);
        setCartao(novo); setCodigo('');
        setEcra('porta');
        if (!peLerCartao(teamId)) { setPin(''); return; }
        const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: valor });
        if (e.ok && e.sessao) { setPin(valor); await abrirEEntrar(e.sessao); } else { setPin(''); }
        return;
      }
      setPin('');
      if (r.bloqueado) {
        setCodigo(''); setEcra('rececao');
        setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E');
        return;
      }
      if (r.restantes != null) { mostrarErro(`PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}`); return; }
      mostrarErro(r.erro || 'Não foi possível.');
    } catch (e) {
      setPin('');
      mostrarErro(/checkin_cartao_reativar|does not exist|PGRST202/i.test((e && (e.message || e.code)) || '') ? 'Esta opção ainda não está disponível.' : erroDe(e));
    } finally { setOcupado(false); }
  };

  const entrarComPin = async (valor) => {
    if (!cartao || ocupado) return;
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_entrar', { p_token: cartao.token, p_team: teamId, p_pin: valor });
      if (r.ok && r.sessao) {
        if (r.jogador) { const atual = { ...cartao, jogador: r.jogador }; peGuardarCartao(teamId, atual); setCartao(atual); }
        peDescreverAparelho(cartao.token, teamId); // os aparelhos antigos ganham nome aqui
        let recusou = 0;
        try { recusou = Number(localStorage.getItem(peBioRecusa(teamId)) || 0); } catch (e) { recusou = 0; }
        if (bioSuportada && !cartao.bio && Date.now() - recusou > 30 * 24 * 3600 * 1000) {
          setOferta({ sessao: r.sessao, pin: valor }); setPin(''); setEcra('oferta-bio');
          return;
        }
        await abrirEEntrar(r.sessao);
        return;
      }
      if (r.bloqueado || r.invalido) {
        peApagarCartao(teamId); setCartao(null); setPin(''); setEcra('rececao');
        setAviso(r.bloqueado
          ? 'Por segurança, o teu cartão foi bloqueado neste telemóvel. Pede um código de ativação novo ao staff técnico.'
          : 'O teu cartão já não é válido neste telemóvel. Pede um código de ativação novo ao staff técnico.');
        setCorAviso('#FF5A4E');
        return;
      }
      setPin('');
      mostrarErro(`PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}`);
    } catch (e) { setPin(''); mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  /* CÓDIGO ANTIGO → se já tem cartão, pede o PIN e recupera-o neste sítio
     (o cartão fica guardado no "sítio" onde foi ativado; outro navegador,
     o navegador de dentro do WhatsApp ou o ícone do Portal são sítios
     diferentes). Se ainda não tem cartão, entra como antes com o código. */
  const seguirCodigoAntigo = async () => {
    if (codigoAntigo.length < 4 || ocupado) return;
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_por_codigo', { p_codigo: codigoAntigo, p_team: teamId });
      if (!r.ok) {
        mostrarErro('Este não é um código de acesso válido. Escreve o código que usavas antes do cartão — o PIN só é pedido a seguir. Se não o souberes, pede-o ao staff técnico.');
        setCodigoAntigo('');
        return;
      }
      if (r.tem_cartao) { setJogador(r.jogador || {}); setPin(''); setEcra('recuperar'); return; }
      if (r.so_cartao) { mostrarErro('Ainda não tens cartão de atleta. Pede o código de ativação ao staff técnico.'); return; }
      const ok = await entrar(codigoAntigo);
      if (!ok || ok === 'saiu') mostrarErro(ok === 'saiu' ? 'Este acesso terminou: já saíste do clube.' : 'Não foi possível entrar com esse código.');
    } catch (e) {
      // Sem o SQL da recuperação (fase 2b) ainda corrido: entra como antes.
      if (/checkin_cartao_por_codigo|does not exist|PGRST202/i.test((e && (e.message || e.code)) || '')) {
        const ok = await entrar(codigoAntigo);
        if (!ok || ok === 'saiu') mostrarErro(ok === 'saiu' ? 'Este acesso terminou: já saíste do clube.' : 'Não foi possível entrar com esse código.');
      } else { mostrarErro(erroDe(e)); }
    } finally { setOcupado(false); }
  };
  const recuperarComPin = async (valor) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_recuperar', { p_codigo: codigoAntigo, p_team: teamId, p_pin: valor });
      if (r.ok && r.token) {
        const novo = { token: r.token, jogador: r.jogador || jogador || {} };
        setSemMemoria(!peGuardarCartao(teamId, novo)); setCartao(novo); setCodigoAntigo(''); setEcra('porta');
        peDescreverAparelho(r.token, teamId);
        const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: valor });
        if (e.ok && e.sessao) { setPin(valor); await abrirEEntrar(e.sessao); } else { setPin(''); }
        return;
      }
      setPin('');
      if (r.bloqueado) { setEcra('rececao'); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
      if (r.sem_cartao) { setEcra('codigo'); mostrarErro('Ainda não tens cartão de atleta.'); return; }
      mostrarErro(r.restantes != null ? `PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}` : (r.erro || 'Não foi possível recuperar o cartão.'));
    } catch (e) { setPin(''); mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  /* USAR O CARTÃO NOUTRO APARELHO (no aparelho onde já tem cartão):
     PIN → código de ligação de 10 minutos + QR. Com 3 aparelhos, escolhe
     primeiro qual deixa de usar. */
  const pedirLigacao = async (valorPin) => {
    setOcupado(true); limpar();
    try {
      try { await peRpc('checkin_cartao_descrever', { p_token: cartao.token, p_team: teamId, p_descricao: await peDescricaoAparelho() }); } catch (e) { /* nada */ }
      const r = await peRpc('checkin_cartao_ligacao_criar', { p_token: cartao.token, p_team: teamId, p_pin: valorPin });
      if (r.ok) { setPinOutro(valorPin); setDadosLigacao(r); setPin(''); setEcra('outro'); return; }
      setPin('');
      if (r.bloqueado || r.invalido) { usarOutroCartao(); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
      mostrarErro(r.restantes != null ? `PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}` : (r.erro || 'Não foi possível.'));
    } catch (e) { setPin(''); mostrarErro(/does not exist|PGRST202/i.test((e && (e.message || e.code)) || '') ? 'Esta opção ainda não está disponível.' : erroDe(e)); } finally { setOcupado(false); }
  };
  // (No Portal não há o diálogo de confirmação do staff: confirma-se na
  // própria linha do aparelho — ver `aRemover`.)
  const [aRemover, setARemover] = useState(null);
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  // "Perdeste o acesso ao cartão?" na Receção. A opção do código antigo só
  // aparece enquanto os códigos antigos estiverem ligados (atletas novos
  // nunca tiveram um).
  const [perdeuAcesso, setPerdeuAcesso] = useState(false);
  const [semNenhum, setSemNenhum] = useState(false);
  const [codigosAntigosLigados, setCodigosAntigosLigados] = useState(true);
  useEffect(() => {
    peRpc('checkin_portal_config', { p_team: teamId })
      .then(r => { if (r && typeof r.so_cartao === 'boolean') setCodigosAntigosLigados(!r.so_cartao); })
      .catch(() => { /* sem a função: mostra a opção, como antes */ });
  }, [teamId]);
  // Impressão digital / Face ID
  /* null = ainda a verificar. A verificação do leitor é assíncrona: com
     `false` à partida, a porta abria primeiro com o teclado do PIN e só
     depois trocava para a impressão digital (dois ecrãs seguidos). Quem já
     ativou a impressão digital neste aparelho tem leitor, por isso enquanto
     se verifica assume-se que sim; se afinal não houver, passa ao PIN. */
  const [bioSuportada, setBioSuportada] = useState(null);
  const [modoPin, setModoPin] = useState(false);      // com biometria ativa, o PIN é a alternativa
  const [oferta, setOferta] = useState(null);         // { sessao, pin } — perguntar se quer ativar
  useEffect(() => { peBioDisponivel().then(setBioSuportada); }, []);
  // O servidor manda: se a biometria foi desligada (aparelho removido, cartão terminado…), acerta-se aqui.
  useEffect(() => {
    if (!cartao || !cartao.token) return;
    peRpc('checkin_bio_estado', { p_token: cartao.token, p_team: teamId })
      .then(r => { if (r && typeof r.ativa === 'boolean' && r.ativa !== !!cartao.bio) { const novo = { ...cartao, bio: r.ativa }; peGuardarCartao(teamId, novo); setCartao(novo); } })
      .catch(() => {});
  }, [cartao && cartao.token]); // eslint-disable-line react-hooks/exhaustive-deps
  const bioAtiva = !!(cartao && cartao.bio && bioSuportada !== false);

  /* Desafio preparado em segundo plano. Assim que a porta aparece, pede-se
     ao servidor o desafio de segurança; ao tocar no leitor (ou na abertura
     automática), o ecrã do sistema abre logo, sem esperar pela Edge
     Function. Cada desafio serve uma só vez. */
  const bioPronto = useRef(null);      // { o, quando }
  const bioPedido = useRef(null);      // promessa do pedido em curso
  const bioSeq = useRef(0);
  const bioEmCurso = useRef(false);    // leitor aberto: não pedir outro desafio por cima
  const prepararBio = () => {
    if (!cartao || !cartao.token || bioEmCurso.current) return;
    const seq = ++bioSeq.current;
    const p = peBioFn({ acao: 'entrada-opcoes', token: cartao.token, team: teamId })
      .then(o => { if (seq === bioSeq.current) bioPronto.current = { o, quando: Date.now() }; return o; });
    p.catch(() => {}).finally(() => { if (bioPedido.current === p) bioPedido.current = null; });
    bioPedido.current = p;
  };
  const obterOpcoesBio = async () => {
    const pronto = bioPronto.current; bioPronto.current = null;
    if (pronto && Date.now() - pronto.quando < PE_BIO_VALIDADE_MS) return pronto.o;
    if (bioPedido.current) {
      try { const o = await bioPedido.current; bioPronto.current = null; return o; }
      catch (e) { /* o pedido antecipado falhou: tenta-se outra vez já */ }
    }
    return peBioFn({ acao: 'entrada-opcoes', token: cartao.token, team: teamId });
  };
  const naPortaComBio = ecra === 'porta' && bioAtiva && !modoPin && !aberta;
  // A camisola: medidas no ecrã; sem impressão digital ativa, a camisola
  // vira-se para o PIN com um toque (pinVirado).
  const medidasPorta = usePortaMedidas();
  const [pinVirado, setPinVirado] = useState(false);
  // Pista do emblema (o dedo que toca): 5 primeiras visitas deste aparelho
  // com a impressão digital ativa; acaba na primeira entrada pelo emblema.
  const chavePista = `pe-pista-emblema:${teamId}`;
  const [pistaEmblema] = useState(() => {
    if (!(cartao && cartao.bio)) return false;
    try { const v = localStorage.getItem(chavePista); if (v === 'feita' || Number(v || 0) >= 5) return false; localStorage.setItem(chavePista, String(Number(v || 0) + 1)); return true; } catch (e) { return false; }
  });
  const acabarPistaPortal = () => { try { localStorage.setItem(chavePista, 'feita'); } catch (e) { /* nada */ } };
  /* AS BARRAS DO SISTEMA (Chrome no Android) e o fundo da página na cor da
     cena enquanto se está na porta — sem isto ficava uma faixa verde (a cor
     da app) em cima e em baixo. Ao sair da porta, volta tudo à cor da app. */
  useEffect(() => {
    if (ecra !== 'porta') return undefined;
    const claro = TEMA_ATUAL === 'claro';
    const meta = document.querySelector('meta[name="theme-color"]');
    const antes = meta ? meta.getAttribute('content') : null;
    const corPorta = claro ? PE_TC_PORTA.claro : PE_TC_PORTA.escuro;
    if (meta) meta.setAttribute('content', corPorta);
    const st = document.createElement('style');
    st.textContent = `html:root, html:root body { background: ${claro ? '#E3E9E1' : '#0B0F0D'} !important; }`;
    document.head.appendChild(st);
    return () => {
      /* A BARRA DE CIMA NÃO PISCA AO ENTRAR. Com o acesso autorizado, a cor
         da app só volta quando a porta acabou de abrir (e só se nenhum ecrã
         a mudou entretanto, como o estádio do dia de jogo). Antes voltava
         logo: a barra passava a verde por um instante e depois à cor do ecrã
         seguinte. Sem entrada (voltar ao PIN, etc.), repõe-se logo. */
      let feito = false, tempo = 0;
      const repor = () => {
        if (feito) return; feito = true;
        clearTimeout(tempo); window.removeEventListener('mjp-entrada-fim', repor);
        if (meta && antes != null && meta.getAttribute('content') === corPorta) meta.setAttribute('content', antes);
        if (st.parentNode) st.parentNode.removeChild(st);
      };
      if (ENTRADA_T && Date.now() - ENTRADA_T < 20000) {
        window.addEventListener('mjp-entrada-fim', repor);
        tempo = setTimeout(repor, 8000);
      } else repor();
    };
  }, [ecra]);
  useEffect(() => {
    if (!naPortaComBio) { bioPronto.current = null; return undefined; }
    prepararBio();
    // Ao voltar à app (estava em segundo plano), renova o desafio se já for velho.
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible' || bioEmCurso.current) return;
      const pronto = bioPronto.current;
      if (!bioPedido.current && (!pronto || Date.now() - pronto.quando >= PE_BIO_VALIDADE_MS)) prepararBio();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [naPortaComBio, cartao && cartao.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto = aberto sozinho ao chegar à porta: falhas silenciosas, o botão fica para tocar.
  const entrarComBio = async (auto = false) => {
    if (!cartao || ocupado || aberta || bioEmCurso.current) return;
    bioEmCurso.current = true;
    setOcupado(true); limpar();
    let renovar = false; // true quando se fica na porta com a impressão digital à espera de novo toque
    try {
      const o = await obterOpcoesBio();
      if (!o.ok) {
        if (o.invalido) { usarOutroCartao(); setAviso('O teu cartão já não é válido neste aparelho. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
        if (o.sem_biometria) { const novo = { ...cartao, bio: false }; peGuardarCartao(teamId, novo); setCartao(novo); setModoPin(true); mostrarErro('Entra com o PIN.'); return; }
        if (!auto) mostrarErro(o.erro || 'Não foi possível.');
        renovar = true; return;
      }
      let resposta;
      try { resposta = await peBioAutenticar(o.opcoes); }
      catch (e) { renovar = true; return; } // cancelado pelo atleta (ou recusado sem toque): fica tudo como estava
      const v = await peBioFn({ acao: 'entrada-verificar', token: cartao.token, team: teamId, resposta });
      if (v.ok && v.sessao) { setPin('●●●●●●'); await abrirEEntrar(v.sessao); return; }
      mostrarErro(v.erro || 'Não foi possível confirmar. Entra com o PIN.');
      renovar = true;
    } catch (e) {
      if (auto) renovar = true;
      else { mostrarErro(`Não foi possível usar ${PE_BIO_TXT.comArtigo} agora${e && e.diag ? ` (${e.diag})` : ''}. Entra com o PIN.`); setModoPin(true); }
    } finally {
      bioEmCurso.current = false;
      setOcupado(false);
      // O desafio usado já não serve: prepara-se outro para o próximo toque.
      if (renovar) prepararBio();
    }
  };
  // Abrir o leitor sozinho (Android e computador). Espera um instante para a
  // porta aparecer e para não chocar com outros painéis abertos.
  useEffect(() => {
    if (!naPortaComBio || ocupado || oferta || maisOpcoes || peBioAutoFeito || !pePodeAutoAbrirBio()) return undefined;
    if (document.visibilityState !== 'visible') return undefined;
    const t = setTimeout(() => {
      if (peBioAutoFeito || document.visibilityState !== 'visible') return;
      peBioAutoFeito = true;
      entrarComBio(true);
    }, 450);
    return () => clearTimeout(t);
  }, [naPortaComBio, ocupado, oferta, maisOpcoes]); // eslint-disable-line react-hooks/exhaustive-deps
  // Ativar neste aparelho (pede o PIN — o servidor confirma-o outra vez).
  const ativarBio = async (valorPin) => {
    const o = await peBioFn({ acao: 'registo-opcoes', token: cartao.token, team: teamId, pin: valorPin });
    if (!o.ok) return o;
    let resposta;
    try { resposta = await peBioRegistar(o.opcoes); } catch (e) { return { ok: false, cancelado: true }; }
    const v = await peBioFn({ acao: 'registo-verificar', token: cartao.token, team: teamId, resposta });
    if (v.ok) { const novo = { ...cartao, bio: true }; peGuardarCartao(teamId, novo); setCartao(novo); setModoPin(false); }
    return v;
  };
  const responderOferta = async (aceita) => {
    const o = oferta; setOferta(null);
    if (aceita) {
      setOcupado(true);
      try { await ativarBio(o.pin); } catch (e) { /* segue com o PIN */ }
      setOcupado(false);
    } else {
      try { localStorage.setItem(peBioRecusa(teamId), String(Date.now())); } catch (e) { /* nada */ }
    }
    setEcra('porta');
    await abrirEEntrar(o.sessao);
  };
  const removerAparelho = async (ap) => {
      setARemover(null);
      try {
        const r = await peRpc('checkin_cartao_remover', { p_token: cartao.token, p_team: teamId, p_pin: pinOutro, p_aparelho: ap.id });
        if (!r.ok) { mostrarErro(r.erro || 'Não foi possível remover.'); return; }
        // Com lugar livre, pede logo o código de ligação.
        const n = await peRpc('checkin_cartao_ligacao_criar', { p_token: cartao.token, p_team: teamId, p_pin: pinOutro });
        if (n.ok) setDadosLigacao(n); else setDadosLigacao(l => ({ ...l, aparelhos: r.aparelhos }));
      } catch (e) { mostrarErro(erroDe(e)); }
  };
  useEffect(() => {
    if (ecra !== 'outro') return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ecra]);
  // NO APARELHO NOVO: código de ligação + PIN.
  const ligarAparelho = async (valorPin) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_ligar', { p_codigo: codigoLigacao, p_team: teamId, p_pin: valorPin });
      if (r.ok && r.token) {
        const novo = { token: r.token, jogador: r.jogador || {} };
        setSemMemoria(!peGuardarCartao(teamId, novo)); setCartao(novo); setCodigoLigacao(''); setEcra('porta');
        peDescreverAparelho(r.token, teamId);
        const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: valorPin });
        if (e.ok && e.sessao) { setPin(valorPin); await abrirEEntrar(e.sessao); } else { setPin(''); }
        return;
      }
      setPin('');
      if (r.bloqueado) { setEcra('rececao'); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
      if (r.erro) { setCodigoLigacao(''); setEcra('ligar'); mostrarErro(r.erro); return; }
      mostrarErro(`PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}`);
    } catch (e) { setPin(''); mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  const tecla = (k) => {
    if (ocupado || aberta) return;
    if (ecra === 'ligar') {
      limpar();
      setCodigoLigacao(c => (k === '⌫' ? c.slice(0, -1) : c.length < 6 ? c + k : c));
      return;
    }
    if (ecra === 'bio-pin') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) {
        setOcupado(true);
        ativarBio(novo).then(r => {
          setPin('');
          if (r && r.ok) { setEcra('porta'); setAviso('IMPRESSÃO DIGITAL ATIVA'); setCorAviso('#8EE6A0'); return; }
          if (r && r.cancelado) { setEcra('porta'); return; }
          if (r && (r.bloqueado || r.invalido)) { usarOutroCartao(); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
          mostrarErro(r && r.restantes != null ? `PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}` : ((r && r.erro) || 'Não foi possível ativar.'));
        }).catch((e) => { setPin(''); mostrarErro(`Não foi possível ativar agora${e && e.diag ? ` (${e.diag})` : ''}.`); }).finally(() => setOcupado(false));
      }
      return;
    }
    if (ecra === 'ligar-pin' || ecra === 'outro-pin') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) { if (ecra === 'ligar-pin') ligarAparelho(novo); else pedirLigacao(novo); }
      return;
    }
    if (ecra === 'codigo') {
      limpar();
      setCodigoAntigo(c => (k === '⌫' ? c.slice(0, -1) : c.length < 6 ? c + k : c));
      return;
    }
    if (ecra === 'recuperar') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) recuperarComPin(novo);
      return;
    }
    if (ecra === 'rececao') {
      limpar();
      setCodigo(c => (k === '⌫' ? c.slice(0, -1) : c.length < 6 ? c + k : c));
      return;
    }
    if (ecra === 'reativar') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) reativar(novo);
      return;
    }
    if (ecra === 'cartao') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) {
        if (!pin1) { setTimeout(() => { setPin1(novo); setPin(''); }, 250); }
        else if (novo !== pin1) { setTimeout(() => { setPin(''); setPin1(''); mostrarErro('Os PIN não são iguais. Escolhe outra vez.'); }, 250); }
        else { ativar(novo); }
      }
      return;
    }
    if (ecra === 'porta') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) entrarComPin(novo);
    }
  };

  const usarOutroCartao = () => {
    peApagarCartao(teamId); setCartao(null); setPin(''); setCodigo(''); limpar(); setEcra('rececao');
  };

  const ecraFixo = {
    position: 'fixed', inset: 0, zIndex: 1, background: T.bg, overflow: 'hidden', overscrollBehavior: 'none', ...body,
  };
  const coluna = {
    height: '100%', maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(12px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', gap: 10,
  };
  const ligacao = { background: 'none', border: 'none', color: T.gold, textDecoration: 'underline', fontSize: 13, cursor: 'pointer', padding: '6px', ...body, flexShrink: 0 };
  const botaoOuro = (ativo) => ({
    width: '100%', padding: 11, borderRadius: 12, border: 'none', background: ativo ? T.goldFundo : T.botaoInativo, color: ativo ? '#1A2A1F' : T.botaoInativoTexto,
    ...display, fontSize: 17, fontWeight: 600, cursor: ativo ? 'pointer' : 'default', flexShrink: 0,
  });

  return (
    <div ref={ecraRef} style={ecraFixo}>
      <style>{PE_CSS}</style>
      {ecra === 'rececao' && (
        <div style={{ ...coluna, justifyContent: 'center' }}>
          <div style={{ ...display, fontSize: 24, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Bem-vindo ao plantel!</div>
          <div style={{ fontSize: 13.5, color: T.mutedDim, textAlign: 'center', marginTop: -6 }}>Levanta aqui o teu cartão de atleta.</div>
          <div style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden', flexShrink: 1, minHeight: 0, maxHeight: '34dvh', display: 'flex', alignItems: 'flex-end' }}>
            <PeRececao cor={cor} logo={logo} clube={clube} />
            <div style={{ position: 'absolute', left: '18%', right: '18%', bottom: '8%' }}>
              <PePainel rotulo={aviso && aviso.length <= 32 ? aviso : 'CÓDIGO DE ATIVAÇÃO'} corRotulo={aviso && aviso.length <= 32 ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={codigo} />
              </PePainel>
            </div>
          </div>
          {/* Espaço fixo (2 linhas) para avisos longos: aparecer ou desaparecer
              (ex.: ao tocar no primeiro número) já não mexe na página. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.4, height: '2.8em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{aviso && aviso.length > 32 ? aviso : ''}</div>
          <PeTeclado onTecla={tecla} desativado={ocupado} />
          <button type="button" onClick={validarCodigo} disabled={codigo.length !== 6 || ocupado} style={botaoOuro(codigo.length === 6 && !ocupado)}>
            {ocupado ? 'A verificar…' : 'Levantar o cartão'}
          </button>
          <div style={{ fontSize: 12, color: T.mutedDim, textAlign: 'center', lineHeight: 1.45 }}>O código é dado pelo staff técnico. Já levantaste o cartão? Usa o mesmo código e o teu PIN.</div>
          <button type="button" onClick={() => { limpar(); setCodigoLigacao(''); setPin(''); setEcra('ligar'); }} style={{ ...ligacao, marginTop: -4 }}>Já tenho cartão noutro aparelho</button>
          <button type="button" onClick={() => { limpar(); setSemNenhum(false); setPerdeuAcesso(true); }} style={{ ...ligacao, marginTop: -8 }}>Perdeste o acesso ao cartão?</button>
          {perdeuAcesso && (() => {
            const opcao = { width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, background: T.bg, border: `1px solid ${T.line}`, color: T.cream, fontSize: 14.5, cursor: 'pointer', ...body };
            const sub = { display: 'block', fontSize: 12, color: T.mutedDim, marginTop: 2 };
            return (
              <div onClick={() => setPerdeuAcesso(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(12px + env(safe-area-inset-bottom, 0px)) 12px' }}>
                <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginBottom: 2 }}>Perdeste o acesso ao cartão?</div>
                  {semNenhum ? (
                    <>
                      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.55 }}>
                        Pede ao <strong style={{ color: T.cream }}>staff técnico</strong> um código de ativação novo. Com ele recebes o cartão outra vez e escolhes um PIN novo.
                        O teu histórico (Wellness, PSE, missões, sequência) mantém-se igual.
                      </div>
                      <button type="button" onClick={() => setPerdeuAcesso(false)} style={botaoOuro(true)}>Percebi</button>
                    </>
                  ) : (
                    <>
                      <button type="button" style={opcao} onClick={() => { setPerdeuAcesso(false); limpar(); setCodigoLigacao(''); setPin(''); setEcra('ligar'); }}>
                        Ainda tenho o cartão noutro aparelho
                        <span style={sub}>Escreve aqui o teu código de ativação e o PIN, ou liga este a partir do outro com o QR code.</span>
                      </button>
                      {codigosAntigosLigados && (
                        <button type="button" style={opcao} onClick={() => { setPerdeuAcesso(false); limpar(); setCodigoAntigo(''); setEcra('codigo'); }}>
                          Tenho o código de acesso antigo
                          <span style={sub}>O código que usavas antes do cartão, com o teu PIN.</span>
                        </button>
                      )}
                      <button type="button" style={opcao} onClick={() => setSemNenhum(true)}>
                        Não tenho nenhum aparelho com o cartão
                        <span style={sub}>Ou esqueci-me do PIN.</span>
                      </button>
                      <button type="button" onClick={() => setPerdeuAcesso(false)} style={{ ...opcao, textAlign: 'center', background: 'none', border: 'none', color: T.mutedDim }}>Fechar</button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {ecra === 'oferta-bio' && oferta && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: 24, background: '#0d120f', border: `2px solid ${T.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Fingerprint size={60} color={T.gold} strokeWidth={1.6} />
            </div>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream }}>Entrar com {PE_BIO_TXT.comArtigo}?</div>
            <div style={{ fontSize: 13.5, color: T.mutedDim, lineHeight: 1.5, maxWidth: 320 }}>
              Da próxima vez, neste aparelho, basta tocar e {PE_BIO_TXT.gesto}. Os teus dados biométricos nunca saem do aparelho. O PIN continua a funcionar.
            </div>
            <button type="button" onClick={() => responderOferta(true)} disabled={ocupado} style={botaoOuro(!ocupado)}>{ocupado ? 'A ativar…' : 'Ativar'}</button>
            <button type="button" onClick={() => responderOferta(false)} disabled={ocupado} style={ligacao}>Agora não</button>
          </div>
        </div>
      )}

      {ecra === 'bio-pin' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Fingerprint size={44} color={T.gold} strokeWidth={1.6} />
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>{PE_BIO_TXT.nome.charAt(0).toUpperCase() + PE_BIO_TXT.nome.slice(1)}</div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4 }}>Escreve o teu PIN para ativar neste aparelho.</div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={pin} ocultar />
              </PePainel>
            </div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setPin(''); limpar(); setEcra('porta'); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'ligar' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Já tenho cartão noutro aparelho</div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4, lineHeight: 1.45 }}>
              No equipamento onde já tens o cartão, abre <strong style={{ color: T.cream }}>Mais opções → Utilizar outro equipamento</strong>. Aparece um código de ligação (ou lê o QR code com a câmara deste aparelho).
            </div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso && aviso.length <= 32 ? aviso : 'CÓDIGO DE LIGAÇÃO'} corRotulo={aviso && aviso.length <= 32 ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={codigoLigacao} />
              </PePainel>
            </div>
            {/* Espaço fixo (2 linhas) para avisos longos: aparecer ou desaparecer
              (ex.: ao tocar no primeiro número) já não mexe na página. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.4, height: '2.8em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{aviso && aviso.length > 32 ? aviso : ''}</div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
            <button type="button" onClick={() => { if (codigoLigacao.length === 6) { limpar(); setPin(''); setEcra('ligar-pin'); } }} disabled={codigoLigacao.length !== 6} style={botaoOuro(codigoLigacao.length === 6)}>Seguinte</button>
          </div>
          <button type="button" onClick={() => { setEcra('rececao'); setCodigoLigacao(''); limpar(); }} style={ligacao}>Voltar à receção</button>
        </div>
      )}

      {(ecra === 'ligar-pin' || ecra === 'outro-pin') && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>
              {ecra === 'ligar-pin' ? 'Ligar este aparelho' : 'Utilizar outro equipamento'}
            </div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4, lineHeight: 1.45 }}>
              {ecra === 'ligar-pin' ? 'Escreve o teu PIN para o cartão ficar também neste aparelho.' : 'Escreve o teu PIN para receberes o código de ligação.'}
            </div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={pin} ocultar />
              </PePainel>
            </div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setPin(''); limpar(); setEcra(ecra === 'ligar-pin' ? 'ligar' : 'porta'); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'outro' && dadosLigacao && (() => {
        const restam = dadosLigacao.expira_em ? Math.max(0, Math.floor((new Date(dadosLigacao.expira_em).getTime() - agora) / 1000)) : 0;
        const link = dadosLigacao.codigo ? `${URL_PUBLICA_APP}?portal=${teamId}&ligar=${dadosLigacao.codigo}` : '';
        const aps = dadosLigacao.aparelhos || [];
        const quando = (d) => (d ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'ainda não entrou');
        return (
          <div style={{ ...coluna, overflowY: 'auto' }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: 'auto 0' }}>
              {dadosLigacao.cheio ? (
                <>
                  <div style={{ ...display, fontSize: 21, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Já tens o cartão em 3 aparelhos</div>
                  <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', lineHeight: 1.45 }}>Para ligares outro, escolhe primeiro qual deixas de usar.</div>
                </>
              ) : (
                <>
                  <div style={{ ...display, fontSize: 21, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Liga o teu outro aparelho</div>
                  <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', lineHeight: 1.45 }}>Lê o QR code com a câmara do outro aparelho, ou abre lá o Portal, toca em <strong style={{ color: T.cream }}>Já tenho cartão noutro aparelho</strong> e escreve este código.</div>
                  {restam > 0 ? (
                    <>
                      <PeQr texto={link} tam={168} />
                      <div style={{ ...mono, fontSize: 32, color: T.gold, letterSpacing: '.24em', lineHeight: 1.1 }}>{dadosLigacao.codigo}</div>
                      <div style={{ fontSize: 12, color: T.mutedDim }}>Válido durante {Math.floor(restam / 60)}:{String(restam % 60).padStart(2, '0')} · só serve uma vez</div>
                    </>
                  ) : (
                    <button type="button" onClick={() => pedirLigacao(pinOutro)} style={botaoOuro(true)}>O código expirou · Gerar outro</button>
                  )}
                </>
              )}
              <div style={{ alignSelf: 'stretch', marginTop: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: '.12em', color: T.mutedDim, marginBottom: 6 }}>OS TEUS APARELHOS · {aps.length} DE {dadosLigacao.limite || 3}</div>
                {aps.map(ap => (
                  <div key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: T.surface, border: `1px solid ${ap.este ? T.gold + '88' : T.line}`, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 500 }}>
                        {ap.descricao && ap.descricao !== 'Aparelho' ? ap.descricao : 'Aparelho sem nome'}
                        {ap.este && <span style={{ color: T.gold, fontWeight: 400 }}> · este aparelho</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.mutedDim }}>Ligado em {quando(ap.criado_em)} · último uso: {quando(ap.ultimo_uso)}</div>
                      {(!ap.descricao || ap.descricao === 'Aparelho') && !ap.este && (
                        <div style={{ fontSize: 11, color: T.mutedDim, fontStyle: 'italic' }}>O nome aparece na próxima vez que entrares nesse aparelho.</div>
                      )}
                    </div>
                    {!ap.este && (aRemover === ap.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: T.muted }}>Remover?</span>
                        <button type="button" onClick={() => removerAparelho(ap)} style={{ background: T.bad, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '5px 10px', cursor: 'pointer', ...body }}>Sim</button>
                        <button type="button" onClick={() => setARemover(null)} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 12, padding: '5px 10px', cursor: 'pointer', ...body }}>Não</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setARemover(ap.id)} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 12, padding: '5px 10px', cursor: 'pointer', flexShrink: 0, ...body }}>Remover</button>
                    ))}
                  </div>
                ))}
              </div>
              {aviso && <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center' }}>{aviso}</div>}
            </div>
            <button type="button" onClick={() => { setEcra('porta'); setDadosLigacao(null); setPinOutro(''); limpar(); }} style={ligacao}>Concluído</button>
          </div>
        );
      })()}

      {ecra === 'codigo' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Entrar com o código antigo de acesso</div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4, lineHeight: 1.45 }}>
              É o código que usavas <strong style={{ color: T.cream }}>antes do cartão</strong> (4 ou 6 números) — <strong style={{ color: T.cream }}>não é o PIN</strong>.
              Se já tens cartão de atleta, o PIN é pedido a seguir.
            </div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso && aviso.length <= 32 ? aviso : 'CÓDIGO ANTIGO DE ACESSO'} corRotulo={aviso && aviso.length <= 32 ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={codigoAntigo} />
              </PePainel>
            </div>
            {/* Espaço fixo (2 linhas) para avisos longos: aparecer ou desaparecer
              (ex.: ao tocar no primeiro número) já não mexe na página. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.4, height: '2.8em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{aviso && aviso.length > 32 ? aviso : ''}</div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
            <button type="button" onClick={seguirCodigoAntigo} disabled={codigoAntigo.length < 4 || ocupado} style={botaoOuro(codigoAntigo.length >= 4 && !ocupado)}>
              {ocupado ? 'A verificar…' : 'Seguinte'}
            </button>
          </div>
          <button type="button" onClick={() => { setEcra(cartao ? 'porta' : 'rececao'); setCodigoAntigo(''); limpar(); }} style={ligacao}>Voltar à receção</button>
        </div>
      )}

      {ecra === 'recuperar' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <PeCartao jogador={jogador} cor={cor} logo={logo} clube={clube} />
            <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginTop: 14 }}>Já tens cartão de atleta</div>
            <div style={{ fontSize: 12.5, color: T.mutedDim, textAlign: 'center', marginTop: -6 }}>Escreve o teu PIN para o usares também aqui.</div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={pin} ocultar />
              </PePainel>
            </div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setEcra('codigo'); setPin(''); limpar(); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'reativar' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <PeCartao jogador={jogador} cor={cor} logo={logo} clube={clube} />
          <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginTop: 14, textAlign: 'center' }}>Já levantaste o teu cartão</div>
          <div style={{ fontSize: 12.5, color: T.mutedDim, textAlign: 'center', marginTop: -6, lineHeight: 1.45 }}>Escreve o teu PIN para o usares também neste aparelho.</div>
          <div style={{ width: 'min(100%, 300px)' }}>
            <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
              <PeCaixas valor={pin} ocultar />
            </PePainel>
          </div>
          <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { limpar(); setSemNenhum(true); setPerdeuAcesso(true); setEcra('rececao'); setPin(''); }} style={{ ...ligacao, marginBottom: -6 }}>Esqueci-me do PIN</button>
          <button type="button" onClick={() => { setEcra('rececao'); setPin(''); setCodigo(''); limpar(); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'cartao' && (
        <div style={coluna}>
          {/* O cartão, o PIN e o teclado centrados na altura que sobra; o
              "Voltar" fica sempre no fundo. */}
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <PeCartao jogador={jogador} cor={cor} logo={logo} clube={clube} />
          <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginTop: 14 }}>{pin1 ? 'Confirma o teu PIN' : 'Define o teu PIN de acesso'}</div>
          <div style={{ width: 'min(100%, 300px)' }}>
            <PePainel rotulo={aviso || (pin1 ? 'REPETE O PIN' : 'PIN PESSOAL')} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
              <PeCaixas valor={pin} ocultar />
            </PePainel>
          </div>
          <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setEcra('rececao'); setPin(''); setPin1(''); limpar(); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'porta' && cartao && (() => {
        /* A PORTA DO PLANTEL, COMO A DA EQUIPA TÉCNICA: fundo escuro com o aro
           de luz, a porta de vidro deitada com o Face ID no emblema e, por
           baixo, a camisola do atleta pendurada (de costas: nome, número e
           impressão digital; virada: o PIN). Só muda o visual: o PIN e a
           impressão digital passam pelas mesmas funções (tecla, entrarComBio)
           e a abertura da porta para o Portal é a de sempre. */
        const m = medidasPorta;
        const verBio = bioAtiva && !modoPin;
        const virada = modoPin || (!bioAtiva && pinVirado);
        const faceId = !bioAtiva ? 'desligado' : aberta ? 'ok' : (ocupado && verBio) ? 'a-ler' : verBio ? 'pronto' : 'quieto';
        const irParaPin = () => { limpar(); setPin(''); if (bioAtiva) setModoPin(true); else setPinVirado(true); };
        const voltarCostas = () => { limpar(); setPin(''); if (bioAtiva) { setModoPin(false); entrarComBio(); } else setPinVirado(false); };
        const rotulo = aviso && aviso.length <= 26 ? aviso : 'PIN PESSOAL';
        return (
        <>
        {/* fundo escuro e aro de luz no teto (dentro da cópia do ecrã que
            fica por baixo da porta a abrir: desvanece com o resto) */}
        {/* No modo claro muda o ambiente (fundo e luz); a porta, o letreiro
            e a camisola mantêm os materiais — como na equipa técnica. */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: TEMA_ATUAL === 'claro' ? 'radial-gradient(ellipse at 50% 18%, #FFFFFF 0%, #E3E9E1 75%)' : 'radial-gradient(ellipse at 50% 18%, #26342B 0%, #0B0F0D 75%)' }}>
          <div style={{ position: 'absolute', left: '50%', top: -8, width: 'min(80vw, 420px)', height: 22, boxSizing: 'content-box', transform: 'translateX(-50%)', borderRadius: '50%',
            border: TEMA_ATUAL === 'claro' ? '3px solid rgba(176,138,30,.7)' : '3px solid rgba(255,230,160,.75)',
            boxShadow: TEMA_ATUAL === 'claro' ? '0 0 24px 6px rgba(255,205,110,.35)' : '0 0 24px 6px rgba(255,230,160,.22)' }} />
        </div>
        <div style={{ ...coluna, position: 'relative', gap: 0, maxWidth: Math.max(420, m.W + 14) }}>
          {semMemoria && (
            <div style={{ alignSelf: 'stretch', fontSize: 12.5, lineHeight: 1.45, color: T.cream, background: T.fundoErro, border: `1px solid ${T.bad}`, borderRadius: 10, padding: '8px 12px', flexShrink: 0, marginBottom: 8 }}>
              Este navegador não está a guardar o teu cartão (janela privada ou memória bloqueada). Podes entrar agora com o PIN, mas da próxima vez abre o Portal num navegador normal — ou instala a app no dispositivo (Mais opções).
            </div>
          )}
          <div style={{ height: 8 + m.S, flexShrink: 0 }} />
          <PePorta aberta={aberta} jogador={cartao.jogador} cor={cor} logo={logo} clube={clube}
            largura={m.W} altura={m.H} faceId={faceId} pista={pistaEmblema && verBio && !ocupado}
            onEmblema={bioAtiva ? () => { if (!verBio) { limpar(); setPin(''); setModoPin(false); } acabarPistaPortal(); entrarComBio(); } : irParaPin} />
          <PeGancho k={m.k} />
          <div style={{ position: 'relative', width: 300 * m.k, height: 330 * m.k, flexShrink: 0, animation: tremer ? 'pe-treme .45s' : 'none' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 300, height: 330, transform: `scale(${m.k})`, transformOrigin: '0 0' }}>
              <PeCamisola jogador={cartao.jogador} cor={cor} logo={logo} virada={virada} pin={pin} aberta={aberta}
                rotulo={rotulo} corRotulo={aviso && aviso.length <= 26 ? corAviso : undefined}
                sensor={bioAtiva
                  ? { icone: PE_ICONE_DEDO, rotulo: `Entrar com ${PE_BIO_TXT.comArtigo}`, pulsar: false, aLer: ocupado && verBio, onClick: (ocupado || aberta) ? null : () => entrarComBio() }
                  : { icone: PE_ICONE_TECLADO, rotulo: 'Entrar com o PIN', pulsar: !aberta, onClick: aberta ? null : irParaPin }}
                teclado={{
                  onTecla: tecla, desativado: !virada || ocupado || aberta,
                  extra: bioAtiva
                    ? { icone: PE_ICONE_DEDO, rotulo: `Entrar com ${PE_BIO_TXT.comArtigo}`, onClick: voltarCostas }
                    : { icone: PE_ICONE_VIRAR, rotulo: 'Ver as costas da camisola', onClick: voltarCostas },
                }} />
            </div>
          </div>
          {/* Avisos longos por baixo da camisola, num espaço fixo (não
              empurram nada). Os curtos vão no letreiro do PIN. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.35, height: '2.7em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4, width: 'min(92vw, 380px)' }}>
            {aviso && (aviso.length > 26 || !virada) ? aviso : ''}
          </div>
          {/* Uma só ligação discreta; as opções abrem num painel por baixo,
              para não roubarem altura à porta e ao teclado. */}
          <button type="button" onClick={() => setMaisOpcoes(true)} style={{ ...ligacao, textDecoration: 'none', color: T.mutedDim, display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, flexShrink: 0, fontSize: 14 }}>
            <span style={{ fontSize: 18, lineHeight: 1, letterSpacing: 1 }}>⋯</span> Mais opções
          </button>
          {maisOpcoes && (() => {
            const opcao = { width: '100%', textAlign: 'left', padding: '13px 14px', borderRadius: 12, background: T.bg, border: `1px solid ${T.line}`, color: T.cream, fontSize: 14.5, cursor: 'pointer', ...body };
            return (
              <div onClick={() => setMaisOpcoes(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(12px + env(safe-area-inset-bottom, 0px)) 12px' }}>
                <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <PeInstalar estilo={opcao} aoAbrir={() => setMaisOpcoes(false)} />
                  {bioAtiva && (
                    <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); limpar(); setPin(''); setModoPin(true); }}>Entrar com o PIN</button>
                  )}
                  {bioSuportada && !cartao.bio && (
                    <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); limpar(); setPin(''); setEcra('bio-pin'); }}>Entrar com {PE_BIO_TXT.comArtigo}</button>
                  )}
                  <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); limpar(); setPin(''); setEcra('outro-pin'); }}>Utilizar outro equipamento</button>
                  <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); usarOutroCartao(); }}>Usar outro cartão de atleta</button>
                  <button type="button" style={{ ...opcao, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={trocarTema}>
                    {TEMA_ATUAL === 'claro' ? 'Modo escuro' : 'Modo claro'}
                    <span style={{ color: T.muted, display: 'flex' }}><IconeTema size={18} /></span>
                  </button>
                  <button type="button" onClick={() => setMaisOpcoes(false)} style={{ ...opcao, textAlign: 'center', background: 'none', border: 'none', color: T.mutedDim }}>Fechar</button>
                </div>
              </div>
            );
          })()}
        </div>
        </>
        );
      })()}
    </div>
  );
}

