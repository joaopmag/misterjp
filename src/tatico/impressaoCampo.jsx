// tatico/impressaoCampo.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { LAYOUT_FORMACAO, rotuloDoLugar, distribuirOnzeNoCampo, FORMACOES } from './Simulador';
import ReactDOMServer from 'react-dom/server';
import { escapeHtmlText } from '../base/utilidades';
import { shortPlayerName } from '../dominio/jogadores';
import { numeroDaCamisola, ordenarPorCamisola } from '../dominio/plantel';
import { eventosDoJogo } from '../competicao/dados';

/* O CAMPO DESENHADO PARA PAPEL — BALIZAS E MARCAÇÕES.

   As medidas são as reais (105 × 68 m), por isso não há aqui números
   inventados: grande área 16,5 × 40,32; pequena área 5,5 × 18,32; círculo
   central e arcos de grande penalidade com 9,15 de raio; marca de
   penálti a 11 da linha; cantos com 1.

   O `viewBox` é maior do que o campo (–3 –2 111 72) para as balizas
   caberem POR FORA da linha de fundo, que é onde elas estão. Isso obriga
   a converter as posições dos jogadores: o layout das formações fala em
   fração do campo (0 a 1) e não do desenho todo, e sem a conversão os
   jogadores saíam encostados a um dos lados. É o que `posCampoPrint`
   faz — e é a razão de existir. */
export const VIEWBOX_CAMPO_PRINT = '-3 -2 111 72';

export const ASPECT_CAMPO_PRINT = '111 / 72';

export const posCampoPrint = (fx, fy) => ({
  left: `${((fx * 105 + 3) / 111) * 100}%`,
  top: `${((fy * 68 + 2) / 72) * 100}%`,
});

export function MarcacoesCampoPrint({ traco = '#999', baliza = '#666' }) {
  /* Serve o papel E o ecrã: em papel os traços são cinzentos, na ficha do
     jogo passam-se cores claras e transparentes. Ter as medidas num sítio
     só é o que impede o campo do ecrã e o do papel de divergirem — já
     tinham divergido antes, com o do ecrã sem balizas nem cantos. */
  const linha = { fill: 'none', stroke: traco, strokeWidth: 0.4 };
  return (
    <svg
      viewBox={VIEWBOX_CAMPO_PRINT}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      {/* Linhas laterais e de fundo, meio-campo e círculo central */}
      <rect x="0" y="0" width="105" height="68" {...linha} />
      <line x1="52.5" y1="0" x2="52.5" y2="68" {...linha} />
      <circle cx="52.5" cy="34" r="9.15" {...linha} />
      <circle cx="52.5" cy="34" r="0.5" fill={traco} stroke="none" />

      {/* Grandes e pequenas áreas */}
      <rect x="0" y="13.84" width="16.5" height="40.32" {...linha} />
      <rect x="0" y="24.84" width="5.5" height="18.32" {...linha} />
      <rect x="88.5" y="13.84" width="16.5" height="40.32" {...linha} />
      <rect x="99.5" y="24.84" width="5.5" height="18.32" {...linha} />

      {/* Marcas de penálti e os arcos, que só existem fora da área */}
      <circle cx="11" cy="34" r="0.5" fill={traco} stroke="none" />
      <circle cx="94" cy="34" r="0.5" fill={traco} stroke="none" />
      <path d="M16.5 26.69 A9.15 9.15 0 0 1 16.5 41.31" {...linha} />
      <path d="M88.5 26.69 A9.15 9.15 0 0 0 88.5 41.31" {...linha} />

      {/* Cantos */}
      <path d="M0 1 A1 1 0 0 0 1 0" {...linha} />
      <path d="M104 0 A1 1 0 0 0 105 1" {...linha} />
      <path d="M105 67 A1 1 0 0 0 104 68" {...linha} />
      <path d="M1 68 A1 1 0 0 0 0 67" {...linha} />

      {/* Balizas: 7,32 de boca, desenhadas por fora da linha de fundo */}
      <rect x="-2.2" y="30.34" width="2.2" height="7.32" fill="none" stroke={baliza} strokeWidth="0.6" />
      <rect x="105" y="30.34" width="2.2" height="7.32" fill="none" stroke={baliza} strokeWidth="0.6" />
    </svg>
  );
}

/* Campo com o onze titular do jogo amigável, para a ficha impressa —
   mesmo espírito da Ficha de Jogo (campo com posições + banco), só que em
   papel: fundo branco, linhas cinzentas, sem cliques.

   O campo aparece SEMPRE, mesmo sem equipa gravada — só que vazio (cada
   lugar mostra o travessão em vez de um nome). É mais fácil o treinador
   preencher à mão no papel do que a ficha desaparecer só porque ainda
   não se gravou nada no Simulador.

   `ideias` é o plano escrito na edição do jogo. Vem de fora (a sessão não
   o tem; quem o guarda é o jogo) e sai no fim da folha, no lugar onde
   antes estava a lista com o nome de toda a gente — que era repetição:
   quem jogou já está em Titulares e Suplentes, logo por cima.

   DUAS FONTES PARA O MESMO ONZE. O Simulador pode ter deixado uma equipa
   guardada na sessão; mas quem preenche os titulares na ficha do JOGO
   (em Jogos) não passa pelo Simulador, e essa folha saía vazia — com
   travessões — mesmo com a equipa toda lançada. Agora o jogo é a fonte
   por omissão e o Simulador só passa à frente quando lá está mesmo
   alguém: é a informação mais recente e mais deliberada das duas. */
/* O CAMPO E A EQUIPA, PARA O FICHEIRO PARTILHADO.

   O ficheiro dizia a equipa em duas frases com vírgulas. Quem o abre quer
   ver o onze onde ele joga — é para isso que o campo existe no ecrã, e
   não havia razão para o ficheiro dizer menos.

   Tudo desenhado em SVG e escrito no ficheiro: sem imagens externas, sem
   JavaScript, sem depender de nada. Abre igual em qualquer lado. */
export function campoDaEquipaHtml({ lugares, formacao }) {
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];
  const vb = VIEWBOX_CAMPO_PRINT.split(/[\s,]+/).map(Number);
  const marcacoes = ReactDOMServer.renderToStaticMarkup(
    <MarcacoesCampoPrint traco="#ffffff40" baliza="#ffffff66" />
  ).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  const nomes = lugares.map((l, i) => {
    const [fx, fy] = l.ponto || layout[i] || [0.5, 0.5];
    const x = fx * 105;
    const y = fy * 68;
    const lugar = escapeHtmlText(rotuloDoLugar(l.lugar));
    const nome = escapeHtmlText(l.nome || '—');
    return `<text x="${x.toFixed(2)}" y="${(y - 1.4).toFixed(2)}" text-anchor="middle" font-size="2.1" fill="#ffffff88">${lugar}</text>`
      + `<text x="${x.toFixed(2)}" y="${(y + 1.6).toFixed(2)}" text-anchor="middle" font-size="2.7" font-weight="600" fill="${l.nome ? '#F0E7D6' : '#ffffff55'}">${nome}</text>`;
  }).join('');

  return `<svg class="campo" viewBox="${VIEWBOX_CAMPO_PRINT}" preserveAspectRatio="xMidYMid meet"`
    + ` style="aspect-ratio:${vb[2]}/${vb[3]}" xmlns="http://www.w3.org/2000/svg">${marcacoes}${nomes}</svg>`;
}

/* As duas colunas, no mesmo desenho da folha impressa. */
export function equipaEmColunasHtml(titulares, suplentes) {
  const coluna = (titulo, lista) => {
    const itens = lista.length
      ? lista.map(l => {
        const m = String(l.nome || '').match(/^(\d+)\s+(.*)$/);
        const num = m ? m[1] : '';
        const nome = m ? m[2] : l.nome;
        return `<li><span class="n">${escapeHtmlText(num)}</span><span>${escapeHtmlText(nome)}</span></li>`;
      }).join('')
      : '<li><span>—</span></li>';
    return `<div><h3>${titulo} (${lista.length})</h3><ol>${itens}</ol></div>`;
  };
  return `<div class="equipa">${coluna('Titulares', titulares)}${coluna('Suplentes', suplentes)}</div>`;
}

export function equipaDoAmigavel({ session, jogo, players }) {
  const dados = session && session.equipasSimulador && session.equipasSimulador.onzeAmigavel;
  const doSimulador = !!(dados && dados.onze && dados.onze.some(l => l.jogador));
  const comNumero = (p) => `${p.number ? `${p.number} ` : ''}${p.name}${p.convidado ? ' (exp)' : ''}`;

  /* As listas saem sempre como [{ nome, x }]: `nome` para escrever, `x`
     com os acontecimentos do jogo quando eles existem. O Simulador só
     guarda nomes, por isso aí `x` vem vazio e a folha mostra a linha sem
     símbolos — mas com o mesmo desenho. */
  if (doSimulador) {
    const formacao = dados.formacao || '4-3-3';
    const lugares = dados.onze.map(l => ({ lugar: l.lugar, ponto: l.ponto || null, nome: l.jogador || null }));
    // Pelo número da camisola de quem tem esse nome (o Simulador só guarda nomes).
    const numeroDoNome = (n) => numeroDaCamisola((players || []).find(p => p.name === n));
    const porNumero = (a, b) => (numeroDoNome(a) - numeroDoNome(b)) || String(a).localeCompare(String(b), 'pt');
    return {
      formacao,
      lugares,
      titulares: lugares.filter(l => l.nome).map(l => l.nome).sort(porNumero).map(n => ({ nome: n, x: null })),
      suplentes: [...(dados.suplentes || [])].sort(porNumero).map(n => ({ nome: n, x: null })),
    };
  }

  if (jogo) {
    const formacao = jogo.formacao || '4-3-3';
    const eventos = eventosDoJogo(jogo, players || []);
    const d = distribuirOnzeNoCampo(eventos.titulares.map(x => x.player), formacao, jogo.alinhamento);
    /* Titulares e suplentes PELO NÚMERO DA CAMISOLA (o campo desenhado por
       cima já mostra o lugar de cada um). */
    const porPosicao = ordenarPorCamisola(eventos.titulares.map(x => x.player))
      .map(p => eventos.titulares.find(x => x.player.id === p.id))
      .filter(Boolean);
    const suplentesPorNumero = ordenarPorCamisola(eventos.suplentes.filter(Boolean).map(x => x.player))
      .map(p => eventos.suplentes.find(x => x && x.player.id === p.id))
      .filter(Boolean);
    return {
      formacao,
      lugares: d.lugares.map((lugar, i) => ({
        lugar,
        nome: d.colocados[i] ? shortPlayerName(d.colocados[i], players) : null,
      })),
      titulares: porPosicao.map(x => ({ nome: comNumero(x.player), x })),
      suplentes: suplentesPorNumero.map(x => ({ nome: comNumero(x.player), x })),
    };
  }

  return {
    formacao: '4-3-3',
    lugares: (FORMACOES['4-3-3'] || []).map(l => ({ lugar: l, nome: null })),
    titulares: [],
    suplentes: [],
  };
}

