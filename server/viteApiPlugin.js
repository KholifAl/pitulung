import { Buffer } from 'node:buffer'
import process from 'node:process'
import { loadEnv } from 'vite'
import { createAiMiddlewares } from './aiProxy.js'
import { extractTextFromPdfBuffer } from './docParser.js'
import { parseWebpageHtml } from './webExtractor.js'

export function tinulungServerPlugin() {
  return {
    name: 'tinulung-api-middleware',
    configureServer(server) {
      const mode = server.config.mode || 'development'
      const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
      const ai = createAiMiddlewares(env)
      server.middlewares.use('/api/ai/status', ai.statusHandler)
      server.middlewares.use('/api/ai/chat', ai.chatHandler)
      server.middlewares.use('/api/ai/models', ai.modelsHandler)

      server.middlewares.use('/api/parse-doc', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Gunakan metode POST' }))
          return
        }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 12 * 1024 * 1024) throw new Error('Ukuran dokumen maksimal 10 MB.')
            chunks.push(chunk)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const base64 = String(body.base64 || '')
          const fileName = String(body.fileName || 'dokumen')
          if (!base64) throw new Error('Data dokumen kosong.')

          const buf = Buffer.from(base64, 'base64')
          const text = extractTextFromPdfBuffer(buf)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: true,
              fileName,
              text: text || '',
              charCount: text.length,
            })
          )
        } catch (err) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: err.message || 'Gagal membaca dokumen.' }))
        }
      })

      server.middlewares.use('/api/extract', async (req, res) => {
        try {
          const urlObj = new URL(req.url, 'http://localhost')
          const targetUrl = urlObj.searchParams.get('url')

          if (!targetUrl) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Parameter url diperlukan' }))
            return
          }

          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000)

          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
              'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            signal: controller.signal,
          })
          clearTimeout(timeout)

          const contentType = response.headers.get('content-type') || ''
          const rawBody = await response.text()

          if (contentType.includes('application/json')) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: true,
                isJson: true,
                url: targetUrl,
                status: response.status,
                data: JSON.parse(rawBody),
              })
            )
            return
          }

          const parsed = parseWebpageHtml(rawBody, targetUrl)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: true,
              url: targetUrl,
              status: response.status,
              ...parsed,
            })
          )
        } catch (err) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: false,
              error: err.message || 'Gagal membaca halaman target',
            })
          )
        }
      })
    },
  }
}
