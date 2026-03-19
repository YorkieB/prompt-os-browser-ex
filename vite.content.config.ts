import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(projectRoot, 'src/content.ts'),
      name: 'PromptOSContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
