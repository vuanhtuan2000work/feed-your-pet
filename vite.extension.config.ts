import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import type { Plugin } from 'vite'

function generateCatVariants() {
  execFileSync('node', ['scripts/generate-cat-variants.mjs'], { stdio: 'inherit' })
}

function catVariantsPlugin(): Plugin {
  return {
    name: 'feed-your-pet-extension-cat-variants',
    buildStart() {
      generateCatVariants()
    },
  }
}

export default defineConfig({
  mode: 'production',
  plugins: [catVariantsPlugin(), react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    copyPublicDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/extension/content.tsx'),
      name: 'FeedYourPetContent',
      formats: ['iife'],
      fileName: () => 'content.js',
      cssFileName: 'content',
    },
  },
})
