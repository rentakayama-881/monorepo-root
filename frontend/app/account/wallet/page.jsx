"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { useWallet } from "@/lib/featureApi";
import Card from "@/components/ui/Card";

export default function WalletPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login?redirect=/account/wallet");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const { wallet, loading, error } = useWallet();

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatBalance = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount || 0);
  };

  const menuItems = [
    {
      href: "/account/wallet/deposit",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      label: "Deposit",
      description: "Tambah saldo ke wallet",
      color: "text-success",
    },
    {
      href: "/account/wallet/send",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
      label: "Kirim",
      description: "Transfer ke pengguna lain",
      color: "text-primary",
    },
    {
      href: "/account/wallet/withdraw",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      label: "Tarik Dana",
      description: "Withdraw ke rekening bank",
      color: "text-warning",
    },
    {
      href: "/account/wallet/transactions",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      label: "Riwayat",
      description: "Lihat semua transaksi",
      color: "text-muted-foreground",
    },
    {
      href: "/account/wallet/disputes",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      label: "Disputes",
      description: "Kelola sengketa transfer",
      color: "text-destructive",
    },
    {
      href: "/account/wallet/set-pin",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      label: "PIN Transaksi",
      description: "Atur atau ubah PIN",
      color: "text-foreground",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Wallet</h1>
              <p className="text-sm text-muted-foreground">Kelola saldo dan transaksi Anda</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Balance Card */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 w-20 bg-muted rounded mb-2"></div>
              <div className="h-8 w-40 bg-muted rounded"></div>
            </div>
          ) : error ? (
            <div className="text-destructive">{error}</div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-1">Saldo Tersedia</p>
              <p className="text-3xl font-bold text-foreground">
                {formatBalance(wallet?.availableBalance)} <span className="text-lg font-normal">ALEPH</span>
              </p>
              {wallet?.pendingBalance > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Saldo Pending: {formatBalance(wallet.pendingBalance)} ALEPH
                </p>
              )}
              {wallet?.lockedBalance > 0 && (
                <p className="text-sm text-warning mt-1">
                  Saldo Terkunci: {formatBalance(wallet.lockedBalance)} ALEPH
                </p>
              )}
            </>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-muted ${item.color}`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Info Card */}
        <Card className="p-4 border-primary/30 bg-primary/10">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-foreground">
              <p className="font-medium">Tentang ALEPH Token</p>
              <p className="mt-1 text-muted-foreground">
                ALEPH adalah token internal AIvalid yang digunakan untuk transaksi antar pengguna.
                1 ALEPH = Rp 1.000. Minimal deposit Rp 10.000 dan minimal withdraw Rp 50.000.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
