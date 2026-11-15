import { useState, useRef, useEffect } from 'react'
import {
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconDownload,
  IconFileText,
  IconPdfToImage,
  IconPlus,
  IconShield,
  IconUpload,
} from '../components/Icons'
import {
  convertPdfToImages,
  formatFileSize,
  formatPageNumbersToRanges,
  inspectPdfFile,
  parsePageRanges,
  renderAllPdfPageThumbnails,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'
import { useLanguage } from '../i18n/LanguageContext'

export default function PdfToImagePage() {
  const { lang } = useLanguage()
  const isEn = lang === 'en'
  const [pdfDocInfo, setPdfDocInfo] = useState(null)
  const [rangeInput, setRangeInput] = useState('')
  const [imageFormat, setImageFormat] = useState('png')
  const [imageQuality, setImageQuality] = useState('high')
  const [isDragging, setIsDragging] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [convertedResult, setConvertedResult] = useState(null)
  const [pageThumbnails, setPageThumbnails] = useState({})
  const [isRenderingThumbnails, setIsRenderingThumbnails] = useState(false)
  const [activeRenderPage, setActiveRenderPage] = useState(1)
  const [pageTick, setPageTick] = useState(0)

  const fileInputRef = useRef(null)
  const rangeInputRef = useRef(null)
  const resultRef = useRef(null)
  const thumbAbortRef = useRef(null)
  const lastClickedPageRef = useRef(null)

  useEffect(() => {
    return () => {
      thumbAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!isRenderingThumbnails) return undefined
    const timer = setInterval(() => {
      setPageTick((t) => t + 1)
    }, 120)
    return () => clearInterval(timer)
  }, [isRenderingThumbnails])

  const startThumbnailRendering = (file) => {
    thumbAbortRef.current?.abort()
    const controller = new AbortController()
    thumbAbortRef.current = controller
    setPageThumbnails({})
    setActiveRenderPage(1)
    setPageTick(0)
    setIsRenderingThumbnails(true)

    renderAllPdfPageThumbnails(
      file,
      {
        maxDimension: 168,
        maxScale: 0.75,
        mimeType: 'image/jpeg',
        quality: 0.65,
        onPageStart: (pageNum) => {
          if (controller.signal.aborted) return
          setActiveRenderPage(pageNum)
          setPageTick(0)
        },
        signal: controller.signal,
      },
      (pageNum, dataUrl) => {
        if (controller.signal.aborted) return
        setPageThumbnails((prev) => ({
          ...prev,
          [pageNum]: dataUrl,
        }))
      }
    )
      .catch(() => {
        // Ignore thumbnail preview errors; fallback placeholder remains visible
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsRenderingThumbnails(false)
        }
      })
  }

  const handleSelectPdfFile = async (file) => {
    if (!file) return
    setErrorMsg('')
    setIsInspecting(true)
    setProcessStep(
      isEn
        ? `Reading document "${truncateFileName(file.name)}"...`
        : `Membaca dokumen "${truncateFileName(file.name)}"...`
    )

    try {
      const info = await inspectPdfFile(file, { quick: true })
      setPdfDocInfo(info)
      setConvertedResult(null)
      lastClickedPageRef.current = null
      const defaultRange = info.pageCount === 1 ? '1' : `1-${info.pageCount}`
      setRangeInput(defaultRange)
      startThumbnailRendering(file)
    } catch (err) {
      setErrorMsg(
        err.message || (isEn ? 'Failed to read PDF file.' : 'Gagal membaca berkas PDF.')
      )
    } finally {
      setIsInspecting(false)
      setProcessStep('')
    }
  }

  const handleClearFile = () => {
    thumbAbortRef.current?.abort()
    setPdfDocInfo(null)
    setConvertedResult(null)
    setErrorMsg('')
    setRangeInput('')
    setPageThumbnails({})
    setIsRenderingThumbnails(false)
    lastClickedPageRef.current = null
  }

  const isBusy = isInspecting || isConverting
  const rangePreview =
    pdfDocInfo && rangeInput.trim()
      ? parsePageRanges(rangeInput, pdfDocInfo.pageCount)
      : null

  const selectedPagesList =
    pdfDocInfo && rangePreview && !rangePreview.error ? rangePreview.pages : []
  const selectedPageSet = new Set(selectedPagesList)
  const renderedThumbCount = pdfDocInfo
    ? Object.keys(pageThumbnails).filter((k) => Boolean(pageThumbnails[k])).length
    : 0

  const handleTogglePage = (pageNum, event) => {
    if (!pdfDocInfo || isBusy) return
    const nextSet = new Set(selectedPageSet)

    if (event?.shiftKey && lastClickedPageRef.current != null) {
      const start = Math.min(lastClickedPageRef.current, pageNum)
      const end = Math.max(lastClickedPageRef.current, pageNum)
      for (let p = start; p <= end; p += 1) {
        nextSet.add(p)
      }
    } else if (nextSet.has(pageNum)) {
      nextSet.delete(pageNum)
    } else {
      nextSet.add(pageNum)
    }

    lastClickedPageRef.current = pageNum
    setRangeInput(formatPageNumbersToRanges(Array.from(nextSet)))
    setErrorMsg('')
    setConvertedResult(null)
  }

  const handleSelectAllPages = () => {
    if (!pdfDocInfo || isBusy) return
    setRangeInput(pdfDocInfo.pageCount === 1 ? '1' : `1-${pdfDocInfo.pageCount}`)
    lastClickedPageRef.current = null
    setErrorMsg('')
    setConvertedResult(null)
  }

  const handleClearSelection = () => {
    if (isBusy) return
    setRangeInput('')
    lastClickedPageRef.current = null
    setErrorMsg('')
    setConvertedResult(null)
  }

  const handleConvertNow = async (e) => {
    if (e) e.preventDefault()
    if (!pdfDocInfo?.file) {
      setErrorMsg(
        isEn ? 'Please upload a PDF file first.' : 'Unggah berkas PDF terlebih dahulu.'
      )
      return
    }

    if (!rangePreview || rangePreview.error || rangePreview.pages.length === 0) {
      setErrorMsg(
        rangePreview?.error ||
          (isEn
            ? 'Please specify a valid page range first.'
            : 'Tentukan rentang halaman yang valid terlebih dahulu.')
      )
      return
    }

    setErrorMsg('')
    setIsConverting(true)
    setProcessStep(
      isEn
        ? 'Rendering PDF pages to images directly in your browser...'
        : 'Merender halaman PDF menjadi gambar langsung di browsermu...'
    )

    try {
      const res = await convertPdfToImages(
        {
          file: pdfDocInfo.file,
          mode: 'range',
          rangeInput,
          format: imageFormat,
          quality: imageQuality,
        },
        (step) => setProcessStep(step)
      )

      if (res.primaryFile) {
        triggerBrowserDownload(res.primaryFile.bytes, res.primaryFile.name, res.mimeType)
      } else if (res.zipBlob && res.zipFileName) {
        triggerBrowserDownload(res.zipBlob, res.zipFileName, 'application/zip')
      }

      setConvertedResult({
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
          (isEn ? 'Failed to convert PDF to images.' : 'Gagal mengubah PDF menjadi gambar.')
      )
    } finally {
      setIsConverting(false)
      setProcessStep('')
    }
  }

  return (
    <section className="clean-hero-section">
      <h1 className="editorial-hero-title">
        {isEn ? 'Convert PDF to Image' : 'Ubah PDF ke Gambar'}
      </h1>
      <p className="editorial-hero-subtitle">
        {isEn
          ? 'Export PDF pages into crisp PNG or JPG images'
          : 'Simpan halaman dokumen PDF menjadi gambar PNG atau JPG tajam'}
      </p>

      <div
        className={`clean-workspace-card ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const droppedFile = e.dataTransfer?.files?.[0]
          if (droppedFile) handleSelectPdfFile(droppedFile)
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleSelectPdfFile(f)
            e.target.value = ''
          }}
        />

        {!pdfDocInfo ? (
          <>
            <div
              className="pdf-dropzone-area"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <div className="pdf-dropzone-icon">
                <IconPdfToImage size={24} />
              </div>
              <div className="pdf-dropzone-text">
                <strong>
                  {isEn
                    ? 'Drag & drop PDF file here'
                    : 'Tarik & lepas berkas PDF ke sini'}
                </strong>
                <span>
                  {isEn
                    ? 'or click to select a PDF document from your device'
                    : 'atau klik untuk memilih berkas PDF dari perangkatmu'}
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
          <form onSubmit={handleConvertNow}>
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
                      <span className="pdf-file-size">{formatFileSize(pdfDocInfo.size)}</span>
                      <span
                        className="active-doc-verified"
                        title={isEn ? 'Ready to Convert' : 'Siap Diubah'}
                        aria-label={isEn ? 'Ready to Convert' : 'Siap Diubah'}
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                  >
                    <IconUpload size={13} />
                    <span>{isEn ? 'Replace' : 'Ganti'}</span>
                  </button>
                  <button
                    type="button"
                    className="doc-remove-btn"
                    onClick={handleClearFile}
                    disabled={isBusy}
                    title={isEn ? 'Remove document' : 'Hapus dokumen'}
                    aria-label={isEn ? 'Remove document' : 'Hapus dokumen'}
                  >
                    <IconClose size={12} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pdf-range-input-wrapper">
              <div className="clean-input-box">
                <input
                  ref={rangeInputRef}
                  type="text"
                  className="clean-text-input"
                  placeholder={
                    isEn
                      ? `Enter page range (1 to ${pdfDocInfo.pageCount}), e.g. 1-3, 5`
                      : `Ketik rentang halaman (1 s/d ${pdfDocInfo.pageCount}), misal: 1-3, 5`
                  }
                  value={rangeInput}
                  onChange={(e) => {
                    setRangeInput(e.target.value)
                    setErrorMsg('')
                  }}
                  aria-label={isEn ? 'Page Range' : 'Rentang Halaman'}
                />
                {rangeInput && (
                  <button
                    type="button"
                    className="clean-clear-btn"
                    onClick={() => {
                      setRangeInput('')
                      rangeInputRef.current?.focus()
                    }}
                    title={isEn ? 'Clear range' : 'Bersihkan rentang'}
                    aria-label={isEn ? 'Clear range' : 'Bersihkan rentang'}
                  >
                    <IconClose size={12} />
                  </button>
                )}
              </div>

              {rangePreview?.error && (
                <div className="pdf-range-preview-hint is-invalid">
                  <span>{rangePreview.error}</span>
                </div>
              )}
            </div>

            {/* VISUALISASI SEMUA HALAMAN PDF & PEMILIHAN INTERAKTIF */}
            <div className="pdf-split-preview-section">
              <div className="pdf-split-preview-head">
                <div className="pdf-split-preview-meta">
                  <strong className="pdf-split-preview-title">
                    {isEn ? 'Preview & Select Pages' : 'Pratinjau & Pilih Halaman'}
                  </strong>
                  <span className="pdf-split-preview-subtitle">
                    {isEn
                      ? `${selectedPageSet.size} of ${pdfDocInfo.pageCount} pages selected • Click to toggle, Shift+Click for range`
                      : `${selectedPageSet.size} dari ${pdfDocInfo.pageCount} halaman dipilih • Klik untuk pilih, Shift+Klik untuk rentang`}
                    {isRenderingThumbnails && (
                      <span className="pdf-split-preview-loading">
                        {isEn
                          ? ` • Loading preview ${renderedThumbCount}/${pdfDocInfo.pageCount}...`
                          : ` • Memuat pratinjau ${renderedThumbCount}/${pdfDocInfo.pageCount}...`}
                      </span>
                    )}
                  </span>
                </div>

                <div className="pdf-split-preview-actions">
                  <button
                    type="button"
                    className="doc-quick-chip"
                    onClick={handleSelectAllPages}
                    disabled={isBusy || selectedPageSet.size === pdfDocInfo.pageCount}
                  >
                    {isEn ? 'Select All' : 'Pilih Semua'}
                  </button>
                  <button
                    type="button"
                    className="doc-quick-chip"
                    onClick={handleClearSelection}
                    disabled={isBusy || selectedPageSet.size === 0}
                  >
                    {isEn ? 'Clear' : 'Kosongkan'}
                  </button>
                </div>
              </div>

              <div
                className="pdf-split-pages-grid"
                role="region"
                aria-label={isEn ? 'PDF pages preview' : 'Pratinjau halaman PDF'}
              >
                {Array.from({ length: pdfDocInfo.pageCount }, (_, idx) => {
                  const pageNum = idx + 1
                  const thumbUrl = pageThumbnails[pageNum]
                  const isSelected = selectedPageSet.has(pageNum)

                  const activeFraction = Math.min(0.88, 1 - Math.exp(-pageTick * 0.22))
                  const loadingPct = !isRenderingThumbnails
                    ? 100
                    : pageNum === activeRenderPage
                      ? Math.min(95, Math.max(14, Math.round(14 + activeFraction * 81)))
                      : pageNum > activeRenderPage
                        ? Math.min(
                            88,
                            Math.max(
                              6,
                              Math.round(((renderedThumbCount + activeFraction) / pageNum) * 84)
                            )
                          )
                        : 96

                  const loadingOverlay = isRenderingThumbnails ? (
                    <div
                      className="pdf-split-page-loader"
                      role="status"
                      aria-label={
                        isEn
                          ? `Loading page ${pageNum} preview ${loadingPct}%`
                          : `Memuat pratinjau halaman ${pageNum} ${loadingPct}%`
                      }
                    >
                      <span className="pdf-page-progress-pct">{loadingPct}%</span>
                    </div>
                  ) : (
                    <div className="pdf-split-page-skeleton">
                      <IconFileText size={20} />
                      <span>{pageNum}</span>
                    </div>
                  )

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={isBusy}
                      onClick={(e) => handleTogglePage(pageNum, e)}
                      className={`pdf-split-page-card is-selectable ${
                        isSelected ? 'is-selected' : 'is-unselected'
                      }`}
                    >
                      <div className="pdf-split-page-top">
                        <span className="pdf-split-page-num">
                          {isEn ? `Page ${pageNum}` : `Hal. ${pageNum}`}
                        </span>
                        <span className="pdf-split-page-check" aria-hidden="true">
                          {isSelected && <IconCheck size={11} />}
                        </span>
                      </div>

                      <div className="pdf-split-page-thumb">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={isEn ? `Page ${pageNum} preview` : `Pratinjau halaman ${pageNum}`}
                            loading="lazy"
                          />
                        ) : (
                          loadingOverlay
                        )}
                      </div>

                      <div className="pdf-split-page-footer">
                        <span className="pdf-split-page-status">
                          {isSelected
                            ? isEn
                              ? 'Selected'
                              : 'Dipilih'
                            : isEn
                              ? 'Not selected'
                              : 'Tidak dipilih'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="img-pdf-settings-bar" style={{ marginTop: '14px' }}>
              <div className="img-pdf-setting-group">
                <span className="img-pdf-setting-label">
                  {isEn ? 'Image Format' : 'Format Gambar'}
                </span>
                <div
                  className="img-pdf-pill-group"
                  role="radiogroup"
                  aria-label={isEn ? 'Image Format' : 'Format Gambar'}
                >
                  {[
                    { id: 'png', label: isEn ? 'PNG (Crisp)' : 'PNG (Tajam)' },
                    { id: 'jpg', label: isEn ? 'JPG (Lighter)' : 'JPG (Ringan)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={imageFormat === opt.id}
                      className={`img-pdf-pill-btn ${imageFormat === opt.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setImageFormat(opt.id)
                        setConvertedResult(null)
                      }}
                      disabled={isBusy}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="img-pdf-setting-group">
                <span className="img-pdf-setting-label">
                  {isEn ? 'Resolution' : 'Resolusi Render'}
                </span>
                <div
                  className="img-pdf-pill-group"
                  role="radiogroup"
                  aria-label={isEn ? 'Resolution' : 'Resolusi Render'}
                >
                  {[
                    { id: 'high', label: isEn ? 'High (HD)' : 'Tinggi (HD)' },
                    { id: 'standard', label: isEn ? 'Standard' : 'Standar' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={imageQuality === opt.id}
                      className={`img-pdf-pill-btn ${imageQuality === opt.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setImageQuality(opt.id)
                        setConvertedResult(null)
                      }}
                      disabled={isBusy}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pdf-action-bar" style={{ marginTop: '18px' }}>
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

              <button
                type="submit"
                className="clean-submit-btn pdf-submit-btn"
                disabled={
                  isBusy ||
                  !rangePreview ||
                  Boolean(rangePreview.error) ||
                  rangePreview.pages.length === 0
                }
              >
                <span>
                  {isConverting
                    ? isEn
                      ? 'Converting to Images...'
                      : 'Mengubah ke Gambar...'
                    : isEn
                      ? 'Convert to Images Now'
                      : 'Ubah ke Gambar Sekarang'}
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
                (isEn ? 'Rendering PDF pages to images...' : 'Merender halaman PDF ke gambar...')}
            </span>
          </div>
        )}

        {convertedResult && !isBusy && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>
                    {isEn ? 'Completed & Ready to Download' : 'Selesai & Siap Diunduh'}
                  </span>
                </span>
                <span className="clean-result-info">
                  {isEn ? 'Source: ' : 'Sumber: '}
                  <strong title={convertedResult.sourceName}>
                    {truncateFileName(convertedResult.sourceName, 24)}
                  </strong>{' '}
                  • {convertedResult.extractedCount} {convertedResult.format} •{' '}
                  {convertedResult.timestamp}
                </span>
              </div>

              <div className="clean-result-controls">
                {convertedResult.primaryFile && (
                  <button
                    type="button"
                    className="clean-action-btn primary"
                    onClick={() =>
                      triggerBrowserDownload(
                        convertedResult.primaryFile.bytes,
                        convertedResult.primaryFile.name,
                        convertedResult.mimeType
                      )
                    }
                  >
                    <IconDownload size={14} />
                    <span>
                      {isEn
                        ? `Re-download ${convertedResult.format}`
                        : `Unduh Ulang ${convertedResult.format}`}
                    </span>
                  </button>
                )}

                {convertedResult.zipBlob && convertedResult.zipFileName && (
                  <button
                    type="button"
                    className="clean-action-btn primary"
                    onClick={() =>
                      triggerBrowserDownload(
                        convertedResult.zipBlob,
                        convertedResult.zipFileName,
                        'application/zip'
                      )
                    }
                  >
                    <IconDownload size={14} />
                    <span>{isEn ? 'Download All (.zip)' : 'Unduh Semua (.zip)'}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="clean-close-result"
                  onClick={() => setConvertedResult(null)}
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
                  Successfully rendered <strong>{convertedResult.extractedCount} pages</strong> into{' '}
                  <strong>{convertedResult.format}</strong> images. Download individual pages below:
                </>
              ) : (
                <>
                  Berhasil mengubah <strong>{convertedResult.extractedCount} halaman</strong> menjadi
                  berkas gambar <strong>{convertedResult.format}</strong>. Kamu dapat mengunduh per
                  halaman di bawah ini:
                </>
              )}
            </p>

            {convertedResult.files && convertedResult.files.length > 0 && (
              <div className="pdf-split-files-grid">
                {convertedResult.files.map((f) => (
                  <div key={f.id} className="pdf-split-output-item pdf-image-output-item">
                    <div className="pdf-image-output-left">
                      <span className="img-pdf-thumb-box is-result-thumb">
                        <img
                          src={f.dataUrl}
                          alt={f.label}
                          className="img-pdf-thumb"
                        />
                      </span>
                      <div className="pdf-split-output-info">
                        <span className="pdf-split-badge">
                          {isEn ? `Page ${f.pageNumber}` : f.label} • {f.format}
                        </span>
                        <strong className="pdf-split-filename" title={f.name}>
                          {truncateFileName(f.name, 26)}
                        </strong>
                        <span className="pdf-file-size">
                          {f.width} × {f.height} px • {formatFileSize(f.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="clean-action-btn"
                      onClick={() => triggerBrowserDownload(f.bytes, f.name, f.mimeType)}
                    >
                      <IconDownload size={13} />
                      <span>{isEn ? 'Download' : 'Unduh'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
