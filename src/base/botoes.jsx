// base/botoes.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { body, T } from './tema';

export function ChipBtn({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 14px', borderRadius: 8, cursor: 'pointer', ...body, fontSize: 13,
      border: `1px solid ${active ? T.gold : T.line}`, background: active ? `${T.gold}22` : T.surface,
      color: active ? T.warn : T.cream,
    }}>{children}</button>
  );
}

