import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildSchedulerDesignData } from "./lib/ui-phase2-scheduler-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/scheduler-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (s) => createHash("sha256").update(s).digest("hex"),
  lf = (s) => s.replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const { data, logic } = await buildSchedulerDesignData(repo);
for (const [file, content] of [
  ["data.js", `window.SCHEDULER_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const target = path.join(root, file),
    formatted = await format(content, { ...(await resolveConfig(target)), parser: "babel" });
  if (capture) await writeFile(target, formatted);
  else assert.equal(lf(await readFile(target, "utf8")), formatted);
}
const contract = await readFile(
    path.join(repo, "design-plans/ui-phase-2-2026-09-07/scheduler-capacity-contract-review.md"),
    "utf8",
  ),
  bindings = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(([, f]) =>
    data.sourcePaths.includes(f),
  );
assert.equal(bindings.length, 8);
for (const [, f, h] of bindings)
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), h, f);
const files = [
    ...data.sourcePaths,
    "scripts/lib/ui-phase2-scheduler-design-data.mjs",
    "scripts/verify-ui-phase2-scheduler-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    ...["index.html", "scheduler.css", "scheduler.js", "data.js", "source-logic.js"].map(
      (f) => relative + "/" + f,
    ),
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(
      files.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
    ),
  );
if (!capture) {
  const old = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(old.sourceHashes, sourceHashes);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  errors = [],
  requests = [],
  checks = [];
let scenes;
const near = (key) =>
  /-(confirm|typed|wrong)$/.test(key) ||
  ["last-error", "lease-detail", "spool-time-unknown"].includes(key);
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  await checkPrototypeMetrics(page);
  assert.equal(await page.locator("input[type=checkbox],textarea").count(), 0);
  assert.ok((await page.locator("dialog[open]").count()) <= 1);
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
      scenes = await page.evaluate(() => window.SCHEDULER_C.scenes);
      const scene = (k) => page.evaluate((k) => window.SCHEDULER_C.scene(k), k),
        state = () => page.evaluate(() => window.SCHEDULER_C.state()),
        done = (o = "success") => page.evaluate((o) => window.SCHEDULER_C.completeRead(o), o);
      async function shot(key, suffix = "", locator = null) {
        const file = `${width}-${key}${suffix}.png`;
        expected.push(file);
        if (capture) {
          if (locator) await locator.screenshot({ path: path.join(root, file) });
          else await page.screenshot({ path: path.join(root, file), fullPage: true });
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
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, width + "/" + key);
        await shot(key);
        if (width === 390 && near(key))
          await shot(
            key,
            "-detail",
            page.locator(
              /-(confirm|typed|wrong)$/.test(key)
                ? "#confirm"
                : key === "last-error"
                  ? "#provider-error-0"
                  : key === "lease-detail"
                    ? "#lease-0"
                    : "#receipts",
            ),
          );
        if (key === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        if (width === 390 && key === "provider-long-confirm") {
          await page.locator("#typed").scrollIntoViewIfNeeded();
          await shot(key, "-bottom", page.locator("#confirm"));
          assert.ok(await page.locator("#typed").isVisible());
        }
      }
      for (const [k, d] of Object.entries(data.datasets)) {
        await scene(k);
        assert.deepEqual((await state()).data, d, k);
      }

      await scene("ready");
      assert.equal(await page.locator(".provider").count(), 1);
      assert.ok((await page.locator("#queue-summary").innerText()).includes("3"));
      const summary = await page.locator("#queue-summary").innerText();
      await page.locator("#filter").selectOption("all");
      assert.equal(await page.locator(".provider").count(), 3);
      assert.equal(await page.locator("#queue-summary").innerText(), summary);
      assert.equal(
        await page.getByRole("progressbar").first().getAttribute("aria-label"),
        "catalog_search活动来源槽位",
      );
      await scene("many");
      assert.equal(await page.locator(".provider").count(), 12);
      await page.locator("#next").click();
      assert.equal((await state()).page, 2);
      await page.locator("#next").click();
      assert.equal(await page.locator(".provider").count(), 1);
      await page.locator("#previous").click();
      assert.equal((await state()).page, 2);
      await page.locator("#query").fill("SOURCE_24");
      assert.equal((await state()).page, 1);
      assert.equal(await page.locator(".provider").count(), 1);
      await page.locator("#query").fill("not-present");
      assert.equal(await page.locator(".provider").count(), 0);
      await scene("spool-time-unknown");
      assert.ok((await page.locator("#receipts").innerText()).includes("有待回写"));
      await scene("original");
      assert.equal((await state()).data.state, "ready");
      assert.ok((await page.locator("#receipts").innerText()).includes("未返回回执"));
      for (const type of ["expired", "provider"]) {
        await scene("circuit");
        const opener = type === "expired" ? "#recover-expired" : "#provider-action-0",
          phrase = type === "expired" ? "确认回收" : "确认解除";
        await page.locator(opener).click();
        assert.equal(
          await page.locator("#cancel").evaluate((e) => e === document.activeElement),
          true,
        );
        assert.equal(await page.locator("#submit").isDisabled(), true);
        if (type === "provider")
          assert.ok(
            (await page.locator("#confirm").innerText()).includes(
              data.datasets.circuit.providers[0].id,
            ),
          );
        await page.locator("#typed").fill("wrong");
        assert.equal(await page.locator("#submit").isDisabled(), true);
        await page.locator("#typed").fill(" " + phrase + " ");
        assert.equal(await page.locator("#submit").isDisabled(), false);
        await page.locator("#submit").focus();
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#typed").evaluate((e) => e === document.activeElement),
          true,
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).writes.length, 0);
        assert.equal(
          await page.locator(opener).evaluate((e) => e === document.activeElement),
          true,
        );
        await page.locator(opener).click();
        await page.locator("#cancel").click();
        assert.equal((await state()).writes.length, 0);
        await page.locator(opener).click();
        await page.locator("#typed").fill(phrase);
        await page.locator("#submit").click();
        const first = (await state()).writes[0];
        assert.equal(first.method, "POST");
        assert.deepEqual(first.body, {});
        assert.equal(await page.locator("#refresh").isDisabled(), true);
        assert.equal(await page.evaluate(() => window.SCHEDULER_C.read()), false);
        await page.evaluate(() => window.SCHEDULER_C.completeMutation("unknown"));
        assert.equal((await state()).operation.status, "unknown");
        await page.locator(opener).click();
        await page.locator("#typed").fill(phrase);
        await page.locator("#submit").click();
        assert.equal((await state()).writes[1].idempotencyKey, first.idempotencyKey);
        await page.evaluate(() => window.SCHEDULER_C.completeMutation("success"));
        assert.ok((await state()).pending);
        const operation = (await state()).operation;
        await done("unavailable");
        assert.deepEqual((await state()).operation, operation);
        assert.equal((await state()).failure, "unavailable");
        await scene("circuit");
        await page.locator(opener).click();
        await page.locator("#typed").fill(phrase);
        await page.locator("#submit").click();
        await page.evaluate(() => window.SCHEDULER_C.completeMutation("auth"));
        assert.equal((await state()).data, null);
      }
      await scene("expired-unknown-confirm");
      assert.ok((await page.locator("#confirm").innerText()).includes("影响数量未知"));
      await page.keyboard.press("Escape");
      await scene("expired-zero-confirm");
      assert.ok((await page.locator("#confirm").innerText()).includes("0也不保证"));
      await page.keyboard.press("Escape");
      await scene("circuit");
      await page.locator("[data-health]").first().click();
      assert.deepEqual((await state()).navigation, [
        "/platform-admin/provider-adapters?provider_id=" + data.datasets.circuit.providers[0].id,
      ]);
      await scene("last-error");
      assert.equal(await page.locator("#provider-error-0").getAttribute("open"), "");
      await scene("lease-detail");
      assert.equal(await page.locator("#lease-0").getAttribute("open"), "");
      await scene("generic-error");
      assert.equal(await page.locator(".technical").count(), 0);
      await scene("ready");
      await page.locator("#refresh").click();
      const pending = (await state()).pending;
      assert.equal(await page.evaluate(() => window.SCHEDULER_C.read()), false);
      await done("timeout");
      assert.ok((await state()).data);
      await page.locator("#retry").click();
      await done();
      assert.equal((await state()).failure, null);
      await scene("ready");
      assert.equal(
        await page.evaluate((id) => window.SCHEDULER_C.completeRead("success", id), pending),
        false,
      );
      for (const outcome of ["expired", "forbidden", "rate_limited", "timeout", "unavailable"]) {
        await scene("ready");
        await page.locator("#refresh").click();
        await done(outcome);
        assert.equal(Boolean((await state()).data), !["expired", "forbidden"].includes(outcome));
        await page.locator("#retry").click();
        await done();
      }
      await scene("empty");
      await page.locator("#retry").click();
      await done("empty");
      assert.equal((await state()).data, null);
      for (const [key, id] of [
        ["request-detail", "request"],
        ["failure-detail", "failure-request"],
        ["refresh-detail", "refresh-request"],
      ]) {
        await scene(key);
        await page.locator('[data-copy="' + id + '"]').click();
        assert.ok((await page.locator("#copy-" + id).innerText()).includes("未写入系统剪贴板"));
        await page.locator("#" + id + " summary").focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#" + id).getAttribute("open"), null);
        await page.keyboard.press("Enter");
      }
      for (const [key, id] of [
        ["copy-denied", "request"],
        ["failure-copy-denied", "failure-request"],
        ["refresh-copy-denied", "refresh-request"],
      ]) {
        await scene(key);
        assert.ok((await page.locator("#copy-" + id).innerText()).includes("被拒绝"));
      }
      await scene("review-tools");
      await page.locator("#scene").selectOption("spool-missing");
      assert.equal((await state()).data.receipt_spool, null);
      for (const w of [320, 759, 760, 761, 768, 1024, 1099, 1100, 1101]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const k of [
          "ready",
          "long",
          "provider-long-confirm",
          "expired-unknown-confirm",
          "review-tools",
        ]) {
          await scene(k);
          await layout(page, w + "/" + k);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("ready");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "zoom2");
      await page.evaluate(() => (document.documentElement.style.zoom = ""));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push(
        `${width}: all 36 source datasets unchanged; exact local provider filter/sort/12 pagination and global summary, progress names, unknown receipt time/source E2E omission; two identity/unknown/zero confirmation variants with actual canConfirm trim, cancel/focus/escape/tab, inert POST{} target/key retention, unified busy proposal and independent operation versus read failure/auth; exact health URL, all technical disclosures/copy-denials, nine breakpoints/zoom/font/touch, no HTTP/cookies/storage.`,
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
          proposal: "SCHEDULER-C-r1",
          sourceHashes,
          sourceChecks: data.sourceChecks,
          contractSources: bindings.length,
          checks,
          errors,
          httpRequests: 0,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const r = path.join(root, "README.md"),
      gallery =
        `正式PNG：${screenshots.length}张；${Object.keys(scenes).length}场景。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
        Object.entries(scenes)
          .map(
            ([k, t]) =>
              `| ${t} (${k}) | [主图](1440-${k}.png) | [主图](390-${k}.png)${near(k) ? ` · [近图](390-${k}-detail.png)` : ""}${k === "provider-long-confirm" ? " · [底部](390-provider-long-confirm-bottom.png)" : ""} |`,
          )
          .join("\n");
    await writeFile(
      r,
      (await readFile(r, "utf8")).replace(
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
      "scheduler.css",
      "scheduler.js",
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
      scenes: Object.keys(scenes).length,
      screenshots: expected.length,
      sourceChecks: data.sourceChecks.length,
      contractSources: bindings.length,
      readmeLinks: links.length,
      errors,
      httpRequests: requests.length,
    }),
  );
} finally {
  await browser.close();
}
