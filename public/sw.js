/* Service worker mínimo do Portal do Atleta.
   Só existe para o telemóvel aceitar instalar o Portal como app (ícone no
   ecrã inicial). Não guarda nada em cache: cada pedido vai sempre à rede,
   por isso o Portal mostra sempre os dados mais recentes. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});
