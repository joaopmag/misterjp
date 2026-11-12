// dominio/treino.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

/* DOIS MOMENTOS num exercício ou ideia: `phase` é o dominante (o de
   sempre — conta para agrupar, contar e para o tamanho dos ícones do
   esquema) e `phase2` o segundo, opcional. Mostra-se "A + B" e a pesquisa
   por momento encontra-o nos dois. */
export const momentosDe = (x) => [x && x.phase, x && x.phase2].filter((p, i, a) => p && a.indexOf(p) === i);

export const momentoTexto = (x) => momentosDe(x).join(' + ');

export const temMomento = (x, fase) => momentosDe(x).includes(fase);

