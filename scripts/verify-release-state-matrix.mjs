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
import { releaseStateFixtures, releaseStateServiceFile } from "./lib/release-state-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p65-state-matrix-${args[1]}`) : null;
if (output) await mkdir(output);
const { nav } = await releaseReviewFixtures();
const cases = await releaseStateFixtures();
const probe = reservePort();
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
  releaseStateServiceFile,
  "scripts/lib/release-state-fixtures.mjs",
  "scripts/lib/release-review-fixtures.mjs",
  "scripts/lib/status-review-fixtures.mjs",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  "scripts/lib/ui-imported-style-sources.mjs",
  "scripts/verify-release-state-matrix.mjs",
  "apps/web/vite.config.ts",
  "database/migrations/0026_release_rollout_m07_05.up.sql",
  "database/migrations/0007_m00_08_deployment_releases.up.sql",
]);
const images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const titles = {
  verified: "发布门已通过",
  blocked: "发布条件未满足",
  empty: "尚无发布记录",
  stale: "观察证据已过期",
  stopped: "服务返回停止结论",
  rolled_back: "服务返回回滚结论",
};
const blockerTitles = {
  current_release_evidence_missing: "当前版本缺少发布证据",
  release_identity_mismatch: "版本、迁移或配置不同源",
  release_source_mismatch: "本地、远端与生产版本不一致",
  rollout_gates_incomplete: "发布观察门未完成",
  rollout_evidence_stale: "发布观察证据已过期",
};
const statusLabels = { passed: "已通过", pending: "待观察" };
const durationText = (g) => (g ? "1.3 秒" : "尚无记录");
const metricText = (v, unit) => (v === null ? "尚无记录" : `${v}${unit}`);
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P65 state matrix ${origin}`);
  for (const width of [1440, 390])
    for (const motion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      context.setDefaultTimeout(8000);
      const page = await context.newPage(),
        requests = [],
        unexpected = [],
        errors = [];
      let current = cases[0],
        checks = 0;
      const check = (a, b, label) => {
        assert.deepEqual(a, b, `${width}/${motion}/${current.id}: ${label}`);
        checks++;
      };
      const capture = async (name, locator) => {
        await page.evaluate(() => document.fonts.ready);
        await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const issues = await locator.evaluate((el) =>
          [...el.querySelectorAll("h2,h3,strong,p,dt,dd,button,summary,code")]
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
        assert.deepEqual(issues, [], `${width} visible captured region ${name}`);
        if (!output || motion !== "reduce") return;
        const b = await locator.screenshot({ animations: "disabled" });
        const file = `${width}-${name}.png`;
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
          const envelope = (data) => ({
            data,
            request_id: `p65-state-${current.id}`,
            trace_id: `p65-state-${current.id}`,
          });
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
          requests.push({ scenario: current.id, method: req.method(), body: req.postData() });
          return route.fulfill({ json: envelope(current.data) });
        });
        await page.goto(origin + "/platform-admin/releases");
        const surface = page.locator(".release-center--review"),
          metrics = surface.locator("#p65-metrics"),
          verdict = surface.locator(".verdict");
        await verdict.waitFor();
        for (const [index, scenario] of cases.entries()) {
          current = scenario;
          const before = requests.length;
          if (index) {
            await surface.getByRole("button", { name: "刷新发布事实", exact: true }).click();
            await page.waitForFunction(
              () =>
                document.querySelector(".release-read-action")?.getAttribute("aria-busy") ===
                "false",
            );
          }
          const data = current.data;
          check(await verdict.getAttribute("data-state"), data.state, "service verdict preserved");
          check(
            (await verdict.locator("strong").textContent()).trim(),
            titles[data.state],
            "explicit textual state",
          );
          check(await surface.getByRole("heading", { level: 1 }).count(), 1, "one page heading");
          check(
            await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            true,
            "no horizontal page overflow",
          );
          check(
            await surface.getByRole("button", { name: /^(发布|回滚|停止|批准|迁移)$/ }).count(),
            0,
            "no invented write action",
          );
          if (
            [
              "verified",
              "empty",
              "stale",
              "status-stopped",
              "stopped",
              "status-rollback",
              "rolled-back",
              "identity-before-rollback",
            ].includes(current.id)
          )
            await capture(current.id + "-verdict", verdict);
          if (!data.latest_release)
            check(
              await surface.getByText("当前构建尚无匹配发布记录。", { exact: true }).count(),
              1,
              "no fabricated matching record",
            );
          else
            check(
              (await surface.locator(".p65-match code").textContent()).trim(),
              data.latest_release.build_sha,
              "complete current matching SHA",
            );
          if (!data.latest_historical_release)
            check(
              await surface.getByText("尚无历史发布记录。", { exact: true }).count(),
              1,
              "empty history explicit",
            );
          else
            check(
              (await surface.locator(".p65-history code").textContent()).trim(),
              data.latest_historical_release.build_sha,
              "most recent history stays independent",
            );
          if (["current-missing", "newest-other"].includes(current.id)) {
            await capture(current.id + "-match", surface.locator(".p65-match"));
            await capture(current.id + "-history", surface.locator(".p65-history"));
          }
          check(
            (await surface.locator(".p65-source-note").textContent()).includes(
              "返回文本一致不代表独立核验",
            ),
            true,
            "fallback caveat visible",
          );
          for (const key of ["local", "remote", "production"])
            check(
              (await surface.locator(`.p65-version-${key} code`).first().textContent()).trim(),
              data.versions[key].build_sha,
              "complete " + key + " SHA",
            );
          if (current.id === "source-fallback") {
            check(
              await surface.getByText("未记录仓库", { exact: true }).count(),
              1,
              "missing repository explicit",
            );
            await capture("source-fallback", surface.locator(".p65-version-remote"));
          }
          const flags = surface.locator(".p65-actions > dl");
          check(
            (await flags.locator("dd").allTextContents()).map((t) => t.trim()),
            [
              data.automatic_stop_verified ? "已记录" : "未核验",
              data.rollback_verified ? "已记录" : "未核验",
            ],
            "action evidence separate from verdict",
          );
          for (const [i, kind] of ["migration", "rollback"].entries())
            check(
              (
                await surface
                  .locator(".p65-actions > .p65-sources > section")
                  .nth(i)
                  .locator("dd")
                  .first()
                  .textContent()
              ).trim(),
              durationText(data.gates.find((g) => g.gate_kind === kind)),
              kind + " timing not invented",
            );
          if (
            [
              "status-stopped",
              "stopped",
              "status-rollback",
              "rolled-back",
              "identity-before-rollback",
              "rollback-before-stop",
            ].includes(current.id)
          )
            await capture(current.id + "-evidence", flags);
          const blockers = surface.locator(".blockers article");
          check(await blockers.count(), data.blockers.length, "only service blocker records");
          for (const [i, blocker] of data.blockers.entries()) {
            const row = blockers.nth(i);
            check(
              (await row.locator("strong").textContent()).trim(),
              blockerTitles[blocker.code],
              "mapped blocker name",
            );
            check(
              (await row.locator("p").textContent()).trim(),
              blocker.action_hint,
              "service hint not rewritten as current operation",
            );
            await row.locator("summary").press("Enter");
            check(
              await row.locator("details").getAttribute("open"),
              "",
              "keyboard opens blocker code",
            );
            check(
              (await row.locator("code").textContent()).trim(),
              blocker.code,
              "complete blocker code",
            );
            if (
              [
                "current-missing",
                "identity-app",
                "source-mismatch",
                "missing-gate",
                "stale",
              ].includes(current.id)
            )
              await capture(current.id + "-blocker", row);
            await row.locator("summary").press("Enter");
            check(
              await row.locator("details").getAttribute("open"),
              null,
              "keyboard closes blocker code",
            );
          }
          const rows = data.gates.filter((g) => g.gate_kind.startsWith("canary_"));
          if (width === 1440) {
            check(
              await metrics.locator("tbody tr").count(),
              rows.length,
              "matching canary row count",
            );
            for (const [i, row] of rows.entries()) {
              const cells = (
                await metrics.locator("tbody tr").nth(i).locator("td").allTextContents()
              ).map((t) => t.trim());
              check(
                cells.slice(1, 5),
                [
                  metricText(row.error_rate_percent, "%"),
                  metricText(row.read_p95_ms, " ms"),
                  metricText(row.write_p95_ms, " ms"),
                  metricText(row.async_lag_seconds, " s"),
                ],
                "four actual gate metrics",
              );
            }
            if (
              [
                "missing-gate",
                "no-gates",
                "missing-metric",
                "zero-metrics",
                "error-equal",
                "read-equal",
              ].includes(current.id)
            )
              await capture(current.id + "-metrics", metrics);
          } else {
            const buttons = metrics.locator(".responsive-data-view__mobile article button");
            check(await buttons.count(), rows.length, "matching mobile canary count");
            for (const [i, row] of rows.entries()) {
              const summary = await buttons.nth(i).textContent();
              check(
                summary.includes("读取 " + metricText(row.read_p95_ms, " ms")),
                true,
                "each mobile read metric",
              );
              check(
                summary.includes("错误 " + metricText(row.error_rate_percent, "%")),
                true,
                "each mobile error metric",
              );
            }
            if (rows.length) {
              const selected = current.id === "gate-pending" ? 1 : 0,
                row = rows[selected],
                trigger = buttons.nth(selected);
              check(
                (await trigger.textContent()).includes(
                  "读取 " + metricText(row.read_p95_ms, " ms"),
                ),
                true,
                "actual mobile metric summary",
              );
              if (["missing-metric", "zero-metrics"].includes(current.id))
                await capture(current.id + "-summary", trigger);
              await trigger.click();
              const dialog = page.getByRole("dialog", {
                name: `${row.traffic_percent}% 观察门`,
                exact: true,
              });
              await dialog.waitFor();
              check(
                (
                  await dialog.locator(".responsive-data-view__details > dl dd").allTextContents()
                ).map((t) => t.trim()),
                [
                  statusLabels[row.status],
                  `${row.observe_seconds} 秒 / ${row.sample_count} 个`,
                  metricText(row.error_rate_percent, "%"),
                  metricText(row.read_p95_ms, " ms"),
                  metricText(row.write_p95_ms, " ms"),
                  metricText(row.async_lag_seconds, " 秒"),
                ],
                "complete actual mobile fields",
              );
              check(
                await dialog.evaluate((el) => el.contains(document.activeElement)),
                true,
                "detail initial focus contained",
              );
              await page.keyboard.press("Shift+Tab");
              check(
                await dialog.evaluate((el) => el.contains(document.activeElement)),
                true,
                "backward focus contained",
              );
              await page.keyboard.press("Tab");
              check(
                await dialog.evaluate((el) => el.contains(document.activeElement)),
                true,
                "forward focus contained",
              );
              if (
                ["missing-metric", "zero-metrics", "error-equal", "gate-pending"].includes(
                  current.id,
                )
              )
                await capture(
                  current.id + "-detail",
                  dialog.locator(".responsive-data-view__details > dl"),
                );
              await page.keyboard.press("Escape");
              check(await dialog.count(), 0, "detail closes");
              check(
                await trigger.evaluate((el) => el === document.activeElement),
                true,
                "detail returns focus",
              );
            } else await capture(current.id + "-metrics", metrics);
          }
          check(requests.length - before, index ? 1 : 0, "disclosure and detail add no requests");
        }
        check(requests.length, cases.length, "one GET per scenario");
        check(unexpected, [], "no external/write/download requests");
        check(errors, [], "no browser exceptions");
        results.push({ width, motion, checks, requests });
        console.log(JSON.stringify({ width, motion, checks }));
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
            "25 current read-service outputs with inert repository inputs; actual Vue C; no SQL, real authorization, deployment, probe or rollback",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P65结论状态审核</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#182739}img{max-width:100%;border:1px solid #c7d3e4;display:block}article{margin:28px 0}</style><h1>P65 结论状态待审</h1><p>实际服务使用本地合成记录计算，非真实数据库、发布或生产验收。状态标题和证据标记分别核对。</p>' +
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
