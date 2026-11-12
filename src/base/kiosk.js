// base/kiosk.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useRef, useEffect } from 'react';

/* Passos internos de uma área do Portal do Atleta que o gesto de
   retroceder deve fechar primeiro (ver CheckinKiosk). */
export let KIOSK_VOLTAR_INTERNO = [];

export function useKioskVoltar(ativo, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ativo) return undefined;
    const h = () => ref.current();
    KIOSK_VOLTAR_INTERNO = [...KIOSK_VOLTAR_INTERNO, h];
    return () => { KIOSK_VOLTAR_INTERNO = KIOSK_VOLTAR_INTERNO.filter(x => x !== h); };
  }, [ativo]);
}

