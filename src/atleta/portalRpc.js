// atleta/portalRpc.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr } from '../base/utilidades';
import { supabase } from '../supabaseClient';
import { useState, useEffect } from 'react';
import { tirarPrebusca } from './PortalEntrada';

/* MEMÓRIA DO PORTAL (só nesta sessão). Cada área guarda aqui o que
   recebeu; ao voltar a abri-la mostra logo o que tinha (sem "A carregar…"
   nem o conteúdo a saltar) e atualiza em silêncio por trás. O cacifo
   aquece-a ao abrir (aquecerPortal), por isso a 1.ª visita também é
   imediata na maior parte das vezes. */
export const PORTAL_MEM = new Map();

/* Estilos globais do Portal: o "A carregar…" só aparece se demorar mais de
   0,4 s (em pedidos rápidos não pisca), e as miniaturas da Sala de Vídeo
   entram a desvanecer quando acabam de carregar (em vez de passarem de
   uma caixa preta para a imagem de golpe). */
if (typeof document !== 'undefined' && !document.getElementById('mjp-portal-css')) {
  const st = document.createElement('style');
  st.id = 'mjp-portal-css';
  st.textContent = '@keyframes mjp-surgir { from { opacity: 0; } to { opacity: 1; } }'
    + ' .mjp-carregar { animation: mjp-surgir .25s ease-out .4s both; }'
    + ' .mjp-bib img { opacity: 0; transition: opacity .35s ease-out; } .mjp-bib img.mjp-ok { opacity: 1; }';
  document.head.appendChild(st);
}

export const chaveMem = (rpc, code, teamId, extra) => `${rpc}|${code}|${teamId}|${extra || ''}`;

export function lerMem(k) { const v = PORTAL_MEM.get(k); return v && Date.now() - v.t < 15 * 60000 ? v.d : undefined; }

export function gravarMem(k, d) { PORTAL_MEM.set(k, { t: Date.now(), d }); }

export function normalizarRpc(data) {
  let d = data;
  if (Array.isArray(d)) d = d[0];
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica como está */ } }
  return d;
}

export const AQUECER_EM_CURSO = new Set();

export function aquecerPortal(code, teamId) {
  if (!code || !teamId) return;
  [['checkin_ideia_jogo', {}], ['checkin_plano_dia', { p_date: todayStr() }], ['checkin_convocatoria', {}], ['checkin_competicao', {}]].forEach(([rpc, extra]) => {
    const k = chaveMem(rpc, code, teamId, extra.p_date);
    if (lerMem(k) !== undefined || AQUECER_EM_CURSO.has(k)) return;
    AQUECER_EM_CURSO.add(k);
    Promise.resolve(supabase.rpc(rpc, { p_code: code, p_team: teamId, ...extra }))
      .then(({ data, error }) => { if (!error) gravarMem(k, normalizarRpc(data) || {}); })
      .catch(() => {})
      .finally(() => AQUECER_EM_CURSO.delete(k));
  });
}

/* Pedido de uma área com a memória acima: devolve [estado, dados]. */
export function usePortalRpc(rpcName, code, teamId, extra) {
  const k = chaveMem(rpcName, code, teamId, extra && extra.p_date);
  const [estado, setEstado] = useState(() => (lerMem(k) !== undefined ? 'pronto' : 'a-carregar'));
  const [dados, setDados] = useState(() => (lerMem(k) !== undefined ? lerMem(k) : null));
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pre = !extra ? tirarPrebusca(rpcName, code, teamId) : null;
        const { data, error } = pre ? await pre : await supabase.rpc(rpcName, { p_code: code, p_team: teamId, ...(extra || {}) });
        if (cancelado) return;
        if (error) throw error;
        const d = normalizarRpc(data) || {};
        gravarMem(k, d);
        setDados(d);
        setEstado('pronto');
      } catch (e) {
        // Com dados já à vista, um erro de atualização não os apaga.
        if (!cancelado) setEstado(v => (v === 'pronto' ? v : 'erro'));
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcName, code, teamId, k]);
  return [estado, dados];
}

export function usePortalFetch(rpcName, code, teamId) {
  return usePortalRpc(rpcName, code, teamId);
}

// "Os meus clipes" (só no Portal) é um cartão dentro de Jogos, não uma secção.

/* OS MEUS VÍDEOS (Portal do Atleta) — juntar clipes num vídeo só.

   O jogador escolhe clipes seus (de um jogo ou de vários), põe-nos pela
   ordem que quer, dá um nome, e "Ver" reproduz tudo seguido — o mesmo
   mecanismo do "Ver cortes em seguida": no fim de um clipe passa sozinho
   ao seguinte, mesmo que seja de outro jogo.

   Não se cria um ficheiro novo: os clipes são cortes de vídeos do
   YouTube, e o vídeo junto é a LISTA deles, por ordem. Fica guardado
   neste aparelho (no browser), por jogador e por equipa. */
export function hashCurto(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

