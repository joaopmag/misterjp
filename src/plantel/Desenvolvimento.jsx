// plantel/Desenvolvimento.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { uid, todayStr, fmtDate } from '../base/utilidades';
import { T, mono, body, TEXT_ON_ACCENT, display } from '../base/tema';
import React, { useState, useRef } from 'react';
import { Modal, Field, TextArea, Btn, useIsMobile, inputStyle, FIELD_GRID, EmptyState, askConfirm, offerUndo, Select, SectionHeader, Input } from '../base/ui';
import { Check, ChevronRight, FileText, Pencil, Plus, Trash2, RotateCw, X } from 'lucide-react';
import { TreinosParaEditorCtx } from '../tatico/prancheta';
import { sortByPosition, shortPlayerName, PlayerChipList } from '../dominio/jogadores';
import { SelectAllBar } from '../dominio/convidados';
import { FASES_AVALIACAO, STATUS_OPTIONS, avaliacaoBaseDoJogador, avaliacaoDaEpoca, jogadorComAvaliacao } from './avaliacao';
import { MOBILE_BAR_H } from '../base/fotos';

/* ================================================================
   DESENVOLVIMENTO INDIVIDUAL — motor de cálculo

   Escrito e testado à parte antes de entrar no App.jsx. Tudo aqui são
   funções puras: dados a entrar, dados a sair, sem estado nem interface.
   É isso que permite testar cada regra sozinha — e foi assim que se
   apanharam vários erros antes de chegarem ao ecrã.
================================================================ */

/* AS SEIS DIMENSÕES E OS SEUS PESOS.

   Os pesos somam 1 e são usados para o Score Global. Ficam aqui, num
   sítio só, porque o documento prevê poder alterá-los mais tarde sem
   mexer no resto. */
export const DI_DIMENSOES = [
  { id: 'valores', label: 'Valores & Comportamento', peso: 0.20 },
  { id: 'tecnica', label: 'Técnica', peso: 0.20 },
  { id: 'tatica', label: 'Tática & Inteligência de Jogo', peso: 0.25 },
  { id: 'fisica', label: 'Capacidade Física', peso: 0.15 },
  { id: 'mental', label: 'Mental & Competitivo', peso: 0.10 },
  { id: 'aprendizagem', label: 'Aprendizagem & Desenvolvimento', peso: 0.10 },
];

/* GRUPOS DE POSIÇÃO — para adaptar o TEXTO de alguns indicadores.

   Só agrupa para efeitos de FRASE do questionário: o id, a dimensão e o
   peso do indicador são sempre os mesmos para todos, por isso o score,
   o GAP e o histórico continuam a comparar-se normalmente entre
   jogadores de posições diferentes. Só muda o que se lê. */
export const DI_GRUPO_POSICAO = {
  GR: 'GR',
  DC: 'DEF', DE: 'DEF', DD: 'DEF',
  MD: 'MEIO', MC: 'MEIO', MOC: 'MEIO',
  EE: 'AVANCADO', ED: 'AVANCADO', PL: 'AVANCADO',
};

export const diGrupoPosicao = (posicao) => DI_GRUPO_POSICAO[posicao] || null;

/* NOTA SOBRE OS IDs.

   `id` é curto e estável: é ele que fica gravado em cada resposta. Se um
   dia o texto da pergunta mudar, as respostas antigas continuam a fazer
   sentido porque estão ligadas ao id e não ao texto.

   `curto` é o rótulo do radar detalhado, onde a frase inteira não cabe.

   `variantes` (opcional) reescreve `curto`/`texto` para um grupo de
   posição, quando a frase original não faz sentido para essa posição
   (ex: "finalização" para um GR). Sem variante, usa-se o texto normal. */
/* OS 30 INDICADORES.

   Eram 40 e passaram a 30 por corte deliberado, não por poupança de
   ecrã: dez diziam o que outras já diziam. "Cumpro as regras mesmo
   quando ninguém está a controlar" e "comportamentos compatíveis com um
   jogador de formação" são a pergunta do respeito por outras palavras;
   "repetir esforços" e "recuperar entre esforços" são a intensidade
   vista de outro ângulo; "velocidade de execução" é a técnica sob
   pressão. Perguntas a mais não medem mais — cansam quem responde e
   diluem o que interessa.

   Saiu também "Demonstro evolução ao longo do tempo", que era a única
   que pedia um RESULTADO em vez de um comportamento, e a única que um
   jogador não consegue autoavaliar com honestidade: não se vê de fora.

   TÉCNICA E TÁCTICA ADAPTAM-SE À POSIÇÃO. Perguntar a um guarda-redes se
   supera o adversário no 1x1 ofensivo, ou a um central se dá o último
   passe, é pedir-lhe que responda a um jogo que não é o dele. O `id`, a
   dimensão e o peso são sempre os mesmos — só muda a FRASE — por isso o
   score, o GAP e o histórico continuam a comparar-se entre posições. */
export const DI_INDICADORES = [
  // VALORES & COMPORTAMENTO (5)
  { id: 'v1', dim: 'valores', curto: 'Pontualidade', texto: 'Cumpro os horários definidos pela equipa sem precisar que me lembrem.' },
  { id: 'v2', dim: 'valores', curto: 'Compromisso no treino', texto: 'Demonstro compromisso e intensidade em todos os treinos.' },
  { id: 'v3', dim: 'valores', curto: 'Respeito e conduta', texto: 'Respeito colegas, treinadores, adversários e árbitros, dentro e fora do campo.' },
  { id: 'v5', dim: 'valores', curto: 'Equipa acima do individual', texto: 'Coloco os objetivos da equipa acima dos meus interesses individuais.' },
  { id: 'v6', dim: 'valores', curto: 'Atitude na dificuldade', texto: 'Mantenho uma atitude positiva perante dificuldades, erros ou decisões com que não concordo.' },

  // TÉCNICA (6)
  {
    id: 't1', dim: 'tecnica', curto: 'Receção e preparação',
    texto: 'Consigo receber a bola e preparar o próximo gesto técnico com qualidade.',
    variantes: {
      GR: { curto: 'Receção com os pés', texto: 'Consigo receber e controlar a bola com os pés sob pressão, para sair a jogar.' },
      DEF: { curto: 'Receção orientada', texto: 'Consigo receber a bola já orientado para o lado onde vou jogar.' },
      MEIO: { curto: 'Receção entre linhas', texto: 'Consigo receber entre linhas já orientado para a frente.' },
      AVANCADO: { curto: 'Receção de costas', texto: 'Consigo receber de costas para a baliza e segurar a bola com o defesa em cima.' },
    },
  },
  {
    id: 't2', dim: 'tecnica', curto: 'Passe',
    texto: 'Consigo executar passes com precisão e no momento certo.',
    variantes: {
      GR: { curto: 'Distribuição', texto: 'Consigo distribuir curto e longo com critério, escolhendo o lado que está livre.' },
      DEF: { curto: 'Passe e mudança de corredor', texto: 'Consigo passar com precisão e mudar o corredor quando é preciso.' },
      MEIO: { curto: 'Passe entre linhas', texto: 'Consigo passar entre linhas e quebrar a linha de pressão adversária.' },
      AVANCADO: { curto: 'Último passe', texto: 'Consigo dar o último passe e assistir quem entra em profundidade.' },
    },
  },
  {
    id: 't4', dim: 'tecnica', curto: 'Condução',
    texto: 'Consigo conduzir e transportar a bola mantendo controlo e velocidade.',
    variantes: {
      GR: { curto: 'Jogo de pés', texto: 'Consigo jogar de pés na zona de pressão sem perder a bola.' },
      DEF: { curto: 'Condução para atrair', texto: 'Consigo conduzir para atrair o adversário e abrir linha de passe.' },
      MEIO: { curto: 'Condução a progredir', texto: 'Consigo conduzir a progredir no campo, saindo da pressão.' },
      AVANCADO: { curto: 'Condução em velocidade', texto: 'Consigo conduzir em velocidade a atacar o defesa.' },
    },
  },
  {
    id: 't5', dim: 'tecnica', curto: '1x1 ofensivo',
    texto: 'Consigo superar um adversário no 1x1 ofensivo quando a situação o exige.',
    variantes: {
      GR: { curto: '1x1 defensivo', texto: 'Consigo resolver com segurança situações de 1x1 fora da área (saídas e coberturas).' },
      DEF: { curto: '1x1 defensivo', texto: 'Consigo ganhar o duelo individual (1x1) quando um adversário vem em condução na minha direção.' },
      MEIO: { curto: 'Duelo e proteção', texto: 'Consigo recuperar no duelo individual e proteger a bola quando sou pressionado.' },
      AVANCADO: { curto: '1x1 ofensivo', texto: 'Consigo superar o defesa no 1x1 quando a situação o exige.' },
    },
  },
  {
    id: 't6', dim: 'tecnica', curto: 'Finalização',
    texto: 'Consigo executar a finalização com qualidade e eficácia.',
    variantes: {
      GR: { curto: 'Defesa e blocagem', texto: 'Consigo defender e blocar com segurança, incluindo remates de fora da área.' },
      DEF: { curto: 'Finalização em bola parada', texto: 'Consigo finalizar com eficácia as oportunidades de bola parada (cabeceamento, segunda bola).' },
      MEIO: { curto: 'Remate de fora', texto: 'Consigo rematar de fora da área e aparecer na segunda bola.' },
      AVANCADO: { curto: 'Finalização', texto: 'Consigo finalizar com qualidade e eficácia as oportunidades que tenho.' },
    },
  },
  { id: 't7', dim: 'tecnica', curto: 'Técnica sob pressão', texto: 'Consigo executar ações técnicas com qualidade mesmo sob pressão do adversário.' },

  // TÁTICA & INTELIGÊNCIA DE JOGO (7)
  { id: 'x1', dim: 'tatica', curto: 'Função no modelo', texto: 'Compreendo claramente a minha função dentro do modelo de jogo.' },
  {
    id: 'x2', dim: 'tatica', curto: 'Ocupação de espaços',
    texto: 'Ocupo corretamente os espaços em função da posição da bola e dos meus colegas.',
    variantes: {
      GR: { curto: 'Posição e profundidade', texto: 'Ajusto a minha posição à bola, dando profundidade à linha defensiva.' },
      DEF: { curto: 'Linha e distâncias', texto: 'Mantenho a linha e a distância certa aos meus colegas de setor.' },
      MEIO: { curto: 'Espaço entre linhas', texto: 'Ocupo o espaço entre linhas e dou apoio aos lados.' },
      AVANCADO: { curto: 'Largura e profundidade', texto: 'Ocupo a largura e a profundidade para esticar o bloco adversário.' },
    },
  },
  {
    id: 'x3', dim: 'tatica', curto: 'Linhas de passe',
    texto: 'Consigo identificar e criar linhas de passe para ajudar a equipa.',
    variantes: {
      GR: { curto: 'Apoio para trás', texto: 'Ofereço-me como apoio para trás sempre que a equipa precisa de sair a jogar.' },
      DEF: { curto: 'Abrir na saída', texto: 'Abro para dar linha de passe na saída de bola.' },
      MEIO: { curto: 'Linhas entre linhas', texto: 'Crio linhas de passe entre linhas para receber e progredir.' },
      AVANCADO: { curto: 'Desmarcações', texto: 'Faço desmarcações de rutura e de apoio no momento certo.' },
    },
  },
  { id: 'x4', dim: 'tatica', curto: 'Tomada de decisão', texto: 'Tomo boas decisões sobre quando passar, conduzir, jogar para a frente ou conservar a bola.' },
  {
    id: 'x6', dim: 'tatica', curto: 'Reação à perda',
    texto: 'Reajo rapidamente à perda da bola e cumpro os princípios de pressão definidos pela equipa.',
    variantes: {
      GR: { curto: 'Ler as costas da defesa', texto: 'Antecipo a saída e leio as costas da linha defensiva quando perdemos a bola.' },
      DEF: { curto: 'Cobertura e atraso', texto: 'Faço cobertura e atraso o adversário quando perdemos a bola.' },
      MEIO: { curto: 'Pressão imediata', texto: 'Pressiono de imediato o portador da bola quando a perdemos.' },
      AVANCADO: { curto: 'Primeira pressão', texto: 'Faço a primeira pressão e oriento o adversário para o lado que a equipa quer.' },
    },
  },
  {
    id: 'x7', dim: 'tatica', curto: 'Início da transição',
    texto: 'Quando recupero a posse, decido rapidamente entre jogar curto ou longo para iniciar a transição ofensiva.',
    variantes: {
      GR: { curto: 'Lançar a transição', texto: 'Quando fico com a bola, decido rápido entre lançar curto ou longo para atacar o desequilíbrio.' },
      DEF: { curto: 'Sair a jogar ou ganhar campo', texto: 'Quando recupero a bola, decido entre sair a jogar ou ganhar campo conforme a pressão.' },
      MEIO: { curto: 'Decidir na recuperação', texto: 'Quando recupero a bola, recebo e decido rapidamente entre curto e longo.' },
      AVANCADO: { curto: 'Segurar ou atacar', texto: 'Na transição, decido entre segurar a bola para a equipa subir ou atacar a profundidade.' },
    },
  },
  {
    id: 'x8', dim: 'tatica', curto: 'Organizar a defesa',
    texto: 'Compreendo os comportamentos coletivos defensivos e dou as indicações certas para organizar a equipa.',
    variantes: {
      GR: { curto: 'Organizar a linha', texto: 'Dou indicações e organizo a linha defensiva a partir de trás.' },
      DEF: { curto: 'Organizar e comunicar', texto: 'Organizo a linha defensiva e comunico o momento de subir ou baixar.' },
      MEIO: { curto: 'Equilíbrio e cobertura', texto: 'Faço o equilíbrio e a cobertura ao meio-campo quando a equipa ataca.' },
      AVANCADO: { curto: 'Orientar a pressão', texto: 'Oriento a pressão da equipa e fecho o lado que queremos condicionar.' },
    },
  },

  // CAPACIDADE FÍSICA (4)
  { id: 'f1', dim: 'fisica', curto: 'Intensidade', texto: 'Mantenho intensidade elevada e consigo repeti-la ao longo do treino e do jogo.' },
  { id: 'f3', dim: 'fisica', curto: 'Velocidade', texto: 'Tenho velocidade e aceleração adequadas às exigências da minha posição.' },
  { id: 'f4', dim: 'fisica', curto: 'Força e contacto', texto: 'Tenho força e capacidade de contacto adequadas às exigências da minha posição.' },
  { id: 'f5', dim: 'fisica', curto: 'Agilidade', texto: 'Tenho agilidade e capacidade para mudar de direção rapidamente.' },

  // MENTAL & COMPETITIVO (4)
  { id: 'm1', dim: 'mental', curto: 'Concentração', texto: 'Mantenho a concentração durante todo o treino e jogo.' },
  { id: 'm2', dim: 'mental', curto: 'Reação ao erro', texto: 'Reajo positivamente aos meus erros e tento corrigi-los imediatamente.' },
  { id: 'm4', dim: 'mental', curto: 'Assumir responsabilidade', texto: 'Demonstro confiança para assumir responsabilidades dentro do jogo.' },
  { id: 'm5', dim: 'mental', curto: 'Competir até ao fim', texto: 'Continuo a competir e a dar o máximo mesmo quando as coisas não estão a correr bem.' },

  // APRENDIZAGEM & DESENVOLVIMENTO (4)
  { id: 'a1', dim: 'aprendizagem', curto: 'Compreender a instrução', texto: 'Procuro perceber o motivo pelo qual o treinador me dá determinada instrução.' },
  { id: 'a2', dim: 'aprendizagem', curto: 'Aceitar feedback', texto: 'Aceito o feedback dos treinadores e tento aplicá-lo.' },
  { id: 'a3', dim: 'aprendizagem', curto: 'Autoconhecimento', texto: 'Consigo identificar os meus principais pontos fortes e os aspetos em que preciso de melhorar.' },
  { id: 'a5', dim: 'aprendizagem', curto: 'Procura de melhoria', texto: 'Procuro ativamente formas de melhorar como jogador.' },
];

/* Escala de frequência (e não de qualidade): os indicadores estão escritos
   como comportamentos, e o que se mede é quantas vezes acontecem. */
export const DI_ESCALA = [
  { valor: 1, label: 'Nunca', desc: 'Não demonstro este comportamento.' },
  { valor: 2, label: 'Raramente', desc: 'Poucas vezes e de forma inconsistente.' },
  { valor: 3, label: 'Às vezes', desc: 'Em algumas situações, ainda com inconsistência.' },
  { valor: 4, label: 'Frequentemente', desc: 'Na maioria das situações.' },
  { valor: 5, label: 'Quase sempre', desc: 'De forma consistente, incluindo em situações exigentes.' },
];

/* As três perguntas abertas do jogador, a seguir às 40 fechadas. */
export const DI_ABERTAS = [
  { id: 'q41', texto: 'Qual consideras ser atualmente o teu principal ponto forte como jogador?' },
  { id: 'q42', texto: 'Qual consideras ser atualmente o aspeto do teu jogo que mais precisas de melhorar?' },
  { id: 'q43', texto: 'O que estás disposto a fazer concretamente para melhorar esse aspeto?' },
];

export const diIndicadoresDa = (dimId) => DI_INDICADORES.filter(i => i.dim === dimId);

/* Texto de um indicador, adaptado à posição do jogador quando existe
   variante — caso contrário, o texto normal. O id nunca muda, por isso
   isto é só sobre o que se lê, nunca sobre o que fica gravado. */
export function diTextoIndicador(ind, posicao) {
  const grupo = diGrupoPosicao(posicao);
  const v = grupo && ind.variantes && ind.variantes[grupo];
  return (v && v.texto) || ind.texto;
}

/* ----------------------------------------------------------------
   MÉDIAS POR DIMENSÃO

   `respostas` é um objeto { indicadorId: 1..5 | 'na' | undefined }.

   O N/A não é zero: sai do numerador E do denominador. Contá-lo como
   zero castigaria o jogador por o treinador não ter tido oportunidade de
   o observar, que é exatamente o contrário do que o N/A significa.
---------------------------------------------------------------- */
export function diMediaDimensao(respostas, dimId) {
  const indicadores = diIndicadoresDa(dimId);
  const validas = indicadores
    .map(i => respostas && respostas[i.id])
    .filter(v => typeof v === 'number' && v >= 1 && v <= 5);
  if (!validas.length) return { media: null, validos: 0, total: indicadores.length };
  const soma = validas.reduce((a, v) => a + v, 0);
  return {
    media: soma / validas.length,
    validos: validas.length,
    total: indicadores.length,
  };
}

export function diMedias(respostas) {
  const out = {};
  DI_DIMENSOES.forEach(d => { out[d.id] = diMediaDimensao(respostas, d.id); });
  return out;
}

/* ----------------------------------------------------------------
   SCORE GLOBAL

   Média das dimensões, ponderada pelos pesos. Uma dimensão SEM nenhuma
   resposta válida não pode entrar com zero — sairia um score baixíssimo
   por falta de dados e não por falta de qualidade. Por isso é excluída, e
   os pesos das restantes são renormalizados para continuarem a somar 1.

   `fiabilidade` avisa quando há poucas respostas: com metade dos
   indicadores por responder, o número existe mas vale pouco, e quem o lê
   tem de saber disso.
---------------------------------------------------------------- */
export function diScoreGlobal(respostas) {
  const medias = diMedias(respostas);
  const comDados = DI_DIMENSOES.filter(d => medias[d.id].media != null);
  if (!comDados.length) return { score: null, fiabilidade: 'sem dados', medias, validos: 0, total: DI_INDICADORES.length };

  const pesoTotal = comDados.reduce((a, d) => a + d.peso, 0);
  const score = comDados.reduce((a, d) => a + medias[d.id].media * (d.peso / pesoTotal), 0);

  const validos = DI_DIMENSOES.reduce((a, d) => a + medias[d.id].validos, 0);
  const total = DI_INDICADORES.length;
  const proporcao = validos / total;
  const fiabilidade = proporcao >= 0.85 ? 'alta' : (proporcao >= 0.6 ? 'média' : 'baixa');

  return { score, fiabilidade, medias, validos, total, dimensoesSemDados: DI_DIMENSOES.length - comDados.length };
}

/* ----------------------------------------------------------------
   GAP = autoavaliação − avaliação da equipa técnica

   Positivo: o jogador vê-se acima do que a equipa técnica vê.
   Negativo: vê-se abaixo.
   Perto de zero: perceções alinhadas.

   Não se classifica o GAP como bom ou mau: é um indicador de
   AUTOCONSCIÊNCIA, e tanto o excesso como a falta de confiança são
   informação útil para a conversa — não um defeito a corrigir.

   Um indicador só entra no GAP se AMBOS o responderam. Comparar uma
   resposta com um N/A não é uma diferença de perceção, é ausência de
   dados dos dois lados.
---------------------------------------------------------------- */
export function diGapIndicadores(auto, staff) {
  const out = {};
  DI_INDICADORES.forEach(i => {
    const a = auto && auto[i.id];
    const s = staff && staff[i.id];
    if (typeof a === 'number' && typeof s === 'number') out[i.id] = a - s;
  });
  return out;
}

export function diGapDimensoes(auto, staff) {
  const gaps = diGapIndicadores(auto, staff);
  const out = {};
  DI_DIMENSOES.forEach(d => {
    const vals = diIndicadoresDa(d.id).map(i => gaps[i.id]).filter(v => typeof v === 'number');
    out[d.id] = vals.length ? { gap: vals.reduce((a, v) => a + v, 0) / vals.length, indicadores: vals.length } : { gap: null, indicadores: 0 };
  });
  return out;
}

export function diGapGlobal(auto, staff) {
  const sa = diScoreGlobal(auto).score;
  const ss = diScoreGlobal(staff).score;
  if (sa == null || ss == null) return null;
  return sa - ss;
}

/* ----------------------------------------------------------------
   CLASSIFICAÇÃO DE UM SCORE
---------------------------------------------------------------- */
export const DI_FAIXAS = [
  { id: 'alta', ate: 3.00, label: 'Prioridade alta', cor: 'bad' },
  { id: 'desenvolvimento', ate: 3.50, label: 'Prioridade de desenvolvimento', cor: 'warn' },
  { id: 'emCurso', ate: 4.00, label: 'Competência em desenvolvimento', cor: 'muted' },
  { id: 'forte', ate: Infinity, label: 'Ponto forte', cor: 'good' },
];

export function diClassificar(score) {
  if (score == null) return null;
  // `<` e não `<=`: 3,00 exato já não é "prioridade alta" (o documento diz
  // "< 3,00" para alta e "3,00–3,49" para a faixa seguinte).
  return DI_FAIXAS.find(f => score < f.ate) || DI_FAIXAS[DI_FAIXAS.length - 1];
}

/* ----------------------------------------------------------------
   TOP 3 PRIORIDADES — SUGESTÃO, não decisão

   Ordena as dimensões por uma nota que junta os critérios do documento:

   · score mais baixo pesa mais (é o critério principal);
   · o PESO da dimensão amplifica: uma tática fraca custa mais à equipa do
     que uma aprendizagem fraca, com o mesmo score;
   · regressão desde o momento anterior sobe a prioridade — um jogador que
     PIOROU precisa de atenção antes de um que está estável;
   · GAP grande sobe ligeiramente: o jogador não vê o que a equipa vê, e
     isso costuma ser trabalho de conversa antes de ser de campo.

   Devolve sempre uma lista ordenada com o motivo de cada uma, para o
   treinador poder discordar com conhecimento de causa.
---------------------------------------------------------------- */
export function diPrioridades(staffResp, autoResp, mediasAnteriores) {
  const medias = diMedias(staffResp);
  const gaps = diGapDimensoes(autoResp, staffResp);

  const linhas = DI_DIMENSOES.map(d => {
    const m = medias[d.id].media;
    if (m == null) return null;

    const anterior = mediasAnteriores && mediasAnteriores[d.id] != null ? mediasAnteriores[d.id] : null;
    const evolucao = anterior == null ? null : m - anterior;
    const gap = gaps[d.id].gap;

    // Nota alta = mais prioritário.
    let nota = (5 - m) * (1 + d.peso);
    const motivos = [];
    if (m < 3) motivos.push('score abaixo de 3,0');
    else if (m < 3.5) motivos.push('score na faixa de desenvolvimento');

    if (evolucao != null && evolucao < -0.2) {
      nota += 0.6;
      motivos.push(`desceu ${Math.abs(evolucao).toFixed(1)} desde a avaliação anterior`);
    }
    if (gap != null && Math.abs(gap) >= 0.8) {
      nota += 0.3;
      motivos.push(gap > 0 ? 'o jogador vê-se bastante acima da equipa técnica' : 'o jogador vê-se bastante abaixo da equipa técnica');
    }
    if (d.peso >= 0.20) motivos.push('dimensão de peso elevado');

    return { dim: d.id, label: d.label, media: m, evolucao, gap, nota, motivos, faixa: diClassificar(m) };
  }).filter(Boolean);

  return linhas.sort((a, b) => b.nota - a.nota);
}

/* Pontos fortes: dimensões em 4,0 ou acima, da mais alta para a mais baixa. */
export function diPontosFortes(staffResp) {
  const medias = diMedias(staffResp);
  return DI_DIMENSOES
    .map(d => ({ dim: d.id, label: d.label, media: medias[d.id].media }))
    .filter(x => x.media != null && x.media >= 4)
    .sort((a, b) => b.media - a.media);
}

/* ----------------------------------------------------------------
   ESTADO DE UM JOGADOR DENTRO DE UM MOMENTO

   Derivado dos dados e não guardado à parte: dois sítios a dizer em que
   pé está o processo acabam sempre por discordar um do outro.
---------------------------------------------------------------- */
export const DI_ESTADOS = [
  { id: 'pendente', label: 'Pendente' },
  { id: 'enviado', label: 'Questionário enviado' },
  { id: 'auto', label: 'Autoavaliação concluída' },
  { id: 'staff', label: 'Avaliação staff concluída' },
  { id: 'combinada', label: 'Avaliações combinadas' },
  { id: 'reuniao', label: 'Reunião realizada' },
  { id: 'plano', label: 'Plano ativo' },
  { id: 'concluido', label: 'Plano concluído' },
];

export function diRespondido(respostas) {
  if (!respostas) return 0;
  return DI_INDICADORES.filter(i => {
    const v = respostas[i.id];
    return (typeof v === 'number' && v >= 1 && v <= 5) || v === 'na';
  }).length;
}

export function diEstado(registo) {
  if (!registo) return 'pendente';
  if (registo.planoConcluido) return 'concluido';
  if (registo.plano && (registo.plano.objetivos || []).length) return 'plano';
  if (registo.reuniaoFeita) return 'reuniao';
  if (registo.combinada) return 'combinada';

  const auto = diRespondido(registo.auto) === DI_INDICADORES.length;
  const staff = diRespondido(registo.staff) === DI_INDICADORES.length;
  if (staff) return 'staff';
  if (auto) return 'auto';
  if (registo.enviado) return 'enviado';
  return 'pendente';
}

export const DI_ESTADO_LABEL = (id) => (DI_ESTADOS.find(e => e.id === id) || {}).label || id;

/* ----------------------------------------------------------------
   PLANO INDIVIDUAL DE DESENVOLVIMENTO
---------------------------------------------------------------- */
export const DI_ESTADOS_OBJETIVO = ['Não iniciado', 'Em desenvolvimento', 'Em progresso', 'Consolidado', 'Concluído'];

export const DI_RESPONSAVEIS = ['Jogador', 'Treinador', 'Jogador + Treinador', 'Outro elemento do staff'];

export const DI_MAX_OBJETIVOS = 3;

export function diObjetivoVazio(area) {
  return {
    id: `obj-${Math.random().toString(36).slice(2, 9)}`,
    area: area || '',
    objetivo: '',
    porque: '',
    acoes: [],
    indicador: '',
    prazo: '',
    responsavel: 'Jogador + Treinador',
    estado: 'Não iniciado',
    progresso: 1,
    observacoes: '',
  };
}

/* ================================================================
   DESENVOLVIMENTO INDIVIDUAL — interface

   Sete separadores sobre a MESMA estrutura de dados: uma lista de
   momentos de avaliação, cada um com um registo por jogador. Nada é
   duplicado — os jogadores vêm do Plantel, como em todo o resto da app.
================================================================ */

/* COMO OS DADOS ESTÃO GUARDADOS

   A coleção `desenvolvimento` tem DUAS espécies de linha, distinguidas
   pelo campo `tipo`:

     · momento — nome, data, prazo, fechado. Uma linha por momento.
     · registo — momentoId + playerId + as respostas de um jogador.
                 Uma linha POR JOGADOR e por momento.

   Porque não um momento com os jogadores todos lá dentro, que seria mais
   arrumado de ler: porque a app grava um registo INTEIRO de cada vez que
   alguma coisa muda. Um momento com 36 jogadores pesa ~230 KB, e cada
   clique num indicador reenviava esses 230 KB — nove megabytes para
   avaliar um jogador, e a aproximar-se do limite de 1 MB do realtime do
   Supabase.

   Separado por jogador, cada linha tem ~6 KB e um clique reenvia só
   esses. São 36 vezes menos dados por clique, e o limite deixa de estar
   ao alcance por muito que o plantel cresça.

   O preço é a leitura ser um pouco mais trabalhosa (juntar as linhas),
   e é um preço que se paga uma vez aqui em cima em vez de a cada clique. */
export function diMomentoVazio(nome) {
  return {
    id: uid(),
    tipo: 'momento',
    nome: nome || '',
    data: todayStr(),
    prazo: '',
    fechado: false,
  };
}

export function diRegistoVazio(momentoId, playerId) {
  return { id: uid(), tipo: 'registo', momentoId, playerId, enviado: false };
}

// As linhas de momento, da mais recente para a mais antiga.
export function diMomentos(lista) {
  return (lista || [])
    .filter(x => x && x.tipo === 'momento')
    .sort((a, b) => new Date(b.data) - new Date(a.data));
}

/* Os registos de um momento, indexados por jogador. Feito uma vez por
   ecrã e não a cada consulta — com 36 jogadores, procurar na lista toda
   dentro de um `map` seria trabalho a dobrar sem necessidade. */
export function diRegistosDoMomento(lista, momentoId) {
  const mapa = new Map();
  (lista || []).forEach(x => {
    if (x && x.tipo === 'registo' && x.momentoId === momentoId) mapa.set(x.playerId, x);
  });
  return mapa;
}

export const diRegisto = (mapa, playerId) => (mapa && mapa.get ? mapa.get(playerId) : null) || null;

/* Radar de 6 eixos. Desenhado à mão em SVG e não com uma biblioteca:
   é geometria simples e evita mais uma dependência para uma coisa que a
   app usa num sítio só. */
export function DiRadar({ series, size = 260, max = 5 }) {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const raio = size * 0.34;
  const n = DI_DIMENSOES.length;

  const ponto = (i, valor) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = raio * (Math.max(0, Math.min(max, valor || 0)) / max);
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  };
  const pontoEixo = (i, f) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(ang) * raio * f, cy + Math.sin(ang) * raio * f];
  };

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {/* Anéis de referência: 1 a 5. */}
      {[0.2, 0.4, 0.6, 0.8, 1].map(f => (
        <polygon
          key={f}
          points={DI_DIMENSOES.map((_, i) => pontoEixo(i, f).join(',')).join(' ')}
          fill="none" stroke={T.line} strokeWidth="1"
        />
      ))}
      {DI_DIMENSOES.map((_, i) => {
        const [x, y] = pontoEixo(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={T.line} strokeWidth="1" />;
      })}

      {series.map((s, si) => (
        <g key={si}>
          <polygon
            points={DI_DIMENSOES.map((d, i) => ponto(i, s.valores[d.id]).join(',')).join(' ')}
            fill={`${s.cor}2E`} stroke={s.cor} strokeWidth="2" strokeLinejoin="round"
          />
          {DI_DIMENSOES.map((d, i) => {
            if (s.valores[d.id] == null) return null;
            const [x, y] = ponto(i, s.valores[d.id]);
            return <circle key={d.id} cx={x} cy={y} r="3" fill={s.cor} />;
          })}
        </g>
      ))}

      {/* Rótulos por fora, com o valor por baixo. */}
      {DI_DIMENSOES.map((d, i) => {
        const [x, y] = pontoEixo(i, 1.26);
        const anchor = Math.abs(x - cx) < 6 ? 'middle' : (x > cx ? 'start' : 'end');
        return (
          <text key={d.id} x={x} y={y} textAnchor={anchor} fontSize="9.5" fill={T.muted}
            style={{ fontFamily: "'Inter', sans-serif" }}>
            {d.label.split(' ')[0]}
          </text>
        );
      })}
    </svg>
  );
}

/* Barra de um valor de 1 a 5, com a cor da faixa. */
export function DiBarra({ valor, largura = 78 }) {
  const faixa = diClassificar(valor);
  const cor = valor == null ? T.line : ({ bad: T.bad, warn: T.warn, muted: T.mutedDim, good: T.good })[faixa.cor];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ ...mono, fontSize: 11.5, color: cor, minWidth: 26, textAlign: 'right' }}>
        {valor == null ? '—' : valor.toFixed(2)}
      </span>
      <span style={{ width: largura, height: 5, background: T.line, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ display: 'block', height: '100%', width: `${((valor || 0) / 5) * 100}%`, background: cor }} />
      </span>
    </span>
  );
}

/* Formulário dos indicadores.

   O número deixou de estar escrito: vem sempre de `DI_INDICADORES.length`.
   Estava em seis sítios, e mudar a lista sem mudar os seis dava contadores
   a dizer 34/40 para sempre — errado de uma forma que ninguém repara.
 Serve o staff (com N/A) e, quando o
   treinador regista a autoavaliação à mão, também o jogador (sem N/A). */
export function DiQuestionario({ titulo, subtitulo, posicao, respostas, comentarios, permitirNA, onChange, onComentario, onClose, onGuardar, onSubmeter, podeSubmeter, aSubmeter }) {
  const [dimAberta, setDimAberta] = useState(DI_DIMENSOES[0].id);
  const respondidos = diRespondido(respostas);
  const topoRef = useRef(null);

  /* Assim que a secção aberta fica 100% respondida, avançamos sozinhos
     para a seguinte — sem isto, o user tinha de fazer scroll ao topo e
     clicar na aba seguinte à mão, uma ação totalmente desnecessária. */
  const dimIndex = DI_DIMENSOES.findIndex(d => d.id === dimAberta);
  const feitosNaSeccao = diIndicadoresDa(dimAberta).filter(i => respostas && respostas[i.id] != null).length;
  const totalNaSeccao = diIndicadoresDa(dimAberta).length;
  const seccaoCompleta = feitosNaSeccao === totalNaSeccao;
  const proximaDim = seccaoCompleta && dimIndex < DI_DIMENSOES.length - 1 ? DI_DIMENSOES[dimIndex + 1] : null;

  const irParaProximaSeccao = () => {
    if (!proximaDim) return;
    setDimAberta(proximaDim.id);
  };

  return (
    <Modal title={titulo} subtitle={subtitulo} onClose={onClose} wide xwide fullPage>
      <div ref={topoRef} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ ...mono, fontSize: 12, color: respondidos === DI_INDICADORES.length ? T.good : T.warn }}>
          {respondidos} de {DI_INDICADORES.length} respondidos
        </span>
        <span style={{ flex: 1, minWidth: 80, height: 5, background: T.line, borderRadius: 3, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${(respondidos / DI_INDICADORES.length) * 100}%`, background: T.warn }} />
        </span>
      </div>

      {/* A escala fica sempre à vista: sem ela, o "3" de um treinador não
          quer dizer o mesmo que o "3" de outro. */}
      <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
          Com que frequência este comportamento acontece
        </div>
        {/* Em grelha e não em linha com `flexWrap`.

            Antes os cinco níveis fluíam como texto corrido: no telemóvel
            partiam onde calhava, com o "5 Quase sempre" a cair sozinho e
            desalinhado dos outros. Numa grelha ficam em colunas, cada
            nível com o número por cima do rótulo, e nunca partem a meio. */}
        <div style={{
          display: 'grid', gap: '7px 12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          fontSize: 11.5, color: T.mutedDim,
        }}>
          {DI_ESCALA.map(e => (
            <span key={e.valor} style={{ display: 'flex', gap: 5, alignItems: 'baseline', minWidth: 0 }}>
              <b style={{ color: T.cream, flexShrink: 0 }}>{e.valor}</b>
              <span style={{ minWidth: 0 }}>{e.label}</span>
            </span>
          ))}
          {permitirNA && (
            <span style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
              <b style={{ color: T.cream, flexShrink: 0 }}>N/A</b><span>não observado</span>
            </span>
          )}
        </div>
      </div>

      {/* AS SEIS DIMENSÕES EM GRELHA, TODAS DA MESMA LARGURA.

          Com `flexWrap` cada pílula tinha a largura do seu texto e a
          linha seguinte começava onde a anterior acabava: "Capacidade" e
          "Aprendizagem" ficavam desencontradas das de cima. Numa grelha
          de larguras iguais alinham em colunas, e a última linha não fica
          esticada nem torta. */}
      <div style={{
        display: 'grid', gap: 6, marginBottom: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
      }}>
        {DI_DIMENSOES.map(d => {
          const total = diIndicadoresDa(d.id).length;
          const feitos = diIndicadoresDa(d.id).filter(i => respostas && respostas[i.id] != null).length;
          const on = dimAberta === d.id;
          return (
            <button key={d.id} onClick={(ev) => { setDimAberta(d.id); ev.currentTarget.blur(); }} style={{
              padding: '7px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer', ...body,
              background: on ? '#B5393F' : 'transparent',
              color: on ? TEXT_ON_ACCENT : (feitos === total ? T.good : T.muted),
              border: `1px solid ${on ? '#B5393F' : T.line}`,
              textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {d.label.split(' ')[0]} {feitos}/{total}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {diIndicadoresDa(dimAberta).map((ind, k) => {
          const atual = respostas && respostas[ind.id];
          return (
            <div key={ind.id} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12.5, color: T.cream, marginBottom: 8, lineHeight: 1.45 }}>
                <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>{k + 1}.</span> {diTextoIndicador(ind, posicao)}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DI_ESCALA.map(e => (
                  <button
                    key={e.valor}
                    onClick={(ev) => { onChange(ind.id, atual === e.valor ? undefined : e.valor); ev.currentTarget.blur(); }}
                    title={e.desc}
                    style={{
                      padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer', ...body,
                      background: atual === e.valor ? '#B5393F' : 'transparent',
                      color: atual === e.valor ? TEXT_ON_ACCENT : T.muted,
                      border: `1px solid ${atual === e.valor ? '#B5393F' : T.line}`,
                    }}
                  >{e.valor}</button>
                ))}
                {permitirNA && (
                  <button
                    onClick={(ev) => { onChange(ind.id, atual === 'na' ? undefined : 'na'); ev.currentTarget.blur(); }}
                    title="Não observado — não entra nas médias nem prejudica o jogador"
                    style={{
                      padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer', ...body,
                      background: atual === 'na' ? `${T.gold}33` : 'transparent',
                      color: atual === 'na' ? T.gold : T.mutedDim,
                      border: `1px solid ${atual === 'na' ? T.gold : T.line}`,
                    }}
                  >N/A</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {onComentario && (
        <div style={{ marginTop: 14 }}>
          <Field label={`Comentário — ${(DI_DIMENSOES.find(d => d.id === dimAberta) || {}).label}`} solto>
            <TextArea
              value={(comentarios && comentarios[dimAberta]) || ''}
              onChange={e => onComentario(dimAberta, e.target.value)}
              placeholder="Opcional. Uma nota que ajude a preparar a conversa."
              style={{ minHeight: 60 }}
            />
          </Field>
        </div>
      )}

      {/* BOTÕES FIXOS no fundo do ecrã: as secções têm números diferentes
          de perguntas, e os botões andavam para cima e para baixo ao
          mudar de secção. Agora ficam sempre no mesmo sítio. */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap',
        position: 'sticky', bottom: 0, zIndex: 5, background: T.bg, padding: '12px 0 14px',
        borderTop: `1px solid ${T.line}`, boxShadow: `0 -10px 14px -10px ${T.bg}`,
      }}>
        <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
        {onGuardar && <Btn onClick={onGuardar}><Check size={15} /> Guardar</Btn>}
        {proximaDim && (
          <Btn onClick={irParaProximaSeccao}>
            {proximaDim.label.split(' ')[0]} <ChevronRight size={15} />
          </Btn>
        )}
        {onSubmeter && (
          <Btn onClick={onSubmeter} disabled={!podeSubmeter || aSubmeter}>
            <Check size={15} /> {aSubmeter ? 'A submeter…' : 'Submeter'}
          </Btn>
        )}
      </div>
    </Modal>
  );
}

export function EstatutoDaEpoca({ players, setPlayers, desenvolvimento, documentos }) {
  const isNarrow = useIsMobile(760);
  const { epoca } = React.useContext(TreinosParaEditorCtx);
  const chaveEpoca = String(epoca || '').trim() || 'sem-epoca';
  const hoje = todayStr();
  const ativos = sortByPosition((players || []).filter(p => p && !(p.exitDate && p.exitDate <= hoje)));

  // Começa na fase mais avançada que já tem alguma coisa preenchida.
  const [fase, setFase] = useState(() => {
    let ultima = 'inicial';
    FASES_AVALIACAO.forEach(fa => {
      if (ativos.some(p => { const x = (avaliacaoDaEpoca(p, chaveEpoca) || {})[fa.id]; return x && (x.nivel || x.potencial || x.obs); })) ultima = fa.id;
    });
    return ultima;
  });
  const [obsDe, setObsDe] = useState(null); // { playerId, texto }
  // A linha das fases fica presa logo por baixo dos separadores do
  // Desenvolvimento (40 px de botão + 8 px de folga em cima e em baixo).
  const ecraApp = useIsMobile();
  const topoFases = (ecraApp ? MOBILE_BAR_H : 0) + 56;
  const faseFixa = { position: 'sticky', top: topoFases, zIndex: 5, background: T.bg, padding: '0 0 10px', marginBottom: 2 };

  const mudar = (p, campo, valor) => {
    setPlayers(prev => prev.map(x => {
      if (x.id !== p.id) return x;
      const av = avaliacaoBaseDoJogador(x, chaveEpoca);
      const novo = { ...av, [fase]: { ...(av[fase] || {}), [campo]: valor } };
      return jogadorComAvaliacao(x, chaveEpoca, novo);
    }));
  };

  // Nota da equipa técnica no último momento do Desenvolvimento em que o jogador a tem.
  const notaDev = React.useMemo(() => {
    const mapa = new Map();
    diMomentos(desenvolvimento).forEach(m => {
      diRegistosDoMomento(desenvolvimento, m.id).forEach((reg, pid) => {
        if (mapa.has(pid) || !reg || !reg.staff) return;
        const s = diScoreGlobal(reg.staff);
        if (s.score != null) mapa.set(pid, s.score);
      });
    });
    return mapa;
  }, [desenvolvimento]);

  const contagem = [1, 2, 3, 4, 5].map(n => ativos.filter(p => Number(((avaliacaoBaseDoJogador(p, chaveEpoca))[fase] || {}).nivel) === n).length);
  const porAvaliar = ativos.filter(p => !Number(((avaliacaoBaseDoJogador(p, chaveEpoca))[fase] || {}).nivel)).length;

  const sel = { ...inputStyle, height: 28, lineHeight: '26px', fontSize: 12, padding: '0 6px' };
  const opcoes = (
    <>
      <option value="">—</option>
      {STATUS_OPTIONS.map((s0, i) => <option key={s0} value={i + 1}>{i + 1} · {s0}</option>)}
    </>
  );
  const numeros = (x) => (x && (x.nivel || x.potencial)) ? `${x.nivel || '–'} · ${x.potencial || '–'}` : '—';
  const faseLabel = (FASES_AVALIACAO.find(fa => fa.id === fase) || {}).label || '';
  const curto = { inicial: 'Inicial', intermedia: 'Intermédia', final: 'Final' };

  /* Mesma imagem do resto do Desenvolvimento: fases com os botões dos
     separadores da Visão geral (vermelho quando escolhido), tabela dentro
     de um cartão com os cabeçalhos pequenos em maiúsculas, posição em
     letra fixa antes do nome e a nota de desenvolvimento com a mesma
     barra da coluna Staff. */
  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 };
  const btnFase = (on) => ({
    padding: '7px 13px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', ...body,
    textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
    border: `1px solid ${on ? '#B5393F' : T.line}`,
  });
  const th = { fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', padding: '0 8px 8px', whiteSpace: 'nowrap', fontWeight: 400 };
  const td = { padding: '8px', fontSize: 12.5, whiteSpace: 'nowrap' };

  return (
    <div>
      {/* MESMA ESTRUTURA DAS AVALIAÇÕES, LINHA A LINHA, para nada saltar
          ao trocar de separador: um campo (Época, no lugar do Momento de
          avaliação), uma linha de botões da mesma altura (as fases e as
          contagens, no lugar de Visão geral… Histórico) e a tabela a
          começar no mesmo sítio. No telemóvel, os botões das Avaliações
          ocupam 4 linhas de 2; aqui também: as fases numa linha e as
          seis contagens em três linhas de 2. */}
      <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
        {/* No lugar do Momento de avaliação: o progresso da fase escolhida
            (a época fica só como referência, à direita, porque não muda). */}
        <Field label={`Progresso · ${faseLabel}`} solto>
          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 12, color: T.cream }}>
            <span style={{ ...mono, fontSize: 13, whiteSpace: 'nowrap', width: 58, flexShrink: 0 }}>{ativos.length - porAvaliar}/{ativos.length}</span>
            <div style={{ flex: 1, minWidth: 40, height: 6, borderRadius: 3, background: T.line, overflow: 'hidden' }}>
              <div style={{ width: `${ativos.length ? Math.round(((ativos.length - porAvaliar) / ativos.length) * 100) : 0}%`, height: '100%', background: porAvaliar ? T.gold : T.good, transition: 'width .2s' }} />
            </div>
            <span style={{ fontSize: 12.5, color: porAvaliar ? T.warn : T.good, whiteSpace: 'nowrap', width: isNarrow ? 'auto' : 120, flexShrink: 0 }}>
              {porAvaliar ? `${porAvaliar} por avaliar` : 'Todos avaliados'}
            </span>
            {!isNarrow && <span style={{ fontSize: 12, color: T.mutedDim, whiteSpace: 'nowrap', borderLeft: `1px solid ${T.line}`, paddingLeft: 12 }}>Época {epoca || '—'}</span>}
          </div>
        </Field>
      </div>
      {(() => {
        const CURTOS = ['Dispensável', 'Reserva', 'Alternativa', 'Pot. Titular', 'Elite'];
        // "Por avaliar" passou para o progresso, em cima.
        const contagens = STATUS_OPTIONS.map((s0, i) => ({ n: contagem[i], label: CURTOS[i] || s0, titulo: `${i + 1} · ${s0}`, aviso: false }));
        const chip = (c) => (
          <span key={c.titulo} title={`${c.titulo}: ${c.n}`} style={{
            ...btnFase(false), cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: isNarrow ? 'flex-start' : 'center',
            color: c.aviso ? T.warn : T.mutedDim, borderColor: c.aviso ? `${T.warn}66` : T.line, minWidth: 0,
            // Largura fixa (não depende do número nem do texto): ao mudar de
            // fase os números mudam e as caixas não se mexem.
            ...(isNarrow ? {} : { flex: '0 1 134px', width: 134, boxSizing: 'border-box', justifyContent: 'flex-start' }),
          }}>
            <span style={{ ...mono, color: c.aviso ? T.warn : (c.n ? T.cream : T.mutedDim), display: 'inline-block', minWidth: '2ch', textAlign: 'right' }}>{c.n}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
          </span>
        );
        const fases = FASES_AVALIACAO.map(fa => (
          <button key={fa.id} onClick={() => setFase(fa.id)} style={{ ...btnFase(fase === fa.id), flexShrink: 0 }}>{curto[fa.id]}</button>
        ));
        return isNarrow ? (
          <div style={{ ...faseFixa, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, padding: 0, marginBottom: 16 }}>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>{fases}</div>
            {contagens.map(chip)}
          </div>
        ) : (
          // Numa só linha, sempre: com pouco espaço as contagens encolhem (com
          // reticências) em vez de passarem para baixo e empurrarem a tabela.
          <div style={{ ...faseFixa, display: 'flex', gap: 6, flexWrap: 'nowrap', padding: 0, marginBottom: 16, minWidth: 0 }}>
            {fases}
            <span style={{ flex: 1 }} />
            {contagens.map(chip)}
          </div>
        );
      })()}

      {ativos.length === 0 ? (
        <EmptyState text="Sem jogadores ativos no Plantel." />
      ) : (
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Jogador</th>
                <th style={{ ...th, textAlign: 'center' }} title="Nota da equipa técnica no último momento das Avaliações (só referência)">Desenv.</th>
                {FASES_AVALIACAO.map(fa => (
                  <th key={fa.id} title="Nível atual · Potencial" style={{ ...th, textAlign: 'center', color: fa.id === fase ? T.warn : T.muted }}>{curto[fa.id]}</th>
                ))}
                <th style={{ ...th, textAlign: 'left' }}>Nível atual · {curto[fase]}</th>
                <th style={{ ...th, textAlign: 'left' }}>Potencial · {curto[fase]}</th>
                <th style={{ ...th, textAlign: 'center' }}>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {ativos.map(p => {
                const av = avaliacaoBaseDoJogador(p, chaveEpoca);
                const x = av[fase] || {};
                const nota = notaDev.get(p.id);
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${T.line}` }}>
                    <td style={{ ...td, color: T.cream }}>
                      {/* Posição numa largura fixa: os nomes ficam alinhados. */}
                      <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim, display: 'inline-block', width: 24 }}>{p.position || '--'}</span>
                      {shortPlayerName(p, players)}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}><DiBarra valor={nota} largura={54} /></td>
                    {FASES_AVALIACAO.map(fa => (
                      <td key={fa.id} style={{ ...td, textAlign: 'center', ...mono, fontSize: 11.5, color: fa.id === fase ? T.cream : T.mutedDim }}>{numeros(av[fa.id])}</td>
                    ))}
                    <td style={{ ...td, minWidth: 170 }}>
                      <select value={x.nivel || ''} onChange={e => mudar(p, 'nivel', e.target.value ? Number(e.target.value) : '')} style={sel} aria-label={`Nível atual de ${p.name}`}>{opcoes}</select>
                    </td>
                    <td style={{ ...td, minWidth: 170 }}>
                      <select value={x.potencial || ''} onChange={e => mudar(p, 'potencial', e.target.value ? Number(e.target.value) : '')} style={sel} aria-label={`Potencial de ${p.name}`}>{opcoes}</select>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => setObsDe({ playerId: p.id, texto: x.obs || '' })}
                        title={x.obs || 'Escrever observações'} aria-label={`Observações de ${p.name}`}
                        style={{ background: 'none', border: 'none', color: x.obs ? T.warn : T.mutedDim, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                        {x.obs ? <FileText size={14} /> : <Pencil size={13} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Os documentos (fichas em Word…) geram-se só em Documentos, o sítio
          próprio — já não aqui. */}

      {obsDe && (() => {
        const p = (players || []).find(x => x.id === obsDe.playerId);
        if (!p) return null;
        return (
          <Modal title={`Observações · ${faseLabel}`} subtitle={p.name} onClose={() => setObsDe(null)}>
            <TextArea autoFocus value={obsDe.texto} onChange={e => setObsDe({ ...obsDe, texto: e.target.value })} placeholder="Observações desta fase" style={{ minHeight: 160 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <Btn variant="ghost" onClick={() => setObsDe(null)}>Cancelar</Btn>
              <Btn onClick={() => { mudar(p, 'obs', obsDe.texto); setObsDe(null); }}><Check size={15} /> Guardar</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

export function DesenvolvimentoIndividual({ players, setPlayers, documentos, desenvolvimento, setDesenvolvimento, autorizarRemocaoEmMassa, userEmail, setTarefas }) {
  const isNarrow = useIsMobile(760);
  /* Duas vistas: as Autoavaliações (os momentos com questionário, o que
     já existia) e o Estatuto na época.
     Os separadores ficam presos no topo ao fazer scroll e a página não
     salta ao trocar: a zona de baixo tem sempre pelo menos a altura do
     ecrã, e se os separadores já estavam presos, a vista nova abre com
     eles no mesmo sítio e o conteúdo a começar logo por baixo. */
  const [vistaDI, setVistaDI] = useState('avaliacoes');
  const ecraApp = useIsMobile();
  const topoSeparadores = ecraApp ? MOBILE_BAR_H : 0;
  const separadoresRef = useRef(null);
  const ancoraRef = useRef(null);
  const trocarVistaDI = (v) => {
    if (v === vistaDI) return;
    const el = separadoresRef.current;
    const presos = el && el.getBoundingClientRect().top <= topoSeparadores + 1;
    setVistaDI(v);
    if (presos) requestAnimationFrame(() => { if (ancoraRef.current) ancoraRef.current.scrollIntoView({ block: 'start' }); });
  };
  const [aba, setAba] = useState('geral');
  const [momentoId, setMomentoId] = useState(null);
  const [jogadorId, setJogadorId] = useState(null);
  const [questionario, setQuestionario] = useState(null); // { fonte: 'auto'|'staff', playerId }
  const [novoMomento, setNovoMomento] = useState(null);
  const [adicionarJogadores, setAdicionarJogadores] = useState(null); // array de ids selecionados, ou null se fechado

  const momentos = diMomentos(desenvolvimento);
  const momento = momentos.find(m => m.id === momentoId) || momentos[0] || null;
  const jogadoresOrdenados = sortByPosition(players);
  const jogador = players.find(p => p.id === jogadorId) || null;

  // Índice por jogador, calculado uma vez por ecrã (ver diRegistosDoMomento).
  const registos = momento ? diRegistosDoMomento(desenvolvimento, momento.id) : new Map();
  const registo = jogador ? diRegisto(registos, jogador.id) : null;

  /* Altera SÓ a linha daquele jogador. É esta a razão de ser da estrutura
     separada: nenhum outro registo é reenviado. */
  const patchRegisto = (mId, pId, patch) => setDesenvolvimento(prev => {
    const lista = prev || [];
    const existe = lista.find(x => x && x.tipo === 'registo' && x.momentoId === mId && x.playerId === pId);
    if (existe) return lista.map(x => (x.id === existe.id ? { ...x, ...patch } : x));
    return [...lista, { ...diRegistoVazio(mId, pId), ...patch }];
  });

  const patchMomento = (mId, patch) => setDesenvolvimento(prev => (prev || []).map(m => (m.id === mId ? { ...m, ...patch } : m)));

  /* Tirar UM jogador de um momento — ao contrário de apagar o momento
     inteiro, só a linha de registo daquele jogador desaparece. Só faz
     sentido enquanto o momento está aberto: um momento fechado é
     histórico, e mudar quem lá está depois de fechado reescrevia esse
     histórico. */
  const removerJogadorDoMomento = (p) => {
    const reg = (desenvolvimento || []).find(x => x && x.tipo === 'registo' && x.momentoId === momento.id && x.playerId === p.id);
    if (!reg) return;
    askConfirm({
      title: 'Remover do momento?',
      label: `${shortPlayerName(p, players)} · ${momento.nome}`,
      note: 'As avaliações já dadas (auto e da equipa técnica) para este jogador, neste momento, perdem-se.',
      confirmLabel: 'Remover',
      destructive: true,
      onConfirm: () => {
        setDesenvolvimento(prev => (prev || []).filter(x => x.id !== reg.id));
        if (jogadorId === p.id) setJogadorId(null);
        /* A tarefa "Autoavaliação" deste jogador para este momento sai
           também. Antes ficava aberta no Portal: o jogador via a tarefa,
           abria-a e não havia nada para responder. */
        let tarefasTiradas = [];
        if (setTarefas) setTarefas(prev => {
          const ehDeste = (t) => t && t.origemMomento === momento.id && t.jogadorId === p.id && t.estado !== 'feita';
          tarefasTiradas = (prev || []).filter(ehDeste);
          return tarefasTiradas.length ? (prev || []).filter(t => !ehDeste(t)) : prev;
        });
        offerUndo(`${shortPlayerName(p, players)} removido do momento.`, () => {
          setDesenvolvimento(prev => (prev.some(x => x.id === reg.id) ? prev : [...prev, reg]));
          if (setTarefas && tarefasTiradas.length) setTarefas(prev => {
            const ids = new Set((prev || []).map(t => t.id));
            return [...(prev || []), ...tarefasTiradas.filter(t => !ids.has(t.id))];
          });
        });
      },
    });
  };

  /* Apagar um momento tem de levar consigo todos os registos que lhe
     pertencem — senão ficavam linhas órfãs, sem momento a que se ligar.
     Segue a mesma rede de segurança do resto da app: pergunta primeiro
     (askConfirm) e, depois de apagado, dá alguns segundos para anular
     (offerUndo) antes de ser definitivo. */
  const apagarMomento = (m) => {
    askConfirm({
      label: `Momento "${m.nome}" · ${fmtDate(m.data)}`,
      onConfirm: () => {
        const pertencem = (x) => x && (x.id === m.id || (x.tipo === 'registo' && x.momentoId === m.id));
        const apagadas = (desenvolvimento || []).filter(pertencem);
        /* Avisa o mecanismo de gravação de que esta remoção em massa é
           deliberada. Sem isto, o travão de segurança bloqueia-a e o
           momento fica impossível de apagar. Vale só para a gravação
           imediatamente a seguir. */
        if (autorizarRemocaoEmMassa) autorizarRemocaoEmMassa();
        setDesenvolvimento(prev => (prev || []).filter(x => !pertencem(x)));
        if (momentoId === m.id) setMomentoId(null);
        // As tarefas "Autoavaliação" deste momento ainda por fazer saem
        // também (senão ficavam no Portal, sem nada para responder).
        let tarefasTiradas = [];
        if (setTarefas) setTarefas(prev => {
          const ehDeste = (t) => t && t.origemMomento === m.id && t.estado !== 'feita';
          tarefasTiradas = (prev || []).filter(ehDeste);
          return tarefasTiradas.length ? (prev || []).filter(t => !ehDeste(t)) : prev;
        });
        offerUndo(`Momento "${m.nome}" apagado.`, () => {
          if (setTarefas && tarefasTiradas.length) setTarefas(prev => {
            const ids = new Set((prev || []).map(t => t.id));
            return [...(prev || []), ...tarefasTiradas.filter(t => !ids.has(t.id))];
          });
          setDesenvolvimento(prev => {
            const existentes = new Set((prev || []).map(x => x.id));
            return [...(prev || []), ...apagadas.filter(x => !existentes.has(x.id))];
          });
        });
      },
    });
  };

  /* O momento anterior serve para a evolução e para as prioridades: uma
     dimensão que DESCEU é mais urgente do que uma que está estável no
     mesmo valor. */
  const momentoAnterior = momento
    ? momentos.filter(m => new Date(m.data) < new Date(momento.data))[0] || null
    : null;
  const mediasAnteriores = (() => {
    if (!momentoAnterior || !jogador) return null;
    const reg = diRegisto(diRegistosDoMomento(desenvolvimento, momentoAnterior.id), jogador.id);
    if (!reg || !reg.staff) return null;
    const m = diMedias(reg.staff);
    return Object.fromEntries(DI_DIMENSOES.map(d => [d.id, m[d.id].media]));
  })();

  const scoreAuto = registo ? diScoreGlobal(registo.auto) : null;
  const scoreStaff = registo ? diScoreGlobal(registo.staff) : null;
  const gapGlobal = registo ? diGapGlobal(registo.auto, registo.staff) : null;

  const ABAS = [
    { id: 'geral', label: 'Visão geral' },
    { id: 'avaliacoes', label: 'Questionários' },
    { id: 'gap', label: 'Comparação / GAP' },
    { id: 'radares', label: 'Radares' },
    { id: 'reuniao', label: 'Reunião' },
    { id: 'plano', label: 'Plano individual' },
    { id: 'historico', label: 'Histórico' },
  ];

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 };

  const criarMomento = () => {
    const m = diMomentoVazio(novoMomento.nome.trim() || `Avaliação ${fmtDate(novoMomento.data)}`);
    m.data = novoMomento.data;
    m.prazo = novoMomento.prazo;
    // O momento e uma linha por jogador escolhido, tudo de uma vez.
    const linhas = (novoMomento.jogadores || []).map(pid => diRegistoVazio(m.id, pid));
    setDesenvolvimento(prev => [...(prev || []), m, ...linhas]);
    /* MISSÃO AUTOMÁTICA NO PORTAL: com prazo de resposta, cada jogador
       escolhido (e SÓ esses) recebe a missão "Autoavaliação" até ao
       prazo. Fecha-se sozinha quando o jogador submete. */
    if (setTarefas && novoMomento.prazo) {
      const nome = m.nome;
      const novas = (novoMomento.jogadores || []).map(pid => ({
        id: uid(), titulo: `Autoavaliação · ${nome}`, notas: '', responsavel: '', prazo: novoMomento.prazo,
        estado: 'aberta', recorrencia: null, jogadorId: pid, destino: 'autoavaliacao', origemMomento: m.id,
        missoes: [{ id: uid(), destino: 'autoavaliacao', instrucoes: `Responde à autoavaliação "${nome}" até ${fmtDate(novoMomento.prazo)}.` }],
      }));
      if (novas.length) setTarefas(prev => [...(prev || []), ...novas]);
    }
    setMomentoId(m.id);
    setNovoMomento(null);
  };

  /* Reabrir um momento fechado deve permitir juntar-lhe jogadores que
     ficaram de fora — sem isto, um momento fechado por engano ficava
     preso à lista original para sempre. */
  const jogadoresForaDoMomento = players.filter(p => !registos.has(p.id));
  const confirmarAdicionarJogadores = () => {
    const linhas = (adicionarJogadores || []).map(pid => diRegistoVazio(momento.id, pid));
    setDesenvolvimento(prev => [...(prev || []), ...linhas]);
    /* Quem entra depois num momento com prazo recebe a mesma tarefa
       "Autoavaliação" no Portal que os outros receberam ao criar. */
    if (setTarefas && momento.prazo && (adicionarJogadores || []).length) {
      const nome = momento.nome;
      setTarefas(prev => {
        const jaTem = new Set((prev || []).filter(t => t && t.origemMomento === momento.id).map(t => t.jogadorId));
        const novas = (adicionarJogadores || []).filter(pid => !jaTem.has(pid)).map(pid => ({
          id: uid(), titulo: `Autoavaliação · ${nome}`, notas: '', responsavel: '', prazo: momento.prazo,
          estado: 'aberta', recorrencia: null, jogadorId: pid, destino: 'autoavaliacao', origemMomento: momento.id,
          missoes: [{ id: uid(), destino: 'autoavaliacao', instrucoes: `Responde à autoavaliação "${nome}" até ${fmtDate(momento.prazo)}.` }],
        }));
        return novas.length ? [...(prev || []), ...novas] : prev;
      });
    }
    setAdicionarJogadores(null);
  };

  // ---------------------------------------------------------------
  // Agrupado por família de posição — a mesma lógica de 3 blocos da
  // ficha impressa (GR+Defesas / Médios / Avançados), só que aqui
  // juntamos GR à linha das defesas, como foi pedido. Cada linha é uma
  // grid que ocupa sempre a largura toda disponível: os pills esticam-se
  // para preencher a linha (em vez de ficarem encostados à esquerda com
  // espaço vazio à direita), e no telemóvel cabem vários por linha em
  // vez de um pill gigante por linha.
  const FAMILIAS_JOGADOR = [
    { id: 'gr', label: 'Guarda-redes', posicoes: ['GR'] },
    { id: 'def', label: 'Defesas', posicoes: ['DD', 'DC', 'DE'] },
    { id: 'meio', label: 'Médios', posicoes: ['MD', 'MC', 'MOC'] },
    { id: 'avancado', label: 'Avançados', posicoes: ['EE', 'ED', 'PL'] },
  ];
  const familiaDaPosicao = (pos) => FAMILIAS_JOGADOR.find(f => f.posicoes.includes(pos))?.id || 'outros';

  const jogadoresParaCabecalho = jogadoresOrdenados.filter(p => registos.has(p.id));
  const linhasCabecalho = [...FAMILIAS_JOGADOR, { id: 'outros', label: 'Outros' }]
    .map(f => ({ ...f, jogadores: jogadoresParaCabecalho.filter(p => familiaDaPosicao(p.position) === f.id) }))
    .filter(f => f.jogadores.length > 0);

  /* O JOGADOR ESCOLHE-SE NUMA LISTA, em todos os separadores e em
     qualquer ecrã (antes era uma grelha de botões no computador): agrupada
     por posição, e com o estado de cada um escrito por extenso em vez do
     ponto, que ninguém sabia o que queria dizer. */
  const cabecalhoJogador = (
    <div style={{ marginBottom: 14, maxWidth: 520 }}>
      <Select value={jogadorId || ''} onChange={e => setJogadorId(e.target.value)}>
        <option value="" disabled>Escolhe um jogador…</option>
        {linhasCabecalho.map(f => (
          <optgroup key={f.id} label={f.label}>
            {f.jogadores.map(p => {
              const est = diEstado(diRegisto(registos, p.id));
              return (
                <option key={p.id} value={p.id}>
                  {p.position || '--'} · {shortPlayerName(p, players)}{est !== 'pendente' ? `  (${DI_ESTADO_LABEL(est)})` : ''}
                </option>
              );
            })}
          </optgroup>
        ))}
      </Select>
    </div>
  );

  const semMomento = (
    <EmptyState
      text="Ainda não há nenhum momento de avaliação. Cria o primeiro quando quiseres — não há periodicidade obrigatória."
      action={<Btn onClick={() => setNovoMomento({ nome: '', data: todayStr(), prazo: '', jogadores: [] })}><Plus size={15} /> Avaliar</Btn>}
    />
  );

  return (
    <>
      <SectionHeader
        title="Desenvolvimento Individual"
        subtitle="Avaliação e plano de desenvolvimento."
        action={
          // Nas Avaliações individuais o botão fica invisível mas a ocupar
          // o lugar, para o título e os separadores não subirem.
          <div style={{ visibility: vistaDI === 'avaliacoes' ? 'visible' : 'hidden' }} aria-hidden={vistaDI !== 'avaliacoes'}>
            <Btn onClick={() => setNovoMomento({ nome: '', data: todayStr(), prazo: '', jogadores: [] })} disabled={!players.length || vistaDI !== 'avaliacoes'}>
              <Plus size={15} /> Avaliar
            </Btn>
          </div>
        }
      />

      <div ref={ancoraRef} style={{ scrollMarginTop: topoSeparadores }} />
      <div ref={separadoresRef} style={{
        position: 'sticky', top: topoSeparadores, zIndex: 6, background: T.bg,
        display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(2, 210px)', gap: 8,
        padding: '8px 0', margin: '-8px 0 8px',
      }}>
        {[{ id: 'avaliacoes', label: 'Avaliações' }, { id: 'estatuto', label: 'Estatuto na época' }].map(v => {
          const on = vistaDI === v.id;
          return (
            <button key={v.id} onClick={() => trocarVistaDI(v.id)} style={{
              height: 40, padding: isNarrow ? '0 6px' : '0 12px', borderRadius: 8, cursor: 'pointer', ...body, fontSize: isNarrow ? 12.5 : 13,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box',
              border: `1px solid ${on ? T.gold : T.line}`, background: on ? `${T.gold}22` : T.surface,
              color: on ? T.warn : T.cream,
            }}>{v.label}</button>
          );
        })}
      </div>

      <div style={{ minHeight: `calc(100vh - ${topoSeparadores + 56}px)` }}>
      {vistaDI === 'estatuto' ? (
        <EstatutoDaEpoca players={players} setPlayers={setPlayers} desenvolvimento={desenvolvimento} documentos={documentos} />
      ) : players.length === 0 ? (
        <EmptyState text="Adiciona jogadores no Plantel antes de criar avaliações." />
      ) : !momento ? semMomento : (
        <>
          {/* Momento em causa: tudo o que está abaixo é sobre ele. */}
          <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
            <Field label="Momento de avaliação" solto>
              <Select value={momento.id} onChange={e => setMomentoId(e.target.value)}>
                {momentos.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} · {fmtDate(m.data)}{m.fechado ? ' (fechado)' : ''}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div style={{
            display: isNarrow ? 'grid' : 'flex',
            gridTemplateColumns: isNarrow ? 'repeat(2, 1fr)' : undefined,
            gap: 6, flexWrap: 'wrap', marginBottom: 16,
          }}>
            {ABAS.map(a => {
              const on = aba === a.id;
              return (
                <button key={a.id} onClick={() => setAba(a.id)} style={{
                  padding: '7px 13px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', ...body,
                  textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: on ? '#B5393F' : 'transparent',
                  color: on ? TEXT_ON_ACCENT : T.muted,
                  border: `1px solid ${on ? '#B5393F' : T.line}`,
                }}>{a.label}</button>
              );
            })}
          </div>

          {/* ---------------- VISÃO GERAL ---------------- */}
          {aba === 'geral' && (
            <div style={{ ...card, overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
                <thead>
                  <tr>
                    {['Jogador', 'Auto', 'Staff', 'GAP', 'Prioridade', 'Estado', ''].map(h => (
                      <th key={h} style={{ textAlign: h === 'Jogador' ? 'left' : 'center', fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', padding: '0 8px 8px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jogadoresOrdenados.filter(p => registos.has(p.id)).map(p => {
                    const reg = diRegisto(registos, p.id);
                    const sa = diScoreGlobal(reg && reg.auto).score;
                    const ss = diScoreGlobal(reg && reg.staff).score;
                    const g = (sa != null && ss != null) ? sa - ss : null;
                    const prior = ss != null ? diPrioridades(reg.staff, reg && reg.auto, null)[0] : null;
                    return (
                      <tr key={p.id} onClick={() => { setJogadorId(p.id); setAba('reuniao'); }}
                        style={{ borderTop: `1px solid ${T.line}`, cursor: 'pointer' }}>
                        <td style={{ padding: '8px', fontSize: 12.5, color: T.cream, whiteSpace: 'nowrap' }}>
                          <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>{p.position || '--'}</span>{' '}
                          {shortPlayerName(p, players)}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}><DiBarra valor={sa} largura={54} /></td>
                        <td style={{ padding: '8px', textAlign: 'center' }}><DiBarra valor={ss} largura={54} /></td>
                        <td style={{ padding: '8px', textAlign: 'center', ...mono, fontSize: 11.5, color: g == null ? T.mutedDim : (Math.abs(g) < 0.3 ? T.good : T.warn) }}>
                          {g == null ? '—' : `${g > 0 ? '+' : ''}${g.toFixed(2)}`}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: 11.5, color: T.mutedDim }}>
                          {prior ? prior.label.split(' ')[0] : '—'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: 11.5, color: T.mutedDim, whiteSpace: 'nowrap' }}>
                          {DI_ESTADO_LABEL(diEstado(reg))}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {!momento.fechado && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removerJogadorDoMomento(p); }}
                              title="Remover do momento"
                              style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 2, display: 'inline-flex' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ---------------- AVALIAÇÕES ---------------- */}
          {aba === 'avaliacoes' && (
            <div style={card}>
              <p style={{ color: T.mutedDim, fontSize: 12.5, margin: '0 0 12px' }}>
                Os mesmos {DI_INDICADORES.length} indicadores dos dois lados. A autoavaliação pode ser respondida pelo jogador
                no questionário ou registada aqui pelo treinador.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {jogadoresOrdenados.filter(p => registos.has(p.id)).map(p => {
                  const reg = diRegisto(registos, p.id);
                  const nAuto = diRespondido(reg && reg.auto);
                  const nStaff = diRespondido(reg && reg.staff);
                  return (
                    /* NOME EM CIMA, OS DOIS BOTÕES POR BAIXO, IGUAIS.

                       Estavam os três em linha com `flexWrap`: no telemóvel
                       cabia o nome e o primeiro botão, e o segundo caía para
                       a linha seguinte encostado à esquerda, com outra
                       largura. Ficavam dois botões irmãos desalinhados e de
                       tamanhos diferentes.

                       Em coluna, com `1fr 1fr`, ficam sempre da mesma
                       largura e alinhados entre si — em qualquer ecrã, e
                       sem depender de caber ou não. */
                    <div key={p.id} style={{
                      background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '11px 12px',
                    }}>
                      <div style={{ fontSize: 12.5, color: T.cream, marginBottom: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>{p.position || '--'}</span>{' '}
                        {p.name}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button onClick={() => { setJogadorId(p.id); setQuestionario({ fonte: 'auto', playerId: p.id }); }} style={{
                          padding: '7px 10px', borderRadius: 7, fontSize: 11.5, cursor: 'pointer', ...body,
                          background: 'transparent', border: `1px solid ${nAuto === DI_INDICADORES.length ? T.good : T.line}`,
                          color: nAuto === DI_INDICADORES.length ? T.good : T.muted, textAlign: 'center',
                        }}>Autoavaliação {nAuto}/{DI_INDICADORES.length}</button>
                        <button onClick={() => { setJogadorId(p.id); setQuestionario({ fonte: 'staff', playerId: p.id }); }} style={{
                          padding: '7px 10px', borderRadius: 7, fontSize: 11.5, cursor: 'pointer', ...body,
                          background: 'transparent', border: `1px solid ${nStaff === DI_INDICADORES.length ? T.good : T.line}`,
                          color: nStaff === DI_INDICADORES.length ? T.good : T.muted, textAlign: 'center',
                        }}>Equipa técnica {nStaff}/{DI_INDICADORES.length}</button>
                      </div>
                      {/* SUBMETER PELO JOGADOR: só quando as 30 respostas estão
                          todas dadas e ele não carregou em "Submeter". Grava a
                          mesma marca que o Portal grava (`enviado`); a missão
                          dele fecha-se na próxima entrada no Portal. */}
                      {nAuto === DI_INDICADORES.length && reg && !reg.enviado && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11.5, color: T.warn, flex: 1, minWidth: 150 }}>Autoavaliação completa, por submeter.</span>
                          <Btn variant="ghost" onClick={() => patchRegisto(momento.id, p.id, { enviado: true, enviadoPorStaffEm: new Date().toISOString() })}>
                            Submeter pelo jogador
                          </Btn>
                        </div>
                      )}
                      {nAuto === DI_INDICADORES.length && nStaff === DI_INDICADORES.length && !(reg && reg.combinada) && (
                        <div style={{ marginTop: 8 }}>
                          <Btn variant="ghost" onClick={() => patchRegisto(momento.id, p.id, { combinada: true, combinadaEm: new Date().toISOString() })} style={{ width: '100%', justifyContent: 'center' }}>
                            Juntar avaliações
                          </Btn>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------- GAP / RADARES / REUNIÃO / PLANO ---------------- */}
          {['gap', 'radares', 'reuniao', 'plano'].includes(aba) && (
            <>
              {cabecalhoJogador}
              {!jogador ? (
                <EmptyState text="Escolhe um jogador acima." />
              ) : (
                <>
                  {aba === 'gap' && (
                    <div style={card}>
                      <h3 style={{ ...display, color: T.cream, fontSize: 15, margin: '0 0 4px' }}>Onde as perceções divergem</h3>
                      <p style={{ color: T.mutedDim, fontSize: 12, margin: '0 0 14px' }}>
                        GAP = autoavaliação − equipa técnica. Positivo: o jogador vê-se acima. Negativo: vê-se abaixo.
                        Não é bom nem mau — é matéria de conversa.
                      </p>
                      {!registo || !registo.auto || !registo.staff ? (
                        <EmptyState text="Faltam as duas avaliações para comparar." />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {DI_DIMENSOES.map(d => {
                            const g = diGapDimensoes(registo.auto, registo.staff)[d.id];
                            const ma = diMediaDimensao(registo.auto, d.id).media;
                            const ms = diMediaDimensao(registo.staff, d.id).media;
                            return (
                              <div key={d.id} style={{
                                display: 'grid',
                                gridTemplateColumns: isNarrow ? '1fr' : 'minmax(140px, 320px) 90px 90px 64px',
                                alignItems: 'center', gap: isNarrow ? 4 : 16,
                                background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 11px',
                              }}>
                                <span style={{ fontSize: 12.5, color: T.cream }}>{d.label}</span>
                                <span style={{ fontSize: 11.5, color: T.mutedDim, whiteSpace: 'nowrap' }}>jogador <b style={{ color: T.cream }}>{ma == null ? '—' : ma.toFixed(2)}</b></span>
                                <span style={{ fontSize: 11.5, color: T.mutedDim, whiteSpace: 'nowrap' }}>staff <b style={{ color: T.cream }}>{ms == null ? '—' : ms.toFixed(2)}</b></span>
                                <span style={{ ...mono, fontSize: 12, textAlign: isNarrow ? 'left' : 'right', color: g.gap == null ? T.mutedDim : (Math.abs(g.gap) < 0.3 ? T.good : T.warn) }}>
                                  {g.gap == null ? '—' : `${g.gap > 0 ? '+' : ''}${g.gap.toFixed(2)}`}
                                </span>
                              </div>
                            );
                          })}
                          <div style={{ marginTop: 8, fontSize: 12.5, color: T.cream }}>
                            GAP global:{' '}
                            <b style={{ color: gapGlobal == null ? T.mutedDim : (Math.abs(gapGlobal) < 0.3 ? T.good : T.warn) }}>
                              {gapGlobal == null ? '—' : `${gapGlobal > 0 ? '+' : ''}${gapGlobal.toFixed(2)}`}
                            </b>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {aba === 'radares' && (
                    <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
                      {[
                        { titulo: 'Autoavaliação', series: [{ cor: T.gold, valores: diMediasSimples(registo && registo.auto) }] },
                        { titulo: 'Equipa técnica', series: [{ cor: T.crimsonBright, valores: diMediasSimples(registo && registo.staff) }] },
                        { titulo: 'Comparativo', series: [
                          { cor: T.gold, valores: diMediasSimples(registo && registo.auto) },
                          { cor: T.crimsonBright, valores: diMediasSimples(registo && registo.staff) },
                        ] },
                      ].map(r => (
                        <div key={r.titulo} style={card}>
                          <h3 style={{ ...display, color: T.cream, fontSize: 14, margin: '0 0 8px', textAlign: 'center' }}>{r.titulo}</h3>
                          <DiRadar series={r.series} size={isNarrow ? 240 : 230} />
                        </div>
                      ))}
                    </div>
                  )}

                  {aba === 'reuniao' && (
                    <DiReuniao
                      jogador={jogador} registo={registo} players={players}
                      scoreAuto={scoreAuto} scoreStaff={scoreStaff} gapGlobal={gapGlobal}
                      mediasAnteriores={mediasAnteriores} momentoAnterior={momentoAnterior}
                      isNarrow={isNarrow}
                      onNotas={(v) => patchRegisto(momento.id, jogador.id, { notasReuniao: v })}
                      onFeita={() => patchRegisto(momento.id, jogador.id, { reuniaoFeita: true })}
                      onDesfazer={() => patchRegisto(momento.id, jogador.id, { reuniaoFeita: false })}
                      onIrParaPlano={() => setAba('plano')}
                    />
                  )}

                  {aba === 'plano' && (
                    <DiPlano
                      registo={registo}
                      onChange={(plano) => patchRegisto(momento.id, jogador.id, { plano })}
                      onConcluir={(v) => patchRegisto(momento.id, jogador.id, { planoConcluido: v })}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* ---------------- HISTÓRICO ---------------- */}
          {aba === 'historico' && (
            <>
              {cabecalhoJogador}
              {!jogador ? <EmptyState text="Escolhe um jogador acima." /> : (
                <DiHistorico key={jogador.id} jogador={jogador} momentos={momentos} colecao={desenvolvimento} isNarrow={isNarrow} />
              )}
            </>
          )}

          {aba === 'geral' && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => {
                const reabrir = !!momento.fechado;
                patchMomento(momento.id, { fechado: !momento.fechado });
                /* Reabrir um momento com prazo devolve a tarefa
                   "Autoavaliação" a quem ainda não submeteu (ao fechar,
                   essas tarefas saem do Portal, porque o servidor deixa de
                   mostrar o questionário de um momento fechado). */
                if (reabrir && setTarefas && momento.prazo) {
                  const pendentes = (desenvolvimento || []).filter(x => x && x.tipo === 'registo' && x.momentoId === momento.id && !x.enviado).map(x => x.playerId);
                  const nome = momento.nome;
                  setTarefas(prev => {
                    const jaTem = new Set((prev || []).filter(t => t && t.origemMomento === momento.id && t.estado !== 'feita').map(t => t.jogadorId));
                    const novas = pendentes.filter(pid => !jaTem.has(pid)).map(pid => ({
                      id: uid(), titulo: `Autoavaliação · ${nome}`, notas: '', responsavel: '', prazo: momento.prazo,
                      estado: 'aberta', recorrencia: null, jogadorId: pid, destino: 'autoavaliacao', origemMomento: momento.id,
                      missoes: [{ id: uid(), destino: 'autoavaliacao', instrucoes: `Responde à autoavaliação "${nome}" até ${fmtDate(momento.prazo)}.` }],
                    }));
                    return novas.length ? [...(prev || []), ...novas] : prev;
                  });
                }
              }}>
                {momento.fechado ? 'Reabrir momento' : 'Fechar momento'}
              </Btn>
              {!momento.fechado && jogadoresForaDoMomento.length > 0 && (
                <Btn variant="ghost" onClick={() => setAdicionarJogadores([])}>
                  <Plus size={14} /> Adicionar jogadores
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => apagarMomento(momento)} style={{ color: T.warn, borderColor: T.warn }}>
                <Trash2 size={14} /> Apagar momento
              </Btn>
              <span style={{ fontSize: 11.5, color: T.mutedDim, alignSelf: 'center' }}>
                {momento.fechado
                  ? 'Fechado: fica como registo histórico. Reabre se precisares de corrigir.'
                  : `${registos.size} ${registos.size === 1 ? 'jogador' : 'jogadores'} neste momento.`}
              </span>
            </div>
          )}
        </>
      )}
      </div>

      {/* Questionário dos indicadores. */}
      {questionario && momento && (
        <DiQuestionario
          titulo={questionario.fonte === 'auto' ? 'Autoavaliação do jogador' : 'Avaliação da equipa técnica'}
          subtitulo={`${(players.find(p => p.id === questionario.playerId) || {}).name} · ${momento.nome}`}
          posicao={(players.find(p => p.id === questionario.playerId) || {}).position}
          respostas={(diRegisto(registos, questionario.playerId) || {})[questionario.fonte]}
          comentarios={(diRegisto(registos, questionario.playerId) || {}).comentarios}
          permitirNA={questionario.fonte === 'staff'}
          onChange={(indId, valor) => {
            const reg = diRegisto(registos, questionario.playerId) || {};
            const atual = { ...(reg[questionario.fonte] || {}) };
            if (valor === undefined) delete atual[indId]; else atual[indId] = valor;
            patchRegisto(momento.id, questionario.playerId, {
              [questionario.fonte]: atual,
              ...(questionario.fonte === 'staff' ? { avaliador: userEmail || '' } : {}),
            });
          }}
          onComentario={questionario.fonte === 'staff'
            ? (dimId, texto) => {
              const reg = diRegisto(registos, questionario.playerId) || {};
              patchRegisto(momento.id, questionario.playerId, { comentarios: { ...(reg.comentarios || {}), [dimId]: texto } });
            }
            : null}
          onClose={() => setQuestionario(null)}
        />
      )}

      {/* Criar momento. */}
      {novoMomento && (
        <Modal title="Avaliar" onClose={() => setNovoMomento(null)} wide fullPage>
          <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
            <Field label="Nome do momento">
              <Input value={novoMomento.nome} onChange={e => setNovoMomento({ ...novoMomento, nome: e.target.value })} placeholder="Ex: Avaliação inicial" />
            </Field>
            <Field label="Data">
              <Input type="date" value={novoMomento.data} onChange={e => setNovoMomento({ ...novoMomento, data: e.target.value })} />
            </Field>
            <Field label="Prazo de resposta">
              <Input type="date" value={novoMomento.prazo} onChange={e => setNovoMomento({ ...novoMomento, prazo: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Jogadores · {(novoMomento.jogadores || []).length}/{players.length}
            </span>
            <SelectAllBar
              onSelectAll={() => setNovoMomento(prev => ({ ...prev, jogadores: players.map(p => p.id) }))}
              onClear={() => setNovoMomento(prev => ({ ...prev, jogadores: [] }))}
            />
          </div>
          <PlayerChipList
            players={players}
            isOn={p => (novoMomento.jogadores || []).includes(p.id)}
            onToggle={p => setNovoMomento(prev => ({
              ...prev,
              jogadores: prev.jogadores.includes(p.id) ? prev.jogadores.filter(id => id !== p.id) : [...prev.jogadores, p.id],
            }))}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <Btn variant="ghost" onClick={() => setNovoMomento(null)}>Cancelar</Btn>
            <Btn onClick={criarMomento} disabled={!(novoMomento.jogadores || []).length}><Check size={15} /> Criar momento</Btn>
          </div>
        </Modal>
      )}

      {/* Adicionar jogadores a um momento já existente (tipicamente depois de o reabrir). */}
      {adicionarJogadores && momento && (
        <Modal title="Adicionar jogadores" subtitle={`${momento.nome} · ${fmtDate(momento.data)}`} onClose={() => setAdicionarJogadores(null)}>
          {jogadoresForaDoMomento.length === 0 ? (
            <EmptyState text="Todos os jogadores do plantel já estão neste momento." />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Jogadores · {adicionarJogadores.length}/{jogadoresForaDoMomento.length}
                </span>
                <SelectAllBar
                  onSelectAll={() => setAdicionarJogadores(jogadoresForaDoMomento.map(p => p.id))}
                  onClear={() => setAdicionarJogadores([])}
                />
              </div>
              <PlayerChipList
                players={jogadoresForaDoMomento}
                allPlayers={players}
                isOn={p => adicionarJogadores.includes(p.id)}
                onToggle={p => setAdicionarJogadores(prev =>
                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                )}
              />
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <Btn variant="ghost" onClick={() => setAdicionarJogadores(null)}>Cancelar</Btn>
            <Btn onClick={confirmarAdicionarJogadores} disabled={!adicionarJogadores.length}><Check size={15} /> Adicionar</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

/* Médias num objeto simples { dimId: valor }, que é o que o radar quer. */
export function diMediasSimples(respostas) {
  const m = diMedias(respostas);
  return Object.fromEntries(DI_DIMENSOES.map(d => [d.id, m[d.id].media]));
}

/* ---------------- REUNIÃO INDIVIDUAL ---------------- */
export function DiReuniao({ jogador, registo, players, scoreAuto, scoreStaff, gapGlobal, mediasAnteriores, momentoAnterior, isNarrow, onNotas, onFeita, onDesfazer, onIrParaPlano }) {
  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 };
  if (!registo || !registo.staff) {
    return <EmptyState text="Faz primeiro a avaliação da equipa técnica para preparar a reunião." />;
  }
  const prioridades = diPrioridades(registo.staff, registo.auto, mediasAnteriores);
  const fortes = diPontosFortes(registo.staff);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 14 }}>
      <div style={card}>
        <h3 style={{ ...display, color: T.cream, fontSize: 15, margin: '0 0 2px' }}>{jogador.name}</h3>
        <p style={{ color: T.mutedDim, fontSize: 12, margin: '0 0 12px' }}>
          {jogador.position || '—'}{momentoAnterior ? ` · comparado com ${momentoAnterior.nome}` : ''}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 92, fontSize: 12, color: T.mutedDim }}>Autoavaliação</span>
            <DiBarra valor={scoreAuto && scoreAuto.score} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 92, fontSize: 12, color: T.mutedDim }}>Equipa técnica</span>
            <DiBarra valor={scoreStaff && scoreStaff.score} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 92, fontSize: 12, color: T.mutedDim }}>GAP global</span>
            <span style={{ ...mono, fontSize: 12, color: gapGlobal == null ? T.mutedDim : (Math.abs(gapGlobal) < 0.3 ? T.good : T.warn) }}>
              {gapGlobal == null ? '—' : `${gapGlobal > 0 ? '+' : ''}${gapGlobal.toFixed(2)}`}
            </span>
          </div>
          {scoreStaff && scoreStaff.fiabilidade !== 'alta' && (
            <div style={{ fontSize: 11.5, color: T.warn }}>
              Fiabilidade {scoreStaff.fiabilidade}: {scoreStaff.validos} de {scoreStaff.total} indicadores observados.
            </div>
          )}
        </div>

        <DiRadar
          series={[
            { cor: T.gold, valores: diMediasSimples(registo.auto) },
            { cor: T.crimsonBright, valores: diMediasSimples(registo.staff) },
          ]}
          size={isNarrow ? 240 : 250}
        />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 11.5, marginTop: 4 }}>
          <span style={{ color: T.gold }}>● jogador</span>
          <span style={{ color: T.crimsonBright }}>● equipa técnica</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={card}>
          <h3 style={{ ...display, color: T.cream, fontSize: 14, margin: '0 0 8px' }}>Pontos fortes</h3>
          {fortes.length === 0 ? (
            <p style={{ color: T.mutedDim, fontSize: 12.5, margin: 0 }}>Ainda nenhuma dimensão em 4,0 ou acima.</p>
          ) : fortes.map(x => (
            <div key={x.dim} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: T.cream }}>{x.label}</span>
              <DiBarra valor={x.media} largura={60} />
            </div>
          ))}
        </div>

        <div style={card}>
          <h3 style={{ ...display, color: T.cream, fontSize: 14, margin: '0 0 2px' }}>Prioridades sugeridas</h3>
          <p style={{ color: T.mutedDim, fontSize: 11.5, margin: '0 0 10px' }}>
            Sugestão, não decisão. Cada uma diz porque está na lista.
          </p>
          {prioridades.slice(0, 3).map((x, i) => (
            <div key={x.dim} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...mono, fontSize: 11, color: T.warn }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12.5, color: T.cream }}>{x.label}</span>
                <DiBarra valor={x.media} largura={50} />
              </div>
              <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 4 }}>{x.motivos.join(' · ')}</div>
            </div>
          ))}
        </div>

        {registo.abertas && (
          <div style={card}>
            <h3 style={{ ...display, color: T.cream, fontSize: 14, margin: '0 0 8px' }}>Nas palavras do jogador</h3>
            {DI_ABERTAS.map(q => (
              registo.abertas[q.id] ? (
                <div key={q.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11.5, color: T.mutedDim }}>{q.texto}</div>
                  <div style={{ fontSize: 12.5, color: T.cream }}>{registo.abertas[q.id]}</div>
                </div>
              ) : null
            ))}
          </div>
        )}

        {registo.comentarios && Object.values(registo.comentarios).some(Boolean) && (
          <div style={card}>
            <h3 style={{ ...display, color: T.cream, fontSize: 14, margin: '0 0 8px' }}>Notas da equipa técnica</h3>
            {DI_DIMENSOES.map(d => (
              registo.comentarios[d.id] ? (
                <div key={d.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11.5, color: T.mutedDim }}>{d.label}</div>
                  <div style={{ fontSize: 12.5, color: T.cream }}>{registo.comentarios[d.id]}</div>
                </div>
              ) : null
            ))}
          </div>
        )}

        <div style={card}>
          <Field label="Notas da reunião" solto>
            <TextArea value={registo.notasReuniao || ''} onChange={e => onNotas(e.target.value)}
              placeholder="O que ficou combinado com o jogador." style={{ minHeight: 80 }} />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {!registo.reuniaoFeita && <Btn variant="ghost" onClick={onFeita}><Check size={15} /> Marcar reunião como feita</Btn>}
            {/* Marcada por engano: volta atrás. As notas não se perdem. */}
            {registo.reuniaoFeita && onDesfazer && (
              <Btn variant="ghost" onClick={onDesfazer}><RotateCw size={15} /> Desmarcar reunião (ainda não foi feita)</Btn>
            )}
            <Btn onClick={onIrParaPlano}>Criar plano individual</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PLANO INDIVIDUAL ---------------- */
export function DiPlano({ registo, onChange, onConcluir }) {
  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 };
  const plano = (registo && registo.plano) || { objetivos: [] };
  const objetivos = plano.objetivos || [];

  const setObjetivos = (lista) => onChange({ ...plano, objetivos: lista });
  const patch = (id, p) => setObjetivos(objetivos.map(o => (o.id === id ? { ...o, ...p } : o)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* O aviso aparece quando se PASSA dos três, não quando se chega
          aos três: com exatamente três está dentro do recomendado e não
          há nada a assinalar. */}
      {objetivos.length > DI_MAX_OBJETIVOS && (
        <div style={{ background: `${T.warn}1A`, border: `1px solid ${T.warn}55`, borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: T.cream }}>
          Para garantir foco e qualidade no desenvolvimento, recomenda-se trabalhar no máximo {DI_MAX_OBJETIVOS} prioridades
          simultaneamente. Podes continuar se achares necessário.
        </div>
      )}

      {objetivos.length === 0 && (
        <EmptyState text="Sem objetivos definidos. Acrescenta o primeiro a partir das prioridades da reunião." />
      )}

      {objetivos.map((o, i) => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ ...mono, fontSize: 11, color: T.warn }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Objetivo</span>
            <button onClick={() => setObjetivos(objetivos.filter(x => x.id !== o.id))}
              style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}>
              <Trash2 size={14} />
            </button>
          </div>

          <div style={{ ...FIELD_GRID, marginBottom: 10 }}>
            <Field label="Área">
              <Select value={o.area} onChange={e => patch(o.id, { area: e.target.value })}>
                <option value="">— escolher —</option>
                {DI_DIMENSOES.map(d => <option key={d.id} value={d.label}>{d.label}</option>)}
              </Select>
            </Field>
            <Field label="Prazo"><Input type="date" value={o.prazo} onChange={e => patch(o.id, { prazo: e.target.value })} /></Field>
            <Field label="Responsável">
              <Select value={o.responsavel} onChange={e => patch(o.id, { responsavel: e.target.value })}>
                {DI_RESPONSAVEIS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Estado">
              <Select value={o.estado} onChange={e => patch(o.id, { estado: e.target.value })}>
                {DI_ESTADOS_OBJETIVO.map(e2 => <option key={e2} value={e2}>{e2}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Objetivo" solto>
            <Input value={o.objetivo} onChange={e => patch(o.id, { objetivo: e.target.value })} placeholder="Ex: Melhorar a reação à perda." />
          </Field>
          <div style={{ height: 10 }} />
          <Field label="Porquê este objetivo" solto>
            <TextArea value={o.porque} onChange={e => patch(o.id, { porque: e.target.value })} style={{ minHeight: 50 }} />
          </Field>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Ações</div>
            {(o.acoes || []).map((a, ai) => (
              <div key={ai} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Input value={a} onChange={e => patch(o.id, { acoes: o.acoes.map((v, k) => (k === ai ? e.target.value : v)) })} style={{ flex: 1, minWidth: 0 }} />
                <button onClick={() => patch(o.id, { acoes: o.acoes.filter((_, k) => k !== ai) })}
                  style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => patch(o.id, { acoes: [...(o.acoes || []), ''] })}><Plus size={14} /> Ação</Btn>
          </div>

          <div style={{ marginTop: 12 }}>
            <Field label="Indicador de sucesso" solto>
              <Input value={o.indicador} onChange={e => patch(o.id, { indicador: e.target.value })}
                placeholder="Como é que sabemos que foi conseguido?" />
            </Field>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: T.muted }}>Progresso</span>
            {[1, 2, 3, 4, 5].map(v => (
              <button key={v} onClick={() => patch(o.id, { progresso: v })} style={{
                width: 30, height: 26, borderRadius: 6, fontSize: 12, cursor: 'pointer', ...body,
                background: o.progresso === v ? '#B5393F' : 'transparent',
                color: o.progresso === v ? TEXT_ON_ACCENT : T.muted,
                border: `1px solid ${o.progresso === v ? '#B5393F' : T.line}`,
              }}>{v}</button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <Field label="Observações" solto>
              <TextArea value={o.observacoes} onChange={e => patch(o.id, { observacoes: e.target.value })} style={{ minHeight: 44 }} />
            </Field>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn onClick={() => setObjetivos([...objetivos, diObjetivoVazio('')])}><Plus size={15} /> Novo objetivo</Btn>
        {objetivos.length > 0 && (
          <Btn variant="ghost" onClick={() => onConcluir(!(registo && registo.planoConcluido))}>
            {registo && registo.planoConcluido ? 'Reabrir plano' : 'Marcar plano como concluído'}
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ---------------- HISTÓRICO ---------------- */
export function DiHistorico({ jogador, momentos, colecao, isNarrow }) {
  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 };
  /* Por defeito mostrava sempre "equipa técnica" — um jogador que só
     tivesse a autoavaliação concluída (como o Vítor) ficava com o
     histórico vazio até o user trocar manualmente para "Autoavaliação".
     Arrancamos já na fonte que tem dados para este jogador. */
  const [fonte, setFonte] = useState(() => {
    const temStaff = momentos.some(m => diScoreGlobal((diRegisto(diRegistosDoMomento(colecao, m.id), jogador.id) || {}).staff).score != null);
    if (temStaff) return 'staff';
    const temAuto = momentos.some(m => diScoreGlobal((diRegisto(diRegistosDoMomento(colecao, m.id), jogador.id) || {}).auto).score != null);
    return temAuto ? 'auto' : 'staff';
  });

  /* Do mais antigo para o mais recente: um gráfico de evolução lê-se da
     esquerda para a direita. */
  const linha = [...momentos]
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .map(m => {
      const reg = diRegisto(diRegistosDoMomento(colecao, m.id), jogador.id);
      return { momento: m, registo: reg, score: diScoreGlobal(reg && reg[fonte]) };
    })
    .filter(x => x.score.score != null);

  if (linha.length === 0) {
    return <EmptyState text="Ainda não há avaliações concluídas para este jogador." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['staff', 'Equipa técnica'], ['auto', 'Autoavaliação']].map(([id, label]) => (
          <button key={id} onClick={() => setFonte(id)} style={{
            padding: '5px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer', ...body,
            background: fonte === id ? '#B5393F' : 'transparent',
            color: fonte === id ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${fonte === id ? '#B5393F' : T.line}`,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 11, color: T.muted, textTransform: 'uppercase', padding: '0 8px 8px' }}>Momento</th>
              {DI_DIMENSOES.map(d => (
                <th key={d.id} style={{ textAlign: 'center', fontSize: 10.5, color: T.muted, padding: '0 6px 8px', whiteSpace: 'nowrap' }}>
                  {d.label.split(' ')[0]}
                </th>
              ))}
              <th style={{ textAlign: 'center', fontSize: 11, color: T.warn, padding: '0 8px 8px' }}>Global</th>
            </tr>
          </thead>
          <tbody>
            {linha.map((x, i) => {
              const anterior = i > 0 ? linha[i - 1] : null;
              return (
                <tr key={x.momento.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: '8px', fontSize: 12.5, color: T.cream, whiteSpace: 'nowrap' }}>
                    {x.momento.nome}
                    <div style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>{fmtDate(x.momento.data)}</div>
                  </td>
                  {DI_DIMENSOES.map(d => {
                    const v = x.score.medias[d.id].media;
                    const antes = anterior && anterior.score.medias[d.id].media;
                    const delta = (v != null && antes != null) ? v - antes : null;
                    return (
                      <td key={d.id} style={{ padding: '8px 6px', textAlign: 'center', ...mono, fontSize: 11.5, color: T.cream }}>
                        {v == null ? '—' : v.toFixed(2)}
                        {delta != null && Math.abs(delta) >= 0.05 && (
                          <div style={{ fontSize: 10, color: delta > 0 ? T.good : T.bad }}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <DiBarra valor={x.score.score} largura={44} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

