import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildDataRecordsDesignData } from "./lib/ui-phase2-data-records-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07/design";
const relative = `${base}/data-record-detail-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2);
assert.ok(args.every((v) => ["--capture", "--smoke"].includes(v)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const read = (file) => readFile(path.join(repo, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const built = await buildDataRecordsDesignData(repo);
const composed = JSON.parse(await read(`${base}/data-composed-direction-c/evidence.json`));
// Reuse immutable historical provenance; fail closed instead of silently rebinding old evidence.
for (const [file, expected] of Object.entries(composed.sourceHashes))
  assert.equal(hash((await read(file)).replaceAll("\r\n", "\n")), expected, file);
const paths = [
  ...Object.keys(composed.sourceHashes),
  `${base}/data-composed-direction-c/evidence.json`,
  `${relative}/index.html`,
  `${relative}/detail-review.js`,
  `${relative}/detail.css`,
  "scripts/verify-ui-phase2-data-record-detail-c.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    paths.map(async (file) => [file, hash((await read(file)).replaceAll("\r\n", "\n"))]),
  ),
);
const vue = await read("apps/web/src/components/PlatformDataCenter.vue");
const slot = vue.split('<template #detail="{ row }">')[1].split("</template>")[0];
const fieldKeys = [
  "organization_name",
  "workspace_name",
  "category",
  "market",
  "status",
  "metric_primary",
  "metric_secondary",
  "updated_at",
  "id",
];
for (const key of fieldKeys) assert.ok(slot.includes(`row.${key}`), key);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expectedFiles = [],
  checks = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 };
    const context = await browser.newContext({
      viewport,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => !!window.DATA_RECORD_DETAIL_C);
      assert.deepEqual(await page.evaluate(() => window.DATA_RECORDS_DATA), built.data);
      const pane = page.locator("#records-pane"),
        dialog = pane.locator("#record-dialog");
      const trigger = () => pane.locator(width <= 760 ? "#mobile-record-0" : "#record-0");
      const shot = async (scene) => {
        const metrics = await dialog.evaluate((d) => {
          const visible = (n) =>
            n.getClientRects().length && getComputedStyle(n).visibility !== "hidden";
          const controls = [...d.querySelectorAll("button,summary")].filter(visible);
          const r = d.getBoundingClientRect();
          return {
            modal: d.matches(":modal"),
            overflow: d.scrollWidth > d.clientWidth + 1,
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            withinViewport:
              r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
            badControls: controls
              .filter((n) => {
                const b = n.getBoundingClientRect();
                return (
                  b.width < 43.9 || b.height < 43.9 || parseFloat(getComputedStyle(n).fontSize) < 16
                );
              })
              .map((n) => n.textContent),
          };
        });
        assert.equal(metrics.modal, true);
        assert.equal(metrics.withinViewport, true);
        assert.equal(metrics.overflow, false);
        assert.equal(metrics.pageOverflow, false);
        assert.deepEqual(metrics.badControls, []);
        const file = `${width}-${scene.replaceAll(":", "-")}.png`;
        expectedFiles.push(file);
        if (capture) {
          await page.screenshot({
            path: path.join(root, file),
            fullPage: false,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            viewport,
            fullPage: false,
            approval: "pending",
            metrics,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      };
      const visibleWhole = async (locator, hitTest = false) => {
        await locator.scrollIntoViewIfNeeded();
        assert.equal(
          await locator.evaluate((n, hit) => {
            const r = n.getBoundingClientRect(),
              d = n.closest("dialog").getBoundingClientRect();
            const target = n.getRootNode().elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return (
              r.top >= Math.max(d.top, 0) &&
              r.bottom <= Math.min(d.bottom, innerHeight) + 1 &&
              r.left >= d.left &&
              r.right <= d.right + 1 &&
              (!hit || n === target || n.contains(target))
            );
          }, hitTest),
          true,
        );
      };
      const samples = await page.evaluate(() => window.DATA_RECORD_DETAIL_C.samples);
      for (const [key, sample] of Object.entries(samples)) {
        if (smoke && !["opportunities", "suppliers-long"].includes(key)) continue;
        await page.locator("#detail-sample").selectOption(key);
        const state = await page.evaluate(() => window.DATA_RECORDS_C.state());
        const row = state.snapshot.items[0];
        const sourceRow = (
          key === "suppliers-original" ? built.data.originals : built.data.synthetic
        )[sample.entity].items[0];
        for (const name of ["status", "metric_primary", "metric_secondary", "updated_at"])
          assert.deepEqual(row[name], sourceRow[name]);
        if (!sample.long) assert.deepEqual(row, sourceRow);
        assert.equal(state.scope.entity, sample.entity);
        await trigger().click();
        assert.equal(await dialog.locator("#detail-title").textContent(), row.title);
        const entity = built.data.entities.find((e) => e.value === sample.entity);
        const timestamp = await page.evaluate(
          (v) => (v ? new Date(v).toLocaleString("zh-CN") : "—"),
          row.updated_at,
        );
        const expected = [
          ["所属组织", row.organization_name],
          ["工作区", row.workspace_name],
          [
            sample.entity === "suppliers" ? "供应商 / 地点" : "分类或站点 / 市场",
            `${row.category || "—"} / ${row.market || "—"}`,
          ],
          ["状态", built.data.labels[sample.entity][row.status]],
          [
            `${entity.primary} / ${entity.secondary}`,
            `${row.metric_primary} / ${row.metric_secondary}`,
          ],
          ["更新时间", timestamp],
        ];
        assert.deepEqual(
          await dialog
            .locator("dl > div")
            .evaluateAll((rows) =>
              rows.map((n) => [
                n.querySelector("dt").textContent,
                n.querySelector("dd").textContent,
              ]),
            ),
          expected,
        );
        assert.equal(await dialog.locator("#record-tech code").textContent(), row.id);
        assert.match(
          await dialog.locator("#detail-description").textContent(),
          /非实时记录|非实时平台/,
        );
        assert.equal(await page.evaluate(() => window.DATA_COMPOSED_C.select("quality")), false);
        await shot(`${key}:detail`);
        const fields = dialog.locator("dl > div");
        for (let i = 0; i < 6; i++) {
          await visibleWhole(fields.nth(i), true);
          if (sample.long) await shot(`${key}:field-${i + 1}`);
        }
        if (!sample.long) {
          await dialog.locator("dl").scrollIntoViewIfNeeded();
          await shot(`${key}:fields`);
        }
        await dialog.locator("#record-tech summary").click();
        await visibleWhole(dialog.locator("#record-tech code"));
        const footer = dialog.locator("footer button");
        await visibleWhole(footer, true);
        await shot(`${key}:technical-footer`);
        // Test both ends of the keyboard loop, then native Escape and physical footer close.
        await footer.focus();
        await page.keyboard.press("Tab");
        assert.equal(
          await dialog
            .locator("header button")
            .evaluate((n) => n.getRootNode().activeElement === n),
          true,
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(await footer.evaluate((n) => n.getRootNode().activeElement === n), true);
        await page.keyboard.press("Escape");
        assert.equal(await dialog.evaluate((n) => n.open), false);
        assert.equal(await trigger().evaluate((n) => n.getRootNode().activeElement === n), true);
        await trigger().click();
        await footer.click();
        assert.equal(await trigger().evaluate((n) => n.getRootNode().activeElement === n), true);
        checks.push({
          width,
          sample: key,
          fields: fieldKeys,
          title: true,
          keyboard: "loop/Escape/footer/return",
          fieldVisibility: "six individually scrolled and hit-tested",
          realRuntime: false,
        });
      }
      assert.deepEqual(await page.evaluate(() => window.DATA_RECORDS_DATA), built.data);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `record_detail width=${width} fields/labels/provenance/scroll/focus passed HTTP=0 storage=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "DATA-RECORD-DETAIL-C-r1",
        approval: "pending",
        kind: "additive-offline-detail-proof",
        sourceHashes,
        checks,
        boundary:
          "Three entity detail variants plus isolated supplier fixture. No old package changes. Long strings synthetic; status, metrics and timestamp preserved. Not every row/status/theme, native Vue, API/SQL, global action acceptance or deployment.",
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P54 三类详情待审图册</title>',
      "<style>body{font:16px sans-serif;margin:24px;background:#f3f6fa;color:#172944}img{max-width:100%;height:auto}figure{margin:32px 0}</style>",
      '<h1>P54 机会 / 竞品 / 供应商详情 · 待审核</h1><p>仅离线提案，不是生产页面。长文是排版样例；图片数不代表覆盖率。</p><a href="index.html">打开可交互补稿</a>',
      ...screenshots.map(
        (s) =>
          `<figure id="${s.scene}-${s.viewport.width}"><figcaption>${s.scene} · ${s.viewport.width}</figcaption><img loading="lazy" src="${s.file}" alt="${s.scene}"></figure>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke) {
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expectedFiles,
  );
  assert.deepEqual(previous.checks, checks);
}
