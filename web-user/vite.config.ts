import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    host: '0.0.0.0', // Explicitly bind to all interfaces (IPv4 and IPv6) for network access
    strictPort: false,
  },
})

