"use client";

import { useEffect, useState } from "react";

export default function RefillBalancePage() {
  const API = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080"}/api`;
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [address, setAddress] = useState(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API}/balance/refill/info`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Gagal membaca info refill"))))
      .then((data) => {
        if (!cancelled) {
          setInfo(data);
          setError("");
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [API]);

  useEffect(() => {
    setMounted(true);
    try {
      setAuthed(!!localStorage.getItem("token"));
    } catch (_) {
      setAuthed(false);
    }
  }, []);

  
  async function getAddress() {
    if (!authed) {
      setError("Anda harus login terlebih dahulu untuk refill balance.");
      return;
    }
    setError("");
    setReqLoading(true);
    try {
      const t = localStorage.getItem("token");
      const r = await fetch(`${API}/balance/refill/address`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!r.ok) throw new Error("Gagal mengambil address refill");
      const data = await r.json();
      setAddress(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setReqLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-semibold">Refill Balance: PolygonEcosystemToken</h2>

      <ol className="list-decimal ml-5 mt-3 space-y-1 text-sm">
        <li>Periksa detail rate dan fee di bawah.</li>
        <li>Klik <b>Lanjutkan Refill</b> untuk mendapatkan alamat deposit unik Anda.</li>
        <li>Transfer hanya <b>PolygonEcosystemToken</b> ke alamat tersebut melalui jaringan <b>Polygon (Chain ID 137/0×89)</b>.</li>
        <li>Saldo akan otomatis masuk setelah deposit terkonfirmasi di blockchain (estimasi 1-10 menit).</li>
      </ol>

      <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
        JANGAN transfer token selain PolygonEcosystemToken. Kesalahan transfer di luar tanggung jawab kami.
      </div>

      {loading ? (
        <div className="mt-4 text-sm">Loading...</div>
      ) : error ? (
        <div className="mt-4 text-sm text-red-600">{error}</div>
      ) : info ? (
        <div id="refill-info" className="mt-4 space-y-1 text-sm">
          <div>
            Rate: <b>1 {info.token} = Rp {Number(info.rate_idr).toLocaleString('id-ID')}</b>
          </div>
          <div>
            Fee Deposit: <b>{info.fee_percent}%</b> (tidak termasuk biaya jaringan)
          </div>
          <div>
            Jaringan: <b>{info.network.name}</b>
          </div>
          <div>
            Explorer: <a className="underline" href={info.network.explorer} target="_blank" rel="noreferrer">{info.network.explorer}</a>
          </div>
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">{info.info}</div>
        </div>
      ) : null}

      <div className="mt-4">
        {!mounted ? (
          <div style={{ height: 36 }} />
        ) : authed ? (
          <button onClick={getAddress} disabled={reqLoading} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
            {reqLoading ? "Memproses..." : "Lanjutkan Refill"}
          </button>
        ) : (
          <div className="text-sm text-red-600">Anda harus login terlebih dahulu untuk refill balance.</div>
        )}
      </div>

      {address && (
        <div id="address-section" className="mt-4 space-y-2">
          <h3 className="font-medium">Alamat Deposit Anda</h3>
          <div className="font-mono border rounded p-2 bg-neutral-50">{address.deposit_address}</div>
          <div className="border rounded p-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address.deposit_address)}`}
              alt="QR Code Deposit"
              width={200}
              height={200}
            />
          </div>
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">{address.info}</div>
          <div className="text-sm"><i>Jaringan: {address.network?.name}</i></div>
          <div className="text-xs text-neutral-600">
            Saldo akan otomatis masuk dalam 1-10 menit setelah transaksi terkonfirmasi di blockchain Polygon.
          </div>
        </div>
      )}
    </div>
  );
}
