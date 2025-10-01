"use client";

import { use, useEffect, useState } from "react";

export default function BadgeDetailPage({ params }) {
  const { id } = use(params);
  const API = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080"}/api`;
  const [badge, setBadge] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/badges/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res) => !cancelled && setBadge(res))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [API, id]);

  if (!badge) return <div className="text-sm">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold">Badge Detail</h2>
      <div className="mt-3 border rounded bg-white p-4 text-sm space-y-1">
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
