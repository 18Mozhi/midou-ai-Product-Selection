import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { backupPagePlugin, backupPageSources } from "./lib/backup-page-preview.mjs";
import { backupReviewFixtures, backupFixtureFile } from "./lib/backup-review-fixtures.mjs";
import { backupStateFixtures, backupStateServiceFile } from "./lib/backup-state-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p64-state-matrix-${args[1]}`) : null;
if (output) await mkdir(output);
const cases = await backupStateFixtures(),
  { nav } = await backupReviewFixtures();
const envelope = (data, id = "local-matrix") => ({ data, request_id: id, trace_id: id });
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [backupPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
  ...backupPageSources,
  backupFixtureFile,
  backupStateServiceFile,
  "scripts/lib/backup-state-fixtures.mjs",
  "scripts/lib/backup-review-fixtures.mjs",
  "scripts/lib/status-review-fixtures.mjs",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  "scripts/lib/ui-imported-style-sources.mjs",
  "scripts/verify-backup-state-matrix.mjs",
  "apps/web/vite.config.ts",
  "database/migrations/0025_backup_recovery_m07_04.up.sql",
]);
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  images = [],
  results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P64 state matrix ${origin}`);
  const outcomes = await Promise.allSettled(
    [1440, 390].flatMap((width) =>
      ["reduce", "no-preference"].map(async (motion) => {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: motion,
        });
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [];
        let current = cases[0],
          checks = 0;
        const check = (actual, expected, label) => {
          assert.deepEqual(actual, expected, `${width}/${motion}/${current.id}: ${label}`);
          checks++;
        };
        const capture = async (name, locator) => {
          if (!output || motion !== "reduce") return;
          await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
          assert.deepEqual(
            await locator.evaluate((el) =>
              Array.from(el.querySelectorAll("h2,h3,dt,dd,p,strong,small,summary,button"))
                .filter((item) => item.checkVisibility())
                .filter((item) => {
                  const rect = item.getBoundingClientRect();
                  return (
                    rect.top < 0 ||
                    rect.bottom > innerHeight ||
                    !item.contains(
                      document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
                    )
                  );
                })
                .map((item) => item.textContent.trim().slice(0, 60)),
            ),
            [],
            `${width}/${current.id}/${name}: captured text and controls unobscured`,
          );
          const b = await locator.screenshot({ animations: "disabled" }),
            file = `${width}-${current.id}-${name}.png`;
          await writeFile(path.join(output, file), b);
          images.push({
            file,
            sha256: hash(b),
            pixelWidth: b.readUInt32BE(16),
            pixelHeight: b.readUInt32BE(20),
          });
        };
        try {
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("download", () => unexpected.push("download"));
          await page.route("**/*", async (route) => {
            const req = route.request(),
              url = new URL(req.url()),
              key = `${req.method()} ${url.pathname}`;
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
            if (key !== "GET /api/v1/platform/operations/backup-recovery" || url.search) {
              unexpected.push(key);
              return route.abort();
            }
            requests.push({ id: current.id, method: req.method(), body: req.postData() });
            return route.fulfill({ json: envelope(current.data, `matrix-${current.id}`) });
          });
          const surface = page.locator(".backup-center--review"),
            objectives = surface.locator("#p64-objectives"),
            evidence = surface.locator("#p64-evidence"),
            assets = surface.locator("#p64-assets");
          const value = async (region, label) =>
            region
              .locator("dl > div")
              .filter({ has: page.locator("dt").filter({ hasText: new RegExp(`^${label}$`) }) })
              .locator("dd")
              .innerText();
          for (const [index, scenario] of cases.entries()) {
            current = scenario;
            if (index === 0) await page.goto(origin + "/platform-admin/operations");
            else await surface.getByRole("button", { name: "刷新事实", exact: true }).click();
            // A response-specific trace appears in a native closed details; wait on DOM, not visibility.
            await page.waitForFunction(
              (id) =>
                document.querySelector(".backup-center--review footer")?.textContent.includes(id),
              `matrix-${current.id}`,
            );
            const data = current.data;
            check(
              await surface.locator(".truth-banner").getAttribute("data-kind"),
              data.state,
              "service state retained",
            );
            const title = {
              verified: "同机恢复链路已验证",
              stale: "恢复演练已过期",
              empty: "尚无备份记录",
              blocked: "恢复链路受阻",
            }[data.state];
            check(
              await surface.locator(".truth-banner strong").innerText(),
              title,
              "truth heading",
            );
            check(
              await value(
                objectives.getByRole("region", { name: "数据库最多可丢失时间", exact: true }),
                "实际记录",
              ),
              data.latest_backup?.actual_rpo_minutes == null
                ? "未记录"
                : `${data.latest_backup.actual_rpo_minutes} min`,
              "RPO explicit zero or missing",
            );
            check(
              await value(
                objectives.getByRole("region", { name: "数据库恢复耗时", exact: true }),
                "实际记录",
              ),
              data.latest_drill?.actual_rto_minutes == null
                ? "未记录"
                : `${data.latest_drill.actual_rto_minutes} min`,
              "RTO explicit zero or missing",
            );
            check(
              await value(evidence, "权限边界"),
              data.latest_drill?.permission_boundary_verified ? "已核验" : "未核验",
              "permission fact",
            );
            check(
              await value(evidence, "审计链 / 证据哈希"),
              data.latest_drill?.audit_chain_verified && data.latest_drill?.evidence_hash_verified
                ? "已核验"
                : "未核验",
              "audit and hash fact",
            );
            const remaining = data.days_until_drill_expiry;
            check(
              await evidence.locator(".drill-expiry small").innerText(),
              remaining == null
                ? "尚无演练证据"
                : remaining < 0
                  ? `已到期 ${Math.abs(remaining)} 天`
                  : remaining === 0
                    ? "今天到期"
                    : `还剩 ${remaining} 天到期`,
              "expiry exact phrase",
            );
            check(
              await surface.locator(".blockers article").count(),
              data.blockers.length,
              "all service blockers",
            );
            for (const blocker of data.blockers)
              check(
                await surface.getByText(blocker.action_hint, { exact: true }).count(),
                1,
                "service action hint",
              );
            check(
              await assets
                .locator(width === 390 ? ".responsive-data-view__mobile button" : "tbody tr")
                .count(),
              data.targets.length,
              "all targets",
            );
            check(await surface.locator("h1").count(), 1, "one page heading");
            check(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
              true,
              "no page horizontal overflow",
            );
            check(
              await surface
                .locator(".p64-directory")
                .innerText()
                .then((s) => s.includes("不代表整机或异地灾备")),
              true,
              "same-host limit retained",
            );
            await capture("truth", surface.locator(".truth-banner"));
            if (width === 390 && current.id === "long-region") {
              await capture("regions", objectives.locator(".p64-regions"));
              await capture(
                "rpo",
                objectives.getByRole("region", { name: "数据库最多可丢失时间", exact: true }),
              );
              await capture(
                "rto",
                objectives.getByRole("region", { name: "数据库恢复耗时", exact: true }),
              );
            } else await capture("objectives", objectives);
            await capture("evidence", evidence);
            if (data.blockers.length) await capture("blockers", surface.locator(".blockers"));
            if (["empty", "zero-actual", "long-region"].includes(current.id))
              await capture("assets", assets);
            if (width === 390 && current.id === "long-region") {
              const trigger = assets.getByRole("button", { name: /数据库完整备份/ }).first();
              await trigger.click();
              const dialog = page.getByRole("dialog", { name: "数据库完整备份", exact: true });
              await dialog.waitFor();
              check(
                await value(dialog, "区域"),
                data.policy.recovery_region,
                "full region inside detail",
              );
              check(
                await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
                true,
                "detail has no horizontal overflow",
              );
              await capture("detail", dialog);
              await page.keyboard.press("Escape");
              await dialog.waitFor({ state: "hidden" });
              check(
                await trigger.evaluate((el) => el === document.activeElement),
                true,
                "detail returns focus",
              );
            }
          }
          check(requests.length, cases.length, "one read per state");
          check(
            requests.every((r) => r.method === "GET" && r.body == null),
            true,
            "read only",
          );
          check(unexpected, [], "no external/write/download");
          check(errors, [], "no browser errors");
          results.push({ width, motion, checks, requests });
          console.log(JSON.stringify({ width, motion, checks, reads: requests.length }));
        } finally {
          await context.close();
        }
      }),
    ),
  );
  const failures = outcomes.filter((o) => o.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((o) => o.reason),
      "P64 matrix failed",
    );
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
  images.sort((a, b) => a.file.localeCompare(b.file));
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
          page: "P64",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "current backend service with synthetic repository -> actual Vue C preview; not real restore or permission acceptance",
          sources: sourceHashes,
          cases,
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(output, "index.html"),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P64状态图审核</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P64 状态矩阵 · 待审</h1><p>当前服务函数生成的本地合成样例；未执行真实备份/恢复。</p>' +
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
