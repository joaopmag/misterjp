// competicao/tabela.jsx
/* TABELAS DAS COMPETIÇÕES (classificação, jornadas, zonas). Saíram de
   competicao/dados.jsx (que as reexporta) para o Portal do atleta as usar
   sem carregar o Simulador e a Escalação, de que o resto de dados.jsx
   depende. */
import { T } from '../base/tema';
import { uid } from '../base/utilidades';

/* Nome do clube sem o escalão.

   Na Época o clube está guardado como "SC Salgueiros · Sub-19", porque
   distingue a equipa nos sítios onde há mais do que uma. Numa ficha de
   jogo o escalão é ruído: já se sabe de que equipa se trata, e o nome
   comprido rouba espaço ao resultado, que é o que se quer ler. */
export function clubeSemEscalao(nome) {
  return String(nome || '').split('·')[0].trim();
}

/* ---------------------------------------------------------------
   CLASSIFICAÇÃO — tabela da competição (ex: AF Porto), atualizada
   manualmente jornada a jornada. Não depende de nenhum site externo:
   os dados são colados/introduzidos aqui e ficam guardados e
   sincronizados para toda a equipa técnica.
---------------------------------------------------------------- */
export function sortStandings(teams) {
  return [...(teams || [])]
    .map(t => {
      const J = Number(t.J) || 0, V = Number(t.V) || 0, E = Number(t.E) || 0, D = Number(t.D) || 0;
      const GM = Number(t.GM) || 0, GS = Number(t.GS) || 0;
      return { ...t, J, V, E, D, GM, GS, P: V * 3 + E, DG: GM - GS };
    })
    .sort((a, b) => b.P - a.P || b.DG - a.DG || b.GM - a.GM || a.name.localeCompare(b.name));
}

/* Lê um resultado escrito à mão ("2-1", "2 - 1", "2:1") e devolve os
   golos de cada lado. Se não der para perceber, devolve null e o jogo é
   ignorado no cálculo (fica registado à mesma na lista da jornada). */
export function parseScore(text) {
  if (!text) return null;
  const m = String(text).match(/(\d+)\s*[-–—:xX]\s*(\d+)/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

/* Constrói a classificação a partir dos resultados de todas as jornadas:
   jogos, vitórias, empates, derrotas, golos marcados e sofridos. Os
   pontos e a diferença de golos são depois calculados em sortStandings.
   `extraNames` permite manter na tabela equipas que ainda não jogaram. */
export function computeStandingsFromRounds(rounds, extraNames = []) {
  const map = new Map();
  const keyOf = (n) => String(n || '').trim().toLowerCase();
  const ensure = (name) => {
    const k = keyOf(name);
    if (!k) return null;
    if (!map.has(k)) map.set(k, { id: k, name: String(name).trim(), J: 0, V: 0, E: 0, D: 0, GM: 0, GS: 0 });
    return map.get(k);
  };
  extraNames.forEach(n => ensure(n));
  (rounds || []).forEach(r => (r.games || []).forEach(g => {
    const sc = parseScore(g.score);
    const home = ensure(g.home);
    const away = ensure(g.away);
    if (!sc || !home || !away || home === away) return;
    home.J++; away.J++;
    home.GM += sc.home; home.GS += sc.away;
    away.GM += sc.away; away.GS += sc.home;
    if (sc.home > sc.away) { home.V++; away.D++; }
    else if (sc.home < sc.away) { away.V++; home.D++; }
    else { home.E++; away.E++; }
  }));
  return [...map.values()];
}

export function normalizeStandings(standings) {
  const st = standings || {};
  if (Array.isArray(st.competitions) && st.competitions.length) {
    const activeId = st.competitions.some(c => c.id === st.activeId) ? st.activeId : st.competitions[0].id;
    return { competitions: st.competitions, activeId };
  }
  // Migração do formato antigo (uma só competição solta no objeto).
  const legacy = {
    id: uid(),
    name: st.competition || 'Competição',
    teamNames: (st.teams || []).map(t => t.name).filter(Boolean),
    rounds: st.rounds || [],
    auto: st.auto !== false,
    teams: st.teams || [],
  };
  const hasAnything = legacy.name !== 'Competição' || legacy.teamNames.length || legacy.rounds.length;
  return { competitions: hasAnything ? [legacy] : [], activeId: hasAnything ? legacy.id : null };
}

export function activeCompetitionOf(standings) {
  const { competitions, activeId } = normalizeStandings(standings);
  return competitions.find(c => c.id === activeId) || competitions[0] || null;
}

/* ZONAS DA CLASSIFICAÇÃO: campeão, subida e descida, definidas em cada
   competição (Editar classificação › Configuração). Sem nada definido,
   a tabela fica como sempre foi. O campeão conta também como subida. */
export const ZONAS_CLASS = {
  campeao: { cor: '#D9A72E', rotulo: 'Campeão' },
  sobe: { cor: '#4CA86B', rotulo: 'Sobe' },
  desce: { cor: '#C25A5A', rotulo: 'Desce' },
};

export function zonaClassificacao(comp, i, n) {
  if (!comp) return null;
  const sobem = Math.max(0, parseInt(comp.sobem, 10) || 0);
  const descem = Math.max(0, parseInt(comp.descem, 10) || 0);
  if (comp.campeao && i === 0) return 'campeao';
  if (i < sobem) return 'sobe';
  if (descem && i >= n - descem && i >= sobem) return 'desce';
  return null;
}

// Faixa colorida à esquerda da posição (o "#") na linha da tabela.
export function estiloZona(comp, i, n) {
  const z = zonaClassificacao(comp, i, n);
  return z ? { boxShadow: `inset 3px 0 0 ${ZONAS_CLASS[z].cor}`, color: ZONAS_CLASS[z].cor, fontWeight: 700 } : {};
}

export function LegendaZonas({ comp }) {
  if (!comp) return null;
  const itens = [
    comp.campeao && 'campeao',
    (parseInt(comp.sobem, 10) || 0) > (comp.campeao ? 1 : 0) && 'sobe',
    (parseInt(comp.descem, 10) || 0) > 0 && 'desce',
  ].filter(Boolean);
  if (!itens.length) return null;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: T.mutedDim }}>
      {itens.map(z => (
        <span key={z} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: ZONAS_CLASS[z].cor }} /> {ZONAS_CLASS[z].rotulo}
        </span>
      ))}
    </div>
  );
}

// Classificação de uma competição: em automático calcula-se a partir dos
// resultados; em manual usa-se a tabela introduzida à mão.
export function competitionTable(comp) {
  if (!comp) return [];
  if (comp.auto === false) return sortStandings(comp.teams || []);
  return sortStandings(computeStandingsFromRounds(comp.rounds || [], comp.teamNames || []));
}

/* Cria (ou atualiza) na lista de Jogos os encontros da competição em que
   a nossa equipa participa. É isto que os faz aparecer também na agenda
   semanal do Planeamento, que lê a mesma lista.

   Só entram jogos com data em calendário e com a nossa equipa escolhida
   na configuração. A ligação é feita pelo id do jogo (`sourceGameId`),
   por isso corrigir a data ou o resultado atualiza o jogo já criado em
   vez de criar um duplicado. Apagar o jogo da jornada NÃO apaga o jogo
   já criado — as convocatórias e o relatório ficariam perdidos. */
