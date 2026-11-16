// src/media/retencao.js
//
// JOGOS INTEIROS CARREGADOS: 90 DIAS. OS CLIPES FICAM SEMPRE.
//
// As mesmas contas do video-worker (retencao.js), para a app mostrar a
// data, avisar e não deixar passar a quota. Quem apaga é o serviço de
// vídeo, de 6 em 6 horas, depois de dar a cada clipe que aponta para o
// jogo um MP4 próprio (clipesProprios.js).

export const DIAS_RETENCAO = 90;
export const DIAS_PROLONGAR = 30;   // uma vez por jogo (`prolongadoEm`)
export const DIAS_AVISO = 15;       // aviso na Análise a partir do dia 75
export const QUOTA_JOGOS_GB_OMISSAO = 30;
const DIA = 24 * 3600 * 1000;

/* Data em que o jogo inteiro é apagado (Date) ou null. */
export function dataApagar(o) {
  const base = Date.parse((o && o.criadoEm) || '');
  if (!Number.isFinite(base)) return null;
  return new Date(base + (DIAS_RETENCAO + (o.prolongadoEm ? DIAS_PROLONGAR : 0)) * DIA);
}

/* Dias que faltam (arredonda para cima; 0 = hoje). */
export function diasParaApagar(o, agora = Date.now()) {
  const d = dataApagar(o);
  return d ? Math.max(0, Math.ceil((d.getTime() - agora) / DIA)) : null;
}

/* Espaço ocupado pelos jogos inteiros que ainda têm ficheiro. */
export function espacoJogosUsado(lista) {
  return (lista || []).reduce((s, v) => (v && !v.ficheiroApagado ? s + (Number(v.tamanhoFinal) || Number(v.tamanho) || 0) : s), 0);
}

export function formatarGB(bytes) {
  const gb = (Number(bytes) || 0) / 1e9;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`.replace('.', ',');
}

export const dataCurtaPt = (d) => (d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : '');
