import { useNavigate, Link } from 'react-router-dom'
import {
  IconFileText,
  IconCheck,
  IconSparkle,
  IconArrowUpRight,
  IconMergePdf,
  IconSplitPdf,
  IconTable,
} from '../components/Icons'
import { useLanguage } from '../i18n/LanguageContext'

// eslint-disable-next-line react-refresh/only-export-components
export const LEGAL_PAGES_META = [
  {
    slug: 'privacy-policy',
    path: '/privacy-policy',
    title: 'Kebijakan Privasi',
    shortLabel: 'Kebijakan Privasi',
    badge: 'PRIVASI & PELINDUNGAN DATA',
    updatedAt: '27 Oktober 2026',
    subtitle:
      'Komitmen Tinulung dalam menjaga kerahasiaan dokumen, berkas PDF, dan data yang kamu proses di browser maupun melalui integrasi AI.',
    highlights: [
      'Alat Gabung PDF, Pisah PDF & Kompres PDF bekerja 100% lokal di browser perangkatmu tanpa pernah diunggah ke server.',
      'Mode Instan memproses ekstraksi teks & tabel secara langsung tanpa menyimpan dokumenmu di database.',
      'API Key pribadi hanya disimpan sementara di memori sesi tab (sessionStorage) dan otomatis terhapus saat tab ditutup.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Prinsip Utama Privasi di Tinulung',
        paragraphs: [
          'Tinulung ("Kami") dirancang dengan prinsip Privacy-by-Design. Kami memahami bahwa dokumen yang kamu kelola, seperti Rencana Anggaran Biaya (RAB), kontrak kerja, nota transaksi, hingga rekap pesanan pelanggan, bersifat penting dan rahasia.',
          'Kebijakan Privasi ini disusun selaras dengan Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP) untuk menjelaskan secara transparan bagaimana data diproses saat kamu menggunakan layanan Tinulung.',
        ],
      },
      {
        number: '02',
        heading: 'Cara Kami Memproses Dokumen & Berkas Kamu',
        paragraphs: [
          'Pemrosesan data di Tinulung terbagi menjadi tiga mekanisme sesuai fitur yang kamu gunakan:',
        ],
        bullets: [
          'Alat PDF Client-Side (Gabung PDF, Pisah PDF & Kompres PDF): Seluruh proses penggabungan, pemisahan halaman, dan kompresi ukuran PDF dijalankan 100% di dalam browser perangkatmu (menggunakan pustaka WebAssembly/JavaScript lokal). Berkas PDF tidak pernah dikirim, diunggah, atau disimpan di server Tinulung.',
          'Mode Instan / Parser Lokal (Tanya & Ekstrak Data): Ketika kamu memilih mesin pemroses "Mode Instan (Tanpa AI)", pembacaan dokumen dan ekstraksi tabel dilakukan secara instan tanpa meneruskan isi dokumen ke penyedia model AI pihak ketiga.',
          'Mode Integrasi AI Eksternal (OpenClaw, OpenRouter, Groq, Gemini, OpenAI, dll.): Jika kamu mengaktifkan mesin AI, potongan teks atau pertanyaan yang relevan akan diteruskan secara terenkripsi (HTTPS) ke penyedia AI pilihanmu semata-mata untuk menghasilkan jawaban atau tabel ekstraksi.',
        ],
      },
      {
        number: '03',
        heading: 'Penyimpanan API Key & Pengaturan Pengguna',
        paragraphs: [
          'Jika kamu memasukkan API Key pribadi pada menu Pengaturan AI, kunci tersebut hanya disimpan di penyimpanan sementara sesi browser (sessionStorage) pada perangkatmu dan otomatis hilang begitu tab atau jendela browser ditutup.',
          'Kami tidak pernah mencatat, menyimpan, atau membagikan API Key pribadimu ke database server kami. Preferensi non-sensitif seperti pilihan nama provider dan model AI disimpan secara lokal di browsermu (localStorage) agar kamu tidak perlu mengatur ulang setiap kali berkunjung.',
        ],
      },
      {
        number: '04',
        heading: 'Data Teknis & Pembatasan Kuota Publik',
        paragraphs: [
          'Untuk menjaga ketersediaan layanan gratis bagi seluruh pengguna dan mencegah penyalahgunaan (spam/otomatisasi berlebih), server kami dapat memproses informasi teknis minimal seperti alamat IP yang dianonimkan, waktu permintaan, serta penghitung kuota publik harian.',
          'Kami tidak menjual, menyewakan, atau memperdagangkan informasi pribadi maupun isi dokumen pengguna kepada pihak mana pun untuk tujuan periklanan.',
        ],
      },
      {
        number: '05',
        heading: 'Hak Pengguna atas Data Pribadi',
        paragraphs: [
          'Sesuai dengan ketentuan UU Pelindungan Data Pribadi (UU PDP), kamu memiliki kendali penuh atas data di perangkatmu:',
        ],
        bullets: [
          'Menghapus dokumen yang sedang dibuka kapan saja melalui tombol "Hapus dokumen" atau dengan memuat ulang halaman.',
          'Mereset konfigurasi mesin AI dan menghapus API Key dari sesi browser melalui tombol "Reset" di menu Pengaturan AI.',
          'Menghapus seluruh data lokal situs (localStorage & sessionStorage) melalui pengaturan privasi pada browser yang kamu gunakan.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    path: '/terms',
    title: 'Syarat dan Ketentuan',
    shortLabel: 'Syarat & Ketentuan',
    badge: 'KETENTUAN PENGGUNAAN LAYANAN',
    updatedAt: '27 Oktober 2026',
    subtitle:
      'Aturan penggunaan layanan, batasan pemakaian wajar, hak kekayaan intelektual, serta ketentuan dukungan donasi sukarela di Tinulung.',
    highlights: [
      'Tinulung dapat digunakan secara gratis untuk kebutuhan personal, akademik, UMKM, maupun pekerjaan profesional.',
      'Pengguna bertanggung jawab penuh atas legalitas dan hak akses dokumen yang diunggah atau diekstrak.',
      'Dukungan melalui fitur "Traktir Cilok / Patungan Server" via QRIS bersifat sukarela dan tidak mengikat.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Penerimaan Syarat & Ketentuan',
        paragraphs: [
          'Dengan mengakses dan menggunakan situs web serta seluruh alat bantu digital Tinulung, kamu menyatakan telah membaca, memahami, dan menyetujui Syarat dan Ketentuan ini. Apabila kamu tidak menyetujui bagian mana pun dari ketentuan ini, mohon untuk menghentikan penggunaan layanan.',
        ],
      },
      {
        number: '02',
        heading: 'Penggunaan yang Diperbolehkan & Larangan',
        paragraphs: [
          'Tinulung disediakan sebagai alat bantu produktivitas digital. Dalam menggunakan layanan kami, kamu setuju untuk tidak melakukan tindakan berikut:',
        ],
        bullets: [
          'Mengunggah atau memproses dokumen yang melanggar hukum, mengandung malware, atau melanggar hak cipta/kerahasiaan pihak lain tanpa izin.',
          'Melakukan scraping otomatis, serangan penolakan layanan (DDoS), atau mengakali batas kuota publik yang dapat mengganggu kenyamanan pengguna lain.',
          'Menggunakan fitur ekstraksi tautan web untuk mengambil data terproteksi yang melanggar ketentuan layanan situs sumber.',
        ],
      },
      {
        number: '03',
        heading: 'Hak Kekayaan Intelektual & Kepemilikan Dokumen',
        paragraphs: [
          'Hak kepemilikan atas seluruh berkas PDF, dokumen, teks, dan data yang kamu unggah maupun hasil ekstraksi (CSV, JSON, PDF gabungan/pisahan) sepenuhnya tetap menjadi milikmu.',
          'Sementara itu, merek, logo, desain antarmuka, dan kode sumber aplikasi Tinulung dilindungi oleh hak kekayaan intelektual yang berlaku.',
        ],
      },
      {
        number: '04',
        heading: 'Ketersediaan Layanan & Kuota Publik',
        paragraphs: [
          'Kami berupaya menjaga agar Tinulung selalu dapat diakses 24/7. Namun, fitur yang menggunakan kuota AI publik bersama memiliki batas pemakaian wajar harian. Ketika kuota publik sedang penuh, kamu tetap dapat menggunakan Mode Instan (Parser Lokal), alat PDF, atau menghubungkan API Key pribadimu sendiri.',
        ],
      },
      {
        number: '05',
        heading: 'Ketentuan Donasi Sukarela ("Traktir Cilok" QRIS)',
        paragraphs: [
          'Fitur "Traktir Cilok / Patungan Server" menggunakan standar pembayaran QRIS Nasional yang ditujukan sebagai bentuk dukungan sukarela (tip-jar) dari pengguna untuk membantu biaya operasional server dan pengembangan fitur baru.',
          'Dana dukungan yang telah dikirimkan bersifat sukarela (hibah/tip) dan tidak dapat dikembalikan (non-refundable), serta tidak menimbulkan kewajiban layanan berlangganan khusus di luar fitur yang telah tersedia secara terbuka.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    path: '/cookies',
    title: 'Kebijakan Cookie & Penyimpanan',
    shortLabel: 'Kebijakan Cookie',
    badge: 'COOKIE & PENYIMPANAN BROWSER',
    updatedAt: '27 Oktober 2026',
    subtitle:
      'Penjelasan transparan mengenai bagaimana Tinulung menggunakan penyimpanan lokal browser (LocalStorage & SessionStorage) tanpa cookie pelacak iklan.',
    highlights: [
      'Tinulung TIDAK menggunakan cookie pelacak iklan pihak ketiga (zero ad-trackers).',
      'Kami hanya menggunakan LocalStorage & SessionStorage bawaan browser untuk menyimpan preferensi alatmu.',
      'Kamu dapat menghapus penyimpanan lokal kapan saja langsung dari menu Pengaturan AI atau pengaturan browser.',
    ],
    storageTable: {
      columns: ['Nama Kunci Penyimpanan', 'Jenis', 'Tujuan Penggunaan', 'Masa Berlaku'],
      rows: [
        [
          'tinulung_engine_config',
          'localStorage',
          'Menyimpan pilihan mesin pemroses (mis. Mode Instan, OpenClaw, Gemini) dan nama model AI pilihanmu.',
          'Tersimpan hingga di-reset pengguna',
        ],
        [
          'tinulung_user_api_key',
          'sessionStorage',
          'Menyimpan API Key pribadi secara sementara agar tidak perlu diketik ulang selama tab masih aktif.',
          'Otomatis hilang saat tab ditutup',
        ],
      ],
    },
    sections: [
      {
        number: '01',
        heading: 'Apakah Tinulung Menggunakan Cookie?',
        paragraphs: [
          'Berbeda dengan banyak situs web yang memasang puluhan cookie pelacak untuk menargetkan iklan, Tinulung tidak memasang cookie pelacakan perilaku (behavioral tracking cookies) maupun piksel periklanan pihak ketiga.',
          'Sebagai gantinya, kami memanfaatkan teknologi Web Storage standar pada browser modern (yaitu localStorage dan sessionStorage) yang bekerja murni di sisi perangkatmu untuk menjaga kenyamanan penggunaan aplikasi.',
        ],
      },
      {
        number: '02',
        heading: 'Rincian Penyimpanan Lokal yang Digunakan',
        paragraphs: [
          'Berikut adalah daftar lengkap data teknis yang disimpan di browser perangkatmu saat menggunakan Tinulung:',
        ],
      },
      {
        number: '03',
        heading: 'Cara Mengelola atau Menghapus Penyimpanan Lokal',
        paragraphs: [
          'Kamu memegang kendali penuh atas penyimpanan browsermu. Untuk membersihkan data di atas, kamu dapat melakukan salah satu cara berikut:',
        ],
        bullets: [
          'Klik tombol "Pengaturan AI" di bagian bawah halaman (footer), lalu tekan tombol "Reset" untuk mengembalikan pengaturan ke bawaan dan menghapus API Key dari sesi aktif.',
          'Tutup tab browser untuk secara otomatis menghapus seluruh isi sessionStorage.',
          'Gunakan fitur "Hapus Data Situs / Clear Site Data" pada pengaturan privasi browser (Chrome, Edge, Firefox, Safari) yang kamu gunakan.',
        ],
      },
    ],
  },
  {
    slug: 'disclaimer',
    path: '/disclaimer',
    title: 'Sanggahan (Disclaimer)',
    shortLabel: 'Sanggahan',
    badge: 'BATASAN TANGGUNG JAWAB & AKURASI AI',
    updatedAt: '27 Oktober 2026',
    subtitle:
      'Informasi penting mengenai akurasi ekstraksi otomatis, penggunaan kecerdasan buatan (AI), dan tanggung jawab verifikasi dokumen.',
    highlights: [
      'Hasil ekstraksi tabel dan jawaban AI disajikan untuk membantu mempercepat pekerjaan, bukan menggantikan verifikasi akhir.',
      'Kami menyediakan fitur "Kutipan Sumber" agar kamu selalu dapat mencocokkan hasil ekstraksi dengan teks asli dokumen.',
      'Tinulung tidak memberikan nasihat hukum, pajak, maupun keuangan atas isi kontrak atau RAB yang diproses.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Akurasi Hasil Ekstraksi & Model AI',
        paragraphs: [
          'Tinulung menggabungkan algoritma ekstraksi dokumen terverifikasi dengan model kecerdasan buatan (AI) untuk membantu merapikan tabel, angka, tanggal, dan rekap pesanan. Meskipun kami merancang sistem verifikasi kutipan sumber untuk meminimalkan kesalahan (halusinasi AI), teknologi otomatis tetap memiliki keterbatasan tergantung kualitas format dokumen asli.',
          'Oleh karena itu, pengguna wajib memeriksa dan memverifikasi kembali kesesuaian angka, nominal rupiah, pasal kontrak, maupun rincian pesanan sebelum menggunakannya untuk pengambilan keputusan bisnis, pengiriman barang, atau transaksi keuangan.',
        ],
      },
      {
        number: '02',
        heading: 'Bukan Nasihat Hukum, Keuangan, atau Profesional',
        paragraphs: [
          'Seluruh ringkasan, jawaban tanya-jawab dokumen, maupun ekstraksi ketentuan denda/kontrak yang dihasilkan oleh Tinulung bersifat informatif sebagai alat bantu pembacaan cepat. Hasil tersebut tidak dapat dianggap sebagai opini hukum, audit keuangan, atau konsultasi profesional.',
        ],
      },
      {
        number: '03',
        heading: 'Tautan Situs Web Eksternal & Penyedia AI Pihak Ketiga',
        paragraphs: [
          'Fitur ekstraksi tautan web dan integrasi penyedia AI eksternal (seperti OpenRouter, Groq, Google Gemini, OpenAI, maupun server OpenClaw mandiri) menghubungkan permintaanmu dengan layanan pihak ketiga. Kami tidak memiliki kendali atas ketersediaan server, perubahan kebijakan, atau isi konten dari situs web eksternal tersebut.',
        ],
      },
      {
        number: '04',
        heading: 'Layanan Sebagaimana Adanya ("As-Is")',
        paragraphs: [
          'Tinulung disediakan dalam kondisi "sebagaimana adanya" (as-is) tanpa jaminan tersurat maupun tersirat. Pengembang Tinulung tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang timbul akibat kesalahan interpretasi data, keterlambatan jaringan, atau kegagalan perangkat saat memproses dokumen.',
        ],
      },
    ],
  },
]

// eslint-disable-next-line react-refresh/only-export-components
export const LEGAL_PAGES_META_EN = [
  {
    slug: 'privacy-policy',
    path: '/privacy-policy',
    title: 'Privacy Policy',
    shortLabel: 'Privacy Policy',
    badge: 'PRIVACY & DATA PROTECTION',
    updatedAt: 'October 27, 2026',
    subtitle:
      'Tinulung’s commitment to safeguarding the confidentiality of documents, PDF files, and data you process in your browser or through AI integrations.',
    highlights: [
      'Merge PDF, Split PDF & Compress PDF work 100% locally in your device browser without ever uploading files to any server.',
      'Instant Mode processes text & table extraction directly without storing your documents in a database.',
      'Personal API Keys are stored only temporarily in tab session memory (sessionStorage) and are automatically cleared when the tab closes.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Core Privacy Principles at Tinulung',
        paragraphs: [
          'Tinulung ("We") is built with Privacy-by-Design principles. We understand that the documents you manage, such as budget plans (RAB), work contracts, transaction invoices, and customer order recaps, are sensitive and confidential.',
          'This Privacy Policy is aligned with the Republic of Indonesia Law No. 27 of 2022 on Personal Data Protection (UU PDP) to transparently explain how data is processed when you use Tinulung.',
        ],
      },
      {
        number: '02',
        heading: 'How We Process Your Documents & Files',
        paragraphs: [
          'Data processing at Tinulung is divided into three mechanisms depending on the feature you use:',
        ],
        bullets: [
          'Client-Side PDF Tools (Merge PDF, Split PDF & Compress PDF): All PDF merging, page splitting, and size compression run 100% inside your device browser (using local WebAssembly/JavaScript libraries). Your PDF files are never sent, uploaded, or stored on Tinulung servers.',
          'Instant Mode / Local Parser (Ask & Extract Data): When you select "Default (Instant, without AI)", document reading and table extraction are performed instantaneously without forwarding document contents to third-party AI providers.',
          'External AI Integration Mode (OpenClaw, Gemini, OpenAI, Claude, etc.): If you enable an AI engine, relevant text excerpts or queries are forwarded over an encrypted connection (HTTPS) to your chosen AI provider solely to generate answers or extracted tables.',
        ],
      },
      {
        number: '03',
        heading: 'API Key Storage & User Preferences',
        paragraphs: [
          'If you enter a personal API Key in AI Settings, that key is stored only in temporary browser session storage (sessionStorage) on your device and is automatically erased as soon as the browser tab or window is closed.',
          'We never log, store, or share your personal API Key in our server database. Non-sensitive preferences such as your chosen provider name and AI model are saved locally in your browser (localStorage) for convenience.',
        ],
      },
      {
        number: '04',
        heading: 'Technical Data & Public Quota Rate Limiting',
        paragraphs: [
          'To keep our free service available for all users and prevent abuse (spam or excessive automation), our server may process minimal technical information such as anonymized IP addresses, request timestamps, and daily public quota counters.',
          'We do not sell, rent, or trade user personal information or document contents to any party for advertising purposes.',
        ],
      },
      {
        number: '05',
        heading: 'User Rights Over Personal Data',
        paragraphs: [
          'In accordance with the Personal Data Protection Law (UU PDP), you have full control over data on your device:',
        ],
        bullets: [
          'Remove any currently opened document at any time via the "Remove document" button or by reloading the page.',
          'Reset AI engine configurations and clear your API Key from the browser session via the "Reset to Default" button in AI Settings.',
          'Clear all local site data (localStorage & sessionStorage) through your browser’s privacy settings.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    path: '/terms',
    title: 'Terms and Conditions',
    shortLabel: 'Terms & Conditions',
    badge: 'TERMS OF SERVICE',
    updatedAt: 'October 27, 2026',
    subtitle:
      'Rules for using our services, fair use limits, intellectual property rights, and voluntary tip-jar support terms on Tinulung.',
    highlights: [
      'Tinulung is free to use for personal, academic, small business (MSME), and professional workflows.',
      'Users are solely responsible for the legality and access rights of documents uploaded or extracted.',
      'Support through "Treat Cilok / Server Support" via QRIS is completely voluntary and non-binding.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Acceptance of Terms & Conditions',
        paragraphs: [
          'By accessing and using the Tinulung website and digital workspace tools, you acknowledge that you have read, understood, and agreed to these Terms and Conditions. If you do not agree with any part of these terms, please discontinue using the service.',
        ],
      },
      {
        number: '02',
        heading: 'Permitted Use & Restrictions',
        paragraphs: [
          'Tinulung is provided as a digital productivity utility. When using our services, you agree not to engage in the following activities:',
        ],
        bullets: [
          'Uploading or processing unlawful documents, malware, or files that infringe upon third-party copyrights or confidentiality without authorization.',
          'Performing automated scraping, Denial-of-Service (DDoS) attacks, or bypassing public quota limits in ways that disrupt other users.',
          'Using the web link extraction feature to harvest protected data in violation of the target website’s terms of service.',
        ],
      },
      {
        number: '03',
        heading: 'Intellectual Property & Document Ownership',
        paragraphs: [
          'Full ownership of all PDF files, documents, text, and data you upload, as well as extracted outputs (CSV, JSON, merged/split/compressed PDFs), remains entirely yours.',
          'Meanwhile, the Tinulung name, logo, interface design, and application source code are protected under applicable intellectual property laws.',
        ],
      },
      {
        number: '04',
        heading: 'Service Availability & Public Quota',
        paragraphs: [
          'We strive to keep Tinulung accessible 24/7. However, features utilizing the shared public AI quota are subject to daily fair-use limits. When the public quota is full, you can still use Instant Mode (Local Parser), all PDF tools, or connect your own personal API Key.',
        ],
      },
      {
        number: '05',
        heading: 'Voluntary Support Terms ("Treat Cilok" QRIS)',
        paragraphs: [
          'The "Treat Cilok / Server Support" feature uses the National QRIS payment standard as a voluntary tip-jar to help cover server operating costs and new feature development.',
          'Any support funds sent are voluntary tips/grants, are non-refundable, and do not create special paid subscription obligations beyond the openly available features.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    path: '/cookies',
    title: 'Cookie & Storage Policy',
    shortLabel: 'Cookie Policy',
    badge: 'COOKIES & BROWSER STORAGE',
    updatedAt: 'October 27, 2026',
    subtitle:
      'Transparent explanation of how Tinulung uses local browser storage (LocalStorage & SessionStorage) with zero third-party ad trackers.',
    highlights: [
      'Tinulung does NOT use third-party advertising tracker cookies (zero ad-trackers).',
      'We only use native browser LocalStorage & SessionStorage to remember your tool and language preferences.',
      'You can clear local storage at any time directly from AI Settings or your browser settings.',
    ],
    storageTable: {
      columns: ['Storage Key Name', 'Type', 'Purpose', 'Retention'],
      rows: [
        [
          'tinulung_engine_config',
          'localStorage',
          'Saves your selected processing engine (e.g. Instant Mode, OpenClaw, Gemini) and chosen AI model name.',
          'Kept until reset by user',
        ],
        [
          'tinulung_ui_lang',
          'localStorage',
          'Saves your selected interface language preference (Bahasa Indonesia or English).',
          'Kept until cleared by user',
        ],
        [
          'tinulung_user_api_key',
          'sessionStorage',
          'Temporarily holds your personal API Key so you do not have to retype it while the tab remains open.',
          'Automatically deleted when tab closes',
        ],
      ],
    },
    sections: [
      {
        number: '01',
        heading: 'Does Tinulung Use Cookies?',
        paragraphs: [
          'Unlike many websites that install dozens of tracking cookies for targeted advertising, Tinulung does not install behavioral tracking cookies or third-party advertising pixels.',
          'Instead, we rely on standard Web Storage technologies in modern browsers (localStorage and sessionStorage) that operate purely on your device to keep your workspace preferences intact.',
        ],
      },
      {
        number: '02',
        heading: 'Details of Local Storage Used',
        paragraphs: [
          'Below is the complete list of technical keys stored in your device browser when using Tinulung:',
        ],
      },
      {
        number: '03',
        heading: 'How to Manage or Clear Local Storage',
        paragraphs: [
          'You have full control over your browser storage. To clear the data above, you can do any of the following:',
        ],
        bullets: [
          'Click "AI Settings" in the page footer, then press "Reset to Default" to restore default settings and remove any API Key from the active session.',
          'Close the browser tab to automatically erase all sessionStorage data.',
          'Use the "Clear Site Data" feature in your browser privacy settings (Chrome, Edge, Firefox, Safari).',
        ],
      },
    ],
  },
  {
    slug: 'disclaimer',
    path: '/disclaimer',
    title: 'Disclaimer',
    shortLabel: 'Disclaimer',
    badge: 'LIMITATION OF LIABILITY & AI ACCURACY',
    updatedAt: 'October 27, 2026',
    subtitle:
      'Important information regarding automated extraction accuracy, artificial intelligence (AI) usage, and document verification responsibility.',
    highlights: [
      'Extracted tables and AI answers are provided to speed up your workflow, not to replace final human verification.',
      'We provide "Source Citations" so you can always cross-check extracted results against the original document text.',
      'Tinulung does not provide legal, tax, or financial advice on contracts or budget documents processed.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Extraction Accuracy & AI Models',
        paragraphs: [
          'Tinulung combines verified document extraction algorithms with artificial intelligence (AI) models to help organize tables, numbers, dates, and order recaps. While we designed source citation verification to minimize AI hallucinations, automated parsing still has limitations depending on the formatting quality of the original file.',
          'Therefore, users must review and verify numbers, currency amounts, contract clauses, and order details before relying on them for business decisions, shipments, or financial transactions.',
        ],
      },
      {
        number: '02',
        heading: 'No Legal, Financial, or Professional Advice',
        paragraphs: [
          'All summaries, document Q&A responses, and contract/penalty clause extractions generated by Tinulung are strictly informational reading aids. They do not constitute legal opinions, financial audits, or professional consultation.',
        ],
      },
      {
        number: '03',
        heading: 'External Website Links & Third-Party AI Providers',
        paragraphs: [
          'Web link extraction and external AI provider integrations (such as Google Gemini, OpenAI, Anthropic Claude, or self-hosted OpenClaw servers) connect your requests to third-party services. We have no control over server availability, policy changes, or content hosted on those external services.',
        ],
      },
      {
        number: '04',
        heading: 'Service Provided "As-Is"',
        paragraphs: [
          'Tinulung is provided on an "as-is" basis without warranties of any kind, either express or implied. The developers of Tinulung are not liable for direct or indirect damages arising from data misinterpretation, network delays, or device failures while processing documents.',
        ],
      },
    ],
  },
]

// eslint-disable-next-line react-refresh/only-export-components
export function getLegalPagesMeta(lang = 'id') {
  return lang === 'en' ? LEGAL_PAGES_META_EN : LEGAL_PAGES_META
}

export function AboutPage() {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const isEn = lang === 'en'

  return (
    <section className="clean-hero-section legal-page-section">
      <h1 className="editorial-hero-title legal-hero-title">
        {isEn ? 'About Tinulung' : 'Tentang Tinulung'}
      </h1>
      <p className="editorial-hero-subtitle legal-hero-subtitle">
        {isEn
          ? 'Practical digital workspace utilities built to help you finish daily document, table, and PDF tasks quickly without the hassle.'
          : 'Alat bantu digital praktis berbahasa Indonesia yang dibuat agar pekerjaan dokumen, tabel, dan berkas PDF harianmu cepat beres tanpa ribet.'}
      </p>

      <div className="clean-workspace-card legal-document-card">
        <div className="legal-doc-topbar">
          <div className="legal-doc-status">
            <span className="legal-updated-date">
              {isEn ? 'Maintained by: ' : 'Pengelola: '}
              <strong>Tinulung Digital</strong>
            </span>
          </div>

          <button
            type="button"
            className="sample-doc-trigger-btn"
            onClick={() => navigate('/')}
          >
            <span>{isEn ? 'Back to Home' : 'Kembali ke Beranda'}</span>
            <IconArrowUpRight size={13} />
          </button>
        </div>

        {/* INTISARI TENTANG TINULUNG */}
        <div className="legal-highlights-box">
          <div className="legal-highlights-head">
            <IconSparkle size={14} />
            <strong>{isEn ? 'Why Tinulung Exists' : 'Kenapa Tinulung Hadir?'}</strong>
          </div>
          <ul className="legal-highlights-list">
            <li>
              <span className="lh-check" aria-hidden="true">
                <IconCheck size={12} />
              </span>
              <span>
                {isEn ? (
                  <>
                    Named after the Javanese/Indonesian word <strong>&ldquo;Tinulung&rdquo;</strong>, meaning sincere help and mutual assistance.
                  </>
                ) : (
                  <>
                    Diambil dari kata bahasa Jawa/Indonesia <strong>&ldquo;Tinulung&rdquo;</strong> yang berarti pertolongan atau bantuan yang tulus.
                  </>
                )}
              </span>
            </li>
            <li>
              <span className="lh-check" aria-hidden="true">
                <IconCheck size={12} />
              </span>
              <span>
                {isEn
                  ? 'Designed so anyone can immediately process documents without mandatory account registration or expensive subscriptions.'
                  : 'Dirancang agar siapa saja bisa langsung memproses dokumen tanpa harus registrasi akun atau berlangganan mahal.'}
              </span>
            </li>
            <li>
              <span className="lh-check" aria-hidden="true">
                <IconCheck size={12} />
              </span>
              <span>
                {isEn
                  ? 'Privacy-first architecture: PDF tools run 100% locally in your browser, alongside Instant Mode and optional AI integrations.'
                  : 'Mengutamakan keamanan privasi: alat PDF bekerja 100% lokal di browser, serta mendukung Mode Instan maupun AI pilihanmu.'}
              </span>
            </li>
          </ul>
        </div>

        {/* DAFTAR FITUR UTAMA */}
        <div className="about-features-showcase">
          <div className="about-feature-item">
            <span className="about-feat-icon">
              <IconFileText size={16} />
            </span>
            <div>
              <h3>
                {isEn
                  ? 'Verified Document Q&A & Extraction'
                  : 'Tanya & Ekstrak Dokumen Terverifikasi'}
              </h3>
              <p>
                {isEn
                  ? 'Upload PDF, CSV, TXT, or JSON files to extract budget tables, payment terms, and answers backed by original source citations.'
                  : 'Unggah PDF, CSV, TXT, atau JSON untuk mengekstrak tabel RAB, termin bayar, serta jawaban yang dilengkapi kutipan sumber asli.'}
              </p>
            </div>
          </div>

          <div className="about-feature-item">
            <span className="about-feat-icon">
              <IconTable size={16} />
            </span>
            <div>
              <h3>
                {isEn
                  ? 'Web Link Extraction & WA Order Recap'
                  : 'Ekstrak Link Web & Rekap Order WA'}
              </h3>
              <p>
                {isEn
                  ? 'Turn tables from web pages into CSV/Excel or tidy up customer WhatsApp order chats into structured tables.'
                  : 'Ubah tabel dari halaman web menjadi CSV/Excel atau rapikan chat pesanan WhatsApp pelanggan jadi rekap tabel siap kirim.'}
              </p>
            </div>
          </div>

          <div className="about-feature-item">
            <span className="about-feat-icon">
              <IconMergePdf size={16} />
            </span>
            <div>
              <h3>
                {isEn
                  ? 'Merge PDF 100% in Browser'
                  : 'Gabung PDF (Merge) 100% di Browser'}
              </h3>
              <p>
                {isEn
                  ? 'Reorder and combine multiple PDF files into a single document without ever uploading your files to an external server.'
                  : 'Susun urutan dan satukan banyak berkas PDF menjadi satu dokumen utuh tanpa pernah mengunggah file ke server luar.'}
              </p>
            </div>
          </div>

          <div className="about-feature-item">
            <span className="about-feat-icon">
              <IconSplitPdf size={16} />
            </span>
            <div>
              <h3>
                {isEn
                  ? 'Fast & Private PDF Split & Compress'
                  : 'Pisah PDF (Split) Cepat & Aman'}
              </h3>
              <p>
                {isEn
                  ? 'Extract custom page ranges, split every page into separate PDFs, or compress PDF file sizes directly on your device.'
                  : 'Ambil rentang halaman tertentu atau pecah setiap halaman PDF menjadi berkas terpisah secara instan di perangkatmu.'}
              </p>
            </div>
          </div>
        </div>

        {/* SEKSI INFORMASI & FILOSOFI (MURNI INFORMASI TANPA TOMBOL) */}
        <div className="legal-sections-list">
          <article className="legal-section-block">
            <div className="legal-section-header">
              <span className="legal-sec-num">01</span>
              <h2>
                {isEn ? 'Philosophy & Service Independence' : 'Filosofi & Kemandirian Layanan'}
              </h2>
            </div>
            <div className="legal-section-body">
              <p>
                {isEn
                  ? 'Many office workers, small business owners, online shop admins, and students spend hours manually copying tables from PDFs into Excel, checking clauses in budget documents, or recapping order chats one by one.'
                  : 'Banyak pekerja kantor, pelaku UMKM, admin toko online, hingga mahasiswa sering menghabiskan waktu berjam-jam hanya untuk menyalin tabel dari PDF ke Excel, mengecek pasal di dokumen RAB, atau merekap chat pesanan satu per satu.'}
              </p>
              <p>
                {isEn
                  ? 'Tinulung is built to stay lightweight, free from intrusive pop-up ads, and ready to speed up daily administrative work across any device.'
                  : 'Tinulung dibangun agar tetap ringan, bebas dari iklan pop-up yang mengganggu, dan selalu siap membantu mempercepat pekerjaan administrasi harian di berbagai perangkat.'}
              </p>
            </div>
          </article>

          <article className="legal-section-block">
            <div className="legal-section-header">
              <span className="legal-sec-num">02</span>
              <h2>
                {isEn ? 'Transparency & Communication Channels' : 'Transparansi & Saluran Komunikasi'}
              </h2>
            </div>
            <div className="legal-section-body">
              <p>
                {isEn ? (
                  <>
                    We are always open to feature suggestions, technical bug reports, and general questions. You can reach our development team anytime through the <strong>Contact</strong> menu in the website footer.
                  </>
                ) : (
                  <>
                    Kami selalu terbuka terhadap saran pengembangan fitur baru, laporan kendala teknis, maupun pertanyaan seputar layanan. Kamu dapat menghubungi tim pengembang kapan saja melalui menu <strong>Kontak</strong> yang tersedia di bagian bawah (footer) situs ini.
                  </>
                )}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export default function LegalPage({ pageSlug = 'privacy-policy' }) {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const isEn = lang === 'en'
  const pagesList = getLegalPagesMeta(lang)
  const activePage =
    pagesList.find((p) => p.slug === pageSlug) || pagesList[0]

  return (
    <section className="clean-hero-section legal-page-section">
      <h1 className="editorial-hero-title legal-hero-title">{activePage.title}</h1>
      <p className="editorial-hero-subtitle legal-hero-subtitle">{activePage.subtitle}</p>

      {/* NAVIGASI ANTAR DOKUMEN KEBIJAKAN LEGAL (MURNI 4 KEBIJAKAN) */}
      <nav
        className="legal-tabs-nav"
        aria-label={isEn ? 'Legal Policy Pages Navigation' : 'Navigasi Halaman Kebijakan Legal'}
      >
        {pagesList.map((item) => {
          const isCurrent = item.slug === activePage.slug
          return (
            <Link
              key={item.slug}
              to={item.path}
              className={`legal-tab-pill ${isCurrent ? 'is-active' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <IconFileText size={13} />
              <span>{item.shortLabel}</span>
            </Link>
          )
        })}
      </nav>

      {/* KARTU KONTEN DOKUMEN RESMI */}
      <div className="clean-workspace-card legal-document-card">
        <div className="legal-doc-topbar">
          <div className="legal-doc-status">
            <span className="legal-updated-date">
              {isEn ? 'Last updated: ' : 'Terakhir diperbarui: '}
              <strong>{activePage.updatedAt}</strong>
            </span>
          </div>

          <button
            type="button"
            className="sample-doc-trigger-btn"
            onClick={() => navigate('/')}
          >
            <span>{isEn ? 'Back to Home' : 'Kembali ke Beranda'}</span>
            <IconArrowUpRight size={13} />
          </button>
        </div>

        {/* RINGKASAN CEPAT / INTISARI */}
        {activePage.highlights && activePage.highlights.length > 0 && (
          <div className="legal-highlights-box">
            <div className="legal-highlights-head">
              <IconSparkle size={14} />
              <strong>
                {isEn ? 'Key Highlights (Quick Summary)' : 'Intisari Singkat (Ringkasan Cepat)'}
              </strong>
            </div>
            <ul className="legal-highlights-list">
              {activePage.highlights.map((point, idx) => (
                <li key={idx}>
                  <span className="lh-check" aria-hidden="true">
                    <IconCheck size={12} />
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ISI PASAL / BAGIAN DOKUMEN */}
        <div className="legal-sections-list">
          {activePage.sections.map((sec) => (
            <article key={sec.number} className="legal-section-block">
              <div className="legal-section-header">
                <span className="legal-sec-num">{sec.number}</span>
                <h2>{sec.heading}</h2>
              </div>

              <div className="legal-section-body">
                {sec.paragraphs?.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}

                {sec.bullets && sec.bullets.length > 0 && (
                  <ul className="legal-bullet-list">
                    {sec.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}

                {/* TABEL RINCIAN PENYIMPANAN KHUSUS KEBIJAKAN COOKIE */}
                {(activePage.slug === 'cookies' || activePage.slug === 'kebijakan-cookie') &&
                  sec.number === '02' &&
                  activePage.storageTable && (
                    <div className="clean-table-wrapper legal-storage-table">
                      <table className="clean-data-table">
                        <thead>
                          <tr>
                            {activePage.storageTable.columns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activePage.storageTable.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx}>
                                  {cIdx === 0 ? <code>{cell}</code> : cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
