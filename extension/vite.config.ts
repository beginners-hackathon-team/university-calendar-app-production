import { defineConfig } from 'vite'
import { resolve } from 'path'

const entry = process.env.BUILD_ENTRY as string

const ENTRY_PATHS: Record<string, string> = {
  background: 'src/background/background.ts',
  content: 'src/content/content.ts',
  popup: 'src/popup/popup.ts',
  appContent: 'src/content/appContent.ts',
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: entry === 'background',
    rollupOptions: {
      input: resolve(__dirname, ENTRY_PATHS[entry] ?? `src/${entry}/${entry}.ts`),
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
      },
    },
  },
})
