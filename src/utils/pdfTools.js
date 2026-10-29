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

    const analysis = analyzePdfStructure(pdfDoc)

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      pageCount,
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
