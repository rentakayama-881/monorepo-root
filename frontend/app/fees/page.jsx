import { generateFAQStructuredData } from "@/lib/seo";
import { CheckIcon, CreditCardIcon, InfoIcon } from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

const feesFaqData = [
  {
    question: "Apakah ada biaya tersembunyi?",
    answer:
      "Tidak ada. Biaya pada halaman ini merupakan biaya yang berlaku untuk layanan yang disebutkan.",
  },
  {
    question: "Mengapa minimum penarikan bisa berbeda?",
    answer:
      "Batas minimum disesuaikan dengan riwayat volume transaksi untuk menjaga stabilitas operasional dan manajemen risiko.",
  },
  {
    question: "Apa yang terjadi jika penarikan gagal?",
    answer:
      "Dana akan dikembalikan ke saldo pengguna setelah proses verifikasi kegagalan selesai sesuai ketentuan layanan.",
  },
  {
    question: "Apakah biaya layanan dapat berubah?",
    answer:
      "Dapat berubah. Jika ada pembaruan, informasi akan diumumkan melalui platform sebelum diberlakukan.",
  },
];

export const metadata = {
  title: "Biaya Layanan - AIvalid",
  description:
    "Informasi biaya layanan AIvalid, termasuk transaksi, penarikan, dan ketentuan dasar penggunaan dana.",
  alternates: {
    canonical: "https://aivalid.id/fees",
  },
};

const feeRows = [
  {
    type: "Deposit",
    fee: "Gratis",
    notes: "Top up saldo ke akun AIvalid.",
  },
  {
    type: "Transaksi",
    fee: "2%",
    notes: "Biaya layanan dari nilai transaksi yang berhasil.",
  },
  {
    type: "Penarikan Dana",
    fee: "Rp 7.500",
    notes: "Biaya flat per proses penarikan ke rekening bank.",
  },
];

const withdrawalTiers = [
  {
    tier: "Pengguna Baru",
    criteria: "Total transaksi < Rp 1.000.000",
    min: "Rp 10.000",
  },
  {
    tier: "Pengguna Aktif",
    criteria: "Total transaksi >= Rp 1.000.000",
    min: "Rp 400.000",
  },
  {
    tier: "Pengguna Premium",
    criteria: "Total transaksi >= Rp 30.000.000",
    min: "Rp 900.000",
  },
];

const settlementRows = [
  { method: "Transfer Bank (VA)", time: "H+1 hari kerja" },
  { method: "QRIS", time: "H+1 hari kerja" },
  { method: "E-Wallet", time: "H+2 hari kerja" },
  { method: "Kartu Kredit/Debit", time: "H+3 hari kerja" },
];

function Table({ headers, rows, alignRight = [] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {headers.map((header, index) => (
              <th
                key={header}
                className={`px-4 py-2 text-left text-xs font-medium text-muted-foreground ${
                  alignRight.includes(index) ? "text-right" : ""
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex !== rows.length - 1 ? "border-b" : ""}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className={`px-4 py-2 text-muted-foreground ${
                    cellIndex === 0 ? "font-medium text-foreground" : ""
                  } ${alignRight.includes(cellIndex) ? "text-right" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FeesPage() {
  const faqJsonLd = generateFAQStructuredData(feesFaqData);

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <main className="container max-w-3xl py-10">
        <header className="mb-8">
          <p className="mb-2 text-sm text-muted-foreground">Biaya Layanan</p>
          <h1 className="mb-2 text-2xl font-bold">Struktur biaya AIvalid</h1>
          <p className="text-muted-foreground">
            Halaman ini menjelaskan biaya utama penggunaan platform, batas minimum penarikan, dan
            informasi waktu settlement.
          </p>
        </header>

        <section className="mb-10 space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
            <span>Biaya Utama</span>
          </h2>
          <article className="rounded-lg border bg-card p-4">
            <Table
              headers={["Layanan", "Biaya", "Keterangan"]}
              rows={feeRows.map((item) => [item.type, item.fee, item.notes])}
            />
          </article>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-lg font-semibold">Minimum Penarikan</h2>
          <article className="rounded-lg border bg-card p-4">
            <Table
              headers={["Tier", "Kriteria", "Min. Penarikan"]}
              rows={withdrawalTiers.map((item) => [item.tier, item.criteria, item.min])}
              alignRight={[2]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Kebijakan minimum penarikan mengikuti level aktivitas transaksi pengguna.
            </p>
          </article>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-lg font-semibold">Waktu Settlement</h2>
          <article className="rounded-lg border bg-card p-4">
            <Table
              headers={["Metode Pembayaran", "Waktu Settlement"]}
              rows={settlementRows.map((item) => [item.method, item.time])}
              alignRight={[1]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              H adalah hari transaksi. Hari kerja tidak termasuk Sabtu, Minggu, dan hari libur
              nasional.
            </p>
          </article>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-lg font-semibold">Pertanyaan Umum</h2>
          <div className="space-y-3">
            {feesFaqData.map((faq) => (
              <details key={faq.question} className="rounded-lg border bg-card">
                <summary className="cursor-pointer list-none p-4 text-sm font-medium">
                  {faq.question}
                </summary>
                <div className="border-t px-4 py-3 text-sm text-muted-foreground">{faq.answer}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Struktur biaya dapat diperbarui. Pengumuman perubahan akan disampaikan melalui
              platform sebelum berlaku.
            </span>
          </p>
          <p className="mt-2 flex items-start gap-2">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Gunakan informasi ini sebagai acuan sebelum melakukan transaksi.</span>
          </p>
        </section>
      </main>
    </>
  );
}
