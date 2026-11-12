// dominio/estadoJogos.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

export const jogoNaoJogado = (m) => /cancel|adiad/i.test(String((m && m.result) || ''));

/* Jogos já realizados (até 14 dias atrás) sem estatísticas: nenhum
   jogador com minutos registados no relatório do jogo. É isto que mantém
   viva a missão "Introduzir as estatísticas": aparece no dia a seguir ao
   jogo (ou no próprio dia, à noite não: só a partir do dia seguinte, para
   não aparecer antes do apito) e desaparece SOZINHA quando os minutos
   estiverem lançados. */
export function jogosSemEstatisticas(matches, hoje) {
  /* QUALQUER jogo já realizado, sem limite de datas (antes só contavam os
     das últimas duas semanas). Só ficam de fora os que não se jogaram:
     resultado "cancelado" ou "adiado". */
  const naoJogado = (m) => /cancel|adiad/i.test(String(m.result || ''));
  return (matches || [])
    .filter(m => m && m.date && m.date < hoje && !naoJogado(m))
    .filter(m => !Object.values(m.report || {}).some(r => r && Number(r.minutes) > 0))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

