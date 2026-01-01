"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { resolveAvatarSrc, getInitials, getAvatarColor } from "@/lib/avatar";
import { maskEmail } from "@/lib/email";

export default function ProfileSidebar({ onClose }) {
  const [user, setUser] = useState({ username: "", avatar_url: "", email: "" });
  const [wallet, setWallet] = useState({ balance: 0, pin_set: false });
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
        // Load user data
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
        
        // Load wallet balance
        try {
          const walletRes = await fetch(`${getApiBase()}/api/wallet/balance`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            if (!cancelled) {
              setWallet({
                balance: walletData.balance || 0,
                pin_set: walletData.pin_set || false,
              });
            }
          }
        } catch (e) {
          console.error("Failed to load wallet:", e);
        }
        
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
  const initials = getInitials(user.username);
  const avatarBgColor = getAvatarColor(user.username);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-11 z-50 w-80 origin-top-right rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        {hasUser ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[rgb(var(--border))] text-sm font-semibold uppercase text-white" style={avatarSrc ? {} : { backgroundColor: avatarBgColor }}>
              {avatarSrc ? (
                <Image src={avatarSrc} alt="Avatar" width={40} height={40} className="h-full w-full object-cover" unoptimized />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[rgb(var(--fg))]">{user.username}</div>
              {user.email && (
                <div className="text-xs text-[rgb(var(--muted))]">{maskEmail(user.email)}</div>
              )}
              <div className="text-xs text-[rgb(var(--muted))]">Kelola aktivitas & profil Anda</div>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="text-base font-semibold text-[rgb(var(--fg))]">
              {status === "error" ? "Session expired" : "Not signed in"}
            </div>
            <div className="text-xs text-[rgb(var(--muted))]">Silakan login kembali untuk mengakses profil.</div>
          </div>
        )}
        <button
          onClick={onClose}
          className="rounded-md p-1 text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--fg))]"
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
          {/* Wallet Balance Card */}
          <div className="mt-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[rgb(var(--muted))]">Saldo</div>
                <div className="text-lg font-bold text-[rgb(var(--fg))]">
                  Rp {wallet.balance.toLocaleString("id-ID")}
                </div>
              </div>
              <Link
                href="/account/wallet/deposit"
                className="rounded-md bg-[rgb(var(--brand))] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
              >
                + Deposit
              </Link>
            </div>
          </div>

          <nav className="mt-4 flex flex-col gap-2 text-sm text-[rgb(var(--fg))]">
            {/* Wallet Section */}
            <div className="text-xs font-semibold uppercase text-[rgb(var(--muted))] px-1">Wallet</div>
            <Link
              href="/account/wallet/send"
              className="flex items-center justify-between rounded-md border border-[rgb(var(--border))] px-3 py-2 transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Kirim Uang
              </span>
              <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/account/wallet/transactions"
              className="flex items-center justify-between rounded-md border border-[rgb(var(--border))] px-3 py-2 transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Transaksi Saya
              </span>
              <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/account/wallet/disputes"
              className="flex items-center justify-between rounded-md border border-[rgb(var(--border))] px-3 py-2 transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Dispute Center
              </span>
              <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/account/wallet/withdraw"
              className="flex items-center justify-between rounded-md border border-[rgb(var(--border))] px-3 py-2 transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Tarik Dana
              </span>
              <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Account Section */}
            <div className="text-xs font-semibold uppercase text-[rgb(var(--muted))] px-1 mt-2">Akun</div>
            <Link
              href="/account"
              className="flex items-center justify-between rounded-md border border-[rgb(var(--border))] px-3 py-2 transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </span>
              <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/threads"
              className="flex items-center justify-between rounded-md border border-[rgb(var(--border))] px-3 py-2 text-[rgb(var(--fg))] transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                My Threads
              </span>
              <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </nav>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-md border border-[rgb(var(--border))] px-3 py-2 text-left text-sm font-semibold text-[rgb(var(--error))] transition hover:border-[rgb(var(--error-border))] hover:bg-[rgb(var(--error-bg))]"
            type="button"
          >
            Keluar
          </button>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-semibold text-[rgb(var(--fg))] transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
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
            className="w-full rounded-md border border-[rgb(var(--border))] px-3 py-2 text-sm font-medium text-[rgb(var(--muted))] transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            type="button"
          >
            Clear token
          </button>
        </div>
      )}
    </div>
  );
}
