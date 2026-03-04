import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['animejs'], // Forces Vite to pre-bundle AnimeJS for faster local-first loading [cite: 1388]
  },
  server: {
    hmr: {
      overlay: true, // Keeps the error overlay visible so we can catch "Elite" UI bugs early [cite: 1901]
    }
  }
})