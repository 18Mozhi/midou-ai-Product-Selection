import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildContentDesignData } from "./lib/ui-phase2-content-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/content-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildContentDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.CONTENT_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const f = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(f)), parser: "babel" });
  if (capture) await writeFile(f, formatted);
  else assert.equal(lf(await readFile(f, "utf8")), formatted);
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
assert.equal(contracts.length, 16);
const proposalRevision = "05a5152fee9ce562579d5470de019c0fbce4bcb9";
const implementationHashes = new Map([
  [
    "apps/web/src/components/use-platform-content-list.ts",
    "ff5e74901f493bfcdd9d2022e9f400382038cda38e63f2f75284b9a6d1837535",
  ],
  [
    "apps/web/src/components/use-platform-content-review.ts",
    "04a83f402bc5b98ede50e7b7ac2d05da0580d47aee638b04915917993d1436e6",
  ],
  [
    "apps/web/src/components/PlatformManagementCenter.vue",
    "ea3e1f7fa4bbbc4a81076062e8e8e7e62d1aefb3ba1c83a854af7b6611287d33",
  ],
  [
    "apps/web/src/components/PlatformManagementFilter.vue",
    "57c7c240443c3ac0d269ae7264f8440a37a00618a4991c54d4273223fc380f98",
  ],
  [
    "apps/web/src/components/PlatformManagementRecordList.vue",
    "46b8b786a5aa6edbd2adc7c835a8e4d9a00257ff363b1888f77b5d4bb45f98ad",
  ],
  [
    "apps/web/src/components/PlatformContentPagination.vue",
    "2a96546fb88ebc4eacf279b868d620e27c550c990ab6ef129c60803f69c7d244",
  ],
  [
    "apps/web/src/components/ResponsiveDataView.vue",
    "6d3088d1c82d962e748dec1b68ae9b4dd5eeff6895fa3e42ba84c6f59a01f8ac",
  ],
  [
    "apps/web/src/components/ResponsiveFilterDrawer.vue",
    "a988f05a2e8a881f78ec39d1c745a8e2e8c9ca4762d1f90fc493556f10468483",
  ],
  [
    "apps/web/src/use-modal-dialog.ts",
    "5f3488e444f30c86d9f7e7424cc0f5463118fac0d3e78422251167dbd571b2fc",
  ],
  [
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "cfddcb4b6223f3b46c31ba90f2e4412dfc6042961565972b4a42059bd494a035",
  ],
]);
const contractRebindings = [...implementationHashes].map(([file, current]) => ({
  file,
  proposalRevision,
  current,
  reason: "P56 current Vue implementation; historical proposal contract retained.",
}));
for (const [, f, h] of contracts) {
  const proposalHash = hash(
    lf(execFileSync("git", ["show", `${proposalRevision}:${f}`], { cwd: repo, encoding: "utf8" })),
  );
  if (f === "tests/e2e/m06-02-platform-dashboard.spec.ts") {
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `ff46bfe9c620a422d95cab9689489b07fb6b95ea^:${f}`], {
            cwd: repo,
            encoding: "utf8",
          }),
        ),
      ),
      h,
    );
    assert.equal(proposalHash, "7d0f9118b740aa7844bd63796e5cf5ede3ebefda1f88d58419257b962e68cd58");
  } else assert.equal(proposalHash, h, `${f} proposal`);
  assert.equal(
    hash(lf(await readFile(path.join(repo, f), "utf8"))),
    implementationHashes.get(f) ?? h,
    f,
  );
}
const sourcePaths = [
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
  ...data.sourcePaths,
  "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c/quality.css",
  "scripts/lib/ui-phase2-content-design-data.mjs",
  "scripts/verify-ui-phase2-content-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "content.css", "content.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const historicalProposalSources = new Set([
  ...data.sourcePaths.slice(0, 11),
  data.sourcePaths.at(-1),
]);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [
      f,
      hash(
        lf(
          historicalProposalSources.has(f)
            ? execFileSync("git", ["show", `${proposalRevision}:${f}`], {
                cwd: repo,
                encoding: "utf8",
              })
            : await readFile(path.join(repo, f), "utf8"),
        ),
      ),
    ]),
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
    label + " overflow",
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
      label + " dialog",
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
      scenes = await page.evaluate(() => window.CONTENT_C.scenes);
      const scene = (key) => page.evaluate((k) => window.CONTENT_C.scene(k), key),
        state = () => page.evaluate(() => window.CONTENT_C.state()),
        complete = (outcome) => page.evaluate((v) => window.CONTENT_C.complete(v), outcome);
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
        if (key === "hover" || key === "pressed") await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, `${width}/${key}`);
        await shot(key);
        if (key === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        if (await page.locator("dialog[open]").count()) {
          const d = page.locator("dialog[open]");
          let part = 0;
          while (await d.evaluate((n) => n.scrollTop + n.clientHeight < n.scrollHeight - 2)) {
            const before = await d.evaluate((n) => n.scrollTop);
            await d.evaluate((n) => (n.scrollTop += Math.floor(n.clientHeight * 0.8)));
            assert.ok((await d.evaluate((n) => n.scrollTop)) > before);
            await shot(key, `-part${++part}`);
          }
        }
      }

      await scene("default");
      assert.equal((await state()).data.items[0].id, data.original.items[0].id);
      assert.equal(await page.locator("table th").count(), 7);
      await scene("empty");
      assert.equal((await state()).data.summary.total, 0);
      await scene("filter-active");
      await page.locator("#open-filter").click();
      assert.equal(await page.locator("#status").inputValue(), "active");
      await scene("default");
      await page.locator("#open-filter").click();
      assert.equal(await page.locator("#status option").count(), 5);
      assert.equal(await page.locator("#query").getAttribute("maxlength"), "120");
      await page.locator("#query").fill(" 照明 ");
      await page.locator("#status").selectOption("archived");
      await page.locator("#cancel").click();
      assert.equal((await state()).query, "");
      await page.locator("#open-filter").click();
      assert.equal(await page.locator("#query").inputValue(), " 照明 ");
      await page.locator("#apply").click();
      assert.equal((await state()).pending.status, "archived");
      assert.equal((await state()).snapshot.status, "");
      await page.locator("#open-filter").click();
      assert.ok(await page.locator("#apply").isDisabled());
      await page.locator("#query").fill("尚未提交的新搜索");
      await page.locator("#cancel").click();
      assert.equal((await state()).calls.at(-1).method, "GET");
      await complete("empty");
      assert.equal((await state()).snapshot.query, "照明");
      assert.equal((await state()).snapshot.status, "archived");
      assert.equal((await state()).data.pagination.total, 0);
      assert.ok(await page.locator(".scope").count());
      await scene("filter-draft");
      await page.locator("#reset").click();
      assert.equal((await state()).query, "");
      await complete("success");
      await scene("page-first");
      assert.equal((await state()).data.items.length, 20);
      await page.locator("#next").click();
      assert.equal((await state()).data.pagination.page, 1);
      await complete("error");
      assert.equal((await state()).data.pagination.page, 1);
      await page.locator("#next").click();
      await complete("success");
      assert.equal((await state()).data.pagination.page, 2);
      assert.equal((await state()).data.items.length, 1);
      for (const key of [
        "detail",
        "technical",
        "filter-draft",
        "settings",
        "review-stale",
        "source-boundary",
      ]) {
        await scene(key);
        assert.ok(
          await page.evaluate(() =>
            document.querySelector("#modal").contains(document.activeElement),
          ),
        );
        const f = page
          .locator(
            "#modal button:not(:disabled),#modal input,#modal select,#modal textarea,#modal summary",
          )
          .filter({ visible: true });
        await f.last().focus();
        await page.keyboard.press("Tab");
        assert.ok(await f.first().evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Shift+Tab");
        assert.ok(await f.last().evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.ok(await page.evaluate(() => document.activeElement !== document.body));
      }
      for (const status of ["active", "irrelevant", "stale"]) {
        await scene("review-" + status);
        assert.equal(await page.locator("#target option").count(), 3);
        assert.equal(await page.locator("#target").inputValue(), status);
        assert.equal(await page.locator("#reason").getAttribute("maxlength"), "300");
        await page.locator("#reason").fill(" 审核 ");
        await page.locator("#submit").click();
        await page.evaluate(() => window.CONTENT_C.submit());
        const v = await state();
        assert.equal(v.calls.filter((c) => c.method === "PATCH").length, 1);
        assert.deepEqual(v.calls.at(-1).body, { status, expected_version: 1, reason: "审核" });
        assert.ok(await page.locator("#submit").isDisabled());
        await page.evaluate(() => window.CONTENT_C.finishWrite("error"));
        assert.equal(await page.locator("#reason").inputValue(), " 审核 ");
        assert.ok((await page.locator("#modal").innerText()).includes("审核失败"));
      }
      for (const key of [
        "reason-empty",
        "reason-one",
        "reason-spaces",
        "reason-over",
        "review-conflict",
        "review-unknown",
      ]) {
        await scene(key);
        assert.ok(await page.locator("#submit").isDisabled(), key);
      }
      for (const key of ["reason-min", "reason-max", "same-status"]) {
        await scene(key);
        assert.ok(await page.locator("#submit").isEnabled(), key);
      }
      await scene("same-status");
      await page.locator("#submit").click();
      assert.equal((await state()).calls.at(-1).body.status, "active");
      await scene("success-refresh-error");
      assert.equal((await state()).data.items[0].status, "active");
      assert.ok((await state()).message.includes("列表刷新失败"));
      await scene("review-success");
      assert.equal((await state()).data.summary.active, 89);
      assert.equal((await state()).data.summary.stale, 20);
      await scene("new-review-old-result");
      assert.ok((await page.locator("#modal").innerText()).includes("另一条合成内容"));
      assert.equal(await page.locator("#reason").inputValue(), "新审核草稿");
      await scene("closed-pending");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.ok((await state()).write);
      await page.evaluate(() => window.CONTENT_C.finishWrite("success"));
      assert.ok((await state()).message.includes("模拟写入"));
      await scene("cancelled");
      assert.equal((await state()).calls.length, 0);
      await scene("archived-detail");
      assert.equal(await page.locator("#modal [data-target]").count(), 3);
      await page.locator('[data-target="stale"]').click();
      assert.equal(await page.locator("#target").inputValue(), "stale");
      await scene("settings");
      for (let i = 0; i < 6; i++) await page.locator("[data-column]").nth(i).uncheck();
      await page.locator("[data-column]").last().click();
      assert.equal((await state()).columns.filter(Boolean).length, 1);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of [
          "default",
          "long-detail",
          "review-stale",
          "reason-max",
          "filter-draft",
          "settings",
        ]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("long-detail");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: four read/three write states, draft/apply/reset, original versus synthetic pagination, six modal focus loops/return, seven-column minimum, reason boundaries, same-status allowed, single-flight and frozen payload, conflict/unknown, separate write/refresh outcomes, closed and newer-dialog ownership; six breakpoints/CSS zoom2; offline only.`,
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
          proposal: "CONTENT-C-r1",
          contractRebindings,
          sourceHashes,
          sourceChecks: data.sourceChecks,
          checks,
          errors,
          httpRequests: 0,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const f = path.join(root, "README.md"),
      text = await readFile(f, "utf8");
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
                  .map(
                    (p) =>
                      `[${p.file.match(/-part(\d+)\.png$/)?.[1] ? "局部" + p.file.match(/-part(\d+)\.png$/)[1] : "主图"}](${p.file})`,
                  )
                  .join(" · "),
              )
              .join(" | ") +
            " |",
        )
        .join("\n");
    await writeFile(
      f,
      text.replace(
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
      "content.css",
      "content.js",
      "data.js",
      "source-logic.js",
      "README.md",
      "evidence.json",
      "vue-implementation",
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
      checks,
      sourceChecks: data.sourceChecks.length,
      contractSources: contracts.length,
      httpRequests: requests.length,
      errors,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
