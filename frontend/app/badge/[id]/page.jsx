"use client";

import { use, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api";
import { SectionLoadingBlock } from "@/components/ui/LoadingState";

export default function BadgeDetailPage({ params }) {
  const { id } = use(params);
  const API = `${getApiBase()}/api`;
  const [badge, setBadge] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/badges/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res) => !cancelled && setBadge(res))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [API, id]);

  if (!badge) return <SectionLoadingBlock lines={3} compact />;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-foreground">Badge Detail</h2>
      <div className="mt-3 border border-border rounded-lg bg-card p-4 text-sm space-y-1 text-foreground">
        <div><b>Platform:</b> {badge.platform}</div>
        <div><b>Description:</b> {badge.description}</div>
        <div><b>Issued At:</b> {formatDate(badge.created_at)}</div>
      </div>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "";
  try { return new Date(ts * 1000).toLocaleString(); } catch { return ""; }
}
