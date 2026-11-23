// atleta/salaDados.js (19/11): os dados da Sala de Vídeo do Portal (pedidos,
// memória e conversão dos clipes), à parte do ecrã. O cacifo usa isto para
// aquecer a Sala sem carregar o leitor de vídeo (SalaVideo.jsx).
import { comMp4Proprio, MAX_CLIPE_ATLETA_SEG } from '../media/organizacao';
import { formasParaPausas } from '../media/pausas';
import { supabase } from '../supabaseClient';
import { hashCurto } from './portalRpc';
import { addDays, todayStr } from '../base/utilidades';

/* Um clipe gravado por um jogador (tabela `video_clips`, origem
   'atleta') no formato de um corte do Canal — assim aparece dentro do
   cartão do jogo de onde saiu, com a mesma barra do clipe. */
export function clipeAtletaParaCanal(c0) {
  // MP4 próprio do clipe (sobrevive ao jogo), quando cobre os tempos.
  const c = comMp4Proprio(c0);
  return {
    id: c.id,
    title: c.titulo || '(sem título)',
    youtubeId: c.youtubeId || undefined,
    // Clipe sobre um vídeo carregado (ficheiro): o mesmo ficheiro, só o troço.
    ...(!c.youtubeId && c.dataUrl ? { kind: 'video', dataUrl: c.dataUrl, clipNoFicheiro: true } : {}),
    // A miniatura do corte (clipes do treinador): a imagem aparece logo, sem
    // ter de abrir o vídeo para tirar o fotograma (17/11).
    ...(!c.youtubeId && /^https?:/.test(String(c.thumbUrl || '')) ? { thumbUrl: c.thumbUrl } : {}),
    clipInicio: Number(c.clipInicio),
    clipFim: Number(c.clipFim),
    ...(c.mp4Proprio ? { clipInicioJogo: c.clipInicioJogo, clipFimJogo: c.clipFimJogo, mp4Proprio: true } : {}),
    clipOrigemId: c.clipOrigemId || c.videoOrigemId || null,
    clipOrigemTitulo: c.originalTitulo || '',
    jogoId: c.jogoId || null,
    jornada: c.jornada || '',
    categoria: 'jogo',
    pasta: '',
    deAtleta: true,
    notaAtleta: c.note || '',
    // Posto pelo treinador (análise individual): só para ver, com os desenhos.
    ...(c.criadoPorStaff ? { doStaff: true, ...(c.corteOrigemId ? { corteOrigemId: c.corteOrigemId } : {}) } : {}),
    /* Clipe do treinador com desenhos: toca logo com eles, no próprio
       leitor (as paragens da Sala), sem "Ver com os desenhos" (17/11). Os
       de link já trazem `anotacoesPausa`; os de ficheiro fazem-se aqui a
       partir dos desenhos (tempos do ficheiro do clipe). */
    ...((c.anotacoesPausa || []).length ? { anotacoesPausa: c.anotacoesPausa }
      : (c.criadoPorStaff && (c.shapes || []).length && !c.youtubeId
        ? { anotacoesPausa: formasParaPausas(c.shapes, Number(c.clipInicio) || 0).map(pa => (c.calibracao ? { ...pa, calibracao: c.calibracao } : pa)) }
        : {})),
    ...((c.shapes || []).length ? { shapesStaff: c.shapes, duracaoStaff: Number(c.duracao) || undefined } : {}),
    ...(c.calibracao ? { calibracaoStaff: c.calibracao } : {}),
  };
}

// Mensagens da função `checkin_clipe_criar`, nas palavras do jogador.
export const ERROS_CLIPE_ATLETA = {
  codigo_invalido: 'O teu código já não é válido. Volta a entrar no Portal.',
  equipa_invalida: 'Este link não diz de que equipa és. Pede ao treinador o link da tua equipa.',
  video_invalido: 'Este vídeo já não está disponível para criar clipes.',
  tempos_invalidos: 'Marca o início e o fim do clipe.',
  duracao_invalida: `O clipe tem de ter entre 1 e ${MAX_CLIPE_ATLETA_SEG} segundos.`,
  titulo_obrigatorio: 'Dá um título ao clipe antes de gravar.',
  clipe_invalido: 'Este clipe já não existe (pode ter sido apagado pelo treinador).',
};

// Cópia em memória da Sala do Portal (ver cacheBib): abre logo ao voltar, mesmo sem espaço no aparelho.
export const memoriaPortalBib = new Map();
/* AQUECER A SALA (17/11). O cacifo pede os vídeos da Sala logo que abre,
   como já fazia para as outras áreas (aquecerPortal). Ao tocar em "Sala de
   Vídeo" a lista já cá está (ou o pedido já vai a meio) e a Sala abre sem
   ficar à espera do servidor. Um pedido por código e equipa de cada vez;
   ao fim de 20 s volta a valer pedir. */
const pedidosSala = new Map(); // chave -> { t, p }
export const lerJsonSala = (data) => {
  let d = data;
  if (Array.isArray(d)) d = d[0];
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica como está */ } }
  return d;
};
export function pedirSala(code, teamId, daVista) {
  const k = `${teamId}|${code}`;
  const ja = pedidosSala.get(k);
  /* A Sala só aproveita um pedido do aquecimento que ainda ninguém usou:
     ao voltar a entrar pede de novo (pode haver clipes novos). */
  if (ja && !ja.usado && Date.now() - ja.t < 20000) { if (daVista) ja.usado = true; return ja.p; }
  const vids = Promise.resolve(supabase.rpc('checkin_biblioteca', { p_code: code, p_team: teamId }))
    .then(({ data, error }) => {
      if (error) throw error;
      const d = lerJsonSala(data);
      // Os jogos só da Análise (`daAnalise`) não são para o Portal.
      return ((d && d.videos) || []).filter(v => v && (!v.daAnalise || v.publicado));
    });
  const meus = Promise.resolve(supabase.rpc('checkin_meus_clipes', { p_code: code, p_team: teamId }))
    .then(({ data, error }) => {
      if (error) throw error;
      const d = lerJsonSala(data);
      return ((d && d.clipes) || []).filter(c => c && (c.youtubeId || c.dataUrl)).map(clipeAtletaParaCanal);
    });
  const p = { vids, meus };
  vids.catch(() => {}); meus.catch(() => {});
  // Quando os dois chegam, ficam em memória para a Sala abrir já cheia.
  Promise.allSettled([vids, meus]).then(([a, b]) => {
    if (a.status === 'fulfilled') {
      const chave = `misterjp:portal-bib:${teamId}:${hashCurto(String(code || ''))}`;
      const antes = memoriaPortalBib.get(chave) || {};
      memoriaPortalBib.set(chave, { videos: a.value, meus: b.status === 'fulfilled' ? b.value : (antes.meus || []) });
    }
    // Um pedido falhado não fica guardado: o próximo tenta outra vez.
    if ((a.status === 'rejected' || b.status === 'rejected') && pedidosSala.get(k) && pedidosSala.get(k).p === p) pedidosSala.delete(k);
  });
  pedidosSala.set(k, { t: Date.now(), p, usado: !!daVista });
  return p;
}
export function aquecerSalaVideo(code, teamId) {
  if (!code || !teamId) return;
  try { pedirSala(code, teamId); } catch (e) { /* aquecer nunca pode partir o cacifo */ }
}

/* Também se pede já o código do ecrã da Sala (vem num ficheiro à parte):
   quando se toca em "Sala de Vídeo", já cá está. */
export function aquecerCodigoDaSala() {
  try { import('./SalaVideo'); } catch (e) { /* sem rede: carrega ao abrir */ }
}

/* Os clipes do próprio jogador (sem os vídeos da equipa). */
export async function lerMeusClipes(code, teamId) {
  const { data, error } = await supabase.rpc('checkin_meus_clipes', { p_code: code, p_team: teamId });
  if (error) throw error;
  const d = lerJsonSala(data);
  return ((d && d.clipes) || []).filter(c => c && (c.youtubeId || c.dataUrl)).map(clipeAtletaParaCanal);
}

/* DEPOIS DA SAÍDA DO CLUBE: os vídeos pessoais do jogador ficam 30 dias
   (video-worker, rgpd.js, DIAS_APOS_SAIDA: têm de bater). O serviço apaga
   no dia em que passam 30 dias; o último dia para descarregar é o 29.º. */
export const DIAS_APOS_SAIDA = 30;
export const ultimoDiaDosVideos = (exitDate) => addDays(String(exitDate).slice(0, 10), DIAS_APOS_SAIDA - 1);
export const dentroDoPrazoDosVideos = (exitDate) => !!exitDate && todayStr() <= ultimoDiaDosVideos(exitDate);
