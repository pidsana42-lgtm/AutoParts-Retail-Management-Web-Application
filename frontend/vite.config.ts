import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
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
      },
    },
    build: {
      // Vite 8 uses Rolldown. Keep notices in a separate build artifact.
      license: true,
      rolldownOptions: {
        output: { comments: false },
      },
    },
  }
})
