// competicao/MatchDashboard.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { isFriendlyMatch } from '../dominio/jogos';
import { useState, useEffect } from 'react';
import { escapeHtmlText } from '../base/utilidades';
import { T, body, TEXT_ON_ACCENT, mono } from '../base/tema';
import { Share2, Printer } from 'lucide-react';
import { Panel } from '../base/ui';
import { createPortal } from 'react-dom';
import { playerStats } from '../dominio/estatisticas';
import { buildShareableHtmlDoc, shareOrDownloadHtml } from '../base/partilha';

/* OS DOIS RECORTES DAS ESTATÍSTICAS DE JOGO.

   Misturar amigáveis com jogos do campeonato faz o mesmo estrago que já
   corrigimos nas convocatórias: infla os números de toda a gente e dá a
   leitura errada de quem está a ser chamado a sério. Um jogador com 12
   presenças em amigáveis não tem a mesma história de um com 12
   convocatórias no campeonato.

   A separação é pela NATUREZA do jogo e não por datas. Uma versão
   anterior usava uma data de fim de pré-época, para apanhar torneios
   oficiais de julho — mas obrigava a configurar uma coisa a mais para
   resolver um caso raro, e sem ela nada funcionava. Amigável contra
   oficial é uma distinção que a app já faz sozinha, em todo o lado.

   As COLUNAS mudam com o recorte, porque as palavras não querem dizer o
   mesmo: num amigável não há convocatória, há presenças. "Convocado" ali
   seria a palavra errada — e é a palavra errada que faz uma tabela ser
   mal lida. */
export const VISTAS_JOGO = [
  {
    id: 'competicao',
    label: 'Competição',
    desc: 'Jogos oficiais: campeonato, taça e torneios a sério.',
    colConv: 'Conv', colNaoConv: 'N conv',
    ajudaConv: 'Convocatórias', ajudaNaoConv: 'Jogos em que não foi convocado',
  },
  {
    id: 'preepoca',
    label: 'Pré-época',
    desc: '',
    colConv: 'Jogos', colNaoConv: 'NP',
    ajudaConv: 'Jogos em que esteve presente', ajudaNaoConv: 'Jogos em que não esteve presente',
  },
];

export function filtrarJogosPorVista(matches, vista) {
  const lista = matches || [];
  if (vista === 'preepoca') return lista.filter(isFriendlyMatch);
  return lista.filter(m => !isFriendlyMatch(m));
}

export function MatchDashboard({ players, matches }) {
  const [vista, setVista] = useState('competicao');
  const [imprimir, setImprimir] = useState(false);
  // null = ordem por omissão (nota média, do melhor para o pior — como
  // já era antes de haver colunas clicáveis). Uma vez escolhida uma
  // coluna, o clique seguinte na MESMA coluna inverte o sentido; clicar
  // numa coluna diferente troca de coluna e volta a começar por
  // descendente (o mais alto primeiro é o que normalmente interessa
  // ver primeiro nestas colunas — jogos, minutos, golos, etc.).
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const vistaAtual = VISTAS_JOGO.find(v => v.id === vista) || VISTAS_JOGO[0];
  const escolhidos = filtrarJogosPorVista(matches, vista);

  // "Não convocado" só faz sentido em jogos onde houve mesmo convocatória.
  // Um jogo ainda sem ninguém escolhido não conta como não convocado para
  // toda a gente — era isso que punha a coluna sempre no total de jogos.
  const totalMatches = escolhidos.filter(m => (m.convocados || []).length > 0).length;

  /* AS COLUNAS DEFINIDAS UMA VEZ SÓ.

     A tabela é escrita em três sítios — ecrã, folha impressa e ficheiro
     partilhado. Com os cabeçalhos e as contas copiados nos três, bastava
     acrescentar uma coluna num deles para as versões deixarem de bater
     certo. Aqui o cabeçalho e o valor de cada coluna andam juntos, e
     quem desenha só percorre a lista. */
  const colunas = [
    { h: vistaAtual.colConv, t: vistaAtual.ajudaConv, v: s => s.matchesPlayed },
    { h: 'Titular', t: 'Jogos em que foi titular', v: s => s.starts },
    { h: 'Supl', t: 'Jogos em que começou no banco', v: s => s.matchesPlayed - s.starts },
    { h: 'Supl uti', t: 'Jogos em que entrou vindo do banco', v: s => s.subsUsed },
    { h: vistaAtual.colNaoConv, t: vistaAtual.ajudaNaoConv, v: s => Math.max(0, totalMatches - s.matchesPlayed) },
    { h: 'Min', t: 'Minutos jogados', v: s => s.minutes },
    { h: 'Golos', v: s => s.goals },
    { h: 'Ass.', t: 'Assistências', v: s => s.assists },
    { h: 'A', t: 'Cartões amarelos', v: s => s.yellow },
    { h: 'V', t: 'Cartões vermelhos', v: s => s.red },
    { h: 'Nota', t: 'Nota média', v: s => s.avgMatchRating ?? '—', destaque: true },
  ];

  // Clicar num cabeçalho ordena por essa coluna; um segundo clique na
  // mesma inverte o sentido. Sem coluna escolhida, mantém-se a ordem de
  // sempre (nota média, do melhor para o pior).
  const colunaOrdenada = sortCol != null ? colunas[sortCol] : null;
  const rows = players
    .map(p => ({ player: p, s: playerStats(p, [], escolhidos) }))
    .sort((a, b) => {
      if (colunaOrdenada) {
        // A nota vem como texto ("6.3", de `.toFixed(1)`), não como
        // número — `typeof` sozinho tratava-a sempre como "não é
        // número" e a ordenação por Nota não fazia nada. `Number(...)`
        // converte tanto números como texto numérico da mesma forma.
        const va = Number(colunaOrdenada.v(a.s));
        const vb = Number(colunaOrdenada.v(b.s));
        const na = Number.isNaN(va) ? -Infinity : va;
        const nb = Number.isNaN(vb) ? -Infinity : vb;
        const diff = sortDir === 'asc' ? na - nb : nb - na;
        if (diff !== 0) return diff;
      }
      return (b.s.avgMatchRating || 0) - (a.s.avgMatchRating || 0);
    });

  const alternarOrdenacao = (i) => {
    if (sortCol === i) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(i);
      setSortDir('desc');
    }
  };

  const nomeJogador = (p) => `${p.number ? `${p.number} ` : ''}${p.name}`;
  const tituloTabela = `Estatísticas — ${vistaAtual.label}`;

  const doPrint = () => {
    setImprimir(true);
    setTimeout(() => window.print(), 80);
  };

  /* A FOLHA TEM DE SAIR DO BODY DEPOIS DE IMPRIMIR.

     Enquanto ficava montada, imprimir a seguir a ficha de um jogo levava
     as duas coisas na mesma impressão — e, pior, o `@page landscape`
     desta folha virava também a outra. `afterprint` dispara quando o
     diálogo fecha, seja para imprimir ou para cancelar. */
  useEffect(() => {
    if (!imprimir) return undefined;
    const limpar = () => setImprimir(false);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [imprimir]);

  const doShare = () => {
    const cabecalho = `<tr><th>Jogador</th>${colunas.map(c => `<th>${escapeHtmlText(c.h)}</th>`).join('')}</tr>`;
    const corpo = rows.map(({ player, s }) =>
      `<tr><td>${escapeHtmlText(nomeJogador(player))}</td>${colunas.map(c => `<td>${escapeHtmlText(String(c.v(s)))}</td>`).join('')}</tr>`
    ).join('');
    const html = buildShareableHtmlDoc({
      title: tituloTabela,
      metaLines: [`${escolhidos.length} jogos`, `${rows.length} jogadores`, new Date().toLocaleDateString('pt-PT')],
      blocks: [],
      extraHtml: `<table><thead>${cabecalho}</thead><tbody>${corpo}</tbody></table>`,
    });
    shareOrDownloadHtml(`estatisticas_${vistaAtual.id}.html`, html, tituloTabela);
  };

  /* Ícones no cabeçalho do painel, com o mesmo desenho dos cartões: bloco
     próprio, encostados à direita, 14px, sem padding. */
  const acoes = rows.length === 0 ? null : (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
      <button onClick={doShare} title="Partilhar as estatísticas como ficheiro" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Share2 size={14} /></button>
      <button onClick={doPrint} title="Imprimir as estatísticas (uma folha, na horizontal)" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Printer size={14} /></button>
    </div>
  );

  const seletor = (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {VISTAS_JOGO.map(v => {
          const on = vista === v.id;
          const n = filtrarJogosPorVista(matches, v.id).length;
          return (
            <button key={v.id} onClick={() => setVista(v.id)} style={{
              padding: '5px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer', ...body,
              background: on ? '#B5393F' : 'transparent',
              color: on ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${on ? '#B5393F' : T.line}`,
            }}>{v.label} ({n})</button>
          );
        })}
      </div>
      {/* A descrição só aparece quando acrescenta alguma coisa. Repetir
          por baixo o que o separador já diz é ruído. */}
      {vistaAtual.desc && (
        <div style={{ fontSize: 11.5, color: T.mutedDim }}>{vistaAtual.desc}</div>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <Panel title="Estatísticas">
        {seletor}
        <div style={{ fontSize: 12.5, color: T.mutedDim }}>Ainda sem jogos com relatório neste recorte.</div>
      </Panel>
    );
  }

  const th = { textAlign: 'center', padding: '9px 8px', fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
  const thName = { ...th, textAlign: 'left' };
  const td = { padding: '8px 8px', fontSize: 12.5, color: T.mutedDim, textAlign: 'center', whiteSpace: 'nowrap' };

  /* UMA FOLHA SÓ, SEMPRE.

     A tabela tem doze colunas: em retrato não cabe, e o que sai é uma
     folha cortada ao meio e outra com o resto. Por isso a impressão das
     estatísticas muda a orientação para horizontal — e só a delas: o
     `@page` vive dentro desta folha e desaparece com ela, sem afetar as
     fichas de treino e de jogo, que continuam em retrato.

     O tamanho da letra encolhe conforme o número de linhas, para um
     plantel grande continuar a caber na mesma folha em vez de passar
     para a segunda. Acima de 60 jogadores nem assim cabe — aí a segunda
     folha é inevitável e mais vale ser legível. */
  const nLinhas = rows.length;
  const escala = nLinhas <= 26
    ? { fonte: 9.5, celula: '3px 5px' }
    : nLinhas <= 40
      ? { fonte: 8, celula: '2px 4px' }
      : { fonte: 6.8, celula: '1px 3px' };

  const thPrint = { textAlign: 'center', padding: escala.celula, fontSize: escala.fonte, textTransform: 'uppercase', borderBottom: '1px solid #999', whiteSpace: 'nowrap' };
  const tdPrint = { padding: escala.celula, fontSize: escala.fonte, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e2e2' };

  return (
    <Panel title="Estatísticas" action={acoes}>
      {seletor}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr style={{ background: T.bg }}>
              <th style={thName}>Jogador</th>
              {colunas.map((c, i) => (
                <th
                  key={c.h} style={{ ...th, cursor: 'pointer', userSelect: 'none' }} title={c.t}
                  onClick={() => alternarOrdenacao(i)}
                >
                  {c.h}
                  {/* A seta ocupa sempre o mesmo espaço, mesmo quando
                      invisível (opacity, não display) — só a torna visível
                      muda a largura da coluna e empurra as outras para o
                      lado a cada clique, que era o que estava a acontecer. */}
                  <span style={{ opacity: sortCol === i ? 1 : 0 }}>{sortDir === 'desc' ? ' ▾' : ' ▴'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, s }) => (
              <tr key={player.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                <td style={{ padding: '8px 8px', fontSize: 12.5, color: T.cream, whiteSpace: 'nowrap' }}>{nomeJogador(player)}</td>
                {colunas.map(c => (
                  <td key={c.h} style={c.destaque ? { ...td, color: T.warn, ...mono } : td}>{c.v(s)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {imprimir && createPortal(
        <div className="print-sheet">
          <style>{`
            @media print {
              @page { size: A4 landscape; margin: 10mm; }
              .print-sheet { max-width: none !important; }
              .print-sheet table { width: 100%; border-collapse: collapse; }
              .print-sheet tr { break-inside: avoid; page-break-inside: avoid; }
              .print-sheet thead { display: table-header-group; }
            }
          `}</style>
          <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{tituloTabela}</h2>
          {/* Sem data: o browser já a imprime no cabeçalho da folha, e
              duas datas na mesma página só levantam a dúvida de qual é
              qual. */}
          <p style={{ margin: '0 0 12px', fontSize: 11.5 }}>
            {[`${escolhidos.length} jogos`, `${rows.length} jogadores`].join(' · ')}
          </p>
          <table>
            <thead>
              <tr>
                <th style={{ ...thPrint, textAlign: 'left' }}>Jogador</th>
                {colunas.map(c => <th key={c.h} style={thPrint}>{c.h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ player, s }) => (
                <tr key={player.id}>
                  <td style={{ ...tdPrint, textAlign: 'left' }}>{nomeJogador(player)}</td>
                  {colunas.map(c => <td key={c.h} style={tdPrint}>{c.v(s)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </Panel>
  );
}

