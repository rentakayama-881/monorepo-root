import dynamic from "next/dynamic";

const TelegramAuthSection = dynamic(() => import("@/components/account/TelegramAuthSection"), {
  loading: () => <div className="h-20 animate-pulse bg-border/30 rounded-lg" />,
});

export default function IntegrationsSection({ telegramAuth, onTelegramAuthChange }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-1">Integrasi</h2>
      <p className="text-sm text-muted-foreground mb-5">Hubungkan akun pihak ketiga</p>
      <div className="rounded-xl border border-border/60 bg-card/80 px-6">
        <TelegramAuthSection
          telegramAuth={telegramAuth}
          onTelegramAuthChange={onTelegramAuthChange}
        />
      </div>
    </section>
  );
}
