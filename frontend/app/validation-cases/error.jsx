'use client';
import { useEffect, useState, useCallback } from 'react';

export default function Error({ error, reset }) {
  const [countdown, setCountdown] = useState(10);
  const [hasAutoRetried, setHasAutoRetried] = useState(false);

  const message = error?.message || '';
  const isRateLimit = /429|rate.?limit/i.test(message);
  const isTimeout = /timeout|timed?\s*out|ETIMEDOUT|ECONNABORTED/i.test(message);

  const title = isRateLimit
    ? 'Server sedang sibuk.'
    : isTimeout
      ? 'Server tidak merespons tepat waktu.'
      : 'Gagal memuat daftar kasus validasi.';

  const description = isRateLimit
    ? 'Terlalu banyak permintaan ke server. Halaman akan dimuat ulang otomatis.'
    : isTimeout
      ? 'Koneksi ke server timeout. Halaman akan dimuat ulang otomatis.'
      : 'Terjadi kesalahan saat memuat data. Halaman akan dimuat ulang otomatis.';

  const handleRetry = useCallback(() => {
    setCountdown(10);
    setHasAutoRetried(false);
    reset();
  }, [reset]);

  useEffect(() => {
    console.error('[validation-cases] Error boundary caught:', error);
  }, [error]);

  useEffect(() => {
    if (hasAutoRetried) return;

    if (countdown <= 0) {
      setHasAutoRetried(true);
      reset();
      return;
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, hasAutoRetried, reset]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
        <svg className="h-8 w-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {error?.digest && <p className="mt-1 text-xs text-muted-foreground">Referensi: {error.digest}</p>}
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Coba Lagi Sekarang
          </button>
          <a
            href="/"
            className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Beranda
          </a>
        </div>
        {!hasAutoRetried && (
          <p className="text-xs text-muted-foreground">
            Mencoba ulang otomatis dalam {countdown} detik...
          </p>
        )}
      </div>
    </div>
  );
}
