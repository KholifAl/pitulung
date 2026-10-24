import { useState, useEffect, useRef } from 'react'
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
import './App.css'

/* Minimalist Stroke SVG Icons (No Emojis) */
function IconArrowUpRight({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L17 7M17 7H8M17 7V16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconArrowRight({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12H19M19 12L13 6M19 12L13 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCilok({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 20.5L8 16M20 4L21.2 2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="14.5" r="2.7" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="13.5" cy="10.5" r="2.7" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.5" cy="6.5" r="2.7" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  )
}

function IconSparkle({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3L14.2 9.8L21 12L14.2 14.2L12 21L9.8 14.2L3 12L9.8 9.8L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconShield({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTable({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3 10H21M9 10V20" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  )
}

function IconMessage({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5C21 16.1944 16.9706 20 12 20C10.5869 20 9.24964 19.6916 8.06046 19.1422L3 20.5L4.46212 16.0389C3.53766 14.7259 3 13.1695 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17L4 12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56263 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSettings({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88A2 2 0 0 1 16.96 19.71L16.9 19.65A1.65 1.65 0 0 0 15.08 19.32A1.65 1.65 0 0 0 14 20.85V21A2 2 0 0 1 10 21V20.91A1.65 1.65 0 0 0 8.92 19.38A1.65 1.65 0 0 0 7.1 19.71L7.04 19.77A2 2 0 0 1 4.21 16.94L4.27 16.88A1.65 1.65 0 0 0 4.6 15.06A1.65 1.65 0 0 0 3.07 14H3A2 2 0 0 1 3 10H3.09A1.65 1.65 0 0 0 4.62 8.92A1.65 1.65 0 0 0 4.29 7.1L4.23 7.04A2 2 0 0 1 7.06 4.21L7.12 4.27A1.65 1.65 0 0 0 8.94 4.6H9A1.65 1.65 0 0 0 10 3.09V3A2 2 0 0 1 14 3V3.09A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L16.88 4.21A2 2 0 0 1 19.71 7.04L19.65 7.1A1.65 1.65 0 0 0 19.32 8.92V9A1.65 1.65 0 0 0 20.85 10H21A2 2 0 0 1 21 14H20.91A1.65 1.65 0 0 0 19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconClose({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconFileText({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2V8H20M8 13H16M8 17H13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function IconUpload({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15M17 8L12 3M12 3L7 8M12 3V15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
                  {option.note && <span className="cd-item-note">{option.note}</span>}
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

function App() {
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
      // Bersihkan field lama yang tidak aman / tidak dipakai lagi
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
  const [qrisModalOpen, setQrisModalOpen] = useState(false)
  const [selectedCilokAmount, setSelectedCilokAmount] = useState(5000)
  const [isCustomCilok, setIsCustomCilok] = useState(false)
  const [customCilokInput, setCustomCilokInput] = useState('')
  const [qrisDataUrl, setQrisDataUrl] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const resultRef = useRef(null)

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
    setProcessStep(`Membaca & memverifikasi dokumen "${file.name}"...`)
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
        ? `Memverifikasi isi dokumen "${docToUse.name}" & mengekstrak tabel...`
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
    // Pengaturan umum boleh diingat, tapi API key TIDAK disimpan permanen
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
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              aria-label="Pitulung"
            >
              <img src={logoImage} alt="Logo Pitulung" className="brand-logo-img" />
              <img src={logoText} alt="Pitulung" className="brand-logo-text-img" />
            </button>

            <div className="nav-right-actions">
              <button
                type="button"
                className="clean-nav-link"
                onClick={() => {
                  document.getElementById('alat')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <span className="nav-label-full">Alat Bantu</span>
                <span className="nav-label-short">Alat</span>
              </button>
              <button
                type="button"
                className="nav-cta-outline"
                onClick={() => {
                  document.getElementById('traktir-cilok')?.scrollIntoView({ behavior: 'smooth' })
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

        {/* HERO SECTION — SIMPLE, PUNCHY, CLICK-WORTHY */}
        <section className="clean-hero-section">
          <div className="hero-top-meta">
            <span className="meta-pill-badge">
              <IconSparkle size={12} />
              <span>BERES DALAM HITUNGAN DETIK</span>
            </span>

          </div>

          <h1 className="editorial-hero-title">
            Mau dibantu{' '}
            <span className="inline-arrow-pill"><IconArrowRight size={28} /></span>{' '}
            apa
            <br />
            hari ini?
          </h1>

          <p className="editorial-hero-subtitle">
            Alat bantu digital gratis, biar kerjaanmu cepet beres
            <br />

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
                        <strong>{uploadedDoc.name}</strong>
                        <span className="active-doc-tag">{uploadedDoc.docType || 'Dokumen'}</span>
                        <span className="active-doc-verified">
                          <IconCheck size={11} />
                          <span>Terverifikasi</span>
                        </span>
                      </div>
                      <div className="active-doc-questions">
                        <span>Tanya cepat:</span>
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
                      ? `Tanyakan isi "${uploadedDoc.name}" atau minta tabel...`
                      : 'Tanya isi dokumen, tempel link web, atau masukkan chat orderan...'
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
                          Sumber: <strong>{resultData.docName}</strong> •{' '}
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
                      className="clean-action-btn"
                      onClick={handleCopyResult}
                    >
                      {copiedToast ? 'Disalin' : 'Salin'}
                    </button>
                    <button
                      type="button"
                      className="clean-action-btn primary"
                      onClick={handleDownloadResult}
                    >
                      <span>Unduh</span>
                      <IconArrowUpRight size={13} />
                    </button>
                    <button
                      type="button"
                      className="clean-close-result"
                      onClick={() => setResultData(null)}
                      title="Tutup"
                    >
                      <IconClose size={13} />
                    </button>
                  </div>
                </div>

                <p className="clean-result-summary">{resultData.summary}</p>
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

                {/* JAWABAN PINTAR & KUTIPAN BUKTI DOKUMEN TERVERIFIKASI */}
                {(resultData.answer || (resultData.verifiedQuotes && resultData.verifiedQuotes.length > 0)) && (
                  <div className="verified-answer-card">
                    <div className="vac-head">
                      <span className="vac-badge">
                        <IconShield size={13} />
                        <span>JAWABAN TERVERIFIKASI</span>
                      </span>
                      {resultData.docName && (
                        <span className="vac-source-name">{resultData.docName}</span>
                      )}
                    </div>
                    {resultData.answer && (
                      <div className="vac-body">
                        {resultData.answer.split('\n').map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                    {resultData.verifiedQuotes && resultData.verifiedQuotes.length > 0 && (
                      <div className="vac-quotes">
                        <span className="vac-quotes-title">Kutipan Sumber:</span>
                        <div className="vac-quotes-grid">
                          {resultData.verifiedQuotes.map((q, idx) => (
                            <div key={idx} className="vac-quote-item">
                              <span className="vac-quote-ref">{q.source}</span>
                              <p className="vac-quote-text">&ldquo;{q.quote}&rdquo;</p>
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
                              <td key={cIdx}>{cell}</td>
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
              <h3>Tanya &amp; Tabel Dokumen</h3>
              <p>Upload PDF atau CSV, tanya isinya dan ubah jadi tabel rapi.</p>
            </button>

            <button
              type="button"
              className="quick-feature-card"
              onClick={() => handleQuickDemo('toko')}
            >
              <div className="qf-top">
                <span className="qf-number">EKSTRAK WEB</span>
                <span className="qf-arrow">
                  <IconArrowUpRight size={14} />
                </span>
              </div>
              <h3>Link Web Jadi Tabel</h3>
              <p>Tempel link website, tarik tabel dan datanya langsung ke Excel.</p>
            </button>

            <div className="quick-feature-card dotted-card" aria-label="Segera hadir">
              <div className="qf-top">
                <span className="qf-badge-vote">SEGERA HADIR</span>
              </div>
              <h3>Bandingkan Dokumen Terverifikasi</h3>
              <p>Cek selisih harga, klausul, dan isi dari 2 dokumen sekaligus.</p>
            </div>
          </div>
        </section>

        {/* ROUNDED GEOMETRIC CONTAINER: ALAT BANTU FAVORIT */}
        <section className="framed-geometric-section" id="alat">
          <div className="framed-section-header">
            <div>
              <span className="section-eyebrow">PRAKTIS &amp; LANGSUNG JADI</span>
              <h2>Kerjaan Beres Tanpa Ribet</h2>
            </div>
            <p>
              Tanya dokumen, tarik tabel dari link web, atau rapikan chat orderan dalam sekali klik.
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
                <span className="prog-tool-chip">Dokumen Pintar</span>
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
                <span className="prog-tool-chip">Ekstrak Web</span>
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
                <span className="prog-tool-chip dark-chip">Rekap Order</span>
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

        {/* CLEAN MINIMALIST TIP-JAR & QRIS BANNER */}
        <section className="clean-tipjar-banner" id="traktir-cilok">
          <div className="ctb-left">
            <div className="ctb-badge-row">
              <span className="ctb-pill">TIP-JAR</span>
              <span className="ctb-sub">PATUNGAN SERVER &amp; CILOK</span>
            </div>
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

        {/* MINIMALIST FOOTER — OPENCLAW MENTIONED ONLY ONCE HERE */}
        <footer className="clean-footer">
          <div className="footer-brand-copy">
            <img src={logoImage} alt="" className="footer-mini-logo" />
            <span>
              © 2026 <strong>Pitulung</strong> - Alat bantu digital.
            </span>
          </div>

          <div className="footer-engine-note">
            <span>
              {apiConfig.provider === 'local'
                ? 'Ditenagai oleh OpenClaw'
                : `Ditenagai oleh ${activeProvider.label}`}
            </span>
            <button
              type="button"
              className="footer-api-link"
              onClick={() => setConfigModalOpen(true)}
            >
              <IconSettings size={13} />
              <span>{engineOnline ? 'AI Terhubung' : 'Pengaturan AI'}</span>
            </button>
          </div>
        </footer>
      </div>

      {/* MODAL PENGATURAN KONEKSI API */}
      {configModalOpen && (
        <div
          className="clean-modal-overlay"
          onClick={() => setConfigModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pengaturan API"
        >
          <div className="clean-modal-box wide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clean-modal-top">
              <div>
                <span className="section-eyebrow">PENGATURAN AI</span>
                <h3>Pilih Mesin AI</h3>
              </div>
              <button
                type="button"
                className="clean-modal-close"
                onClick={() => setConfigModalOpen(false)}
              >
                <IconClose size={14} />
              </button>
            </div>

            <form className="api-config-form" onSubmit={handleSaveApiConfig}>
              <div className="config-field">
                <span>Mesin Pemroses</span>
                <div className="provider-chip-grid" role="radiogroup" aria-label="Pilih mesin AI">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      id={`provider-${p.id}`}
                      type="button"
                      role="radio"
                      aria-checked={apiConfig.provider === p.id}
                      className={`provider-chip ${apiConfig.provider === p.id ? 'is-active' : ''}`}
                      onClick={() => handleProviderChange(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {apiConfig.provider === 'local' && (
                <p className="config-info-box">
                  Mode bawaan memakai parser lokal tanpa AI. Cepat, gratis, dan datamu tidak dikirim ke
                  pihak ketiga.
                </p>
              )}

              {apiConfig.provider !== 'local' && (
                <>
                  <div className="config-field">
                    <span>Pilih Model AI</span>
                    <CleanDropdown
                      id="config-model"
                      value={apiConfig.model || activeProvider.defaultModel}
                      onChange={(val) => setApiConfig({ ...apiConfig, model: val })}
                      options={modelDropdownOptions}
                      placeholder={activeProvider.defaultModel || 'Pilih Model AI'}
                      size="default"
                      ariaLabel="Pilih Model AI"
                    />
                    <small>
                      Model aktif: <strong>{apiConfig.model || activeProvider.defaultModel}</strong>
                    </small>
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
                    <span>
                      API Key Pribadi{' '}
                      {serverHasKey || !activeProvider.needsKey ? '(Opsional)' : '(Wajib)'}
                    </span>
                    <input
                      id="config-api-key"
                      type="password"
                      autoComplete="off"
                      value={apiConfig.apiKey}
                      onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                      placeholder={
                        serverHasKey
                          ? 'Kosongkan untuk memakai key server'
                          : activeProvider.keyHint || 'Kosongkan jika tidak memakai token'
                      }
                    />
                    <small className="config-security-note">
                      <IconShield size={12} />
                      {serverHasKey
                        ? 'Server sudah punya key, jadi kamu tidak wajib mengisi.'
                        : 'Key hanya disimpan di tab ini dan otomatis hilang saat tab ditutup.'}{' '}
                      Key diteruskan lewat server Pitulung dan tidak pernah disimpan.
                    </small>
                  </label>
                </>
              )}

              <div className="config-actions-row">
                <button
                  type="button"
                  className="clean-action-btn"
                  onClick={handleResetApiConfig}
                >
                  Reset
                </button>
                <button type="submit" className="clean-modal-done">
                  Simpan Pengaturan
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
                {/* <span className="section-eyebrow">TIP-JAR PITULUNG</span> */}
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

export default App
