// media/desenhosServidor.jsx
//
// PONTO DE ENTRADA DO PACOTE "desenhos.mjs" DO VIDEO-WORKER. Não é usado
// pela app: `npm run exportar-desenhos` empacota este ficheiro (com o
// React e o código dos desenhos da app) num só ficheiro, que se copia
// para o repositório video-worker. Assim o MP4 desenha cada forma com o
// MESMO código que a app (renderShape) e segue as MESMAS regras das
// paragens (planoDesenhos.js). Mudou o desenho na app? Volta a correr o
// script e atualiza o desenhos.mjs do video-worker.

import { renderToStaticMarkup } from 'react-dom/server';
import { renderShape } from '../AnalisadorVideo';

export { planoSala, planoDoClipeAtleta, planoDoCorte, planoVazio, assinaturaDoPlano, pausasDoClipeAtleta } from './planoDesenhos';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* Os efeitos animados ficam parados: cada <animate> dá ao elemento o
   primeiro valor dele (ex.: o brilho do anel, fill-opacity 0,10), como no
   primeiro instante da animação na app. Sem isto, o elemento ficava com o
   valor de base (o anel ficava cheio, opaco). */
function pararAnimacoes(svg) {
  const ANIM = '<animate\\b[^>]*?(?:\\/>|>\\s*<\\/animate>)';
  return svg.replace(new RegExp(`<(\\w+)((?:\\s+[\\w:-]+="[^"]*")*)\\s*>((?:\\s*${ANIM})+)`, 'g'), (m, tag, attrs, anims) => {
    let novos = attrs;
    const re = new RegExp(ANIM, 'g');
    let x;
    while ((x = re.exec(anims))) {
      const nome = /attributeName="([\w-]+)"/.exec(x[0]);
      const val = /values="([^;"]+)/.exec(x[0]) || /from="([^"]+)"/.exec(x[0]);
      if (!nome || !val) continue;
      const attr = nome[1];
      if (new RegExp(`\\s${attr}="`).test(novos)) novos = novos.replace(new RegExp(`(\\s${attr}=")[^"]*"`), `$1${val[1]}"`);
      else novos += ` ${attr}="${val[1]}"`;
    }
    return `<${tag}${novos}>`;
  }).replace(new RegExp(ANIM, 'g'), '');
}

/* Um quadro W×H (1280×720) com a imagem do vídeo (já reduzida para caber,
   fw×fh, ao centro, com barras pretas como no MP4) e os desenhos por
   cima, na área da imagem: como a camada SVG da app (viewBox 100×56,25
   esticada à imagem, cortada à imagem). Os desenhos ficam no MESMO grupo
   que a imagem (sem <svg> aninhado), para os modos de mistura (o
   "overlay" das zonas no relvado) se misturarem com a imagem, como no
   browser. Com zoom, tudo (imagem e desenhos) aproxima-se do centro do
   círculo, como na app. Sem `imagem`: só os desenhos, em fundo
   transparente (desenhos com o vídeo a andar). */
export function svgDoQuadro({ imagem, fw, fh, W = 1280, H = 720, formas = [], zoom = null }) {
  const x0 = (W - fw) / 2;
  const y0 = (H - fh) / 2;
  const camada = pararAnimacoes(renderToStaticMarkup(
    <g transform={`translate(${x0} ${y0}) scale(${fw / 100} ${fh / 56.25})`}>
      {formas.map((sh, i) => renderShape(sh, i))}
    </g>,
  ));
  let transformacao = '';
  if (zoom && zoom.f > 1) {
    const cx = x0 + (Math.max(0, Math.min(100, zoom.x)) / 100) * fw;
    const cy = y0 + (Math.max(0, Math.min(56.25, zoom.y)) / 56.25) * fh;
    transformacao = ` transform="translate(${cx} ${cy}) scale(${zoom.f}) translate(${-cx} ${-cy})"`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<defs><clipPath id="area"><rect x="${x0}" y="${y0}" width="${fw}" height="${fh}"/></clipPath></defs>`
    + (imagem ? `<rect width="${W}" height="${H}" fill="#000"/>` : '')
    + `<g${transformacao}><g clip-path="url(#area)">`
    + (imagem ? `<image x="${x0}" y="${y0}" width="${fw}" height="${fh}" preserveAspectRatio="none" href="${esc(imagem)}"/>` : '')
    + camada
    + '</g></g></svg>';
}
