import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildDataRecordsDesignData } from "./lib/ui-phase2-data-records-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/data-records-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildDataRecordsDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.DATA_RECORDS_DATA=${JSON.stringify(data)};`],
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
  assert.equal(
    hash(lf(await readFile(path.join(repo, f), "utf8"))),
    responsiveFocusContractHash(f, binding?.current ?? h),
    f,
  );
}
const sourcePaths = [
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-data-records-design-data.mjs",
  "scripts/verify-ui-phase2-data-records-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/credential-assets-direction-c/credentials.css",
  ...["index.html", "records.css", "records.js", "data.js", "source-logic.js"].map(
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
      scenes = await page.evaluate(() => window.DATA_RECORDS_C.scenes);
      const scene = (key) => page.evaluate((k) => window.DATA_RECORDS_C.scene(k), key),
        state = () => page.evaluate(() => window.DATA_RECORDS_C.state()),
        complete = (outcome) => page.evaluate((v) => window.DATA_RECORDS_C.complete(v), outcome);
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
        if (key === "hover" || key === "pressed") await page.locator("#export-open").hover();
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

      const filter = async () => {
        if (width === 390) await page.locator("#open-filter").click();
      };
      await scene("default");
      assert.equal((await state()).snapshot.items[0].id, data.originals.trends.items[0].id);
      await page.locator('[data-entity="suppliers"]').click();
      assert.ok(await page.locator("#export-open").isDisabled());
      assert.ok((await page.locator("#snapshot-scope").innerText()).includes("热点"));
      await complete("error");
      assert.ok(await page.locator("#export-open").isDisabled());
      await filter();
      await page.locator("#apply").click();
      await complete("success");
      assert.equal((await state()).scope.entity, "suppliers");
      assert.equal(await page.locator("#export-open").isDisabled(), false);
      await filter();
      await page.locator("#query").fill(" 隔离 ");
      await page.locator("#status").selectOption("ready");
      await page.locator("#apply").click();
      assert.equal(await page.evaluate(() => window.DATA_RECORDS_C.read()), false);
      const q = new URLSearchParams((await state()).intents.at(-1).path.split("?")[1]);
      assert.equal(q.get("domain"), "data");
      assert.equal(q.get("entity"), "suppliers");
      assert.equal(q.get("query"), "隔离");
      assert.equal(q.get("status"), "ready");
      assert.equal(q.has("page"), false);
      await complete("success");
      assert.equal((await state()).snapshot.items.length, 1);
      await filter();
      await page.locator("#reset").click();
      await complete("success");
      assert.equal((await state()).query, "");
      await scene("page-21");
      assert.equal((await state()).snapshot.items.length, 21);
      const rows = () =>
        width === 390 ? page.locator(".record-cards>button") : page.locator("tbody tr");
      assert.equal(await rows().count(), 20);
      await page.locator("#next").click();
      assert.equal(await rows().count(), 1);
      assert.equal((await state()).intents.length, 0);
      assert.ok(page.url().includes("page=2"));
      await page.locator("#export-open").click();
      assert.ok((await page.locator(".scope-box").innerText()).includes("不限当前第2页"));
      assert.equal(await page.locator('#export-dialog input[type="checkbox"]').count(), 0);
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.id), "export-open");
      assert.equal((await state()).intents.length, 0);
      for (const key of ["detail", "long-detail", "filter", "export-empty", "export"]) {
        await scene(key);
        if (key.startsWith("export"))
          assert.equal(await page.evaluate(() => document.activeElement.id), "reason");
        for (const direction of ["Tab", "Shift+Tab"])
          for (let i = 0; i < 15; i++) {
            await page.keyboard.press(direction);
            assert.ok(
              await page
                .locator("dialog[open]")
                .evaluate((n) => n.contains(document.activeElement)),
            );
          }
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      await scene("default");
      const trigger = width === 390 ? "mobile-record-0" : "record-0";
      await page.locator("#" + trigger).click();
      await page.locator("#record-tech summary").click();
      assert.ok((await page.locator("#record-tech").innerText()).includes("trend-54"));
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.id), trigger);
      for (const length of [0, 1, 2, 300, 301]) {
        await scene("export");
        await page.locator("#reason").fill("字".repeat(length));
        assert.equal(await page.locator("#export-submit").isDisabled(), length < 2 || length > 300);
      }
      for (const outcome of ["success", "error", "unknown"]) {
        await scene("export");
        assert.equal(
          await page.evaluate(() => window.DATA_RECORDS_C.changeEntity("suppliers")),
          false,
        );
        await page.locator("#reason").fill("  固定导出原因  ");
        await page.locator("#export-submit").click();
        assert.equal(await page.evaluate(() => window.DATA_RECORDS_C.submitExport()), false);
        assert.ok(await page.locator('[data-entity="suppliers"]').isDisabled());
        assert.deepEqual((await state()).intents[0], {
          method: "POST",
          path: "/platform/management/data/exports",
          body: { entity: "trends", query: "", status: "", reason: "固定导出原因" },
          accept: "text/csv",
        });
        await complete(outcome);
        if (outcome === "success")
          assert.equal((await state()).intents.at(-1).filename, "platform-trends-2026-09-09.csv");
        if (outcome === "unknown") {
          assert.ok(await page.locator("#export-open").isDisabled());
          assert.equal(await page.evaluate(() => window.DATA_RECORDS_C.read()), false);
        }
      }
      await scene("export-running");
      const stale = (await state()).pending.id;
      await scene("default");
      assert.equal(
        await page.evaluate((id) => window.DATA_RECORDS_C.complete("success", id), stale),
        false,
      );
      assert.equal((await state()).writeNotice, "");
      await scene("technical");
      await page.locator("#copy-request").click();
      assert.ok((await state()).copyNotice.includes("未写系统剪贴板"));
      await scene("copy-failed");
      await page.locator("#copy-request").click();
      assert.ok((await state()).copyNotice.includes("被拒绝"));
      await scene("default");
      await page.locator("#view-quality").click();
      assert.ok(await page.locator("#quality-handoff").isVisible());
      assert.equal((await state()).intents.at(-1).path, "/platform-admin/data?view=quality");
      await page.locator("#back-records").click();
      assert.equal((await state()).handoff, false);
      await scene("query-max");
      await filter();
      assert.equal(await page.locator("#query").getAttribute("maxlength"), "120");
      await page.locator("#apply").click();
      assert.equal(
        new URLSearchParams((await state()).intents[0].path.split("?")[1]).get("query").length,
        120,
      );
      if (width === 1440) {
        await scene("default");
        await page.locator("#columns summary").click();
        for (let i = 0; i < 6; i++) await page.locator('[data-column="' + i + '"]').uncheck();
        assert.ok(await page.locator('[data-column="6"]').isDisabled());
        assert.equal(await page.locator("thead th").count(), 1);
        await page.locator("#freeze").click();
        assert.equal((await state()).freeze, false);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
      }
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of ["default", "long-detail", "export-max", "filter"]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("export-max");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: ${Object.keys(scenes).length} scenes; exact four-entity query intent and old-snapshot scope, local 20/1 pagination without GET, full query export versus page, 0/1/2/300/301 reasons, frozen export scope/file name, single-flight, unknown and stale generation, three named focus-contained dialogs, technical copy simulation, quality handoff explicitly pending, table settings and six breakpoints/CSS zoom2. Static recent-records prototype only.`,
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
          proposal: "DATA-RECORDS-C-r1",
          contractRebindings,
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
      "records.css",
      "records.js",
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
      sourceChecks: data.checks.length,
      contractSources: contracts.length,
      httpRequests: requests.length,
      errors,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
