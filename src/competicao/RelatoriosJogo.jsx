// competicao/RelatoriosJogo.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import { Input, Select, Btn, useIsMobile, EmptyState, TextArea, Modal } from '../base/ui';
import { T, body, mono, TEXT_ON_ACCENT } from '../base/tema';
import { shortPlayerName, sortByPosition } from '../dominio/jogadores';
import { todayStr, addDays, fmtShort, uid, fmtDate } from '../base/utilidades';
import { AlertTriangle, Plus, MessageCircle, ChevronDown, ChevronRight, Check, Pencil, Trash2, BookOpen, Printer, Share2 } from 'lucide-react';
import { competitionLabel, FRIENDLY } from '../dominio/jogos';
import React, { useState } from 'react';
import { UrlAnexo, hrefDescarga } from '../base/anexos';
import { LINHAS } from '../dominio/plantel';
import { CARD_OPTIONS, COR_RESULTADO, NOME_RESULTADO, marcadorDoJogo, normalizeStandings, parseScore } from './dados';
import { ListaMultipla, irParaSeparador } from '../base/ui-extra';
import { comQuemLaEsteve, withConvocadosInAttendance } from './Escalacao';

/* A TABELA DO RELATÓRIO DE JOGO — a mesma nos dois sítios (Relatórios de
   jogo e o editor completo do jogo), para se preencher sempre da mesma
   maneira: jogador, titular/suplente, minutos, golos, assistências,
   cartão e nota. O capitão e o subcapitão só se MOSTRAM aqui (C / SC ao
   lado do nome): escolhem-se na Convocatória. */
export const GRELHA_RELATORIO = 'minmax(0,1.7fr) 86px 74px 104px 104px 150px 74px';

/* RELATÓRIO DE JOGO — linhas mais legíveis (como nas apps de análise):
   foto redonda, nome, número e posição em etiqueta; golos e assistências
   com botões − / + (sem ter de escrever); minutos e nota (0–10, a nossa
   escala de sempre) em caixa. Os dados são os mesmos de sempre
   (`report[pid]`: minutes, goals, assists, card, rating). */
export function TabelaRelatorio({ jogadores, players, report, starters, capitao, subcapitao, onReport, onTitular, estreito, alturaMax }) {
  const comMin = (r) => !!r && Number(r.minutes) > 0;
  const campo = { padding: '6px 6px', fontSize: 13, textAlign: 'center' };
  const num = (p, k, ph, max) => (
    <Input type="number" inputMode="numeric" min="0" max={max} placeholder={ph} value={(report[p.id] || {})[k] ?? ''}
      onChange={e => onReport(p.id, k, e.target.value)} style={campo} />
  );
  // − valor + : golos e assistências.
  const passo = (p, k) => {
    const v = Math.max(0, Number((report[p.id] || {})[k]) || 0);
    const bot = (txt, novo, off) => (
      <button type="button" disabled={off} onClick={() => onReport(p.id, k, String(novo))} title={txt === '+' ? 'Somar' : 'Tirar'} style={{
        width: 26, height: 26, borderRadius: '50%', border: `1px solid ${T.line}`, background: 'transparent', flexShrink: 0,
        color: off ? T.mutedDim : T.cream, cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1, fontSize: 15, lineHeight: '22px', padding: 0, ...body,
      }}>{txt}</button>
    );
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {bot('−', v - 1, v <= 0)}
        <span style={{ ...mono, fontSize: 14, color: v ? T.cream : T.mutedDim, minWidth: 16, textAlign: 'center' }}>{v}</span>
        {bot('+', v + 1, false)}
      </div>
    );
  };
  const bracadeira = (pid) => (pid === capitao ? 'C' : pid === subcapitao ? 'SC' : null);
  const foto = (p) => (
    <span style={{
      width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: T.crimson, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: `1px solid ${T.line}`, ...mono,
    }}>{p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.number || (p.name || '?').slice(0, 1))}</span>
  );
  return (
    <>
      {!estreito && (
        <div style={{ display: 'grid', gridTemplateColumns: GRELHA_RELATORIO, gap: 8, padding: '0 10px 6px', fontSize: 10.5, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <span>Jogador</span><span /><span style={{ textAlign: 'center' }}>Min</span><span style={{ textAlign: 'center' }}>Golos</span><span style={{ textAlign: 'center' }}>Assist.</span><span>Cartão</span><span style={{ textAlign: 'center' }}>Nota 0–10</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(estreito || !alturaMax ? {} : { maxHeight: alturaMax, overflowY: 'auto', overflowAnchor: 'none', scrollbarGutter: 'stable' }) }}>
        {jogadores.map(p => {
          const r = report[p.id] || {};
          const tit = starters.includes(p.id);
          const b = bracadeira(p.id);
          const corPos = T.corEquipa || T.crimson;
          const nome = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {foto(p)}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: T.cream, ...LINHAS(1) }}>{shortPlayerName(p, players)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {/* Larguras FIXAS: com números de 1 ou 2 algarismos as
                      etiquetas da posição ficam todas alinhadas. Posição na
                      cor da equipa (a de Gerir equipa). */}
                  <span style={{ ...mono, fontSize: 10, fontWeight: 700, width: 22, textAlign: 'center', padding: '1px 0', borderRadius: 3, background: '#0d1a12', color: T.cream, visibility: p.number ? 'visible' : 'hidden' }}>{p.number || '0'}</span>
                  <span style={{ ...mono, fontSize: 10, fontWeight: 700, width: 30, textAlign: 'center', padding: '1px 0', borderRadius: 3, background: corPos, color: '#fff', visibility: p.position ? 'visible' : 'hidden' }}>{p.position || '—'}</span>
                  {b && (
                    <span title={b === 'C' ? 'Capitão (escolhido na Convocatória)' : 'Subcapitão (escolhido na Convocatória)'} style={{
                      ...mono, fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
                      background: b === 'C' ? T.goldFundo : '#B08A1E', color: '#1A1A1A',
                    }}>{b}</span>
                  )}
                </div>
              </div>
            </div>
          );
          const botTit = (
            <button type="button" onClick={() => onTitular(p.id)} style={{
              fontSize: 11, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', ...body, whiteSpace: 'nowrap',
              background: tit ? T.crimson : 'transparent', color: tit ? TEXT_ON_ACCENT : T.mutedDim, border: `1px solid ${tit ? T.crimson : T.line}`,
            }}>{tit ? 'Titular' : 'Suplente'}</button>
          );
          const selCartao = (
            <Select value={r.card || 'none'} onChange={e => onReport(p.id, 'card', e.target.value)} style={{ padding: '6px 6px', fontSize: 12.5 }}>
              {CARD_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          );
          /* Vermelho direto: quantos jogos de castigo. Quando se lança o
             relatório ainda não se sabe, por isso começa "Por definir" (fica
             indisponível até se escolher). O 2.º amarelo é sempre 1 jogo. */
          /* 2.º amarelo: a mesma escolha do castigo, mas começa em 1 jogo
             (a regra habitual); dá para mudar ou anular. */
          const ehSegundoAmarelo = r.card === 'yellow2';
          const valorCastigo = r.castigoJogos == null || r.castigoJogos === '' ? (ehSegundoAmarelo ? '1' : '') : String(r.castigoJogos);
          const cartao = (r.card === 'red' || ehSegundoAmarelo) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              {selCartao}
              <Select value={valorCastigo} onChange={e => onReport(p.id, 'castigoJogos', e.target.value === '' ? '' : Number(e.target.value))}
                title="Jogos de castigo" style={{ padding: '4px 6px', fontSize: 11.5, height: 30, color: valorCastigo === '' ? T.warn : T.cream }}>
                {!ehSegundoAmarelo && <option value="">Castigo por definir</option>}
                {[1, 2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n === 1 ? 'Castigo: 1 jogo' : `Castigo: ${n} jogos`}</option>)}
                <option value="0">Castigo anulado</option>
              </Select>
            </div>
          ) : selCartao;
          const borda = comMin(r) ? T.line : (tit ? T.warn : T.line);
          return estreito ? (
            <div key={p.id} style={{ background: T.bg, border: `1px solid ${borda}`, borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>{nome}</div>{botTit}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, marginBottom: 8 }}>
                <div><div style={{ fontSize: 10, color: T.mutedDim, marginBottom: 3 }}>MIN</div>{num(p, 'minutes', 'Min', 120)}</div>
                <div><div style={{ fontSize: 10, color: T.mutedDim, marginBottom: 3 }}>NOTA 0–10</div>{num(p, 'rating', '–', 10)}</div>
                <div><div style={{ fontSize: 10, color: T.mutedDim, marginBottom: 3 }}>GOLOS</div>{passo(p, 'goals')}</div>
                <div><div style={{ fontSize: 10, color: T.mutedDim, marginBottom: 3 }}>ASSIST.</div>{passo(p, 'assists')}</div>
              </div>
              {cartao}
            </div>
          ) : (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: GRELHA_RELATORIO, gap: 8, alignItems: 'center',
              background: T.bg, border: `1px solid ${borda}`, borderRadius: 10, padding: '7px 10px',
            }}>
              {nome}{botTit}{num(p, 'minutes', 'Min', 120)}{passo(p, 'goals')}{passo(p, 'assists')}{cartao}{num(p, 'rating', '–', 10)}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ================================================================
   RELATÓRIOS DE JOGO — a forma prática de lançar as estatísticas.
   ================================================================
   Um separador próprio em Jogos, só para isto: a lista dos jogos já
   realizados, separada em COMPETIÇÃO e AMIGÁVEIS / PRÉ-ÉPOCA (a mesma
   separação das estatísticas), com o estado de cada relatório (por
   preencher, incompleto, preenchido). Carregar num jogo abre o relatório
   em página inteira: quem jogou, titular, minutos, golos, assistências,
   cartão e nota.
   Grava no MESMO sítio de sempre (`match.report`, `match.ratings`), por
   isso as estatísticas dos jogadores, a ficha do jogo e a missão
   "Estatísticas do jogo" da equipa técnica continuam a funcionar igual.
   A missão leva diretamente ao relatório do jogo que falta. */
export const comMinutos = (r) => !!r && Number(r.minutes) > 0;

/* RESULTADO QUE JÁ ESTÁ NA COMPETIÇÃO. Quando o resultado foi lançado na
   tabela da competição (jornada), o relatório vai buscá-lo lá: aparece já
   preenchido e grava-se no jogo ao guardar o relatório. Liga pelo encontro
   (`sourceGameId`) ou, nos jogos antigos sem essa ligação, pela data e
   pelo adversário. O formato é o mesmo: "casa-fora". */
export function resultadoDaCompeticao(m, standings) {
  if (!m) return '';
  const { competitions } = normalizeStandings(standings);
  const norm = (x) => String(x || '').trim().toLowerCase();
  for (const comp of (competitions || [])) {
    for (const r of (comp.rounds || [])) {
      for (const g of (r.games || [])) {
        if (!g || !parseScore(g.score)) continue;
        const mesmo = (m.sourceGameId && g.id === m.sourceGameId)
          || (g.date && g.date === m.date && m.opponent && (norm(g.home) === norm(m.opponent) || norm(g.away) === norm(m.opponent)));
        if (mesmo) { const sc = parseScore(g.score); return `${sc.home}-${sc.away}`; }
      }
    }
  }
  return '';
}

export const comResultado = (m, standings) => (String((m && m.result) || '').trim() ? m : { ...m, result: resultadoDaCompeticao(m, standings) });

export function estadoRelatorio(m) {
  const conv = (m.convocados || []);
  const rep = m.report || {};
  if (!conv.length && !Object.values(rep).some(comMinutos)) return { id: 'vazio', txt: 'Por preencher', cor: T.bad };
  const semMin = conv.filter(pid => !comMinutos(rep[pid])).length;
  const comMin = conv.length - semMin;
  if (!comMin) return { id: 'vazio', txt: 'Por preencher', cor: T.bad };
  // Suplentes que não entraram ficam sem minutos: é normal. Só conta como
  // incompleto se faltar o resultado ou algum titular sem minutos.
  const titularesSem = (m.starters || []).filter(pid => !comMinutos(rep[pid])).length;
  if (titularesSem || !String(m.result || '').trim()) {
    return { id: 'incompleto', txt: titularesSem ? `Incompleto · ${titularesSem} ${titularesSem === 1 ? 'titular' : 'titulares'} sem minutos` : 'Incompleto · falta o resultado', cor: T.warn };
  }
  return { id: 'feito', txt: `${comMin} ${comMin === 1 ? 'jogador' : 'jogadores'}`, cor: T.good };
}

/* ALERTA AO DONO: RELATÓRIOS POR PREENCHER SEM NINGUÉM ENCARREGUE.
   Se há jogos já realizados com o relatório por fazer e NENHUMA missão
   da equipa técnica para os relatórios (caminho "Relatórios de jogo",
   aberta ou a repetir), o dono da equipa vê um aviso em Tarefas e em
   Jogos › Relatórios, com um botão que abre a Nova missão já preenchida.
   Assim que existir a missão, o aviso desaparece (quem a tiver recebe-a
   na credencial). Só jogos dos últimos 60 dias, para jogos antigos
   esquecidos não ficarem a gerar o aviso para sempre. */
export function relatoriosEmFalta(matches, standings) {
  const hoje = todayStr();
  const limite = addDays(hoje, -60);
  return (matches || [])
    .filter(m => m && m.date && m.date <= hoje && m.date >= limite)
    .filter(m => estadoRelatorio(comResultado(m, standings)).id !== 'feito')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function haMissaoDeRelatorios(tarefas) {
  return (tarefas || []).some(t => t && !t.jogadorId && t.caminho === 'estatisticas'
    && (t.recorrencia || t.estado !== 'feita'));
}

// A Nova missão pedida a partir de outro separador (abre em Tarefas).
export let missaoPendente = null;

export function pedirNovaMissao(pref) {
  missaoPendente = pref;
  irParaSeparador('tarefas');
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mjp-nova-missao'));
}

// Para quem está noutro ficheiro (Tarefas) poder limpar o pedido depois
// de o usar (uma variável importada não pode ser alterada por quem a importa).
export function consumirMissaoPendente() { missaoPendente = null; }

export const PREF_MISSAO_RELATORIOS = (repetir) => ({
  modo: 'staff', caminho: 'estatisticas', titulo: 'Introduzir as estatísticas do jogo',
  ...(repetir ? { recorrencia: { tipo: 'pos_jogo', desde: todayStr() } } : { prazo: addDays(todayStr(), 1) }),
});

export function AlertaRelatorios({ emFalta, onCriar }) {
  if (!emFalta || !emFalta.length) return null;
  const nomes = emFalta.slice(0, 2).map(m => `vs ${m.opponent || 'Adversário'} (${fmtShort(m.date)})`).join(', ');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '12px 14px', borderRadius: 10,
      background: 'rgba(179,38,30,.10)', border: `1px solid ${T.bad}`,
    }}>
      <AlertTriangle size={18} color={T.bad} style={{ flexShrink: 0 }} />
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600 }}>
          {emFalta.length === 1 ? 'Há 1 relatório de jogo por preencher' : `Há ${emFalta.length} relatórios de jogo por preencher`} e ninguém tem essa missão.
        </div>
        <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 2 }}>{nomes}{emFalta.length > 2 ? '…' : ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn onClick={() => onCriar(true)}><Plus size={14} /> Missão depois de cada jogo</Btn>
        <Btn variant="ghost" onClick={() => onCriar(false)}>Só estes jogos</Btn>
      </div>
    </div>
  );
}

export function RelatoriosJogo({ matches, players, season, standings, onSave, abrirId, onAberto, userEmail, setMatches, abrirAnaliseId, onAnaliseAberta, onImprimirFicha, onPartilharFicha }) {
  const hoje = todayStr();
  const jogados = [...(matches || [])].filter(m => m && m.date && m.date <= hoje).map(m => comResultado(m, standings))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const oficiais = jogados.filter(m => competitionLabel(m.competition) !== FRIENDLY);
  const amigaveis = jogados.filter(m => competitionLabel(m.competition) === FRIENDLY);
  const porPreencher = (lista) => lista.filter(m => estadoRelatorio(m).id !== 'feito').length;
  const [grupo, setGrupo] = useState(() => (porPreencher(oficiais) || !porPreencher(amigaveis) ? 'oficial' : 'amigavel'));
  const [aberto, setAberto] = useState(null);
  const estreito = useIsMobile(560);
  // Chegou pela missão: abre logo o relatório pedido (antes de pintar a lista).
  React.useLayoutEffect(() => {
    if (!abrirId) return;
    const m0 = (matches || []).find(x => x.id === abrirId);
    const m = m0 ? comResultado(m0, standings) : null;
    if (m) { setGrupo(competitionLabel(m.competition) === FRIENDLY ? 'amigavel' : 'oficial'); setAberto(m); }
    if (onAberto) onAberto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);
  const lista = grupo === 'oficial' ? oficiais : amigaveis;
  /* Cartão de cada jogo: tocar abre/fecha para baixo as notas da equipa
     técnica; o "+ Análise do jogo" abre a caixa para escrever; o relatório
     abre-se no estado à direita ("Por preencher", "Feito"…). */
  const [painel, setPainel] = useState(null); // { id, modo: 'ler' | 'escrever' }
  const alternarLer = (id) => setPainel(p => (p && p.id === id && p.modo === 'ler' ? null : { id, modo: 'ler' }));
  const abrirEscrita = (id) => setPainel({ id, modo: 'escrever' });
  // Chegou pela missão "Escrever a análise do jogo" (antes de pintar).
  React.useLayoutEffect(() => {
    if (!abrirAnaliseId) return;
    const m = (matches || []).find(x => x.id === abrirAnaliseId);
    if (m) { setGrupo(competitionLabel(m.competition) === FRIENDLY ? 'amigavel' : 'oficial'); abrirEscrita(m.id); }
    if (onAnaliseAberta) onAnaliseAberta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirAnaliseId]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: estreito ? 'nowrap' : 'wrap', marginBottom: 14 }}>
        {[['oficial', 'Competição', oficiais], ['amigavel', estreito ? 'Amigáveis' : 'Amigáveis e pré-época', amigaveis]].map(([id, rot, l]) => {
          const on = grupo === id;
          const n = porPreencher(l);
          return (
            <button key={id} type="button" onClick={() => setGrupo(id)} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', ...body, fontSize: 13,
              ...(estreito ? { flex: '1 1 0', minWidth: 0 } : {}),
              background: on ? T.crimson : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted, border: `1px solid ${on ? T.crimson : T.line}`,
            }}>
              {rot}
              {n > 0 && <span style={{ ...mono, fontSize: 11, background: on ? 'rgba(0,0,0,.25)' : T.bad, color: '#fff', borderRadius: 10, padding: '1px 7px' }}>{n}</span>}
            </button>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <EmptyState text={grupo === 'oficial' ? 'Ainda não há jogos oficiais realizados.' : 'Ainda não há amigáveis realizados.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map(m => {
            const e = estadoRelatorio(m);
            const mc = marcadorDoJogo(m, season);
            const forte = (nome, nosso) => <span style={{ fontWeight: nosso ? 700 : 500, color: nosso ? T.cream : T.muted }}>{nome}</span>;
            const nNotas = notasDoJogo(m).length;
            const meu = painel && painel.id === m.id ? painel : null;
            const parar = (ev) => ev.stopPropagation();
            const letra = mc.letra ? (
              <span title={NOME_RESULTADO[mc.letra]} style={{ ...mono, fontSize: estreito ? 11 : 11.5, fontWeight: 800, color: '#fff', background: COR_RESULTADO[mc.letra], borderRadius: 5, width: estreito ? 20 : 22, height: estreito ? 20 : 22, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{mc.letra}</span>
            ) : null;
            const marcador = (
              <>
                {forte(mc.casa, mc.emCasa)}
                <span style={{ ...mono, color: T.warn, fontWeight: 700, margin: estreito ? '0 7px' : '0 8px' }}>{mc.letra ? `${mc.golosCasa}-${mc.golosFora}` : (m.result || 'vs')}</span>
                {forte(mc.fora, !mc.emCasa)}
              </>
            );
            const prova = [competitionLabel(m.competition), m.jornada].filter(Boolean).join(' · ');
            /* "+ Análise do jogo" fica por baixo do jogo, à esquerda — longe
               do estado do relatório (à direita), para não se confundir com
               o preencher das estatísticas. */
            /* Sem análises: botão "+ Análise do jogo" por baixo do jogo, e o
               cartão não abre. Com análises: no lugar do botão fica quantas
               há, e tocar no cartão abre-o para baixo — lá dentro está o
               "+ Análise do jogo" para acrescentar outra. */
            const abrivel = nNotas > 0;
            const analise = abrivel ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: T.gold }}>
                <MessageCircle size={13} />
                {nNotas} análise{nNotas > 1 ? 's' : ''}
                <ChevronDown size={14} style={{ transform: meu && meu.modo === 'ler' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </div>
            ) : (
              <button type="button" onClick={(ev) => { ev.stopPropagation(); abrirEscrita(m.id); }} style={{
                alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', borderRadius: 14, cursor: 'pointer', ...body, fontSize: 12,
                background: meu && meu.modo === 'escrever' ? `${T.gold}26` : 'transparent', border: `1px solid ${meu && meu.modo === 'escrever' ? T.gold : `${T.gold}55`}`, color: T.gold,
              }}><Plus size={13} /> Análise do jogo</button>
            );
            // À direita: o relatório (estatísticas).
            const acoes = (
              <div onClick={parar} style={{ display: 'flex', alignItems: 'center', gap: estreito ? 6 : 10, flexShrink: 0, marginLeft: 'auto' }}>
                {/* Atalhos para a ficha do jogo (a mesma impressão e partilha
                    do separador Jogos), sem ter de ir lá procurar o jogo. */}
                {onImprimirFicha && (
                  <button type="button" onClick={() => onImprimirFicha(m)} title="Imprimir a ficha do jogo" aria-label="Imprimir a ficha do jogo"
                    style={{ display: 'inline-flex', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.muted }}>
                    <Printer size={16} />
                  </button>
                )}
                {onPartilharFicha && (
                  <button type="button" onClick={() => onPartilharFicha(m)} title="Partilhar a ficha do jogo" aria-label="Partilhar a ficha do jogo"
                    style={{ display: 'inline-flex', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.muted }}>
                    <Share2 size={16} />
                  </button>
                )}
                <button type="button" onClick={() => setAberto(m)} title="Abrir o relatório do jogo" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...body,
                  fontSize: estreito ? 12 : 11.5, color: e.cor, fontWeight: 600, textAlign: 'right', maxWidth: estreito ? 130 : 220,
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.txt}</span>
                  <ChevronRight size={16} color={T.mutedDim} style={{ flexShrink: 0 }} />
                </button>
              </div>
            );
            return (
              <div key={m.id} role={abrivel ? 'button' : undefined} tabIndex={abrivel ? 0 : undefined}
                onClick={() => { if (abrivel) alternarLer(m.id); }}
                onKeyDown={(ev) => { if (abrivel && ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); alternarLer(m.id); } }}
                style={{
                  textAlign: 'left', cursor: abrivel ? 'pointer' : 'default', ...body,
                  background: T.surface, border: `1px solid ${e.id === 'feito' ? T.line : e.cor}`, borderRadius: 10, padding: estreito ? '10px 12px' : '11px 14px',
                }}>
                {estreito ? (
                  /* TELEMÓVEL: data, letra e ações em cima; o marcador
                     inteiro no meio; a competição em baixo. Nada cortado. */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <span style={{ ...mono, fontSize: 12, color: T.mutedDim }}>{fmtShort(m.date)}</span>
                      {letra}
                      {acoes}
                    </div>
                    <div style={{ fontSize: 14.5, lineHeight: 1.35 }}>{marcador}</div>
                    <div style={{ fontSize: 11.5, color: T.mutedDim, lineHeight: 1.4 }}>{prova}</div>
                    {analise}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ ...mono, fontSize: 12, color: T.mutedDim, width: 46, flexShrink: 0 }}>{fmtShort(m.date)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Quem ganhou: V/E/D a cores e o marcador com os dois
                          nomes, a equipa da casa primeiro (a nossa a negrito). */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, minWidth: 0 }}>
                        {letra}
                        <span style={{ ...LINHAS(1), minWidth: 0 }}>{marcador}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.mutedDim, ...LINHAS(1) }}>{prova}</div>
                      {analise}
                    </div>
                    {acoes}
                  </div>
                )}
                {meu && (meu.modo === 'escrever' || abrivel) && (
                  <PainelNotasJogo key={meu.modo} m={m} modo={meu.modo} userEmail={userEmail} setMatches={setMatches}
                    onEscrever={() => abrirEscrita(m.id)} onFechar={() => setPainel(null)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {aberto && (
        <RelatorioJogoModal
          match={aberto} players={players} season={season}
          onClose={() => setAberto(null)}
          onSave={(dados) => { onSave(dados); setAberto(null); }}
        />
      )}
    </div>
  );
}

/* NOTAS DA EQUIPA TÉCNICA sobre os jogos (vieram do Diário).

   Vivem dentro de cada jogo, em Jogos › Relatórios de jogo (Competição e
   Amigáveis): o "+ Análise do jogo", por baixo do jogo, abre a caixa para escrever; ao
   gravar, a caixa fecha e o cartão volta ao normal — o que foi escrito
   vê-se tocando no cartão, que abre para baixo. Qualquer pessoa da
   equipa técnica pode escrever, e cada nota guarda quem a escreveu.
   Vivem no próprio jogo, em
   `notasEquipaTecnica = [{ id, texto, autor, em, editadoPor?, editadoEm?, attachment? }]`,
   e gravam-se logo, sem passar pelo modal do relatório.

   Os modais do jogo (relatório, ficha) não mexem nas notas: o `save` de
   Jogos e o de Planeamento mantêm sempre as da versão mais recente, para
   que gravar um relatório aberto há algum tempo não apague notas escritas
   entretanto por outra pessoa. */
export function notasDoJogo(m) {
  const v = m && m.notasEquipaTecnica;
  if (Array.isArray(v)) return v.filter(x => x && (String(x.texto || '').trim() || x.attachment));
  // Formato provisório (uma caixa por pessoa): converte-se ao ler.
  if (v && typeof v === 'object') {
    return Object.entries(v)
      .filter(([, x]) => x && String(x.texto || '').trim())
      .map(([autor, x]) => ({ id: `n-${autor}`, texto: x.texto, autor: autor === 'equipa' ? '' : autor, em: x.em || '' }));
  }
  return [];
}

export function PainelNotasJogo({ m, modo, userEmail, setMatches, onEscrever, onFechar }) {
  const notas = notasDoJogo(m);
  const [texto, setTexto] = useState('');
  const [aEditar, setAEditar] = useState(null);
  const gravarNotas = (mudar) => setMatches(prev => prev.map(x => (
    x.id === m.id ? { ...x, notasEquipaTecnica: mudar(notasDoJogo(x)) } : x
  )));
  const adicionar = () => {
    const t = texto.trim();
    if (!t) return;
    gravarNotas(lista => [...lista, { id: uid(), texto: t, autor: userEmail || '', em: new Date().toISOString() }]);
    setTexto('');
    onFechar(); // depois de gravar, fica fechado — abre-se tocando no cartão
  };
  const guardarEdicao = () => {
    const t = texto.trim();
    const id = aEditar;
    gravarNotas(lista => (t
      ? lista.map(n => (n.id === id ? { ...n, texto: t, editadoPor: userEmail || '', editadoEm: new Date().toISOString() } : n))
      : lista.filter(n => n.id !== id)));
    setAEditar(null); setTexto('');
  };
  const apagar = (id) => {
    if (!window.confirm('Apagar esta nota?')) return;
    gravarNotas(lista => lista.filter(n => n.id !== id));
  };
  const parar = (e) => e.stopPropagation();

  if (modo === 'escrever') {
    return (
      <div onClick={parar} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Análise do jogo</div>
        <TextArea autoFocus value={texto} onChange={e => setTexto(e.target.value)} style={{ minHeight: 100 }}
          placeholder="Como correu: o que funcionou, o que falhou, momentos-chave, o que fica para trabalhar..." />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn disabled={!texto.trim()} onClick={adicionar}><Check size={14} /> Guardar nota</Btn>
          <Btn variant="ghost" onClick={() => { setTexto(''); onFechar(); }}>Cancelar</Btn>
        </div>
      </div>
    );
  }
  return (
    <div onClick={parar} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, cursor: 'default' }}>
      {notas.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim }}>Ainda sem análise deste jogo.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notas.map(n => {
            const editar = aEditar === n.id;
            return (
              <div key={n.id} style={{ background: T.surfaceRaise, borderRadius: 8, padding: '9px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, color: T.mutedDim, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.autor || 'Equipa técnica'}{n.em ? ` · ${fmtShort(String(n.em).slice(0, 10))}` : ''}{n.editadoPor && n.editadoPor !== n.autor ? ` · editada por ${n.editadoPor}` : ''}
                  </span>
                  {!editar && (
                    <>
                      <button type="button" onClick={() => { setAEditar(n.id); setTexto(n.texto || ''); }} title="Editar" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Pencil size={13} /></button>
                      <button type="button" onClick={() => apagar(n.id)} title="Apagar" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
                {editar ? (
                  <div>
                    <TextArea autoFocus value={texto} onChange={e => setTexto(e.target.value)} style={{ minHeight: 90 }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <Btn onClick={guardarEdicao}><Check size={14} /> Guardar</Btn>
                      <Btn variant="ghost" onClick={() => { setAEditar(null); setTexto(''); }}>Cancelar</Btn>
                    </div>
                  </div>
                ) : (
                  <>
                    {n.texto && <div style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{n.texto}</div>}
                    {n.attachment && (
                      <UrlAnexo anexo={n.attachment}>{url => (
                      <a href={hrefDescarga(url, n.attachment.name) || undefined} download={n.attachment.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.warn, textDecoration: 'none', marginTop: 6 }}>
                        <BookOpen size={13} /> {n.attachment.name}
                      </a>
                      )}</UrlAnexo>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <button type="button" onClick={onEscrever} style={{
        marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, ...body, padding: 0,
      }}><Plus size={14} /> Análise do jogo</button>
    </div>
  );
}

export function RelatorioJogoModal({ match, players: playersAtivosDoJogo, season, onClose, onSave }) {
  const players = React.useMemo(() => comQuemLaEsteve(playersAtivosDoJogo, match), [playersAtivosDoJogo, match]);
  const estreito = useIsMobile(760);
  const [f, setF] = useState(() => ({
    ...match,
    convocados: match.convocados || [], starters: match.starters || [], report: match.report || {}, result: match.result || '',
  }));
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_relatorio_${match.id}`, f, setF);
  const ordenados = sortByPosition(players || []);
  const conv = ordenados.filter(p => f.convocados.includes(p.id));
  const setR = (pid, campo, val) => setF(prev => {
    const novo = { ...prev, report: { ...prev.report, [pid]: { ...(prev.report[pid] || {}), [campo]: val } } };
    // A nota é a mesma de Presenças: ficam sempre iguais (ver MatchModal).
    if (campo === 'rating') {
      const numero = val !== '' && val != null ? Number(val) : null;
      novo.ratings = { ...(prev.ratings || {}) };
      if (numero == null || Number.isNaN(numero)) delete novo.ratings[pid]; else novo.ratings[pid] = numero;
    }
    return novo;
  });
  const alternarConv = (pid) => setF(prev => {
    if (prev.convocados.includes(pid)) {
      const report = { ...prev.report }; delete report[pid];
      return { ...prev, convocados: prev.convocados.filter(x => x !== pid), starters: prev.starters.filter(x => x !== pid), report };
    }
    return { ...prev, convocados: [...prev.convocados, pid], starters: prev.starters.length < 11 ? [...prev.starters, pid] : prev.starters };
  });
  const alternarTitular = (pid) => setF(prev => ({ ...prev, starters: prev.starters.includes(pid) ? prev.starters.filter(x => x !== pid) : [...prev.starters, pid] }));
  // Atalho: os titulares que ainda não têm minutos ficam com 90'.
  const titulares90 = () => setF(prev => {
    const report = { ...prev.report };
    prev.starters.forEach(pid => { if (!comMinutos(report[pid])) report[pid] = { ...(report[pid] || {}), minutes: '90' }; });
    return { ...prev, report };
  });
  const comMin = conv.filter(p => comMinutos(f.report[p.id])).length;

  return (
    <Modal title={`Relatório · vs ${match.opponent || 'Adversário'}`} onClose={onClose} fullPage larguraMax={980}>
      <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.mutedDim, flex: '1 1 200px' }}>
          {fmtDate(match.date)} · {[competitionLabel(match.competition), match.jornada].filter(Boolean).join(' · ')}
        </div>
      </div>
      {/* O RESULTADO num marcador: as duas equipas com o nome, a da casa à
          esquerda, um campo de golos para cada. Grava-se como "casa-fora". */}
      {(() => {
        const mc = marcadorDoJogo({ ...match, result: f.result }, season);
        const sc = parseScore(f.result);
        const gol = (lado) => (sc ? String(lado === 'casa' ? sc.home : sc.away) : '');
        const mudar = (lado, v) => {
          const limpo = v.replace(/\D/g, '').slice(0, 2);
          const casa = lado === 'casa' ? limpo : gol('casa');
          const fora = lado === 'fora' ? limpo : gol('fora');
          setF({ ...f, result: casa === '' && fora === '' ? '' : `${casa || 0}-${fora || 0}` });
        };
        const caixa = { width: 54, textAlign: 'center', fontSize: 20, fontWeight: 700, padding: '6px 4px', ...mono };
        const nomeEq = (n, nosso) => <span style={{ fontSize: 14, fontWeight: nosso ? 700 : 500, color: nosso ? T.cream : T.muted, ...LINHAS(2), textAlign: 'center' }}>{n}</span>;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>{nomeEq(mc.casa, mc.emCasa)}</div>
            <Input inputMode="numeric" value={gol('casa')} onChange={e => mudar('casa', e.target.value)} placeholder="–" style={caixa} />
            <span style={{ color: T.mutedDim }}>:</span>
            <Input inputMode="numeric" value={gol('fora')} onChange={e => mudar('fora', e.target.value)} placeholder="–" style={caixa} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {nomeEq(mc.fora, !mc.emCasa)}
              {mc.letra && <span style={{ ...mono, fontSize: 11.5, fontWeight: 800, color: '#fff', background: COR_RESULTADO[mc.letra], borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{NOME_RESULTADO[mc.letra]}</span>}
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 260px' }}>
          <ListaMultipla
            itens={ordenados.map(p => ({ id: p.id, rotulo: shortPlayerName(p, players), prefixo: p.position || '--' }))}
            escolhidos={f.convocados}
            onAlternar={alternarConv}
            comProcura
            mostrarEtiquetas={false}
            resumo={f.convocados.length ? `Quem jogou: ${f.convocados.length} convocados` : 'Quem jogou? Escolhe os convocados'}
          />
        </div>
        <Btn variant="ghost" onClick={titulares90} disabled={!f.starters.length}>Titulares com 90'</Btn>
      </div>

      {conv.length === 0 ? (
        <EmptyState text="Escolhe primeiro quem foi convocado. Os onze primeiros ficam titulares." />
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: T.mutedDim, marginBottom: 6 }}>{comMin}/{conv.length} com minutos. Suplentes que não entraram ficam em branco.</div>
          <TabelaRelatorio
            jogadores={conv} players={players} report={f.report} starters={f.starters}
            capitao={f.capitao} subcapitao={f.subcapitao}
            onReport={setR} onTitular={alternarTitular} estreito={estreito} alturaMax="calc(100dvh - 400px)"
          />
        </>
      )}

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}`, background: T.bg,
        ...(estreito ? { position: 'sticky', bottom: 0, zIndex: 5, paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' } : {}),
      }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={() => { limpar(); onSave(withConvocadosInAttendance(f)); }}><Check size={15} /> Guardar relatório</Btn>
      </div>
    </Modal>
  );
}

