import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, /api (and Django's own admin) are forwarded to the Django server so the
// browser talks to a single origin — the same layout Nginx gives you in production.
// Set VITE_API_URL to call the API directly instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/django-admin': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
