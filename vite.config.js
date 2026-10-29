import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { tinulungServerPlugin } from './server/viteApiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tinulungServerPlugin()],
})
