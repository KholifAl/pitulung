import { useState, useRef } from 'react'
import {
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconDownload,
  IconFileText,
  IconMergePdf,
  IconPlus,
  IconShield,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import {
  formatFileSize,
  inspectPdfFile,
  mergePdfFiles,
  renderPdfPagePreviewToDataUrl,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'
import { useLanguage } from '../i18n/LanguageContext'

export default function MergePdfPage() {
  const { lang } = useLanguage()
  const isEn = lang === 'en'
  const [pdfItems, setPdfItems] = useState([])
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [draggedId, setDraggedId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [mergedResult, setMergedResult] = useState(null)

  const fileInputRef = useRef(null)
  const resultRef = useRef(null)

  const handleAddFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    setErrorMsg('')
    setIsInspecting(true)
    setProcessStep(
      isEn
        ? 'Reading PDF files & rendering first-page previews...'
        : 'Membaca berkas PDF & menyiapkan pratinjau halaman pertama...'
    )

    const newItems = []
    const errors = []

    for (const file of files) {
      try {
        const info = await inspectPdfFile(file)
        let previewUrl = ''
        try {
          const preview = await renderPdfPagePreviewToDataUrl(file, 1, {
            maxDimension: 360,
            maxScale: 1.2,
            skipSinglePagePdf: true,
          })
          previewUrl = preview?.dataUrl || ''
        } catch {
          previewUrl = ''
        }
        newItems.push({ ...info, previewUrl })
      } catch (err) {
        errors.push(
          err.message ||
            (isEn ? `Failed to read "${file.name}".` : `Gagal membaca "${file.name}".`)
        )
      }
    }

    if (newItems.length > 0) {
      setPdfItems((prev) => [...prev, ...newItems])
      setMergedResult(null)
    }

    if (errors.length > 0) {
      setErrorMsg(errors.join(' '))
    }

    setIsInspecting(false)
    setProcessStep('')
  }

  const reorderItems = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    setPdfItems((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(fromIndex, 1)
      copy.splice(toIndex, 0, moved)
      return copy
    })
    setMergedResult(null)
  }

  const handleCardDragStart = (e, id) => {
    if (isBusy) return
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      if (typeof e.dataTransfer.setDragImage === 'function' && e.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect()
        e.dataTransfer.setDragImage(
          e.currentTarget,
          Math.round(rect.width / 2),
          Math.min(48, Math.round(rect.height / 3))
        )
      }
    }
    requestAnimationFrame(() => {
      setDraggedId(id)
      setDropTarget(null)
    })
  }

  const handleCardDragOver = (e, targetId) => {
    if (!draggedId || draggedId === targetId) return
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const position = e.clientX > rect.left + rect.width / 2 ? 'after' : 'before'
    if (!dropTarget || dropTarget.id !== targetId || dropTarget.position !== position) {
      setDropTarget({ id: targetId, position })
    }
  }

  const handleCardDrop = (e, targetId) => {
    if (!draggedId) return
    e.preventDefault()
    e.stopPropagation()
    if (draggedId !== targetId) {
      const fromIndex = pdfItems.findIndex((item) => item.id === draggedId)
      const targetIndex = pdfItems.findIndex((item) => item.id === targetId)
      if (fromIndex !== -1 && targetIndex !== -1) {
        const rect = e.currentTarget.getBoundingClientRect()
        const position =
          dropTarget && dropTarget.id === targetId
            ? dropTarget.position
            : e.clientX > rect.left + rect.width / 2
              ? 'after'
              : 'before'
        let insertAt = position === 'after' ? targetIndex + 1 : targetIndex
        if (fromIndex < insertAt) {
          insertAt -= 1
        }
        reorderItems(fromIndex, insertAt)
      }
    }
    setDraggedId(null)
    setDropTarget(null)
  }

  const handleCardDragEnd = () => {
    setDraggedId(null)
    setDropTarget(null)
  }

  const handleCardKeyDown = (e, idx) => {
    if (isBusy) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault()
        reorderItems(idx, idx - 1)
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (idx < pdfItems.length - 1) {
        e.preventDefault()
        reorderItems(idx, idx + 1)
      }
    }
  }

  const handleRemoveItem = (id) => {
    setPdfItems((prev) => prev.filter((item) => item.id !== id))
    setMergedResult(null)
    setErrorMsg('')
  }

  const handleClearAll = () => {
    setPdfItems([])
    setMergedResult(null)
    setErrorMsg('')
  }

  const handleMergeNow = async () => {
    if (pdfItems.length < 2) {
      setErrorMsg(
        isEn
          ? 'Please upload at least 2 PDF files first to merge them.'
          : 'Unggah minimal 2 berkas PDF terlebih dahulu untuk digabungkan.'
      )
      return
    }

    setErrorMsg('')
    setIsMerging(true)
    setProcessStep(
      isEn
        ? 'Merging PDF documents directly in your browser...'
        : 'Menggabungkan dokumen PDF langsung di browsermu...'
    )

    try {
      const res = await mergePdfFiles(pdfItems, (step) => setProcessStep(step))
      triggerBrowserDownload(res.pdfBytes, res.fileName, 'application/pdf')

      setMergedResult({
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
        err.message || (isEn ? 'Failed to merge PDF files.' : 'Gagal menggabungkan berkas PDF.')
      )
    } finally {
      setIsMerging(false)
      setProcessStep('')
    }
  }

  const totalPages = pdfItems.reduce((acc, item) => acc + (item.pageCount || 0), 0)
  const totalSize = pdfItems.reduce((acc, item) => acc + (item.size || 0), 0)
  const isBusy = isInspecting || isMerging

  return (
    <section className="clean-hero-section">
      <h1 className="editorial-hero-title">
        {isEn ? 'Merge Multiple PDFs' : 'Gabung Beberapa PDF'}
      </h1>
      <p className="editorial-hero-subtitle">
        {isEn
          ? 'Combine multiple PDF documents into one file'
          : 'Gabung beberapa dokumen PDF jadi satu'}
      </p>

      <div
        className={`clean-workspace-card ${isDraggingFiles ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          if (draggedId) {
            e.preventDefault()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
            return
          }
          e.preventDefault()
          setIsDraggingFiles(true)
        }}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={(e) => {
          if (draggedId) {
            e.preventDefault()
            setDraggedId(null)
            setDropTarget(null)
            return
          }
          e.preventDefault()
          setIsDraggingFiles(false)
          if (e.dataTransfer?.files?.length) {
            handleAddFiles(e.dataTransfer.files)
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) {
              handleAddFiles(e.target.files)
            }
            e.target.value = ''
          }}
        />

        {pdfItems.length === 0 ? (
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
                <IconMergePdf size={24} />
              </div>
              <div className="pdf-dropzone-text">
                <strong>
                  {isEn
                    ? 'Drag & drop PDF file here'
                    : 'Tarik & lepas berkas PDF ke sini'}
                </strong>
                <span>
                  {isEn
                    ? 'or click to select files from your device (minimum 2 PDF files)'
                    : 'atau klik untuk memilih berkas dari perangkatmu (minimal 2 file PDF)'}
                </span>
              </div>
              <span className="pdf-dropzone-pill">
                <IconPlus size={13} />
                <span>{isEn ? 'Select PDF Files' : 'Pilih File PDF'}</span>
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
                <div className="pdf-merge-head-info">
                  <span>
                    {isEn
                      ? `Merge Order (${pdfItems.length} files • ${totalPages} Pages • ${formatFileSize(totalSize)})`
                      : `Urutan Penggabungan (${formatFileSize(totalSize)})`}
                  </span>
                  <span className="pdf-file-list-hint">
                    {isEn
                      ? 'Drag cards to reorder'
                      : 'Seret kartu untuk mengubah urutan'}
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
                    <span>{isEn ? 'Add PDF Files' : 'Tambah File PDF'}</span>
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
                className="pdf-merge-grid"
                aria-label={
                  isEn
                    ? 'Draggable PDF cards to reorder before merging'
                    : 'Daftar kartu PDF yang dapat diseret untuk mengatur urutan'
                }
              >
                {pdfItems.map((item, idx) => {
                  const isDragged = draggedId === item.id
                  const isDropBefore =
                    dropTarget?.id === item.id &&
                    dropTarget?.position === 'before' &&
                    draggedId !== item.id
                  const isDropAfter =
                    dropTarget?.id === item.id &&
                    dropTarget?.position === 'after' &&
                    draggedId !== item.id
                  return (
                    <li
                      key={item.id}
                      className={`pdf-merge-card ${isDragged ? 'is-dragging-card' : ''} ${isDropBefore ? 'is-drop-before' : ''} ${isDropAfter ? 'is-drop-after' : ''}`}
                      draggable={!isBusy}
                      tabIndex={0}
                      onDragStart={(e) => handleCardDragStart(e, item.id)}
                      onDragOver={(e) => handleCardDragOver(e, item.id)}
                      onDrop={(e) => handleCardDrop(e, item.id)}
                      onDragEnd={handleCardDragEnd}
                      onKeyDown={(e) => handleCardKeyDown(e, idx)}
                      aria-label={
                        isEn
                          ? `Position ${idx + 1}: ${item.name}. Use arrow keys or drag to reorder.`
                          : `Urutan ${idx + 1}: ${item.name}. Seret atau gunakan tombol panah keyboard untuk mengatur posisi.`
                      }
                    >
                      <div className="pdf-merge-card-top">
                        <span className="pdf-file-order-badge">{idx + 1}</span>
                        <span className="active-doc-tag">
                          {item.pageCount} {isEn ? 'Pgs' : 'Hal'}
                        </span>
                        <button
                          type="button"
                          className="doc-remove-btn pdf-delete-btn pdf-merge-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveItem(item.id)
                          }}
                          disabled={isBusy}
                          title={isEn ? 'Remove file' : 'Hapus file'}
                          aria-label={isEn ? `Remove ${item.name}` : `Hapus ${item.name}`}
                        >
                          <IconClose size={12} />
                        </button>
                      </div>

                      <div className="pdf-merge-preview-frame">
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={
                              isEn
                                ? `First page preview of ${item.name}`
                                : `Pratinjau halaman pertama ${item.name}`
                            }
                            className="pdf-merge-preview-img"
                            draggable={false}
                          />
                        ) : (
                          <div className="pdf-merge-preview-fallback">
                            <IconFileText size={28} />
                          </div>
                        )}
                      </div>

                      <div className="pdf-merge-card-meta">
                        <strong className="pdf-merge-card-name" title={item.name}>
                          {truncateFileName(item.name, 22)}
                        </strong>
                        <span className="pdf-file-size">{formatFileSize(item.size)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
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
                onClick={handleMergeNow}
                disabled={isBusy || pdfItems.length < 2}
              >
                <span>
                  {isMerging
                    ? isEn
                      ? 'Merging PDFs...'
                      : 'Menggabungkan PDF...'
                    : isEn
                      ? 'Merge PDFs Now'
                      : 'Gabung PDF Sekarang'}
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
              {processStep || (isEn ? 'Processing PDF documents...' : 'Memproses dokumen PDF...')}
            </span>
          </div>
        )}

        {mergedResult && !isBusy && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>{isEn ? 'Completed & Auto-Downloaded' : 'Selesai & Otomatis Diunduh'}</span>
                </span>
                <span className="clean-result-info">
                  <strong>
                    {mergedResult.fileCount} {isEn ? 'files' : 'berkas'}
                  </strong>{' '}
                  ({mergedResult.totalPages} {isEn ? 'pages' : 'halaman'}) •{' '}
                  {formatFileSize(mergedResult.size)} • {mergedResult.timestamp}
                </span>
              </div>

              <div className="clean-result-controls">
                <button
                  type="button"
                  className="clean-action-btn primary"
                  onClick={() =>
                    triggerBrowserDownload(
                      mergedResult.pdfBytes,
                      mergedResult.fileName,
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
                  onClick={() => setMergedResult(null)}
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
                  Merged file <strong>{mergedResult.fileName}</strong> has been created with a total of{' '}
                  <strong>{mergedResult.totalPages} pages</strong> and downloaded to your device.
                </>
              ) : (
                <>
                  Berkas gabungan <strong>{mergedResult.fileName}</strong> berhasil disatukan dengan total{' '}
                  <strong>{mergedResult.totalPages} halaman</strong> dan telah diunduh ke perangkatmu.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
