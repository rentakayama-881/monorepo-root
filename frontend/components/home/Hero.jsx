import Image from "next/image";
import Button from "../ui/Button";

export default function Hero() {
  return (
    <div className="mb-12 flex flex-col md:flex-row items-center gap-8">
      <div className="flex-1">
        <h1 className="text-3xl font-semibold text-slate-800 dark:text-white mb-3 tracking-tight">
          Platform komunitas dan utilitas digital yang rapi
        </h1>
        <p className="text-base text-slate-600 dark:text-neutral-400 mb-6 max-w-2xl leading-relaxed">
          Temukan thread, kategori, dan fitur komunitas yang dirancang ringkas. Semua tampilan kini lebih tajam dan profesional.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Button href="/threads" variant="primary">Lihat Semua Thread</Button>
          <Button href="/category/mencari-pekerjaan" variant="secondary">Kategori Utama</Button>
        </div>
      </div>
      
      <div className="flex-1 hidden md:flex justify-end items-center pr-2">
        <div className="p-4 bg-slate-50 border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-xl shadow-sm">
          <Image 
            src="/images/vectorised-1758374067909.svg" 
            alt="Community" 
            width={200} 
            height={200} 
            priority
            className="dark:opacity-80"
          />
        </div>
      </div>
    </div>
  );
}

