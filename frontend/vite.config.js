import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev o Vite roda na 5173 e faz proxy de /api e /webhook para o Express (3000).
// Assim o cookie httpOnly de sessao funciona como se fosse a mesma origem.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/webhook': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
