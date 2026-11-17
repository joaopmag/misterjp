// api/video-jogo.js
//
// JOGOS CARREGADOS POR FICHEIRO NO CANAL E NO PORTAL.
//
// Os jogos inteiros carregados na Análise (Estúdio) ficam no bucket PRIVADO
// `videos-originais`. Para irem para o Canal (e daí para o Portal dos
// jogadores) não se copia nem se torna público o ficheiro: dá-se um link
// da app que, a cada pedido, confirma que o jogo continua no Canal e
// reencaminha para um link temporário do Storage.
//
//   POST  { teamId, originalId }   (staff: sessão + equipa)
//         → { url, path }  — o link estável a guardar no vídeo do Canal.
//   GET   ?t=<token>
//         → 302 para um link assinado (6 h) do ficheiro, se ainda houver no
//           Canal um vídeo com esse ficheiro (`ficheiroPrivado.path`).
//           Apagado do Canal → o link deixa de funcionar (a não ser que
//           ainda haja clipes de jogadores a apontar para ele, ver abaixo).
//
// O token é o caminho do ficheiro e a equipa, assinados (HMAC) com uma chave
// tirada da SUPABASE_SERVICE_ROLE_KEY: ninguém consegue inventar um link
// para outro ficheiro. Quem tiver o link vê o jogo (como um vídeo "não
// listado" do YouTube), enquanto o jogo estiver no Canal.
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (as mesmas do resto).

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function extrairOrigem(bruto) {
  try { return new URL(bruto).origin; } catch { return (bruto || '').replace(/\/+$/, ''); }
}
const SUPABASE_URL = extrairOrigem(process.env.SUPABASE_URL);
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = SUPABASE_URL && CHAVE ? createClient(SUPABASE_URL, CHAVE) : null;
const BUCKET = 'videos-originais';
const VALIDADE_S = 6 * 3600;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const chaveHmac = () => crypto.createHash('sha256').update(`mjp-video-jogo:${CHAVE}`).digest();
const assinar = (dados) => b64url(crypto.createHmac('sha256', chaveHmac()).update(dados).digest()).slice(0, 32);

export function criarToken(path, teamId) {
  const dados = b64url(JSON.stringify({ p: path, t: teamId }));
  return `${dados}.${assinar(dados)}`;
}
function lerToken(token) {
  const [dados, sig] = String(token || '').split('.');
  if (!dados || !sig) return null;
  const esperado = assinar(dados);
  if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  try {
    const o = JSON.parse(deB64url(dados).toString('utf8'));
    if (!o || typeof o.p !== 'string' || typeof o.t !== 'string') return null;
    if (!o.p.startsWith(`${o.t}/`) || o.p.includes('..')) return null;
    return o;
  } catch { return null; }
}

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Configuração em falta no servidor (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' });

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    return res.status(204).end();
  }

  // O LINK: confirma e reencaminha.
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const t = lerToken(req.query && req.query.t);
    if (!t) return res.status(404).send('Link inválido');
    try {
      // Ainda está no Canal? (cópia no Canal, não um jogo só da Análise)
      const { data: linhas, error } = await supabaseAdmin
        .from('videos').select('id, data').eq('team_id', t.t).eq('data->ficheiroPrivado->>path', t.p).limit(10);
      if (error) throw error;
      let noCanal = (linhas || []).some(l => l && l.data && l.data.daAnalise !== true);
      /* Retirado da Sala (17/11): os clipes dos jogadores feitos sobre o
         jogo continuam a abrir até terem MP4 próprio (o serviço de vídeo
         fá-lo em poucos minutos e passa o clipe para esse ficheiro). */
      if (!noCanal) {
        const token = String(req.query.t);
        const { data: clipes } = await supabaseAdmin
          .from('video_clips').select('id').eq('team_id', t.t).like('data->>dataUrl', `%/api/video-jogo?t=${token}`).limit(1);
        noCanal = !!(clipes && clipes.length);
      }
      if (!noCanal) return res.status(404).send('Este jogo já não está disponível');
      const { data: s, error: e2 } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(t.p, VALIDADE_S);
      if (e2 || !s) throw e2 || new Error('sem link');
      const destino = s.signedUrl.replace('.supabase.co/storage', '.storage.supabase.co/storage');
      // Guardar o reencaminhamento uns minutos poupa pedidos (o link dura 6 h).
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.setHeader('Location', destino);
      return res.status(302).end();
    } catch (e) {
      console.error('video-jogo: falhou', e && (e.message || e));
      return res.status(500).send('Não foi possível abrir o vídeo');
    }
  }

  // PEDIR O LINK (staff).
  if (req.method === 'POST') {
    const { teamId, originalId } = req.body || {};
    if (!teamId || !originalId) return res.status(400).json({ error: 'Faltam teamId ou originalId' });
    const cab = req.headers.authorization || '';
    const token = cab.startsWith('Bearer ') ? cab.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Sessão em falta. Sai e entra na app outra vez.' });
    const { data: quem, error: erroUser } = await supabaseAdmin.auth.getUser(token);
    if (erroUser || !quem || !quem.user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    const { data: membro } = await supabaseAdmin
      .from('team_members').select('user_id').eq('team_id', teamId).eq('user_id', quem.user.id).maybeSingle();
    if (!membro) return res.status(403).json({ error: 'Não pertences a esta equipa.' });
    const { data: orig, error: e3 } = await supabaseAdmin
      .from('video_originais').select('id, data').eq('id', originalId).eq('team_id', teamId).maybeSingle();
    if (e3) return res.status(500).json({ error: 'Não consegui ler o vídeo.' });
    const path = orig && orig.data && orig.data.storagePath;
    if (!path || !String(path).startsWith(`${teamId}/`)) return res.status(404).json({ error: 'Vídeo não encontrado.' });
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return res.status(200).json({ url: `${proto}://${host}/api/video-jogo?t=${criarToken(path, String(teamId))}`, path });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
