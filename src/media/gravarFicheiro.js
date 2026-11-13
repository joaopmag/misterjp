// media/gravarFicheiro.js
//
// GRAVAR CLIPES DE VÍDEOS CARREGADOS SEM GRAVAR O ECRÃ.
//
// Os cortes do YouTube só se conseguem gravar pela partilha do separador
// (o YouTube não deixa ler a imagem). Os vídeos carregados são ficheiros
// nossos: aqui toca-se cada troço num <video> escondido, copia-se cada
// imagem para um <canvas> e grava-se o canvas e o som. Sai SÓ o vídeo —
// sem pedir para partilhar o ecrã, sem a página à volta.
//
// Precisa que o Storage deixe ler a imagem (CORS). Se não deixar, a
// função rejeita com `semAcesso` e quem chama usa a gravação do separador.
// Grava em tempo real (um clipe de 10 s demora 10 s).

import { corrigirDuracaoMp4 } from './duracaoMp4';

const TIPOS = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4',
  'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function podeGravarFicheiro() {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

const esperar = (el, evento) => new Promise((res, rej) => {
  const ok = () => { limpar(); res(); };
  // Um erro a carregar com crossOrigin é, quase sempre, o Storage sem CORS.
  const erro = () => { limpar(); const e = new Error('semAcesso'); e.semAcesso = true; rej(e); };
  const limpar = () => { el.removeEventListener(evento, ok); el.removeEventListener('error', erro); };
  el.addEventListener(evento, ok, { once: true });
  el.addEventListener('error', erro, { once: true });
});

/* segmentos: [{ src, inicio, fim }]. Devolve { parar, acabou } (como a
   gravação do separador): `acabou` resolve com o Blob do vídeo. */
export async function gravarClipesDeFicheiro(segmentos, { onProgresso } = {}) {
  const segs = (segmentos || []).filter(s => s && s.src && s.fim > s.inicio);
  if (!segs.length) throw new Error('vazio');
  // O som só arranca dentro do clique do utilizador: cria-se já.
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const audio = Ctx ? new Ctx() : null;
  const destinoSom = audio ? audio.createMediaStreamDestination() : null;

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = !audio; // com AudioContext o som vai para a gravação, não para as colunas
  let fonteSom = null;

  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  let rec = null;
  let parado = false;
  let resolver;
  let rejeitar;
  const acabou = new Promise((res, rej) => { resolver = res; rejeitar = rej; });
  const partes = [];
  const total = segs.reduce((t, s) => t + (s.fim - s.inicio), 0);
  let feito = 0;

  const fechar = () => {
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) { /* nada */ }
    try { if (audio) audio.close(); } catch (e) { /* nada */ }
  };
  const parar = () => {
    parado = true;
    if (rec && rec.state !== 'inactive') rec.stop();
    else { fechar(); resolver(null); }
    return acabou;
  };

  (async () => {
    try {
      for (let k = 0; k < segs.length && !parado; k++) {
        const s = segs[k];
        if (video.src !== s.src) {
          video.src = s.src;
          await esperar(video, 'loadedmetadata');
        }
        if (!rec) {
          // Tamanho do primeiro vídeo (até 1920 de largura).
          const w = video.videoWidth || 1280;
          const h = video.videoHeight || 720;
          const k2 = Math.min(1, 1920 / w);
          canvas.width = Math.round(w * k2 / 2) * 2;
          canvas.height = Math.round(h * k2 / 2) * 2;
          if (audio && !fonteSom) { fonteSom = audio.createMediaElementSource(video); fonteSom.connect(destinoSom); }
        }
        video.currentTime = s.inicio;
        await esperar(video, 'seeked');
        // Imagem do vídeo no canvas, centrada e sem deformar.
        const desenhar = () => {
          const vw = video.videoWidth; const vh = video.videoHeight;
          if (!vw || !vh) return;
          const r = Math.min(canvas.width / vw, canvas.height / vh);
          const dw = vw * r; const dh = vh * r;
          g.fillStyle = '#000'; g.fillRect(0, 0, canvas.width, canvas.height);
          g.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
        };
        desenhar();
        if (!rec) {
          // Sem acesso à imagem (CORS): não dá para gravar assim.
          try { g.getImageData(0, 0, 1, 1); } catch (e) { const err = new Error('semAcesso'); err.semAcesso = true; throw err; }
          const stream = canvas.captureStream(30);
          if (destinoSom) destinoSom.stream.getAudioTracks().forEach(t => stream.addTrack(t));
          const mime = TIPOS.find(t => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t)) || '';
          rec = new window.MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined);
          rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
          rec.onstop = () => { fechar(); corrigirDuracaoMp4(new Blob(partes, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] })).then(resolver); };
          if (audio && audio.state === 'suspended') { try { await audio.resume(); } catch (e) { /* sem som */ } }
          rec.start(500);
        } else if (rec.state === 'paused') rec.resume();
        await video.play();
        // Copia imagem a imagem até ao fim do troço.
        await new Promise((res) => {
          const passo = () => {
            if (parado) { res(); return; }
            desenhar();
            if (onProgresso) onProgresso(Math.min(1, (feito + Math.max(0, video.currentTime - s.inicio)) / total));
            if (video.currentTime >= s.fim || video.ended) { res(); return; }
            if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(passo);
            else requestAnimationFrame(passo);
          };
          passo();
        });
        video.pause();
        feito += s.fim - s.inicio;
        // Entre troços a gravação fica em pausa (não grava o salto).
        if (rec.state === 'recording' && k < segs.length - 1) rec.pause();
      }
      if (rec && rec.state !== 'inactive') rec.stop();
      else if (!rec) { fechar(); resolver(null); }
    } catch (e) {
      fechar();
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (er) { /* nada */ } }
      rejeitar(e);
    }
  })();

  return { parar, acabou };
}
