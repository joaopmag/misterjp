// atleta/separadoresJogo.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { formatShortDatePt, fmtDate } from '../base/utilidades';
import { T, body, mono, display, TEXT_ON_ACCENT, T_ESCURO } from '../base/tema';
import React, { useState, useRef } from 'react';
import { useIsMobile, Modal } from '../base/ui';
import { ExercisePresentation } from '../treino/ExercisePresentation';
import { distribuirPlantel } from '../tatico/prancheta';
import { PrancheteDoPlantel } from '../plantel/Prancheta';
import { DiagramThumb, DiagramThumbAnimado } from '../treino/diagramas';
import { MediaFeedItem } from '../media/social';
import { AttachmentPreview } from '../media/leitores';
import { useKioskVoltar } from '../base/kiosk';
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { usePortalFetch, usePortalRpc } from './portalRpc';
import { VisualizadorVideoPortal } from './VisualizadorVideoPortal';

/* CONVOCATÓRIA NO PORTAL.
   Em cima, o cartão de sempre com a informação do jogo (sem emblemas),
   com o nome do jogo em destaque. Por baixo, os convocados em 4 colunas,
   por número: foto redonda, número na bola e nome por baixo (o próprio
   jogador com anel dourado). No canto, o carimbo redondo do clube, como
   numa folha oficial da equipa técnica. */
export function cvDataCurta(iso) {
  return iso ? formatShortDatePt(iso) : '';
}

/* O carimbo da equipa técnica com a faixa "CONVOCADO" (só para quem vai
   ao jogo): selo limpo, numa só letra (Oswald), com o nome do clube no
   arco de cima e "EQUIPA TÉCNICA" no de baixo; a faixa dourada atravessa
   o selo e sai um pouco para fora, com as pontas em cauda de andorinha. */
export function CvCarimbo({ clube, tam, data }) {
  const cor = T.gold;
  const dm = /^\d{4}-(\d{2})-(\d{2})/.exec(String(data || ''));
  const id = React.useId().replace(/:/g, '');
  const nome = String(clube || 'Equipa').replace(/\s+(u|sub)-?\d{1,2}\b.*$/i, '').toUpperCase();
  const f = { fontFamily: "'Oswald', sans-serif", fontWeight: 500 };
  const arco = { ...f, fontSize: 10, letterSpacing: '.16em' };
  const longo = nome.length > 13;
  return (
    <svg aria-hidden="true" width={tam} height={tam} viewBox="-8 0 136 120" style={{ display: 'block', transform: 'rotate(-8deg)', pointerEvents: 'none', overflow: 'visible' }}>
      <defs>
        <path id={`cv-cima-${id}`} d="M 21,50 A 40,40 0 0 1 99,50" />
        <path id={`cv-baixo-${id}`} d="M 17,73 A 44,44 0 0 0 103,73" />
      </defs>
      <g fill={cor} stroke={cor}>
        <circle cx="60" cy="60" r="56" fill="none" strokeWidth="1.8" />
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="0.7" />
        <text stroke="none" style={arco}>
          <textPath href={`#cv-cima-${id}`} startOffset="50%" textAnchor="middle" {...(longo ? { textLength: 96, lengthAdjust: 'spacingAndGlyphs' } : {})}>{nome}</textPath>
        </text>
        <text stroke="none" style={arco}>
          <textPath href={`#cv-baixo-${id}`} startOffset="50%" textAnchor="middle">EQUIPA TÉCNICA</textPath>
        </text>
        {/* A faixa: sai para fora do selo dos dois lados. */}
        <path d="M -6,50 L 126,50 L 119,60 L 126,70 L -6,70 L 1,60 Z" stroke="none" />
        <text x="60" y="64.5" textAnchor="middle" stroke="none" fill="#1B231D" textLength="74" lengthAdjust="spacingAndGlyphs" style={{ ...f, fontSize: 13, fontWeight: 600 }}>CONVOCADO</text>
        {/* Por cima da faixa, a data do jogo: o carimbo fica "datado". */}
        {dm && <text x="60" y="44" textAnchor="middle" stroke="none" style={{ ...f, fontSize: 10, letterSpacing: '.14em' }}>{`${dm[2]}.${dm[1]}`}</text>}
      </g>
    </svg>
  );
}

export function CvJogador({ p, eu, tam }) {
  const cor = T.corEquipa || T.crimson;
  const exp = p.id == null;
  const iniciais = String(p.name || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const num = typeof p.number === 'number' ? p.number : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span style={{ position: 'relative', width: tam, height: tam, flexShrink: 0 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cor, color: '#fff', fontSize: tam * 0.3, fontWeight: 700, ...body,
          boxShadow: eu
            ? `0 0 0 2px ${T.surface}, 0 0 0 4.5px ${T.gold}, 0 0 18px ${T.gold}55`
            : `0 0 0 2px ${T.surface}, 0 0 0 3.5px ${exp ? T.mutedDim : '#ffffffcc'}`,
        }}>
          {iniciais}
          {/* Sem a foto (não carregou), ficam as iniciais por baixo. */}
          {p.photo && <img src={p.photo} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#E4E8E3' }} />}
        </span>
        {num != null && (
          <span style={{
            position: 'absolute', right: -4, bottom: -2, minWidth: 24, height: 24, padding: '0 4px', boxSizing: 'border-box', borderRadius: 12,
            background: eu ? T.goldFundo : '#0d1a12', color: eu ? '#1B231D' : '#ECEFEA', border: `2px solid ${T.surface}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, ...mono,
          }}>{num}</span>
        )}
      </span>
      <span style={{ fontSize: 13, fontWeight: eu ? 700 : 500, color: eu ? T.gold : T.cream, textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', ...body }}>
        {/* O nome por que é conhecido, se o servidor o enviar (ver Plantel). */}
        {String(p.alcunha || '').trim() || p.name}{exp && <span style={{ color: T.mutedDim, fontWeight: 400 }}> (exp)</span>}
      </span>
    </div>
  );
}

export function PlayerConvocatoriasTab({ code, teamId, jogadorId, logo, infoJogo }) { // eslint-disable-line no-unused-vars
  const [estado, dados] = usePortalFetch('checkin_convocatoria', code, teamId);
  const estreito = useIsMobile(560);
  // No computador, a convocatória ocupa a página toda (sem scroll).
  const largo = !useIsMobile(900);
  if (estado === 'a-carregar') return <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>;
  if (estado === 'erro') return <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>;
  const lista = (dados && dados.convocatorias) || [];
  const nossoClube = (dados && dados.clube) || 'Equipa';
  if (lista.length === 0) {
    return <div style={{ fontSize: 13, color: T.mutedDim }}>Ainda não há nenhuma convocatória partilhada contigo.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, margin: largo ? '0 auto' : 0 }}>
      {lista.map(c => {
        // Por número da camisola — quem não tem número atribuído vai
        // para o fim. Os jogadores à experiência (sem `id`, porque não
        // têm ficha no Plantel) vão sempre a seguir a esses, no fundo
        // de todos — nunca misturados a meio da lista.
        const convocados = [...(c.convocados || [])].sort((a, b) => {
          const expA = a.id == null;
          const expB = b.id == null;
          if (expA !== expB) return expA ? 1 : -1;
          const na = typeof a.number === 'number' ? a.number : Infinity;
          const nb = typeof b.number === 'number' ? b.number : Infinity;
          return na - nb;
        });
        const tamCarimbo = estreito ? 80 : 96;
        let jornada = '';
        try { jornada = (infoJogo && (infoJogo(c) || {}).jornada) || ''; } catch (e) { jornada = ''; }
        const tam = estreito ? 54 : 66;
        return (
          <div key={c.id} style={{ position: 'relative', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: estreito ? 14 : 20, overflow: 'hidden' }}>
            {/* Carimbo com a faixa "CONVOCADO" (só para quem vai ao jogo). */}
            {c.convocado && (
              <div style={{ position: 'absolute', right: estreito ? 12 : 22, top: estreito ? 12 : 16 }}>
                <CvCarimbo clube={nossoClube} tam={tamCarimbo} data={c.data} />
              </div>
            )}

            {/* No telemóvel só a mensagem fica ao lado do carimbo; o nome do
                jogo usa a largura toda, por baixo dele. */}
            <div>
              {/* TIPOGRAFIA: só duas letras (Inter no texto, Oswald no nome do
                  jogo) e três tamanhos: 11 (rótulos), 13,5 (texto) e o título. */}
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45, color: c.convocado ? T.gold : T.mutedDim, marginBottom: 14, paddingRight: c.convocado ? tamCarimbo + 8 : 0, minHeight: c.convocado && estreito ? tamCarimbo - 6 : 0, ...body }}>
                {c.convocado ? (
                  <>
                    <div>Parabéns estás convocado.</div>
                    <div style={{ marginTop: 2, fontWeight: 400, color: T.cream }}>Estar convocado é o primeiro passo; o foco agora é a vitória da equipa.</div>
                  </>
                ) : (
                  'Desta vez não estás na lista de convocados. Levanta a cabeça e foca-te no próximo treino.'
                )}
              </div>
              {/* Jornada, dia e hora numa só linha, a cinza, por cima do nome do jogo.
                  O local fica só na concentração (sem concentração, vem aqui). */}
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 4, ...body }}>
                {[jornada, cvDataCurta(c.data), c.horaJogo, (c.horaConcentracao || c.localConcentracao) ? '' : c.localJogo].filter(Boolean).join(' · ')}
              </div>
              {/* O nome do jogo, em destaque. */}
              {/* Numa só linha: no telemóvel a letra encolhe com o ecrã. */}
              <div style={{ ...display, fontSize: estreito ? 'clamp(15px, 4.7vw, 20px)' : 24, fontWeight: 600, lineHeight: 1.2, color: T.textoForte, letterSpacing: '.01em', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.casaFora === 'Fora'
                  ? <>{c.adversario} <span style={{ color: T.muted, fontWeight: 400 }}>vs</span> {nossoClube}</>
                  : <>{nossoClube} <span style={{ color: T.muted, fontWeight: 400 }}>vs</span> {c.adversario}</>}
              </div>
              {(c.horaConcentracao || c.localConcentracao) && (
                <div style={{ fontSize: 13.5, lineHeight: 1.45, color: T.gold, marginTop: 2, ...body }}>
                  Concentração: {[c.horaConcentracao, c.localConcentracao].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            {c.outrasInfo && <div style={{ fontSize: 13.5, color: T.cream, marginTop: 10, lineHeight: 1.45, ...body }}>{c.outrasInfo}</div>}

            {convocados.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.warn, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 16, ...body }}>
                  Convocados · {convocados.length}
                </div>
                {/* 4 colunas, por número. A foto vem do servidor (campo
                    `photo`); sem ela, uma bola na cor da equipa com as
                    iniciais. */}
                <div style={{ display: 'grid', gridTemplateColumns: largo ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', columnGap: estreito ? 6 : 14, rowGap: estreito ? 16 : 20 }}>
                  {convocados.map((p, i) => (
                    <CvJogador key={p.id || `x-${i}`} p={p} eu={!!(jogadorId && p.id && p.id === jogadorId)} tam={tam} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PlayerPlanoJogoTab({ code, teamId }) {
  const [estado, dados] = usePortalFetch('checkin_plano_jogo', code, teamId);
  const [aVer, setAVer] = useState(null);
  if (estado === 'a-carregar') return <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>;
  if (estado === 'erro') return <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>;
  const ideias = (dados && dados.ideias) || [];
  if (aVer) {
    return <ExercisePresentation exercise={{ ...aVer, name: aVer.name || aVer.phase || 'Ideia de jogo' }} onClose={() => setAVer(null)} />;
  }
  if (ideias.length === 0) {
    return <div style={{ fontSize: 13, color: T.mutedDim }}>Ainda não há nenhum plano de jogo partilhado contigo.</div>;
  }
  // Onze ainda por revelar: o servidor manda as ideias só com as posições.
  const onzeEscondido = ideias.some(x => x && x.onzeEscondido);
  // Mesma organização por momento de jogo do "Ideia de Jogo" — reaproveita
  // `MOMENTOS_JOGO`/`ColunaIdeias`, para o atleta encontrar as coisas nos
  // dois sítios da mesma forma, em vez de teres de aprender duas
  // organizações diferentes.
  //
  // A grelha fixa de 5 colunas (`repeat(5, ...)`) nunca tinha sido
  // corrigida aqui — num ecrã estreito espremia as 5 colunas até
  // ficarem minúsculas e os títulos cortados ("Pr...", "Bl..."). O
  // "Ideia de Jogo" já usava scroll horizontal com largura em `vw` para
  // isto mesmo; aqui é a mesma correção, só que nunca tinha chegado a
  // este sítio (são dois componentes diferentes, mesmo mostrando o
  // mesmo tipo de conteúdo).
  return (
    <>
    {onzeEscondido && (
      <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 12, lineHeight: 1.5, ...body }}>
        Por agora as ideias mostram só as posições. Os números e os nomes aparecem quando o onze for revelado.
      </div>
    )}
    <div style={{
      display: 'flex', flexWrap: 'nowrap', gap: 16, overflowX: 'auto', paddingBottom: 8,
      WebkitOverflowScrolling: 'touch',
    }}>
      {MOMENTOS_JOGO.map(momento => {
        const doMomento = ideias.filter(x => x.phase === momento);
        if (!doMomento.length) return null;
        return (
          <div key={momento} style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
            <ColunaIdeias titulo={momento} itens={doMomento} onAbrir={setAVer} />
          </div>
        );
      })}
      {(() => {
        const restantes = ideias.filter(x => !MOMENTOS_JOGO.includes(x.phase));
        if (!restantes.length) return null;
        return (
          <div style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
            <ColunaIdeias titulo="Outras" itens={restantes} onAbrir={setAVer} />
          </div>
        );
      })()}
    </div>
    </>
  );
}

export function PlayerAdversarioTab({ code, teamId }) {
  const [estado, dados] = usePortalFetch('checkin_adversario', code, teamId);
  const [aVer, setAVer] = useState(null);
  const [taticaViewing, setTaticaViewing] = useState(null);
  const [selecionadoId, setSelecionadoId] = useState(null);

  if (estado === 'a-carregar') return <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>;
  if (estado === 'erro') return <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>;
  const lista = (dados && dados.adversarios) || [];
  if (lista.length === 0) {
    return <div style={{ fontSize: 13, color: T.mutedDim }}>Ainda não há nenhum adversário partilhado contigo.</div>;
  }
  const a = lista.find(x => x.id === selecionadoId) || lista[0];
  const chave = a.chave || [];
  const taticas = a.taticas || [];
  const labelTatica = (t) => (t.nome && t.nome.trim()) ? t.nome.trim() : `Dinâmica ${taticas.indexOf(t) + 1}`;
  const bloco = (titulo, texto) => texto && (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{titulo}</div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: T.cream, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{texto}</div>
    </div>
  );

  return (
    <div>
      {/* Mais do que um adversário partilhado — um separador simples
          para trocar entre eles, tal como as pastas na Biblioteca. */}
      {lista.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {lista.map(x => {
            const on = x.id === a.id;
            return (
              <button key={x.id} onClick={() => setSelecionadoId(x.id)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
                background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
                border: `1px solid ${on ? '#B5393F' : T.line}`,
              }}>{x.nome}</button>
            );
          })}
        </div>
      )}

      {/* MESMA PÁGINA DO ADVERSÁRIO QUE O STAFF VÊ EM SCOUTING — só de
          consulta: sem "Adicionar dinâmica", sem "Adicionar vídeo",
          sem ícones de editar/apagar em lado nenhum. */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...display, fontSize: 20, color: T.cream }}>{a.nome}</div>
        <div style={{ color: T.mutedDim, fontSize: 12.5, marginTop: 4 }}>
          {[a.escalao, a.prova, a.quadroTatica].filter(Boolean).join(' · ') || 'Sem detalhes ainda'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Estrutura habitual</div>
          {!a.quadroTatica ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim }}>Ainda sem estrutura marcada para este adversário.</div>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
              <PrancheteDoPlantel
                lugares={distribuirPlantel({
                  players: chave, attendance: chave.map(x => x.id), overrides: a.quadroOverrides, tatica: a.quadroTatica,
                })}
                escala={1.25}
                maxLargura={900}
                tela
              />
            </div>
          )}
        </div>

        <div>
          {bloco('Pontos fortes', a.pontosFortes)}
          {bloco('Pontos fracos', a.pontosFracos)}

          <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Jogadores-chave
          </div>
          {chave.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>Nenhum jogador-chave marcado ainda.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
              {chave.map(x => (
                <div key={x.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ color: T.cream, fontWeight: 500, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.camisola ? <span style={{ color: '#E84A5F', fontWeight: 800, marginRight: 6, ...mono }}>{x.camisola}</span> : null}{x.name}
                  </div>
                  <div style={{ color: T.mutedDim, fontSize: 11.5, marginTop: 2 }}>{[x.position, x.dominantFoot ? `pé ${x.dominantFoot.toLowerCase()}` : '', x.club].filter(Boolean).join(' · ')}</div>
                  {/* As características escritas no adversário (que vivem na
                      ficha do jogador) — as primeiras linhas, para ler de
                      relance. */}
                  {x.traits && (
                    <div style={{ color: T.cream, fontSize: 12, lineHeight: 1.45, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{x.traits}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!a.pontosFortes && !a.pontosFracos && (
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>Ainda sem notas de análise.</div>
      )}

      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>Dinâmicas</div>
      {taticas.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>Ainda sem dinâmicas registadas para este adversário.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          {taticas.map(t => (
            <div key={t.id} onClick={() => setTaticaViewing(t)} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
              <div style={{ color: T.cream, fontWeight: 500, fontSize: 13.5, marginBottom: 6 }}>{labelTatica(t)}</div>
              {t.phase && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-block', fontSize: 10.5, color: T.warn, background: `${T.crimson}55`, padding: '2px 8px', borderRadius: 12 }}>{t.phase}</span>
                </div>
              )}
              <DiagramThumb diagram={t.diagram} />
            </div>
          ))}
        </div>
      )}
      {taticaViewing && (
        <ExercisePresentation exercise={{ ...taticaViewing, name: labelTatica(taticaViewing) }} onClose={() => setTaticaViewing(null)} />
      )}

      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>Vídeos</div>
      {(a.videos || []).length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim }}>Ainda sem vídeos deste adversário.</div>
      ) : (
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {a.videos.map(v => (
            <MediaFeedItem key={v.id} item={v} onOpen={item => setAVer(item)} />
          ))}
        </div>
      )}

      {/* Vídeos do YouTube e das redes sociais não têm `kind` (ou não são
          ficheiros) e o botão "Abrir no visualizador" não fazia nada. Agora
          abrem num visualizador próprio, com ecrã inteiro. Os ficheiros
          (imagem, vídeo carregado, PDF, Drive) continuam como estavam. */}
      {aVer && (aVer.youtubeId || aVer.social) ? (
        <VisualizadorVideoPortal item={aVer} onClose={() => setAVer(null)} />
      ) : aVer && aVer.kind ? (
        <Modal title={aVer.title || aVer.fileName || 'Ficheiro'} onClose={() => setAVer(null)} wide>
          <AttachmentPreview item={aVer} tall />
        </Modal>
      ) : null}
    </div>
  );
}

/* IDEIA DE JOGO, DO LADO DO ATLETA — só consulta, nunca edição.

   Vai buscar tudo a uma função própria (`checkin_ideia_jogo`), pelo
   MESMO código de 4/6 dígitos já validado no login — nada de nova
   sessão, nada de nova credencial. A função só devolve o que o
   treinador marcou como visível: o texto do próximo jogo (se
   partilhado) e as ideias de jogo (esquemas) marcadas como tal. Sem
   nada partilhado, o ecrã diz isso mesmo, em vez de aparecer vazio sem
   explicação. */
// As colunas do quadro tático, do lado do atleta — os mesmos cinco
// momentos de jogo que a app já usa (`PHASES`), pela mesma ordem.
export const MOMENTOS_JOGO = ['Organização Defensiva', 'Transição Ofensiva', 'Organização Ofensiva', 'Transição Defensiva', 'Bola Parada'];

export function PlayerIdeiaJogoView({ code, teamId, onBack, fecharVolta }) {
  const [estado, dadosIdeia] = usePortalRpc('checkin_ideia_jogo', code, teamId);
  const dados = dadosIdeia ? { proximoJogo: null, ideias: [], ...dadosIdeia } : null;
  const [aVer, setAVer] = useState(null); // ideia aberta em ecrã inteiro
  // Gesto de retroceder com uma ideia aberta: fecha-a (como o X).
  useKioskVoltar(!!aVer, () => { setAVer(null); if (fecharVolta) onBack(); });

  if (aVer) {
    return (
      <ExercisePresentation
        exercise={{ ...aVer, name: aVer.name || aVer.phase || 'Ideia de jogo' }}
        /* Vindo de uma tarefa, fechar a ideia volta às Tarefas. */
        onClose={() => { setAVer(null); if (fecharVolta) onBack(); }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 18, color: T.cream, marginBottom: 12 }}>Ideia de Jogo</div>

      {estado === 'a-carregar' && (
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      )}

      {estado === 'erro' && (
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      )}

      {estado === 'pronto' && (
        <>
          {dados.proximoJogo && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: '16px 16px', marginBottom: 18, maxWidth: 560 }}>
              <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Próximo jogo{dados.proximoJogo.opponent ? ` · vs ${dados.proximoJogo.opponent}` : ''}
              </div>
              {dados.proximoJogo.date && (
                <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 10 }}>{fmtDate(dados.proximoJogo.date)}</div>
              )}
              <p style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{dados.proximoJogo.ideias}</p>
            </div>
          )}

          {dados.ideias && dados.ideias.length > 0 ? (
            <div style={{
              display: 'flex', flexWrap: 'nowrap', gap: 16, overflowX: 'auto', paddingBottom: 8,
              WebkitOverflowScrolling: 'touch',
            }}>
              {/* Largura em `vw` (percentagem do ecrã), não em pixels fixos
                 nem a depender de detetar "é telemóvel" em JavaScript —
                 isso podia falhar consoante o browser/webview e dava um
                 cartão largo demais, cortado, sem se perceber que havia
                 mais ao lado. Em `vw`, o tamanho reflete sempre o ecrã a
                 sério: no telemóvel fica compacto (perto de meio ecrã,
                 já mostrando a fatia do cartão seguinte, como pista de
                 que há mais para o lado); no computador cresce até um
                 limite razoável (220px), sem ficar minúsculo num ecrã
                 largo nem gigante num estreito. */}
              {MOMENTOS_JOGO.map(momento => {
                const doMomento = dados.ideias.filter(x => x.phase === momento);
                if (!doMomento.length) return null;
                return (
                  <div key={momento} style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
                    <ColunaIdeias titulo={momento} itens={doMomento} onAbrir={setAVer} />
                  </div>
                );
              })}
              {/* Ideias com uma fase fora das cinco categorias (Preparação
                  Física, Ativação, etc.) continuam a aparecer — só não têm
                  uma coluna própria, ficam numa "Outras". */}
              {(() => {
                const restantes = dados.ideias.filter(x => !MOMENTOS_JOGO.includes(x.phase));
                if (!restantes.length) return null;
                return (
                  <div style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
                    <ColunaIdeias titulo="Outras" itens={restantes} onAbrir={setAVer} />
                  </div>
                );
              })()}
            </div>
          ) : (
            !dados.proximoJogo && (
              <div style={{ fontSize: 13, color: T.mutedDim }}>
                Ainda não há nada partilhado aqui. Fala com o treinador se achas que devia haver.
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

/* UMA COLUNA DE UM MOMENTO DE JOGO — altura fixa, com setas para cima
   e para baixo por cima/baixo da própria coluna, não do ecrã inteiro.
   Cada coluna pode ter muitas ideias empilhadas; sem isto, era preciso
   arrastar o dedo dentro da coluna para as ver todas, o que no
   quiosque é fácil de confundir com um scroll da página toda. */
// Altura de um cartão (título de 1 linha + miniatura mais pequena +
// padding) — usada para a lista mostrar exatamente 3 cartões de cada
// vez. Reduzida mais uma vez: a coluna inteira (cabeçalho + setas + 3
// cartões) tem de caber na página sem ela própria precisar de scroll.
export const ALTURA_CARTAO_IDEIA = 178;

export const ALTURA_MINIATURA = 120;

export const GAP_CARTOES = 10;

export function ColunaIdeias({ titulo, itens, onAbrir }) {
  const listaRef = useRef(null);
  const deslizar = (dy) => { if (listaRef.current) listaRef.current.scrollBy({ top: dy, behavior: 'smooth' }); };
  const setaEstilo = {
    width: 32, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: T.surface, border: `1px solid ${T.line}`, color: T.cream, cursor: 'pointer', margin: '0 auto', flexShrink: 0,
  };
  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{titulo}</div>
      {/* As setas aparecem SEMPRE, mesmo com uma única ideia — só ficam
          desativadas (mais apagadas, sem clique) nesse caso. Antes
          desapareciam por completo quando não fazia falta deslizar, e
          isso fazia cada coluna parecer estruturada de forma diferente
          (uma com setas, outra sem). Mostrar sempre a mesma forma,
          ativa ou não, é o que dá o "mesmo comportamento" a todos os
          momentos. */}
      <button
        onClick={() => itens.length > 1 && deslizar(-(ALTURA_CARTAO_IDEIA + GAP_CARTOES))}
        title="Subir"
        disabled={itens.length <= 1}
        style={{ ...setaEstilo, marginBottom: 6, opacity: itens.length > 1 ? 1 : 0.35, cursor: itens.length > 1 ? 'pointer' : 'default' }}
      ><ChevronUp size={13} /></button>
      {/* MOSTRA SEMPRE 3 CARTÕES — nem a quantidade de ideias, nem a
          altura do ecrã, decidem isto; é uma conta fixa (3 cartões + 2
          espaços entre eles). O resto esconde-se por dentro, sem
          barra de scroll visível (`sem-scrollbar-mjp`) — quem manda no
          deslizar são as setas, a barra só distraía. */}
      <div
        ref={listaRef}
        className="sem-scrollbar-mjp"
        style={{
          display: 'flex', flexDirection: 'column', gap: GAP_CARTOES, overflowY: 'auto', scrollBehavior: 'smooth',
          height: ALTURA_CARTAO_IDEIA * 3 + GAP_CARTOES * 2,
        }}
      >
        <style>{'.sem-scrollbar-mjp{scrollbar-width:none;-ms-overflow-style:none;}.sem-scrollbar-mjp::-webkit-scrollbar{display:none;}'}</style>
        {itens.map(x => {
          const temDiagrama = x.diagram && ((x.diagram.elements || []).length || (x.diagram.arrows || []).length);
          return (
          <div
            key={x.id}
            onClick={() => onAbrir(x)}
            style={{
              background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, cursor: 'pointer',
              flexShrink: 0, height: ALTURA_CARTAO_IDEIA, overflow: 'hidden', boxSizing: 'border-box',
            }}
          >
            {/* Título com altura fixa (1 linha, sempre) — é a única parte
                de tamanho variável entre cartões; a miniatura do campo já
                tem altura fixa (ver DiagramThumb). Fixar a ALTURA DO
                CARTÃO INTEIRO (não só um mínimo) é o que garante que
                todos ficam mesmo iguais — uma ideia sem esquema nenhum
                (ainda por desenhar) não pode esticar a caixa. */}
            <div style={{
              color: T.cream, fontWeight: 500, fontSize: 14, marginBottom: 7, height: 19,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{x.name || 'Ideia de jogo'}</div>
            {temDiagrama ? (
              /* Com ▶ no canto, como nos cartões do staff: anima ali mesmo,
                 sem abrir a ideia (o toque no resto do cartão abre-a). */
              <DiagramThumbAnimado diagram={x.diagram} phase={x.phase} height={ALTURA_MINIATURA} fill />
            ) : (
              <div style={{
                width: '100%', height: ALTURA_MINIATURA, background: '#1e3a24', borderRadius: 6, marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: T_ESCURO.mutedDim,
              }}>Sem esquema</div>
            )}
          </div>
          );
        })}
      </div>
      <button
        onClick={() => itens.length > 1 && deslizar(ALTURA_CARTAO_IDEIA + GAP_CARTOES)}
        title="Descer"
        disabled={itens.length <= 1}
        style={{ ...setaEstilo, marginTop: 6, opacity: itens.length > 1 ? 1 : 0.35, cursor: itens.length > 1 ? 'pointer' : 'default' }}
      ><ChevronDown size={13} /></button>
    </div>
  );
}

