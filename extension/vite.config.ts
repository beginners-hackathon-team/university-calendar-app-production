import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const entry = process.env.BUILD_ENTRY as string

const ENTRY_PATHS: Record<string, string> = {
  background: 'src/background/background.ts',
  content: 'src/content/content.ts',
  popup: 'src/popup/Popup.tsx',
  appContent: 'src/content/appContent.ts',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: entry === 'background',
    rollupOptions: {
      input: resolve(__dirname, ENTRY_PATHS[entry] ?? `src/${entry}/${entry}.ts`),
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]',
        format: 'iife',
      },
    },
  },
})
