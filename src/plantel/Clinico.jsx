// plantel/Clinico.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { idsComMinutos } from '../dominio/jogos';
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import React, { useState } from 'react';
import { todayStr, uid, fmtDate, fmtShort } from '../base/utilidades';
import { Modal, FIELD_GRID, Field, Select, Input, TextArea, Btn, askConfirm, trocarJanela, offerUndo, removeWithUndo, SectionHeader, Panel, EmptyState } from '../base/ui';
import { sortByPosition } from '../dominio/jogadores';
import { NIVEIS_CLINICOS, nivelClinico, nivelNoDia } from '../dominio/clinico';
import { T, mono, body } from '../base/tema';
import { AlertTriangle, Trash2, Plus, CheckCircle2, RotateCcw, Pencil } from 'lucide-react';
import { anteriorParaRecaida, juntarComoRecaida, juntarLesoes, lesoesPartidas, normalizarOcorrencia, periodosDaOcorrencia, possiveisRecaidas, proximoDiaIso, recalcularOcorrencia } from './clinicoDados';
import { MESES_PT } from './comum';

/* ================================================================
   BOLETIM CLÍNICO
   ================================================================

   O registo central de quem está fora e porquê. Uma ocorrência por
   registo: quem, o quê, desde quando, que nível, quando se espera de
   volta. Poucos campos de propósito — quem preenche isto é o treinador,
   não o departamento médico, e uma ficha com dezoito campos não se
   preenche nunca.

   O que ESTE módulo não faz: não altera presenças, não apaga histórico,
   não mexe em avaliações nem em estatísticas passadas. A lesão impede
   participações novas; não reescreve o passado. */

export const TIPOS_OCORRENCIA = ['Lesão muscular', 'Lesão articular', 'Entorse', 'Fratura', 'Contusão', 'Sobrecarga', 'Doença', 'Pós-operatório', 'Outro'];

export const ZONAS_CORPORAIS = ['Tornozelo', 'Joelho', 'Coxa', 'Virilha', 'Anca', 'Perna', 'Pé', 'Ombro', 'Costas', 'Cabeça', 'Outra'];

/* Ficha de uma ocorrência. `presetPlayerId` e `presetData` chegam
   preenchidos quando a janela é aberta a partir de um L nas presenças —
   é o que evita escrever duas vezes a mesma coisa. */
export function OcorrenciaModal({ ocorrencia, players, presetPlayerId, presetData, onClose, onSave, onRemove, clinico, onRecaida }) {
  /* Duas utilizações:
     · NOVA ocorrência: tudo o que se sabe no primeiro dia, incluindo uma
       primeira nota, que abre a evolução.
     · EDITAR os dados de base de uma que já existe (jogador, tipo, zona,
       início, nível no início). O que muda com o tempo (nível, previsão,
       restrições, alta, notas) já não se edita aqui: regista-se como
       atualização, na ficha da lesão, para ficar com data. */
  const aEditar = !!ocorrencia;
  const base = aEditar ? normalizarOcorrencia(ocorrencia) : null;
  const [f, setF] = useState(aEditar ? {
    playerId: base.playerId, inicio: base.inicio, nivel: base.nivelInicial, tipo: base.tipo || '', zona: base.zona || '',
  } : {
    playerId: presetPlayerId || '',
    inicio: presetData || todayStr(),
    /* Sem nível por omissão, de propósito. Um valor pré-escolhido é
       aceite sem se pensar, e o nível é justamente a decisão que faz o
       resto da app comportar-se de uma maneira ou de outra. */
    nivel: '', tipo: '', zona: '', previsaoRetorno: '', restricoes: '', nota: '',
  });
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_clinico_${ocorrencia ? ocorrencia.id : `novo_${presetPlayerId || ''}`}`, f, setF, true, { sensivel: true });
  const valido = f.playerId && f.inicio && f.nivel;

  // Mesmo jogador, mesma zona, alta há pouco: provavelmente é uma recaída.
  const anterior = !aEditar && onRecaida
    ? anteriorParaRecaida(clinico, { playerId: f.playerId, zona: f.zona, inicio: f.inicio })
    : null;

  const novaAPartirDoForm = () => {
    const agora = new Date().toISOString();
    const nota = String(f.nota || '').trim();
    return recalcularOcorrencia({
      playerId: f.playerId, inicio: f.inicio, tipo: f.tipo, zona: f.zona,
      nivelInicial: f.nivel, previsaoInicial: f.previsaoRetorno || '', restricoesIniciais: f.restricoes || '',
      evolucao: nota ? [{ id: uid(), data: f.inicio, texto: nota, criadoEm: agora }] : [],
    });
  };

  const guardar = () => {
    if (!valido) return;
    limpar();
    if (aEditar) {
      onSave(recalcularOcorrencia({
        ...base, playerId: f.playerId, inicio: f.inicio, tipo: f.tipo, zona: f.zona, nivelInicial: f.nivel,
      }));
      return;
    }
    onSave(novaAPartirDoForm());
  };

  const guardarComoRecaida = () => {
    if (!valido || !anterior) return;
    limpar();
    onRecaida(juntarComoRecaida(anterior, { ...novaAPartirDoForm(), id: uid() }));
  };

  return (
    <Modal
      title={aEditar ? 'Editar dados da lesão' : 'Nova ocorrência'}
      subtitle={aEditar ? 'Para registar como está o jogador, usa "+ Atualização" na ficha da lesão.' : 'Boletim Clínico'}
      onClose={onClose}
      wide
    >
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
        <Field label="Jogador">
          <Select value={f.playerId} onChange={e => setF({ ...f, playerId: e.target.value })}>
            <option value="">Escolher…</option>
            {sortByPosition(players).map(p => (
              <option key={p.id} value={p.id}>{p.number ? `${p.number} · ` : ''}{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={aEditar ? 'Nível no início' : 'Nível'}>
          <Select value={f.nivel} onChange={e => setF({ ...f, nivel: e.target.value })}>
            <option value="">Escolher…</option>
            {NIVEIS_CLINICOS.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </Select>
        </Field>
        <Field label="Início">
          <Input type="date" value={f.inicio} onChange={e => setF({ ...f, inicio: e.target.value })} />
        </Field>
      </div>

      <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
        <Field label="Tipo">
          <Select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>
            <option value="">—</option>
            {TIPOS_OCORRENCIA.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Zona">
          <Select value={f.zona} onChange={e => setF({ ...f, zona: e.target.value })}>
            <option value="">—</option>
            {ZONAS_CORPORAIS.map(z => <option key={z} value={z}>{z}</option>)}
          </Select>
        </Field>
        {!aEditar && (
          <Field label="Previsão de retorno">
            <Input type="date" value={f.previsaoRetorno} onChange={e => setF({ ...f, previsaoRetorno: e.target.value })} />
          </Field>
        )}
      </div>

      {!aEditar && (
        <>
          <div style={{ marginBottom: 14 }}>
            <Field label="Restrições" bloco solto>
              <TextArea
                value={f.restricoes}
                onChange={e => setF({ ...f, restricoes: e.target.value })}
                placeholder="Ex: corrida linear sim, mudanças de direção não · sem contacto · 30 min de treino integrado"
                style={{ minHeight: 56 }}
              />
            </Field>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Field label="Primeira nota" bloco solto>
              <TextArea
                value={f.nota}
                onChange={e => setF({ ...f, nota: e.target.value })}
                placeholder="O que aconteceu, quem avaliou, link do Drive para exames… As próximas notas vão para a evolução, com data."
                style={{ minHeight: 56 }}
              />
            </Field>
          </div>
        </>
      )}

      {anterior && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', marginBottom: 14, borderRadius: 8, border: `1px solid ${T.warn}`, background: T.bg }}>
          <AlertTriangle size={16} color={T.warn} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: T.cream, lineHeight: 1.5 }}>
            Este jogador teve alta de {[anterior.tipo, anterior.zona].filter(Boolean).join(' · ') || 'uma lesão'} a {fmtDate(anterior.fim)}.
            Se é o mesmo problema, regista como <strong>recaída</strong>: a lesão reabre e fica tudo na mesma ficha.
            Os dias em que esteve apto entre a alta e hoje continuam a contar como aptos.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        {onRemove && <Btn variant="danger" onClick={onRemove} style={{ marginRight: 'auto' }}><Trash2 size={15} /> Apagar lesão</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        {anterior ? (
          <>
            <Btn variant="ghost" onClick={guardar} disabled={!valido}>É uma lesão nova</Btn>
            <Btn onClick={guardarComoRecaida} disabled={!valido}>Registar como recaída</Btn>
          </>
        ) : (
          <Btn onClick={guardar} disabled={!valido}>Guardar</Btn>
        )}
      </div>
    </Modal>
  );
}

/* Uma linha do boletim. A mesma no painel das ocorrências abertas e no
   histórico — muda só a informação que faz sentido em cada um. */
export function LinhaOcorrencia({ o: original, jogador, onAbrir, onAtualizar, mostrarJogador = true, destaque }) {
  const o = normalizarOcorrencia(original);
  const hoje = todayStr();
  const aberta = !original.fim;
  const nivel = nivelClinico(nivelNoDia(o, hoje));
  const dias = diasDeOcorrencia(original);
  const atrasada = aberta && original.previsaoRetorno && original.previsaoRetorno < hoje;
  // A última coisa escrita — é o que se quer ver de relance.
  const ultima = [...(o.evolucao || [])].reverse().find(e => String(e.texto || '').trim());

  return (
    <div
      onClick={onAbrir}
      title="Abrir a ficha da lesão"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        padding: '11px 14px', background: T.bg, borderRadius: 8,
        border: `1px solid ${T.line}`, borderLeft: `3px solid ${aberta ? nivel.cor : T.line}`,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: T.cream, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mostrarJogador && jogador ? `${jogador.number ? `${jogador.number} ` : ''}${jogador.name} · ` : ''}
          {[original.tipo, original.zona].filter(Boolean).join(' · ') || 'Ocorrência'}
        </div>
        <div style={{ color: T.mutedDim, fontSize: 12, marginTop: 2 }}>
          {/* Com alta, a data da alta vem primeiro: é por ela que o
              histórico está ordenado (quem voltou mais recentemente). */}
          {[
            aberta ? nivel.label : (original.fim ? `Alta ${fmtDate(original.fim)}` : 'Alta'),
            aberta ? (original.inicio ? fmtDate(original.inicio) : null) : (original.inicio ? `desde ${fmtDate(original.inicio)}` : null),
            dias != null ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : null,
            aberta && original.previsaoRetorno ? `previsão ${fmtShort(original.previsaoRetorno)}` : null,
            (o.evolucao || []).some(e => e.recaida) ? 'com recaída' : null,
          ].filter(Boolean).join(' · ')}
        </div>
        {ultima && (
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ ...mono, color: T.mutedDim, fontSize: 11 }}>{ultima.data ? fmtShort(ultima.data) : ''}</span>
            {'  '}{ultima.texto}
          </div>
        )}
      </div>
      {destaque && (
        <span style={{ flexShrink: 0, fontSize: 11.5, color: T.good || T.gold, border: `1px solid ${(T.good || T.gold)}66`, borderRadius: 12, padding: '2px 9px', whiteSpace: 'nowrap' }}>{destaque}</span>
      )}
      {/* A previsão de retorno já passou e ninguém deu alta: não é um erro,
          mas é a única coisa nesta lista que pede uma ação. */}
      {atrasada && (
        <span title={`Previsão de retorno era ${fmtDate(original.previsaoRetorno)}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.warn, fontSize: 11.5, flexShrink: 0 }}>
          <AlertTriangle size={13} /> rever
        </span>
      )}
      {aberta && onAtualizar && (
        <button
          onClick={(e) => { e.stopPropagation(); onAtualizar(); }}
          title="Registar como está hoje"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer', ...body,
            background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 12, padding: '6px 10px',
          }}
        ><Plus size={13} /> Atualização</button>
      )}
    </div>
  );
}

/* Dias decorridos: até à alta, ou até hoje se ainda estiver aberta. */
export function diasDeOcorrencia(o) {
  if (!o || !o.inicio) return null;
  // Somam-se só os períodos ativos: os dias entre uma alta e uma recaída,
  // em que o jogador esteve apto, não contam.
  const total = periodosDaOcorrencia(o).reduce((soma, [de, ate]) => {
    const d = Math.round((new Date(`${ate}T00:00:00`) - new Date(`${de}T00:00:00`)) / 86400000);
    return soma + (d >= 0 ? d + 1 : 0);
  }, 0);
  return total || null;
}

/* MARCAR L NOS DIAS DE UMA OCORRÊNCIA.

   A ocorrência é uma; os L nas presenças são a sua sombra nos dias. Sem
   isto, registar uma paragem de três semanas obrigava a ir às presenças
   marcar L quinze vezes à mão — e bastava falhar um dia para a
   assiduidade ficar errada.

   O boletim PROPÕE, nunca reescreve sozinho: devolve-se aqui a lista de
   dias e quem chama pergunta antes de aplicar. É a diferença entre uma
   ajuda e uma surpresa — e presenças reescritas em silêncio são das
   coisas que mais custa a descobrir e a desfazer.

   Dias já guardados ("Guardar" na coluna) ficam de fora. Foram fechados
   de propósito; se o boletim passasse por cima deles, o cadeado não
   valeria nada. */
export function diasDaOcorrencia({ ocorrencia, sessions, matches, playerId }) {
  const o = ocorrencia || {};
  const inicio = o.inicio;
  if (!inicio) return { marcar: [], limpar: [], fechados: 0 };

  /* Até onde vai a paragem: a alta manda; sem alta, a previsão de
     retorno; sem nenhuma das duas, até hoje — não se marcam dias que
     ainda não aconteceram por causa de uma paragem sem fim previsto. */
  // A previsão de retorno é o dia em que ele VOLTA: o último dia de L
  // é a véspera (o mesmo critério do L automático, `dentroDaParagem`).
  const fim = o.fim || (o.previsaoRetorno ? proximoDiaIso(o.previsaoRetorno, -1) : todayStr());
  const idsDeJogos = new Set((matches || []).map(m => m.id));

  const alvos = [];
  (matches || []).forEach(m => {
    /* Jogo em que ele está ou jogou: não leva L.
       · Lesão no próprio dia do jogo: se estava no onze ou no banco, fica
         lá. Só passa a indisponível no dia seguinte. Marcar L tirava-o dos
         convocados e, à gravação seguinte, também do onze (o lugar ficava
         "livre" e os minutos escondidos).
       · Qualquer jogo em que tenha minutos registados: jogou. */
    const naEquipa = [...(m.convocados || []), ...(m.starters || []), ...(m.alinhamento || [])].includes(playerId);
    const jogou = idsComMinutos(m).includes(playerId) || (m.date === inicio && naEquipa);
    if (m.date && !jogou) alvos.push({ tipo: 'match', id: m.id, date: m.date, fechado: !!m.attendanceClosed, lesionados: m.lesionados || [] });
  });
  (sessions || []).forEach(x => {
    // A sessão de um amigável não conta: o jogo já tem a sua coluna nas
    // presenças, e marcar nos dois dava L a dobrar no mesmo dia.
    if (x.sourceMatchId && idsDeJogos.has(x.sourceMatchId)) return;
    if (x.phase === 'Descanso' || !x.date) return;
    alvos.push({ tipo: 'session', id: x.id, date: x.date, fechado: !!x.attendanceClosed, lesionados: x.lesionados || [] });
  });

  const dentro = (d) => d >= inicio && d <= fim;
  const jaL = (a) => a.lesionados.includes(playerId);
  // Só os dias em que o jogador estava INDISPONÍVEL levam L. Em "treino
  // condicionado" ou "apto com vigilância" ele treina.
  const indisponivel = (d) => nivelNoDia(o, d) === 'indisponivel';

  const marcar = alvos.filter(a => dentro(a.date) && indisponivel(a.date) && !jaL(a) && !a.fechado);

  /* Dias com L que deixaram de ser da lesão:
     · depois da alta, se ela chegou antes da previsão;
     · depois de uma atualização que tirou o jogador de "Indisponível"
       (os L tinham sido marcados até à previsão de retorno).
     Só esses: L de outras ocorrências, ou postos à mão antes de
     qualquer mudança, não são nossos. */
  const saidas = (Array.isArray(o.evolucao) ? o.evolucao : [])
    .filter(e => e.nivel && e.nivel !== 'indisponivel' && e.data && nivelNoDia(o, proximoDiaIso(e.data, -1)) === 'indisponivel')
    .map(e => e.data);
  const depoisDeSair = (d) => saidas.some(sd => sd <= d);
  const limpar = alvos.filter(a => jaL(a) && !a.fechado && (
    (o.fim && a.date > o.fim && a.date <= (o.previsaoRetorno || o.fim))
    || (dentro(a.date) && !indisponivel(a.date) && depoisDeSair(a.date))
  ));

  const fechados = alvos.filter(a => dentro(a.date) && indisponivel(a.date) && !jaL(a) && a.fechado).length;
  return { marcar, limpar, fechados };
}

/* Aplica o que `diasDaOcorrencia` devolveu. `valor` true põe L, false
   tira-o e devolve o dia a "ausente" — nunca a "presente", porque não
   sabemos se o jogador esteve; isso é o treinador que diz. */
export function aplicarLesionado({ alvos, playerId, valor, setSessions, setMatches }) {
  const ids = { session: new Set(), match: new Set() };
  alvos.forEach(a => ids[a.tipo].add(a.id));

  const mexer = (registo) => {
    const lesionados = (registo.lesionados || []).filter(id => id !== playerId);
    if (!valor) return { ...registo, lesionados };
    // Ao entrar em L sai de todos os outros estados do dia, e a nota vai
    // com ele: quem não esteve não pode ter sido avaliado.
    const ratings = { ...(registo.ratings || {}) };
    delete ratings[playerId];
    const base = {
      ...registo,
      lesionados: [...lesionados, playerId],
      faltas: (registo.faltas || []).filter(id => id !== playerId),
      escalao: (registo.escalao || []).filter(id => id !== playerId),
      attendance: (registo.attendance || []).filter(id => id !== playerId),
      ratings,
    };
    if (registo.convocados) base.convocados = registo.convocados.filter(id => id !== playerId);
    return base;
  };

  if (ids.session.size && setSessions) setSessions(prev => prev.map(x => (ids.session.has(x.id) ? mexer(x) : x)));
  if (ids.match.size && setMatches) setMatches(prev => prev.map(x => (ids.match.has(x.id) ? mexer(x) : x)));
}

/* A pergunta, com os números à frente. Devolve `true` se houve alguma
   coisa a propor — quem chama usa isso para saber se já fez o trabalho ou
   se pode seguir em silêncio. */
export function proporMarcacaoClinica({ ocorrencia, sessions, matches, setSessions, setMatches, jogador }) {
  const { marcar, limpar, fechados } = diasDaOcorrencia({
    ocorrencia, sessions, matches, playerId: ocorrencia.playerId,
  });
  if (!marcar.length && !limpar.length) return false;

  const partes = [];
  if (marcar.length) partes.push(`marcar ${marcar.length} ${marcar.length === 1 ? 'dia' : 'dias'} como lesionado`);
  if (limpar.length) partes.push(`retirar o L de ${limpar.length} ${limpar.length === 1 ? 'dia' : 'dias'} depois da alta`);

  const notas = [];
  if (fechados) notas.push(`${fechados} ${fechados === 1 ? 'dia já guardado fica' : 'dias já guardados ficam'} como ${fechados === 1 ? 'está' : 'estão'}.`);
  if (marcar.length) notas.push('Estes dias saem do cálculo da assiduidade.');

  askConfirm({
    title: 'Atualizar as presenças?',
    label: `${jogador ? jogador.name : 'Jogador'} · ${partes.join(' e ')}`,
    note: notas.join(' '),
    confirmLabel: 'Atualizar',
    destructive: false,
    onConfirm: () => {
      if (marcar.length) aplicarLesionado({ alvos: marcar, playerId: ocorrencia.playerId, valor: true, setSessions, setMatches });
      if (limpar.length) aplicarLesionado({ alvos: limpar, playerId: ocorrencia.playerId, valor: false, setSessions, setMatches });
    },
  });
  return true;
}

/* FICHA DE UMA LESÃO — o episódio inteiro numa janela: estado atual em
   cima, a evolução por baixo (a mais recente primeiro) e o formulário
   de atualização quando é preciso. `modoInicial` 'atualizar' abre já
   com o formulário (o botão "+ Atualização" da lista). */
export function FichaOcorrencia({ ocorrencia, jogador, modoInicial, onClose, onGuardar, onEditarDados }) {
  const o = normalizarOcorrencia(ocorrencia);
  const hoje = todayStr();
  const aberta = !ocorrencia.fim;
  const nivelAtual = nivelClinico(nivelNoDia(o, hoje));
  const dias = diasDeOcorrencia(ocorrencia);
  const atrasada = aberta && ocorrencia.previsaoRetorno && ocorrencia.previsaoRetorno < hoje;

  // Formulário: null | { modo: 'atualizar' | 'alta', entradaId? , ...campos }
  const formVazio = (modo) => ({
    modo, entradaId: null, data: hoje, texto: '',
    nivel: '', previsaoRetorno: ocorrencia.previsaoRetorno || '', restricoes: ocorrencia.restricoes || '',
  });
  const [form, setForm] = useState(modoInicial === 'atualizar' && aberta ? formVazio('atualizar') : null);
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_clinico_${ocorrencia.id}_${form ? `${form.modo}_${form.entradaId || 'nova'}` : ''}`, form, setForm, !!form, { sensivel: true });
  const [erro, setErro] = useState('');

  const editarEntrada = (e) => {
    setErro('');
    setForm({
      modo: e.alta ? 'alta' : (e.recaida ? 'recaida' : 'atualizar'), entradaId: e.id, data: e.data || hoje, texto: e.texto || '',
      nivel: e.nivel || '',
      previsaoRetorno: e.previsaoRetorno !== undefined ? e.previsaoRetorno : '',
      restricoes: e.restricoes !== undefined ? e.restricoes : '',
      tinhaPrevisao: e.previsaoRetorno !== undefined, tinhaRestricoes: e.restricoes !== undefined,
    });
  };

  const guardarForm = () => {
    if (!form) return;
    if (!form.data) { setErro('Escolhe a data.'); return; }
    if (o.inicio && form.data < o.inicio) { setErro(`A data não pode ser antes do início da lesão (${fmtShort(o.inicio)}).`); return; }
    const texto = String(form.texto || '').trim();
    const entrada = { id: form.entradaId || uid(), data: form.data, texto, criadoEm: new Date().toISOString() };
    if (form.modo === 'alta') {
      entrada.alta = true;
    } else if (form.modo === 'recaida') {
      if (!form.nivel) { setErro('Escolhe o nível com que o jogador volta ao boletim.'); return; }
      const ultimaAlta = [...o.evolucao].reverse().find(e => e.alta && e.id !== form.entradaId);
      if (!form.entradaId && ultimaAlta && form.data <= ultimaAlta.data) {
        setErro(`A recaída tem de ser depois da alta (${fmtShort(ultimaAlta.data)}).`); return;
      }
      Object.assign(entrada, { recaida: true, nivel: form.nivel, previsaoRetorno: form.previsaoRetorno || '', restricoes: form.restricoes || '' });
    } else {
      if (form.nivel) entrada.nivel = form.nivel;
      // Só entra o que mudou em relação ao estado atual (ou o que a
      // entrada já tinha, quando se está a corrigir uma).
      const mudouPrevisao = form.entradaId ? form.tinhaPrevisao || form.previsaoRetorno !== '' : form.previsaoRetorno !== (ocorrencia.previsaoRetorno || '');
      const mudouRestricoes = form.entradaId ? form.tinhaRestricoes || form.restricoes !== '' : form.restricoes !== (ocorrencia.restricoes || '');
      if (mudouPrevisao) entrada.previsaoRetorno = form.previsaoRetorno;
      if (mudouRestricoes) entrada.restricoes = form.restricoes;
      if (!texto && !entrada.nivel && !mudouPrevisao && !mudouRestricoes) {
        setErro('Escreve como está o jogador, ou muda o nível, a previsão ou as restrições.');
        return;
      }
    }
    // Com recaídas uma lesão pode ter várias altas (uma por período), por
    // isso nada se substitui: "Dar alta" só aparece com a lesão aberta.
    const antigas = o.evolucao.filter(e => e.id !== entrada.id);
    limpar();
    onGuardar(recalcularOcorrencia({ ...o, evolucao: [...antigas, entrada] }));
    setForm(null); setErro('');
  };

  const apagarEntrada = (e) => {
    askConfirm({
      title: e.alta ? 'Retirar a alta?' : e.recaida ? 'Apagar a recaída?' : 'Apagar esta atualização?',
      label: `${e.data ? fmtDate(e.data) : ''}${e.texto ? ` · ${e.texto.slice(0, 60)}` : ''}`,
      note: e.alta ? 'A lesão volta a ficar aberta.' : e.recaida ? 'A lesão volta a ficar fechada na alta anterior.' : '',
      confirmLabel: e.alta ? 'Retirar' : 'Apagar',
      destructive: true,
      onConfirm: () => onGuardar(recalcularOcorrencia({ ...o, evolucao: o.evolucao.filter(x => x.id !== e.id) })),
    });
  };

  const evolucaoRecente = [...o.evolucao].reverse();
  const pill = (cor, texto) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: cor, border: `1px solid ${cor}`, borderRadius: 999, padding: '1px 8px' }}>{texto}</span>
  );
  const campo = { width: '100%', boxSizing: 'border-box' };

  return (
    <Modal
      title={`${jogador ? `${jogador.number ? `${jogador.number} ` : ''}${jogador.name}` : 'Jogador'}`}
      subtitle={[ocorrencia.tipo, ocorrencia.zona].filter(Boolean).join(' · ') || 'Ocorrência'}
      onClose={onClose}
      wide
    >
      {/* ESTADO ATUAL */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {aberta ? pill(nivelAtual.cor, nivelAtual.label) : pill(T.mutedDim, `Alta a ${fmtShort(ocorrencia.fim)}`)}
        <span style={{ fontSize: 12.5, color: T.muted }}>
          {[
            ocorrencia.inicio ? `desde ${fmtDate(ocorrencia.inicio)}` : null,
            dias != null ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : null,
            aberta && ocorrencia.previsaoRetorno ? `previsão de retorno ${fmtDate(ocorrencia.previsaoRetorno)}` : null,
          ].filter(Boolean).join(' · ')}
        </span>
        {atrasada && <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.warn, fontSize: 12 }}><AlertTriangle size={13} /> a previsão já passou</span>}
      </div>
      {aberta && ocorrencia.restricoes && (
        <div style={{ fontSize: 12.5, color: T.cream, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', marginBottom: 12, lineHeight: 1.5 }}>
          <span style={{ color: T.mutedDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Restrições · </span>{ocorrencia.restricoes}
        </div>
      )}

      {/* AÇÕES */}
      {!form && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {aberta && <Btn onClick={() => { setErro(''); setForm(formVazio('atualizar')); }}><Plus size={15} /> Atualização</Btn>}
          {aberta && <Btn variant="ghost" onClick={() => { setErro(''); setForm(formVazio('alta')); }}><CheckCircle2 size={15} /> Dar alta</Btn>}
          {!aberta && <Btn onClick={() => { setErro(''); setForm({ ...formVazio('recaida'), nivel: 'indisponivel', previsaoRetorno: '', restricoes: '' }); }}><RotateCcw size={15} /> Registar recaída</Btn>}
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={onEditarDados} title="Corrigir jogador, tipo, zona, início ou nível no início"><Pencil size={14} /> Dados da lesão</Btn>
        </div>
      )}

      {/* FORMULÁRIO DE ATUALIZAÇÃO / ALTA */}
      {form && (
        <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
          <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            {form.modo === 'alta' ? (form.entradaId ? 'Corrigir a alta' : 'Dar alta')
              : form.modo === 'recaida' ? (form.entradaId ? 'Corrigir a recaída' : 'Registar recaída')
              : (form.entradaId ? 'Corrigir atualização' : 'Nova atualização')}
          </div>
          <div style={{ ...FIELD_GRID, marginBottom: 10 }}>
            <Field label={form.modo === 'alta' ? 'Data da alta' : form.modo === 'recaida' ? 'Data da recaída' : 'Data'}>
              <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} style={campo} />
            </Field>
            {form.modo !== 'alta' && (
              <Field label="Nível">
                <Select value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })}>
                  {form.modo === 'recaida'
                    ? NIVEIS_CLINICOS.map(n => <option key={n.id} value={n.id}>{n.label}</option>)
                    : [
                      <option key="" value="">{form.entradaId ? 'Sem mudança de nível' : `Mantém: ${nivelAtual.label}`}</option>,
                      ...NIVEIS_CLINICOS.map(n => <option key={n.id} value={n.id}>Passa a: {n.label}</option>),
                    ]}
                </Select>
              </Field>
            )}
            {form.modo !== 'alta' && (
              <Field label="Previsão de retorno">
                <Input type="date" value={form.previsaoRetorno} onChange={e => setForm({ ...form, previsaoRetorno: e.target.value })} style={campo} />
              </Field>
            )}
          </div>
          {form.modo !== 'alta' && (
            <div style={{ marginBottom: 10 }}>
              <Field label="Restrições" bloco solto>
                <TextArea value={form.restricoes} onChange={e => setForm({ ...form, restricoes: e.target.value })}
                  placeholder="Deixa como está se não mudaram" style={{ minHeight: 44 }} />
              </Field>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <Field label={form.modo === 'alta' ? 'Nota (opcional)' : form.modo === 'recaida' ? 'O que aconteceu' : 'Como está o jogador'} bloco solto>
              <TextArea value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} autoFocus
                placeholder={form.modo === 'alta' ? 'Ex: reavaliado pelo fisioterapeuta, sem dor, treino completo' : 'Ex: nova ecografia, rotura grau 1; começa corrida contínua'}
                style={{ minHeight: 64 }} />
            </Field>
          </div>
          {erro && <div style={{ fontSize: 12.5, color: T.bad, marginBottom: 10 }}>{erro}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" onClick={() => { setForm(null); setErro(''); }}>Cancelar</Btn>
            <Btn onClick={guardarForm}>{form.entradaId ? 'Guardar' : form.modo === 'alta' ? 'Dar alta' : form.modo === 'recaida' ? 'Reabrir a lesão' : 'Guardar'}</Btn>
          </div>
        </div>
      )}

      {/* EVOLUÇÃO — a mais recente primeiro; o início fecha a lista. */}
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Evolução</div>
      <div style={{ position: 'relative', paddingLeft: 18 }}>
        <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: T.line, borderRadius: 1 }} />
        {evolucaoRecente.map(e => {
          const nv = e.nivel ? nivelClinico(e.nivel) : null;
          return (
            <div key={e.id} style={{ position: 'relative', paddingBottom: 14 }}>
              <span style={{
                position: 'absolute', left: -18, top: 4, width: 12, height: 12, borderRadius: '50%',
                background: e.alta ? T.good : (nv ? nv.cor : T.surfaceRaise), border: `2px solid ${T.surface}`,
              }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...mono, fontSize: 12, color: T.cream }}>{e.data ? fmtDate(e.data) : 'sem data'}</span>
                {e.alta && pill(T.good, 'Alta')}
                {e.recaida && nv && pill(nv.cor, `Recaída · ${nv.label}`)}
                {!e.recaida && nv && pill(nv.cor, `Passa a ${nv.label}`)}
                {e.previsaoRetorno !== undefined && <span style={{ fontSize: 11.5, color: T.muted }}>Previsão: {e.previsaoRetorno ? fmtShort(e.previsaoRetorno) : 'sem data'}</span>}
                <span style={{ flex: 1 }} />
                <button onClick={() => editarEntrada(e)} title="Corrigir" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 2 }}><Pencil size={12} /></button>
                <button onClick={() => apagarEntrada(e)} title={e.alta ? 'Retirar a alta' : 'Apagar'} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
              </div>
              {e.restricoes !== undefined && e.restricoes !== '' && (
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Restrições: {e.restricoes}</div>
              )}
              {e.texto && <div style={{ fontSize: 13, color: T.cream, marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{e.texto}</div>}
            </div>
          );
        })}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: -18, top: 4, width: 12, height: 12, borderRadius: '50%', background: nivelClinico(o.nivelInicial).cor, border: `2px solid ${T.surface}` }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...mono, fontSize: 12, color: T.cream }}>{o.inicio ? fmtDate(o.inicio) : '—'}</span>
            {pill(nivelClinico(o.nivelInicial).cor, `Início · ${nivelClinico(o.nivelInicial).label}`)}
            {o.previsaoInicial && <span style={{ fontSize: 11.5, color: T.muted }}>Previsão: {fmtShort(o.previsaoInicial)}</span>}
          </div>
          {o.restricoesIniciais && <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Restrições: {o.restricoesIniciais}</div>}
        </div>
      </div>
    </Modal>
  );
}

export function BoletimClinico({ players, clinico, setClinico, sessions, setSessions, matches, setMatches }) {
  // null | 'new' | { tipo: 'ficha', id, modo } | { tipo: 'dados', id }
  const [modal, setModal] = useState(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const hoje = todayStr();

  const jogadorDe = (id) => players.find(p => p.id === id);
  const ordenar = (lista) => [...lista].sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));

  /* Abertas = sem data de alta. Não basta "cobre hoje": uma ocorrência
     lançada com início na semana que vem também está por fechar e tem de
     se ver. */
  const abertas = ordenar((clinico || []).filter(o => !o.fim));
  /* HISTÓRICO pela data da ALTA, da mais recente para a mais antiga (antes
     era pela data da lesão, e não se percebia quem tinha voltado há
     menos tempo). Na mesma data de alta, primeiro a que teve a última
     atualização mais recente. */
  const ultimaAtualizacao = (o) => (Array.isArray(o.evolucao) ? o.evolucao : []).reduce((m, e) => (e && e.data && e.data > m ? e.data : m), '');
  const fechadas = (clinico || []).filter(o => o.fim).sort((a, b) =>
    (b.fim || '').localeCompare(a.fim || '')
    || ultimaAtualizacao(b).localeCompare(ultimaAtualizacao(a))
    || (b.inicio || '').localeCompare(a.inicio || ''));
  // Separadores por mês da alta, e "voltou há N dias" nas altas recentes.
  const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesDaAlta = (o) => { const [y, m] = String(o.fim || '').split('-'); return y && m ? `${MESES_PT[Number(m) - 1]} ${y}` : 'Sem data'; };
  const voltouHa = (o) => {
    if (!o.fim) return null;
    const d = Math.round((new Date(`${hoje}T00:00:00`) - new Date(`${o.fim}T00:00:00`)) / 86400000);
    if (d < 0 || d > 14) return null;
    return d === 0 ? 'Voltou hoje' : d === 1 ? 'Voltou ontem' : `Voltou há ${d} dias`;
  };
  const partidas = lesoesPartidas(clinico);
  const recaidas = possiveisRecaidas(clinico);

  const propor = (registo) => proporMarcacaoClinica({
    ocorrencia: registo, sessions, matches, setSessions, setMatches,
    jogador: jogadorDe(registo.playerId),
  });

  // Gravar UMA ocorrência (nunca a lista inteira).
  const gravar = (registo) => {
    setClinico(prev => (prev.some(o => o.id === registo.id) ? prev.map(o => (o.id === registo.id ? registo : o)) : [...prev, registo]));
    // A ocorrência fica guardada de qualquer forma; as presenças só mudam
    // se a resposta for sim.
    propor(registo);
  };

  /* Passar de uma janela para outra (nova ocorrência → ficha, ficha →
     dados da lesão e volta) tem de ir por `trocarJanela`: a janela nova
     herda a marca do histórico da anterior. Sem isto, o "voltar" que a
     janela que fecha deixa pendente fechava logo a que abria — era o
     piscar ao carregar em "Dados da lesão". */
  const mudarPara = (proximo) => trocarJanela(() => {}, () => setModal(proximo));

  const criar = (data) => {
    const registo = { ...data, id: uid() };
    mudarPara({ tipo: 'ficha', id: registo.id });
    gravar(registo);
  };

  // Nova ocorrência registada como recaída de uma anterior (já vem junta).
  const criarRecaida = (registo) => {
    mudarPara({ tipo: 'ficha', id: registo.id });
    gravar(registo);
  };

  // Casos antigos: junta B em A como recaída, ou marca que não é.
  const juntarRecaida = ([a, b]) => {
    const junta = juntarComoRecaida(a, b);
    const antes = clinico;
    setClinico(prev => prev.filter(o => o.id !== b.id).map(o => (o.id === a.id ? junta : o)));
    offerUndo('Juntada como recaída.', () => setClinico(antes));
    propor(junta);
  };
  const naoERecaida = ([a, b]) => {
    const registo = { ...b, naoRecaidaDe: [...(b.naoRecaidaDe || []), a.id] };
    setClinico(prev => prev.map(o => (o.id === b.id ? registo : o)));
  };

  const remove = (id) => {
    const o = clinico.find(x => x.id === id);
    const j = o && jogadorDe(o.playerId);
    removeWithUndo(clinico, setClinico, id, `Lesão${j ? ` de ${j.name}` : ''}`, () => setModal(null));
  };

  const juntarPartidas = () => {
    const linhas = partidas.map(c => {
      const j = jogadorDe(c[0].playerId);
      return `${j ? j.name : 'Jogador'} (${[c[0].tipo, c[0].zona].filter(Boolean).join(' · ') || 'ocorrência'}, ${c.length} registos)`;
    });
    askConfirm({
      title: 'Juntar lesões partidas?',
      label: linhas.join(' · '),
      note: 'Cada lesão passa a ser um só registo; as mudanças de nível ficam na evolução, com a data em que aconteceram. As presenças não mudam.',
      confirmLabel: 'Juntar',
      destructive: false,
      onConfirm: () => {
        const antes = clinico;
        const juntas = partidas.map(juntarLesoes);
        const aRemover = new Set(partidas.flatMap(c => c.slice(1).map(o => o.id)));
        const porId = Object.fromEntries(juntas.map(o => [o.id, o]));
        setClinico(prev => prev.filter(o => !aRemover.has(o.id)).map(o => porId[o.id] || o));
        offerUndo(`${juntas.length} ${juntas.length === 1 ? 'lesão juntada' : 'lesões juntadas'}.`, () => setClinico(antes));
      },
    });
  };

  const contagem = NIVEIS_CLINICOS.map(n => ({
    nivel: n,
    n: abertas.filter(o => nivelNoDia(o, hoje) === n.id && o.inicio <= hoje).length,
  }));

  const emFicha = modal && modal.tipo === 'ficha' ? (clinico || []).find(o => o.id === modal.id) : null;
  const emDados = modal && modal.tipo === 'dados' ? (clinico || []).find(o => o.id === modal.id) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* "Nova ocorrência" no cabeçalho, no mesmo sítio do "Novo exercício",
          "Nova ideia", "Nova sessão"… em todas as páginas. */}
      <SectionHeader title="Boletim Clínico" subtitle="Uma ficha por lesão, com a evolução datada."
        action={<Btn onClick={() => setModal('new')}><Plus size={15} /> Nova ocorrência</Btn>} />

      {partidas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 10, border: `1px solid ${T.warn}`, background: T.surface }}>
          <AlertTriangle size={16} color={T.warn} />
          <span style={{ flex: 1, minWidth: 200, fontSize: 13, color: T.cream }}>
            {partidas.length === 1 ? 'Há 1 lesão que ficou partida' : `Há ${partidas.length} lesões que ficaram partidas`} em dois registos quando se mudou o nível.
          </span>
          <Btn variant="ghost" onClick={juntarPartidas}>Ver e juntar</Btn>
        </div>
      )}

      {/* POSSÍVEIS RECAÍDAS já registadas como lesões separadas: mesmo
          jogador, mesma zona, nova paragem até 30 dias depois da alta.
          Uma a uma, porque só quem conhece o caso sabe se é o mesmo
          problema. */}
      {recaidas.length > 0 && (
        <Panel title={`Possíveis recaídas (${recaidas.length})`}>
          <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 12, lineHeight: 1.5 }}>
            O mesmo jogador voltou a parar na mesma zona pouco depois de ter alta. Se é o mesmo problema, junta como recaída:
            fica uma só lesão, reaberta, e os dias em que esteve apto entre a alta e a recaída continuam a contar como aptos.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recaidas.map(([a, b]) => {
              const j = jogadorDe(b.playerId);
              const dias = Math.round((new Date(`${b.inicio}T00:00:00`) - new Date(`${a.fim}T00:00:00`)) / 86400000);
              return (
                <div key={`${a.id}-${b.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 13.5, color: T.cream }}>
                      {j ? `${j.number ? `${j.number} ` : ''}${j.name}` : 'Jogador'} · {[b.tipo, b.zona].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 2 }}>
                      Alta a {fmtDate(a.fim)} · voltou a parar a {fmtDate(b.inicio)} ({dias} {dias === 1 ? 'dia' : 'dias'} depois)
                    </div>
                  </div>
                  <Btn variant="ghost" onClick={() => naoERecaida([a, b])}>Não é recaída</Btn>
                  <Btn onClick={() => juntarRecaida([a, b])}><RotateCcw size={14} /> Juntar como recaída</Btn>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel
        title="Lista clínica"
      >
        {/* Quantos e em que nível, antes da lista: é a pergunta que se faz
            ao abrir o separador. */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: abertas.length ? 14 : 0 }}>
          {contagem.map(({ nivel, n }) => (
            <div key={nivel.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: nivel.cor, flexShrink: 0 }} />
              <span style={{ ...mono, fontSize: 18, color: n ? T.cream : T.mutedDim }}>{n}</span>
              <span style={{ fontSize: 12.5, color: T.muted }}>{nivel.label}</span>
            </div>
          ))}
        </div>

        {abertas.length === 0 ? (
          <EmptyState text="Ninguém no boletim. Plantel todo disponível." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {abertas.map(o => (
              <LinhaOcorrencia key={o.id} o={o} jogador={jogadorDe(o.playerId)}
                onAbrir={() => setModal({ tipo: 'ficha', id: o.id })}
                onAtualizar={() => setModal({ tipo: 'ficha', id: o.id, modo: 'atualizar' })} />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={`Histórico (${fechadas.length})`}
        action={fechadas.length ? (
          <Btn variant="ghost" onClick={() => setVerHistorico(v => !v)}>{verHistorico ? 'Esconder' : 'Ver'}</Btn>
        ) : null}
      >
        {fechadas.length === 0 ? (
          <EmptyState text="Ainda sem ocorrências fechadas." />
        ) : !verHistorico ? (
          <div style={{ fontSize: 12.5, color: T.mutedDim }}>
            {fechadas.length} {fechadas.length === 1 ? 'ocorrência com alta' : 'ocorrências com alta'}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fechadas.map((o, i) => {
              const mes = mesDaAlta(o);
              const novoMes = i === 0 || mesDaAlta(fechadas[i - 1]) !== mes;
              return (
                <React.Fragment key={o.id}>
                  {novoMes && (
                    <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', margin: i === 0 ? '0 0 2px' : '10px 0 2px' }}>
                      Altas de {mes}
                    </div>
                  )}
                  <LinhaOcorrencia o={o} jogador={jogadorDe(o.playerId)} onAbrir={() => setModal({ tipo: 'ficha', id: o.id })} destaque={voltouHa(o)} />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Panel>

      {modal === 'new' && (
        <OcorrenciaModal ocorrencia={null} players={players} onClose={() => setModal(null)} onSave={criar}
          clinico={clinico} onRecaida={criarRecaida} />
      )}

      {emFicha && (
        <FichaOcorrencia
          key={`${emFicha.id}-${modal.modo || ''}`}
          ocorrencia={emFicha}
          jogador={jogadorDe(emFicha.playerId)}
          modoInicial={modal.modo}
          onClose={() => setModal(null)}
          onGuardar={gravar}
          onEditarDados={() => mudarPara({ tipo: 'dados', id: emFicha.id })}
        />
      )}

      {emDados && (
        <OcorrenciaModal
          ocorrencia={emDados}
          players={players}
          onClose={() => mudarPara({ tipo: 'ficha', id: emDados.id })}
          onSave={(registo) => { gravar(registo); mudarPara({ tipo: 'ficha', id: registo.id }); }}
          onRemove={() => remove(emDados.id)}
        />
      )}
    </div>
  );
}

