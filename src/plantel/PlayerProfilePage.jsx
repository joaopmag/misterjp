// plantel/PlayerProfilePage.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { escapeHtmlText, todayStr, fmtShort } from '../base/utilidades';
import { isFriendlyMatch } from '../dominio/jogos';
import { groupSessionsByDate, dayPresent, playerStats } from '../dominio/estatisticas';
import { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronDown, ChevronLeft, Share2, Printer, Pencil } from 'lucide-react';
import { nivelNoDia, nivelClinico } from '../dominio/clinico';
import { T, body, mono, display } from '../base/tema';
import { jogoNaoJogado } from '../dominio/estadoJogos';
import { jogosDeCastigo } from '../competicao/Escalacao';
import { CaptainArmband } from '../dominio/plantel';
import { age, formatBirthdate, playerBirthLine } from './PlayerModal';
import { diaAutoLesionado, normalizarOcorrencia, proximoDiaIso } from './clinicoDados';
import { contaParaMedias } from './Presencas';
import { diasDeOcorrencia } from './Clinico';
import { MiniCartao, chaveDoTipo, faltaDoAtleta } from '../dominio/faltas';
import { wellnessAvg } from './comum';
import { Sparkline } from './Historico';

/* Ficha do jogador do plantel — os mesmos campos na partilha (HTML) e na
   impressão, na mesma lógica usada no Scouting. */
export function playerReportRows(p) {
  return [
    ['Nome', p.name],
    ['Número', p.number],
    ['Posição', p.position],
    ['Data de nascimento', formatBirthdate(p.birthdate)],
    ['Idade', p.birthdate && age(p.birthdate) !== null ? `${age(p.birthdate)} anos` : ''],
    ['Nacionalidade', p.nationality],
    ['Lateralidade', p.laterality],
    ['Altura', p.height ? `${p.height} cm` : ''],
    ['Peso', p.weight ? `${p.weight} kg` : ''],
    ['Clube anterior', p.previousClub],
    ['Data de entrada', p.entryDate],
    ['Data de saída', p.exitDate],
    ['Contacto', p.contact],
    ['Estatuto principal', p.statusMain],
    ['Estatuto secundário', p.statusSecondary],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
}

/* Números da época na ficha do jogador — os mesmos que aparecem no ecrã
   de estatísticas, para a folha impressa não ficar mais pobre do que a app. */
export function playerSeasonRows(stats) {
  return [
    ['Assiduidade', stats.attendancePct === null ? '—' : `${stats.attendancePct}%`],
    ['Sessões presentes', `${stats.attended}/${stats.totalSessions}`],
    ['Nota média de treino', stats.avgTrainingRating ?? '—'],
    ['Convocatórias', stats.matchesPlayed],
    ['Titular', stats.starts],
    ['Entrou do banco', stats.subsUsed],
    ['Minutos', stats.minutes],
    ['Golos', stats.goals],
    ['Assistências', stats.assists],
    ['Cartões amarelos', stats.yellow],
    ['Cartões vermelhos', stats.red],
    ['Nota média de jogo', stats.avgMatchRating ?? '—'],
  ];
}

export function buildPlayerReportHtml(p, stats) {
  const rows = playerReportRows(p);
  const table = `<table>${rows.map(([k, v]) => `<tr><th>${escapeHtmlText(k)}</th><td>${escapeHtmlText(String(v))}</td></tr>`).join('')}</table>`;
  const photoHtml = p.photo
    ? `<img src="${p.photo}" alt="Fotografia" style="width:170px;max-width:40%;aspect-ratio:3/4;object-fit:cover;border-radius:10px;border:1px solid #33513c;background:#000;flex:0 0 auto;" />`
    : '';
  const statRows = playerSeasonRows(stats);
  return `
<h2 style="margin-top:0">Identificação</h2>
<div style="display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap;">
  <div style="flex:0 1 auto;">${table.replace('<table>', '<table style="width:auto">')}</div>
  ${photoHtml}
</div>
<h2>Época</h2>
<table style="width:auto">${statRows.map(([k, v]) => `<tr><th>${escapeHtmlText(k)}</th><td>${escapeHtmlText(String(v))}</td></tr>`).join('')}</table>
`;
}

export function PlayerPrintSheet({ player: p, stats }) {
  const rows = playerReportRows(p);
  const th = { textAlign: 'left', padding: '3px 16px 3px 0', fontWeight: 600, whiteSpace: 'nowrap' };
  return (
    <div className="print-sheet">
      <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>{p.name || 'Jogador'}</h2>

      <h3 style={{ fontSize: 14, margin: '0 0 6px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Identificação</h3>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 14 }}>
        <table style={{ fontSize: 12.5, flex: '0 1 auto', width: 'auto' }}>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><th style={th}>{k}</th><td style={{ padding: '3px 0' }}>{v}</td></tr>
            ))}
          </tbody>
        </table>
        {p.photo && (
          <img src={p.photo} alt="Fotografia" style={{
            width: 150, flex: '0 0 auto', aspectRatio: '3 / 4', objectFit: 'cover',
            borderRadius: 8, border: '1px solid #ccc',
          }} />
        )}
      </div>

      <h3 style={{ fontSize: 14, margin: '0 0 6px', borderTop: '1px solid #ccc', paddingTop: 8 }}>Época</h3>
      <table style={{ fontSize: 12.5, width: 'auto' }}>
        <tbody>
          {playerSeasonRows(stats).map(([k, v]) => (
            <tr key={k}><th style={th}>{k}</th><td style={{ padding: '3px 0' }}>{v}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* No Plantel, as estatísticas de jogo são as da COMPETIÇÃO: é o que a
   ficha de um jogador quer dizer quando fala de jogos e minutos. Os
   amigáveis têm o seu recorte próprio no separador Jogos.

   Explícito e à vista, em vez de escondido dentro do playerStats — assim
   quem lê a ficha do jogador percebe o que está a ver, e quem quiser
   outro recorte passa outra lista. */
export function jogosOficiaisDe(matches) {
  return (matches || []).filter(m => !isFriendlyMatch(m));
}

/* ASSIDUIDADE TAL COMO EM PRESENÇAS — a mesma conta, para a ficha do
   jogador dizer o mesmo número que a página Presenças:
   · dias já passados, treinos E jogos (no jogo, convocado = presente);
   · as sessões criadas a partir de um jogo não contam a dobrar;
   · dias de folga (Descanso) não contam;
   · dias em que esteve lesionado ou no outro escalão saem do denominador
     (não é ausência). */
export function assiduidadeComoPresencas(pid, sessions, matches, convocatorias, clinico) {
  const hojeIso = todayStr();
  const idsDeJogos = new Set((matches || []).map(m => m.id));
  const sessoesProprias = (sessions || []).filter(x => !(x.sourceMatchId && idsDeJogos.has(x.sourceMatchId)));
  const trainingDays = groupSessionsByDate(sessoesProprias).filter(d => !d.list.every(s => s.phase === 'Descanso'));
  const matchDays = (matches || []).filter(m => m.date).map(m => ({ date: m.date, match: m }));
  const dias = [...trainingDays, ...matchDays].filter(d => d.date < hojeIso);
  const convocadosOf = (match) => {
    if (Array.isArray(match.attendance)) return match.attendance;
    const conv = (convocatorias || []).find(c => c.data === match.date);
    return [...new Set([...(match.convocados || []), ...((conv && conv.convocados) || [])])];
  };
  const presente = (d) => (d.match ? convocadosOf(d.match).includes(pid) : dayPresent(d.list, pid));
  const estado = (d) => {
    const lista = (campo) => (d.match ? (d.match[campo] || []) : (d.list || []).flatMap(x => x[campo] || []));
    if (lista('faltas').includes(pid)) return 'falta';
    if (lista('lesionados').includes(pid)) return 'lesionado';
    if (lista('escalao').includes(pid)) return 'escalao';
    if (presente(d)) return 'presente';
    if (diaAutoLesionado(pid, d.date, clinico)) return 'lesionado';
    return 'ausente';
  };
  const conta = (lista) => {
    const possiveis = lista.filter(d => contaParaMedias(estado(d))).length;
    const presentes = lista.filter(presente).length;
    return { presentes, possiveis, pct: possiveis ? Math.round((presentes / possiveis) * 100) : null };
  };
  const geral = conta(dias);
  const treino = conta(dias.filter(d => !d.match));
  return { pct: geral.pct, presentes: geral.presentes, possiveis: geral.possiveis, treinoPresentes: treino.presentes, treinoPossiveis: treino.possiveis };
}

/* PÁGINA DO JOGADOR — não é uma janela por cima, é a própria página do
   Plantel a trocar de conteúdo (ver `onBack` em Plantel). Reúne, num
   único sítio, coisas que já existiam espalhadas por três separadores
   diferentes (Plantel, Monitorização, Desenvolvimento) — nada de dados
   novos, só uma vista que já não obriga a saltar de separador em
   separador para perceber "como vai este jogador".

   Jogos oficiais, como sempre — ver a nota em `playerStats`. */
/* AMPLIAR UMA FOTOGRAFIA — clique fora ou no X para fechar, Esc também
   fecha. Simples de propósito: não é uma janela de edição (essas não
   fecham com Esc nem com o clique de fora, ver `Modal`), é só para
   ver melhor, por isso pode fechar-se da forma mais óbvia possível. */
export function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: '#000000cc', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
    }}>
      <img
        src={src} alt={alt || ''} onClick={e => e.stopPropagation()}
        style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, boxShadow: '0 20px 60px #00000080', cursor: 'default' }}
      />
      <button onClick={onClose} title="Fechar" style={{
        position: 'fixed', top: 16, right: 16, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer',
      }}><X size={18} /></button>
    </div>
  );
}

/* REGISTO CLÍNICO DO JOGADOR (ficha do jogador) — todas as lesões dele,
   o total de dias indisponível na época (desde 1 de agosto) e as
   recidivas por zona ("2.ª na virilha"). Tocar numa lesão abre a MESMA
   ficha do Boletim Clínico (`onAbrir`), por cima da página do jogador:
   ver a evolução, atualizar, dar alta, sem mudar de separador. Sem
   `onAbrir`, abre a evolução ali mesmo, só para ler. */
export function RegistoClinicoJogador({ ocorrencias, onAbrir }) {
  const [aberta, setAberta] = useState(null);
  const hoje = todayStr();
  const d = new Date();
  const inicioEpoca = `${d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1}-08-01`;

  // Dias indisponível na época: dia a dia, pelo nível de cada dia.
  let diasEpoca = 0;
  ocorrencias.forEach(o => {
    if (!o.inicio) return;
    let dia = o.inicio > inicioEpoca ? o.inicio : inicioEpoca;
    const ate = o.fim && o.fim < hoje ? o.fim : hoje;
    let guarda = 0;
    while (dia <= ate && guarda < 800) {
      if (nivelNoDia(o, dia) === 'indisponivel') diasEpoca += 1;
      dia = proximoDiaIso(dia, 1);
      guarda += 1;
    }
  });

  // Ordem da lesão em cada zona (a mais antiga é a 1.ª).
  const ordemNaZona = {};
  const contagemZona = {};
  [...ocorrencias].sort((x, y) => (x.inicio || '').localeCompare(y.inicio || '')).forEach(o => {
    if (!o.zona || o.zona === 'Outra') return;
    contagemZona[o.zona] = (contagemZona[o.zona] || 0) + 1;
    ordemNaZona[o.id] = contagemZona[o.zona];
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
        {ocorrencias.length} {ocorrencias.length === 1 ? 'lesão' : 'lesões'} · {diasEpoca} {diasEpoca === 1 ? 'dia' : 'dias'} indisponível esta época
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ocorrencias.map(original => {
          const o = normalizarOcorrencia(original);
          const nivel = nivelClinico(nivelNoDia(o, hoje));
          const dias = diasDeOcorrencia(original);
          const expandida = aberta === original.id;
          const ordem = ordemNaZona[original.id];
          return (
            <div key={original.id} style={{
              background: T.bg, borderRadius: 7, border: `1px solid ${T.line}`,
              borderLeft: `3px solid ${original.fim ? T.line : nivel.cor}`, overflow: 'hidden',
            }}>
              <button onClick={() => (onAbrir ? onAbrir(original.id) : setAberta(expandida ? null : original.id))} title={onAbrir ? 'Abrir a ficha da lesão' : undefined} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '7px 10px', background: 'none', border: 'none', fontSize: 12, ...body,
              }}>
                <span style={{ color: T.cream, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[original.tipo, original.zona].filter(Boolean).join(' · ') || 'Ocorrência'}
                  {ordem > 1 && <span style={{ color: T.warn, marginLeft: 6 }}>{ordem}.ª nesta zona</span>}
                  {(() => { const r = (o.evolucao || []).filter(e => e.recaida).length; return r ? <span style={{ color: T.warn, marginLeft: 6 }}>{r} {r === 1 ? 'recaída' : 'recaídas'}</span> : null; })()}
                </span>
                <span style={{ ...mono, color: T.mutedDim, fontSize: 11, flexShrink: 0 }}>
                  {original.inicio ? fmtShort(original.inicio) : '—'}{dias != null ? ` · ${dias}d` : ''}
                </span>
                <span style={{ fontSize: 11, color: original.fim ? T.mutedDim : nivel.cor, flexShrink: 0 }}>
                  {original.fim ? 'alta' : nivel.curto}
                </span>
                {onAbrir
                  ? <ChevronRight size={13} style={{ color: T.mutedDim, flexShrink: 0 }} />
                  : <ChevronDown size={13} style={{ color: T.mutedDim, flexShrink: 0, transform: expandida ? 'rotate(180deg)' : 'none' }} />}
              </button>
              {expandida && (
                <div style={{ padding: '4px 10px 10px 12px', borderTop: `1px solid ${T.line}` }}>
                  {[...o.evolucao].reverse().map(e => (
                    <div key={e.id} style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
                      <span style={{ ...mono, color: T.mutedDim, fontSize: 11 }}>{e.data ? fmtShort(e.data) : ''}</span>
                      {e.alta && <span style={{ color: T.good, marginLeft: 6 }}>Alta</span>}
                      {e.recaida && <span style={{ color: T.warn, marginLeft: 6 }}>Recaída</span>}
                      {e.nivel && <span style={{ color: nivelClinico(e.nivel).cor, marginLeft: 6 }}>{nivelClinico(e.nivel).label}</span>}
                      {e.texto && <span style={{ color: T.cream, marginLeft: 6 }}>{e.texto}</span>}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    <span style={{ ...mono, color: T.mutedDim, fontSize: 11 }}>{o.inicio ? fmtShort(o.inicio) : ''}</span>
                    <span style={{ color: nivelClinico(o.nivelInicial).cor, marginLeft: 6 }}>Início · {nivelClinico(o.nivelInicial).label}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* CADASTRO DISCIPLINAR na ficha do atleta — o que o Diário tem sobre ele:
   as ocorrências de Disciplina (com o cartão amarelo/vermelho e a
   consequência) e as faltas/atrasos registados com motivo. As faltas
   marcadas só nas Presenças já contam nas Presenças, à esquerda. Só a
   equipa técnica vê esta página. */
/* EXPULSÕES EM JOGO de um atleta (dos relatórios de jogo), com o estado
   do castigo de cada uma — a mesma regra de `castigadosParaJogo`: cada
   jogo oficial já disputado depois da expulsão conta como cumprido. */
export function expulsoesEmJogo(matches, playerId) {
  const hoje = todayStr();
  const lista = (matches || []).filter(m => m && m.date && m.report && m.report[playerId]
    && (m.report[playerId].card === 'red' || m.report[playerId].card === 'yellow2'));
  const oficiais = (matches || []).filter(m => m && m.date && !isFriendlyMatch(m) && !jogoNaoJogado(m));
  return lista.sort((a, b) => b.date.localeCompare(a.date)).map(m => {
    const r = m.report[playerId];
    const amigavel = isFriendlyMatch(m);
    const n = amigavel ? 0 : jogosDeCastigo(r);
    const cumpridos = oficiais.filter(x => x.date > m.date && x.date <= hoje && x.id !== m.id).length;
    let estado;
    if (amigavel) estado = 'amigável, sem castigo';
    else if (n === Infinity) estado = 'castigo por definir';
    else if (n === 0) estado = 'castigo anulado';
    else if (cumpridos >= n) estado = n === 1 ? 'castigo cumprido' : `castigo cumprido (${n} jogos)`;
    else estado = `castigo por cumprir (${cumpridos} de ${n})`;
    return { id: m.id, data: m.date, adversario: m.opponent || 'jogo', cartao: r.card, estado, porCumprir: !amigavel && (n === Infinity || cumpridos < n) && n !== 0 };
  });
}

export function CadastroDisciplinar({ diario, playerId, card, sectionTitle, matches = [] }) {
  const emJogo = expulsoesEmJogo(matches, playerId);
  const doAtleta = (diario || []).filter(n => (n.atletas || []).includes(playerId));
  const disciplina = doAtleta.filter(n => chaveDoTipo(n) === 'disciplina')
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  const faltas = doAtleta.filter(n => chaveDoTipo(n) === 'faltas');
  const amarelos = disciplina.filter(n => (n.cartao || 'amarelo') === 'amarelo').length;
  const vermelhos = disciplina.filter(n => n.cartao === 'vermelho').length;
  const fa = (n) => faltaDoAtleta(n, playerId);
  const atrasos = faltas.filter(n => fa(n).faltaTipo === 'atraso').length;
  const faltasInj = faltas.filter(n => fa(n).faltaTipo !== 'atraso' && !fa(n).justificada).length;
  const faltasJust = faltas.filter(n => fa(n).faltaTipo !== 'atraso' && fa(n).justificada).length;
  const resumo = [
    amarelos ? `${amarelos} amarelo${amarelos > 1 ? 's' : ''}` : null,
    vermelhos ? `${vermelhos} vermelho${vermelhos > 1 ? 's' : ''}` : null,
    faltasInj ? `${faltasInj} falta${faltasInj > 1 ? 's' : ''} injustificada${faltasInj > 1 ? 's' : ''}` : null,
    faltasJust ? `${faltasJust} justificada${faltasJust > 1 ? 's' : ''}` : null,
    atrasos ? `${atrasos} atraso${atrasos > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  return (
    <>
      <div style={sectionTitle}>Cadastro disciplinar</div>
      {disciplina.length === 0 && faltas.length === 0 && emJogo.length === 0 ? (
        <div style={{ ...card, color: T.mutedDim, fontSize: 12.5 }}>Sem registos no Diário nem expulsões em jogo.</div>
      ) : (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* EM JOGO: as expulsões dos relatórios de jogo e o castigo de cada uma. */}
          {emJogo.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12.5, color: emJogo.some(x => x.porCumprir) ? T.bad : T.cream }}>
                Em jogo: {emJogo.length} expuls{emJogo.length === 1 ? 'ão' : 'ões'}
              </div>
              {emJogo.map(x => (
                <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <MiniCartao cor={x.cartao === 'red' ? 'vermelho' : 'amarelo'} />
                  <div style={{ fontSize: 12, color: T.mutedDim, minWidth: 0 }}>
                    <span style={mono}>{fmtShort(x.data)}</span> · vs {x.adversario} · {x.cartao === 'red' ? 'vermelho direto' : '2.º amarelo'} ·{' '}
                    <span style={{ color: x.porCumprir ? T.warn : T.mutedDim }}>{x.estado}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(disciplina.length > 0 || faltas.length > 0) && (
          <div style={{ fontSize: 12.5, color: amarelos >= 3 || vermelhos ? T.bad : T.cream, ...(emJogo.length ? { borderTop: `1px solid ${T.line}`, paddingTop: 8 } : {}) }}>
            No Diário: {resumo.join(' · ')}{amarelos >= 3 ? ' · acumulação' : ''}
          </div>
          )}
          {disciplina.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderTop: `1px solid ${T.line}`, paddingTop: 8 }}>
              <MiniCartao cor={n.cartao || 'amarelo'} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: T.mutedDim }}>
                  <span style={mono}>{fmtShort(n.data)}</span>
                  {(n.consequencias || []).length ? ` · ${n.consequencias.join(', ')}` : ''}
                </div>
                {n.nota && (
                  <div style={{ fontSize: 12.5, color: T.cream, lineHeight: 1.45, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{n.nota}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function PlayerProfilePage({ player, sessions, matches, monitoring, clinico, desenvolvimento, diario = [], convocatorias = [], onBack, onShare, onPrint, onEdit, onAbrirLesao }) {
  const s = playerStats(player, sessions, jogosOficiaisDe(matches));
  // A mesma assiduidade que aparece em Presenças (ver assiduidadeComoPresencas).
  const assid = assiduidadeComoPresencas(player.id, sessions, matches, convocatorias, clinico);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  const ocorrencias = (clinico || [])
    .filter(o => o.playerId === player.id)
    .sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));

  const momentos = (desenvolvimento || []).filter(m => (m.jogadores || []).includes(player.id));
  const momentosAbertos = momentos.filter(m => !m.fechado).length;
  const ultimoMomento = momentos.slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];

  // Últimos 14 registos de Wellness deste jogador, mais antigo primeiro
  // (é o que o Sparkline espera para desenhar a linha da esquerda para a
  // direita).
  const wellnessRecs = (monitoring || [])
    .filter(m => m.playerId === player.id && wellnessAvg(m) !== null)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 14)
    .reverse();
  const wellnessPontos = wellnessRecs.map(r => Number(wellnessAvg(r).toFixed(1)));
  const wellnessDatas = wellnessRecs.map(r => r.date);
  const wellnessUltimo = wellnessPontos[wellnessPontos.length - 1];

  // Mesma lógica do Wellness, mas para o PSE (escala 1–10) — os registos
  // deste jogador têm o campo `pse` só nos dias em que respondeu ao
  // questionário pós-treino/jogo, por isso filtra-se por isso, não por
  // `sono` como no Wellness.
  const pseRecs = (monitoring || [])
    .filter(m => m.playerId === player.id && typeof m.pse === 'number')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 14)
    .reverse();
  const psePontos = pseRecs.map(r => r.pse);
  const pseDatas = pseRecs.map(r => r.date);
  const pseUltimo = psePontos[psePontos.length - 1];

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 14px' };
  const sectionTitle = { fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, gap: 10 };

  const linha = (label, valor) => valor !== null && valor !== undefined && valor !== '' && (
    <div key={label} style={rowStyle}>
      <span style={{ color: T.mutedDim }}>{label}</span>
      <span style={{ color: T.cream, textAlign: 'right' }}>{valor}</span>
    </div>
  );

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Plantel
      </button>

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}>
        {player.photo ? (
          <img
            src={player.photo} alt="Fotografia" onClick={() => setFotoAmpliada(true)}
            title="Ver fotografia ampliada"
            style={{
              width: 72, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 8,
              border: `1px solid ${T.line}`, background: '#000', flexShrink: 0, cursor: 'zoom-in',
            }} />
        ) : (
          <div style={{
            width: 72, aspectRatio: '3 / 4', borderRadius: 8, background: T.surface, border: `1px solid ${T.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontSize: 20, fontWeight: 600, color: T.mutedDim, ...display,
          }}>
            {(player.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ ...display, fontSize: 20, color: T.cream }}>{player.name}</span>
            <CaptainArmband rank={player.captainRank} />
            {player.statusMain && (
              <span style={{ background: `${T.good}22`, color: T.good, fontSize: 11, padding: '3px 9px', borderRadius: 12 }}>{player.statusMain}</span>
            )}
          </div>
          <div style={{ color: T.mutedDim, fontSize: 12.5, marginTop: 4 }}>
            {[
              player.position ? (player.secondaryPosition ? `${player.position}/${player.secondaryPosition}` : player.position) : null,
              player.number ? `nº ${player.number}` : null, playerBirthLine(player), player.laterality,
            ].filter(Boolean).join(' · ')}
          </div>
          {(onShare || onPrint || onEdit) && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              {onShare && <button onClick={onShare} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: 0 }}><Share2 size={15} /> Partilhar</button>}
              {onPrint && <button onClick={onPrint} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: 0 }}><Printer size={15} /> Imprimir</button>}
              {onEdit && <button onClick={onEdit} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: 0 }}><Pencil size={15} /> Editar</button>}
            </div>
          )}
        </div>
      </div>

      {/* NÚMEROS EM DESTAQUE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ ...mono, fontSize: 19, fontWeight: 500, color: T.warn }}>{assid.pct === null ? '—' : `${assid.pct}%`}</div>
          <div style={{ fontSize: 10.5, color: T.mutedDim, marginTop: 2 }}>Assiduidade</div>
        </div>
        <div style={card}>
          <div style={{ ...mono, fontSize: 19, fontWeight: 500, color: T.warn }}>{s.matchesPlayed}</div>
          <div style={{ fontSize: 10.5, color: T.mutedDim, marginTop: 2 }}>Convocatórias</div>
        </div>
        <div style={card}>
          <div style={{ ...mono, fontSize: 19, fontWeight: 500, color: T.warn }}>{s.goals + s.assists}</div>
          <div style={{ fontSize: 10.5, color: T.mutedDim, marginTop: 2 }}>Golos + assist.</div>
        </div>
        <div style={card}>
          <div style={{ ...mono, fontSize: 19, fontWeight: 500, color: T.warn }}>{s.avgMatchRating ?? '—'}</div>
          <div style={{ fontSize: 10.5, color: T.mutedDim, marginTop: 2 }}>Nota média</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* COLUNA ESQUERDA: características + treino + wellness */}
        <div>
          <div style={sectionTitle}>Características</div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {linha('Altura / Peso', [player.height && `${player.height} cm`, player.weight && `${player.weight} kg`].filter(Boolean).join(' · ') || null)}
            {linha('Nacionalidade', player.nationality)}
            {linha('Contacto', player.contact)}
            {linha('Clube anterior', player.previousClub)}
            {linha('No clube desde', player.entryDate ? fmtShort(player.entryDate) : null)}
          </div>

          <div style={sectionTitle}>Treino</div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {linha('Presenças', `${assid.treinoPresentes}/${assid.treinoPossiveis}`)}
            {linha('Nota média de treino', s.avgTrainingRating ?? '—')}
          </div>

          {wellnessRecs.length > 0 && (
            <>
              <div style={sectionTitle}>Wellness — últimos registos</div>
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, marginBottom: pseRecs.length > 0 ? 16 : 0 }}>
                <Sparkline points={wellnessPontos} labels={wellnessDatas} min={1} max={5} color={T.good} unit="/5" mainLabel="wellness" width={140} height={36} />
                <span style={{ ...display, fontSize: 18, color: T.good }}>{wellnessUltimo}</span>
              </div>
            </>
          )}

          {pseRecs.length > 0 && (
            <>
              <div style={sectionTitle}>PSE — últimos registos</div>
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
                <Sparkline points={psePontos} labels={pseDatas} min={1} max={10} color={T.warn} unit="/10" mainLabel="PSE" width={140} height={36} />
                <span style={{ ...display, fontSize: 18, color: T.warn }}>{pseUltimo}</span>
              </div>
            </>
          )}
        </div>

        {/* COLUNA DIREITA: jogos + boletim clínico + desenvolvimento */}
        <div>
          <div style={sectionTitle}>Jogos</div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {linha('Titular', s.starts)}
            {linha('Entrou do banco', s.subsUsed)}
            {linha('Minutos', s.minutes)}
            {linha('Cartões', [s.yellow ? `${s.yellow} amarelo${s.yellow === 1 ? '' : 's'}` : null, s.red ? `${s.red} vermelho${s.red === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || '—')}
          </div>

          <div style={sectionTitle}>Registo clínico</div>
          {ocorrencias.length === 0 ? (
            <div style={{ ...card, color: T.mutedDim, fontSize: 12.5, marginBottom: 16 }}>Sem ocorrências registadas.</div>
          ) : (
            <RegistoClinicoJogador ocorrencias={ocorrencias} onAbrir={onAbrirLesao} />
          )}

          <div style={sectionTitle}>Desenvolvimento individual</div>
          <div style={{ ...card, color: momentos.length ? T.cream : T.mutedDim, fontSize: 12.5, marginBottom: 16 }}>
            {momentos.length === 0
              ? 'Ainda sem momentos de desenvolvimento.'
              : `${momentosAbertos} momento${momentosAbertos === 1 ? '' : 's'} ${momentosAbertos === 1 ? 'aberto' : 'abertos'} de ${momentos.length}${ultimoMomento ? ` · último a ${fmtShort(ultimoMomento.data)}` : ''}`}
          </div>

          <CadastroDisciplinar diario={diario} playerId={player.id} card={card} sectionTitle={sectionTitle} matches={matches} />
        </div>
      </div>

      {fotoAmpliada && player.photo && (
        <ImageLightbox src={player.photo} alt={player.name} onClose={() => setFotoAmpliada(false)} />
      )}
    </div>
  );
}

