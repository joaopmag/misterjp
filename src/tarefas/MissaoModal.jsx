// tarefas/MissaoModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useRef } from 'react';
import { uid, todayStr, fmtShort } from '../base/utilidades';
import { useFecharSemSaltar, GRUPOS_POSICAO_PRINT } from '../treino/comum';
import { sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { useIsMobile, Modal, Field, Input, Select, TextArea, Btn } from '../base/ui';
import { body, T, TEXT_ON_ACCENT } from '../base/tema';
import { UserCheck, Users, Flag, X, ArrowRight, Plus, CheckCircle2, Trash2 } from 'lucide-react';
import { ListaMultipla, irParaSeparador } from '../base/ui-extra';
import { LINHAS } from '../dominio/plantel';
import { CAMINHO_DA_RECORRENCIA, DESTINOS_MISSAO, DIAS_SEMANA, MAX_MISSOES_ABERTAS, RECORRENCIAS_SO_STAFF, RECORRENCIA_LABEL, destinoMissao, missoesPorFazerDe } from './regras';
import { corDoMembro, nomeDoMembro, registarCoresMembros } from '../gestao/membros';
import { CAMINHOS_STAFF, CRITERIO_STAFF, caminhoStaff, feitaNoGrupo } from './missoesRegras';

export function MissaoModal({ alvo, inicial, ocorrencia, membros, players, euId, tarefas = [], matches = [], podeConcluir = true, podeGerir = true, onClose, onGuardar, onRemove, onAbrirRegisto }) {
  const registos = alvo ? (alvo._grupo || [alvo]) : [];
  const base = registos[0] || null;
  const editar = !!base;
  const emGrupo = registos.length > 1;
  const [modo, setModo] = useState(base ? (base.jogadorId ? 'jogadores' : 'staff') : ((inicial && inicial.modo) || 'staff'));
  const [dest, setDest] = useState(() => (base
    ? registos.map(r => (r.jogadorId ? r.jogadorId : (r.responsavel || ''))).filter(Boolean)
    : (euId ? [euId] : [])));
  const [comum, setComum] = useState(() => ({
    prazo: (base ? base.prazo : (inicial && inicial.prazo)) || '',
    recorrencia: base ? (base.recorrencia || null) : ((inicial && inicial.recorrencia) || null),
    acompanha: base ? (base.jogadorId ? (base.responsavel || '') : (euId || '')) : (euId || ''),
    estado: base ? (base.estado || 'aberta') : 'aberta',
    obrigatoria: base ? !!base.obrigatoria : false,
  }));
  const blocoDe = (t) => {
    const inst = (Array.isArray(t.missoes) && t.missoes[0] && t.missoes[0].instrucoes) || t.notas || '';
    return {
      key: uid(), titulo: t.titulo || '', tituloAuto: '',
      destino: t.jogadorId ? ((Array.isArray(t.missoes) && t.missoes[0] && t.missoes[0].destino) || t.destino || 'nota') : 'nota',
      caminho: t.caminho || '', instrucoes: inst,
      jogoId: (Array.isArray(t.missoes) && t.missoes[0] && t.missoes[0].jogoId) || '',
    };
  };
  const [blocos, setBlocos] = useState(() => (base ? [blocoDe(base)] : [{
    key: uid(), titulo: (inicial && inicial.titulo) || '', tituloAuto: (inicial && inicial.titulo) || '',
    destino: 'nota', caminho: (inicial && inicial.caminho) || '', instrucoes: '',
  }]));
  const [fecharSemSaltar, espacoSemSaltar] = useFecharSemSaltar();

  const jogadoresOrdenados = sortByPosition(players || []);
  const idsRegistos = new Set(registos.map(r => r.id));
  const jaNoGrupo = (pid) => registos.some(r => r.jogadorId === pid);
  const abertasDe = (pid) => (tarefas || [])
    .filter(t => t.jogadorId === pid && !idsRegistos.has(t.id))
    .reduce((n, t) => n + missoesPorFazerDe(t), 0);
  // Quantas missões novas esta gravação dá a cada jogador.
  const novasPorJogador = editar ? 1 : blocos.length;
  const cheio = (pid) => modo === 'jogadores' && !(editar && jaNoGrupo(pid))
    && abertasDe(pid) + novasPorJogador > MAX_MISSOES_ABERTAS;

  // Quem estava escolhido em cada lado: ir à Equipa técnica e voltar aos
  // Jogadores devolve os jogadores que lá estavam (antes ficava vazio).
  const destGuardado = useRef({});
  const mudarModo = (m) => {
    if (m === modo) return;
    destGuardado.current[modo] = dest;
    setModo(m);
    setDest(destGuardado.current[m] || (m === 'staff' && euId ? [euId] : []));
    setBlocos(bs => bs.map(b => ({ ...b, ...(b.titulo === b.tituloAuto ? { titulo: '', tituloAuto: '' } : {}) })));
  };
  const alternarDest = (id) => {
    if (modo === 'jogadores' && cheio(id) && !dest.includes(id)) return;
    setDest(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };
  const [aviso, setAviso] = useState('');
  registarCoresMembros(membros);
  const estreito = useIsMobile(900);
  const colunaMissoesRef = useRef(null);
  const escolherGrupo = (posicoes) => {
    const lista = jogadoresOrdenados.filter(p => !posicoes || posicoes.includes(String(p.position || '').toUpperCase()));
    const ok = lista.filter(p => !cheio(p.id)).map(p => p.id);
    const fora = lista.filter(p => cheio(p.id));
    setDest(prev => [...new Set([...prev, ...ok])]);
    setAviso(fora.length ? `${fora.length === 1 ? 'Ficou' : 'Ficaram'} de fora ${fora.map(p => shortPlayerName(p, players)).join(', ')}: já ${fora.length === 1 ? 'tem' : 'têm'} ${MAX_MISSOES_ABERTAS} missões em aberto.` : '');
  };

  // O título preenche-se a partir do caminho enquanto não for escrito à mão.
  const mudarBloco = (k, alt) => setBlocos(bs => bs.map((b, j) => {
    if (j !== k) return b;
    const novo = { ...b, ...alt };
    const sug = modo === 'jogadores'
      ? (novo.destino && novo.destino !== 'nota' ? destinoMissao(novo.destino).acao : '')
      : (novo.caminho ? caminhoStaff(novo.caminho).acao : '');
    const atual = String(b.titulo || '').trim();
    const eAuto = !atual || atual === b.tituloAuto
      || DESTINOS_MISSAO.some(d => d.rotulo === atual || d.acao === atual)
      || CAMINHOS_STAFF.some(c => c.rotulo === atual || c.acao === atual);
    if (('destino' in alt || 'caminho' in alt) && eAuto) { novo.titulo = sug; novo.tituloAuto = sug; }
    return novo;
  }));

  const repete = !!comum.recorrencia;
  const titulosOk = blocos.every(b => String(b.titulo || '').trim());
  // Na equipa técnica pode ficar sem ninguém (fica aberta a todos, como antes).
  const destFinal = dest.length ? dest : (modo === 'staff' ? [''] : []);
  const valido = titulosOk && destFinal.length > 0 && !(repete && comum.recorrencia.tipo === 'semanal' && !(comum.recorrencia.dias || []).length);

  const guardar = () => {
    if (!valido) return;
    const agora = new Date().toISOString();
    const camposDe = (b, pessoa) => {
      const inst = String(b.instrucoes || '');
      const comuns = {
        titulo: String(b.titulo).trim(), notas: inst,
        prazo: comum.recorrencia ? '' : comum.prazo, recorrencia: comum.recorrencia,
      };
      return modo === 'jogadores'
        ? { ...comuns, jogadorId: pessoa, responsavel: comum.acompanha || euId || '', destino: b.destino || 'nota', missoes: [{ id: uid(), destino: b.destino || 'nota', instrucoes: inst, ...(b.destino === 'clipe' && b.jogoId ? { jogoId: b.jogoId } : {}) }], caminho: '' }
        : { ...comuns, jogadorId: '', responsavel: pessoa, caminho: b.caminho || '', obrigatoria: !!comum.obrigatoria, destino: undefined, missoes: undefined };
    };
    const upserts = [];
    const removidos = [];
    const dest = destFinal; // eslint-disable-line no-shadow
    if (editar && registos.length === 1 && dest.length === 1 && (modo === 'jogadores') === !!base.jogadorId) {
      // Uma missão de uma pessoa, e continua a ser de uma pessoa (mesmo
      // que outra): atualiza-se o mesmo registo, sem perder o histórico.
      upserts.push({ ...base, ...camposDe(blocos[0], dest[0]), estado: comum.estado });
    } else if (editar) {
      const b = blocos[0];
      const gid = base.grupoId || (dest.length > 1 ? uid() : null);
      const chaveDe = (r) => (r.jogadorId ? r.jogadorId : r.responsavel);
      registos.forEach(r => {
        const pessoa = chaveDe(r);
        if (!dest.includes(pessoa) || (modo === 'jogadores') !== !!r.jogadorId) { removidos.push(r.id); return; }
        const extra = !emGrupo ? { estado: comum.estado } : {};
        upserts.push({ ...r, ...camposDe(b, pessoa), ...extra, ...(gid ? { grupoId: gid } : {}), ...(ocorrencia && !emGrupo && r.recorrencia ? {} : {}) });
      });
      const existentes = new Set(registos.filter(r => !removidos.includes(r.id)).map(chaveDe));
      dest.filter(p => !existentes.has(p)).forEach(p => {
        upserts.push({ ...camposDe(b, p), estado: 'aberta', id: uid(), criadoPor: base.criadoPor || euId, criadoEm: agora, ...(gid ? { grupoId: gid } : {}) });
      });
    } else {
      blocos.forEach(b => {
        const gid = dest.length > 1 ? uid() : null;
        dest.forEach(p => upserts.push({ ...camposDe(b, p), estado: 'aberta', id: uid(), criadoPor: euId, criadoEm: agora, ...(gid ? { grupoId: gid } : {}) }));
      });
    }
    // Limpa os campos indefinidos (o staff não leva destino/missões).
    onGuardar({ upserts: upserts.map(u => Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined))), removidos });
  };

  const chip = (on, extra) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 16, cursor: 'pointer', ...body,
    fontSize: 12, background: on ? T.crimson : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
    border: `1px solid ${on ? T.crimson : T.line}`, ...(extra || {}),
  });
  const tituloModal = editar ? (emGrupo ? 'Editar missão de grupo' : 'Editar missão') : 'Nova missão';

  return (
    <Modal title={tituloModal} onClose={onClose} fullPage larguraMax={1100}>
      {/* PÁGINA FIXA: no computador, duas colunas de altura fixa, cada uma
          com o seu próprio deslizar; os botões ficam sempre no mesmo sítio,
          por baixo. No telemóvel, uma coluna e os botões presos ao fundo. */}
      <div style={{
        display: 'grid', gridTemplateColumns: estreito ? '1fr' : '1fr 1fr', gap: 22, alignItems: 'stretch',
        ...(estreito ? {} : { height: 'calc(100dvh - 190px)' }),
      }}>

        {/* ESQUERDA: para quem, quando */}
        <div style={estreito ? { order: 2 } : { overflowY: 'auto', paddingRight: 6, minHeight: 0, order: 2 }}>
          <Field label="Para quem" solto>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button type="button" onClick={() => mudarModo('jogadores')} style={chip(modo === 'jogadores')}><UserCheck size={13} /> Jogadores</button>
              <button type="button" onClick={() => mudarModo('staff')} style={chip(modo === 'staff')}><Users size={13} /> Equipa técnica</button>
            </div>
          </Field>

          {modo === 'jogadores' ? (
            <div style={{ marginBottom: 14 }}>
              <ListaMultipla
                itens={jogadoresOrdenados.map(p => ({
                  id: p.id, rotulo: shortPlayerName(p, players), prefixo: p.position || '--',
                  bloqueado: cheio(p.id), motivo: `já tem ${MAX_MISSOES_ABERTAS} em aberto`,
                }))}
                escolhidos={dest}
                onAlternar={alternarDest}
                comProcura
                mostrarEtiquetas={dest.length < jogadoresOrdenados.length}
                resumo={dest.length === 0 ? 'Escolher jogadores'
                  : dest.length === jogadoresOrdenados.length ? `Todo o plantel (${dest.length})`
                    : `${dest.length} ${dest.length === 1 ? 'jogador' : 'jogadores'}`}
                atalhos={[{ rotulo: 'Todos', onClick: () => escolherGrupo(null) },
                  ...GRUPOS_POSICAO_PRINT.map(g => ({ rotulo: g.label, onClick: () => escolherGrupo(g.posicoes) }))]}
                onLimpar={() => { setDest([]); setAviso(''); }}
              />
              <div style={{ fontSize: 11.5, color: aviso ? T.warn : T.mutedDim, marginTop: 2, lineHeight: 1.5, height: 18, ...LINHAS(1) }}>
                {aviso || `Cada um recebe a sua cópia no Portal. Máximo de ${MAX_MISSOES_ABERTAS} missões em aberto por jogador.`}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <ListaMultipla
                itens={(membros || []).map(m => ({
                  id: m.user_id, rotulo: nomeDoMembro(m.user_id, membros, euId), cor: corDoMembro(m.user_id),
                  bloqueado: !podeGerir, motivo: 'só quem é responsável',
                }))}
                escolhidos={dest}
                onAlternar={alternarDest}
                resumo={dest.length === 0 ? 'Ninguém (aberta a toda a equipa técnica)'
                  : dest.length === 1 ? nomeDoMembro(dest[0], membros, euId)
                    : `${dest.length} pessoas`}
                atalhos={(membros || []).length > 2 ? [{ rotulo: 'Todos', onClick: () => setDest((membros || []).map(m => m.user_id)) }] : []}
                onLimpar={() => setDest([])}
              />
              <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 2, lineHeight: 1.5, height: 18, ...LINHAS(1) }}>
                {dest.length === 0 ? 'Sem ninguém escolhido: fica aberta a toda a equipa técnica.' : 'Com mais do que uma pessoa, cada uma recebe a sua cópia e conclui a sua.'}
              </div>
            </div>
          )}

          {/* QUANDO — numa grelha de duas colunas, para caber tudo sem
              deslizar: Prazo | Repete, e depois Acompanha | Estado. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', marginBottom: 10 }}>
            <Field label={repete ? 'Prazo (repete)' : 'Prazo'}>
              <Input type="date" value={repete ? '' : comum.prazo} disabled={repete} onChange={e => setComum({ ...comum, prazo: e.target.value })} style={repete ? { opacity: 0.45 } : undefined} />
            </Field>
            <Field label="Repete">
              <Select
                value={comum.recorrencia ? comum.recorrencia.tipo : ''}
                onChange={e => {
                  const tipo = e.target.value;
                  if (!tipo) { setComum({ ...comum, prazo: (comum.recorrencia && comum.recorrencia.desde) || comum.prazo || '', recorrencia: null }); return; }
                  const diaDoPrazo = comum.prazo ? [new Date(`${comum.prazo}T00:00:00`).getDay()] : null;
                  setComum({ ...comum, prazo: '', recorrencia: { ...(comum.recorrencia || {}), tipo, dias: (comum.recorrencia && comum.recorrencia.dias) || diaDoPrazo || [1, 2, 3, 4, 5], desde: (comum.recorrencia && comum.recorrencia.desde) || comum.prazo || todayStr() } });
                  // Ficha do adversário / ideias para o jogo: leva logo ao sítio certo.
                  if (modo === 'staff' && CAMINHO_DA_RECORRENCIA[tipo] && !blocos[0].caminho) mudarBloco(0, { caminho: CAMINHO_DA_RECORRENCIA[tipo] });
                }}
              >
                <option value="">Não repete</option>
                {Object.entries(RECORRENCIA_LABEL)
                  .filter(([id]) => modo === 'staff' || !RECORRENCIAS_SO_STAFF.includes(id) || (comum.recorrencia && comum.recorrencia.tipo === id))
                  .map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </Select>
            </Field>
            {modo === 'jogadores' && (
              <Field label="Quem acompanha">
                <Select value={comum.acompanha} onChange={e => setComum({ ...comum, acompanha: e.target.value })}>
                  <option value="">Ninguém</option>
                  {(membros || []).map(m => <option key={m.user_id} value={m.user_id}>{nomeDoMembro(m.user_id, membros, euId)}</option>)}
                </Select>
              </Field>
            )}
            {editar && !emGrupo && (
              <Field label="Estado">
                <Select value={comum.estado} onChange={e => setComum({ ...comum, estado: e.target.value })} disabled={!podeConcluir && comum.estado === 'feita'}>
                  <option value="aberta">Por fazer</option>
                  <option value="curso">Iniciada</option>
                  <option value="feita" disabled={!podeConcluir || (modo === 'staff' && !!CRITERIO_STAFF[blocos[0].caminho])}>
                    Concluída{modo === 'staff' && CRITERIO_STAFF[blocos[0].caminho] ? ' (fecha sozinha)' : (!podeConcluir ? ' (só o responsável)' : '')}
                  </option>
                </Select>
              </Field>
            )}
          </div>
          {/* Dias da semana: só com "Dias da semana" escolhido. */}
          {repete && comum.recorrencia.tipo === 'semanal' && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {DIAS_SEMANA.map((nome, i) => {
                const on = !!(comum.recorrencia.dias || []).includes(i);
                return (
                  <button key={i} type="button" onClick={() => {
                    const dias = on ? comum.recorrencia.dias.filter(d => d !== i) : [...(comum.recorrencia.dias || []), i];
                    setComum({ ...comum, recorrencia: { ...comum.recorrencia, dias } });
                  }} style={chip(on, { fontSize: 11.5, padding: '4px 9px', textTransform: 'capitalize' })}>{nome.slice(0, 3)}</button>
                );
              })}
            </div>
          )}
          {/* PRIORITÁRIA (só equipa técnica): numa linha. */}
          {modo === 'staff' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, fontSize: 13, color: T.cream, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!comum.obrigatoria} onChange={e => setComum({ ...comum, obrigatoria: e.target.checked })}
                style={{ accentColor: T.crimson, width: 16, height: 16 }} />
              <Flag size={12} /> Prioritária <span style={{ fontSize: 11.5, color: T.mutedDim }}>aparece primeiro na credencial</span>
            </label>
          )}
        </div>

        {/* DIREITA: a missão (ou as missões, ao criar) e, ao editar, as respostas */}
        <div ref={colunaMissoesRef} style={{ order: 1, display: 'flex', flexDirection: 'column', gap: 12, ...(estreito ? {} : { overflowY: 'auto', paddingRight: 6, minHeight: 0 }) }}>
          {blocos.map((b, k) => {
            const opcoes = modo === 'jogadores' ? DESTINOS_MISSAO : CAMINHOS_STAFF;
            const atualId = modo === 'jogadores' ? b.destino : b.caminho;
            const d = modo === 'jogadores' ? destinoMissao(b.destino) : null;
            return (
              <div key={b.key} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, background: T.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    {blocos.length > 1 ? `Missão ${k + 1}` : 'A missão'}
                  </span>
                  {blocos.length > 1 && (
                    <button type="button" onClick={(e) => fecharSemSaltar(e.currentTarget, () => setBlocos(bs => bs.filter((_, j) => j !== k)))} title="Tirar esta missão"
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 2, display: 'flex' }}><X size={15} /></button>
                  )}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Field label={modo === 'jogadores' ? 'Para onde leva o jogador' : 'Para onde leva (separador da app)'}>
                    <Select value={atualId || ''} onChange={e => mudarBloco(k, modo === 'jogadores' ? { destino: e.target.value } : { caminho: e.target.value })}>
                      {opcoes.map(o => <option key={o.id || 'nenhum'} value={o.id}>{o.rotulo}</option>)}
                    </Select>
                  </Field>
                </div>
                {/* CLIPE DE QUE JOGO: a missão só fecha com um clipe desse jogo. */}
                {modo === 'jogadores' && b.destino === 'clipe' && (
                  <div style={{ marginBottom: 12 }}>
                    <Field label="De que jogo">
                      <Select value={b.jogoId || ''} onChange={e => {
                        const m = (matches || []).find(x => x.id === e.target.value);
                        const sug = m ? `Criar um clipe · vs ${m.opponent || 'Adversário'}` : 'Criar um clipe';
                        const atual = String(b.titulo || '').trim();
                        const eAuto = !atual || atual === b.tituloAuto || /^criar um clipe/i.test(atual);
                        setBlocos(bs => bs.map((x, j) => (j === k ? { ...x, jogoId: e.target.value, ...(eAuto ? { titulo: sug, tituloAuto: sug } : {}) } : x)));
                      }}>
                        <option value="">Qualquer jogo</option>
                        {[...(matches || [])].filter(m => m && m.date && m.date <= todayStr())
                          .sort((a, b2) => String(b2.date).localeCompare(String(a.date)))
                          .map(m => <option key={m.id} value={m.id}>{fmtShort(m.date)} · vs {m.opponent || 'Adversário'}</option>)}
                      </Select>
                    </Field>
                  </div>
                )}
                <Field label="O que é preciso fazer" bloco solto>
                  <Input value={b.titulo} onChange={e => mudarBloco(k, { titulo: e.target.value })} autoFocus={k === 0}
                    placeholder={modo === 'jogadores' ? 'Ex: corta o teu melhor lance de sábado' : 'Ex: análise individual · Lavrense'} />
                </Field>
                <div style={{ marginTop: 10 }}>
                  <Field label={modo === 'jogadores' ? 'Instruções para o jogador' : 'Notas'} bloco solto>
                    <TextArea value={b.instrucoes} onChange={e => mudarBloco(k, { instrucoes: e.target.value })} style={{ minHeight: 62, fontSize: 13 }}
                      placeholder={modo === 'jogadores'
                        ? (b.destino === 'nota' ? 'O que queres que o jogador te responda' : 'Opcional: o que ele deve fazer lá')
                        : 'Detalhes, links, o que for preciso saber para fazer isto.'} />
                  </Field>
                </div>
                {modo === 'jogadores' && d && (
                  <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 6, lineHeight: 1.4 }}>
                    {d.id === 'clipe' ? (b.jogoId ? 'Fica feita quando ele gravar um clipe deste jogo.' : 'Fica feita quando ele gravar um clipe (de qualquer jogo).')
                      : d.auto ? 'Fica feita quando ele submeter.'
                        : d.id !== 'nota' ? 'Leva-o lá e fica registado que abriu.'
                          : 'Ele responde por escrito.'}
                  </div>
                )}
                {modo === 'staff' && (
                  <div style={{ fontSize: 11, color: CRITERIO_STAFF[b.caminho] ? T.good : T.mutedDim, marginTop: 6, lineHeight: 1.4 }}>
                    {CRITERIO_STAFF[b.caminho]
                      ? `Fecha sozinha quando ${CRITERIO_STAFF[b.caminho]}.`
                      : 'Sem caminho, a app não tem como ver se foi feita: conclui-se à mão.'}
                  </div>
                )}
                {modo === 'staff' && editar && b.caminho && (
                  <button type="button" onClick={() => { onClose(); irParaSeparador(b.caminho); }} style={{
                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.gold}`,
                    color: T.warn, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12.5, ...body,
                  }}>Ir para {caminhoStaff(b.caminho).rotulo} <ArrowRight size={13} /></button>
                )}
              </div>
            );
          })}
          {!editar && (() => {
            const pode = modo === 'staff' || blocos.length < MAX_MISSOES_ABERTAS;
            return (
              <button type="button" disabled={!pode} onClick={() => {
                setBlocos(bs => [...bs, { key: uid(), titulo: '', tituloAuto: '', destino: 'nota', caminho: '', instrucoes: '' }]);
                // A nova missão aparece em baixo, dentro da coluna: desliza até lá sem mexer na página.
                setTimeout(() => { const c = colunaMissoesRef.current; if (c && !estreito) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); }, 30);
              }} style={{
                border: `1px dashed ${T.line}`, background: 'transparent', color: pode ? T.muted : T.mutedDim, borderRadius: 10, padding: '9px 12px', flexShrink: 0,
                cursor: pode ? 'pointer' : 'default', fontSize: 12.5, ...body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>{pode ? <><Plus size={14} /> Acrescentar outra missão (cada uma com o seu título)</> : `Máximo de ${MAX_MISSOES_ABERTAS} missões de cada vez para jogadores`}</button>
            );
          })()}
          {/* RESPOSTAS — no grupo, o estado de cada um (e a nota de quem respondeu). */}
          {editar && (modo === 'jogadores') && (
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 11.5, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                {emGrupo ? `Quem já fez · ${registos.filter(feitaNoGrupo).length}/${registos.length}` : 'Resposta do jogador'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {registos.map(r => {
                  const p = (players || []).find(x => x.id === r.jogadorId) || {};
                  const fez = feitaNoGrupo(r);
                  return (
                    <div key={r.id} style={{ border: `1px solid ${fez ? T.good : T.line}`, borderRadius: 8, padding: '8px 10px', background: T.bg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.cream }}>
                        {fez ? <CheckCircle2 size={14} color={T.good} /> : <span style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${T.line}`, display: 'inline-block' }} />}
                        <span style={{ fontWeight: 600 }}>{shortPlayerName(p, players)}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: fez ? T.good : T.mutedDim }}>
                          {fez ? `feito${r.notaSubmetidaEm ? ` · ${fmtShort(String(r.notaSubmetidaEm).slice(0, 10))}` : ''}` : (r.notaAtleta ? 'a escrever' : 'por fazer')}
                        </span>
                        {/* Fechou por engano (ex.: o clipe era de outro jogo):
                            volta a ficar por fazer no Portal do jogador. */}
                        {fez && (
                          <button type="button" onClick={() => onGuardar({
                            upserts: [{ ...r, estado: 'aberta', feitaEm: null, notaSubmetida: false, notaSubmetidaEm: null, notaAtleta: '', notaRevista: false, conclusaoPorVer: null }],
                            removidos: [],
                          })} style={{ ...body, fontSize: 11, color: T.warn, background: 'none', border: `1px solid ${T.line}`, borderRadius: 6, padding: '2px 7px', cursor: 'pointer' }}>
                            Reabrir
                          </button>
                        )}
                      </div>
                      {r.notaAtleta && (
                        <div style={{ fontSize: 12.5, color: T.muted, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: 6 }}>{r.notaAtleta}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 14, paddingTop: 12,
        borderTop: `1px solid ${T.line}`, background: T.bg,
        ...(estreito ? { position: 'sticky', bottom: 0, zIndex: 5, paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' } : {}),
      }}>
        {onRemove && <Btn variant="danger" onClick={onRemove} style={{ marginRight: 'auto' }}><Trash2 size={15} /> {emGrupo ? `Apagar para todos (${registos.length})` : 'Apagar'}</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar} disabled={!valido}>
          {!editar && dest.length * blocos.length > 1 ? `Guardar (${dest.length * blocos.length} missões)` : 'Guardar'}
        </Btn>
      </div>
      {espacoSemSaltar}
    </Modal>
  );
}

