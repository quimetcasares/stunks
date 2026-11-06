import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// En modo desarrollo, /datos sale de practica/datos (datos locales del NQ, fuera del repo).
const datosLocales = (): Plugin => ({
  name: 'datos-locales',
  configureServer(server) {
    const raiz = resolve(process.env.STUNKS_DATOS ?? 'practica/datos')
    server.middlewares.use('/datos', (req, res, next) => {
      const ruta = resolve(raiz, `.${decodeURIComponent((req.url ?? '/').split('?')[0])}`)
      if (!ruta.startsWith(raiz + sep) || !existsSync(ruta) || !statSync(ruta).isFile()) return next()
      res.setHeader('Content-Type', ruta.endsWith('.json') ? 'application/json' : 'application/octet-stream')
      createReadStream(ruta).pipe(res)
    })
  },
})

// Formas de construir:
//  - normal (`npm run build`): dist/ para Cloudflare Pages.
//  - practica (`npm run build:practica`): practica/app/, para abrirla en local con practicar.bat.
//  - archivo (`npm run build:archivo`): un solo HTML en dist-archivo/.
export default defineConfig(({ mode }) => {
  const archivo = mode === 'archivo'
  const practica = mode === 'practica'
  return {
    plugins: archivo ? [react(), viteSingleFile()] : [react(), datosLocales()],
    base: archivo || practica ? './' : '/',
    build: {
      outDir: archivo ? 'dist-archivo' : practica ? 'practica/app' : 'dist',
      emptyOutDir: true,
      target: 'es2022',
    },
    server: { port: 5173, open: !process.env.STUNKS_E2E },
  }
})
