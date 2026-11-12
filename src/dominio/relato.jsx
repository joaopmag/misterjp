// dominio/relato.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, mono } from '../base/tema';
import { ArrowRight } from 'lucide-react';

export const RELATO_CAMPOS = {
  attendance: 'Presentes', faltas: 'Faltas', lesionados: 'Lesionados', escalao: 'Outro escalão',
  convocados: 'Convocados', ratings: 'Notas', attendanceClosed: 'Dia guardado',
  name: 'Nome', nome: 'Nome', position: 'Posição', number: 'Número', photo: 'Fotografia', foto: 'Fotografia',
  status: 'Estatuto', estatuto: 'Estatuto', birthDate: 'Data de nascimento', nascimento: 'Data de nascimento',
  date: 'Data', hora: 'Hora', focus: 'Tema', phase: 'Fase', intensity: 'Intensidade', opponent: 'Adversário',
  exerciseIds: 'Exercícios', competition: 'Competição', result: 'Resultado', golosPro: 'Golos marcados',
  golosContra: 'Golos sofridos', minutos: 'Minutos', titulo: 'Título', title: 'Título', estado: 'Estado',
  responsavel: 'Responsável', notas: 'Notas', nota: 'Nota', texto: 'Texto', previsaoRetorno: 'Previsão de retorno',
  nivel: 'Nível', fim: 'Alta', inicio: 'Início', evolucao: 'Evolução', tipo: 'Tipo', zona: 'Zona',
  restricoes: 'Restrições', sono: 'Sono', fadiga: 'Fadiga', dor: 'Dor muscular', stress: 'Stress',
  humor: 'Humor', pse: 'PSE', duracao: 'Duração', diagram: 'Diagrama', diagrama: 'Diagrama',
  description: 'Descrição', descricao: 'Descrição', teams: 'Equipas', rounds: 'Jornadas',
  convocatoriaVisivelAtletas: 'Visível no Portal', visivel: 'Visível', recorrencia: 'Recorrência',
};

export const relatoCampoLabel = (k) => RELATO_CAMPOS[k]
  || String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

export const RELATO_ACOES = {
  criou: { verbo: 'criou', cor: '#4CA86B' },
  editou: { verbo: 'editou', cor: '#D9A72E' },
  apagou: { verbo: 'apagou', cor: '#C25A5A' },
};

export const isoDia = (d) => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 10) : '';

export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/* Um campo alterado, legível. */
export function RelatoCampo({ c, nomeJogador }) {
  const label = relatoCampoLabel(c.k);
  const linha = (conteudo) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12.5, lineHeight: 1.5 }}>
      <span style={{ color: T.muted, minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: T.cream, minWidth: 0, flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>{conteudo}</span>
    </div>
  );
  const chip = (txt, cor, sinal) => (
    <span key={`${sinal}${txt}`} style={{
      padding: '1px 8px', borderRadius: 10, fontSize: 11.5, whiteSpace: 'nowrap',
      background: `${cor}26`, border: `1px solid ${cor}66`, color: cor,
    }}>{sinal} {txt}</span>
  );
  const fmt = (v) => {
    if (v === undefined || v === null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'sim' : 'não';
    if (typeof v === 'string' && isoDia(v) && v.length <= 25) return ddmm(isoDia(v));
    if (typeof v === 'string') return v.length > 80 ? `${v.slice(0, 80)}…` : v;
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'item' : 'itens'}`;
    return '…';
  };
  const antes = (v) => <span style={{ color: T.mutedDim, textDecoration: 'line-through' }}>{fmt(v)}</span>;
  const seta = <ArrowRight size={11} color={T.mutedDim} />;

  // Só o nome do campo (dados de saúde: o servidor não guarda valores).
  if (!c.grande && c.de === undefined && c.para === undefined) return linha(<span style={{ color: T.muted }}>alterado</span>);
  if (c.grande) return linha(<span style={{ color: T.muted }}>alterado <span style={{ color: T.mutedDim }}>(conteúdo extenso)</span></span>);

  const a = c.de; const b = c.para;
  const ehLista = (v) => v === undefined || Array.isArray(v);
  if (ehLista(a) && ehLista(b) && (Array.isArray(a) || Array.isArray(b))) {
    const A = (a || []); const B = (b || []);
    const simples = [...A, ...B].every(x => typeof x === 'string' || typeof x === 'number');
    if (simples) {
      const sa = new Set(A.map(String)); const sb = new Set(B.map(String));
      const mais = B.map(String).filter(x => !sa.has(x));
      const menos = A.map(String).filter(x => !sb.has(x));
      const nome = (x) => nomeJogador(x) || (x.length > 24 ? `${x.slice(0, 24)}…` : x);
      if (!mais.length && !menos.length) return linha(<span style={{ color: T.muted }}>reordenado</span>);
      return linha(<>
        {mais.slice(0, 14).map(x => chip(nome(x), T.good, '+'))}
        {menos.slice(0, 14).map(x => chip(nome(x), T.bad, '−'))}
        {(mais.length + menos.length) > 28 && <span style={{ color: T.mutedDim, fontSize: 11.5 }}>e mais {(mais.length + menos.length) - 28}</span>}
      </>);
    }
    return linha(<>{antes(A)}{seta}<span>{fmt(B)}</span></>);
  }

  const ehObj = (v) => v === undefined || (v && typeof v === 'object' && !Array.isArray(v));
  if (ehObj(a) && ehObj(b) && (a || b)) {
    const A = a || {}; const B = b || {};
    const ks = [...new Set([...Object.keys(A), ...Object.keys(B)])]
      .filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
    const primitivos = ks.every(k => [A[k], B[k]].every(v => v === undefined || v === null || typeof v !== 'object'));
    if (!ks.length || !primitivos) return linha(<span style={{ color: T.muted }}>alterado{ks.length ? ` (${ks.length} ${ks.length === 1 ? 'parte' : 'partes'})` : ''}</span>);
    return linha(<>
      {ks.slice(0, 10).map(k => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 8px', borderRadius: 10, background: T.bg, border: `1px solid ${T.line}`, fontSize: 11.5 }}>
          <span style={{ color: T.muted }}>{nomeJogador(k) || relatoCampoLabel(k)}</span>
          {A[k] !== undefined && antes(A[k])}{A[k] !== undefined && seta}
          <span style={{ ...mono }}>{B[k] === undefined ? 'removido' : fmt(B[k])}</span>
        </span>
      ))}
      {ks.length > 10 && <span style={{ color: T.mutedDim, fontSize: 11.5 }}>e mais {ks.length - 10}</span>}
    </>);
  }

  if (!c.temDe) return linha(<><span style={{ color: T.mutedDim }}>definido</span>{seta}<span>{fmt(b)}</span></>);
  if (b === undefined) return linha(<><span>{antes(a)}</span><span style={{ color: T.mutedDim }}>removido</span></>);
  return linha(<>{antes(a)}{seta}<span>{fmt(b)}</span></>);
}

