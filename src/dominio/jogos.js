// dominio/jogos.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

// Designação única para os jogos fora de competição. Os registos antigos
// gravaram "Jogo amigável"; `competitionLabel` converte-os na leitura, para
// não ser preciso reescrever nada na base de dados.
export const FRIENDLY = 'Amigável';

export function isFriendlyMatch(match) {
  return competitionLabel(match && match.competition) === FRIENDLY;
}

export function competitionLabel(name) {
  const txt = String(name || '').trim();
  return /^jogo\s+amig/i.test(txt) ? FRIENDLY : txt;
}

/* Uma sessão só é "dia de jogo a sério" quando há um jogo verdadeiro
   (amigável ou oficial) por trás — não sempre que "Jogo" for escolhido
   como Fase de jogo (foco) de um treino normal (jogos condicionados,
   torneio, etc.). Standalone e não só dentro de Planeamento porque o
   painel "Próximas sessões" da página principal precisa da mesma
   distinção: sem ela, mostrava "vs [seja lá o que o treinador tivesse
   escrito]" para um treino qualquer só por ter essa fase escolhida. */
export function jogoRealDaSessao(s, matches) {
  if (!s || s.phase !== 'Jogo') return null;
  const lista = matches || [];
  return lista.find(m => m.id === s.sourceMatchId)
    || lista.find(m => m.date === s.date)
    || null;
}


/* QUEM JOGOU ESTEVE NO JOGO. Um jogador com minutos registados no
   relatório (`report[pid].minutes` > 0) fez parte do jogo, mesmo que a
   lista de convocados o tenha perdido (por exemplo, ao marcar um L ou uma
   falta nas presenças desse dia, que tira o jogador dos convocados mas
   deixa os minutos). Sem isto, ele aparecia em "Não convocados", sem os
   minutos, e ficava de fora das estatísticas e da ficha do jogo. */
export function idsComMinutos(m) {
  const report = (m && m.report) || {};
  return Object.keys(report).filter(pid => {
    const min = Number(report[pid] && report[pid].minutes);
    return Number.isFinite(min) && min > 0;
  });
}

export function convocadosDoJogo(m) {
  const base = (m && m.convocados) || [];
  const extra = idsComMinutos(m).filter(pid => !base.includes(pid));
  return extra.length ? [...base, ...extra] : base;
}
