// api/emblema.js
//
// O EMBLEMA DO CLUBE PARA OS DOCUMENTOS.
//
// Em "Gerir equipa" o emblema é o endereço de uma imagem publicada noutro
// site (site do clube, Drive…). O browser mostra-a sem problema numa <img>,
// mas para a pôr dentro de um Word ou Excel a app tem de LER os pixéis, e
// isso o browser só deixa quando o outro site o autoriza (CORS). A maior
// parte não autoriza: os modelos saíam com a inicial ou o nome em vez do
// emblema. Esta função vai buscar a imagem do lado do servidor e devolve-a
// à app, que assim a consegue desenhar.
//
// Recebe { teamId } e devolve a imagem (os bytes, com o tipo certo).
//
// SEGURANÇA:
// · só para quem tem sessão iniciada e é membro da equipa;
// · NÃO aceita um endereço vindo do pedido: lê o emblema gravado na
//   equipa (teams.logo). Assim ninguém usa esta função para pedir páginas
//   quaisquer em nome do servidor;
// · só https, e nunca endereços da rede interna (127.x, 10.x, 192.168.x,
//   169.254.x…), também depois de cada redireccionamento;
// · só imagens, até 3 MB, com 8 s de tempo máximo.
//
// Variáveis de ambiente (as mesmas das outras funções):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import dns from 'dns/promises';
import net from 'net';

function extrairOrigem(bruto) {
  try { return new URL(bruto).origin; } catch { return (bruto || '').replace(/\/+$/, ''); }
}
const SUPABASE_URL = extrairOrigem(process.env.SUPABASE_URL);
const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_SALTOS = 3;

function ipInterno(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return ipInterno(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function enderecoPermitido(u) {
  if (u.protocol !== 'https:') return false;
  if (net.isIP(u.hostname)) return !ipInterno(u.hostname);
  try {
    const ips = await dns.lookup(u.hostname, { all: true });
    return ips.length > 0 && ips.every(x => !ipInterno(x.address));
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Configuração em falta no servidor.' });
  }
  const { teamId } = req.body || {};
  if (!teamId) return res.status(400).json({ error: 'Equipa em falta' });

  const cab = req.headers.authorization || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sessão em falta.' });
  const { data: quem, error: erroUser } = await supabaseAdmin.auth.getUser(token);
  if (erroUser || !quem || !quem.user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  const { data: membro, error: erroMembro } = await supabaseAdmin
    .from('team_members').select('user_id').eq('team_id', teamId).eq('user_id', quem.user.id).maybeSingle();
  if (erroMembro) return res.status(500).json({ error: 'Não consegui confirmar a equipa.' });
  if (!membro) return res.status(403).json({ error: 'Não pertences a esta equipa.' });

  const { data: equipa, error: erroEquipa } = await supabaseAdmin
    .from('teams').select('logo').eq('id', teamId).maybeSingle();
  if (erroEquipa) return res.status(500).json({ error: 'Não consegui ler a equipa.' });
  const logo = equipa && String(equipa.logo || '').trim();
  if (!logo) return res.status(404).json({ error: 'A equipa não tem emblema.' });

  let url;
  try { url = new URL(logo); } catch { return res.status(400).json({ error: 'O endereço do emblema não é válido.' }); }

  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), 8000);
  try {
    let resp;
    for (let salto = 0; ; salto++) {
      if (!(await enderecoPermitido(url))) return res.status(400).json({ error: 'Endereço do emblema não permitido (tem de ser https e público).' });
      resp = await fetch(url, { redirect: 'manual', signal: parar.signal, headers: { Accept: 'image/*' } });
      if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
        if (salto >= MAX_SALTOS) return res.status(400).json({ error: 'Demasiados redireccionamentos.' });
        url = new URL(resp.headers.get('location'), url);
        continue;
      }
      break;
    }
    if (!resp.ok) return res.status(502).json({ error: `O site do emblema respondeu ${resp.status}.` });
    const tipo = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!tipo.startsWith('image/')) return res.status(415).json({ error: 'O endereço do emblema não é uma imagem.' });
    if (Number(resp.headers.get('content-length') || 0) > MAX_BYTES) return res.status(413).json({ error: 'Emblema demasiado grande (máx. 3 MB).' });

    const partes = []; let total = 0;
    for await (const pedaco of resp.body) {
      total += pedaco.length;
      if (total > MAX_BYTES) return res.status(413).json({ error: 'Emblema demasiado grande (máx. 3 MB).' });
      partes.push(Buffer.from(pedaco));
    }
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(Buffer.concat(partes));
  } catch (e) {
    return res.status(502).json({ error: parar.signal.aborted ? 'O site do emblema demorou demasiado.' : 'Não consegui ir buscar o emblema.' });
  } finally {
    clearTimeout(relogio);
  }
}
