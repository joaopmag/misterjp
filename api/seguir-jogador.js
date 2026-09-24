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
