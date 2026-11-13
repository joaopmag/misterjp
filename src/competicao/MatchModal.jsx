// competicao/MatchModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { lerHistoricoDoJogo, quemEstavaNoLugar } from './RepararJogos';
import { rotuloDoLugar, FORMACOES } from '../tatico/Simulador';
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import React, { useState, useEffect } from 'react';
import { useIsMobile, Modal, FIELD_GRID, Field, Select, Input, Btn } from '../base/ui';
import { todayStr, fmtShort } from '../base/utilidades';
import { FRIENDLY, competitionLabel, convocadosDoJogo } from '../dominio/jogos';
import { T } from '../base/tema';
import { estadoClinicoParaJogo } from '../dominio/clinico';
import { sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { Check } from 'lucide-react';
import { CartaoPlanoDoJogo, EscalacaoNoCampo, castigadosParaJogo, comQuemLaEsteve, escalacaoDoJogo, escalacaoNovaFormacao, withConvocadosInAttendance } from './Escalacao';
import { competitionByName, competitionGameDate, competitionOptions, competitionRoundLabels, competitionTeamNames, onzeProvavel } from './dados';
import { ConvidadosEditor, SelectAllBar } from '../dominio/convidados';
import { TabelaRelatorio } from './RelatoriosJogo';

export function MatchModal({ match, players: playersAtivosDoJogo, standings, season, onClose, onSave, clinico, onIntegrarConvidado, matches = [] }) {
  const players = React.useMemo(() => comQuemLaEsteve(playersAtivosDoJogo, match), [playersAtivosDoJogo, match]);
  // Só para o Relatório de jogo: no telemóvel, 8 colunas espremidas ficam
  // ilegíveis (nomes cortados, campos com um dígito de largura) — ver a
  // nota junto da tabela, mais abaixo.
  const isNarrowReport = useIsMobile(700);
  /* Os campos de lista têm de existir SEMPRE, mesmo ao abrir um jogo
     gravado antes de eles existirem. Sem isto, `f.report[p.id]` e
     `f.starters.includes(...)` rebentam ao editar um jogo antigo — e o
     resultado é a janela em branco, não uma mensagem. */
  const [f, setF] = useState(() => ({
    date: todayStr(), opponent: '', competition: FRIENDLY, result: '', jornada: '',
    convocados: [], starters: [], report: {}, ideias: '',
    ...(match || {}),
    // Jogos gravados antes deste campo existir vêm sem `ideias`; o
    // `?? ''` evita que o textarea passe de não-controlado a controlado
    // à primeira letra escrita (aviso do React e cursor a saltar).
    ideias: (match && match.ideias) || '',
    // Quem tem minutos no relatório volta à lista (ver `convocadosDoJogo`).
    convocados: match ? convocadosDoJogo(match) : [],
    starters: (match && match.starters) || [],
    report: (match && match.report) || {},
  }));
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_jogo_${match?.id || 'novo'}`, f, setF);
  // Lista das competições configuradas + "Amigável" (valor por omissão).
  // Se o jogo tiver uma competição antiga que já não está configurada, ela
  // continua a aparecer na lista para não se perder.
  const compAtual = competitionLabel(f.competition);
  const compOptions = [...new Set([...competitionOptions(standings), ...(compAtual ? [compAtual] : [])])];

  // Quando a competição escolhida já está configurada em Jogos, o
  // adversário e a jornada deixam de ser texto livre e passam a listas
  // com o que lá está — e a data vem do calendário da competição.
  const eAmigavel = competitionLabel(f.competition) === FRIENDLY;
  const comp = competitionByName(standings, f.competition);
  const equipas = competitionTeamNames(comp, season && season.club);
  const jornadas = competitionRoundLabels(comp);

  // Ao trocar de adversário ou de jornada, a data acompanha o que estiver
  // marcado na competição. Se esse jogo ainda não tiver data lá, mantém-se
  // a data que já estava no formulário — nunca se apaga o que foi escrito.
  const setFixture = (patch) => {
    const next = { ...f, ...patch };
    const data = competitionGameDate(comp, next.jornada, next.opponent);
    setF(data ? { ...next, date: data } : next);
  };

  /* OS PRIMEIROS ONZE ESCOLHIDOS SÃO O ONZE — em qualquer jogo, não só
     amigáveis. Um jogo oficial pode ainda vir com titulares já definidos
     pela convocatória (`onzeProvavel`), mas ao editar a lista de
     convocados aqui à mão a regra é sempre a mesma: sem isto, a lista
     começava toda no banco e obrigava a onze cliques extra em "Titular"
     para dizer o óbvio — os primeiros que se escolhem são os que
     começam a jogar.

     Não há limite de convocados: podem ir os 37. O onze é que tem onze
     lugares — a partir do décimo segundo escolhido, os seguintes ficam
     suplentes, e qualquer troca continua a fazer-se no botão
     Titular/Suplente da linha do jogador. */
  const toggleConvocado = (pid) => {
    const inList = f.convocados.includes(pid);
    if (inList) {
      const report = { ...f.report }; delete report[pid];
      setF({
        ...f, convocados: f.convocados.filter(id => id !== pid), starters: f.starters.filter(id => id !== pid), report,
        // Tirar alguém dos convocados também lhe tira a braçadeira, se a
        // tivesse — não pode continuar capitão de um jogo para o qual já
        // não está convocado.
        capitao: f.capitao === pid ? undefined : f.capitao,
        subcapitao: f.subcapitao === pid ? undefined : f.subcapitao,
      });
    } else {
      const convocados = [...f.convocados, pid];
      const promover = f.starters.length < 11;
      setF({ ...f, convocados, starters: promover ? [...f.starters, pid] : f.starters });
    }
  };
  const toggleStarter = (pid) => {
    const isStarter = f.starters.includes(pid);
    setF({ ...f, starters: isStarter ? f.starters.filter(id => id !== pid) : [...f.starters, pid] });
  };
  /* ESCALAÇÃO NO CAMPO: os lugares viram `alinhamento` + `starters`; o
     banco são os restantes convocados. Quem sai da convocatória perde o
     relatório e a braçadeira, como no clique da lista antiga. */
  /* AMIGÁVEL: VÃO TODOS. Quem não está no onze é suplente, fizesse ou não
     minutos. Ficam de fora só os indisponíveis nesse dia (Boletim Clínico;
     uma lesão do próprio dia não conta — ver `estadoClinicoParaJogo`) e
     quem tem falta, L ou escalão marcado nas Presenças deste jogo. */
  const ausentesAmigavel = eAmigavel ? new Map([
    ...(f.escalao || []).map(id => [id, 'Escalão']),
    ...(f.lesionados || []).map(id => [id, 'Lesionado']),
    ...(f.faltas || []).map(id => [id, 'Falta']),
  ]) : null;
  const escalacaoBase = escalacaoDoJogo(f, players);
  const escalacao = (() => {
    if (!eAmigavel) return escalacaoBase;
    const usados = new Set([...escalacaoBase.slots.filter(Boolean), ...escalacaoBase.banco]);
    const extra = sortByPosition(players.filter(p => !usados.has(p.id) && !ausentesAmigavel.has(p.id)
      && !((estadoClinicoParaJogo(p.id, f.date, clinico) || {}).avisaJogo))).map(p => p.id);
    return { ...escalacaoBase, banco: [...escalacaoBase.banco, ...extra] };
  })();
  /* LUGAR VAZIO NO ONZE: quem lá estava antes, segundo o histórico do jogo
     (Relato). Mostra-se e repõe-se com um toque; nada muda sozinho. */
  const [historicoJogo, setHistoricoJogo] = useState(null);
  const temLugarVazio = escalacao.slots.some(x => !x);
  useEffect(() => {
    if (!f.id || !temLugarVazio || historicoJogo || !T.equipaId) return undefined;
    let cancelado = false;
    lerHistoricoDoJogo(T.equipaId, f.id).then(l => { if (!cancelado) setHistoricoJogo(l); }).catch(() => { if (!cancelado) setHistoricoJogo([]); });
    return () => { cancelado = true; };
  }, [f.id, temLugarVazio, historicoJogo]);
  const lugaresPerdidos = (historicoJogo || []).length ? escalacao.slots.map((id, i) => {
    if (id) return null;
    const q = quemEstavaNoLugar(historicoJogo, i);
    if (!q || escalacao.slots.includes(q.id)) return null;
    return { i, ...q, p: players.find(x => x.id === q.id) || null };
  }).filter(Boolean) : [];
  const reporNoLugar = (i, id) => aplicarEscalacao({
    slots: escalacao.slots.map((x, k) => (k === i ? id : x)),
    banco: escalacao.banco.filter(x => x !== id),
  });
  const lugaresDaFormacao = FORMACOES[escalacao.formacao] || FORMACOES['4-3-3'];

  // O que se grava: num amigável, os convocados são o onze e o banco todo.
  const paraGravar = () => withConvocadosInAttendance(eAmigavel
    ? { ...f, convocados: [...new Set([...(f.convocados || []), ...escalacao.slots.filter(Boolean), ...escalacao.banco])] }
    : f);
  const aplicarEscalacao = ({ slots, banco }) => setF(prev => {
    const starters = slots.filter(Boolean);
    const convocados = [...starters, ...banco];
    const ficam = new Set(convocados);
    const report = Object.fromEntries(Object.entries(prev.report || {}).filter(([pid]) => ficam.has(pid)));
    return {
      ...prev, convocados, starters, alinhamento: slots, report,
      capitao: ficam.has(prev.capitao) ? prev.capitao : undefined,
      subcapitao: ficam.has(prev.subcapitao) ? prev.subcapitao : undefined,
    };
  });
  const mudarFormacaoEscalacao = (fm) => setF(prev => {
    const e = escalacaoNovaFormacao(escalacaoDoJogo(prev, players), fm, players);
    const starters = e.slots.filter(Boolean);
    return { ...prev, formacao: fm, alinhamento: e.slots, starters, convocados: [...starters, ...e.banco] };
  });
  // Mesmo mecanismo já usado em Convocatórias — clicar em "C" ou "SC"
  // marca esse jogador; clicar outra vez tira. Escolher um novo capitão
  // tira a braçadeira a quem a tinha antes, nunca ficam dois ao mesmo
  // tempo. Fica aqui também (não só na convocatória formal) porque
  // muitos jogos são geridos só por aqui, sem nunca abrir a outra
  // página — sem isto, não havia como escolher capitão nesses jogos.
  const setBracadeira = (pid, papel) => {
    setF(prev => {
      const outro = papel === 'capitao' ? 'subcapitao' : 'capitao';
      const jaTem = prev[papel] === pid;
      return {
        ...prev,
        [papel]: jaTem ? undefined : pid,
        [outro]: prev[outro] === pid ? undefined : prev[outro],
      };
    });
  };
  const setReport = (pid, field, val) => {
    setF(prev => {
      const novo = { ...prev, report: { ...prev.report, [pid]: { ...(prev.report[pid] || {}), [field]: val } } };
      // A nota é a MESMA coisa em dois sítios da app (aqui, e na tabela
      // de Presenças) — sem isto, dava para ficarem duas notas
      // diferentes para o mesmo jogador no mesmo jogo, consoante onde se
      // editasse por último.
      if (field === 'rating') {
        const numero = val !== '' && val != null ? Number(val) : null;
        novo.ratings = { ...(prev.ratings || {}) };
        if (numero == null || Number.isNaN(numero)) delete novo.ratings[pid];
        else novo.ratings[pid] = numero;
      }
      return novo;
    });
  };

  const noJogo = eAmigavel ? new Set([...f.convocados, ...escalacao.slots.filter(Boolean), ...escalacao.banco]) : new Set(f.convocados);
  const convocadoPlayers = players.filter(p => noJogo.has(p.id));

  return (
    <Modal title={match ? 'Editar jogo' : 'Novo jogo'} onClose={onClose} wide xwide fullPage>
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      <div style={{ ...FIELD_GRID, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 12 }}>
        <Field label="Competição">
          <Select value={compAtual} onChange={e => setF({ ...f, competition: e.target.value, opponent: '', jornada: '' })}>
            <option value="">— sem competição —</option>
            {compOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Adversário">
          {equipas.length > 0 ? (
            <Select value={f.opponent || ''} onChange={e => setFixture({ opponent: e.target.value })}>
              <option value="">— escolher equipa —</option>
              {equipas.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          ) : (
            <Input value={f.opponent} onChange={e => setF({ ...f, opponent: e.target.value })} placeholder="Ex: FC Foz" />
          )}
        </Field>
        {/* Um amigável não pertence a nenhuma jornada — o campo só
            confundiria e ficaria sempre vazio. */}
        {!eAmigavel && (
          <Field label="Jornada">
            {jornadas.length > 0 ? (
              <Select value={f.jornada || ''} onChange={e => setFixture({ jornada: e.target.value })}>
                <option value="">— sem jornada —</option>
                {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
              </Select>
            ) : (
              <Input value={f.jornada || ''} onChange={e => setF({ ...f, jornada: e.target.value })} placeholder="ex: Jornada 12" />
            )}
          </Field>
        )}
        <Field label="Data"><Input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        {/* Casa/fora decide de que lado o encontro é escrito na tabela da
            competição e como o resultado é lido — sem isto, um jogo lançado
            à mão entrava sempre como se fosse em casa. */}
        <Field label="Casa / Fora">
          <Select
            value={f.atHome === false ? 'fora' : 'casa'}
            onChange={e => setF({ ...f, atHome: e.target.value === 'casa' })}
          >
            <option value="casa">Casa</option>
            <option value="fora">Fora</option>
          </Select>
        </Field>
        <Field label="Resultado (casa-fora)"><Input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder={f.atHome === false ? 'Ex: 1-2 (golos deles primeiro)' : 'Ex: 2-1 (nossos golos primeiro)'} /></Field>
      </div>
      {/* AMIGÁVEL: a convocatória não nasce sozinha (como nos jogos
          oficiais). Pergunta-se aqui, que é onde o amigável se cria. */}
      {eAmigavel && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, margin: '-4px 0 16px', fontSize: 13.5, color: T.cream, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!f.comConvocatoria} onChange={e => setF({ ...f, comConvocatoria: e.target.checked })}
            style={{ accentColor: T.crimson, width: 16, height: 16, marginTop: 2 }} />
          <span>
            Gerar convocatória deste amigável
            <span style={{ display: 'block', fontSize: 11.5, color: T.mutedDim, marginTop: 2 }}>
              Aparece em Convocatórias, para imprimir ou mostrar no Portal (começa escondida dos jogadores).
            </span>
          </span>
        </label>
      )}

      {/* IDEIAS PARA O JOGO — nota interna do treinador (como se quer
          atacar, pressionar, bolas paradas, o que vigiar no adversário).
          Fica fora da grelha de campos curtos porque é texto corrido e
          precisa da largura toda; aparece na ficha do jogo, por baixo do
          campo. Já não tem interruptor para o Portal do Atleta — essa
          partilha passou a fazer-se pelas Ideias de Jogo com diagrama,
          marcadas como "Visível no Portal → Jogos → Plano de Jogo" (ver
          IdeiaModal), que é mais claro para o atleta do que um texto
          solto sem imagem. */}
      {/* "Ideias para o jogo" passou para a ficha do jogo e para o Plano
          de Jogo (ver NotasDoJogo) — o texto continua guardado no jogo. */}

      {/* Num amigável não há convocatória: vai quem aparece. A lista é a
          mesma, mas chama-se pelo que é — presenças — e a matriz de
          presenças mostra P/NP em vez de C/NC (ver isFriendlyMatch). */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          {/* Largura fixa e números de largura igual: escolher ou limpar
              convocados já não empurra os botões e a caixa ao lado. */}
          <span style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', minWidth: '13.5em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {eAmigavel ? 'Presenças' : 'Convocados'} · {noJogo.size}/{players.length}
          </span>
          {players.length > 0 && (
            <SelectAllBar
              onSelectAll={() => {
                // Quem está indisponível (lesão/doença marcada como tal no
                // boletim clínico) NAQUELA data não entra — nem como
                // convocado, nem muito menos como titular. "Selecionar
                // todos" é para poupar cliques, não para convocar quem
                // está de fora.
                const castigoJ = castigadosParaJogo(matches, f.date, f.id);
                const disponiveis = players.filter(p => {
                  const estado = estadoClinicoParaJogo(p.id, f.date, clinico);
                  return !(estado && estado.avisaJogo) && !castigoJ.has(p.id);
                });
                const ids = sortByPosition(disponiveis).map(p => p.id);
                // "Selecionar todos" tem de escolher um onze que FAÇA
                // SENTIDO para a formação do jogo — não os primeiros 11
                // pela ordem fixa GR/DC/DE/DD/MD/MC/MOC/EE/ED/PL, que
                // deixava posições de ataque vazias sempre que o plantel
                // tivesse mais defesas do que avançados (ver `onzeProvavel`,
                // o mesmo critério já usado quando o onze vem de uma
                // convocatória).
                //
                // `alinhamento: null` — um jogo já visto antes pode trazer
                // um alinhamento manual de uma seleção anterior. Sem isto,
                // esse alinhamento antigo continuava a mandar em qualquer
                // jogador que calhasse repetir-se na nova seleção, dando a
                // sensação de que a app "se lembrava" da equipa de antes em
                // vez de fazer uma escolha nova a sério.
                setF({
                  ...f, convocados: ids,
                  starters: onzeProvavel(ids, players, (match && match.formacao) || '4-3-3'),
                  alinhamento: null,
                });
              }}
              onClear={() => setF({ ...f, convocados: [], starters: [], report: {}, alinhamento: null })}
            />
          )}
          {!eAmigavel && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!f.convocatoriaVisivelAtletas}
                onChange={e => setF({ ...f, convocatoriaVisivelAtletas: e.target.checked })}
                style={{ width: 15, height: 15, accentColor: T.crimson, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11.5, color: T.mutedDim }}>Visível no Portal (cada convocado vê só que está convocado)</span>
            </label>
          )}
        </div>
        {/* A regra é invisível se não for dita: quem escolhe o décimo
            segundo jogador tem de perceber porque é que ele não ficou
            titular como os anteriores. Vale para qualquer jogo, não só
            amigáveis — é a mesma regra que já usávamos em Convocatórias. */}
        {lugaresPerdidos.map(l => (
          <div key={l.i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 10px', padding: '9px 12px', borderRadius: 9, background: `${T.gold}14`, border: `1px solid ${T.gold}66`, fontSize: 13, color: T.cream }}>
            <span style={{ flex: '1 1 260px' }}>
              Lugar <strong>{rotuloDoLugar(lugaresDaFormacao[l.i])}</strong> vazio: estava {l.p ? <strong>{shortPlayerName(l.p, players)}</strong> : 'um jogador que já não está no plantel'}
              <span style={{ color: T.mutedDim }}> · saiu a {fmtShort(String(l.em).slice(0, 10))}{l.por ? ` (alteração de ${l.por})` : ''}</span>
            </span>
            {l.p && <Btn variant="ghost" onClick={() => reporNoLugar(l.i, l.id)} style={{ padding: '5px 12px', fontSize: 12.5 }}>Repor no lugar</Btn>}
          </div>
        ))}
        <EscalacaoNoCampo
          acao={f.id ? <CartaoPlanoDoJogo jogo={f} /> : null}
          players={players}
          formacao={escalacao.formacao}
          slots={escalacao.slots}
          banco={escalacao.banco}
          onChange={aplicarEscalacao}
          onFormacao={mudarFormacaoEscalacao}
          clinico={clinico}
          data={f.date}
          castigados={castigadosParaJogo(matches, f.date, f.id)}
          amigavel={eAmigavel}
          ausentes={ausentesAmigavel}
          minutos={Object.fromEntries(Object.entries(f.report || {}).map(([pid, r]) => [pid, r && r.minutes]))}
        />
      </div>

      <ConvidadosEditor
        convidados={f.convidados}
        onChange={(lista) => setF({ ...f, convidados: lista })}
        onIntegrar={onIntegrarConvidado ? (c) => onIntegrarConvidado(c, null, f.convidados) : null}
      />

      {convocadoPlayers.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Relatório de jogo
          </div>
          <TabelaRelatorio
            jogadores={sortByPosition(convocadoPlayers)} players={players} report={f.report} starters={f.starters}
            capitao={f.capitao} subcapitao={f.subcapitao}
            onReport={setReport} onTitular={toggleStarter} estreito={isNarrowReport} alturaMax={360}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={!f.date} onClick={() => { limpar(); onSave(paraGravar()); }}><Check size={15} /> Guardar jogo</Btn>
      </div>
    </Modal>
  );
}

