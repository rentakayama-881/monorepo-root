"use client";

import Image from "next/image";
import { useState } from "react";
import { Copy, Check, AlertTriangle, ShieldCheck, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import CircularCountdown from "./CircularCountdown";
import { TonIcon, UsdtIcon } from "./CryptoIcons";

const CRYPTO_ICON_MAP = {
  TON: TonIcon,
  USDT: UsdtIcon,
};

function truncateAddress(addr) {
  if (!addr || addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

/**
 * Premium "Waiting for Payment" step for crypto deposit.
 *
 * @param {object}   depositData     - { payAmount, payCurrency, network, qrCode, address }
 * @param {number}   countdown       - remaining seconds
 * @param {number}   countdownTotal  - total seconds for the timer ring
 * @param {boolean}  copied          - whether address was just copied
 * @param {function} onCopyAddress   - copy handler
 * @param {boolean}  cancelling      - cancel in progress
 * @param {function} onCancelDeposit - cancel handler
 */
export default function PaymentWaiting({
  depositData,
  countdown,
  countdownTotal,
  copied,
  onCopyAddress,
  cancelling,
  onCancelDeposit,
}) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const CryptoIcon = CRYPTO_ICON_MAP[depositData.payCurrency] || null;

  return (
    <div className="relative space-y-6">
      {/* Ambient glow blob behind content */}
      <div
        className="ambient-blob animate-ambient-glow pointer-events-none absolute -top-12 left-1/2 -z-10 h-64 w-80 -translate-x-1/2"
        aria-hidden="true"
      />

      {/* ── Hero: Amount ── */}
      <section className="text-center space-y-3 pt-2">
        {CryptoIcon && (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 ring-1 ring-border">
            <CryptoIcon size="h-9 w-9" />
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1">Kirim tepat</p>
          <p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {depositData.payAmount}
            <span className="ml-1.5 text-lg font-semibold text-muted-foreground">
              {depositData.payCurrency}
            </span>
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-xs font-medium text-muted-foreground">
            Jaringan {depositData.network}
          </span>
        </div>

        <p className="text-xs text-muted-foreground/70">Sudah termasuk semua biaya jaringan</p>
      </section>

      {/* ── QR Code ── */}
      {depositData.qrCode && (
        <section className="flex justify-center">
          <div className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-border/50">
            <Image
              src={depositData.qrCode}
              alt="QR Code pembayaran"
              width={192}
              height={192}
              className="h-44 w-44 sm:h-48 sm:w-48"
              unoptimized
            />
          </div>
        </section>
      )}

      {/* ── Glass Card: Wallet Address ── */}
      <section>
        <label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Alamat Tujuan
        </label>
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowFullAddress((v) => !v)}
              className="min-w-0 flex-1 text-left transition-colors hover:text-primary"
              aria-label={
                showFullAddress ? "Sembunyikan alamat lengkap" : "Tampilkan alamat lengkap"
              }
            >
              <span className="block font-mono text-sm leading-relaxed break-all text-foreground">
                {showFullAddress ? depositData.address : truncateAddress(depositData.address)}
              </span>
            </button>

            <button
              type="button"
              onClick={onCopyAddress}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all",
                copied
                  ? "bg-success/10 text-success"
                  : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              aria-label="Salin alamat"
            >
              {copied ? (
                <Check className="size-4" strokeWidth={2.5} />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>

          {!showFullAddress && (
            <p className="text-[11px] text-muted-foreground/60">
              Ketuk alamat untuk menampilkan selengkapnya
            </p>
          )}
        </div>
      </section>

      {/* ── Circular Countdown Timer ── */}
      <section className="flex justify-center py-1">
        <CircularCountdown seconds={countdown} totalSeconds={countdownTotal} />
        {countdown <= 0 && (
          <p className="mt-1 text-center text-xs text-destructive">
            Waktu habis. Silakan buat deposit baru.
          </p>
        )}
      </section>

      {/* ── Waiting Pulse Indicator ── */}
      {countdown > 0 && (
        <div className="flex items-center justify-center gap-2.5 py-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-breathe-dot absolute inline-flex h-full w-full rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            Menunggu pembayaran masuk…
          </span>
        </div>
      )}

      {/* ── Warning Callout ── */}
      <section className="rounded-xl border-l-[3px] border-l-warning bg-muted/40 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-warning-foreground shrink-0" />
          <span className="text-xs font-semibold text-foreground">Perhatian</span>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground leading-relaxed">
          <li className="flex items-start gap-2">
            <Radio className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
            Kirim tepat sesuai jumlah yang tertera
          </li>
          <li className="flex items-start gap-2">
            <Radio className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
            Pastikan jaringan <strong className="text-foreground">{depositData.network}</strong>
          </li>
          <li className="flex items-start gap-2">
            <Radio className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
            Alamat berlaku selama waktu yang ditentukan
          </li>
          <li className="flex items-start gap-2">
            <Radio className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
            Saldo otomatis masuk setelah konfirmasi jaringan
          </li>
        </ul>
      </section>

      {/* ── Cancel Section ── */}
      <section className="space-y-3 pt-1">
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Salah input? Anda dapat membatalkan dan membuat deposit baru.
        </p>
        <p className="text-xs text-center font-medium text-destructive/70">
          <AlertTriangle className="mb-0.5 mr-1 inline size-3" />
          Jika kripto sudah dikirim, pembayaran tetap diproses
        </p>
        <button
          type="button"
          onClick={onCancelDeposit}
          disabled={cancelling}
          className="h-9 w-full rounded-xl border border-destructive/20 text-sm text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelling ? "Membatalkan..." : "Batalkan Deposit"}
        </button>
      </section>
    </div>
  );
}
