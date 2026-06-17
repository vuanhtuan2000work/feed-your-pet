import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

function generateCatVariants() {
  execFileSync('node', ['scripts/generate-cat-variants.mjs'], { stdio: 'inherit' })
}

function catVariantsPlugin(): Plugin {
  const runDir = path.resolve('public/assets/pet/cat_actions/run')

  return {
    name: 'feed-your-pet-cat-variants',
    buildStart() {
      this.addWatchFile(runDir)
      generateCatVariants()
    },
    configureServer(server: ViteDevServer) {
      const generate = () => {
        generateCatVariants()
      }

      server.watcher.add(runDir)
      server.watcher.on('addDir', (dir: string) => {
        if (dir.startsWith(runDir)) {
          generate()
        }
      })
      server.watcher.on('unlinkDir', (dir: string) => {
        if (dir.startsWith(runDir)) {
          generate()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [catVariantsPlugin(), react()],
})
