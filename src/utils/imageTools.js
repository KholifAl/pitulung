import JSZip from 'jszip'
import { formatFileSize, stripPdfExtension, truncateFileName } from './pdfTools'

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SUPPORTED_IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i

function stripImageExtension(name = '') {
  return String(name).replace(/\.(jpe?g|png|webp)$/i, '') || 'gambar'
}

export function getImageCompressionConfigFromSlider(sliderValue = 50) {
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
    quality: Number((0.92 - t * 0.58).toFixed(2)),
    scale: Number((1 - t * 0.52).toFixed(2)),
    maxDimension: clamped === 0 ? null : Math.round(2800 - t * 1840),
  }
}

export async function inspectImageFile(file) {
  if (!file) {
    throw new Error('Berkas gambar tidak valid.')
  }

  const isSupportedMime = SUPPORTED_IMAGE_TYPES.has(file.type)
  const isSupportedExt = SUPPORTED_IMAGE_EXT_RE.test(file.name || '')
  if (!isSupportedMime && !isSupportedExt) {
    throw new Error(
      `Format "${file.name}" tidak didukung. Gunakan berkas JPG, PNG, atau WEBP.`
    )
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const dimensions = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
        })
      }
      img.onerror = () => {
        reject(new Error(`Gagal memuat gambar "${file.name}".`))
      }
      img.src = objectUrl
    })

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      name: file.name,
      size: file.size || 0,
      type: file.type || (isSupportedExt ? 'image/jpeg' : ''),
      width: dimensions.width,
      height: dimensions.height,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function resolveTargetDimensions(width, height, cfg) {
  let targetW = Math.max(1, Math.round((width || 1) * cfg.scale))
  let targetH = Math.max(1, Math.round((height || 1) * cfg.scale))
  const longest = Math.max(targetW, targetH)
  if (cfg.maxDimension && longest > cfg.maxDimension) {
    const ratio = cfg.maxDimension / longest
    targetW = Math.max(1, Math.round(targetW * ratio))
    targetH = Math.max(1, Math.round(targetH * ratio))
  }
  return { width: targetW, height: targetH }
}

function estimateSingleImageBytes(item, options = {}) {
  const fileSize = item.size || 0
  if (fileSize <= 0) return { baseBytes: 0, graySavedBytes: 0, finalBytes: 0 }

  const cfg = getImageCompressionConfigFromSlider(options.sliderValue ?? 50)
  const { width, height } = resolveTargetDimensions(item.width || 1200, item.height || 900, cfg)
  const origPixels = Math.max(1, (item.width || 1200) * (item.height || 900))
  const targetPixels = Math.max(1, width * height)
  const pixelRatio = targetPixels / origPixels

  const isPng = item.type === 'image/png' || /\.png$/i.test(item.name || '')
  const isWebp = item.type === 'image/webp' || /\.webp$/i.test(item.name || '')

  let baseRatio
  if (isPng) {
    // PNG ignores quality in canvas; size scales mainly with pixel count
    baseRatio = Math.min(0.98, Math.max(0.18, Math.pow(pixelRatio, 0.85)))
  } else {
    const qualityFactor = 0.14 + 0.82 * Math.pow(cfg.quality, 1.45)
    baseRatio = Math.min(0.96, Math.max(0.05, pixelRatio * qualityFactor))
    if (isWebp) {
      baseRatio = Math.min(0.95, baseRatio * 0.92)
    }
  }

  const baseBytes = Math.min(fileSize, Math.max(4096, Math.round(fileSize * baseRatio)))
  const withGrayBytes = Math.max(2048, Math.round(baseBytes * 0.78))
  const graySavedBytes = Math.max(0, baseBytes - withGrayBytes)

  const finalBytes = options.grayscaleImages ? withGrayBytes : baseBytes
  return { baseBytes, graySavedBytes, finalBytes }
}

export function estimateImageCompression(items = [], options = {}) {
  const totalOriginalSize = items.reduce((acc, item) => acc + (item.size || 0), 0)
  if (totalOriginalSize <= 0) {
    return {
      totalOriginalSize: 0,
      grayscaleSavedBytes: 0,
      totalSavedBytes: 0,
      estimatedFinalSize: 0,
      estimatedSavedPercent: 0,
    }
  }

  let grayscaleSavedBytes = 0
  let estimatedFinalSize = 0

  for (const item of items) {
    const est = estimateSingleImageBytes(item, options)
    grayscaleSavedBytes += est.graySavedBytes
    estimatedFinalSize += est.finalBytes
  }

  estimatedFinalSize = Math.min(totalOriginalSize, Math.max(1024, estimatedFinalSize))
  const totalSavedBytes = Math.max(0, totalOriginalSize - estimatedFinalSize)
  const estimatedSavedPercent =
    totalOriginalSize > 0
      ? Math.max(0, Math.round((totalSavedBytes / totalOriginalSize) * 100))
      : 0

  return {
    totalOriginalSize,
    grayscaleSavedBytes,
    totalSavedBytes,
    estimatedFinalSize,
    estimatedSavedPercent,
  }
}

export function findImagePresetForTarget(items = [], targetBytes) {
  const totalOriginalSize = items.reduce((acc, item) => acc + (item.size || 0), 0)
  if (totalOriginalSize <= 0 || !targetBytes || targetBytes <= 0) {
    return {
      sliderValue: 50,
      grayscaleImages: false,
      reachable: true,
      alreadyUnderTarget: false,
      estimatedFinalSize: 0,
    }
  }

  if (totalOriginalSize <= targetBytes) {
    const lightEst = estimateImageCompression(items, {
      sliderValue: 15,
      grayscaleImages: false,
    })
    return {
      sliderValue: 15,
      grayscaleImages: false,
      reachable: true,
      alreadyUnderTarget: true,
      estimatedFinalSize: lightEst.estimatedFinalSize,
    }
  }

  for (const grayscaleImages of [false, true]) {
    for (let sv = 0; sv <= 100; sv += 1) {
      const est = estimateImageCompression(items, {
        sliderValue: sv,
        grayscaleImages,
      })
      if (est.estimatedFinalSize <= targetBytes) {
        return {
          sliderValue: sv,
          grayscaleImages,
          reachable: true,
          alreadyUnderTarget: false,
          estimatedFinalSize: est.estimatedFinalSize,
        }
      }
    }
  }

  const maxEst = estimateImageCompression(items, {
    sliderValue: 100,
    grayscaleImages: true,
  })
  return {
    sliderValue: 100,
    grayscaleImages: true,
    reachable: false,
    alreadyUnderTarget: false,
    estimatedFinalSize: maxEst.estimatedFinalSize,
  }
}

async function renderImageToBlob(img, width, height, mimeType, quality, grayscaleImages) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Browser tidak mendukung kanvas 2D untuk kompresi gambar.')
  }

  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }

  if (grayscaleImages) {
    ctx.filter = 'grayscale(100%)'
  }

  ctx.drawImage(img, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal mengenkode ulang gambar.'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality
    )
  })
}

async function compressSingleImageItem(item, options, targetPerFileBytes) {
  const objectUrl = URL.createObjectURL(item.file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Gagal membaca "${item.name}".`))
      el.src = objectUrl
    })

    const cfg = getImageCompressionConfigFromSlider(options.sliderValue ?? 50)
    let { width, height } = resolveTargetDimensions(
      img.naturalWidth || item.width,
      img.naturalHeight || item.height,
      cfg
    )

    let outputMime = SUPPORTED_IMAGE_TYPES.has(item.type) ? item.type : 'image/jpeg'

    let quality = cfg.quality
    let blob = await renderImageToBlob(
      img,
      width,
      height,
      outputMime,
      quality,
      Boolean(options.grayscaleImages)
    )

    // If a target size is active and the first pass is still above it, refine quality/scale
    if (targetPerFileBytes && blob.size > targetPerFileBytes) {
      if (outputMime !== 'image/png') {
        for (const qStep of [0.7, 0.55, 0.42, 0.3]) {
          if (blob.size <= targetPerFileBytes) break
          const candidate = await renderImageToBlob(
            img,
            width,
            height,
            outputMime,
            Math.min(quality, qStep),
            Boolean(options.grayscaleImages)
          )
          if (candidate.size < blob.size) {
            blob = candidate
          }
        }
      }

      if (blob.size > targetPerFileBytes) {
        for (const scaleDown of [0.75, 0.55]) {
          if (blob.size <= targetPerFileBytes) break
          const nextW = Math.max(320, Math.round(width * scaleDown))
          const nextH = Math.max(320, Math.round(height * scaleDown))
          const candidate = await renderImageToBlob(
            img,
            nextW,
            nextH,
            outputMime,
            0.35,
            Boolean(options.grayscaleImages)
          )
          if (candidate.size < blob.size) {
            blob = candidate
            width = nextW
            height = nextH
          }
        }
      }
    }

    // Never output a larger file than original unless grayscale was explicitly requested
    const originalSize = item.size || item.file.size || 0
    let finalBlob = blob
    let finalMime = outputMime
    if (blob.size >= originalSize && !options.grayscaleImages) {
      finalBlob = item.file
      finalMime = item.type || outputMime
    }

    const ext =
      finalMime === 'image/webp'
        ? 'webp'
        : finalMime === 'image/png'
          ? 'png'
          : 'jpg'
    const baseName = stripImageExtension(item.name)
    const outputName = `${baseName}-kompres.${ext}`

    const compressedSize = finalBlob.size
    const savedBytes = Math.max(0, originalSize - compressedSize)
    const savedPercent =
      originalSize > 0 ? Math.max(0, Math.round((savedBytes / originalSize) * 100)) : 0

    return {
      id: item.id,
      sourceName: item.name,
      name: outputName,
      mimeType: finalMime,
      blob: finalBlob,
      width,
      height,
      originalSize,
      compressedSize,
      savedBytes,
      savedPercent,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function compressImageFiles(items = [], options = {}, onProgress) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Pilih minimal 1 berkas gambar terlebih dahulu untuk dikompres.')
  }

  const totalOriginal = items.reduce((acc, item) => acc + (item.size || 0), 0)
  const results = []
  let totalCompressedSize = 0

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx]
    if (onProgress) {
      onProgress(
        `Mengompres (${idx + 1}/${items.length}): "${truncateFileName(item.name, 28)}"...`
      )
    }
    const perFileTarget =
      options.targetMaxBytes && totalOriginal > 0
        ? Math.max(
            20480,
            Math.round((options.targetMaxBytes * (item.size || 0)) / totalOriginal)
          )
        : null

    const res = await compressSingleImageItem(item, options, perFileTarget)
    results.push(res)
    totalCompressedSize += res.compressedSize
  }

  let zipBlob = null
  let zipFileName = null
  if (results.length > 1) {
    if (onProgress) {
      onProgress(`Mengemas ${results.length} gambar terkompresi ke dalam arsip .zip...`)
    }
    const zip = new JSZip()
    const usedNames = new Set()
    results.forEach((f, idx) => {
      let entryName = f.name
      if (usedNames.has(entryName)) {
        const ext = f.mimeType === 'image/webp' ? 'webp' : f.mimeType === 'image/png' ? 'png' : 'jpg'
        entryName = `${stripPdfExtension(stripImageExtension(f.sourceName))}-kompres-${idx + 1}.${ext}`
      }
      usedNames.add(entryName)
      zip.file(entryName, f.blob)
    })
    zipBlob = await zip.generateAsync({ type: 'blob' })
    const firstBase = stripImageExtension(items[0]?.name || 'gambar')
    zipFileName = `${firstBase}-kompres-${results.length}-gambar.zip`
  }

  const totalSavedBytes = Math.max(0, totalOriginal - totalCompressedSize)
  const totalSavedPercent =
    totalOriginal > 0
      ? Math.max(0, Math.round((totalSavedBytes / totalOriginal) * 100))
      : 0

  return {
    fileCount: results.length,
    totalOriginalSize: totalOriginal,
    totalCompressedSize,
    totalSavedBytes,
    totalSavedPercent,
    primaryFile: results[0] || null,
    files: results,
    zipBlob,
    zipFileName,
  }
}

export { formatFileSize, truncateFileName }
