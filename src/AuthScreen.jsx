import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { supabase } from './supabaseClient';

/* ===================================================================
   ENTRADA DA EQUIPA TÉCNICA — A PORTA É O QUADRO TÁTICO
   ===================================================================
   O mesmo centro de treinos do Portal do Atleta, mas outra porta: a da
   equipa técnica. A porta é o quadro magnético do gabinete, com o campo,
   o emblema do clube no círculo central e o onze da equipa em ímanes.
   Por baixo, pendurada na calha, a credencial da equipa técnica.

   - O verso da credencial é onde se entra (palavra-passe; numa fase
     seguinte, também a impressão digital). O emblema ao centro será o
     Face ID — o "pontapé de saída". Enquanto a entrada biométrica não
     existir para a equipa técnica (precisa de uma função própria no
     servidor), tocar no emblema leva à palavra-passe.
   - Com o acesso autorizado, o campo abre-se pela linha do meio-campo e,
     atrás dele, está a app verdadeira (ou o ecrã das missões, se houver).
     Essa abertura acontece JÁ COM A SESSÃO INICIADA, por cima da app: ver
     `PortaStaffAbrir`, montada pelo AppRoot.

   O QUE NÃO MUDOU: as chamadas ao Supabase para entrar e criar conta são
   as mesmas de antes (`signInWithPassword` e `signUp`). Só se acrescentou
   o pedido de nova palavra-passe (`resetPasswordForEmail` / `updateUser`).

   O QUE SE GUARDA NESTE APARELHO (chave `mjp-porta-staff`): o que a porta
   precisa de mostrar ANTES de haver sessão — email, nome, se é o
   responsável, clube, época, cor, emblema e a formação do último jogo. É
   escrito pela app depois de entrar (`guardarPortaStaff`). Sem isto, a
   porta mostra-se sem nome, com o escudo genérico e sem ímanes. "Entrar
   com outra conta" apaga-o. */

const CHAVE_PORTA = 'mjp-porta-staff';

export function lerPortaStaff() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_PORTA) || 'null');
    return v && typeof v === 'object' ? v : null;
  } catch (e) { return null; }
}
/* Chamado pela app (já com sessão). Só escreve quando alguma coisa mudou,
   e a falta de espaço nunca parte nada: sem emblema, a porta mostra o
   escudo genérico. */
export function guardarPortaStaff(dados) {
  if (!dados || !dados.email) return;
  const antes = lerPortaStaff() || {};
  const novo = { ...dados };
  if (novo.logo && String(novo.logo).length > 300000) novo.logo = '';
  const igual = Object.keys(novo).every(k => antes[k] === novo[k]) && Object.keys(antes).length === Object.keys(novo).length;
  if (igual) return;
  try { localStorage.setItem(CHAVE_PORTA, JSON.stringify(novo)); } catch (e) {
    try { localStorage.setItem(CHAVE_PORTA, JSON.stringify({ ...novo, logo: '' })); } catch (e2) { /* sem espaço: fica sem porta personalizada */ }
  }
}
function apagarPortaStaff() {
  try { localStorage.removeItem(CHAVE_PORTA); } catch (e) { /* nada */ }
}

/* A passagem do ecrã de entrada para a app. O AuthScreen marca-a no
   instante em que pede a sessão; o AppRoot tira-a quando o Supabase avisa
   que a sessão começou, e monta a porta por cima da app para a abrir.
   Uma entrada que não vem deste ecrã (sessão guardada, link de email) não
   tem porta. */
let ENTRADA_STAFF = null;
export function tirarEntradaStaff() {
  const e = ENTRADA_STAFF;
  ENTRADA_STAFF = null;
  if (!e || Date.now() - e.t > 15000) return null;
  return e;
}

/* O link de "nova palavra-passe" volta à app com ?mjp=nova-passe. Lê-se
   ao carregar o ficheiro, antes de o Supabase limpar o endereço. */
export const PEDIU_NOVA_PASSE = (() => {
  try { return new URLSearchParams(window.location.search).get('mjp') === 'nova-passe' || /type=recovery/.test(window.location.hash); } catch (e) { return false; }
})();
function enderecoLimpo() {
  return `${window.location.origin}${window.location.pathname}`;
}

/* ===================================================================
   FACE ID / IMPRESSÃO DIGITAL DA EQUIPA TÉCNICA (fase 2)
   ===================================================================
   O mesmo caminho que o Portal já usa (WebAuthn), mas com uma Edge Function
   própria, "staff-acesso" (a "portal-biometria" não é tocada):
   - ATIVAR: depois de entrar com a palavra-passe, a porta pergunta se quer
     entrar da próxima vez com o Face ID / a impressão digital. O aparelho
     cria um par de chaves; o servidor guarda só a pública.
   - ENTRAR: o emblema (Face ID) ou as costas da credencial (impressão
     digital) pedem a leitura; o servidor confirma a assinatura e devolve um
     token, que a app troca por uma sessão normal do Supabase (verifyOtp).
     Não passa por email nenhum.
   Neste aparelho guarda-se só QUE conta o ativou e o id da chave
   (`mjp-staff-bio`). A cara e o dedo nunca saem do telemóvel. */
const CHAVE_BIO = 'mjp-staff-bio';
const chaveRecusaBio = (uid) => `mjp-staff-bio-recusa:${uid}`;

function b64uParaBuf(s) {
  const b = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function bufParaB64u(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// O nome do gesto, como o aparelho lhe chama.
function bioTextos() {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return { nome: 'Face ID', comArtigo: 'o Face ID' };
    if (/Macintosh/.test(ua)) return { nome: 'Touch ID', comArtigo: 'o Touch ID' };
    if (/Windows/.test(ua)) return { nome: 'desbloqueio do computador', comArtigo: 'o desbloqueio do computador' };
  } catch (e) { /* segue para o habitual */ }
  return { nome: 'impressão digital', comArtigo: 'a impressão digital' };
}
export const BIO_TXT = bioTextos();
export async function staffBioDisponivel() {
  try {
    return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (e) { return false; }
}
// Este aparelho tem a entrada rápida ativa para esta conta?
export function staffBioEstado(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_BIO) || 'null');
    return v && uid && v.uid === uid && v.credencial ? v : null;
  } catch (e) { return null; }
}
function esquecerBio() { try { localStorage.removeItem(CHAVE_BIO); } catch (e) { /* nada */ } }
// "Agora não" vale 30 dias; depois a porta volta a perguntar.
function recusouBio(uid) {
  try {
    const t = Number(localStorage.getItem(chaveRecusaBio(uid)) || 0);
    return !!t && Date.now() - t < 30 * 24 * 3600 * 1000;
  } catch (e) { return false; }
}
function marcarRecusaBio(uid) { try { localStorage.setItem(chaveRecusaBio(uid), String(Date.now())); } catch (e) { /* nada */ } }
function descricaoAparelho() {
  try {
    const ua = navigator.userAgent || '';
    const a = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Aparelho';
    return a;
  } catch (e) { return 'Aparelho'; }
}
// Erros da Edge Function com o motivo à vista (401 = verificação JWT
// ligada; 404 = função não publicada).
async function staffFn(corpo) {
  const { data, error } = await supabase.functions.invoke('staff-acesso', { body: corpo });
  if (error) {
    const estado = error.context && error.context.status;
    let motivo = estado === 401 ? 'erro 401' : estado === 404 ? 'erro 404 · função staff-acesso não encontrada' : estado ? `erro ${estado}` : 'sem ligação ao servidor';
    let semAparelho = false;
    try {
      const c = error.context && typeof error.context.json === 'function' ? await error.context.json() : null;
      if (c && c.erro) motivo = c.erro;
      if (c && c.semAparelho) semAparelho = true;
    } catch (e) { /* sem corpo */ }
    const e = new Error(motivo); e.semAparelho = semAparelho; throw e;
  }
  return typeof data === 'string' ? JSON.parse(data) : (data || {});
}
async function bioCriar(o) {
  const cred = await navigator.credentials.create({ publicKey: {
    ...o,
    challenge: b64uParaBuf(o.challenge),
    user: { ...o.user, id: b64uParaBuf(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: b64uParaBuf(c.id) })),
  } });
  return {
    id: cred.id, rawId: bufParaB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: bufParaB64u(cred.response.clientDataJSON),
      attestationObject: bufParaB64u(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
  };
}
async function bioLer(o) {
  const cred = await navigator.credentials.get({ publicKey: {
    ...o,
    challenge: b64uParaBuf(o.challenge),
    allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: b64uParaBuf(c.id) })),
  } });
  return {
    id: cred.id, rawId: bufParaB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: bufParaB64u(cred.response.clientDataJSON),
      authenticatorData: bufParaB64u(cred.response.authenticatorData),
      signature: bufParaB64u(cred.response.signature),
      userHandle: cred.response.userHandle ? bufParaB64u(cred.response.userHandle) : undefined,
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
  };
}
// O motivo de uma falha, curto, para se perceber o que aconteceu.
function motivoBio(e) {
  if (!e) return '';
  if (e.name === 'NotSupportedError') return 'este navegador não suporta';
  if (e.name === 'SecurityError') return 'endereço não autorizado';
  if (e.name === 'InvalidStateError') return 'já ativo neste aparelho';
  return String(e.message || e.name || '').slice(0, 90);
}
// Leitura cancelada pela pessoa (ou fechada): não é erro, não se avisa.
const foiCancelado = (e) => !!e && (e.name === 'NotAllowedError' || e.name === 'AbortError');

/* Ativar neste aparelho (precisa de sessão). `preparado` = opções pedidas
   antes do toque, para o Safari não perder o gesto à espera da rede. */
export async function staffPrepararAtivacao(nome) {
  const r = await staffFn({ acao: 'registo-opcoes', nome: nome || '' });
  return { ...r, t: Date.now() };
}
export async function staffBioAtivar(nome, preparado) {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session && session.user && session.user.id;
  if (!uid) throw new Error('sem sessão');
  const p = preparado && Date.now() - preparado.t < 90000 ? preparado : await staffPrepararAtivacao(nome);
  let resp;
  try {
    resp = await bioCriar(p.opcoes);
  } catch (e) {
    /* "JÁ EXISTE UMA CHAVE DESTA CONTA NESTE APARELHO" (InvalidStateError).
       Acontece quando a chave criada noutro aparelho chega a este por
       sincronização (ex.: o Chrome guarda-a no Gestor de Palavras-passe da
       Google e ela aparece no telemóvel). Não é um erro: este aparelho já
       consegue entrar com ela. Marca-se como ativo. */
    if (e && e.name === 'InvalidStateError') {
      try { localStorage.setItem(CHAVE_BIO, JSON.stringify({ uid, credencial: 'sincronizada' })); localStorage.removeItem(chaveRecusaBio(uid)); } catch (x) { /* nada */ }
      return true;
    }
    throw e;
  }
  const v = await staffFn({ acao: 'registo-verificar', desafio: p.desafio, resposta: resp, descricao: descricaoAparelho() });
  try { localStorage.setItem(CHAVE_BIO, JSON.stringify({ uid, credencial: v.credencial })); localStorage.removeItem(chaveRecusaBio(uid)); } catch (e) { /* nada */ }
  return true;
}
// Desativar neste aparelho (apaga a chave no servidor e aqui).
export async function staffBioDesativar() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(CHAVE_BIO) || 'null'); } catch (e) { v = null; }
  if (v && v.credencial && v.credencial !== 'sincronizada') { try { await staffFn({ acao: 'aparelho-remover', credencial: v.credencial }); } catch (e) { /* fica só a limpeza local */ } }
  esquecerBio();
}
// O responsável da equipa muda a palavra-passe de um membro.
export async function staffReporPalavraPasse(team, alvo, palavra) {
  return staffFn({ acao: 'repor-palavra-passe', team, alvo, palavra });
}
// As funções que se escolhem em "Gerir equipa" e aparecem na credencial.
export const FUNCOES_STAFF = [
  'Treinador principal', 'Treinador adjunto', 'Treinador de guarda-redes', 'Preparador físico',
  'Analista', 'Fisioterapeuta', 'Médico', 'Nutricionista', 'Psicólogo', 'Diretor desportivo',
  'Coordenador', 'Delegado', 'Team manager', 'Roupeiro',
];

/* ---------------- cores e pequenas ajudas ---------------- */
function mistura(hex, alvo, q) {
  const h = String(hex || '#B5393F').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return alvo === 'ffffff' ? '#F2D4D6' : '#5A1D20';
  const a = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  const b = [0, 2, 4].map(i => parseInt(alvo.slice(i, i + 2), 16));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * q).toString(16).padStart(2, '0')).join('');
}
function saudacao() {
  const h = new Date().getHours();
  return h < 6 ? 'BOA NOITE' : h < 13 ? 'BOM DIA' : h < 20 ? 'BOA TARDE' : 'BOA NOITE';
}
function emailEscondido(email) {
  const [u, d] = String(email || '').split('@');
  if (!d) return email || '';
  return `${u.slice(0, 2)}•••@${d}`;
}
function iniciais(nome) {
  const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  // Um nome curto, de uma só palavra (ex.: "JP"), já são as iniciais.
  if (p.length === 1) return (p[0].length <= 3 ? p[0] : p[0][0]).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function epocaAtual() {
  const h = new Date(); const y = h.getMonth() >= 6 ? h.getFullYear() : h.getFullYear() - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

/* ---------------- o onze no quadro ----------------
   Posições em % do quadro: a equipa ataca para a direita, por isso o lado
   DIREITO da equipa fica em BAIXO (defesas, da direita para a esquerda:
   2, 3, 4, 5; o extremo direito, 7, em baixo; o esquerdo, 11, em cima).
   Todas deixam o círculo central livre, para o emblema se ver.

   Cada lista segue A MESMA ORDEM DE LUGARES de FORMACOES no App.jsx
   (GR, DD, DC, DC, DE, …): assim o número de cada íman é o da camisola de
   quem jogou nesse lugar no último jogo (a app guarda-os em
   `porta.numeros`, pela mesma ordem). Sem números guardados, usam-se os
   habituais de cada lugar (o 3.º valor). Sem formação, não há ímanes. */
const TATICAS = {
  '4-3-3':   [[9, 50, 1], [23, 79, 2], [21, 60, 3], [21, 40, 4], [23, 21, 5], [36, 50, 6], [45, 73, 8], [45, 27, 10], [76, 80, 7], [83, 50, 9], [76, 20, 11]],
  '4-4-2':   [[9, 50, 1], [23, 79, 2], [21, 60, 3], [21, 40, 4], [23, 21, 5], [40, 85, 7], [36, 60, 8], [36, 40, 6], [40, 15, 11], [72, 60, 9], [72, 40, 10]],
  '4-2-3-1': [[9, 50, 1], [23, 79, 2], [21, 60, 3], [21, 40, 4], [23, 21, 5], [42.5, 63.5, 8], [42.5, 36.5, 6], [66, 80, 7], [61.5, 50, 10], [66, 20, 11], [84, 50, 9]],
  '3-4-3':   [[9, 50, 1], [22, 72, 3], [20, 50, 4], [22, 28, 5], [42, 87, 2], [37, 60, 8], [37, 40, 10], [42, 13, 6], [74, 80, 7], [83, 50, 9], [74, 20, 11]],
  '3-5-2':   [[9, 50, 1], [22, 72, 3], [20, 50, 4], [22, 28, 5], [44, 88, 2], [42, 69, 8], [34, 50, 6], [42, 31, 10], [44, 12, 11], [73, 60, 9], [73, 40, 7]],
  // jogo de 9
  '3-2-3':   [[9, 50, 1], [22, 78, 2], [20, 50, 4], [22, 22, 5], [38, 63, 8], [38, 37, 6], [68, 80, 7], [80, 50, 9], [68, 20, 11]],
  '3-3-2':   [[9, 50, 1], [22, 78, 2], [20, 50, 4], [22, 22, 5], [40, 78, 8], [36, 50, 6], [40, 22, 10], [72, 62, 9], [72, 38, 11]],
  '2-3-3':   [[9, 50, 1], [22, 67, 2], [22, 33, 4], [40, 78, 8], [36, 50, 6], [40, 22, 10], [68, 80, 7], [80, 50, 9], [68, 20, 11]],
  // jogo de 7
  '3-2-1':   [[9, 50, 1], [24, 78, 2], [22, 50, 4], [24, 22, 5], [40, 65, 8], [40, 35, 6], [76, 50, 9]],
  '2-3-1':   [[9, 50, 1], [24, 67, 2], [24, 33, 4], [40, 80, 8], [36, 50, 6], [40, 20, 10], [76, 50, 9]],
  '2-2-2':   [[9, 50, 1], [24, 67, 2], [24, 33, 4], [40, 65, 8], [40, 35, 6], [72, 62, 9], [72, 38, 11]],
};
// O onze a mostrar: posições da formação + números das camisolas. Um
// lugar que ficou vazio no último jogo mostra o íman sem número.
function onzeDaPorta(porta) {
  const base = porta && TATICAS[porta.formacao];
  if (!base) return null;
  const temNumeros = !!(porta.numeros && String(porta.numeros).replace(/,/g, '').trim());
  const nums = temNumeros ? String(porta.numeros).split(',') : [];
  return base.map((p, i) => [p[0], p[1], temNumeros ? String(nums[i] || '').trim() : String(p[2])]);
}

/* ---------------- desenhos ---------------- */
function Escudo({ logo, cor, tam, branco }) {
  if (logo) {
    return <img src={logo} alt="" style={{ height: tam, width: 'auto', maxWidth: tam * 1.3, objectFit: 'contain', display: 'block', filter: branco ? 'grayscale(1) brightness(2.4)' : 'none', opacity: branco ? 0.8 : 1 }} />;
  }
  return (
    <svg viewBox="0 0 40 44" height={tam} width={tam * 40 / 44} aria-hidden="true" style={{ display: 'block' }}>
      <path d="M2 2 H38 V22 Q38 36 20 42 Q2 36 2 22 Z" fill={branco ? 'rgba(255,255,255,.28)' : '#fff'} stroke={branco ? 'rgba(255,255,255,.95)' : cor} strokeWidth={branco ? 1.6 : 3} />
      <path d="M8 8 H32 V22 Q32 32 20 36 Q8 32 8 22 Z" fill={cor} fillOpacity={branco ? 0.9 : 1} />
    </svg>
  );
}

// O campo inteiro, num quadro de 348 × 254.
function Campo({ id }) {
  return (
    <svg viewBox="0 0 348 254" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A8352" /><stop offset="1" stopColor="#21502F" /></linearGradient>
        {/* A luz vem do círculo no teto: mais clara em cima, ao centro, e a
            escurecer para baixo e para os lados. */}
        <radialGradient id={`${id}l`} cx="50%" cy="-12%" r="95%"><stop offset="0" stopColor="#FFF4D6" stopOpacity=".2" /><stop offset=".55" stopColor="#FFF4D6" stopOpacity=".05" /><stop offset="1" stopColor="#FFF4D6" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></linearGradient>
      </defs>
      <rect width="348" height="254" fill={`url(#${id}f)`} />
      <g opacity=".06" fill="#fff">{[20, 76, 132, 188, 244, 300].map(x => <rect key={x} x={x} y="0" width="28" height="254" />)}</g>
      <g fill="none" stroke="#fff" strokeOpacity=".88" strokeWidth="1.5">
        <rect x="20" y="22" width="308" height="210" />
        <line x1="174" y1="22" x2="174" y2="232" />
        <circle cx="174" cy="127" r="27" />
        <rect x="20" y="68" width="48" height="118" /><rect x="20" y="100" width="16" height="54" />
        <rect x="280" y="68" width="48" height="118" /><rect x="312" y="100" width="16" height="54" />
        <path d="M68 105.3 A27 27 0 0 1 68 148.7" /><path d="M280 105.3 A27 27 0 0 0 280 148.7" />
        <path d="M20 26 A4 4 0 0 0 24 22" /><path d="M324 22 A4 4 0 0 0 328 26" />
        <path d="M24 232 A4 4 0 0 0 20 228" /><path d="M328 228 A4 4 0 0 0 324 232" />
        <rect x="13" y="116.5" width="7" height="21" strokeWidth="1.3" /><rect x="328" y="116.5" width="7" height="21" strokeWidth="1.3" />
      </g>
      <g stroke="#fff" strokeOpacity=".35" strokeWidth=".5">
        {[120, 124, 128, 132].map(y => <line key={`a${y}`} x1="13" y1={y} x2="20" y2={y} />)}
        {[120, 124, 128, 132].map(y => <line key={`b${y}`} x1="328" y1={y} x2="335" y2={y} />)}
      </g>
      <g fill="#fff" fillOpacity=".9"><circle cx="174" cy="127" r="1.8" /><circle cx="52" cy="127" r="1.6" /><circle cx="296" cy="127" r="1.6" /></g>
      <rect width="348" height="254" fill={`url(#${id}l)`} />
      <rect width="348" height="254" fill={`url(#${id}s)`} />
    </svg>
  );
}

// O quadro inteiro (campo + emblema + ímanes), na largura W.
function QuadroInteiro({ W, H, id, cor, logo, onze, saltar }) {
  const m = Math.max(16, Math.round(W * 0.06));
  const fundo = `radial-gradient(circle at 35% 30%, ${mistura(cor, 'ffffff', 0.25)}, ${mistura(cor, '0d120f', 0.4)})`;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
      <Campo id={id} />
      {/* O emblema do clube, com as cores verdadeiras (não gravado como no
          vidro do Portal), dentro do círculo central. */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' }}>
        <Escudo logo={logo} cor={cor} tam={Math.round(H * 0.165)} />
      </div>
      {(onze || []).map((p, i) => (
        <div key={i} className={saltar ? 'mjp-ps-salta' : undefined} style={{
          position: 'absolute', left: `${p[0]}%`, top: `${p[1]}%`, width: m, height: m, marginLeft: -m / 2, marginTop: -m / 2,
          borderRadius: '50%', background: fundo, border: '2px solid #F7F3EA', boxShadow: '0 3px 4px rgba(0,0,0,.45)', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: Math.round(m * 0.46), lineHeight: 1,
          animationDelay: `${i * 40}ms`,
        }}>{p[2]}</div>
      ))}
    </div>
  );
}

/* As duas folhas do quadro. Cada uma leva a sua metade do campo, do
   emblema e dos ímanes; abrem pela linha do meio-campo. */
function FolhasQuadro({ W, H, cor, logo, onze, saltar, aberto }) {
  const folha = {
    position: 'absolute', top: 0, bottom: 0, width: '50%', overflow: 'hidden', willChange: 'transform',
    transition: 'transform .7s cubic-bezier(.65,0,.35,1)',
  };
  return (
    <>
      <div style={{ ...folha, left: 0, transform: aberto ? 'translateX(-101%)' : 'none' }}>
        <QuadroInteiro W={W} H={H} id="mjpqe" cor={cor} logo={logo} onze={onze} saltar={saltar} />
      </div>
      <div style={{ ...folha, right: 0, transform: aberto ? 'translateX(101%)' : 'none' }}>
        <div style={{ position: 'absolute', left: -W / 2, top: 0 }}>
          <QuadroInteiro W={W} H={H} id="mjpqd" cor={cor} logo={logo} onze={onze} saltar={saltar} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.95)', opacity: aberto ? 0 : 1, transition: 'opacity .12s' }} />
    </>
  );
}

const URL_FONTES = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';
const CSS = `
  @keyframes mjp-ps-balanca { 0% { transform: translateY(-40px) rotate(-10deg); opacity: 0; } 60% { transform: translateY(3px) rotate(3deg); opacity: 1; } 82% { transform: rotate(-1.2deg); } 100% { transform: none; opacity: 1; } }
  @keyframes mjp-ps-brilho { 0% { left: -70%; } 100% { left: 150%; } }
  @keyframes mjp-ps-salta { 0%,100% { transform: translateY(0) scale(1); } 40% { transform: translateY(-8px) scale(1.2); } }
  @keyframes mjp-ps-pisca { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
  @keyframes mjp-ps-treme { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
  .mjp-ps-salta { animation: mjp-ps-salta .42s ease-in-out both; }
  .mjp-ps-pisca { animation: mjp-ps-pisca .45s ease-in-out infinite; }
  .mjp-ps-cred { animation: mjp-ps-balanca 1.2s cubic-bezier(.2,.8,.2,1) both; transform-origin: 50% -60px; }
  .mjp-ps-treme { animation: mjp-ps-treme .45s; }
  @keyframes mjp-ps-respira { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  @keyframes mjp-ps-varre { 0% { top: 10%; } 50% { top: 86%; } 100% { top: 10%; } }
  @keyframes mjp-ps-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(201,162,39,.55); } 50% { box-shadow: 0 0 0 12px rgba(201,162,39,0); } }
  .mjp-ps-respira { animation: mjp-ps-respira 2.2s ease-in-out infinite; }
  .mjp-ps-varre { animation: mjp-ps-varre 1s ease-in-out infinite; }
  .mjp-ps-pulso { animation: mjp-ps-pulso 2s ease-in-out infinite; }
  @keyframes mjp-ps-onda { 0% { transform: scale(.55); opacity: .95; } 80% { opacity: 0; } 100% { transform: scale(1.65); opacity: 0; } }
  .mjp-ps-onda { animation: mjp-ps-onda 2.2s cubic-bezier(.2,.6,.3,1) infinite; }
  .mjp-ps-campo::placeholder { color: #5d6b62; }
  .mjp-ps-campo:focus { outline: 2px solid #FFC23D; outline-offset: 1px; }
  .mjp-ps button:focus-visible { outline: 2px solid #FFC23D; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .mjp-ps *, .mjp-ps-folhas * { animation: none !important; transition-duration: 1ms !important; } }
`;

/* AS FONTES E AS ANIMAÇÕES FICAM NO <head>, POSTAS UMA VEZ E NUNCA TIRADAS.
   Antes iam num <style> dentro da porta: quando a porta saía de cena, o
   browser largava as fontes e voltava a carregá-las — a app perdia a letra
   Oswald durante um instante e o ecrã "piscava". As fontes são as mesmas
   que a app já usa (o mesmo endereço), por isso não se carrega nada a mais. */
function garantirEstilos() {
  try {
    if (!document.getElementById('mjp-ps-fontes')) {
      const l = document.createElement('link');
      l.id = 'mjp-ps-fontes'; l.rel = 'stylesheet'; l.href = URL_FONTES;
      document.head.appendChild(l);
    }
    if (!document.getElementById('mjp-ps-css')) {
      const st = document.createElement('style');
      st.id = 'mjp-ps-css'; st.textContent = CSS;
      document.head.appendChild(st);
    }
  } catch (e) { /* sem <head>: fica com as fontes do sistema */ }
}

/* SEM BARRA DE SCROLL NEM FAIXA À DIREITA ENQUANTO A PORTA ESTÁ EM CENA.
   A app reserva sempre, à direita, o espaço da barra de scroll
   (html { scrollbar-gutter: stable }) e o browser mostra esse espaço como
   uma faixa. Enquanto a porta está em cena, tira-se essa reserva e a página
   não desliza — é o mesmo que o Portal faz na sua porta (PE_SEM_GUTTER).
   Na porta que abre por cima da app, a reserva volta no instante em que o
   campo começa a abrir (`repor`), com a cena presa à largura que tinha,
   para nada saltar de lado. Ao sair, fica tudo como estava. */
function useSemFaixa() {
  const repor = useRef(() => {});
  useLayoutEffect(() => {
    let st = null;
    try {
      st = document.createElement('style');
      st.setAttribute('data-mjp-ps-sem-faixa', '');
      st.textContent = 'html, body { overflow: hidden !important; } html { scrollbar-gutter: auto !important; }';
      document.head.appendChild(st);
    } catch (e) { st = null; }
    repor.current = () => { if (st && st.parentNode) st.parentNode.removeChild(st); st = null; };
    return () => repor.current();
  }, []);
  return repor;
}

/* MEDIDAS: TUDO CABE NO ECRÃ, SEM DESLIZAR, ATÉ AO "MAIS OPÇÕES".
   A cena é uma coluna fixa: letreiro, quadro, fita, credencial e, em
   baixo, a ligação e o "⋯ Mais opções". Conta-se o espaço que cada parte
   ocupa de verdade (incluindo as margens do telemóvel, em cima e em
   baixo) e o quadro fica com o que sobra, até 520 px de largura. Num ecrã
   baixo, primeiro encolhe o quadro; se ainda não chegar, encolhe também a
   credencial (k < 1), nunca abaixo de 70 %. */
const CW = 214, CH = 268; // cartão de treinador: mais largo, maior no ecrã
const ALTURA_FIXA =
  18 + 6 + 48 +   // margem de cima e letreiro
  14 + 14 +       // espaço e aro do quadro
  9 + 36 + 2 +    // fita
  4 + 44 +        // "Mais opções"
  10 + 8;         // margem de baixo e folga
let MARGENS_TELEMOVEL = null;
function margensTelemovel() {
  if (MARGENS_TELEMOVEL) return MARGENS_TELEMOVEL;
  let cima = 0, baixo = 0;
  try {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    cima = parseFloat(cs.paddingTop) || 0; baixo = parseFloat(cs.paddingBottom) || 0;
    d.remove();
  } catch (e) { /* sem margens */ }
  MARGENS_TELEMOVEL = { cima, baixo };
  return MARGENS_TELEMOVEL;
}
function medir() {
  const vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
  const m = margensTelemovel();
  const livre = vh - ALTURA_FIXA - m.cima - m.baixo;           // para o quadro + credencial
  const hLargura = Math.min(vw * 0.9, 520) * 254 / 348;          // o maior que a largura deixa
  let H = Math.min(hLargura, livre - CH);
  let k = 1;
  if (H < 165) {
    // Ecrã baixo: o quadro fica com cerca de metade e a credencial encolhe.
    H = Math.max(130, Math.min(hLargura, livre * 0.46));
    k = Math.max(0.7, Math.min(1, (livre - H) / CH));
  }
  else {
    // Ecrã alto: o espaço que sobra vai para o cartão, que cresce até 18 %.
    k = Math.max(1, Math.min(1.18, (livre - H) / CH));
  }
  H = Math.round(H);
  return { W: Math.round(H * 348 / 254), H, k };
}
function useMedidas() {
  const [m, setM] = useState(medir);
  useEffect(() => {
    const f = () => setM(medir());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}



/* ===================================================================
   A CENA (o ecrã da porta). Usada pelo ecrã de entrada e, já com sessão,
   pela porta que abre por cima da app.
   =================================================================== */
function CenaPorta({ porta, estado, verso, viraAnim, saltar, children, folhasFora, cenaRef, buracoRef, onEmblema, tremer, rodape, semChegada, faceId = 'desligado', sensor = null, onVirar = null }) {
  const { W, H, k } = useMedidas();
  useState(garantirEstilos);
  const cor = (porta && porta.cor) || '#B5393F';
  const escura = mistura(cor, '0d120f', 0.4);
  const logo = (porta && porta.logo) || '';
  const onze = onzeDaPorta(porta);
  const sinal = estado === 'autorizado' ? '#4CAF6A' : estado === 'verificar' ? '#FFC23D' : '#FF5A4E';
  const letreiro = estado === 'autorizado' ? 'ACESSO AUTORIZADO' : estado === 'verificar' ? 'A VERIFICAR' : 'ACESSO RESERVADO';
  const verde = estado === 'autorizado';
  const nome = (porta && porta.nome) || '';
  const clube = (porta && porta.clube) || 'Mister JP';
  const aro = verde ? 'rgba(76,175,106,.95)' : estado === 'verificar' ? 'rgba(255,194,61,.85)' : 'transparent';

  // A credencial vira-se em 3D; depois de virada, fica plana (os campos de
  // texto dentro de transformações 3D falham em alguns telemóveis).
  const virada = !!verso;
  const plano = virada && !viraAnim;
  const face = {
    position: 'absolute', inset: 0, borderRadius: 12, overflow: 'hidden', boxSizing: 'border-box',
    boxShadow: `0 16px 30px rgba(0,0,0,.6), 0 0 0 2px ${aro}`, transition: 'box-shadow .3s',
    WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden',
  };
  /* O SENSOR NO CARTÃO. Onde estava o chip dourado está agora um sensor —
     como nos cartões com impressão digital. Mostra o símbolo do aparelho
     (impressão digital, Face ID…) e pulsa: tocar-lhe entra logo. Sem a
     entrada rápida ativa, mostra uma chave e vira o cartão para a
     palavra-passe. É o gesto principal do ecrã, à vista, sem legenda. */
  const sensorModo = sensor ? sensor.modo : null; // 'bio' | 'passe' | 'a-ler' | 'ok'
  const corSensor = sensorModo === 'ok' ? '#8EE6A0' : '#C9A227';
  const iconeSensor = sensorModo === 'passe' ? ICONE_CHAVE : ICONE_BIO;
  const frente = (
    <div style={{ ...face, background: 'linear-gradient(160deg,#1E2A22 0%,#2C3A30 55%,#141B16 100%)', color: '#F3ECDA' }}>
      <div style={{ position: 'absolute', left: '50%', top: 8, width: 30, height: 7, marginLeft: -15, borderRadius: 4, background: '#0B0F0D' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.035) 0 8px, transparent 8px 16px)' }} />
      <div style={{ position: 'absolute', right: -40, top: 60, opacity: 0.08, pointerEvents: 'none' }}>
        <svg width="180" height="198" viewBox="0 0 40 44" aria-hidden="true"><path d="M2 2 H38 V22 Q38 36 20 42 Q2 36 2 22 Z" fill="#fff" /></svg>
      </div>
      <div style={{ position: 'absolute', left: 14, right: 12, top: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Escudo logo={logo} cor={cor} tam={24} />
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '.05em', lineHeight: 1.05, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clube}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 60, height: 25, background: 'linear-gradient(90deg,#B8902E,#F1D27A 50%,#B8902E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.24em', color: '#1A1408' }}>EQUIPA TÉCNICA</div>
      {sensor ? (
        <button type="button" onClick={sensor.onClick || undefined} disabled={!sensor.onClick}
          aria-label={sensorModo === 'passe' ? 'Entrar com a palavra-passe' : `Entrar com ${BIO_TXT.comArtigo}`}
          className={sensor.pulsar ? 'mjp-ps-pulso' : undefined}
          style={{ position: 'absolute', left: '50%', top: 100, width: 76, height: 76, marginLeft: -38, borderRadius: 18, zIndex: 2, padding: 0, background: '#0D120F', border: `2px solid ${corSensor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sensor.onClick ? 'pointer' : 'default', transition: 'border-color .3s' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={corSensor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={sensorModo === 'a-ler' ? 'mjp-ps-pisca' : undefined}>{iconeSensor}</svg>
        </button>
      ) : null}
      <div style={{ position: 'absolute', left: 14, right: 14, top: 190, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 21, fontWeight: 600, lineHeight: 1.05, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome || 'Por ativar'}</div>
        <div style={{ fontSize: 12, color: '#C9D2C5', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome ? (porta.funcao || (porta.souDono ? 'Responsável da equipa' : 'Equipa técnica')) : 'Entra uma vez para a ativar'}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 11, textAlign: 'center', fontSize: 10.5, letterSpacing: '.12em', color: '#9AA89F' }}>ÉPOCA {(porta && porta.epoca) || epocaAtual()}</div>
      <div style={{ position: 'absolute', top: '-20%', bottom: '-20%', width: '40%', pointerEvents: 'none', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.22), transparent)', transform: 'skewX(-18deg)', animation: 'mjp-ps-brilho 1.6s ease-in-out 1.1s 1 both' }} />
    </div>
  );
  const costas = (
    <div style={{ ...face, background: 'linear-gradient(160deg,#141B16 0%,#1E2A22 60%,#101611 100%)', color: '#F3ECDA', transform: plano ? 'none' : 'rotateY(180deg)' }}>
      <div style={{ position: 'absolute', left: '50%', top: 8, width: 30, height: 7, marginLeft: -15, borderRadius: 4, background: '#0B0F0D' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'linear-gradient(90deg,#B8902E,#F1D27A 50%,#B8902E)' }} />
      {children}
      {onVirar && (
        <button type="button" onClick={onVirar} aria-label="Ver a frente da credencial" title="Virar a credencial"
          style={{ position: 'absolute', right: 8, top: 8, width: 30, height: 30, borderRadius: 15, zIndex: 3, padding: 0, background: 'rgba(13,18,15,.85)', border: '1px solid #3A4440', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONE_VIRAR}</svg>
        </button>
      )}
    </div>
  );

  return (
    <div ref={cenaRef} className="mjp-ps" style={{
      position: 'fixed', inset: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 18%, #26342B 0%, #0B0F0D 75%)',
      ...(folhasFora ? { willChange: 'opacity' } : null),
      fontFamily: "'Inter', system-ui, sans-serif", color: '#F3ECDA', display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box',
    }}>
      {/* luz de teto */}
      <div data-mjp-topo="" aria-hidden="true" style={{ position: 'absolute', left: '50%', top: -8, width: 'min(80vw, 420px)', height: 22, transform: 'translateX(-50%)', borderRadius: '50%', border: '3px solid rgba(255,230,160,.75)', boxShadow: '0 0 24px 6px rgba(255,230,160,.22)' }} />

      {/* letreiro (a mesma linguagem do Portal) */}
      <div data-mjp-topo="" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, background: '#0D120F', border: '1px solid #3A4440', borderRadius: 8, padding: '6px 16px', boxShadow: '0 0 16px rgba(255,194,61,.15)', flexShrink: 0, marginTop: 6 }}>
        <span className={estado === 'verificar' ? 'mjp-ps-pisca' : undefined} style={{ width: 9, height: 9, borderRadius: '50%', background: sinal, boxShadow: `0 0 8px ${sinal}`, transition: 'background .3s' }} />
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 11, letterSpacing: '.18em', color: verde ? '#8EE6A0' : '#8A9A8C', transition: 'color .3s' }}>{letreiro}</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: '.3em', color: verde ? '#8EE6A0' : '#FFC23D', transition: 'color .3s' }}>STAFF</div>
        </div>
      </div>

      {/* o quadro (aro metálico, o buraco das folhas e a calha) */}
      <div style={{ position: 'relative', zIndex: 3, flexShrink: 0, marginTop: 14, width: W + 14, height: H + 14 }}>
        {/* aro: a luz de cima apanha a aresta de cima; a sombra cai para baixo */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 9, background: 'linear-gradient(90deg,#3A423D,#5E6862 50%,#3A423D)', boxShadow: 'inset 0 1.5px 0 rgba(255,240,200,.35), 0 18px 32px rgba(0,0,0,.6)' }} />
        <div ref={buracoRef} style={{ position: 'absolute', left: 7, top: 7, width: W, height: H, overflow: 'hidden', borderRadius: 3, background: '#121614' }}>
          {!folhasFora && <FolhasQuadro W={W} H={H} cor={cor} logo={logo} onze={onze} saltar={saltar} aberto={false} />}
        </div>
        {/* O emblema é o "pontapé de saída" (Face ID, numa fase seguinte). */}
        {onEmblema && (
          <button type="button" onClick={onEmblema} aria-label="Entrar" style={{
            position: 'absolute', left: 7 + W / 2 - H * 0.14, top: 7 + H / 2 - H * 0.14, width: H * 0.28, height: H * 0.28,
            borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, zIndex: 3,
          }} />
        )}
        {/* Os quatro cantos do Face ID à volta do círculo central: dizem o
            que é, sem legenda. Só aparecem com a entrada rápida ativa. */}
        {faceId !== 'desligado' && (() => {
          const t = Math.round(H * 0.4), c = Math.round(t * 0.22);
          const corC = faceId === 'ok' ? '#8EE6A0' : '#C9A227';
          const canto = (o) => ({ position: 'absolute', width: c, height: c, borderColor: corC, borderStyle: 'solid', borderWidth: 0, transition: 'border-color .3s', ...o });
          return (
            <div aria-hidden="true" className={faceId === 'pronto' ? 'mjp-ps-respira' : undefined} data-face={faceId} style={{ position: 'absolute', left: 7 + W / 2 - t / 2, top: 7 + H / 2 - t / 2, width: t, height: t, pointerEvents: 'none', zIndex: 2 }}>
              {/* Uma onda de luz sai do círculo central: "toca aqui". */}
              {faceId === 'pronto' && <div className="mjp-ps-onda" style={{ position: 'absolute', inset: '8%', borderRadius: '50%', border: '2.5px solid rgba(255,214,120,.95)', boxShadow: '0 0 16px rgba(255,214,120,.65), inset 0 0 10px rgba(255,214,120,.35)' }} />}
              <div style={canto({ left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 8 })} />
              <div style={canto({ right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 8 })} />
              <div style={canto({ left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 8 })} />
              <div style={canto({ right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 8 })} />
              {faceId === 'a-ler' && <div className="mjp-ps-varre" style={{ position: 'absolute', left: '8%', right: '8%', height: 2, background: '#FFC23D', boxShadow: '0 0 8px #FFC23D' }} />}
            </div>
          );
        })()}
      </div>

      {/* fita, nas cores do clube: vem de trás do quadro até à mola */}
      <div aria-hidden="true" style={{ position: 'relative', zIndex: 1, flexShrink: 0, width: CW, height: 36, marginTop: 9 }}>
        <svg width="220" height="110" viewBox="0 -70 220 110" style={{ position: 'absolute', left: '50%', top: -72, transform: 'translateX(-50%)', overflow: 'visible' }}>
          <path d="M40 -70 L104 34" stroke={cor} strokeWidth="9" strokeLinecap="round" />
          <path d="M180 -70 L116 34" stroke={escura} strokeWidth="9" strokeLinecap="round" />
          <rect x="98" y="29" width="24" height="12" rx="3" fill="#C9CFC6" />
        </svg>
      </div>
      <div className={tremer ? 'mjp-ps-treme' : undefined} style={{ position: 'relative', flexShrink: 0, width: CW * k, height: CH * k, marginTop: 2, transform: estado === 'verificar' ? 'translateY(-10px)' : 'none', transition: 'transform .4s cubic-bezier(.3,1.4,.5,1)' }}>
       <div style={{ width: CW, height: CH, transform: k !== 1 ? `scale(${k})` : 'none', transformOrigin: '0 0' }}>
        <div className={semChegada ? undefined : 'mjp-ps-cred'} style={{ width: CW, height: CH, perspective: 900 }}>
          {/* Chaves diferentes: o cartão 3D é sempre um elemento NOVO. Se o
              React reaproveitasse o elemento das costas planas, o navegador
              via-o sem rotação e a volta para a frente não rodava. */}
          {plano ? <div key="plano" style={{ position: 'relative', width: CW, height: CH }}>{costas}</div> : (
            <div key="3d" data-mjp-cartao3d="" style={{ position: 'relative', width: CW, height: CH, transformStyle: 'preserve-3d', transform: virada ? 'rotateY(180deg)' : 'none', transition: 'transform .65s cubic-bezier(.4,.1,.2,1)' }}>
              {frente}
              {costas}
            </div>
          )}
        </div>
       </div>
      </div>

      {rodape}
    </div>
  );
}

const ICONE_FACE = (
  <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" />
  </>
);
const ICONE_DEDO = (
  <>
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" />
    <path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </>
);
const ICONE_CHAVE = (
  <>
    <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
    <circle cx="16.5" cy="7.5" r="1.2" />
  </>
);
const ICONE_VIRAR = (
  <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>
);
// Nas costas da credencial: o símbolo do sensor que este aparelho tem.
const ICONE_BIO = BIO_TXT.nome === 'Face ID' ? ICONE_FACE : ICONE_DEDO;

/* ---------------- o verso da credencial ---------------- */
const rotulo = { fontSize: 9.5, letterSpacing: '.1em', color: '#9AA8A0', textTransform: 'uppercase' };
const campo = { height: 40, width: '100%', boxSizing: 'border-box', padding: '0 10px', background: '#121815', border: '1.5px solid #FF4B5A', borderRadius: 8, color: '#FFC23D', fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 500 };
const titulo = { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 500, letterSpacing: '.06em', lineHeight: 1.35, color: '#F3ECDA', textAlign: 'center', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 };
const escondido = { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: 0, top: 0 };

/* ===================================================================
   O ECRÃ DE ENTRADA
   =================================================================== */
export default function AuthScreen({ modo }) {
  const [porta, setPorta] = useState(() => lerPortaStaff());
  const conhecido = !!(porta && porta.email);
  const novaPasse = modo === 'nova-passe';
  const versoInicial = novaPasse ? 'nova' : conhecido ? 'passe' : 'novo';
  // null (frente) | 'passe' (conta deste aparelho) | 'novo' (email +
  // palavra-passe) | 'criar' | 'recuperar' | 'nova' (depois do link).
  const [verso, setVerso] = useState(null);
  const [viraAnim, setViraAnim] = useState(true);
  const [email, setEmail] = useState(() => (porta && porta.email) || '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [estado, setEstado] = useState('fechado'); // fechado | verificar | autorizado
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');
  const [tremer, setTremer] = useState(false);
  const [opcoes, setOpcoes] = useState(false);
  const passeRef = useRef(null);
  const timers = useRef([]);
  const depois = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* ENTRADA RÁPIDA (Face ID / impressão digital). Só existe se este
     aparelho a ativou para esta conta. O desafio pede-se ANTES do toque e
     renova-se a cada 50 s: no iPhone e no Safari, a leitura tem de nascer
     do toque, sem esperar pela rede. */
  const uid = porta && porta.uid;
  const [bioAtivo, setBioAtivo] = useState(() => !!(conhecido && uid && staffBioEstado(uid)));
  const [lendo, setLendo] = useState(null); // 'face' | 'digital' | null
  const prep = useRef(null);
  const preparar = async () => {
    if (!uid) return null;
    try {
      const r = await staffFn({ acao: 'entrada-opcoes', uid });
      if (r && r.semAparelho) { esquecerBio(); setBioAtivo(false); prep.current = null; return { semAparelho: true }; }
      prep.current = { ...r, t: Date.now() };
      return prep.current;
    } catch (e) { prep.current = null; return null; }
  };
  useEffect(() => {
    if (!bioAtivo) return undefined;
    preparar();
    const iv = setInterval(preparar, 50000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioAtivo]);

  // A credencial chega a balançar e fica de frente. Só se vira quando a
  // pessoa escolhe por onde entrar: o emblema, a ligação por baixo da
  // credencial ou o Mais opções. (No link da nova palavra-passe já vem
  // virada, porque não há outra coisa a fazer.)
  useEffect(() => {
    if (novaPasse) { depois(() => setVerso('nova'), 1250); depois(() => setViraAnim(false), 1250 + 700); }
    else depois(() => setViraAnim(false), 1250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // O ecrã é fixo: a página não desliza por trás e não há barra de scroll.
  useSemFaixa();

  const mudarVerso = (v) => {
    setErro(''); setInfo(''); setPassword(''); setPassword2('');
    if (v === verso) return;
    setViraAnim(true);
    setVerso(v);
    depois(() => setViraAnim(false), 700);
  };
  const falhou = (msg) => {
    setEstado('fechado'); setErro(msg); setTremer(true);
    depois(() => setTremer(false), 500);
  };
  const traduzir = (err) => {
    const m = (err && err.message) || '';
    if (m === 'Invalid login credentials') return 'Email ou palavra-passe incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Falta confirmar o email: abre a mensagem que recebeste.';
    if (/rate limit|too many/i.test(m)) return 'Demasiadas tentativas. Espera um pouco e tenta outra vez.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem ligação. Verifica a internet e tenta outra vez.';
    return m || 'Não foi possível entrar.';
  };

  const entrar = async (e) => {
    if (e) e.preventDefault();
    if (estado !== 'fechado') return;
    setErro(''); setInfo('');
    const em = (conhecido && verso === 'passe' ? porta.email : email).trim();
    if (!em) { falhou('Escreve o teu email.'); return; }
    if (!password) { falhou('Escreve a palavra-passe.'); return; }
    setEstado('verificar');
    // Marca-se ANTES: o aviso de sessão iniciada do Supabase chega durante
    // a chamada, e é nesse instante que o AppRoot monta a porta.
    ENTRADA_STAFF = { t: Date.now(), verso: verso || versoInicial };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password });
      if (error) throw error;
      setEstado('autorizado');
    } catch (err) {
      ENTRADA_STAFF = null;
      falhou(traduzir(err));
    }
  };

  const entrarBio = async (via) => {
    if (estado !== 'fechado' || !uid) return;
    setErro(''); setInfo(''); setEstado('verificar'); setLendo(via);
    const desativado = () => {
      esquecerBio(); setBioAtivo(false); setLendo(null);
      mudarVerso('passe');
      falhou(`${BIO_TXT.nome[0].toUpperCase()}${BIO_TXT.nome.slice(1)} deixou de estar ativo neste aparelho. Entra com a palavra-passe.`);
    };
    try {
      let p = prep.current;
      if (!p || Date.now() - p.t > 55000) p = await preparar();
      if (p && p.semAparelho) { desativado(); return; }
      if (!p) throw new Error('Failed to fetch');
      prep.current = null;
      const resposta = await bioLer(p.opcoes);
      const v = await staffFn({ acao: 'entrada-verificar', uid, desafio: p.desafio, resposta });
      // Marca-se ANTES de abrir a sessão, como na palavra-passe.
      ENTRADA_STAFF = { t: Date.now(), verso, via: 'bio' };
      let r = await supabase.auth.verifyOtp({ token_hash: v.token_hash, type: v.tipo || 'magiclink' });
      if (r.error) r = await supabase.auth.verifyOtp({ token_hash: v.token_hash, type: 'email' });
      if (r.error) throw r.error;
      setEstado('autorizado');
    } catch (err) {
      ENTRADA_STAFF = null; setLendo(null);
      preparar();
      if (foiCancelado(err)) { setEstado('fechado'); return; }
      if (err && err.semAparelho) { desativado(); return; }
      falhou(traduzir(err));
    }
  };

  const criar = async (e) => {
    if (e) e.preventDefault();
    if (estado !== 'fechado') return;
    setErro(''); setInfo('');
    if (!email.trim() || password.length < 6) { falhou('Escreve o email e uma palavra-passe com 6 ou mais caracteres.'); return; }
    setEstado('verificar');
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      setEstado('fechado');
      setInfo('Conta criada. Confirma o email e depois entra.');
    } catch (err) {
      falhou(traduzir(err));
    }
  };

  const pedirNovaPasse = async (e) => {
    if (e) e.preventDefault();
    if (estado !== 'fechado') return;
    setErro(''); setInfo('');
    const em = email.trim();
    if (!em) { falhou('Escreve o email da tua conta.'); return; }
    setEstado('verificar');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: `${enderecoLimpo()}?mjp=nova-passe` });
      if (error) throw error;
      setEstado('fechado');
      setInfo('Link enviado. Abre o email neste aparelho.');
    } catch (err) {
      falhou(traduzir(err));
    }
  };

  const gravarNovaPasse = async (e) => {
    if (e) e.preventDefault();
    if (estado !== 'fechado') return;
    setErro(''); setInfo('');
    if (password.length < 6) { falhou('Usa 6 ou mais caracteres.'); return; }
    if (password !== password2) { falhou('As duas não são iguais.'); return; }
    setEstado('verificar');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setEstado('autorizado');
      depois(() => window.location.replace(enderecoLimpo()), 700);
    } catch (err) {
      falhou(traduzir(err));
    }
  };

  const outraConta = () => {
    apagarPortaStaff();
    setPorta(null);
    setEmail('');
    setOpcoes(false);
    mudarVerso('novo');
  };
  const tocarEmblema = () => {
    // Com a entrada rápida ativa, o emblema é o Face ID (o "pontapé de
    // saída"). Sem ela, leva à palavra-passe.
    if (bioAtivo) { entrarBio('face'); return; }
    const alvo = conhecido ? 'passe' : 'novo';
    if (verso !== alvo) mudarVerso(alvo);
    depois(() => { try { passeRef.current && passeRef.current.focus(); } catch (er) { /* nada */ } }, verso === alvo ? 0 : 750);
  };

  const ocupado = estado !== 'fechado';
  const aviso = (erro || info) ? (
    <div role="status" style={{ fontSize: 11, lineHeight: 1.3, color: erro ? '#FF8A80' : '#8EE6A0', textAlign: 'center' }}>{erro || info}</div>
  ) : null;
  const botao = (texto) => (
    <button type="submit" disabled={ocupado} style={{
      marginTop: 'auto', height: 42, flexShrink: 0, border: 'none', borderRadius: 8, background: (porta && porta.cor) || '#B5393F', color: '#fff',
      fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: '.14em', cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? 0.75 : 1,
    }}>{estado === 'verificar' ? '…' : texto}</button>
  );
  const formulario = { position: 'absolute', inset: 0, margin: 0, padding: '22px 11px 11px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 5 };

  let conteudoVerso;
  const v = verso || versoInicial;
  const quem = conhecido ? (porta.souDono ? 'MISTER' : (String(porta.nome || '').split(/\s+/)[0] || 'MISTER').toUpperCase()) : 'MISTER';
  const linhaEmail = conhecido ? <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#9AA8A0', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emailEscondido(porta.email)}</div> : null;
  if (v === 'digital' && conhecido) {
    const corBio = estado === 'autorizado' ? '#8EE6A0' : '#C9A227';
    conteudoVerso = (
      <div style={{ ...formulario, alignItems: 'center', padding: '24px 11px 14px' }}>
        <div style={{ ...titulo, width: '100%' }}>{saudacao()}, {quem}</div>
        {linhaEmail}
        <button type="button" onClick={() => entrarBio('digital')} aria-label={`Entrar com ${BIO_TXT.comArtigo}`}
          className={estado === 'fechado' ? 'mjp-ps-pulso' : undefined}
          style={{ marginTop: 'auto', marginBottom: erro ? 4 : 'auto', width: 96, height: 96, borderRadius: 22, background: '#0D120F', border: `2px solid ${corBio}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'border-color .3s' }}>
          <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke={corBio} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={estado === 'verificar' && lendo === 'digital' ? 'mjp-ps-pisca' : undefined}>{ICONE_BIO}</svg>
        </button>
        {aviso}
      </div>
    );
  } else if (v === 'passe' && conhecido) {
    conteudoVerso = (
      <form onSubmit={entrar} style={formulario}>
        <div style={titulo}>{saudacao()}, {quem}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#9AA8A0', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emailEscondido(porta.email)}</div>
        {/* o email vai no formulário (invisível) para o gestor de palavras-passe o reconhecer */}
        <input type="email" name="email" autoComplete="username" value={porta.email} readOnly tabIndex={-1} aria-hidden="true" style={escondido} />
        <label htmlFor="mjp-ps-pp" style={{ ...rotulo, marginTop: 8 }}>Palavra-passe</label>
        <input id="mjp-ps-pp" ref={passeRef} className="mjp-ps-campo" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={campo} />
        {aviso}
        {botao('ENTRAR')}
      </form>
    );
  } else if (v === 'criar') {
    conteudoVerso = (
      <form onSubmit={criar} style={formulario}>
        <div style={titulo}>CRIAR CONTA</div>
        <label htmlFor="mjp-ps-em" style={rotulo}>Email</label>
        <input id="mjp-ps-em" className="mjp-ps-campo" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={campo} />
        <label htmlFor="mjp-ps-pp" style={rotulo}>Palavra-passe</label>
        <input id="mjp-ps-pp" ref={passeRef} className="mjp-ps-campo" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={campo} />
        {aviso}
        {botao('CRIAR CONTA')}
      </form>
    );
  } else if (v === 'recuperar') {
    /* As contas da equipa técnica usam emails sem caixa de correio: o
       caminho normal é o responsável da equipa escolher uma nova, em Gerir
       equipa. O link por email fica para quem tem mesmo correio. */
    conteudoVerso = (
      <div style={formulario}>
        <div style={titulo}>NOVA PALAVRA-PASSE</div>
        <div style={{ fontSize: 12, color: '#C9D2C5', lineHeight: 1.45, textAlign: 'center', marginTop: 8 }}>Pede uma nova ao responsável da equipa. Ele escolhe-a em <b style={{ color: '#F3ECDA', fontWeight: 600 }}>Gerir equipa</b> e diz-ta.</div>
        <div style={{ marginTop: 'auto', fontSize: 10.5, color: '#9AA8A0', textAlign: 'center', lineHeight: 1.4 }}>O teu email recebe correio?</div>
        <button type="button" onClick={() => mudarVerso('recuperar-email')} style={{ marginTop: 5, height: 40, flexShrink: 0, borderRadius: 8, background: 'transparent', border: '1.5px solid #C9A227', color: '#E2C04A', fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: '.12em', cursor: 'pointer' }}>ENVIAR LINK</button>
      </div>
    );
  } else if (v === 'recuperar-email') {
    conteudoVerso = (
      <form onSubmit={pedirNovaPasse} style={formulario}>
        <div style={titulo}>LINK POR EMAIL</div>
        <div style={{ fontSize: 11, color: '#9AA8A0', lineHeight: 1.4, textAlign: 'center' }}>Enviamos um link para escolheres uma nova.</div>
        <label htmlFor="mjp-ps-em" style={{ ...rotulo, marginTop: 4 }}>Email</label>
        <input id="mjp-ps-em" className="mjp-ps-campo" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={campo} />
        {aviso}
        {botao('ENVIAR LINK')}
      </form>
    );
  } else if (v === 'nova') {
    conteudoVerso = (
      <form onSubmit={gravarNovaPasse} style={formulario}>
        <div style={titulo}>NOVA PALAVRA-PASSE</div>
        <label htmlFor="mjp-ps-pp" style={{ ...rotulo, marginTop: 4 }}>Palavra-passe nova</label>
        <input id="mjp-ps-pp" ref={passeRef} className="mjp-ps-campo" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={campo} />
        <label htmlFor="mjp-ps-pp2" style={rotulo}>Repete</label>
        <input id="mjp-ps-pp2" className="mjp-ps-campo" type="password" autoComplete="new-password" value={password2} onChange={e => setPassword2(e.target.value)} style={campo} />
        {aviso}
        {botao('GRAVAR')}
      </form>
    );
  } else {
    conteudoVerso = (
      <form onSubmit={entrar} style={formulario}>
        <div style={titulo}>ENTRAR NO GABINETE</div>
        <label htmlFor="mjp-ps-em" style={rotulo}>Email</label>
        <input id="mjp-ps-em" className="mjp-ps-campo" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} style={campo} />
        <label htmlFor="mjp-ps-pp" style={rotulo}>Palavra-passe</label>
        <input id="mjp-ps-pp" ref={passeRef} className="mjp-ps-campo" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={campo} />
        {aviso}
        {botao('ENTRAR')}
      </form>
    );
  }

  const ligacao = { minHeight: 40, padding: '2px 6px', background: 'transparent', border: 'none', color: '#C9A227', fontFamily: "'Inter', sans-serif", fontSize: 13.5, textDecoration: 'underline', cursor: 'pointer' };
  /* Por baixo da credencial, uma só ligação. Na fase seguinte (impressão
     digital) passa a ser "Usar a impressão digital"; enquanto não existe,
     é a palavra-passe. Com a credencial virada, "Ver a credencial" volta a pô-la de frente. */
  const entrarPasse = () => { mudarVerso(conhecido ? 'passe' : 'novo'); depois(() => { try { passeRef.current && passeRef.current.focus(); } catch (er) { /* nada */ } }, 750); };
  /* Virar de volta COM A MESMA ANIMAÇÃO da ida. As costas, depois de
     viradas, ficam planas (por causa dos campos de texto); primeiro volta
     a montar-se o cartão em 3D, ainda virado, e só no frame seguinte se
     manda rodar para a frente — senão saltava sem rodar. */
  const [aVirarFrente, setAVirarFrente] = useState(false);
  const deFrente = () => {
    setErro(''); setInfo(''); setPassword('');
    setViraAnim(true);
    setAVirarFrente(true);
  };
  // Montado o cartão 3D ainda virado, obriga-se o navegador a registar
  // esse estado (lendo o estilo) e só então se manda rodar para a frente.
  useLayoutEffect(() => {
    if (!aVirarFrente) return;
    try { const el = document.querySelector('[data-mjp-cartao3d]'); if (el) void getComputedStyle(el).transform; } catch (e) { /* nada */ }
    const r = requestAnimationFrame(() => {
      setVerso(null);
      setAVirarFrente(false);
      depois(() => setViraAnim(false), 700);
    });
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aVirarFrente]);
  const voltar = verso
    ? <button type="button" style={ligacao} onClick={deFrente}>{bioAtivo && BIO_TXT.nome === 'Face ID' ? 'Usar o Face ID' : 'Ver a credencial'}</button>
    : bioAtivo
      ? <button type="button" style={ligacao} onClick={() => mudarVerso('digital')}>Usar {BIO_TXT.comArtigo}</button>
      : <button type="button" style={ligacao} onClick={entrarPasse}>Entrar com a palavra-passe</button>;
  const opcao = { width: '100%', textAlign: 'left', padding: '13px 14px', borderRadius: 12, background: '#182619', border: '1px solid #3A4F3D', color: '#ECEFEA', fontSize: 14.5, cursor: 'pointer', fontFamily: "'Inter', sans-serif" };

  const rodape = novaPasse ? null : (
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', paddingTop: 4, flexShrink: 0 }}>
      <button type="button" onClick={() => setOpcoes(true)} style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#8A9A8C', fontSize: 14, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
        <span style={{ fontSize: 18, lineHeight: 1, letterSpacing: 1 }}>⋯</span> Mais opções
      </button>
    </div>
  );

  return (
    <>
      <CenaPorta
        porta={porta} estado={estado} verso={verso} viraAnim={viraAnim} tremer={tremer}
        onEmblema={novaPasse ? null : tocarEmblema} rodape={rodape}
        /* O DESTAQUE É DO EMBLEMA (Face ID, o "pontapé de saída"): com a
           entrada rápida ativa, só ele pulsa; o sensor do cartão fica
           quieto (funciona na mesma). Sem entrada rápida, pulsa a chave do
           cartão, que é então o único caminho. */
        faceId={!bioAtivo || novaPasse ? 'desligado' : estado === 'autorizado' ? 'ok' : (estado === 'verificar' && lendo === 'face') ? 'a-ler' : 'pronto'}
        sensor={novaPasse ? null : {
          modo: estado === 'autorizado' ? 'ok' : (estado === 'verificar' && lendo === 'digital') ? 'a-ler' : bioAtivo ? 'bio' : 'passe',
          pulsar: estado === 'fechado' && !bioAtivo,
          onClick: estado === 'fechado' ? (bioAtivo ? () => entrarBio('digital') : entrarPasse) : null,
        }}
        onVirar={novaPasse ? null : deFrente}
      >
        {conteudoVerso}
      </CenaPorta>
      {opcoes && (
        <div onClick={() => setOpcoes(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(12px + env(safe-area-inset-bottom, 0px)) 12px', boxSizing: 'border-box' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#202F22', border: '1px solid #3A4F3D', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxSizing: 'border-box' }}>
            <button type="button" style={opcao} onClick={() => { setOpcoes(false); entrarPasse(); }}>Entrar com a palavra-passe</button>
            <button type="button" style={opcao} onClick={() => { setOpcoes(false); mudarVerso('recuperar'); }}>Esqueci-me da palavra-passe</button>
            {conhecido && <button type="button" style={opcao} onClick={outraConta}>Entrar com outra conta</button>}
            <button type="button" style={opcao} onClick={() => { setOpcoes(false); mudarVerso('criar'); }}>Criar conta</button>
            <button type="button" style={{ ...opcao, textAlign: 'center', background: 'transparent', border: 'none', color: '#8FA091' }} onClick={() => setOpcoes(false)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ===================================================================
   A PORTA QUE ABRE (já com sessão)
   ===================================================================
   Montada pelo AppRoot POR CIMA da app, logo depois de a sessão ser
   aceite. Mostra a mesma cena, com o acesso autorizado: os onze saltam,
   espera que a app (ou o ecrã das missões) esteja desenhada por baixo, e
   então o campo abre pela linha do meio-campo. A cena apaga-se e o buraco
   da porta cresce até ao ecrã inteiro, deixando ver a app.
   Se a equipa tiver emblema e a barra da app o mostrar, o emblema solta-se
   do círculo central e voa até lá. No fim desmonta-se sozinha.
   NADA NA APP DEPENDE DISTO: a app já está montada por baixo, e qualquer
   erro aqui só faz a porta desaparecer (ver ProtecaoPorta). */
function PortaQueAbre({ entrada, onFim }) {
  const [porta] = useState(() => lerPortaStaff());
  const [saltar, setSaltar] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState(null);
  const cenaRef = useRef(null);
  const buracoRef = useRef(null);
  const vooRef = useRef(null);
  const folhasRef = useRef(null);
  const { W, H } = useMedidas();
  const cor = (porta && porta.cor) || '#B5393F';
  const logo = (porta && porta.logo) || '';
  const onze = onzeDaPorta(porta);
  const fimRef = useRef(onFim);
  fimRef.current = onFim;
  // Enquanto a porta está em cena, a app por baixo não mostra barra de
  // scroll nem a faixa da direita (o ecrã de "a carregar" é um pouco mais
  // alto do que a janela).
  const reporFaixa = useSemFaixa();

  /* ATIVAR A ENTRADA RÁPIDA. Depois de entrar com a palavra-passe, se o
     aparelho tiver Face ID / impressão digital e ainda não estiver ativo
     para esta conta (nem a pessoa tiver dito "Agora não"), as costas da
     credencial perguntam se quer ativar. A porta espera pela resposta. */
  const veioPorBio = !!(entrada && entrada.via === 'bio');
  const [pergunta, setPergunta] = useState(veioPorBio ? null : 'ver'); // 'ver' | 'perguntar' | 'a-ativar' | 'feito' | null
  const perguntaRef = useRef(pergunta);
  perguntaRef.current = pergunta;
  const [erroAtivar, setErroAtivar] = useState('');
  const [bioOk, setBioOk] = useState(veioPorBio);
  const uidRef = useRef(null);
  const prepAtivar = useRef(null);
  useEffect(() => {
    if (veioPorBio) return undefined;
    let vivo = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session && session.user && session.user.id;
        uidRef.current = uid;
        if (uid && staffBioEstado(uid)) { if (vivo) { setBioOk(true); setPergunta(null); } return; }
        const disp = await staffBioDisponivel();
        if (!vivo) return;
        if (!uid || !disp || recusouBio(uid)) { setPergunta(null); return; }
        setPergunta('perguntar');
        try { prepAtivar.current = await staffPrepararAtivacao(porta && porta.nome); } catch (e) { prepAtivar.current = null; }
      } catch (e) { if (vivo) setPergunta(null); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ativar = async () => {
    if (perguntaRef.current !== 'perguntar') return;
    setErroAtivar(''); setPergunta('a-ativar');
    try {
      await staffBioAtivar(porta && porta.nome, prepAtivar.current);
      prepAtivar.current = null;
      setBioOk(true); setPergunta('feito');
      setTimeout(() => setPergunta(null), 900);
    } catch (e) {
      prepAtivar.current = null;
      try { prepAtivar.current = await staffPrepararAtivacao(porta && porta.nome); } catch (e2) { /* volta a pedir no toque */ }
      setPergunta('perguntar');
      if (!foiCancelado(e)) setErroAtivar(`Não foi possível ativar (${motivoBio(e) || 'erro desconhecido'}).`);
    }
  };
  const agoraNao = () => {
    // Depois de uma falha, "Agora não" é só "segue": não conta como recusa.
    if (uidRef.current && !erroAtivar) marcarRecusaBio(uidRef.current);
    setPergunta(null);
  };

  useLayoutEffect(() => {
    const el = buracoRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      furarCena(cenaRef.current, r, document.documentElement.clientWidth || window.innerWidth, window.innerHeight);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    const timers = [];
    const acabar = () => { if (!cancelado) fimRef.current(); };
    const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Os onze saltam uma vez, com o acesso autorizado. A porta só abre com
    // a app pronta por trás.
    timers.push(setTimeout(() => !cancelado && setSaltar(true), 60));

    const abrir = () => {
      if (cancelado) return;
      if (reduzir) { acabar(); return; }
      setAberto(true);
      const cena = cenaRef.current;
      const b = buracoRef.current ? buracoRef.current.getBoundingClientRect() : null;
      const vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
      if (!cena || !b) { reporFaixa.current(); acabar(); return; }
      // A cena fica presa à largura de agora; só depois a app recupera a
      // sua reserva à direita (por trás da porta, que ainda está fechada).
      cena.style.right = 'auto';
      cena.style.width = `${vw}px`;
      try { reporFaixa.current(); } catch (e) { /* nada */ }
      /* A ABERTURA.
         - O aro de luz e o letreiro apagam-se logo (0,25 s), parados.
         - As folhas deslizam (0,7 s) e, pela abertura do meio-campo, vê-se
           desde o primeiro instante a app verdadeira: a cena tem um buraco
           FIXO do tamanho do campo (máscara posta quando a porta aparece).
         - A cena à volta (aro do quadro, credencial, fundo) desvanece e a
           app fica inteira.
         Só se anima `transform` (folhas) e `opacity` (cena): a placa
         gráfica faz isso sem redesenhar nada, por isso é fluido em qualquer
         ecrã. Medido num Chromium: nenhum frame acima de 50 ms, do
         telemóvel ao monitor de 1920 px. (Um buraco a crescer frame a frame,
         ou um zoom da cena, obrigavam a redesenhar a cena e davam saltos.) */
      furarCena(cena, b, vw, vh); // já posta à chegada; repete-se só se faltar
      Array.from(cena.querySelectorAll('[data-mjp-topo]')).forEach(el => {
        el.style.transition = 'opacity .25s ease-out';
        el.style.opacity = '0';
      });
      cena.style.transition = 'opacity .65s cubic-bezier(.4,0,.2,1) .3s';
      requestAnimationFrame(() => { if (!cancelado) cena.style.opacity = '0'; });

      // O emblema voa para a barra da app, se a equipa tiver emblema e a
      // barra o mostrar.
      const voo = vooRef.current;
      const alvo = Array.from(document.querySelectorAll('[data-mjp-logo-equipa]')).find(el => {
        const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      });
      if (logo && alvo && voo && typeof voo.animate === 'function') {
        const a = alvo.getBoundingClientRect(), r = voo.getBoundingClientRect();
        const s = a.height / Math.max(1, r.height);
        const dx = (a.left + a.width / 2) - (r.left + r.width / 2), dy = (a.top + a.height / 2) - (r.top + r.height / 2);
        voo.style.opacity = '1';
        voo.animate([
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 1, offset: 0.9 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 },
        ], { duration: 1100, delay: 150, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      }
      timers.push(setTimeout(acabar, 1400));
    };

    /* SÓ ABRE COM A APP PRONTA POR TRÁS. A app marca-se com
       `data-mjp-app` quando já tem os dados e mostra o ecrã verdadeiro (o
       ecrã de "a carregar" não tem a marca). Depois espera 4 frames
       seguidos fluidos, para a abertura não apanhar a app ainda a
       desenhar-se. Nunca abre antes de 0,8 s; se a app demorar mais de
       10 s, abre na mesma (a app trata do resto, como sempre). */
    let ini = performance.now();
    let ult = 0, bons = 0, raf = 0, prontaEm = 0, perguntouAte = 0;
    const aPerguntar = () => ['ver', 'perguntar', 'a-ativar', 'feito'].includes(perguntaRef.current);
    const esperar = (t) => {
      if (cancelado) return;
      if (!prontaEm && document.querySelector('[data-mjp-app]')) prontaEm = t;
      bons = ult && (t - ult) < 34 ? bons + 1 : 0;
      ult = t;
      // Enquanto a credencial está a perguntar, a porta não abre (e os
      // prazos só começam a contar depois da resposta).
      if (aPerguntar()) { perguntouAte = t; raf = requestAnimationFrame(esperar); return; }
      if (perguntouAte) { ini = Math.max(ini, perguntouAte - 800); perguntouAte = 0; }
      const pronta = prontaEm && t - prontaEm > 250 && bons >= 4 && t - ini > 800;
      if (pronta || t - ini > 10000) abrir(); else raf = requestAnimationFrame(esperar);
    };
    raf = requestAnimationFrame(esperar);
    // Rede de segurança: aconteça o que acontecer, a porta sai de cena
    // (menos enquanto a pessoa está a responder à pergunta).
    const seguranca = () => { if (aPerguntar()) timers.push(setTimeout(seguranca, 3000)); else acabar(); };
    timers.push(setTimeout(seguranca, 13000));
    return () => { cancelado = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tamEmb = Math.round(H * 0.165);
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
      <CenaPorta porta={porta} estado="autorizado" verso={entrada ? (entrada.verso || null) : 'passe'} viraAnim={false}
        folhasFora semChegada cenaRef={cenaRef} buracoRef={buracoRef} rodape={<div style={{ marginTop: 'auto', height: 84, flexShrink: 0 }} />}
        faceId={bioOk && !aberto ? 'ok' : 'desligado'}
        sensor={{ modo: 'ok', onClick: null }}>
        {(pergunta === 'perguntar' || pergunta === 'a-ativar') ? (
          <div style={{ position: 'absolute', inset: 0, padding: '24px 12px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
            <div style={{ ...titulo, width: '100%' }}>ENTRADA RÁPIDA</div>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginTop: 6, flexShrink: 0 }}>{ICONE_BIO}</svg>
            {erroAtivar
              ? <div role="status" style={{ fontSize: 11, color: '#FF8A80', lineHeight: 1.35, textAlign: 'center', overflow: 'hidden' }}>{erroAtivar}</div>
              : <div style={{ fontSize: 12, color: '#C9D2C5', lineHeight: 1.4, textAlign: 'center' }}>Da próxima vez, entra só com {BIO_TXT.comArtigo}.</div>}
            <button type="button" onClick={ativar} disabled={pergunta === 'a-ativar'} style={{
              marginTop: 'auto', width: '100%', height: 40, flexShrink: 0, border: 'none', borderRadius: 8, background: cor, color: '#fff',
              fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: '.14em', cursor: 'pointer', opacity: pergunta === 'a-ativar' ? 0.75 : 1,
            }}>{pergunta === 'a-ativar' ? '…' : 'ATIVAR'}</button>
            <button type="button" onClick={agoraNao} disabled={pergunta === 'a-ativar'} style={{ minHeight: 30, background: 'transparent', border: 'none', color: '#9AA8A0', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Agora não</button>
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8EE6A0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
        )}
      </CenaPorta>
      {/* As folhas, por cima do buraco (fora do recorte da cena). */}
      {rect && (
        <div ref={folhasRef} className="mjp-ps-folhas" style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height, overflow: 'hidden', borderRadius: 3 }}>
          <FolhasQuadro W={W} H={H} cor={cor} logo={logo} onze={onze} saltar={saltar} aberto={aberto} />
        </div>
      )}
      {rect && logo && (
        <div ref={vooRef} style={{
          position: 'fixed', left: rect.left + rect.width / 2 - tamEmb * 0.65, top: rect.top + rect.height / 2 - tamEmb / 2,
          width: tamEmb * 1.3, height: tamEmb, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transformOrigin: '50% 50%',
        }}>
          <Escudo logo={logo} cor={cor} tam={tamEmb} />
        </div>
      )}
    </div>
  );
}

/* O buraco da cena: quatro faixas à volta do campo (máscara). Fica posto
   desde que a porta aparece — as folhas tapam-no enquanto está fechada —
   para que, ao abrir, a placa gráfica só tenha de mover e apagar. */
function furarCena(cena, b, vw, vh) {
  if (!cena || !b || cena.dataset.furada === '1') return;
  const camadas = 'linear-gradient(#000,#000),linear-gradient(#000,#000),linear-gradient(#000,#000),linear-gradient(#000,#000)';
  const px = (n) => `${Math.max(0, Math.round(n))}px`;
  const tam = [`${px(vw)} ${px(b.top)}`, `${px(vw)} ${px(vh - b.top - b.height)}`, `${px(b.left)} ${px(b.height)}`, `${px(vw - b.left - b.width)} ${px(b.height)}`].join(',');
  const pos = [`0px 0px`, `0px ${px(b.top + b.height)}`, `0px ${px(b.top)}`, `${px(b.left + b.width)} ${px(b.top)}`].join(',');
  Object.assign(cena.style, {
    webkitMaskImage: camadas, maskImage: camadas, webkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    webkitMaskSize: tam, maskSize: tam, webkitMaskPosition: pos, maskPosition: pos,
  });
  cena.dataset.furada = '1';
}

// Qualquer erro na porta faz só a porta desaparecer — nunca a app.
class ProtecaoPorta extends React.Component {
  constructor(props) { super(props); this.state = { erro: false }; }
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(e) { try { console.error('Porta da equipa técnica:', e); } catch (x) { /* nada */ } try { this.props.onFim && this.props.onFim(); } catch (x) { /* nada */ } }
  render() { return this.state.erro ? null : this.props.children; }
}
export function PortaStaffAbrir({ entrada, onFim }) {
  return <ProtecaoPorta onFim={onFim}><PortaQueAbre entrada={entrada} onFim={onFim} /></ProtecaoPorta>;
}
