import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { pitulungServerPlugin } from './server/viteApiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), pitulungServerPlugin()],
})
