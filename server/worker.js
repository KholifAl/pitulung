import { Buffer } from 'node:buffer'
import {
  MAX_INPUT_CHARS,
  PROVIDER_DEFAULTS,
  callProvider,
  fetchWithTimeout,
  getQuotaStatus,
  listProviderModels,
  resolveApiKey,
  resolveOpenclawUrl,
} from './aiProxy.js'
import { extractTextFromPdfBuffer } from './docParser.js'
import { parseWebpageHtml } from './webExtractor.js'

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'

    if (pathname === '/api/ai/status') {
      try {
        const quota = getQuotaStatus(ip, false)
        const provider = url.searchParams.get('provider') || 'local'
        const hasUserKey = url.searchParams.get('userKey') === '1'

        if (provider === 'local') {
          return jsonResponse({ online: false, serverKey: false, quotaStatus: quota.status })
        }
        if (!PROVIDER_DEFAULTS[provider]) {
          return jsonResponse({ error: 'Provider tidak dikenal.' }, 400)
        }

        const serverKey = Boolean(env?.[PROVIDER_DEFAULTS[provider].envKey])

        if (provider === 'openclaw') {
          const base = resolveOpenclawUrl(url.searchParams.get('baseUrl'), env)
          try {
            const ping = await fetchWithTimeout(
              `${base}/v1/models`,
              {
                headers: serverKey
                  ? { Authorization: `Bearer ${env.OPENCLAW_API_KEY}` }
                  : { Accept: 'application/json' },
              },
              1500
            )
            return jsonResponse({ online: ping.ok, serverKey, quotaStatus: quota.status })
          } catch {
            return jsonResponse({ online: false, serverKey, quotaStatus: quota.status })
          }
        }

        return jsonResponse({
          online: serverKey || hasUserKey,
          serverKey,
          quotaStatus: quota.status,
        })
      } catch (err) {
        return jsonResponse({
          online: false,
          serverKey: false,
          quotaStatus: 'safe',
          error: err.message,
        })
      }
    }

    if (pathname === '/api/ai/chat') {
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Gunakan metode POST.' }, 405)
      }

      const quota = getQuotaStatus(ip, true)
      if (quota.limited) {
        return jsonResponse(
          {
            ok: false,
            quotaStatus: 'exhausted',
            error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.',
          },
          429
        )
      }

      try {
        const body = await request.json()
        const provider = String(body.provider || '')
        if (!PROVIDER_DEFAULTS[provider]) {
          return jsonResponse({ ok: false, error: 'Provider AI tidak dikenal.' }, 400)
        }

        const input = String(body.input || '').slice(0, MAX_INPUT_CHARS)
        const system = String(body.system || '').slice(0, 6000)
        if (!input.trim()) {
          return jsonResponse({ ok: false, error: 'Input kosong.' }, 400)
        }

        const apiKey = resolveApiKey(provider, body.apiKey, env)
        if (!apiKey && provider !== 'openclaw') {
          return jsonResponse(
            {
              ok: false,
              error: 'API key belum tersedia. Isi key milikmu atau minta admin mengisi key server.',
            },
            400
          )
        }

        const model = String(body.model || '').trim() || PROVIDER_DEFAULTS[provider].model
        const baseUrl =
          provider === 'openclaw' ? resolveOpenclawUrl(body.baseUrl, env) : undefined
        const attachment =
          body.attachment && typeof body.attachment === 'object'
            ? {
                mimeType: String(body.attachment.mimeType || ''),
                base64: String(body.attachment.base64 || ''),
              }
            : undefined

        const text = await callProvider({
          provider,
          model,
          apiKey,
          baseUrl,
          system,
          input,
          attachment,
        })
        return jsonResponse({ ok: true, text, model, quotaStatus: quota.status })
      } catch (err) {
        const message = err.name === 'AbortError' ? 'AI terlalu lama merespons.' : err.message
        const isQuotaErr = /quota|rate\s*limit|429|resource_exhausted|insufficient_quota|terlalu banyak/i.test(
          String(message || '')
        )
        return jsonResponse({
          ok: false,
          quotaStatus: isQuotaErr ? 'exhausted' : quota.status,
          error: message || 'Gagal menghubungi AI.',
        })
      }
    }

    if (pathname === '/api/ai/models') {
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Gunakan metode POST.' }, 405)
      }
      try {
        const body = await request.json()
        const provider = String(body.provider || '')
        if (!PROVIDER_DEFAULTS[provider]) {
          return jsonResponse({ ok: false, error: 'Provider tidak dikenal.' }, 400)
        }

        const apiKey = resolveApiKey(provider, body.apiKey, env)
        if (!apiKey && provider !== 'openclaw') {
          return jsonResponse({ ok: false, error: 'Butuh API key untuk mengambil daftar model.' })
        }
        const baseUrl =
          provider === 'openclaw' ? resolveOpenclawUrl(body.baseUrl, env) : undefined
        const models = await listProviderModels({ provider, apiKey, baseUrl })
        return jsonResponse({ ok: true, models })
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'Gagal mengambil daftar model.' })
      }
    }

    if (pathname === '/api/parse-doc') {
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Gunakan metode POST' }, 405)
      }
      try {
        const body = await request.json()
        const base64 = String(body.base64 || '')
        const fileName = String(body.fileName || 'dokumen')
        if (!base64) throw new Error('Data dokumen kosong.')

        const buf = Buffer.from(base64, 'base64')
        const text = extractTextFromPdfBuffer(buf)
        return jsonResponse({
          ok: true,
          fileName,
          text: text || '',
          charCount: text.length,
        })
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'Gagal membaca dokumen.' })
      }
    }

    if (pathname === '/api/extract') {
      try {
        const targetUrl = url.searchParams.get('url')
        if (!targetUrl) {
          return jsonResponse({ error: 'Parameter url diperlukan' }, 400)
        }

        const response = await fetchWithTimeout(
          targetUrl,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
              'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            },
          },
          8000
        )

        const contentType = response.headers.get('content-type') || ''
        const rawBody = await response.text()

        if (contentType.includes('application/json')) {
          return jsonResponse({
            ok: true,
            isJson: true,
            url: targetUrl,
            status: response.status,
            data: JSON.parse(rawBody),
          })
        }

        const parsed = parseWebpageHtml(rawBody, targetUrl)
        return jsonResponse({
          ok: true,
          url: targetUrl,
          status: response.status,
          ...parsed,
        })
      } catch (err) {
        return jsonResponse({
          ok: false,
          error: err.message || 'Gagal membaca halaman target',
        })
      }
    }

    if (env?.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request)
      if (assetRes.status === 404 && !pathname.startsWith('/api/')) {
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
      }
      return assetRes
    }

    return new Response('Not Found', { status: 404 })
  },
}
