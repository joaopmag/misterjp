// dominio/faltas.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { semAcentos } from '../base/utilidades';

export const COR_CARTAO = { amarelo: '#E3C33B', vermelho: '#D23C3C' };

/* A chave do tipo de uma ocorrência: o id de um tipo fixo, ou `c:<nome>`
   para uma categoria criada pela equipa. As notas antigas (sem tipo) são
   classificadas pelo título — só pelo título, de propósito: o texto
   fala de tudo e enganava-se mais do que acertava. Na dúvida, Nota livre. */
export function chaveDoTipo(n) {
  if (n.tipo === 'outra') return n.tipoNome && n.tipoNome.trim() ? `c:${semAcentos(n.tipoNome)}` : 'nota';
  if (n.tipo) return n.tipo;
  const t = semAcentos(n.titulo);
  if (!t) return 'nota';
  if (/disciplin|comportament|castig/.test(t)) return 'disciplina';
  if (/\bfalt|atras/.test(t)) return 'faltas';
  if (/reuni/.test(t)) return 'reunioes';
  if (/infraestrutur|balneari|ilumina|relvad/.test(t)) return 'infra';
  if (/posto medico|organiza|transporte/.test(t)) return 'clube';
  if (/trein/.test(t)) return 'treino';
  return 'nota';
}

/* FALTA DE CADA ATLETA. Numa ocorrência de Faltas com vários atletas,
   cada um pode ter a sua: falta ou atraso, justificada ou não, e o motivo
   (um doente, outro em exame médico…). Fica em `porAtleta[pid]`; sem
   isso (registos antigos, ou um atleta só), vale o geral da ocorrência. */
export function faltaDoAtleta(n, pid) {
  const pa = n && n.porAtleta && n.porAtleta[pid];
  return {
    faltaTipo: (pa && pa.faltaTipo) || (n && n.faltaTipo) || 'falta',
    justificada: pa && typeof pa.justificada === 'boolean' ? pa.justificada : !!(n && n.justificada),
    motivo: (pa && pa.motivo) || '',
  };
}

export function MiniCartao({ cor, title }) {
  return <span title={title} style={{ display: 'inline-block', width: 9, height: 12, borderRadius: 2, background: COR_CARTAO[cor] || COR_CARTAO.amarelo, flexShrink: 0, boxShadow: '0 0 0 1px rgba(0,0,0,.25)' }} />;
}

