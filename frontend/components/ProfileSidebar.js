"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api";

export default function ProfileSidebar({ onClose }) {
  const [user, setUser] = useState({ username: "" });
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    try {
      const t = localStorage.getItem("token");
      if (!t) return;
      fetch(`${getApiBase()}/api/user/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          if (!cancelled) setUser({ username: data.username || data.name || "" });
        })
        .catch(() => {});
    } catch (_) {}

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e && e.key === "Escape") onClose?.();
    };

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!user.username) return null;

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-11 z-50 w-80 origin-top-right rounded-xl border border-neutral-200 bg-white p-4 shadow-lg ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold uppercase text-neutral-700">
            {user.username.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-neutral-900">{user.username}</div>
            <div className="text-xs text-neutral-500">Kelola aktivitas & profil Anda</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-neutral-600 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          type="button"
        >
          <span className="sr-only">Tutup menu profil</span>
          <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <nav className="mt-4 flex flex-col gap-2 text-sm text-neutral-800">
        <Link
          href="/account"
          className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
        >
          Account
          <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/threads"
          className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
        >
          Threads
          <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </nav>
      <button
        onClick={handleLogout}
        className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50/60"
        type="button"
      >
        Keluar
      </button>
    </div>
  );
}
