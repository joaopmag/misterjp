// media/trajetoria.js
//
// "SEGUIR JOGADOR": a trajetória do jogador em foco e o tubo de luz que o
// marca. Saiu de AnalisadorVideo.jsx (19/11) sem mudar nada, para o MP4
// com desenhos do servidor (desenhos.mjs) desenhar exatamente o mesmo:
// as mesmas regras (saltos impossíveis, buracos) e a mesma geometria.

// Onde está o jogador em foco num instante `tempo`, interpolando entre
// os dois pontos mais próximos da trajetória devolvida pelo serviço de
// seguimento. Antes/depois do intervalo conhecido, fica parado no
// primeiro/último ponto, em vez de desaparecer.
/* SEGUIR JOGADOR — rede de segurança do lado da app. Quando o jogador sai
   do ecrã e volta, o serviço às vezes "agarra" outro (até de outra
   equipa) e o tubo salta para ele. Um salto destes é impossível a correr:
   a partir do primeiro, o seguimento pára (melhor não mostrar nada do
   que mostrar o jogador errado) e corrige-se tocando no jogador certo
   nesse momento, com a ferramenta Seguir. Também deixa de se ver o tubo
   antes do início e depois do fim do seguimento, e nos buracos em que o
   jogador não foi visto. */
const VEL_MAX_SEGUIR = 0.6; // fração do ecrã por segundo (muito acima de um sprint, mesmo com a câmara a rodar)
export function limparTrajetoria(pontos) {
  const ps = (pontos || []).filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.t - b.t);
  const out = [];
  let cortado = false;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    // Um toque de correção ("ancora") recomeça o seguimento dali, certo.
    if (p.ancora) { out.push(p); cortado = false; continue; }
    if (cortado) continue;
    if (out.length) {
      const a = out[out.length - 1];
      const dt = Math.max(0.04, p.t - a.t);
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d > Math.max(0.06, VEL_MAX_SEGUIR * dt)) { cortado = true; continue; } // trocou de jogador
    }
    out.push(p);
  }
  return out;
}
const BURACO_SEGUIR = 0.7; // segundos sem o jogador = não se mostra o tubo nesse intervalo
export function posicaoNaTrajetoria(pontos, tempo) {
  if (!pontos || pontos.length === 0) return null;
  if (tempo < pontos[0].t - 0.1 || tempo > pontos[pontos.length - 1].t + 0.3) return null;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i], b = pontos[i + 1];
    if (tempo >= a.t && tempo <= b.t) {
      if (b.t - a.t > BURACO_SEGUIR) return tempo >= b.t - 0.05 ? b : null; // no próprio instante da retoma já se vê
      const frac = b.t === a.t ? 0 : (tempo - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
  }
  return tempo < pontos[0].t ? pontos[0] : pontos[pontos.length - 1];
}

/* O TUBO DE LUZ: de cima do ecrã até aos pés do jogador, mais estreito em
   baixo (não converge num ponto), cor do seguimento com transparência
   igual de cima a baixo. Unidades da camada de desenho (100 × 56,25). */
export const LARG_TOPO_TUBO = 3.4; // metade da largura lá em cima
export const LARG_BASE_TUBO = 2.2; // metade da largura por cima dos pés
export const OPACIDADE_TUBO = 0.22;
export function pontosDoTubo(pos) {
  const px = pos.x * 100, py = pos.y * 56.25;
  return `${px - LARG_TOPO_TUBO},0 ${px + LARG_TOPO_TUBO},0 ${px + LARG_BASE_TUBO},${py} ${px - LARG_BASE_TUBO},${py}`;
}
