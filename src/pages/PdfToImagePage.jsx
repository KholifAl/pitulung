import { useState, useRef } from 'react'
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
  inspectPdfFile,
  parsePageRanges,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'
import { useLanguage } from '../i18n/LanguageContext'

export default function PdfToImagePage() {
  const { lang } = useLanguage()
  const isEn = lang === 'en'
  const [pdfDocInfo, setPdfDocInfo] = useState(null)
  const [extractMode, setExtractMode] = useState('all')
  const [rangeInput, setRangeInput] = useState('')
  const [imageFormat, setImageFormat] = useState('png')
  const [imageQuality, setImageQuality] = useState('high')
  const [isDragging, setIsDragging] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [convertedResult, setConvertedResult] = useState(null)

  const fileInputRef = useRef(null)
  const rangeInputRef = useRef(null)
  const resultRef = useRef(null)

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
      const info = await inspectPdfFile(file)
      setPdfDocInfo(info)
      setConvertedResult(null)
      const defaultRange = info.pageCount >= 3 ? `1-2, ${info.pageCount}` : '1'
      setRangeInput(defaultRange)
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
    setPdfDocInfo(null)
    setConvertedResult(null)
    setErrorMsg('')
    setRangeInput('')
  }

  const isBusy = isInspecting || isConverting
  const rangePreview =
    pdfDocInfo && extractMode === 'range' && rangeInput.trim()
      ? parsePageRanges(rangeInput, pdfDocInfo.pageCount)
      : null

  const handleConvertNow = async (e) => {
    if (e) e.preventDefault()
    if (!pdfDocInfo?.file) {
      setErrorMsg(
        isEn ? 'Please upload a PDF file first.' : 'Unggah berkas PDF terlebih dahulu.'
      )
      return
    }

    if (
      extractMode === 'range' &&
      (!rangePreview || rangePreview.error || rangePreview.pages.length === 0)
    ) {
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
          mode: extractMode,
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
                      <span className="active-doc-tag">
                        {pdfDocInfo.pageCount} {isEn ? 'Pages' : 'Halaman'}
                      </span>
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

            <div className="pdf-split-mode-section">
              <span className="pdf-mode-label">
                {isEn ? 'Select Page Extraction Mode:' : 'Pilih Halaman yang Diubah:'}
              </span>
              <div
                className="pdf-split-mode-grid"
                role="radiogroup"
                aria-label={isEn ? 'Page extraction mode' : 'Mode pemilihan halaman'}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={extractMode === 'all'}
                  className={`pdf-mode-card ${extractMode === 'all' ? 'is-active' : ''}`}
                  onClick={() => {
                    setExtractMode('all')
                    setConvertedResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>
                      {isEn ? 'All Pages to Images' : 'Semua Halaman Jadi Gambar'}
                    </strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn ? (
                      <>
                        Convert every page into separate image files (download individually or as a{' '}
                        <code>.zip</code> bundle).
                      </>
                    ) : (
                      <>
                        Ubah seluruh halaman menjadi berkas gambar terpisah (bisa diunduh satuan atau bundel{' '}
                        <code>.zip</code>).
                      </>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={extractMode === 'range'}
                  className={`pdf-mode-card ${extractMode === 'range' ? 'is-active' : ''}`}
                  onClick={() => {
                    setExtractMode('range')
                    setConvertedResult(null)
                  }}
                >
                  <div className="pdf-mode-card-top">
                    <strong>{isEn ? 'Custom Page Range' : 'Rentang Halaman Kustom'}</strong>
                    <span className="pdf-mode-radio-dot" />
                  </div>
                  <span>
                    {isEn ? (
                      <>
                        Convert specific pages only (e.g. <code>1-3, 5</code>).
                      </>
                    ) : (
                      <>
                        Ubah halaman tertentu saja sesuai pilihanmu (misal: <code>1-3, 5</code>).
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {extractMode === 'range' && (
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
                      aria-label={isEn ? 'Clear range' : 'Bersihkan rentang'}
                    >
                      <IconClose size={12} />
                    </button>
                  )}
                </div>

                {rangePreview && (
                  <div
                    className={`pdf-range-preview-hint ${
                      rangePreview.error ? 'is-invalid' : 'is-valid'
                    }`}
                  >
                    {rangePreview.error ? (
                      <span>{rangePreview.error}</span>
                    ) : (
                      <span>
                        {isEn ? (
                          <>
                            Will convert <strong>{rangePreview.pages.length} pages</strong> (Pages:{' '}
                            {rangePreview.pages.join(', ')}) out of {pdfDocInfo.pageCount} total
                            pages.
                          </>
                        ) : (
                          <>
                            Akan mengubah <strong>{rangePreview.pages.length} halaman</strong>{' '}
                            (Halaman: {rangePreview.pages.join(', ')}) dari total{' '}
                            {pdfDocInfo.pageCount} halaman.
                          </>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="img-pdf-settings-bar">
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
                  (extractMode === 'range' &&
                    (!rangePreview || rangePreview.error || rangePreview.pages.length === 0))
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
