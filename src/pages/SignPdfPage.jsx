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
  resolveTargetSignaturePages,
  signPdfDocument,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'
import { useLanguage } from '../i18n/LanguageContext'

export default function SignPdfPage() {
  const { lang } = useLanguage()
  const isEn = lang === 'en'

  const [pdfDocInfo, setPdfDocInfo] = useState(null)
  const [isDraggingPdf, setIsDraggingPdf] = useState(false)
  const [isDraggingSigFile, setIsDraggingSigFile] = useState(false)

  // Mode tanda tangan: 'draw' (tanda tangan langsung) | 'upload' (masukkan file tanda tangan di kotak berbeda)
  const [sigSourceMode, setSigSourceMode] = useState('draw')
  const [penColor, setPenColor] = useState('#141112')
  const [penWidth, setPenWidth] = useState(3.5)
  const [drawnSignature, setDrawnSignature] = useState(null)

  const [uploadedSigRawFile, setUploadedSigRawFile] = useState(null)
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true)
  const [uploadedSignature, setUploadedSignature] = useState(null)

  // Pengaturan halaman tujuan: 'all' (tombol semua halaman) | 'first' (halaman pertama) | 'interval' (kelipatan halaman)
  const [pageMode, setPageMode] = useState('first')
  const [intervalStep, setIntervalStep] = useState(2)
  const [intervalStart, setIntervalStart] = useState(1)

  // Pengaturan posisi, ukuran (drag pojok langsung), opasitas, dan label bawah TTD
  const [posXPercent, setPosXPercent] = useState(76)
  const [posYPercent, setPosYPercent] = useState(80)
  const [scalePercent, setScalePercent] = useState(22)
  const [opacityPercent, setOpacityPercent] = useState(100)
  const [signerName, setSignerName] = useState('')
  const [includeDate, setIncludeDate] = useState(false)
  const [previewPageNum, setPreviewPageNum] = useState(1)
  const [pagePreviewUrl, setPagePreviewUrl] = useState('')
  const [singlePagePdfUrl, setSinglePagePdfUrl] = useState('')
  const [isRenderingPreview, setIsRenderingPreview] = useState(false)

  // Mode interaksi pada lembar dokumen: null | 'move' | 'resize'
  const [sheetDragMode, setSheetDragMode] = useState(null)

  const [isInspecting, setIsInspecting] = useState(false)
  const [isProcessingSig, setIsProcessingSig] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [signResult, setSignResult] = useState(null)

  const pdfFileInputRef = useRef(null)
  const sigFileInputRef = useRef(null)
  const drawCanvasRef = useRef(null)
  const isDrawingStrokeRef = useRef(false)
  const lastPointRef = useRef({ x: 0, y: 0 })
  const pageSheetRef = useRef(null)
  const pagePreviewCacheRef = useRef(new Map())
  const activeBlobUrlRef = useRef('')
  const resultRef = useRef(null)

  const activeSignature = sigSourceMode === 'draw' ? drawnSignature : uploadedSignature

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
      canvas.width = targetW
      canvas.height = targetH
    }
  }, [])

  useEffect(() => {
    if (pdfDocInfo && sigSourceMode === 'draw') {
      initDrawCanvas()
    }
  }, [pdfDocInfo, sigSourceMode, initDrawCanvas])

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
    if (!canvas) return
    try {
      const exported = await exportCanvasSignature(canvas)
      if (exported.isEmpty) {
        setDrawnSignature(null)
      } else {
        setDrawnSignature(exported)
        setSignResult(null)
      }
    } catch {
      // Abaikan jika kanvas belum siap diekspor
    }
  }

  const handlePenColorChange = async (e) => {
    const nextColor = e.target.value
    setPenColor(nextColor)
    if (drawCanvasRef.current && drawnSignature) {
      recolorCanvasStrokes(drawCanvasRef.current, nextColor)
      await syncDrawnCanvasToState()
    }
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
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width || 460)
    const pt = getCanvasPoint(e)
    isDrawingStrokeRef.current = true
    lastPointRef.current = pt

    ctx.strokeStyle = penColor
    ctx.fillStyle = penColor
    ctx.lineWidth = penWidth * dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.arc(pt.x, pt.y, (penWidth * dpr) / 2.2, 0, Math.PI * 2)
    ctx.fill()
    setErrorMsg('')
  }

  const handleCanvasPointerMove = (e) => {
    if (!isDrawingStrokeRef.current) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width || 460)
    const pt = getCanvasPoint(e)
    const prev = lastPointRef.current

    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth * dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()

    lastPointRef.current = pt
  }

  const handleCanvasPointerUp = async (e) => {
    if (!isDrawingStrokeRef.current) return
    isDrawingStrokeRef.current = false
    const canvas = drawCanvasRef.current
    if (canvas && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        // Abaikan jika pointer capture sudah dilepas
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
    setDrawnSignature(null)
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
      setSignResult(null)
      setPageMode('first')
      setIntervalStep(2)
      setIntervalStart(1)
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
    setSignResult(null)
    setErrorMsg('')
    setPreviewPageNum(1)
  }

  const handleUploadSignatureFile = async (file, customRemoveWhite = removeWhiteBg) => {
    if (!file) return
    setErrorMsg('')
    setIsProcessingSig(true)
    try {
      const processed = await processSignatureImageFile(file, {
        removeWhiteBg: customRemoveWhite,
      })
      setUploadedSigRawFile(file)
      setUploadedSignature(processed)
      setSigSourceMode('upload')
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
    setRemoveWhiteBg(nextVal)
    if (uploadedSigRawFile) {
      await handleUploadSignatureFile(uploadedSigRawFile, nextVal)
    }
  }

  const updateSheetPositionFromPointer = (clientX, clientY) => {
    const sheet = pageSheetRef.current
    if (!sheet) return
    const rect = sheet.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const rawX = ((clientX - rect.left) / rect.width) * 100
    const rawY = ((clientY - rect.top) / rect.height) * 100
    setPosXPercent(Math.round(Math.max(8, Math.min(92, rawX))))
    setPosYPercent(Math.round(Math.max(8, Math.min(92, rawY))))
    setSignResult(null)
  }

  const updateSignatureScaleFromCornerPointer = (clientX, clientY) => {
    const sheet = pageSheetRef.current
    if (!sheet) return
    const rect = sheet.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const centerX = rect.left + (posXPercent / 100) * rect.width
    const centerY = rect.top + (posYPercent / 100) * rect.height
    const sigAspect = activeSignature?.aspectRatio || 2.2

    const distXPercent = (Math.abs(clientX - centerX) / rect.width) * 200
    const distYPercent = ((Math.abs(clientY - centerY) * sigAspect) / rect.width) * 200
    const nextScale = Math.max(distXPercent, distYPercent)

    setScalePercent(Math.round(Math.max(8, Math.min(55, nextScale))))
    setSignResult(null)
  }

  const handleSheetPointerDown = (e) => {
    if (!activeSignature) return
    e.preventDefault()
    const sheet = pageSheetRef.current
    if (sheet && sheet.setPointerCapture) {
      try {
        sheet.setPointerCapture(e.pointerId)
      } catch {
        // Abaikan jika perangkat tidak mendukung pointer capture
      }
    }
    setSheetDragMode('move')
    updateSheetPositionFromPointer(e.clientX, e.clientY)
  }

  const handleCornerResizePointerDown = (e) => {
    if (!activeSignature) return
    e.preventDefault()
    e.stopPropagation()
    const sheet = pageSheetRef.current
    if (sheet && sheet.setPointerCapture) {
      try {
        sheet.setPointerCapture(e.pointerId)
      } catch {
        // Abaikan jika perangkat tidak mendukung pointer capture
      }
    }
    setSheetDragMode('resize')
    updateSignatureScaleFromCornerPointer(e.clientX, e.clientY)
  }

  const handleSheetPointerMove = (e) => {
    if (!sheetDragMode) return
    e.preventDefault()
    if (sheetDragMode === 'resize') {
      updateSignatureScaleFromCornerPointer(e.clientX, e.clientY)
    } else {
      updateSheetPositionFromPointer(e.clientX, e.clientY)
    }
  }

  const handleSheetPointerUp = (e) => {
    if (!sheetDragMode) return
    setSheetDragMode(null)
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
    const step = e.shiftKey ? 5 : 2
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPosXPercent((prev) => Math.max(8, prev - step))
      setSignResult(null)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPosXPercent((prev) => Math.min(92, prev + step))
      setSignResult(null)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPosYPercent((prev) => Math.max(8, prev - step))
      setSignResult(null)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPosYPercent((prev) => Math.min(92, prev + step))
      setSignResult(null)
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      setScalePercent((prev) => Math.min(55, prev + 2))
      setSignResult(null)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      setScalePercent((prev) => Math.max(8, prev - 2))
      setSignResult(null)
    }
  }

  const handleApplyToAllPagesQuick = () => {
    setPageMode('all')
    setErrorMsg('')
    setSignResult(null)
  }

  const targetPagesInfo = pdfDocInfo
    ? resolveTargetSignaturePages({
        pageMode,
        pageCount: pdfDocInfo.pageCount,
        intervalStep,
        intervalStart,
      })
    : { pages: [], error: null }

  const handleSignPdfNow = async (e) => {
    if (e) e.preventDefault()
    if (!pdfDocInfo?.file) {
      setErrorMsg(
        isEn ? 'Please upload a PDF file first.' : 'Unggah berkas PDF terlebih dahulu.'
      )
      return
    }

    if (!activeSignature?.pngBytes) {
      setErrorMsg(
        sigSourceMode === 'draw'
          ? isEn
            ? 'Please draw your signature in the signature pad first, or switch to the Upload Signature File box.'
            : 'Gambar tanda tanganmu di kotak tanda tangan terlebih dahulu, atau pilih kotak Masukkan File Tanda Tangan.'
          : isEn
            ? 'Please upload your signature image file (PNG, JPG, or WEBP) first.'
            : 'Masukkan file gambar tanda tangan (PNG, JPG, atau WEBP) di kotak unggah terlebih dahulu.'
      )
      return
    }

    if (targetPagesInfo.error || targetPagesInfo.pages.length === 0) {
      setErrorMsg(
        targetPagesInfo.error ||
          (isEn
            ? 'Select at least 1 target page to apply the signature.'
            : 'Pilih minimal 1 halaman tujuan untuk menerapkan tanda tangan.')
      )
      return
    }

    setErrorMsg('')
    setIsSigning(true)
    setProcessStep(
      isEn
        ? 'Embedding signature onto PDF pages directly in your browser...'
        : 'Menempelkan tanda tangan ke halaman PDF langsung di browsermu...'
    )

    try {
      const res = await signPdfDocument(
        {
          file: pdfDocInfo.file,
          signaturePngBytes: activeSignature.pngBytes,
          pages: targetPagesInfo.pages,
          xPercent: posXPercent,
          yPercent: posYPercent,
          scalePercent,
          opacityPercent,
          signerName,
          signDateText: includeDate ? todayFormatted : '',
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
  const isCurrentPreviewPageSigned = targetPagesInfo.pages.includes(previewPageNum)

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

            {/* 2. KOTAK TANDA TANGAN TERPISAH: BISA TANDA TANGAN LANGSUNG ATAU UNGGAH FILE TTD */}
            <div className="pdf-sign-source-section">
              <div className="pdf-sign-section-head">
                <span className="pdf-mode-label">
                  {isEn
                    ? 'Create or Upload Signature'
                    : 'Masukkan Tanda Tangan'}
                </span>
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
                      setSigSourceMode('draw')
                      setErrorMsg('')
                    }}
                  >
                    <IconEdit size={13} />
                    <span>
                      {isEn ? 'Sign Directly (Draw)' : 'Tanda Tangan Langsung'}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sigSourceMode === 'upload'}
                    className={`pdf-sign-tab-btn ${sigSourceMode === 'upload' ? 'is-active' : ''}`}
                    onClick={() => {
                      setSigSourceMode('upload')
                      setErrorMsg('')
                    }}
                  >
                    <IconUpload size={13} />
                    <span>
                      {isEn ? 'Upload Signature File' : 'Masukkan File Tanda Tangan'}
                    </span>
                  </button>
                </div>
              </div>

              {sigSourceMode === 'draw' ? (
                <div className="pdf-signature-pad-card">
                  <div className="pdf-sig-pad-toolbar">
                    <div className="pdf-sig-tool-group">
                      <label className="pdf-sig-tool-label" htmlFor="sig-free-color-picker">
                        {isEn ? 'Ink Color:' : 'Warna Tinta:'}
                      </label>
                      <label
                        className="pdf-sig-color-picker-wrap"
                        title={
                          isEn
                            ? 'Click to choose any custom ink color'
                            : 'Klik untuk memilih warna tinta bebas'
                        }
                      >
                        <input
                          id="sig-free-color-picker"
                          type="color"
                          value={penColor}
                          onChange={handlePenColorChange}
                          className="pdf-sig-color-native-input"
                          aria-label={isEn ? 'Custom ink color' : 'Kustomisasi warna tinta bebas'}
                        />
                        <span
                          className="pdf-sig-color-swatch"
                          style={{ backgroundColor: penColor }}
                          aria-hidden="true"
                        />
                        <span className="pdf-sig-color-hex">{penColor.toUpperCase()}</span>
                      </label>
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
                          onChange={(e) => setPenWidth(Number(e.target.value))}
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
                            setUploadedSignature(null)
                            setUploadedSigRawFile(null)
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
              )}
            </div>

            {/* 3. PENGATURAN HALAMAN TUJUAN: HALAMAN PERTAMA, KELIPATAN HALAMAN, ATAU TOMBOL SEMUA HALAMAN */}
            <div className="pdf-sign-pages-section">
              <div className="pdf-sign-pages-head">
                <div>
                  <span className="pdf-mode-label" style={{ marginBottom: '2px' }}>
                    {isEn
                      ? 'Target Pages'
                      : 'Atur Halaman Tujuan'}
                  </span>
                  <small className="pdf-sign-pages-sub">
                    {isEn
                      ? 'Sign the first page, repeat by page intervals, or click the button to apply to all pages.'
                      : 'Pilih halaman pertama, atur kelipatan halaman, atau klik tombol lakukan ke semua halaman.'}
                  </small>
                </div>

                <button
                  type="button"
                  className={`pdf-apply-all-hero-btn ${pageMode === 'all' ? 'is-active' : ''}`}
                  onClick={handleApplyToAllPagesQuick}
                >
                  <IconCheck size={13} />
                  <span>
                    {isEn
                      ? `Apply to All Pages (${pdfDocInfo.pageCount} Pages)`
                      : `Lakukan ke Semua Halaman (${pdfDocInfo.pageCount} Hal)`}
                  </span>
                </button>
              </div>

              <div
                className="pdf-sign-page-modes-grid"
                role="radiogroup"
                aria-label={isEn ? 'Page application mode' : 'Mode penerapan halaman'}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={pageMode === 'first'}
                  className={`pdf-mode-card ${pageMode === 'first' ? 'is-active' : ''}`}
                  onClick={() => {
                    setPageMode('first')
                    setPreviewPageNum(1)
                    setSignResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>
                      {isEn ? 'First Page Only' : 'Halaman Pertama'}
                    </strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn
                      ? 'Place the signature only on the first page (Page 1) of the PDF document.'
                      : 'Tetapkan tanda tangan hanya pada halaman pertama (Halaman 1) dokumen PDF.'}
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={pageMode === 'interval'}
                  className={`pdf-mode-card ${pageMode === 'interval' ? 'is-active' : ''}`}
                  onClick={() => {
                    setPageMode('interval')
                    setSignResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>
                      {isEn ? 'Page Multiples (Interval)' : 'Kelipatan Halaman'}
                    </strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn
                      ? 'Apply periodically by page multiples, such as every 1 page, every 2 pages, or custom step.'
                      : 'Terapkan berulang mengikuti kelipatan halaman, seperti per 1 halaman, per 2 halaman, dan seterusnya.'}
                  </span>
                </button>
              </div>

              {pageMode === 'interval' && (
                <div className="pdf-sign-subpanel">
                  <div className="pdf-interval-inputs-row">
                    <label className="pdf-inline-num-field">
                      <span>{isEn ? 'Repeat every:' : 'Ulangi setiap:'}</span>
                      <input
                        type="number"
                        min={1}
                        max={pdfDocInfo.pageCount}
                        value={intervalStep}
                        onChange={(e) => {
                          setIntervalStep(Math.max(1, parseInt(e.target.value, 10) || 1))
                          setSignResult(null)
                        }}
                      />
                      <span>{isEn ? 'page(s)' : 'halaman'}</span>
                    </label>

                    <label className="pdf-inline-num-field">
                      <span>{isEn ? 'Starting from page:' : 'Mulai dari halaman:'}</span>
                      <input
                        type="number"
                        min={1}
                        max={pdfDocInfo.pageCount}
                        value={intervalStart}
                        onChange={(e) => {
                          setIntervalStart(
                            Math.max(
                              1,
                              Math.min(pdfDocInfo.pageCount, parseInt(e.target.value, 10) || 1)
                            )
                          )
                          setSignResult(null)
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div
                className={`pdf-range-preview-hint ${
                  targetPagesInfo.error ? 'is-invalid' : 'is-valid'
                }`}
              >
                {targetPagesInfo.error ? (
                  <span>{targetPagesInfo.error}</span>
                ) : (
                  <span>
                    {isEn ? (
                      <>
                        Signature will be applied to{' '}
                        <strong>
                          {targetPagesInfo.pages.length} of {pdfDocInfo.pageCount} pages
                        </strong>{' '}
                        (Pages: {targetPagesInfo.pages.slice(0, 18).join(', ')}
                        {targetPagesInfo.pages.length > 18 ? '...' : ''}).
                      </>
                    ) : (
                      <>
                        Tanda tangan akan diterapkan pada{' '}
                        <strong>
                          {targetPagesInfo.pages.length} dari {pdfDocInfo.pageCount} halaman
                        </strong>{' '}
                        (Halaman: {targetPagesInfo.pages.slice(0, 18).join(', ')}
                        {targetPagesInfo.pages.length > 18 ? '...' : ''}).
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* 4. PRATINJAU DOKUMEN BESAR (GESER & TARIK POJOK UNTUK UKURAN) + OPASITAS & NAMA TERANG DI BAWAH */}
            <div className="pdf-sign-preview-section">
              <div className="pdf-sign-preview-col is-expanded-preview">
                <div className="pdf-sign-preview-topbar">
                  <div className="pdf-preview-topbar-left">
                    <span className="pdf-mode-label" style={{ marginBottom: 0 }}>
                      {isEn
                        ? 'Signature Position & Appearance Preview'
                        : 'Pengaturan Posisi & Tampilan TTD'}
                    </span>
                    <span
                      className={`pdf-sheet-status-pill ${
                        isCurrentPreviewPageSigned ? 'is-signed' : 'is-skipped'
                      }`}
                    >
                      {isCurrentPreviewPageSigned
                        ? isEn
                          ? 'Signed Page'
                          : 'Halaman Ditandatangani'
                        : isEn
                          ? 'Not Signed'
                          : 'Tidak Ditandatangani'}
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
                      activeSignature ? 'is-interactive' : ''
                    }`}
                    style={{
                      aspectRatio: `${pageAspectRatio}`,
                    }}
                    tabIndex={0}
                    role="application"
                    aria-label={
                      isEn
                        ? `Page ${previewPageNum} document preview. Drag signature to move, or drag its corner handles to resize.`
                        : `Pratinjau dokumen halaman ${previewPageNum}. Geser tanda tangan untuk memindahkan, atau tarik titik pojok tanda tangan untuk memperbesar dan memperkecil.`
                    }
                    onPointerDown={handleSheetPointerDown}
                    onPointerMove={handleSheetPointerMove}
                    onPointerUp={handleSheetPointerUp}
                    onPointerCancel={handleSheetPointerUp}
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

                    {activeSignature ? (
                      <div
                        className={`pdf-sheet-sig-stamp ${
                          !isCurrentPreviewPageSigned ? 'is-Ghost' : ''
                        } ${sheetDragMode ? 'is- manipulating' : ''}`}
                        style={{
                          width: `${scalePercent}%`,
                          left: `${posXPercent}%`,
                          top: `${posYPercent}%`,
                        }}
                      >
                        <span
                          className="pdf-sig-corner-handle is-nw"
                          onPointerDown={handleCornerResizePointerDown}
                          title={
                            isEn
                              ? 'Drag corner to resize signature'
                              : 'Tarik pojok untuk memperbesar / memperkecil TTD'
                          }
                        />
                        <span
                          className="pdf-sig-corner-handle is-ne"
                          onPointerDown={handleCornerResizePointerDown}
                          title={
                            isEn
                              ? 'Drag corner to resize signature'
                              : 'Tarik pojok untuk memperbesar / memperkecil TTD'
                          }
                        />
                        <span
                          className="pdf-sig-corner-handle is-sw"
                          onPointerDown={handleCornerResizePointerDown}
                          title={
                            isEn
                              ? 'Drag corner to resize signature'
                              : 'Tarik pojok untuk memperbesar / memperkecil TTD'
                          }
                        />
                        <span
                          className="pdf-sig-corner-handle is-se"
                          onPointerDown={handleCornerResizePointerDown}
                          title={
                            isEn
                              ? 'Drag corner to resize signature'
                              : 'Tarik pojok untuk memperbesar / memperkecil TTD'
                          }
                        />

                        <span className="pdf-sig-scale-pill">{scalePercent}%</span>

                        <div
                          className="pdf-sheet-sig-inner"
                          style={{ opacity: opacityPercent / 100 }}
                        >
                          <img
                            src={activeSignature.dataUrl}
                            alt={isEn ? 'Signature stamp' : 'Stempel tanda tangan'}
                            draggable={false}
                          />
                          {signerName.trim() && (
                            <strong className="pdf-sheet-sig-name">{signerName.trim()}</strong>
                          )}
                          {includeDate && (
                            <small className="pdf-sheet-sig-date">{todayFormatted}</small>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pdf-sheet-empty-sig-hint">
                        <span>
                          {isEn
                            ? 'Draw or upload your signature in above to preview, drag, and resize it on this document'
                            : 'Gambar atau unggah tanda tangan pada di atas untuk menggeser posisi dan menarik pojok ukurannya di dokumen ini'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pdf-sheet-coords-bar">
                  <span>
                    {isEn ? 'Position:' : 'Posisi:'} <strong>X: {posXPercent}%</strong> •{' '}
                    <strong>Y: {posYPercent}%</strong> • {isEn ? 'Size:' : 'Ukuran:'}{' '}
                    <strong>{scalePercent}%</strong>
                  </span>
                  <span>
                    {isEn
                      ? 'Drag signature to move • Drag corner dots to resize'
                      : 'Geser TTD untuk memindahkan • Tarik titik di pojok TTD untuk mengubah ukuran'}
                  </span>
                </div>
              </div>

              {/* PENGATURAN OPASITAS & NAMA TERANG DI BAWAH PREVIEW */}
              <div className="pdf-sign-below-preview-grid">
                <div className="pdf-sign-setting-block">
                  <div className="pdf-slider-head">
                    <label className="pdf-sig-tool-label" htmlFor="sig-opacity-slider">
                      {isEn ? 'Ink Opacity:' : 'Opasitas Tinta:'}
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
                      setOpacityPercent(Number(e.target.value))
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
                        ? 'Signer Name / Title Below Signature (Optional):'
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
                        setSignerName(e.target.value)
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
                      setIncludeDate((prev) => !prev)
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
                  !activeSignature?.pngBytes ||
                  Boolean(targetPagesInfo.error) ||
                  targetPagesInfo.pages.length === 0
                }
              >
                <span>
                  {isSigning
                    ? isEn
                      ? 'Signing PDF...'
                      : 'Menandatangani PDF...'
                    : isEn
                      ? `Sign PDF (${targetPagesInfo.pages.length} Pages)`
                      : `Tanda Tangani PDF (${targetPagesInfo.pages.length} Hal)`}
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
