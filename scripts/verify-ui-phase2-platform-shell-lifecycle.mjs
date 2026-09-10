import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildPlatformOverviewDesignData } from "./lib/ui-phase2-platform-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
const baseline = process.argv.includes("--baseline");
assert.ok(process.argv.slice(2).every((a) => ["--capture", "--baseline"].includes(a)));
const output = "output/playwright/p38-shell-lifecycle/" + (baseline ? "baseline" : "current");
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const baselineRevision = "3023a030";
const sharedFile = "apps/web/src/components/ResponsiveDataView.vue";
const baselineSource = execFileSync("git", ["show", `${baselineRevision}:${sharedFile}`], {
  encoding: "utf8",
}).replaceAll("\r\n", "\n");
const sample = await buildPlatformOverviewDesignData(process.cwd());
const env = (data) => ({ data, request_id: "p38-shell-fixture", trace_id: "p38-shell-fixture" });
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  plugins: baseline
    ? [
        {
          name: "exact-shared-baseline-replay",
          enforce: "pre",
          transform(source, id) {
            if (id.replaceAll("\\", "/").endsWith("/" + sharedFile)) return baselineSource;
          },
        },
      ]
    : [],
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {} },
});
let browser;
const checks = [],
  observations = [],
  screenshots = [];
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p38_shell_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [],
        unexpected = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(req.method() + " " + url.href);
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push(req.method() + " " + url.pathname + url.search);
        if (
          req.method() === "GET" &&
          url.pathname === "/api/v1/me/navigation" &&
          url.search === "?shell=platform_admin"
        )
          return route.fulfill({
            json: env({
              shell: "platform_admin",
              organization_id: null,
              workspace_id: null,
              roles: [],
              capabilities: [],
              platform_roles: ["platform_operations_admin"],
              platform_capabilities: ["platform:operate"],
              guard_reason: "navigation_platform_admin_allowed",
            }),
          });
        if (req.method() === "GET" && url.pathname === "/api/v1/platform/provider-sources")
          return route.fulfill({ json: env([]) });
        if (req.method() === "GET" && url.pathname === "/api/v1/platform/dashboard")
          return route.fulfill({
            json: env({
              ...sample.dashboard,
              task_trend: sample.trend,
              window: url.searchParams.get("window"),
            }),
          });
        unexpected.push(req.method() + " " + url.href);
        return route.abort();
      });
      const snap = async (state) => {
        if (!capture || ![390, 1440].includes(width)) return;
        const file = `${width}-${state}.png`,
          bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          state,
          width,
          sha256: hash(bytes),
          kind: "actual-app-fixture-not-C-approval",
          url: page.url(),
          browser: browser.version(),
          capturedAt: new Date().toISOString(),
        });
      };
      await page.goto(origin + "/platform-admin/providers/sources");
      await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
      await expect(page.locator(".provider-runtime-surface")).toBeVisible();
      await page.locator(".role-brand").click();
      await expect(page.locator(".platform-facts")).toBeVisible();
      await expect(page).toHaveURL(origin + "/platform-admin");
      await page.evaluate(() => document.fonts.ready);
      const marker = await page.locator(".platform-dashboard").evaluate((n) => {
        n.dataset.lifecycleProbe = "original";
        return n.dataset.lifecycleProbe;
      });
      assert.equal(marker, "original");
      await snap("ready");
      const provider = page
        .locator(".platform-dashboard .responsive-data-view__mobile article button")
        .first();
      if (width <= 760) {
        await provider.click();
        await expect(page.locator(".responsive-data-view__drawer")).toBeVisible();
        await expect(page.locator("#app")).toHaveAttribute("inert", "");
        await snap("preview-open");
      } else {
        await page.getByLabel("表格密度").selectOption("compact");
        await page.getByRole("button", { name: "首列已冻结", exact: true }).click();
      }
      await page.goBack();
      await expect(page).toHaveURL(origin + "/platform-admin/providers/sources");
      await expect(page.locator(".provider-runtime-surface")).toBeVisible();
      const left = await page.evaluate(() => ({
        url: location.pathname,
        dialogs: [...document.querySelectorAll(".responsive-data-view__drawer")].filter((n) =>
          n.checkVisibility(),
        ).length,
        appInert: document.querySelector("#app").inert,
      }));
      observations.push({ width, state: "left-overview", ...left });
      assert.equal(left.dialogs, baseline && width <= 760 ? 1 : 0);
      assert.equal(left.appInert, baseline && width <= 760);
      await snap("left-overview");
      await page.goForward();
      await expect(page).toHaveURL(origin + "/platform-admin");
      await expect(page.locator(".platform-dashboard")).toHaveAttribute(
        "data-lifecycle-probe",
        "original",
      );
      await expect(page.getByRole("button", { name: "刷新", exact: true })).toBeEnabled();
      const returned = await page.evaluate(() => ({
        dialogs: [...document.querySelectorAll(".responsive-data-view__drawer")].filter((n) =>
          n.checkVisibility(),
        ).length,
        appInert: document.querySelector("#app").inert,
      }));
      observations.push({ width, state: "returned-overview", ...returned });
      assert.equal(returned.dialogs, baseline && width <= 760 ? 1 : 0);
      assert.equal(returned.appInert, baseline && width <= 760);
      if (width <= 760 && returned.dialogs)
        await page.locator(".responsive-data-view__drawer > header button").click();
      await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
      if (width <= 760) {
        await provider.click();
        await expect(page.locator(".responsive-data-view__drawer > header button")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(provider).toBeFocused();
        await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
      } else {
        await expect(page.getByLabel("表格密度")).toHaveValue("compact");
        await expect(page.getByRole("button", { name: "首列未冻结", exact: true })).toHaveAttribute(
          "aria-pressed",
          "false",
        );
      }
      await page.locator(".platform-dashboard-toolbar select").selectOption("7d");
      await expect(page).toHaveURL(origin + "/platform-admin?window=7d");
      await expect(page.getByRole("button", { name: "刷新", exact: true })).toBeEnabled();
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      checks.push({
        width,
        name: "real App/route catalog/NavigationShell/cache preserved DOM; source→overview→history back/forward; reopen/Esc/focus or desktop density/freeze preserved; 7d query and request",
        requests,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const files = [
  "scripts/verify-ui-phase2-platform-shell-lifecycle.mjs",
  "scripts/lib/ui-phase2-platform-overview-design-data.mjs",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  "apps/web/src/main.ts",
  "apps/web/src/router.ts",
  "apps/web/src/App.vue",
  "apps/web/src/route-catalog.ts",
  "apps/web/src/route-catalog.generated.json",
  "apps/web/src/components/NavigationShell.vue",
  "apps/web/src/navigation-shell-route-state.ts",
  "apps/web/src/navigation-shell-permissions.ts",
  "apps/web/src/components/PlatformDashboard.vue",
  "apps/web/src/components/ResponsiveDataView.vue",
  "apps/web/src/components/TableViewControls.vue",
  "apps/web/src/components/TechnicalDetails.vue",
  "apps/web/src/components/ProviderRuntimeSurface.vue",
  "apps/web/src/components/ProviderSourceCenter.vue",
  "apps/web/src/api-client.ts",
  "apps/web/src/config.ts",
  "apps/web/vite.config.ts",
  "packages/config/src/browser.ts",
  ...[...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g)].map(
    (m) => "apps/web/src/" + m[1],
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(files.map(async (f) => [f, hash(await read(f))])),
);
const result = {
  schemaVersion: 1,
  scope:
    "Actual application and router, synthetic navigation/data GETs. Existing styling, not C design implementation, real RBAC or production acceptance. Baseline replays only the exact old shared component; all other files use recorded current sources.",
  approval: "not-requested-current-behavior-evidence",
  mode: baseline ? "baseline-reproduction" : "current-regression",
  baselineReplay: baseline
    ? { revision: baselineRevision, file: sharedFile, sha256: hash(baselineSource) }
    : null,
  sourceHashes,
  checks,
  observations,
  screenshots,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(result, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><h1>P38 完整壳层缓存行为证据</h1><p>实际应用 + 测试GET，不是C新稿或真实权限验收</p>${screenshots.map((s) => `<h2>${s.file}</h2><img style="max-width:100%" src="${s.file}" alt="${s.state}">`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({ checks, observations, screenshots: screenshots.length, processesClosed: true }),
);
