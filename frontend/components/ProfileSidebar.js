"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getApiBase } from "../lib/api";

export default function ProfileSidebar({ onClose }) {
  const [user, setUser] = useState({ name: "", balance: 0 });

  useEffect(() => {
    try {
      const t = localStorage.getItem("token");
      if (!t) return;
      fetch(`${getApiBase()}/api/user/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => setUser({ name: data.name || "", balance: data.balance || 0 }))
        .catch(() => {});
    } catch (_) {}
  }, []);

  if (!user.name) return null;

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div className="absolute right-0 top-14 z-50 w-72 bg-white border rounded shadow-lg p-4 space-y-2">
      <div className="flex justify-between items-center">
        <div className="font-semibold text-lg">{user.name}</div>
        <button onClick={onClose} className="text-sm px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">✕</button>
      </div>
      <div className="text-sm text-neutral-600">
        Balance: <span className="font-semibold">{user.balance}</span>
      </div>
      <nav className="flex flex-col gap-2 pt-2">
        <Link href="/account" className="px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100">Account</Link>
        <Link href="/threads" className="px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100">Threads</Link>
        <button
          onClick={() => (window.location.href = "/refill-balance")}
          className="w-full text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100"
        >Refill Balance</button>
        <Link href="/transfer-balance" className="px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100">Transfer Balance</Link>
      </nav>
      <button onClick={handleLogout} className="mt-3 w-full text-left px-3 py-2 rounded bg-red-50 hover:bg-red-100 text-red-600">Logout</button>
    </div>
  );
}
