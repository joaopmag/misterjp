// media/videoJunto.js
//
// "OS MEUS VÍDEOS" EM MP4 FEITO NO SERVIDOR (video-worker, juntar.js).
//
// Quando o jogador guarda um vídeo feito só de clipes de vídeos
// CARREGADOS, a app pede ao serviço de vídeo que o junte num MP4 (720p).
// O ficheiro fica no Storage e o "Descarregar" passa a ser imediato.
// Com algum clipe do YouTube não dá (o YouTube não deixa descarregar):
// continua a gravar-se no browser, como antes.
//
// A ASSINATURA descreve os troços (clipe e tempos). O ficheiro só se usa
// se a assinatura dele bater com a dos clipes de agora — se um clipe foi
// editado ou apagado, o ficheiro já não serve e pede-se outro.
// Tem de bater com `assinaturaDe` no video-worker (juntar.js).

import { supabase } from '../supabaseClient';

const VERSAO_FORMATO = 'v1-720p';

export const urlDoServicoVideo = () => (import.meta.env.VITE_VIDEO_WORKER_URL || '').replace(/\/+$/, '');

/* ids já filtrados (só clipes que existem); porId: Map id → clipe. */
export function assinaturaDoVideoJunto(ids, porId) {
  return `${VERSAO_FORMATO}|${ids.map(id => { const c = porId.get(id) || {}; return `${id}@${Number(c.clipInicio)}-${Number(c.clipFim)}`; }).join('|')}`;
}

// Todos os clipes são de vídeos carregados (dá para fazer o MP4 no servidor)?
export function soClipesDeFicheiro(ids, porId) {
  return ids.length > 0 && ids.every(id => { const c = porId.get(id); return c && c.clipNoFicheiro && !c.youtubeId && /^https?:\/\//.test(c.dataUrl || ''); });
}

async function chamar(caminho, corpo, token) {
  const base = urlDoServicoVideo();
  if (!base) throw new Error('sem_servico');
  const r = await fetch(`${base}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`servico_${r.status}`);
  return r.json().catch(() => ({}));
}

/* Portal (código do jogador). */
export const pedirMp4DoVideo = (code, teamId, compId) => chamar('/juntar', { code, teamId, compId });
export const apagarMp4DoVideo = (code, teamId, compId) => chamar('/juntar-apagar', { code, teamId, compId });

/* Staff: jogador apagado → apaga os MP4 dele (RGPD). Não bloqueia nada. */
export async function apagarMp4DoAtleta(teamId, atletaId) {
  if (!urlDoServicoVideo() || !teamId || !atletaId) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.access_token) return;
    await chamar('/juntar-limpar-atleta', { teamId: String(teamId), atletaId: String(atletaId) }, session.access_token);
  } catch (e) { /* fica para a limpeza manual; o vídeo já não aparece a ninguém */ }
}

/* Descarregar o MP4 pronto: o Storage manda-o como anexo com este nome. */
export function descarregarMp4(url, nome) {
  const limpo = String(nome || 'video').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'video';
  const a = document.createElement('a');
  a.href = `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(`${limpo}.mp4`)}`;
  a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}
