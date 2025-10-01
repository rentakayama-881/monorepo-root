export const dynamic = "force-static";

export const metadata = { title: "Contact Support" };

export default function ContactSupportPage() {
  return (
    <section className="prose max-w-3xl">
      <h2>Contact Support</h2>
      <p>
        Butuh bantuan? Tim support Legitimatex siap membantu Anda menyelesaikan kendala seputar akun, transaksi, maupun aktivitas komunitas.
      </p>
      <ul>
        <li>Email: <a href="mailto:support@legitimatex.com">support@legitimatex.com</a></li>
        <li>Telegram: <a href="https://t.me/legitimatex_support" target="_blank" rel="noreferrer">@legitimatex_support</a></li>
        <li>Jam Operasional: Senin - Jumat, 09.00 - 18.00 WIB</li>
      </ul>
      <p>
        Kirimkan detail permasalahan Anda secara lengkap agar kami dapat memberikan solusi yang tepat dan cepat.
      </p>
    </section>
  );
}
