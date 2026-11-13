// plantel/Composicao.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, mono, body, TEXT_ON_ACCENT } from '../base/tema';
import { todayStr, addDays, fmtDate, formatShortDatePt } from '../base/utilidades';
import { removeWithUndo, Panel, EmptyState, FIELD_GRID, Field, Input, FIELD_FULL, Btn } from '../base/ui';
import { useState } from 'react';
import { sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { Plus, Trash2 } from 'lucide-react';
import { tdStyle } from './comum';
import { Sparkline } from './Historico';

/* ---------------------------------------------------------------
   COMPOSIÇÃO CORPORAL — bioimpedância

   Vive dentro de Monitorização, ao lado do Wellness/PSE, porque é a
   mesma ideia: uma métrica física que se repete ao longo do tempo,
   não um valor único de ficha (esse continua no Plantel — Peso/Altura
   — como referência pontual).

   Guarda-se na MESMA coleção `monitoring`, só que com `type:
   'composicao'` em vez de 'wellness' ou 'rpe' — mesmo mecanismo de
   gravação, mesmo "Registo manual" (ManualCheckinBoard), sem tabela
   nova nem sincronização nova.

   SEM CALENDÁRIO RÍGIDO: cada pesagem é um registo datado como outro
   qualquer — "+ Nova pesagem" abre o quadro do plantel e pesa-se quem
   se quiser nesse dia. Um atleta pode ter pesagens de 2 em 2 semanas,
   outro uma vez por mês; a cadência não está em lado nenhum da
   estrutura de dados, só nas datas que cada registo tiver.

   O que SÓ esta vista acrescenta é o indicador de atraso por jogador
   (abaixo, `ccEstado`): como a cadência é ao critério do treinador e
   não uma regra da app, o que interessa mostrar não é "está em falta
   segundo o calendário" mas sim "há quanto tempo não é pesado" — para
   não se perder o fio à meada de quem está a ficar para trás.
---------------------------------------------------------------- */
// Limiares só para colorir o indicador — não impõem periodicidade
// nenhuma aos registos, servem apenas para chamar a atenção quando uma
// pesagem começa a ficar velha.
export const CC_DIAS_ATENCAO = 21;

export const CC_DIAS_ATRASO = 35;

export function ccEstado(dias) {
  if (dias === null) return { label: 'Sem registo', color: T.mutedDim };
  if (dias <= CC_DIAS_ATENCAO) return { label: 'Em dia', color: T.good };
  if (dias <= CC_DIAS_ATRASO) return { label: 'A repetir em breve', color: T.warn };
  return { label: 'Em atraso', color: T.bad };
}

export function ComposicaoCorporal({ players, monitoring, setMonitoring, onNovaPesagem }) {
  const todayDateStr = todayStr();
  const pesagens = monitoring.filter(m => typeof m.peso === 'number');
  const remove = (id) => removeWithUndo(monitoring, setMonitoring, id, 'Registo de composição corporal');

  const registosDe = (playerId) => pesagens
    .filter(m => m.playerId === playerId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const [deData, setDeData] = useState(addDays(todayDateStr, -89));
  const [ateData, setAteData] = useState(todayDateStr);
  const dentroDoIntervalo = (d) => !!d && (!deData || d >= deData) && (!ateData || d <= ateData);

  const sorted = [...pesagens]
    .filter(m => dentroDoIntervalo(m.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date) || String(a.playerId).localeCompare(String(b.playerId)));

  return (
    <>
      {players.length > 0 && (
        <Panel title="Plantel — estado atual">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={th2Style}>Estado</th>
                  <th style={th2Style}>Jogador</th>
                  <th style={th2Style}>Última pesagem</th>
                  <th style={th2Style}>Peso</th>
                  <th style={th2Style}>Massa gorda</th>
                  <th style={th2Style}>Massa muscular</th>
                </tr>
              </thead>
              <tbody>
                {sortByPosition(players).map(p => {
                  const regs = registosDe(p.id);
                  const ultimo = regs[0] || null;
                  const dias = ultimo ? Math.round((new Date(todayDateStr) - new Date(ultimo.date)) / 86400000) : null;
                  const estado = ccEstado(dias);
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                      <td style={td2Style}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: estado.color, display: 'inline-block' }} />
                          {estado.label}
                        </span>
                      </td>
                      <td style={{ ...td2Style, color: T.cream }} title={p.name}>{p.position ? `${p.position} · ` : ''}{shortPlayerName(p, players)}</td>
                      <td style={{ ...td2Style, ...mono }}>{ultimo ? `${fmtDate(ultimo.date)} · há ${dias} ${dias === 1 ? 'dia' : 'dias'}` : '—'}</td>
                      <td style={{ ...td2Style, ...mono }}>{ultimo ? `${ultimo.peso} kg` : '—'}</td>
                      <td style={{ ...td2Style, ...mono }}>{ultimo && typeof ultimo.massaGorda === 'number' ? `${ultimo.massaGorda}%` : '—'}</td>
                      <td style={{ ...td2Style, ...mono }}>{ultimo && typeof ultimo.massaMuscular === 'number' ? `${ultimo.massaMuscular}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {players.length === 0 ? (
        <EmptyState text="Adiciona jogadores no Plantel antes de registar pesagens." />
      ) : (
        <>
          <div style={{ ...FIELD_GRID, marginTop: 28, marginBottom: 14 }}>
            <Field label="Data de início">
              <Input type="date" value={deData} max={ateData || undefined} onChange={e => setDeData(e.target.value)} />
            </Field>
            <Field label="Data de fim">
              <Input type="date" value={ateData} min={deData || undefined} onChange={e => setAteData(e.target.value)} />
            </Field>
            <div style={{ ...FIELD_FULL, display: 'flex', gap: 6 }}>
              {[['30 dias', 29], ['90 dias', 89], ['6 meses', 181], ['1 ano', 365]].map(([label, back]) => {
                const ativo = deData === addDays(todayDateStr, -back) && ateData === todayDateStr;
                return (
                  <button
                    key={label}
                    onClick={() => { setDeData(addDays(todayDateStr, -back)); setAteData(todayDateStr); }}
                    style={{
                      flex: 1, height: 38, padding: '0 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', ...body,
                      background: ativo ? '#B5393F' : 'transparent',
                      color: ativo ? TEXT_ON_ACCENT : T.muted,
                      border: `1px solid ${ativo ? '#B5393F' : T.line}`,
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.mutedDim, margin: '0 0 10px' }}>
            {formatShortDatePt(deData)} a {formatShortDatePt(ateData)} · {sorted.length} {sorted.length === 1 ? 'pesagem' : 'pesagens'}
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              text={`Sem pesagens entre ${formatShortDatePt(deData)} e ${formatShortDatePt(ateData)}.`}
              action={<Btn onClick={onNovaPesagem}><Plus size={15} /> Nova pesagem</Btn>}
            />
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${T.line}`, borderRadius: 10 }}>
              <table>
                <thead>
                  <tr style={{ background: T.surface }}>
                    {['Data', 'Jogador', 'Peso', 'Massa gorda', 'Massa muscular', 'Água', 'Notas', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(m => {
                    const p = players.find(pl => pl.id === m.playerId);
                    return (
                      <tr key={m.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                        <td style={tdStyle}>{fmtDate(m.date)}</td>
                        <td style={{ ...tdStyle, color: T.cream }} title={p ? p.name : undefined}>{p ? `${p.position ? `${p.position} · ` : ''}${shortPlayerName(p, players)}` : '—'}</td>
                        <td style={{ ...tdStyle, ...mono }}>{m.peso} kg</td>
                        <td style={{ ...tdStyle, ...mono }}>{typeof m.massaGorda === 'number' ? `${m.massaGorda}%` : '—'}</td>
                        <td style={{ ...tdStyle, ...mono }}>{typeof m.massaMuscular === 'number' ? `${m.massaMuscular}%` : '—'}</td>
                        <td style={{ ...tdStyle, ...mono }}>{typeof m.agua === 'number' ? `${m.agua}%` : '—'}</td>
                        <td style={tdStyle}>{m.notasComposicao || '—'}</td>
                        <td style={tdStyle}>
                          <button onClick={() => remove(m.id)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Mesmo espaço entre cartões que no resto da Monitorização. */}
      {players.length > 0 && pesagens.length > 0 && <div style={{ height: 16 }} />}
      {players.length > 0 && <ComposicaoHistorico players={players} monitoring={pesagens} />}
    </>
  );
}

export const th2Style = { textAlign: 'left', padding: '9px 12px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` };

export const td2Style = { padding: '9px 12px', fontSize: 13, color: T.mutedDim };

/* Evolução por jogador ao longo das pesagens reais (não um calendário
   diário como o Wellness/PSE — aqui os intervalos são irregulares por
   natureza, por isso o eixo é feito só das datas em que HOUVE pesagem). */
export function ComposicaoHistorico({ players, monitoring }) {
  const datas = [...new Set(monitoring.map(m => m.date))].sort((a, b) => new Date(a) - new Date(b));
  if (!datas.length) return null;

  const rows = sortByPosition(players).map(p => {
    const porData = new Map(monitoring.filter(m => m.playerId === p.id).map(m => [m.date, m]));
    const pesoSeries = datas.map(d => (porData.has(d) ? porData.get(d).peso : null));
    const gorduraSeries = datas.map(d => (porData.has(d) && typeof porData.get(d).massaGorda === 'number' ? porData.get(d).massaGorda : null));
    const count = pesoSeries.filter(v => typeof v === 'number').length;
    return { player: p, pesoSeries, gorduraSeries, count };
  }).filter(r => r.count > 0);

  if (!rows.length) return null;

  const numeros = (arr) => arr.filter(v => typeof v === 'number');

  return (
    <Panel title="Evolução — peso e massa gorda">
      <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 10 }}>
        {datas.length} {datas.length === 1 ? 'data' : 'datas'} com pesagens, de {formatShortDatePt(datas[0])} a {formatShortDatePt(datas[datas.length - 1])}.
        Só entram jogadores com pelo menos uma pesagem no período selecionado acima.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th2Style, whiteSpace: 'nowrap' }}>Jogador</th>
              <th style={{ ...th2Style, whiteSpace: 'nowrap' }}>Peso (evolução)</th>
              <th style={{ ...th2Style, whiteSpace: 'nowrap' }}>Massa gorda (evolução)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const pesosValidos = numeros(r.pesoSeries);
              const gorduraValida = numeros(r.gorduraSeries);
              return (
                <tr key={r.player.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ ...td2Style, color: T.cream, whiteSpace: 'nowrap' }}>
                    {r.player.position ? `${r.player.position} · ` : ''}{shortPlayerName(r.player, players)}
                  </td>
                  <td style={td2Style}>
                    <Sparkline
                      points={r.pesoSeries} labels={datas}
                      min={Math.floor(Math.min(...pesosValidos) - 1)} max={Math.ceil(Math.max(...pesosValidos) + 1)}
                      color={T.good} unit=" kg" mainLabel="peso"
                    />
                  </td>
                  <td style={td2Style}>
                    {gorduraValida.length > 0 ? (
                      <Sparkline
                        points={r.gorduraSeries} labels={datas}
                        min={Math.floor(Math.min(...gorduraValida) - 1)} max={Math.ceil(Math.max(...gorduraValida) + 1)}
                        color={T.warn} unit="%" mainLabel="massa gorda"
                      />
                    ) : <span style={{ fontSize: 11.5, color: T.mutedDim, ...mono }}>sem dados</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

