import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildRedisDesignData } from "./lib/ui-phase2-redis-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/redis-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (s) => createHash("sha256").update(s).digest("hex"),
  lf = (s) => s.replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const { data, logic } = await buildRedisDesignData(repo);
for (const [file, content] of [
  ["data.js", `window.REDIS_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const target = path.join(root, file),
    formatted = await format(content, { ...(await resolveConfig(target)), parser: "babel" });
  if (capture) await writeFile(target, formatted);
  else assert.equal(lf(await readFile(target, "utf8")), formatted);
}
const contract = await readFile(
    path.join(repo, "design-plans/ui-phase-2-2026-09-07/runtime-resilience-contract-review.md"),
    "utf8",
  ),
  bindings = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(([, f]) =>
    data.sourcePaths.includes(f),
  );
assert.equal(bindings.length, 7);
for (const [, f, h] of bindings)
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), h, f);
const files = [
    ...data.sourcePaths,
    "scripts/lib/ui-phase2-redis-design-data.mjs",
    "scripts/verify-ui-phase2-redis-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    ...["index.html", "redis.css", "redis.js", "data.js", "source-logic.js"].map(
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
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  await checkPrototypeMetrics(page);
  assert.equal(await page.locator("dialog,input,textarea").count(), 0);
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
      scenes = await page.evaluate(() => window.REDIS_C.scenes);
      const scene = (k) => page.evaluate((k) => window.REDIS_C.scene(k), k),
        state = () => page.evaluate(() => window.REDIS_C.state()),
        done = (o = "success") => page.evaluate((o) => window.REDIS_C.completeRead(o), o);
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
        if (
          width === 390 &&
          ["sample-all-failed", "sample-zero", "request-detail", "refresh-detail"].includes(key)
        )
          await shot(
            key,
            "-detail",
            page.locator(
              key.startsWith("sample-")
                ? "#sample"
                : key === "request-detail"
                  ? "#request"
                  : ".notice",
            ),
          );
        if (key === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      for (const [k, d] of Object.entries(data.datasets)) {
        await scene(k);
        assert.deepEqual((await state()).data, d, k);
      }
      await scene("ready");
      assert.equal(await page.locator(".hotspot").count(), 12);
      assert.equal(await page.locator('[role="meter"]').count(), 2);
      assert.ok((await page.locator(".policy").innerText()).includes("当前GET未覆盖"));
      assert.ok(!(await page.locator("body").innerText()).includes("synthetic-org"));
      await scene("probe-failed");
      assert.equal(await page.locator('[role="meter"]').count(), 0);
      assert.deepEqual(await page.locator(".resource strong").allInnerTexts(), [
        "未取得观测",
        "未取得观测",
      ]);
      assert.ok((await page.locator(".counters").innerText()).includes("失败占位原值 0"));
      await scene("zero-resources");
      await scene("rdb-error");
      assert.deepEqual(
        await page.locator('[role="meter"]').evaluateAll((ns) => ns.map((n) => n.dataset.level)),
        ["ready", "ready"],
      );
      await scene("clients-stop");
      assert.deepEqual(
        await page.locator('[role="meter"]').evaluateAll((ns) => ns.map((n) => n.dataset.level)),
        ["ready", "blocked"],
      );
      await scene("zero-resources");
      assert.deepEqual(await page.locator(".resource strong").allInnerTexts(), ["0.00%", "0.00%"]);
      await scene("memory-unbounded");
      assert.equal(await page.locator(".resource strong").first().innerText(), "未设置上限");
      await scene("memory-over");
      assert.ok(
        (await page.locator(".resource").first().innerText()).includes("原始用量已超过上限"),
      );
      await scene("custom-policy");
      assert.equal((await state()).data.state, "ready");
      assert.ok((await page.locator("#local-risk").innerText()).includes("新写入会失败"));
      await scene("memory-warning");
      assert.equal((await state()).data.state, "warning");
      assert.ok((await page.locator("#local-risk").innerText()).includes("当前未记录键淘汰"));
      await scene("sample-all-failed");
      assert.equal((await state()).data.state, "ready");
      assert.equal(await page.locator(".hotspot").count(), 0);
      assert.ok((await page.locator(".sample-empty").innerText()).includes("所有可归类键测量失败"));
      await scene("sample-zero");
      assert.equal(await page.locator(".hotspot").count(), 12);
      assert.equal(await page.locator(".hotspot .meter").count(), 0);
      assert.ok((await page.locator("#sample").innerText()).includes("无可计算占比"));
      await scene("sample-truncated");
      assert.ok((await page.locator("#sample").innerText()).includes("已截断"));
      for (const key of [
        "sample-unsupported",
        "sample-scan-failed",
        "sample-empty",
        "sample-ignored",
        "sample-round-limit",
      ]) {
        await scene(key);
        assert.equal(await page.locator(".sample-empty").count(), 1);
        assert.equal(await page.locator(".hotspot").count(), 0);
      }
      await scene("short-uptime");
      assert.ok((await page.locator("body").innerText()).includes("3599 秒"));
      await scene("recovering");
      assert.equal((await state()).reads.length, 0);
      assert.ok((await page.locator(".failure").innerText()).includes("未启动恢复作业"));
      await scene("generic-error");
      assert.equal(await page.locator(".technical").count(), 0);
      await scene("ready");
      await page.locator("#refresh").click();
      const old = (await state()).pending;
      await page.evaluate(() => window.REDIS_C.read());
      assert.equal((await state()).reads.length, 1);
      assert.equal(await page.locator("#refresh").isDisabled(), true);
      await done("timeout");
      assert.equal((await state()).data.state, "ready");
      await page.locator("#retry").click();
      await done();
      assert.equal((await state()).failure, null);
      await scene("ready");
      assert.equal(
        await page.evaluate((id) => window.REDIS_C.completeRead("success", id), old),
        false,
      );
      for (const outcome of ["expired", "forbidden", "rate_limited", "timeout", "unavailable"]) {
        await scene("ready");
        await page.locator("#refresh").click();
        await done(outcome);
        assert.equal(Boolean((await state()).data), !["expired", "forbidden"].includes(outcome));
        if (outcome === "expired") {
          await page.locator("#login").click();
          assert.deepEqual((await state()).navigation, ["/login"]);
        } else {
          await page.locator("#retry").click();
          await done();
          assert.equal((await state()).data.state, "ready");
        }
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
        await page.locator(`[data-copy="${id}"]`).click();
        assert.ok((await page.locator("#copy-" + id).innerText()).includes("未写入系统剪贴板"));
        await page.locator("#" + id + " summary").focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#" + id).getAttribute("open"), null);
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#" + id).getAttribute("open"), "");
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
      await page.locator("#scene").selectOption("sample-all-failed");
      assert.equal((await state()).data.keyspace_sample.status, "partial");
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const k of ["ready", "long", "probe-failed", "sample-zero", "review-tools"]) {
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
        `${width}: all 37 datasets unchanged, twelve purpose/resource groups, probe placeholders versus measured zeros, unbounded/over-limit ratios, policy versus local80% separation, partial all-failed versus zero bytes/sample truncation/empty/unsupported, uptime seconds, UI-only recovering/no ID generic error, single-flight/late refusal/retained versus auth clearing/retry/login/null, all three details keyboard/simulated copy/denial, six breakpoints/zoom/font/touch and no business modal; no HTTP/cookies/storage.`,
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
          proposal: "REDIS-C-r1",
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
              `| ${t} (${k}) | [主图](1440-${k}.png) | [主图](390-${k}.png)${["sample-all-failed", "sample-zero", "request-detail", "refresh-detail"].includes(k) ? ` · [近图](390-${k}-detail.png)` : ""} |`,
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
      "redis.css",
      "redis.js",
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
