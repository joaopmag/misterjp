// media/descargaDesenhos.js
//
// "MP4 COM DESENHOS" DO STAFF, FEITO NO SERVIDOR (19/11).
//
// Antes, levar um corte com os desenhos obrigava a gravar o separador do
// browser (só no computador, em tempo real). Agora a app manda ao serviço
// de vídeo (video-worker, /descarregar-desenhos) o ficheiro do corte, o
// início e o fim, e o PLANO dos desenhos (planoDesenhos.js: as mesmas
// regras que a app usa a mostrar). O serviço faz o MP4 e devolve o link;
// a app volta a perguntar de 3 em 3 segundos até estar pronto. O mesmo
// corte com os mesmos desenhos dá o mesmo ficheiro: a 2.ª vez é imediata.
// Só para vídeos carregados (ficheiros): o YouTube não deixa descarregar.

import { supabase } from '../supabaseClient';
import { urlDoServicoVideo } from './videoJunto';

/* A equipa dona do ficheiro, lida do próprio link: Storage
   (…/object/public/<balde>/<equipa>/…) ou link de jogo (/api/video-jogo?t=…,
   que leva a equipa dentro). */
export function equipaDoLink(src) {
  const s = String(src || '');
  const m = /\/storage\/v1\/object\/public\/[^/]+\/([^/?]+)\//.exec(s);
  if (m) return decodeURIComponent(m[1]);
  const t = /\/api\/video-jogo\?t=([^&]+)/.exec(s);
  if (t) {
    try {
      const dados = decodeURIComponent(t[1]).split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const o = JSON.parse(atob(dados + '==='.slice((dados.length + 3) % 4)));
      return o && typeof o.t === 'string' ? o.t : '';
    } catch (e) { return ''; }
  }
  return '';
}

export function podeDescarregarComDesenhos(src) {
  return !!urlDoServicoVideo() && /^https?:\/\//.test(String(src || '')) && !!equipaDoLink(src);
}

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

/* Pede o MP4 e espera por ele. Devolve o link do ficheiro.
   onEstado(texto) diz em que ponto vai ("Na fila…", "A preparar…"). */
export async function pedirMp4ComDesenhos({ src, inicio, fim, plano, nome, onEstado, cancelado }) {
  const base = urlDoServicoVideo();
  const teamId = equipaDoLink(src);
  if (!base || !teamId) throw new Error('sem_servico');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.access_token) throw new Error('sem_sessao');
  const corpo = JSON.stringify({ teamId, src, inicio, fim, plano, nome });
  const limite = Date.now() + 15 * 60 * 1000;
  let falhas = 0;
  while (Date.now() < limite) {
    if (cancelado && cancelado()) throw new Error('cancelado');
    let r;
    try {
      r = await fetch(`${base}/descarregar-desenhos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: corpo,
      });
    } catch (e) {
      falhas += 1;
      if (falhas > 5) throw new Error('sem_ligacao');
      await esperar(4000);
      continue;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `servico_${r.status}`);
    falhas = 0;
    if (j.estado === 'pronto' && j.url) return j.url;
    if (j.estado === 'erro') throw new Error(j.erro || 'erro');
    if (onEstado) onEstado(j.posicao > 1 ? `Na fila (${j.posicao})…` : 'A preparar…');
    await esperar(3000);
  }
  throw new Error('demorou');
}
