// plantel/avaliacao.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

export const STATUS_OPTIONS = ['Dispensável', 'Reserva', 'Alternativa aos Titulares', 'Potencial Titular', 'Jogador de Elite'];

/* AVALIAÇÃO DA ÉPOCA (ficha do jogador): três fases, cada uma com o
   Nível atual e o Potencial (a escala de 1 a 5 do estatuto) e as
   Observações. Fica guardada por época em `avaliacoesEpoca[época]`, para
   a época seguinte começar em branco sem perder o histórico.
   O "Estatuto principal" (statusMain) e o "Estatuto secundário"
   (statusSecondary), usados no resto da app (selo da ficha, contagens do
   Plantel, sugestões do onze), passam a ser os da ÚLTIMA fase preenchida:
   Nível atual → principal, Potencial → secundário. */
export const FASES_AVALIACAO = [
  { id: 'inicial', label: 'Avaliação Inicial' },
  { id: 'intermedia', label: 'Avaliação Intermédia' },
  { id: 'final', label: 'Avaliação Final' },
];

export function avaliacaoDaEpoca(p, epoca) {
  const todas = (p && p.avaliacoesEpoca) || {};
  return (epoca && todas[epoca]) || null;
}

// A última fase com cada valor preenchido (para o estatuto atual).
export function estatutoDaAvaliacao(av) {
  let nivel = null; let potencial = null; let fase = null;
  FASES_AVALIACAO.forEach(fa => {
    const x = av && av[fa.id];
    if (x && Number(x.nivel) >= 1) { nivel = Number(x.nivel); fase = fa; }
    if (x && Number(x.potencial) >= 1) potencial = Number(x.potencial);
  });
  return { nivel, potencial, fase };
}

/* ESTATUTO DA ÉPOCA (Desenvolvimento): o plantel inteiro numa grelha,
   para avaliar todos de seguida em cada fase (Inicial, Intermédia,
   Final) e comparar enquanto se escolhe. Antes estava dentro da ficha de
   cada jogador, o que obrigava a abrir e fechar 25 janelas por fase.

   Os dados continuam no mesmo sítio (`avaliacoesEpoca[época]` de cada
   jogador) e o estatuto que o resto da app usa (statusMain /
   statusSecondary) continua a ser o da última fase preenchida, por isso
   as contagens do Plantel, o selo da ficha e o Word não mudam.

   Só a fase escolhida em cima se edita; as outras aparecem como números,
   para não se mexer numa fase já fechada por engano. A nota do
   Desenvolvimento (equipa técnica, último momento) aparece em pequeno só
   como referência: não preenche nada sozinha. */
export function avaliacaoBaseDoJogador(p, chaveEpoca) {
  const existente = avaliacaoDaEpoca(p, chaveEpoca);
  if (existente) return existente;
  // Primeira vez nesta época: o estatuto que já tinha passa a Inicial.
  const nivel = STATUS_OPTIONS.indexOf(p && p.statusMain) + 1;
  const potencial = STATUS_OPTIONS.indexOf(p && p.statusSecondary) + 1;
  return (nivel || potencial) ? { inicial: { nivel: nivel || '', potencial: potencial || '', obs: '' } } : {};
}

export function jogadorComAvaliacao(p, chaveEpoca, av) {
  const { nivel, potencial } = estatutoDaAvaliacao(av);
  return {
    ...p,
    avaliacoesEpoca: { ...(p.avaliacoesEpoca || {}), [chaveEpoca]: av },
    statusMain: nivel ? STATUS_OPTIONS[nivel - 1] : '',
    statusSecondary: potencial ? STATUS_OPTIONS[potencial - 1] : '',
  };
}

