/* PARAGENS DOS DESENHOS (19/11): saiu de AnalisadorVideo.jsx sem mudar
   nada, para o Portal (Sala de Vídeo) as usar sem carregar o editor. */
export const SEG_PADRAO_DESENHO = 5;
export const JANELA_PARAGEM = 0.3; // itens a menos de 0,3 s uns dos outros = a mesma paragem
/* DESENHO ACIDENTAL — um toque no vídeo com uma ferramenta de arrastar
   (seta, círculo, zona…) sem arrastar criava um desenho só com um ponto:
   não se vê (sem 2.º ponto nada é desenhado), mas contava como desenho
   e fazia o vídeo PARAR nesse instante. Com um círculo com zoom visível
   por perto, a paragem fantasma mostrava o zoom outra vez — parecia que
   o zoom tinha sido posto duas vezes. Estes desenhos já não são criados
   (ver endDraw) e os que ficaram guardados deixam de fazer parar. */
export const FERRAMENTAS_DE_ARRASTAR = new Set(['seta', 'linha', 'circulo', 'retangulo', 'cone', 'tubo', 'livre']);
export function formaAcidental(sh) {
  if (!sh || !FERRAMENTAS_DE_ARRASTAR.has(sh.tool)) return false;
  const ps = (sh.points || []).filter(pt => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (ps.length < 2) return true;
  if (sh.tool === 'tubo') return false; // o tubo tem largura mínima: mesmo pequeno, vê-se
  const xs = ps.map(pt => pt.x); const ys = ps.map(pt => pt.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 0.5;
}
export const temParagem = (sh) => !!sh && !sh.semParar && sh.tool !== 'guias' && !formaAcidental(sh);
export function segDe(sh) {
  if (!sh) return SEG_PADRAO_DESENHO;
  const n = Number(sh.seg);
  if (n > 0) return n;
  const ini = sh.criadoEmTempo ?? 0;
  let d = null;
  if (sh.mostrarAte != null) d = sh.mostrarAte - ini;
  else if (sh.duracao != null) d = Number(sh.duracao);
  if (!(d > 0)) return SEG_PADRAO_DESENHO;
  return Math.max(1, Math.min(60, Math.round(d)));
}

export function formasParaPausas(shapes, base = 0) {
  const lista = (shapes || []).filter(sh => sh && sh.tool !== 'guias' && !formaAcidental(sh))
    .map(sh => ({ ...sh, _t: Number(sh.criadoEmTempo) || 0 }))
    .sort((a, b) => a._t - b._t);
  const pausas = [];
  lista.forEach(sh => {
    const { _t, ...forma } = sh;
    const ultima = pausas[pausas.length - 1];
    const seg = segDe(sh);
    const f = { ...forma, seg };
    if (ultima && Math.abs(ultima._a - _t) < JANELA_PARAGEM) { ultima.shapes.push(f); ultima.duracaoSegundos = Math.max(ultima.duracaoSegundos, seg); }
    else pausas.push({ _a: _t, id: `p${pausas.length}-${Math.round(_t * 1000)}`, tempoVideo: base + _t, duracaoSegundos: seg, shapes: [f] });
  });
  return pausas.map(({ _a, ...pa }) => pa);
}

/* Desenho "sem parar" (ou guias): visível entre o instante em que foi
   desenhado e o fim do tempo dele, com o vídeo a andar. Saiu de
   AnalisadorVideo.jsx sem mudar nada (19/11). */
export function shapeVisivelEm(sh, tempo) {
  const inicio = sh.criadoEmTempo ?? 0;
  if (tempo < inicio) return false;
  if (sh.mostrarAte != null) return tempo <= sh.mostrarAte;
  if (sh.duracao != null) return tempo <= inicio + sh.duracao; // compatibilidade com clipes guardados antes desta alteração
  return true; // sem limite definido = sempre visível
}
