import { defineConfig } from "@playwright/test";

// Invoked against the temporary, proxy-free host owned by the C integration verifier.
const port = Number(process.env.PLAYWRIGHT_WEB_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Missing verifier port");
export default defineConfig({
  testDir: ".",
  testMatch: "m03-03-provider-adapter.spec.ts",
  outputDir: "../../output/playwright/p47-c-e2e-temp",
  reporter: "line",
  workers: 1,
  retries: 0,
  use: { baseURL: `http://127.0.0.1:${port}`, screenshot: "off", trace: "off" },
  projects: [
    { name: "desktop-chromium", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
  ],
});
