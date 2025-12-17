'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getApiBase } from '../../../lib/api';

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
        const res = await fetch(`${getApiBase()}/api/orders/${incomingId}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Order tidak ditemukan');
        }
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err.message || 'Gagal memuat order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [incomingId]);

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Detail Order</h1>
        {incomingId && <span className="text-xs text-gray-500">{incomingId}</span>}
      </div>

      {loading && <p className="text-sm text-gray-600">Memuat data order...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {order && !error && (
        <div className="divide-y divide-gray-200 text-sm">
          <div className="py-3 flex justify-between">
            <span className="text-gray-600">Status</span>
            <span className="font-semibold text-gray-800">{order.status}</span>
          </div>
          <div className="py-3 flex justify-between">
            <span className="text-gray-600">Tx Hash</span>
            <span className="font-mono text-gray-800 break-all">{order.tx_hash || '-'}</span>
          </div>
          <div className="py-3 flex justify-between">
            <span className="text-gray-600">Escrow Address</span>
            <span className="font-mono text-gray-800 break-all">{order.escrow_address || '-'}</span>
          </div>
          <div className="py-3 flex justify-between">
            <span className="text-gray-600">Buyer</span>
            <span className="font-mono text-gray-800 break-all">{order.buyer_wallet}</span>
          </div>
          <div className="py-3 flex justify-between">
            <span className="text-gray-600">Seller</span>
            <span className="font-mono text-gray-800 break-all">{order.seller_wallet}</span>
          </div>
          <div className="py-3 flex justify-between">
            <span className="text-gray-600">Amount (USDT)</span>
            <span className="font-semibold text-gray-800">{formatAmount(order.amount_usdt)}</span>
          </div>
          <div className="py-3 flex justify-between">
            <span className="text-gray-600">Chain ID</span>
            <span className="font-mono text-gray-800">{order.chain_id}</span>
          </div>
        </div>
      )}
    </div>
  );
}
