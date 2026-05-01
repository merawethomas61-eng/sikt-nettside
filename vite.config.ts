import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

// ESM-kompatibel __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ------------------------------------------------------------------
// Vite-plugin: serverer Vercel-style API-funksjoner i `/api/*` lokalt.
// Plukker opp filer i `api/`-mappen automatisk og kjører dem som
// Express-lignende handlers (req.body parset som JSON, res.status().json()).
// ------------------------------------------------------------------
function viteApiPlugin(): Plugin {
  const apiDir = resolve(__dirname, 'api')
  return {
    name: 'vite-plugin-vercel-api-mock',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()

        // Trekk ut endpoint-navnet (uten querystring).
        const path = req.url.split('?')[0].replace(/^\/api\//, '')
        // Bare top-level matching (vi har ikke nested routes per nå).
        if (!/^[\w-]+$/.test(path)) return next()

        const filePath = join(apiDir, `${path}.js`)
        if (!existsSync(filePath)) return next()

        try {
          // Cache-buster slik at endringer i api/*.js plukkes opp i dev.
          const mod = await import(`${pathToFileURL(filePath).href}?v=${Date.now()}`)
          const handler = mod.default
          if (typeof handler !== 'function') {
            res.statusCode = 500
            res.end(JSON.stringify({ error: `api/${path}.js mangler default export` }))
            return
          }

          // Les body og parse som JSON for ikke-GET.
          if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            const bodyStr: string = await new Promise((resolveBody, rejectBody) => {
              const chunks: Buffer[] = []
              req.on('data', (c: Buffer) => chunks.push(c))
              req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
              req.on('error', rejectBody)
            })
            try {
              ;(req as any).body = bodyStr ? JSON.parse(bodyStr) : {}
            } catch {
              ;(req as any).body = bodyStr
            }
          }

          // Parse query string slik at req.query er tilgjengelig.
          try {
            const u = new URL(req.url, 'http://localhost')
            ;(req as any).query = Object.fromEntries(u.searchParams.entries())
          } catch {
            ;(req as any).query = {}
          }

          // Express-style helpers paa res.
          const r = res as any
          r.status = (code: number) => { res.statusCode = code; return r }
          r.json = (data: any) => {
            if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
            return r
          }
          r.send = (data: any) => {
            if (typeof data === 'string' || Buffer.isBuffer(data)) {
              res.end(data)
            } else {
              if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            }
            return r
          }
          r.setHeader = res.setHeader.bind(res)

          const t0 = Date.now()
          console.log(`[dev-api] -> ${req.method} /api/${path}`)
          await handler(req, r)
          console.log(`[dev-api] <- ${res.statusCode} /api/${path} (${Date.now() - t0}ms)`)
        } catch (err: any) {
          console.error(`[dev-api] /api/${path} feilet:`, err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Dev API-handler feilet', detail: String(err?.message || err) }))
          }
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Last *alle* env vars (ikke bare VITE_*) inn i process.env saa server-side
  // /api/*-endepunkter kan lese PAGESPEED_API_KEY, OPENAI_API_KEY osv. fra
  // .env.local i dev — slik Vercel ville gjort i produksjon.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }

  return {
    plugins: [react(), viteApiPlugin()],
  }
})
