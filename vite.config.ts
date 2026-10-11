import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'license-page-route',
      configureServer(server) {
        // Windows resolves /license to the root LICENSE file before SPA fallback.
        server.middlewares.use((request, _response, next) => {
          if (request.url?.split('?')[0] === '/license' && request.headers.accept?.includes('text/html')) request.url = '/index.html'
          next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
