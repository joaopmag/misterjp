// dominio/clinico.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { fmtDate } from '../base/utilidades';

/* ================================================================
   BOLETIM CLÍNICO — DISPONIBILIDADE
   ================================================================

   Três níveis, e só enquanto a ocorrência está aberta. "Disponível" não é
   um nível: é a ausência de ocorrência. "Alta" também não é: é a data de
   fecho (`fim`). Guardar um campo "estado atual" na ocorrência era a
   tentação óbvia e é a armadilha — passava a data de retorno e o registo
   continuava a dizer "indisponível" até alguém o ir editar à mão. */
export const NIVEIS_CLINICOS = [
  { id: 'indisponivel', label: 'Indisponível', curto: 'Indisponível', cor: '#C25A5A', avisaTreino: true, avisaJogo: true },
  { id: 'condicionado', label: 'Treino condicionado', curto: 'Condicionado', cor: '#D9A72E', avisaTreino: false, avisaJogo: true },
  { id: 'vigilancia', label: 'Apto com vigilância', curto: 'Vigilância', cor: '#4CA86B', avisaTreino: false, avisaJogo: false },
];

export const nivelClinico = (id) => NIVEIS_CLINICOS.find(n => n.id === id) || NIVEIS_CLINICOS[0];

/* ================================================================
   EVOLUÇÃO DE UMA OCORRÊNCIA
   ================================================================

   Uma lesão é UM registo, do primeiro dia até à alta. O que muda pelo
   caminho (como o jogador está, o nível, a previsão de retorno, as
   restrições, a própria alta) é uma lista de atualizações datadas em
   `evolucao`:

     { id, data, texto, nivel?, previsaoRetorno?, restricoes?, alta?, criadoEm }

   Um campo ausente numa atualização quer dizer "não mudou". Os valores
   de partida ficam em `nivelInicial`, `previsaoInicial` e
   `restricoesIniciais`; `nivel`, `previsaoRetorno`, `restricoes` e `fim`
   são o estado ATUAL, recalculado a partir da evolução
   (`recalcularOcorrencia`) — ficam gravados para que o resto da app os
   possa ler sem saber nada disto.

   Antes, mudar de "Indisponível" para outro nível fechava a ocorrência e
   abria outra, para os L passados continuarem certos. Com a evolução, o
   nível de cada dia lê-se daqui (`nivelNoDia`) e a lesão fica inteira.

   Registos antigos (sem `evolucao`) continuam válidos: são normalizados
   só na leitura (`normalizarOcorrencia`) e só passam a gravar-se no
   formato novo quando alguém lhes mexe. As `notas` originais nunca se
   apagam. */

// Nível num dia concreto. Barata de propósito: é chamada para cada
// jogador em cada dia das presenças.
/* Com RECAÍDAS, uma lesão pode ter intervalos: alta a 21/09, recaída a
   24/09. Nos dias entre uma alta e uma recaída o jogador esteve apto, e
   aqui devolve-se '' (fora do boletim). A alta conta a partir do dia
   SEGUINTE (no próprio dia da alta mantém-se o nível, como sempre foi);
   a recaída conta a partir do próprio dia. */
export function nivelNoDia(o, dia) {
  if (!o) return '';
  if (!Array.isArray(o.evolucao) || !o.evolucao.length) return o.nivel;
  let nivel = o.nivelInicial || o.nivel;
  ordenarEvolucao(o.evolucao).forEach(e => {
    if (!e.data) return;
    if (e.alta) { if (e.data < dia) nivel = ''; return; }
    if (e.data > dia) return;
    if (e.recaida) nivel = e.nivel || o.nivelInicial || o.nivel;
    else if (e.nivel) nivel = e.nivel;
  });
  return nivel;
}

/* Ordem cronológica. No MESMO dia: primeiro as mudanças de nível sem
   texto (o que mudou), depois as notas, e a alta sempre por último —
   uma alta não pode aparecer antes de uma nota do próprio dia. */
export function ordenarEvolucao(lista) {
  const peso = (e) => (e.alta ? 2 : ((e.recaida || e.nivel) && !String(e.texto || '').trim() ? 0 : 1));
  return [...(lista || [])].sort((a, b) => (a.data || '').localeCompare(b.data || '')
    || peso(a) - peso(b)
    || (a.criadoEm || '').localeCompare(b.criadoEm || ''));
}

export function estadoClinicoEm(jogadorId, data, clinico) {
  if (!jogadorId || !data) return null;
  const abertas = (clinico || []).filter(o =>
    o.playerId === jogadorId
    && o.inicio && o.inicio <= data
    && (!o.fim || o.fim >= data));
  if (!abertas.length) return null;
  const o = abertas.sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''))[0];
  const nivel = nivelNoDia(o, data);
  if (!nivel) return null; // entre uma alta e uma recaída: estava apto
  return { ...nivelClinico(nivel), ocorrencia: o };
}

/* Texto curto para o aviso, sem obrigar quem o mostra a montar a frase.
   Ex.: "Indisponível desde 21/08 · Lesão muscular (coxa)". */
export function resumoClinico(estado, { comNivel = true } = {}) {
  if (!estado) return '';
  const o = estado.ocorrencia;
  const desde = o.inicio ? `desde ${fmtDate(o.inicio).replace(/^\w+, /, '')}` : '';
  const que = [o.tipo, o.zona && `(${o.zona})`].filter(Boolean).join(' ');
  // Sem o nível quando quem mostra já o escreveu no título — repetido, só
  // fazia a linha partir a meio.
  const cabeca = comNivel ? `${estado.label}${desde ? ` ${desde}` : ''}` : desde;
  return [cabeca, que].filter(Boolean).join(' · ');
}

