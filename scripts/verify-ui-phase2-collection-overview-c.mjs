import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildOverviewData } from "./lib/ui-phase2-collection-overview-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/collection-overview-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const { data, logic } = await buildOverviewData(repo);
for (const [name, content] of [
  ["data.js", `window.OVERVIEW_C_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const f = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(f)), parser: "babel" });
  if (capture) await writeFile(f, formatted);
  else assert.equal((await readFile(f, "utf8")).replaceAll("\r\n", "\n"), formatted);
}
const contract = await readFile(
  path.join(repo, "design-plans/ui-phase-2-2026-09-07/collection-runtime-contract-review.md"),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)];
assert.equal(contracts.length, 31);
for (const [, f, h] of contracts)
  assert.equal(
    hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    responsiveFocusContractHash(f, h),
    f,
  );
const sources = [
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-collection-overview-design-data.mjs",
  "scripts/verify-ui-phase2-collection-overview-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/credential-assets-direction-c/credentials.css",
  ...["index.html", "overview.css", "overview.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let prior;
if (!capture) {
  prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(prior.sourceHashes, sourceHashes);
  for (const p of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, p.file))), p.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  requests = [];
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " document overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  for (const d of await page.locator("dialog[open]").all()) {
    assert.ok(
      await d.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      label + " dialog overflow",
    );
    assert.equal(
      await d.evaluate(
        (n) =>
          Boolean(document.getElementById(n.getAttribute("aria-labelledby"))) &&
          Boolean(document.getElementById(n.getAttribute("aria-describedby"))),
      ),
      true,
    );
  }
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
      const scenes = await page.evaluate(() => window.OVERVIEW_C.scenes);
      const scene = async (key) => {
        await page.evaluate((k) => window.OVERVIEW_C.scene(k), key);
      };
      const state = () => page.evaluate(() => window.OVERVIEW_C.state());
      const complete = (outcome) => page.evaluate((v) => window.OVERVIEW_C.complete(v), outcome);
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
        if (key === "hover") await page.locator("#refresh").hover();
        if (key === "pressed") {
          await page.locator("#refresh").hover();
          await page.mouse.down();
        }
        await layout(page, key);
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
      assert.equal((await state()).data.task_states[0].total, 2);
      assert.equal((await state()).data.quality[0].total, 3);
      if (width === 390) await page.locator("#open-scope").click();
      await page.locator("#org").fill("bad");
      await page.locator("#apply").click();
      assert.equal((await state()).intents.length, 0);
      assert.ok(await page.locator("#scope-error").isVisible());
      if (width === 390) assert.ok(await page.locator("#scope-dialog").isVisible());
      await page.locator("#org").fill(" " + data.original.dead_letters[0].organization_id + " ");
      await page.locator("#workspace").fill(data.original.dead_letters[0].workspace_id);
      await page.locator("#provider").selectOption(data.original.sources[0].id);
      await page.locator("#window").selectOption("7d");
      await page.locator("#apply").click();
      assert.equal((await state()).intents.length, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      const q = new URLSearchParams((await state()).intents[0].path.split("?")[1]);
      assert.equal(q.get("window"), "7d");
      assert.equal(q.get("organization_id"), data.original.dead_letters[0].organization_id);
      assert.equal(q.get("attempt_page"), "1");
      assert.equal(await page.evaluate(() => window.OVERVIEW_C.read()), false);
      await complete("success");
      assert.ok(page.url().includes("window=7d"));
      await page.locator("#root-0").click();
      assert.equal(
        new URLSearchParams((await state()).intents.at(-1).path.split("?")[1]).get("error_code"),
        "parser_failed",
      );
      await complete("success");
      assert.equal(await page.locator("#root-0").getAttribute("aria-pressed"), "true");
      await page.locator("#clear-root").click();
      await complete("success");
      assert.equal((await state()).error, "");
      for (const key of ["source-0", "source-8", "source-9", "source-14"]) {
        await scene(key);
        const count = Number(key.split("-")[1]);
        const rows =
          width === 390
            ? page.locator("#sources .records-mobile button")
            : page.locator("#sources-table tbody tr");
        assert.equal(await rows.count(), Math.min(count, 8));
        if (count > 8) {
          await page.locator("#expand-sources").click();
          assert.equal(await rows.count(), count);
          await page.locator("#expand-sources").click();
          assert.equal(await rows.count(), 8);
        }
      }
      await scene("paged");
      await page.locator('[data-page="attempts:1"]').click();
      assert.equal((await state()).ap, 2);
      assert.equal((await state()).dp, 1);
      await complete("success");
      await page.locator('[data-page="dead_letters:1"]').click();
      assert.equal((await state()).ap, 2);
      assert.equal((await state()).dp, 2);
      await complete("error");
      assert.ok((await state()).readNotice);
      assert.equal((await state()).data.pagination.dead_letters.page, 1);
      await scene("selection-limit");
      await page.locator("#choose-20").click();
      assert.equal((await state()).selected.length, 20);
      assert.equal(await page.locator("#choose-20").isChecked(), false);
      await scene("dead-closed");
      await page.locator("#batch-panel summary").click();
      assert.ok(await page.locator("#choose-0").isDisabled());
      for (const key of ["scope", "source-detail", "attempt-detail", "confirm"]) {
        await scene(key);
        const d = page.locator("dialog[open]");
        for (const direction of ["Tab", "Shift+Tab"])
          for (let i = 0; i < 20; i++) {
            await page.keyboard.press(direction);
            assert.equal(
              await d.evaluate((n) => n.contains(document.activeElement)),
              true,
              key + " focus escape",
            );
          }
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      if (width === 390) {
        await scene("default");
        await page.locator("#source-record-0").click();
        await page.locator("#record-tech summary").click();
        assert.ok((await page.locator("#record-dialog").innerText()).includes("news"));
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => document.activeElement.id), "source-record-0");
        await page.locator("#attempt-record-0").click();
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => document.activeElement.id), "attempt-record-0");
      }
      for (const outcome of ["success", "error", "unknown"]) {
        await scene("batch-selected");
        await page.locator("#reason").fill("  固定恢复原因  ");
        await page.locator("#preview").click();
        assert.ok(await page.locator("#confirm-batch").isDisabled());
        assert.equal(
          await page.locator("#confirm-batch").evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgb(237, 241, 246)",
        );
        await page.locator("#typed").fill("确认重放");
        assert.ok(await page.locator("#confirm-batch").isDisabled());
        await page.locator("#ack").check();
        assert.equal(await page.locator("#confirm-batch").isDisabled(), false);
        await page.locator("#confirm-batch").click();
        assert.equal(await page.evaluate(() => window.OVERVIEW_C.submitBatch()), false);
        assert.ok(await page.locator("#reason").isDisabled());
        const first = (await state()).intents.filter((v) => v.method === "POST");
        assert.equal(first.length, 1);
        assert.equal(first[0].body.reason, "固定恢复原因");
        await complete("success");
        const posts = (await state()).intents.filter((v) => v.method === "POST");
        assert.equal(posts.length, 2);
        assert.equal(posts[1].body.reason, "固定恢复原因");
        assert.equal(new Set(posts.map((v) => v.idempotencyKey)).size, 2);
        assert.equal(
          posts[1].path,
          `/platform/collection/tasks/${data.batch.dead_letters[1].task_id}/replay`,
        );
        await complete(outcome);
        assert.equal((await state()).pending.kind, "read");
        await complete("error");
        assert.ok((await state()).batchNotice);
        assert.ok((await state()).readNotice);
        assert.equal((await state()).selected.length, outcome === "success" ? 0 : 1);
        if (outcome === "unknown") assert.ok(await page.locator("#preview").isDisabled());
      }
      await scene("batch-running");
      const stale = (await state()).pending.id;
      await scene("default");
      assert.equal(
        await page.evaluate((id) => window.OVERVIEW_C.complete("success", id), stale),
        false,
      );
      assert.equal((await state()).batchNotice, "");
      await scene("refresh-error");
      for (const [key, target] of Object.entries(data.original.links)) {
        await page.locator(`.management-links a[href="${target}"]`).click();
        assert.equal((await state()).intents.at(-1).path, target);
      }
      if (width === 1440)
        for (const [kind, count] of [
          ["sources", 6],
          ["attempts", 5],
        ]) {
          await scene("default");
          await page.locator(`#columns-${kind} summary`).click();
          for (let i = 0; i < count - 1; i++)
            await page.locator(`[data-column="${kind}:${i}"]`).uncheck();
          assert.ok(await page.locator(`[data-column="${kind}:${count - 1}"]`).isDisabled());
          await page.locator(`[data-freeze="${kind}"]`).click();
          assert.equal((await state()).tables[kind].freeze, false);
          await page.locator(`[data-density="${kind}"]`).selectOption("compact");
          assert.equal((await state()).tables[kind].density, "compact");
        }
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of ["default", "long-content", "confirm-typed", "scope-filled"]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("confirm-typed");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: ${Object.keys(scenes).length} scenes; original facts, exact scope/error/page intent, four modal variants, invalid filter retention, keyboard/focus, 20-item boundary, typed acknowledgement, serial frozen reason/targets, independent keys, partial/unknown/read outcomes, stale generation rejection, six links, two tables and six breakpoints/CSS zoom2. Static prototype only.`,
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
          proposal: "COLLECTION-OVERVIEW-C-r1",
          sourceHashes,
          sourceChecks: data.checks,
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
      `正式PNG：${screenshots.length}张。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
      Object.keys(
        await (async () => {
          const c = await browser.newContext();
          try {
            const p = await c.newPage();
            await p.goto(pathToFileURL(path.join(root, "index.html")).href);
            return await p.evaluate(() => window.OVERVIEW_C.scenes);
          } finally {
            await c.close();
          }
        })(),
      )
        .map(
          (key) =>
            `| ${key} | ${screenshots
              .filter((p) => p.scene === key && p.width === 1440)
              .map(
                (p) =>
                  `[${p.file.match(/-part(\d+)\.png$/)?.[1] ? "局部" + p.file.match(/-part(\d+)\.png$/)[1] : "主图"}](${p.file})`,
              )
              .join(" · ")} | ${screenshots
              .filter((p) => p.scene === key && p.width === 390)
              .map(
                (p) =>
                  `[${p.file.match(/-part(\d+)\.png$/)?.[1] ? "局部" + p.file.match(/-part(\d+)\.png$/)[1] : "主图"}](${p.file})`,
              )
              .join(" · ")} |`,
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
      "overview.css",
      "overview.js",
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
      errors,
      httpRequests: requests.length,
      contractSources: contracts.length,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
