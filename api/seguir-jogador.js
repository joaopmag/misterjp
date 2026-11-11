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
  // A equipa vem no pedido (app atual); uma app antiga em cache não a
  // manda, e aí usa-se a primeira equipa da pessoa, como antes.
  const { team_id: equipaPedida, ...pedidoModal } = req.body || {};
  let consulta = supabaseAdmin.from('team_members').select('team_id').eq('user_id', quem.user.id);
  if (equipaPedida) consulta = consulta.eq('team_id', equipaPedida);
  const { data: equipas } = await consulta.limit(1);
  if (!equipas || !equipas.length) return res.status(403).json({ error: 'Sem acesso.' });
  const teamId = equipas[0].team_id;

  /* LIMITE POR PLANO (preparado para a versão comercial). Cada
     seguimento gasta no Modal. Se a equipa tiver um limite mensal em
     `planos_equipa.limites.seguir_jogador_mes`, conta-se o uso deste mês
     em `uso_servicos` e recusa-se acima dele. Sem plano, sem limite, ou
     se as tabelas ainda não existirem: segue como sempre (nunca bloqueia
     por um erro de contagem). */
  try {
    const { data: plano } = await supabaseAdmin.from('planos_equipa').select('limites').eq('team_id', teamId).maybeSingle();
    const limite = plano && plano.limites ? Number(plano.limites.seguir_jogador_mes) : NaN;
    if (Number.isFinite(limite)) {
      const agora = new Date();
      const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
      const { count, error: erroContagem } = await supabaseAdmin.from('uso_servicos')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId).eq('servico', 'seguir_jogador').gte('em', inicioMes);
      if (!erroContagem && (count || 0) >= limite) {
        return res.status(429).json({ error: `A tua equipa já usou os ${limite} seguimentos incluídos no plano este mês.` });
      }
    }
  } catch (e) {
    console.warn('seguir-jogador: não consegui verificar o limite do plano', e && e.message);
  }

  try {
    const resposta = await fetch(MODAL_SEGUIDOR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Modal-Key': MODAL_PROXY_KEY_ID,
        'Modal-Secret': MODAL_PROXY_KEY_SECRET,
      },
      body: JSON.stringify(pedidoModal),
    });
    const texto = await resposta.text();
    let json;
    try { json = JSON.parse(texto); } catch { json = { error: texto || 'Resposta vazia do serviço de seguimento.' }; }
    // Regista o uso (só quando o seguimento correu bem). Um erro aqui não
    // estraga a resposta.
    if (resposta.ok) {
      const inicio = Number(pedidoModal.t_inicial) || 0;
      const fim = Number(pedidoModal.t_fim);
      await supabaseAdmin.from('uso_servicos').insert({
        team_id: teamId, servico: 'seguir_jogador', user_id: quem.user.id,
        detalhe: { segundos: Number.isFinite(fim) ? Math.max(0, fim - inicio) : null },
      }).then(({ error }) => { if (error) console.warn('seguir-jogador: uso não registado', error.message); },
        (e) => console.warn('seguir-jogador: uso não registado', e && e.message));
    }
    return res.status(resposta.status).json(json);
  } catch (e) {
    console.error('seguir-jogador: falha a chamar o Modal', e);
    return res.status(502).json({ error: 'Não consegui contactar o serviço de seguimento.' });
  }
}
