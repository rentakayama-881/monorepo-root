import Image from "next/image";
import Button from "../ui/Button"; 

export default function Hero() {
  return (
    <div className="mb-14 flex flex-col items-start gap-10 md:flex-row md:items-center">
      <div className="flex-1">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
          Platform komunitas dan utilitas digital yang rapi
        </h1>
        <p className="mb-8 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
          Temukan thread, kategori, dan fitur komunitas yang dirancang ringkas. Semua tampilan kini lebih tajam dan profesional.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button href="/threads" variant="primary">Lihat Semua Thread</Button>
          <Button href="/category/mencari-pekerjaan" variant="secondary">Kategori Utama</Button>
        </div>
      </div>
      
      <div className="hidden flex-1 items-center justify-end md:flex">
        {/* Container gambar saya buat transparan agar tidak ada kotak aneh */}
        <div className="relative p-4"> 
          <Image 
            src="/images/vectorised-1758374067909.svg" 
            alt="Community Vector" 
            width={280} 
            height={280} 
            priority
            // Opacity diturunkan sedikit di dark mode biar tidak terlalu silau kontrasnya
            className="dark:opacity-90"
          />
        </div>
      </div>
    </div>
  );
}

