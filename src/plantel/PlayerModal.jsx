// plantel/PlayerModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState } from 'react';
import { TreinosParaEditorCtx } from '../tatico/prancheta';
import { Modal, FIELD_GRID, FIELD_FULL, Field, Input, Select, inputStyle, Btn } from '../base/ui';
import { T } from '../base/tema';
import { POSITIONS } from '../dominio/jogadores';
import { CAPTAIN_LABEL } from '../dominio/plantel';
import { Check } from 'lucide-react';
import { STATUS_OPTIONS, avaliacaoBaseDoJogador, estatutoDaAvaliacao, jogadorComAvaliacao } from './avaliacao';
import { PhotoField } from '../base/fotos';

export function age(birthYearOrDate) {
  if (!birthYearOrDate) return null;
  const s = String(birthYearOrDate);
  // Data completa (registos novos, desde que o campo passou a ser "Data
  // de nascimento"): idade exata, sensível ao dia/mês, não só ao ano.
  if (s.length > 4) {
    const d = new Date(s + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return null;
    const hoje = new Date();
    let a = hoje.getFullYear() - d.getFullYear();
    const aindaNaoFezAnosEsteAno = (hoje.getMonth() < d.getMonth())
      || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate());
    if (aindaNaoFezAnosEsteAno) a--;
    return a;
  }
  // Só o ano (registos antigos, de antes desta mudança): aproximação por
  // diferença de anos civis, como sempre foi.
  const y = parseInt(s, 10);
  if (!y || Number.isNaN(y)) return null;
  return new Date().getFullYear() - y;
}

// Formata a data de nascimento para apresentação — dd/mm/aaaa quando há
// dia completo; só o ano, tal como está gravado, nos registos antigos
// que nunca tiveram mais do que isso.
export function formatBirthdate(v) {
  if (!v) return '';
  const s = String(v);
  if (s.length <= 4) return s;
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Ano de nascimento + idade, para o subtítulo dos cartões de jogador.
// Ex.: "2009 · 17 anos". A posição deixou de aparecer aqui — passou a
// estar no crachá redondo, no lugar do número de camisola.
export function birthYearOf(player) {
  if (!player || !player.birthdate) return null;
  const s = String(player.birthdate);
  const y = s.length > 4 ? new Date(s).getFullYear() : parseInt(s, 10);
  return (!y || Number.isNaN(y)) ? null : y;
}

export function playerBirthLine(player) {
  const y = birthYearOf(player);
  const a = age(player && player.birthdate);
  if (y === null) return '—';
  return a === null ? String(y) : `${y} · ${a} anos`;
}

export const LATERALITY = ['Destro', 'Esquerdo', 'Ambidestro'];

/* CAPITANIA

   O plantel tem uma hierarquia de quatro capitães, definida no início da
   época e independente de cada jogo: se o 1º capitão não for convocado, a
   braçadeira passa ao 2º, e assim por diante. É por isso um atributo do
   JOGADOR (`captainRank`, 1 a 4) e não da convocatória.

   Na convocatória escolhe-se depois quem leva a braçadeira NAQUELE jogo
   (capitão e subcapitão), porque nem sempre coincide com a hierarquia —
   um capitão pode entrar só na segunda parte. */
export const CAPTAIN_RANKS = [1, 2, 3, 4];

export function PlayerModal({ player, onClose, onSave }) {
  const [f, setF] = useState(player || {
    name: '', number: '', position: 'MC', secondaryPosition: '', nationality: '', birthdate: '', laterality: '', contact: '',
    weight: '', height: '', previousClub: '', entryDate: '', exitDate: '',
    statusMain: '', statusSecondary: '', photo: null,
  });
  /* A Avaliação da época edita-se agora em Desenvolvimento › Estatuto
     da época (o plantel todo numa grelha). Aqui fica só o resumo. */
  const { epoca } = React.useContext(TreinosParaEditorCtx);
  const chaveEpoca = String(epoca || '').trim() || 'sem-epoca';
  /* O ESTATUTO INICIAL preenche-se aqui (é o mesmo valor da Avaliação
     Inicial do Estatuto na época, por isso um alimenta o outro). As
     fases seguintes avaliam-se no Desenvolvimento, e o Estatuto final
     mostra o da última fase preenchida, só para ler. */
  const [inicial, setInicial] = useState(() => {
    const x = (avaliacaoBaseDoJogador(player || {}, chaveEpoca).inicial) || {};
    return { nivel: x.nivel || '', potencial: x.potencial || '' };
  });
  const [inicialMexido, setInicialMexido] = useState(false);
  const mudarInicial = (campo, valor) => { setInicial(prev => ({ ...prev, [campo]: valor })); setInicialMexido(true); };
  const avComInicial = (() => {
    const base = avaliacaoBaseDoJogador(f, chaveEpoca);
    return { ...base, inicial: { ...(base.inicial || {}), nivel: inicial.nivel, potencial: inicial.potencial } };
  })();
  const estatutoAtual = estatutoDaAvaliacao(avComInicial);
  const guardar = () => onSave(inicialMexido ? jogadorComAvaliacao(f, chaveEpoca, avComInicial) : f);

  return (
    <Modal title={player ? 'Editar jogador' : 'Novo jogador'} onClose={onClose} wide xwide fullPage>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Identificação</div>
        <div style={{ ...FIELD_GRID }}>
          {/* Nome completo e o NOME POR QUE É CONHECIDO no balneário (ex.:
              "Cadilhe", "Dani") lado a lado. O segundo é o que aparece em
              toda a app onde o nome é curto: campo, convocatória,
              relatórios, Portal… Sem ele, a app escolhe o primeiro nome (ou
              o apelido, se houver dois iguais). */}
          <div style={{ ...FIELD_FULL, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <Field label="Nome completo"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Nome do jogador" /></Field>
            <Field label="Nome no clube (como é conhecido)"><Input value={f.alcunha || ''} onChange={e => setF({ ...f, alcunha: e.target.value })} placeholder="Ex.: Dani, Cadilhe, Rodri" /></Field>
          </div>
          <Field label="Nº"><Input value={f.number} onChange={e => setF({ ...f, number: e.target.value })} placeholder="10" /></Field>
          <Field label="Nacionalidade"><Input value={f.nationality} onChange={e => setF({ ...f, nationality: e.target.value })} /></Field>
          <Field label="Data de nascimento"><Input type="date" value={f.birthdate} onChange={e => setF({ ...f, birthdate: e.target.value })} /></Field>
          <Field label="Posição">
            <Select value={f.position} onChange={e => setF({ ...f, position: e.target.value })}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Posição secundária">
            <Select value={f.secondaryPosition || ''} onChange={e => setF({ ...f, secondaryPosition: e.target.value })}>
              <option value="">—</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Lateralidade">
            <Select value={f.laterality} onChange={e => setF({ ...f, laterality: e.target.value })}>
              <option value="">—</option>
              {LATERALITY.map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Contacto"><Input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} placeholder="opcional" /></Field>
          <Field label="Peso (kg)"><Input type="number" value={f.weight} onChange={e => setF({ ...f, weight: e.target.value })} /></Field>
          <Field label="Altura (cm)"><Input type="number" value={f.height} onChange={e => setF({ ...f, height: e.target.value })} /></Field>
          <Field label="Clube anterior"><Input value={f.previousClub} onChange={e => setF({ ...f, previousClub: e.target.value })} /></Field>
          <Field label="Data de entrada"><Input type="date" value={f.entryDate} onChange={e => setF({ ...f, entryDate: e.target.value })} /></Field>
          <Field label="Data de saída"><Input type="date" value={f.exitDate} onChange={e => setF({ ...f, exitDate: e.target.value })} /></Field>
          <Field label="Nível inicial">
            <Select value={inicial.nivel || ''} onChange={e => mudarInicial('nivel', e.target.value ? Number(e.target.value) : '')}>
              <option value="">—</option>
              {STATUS_OPTIONS.map((s0, i) => <option key={s0} value={i + 1}>{i + 1} · {s0}</option>)}
            </Select>
          </Field>
          <Field label="Potencial inicial">
            <Select value={inicial.potencial || ''} onChange={e => mudarInicial('potencial', e.target.value ? Number(e.target.value) : '')}>
              <option value="">—</option>
              {STATUS_OPTIONS.map((s0, i) => <option key={s0} value={i + 1}>{i + 1} · {s0}</option>)}
            </Select>
          </Field>
          {/* Só leitura: o da última fase preenchida no Desenvolvimento. */}
          <Field label="Estatuto final">
            <div title={estatutoAtual.fase ? `Da ${estatutoAtual.fase.label} (Desenvolvimento › Estatuto na época)` : 'Avalia-se em Desenvolvimento › Estatuto na época'} style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: estatutoAtual.nivel ? T.cream : T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {estatutoAtual.nivel
                ? `${estatutoAtual.nivel} · ${STATUS_OPTIONS[estatutoAtual.nivel - 1]}${estatutoAtual.potencial ? ` · pot. ${estatutoAtual.potencial}` : ''}`
                : 'Sem avaliação'}
            </div>
          </Field>
          <Field label="Capitania">
            <Select
              value={f.captainRank || ''}
              onChange={e => setF({ ...f, captainRank: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">— não é capitão —</option>
              {CAPTAIN_RANKS.map(r => <option key={r} value={r}>{CAPTAIN_LABEL[r]}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 10 }}>
          {epoca ? `Época ${epoca}. ` : ''}O estatuto inicial preenche-se aqui; as fases seguintes avaliam-se em Desenvolvimento › Estatuto na época, e o Estatuto final mostra o da última fase preenchida{estatutoAtual.fase && estatutoAtual.fase.id !== 'inicial' ? ` (agora: ${estatutoAtual.fase.label})` : ''}.
        </div>
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <PhotoField label="Fotografia do jogador" value={f.photo || null}
          onChange={photo => setF({ ...f, photo })}
          hint="A imagem é reduzida automaticamente antes de ser guardada." />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={!f.name} onClick={guardar}><Check size={15} /> Guardar</Btn>
      </div>
    </Modal>
  );
}

