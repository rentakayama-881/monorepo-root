import { AlertCircle } from "lucide-react";

export default function UsernameSection({ username }) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Username</h3>
      <div className="mt-1 text-sm text-foreground">
        Saat ini: <b>{username || "(belum ada)"}</b>
      </div>
      <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
        <div className="flex items-center gap-2 text-sm text-warning">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">Fitur Segera Hadir</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Fitur ganti username akan segera tersedia. Layanan ini berbayar Rp.100.000 dan saldo IDR
          akan dipotong otomatis.
        </p>
      </div>
    </section>
  );
}
