import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    // Cho phép Cloudflare tunnel (trycloudflare.com) truy cập khi dev
    allowedHosts: [
      '.trycloudflare.com',
      '.ngrok-free.app',
      '.ngrok.io',
      '.loca.lt',
    ],
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
})
