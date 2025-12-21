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
    <div className="mx-auto max-w-5xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Order History</h1>
          <p className="text-sm text-neutral-600">Riwayat escrow yang Anda buat.</p>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
        >
          New Order
          <svg className="h-4 w-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>

      {loading && <p className="mt-4 text-sm text-neutral-700">Memuat riwayat order...</p>}
      {!loading && error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto">
          {orders.length === 0 ? (
            <p className="text-sm text-neutral-700">Belum ada order.</p>
          ) : (
            <table className="min-w-full divide-y divide-neutral-200 text-sm text-neutral-800">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Order ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Amount (USDT)</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Buyer</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Seller</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Chain</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Escrow</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono text-xs text-neutral-700">
                      <Link href={`/orders/${order.order_id}`} className="underline decoration-neutral-400 hover:text-neutral-900">
                        {order.order_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 capitalize text-neutral-800">{order.status}</td>
                    <td className="px-3 py-2 font-semibold text-neutral-900">{formatAmount(order.amount_usdt)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-700">{order.buyer_wallet}</td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-700">{order.seller_wallet}</td>
                    <td className="px-3 py-2 text-neutral-800">{order.chain_id}</td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-700">{order.escrow_address || '-'}</td>
                    <td className="px-3 py-2 text-neutral-700">{formatDate(order.updated_at || order.created_at)}</td>
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
