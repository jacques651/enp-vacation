import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  build: {
    target: 'es2020',
    outDir: 'dist',       // ✅ IMPORTANT
    emptyOutDir: true     // ✅ nettoie avant build
  },
  optimizeDeps: {
    include: ['@tauri-apps/api']
  }
})