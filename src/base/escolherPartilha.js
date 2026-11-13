// base/escolherPartilha.js
//
// PARTILHAR VÍDEOS E LINKS — o mesmo em todo o lado.
//
// No TELEMÓVEL a folha de partilha do sistema funciona bem (WhatsApp,
// email, Mensagens…), e aceita o próprio ficheiro do vídeo.
// No COMPUTADOR não: no Windows a folha do sistema mostra contactos e
// apps meio vazias, o Outlook abre sem o anexo, e o WhatsApp só aparece se
// a app estiver instalada de uma certa forma. Por isso, no computador,
// abre-se uma janela nossa com escolhas que funcionam sempre:
//   · WhatsApp  → abre o WhatsApp (app ou Web) com a mensagem e o link;
//   · Email     → abre o programa de email com o assunto e o link;
//   · Copiar link;
//   · Descarregar o vídeo (quando há ficheiro) — para anexar à mão;
//   · Outras apps… → a folha do sistema, para quem a quiser.
// Feita em DOM simples (sem React) para se poder chamar de qualquer sítio
// (Sala de Vídeo, Portal, Análise de Vídeo, página pública).

import { T } from './tema';

export function eTelemovel() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPad recente apresenta-se como Mac, mas tem ecrã tátil.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

function descarregar(ficheiro) {
  const url = URL.createObjectURL(ficheiro);
  const a = document.createElement('a');
  a.href = url; a.download = ficheiro.name || 'video';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* `url` (opcional): link a partilhar. `ficheiro` (opcional): File do vídeo.
   Devolve uma Promise que resolve quando a janela fecha (ou a partilha
   do sistema acaba). */
export async function escolherPartilha({ titulo = '', texto = '', url = '', ficheiro = null }) {
  const mensagem = [texto || titulo, url].filter(Boolean).join('\n');

  if (eTelemovel() && navigator.share) {
    try {
      if (ficheiro && navigator.canShare && navigator.canShare({ files: [ficheiro] })) {
        await navigator.share({ files: [ficheiro], title: titulo, text: texto || titulo });
        return 'partilhado';
      }
      if (url) { await navigator.share({ title: titulo, text: texto || titulo, url }); return 'partilhado'; }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelado';
      // Outro erro: segue para a janela própria.
    }
    if (ficheiro && !url) { descarregar(ficheiro); return 'descarregado'; }
  }

  return new Promise((resolver) => {
    const fundo = document.createElement('div');
    fundo.setAttribute('role', 'dialog');
    fundo.setAttribute('aria-label', 'Partilhar');
    Object.assign(fundo.style, {
      position: 'fixed', inset: '0', zIndex: '2000', background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      fontFamily: 'Inter, system-ui, sans-serif',
    });
    const caixa = document.createElement('div');
    Object.assign(caixa.style, {
      background: T.surface || '#1c2a22', color: T.cream || '#fff', border: `1px solid ${T.line || '#333'}`,
      borderRadius: '12px', padding: '18px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 50px rgba(0,0,0,.5)',
    });
    const fechar = (r) => { fundo.remove(); document.removeEventListener('keydown', tecla); resolver(r); };
    const tecla = (e) => { if (e.key === 'Escape') fechar('cancelado'); };
    document.addEventListener('keydown', tecla);
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar('cancelado'); });

    const h = document.createElement('div');
    h.textContent = titulo ? `Partilhar · ${titulo}` : 'Partilhar';
    Object.assign(h.style, { fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: T.gold || '#e0b84a' });
    caixa.appendChild(h);

    const aviso = document.createElement('div');
    Object.assign(aviso.style, { fontSize: '12px', color: T.mutedDim || '#999', margin: '10px 0 0', minHeight: '16px', lineHeight: '1.45' });

    const botao = (rotulo, acao, destaque) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = rotulo;
      Object.assign(b.style, {
        display: 'block', width: '100%', textAlign: 'left', margin: '0 0 8px', padding: '10px 12px',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', fontFamily: 'inherit',
        background: destaque ? (T.crimson || '#B5393F') : 'transparent', color: destaque ? '#fff' : (T.cream || '#fff'),
        border: `1px solid ${destaque ? (T.crimson || '#B5393F') : (T.line || '#333')}`,
      });
      b.addEventListener('click', acao);
      caixa.appendChild(b);
      return b;
    };

    if (url) {
      botao('WhatsApp', () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener');
        fechar('whatsapp');
      }, true);
      botao('Email', () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(titulo || 'Vídeo')}&body=${encodeURIComponent(mensagem)}`;
        fechar('email');
      });
      const copiar = botao('Copiar link', async () => {
        try { await navigator.clipboard.writeText(mensagem); copiar.textContent = 'Link copiado ✓'; } catch (e) { window.prompt('Copia o link:', url); }
      });
    }
    if (ficheiro) {
      botao(url ? 'Descarregar o vídeo' : 'Descarregar o vídeo', () => {
        descarregar(ficheiro);
        aviso.textContent = `Ficheiro "${ficheiro.name}" descarregado. No WhatsApp ou no email, anexa-o a partir da pasta Transferências.`;
      }, !url);
    }
    if (navigator.share) {
      botao('Outras apps…', async () => {
        try {
          if (ficheiro && navigator.canShare && navigator.canShare({ files: [ficheiro] })) await navigator.share({ files: [ficheiro], title: titulo });
          else if (url) await navigator.share({ title: titulo, text: texto || titulo, url });
          fechar('partilhado');
        } catch (e) { if (!(e && e.name === 'AbortError')) aviso.textContent = 'O sistema não conseguiu partilhar. Usa uma das opções acima.'; }
      });
    }
    if (!url && ficheiro) {
      aviso.textContent = 'O WhatsApp e o email no computador não recebem o vídeo diretamente: descarrega-o e anexa-o.';
    }
    caixa.appendChild(aviso);
    const sair = document.createElement('button');
    sair.type = 'button'; sair.textContent = 'Fechar';
    Object.assign(sair.style, { marginTop: '8px', background: 'none', border: 'none', color: T.mutedDim || '#999', cursor: 'pointer', fontSize: '12.5px', fontFamily: 'inherit', padding: '4px 0' });
    sair.addEventListener('click', () => fechar('cancelado'));
    caixa.appendChild(sair);
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
  });
}
