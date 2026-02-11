'use client';
import { useEffect } from 'react';
export default function Error({ error, reset }) {
  const isDev = process.env.NODE_ENV === 'development';
  useEffect(() => { console.error('Error:', error); }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <svg className="h-8 w-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">Gagal memuat halaman diskusi.</h2>
        <p className="mt-2 text-sm text-muted-foreground">{isDev ? error?.message : 'Maaf, terjadi kesalahan yang tidak terduga.'}</p>
        {error?.digest && <p className="mt-1 text-xs text-muted-foreground">Referensi: {error.digest}</p>}
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Coba Lagi</button>
        <a href="/" className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">Beranda</a>
      </div>
    </div>
  );
}
