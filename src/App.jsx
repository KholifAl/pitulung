import { useState, useEffect, useRef } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from 'react-router-dom'
import logoImage from './assets/Logo_image.png'
import logoText from './assets/Logo-text.svg'
import {
  AI_PROVIDERS,
  DEFAULT_ENGINE_CONFIG,
  PITULUNG_TOOLS,
  SAMPLE_VERIFIED_DOC,
  checkEngineStatus,
  fetchProviderModels,
  getProviderMeta,
  migrateEngineConfig,
  processPitulungTask,
  readUploadedDocument,
} from './services/openclawClient'
import {
  MERCHANT_INFO,
  generateDynamicQRIS,
  createQRISDataUrl,
  formatRupiah,
} from './utils/qris'
import {
  IconArrowUpRight,
  IconArrowRight,
  IconCilok,
  IconSparkle,
  IconShield,
  IconTable,
  IconMessage,
  IconCheck,
  IconEdit,
  IconSettings,
  IconClose,
  IconFileText,
  IconUpload,
  IconCopy,
  IconDownload,
  IconMergePdf,
  IconSplitPdf,
  IconChevronDown,
  IconGlobe,
  IconMail,
  IconEye,
  IconEyeOff,
} from './components/Icons'
import { truncateFileName } from './utils/pdfTools'
import MergePdfPage from './pages/MergePdfPage'
import SplitPdfPage from './pages/SplitPdfPage'
import LegalPage, { LEGAL_PAGES_META, AboutPage } from './pages/LegalPage'
import './App.css'

function formatUiText(text = '') {
  // Pendekkan hanya nama file / kata tunggal tanpa spasi yang terlalu panjang agar tidak menabrak dinding kartu,
  // sedangkan isi kalimat & hasil asli tetap utuh.
  return String(text || '').replace(/\S{26,}/g, (token) => truncateFileName(token, 22))
}

const DOC_QUICK_QUESTIONS = [
  { label: 'Tabel RAB', query: 'Ekstrak seluruh rincian barang, kuantitas, harga satuan, dan subtotal di RAB menjadi tabel', format: 'Ekstrak Tabel Data (.csv / Excel)' },
  { label: 'Termin Bayar', query: 'Apa saja jadwal pengiriman dan syarat termin pembayarannya?', format: 'Tanya Jawab & Tabel Terverifikasi' },
  { label: 'Aturan & Denda', query: 'Berapa standar mutu kadar air dan aturan denda keterlambatannya?', format: 'Tanya Jawab & Tabel Terverifikasi' },
]

const MIN_CILOK_AMOUNT = 1000
const MAX_CILOK_AMOUNT = 5000000

const CILOK_NOMINALS = [
  { value: 1000, label: 'Rp 1.000' },
  { value: 2000, label: 'Rp 2.000' },
  { value: 5000, label: 'Rp 5.000' },
  { value: 10000, label: 'Rp 10.000' },
]

const FORMAT_OPTIONS = [
  { value: 'Tanya Jawab & Tabel Terverifikasi', label: 'Tanya & Tabel', note: 'Bukti Sumber' },
  { value: 'Ekstrak Tabel Data (.csv / Excel)', label: 'Tabel Excel (.csv)', note: 'Spreadsheet' },
  { value: 'Ringkasan & Poin Kunci', label: 'Ringkasan Poin', note: 'Intisari' },
  { value: 'JSON Terstruktur', label: 'Format JSON', note: 'Data API' },
]

const CONTACT_CATEGORIES = [
  { value: 'Pertanyaan Umum', label: 'Pertanyaan Umum', note: 'Bantuan' },
  { value: 'Saran & Masukan Fitur', label: 'Saran & Masukan Fitur', note: 'Ide Baru' },
  { value: 'Laporan Kendala / Bug', label: 'Laporan Kendala / Bug', note: 'Teknis' },
  { value: 'Kerja Sama & Lainnya', label: 'Kerja Sama & Lainnya', note: 'Kemitraan' },
]

const UI_LANGUAGE_OPTIONS = [
  { code: 'id', label: 'Bahasa Indonesia', badge: 'ID', available: true },
  { code: 'en', label: 'English (Segera)', badge: 'EN', available: false },
]

function getProtectedContactEmail() {
  // Dirakit secara dinamis di memori agar aman dari bot scraper HTML statis
  const userPart = ['kvgame', '99'].join('')
  const domainPart = ['gmail', 'com'].join('.')
  return `${userPart}@${domainPart}`
}

const NAV_TOOL_ROUTES = [
  {
    path: '/',
    label: 'Tanya & Ekstrak Data',
    shortDesc: 'Tanya PDF, Link Web & Rekap WA',
    badge: 'UTAMA',
    icon: IconFileText,
  },
  {
    path: '/merge-pdf',
    label: 'Gabung PDF (Merge)',
    shortDesc: 'Satukan beberapa PDF jadi satu',
    badge: 'PDF',
    icon: IconMergePdf,
  },
  {
    path: '/split-pdf',
    label: 'Pisah PDF (Split)',
    shortDesc: 'Ambil halaman atau pecah file PDF',
    badge: 'PDF',
    icon: IconSplitPdf,
  },
]

function CleanDropdown({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Pilih Opsi',
  size = 'default',
  ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen((prev) => !prev)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const currentIndex = options.findIndex((opt) => opt.value === value)
      const nextIndex =
        e.key === 'ArrowDown'
          ? (currentIndex + 1) % options.length
          : (currentIndex - 1 + options.length) % options.length
      if (options[nextIndex]) {
        onChange(options[nextIndex].value)
      }
    }
  }

  const selectedOption = options.find((opt) => opt.value === value)

  const handleSelectOption = (e, optValue) => {
    e.preventDefault()
    e.stopPropagation()
    onChange(optValue)
    setIsOpen(false)
  }

  return (
    <div
      ref={dropdownRef}
      className={`clean-dropdown-container size-${size} ${isOpen ? 'is-open' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        id={id}
        className="clean-dropdown-trigger"
        onClick={(e) => {
          e.preventDefault()
          setIsOpen((prev) => !prev)
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
      >
        <span className={`clean-dropdown-value ${!selectedOption?.value ? 'is-placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="clean-dropdown-caret" aria-hidden="true">
          <IconChevronDown size={14} />
        </span>
      </button>

      {isOpen && (
        <ul className="clean-dropdown-menu" role="listbox" aria-labelledby={id}>
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <li
                key={option.value || '__empty__'}
                role="option"
                aria-selected={isSelected}
                className={`clean-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
                onClick={(e) => handleSelectOption(e, option.value)}
              >
                <div className="cd-item-content">
                  <span className="cd-item-label">{option.label}</span>
                </div>
                {isSelected && (
                  <span className="cd-item-check" aria-hidden="true">
                    <IconCheck size={14} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function PitulungAppShell() {
  const navigate = useNavigate()
  const location = useLocation()

  const [activeToolId, setActiveToolId] = useState('dokumen')
  const [inputValue, setInputValue] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('')
  const [uploadedDoc, setUploadedDoc] = useState(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStep, setProcessStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [resultData, setResultData] = useState(null)
  const [activeResultTab, setActiveResultTab] = useState('table')
  const [copiedToast, setCopiedToast] = useState(false)

  const [quotaStatus, setQuotaStatus] = useState('safe')

  const [apiConfig, setApiConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pitulung_engine_config') || '{}')
      delete saved.apiKey
      delete saved.mode
      const sessionKey = sessionStorage.getItem('pitulung_user_api_key') || ''
      return migrateEngineConfig({ ...DEFAULT_ENGINE_CONFIG, ...saved, apiKey: sessionKey })
    } catch {
      return DEFAULT_ENGINE_CONFIG
    }
  })
  const [engineOnline, setEngineOnline] = useState(false)
  const [serverHasKey, setServerHasKey] = useState(false)
  const [liveModelsByProvider, setLiveModelsByProvider] = useState({})
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [qrisModalOpen, setQrisModalOpen] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactCategory, setContactCategory] = useState('Pertanyaan Umum')
  const [contactName, setContactName] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactAgreed, setContactAgreed] = useState(false)
  const [contactEmailCopied, setContactEmailCopied] = useState(false)
  const [uiLang, setUiLang] = useState('id')
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [selectedCilokAmount, setSelectedCilokAmount] = useState(5000)
  const [isCustomCilok, setIsCustomCilok] = useState(false)
  const [customCilokInput, setCustomCilokInput] = useState('')
  const [qrisDataUrl, setQrisDataUrl] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)
  const [navMenuOpen, setNavMenuOpen] = useState(false)

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const resultRef = useRef(null)
  const navMenuRef = useRef(null)
  const langMenuRef = useRef(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  useEffect(() => {
    function handleOutsideNavClick(e) {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target)) {
        setNavMenuOpen(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setLangMenuOpen(false)
      }
    }
    if (navMenuOpen || langMenuOpen) {
      document.addEventListener('mousedown', handleOutsideNavClick)
      document.addEventListener('touchstart', handleOutsideNavClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideNavClick)
      document.removeEventListener('touchstart', handleOutsideNavClick)
    }
  }, [navMenuOpen, langMenuOpen])

  useEffect(() => {
    let active = true
    const dynamicPayload = generateDynamicQRIS(selectedCilokAmount)
    createQRISDataUrl(dynamicPayload, 380).then((url) => {
      if (active) setQrisDataUrl(url)
    })
    return () => {
      active = false
    }
  }, [selectedCilokAmount])

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 36)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let mounted = true
    checkEngineStatus(apiConfig).then((res) => {
      if (mounted) {
        setEngineOnline(res.online)
        setServerHasKey(res.serverKey)
        if (res.quotaStatus) setQuotaStatus(res.quotaStatus)
      }
    })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig.provider, apiConfig.baseUrl, Boolean(apiConfig.apiKey)])

  useEffect(() => {
    if (!configModalOpen || apiConfig.provider === 'local') return undefined
    let mounted = true
    const currentProvider = apiConfig.provider
    fetchProviderModels(apiConfig).then((res) => {
      if (mounted && Array.isArray(res.models) && res.models.length > 0) {
        setLiveModelsByProvider((prev) => ({ ...prev, [currentProvider]: res.models }))
      }
    })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configModalOpen, apiConfig.provider, apiConfig.baseUrl, Boolean(apiConfig.apiKey)])

  const handleFileUpload = async (file) => {
    if (!file) return
    setErrorMsg('')
    setIsProcessing(true)
    setProcessStep(`Membaca & memverifikasi dokumen "${truncateFileName(file.name)}"...`)
    try {
      const doc = await readUploadedDocument(file)
      setUploadedDoc(doc)
      setActiveToolId('dokumen')
      const defaultQuery =
        inputValue.trim() ||
        'Ekstrak seluruh data penting dan tabel dari dokumen ini beserta sumbernya'
      const fmt = selectedFormat || 'Tanya Jawab & Tabel Terverifikasi'
      setInputValue(defaultQuery)
      setSelectedFormat(fmt)
      await executeTask('dokumen', defaultQuery, fmt, doc)
    } catch (err) {
      setErrorMsg(err.message || 'Gagal membaca dokumen yang diunggah.')
      setIsProcessing(false)
      setProcessStep('')
    }
  }

  const handleLoadSampleDoc = () => {
    setUploadedDoc(SAMPLE_VERIFIED_DOC)
    setActiveToolId('dokumen')
    const sampleQuery = PITULUNG_TOOLS[0].sampleInput
    const fmt = 'Tanya Jawab & Tabel Terverifikasi'
    setInputValue(sampleQuery)
    setSelectedFormat(fmt)
    setErrorMsg('')
    executeTask('dokumen', sampleQuery, fmt, SAMPLE_VERIFIED_DOC)
  }

  const handleQuickDemo = (toolId) => {
    if (location.pathname !== '/') {
      navigate('/')
    }
    const preset = PITULUNG_TOOLS.find((t) => t.id === toolId) || PITULUNG_TOOLS[0]
    setActiveToolId(preset.id)
    setInputValue(preset.sampleInput)
    setSelectedFormat(preset.defaultFormat)
    setErrorMsg('')
    if (preset.id === 'dokumen') {
      setUploadedDoc(SAMPLE_VERIFIED_DOC)
      executeTask(preset.id, preset.sampleInput, preset.defaultFormat, SAMPLE_VERIFIED_DOC)
    } else {
      setUploadedDoc(null)
      executeTask(preset.id, preset.sampleInput, preset.defaultFormat, null)
    }
  }

  const executeTask = async (customToolId, customInput, customFormat, customDoc) => {
    const toolId = customToolId || activeToolId
    const preset = PITULUNG_TOOLS.find((t) => t.id === toolId) || PITULUNG_TOOLS[0]
    const docToUse = customDoc !== undefined ? customDoc : uploadedDoc
    const textToProcess = (customInput ?? inputValue).trim() || preset.sampleInput
    const formatToUse = customFormat || selectedFormat || preset.defaultFormat

    if (!inputValue.trim()) {
      setInputValue(textToProcess)
      setSelectedFormat(formatToUse)
    }

    setErrorMsg('')
    setIsProcessing(true)
    setProcessStep(
      docToUse
        ? `Memverifikasi isi dokumen "${truncateFileName(docToUse.name)}" & mengekstrak tabel...`
        : apiConfig.provider !== 'local'
          ? `${getProviderMeta(apiConfig.provider).label} lagi mengekstrak & memverifikasi datamu...`
          : 'Lagi mengekstrak & merapikan datamu, tunggu sebentar ya...'
    )

    try {
      const res = await processPitulungTask({
        toolId,
        input: textToProcess,
        format: formatToUse,
        config: apiConfig,
        document: docToUse,
      })

      if (res.quotaStatus) {
        setQuotaStatus(res.quotaStatus)
      } else if (res.aiError && /quota|rate\s*limit|429|terlalu banyak/i.test(res.aiError)) {
        setQuotaStatus('exhausted')
      }

      setResultData({
        ...res,
        input: textToProcess,
        format: formatToUse,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
      setActiveResultTab('table')
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 80)
    } catch (err) {
      if (err.quotaStatus) {
        setQuotaStatus(err.quotaStatus)
      } else if (/quota|rate\s*limit|429|terlalu banyak/i.test(err.message || '')) {
        setQuotaStatus('exhausted')
      }
      setErrorMsg(err.message || 'Gagal memproses data.')
    } finally {
      setIsProcessing(false)
      setProcessStep('')
    }
  }

  const formatResultAsText = () => {
    if (!resultData) return ''
    if (activeResultTab === 'json') {
      const jsonArr = resultData.rows.map((r) =>
        Object.fromEntries(resultData.columns.map((col, i) => [col, r[i]]))
      )
      return JSON.stringify(jsonArr, null, 2)
    }
    const header = resultData.columns.join(',')
    const lines = resultData.rows.map((r) => r.map((c) => `"${c}"`).join(','))
    return [header, ...lines].join('\n')
  }

  const handleCopyResult = () => {
    const content = formatResultAsText()
    navigator.clipboard?.writeText(content)
    setCopiedToast(true)
    setTimeout(() => setCopiedToast(false), 2000)
  }

  const handleDownloadResult = () => {
    if (!resultData) return
    const isJson = activeResultTab === 'json' || resultData.format.includes('JSON')
    const content = formatResultAsText()
    const blob = new Blob([content], {
      type: isJson ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `hasil-pitulung.${isJson ? 'json' : 'csv'}`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSaveApiConfig = async (e) => {
    e.preventDefault()
    const { apiKey, ...safeConfig } = apiConfig
    localStorage.setItem('pitulung_engine_config', JSON.stringify(safeConfig))
    if (apiKey) sessionStorage.setItem('pitulung_user_api_key', apiKey)
    else sessionStorage.removeItem('pitulung_user_api_key')

    const status = await checkEngineStatus(apiConfig)
    setEngineOnline(status.online)
    setServerHasKey(status.serverKey)
    if (status.quotaStatus) setQuotaStatus(status.quotaStatus)
    setConfigModalOpen(false)
  }

  const handleProviderChange = (providerId) => {
    setApiConfig((prev) => ({
      ...prev,
      provider: providerId,
      model: getProviderMeta(providerId).defaultModel,
      apiKey: '',
    }))
  }

  const handleResetApiConfig = () => {
    sessionStorage.removeItem('pitulung_user_api_key')
    setApiConfig(DEFAULT_ENGINE_CONFIG)
  }

  const handleSelectPresetCilok = (nominal) => {
    setSelectedCilokAmount(nominal)
    setIsCustomCilok(false)
  }

  const handleCustomCilokChange = (e) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '')
    setCustomCilokInput(rawVal)
    if (rawVal) {
      const num = parseInt(rawVal, 10)
      if (!Number.isNaN(num)) {
        const clamped = Math.min(MAX_CILOK_AMOUNT, Math.max(MIN_CILOK_AMOUNT, num))
        setSelectedCilokAmount(clamped)
      }
    } else {
      setSelectedCilokAmount(MIN_CILOK_AMOUNT)
    }
  }

  const handleCustomCilokBlur = () => {
    const num = parseInt(customCilokInput, 10)
    if (!customCilokInput || Number.isNaN(num) || num < MIN_CILOK_AMOUNT) {
      setCustomCilokInput(String(MIN_CILOK_AMOUNT))
      setSelectedCilokAmount(MIN_CILOK_AMOUNT)
    } else if (num > MAX_CILOK_AMOUNT) {
      setCustomCilokInput(String(MAX_CILOK_AMOUNT))
      setSelectedCilokAmount(MAX_CILOK_AMOUNT)
    }
  }

  const handleActivateCustomCilok = () => {
    setIsCustomCilok(true)
    const initialAmount = Math.min(MAX_CILOK_AMOUNT, Math.max(MIN_CILOK_AMOUNT, selectedCilokAmount))
    setSelectedCilokAmount(initialAmount)
    const currentVal = parseInt(customCilokInput, 10)
    if (!customCilokInput || Number.isNaN(currentVal) || currentVal < MIN_CILOK_AMOUNT || currentVal > MAX_CILOK_AMOUNT) {
      setCustomCilokInput(String(initialAmount))
    }
  }

  const activeProvider = getProviderMeta(apiConfig.provider)
  const isLocalMode = apiConfig.provider === 'local'
  const isInfoOrLegalPage =
    location.pathname === '/about' ||
    location.pathname === '/tentang' ||
    LEGAL_PAGES_META.some((p) => p.path === location.pathname)
  const baseModels = liveModelsByProvider[apiConfig.provider] || activeProvider.models || []
  const modelOptions =
    apiConfig.model && !baseModels.some((m) => m.id === apiConfig.model)
      ? [{ id: apiConfig.model, label: apiConfig.model, note: 'Model pilihan' }, ...baseModels]
      : baseModels
  const modelDropdownOptions = modelOptions.map((m) => ({
    value: m.id,
    label: m.label || m.id,
    note: m.note || '',
  }))

  const homeExtractionPage = (
    <section className="clean-hero-section">
      <h1 className="editorial-hero-title">
        Mau dibantu{' '}
        <span className="inline-arrow-pill">
          <IconArrowRight size={28} />
        </span>{' '}
        apa
        <br />
        hari ini?
      </h1>

      <p className="editorial-hero-subtitle">
        Alat bantu digital gratis, biar kerjaanmu cepet beres.
      </p>

      {/* CENTRAL INPUT CARD */}
      <div
        className={`clean-workspace-card ${isDraggingFile ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDraggingFile(true)
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDraggingFile(false)
          const droppedFile = e.dataTransfer?.files?.[0]
          if (droppedFile) handleFileUpload(droppedFile)
        }}
      >
        {/* DOCUMENT UPLOAD & VERIFIED SOURCE BAR */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.tsv,.txt,.md,.json,.html,.htm,.xml,.log,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFileUpload(f)
            e.target.value = ''
          }}
        />

        <div className="workspace-doc-bar">
          {uploadedDoc ? (
            <div className="active-doc-banner">
              <div className="active-doc-info">
                <span className="active-doc-icon">
                  <IconFileText size={16} />
                </span>
                <div className="active-doc-text">
                  <div className="active-doc-title-row">
                    <strong className="active-doc-filename" title={uploadedDoc.name}>
                      {truncateFileName(uploadedDoc.name)}
                    </strong>
                    <span
                      className="active-doc-verified"
                      title={isLocalMode ? 'Siap Diekstrak' : 'Terverifikasi'}
                      aria-label={isLocalMode ? 'Siap Diekstrak' : 'Terverifikasi'}
                    >
                      <IconCheck size={12} />
                    </span>
                  </div>
                  <div className="active-doc-questions">
                    <span>{isLocalMode ? 'Ekstrak cepat:' : 'Tanya cepat:'}</span>
                    {DOC_QUICK_QUESTIONS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        className="doc-quick-chip"
                        onClick={() => {
                          setInputValue(q.query)
                          setSelectedFormat(q.format)
                          executeTask('dokumen', q.query, q.format, uploadedDoc)
                        }}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="active-doc-actions">
                <button
                  type="button"
                  className="doc-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconUpload size={13} />
                  <span>Ganti</span>
                </button>
                <button
                  type="button"
                  className="doc-remove-btn"
                  onClick={() => {
                    setUploadedDoc(null)
                    setResultData(null)
                  }}
                  title="Hapus dokumen"
                >
                  <IconClose size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-doc-strip">
              <div className="empty-doc-left">
                <button
                  type="button"
                  className="upload-doc-trigger-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconUpload size={14} />
                  <span>Upload Dokumen</span>
                </button>
                <button
                  type="button"
                  className="sample-doc-trigger-btn"
                  onClick={handleLoadSampleDoc}
                >
                  <IconFileText size={13} />
                  <span>Contoh Dokumen</span>
                </button>
              </div>
              <span className="empty-doc-hint">
                Format: PDF, CSV, TXT, JSON, Nota
              </span>
            </div>
          )}
        </div>

        <form
          className="workspace-form-row"
          onSubmit={(e) => {
            e.preventDefault()
            executeTask()
          }}
        >
          <div className="clean-input-box">
            <input
              ref={inputRef}
              type="text"
              className="clean-text-input"
              placeholder={
                uploadedDoc
                  ? isLocalMode
                    ? `Ketik kata kunci untuk diekstrak dari "${truncateFileName(uploadedDoc.name, 20)}" (mis. harga, tanggal, denda)...`
                    : `Tanyakan isi "${truncateFileName(uploadedDoc.name, 20)}" atau minta tabel...`
                  : isLocalMode
                    ? 'Ekstrak dokumen, link web, atau chat...'
                    : 'Tanya isi dokumen, tempel link web, atau masukkan chat...'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              aria-label="Masukkan pertanyaan dokumen, link web, atau teks di sini"
            />
            {inputValue && (
              <button
                type="button"
                className="clean-clear-btn"
                onClick={() => {
                  setInputValue('')
                  setResultData(null)
                  setErrorMsg('')
                  inputRef.current?.focus()
                }}
                title="Bersihkan input"
              >
                <IconClose size={12} />
              </button>
            )}
          </div>

          <CleanDropdown
            id="format-selector"
            value={selectedFormat}
            onChange={(val) => setSelectedFormat(val)}
            options={FORMAT_OPTIONS}
            placeholder="Pilih Output"
            size="large"
            ariaLabel="Pilih Output"
          />

          <button
            type="submit"
            className="clean-submit-btn"
            disabled={isProcessing}
          >
            <span>
              {isProcessing ? 'Memproses...' : 'Proses Sekarang'}
            </span>
            <span className="submit-arrow-circle">
              <IconArrowUpRight size={16} />
            </span>
          </button>
        </form>

        <div className="workspace-footer-bar">
          {(quotaStatus === 'warning' || quotaStatus === 'exhausted') && (
            <div
              className={`quota-status-indicator ${
                quotaStatus === 'exhausted' ? 'is-exhausted' : 'is-warning'
              }`}
              role="status"
            >
              <span className="quota-shield-icon">
                <IconShield size={15} />
              </span>
              <span>
                Sisa kuota publik:{' '}
                <strong>{quotaStatus === 'exhausted' ? 'Habis' : 'Hampir Habis'}</strong>
              </span>
            </div>
          )}

          <div className="preset-pills-group">
            <span className="preset-caption">Coba cepat:</span>
            <button
              type="button"
              className="clean-preset-btn"
              onClick={() => handleQuickDemo('dokumen')}
            >
              <IconFileText size={13} />
              <span>Tanya Dokumen</span>
            </button>
            <button
              type="button"
              className="clean-preset-btn"
              onClick={() => handleQuickDemo('toko')}
            >
              <IconTable size={13} />
              <span>Link Jadi Tabel</span>
            </button>
            <button
              type="button"
              className="clean-preset-btn"
              onClick={() => handleQuickDemo('teks')}
            >
              <IconMessage size={13} />
              <span>Rekap Order WA</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="clean-error-banner" role="alert">
            {errorMsg}
          </div>
        )}

        {isProcessing && (
          <div className="clean-loading-bar" role="status">
            <div className="clean-loader-pulse" />
            <span>{processStep}</span>
          </div>
        )}

        {/* INSTANT RESULT PREVIEW */}
        {resultData && !isProcessing && (
          <div className="clean-result-container" ref={resultRef}>
            <div className="clean-result-header">
              <div className="clean-result-meta">
                <span className="clean-badge-done">
                  <IconCheck size={13} />
                  <span>Selesai &amp; Siap Pakai</span>
                </span>
                <span className="clean-result-info">
                  {resultData.docName ? (
                    <>
                      Sumber:{' '}
                      <strong title={resultData.docName}>
                        {truncateFileName(resultData.docName)}
                      </strong>{' '}
                      •{' '}
                    </>
                  ) : null}
                  {resultData.timestamp}
                </span>
              </div>

              <div className="clean-result-controls">
                <div className="clean-segmented-tabs">
                  <button
                    type="button"
                    className={`seg-tab ${activeResultTab === 'table' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('table')}
                  >
                    Tabel
                  </button>
                  <button
                    type="button"
                    className={`seg-tab ${activeResultTab === 'csv' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('csv')}
                  >
                    Excel/CSV
                  </button>
                  <button
                    type="button"
                    className={`seg-tab ${activeResultTab === 'json' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('json')}
                  >
                    JSON
                  </button>
                </div>

                <button
                  type="button"
                  className="clean-action-btn icon-only"
                  onClick={handleCopyResult}
                  title={copiedToast ? 'Disalin' : 'Salin'}
                  aria-label={copiedToast ? 'Disalin' : 'Salin'}
                >
                  {copiedToast ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </button>
                <button
                  type="button"
                  className="clean-action-btn primary icon-only"
                  onClick={handleDownloadResult}
                  title="Unduh"
                  aria-label="Unduh"
                >
                  <IconDownload size={14} />
                </button>
                <button
                  type="button"
                  className="clean-close-result"
                  onClick={() => setResultData(null)}
                  title="Tutup"
                  aria-label="Tutup"
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>

            <p className="clean-result-summary">
              {formatUiText(resultData.summary)}
            </p>
            {resultData.aiProvider && (
              <p className="ai-result-note is-ai">
                <IconSparkle size={11} />
                <span>
                  Diproses oleh {resultData.aiProvider}
                  {resultData.aiModel ? ` (${resultData.aiModel})` : ''}
                </span>
              </p>
            )}
            {resultData.aiError && (
              <p className="ai-result-note is-fallback">
                AI eksternal belum terhubung ({resultData.aiError}). Hasil diekstrak oleh Engine Lokal.
              </p>
            )}

            {/* AJAKAN HUBUNGKAN AI: Mode Instan hanya mencocokkan kata kunci */}
            {resultData.engine === 'local' && !resultData.aiProvider && !resultData.aiError && (
              <div className={`ai-upgrade-card ${resultData.isQuestion ? 'is-question' : ''}`} role="note">
                <span className="ai-upgrade-icon">
                  <IconSparkle size={15} />
                </span>
                <div className="ai-upgrade-text">
                  <strong>
                    {resultData.isQuestion
                      ? 'Mau jawaban yang lebih akurat & nyambung?'
                      : 'Mode Instan: jago ekstrak tabel, angka & tanggal'}
                  </strong>
                  <span>
                    {resultData.isQuestion
                      ? 'Mode Instan hanya mencocokkan kata kunci, jadi jawaban bisa kurang tepat. Hubungkan Model AI agar pertanyaanmu benar-benar dipahami.'
                      : 'Untuk tanya-jawab isi dokumen yang butuh pemahaman (kontrak, laporan, aturan), hubungkan AI agar jawabannya lebih akurat.'}
                  </span>
                </div>
                <button
                  type="button"
                  id="open-ai-settings-from-result"
                  className="ai-upgrade-btn"
                  onClick={() => setConfigModalOpen(true)}
                >
                  <IconSettings size={13} />
                  <span>Hubungkan AI</span>
                </button>
              </div>
            )}

            {/* JAWABAN PINTAR & KUTIPAN BUKTI DOKUMEN TERVERIFIKASI */}
            {(resultData.answer || (resultData.verifiedQuotes && resultData.verifiedQuotes.length > 0)) && (
              <div className="verified-answer-card">
                <div className="vac-head">
                  <span className="vac-badge">
                    <IconShield size={13} />
                    <span>
                      {resultData.engine === 'local'
                        ? resultData.isQuestion
                          ? 'HASIL PENCARIAN KATA KUNCI'
                          : 'HASIL EKSTRAK DOKUMEN'
                        : 'JAWABAN TERVERIFIKASI'}
                    </span>
                  </span>
                  {resultData.docName && (
                    <span className="vac-source-name" title={resultData.docName}>
                      {truncateFileName(resultData.docName)}
                    </span>
                  )}
                </div>
                {resultData.answer && (
                  <div className="vac-body">
                    {resultData.answer.split('\n').map((line, i) => (
                      <p key={i}>{formatUiText(line)}</p>
                    ))}
                  </div>
                )}
                {resultData.verifiedQuotes && resultData.verifiedQuotes.length > 0 && (
                  <div className="vac-quotes">
                    <span className="vac-quotes-title">Kutipan Sumber:</span>
                    <div className="vac-quotes-grid">
                      {resultData.verifiedQuotes.map((q, idx) => (
                        <div key={idx} className="vac-quote-item">
                          <span className="vac-quote-ref" title={q.source}>
                            {formatUiText(q.source)}
                          </span>
                          <p className="vac-quote-text">
                            &ldquo;{formatUiText(q.quote)}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeResultTab === 'table' ? (
              <div className="clean-table-wrapper">
                <table className="clean-data-table">
                  <thead>
                    <tr>
                      {resultData.columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultData.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>{formatUiText(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="clean-code-preview">{formatResultAsText()}</pre>
            )}
          </div>
        )}
      </div>

      {/* THREE FEATURE CARDS ROW BELOW INPUT */}
      <div className="quick-features-grid">
        <button
          type="button"
          className="quick-feature-card"
          onClick={() => handleQuickDemo('dokumen')}
        >
          <div className="qf-top">
            <span className="qf-number">DOKUMEN PINTAR</span>
            <span className="qf-arrow">
              <IconArrowUpRight size={14} />
            </span>
          </div>
          <h3>{isLocalMode ? 'Ekstrak Data Dokumen' : 'Tanya & Tabel Dokumen'}</h3>
          <p>
            {isLocalMode
              ? 'Upload PDF atau CSV, tarik tabel, angka & tanggal pentingnya jadi rapi.'
              : 'Upload PDF atau CSV, tanya isinya dan ubah jadi tabel rapi.'}
          </p>
        </button>

        <button
          type="button"
          className="quick-feature-card"
          onClick={() => navigate('/merge-pdf')}
        >
          <div className="qf-top">
            <span className="qf-number">GABUNG PDF</span>
            <span className="qf-arrow">
              <IconArrowUpRight size={14} />
            </span>
          </div>
          <h3>Gabung Dokumen PDF</h3>
          <p>Susun urutan beberapa berkas PDF dan satukan jadi satu dokumen rapi langsung di browser.</p>
        </button>

        <button
          type="button"
          className="quick-feature-card"
          onClick={() => navigate('/split-pdf')}
        >
          <div className="qf-top">
            <span className="qf-number">PISAH PDF</span>
            <span className="qf-arrow">
              <IconArrowUpRight size={14} />
            </span>
          </div>
          <h3>Pisahkan Halaman PDF</h3>
          <p>Ambil rentang halaman tertentu atau pecah setiap halaman menjadi file PDF terpisah.</p>
        </button>
      </div>
    </section>
  )

  return (
    <div className="pitulung-clean-app">
      <div className="ambient-glow-top" aria-hidden="true" />

      <div className="main-container">
        {/* STICKY / DYNAMIC ISLAND FLOATING NAVBAR */}
        <div className={`navbar-sticky-stage ${isScrolled ? 'is-scrolled' : ''}`}>
          <header className={`clean-navbar ${isScrolled ? 'is-island' : ''}`} id="top">
            <button
              type="button"
              className="clean-brand-identity"
              onClick={() => {
                if (location.pathname !== '/') {
                  navigate('/')
                }
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              aria-label="Pitulung"
            >
              <img src={logoImage} alt="Logo Pitulung" className="brand-logo-img" />
              <img src={logoText} alt="Pitulung" className="brand-logo-text-img" />
            </button>

            <div className="nav-right-actions">
              {/* DROPDOWN NAVIGASI ALAT BANTU */}
              <div
                ref={navMenuRef}
                className={`nav-tools-dropdown ${navMenuOpen ? 'is-open' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setNavMenuOpen(false)
                }}
              >
                <button
                  type="button"
                  className="clean-nav-link nav-tools-trigger"
                  onClick={() => setNavMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={navMenuOpen}
                >
                  <span className="nav-label-full">Alat Bantu</span>
                  <span className="nav-label-short">Alat</span>
                  <span className={`nav-tools-caret ${navMenuOpen ? 'is-open' : ''}`}>
                    <IconChevronDown size={13} />
                  </span>
                </button>

                {navMenuOpen && (
                  <div className="nav-tools-menu" role="menu" aria-label="Pilih Alat Bantu Pitulung">
                    {NAV_TOOL_ROUTES.map((item) => {
                      const IconComp = item.icon
                      const isActive = location.pathname === item.path
                      return (
                        <button
                          key={item.path}
                          type="button"
                          role="menuitem"
                          className={`nav-tool-menu-item ${isActive ? 'is-active' : ''}`}
                          onClick={() => {
                            setNavMenuOpen(false)
                            navigate(item.path)
                          }}
                        >
                          <span className="ntm-icon">
                            <IconComp size={15} />
                          </span>
                          <span className="ntm-body">
                            <span className="ntm-title-row">
                              <strong>{item.label}</strong>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="nav-cta-outline"
                onClick={() => {
                  const tipjarEl = document.getElementById('traktir-cilok')
                  if (tipjarEl) {
                    tipjarEl.scrollIntoView({ behavior: 'smooth' })
                  } else {
                    setQrisModalOpen(true)
                  }
                }}
              >
                <IconCilok size={16} />
                <span className="nav-label-full">Traktir Cilok</span>
                <span className="nav-label-short">Traktir</span>
                <IconArrowUpRight size={14} />
              </button>
            </div>
          </header>
        </div>

        {/* ROUTE VIEWPORTS */}
        <Routes>
          <Route path="/" element={homeExtractionPage} />
          <Route path="/merge-pdf" element={<MergePdfPage />} />
          <Route path="/split-pdf" element={<SplitPdfPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/tentang" element={<AboutPage />} />
          {LEGAL_PAGES_META.map((page) => (
            <Route
              key={page.slug}
              path={page.path}
              element={<LegalPage pageSlug={page.slug} />}
            />
          ))}
          <Route path="*" element={homeExtractionPage} />
        </Routes>

        {/* ROUNDED GEOMETRIC CONTAINER: ALAT BANTU FAVORIT (HANYA DI HALAMAN UTAMA) */}
        {location.pathname === '/' && (
          <section className="framed-geometric-section" id="alat">
            <div className="framed-section-header">
              <div>
                <h2>Kerjaan Beres Tanpa Ribet</h2>
              </div>
              <p>
                Tanya dokumen, gabung &amp; pisah PDF, tarik tabel dari link web, atau rapikan chat orderan dalam sekali klik.
              </p>
            </div>

            <div className="progressive-cards-grid">
              {/* Card 1 */}
              <article className="prog-card tone-light">
                <button
                  type="button"
                  className="prog-corner-arrow"
                  onClick={() => {
                    handleQuickDemo('dokumen')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  title="Coba Sekarang"
                >
                  <IconArrowUpRight size={15} />
                </button>
                <div className="prog-card-head">
                  <h3>
                    Tanya &amp; Ekstrak
                    <br />
                    Isi Dokumen
                  </h3>
                  <p>
                    &ldquo;Ambil rincian barang &amp; biaya dari dokumen RAB ini.&rdquo;
                  </p>
                </div>
                <div className="prog-card-preview">
                  <div className="clean-mini-table">
                    <div className="cmt-row cmt-head">
                      <span>Item RAB</span>
                      <span>Total</span>
                      <span>Sumber</span>
                    </div>
                    <div className="cmt-row">
                      <span>Arabika Gayo</span>
                      <span>Rp 67,5 Jt</span>
                      <span className="cmt-tag">Pasal 2</span>
                    </div>
                    <div className="cmt-row">
                      <span>Robusta Fine</span>
                      <span>Rp 45,0 Jt</span>
                      <span className="cmt-tag">Pasal 2</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* Card 2 */}
              <article className="prog-card tone-mid">
                <button
                  type="button"
                  className="prog-corner-arrow"
                  onClick={() => {
                    handleQuickDemo('toko')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  title="Coba Sekarang"
                >
                  <IconArrowUpRight size={15} />
                </button>
                <div className="prog-card-head">
                  <h3>
                    Salin Link Web
                    <br />
                    Jadi Tabel Excel
                  </h3>
                  <p>
                    &ldquo;Web Wikipedia Kopi di Indonesia&rdquo;
                  </p>
                </div>
                <div className="prog-card-preview">
                  <div className="clean-mini-table">
                    <div className="cmt-row cmt-head">
                      <span>Data Web</span>
                      <span>Hasil</span>
                    </div>
                    <div className="cmt-row">
                      <span>Tabel &amp; Daftar</span>
                      <span className="cmt-tag">Rapi</span>
                    </div>
                    <div className="cmt-row">
                      <span>Format File</span>
                      <span className="cmt-tag">CSV / Excel</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* Card 3 */}
              <article className="prog-card tone-deep">
                <button
                  type="button"
                  className="prog-corner-arrow"
                  onClick={() => {
                    handleQuickDemo('teks')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  title="Coba Sekarang"
                >
                  <IconArrowUpRight size={15} />
                </button>
                <div className="prog-card-head">
                  <h3>
                    Rekap Chat WA
                    <br />
                    Langsung Jadi Rapi
                  </h3>
                  <p>
                    &ldquo;Kak pesan Kopi Gayo 2 bungkus ke Jl. Merdeka Bandung a.n Budi (08123456789)&rdquo;
                  </p>
                </div>
                <div className="prog-card-preview clean-order-preview">
                  <div className="cop-grid">
                    <div className="cop-item">
                      <span className="cop-label">Nama:</span>
                      <strong className="cop-val">
                        Budi <span className="cop-sub">(08123456789)</span>
                      </strong>
                    </div>
                    <div className="cop-item">
                      <span className="cop-label">Alamat:</span>
                      <strong className="cop-val">
                        Jl. Merdeka Bandung
                      </strong>
                    </div>
                    <div className="cop-item full-width">
                      <span className="cop-label">Pesanan:</span>
                      <strong className="cop-val highlight-order">
                        2x Kopi Gayo <span className="cop-dot">•</span>
                      </strong>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}

        {/* CLEAN MINIMALIST TIP-JAR & QRIS BANNER (DISEMBUNYIKAN DI HALAMAN LEGAL & TENTANG) */}
        {!isInfoOrLegalPage && (
          <section className="clean-tipjar-banner" id="traktir-cilok">
            <div className="ctb-left">
              <h2>Kerjaanmu terbantu?</h2>
              <p>
                Kalau alat ini membantu kerjaanmu, boleh banget traktir cilok atau ikut patungan biaya server biar web ini tetap jalan!
              </p>
              <div className="ctb-wallets-row" role="group" aria-label="Pilih nominal traktir cilok">
                {CILOK_NOMINALS.map((item) => {
                  const isSelected = !isCustomCilok && selectedCilokAmount === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`cilok-nominal-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectPresetCilok(item.value)}
                    >
                      <IconCilok size={14} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="ctb-right">
              <div
                className="clean-qris-card"
                role="button"
                tabIndex={0}
                onClick={() => setQrisModalOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setQrisModalOpen(true)
                  }
                }}
                title="Klik untuk memperbesar QRIS"
              >
                <div className="clean-qris-header">
                  <strong>QRIS</strong>
                  <span className="qris-amount-tag">{formatRupiah(selectedCilokAmount)}</span>
                </div>
                <div className="real-qris-img-wrap">
                  {qrisDataUrl ? (
                    <img
                      src={qrisDataUrl}
                      alt={`QRIS ${MERCHANT_INFO.name} ${formatRupiah(selectedCilokAmount)}`}
                      className="real-qris-img"
                    />
                  ) : (
                    <div className="clean-qr-matrix" aria-hidden="true" />
                  )}
                </div>
                <span className="clean-qris-action">
                  <span>Perbesar QRIS</span>
                  <IconArrowUpRight size={12} />
                </span>
              </div>
            </div>
          </section>
        )}

        {/* MINIMALIST FOOTER */}
        <footer className="clean-footer">
          {/* BARIS ATAS: KIRI (KEBIJAKAN LEGAL) DAN KANAN (TENTANG, KONTAK & PENGATURAN AI) */}
          <div className="footer-upper-row">
            <nav
              className="footer-legal-links"
              aria-label="Halaman Kebijakan Legal Website"
            >
              {LEGAL_PAGES_META.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.slug}
                    to={item.path}
                    className={`footer-legal-link ${isActive ? 'is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.shortLabel}
                  </Link>
                )
              })}
            </nav>

            <div className="footer-info-actions">
              <div className="footer-info-links">
                <Link
                  to="/about"
                  className={`footer-legal-link ${location.pathname === '/about' || location.pathname === '/tentang' ? 'is-active' : ''}`}
                  aria-current={location.pathname === '/about' || location.pathname === '/tentang' ? 'page' : undefined}
                >
                  Tentang
                </Link>
                <span className="footer-dot-sep" aria-hidden="true">•</span>
                <button
                  type="button"
                  className="footer-legal-link footer-contact-link"
                  onClick={() => setContactModalOpen(true)}
                >
                  Kontak
                </button>
              </div>

              <span className="footer-v-sep" aria-hidden="true" />

              <button
                type="button"
                className={`footer-api-link ${apiConfig.provider !== 'local' && engineOnline ? 'is-connected' : ''}`}
                onClick={() => setConfigModalOpen(true)}
              >
                <span
                  className={`footer-ai-dot ${
                    apiConfig.provider === 'local'
                      ? 'is-local'
                      : engineOnline
                        ? 'is-online'
                        : 'is-ready'
                  }`}
                  aria-hidden="true"
                />
                <IconSettings size={13} />
                <span>{engineOnline ? 'AI Terhubung' : 'Pengaturan AI'}</span>
              </button>
            </div>
          </div>

          {/* BARIS PALING BAWAH: KIRI (COPYRIGHT & DITENAGAI OLEH) DAN KANAN (BAHASA UI) */}
          <div className="footer-bottom-bar">
            <div className="footer-brand-copy">
              <img src={logoImage} alt="" className="footer-mini-logo" />
              <span>
                © 2026 <strong>Pitulung</strong> - Alat bantu digital
              </span>
              <span className="footer-dot-sep" aria-hidden="true">•</span>
              <span className="footer-powered-inline">
                {apiConfig.provider === 'local'
                  ? 'Ditenagai oleh OpenClaw'
                  : `Ditenagai oleh ${activeProvider.label}`}
              </span>
            </div>

            <div
              ref={langMenuRef}
              className={`footer-lang-switcher ${langMenuOpen ? 'is-open' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setLangMenuOpen(false)
              }}
            >
              <button
                type="button"
                className="footer-lang-trigger"
                onClick={() => setLangMenuOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={langMenuOpen}
                aria-label="Pilih Bahasa Antarmuka (UI)"
              >
                <IconGlobe size={13} />
                <span>
                  {UI_LANGUAGE_OPTIONS.find((l) => l.code === uiLang)?.label || 'Bahasa Indonesia'}
                </span>
                <span className={`footer-lang-caret ${langMenuOpen ? 'is-open' : ''}`}>
                  <IconChevronDown size={12} />
                </span>
              </button>

              {langMenuOpen && (
                <ul className="footer-lang-menu" role="listbox" aria-label="Pilihan Bahasa UI">
                  {UI_LANGUAGE_OPTIONS.map((lang) => {
                    const isSelected = lang.code === uiLang
                    return (
                      <li
                        key={lang.code}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={!lang.available}
                        className={`footer-lang-item ${isSelected ? 'is-selected' : ''} ${
                          !lang.available ? 'is-disabled' : ''
                        }`}
                        onClick={() => {
                          if (!lang.available) return
                          setUiLang(lang.code)
                          setLangMenuOpen(false)
                        }}
                      >
                        <div className="fli-left">
                          <span className="fli-label">{lang.label}</span>
                        </div>
                        {isSelected && (
                          <span className="fli-check" aria-hidden="true">
                            <IconCheck size={13} />
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </footer>
      </div>

      {/* MODAL PENGATURAN KONEKSI API / AI */}
      {configModalOpen && (
        <div
          className="clean-modal-overlay"
          onClick={() => setConfigModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pengaturan AI"
        >
          <div className="clean-modal-box wide-modal ai-config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clean-modal-top ai-modal-header">
              <div>
                <h3>Pilih Mesin AI &amp; Ekstraksi</h3>
              </div>
              <button
                type="button"
                className="clean-modal-close"
                onClick={() => setConfigModalOpen(false)}
                aria-label="Tutup Pengaturan AI"
              >
                <IconClose size={14} />
              </button>
            </div>

            <form className="api-config-form" onSubmit={handleSaveApiConfig}>
              <div className="config-field">
                <div className="config-field-label-row">
                  <span>Penyedia Mesin Pemroses</span>
                  <small>Pilih sesuai kebutuhan kecepatan atau kecerdasan</small>
                </div>
                <div className="provider-chip-grid" role="radiogroup" aria-label="Pilih mesin AI">
                  {AI_PROVIDERS.map((p) => {
                    const isSelected = apiConfig.provider === p.id
                    return (
                      <button
                        key={p.id}
                        id={`provider-${p.id}`}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`provider-chip ${isSelected ? 'is-active' : ''}`}
                        onClick={() => handleProviderChange(p.id)}
                      >
                        <div className="provider-chip-top">
                          <span className="provider-chip-tag">
                            {p.id === 'local' ? 'Tanpa AI' : p.id === 'openclaw' ? 'Server Lokal' : 'Cloud AI'}
                          </span>
                          <span className="provider-radio-dot" aria-hidden="true" />
                        </div>
                        <strong className="provider-chip-title">{p.label}</strong>
                      </button>
                    )
                  })}
                </div>
              </div>

              {apiConfig.provider === 'local' && (
                <div className="config-info-card">
                  <div className="cic-icon">
                    <IconShield size={16} />
                  </div>
                  <div className="cic-body">
                    <strong>Mode Instan (Parser Lokal Terverifikasi)</strong>
                    <p>
                      Memproses ekstraksi tabel, angka, tanggal, dan rekap chat secara instan tanpa AI eksternal. Gratis, tanpa kuota, dan dokumenmu tidak dikirim ke pihak ketiga.
                    </p>
                  </div>
                </div>
              )}

              {apiConfig.provider !== 'local' && (
                <div className="config-ai-details-panel">
                  <div className="config-field">
                    <div className="config-field-label-row">
                      <span>Pilih Model AI</span>
                      <small>
                        Aktif: {apiConfig.model || activeProvider.defaultModel}
                      </small>
                    </div>
                    <CleanDropdown
                      id="config-model"
                      value={apiConfig.model || activeProvider.defaultModel}
                      onChange={(val) => setApiConfig({ ...apiConfig, model: val })}
                      options={modelDropdownOptions}
                      placeholder={activeProvider.defaultModel || 'Pilih Model AI'}
                      size="default"
                      ariaLabel="Pilih Model AI"
                    />
                  </div>

                  {apiConfig.provider === 'openclaw' && (
                    <label className="config-field">
                      <span>URL Server OpenClaw</span>
                      <input
                        id="config-base-url"
                        type="text"
                        value={apiConfig.baseUrl}
                        onChange={(e) => setApiConfig({ ...apiConfig, baseUrl: e.target.value })}
                        placeholder="http://127.0.0.1:18789"
                      />
                    </label>
                  )}

                  <label className="config-field">
                    <div className="config-field-label-row">
                      <span>API Key Pribadi</span>
                      <small>
                        {serverHasKey || !activeProvider.needsKey ? 'Opsional' : 'Wajib Diisi'}
                      </small>
                    </div>
                    <div className="config-key-input-wrap">
                      <input
                        id="config-api-key"
                        type={showApiKey ? 'text' : 'password'}
                        autoComplete="off"
                        value={apiConfig.apiKey}
                        onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                        placeholder={
                          serverHasKey
                            ? 'Kosongkan untuk memakai kuota server publik'
                            : activeProvider.keyHint || 'Tempel API Key pribadimu di sini...'
                        }
                      />
                      <button
                        type="button"
                        className="config-key-toggle-btn"
                        onClick={() => setShowApiKey((prev) => !prev)}
                        title={showApiKey ? 'Sembunyikan API Key' : 'Tampilkan API Key'}
                        aria-label={showApiKey ? 'Sembunyikan API Key' : 'Tampilkan API Key'}
                      >
                        {showApiKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </button>
                    </div>
                    <small className="config-security-note">
                      <IconShield size={13} />
                      <span>
                        {serverHasKey
                          ? 'Server sudah menyediakan kuota publik, jadi kamu tidak wajib mengisi key sendiri.'
                          : 'API Key hanya disimpan sementara di sesi tab ini (sessionStorage) dan otomatis terhapus saat tab ditutup.'}
                      </span>
                    </small>
                  </label>
                </div>
              )}

              <div className="config-actions-row">
                <button
                  type="button"
                  className="clean-action-btn"
                  onClick={handleResetApiConfig}
                >
                  Reset ke Bawaan
                </button>
                <button type="submit" className="clean-modal-done config-save-btn">
                  <IconCheck size={14} />
                  <span>Simpan Pengaturan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL KONTAK KAMI (DENGAN CHECKLIST T&C + PRIVACY POLICY AGAR EMAIL AMAN) */}
      {contactModalOpen && (
        <div
          className="clean-modal-overlay"
          onClick={() => setContactModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Kontak Pitulung"
        >
          <div
            className="clean-modal-box wide-modal contact-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clean-modal-top">
              <div>
                <h3>Kontak &amp; Masukan Pitulung</h3>
              </div>
              <button
                type="button"
                className="clean-modal-close"
                onClick={() => setContactModalOpen(false)}
                aria-label="Tutup Kontak"
              >
                <IconClose size={14} />
              </button>
            </div>

            <p className="contact-modal-intro">
              Punya pertanyaan, saran fitur, atau ingin melaporkan kendala? Isi pesan di bawah dan centang persetujuan untuk membuka kontak email resmi kami.
            </p>

            <form
              className="contact-modal-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!contactAgreed) return
                const email = getProtectedContactEmail()
                const subject = encodeURIComponent(
                  `[Pitulung - ${contactCategory}]${contactName.trim() ? ` dari ${contactName.trim()}` : ''}`
                )
                const body = encodeURIComponent(
                  `${contactMessage.trim() || 'Halo tim Pitulung,'}\n\nPengirim: ${
                    contactName.trim() || 'Pengguna Pitulung'
                  }\nKategori: ${contactCategory}`
                )
                window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
              }}
            >
              <div className="config-field">
                <span>Keperluan / Kategori</span>
                <CleanDropdown
                  id="contact-category"
                  value={contactCategory}
                  onChange={(val) => setContactCategory(val)}
                  options={CONTACT_CATEGORIES}
                  placeholder="Pilih Kategori"
                  size="default"
                  ariaLabel="Pilih Kategori Kontak"
                />
              </div>

              <label className="config-field">
                <span>Nama / Panggilan (Opsional)</span>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Misal: Budi / Admin Toko Kopi"
                />
              </label>

              <label className="config-field">
                <span>Pesan Singkat (Opsional)</span>
                <textarea
                  rows={3}
                  className="contact-textarea"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Tulis pertanyaan, masukan fitur, atau kendala yang kamu alami..."
                />
              </label>

              {/* CHECKLIST WAJIB TELAH MEMBACA T&C DAN PRIVACY POLICY */}
              <label className={`contact-consent-box ${contactAgreed ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={contactAgreed}
                  onChange={(e) => setContactAgreed(e.target.checked)}
                />
                <span className="contact-custom-checkbox" aria-hidden="true">
                  {contactAgreed && <IconCheck size={12} />}
                </span>
                <span className="contact-consent-text">
                  Saya telah membaca dan menyetujui{' '}
                  <Link
                    to="/terms"
                    onClick={() => setContactModalOpen(false)}
                  >
                    Syarat &amp; Ketentuan
                  </Link>{' '}
                  serta{' '}
                  <Link
                    to="/privacy-policy"
                    onClick={() => setContactModalOpen(false)}
                  >
                    Kebijakan Privasi
                  </Link>{' '}
                  Pitulung.
                </span>
              </label>

              {/* KOTAK EMAIL YANG TERPROTEKSI HINGGA CHECKLIST DICENTANG */}
              <div className={`contact-email-reveal-box ${contactAgreed ? 'is-unlocked' : 'is-locked'}`}>
                {contactAgreed ? (
                  <div className="cer-unlocked-row">
                    <div className="cer-email-info">
                      <span className="cer-icon">
                        <IconMail size={15} />
                      </span>
                      <div>
                        <small>Email Resmi Pengembang:</small>
                        <strong>{getProtectedContactEmail()}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="doc-action-btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(getProtectedContactEmail())
                        setContactEmailCopied(true)
                        setTimeout(() => setContactEmailCopied(false), 2000)
                      }}
                    >
                      {contactEmailCopied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                      <span>{contactEmailCopied ? 'Disalin' : 'Salin Email'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="cer-locked-note">
                    <IconShield size={14} />
                    <span>
                      Centang persetujuan Syarat &amp; Ketentuan dan Kebijakan Privasi di atas untuk menampilkan alamat email resmi &amp; mengirim pesan.
                    </span>
                  </div>
                )}
              </div>

              <div className="config-actions-row">
                <button
                  type="button"
                  className="clean-action-btn"
                  onClick={() => setContactModalOpen(false)}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="clean-modal-done config-save-btn"
                  disabled={!contactAgreed}
                >
                  <IconMail size={14} />
                  <span>Kirim via Aplikasi Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QRIS */}
      {qrisModalOpen && (
        <div
          className="clean-modal-overlay"
          onClick={() => setQrisModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="QRIS Pitulung"
        >
          <div className="clean-modal-box modal-qris-box" onClick={(e) => e.stopPropagation()}>
            <div className="clean-modal-top">
              <div>
                <h3>Patungan Server &amp; Traktir Cilok</h3>
              </div>
              <button
                type="button"
                className="clean-modal-close"
                onClick={() => setQrisModalOpen(false)}
              >
                <IconClose size={14} />
              </button>
            </div>

            <p>
              Pilih salah satu nominal atau isi nominal bebas sesukamu. Kode QRIS akan
              otomatis menyesuaikan!
            </p>

            <div className="modal-cilok-selector">
              {CILOK_NOMINALS.map((item) => {
                const isSelected = !isCustomCilok && selectedCilokAmount === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`cilok-nominal-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectPresetCilok(item.value)}
                  >
                    <IconCilok size={13} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
              <button
                type="button"
                className={`cilok-nominal-btn ${isCustomCilok ? 'active' : ''}`}
                onClick={handleActivateCustomCilok}
              >
                <IconEdit size={12} />
                <span>Nominal Bebas</span>
              </button>
            </div>

            {isCustomCilok && (
              <div className="custom-cilok-input-box">
                <label className="custom-cilok-field" htmlFor="custom-qris-nominal">
                  <span className="custom-cilok-label">Mau traktir berapa?</span>
                  <div className="custom-cilok-input-wrap">
                    <span className="custom-cilok-prefix">Rp</span>
                    <input
                      id="custom-qris-nominal"
                      type="text"
                      inputMode="numeric"
                      min={MIN_CILOK_AMOUNT}
                      max={MAX_CILOK_AMOUNT}
                      value={customCilokInput}
                      onChange={handleCustomCilokChange}
                      onBlur={handleCustomCilokBlur}
                      placeholder="1.000 - 5.000.000"
                      autoFocus
                    />
                  </div>
                  {(() => {
                    const parsed = parseInt(customCilokInput, 10)
                    if (customCilokInput && !Number.isNaN(parsed) && parsed < MIN_CILOK_AMOUNT) {
                      return (
                        <small className="custom-cilok-hint is-min-warning">
                          Minimal donasi <strong>Rp 1.000</strong>
                        </small>
                      )
                    }
                    if (customCilokInput && !Number.isNaN(parsed) && parsed > MAX_CILOK_AMOUNT) {
                      return (
                        <small className="custom-cilok-hint is-min-warning">
                          Maksimal donasi <strong>Rp 5.000.000</strong> per transaksi
                        </small>
                      )
                    }
                    return (
                      <small className="custom-cilok-hint">
                        QRIS otomatis bernilai{' '}
                        <strong>{formatRupiah(selectedCilokAmount)}</strong>
                      </small>
                    )
                  })()}
                </label>
              </div>
            )}

            <div className="clean-modal-qris-frame">
              <div className="clean-qris-header">
                <strong>{MERCHANT_INFO.name}</strong>
                <span className="qris-amount-tag">{formatRupiah(selectedCilokAmount)}</span>
              </div>
              <div className="real-qris-modal-wrap">
                {qrisDataUrl && (
                  <img
                    src={qrisDataUrl}
                    alt={`QRIS ${MERCHANT_INFO.name} ${formatRupiah(selectedCilokAmount)}`}
                    className="real-qris-img-large"
                  />
                )}
              </div>
              <div className="qris-merchant-meta">
                <span>NMID: {MERCHANT_INFO.nmid}</span>
                <span>{MERCHANT_INFO.city}</span>
              </div>
            </div>

            <button
              type="button"
              className="clean-modal-done"
              onClick={() => setQrisModalOpen(false)}
            >
              Selesai &amp; Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <PitulungAppShell />
    </BrowserRouter>
  )
}

export default App
