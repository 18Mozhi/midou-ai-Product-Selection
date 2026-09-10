import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildRuntimeDesignData } from "./lib/ui-phase2-browser-runtime-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/browser-runtime-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildRuntimeDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.RUNTIME_C_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const f = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(f)), parser: "babel" });
  if (capture) await writeFile(f, formatted);
  else assert.equal(lf(await readFile(f, "utf8")), formatted);
}
const contract = await readFile(
  path.join(repo, "design-plans/ui-phase-2-2026-09-07/collection-runtime-contract-review.md"),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)];
assert.equal(contracts.length, 31);
for (const [, f, h] of contracts)
  assert.equal(
    hash(lf(await readFile(path.join(repo, f), "utf8"))),
    responsiveFocusContractHash(f, h),
    f,
  );
const sourcePaths = [
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-browser-runtime-design-data.mjs",
  "scripts/verify-ui-phase2-browser-runtime-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/credential-assets-direction-c/credentials.css",
  ...["index.html", "runtime.css", "runtime.js", "data.js", "source-logic.js"].map(
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
      scenes = await page.evaluate(() => window.RUNTIME_C.scenes);
      const scene = (key) => page.evaluate((k) => window.RUNTIME_C.scene(k), key),
        state = () => page.evaluate(() => window.RUNTIME_C.state()),
        complete = (outcome) => page.evaluate((v) => window.RUNTIME_C.complete(v), outcome);
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
      await page.locator("#status").selectOption("blocked");
      await page.locator("#apply").click();
      await complete("error");
      assert.ok(
        (await page.locator(".filter-context").innerText()).includes(
          "当前快照：无关键词 · 全部状态",
        ),
      );
      await scene("loading");
      assert.deepEqual(
        await page.locator("#global-metrics dd").allTextContents(),
        Array(5).fill("—"),
      );
      await scene("default");
      assert.ok(
        (await page.locator("#content").innerText()).includes(
          data.original.profiles[0].lease.lease_owner,
        ),
      );
      await page.locator("#query").fill(" TRACE-SUCCESS ");
      await page.locator("#status").selectOption("succeeded");
      await page.locator("#apply").click();
      assert.ok(await page.locator("#query").isDisabled());
      assert.equal(await page.evaluate(() => window.RUNTIME_C.read()), false);
      let q = new URLSearchParams((await state()).intents[0].path.split("?")[1]);
      assert.equal(q.get("q"), "TRACE-SUCCESS");
      assert.equal(q.get("status"), "succeeded");
      assert.equal(q.get("page"), "1");
      await complete("success");
      assert.equal((await state()).data.runs[0].id, data.original.runs[1].id);
      assert.deepEqual((await state()).data.profiles, data.original.profiles);
      assert.deepEqual((await state()).data.run_metrics, data.original.run_metrics);
      await page.locator("#reset").click();
      await complete("success");
      assert.equal((await state()).data.runs.length, 3);
      await page.locator("#query").fill("market.example.test");
      await page.locator("#apply").click();
      await complete("success");
      assert.equal((await state()).data.runs.length, 0);
      assert.equal((await state()).data.profiles.length, 3);
      await page.locator("#recover-open").click();
      assert.ok((await page.locator("#confirm-dialog").innerText()).includes("不是当前筛选记录"));
      assert.equal(await page.locator('#confirm-dialog input[type="checkbox"]').count(), 0);
      await page.locator("#typed").fill("确认");
      assert.ok(await page.locator("#confirm-submit").isDisabled());
      await page.locator("#typed").fill(" 确认回收 ");
      assert.equal(await page.locator("#confirm-submit").isDisabled(), false);
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.id), "recover-open");
      for (const key of ["confirm", "detail-tech"]) {
        await scene(key);
        for (const direction of ["Tab", "Shift+Tab"])
          for (let i = 0; i < 12; i++) {
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
      for (const k of [
        "id",
        "organization_id",
        "workspace_id",
        "error_code",
        "request_id",
        "trace_id",
      ])
        assert.ok((await page.locator("#record-tech").innerText()).includes(k));
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.id), trigger);
      await scene("paged");
      assert.equal((await state()).data.runs.length, 25);
      await page.locator("#next").click();
      await complete("success");
      assert.equal((await state()).data.runs.length, 1);
      assert.equal((await state()).page, 2);
      await page.locator("#previous").click();
      await complete("success");
      assert.equal((await state()).data.runs.length, 25);
      await scene("query-max");
      assert.equal(await page.locator("#query").getAttribute("maxlength"), "160");
      await page.locator("#apply").click();
      assert.equal(
        new URLSearchParams((await state()).intents[0].path.split("?")[1]).get("q").length,
        160,
      );
      await scene("default");
      await page.locator("#query").fill("a\u0001b");
      await page.locator("#apply").click();
      assert.equal((await state()).intents.length, 0);
      assert.ok(await page.locator("#query-error").isVisible());
      for (const outcome of ["success", "zero", "error", "unknown"]) {
        await scene("confirm-typed");
        await page.locator("#confirm-submit").click();
        assert.equal(await page.evaluate(() => window.RUNTIME_C.submit()), false);
        assert.ok(await page.locator("#query").isDisabled());
        assert.equal((await state()).intents.length, 1);
        assert.deepEqual((await state()).intents[0], {
          method: "POST",
          path: "/platform/crawler-runtime/recover-expired",
          body: {},
        });
        await complete(outcome);
        if (outcome === "success" || outcome === "zero") {
          assert.equal((await state()).pending.kind, "read");
          await complete("error");
          assert.ok((await state()).readNotice.includes("失败"));
          assert.ok((await state()).writeNotice.includes(outcome === "zero" ? "0 个" : "1 个"));
        }
        if (outcome === "unknown") {
          assert.ok(await page.locator("#recover-open").isDisabled());
          assert.equal(await page.evaluate(() => window.RUNTIME_C.read()), false);
        }
      }
      await scene("saving");
      const stale = (await state()).pending.id;
      await scene("default");
      assert.equal(
        await page.evaluate((id) => window.RUNTIME_C.complete("success", id), stale),
        false,
      );
      assert.equal((await state()).writeNotice, "");
      await scene("lease-free");
      assert.ok(await page.locator("#recover-open").isDisabled());
      await scene("default");
      await page.locator('a[href="/platform-admin/collection?status=blocked_login"]').click();
      assert.equal(
        (await state()).intents.at(-1).path,
        "/platform-admin/collection?status=blocked_login",
      );
      if (width === 1440) {
        await scene("default");
        await page.locator("#columns summary").click();
        for (let i = 0; i < 5; i++) await page.locator(`[data-column="${i}"]`).uncheck();
        assert.ok(await page.locator('[data-column="5"]').isDisabled());
        assert.equal(await page.locator("thead th").count(), 1);
        await page.locator("#freeze").click();
        assert.equal((await state()).freeze, false);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
      }
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of ["default", "long-content", "confirm-typed", "detail-tech"]) {
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
        `${width}: ${Object.keys(scenes).length} scenes, exact query/reset/global scope, 25/1 synthetic pagination, 160/control input, source lease-owner field, two named keyboard-contained modals and focus return, typed-only empty-body recovery single-flight, zero/success/error/unknown plus independent failed refresh, stale-generation rejection, renewal scope, table controls, six breakpoints/CSS zoom2. Static prototype only.`,
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
          proposal: "BROWSER-RUNTIME-C-r1",
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
      "runtime.css",
      "runtime.js",
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
