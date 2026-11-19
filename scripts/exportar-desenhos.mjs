// scripts/exportar-desenhos.mjs
//
// Empacota src/media/desenhosServidor.jsx num só ficheiro (desenhos.mjs)
// para o video-worker, que grava os desenhos nos MP4 com o mesmo código
// da app. Uso:
//   npm run exportar-desenhos            → escreve dist-worker/desenhos.mjs
//   npm run exportar-desenhos -- <saída> → escreve noutro sítio
// Depois copia o ficheiro para a raiz do repositório video-worker.
//
// O código dos desenhos vive em AnalisadorVideo.jsx, que também importa o
// cliente do Supabase da app: aqui troca-se por um vazio (o pacote não
// fala com a base; o video-worker tem o seu próprio cliente).

import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const saida = path.resolve(process.argv[2] || path.join(raiz, 'dist-worker', 'desenhos.mjs'));

const semSupabase = {
  name: 'sem-supabase',
  setup(b) {
    b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'supabase-vazio', namespace: 'vazio' }));
    b.onLoad({ filter: /.*/, namespace: 'vazio' }, () => ({ contents: 'export const supabase = null; export default null;', loader: 'js' }));
  },
};

await esbuild.build({
  entryPoints: [path.join(raiz, 'src/media/desenhosServidor.jsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  outfile: saida,
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
  plugins: [semSupabase],
  legalComments: 'none',
  minify: true,
  banner: { js: `// desenhos.mjs: GERADO a partir do misterjp (scripts/exportar-desenhos.mjs) em ${new Date().toISOString().slice(0, 10)}. Não editar à mão.\nimport { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);` },
  logLevel: 'warning',
});
console.log('desenhos.mjs escrito em', saida);
