import React, { useState } from 'react';
import { supabase } from './supabaseClient';

const T_BG = '#182619';
const T_SURFACE = '#202F22';
const T_LINE = '#3A4F3D';
const T_CREAM = '#ECEFEA';
const T_MUTED = '#8FA091';
const T_GOLD = '#C9A227';
const T_BAD = '#C25A5A';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Conta criada. Confirma o teu email e depois inicia sessão — a seguir escolhes a tua equipa.');
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email ou palavra-passe incorretos.'
        : err.message);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 12px', borderRadius: 8, border: `1px solid ${T_LINE}`,
    background: T_BG, color: T_CREAM, fontSize: 16, boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T_BG, padding: 20, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <form onSubmit={submit} style={{
        width: '100%', maxWidth: 360, background: T_SURFACE, border: `1px solid ${T_LINE}`,
        borderRadius: 14, padding: 28,
      }}>
        {/* O NOME DO CLUBE SAIU DAQUI.

            Este ecrã deixou de ser a porta de uma equipa e passou a ser a
            porta da plataforma: quem chega aqui ainda não tem equipa
            nenhuma, e pode estar a criar a sua. Dizer-lhe "SC Salgueiros
            U19" antes de saber quem é seria errado — e é o clube dela que
            aparece depois, no cabeçalho, vindo da equipa que escolher. */}
        <div style={{ fontSize: 12, letterSpacing: '.08em', color: T_GOLD, textTransform: 'uppercase', marginBottom: 4 }}>
          Mister JP
        </div>
        <h1 style={{ fontSize: 21, color: '#FFFFFF', margin: '0 0 20px' }}>
          {mode === 'login' ? 'Iniciar sessão' : 'Criar conta'}
        </h1>

        <label style={{ display: 'block', fontSize: 12.5, color: T_MUTED, marginBottom: 6 }}>Email</label>
        <input
          type="email" required autoComplete="email" value={email}
          onChange={e => setEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}
        />

        <label style={{ display: 'block', fontSize: 12.5, color: T_MUTED, marginBottom: 6 }}>Palavra-passe</label>
        <input
          type="password" required minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }}
        />

        {error && <div style={{ color: T_BAD, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
        {info && <div style={{ color: T_GOLD, fontSize: 12.5, marginBottom: 14 }}>{info}</div>}

        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '11px 12px', borderRadius: 8, border: 'none',
          background: '#B5393F', color: '#FFFFFF', fontWeight: 600, fontSize: 14.5,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'A processar…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
          style={{
            width: '100%', marginTop: 12, padding: '8px', background: 'transparent', border: 'none',
            color: T_MUTED, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          {mode === 'login' ? 'Ainda não tens conta? Cria uma' : 'Já tens conta? Inicia sessão'}
        </button>
      </form>
    </div>
  );
}
