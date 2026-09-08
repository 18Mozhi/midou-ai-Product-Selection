import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildDataQualityDesignData } from "./lib/ui-phase2-data-quality-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildDataQualityDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.DATA_QUALITY_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const f = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(f)), parser: "babel" });
  if (capture) await writeFile(f, formatted);
  else assert.equal(lf(await readFile(f, "utf8")), formatted);
}
const contract = await readFile(
  path.join(repo, "design-plans/ui-phase-2-2026-09-07/data-governance-contract-review.md"),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)];
assert.equal(contracts.length, 25);
const contractRebindings = [
  {
    file: "tests/e2e/m06-02-platform-dashboard.spec.ts",
    old: "dc949ced1becd59f1e0c7bf98b9fe0ab126e5b59744cb197d70c65ec861bbc66",
    current: "7d0f9118b740aa7844bd63796e5cf5ede3ebefda1f88d58419257b962e68cd58",
    commit: "ff46bfe9c620a422d95cab9689489b07fb6b95ea",
    reason: "Audited reason dialog focus-test additions; historical table retained.",
  },
];
for (const [, f, h] of contracts) {
  const binding = contractRebindings.find((v) => v.file === f);
  if (binding) {
    assert.equal(h, binding.old);
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `${binding.commit}^:${f}`], { cwd: repo, encoding: "utf8" }),
        ),
      ),
      binding.old,
    );
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `${binding.commit}:${f}`], { cwd: repo, encoding: "utf8" }),
        ),
      ),
      binding.current,
    );
  }
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), binding?.current ?? h, f);
}
const sourcePaths = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-data-quality-design-data.mjs",
  "scripts/verify-ui-phase2-data-quality-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "quality.css", "quality.js", "data.js", "source-logic.js"].map(
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
      scenes = await page.evaluate(() => window.DATA_QUALITY_C.scenes);
      const scene = (key) => page.evaluate((k) => window.DATA_QUALITY_C.scene(k), key),
        state = () => page.evaluate(() => window.DATA_QUALITY_C.state()),
        complete = (outcome) => page.evaluate((v) => window.DATA_QUALITY_C.complete(v), outcome);
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
      assert.ok((await page.locator("main").innerText()).includes("暂无核对数据"));
      await page.locator("#search").fill(" title ");
      assert.ok((await page.locator(".workspace").innerText()).includes("没有匹配"));
      await page.locator("#clear-search").click();
      await page.locator('[data-tab="issues"]').click();
      const checkbox = page
        .locator(width === 390 ? ".mobile [data-select]" : ".desktop [data-select]")
        .first();
      await checkbox.check();
      await page.locator("#search").fill("not-matched");
      assert.equal((await state()).selected.length, 1);
      await page.locator("#batch").click();
      assert.ok((await page.locator("#modal").innerText()).includes(data.originals.issue.id));
      await page.locator("#reason").fill("有效原因");
      await page.locator("#preview").click();
      assert.ok(await page.locator("#submit").isDisabled());
      await page.locator("#phrase").fill("确认处理");
      assert.equal(await page.locator("#submit").isDisabled(), false);
      await page.locator("#submit").click();
      assert.equal((await state()).writes.length, 1);
      assert.deepEqual((await state()).writes[0].body.items, [
        { id: data.originals.issue.id, expected_version: 1 },
      ]);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 1);
      assert.ok(await page.locator("#submit").isDisabled());
      await complete("unknown");
      assert.ok((await page.locator("#modal").innerText()).includes("不自动重发"));
      assert.ok(await page.locator("#submit").isDisabled());
      await page.locator("#cancel").click();
      for (const key of [
        "evidence-detail",
        "lineage",
        "issue-detail",
        "resolve-empty",
        "resolve-confirm",
        "batch-attribute",
        "batch-confirm",
        "download-ready",
        "settings",
      ]) {
        await scene(key);
        const focus = await page.evaluate(() =>
          document.querySelector("#modal").contains(document.activeElement),
        );
        assert.ok(focus, key + " initial focus");
        const focusables = page
          .locator(
            "#modal button:not(:disabled),#modal input:not(:disabled),#modal textarea:not(:disabled),#modal select:not(:disabled),#modal summary",
          )
          .filter({ visible: true });
        await focusables.last().focus();
        await page.keyboard.press("Tab");
        assert.ok(await focusables.first().evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Shift+Tab");
        assert.ok(await focusables.last().evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.ok(await page.evaluate(() => document.activeElement !== document.body));
      }
      for (const length of [0, 1, 2, 500]) {
        await scene("resolve-empty");
        await page.locator("#reason").fill("字".repeat(length));
        assert.equal(await page.locator("#preview").isDisabled(), length < 2);
      }
      assert.equal(await page.locator("#reason").getAttribute("maxlength"), "500");
      await scene("resolve-read-failed");
      assert.ok((await page.locator("#modal").innerText()).includes("写入已确认"));
      assert.ok((await page.locator("#modal").innerText()).includes("随后读取失败"));
      assert.ok(await page.locator("#submit").isDisabled());
      await scene("batch-no-member");
      assert.ok(await page.locator("#preview").isDisabled());
      await scene("batch-assign");
      await page.locator("#preview").click();
      await page.locator("#phrase").fill("确认处理");
      await page.locator("#submit").click();
      assert.equal((await state()).writes[0].body.action, "assign");
      assert.ok((await state()).writes[0].body.assignee_membership_id);
      await scene("batch-close");
      await page.locator("#preview").click();
      await page.locator("#phrase").fill("确认处理");
      await page.locator("#submit").click();
      assert.equal((await state()).writes[0].body.action, "close");
      assert.equal((await state()).writes[0].body.assignee_membership_id, null);
      await scene("download-busy");
      assert.equal((await state()).downloads, 1);
      await complete("success");
      assert.ok(
        (await page.locator("#modal").innerText()).includes("实际下载、字节数及 SHA-256 均未验证"),
      );
      await scene("page-wait");
      assert.equal((await state()).page, 1);
      await complete("error");
      assert.equal((await state()).page, 1);
      await scene("page-first");
      await page.locator("#next").click();
      await complete("success");
      assert.equal((await state()).page, 2);
      assert.equal((await state()).data.evidence.length, 1);
      await scene("lineage-loading");
      const oldToken = await page.evaluate(() => window.DATA_QUALITY_C.token());
      await page.locator("#cancel").click();
      await page.evaluate((t) => window.DATA_QUALITY_C.detailComplete(t, "ready"), oldToken);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await scene("settings");
      await page.locator("#compact").check();
      assert.equal((await state()).compact, true);
      const cols = page.locator("[data-column]");
      for (let i = 0; i < 4; i++) await cols.nth(i).uncheck();
      await cols.last().click();
      assert.equal((await state()).columns.filter(Boolean).length, 1);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of [
          "default",
          "long-lineage",
          "resolve-limit",
          "batch-confirm",
          "settings",
        ]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("resolve-limit");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: three workspaces; local search/hidden selection; typed-only single/batch confirmation; 0/1/2/500 reason; three batch actions; single-flight/unknown/independent reload results; download intent only; retained pagination; late detail rejection; nine focus-contained modal variants; column minimum; six breakpoints and CSS zoom2. Static prototype, not Vue/API/SQL validation.`,
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
          proposal: "DATA-QUALITY-C-r1",
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
      "quality.css",
      "quality.js",
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
