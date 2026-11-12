// tatico/campo.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, TEXT_ON_ACCENT } from '../base/tema';
import React from 'react';
import { uid } from '../base/utilidades';

/* ---------------------------------------------------------------
   EDITOR VISUAL DE EXERCÍCIOS — campo interativo com 4 equipas de
   jogadores numerados (1-11), guarda-redes distintos, cones, bola
   e setas de passe/corrida.
---------------------------------------------------------------- */
export const TEAMS = [
  { id: 'A', label: 'Equipa A', fill: T.teamA, text: '#F0E7D6' },
  { id: 'B', label: 'Equipa B', fill: T.teamB, text: TEXT_ON_ACCENT },
  { id: 'C', label: 'Equipa C', fill: T.teamC, text: '#1B1B1B' },
  { id: 'D', label: 'Equipa D', fill: '#FFFFFF', text: '#1B1B1B' },
];

export const teamInfo = (id) => TEAMS.find(t => t.id === id) || TEAMS[0];

/* `curto` é a etiqueta usada no telemóvel, onde três botões por linha não
   deixam espaço para "Mover / Selecionar" nem "Guarda-redes" numa linha
   só. Não é abreviar por abreviar: são as duas únicas que não cabem. */
export const BASE_TOOLS = [
  { id: 'select', label: 'Mover / Selecionar', curto: 'Mover' },
  // Vários de uma vez: retângulo à volta, ou tocar em cada um; depois
  // arrasta-se o grupo todo (a equipa em bloco).
  { id: 'multi', label: 'Vários', title: 'Selecionar vários e mexê-los em bloco' },
  { id: 'player', label: 'Jogador' },
  { id: 'keeper', label: 'Guarda-redes', curto: 'GR' },
  { id: 'coach', label: 'T', title: 'Treinador' },
  { id: 'cone', label: 'Cone' },
  { id: 'goalmarker', label: 'Baliza' },
  { id: 'stake', label: 'Estaca' },
  { id: 'ball', label: 'Bola' },
  { id: 'arrow-pass', label: 'Passe' },
  { id: 'arrow-run', label: 'Corrida' },
  { id: 'line-solid', symbol: 'solid', title: 'Linha contínua' },
  { id: 'line-dashed', symbol: 'dashed', title: 'Linha tracejada' },
  { id: 'text', label: 'Texto', title: 'Caixa de texto — escreve no campo ou dentro de um quadrado' },
  { id: 'space-square', symbol: 'square', title: 'Zona / quadrado reduzido (igual ao campo Espaço)' },
  { id: 'eraser', label: 'Apagar' },
];

export const LINE_TOOLS = ['arrow-pass', 'arrow-run', 'line-solid', 'line-dashed'];

export const MARKER_TOOLS = ['cone', 'ball', 'goalmarker', 'stake', 'coach'];

export const KEEPER_NUMBERS = [1, 12, 24];

/* Interpreta o formato do nº de jogadores e devolve uma lista de "grupos",
   cada um com a sua cor/equipa (Equipa A, B, C, D):
   - "8"              → 1 grupo de 8 (Equipa A)
   - "4x4"            → 2 grupos de 4 (Equipa A vs Equipa B)
   - "4x4x4x4"        → 4 grupos de 4 (uma cor por lado)
   - "3 Gr"           → 3 guarda-redes, cada um numa cor diferente
   - "x" / "×" separa LADOS (equipas diferentes, ex.: A vs B);
   - "+" separa SUBGRUPOS dentro do mesmo lado (cores extra nesse lado,
     ex.: jogadores de linha + um "coringa"/apoio de cor diferente);
   - dentro de cada lado, o(s) guarda-redes ("Gr") herdam sempre a cor
     principal desse lado (a do 1º subgrupo de linha), em vez de ganharem
     uma cor à parte — ex.: "4+1+1gr x 4+1+1gr" → lado 1: 4 numa cor + 1
     noutra cor + 1 Gr na cor principal do lado 1; lado 2 igual, com as
     suas próprias cores. */
export function parsePlayersCount(str) {
  if (!str) return null;
  const raw = String(str).toLowerCase().trim();
  if (!raw) return null;

  // Caso "N Gr": só guarda-redes, cada um numa cor diferente.
  const pureGr = raw.match(/^(\d+)\s*gr\.?$/);
  if (pureGr) {
    const n = Math.min(4, parseInt(pureGr[1], 10) || 0);
    if (!n) return null;
    return { groups: Array.from({ length: n }, (_, i) => ({ count: 1, isKeeper: true, team: TEAMS[i % TEAMS.length].id })) };
  }

  /* JOKERS ENTRE PARÊNTESES: (3)6x6(3).

     São jogadores que jogam pelas DUAS equipas — três jokers, não seis.
     A leitura anterior não conhecia parênteses: em "(3)6" apanhava o
     primeiro número que encontrava e ficava com 3 em vez de 6. Uma equipa
     de seis virava de três, e o exercício saía sempre com gente a menos.

     Escrito nos dois lados com o mesmo número, é o MESMO grupo — é o que
     a notação quer dizer e é como se escreve no quadro. Com números
     diferentes, (2)6x6(3), são dois grupos distintos, porque aí já não
     pode ser o mesmo conjunto de pessoas. */
  const jokers = [];
  const semParenteses = raw.replace(/\((\d+)\)/g, (_, n) => {
    const c = parseInt(n, 10) || 0;
    if (c > 0) jokers.push(c);
    return '';
  });

  // Divide primeiro por 'x'/'×' — cada parte é um lado/equipa distinta.
  const sides = semParenteses.split(/[x×]/).map(s => s.trim()).filter(Boolean);
  if (sides.length === 0 && !jokers.length) return null;

  let colorIdx = 0;
  const groups = [];
  sides.forEach(side => {
    // Dentro de cada lado, divide por '+' — subgrupos desse mesmo lado.
    const tokens = side.split('+').map(t => t.trim()).filter(Boolean);
    /* Jogadores de linha e guarda-redes processam-se em duas passagens,
       não pela ordem em que foram escritos: assim "1gr+10" e "10+1gr"
       dão exatamente o mesmo resultado — 10 de linha e 1 Gr, todos na
       MESMA cor. Antes, escrever o Gr primeiro ("1gr+10") fazia o Gr
       "roubar" a cor principal do lado e os 10 de linha saíam numa cor
       diferente, dividindo o que devia ser uma equipa só em duas cores. */
    const grTokens = [];
    const lineTokens = [];
    tokens.forEach(tok => {
      if (/^\d*\s*gr\.?$/.test(tok)) grTokens.push(tok);
      else lineTokens.push(tok);
    });

    let sideTeam = null; // cor principal deste lado (a do 1º subgrupo de linha)
    lineTokens.forEach(tok => {
      const num = tok.match(/\d+/);
      if (!num) return;
      /* Antes o limite era 11 — pensado para uma equipa de onze. Mas o
         campo de "Nº de jogadores" também serve para grupos grandes num
         treino inteiro ("25"), e nesses casos o 25 virava 11 em silêncio.
         A numeração já dá a volta sozinha (2..11 e recomeça em DD), por
         isso só era o limite que estorvava. */
      const count = Math.min(30, parseInt(num[0], 10) || 0);
      if (!count) return;
      const team = TEAMS[colorIdx % TEAMS.length].id;
      if (!sideTeam) sideTeam = team;
      colorIdx++;
      groups.push({ count, isKeeper: false, team });
    });

    // Guarda-redes deste lado: herdam sempre a cor principal já
    // definida pela linha; só ganham cor própria se o lado não tiver
    // nenhum jogador de linha (ex.: um lado feito só de guarda-redes).
    grTokens.forEach(tok => {
      const grTok = tok.match(/^(\d*)\s*gr\.?$/);
      const count = Math.max(1, parseInt(grTok[1], 10) || 1);
      const team = sideTeam || TEAMS[colorIdx % TEAMS.length].id;
      if (!sideTeam) { sideTeam = team; colorIdx++; }
      groups.push({ count, isKeeper: true, team });
    });
  });

  /* Os jokers entram como um grupo próprio, com cor própria — para se
     ver de relance quem joga pelos dois lados. */
  if (jokers.length) {
    const iguais = jokers.length > 1 && jokers.every(n => n === jokers[0]);
    const conjuntos = iguais ? [jokers[0]] : jokers;
    conjuntos.forEach(count => {
      groups.push({ count, isKeeper: false, team: TEAMS[colorIdx % TEAMS.length].id, joker: true });
      colorIdx++;
    });
  }

  if (groups.length === 0) return null;
  return { groups };
}

// Jogadores: 2 a 11. Guarda-redes: sequência fixa 1, 12, 24 (números
// habituais de guarda-redes), independente da cor.
/* Depois do 11 (PL) a sequência recomeça no 2 (DD), em vez de ficar presa
   a devolver sempre 11. Com 25 jogadores em campo — treinos de plantel
   inteiro, jogos reduzidos com muitas equipas — passava-se a ter uma fila
   de "PL" idênticos, impossível de ler. Agora repete DD, DC, DC, DE, MD…
   tantas vezes quantas forem precisas. */
export function nextPlayerNumber(elements, team) {
  const doTime = elements.filter(e => e.kind === 'player' && e.team === team);
  const NUMEROS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  // Quantas voltas completas já foram dadas, e em que ponto da volta.
  const contagem = new Map(NUMEROS.map(n => [n, 0]));
  doTime.forEach(e => { if (contagem.has(e.number)) contagem.set(e.number, contagem.get(e.number) + 1); });
  const minimo = Math.min(...NUMEROS.map(n => contagem.get(n)));
  // O primeiro número que ainda não atingiu a volta seguinte.
  return NUMEROS.find(n => contagem.get(n) === minimo) || 2;
}

export function nextKeeperNumber(elements, team) {
  const count = elements.filter(e => e.kind === 'keeper' && e.team === team).length;
  return KEEPER_NUMBERS[count % KEEPER_NUMBERS.length];
}

// Em vez do número, as bolas mostram a letra da posição:
// 2-DD 3-DC 4-DC 5-DE 6-MD 7-MC 8-MO 9-EX 10-EX 11-PL — GR para guarda-redes.
/* O 8 É MÉDIO OFENSIVO (MO), NÃO UM SEGUNDO MC.

   Com 7 e 8 a escreverem os dois "MC", o desenho ficava com dois médios
   centrais iguais lado a lado e não se via quem fica e quem sobe. A
   convenção do quadro passa a ser a mesma de um meio-campo a sério:
   6 = MD (médio defensivo, o trinco), 7 = MC (interior),
   8 = MO (médio ofensivo, o que joga entre linhas). */
export const POSITION_LABELS = { 2: 'DD', 3: 'DC', 4: 'DC', 5: 'DE', 6: 'MD', 7: 'MC', 8: 'MO', 9: 'EX', 10: 'EX', 11: 'PL' };

/* Parte o texto em linhas: primeiro pelos Enter escritos à mão, depois
   pelo limite de caracteres. Palavras maiores do que o limite não são
   cortadas a meio — ficam sozinhas na linha, que é o mal menor. */
export function quebrarTexto(texto, maxChars) {
  const bruto = String(texto == null ? '' : texto);
  if (!bruto) return [''];
  const linhas = [];
  bruto.split('\n').forEach(paragrafo => {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    if (!palavras.length) { linhas.push(''); return; }
    let atual = '';
    palavras.forEach(palavra => {
      /* Palavra maior do que a largura pedida parte-se à força.

         Sem isto, os botões de largura não faziam nada em textos de uma só
         palavra ("Basculação", um apelido): a palavra entrava sempre
         inteira e a caixa ficava sempre do mesmo tamanho, por muito que se
         carregasse no menos. */
      let resto = palavra;
      while (resto.length > maxChars) {
        if (atual) { linhas.push(atual); atual = ''; }
        linhas.push(resto.slice(0, maxChars));
        resto = resto.slice(maxChars);
      }
      const proposta = atual ? `${atual} ${resto}` : resto;
      if (proposta.length <= maxChars || !atual) { atual = proposta; return; }
      linhas.push(atual);
      atual = resto;
    });
    if (atual) linhas.push(atual);
  });
  return linhas.length ? linhas : [''];
}

export function elementLabel(number, isKeeper) {
  if (isKeeper) return 'GR';
  return POSITION_LABELS[number] || String(number);
}

/* O QUE APARECE NO CÍRCULO DE CADA JOGADOR — escolhido para o esquema
   inteiro (`diagram.rotulos`) e copiado para cada jogador (`el.rotulo`),
   para todos os sítios que desenham o campo (editor, apresentação,
   miniaturas, impressão, Portal) mostrarem igual sem precisarem de saber
   de onde vem o esquema:
   · 'posicao' (ou nada): a sigla da posição, como sempre (DD, DC, GR…);
   · 'numero': o número da camisola (`el.camisola`; sem ele, o número
     clássico da posição: 2 DD, 3 DE, 4 e 5 DC… e 1 no GR);
   · 'cor': só a cor, sem texto. */
export const ROTULOS_JOGADOR = [
  { id: 'posicao', label: 'Posição', title: 'Mostra a posição (DD, DC, MC…)' },
  { id: 'numero', label: 'Nº', title: 'Mostra o número da camisola' },
  { id: 'cor', label: 'Cor', title: 'Só a cor, sem texto' },
];

export function rotuloIcone(el) {
  if (!el) return '';
  const isKeeper = el.kind === 'keeper';
  if (el.rotulo === 'cor') return '';
  if (el.rotulo === 'numero') {
    if (el.convidado) return '';
    const c = el.camisola != null && String(el.camisola).trim() !== '' ? String(el.camisola).trim() : null;
    if (c) return c;
    return typeof el.number === 'number' ? String(el.number) : (isKeeper ? '1' : '');
  }
  return elementLabel(el.number, isKeeper);
}

// Copia o modo do esquema para cada jogador (também nos passos da animação).
export function carimbarRotulos(diagram, modo) {
  const m = modo === 'numero' || modo === 'cor' ? modo : undefined;
  const marcar = (lista) => (lista || []).map(el => {
    if (!el || (el.kind !== 'player' && el.kind !== 'keeper')) return el;
    if (m) return el.rotulo === m ? el : { ...el, rotulo: m };
    if (el.rotulo === undefined) return el;
    const { rotulo, ...resto } = el; return resto;
  });
  return {
    ...diagram,
    rotulos: m,
    elements: marcar(diagram.elements),
    sequence: Array.isArray(diagram.sequence) ? diagram.sequence.map(st => (st && st.elements ? { ...st, elements: marcar(st.elements) } : st)) : diagram.sequence,
  };
}

/* Bola do campo tático — a clássica, branca com pentágonos pretos.

   É o padrão "Telstar": doze pentágonos pretos entre vinte hexágonos
   brancos. É um motivo genérico do futebol, não a marca de ninguém — sem
   logótipos nem referências a fabricantes.

   Foi desenhado nos anos 60 precisamente para se distinguir bem numa
   imagem pequena, o que continua a ser a razão certa para o usar aqui,
   onde a bola aparece com três milímetros no ecrã.

   Vista de frente, uma esfera encurta o que está nas margens: por isso os
   pentágonos do anel são desenhados MENORES e mais perto do centro do que
   a geometria plana daria. É esse detalhe que a faz parecer redonda em vez
   de um autocolante. */
export function TriondaBall({ cx, cy, r }) {
  const preto = '#17181A';
  const costura = '#9A9A96';
  const gid = `bola-${Math.round(cx * 100)}-${Math.round(cy * 100)}`;

  const pentagono = (px, py, raio, rot) => {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const ang = ((i * 72 - 90 + rot) * Math.PI) / 180;
      pts.push(`${px + Math.cos(ang) * raio},${py + Math.sin(ang) * raio}`);
    }
    return pts.join(' ');
  };

  // Um pentágono de frente e cinco à volta.
  const anel = [0, 72, 144, 216, 288];

  return (
    <>
      <defs>
        {/* Iluminada de cima à esquerda, como uma bola num relvado. */}
        <radialGradient id={gid} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#F0F0EC" />
          <stop offset="100%" stopColor="#B6B6B1" />
        </radialGradient>
        <clipPath id={`${gid}-c`}>
          <circle cx={cx} cy={cy} r={r * 0.97} />
        </clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} stroke={preto} strokeWidth={r * 0.07} />

      <g clipPath={`url(#${gid}-c)`}>
        <polygon points={pentagono(cx, cy, r * 0.33, 0)} fill={preto} />
        {anel.map((a, i) => {
          const rad = ((a - 90) * Math.PI) / 180;
          return (
            <polygon
              key={i}
              points={pentagono(cx + Math.cos(rad) * r * 0.76, cy + Math.sin(rad) * r * 0.76, r * 0.27, a + 180)}
              fill={preto}
            />
          );
        })}
        {/* Costuras: dos vértices do pentágono central para os de fora.
            Ténues, para não fazerem ruído a este tamanho. */}
        {anel.map((a, i) => {
          const rad = ((a - 90) * Math.PI) / 180;
          return (
            <line
              key={`c${i}`}
              x1={cx + Math.cos(rad) * r * 0.33} y1={cy + Math.sin(rad) * r * 0.33}
              x2={cx + Math.cos(rad) * r * 0.52} y2={cy + Math.sin(rad) * r * 0.52}
              stroke={costura} strokeWidth={r * 0.05} strokeLinecap="round" opacity="0.75"
            />
          );
        })}
      </g>

      {/* Brilho no canto superior esquerdo: dá-lhe volume de esfera. */}
      <ellipse cx={cx - r * 0.34} cy={cy - r * 0.38} rx={r * 0.24} ry={r * 0.15} fill="#FFFFFF" opacity="0.55" />
    </>
  );
}

/* Bandeirola de canto — pequeno poste + pendão triangular, orientado
   para fora do campo a partir do ponto exato do canto (cx, cy), na
   direção diagonal (ox, oy), que deve ser um vetor unitário. */
export function CornerFlag({ cx, cy, ox, oy, color }) {
  const tx = cx + ox * 1.7;
  const ty = cy + oy * 1.7;
  const px = -oy, py = ox;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={color} strokeWidth="0.16" strokeLinecap="round" />
      <polygon
        points={`${tx},${ty} ${tx + px * 0.9},${ty + py * 0.9} ${tx + ox * 0.85 + px * 0.45},${ty + oy * 0.85 + py * 0.45}`}
        fill={color}
      />
    </g>
  );
}

/* ENQUADRAMENTO DO CAMPO

   O relvado ocupa x 1→106 e y 1→69 (105×68 m reais) e NÃO muda: todas as
   posições já gravadas continuam onde estavam, e as zonas com nome (grande
   área, meio campo) continuam a assentar nas linhas certas.

   O que muda é a moldura à volta. Antes era `-3 -2 113 74`, uns escassos
   3 m de folga; agora há espaço para o campo respirar e, em baixo, para os
   bancos de supentes e as áreas técnicas — que existem no campo real e
   ajudam a ler de que lado se está a jogar.

   Estão num só sítio porque o mesmo enquadramento é usado em dez lugares
   (editor, apresentação, miniaturas, impressão, ficheiro partilhável) e
   um deles ficar para trás dá desalinhamentos difíceis de perceber. */
export const PITCH_VIEWBOX = '-4 -3 115 84';

export const PITCH_ASPECT = '115 / 84';

// Limites para o mapeamento do rato (ver toPoint no DiagramEditor).
export const PITCH_BOX = { x: -4, y: -3, w: 115, h: 84 };

/* VISTA DO CAMPO — "completo" (horizontal, o de sempre) ou "meio"
   (meio-campo na VERTICAL, com a baliza da direita em cima).

   As posições gravadas são SEMPRE as do campo inteiro (x 0–107, y 0–70):
   a vista só muda como se olha para ele. Por isso trocar de vista não
   estraga nada — o que estiver na outra metade continua lá, só fica fora
   do enquadramento. A rotação é feita por um <g> à volta do desenho
   (`VistaCampo`); os textos rodam ao contrário (`useRodarTexto`) para se
   continuarem a ler direitos.

   O enquadramento do meio-campo tem exatamente a mesma proporção do campo
   inteiro (115 × 84), para nenhum contentor precisar de mudar de forma. */
export const VISTA_MEIO = { u0: -3, v0: -3.36, w: 84, h: 84 * 84 / 115 };

export const PITCH_VIEWBOX_MEIO = `${VISTA_MEIO.u0} ${VISTA_MEIO.v0} ${VISTA_MEIO.w} ${VISTA_MEIO.h.toFixed(3)}`;

// (x, y) do campo → (u, v) no ecrã: u = y, v = 107 − x.
export const VISTA_MEIO_TRANSFORM = 'matrix(0 -1 1 0 0 107)';

/* ENQUADRAMENTO SÓ DO EDITOR.

   No computador a moldura do editor tem a mesma altura de sempre (o ecrã
   menos as ferramentas, a linha das animações e o painel do item
   selecionado): nada à volta mexe. O campo mantém as proporções reais e
   fica o maior possível dentro dessa altura, com a mesma margem de
   relvado à volta toda. Para o campo crescer, saem os bancos de suplentes
   por baixo do campo (continuam na apresentação, impressão, partilha e
   miniaturas).
   Meio-campo: da baliza até à linha do meio-campo, inteira, e com a
   mesma moldura (trocar de vista não mexe em nada).
   Se algum item estiver fora desta zona (por exemplo onde estavam os
   bancos), o editor usa o enquadramento de sempre, para nada ficar
   escondido. */
// A MESMA margem à volta do campo todo: 3,5 m para lá das linhas (x 1–106,
// y 1–69). Dos lados a baliza sai 2,5 m e fica 1 m de folga.
export const EDITOR_MARGEM = 3.5;

export const EDITOR_Y_MIN = 1 - EDITOR_MARGEM;

export const EDITOR_Y_MAX = 69 + EDITOR_MARGEM;

export const EDITOR_BOX = { x: 1 - EDITOR_MARGEM, y: EDITOR_Y_MIN, w: 105 + 2 * EDITOR_MARGEM, h: EDITOR_Y_MAX - EDITOR_Y_MIN };

export const EDITOR_VIEWBOX = `${EDITOR_BOX.x} ${EDITOR_BOX.y} ${EDITOR_BOX.w} ${EDITOR_BOX.h}`;

// Meio-campo (v = 107 − x): da folga atrás da baliza (sai até v −1,5)
// até logo a seguir à linha do meio-campo (x 53,5 → v 53,5).
export const EDITOR_MEIO_V0 = -2.3;

export const EDITOR_MEIO_H = 53.5 + 0.8 - EDITOR_MEIO_V0;

// Mesma proporção da moldura do campo inteiro (trocar de vista não mexe).
export const EDITOR_MEIO_W = EDITOR_MEIO_H * EDITOR_BOX.w / EDITOR_BOX.h;

export const EDITOR_MEIO_U0 = 35 - EDITOR_MEIO_W / 2;

export const EDITOR_VIEWBOX_MEIO = `${EDITOR_MEIO_U0} ${EDITOR_MEIO_V0} ${EDITOR_MEIO_W} ${EDITOR_MEIO_H.toFixed(3)}`;

// Parte do comprimento do campo que se vê no meio-campo do editor.
export const EDITOR_MEIO_X_MIN = 107 - (EDITOR_MEIO_V0 + EDITOR_MEIO_H);

export const EDITOR_MEIO_X_MAX = 107 - EDITOR_MEIO_V0;

export function viewBoxDaVista(vista) { return vista === 'meio' ? PITCH_VIEWBOX_MEIO : PITCH_VIEWBOX; }

/* SEM BANCOS (impressões, partilhar, ver a sessão): o enquadramento do
   editor e da apresentação — a mesma margem de relvado à volta toda, nas
   duas vistas. Os bancos de suplentes deixaram de existir no campo. */
/* Meio-campo nas impressões, no partilhar e na vista da sessão: a MESMA
   proporção do campo inteiro (caixas do mesmo tamanho) e o meio-campo
   TODO à vista, da rede da baliza (v −1,5) até à linha do meio-campo
   (v 53,5), com folga mínima em cima e em baixo para o campo ficar o
   maior possível; a largura que sobra fica dos lados, centrada. */
export function viewBoxSemBancos(vista) {
  if (vista !== 'meio') return EDITOR_VIEWBOX;
  const v0 = -2.1, h = 53.5 + 0.9 - v0;
  const w = h * EDITOR_BOX.w / EDITOR_BOX.h;
  return `${(35 - w / 2).toFixed(3)} ${v0} ${w.toFixed(3)} ${h.toFixed(3)}`;
}

export function aspetoSemBancos() { return `${EDITOR_BOX.w} / ${EDITOR_BOX.h}`; }

/* LINHAS LATERAIS ALARGADAS NO MEIO-CAMPO (impressões, partilhar, vista
   da sessão e cartões). O meio-campo é mais "quadrado" do que a caixa do
   campo inteiro: para a caixa ficar do mesmo tamanho, com a linha do
   meio-campo à vista E as linhas laterais junto às bordas, o desenho do
   campo estica-se na largura (linhas, zonas, setas e as POSIÇÕES dos
   itens). Os ícones NÃO esticam (ver `useContraEsticar`): ficam redondos.
   O fator leva as linhas laterais até à mesma folga do campo inteiro. */
export const ESTICAR_IMPRESSAO_MEIO = (() => {
  const h = 53.5 + 0.9 + 2.1;
  const w = h * EDITOR_BOX.w / EDITOR_BOX.h;
  return (w / 2 - EDITOR_MARGEM) / 34;
})();

export const VistaCampoCtx = React.createContext('completo');

export const VistaEsticarCtx = React.createContext(1);

// `esticar` (só no meio-campo): alarga o campo na largura do ecrã (o eixo y
// do campo) à volta do centro (y 35). Ver ESTICAR_IMPRESSAO_MEIO.
export function VistaCampo({ vista, gRef, children, esticar = 1 }) {
  const v = vista === 'meio' ? 'meio' : 'completo';
  const k = v === 'meio' && esticar && esticar !== 1 ? esticar : 1;
  const t = v === 'meio'
    ? (k !== 1 ? `${VISTA_MEIO_TRANSFORM} translate(0 35) scale(1 ${k.toFixed(4)}) translate(0 -35)` : VISTA_MEIO_TRANSFORM)
    : undefined;
  return (
    <VistaCampoCtx.Provider value={v}>
      <VistaEsticarCtx.Provider value={k}>
        <g ref={gRef} transform={t}>{children}</g>
      </VistaEsticarCtx.Provider>
    </VistaCampoCtx.Provider>
  );
}

// Desfaz o esticar num ícone (à volta da sua posição): o sítio estica com o
// campo, o desenho do ícone não. Sem esticar, não mexe em nada.
export function useContraEsticar() {
  const k = React.useContext(VistaEsticarCtx);
  return k === 1 ? () => undefined : (x, y) => `translate(0 ${y}) scale(1 ${(1 / k).toFixed(4)}) translate(0 ${-y})`;
}

// Rotação que mantém um texto direito na vista vertical (à volta de cx, cy).
export function useRodarTexto() {
  const v = React.useContext(VistaCampoCtx);
  return (cx, cy) => (v === 'meio' ? `rotate(90 ${cx} ${cy})` : undefined);
}

/* CAMPO QUE CABE NA JANELA — SEM DISTORCER

   O objetivo é que a barra de ferramentas e os botões de anular/refazer
   caibam no ecrã ao mesmo tempo que o campo, sem obrigar a fazer scroll a
   meio de um desenho.

   ATENÇÃO à forma como isto se faz. A tentação é `width:100%` +
   `aspectRatio` + `maxHeight`, mas isso NÃO funciona: o elemento mantém a
   largura toda e só corta a altura, ficando com uma proporção diferente
   da declarada. O desenho estica na horizontal e os jogadores aparecem
   ovais em vez de redondos.

   O que resolve é limitar a LARGURA. Com a proporção fixa, limitar a
   largura limita a altura na mesma medida, e a forma nunca se altera:

       largura máxima = altura máxima × (largura / altura do enquadramento)

   O cálculo é feito aqui a partir do próprio enquadramento, para não
   ficar dessincronizado se um dia o viewBox mudar. */
/* O CAMPO OCUPA A LARGURA TODA. Ponto.

   Passei várias versões a tentar que o campo, a barra de ferramentas e o
   painel de edição coubessem TODOS no ecrã sem rolar. Era a premissa
   errada, e o resultado foi um campo cada vez mais pequeno: numa janela de
   1012 px de conteúdo, a regra baseada na altura dava-lhe 465 px e
   desperdiçava mais de metade do espaço.

   A prancheta é a ferramenta de trabalho — é onde se desenha, arrasta e
   lê. Vale mais rolar um pouco a página para chegar ao painel de edição do
   que desenhar num campo apertado. Por isso o campo leva a largura toda do
   que tem disponível, e a altura sai da proporção.

   `aspectRatio` sozinho garante que nunca achata: a altura é sempre a
   largura a dividir pela proporção do enquadramento. Não há aqui
   `maxHeight` de propósito — limitar a altura deixaria o elemento com a
   largura toda e uma proporção diferente da declarada, e o desenho
   esticava (foi assim que os jogadores ficaram ovais, numa versão
   anterior).

   ONDE ISTO DEIXAVA DE CHEGAR: numa janela LARGA (computador), 100% da
   largura disponível dava um campo tão alto que passava do fundo do
   ecrã — era preciso rolar para ver a barra de ferramentas e o painel de
   edição por baixo. A tentação é voltar a medir a altura disponível em
   JavaScript, mas foi exatamente essa medição (um ResizeObserver a
   vigiar o próprio contentor que ia redimensionar) que antes fazia o
   campo tremer. Em vez disso, o limite sai também da PROPORÇÃO — mas
   agora calculado a partir de uma altura-alvo em vh, não da largura do
   contentor: `min(100%, altura-alvo-em-vh × proporção)`. Continua a ser
   a LARGURA a ser limitada (a altura nunca se toca diretamente), por
   isso a forma não se distorce; e como é só CSS, o browser recalcula
   sozinho ao redimensionar a janela, sem qualquer ciclo de medição. Numa
   janela estreita (telemóvel) o 100% já é mais pequeno do que este
   limite, e o `min()` escolhe-o — o campo continua a ocupar a largura
   toda como antes. */
// 86 (antes 70): com o editor mais largo (até 1480 px), o campo cresce e
// enche mais as laterais; a barra de ferramentas fica logo por cima.
export const PITCH_TARGET_VH = 86;

// Altura de tudo o que rodeia o campo no editor (computador): cores,
// ferramentas, dica, linha das animações, painel do selecionado e marca.
// O campo fica com o resto do ecrã: tudo à vista sem scroll.
export const CHROME_EDITOR_PX = 222;

export const PITCH_FIT = {
  width: '100%',
  aspectRatio: PITCH_ASPECT,
  margin: '0 auto',
  maxWidth: `min(100%, ${(PITCH_TARGET_VH * (PITCH_BOX.w / PITCH_BOX.h)).toFixed(1)}vh)`,
};

/* Bancos de suplentes e áreas técnicas.

   Medidas do regulamento: a área técnica estende-se 1 m para cada lado dos
   bancos e até 1 m da linha lateral. Os bancos ficam a 5 m da linha de
   meio-campo, um de cada lado. Aqui ficam desenhados por baixo da linha
   lateral de baixo (y = 69), na folga nova. */
export function BenchesAndTechnicalArea({ printMode }) {
  const linha = printMode ? '#2A2A2A' : '#ffffff5A';
  const estrutura = printMode ? '#666' : '#ffffff78';
  const telha = printMode ? '#F2F2F2' : '#ffffff22';
  const assento = printMode ? '#DDD' : '#ffffff30';
  const sombra = printMode ? '#CCC' : '#00000033';

  /* Casa e visitante bem separados: 11 m de cada lado da linha de
     meio-campo, como num estádio a sério, em vez de dois abrigos quase
     encostados um ao outro no meio. */
  const lados = [
    { x: 27.5, largura: 15 },   // termina a 11 m do meio-campo
    { x: 64.5, largura: 15 },   // começa a 11 m do meio-campo
  ];

  const yLinha = 69;        // linha lateral
  const yFrenteArea = 71;   // a área técnica começa 2 m atrás da linha
  const yAbrigo = 75.6;     // frente do abrigo
  const alturaAbrigo = 3.8;

  return (
    <>
      {lados.map((l, i) => {
        const cx = l.x + l.largura / 2;
        return (
          <g key={i}>
            {/* ÁREA TÉCNICA — retângulo tracejado com a abertura virada
                para o relvado e as duas marcas de canto que a delimitam
                no relvado, como as linhas pintadas em campo. */}
            <rect
              x={l.x - 1} y={yFrenteArea} width={l.largura + 2} height={yAbrigo - yFrenteArea}
              fill="none" stroke={linha} strokeWidth="0.26" strokeDasharray="1.4,1.1"
            />

            {/* Sombra do abrigo no chão, para o separar do relvado. */}
            <ellipse cx={cx} cy={yAbrigo + alturaAbrigo} rx={l.largura / 2 + 0.6} ry="0.5" fill={sombra} />

            {/* ABRIGO — telhado curvo em consola sobre dois montantes.
                É o perfil que se reconhece de longe. */}
            <path
              d={`M ${l.x - 0.6} ${yAbrigo + alturaAbrigo}
                  L ${l.x - 0.6} ${yAbrigo + 1.5}
                  Q ${cx} ${yAbrigo - 1.1} ${l.x + l.largura + 0.6} ${yAbrigo + 1.5}
                  L ${l.x + l.largura + 0.6} ${yAbrigo + alturaAbrigo} Z`}
              fill={telha} stroke={estrutura} strokeWidth="0.3" strokeLinejoin="round"
            />
            {/* Aresta frontal do telhado. */}
            <path
              d={`M ${l.x - 0.6} ${yAbrigo + 1.5} Q ${cx} ${yAbrigo - 1.1} ${l.x + l.largura + 0.6} ${yAbrigo + 1.5}`}
              fill="none" stroke={estrutura} strokeWidth="0.38"
            />
            {/* Montantes laterais. */}
            <line x1={l.x - 0.6} y1={yAbrigo + 1.5} x2={l.x - 0.6} y2={yAbrigo + alturaAbrigo} stroke={estrutura} strokeWidth="0.34" />
            <line x1={l.x + l.largura + 0.6} y1={yAbrigo + 1.5} x2={l.x + l.largura + 0.6} y2={yAbrigo + alturaAbrigo} stroke={estrutura} strokeWidth="0.34" />

            {/* Banco corrido com encosto e lugares separados. */}
            <rect
              x={l.x + 0.5} y={yAbrigo + 2.3} width={l.largura - 1} height={1.35} rx={0.28}
              fill={assento} stroke={estrutura} strokeWidth="0.2"
            />
            {Array.from({ length: 8 }, (_, k) => {
              const passo = (l.largura - 1) / 9;
              const px = l.x + 0.5 + passo * (k + 1);
              return <line key={k} x1={px} y1={yAbrigo + 2.3} x2={px} y2={yAbrigo + 3.65} stroke={estrutura} strokeWidth="0.15" opacity="0.85" />;
            })}

          </g>
        );
      })}
    </>
  );
}

export function PitchMarkings({ printMode, cartao = false, semBancos = false }) {

  // Em ecrã, linhas brancas translúcidas sobre o relvado escuro; em
  // impressão (fundo branco, para poupar tinto) linhas escuras sólidas,
  // para se manterem legíveis no papel.
  const stroke = printMode ? '#2A2A2A' : '#ffffff55';
  const strokeGoal = printMode ? '#2A2A2A' : '#ffffffcc';
  const flagColor = printMode ? '#2A2A2A' : '#E7CD7A';
  const D = 0.70710678; // sen/cos de 45º, para as diagonais dos cantos

  return (
    <>
      {/* Riscas do relvado (faixas alternadas, como num campo cortado) —
          em todo o lado no ecrã (cartões, editor 2D, apresentação); na
          impressão não, para poupar tinta. */}
      {!printMode && Array.from({ length: 14 }, (_, i) => (
        i % 2 === 0 ? <rect key={`risca${i}`} x={1 + i * 7.5} y="1" width="7.5" height="68" fill="#ffffff" fillOpacity="0.045" /> : null
      ))}
      <rect x="1" y="1" width="105" height="68" fill="none" stroke={stroke} strokeWidth="0.4" />
      <line x1="53.5" y1="1" x2="53.5" y2="69" stroke={stroke} strokeWidth="0.4" />
      <circle cx="53.5" cy="35" r="9.15" fill="none" stroke={stroke} strokeWidth="0.4" />
      <circle cx="53.5" cy="35" r="0.35" fill={stroke} />
      <rect x="1" y="14.84" width="16.5" height="40.32" fill="none" stroke={stroke} strokeWidth="0.4" />
      <rect x="89.5" y="14.84" width="16.5" height="40.32" fill="none" stroke={stroke} strokeWidth="0.4" />
      <rect x="1" y="25.84" width="5.5" height="18.32" fill="none" stroke={stroke} strokeWidth="0.4" />
      <rect x="100.5" y="25.84" width="5.5" height="18.32" fill="none" stroke={stroke} strokeWidth="0.4" />
      {/* marcas de grande penalidade */}
      <circle cx="12" cy="35" r="0.35" fill={stroke} />
      <circle cx="95" cy="35" r="0.35" fill={stroke} />
      {/* meia-lua da grande área (arco fora da linha da grande área) */}
      <path d="M 17.5 27.69 A 9.15 9.15 0 0 1 17.5 42.31" fill="none" stroke={stroke} strokeWidth="0.4" />
      <path d="M 89.5 27.69 A 9.15 9.15 0 0 0 89.5 42.31" fill="none" stroke={stroke} strokeWidth="0.4" />
      {/* arcos de canto */}
      <path d="M 2 1 A 1 1 0 0 1 1 2" fill="none" stroke={stroke} strokeWidth="0.3" />
      <path d="M 105 1 A 1 1 0 0 0 106 2" fill="none" stroke={stroke} strokeWidth="0.3" />
      <path d="M 1 68 A 1 1 0 0 1 2 69" fill="none" stroke={stroke} strokeWidth="0.3" />
      <path d="M 106 68 A 1 1 0 0 0 105 69" fill="none" stroke={stroke} strokeWidth="0.3" />
      {/* bandeirolas de canto */}
      <CornerFlag cx={1} cy={1} ox={-D} oy={-D} color={flagColor} />
      <CornerFlag cx={106} cy={1} ox={D} oy={-D} color={flagColor} />
      <CornerFlag cx={1} cy={69} ox={-D} oy={D} color={flagColor} />
      <CornerFlag cx={106} cy={69} ox={D} oy={D} color={flagColor} />
      {/* Nos cartões não há bancos de suplentes (só o campo). */}
      {!cartao && !semBancos && <BenchesAndTechnicalArea printMode={printMode} />}
      {/* BALIZA vista de cima (cartões, editor 2D, apresentação e
          impressão): por FORA da linha de baliza, só a armação (fundo e
          laterais, traço fino) e a rede em malha fina e suave — sem postes
          desenhados nem traço por cima da linha de baliza. */}
      {[{ x: -1.5, lado: -1 }, { x: 106, lado: 1 }].map(({ x, lado }) => {
        const w = 2.5; const y0 = 31.34; const h = 7.32;
        const xLinha = lado < 0 ? 1 : 106;
        const xFundo = lado < 0 ? x : x + w;
        const corRede = printMode ? '#2A2A2A' : '#ffffff';
        const malha = [];
        for (let i = 1; i < 6; i++) { const gx = x + (w * i) / 6; malha.push(<line key={`v${i}`} x1={gx} y1={y0} x2={gx} y2={y0 + h} stroke={corRede} strokeWidth="0.045" opacity={printMode ? 0.35 : 0.32} />); }
        for (let j = 1; j < 18; j++) { const gy = y0 + (h * j) / 18; malha.push(<line key={`h${j}`} x1={x} y1={gy} x2={x + w} y2={gy} stroke={corRede} strokeWidth="0.045" opacity={printMode ? 0.35 : 0.32} />); }
        return (
          <g key={lado} style={{ pointerEvents: 'none' }}>
            <rect x={x} y={y0} width={w} height={h} fill={corRede} fillOpacity={printMode ? 0.04 : 0.1} />
            {malha}
            <path d={`M ${xLinha} ${y0} L ${xFundo} ${y0} L ${xFundo} ${y0 + h} L ${xLinha} ${y0 + h}`} fill="none" stroke={strokeGoal} strokeWidth="0.28" strokeLinejoin="round" />
          </g>
        );
      })}
    </>
  );
}

/* Desenha a área de trabalho do exercício (ex: 20x20) à escala de
   um campo real (1 unidade da prancheta ≈ 1 metro). Arrasta-se pelo
   centro e redimensiona-se pela pega no canto inferior direito. */
export function SpaceZone({ meters, center, label, onPointerDown, onResizeDown, onDelete, interactive, printMode }) {
  if (!meters || !meters.w || !meters.h) return null;
  const w = Math.min(meters.w, 105);
  const h = Math.min(meters.h, 68);
  const cx = center?.x ?? 53.5;
  const cy = center?.y ?? 35;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Em impressão (fundo branco), o dourado claro usado no ecrã fica com
  // contraste demasiado baixo — sobretudo o traço interrompido, que passa
  // despercebido no papel. Usa-se antes um tom forte e sólido.
  const zoneStroke = printMode ? '#B5393F' : '#E7CD7A';
  const zoneFill = printMode ? '#B5393F14' : '#C9A22722';
  const zoneStrokeWidth = printMode ? '0.55' : '0.4';
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={zoneFill} stroke={zoneStroke} strokeWidth={zoneStrokeWidth} strokeDasharray="1.4,1"
        onPointerDown={interactive ? onPointerDown : undefined}
        style={{ cursor: interactive ? 'grab' : 'default', touchAction: interactive ? 'none' : undefined, pointerEvents: interactive ? 'auto' : 'none' }} />
      <text x={cx} y={y - 1.3} textAnchor="middle" fontSize="2.4" fill={zoneStroke} style={{ fontFamily: "'Oswald', sans-serif", pointerEvents: 'none' }}>
        {label || `${Math.round(w)}×${Math.round(h)} m`}
      </text>
      {interactive && (
        <>
          <rect x={x + w - 2.1} y={y + h - 2.1} width="4.2" height="4.2" rx="0.6" fill="#C9A227" stroke={TEXT_ON_ACCENT} strokeWidth="0.3"
            onPointerDown={onResizeDown} style={{ cursor: 'nwse-resize', touchAction: 'none' }} />
          {onDelete && (
            <g onPointerDown={(e) => { e.stopPropagation(); onDelete(); }} style={{ cursor: 'pointer', touchAction: 'none' }}>
              <circle cx={x + 1.6} cy={y + 1.6} r="1.6" fill="#A83E3E" stroke={TEXT_ON_ACCENT} strokeWidth="0.25" />
              <line x1={x + 0.9} y1={y + 0.9} x2={x + 2.3} y2={y + 2.3} stroke="#F0E7D6" strokeWidth="0.35" strokeLinecap="round" />
              <line x1={x + 2.3} y1={y + 0.9} x2={x + 0.9} y2={y + 2.3} stroke="#F0E7D6" strokeWidth="0.35" strokeLinecap="round" />
            </g>
          )}
        </>
      )}
    </g>
  );
}

/* Escala dos ícones de pessoas e bola conforme a fase de jogo.

   Num exercício de Bola Parada trabalha-se dentro da grande área — 16,5 m
   de profundidade num campo de 105 m. Com os ícones ao tamanho normal,
   dez jogadores dentro da área ficavam sobrepostos e ilegíveis (ver o
   canto defensivo, onde os círculos se encavalitam todos). A 60% cabem
   com folga e continuam a ler-se.

   Só encolhem pessoas e bola. Cones, estacas e balizas são material com
   dimensão real e ficam como estão, para servirem de referência. */
/* Escala base 0.8: ao alargar a moldura do campo (ver PITCH_VIEWBOX), o
   relvado passou a ocupar menos ecrã e os ícones, que não mudaram,
   ficaram grandes de mais em relação às linhas. 0.8 devolve a proporção
   que tinham antes. A Bola Parada mantém a redução própria, aplicada por
   cima desta. */
export const ICON_SCALE_BASE = 0.8;

// Bola Parada e o MEIO-CAMPO (o campo aparece aproximado) levam os ícones
// mais pequenos, na mesma medida. `diagram` é opcional (vê a vista).
export function iconScaleForPhase(phase, diagram) {
  const meio = !!(diagram && diagram.vista === 'meio');
  return phase === 'Bola Parada' || meio ? ICON_SCALE_BASE * 0.75 : ICON_SCALE_BASE;
}

export function DiagramElements({ elements, arrows, onElementDown, onArrowDown, onHandleDown, selectedArrowId, interactive, placingActive, printMode, iconScale = 1 }) {
  const k = iconScale || 1;
  const rodarTexto = useRodarTexto();
  const contraEsticar = useContraEsticar();
  // Enquanto a ferramenta ativa é para colocar um novo item (jogador,
  // guarda-redes, bola, cone, baliza, estaca, técnico) ou desenhar uma
  // seta/linha, as áreas de toque dos elementos e das setas já colocadas
  // ficam desligadas — assim dá para colocar (ou começar/terminar uma
  // seta) mesmo em cima ou coladinho a outro item já existente, em vez de
  // o toque ser "roubado" por esse item e começar a arrastá-lo.
  const hitsEnabled = interactive && !placingActive;
  // No ecrã (fundo verde) as setas/linhas usam branco/creme; na impressão
  // (fundo branco) isso fica invisível, por isso passam a um tom escuro.
  const arrowColor = printMode ? '#2A2A2A' : '#F0E7D6';
  const dashedColor = printMode ? '#2A2A2A' : '#FFFFFF';
  // A ORDEM DE DESENHO decide quem fica por cima de quem, quando dois
  // itens se sobrepõem. Por omissão é a ordem de `elements` (quem foi
  // colocado — ou tocado — por último em `onElementDown` já vai parar
  // ao fim dessa lista, ver DiagramEditor). A bola é a ÚNICA exceção:
  // fica sempre por cima de tudo, mesmo que se toque nela ou nalgum
  // jogador depois — um "sort" estável só a empurra para o fim, sem
  // baralhar a ordem relativa dos restantes.
  const elementosParaDesenhar = [...elements].sort((a, b) => (a.kind === 'ball' ? 1 : 0) - (b.kind === 'ball' ? 1 : 0));
  return (
    <>
      <defs>
        <marker id="dg-arrow" markerWidth="4.5" markerHeight="4.5" refX="4" refY="2.25" orient="auto">
          <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill={arrowColor} />
        </marker>
      </defs>
      {arrows.map(a => {
        const isArrow = a.type === 'arrow-pass' || a.type === 'arrow-run';
        /* "Linha tracejada" (ferramenta livre, sem seta) passa a ser
           pontinhos, não traços — mais discreta e mais fácil de distinguir
           de uma seta de corrida (essa mantém o tracejado clássico, por
           ser uma indicação de movimento, não uma linha de referência). */
        const isDotted = a.type === 'line-dashed';
        const isRunDashed = a.type === 'arrow-run';
        const dashed = isDotted || isRunDashed;
        const isSelected = interactive && selectedArrowId === a.id;
        /* A PEGA DO MEIO curva o passe/a corrida — arrasta-se para o lado
           para simular uma trajetória em curva, ou mais "para cima" (mais
           afastada da linha reta) para um passe mais lançado/à parábola.
           Sem `cx`/`cy` gravados (nunca mexida, ou seta antiga de antes
           disto existir), o ponto médio de uma curva quadrática cai
           exatamente em cima do ponto médio da reta — por isso o mesmo
           <path> serve sempre, reto ou curvo, sem precisar de dois modos
           de desenho diferentes. Só o Passe e a Corrida ganham esta pega:
           uma linha simples de referência não representa movimento
           nenhum para "curvar". */
        const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
        const curvaX = a.cx != null ? a.cx : mx;
        const curvaY = a.cy != null ? a.cy : my;
        const d = `M ${a.x1} ${a.y1} Q ${curvaX} ${curvaY} ${a.x2} ${a.y2}`;
        return (
          <g key={a.id}>
            {hitsEnabled && (
              <path
                d={d}
                fill="none"
                stroke="transparent" strokeWidth="2.2" strokeLinecap="round"
                onPointerDown={(e) => onArrowDown(e, a.id)}
                style={{ cursor: 'grab', touchAction: 'none' }}
              />
            )}
            <path
              d={d}
              fill="none"
              stroke={dashed ? dashedColor : arrowColor}
              strokeWidth={isDotted ? (isSelected ? '0.55' : '0.42') : (isSelected ? '0.55' : '0.35')}
              strokeDasharray={isDotted ? '0.1,2.1' : (isRunDashed ? '2.4,1.8' : undefined)}
              strokeLinecap={isDotted ? 'round' : (isRunDashed ? 'butt' : 'round')}
              markerEnd={isArrow ? 'url(#dg-arrow)' : undefined}
              style={{ pointerEvents: 'none' }}
            />
            {isSelected && (
              <>
                <circle cx={a.x1} cy={a.y1} r="1.3" fill="#C9A227" stroke={TEXT_ON_ACCENT} strokeWidth="0.3"
                  onPointerDown={(e) => onHandleDown(e, a.id, 'start')} style={{ cursor: 'grab', touchAction: 'none' }} />
                <circle cx={a.x2} cy={a.y2} r="1.3" fill="#C9A227" stroke={TEXT_ON_ACCENT} strokeWidth="0.3"
                  onPointerDown={(e) => onHandleDown(e, a.id, 'end')} style={{ cursor: 'grab', touchAction: 'none' }} />
                {isArrow && (
                  <circle cx={curvaX} cy={curvaY} r="1.1" fill={TEXT_ON_ACCENT} stroke="#C9A227" strokeWidth="0.35"
                    onPointerDown={(e) => onHandleDown(e, a.id, 'curve')} style={{ cursor: 'grab', touchAction: 'none' }} />
                )}
              </>
            )}
          </g>
        );
      })}
      {elementosParaDesenhar.map(el => {
        const handler = hitsEnabled ? (e) => onElementDown(e, el.id) : undefined;
        const cursorStyle = { cursor: hitsEnabled ? 'grab' : 'default', touchAction: 'none' };
        const hitStyle = { ...cursorStyle, fill: 'transparent' };

        if (el.kind === 'cone') {
          return (
            <g key={el.id} data-anim-id={el.id} transform={contraEsticar(el.x, el.y)}>
              {hitsEnabled && <circle cx={el.x} cy={el.y} r="1.4" onPointerDown={handler} style={hitStyle} />}
              <polygon points={`${el.x},${el.y - 1.2} ${el.x - 1.1},${el.y + 1.0} ${el.x + 1.1},${el.y + 1.0}`} fill="#C4832F" style={{ pointerEvents: 'none' }} />
            </g>
          );
        }
        if (el.kind === 'goalmarker') {
          const rot = el.rotation || 0;
          // 'w'/'h' são o novo formato (redimensionável em 2 eixos); 'scale'
          // fica só para compatibilidade com balizas guardadas antes desta versão.
          const w = el.w != null ? el.w : 3.6 * (el.scale || 1);
          const h = el.h != null ? el.h : 2.2 * (el.scale || 1);
          const tr = `translate(${el.x} ${el.y}) rotate(${rot})`;
          const post = Math.max(0.12, Math.min(0.3, w * 0.04));
          const cols = Math.max(3, Math.round(w / 0.7));
          const rows = Math.max(2, Math.round(h / 0.7));
          /* Esta baliza usava sempre um creme claro (#F0E7D6), pensado
             para o relvado escuro do ecrã — impresso em papel branco
             ficava praticamente invisível (postes e rede quase da cor do
             fundo). Em impressão passa a um cinza-escuro sólido, como as
             restantes marcações do campo. */
          const corBaliza = printMode ? '#2A2A2A' : '#F0E7D6';
          const opRede = printMode ? '0.75' : '0.45';
          const netLines = [];
          for (let i = 1; i < cols; i++) {
            const gx = -w / 2 + (w * i) / cols;
            netLines.push(<line key={`v${i}`} x1={gx} y1={-h / 2} x2={gx} y2={h / 2} stroke={corBaliza} strokeWidth="0.05" opacity={opRede} />);
          }
          for (let j = 1; j < rows; j++) {
            const gy = -h / 2 + (h * j) / rows;
            netLines.push(<line key={`h${j}`} x1={-w / 2} y1={gy} x2={w / 2} y2={gy} stroke={corBaliza} strokeWidth="0.05" opacity={opRede} />);
          }
          return (
            <g key={el.id} data-anim-id={el.id} transform={contraEsticar(el.x, el.y)}>
              {hitsEnabled && (
                <rect x={-w / 2 - 0.4} y={-h / 2 - 0.4} width={w + 0.8} height={h + 0.8} transform={tr}
                  onPointerDown={handler} style={hitStyle} />
              )}
              <g transform={tr} style={{ pointerEvents: 'none' }}>
                {netLines}
                {/* poste esquerdo, poste direito e barra (fundo da rede) — a "boca" (frente, por onde entra a bola) fica aberta */}
                <line x1={-w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} stroke={corBaliza} strokeWidth={post} strokeLinecap="round" />
                <line x1={w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} stroke={corBaliza} strokeWidth={post} strokeLinecap="round" />
                <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={-h / 2} stroke={corBaliza} strokeWidth={post} strokeLinecap="round" />
                <line x1={-w / 2} y1={h / 2} x2={w / 2} y2={h / 2} stroke={corBaliza} strokeWidth={printMode ? '0.2' : '0.12'} strokeDasharray="0.35,0.35" opacity={printMode ? '0.9' : '0.6'} />
              </g>
            </g>
          );
        }
        if (el.kind === 'stake') {
          return (
            <g key={el.id} data-anim-id={el.id} transform={contraEsticar(el.x, el.y)}>
              {/* A área de toque cobre a estaca TODA (base e vara). Antes era só
                  um círculo na base: tocar na vara, que é o que se vê, não a
                  apanhava e a estaca parecia impossível de mexer. */}
              {hitsEnabled && <rect x={el.x - 1} y={el.y - 4.2} width="2" height="4.9" rx="0.6" onPointerDown={handler} style={hitStyle} />}
              {/* ESTACA, NÃO FÓSFORO.

                  Era um pau amarelo com uma cabeça vermelha em cima, o que
                  lida de longe é exatamente um fósforo. Uma estaca de
                  treino tem base preta em disco, vara amarela fina e um
                  anel preto a meio — e é por esses três traços que se
                  reconhece à primeira, mesmo pequena.

                  Desenhada de baixo para cima a partir de `el.y`, que é
                  onde ela assenta no chão. */}
              <g style={{ pointerEvents: 'none' }}>
                {/* Base: elipse achatada, porque o campo vê-se de cima em
                    perspetiva e um círculo perfeito flutuava. */}
                <ellipse cx={el.x} cy={el.y} rx="0.85" ry="0.32" fill="#23282A" />
                <ellipse cx={el.x} cy={el.y - 0.12} rx="0.6" ry="0.22" fill="#3A4145" />
                {/* Vara */}
                <rect x={el.x - 0.17} y={el.y - 3.8} width="0.34" height="3.7" rx="0.17" fill="#E8C33A" />
                {/* Brilho de um dos lados, para não parecer chapada */}
                <rect x={el.x - 0.17} y={el.y - 3.8} width="0.13" height="3.7" rx="0.07" fill="#F2DC7E" opacity="0.85" />
                {/* Anel preto a meio e ponta escura */}
                <rect x={el.x - 0.19} y={el.y - 2.1} width="0.38" height="0.3" fill="#23282A" />
                <rect x={el.x - 0.19} y={el.y - 3.85} width="0.38" height="0.22" rx="0.1" fill="#23282A" />
              </g>
            </g>
          );
        }
        if (el.kind === 'text') {
          /* Texto livre, em várias linhas.

             O SVG não sabe quebrar texto sozinho: cada linha tem de ser um
             `<tspan>` colocado à mão. As linhas vêm de duas fontes — os
             \n que o treinador escreveu (tecla Enter) e a quebra
             automática quando uma linha passa do limite. Sem o limite, uma
             frase comprida esticava a caixa até fora do campo.

             A caixa acompanha a linha mais comprida, e não o total de
             caracteres, para não ficar com margens enormes de um lado. */
          /* Medidas e posição vêm de textBoxMetrics — a MESMA fonte que a
             animação e a deteção de setas usam. Tê-las calculadas em três
             sítios diferentes foi o que fez o texto deixar de ser
             animável: o desenho e a deteção deixavam de coincidir. */
          const { size, linhas, alturaLinha, folgaY, w: boxW, h: boxH, cx: tx, topo } = textBoxMetrics(el);
          const fill = printMode ? '#1B1B1B' : '#F0E7D6';
          return (
            <g key={el.id} data-anim-id={el.id} transform={contraEsticar(el.x, el.y)}>
              {hitsEnabled && (
                <rect x={tx - boxW / 2} y={topo} width={boxW} height={boxH}
                  transform={rodarTexto(tx, topo + boxH / 2)}
                  onPointerDown={handler} style={hitStyle} />
              )}
              <g style={{ pointerEvents: 'none' }} transform={rodarTexto(tx, topo + boxH / 2)}>
                <rect x={tx - boxW / 2} y={topo} width={boxW} height={boxH} rx={size * 0.32}
                  fill={printMode ? '#FFFFFF' : '#12241AE6'} stroke={printMode ? '#999' : '#F0E7D577'} strokeWidth="0.2" />
                <text x={tx} textAnchor="middle" fontSize={size} fontWeight="600" fill={fill}
                  style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {linhas.map((linha, li) => (
                    <tspan key={li} x={tx} y={topo + folgaY + alturaLinha * (li + 0.66)}>{linha}</tspan>
                  ))}
                </text>
              </g>
            </g>
          );
        }
        if (el.kind === 'coach') {
          // Marcador do treinador: mais pequeno que um jogador e com o "T"
          // a preto — a dourado sobre fundo claro quase não se lia.
          return (
            <g key={el.id} data-anim-id={el.id} transform={contraEsticar(el.x, el.y)}>
              {hitsEnabled && <circle cx={el.x} cy={el.y} r={Math.max(1.9 * k, 1.6)} onPointerDown={handler} style={hitStyle} />}
              <g style={{ pointerEvents: 'none' }}>
                <circle cx={el.x} cy={el.y} r={1.5 * k} fill="#F0E7D6" stroke="#C9A227" strokeWidth={0.3 * k} />
                <text x={el.x} y={el.y + 0.62 * k} transform={rodarTexto(el.x, el.y)} textAnchor="middle" fontSize={1.85 * k} fontWeight="700" fill="#111111" style={{ fontFamily: "'Oswald', sans-serif" }}>T</text>
              </g>
            </g>
          );
        }
        if (el.kind === 'ball') {
          return (
            <g key={el.id} data-anim-id={el.id} transform={contraEsticar(el.x, el.y)}>
              {hitsEnabled && <circle cx={el.x} cy={el.y} r={Math.max(1.8 * k, 1.6)} onPointerDown={handler} style={hitStyle} />}
              <g style={{ pointerEvents: 'none' }}>
                <TriondaBall cx={el.x} cy={el.y} r={1.6 * k} />
              </g>
            </g>
          );
        }
        if (el.kind === 'player' || el.kind === 'keeper') {
          const tm = teamInfo(el.team);
          const isKeeper = el.kind === 'keeper';
          return (
            <g key={el.id} data-anim-id={el.id} transform={contraEsticar(el.x, el.y)}>
              {/* A área de toque nunca encolhe abaixo do dedo: mesmo com os
                  ícones pequenos, continua a dar para agarrar e arrastar. */}
              {hitsEnabled && <circle cx={el.x} cy={el.y} r={Math.max(2.2 * k, 1.8)} onPointerDown={handler} style={hitStyle} />}
              <g style={{ pointerEvents: 'none' }}>
                {/* Raio 1.7 e não 2: com a moldura nova o campo desenha-se
                    maior no ecrã, e os círculos ao tamanho antigo passaram
                    a tapar-se uns aos outros nas zonas com muita gente. */}
                {isKeeper ? (
                  <rect x={el.x - 1.9 * k} y={el.y - 1.9 * k} width={3.8 * k} height={3.8 * k} rx={0.78 * k} fill={tm.fill} stroke={printMode ? '#1A1A1A' : '#F0E7D6'} strokeWidth={0.38 * k} />
                ) : (
                  <circle cx={el.x} cy={el.y} r={1.9 * k} fill={tm.fill} stroke={printMode ? '#1A1A1A' : TEXT_ON_ACCENT} strokeWidth={0.27 * k} />
                )}
                <text x={el.x} y={el.y + 0.71 * k} transform={rodarTexto(el.x, el.y)} textAnchor="middle" fontSize={(rotuloIcone(el).length > 2 ? 1.42 : 2) * k} fontWeight="700" fill={tm.text} style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {rotuloIcone(el)}
                </text>
                {/* Nome por baixo (jogadores carregados de um treino). */}
                {el.nome && (
                  <text x={el.x} y={el.y + 3.75 * k} transform={rodarTexto(el.x, el.y)} textAnchor="middle" fontSize={1.45 * k} fontWeight="600"
                    fill={printMode ? '#1A1A1A' : '#F0E7D6'} stroke={printMode ? '#FFFFFF' : '#12241A'} strokeWidth={0.35 * k} paintOrder="stroke"
                    style={{ fontFamily: "'Inter', sans-serif" }}>
                    {el.nome}
                  </text>
                )}
              </g>
            </g>
          );
        }
        return null;
      })}
    </>
  );
}

/* ---------------------------------------------------------------
   FICHEIRO PARTILHÁVEL (exercício / sessão) — gera um ficheiro .html
   autónomo (sem depender da app nem de ligação à internet) com toda a
   informação do "imprimir" mais, quando existe, a apresentação animada
   do esquema tático. Como um PDF normal não consegue reproduzir
   movimento, em vez disso pré-calculamos aqui — com os MESMOS
   componentes de desenho da app (PitchMarkings/SpaceZone/DiagramElements),
   via ReactDOMServer — uma sequência de "fotogramas" SVG estáticos que o
   ficheiro final troca sozinho, reconstruindo a animação sem precisar de
   vídeo nem de React. Quem recebe o ficheiro só tem de o abrir num
   browser (telemóvel ou computador) e, se houver esquema tático, carregar
   em "Apresentar".
---------------------------------------------------------------- */
/* Agrupa setas encadeadas (o fim de uma coincide com o início da seguinte,
   do mesmo tipo) em "cadeias", para a animação as tocar em sequência.

   REGRA DO DONO: uma seta que tem dono próprio (o jogador/guarda-redes ou a
   bola que estava no seu ponto de partida, gravado em ownerId no momento do
   desenho) NUNCA é encadeada na cadeia de outro dono. Sem esta regra, se o
   DD começava a sua corrida onde a corrida do EX terminava, as duas setas
   eram vistas como uma só cadeia: o EX percorria as duas e o DD ficava
   parado — ou seja, um jogador "assumia" a seta do outro. Setas sem dono
   (as continuações normais de um mesmo movimento, onde não há ninguém no
   ponto de partida, e as setas antigas criadas antes desta gravação existir)
   continuam a encadear como antes. */
export function chainOwnerCompatible(chainOwnerId, nextOwnerId) {
  if (!nextOwnerId) return true;               // sem dono próprio → continua a cadeia
  return chainOwnerId === nextOwnerId;         // com dono → só na cadeia do mesmo dono
}

export function buildAnimationChainsPure(arrowList) {
  const CHAIN_DIST = 3.2;
  const closeEnough = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by) <= CHAIN_DIST;
  const closest = (list, x, y) => {
    let best = null, bestD = CHAIN_DIST;
    for (const a of list) {
      const d = Math.hypot(a.x1 - x, a.y1 - y);
      if (d <= bestD) { bestD = d; best = a; }
    }
    return best;
  };
  // Uma seta só é "continuação" de outra se, além de encostar geometricamente,
  // não tiver um dono diferente — caso contrário é cabeça da sua própria cadeia.
  const isContinuationOfSome = (arrow) => arrowList.some(other => (
    other.id !== arrow.id && other.type === arrow.type
    && closeEnough(other.x2, other.y2, arrow.x1, arrow.y1)
    && chainOwnerCompatible(other.ownerId || null, arrow.ownerId || null)
  ));
  const used = new Set();
  const chains = [];
  const heads = arrowList.filter(a => !isContinuationOfSome(a));
  for (const head of heads) {
    if (used.has(head.id)) continue;
    const chain = [head];
    used.add(head.id);
    let current = head;
    // Dono efetivo da cadeia: o primeiro dono encontrado (normalmente o da
    // cabeça). É contra este que se validam todas as setas seguintes.
    let chainOwnerId = head.ownerId || null;
    while (true) {
      const candidates = arrowList.filter(a => (
        !used.has(a.id) && a.type === current.type
        && chainOwnerCompatible(chainOwnerId, a.ownerId || null)
      ));
      const next = closest(candidates, current.x2, current.y2);
      if (!next) break;
      chain.push(next);
      used.add(next.id);
      current = next;
    }
    chains.push(chain);
  }
  arrowList.forEach(a => { if (!used.has(a.id)) chains.push([a]); });
  return chains;
}

export function easeInOutQuadPure(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/* =====================================================================
   MOTOR DE ANIMAÇÃO DO EDITOR 2D (fases 1 e 2 da fluidez, 30/10)
   =====================================================================
   Uma só implementação, usada por TODOS os sítios que reproduzem a
   coreografia: o "Animar" do editor, o "Apresentar tudo", a apresentação
   do exercício (também no Portal e nas ideias de jogo), as miniaturas com
   ▶ e o ficheiro partilhado.

   FASE 1 (fluidez):
   · Cada jogador (ou a bola) faz o seu trajeto TODO como um só movimento:
     arranca suave, mantém a velocidade e só trava no fim. Antes, cada
     seta acelerava e travava sozinha e o jogador parava em cada junção.
   · Velocidade constante também nas setas curvas (pelo comprimento real
     da curva, não pelo parâmetro da curva).
   · A bola conta ao DOBRO da velocidade dos jogadores e sai logo.
   · Dentro de um passo, TUDO (bola, jogadores e o que desliza) começa e
     acaba ao mesmo tempo: quem tem pouco caminho anda mais devagar em vez
     de chegar e ficar parado à espera.
   · Sem pausa entre passos: um passo acaba e o seguinte começa logo.

   FASE 2 (arrastar também é movimento):
   · O que foi ARRASTADO entre dois "Animar" já não salta de sítio: desliza
     no passo seguinte, ao mesmo tempo que as setas. Quem foi arrastado e
     também tem seta nesse passo faz primeiro o caminho até ao início da
     seta e depois a seta, num só movimento.
   · Fica gravado no passo quem foi arrastado (`step.de`). Só esses
     deslizam: nos passos antigos (gravados antes disto) e nas correções
     feitas em "desde animar", a mudança de sítio continua imediata. Era
     o que fazia os exercícios antigos parecerem estranhos (31/10): a
     equipa reposta noutra situação passava a "correr" para lá.
   · O que for arrastado depois do último Animar não se mexe na
     apresentação enquanto não se carregar outra vez em Animar. */
export const ANIM_VEL_JOGADOR = 16;            // unidades do campo por segundo (antes 26, depois 22: ainda rápido demais)

export const ANIM_VEL_BOLA = ANIM_VEL_JOGADOR * 2;

export const ANIM_MIN_MS = 280;                // nenhum movimento demora menos do que isto

export const ANIM_VEL_REPOSICAO = 12;          // reposicionar a equipa no fim: com calma

export const ANIM_DESLIZE_MIN = 0.3;           // menos do que isto não conta como arrastado

/* Material de treino (cones, estacas, balizas): é estático. Arrastá-lo só
   o muda de sítio; nunca desliza nem ganha caminho tracejado. */
export const ANIM_MATERIAL_ESTATICO = new Set(['cone', 'stake', 'goalmarker']);

// Comprimento e tabela de distâncias de uma seta (curva quadrática).
export function animSegmento(a, vel) {
  const x1 = a.x1, y1 = a.y1, x2 = a.x2, y2 = a.y2;
  const cx = a.cx != null ? a.cx : (x1 + x2) / 2;
  const cy = a.cy != null ? a.cy : (y1 + y2) / 2;
  const N = 24;
  const ts = [0], ls = [0];
  let px = x1, py = y1, total = 0;
  for (let i = 1; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const x = u * u * x1 + 2 * u * t * cx + t * t * x2;
    const y = u * u * y1 + 2 * u * t * cy + t * t * y2;
    total += Math.hypot(x - px, y - py);
    ts.push(t); ls.push(total);
    px = x; py = y;
  }
  return { x1, y1, cx, cy, x2, y2, len: total, ts, ls, vel };
}

// Ponto da seta a uma dada distância do início (velocidade constante).
export function animPontoAoLongo(seg, d) {
  if (seg.len <= 0) return { x: seg.x2, y: seg.y2 };
  const alvo = Math.max(0, Math.min(seg.len, d));
  let i = 1;
  while (i < seg.ls.length - 1 && seg.ls[i] < alvo) i++;
  const l0 = seg.ls[i - 1], l1 = seg.ls[i];
  const f = l1 > l0 ? (alvo - l0) / (l1 - l0) : 0;
  const t = seg.ts[i - 1] + (seg.ts[i] - seg.ts[i - 1]) * f, u = 1 - t;
  return {
    x: u * u * seg.x1 + 2 * u * t * seg.cx + t * t * seg.x2,
    y: u * u * seg.y1 + 2 * u * t * seg.cy + t * t * seg.y2,
  };
}

/* Perfil de velocidade: rampa de arranque, velocidade constante, rampa de
   travagem (as rampas valem `rampaMs`, no máximo 30 % do movimento cada).
   Recebe a fração de tempo (0–1) e devolve a fração do caminho (0–1). */
export function animPerfil(x, durMs, rampaMs, semArranque, semTravagem) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const a = Math.min(0.3, durMs > 0 ? rampaMs / durMs : 0.3);
  // Quem já vinha a correr do passo anterior não arranca do zero, e quem
  // continua a correr no passo seguinte não trava até parar.
  const a1 = semArranque ? 0 : a, a2 = semTravagem ? 0 : a;
  if (a1 <= 0 && a2 <= 0) return x;
  const v = 1 / (1 - a1 / 2 - a2 / 2);
  if (a1 > 0 && x < a1) return 0.5 * v * x * x / a1;
  if (a2 > 0 && x > 1 - a2) return 1 - 0.5 * v * (1 - x) * (1 - x) / a2;
  return v * (x - a1 / 2);
}

// Um trajeto = várias setas seguidas, percorridas como um só movimento.
export function animTrajeto(segs, ehBola) {
  let tempo = 0;
  const partes = segs.map(sg => {
    const ms = (sg.len / sg.vel) * 1000;
    const p = { sg, inicio: tempo, ms };
    tempo += ms;
    return p;
  });
  return { partes, natural: Math.max(ANIM_MIN_MS, tempo), tempoCaminho: tempo, ehBola, dur: 0 };
}

export function animPosicaoNoTrajeto(tr, ms) {
  const x = tr.dur > 0 ? ms / tr.dur : 1;
  // A bola com o MESMO arranque e travagem dos jogadores: numa condução,
  // bola e jogador andam juntos (antes a bola arrancava mais depressa e
  // parecia soltar-se do pé).
  const f = animPerfil(x, tr.dur, 380, tr.semArranque, tr.semTravagem);
  const alvo = f * tr.tempoCaminho;
  let p = tr.partes[tr.partes.length - 1];
  for (const q of tr.partes) { if (alvo <= q.inicio + q.ms) { p = q; break; } }
  const local = p.ms > 0 ? Math.max(0, Math.min(1, (alvo - p.inicio) / p.ms)) : 1;
  return animPontoAoLongo(p.sg, local * p.sg.len);
}

// Quem se mexe numa cadeia de setas (o dono gravado; senão, o mais perto).
export function animMoverPadrao(first, elementos) {
  if (first.ownerId) {
    const dono = elementos.find(el => el.id === first.ownerId);
    if (dono) return dono;
  }
  const tipos = first.type === 'arrow-run' ? ['player', 'keeper', 'text'] : ['ball'];
  let best = null, bestD = Infinity;
  for (const el of elementos) {
    if (!tipos.includes(el.kind)) continue;
    let d;
    if (el.kind === 'text') {
      const m = textBoxMetrics(el);
      d = Math.hypot(Math.max(0, Math.abs(m.cx - first.x1) - m.w / 2), Math.max(0, Math.abs(m.cy - first.y1) - m.h / 2));
    } else d = Math.hypot(el.x - first.x1, el.y - first.y1);
    if (d < bestD) { bestD = d; best = el; }
  }
  return best && bestD <= 3.2 ? best : null;
}

/* Plano de UM passo.
   `elementos`: o campo no início das setas deste passo (a fotografia
   gravada). `antes`: onde cada coisa estava no fim do passo anterior
   (Map id → {x,y}); quem estiver noutro sítio desliza até aqui.
   Devolve { base, dur, posicoes(ms) → Map, fim, movers }. */
export function planearPassoAnim(elementos, setas, antes, opcoes = {}) {
  const acharMover = opcoes.acharMover || animMoverPadrao;
  const animaveis = (setas || []).filter(a => a.type === 'arrow-pass' || a.type === 'arrow-run');
  const cadeias = animaveis.length ? buildAnimationChainsPure(animaveis) : [];
  const novasBolas = [];
  const porMover = new Map(); // id → { segs, ehBola }
  cadeias.forEach(cad => {
    const first = cad[0];
    let mover = acharMover(first, elementos);
    if (!mover && first.type === 'arrow-pass') {
      mover = { id: uid(), kind: 'ball', x: first.x1, y: first.y1 };
      novasBolas.push(mover);
    }
    if (!mover || porMover.has(mover.id)) return;
    const ehBola = first.type === 'arrow-pass';
    const vel = ehBola ? ANIM_VEL_BOLA : ANIM_VEL_JOGADOR;
    porMover.set(mover.id, { segs: cad.map(a => animSegmento(a, vel)), ehBola, fimSeta: cad[cad.length - 1] });
  });
  const todos = [...elementos, ...novasBolas];
  const trajetos = new Map();
  const base = todos.map(el => {
    const ant = antes && antes.get(el.id);
    /* Só desliza quem foi mesmo ARRASTADO para este passo (gravado em
       `step.de` quando se carregou em Animar). Nos exercícios antigos e nas
       correções feitas em "desde animar", a mudança de sítio continua a
       ser imediata, como sempre foi: muitas vezes era a equipa a ser
       reposta para outra situação, e não um movimento. */
    const podeDeslizar = !ANIM_MATERIAL_ESTATICO.has(el.kind) && (!opcoes.soDeslizar || opcoes.soDeslizar.has(el.id));
    const desloca = podeDeslizar && ant && Math.hypot(ant.x - el.x, ant.y - el.y) > ANIM_DESLIZE_MIN;
    // O caminho de quem foi arrastado: reto, ou curvo se se puxou o ponto do meio.
    const curva = desloca && opcoes.curvas && opcoes.curvas[el.id];
    const deslize = desloca ? { x1: ant.x, y1: ant.y, x2: el.x, y2: el.y, ...(curva ? { cx: curva.cx, cy: curva.cy } : {}) } : null;
    const velDeslize = (ehBola) => opcoes.velDeslize || (ehBola ? ANIM_VEL_BOLA : ANIM_VEL_JOGADOR);
    const m = porMover.get(el.id);
    if (m) {
      // Arrastado e com seta: primeiro até ao início da seta, depois a seta.
      const segs = desloca ? [animSegmento(deslize, velDeslize(m.ehBola)), ...m.segs] : m.segs;
      trajetos.set(el.id, animTrajeto(segs, m.ehBola));
    } else if (desloca) {
      const ehBola = el.kind === 'ball';
      trajetos.set(el.id, animTrajeto([animSegmento(deslize, velDeslize(ehBola))], ehBola));
    }
    return desloca ? { ...el, x: ant.x, y: ant.y } : el;
  });
  /* DESTINOS (exercícios antigos): onde cada peça tem de estar no FIM
     deste passo (a fotografia do passo seguinte). Quem lá não chega pelas
     setas vai lá ter DURANTE este passo — o recetor chega com a bola, o
     bloco bascula enquanto a bola viaja. */
  const fimMap = new Map();
  if (opcoes.destinos) {
    todos.forEach((el, i) => {
      if (ANIM_MATERIAL_ESTATICO.has(el.kind)) return;
      const dest = opcoes.destinos.get(el.id);
      if (!dest) return;
      const m = porMover.get(el.id);
      const fimNatural = m ? { x: m.fimSeta.x2, y: m.fimSeta.y2 } : { x: el.x, y: el.y };
      if (Math.hypot(dest.x - fimNatural.x, dest.y - fimNatural.y) <= ANIM_DESLIZE_MIN) return;
      const ehBola = el.kind === 'ball';
      const extra = animSegmento({ x1: fimNatural.x, y1: fimNatural.y, x2: dest.x, y2: dest.y }, ehBola ? ANIM_VEL_BOLA : ANIM_VEL_JOGADOR);
      const tr = trajetos.get(el.id);
      if (tr) trajetos.set(el.id, animTrajeto([...tr.partes.map(q => q.sg), extra], tr.ehBola));
      else {
        // Parte de onde está no início deste passo (já com algum deslize).
        const b = base[i];
        trajetos.set(el.id, animTrajeto([animSegmento({ x1: b.x, y1: b.y, x2: dest.x, y2: dest.y }, ehBola ? ANIM_VEL_BOLA : ANIM_VEL_JOGADOR)], ehBola));
      }
      fimMap.set(el.id, dest);
    });
  }
  let dur = 0;
  trajetos.forEach(tr => { dur = Math.max(dur, tr.natural); });
  /* TUDO NO MESMO TEMPO DENTRO DO PASSO (31/10). A bola sai logo, mas
     já não chega antes dos jogadores: bola e jogadores começam e acabam
     juntos, como um fotograma. Antes a bola fazia o passe ao dobro da
     velocidade e ficava parada à espera do recetor, e nos exercícios
     antigos (pensados com bola e jogadores ao mesmo ritmo) os tempos
     ficavam desfasados. A bola mais rápida continua a contar para a
     duração do passo: um passe longo sem corridas é rápido. */
  trajetos.forEach(tr => { tr.dur = dur; });
  const fim = todos.map(el => {
    if (fimMap.has(el.id)) return { ...el, ...fimMap.get(el.id) };
    const m = porMover.get(el.id);
    return m ? { ...el, x: m.fimSeta.x2, y: m.fimSeta.y2 } : el;
  });
  const posicoes = (ms) => {
    const out = new Map();
    trajetos.forEach((tr, id) => out.set(id, animPosicaoNoTrajeto(tr, Math.max(0, Math.min(tr.dur, ms)))));
    return out;
  };
  const deslizados = {};
  base.forEach((el, i) => { if (el !== todos[i]) deslizados[el.id] = { x: el.x, y: el.y }; });
  return { base, dur, posicoes, fim, novasBolas, movers: new Set(trajetos.keys()), deslizados, trajetos };
}

export const animMapaPosicoes = (lista) => new Map((lista || []).map(el => [el.id, { x: el.x, y: el.y }]));

/* Plano da coreografia toda: os passos gravados, cada um a partir do fim
   do anterior, e (se houver) o deslize final até ao campo guardado.
   `ate`: só os passos 0 … ate-1 (para o editor saber o fim do anterior). */
/* EXERCÍCIOS ANTIGOS TOCAM COMO SEMPRE TOCARAM (decisão de 31/10).
   Um exercício é "novo" se algum passo foi gravado com o motor novo
   (`step.v === 2`, ou `step.de` dos primeiros dias). Os antigos usam a
   reprodução de origem: cada passo começa na sua fotografia (as peças
   aparecem no sítio), cada seta acelera e trava sozinha, bola e jogadores
   à mesma velocidade (26), e 0,45 s de pausa entre passos. */
export const ANIM_PAUSA_ANTIGA_MS = 450;

export const ANIM_PAUSA_NOVA_MS = 300; // entre cada Animar, nos exercícios novos

export const animExercicioNovo = (seq) => (seq || []).some(st => st && (st.v === 2 || st.de));

export function planearPassoAntigo(elementos, setas) {
  const animaveis = (setas || []).filter(a => a.type === 'arrow-pass' || a.type === 'arrow-run');
  const cadeias = animaveis.length ? buildAnimationChainsPure(animaveis) : [];
  const novasBolas = [];
  const movs = [];
  cadeias.forEach(cad => {
    const first = cad[0];
    let mover = animMoverPadrao(first, elementos);
    if (!mover && first.type === 'arrow-pass') {
      mover = { id: uid(), kind: 'ball', x: first.x1, y: first.y1 };
      novasBolas.push(mover);
    }
    if (!mover) return;
    let cursor = 0;
    const segmentos = cad.map(a => {
      const duration = Math.max(280, (Math.hypot(a.x2 - a.x1, a.y2 - a.y1) / 26) * 1000);
      const sg = { arrow: a, duration, start: cursor };
      cursor += duration;
      return sg;
    });
    movs.push({ id: mover.id, segmentos, total: cursor });
  });
  const todos = [...elementos, ...novasBolas];
  const dur = movs.reduce((m, x) => Math.max(m, x.total), 0);
  const posicoes = (ms) => {
    const out = new Map();
    movs.forEach(({ id, segmentos }) => {
      let ativo = segmentos[segmentos.length - 1];
      for (const sg of segmentos) { if (ms < sg.start + sg.duration) { ativo = sg; break; } }
      const local = Math.max(0, Math.min(ativo.duration, ms - ativo.start));
      out.set(id, pontoNaSeta(ativo.arrow, easeInOutQuadPure(ativo.duration ? local / ativo.duration : 1)));
    });
    return out;
  };
  const fimPos = new Map(movs.map(m => { const a = m.segmentos[m.segmentos.length - 1].arrow; return [m.id, { x: a.x2, y: a.y2 }]; }));
  const fim = todos.map(el => (fimPos.has(el.id) ? { ...el, ...fimPos.get(el.id) } : el));
  return { base: todos, dur, posicoes, fim, novasBolas, movers: new Set(movs.map(m => m.id)), deslizados: {} };
}

export function planearCoreografiaAnim(diagram, opcoes = {}) {
  const seq = Array.isArray(diagram && diagram.sequence) ? diagram.sequence : [];
  const ate = opcoes.ate != null ? Math.min(opcoes.ate, seq.length) : seq.length;
  const passos = [];
  let antes = null;
  if (!animExercicioNovo(seq) && !opcoes.forcarNovo) {
    for (let i = 0; i < ate; i++) {
      const step = seq[i];
      const p = planearPassoAntigo(stepElements(step, diagram), step.arrows);
      p.setasFixas = stepStaticArrows(step, diagram);
      p.indice = i;
      p.antigo = true;
      if (i + 1 < seq.length) p.pausa = ANIM_PAUSA_ANTIGA_MS;
      passos.push(p);
      antes = animMapaPosicoes(p.fim);
    }
    return { passos, fimAnterior: antes };
  }
  for (let i = 0; i < ate; i++) {
    const step = seq[i];
    /* PASSOS ANTIGOS (sem `step.de`): quem está noutro sítio no início do
       passo SEGUINTE (a equipa reposta para a situação seguinte) vai lá ter
       durante ESTE passo, ao mesmo tempo que a bola e as corridas: o
       recetor chega com a bola. O mesmo para o campo guardado, no último
       passo. (Antes saltavam de sítio; depois passaram a reposicionar-se
       antes do passo seguinte, e o recetor chegava depois da bola.) */
    const seguinte = seq[i + 1];
    let destinos = null;
    if (!step.de) {
      if (seguinte && !seguinte.de) destinos = animMapaPosicoes(stepElements(seguinte, diagram));
      else if (!seguinte && opcoes.semFinal !== true && ate === seq.length) destinos = animMapaPosicoes(diagram.elements || []);
    }
    const p = planearPassoAnim(stepElements(step, diagram), step.arrows, antes, {
      ...opcoes, curvas: step.curvas, soDeslizar: new Set(Object.keys(step.de || {})), destinos,
    });
    p.setasFixas = stepStaticArrows(step, diagram);
    p.indice = i;
    passos.push(p);
    antes = animMapaPosicoes(p.fim);
  }
  /* FIM: se o campo guardado não é igual ao fim do último passo (peças
     arrumadas depois do último Animar, ou correções), as peças vão lá ter
     com a mesma calma da reposição entre passos, em vez de saltarem no
     último instante. */
  if (opcoes.semFinal !== true && ate === seq.length && seq.length && antes) {
    const fin = planearPassoAnim(diagram.elements || [], [], antes, { ...opcoes, velDeslize: ANIM_VEL_REPOSICAO });
    if (fin.dur > 0) {
      fin.setasFixas = diagram.arrows || [];
      fin.indice = seq.length - 1;
      fin.reposicao = true;
      fin.final = true;
      passos.push(fin);
      antes = animMapaPosicoes(fin.fim);
    }
  }
  /* PAUSA CURTA ENTRE CADA ANIMAR (exercícios novos): cada Animar é uma
     "frase" da jogada; 0,3 s entre elas ajuda a ler. Não há pausa antes do
     deslize final até ao campo guardado. */
  for (let i = 0; i + 1 < passos.length; i++) {
    if (!passos[i + 1].final) passos[i].pausa = ANIM_PAUSA_NOVA_MS;
  }
  /* MOVIMENTO SEGUIDO ENTRE PASSOS: quem se mexe num passo e também no
     seguinte passa de um para o outro sem travar até parar (era o
     "pára-arranca" em cada mudança de passo). Com pausa pelo meio, trava. */
  for (let i = 0; i + 1 < passos.length; i++) {
    if (passos[i].pausa) continue;
    const agora = passos[i].trajetos, depois = passos[i + 1].trajetos;
    if (!agora || !depois) continue;
    agora.forEach((tr, id) => {
      const seg = depois.get(id);
      if (seg) { tr.semTravagem = true; seg.semArranque = true; }
    });
  }
  return { passos, fimAnterior: antes };
}

/* O PONTO NA SETA a meio caminho (0 a 1) — reta por omissão, curva se a
   pega do meio (`cx`/`cy`) alguma vez foi arrastada para fora do ponto
   médio. Sem `cx`/`cy` guardados (setas antigas, ou nunca curvadas), o
   ponto médio matemático de uma curva quadrática coincide exatamente
   com o ponto médio da reta — por isso não é preciso "if curvo, se
   não…" em lado nenhum: esta única fórmula serve sempre. Usada tanto a
   desenhar a seta como a animar o que se move ao longo dela — sem
   isto, o desenho ficava curvo mas a bola cortava caminho em linha
   reta por cima da curva. */
export function pontoNaSeta(a, t) {
  const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
  const cx = a.cx != null ? a.cx : mx;
  const cy = a.cy != null ? a.cy : my;
  const u = 1 - t;
  return {
    x: u * u * a.x1 + 2 * u * t * cx + t * t * a.x2,
    y: u * u * a.y1 + 2 * u * t * cy + t * t * a.y2,
  };
}

/* Medidas e posição REAL de uma caixa de texto no campo.

   Uma só fonte de verdade, usada por todos os que precisam de saber onde
   a caixa está: o desenho, a animação e a deteção de qual elemento uma
   seta agarra.

   Existe por causa de um erro concreto: a caixa passou a ser DESENHADA
   numa posição limitada (para não ficar cortada na margem), mas a deteção
   da seta continuava a medir pela posição GUARDADA. Nas caixas junto à
   margem as duas deixavam de coincidir, e uma seta de corrida traçada em
   cima da caixa não a agarrava — daí o texto não animar. */
export function textBoxMetrics(el) {
  const size = (el && el.size) || 3;
  const maxChars = Math.max(8, Math.round((el && el.wrap) || 26));
  const linhas = quebrarTexto((el && el.text) || '', maxChars);
  const maiorLinha = linhas.reduce((a, l) => Math.max(a, l.length), 1);
  // Caixa apertada quando há muito texto: uma nota de cinco linhas com a
  // folga de uma de uma linha tapava meio campo.
  const compacto = linhas.length >= 3 ? (linhas.length >= 5 ? 0.72 : 0.85) : 1;
  const alturaLinha = size * (1.22 * compacto);
  const folgaX = size * 0.7 * compacto;
  const folgaY = size * 0.35 * compacto;
  const w = Math.max(3, maiorLinha * size * 0.56 + folgaX);
  const h = Math.max(size * 1.4 * compacto, linhas.length * alturaLinha + folgaY);
  // Nunca sai da área visível — nem no desenho, nem na deteção.
  const margem = 0.6;
  const cx = Math.max(PITCH_BOX.x + w / 2 + margem, Math.min(PITCH_BOX.x + PITCH_BOX.w - w / 2 - margem, (el && el.x) || 0));
  const cy = Math.max(PITCH_BOX.y + h / 2 + margem, Math.min(PITCH_BOX.y + PITCH_BOX.h - h / 2 - margem, (el && el.y) || 0));
  return { size, linhas, alturaLinha, folgaY, w, h, cx, cy, topo: cy - h / 2 };
}

/* Mantém uma caixa de texto dentro da área desenhada.

   Uma caixa colocada junto à margem ficava cortada a meio da palavra —
   o texto existia mas não se lia, que é o oposto do objetivo de uma
   legenda. Aqui empurra-se o centro para dentro o suficiente para a
   caixa INTEIRA caber. */
export function clampTextElement(el) {
  if (!el || el.kind !== 'text') return el;
  const size = el.size || 3;
  const maxChars = Math.max(8, Math.round(el.wrap || 26));
  const linhas = quebrarTexto(el.text || '', maxChars);
  const maiorLinha = linhas.reduce((a, l) => Math.max(a, l.length), 1);
  const compacto = linhas.length >= 3 ? (linhas.length >= 5 ? 0.72 : 0.85) : 1;
  const boxW = Math.max(3, maiorLinha * size * 0.56 + size * 0.7 * compacto);
  const boxH = Math.max(size * 1.4 * compacto, linhas.length * size * 1.22 * compacto + size * 0.35 * compacto);
  const { x: vx, y: vy, w: vw, h: vh } = PITCH_BOX;
  const margem = 0.6;
  return {
    ...el,
    x: Math.max(vx + boxW / 2 + margem, Math.min(vx + vw - boxW / 2 - margem, el.x)),
    y: Math.max(vy + boxH / 2 + margem, Math.min(vy + vh - boxH / 2 - margem, el.y)),
  };
}

/* Desenhos fixos a mostrar durante um passo da sequência.

   Os passos gravados a partir de agora trazem `staticArrows`: só as linhas
   que já existiam quando o passo foi gravado. Os passos gravados antes
   desta correção não têm esse campo — nesse caso não há forma de saber
   quando cada traço foi feito, e mantém-se o comportamento antigo
   (mostrar tudo), para não fazer desaparecer desenhos de exercícios
   antigos. Re-gravar a animação passa a mostrá-los na altura certa. */
/* Elementos de um passo, sem os que já não existem no campo.

   PORQUÊ: cada passo guarda uma fotografia do campo. Um elemento apagado
   deixava de existir no campo mas continuava em todas as fotografias, e
   reaparecia na apresentação — sem forma de lá chegar para o tirar, porque
   já não estava no editor.

   A regra é simples e vale para esta app: quem existe é quem está no campo
   agora. Um elemento não pode "desaparecer a meio" da animação — o que
   pode é ENTRAR a meio (ver `inserirDesde`), e nesse caso continua a estar
   no campo no fim. Logo, um id que esteja num passo mas não no campo é
   lixo de uma remoção antiga.

   Filtrar na leitura e não nos dados resolve também os exercícios já
   gravados com o problema, sem lhes tocar. */
/* Elementos de um passo: a POSIÇÃO vem do passo, o CONTEÚDO vem do campo
   — MAS só enquanto o elemento ainda existir no campo agora.

   Um passo guarda uma fotografia — mas uma fotografia de ONDE as coisas
   estavam, não do que diziam. O texto de uma caixa, o número de um
   jogador, a cor da equipa, o tamanho: isso é o elemento, e o elemento é
   um só. Por isso, para quem ainda está em campo, a POSE (posição,
   rotação, tamanho) vem do passo, mas o CONTEÚDO vem sempre da versão
   atual — sem isto, escrever numa caixa de texto DEPOIS de ela já estar
   num passo deixava o passo com a cópia antiga.

   Só que nem todo o elemento de um passo ainda está em campo agora — e
   é aí que está a parte importante: um elemento colocado num passo e
   apagado só MAIS TARDE (ver `inserirDesde`/"desde") esteve mesmo lá
   nessa altura, mesmo já não estando no campo hoje. Este código já
   filtrou esses elementos fora um dia, por uma razão válida na altura
   (antes de "desde" existir, apagar tirava sempre de toda a coreografia,
   e um id num passo mas não no campo só podia ser lixo de uma remoção
   antiga) — mas com "desde" a existir, essa mesma limpeza estava a
   apagar da apresentação exatamente as caixas de texto que deviam
   aparecer nos passos anteriores à sua remoção. Agora só se pede o
   conteúdo atual a quem ainda existe; quem já não existe usa a sua
   própria cópia gravada nesse passo, tal como estava nessa altura. */
/* O TEXTO TAMBÉM É POSE, NÃO CONTEÚDO SEMPRE-ATUAL.

   Ao contrário do número de um jogador ou da cor de uma equipa — que
   fazem sentido vir sempre da versão mais recente, porque representam
   "quem é" o elemento, não "o que dizia nessa altura" — o texto de uma
   legenda é mais parecido com a posição: o que estava escrito num passo
   é PARTE DESSE PASSO. Escrever "Pressão alta" numa caixa e, mais tarde,
   mudar para "Bola parada" não pode reescrever os passos anteriores, que
   genuinamente diziam a coisa antiga quando foram gravados — só os
   passos a partir de onde se editou é que devem ficar com o texto novo
   (ver `changeSelectedText`, que trata a edição de texto com o mesmo
   "desde" usado para colocar e para apagar). */
export const CAMPOS_DE_POSE = ['x', 'y', 'rotation', 'w', 'h', 'text'];

export function stepElements(step, diagram) {
  const doPasso = (step && step.elements) || [];
  const atuais = new Map(((diagram && diagram.elements) || []).map(el => [el.id, el]));
  return doPasso.map(el => {
    const atual = atuais.get(el.id);
    // Já não existe no campo agora — mas existiu neste passo. Mostra-se
    // tal como foi gravado aqui, em vez de desaparecer.
    if (!atual) return el;
    const pose = {};
    CAMPOS_DE_POSE.forEach(k => { if (el[k] !== undefined) pose[k] = el[k]; });
    return { ...atual, ...pose };
  });
}

export function stepStaticArrows(step, diagram) {
  return Array.isArray(step && step.staticArrows) ? step.staticArrows : (diagram.arrows || []);
}

export const LINE_LABELS = {
  'arrow-pass': 'Seta de passe',
  'arrow-run': 'Seta de corrida',
  'line-solid': 'Linha contínua',
  'line-dashed': 'Linha tracejada',
};

