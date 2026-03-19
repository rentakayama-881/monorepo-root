import Link from "next/link";
import { Lock } from "lucide-react";

export default function NoPinModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-card p-6">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warning/10 p-3">
            <Lock className="h-8 w-8 text-warning" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2 text-center">
          PIN Belum Dikonfigurasi
        </h3>
        <div className="text-sm text-muted-foreground mb-6 text-center space-y-2">
          <p>Untuk melakukan aksi ini, Anda harus menyiapkan PIN keamanan terlebih dahulu.</p>
          <p className="text-xs">Siapkan PIN dengan langkah berikut:</p>
          <ol className="text-xs text-left list-decimal list-inside space-y-1">
            <li>Aktifkan autentikasi dua faktor (2FA) di pengaturan akun</li>
            <li>
              Lalu klik <strong>Kirim Dana</strong> atau <strong>Tarik Dana</strong> untuk mengatur
              PIN
            </li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
          >
            Tutup
          </button>
          <Link
            href="/account?setup2fa=true"
            className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground text-center transition hover:opacity-90"
          >
            Pengaturan Keamanan
          </Link>
        </div>
      </div>
    </div>
  );
}
