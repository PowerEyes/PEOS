import { defineConfig } from "@playwright/test";

const ERP = process.env.ERP_URL ?? "http://localhost:3001";
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const PLATFORM = process.env.PLATFORM_URL ?? "http://localhost:3002";
const WEBSITE = process.env.WEBSITE_URL ?? "http://localhost:3003";

/**
 * PowerOS end-to-end suite.
 *
 *  - `setup`    logs into the ERP once and stores the session in tests/.auth/erp.json
 *  - `erp`      runs the flows that mutate data (suppliers, POs, GRN, finance)
 *  - `web`      runs the public storefront assertions
 *  - `platform` runs unauthenticated control-plane smoke checks
 *  - `website`  runs unauthenticated marketing-site smoke checks
 *
 * workers: 1 because several specs read stock / invoice totals straight out of
 * Postgres and assert on deltas — running them in parallel would race.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { baseURL: ERP } },
    {
      name: "erp",
      testMatch: /.*\.erp\.spec\.ts/,
      dependencies: ["setup"],
      use: { baseURL: ERP, storageState: "tests/.auth/erp.json" },
    },
    {
      name: "web",
      testMatch: /.*\.web\.spec\.ts/,
      dependencies: ["setup"],
      use: { baseURL: WEB },
    },
    {
      name: "platform",
      testMatch: /.*\.platform\.spec\.ts/,
      use: { baseURL: PLATFORM },
    },
    {
      name: "website",
      testMatch: /.*\.website\.spec\.ts/,
      use: { baseURL: WEBSITE },
    },
  ],
});
