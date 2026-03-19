"use client";

import { useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import NativeSelect from "@/components/ui/NativeSelect";
import Button from "@/components/ui/Button";
import { formatIDR } from "@/lib/format";
import NewValidationCaseSkeleton from "./NewValidationCaseSkeleton";
import { createNavigationSections, sanitizeNumericInput } from "./components/newCaseUtils";
import { useNewValidationCase } from "./components/useNewValidationCase";
import ReadmeTemplateGrid from "./components/ReadmeTemplateGrid";
import WorkspaceUploadSection from "./components/WorkspaceUploadSection";
import QualityGateSection from "./components/QualityGateSection";

const MarkdownEditor = dynamic(() => import("@/components/ui/MarkdownEditor"), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse bg-border/30 rounded-lg" />,
});
const MarkdownPreview = dynamic(() => import("@/components/ui/MarkdownPreview"), {
  ssr: false,
  loading: () => <div className="h-32 animate-pulse bg-border/30 rounded-lg" />,
});

export default function NewValidationCaseClient() {
  const editorRef = useRef(null);
  const {
    loadingCaseType,
    form,
    setForm,
    workspaceUploadDraft,
    setWorkspaceUploadDraft,
    workspaceBootstrapFiles,
    workspaceFileInputKey,
    availableTags,
    tagsAvailable,
    tagsLoading,
    selectedTags,
    setSelectedTags,
    submitting,
    error,
    ok,
    activeReadmeTemplateId,
    insertSnippetSignal,
    telegramChecking,
    telegramReady,
    locked,
    formDisabled,
    processStatusText,
    readinessDoneCount,
    requiredReadinessItems,
    readinessPercent,
    setChecklist,
    insertReadmeTemplate,
    handleSnippetInserted,
    onWorkspaceFilePicked,
    addWorkspaceBootstrapFile,
    removeWorkspaceBootstrapFile,
    submit,
  } = useNewValidationCase();

  if (loadingCaseType) {
    return <NewValidationCaseSkeleton />;
  }

  return (
    <main className="container py-5 md:py-10 [scrollbar-gutter:stable]">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Beranda
        </Link>
        <span>/</span>
        <Link href="/validation-cases" prefetch={false} className="hover:underline">
          Daftar Case
        </Link>
        <span>/</span>
        <span className="text-foreground">Buat Baru</span>
      </nav>

      <header className="mb-4 md:mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Pembangun Case Berbasis README
        </div>
        <h1 className="mt-1.5 text-xl md:text-2xl font-semibold text-foreground">
          Buat Case Validasi
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
          Jelaskan kebutuhan validasi langsung di README case, lalu lampirkan file pendukung. Tidak
          perlu alur chat panjang sebelum case diproses validator.
        </p>
      </header>

      {locked ? (
        <div className="mb-4 rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
          Intake sedang ditutup.
        </div>
      ) : null}
      {!telegramReady ? (
        <div className="mb-4 rounded-[var(--radius)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          {telegramChecking ? (
            "Memverifikasi Telegram Auth akun Anda..."
          ) : (
            <>
              Anda wajib menyambungkan akun Telegram terverifikasi di{" "}
              <Link href="/account" className="font-semibold underline">
                Pengaturan Akun
              </Link>{" "}
              sebelum membuat Case Validasi.
            </>
          )}
        </div>
      ) : null}

      <div className="mb-4 min-h-[48px]">
        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        {!error && ok ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius)] border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
          >
            {ok}
          </div>
        ) : null}
      </div>

      <section className="mb-4 rounded-[var(--radius)] border border-primary/20 gradient-subtle px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Kesiapan Workspace
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {readinessDoneCount}/{requiredReadinessItems.length} syarat wajib selesai
            </div>
          </div>
          <div className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {readinessPercent}% siap
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary/80 transition-all"
            style={{ width: `${readinessPercent}%` }}
          />
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {createNavigationSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-sm border border-primary/30 bg-card px-3 py-1 text-xs font-semibold text-primary hover:bg-accent"
            >
              {section.label}
            </a>
          ))}
        </div>
      </section>

      <div className="space-y-8 md:space-y-10">
        {/* ── Case Setup Fields ── */}
        <section id="case-setup" className="space-y-3 md:space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Pengaturan Case (Wajib)
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Judul</label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Contoh: Validasi draft skripsi Bab 3 hasil AI"
                disabled={formDisabled}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Tingkat kerahasiaan
              </label>
              <NativeSelect
                value={form.sensitivity || "S1"}
                onChange={(e) => setForm((prev) => ({ ...prev, sensitivity: e.target.value }))}
                options={[
                  { value: "S0", label: "S0 - Publik" },
                  { value: "S1", label: "S1 - Terbatas" },
                  { value: "S2", label: "S2 - Rahasia" },
                  { value: "S3", label: "S3 - Kritis" },
                ]}
                className="mt-1"
                disabled={formDisabled}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Bounty (IDR)</label>
              <input
                value={form.bounty_amount}
                onChange={(e) => {
                  const next = sanitizeNumericInput(e.target.value);
                  setForm((prev) => ({ ...prev, bounty_amount: next }));
                }}
                className="mt-1 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground"
                inputMode="numeric"
                placeholder="10000"
                maxLength={15}
                disabled={formDisabled}
              />
              <div className="mt-1 text-[11px] text-muted-foreground">
                Minimal Rp 10.000. Estimasi saat ini:{" "}
                {form.bounty_amount ? `Rp ${formatIDR(form.bounty_amount)}` : "-"}.
              </div>
            </div>
          </div>
        </section>

        {/* ── README Templates ── */}
        <section>
          <ReadmeTemplateGrid
            activeReadmeTemplateId={activeReadmeTemplateId}
            formDisabled={formDisabled}
            onInsertTemplate={insertReadmeTemplate}
          />
        </section>

        {/* ── Case Record Editor ── */}
        <section id="case-record-editor" ref={editorRef}>
          <label className="text-xs font-semibold text-muted-foreground">
            Catatan Case (Teks Bebas)
          </label>
          <div className="mt-2">
            <MarkdownEditor
              value={form.case_record_text}
              onChange={(next) => setForm((prev) => ({ ...prev, case_record_text: next }))}
              placeholder="Gunakan Markdown: poin, checklist, tabel kecil, dan acceptance criteria."
              minHeight="280px"
              preview={MarkdownPreview}
              disabled={formDisabled}
              insertSnippetSignal={insertSnippetSignal}
              onSnippetInserted={handleSnippetInserted}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Gunakan markdown secukupnya. Jangan masukkan kontak langsung di Case Record.
          </p>
        </section>

        {/* ── Workspace Files ── */}
        <section>
          <WorkspaceUploadSection
            workspaceBootstrapFiles={workspaceBootstrapFiles}
            workspaceUploadDraft={workspaceUploadDraft}
            setWorkspaceUploadDraft={setWorkspaceUploadDraft}
            workspaceFileInputKey={workspaceFileInputKey}
            formDisabled={formDisabled}
            processStatusText={processStatusText}
            onFilePicked={onWorkspaceFilePicked}
            onAddFile={addWorkspaceBootstrapFile}
            onRemoveFile={removeWorkspaceBootstrapFile}
          />
        </section>

        {/* ── Quality Gate ── */}
        <section>
          <QualityGateSection
            checklist={form.checklist}
            formDisabled={formDisabled}
            onSetChecklist={setChecklist}
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            tagsAvailable={tagsAvailable}
            tagsLoading={tagsLoading}
          />
        </section>

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-5">
          <Button href="/validation-cases" prefetch={false} variant="secondary" size="sm">
            Kembali
          </Button>
          <Button
            onClick={submit}
            disabled={formDisabled}
            loading={submitting}
            size="sm"
            className="min-w-[12.5rem]"
            type="button"
          >
            {submitting ? "Mengirim..." : "Buat Case Validasi"}
          </Button>
        </div>
      </div>
    </main>
  );
}
