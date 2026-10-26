import { useState, useRef } from 'react'
import {
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconDownload,
  IconFileText,
  IconPlus,
  IconShield,
  IconSparkle,
  IconSplitPdf,
  IconUpload,
} from '../components/Icons'
import {
  formatFileSize,
  inspectPdfFile,
  parsePageRanges,
  splitPdfFile,
  triggerBrowserDownload,
  truncateFileName,
} from '../utils/pdfTools'

export default function SplitPdfPage() {
  const [pdfDocInfo, setPdfDocInfo] = useState(null)
  const [splitMode, setSplitMode] = useState('range') // 'range' (Opsi A) | 'all' (Opsi B)
  const [rangeInput, setRangeInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isSplitting, setIsSplitting] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [splitResult, setSplitResult] = useState(null)

  const fileInputRef = useRef(null)
  const rangeInputRef = useRef(null)
  const resultRef = useRef(null)

  const handleSelectPdfFile = async (file) => {
    if (!file) return
    setErrorMsg('')
    setIsInspecting(true)
    setProcessStep(`Membaca dokumen "${truncateFileName(file.name)}"...`)

    try {
      const info = await inspectPdfFile(file)
      setPdfDocInfo(info)
      setSplitResult(null)
      if (!rangeInput.trim()) {
        const defaultRange =
          info.pageCount >= 3
            ? `1-2, ${info.pageCount}`
            : info.pageCount === 2
              ? '1'
              : '1'
        setRangeInput(defaultRange)
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal membaca berkas PDF.')
    } finally {
      setIsInspecting(false)
      setProcessStep('')
    }
  }

  const handleSplitNow = async (e) => {
    if (e) e.preventDefault()
    if (!pdfDocInfo?.file) {
      setErrorMsg('Unggah 1 berkas PDF utama terlebih dahulu.')
      return
    }

    setErrorMsg('')
    setIsSplitting(true)
    setProcessStep('Memisahkan halaman PDF langsung di browsermu...')

    try {
      const res = await splitPdfFile(
        {
          file: pdfDocInfo.file,
          mode: splitMode,
          rangeInput,
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
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 80)
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memisahkan halaman PDF.')
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

  return (
    <section className="clean-hero-section">
      <div className="hero-top-meta">
        <span className="meta-pill-badge">
          <IconSparkle size={12} />
          <span>PISAH HALAMAN PDF</span>
        </span>
      </div>

      <h1 className="editorial-hero-title">
        Pisahkan halaman PDF sesuai kebutuhanmu
      </h1>

      <p className="editorial-hero-subtitle">
        Ambil halaman tertentu atau pecah berkas menjadi file terpisah tanpa ribet.
      </p>

      {/* CENTRAL WORKSPACE CARD — SPLIT PDF */}
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

        {/* DROPZONE ATAU BANNER BERKAS AKTIF */}
        {pdfDocInfo ? (
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
                      {pdfDocInfo.pageCount} Halaman
                    </span>
                    <span className="pdf-file-size">
                      {formatFileSize(pdfDocInfo.size)}
                    </span>
                    <span
                      className="active-doc-verified"
                      title="Siap Dipisah"
                      aria-label="Siap Dipisah"
                    >
                      <IconCheck size={12} />
                    </span>
                  </div>
                  <div className="active-doc-questions">
                    <span>Pilih cepat:</span>
                    <button
                      type="button"
                      className="doc-quick-chip"
                      onClick={() => {
                        setSplitMode('range')
                        setRangeInput('1')
                      }}
                    >
                      Halaman 1 Saja
                    </button>
                    {pdfDocInfo.pageCount >= 3 && (
                      <button
                        type="button"
                        className="doc-quick-chip"
                        onClick={() => {
                          setSplitMode('range')
                          setRangeInput(`1-2, ${pdfDocInfo.pageCount}`)
                        }}
                      >
                        Hal. 1-2 &amp; Terakhir ({pdfDocInfo.pageCount})
                      </button>
                    )}
                    <button
                      type="button"
                      className="doc-quick-chip"
                      onClick={() => setSplitMode('all')}
                    >
                      Semua Halaman ({pdfDocInfo.pageCount} File)
                    </button>
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
                  <span>Ganti</span>
                </button>
                <button
                  type="button"
                  className="doc-remove-btn"
                  onClick={() => {
                    setPdfDocInfo(null)
                    setSplitResult(null)
                    setErrorMsg('')
                  }}
                  disabled={isBusy}
                  title="Hapus dokumen"
                >
                  <IconClose size={12} />
                </button>
              </div>
            </div>
          </div>
        ) : (
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
              <strong>Tarik &amp; lepas 1 berkas PDF utama ke sini</strong>
              <span>atau klik untuk memilih dokumen PDF dari perangkatmu</span>
            </div>
            <span className="pdf-dropzone-pill">
              <IconPlus size={13} />
              <span>Pilih File PDF</span>
            </span>
          </div>
        )}

        {/* PILIHAN MODE PISAH (OPSI A & OPSI B) */}
        <div className="pdf-split-mode-section">
          <span className="pdf-mode-label">Pilih Mode Pemisahan Halaman:</span>
          <div className="pdf-split-mode-grid" role="radiogroup" aria-label="Mode pisah PDF">
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
                <span className="pdf-mode-tag">OPSI A</span>
                <span className="pdf-mode-radio-dot" />
              </div>
              <strong>Rentang Halaman Kustom</strong>
              <span>
                Ambil halaman tertentu sesuai urutan yang kamu ketik (misal: <code>1-3, 5, 8-10</code>).
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
                <span className="pdf-mode-tag">OPSI B</span>
                <span className="pdf-mode-radio-dot" />
              </div>
              <strong>Pisah Semua Halaman Terpisah</strong>
              <span>
                Pecah setiap halaman menjadi file PDF mandiri (bisa diunduh satuan atau bundel <code>.zip</code>).
              </span>
            </button>
          </div>
        </div>

        {/* FORM INPUT RENTANG & TOMBOL AKSI UTAMA */}
        <form className="pdf-split-action-form" onSubmit={handleSplitNow}>
          {splitMode === 'range' ? (
            <div className="clean-input-box pdf-range-input-box">
              <input
                ref={rangeInputRef}
                type="text"
                className="clean-text-input"
                placeholder={
                  pdfDocInfo
                    ? `Ketik rentang halaman (1 s/d ${pdfDocInfo.pageCount}), misal: 1-3, 5, 8-10`
                    : 'Ketik rentang halaman kustom (misal: 1-3, 5, 8-10)...'
                }
                value={rangeInput}
                onChange={(e) => {
                  setRangeInput(e.target.value)
                  setErrorMsg('')
                }}
                aria-label="Rentang Halaman Kustom"
              />
              {rangeInput && (
                <button
                  type="button"
                  className="clean-clear-btn"
                  onClick={() => {
                    setRangeInput('')
                    rangeInputRef.current?.focus()
                  }}
                  title="Bersihkan rentang"
                >
                  <IconClose size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="pdf-all-pages-summary-box">
              <IconSplitPdf size={16} />
              <span>
                {pdfDocInfo
                  ? `Seluruh ${pdfDocInfo.pageCount} halaman dari "${truncateFileName(pdfDocInfo.name, 26)}" akan dipecah menjadi ${pdfDocInfo.pageCount} file PDF terpisah.`
                  : 'Setiap halaman dalam dokumen akan dipecah menjadi file PDF masing-masing secara otomatis.'}
              </span>
            </div>
          )}

          <button
            type="submit"
            className="clean-submit-btn pdf-submit-btn"
            disabled={isBusy || !pdfDocInfo}
          >
            <span>
              {isSplitting ? 'Memisahkan PDF...' : 'Pisahkan PDF Sekarang'}
            </span>
            <span className="submit-arrow-circle">
              <IconArrowUpRight size={16} />
            </span>
          </button>
        </form>

        {/* INFO PREVIEW RENTANG HALAMAN REAL-TIME */}
        {pdfDocInfo && splitMode === 'range' && rangePreview && (
          <div
            className={`pdf-range-preview-hint ${
              rangePreview.error ? 'is-invalid' : 'is-valid'
            }`}
          >
            {rangePreview.error ? (
              <span>{rangePreview.error}</span>
            ) : (
              <span>
                Akan mengekstrak <strong>{rangePreview.pages.length} halaman</strong> (Halaman:{' '}
                {rangePreview.pages.join(', ')}) dari total {pdfDocInfo.pageCount} halaman.
              </span>
            )}
          </div>
        )}

        <div className="pdf-action-bar" style={{ marginTop: '14px' }}>
          <span className="pdf-privacy-badge">
            <IconShield size={14} />
            <span>100% Lokal di Browser • Tanpa Upload Server</span>
          </span>
        </div>

        {errorMsg && (
          <div className="clean-error-banner" role="alert">
            {errorMsg}
          </div>
        )}

        {isBusy && (
          <div className="clean-loading-bar" role="status">
            <div className="clean-loader-pulse" />
            <span>{processStep || 'Memproses pemisahan halaman PDF...'}</span>
          </div>
        )}

        {/* PANEL HASIL PEMISAHAN PDF (UNDUH SATUAN ATAU .ZIP) */}
        {splitResult && !isBusy && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>Selesai &amp; Siap Diunduh</span>
                </span>
                <span className="clean-result-info">
                  Sumber: <strong title={splitResult.sourceName}>{truncateFileName(splitResult.sourceName, 24)}</strong> •{' '}
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
                    <span>Unduh PDF Pilihan ({splitResult.extractedCount} Hal)</span>
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
                    <span>Unduh Semua (.zip)</span>
                  </button>
                )}

                <button
                  type="button"
                  className="clean-close-result"
                  onClick={() => setSplitResult(null)}
                  title="Tutup"
                  aria-label="Tutup"
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>

            <p className="clean-result-summary">
              {splitResult.mode === 'range' ? (
                <>
                  Berhasil mengekstrak <strong>{splitResult.extractedCount} halaman</strong> (Halaman{' '}
                  {splitResult.selectedPages.join(', ')}) menjadi berkas PDF baru.
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
