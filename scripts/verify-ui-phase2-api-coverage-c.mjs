import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildApiCoverageDesignData } from "./lib/ui-phase2-api-coverage-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/api-coverage-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildApiCoverageDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.COVERAGE_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const file = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(file)), parser: "babel" });
  if (capture) await writeFile(file, formatted);
  else assert.equal(lf(await readFile(file, "utf8")), formatted);
}
const contract = await readFile(
  path.join(
    repo,
    "design-plans/ui-phase-2-2026-09-07/content-notification-evidence-contract-review.md",
  ),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(
  ([, f]) => data.sourcePaths.includes(f),
);
assert.equal(contracts.length, 15);
const rebind = {
  file: "tests/e2e/m06-02-platform-dashboard.spec.ts",
  commit: "ff46bfe9c620a422d95cab9689489b07fb6b95ea",
  before: "dc949ced1becd59f1e0c7bf98b9fe0ab126e5b59744cb197d70c65ec861bbc66",
  after: "7d0f9118b740aa7844bd63796e5cf5ede3ebefda1f88d58419257b962e68cd58",
};
for (const [, f, h] of contracts) {
  if (f === rebind.file) {
    assert.equal(h, rebind.before);
    for (const [revision, expected] of [
      [rebind.commit + "^", rebind.before],
      [rebind.commit, rebind.after],
    ])
      assert.equal(
        hash(
          lf(
            execFileSync("git", ["show", `${revision}:${f}`], {
              cwd: repo,
              encoding: "utf8",
              maxBuffer: 4 * 1024 * 1024,
            }),
          ),
        ),
        expected,
      );
    assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), rebind.after);
  } else assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), h, f);
}
const sourcePaths = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-api-coverage-design-data.mjs",
  "scripts/verify-ui-phase2-api-coverage-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c/quality.css",
  ...["index.html", "coverage.css", "coverage.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
  ),
);
if (!capture) {
  const previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const p of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, p.file))), p.sha256);
}
const browser = await chromium.launch({ headless: true }),
  errors = [],
  requests = [],
  screenshots = [],
  expected = [],
  checks = [];
let scenes;
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  for (const d of await page.locator("dialog[open]").all())
    assert.ok(
      await d.evaluate(
        (n) =>
          n.scrollWidth <= n.clientWidth + 1 &&
          document.getElementById(n.getAttribute("aria-labelledby")) &&
          document.getElementById(n.getAttribute("aria-describedby")),
      ),
      label + " dialog ARIA/overflow",
    );
  await checkPrototypeMetrics(page);
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      await context.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      assert.deepEqual(errors, []);
      scenes = await page.evaluate(() => window.COVERAGE_C.scenes);
      const scene = (k) => page.evaluate((k) => window.COVERAGE_C.scene(k), k),
        state = () => page.evaluate(() => window.COVERAGE_C.state()),
        done = (outcome = "success") =>
          page.evaluate((o) => window.COVERAGE_C.complete(o), outcome);
      async function shot(key, suffix = "") {
        const file = `${width}-${key}${suffix}.png`;
        expected.push(file);
        if (capture) {
          await page.screenshot({
            path: path.join(root, file),
            fullPage: !(await page.locator("dialog[open]").count()),
          });
          screenshots.push({
            scene: key,
            width,
            file,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      }
      for (const key of Object.keys(scenes)) {
        await scene(key);
        assert.deepEqual(errors, [], key);
        if (key === "dark") {
          assert.deepEqual(
            await page
              .locator("body")
              .evaluate((n) => [getComputedStyle(n).color, getComputedStyle(n).backgroundColor]),
            ["rgb(239, 244, 255)", "rgb(17, 29, 46)"],
          );
          assert.equal(
            await page
              .locator(".facts strong")
              .first()
              .evaluate((n) => getComputedStyle(n).color),
            "rgb(239, 244, 255)",
          );
        }
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, `${width}/${key}`);
        await shot(key);
        if (key === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        const d = page.locator("dialog[open]");
        let part = 0;
        if (await d.count())
          while (await d.evaluate((n) => n.scrollTop + n.clientHeight < n.scrollHeight - 2)) {
            const before = await d.evaluate((n) => n.scrollTop);
            await d.evaluate((n) => (n.scrollTop += Math.floor(n.clientHeight * 0.8)));
            assert.ok((await d.evaluate((n) => n.scrollTop)) > before);
            await shot(key, `-part${++part}`);
          }
      }
      await scene("operations");
      assert.equal(await page.locator("[data-operation]").count(), data.catalog.operations);
      for (const section of ["sources", "summary", "operations"]) {
        await page.locator(`[data-section="${section}"]`).click();
        assert.equal((await state()).reads.length, 0);
        assert.equal(
          await page
            .locator(`[data-section="${section}"]`)
            .evaluate((n) => n === document.activeElement),
          true,
        );
      }
      for (const [q, ids] of Object.entries(data.queryExpected)) {
        // Desktop and drawer submit the same contract; hidden desktop form is not clicked on mobile.
        const p = width === 390 ? "m-" : "";
        if (p) await page.locator("#mobile-filter").click();
        await page.locator(`#${p}query`).fill(q);
        await page.locator(`#${p}apply`).click();
        assert.equal(await page.evaluate(() => document.activeElement === document.body), false);
        const pending = await state();
        assert.equal(pending.pending.target.query, q);
        assert.equal(pending.reads.at(-1).query.domain, "api_coverage");
        await done();
        assert.deepEqual(
          (await state()).data.operations.map((o) => o.operation_id),
          ids,
        );
        assert.deepEqual((await state()).data.summary, data.datasets.current.summary);
      }
      for (const status of ["success", "empty", "blocked", "unauthorized", "not_run"]) {
        await scene(`result-${status}`);
        assert.ok((await state()).data.operations.every((o) => o.outcome === status));
        assert.deepEqual((await state()).data.summary, data.datasets.current.summary);
      }
      await scene("filter-draft");
      assert.equal((await state()).applied.query, "");
      await page.evaluate(() => window.COVERAGE_C.read());
      const first = (await state()).pending.id;
      await page.evaluate(() => window.COVERAGE_C.read());
      assert.notEqual((await state()).pending.id, first);
      assert.equal(
        await page.evaluate((id) => window.COVERAGE_C.complete("success", id), first),
        false,
      );
      await done("error");
      assert.equal((await state()).data.operations.length, data.catalog.operations);
      assert.equal((await state()).applied.query, "");
      await page.locator("#refresh").click();
      await done();
      assert.equal((await state()).applied.query, "/health");
      if (width === 390) await page.locator("#mobile-filter").click();
      await page.locator(width === 390 ? "#m-reset" : "#reset").click();
      await done();
      assert.equal((await state()).data.operations.length, data.catalog.operations);
      for (const dimension of data.dimensions) {
        await scene(`evidence-${dimension}`);
        assert.equal(
          await page.locator(`[data-dimension="${dimension}"]`).getAttribute("open"),
          "",
        );
        const summary = page.locator(`[data-dimension="${dimension}"] summary`);
        await summary.focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await page.locator(`[data-dimension="${dimension}"]`).getAttribute("open"),
          null,
        );
        await page.keyboard.press("Enter");
        assert.ok(
          (await page.locator(`[data-dimension="${dimension}"]`).innerText()).includes("最近结果"),
        );
      }
      await scene("catalog-last");
      assert.equal((await state()).selected, data.datasets.current.operations.at(-1).operation_id);
      assert.ok(
        (await page.locator("#operation-detail").innerText()).includes(
          data.datasets.current.operations.at(-1).path,
        ),
      );
      await page.locator("[data-operation]").first().click();
      assert.equal(
        await page.locator("#operation-detail").evaluate((n) => n === document.activeElement),
        true,
      );
      for (const label of [
        "运行结果",
        "记录角色",
        "预期允许角色",
        "所需能力",
        "数据来源",
        "UI消费方",
        "爬虫副作用",
        "HTTP响应",
      ])
        assert.ok((await page.locator("#operation-detail").innerText()).includes(label));
      await scene("limit-300");
      assert.equal(await page.locator("[data-operation]").count(), 300);
      assert.equal((await state()).data.total_filtered, 301);
      if (width === 390) await page.locator("#mobile-filter").click();
      await page.locator(width === 390 ? "#m-query" : "#query").fill("/synthetic/300");
      await page.locator(width === 390 ? "#m-apply" : "#apply").click();
      await done();
      assert.equal((await state()).data.operations.length, 1);
      assert.equal((await state()).data.operations[0].path, "/synthetic/300");
      for (const key of ["loading", "forbidden", "expired", "rate_limited", "blocked", "error"]) {
        await scene(key);
        assert.equal(await page.locator(".facts,.report-banner").count(), 0);
        await page.locator("#retry").click();
        await done("error");
        assert.equal(await page.locator(".facts,.report-banner").count(), 0);
      }
      await scene("original");
      assert.deepEqual((await state()).data, data.datasets.original);
      await scene("default");
      assert.equal((await state()).data.summary.verified, 5);
      assert.ok(
        await page.locator(".pill.empty").evaluate((n) => n.getBoundingClientRect().height < 40),
      );
      assert.equal(
        (await state()).data.by_role.reduce((n, r) => n + r.verified, 0),
        6,
      );
      await scene("filter-open");
      await page.locator("#m-query").fill("draft-kept");
      await page.locator("#close").focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.locator("#m-reset").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#close").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal((await state()).query, "draft-kept");
      assert.equal((await state()).reads.length, 0);
      assert.equal(
        await page
          .locator(width === 390 ? "#mobile-filter" : "#query")
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await scene("filter-open");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of ["operations", "long", "filter-open"]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("operations");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      await page.evaluate(() => (document.documentElement.style.zoom = ""));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push(
        `${width}: all catalog entries, three local sections, nine source-backed searches, five UI outcomes, unchanged whole-catalog summaries, draft/reset/read-error/stale-ID ownership, five evidence keyboard toggles and complete fields, last operation, 301/300 narrowing, six first-load states, original fixture, 5 overall versus 6 role records, modal focus/trap/Escape/backdrop/draft retention, six breakpoints and CSS zoom2; no network or storage.`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  if (capture) {
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          proposal: "API-COVERAGE-C-r1",
          sourceHashes,
          contractRebind: rebind,
          sourceChecks: data.sourceChecks,
          checks,
          httpRequests: 0,
          errors,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const file = path.join(root, "README.md"),
      readme = await readFile(file, "utf8");
    const gallery =
      `正式PNG：${screenshots.length}张；${Object.keys(scenes).length}场景。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
      Object.entries(scenes)
        .map(
          ([key, label]) =>
            `| ${label} (${key}) | ` +
            [1440, 390]
              .map((width) =>
                screenshots
                  .filter((p) => p.scene === key && p.width === width)
                  .map((p) => `[${p.file.includes("-part") ? "续图" : "主图"}](${p.file})`)
                  .join(" · "),
              )
              .join(" | ") +
            " |",
        )
        .join("\n");
    await writeFile(
      file,
      readme.replace(
        /<!-- GALLERY:START -->[\s\S]*?<!-- GALLERY:END -->/,
        `<!-- GALLERY:START -->\n${gallery}\n<!-- GALLERY:END -->`,
      ),
    );
  }
  assert.deepEqual(
    (await readdir(root)).sort(),
    [
      ...expected,
      "index.html",
      "coverage.css",
      "coverage.js",
      "data.js",
      "source-logic.js",
      "README.md",
      "evidence.json",
    ].sort(),
  );
  const links = [
    ...(await readFile(path.join(root, "README.md"), "utf8")).matchAll(/\]\(([^)]+)\)/g),
  ];
  for (const [, link] of links) await readFile(path.resolve(root, link));
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      scenes: Object.keys(scenes).length,
      sourceChecks: data.sourceChecks.length,
      contractSources: contracts.length,
      checks,
      httpRequests: requests.length,
      errors,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
