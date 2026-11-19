/* Notas da equipa técnica de um jogo (relatório de jogo). Lista de
   { id, texto, seccao, autor, em, attachment }. Sem dependências: usada
   pela app e pelas regras das tarefas (que também correm no Portal). */
export function notasDoJogo(m) {
  const v = m && m.notasEquipaTecnica;
  if (Array.isArray(v)) return v.filter(x => x && (String(x.texto || '').trim() || x.attachment));
  // Formato provisório (uma caixa por pessoa): converte-se ao ler.
  if (v && typeof v === 'object') {
    return Object.entries(v)
      .filter(([, x]) => x && String(x.texto || '').trim())
      .map(([autor, x]) => ({ id: `n-${autor}`, texto: x.texto, autor: autor === 'equipa' ? '' : autor, em: x.em || '' }));
  }
  return [];
}
