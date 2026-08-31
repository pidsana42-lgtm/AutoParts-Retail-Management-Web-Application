import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ocrTarget = env.VITE_OCR_URL || 'http://localhost:8000'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: true,
      proxy: {
        // Go backend (main API)
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
        '/barcode': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
        // FastAPI OCR server
        '/ocr': {
          target: ocrTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,      // 5 minutes (300k ms)
          proxyTimeout: 300000, // 5 minutes
          rewrite: (path) => path.replace(/^\/ocr/, ''),
        },
      },
    },
  }
})
