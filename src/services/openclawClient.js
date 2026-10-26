/**
 * Engine Pemroses Pitulung — OpenClaw Document Intelligence & Web/Data Extractor
 * 1. Tanya Jawab Pintar & Ekstraksi Tabel Berbasis Dokumen Terverifikasi (PDF, CSV, TXT, MD, JSON, HTML, Gambar Nota)
 * 2. Ekstraksi Tabel & Konten Web Nyata (OpenClaw Web Reader via /api/extract)
 * 3. Rekap Multi-Order WA, Nota & Catatan Kas Terstruktur (Batch NLP & Kalkulasi Otomatis)
 *
 * Catatan keamanan: browser TIDAK PERNAH memanggil provider AI secara langsung.
 * Semua permintaan lewat server (/api/ai/*), sehingga API key tetap aman.
 */

export const AI_PROVIDERS = [
  { id: 'local', label: 'Bawaan (Instan, tanpa AI)', defaultModel: '', needsKey: false, models: [] },
  {
    id: 'openclaw',
    label: 'OpenClaw (Server Lokal)',
    defaultModel: 'openclaw:main',
    needsKey: false,
    models: [
      { id: 'openclaw:main', label: 'openclaw:main', note: 'Agen utama (disarankan)' },
      { id: 'openclaw:fast', label: 'openclaw:fast', note: 'Mode instan & ringan' },
      { id: 'llama3.3:latest', label: 'Llama 3.3 Latest', note: 'Model lokal' },
      { id: 'qwen3:latest', label: 'Qwen 3 Latest', note: 'Ekstraksi dokumen & tabel' },
      { id: 'deepseek-r1:latest', label: 'DeepSeek R1', note: 'Penalaran mendalam' },
    ],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-3.8-flash',
    needsKey: true,
    keyHint: 'AIza...',
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: 'Cepat & hemat (disarankan)' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon', note: 'Flagship terbaru, penalaran tinggi' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: 'Paling cepat & super hemat' },
      { id: 'gemini-flash-latest', label: 'Gemini Flash (Terbaru Otomatis)', note: 'Selalu versi Flash terbaru' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', note: 'Analisis dokumen mendalam' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Generasi 2.5 stabil' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Penalaran generasi 2.5' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI ChatGPT',
    defaultModel: 'gpt-6-luna',
    needsKey: true,
    keyHint: 'sk-...',
    models: [
      { id: 'gpt-6-luna', label: 'GPT-6 Luna', note: 'Cepat & hemat (disarankan)' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', note: 'Seimbang & serbaguna' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra', note: 'Flagship paling pintar' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', note: 'Ringan & responsif' },
      { id: 'gpt-5', label: 'GPT-5', note: 'Standar generasi 5' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', note: 'Ekonomis generasi 4.1' },
    ],
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    defaultModel: 'claude-haiku-5-5',
    needsKey: true,
    keyHint: 'sk-ant-...',
    models: [
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Cepat & hemat (disarankan)' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Seimbang & pintar' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Penalaran mendalam' },
      { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', note: 'Flagship analisis kompleks' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', note: 'Generasi 4.5 stabil' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Ringan generasi 4.5' },
    ],
  },
]

const RETIRED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gpt-4o-mini',
  'gpt-4o',
  'claude-sonnet-4-20250514',
])

export const DEFAULT_ENGINE_CONFIG = {
  provider: 'local',
  model: '',
  baseUrl: 'http://127.0.0.1:18789',
  apiKey: '',
}

export function getProviderMeta(providerId) {
  return AI_PROVIDERS.find((p) => p.id === providerId) || AI_PROVIDERS[0]
}

export function migrateEngineConfig(config) {
  const meta = getProviderMeta(config.provider)
  if (!config.model || RETIRED_MODELS.has(config.model)) {
    return { ...config, model: meta.defaultModel }
  }
  return config
}

export async function fetchProviderModels(config) {
  const meta = getProviderMeta(config.provider)
  if (meta.id === 'local') return { models: [], source: 'none' }

  try {
    const res = await fetch('/api/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: meta.id,
        apiKey: config.apiKey || undefined,
        baseUrl: meta.id === 'openclaw' ? config.baseUrl : undefined,
      }),
    })
    const data = await res.json()
    if (data.ok && Array.isArray(data.models) && data.models.length) {
      const curated = meta.models
      const curatedIds = new Set(curated.map((m) => m.id))
      const rest = data.models
        .filter((m) => !curatedIds.has(m.id))
        .map((m) => ({ id: m.id, label: m.label || m.id, note: '' }))
      return { models: [...curated, ...rest], source: 'live' }
    }
    return { models: meta.models, source: 'fallback', reason: data.error || '' }
  } catch (err) {
    return { models: meta.models, source: 'fallback', reason: err.message }
  }
}

/**
 * Contoh dokumen kontrak & RAB terverifikasi untuk demo instan fitur Tanya Jawab Dokumen
 */
export const SAMPLE_VERIFIED_DOC = {
  name: 'Kontrak_RAB_Pengadaan_Kopi_Nusantara_2026.pdf',
  size: 48200,
  mimeType: 'application/pdf',
  docType: 'PDF Terverifikasi',
  isSample: true,
  text: `[PASAL 1 - OBJEK KONTRAK & VENDOR]
Nomor Kontrak: PKS/2026/IV/089
Tanggal Efektif: 12 Oktober 2026
Pihak Pertama: PT Pitulung Niaga Digital (Pembeli)
Pihak Kedua: Koperasi Produsen Kopi Gayo Mandiri (Vendor Utama)
Nilai Total Kontrak: Rp 148.500.000 (Seratus Empat Puluh Delapan Juta Lima Ratus Ribu Rupiah) sudah termasuk PPN 11%.

[PASAL 2 - RINCIAN ANGGARAN BELANJA (RAB) & SPESIFIKASI BARANG]
Item 1 | Arabika Gayo Specialty Grade 1 | Kuantitas: 500 Kg | Harga Satuan: Rp 135.000/Kg | Subtotal: Rp 67.500.000 | Gudang Tujuan: Bandung
Item 2 | Robusta Temanggung Fine Grade | Kuantitas: 600 Kg | Harga Satuan: Rp 75.000/Kg | Subtotal: Rp 45.000.000 | Gudang Tujuan: Surabaya
Item 3 | Liberika Rangsang Riau | Kuantitas: 200 Kg | Harga Satuan: Rp 110.000/Kg | Subtotal: Rp 22.000.000 | Gudang Tujuan: Jakarta
Item 4 | Kemasan Valve Foil 1Kg (Food Grade) | Kuantitas: 2.000 Pcs | Harga Satuan: Rp 7.000/Pcs | Subtotal: Rp 14.000.000 | Gudang Tujuan: Bandung

[PASAL 3 - JADWAL PENGIRIMAN & TERMIN PEMBAYARAN]
Termin 1 (Uang Muka / DP 30%): Sebesar Rp 44.550.000 dibayarkan maksimal 3 hari kerja setelah kontrak ditandatangani.
Termin 2 (Pengiriman Tahap I - 50%): Sebesar Rp 74.250.000 dibayarkan setelah barang tiba di Gudang Bandung & Surabaya disertai Berita Acara Serah Terima (BAST) paling lambat 25 Oktober 2026.
Termin 3 (Pelunasan 20%): Sebesar Rp 29.700.000 dibayarkan setelah uji kualitas (cupping score minimal 84.5) dinyatakan lulus oleh tim QC paling lambat 5 November 2026.

[PASAL 4 - STANDAR MUTU & DENDA KETERLAMBATAN]
1. Kadar air biji kopi wajib berada pada rentang 11% - 12,5% dengan defect maksimal 3%.
2. Apabila Pihak Kedua terlambat mengirimkan barang melewati batas waktu 25 Oktober 2026, maka dikenakan denda keterlambatan sebesar 0,2% (nol koma dua persen) per hari dari total nilai kontrak, dengan batas maksimal denda 5% dari nilai kontrak.`,
}

export const PITULUNG_TOOLS = [
  {
    id: 'dokumen',
    badge: 'TANYA DOKUMEN',
    title: 'Tanya & Ekstrak Dokumen',
    shortDesc: 'Upload dokumen (PDF, CSV, TXT, JSON) lalu tanyakan isinya atau ubah jadi tabel.',
    placeholder: 'Tanyakan isi dokumen atau instruksi tabel...',
    sampleInput: 'Apa saja rincian barang di RAB, jadwal termin pembayaran, dan aturan dendanya?',
    defaultFormat: 'Tanya Jawab & Tabel Terverifikasi',
  },
  {
    id: 'toko',
    badge: 'EKSTRAK WEB',
    title: 'Ambil Tabel dari Link Web',
    shortDesc: 'Tarik tabel asli dan daftar data dari link website langsung jadi Excel.',
    placeholder: 'Masukkan link website (https://...) di sini...',
    sampleInput: 'https://id.wikipedia.org/wiki/Kopi_di_Indonesia',
    defaultFormat: 'Ekstrak Tabel Data (.csv / Excel)',
  },
  {
    id: 'teks',
    badge: 'REKAP ORDER',
    title: 'Rekap Chat Orderan WA',
    shortDesc: 'Ubah chat pesanan pelanggan jadi tabel Nama, HP, Alamat, dan Total Harga.',
    placeholder: 'Tempel chat orderan WhatsApp di sini...',
    sampleInput: `1. Pesan Arabika Gayo 2 bungkus, Drip Bag 3 box kirim ke Jl. Merdeka No 12 Bandung an Budi Santoso (081234567890) via JNE Reguler Total Rp 245.000
2. Kak mau order Robusta Gold 4 pack sama Gula Aren 2 botol ke Jl. Diponegoro No 88 Surabaya a.n Siti Aminah 085711223344 pakai SiCepat ya Rp 310.000
3. Order Cold Brew 5 botol kirim ke Kemang Raya No 5 Jakarta Selatan atas nama Andi Wijaya (081399887766) via GoSend Instant Rp 175.000`,
    defaultFormat: 'Ekstrak Tabel Data (.csv / Excel)',
  },
]

export async function checkEngineStatus(config = DEFAULT_ENGINE_CONFIG) {
  const provider = config.provider || 'local'
  if (provider === 'local') return { online: false, serverKey: false, quotaStatus: 'safe' }

  try {
    const params = new URLSearchParams({ provider, userKey: config.apiKey ? '1' : '0' })
    if (provider === 'openclaw' && config.baseUrl) params.set('baseUrl', config.baseUrl)
    const res = await fetch(`/api/ai/status?${params}`)
    const data = await res.json()
    return {
      online: Boolean(data.online),
      serverKey: Boolean(data.serverKey),
      quotaStatus: data.quotaStatus || 'safe',
    }
  } catch {
    return { online: false, serverKey: false, quotaStatus: 'safe' }
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Membaca file yang diupload pengguna (PDF, CSV, TSV, JSON, TXT, MD, HTML, atau Gambar)
 */
export async function readUploadedDocument(file) {
  if (!file) throw new Error('File tidak ditemukan.')
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Ukuran dokumen maksimal 10 MB.')
  }

  const name = file.name || 'dokumen'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const mimeType = file.type || 'application/octet-stream'

  // 1. Jika PDF: ekstrak teks via server /api/parse-doc sekaligus simpan base64 untuk multimodal AI
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const buf = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(buf)
    let extractedText = ''
    try {
      const res = await fetch('/api/parse-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: name, mimeType: 'application/pdf', base64 }),
      })
      const data = await res.json()
      if (data.ok && data.text) {
        extractedText = data.text
      }
    } catch {
      // Lanjut dengan multimodal base64 jika server parser gagal
    }

    return {
      name,
      size: file.size,
      mimeType: 'application/pdf',
      docType: 'PDF Dokumen',
      text: extractedText,
      base64,
    }
  }

  // 2. Jika Gambar (Nota / Struk / Foto Tabel)
  if (/^image\/(png|jpe?g|webp)/i.test(mimeType) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    const buf = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(buf)
    return {
      name,
      size: file.size,
      mimeType: mimeType.startsWith('image/') ? mimeType : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      docType: 'Gambar / Foto Nota',
      text: `[Dokumen Gambar: ${name} (${Math.round(file.size / 1024)} KB)]`,
      base64,
    }
  }

  // 3. Dokumen berbasis teks (CSV, TSV, JSON, TXT, MD, HTML, XML, LOG)
  const rawText = await file.text()
  const docTypeMap = {
    csv: 'Tabel CSV',
    tsv: 'Tabel TSV',
    json: 'Data JSON',
    md: 'Dokumen Markdown',
    txt: 'Dokumen Teks',
    html: 'Dokumen HTML',
    htm: 'Dokumen HTML',
    xml: 'Dokumen XML',
  }

  return {
    name,
    size: file.size,
    mimeType: mimeType || 'text/plain',
    docType: docTypeMap[ext] || 'Dokumen Teks',
    text: rawText.slice(0, 80000),
    base64: '',
  }
}

const AI_SYSTEM_PROMPT = `Kamu adalah engine "Pitulung OpenClaw" untuk Tanya Jawab Pintar Berbasis Dokumen Terverifikasi & Ekstraksi Tabel Data.
Tugasmu:
1. Jika ada dokumen/data sumber dan pengguna bertanya atau meminta ekstraksi, jawab secara AKURAT hanya berdasarkan fakta di dalam dokumen/sumber (JANGAN mengarang di luar sumber).
2. Ekstrak data menjadi TABEL terstruktur yang paling relevan dengan isi dokumen dan permintaan pengguna.
3. Sertakan bukti kutipan asli dari dokumen pada ` + '`verifiedQuotes`' + ` maupun kolom sumber bila relevan.

Balas HANYA dengan JSON valid (tanpa markdown blok kode, tanpa penjelasan di luar JSON) dengan skema:
{
  "summary": "Ringkasan eksekutif singkat & jelas dalam Bahasa Indonesia (diawali 'Beres!')",
  "answer": "Jawaban lengkap, akurat, dan terverifikasi atas pertanyaan pengguna beserta rujukan pasal/baris/angka dari dokumen.",
  "verifiedQuotes": [
    {"source": "Bagian / Pasal / Baris", "quote": "Kutipan kalimat atau angka persis dari dokumen"}
  ],
  "columns": ["Kolom 1", "Kolom 2", "Kolom 3", "Sumber Terverifikasi"],
  "rows": [
    ["isi 1", "isi 2", "isi 3", "Pasal / Baris #"]
  ]
}
Aturan Penting:
- Semua isi sel di dalam rows wajib bertipe string, dan panjang tiap baris harus sama dengan jumlah columns.
- Maksimal 50 baris.
- Jangan pernah mengarang angka/fakta yang tidak ada di input.`

function extractJsonBlock(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Jawaban AI bukan JSON yang valid.')
  }
}

function normalizeAiTable(parsed) {
  const columns = Array.isArray(parsed?.columns) ? parsed.columns.map(String) : []
  const rawRows = Array.isArray(parsed?.rows) ? parsed.rows : []
  if (!columns.length || !rawRows.length) throw new Error('AI tidak mengembalikan tabel.')

  const rows = rawRows.slice(0, 50).map((row) => {
    const arr = Array.isArray(row)
      ? row
      : typeof row === 'object' && row !== null
        ? columns.map((c) => row[c])
        : [row]
    return columns.map((_, i) => (arr[i] === undefined || arr[i] === null ? '-' : String(arr[i])))
  })

  const verifiedQuotes = Array.isArray(parsed?.verifiedQuotes)
    ? parsed.verifiedQuotes
        .filter((q) => q && (q.quote || q.text))
        .slice(0, 6)
        .map((q) => ({
          source: String(q.source || 'Kutipan Dokumen'),
          quote: String(q.quote || q.text || ''),
        }))
    : []

  return {
    summary: String(parsed.summary || `Beres! Berhasil mengekstrak ${rows.length} baris data terverifikasi.`),
    answer: parsed.answer ? String(parsed.answer) : '',
    verifiedQuotes,
    columns,
    rows,
  }
}

async function askAi(config, input, attachment) {
  const meta = getProviderMeta(config.provider)
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: config.provider,
      model: (config.model || '').trim() || meta.defaultModel,
      baseUrl: config.provider === 'openclaw' ? config.baseUrl : undefined,
      apiKey: config.apiKey || undefined,
      system: AI_SYSTEM_PROMPT,
      input,
      attachment:
        attachment?.base64 && attachment?.mimeType
          ? { mimeType: attachment.mimeType, base64: attachment.base64 }
          : undefined,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.ok) {
    const err = new Error(data.error || `Server AI merespons HTTP ${res.status}`)
    err.quotaStatus = data.quotaStatus || (res.status === 429 ? 'exhausted' : undefined)
    throw err
  }
  return {
    ...normalizeAiTable(extractJsonBlock(data.text)),
    aiModel: data.model,
    aiProvider: meta.label,
    quotaStatus: data.quotaStatus || 'safe',
  }
}

/**
 * Parser CSV / TSV akurat (mendukung tanda kutip)
 */
function parseDelimitedLine(line, delimiter = ',') {
  const cells = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

/**
 * Deteksi apakah input pengguna berupa pertanyaan bahasa alami (butuh pemahaman AI)
 * atau sekadar instruksi ekstraksi (bisa ditangani parser lokal dengan akurat).
 */
export function isNaturalQuestion(query = '') {
  const q = String(query).trim().toLowerCase()
  if (!q) return false
  if (/^(ekstrak|ambil|tampilkan|tarik|buat|ubah|rekap|jadikan)\b/.test(q)) return false
  return (
    q.includes('?') ||
    /\b(apa|apakah|berapa|siapa|kapan|bagaimana|gimana|kenapa|mengapa|jelaskan|bisakah|dimana|di mana)\b/.test(q)
  )
}

/**
 * Engine Lokal (Mode Instan): Ekstraksi Dokumen & Pencarian Kata Kunci (Structured Parser)
 * Catatan: mode ini TIDAK memahami pertanyaan seperti AI — hanya mencocokkan kata kunci.
 */
function analyzeVerifiedDocumentLocally(doc, userQuery = '', format = '') {
  const docName = doc.name || 'Dokumen'
  const rawText = (doc.text || '').trim()
  const query = userQuery.trim()

  if (!rawText && doc.base64) {
    return {
      summary: `Dokumen "${docName}" berupa file biner/scan gambar. Hubungkan mesin AI (OpenClaw / Gemini / Claude / OpenAI) di Pengaturan AI untuk membaca dokumen visual ini.`,
      answer: `File "${docName}" memerlukan model AI multimodal atau OCR untuk mengekstrak teks di dalamnya. Silakan pilih mesin AI pada menu Pengaturan AI di bagian bawah halaman.`,
      verifiedQuotes: [],
      columns: ['Nama Dokumen', 'Tipe File', 'Ukuran', 'Status Verifikasi'],
      rows: [[docName, doc.docType || doc.mimeType, `${Math.round((doc.size || 0) / 1024)} KB`, 'Butuh Mesin AI Multimodal']],
    }
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // 1. Cek apakah dokumen adalah CSV / TSV
  const ext = docName.split('.').pop()?.toLowerCase() || ''
  if (ext === 'csv' || ext === 'tsv' || (lines.length >= 2 && lines[0].split(',').length >= 3 && lines[1].split(',').length === lines[0].split(',').length)) {
    const delimiter = ext === 'tsv' || lines[0].includes('\t') ? '\t' : ','
    const headers = parseDelimitedLine(lines[0], delimiter).map((h, i) => h || `Kolom ${i + 1}`)
    const allRows = lines.slice(1).map((line, idx) => ({
      lineNo: idx + 2,
      cells: parseDelimitedLine(line, delimiter),
      raw: line,
    }))

    // Filter baris jika ada pertanyaan spesifik
    const stopWords = new Set(['apa', 'saja', 'yang', 'dari', 'dan', 'di', 'ke', 'untuk', 'pada', 'berapa', 'siapa', 'mana', 'dengan', 'dalam', 'ini', 'itu', 'ekstrak', 'tabel', 'data', 'semua', 'tampilkan', 'cari'])
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w))

    let matchedRows = allRows
    if (keywords.length > 0) {
      const filtered = allRows.filter((r) =>
        keywords.some((kw) => r.raw.toLowerCase().includes(kw))
      )
      if (filtered.length > 0) matchedRows = filtered
    }

    const finalColumns = [...headers, 'Sumber Baris']
    const finalRows = matchedRows.slice(0, 50).map((r) => [
      ...headers.map((_, i) => r.cells[i] ?? '-'),
      `${docName} (Baris #${r.lineNo})`,
    ])

    const verifiedQuotes = matchedRows.slice(0, 3).map((r) => ({
      source: `${docName} • Baris #${r.lineNo}`,
      quote: r.raw.slice(0, 180),
    }))

    return {
      summary: `Beres! Mengekstrak ${finalRows.length} baris data dari dokumen tabel "${docName}".`,
      answer: query
        ? `Dari ${allRows.length} baris di "${docName}", ada ${matchedRows.length} baris yang mengandung kata kunci dari "${query}". Semua nilai disalin langsung dari baris asli dokumen.`
        : `Berhasil memuat dan memverifikasi struktur tabel dari "${docName}" dengan ${headers.length} kolom (${headers.join(', ')}) dan ${allRows.length} baris data.`,
      verifiedQuotes,
      columns: finalColumns,
      rows: finalRows,
    }
  }

  // 2. Cek apakah dokumen adalah JSON
  if (ext === 'json' || (rawText.startsWith('{') || rawText.startsWith('['))) {
    try {
      const parsed = JSON.parse(rawText)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      const sampleObj = arr.find((item) => typeof item === 'object' && item !== null) || {}
      const keys = Object.keys(sampleObj).slice(0, 6)
      if (keys.length > 0) {
        const rows = arr.slice(0, 45).map((item, idx) => [
          ...keys.map((k) =>
            typeof item?.[k] === 'object' ? JSON.stringify(item[k]) : String(item?.[k] ?? '-')
          ),
          `${docName} (Objek #${idx + 1})`,
        ])
        return {
          summary: `Beres! Mengekstrak ${rows.length} objek data dari dokumen JSON "${docName}".`,
          answer: `Dokumen JSON "${docName}" berisi ${arr.length} entri terstruktur dengan atribut: ${keys.join(', ')}.`,
          verifiedQuotes: [
            {
              source: `${docName} • Entri #1`,
              quote: JSON.stringify(arr[0]).slice(0, 180),
            },
          ],
          columns: [...keys, 'Sumber Terverifikasi'],
          rows,
        }
      }
    } catch {
      // Lanjut ke parser dokumen teks terstruktur
    }
  }

  // 3. Parser Dokumen Kontrak / Laporan / RAB / SOP (Pasal, Tabel Pipa `|`, Key-Value, & Klausul)
  const sections = []
  let currentSection = 'Bagian Awal Dokumen'
  lines.forEach((line, idx) => {
    const headerMatch =
      line.match(/^\[(.+)\]$/) ||
      line.match(/^(#{1,4})\s+(.+)$/) ||
      line.match(/^(PASAL\s+\d+[^\n]*|BAB\s+[IVX\d]+[^\n]*)/i)
    if (headerMatch) {
      currentSection = (headerMatch[2] || headerMatch[1]).trim()
    } else {
      sections.push({
        lineNo: idx + 1,
        section: currentSection,
        text: line,
      })
    }
  })

  // Cari baris berformat pipa `|` (seperti tabel RAB atau markdown table)
  const pipeLines = sections.filter(
    (s) => s.text.includes('|') && !/^[\s|:-]+$/.test(s.text)
  )

  // Hitung relevansi tiap baris terhadap pertanyaan pengguna (Verified Q&A Retrieval)
  const stopWords = new Set([
    'apa', 'saja', 'yang', 'dari', 'dan', 'di', 'ke', 'untuk', 'pada', 'berapa',
    'siapa', 'mana', 'dengan', 'dalam', 'ini', 'itu', 'ekstrak', 'tabel', 'data',
    'semua', 'tolong', 'jelaskan', 'bagaimana', 'kapan', 'aturan', 'syarat',
  ])
  const queryKeywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))

  const scoredSections = sections.map((sec) => {
    const hay = `${sec.section} ${sec.text}`.toLowerCase()
    let score = 0
    queryKeywords.forEach((kw) => {
      if (hay.includes(kw)) score += 3
    })
    if (/Rp\.?\s?[0-9]|\d+%|\d+\s*(?:Kg|Pcs|Hari|Juta|Ribu)/i.test(sec.text)) {
      score += 1
    }
    return { ...sec, score }
  })

  const relevant =
    queryKeywords.length > 0 && scoredSections.some((s) => s.score >= 3)
      ? [...scoredSections].filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
      : scoredSections

  // Susun Jawaban Terverifikasi (Verified Answer) dari kutipan paling relevan
  const topEvidence = relevant.slice(0, 5)
  const verifiedQuotes = topEvidence.slice(0, 4).map((ev) => ({
    source: `${docName} • ${ev.section} (Baris #${ev.lineNo})`,
    quote: ev.text,
  }))

  const synthesizedAnswer =
    topEvidence.length > 0
      ? [
          queryKeywords.length > 0
            ? `Bagian "${docName}" yang paling cocok dengan kata kunci kamu:`
            : `Poin penting yang ditemukan di "${docName}":`,
          ...topEvidence.map(
            (ev, i) => `${i + 1}. [${ev.section} — Baris #${ev.lineNo}]: ${ev.text}`
          ),
        ].join('\n')
      : `Dokumen "${docName}" berhasil dibaca (${lines.length} baris).`

  // Jika user meminta ekstraksi tabel murni dan ada tabel pipa (seperti RAB), tampilkan tabel terstruktur
  const wantsPureTable =
    format.includes('Excel') &&
    pipeLines.length >= 2 &&
    (!query || /rab|item|barang|rincian|harga|tabel/i.test(query))

  if (wantsPureTable) {
    const rows = pipeLines.map((p) => {
      const parts = p.text
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
      return [
        parts[0] || '-',
        parts[1] || '-',
        parts[2] || '-',
        parts[3] || '-',
        parts.slice(4).join(' | ') || '-',
        `${p.section} (Baris #${p.lineNo})`,
      ]
    })
    return {
      summary: `Beres! Mengekstrak ${rows.length} baris tabel rincian langsung dari dokumen "${docName}".`,
      answer: synthesizedAnswer,
      verifiedQuotes,
      columns: [
        'Kode / No',
        'Nama Item / Uraian',
        'Kuantitas / Spesifikasi',
        'Harga / Nilai',
        'Subtotal & Keterangan',
        'Sumber Terverifikasi',
      ],
      rows,
    }
  }

  // Tabel komprehensif semua klausul / poin penting dokumen beserta ekstraksi nominal/angka & sumbernya
  const rowsToDisplay = (queryKeywords.length > 0 ? relevant : sections).slice(0, 35)
  const rows = rowsToDisplay.map((sec) => {
    const kvMatch = sec.text.match(/^([^:|]{3,45})\s*[:|]\s*(.+)$/)
    const label = kvMatch ? kvMatch[1].trim() : sec.section
    const content = kvMatch ? kvMatch[2].trim() : sec.text
    const extractedNumbers =
      sec.text
        .match(
          /Rp\.?\s?[0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|\d+(?:[.,]\d+)?\s*(?:%|Kg|Pcs| hari| bulan| tahun)|\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}/gi
        )
        ?.join(', ') || '-'

    return [
      sec.section,
      label,
      content,
      extractedNumbers,
      `${docName} (Baris #${sec.lineNo})`,
    ]
  })

  return {
    summary: `Beres! Mengekstrak ${rows.length} baris teks, angka, dan tanggal penting dari dokumen "${docName}".`,
    answer: synthesizedAnswer,
    verifiedQuotes,
    columns: [
      'Bagian / Pasal',
      'Topik / Klausul',
      'Isi Teks Asli',
      'Angka / Tanggal Kunci',
      'Bukti Sumber',
    ],
    rows,
  }
}

function describeExtractForAi(url, data, userQuery = '') {
  if (data.isJson) {
    return [
      `Sumber URL JSON: ${url}`,
      userQuery ? `Pertanyaan / Instruksi Pengguna: ${userQuery}` : '',
      `Data JSON:\n${JSON.stringify(data.data).slice(0, 18000)}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  const tablesText = (data.tables || [])
    .map(
      (t, idx) =>
        `[Tabel #${idx + 1}: ${t.title}]\nKolom: ${t.columns.join(' | ')}\n` +
        t.rows.map((r) => r.join(' | ')).join('\n')
    )
    .join('\n\n')

  const sectionsText = (data.sections || [])
    .slice(0, 30)
    .map((s, idx) => `[Bagian #${idx + 1} - ${s.heading}]: ${s.text}`)
    .join('\n')

  return [
    `Sumber halaman web: ${url}`,
    `Judul halaman: ${data.pageTitle || '-'}`,
    `Deskripsi: ${data.pageDesc || '-'}`,
    userQuery ? `Pertanyaan / Instruksi Pengguna: ${userQuery}` : '',
    tablesText ? `TABEL ASLI DI HALAMAN WEB:\n${tablesText}` : '',
    sectionsText ? `ISI TEKS HALAMAN WEB:\n${sectionsText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function normalizeUrlAndQuery(rawInput) {
  const trimmed = rawInput.trim()
  const urlMatch = trimmed.match(/https?:\/\/[^\s,)]+/i)
  if (urlMatch) {
    const url = urlMatch[0]
    const extraQuery = trimmed.replace(url, '').replace(/^[\s—:-]+/, '').trim()
    return { url, extraQuery }
  }
  const domainMatch = trimmed.match(
    /^(?:www\.|[a-z0-9-]+\.(?:com|id|co\.id|org|net|io|ai|dev|app|go\.id|ac\.id))(\/[^\s]*)?/i
  )
  if (domainMatch) {
    const url = `https://${domainMatch[0]}`
    const extraQuery = trimmed.slice(domainMatch[0].length).replace(/^[\s—:-]+/, '').trim()
    return { url, extraQuery }
  }
  return { url: null, extraQuery: trimmed }
}

function parseSingleOrderBlock(blockText, index) {
  const clean = blockText.replace(/^\d+[.)\s-]+/, '').trim()
  const phoneMatch = clean.match(/(?:\+62|62|0)8[0-9]{2}[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{3,5}/)
  const nameMatch =
    clean.match(
      /(?:\ba\.?n\.?|\batas\s+nama|\bnama\s*[:=-]?|\bpenerima\s*[:=-]?)\s*([A-Z][a-zA-Z\s.]{1,35}?)(?=\s*(?:\(|,|\.|08|\+62|via|pakai|kirim|ke|alamat|rp|$))/i
    ) || clean.match(/(?:\ba\.?n\.?|\batas\s+nama)\s+([a-zA-Z\s]{2,30})/i)

  const addressMatch = clean.match(
    /(?:kirim\s+ke|alamat\s*[:=-]?|ke\s+(?:jl\.?|jalan|gg\.?|gang|komp\.?|perum)|jl\.?|jalan)\s+([^(\n]+?)(?=\s*(?:\ban\b|\ba\.n\b|\batas\s+nama\b|\bvia\b|\bpakai\b|\(|08|\+62|total|rp|$))/i
  )
  const courierMatch = clean.match(
    /\b(?:via|kurir|ekspedisi|pakai)\s+(JNE\s*\w*|J&T\s*\w*|JNT\s*\w*|SiCepat\s*\w*|AnterAja\s*\w*|GoSend\s*\w*|Grab\s*\w*|Pos\s*\w*|Reguler|Kargo|Instant|Same\s*Day|SPX|Ninja\s*\w*)\b/i
  )
  const priceMatch = clean.match(
    /Rp\.?\s?([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,})(?:,[0-9]{2})?|\b([0-9]+)\s?(rb|ribu|jt|juta)\b/i
  )

  let numericPrice = 0
  let formattedPrice = '-'
  if (priceMatch) {
    formattedPrice = priceMatch[0].trim()
    if (priceMatch[1]) {
      numericPrice = parseInt(priceMatch[1].replace(/\./g, ''), 10) || 0
    } else if (priceMatch[2]) {
      const mult = /jt|juta/i.test(priceMatch[3]) ? 1000000 : 1000
      numericPrice = (parseInt(priceMatch[2], 10) || 0) * mult
    }
  }

  const itemMatches = []
  const itemRegex1 =
    /([a-zA-Z][a-zA-Z0-9\s]{2,28}?)\s+([0-9]+)\s*(pcs|buah|bungkus|box|pak|pack|botol|kg|gram|gr|lusin|set|porsi|cup)\b/gi
  const itemRegex2 =
    /\b([0-9]+)\s*(x|pcs|buah|bungkus|box|pak|pack|botol|kg|gram|gr|lusin|set|porsi|cup)\s+([a-zA-Z][a-zA-Z0-9\s]{2,28}?)(?=\s*(?:,|dan|&|sama|kirim|ke\s+|an\s+|a\.n|via|pakai|total|rp|$))/gi

  let m
  while ((m = itemRegex1.exec(clean)) !== null) {
    const rawName = m[1]
      .replace(/^(?:kak\s+|halo\s+|pesan\s+|mau\s+|order\s+|beli\s+|sama\s+|dan\s+)+/i, '')
      .trim()
    if (rawName && !/^(no|jalan|jl|rt|rw)$/i.test(rawName)) {
      itemMatches.push(`${rawName} (${m[2]} ${m[3]})`)
    }
  }
  if (itemMatches.length === 0) {
    while ((m = itemRegex2.exec(clean)) !== null) {
      itemMatches.push(`${m[3].trim()} (${m[1]} ${m[2]})`)
    }
  }

  const name = nameMatch?.[1]?.trim() || '-'
  const phone = phoneMatch?.[0]?.trim() || '-'
  const address = addressMatch
    ? addressMatch[0].replace(/^(?:kirim\s+ke|alamat\s*[:=-]?|ke)\s+/i, '').trim()
    : '-'
  const items = itemMatches.length > 0 ? itemMatches.join(', ') : clean.slice(0, 75)
  const courier = courierMatch?.[1]?.trim() || '-'

  const isComplete = name !== '-' && phone !== '-' && address !== '-'
  const status = isComplete ? 'Lengkap Terverifikasi' : 'Perlu Cek Alamat/HP'

  return {
    row: [
      `#${index + 1}`,
      name,
      phone,
      items,
      address,
      courier,
      formattedPrice,
      status,
    ],
    numericPrice,
    isOrder: Boolean(phoneMatch || nameMatch || addressMatch || itemMatches.length > 0),
  }
}

/**
 * Parser nyata untuk Multi-Order WA, Catatan Kas, atau Dokumen Teks Tempel
 */
function parseRealIndonesianText(rawText) {
  const text = rawText.trim()
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // 1. Jika ada beberapa baris orderan (Batch Order WA)
  const parsedOrders = lines.map((line, idx) => parseSingleOrderBlock(line, idx))
  const validOrders = parsedOrders.filter((o) => o.isOrder)

  if (validOrders.length >= 1) {
    const rows = validOrders.map((o) => o.row)
    const totalRp = validOrders.reduce((acc, o) => acc + o.numericPrice, 0)
    const formattedTotal =
      totalRp > 0 ? `Rp ${totalRp.toLocaleString('id-ID')}` : '-'

    if (validOrders.length > 1 && totalRp > 0) {
      rows.push([
        'TOTAL',
        `${validOrders.length} Pelanggan`,
        '-',
        'Akumulasi Seluruh Pesanan',
        '-',
        '-',
        formattedTotal,
        'Rekap Otomatis',
      ])
    }

    return {
      summary: `Beres! Berhasil mengekstrak ${validOrders.length} pesanan pelanggan menjadi tabel rekap siap cetak resi${totalRp > 0 ? ` (Total: ${formattedTotal})` : ''}.`,
      answer: `Berhasil memverifikasi ${validOrders.length} data pesanan pelanggan${totalRp > 0 ? ` dengan total nilai transaksi sebesar ${formattedTotal}` : ''}. Semua kolom Nama, Nomor HP, Pesanan, Alamat, dan Kurir telah dipisahkan secara otomatis.`,
      verifiedQuotes: lines.slice(0, 3).map((l, i) => ({
        source: `Chat Order #${i + 1}`,
        quote: l,
      })),
      columns: [
        'No',
        'Nama Penerima',
        'No HP / WA',
        'Rincian Pesanan',
        'Alamat Tujuan',
        'Kurir',
        'Total Harga',
        'Status Data',
      ],
      rows,
    }
  }

  // 2. Jika teks umum / dokumen tempel, jalankan analyzer dokumen terverifikasi
  return analyzeVerifiedDocumentLocally(
    { name: 'Teks_Input_Langsung.txt', text, docType: 'Teks Langsung' },
    '',
    ''
  )
}

async function fetchExtract(targetUrl) {
  const res = await fetch(`/api/extract?url=${encodeURIComponent(targetUrl)}`)
  const data = await res.json()
  if (!data || !data.ok) {
    throw new Error(data?.error || 'Tidak dapat mengakses link tersebut.')
  }
  return data
}

async function extractRealUrl(targetUrl, extraQuery, prefetched) {
  const data = prefetched || (await fetchExtract(targetUrl))
  if (data.isJson && data.data) {
    const raw = data.data
    const list = Array.isArray(raw) ? raw : Object.entries(raw)
    const rows = list.slice(0, 35).map((item, idx) => {
      if (Array.isArray(item)) {
        return [`#${idx + 1}`, String(item[0]), JSON.stringify(item[1]).slice(0, 140), 'JSON Property']
      }
      if (typeof item === 'object' && item !== null) {
        const keys = Object.keys(item)
        return [
          `#${idx + 1}`,
          String(item[keys[0]] ?? '-'),
          String(item[keys[1]] ?? '-'),
          String(item[keys[2]] ?? 'JSON Object'),
        ]
      }
      return [`#${idx + 1}`, String(item), '-', 'JSON Item']
    })

    return {
      summary: `Beres! Berhasil menarik ${rows.length} baris data JSON langsung dari ${targetUrl}.`,
      answer: `Endpoint JSON ${targetUrl} berhasil diekstrak secara langsung (${rows.length} entri ditampilkan).`,
      verifiedQuotes: [],
      columns: ['No', 'Atribut / Kunci', 'Nilai / Isi Data', 'Tipe'],
      rows,
    }
  }

  const pageTitle = data.pageTitle || targetUrl
  const tables = Array.isArray(data.tables) ? data.tables : []
  const sections = Array.isArray(data.sections) ? data.sections : []
  const items = Array.isArray(data.items) ? data.items : []

  // Jika halaman punya tabel HTML nyata (misal Wikipedia / Katalog), tampilkan tabel aslinya!
  if (tables.length > 0 && !extraQuery) {
    const bestTable =
      tables.reduce((prev, curr) => (curr.rows.length > prev.rows.length ? curr : prev), tables[0])
    return {
      summary: `Beres! Mengekstrak tabel asli "${bestTable.title}" (${bestTable.rows.length} baris) dari halaman "${pageTitle}".`,
      answer: `Ditemukan ${tables.length} tabel data pada halaman "${pageTitle}". Menampilkan tabel utama "${bestTable.title}" dengan kolom: ${bestTable.columns.join(', ')}.`,
      verifiedQuotes: sections.slice(0, 2).map((s) => ({
        source: `${pageTitle} • ${s.heading}`,
        quote: s.text,
      })),
      columns: bestTable.columns,
      rows: bestTable.rows,
    }
  }

  // Jika ada pertanyaan terhadap halaman web, cari bagian yang relevan
  if (extraQuery && sections.length > 0) {
    const virtualDoc = {
      name: pageTitle,
      text: sections.map((s) => `[${s.heading}]\n${s.text}`).join('\n'),
      docType: 'Halaman Web',
    }
    return analyzeVerifiedDocumentLocally(virtualDoc, extraQuery, '')
  }

  const rows = [
    ['Judul Halaman', pageTitle, data.pageDesc || 'Berhasil diakses langsung', 'Metadata Utama'],
    ...items.map((it) => [it.type, it.title, it.value, it.extra]),
  ]

  return {
    summary: `Beres! Berhasil mengekstrak ${rows.length} baris data dari halaman "${pageTitle}".`,
    answer: data.pageDesc || `Halaman "${pageTitle}" berhasil diekstrak (${rows.length} elemen ditemukan).`,
    verifiedQuotes: sections.slice(0, 3).map((s) => ({
      source: `${pageTitle} • ${s.heading}`,
      quote: s.text,
    })),
    columns: ['Kategori / Bagian', 'Judul / Poin', 'Isi / Nilai Terverifikasi', 'Sumber'],
    rows,
  }
}

export async function processPitulungTask({
  toolId,
  input,
  format,
  config = DEFAULT_ENGINE_CONFIG,
  document = null,
}) {
  const cleanInput = (input || '').trim()
  const useAi = config.provider && config.provider !== 'local'
  let aiError = ''
  let quotaStatus = ''

  // 1. JIKA ADA DOKUMEN TERVERIFIKASI YANG DIUPLOAD (ATAU DOKUMEN CONTOH)
  if (document && (document.text || document.base64)) {
    const queryToUse =
      cleanInput || 'Ekstrak seluruh data penting dan tabel dari dokumen ini beserta sumber pasalnya.'

    if (useAi) {
      try {
        const promptForAi = [
          `NAMA DOKUMEN: ${document.name} (${document.docType || document.mimeType})`,
          `FORMAT OUTPUT YANG DIMINTA: ${format || 'Tanya Jawab & Tabel Terverifikasi'}`,
          `PERTANYAAN / INSTRUKSI PENGGUNA: ${queryToUse}`,
          document.text ? `ISI DOKUMEN TERVERIFIKASI:\n${document.text.slice(0, 48000)}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')

        const aiRes = await askAi(config, promptForAi, document)
        return {
          ...aiRes,
          docName: document.name,
          live: true,
        }
      } catch (err) {
        aiError = err.message
        if (err.quotaStatus) quotaStatus = err.quotaStatus
      }
    }

    const localDocRes = analyzeVerifiedDocumentLocally(document, cleanInput, format || '')
    return {
      ...localDocRes,
      docName: document.name,
      engine: 'local',
      isQuestion: isNaturalQuestion(cleanInput),
      aiError,
      quotaStatus,
    }
  }

  // 2. JIKA INPUT ADALAH URL WEB
  const { url: detectedUrl, extraQuery } = normalizeUrlAndQuery(cleanInput)
  if (detectedUrl) {
    let extracted
    try {
      extracted = await fetchExtract(detectedUrl)
    } catch (err) {
      throw new Error(
        `Tidak dapat mengambil halaman ${detectedUrl} (${err.message || 'koneksi ditolak oleh situs target'}).`,
        { cause: err }
      )
    }

    if (useAi) {
      try {
        const aiResult = await askAi(
          config,
          describeExtractForAi(detectedUrl, extracted, extraQuery)
        )
        return { ...aiResult, live: true }
      } catch (err) {
        aiError = err.message
        if (err.quotaStatus) quotaStatus = err.quotaStatus
      }
    }

    const liveUrlData = await extractRealUrl(detectedUrl, extraQuery, extracted)
    return { ...liveUrlData, live: true, aiError, quotaStatus }
  }

  // 3. JIKA USER MEMILIH TOOL DOKUMEN TANPA FILE -> GUNAKAN DOKUMEN SAMPEL TERVERIFIKASI
  if (toolId === 'dokumen' && cleanInput.length < 180 && !/\b08\d{8,}/.test(cleanInput)) {
    if (useAi) {
      try {
        const promptForAi = [
          `NAMA DOKUMEN: ${SAMPLE_VERIFIED_DOC.name}`,
          `PERTANYAAN / INSTRUKSI PENGGUNA: ${cleanInput}`,
          `ISI DOKUMEN TERVERIFIKASI:\n${SAMPLE_VERIFIED_DOC.text}`,
        ].join('\n\n')
        const aiRes = await askAi(config, promptForAi, SAMPLE_VERIFIED_DOC)
        return { ...aiRes, docName: SAMPLE_VERIFIED_DOC.name, live: true }
      } catch (err) {
        aiError = err.message
        if (err.quotaStatus) quotaStatus = err.quotaStatus
      }
    }
    const sampleRes = analyzeVerifiedDocumentLocally(SAMPLE_VERIFIED_DOC, cleanInput, format || '')
    return {
      ...sampleRes,
      docName: SAMPLE_VERIFIED_DOC.name,
      engine: 'local',
      isQuestion: isNaturalQuestion(cleanInput),
      aiError,
      quotaStatus,
    }
  }

  // 4. TEKS / MULTI-ORDER WA / DOKUMEN TEMPEL: PAKAI AI JIKA DIPILIH
  if (useAi) {
    try {
      const promptForAi = `FORMAT OUTPUT: ${format || 'Tabel Rekap Rapi'}\nINPUT PENGGUNA:\n${cleanInput}`
      return await askAi(config, promptForAi)
    } catch (err) {
      aiError = err.message
      if (err.quotaStatus) quotaStatus = err.quotaStatus
    }
  }

  // 5. PARSER MULTI-ORDER & DOKUMEN LOKAL
  await new Promise((r) => setTimeout(r, 220))
  return { ...parseRealIndonesianText(cleanInput), aiError, quotaStatus }
}
