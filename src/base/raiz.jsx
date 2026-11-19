/* A RAIZ DA APP (19/11): o que corre tanto na app da equipa técnica como
   no Portal do atleta, num ficheiro à parte. Assim o Portal arranca sem
   carregar o código todo da app (ver main.jsx). */
import React, { useEffect } from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, pilha: '' };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro de renderização:', erro, info);
    this.setState({ pilha: (info && info.componentStack) || '' });
  }

  render() {
    if (!this.state.erro) return this.props.children;

    const texto = `${this.state.erro.message || this.state.erro}\n${this.state.pilha}`;
    return (
      <div style={{
        background: '#182619', minHeight: '100vh', padding: 24, color: '#ECEFEA',
        fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: 1.6,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ color: '#C25A5A', fontSize: 18, margin: '0 0 10px' }}>Alguma coisa correu mal</h2>
          <p style={{ color: '#8FA091', margin: '0 0 16px' }}>
            Os teus dados estão seguros — isto é um erro no ecrã, não na base de dados.
            Copia a mensagem abaixo e envia-a, que diz exatamente onde é.
          </p>
          <pre style={{
            background: '#202F22', border: '1px solid #3A4F3D', borderRadius: 8,
            padding: 12, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 300, overflow: 'auto', color: '#ECEFEA',
          }}>{texto}</pre>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => { try { navigator.clipboard.writeText(texto); } catch (e) { /* sem clipboard: seleciona à mão */ } }}
              style={{ background: '#B5393F', color: '#FBF3F0', border: 'none', borderRadius: 7, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}
            >Copiar mensagem</button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: 'transparent', color: '#8FA091', border: '1px solid #3A4F3D', borderRadius: 7, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}
            >Recarregar</button>
          </div>
        </div>
      </div>
    );
  }
}

export function useEcraLigadoEmVideo() {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let aPedir = false;
    let nativoIOS = null;

    const elementoEcraInteiro = () => document.fullscreenElement || document.webkitFullscreenElement || nativoIOS;
    const deveManter = () => {
      if (document.visibilityState !== 'visible') return false;
      const el = elementoEcraInteiro();
      if (!el) return false;
      const procurar = (sel) => Array.from(el.querySelectorAll ? el.querySelectorAll(sel) : []);
      const videos = el.tagName === 'VIDEO' ? [el] : procurar('video');
      if (videos.length) return videos.some(v => !v.paused && !v.ended);
      // YouTube (iframe): em ecrã inteiro conta como a ver. Ecrã inteiro
      // sem vídeo nenhum (o Quadro Tático, por exemplo) não conta.
      return el.tagName === 'IFRAME' || procurar('iframe').length > 0;
    };
    const soltar = () => {
      const l = lock; lock = null;
      if (l) l.release().catch(() => {});
    };
    const atualizar = async () => {
      if (!deveManter()) { soltar(); return; }
      if (lock || aPedir) return;
      aPedir = true;
      try {
        const l = await navigator.wakeLock.request('screen');
        l.addEventListener('release', () => { if (lock === l) lock = null; });
        lock = l;
      } catch (e) {
        /* recusado (bateria fraca, separador escondido…) — segue sem ele */
      } finally {
        aPedir = false;
      }
      // Pode ter saído do ecrã inteiro ou posto em pausa durante o pedido.
      if (!deveManter()) soltar();
    };
    const inicioIOS = (e) => { nativoIOS = e.target; atualizar(); };
    const fimIOS = () => { nativoIOS = null; atualizar(); };

    const doc = ['fullscreenchange', 'webkitfullscreenchange', 'visibilitychange'];
    // Os eventos de <video> não sobem na árvore: apanham-se na captura.
    const media = ['play', 'playing', 'pause', 'ended', 'emptied'];
    doc.forEach(ev => document.addEventListener(ev, atualizar));
    media.forEach(ev => document.addEventListener(ev, atualizar, true));
    document.addEventListener('webkitbeginfullscreen', inicioIOS, true);
    document.addEventListener('webkitendfullscreen', fimIOS, true);
    return () => {
      doc.forEach(ev => document.removeEventListener(ev, atualizar));
      media.forEach(ev => document.removeEventListener(ev, atualizar, true));
      document.removeEventListener('webkitbeginfullscreen', inicioIOS, true);
      document.removeEventListener('webkitendfullscreen', fimIOS, true);
      soltar();
    };
  }, []);
}

function scriptsDaApp(doc) {
  return [...doc.querySelectorAll('script[src]')]
    .map(s => { try { return new URL(s.getAttribute('src'), window.location.origin).pathname; } catch (e) { return ''; } })
    .filter(p => /\/(assets|static)\//.test(p))
    .sort().join('|');
}

export function useAtualizacaoAutomatica() {
  /* OBRIGATÓRIA a partir desta versão: quando há versão nova, a app
     recarrega-se sozinha. Se a pessoa está noutra app e volta, recarrega
     logo. Se está a usar a app, aparece "A app vai atualizar em 30 s"
     (com "Atualizar já") e recarrega no fim da contagem. Só espera se a
     pessoa estiver a ESCREVER num campo, para não lhe apagar o texto:
     nesse caso atualiza assim que ela sair do campo. */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return undefined;
    const atual = scriptsDaApp(document);
    if (!atual) return undefined; // em desenvolvimento não há ficheiros com nome de versão
    let novaVersao = false;
    let aviso = null;
    let contagem = null;
    const aEscrever = () => {
      const a = document.activeElement;
      return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(a.type)) || a.isContentEditable);
    };
    const recarregar = () => { window.location.reload(); };
    const tentarRecarregar = () => {
      if (aEscrever()) {
        // Espera que saia do campo e atualiza logo a seguir.
        document.addEventListener('focusout', () => setTimeout(() => { if (!aEscrever()) recarregar(); }, 300), { once: true });
        return;
      }
      recarregar();
    };
    const mostrarAviso = () => {
      if (aviso || document.visibilityState !== 'visible') return;
      let falta = 30;
      aviso = document.createElement('div');
      aviso.setAttribute('role', 'status');
      aviso.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;'
        + 'display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:12px;background:#14231a;color:#F3ECDA;'
        + 'border:1px solid #C9A227;box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px system-ui,sans-serif;max-width:calc(100vw - 24px);';
      const texto = document.createElement('span');
      const escrever = () => { texto.textContent = `Há uma versão nova. A app vai atualizar em ${falta} s.`; };
      escrever();
      aviso.appendChild(texto);
      const bt = document.createElement('button');
      bt.textContent = 'Atualizar já';
      bt.style.cssText = 'border:none;border-radius:8px;padding:7px 12px;background:#C9A227;color:#14231a;font-weight:700;cursor:pointer;font:inherit;white-space:nowrap;';
      bt.onclick = recarregar;
      aviso.appendChild(bt);
      document.body.appendChild(aviso);
      contagem = setInterval(() => {
        falta -= 1;
        if (falta > 0) { escrever(); return; }
        clearInterval(contagem); contagem = null;
        texto.textContent = 'A atualizar…';
        tentarRecarregar();
      }, 1000);
    };
    const verificar = async () => {
      if (novaVersao) { mostrarAviso(); return; }
      try {
        const r = await fetch(`${window.location.origin}/?v=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const html = await r.text();
        const publicado = scriptsDaApp(new DOMParser().parseFromString(html, 'text/html'));
        if (publicado && publicado !== atual) {
          novaVersao = true;
          if (document.visibilityState === 'visible') mostrarAviso();
        }
      } catch (e) { /* sem rede: tenta-se na próxima */ }
    };
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      // Voltou à app e já se sabia que havia versão nova: recarrega já.
      if (novaVersao) { tentarRecarregar(); return; }
      verificar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', verificar);
    const intervalo = setInterval(verificar, 5 * 60 * 1000);
    const primeira = setTimeout(verificar, 20 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', verificar);
      clearInterval(intervalo); clearTimeout(primeira);
      if (contagem) clearInterval(contagem);
      if (aviso && aviso.parentNode) aviso.parentNode.removeChild(aviso);
    };
  }, []);
}

