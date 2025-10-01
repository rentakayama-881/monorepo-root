export const dynamic = "force-static";

export const metadata = { title: "Aturan" };

export default function RulesContentPage() {
  return (
    <section className="prose max-w-3xl">
      <p>
        <strong>Aturan Komunitas.</strong>
      </p>

      <p>
        <strong>Prinsip Utama:</strong><br />
        Platform ini didirikan untuk memfasilitasi pertukaran pengetahuan, pengalaman, serta mengatasi kesenjangan sosial. Kami menjunjung tinggi ilmu dan pengalaman, memberikan penghargaan tertinggi untuk setiap upaya, sekecil apa pun, yang telah Anda lakukan. Kami menyingkirkan sebutan "teori" karena di sini setiap pengguna didorong untuk merealisasikan ide mereka dalam berbagai bentuk tindakan, teknik, dan inovasi.
      </p>

      <p>
        <strong>I. Pendaftaran & Akun</strong>
      </p>
      <ol>
        <li>Gunakan nama pengguna yang layak dan pantas. Hindari penggunaan kata-kata yang kasar atau melecehkan.</li>
        <li>Jaga keamanan akun Anda. Jika terjadi peretasan, segera laporkan agar akun tidak disalahgunakan.</li>
        <li>Kami sengaja hanya menyediakan opsi pendaftaran/masuk melalui akun GitHub untuk mencegah penyalahgunaan akun secara masif.</li>
      </ol>

      <p>
        <strong>II. Etika & Perilaku</strong>
      </p>
      <ol>
        <li>Dilarang melakukan serangan pribadi, termasuk menghina, merendahkan, atau mengancam pengguna lain.</li>
        <li>Kritik diperbolehkan, namun harus berfokus pada argumen atau gagasan, bukan pada individu.</li>
        <li>Dilarang melakukan diskriminasi berdasarkan ras, agama, gender, orientasi, atau latar belakang sosial.</li>
        <li>Dilarang menyebarkan konten yang merusak kemanusiaan, termasuk:
          <ol>
            <li>Kekerasan brutal, pelecehan seksual, eksploitasi anak, terorisme, perdagangan manusia, atau promosi bunuh diri.</li>
          </ol>
        </li>
        <li>
          <strong>Diskusi tentang topik sensitif</strong>, seperti peretasan, eksploitasi, perangkat perusak (malware), rekayasa sosial (social engineering), serangan DDoS, Injeksi SQL, XSS, pembobolan, dan serangan *bruteforce* diperbolehkan, **sebatas untuk tujuan edukasi, penelitian, atau simulasi**. Dengan ketentuan:
          <ol>
            <li>Tidak diperbolehkan memublikasikan data pribadi (*doxing*), akses ilegal yang masih aktif, atau metode yang dapat merugikan individu secara langsung.</li>
            <li>Tidak diperbolehkan mencuri data pribadi (misalnya, alamat surel) milik orang lain.</li>
            <li>Setiap pengguna bertanggung jawab secara pribadi atau kelompok atas segala konsekuensi hukum tanpa melibatkan pihak platform.</li>
          </ol>
        </li>
        <li>Humor, meme, atau percakapan ringan tidak dilarang selama tidak merendahkan atau melukai martabat orang lain.</li>
      </ol>

      <p>
        <strong>III. Konten & Diskusi</strong>
      </p>
      <ol>
        <li>Unggah konten pada kategori yang sesuai.</li>
        <li>Hindari pengiriman konten berulang (*flood*) dan spam.</li>
        <li>Judul thread harus jelas dan deskriptif, bukan hanya "Tolong!!!" atau "Help".</li>
        <li>Berbagi data atau alat uji diizinkan selama tidak digunakan untuk merugikan pihak nyata (misalnya, menyebarluaskan data sensitif yang masih aktif).</li>
      </ol>

      <p>
        <strong>IV. Transaksi & Komunitas</strong>
      </p>
      <ol>
        <li>Apabila terjadi transaksi, disarankan untuk menggunakan sistem penjaminan dana (*escrow*) hingga batas waktu kesepakatan tercapai.</li>
        <li>Dilarang menipu, memeras, atau menyalahgunakan kepercayaan pengguna lain.</li>
        <li>Di sini, **pengetahuan jauh lebih berharga daripada keuntungan semata**.</li>
        <li>Pengguna yang memiliki portofolio atau reputasi dari platform lain, seperti pengguna A yang telah menjual ribuan akun, atau pengguna B yang memiliki reputasi di platform lain, dapat menerima penghargaan berupa lencana. Kami tidak membatasi pengguna untuk memperoleh penghargaan dari berbagai platform. Kami memiliki pedoman selektif untuk mengidentifikasi kelayakan pengguna sebelum memutuskan untuk memberikan penghargaan.</li>
      </ol>

      <p>
        <strong>V. Penegakan Aturan</strong>
      </p>
      <ol>
        <li>Moderator dan arbitrator akan bertindak sebagai mediator untuk menyelesaikan konflik, bukan untuk membela salah satu pihak atau mengintervensi satu sama lain.</li>
        <li>Pelanggaran ringan akan dikenai teguran.</li>
        <li>Pelanggaran serius, seperti merugikan individu secara langsung, eksploitasi manusia, atau penipuan, akan berujung pada sanksi larangan permanen (*ban*).</li>
        <li>Diskusi mengenai keputusan moderator atau arbitrator diperbolehkan.</li>
      </ol>

      <p>
        <strong>VI. Nilai Dasar Komunitas</strong>
      </p>
      <ul>
        <li>Kemanusiaan di atas segalanya.</li>
        <li>Ilmu untuk berkembang, bukan untuk menindas.</li>
        <li>Kebebasan berpendapat harus dibarengi dengan tanggung jawab.</li>
        <li>Bertindak dengan rasionalitas dan kesadaran penuh.</li>
        <li>Saling menghargai, meskipun berbeda pandangan.</li>
        <li>Memiliki simpati, empati, dan kepedulian terhadap sesama.</li>
        <li>Di sini, kebebasan dan etika berpadu menjadi satu. Ketika Anda melanggar aturan, Anda akan menerima konsekuensinya, begitu pun sebaliknya. Anda tidak perlu membongkar seluruh rumah hanya untuk mengeluarkan mobil; ada banyak cara yang lebih baik, misalnya merusak garasi. Salam.</li>
      </ul>
    </section>
  );
}

