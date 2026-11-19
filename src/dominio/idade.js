/* Idade a partir da data de nascimento (ou só do ano, nos registos
   antigos). Sem dependências: usada pela app e pelo Portal. */
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
