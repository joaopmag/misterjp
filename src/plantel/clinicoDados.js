// plantel/clinicoDados.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr } from '../base/utilidades';
import { ordenarEvolucao, nivelNoDia } from '../dominio/clinico';

/* Períodos em que a lesão esteve ativa: [[de, até], …]. Sem recaídas é
   um só, do início à alta (ou até hoje). */
export function periodosDaOcorrencia(o) {
  if (!o || !o.inicio) return [];
  const hoje = todayStr();
  if (!Array.isArray(o.evolucao)) return [[o.inicio, o.fim || hoje]];
  const periodos = [];
  let de = o.inicio;
  ordenarEvolucao(o.evolucao).forEach(e => {
    if (!e.data) return;
    if (e.alta && de) { periodos.push([de, e.data]); de = null; }
    else if (e.recaida && !de) { de = e.data; }
  });
  if (de) periodos.push([de, hoje]);
  return periodos;
}

/* Limpeza das entradas vindas das notas antigas (`migrado`):
   · A versão anterior, ao mudar de nível, copiava as notas para a
     ocorrência nova — ao juntar, o mesmo texto aparecia duas vezes.
     Fica só a primeira (a de data mais antiga).
   · Uma data sem ano lida para o futuro ficou no ano errado: recua um
     ano. */
export function limparEntradasMigradas(lista) {
  const hoje = todayStr();
  const vistos = new Set();
  return ordenarEvolucao((lista || []).map(e => {
    if (!e.migrado || !e.data || e.data <= hoje) return e;
    const anoAntes = `${Number(e.data.slice(0, 4)) - 1}${e.data.slice(4)}`;
    return { ...e, data: anoAntes };
  })).filter(e => {
    if (!e.migrado) return true;
    const t = String(e.texto || '').trim().toLowerCase();
    if (!t) return true;
    if (vistos.has(t)) return false;
    vistos.add(t);
    return true;
  });
}

/* Notas antigas → entradas da evolução. Só parte o texto onde uma data
   aparece claramente a abrir um trecho (início de linha, ou depois de
   "." / ";"), no formato dd/mm, dd-mm ou dd.mm, com ou sem ano. O texto
   antes da primeira data fica como entrada do dia de início. Se não
   houver datas, fica tudo numa entrada só — não se inventam datas. */
export function notasParaEvolucao(o) {
  const texto = String(o.notas || '').trim();
  if (!texto) return [];
  const inicio = o.inicio || '';
  const anoBase = inicio ? Number(inicio.slice(0, 4)) : new Date().getFullYear();
  const re = /(^|\n|[.;]\s+)\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b\s*(?:[-–—:)]\s*)?/g;
  const marcas = [];
  let m;
  while ((m = re.exec(texto)) !== null) {
    const dia = Number(m[2]), mes = Number(m[3]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
    let ano = m[4] ? Number(m[4].length === 2 ? `20${m[4]}` : m[4]) : anoBase;
    let iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    // Sem ano: só passa para o ano seguinte se ficar MUITO antes do início
    // (uma lesão de dezembro com notas de janeiro). Uns dias antes é só
    // uma nota que já vinha de trás, e fica no mesmo ano.
    if (!m[4] && inicio && iso < inicio && (new Date(`${inicio}T00:00:00`) - new Date(`${iso}T00:00:00`)) > 180 * 86400000) {
      ano += 1; iso = `${ano}-${iso.slice(5)}`;
    }
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime()) || d.getDate() !== dia) continue;
    marcas.push({ iso, inicioTexto: m.index + m[1].length, fimMarca: m.index + m[0].length });
  }
  const limpar = (t) => t.replace(/^[\s\-–—:;.]+/, '').replace(/[\s;]+$/, '').trim();
  if (!marcas.length) return [{ id: `${o.id}-n0`, data: inicio, texto: limpar(texto), migrado: true }];
  const entradas = [];
  const antes = limpar(texto.slice(0, marcas[0].inicioTexto));
  if (antes) entradas.push({ id: `${o.id}-n0`, data: inicio, texto: antes, migrado: true });
  marcas.forEach((mk, i) => {
    const t = limpar(texto.slice(mk.fimMarca, i + 1 < marcas.length ? marcas[i + 1].inicioTexto : texto.length));
    if (t) entradas.push({ id: `${o.id}-n${i + 1}`, data: mk.iso, texto: t, migrado: true });
  });
  return entradas;
}

// Uma ocorrência no formato novo (só na leitura; não grava nada).
export function normalizarOcorrencia(o) {
  if (!o) return o;
  const base = {
    ...o,
    nivelInicial: o.nivelInicial || o.nivel || '',
    previsaoInicial: o.previsaoInicial !== undefined ? o.previsaoInicial : (o.previsaoRetorno || ''),
    restricoesIniciais: o.restricoesIniciais !== undefined ? o.restricoesIniciais : (o.restricoes || ''),
  };
  if (Array.isArray(o.evolucao)) return { ...base, evolucao: limparEntradasMigradas(o.evolucao) };
  const evolucao = notasParaEvolucao(o);
  if (o.fim) evolucao.push({ id: `${o.id}-alta`, data: o.fim, alta: true, texto: '', migrado: true });
  return { ...base, evolucao: limparEntradasMigradas(evolucao) };
}

// Estado atual a partir da evolução. Chamar SEMPRE antes de gravar.
export function recalcularOcorrencia(o) {
  const n = normalizarOcorrencia(o);
  const evolucao = ordenarEvolucao(n.evolucao);
  let nivel = n.nivelInicial;
  let previsaoRetorno = n.previsaoInicial || '';
  let restricoes = n.restricoesIniciais || '';
  let fim = '';
  evolucao.forEach(e => {
    if (e.nivel) nivel = e.nivel;
    if (e.previsaoRetorno !== undefined) previsaoRetorno = e.previsaoRetorno;
    if (e.restricoes !== undefined) restricoes = e.restricoes;
    if (e.alta) fim = e.data;
    if (e.recaida) fim = ''; // uma recaída reabre a lesão
  });
  return { ...n, evolucao, nivel, previsaoRetorno, restricoes, fim };
}

/* RECAÍDAS — o jogador teve alta e, pouco depois, volta a parar pelo
   mesmo problema (recaída ou avaliação precipitada). Deve ser a MESMA
   lesão, reaberta, e não uma nova.

   `anteriorParaRecaida` responde à pergunta ao criar uma ocorrência:
   há uma lesão do mesmo jogador, na mesma zona, com alta nos últimos
   30 dias antes deste início? `possiveisRecaidas` faz a mesma pergunta
   ao que já está registado, para juntar os casos antigos. */
export const DIAS_RECAIDA = 30;

export function anteriorParaRecaida(clinico, { playerId, zona, inicio, excluirId }) {
  if (!playerId || !zona || zona === 'Outra' || !inicio) return null;
  const limite = proximoDiaIso(inicio, -DIAS_RECAIDA);
  return (clinico || [])
    .filter(a => a.id !== excluirId && a.playerId === playerId && a.zona === zona && a.fim && a.fim < inicio && a.fim >= limite)
    .sort((x, y) => (y.fim || '').localeCompare(x.fim || ''))[0] || null;
}

export function possiveisRecaidas(clinico) {
  const pares = [];
  const usados = new Set();
  [...(clinico || [])].sort((a, b) => (a.inicio || '').localeCompare(b.inicio || '')).forEach(b => {
    const a = anteriorParaRecaida(clinico, { playerId: b.playerId, zona: b.zona, inicio: b.inicio, excluirId: b.id });
    if (!a || usados.has(a.id) || usados.has(b.id)) return;
    if ((b.naoRecaidaDe || []).includes(a.id)) return;
    usados.add(a.id); usados.add(b.id);
    pares.push([a, b]);
  });
  return pares;
}

// Junta B na lesão A como recaída: A fica (com a alta que teve), B passa
// a ser a reabertura, com o nível, a previsão e as restrições com que
// foi registada, seguida da evolução dela.
export function juntarComoRecaida(anterior, nova) {
  const a = normalizarOcorrencia(anterior);
  const b = normalizarOcorrencia(nova);
  const reabertura = {
    id: `${nova.id}-recaida`, data: nova.inicio, recaida: true, texto: '',
    nivel: b.nivelInicial, previsaoRetorno: b.previsaoInicial || '', restricoes: b.restricoesIniciais || '',
    criadoEm: new Date().toISOString(),
  };
  const notas = [anterior.notas, nova.notas].map(t => String(t || '').trim()).filter(Boolean).join('\n\n');
  return recalcularOcorrencia({ ...a, evolucao: [...a.evolucao, reabertura, ...b.evolucao], notas });
}

/* LESÕES PARTIDAS EM DUAS pela versão anterior: o mesmo jogador, o mesmo
   tipo e zona, uma "Indisponível" que fecha no dia em que abre outra de
   nível diferente. Devolve cadeias [primeira, segunda, …]. */
export function lesoesPartidas(clinico) {
  const porJogador = {};
  (clinico || []).forEach(o => { (porJogador[o.playerId] = porJogador[o.playerId] || []).push(o); });
  const cadeias = [];
  Object.values(porJogador).forEach(lista => {
    const ord = [...lista].sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    const usados = new Set();
    ord.forEach(o => {
      if (usados.has(o.id)) return;
      const cadeia = [o];
      let atual = o;
      for (;;) {
        const seguinte = ord.find(x => !usados.has(x.id) && x.id !== atual.id && !cadeia.includes(x)
          && atual.fim && x.inicio === atual.fim && atual.nivel === 'indisponivel' && x.nivel !== 'indisponivel'
          && (x.tipo || '') === (atual.tipo || '') && (x.zona || '') === (atual.zona || '')
          && !Array.isArray(x.evolucao));
        if (!seguinte) break;
        cadeia.push(seguinte);
        atual = seguinte;
      }
      if (cadeia.length > 1) { cadeia.forEach(c => usados.add(c.id)); cadeias.push(cadeia); }
    });
  });
  return cadeias;
}

// Junta uma cadeia numa só lesão: a primeira fica, as outras passam a
// ser mudanças de nível na evolução dela.
export function juntarLesoes(cadeia) {
  const [primeira, ...resto] = cadeia;
  const base = normalizarOcorrencia(primeira);
  let evolucao = base.evolucao.filter(e => !e.alta);
  resto.forEach(o => {
    const n = normalizarOcorrencia(o);
    evolucao.push({
      id: `${o.id}-nivel`, data: o.inicio, texto: '', nivel: o.nivel, migrado: true,
      ...(o.previsaoRetorno ? { previsaoRetorno: o.previsaoRetorno } : {}),
      ...(o.restricoes ? { restricoes: o.restricoes } : {}),
    });
    evolucao = evolucao.concat(n.evolucao.filter(e => !e.alta));
  });
  const ultima = cadeia[cadeia.length - 1];
  if (ultima.fim) evolucao.push({ id: `${ultima.id}-alta`, data: ultima.fim, alta: true, texto: '', migrado: true });
  const notasOriginais = cadeia.map(o => String(o.notas || '').trim()).filter(Boolean).join('\n\n');
  return recalcularOcorrencia({ ...base, evolucao, notas: notasOriginais });
}

export function diaAutoLesionado(jogadorId, data, clinico) {
  if (!jogadorId || !data) return false;
  return (clinico || []).some(o => (
    o.playerId === jogadorId && nivelNoDia(o, data) === 'indisponivel'
    && o.inicio && o.inicio <= data
    && dentroDaParagem(o, data)
  ));
}

/* Até onde vai o L automático de uma ocorrência:
   · Com alta (`fim`), até ao dia da alta, inclusive.
   · Sem alta, nos dias que JÁ PASSARAM (até hoje) o jogador continua
     indisponível, mesmo que a previsão de regresso tenha ficado para
     trás — era só uma estimativa, e um treino de ontem sem alta dada
     é um treino em que ele não esteve (o boletim avisa da previsão
     atrasada).
   · Sem alta, nos dias FUTUROS só até à véspera da previsão de
     regresso: no dia previsto ele já conta para o plantel. Sem
     previsão, o futuro fica por preencher — não se marca L em jogos de
     novembro por causa de uma paragem sem fim à vista. Antes, sem alta,
     o L ia até ao fim do calendário. */
export function dentroDaParagem(o, data) {
  if (o.fim) return data <= o.fim;
  if (data <= todayStr()) return true;
  return !!o.previsaoRetorno && data < o.previsaoRetorno;
}

// Soma dias a uma data AAAA-MM-DD (negativo recua).
export function proximoDiaIso(d, n = 1) {
  const dt = new Date(`${d}T00:00:00`);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

