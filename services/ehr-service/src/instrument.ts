import * as Sentry from "@sentry/nestjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Ensure Sentry is initialized before NestJS application starts
Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://9e9e7aa4f87377ded1484827040843c3@o4510804457095168.ingest.us.sentry.io/4510804458733568",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});
