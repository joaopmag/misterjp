// competicao/dados.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { sortByPosition } from '../dominio/jogadores';
import { uid } from '../base/utilidades';
import { T } from '../base/tema';
import { competitionLabel, isFriendlyMatch, FRIENDLY } from '../dominio/jogos';
import { distribuirOnzeNoCampo, tamanhoDaFormacao, FORMACOES, preencherPorFamilia } from '../tatico/Simulador';
import { TODOS_OS_JOGADORES } from './Escalacao';

/* ---------------------------------------------------------------
   JOGOS — convocatória, titulares, tempo de jogo, cartões,
   golos/assistências e nota de jogo por jogador.
---------------------------------------------------------------- */
export const CARD_OPTIONS = [
  { value: 'none', label: 'Sem cartão' },
  { value: 'yellow', label: '1 Amarelo' },
  { value: 'yellow2', label: '2º Amarelo' },
  { value: 'red', label: 'Vermelho direto' },
];

/* O que aconteceu a cada jogador, lido do relatório.

   As SUBSTITUIÇÕES são deduzidas dos minutos, porque é o que temos: não
   guardamos o minuto exato da troca. Um titular com menos minutos do que
   a duração saiu a essa altura; um suplente com minutos entrou quando
   faltavam esses minutos para o fim.

   É uma aproximação e está assumida como tal — para um relatório de
   treinador, saber que o médio saiu aos 66 chega; se um dia for preciso
   o minuto exato, passa a ser um campo próprio. */
export function eventosDoJogo(match, players, duracao = 90) {
  const report = (match && match.report) || {};
  const ratingsPresencas = (match && match.ratings) || {};
  const convocados = (match && match.convocados) || [];
  const titularesIds = (match && match.starters) || [];

  const doJogador = (pid) => {
    const p = players.find(x => x.id === pid);
    if (!p) return null;
    const r = report[pid] || {};
    const min = Number(r.minutes);
    const temMinutos = Number.isFinite(min) && min > 0;
    const titular = titularesIds.includes(pid);
    // Nota: primeiro a do próprio relatório de jogo; se não houver,
    // usa-se a que foi preenchida nas Presenças (mesma nota, dois sítios
    // — ver `setReport`/`setRating`, que já as mantêm ligadas para
    // edições novas; isto aqui cobre notas preenchidas antes disso).
    const notaReport = r.rating != null && r.rating !== '' ? Number(r.rating) : null;
    const notaPresencas = ratingsPresencas[pid] != null && ratingsPresencas[pid] !== '' ? Number(ratingsPresencas[pid]) : null;
    return {
      player: p,
      titular,
      minutos: Number.isFinite(min) ? min : null,
      golos: Number(r.goals) || 0,
      assistencias: Number(r.assists) || 0,
      cartao: r.card && r.card !== 'none' ? r.card : null,
      nota: notaReport != null ? notaReport : notaPresencas,
      // Saiu: titular que não fez o jogo todo. Entrou: suplente com minutos.
      saiuAo: titular && temMinutos && min < duracao ? min : null,
      entrouAo: !titular && temMinutos ? Math.max(0, duracao - min) : null,
      jogou: temMinutos,
    };
  };

  const todos = convocados.map(doJogador).filter(Boolean);

  /* Jogadores à experiência (ainda sem ficha no Plantel, `match.convidados`)
     não têm `id`, por isso nunca apareciam aqui — `doJogador` procura por
     `id` em `players` e não os encontra, e ficavam sistematicamente de
     fora de qualquer lista, resumo ou partilha que passasse por esta
     função (que é a fonte de quase tudo: FichaJogo, ficha impressa,
     partilha em HTML). Entram sempre como suplentes, sem estatísticas
     (não há `report` para quem não tem `id`), e sempre no fim da lista
     de suplentes — nunca misturados a meio de quem já tem ficha. */
  const convidados = ((match && match.convidados) || []).map((c, i) => ({
    player: { id: `convidado-${i}`, name: c.nome, position: c.position || '', convidado: true },
    titular: false,
    minutos: null, golos: 0, assistencias: 0, cartao: null, nota: null,
    saiuAo: null, entrouAo: null, jogou: false,
  }));

  return {
    titulares: todos.filter(x => x.titular),
    suplentes: [
      ...sortByPosition(todos.filter(x => !x.titular).map(x => x.player))
        .map(p => todos.find(x => x.player.id === p.id)),
      ...convidados,
    ],
    todos: [...todos, ...convidados],
  };
}

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
/* LIMPEZA DA EQUIPA DUPLICADA

   Uma versão anterior escrevia na tabela o nome do clube tal como está na
   Época ("SC Salgueiros · Sub-19") em vez do nome inscrito na competição
   ("SC Salgueiros"). O resultado foi uma segunda linha na classificação,
   com o mesmo clube e outro nome.

   Isto repara o estrago sem trabalho manual: sempre que a tabela é lida,
   qualquer referência ao nome errado é reescrita para o nome certo e a
   entrada duplicada desaparece da lista de equipas. Corre em silêncio e
   não faz nada se não houver nada a reparar.

   Só junta nomes quando a competição tem `myTeam` definida — sem isso não
   há forma de saber qual dos dois nomes é o bom, e o mais seguro é não
   mexer. */
export function limparEquipaDuplicada(standings, season) {
  const dados = normalizeStandings(standings);
  const clube = ((season && season.club) || '').trim();
  if (!clube) return dados;

  let mexeu = false;
  const competitions = dados.competitions.map(comp => {
    const certo = (comp.myTeam || '').trim();
    if (!certo || certo === clube) return comp;
    // O nome errado só é um problema se estiver mesmo lá.
    const aparece = (comp.teamNames || []).some(t => (t || '').trim() === clube)
      || (comp.rounds || []).some(r => (r.games || []).some(g => (
        (g.home || '').trim() === clube || (g.away || '').trim() === clube
      )));
    if (!aparece) return comp;
    mexeu = true;

    const trocar = (nome) => ((nome || '').trim() === clube ? certo : nome);
    return {
      ...comp,
      teamNames: [...new Set((comp.teamNames || []).map(trocar).filter(Boolean))],
      teams: (comp.teams || [])
        .map(t => ({ ...t, name: trocar(t.name) }))
        // Depois de renomear pode haver duas entradas com o mesmo nome.
        .filter((t, i, arr) => arr.findIndex(o => (o.name || '') === (t.name || '')) === i),
      rounds: (comp.rounds || []).map(r => ({
        ...r,
        games: (r.games || []).map(g => ({ ...g, home: trocar(g.home), away: trocar(g.away) })),
      })),
    };
  });

  return mexeu ? { ...dados, competitions } : dados;
}

/* O CAMINHO INVERSO: do jogo criado à mão para a tabela da competição.

   A tabela já criava jogos (syncCompetitionMatches). Faltava o contrário:
   lançar um jogo à mão com competição, jornada e adversário devia
   escrever esse encontro na jornada respetiva, em vez de obrigar a
   introduzir a mesma informação duas vezes.

   Nunca cria jornadas nem duplica encontros: só preenche o jogo que já lá
   está por preencher, ou acrescenta um à jornada indicada. O resultado só
   é escrito se o jogo ainda não tiver um — a tabela é a fonte oficial e
   não se sobrepõe ao que lá foi lançado. */
export function syncMatchIntoCompetition(match, standings, season, matches) {
  const dados = normalizeStandings(standings);
  const nomeComp = competitionLabel(match && match.competition);
  const jornada = (match && match.jornada || '').trim();
  const adversario = (match && match.opponent || '').trim();
  if (!nomeComp || !jornada || !adversario || isFriendlyMatch(match)) return dados;

  const ci = dados.competitions.findIndex(c => (c.name || '').trim().toLowerCase() === nomeComp.toLowerCase());
  if (ci < 0) return dados;

  const comp = dados.competitions[ci];

  /* O NOME DA NOSSA EQUIPA TEM DE SER O DA COMPETIÇÃO.

     Na app o clube chama-se "SC Salgueiros · Sub-19" (season.club), mas na
     tabela da AF está inscrito como "SC Salgueiros" (comp.myTeam). Usar o
     primeiro para escrever na tabela criava uma SEGUNDA equipa com o mesmo
     clube e outro nome — foi o que apareceu na classificação.

     Manda sempre o nome da competição. O `season.club` só serve de recurso
     quando a competição ainda não tem equipa nossa definida. */
  const nosso = ((comp.myTeam || '').trim())
    || (comp.teamNames || []).find(t => (t || '').trim() === ((season && season.club) || '').trim())
    || ((season && season.club) || '').trim();
  if (!nosso) return dados;
  const ri = (comp.rounds || []).findIndex((r, i) => (r.label || `Jornada ${i + 1}`) === jornada);
  if (ri < 0) return dados; // jornada inexistente: não se inventam jornadas

  const emCasa = match.atHome !== false;
  const casa = emCasa ? nosso : adversario;
  const fora = emCasa ? adversario : nosso;
  const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

  const jogos = [...(comp.rounds[ri].games || [])];
  // Um encontro entre as mesmas duas equipas nesta jornada já existe?
  let gi = jogos.findIndex(g => (
    (igual(g.home, casa) && igual(g.away, fora)) || (igual(g.home, fora) && igual(g.away, casa))
  ));
  if (gi < 0) {
    // Ou uma linha vazia à espera de ser preenchida?
    gi = jogos.findIndex(g => !String(g.home || '').trim() && !String(g.away || '').trim());
  }

  /* O ENCONTRO NA TABELA FICA COM O ID DO PRÓPRIO JOGO.

     Era aqui que nascia a duplicação. Lançar um jogo à mão escrevia-o na
     jornada com um id NOVO; depois, ao gravar a classificação, o caminho
     inverso (syncCompetitionMatches) via um encontro que não reconhecia
     — procura pelo `sourceGameId` — e criava um segundo jogo para o
     mesmo encontro. Ficavam dois, exatamente iguais.

     Usar o id do jogo como id do encontro fecha o círculo: o
     `sourceGameId` que se grava a seguir aponta para ele, e os dois lados
     passam a reconhecer-se um ao outro.

     ISTO TINHA DE VALER TAMBÉM QUANDO `gi >= 0` — ou seja, quando a
     jornada já tinha o encontro (equipas preenchidas de antemão, como
     acontece ao copiar o calendário oficial da competição). Antes, esse
     caso mantinha sempre o id antigo da jornada, e o encontro nunca
     chegava a reconhecer o jogo lançado à mão: cada gravação seguinte da
     classificação voltava a criar um jogo novo para o mesmo encontro.

     A exceção: se esse id antigo já pertencer a OUTRO jogo (via
     sourceGameId), trocá-lo desligava esse outro jogo da jornada. Nesse
     caso concreto mantém-se o id como estava — o que sobra fica para a
     limpeza de duplicados tratar, em vez de trocar um problema por
     outro. */
  const idReclamado = gi >= 0 && jogos[gi].id
    ? (matches || []).some(m => m.id !== match.id && m.sourceGameId === jogos[gi].id)
    : false;
  const novo = {
    id: gi >= 0 && jogos[gi].id && idReclamado ? jogos[gi].id : (match.id || uid()),
    home: casa, away: fora,
    date: match.date || (gi >= 0 ? jogos[gi].date : '') || '',
    // O resultado da tabela manda: só se escreve se lá não houver nenhum.
    score: (gi >= 0 && String(jogos[gi].score || '').trim()) || match.result || '',
  };
  if (gi >= 0) jogos[gi] = { ...jogos[gi], ...novo };
  else jogos.push(novo);

  const rounds = comp.rounds.map((r, i) => (i === ri ? { ...r, games: jogos } : r));
  const competitions = dados.competitions.map((c, i) => (i === ci ? { ...c, rounds } : c));
  return { ...dados, competitions };
}

/* Uma convocatória por cada jogo nosso lançado na tabela.

   Lançar uma jornada na competição já criava os jogos; agora cria também
   a convocatória correspondente, com adversário, data, jornada e
   casa/fora já preenchidos e a lista de nomes por fazer. É o mesmo
   princípio de syncMatchConvocatoria: a informação escreve-se uma vez, no
   sítio onde é conhecida, e aparece onde faz falta. */
export function syncCompetitionConvocatorias(matches, convocatorias, season) {
  let lista = convocatorias || [];
  (matches || []).forEach(m => {
    if (!m.sourceGameId) return; // só os jogos vindos da tabela
    lista = syncMatchConvocatoria(m, lista, season);
  });
  return lista;
}

export function syncCompetitionMatches(competitions, matches) {
  const next = [...(matches || [])];
  (competitions || []).forEach(comp => {
    const mine = (comp.myTeam || '').trim();
    if (!mine) return;
    (comp.rounds || []).forEach((r, ri) => (r.games || []).forEach(g => {
      // O rótulo da jornada viaja com o jogo: é ele que aparece depois na
      // convocatória e na ficha, e sem isto ficava sempre em branco.
      const jornada = r.label || `Jornada ${ri + 1}`;
      if (!g.id || !/^\d{4}-\d{2}-\d{2}$/.test(g.date || '')) return;
      const isHome = g.home === mine;
      const isAway = g.away === mine;
      if (!isHome && !isAway) return;
      const opponent = isHome ? g.away : g.home;
      if (!opponent) return;
      const sc = parseScore(g.score);
      /* O resultado guarda-se SEMPRE como "casa-fora", igual à tabela.
         Antes, nos jogos fora, esta função invertia-o para "nós-eles",
         mas o resto da app (marcador, V/E/D, ficha do jogo, relatórios)
         lê "casa-fora": cada vez que se gravava a tabela da competição,
         os jogos fora apareciam com o resultado trocado (uma vitória fora
         por 1-0 passava a derrota). */
      const result = sc ? `${sc.home}-${sc.away}` : '';
      const idx = next.findIndex(m => m.sourceGameId === g.id);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          date: g.date, opponent, atHome: isHome, jornada,
          competition: comp.name || next[idx].competition,
          result: result || next[idx].result || '',
        };
      } else {
        next.push({
          id: uid(), sourceGameId: g.id, date: g.date, opponent, atHome: isHome, jornada,
          competition: comp.name || '', result,
          convocados: [], starters: [], report: {},
        });
      }
    }));
  });
  return next;
}

/* OS TITULARES DE UM JOGO, PELA ORDEM DO CAMPO (GR, DD, DC, DC, DE, MC…),
   tal como estão na ficha do jogo — com o alinhamento escolhido à mão,
   quando existe. É a ordem que as folhas impressas usam para o onze. */
export function titularesPorLugar(jogo, players) {
  const ids = (jogo && jogo.starters) || [];
  const titulares = ids.map(id => (players || []).find(p => p.id === id)).filter(Boolean);
  if (!titulares.length) return [];
  const { colocados } = distribuirOnzeNoCampo(titulares, jogo.formacao || '4-3-3', jogo.alinhamento);
  const ordem = colocados.filter(Boolean);
  // Quem não coube num lugar da formação (raro) vai no fim, para não se perder.
  titulares.forEach(p => { if (!ordem.some(x => x.id === p.id)) ordem.push(p); });
  return ordem;
}

/* Todo o jogo é, para efeitos de planeamento, uma sessão de trabalho: fica
   na agenda com fase "Jogo", intensidade alta e formato 11x11, para
   aparecer no Planeamento, entrar na carga de treino e — o que importa
   para o Wellness/PSE do dia — dar ao check-in uma sessão a que associar
   a resposta. Sem sessão no dia, o PSE não tem a que se ligar e o
   check-in não o oferece (ver "Sessão de hoje" no Overview).

   Antes só os amigáveis criavam esta sessão sozinhos; um jogo oficial de
   competição ficava sem nenhuma, e o treinador tinha de criar a sessão à
   mão em Planeamento só para o PSE aparecer no check-in dos atletas.
   Agora vale para qualquer jogo — amigável ou oficial.

   Só se cria se ainda não houver sessão nesse dia — nunca se sobrepõe a
   um treino que o treinador já tenha planeado. */
export function ensureMatchSession(match, sessions) {
  const lista = sessions || [];
  if (!match || !match.date) return lista;
  if (lista.some(x => x.date === match.date)) return lista;
  return [...lista, {
    id: uid(),
    date: match.date,
    phase: 'Jogo',
    intensity: 'Alta',
    focus: '11x11',
    opponent: match.opponent || '',
    exerciseIds: [],
    attendance: [...(match.convocados || [])],
    sourceMatchId: match.id,
  }];
}

// Nomes das competições configuradas em Jogos, para as listas de escolha
// dos jogos e das convocatórias. "Amigável" está sempre disponível.
export function competitionOptions(standings) {
  const names = normalizeStandings(standings).competitions
    .map(c => (c.name || '').trim())
    .filter(Boolean);
  return [...new Set([FRIENDLY, ...names])];
}

// Competição configurada com um determinado nome (ou null se for um
// amigável / uma competição já apagada).
export function competitionByName(standings, name) {
  const alvo = competitionLabel(name).toLowerCase();
  if (!alvo || alvo === FRIENDLY.toLowerCase()) return null;
  return normalizeStandings(standings).competitions
    .find(c => (c.name || '').trim().toLowerCase() === alvo) || null;
}

// Equipas e jornadas de uma competição, para preencher as listas de
// escolha dos jogos e das convocatórias.
export function competitionTeamNames(comp, ourClub) {
  const nomes = (comp && comp.teamNames ? comp.teamNames : []).map(t => (t || '').trim()).filter(Boolean);
  const nosso = String(ourClub || '').trim().toLowerCase();
  // A nossa equipa não é adversária de si própria.
  return nosso ? nomes.filter(t => t.toLowerCase() !== nosso) : nomes;
}

export function competitionRoundLabels(comp) {
  return (comp && comp.rounds ? comp.rounds : [])
    .map((r, i) => (r.label || `Jornada ${i + 1}`));
}

/* Data marcada na competição para o encontro entre a nossa equipa e um
   adversário, numa jornada. Devolve '' quando o jogo ainda não tem data
   ou não está lançado — nesse caso o campo fica como estava. */
export function competitionGameDate(comp, roundLabel, opponent) {
  if (!comp || !opponent) return '';
  const adv = String(opponent).trim().toLowerCase();
  const rondas = (comp.rounds || []);
  const alvo = roundLabel
    ? rondas.filter((r, i) => (r.label || `Jornada ${i + 1}`) === roundLabel)
    : rondas;
  for (const r of alvo) {
    for (const g of (r.games || [])) {
      const home = String(g.home || '').trim().toLowerCase();
      const away = String(g.away || '').trim().toLowerCase();
      if ((home === adv || away === adv) && g.date) return g.date;
    }
  }
  return '';
}

export const emptyCompetition = (name = '') => ({
  id: uid(), name, teamNames: [], rounds: [], auto: true, teams: [],
});

/* QUEM GANHOU. O resultado guarda-se como "casa-fora" (o mesmo que a
   tabela da competição usa). Daqui sai o marcador com o nosso nome do
   lado certo e a letra V / E / D. */
export function marcadorDoJogo(m, season) {
  const nosso = clubeSemEscalao(season && season.club) || 'Nós';
  const rival = (m && m.opponent) || 'Adversário';
  const emCasa = m.atHome !== false;
  const sc = parseScore(m.result);
  const casa = emCasa ? nosso : rival;
  const fora = emCasa ? rival : nosso;
  if (!sc) return { casa, fora, emCasa, golosCasa: null, golosFora: null, letra: null };
  const nos = emCasa ? sc.home : sc.away;
  const eles = emCasa ? sc.away : sc.home;
  const letra = nos > eles ? 'V' : nos < eles ? 'D' : 'E';
  return { casa, fora, emCasa, golosCasa: sc.home, golosFora: sc.away, letra };
}

export const COR_RESULTADO = { V: '#3E9B5F', E: '#9A8A4A', D: '#B3261E' };

/* Título do jogo com a equipa da CASA primeiro ("Paredes vs Salgueiros"
   num jogo fora), como no marcador. */
export function tituloDoJogo(match, nosso) {
  const rival = (match && match.opponent) || 'Adversário por definir';
  return match && match.atHome === false ? `${rival} vs ${nosso}` : `${nosso} vs ${rival}`;
}

export const NOME_RESULTADO = { V: 'Vitória', E: 'Empate', D: 'Derrota' };

/* ---------------------------------------------------------------
   CONVOCATÓRIAS — convocatória por jogo (jogo, lista de
   convocados, responsáveis), separada em "próximos jogos" e
   "jogos realizados".
---------------------------------------------------------------- */
/* Uma convocatória é sempre um jogo. Ao guardá-la, garantimos que existe o
   jogo correspondente na lista de Jogos — é esse registo que a faz aparecer
   no Planeamento, na agenda semanal e na tabela de presenças. Se já houver
   um jogo na mesma data (por exemplo criado a partir das jornadas da
   competição), é esse que se atualiza, em vez de se criar um duplicado. */
/* Um onze plausível a partir de uma lista de convocados.

   A versão anterior ficava com os PRIMEIROS ONZE da lista. Como a lista
   de convocados está ordenada por posição, isso dava um onze com os
   quatro guarda-redes e nenhum avançado — uma equipa que ninguém poria
   em campo, e que o treinador tinha de desfazer à mão de cada vez.

   Agora preenche-se um 4-3-3 pela posição de cada um, com a mesma regra
   que a ficha de jogo usa para colocar os jogadores no campo. É uma
   sugestão de partida, não uma decisão: o onze muda-se na ficha do jogo
   com dois toques. */
export function onzeProvavel(ids, players, formacao = '4-3-3') {
  const lista = (ids || []).map(id => (players || []).find(p => p.id === id)).filter(Boolean);
  if (lista.length <= 11) return lista.map(p => p.id);
  const { colocados } = distribuirOnzeNoCampo(lista, formacao);
  return colocados.filter(Boolean).map(p => p.id);
}

export function syncConvocatoriaMatch(conv, matches, players) {
  if (!conv || !conv.data) return matches || [];
  const list = matches || [];
  const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

  let idx = list.findIndex(m => m.sourceConvocatoriaId === conv.id);
  // Convocatória de um amigável: está ligada ao jogo pelo id.
  if (idx < 0 && conv.jogoId) idx = list.findIndex(m => m.id === conv.jogoId);
  if (idx < 0) {
    // Sem ligação explícita: aproveita um jogo da mesma data, desde que o
    // adversário não seja outro (um dos dois pode ainda estar por preencher).
    idx = list.findIndex(m => m.date === conv.data
      && (!m.opponent || !conv.adversario || igual(m.opponent, conv.adversario)));
  }

  const base = {
    date: conv.data,
    opponent: conv.adversario || '',
    competition: competitionLabel(conv.competicao) || '',
    jornada: conv.jornada || '',
    sourceConvocatoriaId: conv.id,
    /* O onze da convocatória alimenta os titulares do jogo, e daí as
       estatísticas (TITULAR / SUPL) e a assiduidade. Sem isto, o treinador
       tinha de escolher o onze duas vezes: uma na convocatória e outra na
       ficha do jogo. */
    /* Sem `players` não há como saber posições — nesse caso mantém-se o
       comportamento antigo, que pelo menos não perde ninguém. */
    starters: players ? onzeProvavel(conv.convocados, players) : (conv.convocados || []).slice(0, 11),
    capitao: conv.capitao,
    subcapitao: conv.subcapitao,
  };
  if (conv.casaFora) base.atHome = conv.casaFora === 'Casa';

  if (idx < 0) {
    // `...base` fica DEPOIS dos valores por omissão: é ele que traz os
    // titulares vindos da convocatória, e antes eram apagados pelo
    // `starters: []` que vinha a seguir.
    return [...list, { id: uid(), result: '', convocados: [...(conv.convocados || [])], starters: [], report: {}, ...base }];
  }
  return list.map((m, i) => {
    if (i !== idx) return m;
    const next = { ...m, ...base };
    /* Os convocados seguem sempre a convocatória, para as duas listas
       nunca discordarem — a mesma regra "última gravação manda" já
       aplicada no sentido inverso (jogo → convocatória). Apagar aqui
       apaga lá, e vice-versa. Isto substitui uma proteção antiga que só
       deixava copiar enquanto `m.attendance` não tivesse sido tocado —
       fazia sentido para não reescrever presenças já registadas, mas
       tinha o efeito de travar a sincronização assim que alguém marcava
       UMA presença, mesmo sem intenção de fixar a lista para sempre. */
    next.convocados = [...(conv.convocados || [])];
    /* O ONZE É UM SÓ, NOS DOIS SÍTIOS. Se a convocatória tem o onze
       arrumado no campo (lugar a lugar), foi o treinador que o definiu
       ali — é a última gravação e passa para o jogo tal e qual: titulares,
       lugares e sistema. Antes, o jogo ficava com os titulares antigos e,
       ao reabrir, o onze aparecia trocado (ex.: um titular escolhido na
       convocatória voltava ao banco no jogo). */
    const nConv = tamanhoDaFormacao(conv.formacao || '4-3-3') || 11;
    if (Array.isArray(conv.alinhamento) && conv.alinhamento.length === nConv) {
      const conv11 = new Set(conv.convocados || []);
      next.alinhamento = conv.alinhamento.map(id => (id && conv11.has(id) ? id : null));
      next.starters = next.alinhamento.filter(Boolean);
      next.formacao = conv.formacao || '4-3-3';
    } else if ((m.starters || []).length > 0) {
      /* Sem onze arrumado na convocatória: os titulares do jogo mantêm-se
         (o que se registou na ficha do jogo e no relatório manda). */
      next.starters = m.starters;
    }
    // Quem saiu dos convocados sai também da Presenças (attendance,
    // faltas, lesionados, escalão) — sem isto ficava marcado como "C"
    // numa grelha que já nem devia mostrá-lo.
    return podarPresencasForaDosConvocados(next);
  });
}

/* O CAMINHO INVERSO: do jogo para a convocatória.

   A convocatória já alimentava o jogo. Faltava o contrário: escolher os
   convocados na ficha do jogo devia produzir a convocatória, em vez de
   obrigar a repetir a mesma escolha nos dois sítios.

   Duas regras evitam duplicados e enganos:
   · liga-se pelo `sourceConvocatoriaId` e, na falta dele, por data —
     nunca se cria uma segunda convocatória para o mesmo jogo;
   · amigáveis não geram convocatória nenhuma. Não há convocatória num
     amigável: há presenças, e essas vivem na tabela de presenças. */
/* SEM CONVOCATÓRIA, SEM PRESENÇA MARCADA.

   `convocados` (quem foi chamado) e `attendance`/`faltas`/`lesionados`/
   `escalao` (o que aconteceu a cada um na Presenças) são campos
   diferentes do jogo — mas dependem um do outro: não faz sentido
   alguém continuar marcado como "C" (convocado) na grelha de Presenças
   depois de ter sido tirado da lista de convocados. Sem esta poda, uma
   marca antiga ficava pendurada e a Presenças mostrava gente que já
   não estava convocada.

   Chamada sempre que um jogo é gravado — cobre tanto editar os
   convocados diretamente no jogo como a sincronização vinda da
   convocatória (as duas acabam por passar por aqui). */
/* LUGARES SEMPRE IGUAIS AOS TITULARES. Quando os titulares mudam fora do
   campo (ex.: no relatório do jogo), os lugares acompanham: quem deixou de
   ser titular sai do seu lugar e quem passou a titular entra num lugar
   vazio (da sua posição, se houver). Quem continua titular NUNCA muda de
   lugar. Sem lugares gravados não se mexe em nada. */
export function alinharLugaresComTitulares(match) {
  const fm = match.formacao || '4-3-3';
  const n = tamanhoDaFormacao(fm) || 11;
  if (!Array.isArray(match.alinhamento) || match.alinhamento.length !== n) return match;
  const titulares = (match.starters || []).filter(Boolean);
  const eTitular = new Set(titulares);
  const slots = match.alinhamento.map(id => (id && eTitular.has(id) ? id : null));
  const faltam = titulares.filter(id => !slots.includes(id));
  if (faltam.length) {
    const porId = new Map((TODOS_OS_JOGADORES.lista || []).map(p => [p.id, p]));
    const lugares = FORMACOES[fm] || FORMACOES['4-3-3'];
    const vazios = slots.map((v, i) => (v ? null : { lugar: lugares[i], i })).filter(Boolean);
    const porColocar = faltam.map(id => porId.get(id)).filter(Boolean);
    const colocados = slots.map(id => (id ? porId.get(id) || { id } : null));
    preencherPorFamilia(vazios, porColocar, colocados);
    colocados.forEach((p, i) => { if (p && !slots[i]) slots[i] = p.id; });
    // Quem ainda sobrar (sem ficha ou sem posição) vai para o 1.º lugar vazio.
    faltam.forEach(id => { if (!slots.includes(id)) { const i = slots.indexOf(null); if (i >= 0) slots[i] = id; } });
  }
  if (slots.every((x, i) => x === match.alinhamento[i])) return match;
  return { ...match, alinhamento: slots };
}

export function podarPresencasForaDosConvocados(match) {
  const validos = new Set(match.convocados || []);
  // Titular tem de estar convocado; e os lugares acompanham os titulares.
  const base0 = Array.isArray(match.starters) && (match.convocados || []).length
    ? { ...match, starters: match.starters.filter(id => validos.has(id)) }
    : match;
  const podado = { ...alinharLugaresComTitulares(base0) };
  ['attendance', 'faltas', 'lesionados', 'escalao'].forEach(campo => {
    if (Array.isArray(podado[campo])) {
      podado[campo] = podado[campo].filter(id => validos.has(id));
    }
  });
  if (podado.ratings) {
    const ratings = {};
    Object.keys(podado.ratings).forEach(id => { if (validos.has(id)) ratings[id] = podado.ratings[id]; });
    podado.ratings = ratings;
  }
  return podado;
}

export function syncMatchConvocatoria(match, convocatorias, season) {
  const lista = convocatorias || [];
  const amigavel = isFriendlyMatch(match || {});
  /* AMIGÁVEIS: só têm convocatória se, ao registar o jogo, se marcou
     "Gerar convocatória" (`comConvocatoria`). Ligam-se ao jogo pelo id
     (`jogoId`) e nunca pela data, para dois amigáveis no mesmo dia (um
     torneio de pré-época) não ficarem com a mesma convocatória. */
  if (!match || !match.date || (amigavel && !match.comConvocatoria)) return lista;
  /* A convocatória nasce COM O JOGO, ainda sem ninguém escolhido.

     Antes só era criada depois de haver convocados, o que obrigava o
     treinador a escrever adversário, data e jornada duas vezes: uma no
     jogo e outra na convocatória. Agora o jogo lança a moldura e o
     treinador só tem de acrescentar os nomes quando os souber. */

  let idx = lista.findIndex(c => c.id === match.sourceConvocatoriaId);
  if (idx < 0 && amigavel) idx = lista.findIndex(c => c.jogoId === match.id);
  if (idx < 0 && !amigavel) idx = lista.findIndex(c => c.data === match.date);

  const base = {
    data: match.date,
    adversario: match.opponent || '',
    competicao: competitionLabel(match.competition) || '',
    jornada: match.jornada || '',
    casaFora: match.atHome === undefined ? undefined : (match.atHome ? 'Casa' : 'Fora'),
    // O interruptor "Visível no Portal" é UM SÓ conceito partilhado
    // pelos dois sítios (o jogo e a ficha formal) — sincroniza-se
    // sempre que o jogo é gravado, para nunca ficar um ligado e o
    // outro desligado.
    visivelAtletas: !!match.convocatoriaVisivelAtletas,
    // Capitão e subcapitão também são um só conceito partilhado — quem
    // os escolhe aqui (no jogo) ou na ficha formal vê a escolha refletida
    // no outro lado, tal como já acontece com "Visível no Portal".
    capitao: match.capitao,
    subcapitao: match.subcapitao,
    // Jogadores à experiência (ainda sem ficha no Plantel) só existem
    // no jogo, nunca na tabela `players` — sem os trazer também para
    // cá, ficavam de fora da lista de convocados sempre que se
    // imprimisse ou partilhasse a convocatória a partir DAQUI.
    convidados: match.convidados || [],
    jogoId: amigavel ? match.id : undefined,
  };
  Object.keys(base).forEach(k => { if (base[k] === undefined) delete base[k]; });

  if (idx < 0) {
    return [...lista, {
      id: uid(),
      epoca: (season && season.name) || '',
      escalao: 'Sub-19',
      treinador: '', teamManager: '',
      localJogo: '', horaJogo: '', horaConcentracao: '', localConcentracao: '', outrasInfo: '',
      convocados: [...(match.convocados || [])],
      ...base,
      ...(Array.isArray(match.alinhamento) && match.alinhamento.length === (tamanhoDaFormacao(match.formacao || '4-3-3') || 11)
        ? { alinhamento: [...match.alinhamento], formacao: match.formacao || '4-3-3' } : {}),
    }];
  }
  /* Os convocados acompanham sempre o jogo, tal como já acontece com o
     interruptor "Visível no Portal" — a última gravação é que manda,
     em vez de a convocatória ficar presa a uma lista mais antiga.
     Inclui o caminho inverso: apagar todos os convocados no jogo
     (lista vazia) também tem de limpar a convocatória — antes só
     copiava quando a lista do jogo tinha alguém, por isso esvaziar no
     Planeamento não se refletia em Jogos, e a convocatória ficava
     presa no número antigo. */
  /* E o onze do jogo passa para a convocatória (lugares + sistema), para
     as duas mostrarem sempre o mesmo onze, seja qual for o sítio onde se
     mexeu por último. */
  const nJogo = tamanhoDaFormacao(match.formacao || '4-3-3') || 11;
  // Sem lugares arrumados no jogo, a convocatória também fica sem eles
  // (o seu onze sai dos 11 primeiros convocados — por isso os titulares do
  // jogo vão à frente na lista), com o mesmo sistema.
  const onzeDoJogo = Array.isArray(match.alinhamento) && match.alinhamento.length === nJogo
    ? { alinhamento: [...match.alinhamento], formacao: match.formacao || '4-3-3' }
    : (match.formacao ? { formacao: match.formacao } : {});
  // Sem lugares no jogo: a convocatória fica SEM o campo "alinhamento" (a
  // chave sai), em vez de "alinhamento: null" — um null aqui pode partir
  // quem lê a convocatória no servidor (Portal).
  const semLugares = !onzeDoJogo.alinhamento && !!match.formacao;
  const convJogo = match.convocados || [];
  const titJogo = (match.starters || []).filter(id => convJogo.includes(id));
  const convocadosOrdem = titJogo.length ? [...titJogo, ...convJogo.filter(id => !titJogo.includes(id))] : [...convJogo];
  return lista.map((c, i) => {
    if (i !== idx) return c;
    const novo = { ...c, ...base, ...onzeDoJogo, convocados: convocadosOrdem };
    if (semLugares) delete novo.alinhamento;
    return novo;
  });
}

