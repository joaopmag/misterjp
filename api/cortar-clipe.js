// api/cortar-clipe.js
//
// O CORTE LEVE — a peça central da arquitetura discutida.
//
// Recebe { teamId, storagePath, start, end } e devolve um vídeo pequeno,
// independente, com só esse troço. Não volta a comprimir a imagem
// (`-c copy`): só reorganiza o ficheiro para começar/acabar nesses
// pontos. Por isso é rápido (segundos, não minutos) e cabe bem numa
// função serverless normal.
//
// Como o `-ss`/`-t` vêm ANTES do `-i` e o ffmpeg lê diretamente do
// signed URL (que suporta pedidos por intervalo de bytes, "range
// requests"), nunca é descarregado o vídeo completo para dentro da
// função — só o troço necessário. É isto que evita esbarrar no limite
// de espaço temporário (/tmp) das funções serverless com vídeos de
// jogo que pesam vários gigabytes.
//
// Limitação a aceitar: por não recodificar, o corte "encosta" ao
// keyframe mais próximo ANTES do início pedido — por vezes começa
// meio segundo mais cedo do que o marcado no ecrã. Para clipes de
// análise (não para transmissão), isto não é problema.
//
// Dependências a instalar no projeto:
//   npm install fluent-ffmpeg ffmpeg-static @supabase/supabase-js
//
// Variáveis de ambiente a configurar no Vercel:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (a service role key NUNCA vai para o browser — só existe aqui, no
// servidor; é o que permite escrever no bucket público sem depender
// da sessão de quem está a usar a app)

import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath);

function extrairOrigem(bruto) {
  try { return new URL(bruto).origin; } catch { return (bruto || '').replace(/\/+$/, ''); }
}
const SUPABASE_URL = extrairOrigem(process.env.SUPABASE_URL);
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: { bodyParser: true },
  maxDuration: 60, // ajusta no vercel.json se o plano permitir mais
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('cortar-clipe: faltam variáveis de ambiente', {
      temUrl: !!SUPABASE_URL, temChave: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return res.status(500).json({ error: 'Configuração em falta no servidor: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estão definidas no Vercel.' });
  }
  console.log('cortar-clipe: a usar SUPABASE_URL =', SUPABASE_URL);

  const { teamId, storagePath, start, end } = req.body || {};
  if (!teamId || !storagePath || start == null || end == null || end <= start) {
    return res.status(400).json({ error: 'Parâmetros em falta ou inválidos' });
  }

  const duracao = end - start;
  if (duracao > 180) {
    return res.status(400).json({ error: 'Clipe demasiado longo (máx. 3 min por corte)' });
  }

  try {
    // Signed URL de leitura do vídeo original — só válido alguns minutos,
    // tempo mais do que suficiente para este corte.
    const { data: signed, error: signErr } = await supabaseAdmin
      .storage.from('videos-originais')
      .createSignedUrl(storagePath, 300);
    if (signErr) {
      console.error('cortar-clipe: falhou createSignedUrl', { storagePath, teamId, signErr });
      throw signErr;
    }

    const nomeSaida = `${teamId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const caminhoTemp = path.join(os.tmpdir(), `clip-${Date.now()}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg(signed.signedUrl)
        .inputOptions([`-ss ${start}`])       // seek de INPUT — rápido, só lê o troço
        .outputOptions([`-t ${duracao}`, '-c copy', '-avoid_negative_ts', 'make_zero'])
        .output(caminhoTemp)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const ficheiro = fs.readFileSync(caminhoTemp);
    fs.unlinkSync(caminhoTemp);

    const { error: upErr } = await supabaseAdmin
      .storage.from('videos-clipes')
      .upload(nomeSaida, ficheiro, { contentType: 'video/mp4', upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = supabaseAdmin.storage.from('videos-clipes').getPublicUrl(nomeSaida);

    return res.status(200).json({ storagePath: nomeSaida, publicUrl: pub.publicUrl });
  } catch (e) {
    console.error('cortar-clipe:', e);
    return res.status(500).json({ error: e.message || 'Falha ao cortar o clipe' });
  }
}
