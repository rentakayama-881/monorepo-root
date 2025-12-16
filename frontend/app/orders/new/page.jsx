'use client';

import { useState } from 'react';
import { getApiBase } from '../../../lib/api';

const DEPLOY_SELECTOR = '0xd8075080';
const ESCROW_DEPLOYED_TOPIC = '0xe993d834de25b762f3fd5499ffa250d00bd10953e20eee7cd06e9dbb0280b3a1';
const SIGNATURE_OFFSET = (32n * 5n).toString(16);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeHex(value) {
  if (!value) return '';
  return value.startsWith('0x') ? value.toLowerCase() : `0x${value.toLowerCase()}`;
}

function pad32(hexValue) {
  const clean = hexValue.replace(/^0x/, '');
  return clean.padStart(64, '0');
}

function encodeDeployEscrow(orderId, buyer, seller, amountMinor, signature) {
  const cleanOrderId = orderId.replace(/^0x/, '');
  const cleanBuyer = buyer.replace(/^0x/, '').padStart(64, '0');
  const cleanSeller = seller.replace(/^0x/, '').padStart(64, '0');
  const amountHex = BigInt(amountMinor).toString(16);
  const cleanSignature = signature.replace(/^0x/, '');

  const head = [
    pad32(cleanOrderId),
    pad32(cleanBuyer),
    pad32(cleanSeller),
    pad32(amountHex),
    pad32(SIGNATURE_OFFSET),
  ];

  const sigLengthHex = (cleanSignature.length / 2).toString(16);
  let sigData = cleanSignature;
  while (sigData.length % 64 !== 0) {
    sigData += '0';
  }

  const tail = [pad32(sigLengthHex), sigData];
  return `0x${DEPLOY_SELECTOR.replace(/^0x/, '')}${head.join('')}${tail.join('')}`;
}

function parseEscrowFromReceipt(receipt, orderId) {
  const normalizedOrderId = normalizeHex(orderId);
  for (const log of receipt.logs || []) {
    if (!log.topics || log.topics.length < 4) continue;
    if (normalizeHex(log.topics[0]) !== normalizeHex(ESCROW_DEPLOYED_TOPIC)) continue;
    if (normalizeHex(log.topics[1]) !== normalizedOrderId) continue;

    const data = log.data.replace(/^0x/, '');
    const escrowHex = data.slice(24, 64);
    const amountHex = data.slice(64, 128);
    return {
      escrow: normalizeHex(escrowHex.length ? `0x${escrowHex}` : ''),
      amount: amountHex ? BigInt(`0x${amountHex}`) : 0n,
    };
  }
  return null;
}

async function waitForReceipt(txHash) {
  for (let i = 0; i < 60; i += 1) {
    const receipt = await window.ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
    if (receipt) return receipt;
    await sleep(2000);
  }
  throw new Error('Timeout menunggu transaksi konfirmasi');
}

export default function NewOrderPage() {
  const [buyerAddress, setBuyerAddress] = useState('');
  const [sellerWallet, setSellerWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [signature, setSignature] = useState('');
  const [escrowAddress, setEscrowAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

  const connectWallet = async () => {
    setError('');
    if (!window.ethereum) {
      setError('Metamask tidak terdeteksi di browser.');
      return;
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setBuyerAddress(accounts[0]);
  };

  const parseAmountMinor = () => {
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return null;
    }
    return Math.round(parsed * 1_000_000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    const minor = parseAmountMinor();
    if (!minor) {
      setError('Nominal USDT tidak valid.');
      return;
    }
    if (!buyerAddress) {
      setError('Hubungkan wallet terlebih dahulu.');
      return;
    }

    try {
      setStatus('Membuat order di backend...');
      const res = await fetch(`${getApiBase()}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_wallet: buyerAddress,
          seller_wallet: sellerWallet,
          amount_usdt: minor,
        }),
      });
      if (!res.ok) {
        throw new Error('Gagal membuat order');
      }
      const data = await res.json();
      setOrderId(data.order_id);
      setSignature(data.signature);
      setStatus('Mendeploy escrow lewat wallet...');
      await deployEscrow(data, minor);
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan');
      setStatus('');
    }
  };

  const deployEscrow = async (orderMeta, minor) => {
    if (!window.ethereum) {
      throw new Error('Metamask tidak tersedia');
    }

    const targetFactory = factoryAddress || orderMeta.factory;
    if (!targetFactory) {
      throw new Error('Alamat factory belum dikonfigurasi');
    }

    const data = encodeDeployEscrow(
      normalizeHex(orderMeta.order_id),
      normalizeHex(buyerAddress),
      normalizeHex(sellerWallet),
      BigInt(minor),
      normalizeHex(orderMeta.signature),
    );

    const tx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: buyerAddress,
          to: normalizeHex(targetFactory),
          data,
        },
      ],
    });

    setTxHash(tx);
    setStatus('Menunggu konfirmasi blok...');
    const receipt = await waitForReceipt(tx);
    const parsed = parseEscrowFromReceipt(receipt, orderMeta.order_id);
    if (!parsed?.escrow) {
      throw new Error('Tidak menemukan event EscrowDeployed');
    }

    setEscrowAddress(parsed.escrow);
    setStatus('Sinkron ke backend...');

    const attach = await fetch(`${getApiBase()}/api/orders/${orderMeta.order_id}/attach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escrow_address: parsed.escrow, tx_hash: tx }),
    });
    if (!attach.ok) {
      throw new Error('Gagal menyimpan escrow di backend');
    }
    setStatus('Escrow berhasil dibuat dan disimpan.');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">Buat Order Escrow</h1>
      <p className="text-sm text-gray-600 mb-6">
        Langkah cepat MVP: backend menandatangani payload order, wallet Anda mendeploy Escrow lewat factory,
        lalu backend disinkronkan dengan alamat escrow dan tx hash.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={connectWallet}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {buyerAddress ? 'Wallet Terhubung' : 'Hubungkan Wallet'}
        </button>
        {buyerAddress && <span className="text-sm text-gray-700">{buyerAddress}</span>}
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Alamat Seller</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={sellerWallet}
            onChange={(e) => setSellerWallet(e.target.value)}
            placeholder="0x..."
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Jumlah (USDT)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.5"
            type="number"
            step="0.000001"
            min="0"
            required
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Buat & Deploy Escrow
        </button>
      </form>

      {status && <p className="mt-4 text-blue-700 text-sm">{status}</p>}
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}

      {(orderId || escrowAddress) && (
        <div className="mt-6 space-y-2 text-sm">
          {orderId && (
            <div>
              <div className="font-semibold">Order ID</div>
              <div className="break-all">{orderId}</div>
            </div>
          )}
          {signature && (
            <div>
              <div className="font-semibold">Signature</div>
              <div className="break-all">{signature}</div>
            </div>
          )}
          {escrowAddress && (
            <div>
              <div className="font-semibold">Escrow Address</div>
              <div className="break-all">{escrowAddress}</div>
            </div>
          )}
          {txHash && (
            <div>
              <div className="font-semibold">Tx Hash</div>
              <div className="break-all">{txHash}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
