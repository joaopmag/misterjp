// plantel/Presencas.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, mono, body } from '../base/tema';
import React, { useState } from 'react';
import { todayStr, fmtDate, uid } from '../base/utilidades';
import { ChevronLeft, ChevronRight, Pencil, Check, RefreshCw, Download } from 'lucide-react';
import { isFriendlyMatch } from '../dominio/jogos';
import { shortPlayerName, sortByPosition } from '../dominio/jogadores';
import { Select, askConfirm, Btn, SectionHeader, EmptyState } from '../base/ui';
import { dayPresent, dayRating, groupSessionsByDate } from '../dominio/estatisticas';
import { estadoClinicoEm } from '../dominio/clinico';
import { ESTILO_BOTAO_PEQUENO, ICONE_BOTAO_PEQUENO } from './Prancheta';
import { csvEscape } from '../atleta/questionarios';
import { diaAutoLesionado } from './clinicoDados';
import { Badge } from './comum';
import { OcorrenciaModal, proporMarcacaoClinica } from './Clinico';

/* ---------------------------------------------------------------
   PRESENÇAS — controlo de assiduidade ao longo da época, com
   resumo por jogador e edição de presença + nota, sessão a sessão.
---------------------------------------------------------------- */
/* Um dia de treino pode ser "fechado": depois de marcadas as presenças e
   atribuídas as notas, guarda-se e o dia passa a leitura apenas. Só o
   botão "Editar" volta a abrir — evita cliques acidentais numa lista
   longa de jogadores dias depois. A marca fica gravada em todas as
   sessões desse dia (campo attendanceClosed), por isso sincroniza para
   toda a equipa técnica como qualquer outra alteração. */
/* Tabela-resumo das presenças. Colunas = dias (treinos e jogos, na ordem
   do calendário), linhas = jogadores. Cada célula tem o estado e a nota:
     · treino → P (presente) / NP (não presente), por omissão NP
     · jogo   → C (convocado) / NC (não convocado), por omissão NC, mas já
                marcado a C para quem consta da convocatória desse dia
   Dias fechados aparecem só de leitura. */
export function AttendanceMatrix({ days, players, isPresent, estadoDe, ratingOf, dayClosed, onToggle, onRating, onSetClosed, monthControl }) {
  const ordered = [...days].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (ordered.length === 0 || players.length === 0) return null;

  /* CABEÇALHO E COLUNA DO NOME FIXOS — SEM PARECER UMA CAIXA À PARTE.

     `position:sticky` só funciona presa a um ancestral que faça scroll;
     sem lhe dar altura limitada (`maxHeight` + `overflow`), não há a
     quem o cabeçalho se prender, e perde-se de vista ao descer a lista
     de jogadores. Isso continua a ser verdade — por isso o scroll
     próprio volta.

     O que dava ar de "caixa dentro da página" não era o scroll em si:
     era a MOLDURA (borda + cantos arredondados) à volta dele, a marcar
     visualmente onde a caixa começa e acaba. Sem moldura, e com uma
     barra de deslocamento fina e da cor do fundo (ver `.mjp-scroll-fino`
     mais acima), o scroll continua a acontecer aqui dentro — mas não se
     vê a "caixa", só a tabela. */
  const headCell = {
    padding: '6px 4px', fontSize: 10, color: T.muted, textAlign: 'center',
    borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap', minWidth: 78,
    position: 'sticky', top: 0, background: T.surface, zIndex: 2,
  };
  const nameCell = {
    padding: '6px 8px', fontSize: 12.5, color: T.cream, whiteSpace: 'nowrap',
    position: 'sticky', left: 0, background: T.surface, zIndex: 1, borderRight: `1px solid ${T.line}`,
  };
  // O canto pertence aos dois eixos, e fica por cima de ambos.
  const cornerCell = { ...headCell, ...nameCell, position: 'sticky', top: 0, left: 0, zIndex: 3 };
  // Largura/altura de sobra para empurrar a barra nativa para fora da
  // vista (ver comentário mais abaixo, onde é usada). Generosa (20px)
  // de propósito — cobre até às barras mais grossas do Windows.
  const SBAR = 20;
  /* SEM BARRA VISÍVEL, PRECISA DE OUTRA MANEIRA DE ANDAR PARA OS LADOS.

     Escondida a barra, quem só tem rato (sem trackpad nem ecrã tátil)
     ficava sem forma nenhuma de chegar às datas mais recentes — a roda
     do rato só desce, não desliza para o lado sozinha. Estes dois
     botões deslocam a tabela na horizontal na mesma, só que de forma
     visível e clicável, substituindo a barra em vez de a trazer de
     volta. */
  const scrollRef = React.useRef(null);
  const molduraRef = React.useRef(null); // a caixa de fora (corta a barra) — nunca deve ficar deslocada
  const scrollPor = (dx) => { if (scrollRef.current) scrollRef.current.scrollBy({ left: dx, behavior: 'smooth' }); };
  // Referência a cada coluna de dia, só para se poder saltar direto para
  // ela — ver o efeito mais abaixo, que traz "hoje" para a vista assim
  // que a tabela abre.
  const thRefs = React.useRef({});

  /* AO ABRIR, MOSTRAR HOJE — NÃO O DIA MAIS ANTIGO.

     Sem isto, a tabela abria sempre lá atrás, no primeiro treino da
     época, obrigando a percorrer meses de histórico com os botões ◀▶
     só para chegar aos dias recentes, que são os que interessam no
     dia a dia. Salta para o dia de hoje (ou, se hoje não tiver
     treino/jogo marcado, para o último dia já passado — o mais
     provável de ainda ter presenças por preencher; sem nenhum passado,
     para o primeiro dia futuro).

     A dependência é a LISTA de dias (datas, por ordem), não o array
     `ordered` em si — esse é recriado a cada render (o `[...days].sort`
     lá em cima), por isso usá-lo diretamente fazia o efeito disparar
     mesmo ao marcar uma presença, saltando a vista para hoje a meio de
     se editar outro dia qualquer. Com a chave a só mudar quando os
     PRÓPRIOS dias mudam (mês filtrado, sessão nova), o salto só
     acontece quando a tabela abre ou muda de conteúdo — nunca por
     interagir com uma célula. */
  const diasKey = ordered.map(d => (d.match ? `m-${d.match.id}` : d.date)).join(',');
  /* Altura do lugar da nota, igual em todas as células: a de uma lista
     (26px) só quando há algum dia aberto para editar; com tudo guardado, a
     nota é só um número pequeno e chega a altura dele — senão sobrava
     espaço por baixo e o bloco parecia descaído para cima. */
  const alturaNota = ordered.some(d => !dayClosed(d)) ? 26 : 15;
  React.useEffect(() => {
    const hojeStr = todayStr();
    let alvo = ordered.find(d => d.date === hojeStr);
    if (!alvo) {
      const passados = ordered.filter(d => d.date <= hojeStr);
      alvo = passados.length ? passados[passados.length - 1] : ordered[0];
    }
    if (!alvo) return;
    const key = alvo.match ? `m-${alvo.match.id}` : alvo.date;
    const el = thRefs.current[key];
    const cont = scrollRef.current;
    // Desloca SÓ a caixa da tabela. Antes usava-se scrollIntoView, que
    // desloca também TODAS as caixas à volta — incluindo a moldura de
    // fora (overflow escondido, 20px mais estreita de propósito, ver SBAR).
    // Essa moldura ficava deslocada uns pixéis para a esquerda e cortava
    // o início da coluna dos jogadores ("GR", "DC" meio comidos).
    if (el && cont) {
      const cr = cont.getBoundingClientRect(), er = el.getBoundingClientRect();
      cont.scrollLeft += (er.left - cr.left) - (cont.clientWidth - er.width) / 2;
    }
    if (molduraRef.current) { molduraRef.current.scrollLeft = 0; molduraRef.current.scrollTop = 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasKey]);

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Presença e nota por dia
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', gap: 4 }}>
            <button
              type="button" onClick={() => scrollPor(-320)} title="Ver dias anteriores"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
                borderRadius: 6, background: 'transparent', border: `1px solid ${T.line}`, color: T.cream, cursor: 'pointer',
              }}
            ><ChevronLeft size={15} /></button>
            <button
              type="button" onClick={() => scrollPor(320)} title="Ver dias seguintes"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
                borderRadius: 6, background: 'transparent', border: `1px solid ${T.line}`, color: T.cream, cursor: 'pointer',
              }}
            ><ChevronRight size={15} /></button>
          </span>
          {monthControl}
        </div>
      </div>
      {/* SEM DEPENDER DE NENHUMA PROPRIEDADE CSS DE SCROLLBAR.

          As duas tentativas anteriores (`::-webkit-scrollbar`,
          `scrollbar-width`) deviam chegar em qualquer Chrome atual — e
          não chegaram, o que só se explica se algo aqui as estiver a
          ignorar (uma extensão do browser, uma política do sistema,
          ou uma diferença qualquer que não dá para prever daqui).

          Esta versão não depende de o browser SUPORTAR esconder a
          barra: empurra-a fisicamente para FORA da zona visível. A
          caixa de dentro é maior do que a de fora (mais larga e mais
          alta, em `SBAR` pixels) — é nessa sobra que o browser desenha
          a barra, tanto a de baixo como a da direita — e a caixa de
          fora, com overflow escondido e o tamanho "normal", corta essa
          sobra fora da vista. É só geometria: funciona em qualquer
          browser, sem exceção.

          Mas sem barra, precisa dos botões ◀ ▶ ali em cima para andar
          para os lados — ver `scrollRef`/`scrollPor`. */}
      <div ref={molduraRef} onScroll={e => { if (e.currentTarget.scrollLeft || e.currentTarget.scrollTop) { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; } }}
        style={{ overflow: 'hidden', maxHeight: 'calc(100vh - 220px)' }}>
        <div ref={scrollRef} className="mjp-scroll-fino" style={{
          overflow: 'auto', maxHeight: `calc(100vh - 220px + ${SBAR}px)`,
          width: `calc(100% + ${SBAR}px)`,
        }}>
          {/* Folga de SBAR à direita e em baixo: a caixa de dentro é SBAR
              maior do que a de fora (que corta essa sobra), por isso sem esta
              folga a última linha (e a última coluna) ficavam sempre meio
              escondidas, mesmo com a tabela deslocada até ao fim. */}
          <div style={{ display: 'inline-block', paddingRight: SBAR, paddingBottom: SBAR }}>
          <table style={{ borderCollapse: 'collapse', width: 'auto' }}>
            <thead>
              <tr>
                <th style={{ ...cornerCell, textAlign: 'left', color: T.muted, fontSize: 10 }}>Jogador</th>
                {ordered.map(d => {
                const closed = dayClosed(d);
                return (
                  <th key={d.match ? `m-${d.match.id}` : d.date} ref={el => { thRefs.current[d.match ? `m-${d.match.id}` : d.date] = el; }} style={headCell}>
                    <div style={{ ...mono, color: d.match ? T.warn : T.mutedDim }}>{dayShort(d.date)}</div>
                    <div style={{ fontSize: 9, color: T.mutedDim, marginBottom: 4 }}>
                      {d.match ? (isFriendlyMatch(d.match) ? 'amigável' : 'jogo') : 'treino'}
                    </div>
                    {/* Guardar fecha a coluna (fica só de leitura); Editar
                        volta a abri-la. Substitui os cartões dia a dia. */}
                    <button
                      type="button"
                      onClick={() => onSetClosed(d, !closed)}
                      title={closed ? 'Reabrir para editar' : 'Guardar as presenças deste dia'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6,
                        fontSize: 9.5, cursor: 'pointer', ...body, fontWeight: 600,
                        background: closed ? 'transparent' : `${T.good}22`,
                        color: closed ? T.mutedDim : T.good,
                        border: `1px solid ${closed ? T.line : T.good}66`,
                      }}
                    >
                      {closed ? <><Pencil size={9} /> Editar</> : <><Check size={9} /> Guardar</>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} style={{ borderTop: `1px solid ${T.line}` }}>
                {/* Nome curto: primeiro nome, ou apelido quando há outro
                    jogador com o mesmo primeiro nome. O nome completo fica
                    no title, para quando houver dúvida. */}
                {/* TUDO CENTRADO NA LINHA: o nome e, em cada dia, o bloco botão
                    + nota ficam ao meio, à mesma distância da linha de cima e
                    da de baixo. Cada célula reserva sempre o lugar da nota
                    (mesmo sem nota), por isso os botões de uma linha ficam
                    todos à mesma altura. */}
                <td style={{ ...nameCell, verticalAlign: 'middle' }} title={p.name}>{p.position ? `${p.position} · ` : ''}{shortPlayerName(p, players)}</td>
                {ordered.map(d => {
                  const estado = estadoDe(d, p.id);
                  const on = estado === 'presente';
                  const falta = estado === 'falta';
                  const lesao = estado === 'lesionado';
                  const escalao = estado === 'escalao';
                  const closed = dayClosed(d);
                  const rating = ratingOf(d, p.id);
                  // Amigável conta presenças como um treino, não convocatória.
                  const convocatoria = d.match && !isFriendlyMatch(d.match);
                  const label = escalao ? 'E' : (lesao ? 'L' : (falta ? 'F' : (convocatoria ? (on ? 'C' : 'NC') : (on ? 'P' : 'NP'))));
                  return (
                    <td key={(d.match ? `m-${d.match.id}` : d.date) + p.id} style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                      <button
                        type="button"
                        onClick={() => { if (!closed) onToggle(d, p.id); }}
                        disabled={closed}
                        title={closed ? 'Dia guardado — usa "Editar" no cartão do dia' : ''}
                        style={{
                          width: 34, height: 24, lineHeight: '14px', padding: '4px 0', borderRadius: 6, fontSize: 11, ...mono, fontWeight: 600, boxSizing: 'border-box',
                          cursor: closed ? 'default' : 'pointer',
                          // A falta salta à vista: é o estado que exige
                          // reação do treinador, ao contrário do NP.
                          /* A lesão tem cor própria (âmbar) e não a vermelha
                             da falta: são ausências, mas uma é um problema
                             de compromisso e a outra é clínico. */
                          /* O E tem azul: é o único destes estados que não
                             é ausência nenhuma — o jogador esteve a jogar,
                             só que noutro escalão. */
                          background: escalao ? `${T.teamB}2A` : (lesao ? `${T.gold}2A` : (falta ? `${T.bad}33` : (on ? (d.match ? `${T.warn}33` : `${T.crimson}44`) : 'transparent'))),
                          color: escalao ? T.teamB : (lesao ? T.gold : (falta ? T.bad : (on ? T.cream : T.mutedDim))),
                          border: `1px solid ${escalao ? T.teamB : (lesao ? T.gold : (falta ? T.bad : (on ? (d.match ? T.warn : T.gold) : T.line)))}`,
                        }}
                        title={closed ? 'Dia guardado — usa "Editar" no cartão do dia' : 'Clica para alternar: presente → falta → outro escalão → lesionado → ausente'}
                      >{label}</button>
                      <div style={{ height: alturaNota, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on && (
                        closed ? (
                          <div style={{ ...mono, fontSize: 10.5, lineHeight: '15px', color: rating == null || rating === '' ? T.mutedDim : T.cream }}>
                            {rating == null || rating === '' ? 'NA' : rating}
                          </div>
                        ) : (
                          /* Lista em vez de campo numérico: no telemóvel as
                             setinhas do <input type=number> são minúsculas e
                             disparavam duas vezes. "NA" (sem nota) é o valor
                             de partida — um jogador pode estar presente e
                             lesionado, ou convocado e não jogar. */
                          <Select
                            value={rating == null || rating === '' ? '' : String(rating)}
                            onChange={e => onRating(d, p.id, e.target.value)}
                            style={{ width: 46, padding: '0 2px', height: 26, lineHeight: '24px', fontSize: 11, textAlign: 'center' }}
                          >
                            <option value="">NA</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                          </Select>
                        )
                      )}
                      </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          </table>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 8, lineHeight: 1.5 }}>
        Treinos: P presente / NP não presente. Jogos: C convocado / NC não convocado.
        Toca para alternar. A nota (1–10) só aparece em quem está P ou C e começa em <span style={{ color: T.cream }}>NA</span> —
        sem nota não conta para a média (jogador presente mas lesionado, ou convocado que não jogou).
      </div>
    </div>
  );
}

export function dayIsClosed(list) {
  return (list || []).some(s => s.attendanceClosed);
}

export const MONTH_NAMES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const monthKeyOf = (dateStr) => String(dateStr || '').slice(0, 7);

export function monthLabelPt(key) {
  const [y, m] = String(key).split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES_PT[idx] || m} ${y}`;
}

export const dayShort = (dateStr) => `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;

/* Exporta a relação de presenças em CSV (separador ";", com BOM, para
   abrir direito no Excel em português). Um bloco por mês, com uma coluna
   por dia de treino e duas tabelas: presenças (P/F) e notas de treino. */
export function exportAttendanceCSV({ players, dayGroups, monthKeys }) {
  const rows = [];
  monthKeys.forEach((key, mi) => {
    const days = dayGroups
      .filter(d => monthKeyOf(d.date) === key)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!days.length) return;
    if (mi > 0) rows.push([]);
    rows.push([`MÊS: ${monthLabelPt(key).toUpperCase()}`]);
    rows.push([`Dias de treino: ${days.length}`]);
    rows.push([]);

    // Helpers comuns aos vários blocos.
    const presente = (d, p) => (d.match
      ? (Array.isArray(d.match.attendance) ? d.match.attendance : (d.match.convocados || [])).includes(p.id)
      : dayPresent(d.list, p.id));
    const nota = (d, p) => {
      const r = d.match ? ((d.match.ratings || {})[p.id] ?? null) : dayRating(d.list, p.id);
      return (r == null || r === '') ? '' : String(r).replace('.', ',');
    };
    const media = (cells) => {
      const vals = cells.filter(c => c !== '').map(c => Number(String(c).replace(',', '.')));
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1).replace('.', ',') : 'NA';
    };
    const treinos = days.filter(d => !d.match);
    /* Amigáveis contam como presenças (P/NP) e não como convocatória: é a
       mesma regra que a tabela no ecrã usa. */
    const jogosOficiais = days.filter(d => !!d.match && !isFriendlyMatch(d.match));
    const amigaveis = days.filter(d => !!d.match && isFriendlyMatch(d.match));
    const jogos = jogosOficiais;
    const head = (list) => list.map(d => `${dayShort(d.date)}${d.match ? ' (J)' : ''}`);

    const comPresencas = [...treinos, ...amigaveis].sort((a, b) => new Date(a.date) - new Date(b.date));
    rows.push(['TREINOS E AMIGÁVEIS · PRESENÇAS (P = presente, NP = não presente)']);
    rows.push(['Jogador', 'Posição', ...head(comPresencas), 'Presenças', 'Sessões', 'Assiduidade %']);
    players.forEach(p => {
      const cells = comPresencas.map(d => (presente(d, p) ? 'P' : 'NP'));
      const att = cells.filter(c => c === 'P').length;
      rows.push([
        p.name, p.position || '', ...cells,
        att, comPresencas.length, comPresencas.length ? Math.round((att / comPresencas.length) * 100) : '',
      ]);
    });
    rows.push([]);

    rows.push(['TREINOS E AMIGÁVEIS · NOTAS (NA = sem nota atribuída)']);
    rows.push(['Jogador', 'Posição', ...head(comPresencas), 'Nota média']);
    players.forEach(p => {
      const cells = comPresencas.map(d => (presente(d, p) ? nota(d, p) : ''));
      rows.push([p.name, p.position || '', ...cells.map(c => (c === '' ? 'NA' : c)), media(cells)]);
    });
    rows.push([]);

    rows.push(['JOGOS OFICIAIS · CONVOCATÓRIA (C = convocado, NC = não convocado)']);
    rows.push(['Jogador', 'Posição', ...jogos.map(d => `${dayShort(d.date)} ${d.match.opponent || ''}`.trim()), 'Convocatórias', 'Jogos', '%']);
    players.forEach(p => {
      const cells = jogos.map(d => (presente(d, p) ? 'C' : 'NC'));
      const conv = cells.filter(c => c === 'C').length;
      rows.push([
        p.name, p.position || '', ...cells,
        conv, jogos.length, jogos.length ? Math.round((conv / jogos.length) * 100) : '',
      ]);
    });
    rows.push([]);

    rows.push(['JOGOS · NOTAS (NA = sem nota atribuída)']);
    rows.push(['Jogador', 'Posição', ...jogos.map(d => `${dayShort(d.date)} ${d.match.opponent || ''}`.trim()), 'Nota média jogo']);
    players.forEach(p => {
      const cells = jogos.map(d => (presente(d, p) ? nota(d, p) : ''));
      rows.push([p.name, p.position || '', ...cells.map(c => (c === '' ? 'NA' : c)), media(cells)]);
    });
  });

  if (!rows.length) return false;
  const csv = rows.map(r => r.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presencas-${monthKeys.length === 1 ? monthKeys[0] : 'epoca'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function Presencas({ players, sessions, setSessions, matches, setMatches, convocatorias, season, clinico, setClinico }) {
  /* Ocorrência a criar a partir de um L, já com jogador e data. Fica em
     estado à parte porque a janela abre DEPOIS de a presença ser gravada:
     o registo clínico é um extra, não uma condição para marcar presenças. */
  const [novaOcorrencia, setNovaOcorrencia] = useState(null);
  const todayStart = new Date(new Date().toDateString());
  /* Os jogos entram nas presenças como um "dia" próprio, para se poder
     confirmar quem esteve presente e dar nota, tal como num treino. A
     presença e a nota do jogo ficam guardadas no próprio jogo
     (attendance/ratings), não nas sessões. */
  const matchDays = (matches || [])
    .filter(m => m.date)
    .map(m => ({ date: m.date, match: m }));
  // Agrupado por data: se houver mais do que uma sessão no mesmo dia
  // (ex: uma por exercício), conta e edita-se como um único dia de treino.
  // Dias de folga (fase "Descanso") não entram na assiduidade — não há
  // presenças nem notas a registar num dia sem treino.
  /* AS SESSÕES CRIADAS A PARTIR DE UM JOGO NÃO CONTAM AQUI.

     Qualquer jogo — amigável ou oficial — cria uma sessão no Planeamento
     (ver ensureMatchSession) para aparecer na agenda da semana e entrar na
     carga de treino. Mas o jogo JÁ tem a sua própria coluna de presenças
     nesta tabela — a que diz "amigável" ou o nome da competição. Deixar a
     sessão entrar também dava duas colunas para o mesmo dia: uma "treino"
     e outra do jogo, com as presenças a serem marcadas em duplicado.

     A sessão é reconhecida pelo `sourceMatchId`, que guarda o jogo que a
     originou. Só se esconde se esse jogo ainda existir: se o jogo for
     apagado, a sessão fica órfã e volta a valer por si, para não
     desaparecer um dia de trabalho da tabela. */
  const idsDeJogos = new Set((matches || []).map(m => m.id));
  const sessoesProprias = (sessions || []).filter(x => !(x.sourceMatchId && idsDeJogos.has(x.sourceMatchId)));
  const trainingDays = groupSessionsByDate(sessoesProprias).filter(d => !d.list.every(s => s.phase === 'Descanso'));
  const dayGroups = [...trainingDays, ...matchDays].sort((a, b) => new Date(b.date) - new Date(a.date));
  // Só conta como confirmado a partir do dia seguinte à data do treino.
  const confirmedDays = dayGroups.filter(d => new Date(d.date + 'T00:00:00') < todayStart);

  // Meses com dias de treino, do mais recente para o mais antigo.
  const monthKeys = [...new Set(dayGroups.map(d => monthKeyOf(d.date)))].sort().reverse();
  const [month, setMonth] = useState('todos');
  const visibleDays = month === 'todos' ? dayGroups : dayGroups.filter(d => monthKeyOf(d.date) === month);

  const orderedPlayers = sortByPosition(players);
  // Leitura/escrita unificada: um dia é de treino (tem `list`) ou de jogo
  // (tem `match`).
  /* Num jogo, o valor de partida vem da convocatória: quem foi convocado
     no jogo (ou na convocatória com a mesma data) aparece já como
     convocado nesta tabela. Assim que o staff toca numa célula, passa a
     valer a lista `attendance` do jogo e a convocatória deixa de mandar. */
  const convocadosOf = (match) => {
    if (Array.isArray(match.attendance)) return match.attendance;
    const conv = (convocatorias || []).find(c => c.data === match.date);
    const fromMatch = match.convocados || [];
    const fromConv = (conv && conv.convocados) || [];
    return [...new Set([...fromMatch, ...fromConv])];
  };
  const isPresent = (d, pid) => (d.match ? convocadosOf(d.match).includes(pid) : dayPresent(d.list, pid));
  /* Estado de um jogador num dia: presente, falta ou ausente.
     A ordem importa — quem está marcado como presente é presente, mesmo
     que por engano também esteja na lista de faltas. */
  const estadoDe = (d, pid) => {
    // Uma marcação explícita (falta/lesionado/escalão) tem sempre
    // prioridade sobre "presente" — não o contrário. Em dias de jogo,
    // "presente" vem de `convocadosOf`, que — quando o jogo ainda não
    // tem `attendance` próprio gravado — junta também a lista da
    // tabela Convocatórias em separado. Essa tabela não é tocada ao
    // marcar falta/lesionado/escalão aqui, por isso podia continuar a
    // incluir o jogador e fazer o clique voltar sozinho a "presente"
    // no instante a seguir — exatamente o "clico em F e salta para P"
    // relatado. Verificando as marcações explícitas primeiro, um
    // toque na célula nunca é anulado por essa segunda lista.
    const faltas = d.match ? (d.match.faltas || []) : (d.list || []).flatMap(x => x.faltas || []);
    if (faltas.includes(pid)) return 'falta';
    const lesionados = d.match ? (d.match.lesionados || []) : (d.list || []).flatMap(x => x.lesionados || []);
    if (lesionados.includes(pid)) return 'lesionado';
    const escalao = d.match ? (d.match.escalao || []) : (d.list || []).flatMap(x => x.escalao || []);
    if (escalao.includes(pid)) return 'escalao';
    if (isPresent(d, pid)) return 'presente';
    // Preenche-se sozinho a partir do boletim clínico: um jogador
    // indisponível com regresso previsto aparece como lesionado em
    // cada dia dentro desse período, sem ser preciso marcar sessão a
    // sessão. Um toque manual na célula (falta/lesionado/escalão,
    // verificados acima) continua a ganhar a este preenchimento.
    if (diaAutoLesionado(pid, d.date, clinico)) return 'lesionado';
    return 'ausente';
  };
  const ratingOf = (d, pid) => (d.match ? ((d.match.ratings || {})[pid] ?? null) : dayRating(d.list, pid));
  const dayClosed = (d) => (d.match ? !!d.match.attendanceClosed : dayIsClosed(d.list));
  const mean = (arr) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null);
  const rows = orderedPlayers.map(p => {
    const attended = confirmedDays.filter(d => isPresent(d, p.id)).length;
    /* Os dias em que o jogador esteve LESIONADO saem do denominador.

       Contá-los como ausências castigava quem se magoou: um jogador com
       três semanas de paragem aparecia com 40% de assiduidade ao lado de
       quem simplesmente não aparece. A assiduidade passa a medir o que
       devia medir — a presença nos dias em que podia estar. */
    const diasPossiveis = confirmedDays.filter(d => contaParaMedias(estadoDe(d, p.id)));
    const pct = diasPossiveis.length ? Math.round((attended / diasPossiveis.length) * 100) : null;
    // Notas de treino e de jogo contam separadamente — são escalas
    // diferentes e misturá-las não diz nada. Notas em branco (NA) não
    // entram em nenhuma das médias.
    const notasDe = (filtro) => confirmedDays
      .filter(d => filtro(d) && isPresent(d, p.id))
      .map(d => ratingOf(d, p.id))
      .filter(r => r != null && r !== '')
      .map(Number);
    const treinoVals = notasDe(d => !d.match);
    // "Jogo" (competição) e "amigável" são coisas diferentes — a nota de
    // um amigável não deve pesar na média que representa o desempenho
    // na competição a sério, por isso contam-se à parte, cada uma com a
    // sua própria média.
    const jogoVals = notasDe(d => !!d.match && !isFriendlyMatch(d.match));
    const amigavelVals = notasDe(d => !!d.match && isFriendlyMatch(d.match));

    /* Totalizadores.

       Os dias com convocatória (jogos oficiais) contam à parte dos dias de
       presença (treinos e amigáveis): são coisas diferentes e somá-las
       dava um número sem significado. As faltas contam-se em separado das
       ausências — uma dispensa não é uma falta. */
    const comPresenca = confirmedDays.filter(d => !d.match || isFriendlyMatch(d.match));
    const comConvocatoria = confirmedDays.filter(d => d.match && !isFriendlyMatch(d.match));
    const conta = (lista, estado) => lista.filter(d => estadoDe(d, p.id) === estado).length;

    return {
      player: p, attended, pct, possiveis: diasPossiveis.length,
      avgTreino: mean(treinoVals), avgJogo: mean(jogoVals), avgAmigavel: mean(amigavelVals),
      countTreino: treinoVals.length, countJogo: jogoVals.length,
      totais: {
        presente: conta(comPresenca, 'presente'),
        ausente: conta(comPresenca, 'ausente'),
        convocado: conta(comConvocatoria, 'presente'),
        naoConvocado: conta(comConvocatoria, 'ausente'),
        falta: conta(confirmedDays, 'falta'),
        lesionado: conta(confirmedDays, 'lesionado'),
        escalao: conta(confirmedDays, 'escalao'),
      },
    };
  });

  // Marca/desmarca presença em TODAS as sessões desse dia, para que baste
  // dar presença uma vez por dia, independentemente de quantos exercícios
  // (sessões) existam para essa data.
  /* Um clique percorre ausente → presente → falta → escalão → lesionado
     → ausente (ver PRESENCA_ESTADOS, que é quem manda na ordem).

     Só a presença guarda nota: um jogador que não esteve não pode ser
     avaliado, por isso ao sair de "presente" a nota é apagada. */
  const toggleAttendance = (day, playerId) => {
    const estadoAtual = estadoDe(day, playerId);
    const proximo = proximoEstadoPresenca(estadoAtual);

    /* AO MARCAR L, CONVIDA A REGISTAR NO BOLETIM.

       Só quando NÃO há já uma ocorrência aberta a cobrir esse dia. Um
       jogador com três semanas de paragem tem quinze sessões marcadas com
       L; perguntar em todas seria insuportável e ensinava a carregar em
       "não" sem ler. A ocorrência é uma; os L são a sua sombra nos dias.

       A pergunta é só um convite — a presença fica marcada de qualquer
       forma, responda-se o que se responder. */
    if (proximo === 'lesionado' && setClinico && !estadoClinicoEm(playerId, day.date, clinico)) {
      const j = players.find(p => p.id === playerId);
      askConfirm({
        title: 'Registar no Boletim Clínico?',
        // Curto de propósito: a janela só aparece ao marcar L, por isso
        // "marcado como lesionado em" era texto a mais a dizer o que já se
        // sabe — e era o que fazia a data cair sozinha para a linha de baixo.
        label: `${j ? j.name : 'Jogador'} · ${fmtDate(day.date)}`,
        note: '',
        confirmLabel: 'Registar',
        destructive: false,
        onConfirm: () => setNovaOcorrencia({ playerId, data: day.date }),
      });
    }

    if (day.match) {
      const m = day.match;
      const base = convocadosOf(m);
      const faltas = (m.faltas || []).filter(id => id !== playerId);
      const lesionados = (m.lesionados || []).filter(id => id !== playerId);
      const escalao = (m.escalao || []).filter(id => id !== playerId);
      const convocados = base.filter(id => id !== playerId);
      setMatches(prev => prev.map(x => {
        if (x.id !== m.id) return x;
        const ratings = { ...(x.ratings || {}) };
        if (proximo !== 'presente') delete ratings[playerId];
        return {
          ...x,
          // `attendance` e `convocados` andam sempre a par: marcar aqui
          // convoca o jogador no Planeamento/Jogos, e desmarcar retira-o.
          attendance: proximo === 'presente' ? [...convocados, playerId] : convocados,
          convocados: proximo === 'presente' ? [...convocados, playerId] : convocados,
          faltas: proximo === 'falta' ? [...faltas, playerId] : faltas,
          lesionados: proximo === 'lesionado' ? [...lesionados, playerId] : lesionados,
          escalao: proximo === 'escalao' ? [...escalao, playerId] : escalao,
          ratings,
        };
      }));
      return;
    }

    const date = day.date;
    setSessions(prev => prev.map(s => {
      if (s.date !== date) return s;
      const ratings = { ...(s.ratings || {}) };
      if (proximo !== 'presente') delete ratings[playerId];
      const presentes = (s.attendance || []).filter(id => id !== playerId);
      const faltas = (s.faltas || []).filter(id => id !== playerId);
      const lesionados = (s.lesionados || []).filter(id => id !== playerId);
      const escalao = (s.escalao || []).filter(id => id !== playerId);
      return {
        ...s,
        attendance: proximo === 'presente' ? [...presentes, playerId] : presentes,
        faltas: proximo === 'falta' ? [...faltas, playerId] : faltas,
        lesionados: proximo === 'lesionado' ? [...lesionados, playerId] : lesionados,
        escalao: proximo === 'escalao' ? [...escalao, playerId] : escalao,
        ratings,
      };
    }));
  };
  // A nota é guardada em todas as sessões desse dia, para se manter uma
  // única nota por jogador, por dia.
  const setRating = (day, playerId, val) => {
    if (day.match) {
      setMatches(prev => prev.map(x => {
        if (x.id !== day.match.id) return x;
        // A mesma nota de jogo aparece em dois sítios da app (aqui, e no
        // Relatório de Jogo, em Jogos/Planeamento) — sem isto, editar
        // aqui não se refletia lá, e as estatísticas do jogador (que
        // leem do Relatório de Jogo) ficavam com um número desatualizado.
        const numero = val !== '' && val != null ? Number(val) : null;
        const report = { ...(x.report || {}) };
        report[playerId] = { ...(report[playerId] || {}), rating: numero };
        return { ...x, ratings: { ...(x.ratings || {}), [playerId]: val }, report };
      }));
      return;
    }
    setSessions(prev => prev.map(s => s.date === day.date ? { ...s, ratings: { ...(s.ratings || {}), [playerId]: val } } : s));
  };
  // Fecha (guarda) ou reabre (editar) o dia.
  const setDayClosed = (day, closed) => {
    if (day.match) {
      setMatches(prev => prev.map(x => (x.id === day.match.id ? { ...x, attendanceClosed: closed } : x)));
      return;
    }
    setSessions(prev => prev.map(s => s.date === day.date ? { ...s, attendanceClosed: closed } : s));
  };

  const doExport = () => {
    const keys = month === 'todos' ? [...monthKeys].sort() : [month];
    exportAttendanceCSV({ players: orderedPlayers, dayGroups, monthKeys: keys });
  };

  // Notas de jogo já preenchidas ANTES de `ratings` e `report[pid].rating`
  // passarem a andar ligados (ver `setRating`/`setReport`) — ficaram cada
  // uma no seu sítio. Isto junta as duas, de uma vez, para os jogos já
  // registados: onde só uma das duas existir, copia-a para a outra;
  // onde já existirem as duas mas diferentes, fica a das Presenças (foi
  // a mais recentemente confirmada aqui).
  /* "Sem nota" tem várias formas guardadas (vazio, null, "NA"): todas
     contam como nenhuma nota. Antes, um "NA" ou um vazio nunca batia
     certo com o relatório (NaN ou 0 contra null), e o botão ficava preso
     para sempre, mesmo depois de carregar nele. */
  const notaNum = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const jogosPorSincronizar = matches.filter(m => {
    const rat = m.ratings || {};
    const rep = m.report || {};
    return Object.keys(rat).some(pid => notaNum(rat[pid]) !== notaNum(rep[pid] && rep[pid].rating));
  }).length;
  const sincronizarNotasAntigas = () => {
    setMatches(prev => prev.map(m => {
      const rat = m.ratings || {};
      if (Object.keys(rat).length === 0) return m;
      const report = { ...(m.report || {}) };
      let mudou = false;
      Object.keys(rat).forEach(pid => {
        const numero = notaNum(rat[pid]);
        if (numero === notaNum(report[pid] && report[pid].rating)) return;
        report[pid] = { ...(report[pid] || {}), rating: numero };
        mudou = true;
      });
      return mudou ? { ...m, report } : m;
    }));
  };

  return (
    <div>
      <SectionHeader title="Presenças" subtitle="Assiduidade e nota de treino."
        action={<div style={{ display: 'flex', gap: 8 }}>
          {jogosPorSincronizar > 0 && (
            <Btn variant="ghost" onClick={sincronizarNotasAntigas} title="Junta as notas de jogo já preenchidas aqui com as do Relatório de Jogo">
              <RefreshCw size={15} /> Sincronizar notas antigas ({jogosPorSincronizar})
            </Btn>
          )}
          {/* Pequeno, como o "Exportar CSV" do Scouting e o Dossier/Portal. */}
          {dayGroups.length > 0 && <Btn variant="ghost" onClick={doExport} style={ESTILO_BOTAO_PEQUENO}><Download size={ICONE_BOTAO_PEQUENO} /> Exportar CSV</Btn>}
        </div>} />

      {players.length === 0 ? (
        <EmptyState text="Adiciona jogadores no separador Plantel." />
      ) : dayGroups.length === 0 ? (
        <EmptyState text="Ainda sem treinos nem jogos registados no Planeamento." />
      ) : (
        <>
          {/* TABELA-RESUMO: uma coluna por dia (treino ou jogo) e uma linha
              por jogador. Nos treinos alterna P/NP, nos jogos C/NC, e cada
              cruzamento tem ainda uma célula de nota de 1 a 10. Cada coluna
              tem "Guardar" (fecha para leitura) e "Editar" (reabre).
              Substituiu os antigos cartões dia a dia, que mostravam a mesma
              informação em muito mais espaço. */}
          <AttendanceMatrix
            days={visibleDays} players={orderedPlayers}
            isPresent={isPresent} estadoDe={estadoDe} ratingOf={ratingOf} dayClosed={dayClosed}
            onToggle={toggleAttendance} onRating={setRating} onSetClosed={setDayClosed}
            monthControl={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: T.mutedDim }}>Mês:</span>
                <Select value={month} onChange={e => setMonth(e.target.value)} style={{ padding: '0 10px', height: 34, lineHeight: '32px', fontSize: 12.5, width: 'auto' }}>
                  <option value="todos">Todos os meses</option>
                  {monthKeys.map(k => <option key={k} value={k}>{monthLabelPt(k)}</option>)}
                </Select>
              </div>
            )}
          />

          {visibleDays.length === 0 && (
            <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 22 }}>Sem treinos nem jogos neste mês.</div>
          )}

          {/* ASSIDUIDADE — resumo por jogador, alimentado pela tabela acima. */}
          <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Assiduidade e nota média
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(({ player, attended, pct, possiveis, avgTreino, avgJogo, totais }) => {
              const color = pct === null ? T.mutedDim : pct >= 80 ? T.good : pct >= 60 ? T.warn : T.bad;
              const noteColor = (v) => (v === null ? T.mutedDim : v >= 7 ? T.good : v >= 5 ? T.warn : T.bad);
              return (
                <div key={player.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, background: T.surface,
                  border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap',
                }}>
                  <Badge label={player.position} />
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ color: T.cream, fontSize: 14 }}>{player.name}</div>
                    {/* O denominador é o MESMO da percentagem: só os dias
                        que eram oportunidade de participação. Com o total
                        de dias aqui e o total de possíveis na conta ao
                        lado, a linha dizia duas coisas diferentes — um
                        jogador com 1 presença em 1 dia possível aparecia
                        como "1/11 confirmados · 100%". */}
                    <div style={{ fontSize: 11.5, color: T.mutedDim }}>
                      {possiveis === 0
                        ? 'Sem dias a contar'
                        : `${attended}/${possiveis} confirmados`}
                    </div>
                  </div>
                  <div style={{ width: 70, height: 6, background: T.bg, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${pct ?? 0}%`, height: '100%', background: color }} />
                  </div>
                  <span style={{ ...mono, color, fontSize: 13, width: 42, textAlign: 'right', flexShrink: 0 }}>{pct === null ? '—' : `${pct}%`}</span>
                  <div style={{ width: 1, alignSelf: 'stretch', background: T.line, flexShrink: 0 }} />

                  {/* Totalizadores ao lado da percentagem: a percentagem
                      diz "quanto", estes números dizem "de quê". */}
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                    {[
                      { v: totais.presente, l: 'P', cor: T.good, t: 'Presenças em treinos e amigáveis' },
                      { v: totais.ausente, l: 'NP', cor: T.mutedDim, t: 'Não presente (dispensa, outro escalão)' },
                      { v: totais.convocado, l: 'C', cor: T.warn, t: 'Convocado para jogos oficiais' },
                      { v: totais.naoConvocado, l: 'NC', cor: T.mutedDim, t: 'Não convocado para jogos oficiais' },
                      { v: totais.falta, l: 'F', cor: T.bad, t: 'Faltas — ausência sem justificação' },
                      { v: totais.lesionado, l: 'L', cor: T.gold, t: 'Lesionado — ausência por motivo clínico, fora das médias' },
                      { v: totais.escalao, l: 'E', cor: T.teamB, t: 'Noutro escalão — não era oportunidade de participação, fora das médias' },
                    ].map(x => (
                      <div key={x.l} title={x.t} style={{ textAlign: 'center', width: 26 }}>
                        <div style={{ ...mono, fontSize: 13, color: x.v ? x.cor : T.mutedDim }}>{x.v}</div>
                        <div style={{ fontSize: 9.5, color: T.mutedDim }}>{x.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ width: 1, alignSelf: 'stretch', background: T.line, flexShrink: 0 }} />
                  <div style={{ textAlign: 'right', flexShrink: 0, width: 62 }}>
                    <div style={{ ...mono, color: noteColor(avgTreino), fontSize: 13 }}>{avgTreino === null ? 'NA' : avgTreino}</div>
                    <div style={{ fontSize: 10, color: T.mutedDim }}>média treino</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, width: 56 }}>
                    <div style={{ ...mono, color: noteColor(avgJogo), fontSize: 13 }}>{avgJogo === null ? 'NA' : avgJogo}</div>
                    <div style={{ fontSize: 10, color: T.mutedDim }}>média jogo</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Aberta a partir de um L. Guardar aqui grava no Boletim Clínico e
          a partir daí os chips de convocatória e simulador passam a
          avisar — sem que ninguém tenha de ir ao outro separador. */}
      {novaOcorrencia && (
        <OcorrenciaModal
          ocorrencia={null}
          players={players}
          presetPlayerId={novaOcorrencia.playerId}
          presetData={novaOcorrencia.data}
          onClose={() => setNovaOcorrencia(null)}
          onSave={(data) => {
            const registo = { ...data, id: uid() };
            setClinico([...(clinico || []), registo]);
            setNovaOcorrencia(null);
            proporMarcacaoClinica({
              ocorrencia: registo, sessions, matches, setSessions, setMatches,
              jogador: players.find(p => p.id === registo.playerId),
            });
          }}
          clinico={clinico}
          onRecaida={(registo) => {
            setClinico(prev => prev.map(o => (o.id === registo.id ? registo : o)));
            setNovaOcorrencia(null);
            proporMarcacaoClinica({
              ocorrencia: registo, sessions, matches, setSessions, setMatches,
              jogador: players.find(p => p.id === registo.playerId),
            });
          }}
        />
      )}
    </div>
  );
}

/* Um amigável não tem convocatória.

   Num jogo oficial há uma lista fechada de convocados: quem lá está pode
   jogar, quem não está fica de fora. Num amigável não — vai quem aparece,
   e o que interessa registar é presença, tal como num treino. Daí a
   distinção percorrer a app inteira: as etiquetas (C/NC vs P/NP), a
   exportação, e o próprio formulário do jogo, que deixa de pedir
   convocados e passa a pedir presenças. */
/* TRÊS ESTADOS, NÃO DOIS.

   "Não presente" e "falta" não são a mesma coisa e não podem contar o
   mesmo: um jogador dispensado, lesionado ou a jogar noutro escalão não
   esteve presente, mas não faltou. A falta é ausência sem justificação, e
   é essa que interessa acompanhar.

   Guarda-se numa lista à parte (`faltas`), tanto nas sessões como nos
   jogos. Quem não está em `attendance` nem em `faltas` é simplesmente NP
   ou NC — que é o estado de toda a gente antes de alguém marcar seja o que
   for, e por isso continua a ser o valor por omissão dos registos antigos. */
/* A ORDEM DESTA LISTA É O CICLO DOS CLIQUES.

   ausente → presente → falta → escalão → LESIONADO → ausente

   Começa em 'ausente' porque é o estado de partida de toda a gente: com
   'presente' à cabeça, o primeiro clique num jogador por marcar saltava
   para 'falta' — dois cliques para o caso mais comum de todos.

   Depois da falta vêm os dois estados em que o jogador não esteve mas
   também não faltou, e que por isso saem do denominador das médias: o
   'escalao' (subiu aos seniores, jogou noutro escalão nesse dia) e o
   'lesionado'.

   O LESIONADO É O ÚLTIMO de propósito, mesmo sendo mais frequente do que
   o escalão. Marcá-lo pode abrir a proposta de registo no Boletim
   Clínico, e é o único passo deste ciclo que interrompe quem está a
   marcar presenças em série. Ficar no fim significa que se chega lá
   sempre de forma deliberada, e que passar por ele para voltar a
   'ausente' custa um clique só. */
export const PRESENCA_ESTADOS = ['ausente', 'presente', 'falta', 'escalao', 'lesionado'];

/* Estados que NÃO são oportunidade de participação neste escalão. Quem
   calcular médias tem de perguntar aqui em vez de escrever a lista outra
   vez — foi a divergir assim que a assiduidade passou a castigar quem se
   magoou. */
export const ESTADOS_FORA_DAS_MEDIAS = ['lesionado', 'escalao'];

export const contaParaMedias = (estado) => !ESTADOS_FORA_DAS_MEDIAS.includes(estado);

export function proximoEstadoPresenca(atual) {
  const i = PRESENCA_ESTADOS.indexOf(atual);
  return PRESENCA_ESTADOS[(i + 1) % PRESENCA_ESTADOS.length];
}

