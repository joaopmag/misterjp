// competicao/historicoDoJogo.js
//
// O histórico de um jogo (Relato, tabela `activity_log`): serve para dizer,
// num lugar do onze que está vazio, quem lá estava e quando saiu.

import { supabase } from '../supabaseClient';
import { ensureSession } from '../base/sincronizacao';

const lista = (v) => (Array.isArray(v) ? v : []);

// Histórico de UM jogo, do mais antigo para o mais recente.
export async function lerHistoricoDoJogo(equipa, jogoId) {
  await ensureSession();
  const { data, error } = await supabase.from('activity_log')
    .select('registo_id, em, campos, ator_email')
    .eq('team_id', String(equipa)).eq('tabela', 'matches').eq('registo_id', String(jogoId))
    .order('em', { ascending: true }).order('id', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return data || [];
}

/* QUEM ESTAVA NESTE LUGAR. Para um lugar do campo que está vazio, o último
   jogador que lá esteve, quando saiu e quem fez a alteração. null se o
   histórico não disser nada. */
export function quemEstavaNoLugar(linhas, i) {
  let ultimo = null; let saida = null;
  for (const l of linhas) {
    const c = (Array.isArray(l.campos) ? l.campos : []).find(x => x && x.k === 'alinhamento' && !x.grande);
    if (!c) continue;
    const de = lista(c.de); const para = lista(c.para);
    if (para[i]) { ultimo = para[i]; saida = null; } else if (de[i]) { ultimo = de[i]; saida = { em: l.em, por: l.ator_email || '' }; }
  }
  return ultimo && saida ? { id: ultimo, ...saida } : null;
}

/* QUEM ESTEVE NO ONZE E JÁ NÃO EXISTE NA APP. Ids que passaram pelo
   alinhamento (em qualquer lugar) e já não estão lá nem existem em
   nenhum jogador (nem nos que saíram do clube): foram apagados. Devolve
   [{ id, em, por }] com a gravação em que saíram do onze. */
export function apagadosDoOnze(linhas, alinhamentoAtual, existe) {
  const agora = new Set(lista(alinhamentoAtual).filter(Boolean));
  const saida = new Map();
  for (const l of linhas) {
    const c = (Array.isArray(l.campos) ? l.campos : []).find(x => x && x.k === 'alinhamento' && !x.grande);
    if (!c) continue;
    const de = lista(c.de).filter(Boolean); const para = new Set(lista(c.para).filter(Boolean));
    de.forEach(id => { if (!para.has(id)) saida.set(id, { em: l.em, por: l.ator_email || '' }); });
    para.forEach(id => saida.delete(id));
  }
  return [...saida].filter(([id]) => !agora.has(id) && !existe(id)).map(([id, s]) => ({ id, ...s }));
}

// Nome de quem foi apagado (o Relato guarda o nome na linha "apagou").
export async function nomesDosApagados(equipa, ids) {
  if (!ids.length) return {};
  await ensureSession();
  const { data, error } = await supabase.from('activity_log')
    .select('registo_id, info')
    .eq('team_id', String(equipa)).eq('tabela', 'players').eq('acao', 'apagou')
    .in('registo_id', ids.map(String));
  if (error) return {};
  const nomes = {};
  (data || []).forEach(r => { const i = r.info || {}; const n = i.name || i.nome; if (n) nomes[r.registo_id] = n; });
  return nomes;
}
