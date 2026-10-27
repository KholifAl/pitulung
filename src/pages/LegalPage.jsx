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
      'Komitmen Pitulung dalam menjaga kerahasiaan dokumen, berkas PDF, dan data yang kamu proses di browser maupun melalui integrasi AI.',
    highlights: [
      'Alat Gabung PDF & Pisah PDF bekerja 100% lokal di browser perangkatmu tanpa pernah diunggah ke server.',
      'Mode Instan memproses ekstraksi teks & tabel secara langsung tanpa menyimpan dokumenmu di database.',
      'API Key pribadi hanya disimpan sementara di memori sesi tab (sessionStorage) dan otomatis terhapus saat tab ditutup.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Prinsip Utama Privasi di Pitulung',
        paragraphs: [
          'Pitulung ("Kami") dirancang dengan prinsip Privacy-by-Design. Kami memahami bahwa dokumen yang kamu kelola, seperti Rencana Anggaran Biaya (RAB), kontrak kerja, nota transaksi, hingga rekap pesanan pelanggan, bersifat penting dan rahasia.',
          'Kebijakan Privasi ini disusun selaras dengan Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP) untuk menjelaskan secara transparan bagaimana data diproses saat kamu menggunakan layanan Pitulung.',
        ],
      },
      {
        number: '02',
        heading: 'Cara Kami Memproses Dokumen & Berkas Kamu',
        paragraphs: [
          'Pemrosesan data di Pitulung terbagi menjadi tiga mekanisme sesuai fitur yang kamu gunakan:',
        ],
        bullets: [
          'Alat PDF Client-Side (Gabung PDF & Pisah PDF): Seluruh proses penggabungan dan pemisahan halaman PDF dijalankan 100% di dalam browser perangkatmu (menggunakan pustaka WebAssembly/JavaScript lokal). Berkas PDF tidak pernah dikirim, diunggah, atau disimpan di server Pitulung.',
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
      'Aturan penggunaan layanan, batasan pemakaian wajar, hak kekayaan intelektual, serta ketentuan dukungan donasi sukarela di Pitulung.',
    highlights: [
      'Pitulung dapat digunakan secara gratis untuk kebutuhan personal, akademik, UMKM, maupun pekerjaan profesional.',
      'Pengguna bertanggung jawab penuh atas legalitas dan hak akses dokumen yang diunggah atau diekstrak.',
      'Dukungan melalui fitur "Traktir Cilok / Patungan Server" via QRIS bersifat sukarela dan tidak mengikat.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Penerimaan Syarat & Ketentuan',
        paragraphs: [
          'Dengan mengakses dan menggunakan situs web serta seluruh alat bantu digital Pitulung, kamu menyatakan telah membaca, memahami, dan menyetujui Syarat dan Ketentuan ini. Apabila kamu tidak menyetujui bagian mana pun dari ketentuan ini, mohon untuk menghentikan penggunaan layanan.',
        ],
      },
      {
        number: '02',
        heading: 'Penggunaan yang Diperbolehkan & Larangan',
        paragraphs: [
          'Pitulung disediakan sebagai alat bantu produktivitas digital. Dalam menggunakan layanan kami, kamu setuju untuk tidak melakukan tindakan berikut:',
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
          'Sementara itu, merek, logo, desain antarmuka, dan kode sumber aplikasi Pitulung dilindungi oleh hak kekayaan intelektual yang berlaku.',
        ],
      },
      {
        number: '04',
        heading: 'Ketersediaan Layanan & Kuota Publik',
        paragraphs: [
          'Kami berupaya menjaga agar Pitulung selalu dapat diakses 24/7. Namun, fitur yang menggunakan kuota AI publik bersama memiliki batas pemakaian wajar harian. Ketika kuota publik sedang penuh, kamu tetap dapat menggunakan Mode Instan (Parser Lokal), alat PDF, atau menghubungkan API Key pribadimu sendiri.',
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
    title: 'Kebijakan Cookie & Penyimpanan Lokal',
    shortLabel: 'Kebijakan Cookie',
    badge: 'COOKIE & PENYIMPANAN BROWSER',
    updatedAt: '27 Oktober 2026',
    subtitle:
      'Penjelasan transparan mengenai bagaimana Pitulung menggunakan penyimpanan lokal browser (LocalStorage & SessionStorage) tanpa cookie pelacak iklan.',
    highlights: [
      'Pitulung TIDAK menggunakan cookie pelacak iklan pihak ketiga (zero ad-trackers).',
      'Kami hanya menggunakan LocalStorage & SessionStorage bawaan browser untuk menyimpan preferensi alatmu.',
      'Kamu dapat menghapus penyimpanan lokal kapan saja langsung dari menu Pengaturan AI atau pengaturan browser.',
    ],
    storageTable: {
      columns: ['Nama Kunci Penyimpanan', 'Jenis', 'Tujuan Penggunaan', 'Masa Berlaku'],
      rows: [
        [
          'pitulung_engine_config',
          'localStorage',
          'Menyimpan pilihan mesin pemroses (mis. Mode Instan, OpenClaw, Gemini) dan nama model AI pilihanmu.',
          'Tersimpan hingga di-reset pengguna',
        ],
        [
          'pitulung_user_api_key',
          'sessionStorage',
          'Menyimpan API Key pribadi secara sementara agar tidak perlu diketik ulang selama tab masih aktif.',
          'Otomatis hilang saat tab ditutup',
        ],
      ],
    },
    sections: [
      {
        number: '01',
        heading: 'Apakah Pitulung Menggunakan Cookie?',
        paragraphs: [
          'Berbeda dengan banyak situs web yang memasang puluhan cookie pelacak untuk menargetkan iklan, Pitulung tidak memasang cookie pelacakan perilaku (behavioral tracking cookies) maupun piksel periklanan pihak ketiga.',
          'Sebagai gantinya, kami memanfaatkan teknologi Web Storage standar pada browser modern (yaitu localStorage dan sessionStorage) yang bekerja murni di sisi perangkatmu untuk menjaga kenyamanan penggunaan aplikasi.',
        ],
      },
      {
        number: '02',
        heading: 'Rincian Penyimpanan Lokal yang Digunakan',
        paragraphs: [
          'Berikut adalah daftar lengkap data teknis yang disimpan di browser perangkatmu saat menggunakan Pitulung:',
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
      'Pitulung tidak memberikan nasihat hukum, pajak, maupun keuangan atas isi kontrak atau RAB yang diproses.',
    ],
    sections: [
      {
        number: '01',
        heading: 'Akurasi Hasil Ekstraksi & Model AI',
        paragraphs: [
          'Pitulung menggabungkan algoritma ekstraksi dokumen terverifikasi dengan model kecerdasan buatan (AI) untuk membantu merapikan tabel, angka, tanggal, dan rekap pesanan. Meskipun kami merancang sistem verifikasi kutipan sumber untuk meminimalkan kesalahan (halusinasi AI), teknologi otomatis tetap memiliki keterbatasan tergantung kualitas format dokumen asli.',
          'Oleh karena itu, pengguna wajib memeriksa dan memverifikasi kembali kesesuaian angka, nominal rupiah, pasal kontrak, maupun rincian pesanan sebelum menggunakannya untuk pengambilan keputusan bisnis, pengiriman barang, atau transaksi keuangan.',
        ],
      },
      {
        number: '02',
        heading: 'Bukan Nasihat Hukum, Keuangan, atau Profesional',
        paragraphs: [
          'Seluruh ringkasan, jawaban tanya-jawab dokumen, maupun ekstraksi ketentuan denda/kontrak yang dihasilkan oleh Pitulung bersifat informatif sebagai alat bantu pembacaan cepat. Hasil tersebut tidak dapat dianggap sebagai opini hukum, audit keuangan, atau konsultasi profesional.',
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
          'Pitulung disediakan dalam kondisi "sebagaimana adanya" (as-is) tanpa jaminan tersurat maupun tersirat. Pengembang Pitulung tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang timbul akibat kesalahan interpretasi data, keterlambatan jaringan, atau kegagalan perangkat saat memproses dokumen.',
        ],
      },
    ],
  },
]

export function AboutPage() {
  const navigate = useNavigate()

  return (
    <section className="clean-hero-section legal-page-section">
      <h1 className="editorial-hero-title legal-hero-title">Tentang Pitulung</h1>
      <p className="editorial-hero-subtitle legal-hero-subtitle">
        Alat bantu digital praktis berbahasa Indonesia yang dibuat agar pekerjaan dokumen, tabel, dan berkas PDF harianmu cepat beres tanpa ribet.
      </p>

      <div className="clean-workspace-card legal-document-card">
        <div className="legal-doc-topbar">
          <div className="legal-doc-status">
            <span className="legal-updated-date">
              Pengelola: <strong>Pitulung Digital</strong>
            </span>
          </div>

          <button
            type="button"
            className="sample-doc-trigger-btn"
            onClick={() => navigate('/')}
          >
            <span>Kembali ke Beranda</span>
            <IconArrowUpRight size={13} />
          </button>
        </div>

        {/* INTISARI TENTANG PITULUNG */}
        <div className="legal-highlights-box">
          <div className="legal-highlights-head">
            <IconSparkle size={14} />
            <strong>Kenapa Pitulung Hadir?</strong>
          </div>
          <ul className="legal-highlights-list">
            <li>
              <span className="lh-check" aria-hidden="true">
                <IconCheck size={12} />
              </span>
              <span>
                Diambil dari kata bahasa Jawa/Indonesia <strong>&ldquo;Pitulung&rdquo;</strong> yang berarti pertolongan atau bantuan yang tulus.
              </span>
            </li>
            <li>
              <span className="lh-check" aria-hidden="true">
                <IconCheck size={12} />
              </span>
              <span>
                Dirancang agar siapa saja bisa langsung memproses dokumen tanpa harus registrasi akun atau berlangganan mahal.
              </span>
            </li>
            <li>
              <span className="lh-check" aria-hidden="true">
                <IconCheck size={12} />
              </span>
              <span>
                Mengutamakan keamanan privasi: alat PDF bekerja 100% lokal di browser, serta mendukung Mode Instan maupun AI pilihanmu.
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
              <h3>Tanya &amp; Ekstrak Dokumen Terverifikasi</h3>
              <p>
                Unggah PDF, CSV, TXT, atau JSON untuk mengekstrak tabel RAB, termin bayar, serta jawaban yang dilengkapi kutipan sumber asli.
              </p>
            </div>
          </div>

          <div className="about-feature-item">
            <span className="about-feat-icon">
              <IconTable size={16} />
            </span>
            <div>
              <h3>Ekstrak Link Web &amp; Rekap Order WA</h3>
              <p>
                Ubah tabel dari halaman web menjadi CSV/Excel atau rapikan chat pesanan WhatsApp pelanggan jadi rekap tabel siap kirim.
              </p>
            </div>
          </div>

          <div className="about-feature-item">
            <span className="about-feat-icon">
              <IconMergePdf size={16} />
            </span>
            <div>
              <h3>Gabung PDF (Merge) 100% di Browser</h3>
              <p>
                Susun urutan dan satukan banyak berkas PDF menjadi satu dokumen utuh tanpa pernah mengunggah file ke server luar.
              </p>
            </div>
          </div>

          <div className="about-feature-item">
            <span className="about-feat-icon">
              <IconSplitPdf size={16} />
            </span>
            <div>
              <h3>Pisah PDF (Split) Cepat &amp; Aman</h3>
              <p>
                Ambil rentang halaman tertentu atau pecah setiap halaman PDF menjadi berkas terpisah secara instan di perangkatmu.
              </p>
            </div>
          </div>
        </div>

        {/* SEKSI INFORMASI & FILOSOFI (MURNI INFORMASI TANPA TOMBOL) */}
        <div className="legal-sections-list">
          <article className="legal-section-block">
            <div className="legal-section-header">
              <span className="legal-sec-num">01</span>
              <h2>Filosofi &amp; Kemandirian Layanan</h2>
            </div>
            <div className="legal-section-body">
              <p>
                Banyak pekerja kantor, pelaku UMKM, admin toko online, hingga mahasiswa sering menghabiskan waktu berjam-jam hanya untuk menyalin tabel dari PDF ke Excel, mengecek pasal di dokumen RAB, atau merekap chat pesanan satu per satu.
              </p>
              <p>
                Pitulung dibangun agar tetap ringan, bebas dari iklan pop-up yang mengganggu, dan selalu siap membantu mempercepat pekerjaan administrasi harian di berbagai perangkat.
              </p>
            </div>
          </article>

          <article className="legal-section-block">
            <div className="legal-section-header">
              <span className="legal-sec-num">02</span>
              <h2>Transparansi &amp; Saluran Komunikasi</h2>
            </div>
            <div className="legal-section-body">
              <p>
                Kami selalu terbuka terhadap saran pengembangan fitur baru, laporan kendala teknis, maupun pertanyaan seputar layanan. Kamu dapat menghubungi tim pengembang kapan saja melalui menu <strong>Kontak</strong> yang tersedia di bagian bawah (footer) situs ini.
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
  const activePage =
    LEGAL_PAGES_META.find((p) => p.slug === pageSlug) || LEGAL_PAGES_META[0]

  return (
    <section className="clean-hero-section legal-page-section">
      <h1 className="editorial-hero-title legal-hero-title">{activePage.title}</h1>
      <p className="editorial-hero-subtitle legal-hero-subtitle">{activePage.subtitle}</p>

      {/* NAVIGASI ANTAR DOKUMEN KEBIJAKAN LEGAL (MURNI 4 KEBIJAKAN) */}
      <nav className="legal-tabs-nav" aria-label="Navigasi Halaman Kebijakan Legal">
        {LEGAL_PAGES_META.map((item) => {
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
              Terakhir diperbarui: <strong>{activePage.updatedAt}</strong>
            </span>
          </div>

          <button
            type="button"
            className="sample-doc-trigger-btn"
            onClick={() => navigate('/')}
          >
            <span>Kembali ke Beranda</span>
            <IconArrowUpRight size={13} />
          </button>
        </div>

        {/* RINGKASAN CEPAT / INTISARI */}
        {activePage.highlights && activePage.highlights.length > 0 && (
          <div className="legal-highlights-box">
            <div className="legal-highlights-head">
              <IconSparkle size={14} />
              <strong>Intisari Singkat (Ringkasan Cepat)</strong>
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
                {activePage.slug === 'kebijakan-cookie' &&
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
