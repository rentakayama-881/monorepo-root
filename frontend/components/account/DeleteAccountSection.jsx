"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useSudoAction } from "@/components/SudoModal";
import { useCanDeleteAccount } from "@/lib/swr";
import { getValidToken } from "@/lib/tokenRefresh";
import { AlertTriangle, AlertCircle, Trash2 } from "lucide-react";

export default function DeleteAccountSection({ apiBase }) {
  const router = useRouter();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { execute: executeSudo } = useSudoAction("Menghapus akun secara permanen");
  const { canDelete, blockingReasons, warnings, isLoading: checkingDelete } = useCanDeleteAccount();

  async function handleDelete() {
    if (deleteConfirmation !== "DELETE") return;

    setDeleteError("");
    setDeleteLoading(true);

    try {
      await executeSudo(async (sudoToken) => {
        const token = await getValidToken();
        if (!token) {
          throw new Error("Sesi telah berakhir. Silakan login kembali.");
        }

        const res = await fetch(`${apiBase}/account`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Sudo-Token": sudoToken,
          },
          body: JSON.stringify({ confirmation: deleteConfirmation }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal menghapus akun");
        }

        localStorage.removeItem("token");
        localStorage.removeItem("sudo_token");
        localStorage.removeItem("sudo_expires");
        router.push("/");
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== "Verifikasi dibatalkan") {
        setDeleteError(message);
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="rounded-lg border-2 border-destructive/20 bg-destructive/10 p-4">
      <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Zona Berbahaya
      </h3>
      <p className="mt-2 text-xs text-destructive/80">
        Menghapus akun akan menghapus semua data Anda secara permanen termasuk semua Validation Case
        yang pernah dibuat. Aksi ini tidak dapat dibatalkan.
      </p>

      {checkingDelete && (
        <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
            Memeriksa status akun...
          </div>
        </div>
      )}

      {!checkingDelete && blockingReasons && blockingReasons.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-sm font-medium text-warning mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Akun tidak dapat dihapus karena:
          </p>
          <ul className="space-y-1">
            {blockingReasons.map((reason, index) => (
              <li key={index} className="text-xs text-foreground flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!checkingDelete && canDelete && warnings && warnings.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-sm font-medium text-warning mb-2">Peringatan:</p>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li key={index} className="text-xs text-foreground flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-destructive mb-1">
            Ketik <span className="font-mono font-bold">DELETE</span> untuk konfirmasi
          </label>
          <Input
            type="text"
            placeholder="DELETE"
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            disabled={!canDelete}
          />
        </div>

        {deleteError && <Alert variant="error" message={deleteError} />}

        <Button
          variant="danger"
          className="w-full disabled:opacity-50"
          disabled={deleteLoading || deleteConfirmation !== "DELETE" || !canDelete}
          loading={deleteLoading}
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {canDelete ? "Hapus Akun Permanen" : "Tidak Dapat Menghapus Akun"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {canDelete
            ? "Akan diminta verifikasi identitas sebelum menghapus"
            : "Selesaikan semua transaksi terlebih dahulu"}
        </p>
      </div>
    </section>
  );
}
