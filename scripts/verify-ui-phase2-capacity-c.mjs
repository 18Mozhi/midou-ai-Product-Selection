import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildCapacityDesignData } from "./lib/ui-phase2-capacity-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/capacity-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture");
const hash = (s) => createHash("sha256").update(s).digest("hex"),
  lf = (s) => s.replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((s) => s === "--capture"));
const { data, logic } = await buildCapacityDesignData(repo);
for (const [file, content] of [
  ["data.js", `window.CAPACITY_DATA=${JSON.stringify(data)};`],
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
);
const bindings = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(([, f]) =>
  data.sourcePaths.includes(f),
);
assert.equal(bindings.length, 7);
for (const [, file, value] of bindings)
  assert.equal(hash(lf(await readFile(path.join(repo, file), "utf8"))), value, file);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-capacity-design-data.mjs",
  "scripts/verify-ui-phase2-capacity-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "capacity.css", "capacity.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
  ),
);
if (!capture) {
  const e = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(e.sourceHashes, sourceHashes);
  for (const s of e.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  errors = [],
  requests = [],
  screenshots = [],
  expected = [],
  checks = [];
let scenes;
const near = (k) =>
  k.startsWith("confirm") ||
  ["finding-detail", "degradation-detail", "negative-resource", "policy-difference"].includes(k);
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  await checkPrototypeMetrics(page);
  assert.equal(await page.locator("input[type=checkbox],textarea,progress").count(), 0);
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
      scenes = await page.evaluate(() => window.CAPACITY_C.scenes);
      const scene = (key) => page.evaluate((key) => window.CAPACITY_C.scene(key), key),
        state = () => page.evaluate(() => window.CAPACITY_C.state());
      async function shot(key, suffix = "", locator = null) {
        const file = `${width}-${key}${suffix}.png`;
        expected.push(file);
        if (capture) {
          if (locator) await locator.screenshot({ path: path.join(root, file) });
          else await page.screenshot({ path: path.join(root, file), fullPage: true });
          screenshots.push({
            file,
            width,
            scene: key,
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
        if (width === 390 && near(key)) {
          const locator = page.locator(
            key.startsWith("confirm")
              ? "#confirm"
              : key === "finding-detail"
                ? "#finding-0"
                : key === "degradation-detail"
                  ? "#degradation"
                  : key === "negative-resource"
                    ? "#resources"
                    : "#performance",
          );
          await shot(key, "-detail", locator);
        }
        if (key === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      for (const [key, d] of Object.entries(data.datasets)) {
        await scene(key);
        assert.deepEqual((await state()).data, d, key);
      }
      await scene("ready");
      assert.equal(await page.locator(".performance tbody tr").count(), 4);
      assert.equal(await page.locator("#attest").count(), 1);
      await scene("read-warning");
      assert.ok(!(await page.locator("#boundary").innerText()).includes("下一档已触发"));
      await scene("policy-difference");
      assert.equal((await state()).data.state, "ready");
      assert.ok((await page.locator("#performance").innerText()).includes("350 ms"));
      assert.ok((await page.locator("#performance").innerText()).includes("不代表"));
      for (const k of ["over-ceiling", "off-stage"]) {
        await scene(k);
        assert.ok((await page.locator("#boundary").innerText()).includes("不属于合同"));
      }
      await scene("large-resource");
      assert.ok((await page.locator("#resources").innerText()).includes("1048576 MB"));
      await scene("negative-resource");
      assert.ok((await page.locator("#resources").innerText()).includes("-2 MB"));
      for (const start of ["ready", "empty", "stale", "both-missing"]) {
        await scene(start);
        await page.locator("#attest").click();
        assert.equal(
          await page.locator("#cancel").evaluate((e) => e === document.activeElement),
          true,
        );
        assert.equal(await page.locator("#submit").isDisabled(), true);
        assert.ok(
          (await page.locator("#confirm").innerText()).includes(data.attestationBody.reason),
        );
        if (start === "empty")
          assert.ok((await page.locator("#confirm").innerText()).includes("未知"));
        await page.locator("#typed").fill("确认");
        assert.equal(await page.locator("#submit").isDisabled(), true);
        await page.locator("#typed").fill(" 确认签认 ");
        assert.equal(await page.locator("#submit").isDisabled(), false);
        await page.locator("#submit").focus();
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#typed").evaluate((e) => e === document.activeElement),
          true,
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.locator("#submit").evaluate((e) => e === document.activeElement),
          true,
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).writes.length, 0);
        assert.equal(
          await page.locator("#attest").evaluate((e) => e === document.activeElement),
          true,
        );
        await page.locator("#attest").click();
        await page.locator("#cancel").click();
        assert.equal((await state()).writes.length, 0);
        await page.locator("#attest").click();
        await page.mouse.click(1, 1);
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).writes.length, 0);
      }
      async function submit() {
        await page.locator("#attest").click();
        await page.locator("#typed").fill("确认签认");
        await page.locator("#submit").click();
      }
      for (const outcome of ["unknown", "rejected", "expired", "forbidden"]) {
        await scene("ready");
        await submit();
        const before = (await state()).writes[0];
        assert.deepEqual(before.body, data.attestationBody);
        assert.equal(before.url, "/platform/operations/capacity/drills");
        assert.equal(before.method, "POST");
        assert.equal(await page.locator("#refresh").isDisabled(), true);
        assert.equal(await page.evaluate(() => window.CAPACITY_C.read()), false);
        assert.equal(await page.evaluate(() => window.CAPACITY_C.submit()), false);
        await page.evaluate((outcome) => window.CAPACITY_C.completeMutation(outcome), outcome);
        assert.equal(Boolean((await state()).data), !["expired", "forbidden"].includes(outcome));
        await submit();
        assert.equal((await state()).writes[1].idempotencyKey, before.idempotencyKey);
        await page.evaluate(() => window.CAPACITY_C.completeMutation("success"));
        const op = (await state()).operation;
        await page.evaluate(() => window.CAPACITY_C.completeRead("unavailable"));
        assert.deepEqual((await state()).operation, op);
        await submit();
        assert.notEqual((await state()).writes[2].idempotencyKey, before.idempotencyKey);
        await page.evaluate(() => window.CAPACITY_C.completeMutation("rejected"));
      }
      await scene("attest-empty-failure");
      assert.equal((await state()).data, null);
      assert.ok((await page.locator("#operation").innerText()).includes("签认未获接受"));
      for (const outcome of [
        "empty",
        "null",
        "expired",
        "forbidden",
        "timeout",
        "rate_limited",
        "unavailable",
        "generic",
      ]) {
        await scene("ready");
        await page.locator("#refresh").click();
        assert.equal(await page.evaluate(() => window.CAPACITY_C.read()), false);
        await page.evaluate((outcome) => window.CAPACITY_C.completeRead(outcome), outcome);
        assert.equal(
          Boolean((await state()).data),
          !["null", "expired", "forbidden"].includes(outcome),
        );
        await page.locator("#retry").click();
        await page.evaluate(() => window.CAPACITY_C.completeRead());
        assert.equal((await state()).data.state, "ready");
      }
      await scene("ready");
      const request = await page.evaluate(() => window.CAPACITY_C.read());
      await scene("ready");
      assert.equal(
        await page.evaluate((id) => window.CAPACITY_C.completeRead("success", id), request),
        false,
      );
      await scene("generic-error");
      assert.equal(await page.locator(".technical").count(), 0);
      for (const [key, id] of [
        ["request-detail", "request"],
        ["failure-detail", "failure-request"],
        ["refresh-detail", "refresh-request"],
      ]) {
        await scene(key);
        await page.locator(`[data-copy="${id}"]`).click();
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
      await scene("finding-detail");
      assert.equal(await page.locator("#finding-0").getAttribute("open"), "");
      await page.locator("#finding-0 summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#finding-0").getAttribute("open"), null);
      await scene("review-tools");
      await page.locator("#scene").selectOption("archive-missing");
      assert.equal((await state()).data.resilience.archive_verified, false);
      for (const w of [320, 759, 760, 761, 768, 1024, 1099, 1100, 1101]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of ["ready", "long", "confirm", "confirm-empty", "review-tools"]) {
          await scene(key);
          await layout(page, w + "/" + key);
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
        `${width}:38 source datasets unchanged; return claims and off-plan stages, fixed-reference versus policy distinction, absolute negative/large resources, all read states and obsolete response rejection, exact inert attestation body/key-all-failures/success rotation, proposed shared busy lock, no-snapshot failure and independent write/read outcomes, confirmation trim/initial focus/Tab/Escape/cancel/backdrop/return, technical keyboard/copy denial, nine widths/zoom/font/touch; no HTTP/cookies/storage.`,
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
          proposal: "CAPACITY-C-r1",
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
    const gallery =
      `正式PNG：${screenshots.length}张；${Object.keys(scenes).length}场景。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
      Object.entries(scenes)
        .map(
          ([k, t]) =>
            `| ${t} (${k}) | [主图](1440-${k}.png) | [主图](390-${k}.png)${near(k) ? ` · [近图](390-${k}-detail.png)` : ""} |`,
        )
        .join("\n");
    const r = path.join(root, "README.md");
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
      "capacity.css",
      "capacity.js",
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
