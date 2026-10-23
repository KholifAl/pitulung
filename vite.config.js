import { Buffer } from 'node:buffer'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createAiMiddlewares } from './server/aiProxy.js'
import { extractTextFromPdfBuffer } from './server/docParser.js'

function decodeHtmlEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(html = '') {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
}

function parseWebpageHtml(html, targetUrl) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)

  const pageTitle = decodeHtmlEntities(ogTitleMatch?.[1] || titleMatch?.[1] || targetUrl)
  const pageDesc = decodeHtmlEntities(descMatch?.[1] || '')

  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')

  // Ekstrak seluruh tabel HTML utuh (beserta header & barisnya)
  const tables = []
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let tblMatch
  while ((tblMatch = tableRegex.exec(cleanHtml)) !== null && tables.length < 8) {
    const tblHtml = tblMatch[1]
    const captionMatch = tblHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)
    const tableTitle = captionMatch ? stripTags(captionMatch[1]) : `Tabel #${tables.length + 1}`

    const allRows = []
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rMatch
    while ((rMatch = rowRegex.exec(tblHtml)) !== null && allRows.length < 60) {
      const rowCells = []
      const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi
      let cMatch
      let isHeaderRow = false
      while ((cMatch = cellRegex.exec(rMatch[1])) !== null) {
        if (cMatch[1].toLowerCase() === 'th') isHeaderRow = true
        const val = stripTags(cMatch[2]).replace(/\[\d+\]/g, '').trim()
        rowCells.push(val || '-')
      }
      if (rowCells.filter((c) => c && c !== '-').length >= 2) {
        allRows.push({ isHeaderRow, cells: rowCells })
      }
    }

    if (allRows.length >= 2) {
      const maxCols = Math.min(
        8,
        Math.max(...allRows.slice(0, 10).map((r) => r.cells.length))
      )
      if (maxCols >= 2) {
        const firstRow = allRows[0]
        const columns = firstRow.isHeaderRow
          ? Array.from({ length: maxCols }, (_, i) => firstRow.cells[i] || `Kolom ${i + 1}`)
          : Array.from({ length: maxCols }, (_, i) => `Kolom ${i + 1}`)
        const dataRows = (firstRow.isHeaderRow ? allRows.slice(1) : allRows)
          .filter((r) => r.cells.length >= 2)
          .slice(0, 45)
          .map((r) => Array.from({ length: maxCols }, (_, i) => (r.cells[i] ?? '-').slice(0, 160)))

        if (dataRows.length >= 1) {
          tables.push({ title: tableTitle, columns, rows: dataRows })
        }
      }
    }
  }

  const items = []

  // 1. Jika ada tabel, masukkan juga ringkasannya ke items
  if (tables.length > 0) {
    const primary = tables[0]
    primary.rows.slice(0, 15).forEach((r) => {
      items.push({
        type: primary.title,
        title: r[0] || '-',
        value: r[1] || '-',
        extra: r.slice(2).join(' | ').slice(0, 120) || primary.columns.slice(0, 2).join(' → '),
      })
    })
  }

  // 2. Ekstrak bagian dokumen (Heading + Paragraf di bawahnya)
  const sections = []
  const blockRegex = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>/gi
  let bMatch
  let currentHeading = 'Ringkasan Utama'
  while ((bMatch = blockRegex.exec(cleanHtml)) !== null && sections.length < 45) {
    const tag = bMatch[1].toLowerCase()
    const text = stripTags(bMatch[2]).replace(/\[\d+\]/g, '').trim()
    if (!text || text.length < 4) continue
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      if (text.length < 160) {
        currentHeading = text
        if (items.length < 25) {
          items.push({
            type: `Bagian (${tag.toUpperCase()})`,
            title: text,
            value: 'Sub-bab Halaman',
            extra: 'Struktur Dokumen Web',
          })
        }
      }
    } else if (text.length >= 25 && text.length <= 600) {
      sections.push({ heading: currentHeading, text })
      if (items.length < 25) {
        items.push({
          type: currentHeading.slice(0, 40),
          title: text.slice(0, 90) + (text.length > 90 ? '...' : ''),
          value: text.slice(0, 240),
          extra: `Kutipan bagian "${currentHeading.slice(0, 30)}"`,
        })
      }
    }
  }

  // 3. Cari pola harga Rupiah / USD di halaman
  const priceRegex = /(?:Rp\.?\s?[0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]{2})?|\$[0-9]+(?:\.[0-9]{2})?)/gi
  const pricesFound = [...new Set(cleanHtml.match(priceRegex) || [])].slice(0, 15)
  pricesFound.forEach((price, idx) => {
    items.push({
      type: 'Harga Terdeteksi',
      title: `Nominal Harga #${idx + 1}`,
      value: price,
      extra: 'Ditemukan di halaman',
    })
  })

  return {
    pageTitle,
    pageDesc,
    pricesFound,
    tables,
    sections,
    items: items.slice(0, 30),
  }
}

function pitulungServerPlugin(env) {
  return {
    name: 'pitulung-api-middleware',
    configureServer(server) {
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefix '' = baca semua variabel .env di sisi server saja.
  // Hanya variabel berawalan VITE_ yang ikut ke browser, jadi key AI tetap rahasia.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return {
    plugins: [react(), pitulungServerPlugin(env)],
  }
})
