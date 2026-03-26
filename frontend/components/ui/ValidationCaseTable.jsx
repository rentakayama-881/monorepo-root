"use client";

import Link from "next/link";
import Avatar from "./Avatar";
import Badge from "./Badge";
import { TagList } from "./TagPill";
import { formatIDR } from "@/lib/format";
import { formatDate, sensitivityText, StatusPill } from "./validationCaseTableUtils";
import ValidationCaseMobileList from "./ValidationCaseMobileList";

export default function ValidationCaseTable({
  cases,
  baseHref = "/validation-cases",
  showCategory = true,
}) {
  const items = Array.isArray(cases) ? cases : [];

  return (
    <div className="space-y-3">
      <div className="space-y-3 sm:hidden">
        <ValidationCaseMobileList items={items} baseHref={baseHref} showCategory={showCategory} />
      </div>

      <div className="hidden sm:block overflow-hidden rounded-none border border-border bg-background">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm" aria-label="Daftar kasus validasi">
            <thead className="bg-secondary/60 text-muted-foreground [&_th]:whitespace-nowrap">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Kasus
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Judul
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Sensitivitas
                </th>
                {showCategory && (
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                  >
                    Jenis
                  </th>
                )}
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Bounty
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Owner
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Dibuat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={showCategory ? 8 : 7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Tidak ada case validasi pada indeks ini.
                  </td>
                </tr>
              ) : (
                items.map((vc) => {
                  const id = vc?.id;
                  const href = `${baseHref}/${encodeURIComponent(String(id ?? ""))}`;
                  const owner = vc?.owner || vc?.user || {};
                  const ownerName = owner?.username ? `@${owner.username}` : "-";
                  const ownerBadge = owner?.primary_badge || owner?.primaryBadge || null;
                  const ownerProfileHref = owner?.username
                    ? `/user/${encodeURIComponent(owner.username)}`
                    : "";

                  return (
                    <tr key={String(id)} className="hover:bg-secondary/40">
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
                        <Link href={href} prefetch={false} className="hover:underline">
                          #{String(id)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="min-w-0">
                          <Link
                            href={href}
                            prefetch={false}
                            className="block font-semibold text-foreground hover:underline"
                          >
                            {vc?.title || "(tanpa judul)"}
                          </Link>
                          {vc?.summary ? (
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {vc.summary}
                            </div>
                          ) : null}
                          {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
                            <div className="mt-2">
                              <TagList tags={vc.tags} size="xs" />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <StatusPill status={vc?.status} />
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {sensitivityText(vc?.sensitivity_level)}
                      </td>
                      {showCategory && (
                        <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                          {vc?.category?.name || vc?.category?.slug || "-"}
                        </td>
                      )}
                      <td className="px-4 py-3 align-top font-semibold text-foreground whitespace-nowrap">
                        {formatIDR(vc?.bounty_amount)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
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
                                  className="truncate font-semibold text-foreground hover:underline"
                                >
                                  {ownerName}
                                </Link>
                              ) : (
                                <span className="truncate font-semibold text-foreground">
                                  {ownerName}
                                </span>
                              )}
                              {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
                            </div>
                            {Number(owner?.guarantee_amount || owner?.guaranteeAmount || 0) > 0 ? (
                              <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
                                Stake:{" "}
                                {formatIDR(owner?.guarantee_amount || owner?.guaranteeAmount)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(vc?.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
