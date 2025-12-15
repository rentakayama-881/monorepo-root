"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/api";

export default function TransferBalancePage() {
  const API = `${getApiBase()}/api`;
  const [user, setUser] = useState({ name: "", balance: 0 });
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [holdPeriod, setHoldPeriod] = useState("1h");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) return;
    fetch(`${API}/user/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data) => setUser({ name: data.name || "", balance: data.balance || 0 }))
      .catch(() => {});
  }, [API]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const t = localStorage.getItem("token");
      const res = await fetch(`${API}/balance/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          recipient_username: recipient,
          amount: parseFloat(amount),
          hold_period: holdPeriod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer gagal");
      setSuccess("Transfer berhasil diajukan.");
      setRecipient("");
      setAmount("");
      setHoldPeriod("1h");
      // update balance
      setUser((u) => ({ ...u, balance: u.balance - parseFloat(amount) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user.name) return <div>Loading...</div>;

  return (
    <div className="max-w-md mx-auto mt-8 bg-white border rounded p-6">
      <h1 className="text-xl font-semibold mb-4">Transfer Balance</h1>
      <p className="text-sm text-neutral-600 mb-4">
        Saldo Anda: IDR {user.balance}
      </p>
      <form onSubmit={handleTransfer} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Username Penerima</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Jumlah (IDR)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border px-3 py-2"
            min="1"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Masa Penahanan</label>
          <select
            value={holdPeriod}
            onChange={(e) => setHoldPeriod(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="1h">1 Jam</option>
            <option value="7d">7 Hari</option>
            <option value="12m">12 Bulan</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || parseFloat(amount) > user.balance}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Transfer"}
        </button>
      </form>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {success && <p className="text-green-600 text-sm mt-2">{success}</p>}
      <Link href="/account" className="block text-center mt-4 text-sm text-blue-600">
        Kembali ke Account
      </Link>
    </div>
  );
}
