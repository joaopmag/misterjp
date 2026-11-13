// tarefas/TarefaModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import { useState } from 'react';
import { uid, fmtShort, addDays, todayStr, fmtDate } from '../base/utilidades';
import { useFecharSemSaltar } from '../treino/comum';
import { sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { Modal, Field, Input, FIELD_GRID, Select, TextArea, Btn } from '../base/ui';
import { getMonday } from '../treino/Planeamento';
import { T, body, TEXT_ON_ACCENT, mono } from '../base/tema';
import { Check, X, Plus, Trash2 } from 'lucide-react';
import { DESTINOS_MISSAO, DIAS_SEMANA, MAX_MISSOES_ABERTAS, RECORRENCIA_LABEL, destinoMissao, diaDaSemanaDe, inferirDestinoMissao, missoesPorFazerDe, tituloDasMissoes } from './regras';
import { nomeDoMembro } from '../gestao/membros';

export function TarefaModal({ tarefa, inicial, ocorrencia, podeConcluir = true, membros, players, euId, tarefas = [], onClose, onSave, onRemove }) {
  const [f, setF] = useState(tarefa || {
    titulo: '', notas: '', responsavel: euId || '', prazo: '', estado: 'aberta', recorrencia: null, jogadorId: '',
    ...(inicial || {}),
  });
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_tarefa_${tarefa?.id || 'novo'}`, f, setF);
  /* VÁRIAS MISSÕES NA MESMA TAREFA. Uma tarefa para um jogador pode ter
     vários passos (ex.: 1. fazer a autoavaliação, 2. ver o vídeo do jogo,
     3. responder ao Wellness amanhã) — cada um com o seu destino e as suas
     INSTRUÇÕES. No Portal, cada passo é uma folha da prancheta; a tarefa
     fecha quando o último estiver feito. Tarefas antigas (um só destino)
     viram uma lista com um passo. */
  const missoesIniciais = () => {
    if (Array.isArray(f.missoes) && f.missoes.length) return f.missoes;
    return [{ id: uid(), destino: f.destino || inferirDestinoMissao(`${f.titulo || ''} ${f.notas || ''}`) || 'nota', instrucoes: '' }];
  };
  const missoes = missoesIniciais();
  /* Mudar as missões atualiza "O que é preciso fazer", mas só se o campo
     estiver vazio ou ainda tiver o texto que foi a app a pôr (`tituloAuto`).
     O que o treinador escreveu à mão nunca é apagado. */
  const setMissoes = (lista) => setF(prev => {
    const novo = { ...prev, missoes: lista, destino: (lista[0] && lista[0].destino) || 'nota' };
    const atual = String(prev.titulo || '').trim();
    const sugerido = tituloDasMissoes(lista);
    // Também conta como "automático" um título que seja só o nome de um tema
    // ("Autoavaliação", "Vídeos") ou o que as missões anteriores davam.
    const eAuto = !atual || atual === prev.tituloAuto
      || atual === tituloDasMissoes(prev.missoes || [])
      || DESTINOS_MISSAO.some(d => d.rotulo.toLowerCase() === atual.toLowerCase() || d.acao.toLowerCase() === atual.toLowerCase());
    if (sugerido && eAuto) { novo.titulo = sugerido; novo.tituloAuto = sugerido; }
    return novo;
  });
  const mudarMissao = (k, alteracao) => setMissoes(missoes.map((m, j) => (j === k ? { ...m, ...alteracao } : m)));
  // Tirar um passo não faz a página saltar (ver useFecharSemSaltar).
  const [fecharSemSaltar, espacoSemSaltar] = useFecharSemSaltar();
  const repete = !!f.recorrencia;
  const jogadoresOrdenados = sortByPosition(players || []);
  /* Missões em aberto do jogador NAS OUTRAS tarefas (esta não conta, senão
     contava-se duas vezes). */
  const abertasNoutras = (jogId) => (tarefas || [])
    .filter(t => t.jogadorId === jogId && (!tarefa || t.id !== tarefa.id))
    .reduce((n, t) => n + missoesPorFazerDe(t), 0);
  const abertasFora = f.jogadorId ? abertasNoutras(f.jogadorId) : 0;
  const pendentesAqui = f.jogadorId ? missoesPorFazerDe({ ...f, jogadorId: f.jogadorId, estado: f.estado, missoes }) : 0;
  // Quantas este jogador ainda pode ter nesta tarefa.
  const lugaresLivres = Math.max(0, MAX_MISSOES_ABERTAS - abertasFora);
  // Uma tarefa antiga que já passava do limite pode ser gravada como está,
  // só não pode crescer.
  const pendentesOriginais = (tarefa && tarefa.jogadorId === f.jogadorId) ? missoesPorFazerDe(tarefa) : 0;
  const passaLimite = !repete && !!f.jogadorId && pendentesAqui > lugaresLivres && pendentesAqui > pendentesOriginais;
  const podeAcrescentar = missoes.length < MAX_MISSOES_ABERTAS && pendentesAqui < lugaresLivres;
  const nomeJogador = f.jogadorId ? shortPlayerName((players || []).find(p => p.id === f.jogadorId) || {}, players) : '';
  const valido = String(f.titulo || '').trim().length > 0 && !passaLimite;

  return (
    <Modal title={tarefa ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose} fullPage larguraMax={1100}>
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      {/* DUAS COLUNAS — à esquerda a tarefa; à direita o jogador e as
          missões dele. Mais larga e mais baixa: cabe sem scroll. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, alignItems: 'start' }}>
      <div>
      <div style={{ marginBottom: 14 }}>
        <Field label="O que é preciso fazer" bloco solto>
          <Input
            value={f.titulo}
            onChange={e => {
              const titulo = e.target.value;
              // Destino sugerido pelo título, enquanto não for escolhido à mão.
              const sug = !f.destinoManual ? inferirDestinoMissao(titulo) : null;
              // Sugere o destino do 1.º passo, enquanto não for escolhido à mão.
              const lista = missoesIniciais();
              const novaLista = !f.destinoManual && lista.length === 1 ? [{ ...lista[0], destino: sug || 'nota' }] : lista;
              setF({ ...f, titulo, tituloAuto: titulo === f.tituloAuto ? f.tituloAuto : '', missoes: novaLista, destino: novaLista[0].destino });
            }}
            placeholder="Ex: análise de adversário"
            autoFocus
          />
        </Field>
      </div>

      <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
        {/* Quem não pode concluir também não muda o responsável: senão
            bastava atribuir a tarefa a si próprio para a fechar. */}
        <Field label="Responsável">
          <Select value={f.responsavel} onChange={e => setF({ ...f, responsavel: e.target.value })} disabled={!podeConcluir}>
            <option value="">Sem responsável</option>
            {(membros || []).map(m => (
              <option key={m.user_id} value={m.user_id}>{nomeDoMembro(m.user_id, membros, euId)}</option>
            ))}
          </Select>
        </Field>
        {/* Uma tarefa recorrente não tem prazo fixo — é a regra de
            repetição que diz em que dias ela existe. Os dois campos
            trocam de sítio consoante "Repete".  */}
        {!repete && (
          <Field label="Prazo">
            <Input type="date" value={f.prazo} onChange={e => setF({ ...f, prazo: e.target.value })} />
          </Field>
        )}
        <Field label="Estado">
          <Select
            value={f.estado}
            onChange={e => setF({ ...f, estado: e.target.value })}
            // Sem permissão para concluir, também não se reabre uma concluída.
            disabled={!podeConcluir && f.estado === 'feita'}
          >
            <option value="aberta">Por fazer</option>
            <option value="curso">Iniciada</option>
            <option value="feita" disabled={!podeConcluir}>Concluída{!podeConcluir ? ' (só o responsável)' : ''}</option>
          </Select>
        </Field>
      </div>

      {/* SÓ ESTA SEMANA — aparece quando a tarefa semanal foi aberta a
          partir de um dia do Calendário. Muda o dia só dessa ocorrência
          (`recorrencia.mudancas`), sem tocar na regra. É também a forma
          de o fazer no telemóvel, onde não há arrastar. */}
      {ocorrencia && repete && f.recorrencia.tipo === 'semanal' && (() => {
        const seg = getMonday(ocorrencia.base);
        const atual = ((f.recorrencia.mudancas || {})[ocorrencia.base]) || ocorrencia.base;
        return (
          <div style={{ border: `1px solid ${T.gold}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <Field label={`Só esta semana (dia habitual: ${DIAS_SEMANA[diaDaSemanaDe(ocorrencia.base)]}, ${fmtShort(ocorrencia.base)})`} solto>
              <Select
                value={atual}
                onChange={e => {
                  const novo = e.target.value;
                  const mudancas = { ...(f.recorrencia.mudancas || {}) };
                  if (novo === ocorrencia.base) delete mudancas[ocorrencia.base];
                  else mudancas[ocorrencia.base] = novo;
                  setF({ ...f, recorrencia: { ...f.recorrencia, mudancas } });
                }}
              >
                {[...Array(7)].map((_, i) => {
                  const d = addDays(seg, i);
                  return <option key={d} value={d}>{DIAS_SEMANA[diaDaSemanaDe(d)]}, {fmtShort(d)}{d === ocorrencia.base ? ' (habitual)' : ''}</option>;
                })}
              </Select>
            </Field>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, lineHeight: 1.5 }}>
              Nas outras semanas continua no dia habitual.
            </div>
          </div>
        );
      })()}

      {/* REPETIR TODAS AS SEMANAS NESTE DIA — o atalho para o caso mais
          comum na equipa técnica ("observar o adversário é sempre à
          quinta"). Marcar converte a tarefa numa repetição "Dias da
          semana" só com esse dia, a começar na data escolhida
          (`recorrencia.desde`), e ela passa a aparecer no Calendário todas
          as semanas. Desfaz-se em "Repete" > "Não repete", que devolve a
          data original. */}
      {!repete && f.prazo && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: -4, marginBottom: 16, fontSize: 13, color: T.cream, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={false}
            onChange={() => setF({
              ...f, prazo: '',
              recorrencia: { tipo: 'semanal', dias: [new Date(`${f.prazo}T00:00:00`).getDay()], desde: f.prazo },
            })}
            style={{ accentColor: T.crimson, width: 16, height: 16 }}
          />
          Repetir todas as semanas à {DIAS_SEMANA[new Date(`${f.prazo}T00:00:00`).getDay()]}
        </label>
      )}

      {/* ATRIBUIR A UM JOGADOR — de propósito, num campo à parte do
          "Responsável" (que é sempre alguém da equipa técnica). Uma
          tarefa pode ter as duas coisas ao mesmo tempo: um membro do
          staff responsável por acompanhar, e um jogador a quem a
          tarefa diz respeito e que a vai ver no Portal do Atleta. */}
      {/* REPETIÇÃO — ver a nota completa junto de `tarefaAtivaHoje`.
          Resumo rápido: escolhida uma regra, a tarefa passa a aparecer
          sozinha em "Hoje" sempre que essa regra estiver ativa, e a
          conclusão marca-se só para esse dia — no dia seguinte, se a
          regra voltar a estar ativa, reaparece por fazer sozinha. */}
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Field label="Repete">
          <Select
            value={f.recorrencia ? f.recorrencia.tipo : ''}
            onChange={e => {
              const tipo = e.target.value;
              // Ao deixar de repetir, a tarefa volta a ter o dia em que
              // a repetição começou (se o houver), em vez de ficar sem dia.
              if (!tipo) { setF({ ...f, prazo: (f.recorrencia && f.recorrencia.desde) || f.prazo || '', recorrencia: null }); return; }
              // Uma tarefa que se repete não vai para o Portal: o jogador só tem
              // uma resposta, e ela aparecia em todos os dias da repetição.
              setF({
                ...f, prazo: '', jogadorId: '',
                recorrencia: {
                  tipo,
                  dias: (f.recorrencia && f.recorrencia.dias) || [1, 2, 3, 4, 5],
                  desde: (f.recorrencia && f.recorrencia.desde) || f.prazo || todayStr(),
                },
              });
            }}
          >
            <option value="">Não repete — só esta vez</option>
            {Object.entries(RECORRENCIA_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </Field>
        {repete && f.recorrencia.tipo === 'semanal' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {DIAS_SEMANA.map((nome, i) => {
              const on = (f.recorrencia.dias || []).includes(i);
              return (
                <button
                  key={i} type="button"
                  onClick={() => {
                    const dias = on ? f.recorrencia.dias.filter(d => d !== i) : [...f.recorrencia.dias, i];
                    setF({ ...f, recorrencia: { ...f.recorrencia, dias } });
                  }}
                  style={{
                    padding: '6px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', ...body,
                    background: on ? T.crimson : 'transparent', color: on ? TEXT_ON_ACCENT : T.mutedDim,
                    border: `1px solid ${on ? T.crimson : T.line}`, textTransform: 'capitalize',
                  }}
                >{nome.slice(0, 3)}</button>
              );
            })}
          </div>
        )}
        {repete && (
          <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 10, lineHeight: 1.5 }}>
            {f.recorrencia.tipo === 'treino_jogo' && 'Aparece sozinha em qualquer dia com treino ou jogo marcado.'}
            {f.recorrencia.tipo === 'wellness_pse' && 'Aparece sozinha enquanto houver algum jogador por responder ao Wellness (ou ao PSE, em dia de treino/jogo). Desaparece assim que todos tiverem respondido.'}
            {f.recorrencia.tipo === 'diaria' && 'Aparece todos os dias, sem exceção.'}
            {f.recorrencia.tipo === 'semanal' && ((f.recorrencia.dias || []).length
              ? `Aparece no Calendário todas as semanas, nos dias escolhidos${f.recorrencia.desde ? `, a partir de ${fmtShort(f.recorrencia.desde)}` : ''}. Cada semana fica por fazer, e a notificar o responsável, até ser concluída.`
              : 'Escolhe pelo menos um dia da semana.')}
            {f.recorrencia.tipo === 'aniversario' && 'Aparece sozinha em qualquer dia em que um jogador do plantel faça anos (precisa da data de nascimento completa, em Editar Jogador — registos com só o ano não contam).'}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Field label="Notas" bloco solto>
          <TextArea
            value={f.notas}
            onChange={e => setF({ ...f, notas: e.target.value })}
            placeholder="Detalhes, links, o que for preciso saber para fazer isto."
            style={{ minHeight: 72 }}
          />
        </Field>
      </div>

      {/* NOTA DO JOGADOR — só leitura aqui do lado do staff. É o atleta
          quem escreve isto no Portal; aqui serve só para veres o que ele
          respondeu, sem correres o risco de sobrescrever por engano. */}
      {f.jogadorId && f.notaAtleta && (
        <div style={{ marginBottom: 16 }}>
          <Field label={`Nota de ${shortPlayerName((players || []).find(p => p.id === f.jogadorId) || {}, players)}`} solto>
            <div style={{
              background: T.bg, border: `1px solid ${f.notaSubmetida ? T.good : T.line}`, borderRadius: 8, padding: '10px 12px',
              fontSize: 13, color: T.cream, whiteSpace: 'pre-wrap', lineHeight: 1.5,
            }}>{f.notaAtleta}</div>
          </Field>
          <div style={{ fontSize: 11.5, color: f.notaSubmetida ? T.good : T.mutedDim, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            {f.notaSubmetida ? <><Check size={12} /> Submetida{f.notaSubmetidaEm ? ` em ${fmtDate(f.notaSubmetidaEm.slice(0, 10))}` : ''} — o jogador já não a pode editar.</> : 'Ainda por submeter — o jogador pode continuar a editar.'}
          </div>
        </div>
      )}

      </div>
      <div>
        {repete ? (
          <div style={{ fontSize: 12, color: T.mutedDim, lineHeight: 1.5 }}>
            {f.jogadorId
              ? `Esta tarefa estava atribuída a ${shortPlayerName((players || []).find(p => p.id === f.jogadorId) || {}, players)}. Tarefas que se repetem não podem ir para o Portal do Atleta: ao guardar, deixa de estar atribuída a um jogador.`
              : 'Tarefas que se repetem ficam só para a equipa técnica. Para dar uma missão a um jogador, cria uma tarefa que não se repete.'}
          </div>
        ) : (<>
        <div style={{ marginBottom: 14 }}>
          <Field label="Atribuir a um jogador (aparece no Portal do Atleta)" solto>
            <Select value={f.jogadorId || ''} onChange={e => setF({ ...f, jogadorId: e.target.value })}>
              <option value="">Nenhum — só uma tarefa interna</option>
              {jogadoresOrdenados.map(p => (
                <option key={p.id} value={p.id}>{p.position || '--'} · {shortPlayerName(p, players)}{p.id !== f.jogadorId && abertasNoutras(p.id) >= MAX_MISSOES_ABERTAS ? ` (já tem ${MAX_MISSOES_ABERTAS} missões em aberto)` : ''}</option>
              ))}
            </Select>
          </Field>
        </div>
        {f.jogadorId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11.5, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Missões para o jogador {missoes.length > 1 ? `· ${missoes.length} passos` : ''}
            </div>
            {missoes.map((m, k) => {
              const d = destinoMissao(m.destino);
              return (
                <div key={m.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, background: T.bg }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', background: T.crimson, color: TEXT_ON_ACCENT, fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...mono,
                    }}>{k + 1}</span>
                    <span style={{ fontSize: 13, color: T.cream, fontWeight: 600 }}>{d.id === 'nota' ? 'Responder por escrito' : d.rotulo}</span>
                    {missoes.length > 1 && (
                      <button type="button" onClick={(e) => fecharSemSaltar(e.currentTarget, () => setMissoes(missoes.filter((_, j) => j !== k)))} title="Tirar este passo"
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 2, display: 'flex' }}><X size={15} /></button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {DESTINOS_MISSAO.map(dd => {
                      const on = m.destino === dd.id;
                      const Ic = dd.icon;
                      return (
                        <button key={dd.id} type="button" onClick={() => { mudarMissao(k, { destino: dd.id }); setF(prev => ({ ...prev, destinoManual: true })); }} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 16, cursor: 'pointer', ...body,
                          fontSize: 11.5, background: on ? T.crimson : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
                          border: `1px solid ${on ? T.crimson : T.line}`,
                        }}><Ic size={12} />{dd.rotulo}</button>
                      );
                    })}
                  </div>
                  <TextArea
                    value={m.instrucoes || ''}
                    onChange={e => mudarMissao(k, { instrucoes: e.target.value })}
                    placeholder={d.id === 'autoavaliacao' ? 'Instruções (ex.: responde com calma, pensa nos últimos jogos)'
                      : d.id === 'biblioteca' ? 'Instruções (ex.: vê o corte da pressão alta e repara no teu posicionamento)'
                      : d.id === 'clipe' ? 'Instruções (ex.: no jogo de sábado, corta um lance em que pressionaste bem)'
                        : d.id === 'nota' ? 'O que queres que o jogador te responda'
                          : 'Instruções para este passo (opcional)'}
                    style={{ minHeight: 54, fontSize: 13 }}
                  />
                  <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 6, lineHeight: 1.4 }}>
                    {d.id === 'clipe' ? `Botão "${d.acao}" — o passo só fica feito quando ele gravar um clipe.`
                      : d.auto ? `Botão "${d.acao}" — o passo fica feito quando ele submeter.`
                      : d.id !== 'nota' ? `Botão "${d.acao}" — leva-o lá e fica registado que abriu.`
                        : 'Ele responde por escrito.'}
                  </div>
                </div>
              );
            })}
            {passaLimite ? (
              <div style={{ border: `1px solid ${T.warn}`, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: T.warn, lineHeight: 1.5 }}>
                {abertasFora >= MAX_MISSOES_ABERTAS
                  ? `${nomeJogador} já tem ${MAX_MISSOES_ABERTAS} missões em aberto noutras tarefas. Só pode ter ${MAX_MISSOES_ABERTAS} ao mesmo tempo: espera que conclua uma, ou apaga uma delas, antes de lhe dares esta.`
                  : `${nomeJogador} já tem ${abertasFora} ${abertasFora === 1 ? 'missão' : 'missões'} em aberto noutra tarefa, por isso aqui só cabe ${lugaresLivres}. Tira um passo para poderes guardar.`}
              </div>
            ) : podeAcrescentar ? (
              <button type="button" onClick={() => setMissoes([...missoes, { id: uid(), destino: 'nota', instrucoes: '' }])} style={{
                border: `1px dashed ${T.line}`, background: 'transparent', color: T.muted, borderRadius: 10, padding: '9px 12px',
                cursor: 'pointer', fontSize: 12.5, ...body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}><Plus size={14} /> Acrescentar outra missão para o mesmo jogador</button>
            ) : (
              <div style={{ fontSize: 11.5, color: T.mutedDim, lineHeight: 1.5 }}>
                {abertasFora > 0
                  ? `${nomeJogador} já tem ${abertasFora} ${abertasFora === 1 ? 'missão' : 'missões'} em aberto noutra tarefa. Máximo de ${MAX_MISSOES_ABERTAS} ao mesmo tempo.`
                  : `Máximo de ${MAX_MISSOES_ABERTAS} missões em aberto ao mesmo tempo por jogador.`}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: T.mutedDim, lineHeight: 1.5 }}>
            Escolhe um jogador para lhe dares missões — cada uma com o seu destino (autoavaliação, treino, vídeo…) e as suas instruções. Máximo de {MAX_MISSOES_ABERTAS} em aberto ao mesmo tempo por jogador.
          </div>
        )}
        </>)}
      </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        {onRemove && <Btn variant="danger" onClick={onRemove} style={{ marginRight: 'auto' }}><Trash2 size={15} /> Apagar</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={() => {
          if (!valido) return;
          limpar();
          // As missões gravam-se sempre que há jogador (mesmo sem lhes mexer).
          const { destinoManual, tituloAuto, ...resto } = f; // eslint-disable-line no-unused-vars
          if (repete) {
            // Limpa também o que ficou de uma atribuição antiga a um jogador
            // (a resposta dele era uma só e aparecia em todos os dias).
            onSave({ ...resto, jogadorId: '', missoes: undefined, destino: undefined, notaAtleta: '', notaSubmetida: false, notaSubmetidaEm: null, notaRevista: false });
            return;
          }
          onSave(f.jogadorId ? { ...resto, missoes, destino: (missoes[0] && missoes[0].destino) || 'nota' } : resto);
        }} disabled={!valido}>Guardar</Btn>
      </div>
      {espacoSemSaltar}
    </Modal>
  );
}

