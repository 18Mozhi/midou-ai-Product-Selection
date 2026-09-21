import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { onboardingPagePlugin, onboardingPageSources } from "./lib/onboarding-page-preview.mjs";
const args = process.argv.slice(2),
  smoke = process.env.P09_SMOKE === "1";
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p09-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    plugins: [onboardingPagePlugin()],
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
  }),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  images = [],
  results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  for (const width of widths)
    for (const motion of motions) {
      const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          locale: "zh-CN",
          reducedMotion: motion,
        }),
        errors = [],
        api = [];
      let checks = 0;
      const check = (a, e, l) => {
          assert.deepEqual(a, e, `${width}/${motion}: ${l}`);
          checks++;
        },
        capture = async (page, name) => {
          const b = await page.screenshot({ animations: "disabled" }),
            f = `${width}-${name}.png`;
          await writeFile(path.join(output, f), b);
          images.push({
            file: f,
            sha256: hash(b),
            pixelWidth: b.readUInt32BE(16),
            pixelHeight: b.readUInt32BE(20),
          });
        };
      try {
        context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
        await context.route("**/api/**", (r) => {
          api.push(r.request().url());
          return r.abort();
        });
        const page = await context.newPage();
        await page.goto(origin + "/onboarding", { waitUntil: "domcontentloaded" });
        const root = page.locator(".onboarding-page--review");
        await root.getByText("把市场变化，变成今天的行动", { exact: true }).waitFor();
        check(
          await root.getByRole("button", { name: "前往第 1 步" }).getAttribute("aria-current"),
          "step",
          "step one current",
        );
        if (output && motion === "reduce") await capture(page, "step-1");
        await page.getByRole("button", { name: "前往第 2 步" }).click();
        await root.getByText("让协作围绕同一份证据展开", { exact: true }).waitFor();
        check(
          await root.getByRole("button", { name: "上一步" }).count(),
          1,
          "step two has previous",
        );
        if (output && motion === "reduce") await capture(page, "step-2");
        await page.getByRole("button", { name: "前往第 3 步" }).click();
        await root.getByText("先看事实，再做可解释的决定", { exact: true }).waitFor();
        check(
          await root.getByRole("link", { name: "进入智能选品" }).getAttribute("href"),
          "/",
          "finish returns root",
        );
        check(api, [], "no api");
        check(errors, [], "no page errors");
        if (output && motion === "reduce") await capture(page, "step-3");
        results.push({ width, motion, checks });
        console.log(JSON.stringify({ width, motion, checks }));
      } finally {
        await context.close();
      }
    }
  const sources = new Set(onboardingPageSources);
  for (const m of server.moduleGraph.idToModuleMap.values()) {
    const f = m.file && path.relative(process.cwd(), m.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
      sources.add(f);
  }
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P09",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope: "local actual Vue C review; static guide has zero API requests",
          sources: Object.fromEntries(
            await Promise.all([...sources].sort().map(async (f) => [f, hash(await readFile(f))])),
          ),
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((s, x) => s + x.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
