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
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[13px]">{children}</span>
    </li>
  );
}

// Section card with icon header - compact style
function Section({ title, icon: Icon, children, highlight = false }) {
  return (
    <section className={`mb-4 overflow-hidden rounded-lg border ${highlight ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'}`}>
      <div className={`border-b px-4 py-3 ${highlight ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/50/30'}`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
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
    <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-muted-foreground/50">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-foreground">Tentang AlephDraad</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Platform komunitas digital Indonesia
        </p>
      </div>

      <article>
        {/* Company Info */}
        <Section title="Perusahaan" icon={ZapIcon}>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">PT ALEPHDRAAD UTILITY STACK</strong> adalah perusahaan teknologi 
            yang berfokus pada pengembangan platform komunitas digital. Kami berkomitmen untuk menyediakan 
            ruang yang aman, terpercaya, dan bermanfaat bagi seluruh pengguna di Indonesia.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Didirikan dengan visi untuk mendemokratisasi akses terhadap pengetahuan dan peluang ekonomi digital, 
            AlephDraad hadir sebagai jembatan antara komunitas, edukasi, dan transaksi yang transparan.
          </p>
        </Section>

        {/* Visi */}
        <Section title="Visi" icon={TargetIcon} highlight={true}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Menjadi platform komunitas digital terdepan di Indonesia yang menghubungkan pengetahuan, 
            inovasi, dan peluang ekonomi secara inklusif dan berkelanjutan.
          </p>
        </Section>

        {/* Misi */}
        <Section title="Misi" icon={HeartIcon}>
          <ul className="space-y-2 text-muted-foreground">
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
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ZapIcon className="h-4 w-4 text-muted-foreground" />
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
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            PT AlephDraad Utility Stack beroperasi sesuai dengan peraturan perundang-undangan Republik Indonesia, termasuk namun tidak terbatas pada:
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground">
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
        <section className="rounded-lg border border-border bg-gradient-to-br from-muted/50 to-card p-5">
          <h2 className="mb-4 flex items-center gap-3 text-base font-semibold text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-foreground">
              <MailIcon className="h-4 w-4" />
            </span>
            Kontak Perusahaan
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                <MailIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href="mailto:ops@alephdraad.fun" className="text-sm font-medium text-foreground hover:underline">
                  ops@alephdraad.fun
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                <GlobeIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Website</p>
                <a href="https://www.alephdraad.fun" className="text-sm font-medium text-foreground hover:underline">
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
