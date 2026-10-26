import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4322);
const LIVE_PORT = Number(process.env.E2E_LIVE_PORT ?? 4323);
export const E2E_TOKEN = "e2e-token-0123456789abcdef";

// Two servers, both on the production build:
// - "static": dist/ served as plain files, like any static host (no /data, no /api);
// - "live": the ingest service on a throw-away data volume, serving dist/ too, so tests can
//   publish a file and watch the dashboard change without a rebuild.
export default defineConfig({
  testDir: "e2e",
  // `.e2e.ts`, so `bun test` (which picks up `*.spec.ts`) never runs browser tests.
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // No transitions (global.css honours reduced motion): axe must never measure a colour
    // halfway through the theme switch.
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    {
      name: "static",
      testIgnore: "**/ingest.e2e.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: "live",
      testMatch: "**/ingest.e2e.ts",
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${LIVE_PORT}` },
    },
  ],
  webServer: [
    {
      command: `bun scripts/serve-dist.ts ${PORT}`,
      url: `http://127.0.0.1:${PORT}/version.json`,
      // A server serving another build (E2E_DIST) must never be reused by mistake.
      reuseExistingServer: !process.env.CI && !process.env.E2E_DIST,
      timeout: 30_000,
    },
    {
      command: "bun server/main.ts --ephemeral",
      url: `http://127.0.0.1:${LIVE_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      // Playwright SIGKILLs its servers by default: the SIGTERM handler is what removes the
      // ephemeral volume from the temp directory.
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        PORT: String(LIVE_PORT),
        HOST: "127.0.0.1",
        STATIC_DIR: "dist",
        SEED_DIR: "data",
        INGEST_TOKEN: E2E_TOKEN,
        INBOX_INTERVAL_MS: "60000",
      },
    },
  ],
});
