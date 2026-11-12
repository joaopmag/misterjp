// dominio/estatisticas.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr } from '../base/utilidades';

/* Agrupa sessões por data. Um dia pode ter várias sessões registadas
   (ex: uma por exercício/foco), mas para efeitos de presença, nota e
   assiduidade deve contar como um único dia de treino. */
export function groupSessionsByDate(sessions) {
  const map = new Map();
  for (const s of (sessions || [])) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date).push(s);
  }
  return [...map.entries()]
    .map(([date, list]) => ({ date, list }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function dayPresent(list, playerId) {
  return list.some(s => (s.attendance || []).includes(playerId));
}

export function dayRating(list, playerId) {
  for (const s of list) {
    const r = (s.ratings || {})[playerId];
    if (r != null && r !== '') return r;
  }
  return null;
}

export function playerStats(player, sessions, matches) {
  /* Dias de folga (fase "Descanso") não contam para a assiduidade — não
     há presenças nem notas a registar num dia sem treino.

     As sessões geradas por um amigável também saem: o jogo já é contado
     à parte, e deixá-las entrar fazia o mesmo dia contar duas vezes na
     assiduidade — uma como treino e outra como jogo. */
  const idsDeJogos = new Set((matches || []).map(m => m.id));
  const trainingSessions = (sessions || []).filter(s => (
    s.phase !== 'Descanso' && !(s.sourceMatchId && idsDeJogos.has(s.sourceMatchId))
  ));
  /* Só contam os dias JÁ PASSADOS (como em Presenças): os treinos
     planeados para a frente entravam no denominador e a assiduidade
     aparecia baixíssima (ex.: 7 presenças em 48 dias, 15%). */
  const hojeIso = todayStr();
  const days = groupSessionsByDate(trainingSessions).filter(d => d.date < hojeIso);
  const attended = days.filter(d => dayPresent(d.list, player.id)).length;
  const attendancePct = days.length ? Math.round((attended / days.length) * 100) : null;

  const ratings = days
    .filter(d => dayPresent(d.list, player.id))
    .map(d => dayRating(d.list, player.id))
    .filter(r => r != null && r !== '')
    .map(Number);
  const avgTrainingRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

  /* Jogos amigáveis não contam para as estatísticas de jogo (convocado,
     titular, minutos, golos, notas...) — servem para treino/rodagem, não
     são competição oficial. Ficam de fora aqui, centralizado, para não
     ter de se lembrar de filtrar em cada sítio que usa playerStats. */
  /* QUEM DECIDE QUE JOGOS ENTRAM É QUEM CHAMA, não esta função.

     Havia aqui um filtro que descartava os amigáveis. Fazia sentido
     enquanto só existia uma tabela de estatísticas — mas agora há um
     recorte de pré-época, e o filtro escondido tornava-o impossível: por
     mais amigáveis que lhe fossem entregues, saíam sempre zeros.

     Quem chama já escolhe a lista que quer analisar. Filtrar outra vez cá
     dentro é decidir duas vezes a mesma coisa, e a segunda decisão era
     invisível para quem lia o resultado. */
  const playerMatches = (matches || []).filter(m => (m.convocados || []).includes(player.id));
  const reports = playerMatches.map(m => (m.report && m.report[player.id]) || {});
  const goals = reports.reduce((a, r) => a + (Number(r.goals) || 0), 0);
  const assists = reports.reduce((a, r) => a + (Number(r.assists) || 0), 0);
  const minutes = reports.reduce((a, r) => a + (Number(r.minutes) || 0), 0);
  const yellow = reports.filter(r => r.card === 'yellow' || r.card === 'yellow2').length;
  const red = reports.filter(r => r.card === 'red' || r.card === 'yellow2').length;
  const matchRatings = reports.filter(r => r.rating != null && r.rating !== '').map(r => Number(r.rating));
  const avgMatchRating = matchRatings.length ? (matchRatings.reduce((a, b) => a + b, 0) / matchRatings.length).toFixed(1) : null;
  const starts = playerMatches.filter(m => (m.starters || []).includes(player.id)).length;
  const subsUsed = playerMatches.filter(m => {
    const isStarter = (m.starters || []).includes(player.id);
    const mins = Number(((m.report && m.report[player.id]) || {}).minutes) || 0;
    return !isStarter && mins > 0;
  }).length;

  return {
    attended, totalSessions: days.length, attendancePct, avgTrainingRating,
    matchesPlayed: playerMatches.length, starts, subsUsed, goals, assists, minutes, yellow, red, avgMatchRating,
  };
}

