import { useState, useRef } from 'react'
import {
  IconArrowUpRight,
  IconArrowUp,
  IconArrowDown,
  IconCheck,
  IconClose,
  IconDownload,
  IconImageToPdf,
  IconPlus,
  IconShield,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import {
  convertImagesToPdf,
  formatFileSize,
  inspectImageFile,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'
import { useLanguage } from '../i18n/LanguageContext'

export default function ImageToPdfPage() {
  const { lang } = useLanguage()
  const isEn = lang === 'en'
  const [imageItems, setImageItems] = useState([])
  const [pageSize, setPageSize] = useState('a4')
  const [orientation, setOrientation] = useState('auto')
  const [margin, setMargin] = useState('small')
  const [isDragging, setIsDragging] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [convertedResult, setConvertedResult] = useState(null)

  const fileInputRef = useRef(null)
  const resultRef = useRef(null)

  const handleAddFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    setErrorMsg('')
    setIsInspecting(true)
    setProcessStep(
      isEn
        ? 'Reading image files & checking dimensions...'
        : 'Membaca berkas gambar & memeriksa resolusi...'
    )

    const newItems = []
    const errors = []

    for (const file of files) {
      try {
        const info = await inspectImageFile(file)
        newItems.push(info)
      } catch (err) {
        errors.push(
          err.message ||
            (isEn ? `Failed to read "${file.name}".` : `Gagal membaca "${file.name}".`)
        )
      }
    }

    if (newItems.length > 0) {
      setImageItems((prev) => [...prev, ...newItems])
      setConvertedResult(null)
    }

    if (errors.length > 0) {
      setErrorMsg(errors.join(' '))
    }

    setIsInspecting(false)
    setProcessStep('')
  }

  const handleMoveItem = (index, direction) => {
    setImageItems((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(targetIndex, 0, moved)
      return copy
    })
    setConvertedResult(null)
  }

  const handleRemoveItem = (id) => {
    setImageItems((prev) => prev.filter((item) => item.id !== id))
    setConvertedResult(null)
    setErrorMsg('')
  }

  const handleClearAll = () => {
    setImageItems([])
    setConvertedResult(null)
    setErrorMsg('')
  }

  const handleConvertNow = async () => {
    if (imageItems.length < 1) {
      setErrorMsg(
        isEn
          ? 'Please upload at least 1 image file first.'
          : 'Unggah minimal 1 berkas gambar terlebih dahulu.'
      )
      return
    }

    setErrorMsg('')
    setIsConverting(true)
    setProcessStep(
      isEn
        ? 'Converting images to PDF directly in your browser...'
        : 'Mengubah gambar ke PDF langsung di browsermu...'
    )

    try {
      const res = await convertImagesToPdf(
        imageItems,
        { pageSize, orientation, margin },
        (step) => setProcessStep(step)
      )
      triggerBrowserDownload(res.pdfBytes, res.fileName, 'application/pdf')

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
          (isEn ? 'Failed to convert images to PDF.' : 'Gagal mengubah gambar ke PDF.')
      )
    } finally {
      setIsConverting(false)
      setProcessStep('')
    }
  }

  const totalSize = imageItems.reduce((acc, item) => acc + (item.size || 0), 0)
  const isBusy = isInspecting || isConverting

  return (
    <section className="clean-hero-section">
      <h1 className="editorial-hero-title">
        {isEn ? 'Convert Images to PDF' : 'Ubah Gambar ke PDF'}
      </h1>
      <p className="editorial-hero-subtitle">
        {isEn
          ? 'Turn JPG, PNG, and WEBP images into a neat PDF document'
          : 'Susun foto JPG, PNG, atau WEBP menjadi satu dokumen PDF rapi'}
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
          if (e.dataTransfer?.files?.length) {
            handleAddFiles(e.dataTransfer.files)
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) {
              handleAddFiles(e.target.files)
            }
            e.target.value = ''
          }}
        />

        {imageItems.length === 0 ? (
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
                <IconImageToPdf size={24} />
              </div>
              <div className="pdf-dropzone-text">
                <strong>
                  {isEn
                    ? 'Drag & drop image files here'
                    : 'Tarik & lepas berkas gambar ke sini'}
                </strong>
                <span>
                  {isEn
                    ? 'or click to select JPG, PNG, or WEBP images from your device'
                    : 'atau klik untuk memilih gambar JPG, PNG, atau WEBP dari perangkatmu'}
                </span>
              </div>
              <span className="pdf-dropzone-pill">
                <IconPlus size={13} />
                <span>{isEn ? 'Select Images' : 'Pilih Gambar'}</span>
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
          <>
            <div className="pdf-file-list-container">
              <div className="pdf-file-list-head">
                <div>
                  <span>
                    {isEn
                      ? `Page Order (${imageItems.length} images • ${imageItems.length} Pages • ${formatFileSize(totalSize)})`
                      : `Urutan Halaman (${imageItems.length} gambar • ${imageItems.length} Halaman • ${formatFileSize(totalSize)})`}
                  </span>
                </div>
                <div className="empty-doc-left">
                  <button
                    type="button"
                    className="upload-doc-trigger-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                  >
                    <IconUpload size={13} />
                    <span>{isEn ? 'Add Images' : 'Tambah Gambar'}</span>
                  </button>
                  <button
                    type="button"
                    className="sample-doc-trigger-btn is-danger-subtle"
                    onClick={handleClearAll}
                    disabled={isBusy}
                  >
                    <IconTrash size={13} />
                    <span>{isEn ? 'Clear All' : 'Bersihkan Semua'}</span>
                  </button>
                </div>
              </div>

              <ul
                className="pdf-file-list"
                aria-label={
                  isEn
                    ? 'List of images to be converted to PDF'
                    : 'Daftar gambar yang akan diubah ke PDF'
                }
              >
                {imageItems.map((item, idx) => (
                  <li key={item.id} className="pdf-file-item">
                    <div className="pdf-file-item-left">
                      <span
                        className="pdf-file-order-badge"
                        aria-label={isEn ? `Page ${idx + 1}` : `Halaman ${idx + 1}`}
                      >
                        {idx + 1}
                      </span>
                      <span className="img-pdf-thumb-box">
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="img-pdf-thumb"
                        />
                      </span>
                      <div className="pdf-file-meta">
                        <strong className="pdf-file-name" title={item.name}>
                          {truncateFileName(item.name, 36)}
                        </strong>
                        <div className="pdf-file-submeta">
                          <span className="active-doc-tag">{item.formatLabel}</span>
                          <span className="pdf-file-size">
                            {item.width} × {item.height} px • {formatFileSize(item.size)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pdf-file-item-actions">
                      <button
                        type="button"
                        className="pdf-order-btn"
                        onClick={() => handleMoveItem(idx, -1)}
                        disabled={idx === 0 || isBusy}
                        title={isEn ? 'Move up' : 'Geser ke atas'}
                        aria-label={isEn ? `Move ${item.name} up` : `Geser ${item.name} ke atas`}
                      >
                        <IconArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="pdf-order-btn"
                        onClick={() => handleMoveItem(idx, 1)}
                        disabled={idx === imageItems.length - 1 || isBusy}
                        title={isEn ? 'Move down' : 'Geser ke bawah'}
                        aria-label={isEn ? `Move ${item.name} down` : `Geser ${item.name} ke bawah`}
                      >
                        <IconArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="doc-remove-btn pdf-delete-btn"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isBusy}
                        title={isEn ? 'Remove image from list' : 'Hapus gambar dari daftar'}
                        aria-label={isEn ? `Remove ${item.name}` : `Hapus ${item.name}`}
                      >
                        <IconClose size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="img-pdf-settings-bar">
              <div className="img-pdf-setting-group">
                <span className="img-pdf-setting-label">
                  {isEn ? 'Page Size' : 'Ukuran Halaman'}
                </span>
                <div
                  className="img-pdf-pill-group"
                  role="radiogroup"
                  aria-label={isEn ? 'Page Size' : 'Ukuran Halaman'}
                >
                  {[
                    { id: 'a4', label: 'A4' },
                    { id: 'fit', label: isEn ? 'Fit Image' : 'Sesuai Gambar' },
                    { id: 'letter', label: 'Letter' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={pageSize === opt.id}
                      className={`img-pdf-pill-btn ${pageSize === opt.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setPageSize(opt.id)
                        setConvertedResult(null)
                      }}
                      disabled={isBusy}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {pageSize !== 'fit' && (
                <div className="img-pdf-setting-group">
                  <span className="img-pdf-setting-label">
                    {isEn ? 'Orientation' : 'Orientasi'}
                  </span>
                  <div
                    className="img-pdf-pill-group"
                    role="radiogroup"
                    aria-label={isEn ? 'Page Orientation' : 'Orientasi Halaman'}
                  >
                    {[
                      { id: 'auto', label: isEn ? 'Auto' : 'Otomatis' },
                      { id: 'portrait', label: isEn ? 'Portrait' : 'Potret' },
                      { id: 'landscape', label: isEn ? 'Landscape' : 'Lanskap' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={orientation === opt.id}
                        className={`img-pdf-pill-btn ${orientation === opt.id ? 'is-active' : ''}`}
                        onClick={() => {
                          setOrientation(opt.id)
                          setConvertedResult(null)
                        }}
                        disabled={isBusy}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="img-pdf-setting-group">
                <span className="img-pdf-setting-label">
                  {isEn ? 'Margin' : 'Tepi Margin'}
                </span>
                <div
                  className="img-pdf-pill-group"
                  role="radiogroup"
                  aria-label={isEn ? 'Page Margin' : 'Tepi Margin'}
                >
                  {[
                    { id: 'none', label: isEn ? 'No Margin' : 'Tanpa Tepi' },
                    { id: 'small', label: isEn ? 'Small' : 'Kecil' },
                    { id: 'normal', label: isEn ? 'Normal' : 'Normal' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={margin === opt.id}
                      className={`img-pdf-pill-btn ${margin === opt.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setMargin(opt.id)
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

              <button
                type="button"
                className="clean-submit-btn pdf-submit-btn"
                onClick={handleConvertNow}
                disabled={isBusy || imageItems.length < 1}
              >
                <span>
                  {isConverting
                    ? isEn
                      ? 'Converting to PDF...'
                      : 'Mengubah ke PDF...'
                    : isEn
                      ? 'Convert to PDF Now'
                      : 'Ubah ke PDF Sekarang'}
                </span>
                <span className="submit-arrow-circle">
                  <IconArrowUpRight size={16} />
                </span>
              </button>
            </div>
          </>
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
                (isEn ? 'Processing images to PDF...' : 'Memproses gambar menjadi PDF...')}
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
                    {isEn ? 'Completed & Auto-Downloaded' : 'Selesai & Otomatis Diunduh'}
                  </span>
                </span>
                <span className="clean-result-info">
                  <strong>
                    {convertedResult.fileCount} {isEn ? 'images' : 'gambar'}
                  </strong>{' '}
                  ({convertedResult.totalPages} {isEn ? 'pages' : 'halaman'}) •{' '}
                  {formatFileSize(convertedResult.size)} • {convertedResult.timestamp}
                </span>
              </div>

              <div className="clean-result-controls">
                <button
                  type="button"
                  className="clean-action-btn primary"
                  onClick={() =>
                    triggerBrowserDownload(
                      convertedResult.pdfBytes,
                      convertedResult.fileName,
                      'application/pdf'
                    )
                  }
                >
                  <IconDownload size={14} />
                  <span>{isEn ? 'Re-download PDF' : 'Unduh Ulang PDF'}</span>
                </button>
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
                  PDF document <strong>{convertedResult.fileName}</strong> has been created from{' '}
                  <strong>{convertedResult.fileCount} images</strong> ({convertedResult.totalPages}{' '}
                  pages) and downloaded to your device.
                </>
              ) : (
                <>
                  Dokumen PDF <strong>{convertedResult.fileName}</strong> berhasil disusun dari{' '}
                  <strong>{convertedResult.fileCount} gambar</strong> ({convertedResult.totalPages}{' '}
                  halaman) dan telah diunduh ke perangkatmu.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
