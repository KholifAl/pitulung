import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'

/**
 * Memendekkan nama file panjang agar rapi di dalam kartu UI
 */
export function truncateFileName(name = '', maxLen = 28) {
  const clean = String(name || '').trim()
  if (clean.length <= maxLen) return clean
  const dotIdx = clean.lastIndexOf('.')
  if (dotIdx > 0 && clean.length - dotIdx <= 6) {
    const ext = clean.slice(dotIdx)
    const keep = Math.max(8, maxLen - ext.length - 3)
    return `${clean.slice(0, keep)}...${ext}`
  }
  return `${clean.slice(0, maxLen)}...`
}

/**
 * Format ukuran byte menjadi teks yang mudah dibaca (KB / MB)
 */
export function formatFileSize(bytes = 0) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

/**
 * Bersihkan nama file tanpa ekstensi .pdf
 */
export function stripPdfExtension(fileName = 'dokumen.pdf') {
  return String(fileName || 'dokumen')
    .replace(/\.pdf$/i, '')
    .trim()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-') || 'dokumen'
}

/**
 * Memicu unduhan Blob / Uint8Array di browser pengguna
 */
export function triggerBrowserDownload(data, fileName, mimeType = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 2500)
}

/**
 * Membaca metadata & jumlah halaman dari berkas PDF yang diunggah
 */
export async function inspectPdfFile(file) {
  if (!file) {
    throw new Error('Berkas tidak ditemukan.')
  }
  const isPdf =
    file.type === 'application/pdf' || /\.pdf$/i.test(String(file.name || ''))
  if (!isPdf) {
    throw new Error(`Berkas "${file.name}" bukan format PDF. Harap unggah file .pdf.`)
  }

  let arrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch {
    throw new Error(`Gagal membaca berkas "${file.name}".`)
  }

  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pageCount = pdfDoc.getPageCount()
    if (pageCount < 1) {
      throw new Error(`Berkas "${file.name}" tidak memiliki halaman yang valid.`)
    }
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      pageCount,
    }
  } catch (err) {
    if (/encrypted|password/i.test(err.message || '')) {
      throw new Error(
        `Berkas "${file.name}" dikunci password (terenkripsi). Buka kunci PDF terlebih dahulu sebelum diproses.`,
        { cause: err }
      )
    }
    throw new Error(
      `Berkas "${file.name}" rusak atau bukan PDF yang valid.`,
      { cause: err }
    )
  }
}

/**
 * Membuat berkas PDF sampel langsung di browser untuk demo cepat
 */
export async function createSamplePdfFile(title = 'Dokumen-Sampel.pdf', pageCount = 3, subtitle = 'Contoh Dokumen Pitulung') {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (let i = 1; i <= pageCount; i += 1) {
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const { width, height } = page.getSize()

    // Header bar
    page.drawRectangle({
      x: 48,
      y: height - 92,
      width: width - 96,
      height: 36,
      color: rgb(0.39, 0.09, 0.16),
    })

    page.drawText('PITULUNG: DOKUMEN SAMPEL PDF', {
      x: 62,
      y: height - 78,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    page.drawText(`${subtitle}, Halaman ${i} dari ${pageCount}`, {
      x: 48,
      y: height - 135,
      size: 18,
      font: fontBold,
      color: rgb(0.18, 0.04, 0.07),
    })

    page.drawText(`Nama Berkas: ${title}`, {
      x: 48,
      y: height - 165,
      size: 11,
      font: fontRegular,
      color: rgb(0.35, 0.3, 0.32),
    })

    page.drawText(
      `Ini adalah halaman ke-${i} yang dibuat otomatis di browser untuk menguji fitur manipulasi PDF.`,
      {
        x: 48,
        y: height - 200,
        size: 11,
        font: fontRegular,
        color: rgb(0.2, 0.18, 0.19),
      }
    )

    page.drawText(
      'Seluruh proses penggabungan (Merge) dan pemisahan (Split) berjalan 100% lokal di perangkat Anda.',
      {
        x: 48,
        y: height - 220,
        size: 11,
        font: fontRegular,
        color: rgb(0.2, 0.18, 0.19),
      }
    )

    // Footer nomor halaman
    page.drawText(`Halaman ${i} / ${pageCount}`, {
      x: width / 2 - 35,
      y: 42,
      size: 10,
      font: fontBold,
      color: rgb(0.48, 0.12, 0.21),
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  return new File([blob], title, { type: 'application/pdf' })
}

/**
 * Menggabungkan beberapa berkas PDF sesuai urutan array
 */
export async function mergePdfFiles(items = [], onProgress) {
  if (!Array.isArray(items) || items.length < 2) {
    throw new Error('Pilih minimal 2 berkas PDF untuk digabungkan.')
  }

  const mergedPdf = await PDFDocument.create()
  let totalPages = 0

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx]
    if (onProgress) {
      onProgress(`Menggabungkan (${idx + 1}/${items.length}): "${item.name}"...`)
    }
    const arrayBuffer = await item.file.arrayBuffer()
    const sourcePdf = await PDFDocument.load(arrayBuffer)
    const indices = sourcePdf.getPageIndices()
    const copiedPages = await mergedPdf.copyPages(sourcePdf, indices)
    copiedPages.forEach((page) => mergedPdf.addPage(page))
    totalPages += copiedPages.length
  }

  if (onProgress) {
    onProgress('Menyusun dan menyimpan berkas PDF gabungan...')
  }

  const pdfBytes = await mergedPdf.save()
  const firstBase = stripPdfExtension(items[0]?.name || 'dokumen')
  const fileName = `${firstBase}-gabungan-${items.length}-file.pdf`

  return {
    pdfBytes,
    fileName,
    totalPages,
    fileCount: items.length,
    size: pdfBytes.byteLength,
  }
}

/**
 * Parsing string rentang halaman kustom (misal: "1-3, 5, 8-10")
 * Mengembalikan daftar nomor halaman (1-based) dan grup rentang
 */
export function parsePageRanges(rangeStr = '', maxPages = 1) {
  const clean = String(rangeStr || '').trim()
  if (!clean) {
    return {
      pages: [],
      groups: [],
      error: 'Masukkan rentang halaman terlebih dahulu (contoh: 1-3, 5, 8-10).',
    }
  }

  const parts = clean
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      pages: [],
      groups: [],
      error: 'Format rentang halaman tidak valid.',
    }
  }

  const allPages = []
  const seenPages = new Set()
  const groups = []

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const pageNum = parseInt(part, 10)
      if (pageNum < 1 || pageNum > maxPages) {
        return {
          pages: [],
          groups: [],
          error: `Halaman ${pageNum} di luar batas dokumen (dokumen ini memiliki ${maxPages} halaman).`,
        }
      }
      groups.push({ label: `Hal. ${pageNum}`, suffix: `hal-${pageNum}`, pages: [pageNum] })
      if (!seenPages.has(pageNum)) {
        seenPages.add(pageNum)
        allPages.push(pageNum)
      }
    } else if (/^\d+\s*-\s*\d+$/.test(part)) {
      const [startRaw, endRaw] = part.split('-').map((s) => parseInt(s.trim(), 10))
      if (startRaw < 1 || endRaw < 1 || startRaw > maxPages || endRaw > maxPages) {
        return {
          pages: [],
          groups: [],
          error: `Rentang "${part}" di luar batas dokumen (1 - ${maxPages}).`,
        }
      }
      if (startRaw > endRaw) {
        return {
          pages: [],
          groups: [],
          error: `Rentang "${part}" tidak valid: halaman awal (${startRaw}) lebih besar dari halaman akhir (${endRaw}).`,
        }
      }
      const groupPages = []
      for (let p = startRaw; p <= endRaw; p += 1) {
        groupPages.push(p)
        if (!seenPages.has(p)) {
          seenPages.add(p)
          allPages.push(p)
        }
      }
      groups.push({
        label: startRaw === endRaw ? `Hal. ${startRaw}` : `Hal. ${startRaw}-${endRaw}`,
        suffix: startRaw === endRaw ? `hal-${startRaw}` : `hal-${startRaw}-${endRaw}`,
        pages: groupPages,
      })
    } else {
      return {
        pages: [],
        groups: [],
        error: `Format "${part}" tidak dikenali. Gunakan angka atau tanda hubung (contoh: 1-3, 5, 8-10).`,
      }
    }
  }

  return {
    pages: allPages,
    groups,
    error: null,
  }
}

/**
 * Memisahkan berkas PDF berdasarkan mode:
 * - 'range': Ambil rentang halaman kustom (misal 1-3, 5, 8-10)
 * - 'all': Pisah setiap halaman menjadi berkas PDF terpisah (+ bundel .zip jika > 1 file)
 */
export async function splitPdfFile({ file, mode = 'range', rangeInput = '' }, onProgress) {
  if (!file) {
    throw new Error('Pilih atau unggah 1 berkas PDF terlebih dahulu.')
  }

  if (onProgress) {
    onProgress(`Membaca berkas "${file.name}"...`)
  }

  const arrayBuffer = await file.arrayBuffer()
  const sourcePdf = await PDFDocument.load(arrayBuffer)
  const totalPages = sourcePdf.getPageCount()
  const baseName = stripPdfExtension(file.name)

  if (mode === 'range') {
    const parsed = parsePageRanges(rangeInput, totalPages)
    if (parsed.error) {
      throw new Error(parsed.error)
    }

    if (onProgress) {
      onProgress(`Mengekstrak ${parsed.pages.length} halaman pilihan...`)
    }

    // Buat 1 dokumen gabungan dari seluruh halaman yang dipilih di rentang kustom
    const extractedPdf = await PDFDocument.create()
    const zeroBasedIndices = parsed.pages.map((p) => p - 1)
    const copiedPages = await extractedPdf.copyPages(sourcePdf, zeroBasedIndices)
    copiedPages.forEach((page) => extractedPdf.addPage(page))
    const extractedBytes = await extractedPdf.save()

    const cleanSuffix = String(rangeInput)
      .trim()
      .replace(/\s+/g, '')
      .replace(/,/g, '_')
      .replace(/[^0-9_-]/g, '')
      .slice(0, 32)
    const mainFileName = `${baseName}-halaman-${cleanSuffix || 'pilihan'}.pdf`

    // Jika pengguna memasukkan beberapa segmen koma (misal: 1-3, 5, 8-10),
    // sediakan juga file per segmen agar bisa diunduh terpisah bila diperlukan
    const splitFiles = []
    if (parsed.groups.length > 1) {
      for (let i = 0; i < parsed.groups.length; i += 1) {
        const grp = parsed.groups[i]
        const segPdf = await PDFDocument.create()
        const segCopied = await segPdf.copyPages(
          sourcePdf,
          grp.pages.map((p) => p - 1)
        )
        segCopied.forEach((p) => segPdf.addPage(p))
        const segBytes = await segPdf.save()
        splitFiles.push({
          name: `${baseName}-${grp.suffix}.pdf`,
          label: grp.label,
          pageCount: grp.pages.length,
          size: segBytes.byteLength,
          bytes: segBytes,
        })
      }
    } else {
      splitFiles.push({
        name: mainFileName,
        label: parsed.groups[0]?.label || `Hal. ${rangeInput}`,
        pageCount: parsed.pages.length,
        size: extractedBytes.byteLength,
        bytes: extractedBytes,
      })
    }

    let zipBlob = null
    let zipFileName = null
    if (splitFiles.length > 1) {
      const zip = new JSZip()
      splitFiles.forEach((f) => zip.file(f.name, f.bytes))
      zipBlob = await zip.generateAsync({ type: 'blob' })
      zipFileName = `${baseName}-rentang-terpisah.zip`
    }

    return {
      mode: 'range',
      sourceName: file.name,
      totalPages,
      extractedCount: parsed.pages.length,
      selectedPages: parsed.pages,
      primaryFile: {
        name: mainFileName,
        bytes: extractedBytes,
        size: extractedBytes.byteLength,
        pageCount: parsed.pages.length,
      },
      files: splitFiles,
      zipBlob,
      zipFileName,
    }
  }

  // Mode 'all': Pisah setiap halaman menjadi file PDF terpisah
  const files = []
  for (let p = 1; p <= totalPages; p += 1) {
    if (onProgress) {
      onProgress(`Memisahkan halaman ${p} dari ${totalPages}...`)
    }
    const singlePdf = await PDFDocument.create()
    const [copiedPage] = await singlePdf.copyPages(sourcePdf, [p - 1])
    singlePdf.addPage(copiedPage)
    const singleBytes = await singlePdf.save()
    const paddedNum = String(p).padStart(totalPages >= 10 ? 2 : 1, '0')
    files.push({
      name: `${baseName}-halaman-${paddedNum}.pdf`,
      label: `Halaman ${p}`,
      pageNumber: p,
      pageCount: 1,
      size: singleBytes.byteLength,
      bytes: singleBytes,
    })
  }

  let zipBlob = null
  let zipFileName = null
  if (files.length > 1) {
    if (onProgress) {
      onProgress(`Mengemas ${files.length} berkas PDF ke dalam arsip .zip...`)
    }
    const zip = new JSZip()
    files.forEach((item) => {
      zip.file(item.name, item.bytes)
    })
    zipBlob = await zip.generateAsync({ type: 'blob' })
    zipFileName = `${baseName}-pisah-${totalPages}-halaman.zip`
  }

  return {
    mode: 'all',
    sourceName: file.name,
    totalPages,
    extractedCount: totalPages,
    selectedPages: Array.from({ length: totalPages }, (_, i) => i + 1),
    primaryFile: files[0] || null,
    files,
    zipBlob,
    zipFileName,
  }
}
