import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
  server: {
    proxy: {
      "/api": {
        target: "https://crm-dashboard-100immo.vercel.app",
        changeOrigin: true,
      },
    },
  },
})
