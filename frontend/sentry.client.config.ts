import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sample 20% of transactions for performance monitoring
  tracesSampleRate: 0.2,

  debug: false,

  // Replay 50% of sessions with errors, 10% of all sessions
  replaysOnErrorSampleRate: 0.5,
  replaysSessionSampleRate: 0.1,

  integrations: [],
});

// Lazy-load Replay integration — only loads the ~50KB+ bundle when actually needed
if (typeof window !== "undefined") {
  Sentry.lazyLoadIntegration("replayIntegration").then((replay) => {
    Sentry.addIntegration(
      replay({
        maskAllText: true,
        blockAllMedia: true,
      })
    );
  });
}
