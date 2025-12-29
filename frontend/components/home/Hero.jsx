import Button from '../ui/Button';

export default function Hero() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-[rgb(var(--fg))] sm:text-4xl">
        Bangun komunitas, bagikan pengetahuan
      </h1>

      <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-[rgb(var(--muted))]">
        Platform diskusi dan utilitas digital untuk komunitas Indonesia. Temukan thread, kategori, dan fitur yang dirancang untuk kolaborasi.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/threads" variant="primary">
          Jelajahi Thread
        </Button>
        <Button href="/ai-search" variant="secondary">
          AI Search
        </Button>
      </div>
    </div>
  );
}
