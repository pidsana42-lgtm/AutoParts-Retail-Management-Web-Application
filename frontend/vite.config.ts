import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Go backend (main API)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      // FastAPI OCR server
      '/ocr': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        timeout: 300000,      // 5 minutes (300k ms)
        proxyTimeout: 300000, // 5 minutes
        rewrite: (path) => path.replace(/^\/ocr/, ''),
      },
    },
  },
})
