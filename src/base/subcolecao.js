// base/subcolecao.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

/* RETROCEDER NO BROWSER DEVOLVE À ABA DE ANTES, NÃO À LISTA DESTA ABA.

   Abrir o perfil de um jogador, a ficha de um jogo, ou qualquer vista
   de detalhe destas — em cheio, a substituir o conteúdo da aba — nunca
   mexia no endereço nem no histórico do browser: era só estado do
   React. Resultado: ao retroceder, o browser ia para a última vez que
   o ENDEREÇO mudou (a última mudança de aba, ex.: #jogos → #plantel),
   nunca para "antes de abrir este jogador" — porque, aos olhos do
   browser, essa abertura nunca tinha acontecido.

   Este hook empurra uma entrada extra no histórico assim que a vista
   de detalhe abre (mesmo endereço, só um marcador). Retroceder nessa
   entrada é o que o browser já sabe fazer sozinho — e é isso que faz
   cair de volta na aba anterior, não na lista desta aba.

   Para o botão "Voltar" DENTRO da app dar o mesmo resultado, ele deve
   chamar `back()` (devolvido por este hook) em vez de fechar a vista
   diretamente — assim há só UM caminho a fechar a vista (retroceder no
   histórico), e os dois gatilhos (botão da app, botão do telemóvel/
   browser) ficam sempre de acordo, sem risco de uma entrada de
   histórico ficar esquecida por trás. */
/* UMA "FATIA" DE UMA COLEÇÃO MAIOR, QUE ESCREVE DE VOLTA SEM PERDER O
   RESTO.

   Usado para os vídeos de um adversário (Scouting), de um jogador
   observado (Scouting) e para o Canal geral (Biblioteca) — os três são
   o MESMO `videos`, só filtrados por critérios diferentes (`pertence`).
   O Canal geral exclui tanto `adversarioId` como `scoutId`: vídeos de
   scouting (adversário ou jogador) são coisa à parte, não aparecem lá.
   Sem isto, um componente genérico
   como o `MediaLibrary` — que só conhece a fatia que lhe é dada, nunca
   a coleção toda — apagaria sem querer tudo o que tivesse ficado de
   fora do filtro sempre que escrevesse (criar, editar, apagar um
   vídeo): ele escreve sempre a lista INTEIRA de volta, e só sabe da
   fatia que recebeu. Aqui, cada escrita reconstrói a coleção completa:
   o que está fora do filtro fica exatamente como estava; só a fatia de
   dentro é substituída pela nova. */
export function useSubColecao(itemsCompletos, setItemsCompletos, pertence) {
  const items = (itemsCompletos || []).filter(pertence);
  const setItems = (novoOuFn) => {
    setItemsCompletos(prevFull => {
      const dentroAntes = (prevFull || []).filter(pertence);
      const foraAntes = (prevFull || []).filter(x => !pertence(x));
      const dentroDepois = typeof novoOuFn === 'function' ? novoOuFn(dentroAntes) : novoOuFn;
      return [...foraAntes, ...dentroDepois];
    });
  };
  return [items, setItems];
}

