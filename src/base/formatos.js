// base/formatos.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

/* Nomes de competição como "Campeonato distrital U19 - 1ª Divisão" ficam
   partidos a meio no telemóvel. Separa-se pelo último hífen: a parte da
   esquerda fica no título e a da direita passa a subtítulo. */
export function splitCompetitionName(name) {
  const txt = String(name || '').trim();
  const m = txt.match(/^(.*\S)\s*[-–—]\s*(\S.*)$/);
  return m ? { title: m[1], subtitle: m[2] } : { title: txt, subtitle: '' };
}

// Data de hoje por extenso ("quarta-feira, 3 de setembro"), sempre a
// partir da hora LOCAL de quem está a ver o ecrã — `new Date()` sem mais
// nada usa o fuso horário do próprio aparelho, nunca o do servidor, por
// isso não há risco de mostrar o dia errado a quem está noutro fuso.
export function dataDeHojeExtenso() {
  const s = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

