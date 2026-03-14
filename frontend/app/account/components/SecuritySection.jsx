import dynamic from "next/dynamic";

const PasskeySettings = dynamic(() => import("@/components/PasskeySettings"), {
  loading: () => <div className="h-20 animate-pulse bg-border/30 rounded-lg" />,
});
const TOTPSettings = dynamic(() => import("@/components/TOTPSettings"), {
  loading: () => <div className="h-20 animate-pulse bg-border/30 rounded-lg" />,
});

export default function SecuritySection({ passkeySectionRef, highlightPasskeySection }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-1">Keamanan</h2>
      <p className="text-sm text-muted-foreground mb-5">Autentikasi dua faktor dan passkey</p>
      <div className="rounded-xl border border-border/60 bg-card/80 px-6">
        <TOTPSettings />
        <div
          id="passkey-settings"
          ref={passkeySectionRef}
          className={`transition-shadow duration-300 ${
            highlightPasskeySection
              ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-lg"
              : ""
          }`}
        >
          <PasskeySettings />
        </div>
      </div>
    </section>
  );
}
