import { useState, useRef } from 'react'
import {
  IconArrowUpRight,
  IconArrowUp,
  IconArrowDown,
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
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'

export default function MergePdfPage() {
  const [pdfItems, setPdfItems] = useState([])
  const [isDragging, setIsDragging] = useState(false)
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
    setProcessStep('Membaca berkas PDF & menghitung jumlah halaman...')

    const newItems = []
    const errors = []

    for (const file of files) {
      try {
        const info = await inspectPdfFile(file)
        newItems.push(info)
      } catch (err) {
        errors.push(err.message || `Gagal membaca "${file.name}".`)
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

  const handleMoveItem = (index, direction) => {
    setPdfItems((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(targetIndex, 0, moved)
      return copy
    })
    setMergedResult(null)
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
      setErrorMsg('Unggah minimal 2 berkas PDF terlebih dahulu untuk digabungkan.')
      return
    }

    setErrorMsg('')
    setIsMerging(true)
    setProcessStep('Menggabungkan dokumen PDF langsung di browsermu...')

    try {
      const res = await mergePdfFiles(pdfItems, (step) => setProcessStep(step))
      triggerBrowserDownload(res.pdfBytes, res.fileName, 'application/pdf')

      setMergedResult({
        ...res,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 80)
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menggabungkan berkas PDF.')
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
        Gabung Beberapa PDF
      </h1>

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

        {/* DROPZONE ATAU DAFTAR BERKAS PDF */}
        {pdfItems.length === 0 ? (
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
              <strong>Tarik &amp; lepas beberapa file PDF ke sini</strong>
              <span>
                atau klik untuk memilih berkas dari perangkatmu (minimal 2 file PDF)
              </span>
            </div>
            <span className="pdf-dropzone-pill">
              <IconPlus size={13} />
              <span>Pilih File PDF</span>
            </span>
          </div>
        ) : (
          <div className="pdf-file-list-container">
            <div className="pdf-file-list-head">
              <div>
                <span>
                  Urutan Penggabungan ({pdfItems.length} file • {totalPages} Halaman •{' '}
                  {formatFileSize(totalSize)})
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
                  <span>Tambah File PDF</span>
                </button>
                <button
                  type="button"
                  className="sample-doc-trigger-btn is-danger-subtle"
                  onClick={handleClearAll}
                  disabled={isBusy}
                >
                  <IconTrash size={13} />
                  <span>Bersihkan Semua</span>
                </button>
              </div>
            </div>

            <ul className="pdf-file-list" aria-label="Daftar berkas PDF yang akan digabung">
              {pdfItems.map((item, idx) => (
                <li key={item.id} className="pdf-file-item">
                  <div className="pdf-file-item-left">
                    <span className="pdf-file-order-badge" aria-label={`Urutan ${idx + 1}`}>
                      {idx + 1}
                    </span>
                    <span className="active-doc-icon pdf-item-icon">
                      <IconFileText size={16} />
                    </span>
                    <div className="pdf-file-meta">
                      <strong className="pdf-file-name" title={item.name}>
                        {truncateFileName(item.name, 38)}
                      </strong>
                      <div className="pdf-file-submeta">
                        <span className="active-doc-tag">
                          {item.pageCount} Halaman
                        </span>
                        <span className="pdf-file-size">{formatFileSize(item.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pdf-file-item-actions">
                    <button
                      type="button"
                      className="pdf-order-btn"
                      onClick={() => handleMoveItem(idx, -1)}
                      disabled={idx === 0 || isBusy}
                      title="Geser ke atas"
                      aria-label={`Geser ${item.name} ke atas`}
                    >
                      <IconArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="pdf-order-btn"
                      onClick={() => handleMoveItem(idx, 1)}
                      disabled={idx === pdfItems.length - 1 || isBusy}
                      title="Geser ke bawah"
                      aria-label={`Geser ${item.name} ke bawah`}
                    >
                      <IconArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="doc-remove-btn pdf-delete-btn"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isBusy}
                      title="Hapus file dari daftar"
                      aria-label={`Hapus ${item.name}`}
                    >
                      <IconClose size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PRIMARY ACTION ROW */}
        <div className="pdf-action-bar">
          <div className="pdf-action-summary">
            <span className="pdf-privacy-badge">
              <IconShield size={14} />
              <span>100% Lokal di Browser • Privasi Terjaga</span>
            </span>
          </div>

          <button
            type="button"
            className="clean-submit-btn pdf-submit-btn"
            onClick={handleMergeNow}
            disabled={isBusy || pdfItems.length < 2}
          >
            <span>
              {isMerging ? 'Menggabungkan PDF...' : 'Gabung PDF Sekarang'}
            </span>
            <span className="submit-arrow-circle">
              <IconArrowUpRight size={16} />
            </span>
          </button>
        </div>

        {errorMsg && (
          <div className="clean-error-banner" role="alert">
            {errorMsg}
          </div>
        )}

        {isBusy && (
          <div className="clean-loading-bar" role="status">
            <div className="clean-loader-pulse" />
            <span>{processStep || 'Memproses dokumen PDF...'}</span>
          </div>
        )}

        {/* RESULT PREVIEW & RE-DOWNLOAD */}
        {mergedResult && !isBusy && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>Selesai &amp; Otomatis Diunduh</span>
                </span>
                <span className="clean-result-info">
                  <strong>{mergedResult.fileCount} berkas</strong> ({mergedResult.totalPages} halaman) •{' '}
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
                  <span>Unduh Ulang PDF</span>
                </button>
                <button
                  type="button"
                  className="clean-close-result"
                  onClick={() => setMergedResult(null)}
                  title="Tutup"
                  aria-label="Tutup"
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>

            <p className="clean-result-summary">
              Berkas gabungan <strong>{mergedResult.fileName}</strong> berhasil disatukan dengan total{' '}
              <strong>{mergedResult.totalPages} halaman</strong> dan telah diunduh ke perangkatmu.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
