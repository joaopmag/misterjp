// media/duracaoMp4.js
//
// DURAÇÃO NOS VÍDEOS GRAVADOS PELA APP.
//
// O browser grava (MediaRecorder) em MP4 "fragmentado": o cabeçalho diz
// duração 0, porque quando começa a escrever ainda não sabe quanto vai
// durar. O browser e o telemóvel tocam bem, mas alguns leitores (o Leitor
// Multimédia do Windows, por exemplo) mostram a barra do tempo parada e
// não deixam andar para a frente.
//
// Aqui lê-se o ficheiro já pronto, soma-se a duração dos fragmentos e
// escreve-se no cabeçalho: `mvhd`, `tkhd` e `mdhd`, e junta-se a caixa
// `mehd` (duração dos fragmentos) dentro de `mvex`. Os fragmentos usam
// posições relativas a si próprios (default-base-is-moof), por isso
// acrescentar bytes ao cabeçalho não mexe em mais nada. Se o ficheiro não
// for como se espera, devolve-se o original tal e qual.

const tipo = (dv, o) => String.fromCharCode(dv.getUint8(o + 4), dv.getUint8(o + 5), dv.getUint8(o + 6), dv.getUint8(o + 7));

function caixas(dv, ini, fim) {
  const lista = [];
  let o = ini;
  while (o + 8 <= fim) {
    let tam = dv.getUint32(o);
    let cab = 8;
    if (tam === 1) { tam = Number(dv.getBigUint64(o + 8)); cab = 16; }
    if (tam === 0) tam = fim - o;
    if (tam < cab || o + tam > fim) break;
    lista.push({ o, tam, cab, t: tipo(dv, o) });
    o += tam;
  }
  return lista;
}
const filho = (dv, cx, t) => caixas(dv, cx.o + cx.cab, cx.o + cx.tam).find(c => c.t === t);
const filhos = (dv, cx, t) => caixas(dv, cx.o + cx.cab, cx.o + cx.tam).filter(c => c.t === t);

// Escreve a duração num campo de 32 ou 64 bits, conforme a versão da caixa.
function escreverDuracao(dv, o, versao, valor) {
  if (versao === 1) dv.setBigUint64(o, BigInt(Math.round(valor)));
  else dv.setUint32(o, Math.min(0xFFFFFFFF, Math.round(valor)));
}

export function corrigirDuracaoMp4Buffer(buf) {
  const dv = new DataView(buf);
  const topo = caixas(dv, 0, buf.byteLength);
  const moov = topo.find(c => c.t === 'moov');
  if (!moov || !topo.some(c => c.t === 'moof')) return null; // não é fragmentado: nada a fazer
  const mvhd = filho(dv, moov, 'mvhd');
  const mvex = filho(dv, moov, 'mvex');
  if (!mvhd || !mvex || filho(dv, mvex, 'mehd')) return null;
  const vMv = dv.getUint8(mvhd.o + 8);
  const escalaMovie = dv.getUint32(mvhd.o + (vMv === 1 ? 28 : 20));

  // Pistas: id → escala do mdhd, e duração por omissão (trex).
  const pistas = new Map();
  filhos(dv, moov, 'trak').forEach(trak => {
    const tkhd = filho(dv, trak, 'tkhd');
    const mdia = filho(dv, trak, 'mdia');
    const mdhd = mdia && filho(dv, mdia, 'mdhd');
    if (!tkhd || !mdhd) return;
    const vT = dv.getUint8(tkhd.o + 8);
    const id = dv.getUint32(tkhd.o + (vT === 1 ? 28 : 20));
    const vM = dv.getUint8(mdhd.o + 8);
    pistas.set(id, { tkhd, vT, mdhd, vM, escala: dv.getUint32(mdhd.o + (vM === 1 ? 28 : 20)), durPadrao: 0, fim: 0 });
  });
  filhos(dv, mvex, 'trex').forEach(trex => {
    const p = pistas.get(dv.getUint32(trex.o + 12));
    if (p) p.durPadrao = dv.getUint32(trex.o + 20);
  });
  if (!pistas.size) return null;

  // Fim de cada pista = tfdt do fragmento + soma das durações das amostras.
  topo.filter(c => c.t === 'moof').forEach(moof => {
    filhos(dv, moof, 'traf').forEach(traf => {
      const tfhd = filho(dv, traf, 'tfhd');
      if (!tfhd) return;
      const fl = dv.getUint32(tfhd.o + 8) & 0xFFFFFF;
      const p = pistas.get(dv.getUint32(tfhd.o + 12));
      if (!p) return;
      let q = tfhd.o + 16;
      if (fl & 0x01) q += 8; // base-data-offset
      if (fl & 0x02) q += 4; // sample-description-index
      const durTraf = (fl & 0x08) ? dv.getUint32(q) : p.durPadrao;
      const tfdt = filho(dv, traf, 'tfdt');
      let base = 0;
      if (tfdt) base = dv.getUint8(tfdt.o + 8) === 1 ? Number(dv.getBigUint64(tfdt.o + 12)) : dv.getUint32(tfdt.o + 12);
      let soma = 0;
      filhos(dv, traf, 'trun').forEach(trun => {
        const tf = dv.getUint32(trun.o + 8) & 0xFFFFFF;
        const n = dv.getUint32(trun.o + 12);
        let r = trun.o + 16;
        if (tf & 0x01) r += 4;
        if (tf & 0x04) r += 4;
        const passo = ((tf & 0x100) ? 4 : 0) + ((tf & 0x200) ? 4 : 0) + ((tf & 0x400) ? 4 : 0) + ((tf & 0x800) ? 4 : 0);
        for (let k = 0; k < n; k++) {
          soma += (tf & 0x100) ? dv.getUint32(r + k * passo) : durTraf;
        }
      });
      p.fim = Math.max(p.fim, base + soma);
    });
  });
  const segundos = Math.max(...[...pistas.values()].map(p => (p.escala ? p.fim / p.escala : 0)));
  if (!(segundos > 0)) return null;

  // Cabeçalho: durações no lugar (o tamanho destas caixas não muda).
  escreverDuracao(dv, mvhd.o + (vMv === 1 ? 32 : 24), vMv, segundos * escalaMovie);
  pistas.forEach(p => {
    escreverDuracao(dv, p.tkhd.o + (p.vT === 1 ? 36 : 28), p.vT, segundos * escalaMovie);
    escreverDuracao(dv, p.mdhd.o + (p.vM === 1 ? 32 : 24), p.vM, p.fim);
  });

  // mehd (versão 1, 20 bytes) no início do mvex; moov e mvex crescem 20.
  const MEHD = 20;
  if (moov.cab !== 8 || mvex.cab !== 8) return null;
  const novo = new Uint8Array(buf.byteLength + MEHD);
  const orig = new Uint8Array(buf);
  const ins = mvex.o + mvex.cab;
  novo.set(orig.subarray(0, ins), 0);
  const nd = new DataView(novo.buffer);
  nd.setUint32(ins, MEHD);
  novo.set([0x6d, 0x65, 0x68, 0x64], ins + 4); // 'mehd'
  nd.setUint32(ins + 8, 0x01000000); // versão 1, flags 0
  nd.setBigUint64(ins + 12, BigInt(Math.round(segundos * escalaMovie)));
  novo.set(orig.subarray(ins), ins + MEHD);
  nd.setUint32(moov.o, moov.tam + MEHD);
  nd.setUint32(mvex.o, mvex.tam + MEHD);
  return novo.buffer;
}

// Para o Blob que sai da gravação. Só mexe em MP4; qualquer erro → original.
export async function corrigirDuracaoMp4(blob) {
  try {
    if (!blob || !/mp4/i.test(blob.type || '')) return blob;
    const buf = await blob.arrayBuffer();
    const novo = corrigirDuracaoMp4Buffer(buf);
    return novo ? new Blob([novo], { type: blob.type }) : blob;
  } catch (e) {
    return blob;
  }
}
