// dominio/convidados.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { convidadosDe, POSITIONS } from './jogadores';
import { askConfirm, Input, Select, Btn } from '../base/ui';
import { uid } from '../base/utilidades';
import { useState } from 'react';
import { T, mono, body } from '../base/tema';
import { Plus, UserCheck, Trash2 } from 'lucide-react';
import { genPlayerCode } from './plantel';

/* Nomes prontos a escrever numa folha ou num ficheiro. */
export const nomesDosConvidados = (registo) => convidadosDe(registo).map(c => c.nome).filter(Boolean);

/* Integrar um convidado: passa a jogador do plantel.

   O jogador nasce com o nome e mais nada — posição, número e código
   preenchem-se depois na ficha, que é onde se faz esse trabalho. E o
   convidado sai da lista do dia: se ficasse, aparecia duas vezes na
   folha, uma como jogador e outra como experiência.

   A presença desse dia NÃO é transferida. Era de alguém que ainda não
   pertencia ao plantel, e o histórico começa quando a pertença começa. */
export function integrarConvidado({ convidado, players, setPlayers, aoRetirar }) {
  const nome = String((convidado && convidado.nome) || '').trim();
  if (!nome) return;
  const repetido = (players || []).some(p => String(p.name || '').trim().toLowerCase() === nome.toLowerCase());
  askConfirm({
    title: 'Integrar no plantel?',
    label: nome,
    note: repetido
      ? 'Já existe um jogador com este nome no plantel. Confirma que não é o mesmo.'
      : 'Fica no plantel a partir de hoje, sem posição nem número — preenche na ficha dele. A presença de hoje não é transferida.',
    confirmLabel: 'Criar jogador',
    destructive: false,
    onConfirm: () => {
      const usados = new Set((players || []).map(p => p.code).filter(Boolean));
      setPlayers(prev => [...(prev || []), { id: uid(), name: nome, position: (convidado && convidado.position) || '', number: '', code: genPlayerCode(usados) }]);
      if (aoRetirar) aoRetirar();
    },
  });
}

export function ConvidadosEditor({ convidados, onChange, onIntegrar, label = 'Convidados à experiência' }) {
  const [nome, setNome] = useState('');
  /* A posição é precisa para o convidado aparecer no sítio certo na
     prancheta do plantel. Fica ao lado do nome porque é aí que se sabe:
     quem escreve "George" sabe nesse momento que é extremo. Perguntar
     depois, noutro ecrã, é garantir que ninguém preenche. */
  const [pos, setPos] = useState('');
  const lista = Array.isArray(convidados) ? convidados : [];

  const juntar = () => {
    const limpo = nome.trim();
    if (!limpo) return;
    onChange([...lista, { id: uid(), nome: limpo, position: pos }]);
    setNome('');
    setPos('');
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        {label} {lista.length ? `· ${lista.length}` : ''}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: lista.length ? 10 : 0, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            // Enter junta, que é o que se espera de um campo destes: numa
            // manhã chegam três miúdos seguidos e ninguém quer o rato.
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); juntar(); } }}
            placeholder="Nome de quem veio à experiência"
          />
        </div>
        <div style={{ width: 96, flexShrink: 0 }}>
          <Select value={pos} onChange={e => setPos(e.target.value)}>
            <option value="">Posição</option>
            {POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
          </Select>
        </div>
        <Btn variant="ghost" onClick={juntar} disabled={!nome.trim()}><Plus size={15} /> Juntar</Btn>
      </div>

      {lista.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '9px 12px', background: T.bg, borderRadius: 8,
              border: `1px dashed ${T.line}`,
            }}>
              <span style={{ fontSize: 13, color: T.cream, flex: 1, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.position ? <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>{c.position} · </span> : null}
                {c.nome}
              </span>
              {/* A marca é discreta mas está sempre: é o que impede alguém
                  de olhar para a folha e contar 24 quando tem 21. */}
              <span style={{ fontSize: 11, color: T.mutedDim, flexShrink: 0 }}>experiência</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                {onIntegrar && (
                  <button
                    onClick={() => onIntegrar(c)}
                    title="Criar jogador no plantel a partir deste nome"
                    style={{ background: 'none', border: 'none', color: T.good, cursor: 'pointer', padding: 0, display: 'flex' }}
                  ><UserCheck size={15} /></button>
                )}
                <button
                  onClick={() => onChange(lista.filter(x => x.id !== c.id))}
                  title="Retirar"
                  style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}
                ><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, lineHeight: 1.6 }}>
        Não entram no plantel nem em estatística nenhuma. Saem nas folhas impressas e no ficheiro
        partilhado, para quem leva o papel para o campo os ter na lista.
      </div>
    </div>
  );
}

/* Cabeçalho reutilizável para qualquer PlayerChipList onde faça sentido
   marcar/desmarcar tudo de uma vez — presenças, convocatórias, momentos
   de avaliação. Não faz sentido em TODOS os sítios que usam
   PlayerChipList (ex: escolher os 2 jogadores de um lugar fixo no
   Simulador), por isso é opt-in em cada chamada, não embutido no chip
   list em si. */
export function SelectAllBar({ onSelectAll, onClear }) {
  return (
    <span style={{ display: 'flex', gap: 6 }}>
      <button type="button" onClick={onSelectAll} style={{
        padding: '3px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer', ...body,
        background: 'transparent', color: T.mutedDim, border: `1px solid ${T.line}`,
      }}>Selecionar todos</button>
      <button type="button" onClick={onClear} style={{
        padding: '3px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer', ...body,
        background: 'transparent', color: T.mutedDim, border: `1px solid ${T.line}`,
      }}>Limpar seleção</button>
    </span>
  );
}

