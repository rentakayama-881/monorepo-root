'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '../../../lib/api';

function normalizeOrderId(raw) {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (withoutPrefix.length !== 64) return '';
  return `0x${withoutPrefix}`;
}

function formatAmount(amount) {
  const parsed = Number(amount) / 1_000_000;
  if (Number.isNaN(parsed)) return '-';
  return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export default function OrderDetailPage() {
  const params = useParams();
  const incomingId = useMemo(() => normalizeOrderId(params?.orderId), [params?.orderId]);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!incomingId) {
        setError('Order ID tidak valid');
        setLoading(false);
        return;
      }
      try {
        const data = await fetchJson(`/api/orders/${incomingId}`, { cache: 'no-store' });
        setOrder(data);
      } catch (err) {
        setError(err.message || 'Gagal memuat order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // Auto-refresh every 10 seconds for pending/active orders
    const intervalId = setInterval(() => {
      if (incomingId && !error) {
        fetchOrder();
      }
    }, 10000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [incomingId, error]);

  return (
    <div className="max-w-3xl mx-auto bg-[rgb(var(--surface))] p-6 rounded-lg border border-[rgb(var(--border))]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Detail Order</h1>
        {incomingId && <span className="text-xs text-[rgb(var(--muted))]">{incomingId}</span>}
      </div>

      {loading && <p className="text-sm text-[rgb(var(--muted))]">Memuat data order...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {order && !error && (
        <>
          <div className="mb-4 p-3 bg-[rgb(var(--brand))]/10 border border-[rgb(var(--brand))]/30 rounded-md text-sm text-[rgb(var(--brand))]">
            <span className="font-medium">🔄 Auto-refresh aktif</span> - Status order akan diperbarui otomatis setiap 10 detik
          </div>
          <div className="divide-y divide-[rgb(var(--border))] text-sm">
            <div className="py-3 flex justify-between">
              <span className="text-[rgb(var(--muted))]">Status</span>
              <span className="font-semibold text-[rgb(var(--fg))]">{order.status}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[rgb(var(--muted))]">Tx Hash</span>
              <span className="font-mono text-[rgb(var(--fg))] break-all">{order.tx_hash || '-'}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[rgb(var(--muted))]">Escrow Address</span>
              <span className="font-mono text-[rgb(var(--fg))] break-all">{order.escrow_address || '-'}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[rgb(var(--muted))]">Buyer</span>
              <span className="font-mono text-[rgb(var(--fg))] break-all">{order.buyer_wallet}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[rgb(var(--muted))]">Seller</span>
              <span className="font-mono text-[rgb(var(--fg))] break-all">{order.seller_wallet}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[rgb(var(--muted))]">Amount (USDT)</span>
              <span className="font-semibold text-[rgb(var(--fg))]">{formatAmount(order.amount_usdt)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[rgb(var(--muted))]">Chain ID</span>
              <span className="font-mono text-[rgb(var(--fg))]">{order.chain_id}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
