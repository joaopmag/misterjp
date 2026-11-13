// base/equipaGuardada.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { CHAVE_EQUIPA } from '../gestao/membros';

export function equipaGuardada() {
  try { return window.localStorage.getItem(CHAVE_EQUIPA) || null; } catch (e) { return null; }
}

export function guardarEquipa(id) {
  try { window.localStorage.setItem(CHAVE_EQUIPA, id); } catch (e) { /* modo privado */ }
}

/* TROCAR DE EQUIPA RECARREGA A PÁGINA, DE PROPÓSITO.

   A app tem dezenas de componentes com estado próprio — filtros, mês
   escolhido, rascunhos de modais, o simulador a meio. Recarregar em
   memória obrigaria a limpar todos, e um esquecido significa ver dados
   da equipa A dentro da equipa B: exatamente aquilo que esta separação
   existe para impedir. Trocar de equipa é raro; um segundo de espera é
   um preço barato por uma garantia. */
export function trocarDeEquipa(id) {
  guardarEquipa(id);
  window.location.reload();
}

