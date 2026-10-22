import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Duas páginas na mesma app: a plataforma (/) e o Portal do Atleta
// (/portal/). Gerar a página do Portal na compilação faz com que
// /portal/ exista sempre no servidor, sem depender de regras do Vercel.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        portal: resolve(__dirname, 'portal/index.html'),
      },
    },
  },
});
