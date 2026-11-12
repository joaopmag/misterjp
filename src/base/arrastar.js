// base/arrastar.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useRef, useState } from 'react';
import { T } from './tema';

/* ARRASTAR UM JOGADOR PARA CIMA DE OUTRO (OU DE UM LUGAR VAZIO) TROCA-OS
   DE SÍTIO — em qualquer campo da app que mostre jogadores em lugares
   fixos de uma formação (Simulador, Ficha de Jogo, Estrutura habitual
   do Adversário).

   Um só hook para os três, porque a mecânica é sempre a mesma: só
   muda o que "trocar dois lugares" significa para quem o usa (mexer
   num `overrides`, ou trocar duas posições de um array `alinhamento`).

   O TOQUE CONTINUA A FUNCIONAR COMO SEMPRE. Só se conta como arrasto
   se o dedo/rato se mexer mais do que `limiar` antes de soltar — um
   toque parado dispara o `onClick` de sempre, sem qualquer mudança.
   Quando é mesmo um arrasto, bloqueia-se o `click` sintético que o
   browser dispara a seguir (senão o toque de soltar reabria o
   seletor de jogador logo depois da troca).

   Cada lugar/jogador precisa de um `data-slot="<id>"` no elemento. O
   alvo não é "o que está exatamente por baixo do dedo" — isso falhava
   sempre que se largava um pouco ao lado do círculo pequeno (ex.: um
   avançado arrastado até à defesa, do outro lado do campo, raramente
   cai em cima do alvo ao milímetro). É antes O LUGAR MAIS PRÓXIMO de
   onde se soltou, medido pelo centro de cada `[data-slot]` dentro do
   campo — sempre acerta nalgum, mesmo que o dedo largue um pouco a
   mais ou a menos. */
export function useArrastarParaTrocar(aoTrocar, limiar = 6) {
  const estado = useRef(null);
  const containerRef = useRef(null);
  const [arrastando, setArrastando] = useState(null); // { origem, dx, dy }
  const [alvo, setAlvo] = useState(null); // id do lugar mais próximo AGORA, enquanto se arrasta
  const bloquearClique = useRef(false);

  const encontrarAlvo = (x, y) => {
    const raiz = containerRef.current;
    if (!raiz) return null;
    const nos = raiz.querySelectorAll('[data-slot]');
    let melhorId = null, melhorDist = Infinity;
    nos.forEach(no => {
      const r = no.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < melhorDist) { melhorDist = d; melhorId = no.getAttribute('data-slot'); }
    });
    return melhorId;
  };
  const onPointerDown = (origem) => (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    estado.current = { origem, startX: e.clientX, startY: e.clientY, moveu: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
  };
  const onPointerMove = (e) => {
    const st = estado.current;
    if (!st) return;
    const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
    if (!st.moveu && Math.hypot(dx, dy) > limiar) st.moveu = true;
    if (st.moveu) {
      setArrastando({ origem: st.origem, dx, dy });
      // A ZONA CENTRAL DO CAMPO TEM VÁRIOS JOGADORES PERTO UNS DOS
      // OUTROS — "o lugar mais próximo" ali pode não ser o que se está a
      // ver a olho, e sem nenhuma pista SÓ SE DESCOBRE ao soltar (às
      // vezes trocando com o vizinho errado, dando a impressão de que
      // "não fez nada"). Perto das linhas há sempre só um jogador por
      // perto, e por isso nunca falha aí — é mesmo uma questão de
      // pontaria no meio, que isto resolve mostrando o alvo em tempo
      // real, antes de soltar.
      setAlvo(encontrarAlvo(e.clientX, e.clientY));
    }
  };
  const finalizar = (e) => {
    const st = estado.current;
    estado.current = null;
    if (!st) return;
    setArrastando(null);
    setAlvo(null);
    if (!st.moveu) return; // foi só um toque — deixa o onClick tratar disto
    bloquearClique.current = true;
    const destino = encontrarAlvo(e.clientX, e.clientY);
    if (destino && destino !== st.origem) aoTrocar(st.origem, destino);
  };
  const onClickCapture = (e) => {
    if (bloquearClique.current) { bloquearClique.current = false; e.stopPropagation(); }
  };
  const estaArrastando = (id) => !!arrastando && arrastando.origem === id;
  const estiloArrasto = (id) => (estaArrastando(id)
    ? { transform: `translate(${arrastando.dx}px, ${arrastando.dy}px) scale(1.08)`, zIndex: 20, pointerEvents: 'none', cursor: 'grabbing' }
    : { cursor: 'grab' });
  // O ALVO ganha um contorno vivo — só enquanto se arrasta, e nunca no
  // próprio jogador que se está a arrastar (esse já tem o seu próprio
  // realce, o `estiloArrasto` acima).
  const estaAlvo = (id) => !!arrastando && alvo === id && id !== arrastando.origem;
  const estiloAlvo = (id) => (estaAlvo(id)
    ? { outline: `2px solid ${T.gold}`, outlineOffset: 2, borderRadius: 8 }
    : {});

  return { onPointerDown, onPointerMove, onPointerUp: finalizar, onPointerCancel: finalizar, onClickCapture, estiloArrasto, estiloAlvo, containerRef };
}

