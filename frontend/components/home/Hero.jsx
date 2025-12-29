import Image from 'next/image';
import Button from '../ui/Button';

export default function Hero() {
  return (
    <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
      <div className="flex-1">
        <p className="mb-3 inline-flex items-center rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1 text-xs font-semibold tracking-wide text-[rgb(var(--muted))]">
          Komunitas • Thread • AI Service
        </p>

        <h1 className="text-balance text-3xl font-semibold tracking-tight text-[rgb(var(--fg))] sm:text-4xl">
          Platform komunitas dan utilitas digital tingkat tinggi 
        </h1>

        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-[rgb(var(--muted))]">
          Temukan thread, kategori, dan fitur komunitas yang dirancang ringkas.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/threads" variant="primary">
            Lihat Semua Thread
          </Button>
          <Button href="/category/mencari-pekerjaan" variant="secondary">
            Kategori Utama
          </Button>
        </div>
      </div>

      <div className="flex-1 md:flex md:justify-end">
        <div className="hidden w-full max-w-sm md:block">
          <div
            className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-sm"
            style={{
              background:
                'linear-gradient(180deg, rgb(var(--surface) / 1) 0%, rgb(var(--surface-2) / 1) 100%)'
            }}
          >
            <div className="flex items-center justify-center">
              {/* Light mode logo */}
              <Image
                src="/logo/logo-light.svg"
                alt="Alephdraad"
                width={220}
                height={220}
                priority
                className="opacity-95 dark:hidden"
              />
              {/* Dark mode logo */}
              <Image
                src="/logo/logo-dark.svg"
                alt="Alephdraad"
                width={220}
                height={220}
                priority
                className="hidden opacity-95 dark:block"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
