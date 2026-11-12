// tatico/prancheta.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React from 'react';
import { addDays, todayStr, uid } from '../base/utilidades';
import { FORMACOES, LAYOUT_FORMACAO, distribuirOnzeNoCampo } from './Simulador';

/* ================================================================
   PRANCHETA DO PLANTEL PRESENTE
   ================================================================

   Ao imprimir um treino, sai também um campo com quem está presente
   colocado na sua posição. Serve para o treinador chegar ao campo e ver
   de relance quem tem em cada zona — sem contar cabeças numa lista.

   NÃO É GUARDADA. Gera-se no momento a partir das presenças e das
   posições do plantel. Se fosse guardada, ficava desatualizada assim que
   alguém faltasse ou mudasse de posição, e passava a mentir — que é pior
   do que não existir.

   O campo em coordenadas reais (105×68), como o resto da app. */
/* ================================================================
   QUADRO DE POSIÇÕES DO PLANTEL
   ================================================================

   Um campo com um lugar por posição e os nomes de quem a ocupa. Não é
   uma prancheta de exercícios — não há setas, cones nem animação. É só
   onde está cada um, que é a pergunta que se faz ao chegar ao treino.

   LUGARES E NÃO POSIÇÕES. Há dois centrais e três médios num campo, e
   uma lista de quatro centrais numa coluna só não diz quem joga com
   quem. Cada lugar é um ponto no campo; a distribuição automática
   reparte quem partilha posição pelos lugares dessa zona.

   O MD ENTRA NO MEIO. Um médio direito num plantel de formação é um
   médio; ter-lhe um lugar próprio deixava-o sozinho num canto do campo
   enquanto o miolo ficava vazio. */
export const P = {
  GR: [0.07, 0.50],
  DD: [0.20, 0.84], DC1: [0.19, 0.66], DC2: [0.19, 0.50], DC3: [0.19, 0.34], DE: [0.20, 0.16],
  MD: [0.40, 0.82], MC1: [0.42, 0.68], MC2: [0.42, 0.50], MC3: [0.42, 0.32], ME: [0.40, 0.18],
  MOC1: [0.58, 0.66], MOC2: [0.58, 0.50], MOC3: [0.58, 0.34],
  ED: [0.70, 0.84], EE: [0.70, 0.16], PL1: [0.84, 0.60], PL2: [0.84, 0.40], PL: [0.84, 0.50],
  fora: [0.50, 0.965],
};

/* AS FORMAÇÕES DEFINEM OS LUGARES.

   Um 4-3-3 tem três médios e um ponta de lança; um 3-5-2 tem três
   centrais e dois avançados. Ter lugares fixos servia uma formação só, e
   obrigava a arrumar tudo à mão nas outras.

   O `de` diz que posições caem naturalmente em cada lugar, por ordem de
   preferência — é o que faz um MD ir para o meio num 4-3-3 (que não tem
   corredor de médio) e ter lugar próprio num 4-4-2. */
export const TATICAS = {
  /* AS COORDENADAS SÃO AS DO DESENHO DA FORMAÇÃO, NÃO UMA GRELHA.

     A primeira versão punha os lugares em colunas certinhas e ficava
     tudo errado: num 4-3-3 os três médios alinhados na mesma linha, num
     4-2-3-1 os extremos no meio do campo, e os corredores do 4-4-2
     colados aos defesas. Um treinador olha para isto e vê logo que não é
     a formação que escreveu.

     Agora cada táctica tem o seu desenho: o triângulo do meio-campo do
     4-3-3 com o 6 mais recuado, os extremos do 4-2-3-1 abertos na linha
     dos três, e os corredores do 4-4-2 e do 3-5-2 subidos e encostados à
     lateral, que é onde jogam. */
  /* OS RÓTULOS SÃO OS DO QUADRO, OS `de` SÃO OS DO PLANTEL.

     São dois vocabulários diferentes e é de propósito. O quadro escreve
     o que o treinador desenha (EX para extremo sem lado, MD para
     trinco, AD/AE para alas); o plantel regista cada jogador na sua
     posição de sempre (ED, EE, MOC, DD, DE). O `de` é a ponte entre os
     dois — mudar um rótulo NÃO obriga a mudar o `de`, e trocá-los põe
     jogadores em lugares errados. */
  '4-3-3': [
    { id: 'GR', rotulo: 'GR', ponto: [0.06, 0.50], de: ['GR'] },
    { id: 'DD', rotulo: 'DD', ponto: [0.26, 0.96], de: ['DD'] },
    { id: 'DC1', rotulo: 'DC', ponto: [0.15, 0.65], de: ['DC'] },
    { id: 'DC2', rotulo: 'DC', ponto: [0.15, 0.35], de: ['DC'] },
    { id: 'DE', rotulo: 'DE', ponto: [0.26, 0.04], de: ['DE'] },
    // O 6, recuado e ao centro: MD é MÉDIO DEFENSIVO, não médio direito.
    { id: 'MC2', rotulo: 'MD', ponto: [0.34, 0.50], de: ['MD', 'MC'] },
    { id: 'MC1', rotulo: 'MC', ponto: [0.50, 0.68], de: ['MC'] },
    { id: 'MC3', rotulo: 'MC', ponto: [0.50, 0.32], de: ['MC', 'MOC'] },
    // EX nos dois lados: o quadro não distingue o lado, o `de` sim.
    { id: 'ED', rotulo: 'EX', ponto: [0.74, 0.96], de: ['ED'] },
    { id: 'EE', rotulo: 'EX', ponto: [0.74, 0.04], de: ['EE'] },
    { id: 'PL', rotulo: 'PL', ponto: [0.90, 0.50], de: ['PL'] },
  ],
  '4-4-2': [
    { id: 'GR', rotulo: 'GR', ponto: [0.06, 0.50], de: ['GR'] },
    { id: 'DD', rotulo: 'DD', ponto: [0.26, 0.96], de: ['DD'] },
    { id: 'DC1', rotulo: 'DC', ponto: [0.15, 0.65], de: ['DC'] },
    { id: 'DC2', rotulo: 'DC', ponto: [0.15, 0.35], de: ['DC'] },
    { id: 'DE', rotulo: 'DE', ponto: [0.26, 0.04], de: ['DE'] },
    // Corredores do 4-4-2: AD/AE, como no 3-5-2 e no 3-4-3. São médios de
    // ala, por isso recebem os extremos do plantel; o MD (trinco) fica no
    // miolo, com o MC2.
    { id: 'MD', rotulo: 'AD', ponto: [0.62, 0.96], de: ['ED'] },
    { id: 'MC1', rotulo: 'MC', ponto: [0.44, 0.62], de: ['MC', 'MOC'] },
    { id: 'MC2', rotulo: 'MC', ponto: [0.44, 0.38], de: ['MC', 'MD'] },
    { id: 'ME', rotulo: 'AE', ponto: [0.62, 0.04], de: ['EE'] },
    { id: 'PL1', rotulo: 'PL', ponto: [0.84, 0.60], de: ['PL'] },
    { id: 'PL2', rotulo: 'PL', ponto: [0.84, 0.40], de: ['PL', 'MOC'] },
  ],
  '4-2-3-1': [
    { id: 'GR', rotulo: 'GR', ponto: [0.06, 0.50], de: ['GR'] },
    { id: 'DD', rotulo: 'DD', ponto: [0.26, 0.96], de: ['DD'] },
    { id: 'DC1', rotulo: 'DC', ponto: [0.15, 0.65], de: ['DC'] },
    { id: 'DC2', rotulo: 'DC', ponto: [0.15, 0.35], de: ['DC'] },
    { id: 'DE', rotulo: 'DE', ponto: [0.26, 0.04], de: ['DE'] },
    { id: 'MC1', rotulo: 'MC', ponto: [0.36, 0.62], de: ['MC'] },
    { id: 'MC2', rotulo: 'MC', ponto: [0.36, 0.38], de: ['MC', 'MD'] },
    { id: 'MOC1', rotulo: 'EX', ponto: [0.60, 0.96], de: ['ED'] },
    { id: 'MOC2', rotulo: 'MO', ponto: [0.60, 0.50], de: ['MOC'] },
    { id: 'MOC3', rotulo: 'EX', ponto: [0.60, 0.04], de: ['EE'] },
    { id: 'PL', rotulo: 'PL', ponto: [0.90, 0.50], de: ['PL'] },
  ],
  '3-5-2': [
    { id: 'GR', rotulo: 'GR', ponto: [0.06, 0.50], de: ['GR'] },
    { id: 'DC1', rotulo: 'DC', ponto: [0.19, 0.74], de: ['DC', 'DD'] },
    { id: 'DC2', rotulo: 'DC', ponto: [0.20, 0.50], de: ['DC'] },
    { id: 'DC3', rotulo: 'DC', ponto: [0.19, 0.26], de: ['DC', 'DE'] },
    // Alas (AD/AE): laterais subidos, é a eles que cabem os corredores.
    { id: 'MD', rotulo: 'AD', ponto: [0.64, 0.90], de: ['DD', 'ED'] },
    // O trinco fica recuado e ao centro, com os dois interiores à frente.
    { id: 'MC2', rotulo: 'MD', ponto: [0.34, 0.50], de: ['MD', 'MC'] },
    { id: 'MC1', rotulo: 'MC', ponto: [0.46, 0.64], de: ['MC'] },
    { id: 'MC3', rotulo: 'MC', ponto: [0.46, 0.36], de: ['MC', 'MOC'] },
    { id: 'ME', rotulo: 'AE', ponto: [0.64, 0.10], de: ['DE', 'EE'] },
    { id: 'PL1', rotulo: 'PL', ponto: [0.84, 0.60], de: ['PL'] },
    { id: 'PL2', rotulo: 'PL', ponto: [0.84, 0.40], de: ['PL', 'MOC'] },
  ],
  '3-4-3': [
    { id: 'GR', rotulo: 'GR', ponto: [0.06, 0.50], de: ['GR'] },
    { id: 'DC1', rotulo: 'DC', ponto: [0.19, 0.74], de: ['DC', 'DD'] },
    { id: 'DC2', rotulo: 'DC', ponto: [0.20, 0.50], de: ['DC'] },
    { id: 'DC3', rotulo: 'DC', ponto: [0.19, 0.26], de: ['DC', 'DE'] },
    // Alas (AD/AE): laterais subidos nos corredores do meio-campo a 4.
    { id: 'MD', rotulo: 'AD', ponto: [0.50, 0.90], de: ['DD', 'ED'] },
    // O 3-4-3 não tem lugar de trinco nem de 10: são os dois MC que
    // recebem o MD e o MOC do plantel. Sem isto, um MOC não encontrava
    // lugar nenhum nesta tática e caía sempre para "Sem lugar".
    { id: 'MC1', rotulo: 'MC', ponto: [0.42, 0.62], de: ['MC', 'MD'] },
    { id: 'MC2', rotulo: 'MC', ponto: [0.42, 0.38], de: ['MC', 'MOC'] },
    { id: 'ME', rotulo: 'AE', ponto: [0.50, 0.10], de: ['DE', 'EE'] },
    { id: 'ED', rotulo: 'EX', ponto: [0.84, 0.85], de: ['ED', 'PL'] },
    { id: 'PL', rotulo: 'PL', ponto: [0.90, 0.50], de: ['PL'] },
    { id: 'EE', rotulo: 'EX', ponto: [0.84, 0.15], de: ['EE', 'PL'] },
  ],
};

export const TATICA_OMISSAO = '4-3-3';

export const LUGAR_FORA = { id: 'fora', rotulo: 'Sem lugar', ponto: P.fora, de: [] };

/* Apelido ou nome próprio — o que couber melhor num lugar pequeno.
   Com nome e apelido a lista fica com o dobro da largura e os lugares
   sobrepõem-se. */
export function nomeCurtoNaPrancheta(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  return partes.length === 1 ? partes[0] : partes[partes.length - 1];
}

/* Quem está presente, já distribuído pelos lugares.

   `overrides` guarda SÓ o que o treinador mudou — um mapa de
   jogador para lugar. Todo o resto continua a ser calculado a partir das
   presenças e das posições reais, por isso quem faltar desaparece
   sozinho e quem chegar aparece no sítio certo sem ninguém arrumar nada.
   Guardar o quadro inteiro faria a folha mentir na primeira falta. */
export function distribuirPlantel({ players, attendance, convidados, overrides, tatica }) {
  const ov = overrides || {};
  const lugares = [...(TATICAS[tatica] || TATICAS[TATICA_OMISSAO]), LUGAR_FORA];

  const gente = [
    ...(players || [])
      .filter(p => (attendance || []).includes(p.id))
      // `camisola`: só os jogadores do Scouting (adversários) a têm — o
      // nosso plantel continua a aparecer só com o nome, como sempre.
      // O nome por que é conhecido no clube ("Nome no clube"), como no resto
      // da app; sem ele, o nome curto de sempre.
      .map(p => ({ chave: p.id, nome: String(p.alcunha || '').trim() || nomeCurtoNaPrancheta(p.name), pos: p.position || '', exp: false, numero: p.camisola || '' })),
    ...(convidados || []).map(c => ({
      chave: `c:${c.id}`, nome: nomeCurtoNaPrancheta(c.nome), pos: c.position || '', exp: true,
    })),
  ];

  const porLugar = new Map(lugares.map(l => [l.id, []]));
  const contador = {};

  gente.forEach(j => {
    let lugar = ov[j.chave];
    if (!lugar || !porLugar.has(lugar)) {
      /* Os lugares que aceitam esta posição, por ordem de preferência do
         lugar. Reparte-se entre eles em vez de os empilhar no primeiro. */
      const opcoes = lugares.filter(l => l.de.includes(j.pos));
      if (!opcoes.length) lugar = 'fora';
      else {
        const n = contador[j.pos] || 0;
        contador[j.pos] = n + 1;
        lugar = opcoes[n % opcoes.length].id;
      }
    }
    porLugar.get(lugar).push(j);
  });

  return lugares
    .map(l => ({ ...l, lista: porLugar.get(l.id) }))
    .filter(l => l.lista.length || l.id !== 'fora');
}

/* JOGADORES DO TREINO NO EDITOR DE EXERCÍCIOS.

   O editor do esquema tático (DiagramEditor) pode carregar os jogadores
   de uma sessão do Planeamento — os presentes, nos lugares do Quadro de
   posições dessa sessão (com o que o treinador arrumou à mão). Cada um
   entra como um jogador normal do editor (mexe-se, anima-se, apaga-se
   como os outros), com a posição no círculo e o NOME por baixo.

   As sessões e o plantel chegam por contexto (posto à volta do conteúdo
   da app), para não ter de passar props por todos os sítios onde o
   editor aparece. */
export const TreinosParaEditorCtx = React.createContext({ sessions: [], players: [], matches: [], epoca: '' });

// Sessões que interessam para carregar: de ontem para a frente, com gente.
export function sessoesParaCarregar(sessions) {
  const desde = addDays(todayStr(), -1);
  return (sessions || [])
    .filter(s => s && s.date && s.date >= desde && ((s.attendance || []).length || (s.convidados || []).length))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 8);
}

// Os elementos do editor para os presentes de uma sessão, nos lugares do quadro.
export function elementosDaSessao(sessao, players, equipa) {
  const lugares = distribuirPlantel({
    players, attendance: sessao.attendance, convidados: sessao.convidados,
    overrides: sessao.prancheta, tatica: sessao.pranchetaTatica,
  });
  const els = [];
  let foraI = 0;
  lugares.forEach(l => {
    const lista = l.lista || [];
    lista.forEach((j, i) => {
      let x; let y;
      if (l.id === 'fora') {
        // Sem lugar na táctica: em fila, junto à linha lateral de baixo.
        x = 12 + (foraI++) * 6; y = 73;
      } else {
        const [px, py] = l.ponto || [0.5, 0.5];
        x = 1 + px * 105;
        // Vários no mesmo lugar: lado a lado, ao longo da largura do campo.
        // A coluna inteira é empurrada para dentro do campo, para nenhum
        // jogador (nem o nome por baixo) ficar cortado na borda: o de cima
        // fica pelo menos a 3 m da linha e o de baixo deixa lugar ao nome.
        const PASSO = 5.2; const Y_MIN = 4; const Y_MAX = 65;
        const meio = 1 + py * 68;
        const altura = (lista.length - 1) * PASSO;
        let topo = meio - altura / 2;
        if (topo < Y_MIN) topo = Y_MIN;
        if (topo + altura > Y_MAX) topo = Math.max(Y_MIN, Y_MAX - altura);
        y = topo + i * PASSO;
      }
      const doPlantel = (players || []).find(pp => pp && pp.id === j.chave);
      els.push({
        id: uid(), kind: l.id === 'GR' ? 'keeper' : 'player', team: equipa || 'A',
        number: l.id === 'fora' ? (j.pos || '') : l.rotulo, nome: j.nome,
        // Número da camisola (para quando o esquema mostra "Nº"). Quem está
        // à experiência não tem número: fica com o círculo vazio.
        ...(j.exp ? { convidado: true, camisola: '' } : {}),
        ...(!j.exp && doPlantel && doPlantel.number != null && String(doPlantel.number).trim() !== '' ? { camisola: String(doPlantel.number).trim(), playerId: doPlantel.id } : {}),
        x: Math.max(-2, Math.min(107, x)), y: Math.max(-2, Math.min(76, y)),
      });
    });
  });
  return els;
}

/* CONVOCADOS DO JOGO → campo (plano de jogo de um jogo específico).
   Titulares nos lugares da formação do jogo (com o alinhamento escolhido
   à mão, se houver; sem onze definido, os convocados arrumados pela
   posição de cada um). Suplentes numa fila fora do campo, junto aos
   bancos. Cada um leva o número da camisola e o nome. */
export function nomeNoIcone(p) {
  const alc = String((p && p.alcunha) || '').trim();
  return alc || nomeCurtoNaPrancheta((p && p.name) || '');
}

export function elementosDoJogo(match, players, equipa) {
  if (!match) return [];
  const porId = new Map((players || []).filter(Boolean).map(p => [p.id, p]));
  const convocados = (match.convocados || []).map(id => porId.get(id)).filter(Boolean);
  const titIds = Array.isArray(match.starters) && match.starters.length ? match.starters : null;
  const titulares = titIds ? titIds.map(id => porId.get(id)).filter(Boolean) : convocados;
  const formacao = FORMACOES[match.formacao] ? match.formacao : '4-3-3';
  const { lugares, colocados, sobram } = distribuirOnzeNoCampo(titulares, formacao, titIds ? match.alinhamento : null);
  const pontos = LAYOUT_FORMACAO[formacao] || [];
  const camisola = (p) => (p && p.number != null && String(p.number).trim() !== '' ? String(p.number).trim() : undefined);
  const els = [];
  const usados = new Set();
  colocados.forEach((p, i) => {
    if (!p) return;
    usados.add(p.id);
    const [px, py] = pontos[i] || [0.5, 0.5];
    const ehGR = lugares[i] === 'GR';
    els.push({
      id: uid(), kind: ehGR ? 'keeper' : 'player', team: equipa || 'A',
      number: ehGR ? 1 : lugares[i], camisola: camisola(p), nome: nomeNoIcone(p), playerId: p.id,
      x: 1 + px * 105, y: 1 + py * 68,
    });
  });
  // Suplentes: os convocados que não são titulares (e os que não couberam).
  const suplentes = [...convocados.filter(p => !usados.has(p.id) && !(titIds || []).includes(p.id)), ...(sobram || []).filter(p => !usados.has(p.id))];
  const vistos = new Set();
  // Em fila, centrada por baixo da linha lateral, na zona dos bancos.
  const lista = suplentes.filter(p => (vistos.has(p.id) ? false : (vistos.add(p.id), true)));
  const POR_FILA = 16; const PASSO = 6;
  lista.forEach((p, i) => {
    const ehGR = String(p.position || '').toUpperCase() === 'GR';
    const fila = Math.floor(i / POR_FILA);
    const naFila = Math.min(POR_FILA, lista.length - fila * POR_FILA);
    const j = i % POR_FILA;
    els.push({
      id: uid(), kind: ehGR ? 'keeper' : 'player', team: equipa || 'A', suplente: true,
      number: ehGR ? 1 : (p.position || ''), camisola: camisola(p), nome: nomeNoIcone(p), playerId: p.id,
      x: 53.5 + (j - (naFila - 1) / 2) * PASSO, y: 74.2 + fila * 4.4,
    });
  });
  return els;
}

