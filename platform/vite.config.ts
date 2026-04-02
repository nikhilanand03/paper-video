import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
      '/status': 'http://localhost:8000',
      '/job': 'http://localhost:8000',
      '/stream': 'http://localhost:8000',
      '/download': 'http://localhost:8000',
      '/chapters': 'http://localhost:8000',
    },
  },
})
