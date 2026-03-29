"use client";

import Link from "next/link";
import Avatar from "./Avatar";
import Badge from "./Badge";
import { TagList } from "./TagPill";
import { formatIDR } from "@/lib/format";
import { formatDate, sensitivityText, StatusPill } from "./validationCaseTableUtils";

export default function ValidationCaseMobileList({ items, baseHref, showCategory }) {
  if (items.length === 0) {
    return (
      <div className="rounded-none border border-border bg-background px-4 py-9 text-center text-sm text-muted-foreground">
        Tidak ada case validasi pada indeks ini.
      </div>
    );
  }

  return items.map((vc) => {
    const id = vc?.id;
    const href = `${baseHref}/${encodeURIComponent(String(id ?? ""))}`;
    const owner = vc?.owner || vc?.user || {};
    const ownerName = owner?.username ? `@${owner.username}` : "-";
    const ownerBadge = owner?.primary_badge || owner?.primaryBadge || null;
    const ownerProfileHref = owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "";
    return (
      <article
        key={String(id)}
        className="rounded-none border border-border bg-background px-4 py-3"
        aria-label={`Case #${id}: ${vc?.title || "untitled"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">Case #{String(id)}</div>
            <Link
              href={href}
              prefetch={false}
              className="mt-1 block text-sm font-semibold leading-5 text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {vc?.title || "(tanpa judul)"}
            </Link>
          </div>
          <StatusPill status={vc?.status} />
        </div>

        {vc?.summary ? (
          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{vc.summary}</div>
        ) : null}
        {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
          <div className="mt-2">
            <TagList tags={vc.tags} size="xs" />
          </div>
        ) : null}

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Bounty</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{formatIDR(vc?.bounty_amount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dibuat</dt>
            <dd className="mt-0.5 font-mono text-muted-foreground">{formatDate(vc?.created_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sensitivitas</dt>
            <dd className="mt-0.5 font-mono text-foreground">
              {sensitivityText(vc?.sensitivity_level)}
            </dd>
          </div>
          {showCategory ? (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Jenis</dt>
              <dd className="mt-0.5 text-foreground">
                {vc?.category?.name || vc?.category?.slug || "-"}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-3 flex items-center gap-2 rounded-none border border-border/70 bg-secondary/20 px-2.5 py-2">
          <Avatar
            src={owner?.avatar_url || owner?.avatarUrl}
            name={owner?.username || ""}
            size="xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {ownerProfileHref ? (
                <Link
                  href={ownerProfileHref}
                  prefetch={false}
                  className="truncate text-xs font-semibold text-foreground hover:underline"
                >
                  {ownerName}
                </Link>
              ) : (
                <span className="truncate text-xs font-semibold text-foreground">{ownerName}</span>
              )}
              {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
            </div>
            {Number(owner?.guarantee_amount || owner?.guaranteeAmount || 0) > 0 ? (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Stake: {formatIDR(owner?.guarantee_amount || owner?.guaranteeAmount)}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  });
}
