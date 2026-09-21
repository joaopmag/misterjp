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

  const caminhoTemp = path.join(os.tmpdir(), `clip-${Date.now()}.mp4`);
  const caminhoThumb = path.join(os.tmpdir(), `thumb-${Date.now()}.jpg`);

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
    // Endereço direto de storage (recomendado pela Supabase para ficheiros
    // grandes) — evita o gateway (Kong) que torna lentos os pedidos do
    // ffmpeg a pontos fundos dentro de vídeos longos.
    const urlLeituraDireta = signed.signedUrl.replace('.supabase.co/storage', '.storage.supabase.co/storage');

    const nomeSaida = `${teamId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;

    // Tenta cortar até 2 vezes — a causa mais comum de falha aqui é uma
    // quebra momentânea da rede a meio da leitura do vídeo original (que
    // pode ter vários GB), não um problema real com o pedido. Repetir
    // resolve a esmagadora maioria dessas falhas sozinho.
    let ultimoErro = null;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(urlLeituraDireta)
            .inputOptions([`-ss ${start}`])       // seek de INPUT — rápido, só lê o troço
            .outputOptions([`-t ${duracao}`, '-c copy', '-avoid_negative_ts', 'make_zero'])
            .output(caminhoTemp)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        ultimoErro = null;
        break;
      } catch (e) {
        ultimoErro = e;
        console.error(`cortar-clipe: falhou o corte (tentativa ${tentativa})`, e.message || e);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    if (ultimoErro) throw ultimoErro;

    const { error: upErr } = await supabaseAdmin
      .storage.from('videos-clipes')
      .upload(nomeSaida, fs.readFileSync(caminhoTemp), { contentType: 'video/mp4', upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = supabaseAdmin.storage.from('videos-clipes').getPublicUrl(nomeSaida);
    const publicUrlDireto = pub.publicUrl.replace('.supabase.co/storage', '.storage.supabase.co/storage');

    // Miniatura — uma imagem fixa a meio do clipe, para a biblioteca
    // conseguir mostrar cartões com imagem em vez de só texto (muito
    // mais fácil de reconhecer um clipe ao toque, num telemóvel).
    // É um extra: se falhar por algum motivo, o clipe continua a
    // guardar-se na mesma, só sem imagem (a app mostra um ícone).
    let thumbUrlDireto = null;
    try {
      const instanteThumb = Math.max(0, Math.min(duracao - 0.1, duracao / 2));
      await new Promise((resolve, reject) => {
        ffmpeg(caminhoTemp)
          .on('end', resolve)
          .on('error', reject)
          .screenshots({
            timestamps: [instanteThumb],
            filename: path.basename(caminhoThumb),
            folder: path.dirname(caminhoThumb),
            size: '320x?',
          });
      });
      const nomeThumb = nomeSaida.replace(/\.mp4$/, '.jpg');
      const { error: upThumbErr } = await supabaseAdmin
        .storage.from('videos-clipes')
        .upload(nomeThumb, fs.readFileSync(caminhoThumb), { contentType: 'image/jpeg', upsert: false });
      if (!upThumbErr) {
        const { data: pubThumb } = supabaseAdmin.storage.from('videos-clipes').getPublicUrl(nomeThumb);
        thumbUrlDireto = pubThumb.publicUrl.replace('.supabase.co/storage', '.storage.supabase.co/storage');
      }
    } catch (eThumb) {
      console.error('cortar-clipe: falhou a miniatura (não crítico)', eThumb.message || eThumb);
    }

    return res.status(200).json({ storagePath: nomeSaida, publicUrl: publicUrlDireto, thumbUrl: thumbUrlDireto });
  } catch (e) {
    console.error('cortar-clipe:', e);
    return res.status(500).json({ error: e.message || 'Falha ao cortar o clipe' });
  } finally {
    fs.rm(caminhoTemp, { force: true }, () => {});
    fs.rm(caminhoThumb, { force: true }, () => {});
  }
}
