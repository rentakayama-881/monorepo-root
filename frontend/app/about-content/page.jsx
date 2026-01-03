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
  title: "Tentang Kami - AlephDraad",
  description: "PT AlephDraad Utility Stack - Platform komunitas digital untuk forum, marketplace, dan pertukaran pengetahuan"
};

// Reusable styled list item with icon
function ListItem({ children, icon: Icon = CheckIcon }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[rgb(var(--brand))]">
        <Icon className="h-4 w-4" />
      </span>
      <span>{children}</span>
    </li>
  );
}

// Section card with icon header
function Section({ title, icon: Icon, children, highlight = false }) {
  return (
    <section className={`mb-6 overflow-hidden rounded-xl border transition-all hover:border-[rgb(var(--brand))]/20 ${highlight ? 'border-[rgb(var(--brand))]/30 bg-[rgb(var(--brand))]/5' : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-1))]'}`}>
      <div className={`border-b px-5 py-4 ${highlight ? 'border-[rgb(var(--brand))]/20 bg-[rgb(var(--brand))]/5' : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/50'}`}>
        <h2 className="flex items-center gap-3 text-base font-semibold text-[rgb(var(--fg))]">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${highlight ? 'bg-[rgb(var(--brand))]/20' : 'bg-[rgb(var(--brand))]/10'} text-[rgb(var(--brand))]`}>
            <Icon className="h-4 w-4" />
          </span>
          <span>{title}</span>
        </h2>
      </div>
      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

// Service Card
function ServiceCard({ title, description, icon: Icon }) {
  return (
    <div className="group rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-1))] p-5 transition-all hover:border-[rgb(var(--brand))]/30 hover:shadow-md">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--brand))]/10 text-[rgb(var(--brand))] transition-colors group-hover:bg-[rgb(var(--brand))]/20">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-sm font-semibold text-[rgb(var(--fg))]">{title}</h3>
      <p className="text-sm text-[rgb(var(--muted))]">{description}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--brand))]/10 text-[rgb(var(--brand))]">
            <UsersIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Tentang AlephDraad</h1>
            <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">
              Platform komunitas digital Indonesia
            </p>
          </div>
        </div>
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
          <ul className="space-y-3 text-sm text-[rgb(var(--muted))]">
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
        <section className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--brand))]/10 text-[rgb(var(--brand))]">
              <ZapIcon className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-[rgb(var(--fg))]">Layanan Kami</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
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
        <section className="rounded-xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface-2))] to-[rgb(var(--surface-1))] p-5">
          <h2 className="mb-4 flex items-center gap-3 text-base font-semibold text-[rgb(var(--fg))]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--brand))]/10 text-[rgb(var(--brand))]">
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
                <a href="mailto:ops@alephdraad.fun" className="text-sm font-medium text-[rgb(var(--brand))] hover:underline">
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
                <a href="https://www.alephdraad.fun" className="text-sm font-medium text-[rgb(var(--brand))] hover:underline">
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
