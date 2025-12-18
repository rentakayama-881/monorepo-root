"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getApiBase } from "../lib/api";

export default function ProfileSidebar({ onClose }) {
  const [user, setUser] = useState({ username: "" });

  useEffect(() => {
    try {
      const t = localStorage.getItem("token");
      if (!t) return;
      fetch(`${getApiBase()}/api/user/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => setUser({ username: data.username || data.name || "" }))
        .catch(() => {});
    } catch (_) {}
  }, []);

  if (!user.username) return null;

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div className="absolute right-0 top-12 z-50 w-72 rounded-md border border-neutral-200 bg-white p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-neutral-900">{user.username}</div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
          type="button"
        >
          ✕
        </button>
      </div>
      <nav className="mt-3 flex flex-col gap-2 text-sm text-neutral-800">
        <Link
          href="/account"
          className="rounded-md border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
        >
          Account
        </Link>
        <Link
          href="/threads"
          className="rounded-md border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
        >
          Threads
        </Link>
      </nav>
      <button
        onClick={handleLogout}
        className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-neutral-50"
        type="button"
      >
        Logout
      </button>
    </div>
  );
}
