// base/impressao.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

/* Imprimir com o nome certo no PDF. Ao "Guardar como PDF", o browser usa
   o título da página como nome do ficheiro (e como cabeçalho da folha).
   Troca-se o título só durante a impressão e repõe-se logo a seguir. */
export function imprimirComNome(nome) {
  const limpo = String(nome || '').trim();
  const antes = document.title;
  if (limpo) document.title = limpo;
  const repor = () => { document.title = antes; window.removeEventListener('afterprint', repor); };
  window.addEventListener('afterprint', repor);
  setTimeout(() => {
    esperarImagensDoStorage().then(() => {
      window.print();
      // Safari e alguns telemóveis não disparam "afterprint": repõe na mesma.
      setTimeout(repor, 1500);
    });
  }, 80);
}

/* Antes de imprimir, espera (no máximo 5 s) que as imagens vindas do
   Storage acabem de carregar; em base64 já estão prontas, por isso
   nesses casos a impressão sai como antes, sem espera nenhuma. */
export function esperarImagensDoStorage(limiteMs = 5000) {
  const pendentes = Array.from(document.images || []).filter(img =>
    !img.complete && /\/storage\/v1\/object\//.test(img.currentSrc || img.src || ''));
  // PDFs anexados que ainda estão a ser desenhados como imagem (ver
  // `PdfComoImagens`). Sem nenhum, não há espera nenhuma.
  const pdfsPendentes = () => document.querySelector('[data-pdf-a-preparar]');
  if (!pendentes.length && !pdfsPendentes()) return Promise.resolve();
  const todas = Promise.all(pendentes.map(img => new Promise(r => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  })));
  const pdfs = new Promise(r => {
    const ver = () => (pdfsPendentes() ? setTimeout(ver, 120) : r());
    ver();
  });
  return Promise.race([Promise.all([todas, pdfs]), new Promise(r => setTimeout(r, Math.max(limiteMs, 10000)))]);
}

