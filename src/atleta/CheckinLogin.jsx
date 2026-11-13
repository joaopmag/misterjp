// atleta/CheckinLogin.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState } from 'react';
import { CHECKIN_CODE_LEN } from '../dominio/plantel';
import { display, T } from '../base/tema';
import { BigButton } from './questionarios';
import { CHECKIN_CODE_MIN, greetingNow } from './janelas';

/* `onSubmit` devolve uma promessa: true se o código existir, false se
   não. A lista de jogadores já não passa por aqui — quem confirma o
   código é a base de dados. */
export function CheckinLogin({ onSubmit, equipa }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [aVerificar, setAVerificar] = useState(false);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  /* Aceita de 4 a 6 dígitos. Os códigos passaram a ter seis, mas os de
     quatro continuam válidos até serem regenerados — e um plantel não se
     atualiza todo no mesmo dia. Exigir seis deixaria metade da equipa de
     fora sem explicação. */
  const maxLen = CHECKIN_CODE_LEN;
  const minLen = CHECKIN_CODE_MIN;

  const press = (d) => {
    setError(false);
    if (d === '⌫') { setValue(v => v.slice(0, -1)); return; }
    if (d === '') return;
    setValue(v => (v.length < maxLen ? v + d : v));
  };

  const submit = async () => {
    if (aVerificar || value.length < minLen) return;
    setAVerificar(true);
    let ok = false;
    try { ok = await onSubmit(value); } catch (e) { ok = false; }
    setAVerificar(false);
    if (!ok) { setError(true); setValue(''); }
  };

  return (
    <div style={{ maxWidth: 360, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
      {/* SEM EMBLEMA NEM GENTÍLICO FIXOS.

          Este ecrã era do SC Salgueiros: emblema no ficheiro e um
          "Salgueirista!" escrito no código. Com equipas de outros clubes,
          as duas coisas passam a estar erradas — e erradas da pior
          maneira, porque é o primeiro ecrã que um atleta de outro clube
          vê. O nome vem agora da equipa do link; o emblema, se existir,
          também. */}
      {equipa && equipa.logo ? (
        <img src={equipa.logo} alt="" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 14 }} />
      ) : null}
      {/* "Boa noite, SC Salgueiros!" era estranho: cumprimentava o clube
          e não o miúdo que está do outro lado. O emblema por cima já diz
          de quem é o ecrã; a saudação é para quem lá chega. */}
      <div style={{ ...display, fontSize: 21, fontWeight: 700, color: T.cream, marginBottom: 6 }}>
        {greetingNow()}, craque!
      </div>
      <div style={{ fontSize: 13.5, color: T.mutedDim, marginBottom: 26 }}>Introduz o teu código pessoal para entrares.</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
        {[...Array(maxLen)].map((_, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            // As posições acima do mínimo aparecem mais esbatidas: quem
            // tem um código de quatro percebe que já pode entrar.
            border: `1px solid ${i < minLen ? T.line : T.line + '80'}`,
            background: i < value.length ? T.gold : 'transparent',
          }} />
        ))}
      </div>

      {error && <div style={{ color: T.bad, fontSize: 13, marginBottom: 14 }}>Código inválido — tenta novamente.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
        {digits.map((d, i) => (
          <button key={i} onClick={() => press(d)} disabled={d === ''} style={{
            padding: '18px 0', borderRadius: 10, cursor: d === '' ? 'default' : 'pointer',
            background: d === '' ? 'transparent' : T.surface, border: d === '' ? 'none' : `1px solid ${T.line}`,
            color: T.cream, ...display, fontSize: 20, fontWeight: 600,
          }}>{d}</button>
        ))}
      </div>

      <BigButton onClick={submit} disabled={value.length < minLen || aVerificar} accent>{aVerificar ? 'A verificar…' : 'Entrar'}</BigButton>
      <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 18 }}>Não sabes o teu código? Pede-o ao staff técnico.</div>
    </div>
  );
}

