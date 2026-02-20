"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useSudoAction } from "@/components/SudoModal";
import { useCanDeleteAccount } from "@/lib/swr";
import { getValidToken } from "@/lib/tokenRefresh";

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
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Zona Berbahaya
      </h3>
      <p className="mt-2 text-xs text-destructive/80">
        Menghapus akun akan menghapus semua data Anda secara permanen termasuk semua Validation Case yang pernah dibuat.
        Aksi ini tidak dapat dibatalkan.
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm0-13.5a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
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
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          {canDelete ? "Hapus Akun Permanen" : "Tidak Dapat Menghapus Akun"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {canDelete ? "Akan diminta verifikasi identitas sebelum menghapus" : "Selesaikan semua transaksi terlebih dahulu"}
        </p>
      </div>
    </section>
  );
}
