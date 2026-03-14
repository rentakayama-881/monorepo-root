import { AlertTriangle } from "lucide-react";

export default function Setup2faBanner() {
  return (
    <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
        <div>
          <p className="font-semibold text-warning">2FA Diperlukan untuk Fitur Wallet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Untuk menggunakan fitur kirim uang, tarik saldo, dan set PIN, Anda harus mengaktifkan
            2FA terlebih dahulu. Scroll ke bawah ke bagian &quot;Keamanan&quot; dan klik tombol
            &quot;Aktifkan 2FA&quot;.
          </p>
        </div>
      </div>
    </div>
  );
}
