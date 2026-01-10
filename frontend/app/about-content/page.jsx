import {
  TargetIcon,
  UsersIcon,
  CheckIcon,
  MessageCircleIcon,
  ShieldIcon,
  AwardIcon,
  ScaleIcon,
  MailIcon,
  GlobeIcon,
  HeartIcon,
  ZapIcon,
} from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = { 
  title: "Tentang Kami - Alephdraad",
  description: "PT Alephdraad Utility Stack - Platform komunitas digital untuk forum, marketplace, dan pertukaran pengetahuan"
};

// Reusable styled list item with icon - compact
function ListItem({ children, icon: Icon = CheckIcon }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-[rgb(var(--muted))]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[13px]">{children}</span>
    </li>
  );
}

// Section card with icon header - compact style
function Section({ title, icon: Icon, children, highlight = false }) {
  return (
    <section className={`mb-4 overflow-hidden rounded-lg border ${highlight ? 'border-[rgb(var(--brand))]/20 bg-[rgb(var(--brand))]/5' : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))]'}`}>
      <div className={`border-b px-4 py-3 ${highlight ? 'border-[rgb(var(--brand))]/20 bg-[rgb(var(--brand))]/5' : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/30'}`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--fg))]">
          <Icon className="h-4 w-4 text-[rgb(var(--muted))]" />
          <span>{title}</span>
        </h2>
      </div>
      <div className="p-4 text-[13px] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

// Service Card - compact style
function ServiceCard({ title, description, icon: Icon }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition-all hover:border-[rgb(var(--muted))]/50">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[rgb(var(--muted))]" />
        <h3 className="text-[13px] font-medium text-[rgb(var(--fg))]">{title}</h3>
      </div>
      <p className="text-xs text-[rgb(var(--muted))] leading-relaxed">{description}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-[rgb(var(--border))] pb-4">
        <h1 className="text-lg font-semibold text-[rgb(var(--fg))]">Tentang AlephDraad</h1>
        <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
          Platform komunitas digital Indonesia
        </p>
      </div>

      <article>
        {/* Company Info */}
        <Section title="Perusahaan" icon={ZapIcon}>
          <p className="mb-4 text-sm leading-relaxed text-[rgb(var(--muted))]">
            <strong className="text-[rgb(var(--fg))]">PT ALEPHDRAAD UTILITY STACK</strong> adalah perusahaan teknologi 
            yang berfokus pada pengembangan platform komunitas digital. Kami berkomitmen untuk menyediakan 
            ruang yang aman, terpercaya, dan bermanfaat bagi seluruh pengguna di Indonesia.
          </p>
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            Didirikan dengan visi untuk mendemokratisasi akses terhadap pengetahuan dan peluang ekonomi digital, 
            AlephDraad hadir sebagai jembatan antara komunitas, edukasi, dan transaksi yang transparan.
          </p>
        </Section>

        {/* Visi */}
        <Section title="Visi" icon={TargetIcon} highlight={true}>
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            Menjadi platform komunitas digital terdepan di Indonesia yang menghubungkan pengetahuan, 
            inovasi, dan peluang ekonomi secara inklusif dan berkelanjutan.
          </p>
        </Section>

        {/* Misi */}
        <Section title="Misi" icon={HeartIcon}>
          <ul className="space-y-2 text-[rgb(var(--muted))]">
            <ListItem icon={MessageCircleIcon}>
              Menyediakan platform diskusi yang berkualitas dan bebas dari konten berbahaya
            </ListItem>
            <ListItem icon={ShieldIcon}>
              Memfasilitasi transaksi digital yang aman dengan sistem escrow terpercaya
            </ListItem>
            <ListItem icon={UsersIcon}>
              Mendorong pertukaran pengetahuan dan pengalaman antar anggota komunitas
            </ListItem>
            <ListItem icon={AwardIcon}>
              Memberikan penghargaan kepada kontributor yang berdedikasi
            </ListItem>
          </ul>
        </Section>

        {/* Layanan */}
        <section className="mb-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[rgb(var(--fg))]">
            <ZapIcon className="h-4 w-4 text-[rgb(var(--muted))]" />
            Layanan Kami
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <ServiceCard 
              title="Forum Diskusi" 
              description="Ruang interaksi untuk berbagi ide, pengalaman, dan pengetahuan dengan sesama anggota komunitas."
              icon={MessageCircleIcon}
            />
            <ServiceCard 
              title="Marketplace" 
              description="Platform jual beli produk dan jasa digital dengan sistem escrow untuk keamanan transaksi."
              icon={ShieldIcon}
            />
            <ServiceCard 
              title="Sistem Reputasi" 
              description="Penghargaan berupa lencana dan level untuk anggota yang berkontribusi positif."
              icon={AwardIcon}
            />
          </div>
        </section>

        {/* Landasan Hukum */}
        <Section title="Landasan Hukum" icon={ScaleIcon}>
          <p className="mb-4 text-sm leading-relaxed text-[rgb(var(--muted))]">
            PT AlephDraad Utility Stack beroperasi sesuai dengan peraturan perundang-undangan Republik Indonesia, termasuk namun tidak terbatas pada:
          </p>
          <ul className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={ScaleIcon}>
              Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik (UU ITE) sebagaimana diubah dengan UU No. 19 Tahun 2016
            </ListItem>
            <ListItem icon={ScaleIcon}>
              Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik
            </ListItem>
            <ListItem icon={ShieldIcon}>
              Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi
            </ListItem>
            <ListItem icon={UsersIcon}>
              Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen
            </ListItem>
          </ul>
        </Section>

        {/* Contact */}
        <section className="rounded-lg border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface-2))] to-[rgb(var(--surface-1))] p-5">
          <h2 className="mb-4 flex items-center gap-3 text-base font-semibold text-[rgb(var(--fg))]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
              <MailIcon className="h-4 w-4" />
            </span>
            Kontak Perusahaan
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]">
                <MailIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-[rgb(var(--muted))]">Email</p>
                <a href="mailto:ops@alephdraad.fun" className="text-sm font-medium text-[rgb(var(--fg))] hover:underline">
                  ops@alephdraad.fun
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]">
                <GlobeIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-[rgb(var(--muted))]">Website</p>
                <a href="https://www.alephdraad.fun" className="text-sm font-medium text-[rgb(var(--fg))] hover:underline">
                  www.alephdraad.fun
                </a>
              </div>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
