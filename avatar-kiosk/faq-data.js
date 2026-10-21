/*
 * ==========================================================
 *  KIOSK CONFIG + FAQ CONTENT — edit this file only.
 *  Every text field has { bm: "...", en: "..." }.
 * ==========================================================
 */
window.KIOSK_CONFIG = {
  org: {
    name: "Nama Organisasi",
    tagline: { bm: "Rakan Setia Anda", en: "Your Trusted Partner" },
    logo: "",                 // e.g. "assets/logo.png" — leave empty to show initials
    website: "www.contoh.gov.my",
  },
  avatar: {
    name: "TEJA",
    role: { bm: "Pembantu Maya", en: "Virtual Assistant" },
    image: "",                // e.g. "assets/avatar.png" (transparent PNG works best). Empty = built-in illustrated avatar
    voiceRate: 1.0,           // speech speed 0.5 – 1.5
    voicePitch: 1.1,
  },
  defaultLang: "bm",          // "bm" or "en"
  idleTimeoutSec: 60,         // return to home screen after N seconds without a touch
};

/* Icons available: wallet, file, clipboard, folder, cap, help, phone, map, clock, user */
window.KIOSK_FAQ = [
  {
    id: "pembiayaan",
    icon: "wallet",
    title: { bm: "Pembiayaan", en: "Financing" },
    subtitle: { bm: "Kenali kemudahan pembiayaan", en: "Learn about our financing" },
    questions: [
      {
        q: { bm: "Apakah jenis pembiayaan yang ditawarkan?", en: "What types of financing are offered?" },
        a: {
          bm: "Kami menawarkan pembiayaan modal kerja, pembelian peralatan dan pembesaran perniagaan untuk usahawan mikro dan kecil. Jumlah dan tempoh bergantung kepada jenis perniagaan anda.",
          en: "We offer working capital, equipment purchase and business expansion financing for micro and small entrepreneurs. The amount and tenure depend on your type of business.",
        },
      },
      {
        q: { bm: "Berapakah had maksimum pembiayaan?", en: "What is the maximum financing amount?" },
        a: {
          bm: "Had pembiayaan bergantung kepada skim yang dipohon dan keupayaan bayaran balik anda. Sila rujuk pegawai kami di kaunter untuk maklumat terkini.",
          en: "The limit depends on the scheme you apply for and your repayment capacity. Please ask our officers at the counter for the latest details.",
        },
      },
      {
        q: { bm: "Berapa lama tempoh bayaran balik?", en: "How long is the repayment period?" },
        a: {
          bm: "Tempoh bayaran balik biasanya antara enam bulan hingga lima tahun, mengikut jumlah pembiayaan yang diluluskan.",
          en: "Repayment periods usually range from six months to five years, depending on the approved amount.",
        },
      },
    ],
  },
  {
    id: "permohonan",
    icon: "file",
    title: { bm: "Cara Permohonan", en: "How to Apply" },
    subtitle: { bm: "Panduan proses permohonan", en: "Application process guide" },
    questions: [
      {
        q: { bm: "Bagaimana cara untuk memohon?", en: "How do I apply?" },
        a: {
          bm: "Anda boleh memohon secara dalam talian melalui laman web kami, atau datang terus ke mana-mana pejabat cawangan dengan membawa dokumen yang diperlukan.",
          en: "You can apply online through our website, or walk in to any branch office with the required documents.",
        },
      },
      {
        q: { bm: "Berapa lama proses kelulusan?", en: "How long does approval take?" },
        a: {
          bm: "Permohonan yang lengkap biasanya diproses dalam tempoh empat belas hari bekerja.",
          en: "Complete applications are usually processed within fourteen working days.",
        },
      },
      {
        q: { bm: "Bagaimana menyemak status permohonan?", en: "How do I check my application status?" },
        a: {
          bm: "Sila log masuk ke portal dalam talian atau hubungi talian khidmat pelanggan kami dengan nombor kad pengenalan anda.",
          en: "Log in to the online portal or call our customer service line with your identity card number.",
        },
      },
    ],
  },
  {
    id: "kelayakan",
    icon: "clipboard",
    title: { bm: "Syarat Kelayakan", en: "Eligibility" },
    subtitle: { bm: "Maklumat syarat permohonan", en: "Application requirements" },
    questions: [
      {
        q: { bm: "Siapakah yang layak memohon?", en: "Who is eligible to apply?" },
        a: {
          bm: "Warganegara Malaysia berumur lapan belas tahun ke atas yang menjalankan atau ingin memulakan perniagaan yang sah.",
          en: "Malaysian citizens aged eighteen and above who run, or plan to start, a legitimate business.",
        },
      },
      {
        q: { bm: "Adakah perniagaan perlu didaftarkan?", en: "Must my business be registered?" },
        a: {
          bm: "Ya, perniagaan perlu didaftarkan dengan SSM atau pihak berkuasa tempatan, atau mempunyai lesen perniagaan yang sah.",
          en: "Yes, the business must be registered with SSM or the local authority, or hold a valid business licence.",
        },
      },
    ],
  },
  {
    id: "dokumen",
    icon: "folder",
    title: { bm: "Dokumen Diperlukan", en: "Required Documents" },
    subtitle: { bm: "Senarai dokumen sokongan", en: "Supporting documents list" },
    questions: [
      {
        q: { bm: "Apakah dokumen yang perlu dibawa?", en: "Which documents should I bring?" },
        a: {
          bm: "Salinan kad pengenalan, sijil pendaftaran perniagaan, penyata bank tiga bulan terkini, dan gambar premis perniagaan.",
          en: "A copy of your identity card, business registration certificate, the latest three months of bank statements, and photos of your business premises.",
        },
      },
      {
        q: { bm: "Perlukah penjamin?", en: "Do I need a guarantor?" },
        a: {
          bm: "Bagi sesetengah skim, penjamin diperlukan. Pegawai kami akan memaklumkan anda semasa proses permohonan.",
          en: "Some schemes require a guarantor. Our officers will let you know during the application process.",
        },
      },
    ],
  },
  {
    id: "program",
    icon: "cap",
    title: { bm: "Program & Latihan", en: "Programs & Training" },
    subtitle: { bm: "Pembangunan usahawan", en: "Entrepreneur development" },
    questions: [
      {
        q: { bm: "Apakah program latihan yang ada?", en: "What training programs are available?" },
        a: {
          bm: "Kami menganjurkan kursus asas keusahawanan, pengurusan kewangan, pemasaran digital dan bimbingan perniagaan secara berkala.",
          en: "We regularly run courses on entrepreneurship basics, financial management, digital marketing and business coaching.",
        },
      },
      {
        q: { bm: "Adakah latihan ini percuma?", en: "Is the training free?" },
        a: {
          bm: "Kebanyakan program adalah percuma untuk usahawan berdaftar. Sila semak jadual di laman web kami.",
          en: "Most programs are free for registered entrepreneurs. Please check the schedule on our website.",
        },
      },
    ],
  },
  {
    id: "soalan",
    icon: "help",
    title: { bm: "Soalan Lazim", en: "General FAQ" },
    subtitle: { bm: "Jawapan kepada soalan umum", en: "Answers to common questions" },
    questions: [
      {
        q: { bm: "Apakah waktu operasi pejabat?", en: "What are the office hours?" },
        a: {
          bm: "Pejabat kami dibuka Isnin hingga Jumaat, dari jam lapan setengah pagi hingga lima petang. Ditutup pada hujung minggu dan cuti umum.",
          en: "Our offices are open Monday to Friday, from eight thirty in the morning to five in the evening. Closed on weekends and public holidays.",
        },
      },
      {
        q: { bm: "Bagaimana untuk menghubungi kami?", en: "How can I contact you?" },
        a: {
          bm: "Anda boleh menghubungi talian khidmat pelanggan kami, menghantar emel, atau melawat laman web rasmi kami.",
          en: "You can call our customer service line, send us an email, or visit our official website.",
        },
      },
    ],
  },
];
