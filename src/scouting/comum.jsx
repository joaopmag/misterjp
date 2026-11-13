// scouting/comum.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { age } from '../plantel/PlayerModal';
import { csvEscape } from '../atleta/questionarios';
import { T } from '../base/tema';
import { Star } from 'lucide-react';
import { TATICA_OMISSAO, distribuirPlantel } from '../tatico/prancheta';
import ReactDOMServer from 'react-dom/server';
import { MarcacoesCampoPrint, VIEWBOX_CAMPO_PRINT } from '../tatico/impressaoCampo';
import { escapeHtmlText, fmtDate } from '../base/utilidades';

/* ---------------------------------------------------------------
   SCOUTING — base de dados de jogadores adversários com potencial
   e características.

   Estrutura alinhada com uma matriz de scouting profissional:
   1) Dados cadastrais e perfil biométrico (identificação/filtros)
   2) Avaliação por 4 pilares — Técnico, Tático, Físico, Psicológico
   3) Potencial geral numa escala 1-5 de "Matriz de Rendimento Sénior",
      focada na projeção do atleta Sub-19 para o futebol profissional.
---------------------------------------------------------------- */
export const RATING_LEVELS = [
  { value: 1, label: '1 · Inadaptado', desc: 'Decisões lentas ou infantis. Dificuldades físicas ou táticas para o ritmo de Sub-19.' },
  { value: 2, label: '2 · Inconstante', desc: 'Alterna bons momentos com erros graves de concentração ou de posicionamento tático.' },
  { value: 3, label: '3 · Competente (Nível Base)', desc: 'Cumpre o plano de jogo com eficácia. Jogador de equipa regular, mas arrisca pouco.' },
  { value: 4, label: '4 · Diferencial', desc: 'Toma decisões que resolvem problemas complexos em campo. Destaca-se claramente na categoria.' },
  { value: 5, label: '5 · Nível Sénior/Elite', desc: 'Maturidade, compostura e qualidade técnica prontas para integrar a equipa principal.' },
];

export const DOMINANT_FEET = ['Direito', 'Esquerdo', 'Ambidestro'];

// Os quatro pilares de rendimento desportivo a preencher por jogador.
export const SCOUT_PILLARS = [
  { key: 'technical', label: 'Técnico', hint: 'Passes certos e errados, remates (enquadrados ou para fora), cruzamentos, desarmes e duelos aéreos.' },
  { key: 'tactical', label: 'Tático', hint: 'Posicionamento em campo, coberturas, tipo de pressão exercida e cumprimento das tarefas coletivas.' },
  { key: 'physical', label: 'Físico', hint: 'Intensidade de corrida, acelerações e sprints (muitas vezes cruzados com dados de GPS).' },
  { key: 'psychological', label: 'Psicológico', hint: 'Reação à perda de bola, liderança e capacidade de lidar com a pressão do adversário.' },
];

export function pillarAverage(f) {
  const vals = SCOUT_PILLARS.map(p => Number(f[`${p.key}Rating`]) || 0).filter(v => v > 0);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/* Exporta a base de scouting em CSV, organizada por blocos como o
   ficheiro das presenças: primeiro um resumo comparável (uma linha por
   jogador, com o essencial e as notas dos 4 pilares, já ordenado por
   potencial), e só depois as observações escritas, que são longas e
   estragariam a leitura do resumo. Separador ";" e BOM, para o Excel
   português abrir logo em colunas. */
export function exportScoutingCSV(scouting) {
  const list = [...(scouting || [])].sort((a, b) => {
    const byPot = (Number(b.potential) || 0) - (Number(a.potential) || 0);
    if (byPot !== 0) return byPot;
    const avgA = pillarAverage(a), avgB = pillarAverage(b);
    if ((avgB || 0) !== (avgA || 0)) return (avgB || 0) - (avgA || 0);
    return String(a.name || '').localeCompare(String(b.name || ''), 'pt');
  });

  const rows = [];
  rows.push([`BASE DE SCOUTING · ${list.length} ${list.length === 1 ? 'jogador observado' : 'jogadores observados'}`]);
  rows.push([`Exportado a ${new Date().toLocaleDateString('pt-PT')}`]);
  rows.push([]);

  rows.push(['RESUMO (ordenado por potencial)']);
  rows.push([
    '#', 'Nome', 'Posição', 'Pos. secundária', 'Pé', 'Clube atual',
    'Ano nasc.', 'Idade', 'País', 'Fim de contrato', 'Observado em',
    'Potencial (1-5)', 'Técnico', 'Tático', 'Físico', 'Psicológico', 'Média pilares',
  ]);
  list.forEach((x, i) => {
    const avg = pillarAverage(x);
    rows.push([
      i + 1, x.name || '', x.position || '', x.secondaryPosition || '', x.dominantFoot || '', x.club || '',
      x.birthYear || '', x.birthYear ? age(x.birthYear) : (x.age || ''), x.nationality || '',
      x.contractEnd || '', x.observationDate || '',
      x.potential || '', x.technicalRating || '', x.tacticalRating || '',
      x.physicalRating || '', x.psychologicalRating || '',
      avg === null ? '' : String(avg).replace('.', ','),
    ]);
  });
  rows.push([]);

  rows.push(['OBSERVAÇÕES POR PILAR']);
  rows.push(['Nome', 'Pilar', 'Nota (1-5)', 'Observações']);
  list.forEach(x => {
    SCOUT_PILLARS.forEach(p => {
      const rating = x[`${p.key}Rating`];
      const notes = x[`${p.key}Notes`];
      if (!rating && !notes) return;
      rows.push([x.name || '', p.label, rating || '', notes || '']);
    });
  });
  rows.push([]);

  rows.push(['CARACTERÍSTICAS E NOTAS GERAIS']);
  rows.push(['Nome', 'Características', 'Notas gerais']);
  list.forEach(x => {
    if (!x.traits && !x.notes) return;
    rows.push([x.name || '', x.traits || '', x.notes || '']);
  });

  const csv = rows.map(row => row.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scouting-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RatingStars({ value }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={13} fill={n <= value ? T.warn : 'none'} color={n <= value ? T.warn : T.mutedDim} />
      ))}
    </div>
  );
}

/* Ficha individual do jogador observado — usada tanto na partilha (um
   ficheiro HTML autónomo, que se envia por WhatsApp/email e abre em
   qualquer telemóvel) como na impressão. Só mostra os campos que estão
   preenchidos, para não sair uma folha cheia de traços. */

export function starsText(n) {
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

/* O ESQUEMA DA ESTRUTURA HABITUAL, PARA O FICHEIRO PARTILHADO.

   Mesmo desenho do "Onze provável" no ecrã (PrancheteDoPlantel), só que
   em SVG estático — sem cliques, sem estado, pronto a abrir em qualquer
   lado. `distribuirPlantel` já sabe posicionar os jogadores-chave pela
   tática escolhida; só falta desenhar o campo por baixo e escrever cada
   nome no sítio certo, exatamente como `campoDaEquipaHtml` faz para o
   onze de um jogo. */
export function buildEstruturaHabitualHtml(a, chave) {
  const tatica = a.quadroTatica || TATICA_OMISSAO;
  const lugares = distribuirPlantel({
    players: chave, attendance: (chave || []).map(x => x.id), overrides: a.quadroOverrides, tatica,
  });
  if (!lugares || !lugares.length) return '';

  const marcacoes = ReactDOMServer.renderToStaticMarkup(
    <MarcacoesCampoPrint traco="#ffffff40" baliza="#ffffff66" />
  ).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  // As coordenadas de `l.ponto` já são a fração do campo REAL (0 a 1,
  // 105×68m) — o mesmo sistema do viewBox do campo, sem precisar de
  // nenhuma conversão extra (ver `posCampoPrint`, que faz a mesma conta).
  const nomes = lugares.map(l => {
    const fx = l.id === 'GR' ? 0 : l.ponto[0];
    const fy = l.ponto[1];
    const x = fx * 105;
    const y = fy * 68;
    const nomesLista = (l.lista || []).map(j => j.nome).join(', ');
    const rotulo = escapeHtmlText(l.rotulo || '');
    const nome = escapeHtmlText(nomesLista || '—');
    return `<text x="${x.toFixed(2)}" y="${(y - 1.4).toFixed(2)}" text-anchor="middle" font-size="2.1" fill="#ffffff88">${rotulo}</text>`
      + `<text x="${x.toFixed(2)}" y="${(y + 1.6).toFixed(2)}" text-anchor="middle" font-size="2.4" font-weight="600" fill="${nomesLista ? '#F0E7D6' : '#ffffff55'}">${nome}</text>`;
  }).join('');

  return `<svg class="campo" viewBox="${VIEWBOX_CAMPO_PRINT}" preserveAspectRatio="xMidYMid meet"`
    + ` style="aspect-ratio:105/68" xmlns="http://www.w3.org/2000/svg">${marcacoes}${nomes}</svg>`;
}

export function buildAdversarioReportHtml(a, chave) {
  const table = (pairs) => {
    const valid = pairs.filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (!valid.length) return '';
    return `<table>${valid.map(([k, v]) => `<tr><th>${escapeHtmlText(k)}</th><td>${escapeHtmlText(String(v))}</td></tr>`).join('')}</table>`;
  };

  const identificacao = table([
    ['Escalão', a.escalao],
    ['Prova', a.prova],
    ['Estrutura habitual', a.quadroTatica],
  ]);

  const estruturaHtml = buildEstruturaHabitualHtml(a, chave);

  const jogadoresHtml = (chave || []).length
    ? `<ul>${chave.map(x => `<li>${escapeHtmlText(x.name)}${x.position ? ` — ${escapeHtmlText(x.position)}` : ''}</li>`).join('')}</ul>`
    : '';

  return `
<div>
${identificacao ? `<h2 style="margin-top:0">Identificação</h2>${identificacao}` : ''}
${estruturaHtml ? `<h2>Estrutura habitual</h2>${estruturaHtml}` : ''}
${a.pontosFortes ? `<h2>Pontos fortes</h2><p class="desc">${escapeHtmlText(a.pontosFortes)}</p>` : ''}
${a.pontosFracos ? `<h2>Pontos fracos</h2><p class="desc">${escapeHtmlText(a.pontosFracos)}</p>` : ''}
${jogadoresHtml ? `<h2>Jogadores-chave</h2>${jogadoresHtml}` : ''}
</div>
`;
}

export function buildScoutReportHtml(x) {
  const table = (pairs) => {
    const valid = pairs.filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (!valid.length) return '';
    return `<table>${valid.map(([k, v]) => `<tr><th>${escapeHtmlText(k)}</th><td>${escapeHtmlText(String(v))}</td></tr>`).join('')}</table>`;
  };
  const avg = pillarAverage(x);
  const potentialLabel = (RATING_LEVELS.find(r => r.value === Number(x.potential)) || {}).label || '';

  const identificacao = table([
    ['Nome', x.name],
    ['Clube atual', x.club],
    ['Ano de nascimento', x.birthYear],
    ['Idade', x.birthYear ? age(x.birthYear) : x.age],
    ['País', x.nationality],
    ['Fim de contrato', x.contractEnd],
    ['Posição principal', x.position],
    ['Posição secundária', x.secondaryPosition],
    ['Pé dominante', x.dominantFoot],
    ['Data de observação', x.observationDate ? fmtDate(x.observationDate) : ''],
  ]);

  const pilares = SCOUT_PILLARS.map(p => {
    const rating = x[`${p.key}Rating`];
    const notes = x[`${p.key}Notes`];
    if (!rating && !notes) return '';
    return `<h2>${escapeHtmlText(p.label)} — ${escapeHtmlText(rating ? `${rating}/5  ${starsText(rating)}` : 'sem avaliação')}</h2>`
      + (notes ? `<p class="desc">${escapeHtmlText(notes)}</p>` : '');
  }).join('');

  // A foto fica encostada à tabela de identificação, ambas alinhadas à
  // esquerda — antes flutuava à direita e ficava colada à margem, com um
  // vazio enorme no meio. A média dos 4 pilares aparece depois dos
  // pilares todos, não antes deles.
  const photoHtml = x.photo
    ? `<img src="${x.photo}" alt="Fotografia" style="width:170px;max-width:40%;aspect-ratio:3/4;object-fit:cover;border-radius:10px;border:1px solid #33513c;background:#000;flex:0 0 auto;" />`
    : '';

  return `
<div>
<h2 style="margin-top:0">Identificação</h2>
<div style="display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap;">
  <div style="flex:0 1 auto;">${identificacao.replace('<table>', '<table style="width:auto">')}</div>
  ${photoHtml}
</div>
<h2>Potencial geral</h2>
<p class="desc">${escapeHtmlText(x.potential ? `${x.potential}/5  ${starsText(x.potential)}${potentialLabel ? ` — ${potentialLabel}` : ''}` : 'Sem classificação')}</p>
${pilares}
${avg !== null ? `<p class="desc" style="margin-top:14px"><strong>${escapeHtmlText(`Média dos 4 pilares: ${avg}`)}</strong></p>` : ''}
</div>
${x.traits ? `<h2>Características</h2><p class="desc">${escapeHtmlText(x.traits)}</p>` : ''}
${x.notes ? `<h2>Notas gerais</h2><p class="desc">${escapeHtmlText(x.notes)}</p>` : ''}
`;
}

