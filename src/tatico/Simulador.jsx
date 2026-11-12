// tatico/Simulador.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, body, mono, T_ESCURO, TEXT_ON_ACCENT, display } from '../base/tema';
import { useIsMobile, SectionHeader, Btn, Input, Select, Field, FIELD_GRID, FIELD_FULL, EmptyState, Modal, trocarJanela } from '../base/ui';
import { useState, useEffect, useRef } from 'react';
import { todayStr, uid, fmtDate } from '../base/utilidades';
import { UserCheck, Plus, X, ChevronLeft, ChevronRight, Undo2, Pencil, ArrowRight, RotateCw, Check, Trash2 } from 'lucide-react';
import { elementLabel, parsePlayersCount, teamInfo } from './campo';
import { useArrastarParaTrocar } from '../base/arrastar';
import { POSITIONS, PlayerChipList, convidadosDe, firstNameOf, shortPlayerName, sortByPosition } from '../dominio/jogadores';
import { isFriendlyMatch, jogoRealDaSessao } from '../dominio/jogos';
import { momentoTexto, momentosDe, temMomento } from '../dominio/treino';
import { estadoClinicoEm } from '../dominio/clinico';

/* ================================================================
   SIMULADOR

   Duas coisas diferentes com o mesmo problema por baixo — repartir tempo
   de jogo com justiça:

   · TREINO — vários exercícios, possivelmente vários em simultâneo (o
     campo dividido em secções), com rotação para ninguém ficar parado.
   · JOGO AMIGÁVEL — o onze por períodos, com substituições ao intervalo,
     para todos jogarem e cada um no seu lugar.

   Em ambos manda a mesma regra: entra primeiro quem tem menos minutos
   acumulados; entre iguais, sorteio. É isso que garante que dois treinos
   seguidos não dão a mesma distribuição.
================================================================ */

// Baralha uma lista (Fisher-Yates). Não mexe na original.
export function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ----------------------------------------------------------------
   POSIÇÕES

   Um guarda-redes não é um jogador de campo. Nunca ocupa um lugar de
   linha, mesmo que sobrem vagas: pô-lo lá dava-lhe minutos que não são
   treino dele, e tirava-os a quem devia estar ali.
---------------------------------------------------------------- */
export const ehGuardaRedes = (p) => p && p.position === 'GR';

// Famílias de posições, para uma substituição respeitar o lugar.
export const FAMILIA = {
  GR: 'GR',
  DC: 'DEF', DE: 'DEF', DD: 'DEF',
  MD: 'MEIO', MC: 'MEIO', MOC: 'MEIO',
  EE: 'ATA', ED: 'ATA', PL: 'ATA',
  // 'EX' é o que a PRANCHETA escreve nos ícones 9 e 10 (extremo, sem
  // dizer de que lado). O PLANTEL usa EE e ED. Sem esta entrada, um
  // extremo desenhado no exercício não encontrava família nenhuma e
  // qualquer jogador levava a penalização máxima — era por isso que
  // apareciam extremos onde o desenho não os pedia.
  EX: 'ATA',
  // 'MO' é o que a PRANCHETA escreve no ícone 8 (médio ofensivo). O
  // PLANTEL usa MOC. Mesma razão do EX: sem esta entrada o lugar ficava
  // sem família e toda a gente levava a penalização máxima.
  MO: 'MEIO',
  // AD e AE são os corredores. A família de referência é MEIO (um médio
  // de ala), mas ver LUGARES_DE_ALA: um lateral ou um extremo também lá
  // jogam, e `posicaoServe` trata-os como lugar próprio.
  AD: 'MEIO', AE: 'MEIO',
};

/* OS ALAS NÃO TÊM UMA FAMÍLIA SÓ.

   Num 3-5-2 ou num 3-4-3 quem joga no corredor tanto pode ser um lateral
   (DEF) como um extremo (ATA); num 4-4-2 é um médio de ala (MEIO). São
   os únicos lugares do campo em que as três famílias servem. Fechá-los
   numa família deixava o corredor EM BRANCO sempre que faltasse gente
   dessa etiqueta — e o que falta num corredor é um jogador, não uma
   etiqueta. */
export const LUGARES_DE_ALA = new Set(['AD', 'AE']);

/* O lugar pedido pelo desenho corresponde a este jogador?

   'EX' vale por EE e ED: na prancheta o ícone não distingue o lado, e
   exigir o lado exato faria falhar todos os extremos.

   'MO' vale por MOC: é o mesmo jogador com dois nomes — a prancheta
   escreve MO no ícone 8, o plantel regista MOC.

   'AD' e 'AE' valem pelo lateral E pelo extremo do mesmo lado: é o que
   um ala é. Quem está registado como DD ou ED joga no corredor direito
   sem se estar a inventar nada. */
export function posicaoServe(pedida, jogador) {
  if (!pedida || !jogador) return false;
  if (jogador.position === pedida) return true;
  if (pedida === 'EX') return jogador.position === 'EE' || jogador.position === 'ED';
  if (pedida === 'MO') return jogador.position === 'MOC';
  if (pedida === 'AD') return jogador.position === 'DD' || jogador.position === 'ED';
  if (pedida === 'AE') return jogador.position === 'DE' || jogador.position === 'EE';
  return false;
}

export const familiaDe = (p) => FAMILIA[p && p.position] || 'MEIO';

/* Ordem de entrada: quem tem menos minutos primeiro; entre iguais, sorteio.
   O baralhar ANTES da ordenação é o que dá a aleatoriedade — o sort é
   estável, por isso empates mantêm a ordem baralhada. */
export function filaPorMinutos(jogadores, minutos) {
  return shuffled(jogadores).sort((a, b) => (minutos.get(a.id) || 0) - (minutos.get(b.id) || 0));
}

/* ----------------------------------------------------------------
   TREINO

   `exerciciosEscolhidos`: [{ exercise, minutos, maxSimultaneo, grupo }]

   - `maxSimultaneo`: quantas cópias do MESMO exercício podem decorrer ao
     mesmo tempo (o campo dividido em secções). O treinador dá o máximo;
     o motor escolhe quantas usar.
   - `grupo`: exercícios com o mesmo rótulo decorrem em simultâneo, e
     portanto partilham os jogadores disponíveis nesse período.
---------------------------------------------------------------- */
/* AS POSIÇÕES DESENHADAS NO EXERCÍCIO MANDAM.

   O esquema tático de um exercício não é decoração: se o treinador
   desenhou um EE, um MC e dois DC numa equipa, é isso que quer ver em
   campo. Até aqui a distribuição olhava só para o NÚMERO de vagas
   ("8x8") e enchia-as por ordem de minutos, o que dava três extremos
   esquerdos num exercício com um só.

   Aqui lê-se o desenho e extrai-se, por equipa, a lista de posições
   pedidas. `elementLabel` converte o número do ícone na posição (2 → DD,
   3 → DC, …), que é a mesma convenção com que os jogadores estão
   registados no plantel.

   Se o exercício não tiver desenho, ou tiver menos ícones do que vagas,
   as vagas restantes ficam sem posição pedida e são preenchidas como
   antes — por minutos. */
export function posicoesDesenhadas(exercise) {
  const els = (exercise && exercise.diagram && exercise.diagram.elements) || [];
  const porEquipa = new Map();
  els.forEach(el => {
    if (el.kind !== 'player' && el.kind !== 'keeper') return;
    const chave = `${el.team || 'A'}|${el.kind === 'keeper'}`;
    if (!porEquipa.has(chave)) porEquipa.set(chave, []);
    porEquipa.get(chave).push(elementLabel(el.number, el.kind === 'keeper'));
  });
  return porEquipa;
}

export function slotsDoExercicio(exercise, totalPresentes) {
  const parsed = parsePlayersCount(exercise.playersCount);
  const desenhadas = posicoesDesenhadas(exercise);
  const usadas = new Map();
  const comPosicoes = (g) => {
    const chave = `${g.team}|${!!g.isKeeper}`;
    const lista = desenhadas.get(chave) || [];
    const ja = usadas.get(chave) || 0;
    usadas.set(chave, ja + g.count);
    return { ...g, posicoes: lista.slice(ja, ja + g.count) };
  };
  if (!parsed) return [comPosicoes({ team: 'A', isKeeper: false, count: totalPresentes })];
  return parsed.groups.map(comPosicoes);
}

export const vagasPorCopia = (grupos) => grupos.reduce((a, g) => a + g.count, 0);

/* Quantas cópias usar de cada exercício de um bloco.

   Objetivo: aproximar o total de vagas do número de presentes. Menos
   vagas deixa gente parada; mais vagas do que gente deixa exercícios
   incompletos. Cresce-se à vez, exercício a exercício, para nenhum ficar
   com todas as cópias enquanto outro fica sem nenhuma. */
export function copiasOtimas(itens, nPresentes) {
  const copias = itens.map(() => 1);
  const vagas = itens.map(it => vagasPorCopia(it.grupos));
  const total = () => copias.reduce((a, c, i) => a + c * vagas[i], 0);
  let mexeu = true;
  while (mexeu) {
    mexeu = false;
    for (let i = 0; i < itens.length; i++) {
      if (copias[i] >= itens[i].maxSimultaneo) continue;
      if (total() + vagas[i] > nPresentes) continue;
      copias[i] += 1;
      mexeu = true;
    }
  }
  return copias;
}

/* Agrupa os exercícios em blocos que decorrem ao mesmo tempo. */
export function blocosDeTreino(exerciciosEscolhidos) {
  const blocos = [];
  const porGrupo = new Map();
  exerciciosEscolhidos.forEach((e, i) => {
    const chave = e.grupo ? `g:${e.grupo}` : `s:${i}`;
    if (!porGrupo.has(chave)) {
      porGrupo.set(chave, { chave, itens: [] });
      blocos.push(porGrupo.get(chave));
    }
    porGrupo.get(chave).itens.push(e);
  });
  return blocos;
}

/* Preenche um conjunto de vagas a partir da fila, respeitando o lugar. */
export function preencher(grupos, fila, usados, minutos, jaJogaram) {
  const gr = fila.filter(ehGuardaRedes);
  const linha = fila.filter(p => !ehGuardaRedes(p));

  /* Escolhe para um lugar com posição pedida.

     Mesma regra do jogo amigável: mandam os MINUTOS, e a posição entra
     como penalização. Se a posição mandasse, quem é o único da sua
     posição fazia o exercício todo e quem tem concorrência ficava
     parado — o oposto do que a rotação existe para garantir.

     Penalizações menores do que no jogo (4 e 20 em vez de 8 e 40) porque
     num treino os lugares são menos rígidos: o que interessa é não pôr
     três extremos onde só há um, não recriar o onze. */
  const escolherPara = (lista, posicaoPedida) => {
    const livres = lista.filter(p => !usados.has(p.id));
    if (!livres.length) return null;
    if (!posicaoPedida) {
      // Sem posição pedida, a fila já vem ordenada por minutos — mas quem
      // já jogou neste exercício vai para o fim na mesma.
      const frescos = jaJogaram ? livres.filter(p => !jaJogaram.has(p.id)) : livres;
      return (frescos.length ? frescos : livres)[0];
    }
    const familiaPedida = FAMILIA[posicaoPedida] || 'MEIO';
    /* QUEM JÁ FEZ ESTE EXERCÍCIO SÓ VOLTA SE NÃO HOUVER MAIS NINGUÉM.

       A penalização de posição chega a 20, e um turno inteiro vale 20
       minutos: um jogador que descansou mas está fora da posição empatava
       com um que acabou de jogar na posição certa. Nos empates ganhava o
       primeiro da lista, e havia gente a fazer os dois turnos seguidos
       enquanto outros ficavam de fora nos dois.

       Com 500, nenhuma preferência de posição chega perto — quem
       descansou entra sempre primeiro, e a posição só decide DENTRO de
       cada grupo. É o "entram dez e saem dez" a ficar garantido em vez de
       depender dos números. */
    const nota = (p) => {
      const base = (minutos.get(p.id) || 0) + (jaJogaram && jaJogaram.has(p.id) ? 500 : 0);
      if (posicaoServe(posicaoPedida, p)) return base;
      if (familiaDe(p) === familiaPedida) return base + 4;
      return base + 20;
    };
    return livres.reduce((melhor, p) => (nota(p) < nota(melhor) ? p : melhor), livres[0]);
  };

  const tirar = (lista, g) => {
    const out = [];
    for (let k = 0; k < g.count; k++) {
      const escolhido = escolherPara(lista, (g.posicoes || [])[k]);
      if (!escolhido) break;
      usados.add(escolhido.id);
      out.push(escolhido);
    }
    return out;
  };

  const porIndice = new Map();
  // Guarda-redes primeiro: são o lugar mais específico.
  grupos.forEach((g, i) => { if (g.isKeeper) porIndice.set(i, tirar(gr, g)); });
  // Lugares de campo: SÓ jogadores de campo. Se faltarem, a vaga fica vazia.
  grupos.forEach((g, i) => { if (!g.isKeeper) porIndice.set(i, tirar(linha, g)); });
  return grupos.map((g, i) => ({
    team: g.team, isKeeper: g.isKeeper, vagas: g.count, posicoes: g.posicoes || [],
    jogadores: porIndice.get(i) || [],
  }));
}

export function distribuirTreino(exerciciosEscolhidos, presentes, opcoes = {}) {
  const { substituirAMeio = true } = opcoes;
  const minutos = new Map(presentes.map(p => [p.id, 0]));
  const plano = [];

  blocosDeTreino(exerciciosEscolhidos).forEach(bloco => {
    const itens = bloco.itens.map(e => ({
      ...e,
      grupos: slotsDoExercicio(e.exercise, presentes.length),
      maxSimultaneo: Math.max(1, Math.min(6, e.maxSimultaneo || 1)),
    }));
    const copias = copiasOtimas(itens, presentes.length);

    // Metades: com mais gente do que vagas, troca-se a meio do exercício
    // para os minutos ficarem repartidos em vez de uns fazerem tudo.
    const vagasBloco = itens.reduce((a, it, i) => a + copias[i] * vagasPorCopia(it.grupos), 0);
    const metades = substituirAMeio && presentes.length > vagasBloco ? 2 : 1;

    const partes = [];
    /* Por exercício e não por bloco: em turnos com dois exercícios em
       simultâneo, quem fez o A no turno 1 pode e deve fazer o B no turno
       2 — o que não pode é repetir o mesmo. */
    const jaJogaramPorExercicio = new Map();
    for (let m = 0; m < metades; m++) {
      const usados = new Set();
      const fila = filaPorMinutos(presentes, minutos);
      const duracaoParte = Math.round(Math.max(...itens.map(it => it.minutos)) / metades);

      const exerciciosDaParte = [];
      itens.forEach((it, i) => {
        for (let c = 0; c < copias[i]; c++) {
          if (!jaJogaramPorExercicio.has(it.exercise.id)) jaJogaramPorExercicio.set(it.exercise.id, new Set());
          const jaJogaram = jaJogaramPorExercicio.get(it.exercise.id);
          const equipas = preencher(it.grupos, fila, usados, minutos, jaJogaram);
          equipas.forEach(eq => eq.jogadores.forEach(p => jaJogaram.add(p.id)));
          equipas.forEach(eq => eq.jogadores.forEach(p => minutos.set(p.id, (minutos.get(p.id) || 0) + duracaoParte)));
          exerciciosDaParte.push({
            exercise: it.exercise,
            copia: c + 1,
            totalCopias: copias[i],
            equipas,
            vagasTotais: vagasPorCopia(it.grupos),
          });
        }
      });

      partes.push({
        minutos: duracaoParte,
        exercicios: exerciciosDaParte,
        descanso: presentes.filter(p => !usados.has(p.id)),
      });
    }

    plano.push({
      chave: bloco.chave,
      simultaneo: itens.length > 1,
      minutos: Math.max(...itens.map(it => it.minutos)),
      partes,
    });
  });

  return { plano, minutosPorJogador: minutos };
}

/* ----------------------------------------------------------------
   JOGO AMIGÁVEL

   Não há limite de substituições, mas fazê-las a meio de um período
   interrompe o jogo — por isso as trocas são feitas no início de cada
   período e ao intervalo, que é como se faz na prática.
---------------------------------------------------------------- */
export const FORMATOS_JOGO = [
  { id: '2x45', label: '2 partes de 45 min', partes: 2, minutos: 45 },
  { id: '3x30', label: '3 partes de 30 min', partes: 3, minutos: 30 },
];

/* Os corredores chamam-se AD e AE em TODAS as formações, tal como no
   quadro de posições. Antes o mesmo lugar tinha três nomes conforme a
   formação — ED/EE no 4-4-2 e no 3-4-3, MD/ME no 3-5-2 — e ficava por
   perceber se era um extremo, um médio ou um lateral. É sempre a mesma
   coisa: quem faz o corredor.

   ED, EE e MOC CONTINUAM AQUI DE PROPÓSITO, e são ESCRITOS como EX e MO
   (ver `rotuloDoLugar`, logo abaixo). O quadro não distingue o lado de
   um extremo, mas o preenchimento automático precisa de o distinguir:
   se os dois lugares de ala se chamassem os dois 'EX', o primeiro a ser
   preenchido levava o primeiro extremo da lista — e o extremo esquerdo
   ia parar à direita. Guardar o lado e escrever a sigla curta dá as duas
   coisas ao mesmo tempo. */
export const FORMACOES = {
  '4-3-3': ['GR', 'DD', 'DC', 'DC', 'DE', 'MD', 'MC', 'MC', 'ED', 'PL', 'EE'],
  '4-4-2': ['GR', 'DD', 'DC', 'DC', 'DE', 'AD', 'MC', 'MC', 'AE', 'PL', 'PL'],
  '4-2-3-1': ['GR', 'DD', 'DC', 'DC', 'DE', 'MC', 'MC', 'ED', 'MOC', 'EE', 'PL'],
  '3-4-3': ['GR', 'DC', 'DC', 'DC', 'AD', 'MC', 'MC', 'AE', 'ED', 'PL', 'EE'],
  '3-5-2': ['GR', 'DC', 'DC', 'DC', 'AD', 'MC', 'MD', 'MC', 'AE', 'PL', 'PL'],

  // Jogo de 9. Mesmas siglas, menos lugares.
  '3-2-3': ['GR', 'DD', 'DC', 'DE', 'MC', 'MC', 'ED', 'PL', 'EE'],
  '3-3-2': ['GR', 'DD', 'DC', 'DE', 'MC', 'MC', 'MC', 'PL', 'PL'],
  '2-3-3': ['GR', 'DD', 'DE', 'MC', 'MC', 'MC', 'ED', 'PL', 'EE'],

  // Jogo de 7.
  '3-2-1': ['GR', 'DD', 'DC', 'DE', 'MC', 'MC', 'PL'],
  '2-3-1': ['GR', 'DD', 'DE', 'MC', 'MC', 'MC', 'PL'],
  '2-2-2': ['GR', 'DD', 'DE', 'MC', 'MC', 'PL', 'PL'],
};

/* O QUE SE ESCREVE NO LUGAR, que nem sempre é o nome do lugar.

   O onze do jogo passa a falar a mesma língua do quadro de posições: EX
   para extremo (sem dizer o lado) e MO para médio ofensivo. Por baixo, o
   lugar continua a chamar-se ED, EE ou MOC, que é o que faz o jogador
   certo cair no sítio certo (ver a nota em FORMACOES). */
export const ROTULO_DO_LUGAR = { ED: 'EX', EE: 'EX', MOC: 'MO' };

export const rotuloDoLugar = (lugar) => ROTULO_DO_LUGAR[lugar] || lugar || '';

/* NEM TODO O JOGO É DE ONZE.

   Um amigável de formação joga-se muitas vezes a 9 ou a 7 — porque
   apareceram poucos, porque o campo é pequeno, ou porque é isso que o
   escalão do adversário joga. Até aqui o simulador só sabia fazer onzes,
   e num jogo de 9 sobravam dois lugares vazios em campo.

   O TAMANHO NÃO É UM CAMPO À PARTE: é o número de lugares da própria
   formação. Guardá-lo duas vezes (uma na lista, outra num campo
   `tamanho`) era garantir que um dia ficavam diferentes. */
export const tamanhoDaFormacao = (nome) => (FORMACOES[nome] || []).length;

export const TAMANHOS_DE_EQUIPA = [...new Set(Object.keys(FORMACOES).map(tamanhoDaFormacao))].sort((a, b) => b - a);

export const formacoesDe = (tamanho) => Object.keys(FORMACOES).filter(f => tamanhoDaFormacao(f) === tamanho);

/* Escolhe o melhor jogador livre para um lugar.

   ATENÇÃO à ordem das prioridades — foi aqui que a primeira versão falhou.
   Se a posição exata mandar sobre os minutos, quem é o ÚNICO da sua
   posição joga o jogo inteiro e quem tem concorrência fica a zero. Num
   plantel real isso acontece sempre: há um só MD e quatro MC, e o
   resultado era MD com 90 minutos e um MC com nenhum.

   Por isso mandam os MINUTOS, e a posição entra como penalização:

     nota = minutos já jogados
          + 0   se for a posição exata
          + 8   se for outra posição da mesma família (um MC a jogar MD)
          + 40  se for de outra família (um defesa a jogar avançado)

   Com os períodos a valerem 30 ou 45 minutos, a penalização de família
   deixa um jogador fresco entrar num lugar vizinho em vez de um cansado
   repetir; já a de 40 só se aceita quando não há mesmo alternativa.

   Um guarda-redes só entra num lugar de guarda-redes — nunca na linha,
   por muito desequilibrados que fiquem os minutos. */
export const PENAL_FAMILIA = 8;

export const PENAL_FORA = 40;

export function escolherParaLugar(lugar, fila, usados, minutos) {
  const eGR = lugar === 'GR';
  const candidatos = fila.filter(p => !usados.has(p.id) && (eGR ? ehGuardaRedes(p) : !ehGuardaRedes(p)));
  if (!candidatos.length) return null;
  const familiaLugar = FAMILIA[lugar] || 'MEIO';
  const nota = (p) => {
    const base = minutos.get(p.id) || 0;
    // `posicaoServe` e não `p.position === lugar`: sem isto um DD ou um ED
    // colocado num corredor (AD/AE) levava penalização como se estivesse
    // fora de posição, quando é exatamente ali que joga.
    if (posicaoServe(lugar, p)) return base;
    if (familiaDe(p) === familiaLugar) return base + PENAL_FAMILIA;
    return base + PENAL_FORA;
  };
  // `fila` já vem baralhada e ordenada por minutos, por isso empates na
  // nota resolvem-se por sorteio em vez de dar sempre ao mesmo.
  return candidatos.reduce((melhor, p) => (nota(p) < nota(melhor) ? p : melhor), candidatos[0]);
}

export function distribuirAmigavel(presentes, opcoes = {}) {
  const formatoId = opcoes.formato || '2x45';
  const formacaoId = opcoes.formacao || '4-3-3';
  /* JANELAS DE SUBSTITUIÇÃO

     Uma parte de 45 minutos com 11 lugares dá 11 lugares — e num plantel
     de 25 há sempre quem fique a zero, por muito bem ordenada que esteja
     a fila. Não é um problema de algoritmo, é de aritmética: não há
     lugares que cheguem.

     A solução é a que se usa num amigável a sério: mais paragens. Cada
     parte divide-se em janelas iguais e as trocas fazem-se no fim de cada
     uma. Com 3 janelas numa parte de 45, são 15 minutos cada e o número de
     lugares triplica.

     `janelas = 1` mantém o comportamento clássico (trocas só ao
     intervalo). */
  /* `janelas: 'auto'` (o valor por omissão) calcula o mínimo necessário
     para NINGUÉM ficar a zero minutos.

     A conta tem de separar guarda-redes de jogadores de campo, porque os
     lugares NÃO são intermutáveis: um guarda-redes nunca ocupa um lugar de
     linha (ver escolherParaLugar). Contar 11 lugares para toda a gente
     dava contas erradas — com 22 presentes e só 2 guarda-redes, os 20 de
     campo não cabem nos 20 lugares... mas com 3 guarda-redes já sobra um
     de campo sem sítio.

     Por isso calcula-se o número de janelas que cada grupo precisa e fica
     o maior dos dois:
       · campo:         partes × janelas × 10 >= jogadores de campo
       · guarda-redes:  partes × janelas ×  1 >= guarda-redes

     Um número escolhido à mão é respeitado tal e qual — o treinador pode
     querer menos paragens e aceitar que alguém não entre. */
  const formatoBase = FORMATOS_JOGO.find(f => f.id === formatoId) || FORMATOS_JOGO[0];
  const lugaresBase = FORMACOES[formacaoId] || FORMACOES['4-3-3'];
  const lugaresGR = lugaresBase.filter(l => l === 'GR').length || 1;
  const lugaresCampo = lugaresBase.length - lugaresGR;
  const nGR = presentes.filter(ehGuardaRedes).length;
  const nCampo = presentes.length - nGR;
  const janelas = opcoes.janelas && opcoes.janelas !== 'auto'
    ? Math.max(1, Math.min(4, opcoes.janelas))
    : Math.max(1, Math.min(4, Math.max(
        Math.ceil(nCampo / (formatoBase.partes * lugaresCampo)),
        Math.ceil(nGR / (formatoBase.partes * lugaresGR)),
      )));
  const formato = FORMATOS_JOGO.find(f => f.id === formatoId) || FORMATOS_JOGO[0];
  const lugares = FORMACOES[formacaoId] || FORMACOES['4-3-3'];

  const minutos = new Map(presentes.map(p => [p.id, 0]));
  const periodos = [];
  const minutosJanela = Math.round(formato.minutos / janelas);

  for (let parte = 0; parte < formato.partes; parte++) {
    for (let jan = 0; jan < janelas; jan++) {
      const usados = new Set();
      const fila = filaPorMinutos(presentes, minutos);
      /* O PONTO DO CAMPO VIAJA COM O LUGAR, e não fica só implícito no
         índice da lista. É o que permite juntar ou tirar um lugar à mão
         depois (ver o Simulador) sem que todos os outros saltem de
         sítio: um lugar acrescentado no fim da lista tem de poder ficar
         desenhado no meio do campo. */
      const desenho = LAYOUT_FORMACAO[formacaoId] || [];
      const onze = lugares.map((lugar, li) => {
        const escolhido = escolherParaLugar(lugar, fila, usados, minutos);
        if (escolhido) usados.add(escolhido.id);
        return { lugar, ponto: desenho[li] || null, jogador: escolhido || null };
      });
      onze.forEach(l => { if (l.jogador) minutos.set(l.jogador.id, (minutos.get(l.jogador.id) || 0) + minutosJanela); });
      periodos.push({
        numero: parte + 1,
        janela: jan + 1,
        totalJanelas: janelas,
        minutos: minutosJanela,
        onze,
        suplentes: presentes.filter(p => !usados.has(p.id)),
      });
    }
  }

  /* Rede final: se mesmo assim alguém ficou a zero, entra à força.

     Acontece com posições muito específicas — um guarda-redes a mais, por
     exemplo, quando só há um lugar de baliza e poucas janelas. Nesse caso
     troca-se pelo jogador do mesmo lugar com MAIS minutos, na janela em
     que ele mais tem. É preferível um desequilíbrio pequeno entre dois do
     que alguém vir ao jogo e não jogar. */
  const semMinutos = presentes.filter(p => (minutos.get(p.id) || 0) === 0);
  semMinutos.forEach(p => {
    let melhor = null;
    periodos.forEach((per, pi) => {
      per.onze.forEach((l, li) => {
        if (!l.jogador) { melhor = melhor || { pi, li, ganho: Infinity }; return; }
        const compativel = ehGuardaRedes(p) === ehGuardaRedes(l.jogador);
        if (!compativel) return;
        const m = minutos.get(l.jogador.id) || 0;
        if (m <= minutosJanela) return; // não se tira a quem também tem pouco
        if (!melhor || m > melhor.ganho) melhor = { pi, li, ganho: m };
      });
    });
    if (!melhor) return;
    const per = periodos[melhor.pi];
    const sai = per.onze[melhor.li].jogador;
    per.onze[melhor.li] = { ...per.onze[melhor.li], jogador: p };
    if (sai) minutos.set(sai.id, (minutos.get(sai.id) || 0) - per.minutos);
    minutos.set(p.id, (minutos.get(p.id) || 0) + per.minutos);
    const emCampo = new Set(per.onze.map(l => l.jogador && l.jogador.id).filter(Boolean));
    per.suplentes = presentes.filter(x => !emCampo.has(x.id));
  });

  return { formato, formacao: formacaoId, janelas, periodos, minutosPorJogador: minutos };
}

/* Posições no campo, em fração da largura/altura, por formação.
   O campo é desenhado da esquerda (nossa baliza) para a direita. */
/* LADOS DO CAMPO

   Com o ataque para a direita, quem vê o campo de cima tem a ala DIREITA
   em baixo e a ESQUERDA em cima. Estava ao contrário: o DD e o ED
   apareciam do lado do DE e do EE.

   Cada linha destas segue a ordem dos lugares da formação (ver FORMACOES),
   por isso a coordenada tem de bater certo com o lugar que ocupa nessa
   lista — trocar um sem trocar o outro põe o jogador errado no sítio. */
/* Onde cada lugar fica desenhado no campo, em fração da largura/altura.

   Duas regras, ambas vindas do desenho do treinador sobre a prancheta:

   1. O lado DIREITO da equipa (DD, ED) fica EM BAIXO e o esquerdo em cima.
      É a leitura de quem está de fora a olhar para o campo com a nossa
      baliza à esquerda.

   2. MD é MÉDIO DEFENSIVO, não médio direito. Fica recuado e ao centro,
      com MC e MOC à frente dele e abertos — o triângulo clássico de um
      4-3-3. Tratá-lo como um lateral do meio-campo punha o trinco na
      linha dos interiores, que é outra equipa.

   A ordem tem de ser exatamente a de FORMACOES: cada posição aqui
   corresponde ao lugar com o mesmo índice. */
export const LAYOUT_FORMACAO = {
  //         GR            DD            DC            DC            DE
  '4-3-3': [
    [0.05, 0.50], [0.23, 0.84], [0.20, 0.62], [0.20, 0.38], [0.23, 0.16],
    //   MD (trinco)   MC            MC
    [0.38, 0.50], [0.53, 0.34], [0.53, 0.66],
    //   EX (dir.)     PL            EX (esq.)
    [0.74, 0.84], [0.86, 0.50], [0.74, 0.16],
  ],
  //         GR            DD            DC            DC            DE
  '4-4-2': [
    [0.05, 0.50], [0.23, 0.84], [0.20, 0.62], [0.20, 0.38], [0.23, 0.16],
    //   AD            MC            MC            AE
    [0.48, 0.86], [0.45, 0.60], [0.45, 0.40], [0.48, 0.14],
    //   PL            PL
    [0.84, 0.60], [0.84, 0.40],
  ],
  //         GR            DD            DC            DC            DE
  '4-2-3-1': [
    [0.05, 0.50], [0.23, 0.84], [0.20, 0.62], [0.20, 0.38], [0.23, 0.16],
    //   MC            MC
    [0.38, 0.60], [0.38, 0.40],
    //   EX (dir.)     MO            EX (esq.)
    [0.60, 0.82], [0.60, 0.50], [0.60, 0.18],
    //   PL
    [0.86, 0.50],
  ],
  //         GR            DC            DC            DC
  '3-4-3': [
    [0.05, 0.50], [0.20, 0.70], [0.18, 0.50], [0.20, 0.30],
    //   AD            MC            MC            AE
    [0.45, 0.88], [0.44, 0.62], [0.44, 0.38], [0.45, 0.12],
    //   EX (dir.)     PL            EX (esq.)
    [0.74, 0.80], [0.86, 0.50], [0.74, 0.20],
  ],
  //         GR            DC            DC            DC
  '3-5-2': [
    [0.05, 0.50], [0.20, 0.70], [0.18, 0.50], [0.20, 0.30],
    //   AD            MC            MD (trinco)   MC            AE
    // O trinco recua para trás dos interiores, como no quadro de posições:
    // três médios em linha não é um 3-5-2, é uma fila.
    [0.50, 0.90], [0.48, 0.62], [0.36, 0.50], [0.48, 0.38], [0.50, 0.10],
    //   PL            PL
    [0.84, 0.60], [0.84, 0.40],
  ],

  /* JOGO DE 9 — o campo é o mesmo, mas mais largo para cada um.

     Com menos gente, encostar tudo às linhas deixava o meio deserto. As
     linhas ficam mais juntas em largura e mais espalhadas em
     profundidade, que é como um campo de 9 se ocupa a sério. */
  //         GR            DD            DC            DE
  '3-2-3': [
    [0.05, 0.50], [0.22, 0.80], [0.18, 0.50], [0.22, 0.20],
    //   MC            MC
    [0.45, 0.64], [0.45, 0.36],
    //   EX (dir.)     PL            EX (esq.)
    [0.74, 0.82], [0.86, 0.50], [0.74, 0.18],
  ],
  //         GR            DD            DC            DE
  '3-3-2': [
    [0.05, 0.50], [0.22, 0.80], [0.18, 0.50], [0.22, 0.20],
    //   MC            MC            MC
    [0.50, 0.80], [0.44, 0.50], [0.50, 0.20],
    //   PL            PL
    [0.84, 0.62], [0.84, 0.38],
  ],
  //         GR            DD            DE
  '2-3-3': [
    [0.05, 0.50], [0.20, 0.68], [0.20, 0.32],
    //   MC            MC            MC
    [0.48, 0.76], [0.42, 0.50], [0.48, 0.24],
    //   EX (dir.)     PL            EX (esq.)
    [0.74, 0.82], [0.86, 0.50], [0.74, 0.18],
  ],

  // JOGO DE 7.
  //         GR            DD            DC            DE
  '3-2-1': [
    [0.06, 0.50], [0.24, 0.78], [0.19, 0.50], [0.24, 0.22],
    //   MC            MC
    [0.52, 0.64], [0.52, 0.36],
    //   PL
    [0.84, 0.50],
  ],
  //         GR            DD            DE
  '2-3-1': [
    [0.06, 0.50], [0.22, 0.70], [0.22, 0.30],
    //   MC            MC            MC
    [0.54, 0.78], [0.50, 0.50], [0.54, 0.22],
    //   PL
    [0.84, 0.50],
  ],
  //         GR            DD            DE
  '2-2-2': [
    [0.06, 0.50], [0.22, 0.70], [0.22, 0.30],
    //   MC            MC
    [0.50, 0.68], [0.50, 0.32],
    //   PL            PL
    [0.84, 0.64], [0.84, 0.36],
  ],
};

/* Prancheta do onze: nomes ao lado da posição, suplentes fora das quatro
   linhas. Cada lugar é clicável para trocar de jogador — a distribuição é
   uma sugestão, não uma imposição. */
export function PranchetaOnze({ periodo, formacao, onTrocar, onTrocarDireto }) {
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];
  const arrasto = useArrastarParaTrocar((origemStr, destinoStr) => {
    if (!onTrocarDireto) return;
    const origem = Number(origemStr), destino = Number(destinoStr);
    if (Number.isNaN(origem) || Number.isNaN(destino) || origem === destino) return;
    onTrocarDireto(origem, destino);
  });
  return (
    <div
      ref={arrasto.containerRef}
      onPointerMove={arrasto.onPointerMove}
      onPointerUp={arrasto.onPointerUp}
      onPointerCancel={arrasto.onPointerCancel}
      onClickCapture={arrasto.onClickCapture}
      style={{
      position: 'relative', width: '100%', aspectRatio: '105 / 68',
      background: '#1E3A24', border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden',
    }}>
      <svg viewBox="0 0 105 68" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect x="0.5" y="0.5" width="104" height="67" fill="none" stroke="#ffffff40" strokeWidth="0.4" />
        <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" stroke="#ffffff40" strokeWidth="0.4" />
        <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="#ffffff40" strokeWidth="0.4" />
        <rect x="0.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="#ffffff40" strokeWidth="0.4" />
        <rect x="88" y="13.84" width="16.5" height="40.32" fill="none" stroke="#ffffff40" strokeWidth="0.4" />
      </svg>

      {periodo.onze.map((l, i) => {
        const [fx, fy] = l.ponto || layout[i] || [0.5, 0.5];
        return (
          <button
            key={i}
            data-slot={i}
            onPointerDown={l.jogador ? arrasto.onPointerDown(String(i)) : undefined}
            onClick={() => onTrocar(i)}
            title={l.jogador ? `${rotuloDoLugar(l.lugar)} · ${l.jogador.name} — arrasta para trocar, ou toca para trocar de jogador` : `${rotuloDoLugar(l.lugar)} — por preencher`}
            style={{
              position: 'absolute', left: `${fx * 100}%`, top: `${fy * 100}%`,
              // Só translateX centra na horizontal — na vertical o ponto de
              // ancoragem é o centro do círculo (11px, metade dos 22px
              // dele), não do bloco todo (círculo + nome por baixo). Ver a
              // mesma explicação em FichaJogo.
              transform: 'translateX(-50%)', marginTop: -11, cursor: 'pointer', ...body,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', padding: 0, maxWidth: '20%',
              touchAction: 'none', ...arrasto.estiloArrasto(String(i)), ...arrasto.estiloAlvo(String(i)),
            }}
          >
            {/* Círculo com o número (ou o lugar, sem número) — o mesmo
                desenho da Ficha de Jogo, e é o que se arrasta para trocar
                de lugar. */}
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%', ...mono, fontSize: 10.5,
              background: l.jogador ? T.corEquipa : '#00000055',
              color: l.jogador ? '#fff' : T_ESCURO.mutedDim,
              border: `1px solid ${l.jogador ? T.corEquipa : T_ESCURO.line}`,
            }}>{l.jogador ? (l.jogador.number || rotuloDoLugar(l.lugar)) : rotuloDoLugar(l.lugar)}</span>
            {l.jogador && (
              <span style={{
                fontSize: 10.5, fontWeight: 600, color: TEXT_ON_ACCENT,
                lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>{firstNameOf(l.jogador.name)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* `diaInicial` chega preenchido quando o Simulador é aberto do cartão de
   um dia no Planeamento, que passou a ser a única forma de lá chegar. */
export function Simulador({ players, exercises, sessions, setSessions, matches, setMatches, clinico, diaInicial }) {
  const isNarrow = useIsMobile(760);
  const [modo, setModo] = useState('treino'); // 'treino' | 'amigavel'
  const [presentIds, setPresentIds] = useState([]);
  const [escolhidos, setEscolhidos] = useState([]); // [{ id, minutos, maxSimultaneo, grupo }]
  const [filtroFase, setFiltroFase] = useState('Todas');
  const [substituirAMeio, setSubstituirAMeio] = useState(true);
  const [formato, setFormato] = useState('2x45');
  const [formacao, setFormacao] = useState('4-3-3');
  // Derivado, nunca guardado: 11, 9 ou 7 é quantos lugares a formação tem.
  const tamanhoEquipa = tamanhoDaFormacao(formacao) || 11;
  // 'auto' calcula o mínimo de paragens para ninguém ficar sem jogar.
  const [janelas, setJanelas] = useState('auto');
  const [dia, setDia] = useState(diaInicial || todayStr());
  // Qual amigável agendado se está a simular — só existe em modo 'amigavel'.
  // Sem isto, `dia` ficava na data de hoje por omissão e o "Guardar" não
  // encontrava sessão nenhuma nesse dia (a não ser que o jogo fosse mesmo
  // hoje): parecia gravar, mas não ia parar a lado nenhum.
  const [jogoAgendadoId, setJogoAgendadoId] = useState('');
  const [planoBase, setPlanoBase] = useState(null);
  const [jogo, setJogo] = useState(null);
  const [trocar, setTrocar] = useState(null); // { periodo, indice }

  /* EQUIPAS FIXADAS À MÃO

     A distribuição é uma sugestão. Quando o treinador arruma uma equipa
     como quer, essa escolha passa a mandar: fica guardada aqui por
     exercício e por equipa, e o "Baralhar de novo" respeita-a — baralha
     tudo o resto à volta.

     A chave inclui a cópia (zona do campo) e o turno, porque o mesmo
     exercício pode decorrer em três sítios ao mesmo tempo e cada um tem a
     sua equipa. */
  const [equipasFixas, setEquipasFixas] = useState({});
  const [editarEquipa, setEditarEquipa] = useState(null);
  const chaveEquipa = (bi, pi, xi, k) => `${bi}|${pi}|${xi}|${k}`;

  /* TROCAS — "este sai, este entra", definidas já com as equipas
     verdadeiras à vista (depois de "Distribuir"), nunca antes. A chave é
     ao nível do EXERCÍCIO dentro do turno (sem o `k` da equipa, que é só
     para `equipasFixas`) — o mesmo exercício pode ter turnos diferentes,
     com jogadores diferentes em cada, por isso as trocas também têm de
     ser por turno, não só por exercício. */
  const [trocasPorOcorrencia, setTrocasPorOcorrencia] = useState({});
  const chaveOcorrencia = (bi, pi, xi) => `${bi}|${pi}|${xi}`;
  const chavePeriodo = (pi) => `amigavel|${pi}`;
  const [editarTrocas, setEditarTrocas] = useState(null);

  const fixarEquipa = (chave, ids) => setEquipasFixas(prev => ({ ...prev, [chave]: ids }));
  const soltarEquipa = (chave) => setEquipasFixas(prev => {
    const next = { ...prev };
    delete next[chave];
    return next;
  });

  /* Aplica as equipas fixadas por cima do plano gerado.

     Feito DEPOIS da distribuição e não durante: assim o algoritmo continua
     simples (não tem de conhecer exceções) e as equipas fixadas nunca são
     desfeitas por ele. Quem estava fixado sai de onde quer que o
     algoritmo o tenha posto, para não aparecer em dois sítios ao mesmo
     tempo. */
  const aplicarFixas = (resultado, fixas = equipasFixas) => {
    if (!resultado || !Object.keys(fixas).length) return resultado;
    const porId = new Map(presentes.map(x => [x.id, x]));
    const plano = resultado.plano.map((bloco, bi) => ({
      ...bloco,
      partes: bloco.partes.map((parte, pi) => {
        const exercicios = parte.exercicios.map((ex, xi) => ({
          ...ex,
          equipas: ex.equipas.map((eq, k) => {
            const ids = fixas[chaveEquipa(bi, pi, xi, k)];
            if (!ids) return eq;
            return { ...eq, fixa: true, jogadores: ids.map(id => porId.get(id)).filter(Boolean) };
          }),
        }));
        // Quem foi fixado numa equipa sai de todas as outras deste momento.
        const fixados = new Set(exercicios.flatMap((ex, xi) => ex.equipas.flatMap((eq, k) => (
          fixas[chaveEquipa(bi, pi, xi, k)] ? eq.jogadores.map(j => j.id) : []
        ))));
        const limpos = exercicios.map((ex, xi) => ({
          ...ex,
          equipas: ex.equipas.map((eq, k) => (
            fixas[chaveEquipa(bi, pi, xi, k)]
              ? eq
              : { ...eq, jogadores: eq.jogadores.filter(j => !fixados.has(j.id)) }
          )),
        }));
        const emCampo = new Set(limpos.flatMap(ex => ex.equipas.flatMap(eq => eq.jogadores.map(j => j.id))));
        return { ...parte, exercicios: limpos, descanso: presentes.filter(x => !emCampo.has(x.id)) };
      }),
    }));

    // Os minutos são recontados sobre o plano já com as equipas fixadas.
    const minutos = new Map(presentes.map(x => [x.id, 0]));
    plano.forEach(bloco => bloco.partes.forEach(parte => parte.exercicios.forEach(ex => (
      ex.equipas.forEach(eq => eq.jogadores.forEach(j => minutos.set(j.id, (minutos.get(j.id) || 0) + parte.minutos)))
    ))));
    return { plano, minutosPorJogador: minutos };
  };

  /* JOGADORES À EXPERIÊNCIA

     Um miúdo que vem experimentar um treino tem de entrar na distribuição
     — ocupa um lugar, precisa de minutos, conta para o número de equipas.
     Mas NÃO pode entrar em mais nada: não é do plantel, não tem
     assiduidade, não conta para presenças nem para estatísticas.

     Por isso vivem SÓ aqui, neste estado local, e nunca são gravados. O
     simulador é o único sítio que os conhece; fechar o ecrã leva-os. É
     também o que torna esta funcionalidade segura: não há caminho nenhum
     por onde possam contaminar os dados da equipa. */
  const [convidados, setConvidados] = useState([]);
  const [novoNome, setNovoNome] = useState('');
  const [novaPos, setNovaPos] = useState('MC');

  const adicionarConvidado = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setConvidados(prev => [...prev, { id: `exp-${uid()}`, name: nome, position: novaPos, convidado: true }]);
    setNovoNome('');
  };
  const removerConvidado = (id) => setConvidados(prev => prev.filter(c => c.id !== id));

  const doPlantel = players.filter(p => presentIds.includes(p.id));
  const presentes = [...doPlantel, ...convidados];

  const treinoHoje = (sessions || []).filter(s => s.date === todayStr() && Array.isArray(s.attendance));
  const presencasHoje = Array.from(new Set(treinoHoje.flatMap(s => s.attendance)));

  const toggle = (p) => setPresentIds(prev => (
    prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
  ));

  /* MONTAR EQUIPAS À MÃO — ao ligar um exercício, pergunta-se primeiro se
     é para distribuir automaticamente (como sempre foi) ou se o
     treinador quer definir ele mesmo quantas equipas há e quantos
     jogadores em cada. A resposta só define a ESTRUTURA (nº de equipas e
     tamanhos) — compõe-se na mesma notação de sempre ("7x7x8"), e cai
     direto no campo "Nº de jogadores só neste treino" que já existe.
     Quem vai para cada equipa continua a decidir-se como sempre: pelo
     "Distribuir"/"Baralhar de novo", ou à mão, equipa a equipa, com o
     lápis que já existe (ver `editarEquipa` mais abaixo) — não faz
     sentido duplicar essa parte, que já funciona bem.

     TROCAS — isso é um passo à parte, DEPOIS de já se saber quem está em
     cada equipa (ver `editarTrocas`, mais abaixo, junto do plano ao
     vivo) — só faz sentido escolher quem sai/quem entra depois de haver
     equipas de verdade para tirar e pôr gente. */
  const [perguntarManual, setPerguntarManual] = useState(null); // exercício pendente de resposta
  const [construirEquipas, setConstruirEquipas] = useState(null); // { exercicio, equipas: [n, n, ...] }

  const adicionarExercicio = (x, playersCountOverride) => setEscolhidos(prev => (
    prev.some(e => e.id === x.id) ? prev : [...prev, {
      id: x.id,
      minutos: Number(duracaoNoTreino.get(x.id)) || Number(x.defaultDuration) || 15,
      maxSimultaneo: 1, grupo: '',
      playersCount: playersCountOverride !== undefined ? playersCountOverride : (x.playersCount || ''),
    }]
  ));

  const toggleExercicio = (x) => {
    if (escolhidos.some(e => e.id === x.id)) {
      setEscolhidos(prev => prev.filter(e => e.id !== x.id));
      return;
    }
    setPerguntarManual(x);
  };
  const patchExercicio = (id, patch) => setEscolhidos(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));
  const moverExercicio = (id, delta) => setEscolhidos(prev => {
    const i = prev.findIndex(e => e.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const gerarTreino = () => {
    const lista = escolhidos
      .map(e => {
        const x = exercises.find(v => v.id === e.id);
        if (!x) return null;
        // O `playersCount` desta linha manda sobre o do exercício: é o
        // que faz um "8x8" da biblioteca correr como "6x6" hoje.
        const comOverride = e.playersCount === undefined ? x : { ...x, playersCount: e.playersCount };
        return { exercise: comOverride, minutos: e.minutos, maxSimultaneo: e.maxSimultaneo, grupo: e.grupo };
      })
      .filter(Boolean);
    if (!presentes.length || !lista.length) return;
    setJogo(null);
    /* Guarda-se a distribuição CRUA. O plano que se vê é ela com as
       equipas fixadas por cima — assim, fixar ou soltar uma equipa
       reflete-se logo, sem ter de baralhar tudo outra vez. */
    setPlanoBase(distribuirTreino(lista, presentes, { substituirAMeio }));
  };

  /* Escreve as equipas na sessão de treino do dia.

     Guarda-se em texto já resolvido (nomes, não ids): a ficha impressa
     precisa de nomes, e um jogador apagado do plantel não pode deixar a
     ficha do treino com um lugar vazio e inexplicável. É um registo do que
     foi feito naquele dia, não uma ligação viva ao plantel.

     Funciona nos dois modos. Em 'treino' cada equipa vem de um exercício
     (como já era). Em 'amigável' não há exercícios — cada período do
     jogo simulado vira uma "equipa" (o onze titular desse período), no
     mesmo formato de registo, para reaproveitar a mesma ficha impressa e
     partilhável sem duplicar código nem criar um segundo formato de
     dados.

     A sessão-alvo é encontrada por `sourceMatchId` quando há um jogo
     amigável escolhido — mais seguro do que só a data, que podia
     coincidir com outra sessão qualquer nesse dia. */
  const encontrarSessaoAlvo = () => {
    if (modo === 'amigavel' && jogoAgendadoId) {
      return (sessions || []).find(x => x.sourceMatchId === jogoAgendadoId) || (sessions || []).find(x => x.date === dia);
    }
    return (sessions || []).find(x => x.date === dia);
  };
  const [guardado, setGuardado] = useState(false);
  const guardarNoTreino = () => {
    if (!resultado || !setSessions) return;
    const alvo = encontrarSessaoAlvo();
    if (!alvo) return;
    const equipas = [];
    // Trocas ("este sai, este entra"), por exercício — nomes em texto
    // corrido, tal como o resto do que se grava aqui, para a ficha
    // impressa poder ler isto sem precisar de saber ids de jogadores.
    const trocas = [];
    if (modo === 'treino') {
      plano.plano.forEach((bloco, bi) => bloco.partes.forEach((parte, pi) => parte.exercicios.forEach((ex, xi) => {
        ex.equipas.forEach(eq => {
          if (!eq.jogadores.length) return;
          equipas.push({
            exercicio: ex.exercise.name,
            zona: ex.totalCopias > 1 ? ex.copia : null,
            turno: bloco.partes.length > 1 ? pi + 1 : null,
            minutos: parte.minutos,
            equipa: teamInfo(eq.team).label,
            guardaRedes: !!eq.isKeeper,
            jogadores: eq.jogadores.map(j => j.name),
          });
        });
        (trocasPorOcorrencia[chaveOcorrencia(bi, pi, xi)] || []).forEach(t => {
          const sai = presentes.find(p => p.id === t.sai);
          const entra = presentes.find(p => p.id === t.entra);
          if (!sai || !entra) return;
          trocas.push({
            exercicio: ex.exercise.name,
            turno: bloco.partes.length > 1 ? pi + 1 : null,
            sai: sai.name,
            entra: entra.name,
          });
        });
      })));
    } else {
      jogo.periodos.forEach((per, pi) => {
        const titulares = per.onze.filter(l => l.jogador).map(l => l.jogador.name);
        if (!titulares.length) return;
        equipas.push({
          exercicio: `Jogo amigável · ${jogo.formacao}`,
          zona: null,
          turno: jogo.periodos.length > 1 ? per.numero : null,
          minutos: per.minutos,
          equipa: 'Onze titular',
          guardaRedes: false,
          jogadores: titulares,
        });
        (trocasPorOcorrencia[chavePeriodo(pi)] || []).forEach(t => {
          const sai = presentes.find(p => p.id === t.sai);
          const entra = presentes.find(p => p.id === t.entra);
          if (!sai || !entra) return;
          trocas.push({
            exercicio: `Jogo amigável · ${jogo.formacao}`,
            turno: jogo.periodos.length > 1 ? per.numero : null,
            sai: sai.name,
            entra: entra.name,
          });
        });
      });
    }
    /* Só para o modo 'amigável': o onze do PRIMEIRO período (quem começa o
       jogo), com o lugar de cada um — é o que dá para desenhar o campo na
       ficha impressa, tal como na Ficha de Jogo. Os `equipas` acima
       (nomes em texto corrido, sem lugar) continuam a existir à parte
       para o resto da app que já os lê; isto é só o que falta para o
       campo saber ONDE pôr cada jogador. */
    const primeiroPeriodo = modo === 'amigavel' ? jogo.periodos[0] : null;
    const onzeAmigavel = primeiroPeriodo
      ? primeiroPeriodo.onze.map(l => ({ lugar: l.lugar, ponto: l.ponto || null, jogador: l.jogador ? l.jogador.name : null }))
      : null;
    const suplentesAmigavel = primeiroPeriodo
      ? presentes.filter(p => !primeiroPeriodo.onze.some(l => l.jogador && l.jogador.id === p.id)).map(p => p.name)
      : null;
    const registo = {
      geradoEm: new Date().toISOString(),
      equipas,
      trocas,
      ...(modo === 'amigavel' ? { onzeAmigavel: { formacao: jogo.formacao, onze: onzeAmigavel, suplentes: suplentesAmigavel } } : {}),
    };
    /* Configuração completa do simulador — quem estava presente, que
       exercícios foram escolhidos (com os ajustes de cada um: minutos,
       nº de jogadores, cópias em simultâneo), as equipas fixadas à mão,
       as trocas, e o RESULTADO em si (`planoBase`/`jogo`) — as equipas
       que saíram da distribuição, exatamente como ficaram, e não só as
       que foram fixadas à mão. É isto que permite reabrir o simulador
       neste mesmo dia mais tarde e encontrar tudo tal como ficou, já com
       o menu de editar disponível — sem isto, cada vez que se reabria
       era preciso escolher presenças e exercícios outra vez do zero, e
       mesmo escolhendo tudo igual, carregar em "Distribuir" voltava a
       baralhar quem não tivesse sido fixado à mão. `equipasSimulador`
       (acima) é só o retrato em texto para a ficha impressa; isto aqui é
       o estado vivo para reconstruir o simulador tal e qual.

       `minutosPorJogador` (dentro de `planoBase`/`jogo`) é um Map — e um
       Map não sobrevive a ser gravado como JSON (a base de dados guarda
       JSON a sério, não objetos de JavaScript): volta um objeto normal,
       sem `.get`/`.values`, e a app rebentava ao tentar usá-lo como Map
       outra vez. `serializarResultado` troca-o por um objeto simples
       antes de gravar; `desserializarResultado` (mais abaixo, onde se
       carrega) faz o caminho inverso. */
    const serializarResultado = (r) => (r ? { ...r, minutosPorJogador: Object.fromEntries(r.minutosPorJogador || []) } : r);
    const configSimulador = {
      modo, presentIds, convidados, escolhidos, equipasFixas, trocasPorOcorrencia,
      formato, formacao, janelas, substituirAMeio,
      planoBase: modo === 'treino' ? serializarResultado(planoBase) : null,
      jogo: modo === 'amigavel' ? serializarResultado(jogo) : null,
    };
    setSessions(prev => prev.map(x => (x.id === alvo.id ? { ...x, equipasSimulador: registo, simuladorConfig: configSimulador } : x)));
    /* O ONZE ESCOLHIDO AQUI É O ONZE DO JOGO. Num dia com um jogo
       verdadeiro (oficial ou amigável), o onze do primeiro período passa
       também para a ficha do jogo — titulares, formação e o lugar de cada
       um. Daí segue para os Jogos e para a Convocatória impressa, como se
       tivesse sido escolhido lá. Antes ficava só no Planeamento. */
    if (modo === 'amigavel' && primeiroPeriodo && setMatches) {
      const real = jogoRealDaSessao(alvo, matches);
      const lugaresF = FORMACOES[jogo.formacao];
      if (real && lugaresF) {
        const ehDoPlantel = (id) => (players || []).some(p => p.id === id);
        const livres = primeiroPeriodo.onze.filter(l => l.jogador && ehDoPlantel(l.jogador.id));
        const alinhamento = lugaresF.map(lugar => {
          const k = livres.findIndex(l => l.lugar === lugar);
          if (k < 0) return null;
          const [l] = livres.splice(k, 1);
          return l.jogador.id;
        });
        livres.forEach(l => { const i = alinhamento.indexOf(null); if (i >= 0) alinhamento[i] = l.jogador.id; });
        const starters = alinhamento.filter(Boolean);
        if (starters.length) {
          setMatches(prev => prev.map(m => (m.id === real.id ? { ...m, starters, formacao: jogo.formacao, alinhamento } : m)));
        }
      }
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  /* Apagar as equipas guardadas nesse dia — para quando o treinador muda
     de ideias depois de já ter guardado. Alterar não precisa de botão
     próprio: baralhar de novo e voltar a "Guardar" já substitui o registo
     (ver `guardarNoTreino` acima); só faltava mesmo a forma de o remover
     por completo, sem deixar lá umas equipas antigas por engano.

     Apaga a sério: tira também `simuladorConfig` (não só `equipasSimulador`
     — sem isto, a configuração completa continuava gravada e reabria na
     mesma da próxima vez, como se nada tivesse sido apagado) E repõe o
     ecrã a zero — presenças, exercícios, equipas fixadas, trocas e o
     resultado. Sem isto, o ecrã continuava a mostrar tudo o que lá
     estava, como se o "Apagar" não tivesse feito nada — só desaparecia
     mesmo da sessão, não do que se via no simulador. */
  const apagarDoTreino = () => {
    if (!setSessions) return;
    const alvo = encontrarSessaoAlvo();
    if (!alvo) return;
    setSessions(prev => prev.map(x => (x.id === alvo.id ? { ...x, equipasSimulador: null, simuladorConfig: null } : x)));
    setPresentIds([]);
    setConvidados([]);
    setEscolhidos([]);
    setEquipasFixas({});
    setTrocasPorOcorrencia({});
    setPlanoBase(null);
    setJogo(null);
    // Sem isto, se o simulador não desmontar de verdade entre um fecho e
    // uma reabertura (ex.: fica só escondido, não sai da árvore de
    // componentes), a marca de "já carreguei esta sessão" continuava
    // como estava — e como o dia não muda, o efeito de carregar nunca
    // corria outra vez para reparar que agora está tudo a null.
    configJaCarregadaRef.current = null;
  };

  const gerarJogo = () => {
    if (!presentes.length) return;
    setPlanoBase(null);
    setJogo(distribuirAmigavel(presentes, { formato, formacao, janelas }));
  };

  /* MEXER NUM PERÍODO, SEM REPETIR A CONTA DOS MINUTOS.

     Trocar um jogador, tirar um lugar, juntar um lugar ou escolher o
     onze inteiro são quatro ações diferentes com o mesmo fim: mudar a
     lista de lugares de um período e voltar a acertar os suplentes e os
     minutos de toda a gente. A conta estava escrita duas vezes; com
     quatro passava a estar quatro. */
  const mexerNoPeriodo = (pi, transformarOnze) => {
    setJogo(j => {
      if (!j) return j;
      const periodos = j.periodos.map((per, k) => {
        if (k !== pi) return per;
        const onze = transformarOnze(per.onze, per);
        const emCampo = new Set(onze.map(l => l.jogador && l.jogador.id).filter(Boolean));
        return { ...per, onze, suplentes: presentes.filter(p => !emCampo.has(p.id)) };
      });
      const minutos = new Map(presentes.map(p => [p.id, 0]));
      periodos.forEach(per => per.onze.forEach(l => {
        if (l.jogador) minutos.set(l.jogador.id, (minutos.get(l.jogador.id) || 0) + per.minutos);
      }));
      return { ...j, periodos, minutosPorJogador: minutos };
    });
  };

  /* JUNTAR E TIRAR LUGARES.

     A formação dá o desenho de partida; um jogo a sério foge-lhe. Falta
     um miúdo e joga-se com dez; aparece um a mais e mete-se um segundo
     avançado. Antes disto, mudar isso obrigava a escolher outra formação
     e a refazer o onze todo.

     Um lugar acrescentado leva o SEU ponto no campo, calculado a partir
     da sigla (um PL nasce à frente, um DC atrás) e afastado de quem já
     lá está, para não nascer por cima de outro. Sem o ponto guardado no
     lugar, tirar o terceiro de onze fazia os oito seguintes saltarem
     todos uma casa no desenho. */
  const PONTO_BASE_DO_LUGAR = {
    GR: [0.05, 0.50],
    DD: [0.22, 0.82], DC: [0.18, 0.50], DE: [0.22, 0.18],
    AD: [0.50, 0.88], AE: [0.50, 0.12],
    MD: [0.38, 0.50], MC: [0.46, 0.50], MOC: [0.60, 0.50],
    ED: [0.74, 0.84], EE: [0.74, 0.16], PL: [0.86, 0.50],
  };
  const LUGARES_QUE_SE_PODEM_JUNTAR = ['GR', 'DD', 'DC', 'DE', 'AD', 'AE', 'MD', 'MC', 'MOC', 'ED', 'EE', 'PL'];
  // No máximo 4 por posição — nem se tenta arranjar espaço para um 5º, o
  // "+ juntar lugar" nem chega a mostrar a opção (ver `contarLugar`, onde
  // isto é usado para filtrar a lista).
  const MAX_POR_LUGAR = 4;
  const contarLugar = (onze, lugar) => onze.filter(l => l.lugar === lugar).length;
  const pontoLivre = (lugar, onze, formacaoAtual) => {
    const [bx, by] = PONTO_BASE_DO_LUGAR[lugar] || [0.50, 0.50];
    // Um titular (do onze inicial) não tem `ponto` próprio — a posição
    // dele vem da formação (`layout[i]`, pelo índice), exatamente como o
    // desenho lê ao mostrar o campo. Sem isto, um lugar novo não via os
    // titulares como "ocupado" e nascia mesmo em cima deles — era essa a
    // sobreposição que ainda aparecia com os DC's. Agora calcula-se o
    // ponto EFETIVO de cada lugar do onze, titular ou não, da mesma forma
    // que o desenho o calcula.
    const layoutAtual = LAYOUT_FORMACAO[formacaoAtual] || LAYOUT_FORMACAO['4-3-3'];
    const pontosOcupados = onze.map((l, i) => l.ponto || layoutAtual[i] || [0.5, 0.5]);
    const ocupado = (x, y) => pontosOcupados.some(([px, py]) => Math.abs(px - x) < 0.06 && Math.abs(py - y) < 0.09);
    if (!ocupado(bx, by)) return [bx, by];
    if (lugar === 'GR') {
      // O guarda-redes fica como sempre esteve — encostado à própria
      // baliza, não há "atrás" para onde o empurrar.
      for (let passo = 1; passo <= 5; passo++) {
        for (const sentido of [1, -1]) {
          const y = Math.min(0.95, Math.max(0.05, by + sentido * passo * 0.11));
          if (!ocupado(bx, y)) return [bx, y];
        }
      }
      return [bx, by];
    }
    // Os até 4 extra ficam À VOLTA da posição base — atrás, à frente,
    // acima e abaixo — em vez de só numa fila reta atrás, com espaço de
    // sobra entre cada um para nunca se tocarem.
    const ANEL_A_VOLTA = [
      [-0.09, 0], [0.09, 0], [0, -0.13], [0, 0.13],
    ];
    for (const [dx, dy] of ANEL_A_VOLTA) {
      const x = Math.min(0.95, Math.max(0.05, bx + dx));
      const y = Math.min(0.95, Math.max(0.05, by + dy));
      if (!ocupado(x, y)) return [x, y];
    }
    return [bx, by];
  };
  const juntarLugar = (pi, lugar) => mexerNoPeriodo(pi, (onze) => (
    contarLugar(onze, lugar) >= MAX_POR_LUGAR ? onze : [...onze, { lugar, ponto: pontoLivre(lugar, onze, formacao), jogador: null }]
  ));
  const tirarLugar = (pi, indice) => {
    mexerNoPeriodo(pi, (onze) => onze.filter((_, i) => i !== indice));
    setTrocar(null);
  };

  /* ESCOLHER O ONZE DE UMA VEZ.

     Trocar lugar a lugar serve para um ajuste; para montar a equipa de
     raiz eram onze janelas seguidas. Aqui escolhem-se os nomes e a app
     arruma-os pelos lugares que existirem — com a MESMA regra do onze
     provável (cada família no seu sítio, nunca um defesa no ataque).
     Quem sobrar da escolha fica suplente. */
  const [escolherOnze, setEscolherOnze] = useState(null); // { periodo, ids }
  const aplicarOnzeEscolhido = () => {
    if (!escolherOnze) return;
    const { periodo: pi, ids } = escolherOnze;
    const porId = new Map(presentes.map(p => [p.id, p]));
    const lista = ids.map(id => porId.get(id)).filter(Boolean);
    mexerNoPeriodo(pi, (onze) => {
      const colocados = new Array(onze.length).fill(null);
      const pool = [...lista];
      preencherPorFamilia(onze.map((l, i) => ({ lugar: l.lugar, i })), pool, colocados);
      return onze.map((l, i) => ({ ...l, jogador: colocados[i] || null }));
    });
    setEscolherOnze(null);
  };

  /* Trocar um jogador de um lugar do onze. A recomendação é um ponto de
     partida: o treinador sabe coisas que o simulador não sabe. */
  const trocarDiretoNoPeriodo = (pi, indiceOrigem, indiceDestino) => {
    setJogo(j => {
      const periodos = j.periodos.map((per, k) => {
        if (k !== pi) return per;
        const onze = per.onze.map((l, i2) => {
          if (i2 === indiceOrigem) return { ...l, jogador: per.onze[indiceDestino].jogador };
          if (i2 === indiceDestino) return { ...l, jogador: per.onze[indiceOrigem].jogador };
          return l;
        });
        const emCampo = new Set(onze.map(l => l.jogador && l.jogador.id).filter(Boolean));
        return { ...per, onze, suplentes: presentes.filter(p => !emCampo.has(p.id)) };
      });
      const minutos = new Map(presentes.map(p => [p.id, 0]));
      periodos.forEach(per => per.onze.forEach(l => {
        if (l.jogador) minutos.set(l.jogador.id, (minutos.get(l.jogador.id) || 0) + per.minutos);
      }));
      return { ...j, periodos, minutosPorJogador: minutos };
    });
  };

  const aplicarTroca = (novoJogador) => {
    if (!trocar || !jogo) return;
    const { periodo: pi, indice } = trocar;
    setJogo(j => {
      const periodos = j.periodos.map((per, k) => {
        if (k !== pi) return per;
        const antigo = per.onze[indice].jogador;
        const onze = per.onze.map((l, i2) => {
          if (i2 === indice) return { ...l, jogador: novoJogador };
          // Se o escolhido já estava noutro lugar, os dois trocam de sítio.
          if (novoJogador && l.jogador && l.jogador.id === novoJogador.id) return { ...l, jogador: antigo };
          return l;
        });
        const emCampo = new Set(onze.map(l => l.jogador && l.jogador.id).filter(Boolean));
        return { ...per, onze, suplentes: presentes.filter(p => !emCampo.has(p.id)) };
      });
      // Recontar os minutos com o onze já alterado.
      const minutos = new Map(presentes.map(p => [p.id, 0]));
      periodos.forEach(per => per.onze.forEach(l => {
        if (l.jogador) minutos.set(l.jogador.id, (minutos.get(l.jogador.id) || 0) + per.minutos);
      }));
      return { ...j, periodos, minutosPorJogador: minutos };
    });
    setTrocar(null);
  };

  /* Só os exercícios que estão MESMO no treino desse dia.

     A lista completa da biblioteca não serve aqui: o simulador distribui
     um treino concreto, e escolher de novo os exercícios era repetir o
     trabalho já feito no Planeamento — com o risco de simular uma coisa e
     treinar outra. */
  const sessoesDoDia = (sessions || []).filter(x => x.date === dia);
  /* Em 'treino' basta olhar para as sessões desse dia. Em 'amigável' tem
     de ser a sessão do JOGO ESCOLHIDO especificamente — senão, sem jogo
     escolhido, `dia` podia ainda apontar para uma data qualquer (a de
     hoje, por omissão) e mostrar "Apagar equipas guardadas" para um
     treino sem nada a ver com o simulador de jogo. */
  const sessaoDoJogoEscolhido = jogoAgendadoId
    ? (sessions || []).find(x => x.sourceMatchId === jogoAgendadoId) || (sessions || []).find(x => x.date === dia)
    : null;
  const temEquipas = (s) => !!(s && s.equipasSimulador && (s.equipasSimulador.equipas || []).length > 0);
  const equipasGuardadasHoje = modo === 'amigavel'
    ? temEquipas(sessaoDoJogoEscolhido)
    : sessoesDoDia.some(temEquipas);
  /* Amigáveis agendados (em Jogos ou Planeamento) para escolher no modo
     'Jogo amigável' — mesmo conceito do "Dia do treino": não se simula um
     jogo qualquer, simula-se UM jogo concreto que já está marcado. */
  const amigaveisAgendados = (matches || [])
    .filter(m => m.date && isFriendlyMatch(m))
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const jogoAgendado = amigaveisAgendados.find(m => m.id === jogoAgendadoId) || null;
  const escolherJogoAgendado = (id) => {
    setJogoAgendadoId(id);
    const m = amigaveisAgendados.find(x => x.id === id);
    if (m) setDia(m.date);
    setJogo(null);
  };

  /* ATENÇÃO ao formato de `exerciseIds`.

     Apesar do nome, NÃO é uma lista de identificadores: é uma lista de
     `{ exId, duration }` — o exercício mais a duração que ele tem NAQUELE
     treino, que pode ser diferente da duração habitual.

     A primeira versão disto procurava `exercises.find(x => x.id === item)`
     com o objeto inteiro no lugar do id. Nunca encontrava nada, e o
     simulador dizia sempre "não há treino planeado neste dia" mesmo com a
     sessão criada. O nome do campo enganou-me.

     A duração vem daqui e não do exercício: se o treinador pôs 12 minutos
     naquele treino, é 12 que o simulador deve usar. */
  const itensDoDia = [];
  sessoesDoDia.forEach(x => (x.exerciseIds || []).forEach(item => {
    const exId = item && typeof item === 'object' ? item.exId : item;
    if (!exId || itensDoDia.some(v => v.exId === exId)) return;
    itensDoDia.push({ exId, duration: (item && item.duration) || null });
  }));
  const duracaoNoTreino = new Map(itensDoDia.map(v => [v.exId, v.duration]));
  const exerciciosDoDia = itensDoDia.map(v => exercises.find(x => x.id === v.exId)).filter(Boolean);
  const exerciciosVisiveis = filtroFase === 'Todas'
    ? exerciciosDoDia
    : exerciciosDoDia.filter(x => temMomento(x, filtroFase));
  const fases = ['Todas', ...Array.from(new Set(exerciciosDoDia.flatMap(momentosDe)))];

  /* Traz sozinho para o Simulador quem já foi marcado como "à
     experiência" a sério, na sessão desse dia (em Planeamento/Presenças
     — ver `ConvidadosEditor`). Sem isto, o treinador tinha de escrever o
     mesmo nome duas vezes: uma na ficha da sessão, outra aqui. Só
     ACRESCENTA — tirar alguém aqui não mexe na sessão gravada, e reabrir
     o Simulador volta a trazê-lo (evita perdê-lo por engano a meio de um
     treino). */
  const convidadosDaSessao = sessoesDoDia.flatMap(s => convidadosDe(s));
  const chaveConvidadosSessao = convidadosDaSessao.map(c => c.id).join(',');
  useEffect(() => {
    if (!convidadosDaSessao.length) return;
    setConvidados(prev => {
      const idsAtuais = new Set(prev.map(c => c.id));
      const novos = convidadosDaSessao
        .filter(c => !idsAtuais.has(c.id))
        .map(c => ({ id: c.id, name: c.nome, position: c.position || '', convidado: true }));
      return novos.length ? [...prev, ...novos] : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveConvidadosSessao]);

  /* CARREGAR A CONFIGURAÇÃO GUARDADA — se este dia já tiver equipas
     guardadas (`simuladorConfig`, escrito em `guardarNoTreino`), o
     simulador abre com tudo tal como ficou: presenças, exercícios
     escolhidos (com os ajustes de cada um), equipas fixadas e trocas —
     não obriga a escolher tudo outra vez do zero.

     Só carrega UMA VEZ por dia/sessão (o `configJaCarregadaRef` guarda
     o id da sessão já carregada) — sem isto, qualquer alteração feita a
     seguir (baralhar, fixar uma equipa, etc.) fazia este efeito disparar
     de novo e apagava as edições em curso, voltando sempre à última
     versão guardada. */
  const configJaCarregadaRef = useRef(null);
  useEffect(() => {
    const sessaoComConfig = sessoesDoDia.find(s => s.simuladorConfig);
    if (!sessaoComConfig) return;
    if (configJaCarregadaRef.current === sessaoComConfig.id) return;
    configJaCarregadaRef.current = sessaoComConfig.id;
    const c = sessaoComConfig.simuladorConfig;
    if (c.modo) setModo(c.modo);
    if (c.presentIds) setPresentIds(c.presentIds);
    if (c.convidados) setConvidados(c.convidados);
    if (c.escolhidos) setEscolhidos(c.escolhidos);
    if (c.equipasFixas) setEquipasFixas(c.equipasFixas);
    if (c.trocasPorOcorrencia) setTrocasPorOcorrencia(c.trocasPorOcorrencia);
    if (c.formato) setFormato(c.formato);
    if (c.formacao) setFormacao(c.formacao);
    if (c.janelas) setJanelas(c.janelas);
    if (typeof c.substituirAMeio === 'boolean') setSubstituirAMeio(c.substituirAMeio);
    // O RESULTADO em si (`planoBase`/`jogo`) fica guardado à parte
    // (ver `configSimulador` em `guardarNoTreino`) e repõe-se direto
    // aqui — nunca se chama "Distribuir" outra vez sozinho. Se se
    // chamasse, qualquer equipa que não tivesse sido fixada à mão
    // baralhava-se de novo, o que já não era "tal e qual ficou".
    // `desserializarResultado` desfaz o que `serializarResultado` fez ao
    // gravar — sem isto, `minutosPorJogador` chegava aqui como um objeto
    // normal em vez de Map, e a app rebentava ("t.values is not a
    // function") ao tentar desenhar "Minutos por jogador".
    const desserializarResultado = (r) => (r ? { ...r, minutosPorJogador: new Map(Object.entries(r.minutosPorJogador || {})) } : r);
    if (c.planoBase) setPlanoBase(desserializarResultado(c.planoBase));
    if (c.jogo) setJogo(desserializarResultado(c.jogo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia]);

  /* O plano que se vê = distribuição crua + equipas fixadas por cima.
     Derivado e não guardado em estado: fixar ou soltar uma equipa
     recalcula-o de imediato, sem ter de voltar a baralhar. */
  const plano = aplicarFixas(planoBase);
  const totalMinutos = escolhidos.reduce((a, e) => a + e.minutos, 0);

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 };
  const rotulo = { ...display, color: T.cream, fontSize: 15, fontWeight: 600, margin: '0 0 4px' };
  const nota = { color: T.mutedDim, fontSize: 12, margin: '0 0 12px' };
  const numInput = {
    width: 46, textAlign: 'center', padding: '4px', flexShrink: 0,
    background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6,
    color: T.cream, fontSize: 12, ...mono, outline: 'none',
  };

  const resultado = modo === 'treino' ? plano : jogo;

  return (
    <>
      {/* O botão vive no FIM da página, a seguir aos resultados.

          Aqui em cima obrigava a subir ao topo para voltar a baralhar,
          logo depois de ter descido para ver a distribuição. */}
      <SectionHeader
        title="Simulador"
        subtitle="Gere posições e tempos."
      />

      {/* Treino e jogo repartem tempo de maneiras diferentes; a escolha
          está no topo porque muda tudo o que vem a seguir. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ id: 'treino', label: 'Treino' }, { id: 'amigavel', label: 'Jogo amigável' }].map(m => (
          <button key={m.id} onClick={() => { setModo(m.id); setPlanoBase(null); setJogo(null); }} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', ...body,
            background: modo === m.id ? '#B5393F' : 'transparent',
            color: modo === m.id ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${modo === m.id ? '#B5393F' : T.line}`,
          }}>{m.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* ---------- Presentes ---------- */}
        <div style={card}>
          <h3 style={rotulo}>1 · Presentes</h3>
          <p style={nota}>
            {doPlantel.length} de {players.length} do plantel
            {convidados.length > 0 && ` · ${convidados.length} à experiência`}
            {' · '}{presentes.filter(ehGuardaRedes).length} guarda-redes
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Btn variant="ghost" onClick={() => setPresentIds(players.map(p => p.id))}>Todos</Btn>
            <Btn variant="ghost" onClick={() => setPresentIds([])}>Nenhum</Btn>
            {presencasHoje.length > 0 && (
              <Btn variant="ghost" onClick={() => setPresentIds(presencasHoje)}>
                <UserCheck size={14} /> Presenças de hoje ({presencasHoje.length})
              </Btn>
            )}
          </div>
          <PlayerChipList
            players={players}
            isOn={p => presentIds.includes(p.id)}
            onToggle={toggle}
            estadoClinico={p => estadoClinicoEm(p.id, dia, clinico)}
          />

          {/* À experiência: entram na distribuição, não entram nos dados. */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>À experiência</div>
            <div style={{ fontSize: 11, color: T.mutedDim, marginBottom: 8 }}>
              Contam para a distribuição do treino. Não entram no plantel, nas presenças nem nas estatísticas.
            </div>
            {/* No telemóvel o nome ocupa uma linha inteira e a posição
                fica ao lado do botão: os três lado a lado não cabiam em
                380 px e o campo do nome ficava demasiado estreito para se
                ver o que se estava a escrever. */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', minWidth: 0 }}>
              <Input
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarConvidado(); } }}
                placeholder="Nome"
                style={{ flex: isNarrow ? '1 1 100%' : 1, minWidth: 0, height: 34 }}
              />
              <Select value={novaPos} onChange={e => setNovaPos(e.target.value)} style={{ width: 86, height: 34, flexShrink: 0 }}>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </Select>
              <Btn variant="ghost" onClick={adicionarConvidado} disabled={!novoNome.trim()}><Plus size={14} /> Juntar</Btn>
            </div>
            {convidados.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {convidados.map(c => (
                  <span key={c.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, ...body,
                    background: `${T.gold}1E`, border: `1px solid ${T.gold}66`, borderRadius: 20,
                    padding: '4px 8px 4px 10px', fontSize: 12, color: T.cream,
                  }}>
                    <span style={{ ...mono, fontSize: 10, color: T.gold }}>{c.position}</span>
                    {c.name}
                    <button onClick={() => removerConvidado(c.id)} title="Tirar"
                      style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Exercícios (treino) ou formato (jogo) ---------- */}
        {modo === 'treino' ? (
          <div style={card}>
            <h3 style={rotulo}>2 · Exercícios</h3>
            <Field label="Dia do treino" solto>
              <Input type="date" value={dia} onChange={e => { setDia(e.target.value); setEscolhidos([]); setPlanoBase(null); }} />
            </Field>
            <p style={{ ...nota, marginTop: 10 }}>
              {exerciciosDoDia.length === 0
                ? 'Não há treino planeado neste dia. Cria a sessão no Planeamento e os exercícios aparecem aqui.'
                : escolhidos.length === 0
                  ? `${exerciciosDoDia.length} ${exerciciosDoDia.length === 1 ? 'exercício' : 'exercícios'} no treino deste dia.`
                  : `${escolhidos.length} de ${exerciciosDoDia.length} · ${totalMinutos} min.`}
            </p>

            {escolhidos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {escolhidos.map((e, i) => {
                  const x = exercises.find(v => v.id === e.id);
                  if (!x) return null;
                  return (
                    <div key={e.id} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 9px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ ...mono, fontSize: 11, color: T.warn, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {x.name}{x.playersCount && <span style={{ color: T.mutedDim }}> · {x.playersCount}</span>}
                        </span>
                        <button onClick={() => moverExercicio(e.id, -1)} disabled={i === 0} title="Subir"
                          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', color: i === 0 ? T.line : T.mutedDim, cursor: i === 0 ? 'default' : 'pointer' }}>
                          <ChevronLeft size={14} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                        <button onClick={() => moverExercicio(e.id, 1)} disabled={i === escolhidos.length - 1} title="Descer"
                          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', color: i === escolhidos.length - 1 ? T.line : T.mutedDim, cursor: i === escolhidos.length - 1 ? 'default' : 'pointer' }}>
                          <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                        <button onClick={() => toggleExercicio(x)} title="Tirar do treino"
                          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', color: T.mutedDim, cursor: 'pointer' }}>
                          <X size={14} />
                        </button>
                      </div>

                      {/* No telemóvel os três controlos em linha somam mais
                          do que a largura do ecrã e a página passa a
                          arrastar-se de lado. Em coluna cabem, e cada um
                          fica com a largura toda — mais fácil de acertar
                          com o dedo. */}
                      <div style={{
                        display: 'flex', gap: isNarrow ? 7 : 8, fontSize: 11, color: T.mutedDim, minWidth: 0,
                        ...(isNarrow
                          ? { flexDirection: 'column', alignItems: 'stretch' }
                          : { alignItems: 'center', flexWrap: 'wrap' }),
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <input type="number" min="1" max="90" value={e.minutos}
                            onChange={ev => patchExercicio(e.id, { minutos: Math.max(1, Number(ev.target.value) || 0) })}
                            style={numInput} /> min
                        </label>
                        {/* O nº de jogadores SÓ PARA HOJE.

                            A biblioteca guarda o exercício como ele foi
                            pensado; o treino de hoje tem os miúdos que
                            apareceram. Editar aqui muda este treino e não
                            toca no exercício — a mesma notação de sempre
                            ("6x6", "4+1x4+1", "3 Gr"). */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Nº de jogadores só neste treino — não altera o exercício na biblioteca">
                          <span style={{ flexShrink: 0 }}>👥</span>
                          <Input
                            value={e.playersCount === undefined ? (x.playersCount || '') : e.playersCount}
                            onChange={ev => patchExercicio(e.id, { playersCount: ev.target.value })}
                            placeholder={x.playersCount || '6x6'}
                            style={{ width: isNarrow ? '100%' : 96, minWidth: 0, height: 30, lineHeight: '28px', fontSize: 12, padding: '0 6px' }}
                          />
                          {(e.playersCount || '') !== (x.playersCount || '') && (
                            <button
                              onClick={() => patchExercicio(e.id, { playersCount: x.playersCount || '' })}
                              title={`Voltar ao do exercício (${x.playersCount || 'sem indicação'})`}
                              style={{ background: 'none', border: 'none', padding: 0, display: 'flex', color: T.warn, cursor: 'pointer', flexShrink: 0 }}
                            >
                              <Undo2 size={13} />
                            </button>
                          )}
                        </label>
                        {/* Quantas cópias PODEM decorrer ao mesmo tempo. O
                            treinador dá o teto (o campo tem tantas secções);
                            o simulador decide quantas usar. */}
                        {/* Lista em vez de campo numérico.

                            Com <input type=number> a limitar entre 1 e 6 a
                            cada tecla, apagar o valor era impossível: o campo
                            vazio virava logo 1, e escrever "6" depois de um
                            número existente dava sempre 6. Uma lista de seis
                            opções resolve os dois problemas e ainda diz quais
                            são os valores possíveis. */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Máximo de vezes que este exercício pode decorrer ao mesmo tempo, em secções diferentes do campo">
                          <Select
                            value={String(e.maxSimultaneo)}
                            onChange={ev => patchExercicio(e.id, { maxSimultaneo: Number(ev.target.value) })}
                            style={{ width: isNarrow ? 64 : 54, height: 30, lineHeight: '28px', fontSize: 12, padding: '0 4px', flexShrink: 0 }}
                          >
                            {[1, 2, 3, 4, 5, 6].map(v => <option key={v} value={v}>{v}</option>)}
                          </Select>
                          em simultâneo (máx.)
                        </label>
                        {/* Exercícios com o mesmo rótulo decorrem ao mesmo
                            tempo, em zonas diferentes do campo. */}
                        {/* "A par de" escolhe-se de uma lista dos OUTROS
                            exercícios do treino, não se escreve um código.
                            Escolher aqui põe os dois no mesmo grupo, e é o
                            grupo que os faz decorrer ao mesmo tempo. */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Decorre ao mesmo tempo que este outro exercício, noutra zona do campo">
                          <span style={{ flexShrink: 0 }}>a par de</span>
                          <Select
                            value={(escolhidos.find(o => o.id !== e.id && o.grupo && o.grupo === e.grupo) || {}).id || ''}
                            onChange={ev => {
                              const alvo = ev.target.value;
                              if (!alvo) { patchExercicio(e.id, { grupo: '' }); return; }
                              // Os dois passam a partilhar o mesmo grupo.
                              const chave = `g${e.id}-${alvo}`;
                              setEscolhidos(prev => prev.map(o => (
                                o.id === e.id || o.id === alvo ? { ...o, grupo: chave } : o
                              )));
                            }}
                            style={{ width: isNarrow ? '100%' : 132, minWidth: 0, height: 30, lineHeight: '28px', fontSize: 12, padding: '0 4px' }}
                          >
                            <option value="">— sozinho —</option>
                            {escolhidos.filter(o => o.id !== e.id).map(o => {
                              const outro = exercises.find(v => v.id === o.id);
                              if (!outro) return null;
                              return <option key={o.id} value={o.id}>{outro.name}</option>;
                            })}
                          </Select>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.muted, marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={substituirAMeio} onChange={e => setSubstituirAMeio(e.target.checked)} />
              Trocar jogadores a meio de cada exercício
            </label>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {fases.map(f => (
                <button key={f} onClick={() => setFiltroFase(f)} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer', ...body,
                  background: filtroFase === f ? '#B5393F' : 'transparent',
                  color: filtroFase === f ? TEXT_ON_ACCENT : T.muted,
                  border: `1px solid ${filtroFase === f ? '#B5393F' : T.line}`,
                }}>{f}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, minWidth: 0 }}>
              {exerciciosVisiveis.length === 0 ? (
                <div style={{ fontSize: 12.5, color: T.mutedDim }}>Sem exercícios nesta fase.</div>
              ) : exerciciosVisiveis.map(x => {
                const on = escolhidos.some(e => e.id === x.id);
                return (
                  <button key={x.id} onClick={() => toggleExercicio(x)} style={{
                    textAlign: 'left', cursor: 'pointer', ...body,
                    background: on ? '#B5393F22' : 'transparent',
                    border: `1px solid ${on ? '#B5393F' : T.line}`,
                    borderRadius: 8, padding: '8px 10px',
                  }}>
                    <div style={{ fontSize: 12.5, color: on ? T.cream : T.muted }}>{x.name}</div>
                    <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 2 }}>
                      {[momentoTexto(x), x.playersCount && `👥 ${x.playersCount}`, x.defaultDuration && `⏱ ${x.defaultDuration} min`].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={card}>
            <h3 style={rotulo}>2 · Formato do jogo</h3>
            <Field label="Jogo amigável agendado" solto>
              <Select value={jogoAgendadoId} onChange={e => escolherJogoAgendado(e.target.value)}>
                <option value="">— escolhe o jogo —</option>
                {amigaveisAgendados.map(m => (
                  <option key={m.id} value={m.id}>{fmtDate(m.date)} · vs {m.opponent || 'Adversário por definir'}</option>
                ))}
              </Select>
            </Field>
            <p style={{ ...nota, marginTop: 10 }}>
              {amigaveisAgendados.length === 0
                ? 'Não há amigáveis agendados. Cria o jogo em Jogos ou Planeamento e aparece aqui.'
                : !jogoAgendado
                  ? 'Escolhe o jogo para poderes guardar as equipas nele.'
                  : `A simular ${fmtDate(jogoAgendado.date)} · vs ${jogoAgendado.opponent || 'Adversário por definir'}.`}
            </p>
            <p style={nota}>
              Num amigável não há limite de substituições. As trocas ficam marcadas
              para o início de cada parte, que é quando não interrompem o jogo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {FORMATOS_JOGO.map(f => (
                <button key={f.id} onClick={() => setFormato(f.id)} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', ...body,
                  background: formato === f.id ? '#B5393F22' : 'transparent',
                  border: `1px solid ${formato === f.id ? '#B5393F' : T.line}`,
                  color: formato === f.id ? T.cream : T.muted, fontSize: 13,
                }}>{f.label}</button>
              ))}
            </div>
            <div style={{ ...FIELD_GRID }}>
              {/* O tamanho não é guardado à parte: é o número de lugares
                  da formação escolhida (ver `tamanhoDaFormacao`). Mudar
                  aqui escolhe a primeira formação desse tamanho. */}
              <Field label="Jogadores por equipa">
                <Select
                  value={String(tamanhoEquipa)}
                  onChange={e => {
                    const primeira = formacoesDe(Number(e.target.value))[0];
                    if (primeira) setFormacao(primeira);
                  }}
                >
                  {TAMANHOS_DE_EQUIPA.map(n => (
                    <option key={n} value={n}>{n} · GR + {n - 1}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Formação">
                <Select value={formacao} onChange={e => setFormacao(e.target.value)}>
                  {formacoesDe(tamanhoEquipa).map(f => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              {/* Mais janelas = mais paragens para trocar = mais gente a
                  jogar. Com uma só, um plantel grande deixa sempre alguém
                  de fora — não há lugares que cheguem. */}
              <Field label="Trocas por parte">
                <Select
                  value={String(janelas)}
                  onChange={e => setJanelas(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                >
                  <option value="auto">As necessárias para todos jogarem</option>
                  <option value="1">Só ao intervalo</option>
                  <option value="2">1 troca a meio</option>
                  <option value="3">2 trocas por parte</option>
                  <option value="4">3 trocas por parte</option>
                </Select>
              </Field>
              {janelas === 'auto' && (
                <div style={{ ...FIELD_FULL, fontSize: 11.5, color: T.mutedDim }}>
                  Com {presentes.length} presentes e {(FORMATOS_JOGO.find(f => f.id === formato) || {}).partes} partes,
                  são precisas {Math.max(1, Math.min(4, Math.ceil(presentes.length / (((FORMATOS_JOGO.find(f => f.id === formato) || {}).partes || 2) * 11))))} paragens
                  por parte para toda a gente entrar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Resultado ---------- */}
      {modo === 'treino' && !plano && (
        <EmptyState text="Marca os presentes, escolhe os exercícios e carrega em Distribuir." />
      )}
      {modo === 'amigavel' && !jogo && (
        <EmptyState text="Marca os presentes, escolhe o formato e carrega em Distribuir." />
      )}

      {modo === 'treino' && plano && (
        <>
          {plano.plano.map((bloco, bi) => (
            <div key={bloco.chave} style={{ ...card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ ...mono, fontSize: 12, color: T.warn }}>{bi + 1}</span>
                <h3 style={{ ...display, color: T.cream, fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {bloco.simultaneo ? 'Em simultâneo' : bloco.partes[0].exercicios[0].exercise.name}
                </h3>
                <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim }}>
                  {bloco.minutos} min{bloco.partes.length > 1 ? ` · ${bloco.partes.length} turnos` : ''}
                </span>
              </div>

              {/* TURNOS LADO A LADO EM ECRÃ LARGO.

                  Um exercício com dois turnos e duas equipas de oito dava
                  quase quarenta nomes empilhados, e comparar quem sai e
                  quem entra obrigava a rolar para cima e para baixo. Em
                  colunas, os dois turnos veem-se ao mesmo tempo — que é
                  precisamente o que interessa numa substituição.

                  No telemóvel mantém-se empilhado: duas colunas de nomes
                  em 380 px ficariam ilegíveis. */}
              <div style={{
                display: 'grid', gap: 14,
                gridTemplateColumns: (!isNarrow && bloco.partes.length > 1)
                  ? `repeat(${Math.min(bloco.partes.length, 3)}, minmax(0, 1fr))`
                  : '1fr',
              }}>
              {bloco.partes.map((parte, pi) => (
                <div key={pi} style={{ minWidth: 0 }}>
                  {bloco.partes.length > 1 && (
                    <div style={{ ...mono, fontSize: 11, color: T.warn, marginBottom: 6 }}>
                      Turno {pi + 1} · {parte.minutos} min
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isNarrow ? 150 : 180}px, 1fr))`, gap: 10, minWidth: 0 }}>
                    {parte.exercicios.map((ex, xi) => (
                      <div key={xi} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 12, color: T.cream, marginBottom: 6 }}>
                          {ex.exercise.name}
                          {ex.totalCopias > 1 && <span style={{ ...mono, color: T.warn }}> · zona {ex.copia}</span>}
                        </div>
                        {ex.equipas.map((eq, k) => {
                          const info = teamInfo(eq.team);
                          const chave = chaveEquipa(bi, pi, xi, k);
                          const fixa = !!equipasFixas[chave];
                          return (
                            <div key={k} style={{ marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <span style={{ width: 9, height: 9, borderRadius: '50%', background: info.fill, flexShrink: 0 }} />
                                <span style={{ fontSize: 10.5, color: T.muted }}>{info.label}{eq.isKeeper ? ' · GR' : ''}</span>
                                {fixa && <span style={{ ...mono, fontSize: 9, color: T.gold }} title="Equipa escolhida à mão — o baralhar não lhe toca">fixa</span>}
                                <span style={{ ...mono, fontSize: 10, color: T.mutedDim, marginLeft: 'auto' }}>{eq.jogadores.length}/{eq.vagas}</span>
                                <button
                                  onClick={() => setEditarEquipa({ chave, titulo: `${ex.exercise.name} · ${info.label}${eq.isKeeper ? ' · GR' : ''}`, vagas: eq.vagas, isKeeper: eq.isKeeper, atuais: eq.jogadores.map(j => j.id) })}
                                  title="Escolher os jogadores desta equipa"
                                  style={{ background: 'none', border: 'none', color: fixa ? T.gold : T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}
                                ><Pencil size={11} /></button>
                              </div>
                              {eq.jogadores.map(j => (
                                <div key={j.id} style={{ fontSize: 11.5, color: T.cream, lineHeight: 1.5 }}>
                                  <span style={{ ...mono, fontSize: 9.5, color: T.mutedDim }}>{j.position || '--'}</span>{' '}
                                  {shortPlayerName(j, presentes)}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        {(() => {
                          const chaveOc = chaveOcorrencia(bi, pi, xi);
                          const trocas = trocasPorOcorrencia[chaveOc] || [];
                          const emCampo = ex.equipas.flatMap(eq => eq.jogadores);
                          // Sai/Entra têm as mesmas opções: qualquer um
                          // presente neste exercício — já esteja numa
                          // equipa ou a descansar. Uma troca pode ser
                          // "tira do banco, põe na equipa" tanto como
                          // "troca de equipa entre dois que já jogam".
                          const todosNoExercicio = [...emCampo, ...parte.descanso];
                          return (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.line}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: trocas.length ? 3 : 0 }}>
                                <span style={{ fontSize: 9.5, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.05em' }}>Trocas</span>
                                <button
                                  onClick={() => setEditarTrocas({
                                    chave: chaveOc,
                                    titulo: `${ex.exercise.name}${bloco.partes.length > 1 ? ` · Turno ${pi + 1}` : ''}`,
                                    opcoesSai: todosNoExercicio,
                                    opcoesEntra: todosNoExercicio,
                                    atuais: trocas,
                                  })}
                                  title="Definir quem sai e quem entra"
                                  style={{ background: 'none', border: 'none', color: trocas.length ? T.gold : T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 'auto' }}
                                ><Pencil size={10} /></button>
                              </div>
                              {trocas.map((t, ti) => {
                                const sai = presentes.find(p => p.id === t.sai);
                                const entra = presentes.find(p => p.id === t.entra);
                                return (
                                  <div key={ti} style={{ fontSize: 10.5, color: T.cream, display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.6 }}>
                                    <span>{sai ? shortPlayerName(sai, presentes) : '—'}</span>
                                    <ArrowRight size={10} color={T.mutedDim} />
                                    <span>{entra ? shortPlayerName(entra, presentes) : '—'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                  {parte.descanso.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: T.mutedDim }}>
                      A descansar: {parte.descanso.map(j => shortPlayerName(j, presentes)).join(', ')}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          ))}
          <MinutosPorJogador presentes={presentes} minutos={plano.minutosPorJogador} players={players} isNarrow={isNarrow} />
        </>
      )}

      {modo === 'amigavel' && jogo && (
        <>
          {jogo.periodos.map((per, pi) => (
            <div key={pi} style={{ ...card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <h3 style={{ ...display, color: T.cream, fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {per.numero}ª parte
                  {per.totalJanelas > 1 && <span style={{ color: T.mutedDim, fontWeight: 400 }}> · {per.janela}º período</span>}
                </h3>
                <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim }}>
                  {per.minutos} min · {jogo.formacao} · {per.onze.length} em campo
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                  <button
                    onClick={() => setEscolherOnze({ periodo: pi, ids: per.onze.filter(l => l.jogador).map(l => l.jogador.id) })}
                    style={{
                      background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7,
                      padding: '5px 10px', color: T.cream, cursor: 'pointer', fontSize: 11.5, ...body,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <UserCheck size={13} /> Escolher a equipa
                  </button>
                  {/* Lista em vez de botão: juntar um lugar é sempre
                      juntar um lugar DE ALGUMA COISA, e escolher a sigla
                      no mesmo gesto poupa uma janela. */}
                  <Select
                    value=""
                    onChange={ev => { if (ev.target.value) juntarLugar(pi, ev.target.value); }}
                    style={{ width: 128, height: 30, lineHeight: '28px', fontSize: 11.5, padding: '0 6px' }}
                    title="Juntar um lugar a esta parte"
                  >
                    <option value="">+ juntar lugar</option>
                    {LUGARES_QUE_SE_PODEM_JUNTAR.filter(l => contarLugar(per.onze, l) < MAX_POR_LUGAR).map(l => (
                      <option key={l} value={l}>{rotuloDoLugar(l)}</option>
                    ))}
                  </Select>
                </div>
                {pi > 0 && (
                  <span style={{ fontSize: 11.5, color: T.warn }}>
                    Entram: {per.onze.filter(l => l.jogador && !jogo.periodos[pi - 1].onze.some(a => a.jogador && a.jogador.id === l.jogador.id))
                      .map(l => shortPlayerName(l.jogador, presentes)).join(', ') || '—'}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '2fr 1fr', gap: 14 }}>
                <PranchetaOnze
                  periodo={per}
                  formacao={jogo.formacao}
                  onTrocar={(indice) => setTrocar({ periodo: pi, indice })}
                  onTrocarDireto={(origem, destino) => trocarDiretoNoPeriodo(pi, origem, destino)}
                />
                <div>
                  <div style={{ fontSize: 11.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>
                    Suplentes ({per.suplentes.length})
                  </div>
                  {per.suplentes.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.mutedDim }}>Ninguém de fora.</div>
                  ) : per.suplentes.map(j => (
                    <div key={j.id} style={{ fontSize: 12, color: T.cream, lineHeight: 1.6 }}>
                      <span style={{ ...mono, fontSize: 10, color: T.mutedDim }}>{j.position || '--'}</span>{' '}
                      {shortPlayerName(j, presentes)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trocas previstas para esta parte — mesma ideia do
                  treino: pares "sai/entra", escolhidos de entre quem está
                  no onze ou nos suplentes desta parte. */}
              {(() => {
                const chaveP = chavePeriodo(pi);
                const trocasDaParte = trocasPorOcorrencia[chaveP] || [];
                const noOnze = per.onze.filter(l => l.jogador).map(l => l.jogador);
                const todosNaParte = [...noOnze, ...per.suplentes];
                return (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${T.line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: trocasDaParte.length ? 6 : 0 }}>
                      <span style={{ fontSize: 11, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.05em' }}>Trocas previstas</span>
                      <button
                        onClick={() => setEditarTrocas({
                          chave: chaveP,
                          titulo: `${per.numero}ª parte`,
                          opcoesSai: todosNaParte,
                          opcoesEntra: todosNaParte,
                          atuais: trocasDaParte,
                        })}
                        title="Definir quem sai e quem entra"
                        style={{ background: 'none', border: 'none', color: trocasDaParte.length ? T.gold : T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}
                      ><Pencil size={11} /></button>
                    </div>
                    {trocasDaParte.map((t, ti) => {
                      const sai = presentes.find(p => p.id === t.sai);
                      const entra = presentes.find(p => p.id === t.entra);
                      return (
                        <div key={ti} style={{ fontSize: 11.5, color: T.cream, display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1.7 }}>
                          <span>{sai ? shortPlayerName(sai, presentes) : '—'}</span>
                          <ArrowRight size={11} color={T.mutedDim} />
                          <span>{entra ? shortPlayerName(entra, presentes) : '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
          <MinutosPorJogador presentes={presentes} minutos={jogo.minutosPorJogador} players={players} isNarrow={isNarrow} />
        </>
      )}

      {/* Ação principal, no fim: é aqui que se está depois de ler o
          resultado, e é daqui que se quer voltar a baralhar.

          No telemóvel fica COLADA AO FUNDO do ecrã (`position: sticky`).
          Com 25 presentes e cinco exercícios, a página tem vários ecrãs de
          altura, e ter de a percorrer toda de cada vez que se quer
          baralhar torna a coisa impraticável. Em desktop cabe tudo à
          vista e não é preciso. */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 10, margin: '18px 0 8px', flexWrap: 'wrap',
        ...(isNarrow ? {
          position: 'sticky', bottom: 0, zIndex: 20,
          background: `linear-gradient(to top, ${T.bg} 62%, transparent)`,
          padding: '14px 0 12px', margin: '18px -14px 0',
        } : {}),
      }}>
        <Btn
          onClick={modo === 'treino' ? gerarTreino : gerarJogo}
          disabled={!presentes.length || (modo === 'treino' && !escolhidos.length)}
        >
          <RotateCw size={15} /> {resultado ? 'Baralhar de novo' : 'Distribuir'}
        </Btn>
        {/* Guardar leva as equipas para a sessão de treino desse dia, e é
            de lá que saem para a ficha impressa — o simulador não guarda
            nada por si, para não haver duas versões da verdade. Funciona
            nos dois modos: em 'amigável' guarda o onze titular de cada
            período, tal como em 'treino' guarda as equipas de cada
            exercício. Em 'amigável' só aparece depois de escolhido o jogo
            agendado — sem jogo escolhido não há sessão certa onde gravar. */}
        {resultado && setSessions && (modo === 'treino' ? sessoesDoDia.length > 0 : !!jogoAgendado) && (
          <Btn variant="ghost" onClick={guardarNoTreino}>
            <Check size={15} /> {guardado
              ? (modo === 'treino' ? 'Guardado no treino' : 'Guardado no jogo')
              : (modo === 'treino' ? 'Guardar equipas no treino' : 'Guardar equipas no jogo')}
          </Btn>
        )}
        {/* Só aparece se já houver mesmo algo guardado nesse dia — para
            desfazer o "Guardar" caso o treinador mude de ideias. Para
            ALTERAR (em vez de apagar) não é preciso botão próprio: basta
            baralhar de novo e guardar outra vez, que substitui o registo
            anterior (ver `guardarNoTreino`). */}
        {equipasGuardadasHoje && setSessions && (
          <Btn variant="danger" onClick={apagarDoTreino}>
            <Trash2 size={15} /> Apagar equipas guardadas
          </Btn>
        )}
      </div>

      {/* Escolher à mão os jogadores de uma equipa de um exercício. */}
      {editarEquipa && (
        <Modal title="Equipa do exercício" onClose={() => setEditarEquipa(null)}>
          <p style={{ color: T.cream, fontSize: 13, margin: '0 0 4px' }}>{editarEquipa.titulo}</p>
          <p style={{ color: T.mutedDim, fontSize: 12, margin: '0 0 12px' }}>
            {editarEquipa.vagas} {editarEquipa.vagas === 1 ? 'lugar' : 'lugares'}.
            Uma equipa escolhida à mão fica fixa: o "Baralhar de novo" muda tudo à volta e não lhe toca.
          </p>
          <PlayerChipList
            // Um grupo SÓ de guarda-redes (a notação "N Gr") continua a
            // mostrar só guarda-redes — faz sentido, é para escolher qual
            // deles fica em qual cor. Mas numa equipa normal, incluindo
            // as montadas à mão em "Escolhe as equipas", os guarda-redes
            // também têm de poder entrar — não fazia sentido escondê-los
            // logo à partida quando o treinador está a decidir tudo ele.
            players={editarEquipa.isKeeper ? presentes.filter(ehGuardaRedes) : presentes}
            allPlayers={players}
            isOn={pl => editarEquipa.atuais.includes(pl.id)}
            onToggle={pl => setEditarEquipa(prev => ({
              ...prev,
              atuais: prev.atuais.includes(pl.id)
                ? prev.atuais.filter(id => id !== pl.id)
                : [...prev.atuais, pl.id],
            }))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => { soltarEquipa(editarEquipa.chave); setEditarEquipa(null); }}>
              Deixar o simulador decidir
            </Btn>
            <Btn onClick={() => {
              fixarEquipa(editarEquipa.chave, editarEquipa.atuais);
              setEditarEquipa(null);
            }}><Check size={15} /> Fixar esta equipa</Btn>
          </div>
        </Modal>
      )}

      {editarTrocas && (
        <Modal title={`Trocas — ${editarTrocas.titulo}`} onClose={() => setEditarTrocas(null)}>
          <p style={{ color: T.mutedDim, fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>
            Escolhe pares "sai / entra" para este exercício, de entre todos os que estão nele — já numa
            equipa ou a descansar neste turno.
          </p>
          {editarTrocas.opcoesEntra.length === 0 ? (
            <p style={{ color: T.mutedDim, fontSize: 12.5, marginBottom: 16 }}>
              Não há ninguém neste exercício para trocar.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {editarTrocas.atuais.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Select
                      value={t.sai}
                      onChange={e => setEditarTrocas(prev => ({
                        ...prev, atuais: prev.atuais.map((x, xi) => (xi === i ? { ...x, sai: e.target.value } : x)),
                      }))}
                      style={{ flex: 1, minWidth: 140 }}
                    >
                      <option value="">Sai…</option>
                      {sortByPosition(editarTrocas.opcoesSai).map(p => (
                        <option key={p.id} value={p.id}>{p.position || '--'} · {shortPlayerName(p, presentes)}</option>
                      ))}
                    </Select>
                    <ArrowRight size={14} color={T.mutedDim} style={{ flexShrink: 0 }} />
                    <Select
                      value={t.entra}
                      onChange={e => setEditarTrocas(prev => ({
                        ...prev, atuais: prev.atuais.map((x, xi) => (xi === i ? { ...x, entra: e.target.value } : x)),
                      }))}
                      style={{ flex: 1, minWidth: 140 }}
                    >
                      <option value="">Entra…</option>
                      {sortByPosition(editarTrocas.opcoesEntra).map(p => (
                        <option key={p.id} value={p.id}>{p.position || '--'} · {shortPlayerName(p, presentes)}</option>
                      ))}
                    </Select>
                    <button
                      onClick={() => setEditarTrocas(prev => ({ ...prev, atuais: prev.atuais.filter((_, xi) => xi !== i) }))}
                      title="Remover esta troca"
                      style={{ background: 'none', border: 'none', color: T.bad, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                    ><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <Btn
                variant="ghost"
                onClick={() => setEditarTrocas(prev => ({ ...prev, atuais: [...prev.atuais, { sai: '', entra: '' }] }))}
                style={{ marginBottom: 4 }}
              ><Plus size={15} /> Adicionar troca</Btn>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setEditarTrocas(null)}>Cancelar</Btn>
            <Btn onClick={() => {
              const validas = editarTrocas.atuais.filter(t => t.sai && t.entra);
              setTrocasPorOcorrencia(prev => ({ ...prev, [editarTrocas.chave]: validas }));
              setEditarTrocas(null);
            }}><Check size={15} /> Guardar</Btn>
          </div>
        </Modal>
      )}

      {perguntarManual && (
        <Modal title="Escolhe as equipas" onClose={() => setPerguntarManual(null)}>
          <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
            Para "<strong style={{ color: T.cream }}>{perguntarManual.name}</strong>", queres definir as equipas
            ou distribuir automaticamente?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => { adicionarExercicio(perguntarManual); setPerguntarManual(null); }}>
              Automática
            </Btn>
            <Btn onClick={() => trocarJanela(
              () => setPerguntarManual(null),
              () => setConstruirEquipas({ exercicio: perguntarManual, equipas: [tamanhoEquipa, tamanhoEquipa] }),
            )}>Manual</Btn>
          </div>
        </Modal>
      )}

      {construirEquipas && (
        <Modal title={`${construirEquipas.soTrocas ? 'Trocas' : 'Equipas'} — ${construirEquipas.exercicio.name}`} onClose={() => setConstruirEquipas(null)}>
          {!construirEquipas.soTrocas && (
            <>
              <p style={{ color: T.mutedDim, fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>
                Define quantas equipas há e quantos jogadores em cada uma. Quem fica em cada equipa continua a
                escolher-se a seguir, com "Distribuir" ou à mão, equipa a equipa.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {construirEquipas.equipas.map((n, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: T.cream, width: 76, flexShrink: 0 }}>Equipa {i + 1}</span>
                    <Input
                      type="number" min={1} max={30} value={n}
                      onChange={e => {
                        const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1));
                        setConstruirEquipas(prev => ({ ...prev, equipas: prev.equipas.map((x, xi) => (xi === i ? v : x)) }));
                      }}
                      style={{ width: 74 }}
                    />
                    <span style={{ fontSize: 12, color: T.mutedDim }}>jogadores</span>
                    {construirEquipas.equipas.length > 1 && (
                      <button
                        onClick={() => setConstruirEquipas(prev => ({ ...prev, equipas: prev.equipas.filter((_, xi) => xi !== i) }))}
                        title="Remover esta equipa"
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.bad, cursor: 'pointer', display: 'flex' }}
                      ><Trash2 size={15} /></button>
                    )}
                  </div>
                ))}
              </div>
              <Btn
                variant="ghost"
                onClick={() => setConstruirEquipas(prev => ({ ...prev, equipas: [...prev.equipas, tamanhoEquipa] }))}
                style={{ marginBottom: 18 }}
              ><Plus size={15} /> Adicionar equipa</Btn>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setConstruirEquipas(null)}>Cancelar</Btn>
            <Btn onClick={() => {
              adicionarExercicio(construirEquipas.exercicio, construirEquipas.equipas.join('x'));
              setConstruirEquipas(null);
            }}><Check size={15} /> Guardar</Btn>
          </div>
        </Modal>
      )}

      {/* Montar a equipa de raiz: escolhem-se os nomes, a app arruma-os
          pelos lugares. */}
      {escolherOnze && jogo && (() => {
        const per = jogo.periodos[escolherOnze.periodo];
        const vagas = per.onze.length;
        const n = escolherOnze.ids.length;
        return (
          <Modal
            title="Equipa desta parte"
            subtitle={`${per.numero}ª parte · ${jogo.formacao}`}
            onClose={() => setEscolherOnze(null)}
          >
            <p style={{ color: n > vagas ? T.warn : T.mutedDim, fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.55 }}>
              {n} de {vagas} {vagas === 1 ? 'lugar' : 'lugares'} escolhidos.
              {n > vagas
                ? ` Escolheste ${n - vagas} a mais: quem não couber fica suplente. Junta lugares na parte, se quiseres jogar com mais.`
                : ' Cada um cai no lugar da sua posição; quem não escolheres fica suplente.'}
            </p>
            <PlayerChipList
              players={sortByPosition(presentes)}
              allPlayers={players}
              isOn={pl => escolherOnze.ids.includes(pl.id)}
              onToggle={pl => setEscolherOnze(prev => ({
                ...prev,
                ids: prev.ids.includes(pl.id)
                  ? prev.ids.filter(id => id !== pl.id)
                  : [...prev.ids, pl.id],
              }))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setEscolherOnze(prev => ({ ...prev, ids: [] }))}>
                Limpar
              </Btn>
              <Btn onClick={aplicarOnzeEscolhido}><Check size={15} /> Pôr em campo</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* Escolher quem entra num lugar. Mesmo nome do modal equivalente em
          FichaJogo ("Formação") — é a mesma ação (escolher quem ocupa um
          lugar do onze), só que aqui o jogo é simulado, não real. */}
      {trocar && jogo && (
        <Modal title="Formação" subtitle={`${rotuloDoLugar(jogo.periodos[trocar.periodo].onze[trocar.indice].lugar)} · ${jogo.periodos[trocar.periodo].numero}ª parte`} onClose={() => setTrocar(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', margin: '0 0 12px' }}>
            <p style={{ color: T.mutedDim, fontSize: 12.5, margin: 0, flex: 1, minWidth: 180 }}>
              Se escolheres alguém que já está em campo, os dois trocam de lugar.
            </p>
            {/* Tirar o LUGAR, não o jogador — "deixar vazio", logo
                abaixo, é o que mantém o lugar sem ninguém. São coisas
                diferentes e é por isso que existem as duas. */}
            <button
              onClick={() => tirarLugar(trocar.periodo, trocar.indice)}
              disabled={jogo.periodos[trocar.periodo].onze.length <= 1}
              title="Tira este lugar do campo nesta parte"
              style={{
                background: 'none', border: `1px solid ${T.bad}55`, borderRadius: 7,
                padding: '5px 10px', color: T.bad, cursor: 'pointer', fontSize: 11.5, ...body,
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              }}
            >
              <X size={13} /> Tirar este lugar
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '50vh', overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
            <button onClick={() => aplicarTroca(null)} style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 7, cursor: 'pointer', ...body,
              background: 'transparent', border: `1px solid ${T.line}`, color: T.mutedDim, fontSize: 12.5,
            }}>— deixar vazio —</button>
            {sortByPosition(presentes).map(p => {
              const emCampo = jogo.periodos[trocar.periodo].onze.some(l => l.jogador && l.jogador.id === p.id);
              return (
                <button key={p.id} onClick={() => aplicarTroca(p)} style={{
                  textAlign: 'left', padding: '8px 10px', borderRadius: 7, cursor: 'pointer', ...body,
                  background: emCampo ? '#B5393F22' : 'transparent',
                  border: `1px solid ${emCampo ? '#B5393F' : T.line}`,
                  color: T.cream, fontSize: 12.5,
                }}>
                  <span style={{ ...mono, fontSize: 10, color: T.mutedDim }}>{p.position || '--'}</span>{' '}
                  {p.name}
                  <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim, float: 'right' }}>
                    {jogo.minutosPorJogador.get(p.id) || 0}′{emCampo ? ' · em campo' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}

/* Controlo da rotação: quem levou mais e menos minutos. */
export function MinutosPorJogador({ presentes, minutos, players, isNarrow }) {
  const max = Math.max(...Array.from(minutos.values()), 1);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 }}>
      <h3 style={{ ...display, color: T.cream, fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Minutos por jogador</h3>
      <p style={{ color: T.mutedDim, fontSize: 12, margin: '0 0 12px' }}>Serve para confirmar que ficou equilibrado.</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isNarrow ? 130 : 165}px, 1fr))`, gap: 6 }}>
        {sortByPosition(presentes).map(j => {
          const m = minutos.get(j.id) || 0;
          return (
            /* Cada jogador numa CAIXA PRÓPRIA.

               Em colunas lado a lado sem separação, os minutos de um
               jogador encostavam ao nome do jogador seguinte e liam-se
               como se fossem dele. A moldura fecha cada conjunto e acaba
               com a ambiguidade. */
            <div key={j.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
              background: T.bg, border: `1px solid ${T.line}`, borderRadius: 7,
              padding: '5px 8px', minWidth: 0,
            }}>
              <span style={{ ...mono, fontSize: 11.5, color: m === 0 ? T.bad : T.warn, flexShrink: 0, minWidth: 30, textAlign: 'right' }}>{m}′</span>
              <span style={{ width: 26, height: 4, background: T.line, borderRadius: 2, flexShrink: 0, overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${(m / max) * 100}%`, height: '100%', background: T.warn }} />
              </span>
              <span style={{ flex: 1, minWidth: 0, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ ...mono, fontSize: 10.5, color: j.convidado ? T.gold : T.mutedDim }}>{j.position || '--'}</span>{' '}
                {shortPlayerName(j, presentes)}
                {/* Marca discreta: à experiência não é do plantel, e essa
                    distinção tem de ser visível ao olhar para a lista. */}
                {j.convidado && <span style={{ color: T.gold, fontSize: 10.5 }}> · exp</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Dashboard individual da aba Jogos — ranking de golos, assistências,
   cartões e nota média atribuída, usando o mesmo cálculo do Plantel. */
/* ================================================================
   FICHA DE JOGO

   Abre ao clicar num jogo e mostra, num só ecrã, o que aconteceu:
   o onze no campo, quem entrou, quem marcou, quem viu cartão.

   Não pede nada de novo ao treinador — lê o relatório que ele já
   preenche na ficha de edição (minutos, golos, assistências, cartão,
   nota) e o onze que já escolheu.
================================================================ */

/* Coloca os titulares nos lugares da formação.

   O treinador escolhe QUEM joga; a formação diz ONDE. Esta função junta
   as duas coisas: para cada lugar do desenho, procura entre os titulares
   ainda por colocar o que melhor lhe serve.

   CADA LUGAR SÓ ACEITA A SUA FAMÍLIA — guarda-redes só com guarda-redes,
   defesa (DD/DE/DC/DC) só com defesas, meio-campo (MD/MC/MC) só com
   médios, ataque (EE/ED/PL) só com avançados. Nunca troca entre
   famílias: se faltarem avançados a sério, o lugar de avançado FICA EM
   BRANCO — nunca um médio ou um defesa por lá enfiado, doa a quem
   doer. Um médio a acabar no ataque (ou vice-versa) não é um "onze
   possível", é só confuso. */
export function preencherPorFamilia(posicoesAPreencher, pool, colocados) {
  const familiaDoLugar = (lugar) => (lugar === 'GR' ? 'GR' : (FAMILIA[lugar] || 'MEIO'));

  /* OS CORREDORES SÃO OS ÚLTIMOS A SER PREENCHIDOS.

     Como AD e AE aceitam qualquer jogador de campo, preenchê-los pela
     ordem da formação deixava-os levar um avançado ou um central que
     fazia falta ao seu próprio lugar — e esse lugar, esse, é de família
     fechada e ficava em branco. Preenchidos no fim, ficam com quem
     sobra, que é exatamente o que um lugar sem família própria deve
     fazer. A ordem de preenchimento muda; os lugares no campo não. */
  const ordemDePreenchimento = [
    ...posicoesAPreencher.filter(({ lugar }) => !LUGARES_DE_ALA.has(lugar)),
    ...posicoesAPreencher.filter(({ lugar }) => LUGARES_DE_ALA.has(lugar)),
  ];

  ordemDePreenchimento.forEach(({ lugar, i }) => {
    const familia = familiaDoLugar(lugar);
    const eGR = familia === 'GR';
    /* Exceção dos corredores (ver LUGARES_DE_ALA): AD e AE aceitam
       qualquer jogador de campo, porque um ala tanto é lateral como
       extremo como médio. A preferência continua a existir — `nota`
       coloca primeiro quem `posicaoServe` reconhece para o lado certo. */
    const candidatos = pool.filter(p => {
      if (eGR) return ehGuardaRedes(p);
      if (ehGuardaRedes(p)) return false;
      if (LUGARES_DE_ALA.has(lugar)) return true;
      return familiaDe(p) === familia;
    });
    if (!candidatos.length) return; // sem ninguém da família certa — fica em branco, não se força nada
    const nota = (p) => (posicaoServe(lugar, p) || p.position === lugar ? 0 : 1);
    const escolhido = candidatos.reduce((melhor, p) => (nota(p) < nota(melhor) ? p : melhor), candidatos[0]);
    colocados[i] = escolhido;
    pool.splice(pool.indexOf(escolhido), 1);
  });
}

export function distribuirOnzeNoCampo(titulares, formacao, alinhamento) {
  const lugares = FORMACOES[formacao] || FORMACOES['4-3-3'];

  /* ALINHAMENTO ESCOLHIDO À MÃO tem prioridade sobre a sugestão.

     `alinhamento` é uma lista de ids, uma por lugar. Quando existe, é ela
     que manda: o treinador arrumou a equipa como quer e o cálculo
     automático não lhe pode voltar a mexer.

     Os jogadores que estejam no alinhamento mas já não sejam titulares
     são ignorados, e os titulares que faltem ao alinhamento são colocados
     a seguir pelo caminho normal — assim uma mudança no onze não obriga a
     refazer tudo à mão. */
  if (Array.isArray(alinhamento) && alinhamento.length) {
    const porId = new Map(titulares.map(p => [p.id, p]));
    const colocadosManual = lugares.map((_, i) => {
      const id = alinhamento[i];
      const p = id && porId.get(id);
      if (p) porId.delete(id);
      return p || null;
    });
    const restantes = [...porId.values()];
    // Os que sobraram entram nos lugares ainda vazios, pela mesma regra
    // de família em bloco usada no preenchimento automático.
    if (restantes.length) {
      const posicoesVazias = colocadosManual
        .map((v, i) => (v ? null : { lugar: lugares[i], i }))
        .filter(Boolean);
      preencherPorFamilia(posicoesVazias, restantes, colocadosManual);
    }
    const usados = new Set(colocadosManual.filter(Boolean).map(p => p.id));
    return { lugares, colocados: colocadosManual, sobram: titulares.filter(p => !usados.has(p.id)) };
  }

  const porColocar = [...titulares];
  const colocados = new Array(lugares.length).fill(null);
  preencherPorFamilia(lugares.map((lugar, i) => ({ lugar, i })), porColocar, colocados);

  return { lugares, colocados, sobram: porColocar };
}

