// plantel/Historico.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { addDays, formatShortDatePt, todayStr } from '../base/utilidades';
import { T, mono, body } from '../base/tema';
import { useState } from 'react';
import { sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { Panel, FIELD_GRID, Field, Input, FIELD_FULL } from '../base/ui';
import { rpeContexto, wellnessAvg } from './comum';

/* ---------------------------------------------------------------
   PLANTEL — HISTÓRICO

   Vista de período: escolhe-se uma data de início e uma data de fim
   (seletores de calendário) e, para cada jogador do plantel, mostra-se
   a média de Wellness e de PSE nesse intervalo, cada uma acompanhada
   de um gráfico de linha com os valores dia a dia.

   Dias sem resposta não contam para a média e ficam como falha na
   linha — não são tratados como zero, o que baixaria a média sem razão.
---------------------------------------------------------------- */

// Lista de datas (YYYY-MM-DD) entre início e fim, inclusive. Limitada a
// um ano para o gráfico não ficar ilegível nem pesado.
export const HISTORY_MAX_DAYS = 366;

export function dateRangeList(start, end) {
  if (!start || !end) return [];
  if (new Date(start) > new Date(end)) return [];
  const out = [];
  let d = start;
  while (out.length < HISTORY_MAX_DAYS) {
    out.push(d);
    if (d === end) break;
    d = addDays(d, 1);
  }
  return out;
}

// Gráfico de linha compacto. `points` é um array com um valor por dia
// (null quando não há resposta nesse dia). O domínio é fixo (1-5 no
// Wellness, 0-10 no PSE) para as linhas de jogadores diferentes serem
// diretamente comparáveis entre si.
/* Gráfico de evolução.

   `labels` traz a data de cada posição, para o valor poder ser lido ao
   passar o rato — sem isso, um ponto alto no meio do gráfico não diz em
   que dia foi, que é justamente a pergunta seguinte de quem o vê.

   `extraPoints` desenha uma segunda série no mesmo eixo (usado para
   separar o PSE de jogo do PSE de treino sem duplicar o gráfico). */
export function Sparkline({
  points, min, max, color, width = 190, height = 44,
  labels = [], unit = '', mainLabel = '', extraPoints = null, extraColor = null, extraLabel = '',
}) {
  const n = Math.max(points.length, extraPoints ? extraPoints.length : 0);
  const conhecidos = (lista) => (lista || []).map((v, i) => ({ v, i })).filter(p => typeof p.v === 'number');
  const known = conhecidos(points);
  const knownExtra = conhecidos(extraPoints);
  if (!n || (known.length === 0 && knownExtra.length === 0)) {
    return <div style={{ fontSize: 11.5, color: T.mutedDim, ...mono }}>sem dados</div>;
  }
  const pad = 5;
  const x = (i) => (n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2));
  const y = (v) => {
    const clamped = Math.max(min, Math.min(max, v));
    return height - pad - ((clamped - min) / (max - min)) * (height - pad * 2);
  };
  const raio = (lista) => (lista.length > 40 ? 1.3 : 2.4);
  /* No telemóvel não há rato, e o `<title>` do SVG só aparece ao passar
     por cima — ou seja, o valor era invisível em metade dos ecrãs. Guardar
     o ponto tocado e desenhar a etiqueta resolve nos dois: no computador
     aparece ao passar, no telemóvel ao tocar. */
  const [tocado, setTocado] = useState(null);

  // Texto da dica: "seg, 11/08 · 7/10 (jogo)".
  const dica = (p, etiqueta) => {
    const dia = labels[p.i] ? formatShortDatePt(labels[p.i]) : '';
    const valor = `${p.v}${unit}`;
    const extra = etiqueta ? ` (${etiqueta})` : '';
    return [dia, valor].filter(Boolean).join(' · ') + extra;
  };

  const serie = (lista, cor, etiqueta) => (
    <>
      {lista.length > 1 && (
        <polyline points={lista.map(p => `${x(p.i)},${y(p.v)}`).join(' ')} fill="none" stroke={cor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {lista.map(p => {
        const ativo = tocado && tocado.i === p.i && tocado.etiqueta === etiqueta;
        return (
          <g key={`${etiqueta}-${p.i}`}>
            <circle cx={x(p.i)} cy={y(p.v)} r={ativo ? raio(lista) + 1.4 : raio(lista)} fill={cor} />
            {/* Alvo invisível maior do que o ponto: sem ele era preciso
                acertar em 2px, o que é impossível com o dedo. */}
            <circle
              cx={x(p.i)} cy={y(p.v)} r={11} fill="transparent"
              style={{ cursor: 'pointer' }}
              onPointerDown={() => setTocado(ativo ? null : { i: p.i, etiqueta, v: p.v, cor })}
              onMouseEnter={() => setTocado({ i: p.i, etiqueta, v: p.v, cor })}
              onMouseLeave={() => setTocado(t => (t && t.i === p.i && t.etiqueta === etiqueta ? null : t))}
            >
              <title>{dica(p, etiqueta)}</title>
            </circle>
          </g>
        );
      })}
    </>
  );

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <line x1={0} y1={height - pad} x2={width} y2={height - pad} stroke={T.line} strokeWidth="1" />
      <line x1={0} y1={pad} x2={width} y2={pad} stroke={T.line} strokeWidth="1" strokeDasharray="2 3" />
      {serie(known, color, mainLabel)}
      {knownExtra.length > 0 && serie(knownExtra, extraColor || color, extraLabel)}

      {/* Etiqueta do ponto tocado. Fica acima do ponto, e encosta-se à
          borda quando o ponto está num dos extremos, para não sair do
          gráfico. */}
      {tocado && (() => {
        const texto = dica({ i: tocado.i, v: tocado.v }, tocado.etiqueta);
        const largura = texto.length * 5.4 + 10;
        const px = Math.max(largura / 2, Math.min(width - largura / 2, x(tocado.i)));
        const py = y(tocado.v);
        const acima = py > 18;
        const topo = acima ? py - 21 : py + 7;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={px - largura / 2} y={topo} width={largura} height={16} rx={4} fill={T.fundoDica} stroke={T.line} strokeWidth="1" />
            <text x={px} y={topo + 11} textAnchor="middle" fontSize="10" fill={T.cream} style={{ ...mono }}>{texto}</text>
          </g>
        );
      })()}
    </svg>
  );
}

export function PlantelHistorico({ players, monitoring, matches = [], sessions = [] }) {
  const ctx = { matches, sessions };
  // Por omissão, os últimos 7 dias (incluindo hoje).
  const [start, setStart] = useState(() => addDays(todayStr(), -6));
  const [end, setEnd] = useState(() => todayStr());

  const dates = dateRangeList(start, end);
  const invalidRange = !!start && !!end && new Date(start) > new Date(end);

  const rows = sortByPosition(players).map(p => {
    const recs = monitoring.filter(m => m.playerId === p.id);
    const wellnessDaily = dates.map(d => wellnessAvg(recs.find(m => m.date === d && typeof m.sono === 'number')));
    // Uma série por contexto: a carga de jogo não se mistura com a de
    // treino, senão a média esconde precisamente o que interessa ver.
    const pseDe = (contexto) => dates.map(d => {
      const r = recs.find(m => m.date === d && typeof m.pse === 'number' && rpeContexto(m, ctx) === contexto);
      return r ? r.pse : null;
    });
    const pseTreinoDaily = pseDe('treino');
    const pseJogoDaily = pseDe('jogo');
    const pseDaily = dates.map((d, i) => (
      typeof pseTreinoDaily[i] === 'number' ? pseTreinoDaily[i] : pseJogoDaily[i]
    ));
    const mean = (arr) => {
      const vals = arr.filter(v => typeof v === 'number');
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      player: p,
      wellnessDaily, pseDaily, pseTreinoDaily, pseJogoDaily,
      wellnessMean: mean(wellnessDaily),
      pseMean: mean(pseDaily),
      pseTreinoMean: mean(pseTreinoDaily),
      pseJogoMean: mean(pseJogoDaily),
      wellnessCount: wellnessDaily.filter(v => typeof v === 'number').length,
      pseCount: pseDaily.filter(v => typeof v === 'number').length,
    };
  });

  const th3 = { textAlign: 'left', padding: '9px 12px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
  const td3 = { padding: '10px 12px', fontSize: 13, color: T.mutedDim, verticalAlign: 'middle' };

  return (
    <Panel title="Plantel — histórico">
      {/* Mesma grelha dos restantes formulários: as duas datas e os atalhos
          ficam com a mesma largura e alinhados, também no telemóvel.
          O espaço em cima separa-o da tabela anterior, que sem ele ficava
          encavalitada nas etiquetas das datas. */}
      <div style={{ ...FIELD_GRID, marginTop: 28, marginBottom: 14 }}>
        <Field label="Data de início"><Input type="date" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} /></Field>
        <Field label="Data de fim"><Input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} /></Field>
        <div style={{ ...FIELD_FULL, display: 'flex', gap: 6 }}>
          {[['7 dias', 6], ['14 dias', 13], ['30 dias', 29]].map(([label, back]) => (
            <button key={label} onClick={() => { setStart(addDays(todayStr(), -back)); setEnd(todayStr()); }} style={{
              flex: 1, height: 38, padding: '0 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', ...body,
              background: 'transparent', color: T.muted, border: `1px solid ${T.line}`,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {invalidRange ? (
        <div style={{ fontSize: 12.5, color: T.warn }}>A data de início é posterior à data de fim.</div>
      ) : dates.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim }}>Escolhe uma data de início e uma data de fim.</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 10 }}>
            {formatShortDatePt(dates[0])} a {formatShortDatePt(dates[dates.length - 1])} · {dates.length} {dates.length === 1 ? 'dia' : 'dias'}.
            Dias sem resposta não entram na média.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th3}>Jogador</th>
                  <th style={th3}>Wellness (média)</th>
                  <th style={th3}>Wellness (evolução)</th>
                  <th style={th3}>PSE treino</th>
                  <th style={th3}>PSE jogo</th>
                  <th style={th3}>PSE (evolução)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const wColor = r.wellnessMean === null ? T.mutedDim : r.wellnessMean >= 3.5 ? T.good : r.wellnessMean >= 2.2 ? T.warn : T.bad;
                  return (
                    <tr key={r.player.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                      <td style={{ ...td3, color: T.cream, whiteSpace: 'nowrap' }}>
                        {r.player.position ? `${r.player.position} · ` : ''}{shortPlayerName(r.player, players)}
                      </td>
                      <td style={{ ...td3, ...mono, color: wColor, whiteSpace: 'nowrap' }}>
                        {r.wellnessMean === null ? '—' : r.wellnessMean.toFixed(1)}
                        <span style={{ color: T.mutedDim, fontSize: 11 }}> {r.wellnessCount ? `(${r.wellnessCount})` : ''}</span>
                      </td>
                      <td style={td3}>
                        <Sparkline points={r.wellnessDaily} labels={dates} min={1} max={5} color={T.good} unit="/5" mainLabel="wellness" />
                      </td>
                      <td style={{ ...td3, ...mono, color: r.pseTreinoMean === null ? T.mutedDim : T.warn, whiteSpace: 'nowrap' }}>
                        {r.pseTreinoMean === null ? '—' : r.pseTreinoMean.toFixed(1)}
                        <span style={{ color: T.mutedDim, fontSize: 11 }}> {r.pseTreinoDaily.filter(v => typeof v === 'number').length ? `(${r.pseTreinoDaily.filter(v => typeof v === 'number').length})` : ''}</span>
                      </td>
                      <td style={{ ...td3, ...mono, color: r.pseJogoMean === null ? T.mutedDim : T.crimsonBright, whiteSpace: 'nowrap' }}>
                        {r.pseJogoMean === null ? '—' : r.pseJogoMean.toFixed(1)}
                        <span style={{ color: T.mutedDim, fontSize: 11 }}> {r.pseJogoDaily.filter(v => typeof v === 'number').length ? `(${r.pseJogoDaily.filter(v => typeof v === 'number').length})` : ''}</span>
                      </td>
                      <td style={td3}>
                        {/* Duas séries no mesmo gráfico: treino a laranja,
                            jogo a vermelho, para se ver a alternância. */}
                        <Sparkline
                          points={r.pseTreinoDaily} extraPoints={r.pseJogoDaily} extraColor={T.crimsonBright}
                          labels={dates} min={0} max={10} color={T.warn}
                          unit="/10" extraLabel="jogo" mainLabel="treino"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 10, lineHeight: 1.5 }}>
            Escala fixa: Wellness 1–5, PSE 0–10 — as linhas são comparáveis entre jogadores.
            O número entre parênteses é quantos dias tiveram resposta.
          </div>
        </>
      )}
    </Panel>
  );
}

