// api/seguir-jogador.js
//
// O "porteiro" entre a app e o serviço de seguimento (Modal). A app
// nunca fala diretamente com o Modal — fala com esta função, que
// guarda a chave secreta do lado do servidor e a acrescenta ao pedido.
// É o mesmo motivo por trás do cortar-clipe.js: a chave NUNCA pode ir
// parar ao browser, ou o trancar do Modal não serve de nada.
//
// Recebe exatamente o que o serviço do Modal espera — { video_url,
// x_inicial, y_inicial, t_inicial } — e devolve exatamente o que ele
// responde. Esta função em si não faz nenhum trabalho pesado; só
// reencaminha o pedido, com a chave.
//
// Variáveis de ambiente a configurar no Vercel (nenhuma com VITE_ —
// estas não podem ir parar ao browser):
//   MODAL_SEGUIDOR_URL     (ex.: https://joaopmag--misterjp-seguidor-seguir.modal.run)
//   MODAL_PROXY_KEY_ID     (o "Token ID" criado em modal.com/settings/proxy-auth-tokens)
//   MODAL_PROXY_KEY_SECRET (o "Token Secret" da mesma página)

// SEGURANÇA: só aceita quem tem sessão iniciada na app e pertence a uma
// equipa (o token da sessão vai no pedido e confirma-se no Supabase).
// Sem isto, quem soubesse o endereço podia gastar o Modal à vontade.
// Variáveis precisas também aqui: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (as mesmas do cortar-clipe).
import { createClient } from '@supabase/supabase-js';

function extrairOrigem(bruto) {
  try { return new URL(bruto).origin; } catch { return (bruto || '').replace(/\/+$/, ''); }
}
const SUPABASE_URL = extrairOrigem(process.env.SUPABASE_URL);
const supabaseAdmin = SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export const config = {
  api: { bodyParser: true },
  maxDuration: 300, // o seguimento pode demorar alguns minutos
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { MODAL_SEGUIDOR_URL, MODAL_PROXY_KEY_ID, MODAL_PROXY_KEY_SECRET } = process.env;
  if (!MODAL_SEGUIDOR_URL || !MODAL_PROXY_KEY_ID || !MODAL_PROXY_KEY_SECRET) {
    console.error('seguir-jogador: faltam variáveis de ambiente', {
      temUrl: !!MODAL_SEGUIDOR_URL, temChaveId: !!MODAL_PROXY_KEY_ID, temChaveSecreta: !!MODAL_PROXY_KEY_SECRET,
    });
    return res.status(500).json({ error: 'Serviço de seguimento não configurado no servidor.' });
  }

  // Quem pede: sessão válida e membro de alguma equipa.
  if (!supabaseAdmin) return res.status(500).json({ error: 'Configuração em falta no servidor (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' });
  const cab = req.headers.authorization || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Sessão em falta. Sai e entra na app outra vez.' });
  const { data: quem, error: erroUser } = await supabaseAdmin.auth.getUser(token);
  if (erroUser || !quem || !quem.user) return res.status(401).json({ error: 'Sessão inválida ou expirada. Sai e entra na app outra vez.' });
  const { data: equipas } = await supabaseAdmin.from('team_members').select('team_id').eq('user_id', quem.user.id).limit(1);
  if (!equipas || !equipas.length) return res.status(403).json({ error: 'Sem acesso.' });

  try {
    const resposta = await fetch(MODAL_SEGUIDOR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Modal-Key': MODAL_PROXY_KEY_ID,
        'Modal-Secret': MODAL_PROXY_KEY_SECRET,
      },
      body: JSON.stringify(req.body || {}),
    });
    const texto = await resposta.text();
    let json;
    try { json = JSON.parse(texto); } catch { json = { error: texto || 'Resposta vazia do serviço de seguimento.' }; }
    return res.status(resposta.status).json(json);
  } catch (e) {
    console.error('seguir-jogador: falha a chamar o Modal', e);
    return res.status(502).json({ error: 'Não consegui contactar o serviço de seguimento.' });
  }
}
