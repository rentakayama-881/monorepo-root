export const dynamic = "force-static";

export const metadata = { title: "Pengajuan Badge" };

export default function PengajuanBadgePage() {
  return (
    <section className="prose max-w-3xl">
      <h2>Pengajuan Badge</h2>
      <p>
        Ingin mendapatkan pengakuan atas kontribusi Anda? Ajukan badge Legitimatex dengan mengikuti langkah berikut.
      </p>
      <ol>
        <li>Pastikan profil Anda telah dilengkapi dengan informasi terbaru dan valid.</li>
        <li>Siapkan bukti kontribusi atau portofolio yang relevan dalam bentuk tautan atau dokumen.</li>
        <li>Kirimkan pengajuan melalui email <a href="mailto:badge@legitimatex.com">badge@legitimatex.com</a> atau formulir resmi komunitas.</li>
      </ol>
      <p>
        Tim kurator kami akan meninjau pengajuan Anda maksimal dalam 5 hari kerja. Kami akan menghubungi Anda jika diperlukan informasi tambahan.
      </p>
    </section>
  );
}
