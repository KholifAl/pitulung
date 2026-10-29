import { useState, useRef } from 'react'
import {
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconCompressPdf,
  IconDownload,
  IconFileText,
  IconPlus,
  IconShield,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import {
  compressPdfFiles,
  estimatePdfCompression,
  formatFileSize,
  inspectPdfFile,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'

export default function CompressPdfPage() {
  const [pdfItems, setPdfItems] = useState([])
  const [sliderValue, setSliderValue] = useState(50) // 0: Kualitas Tinggi, 50: Seimbang (Default), 100: Kualitas Rendah
  const [stripMetadata, setStripMetadata] = useState(true)
  const [grayscaleImages, setGrayscaleImages] = useState(false)

  const [isDragging, setIsDragging] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [compressResult, setCompressResult] = useState(null)

  const fileInputRef = useRef(null)
  const resultRef = useRef(null)

  const handleAddFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    setErrorMsg('')
    setIsInspecting(true)
    setProcessStep('Membaca berkas PDF & menganalisis ukuran halaman...')

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
      setCompressResult(null)
    }

    if (errors.length > 0) {
      setErrorMsg(errors.join(' '))
    }

    setIsInspecting(false)
    setProcessStep('')
  }

  const handleRemoveItem = (id) => {
    setPdfItems((prev) => prev.filter((item) => item.id !== id))
    setCompressResult(null)
    setErrorMsg('')
  }

  const handleClearAll = () => {
    setPdfItems([])
    setSliderValue(50)
    setCompressResult(null)
    setErrorMsg('')
  }

  const handleCompressNow = async () => {
    if (pdfItems.length === 0) {
      setErrorMsg('Pilih minimal 1 berkas PDF terlebih dahulu untuk dikompres.')
      return
    }

    setErrorMsg('')
    setIsCompressing(true)
    setProcessStep('Mengoptimalkan struktur & mengompres berkas PDF di browsermu...')

    try {
      const res = await compressPdfFiles(
        pdfItems,
        {
          sliderValue,
          stripMetadata,
          grayscaleImages,
        },
        (step) => setProcessStep(step)
      )

      if (res.fileCount === 1 && res.primaryFile) {
        triggerBrowserDownload(res.primaryFile.bytes, res.primaryFile.name, 'application/pdf')
      } else if (res.zipBlob && res.zipFileName) {
        triggerBrowserDownload(res.zipBlob, res.zipFileName, 'application/zip')
      }

      setCompressResult({
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
      setErrorMsg(err.message || 'Gagal mengompres berkas PDF.')
    } finally {
      setIsCompressing(false)
      setProcessStep('')
    }
  }

  const totalPages = pdfItems.reduce((acc, item) => acc + (item.pageCount || 0), 0)
  const totalSize = pdfItems.reduce((acc, item) => acc + (item.size || 0), 0)
  const isBusy = isInspecting || isCompressing

  const estimation = estimatePdfCompression(pdfItems, {
    sliderValue,
    stripMetadata,
    grayscaleImages,
  })
  const sliderFillPercent = sliderValue

  return (
    <section className="clean-hero-section">
      <h1 className="editorial-hero-title">
        Kompres Ukuran PDF
      </h1>

      <p className="editorial-hero-subtitle">
        Perkecil ukuran berkas PDF
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
                <IconCompressPdf size={24} />
              </div>
              <div className="pdf-dropzone-text">
                <strong>Tarik &amp; lepas berkas PDF yang ingin dikompres ke sini</strong>
                <span>
                  atau klik untuk memilih satu maupun beberapa file PDF dari perangkatmu
                </span>
              </div>
              <span className="pdf-dropzone-pill">
                <IconPlus size={13} />
                <span>Pilih File PDF</span>
              </span>
            </div>

            <div className="pdf-action-bar">
              <div className="pdf-action-summary">
                <span className="pdf-privacy-badge">
                  <IconShield size={14} />
                  <span>100% Lokal di Browser</span>
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
                    Berkas Siap Dikompres ({pdfItems.length} file • {totalPages} Halaman •{' '}
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

              <ul className="pdf-file-list" aria-label="Daftar berkas PDF yang akan dikompres">
                {pdfItems.map((item, idx) => (
                  <li key={item.id} className="pdf-file-item">
                    <div className="pdf-file-item-left">
                      <span className="pdf-file-order-badge" aria-label={`Berkas ${idx + 1}`}>
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
                          <span className="pdf-file-size">
                            Ukuran Asli: {formatFileSize(item.size)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pdf-file-item-actions">
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

            <div className="pdf-compress-settings-panel">
              <div className="pdf-slider-section">
                <div className="pdf-slider-head">
                  <label className="pdf-mode-label" htmlFor="pdf-compress-slider">
                    Pilih Tingkat Kompresi PDF:
                  </label>
                </div>

                <div className="pdf-slider-box">
                  <input
                    id="pdf-compress-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={sliderValue}
                    onChange={(e) => {
                      setSliderValue(Number(e.target.value))
                      setCompressResult(null)
                    }}
                    disabled={isBusy}
                    className="pdf-compress-range-input"
                    style={{ '--slider-fill': `${sliderFillPercent}%` }}
                    aria-label="Pilih Tingkat Kompresi PDF dari Kualitas Tinggi ke Kualitas Rendah"
                  />

                  <div className="pdf-slider-Scale-row">
                    <button
                      type="button"
                      className={`pdf-slider-tick-btn ${sliderValue < 34 ? 'is-active' : ''}`}
                      onClick={() => {
                        setSliderValue(0)
                        setCompressResult(null)
                      }}
                      disabled={isBusy}
                    >
                      Kualitas Tinggi
                    </button>
                    <button
                      type="button"
                      className={`pdf-slider-tick-btn ${
                        sliderValue >= 34 && sliderValue <= 66 ? 'is-active' : ''
                      }`}
                      onClick={() => {
                        setSliderValue(50)
                        setCompressResult(null)
                      }}
                      disabled={isBusy}
                    >
                      Seimbang
                    </button>
                    <button
                      type="button"
                      className={`pdf-slider-tick-btn ${sliderValue > 66 ? 'is-active' : ''}`}
                      onClick={() => {
                        setSliderValue(100)
                        setCompressResult(null)
                      }}
                      disabled={isBusy}
                    >
                      Kualitas Rendah
                    </button>
                  </div>
                </div>
              </div>

              <div className="pdf-compress-options-row">
                <span className="pdf-mode-label">Opsi Optimasi Tambahan:</span>
                <div className="pdf-compress-toggles" role="group" aria-label="Opsi optimasi PDF">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={stripMetadata}
                    className={`pdf-compress-toggle-chip ${stripMetadata ? 'is-checked' : ''}`}
                    onClick={() => {
                      setStripMetadata((prev) => !prev)
                      setCompressResult(null)
                    }}
                    disabled={isBusy}
                  >
                    <span className="pct-left">
                      <span className="pct-check-box" aria-hidden="true">
                        {stripMetadata && <IconCheck size={11} />}
                      </span>
                      <strong>Hapus Objek Tak Terpakai</strong>
                    </span>
                    <span className="pct-saving-tag">
                      ~ -{formatFileSize(estimation.unusedSavedBytes)}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={grayscaleImages}
                    className={`pdf-compress-toggle-chip ${grayscaleImages ? 'is-checked' : ''}`}
                    onClick={() => {
                      setGrayscaleImages((prev) => !prev)
                      setCompressResult(null)
                    }}
                    disabled={isBusy}
                  >
                    <span className="pct-left">
                      <span className="pct-check-box" aria-hidden="true">
                        {grayscaleImages && <IconCheck size={11} />}
                      </span>
                      <strong>Hitam-Putih (Grayscale)</strong>
                    </span>
                    <span className="pct-saving-tag">
                      ~ -{formatFileSize(estimation.grayscaleSavedBytes)}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pdf-total-estimate-bar">
              <div className="pteb-left">
                <span className="pteb-label">Estimasi Total Ukuran Akhir:</span>
                <div className="pteb-values">
                  <span className="pteb-orig">{formatFileSize(estimation.totalOriginalSize)}</span>
                  <span className="pteb-arrow" aria-hidden="true">&rarr;</span>
                  <strong className="pteb-final">~{formatFileSize(estimation.estimatedFinalSize)}</strong>
                  <span className="pdf-saved-pill">
                    Berkurang ~{formatFileSize(estimation.totalSavedBytes)} (-{estimation.estimatedSavedPercent}%)
                  </span>
                </div>
              </div>
              <span className="pdf-privacy-badge">
                <IconShield size={14} />
                <span>100% Lokal di Browser</span>
              </span>
            </div>

            <div className="pdf-action-bar pdf-compress-submit-row">
              <button
                type="button"
                className="clean-submit-btn pdf-submit-btn pdf-compress-full-btn"
                onClick={handleCompressNow}
                disabled={isBusy || pdfItems.length === 0}
              >
                <span>
                  {isCompressing
                    ? 'Mengompres PDF...'
                    : pdfItems.length > 1
                      ? `Kompres ${pdfItems.length} PDF Sekarang`
                      : 'Kompres PDF Sekarang'}
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
            <span>{processStep || 'Memproses kompresi dokumen PDF...'}</span>
          </div>
        )}

        {compressResult && !isBusy && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>Selesai &amp; Otomatis Diunduh</span>
                </span>
                <span className="clean-result-info">
                  <strong>{formatFileSize(compressResult.totalOriginalSize)}</strong> &rarr;{' '}
                  <strong>{formatFileSize(compressResult.totalCompressedSize)}</strong> •{' '}
                  {compressResult.totalSavedBytes > 0 ? (
                    <span className="pdf-saved-pill">
                      Hemat {compressResult.totalSavedPercent}% (
                      {formatFileSize(compressResult.totalSavedBytes)})
                    </span>
                  ) : (
                    <span className="pdf-saved-pill is-neutral">Ukuran Sudah Optimal</span>
                  )}{' '}
                  • {compressResult.timestamp}
                </span>
              </div>

              <div className="clean-result-controls">
                {compressResult.fileCount === 1 && compressResult.primaryFile && (
                  <button
                    type="button"
                    className="clean-action-btn primary"
                    onClick={() =>
                      triggerBrowserDownload(
                        compressResult.primaryFile.bytes,
                        compressResult.primaryFile.name,
                        'application/pdf'
                      )
                    }
                  >
                    <IconDownload size={14} />
                    <span>Unduh Ulang PDF</span>
                  </button>
                )}

                {compressResult.zipBlob && compressResult.zipFileName && (
                  <button
                    type="button"
                    className="clean-action-btn primary"
                    onClick={() =>
                      triggerBrowserDownload(
                        compressResult.zipBlob,
                        compressResult.zipFileName,
                        'application/zip'
                      )
                    }
                  >
                    <IconDownload size={14} />
                    <span>Unduh Semua (.zip)</span>
                  </button>
                )}

                <button
                  type="button"
                  className="clean-close-result"
                  onClick={() => setCompressResult(null)}
                  title="Tutup"
                  aria-label="Tutup"
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>

            <p className="clean-result-summary">
              {compressResult.fileCount === 1 && compressResult.primaryFile ? (
                compressResult.totalSavedBytes > 0 ? (
                  <>
                    Berkas <strong>{compressResult.primaryFile.name}</strong> berhasil dikompres dari{' '}
                    <strong>{formatFileSize(compressResult.totalOriginalSize)}</strong> menjadi{' '}
                    <strong>{formatFileSize(compressResult.totalCompressedSize)}</strong> (berkurang{' '}
                    <strong>{compressResult.totalSavedPercent}%</strong>).
                  </>
                ) : (
                  <>
                    Berkas <strong>{compressResult.primaryFile.name}</strong> sudah berada pada ukuran
                    paling efisien (<strong>{formatFileSize(compressResult.totalCompressedSize)}</strong>)
                    dan siap digunakan.
                  </>
                )
              ) : (
                <>
                  Berhasil mengompres <strong>{compressResult.fileCount} berkas PDF</strong> ({compressResult.totalPages}{' '}
                  halaman) dari total <strong>{formatFileSize(compressResult.totalOriginalSize)}</strong>{' '}
                  menjadi <strong>{formatFileSize(compressResult.totalCompressedSize)}</strong>.
                </>
              )}
            </p>

            {compressResult.files && compressResult.files.length > 1 && (
              <div className="pdf-split-files-grid">
                {compressResult.files.map((f) => (
                  <div key={f.id} className="pdf-split-output-item">
                    <div className="pdf-split-output-info">
                      <span className="pdf-split-badge">
                        {f.savedBytes > 0 ? `Hemat ${f.savedPercent}%` : 'Optimal'}
                      </span>
                      <strong className="pdf-split-filename" title={f.name}>
                        {truncateFileName(f.name, 26)}
                      </strong>
                      <span className="pdf-file-size">
                        {formatFileSize(f.originalSize)} &rarr; {formatFileSize(f.compressedSize)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="clean-action-btn"
                      onClick={() => triggerBrowserDownload(f.bytes, f.name, 'application/pdf')}
                    >
                      <IconDownload size={13} />
                      <span>Unduh</span>
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
