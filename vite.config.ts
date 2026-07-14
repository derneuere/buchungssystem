import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// SPA-Modus: TanStack Start prerendert nur die App-Shell zu einer statischen
// index.html (statt _shell.html, dank prerender.outputPath: '/index') unter
// .output/public/. Dieser Ordner wird im Docker-Build nach pb_public/ kopiert
// und von PocketBase same-origin ausgeliefert (Deep-Links via indexFallback ->
// index.html). Kein Node-Server zur Laufzeit; .output/server/ wird ignoriert.
const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: '/index',
        },
      },
    }),
    viteReact(),
  ],
})

export default config
