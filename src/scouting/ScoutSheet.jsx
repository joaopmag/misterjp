// scouting/ScoutSheet.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, body, display } from '../base/tema';
import { age } from '../plantel/PlayerModal';
import { ChevronLeft, Share2, Printer, Pencil, Check } from 'lucide-react';
import { fmtDate } from '../base/utilidades';
import { MediaLibrary } from '../media/MediaLibrary';
import { useState } from 'react';
import { FIELD_GRID, FIELD_FULL, Field, Input, Select, TextArea, Btn } from '../base/ui';
import { POSITIONS } from '../dominio/jogadores';
import { PhotoField } from '../base/fotos';
import { DOMINANT_FEET, RATING_LEVELS, RatingStars, SCOUT_PILLARS, pillarAverage } from './comum';
import { useSubColecao } from '../base/subcolecao';

/* Ficha completa em ecrã — o mesmo conteúdo e a mesma disposição da
   página que sai na partilha, para o treinador ver antes de enviar. */
/* Pontos genéricos de cada posição, para o mini-campo da ficha de
   observação — SEM tática nenhuma associada (o jogador observado não
   joga por nós, não faz sentido escolher 4-3-3 ou 4-4-2 para ele). É só
   uma referência visual de "mais ou menos aqui em campo", a mesma para
   qualquer formação.

   NA VERTICAL, de propósito — diferente do `PrancheteDoPlantel`
   (pensado para o campo deitado, com vários jogadores por lugar). Aqui
   é sempre no máximo duas marcas soltas, sem listas de nomes por baixo;
   um campo alto e estreito lê-se melhor ao lado da foto e da tabela de
   identificação do que um campo largo, que ali ficava desformatado.
   `x` é o lado (esquerda/direita), `y` é a profundidade — 0 é a
   baliza adversária (o ataque), 1 é a própria baliza. */
export const POSICAO_GENERICA_VERTICAL = {
  PL: [0.50, 0.08], EE: [0.14, 0.20], ED: [0.86, 0.20], MOC: [0.50, 0.32],
  MC: [0.50, 0.46], MD: [0.50, 0.60], DE: [0.14, 0.78], DD: [0.86, 0.78],
  DC: [0.50, 0.78], GR: [0.50, 0.94],
};

/* Campo pequeno, na vertical, com só as posições que o jogador tem
   definidas (principal, e secundária se for diferente) — nunca o campo
   todo com as outras oito vazias, que não diriam nada sobre ELE em
   concreto. Desenhado à mão (não reaproveita o `PrancheteDoPlantel`,
   pensado para o campo deitado e para várias pessoas por lugar — aqui
   é sempre uma ou duas marcas soltas). */
export function QuadroPosicaoJogador({ position, secondaryPosition, horizontal }) {
  const marcas = [];
  if (position && POSICAO_GENERICA_VERTICAL[position]) marcas.push({ id: 'p', rotulo: position, ponto: POSICAO_GENERICA_VERTICAL[position] });
  if (secondaryPosition && secondaryPosition !== position && POSICAO_GENERICA_VERTICAL[secondaryPosition]) {
    marcas.push({ id: 's', rotulo: secondaryPosition, ponto: POSICAO_GENERICA_VERTICAL[secondaryPosition] });
  }
  if (!marcas.length) return null;

  if (horizontal) {
    // Mesmos pontos genéricos, rodados 90°: a profundidade (y, 0 = ataque)
    // passa a eixo horizontal — ataque à direita, baliza própria à
    // esquerda — e o lado (x) fica no eixo vertical.
    const W = 150, H = 100; // 3:2 — campo deitado
    const raio = 4; // cantos
    return (
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          position: 'relative', height: '100%', maxWidth: '100%', aspectRatio: `${W} / ${H}`,
          background: '#1E3A24', borderRadius: 10, border: `1px solid ${T.line}`, overflow: 'hidden',
        }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <line x1={W / 2} y1="3" x2={W / 2} y2={H - 3} stroke="#ffffff40" strokeWidth="1" />
            <circle cx={W / 2} cy={H / 2} r={H * 0.24} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <circle cx={W / 2} cy={H / 2} r="0.8" fill="#ffffff40" />
            {/* Grande área — à esquerda (a nossa, onde fica sempre o GR) e à
                direita (baliza adversária). */}
            <rect x="3" y={H * 0.22} width={W * 0.15} height={H * 0.56} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <rect x={W - 3 - W * 0.15} y={H * 0.22} width={W * 0.15} height={H * 0.56} fill="none" stroke="#ffffff40" strokeWidth="1" />
            {/* Pequena área e marca de grande penalidade, dos dois lados. */}
            <rect x="3" y={H * 0.36} width={W * 0.06} height={H * 0.28} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <rect x={W - 3 - W * 0.06} y={H * 0.36} width={W * 0.06} height={H * 0.28} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <circle cx={W * 0.12} cy={H / 2} r="0.7" fill="#ffffff40" />
            <circle cx={W - W * 0.12} cy={H / 2} r="0.7" fill="#ffffff40" />
            {/* Balizas — o próprio "N" da rede a sair da linha de fundo. */}
            <rect x={3 - 2.4} y={H * 0.42} width="2.4" height={H * 0.16} fill="none" stroke="#ffffff66" strokeWidth="1" />
            <rect x={W - 3} y={H * 0.42} width="2.4" height={H * 0.16} fill="none" stroke="#ffffff66" strokeWidth="1" />
            {/* Cantos — um quarto de círculo em cada esquina. */}
            <path d={`M ${3 + raio} 3 A ${raio} ${raio} 0 0 1 3 ${3 + raio}`} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <path d={`M ${W - 3 - raio} 3 A ${raio} ${raio} 0 0 0 ${W - 3} ${3 + raio}`} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <path d={`M 3 ${H - 3 - raio} A ${raio} ${raio} 0 0 1 ${3 + raio} ${H - 3}`} fill="none" stroke="#ffffff40" strokeWidth="1" />
            <path d={`M ${W - 3} ${H - 3 - raio} A ${raio} ${raio} 0 0 0 ${W - 3 - raio} ${H - 3}`} fill="none" stroke="#ffffff40" strokeWidth="1" />
          </svg>
          {marcas.map(m => (
            <span key={m.id} style={{
              position: 'absolute', left: `${(1 - m.ponto[1]) * 100}%`, top: `${m.ponto[0] * 100}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%',
              background: T.corEquipa, color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '.01em',
            }}>{m.rotulo}</span>
          ))}
        </div>
      </div>
    );
  }

  const W = 100, H = 150; // proporção 2:3 — um campo real deitado a rodar 90°
  return (
    <div style={{ width: 160, flexShrink: 0 }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`,
        background: '#1E3A24', borderRadius: 10, border: `1px solid ${T.line}`, overflow: 'hidden',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke="#ffffff40" strokeWidth="1" />
          <line x1="3" y1={H / 2} x2={W - 3} y2={H / 2} stroke="#ffffff40" strokeWidth="1" />
          <circle cx={W / 2} cy={H / 2} r={W * 0.16} fill="none" stroke="#ffffff40" strokeWidth="1" />
          <circle cx={W / 2} cy={H / 2} r="0.8" fill="#ffffff40" />
          {/* Grande área — em cima (baliza adversária) e em baixo (a nossa,
              onde fica sempre o GR). */}
          <rect x={W * 0.22} y="3" width={W * 0.56} height={H * 0.15} fill="none" stroke="#ffffff40" strokeWidth="1" />
          <rect x={W * 0.22} y={H - 3 - H * 0.15} width={W * 0.56} height={H * 0.15} fill="none" stroke="#ffffff40" strokeWidth="1" />
        </svg>
        {marcas.map(m => (
          <span key={m.id} style={{
            position: 'absolute', left: `${m.ponto[0] * 100}%`, top: `${m.ponto[1] * 100}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%',
            background: T.corEquipa, color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '.01em',
          }}>{m.rotulo}</span>
        ))}
      </div>
    </div>
  );
}

/* Ficha do jogador observado — segue a MESMA estrutura da ficha do
   plantel (`PlayerProfilePage`): cabeçalho com foto/iniciais à
   esquerda e nome à direita, depois cartões numa grelha simples de
   duas colunas (`repeat(auto-fit, minmax(280px, 1fr))`). Nada de
   grelhas com títulos a atravessar colunas fixas nem imagens presas a
   uma célula concreta — era isso que partia sempre que se ajustava
   fosse o quê fosse. A foto entra no cabeçalho (como no plantel) e o
   campo de posições entra dentro do seu próprio cartão, centrado —
   cada peça vive isolada dentro da sua caixa, sem depender da
   disposição das outras. */
export function ScoutSheetPage({ player: x, videos, setVideos, onBack, onEdit, onShare, onPrint }) {
  const avg = pillarAverage(x);
  const potentialLabel = (RATING_LEVELS.find(r => r.value === Number(x.potential)) || {}).label || '';
  const playerAge = x.birthYear ? age(x.birthYear) : (x.age || null);
  /* A fatia dos vídeos DESTE jogador observado — mesmo padrão do
     adversário: qualquer vídeo criado aqui dentro fica automaticamente
     marcado com o `scoutId` certo, sem aparecer no Canal geral. */
  const [videosDoJogador, setVideosDoJogadorBase] = useSubColecao(videos, setVideos, v => v.scoutId === x.id);
  const setVideosDoJogador = (novoOuFn) => {
    setVideosDoJogadorBase(prev => {
      const novo = typeof novoOuFn === 'function' ? novoOuFn(prev) : novoOuFn;
      return novo.map(v => (v.scoutId ? v : { ...v, scoutId: x.id }));
    });
  };

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 14px' };
  const sectionTitle = { fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, gap: 10 };
  const linha = (label, valor) => valor !== null && valor !== undefined && valor !== '' && (
    <div key={label} style={rowStyle}>
      <span style={{ color: T.mutedDim }}>{label}</span>
      <span style={{ color: T.cream, textAlign: 'right' }}>{valor}</span>
    </div>
  );

  const semPilares = SCOUT_PILLARS.every(p => !x[`${p.key}Rating`] && !x[`${p.key}Notes`]);

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Jogadores
      </button>

      {/* CABEÇALHO — foto (ou iniciais) à esquerda, nome e dados-chave
          à direita, tal como na ficha do plantel. */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' }}>
        {x.photo ? (
          <img src={x.photo} alt="Fotografia" style={{
            width: 72, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 8,
            border: `1px solid ${T.line}`, background: '#000', flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 72, aspectRatio: '3 / 4', borderRadius: 8, background: T.surface, border: `1px solid ${T.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontSize: 20, fontWeight: 600, color: T.mutedDim, ...display,
          }}>
            {(x.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ ...display, fontSize: 20, color: T.cream }}>{x.name || 'Jogador observado'}</div>
          <div style={{ color: T.mutedDim, fontSize: 12.5, marginTop: 4 }}>
            {[
              x.position ? (x.secondaryPosition ? `${x.position}/${x.secondaryPosition}` : x.position) : null,
              x.club, playerAge ? `${playerAge} anos` : (x.birthYear || null), x.dominantFoot,
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

      {/* POTENCIAL EM DESTAQUE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <RatingStars value={Number(x.potential) || 0} />
        <span style={{ fontSize: 13, color: T.cream }}>
          {x.potential ? `Potencial ${x.potential}/5${potentialLabel ? ` — ${potentialLabel}` : ''}` : 'Sem classificação de potencial'}
        </span>
        {avg !== null && <span style={{ fontSize: 12.5, color: T.mutedDim }}>· Média dos 4 pilares: {avg}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20, alignItems: 'stretch' }}>
        {/* LINHA 1: Identificação e Posição em campo — as MESMAS medidas.
            `alignItems: stretch` (o valor por omissão do grid) já obriga
            os dois blocos à mesma altura da linha; o cartão do campo
            cresce com `flex: 1` até essa altura, e é o campo lá dentro
            que se adapta a ela (ver `QuadroPosicaoJogador`), nunca ao
            contrário. Antes o campo mandava (a moldura seguia a LARGURA
            da coluna) e saía sempre mais alto do que a Identificação. */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 220 }}>
          <div style={sectionTitle}>Identificação</div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {linha('Clube atual', x.club)}
            {linha('Ano de nascimento', x.birthYear)}
            {linha('Idade', playerAge ? `${playerAge} anos` : null)}
            {linha('País', x.nationality)}
            {linha('Fim de contrato', x.contractEnd)}
            {linha('Posição principal', x.position)}
            {linha('Posição secundária', x.secondaryPosition)}
            {linha('Pé dominante', x.dominantFoot)}
            {linha('Data de observação', x.observationDate ? fmtDate(x.observationDate) : null)}
          </div>
        </div>

        {(x.position || x.secondaryPosition) && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 220 }}>
            <div style={sectionTitle}>Posição</div>
            <div style={{ ...card, flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' }}>
              <QuadroPosicaoJogador position={x.position} secondaryPosition={x.secondaryPosition} horizontal />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* LINHA 2: Características/Notas e 4 pilares de rendimento —
            preenchem as duas colunas ao mesmo tempo, sem depender da
            altura da linha 1 em cima. */}
        <div>
          {x.traits && (
            <>
              <div style={sectionTitle}>Características</div>
              <div style={{ ...card, marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: T.mutedDim, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{x.traits}</p>
              </div>
            </>
          )}
          {x.notes && (
            <>
              <div style={sectionTitle}>Notas gerais</div>
              <div style={card}>
                <p style={{ fontSize: 13, color: T.mutedDim, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{x.notes}</p>
              </div>
            </>
          )}
        </div>

        <div>
          <div style={sectionTitle}>4 pilares de rendimento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {semPilares ? (
              <div style={{ ...card, color: T.mutedDim, fontSize: 12.5 }}>Ainda sem avaliação dos 4 pilares.</div>
            ) : SCOUT_PILLARS.map(p => {
              const rating = p ? x[`${p.key}Rating`] : null;
              const notes = x[`${p.key}Notes`];
              if (!rating && !notes) return null;
              return (
                <div key={p.key} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: notes ? 6 : 0 }}>
                    <span style={{ color: T.cream, fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                    {rating ? <RatingStars value={Number(rating)} /> : <span style={{ fontSize: 11.5, color: T.mutedDim }}>sem avaliação</span>}
                  </div>
                  {notes && <p style={{ fontSize: 12, color: T.mutedDim, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* VÍDEOS — mesma Biblioteca (Canal) usada no adversário, filtrada a
          este jogador observado. `semCatalogo`: só há os vídeos dele, não
          há nada para organizar em pastas. */}
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>
        Vídeos
      </div>
      <MediaLibrary
        items={videosDoJogador} setItems={setVideosDoJogador}
        addLabel="Adicionar vídeo"
        addButtonVariant="ghost"
        semCatalogo
        emptyText="Ainda sem vídeos deste jogador. Cola o link do YouTube, Instagram, TikTok ou Facebook, ou carrega um ficheiro."
        emptyFirstLabel="Adicionar o primeiro vídeo"
      />
    </div>
  );
}

export const emptyScout = {
  name: '', birthYear: '', nationality: '', club: '', contractEnd: '',
  position: 'MC', secondaryPosition: '', dominantFoot: 'Direito',
  potential: 3,
  technicalRating: 0, technicalNotes: '',
  tacticalRating: 0, tacticalNotes: '',
  physicalRating: 0, physicalNotes: '',
  psychologicalRating: 0, psychologicalNotes: '',
  traits: '', observationDate: '', notes: '', photo: null,
};

export function ScoutPlayerForm({ player, onBack, onSave }) {
  const [f, setF] = useState(player ? { ...emptyScout, ...player } : { ...emptyScout });
  const playerAge = f.birthYear ? age(f.birthYear) : null;
  const avg = pillarAverage(f);

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Jogadores
      </button>

      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 20 }}>
        {player ? 'Editar jogador adversário' : 'Novo jogador adversário'}
      </div>

      <SubHeading>Dados e perfil</SubHeading>
      <div style={{ ...FIELD_GRID, marginBottom: 18 }}>
        <div style={FIELD_FULL}>
          <Field label="Nome completo"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Nome do jogador" autoFocus /></Field>
        </div>
        <Field label="País"><Input value={f.nationality} onChange={e => setF({ ...f, nationality: e.target.value })} placeholder="Portugal" /></Field>
        <Field label="Ano de nascimento">
          <Input type="number" value={f.birthYear} onChange={e => setF({ ...f, birthYear: e.target.value })} placeholder="2008" />
        </Field>
        <Field label="Idade">
          <Input value={playerAge !== null ? `${playerAge} anos` : '—'} readOnly disabled />
        </Field>
        <Field label="Clube atual"><Input value={f.club} onChange={e => setF({ ...f, club: e.target.value })} placeholder="Clube atual" /></Field>
        <Field label="Nº camisola">
          <Input type="number" inputMode="numeric" min={1} max={99} value={f.camisola || ''}
            onChange={e => setF({ ...f, camisola: e.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="Ex.: 18" />
        </Field>
        <Field label="Fim de contrato"><Input type="date" value={f.contractEnd} onChange={e => setF({ ...f, contractEnd: e.target.value })} /></Field>
        <Field label="Posição principal">
          <Select value={f.position} onChange={e => setF({ ...f, position: e.target.value })}>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Posição secundária">
          <Select value={f.secondaryPosition} onChange={e => setF({ ...f, secondaryPosition: e.target.value })}>
            <option value="">—</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Pé dominante">
          <Select value={f.dominantFoot} onChange={e => setF({ ...f, dominantFoot: e.target.value })}>
            {DOMINANT_FEET.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </div>

      <SubHeading>4 pilares de rendimento</SubHeading>
      {SCOUT_PILLARS.map(p => (
        <div key={p.key} style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'start' }}>
            <Field label={p.label}>
              <Select value={f[`${p.key}Rating`]} onChange={e => setF({ ...f, [`${p.key}Rating`]: Number(e.target.value) })}>
                <option value={0}>Sem nota</option>
                {RATING_LEVELS.map(r => <option key={r.value} value={r.value}>{r.value}</option>)}
              </Select>
            </Field>
            <Field label="Observações">
              <Input value={f[`${p.key}Notes`]} onChange={e => setF({ ...f, [`${p.key}Notes`]: e.target.value })} placeholder="Observações" />
            </Field>
          </div>
          <p style={{ color: T.mutedDim, fontSize: 11, lineHeight: 1.4, margin: '4px 0 0' }}>{p.hint}</p>
        </div>
      ))}
      {avg !== null && <p style={{ color: T.mutedDim, fontSize: 12, margin: '0 0 18px' }}>Média: {avg}</p>}

      <SubHeading>3. Potencial geral</SubHeading>
      <div style={{ marginBottom: 8 }}>
        <Field label="Potencial (projeção para o futebol profissional)">
          <Select value={f.potential} onChange={e => setF({ ...f, potential: Number(e.target.value) })}>
            {RATING_LEVELS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </Field>
      </div>
      <p style={{ color: T.mutedDim, fontSize: 11.5, lineHeight: 1.5, margin: '0 0 18px' }}>
        {RATING_LEVELS.find(r => r.value === f.potential)?.desc}
      </p>

      <SubHeading>4. Observação</SubHeading>
      <div style={{ marginBottom: 12 }}>
        <Field label="Data de observação"><Input type="date" value={f.observationDate} onChange={e => setF({ ...f, observationDate: e.target.value })} /></Field>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Field label="Características"><TextArea value={f.traits} onChange={e => setF({ ...f, traits: e.target.value })} placeholder="Perfil físico, pontos fortes/fracos..." /></Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Notas gerais"><TextArea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Contexto em que foi observado, evolução..." /></Field>
      </div>
      <div style={{ marginBottom: 18 }}>
        <PhotoField label="Fotografia do jogador" value={f.photo || null}
          onChange={photo => setF({ ...f, photo })}
          hint="Aparece na ficha partilhada e na impressão. A imagem é reduzida automaticamente." />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onBack}>Cancelar</Btn>
        <Btn disabled={!f.name} onClick={() => onSave(f)}><Check size={15} /> Guardar</Btn>
      </div>
    </div>
  );
}

export function SubHeading({ children }) {
  return (
    <div style={{
      color: T.warn, fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
      margin: '18px 0 10px', paddingBottom: 6, borderBottom: `1px solid ${T.line}`,
    }}>{children}</div>
  );
}

