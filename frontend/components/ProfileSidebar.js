"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { resolveAvatarSrc } from "@/lib/avatar";

export default function ProfileSidebar({ onClose }) {
  const [user, setUser] = useState({ username: "", avatar_url: "" });
  const [status, setStatus] = useState("loading");
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const token = getToken();
      if (!token) {
        setStatus("unauthenticated");
        return;
      }
      setStatus("loading");
      try {
        const res = await fetch(`${getApiBase()}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          clearToken();
          if (!cancelled) {
            setUser({ username: "", avatar_url: "" });
            setStatus("unauthenticated");
          }
          return;
        }
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (cancelled) return;
        setUser({
          username: data.username || data.name || "",
          avatar_url: data.avatar_url || "",
        });
        setStatus("ready");
      } catch (err) {
        if (!cancelled) setStatus("error");
      }
    }

    loadUser();
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

  const handleLogout = () => {
    clearToken();
    window.location.href = "/login";
  };

  const hasUser = !!user.username;
  const avatarSrc = resolveAvatarSrc(user.avatar_url);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-11 z-50 w-80 origin-top-right rounded-xl border border-neutral-200 bg-white p-4 shadow-lg ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between gap-3">
        {hasUser ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50 text-sm font-semibold uppercase text-neutral-700">
              {user.avatar_url ? (
                <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                user.username.slice(0, 2)
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-neutral-900">{user.username}</div>
              <div className="text-xs text-neutral-500">Kelola aktivitas & profil Anda</div>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="text-base font-semibold text-neutral-900">
              {status === "error" ? "Session expired" : "Not signed in"}
            </div>
            <div className="text-xs text-neutral-500">Silakan login kembali untuk mengakses profil.</div>
          </div>
        )}
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
      {hasUser ? (
        <>
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
              href="/orders/new"
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
            >
              New Order
              <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/orders"
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
            >
              Order History
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
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
            onClick={onClose}
          >
            Go to login
          </Link>
          <button
            onClick={() => {
              clearToken();
              setUser({ username: "", avatar_url: "" });
              setStatus("unauthenticated");
              onClose?.();
            }}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
            type="button"
          >
            Clear token
          </button>
        </div>
      )}
    </div>
  );
}
