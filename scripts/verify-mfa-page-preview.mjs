import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { mfaPagePlugin, mfaPageSources } from "./lib/mfa-page-preview.mjs";

const args = process.argv.slice(2),
  smoke = process.env.P07_SMOKE === "1";
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const widths = process.env.P07_VIEWPORT
  ? [Number(process.env.P07_VIEWPORT)]
  : smoke
    ? [390]
    : [1440, 390];
const motions = process.env.P07_MOTION
  ? [process.env.P07_MOTION]
  : smoke
    ? ["reduce"]
    : ["reduce", "no-preference"];
const output = args.length
  ? path.resolve(`output/playwright/p07-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output, { recursive: true });
const previous = output
  ? await readFile(path.join(output, "manifest.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null)
  : null;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [mfaPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P07 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scenario = "loading",
        release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1100 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const errors = [],
        unexpected = [],
        requests = [];
      let checks = 0;
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks += 1;
      };
      const capture = async (page, name) => {
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              scrollTo(0, 0);
              requestAnimationFrame(resolve);
            }),
        );
        const bytes = await page.screenshot({ animations: "disabled" });
        const file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), bytes);
        images.push({
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };
      try {
        context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
        await context.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const key = `${request.method()} ${url.pathname}`;
          requests.push({
            key,
            body: request.method() === "GET" ? undefined : request.postDataJSON(),
          });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({
              json: {
                data: { authenticated: scenario !== "anonymous" },
                request_id: "p07-session",
                trace_id: "p07-session",
              },
            });
          if (key === "GET /api/v1/me/mfa") {
            if (scenario === "loading") {
              await held;
              return route.fulfill({
                json: {
                  data: { totp_enabled: false },
                  request_id: "p07-read",
                  trace_id: "p07-read",
                },
              });
            }
            if (scenario === "read-failure")
              return route.fulfill({
                status: 503,
                json: {
                  error: {
                    code: "mfa_unavailable",
                    message: "无法读取认证器状态。",
                    action_hint: "请稍后重新读取安全状态。",
                  },
                  request_id: "p07-read-failure",
                  trace_id: "p07-read-failure",
                },
              });
            return route.fulfill({
              json: {
                data: { totp_enabled: scenario === "enabled" },
                request_id: "p07-read",
                trace_id: "p07-read",
              },
            });
          }
          if (key === "POST /api/v1/me/mfa/totp/enrollment")
            return route.fulfill({
              json: {
                data: { secret: "P07-LOCAL-ONLY-SECRET" },
                request_id: "p07-enroll",
                trace_id: "p07-enroll",
              },
            });
          if (key === "POST /api/v1/me/mfa/totp/confirm")
            return route.fulfill({
              json: {
                data: { recovery_codes: ["P07-local-recovery-A", "P07-local-recovery-B"] },
                request_id: "p07-confirm",
                trace_id: "p07-confirm",
              },
            });
          if (key === "DELETE /api/v1/me/mfa/totp") return route.fulfill({ status: 204 });
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/security/mfa`, { waitUntil: "commit" });
        const root = page.locator(".identity-page--review");
        await root.getByText("正在读取 MFA 状态", { exact: true }).waitFor();
        check(await root.getAttribute("data-state"), "loading", "unknown state is loading");
        check(
          await root
            .getByText("尚未读取完成前，不对当前保护状态作出判断。", { exact: true })
            .count(),
          1,
          "no false disabled state",
        );
        if (output && motion === "reduce") await capture(page, "loading");
        release();
        const begin = page.getByRole("button", { name: "开始绑定认证器", exact: true });
        await begin.waitFor();
        check(await page.getByLabel("当前密码").count(), 1, "disabled state has password boundary");
        await begin.focus();
        check(
          await begin.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "focus visible",
        );
        await page.getByLabel("当前密码").fill("correct-password-123");
        await begin.click();
        await root.getByText("P07-LOCAL-ONLY-SECRET", { exact: true }).waitFor();
        check(
          await root.getByText("本地审核用替代材料", { exact: false }).count(),
          1,
          "synthetic secret labelled",
        );
        if (output && motion === "reduce") await capture(page, "binding");
        await page.getByLabel("认证器验证码").fill("123456");
        await page.getByRole("button", { name: "确认并启用", exact: true }).click();
        await root.getByText("P07-local-recovery-A", { exact: true }).waitFor();
        check(await root.getAttribute("data-mfa-enabled"), "true", "confirmation marks enabled");
        if (output && motion === "reduce") await capture(page, "recovery");
        scenario = "enabled";
        const enabled = await context.newPage();
        await enabled.goto(`${origin}/security/mfa`, { waitUntil: "domcontentloaded" });
        const enabledRoot = enabled.locator(".identity-page--review");
        await enabledRoot.getByText("认证器 TOTP 已启用", { exact: true }).waitFor();
        const disable = enabled.getByRole("button", { name: "停用并撤销全部会话", exact: true });
        check(await disable.count(), 1, "enabled has dangerous action");
        if (output && motion === "reduce") await capture(enabled, "enabled");
        await enabled.getByLabel("当前密码").fill("correct-password-123");
        await enabled.getByLabel("当前验证码或恢复码").fill("123456");
        await disable.click();
        await enabledRoot
          .getByText("MFA 已停用，所有会话已撤销，请重新登录。", { exact: true })
          .waitFor();
        check(
          await enabledRoot.getAttribute("data-mfa-enabled"),
          "false",
          "disable updates only after 204",
        );
        if (output && motion === "reduce") await capture(enabled, "disabled");
        scenario = "read-failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/security/mfa`, { waitUntil: "domcontentloaded" });
        const failedRoot = failed.locator(".identity-page--review");
        await failedRoot.getByText("无法读取认证器状态。", { exact: true }).waitFor();
        check(
          await failedRoot.getByText(/关联编号：p07-read-failure/).count(),
          1,
          "read failure trace is shown",
        );
        if (output && motion === "reduce") await capture(failed, "read-failure");
        scenario = "anonymous";
        const anonymous = await context.newPage();
        await anonymous.goto(`${origin}/security/mfa`, { waitUntil: "domcontentloaded" });
        await anonymous.waitForURL(/\/login\?reason=authentication_required/);
        check(
          requests.some((request) => request.key === "GET /api/v1/auth/session-status"),
          true,
          "guard reads session before MFA",
        );
        check(unexpected, [], "no unexpected API");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, requests: requests.length });
        console.log(JSON.stringify({ width, motion, checks, requests: requests.length }));
      } finally {
        await context.close();
      }
    }
  const sources = new Set(mfaPageSources);
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  const allImages = [...(previous?.images ?? []), ...images]
    .filter(
      (image, index, values) =>
        values.findLastIndex((other) => other.file === image.file) === index,
    )
    .sort((a, b) => a.file.localeCompare(b.file));
  const allResults = [...(previous?.results ?? []), ...results]
    .filter(
      (result, index, values) =>
        values.findLastIndex(
          (other) => other.width === result.width && other.motion === result.motion,
        ) === index,
    )
    .sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P07",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; authenticated routing and MFA materials are locally intercepted; displayed secret and recovery values are synthetic only",
          sources: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
            ),
          ),
          images: allImages,
          results: allResults,
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      groups: allResults.length,
      checks: allResults.reduce((sum, item) => sum + item.checks, 0),
      requests: allResults.reduce((sum, item) => sum + item.requests, 0),
      images: allImages.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
