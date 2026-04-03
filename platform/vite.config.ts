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
      '/api': process.env.VITE_API_URL || 'http://20.40.232.1:8000',
      '/upload': process.env.VITE_API_URL || 'http://20.40.232.1:8000',
      '/status': process.env.VITE_API_URL || 'http://20.40.232.1:8000',
      '/job': process.env.VITE_API_URL || 'http://20.40.232.1:8000',
      '/stream': process.env.VITE_API_URL || 'http://20.40.232.1:8000',
      '/download': process.env.VITE_API_URL || 'http://20.40.232.1:8000',
      '/chapters': process.env.VITE_API_URL || 'http://20.40.232.1:8000',
    },
  },
})
