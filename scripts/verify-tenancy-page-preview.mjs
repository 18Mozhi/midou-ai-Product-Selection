import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { tenancyPagePlugin, tenancyPageSources } from "./lib/tenancy-page-preview.mjs";

const args = process.argv.slice(2),
  smoke = process.env.P08_SMOKE === "1";
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const widths = process.env.P08_VIEWPORT
  ? [Number(process.env.P08_VIEWPORT)]
  : smoke
    ? [390]
    : [1440, 390];
const motions = process.env.P08_MOTION
  ? [process.env.P08_MOTION]
  : smoke
    ? ["reduce"]
    : ["reduce", "no-preference"];
const output = args.length
  ? path.resolve(`output/playwright/p08-page-composition-${args[1]}`)
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
  plugins: [tenancyPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const organization = {
  id: "p08-org",
  name: "华南增长中心",
  slug: "south-growth",
  status: "active",
  timezone: "Asia/Shanghai",
  default_workspace_id: "p08-workspace",
  membership_status: "active",
};
const other = { ...organization, id: "p08-other", name: "北区分析中心", slug: "north-analysis" };
const workspace = {
  id: "p08-workspace",
  organization_id: organization.id,
  name: "新品决策工作区",
  slug: "new-products",
  status: "active",
  version: 1,
};
const archived = {
  ...workspace,
  id: "p08-archived",
  name: "历史归档区",
  slug: "archive",
  status: "archived",
};
const envelope = (data, id = "p08-request") => ({ data, request_id: id, trace_id: id });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P08 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scenario = "ready";
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1050 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const errors = [],
        unexpected = [],
        writes = [];
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
          if (key === "GET /api/v1/org/memberships") {
            if (scenario === "empty") return route.fulfill({ json: envelope([]) });
            if (scenario === "forbidden")
              return route.fulfill({
                status: 403,
                json: {
                  error: { code: "organization_forbidden", message: "当前账号没有可用范围。" },
                  request_id: "p08-forbidden",
                  trace_id: "p08-forbidden",
                },
              });
            return route.fulfill({ json: envelope([organization, other]) });
          }
          if (key === "GET /api/v1/org/p08-org/workspaces")
            return route.fulfill({ json: envelope([workspace, archived]) });
          if (key === "GET /api/v1/org/p08-org/teams")
            return route.fulfill({
              json: envelope([
                {
                  id: "p08-team",
                  organization_id: organization.id,
                  name: "趋势研究组",
                  status: "active",
                  version: 1,
                },
              ]),
            });
          if (key === "POST /api/v1/auth/context") {
            writes.push(request.postDataJSON());
            return route.fulfill({
              json: envelope({
                organization: { id: organization.id, name: organization.name },
                workspace,
              }),
            });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/select-context`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".tenancy-page--review");
        await root.getByRole("heading", { name: "选择组织", exact: true }).waitFor();
        check(
          await root.getByRole("button", { name: /华南增长中心/ }).count(),
          1,
          "organization directory",
        );
        check(
          await root.getByText("当前账号", { exact: true }).count(),
          1,
          "account is non-action text",
        );
        if (output && motion === "reduce") await capture(page, "directory");
        await page.getByLabel("搜索组织").fill("no-match");
        await root.getByText("没有匹配的组织", { exact: true }).waitFor();
        check(
          await root.getByRole("button", { name: "清除搜索", exact: true }).count(),
          1,
          "search empty differs from no organization",
        );
        if (output && motion === "reduce") await capture(page, "search-empty");
        await page.getByRole("button", { name: "清除搜索", exact: true }).click();
        const choose = page.getByRole("button", { name: /华南增长中心/ });
        await choose.focus();
        check(
          await choose.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "focus visible",
        );
        await choose.click();
        await root.getByRole("heading", { name: "选择工作区", exact: true }).waitFor();
        check(
          await root.getByRole("button", { name: /历史归档区/ }).isDisabled(),
          true,
          "archived workspace disabled",
        );
        if (output && motion === "reduce") await capture(page, "workspaces");
        await page.getByRole("button", { name: /新品决策工作区/ }).click();
        await root.getByText("工作范围已就绪", { exact: true }).waitFor();
        check(
          writes,
          [{ organization_id: "p08-org", workspace_id: "p08-workspace" }],
          "only workspace writes context",
        );
        if (output && motion === "reduce") await capture(page, "selected");
        scenario = "empty";
        const empty = await context.newPage();
        await empty.goto(`${origin}/select-context`, { waitUntil: "domcontentloaded" });
        const emptyRoot = empty.locator(".tenancy-page--review");
        await emptyRoot.getByText("暂无可用组织", { exact: true }).waitFor();
        check(
          await emptyRoot.getByRole("button", { name: "创建并进入选品空间", exact: true }).count(),
          1,
          "no organization has personal workspace action",
        );
        if (output && motion === "reduce") await capture(empty, "empty");
        scenario = "forbidden";
        const forbidden = await context.newPage();
        await forbidden.goto(`${origin}/select-context`, { waitUntil: "domcontentloaded" });
        const forbiddenRoot = forbidden.locator(".tenancy-page--review");
        await forbiddenRoot.getByText("当前没有可用的组织权限", { exact: true }).waitFor();
        check(
          await forbiddenRoot.getByText(/关联编号：p08-forbidden/).count(),
          1,
          "forbidden has trace",
        );
        if (output && motion === "reduce") await capture(forbidden, "forbidden");
        check(unexpected, [], "no unexpected API");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, writes: writes.length });
        console.log(JSON.stringify({ width, motion, checks, writes: writes.length }));
      } finally {
        await context.close();
      }
    }
  const sources = new Set(tenancyPageSources);
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
          page: "P08",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; organization, workspace and context responses are locally intercepted",
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
      writes: allResults.reduce((sum, item) => sum + item.writes, 0),
      images: allImages.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
