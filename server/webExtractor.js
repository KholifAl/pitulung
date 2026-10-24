export function decodeHtmlEntities(str = '') {
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

export function stripTags(html = '') {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
}

export function parseWebpageHtml(html, targetUrl) {
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
