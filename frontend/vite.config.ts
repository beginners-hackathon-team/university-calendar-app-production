import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (command === 'serve' && !env['VITE_API_PROXY_TARGET']) {
    throw new Error('VITE_API_PROXY_TARGET is required when running dev server (.env.development)')
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: command === 'serve'
        ? { '/api': env['VITE_API_PROXY_TARGET'] }
        : undefined,
    },
    build: {
      outDir: '../backend/static',
      emptyOutDir: true,
    },
  }
})
