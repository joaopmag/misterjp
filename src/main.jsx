import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary, useEcraLigadoEmVideo, useAtualizacaoAutomatica } from './base/raiz';
import { T } from './base/tema';

/* ARRANQUE EM DUAS PORTAS (19/11).
   O Portal do atleta (links com ?portal=… ou ?checkin) carrega só o
   código do Portal; a app da equipa técnica (e as páginas públicas de
   vídeos partilhados, que vivem no App) carrega o resto. Antes, um atleta
   no telemóvel descarregava a app inteira (2,6 MB) para responder ao
   questionário. A decisão é a mesma que o App fazia lá dentro. */
function ehPortal() {
  if (typeof window === 'undefined') return false;
  const { search, hash } = window.location;
  const p = new URLSearchParams(search);
  if (p.has('junto') || p.has('video') || p.has('corte') || p.has('clipe')) return false;
  if (/^\/portal(\/|$)/.test(window.location.pathname)) return true;
  // Ícone do Portal instalado (Android): abre /?origem=portal-icone e o
  // Portal da última equipa (o CheckinApp reescreve o endereço ao carregar).
  if (p.get('origem') === 'portal-icone') { try { if (localStorage.getItem('mjp-portal-ultimo')) return true; } catch (e) { /* segue */ } }
  return search.includes('checkin') || hash.includes('checkin') || search.includes('portal=') || hash.includes('portal=');
}

const Portal = lazy(() => import('./atleta/CheckinApp').then(m => ({ default: m.CheckinApp })));
const App = lazy(() => import('./App.jsx'));

// Enquanto o código chega: o fundo da app, sem texto (nada pisca).
const Espera = () => <div style={{ minHeight: '100vh', background: T.bg }} />;

function RaizPortal() {
  useEcraLigadoEmVideo();
  useAtualizacaoAutomatica();
  return <ErrorBoundary><Portal /></ErrorBoundary>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<Espera />}>
      {ehPortal() ? <RaizPortal /> : <App />}
    </Suspense>
  </React.StrictMode>
);
