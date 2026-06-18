import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { boneyardPlugin } from 'boneyard-js/vite'

export default defineConfig({
  plugins: [react(), boneyardPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
