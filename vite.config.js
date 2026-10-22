import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Três páginas na mesma app: a raiz (/), a plataforma (/app/) e o Portal
// do Atleta (/portal/). Gerar as páginas na compilação faz com que /app/ e
// /portal/ existam sempre no servidor, sem depender de regras do Vercel.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        portal: resolve(__dirname, 'portal/index.html'),
      },
    },
  },
});
