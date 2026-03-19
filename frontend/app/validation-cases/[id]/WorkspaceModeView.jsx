"use client";

import Link from "next/link";
import { TagList } from "@/components/ui/TagPill";
import { formatIDR } from "@/lib/format";
import { looksLikeMarkdownText } from "./components/validationCaseDetailUtils";
import { StatusBadge } from "./components/CaseSharedComponents";
import RepoWorkflowClient from "./repo/RepoWorkflowClient";

export default function WorkspaceModeView({
  id,
  vc,
  me,
  error,
  status,
  sensitivity,
  ownerHandle,
  filedAtLabel,
  caseReadmeMarkdown,
  owner,
}) {
  return (
    <main className="container py-10 space-y-6">
      <nav className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Beranda
        </Link>
        <span>/</span>
        <Link href="/validation-cases" prefetch={false} className="hover:underline">
          Daftar Case
        </Link>
        <span>/</span>
        <span className="font-mono text-xs text-foreground">#{String(id)}</span>
      </nav>

      {error ? (
        <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detail Case
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                <span className="font-mono text-xs text-foreground">#{String(id)}</span>
                <span className="text-xs text-muted-foreground">Dibuat {filedAtLabel}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">
                {vc?.title || "(tanpa judul)"}
              </h1>
              {vc?.summary && !looksLikeMarkdownText(vc?.summary) ? (
                <p className="text-sm text-muted-foreground">{vc.summary}</p>
              ) : null}
            </div>

            {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
              <TagList tags={vc.tags} size="sm" />
            ) : null}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{ownerHandle}</span>
              <span aria-hidden="true">•</span>
              <span>Sensitivitas {sensitivity.level}</span>
            </div>
          </div>

          <div className="w-full rounded-[var(--radius)] border border-border/70 bg-background px-4 py-4 lg:max-w-xs">
            <div className="text-xs text-muted-foreground">Bounty</div>
            <div className="mt-1 text-xl font-bold text-foreground">
              {formatIDR(vc?.bounty_amount)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Nilai hadiah untuk validator terpilih.
            </div>
          </div>
        </div>
      </section>

      <RepoWorkflowClient
        embedded
        caseReadmeMarkdown={caseReadmeMarkdown}
        caseTitle={vc?.title || ""}
        ownerUserId={owner?.id || 0}
        viewerUserId={Number(me?.id || 0)}
      />
    </main>
  );
}
