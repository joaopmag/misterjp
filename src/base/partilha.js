// base/partilha.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { escapeHtmlText } from './utilidades';
import { PITCH_ASPECT } from '../tatico/campo';

// Monta o documento .html completo (info + um ou mais esquemas táticos).
// blocks: [{ heading, html, blockId, frames }]
export function buildShareableHtmlDoc({ title, metaLines, description, blocks, extraHtml }) {
  const framesMap = {};
  blocks.forEach(b => { if (b.frames) framesMap[b.blockId] = b.frames; });
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtmlText(title)}</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:24px; background:#12241a; color:#F0E7D6; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
  .wrap { max-width:820px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 6px; }
  h2 { font-size:16px; margin:26px 0 6px; color:#F0E7D6; }
  .meta { font-size:13px; color:#B9AF9C; margin-bottom:14px; }
  p.desc { font-size:14px; line-height:1.55; color:#DCD3C0; max-width:680px; white-space:pre-wrap; }
  /* Largura fixa em vez de percentagem do ecrã: em ecrãs largos de
     desktop a prancheta fica sempre com o mesmo tamanho legível (não
     esticada à largura da janela), e o aspect-ratio garante sempre a
     proporção exata do viewBox, sem distorcer o desenho. */
  .pitch-wrap { position:relative; width:100%; max-width:640px; aspect-ratio:${PITCH_ASPECT.replace(' ', '')}; margin-top:12px; border-radius:8px; overflow:hidden; background:#1e3a24; border:1px solid #33513c; }
  .pitch-wrap svg { position:absolute; inset:0; width:100%; height:100%; display:block; }
  .controls { margin-top:12px; }
  button { background:#B5393F; color:#fff; border:none; border-radius:8px; padding:9px 16px; font-size:13.5px; cursor:pointer; }
  button:disabled { opacity:.55; cursor:default; }
  .hint { font-size:11.5px; color:#8f8570; margin-top:6px; }
  /* CAMPO E EQUIPA NO FICHEIRO PARTILHADO.

     Antes a equipa saía como duas frases com vírgulas. Quem abre quer ver
     o onze onde ele joga — é para isso que o campo existe no ecrã, e não
     havia razão para o ficheiro dizer menos. */
  .campo { width:100%; max-width:560px; margin:10px 0 18px; display:block; background:#1e3a24; border:1px solid #33513c; border-radius:10px; }
  .equipa { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-bottom:18px; }
  .equipa h3 { font-size:13px; margin:0 0 6px; padding-bottom:4px; border-bottom:1px solid #3d4f42; color:#F0E7D6; }
  .equipa ol { margin:0; padding:0; list-style:none; }
  .equipa li { display:flex; gap:8px; font-size:13px; line-height:1.9; border-bottom:1px solid #24382b; }
  .equipa li .n { width:22px; text-align:right; color:#8f8570; flex-shrink:0; }
  @media (max-width:540px) { .equipa { grid-template-columns:1fr; gap:14px; } }
  table { border-collapse:collapse; margin-top:8px; font-size:13px; }
  td, th { padding:4px 10px 4px 0; text-align:left; }
  footer { margin-top:30px; font-size:11px; color:#6d6553; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
  /* O "TM" ENCOSTA AO TOPO, COMO NUMA MARCA REGISTADA.

     Com align-items:baseline, o sup assentava na mesma linha de base do
     texto e o browser empurrava-o só um pouco acima — ficava a meio da
     altura de "Mister JP", que e o sitio onde um simbolo de marca nunca
     esta.

     flex-start alinha os dois pelo topo, e line-height:1 no sup impede
     que o espaco da propria linha o volte a baixar.

     NOTA: este bloco vive dentro de um template literal de JavaScript —
     crases aqui fecham a string a meio e partem o ficheiro. Foi o que
     aconteceu da primeira vez que escrevi este comentario. */
  footer .brand { display:inline-flex; align-items:flex-start; gap:3px; font-weight:600; letter-spacing:.02em; color:#B9AF9C; padding:4px 10px; border:1px solid #3d4f42; border-radius:999px; background:rgba(255,255,255,0.03); }
  footer .brand sup { font-size:7px; font-weight:600; color:#8f8570; letter-spacing:.06em; line-height:1; vertical-align:top; position:relative; top:1px; }
  @media (min-width:700px) {
    body { padding:40px; }
    h1 { font-size:26px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtmlText(title)}</h1>
  ${metaLines.length ? `<div class="meta">${metaLines.map(escapeHtmlText).join(' · ')}</div>` : ''}
  ${description ? `<p class="desc">${escapeHtmlText(description)}</p>` : ''}
  ${blocks.map(b => `${b.heading ? `<h2>${escapeHtmlText(b.heading)}</h2>` : ''}${b.html}`).join('\n')}
  ${extraHtml || ''}
  <footer>
    <span>Gerado a partir da app da equipa · ${escapeHtmlText(new Date().toLocaleDateString('pt-PT'))}</span>
    <span class="brand"><sup>TM</sup> Mister JP</span>
  </footer>
</div>
<script>
  var FRAMES = ${JSON.stringify(framesMap)};
  function playFrom(svgEl, frames, i, btn) {
    if (i >= frames.length) { btn.disabled = false; btn.textContent = '↻ Repetir apresentação'; return; }
    svgEl.innerHTML = frames[i].svg;
    setTimeout(function () { playFrom(svgEl, frames, i + 1, btn); }, frames[i].holdMs || 16);
  }
  document.querySelectorAll('.play-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var blockId = btn.getAttribute('data-block');
      var frames = FRAMES[blockId];
      var svgEl = document.getElementById('pitch-' + blockId);
      if (!frames || !svgEl) return;
      btn.disabled = true;
      btn.textContent = 'A reproduzir…';
      playFrom(svgEl, frames, 0, btn);
    });
  });
</script>
</body>
</html>`;
}

// Partilha (Web Share API, com ficheiro) ou, se o browser/telemóvel não
// suportar partilha de ficheiros, faz simplesmente o download — o
// treinador consegue depois enviar esse ficheiro à mão por onde quiser.
export async function shareOrDownloadHtml(filename, htmlString, title) {
  try {
    const blob = new Blob([htmlString], { type: 'text/html' });
    const file = new File([blob], filename, { type: 'text/html' });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (err) {
    if (err && err.name === 'AbortError') return; // utilizador cancelou a partilha
    console.error('Falha ao partilhar/descarregar ficheiro:', err);
  }
}

