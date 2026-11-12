import { useState, useRef, useEffect, useCallback } from 'react'
import {
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconDownload,
  IconEdit,
  IconFileText,
  IconPlus,
  IconShield,
  IconSignPdf,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import {
  exportCanvasSignature,
  formatFileSize,
  inspectPdfFile,
  processSignatureImageFile,
  recolorCanvasStrokes,
  renderPdfPagePreviewToDataUrl,
  signPdfDocument,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'
import { useLanguage } from '../i18n/LanguageContext'

const SIGN_PALETTE_COLORS = [
  { hex: '#141112', labelId: 'Hitam', labelEn: 'Black' },
  { hex: '#1d4ed8', labelId: 'Biru', labelEn: 'Blue' },
  { hex: '#b91c1c', labelId: 'Merah', labelEn: 'Red' },
  { hex: '#15803d', labelId: 'Hijau', labelEn: 'Green' },
  { hex: '#7e22ce', labelId: 'Ungu', labelEn: 'Purple' },
]

function getEventTimeMs(event, fallback = 0) {
  if (typeof event?.timeStamp === 'number' && event.timeStamp > 0) return event.timeStamp
  return fallback || performance.now()
}

function inkPressureFactor(event) {
  if (!event || event.pointerType === 'mouse') return 1
  const pressure = event.pressure
  if (!pressure || pressure <= 0) return 1
  return 0.55 + pressure * 0.85
}

function inkWidthForSpeed(baseWidth, cssSpeed, pressureFactor) {
  // Goresan lambat menghasilkan tinta lebih tebal; goresan cepat menipis secara natural
  const speedNorm = Math.min(1, Math.max(0, (cssSpeed - 0.08) / 1.95))
  const curved = Math.pow(speedNorm, 0.72)
  const velocityFactor = 1.55 - curved * 1.27
  return Math.max(0.55, baseWidth * velocityFactor * pressureFactor)
}

function paintInkDot(ctx, x, y, width) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0.35, width / 2), 0, Math.PI * 2)
  ctx.fill()
}

function paintInkSegment(ctx, from, to) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 0.35) {
    paintInkDot(ctx, to.x, to.y, to.w)
    return
  }

  const steps = Math.max(1, Math.ceil(len / 1.25))
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const prevT = (i - 1) / steps
    const x = from.x + dx * t
    const y = from.y + dy * t
    const px = from.x + dx * prevT
    const py = from.y + dy * prevT
    const w = from.w + (to.w - from.w) * t
    const pw = from.w + (to.w - from.w) * prevT
    const sx = x - px
    const sy = y - py
    const seg = Math.hypot(sx, sy) || 1
    const nx = -sy / seg
    const ny = sx / seg
    const r0 = Math.max(0.35, pw / 2)
    const r1 = Math.max(0.35, w / 2)
    ctx.beginPath()
    ctx.moveTo(px + nx * r0, py + ny * r0)
    ctx.lineTo(x + nx * r1, y + ny * r1)
    ctx.lineTo(x - nx * r1, y - ny * r1)
    ctx.lineTo(px - nx * r0, py - ny * r0)
    ctx.closePath()
    ctx.fill()
    paintInkDot(ctx, x, y, w)
  }
}

function drawCurvedRingText(ctx, text, cx, cy, radius, startAngle, endAngle, isBottom = false) {
  const clean = String(text || '').trim().toUpperCase()
  if (!clean) return
  const chars = Array.from(clean)
  const count = chars.length
  const totalSpan = endAngle - startAngle
  const step = count > 1 ? totalSpan / (count - 1) : 0

  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const ch = chars[i]
    const angle = count > 1 ? startAngle + step * i : (startAngle + endAngle) / 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(isBottom ? angle - Math.PI / 2 : angle + Math.PI / 2)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

async function generateStampSignatureAsset({
  shape = 'circle',
  topText = 'RESMI • TERVERIFIKASI',
  centerText = 'LUNAS / SAH',
  bottomText = 'DOKUMEN DIGITAL',
  color = '#b91c1c',
}) {
  const canvas = document.createElement('canvas')
  const isCircle = shape !== 'rounded'
  canvas.width = isCircle ? 360 : 440
  canvas.height = isCircle ? 360 : 210
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (isCircle) {
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const outerR = 160
    const innerR = 148
    const coreR = 104

    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
    ctx.stroke()

    // Pita tengah untuk teks utama
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.moveTo(cx - innerR + 6, cy - 26)
    ctx.lineTo(cx + innerR - 6, cy - 26)
    ctx.moveTo(cx - innerR + 6, cy + 26)
    ctx.lineTo(cx + innerR - 6, cy + 26)
    ctx.stroke()

    ctx.font = '800 18px sans-serif'
    drawCurvedRingText(ctx, topText, cx, cy, 126, -Math.PI * 0.82, -Math.PI * 0.18, false)
    drawCurvedRingText(ctx, bottomText, cx, cy, 126, Math.PI * 0.82, Math.PI * 0.18, true)

    // Bintang kiri & kanan
    ctx.font = '800 18px sans-serif'
    ctx.fillText('★', cx - 126, cy)
    ctx.fillText('★', cx + 126, cy)

    const mainLabel = String(centerText || 'SAH').trim().toUpperCase() || 'SAH'
    const mainFontSize = mainLabel.length > 14 ? 22 : mainLabel.length > 10 ? 27 : 32
    ctx.font = `900 ${mainFontSize}px sans-serif`
    ctx.fillText(mainLabel, cx, cy + 1, innerR * 1.72)
  } else {
    const pad = 14
    const w = canvas.width - pad * 2
    const h = canvas.height - pad * 2

    ctx.lineWidth = 6.5
    ctx.strokeRect(pad, pad, w, h)

    ctx.lineWidth = 2.4
    ctx.strokeRect(pad + 8, pad + 8, w - 16, h - 16)

    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pad + 18, 66)
    ctx.lineTo(canvas.width - pad - 18, 66)
    ctx.moveTo(pad + 18, canvas.height - 66)
    ctx.lineTo(canvas.width - pad - 18, canvas.height - 66)
    ctx.stroke()

    const cx = canvas.width / 2
    if (String(topText || '').trim()) {
      ctx.font = '800 17px sans-serif'
      ctx.fillText(String(topText).trim().toUpperCase(), cx, 44, w - 36)
    }

    const mainLabel = String(centerText || 'SAH').trim().toUpperCase() || 'SAH'
    const mainFontSize = mainLabel.length > 16 ? 26 : mainLabel.length > 11 ? 32 : 38
    ctx.font = `900 ${mainFontSize}px sans-serif`
    ctx.fillText(mainLabel, cx, canvas.height / 2 + 1, w - 36)

    if (String(bottomText || '').trim()) {
      ctx.font = '800 16px sans-serif'
      ctx.fillText(String(bottomText).trim().toUpperCase(), cx, canvas.height - 44, w - 36)
    }
  }

  return exportCanvasSignature(canvas)
}

function createSignItemSlot(slotNumber = 1, kind = 'ttd') {
  const isStamp = kind === 'stamp'
  const posPresets = [
    { x: 76, y: 80 },
    { x: 28, y: 80 },
    { x: 52, y: 80 },
    { x: 76, y: 58 },
    { x: 28, y: 58 },
  ]
  const pos = isStamp
    ? { x: Math.max(20, Math.min(82, 62 - ((slotNumber - 1) % 3) * 18)), y: 78 }
    : posPresets[(slotNumber - 1) % posPresets.length]

  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind, // 'ttd' | 'stamp'
    sourceMode: isStamp ? 'stamp' : 'draw', // 'draw' | 'upload' | 'stamp'
    penColor: '#141112',
    penWidth: 3.5,
    drawnSignature: null,
    canvasDataUrl: '',
    uploadedSigRawFile: null,
    removeWhiteBg: true,
    uploadedSignature: null,
    stampInputType: 'generate', // 'generate' | 'upload'
    stampShape: 'circle', // 'circle' | 'rounded'
    stampColor: '#b91c1c',
    stampTopText: 'RESMI • TERVERIFIKASI',
    stampCenterText: 'LUNAS / SAH',
    stampBottomText: 'DOKUMEN DIGITAL',
    stampGeneratedSignature: null,
    stampUploadedRawFile: null,
    stampRemoveWhiteBg: true,
    stampUploadedSignature: null,
    posXPercent: pos.x,
    posYPercent: pos.y,
    scalePercent: isStamp ? 20 : 22,
    opacityPercent: isStamp ? 90 : 100,
    signerName: '',
    includeDate: false,
  }
}

function resolveItemSignatureAsset(item) {
  if (!item) return null
  if (item.sourceMode === 'draw') return item.drawnSignature
  if (item.sourceMode === 'upload') return item.uploadedSignature
  if (item.sourceMode === 'stamp') {
    return item.stampInputType === 'upload'
      ? item.stampUploadedSignature
      : item.stampGeneratedSignature
  }
  return null
}

export default function SignPdfPage() {
  const { lang } = useLanguage()
  const isEn = lang === 'en'

  const [pdfDocInfo, setPdfDocInfo] = useState(null)
  const [isDraggingPdf, setIsDraggingPdf] = useState(false)
  const [isDraggingSigFile, setIsDraggingSigFile] = useState(false)

  // Daftar multi-item TTD & Stempel di palette atas
  const [sigItems, setSigItems] = useState(() => [createSignItemSlot(1, 'ttd')])
  const [activeItemId, setActiveItemId] = useState('')

  // Daftar item yang sudah di-drag & drop ke dokumen (awalnya kosongan)
  const [placedStamps, setPlacedStamps] = useState([])
  const [selectedPlacementId, setSelectedPlacementId] = useState('')
  const [draggedPaletteItemId, setDraggedPaletteItemId] = useState('')
  const [isDropTargetActive, setIsDropTargetActive] = useState(false)

  // Pengaturan halaman tujuan:
  // - applyAllPages (tombol sendiri lakukan ke semua halaman)
  // - placementMode: 'manual' (full manual per halaman) | 'repeat' (pengulangan pola 2/3 halaman pertama)
  const [applyAllPages, setApplyAllPages] = useState(false)
  const [placementMode, setPlacementMode] = useState('manual')
  const [repeatCyclePages, setRepeatCyclePages] = useState(2)

  const [previewPageNum, setPreviewPageNum] = useState(1)
  const [pagePreviewUrl, setPagePreviewUrl] = useState('')
  const [singlePagePdfUrl, setSinglePagePdfUrl] = useState('')
  const [isRenderingPreview, setIsRenderingPreview] = useState(false)

  const [isSigFrameVisible, setIsSigFrameVisible] = useState(true)

  const [isInspecting, setIsInspecting] = useState(false)
  const [isProcessingSig, setIsProcessingSig] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [signResult, setSignResult] = useState(null)

  const placementCounterRef = useRef(1)
  const pdfFileInputRef = useRef(null)
  const sigFileInputRef = useRef(null)
  const stampFileInputRef = useRef(null)
  const drawCanvasRef = useRef(null)
  const loadedCanvasItemIdRef = useRef('')
  const isDrawingStrokeRef = useRef(false)
  const lastPointRef = useRef({ x: 0, y: 0, t: 0, w: 0, v: 0.45 })
  const prevStrokePointRef = useRef(null)
  const stampGrabRef = useRef({ dx: 0, dy: 0 })
  const sheetDragModeRef = useRef(null)
  const draggingPlacementIdRef = useRef('')
  const skipFrameOnFocusRef = useRef(false)
  const pageSheetRef = useRef(null)
  const pagePreviewCacheRef = useRef(new Map())
  const activeBlobUrlRef = useRef('')
  const resultRef = useRef(null)

  const currentItem = sigItems.find((it) => it.id === activeItemId) || sigItems[0]
  const currentItemId = currentItem?.id || ''
  const sigSourceMode = currentItem?.sourceMode || 'draw'
  const penColor = currentItem?.penColor || '#141112'
  const penWidth = currentItem?.penWidth || 3.5
  const drawnSignature = currentItem?.drawnSignature || null
  const uploadedSigRawFile = currentItem?.uploadedSigRawFile || null
  const removeWhiteBg = currentItem?.removeWhiteBg ?? true
  const uploadedSignature = currentItem?.uploadedSignature || null

  const filledItemsWithAssets = sigItems
    .map((item, idx) => ({
      item,
      idx,
      asset: resolveItemSignatureAsset(item),
    }))
    .filter((entry) => Boolean(entry.asset?.pngBytes))

  const totalDocPages = pdfDocInfo?.pageCount || 1
  const safeRepeatCycle = Math.max(1, Math.min(totalDocPages, Number(repeatCyclePages) || 2))
  const effectivePreviewTemplatePage =
    !applyAllPages && placementMode === 'repeat'
      ? ((previewPageNum - 1) % safeRepeatCycle) + 1
      : previewPageNum

  const visiblePlacements = placedStamps
    .map((placement) => {
      const entry = filledItemsWithAssets.find((e) => e.item.id === placement.sourceItemId)
      if (!entry) return null
      if (!applyAllPages && placement.pageNumber !== effectivePreviewTemplatePage) return null
      return { placement, entry }
    })
    .filter(Boolean)

  const activePlacement =
    placedStamps.find((p) => p.uid === selectedPlacementId) ||
    visiblePlacements[0]?.placement ||
    null

  const opacityPercent = activePlacement
    ? activePlacement.opacityPercent
    : (currentItem?.opacityPercent ?? 100)
  const signerName = activePlacement
    ? activePlacement.signerName
    : (currentItem?.signerName || '')
  const includeDate = activePlacement
    ? Boolean(activePlacement.includeDate)
    : Boolean(currentItem?.includeDate)

  const updateItemById = useCallback((targetId, updater) => {
    setSigItems((prev) =>
      prev.map((item) => {
        if (item.id !== targetId) return item
        const patch = typeof updater === 'function' ? updater(item) : updater
        return { ...item, ...patch }
      })
    )
  }, [])

  const updateCurrentItem = useCallback(
    (updater) => {
      if (!currentItemId) return
      updateItemById(currentItemId, updater)
    },
    [currentItemId, updateItemById]
  )

  const updatePlacementById = useCallback((uid, updater) => {
    setPlacedStamps((prev) =>
      prev.map((placement) => {
        if (placement.uid !== uid) return placement
        const patch = typeof updater === 'function' ? updater(placement) : updater
        return { ...placement, ...patch }
      })
    )
  }, [])

  const updateActiveAppearanceControl = (updater) => {
    if (activePlacement) {
      updatePlacementById(activePlacement.uid, updater)
    } else {
      updateCurrentItem(updater)
    }
  }

  // Auto-generate stempel saat item stempel menggunakan mode 'generate'
  const stampGenDepsKey =
    currentItem?.sourceMode === 'stamp' && currentItem?.stampInputType === 'generate'
      ? `${currentItemId}|${currentItem.stampShape}|${currentItem.stampColor}|${currentItem.stampTopText}|${currentItem.stampCenterText}|${currentItem.stampBottomText}`
      : ''

  useEffect(() => {
    if (!stampGenDepsKey || !currentItem) return
    let cancelled = false
    generateStampSignatureAsset({
      shape: currentItem.stampShape,
      topText: currentItem.stampTopText,
      centerText: currentItem.stampCenterText,
      bottomText: currentItem.stampBottomText,
      color: currentItem.stampColor,
    })
      .then((asset) => {
        if (cancelled || asset.isEmpty) return
        updateItemById(currentItem.id, { stampGeneratedSignature: asset })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [stampGenDepsKey, currentItem, updateItemById])

  useEffect(() => {
    const hideFrameOutsideStamp = (event) => {
      const target = event.target
      if (
        target &&
        typeof target.closest === 'function' &&
        (target.closest('.pdf-sheet-sig-stamp') ||
          target.closest('.pdf-signature-pad-card') ||
          target.closest('.pdf-signature-upload-box') ||
          target.closest('.pdf-sig-items-bar') ||
          target.closest('.pdf-preview-palette-col') ||
          target.closest('.pdf-sign-below-preview-grid'))
      ) {
        return
      }
      setIsSigFrameVisible(false)
    }
    window.addEventListener('pointerdown', hideFrameOutsideStamp)
    return () => window.removeEventListener('pointerdown', hideFrameOutsideStamp)
  }, [])

  const todayFormatted = new Date().toLocaleDateString(isEn ? 'en-US' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const initDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const targetW = Math.max(320, Math.round((rect.width || 460) * dpr))
    const targetH = Math.max(150, Math.round((rect.height || 175) * dpr))
    if (canvas.width !== targetW || canvas.height !== targetH) {
      // Pertahankan coretan yang sudah ada bila ukuran kanvas berubah
      let snapshot = null
      if (canvas.width > 0 && canvas.height > 0 && isDrawingStrokeRef.current === false) {
        snapshot = document.createElement('canvas')
        snapshot.width = canvas.width
        snapshot.height = canvas.height
        snapshot.getContext('2d').drawImage(canvas, 0, 0)
      }
      canvas.width = targetW
      canvas.height = targetH
      if (snapshot) {
        canvas.getContext('2d').drawImage(snapshot, 0, 0, targetW, targetH)
      }
    }
  }, [])

  useEffect(() => {
    if (!pdfDocInfo || sigSourceMode !== 'draw') {
      loadedCanvasItemIdRef.current = ''
      return
    }
    const canvas = drawCanvasRef.current
    if (!canvas) return
    initDrawCanvas()
    if (loadedCanvasItemIdRef.current === currentItemId) return
    loadedCanvasItemIdRef.current = currentItemId

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const savedUrl = currentItem?.canvasDataUrl || ''
    if (savedUrl) {
      const img = new Image()
      img.onload = () => {
        if (loadedCanvasItemIdRef.current !== currentItemId || !drawCanvasRef.current) return
        const c = drawCanvasRef.current
        const cCtx = c.getContext('2d')
        cCtx.clearRect(0, 0, c.width, c.height)
        cCtx.drawImage(img, 0, 0, c.width, c.height)
      }
      img.src = savedUrl
    }
  }, [pdfDocInfo, sigSourceMode, currentItemId, currentItem?.canvasDataUrl, initDrawCanvas])

  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current)
        activeBlobUrlRef.current = ''
      }
    }
  }, [])

  // Render halaman dokumen PDF ke kanvas & blob 1-halaman agar pratinjau dokumen tampil akurat
  useEffect(() => {
    let isCancelled = false

    const loadPagePreview = async () => {
      if (!pdfDocInfo?.file) {
        if (!isCancelled) {
          setPagePreviewUrl('')
          setSinglePagePdfUrl('')
        }
        return
      }

      await Promise.resolve()
      if (isCancelled) return

      const cacheKey = `${pdfDocInfo.name}-${pdfDocInfo.size}-${previewPageNum}`
      if (pagePreviewCacheRef.current.has(cacheKey)) {
        const cached = pagePreviewCacheRef.current.get(cacheKey)
        if (!isCancelled) {
          setPagePreviewUrl(cached.dataUrl || '')
          if (activeBlobUrlRef.current) {
            URL.revokeObjectURL(activeBlobUrlRef.current)
            activeBlobUrlRef.current = ''
          }
          if (cached.singlePagePdfBytes) {
            const blob = new Blob([cached.singlePagePdfBytes], { type: 'application/pdf' })
            const nextBlobUrl = URL.createObjectURL(blob)
            activeBlobUrlRef.current = nextBlobUrl
            setSinglePagePdfUrl(nextBlobUrl)
          } else {
            setSinglePagePdfUrl('')
          }
          setIsRenderingPreview(false)
        }
        return
      }

      setIsRenderingPreview(true)

      try {
        const res = await renderPdfPagePreviewToDataUrl(pdfDocInfo.file, previewPageNum)
        if (isCancelled) return
        const dataUrl = res?.dataUrl || ''
        const singlePagePdfBytes = res?.singlePagePdfBytes || null
        pagePreviewCacheRef.current.set(cacheKey, { dataUrl, singlePagePdfBytes })
        setPagePreviewUrl(dataUrl)

        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current)
          activeBlobUrlRef.current = ''
        }
        if (singlePagePdfBytes) {
          const blob = new Blob([singlePagePdfBytes], { type: 'application/pdf' })
          const nextBlobUrl = URL.createObjectURL(blob)
          activeBlobUrlRef.current = nextBlobUrl
          setSinglePagePdfUrl(nextBlobUrl)
        } else {
          setSinglePagePdfUrl('')
        }
      } catch {
        if (!isCancelled) {
          setPagePreviewUrl('')
          setSinglePagePdfUrl('')
        }
      } finally {
        if (!isCancelled) setIsRenderingPreview(false)
      }
    }

    loadPagePreview()

    return () => {
      isCancelled = true
    }
  }, [pdfDocInfo, previewPageNum])

  const getCanvasPoint = (e) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / Math.max(1, rect.width)
    const scaleY = canvas.height / Math.max(1, rect.height)
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const syncDrawnCanvasToState = async () => {
    const canvas = drawCanvasRef.current
    if (!canvas || !currentItemId) return
    try {
      const exported = await exportCanvasSignature(canvas)
      if (exported.isEmpty) {
        updateItemById(currentItemId, { drawnSignature: null, canvasDataUrl: '' })
      } else {
        const rawSnapshot = canvas.toDataURL('image/png')
        updateItemById(currentItemId, {
          drawnSignature: exported,
          canvasDataUrl: rawSnapshot,
        })
        setIsSigFrameVisible(true)
        setSignResult(null)
      }
    } catch {
      // Abaikan jika kanvas belum siap diekspor
    }
  }

  const handlePenColorChange = async (nextColor) => {
    updateCurrentItem({ penColor: nextColor })
    if (drawCanvasRef.current && drawnSignature) {
      recolorCanvasStrokes(drawCanvasRef.current, nextColor)
      await syncDrawnCanvasToState()
    }
  }

  const plotInkPoint = (ctx, point, event, isStart, forcedTime) => {
    const dpr = ctx.canvas.width / Math.max(1, ctx.canvas.getBoundingClientRect().width || 460)
    const baseWidth = penWidth * dpr
    const now = typeof forcedTime === 'number' ? forcedTime : getEventTimeMs(event)
    const prev = lastPointRef.current
    const pressure = inkPressureFactor(event)
    let width = baseWidth * 0.92 * pressure
    let nextVelocity = 0.45

    if (!isStart && prev) {
      const distance = Math.hypot(point.x - prev.x, point.y - prev.y)
      if (distance < 0.4) return
      const cssDistance = distance / Math.max(1, dpr)
      const rawElapsed = prev.t ? now - prev.t : 16
      const elapsed = rawElapsed > 1 ? rawElapsed : 12
      const instantSpeed = cssDistance / elapsed
      nextVelocity = typeof prev.v === 'number' ? prev.v * 0.55 + instantSpeed * 0.45 : instantSpeed
      const rawWidth = inkWidthForSpeed(baseWidth, nextVelocity, pressure)
      width = prev.w * 0.52 + rawWidth * 0.48
      ctx.fillStyle = penColor
      paintInkSegment(ctx, prev, { x: point.x, y: point.y, w: width })
      prevStrokePointRef.current = prev
    } else {
      ctx.fillStyle = penColor
      paintInkDot(ctx, point.x, point.y, width)
      prevStrokePointRef.current = null
    }

    lastPointRef.current = { x: point.x, y: point.y, t: now, w: width, v: nextVelocity }
  }

  const handleCanvasPointerDown = (e) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    e.preventDefault()
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // Abaikan pada perangkat yang tidak mendukung pointer capture
      }
    }
    initDrawCanvas()
    const ctx = canvas.getContext('2d')
    isDrawingStrokeRef.current = true
    plotInkPoint(ctx, getCanvasPoint(e), e, true)
    setErrorMsg('')
  }

  const handleCanvasPointerMove = (e) => {
    if (!isDrawingStrokeRef.current) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
    const points = samples.length ? samples : [e]
    const prevTime = lastPointRef.current.t || getEventTimeMs(e)
    const endTime = typeof e.timeStamp === 'number' && e.timeStamp > prevTime ? e.timeStamp : prevTime + 16
    points.forEach((sample, idx) => {
      const hasOwnTime =
        typeof sample.timeStamp === 'number' &&
        sample.timeStamp > prevTime &&
        (points.length === 1 || sample.timeStamp !== e.timeStamp)
      const interpTime = hasOwnTime
        ? sample.timeStamp
        : prevTime + ((endTime - prevTime) * (idx + 1)) / points.length
      plotInkPoint(ctx, getCanvasPoint(sample), sample, false, interpTime)
    })
  }

  const handleCanvasPointerUp = async (e) => {
    if (!isDrawingStrokeRef.current) return
    isDrawingStrokeRef.current = false
    const canvas = drawCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      const tip = lastPointRef.current
      const before = prevStrokePointRef.current
      if (tip && before) {
        const dx = tip.x - before.x
        const dy = tip.y - before.y
        const len = Math.hypot(dx, dy)
        if (len > 1.2) {
          const reach = Math.min(tip.w * 0.9, len * 0.6)
          ctx.fillStyle = penColor
          paintInkSegment(ctx, tip, {
            x: tip.x + (dx / len) * reach,
            y: tip.y + (dy / len) * reach,
            w: Math.max(0.5, tip.w * 0.42),
          })
        }
      }
      if (canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(e.pointerId)
        } catch {
          // Abaikan jika pointer capture sudah dilepas
        }
      }
    }
    await syncDrawnCanvasToState()
  }

  const handleClearCanvas = () => {
    const canvas = drawCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    updateCurrentItem({ drawnSignature: null, canvasDataUrl: '' })
    setSignResult(null)
  }

  const handleAddItemSlot = (kind = 'ttd') => {
    setSigItems((prev) => {
      const nextSlot = createSignItemSlot(prev.length + 1, kind)
      setActiveItemId(nextSlot.id)
      return [...prev, nextSlot]
    })
    setIsSigFrameVisible(true)
    setErrorMsg('')
    setSignResult(null)
  }

  const handleRemoveItemSlot = (targetId) => {
    setSigItems((prev) => {
      if (prev.length <= 1) return prev
      const filtered = prev.filter((it) => it.id !== targetId)
      if (activeItemId === targetId && filtered.length > 0) {
        setActiveItemId(filtered[filtered.length - 1].id)
      }
      return filtered
    })
    setPlacedStamps((prev) => prev.filter((p) => p.sourceItemId !== targetId))
    setSignResult(null)
  }

  const handleSelectPdfFile = async (file) => {
    if (!file) return
    setErrorMsg('')
    setIsInspecting(true)
    setProcessStep(
      isEn
        ? `Reading PDF document "${truncateFileName(file.name)}"...`
        : `Membaca dokumen PDF "${truncateFileName(file.name)}"...`
    )

    try {
      const info = await inspectPdfFile(file)
      pagePreviewCacheRef.current.clear()
      setPdfDocInfo(info)
      setPlacedStamps([])
      setSelectedPlacementId('')
      setApplyAllPages(false)
      setPlacementMode('manual')
      setRepeatCyclePages(Math.min(2, info.pageCount || 1))
      setSignResult(null)
      setPreviewPageNum(1)
    } catch (err) {
      setErrorMsg(
        err.message || (isEn ? 'Failed to read PDF file.' : 'Gagal membaca berkas PDF.')
      )
    } finally {
      setIsInspecting(false)
      setProcessStep('')
    }
  }

  const handleClearPdfFile = () => {
    pagePreviewCacheRef.current.clear()
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current)
      activeBlobUrlRef.current = ''
    }
    setPdfDocInfo(null)
    setPagePreviewUrl('')
    setSinglePagePdfUrl('')
    setPlacedStamps([])
    setSelectedPlacementId('')
    setApplyAllPages(false)
    setPlacementMode('manual')
    setRepeatCyclePages(2)
    setSignResult(null)
    setErrorMsg('')
    setPreviewPageNum(1)
  }

  const handleUploadSignatureFile = async (file, customRemoveWhite = removeWhiteBg) => {
    if (!file || !currentItemId) return
    setErrorMsg('')
    setIsProcessingSig(true)
    try {
      const processed = await processSignatureImageFile(file, {
        removeWhiteBg: customRemoveWhite,
      })
      updateItemById(currentItemId, {
        uploadedSigRawFile: file,
        uploadedSignature: processed,
        sourceMode: 'upload',
      })
      setIsSigFrameVisible(true)
      setSignResult(null)
    } catch (err) {
      setErrorMsg(
        err.message ||
          (isEn
            ? 'Failed to process signature image file.'
            : 'Gagal memproses berkas gambar tanda tangan.')
      )
    } finally {
      setIsProcessingSig(false)
    }
  }

  const handleToggleRemoveWhiteBg = async () => {
    const nextVal = !removeWhiteBg
    updateCurrentItem({ removeWhiteBg: nextVal })
    if (uploadedSigRawFile) {
      await handleUploadSignatureFile(uploadedSigRawFile, nextVal)
    }
  }

  const handleUploadStampFile = async (
    file,
    customRemoveWhite = currentItem?.stampRemoveWhiteBg ?? true
  ) => {
    if (!file || !currentItemId) return
    setErrorMsg('')
    setIsProcessingSig(true)
    try {
      const processed = await processSignatureImageFile(file, {
        removeWhiteBg: customRemoveWhite,
      })
      updateItemById(currentItemId, {
        stampUploadedRawFile: file,
        stampUploadedSignature: processed,
        sourceMode: 'stamp',
        stampInputType: 'upload',
      })
      setIsSigFrameVisible(true)
      setSignResult(null)
    } catch (err) {
      setErrorMsg(
        err.message ||
          (isEn
            ? 'Failed to process stamp image file.'
            : 'Gagal memproses berkas gambar stempel.')
      )
    } finally {
      setIsProcessingSig(false)
    }
  }

  const handleToggleStampRemoveWhiteBg = async () => {
    const nextVal = !(currentItem?.stampRemoveWhiteBg ?? true)
    updateCurrentItem({ stampRemoveWhiteBg: nextVal })
    if (currentItem?.stampUploadedRawFile) {
      await handleUploadStampFile(currentItem.stampUploadedRawFile, nextVal)
    }
  }

  const placeItemOnDocument = (sourceItemId, xPercent = null, yPercent = null) => {
    const sourceItem = sigItems.find((it) => it.id === sourceItemId)
    if (!sourceItem || !resolveItemSignatureAsset(sourceItem)?.pngBytes) return
    const targetPage =
      !applyAllPages && placementMode === 'repeat'
        ? effectivePreviewTemplatePage
        : previewPageNum
    const existingOnPage = placedStamps.filter((p) => p.pageNumber === targetPage).length
    const defaultX = Math.max(22, Math.min(82, 74 - (existingOnPage % 3) * 24))
    const defaultY = Math.max(22, Math.min(84, 78 - Math.floor(existingOnPage / 3) * 20))
    const nextUid = `place-${placementCounterRef.current}`
    placementCounterRef.current += 1
    const newPlacement = {
      uid: nextUid,
      sourceItemId: sourceItem.id,
      pageNumber: targetPage,
      xPercent: Math.round(Math.max(8, Math.min(92, xPercent ?? defaultX))),
      yPercent: Math.round(Math.max(8, Math.min(92, yPercent ?? defaultY))),
      scalePercent: sourceItem.scalePercent ?? (sourceItem.kind === 'stamp' ? 20 : 22),
      opacityPercent: sourceItem.opacityPercent ?? (sourceItem.kind === 'stamp' ? 90 : 100),
      signerName: sourceItem.signerName || '',
      includeDate: Boolean(sourceItem.includeDate),
    }
    setPlacedStamps((prev) => [...prev, newPlacement])
    setSelectedPlacementId(newPlacement.uid)
    setActiveItemId(sourceItem.id)
    setIsSigFrameVisible(true)
    setErrorMsg('')
    setSignResult(null)
  }

  const handleRemovePlacement = (uid) => {
    setPlacedStamps((prev) => {
      const next = prev.filter((p) => p.uid !== uid)
      if (selectedPlacementId === uid) {
        setSelectedPlacementId(next[next.length - 1]?.uid || '')
      }
      return next
    })
    setSignResult(null)
  }

  const handleSheetDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDropTargetActive) setIsDropTargetActive(true)
  }

  const handleSheetDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDropTargetActive(false)
    }
  }

  const handleSheetDrop = (e) => {
    e.preventDefault()
    setIsDropTargetActive(false)
    const droppedItemId = e.dataTransfer.getData('text/plain') || draggedPaletteItemId
    setDraggedPaletteItemId('')
    if (!droppedItemId) return
    const sheet = pageSheetRef.current
    if (!sheet) {
      placeItemOnDocument(droppedItemId)
      return
    }
    const rect = sheet.getBoundingClientRect()
    const rawX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100
    const rawY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100
    placeItemOnDocument(droppedItemId, rawX, rawY)
  }

  const updateSheetPositionFromPointer = (clientX, clientY) => {
    const sheet = pageSheetRef.current
    const targetUid = draggingPlacementIdRef.current || activePlacement?.uid
    if (!sheet || !targetUid) return
    const rect = sheet.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const { dx, dy } = stampGrabRef.current
    const rawX = ((clientX - dx - rect.left) / rect.width) * 100
    const rawY = ((clientY - dy - rect.top) / rect.height) * 100
    updatePlacementById(targetUid, {
      posXPercent: undefined,
      xPercent: Math.round(Math.max(8, Math.min(92, rawX))),
      yPercent: Math.round(Math.max(8, Math.min(92, rawY))),
    })
    setSignResult(null)
  }

  const updateSignatureScaleFromCornerPointer = (clientX, clientY) => {
    const sheet = pageSheetRef.current
    const targetUid = draggingPlacementIdRef.current || activePlacement?.uid
    if (!sheet || !targetUid) return
    const rect = sheet.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const targetPlacement = placedStamps.find((p) => p.uid === targetUid) || activePlacement
    const targetItem = sigItems.find((it) => it.id === targetPlacement?.sourceItemId)
    const targetAsset = resolveItemSignatureAsset(targetItem)
    const centerX = rect.left + ((targetPlacement?.xPercent ?? 76) / 100) * rect.width
    const centerY = rect.top + ((targetPlacement?.yPercent ?? 80) / 100) * rect.height
    const sigAspect = targetAsset?.aspectRatio || 2.2

    const distXPercent = (Math.abs(clientX - centerX) / rect.width) * 200
    const distYPercent = ((Math.abs(clientY - centerY) * sigAspect) / rect.width) * 200
    const nextScale = Math.max(distXPercent, distYPercent)

    updatePlacementById(targetUid, {
      scalePercent: Math.round(Math.max(8, Math.min(55, nextScale))),
    })
    setSignResult(null)
  }

  const handleSheetPointerDown = (e) => {
    if (visiblePlacements.length === 0) return
    const target = e.target
    if (target && typeof target.closest === 'function' && target.closest('.pdf-sheet-sig-stamp')) {
      return
    }
    if (document.activeElement !== pageSheetRef.current) {
      skipFrameOnFocusRef.current = true
      requestAnimationFrame(() => {
        skipFrameOnFocusRef.current = false
      })
    }
    setIsSigFrameVisible(false)
  }

  const handleStampPointerDown = (e, placement) => {
    if (!placement) return
    const target = e.target
    if (
      target &&
      typeof target.closest === 'function' &&
      (target.closest('.pdf-sig-corner-handle') || target.closest('.pdf-sig-stamp-remove-mini'))
    ) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setSelectedPlacementId(placement.uid)
    draggingPlacementIdRef.current = placement.uid
    setIsSigFrameVisible(true)
    const sheet = pageSheetRef.current
    if (sheet && sheet.setPointerCapture) {
      try {
        sheet.setPointerCapture(e.pointerId)
      } catch {
        // Abaikan jika perangkat tidak mendukung pointer capture
      }
    }
    if (sheet) {
      const rect = sheet.getBoundingClientRect()
      const centerX = rect.left + (placement.xPercent / 100) * rect.width
      const centerY = rect.top + (placement.yPercent / 100) * rect.height
      stampGrabRef.current = { dx: e.clientX - centerX, dy: e.clientY - centerY }
    }
    sheetDragModeRef.current = 'move'
    setSignResult(null)
  }

  const handleSheetFocus = () => {
    if (skipFrameOnFocusRef.current) {
      skipFrameOnFocusRef.current = false
      return
    }
    if (visiblePlacements.length > 0) setIsSigFrameVisible(true)
  }

  const handleCornerResizePointerDown = (e, placement) => {
    if (!placement) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedPlacementId(placement.uid)
    draggingPlacementIdRef.current = placement.uid
    setIsSigFrameVisible(true)
    const sheet = pageSheetRef.current
    if (sheet && sheet.setPointerCapture) {
      try {
        sheet.setPointerCapture(e.pointerId)
      } catch {
        // Abaikan jika perangkat tidak mendukung pointer capture
      }
    }
    sheetDragModeRef.current = 'resize'
    updateSignatureScaleFromCornerPointer(e.clientX, e.clientY)
  }

  const handleSheetPointerMove = (e) => {
    if (!sheetDragModeRef.current) return
    e.preventDefault()
    if (sheetDragModeRef.current === 'resize') {
      updateSignatureScaleFromCornerPointer(e.clientX, e.clientY)
    } else {
      updateSheetPositionFromPointer(e.clientX, e.clientY)
    }
  }

  const handleSheetPointerUp = (e) => {
    if (!sheetDragModeRef.current) return
    sheetDragModeRef.current = null
    draggingPlacementIdRef.current = ''
    const sheet = pageSheetRef.current
    if (sheet && sheet.releasePointerCapture) {
      try {
        sheet.releasePointerCapture(e.pointerId)
      } catch {
        // Abaikan jika sudah dilepas
      }
    }
  }

  const handleSheetKeyDown = (e) => {
    if (!activePlacement) return
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === '+' ||
      e.key === '=' ||
      e.key === '-' ||
      e.key === '_'
    ) {
      setIsSigFrameVisible(true)
    }
    const step = e.shiftKey ? 5 : 2
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      updatePlacementById(activePlacement.uid, (p) => ({ xPercent: Math.max(8, p.xPercent - step) }))
      setSignResult(null)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      updatePlacementById(activePlacement.uid, (p) => ({ xPercent: Math.min(92, p.xPercent + step) }))
      setSignResult(null)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      updatePlacementById(activePlacement.uid, (p) => ({ yPercent: Math.max(8, p.yPercent - step) }))
      setSignResult(null)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      updatePlacementById(activePlacement.uid, (p) => ({ yPercent: Math.min(92, p.yPercent + step) }))
      setSignResult(null)
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      updatePlacementById(activePlacement.uid, (p) => ({ scalePercent: Math.min(55, p.scalePercent + 2) }))
      setSignResult(null)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      updatePlacementById(activePlacement.uid, (p) => ({ scalePercent: Math.max(8, p.scalePercent - 2) }))
      setSignResult(null)
    }
  }

  const validPlacedEntries = placedStamps
    .map((placement) => {
      const entry = filledItemsWithAssets.find((e) => e.item.id === placement.sourceItemId)
      if (!entry) return null
      return { placement, entry }
    })
    .filter(Boolean)

  const allDocPages = pdfDocInfo
    ? Array.from({ length: pdfDocInfo.pageCount }, (_, i) => i + 1)
    : []

  const resolvePlacementTargetPages = (placement) => {
    if (!pdfDocInfo) return []
    if (applyAllPages) return allDocPages
    if (placementMode === 'repeat') {
      if (placement.pageNumber < 1 || placement.pageNumber > safeRepeatCycle) return []
      return allDocPages.filter((p) => ((p - 1) % safeRepeatCycle) + 1 === placement.pageNumber)
    }
    return [placement.pageNumber]
  }

  const activeModePlacedEntries =
    !applyAllPages && placementMode === 'repeat'
      ? validPlacedEntries.filter(
          ({ placement }) => placement.pageNumber >= 1 && placement.pageNumber <= safeRepeatCycle
        )
      : validPlacedEntries

  const targetPagesList = pdfDocInfo
    ? Array.from(
        new Set(
          activeModePlacedEntries.flatMap(({ placement }) =>
            resolvePlacementTargetPages(placement)
          )
        )
      ).sort((a, b) => a - b)
    : []

  const handleSignPdfNow = async (e) => {
    if (e) e.preventDefault()
    if (!pdfDocInfo?.file) {
      setErrorMsg(
        isEn ? 'Please upload a PDF file first.' : 'Unggah berkas PDF terlebih dahulu.'
      )
      return
    }

    if (filledItemsWithAssets.length === 0) {
      setErrorMsg(
        isEn
          ? 'Please create or upload at least 1 signature or stamp first.'
          : 'Buat atau unggah minimal 1 tanda tangan atau stempel terlebih dahulu.'
      )
      return
    }

    if (activeModePlacedEntries.length === 0 || targetPagesList.length === 0) {
      setErrorMsg(
        !applyAllPages && placementMode === 'repeat'
          ? isEn
            ? `Place at least 1 signature or stamp within the first ${safeRepeatCycle} template page(s).`
            : `Taruh minimal 1 TTD atau stempel pada ${safeRepeatCycle} halaman pola pertama.`
          : isEn
            ? 'Drag & drop at least 1 signature or stamp from the left list onto the document preview.'
            : 'Tarik & lepas minimal 1 TTD atau stempel dari daftar kiri ke lembar dokumen.'
      )
      return
    }

    setErrorMsg('')
    setIsSigning(true)
    setProcessStep(
      isEn
        ? 'Embedding signatures & stamps onto PDF pages directly in your browser...'
        : 'Menempelkan tanda tangan & stempel ke halaman PDF langsung di browsermu...'
    )

    try {
      const res = await signPdfDocument(
        {
          file: pdfDocInfo.file,
          signatureItems: activeModePlacedEntries.map(({ placement, entry }) => ({
            pngBytes: entry.asset.pngBytes,
            xPercent: placement.xPercent,
            yPercent: placement.yPercent,
            scalePercent: placement.scalePercent,
            opacityPercent: placement.opacityPercent,
            signerName: placement.signerName,
            signDateText: placement.includeDate ? todayFormatted : '',
            pages: resolvePlacementTargetPages(placement),
          })),
          pages: targetPagesList,
        },
        (step) => setProcessStep(step)
      )

      triggerBrowserDownload(res.pdfBytes, res.fileName, 'application/pdf')

      setSignResult({
        ...res,
        timestamp: new Date().toLocaleTimeString(isEn ? 'en-US' : 'id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 80)
    } catch (err) {
      setErrorMsg(
        err.message ||
          (isEn ? 'Failed to sign PDF document.' : 'Gagal menandatangani dokumen PDF.')
      )
    } finally {
      setIsSigning(false)
      setProcessStep('')
    }
  }

  const isBusy = isInspecting || isProcessingSig || isSigning
  const currentPreviewMeta =
    pdfDocInfo?.pagesMeta?.[previewPageNum - 1] ||
    pdfDocInfo?.pagesMeta?.[0] || {
      pageNumber: previewPageNum,
      width: 595,
      height: 842,
    }
  const pageAspectRatio =
    (currentPreviewMeta.width || 595) / Math.max(1, currentPreviewMeta.height || 842)

  return (
    <section className="clean-hero-section">
      <h1 className="editorial-hero-title">
        {isEn ? 'Sign PDF Document' : 'Tanda Tangani PDF'}
      </h1>

      <p className="editorial-hero-subtitle">
        {isEn
          ? 'Add a signature file or sign directly'
          : 'Tambahkan file tanda tangan atau gambar langsung'}
      </p>

      <div
        className={`clean-workspace-card ${isDraggingPdf ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!pdfDocInfo) setIsDraggingPdf(true)
        }}
        onDragLeave={() => setIsDraggingPdf(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDraggingPdf(false)
          if (!pdfDocInfo) {
            const droppedFile = e.dataTransfer?.files?.[0]
            if (droppedFile) handleSelectPdfFile(droppedFile)
          }
        }}
      >
        <input
          ref={pdfFileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleSelectPdfFile(f)
            e.target.value = ''
          }}
        />

        <input
          ref={sigFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUploadSignatureFile(f)
            e.target.value = ''
          }}
        />

        <input
          ref={stampFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUploadStampFile(f)
            e.target.value = ''
          }}
        />

        {!pdfDocInfo ? (
          <>
            <div
              className="pdf-dropzone-area"
              role="button"
              tabIndex={0}
              onClick={() => pdfFileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  pdfFileInputRef.current?.click()
                }
              }}
            >
              <div className="pdf-dropzone-icon">
                <IconSignPdf size={24} />
              </div>
              <div className="pdf-dropzone-text">
                <strong>
                  {isEn
                    ? 'Drag & drop PDF file here first'
                    : 'Tarik & lepas berkas PDF ke sini terlebih dahulu'}
                </strong>
                <span>
                  {isEn
                    ? 'or click to select the PDF document you want to sign'
                    : 'atau klik untuk memilih dokumen PDF yang ingin ditandatangani'}
                </span>
              </div>
              <span className="pdf-dropzone-pill">
                <IconPlus size={13} />
                <span>{isEn ? 'Select PDF File' : 'Pilih File PDF'}</span>
              </span>
            </div>

            <div className="pdf-action-bar">
              <div className="pdf-action-summary">
                <span className="pdf-privacy-badge">
                  <IconShield size={14} />
                  <span>
                    {isEn
                      ? '100% Local - Privacy Protected'
                      : '100% Lokal - Privasi Terjaga'}
                  </span>
                </span>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={handleSignPdfNow}>
            {/* 1. BANNER DOKUMEN PDF YANG DIUNGGAH */}
            <div className="workspace-doc-bar">
              <div className="active-doc-banner">
                <div className="active-doc-info">
                  <span className="active-doc-icon">
                    <IconFileText size={16} />
                  </span>
                  <div className="active-doc-text">
                    <div className="active-doc-title-row">
                      <strong className="active-doc-filename" title={pdfDocInfo.name}>
                        {truncateFileName(pdfDocInfo.name, 34)}
                      </strong>
                      <span className="active-doc-tag">
                        {pdfDocInfo.pageCount} {isEn ? 'Pages' : 'Halaman'}
                      </span>
                      <span className="pdf-file-size">
                        {formatFileSize(pdfDocInfo.size)}
                      </span>
                      <span
                        className="active-doc-verified"
                        title={isEn ? 'Ready to Sign' : 'Siap Ditandatangani'}
                        aria-label={isEn ? 'Ready to Sign' : 'Siap Ditandatangani'}
                      >
                        <IconCheck size={12} />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="active-doc-actions">
                  <button
                    type="button"
                    className="doc-action-btn"
                    onClick={() => pdfFileInputRef.current?.click()}
                    disabled={isBusy}
                  >
                    <IconUpload size={13} />
                    <span>{isEn ? 'Replace PDF' : 'Ganti PDF'}</span>
                  </button>
                  <button
                    type="button"
                    className="doc-remove-btn"
                    onClick={handleClearPdfFile}
                    disabled={isBusy}
                    title={isEn ? 'Remove PDF document' : 'Hapus dokumen PDF'}
                    aria-label={isEn ? 'Remove PDF document' : 'Hapus dokumen PDF'}
                  >
                    <IconClose size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* 2. KOTAK TANDA TANGAN & STEMPEL (MENDUKUNG MULTIPLE TTD & STEMPEL) */}
            <div className="pdf-sign-source-section">
              <div className="pdf-sig-items-bar">
                <div className="pdf-sig-items-list" role="tablist" aria-label={isEn ? 'Signatures and stamps list' : 'Daftar tanda tangan dan stempel'}>
                  {sigItems.map((item, idx) => {
                    const isItemActive = item.id === currentItemId
                    const hasAsset = Boolean(resolveItemSignatureAsset(item)?.pngBytes)
                    const isStampSlot = item.sourceMode === 'stamp' || item.kind === 'stamp'
                    const itemLabel = isStampSlot
                      ? `${isEn ? 'Stamp' : 'Stempel'} #${idx + 1}`
                      : `TTD #${idx + 1}`
                    return (
                      <div
                        key={item.id}
                        className={`pdf-sig-item-chip ${isItemActive ? 'is-active' : ''} ${hasAsset ? 'is-ready' : ''}`}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={isItemActive}
                          className="pdf-sig-item-chip-btn"
                          onClick={() => {
                            setActiveItemId(item.id)
                            setIsSigFrameVisible(true)
                            setErrorMsg('')
                          }}
                        >
                          <span className="pdf-sig-item-dot" />
                          <span>{itemLabel}</span>
                          {hasAsset && <IconCheck size={11} />}
                        </button>
                        {sigItems.length > 1 && (
                          <button
                            type="button"
                            className="pdf-sig-item-remove-btn"
                            onClick={() => handleRemoveItemSlot(item.id)}
                            title={isEn ? `Remove ${itemLabel}` : `Hapus ${itemLabel}`}
                            aria-label={isEn ? `Remove ${itemLabel}` : `Hapus ${itemLabel}`}
                          >
                            <IconClose size={10} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="pdf-sig-items-actions">
                  <button
                    type="button"
                    className="pdf-add-sig-slot-btn"
                    onClick={() => handleAddItemSlot('ttd')}
                  >
                    <IconPlus size={12} />
                    <span>{isEn ? 'Add Signature (TTD)' : 'Tambah TTD'}</span>
                  </button>
                  <button
                    type="button"
                    className="pdf-add-sig-slot-btn is-stamp"
                    onClick={() => handleAddItemSlot('stamp')}
                  >
                    <IconPlus size={12} />
                    <span>{isEn ? 'Add Stamp' : 'Tambah Stempel'}</span>
                  </button>
                </div>
              </div>

              <div className="pdf-sign-section-head">
                <span className="pdf-mode-label">
                  {currentItem?.kind === 'stamp'
                    ? isEn
                      ? `Configure Stamp #${sigItems.findIndex((it) => it.id === currentItemId) + 1}`
                      : `Atur Stempel #${sigItems.findIndex((it) => it.id === currentItemId) + 1}`
                    : isEn
                      ? `Configure Signature #${sigItems.findIndex((it) => it.id === currentItemId) + 1}`
                      : `Atur TTD #${sigItems.findIndex((it) => it.id === currentItemId) + 1}`}
                </span>

                {currentItem?.kind === 'stamp' ? (
                  <div
                    className="pdf-sign-mode-tabs"
                    role="tablist"
                    aria-label={isEn ? 'Stamp input method' : 'Metode input stempel'}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={(currentItem?.stampInputType || 'generate') === 'generate'}
                      className={`pdf-sign-tab-btn ${
                        (currentItem?.stampInputType || 'generate') === 'generate'
                          ? 'is-active'
                          : ''
                      }`}
                      onClick={() => {
                        updateCurrentItem({ kind: 'stamp', sourceMode: 'stamp', stampInputType: 'generate' })
                        setIsSigFrameVisible(true)
                        setErrorMsg('')
                      }}
                    >
                      <IconSignPdf size={13} />
                      <span>{isEn ? 'Create Stamp' : 'Buat Stempel'}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={currentItem?.stampInputType === 'upload'}
                      className={`pdf-sign-tab-btn ${
                        currentItem?.stampInputType === 'upload' ? 'is-active' : ''
                      }`}
                      onClick={() => {
                        updateCurrentItem({ kind: 'stamp', sourceMode: 'stamp', stampInputType: 'upload' })
                        setIsSigFrameVisible(true)
                        setErrorMsg('')
                      }}
                    >
                      <IconUpload size={13} />
                      <span>{isEn ? 'Upload Stamp File' : 'Upload File Stempel'}</span>
                    </button>
                  </div>
                ) : (
                  <div
                    className="pdf-sign-mode-tabs"
                    role="tablist"
                    aria-label={isEn ? 'Signature input method' : 'Metode input tanda tangan'}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sigSourceMode === 'draw'}
                      className={`pdf-sign-tab-btn ${sigSourceMode === 'draw' ? 'is-active' : ''}`}
                      onClick={() => {
                        updateCurrentItem({ kind: 'ttd', sourceMode: 'draw' })
                        setErrorMsg('')
                      }}
                    >
                      <IconEdit size={13} />
                      <span>
                        {isEn ? 'Draw Signature' : 'Tanda Tangan Langsung'}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sigSourceMode === 'upload'}
                      className={`pdf-sign-tab-btn ${sigSourceMode === 'upload' ? 'is-active' : ''}`}
                      onClick={() => {
                        updateCurrentItem({ kind: 'ttd', sourceMode: 'upload' })
                        setErrorMsg('')
                      }}
                    >
                      <IconUpload size={13} />
                      <span>
                        {isEn ? 'Upload Signature File' : 'Masukkan File TTD'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {sigSourceMode === 'draw' ? (
                <div className="pdf-signature-pad-card">
                  <div className="pdf-sig-pad-toolbar">
                    <div className="pdf-sig-tool-group">
                      <span className="pdf-sig-tool-label">
                        {isEn ? 'Ink Color:' : 'Warna Tinta:'}
                      </span>
                      <div
                        className="pdf-sig-color-swatches-row"
                        role="radiogroup"
                        aria-label={isEn ? 'Select ink color' : 'Pilih warna tinta'}
                      >
                        {SIGN_PALETTE_COLORS.map((c) => {
                          const isSelected = penColor.toLowerCase() === c.hex.toLowerCase()
                          const colorName = isEn ? c.labelEn : c.labelId
                          return (
                            <button
                              key={c.hex}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              className={`pdf-sig-color-preset-btn ${isSelected ? 'is-active' : ''}`}
                              style={{ backgroundColor: c.hex }}
                              onClick={() => handlePenColorChange(c.hex)}
                              title={colorName}
                              aria-label={colorName}
                            >
                              {isSelected && <IconCheck size={11} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="pdf-sig-tool-group pdf-sig-stroke-slider-group">
                      <label className="pdf-sig-tool-label" htmlFor="sig-stroke-width-slider">
                        {isEn ? 'Thickness:' : 'Ketebalan:'}
                      </label>
                      <div className="pdf-sig-stroke-slider-wrap">
                        <input
                          id="sig-stroke-width-slider"
                          type="range"
                          min={1}
                          max={12}
                          step={0.5}
                          value={penWidth}
                          onChange={(e) => updateCurrentItem({ penWidth: Number(e.target.value) })}
                          className="pdf-compress-range-input pdf-sig-stroke-range"
                          style={{
                            '--slider-fill': `${Math.round(((penWidth - 1) / 11) * 100)}%`,
                          }}
                        />
                        <strong className="pdf-sig-val-badge">{penWidth} px</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="sample-doc-trigger-btn is-danger-subtle pdf-sig-clear-btn"
                      onClick={handleClearCanvas}
                    >
                      <IconTrash size={13} />
                      <span>{isEn ? 'Clear Pad' : 'Ulangi / Bersihkan'}</span>
                    </button>
                  </div>

                  <div className="pdf-sig-canvas-stage">
                    <canvas
                      ref={drawCanvasRef}
                      className="pdf-sig-draw-canvas"
                      onPointerDown={handleCanvasPointerDown}
                      onPointerMove={handleCanvasPointerMove}
                      onPointerUp={handleCanvasPointerUp}
                      onPointerCancel={handleCanvasPointerUp}
                      aria-label={
                        isEn
                          ? 'Signature drawing canvas'
                          : 'Area kanvas gambar tanda tangan langsung'
                      }
                    />
                    {!drawnSignature && (
                      <div className="pdf-sig-canvas-placeholder" aria-hidden="true">
                        <span>
                          {isEn
                            ? 'Draw your signature here using mouse, touchpad, or touchscreen'
                            : 'Goreskan tanda tanganmu di kotak ini menggunakan mouse, touchpad, atau layar sentuh'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : sigSourceMode === 'upload' ? (
                <div
                  className={`pdf-signature-upload-box ${isDraggingSigFile ? 'is-dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingSigFile(true)
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation()
                    setIsDraggingSigFile(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingSigFile(false)
                    const f = e.dataTransfer?.files?.[0]
                    if (f) handleUploadSignatureFile(f)
                  }}
                >
                  {!uploadedSignature ? (
                    <div
                      className="pdf-sig-dropzone-inner"
                      role="button"
                      tabIndex={0}
                      onClick={() => sigFileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          sigFileInputRef.current?.click()
                        }
                      }}
                    >
                      <div className="pdf-dropzone-icon">
                        <IconUpload size={22} />
                      </div>
                      <div className="pdf-dropzone-text">
                        <strong>
                          {isEn
                            ? 'Drop your signature image file here'
                            : 'Masukkan atau tarik file tanda tangan ke kotak ini'}
                        </strong>
                        <span>
                          {isEn
                            ? 'Supports transparent PNG, JPG, or photo of signature on paper (auto-cleans white background)'
                            : 'Mendukung PNG transparan, JPG, atau foto tanda tangan di kertas (otomatis hapus latar putih)'}
                        </span>
                      </div>
                      <span className="pdf-dropzone-pill">
                        <IconPlus size={13} />
                        <span>
                          {isEn ? 'Select Signature Image' : 'Pilih Gambar Tanda Tangan'}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="pdf-sig-uploaded-bar">
                      <div className="pdf-sig-uploaded-preview-wrap">
                        <img
                          src={uploadedSignature.dataUrl}
                          alt={isEn ? 'Uploaded signature preview' : 'Pratinjau tanda tangan'}
                          className="pdf-sig-uploaded-img"
                        />
                      </div>
                      <div className="pdf-sig-uploaded-meta">
                        <strong title={uploadedSignature.name}>
                          {truncateFileName(uploadedSignature.name, 32)}
                        </strong>
                        <span>
                          {formatFileSize(uploadedSignature.size)} • {uploadedSignature.width}x
                          {uploadedSignature.height}px
                        </span>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={removeWhiteBg}
                          className={`pdf-sig-bg-toggle ${removeWhiteBg ? 'is-checked' : ''}`}
                          onClick={handleToggleRemoveWhiteBg}
                        >
                          <span className="pct-check-box" aria-hidden="true">
                            {removeWhiteBg && <IconCheck size={11} />}
                          </span>
                          <span>
                            {isEn
                              ? 'Auto-remove white paper background'
                              : 'Hapus latar putih kertas otomatis'}
                          </span>
                        </button>
                      </div>
                      <div className="pdf-sig-uploaded-actions">
                        <button
                          type="button"
                          className="doc-action-btn"
                          onClick={() => sigFileInputRef.current?.click()}
                        >
                          <IconUpload size={13} />
                          <span>{isEn ? 'Change File' : 'Ganti File TTD'}</span>
                        </button>
                        <button
                          type="button"
                          className="doc-remove-btn"
                          onClick={() => {
                            updateCurrentItem({
                              uploadedSignature: null,
                              uploadedSigRawFile: null,
                            })
                            setSignResult(null)
                          }}
                          title={isEn ? 'Remove signature file' : 'Hapus file tanda tangan'}
                          aria-label={isEn ? 'Remove signature file' : 'Hapus file tanda tangan'}
                        >
                          <IconClose size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (currentItem?.stampInputType || 'generate') === 'generate' ? (
                <div className="pdf-signature-pad-card pdf-stamp-builder-card">
                  <div className="pdf-sig-pad-toolbar">
                    <div className="pdf-sig-tool-group">
                      <span className="pdf-sig-tool-label">
                        {isEn ? 'Shape:' : 'Bentuk:'}
                      </span>
                      <div className="pdf-sign-mode-tabs">
                        <button
                          type="button"
                          className={`pdf-sign-tab-btn ${
                            (currentItem?.stampShape || 'circle') === 'circle'
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={() => updateCurrentItem({ stampShape: 'circle' })}
                        >
                          <span>{isEn ? 'Circle' : 'Bulat'}</span>
                        </button>
                        <button
                          type="button"
                          className={`pdf-sign-tab-btn ${
                            currentItem?.stampShape === 'rounded' ? 'is-active' : ''
                          }`}
                          onClick={() => updateCurrentItem({ stampShape: 'rounded' })}
                        >
                          <span>{isEn ? 'Rectangle' : 'Kotak'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="pdf-sig-tool-group">
                      <span className="pdf-sig-tool-label">
                        {isEn ? 'Stamp Color:' : 'Warna Stempel:'}
                      </span>
                      <div
                        className="pdf-sig-color-swatches-row"
                        role="radiogroup"
                        aria-label={isEn ? 'Select stamp color' : 'Pilih warna stempel'}
                      >
                        {SIGN_PALETTE_COLORS.map((c) => {
                          const activeColor = currentItem?.stampColor || '#b91c1c'
                          const isSelected = activeColor.toLowerCase() === c.hex.toLowerCase()
                          const colorName = isEn ? c.labelEn : c.labelId
                          return (
                            <button
                              key={c.hex}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              className={`pdf-sig-color-preset-btn ${isSelected ? 'is-active' : ''}`}
                              style={{ backgroundColor: c.hex }}
                              onClick={() => {
                                updateCurrentItem({ stampColor: c.hex })
                                setSignResult(null)
                              }}
                              title={colorName}
                              aria-label={colorName}
                            >
                              {isSelected && <IconCheck size={11} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pdf-stamp-generator-body">
                      <div className="pdf-stamp-inputs-col">
                        <label className="pdf-sig-caption-field">
                          <span className="pdf-sig-tool-label">
                            {isEn ? 'Top Text:' : 'Teks Bagian Atas:'}
                          </span>
                          <input
                            type="text"
                            className="pdf-sig-caption-input"
                            value={currentItem?.stampTopText ?? ''}
                            onChange={(e) => {
                              updateCurrentItem({ stampTopText: e.target.value })
                              setSignResult(null)
                            }}
                            placeholder={isEn ? 'e.g. OFFICIAL STAMP' : 'Contoh: PT MAJU JAYA'}
                          />
                        </label>
                        <label className="pdf-sig-caption-field">
                          <span className="pdf-sig-tool-label">
                            {isEn ? 'Center Main Text:' : 'Teks Tengah Utama:'}
                          </span>
                          <input
                            type="text"
                            className="pdf-sig-caption-input"
                            value={currentItem?.stampCenterText ?? ''}
                            onChange={(e) => {
                              updateCurrentItem({ stampCenterText: e.target.value })
                              setSignResult(null)
                            }}
                            placeholder={isEn ? 'e.g. APPROVED / PAID' : 'Contoh: LUNAS / SAH'}
                          />
                        </label>
                        <label className="pdf-sig-caption-field">
                          <span className="pdf-sig-tool-label">
                            {isEn ? 'Bottom Text:' : 'Teks Bagian Bawah:'}
                          </span>
                          <input
                            type="text"
                            className="pdf-sig-caption-input"
                            value={currentItem?.stampBottomText ?? ''}
                            onChange={(e) => {
                              updateCurrentItem({ stampBottomText: e.target.value })
                              setSignResult(null)
                            }}
                            placeholder={isEn ? 'e.g. JAKARTA' : 'Contoh: INDONESIA'}
                          />
                        </label>
                      </div>

                      <div className="pdf-stamp-live-preview-box">
                        {currentItem?.stampGeneratedSignature?.dataUrl ? (
                          <img
                            src={currentItem.stampGeneratedSignature.dataUrl}
                            alt={isEn ? 'Generated stamp preview' : 'Pratinjau stempel'}
                            className="pdf-stamp-live-img"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`pdf-signature-upload-box ${isDraggingSigFile ? 'is-dragging' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDraggingSigFile(true)
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation()
                        setIsDraggingSigFile(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDraggingSigFile(false)
                        const f = e.dataTransfer?.files?.[0]
                        if (f) handleUploadStampFile(f)
                      }}
                    >
                      {!currentItem?.stampUploadedSignature ? (
                        <div
                          className="pdf-sig-dropzone-inner"
                          role="button"
                          tabIndex={0}
                          onClick={() => stampFileInputRef.current?.click()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              stampFileInputRef.current?.click()
                            }
                          }}
                        >
                          <div className="pdf-dropzone-icon">
                            <IconUpload size={22} />
                          </div>
                          <div className="pdf-dropzone-text">
                            <strong>
                              {isEn
                                ? 'Drop your stamp image file here'
                                : 'Masukkan atau tarik file gambar stempel ke kotak ini'}
                            </strong>
                            <span>
                              {isEn
                                ? 'Supports transparent PNG, JPG, or photo of stamp on paper (auto-cleans white background)'
                                : 'Mendukung PNG transparan, JPG, atau foto stempel di kertas (otomatis hapus latar putih)'}
                            </span>
                          </div>
                          <span className="pdf-dropzone-pill">
                            <IconPlus size={13} />
                            <span>
                              {isEn ? 'Select Stamp Image' : 'Pilih Gambar Stempel'}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div className="pdf-sig-uploaded-bar">
                          <div className="pdf-sig-uploaded-preview-wrap">
                            <img
                              src={currentItem.stampUploadedSignature.dataUrl}
                              alt={isEn ? 'Uploaded stamp preview' : 'Pratinjau stempel'}
                              className="pdf-sig-uploaded-img"
                            />
                          </div>
                          <div className="pdf-sig-uploaded-meta">
                            <strong title={currentItem.stampUploadedSignature.name}>
                              {truncateFileName(currentItem.stampUploadedSignature.name, 32)}
                            </strong>
                            <span>
                              {formatFileSize(currentItem.stampUploadedSignature.size)} •{' '}
                              {currentItem.stampUploadedSignature.width}x
                              {currentItem.stampUploadedSignature.height}px
                            </span>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={currentItem?.stampRemoveWhiteBg ?? true}
                              className={`pdf-sig-bg-toggle ${
                                (currentItem?.stampRemoveWhiteBg ?? true) ? 'is-checked' : ''
                              }`}
                              onClick={handleToggleStampRemoveWhiteBg}
                            >
                              <span className="pct-check-box" aria-hidden="true">
                                {(currentItem?.stampRemoveWhiteBg ?? true) && (
                                  <IconCheck size={11} />
                                )}
                              </span>
                              <span>
                                {isEn
                                  ? 'Auto-remove white paper background'
                                  : 'Hapus latar putih kertas otomatis'}
                              </span>
                            </button>
                          </div>
                          <div className="pdf-sig-uploaded-actions">
                            <button
                              type="button"
                              className="doc-action-btn"
                              onClick={() => stampFileInputRef.current?.click()}
                            >
                              <IconUpload size={13} />
                              <span>{isEn ? 'Change File' : 'Ganti Stempel'}</span>
                            </button>
                            <button
                              type="button"
                              className="doc-remove-btn"
                              onClick={() => {
                                updateCurrentItem({
                                  stampUploadedSignature: null,
                                  stampUploadedRawFile: null,
                                })
                                setSignResult(null)
                              }}
                              title={isEn ? 'Remove stamp file' : 'Hapus file stempel'}
                              aria-label={isEn ? 'Remove stamp file' : 'Hapus file stempel'}
                            >
                              <IconClose size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                )}
            </div>

            {/* 3. PENGATURAN HALAMAN TUJUAN: TOMBOL SENDIRI SEMUA HALAMAN + 2 PILIHAN (FULL MANUAL ATAU PENGULANGAN POLA HALAMAN) */}
            <div className="pdf-sign-pages-section">
              <div className="pdf-sign-pages-head">
                <div>
                  <span className="pdf-mode-label" style={{ marginBottom: '2px' }}>
                    {isEn ? 'Target Pages' : 'Halaman Tujuan'}
                  </span>
                  <small className="pdf-sign-pages-sub">
                    {isEn
                      ? 'Choose full manual per page, repeat the layout of the first few pages, or apply to all pages.'
                      : 'Pilih atur manual per halaman, ulangi pola beberapa halaman pertama, atau terapkan ke semua halaman.'}
                  </small>
                </div>

                <button
                  type="button"
                  className={`pdf-apply-all-hero-btn ${applyAllPages ? 'is-active' : ''}`}
                  onClick={() => {
                    setApplyAllPages((prev) => !prev)
                    setErrorMsg('')
                    setSignResult(null)
                  }}
                >
                  <IconCheck size={13} />
                  <span>
                    {applyAllPages
                      ? isEn
                        ? `Applied to All Pages (${pdfDocInfo.pageCount})`
                        : `Semua Halaman Aktif (${pdfDocInfo.pageCount} Hal)`
                      : isEn
                        ? `Apply to All Pages (${pdfDocInfo.pageCount} Pages)`
                        : `Lakukan ke Semua Halaman (${pdfDocInfo.pageCount} Hal)`}
                  </span>
                </button>
              </div>

              <div
                className="pdf-sign-page-modes-grid"
                role="radiogroup"
                aria-label={isEn ? 'Page layout mode' : 'Mode penempatan halaman'}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!applyAllPages && placementMode === 'manual'}
                  className={`pdf-mode-card ${
                    !applyAllPages && placementMode === 'manual' ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setApplyAllPages(false)
                    setPlacementMode('manual')
                    setErrorMsg('')
                    setSignResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>{isEn ? 'Full Manual' : 'Atur Manual'}</strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn
                      ? 'Place and adjust signatures or stamps freely on each individual page.'
                      : 'Atur posisi TTD & stempel secara penuh dan bebas di tiap halaman satu per satu.'}
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={!applyAllPages && placementMode === 'repeat'}
                  className={`pdf-mode-card ${
                    !applyAllPages && placementMode === 'repeat' ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setApplyAllPages(false)
                    setPlacementMode('repeat')
                    setErrorMsg('')
                    setSignResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>{isEn ? 'Repeat Page Pattern' : 'Pengulangan Pola Halaman'}</strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn
                      ? 'Set up the first 2 or 3 pages and automatically copy that pattern to all following pages.'
                      : 'Settingan 2 atau 3 halaman pertama otomatis dicopy berulang ke semua halaman selanjutnya.'}
                  </span>
                </button>
              </div>

              {!applyAllPages && placementMode === 'repeat' && (
                <div className="pdf-sign-subpanel">
                  <div className="pdf-interval-inputs-row">
                    <label className="pdf-inline-num-field">
                      <span>
                        {isEn ? 'Copy layout of first:' : 'Salin settingan dari:'}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={pdfDocInfo.pageCount}
                        value={repeatCyclePages}
                        onChange={(e) => {
                          const val = Math.max(
                            1,
                            Math.min(pdfDocInfo.pageCount, parseInt(e.target.value, 10) || 1)
                          )
                          setRepeatCyclePages(val)
                          setErrorMsg('')
                          setSignResult(null)
                        }}
                      />
                      <span>{isEn ? 'first page(s)' : 'halaman pertama'}</span>
                    </label>

                    <div className="pdf-sig-items-actions">
                      {[2, 3].map((presetNum) => (
                        <button
                          key={presetNum}
                          type="button"
                          className={`pdf-sign-tab-btn ${
                            safeRepeatCycle === presetNum ? 'is-active' : ''
                          }`}
                          disabled={pdfDocInfo.pageCount < presetNum && presetNum > 1}
                          onClick={() => {
                            setRepeatCyclePages(Math.min(pdfDocInfo.pageCount, presetNum))
                            setErrorMsg('')
                            setSignResult(null)
                          }}
                        >
                          <span>
                            {isEn ? `First ${presetNum} Pages` : `${presetNum} Hal Pertama`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`pdf-range-preview-hint ${
                  targetPagesList.length > 0 ? 'is-valid' : ''
                }`}
              >
                <span>
                  {applyAllPages ? (
                    activeModePlacedEntries.length === 0 ? (
                      isEn ? (
                        'All pages mode is active. Drag & drop at least 1 signature or stamp onto the document below.'
                      ) : (
                        'Mode semua halaman aktif. Tarik & lepas minimal 1 TTD atau stempel ke dokumen di bawah.'
                      )
                    ) : isEn ? (
                      <>
                        All placed items will be applied to{' '}
                        <strong>all {pdfDocInfo.pageCount} pages</strong>.
                      </>
                    ) : (
                      <>
                        Seluruh TTD &amp; stempel yang terpasang akan diterapkan ke{' '}
                        <strong>semua {pdfDocInfo.pageCount} halaman</strong>.
                      </>
                    )
                  ) : placementMode === 'repeat' ? (
                    activeModePlacedEntries.length === 0 ? (
                      isEn ? (
                        `Place signatures/stamps on pages 1${safeRepeatCycle > 1 ? ` to ${safeRepeatCycle}` : ''} to repeat across all ${pdfDocInfo.pageCount} pages.`
                      ) : (
                        `Taruh TTD/stempel pada halaman 1${safeRepeatCycle > 1 ? ` s/d ${safeRepeatCycle}` : ''} untuk diulang ke seluruh ${pdfDocInfo.pageCount} halaman.`
                      )
                    ) : (
                      <>
                        {isEn ? 'Pattern active' : 'Pola aktif'} ({safeRepeatCycle}{' '}
                        {isEn ? 'template pages' : 'halaman pola'}):{' '}
                        {Array.from({ length: safeRepeatCycle }, (_, i) => i + 1)
                          .map((tplPage) => {
                            const matched = allDocPages.filter(
                              (p) => ((p - 1) % safeRepeatCycle) + 1 === tplPage
                            )
                            return `${isEn ? 'P' : 'Hal.'}${tplPage} → ${matched.slice(0, 6).join(', ')}${matched.length > 6 ? '...' : ''}`
                          })
                          .join(' • ')}
                      </>
                    )
                  ) : validPlacedEntries.length === 0 ? (
                    isEn ? (
                      'Document is still empty. Drag & drop a signature or stamp from the left list onto the document below.'
                    ) : (
                      'Dokumen masih kosong. Tarik & lepas TTD atau stempel dari daftar sebelah kiri ke lembar dokumen di bawah.'
                    )
                  ) : isEn ? (
                    <>
                      Signatures will be applied to{' '}
                      <strong>
                        {targetPagesList.length} of {pdfDocInfo.pageCount} pages
                      </strong>{' '}
                      (Pages: {targetPagesList.slice(0, 18).join(', ')}
                      {targetPagesList.length > 18 ? '...' : ''}).
                    </>
                  ) : (
                    <>
                      TTD &amp; stempel akan diterapkan pada{' '}
                      <strong>
                        {targetPagesList.length} dari {pdfDocInfo.pageCount} halaman
                      </strong>{' '}
                      (Halaman: {targetPagesList.slice(0, 18).join(', ')}
                      {targetPagesList.length > 18 ? '...' : ''}).
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* 4. PRATINJAU BAWAH: KIRI = DAFTAR TTD & STEMPEL DRAG-DROP, KANAN = DOKUMEN PREVIEW (AWALNYA KOSONG) */}
            <div className="pdf-sign-preview-section">
              <div className="pdf-sign-preview-workspace">
                <aside className="pdf-preview-palette-col">
                  <div className="pdf-palette-head">
                    <span className="pdf-mode-label" style={{ marginBottom: '2px' }}>
                      {isEn ? 'Signatures & Stamps' : 'Daftar TTD & Stempel'}
                    </span>
                    <small className="pdf-palette-sub">
                      {isEn
                        ? 'Drag & drop onto document'
                        : 'Tarik ke lembar dokumen'}
                    </small>
                  </div>

                  {filledItemsWithAssets.length === 0 ? (
                    <div className="pdf-palette-empty-box">
                      <span>
                        {isEn
                          ? 'Draw or upload a signature or create a stamp above so it appears here.'
                          : 'Buat atau unggah TTD maupun stempel di kotak atas agar muncul di sini.'}
                      </span>
                    </div>
                  ) : (
                    <div className="pdf-palette-cards-list">
                      {filledItemsWithAssets.map(({ item, idx, asset }) => {
                        const isStampSlot =
                          item.sourceMode === 'stamp' || item.kind === 'stamp'
                        const label = isStampSlot
                          ? `${isEn ? 'Stamp' : 'Stempel'} #${idx + 1}`
                          : `TTD #${idx + 1}`
                        const countOnDoc = validPlacedEntries.filter(
                          (e) => e.placement.sourceItemId === item.id
                        ).length
                        return (
                          <div
                            key={item.id}
                            className={`pdf-palette-drag-card ${
                              draggedPaletteItemId === item.id ? 'is-dragging' : ''
                            }`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', item.id)
                              e.dataTransfer.effectAllowed = 'copy'
                              setDraggedPaletteItemId(item.id)
                            }}
                            onDragEnd={() => {
                              setDraggedPaletteItemId('')
                              setIsDropTargetActive(false)
                            }}
                          >
                            <div className="pdf-palette-thumb-box">
                              <img src={asset.dataUrl} alt={label} draggable={false} />
                            </div>
                            <div className="pdf-palette-card-footer">
                              <div className="pdf-palette-card-meta">
                                <strong>{label}</strong>
                                {countOnDoc > 0 && (
                                  <span className="pdf-palette-placed-badge">
                                    {countOnDoc}x
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="pdf-palette-quick-place-btn"
                                onClick={() => placeItemOnDocument(item.id)}
                                title={
                                  isEn
                                    ? `Place ${label} on Page ${previewPageNum}`
                                    : `Taruh ${label} ke Halaman ${previewPageNum}`
                                }
                              >
                                <IconPlus size={11} />
                                <span>{isEn ? 'Place' : 'Taruh'}</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </aside>

                <div className="pdf-sign-preview-col is-expanded-preview">
                  <div className="pdf-sign-preview-topbar">
                    <div className="pdf-preview-topbar-left">
                      <span className="pdf-mode-label" style={{ marginBottom: 0 }}>
                        {isEn ? 'Document Preview' : 'Pratinjau Dokumen'}
                      </span>
                      <span
                        className={`pdf-sheet-status-pill ${
                          visiblePlacements.length > 0 ? 'is-signed' : 'is-skipped'
                        }`}
                      >
                        {visiblePlacements.length > 0
                          ? !applyAllPages &&
                            placementMode === 'repeat' &&
                            previewPageNum > safeRepeatCycle
                            ? isEn
                              ? `Copied from Page ${effectivePreviewTemplatePage} (${visiblePlacements.length})`
                              : `Salinan Pola Hal. ${effectivePreviewTemplatePage} (${visiblePlacements.length})`
                            : isEn
                              ? `${visiblePlacements.length} Item(s) Placed`
                              : `${visiblePlacements.length} Item Terpasang`
                          : isEn
                            ? 'Empty Page'
                            : 'Halaman Kosong'}
                      </span>
                    </div>

                    <div className="pdf-preview-pager">
                      <button
                        type="button"
                        className="pdf-pager-btn"
                        disabled={previewPageNum <= 1}
                        onClick={() => setPreviewPageNum((p) => Math.max(1, p - 1))}
                      >
                        &larr;
                      </button>
                      <span>
                        {isEn
                          ? `Page ${previewPageNum} / ${pdfDocInfo.pageCount}`
                          : `Hal. ${previewPageNum} / ${pdfDocInfo.pageCount}`}
                      </span>
                      <button
                        type="button"
                        className="pdf-pager-btn"
                        disabled={previewPageNum >= pdfDocInfo.pageCount}
                        onClick={() =>
                          setPreviewPageNum((p) => Math.min(pdfDocInfo.pageCount, p + 1))
                        }
                      >
                        &rarr;
                      </button>
                    </div>
                  </div>

                  <div className="pdf-page-sheet-stage is-large-stage">
                    <div
                      ref={pageSheetRef}
                      className={`pdf-page-sheet is-large-sheet ${
                        visiblePlacements.length > 0 ? 'is-interactive' : ''
                      } ${isDropTargetActive ? 'is-drop-target' : ''}`}
                      style={{
                        aspectRatio: `${pageAspectRatio}`,
                      }}
                      tabIndex={0}
                      role="application"
                      aria-label={
                        isEn
                          ? `Page ${previewPageNum} document preview. Drag and drop signatures or stamps from the left panel onto this document.`
                          : `Pratinjau dokumen halaman ${previewPageNum}. Tarik dan lepas tanda tangan atau stempel dari daftar kiri ke dokumen ini.`
                      }
                      onDragOver={handleSheetDragOver}
                      onDragLeave={handleSheetDragLeave}
                      onDrop={handleSheetDrop}
                      onPointerDown={handleSheetPointerDown}
                      onPointerMove={handleSheetPointerMove}
                      onPointerUp={handleSheetPointerUp}
                      onPointerCancel={handleSheetPointerUp}
                      onFocus={handleSheetFocus}
                      onKeyDown={handleSheetKeyDown}
                    >
                      {pagePreviewUrl && (
                        <img
                          src={pagePreviewUrl}
                          alt={
                            isEn
                              ? `Document page ${previewPageNum} preview`
                              : `Pratinjau halaman ${previewPageNum} dokumen PDF`
                          }
                          className="pdf-sheet-rendered-page-img"
                          draggable={false}
                        />
                      )}

                      {singlePagePdfUrl && (
                        <iframe
                          key={singlePagePdfUrl}
                          src={`${singlePagePdfUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=Fit`}
                          title={
                            isEn
                              ? `Document page ${previewPageNum}`
                              : `Dokumen halaman ${previewPageNum}`
                          }
                          className="pdf-sheet-native-iframe"
                          tabIndex={-1}
                        />
                      )}

                      {!pagePreviewUrl && !singlePagePdfUrl && (
                        <div className="pdf-sheet-loading-preview" aria-hidden="true">
                          <span>
                            {isRenderingPreview
                              ? isEn
                                ? 'Rendering document page...'
                                : 'Memuat tampilan halaman dokumen...'
                              : truncateFileName(pdfDocInfo.name, 28)}
                          </span>
                        </div>
                      )}

                      {/* Lapisan tangkap pointer transparan di atas dokumen agar drag posisi dan pojok ukuran lancar */}
                      <div className="pdf-sheet-hit-overlay" aria-hidden="true" />

                      {isDropTargetActive && (
                        <div className="pdf-sheet-drop-banner" aria-hidden="true">
                          <span>
                            {isEn ? 'Drop here to place on document' : 'Lepas di sini untuk menempelkan'}
                          </span>
                        </div>
                      )}

                      {visiblePlacements.map(({ placement, entry }) => {
                        const isSelectedStamp =
                          isSigFrameVisible && activePlacement?.uid === placement.uid
                        const isStampSlot =
                          entry.item.sourceMode === 'stamp' || entry.item.kind === 'stamp'
                        const badgeTag = isStampSlot
                          ? `${isEn ? 'Stamp' : 'Stempel'} #${entry.idx + 1} • ${placement.scalePercent}%`
                          : `TTD #${entry.idx + 1} • ${placement.scalePercent}%`
                        return (
                          <div
                            key={placement.uid}
                            className={`pdf-sheet-sig-stamp ${
                              isSelectedStamp ? 'is-selected' : 'is-quiet'
                            }`}
                            style={{
                              width: `${placement.scalePercent}%`,
                              left: `${placement.xPercent}%`,
                              top: `${placement.yPercent}%`,
                              zIndex: isSelectedStamp ? 6 : 4,
                            }}
                            onPointerDown={(e) => handleStampPointerDown(e, placement)}
                          >
                            <span
                              className="pdf-sig-corner-handle is-nw"
                              onPointerDown={(e) => handleCornerResizePointerDown(e, placement)}
                              title={
                                isEn
                                  ? 'Drag corner to resize'
                                  : 'Tarik pojok untuk memperbesar / memperkecil'
                              }
                            />
                            <span
                              className="pdf-sig-corner-handle is-ne"
                              onPointerDown={(e) => handleCornerResizePointerDown(e, placement)}
                              title={
                                isEn
                                  ? 'Drag corner to resize'
                                  : 'Tarik pojok untuk memperbesar / memperkecil'
                              }
                            />
                            <span
                              className="pdf-sig-corner-handle is-sw"
                              onPointerDown={(e) => handleCornerResizePointerDown(e, placement)}
                              title={
                                isEn
                                  ? 'Drag corner to resize'
                                  : 'Tarik pojok untuk memperbesar / memperkecil'
                              }
                            />
                            <span
                              className="pdf-sig-corner-handle is-se"
                              onPointerDown={(e) => handleCornerResizePointerDown(e, placement)}
                              title={
                                isEn
                                  ? 'Drag corner to resize'
                                  : 'Tarik pojok untuk memperbesar / memperkecil'
                              }
                            />

                            <button
                              type="button"
                              className="pdf-sig-stamp-remove-mini"
                              onPointerDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleRemovePlacement(placement.uid)
                              }}
                              title={isEn ? 'Remove from document' : 'Hapus dari dokumen'}
                              aria-label={isEn ? 'Remove from document' : 'Hapus dari dokumen'}
                            >
                              <IconClose size={12} />
                            </button>

                            <span className="pdf-sig-scale-pill">{badgeTag}</span>

                            <div
                              className="pdf-sheet-sig-inner"
                              style={{ opacity: placement.opacityPercent / 100 }}
                            >
                              <img
                                src={entry.asset.dataUrl}
                                alt={badgeTag}
                                draggable={false}
                              />
                              {placement.signerName.trim() && (
                                <strong className="pdf-sheet-sig-name">
                                  {placement.signerName.trim()}
                                </strong>
                              )}
                              {placement.includeDate && (
                                <small className="pdf-sheet-sig-date">{todayFormatted}</small>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* PENGATURAN OPASITAS & NAMA TERANG DI BAWAH PREVIEW */}
              <div className="pdf-sign-below-preview-grid">
                <div className="pdf-sign-setting-block">
                  <div className="pdf-slider-head">
                    <label className="pdf-sig-tool-label" htmlFor="sig-opacity-slider">
                      {isEn ? 'Ink / Stamp Opacity:' : 'Opasitas TTD / Stempel:'}
                    </label>
                    <strong className="pdf-sig-val-badge">{opacityPercent}%</strong>
                  </div>
                  <input
                    id="sig-opacity-slider"
                    type="range"
                    min={35}
                    max={100}
                    step={5}
                    value={opacityPercent}
                    onChange={(e) => {
                      updateActiveAppearanceControl({ opacityPercent: Number(e.target.value) })
                      setSignResult(null)
                    }}
                    className="pdf-compress-range-input"
                    style={{
                      '--slider-fill': `${Math.round(((opacityPercent - 35) / 65) * 100)}%`,
                    }}
                  />
                </div>

                <div className="pdf-sign-setting-block">
                  <label className="pdf-sig-caption-field">
                    <span className="pdf-sig-tool-label">
                      {isEn
                        ? 'Signer Name / Title Below Item (Optional):'
                        : 'Nama Terang / Jabatan di Bawah TTD (Opsional):'}
                    </span>
                    <input
                      type="text"
                      className="pdf-sig-caption-input"
                      placeholder={
                        isEn
                          ? 'Type name or role below signature (optional)...'
                          : 'Ketik nama terang atau jabatan (opsional)...'
                      }
                      value={signerName}
                      onChange={(e) => {
                        updateActiveAppearanceControl({ signerName: e.target.value })
                        setSignResult(null)
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={includeDate}
                    className={`pdf-sig-bg-toggle ${includeDate ? 'is-checked' : ''}`}
                    style={{ marginTop: '8px' }}
                    onClick={() => {
                      updateActiveAppearanceControl((it) => ({ includeDate: !it.includeDate }))
                      setSignResult(null)
                    }}
                  >
                    <span className="pct-check-box" aria-hidden="true">
                      {includeDate && <IconCheck size={11} />}
                    </span>
                    <span>
                      {isEn
                        ? `Include date stamp (${todayFormatted})`
                        : `Cantumkan tanggal di bawah TTD (${todayFormatted})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* BARIS AKSI UTAMA */}
            <div className="pdf-action-bar" style={{ marginTop: '18px' }}>
              <div className="pdf-action-summary">
                <span className="pdf-privacy-badge">
                  <IconShield size={14} />
                  <span>
                    {isEn
                      ? '100% Local in Browser • Privacy Protected'
                      : '100% Lokal di Browser • Privasi Terjaga'}
                  </span>
                </span>
              </div>

              <button
                type="submit"
                className="clean-submit-btn pdf-submit-btn"
                disabled={
                  isBusy ||
                  activeModePlacedEntries.length === 0 ||
                  targetPagesList.length === 0
                }
              >
                <span>
                  {isSigning
                    ? isEn
                      ? 'Signing PDF...'
                      : 'Menandatangani PDF...'
                    : isEn
                      ? `Sign PDF (${targetPagesList.length} Pages)`
                      : `Tanda Tangani PDF (${targetPagesList.length} Hal)`}
                </span>
                <span className="submit-arrow-circle">
                  <IconArrowUpRight size={16} />
                </span>
              </button>
            </div>
          </form>
        )}

        {errorMsg && (
          <div className="clean-error-banner" role="alert">
            {errorMsg}
          </div>
        )}

        {isBusy && (
          <div className="clean-loading-bar" role="status">
            <div className="clean-loader-pulse" />
            <span>
              {processStep ||
                (isEn ? 'Processing signed PDF document...' : 'Memproses tanda tangan PDF...')}
            </span>
          </div>
        )}

        {/* PANEL HASIL TANDA TANGAN PDF */}
        {signResult && !isBusy && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>
                    {isEn ? 'Signed & Auto-Downloaded' : 'Selesai Ditandatangani & Diunduh'}
                  </span>
                </span>
                <span className="clean-result-info">
                  <strong>
                    {signResult.signedPageCount} / {signResult.totalPages}{' '}
                    {isEn ? 'pages signed' : 'halaman ditandatangani'}
                  </strong>{' '}
                  • {formatFileSize(signResult.size)} • {signResult.timestamp}
                </span>
              </div>

              <div className="clean-result-controls">
                <button
                  type="button"
                  className="clean-action-btn primary"
                  onClick={() =>
                    triggerBrowserDownload(
                      signResult.pdfBytes,
                      signResult.fileName,
                      'application/pdf'
                    )
                  }
                >
                  <IconDownload size={14} />
                  <span>{isEn ? 'Download Signed PDF' : 'Unduh Ulang PDF Tertandatangani'}</span>
                </button>
                <button
                  type="button"
                  className="clean-close-result"
                  onClick={() => setSignResult(null)}
                  title={isEn ? 'Close' : 'Tutup'}
                  aria-label={isEn ? 'Close' : 'Tutup'}
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>

            <p className="clean-result-summary">
              {isEn ? (
                <>
                  Document <strong>{signResult.fileName}</strong> has been signed on{' '}
                  <strong>{signResult.signedPageCount} pages</strong> (Pages:{' '}
                  {signResult.signedPages.slice(0, 15).join(', ')}
                  {signResult.signedPages.length > 15 ? '...' : ''}) and downloaded to your device.
                </>
              ) : (
                <>
                  Dokumen <strong>{signResult.fileName}</strong> berhasil ditandatangani pada{' '}
                  <strong>{signResult.signedPageCount} halaman</strong> (Halaman:{' '}
                  {signResult.signedPages.slice(0, 15).join(', ')}
                  {signResult.signedPages.length > 15 ? '...' : ''}) dan telah diunduh ke
                  perangkatmu.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
