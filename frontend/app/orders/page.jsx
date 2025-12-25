'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/api';
import { getToken } from '@/lib/auth';

function formatAmount(amount) {
  const parsed = Number(amount) / 1_000_000;
  if (Number.isNaN(parsed)) return '-';
  return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = useMemo(() => getToken(), []);
  const isAuthed = !!token;

  useEffect(() => {
    if (!isAuthed) {
      setError('Anda harus login untuk melihat riwayat order.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadOrders() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJson('/api/orders', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Gagal memuat riwayat order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, token]);

  return (
    <div className="mx-auto max-w-5xl rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Order History</h1>
          <p className="text-sm text-[rgb(var(--muted))]">Riwayat escrow yang Anda buat.</p>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-2 rounded-md border border-[rgb(var(--border))] px-3 py-2 text-sm font-semibold text-[rgb(var(--fg))] transition hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
        >
          New Order
          <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>

      {loading && <p className="mt-4 text-sm text-[rgb(var(--muted))]">Memuat riwayat order...</p>}
      {!loading && error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto">
          {orders.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">Belum ada order.</p>
          ) : (
            <table className="min-w-full divide-y divide-[rgb(var(--border))] text-sm text-[rgb(var(--fg))]">
              <thead className="bg-[rgb(var(--surface-2))]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Order ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Amount (USDT)</th>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Buyer</th>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Seller</th>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Chain</th>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Escrow</th>
                  <th className="px-3 py-2 text-left font-semibold text-[rgb(var(--muted))]">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-[rgb(var(--surface-2))]">
                    <td className="px-3 py-2 font-mono text-xs text-[rgb(var(--muted))]">
                      <Link href={`/orders/${order.order_id}`} className="underline decoration-[rgb(var(--border))] hover:text-[rgb(var(--fg))]">
                        {order.order_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 capitalize text-[rgb(var(--fg))]">{order.status}</td>
                    <td className="px-3 py-2 font-semibold text-[rgb(var(--fg))]">{formatAmount(order.amount_usdt)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[rgb(var(--muted))]">{order.buyer_wallet}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[rgb(var(--muted))]">{order.seller_wallet}</td>
                    <td className="px-3 py-2 text-[rgb(var(--fg))]">{order.chain_id}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[rgb(var(--muted))]">{order.escrow_address || '-'}</td>
                    <td className="px-3 py-2 text-[rgb(var(--muted))]">{formatDate(order.updated_at || order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
