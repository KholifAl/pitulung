/**
 * Proxy AI Pitulung (berjalan di sisi server / Vite middleware)
 *
 * Kenapa lewat server?
 * - API key milik server TIDAK PERNAH dikirim ke browser.
 * - Key milik pengguna (opsional) hanya diteruskan per-request, tidak disimpan / dicatat.
 * - Menghindari masalah CORS (Claude & beberapa provider memblokir panggilan langsung dari browser).
 * - Ada batas laju (rate limit) & batas ukuran input agar kuota tidak disalahgunakan.
 */

import { Buffer } from 'node:buffer'

export const PROVIDER_DEFAULTS = {
  openai: { model: 'gpt-6-luna', envKey: 'OPENAI_API_KEY' },
  gemini: { model: 'gemini-3.8-flash', envKey: 'GEMINI_API_KEY' },
  claude: { model: 'claude-haiku-5-5', envKey: 'ANTHROPIC_API_KEY' },
  openclaw: { model: 'openclaw:main', envKey: 'OPENCLAW_API_KEY' },
}

// Model non-teks yang tidak cocok untuk merapikan data (gambar, suara, embedding, dll.)
const NON_CHAT_MODEL_PATTERN =
  /(embed|embedding|image|imagen|veo|tts|audio|speech|transcribe|whisper|realtime|live|dall-e|moderation|search|aqa|computer-use|robotics)/i

const MAX_BODY_BYTES = 12 * 1024 * 1024
const MAX_INPUT_CHARS = 55000
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 30
const REQUEST_TIMEOUT_MS = 55000

const rateBuckets = new Map()

function getQuotaStatus(ip, recordHit = false) {
  const now = Date.now()
  const bucket = rateBuckets.get(ip) || []
  const recent = bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recordHit) {
    recent.push(now)
  }
  rateBuckets.set(ip, recent)
  const used = recent.length
  const remaining = Math.max(0, RATE_LIMIT_MAX - used)
  const limited = used > RATE_LIMIT_MAX
  const status = limited || remaining === 0 ? 'exhausted' : remaining <= 5 ? 'warning' : 'safe'
  return { limited, remaining, max: RATE_LIMIT_MAX, status }
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Permintaan terlalu besar.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Format permintaan tidak valid.'))
      }
    })
    req.on('error', reject)
  })
}

function resolveApiKey(provider, userKey, env) {
  const clean = typeof userKey === 'string' ? userKey.trim() : ''
  if (clean) return clean
  return env[PROVIDER_DEFAULTS[provider].envKey] || ''
}

function resolveOpenclawUrl(baseUrl, env) {
  const raw = (baseUrl || env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789').trim()
  if (!/^https?:\/\//i.test(raw)) throw new Error('URL OpenClaw harus diawali http:// atau https://')
  return raw.replace(/\/+$/, '')
}

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function readProviderError(res) {
  try {
    const data = await res.json()
    return data?.error?.message || data?.message || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

/** Adapter per provider: semua mengembalikan string teks jawaban AI */
async function callProvider({ provider, model, apiKey, baseUrl, system, input, attachment }) {
  const hasBinaryAttachment = Boolean(attachment?.base64 && attachment?.mimeType)

  if (provider === 'openai' || provider === 'openclaw') {
    const url =
      provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : `${baseUrl}/v1/chat/completions`

    let userContent = input
    if (hasBinaryAttachment && /^image\//i.test(attachment.mimeType)) {
      userContent = [
        { type: 'text', text: input },
        {
          type: 'image_url',
          image_url: { url: `data:${attachment.mimeType};base64,${attachment.base64}` },
        },
      ]
    }

    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }
    if (provider === 'openai') body.response_format = { type: 'json_object' }

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await readProviderError(res))
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || ''
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    const parts = [{ text: input }]
    if (
      hasBinaryAttachment &&
      (/^(image\/|application\/pdf)/i.test(attachment.mimeType))
    ) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.base64,
        },
      })
    }

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.15 },
      }),
    })
    if (!res.ok) throw new Error(await readProviderError(res))
    const data = await res.json()
    return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  }

  if (provider === 'claude') {
    let userContent = input
    if (hasBinaryAttachment) {
      if (/^image\//i.test(attachment.mimeType)) {
        userContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: attachment.mimeType,
              data: attachment.base64,
            },
          },
          { type: 'text', text: input },
        ]
      } else if (attachment.mimeType === 'application/pdf') {
        userContent = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: attachment.base64,
            },
          },
          { type: 'text', text: input },
        ]
      }
    }

    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) throw new Error(await readProviderError(res))
    const data = await res.json()
    return (data?.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
  }

  throw new Error('Provider AI tidak dikenal.')
}

/** Ambil daftar model terbaru langsung dari provider */
async function listProviderModels({ provider, apiKey, baseUrl }) {
  if (provider === 'gemini') {
    const res = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      { headers: { 'x-goog-api-key': apiKey } },
      8000
    )
    if (!res.ok) throw new Error(await readProviderError(res))
    const data = await res.json()
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => ({ id: String(m.name || '').replace(/^models\//, ''), label: m.displayName || '' }))
      .filter((m) => m.id.startsWith('gemini') && !NON_CHAT_MODEL_PATTERN.test(m.id))
  }

  if (provider === 'openai') {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/models',
      { headers: { Authorization: `Bearer ${apiKey}` } },
      8000
    )
    if (!res.ok) throw new Error(await readProviderError(res))
    const data = await res.json()
    return (data.data || [])
      .filter((m) => /^(gpt-|o\d|chatgpt-)/i.test(m.id) && !NON_CHAT_MODEL_PATTERN.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .map((m) => ({ id: m.id, label: '' }))
  }

  if (provider === 'claude') {
    const res = await fetchWithTimeout(
      'https://api.anthropic.com/v1/models?limit=100',
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } },
      8000
    )
    if (!res.ok) throw new Error(await readProviderError(res))
    const data = await res.json()
    return (data.data || []).map((m) => ({ id: m.id, label: m.display_name || '' }))
  }

  if (provider === 'openclaw') {
    const res = await fetchWithTimeout(
      `${baseUrl}/v1/models`,
      { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} },
      3000
    )
    if (!res.ok) throw new Error(await readProviderError(res))
    const data = await res.json()
    return (data.data || []).map((m) => ({ id: m.id, label: '' }))
  }

  return []
}

export function createAiMiddlewares(env) {
  /** GET /api/ai/status?provider=gemini&baseUrl=... */
  async function statusHandler(req, res) {
    try {
      const ip = req.socket?.remoteAddress || 'unknown'
      const quota = getQuotaStatus(ip, false)
      const url = new URL(req.url, 'http://localhost')
      const provider = url.searchParams.get('provider') || 'local'
      const hasUserKey = url.searchParams.get('userKey') === '1'

      if (provider === 'local') {
        return sendJson(res, 200, { online: false, serverKey: false, quotaStatus: quota.status })
      }
      if (!PROVIDER_DEFAULTS[provider]) return sendJson(res, 400, { error: 'Provider tidak dikenal.' })

      const serverKey = Boolean(env[PROVIDER_DEFAULTS[provider].envKey])

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
          return sendJson(res, 200, { online: ping.ok, serverKey, quotaStatus: quota.status })
        } catch {
          return sendJson(res, 200, { online: false, serverKey, quotaStatus: quota.status })
        }
      }

      return sendJson(res, 200, { online: serverKey || hasUserKey, serverKey, quotaStatus: quota.status })
    } catch (err) {
      return sendJson(res, 200, { online: false, serverKey: false, quotaStatus: 'safe', error: err.message })
    }
  }

  /** POST /api/ai/chat  { provider, model, apiKey?, baseUrl?, system, input } */
  async function chatHandler(req, res) {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Gunakan metode POST.' })

    const ip = req.socket?.remoteAddress || 'unknown'
    const quota = getQuotaStatus(ip, true)
    if (quota.limited) {
      return sendJson(res, 429, {
        ok: false,
        quotaStatus: 'exhausted',
        error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.',
      })
    }

    try {
      const body = await readJsonBody(req)
      const provider = String(body.provider || '')
      if (!PROVIDER_DEFAULTS[provider]) return sendJson(res, 400, { ok: false, error: 'Provider AI tidak dikenal.' })

      const input = String(body.input || '').slice(0, MAX_INPUT_CHARS)
      const system = String(body.system || '').slice(0, 6000)
      if (!input.trim()) return sendJson(res, 400, { ok: false, error: 'Input kosong.' })

      const apiKey = resolveApiKey(provider, body.apiKey, env)
      if (!apiKey && provider !== 'openclaw') {
        return sendJson(res, 400, {
          ok: false,
          error: 'API key belum tersedia. Isi key milikmu atau minta admin mengisi key server.',
        })
      }

      const model = String(body.model || '').trim() || PROVIDER_DEFAULTS[provider].model
      const baseUrl = provider === 'openclaw' ? resolveOpenclawUrl(body.baseUrl, env) : undefined
      const attachment =
        body.attachment && typeof body.attachment === 'object'
          ? {
              mimeType: String(body.attachment.mimeType || ''),
              base64: String(body.attachment.base64 || ''),
            }
          : undefined

      const text = await callProvider({ provider, model, apiKey, baseUrl, system, input, attachment })
      return sendJson(res, 200, { ok: true, text, model, quotaStatus: quota.status })
    } catch (err) {
      const message = err.name === 'AbortError' ? 'AI terlalu lama merespons.' : err.message
      const isQuotaErr = /quota|rate\s*limit|429|resource_exhausted|insufficient_quota|terlalu banyak/i.test(
        String(message || '')
      )
      return sendJson(res, 200, {
        ok: false,
        quotaStatus: isQuotaErr ? 'exhausted' : quota.status,
        error: message || 'Gagal menghubungi AI.',
      })
    }
  }

  /** POST /api/ai/models  { provider, apiKey?, baseUrl? } -> daftar model live */
  async function modelsHandler(req, res) {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Gunakan metode POST.' })
    try {
      const body = await readJsonBody(req)
      const provider = String(body.provider || '')
      if (!PROVIDER_DEFAULTS[provider]) return sendJson(res, 400, { ok: false, error: 'Provider tidak dikenal.' })

      const apiKey = resolveApiKey(provider, body.apiKey, env)
      if (!apiKey && provider !== 'openclaw') {
        return sendJson(res, 200, { ok: false, error: 'Butuh API key untuk mengambil daftar model.' })
      }
      const baseUrl = provider === 'openclaw' ? resolveOpenclawUrl(body.baseUrl, env) : undefined
      const models = await listProviderModels({ provider, apiKey, baseUrl })
      return sendJson(res, 200, { ok: true, models })
    } catch (err) {
      return sendJson(res, 200, { ok: false, error: err.message || 'Gagal mengambil daftar model.' })
    }
  }

  return { statusHandler, chatHandler, modelsHandler }
}
