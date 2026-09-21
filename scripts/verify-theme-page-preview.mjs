import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { themePagePlugin, themeReviewCss } from "./lib/theme-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])));
const smoke = process.env.P10_SMOKE === "1";
const widths = process.env.P10_VIEWPORT ? [Number(process.env.P10_VIEWPORT)] : smoke ? [390] : [1440, 390];
const motions = process.env.P10_MOTION ? [process.env.P10_MOTION] : smoke ? ["reduce"] : ["reduce", "no-preference"];
const output = args.length ? path.resolve(`output/playwright/p10-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const previous = output ? await readFile(path.join(output, "manifest.json"), "utf8").then(JSON.parse).catch(() => null) : null;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [themePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const preference = {
  theme: "deep-ocean",
  source: "saved",
  organization_id: "p10-org",
  workspace_id: "p10-workspace",
  version: 7,
  updated_at: "2026-09-20T08:00:00.000Z",
};
const envelope = (data, requestId = "p10-request") => ({ data, request_id: requestId, trace_id: requestId });
const failure = (status, code, requestId) => ({ status, json: { error: { code, message: code }, request_id: requestId, trace_id: requestId } });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const images = [], results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P10 actual Vue review ${origin}`);
  for (const width of widths) for (const motion of motions) {
    let scenario = "ready";
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1050 }, locale: "zh-CN", reducedMotion: motion });
    const errors = [], unexpected = [], writes = [];
    let checks = 0;
    const check = (actual, expected, label) => { assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`); checks += 1; };
    const capture = async (page, name) => {
      await page.evaluate(() => new Promise((resolve) => { scrollTo(0, 0); requestAnimationFrame(resolve); }));
      const bytes = await page.screenshot({ animations: "disabled", fullPage: true });
      const file = `${width}-${name}.png`;
      await writeFile(path.join(output, file), bytes);
      images.push({ file, sha256: hash(bytes), pixelWidth: bytes.readUInt32BE(16), pixelHeight: bytes.readUInt32BE(20) });
    };
    try {
      context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = `${request.method()} ${url.pathname}`;
        if (key === "GET /api/v1/me/ui-preferences") {
          if (scenario === "expired") return route.fulfill(failure(401, "session_expired", "p10-expired"));
          if (scenario === "blocked") return route.fulfill(failure(409, "context_required", "p10-context"));
          return route.fulfill({ json: envelope(preference, "p10-read") });
        }
        if (key === "PUT /api/v1/me/ui-preferences") {
          writes.push(request.postDataJSON());
          if (scenario === "conflict") return route.fulfill(failure(409, "preference_version_conflict", "p10-conflict"));
          const body = writes.at(-1);
          return route.fulfill({ json: envelope({ ...preference, theme: body.theme, version: 8, updated_at: "2026-09-20T08:01:00.000Z" }, "p10-save") });
        }
        unexpected.push(key);
        return route.abort();
      });
      const page = await context.newPage();
      await page.goto(`${origin}/settings/theme`, { waitUntil: "domcontentloaded" });
      const root = page.locator(".theme-page--review");
      await root.getByRole("heading", { name: "预览与已保存偏好分开显示", exact: true }).waitFor();
      await root.getByText("当前主题与服务器已保存偏好一致。", { exact: true }).waitFor();
      check(await root.getByText("主题可保存；页面密度只在当前会话生效。", { exact: true }).count(), 1, "session-only density statement");
      check(await root.getByRole("button", { name: "保存主题", exact: true }).isDisabled(), true, "clean theme cannot save");
      if (output && motion === "reduce") await capture(page, "saved-preference");
      const themes = root.getByRole("radio", { name: /净页白/ });
      await themes.focus();
      check(await themes.evaluate((node) => getComputedStyle(node).outlineWidth), "3px", "theme focus visible");
      await themes.click();
      await root.getByText("当前主题尚未保存。", { exact: true }).waitFor();
      check(await root.getByRole("button", { name: "保存主题", exact: true }).isDisabled(), false, "theme difference enables save");
      if (output && motion === "reduce") await capture(page, "local-preview");
      const compact = root.getByRole("radio", { name: /紧凑/ });
      await compact.click();
      check(writes, [], "density selection performs no write");
      check(await page.locator("html").getAttribute("data-density"), "compact", "density applies inside current session");
      await root.getByRole("button", { name: "保存主题", exact: true }).click();
      await root.getByText("当前主题已由服务器确认。", { exact: true }).waitFor();
      check(writes, [{ theme: "cloud-white", expected_version: 7 }], "only exact versioned theme write");
      if (output && motion === "reduce") await capture(page, "server-saved");
      scenario = "conflict";
      const conflict = await context.newPage();
      await conflict.goto(`${origin}/settings/theme`, { waitUntil: "domcontentloaded" });
      const conflictRoot = conflict.locator(".theme-page--review");
      await conflictRoot.getByText("当前主题与服务器已保存偏好一致。", { exact: true }).waitFor();
      await conflictRoot.getByRole("radio", { name: /档案纸/ }).click();
      await conflictRoot.getByRole("button", { name: "保存主题", exact: true }).click();
      await conflictRoot.getByText("偏好已在其他窗口更新", { exact: true }).waitFor();
      check(await conflictRoot.getByText("刷新最新偏好后重新选择。", { exact: true }).count(), 1, "conflict requires refresh rather than overwrite");
      if (output && motion === "reduce") await capture(conflict, "conflict");
      scenario = "blocked";
      const blocked = await context.newPage();
      await blocked.goto(`${origin}/settings/theme`, { waitUntil: "domcontentloaded" });
      const blockedRoot = blocked.locator(".theme-page--review");
      await blockedRoot.getByText("尚未选择组织与工作区", { exact: true }).waitFor();
      check(await blockedRoot.getByRole("link", { name: "选择工作区", exact: true }).count(), 1, "blocked gives scope recovery");
      if (output && motion === "reduce") await capture(blocked, "blocked");
      scenario = "expired";
      const expired = await context.newPage();
      await expired.goto(`${origin}/settings/theme`, { waitUntil: "domcontentloaded" });
      const expiredRoot = expired.locator(".theme-page--review");
      await expiredRoot.getByText("登录已过期", { exact: true }).waitFor();
      check(await expiredRoot.getByRole("link", { name: "重新登录", exact: true }).count(), 1, "expired gives login recovery");
      if (output && motion === "reduce") await capture(expired, "expired");
      check(unexpected, [], "no unexpected API");
      check(errors, [], "no page errors");
      results.push({ width, motion, checks, writes: writes.length });
      console.log(JSON.stringify({ width, motion, checks, writes: writes.length }));
    } finally { await context.close(); }
  }
  const fixedSources = [
    "apps/web/src/components/ThemeStudio.vue",
    "apps/web/src/design/theme.ts",
    "scripts/lib/theme-page-preview.mjs",
    "scripts/verify-theme-page-preview.mjs",
    themeReviewCss,
  ];
  const allImages = [...(previous?.images ?? []), ...images].filter((image, index, values) => values.findLastIndex((other) => other.file === image.file) === index).sort((a, b) => a.file.localeCompare(b.file));
  const allResults = [...(previous?.results ?? []), ...results].filter((result, index, values) => values.findLastIndex((other) => other.width === result.width && other.motion === result.motion) === index).sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output) await writeFile(path.join(output, "manifest.json"), JSON.stringify({ page: "P10", revision: args[1], capturedAt: new Date().toISOString(), scope: "local actual Vue C review; preference responses are locally intercepted", sources: Object.fromEntries(await Promise.all(fixedSources.sort().map(async (file) => [file, hash(await readFile(file))]))), images: allImages, results: allResults }, null, 2) + "\n");
  console.log(JSON.stringify({ groups: allResults.length, checks: allResults.reduce((sum, item) => sum + item.checks, 0), writes: allResults.reduce((sum, item) => sum + item.writes, 0), images: allImages.length, sources: fixedSources.length, port }));
} finally {
  await browser?.close();
  await server.close();
}
