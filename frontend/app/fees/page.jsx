export const dynamic = "force-static";

export const metadata = {
  title: "Biaya Layanan - AlephDraad",
  description: "Informasi lengkap biaya deposit, transaksi escrow, dan penarikan dana di AlephDraad"
};

const feeStructure = [
  {
    type: "Deposit",
    fee: "Gratis",
    description: "Top-up saldo ke wallet AlephDraad",
    details: [
      "Tidak ada biaya administrasi",
      "Metode: Transfer Bank, QRIS, E-Wallet",
      "Dana masuk setelah konfirmasi pembayaran",
    ],
  },
  {
    type: "Transaksi Escrow",
    fee: "2%",
    description: "Biaya per transaksi marketplace",
    details: [
      "Ditanggung oleh seller",
      "Dihitung dari nilai transaksi",
      "Contoh: Transaksi Rp 100.000 = Fee Rp 2.000",
    ],
  },
  {
    type: "Penarikan Dana",
    fee: "Rp 7.500",
    description: "Pencairan ke rekening bank",
    details: [
      "Biaya flat per penarikan",
      "Semua bank didukung",
      "Proses H+1 atau H+3 hari kerja",
    ],
  },
];

const withdrawalTiers = [
  {
    tier: "Pengguna Baru",
    criteria: "Total transaksi < Rp 1.000.000",
    minWithdraw: "Rp 10.000",
  },
  {
    tier: "Pengguna Aktif",
    criteria: "Total transaksi ≥ Rp 1.000.000",
    minWithdraw: "Rp 400.000",
  },
  {
    tier: "Pengguna Premium",
    criteria: "Total transaksi ≥ Rp 30.000.000",
    minWithdraw: "Rp 900.000",
  },
];

export default function FeesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Biaya Layanan</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Struktur biaya transparan untuk semua layanan AlephDraad
        </p>
      </div>

      {/* Fee Structure */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Struktur Biaya</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {feeStructure.map((item) => (
            <div
              key={item.type}
              className="rounded-lg border border-[rgb(var(--border))] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-[rgb(var(--fg))]">{item.type}</h3>
                <span className="rounded-md bg-[rgb(var(--surface-2))] px-2 py-0.5 text-sm font-semibold text-[rgb(var(--fg))]">
                  {item.fee}
                </span>
              </div>
              <p className="mb-3 text-xs text-[rgb(var(--muted))]">{item.description}</p>
              <ul className="space-y-1.5">
                {item.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-[rgb(var(--muted))]">
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[rgb(var(--success))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Minimum Withdrawal Tiers */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Minimum Penarikan</h2>
        <p className="mb-4 text-sm text-[rgb(var(--muted))]">
          Minimum penarikan ditentukan berdasarkan total nilai transaksi kumulatif Anda di platform.
        </p>
        <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--muted))]">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--muted))]">Kriteria</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[rgb(var(--muted))]">Min. Penarikan</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalTiers.map((tier, idx) => (
                <tr key={tier.tier} className={idx !== withdrawalTiers.length - 1 ? "border-b border-[rgb(var(--border))]" : ""}>
                  <td className="px-4 py-3 font-medium text-[rgb(var(--fg))]">{tier.tier}</td>
                  <td className="px-4 py-3 text-[rgb(var(--muted))]">{tier.criteria}</td>
                  <td className="px-4 py-3 text-right font-medium text-[rgb(var(--fg))]">{tier.minWithdraw}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">
          Kebijakan ini bertujuan untuk menjaga stabilitas sistem pembayaran dan mengurangi risiko penyalahgunaan.
        </p>
      </section>

      {/* Settlement Information */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Informasi Pencairan Dana</h2>
        
        <div className="rounded-lg border border-[rgb(var(--warning))/0.3] bg-[rgb(var(--warning))/0.05] p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--warning))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-[rgb(var(--fg))]">Penting: Waktu Pencairan Dana</h3>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                AlephDraad menggunakan sistem pembayaran dengan mekanisme settlement H+1 hingga H+3 hari kerja, 
                tergantung metode pembayaran yang digunakan.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-[rgb(var(--border))] p-4">
            <h4 className="mb-2 text-sm font-medium text-[rgb(var(--fg))]">Bagaimana Sistem Ini Bekerja?</h4>
            <ol className="space-y-2 text-sm text-[rgb(var(--muted))]">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-xs font-medium text-[rgb(var(--fg))]">1</span>
                <span>Ketika Anda melakukan <strong className="text-[rgb(var(--fg))]">deposit</strong>, saldo akan langsung ditampilkan di wallet setelah pembayaran dikonfirmasi.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-xs font-medium text-[rgb(var(--fg))]">2</span>
                <span>Dana tersebut sudah bisa digunakan untuk <strong className="text-[rgb(var(--fg))]">transaksi escrow</strong> di marketplace.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-xs font-medium text-[rgb(var(--fg))]">3</span>
                <span>Namun, dana baru bisa <strong className="text-[rgb(var(--fg))]">ditarik ke rekening bank</strong> setelah proses settlement dari payment gateway selesai.</span>
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-[rgb(var(--border))] p-4">
            <h4 className="mb-3 text-sm font-medium text-[rgb(var(--fg))]">Waktu Settlement Berdasarkan Metode</h4>
            <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[rgb(var(--muted))]">Metode Pembayaran</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[rgb(var(--muted))]">Waktu Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[rgb(var(--border))]">
                    <td className="px-4 py-2.5 text-[rgb(var(--fg))]">Transfer Bank (VA)</td>
                    <td className="px-4 py-2.5 text-right text-[rgb(var(--muted))]">H+1 hari kerja</td>
                  </tr>
                  <tr className="border-b border-[rgb(var(--border))]">
                    <td className="px-4 py-2.5 text-[rgb(var(--fg))]">QRIS</td>
                    <td className="px-4 py-2.5 text-right text-[rgb(var(--muted))]">H+1 hari kerja</td>
                  </tr>
                  <tr className="border-b border-[rgb(var(--border))]">
                    <td className="px-4 py-2.5 text-[rgb(var(--fg))]">E-Wallet (OVO, DANA, dll)</td>
                    <td className="px-4 py-2.5 text-right text-[rgb(var(--muted))]">H+2 hari kerja</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-[rgb(var(--fg))]">Kartu Kredit/Debit</td>
                    <td className="px-4 py-2.5 text-right text-[rgb(var(--muted))]">H+3 hari kerja</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">H = Hari transaksi. Hari kerja tidak termasuk Sabtu, Minggu, dan hari libur nasional.</p>
          </div>

          <div className="rounded-lg border border-[rgb(var(--border))] p-4">
            <h4 className="mb-2 text-sm font-medium text-[rgb(var(--fg))]">Contoh Skenario</h4>
            <div className="space-y-3 text-sm text-[rgb(var(--muted))]">
              <div className="rounded-md bg-[rgb(var(--surface-2))] p-3">
                <p className="mb-1 font-medium text-[rgb(var(--fg))]">Skenario 1: Deposit lalu langsung withdraw</p>
                <p>User A deposit Rp 100.000 via QRIS pada hari Senin. Saldo langsung bertambah, tapi User A baru bisa withdraw pada hari Selasa (H+1) setelah dana settle dari payment gateway.</p>
              </div>
              <div className="rounded-md bg-[rgb(var(--surface-2))] p-3">
                <p className="mb-1 font-medium text-[rgb(var(--fg))]">Skenario 2: Menerima pembayaran escrow</p>
                <p>User B menerima pembayaran escrow Rp 500.000 pada hari Rabu. Escrow di-release hari itu juga. Jika dana asal dari deposit QRIS, User B bisa withdraw setelah settlement deposit asal selesai + 1 hari kerja.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Escrow Fee Explanation */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Perhitungan Biaya Escrow</h2>
        <div className="rounded-lg border border-[rgb(var(--border))] p-4">
          <p className="mb-4 text-sm text-[rgb(var(--muted))]">
            Biaya escrow sebesar <strong className="text-[rgb(var(--fg))]">2%</strong> dibebankan kepada <strong className="text-[rgb(var(--fg))]">seller</strong> dan dihitung dari nilai transaksi.
          </p>
          <div className="rounded-md bg-[rgb(var(--surface-2))] p-4">
            <h4 className="mb-3 text-sm font-medium text-[rgb(var(--fg))]">Contoh Perhitungan</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[rgb(var(--muted))]">Nilai Transaksi</span>
                <span className="text-[rgb(var(--fg))]">Rp 1.000.000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgb(var(--muted))]">Biaya Escrow (2%)</span>
                <span className="text-[rgb(var(--error))]">- Rp 20.000</span>
              </div>
              <div className="border-t border-[rgb(var(--border))] pt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-[rgb(var(--fg))]">Diterima Seller</span>
                  <span className="text-[rgb(var(--success))]">Rp 980.000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Pertanyaan Umum</h2>
        <div className="space-y-3">
          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[rgb(var(--fg))]">
              Kenapa ada minimum penarikan berbeda?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
              Kebijakan ini membantu kami mengelola cash flow dan mencegah penyalahgunaan sistem. Pengguna dengan volume transaksi tinggi mendapat minimum lebih tinggi karena mereka memiliki perputaran dana yang lebih besar.
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[rgb(var(--fg))]">
              Apakah ada biaya tersembunyi?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
              Tidak. Semua biaya yang tercantum di halaman ini adalah biaya lengkap. Tidak ada biaya tambahan yang tersembunyi.
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[rgb(var(--fg))]">
              Bagaimana jika withdraw gagal?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
              Jika penarikan gagal (misalnya nomor rekening salah), dana akan dikembalikan ke wallet Anda dalam 1-3 hari kerja. Biaya penarikan tetap dikenakan karena sudah diproses oleh payment gateway.
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[rgb(var(--fg))]">
              Apakah biaya bisa berubah?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
              Biaya dapat berubah sewaktu-waktu dengan pemberitahuan minimal 30 hari sebelumnya melalui email dan pengumuman di platform.
            </div>
          </details>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[rgb(var(--fg))]">Ada Pertanyaan?</p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Hubungi tim kami di{" "}
              <a href="mailto:tx@alephdraad.fun" className="text-[rgb(var(--fg))] font-medium hover:underline">
                tx@alephdraad.fun
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
