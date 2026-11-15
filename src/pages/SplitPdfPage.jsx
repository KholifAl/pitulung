import { useState, useRef, useEffect } from 'react'
import {
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconDownload,
  IconFileText,
  IconPlus,
  IconShield,
  IconSplitPdf,
  IconUpload,
} from '../components/Icons'
import {
  formatFileSize,
  formatPageNumbersToRanges,
  inspectPdfFile,
  parsePageRanges,
  renderAllPdfPageThumbnails,
  splitPdfFile,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'
import { useLanguage } from '../i18n/LanguageContext'

export default function SplitPdfPage() {
  const { lang } = useLanguage()
  const isEn = lang === 'en'
  const [pdfDocInfo, setPdfDocInfo] = useState(null)
  const [splitMode, setSplitMode] = useState('range') // 'range' (Opsi A) | 'all' (Opsi B)
  const [rangeInput, setRangeInput] = useState('')
  const [pagesPerBundle, setPagesPerBundle] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isSplitting, setIsSplitting] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [splitResult, setSplitResult] = useState(null)
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
      setSplitResult(null)
      setPagesPerBundle('')
      lastClickedPageRef.current = null
      const defaultRange =
        info.pageCount >= 3
          ? `1-2, ${info.pageCount}`
          : '1'
      setRangeInput(defaultRange)
      startThumbnailRendering(file)
    } catch (err) {
      setErrorMsg(err.message || (isEn ? 'Failed to read PDF file.' : 'Gagal membaca berkas PDF.'))
    } finally {
      setIsInspecting(false)
      setProcessStep('')
    }
  }

  const handleClearFile = () => {
    thumbAbortRef.current?.abort()
    setPdfDocInfo(null)
    setSplitResult(null)
    setErrorMsg('')
    setRangeInput('')
    setPagesPerBundle('')
    setPageThumbnails({})
    setIsRenderingThumbnails(false)
    lastClickedPageRef.current = null
  }

  const handleSplitNow = async (e) => {
    if (e) e.preventDefault()
    if (!pdfDocInfo?.file) {
      setErrorMsg(isEn ? 'Please upload a PDF file first.' : 'Unggah berkas PDF terlebih dahulu.')
      return
    }

    if (splitMode === 'range' && (!rangePreview || rangePreview.error || rangePreview.pages.length === 0)) {
      setErrorMsg(
        rangePreview?.error ||
          (isEn
            ? 'Please specify a valid page range first.'
            : 'Tentukan rentang halaman yang valid terlebih dahulu.')
      )
      return
    }

    setErrorMsg('')
    setIsSplitting(true)
    setProcessStep(
      isEn
        ? 'Splitting PDF pages directly in your browser...'
        : 'Memisahkan halaman PDF langsung di browsermu...'
    )

    try {
      const res = await splitPdfFile(
        {
          file: pdfDocInfo.file,
          mode: splitMode,
          rangeInput,
          pagesPerBundle: parseInt(pagesPerBundle, 10) || 1,
        },
        (step) => setProcessStep(step)
      )

      if (res.mode === 'range' && res.primaryFile) {
        triggerBrowserDownload(res.primaryFile.bytes, res.primaryFile.name, 'application/pdf')
      } else if (res.mode === 'all') {
        if (res.zipBlob && res.zipFileName) {
          triggerBrowserDownload(res.zipBlob, res.zipFileName, 'application/zip')
        } else if (res.primaryFile) {
          triggerBrowserDownload(res.primaryFile.bytes, res.primaryFile.name, 'application/pdf')
        }
      }

      setSplitResult({
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
        err.message || (isEn ? 'Failed to split PDF pages.' : 'Gagal memisahkan halaman PDF.')
      )
    } finally {
      setIsSplitting(false)
      setProcessStep('')
    }
  }

  const isBusy = isInspecting || isSplitting
  const rangePreview =
    pdfDocInfo && splitMode === 'range' && rangeInput.trim()
      ? parsePageRanges(rangeInput, pdfDocInfo.pageCount)
      : null

  const selectedPagesList = pdfDocInfo
    ? splitMode === 'all'
      ? Array.from({ length: pdfDocInfo.pageCount }, (_, i) => i + 1)
      : rangePreview && !rangePreview.error
        ? rangePreview.pages
        : []
    : []
  const selectedPageSet = new Set(selectedPagesList)
  const renderedThumbCount = pdfDocInfo
    ? Object.keys(pageThumbnails).filter((k) => Boolean(pageThumbnails[k])).length
    : 0

  const handleTogglePage = (pageNum, event) => {
    if (!pdfDocInfo || splitMode !== 'range' || isBusy) return
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
    setSplitResult(null)
  }

  const handleSelectAllPages = () => {
    if (!pdfDocInfo || isBusy) return
    setRangeInput(pdfDocInfo.pageCount === 1 ? '1' : `1-${pdfDocInfo.pageCount}`)
    lastClickedPageRef.current = null
    setErrorMsg('')
    setSplitResult(null)
  }

  const handleClearSelection = () => {
    if (isBusy) return
    setRangeInput('')
    lastClickedPageRef.current = null
    setErrorMsg('')
    setSplitResult(null)
  }

  return (
    <section className="clean-hero-section">
      <h1 className="editorial-hero-title">
        {isEn ? 'Split PDF Pages' : 'Pisahkan halaman PDF'}
      </h1>

      <p className="editorial-hero-subtitle">
        {isEn
          ? 'Split a PDF document into separate files'
          : 'Pecah berkas menjadi file terpisah'}
      </p>

      {/* CENTRAL WORKSPACE CARD */}
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

        {/* JIKA BELUM ADA FILE: TAMPILKAN HANYA DROPZONE & PRIVASI (SEPERTI MERGE) */}
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
                <IconSplitPdf size={24} />
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
                    : 'atau klik untuk memilih berkas dari perangkatmu'}
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
          /* JIKA FILE SUDAH DIUNGGAH: TAMPILKAN BANNER FILE, PENGATURAN, DAN TOMBOL SPLIT */
          <form onSubmit={handleSplitNow}>
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
                      <span className="pdf-file-size">
                        {formatFileSize(pdfDocInfo.size)}
                      </span>
                      <span
                        className="active-doc-verified"
                        title={isEn ? 'Ready to Split' : 'Siap Dipisah'}
                        aria-label={isEn ? 'Ready to Split' : 'Siap Dipisah'}
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
                  >
                    <IconClose size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* PILIHAN MODE PISAH (OPSI A & OPSI B) */}
            <div className="pdf-split-mode-section">
              <span className="pdf-mode-label">
                {isEn ? 'Select Page Split Mode:' : 'Pilih Mode Pemisahan Halaman:'}
              </span>
              <div
                className="pdf-split-mode-grid"
                role="radiogroup"
                aria-label={isEn ? 'PDF split mode' : 'Mode pisah PDF'}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={splitMode === 'range'}
                  className={`pdf-mode-card ${splitMode === 'range' ? 'is-active' : ''}`}
                  onClick={() => {
                    setSplitMode('range')
                    setSplitResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>{isEn ? 'Custom Page Range' : 'Rentang Halaman Kustom'}</strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn ? (
                      <>
                        Extract specific pages in the order you type (e.g. <code>1-3, 5, 8-10</code>).
                      </>
                    ) : (
                      <>
                        Ambil halaman tertentu sesuai urutan yang kamu ketik (misal: <code>1-3, 5, 8-10</code>).
                      </>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={splitMode === 'all'}
                  className={`pdf-mode-card ${splitMode === 'all' ? 'is-active' : ''}`}
                  onClick={() => {
                    setSplitMode('all')
                    setSplitResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>
                      {isEn ? 'Split Every Page Separately' : 'Pisah Semua Halaman Terpisah'}
                    </strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn ? (
                      <>
                        Split every page into standalone PDF files (download individually or as a <code>.zip</code> bundle).
                      </>
                    ) : (
                      <>
                        Pecah setiap halaman menjadi file PDF mandiri (bisa diunduh satuan atau bundel <code>.zip</code>).
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* FORM INPUT RENTANG ATAU PENGATURAN BUNDEL */}
            {splitMode === 'range' ? (
              <div className="pdf-range-input-wrapper">
                <div className="clean-input-box">
                  <input
                    ref={rangeInputRef}
                    type="text"
                    className="clean-text-input"
                    placeholder={
                      isEn
                        ? `Enter page range (1 to ${pdfDocInfo.pageCount}), e.g. 1-3, 5, 8-10`
                        : `Ketik rentang halaman (1 s/d ${pdfDocInfo.pageCount}), misal: 1-3, 5, 8-10`
                    }
                    value={rangeInput}
                    onChange={(e) => {
                      setRangeInput(e.target.value)
                      setErrorMsg('')
                    }}
                    aria-label={isEn ? 'Custom Page Range' : 'Rentang Halaman Kustom'}
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
            ) : (
              <div className="pdf-bundle-row">
                <label className="pdf-bundle-label" htmlFor="split-bundle-custom-input">
                  {isEn ? 'Pages per bundle:' : 'Halaman per bundel:'}
                </label>
                <div className="clean-input-box pdf-bundle-input-box">
                  <input
                    id="split-bundle-custom-input"
                    type="number"
                    min={1}
                    max={pdfDocInfo.pageCount}
                    className="clean-text-input"
                    placeholder={isEn ? '1 page per pdf' : '1 halaman per pdf'}
                    value={pagesPerBundle}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '') {
                        setPagesPerBundle('')
                      } else {
                        const raw = parseInt(val, 10)
                        if (!Number.isNaN(raw)) {
                          setPagesPerBundle(
                            String(Math.max(1, Math.min(pdfDocInfo.pageCount, raw)))
                          )
                        }
                      }
                      setSplitResult(null)
                    }}
                    disabled={isBusy}
                    aria-label={isEn ? 'Pages per PDF bundle' : 'Jumlah halaman per file PDF'}
                  />
                  {pagesPerBundle !== '' && (
                    <button
                      type="button"
                      className="clean-clear-btn"
                      onClick={() => {
                        setPagesPerBundle('')
                        setSplitResult(null)
                      }}
                      title={isEn ? 'Reset to 1 page per pdf' : 'Reset ke 1 halaman per pdf'}
                      aria-label={isEn ? 'Reset to 1 page per pdf' : 'Reset ke 1 halaman per pdf'}
                    >
                      <IconClose size={12} />
                    </button>
                  )}
                </div>
                <span className="pdf-bundle-output-count">
                  {isEn
                    ? `Total: ${Math.ceil(pdfDocInfo.pageCount / Math.max(1, Math.min(pdfDocInfo.pageCount, parseInt(pagesPerBundle, 10) || 1)))} files`
                    : `Jadi ${Math.ceil(pdfDocInfo.pageCount / Math.max(1, Math.min(pdfDocInfo.pageCount, parseInt(pagesPerBundle, 10) || 1)))} file`}
                </span>
              </div>
            )}

            {/* VISUALISASI SEMUA HALAMAN PDF & PEMILIHAN INTERAKTIF */}
            {(() => {
              const effectiveBundleSize = Math.max(
                1,
                Math.min(pdfDocInfo.pageCount, Number(pagesPerBundle) || 1)
              )
              const totalBundleFiles = Math.ceil(pdfDocInfo.pageCount / effectiveBundleSize)

              return (
                <div className="pdf-split-preview-section">
                  <div className="pdf-split-preview-head">
                    <div className="pdf-split-preview-meta">
                      <strong className="pdf-split-preview-title">
                        {splitMode === 'range'
                          ? isEn
                            ? 'Preview & Select Pages'
                            : 'Pratinjau & Pilih Halaman'
                          : isEn
                            ? 'Page Split & Bundle Visualization'
                            : 'Visualisasi Pemisahan & Bundel'}
                      </strong>
                      <span className="pdf-split-preview-subtitle">
                        {splitMode === 'range'
                          ? isEn
                            ? `${selectedPageSet.size} of ${pdfDocInfo.pageCount} pages selected • Click to toggle, Shift+Click for range`
                            : `${selectedPageSet.size} dari ${pdfDocInfo.pageCount} halaman dipilih • Klik untuk pilih, Shift+Klik untuk rentang`
                          : effectiveBundleSize === 1
                            ? isEn
                              ? `Each of the ${pdfDocInfo.pageCount} pages below will become an individual PDF file`
                              : `Setiap dari ${pdfDocInfo.pageCount} halaman di bawah akan menjadi 1 file PDF mandiri`
                            : isEn
                              ? `${pdfDocInfo.pageCount} pages will be bundled per ${effectiveBundleSize} pages into ${totalBundleFiles} PDF files`
                              : `${pdfDocInfo.pageCount} halaman akan dibundel per ${effectiveBundleSize} halaman menjadi ${totalBundleFiles} file PDF`}
                        {isRenderingThumbnails && (
                          <span className="pdf-split-preview-loading">
                            {isEn
                              ? ` • Loading preview ${renderedThumbCount}/${pdfDocInfo.pageCount}...`
                              : ` • Memuat pratinjau ${renderedThumbCount}/${pdfDocInfo.pageCount}...`}
                          </span>
                        )}
                      </span>
                    </div>

                    {splitMode === 'range' && (
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
                    )}
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

                      if (splitMode === 'range') {
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
                      }

                      const bundleIndex = Math.floor((pageNum - 1) / effectiveBundleSize) + 1
                      const bundleStart = (bundleIndex - 1) * effectiveBundleSize + 1
                      const bundleEnd = Math.min(
                        pdfDocInfo.pageCount,
                        bundleStart + effectiveBundleSize - 1
                      )
                      const bundleRangeLabel =
                        bundleStart === bundleEnd
                          ? isEn
                            ? `Pg ${bundleStart}`
                            : `Hal. ${bundleStart}`
                          : isEn
                            ? `Pgs ${bundleStart}-${bundleEnd}`
                            : `Hal. ${bundleStart}-${bundleEnd}`

                      return (
                        <div
                          key={pageNum}
                          className={`pdf-split-page-card is-split-all ${
                            effectiveBundleSize > 1 && bundleIndex % 2 === 0 ? 'is-bundle-alt' : ''
                          }`}
                        >
                          <div className="pdf-split-page-top">
                            <span className="pdf-split-page-num">
                              {isEn ? `Page ${pageNum}` : `Hal. ${pageNum}`}
                            </span>
                            <span className="pdf-split-page-output-tag">
                              {`File #${bundleIndex}`}
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
                            <span className="pdf-split-page-status is-split-cut">
                              <IconSplitPdf size={12} />
                              <span>
                                {effectiveBundleSize === 1
                                  ? isEn
                                    ? 'Separate PDF'
                                    : 'PDF terpisah'
                                  : bundleRangeLabel}
                              </span>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* PRIMARY ACTION ROW: PRIVASI DI KIRI, TOMBOL SPLIT DI KANAN */}
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
                  (splitMode === 'range' &&
                    (!rangePreview || rangePreview.error || rangePreview.pages.length === 0))
                }
              >
                <span>
                  {isSplitting
                    ? isEn
                      ? 'Splitting PDF...'
                      : 'Memisahkan PDF...'
                    : isEn
                      ? 'Split PDF Now'
                      : 'Pisahkan PDF Sekarang'}
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
                (isEn ? 'Processing PDF page split...' : 'Memproses pemisahan halaman PDF...')}
            </span>
          </div>
        )}

        {/* PANEL HASIL PEMISAHAN PDF (UNDUH SATUAN ATAU .ZIP) */}
        {splitResult && !isBusy && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>{isEn ? 'Completed & Ready to Download' : 'Selesai & Siap Diunduh'}</span>
                </span>
                <span className="clean-result-info">
                  {isEn ? 'Source: ' : 'Sumber: '}
                  <strong title={splitResult.sourceName}>{truncateFileName(splitResult.sourceName, 24)}</strong> •{' '}
                  {splitResult.timestamp}
                </span>
              </div>

              <div className="clean-result-controls">
                {splitResult.mode === 'range' && splitResult.primaryFile && (
                  <button
                    type="button"
                    className="clean-action-btn primary"
                    onClick={() =>
                      triggerBrowserDownload(
                        splitResult.primaryFile.bytes,
                        splitResult.primaryFile.name,
                        'application/pdf'
                      )
                    }
                  >
                    <IconDownload size={14} />
                    <span>
                      {isEn
                        ? `Download Extracted PDF (${splitResult.extractedCount} Pgs)`
                        : `Unduh PDF Pilihan (${splitResult.extractedCount} Hal)`}
                    </span>
                  </button>
                )}

                {splitResult.zipBlob && splitResult.zipFileName && (
                  <button
                    type="button"
                    className={`clean-action-btn ${splitResult.mode === 'all' ? 'primary' : ''}`}
                    onClick={() =>
                      triggerBrowserDownload(
                        splitResult.zipBlob,
                        splitResult.zipFileName,
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
                  onClick={() => setSplitResult(null)}
                  title={isEn ? 'Close' : 'Tutup'}
                  aria-label={isEn ? 'Close' : 'Tutup'}
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>

            <p className="clean-result-summary">
              {splitResult.mode === 'range' ? (
                isEn ? (
                  <>
                    Successfully extracted <strong>{splitResult.extractedCount} pages</strong> (Pages{' '}
                    {splitResult.selectedPages.join(', ')}) into a new PDF file.
                  </>
                ) : (
                  <>
                    Berhasil mengekstrak <strong>{splitResult.extractedCount} halaman</strong> (Halaman{' '}
                    {splitResult.selectedPages.join(', ')}) menjadi berkas PDF baru.
                  </>
                )
              ) : isEn ? (
                <>
                  Successfully split <strong>{splitResult.totalPages} pages</strong> into{' '}
                  <strong>{splitResult.files.length} separate PDF files</strong>. You can download the{' '}
                  <code>.zip</code> bundle or download individual pages below:
                </>
              ) : (
                <>
                  Berhasil memecah <strong>{splitResult.totalPages} halaman</strong> menjadi{' '}
                  <strong>{splitResult.files.length} berkas PDF terpisah</strong>. Kamu bisa mengunduh bundel{' '}
                  <code>.zip</code> atau mengunduh per halaman secara satuan di bawah ini:
                </>
              )}
            </p>

            {/* DAFTAR FILE SATUAN UNTUK DIUNDUH */}
            {splitResult.files && splitResult.files.length > 0 && (
              <div className="pdf-split-files-grid">
                {splitResult.files.map((f, idx) => (
                  <div key={idx} className="pdf-split-output-item">
                    <div className="pdf-split-output-info">
                      <span className="pdf-split-badge">{f.label}</span>
                      <strong className="pdf-split-filename" title={f.name}>
                        {truncateFileName(f.name, 26)}
                      </strong>
                      <span className="pdf-file-size">{formatFileSize(f.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="clean-action-btn"
                      onClick={() => triggerBrowserDownload(f.bytes, f.name, 'application/pdf')}
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
