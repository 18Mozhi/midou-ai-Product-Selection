import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildFilesDesignData } from "./lib/ui-phase2-files-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/files-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (s) => createHash("sha256").update(s).digest("hex"),
  lf = (s) => s.replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const { data, logic } = await buildFilesDesignData(repo);
for (const [file, content] of [
  ["data.js", `window.FILES_DATA=${JSON.stringify(data)};`],
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
assert.equal(bindings.length, 8);
for (const [, f, h] of bindings)
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), h, f);
const files = [
    ...data.sourcePaths,
    "scripts/lib/ui-phase2-files-design-data.mjs",
    "scripts/verify-ui-phase2-files-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    ...["index.html", "files.css", "files.js", "data.js", "source-logic.js"].map(
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
      scenes = await page.evaluate(() => window.FILES_C.scenes);
      const scene = (k) => page.evaluate((k) => window.FILES_C.scene(k), k),
        state = () => page.evaluate(() => window.FILES_C.state()),
        done = (o = "success") => page.evaluate((o) => window.FILES_C.completeRead(o), o);
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
          [
            "no-samples",
            "all-missing",
            "root-access-failed",
            "negative-ratio",
            "request-detail",
            "refresh-detail",
          ].includes(key)
        )
          await shot(
            key,
            "-detail",
            page.locator(
              ["no-samples", "all-missing"].includes(key)
                ? "#integrity"
                : key === "root-access-failed"
                  ? "#directory-1"
                  : key === "negative-ratio"
                    ? "#directory-0"
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
      assert.equal(await page.locator(".directory").count(), 3);
      assert.equal(await page.getByRole("progressbar").count(), 3);
      for (const [i, label] of ["证据目录", "导出目录", "临时目录"].entries()) {
        assert.equal(
          await page.getByRole("progressbar").nth(i).getAttribute("aria-label"),
          label + "所在文件系统已用比例",
        );
        assert.equal(
          await page.getByRole("progressbar").nth(i).getAttribute("aria-valuetext"),
          "40.0%",
        );
      }
      assert.ok((await page.locator("#directories").innerText()).includes("不能相加"));
      assert.ok(
        (await page.locator('[data-kind="temp"]').innerText()).includes(
          "这里的0不表示临时目录为空",
        ),
      );
      await scene("root-access-failed");
      assert.equal(await page.getByRole("progressbar").count(), 2);
      assert.ok((await page.locator("#directory-1").innerText()).includes("不是实测满额"));
      assert.ok((await page.locator("#directory-1 .index-facts").innerText()).includes("30 个"));
      await scene("all-roots-failed");
      assert.equal(await page.getByRole("progressbar").count(), 0);
      await scene("negative-ratio");
      assert.equal(await page.getByRole("progressbar").count(), 2);
      assert.ok((await page.locator("#directory-0").innerText()).includes("-10.0%"));
      await scene("measured-zero");
      assert.deepEqual(
        await page.locator("progress").evaluateAll((ns) => ns.map((n) => n.getAttribute("value"))),
        ["0", "0", "0"],
      );
      await scene("root-count");
      assert.equal(await page.locator(".directory").count(), 2);
      await scene("roots-empty");
      assert.equal(await page.locator(".directory").count(), 0);
      assert.ok((await page.locator("#directories").innerText()).includes("不补造"));
      await scene("no-samples");
      assert.equal((await state()).data.state, "ready");
      assert.ok((await page.locator("#sample-boundary").innerText()).includes("不能计算通过率"));
      for (const k of ["all-mismatch", "all-missing", "invalid-paths"]) {
        await scene(k);
        assert.equal((await state()).data.state, "blocked");
        assert.equal(await page.locator("progress").count(), 3);
      }
      await scene("evidence-first");
      assert.equal((await state()).data.integrity.sampled_files, 2);
      await scene("drill-stale");
      assert.equal((await state()).data.state, "warning");
      assert.equal((await state()).data.recovery.drill_age_days, 90);
      await scene("verified-null-age");
      assert.equal((await state()).data.state, "ready");
      assert.ok((await page.locator("#recovery").innerText()).includes("年龄未知不填0"));
      await scene("public-probe");
      assert.equal((await state()).data.public_access_enabled, false);
      assert.ok(
        (await page.locator("#findings").innerText()).includes("file_root_publicly_exposed"),
      );
      assert.ok(
        (await page.locator("#boundary-facts").innerText()).includes("不用固定标记覆盖异常"),
      );
      await scene("recovering");
      assert.equal((await state()).reads.length, 0);
      assert.ok((await page.locator(".failure").innerText()).includes("没有启动恢复作业"));
      await scene("generic-error");
      assert.equal(await page.locator(".technical").count(), 0);
      await scene("ready");
      await page.locator("#refresh").click();
      const old = (await state()).pending;
      await page.evaluate(() => window.FILES_C.read());
      assert.equal((await state()).reads.length, 1);
      assert.equal(await page.locator("#refresh").isDisabled(), true);
      await done("timeout");
      assert.equal((await state()).data.state, "ready");
      await page.locator("#retry").click();
      await done();
      assert.equal((await state()).failure, null);
      await scene("ready");
      assert.equal(
        await page.evaluate((id) => window.FILES_C.completeRead("success", id), old),
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
      await page.locator("#scene").selectOption("no-samples");
      assert.equal((await state()).data.integrity.sampled_files, 0);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const k of ["ready", "long", "capacity-unknown", "negative-ratio", "review-tools"]) {
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
        `${width}: all 42 datasets unchanged, three independently named native progress values, unknown versus measured zero/negative ratio, retained index facts on failed root, no invented missing roots, no summed filesystem usage, temp no persistent index, zero sample versus failed/mismatch, stale warning and unknown age, fixed public flag versus finding. Single-flight/late refusal/retained versus auth clearing/retry/login/null; three details keyboard/simulated copy/denial, six breakpoints/zoom/font/touch, no modal/HTTP/cookies/storage.`,
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
          proposal: "FILES-C-r1",
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
              `| ${t} (${k}) | [主图](1440-${k}.png) | [主图](390-${k}.png)${["no-samples", "all-missing", "root-access-failed", "negative-ratio", "request-detail", "refresh-detail"].includes(k) ? ` · [近图](390-${k}-detail.png)` : ""} |`,
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
      "files.css",
      "files.js",
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
