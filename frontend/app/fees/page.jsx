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
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-foreground">Biaya Layanan</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Struktur biaya transparan untuk semua layanan AlephDraad
        </p>
      </div>

      {/* Fee Structure */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Struktur Biaya</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {feeStructure.map((item) => (
            <div
              key={item.type}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-medium text-foreground">{item.type}</h3>
                <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-semibold text-foreground">
                  {item.fee}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">{item.description}</p>
              <ul className="space-y-1">
                {item.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <svg className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Minimum Penarikan</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Minimum penarikan ditentukan berdasarkan total nilai transaksi kumulatif Anda di platform.
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50/50">
                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Tier</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Kriteria</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">Min. Penarikan</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalTiers.map((tier, idx) => (
                <tr key={tier.tier} className={idx !== withdrawalTiers.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-3 py-2 font-medium text-foreground">{tier.tier}</td>
                  <td className="px-3 py-2 text-muted-foreground">{tier.criteria}</td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">{tier.minWithdraw}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Kebijakan ini bertujuan untuk menjaga stabilitas sistem pembayaran dan mengurangi risiko penyalahgunaan.
        </p>
      </section>

      {/* Settlement Information */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Informasi Pencairan Dana</h2>
        
        <div className="rounded-lg border border-amber-600/20 bg-amber-600/5 p-3">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              <h3 className="text-[13px] font-medium text-foreground">Penting: Waktu Pencairan Dana</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                AlephDraad menggunakan sistem pembayaran dengan mekanisme settlement H+1 hingga H+3 hari kerja, 
                tergantung metode pembayaran yang digunakan.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <h4 className="mb-2 text-[13px] font-medium text-foreground">Bagaimana Sistem Ini Bekerja?</h4>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[10px] font-medium text-foreground">1</span>
                <span>Ketika Anda melakukan <strong className="text-foreground">deposit</strong>, saldo akan langsung ditampilkan di wallet setelah pembayaran dikonfirmasi.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[10px] font-medium text-foreground">2</span>
                <span>Dana tersebut sudah bisa digunakan untuk <strong className="text-foreground">transaksi escrow</strong> di marketplace.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[10px] font-medium text-foreground">3</span>
                <span>Namun, dana baru bisa <strong className="text-foreground">ditarik ke rekening bank</strong> setelah proses settlement dari payment gateway selesai.</span>
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 text-sm font-medium text-foreground">Waktu Settlement Berdasarkan Metode</h4>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Metode Pembayaran</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Waktu Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2.5 text-foreground">Transfer Bank (VA)</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">H+1 hari kerja</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2.5 text-foreground">QRIS</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">H+1 hari kerja</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2.5 text-foreground">E-Wallet (OVO, DANA, dll)</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">H+2 hari kerja</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Kartu Kredit/Debit</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">H+3 hari kerja</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">H = Hari transaksi. Hari kerja tidak termasuk Sabtu, Minggu, dan hari libur nasional.</p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-2 text-sm font-medium text-foreground">Contoh Skenario</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-md bg-muted/50 p-3">
                <p className="mb-1 font-medium text-foreground">Skenario 1: Deposit lalu langsung withdraw</p>
                <p>User A deposit Rp 100.000 via QRIS pada hari Senin. Saldo langsung bertambah, tapi User A baru bisa withdraw pada hari Selasa (H+1) setelah dana settle dari payment gateway.</p>
              </div>
              <div className="rounded-md bg-muted/50 p-3">
                <p className="mb-1 font-medium text-foreground">Skenario 2: Menerima pembayaran escrow</p>
                <p>User B menerima pembayaran escrow Rp 500.000 pada hari Rabu. Escrow di-release hari itu juga. Jika dana asal dari deposit QRIS, User B bisa withdraw setelah settlement deposit asal selesai + 1 hari kerja.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Escrow Fee Explanation */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Perhitungan Biaya Escrow</h2>
        <div className="rounded-lg border border-border p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Biaya escrow sebesar <strong className="text-foreground">2%</strong> dibebankan kepada <strong className="text-foreground">seller</strong> dan dihitung dari nilai transaksi.
          </p>
          <div className="rounded-md bg-muted/50 p-4">
            <h4 className="mb-3 text-sm font-medium text-foreground">Contoh Perhitungan</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nilai Transaksi</span>
                <span className="text-foreground">Rp 1.000.000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Biaya Escrow (2%)</span>
                <span className="text-destructive">- Rp 20.000</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-foreground">Diterima Seller</span>
                  <span className="text-emerald-600">Rp 980.000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Pertanyaan Umum</h2>
        <div className="space-y-3">
          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
              Kenapa ada minimum penarikan berbeda?
              <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              Kebijakan ini membantu kami mengelola cash flow dan mencegah penyalahgunaan sistem. Pengguna dengan volume transaksi tinggi mendapat minimum lebih tinggi karena mereka memiliki perputaran dana yang lebih besar.
            </div>
          </details>

          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
              Apakah ada biaya tersembunyi?
              <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              Tidak. Semua biaya yang tercantum di halaman ini adalah biaya lengkap. Tidak ada biaya tambahan yang tersembunyi.
            </div>
          </details>

          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
              Bagaimana jika withdraw gagal?
              <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              Jika penarikan gagal (misalnya nomor rekening salah), dana akan dikembalikan ke wallet Anda dalam 1-3 hari kerja. Biaya penarikan tetap dikenakan karena sudah diproses oleh payment gateway.
            </div>
          </details>

          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
              Apakah biaya bisa berubah?
              <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              Biaya dapat berubah sewaktu-waktu dengan pemberitahuan minimal 30 hari sebelumnya melalui email dan pengumuman di platform.
            </div>
          </details>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <div>
            <p className="text-sm font-medium text-foreground">Ada Pertanyaan?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hubungi tim kami di{" "}
              <a href="mailto:tx@alephdraad.fun" className="text-foreground font-medium hover:underline">
                tx@alephdraad.fun
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
