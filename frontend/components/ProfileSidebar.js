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
    <div className="absolute right-0 top-12 z-50 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-4 space-y-2">
      <div className="flex justify-between items-center">
        <div className="font-semibold text-base text-slate-900">{user.username}</div>
        <button onClick={onClose} className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200">✕</button>
      </div>
      <nav className="flex flex-col gap-2 pt-2">
        <Link href="/account" className="px-3 py-2 rounded-md border border-slate-100 hover:border-slate-200 hover:bg-slate-50">Account</Link>
        <Link href="/threads" className="px-3 py-2 rounded-md border border-slate-100 hover:border-slate-200 hover:bg-slate-50">Threads</Link>
      </nav>
      <button onClick={handleLogout} className="mt-3 w-full text-left px-3 py-2 rounded-md bg-red-50 hover:bg-red-100 text-red-600">Logout</button>
    </div>
  );
}
