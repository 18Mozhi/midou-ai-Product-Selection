import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { releasePagePlugin, releasePageSources } from "./lib/release-page-preview.mjs";
import { releaseReviewFixtures, releaseFixtureFile } from "./lib/release-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length
  ? path.resolve(`output/playwright/p65-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output);
const { fixture, nav } = await releaseReviewFixtures(),
  probe = reservePort();
const envelope = (data) => ({
  data,
  request_id: "p65-local-fixture",
  trace_id: "p65-local-fixture",
});
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [releasePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...releasePageSources,
    releaseFixtureFile,
    "scripts/lib/release-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-release-page-preview.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P65 actual Vue review ${origin}`);
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      requests = [],
      unexpected = [],
      errors = [];
    context.setDefaultTimeout(8000);
    let current = structuredClone(fixture),
      failure = false,
      checks = 0;
    const check = (a, b, label) => {
      assert.deepEqual(a, b, `${width}: ${label}`);
      checks++;
    };
    const capture = async (name, locator) => {
      await page.evaluate(() => document.fonts.ready);
      if (locator) {
        await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const issues = await locator.evaluate((el) =>
          [...el.querySelectorAll("h2,h3,dt,dd,button,summary")]
            .filter((n) => n.checkVisibility())
            .flatMap((n) => {
              const r = n.getBoundingClientRect(),
                hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return r.top < 0 ||
                r.bottom > innerHeight ||
                r.left < 0 ||
                r.right > innerWidth ||
                (!n.contains(hit) && !hit?.contains(n))
                ? [{ text: n.textContent.slice(0, 60), bounds: r.toJSON(), hit: hit?.className }]
                : [];
            }),
        );
        assert.deepEqual(issues, [], width + " capture visible region " + name);
      }
      if (!output) return;
      const b = locator
        ? await locator.screenshot({ animations: "disabled" })
        : await page.screenshot({ fullPage: true, animations: "disabled" });
      const file = width + "-" + name + ".png";
      await writeFile(path.join(output, file), b);
      images.push({
        file,
        sha256: hash(b),
        pixelWidth: b.readUInt32BE(16),
        pixelHeight: b.readUInt32BE(20),
      });
    };
    try {
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("download", () => unexpected.push("download"));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          key = req.method() + " " + url.pathname;
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: envelope({ authenticated: true }) });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
        if (key !== "GET /api/v1/platform/operations/releases" || url.search) {
          unexpected.push(key + url.search);
          return route.abort();
        }
        requests.push({ method: req.method(), body: req.postData() });
        if (failure)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: "local_release_unavailable",
                message: "本地读取失败",
                action_hint: "本地测试暂未读取到更新。",
              },
              request_id: "p65-local-read-failure",
            },
          });
        return route.fulfill({ json: envelope(current) });
      });
      await page.goto(origin + "/platform-admin/releases");
      const surface = page.locator(".release-center--review"),
        identities = surface.locator("#p65-identities"),
        metrics = surface.locator("#p65-metrics"),
        actions = surface.locator("#p65-actions"),
        refresh = surface.getByRole("button", { name: "刷新发布事实", exact: true });
      await surface.getByText("发布门已通过", { exact: true }).waitFor();
      check(await surface.getByRole("heading", { level: 1 }).count(), 1, "one page h1");
      check(
        await surface.locator(".ring, .identity-grid, .gate-grid").count(),
        0,
        "old layout removed",
      );
      check(
        await identities.locator(".p65-version-production code").first().textContent(),
        fixture.versions.production.build_sha,
        "full production SHA",
      );
      check(
        await identities.locator(".p65-version-local code").first().textContent(),
        fixture.versions.local.build_sha,
        "full local SHA",
      );
      check(
        await identities.locator(".p65-version-remote code").first().textContent(),
        fixture.versions.remote.build_sha,
        "full remote SHA",
      );
      check(
        await identities.getByText(/返回文本一致不代表独立核验/).count(),
        1,
        "source fallback caveat",
      );
      check(
        await surface.getByRole("link", { name: "查看接口覆盖证据" }).count(),
        0,
        "operator has no superadmin link",
      );
      check(
        await actions.getByText("1.3 秒", { exact: true }).count(),
        1,
        "original migration duration",
      );
      check(
        await actions.getByText("2.5 秒", { exact: true }).count(),
        1,
        "original rollback duration",
      );
      check(
        await actions.getByText("未核验", { exact: true }).count(),
        2,
        "independent original false flags",
      );
      check(
        await actions.locator(".p65-history").getByText("尚无状态", { exact: true }).count(),
        1,
        "missing historical state not healthy",
      );
      check(
        await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        true,
        "no page horizontal overflow",
      );
      check(
        await surface
          .getByRole("heading", { level: 1 })
          .evaluate((el) => getComputedStyle(el).fontFamily.includes("Microsoft YaHei")),
        true,
        "C heading wins legacy typography",
      );
      check(
        await surface
          .locator(".p65-directory")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        "rgb(18, 73, 184)",
        "C blue directory",
      );
      if (width === 390) {
        check(
          await identities
            .locator(".p65-version-local")
            .evaluate((el) => el.getBoundingClientRect().width >= 200),
          true,
          "mobile source area is not squeezed by desktop columns",
        );
        check(
          await surface
            .locator(".p65-layout")
            .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length),
          1,
          "mobile layout is single column",
        );
      }
      await capture("default", null);
      await capture("directory", surface.locator(".p65-directory"));
      await capture("identity-production", identities.locator(".p65-version-production"));
      await capture("identity-local", identities.locator(".p65-version-local"));
      await capture("identity-remote", identities.locator(".p65-version-remote"));
      await capture("identity-match", identities.locator(".p65-match"));
      await capture("history", actions.locator(".p65-history"));
      await capture("timing", actions.locator(".p65-sources"));
      await identities.getByText("配置技术详情", { exact: true }).click();
      check(
        await identities
          .getByText(fixture.versions.production.config_fingerprint, { exact: true })
          .textContent(),
        fixture.versions.production.config_fingerprint,
        "complete configuration fingerprint",
      );
      await capture("identity-technical", identities.locator(".p65-version-production"));
      await identities.getByText("配置技术详情", { exact: true }).click();
      const links = surface.getByRole("navigation", { name: "发布证据页内导航" }).getByRole("link");
      check(await links.count(), 3, "three reading anchors");
      for (let i = 0; i < 3; i++) {
        await links.nth(i).focus();
        await page.keyboard.press("Enter");
        check(
          new URL(page.url()).hash,
          ["#p65-identities", "#p65-metrics", "#p65-actions"][i],
          "real anchor target",
        );
      }
      if (width === 390) {
        const entries = metrics.locator(".responsive-data-view__mobile").getByRole("button");
        check(await entries.count(), 3, "three historical gate records");
        for (let i = 0; i < 3; i++) {
          const percent = [5, 25, 100][i];
          await entries.nth(i).click();
          const dialog = page.getByRole("dialog", { name: percent + "% 观察门", exact: true });
          await dialog.waitFor();
          check(
            await dialog
              .locator("dd")
              .first()
              .evaluate((el) => getComputedStyle(el).fontFamily.includes("Microsoft YaHei")),
            true,
            "C drawer value typography",
          );
          await capture("detail-" + percent + "-header", dialog.locator("header"));
          check(
            await dialog.locator(".responsive-data-view__details > dl > div").count(),
            6,
            "all original detail fields",
          );
          check(
            await dialog.getByText("1800 秒 / 20 个", { exact: true }).count(),
            1,
            "actual time/sample",
          );
          check(await dialog.getByText("100 ms", { exact: true }).count(), 1, "actual read metric");
          check(
            await dialog.getByText("200 ms", { exact: true }).count(),
            1,
            "actual write metric",
          );
          const close = dialog.getByRole("button", { name: "关闭详情" });
          await close.focus();
          await page.keyboard.press("Shift+Tab");
          check(
            await dialog.locator("summary").evaluate((el) => el === document.activeElement),
            true,
            "reverse focus loop",
          );
          await page.keyboard.press("Tab");
          check(
            await close.evaluate((el) => el === document.activeElement),
            true,
            "forward focus loop",
          );
          await capture("detail-" + percent, dialog.locator(".responsive-data-view__details > dl"));
          await dialog.getByText("技术详情", { exact: true }).click();
          check(await dialog.getByText("gate-" + percent, { exact: true }).count(), 1, "gate id");
          check(
            await dialog.getByText("canary_" + percent, { exact: true }).count(),
            1,
            "gate code",
          );
          check(await dialog.getByText("release-1", { exact: true }).count(), 1, "release id");
          await capture("detail-" + percent + "-technical", dialog.locator("details"));
          await page.keyboard.press("Escape");
          check(await dialog.count(), 0, "escape closes");
          check(
            await entries.nth(i).evaluate((el) => el === document.activeElement),
            true,
            "trigger focus returned",
          );
        }
      } else {
        check(await metrics.locator("thead th").count(), 6, "six original columns");
        check(await metrics.locator("tbody tr").count(), 3, "three original canary rows");
        await metrics.locator("tbody tr").first().locator("summary").click();
        check(
          await metrics.getByText("gate-5", { exact: true }).count(),
          1,
          "desktop gate technical id",
        );
        await capture("metrics-technical", metrics);
      }
      check(requests.length, 1, "all disclosure/dialog/anchor actions do not refetch");
      // Explicit local test variants, not service-generated verdict claims.
      current = structuredClone(fixture);
      current.latest_historical_release = {
        ...current.latest_historical_release,
        build_sha: "b".repeat(40),
      };
      current.gates.find((g) => g.gate_kind === "migration").duration_ms = 0;
      current.gates.find((g) => g.gate_kind === "rollback").duration_ms = null;
      await refresh.click();
      await actions.getByText("0 ms", { exact: true }).waitFor();
      check(
        await actions.getByText("尚无记录", { exact: true }).count(),
        2,
        "null duration and missing historical completion",
      );
      check(
        await identities.locator(".p65-match").getByText("a".repeat(40), { exact: true }).count(),
        1,
        "matching release retained",
      );
      check(
        await actions.locator(".p65-history").getByText("b".repeat(40), { exact: true }).count(),
        1,
        "different newest history not merged",
      );
      await capture("zero-unknown-duration", actions.locator(".p65-sources"));
      await capture("different-history", actions.locator(".p65-history"));
      current = {
        ...structuredClone(fixture),
        state: "empty",
        latest_release: null,
        latest_historical_release: null,
        gates: [],
        blockers: [],
      };
      await refresh.click();
      await surface.getByText("尚无发布记录", { exact: true }).waitFor();
      check(
        await identities.getByText("当前构建尚无匹配发布记录。", { exact: true }).count(),
        1,
        "no matching release",
      );
      check(
        await actions.getByText("尚无历史发布记录。", { exact: true }).count(),
        1,
        "no history",
      );
      check(
        await metrics.getByText("暂无记录", { exact: true }).count(),
        1,
        "original table empty state",
      );
      await capture("empty-verdict", surface.locator(".verdict"));
      failure = true;
      await refresh.click();
      await surface.getByText("刷新未完成", { exact: true }).waitFor();
      check(
        await surface.getByText("尚无发布记录", { exact: true }).count(),
        1,
        "failed refresh retains empty snapshot",
      );
      await capture("refresh-failed", surface.locator(".refresh-notice"));
      check(requests.length, 6, "three successes plus original three-attempt 503");
      check(unexpected, [], "local GET only; no writes or downloads");
      check(errors, [], "no browser errors");
      results.push({ width, checks, requests });
      console.log(JSON.stringify({ width, checks }));
    } finally {
      await context.close();
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
      ),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P65",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue C review; original partial E2E and explicit local duration/history/empty variants; no release or rollback execution",
          sources: sourceHashes,
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(output, "index.html"),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P65实际Vue审核</title>' +
        "<style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#182739}" +
        "img{max-width:100%;border:1px solid #c7d3e4;display:block}article{margin:28px 0}</style>" +
        "<h1>P65 实际Vue待审</h1><p>本地样例，只读展示；未执行发布或回滚，不代表真实权限或生产验收。</p>" +
        images
          .map(
            (i) =>
              `<article><h2>${i.file}</h2><img src="${i.file}" alt="${i.file} 待审"></article>`,
          )
          .join("\n") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((sum, r) => sum + r.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
