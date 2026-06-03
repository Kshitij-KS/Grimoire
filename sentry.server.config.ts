// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",

  // Performance Monitoring
  // Capture 10% of transactions in production, 100% in development
  tracesSampleRate:
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Disable Sentry if no DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
