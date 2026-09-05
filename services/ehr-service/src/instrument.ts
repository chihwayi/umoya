import * as Sentry from "@sentry/nestjs";

// Only initialize Sentry (and its native CPU-profiler binding) when a DSN is
// actually configured — local dev has no DSN, and nodeProfilingIntegration()
// requires a prebuilt native binding matching the exact Node ABI version,
// which crashes the whole process on startup if unavailable for the
// currently-installed Node version. Sentry is a reporting concern, not a
// startup dependency; it should never block the app from running locally.
if (process.env.SENTRY_DSN) {
  const { nodeProfilingIntegration } = require("@sentry/profiling-node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0, // Capture 100% of the transactions

    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });
}
