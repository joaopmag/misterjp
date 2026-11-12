// media/pdf.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { loadPdfJs } from './leitores';
import { useState, useEffect } from 'react';

// Mostra o PDF desenhando a página atual num <canvas>, em vez de o embutir
// num iframe. É preciso porque o Chrome no Android (ao contrário do
// desktop) não tem visualizador de PDF embutido para iframes — mesmo com
// um blob: URL válido, mostra só um cartão "Abrir" em vez do conteúdo.
// Desenhar as páginas nós mesmos funciona em qualquer browser, incluindo
// dentro de WebViews de outras apps. Mostra uma página de cada vez (em
// vez de todas empilhadas) para caber por inteiro no ecrã em modo
// apresentação/ecrã inteiro, com navegação por setas do teclado (←/→,
// PageUp/PageDown, espaço) e botões, útil sobretudo quando não há mais
// nada em que interagir (ecrã inteiro).
/* PDF ANEXADO COMO IMAGEM. Desenha as páginas de um PDF (anexo de
   exercício) como imagens, para poderem aparecer no cartão do exercício,
   na sessão e nas folhas impressas, em vez de o PDF abrir sozinho numa
   aba. Usa o mesmo pdf.js do leitor. Fica guardado em memória, por isso
   cada PDF só é desenhado uma vez por visita. */
export const PDF_IMAGENS = new Map();

export function pdfParaImagens(url, maxPaginas = 10, largura = 1400) {
  const chave = `${url.length}:${url.slice(0, 200)}:${url.slice(-200)}:${maxPaginas}:${largura}`;
  if (PDF_IMAGENS.has(chave)) return PDF_IMAGENS.get(chave);
  const promessa = (async () => {
    const pdfjsLib = await loadPdfJs();
    let fonte = url;
    if (/^data:/.test(url)) {
      const b64 = url.split(',')[1] || '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      fonte = { data: bytes };
    }
    const doc = await pdfjsLib.getDocument(fonte).promise;
    const n = Math.min(doc.numPages, maxPaginas);
    const imagens = [];
    for (let i = 1; i <= n; i++) {
      const pagina = await doc.getPage(i);
      const v1 = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: largura / v1.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport }).promise;
      imagens.push(canvas.toDataURL('image/jpeg', 0.88));
    }
    return imagens;
  })();
  promessa.catch(() => PDF_IMAGENS.delete(chave));
  PDF_IMAGENS.set(chave, promessa);
  return promessa;
}

export function PdfComoImagens({ url, so1 = false, largura = 1400, estiloImg, vazio = null }) {
  const [imagens, setImagens] = useState(null); // null = a preparar; [] = falhou
  useEffect(() => {
    if (!url) { setImagens([]); return undefined; }
    let vivo = true;
    setImagens(null);
    pdfParaImagens(url, so1 ? 1 : 10, largura)
      .then(lista => { if (vivo) setImagens(lista); })
      .catch(() => { if (vivo) setImagens([]); });
    return () => { vivo = false; };
  }, [url, so1, largura]);
  if (imagens === null) return <div data-pdf-a-preparar="1" style={{ width: '100%', height: '100%' }} />;
  if (!imagens.length) return vazio;
  return (
    <>
      {imagens.map((src, i) => <img key={i} src={src} alt="" style={estiloImg} />)}
    </>
  );
}

