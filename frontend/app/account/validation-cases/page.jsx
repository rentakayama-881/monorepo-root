"use client";

import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import useValidationCasesList from "./useValidationCasesList";
import CaseListFilters from "./components/CaseListFilters";
import CaseListTable from "./components/CaseListTable";
import CaseListEmpty from "./components/CaseListEmpty";

function MyValidationCasesLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="space-y-3 sm:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`mobile-${i}`} className="rounded-none border border-border bg-background p-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-hidden rounded-none border border-border bg-background">
        <div className="p-4">
          <div className="grid grid-cols-7 gap-3 border-b border-border pb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`head-${i}`} className="h-3.5 w-16" />
            ))}
          </div>
          <div className="space-y-3 pt-3">
            {Array.from({ length: 4 }).map((_, row) => (
              <div key={`row-${row}`} className="grid grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((__, col) => (
                  <Skeleton key={`cell-${row}-${col}`} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyValidationCasesPage() {
  const {
    loading,
    error,
    items,
    deletingId,
    deleteTarget,
    setDeleteTarget,
    openDeleteDialog,
    confirmDeleteCase,
  } = useValidationCasesList();

  return (
    <main className="container py-10">
      <CaseListFilters error={error} />

      {loading ? (
        <MyValidationCasesLoading />
      ) : items.length === 0 ? (
        <CaseListEmpty />
      ) : (
        <CaseListTable items={items} deletingId={deletingId} onDeleteClick={openDeleteDialog} />
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deletingId) return;
          setDeleteTarget(null);
        }}
        title="Delete Validation Case"
        size="sm"
        closeOnBackdrop={!deletingId}
        closeOnEscape={!deletingId}
      >
        <div className="space-y-4 text-sm">
          <div className="text-foreground">
            Case ini akan dihapus permanen dari daftar milik kamu.
          </div>
          <div className="rounded-[var(--radius)] border border-border bg-secondary/30 px-3 py-2">
            <div className="font-mono text-[11px] text-muted-foreground">
              Case #{deleteTarget?.id || "-"}
            </div>
            <div className="mt-1 font-semibold text-foreground">
              {deleteTarget?.title || "(untitled)"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Aksi ini tidak bisa dibatalkan.</div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(deletingId)}
              className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteCase}
              disabled={Boolean(deletingId)}
              className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {Boolean(deletingId) ? "Deleting..." : "Delete Permanently"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
