// media/planoDesenhos.js
//
// O PLANO DOS DESENHOS DE UM TROÇO DE VÍDEO, PARA O MP4 DO SERVIDOR.
//
// O servidor de vídeo (video-worker) grava os desenhos dentro do MP4:
// "Os meus vídeos" do jogador e o "Descarregar com desenhos" do staff.
// Para o MP4 ficar igual ao que se vê na app, as regras de quando o vídeo
// pára, quanto tempo cada item fica e quando entra o zoom vêm DAQUI, o
// mesmo código que a app usa. O servidor recebe este ficheiro já
// empacotado (scripts/exportar-desenhos.mjs → desenhos.mjs no
// video-worker); a app usa-o para a assinatura e para os pedidos do staff.
//
// Um plano é relativo ao início do troço (segundos) e só tem o que se vê:
//   {
//     paragens: [{ t, passos: [{ dur, formas: [...], zoom: { x, y, f } | null }] }],
//     continuos: [{ de, ate, formas: [...] }],   // desenhos "sem parar", com o vídeo a andar
//     seguir: { cor, pontos: [{ t, x, y }] },    // "Seguir jogador" (só na Análise), opcional
//   }
// Com "Seguir jogador", cada paragem leva também `marcador` ({ x, y } do
// tubo nesse instante, ou null).
// Numa paragem a imagem fica parada no instante `t`; cada passo é um
// pedaço dessa paragem com o mesmo desenho no ecrã (um item que sai, o
// zoom que sai) e dura `dur` segundos. Os efeitos animados (o anel a
// rodar, o brilho a pulsar) ficam parados.

import { JANELA_PARAGEM, temParagem, segDe, formasParaPausas, shapeVisivelEm, formaAcidental } from './pausas';
import { limparTrajetoria, posicaoNaTrajetoria } from './trajetoria';

const DURACAO_PADRAO_SALA = 5; // como DURACAO_PADRAO_BIB (MediaLibrary)
const JANELA_MESMA_PAUSA_SALA = 0.5; // como JANELA_MESMA_PAUSA_BIB
const SAIDA_ZOOM = 0.9; // o zoom sai um pouco antes do círculo (AnalisadorVideo / MediaLibrary)
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const EPS = 1e-6; // os cortes vêm arredondados ao centésimo: comparar com folga

const circuloComZoom = (lista) => (lista || []).find(f => f && f.tool === 'circulo' && Number(f.zoom) > 1 && f.points && f.points[0]);
const zoomDe = (c) => (c ? { x: Number(c.points[0].x), y: Number(c.points[0].y), f: Number(c.zoom) } : null);

/* Passos de uma paragem: corta [0, total] em cada instante em que muda o
   que está no ecrã. `visiveis(dec)` e `zoomEm(dec)` dizem o que se vê a
   `dec` segundos do início da paragem. */
function passosDaParagem(total, cortes, visiveis, zoomEm) {
  const pontos = [...new Set([0, ...cortes.filter(c => c > 0 && c < total).map(r2), r2(total)])].sort((a, b) => a - b);
  const passos = [];
  for (let k = 0; k < pontos.length - 1; k++) {
    const dec = pontos[k];
    const dur = r2(pontos[k + 1] - dec);
    if (dur <= 0) continue;
    const formas = visiveis(dec);
    const zoom = zoomEm(dec);
    const ultimo = passos[passos.length - 1];
    // Igual ao anterior (nada mudou): junta.
    if (ultimo && JSON.stringify(ultimo.formas) === JSON.stringify(formas) && JSON.stringify(ultimo.zoom) === JSON.stringify(zoom)) ultimo.dur = r2(ultimo.dur + dur);
    else passos.push({ dur, formas, zoom });
  }
  return passos.filter(p => p.formas.length || p.zoom);
}

/* SALA DE VÍDEO (e "Os meus vídeos"): o modelo das PAUSAS. `pausas` =
   [{ tempoVideo, duracaoSegundos, shapes }], com tempos no mesmo relógio
   que `inicio`/`fim` (o do vídeo de onde se corta). Regras de
   MediaLibrary (paragens da Sala): pausas a menos de 0,5 s são a mesma
   paragem; cada item fica os seus segundos (f.seg, ou os da pausa, ou
   5); o vídeo retoma quando sai o último; o zoom é o do primeiro círculo
   com zoom à vista e sai 0,9 s antes dele (nunca antes de 0,4 s). */
export function planoSala(pausas, inicio, fim) {
  const ini = Number(inicio) || 0;
  const fimN = Number(fim);
  const dur = Number.isFinite(fimN) ? Math.max(0, fimN - ini) : Infinity;
  const tNoTroco = (a) => {
    const t = Number(a && a.tempoVideo);
    if (!Number.isFinite(t) || t < ini - 1.25 || (Number.isFinite(fimN) && t > fimN + 0.75)) return 0;
    return r2(Math.min(Math.max(t - ini, 0), dur));
  };
  const lista = (pausas || []).filter(a => a && (a.shapes || []).length)
    .map(a => ({ a, t: tNoTroco(a) }))
    .sort((x, y) => x.t - y.t);
  const paragens = [];
  const usadas = new Set();
  lista.forEach((x, i) => {
    if (usadas.has(i)) return;
    const grupo = lista.filter((y, j) => !usadas.has(j) && Math.abs(y.t - x.t) < JANELA_MESMA_PAUSA_SALA);
    lista.forEach((y, j) => { if (Math.abs(y.t - x.t) < JANELA_MESMA_PAUSA_SALA) usadas.add(j); });
    const formas = grupo.flatMap(g => (g.a.shapes || []).filter(Boolean).map(f => ({ ...f, seg: Number(f && f.seg) || Number(g.a.duracaoSegundos) || DURACAO_PADRAO_SALA })));
    if (!formas.length) return;
    const total = Math.max(1, ...formas.map(f => f.seg));
    const circ = circuloComZoom(formas);
    const saidaZoom = circ ? Math.max(0.4, circ.seg - SAIDA_ZOOM) : null;
    const visiveis = (dec) => formas.filter(f => f.seg > dec + EPS);
    const zoomEm = (dec) => (circ && dec < saidaZoom - EPS ? zoomDe(circuloComZoom(visiveis(dec))) : null);
    const passos = passosDaParagem(total, [...formas.map(f => f.seg), ...(saidaZoom != null ? [saidaZoom] : [])], visiveis, zoomEm);
    if (passos.length) paragens.push({ t: x.t, passos });
  });
  return { paragens, continuos: [] };
}

/* Os desenhos de um clipe de jogador (tabela video_clips), como a Sala os
   mostra (atleta/salaDados.js): `anotacoesPausa` (clipes de link e os
   desenhados na Sala) ou, nos clipes do treinador sobre ficheiro, as
   pausas feitas a partir dos desenhos (`shapes`). Tempos no relógio de
   `clipInicio`/`clipFim` do próprio clipe. */
export function pausasDoClipeAtleta(c) {
  if (!c) return [];
  if ((c.anotacoesPausa || []).length) return c.anotacoesPausa;
  if (c.criadoPorStaff && (c.shapes || []).length && !c.youtubeId) return formasParaPausas(c.shapes, Number(c.clipInicio) || 0);
  return [];
}
export function planoDoClipeAtleta(c) {
  if (!c) return { paragens: [], continuos: [] };
  return planoSala(pausasDoClipeAtleta(c), c.clipInicio, c.clipFim);
}

/* ANÁLISE DE VÍDEO (leitor dos cortes, ClipPlayerModal): o modelo das
   PARAGENS (usePausasDesenho). Tempos dos desenhos (`criadoEmTempo`)
   relativos ao início do troço. Itens a menos de 0,3 s fazem UMA
   paragem, com o tempo do mais longo; cada item sai no tempo dele
   (segDe); o zoom sai 0,9 s antes do círculo. Os itens "sem parar" e as
   guias acompanham o vídeo a andar (continuos) e também se veem numa
   paragem que caia dentro do tempo deles. `seguir` = { pontos, cor } do
   "Seguir jogador" (trajetoriaFoco, com a cor já resolvida), tempos
   relativos ao troço: o tubo acompanha o jogador com o vídeo a andar e
   fica parado no sítio dele nas paragens. */
export function planoDoCorte(shapes, duracao, seguir) {
  const todos = (shapes || []).filter(sh => sh && sh.points && sh.points.length && !formaAcidental(sh));
  const dur = Number(duracao);
  const comParagem = todos.filter(temParagem).map(sh => ({ sh, a: Number(sh.criadoEmTempo) || 0 })).sort((x, y) => x.a - y.a);
  const semParagem = todos.filter(sh => !temParagem(sh));
  const paragens = [];
  let ultimaA = null;
  comParagem.forEach(({ a }) => {
    if (ultimaA != null && a - ultimaA < JANELA_PARAGEM) return; // já pertence à paragem anterior
    if (Number.isFinite(dur) && a > dur + 0.001) return;
    const A = a;
    ultimaA = A;
    const grupo = comParagem.filter(x => Math.abs(x.a - A) < JANELA_PARAGEM).map(x => x.sh);
    const total = Math.max(...grupo.map(segDe));
    const fixas = semParagem.filter(sh => shapeVisivelEm(sh, A));
    const visiveis = (dec) => [...fixas, ...grupo.filter(sh => segDe(sh) > dec + EPS)];
    const zoomEm = (dec) => zoomDe(circuloComZoom(visiveis(dec).filter(sh => sh.tool !== 'circulo' || !temParagem(sh) || segDe(sh) - dec > SAIDA_ZOOM + EPS)));
    const cortes = [...grupo.map(segDe), ...grupo.filter(sh => sh.tool === 'circulo' && Number(sh.zoom) > 1).map(sh => segDe(sh) - SAIDA_ZOOM)];
    const passos = passosDaParagem(total, cortes, visiveis, zoomEm);
    if (passos.length) paragens.push({ t: r2(Math.max(0, A)), passos });
  });
  // Desenhos com o vídeo a andar: intervalos onde o conjunto não muda.
  const limites = new Set([0]);
  semParagem.forEach(sh => {
    const de = Number(sh.criadoEmTempo) || 0;
    limites.add(r2(Math.max(0, de)));
    const ate = sh.mostrarAte != null ? Number(sh.mostrarAte) : sh.duracao != null ? de + Number(sh.duracao) : Infinity;
    if (Number.isFinite(ate)) limites.add(r2(ate));
  });
  const lims = [...limites].filter(x => !Number.isFinite(dur) || x <= dur).sort((a, b) => a - b);
  const continuos = [];
  lims.forEach((de, k) => {
    const ate = k + 1 < lims.length ? lims[k + 1] : (Number.isFinite(dur) ? r2(dur) : 1e6);
    if (ate <= de) return;
    const meio = (de + ate) / 2;
    const formas = semParagem.filter(sh => shapeVisivelEm(sh, meio));
    if (!formas.length) return;
    const ultimo = continuos[continuos.length - 1];
    if (ultimo && ultimo.ate === de && JSON.stringify(ultimo.formas) === JSON.stringify(formas)) ultimo.ate = ate;
    else continuos.push({ de, ate, formas });
  });
  const plano = { paragens, continuos };
  // "Seguir jogador": a trajetória já limpa (sem os saltos para outro
  // jogador), com os tempos arredondados ao milésimo.
  const limpos = seguir && Array.isArray(seguir.pontos) ? limparTrajetoria(seguir.pontos) : [];
  if (limpos.length) {
    const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
    const r4 = (n) => Math.round(Number(n) * 10000) / 10000;
    plano.seguir = { cor: seguir.cor || '#D14056', pontos: limpos.map(p => ({ t: r3(p.t), x: r4(p.x), y: r4(p.y) })) };
    // Paragens sem desenhos mas com o tubo: não há (a paragem vem dos desenhos).
    paragens.forEach(pg => {
      const pos = posicaoNaTrajetoria(plano.seguir.pontos, pg.t);
      pg.marcador = pos ? { x: r4(pos.x), y: r4(pos.y) } : null;
    });
  }
  return plano;
}

export const planoVazio = (p) => !p || (!(p.paragens || []).length && !(p.continuos || []).length && !(p.seguir && (p.seguir.pontos || []).length));

/* Assinatura curta de um plano (muda se mudar o desenho, um tempo, uma
   cor…). Igual na app e no servidor: chaves ordenadas (a base devolve os
   objetos com as chaves noutra ordem) e FNV-1a de 32 bits. */
function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  if (typeof v === 'number') return JSON.stringify(r2(v) === v ? v : Math.round(v * 1e4) / 1e4);
  return JSON.stringify(v === undefined ? null : v);
}
export function assinaturaDoPlano(p) {
  if (planoVazio(p)) return '';
  const s = canonico(p);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
