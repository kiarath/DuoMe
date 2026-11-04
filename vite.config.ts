import { defineConfig } from 'vite';

// base relativa para que funcione en GitHub Pages bajo /<repo>/ sin configurar nada más
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
