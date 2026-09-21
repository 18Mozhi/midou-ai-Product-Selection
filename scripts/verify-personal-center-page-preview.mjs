import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { personalCenterPagePlugin, personalCenterReviewCss } from "./lib/personal-center-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])));
const smoke = process.env.P11_SMOKE === "1";
const widths = process.env.P11_VIEWPORT ? [Number(process.env.P11_VIEWPORT)] : smoke ? [390] : [1440, 390];
const motions = process.env.P11_MOTION ? [process.env.P11_MOTION] : smoke ? ["reduce"] : ["reduce", "no-preference"];
const output = args.length ? path.resolve(`output/playwright/p11-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const previous = output ? await readFile(path.join(output, "manifest.json"), "utf8").then(JSON.parse).catch(() => null) : null;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({ configFile: path.resolve("apps/web/vite.config.ts"), logLevel: "error", define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") }, plugins: [personalCenterPagePlugin()], server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false } });
const profile = { id: "p11-user", email: "member@example.test", email_verified_at: "2026-09-01T00:00:00.000Z", username: "review.member", display_name: "陈晓", avatar_url: "https://assets.example.test/avatar.png", phone: "13800000000", phone_verified_at: null, locale: "zh-CN", timezone: "Asia/Shanghai", version: 4 };
const authorization = { roles: ["selection_manager"], capabilities: ["task:read", "trend:read", "organization_token:manage"], data_scopes: [{ scope: "workspace", scope_key: "p11-workspace" }] };
const sessions = [{ id: "p11-session", device_label: "Windows · Edge", status: "active", last_seen_at: "2026-09-20T08:00:00.000Z" }];
const preferences = { version: 6, in_app_enabled: true, email_enabled: false, task_enabled: true, approval_enabled: true, competitor_enabled: true };
const assets = { followed_trends: [{ id: "p11-trend", title: "户外收纳", market: "US", created_at: "2026-09-19T08:00:00.000Z" }], decisions: [{ id: "p11-decision", opportunity_id: "p11-opportunity", opportunity_name: "可折叠储物箱", action: "observe", created_at: "2026-09-18T08:00:00.000Z" }], tasks: [{ id: "p11-task", title: "核对成本假设", status: "todo", priority: "high", due_at: "2026-09-22T08:00:00.000Z" }] };
const envelope = (data, requestId = "p11-request") => ({ data, request_id: requestId, trace_id: requestId });
const failure = (status, code, requestId) => ({ status, json: { error: { code, message: code }, request_id: requestId, trace_id: requestId } });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const images = [], results = [];
let browser;
try {
  await server.listen(); browser = await chromium.launch(); const origin = `http://127.0.0.1:${port}`;
  console.log(`P11 actual Vue review ${origin}`);
  for (const width of widths) for (const motion of motions) {
    let scenario = "ready";
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1050 }, locale: "zh-CN", reducedMotion: motion });
    const errors = [], unexpected = [], writes = []; let checks = 0;
    const check = (actual, expected, label) => { assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`); checks += 1; };
    const capture = async (page, name) => { await page.evaluate(() => new Promise((resolve) => { scrollTo(0, 0); requestAnimationFrame(resolve); })); const bytes = await page.screenshot({ animations: "disabled", fullPage: true }); const file = `${width}-${name}.png`; await writeFile(path.join(output, file), bytes); images.push({ file, sha256: hash(bytes), pixelWidth: bytes.readUInt32BE(16), pixelHeight: bytes.readUInt32BE(20) }); };
    try {
      context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
      await context.route("**/*", async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = `${request.method()} ${url.pathname}`;
        if (key === "GET /api/v1/auth/session-status") return route.fulfill({ json: envelope({ authenticated: true }, "p11-session-status") });
        if (key === "GET /api/v1/me/profile") return scenario === "profile-failure" ? route.fulfill(failure(503, "profile_unavailable", "p11-profile-failure")) : route.fulfill({ json: envelope(profile, "p11-profile-read") });
        if (key === "GET /api/v1/me/authorization") return route.fulfill({ json: envelope(authorization, "p11-authorization") });
        if (key === "GET /api/v1/me/sessions") return route.fulfill({ json: envelope(sessions, "p11-sessions") });
        if (key === "GET /api/v1/me/notification-preferences") return route.fulfill({ json: envelope(preferences, "p11-preferences") });
        if (key === "GET /api/v1/me/assets") return route.fulfill({ json: envelope(assets, "p11-assets") });
        if (key === "PATCH /api/v1/me/profile") { const body = request.postDataJSON(); writes.push({ key, body }); return route.fulfill({ json: envelope({ ...profile, ...body, version: 5 }, "p11-profile-save") }); }
        if (key === "PUT /api/v1/me/notification-preferences") { const body = request.postDataJSON(); writes.push({ key, body }); return route.fulfill({ json: envelope({ ...body, version: 7 }, "p11-preferences-save") }); }
        if (key === "DELETE /api/v1/me/sessions/p11-session") { writes.push({ key }); return route.fulfill({ status: 204 }); }
        unexpected.push(key); return route.abort();
      });
      const page = await context.newPage(); await page.goto(`${origin}/me`, { waitUntil: "domcontentloaded" });
      const root = page.locator(".p11-account-review"); await root.getByRole("heading", { name: "可保存的账号资料", exact: true }).waitFor({ timeout: 8000 });
      check(await root.getByText("邮箱只读，不会写入资料更新请求。", { exact: true }).count(), 1, "profile write boundary visible");
      const save = root.getByRole("button", { name: "保存资料", exact: true }); await save.focus(); check(await save.evaluate((node) => getComputedStyle(node).outlineWidth), "3px", "profile save focus visible");
      if (output && motion === "reduce") await capture(page, "profile");
      await root.getByLabel("显示名称").fill("陈晓（本地审核）"); await save.click(); await root.getByText(/个人资料已保存/).waitFor();
      check(writes[0], { key: "PATCH /api/v1/me/profile", body: { username: "review.member", display_name: "陈晓（本地审核）", avatar_url: "https://assets.example.test/avatar.png", phone: "13800000000", locale: "zh-CN", timezone: "Asia/Shanghai", reason: "更新个人资料", expected_version: 4 } }, "profile PATCH is exact and excludes email");
      if (output && motion === "reduce") await capture(page, "profile-saved");
      for (const [section, heading] of [["permissions", "能力目录"], ["security", "会话状态"], ["assets", "当前待办"], ["notifications", "五项可保存开关"]]) {
        await root.getByRole("link", { name: new RegExp(section === "permissions" ? "我的权限" : section === "security" ? "安全与设备" : section === "notifications" ? "通知偏好" : "我的资产") }).click();
        await root.getByRole("heading", { name: heading, exact: true }).waitFor({ timeout: 8000 });
        if (output && motion === "reduce") await capture(page, section);
        if (section === "security") {
          await root.getByRole("button", { name: "撤销会话", exact: true }).click();
          await root.getByText(/设备会话已撤销/).waitFor({ timeout: 8000 });
          check(writes[1], { key: "DELETE /api/v1/me/sessions/p11-session" }, "session revoke has exact target");
          check(await root.getByText("暂无活动会话。", { exact: true }).count(), 1, "successful revoke removes only local session row");
        }
      }
      const competitor = root.getByLabel("竞品通知"); await competitor.uncheck(); await root.getByRole("button", { name: "保存偏好", exact: true }).click(); await root.getByText(/偏好已保存/).waitFor({ timeout: 8000 });
      check(writes[2], { key: "PUT /api/v1/me/notification-preferences", body: { expected_version: 6, in_app_enabled: true, email_enabled: false, task_enabled: true, approval_enabled: true, competitor_enabled: false } }, "preferences PUT has only five server fields and version");
      scenario = "profile-failure";
      const failed = await context.newPage(); await failed.goto(`${origin}/me`, { waitUntil: "domcontentloaded" }); const failedRoot = failed.locator(".p11-account-review"); await failedRoot.getByText("当前无法读取个人资料", { exact: true }).waitFor();
      check(await failedRoot.getByRole("button", { name: "重新加载", exact: true }).count(), 1, "profile failure has recovery"); if (output && motion === "reduce") await capture(failed, "profile-failure");
      check(unexpected, [], "no unexpected API"); check(errors, [], "no page errors"); results.push({ width, motion, checks, writes: writes.length }); console.log(JSON.stringify({ width, motion, checks, writes: writes.length }));
    } finally { await context.close(); }
  }
  const sources = ["apps/web/src/components/AccountShell.vue", "apps/web/src/components/PersonalCenter.vue", "scripts/lib/personal-center-page-preview.mjs", "scripts/verify-personal-center-page-preview.mjs", personalCenterReviewCss];
  const allImages = [...(previous?.images ?? []), ...images].filter((image, index, values) => values.findLastIndex((other) => other.file === image.file) === index).sort((a, b) => a.file.localeCompare(b.file));
  const allResults = [...(previous?.results ?? []), ...results].filter((result, index, values) => values.findLastIndex((other) => other.width === result.width && other.motion === result.motion) === index).sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output) await writeFile(path.join(output, "manifest.json"), JSON.stringify({ page: "P11", revision: args[1], capturedAt: new Date().toISOString(), scope: "local actual Vue C review; account responses are locally intercepted", sources: Object.fromEntries(await Promise.all(sources.sort().map(async (file) => [file, hash(await readFile(file))]))), images: allImages, results: allResults }, null, 2) + "\n");
  console.log(JSON.stringify({ groups: allResults.length, checks: allResults.reduce((sum, item) => sum + item.checks, 0), writes: allResults.reduce((sum, item) => sum + item.writes, 0), images: allImages.length, sources: sources.length, port }));
} finally { await browser?.close(); await server.close(); }
