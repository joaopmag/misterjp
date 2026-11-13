// dominio/aniversarios.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

// Verdadeiro só quando há dia e mês gravados (registos antigos, com só
// o ano, nunca fazem "anos" para este efeito — não há dia para
// comparar) e esse dia/mês coincide com hoje.
export function isBirthdayToday(birthdate, hoje) {
  if (!birthdate) return false;
  const s = String(birthdate);
  if (s.length <= 4) return false;
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const h = hoje || new Date();
  return d.getDate() === h.getDate() && d.getMonth() === h.getMonth();
}

