import Link from "next/link";
import Image from "next/image";

// Kategori dari Sidebar/Header - konsisten dengan isi project
const threadCategories = [
  "Mencari Pekerjaan","Cryptocurrency","Software","Dokter buka praktek","Kerja Lepas","Iklan","Akuntansi","Dropshiper","Jasa Tugas Kantor","Akun Digital","HP & Komputer","Drama Korea","Jasa Tugas Belajar","Kolaborator Ph.D","Marketing Offline","Investor","Anti Penipuan","Bantuan Darurat","Cari Relasi","AI Digest","Masa Depan-Ku","Report Massal","Email Transaksional","Script","Programming"
];

// Slugify function sesuai project
function slugify(name) {
  return name.toLowerCase()
    .replace(/\./g,"")
    .replace(/&/g,"-")
    .replace(/\s+/g,"-")
    .replace(/[^a-z0-9-]/g,"")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"");
}

// Dummy: thread terbaru, ganti dengan fetch API jika sudah tersedia.
// Untuk demo, tetap pakai array kosong (tidak template statis).
const threads = []; // Integrasikan dengan API untuk data asli.

export default function Home() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      {/* Hero Section */}
      <div className="mb-10 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-black mb-3">
            Platform Komunitas, Diskusi, & Utilitas Digital
          </h1>
          <p className="text-lg text-neutral-700 mb-4">
            Temukan thread, kategori, relasi, dan fitur digital untuk pengembangan diri dan komunitas. 
          </p>
          <div className="flex gap-4 mt-2">
            <Link href="/threads" className="btn">Lihat Semua Thread</Link>
            <Link href={`/category/${slugify(threadCategories[0])}`} className="btn bg-neutral-100 text-black hover:bg-neutral-200">
              Kategori Utama
            </Link>
          </div>
        </div>
        <div className="flex-1 hidden md:flex justify-center items-center">
          <Image src="/images/vectorised-1758374067909.svg" alt="Community" width={220} height={220} priority />
        </div>
      </div>

      {/* Kategori Grid */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-black">Kategori</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {threadCategories.map(cat => (
            <Link
              key={cat}
              href={`/category/${slugify(cat)}`}
              className="card hover:shadow-lg transition border-neutral-200"
            >
              <span className="font-semibold text-lg text-black">{cat}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-right">
          <Link href={`/category/${slugify(threadCategories[0])}`} className="text-blue-700 underline hover:text-blue-900">
            Lihat semua kategori →
          </Link>
        </div>
      </div>

      {/* Thread Terbaru */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-4 text-black">Thread Terbaru</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {threads.length > 0 ? (
            threads.map(th => (
              <Link key={th.id} href={`/thread/${th.id}`} className="card hover:shadow-xl transition border-neutral-200 p-5">
                <div className="font-semibold text-lg text-black mb-1">{th.title}</div>
                <div className="text-neutral-700 text-sm mb-2">{th.summary}</div>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span>By <span className="font-semibold">{th.author}</span></span>
                  <span>•</span>
                  <span>{th.created_at}</span>
                </div>
                <div className="mt-2 text-blue-700 text-xs font-medium">Lihat detail →</div>
              </Link>
            ))
          ) : (
            <div className="text-neutral-500">Belum ada thread terbaru.</div>
          )}
        </div>
        <div className="mt-4 text-right">
          <Link href="/threads" className="text-blue-700 underline hover:text-blue-900">Lihat semua threads →</Link>
        </div>
      </div>

      {/* Info & Aturan */}
      <div className="mb-12 bg-neutral-50 border border-neutral-200 rounded-lg p-5">
        <h3 className="text-lg font-bold mb-2 text-black">Aturan & Etika</h3>
        <ul className="list-disc ml-6 text-neutral-700 space-y-1 text-sm">
          <li>Tidak boleh posting SARA, spam, penipuan, atau konten ilegal.</li>
          <li>Gunakan bahasa yang sopan dan saling menghormati.</li>
          <li>Laporkan thread/akun bermasalah ke admin.</li>
        </ul>
        <div className="mt-2">
          <Link href="/rules-content" className="text-blue-700 underline hover:text-blue-900 text-sm">Baca aturan lengkap →</Link>
        </div>
      </div>
    </section>
  );
}
