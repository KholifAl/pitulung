import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
  StandardFonts,
  decodePDFRawStream,
  rgb,
} from 'pdf-lib'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

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
export async function inspectPdfFile(file, options = {}) {
  if (!file) {
    throw new Error('Berkas tidak ditemukan.')
  }
  const isPdf =
    file.type === 'application/pdf' || /\.pdf$/i.test(String(file.name || ''))
  if (!isPdf) {
    throw new Error(`Berkas "${file.name}" bukan format PDF. Harap unggah file .pdf.`)
  }

  if (options.quick) {
    const objectUrl = URL.createObjectURL(file)
    let pdfjsDoc = null
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: objectUrl,
        disableAutoFetch: true,
        useSystemFonts: true,
      })
      pdfjsDoc = await loadingTask.promise
      const pageCount = pdfjsDoc.numPages
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
      if (err?.name === 'PasswordException' || /encrypted|password/i.test(err?.message || '')) {
        throw new Error(
          `Berkas "${file.name}" dikunci password (terenkripsi). Buka kunci PDF terlebih dahulu sebelum diproses.`,
          { cause: err }
        )
      }
      // Fall back to pdf-lib inspection if PDF.js cannot open the file
    } finally {
      if (pdfjsDoc) {
        try {
          await pdfjsDoc.destroy()
        } catch {
          // Ignore cleanup errors
        }
      }
      URL.revokeObjectURL(objectUrl)
    }
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

    if (options.quick) {
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: file.size,
        pageCount,
      }
    }

    const analysis = analyzePdfStructure(pdfDoc)
    const pagesMeta = extractPagesMeta(pdfDoc)

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      pageCount,
      pagesMeta,
      imageBytes: analysis.imageBytes,
      imageCount: analysis.imageCount,
      imageSummaries: analysis.imageSummaries,
      stripMetadataBytes: analysis.stripMetadataBytes,
      uncompressedStreamBytes: analysis.uncompressedStreamBytes,
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
export async function createSamplePdfFile(title = 'Dokumen-Sampel.pdf', pageCount = 3, subtitle = 'Contoh Dokumen Tinulung') {
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

    page.drawText('TINULUNG: DOKUMEN SAMPEL PDF', {
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

  pdfDoc.setTitle(title)
  pdfDoc.setAuthor('Tinulung Sample Generator')
  pdfDoc.setSubject(subtitle)
  pdfDoc.setCreator('Tinulung Web App')
  pdfDoc.setProducer('Tinulung PDF Suite')

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
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
 * Mengubah daftar nomor halaman (1-based) menjadi string rentang ringkas (misal: "1-3, 5, 8-10")
 */
export function formatPageNumbersToRanges(pageNumbers = []) {
  const uniqueSorted = Array.from(
    new Set(
      (Array.isArray(pageNumbers) ? pageNumbers : [])
        .map((n) => parseInt(n, 10))
        .filter((n) => Number.isFinite(n) && n >= 1)
    )
  ).sort((a, b) => a - b)

  if (uniqueSorted.length === 0) return ''

  const ranges = []
  let start = uniqueSorted[0]
  let prev = uniqueSorted[0]

  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const curr = uniqueSorted[i]
    if (curr === prev + 1) {
      prev = curr
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
      start = curr
      prev = curr
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`)

  return ranges.join(', ')
}

/**
 * Memisahkan berkas PDF berdasarkan mode:
 * - 'range': Ambil rentang halaman kustom (misal 1-3, 5, 8-10)
 * - 'all': Pisah setiap halaman menjadi berkas PDF terpisah (+ bundel .zip jika > 1 file)
 */
export async function splitPdfFile(
  { file, mode = 'range', rangeInput = '', pagesPerBundle = 1 },
  onProgress
) {
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

  // Mode 'all': Pisah seluruh halaman per N halaman (default 1 halaman per file)
  const safeBundleSize = Math.max(1, Math.min(totalPages, parseInt(pagesPerBundle, 10) || 1))
  const padDigits = totalPages >= 10 ? 2 : 1
  const files = []

  for (let startPage = 1; startPage <= totalPages; startPage += safeBundleSize) {
    const endPage = Math.min(totalPages, startPage + safeBundleSize - 1)
    const indices = []
    for (let p = startPage; p <= endPage; p += 1) {
      indices.push(p - 1)
    }

    if (onProgress) {
      onProgress(
        startPage === endPage
          ? `Memisahkan halaman ${startPage} dari ${totalPages}...`
          : `Memisahkan bundel halaman ${startPage}-${endPage} dari ${totalPages}...`
      )
    }

    const bundlePdf = await PDFDocument.create()
    const copiedPages = await bundlePdf.copyPages(sourcePdf, indices)
    copiedPages.forEach((page) => bundlePdf.addPage(page))
    const bundleBytes = await bundlePdf.save()

    const paddedStart = String(startPage).padStart(padDigits, '0')
    const paddedEnd = String(endPage).padStart(padDigits, '0')
    const isSingle = startPage === endPage

    files.push({
      name: isSingle
        ? `${baseName}-halaman-${paddedStart}.pdf`
        : `${baseName}-halaman-${paddedStart}-${paddedEnd}.pdf`,
      label: isSingle ? `Halaman ${startPage}` : `Hal. ${startPage}-${endPage}`,
      pageNumber: startPage,
      pageCount: indices.length,
      size: bundleBytes.byteLength,
      bytes: bundleBytes,
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
    zipFileName =
      safeBundleSize === 1
        ? `${baseName}-pisah-${totalPages}-halaman.zip`
        : `${baseName}-bundel-per-${safeBundleSize}-hal.zip`
  }

  return {
    mode: 'all',
    pagesPerBundle: safeBundleSize,
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

function lookupNumber(dict, key) {
  if (!dict) return 0
  const val = dict.lookup(PDFName.of(key))
  return val instanceof PDFNumber ? val.asNumber() : 0
}

function getFilterNames(dict) {
  if (!dict) return []
  const filterObj = dict.lookup(PDFName.of('Filter'))
  if (!filterObj) return []
  if (filterObj instanceof PDFName) {
    return [filterObj.decodeText()]
  }
  if (filterObj instanceof PDFArray) {
    const names = []
    for (let i = 0; i < filterObj.size(); i += 1) {
      const el = filterObj.lookup(i)
      if (el instanceof PDFName) {
        names.push(el.decodeText())
      }
    }
    return names
  }
  return []
}

function isDctFilterName(name) {
  return name === 'DCTDecode' || name === 'DCT'
}

function isDecodableWrapperFilter(name) {
  return (
    name === 'FlateDecode' ||
    name === 'Fl' ||
    name === 'LZWDecode' ||
    name === 'LZW' ||
    name === 'ASCII85Decode' ||
    name === 'A85' ||
    name === 'ASCIIHexDecode' ||
    name === 'AHx' ||
    name === 'RunLengthDecode' ||
    name === 'RL'
  )
}

function resolveColorSpaceInfo(dict) {
  if (!dict) return { kind: 'unknown', channels: 0 }
  const cs = dict.lookup(PDFName.of('ColorSpace'))
  if (!cs) return { kind: 'unknown', channels: 0 }

  if (cs instanceof PDFName) {
    const name = cs.decodeText()
    if (name === 'DeviceGray' || name === 'G' || name === 'CalGray') {
      return { kind: 'gray', channels: 1 }
    }
    if (name === 'DeviceRGB' || name === 'RGB' || name === 'CalRGB') {
      return { kind: 'rgb', channels: 3 }
    }
    if (name === 'DeviceCMYK' || name === 'CMYK') {
      return { kind: 'cmyk', channels: 4 }
    }
    return { kind: 'unknown', channels: 0 }
  }

  if (cs instanceof PDFArray && cs.size() > 0) {
    const first = cs.lookup(0)
    const typeName = first instanceof PDFName ? first.decodeText() : ''
    if (typeName === 'ICCBased') {
      const profileStream = cs.lookup(1)
      const n = lookupNumber(profileStream?.dict, 'N') || 3
      if (n === 1) return { kind: 'gray', channels: 1 }
      if (n === 4) return { kind: 'cmyk', channels: 4 }
      return { kind: 'rgb', channels: 3 }
    }
    if (typeName === 'CalGray') return { kind: 'gray', channels: 1 }
    if (typeName === 'CalRGB') return { kind: 'rgb', channels: 3 }
    if (typeName === 'DeviceRGB' || typeName === 'RGB') return { kind: 'rgb', channels: 3 }
    if (typeName === 'DeviceCMYK' || typeName === 'CMYK') return { kind: 'cmyk', channels: 4 }
    if (typeName === 'DeviceGray' || typeName === 'G') return { kind: 'gray', channels: 1 }
    if (typeName === 'Indexed') {
      const baseVal = cs.lookup(1)
      let baseKind = 'rgb'
      let baseChannels = 3
      if (baseVal instanceof PDFName) {
        const bName = baseVal.decodeText()
        if (bName === 'DeviceCMYK' || bName === 'CMYK') {
          baseKind = 'cmyk'
          baseChannels = 4
        } else if (bName === 'DeviceGray' || bName === 'G') {
          baseKind = 'gray'
          baseChannels = 1
        }
      } else if (baseVal instanceof PDFArray && baseVal.size() > 1) {
        const bFirst = baseVal.lookup(0)
        if (bFirst instanceof PDFName && bFirst.decodeText() === 'ICCBased') {
          const prof = baseVal.lookup(1)
          const n = lookupNumber(prof?.dict, 'N') || 3
          if (n === 4) {
            baseKind = 'cmyk'
            baseChannels = 4
          } else if (n === 1) {
            baseKind = 'gray'
            baseChannels = 1
          }
        }
      }
      const hivalObj = cs.lookup(2)
      const hival = hivalObj instanceof PDFNumber ? hivalObj.asNumber() : 255
      const lookupObj = cs.lookup(3)
      return {
        kind: 'indexed',
        channels: 1,
        baseKind,
        baseChannels,
        hival,
        lookupObj,
      }
    }
  }

  return { kind: 'unknown', channels: 0 }
}

function decodeStreamSafely(pdfObj) {
  const origFilter = pdfObj.dict.get(PDFName.of('Filter'))
  const origParms = pdfObj.dict.get(PDFName.of('DecodeParms'))
  try {
    const resolvedFilter = pdfObj.dict.lookup(PDFName.of('Filter'))
    const resolvedParms = pdfObj.dict.lookup(PDFName.of('DecodeParms'))
    if (resolvedFilter instanceof PDFArray && resolvedFilter.size() === 1) {
      pdfObj.dict.set(PDFName.of('Filter'), resolvedFilter.lookup(0))
      if (resolvedParms instanceof PDFArray && resolvedParms.size() === 1) {
        pdfObj.dict.set(PDFName.of('DecodeParms'), resolvedParms.lookup(0))
      }
    }
    return decodePDFRawStream(pdfObj).decode()
  } finally {
    if (origFilter !== undefined) {
      pdfObj.dict.set(PDFName.of('Filter'), origFilter)
    } else {
      pdfObj.dict.delete(PDFName.of('Filter'))
    }
    if (origParms !== undefined) {
      pdfObj.dict.set(PDFName.of('DecodeParms'), origParms)
    } else {
      pdfObj.dict.delete(PDFName.of('DecodeParms'))
    }
  }
}

function extractJpegBytesFromStream(pdfObj, filters) {
  let bytes = pdfObj.contents
  if (!bytes || bytes.byteLength < 4) return null

  if (filters.length > 1) {
    const origFilter = pdfObj.dict.get(PDFName.of('Filter'))
    const origParms = pdfObj.dict.get(PDFName.of('DecodeParms'))
    try {
      const wrapperNames = filters.slice(0, -1)
      if (wrapperNames.length === 1) {
        pdfObj.dict.set(PDFName.of('Filter'), PDFName.of(wrapperNames[0]))
        const resolvedParms = pdfObj.dict.lookup(PDFName.of('DecodeParms'))
        if (resolvedParms instanceof PDFArray && resolvedParms.size() > 0) {
          const firstParm = resolvedParms.lookup(0)
          if (firstParm instanceof PDFDict) {
            pdfObj.dict.set(PDFName.of('DecodeParms'), firstParm)
          } else {
            pdfObj.dict.delete(PDFName.of('DecodeParms'))
          }
        }
      } else {
        const arr = PDFArray.withContext(pdfObj.dict.context)
        wrapperNames.forEach((n) => arr.push(PDFName.of(n)))
        pdfObj.dict.set(PDFName.of('Filter'), arr)
      }
      bytes = decodePDFRawStream(pdfObj).decode()
    } catch {
      return null
    } finally {
      if (origFilter !== undefined) {
        pdfObj.dict.set(PDFName.of('Filter'), origFilter)
      }
      if (origParms !== undefined) {
        pdfObj.dict.set(PDFName.of('DecodeParms'), origParms)
      } else {
        pdfObj.dict.delete(PDFName.of('DecodeParms'))
      }
    }
  }

  // Strip any leading padding bytes before JPEG SOI marker (0xFF 0xD8)
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    let soiOffset = -1
    const scanLimit = Math.min(bytes.byteLength - 1, 512)
    for (let i = 0; i < scanLimit; i += 1) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
        soiOffset = i
        break
      }
    }
    if (soiOffset > 0) {
      bytes = bytes.subarray(soiOffset)
    }
  }

  return bytes
}

function analyzePdfStructure(pdfDoc) {
  const indirectObjects = pdfDoc.context.enumerateIndirectObjects()
  const metadataStreamRefs = new Set()
  const visitedMetaObjects = new Set()

  const collectMetaStreams = (val) => {
    if (!val || visitedMetaObjects.has(val)) return
    visitedMetaObjects.add(val)
    if (val instanceof PDFRef) {
      const target = pdfDoc.context.lookup(val)
      if (target instanceof PDFRawStream) {
        metadataStreamRefs.add(val)
      }
      collectMetaStreams(target)
    } else if (val instanceof PDFDict) {
      for (const [, entryVal] of val.entries()) {
        collectMetaStreams(entryVal)
      }
    } else if (val instanceof PDFArray) {
      for (let i = 0; i < val.size(); i += 1) {
        collectMetaStreams(val.get(i))
      }
    } else if (val instanceof PDFRawStream && val.dict) {
      for (const [, entryVal] of val.dict.entries()) {
        collectMetaStreams(entryVal)
      }
    }
  }

  const smaskObjects = new Set()
  const stripKeys = ['PieceInfo', 'Metadata', 'Thumb', 'SpiderInfo', 'StructTreeRoot']

  for (const [, pdfObj] of indirectObjects) {
    const dict =
      pdfObj instanceof PDFDict ? pdfObj : pdfObj instanceof PDFRawStream ? pdfObj.dict : null
    if (!dict) continue

    for (const key of stripKeys) {
      const entry = dict.get(PDFName.of(key))
      if (entry) collectMetaStreams(entry)
    }

    if (
      pdfObj instanceof PDFRawStream &&
      dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image')
    ) {
      const smask = dict.lookup(PDFName.of('SMask'))
      if (smask instanceof PDFRawStream) {
        smaskObjects.add(smask)
      }
    }
  }

  let stripMetadataBytes = 0
  for (const ref of metadataStreamRefs) {
    const streamObj = pdfDoc.context.lookup(ref)
    if (streamObj instanceof PDFRawStream && streamObj.contents) {
      stripMetadataBytes += streamObj.contents.byteLength
    }
  }

  let imageBytes = 0
  let imageCount = 0
  let uncompressedStreamBytes = 0
  const imageSummaries = []

  for (const [ref, pdfObj] of indirectObjects) {
    if (metadataStreamRefs.has(ref)) continue
    if (!(pdfObj instanceof PDFRawStream) || !pdfObj.dict) continue

    const byteLen = pdfObj.contents ? pdfObj.contents.byteLength : 0
    if (byteLen <= 0) continue

    const subtype = pdfObj.dict.lookup(PDFName.of('Subtype'))
    const filters = getFilterNames(pdfObj.dict)

    if (subtype === PDFName.of('Image')) {
      imageBytes += byteLen
      imageCount += 1

      const origW = lookupNumber(pdfObj.dict, 'Width')
      const origH = lookupNumber(pdfObj.dict, 'Height')
      const bpc = lookupNumber(pdfObj.dict, 'BitsPerComponent') || 8
      const isImageMask =
        pdfObj.dict.lookup(PDFName.of('ImageMask')) === PDFBool.True || bpc === 1
      if (isImageMask || origW < 16 || origH < 16) continue

      const isSmask = smaskObjects.has(pdfObj)
      const csInfo = resolveColorSpaceInfo(pdfObj.dict)

      const isDct =
        filters.length > 0 &&
        isDctFilterName(filters[filters.length - 1]) &&
        filters.slice(0, -1).every(isDecodableWrapperFilter)

      const isFlate =
        !isDct &&
        filters.every(isDecodableWrapperFilter) &&
        (bpc === 8 || bpc === 16) &&
        ( isSmask ||
          csInfo.kind === 'rgb' ||
          csInfo.kind === 'cmyk' ||
          csInfo.kind === 'gray' ||
          csInfo.kind === 'indexed' ||
          csInfo.kind === 'unknown')

      if (isDct || isFlate) {
        imageSummaries.push({
          w: origW,
          h: origH,
          bytes: byteLen,
          isFlate: !isDct,
          isSmask,
          isColor:
            !isSmask &&
            (csInfo.kind === 'rgb' ||
              csInfo.kind === 'cmyk' ||
              csInfo.kind === 'indexed' ||
              csInfo.kind === 'unknown'),
        })
      }
    } else if (filters.length === 0 && byteLen > 512) {
      uncompressedStreamBytes += byteLen
    }
  }

  return {
    imageBytes,
    imageCount,
    imageSummaries,
    stripMetadataBytes,
    uncompressedStreamBytes,
  }
}

export function getCompressionConfigFromSlider(sliderValue = 50) {
  const clamped =
    typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
      ? Math.min(100, Math.max(0, sliderValue))
      : 50
  const t = clamped / 100

  let id = 'seimbang'
  let label = 'Seimbang'
  if (clamped < 34) {
    id = 'ringan'
    label = 'Kualitas Tinggi'
  } else if (clamped > 66) {
    id = 'ekstrem'
    label = 'Kualitas Rendah'
  }

  return {
    sliderValue: clamped,
    id,
    label,
    jpegQuality: Number((0.82 - t * 0.48).toFixed(2)),
    scale: Number((0.88 - t * 0.42).toFixed(2)),
    maxDimension: Math.round(2000 - t * 1040),
    ratioFactor: Number((0.15 + t * 0.7).toFixed(3)),
  }
}

export function estimatePdfCompression(items = [], options = {}) {
  const totalOriginalSize = items.reduce((acc, item) => acc + (item.size || 0), 0)
  if (totalOriginalSize <= 0) {
    return {
      totalOriginalSize: 0,
      sliderLabel: 'Seimbang',
      sliderSavedBytes: 0,
      sliderEstimatedSize: 0,
      unusedSavedBytes: 0,
      grayscaleSavedBytes: 0,
      totalSavedBytes: 0,
      estimatedFinalSize: 0,
      estimatedSavedPercent: 0,
    }
  }

  const cfg = getCompressionConfigFromSlider(options.sliderValue ?? 50)
  const q = cfg.jpegQuality

  let sliderSavedBytes = 0
  let unusedSavedBytes = 0
  let grayscaleSavedBytes = 0

  for (const item of items) {
    const fileSize = item.size || 0
    const summaries = Array.isArray(item.imageSummaries) ? item.imageSummaries : null

    // Penghematan dari "Hapus Objek Tak Terpakai" berdasarkan objek nyata di dalam PDF
    const realMetaBytes = item.stripMetadataBytes || 0
    const uncompSave = Math.round((item.uncompressedStreamBytes || 0) * 0.55)
    const xrefCleanupSave = Math.round(fileSize * 0.012)
    unusedSavedBytes += Math.max(64, realMetaBytes + uncompSave + xrefCleanupSave)

    if (summaries && summaries.length > 0) {
      let itemSliderSaved = Math.round(fileSize * 0.012)
      let itemGraySaved = 0

      for (const img of summaries) {
        let targetW = Math.max(1, Math.round(img.w * cfg.scale))
        let targetH = Math.max(1, Math.round(img.h * cfg.scale))
        const longest = Math.max(targetW, targetH)
        if (cfg.maxDimension && longest > cfg.maxDimension) {
          const capRatio = cfg.maxDimension / longest
          targetW = Math.max(1, Math.round(targetW * capRatio))
          targetH = Math.max(1, Math.round(targetH * capRatio))
        }

        const origPixels = Math.max(1, img.w * img.h)
        const targetPixels = targetW * targetH
        const pixelRatio = targetPixels / origPixels

        let estImgBytes = img.bytes
        if (img.isSmask) {
          if (pixelRatio < 0.98) {
            estImgBytes = Math.round(img.bytes * Math.pow(pixelRatio, 0.78))
          }
        } else if (img.isFlate) {
          const bpp = 0.2 + 0.72 * Math.pow(q, 1.5)
          const jpegFromPixels = Math.round(targetPixels * bpp)
          estImgBytes = Math.min(
            img.bytes,
            Math.max(Math.round(img.bytes * 0.08), jpegFromPixels)
          )
        } else {
          const bpp = 0.18 + 0.68 * Math.pow(q, 1.5)
          const jpegFromPixels = Math.round(targetPixels * bpp)
          const jpegFromRatio = Math.round(
            img.bytes * Math.pow(pixelRatio, 0.82) * (0.34 + 0.66 * Math.pow(q, 1.2))
          )
          estImgBytes = Math.min(img.bytes, Math.min(jpegFromPixels, jpegFromRatio))
        }

        const savedOnImg = Math.max(0, img.bytes - estImgBytes)
        itemSliderSaved += savedOnImg

        if (img.isColor) {
          itemGraySaved += Math.round(estImgBytes * 0.16)
        }
      }

      sliderSavedBytes += itemSliderSaved
      grayscaleSavedBytes += itemGraySaved
    } else {
      // Berkas PDF dominan teks/vektor atau tanpa gambar yang dapat dire-encode
      sliderSavedBytes += Math.round(fileSize * (0.015 + cfg.ratioFactor * 0.025))
      grayscaleSavedBytes += 0
    }
  }

  const sliderEstimatedSize = Math.max(
    Math.round(totalOriginalSize * 0.1),
    totalOriginalSize - sliderSavedBytes
  )

  const stripMetadata = options.stripMetadata !== undefined ? Boolean(options.stripMetadata) : true
  const grayscaleImages = Boolean(options.grayscaleImages)

  const rawTotalSaved =
    sliderSavedBytes +
    (stripMetadata ? unusedSavedBytes : 0) +
    (grayscaleImages ? grayscaleSavedBytes : 0)

  const maxAllowedSaved = Math.round(totalOriginalSize * 0.88)
  const totalSavedBytes = Math.min(maxAllowedSaved, rawTotalSaved)
  const estimatedFinalSize = Math.max(
    Math.round(totalOriginalSize * 0.12),
    totalOriginalSize - totalSavedBytes
  )
  const estimatedSavedPercent = Math.max(
    1,
    Math.round(((totalOriginalSize - estimatedFinalSize) / totalOriginalSize) * 100)
  )

  return {
    totalOriginalSize,
    sliderLabel: cfg.label,
    sliderSavedBytes,
    sliderEstimatedSize,
    unusedSavedBytes,
    grayscaleSavedBytes,
    totalSavedBytes,
    estimatedFinalSize,
    estimatedSavedPercent,
  }
}

export function findCompressionPresetForTarget(items = [], targetBytes) {
  const totalOriginalSize = items.reduce((acc, item) => acc + (item.size || 0), 0)
  if (totalOriginalSize <= 0 || !targetBytes || targetBytes <= 0) {
    return {
      sliderValue: 50,
      stripMetadata: true,
      grayscaleImages: false,
      reachable: true,
      alreadyUnderTarget: false,
      estimatedFinalSize: 0,
    }
  }

  if (totalOriginalSize <= targetBytes) {
    const lightEst = estimatePdfCompression(items, {
      sliderValue: 15,
      stripMetadata: true,
      grayscaleImages: false,
    })
    return {
      sliderValue: 15,
      stripMetadata: true,
      grayscaleImages: false,
      reachable: true,
      alreadyUnderTarget: true,
      estimatedFinalSize: lightEst.estimatedFinalSize,
    }
  }

  for (let sv = 0; sv <= 100; sv += 1) {
    const est = estimatePdfCompression(items, {
      sliderValue: sv,
      stripMetadata: true,
      grayscaleImages: false,
    })
    if (est.estimatedFinalSize <= targetBytes) {
      return {
        sliderValue: sv,
        stripMetadata: true,
        grayscaleImages: false,
        reachable: true,
        alreadyUnderTarget: false,
        estimatedFinalSize: est.estimatedFinalSize,
      }
    }
  }

  for (let sv = 0; sv <= 100; sv += 1) {
    const est = estimatePdfCompression(items, {
      sliderValue: sv,
      stripMetadata: true,
      grayscaleImages: true,
    })
    if (est.estimatedFinalSize <= targetBytes) {
      return {
        sliderValue: sv,
        stripMetadata: true,
        grayscaleImages: true,
        reachable: true,
        alreadyUnderTarget: false,
        estimatedFinalSize: est.estimatedFinalSize,
      }
    }
  }

  const maxEst = estimatePdfCompression(items, {
    sliderValue: 100,
    stripMetadata: true,
    grayscaleImages: true,
  })
  return {
    sliderValue: 100,
    stripMetadata: true,
    grayscaleImages: true,
    reachable: false,
    alreadyUnderTarget: false,
    estimatedFinalSize: maxEst.estimatedFinalSize,
  }
}

function computeTargetDimensions(origW, origH, scale, maxDimension, keepDimensions) {
  if (keepDimensions) return { targetW: origW, targetH: origH }
  let targetW = Math.max(1, Math.round(origW * scale))
  let targetH = Math.max(1, Math.round(origH * scale))
  const longest = Math.max(targetW, targetH)
  if (maxDimension && longest > maxDimension) {
    const capRatio = maxDimension / longest
    targetW = Math.max(1, Math.round(targetW * capRatio))
    targetH = Math.max(1, Math.round(targetH * capRatio))
  }
  return { targetW, targetH }
}

function applyGrayscaleToCanvas(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    data[i] = lum
    data[i + 1] = lum
    data[i + 2] = lum
  }
  ctx.putImageData(imgData, 0, 0)
}

async function reencodeJpegBytesInBrowser(
  rawBytes,
  { jpegQuality, scale, maxDimension, grayscaleImages, keepDimensions }
) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || !rawBytes) return null
  const blob = new Blob([rawBytes], { type: 'image/jpeg' })

  let bitmap = null
  let imgEl = null
  let origW = 0
  let origH = 0
  let canvas = null

  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(blob)
        origW = bitmap.width
        origH = bitmap.height
      } catch {
        bitmap = null
      }
    }

    if (!bitmap) {
      const url = URL.createObjectURL(blob)
      try {
        imgEl = await new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = url
        })
        origW = imgEl.naturalWidth || imgEl.width
        origH = imgEl.naturalHeight || imgEl.height
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    if (!origW || !origH) return null

    const { targetW, targetH } = computeTargetDimensions(
      origW,
      origH,
      scale,
      maxDimension,
      keepDimensions
    )

    canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d', { willReadFrequently: Boolean(grayscaleImages) })
    if (!ctx) return null

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
    ctx.drawImage(bitmap || imgEl, 0, 0, targetW, targetH)

    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close()
      bitmap = null
    }

    if (grayscaleImages) {
      applyGrayscaleToCanvas(ctx, targetW, targetH)
    }

    const outBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', jpegQuality)
    )
    if (!outBlob) return null
    const outBuf = await outBlob.arrayBuffer()
    return {
      bytes: new Uint8Array(outBuf),
      width: targetW,
      height: targetH,
    }
  } catch {
    return null
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close()
    }
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}

function isDecodeInverted(dict) {
  const decodeArr = dict?.lookup(PDFName.of('Decode'))
  if (decodeArr instanceof PDFArray && decodeArr.size() >= 2) {
    const first = decodeArr.lookup(0)
    const second = decodeArr.lookup(1)
    if (
      first instanceof PDFNumber &&
      second instanceof PDFNumber &&
      first.asNumber() === 1 &&
      second.asNumber() === 0
    ) {
      return true
    }
  }
  return false
}

function extractIndexedPaletteBytes(lookupObj) {
  if (!lookupObj) return null
  try {
    if (lookupObj instanceof PDFRawStream) {
      return decodeStreamSafely(lookupObj)
    }
    if (lookupObj instanceof PDFHexString || lookupObj instanceof PDFString) {
      return lookupObj.asBytes()
    }
  } catch {
    return null
  }
  return null
}

function unapplyPdfPredictor(rawPixels, dict, origW, origH) {
  if (!rawPixels || !dict) return rawPixels
  let parms = dict.lookup(PDFName.of('DecodeParms'))
  if (parms instanceof PDFArray && parms.size() > 0) {
    parms = parms.lookup(0)
  }
  if (!(parms instanceof PDFDict)) return rawPixels

  const predictor = lookupNumber(parms, 'Predictor') || 1
  if (predictor <= 1) return rawPixels

  const bpc = lookupNumber(parms, 'BitsPerComponent') || lookupNumber(dict, 'BitsPerComponent') || 8
  const columns = lookupNumber(parms, 'Columns') || origW
  let colors = lookupNumber(parms, 'Colors')
  if (!colors) {
    const csInfo = resolveColorSpaceInfo(dict)
    if (csInfo.channels > 0) {
      colors = csInfo.channels
    } else if (predictor >= 10) {
      const inRow = Math.floor(rawPixels.byteLength / origH) - 1
      colors = Math.max(1, Math.round((inRow * 8) / (columns * bpc)))
    } else {
      const inRow = Math.floor(rawPixels.byteLength / origH)
      colors = Math.max(1, Math.round((inRow * 8) / (columns * bpc)))
    }
  }

  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8))
  const rowBytes = Math.ceil((columns * colors * bpc) / 8)

  if (predictor === 2) {
    if (bpc !== 8 || rawPixels.byteLength < origH * rowBytes) return rawPixels
    const out = new Uint8Array(origH * rowBytes)
    for (let y = 0; y < origH; y += 1) {
      const rowStart = y * rowBytes
      for (let i = 0; i < rowBytes; i += 1) {
        const left = i >= bpp ? out[rowStart + i - bpp] : 0
        out[rowStart + i] = (rawPixels[rowStart + i] + left) & 0xff
      }
    }
    return out
  }

  if (predictor >= 10) {
    const inStride = rowBytes + 1
    if (rawPixels.byteLength < origH * inStride) return rawPixels
    const out = new Uint8Array(origH * rowBytes)
    for (let y = 0; y < origH; y += 1) {
      const inOffset = y * inStride
      const outOffset = y * rowBytes
      const prevOutOffset = (y - 1) * rowBytes
      const filterType = rawPixels[inOffset]
      for (let i = 0; i < rowBytes; i += 1) {
        const raw = rawPixels[inOffset + 1 + i]
        const left = i >= bpp ? out[outOffset + i - bpp] : 0
        const up = y > 0 ? out[prevOutOffset + i] : 0
        const upLeft = y > 0 && i >= bpp ? out[prevOutOffset + i - bpp] : 0
        if (filterType === 1) {
          out[outOffset + i] = (raw + left) & 0xff
        } else if (filterType === 2) {
          out[outOffset + i] = (raw + up) & 0xff
        } else if (filterType === 3) {
          out[outOffset + i] = (raw + ((left + up) >> 1)) & 0xff
        } else if (filterType === 4) {
          const p = left + up - upLeft
          const pa = Math.abs(p - left)
          const pb = Math.abs(p - up)
          const pc = Math.abs(p - upLeft)
          const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
          out[outOffset + i] = (raw + pr) & 0xff
        } else {
          out[outOffset + i] = raw
        }
      }
    }
    return out
  }

  return rawPixels
}

async function reencodeFlateImageInBrowser(pdfObj, context, isSmask, options, preset) {
  if (typeof document === 'undefined') return null
  const origW = lookupNumber(pdfObj.dict, 'Width')
  const origH = lookupNumber(pdfObj.dict, 'Height')
  const bpc = lookupNumber(pdfObj.dict, 'BitsPerComponent') || 8
  if (!origW || !origH || origW < 16 || origH < 16 || (bpc !== 8 && bpc !== 16)) {
    return null
  }

  let rawPixels
  try {
    const filters = getFilterNames(pdfObj.dict)
    rawPixels = filters.length > 0 ? decodeStreamSafely(pdfObj) : pdfObj.contents
    rawPixels = unapplyPdfPredictor(rawPixels, pdfObj.dict, origW, origH)
  } catch {
    return null
  }
  if (!rawPixels || rawPixels.byteLength === 0) return null

  if (bpc === 16) {
    const halfLen = Math.floor(rawPixels.byteLength / 2)
    const down8 = new Uint8Array(halfLen)
    for (let i = 0; i < halfLen; i += 1) {
      down8[i] = rawPixels[i * 2]
    }
    rawPixels = down8
  }

  const pixelCount = origW * origH
  const { targetW, targetH } = computeTargetDimensions(
    origW,
    origH,
    preset.scale,
    preset.maxDimension,
    false
  )

  let srcCanvas = null
  let dstCanvas = null

  try {
    // Jika ini adalah Soft Mask (SMask alpha channel), jaga tetap 1-channel DeviceGray FlateDecode
    if (isSmask) {
      if (rawPixels.byteLength < pixelCount) return null
      if (targetW >= origW && targetH >= origH) return null

      const rgba = new Uint8ClampedArray(pixelCount * 4)
      for (let i = 0, dst = 0; i < pixelCount; i += 1, dst += 4) {
        const g = rawPixels[i]
        rgba[dst] = g
        rgba[dst + 1] = g
        rgba[dst + 2] = g
        rgba[dst + 3] = 255
      }

      srcCanvas = document.createElement('canvas')
      srcCanvas.width = origW
      srcCanvas.height = origH
      const srcCtx = srcCanvas.getContext('2d')
      if (!srcCtx) return null
      srcCtx.putImageData(new ImageData(rgba, origW, origH), 0, 0)

      dstCanvas = document.createElement('canvas')
      dstCanvas.width = targetW
      dstCanvas.height = targetH
      const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })
      if (!dstCtx) return null
      dstCtx.drawImage(srcCanvas, 0, 0, targetW, targetH)

      const scaledData = dstCtx.getImageData(0, 0, targetW, targetH).data
      const grayOut = new Uint8Array(targetW * targetH)
      for (let i = 0, src = 0; i < grayOut.length; i += 1, src += 4) {
        grayOut[i] = scaledData[src]
      }

      const flateStream = context.flateStream(grayOut)
      return {
        bytes: flateStream.contents,
        width: targetW,
        height: targetH,
        isFlateGray: true,
      }
    }

    const csInfo = resolveColorSpaceInfo(pdfObj.dict)
    const inverted = isDecodeInverted(pdfObj.dict)
    const rgba = new Uint8ClampedArray(pixelCount * 4)

    if (csInfo.kind === 'indexed' && rawPixels.byteLength >= pixelCount) {
      const palette = extractIndexedPaletteBytes(csInfo.lookupObj)
      if (!palette) return null
      const baseCh = csInfo.baseChannels || 3
      for (let i = 0, dst = 0; i < pixelCount; i += 1, dst += 4) {
        const idx = rawPixels[i] * baseCh
        if (baseCh === 4) {
          const c = (palette[idx] || 0) / 255
          const m = (palette[idx + 1] || 0) / 255
          const y = (palette[idx + 2] || 0) / 255
          const k = (palette[idx + 3] || 0) / 255
          rgba[dst] = Math.round(255 * (1 - c) * (1 - k))
          rgba[dst + 1] = Math.round(255 * (1 - m) * (1 - k))
          rgba[dst + 2] = Math.round(255 * (1 - y) * (1 - k))
        } else if (baseCh === 1) {
          const g = palette[idx] || 0
          rgba[dst] = g
          rgba[dst + 1] = g
          rgba[dst + 2] = g
        } else {
          rgba[dst] = palette[idx] || 0
          rgba[dst + 1] = palette[idx + 1] || 0
          rgba[dst + 2] = palette[idx + 2] || 0
        }
        rgba[dst + 3] = 255
      }
    } else if (
      rawPixels.byteLength >= pixelCount * 3 &&
      rawPixels.byteLength <= pixelCount * 3 + 64
    ) {
      for (let i = 0, src = 0, dst = 0; i < pixelCount; i += 1, src += 3, dst += 4) {
        rgba[dst] = rawPixels[src]
        rgba[dst + 1] = rawPixels[src + 1]
        rgba[dst + 2] = rawPixels[src + 2]
        rgba[dst + 3] = 255
      }
    } else if (
      rawPixels.byteLength >= pixelCount * 4 &&
      rawPixels.byteLength <= pixelCount * 4 + 64
    ) {
      for (let i = 0, src = 0, dst = 0; i < pixelCount; i += 1, src += 4, dst += 4) {
        const c = (inverted ? 255 - rawPixels[src] : rawPixels[src]) / 255
        const m = (inverted ? 255 - rawPixels[src + 1] : rawPixels[src + 1]) / 255
        const y = (inverted ? 255 - rawPixels[src + 2] : rawPixels[src + 2]) / 255
        const k = (inverted ? 255 - rawPixels[src + 3] : rawPixels[src + 3]) / 255
        rgba[dst] = Math.round(255 * (1 - c) * (1 - k))
        rgba[dst + 1] = Math.round(255 * (1 - m) * (1 - k))
        rgba[dst + 2] = Math.round(255 * (1 - y) * (1 - k))
        rgba[dst + 3] = 255
      }
    } else if (
      rawPixels.byteLength >= pixelCount &&
      rawPixels.byteLength <= pixelCount + 64 &&
      (csInfo.kind === 'gray' || csInfo.kind === 'unknown')
    ) {
      for (let i = 0, dst = 0; i < pixelCount; i += 1, dst += 4) {
        const g = inverted ? 255 - rawPixels[i] : rawPixels[i]
        rgba[dst] = g
        rgba[dst + 1] = g
        rgba[dst + 2] = g
        rgba[dst + 3] = 255
      }
    } else {
      return null
    }

    srcCanvas = document.createElement('canvas')
    srcCanvas.width = origW
    srcCanvas.height = origH
    const srcCtx = srcCanvas.getContext('2d')
    if (!srcCtx) return null
    srcCtx.putImageData(new ImageData(rgba, origW, origH), 0, 0)

    dstCanvas = document.createElement('canvas')
    dstCanvas.width = targetW
    dstCanvas.height = targetH
    const dstCtx = dstCanvas.getContext('2d', {
      willReadFrequently: Boolean(options.grayscaleImages),
    })
    if (!dstCtx) return null
    dstCtx.fillStyle = '#ffffff'
    dstCtx.fillRect(0, 0, targetW, targetH)
    dstCtx.drawImage(srcCanvas, 0, 0, targetW, targetH)

    // Bebaskan memori srcCanvas segera
    srcCanvas.width = 0
    srcCanvas.height = 0
    srcCanvas = null

    if (options.grayscaleImages) {
      applyGrayscaleToCanvas(dstCtx, targetW, targetH)
    }

    const outBlob = await new Promise((resolve) =>
      dstCanvas.toBlob(resolve, 'image/jpeg', preset.jpegQuality)
    )
    if (!outBlob) return null
    const outBuf = await outBlob.arrayBuffer()
    return {
      bytes: new Uint8Array(outBuf),
      width: targetW,
      height: targetH,
      isFlateGray: false,
    }
  } catch {
    return null
  } finally {
    if (srcCanvas) {
      srcCanvas.width = 0
      srcCanvas.height = 0
    }
    if (dstCanvas) {
      dstCanvas.width = 0
      dstCanvas.height = 0
    }
  }
}

function sanitizeSmaskMatteForRgb(imageDict) {
  const smask = imageDict?.lookup(PDFName.of('SMask'))
  if (smask instanceof PDFRawStream && smask.dict) {
    const matte = smask.dict.lookup(PDFName.of('Matte'))
    if (matte instanceof PDFArray && matte.size() !== 3) {
      smask.dict.delete(PDFName.of('Matte'))
    }
  }
}

async function compressSinglePdfItem(item, options, preset, onProgress) {
  const originalBuffer = await item.file.arrayBuffer()
  const originalBytes = new Uint8Array(originalBuffer)
  const sourcePdf = await PDFDocument.load(originalBuffer)

  if (options.flattenForms) {
    try {
      sourcePdf.getForm().flatten()
    } catch {
      // Abaikan dokumen yang tidak memiliki formulir AcroForm interaktif
    }
  }

  // Hapus PieceInfo (data privat Illustrator/Photoshop/InDesign), Metadata XMP, dan Thumbnail
  // SEBELUM copyPages agar objek-objek besar tersebut tidak ikut disalin ke dokumen baru
  if (options.stripMetadata) {
    for (const [, obj] of sourcePdf.context.enumerateIndirectObjects()) {
      const dict =
        obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null
      if (!dict) continue
      dict.delete(PDFName.of('PieceInfo'))
      dict.delete(PDFName.of('Metadata'))
      dict.delete(PDFName.of('Thumb'))
      dict.delete(PDFName.of('SpiderInfo'))
      dict.delete(PDFName.of('StructTreeRoot'))
      dict.delete(PDFName.of('StructParents'))
      dict.delete(PDFName.of('StructParent'))
      dict.delete(PDFName.of('LastModified'))
    }
  }

  const cleanPdf = await PDFDocument.create()
  const pageIndices = sourcePdf.getPageIndices()
  const copiedPages = await cleanPdf.copyPages(sourcePdf, pageIndices)
  copiedPages.forEach((page) => {
    if (options.flattenForms) {
      page.node.delete(PDFName.of('Annots'))
    }
    cleanPdf.addPage(page)
  })

  if (options.stripMetadata) {
    cleanPdf.setTitle('')
    cleanPdf.setAuthor('')
    cleanPdf.setSubject('')
    cleanPdf.setKeywords([])
    cleanPdf.setCreator('')
    cleanPdf.setProducer('')
    cleanPdf.catalog.delete(PDFName.of('Metadata'))
    cleanPdf.catalog.delete(PDFName.of('PieceInfo'))
    cleanPdf.catalog.delete(PDFName.of('StructTreeRoot'))
    cleanPdf.catalog.delete(PDFName.of('SpiderInfo'))
    cleanPdf.catalog.delete(PDFName.of('OutputIntents'))
  }

  const indirectObjects = cleanPdf.context.enumerateIndirectObjects()
  const smaskObjects = new Set()
  const stencilMaskObjects = new Set()
  const candidateImages = []

  for (const [, pdfObj] of indirectObjects) {
    if (!(pdfObj instanceof PDFRawStream) || !pdfObj.dict) continue
    if (pdfObj.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) continue

    const smask = pdfObj.dict.lookup(PDFName.of('SMask'))
    if (smask instanceof PDFRawStream) {
      smaskObjects.add(smask)
    }
    const mask = pdfObj.dict.lookup(PDFName.of('Mask'))
    if (mask instanceof PDFRawStream) {
      stencilMaskObjects.add(mask)
    }
    const bpc = lookupNumber(pdfObj.dict, 'BitsPerComponent') || 8
    if (pdfObj.dict.lookup(PDFName.of('ImageMask')) === PDFBool.True || bpc === 1) {
      stencilMaskObjects.add(pdfObj)
    }
    candidateImages.push(pdfObj)
  }

  let optimizedImages = 0
  const totalCandidates = candidateImages.length

  for (let i = 0; i < totalCandidates; i += 1) {
    const pdfObj = candidateImages[i]
    if (stencilMaskObjects.has(pdfObj)) continue

    if (onProgress && (i === 0 || (i + 1) % 4 === 0 || i === totalCandidates - 1)) {
      onProgress(
        `Mengoptimalkan gambar (${i + 1}/${totalCandidates}) pada "${truncateFileName(item.name, 22)}"...`
      )
      await new Promise((r) => setTimeout(r, 0))
    }

    const filters = getFilterNames(pdfObj.dict)
    const isSmask = smaskObjects.has(pdfObj)
    const isDct =
      filters.length > 0 &&
      isDctFilterName(filters[filters.length - 1]) &&
      filters.slice(0, -1).every(isDecodableWrapperFilter)

    if (isDct && !isSmask) {
      const jpegSource = extractJpegBytesFromStream(pdfObj, filters)
      if (!jpegSource) continue

      const reencoded = await reencodeJpegBytesInBrowser(jpegSource, {
        jpegQuality: preset.jpegQuality,
        scale: preset.scale,
        maxDimension: preset.maxDimension,
        grayscaleImages: Boolean(options.grayscaleImages),
        keepDimensions: false,
      })

      if (
        reencoded &&
        (reencoded.bytes.byteLength < pdfObj.contents.byteLength || options.grayscaleImages)
      ) {
        pdfObj.contents = reencoded.bytes
        pdfObj.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
        pdfObj.dict.delete(PDFName.of('DecodeParms'))
        pdfObj.dict.delete(PDFName.of('Decode'))
        pdfObj.dict.set(PDFName.of('Width'), PDFNumber.of(reencoded.width))
        pdfObj.dict.set(PDFName.of('Height'), PDFNumber.of(reencoded.height))
        pdfObj.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'))
        pdfObj.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
        pdfObj.dict.set(PDFName.of('Length'), PDFNumber.of(reencoded.bytes.byteLength))
        sanitizeSmaskMatteForRgb(pdfObj.dict)
        optimizedImages += 1
      }
    } else if (filters.every(isDecodableWrapperFilter)) {
      const reencoded = await reencodeFlateImageInBrowser(
        pdfObj,
        cleanPdf.context,
        isSmask,
        options,
        preset
      )

      if (
        reencoded &&
        (reencoded.bytes.byteLength < pdfObj.contents.byteLength ||
          (options.grayscaleImages && !isSmask))
      ) {
        pdfObj.contents = reencoded.bytes
        pdfObj.dict.set(
          PDFName.of('Filter'),
          PDFName.of(reencoded.isFlateGray ? 'FlateDecode' : 'DCTDecode')
        )
        pdfObj.dict.delete(PDFName.of('DecodeParms'))
        pdfObj.dict.delete(PDFName.of('Decode'))
        pdfObj.dict.set(PDFName.of('Width'), PDFNumber.of(reencoded.width))
        pdfObj.dict.set(PDFName.of('Height'), PDFNumber.of(reencoded.height))
        pdfObj.dict.set(
          PDFName.of('ColorSpace'),
          PDFName.of(reencoded.isFlateGray ? 'DeviceGray' : 'DeviceRGB')
        )
        pdfObj.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
        pdfObj.dict.set(PDFName.of('Length'), PDFNumber.of(reencoded.bytes.byteLength))
        if (!reencoded.isFlateGray) {
          sanitizeSmaskMatteForRgb(pdfObj.dict)
        }
        optimizedImages += 1
      }
    }
  }

  // Kompres stream non-gambar yang belum terkompresi sama sekali
  for (const [, pdfObj] of indirectObjects) {
    if (!(pdfObj instanceof PDFRawStream) || !pdfObj.dict || !pdfObj.contents) continue
    if (pdfObj.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image')) continue
    const filters = getFilterNames(pdfObj.dict)
    if (filters.length === 0 && pdfObj.contents.byteLength > 512) {
      try {
        const flate = cleanPdf.context.flateStream(pdfObj.contents)
        if (flate.contents.byteLength < pdfObj.contents.byteLength) {
          pdfObj.contents = flate.contents
          pdfObj.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'))
          pdfObj.dict.set(PDFName.of('Length'), PDFNumber.of(flate.contents.byteLength))
        }
      } catch {
        // Biarkan stream asli bila gagal dikompres
      }
    }
  }

  if (onProgress) {
    onProgress(`Menyusun ulang struktur akhir "${truncateFileName(item.name, 24)}"...`)
    await new Promise((r) => setTimeout(r, 0))
  }

  const candidateBytes = await cleanPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  })

  const useOriginal =
    candidateBytes.byteLength >= originalBytes.byteLength &&
    !options.grayscaleImages &&
    !options.flattenForms
  const finalBytes = useOriginal ? originalBytes : candidateBytes
  const savedBytes = Math.max(0, originalBytes.byteLength - finalBytes.byteLength)
  const savedPercent =
    originalBytes.byteLength > 0
      ? Math.max(0, Math.round((savedBytes / originalBytes.byteLength) * 100))
      : 0

  const baseName = stripPdfExtension(item.name)
  const outName = `${baseName}-kompres.pdf`

  return {
    id: item.id,
    sourceName: item.name,
    name: outName,
    pageCount: item.pageCount || pageIndices.length,
    originalSize: originalBytes.byteLength,
    compressedSize: finalBytes.byteLength,
    savedBytes,
    savedPercent,
    optimizedImages,
    alreadyOptimal: savedBytes === 0,
    bytes: finalBytes,
  }
}

export async function compressPdfFiles(items = [], options = {}, onProgress) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Pilih minimal 1 berkas PDF terlebih dahulu untuk dikompres.')
  }

  const preset = getCompressionConfigFromSlider(options.sliderValue ?? 50)
  const normalizedOptions = {
    level: preset.id,
    stripMetadata: options.stripMetadata !== undefined ? Boolean(options.stripMetadata) : true,
    grayscaleImages: Boolean(options.grayscaleImages),
    flattenForms: Boolean(options.stripMetadata),
  }

  const results = []
  let totalOriginalSize = 0
  let totalCompressedSize = 0
  let totalPages = 0

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx]
    if (onProgress) {
      onProgress(
        `Mengompres (${idx + 1}/${items.length}): "${truncateFileName(item.name, 28)}"...`
      )
    }
    const res = await compressSinglePdfItem(item, normalizedOptions, preset, onProgress)
    results.push(res)
    totalOriginalSize += res.originalSize
    totalCompressedSize += res.compressedSize
    totalPages += res.pageCount
  }

  let zipBlob = null
  let zipFileName = null
  if (results.length > 1) {
    if (onProgress) {
      onProgress(`Mengemas ${results.length} berkas PDF terkompresi ke dalam arsip .zip...`)
    }
    const zip = new JSZip()
    const usedNames = new Set()
    results.forEach((f, idx) => {
      let entryName = f.name
      if (usedNames.has(entryName)) {
        entryName = `${stripPdfExtension(f.sourceName)}-kompres-${idx + 1}.pdf`
      }
      usedNames.add(entryName)
      zip.file(entryName, f.bytes)
    })
    zipBlob = await zip.generateAsync({ type: 'blob' })
    const firstBase = stripPdfExtension(items[0]?.name || 'dokumen')
    zipFileName = `${firstBase}-kompres-${results.length}-file.zip`
  }

  const totalSavedBytes = Math.max(0, totalOriginalSize - totalCompressedSize)
  const totalSavedPercent =
    totalOriginalSize > 0
      ? Math.max(0, Math.round((totalSavedBytes / totalOriginalSize) * 100))
      : 0

  return {
    level: preset.id,
    levelLabel: preset.label,
    fileCount: results.length,
    totalPages,
    totalOriginalSize,
    totalCompressedSize,
    totalSavedBytes,
    totalSavedPercent,
    primaryFile: results[0] || null,
    files: results,
    zipBlob,
    zipFileName,
  }
}

function decodePdfStringBytes(raw = '') {
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1]
      if (next === '\r' && raw[i + 2] === '\n') {
        i += 2
        continue
      }
      if (next === '\n' || next === '\r') {
        i += 1
        continue
      }
      if (next >= '0' && next <= '7') {
        let oct = next
        i += 1
        if (i + 1 < raw.length && raw[i + 1] >= '0' && raw[i + 1] <= '7') {
          oct += raw[(i += 1)]
        }
        if (i + 1 < raw.length && raw[i + 1] >= '0' && raw[i + 1] <= '7') {
          oct += raw[(i += 1)]
        }
        out += String.fromCharCode(parseInt(oct, 8) & 0xff)
      } else {
        i += 1
        if (next === 'n') out += '\n'
        else if (next === 'r') out += '\r'
        else if (next === 't') out += '\t'
        else if (next === 'b') out += '\b'
        else if (next === 'f') out += '\f'
        else out += next
      }
    } else {
      out += ch
    }
  }
  return out
}

function decodeHexPdfBytes(hexRaw = '') {
  const clean = hexRaw.replace(/[^0-9A-Fa-f]/g, '')
  if (!clean) return ''
  let out = ''
  for (let i = 0; i < clean.length; i += 2) {
    const pair = clean.slice(i, i + 2).padEnd(2, '0')
    out += String.fromCharCode(parseInt(pair, 16) & 0xff)
  }
  return out
}

function hexToUnicodeString(hexStr = '') {
  const clean = hexStr.replace(/[^0-9A-Fa-f]/g, '')
  if (!clean) return ''
  if (clean.length <= 2) {
    return String.fromCharCode(parseInt(clean, 16))
  }
  let out = ''
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4)
    const code = parseInt(chunk, 16)
    if (!Number.isNaN(code) && code > 0) {
      out += String.fromCharCode(code)
    }
  }
  return out
}

function parseToUnicodeCMap(cmapText = '') {
  const map = new Map()
  let isTwoByte = false

  const bfcharRegex = /beginbfchar([\s\S]*?)endbfchar/g
  let match
  while ((match = bfcharRegex.exec(cmapText)) !== null) {
    const block = match[1]
    const pairRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g
    let pair
    while ((pair = pairRegex.exec(block)) !== null) {
      const srcHex = pair[1]
      const dstHex = pair[2]
      if (srcHex.length >= 4) isTwoByte = true
      const code = parseInt(srcHex, 16)
      const str = hexToUnicodeString(dstHex)
      if (!Number.isNaN(code) && str) {
        map.set(code, str)
      }
    }
  }

  const bfrangeRegex = /beginbfrange([\s\S]*?)endbfrange/g
  while ((match = bfrangeRegex.exec(cmapText)) !== null) {
    const block = match[1]
    const rangeRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g
    let rng
    while ((rng = rangeRegex.exec(block)) !== null) {
      const startHex = rng[1]
      const endHex = rng[2]
      if (startHex.length >= 4) isTwoByte = true
      const startCode = parseInt(startHex, 16)
      const endCode = parseInt(endHex, 16)
      if (Number.isNaN(startCode) || Number.isNaN(endCode) || endCode < startCode) continue
      const count = Math.min(512, endCode - startCode + 1)

      if (rng[3] !== undefined) {
        const baseStr = hexToUnicodeString(rng[3])
        const baseCodePoint = baseStr ? baseStr.charCodeAt(baseStr.length - 1) : 0
        const prefix = baseStr.length > 1 ? baseStr.slice(0, -1) : ''
        for (let offset = 0; offset < count; offset += 1) {
          map.set(startCode + offset, prefix + String.fromCharCode(baseCodePoint + offset))
        }
      } else if (rng[4] !== undefined) {
        const arrHexRegex = /<([0-9A-Fa-f]+)>/g
        let itemMatch
        let offset = 0
        while ((itemMatch = arrHexRegex.exec(rng[4])) !== null && offset < count) {
          const str = hexToUnicodeString(itemMatch[1])
          if (str) map.set(startCode + offset, str)
          offset += 1
        }
      }
    }
  }

  return { map, isTwoByte }
}

const STANDARD_GLYPH_NAME_MAP = {
  space: ' ',
  exclam: '!',
  quotedbl: '"',
  numbersign: '#',
  dollar: '$',
  percent: '%',
  ampersand: '&',
  quotesingle: "'",
  quoteright: "'",
  quoteleft: "'",
  parenleft: '(',
  parenright: ')',
  asterisk: '*',
  plus: '+',
  comma: ',',
  hyphen: '-',
  minus: '-',
  endash: '-',
  emdash: '-',
  period: '.',
  slash: '/',
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  colon: ':',
  semicolon: ';',
  less: '<',
  equal: '=',
  greater: '>',
  question: '?',
  at: '@',
  bracketleft: '[',
  backslash: '\\',
  bracketright: ']',
  underscore: '_',
  braceleft: '{',
  bar: '|',
  braceright: '}',
  bullet: '•',
}

function extractFontsFromResources(resourcesDict, context, targetMap = new Map()) {
  if (!(resourcesDict instanceof PDFDict)) return targetMap
  try {
    const fontDictObj = context.lookup(resourcesDict.get(PDFName.of('Font')))
    if (!(fontDictObj instanceof PDFDict)) return targetMap

    const entries = fontDictObj.entries()
    for (let i = 0; i < entries.length; i += 1) {
      const [keyName, fontRef] = entries[i]
      const cleanKey = keyName.decodeText ? keyName.decodeText() : String(keyName).replace(/^\//, '')
      const fontDict = context.lookup(fontRef)
      if (!(fontDict instanceof PDFDict)) continue

      const subtypeObj = fontDict.lookup(PDFName.of('Subtype'))
      const subtypeStr = subtypeObj ? String(subtypeObj) : ''
      const baseFontObj = fontDict.lookup(PDFName.of('BaseFont'))
      const baseFontStr = baseFontObj ? String(baseFontObj) : ''
      const isBold = /bold|black|heavy|demi|semibold/i.test(`${cleanKey} ${baseFontStr}`)

      const encodingObj = context.lookup(fontDict.get(PDFName.of('Encoding')))
      const encodingStr = encodingObj ? String(encodingObj) : ''
      let isTwoByte =
        subtypeStr.includes('Type0') ||
        /Identity-H|Identity-V/i.test(encodingStr)

      let toUnicodeMap = new Map()
      const toUniObj = context.lookup(fontDict.get(PDFName.of('ToUnicode')))
      if (toUniObj instanceof PDFRawStream) {
        try {
          const bytes = decodeStreamSafely(toUniObj)
          const cmapStr = new TextDecoder('latin1').decode(bytes)
          const parsed = parseToUnicodeCMap(cmapStr)
          toUnicodeMap = parsed.map
          if (parsed.isTwoByte) isTwoByte = true
        } catch {
          // Ignore unreadable ToUnicode stream
        }
      }

      const differencesMap = new Map()
      if (encodingObj instanceof PDFDict) {
        const diffArr = context.lookup(encodingObj.get(PDFName.of('Differences')))
        if (diffArr instanceof PDFArray) {
          let codeCursor = 0
          for (let d = 0; d < diffArr.size(); d += 1) {
            const elem = context.lookup(diffArr.get(d))
            if (elem instanceof PDFNumber) {
              codeCursor = elem.asNumber()
            } else if (elem instanceof PDFName) {
              const gName = elem.decodeText ? elem.decodeText() : String(elem).replace(/^\//, '')
              if (gName.length === 1) {
                differencesMap.set(codeCursor, gName)
              } else if (STANDARD_GLYPH_NAME_MAP[gName]) {
                differencesMap.set(codeCursor, STANDARD_GLYPH_NAME_MAP[gName])
              } else if (/^uni([0-9A-Fa-f]{4})$/.test(gName)) {
                differencesMap.set(
                  codeCursor,
                  String.fromCharCode(parseInt(gName.slice(3), 16))
                )
              }
              codeCursor += 1
            }
          }
        }
      }

      targetMap.set(cleanKey, {
        name: cleanKey,
        baseFont: baseFontStr,
        isBold,
        isTwoByte,
        toUnicodeMap,
        differencesMap,
      })
    }
  } catch {
    // Ignore font resource lookup failure
  }
  return targetMap
}

function decodeRawBytesWithFont(rawBytesStr = '', fontInfo = null) {
  if (!rawBytesStr) return ''
  const len = rawBytesStr.length

  if (fontInfo && fontInfo.toUnicodeMap && fontInfo.toUnicodeMap.size > 0) {
    const { toUnicodeMap, isTwoByte } = fontInfo
    let out = ''
    if (isTwoByte && len >= 2 && len % 2 === 0) {
      for (let i = 0; i < len; i += 2) {
        const code16 = ((rawBytesStr.charCodeAt(i) & 0xff) << 8) | (rawBytesStr.charCodeAt(i + 1) & 0xff)
        if (toUnicodeMap.has(code16)) {
          out += toUnicodeMap.get(code16)
        } else {
          const single = toUnicodeMap.get(rawBytesStr.charCodeAt(i + 1) & 0xff)
          if (single) out += single
          else if (code16 >= 32 && code16 <= 591) out += String.fromCharCode(code16)
        }
      }
      if (out.trim()) return cleanDecodedText(out)
    }

    out = ''
    for (let i = 0; i < len; i += 1) {
      const code8 = rawBytesStr.charCodeAt(i) & 0xff
      if (toUnicodeMap.has(code8)) {
        out += toUnicodeMap.get(code8)
      } else if (fontInfo.differencesMap?.has(code8)) {
        out += fontInfo.differencesMap.get(code8)
      } else if (code8 >= 32) {
        out += String.fromCharCode(code8)
      }
    }
    if (out.trim()) return cleanDecodedText(out)
  }

  if (fontInfo && fontInfo.differencesMap && fontInfo.differencesMap.size > 0) {
    let out = ''
    for (let i = 0; i < len; i += 1) {
      const code8 = rawBytesStr.charCodeAt(i) & 0xff
      if (fontInfo.differencesMap.has(code8)) {
        out += fontInfo.differencesMap.get(code8)
      } else if (code8 >= 32) {
        out += String.fromCharCode(code8)
      }
    }
    if (out.trim()) return cleanDecodedText(out)
  }

  if (len >= 2 && len % 2 === 0) {
    let zeroHighCount = 0
    for (let i = 0; i < len; i += 2) {
      if (rawBytesStr.charCodeAt(i) === 0) zeroHighCount += 1
    }
    if (zeroHighCount >= len / 4) {
      let utf16Out = ''
      let shiftedOut = ''
      for (let i = 0; i < len; i += 2) {
        const code16 = ((rawBytesStr.charCodeAt(i) & 0xff) << 8) | (rawBytesStr.charCodeAt(i + 1) & 0xff)
        if (code16 >= 32 && code16 <= 591) {
          utf16Out += String.fromCharCode(code16)
        } else if (code16 >= 3 && code16 <= 95) {
          shiftedOut += String.fromCharCode(code16 + 29)
        }
      }
      if (utf16Out.trim()) return cleanDecodedText(utf16Out)
      if (shiftedOut.trim()) return cleanDecodedText(shiftedOut)
    }
  }

  return cleanDecodedText(rawBytesStr)
}

function cleanDecodedText(raw = '') {
  if (!raw) return ''
  let sanitized = ''
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i)
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 591) || code === 8226) {
      sanitized += raw[i]
    } else if (code === 9 || code === 10 || code === 13) {
      sanitized += ' '
    }
  }
  return sanitized.replace(/\s+/g, ' ')
}

function multiplyPdfMatrix(m1, m2) {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m1[5],
  ]
}

function applyPdfMatrixToPoint(m, x, y) {
  return {
    x: x * m[0] + y * m[2] + m[4],
    y: x * m[1] + y * m[3] + m[5],
  }
}

async function decodeResourcesXObjects(resourcesDict, context, imageMap = new Map(), formMap = new Map(), fontMap = new Map(), depth = 0) {
  if (!(resourcesDict instanceof PDFDict) || depth > 4) {
    return { imageMap, formMap, fontMap }
  }

  extractFontsFromResources(resourcesDict, context, fontMap)

  try {
    const xObjectDict = context.lookup(resourcesDict.get(PDFName.of('XObject')))
    if (!(xObjectDict instanceof PDFDict)) {
      return { imageMap, formMap, fontMap }
    }

    const entries = xObjectDict.entries()
    for (let i = 0; i < entries.length; i += 1) {
      const [keyName, refObj] = entries[i]
      const cleanKey = keyName.decodeText ? keyName.decodeText() : String(keyName).replace(/^\//, '')
      const stream = context.lookup(refObj)
      if (!(stream instanceof PDFRawStream)) continue

      const subtype = stream.dict.lookup(PDFName.of('Subtype'))
      if (subtype === PDFName.of('Form')) {
        const formRes = context.lookup(stream.dict.get(PDFName.of('Resources')))
        let matrix = [1, 0, 0, 1, 0, 0]
        const matArr = context.lookup(stream.dict.get(PDFName.of('Matrix')))
        if (matArr instanceof PDFArray && matArr.size() >= 6) {
          const m = []
          for (let k = 0; k < 6; k += 1) {
            const v = context.lookup(matArr.get(k))
            m.push(v instanceof PDFNumber ? v.asNumber() : k === 0 || k === 3 ? 1 : 0)
          }
          matrix = m
        }
        formMap.set(cleanKey, { stream, matrix, resources: formRes })
        if (formRes instanceof PDFDict) {
          await decodeResourcesXObjects(formRes, context, imageMap, formMap, fontMap, depth + 1)
        }
        continue
      }

      if (subtype !== PDFName.of('Image')) continue

      const width = lookupNumber(stream.dict, 'Width')
      const height = lookupNumber(stream.dict, 'Height')
      if (!width || !height || width <= 0 || height <= 0) continue

      const filterNames = getFilterNames(stream.dict)
      const lastFilter = filterNames[filterNames.length - 1] || ''

      if (isDctFilterName(lastFilter)) {
        let jpegBytes = null
        try {
          jpegBytes = extractJpegBytesFromStream(stream, filterNames)
        } catch {
          jpegBytes = null
        }
        if (!jpegBytes) continue
        const blob = new Blob([jpegBytes], { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        try {
          const img = await new Promise((resolve, reject) => {
            const el = new Image()
            el.onload = () => resolve(el)
            el.onerror = reject
            el.src = url
          })
          imageMap.set(cleanKey, img)
        } catch {
          // Skip unreadable embedded JPEG
        } finally {
          URL.revokeObjectURL(url)
        }
      } else if (
        isDecodableWrapperFilter(lastFilter) ||
        filterNames.length === 0
      ) {
        const bpc = lookupNumber(stream.dict, 'BitsPerComponent') || 8
        if (bpc !== 8 && bpc !== 16) continue
        const csInfo = resolveColorSpaceInfo(stream.dict)
        if (!csInfo || !csInfo.channels) continue
        let decoded
        try {
          decoded = filterNames.length > 0 ? decodeStreamSafely(stream) : stream.contents
          decoded = unapplyPdfPredictor(decoded, stream.dict, width, height)
        } catch {
          continue
        }
        if (!decoded || decoded.byteLength === 0) continue
        if (bpc === 16) {
          const half = new Uint8Array(Math.floor(decoded.byteLength / 2))
          for (let hIdx = 0; hIdx < half.length; hIdx += 1) {
            half[hIdx] = decoded[hIdx * 2]
          }
          decoded = half
        }

        const pixelCount = width * height
        if (decoded.byteLength < pixelCount) continue

        let smaskBytes = null
        try {
          const smaskObj = context.lookup(stream.dict.get(PDFName.of('SMask')))
          if (smaskObj instanceof PDFRawStream) {
            const smFilters = getFilterNames(smaskObj.dict)
            const smRaw = smFilters.length > 0 ? decodeStreamSafely(smaskObj) : smaskObj.contents
            const smW = lookupNumber(smaskObj.dict, 'Width') || width
            const smH = lookupNumber(smaskObj.dict, 'Height') || height
            const smUnpred = unapplyPdfPredictor(smRaw, smaskObj.dict, smW, smH)
            if (smUnpred && smUnpred.byteLength >= pixelCount) {
              smaskBytes = smUnpred
            }
          }
        } catch {
          smaskBytes = null
        }

        const offCanvas = document.createElement('canvas')
        offCanvas.width = width
        offCanvas.height = height
        const offCtx = offCanvas.getContext('2d')
        const imgData = offCtx.createImageData(width, height)
        const dst = imgData.data

        if (csInfo.kind === 'rgb' && decoded.byteLength >= pixelCount * 3) {
          for (let p = 0, s = 0, d = 0; p < pixelCount; p += 1, s += 3, d += 4) {
            dst[d] = decoded[s]
            dst[d + 1] = decoded[s + 1]
            dst[d + 2] = decoded[s + 2]
            dst[d + 3] = smaskBytes ? smaskBytes[p] : 255
          }
        } else if (csInfo.kind === 'cmyk' && decoded.byteLength >= pixelCount * 4) {
          for (let p = 0, s = 0, d = 0; p < pixelCount; p += 1, s += 4, d += 4) {
            const c = decoded[s] / 255
            const m = decoded[s + 1] / 255
            const y = decoded[s + 2] / 255
            const k = decoded[s + 3] / 255
            dst[d] = Math.round(255 * (1 - c) * (1 - k))
            dst[d + 1] = Math.round(255 * (1 - m) * (1 - k))
            dst[d + 2] = Math.round(255 * (1 - y) * (1 - k))
            dst[d + 3] = smaskBytes ? smaskBytes[p] : 255
          }
        } else if (csInfo.kind === 'gray') {
          for (let p = 0, d = 0; p < pixelCount; p += 1, d += 4) {
            const v = decoded[p]
            dst[d] = v
            dst[d + 1] = v
            dst[d + 2] = v
            dst[d + 3] = smaskBytes ? smaskBytes[p] : 255
          }
        } else if (csInfo.kind === 'indexed') {
          const pal = extractIndexedPaletteBytes(csInfo.lookupObj)
          if (!pal) continue
          const palChannels = csInfo.baseChannels || 3
          for (let p = 0, d = 0; p < pixelCount; p += 1, d += 4) {
            const idx = decoded[p] * palChannels
            if (palChannels === 3) {
              dst[d] = pal[idx] || 0
              dst[d + 1] = pal[idx + 1] || 0
              dst[d + 2] = pal[idx + 2] || 0
            } else {
              const v = pal[idx] || 0
              dst[d] = v
              dst[d + 1] = v
              dst[d + 2] = v
            }
            dst[d + 3] = smaskBytes ? smaskBytes[p] : 255
          }
        } else {
          continue
        }
        offCtx.putImageData(imgData, 0, 0)
        imageMap.set(cleanKey, offCanvas)
      }
    }
  } catch {
    // Return partial maps if resource lookup fails
  }
  return { imageMap, formMap, fontMap }
}

function tokenizePdfContentStream(contentStr) {
  const tokens = []
  let i = 0
  const len = contentStr.length

  while (i < len) {
    const ch = contentStr[i]
    if (ch <= ' ') {
      i += 1
      continue
    }
    if (ch === '%') {
      while (i < len && contentStr[i] !== '\n' && contentStr[i] !== '\r') i += 1
      continue
    }
    if (ch === '(') {
      let depth = 1
      i += 1
      let buf = ''
      while (i < len && depth > 0) {
        const c = contentStr[i]
        if (c === '\\') {
          buf += c
          i += 1
          if (i < len) {
            buf += contentStr[i]
            i += 1
          }
          continue
        }
        if (c === '(') depth += 1
        else if (c === ')') {
          depth -= 1
          if (depth === 0) {
            i += 1
            break
          }
        }
        buf += c
        i += 1
      }
      tokens.push({ type: 'str', value: decodePdfStringBytes(buf) })
      continue
    }
    if (ch === '<' && contentStr[i + 1] === '<') {
      i += 2
      continue
    }
    if (ch === '>' && contentStr[i + 1] === '>') {
      i += 2
      continue
    }
    if (ch === '<') {
      i += 1
      let hex = ''
      while (i < len && contentStr[i] !== '>') {
        hex += contentStr[i]
        i += 1
      }
      if (i < len && contentStr[i] === '>') i += 1
      tokens.push({ type: 'str', value: decodeHexPdfBytes(hex) })
      continue
    }
    if (ch === '[') {
      i += 1
      const arr = []
      while (i < len && contentStr[i] !== ']') {
        const c = contentStr[i]
        if (c <= ' ') {
          i += 1
          continue
        }
        if (c === '(') {
          let depth = 1
          i += 1
          let buf = ''
          while (i < len && depth > 0) {
            const sc = contentStr[i]
            if (sc === '\\') {
              buf += sc
              i += 1
              if (i < len) {
                buf += contentStr[i]
                i += 1
              }
              continue
            }
            if (sc === '(') depth += 1
            else if (sc === ')') {
              depth -= 1
              if (depth === 0) {
                i += 1
                break
              }
            }
            buf += sc
            i += 1
          }
          arr.push({ type: 'str', value: decodePdfStringBytes(buf) })
          continue
        }
        if (c === '<') {
          i += 1
          let hex = ''
          while (i < len && contentStr[i] !== '>') {
            hex += contentStr[i]
            i += 1
          }
          if (i < len && contentStr[i] === '>') i += 1
          arr.push({ type: 'str', value: decodeHexPdfBytes(hex) })
          continue
        }
        let word = ''
        while (
          i < len &&
          contentStr[i] > ' ' &&
          contentStr[i] !== '[' &&
          contentStr[i] !== ']' &&
          contentStr[i] !== '(' &&
          contentStr[i] !== '<'
        ) {
          word += contentStr[i]
          i += 1
        }
        const num = Number(word)
        if (!Number.isNaN(num)) {
          arr.push({ type: 'num', value: num })
        }
      }
      if (i < len && contentStr[i] === ']') i += 1
      tokens.push({ type: 'arr', value: arr })
      continue
    }
    if (ch === '/') {
      i += 1
      let name = ''
      while (
        i < len &&
        contentStr[i] > ' ' &&
        !'()<>[]{}/%'.includes(contentStr[i])
      ) {
        name += contentStr[i]
        i += 1
      }
      tokens.push({ type: 'name', value: name })
      continue
    }

    let word = ''
    while (
      i < len &&
      contentStr[i] > ' ' &&
      !'()<>[]{}/%'.includes(contentStr[i])
    ) {
      word += contentStr[i]
      i += 1
    }
    if (!word) {
      i += 1
      continue
    }
    const num = Number(word)
    if (!Number.isNaN(num)) {
      tokens.push({ type: 'num', value: num })
    } else {
      tokens.push({ type: 'op', value: word })
    }
  }

  return tokens
}

function decodeContentStreamsToText(contentsObj, context) {
  const streams = []
  const resolved = context.lookup(contentsObj)
  if (resolved instanceof PDFRawStream) {
    streams.push(resolved)
  } else if (resolved instanceof PDFArray) {
    for (let i = 0; i < resolved.size(); i += 1) {
      const item = context.lookup(resolved.get(i))
      if (item instanceof PDFRawStream) streams.push(item)
    }
  }

  let combined = ''
  for (let i = 0; i < streams.length; i += 1) {
    let bytes
    try {
      bytes = decodeStreamSafely(streams[i])
    } catch {
      bytes = streams[i].contents
    }
    if (!bytes || !bytes.byteLength) continue
    const sliceLen = Math.min(bytes.byteLength, 240000)
    combined += `${new TextDecoder('latin1').decode(bytes.subarray(0, sliceLen))}\n`
  }
  return combined
}

async function renderPdfPageWithPdfJs(fileOrBuffer, pageNumber, options = {}) {
  let pdfjsDoc = options.pdfjsDoc || null
  let shouldDestroy = false
  let objectUrl = null

  if (!pdfjsDoc) {
    const docInit = {
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: Boolean(options.disableFontFace),
    }
    if (fileOrBuffer instanceof Blob) {
      objectUrl = URL.createObjectURL(fileOrBuffer)
      const loadingTask = pdfjsLib.getDocument({
        ...docInit,
        url: objectUrl,
        disableAutoFetch: true,
      })
      pdfjsDoc = await loadingTask.promise
    } else {
      const loadingTask = pdfjsLib.getDocument({
        ...docInit,
        data: new Uint8Array(fileOrBuffer.slice(0)),
      })
      pdfjsDoc = await loadingTask.promise
    }
    shouldDestroy = true
  }

  try {
    const safePageNum = Math.max(1, Math.min(pdfjsDoc.numPages, Number(pageNumber) || 1))
    const page = await pdfjsDoc.getPage(safePageNum)
    const baseViewport = page.getViewport({ scale: 1 })

    const targetMaxDim = Number(options.maxDimension) || 1080
    const maxScaleCap = Number(options.maxScale) || 2.2
    const scale = Math.min(
      maxScaleCap,
      targetMaxDim / Math.max(baseViewport.width, baseViewport.height, 1)
    )
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    const ctx = canvas.getContext('2d', { alpha: false })

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({
      canvasContext: ctx,
      viewport,
      intent: 'display',
      annotationMode: 0,
    }).promise

    try {
      page.cleanup()
    } catch {
      // Ignore page cleanup errors
    }

    const mimeType = options.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    const quality = typeof options.quality === 'number' ? options.quality : 0.92

    return {
      canvas,
      dataUrl: canvas.toDataURL(mimeType, quality),
      width: Math.round(baseViewport.width),
      height: Math.round(baseViewport.height),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
    }
  } finally {
    if (shouldDestroy && pdfjsDoc) {
      try {
        await pdfjsDoc.destroy()
      } catch {
        // Ignore cleanup errors
      }
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

export async function renderPdfPagePreviewToDataUrl(file, pageNumber = 1, options = {}) {
  if (!file) return null

  try {
    const source = options.arrayBuffer || file
    const rendered = await renderPdfPageWithPdfJs(source, pageNumber, options)
    let singlePagePdfBytes = null
    if (!options.skipSinglePagePdf) {
      try {
        const arrayBuffer = options.arrayBuffer || (await file.arrayBuffer())
        const pdfDoc =
          options.pdfDoc || (await PDFDocument.load(arrayBuffer, { ignoreEncryption: true }))
        const totalPages = pdfDoc.getPageCount()
        const safePageIdx = Math.max(0, Math.min(totalPages - 1, (Number(pageNumber) || 1) - 1))
        const singleDoc = await PDFDocument.create()
        const [copiedPage] = await singleDoc.copyPages(pdfDoc, [safePageIdx])
        singleDoc.addPage(copiedPage)
        singlePagePdfBytes = await singleDoc.save()
      } catch {
        singlePagePdfBytes = null
      }
    }
    return {
      ...rendered,
      singlePagePdfBytes,
      renderedElements: 1,
    }
  } catch {
    // Fall back to lightweight pdf-lib stream renderer if PDF.js fails
  }

  const arrayBuffer = options.arrayBuffer || (await file.arrayBuffer())

  const pdfDoc = options.pdfDoc || (await PDFDocument.load(arrayBuffer, { ignoreEncryption: true }))
  const totalPages = pdfDoc.getPageCount()
  const safePageIdx = Math.max(0, Math.min(totalPages - 1, (Number(pageNumber) || 1) - 1))
  const page = pdfDoc.getPage(safePageIdx)

  const mediaBox = page.getMediaBox()
  const cropBox = page.getCropBox()
  const boxX = cropBox?.x ?? mediaBox?.x ?? 0
  const boxY = cropBox?.y ?? mediaBox?.y ?? 0
  const pageW = cropBox?.width || mediaBox?.width || page.getSize().width || 595
  const pageH = cropBox?.height || mediaBox?.height || page.getSize().height || 842

  const targetMaxDim = Number(options.maxDimension) || 1080
  const maxScaleCap = Number(options.maxScale) || 2.2
  const scale = Math.min(maxScaleCap, targetMaxDim / Math.max(pageW, pageH, 1))
  const canvasW = Math.max(320, Math.round(pageW * scale))
  const canvasH = Math.max(420, Math.round(pageH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)

  const pageResources = pdfDoc.context.lookup(page.node.get(PDFName.of('Resources'))) || page.node.Resources()
  const { imageMap: xObjectImages, formMap: xObjectForms, fontMap } =
    await decodeResourcesXObjects(pageResources, pdfDoc.context)

  const stateStack = []
  let state = {
    ctm: [1, 0, 0, 1, -boxX, -boxY],
    fillStyle: '#181416',
    strokeStyle: '#4e4548',
    lineWidth: 1,
    fontSize: 11,
    fontBold: false,
    currentFont: null,
    leading: 13,
  }

  let textMatrix = [1, 0, 0, 1, 0, 0]
  let textLineMatrix = [1, 0, 0, 1, 0, 0]
  let currentPath = []
  let renderedElements = 0

  const toCanvasPoint = (pdfX, pdfY) => {
    const pt = applyPdfMatrixToPoint(state.ctm, pdfX, pdfY)
    return {
      x: pt.x * scale,
      y: (pageH - pt.y) * scale,
    }
  }

  const drawTextRun = (rawBytes) => {
    const text = decodeRawBytesWithFont(rawBytes, state.currentFont)
    if (!text.trim()) return
    const combinedTextMat = multiplyPdfMatrix(textMatrix, state.ctm)
    const pdfX = combinedTextMat[4]
    const pdfY = combinedTextMat[5]
    const scaleY = Math.hypot(combinedTextMat[2], combinedTextMat[3]) || 1
    const scaleX = Math.hypot(combinedTextMat[0], combinedTextMat[1]) || 1
    const effFontPx = Math.max(
      7,
      Math.min(54, Math.abs(state.fontSize * Math.max(scaleY, scaleX)) * scale)
    )

    const cx = pdfX * scale
    const cy = (pageH - pdfY) * scale
    ctx.save()
    ctx.fillStyle = state.fillStyle
    ctx.font = `${state.fontBold ? '700' : '400'} ${effFontPx.toFixed(1)}px "Plus Jakarta Sans", Helvetica, Arial, sans-serif`
    ctx.fillText(text, cx, cy)
    ctx.restore()

    const approxAdvancePdf = text.length * state.fontSize * 0.48
    textMatrix = multiplyPdfMatrix([1, 0, 0, 1, approxAdvancePdf, 0], textMatrix)
    renderedElements += 1
  }

  const flushPath = (doFill, doStroke) => {
    if (currentPath.length === 0) return
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i < currentPath.length; i += 1) {
      const cmd = currentPath[i]
      if (cmd.op === 'rect') {
        const p1 = toCanvasPoint(cmd.x, cmd.y)
        const p2 = toCanvasPoint(cmd.x + cmd.w, cmd.y + cmd.h)
        const rx = Math.min(p1.x, p2.x)
        const ry = Math.min(p1.y, p2.y)
        const rw = Math.abs(p2.x - p1.x)
        const rh = Math.abs(p2.y - p1.y)
        ctx.rect(rx, ry, rw, rh)
      } else if (cmd.op === 'move') {
        const p = toCanvasPoint(cmd.x, cmd.y)
        ctx.moveTo(p.x, p.y)
      } else if (cmd.op === 'line') {
        const p = toCanvasPoint(cmd.x, cmd.y)
        ctx.lineTo(p.x, p.y)
      } else if (cmd.op === 'curve') {
        const p1 = toCanvasPoint(cmd.x1, cmd.y1)
        const p2 = toCanvasPoint(cmd.x2, cmd.y2)
        const p3 = toCanvasPoint(cmd.x3, cmd.y3)
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
      } else if (cmd.op === 'close') {
        ctx.closePath()
      }
    }
    if (doFill) {
      ctx.fillStyle = state.fillStyle
      ctx.fill()
    }
    if (doStroke) {
      ctx.strokeStyle = state.strokeStyle
      ctx.lineWidth = Math.max(0.6, state.lineWidth * scale)
      ctx.stroke()
    }
    ctx.restore()
    currentPath = []
    renderedElements += 1
  }

  const executeContentStream = (contentStr, depth = 0) => {
    if (!contentStr || depth > 4) return
    const tokens = tokenizePdfContentStream(contentStr)
    const operands = []

    const popNum = (fallback = 0) => {
      const item = operands.pop()
      return item && item.type === 'num' ? item.value : fallback
    }

    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i]
      if (tok.type !== 'op') {
        operands.push(tok)
        if (operands.length > 40) operands.shift()
        continue
      }

      const op = tok.value

      if (op === 'q') {
        stateStack.push({
          ...state,
          ctm: [...state.ctm],
        })
      } else if (op === 'Q') {
        if (stateStack.length > 0) {
          state = stateStack.pop()
        }
      } else if (op === 'cm') {
        const f = popNum(0)
        const e = popNum(0)
        const d = popNum(1)
        const c = popNum(0)
        const b = popNum(0)
        const a = popNum(1)
        state.ctm = multiplyPdfMatrix([a, b, c, d, e, f], state.ctm)
      } else if (op === 'rg' || op === 'sc' || op === 'scn') {
        if (operands.length >= 3) {
          const b = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          const g = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          const r = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          state.fillStyle = `rgb(${r}, ${g}, ${b})`
        } else if (operands.length === 1) {
          const gray = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          state.fillStyle = `rgb(${gray}, ${gray}, ${gray})`
        }
      } else if (op === 'RG' || op === 'SC' || op === 'SCN') {
        if (operands.length >= 3) {
          const b = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          const g = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          const r = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          state.strokeStyle = `rgb(${r}, ${g}, ${b})`
        } else if (operands.length === 1) {
          const gray = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
          state.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`
        }
      } else if (op === 'g') {
        const gray = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
        state.fillStyle = `rgb(${gray}, ${gray}, ${gray})`
      } else if (op === 'G') {
        const gray = Math.round(Math.max(0, Math.min(1, popNum(0))) * 255)
        state.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`
      } else if (op === 'k') {
        const k = Math.max(0, Math.min(1, popNum(0)))
        const y = Math.max(0, Math.min(1, popNum(0)))
        const m = Math.max(0, Math.min(1, popNum(0)))
        const c = Math.max(0, Math.min(1, popNum(0)))
        const r = Math.round(255 * (1 - c) * (1 - k))
        const g = Math.round(255 * (1 - m) * (1 - k))
        const b = Math.round(255 * (1 - y) * (1 - k))
        state.fillStyle = `rgb(${r}, ${g}, ${b})`
      } else if (op === 'K') {
        const k = Math.max(0, Math.min(1, popNum(0)))
        const y = Math.max(0, Math.min(1, popNum(0)))
        const m = Math.max(0, Math.min(1, popNum(0)))
        const c = Math.max(0, Math.min(1, popNum(0)))
        const r = Math.round(255 * (1 - c) * (1 - k))
        const g = Math.round(255 * (1 - m) * (1 - k))
        const b = Math.round(255 * (1 - y) * (1 - k))
        state.strokeStyle = `rgb(${r}, ${g}, ${b})`
      } else if (op === 'w') {
        state.lineWidth = Math.max(0.2, popNum(1))
      } else if (op === 're') {
        const h = popNum(0)
        const w = popNum(0)
        const y = popNum(0)
        const x = popNum(0)
        currentPath.push({ op: 'rect', x, y, w, h })
      } else if (op === 'm') {
        const y = popNum(0)
        const x = popNum(0)
        currentPath.push({ op: 'move', x, y })
      } else if (op === 'l') {
        const y = popNum(0)
        const x = popNum(0)
        currentPath.push({ op: 'line', x, y })
      } else if (op === 'c') {
        const y3 = popNum(0)
        const x3 = popNum(0)
        const y2 = popNum(0)
        const x2 = popNum(0)
        const y1 = popNum(0)
        const x1 = popNum(0)
        currentPath.push({ op: 'curve', x1, y1, x2, y2, x3, y3 })
      } else if (op === 'v' || op === 'y') {
        const y3 = popNum(0)
        const x3 = popNum(0)
        const y2 = popNum(0)
        const x2 = popNum(0)
        currentPath.push({ op: 'curve', x1: x2, y1: y2, x2, y2, x3, y3 })
      } else if (op === 'h') {
        currentPath.push({ op: 'close' })
      } else if (op === 'S' || op === 's') {
        if (op === 's') currentPath.push({ op: 'close' })
        flushPath(false, true)
      } else if (op === 'f' || op === 'F' || op === 'f*') {
        flushPath(true, false)
      } else if (op === 'B' || op === 'B*' || op === 'b' || op === 'b*') {
        flushPath(true, true)
      } else if (op === 'n') {
        currentPath = []
      } else if (op === 'BT') {
        textMatrix = [1, 0, 0, 1, 0, 0]
        textLineMatrix = [1, 0, 0, 1, 0, 0]
      } else if (op === 'Tf') {
        const sz = popNum(11)
        const fontTok = operands.pop()
        if (sz > 0) state.fontSize = sz
        const fontName = fontTok ? String(fontTok.value || '').replace(/^\//, '') : ''
        const resolvedFont = fontMap.get(fontName) || null
        state.currentFont = resolvedFont
        state.fontBold = resolvedFont
          ? resolvedFont.isBold
          : /bold|black|heavy|demi|F2/i.test(fontName)
      } else if (op === 'TL') {
        state.leading = popNum(13)
      } else if (op === 'Tm') {
        const f = popNum(0)
        const e = popNum(0)
        const d = popNum(1)
        const c = popNum(0)
        const b = popNum(0)
        const a = popNum(1)
        textLineMatrix = [a, b, c, d, e, f]
        textMatrix = [...textLineMatrix]
      } else if (op === 'Td' || op === 'TD') {
        const ty = popNum(0)
        const tx = popNum(0)
        if (op === 'TD') state.leading = -ty
        textLineMatrix = multiplyPdfMatrix([1, 0, 0, 1, tx, ty], textLineMatrix)
        textMatrix = [...textLineMatrix]
      } else if (op === 'T*') {
        textLineMatrix = multiplyPdfMatrix([1, 0, 0, 1, 0, -state.leading], textLineMatrix)
        textMatrix = [...textLineMatrix]
      } else if (op === 'Tj' || op === "'") {
        if (op === "'") {
          textLineMatrix = multiplyPdfMatrix([1, 0, 0, 1, 0, -state.leading], textLineMatrix)
          textMatrix = [...textLineMatrix]
        }
        const strTok = operands.pop()
        if (strTok && strTok.type === 'str') {
          drawTextRun(strTok.value)
        }
      } else if (op === '"') {
        const strTok = operands.pop()
        popNum(0)
        popNum(0)
        textLineMatrix = multiplyPdfMatrix([1, 0, 0, 1, 0, -state.leading], textLineMatrix)
        textMatrix = [...textLineMatrix]
        if (strTok && strTok.type === 'str') {
          drawTextRun(strTok.value)
        }
      } else if (op === 'TJ') {
        const arrTok = operands.pop()
        if (arrTok && arrTok.type === 'arr') {
          for (let k = 0; k < arrTok.value.length; k += 1) {
            const item = arrTok.value[k]
            if (item.type === 'str') {
              drawTextRun(item.value)
            } else if (item.type === 'num') {
              const shift = (-item.value / 1000) * state.fontSize
              textMatrix = multiplyPdfMatrix([1, 0, 0, 1, shift, 0], textMatrix)
            }
          }
        }
      } else if (op === 'Do') {
        const nameTok = operands.pop()
        const key = nameTok ? String(nameTok.value || '').replace(/^\//, '') : ''
        const imgSource = xObjectImages.get(key)
        if (imgSource) {
          const pOrigin = toCanvasPoint(0, 0)
          const pTopRight = toCanvasPoint(1, 1)
          const drawX = Math.min(pOrigin.x, pTopRight.x)
          const drawY = Math.min(pOrigin.y, pTopRight.y)
          const drawW = Math.max(4, Math.abs(pTopRight.x - pOrigin.x))
          const drawH = Math.max(4, Math.abs(pTopRight.y - pOrigin.y))
          ctx.drawImage(imgSource, drawX, drawY, drawW, drawH)
          renderedElements += 1
        } else if (xObjectForms.has(key)) {
          const formObj = xObjectForms.get(key)
          stateStack.push({
            ...state,
            ctm: [...state.ctm],
          })
          state.ctm = multiplyPdfMatrix(formObj.matrix, state.ctm)
          const formContent = decodeContentStreamsToText(formObj.stream, pdfDoc.context)
          executeContentStream(formContent, depth + 1)
          if (stateStack.length > 0) {
            state = stateStack.pop()
          }
        }
      }

      operands.length = 0
    }
  }

  const pageContentStr = decodeContentStreamsToText(page.node.get(PDFName.of('Contents')), pdfDoc.context)
  executeContentStream(pageContentStr, 0)

  let singlePagePdfBytes = null
  if (!options.skipSinglePagePdf) {
    try {
      const singleDoc = await PDFDocument.create()
      const [copiedPage] = await singleDoc.copyPages(pdfDoc, [safePageIdx])
      singleDoc.addPage(copiedPage)
      singlePagePdfBytes = await singleDoc.save()
    } catch {
      singlePagePdfBytes = null
    }
  }

  const mimeType = options.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  const quality = typeof options.quality === 'number' ? options.quality : 0.92
  const dataUrl = canvas.toDataURL(mimeType, quality)

  return {
    canvas,
    dataUrl,
    singlePagePdfBytes,
    width: Math.round(pageW),
    height: Math.round(pageH),
    pixelWidth: canvasW,
    pixelHeight: canvasH,
    renderedElements,
  }
}

/**
 * Merender thumbnail terkompresi seluruh halaman PDF secara progresif menggunakan satu instance PDF.js
 */
export async function renderAllPdfPageThumbnails(file, options = {}, onPage) {
  if (!file) return []
  const {
    maxDimension = 168,
    maxScale = 0.75,
    mimeType = 'image/jpeg',
    quality = 0.65,
    onPageStart,
    signal,
  } = options

  if (signal?.aborted) return []

  const objectUrl = URL.createObjectURL(file)
  let pdfjsDoc = null
  let fallbackPdfDoc = null
  let fallbackArrayBuffer = null

  try {
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: objectUrl,
        disableAutoFetch: true,
        useSystemFonts: true,
        isEvalSupported: false,
        disableFontFace: true,
      })
      pdfjsDoc = await loadingTask.promise
    } catch {
      pdfjsDoc = null
    }

    if (!pdfjsDoc) {
      fallbackArrayBuffer = await file.arrayBuffer()
      if (signal?.aborted) return []
      fallbackPdfDoc = await PDFDocument.load(fallbackArrayBuffer, { ignoreEncryption: true })
    }

    const totalPages = pdfjsDoc ? pdfjsDoc.numPages : fallbackPdfDoc.getPageCount()
    const thumbnails = new Array(totalPages).fill('')

    for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
      if (signal?.aborted) break
      if (typeof onPageStart === 'function') {
        onPageStart(pageNum, totalPages)
      }
      let dataUrl
      try {
        const rendered = await renderPdfPagePreviewToDataUrl(file, pageNum, {
          arrayBuffer: fallbackArrayBuffer,
          pdfjsDoc,
          pdfDoc: fallbackPdfDoc,
          maxDimension,
          maxScale,
          mimeType,
          quality,
          disableFontFace: true,
          skipSinglePagePdf: true,
        })
        dataUrl = rendered?.dataUrl || ''
      } catch {
        dataUrl = ''
      }
      thumbnails[pageNum - 1] = dataUrl
      if (typeof onPage === 'function' && !signal?.aborted) {
        onPage(pageNum, dataUrl, totalPages)
      }
      // Beri jeda singkat ke main thread agar UI dan animasi persentase tetap mulus
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    return thumbnails
  } finally {
    if (pdfjsDoc) {
      try {
        await pdfjsDoc.destroy()
      } catch {
        // Ignore cleanup errors
      }
    }
    URL.revokeObjectURL(objectUrl)
  }
}

export function recolorCanvasStrokes(canvasElement, hexColor = '#141112') {
  if (!canvasElement) return
  const cleanHex = String(hexColor || '#141112').replace('#', '')
  if (cleanHex.length !== 6) return
  const r = parseInt(cleanHex.slice(0, 2), 16)
  const g = parseInt(cleanHex.slice(2, 4), 16)
  const b = parseInt(cleanHex.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return

  const ctx = canvasElement.getContext('2d')
  const imgData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height)
  const { data } = imgData
  let hasPixels = false
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      hasPixels = true
    }
  }
  if (hasPixels) {
    ctx.putImageData(imgData, 0, 0)
  }
}

function extractPagesMeta(pdfDoc) {
  const pages = pdfDoc.getPages()
  return pages.map((page, idx) => {
    const { width, height } = page.getSize()
    const rotation = page.getRotation()?.angle || 0
    const isRotated = rotation % 180 !== 0
    const effWidth = isRotated ? height : width
    const effHeight = isRotated ? width : height
    return {
      pageNumber: idx + 1,
      width: Math.round(effWidth),
      height: Math.round(effHeight),
      rotation,
    }
  })
}

// Trim transparent margins so signature placement matches visible ink bounds.
function trimCanvasTransparentBounds(sourceCanvas, padding = 10) {
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  const ctx = sourceCanvas.getContext('2d')
  const imgData = ctx.getImageData(0, 0, w, h)
  const { data } = imgData

  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const alpha = data[(y * w + x) * 4 + 3]
      if (alpha > 18) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { isEmpty: true, canvas: sourceCanvas, width: w, height: h }
  }

  const cropX = Math.max(0, minX - padding)
  const cropY = Math.max(0, minY - padding)
  const cropW = Math.min(w - cropX, maxX - minX + 1 + padding * 2)
  const cropH = Math.min(h - cropY, maxY - minY + 1 + padding * 2)

  const trimmed = document.createElement('canvas')
  trimmed.width = Math.max(24, cropW)
  trimmed.height = Math.max(16, cropH)
  const trimmedCtx = trimmed.getContext('2d')
  trimmedCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

  return {
    isEmpty: false,
    canvas: trimmed,
    width: trimmed.width,
    height: trimmed.height,
  }
}

export async function exportCanvasSignature(canvasElement) {
  if (!canvasElement) {
    throw new Error('Kanvas tanda tangan tidak ditemukan.')
  }
  const trimmedInfo = trimCanvasTransparentBounds(canvasElement, 12)
  if (trimmedInfo.isEmpty) {
    return { isEmpty: true, dataUrl: '', pngBytes: null, width: 0, height: 0, aspectRatio: 2.2 }
  }

  const dataUrl = trimmedInfo.canvas.toDataURL('image/png')
  const blob = await new Promise((resolve) => trimmedInfo.canvas.toBlob(resolve, 'image/png'))
  const buf = await blob.arrayBuffer()
  const pngBytes = new Uint8Array(buf)

  return {
    isEmpty: false,
    dataUrl,
    pngBytes,
    width: trimmedInfo.width,
    height: trimmedInfo.height,
    aspectRatio: Math.max(0.4, Math.min(6, trimmedInfo.width / Math.max(1, trimmedInfo.height))),
  }
}

export async function processSignatureImageFile(file, { removeWhiteBg = true } = {}) {
  if (!file) {
    throw new Error('Pilih berkas gambar tanda tangan terlebih dahulu.')
  }
  const isImage =
    /^image\/(png|jpe?g|webp)/i.test(file.type || '') ||
    /\.(png|jpe?g|webp)$/i.test(file.name || '')
  if (!isImage) {
    throw new Error('Format gambar tanda tangan harus berupa PNG, JPG, atau WEBP.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Gagal memuat berkas gambar tanda tangan.'))
      el.src = objectUrl
    })

    const maxDim = 1000
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    const w = Math.max(16, Math.round((img.naturalWidth || 300) * scale))
    const h = Math.max(16, Math.round((img.naturalHeight || 150) * scale))

    const workCanvas = document.createElement('canvas')
    workCanvas.width = w
    workCanvas.height = h
    const ctx = workCanvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    if (removeWhiteBg) {
      const imgData = ctx.getImageData(0, 0, w, h)
      const { data } = imgData
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        if (a === 0) continue
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        if (lum > 238) {
          data[i + 3] = 0
        } else if (lum > 195) {
          const factor = (238 - lum) / 43
          data[i + 3] = Math.round(a * factor)
        }
      }
      ctx.putImageData(imgData, 0, 0)
    }

    const trimmedInfo = trimCanvasTransparentBounds(workCanvas, 10)
    const targetCanvas = trimmedInfo.isEmpty ? workCanvas : trimmedInfo.canvas
    const dataUrl = targetCanvas.toDataURL('image/png')
    const blob = await new Promise((resolve) => targetCanvas.toBlob(resolve, 'image/png'))
    const buf = await blob.arrayBuffer()
    const pngBytes = new Uint8Array(buf)

    return {
      name: file.name,
      size: file.size,
      dataUrl,
      pngBytes,
      width: targetCanvas.width,
      height: targetCanvas.height,
      aspectRatio: Math.max(0.4, Math.min(6, targetCanvas.width / Math.max(1, targetCanvas.height))),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function resolveTargetSignaturePages({
  pageMode = 'all',
  pageCount = 1,
  intervalStep = 2,
  intervalStart = 1,
  customRange = '',
  selectedPages = [],
}) {
  const total = Math.max(1, Number(pageCount) || 1)

  if (pageMode === 'all') {
    return {
      pages: Array.from({ length: total }, (_, i) => i + 1),
      error: null,
    }
  }

  if (pageMode === 'last') {
    return {
      pages: [total],
      error: null,
    }
  }

  if (pageMode === 'first') {
    return {
      pages: [1],
      error: null,
    }
  }

  if (pageMode === 'interval') {
    const step = Math.max(1, Math.min(total, parseInt(intervalStep, 10) || 1))
    const start = Math.max(1, Math.min(total, parseInt(intervalStart, 10) || 1))
    const pages = []
    for (let p = start; p <= total; p += step) {
      pages.push(p)
    }
    return {
      pages,
      error: pages.length === 0 ? 'Tidak ada halaman yang cocok dengan interval tersebut.' : null,
    }
  }

  if (pageMode === 'custom') {
    if (String(customRange || '').trim()) {
      const parsed = parsePageRanges(customRange, total)
      return {
        pages: parsed.pages,
        error: parsed.error,
      }
    }
    const validSelected = Array.from(new Set(selectedPages))
      .filter((p) => p >= 1 && p <= total)
      .sort((a, b) => a - b)
    if (validSelected.length === 0) {
      return {
        pages: [],
        error: 'Pilih minimal 1 halaman atau ketik rentang halaman yang ingin ditandatangani.',
      }
    }
    return {
      pages: validSelected,
      error: null,
    }
  }

  return {
    pages: [total],
    error: null,
  }
}

export async function signPdfDocument(
  {
    file,
    signatureItems = null,
    signaturePngBytes,
    pages = [],
    xPercent = 78,
    yPercent = 82,
    scalePercent = 22,
    opacityPercent = 100,
    signerName = '',
    signDateText = '',
  },
  onProgress
) {
  if (!file) {
    throw new Error('Unggah berkas PDF terlebih dahulu.')
  }

  const normalizedItems = Array.isArray(signatureItems) && signatureItems.length > 0
    ? signatureItems.filter((item) => item && item.pngBytes && item.pngBytes.byteLength)
    : signaturePngBytes && signaturePngBytes.byteLength
      ? [
          {
            pngBytes: signaturePngBytes,
            xPercent,
            yPercent,
            scalePercent,
            opacityPercent,
            signerName,
            signDateText,
          },
        ]
      : []

  if (normalizedItems.length === 0) {
    throw new Error('Buat atau unggah minimal 1 tanda tangan atau stempel terlebih dahulu.')
  }

  if (onProgress) {
    onProgress(`Membaca dokumen "${truncateFileName(file.name, 26)}"...`)
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const totalPages = pdfDoc.getPageCount()
  const defaultPages = Array.isArray(pages) ? pages.filter((p) => p >= 1 && p <= totalPages) : []

  const embeddedItems = []
  let needFonts = false
  const touchedPageSet = new Set()
  for (let idx = 0; idx < normalizedItems.length; idx += 1) {
    const raw = normalizedItems[idx]
    const embeddedImage = await pdfDoc.embedPng(raw.pngBytes)
    const cleanSigner = String(raw.signerName || '').trim()
    const cleanDate = String(raw.signDateText || '').trim()
    if (cleanSigner || cleanDate) needFonts = true
    const itemPages = Array.isArray(raw.pages) && raw.pages.length > 0
      ? raw.pages.filter((p) => p >= 1 && p <= totalPages)
      : defaultPages
    itemPages.forEach((p) => touchedPageSet.add(p))
    embeddedItems.push({
      sigImage: embeddedImage,
      aspectRatio: embeddedImage.width / Math.max(1, embeddedImage.height),
      xPercent: Math.max(0, Math.min(100, Number(raw.xPercent ?? 76))),
      yPercent: Math.max(0, Math.min(100, Number(raw.yPercent ?? 80))),
      scaleRatio: Math.max(0.06, Math.min(0.65, Number(raw.scalePercent ?? 22) / 100)),
      opacity: Math.max(0.2, Math.min(1, Number(raw.opacityPercent ?? 100) / 100)),
      cleanSigner,
      cleanDate,
      targetPageSet: new Set(itemPages),
    })
  }

  const fontBold = needFonts ? await pdfDoc.embedFont(StandardFonts.HelveticaBold) : null
  const fontRegular = needFonts ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null

  const validPages = Array.from(touchedPageSet).sort((a, b) => a - b)
  if (validPages.length === 0) {
    throw new Error('Letakkan minimal 1 tanda tangan atau stempel pada halaman dokumen.')
  }

  for (let i = 0; i < validPages.length; i += 1) {
    const pageNum = validPages[i]
    if (onProgress && (i === 0 || i === validPages.length - 1 || i % 3 === 0)) {
      onProgress(`Menempelkan tanda tangan & stempel pada halaman ${pageNum} (${i + 1}/${validPages.length})...`)
    }

    const page = pdfDoc.getPage(pageNum - 1)
    const { width: pageW, height: pageH } = page.getSize()

    for (let j = 0; j < embeddedItems.length; j += 1) {
      const item = embeddedItems[j]
      if (!item.targetPageSet.has(pageNum)) continue
      const sigW = pageW * item.scaleRatio
      const sigH = sigW / item.aspectRatio

      const signerFontSize = Math.max(8, Math.min(12, Math.round(pageW * 0.0165)))
      const dateFontSize = Math.max(7, Math.min(10, Math.round(pageW * 0.014)))
      const captionGap = 4
      let captionHeight = 0
      if (item.cleanSigner) captionHeight += signerFontSize + captionGap
      if (item.cleanDate) captionHeight += dateFontSize + 3

      const totalStampH = sigH + captionHeight
      const centerX = pageW * (item.xPercent / 100)
      const centerYFromTop = pageH * (item.yPercent / 100)

      const drawX = Math.max(10, Math.min(pageW - sigW - 10, centerX - sigW / 2))
      const topFromPageTop = Math.max(
        10,
        Math.min(pageH - totalStampH - 10, centerYFromTop - totalStampH / 2)
      )
      const sigBottomY = pageH - topFromPageTop - sigH

      page.drawImage(item.sigImage, {
        x: drawX,
        y: sigBottomY,
        width: sigW,
        height: sigH,
        opacity: item.opacity,
      })

      let textBaselineY = sigBottomY - captionGap - signerFontSize + 2
      if (item.cleanSigner && fontBold) {
        const textWidth = fontBold.widthOfTextAtSize(item.cleanSigner, signerFontSize)
        const textX = Math.max(
          10,
          Math.min(pageW - textWidth - 10, drawX + sigW / 2 - textWidth / 2)
        )
        page.drawText(item.cleanSigner, {
          x: textX,
          y: textBaselineY,
          size: signerFontSize,
          font: fontBold,
          color: rgb(0.08, 0.07, 0.07),
          opacity: item.opacity,
        })
        textBaselineY -= dateFontSize + 3
      }

      if (item.cleanDate && fontRegular) {
        const dateWidth = fontRegular.widthOfTextAtSize(item.cleanDate, dateFontSize)
        const dateX = Math.max(
          10,
          Math.min(pageW - dateWidth - 10, drawX + sigW / 2 - dateWidth / 2)
        )
        page.drawText(item.cleanDate, {
          x: dateX,
          y: textBaselineY,
          size: dateFontSize,
          font: fontRegular,
          color: rgb(0.3, 0.26, 0.28),
          opacity: item.opacity,
        })
      }
    }
  }

  if (onProgress) {
    onProgress('Menyimpan dokumen PDF bertanda tangan...')
  }

  const pdfBytes = await pdfDoc.save()
  const baseName = stripPdfExtension(file.name)
  const fileName = `${baseName}-tertandatangani.pdf`

  return {
    pdfBytes,
    fileName,
    sourceName: file.name,
    totalPages,
    signedPageCount: validPages.length,
    signedPages: validPages,
    size: pdfBytes.byteLength,
  }
}

export async function inspectImageFile(file) {
  if (!file) {
    throw new Error('Berkas gambar tidak ditemukan.')
  }
  const isSupportedImage =
    /^image\/(png|jpe?g|webp)$/i.test(file.type || '') ||
    /\.(png|jpe?g|webp)$/i.test(String(file.name || ''))
  if (!isSupportedImage) {
    throw new Error(
      `Berkas "${file.name}" bukan format gambar yang didukung. Gunakan JPG, PNG, atau WEBP.`
    )
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Gagal memuat gambar "${file.name}".`))
      el.src = objectUrl
    })

    const width = Math.max(1, img.naturalWidth || img.width || 1)
    const height = Math.max(1, img.naturalHeight || img.height || 1)

    const thumbMax = 240
    const thumbScale = Math.min(1, thumbMax / Math.max(width, height))
    const thumbW = Math.max(16, Math.round(width * thumbScale))
    const thumbH = Math.max(16, Math.round(height * thumbScale))
    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = thumbW
    thumbCanvas.height = thumbH
    const thumbCtx = thumbCanvas.getContext('2d')
    thumbCtx.fillStyle = '#ffffff'
    thumbCtx.fillRect(0, 0, thumbW, thumbH)
    thumbCtx.drawImage(img, 0, 0, thumbW, thumbH)
    const previewUrl = thumbCanvas.toDataURL('image/jpeg', 0.84)

    const extMatch = String(file.name || '').match(/\.(png|jpe?g|webp)$/i)
    const formatLabel = extMatch
      ? extMatch[1].toUpperCase().replace('JPEG', 'JPG')
      : (file.type || 'IMG').replace('image/', '').toUpperCase()

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      width,
      height,
      formatLabel,
      previewUrl,
      basePreviewUrl: previewUrl,
      rotation: 0,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function rotateImagePreviewUrl(basePreviewUrl, rotationDeg = 0) {
  const rot = ((rotationDeg % 360) + 360) % 360
  if (rot === 0) return basePreviewUrl

  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Gagal memutar pratinjau gambar.'))
    el.src = basePreviewUrl
  })

  const w = Math.max(1, img.naturalWidth || img.width || 1)
  const h = Math.max(1, img.naturalHeight || img.height || 1)
  const isQuarterTurn = rot === 90 || rot === 270

  const canvas = document.createElement('canvas')
  canvas.width = isQuarterTurn ? h : w
  canvas.height = isQuarterTurn ? w : h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()

  return canvas.toDataURL('image/jpeg', 0.88)
}

async function normalizeImageFileForPdfEmbed(
  file,
  { colorMode = 'color', rotation = 0 } = {}
) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Gagal membaca gambar "${file.name}".`))
      el.src = objectUrl
    })

    const width = Math.max(1, img.naturalWidth || img.width || 1)
    const height = Math.max(1, img.naturalHeight || img.height || 1)
    const maxDim = 2600
    const scale = Math.min(1, maxDim / Math.max(width, height))
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    const rot = ((rotation % 360) + 360) % 360
    const isQuarterTurn = rot === 90 || rot === 270
    const canvasW = isQuarterTurn ? targetH : targetW
    const canvasH = isQuarterTurn ? targetW : targetH

    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')

    const isPng =
      /^image\/png$/i.test(file.type || '') || /\.png$/i.test(String(file.name || ''))
    if (!isPng) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasW, canvasH)
    }

    ctx.save()
    ctx.translate(canvasW / 2, canvasH / 2)
    if (rot !== 0) {
      ctx.rotate((rot * Math.PI) / 180)
    }
    ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH)
    ctx.restore()

    if (colorMode === 'grayscale') {
      const imageData = ctx.getImageData(0, 0, canvasW, canvasH)
      const data = imageData.data
      for (let p = 0; p < data.length; p += 4) {
        const lum = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2])
        data[p] = lum
        data[p + 1] = lum
        data[p + 2] = lum
      }
      ctx.putImageData(imageData, 0, 0)
    }

    const mimeType = isPng ? 'image/png' : 'image/jpeg'
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, mimeType, isPng ? undefined : 0.92)
    )
    const buf = await blob.arrayBuffer()
    return {
      bytes: new Uint8Array(buf),
      isPng,
      width: canvasW,
      height: canvasH,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const IMAGE_PDF_MARGIN_MAP = {
  none: 0,
  small: 24,
  normal: 44,
}

const IMAGE_PDF_PAGE_PRESETS = {
  a4: [595.28, 841.89],
  f4: [609.45, 935.43],
  letter: [612, 792],
}

export function computeImagePdfPageLayout(
  imgW,
  imgH,
  { pageSize = 'a4', orientation = 'auto', margin = 'small' } = {}
) {
  const safeImgW = Math.max(1, imgW || 1)
  const safeImgH = Math.max(1, imgH || 1)
  const marginPt = IMAGE_PDF_MARGIN_MAP[margin] ?? 24

  let pageW
  let pageH

  if (pageSize === 'fit') {
    const fitScale = 720 / Math.max(safeImgW, safeImgH, 1)
    const baseW = Math.max(180, Math.round(safeImgW * Math.min(1, fitScale)))
    const baseH = Math.max(180, Math.round(safeImgH * Math.min(1, fitScale)))
    pageW = baseW + marginPt * 2
    pageH = baseH + marginPt * 2
  } else {
    const [presetShort, presetLong] =
      IMAGE_PDF_PAGE_PRESETS[pageSize] || IMAGE_PDF_PAGE_PRESETS.a4
    const useLandscape =
      orientation === 'landscape' || (orientation === 'auto' && safeImgW > safeImgH)
    pageW = useLandscape ? presetLong : presetShort
    pageH = useLandscape ? presetShort : presetLong
  }

  const availW = Math.max(36, pageW - marginPt * 2)
  const availH = Math.max(36, pageH - marginPt * 2)
  const drawScale = Math.min(availW / safeImgW, availH / safeImgH)
  const drawW = safeImgW * drawScale
  const drawH = safeImgH * drawScale
  const drawX = (pageW - drawW) / 2
  const drawY = (pageH - drawH) / 2

  return {
    pageW,
    pageH,
    marginPt,
    availW,
    availH,
    drawW,
    drawH,
    drawX,
    drawY,
    isLandscape: pageW > pageH,
  }
}

export async function convertImagesToPdf(
  items = [],
  { pageSize = 'a4', orientation = 'portrait', margin = 'small', colorMode = 'color' } = {},
  onProgress
) {
  if (!Array.isArray(items) || items.length < 1) {
    throw new Error('Unggah minimal 1 gambar untuk diubah menjadi PDF.')
  }

  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (onProgress) {
      onProgress(
        `Memproses gambar ${i + 1} dari ${items.length}: "${truncateFileName(item.name, 26)}"...`
      )
    }

    const normalized = await normalizeImageFileForPdfEmbed(item.file, {
      colorMode,
      rotation: item.rotation || 0,
    })
    const embeddedImg = normalized.isPng
      ? await pdfDoc.embedPng(normalized.bytes)
      : await pdfDoc.embedJpg(normalized.bytes)

    const { pageW, pageH, drawW, drawH, drawX, drawY } = computeImagePdfPageLayout(
      embeddedImg.width,
      embeddedImg.height,
      { pageSize, orientation, margin }
    )

    const page = pdfDoc.addPage([pageW, pageH])

    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    })
  }

  if (onProgress) {
    onProgress('Menyusun berkas PDF akhir...')
  }

  const pdfBytes = await pdfDoc.save()
  const firstBase = String(items[0]?.name || 'gambar')
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .trim()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-') || 'gambar'
  const fileName =
    items.length === 1
      ? `${firstBase}.pdf`
      : `${firstBase}-dan-${items.length - 1}-lainnya.pdf`

  return {
    pdfBytes,
    fileName,
    totalPages: items.length,
    fileCount: items.length,
    size: pdfBytes.byteLength,
  }
}

export async function convertPdfToImages(
  {
    file,
    mode = 'all',
    rangeInput = '',
    format = 'png',
    quality = 'high',
  } = {},
  onProgress
) {
  if (!file) {
    throw new Error('Unggah berkas PDF terlebih dahulu.')
  }

  if (onProgress) {
    onProgress(`Membaca dokumen "${truncateFileName(file.name, 26)}"...`)
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const totalPages = pdfDoc.getPageCount()
  const baseName = stripPdfExtension(file.name)

  let targetPages
  if (mode === 'range') {
    const parsed = parsePageRanges(rangeInput, totalPages)
    if (parsed.error) {
      throw new Error(parsed.error)
    }
    targetPages = parsed.pages
  } else {
    targetPages = Array.from({ length: totalPages }, (_, idx) => idx + 1)
  }

  if (targetPages.length === 0) {
    throw new Error('Tidak ada halaman yang dipilih untuk diubah menjadi gambar.')
  }

  const isJpg = format === 'jpg' || format === 'jpeg'
  const mimeType = isJpg ? 'image/jpeg' : 'image/png'
  const ext = isJpg ? 'jpg' : 'png'
  const maxDimension = quality === 'high' ? 1680 : 1200
  const maxScale = quality === 'high' ? 2.6 : 1.8
  const jpegQuality = quality === 'high' ? 0.92 : 0.82

  const outputFiles = []
  let pdfjsDoc
  try {
    pdfjsDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      useSystemFonts: true,
    }).promise
  } catch {
    pdfjsDoc = null
  }

  try {
    for (let i = 0; i < targetPages.length; i += 1) {
      const pageNum = targetPages[i]
      if (onProgress) {
        onProgress(`Merender halaman ${pageNum} ke ${ext.toUpperCase()} (${i + 1}/${targetPages.length})...`)
      }

      const rendered = await renderPdfPagePreviewToDataUrl(file, pageNum, {
        arrayBuffer,
        pdfDoc,
        pdfjsDoc,
        maxDimension,
        maxScale,
        mimeType,
        quality: jpegQuality,
        skipSinglePagePdf: true,
      })

      const blob = await new Promise((resolve) =>
        rendered.canvas.toBlob(resolve, mimeType, isJpg ? jpegQuality : undefined)
      )
      const buf = await blob.arrayBuffer()
      const bytes = new Uint8Array(buf)
      const padNum = String(pageNum).padStart(String(totalPages).length > 1 ? 2 : 1, '0')
      const imgFileName = `${baseName}-hal-${padNum}.${ext}`

      outputFiles.push({
        id: `img-page-${pageNum}`,
        name: imgFileName,
        label: `Halaman ${pageNum}`,
        pageNumber: pageNum,
        format: ext.toUpperCase(),
        mimeType,
        width: rendered.pixelWidth || rendered.width,
        height: rendered.pixelHeight || rendered.height,
        size: bytes.byteLength,
        bytes,
        dataUrl: rendered.dataUrl,
      })
    }
  } finally {
    if (pdfjsDoc) {
      try {
        await pdfjsDoc.destroy()
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  let zipBlob = null
  const zipFileName = `${baseName}-${ext}-images.zip`

  if (outputFiles.length > 1) {
    if (onProgress) {
      onProgress(`Mengemas ${outputFiles.length} gambar ke dalam arsip .zip...`)
    }
    const zip = new JSZip()
    outputFiles.forEach((item) => {
      zip.file(item.name, item.bytes)
    })
    zipBlob = await zip.generateAsync({ type: 'blob' })
  }

  return {
    sourceName: file.name,
    totalPages,
    extractedCount: outputFiles.length,
    format: ext.toUpperCase(),
    mimeType,
    files: outputFiles,
    zipBlob,
    zipFileName,
    primaryFile: outputFiles.length === 1 ? outputFiles[0] : null,
  }
}
