import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildReleaseDesignData } from "./lib/ui-phase2-release-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/release-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (s) => createHash("sha256").update(s).digest("hex"),
  lf = (s) => s.replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const { data, logic } = await buildReleaseDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.RELEASE_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const file = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(file)), parser: "babel" });
  if (capture) await writeFile(file, formatted);
  else assert.equal(lf(await readFile(file, "utf8")), formatted);
}
const contract = await readFile(
    path.join(repo, "design-plans/ui-phase-2-2026-09-07/log-backup-release-contract-review.md"),
    "utf8",
  ),
  bindings = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(([, f]) =>
    data.sourcePaths.includes(f),
  );
assert.equal(bindings.length, 10);
for (const [, f, h] of bindings)
  assert.equal(
    hash(lf(await readFile(path.join(repo, f), "utf8"))),
    responsiveFocusContractHash(f, h),
    f,
  );
const sourcePaths = [
    "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
    ...data.sourcePaths,
    "scripts/lib/ui-phase2-release-design-data.mjs",
    "scripts/verify-ui-phase2-release-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    ...["index.html", "release.css", "release.js", "data.js", "source-logic.js"].map(
      (f) => relative + "/" + f,
    ),
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
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
      label + " dialog overflow/labels",
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
      scenes = await page.evaluate(() => window.RELEASE_C.scenes);
      const scene = (k) => page.evaluate((k) => window.RELEASE_C.scene(k), k),
        state = () => page.evaluate(() => window.RELEASE_C.state()),
        done = (o = "success") => page.evaluate((o) => window.RELEASE_C.completeRead(o), o);
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
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, `${width}/${key}`);
        assert.deepEqual(errors, [], key);
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
      for (const [key, ds] of Object.entries(data.datasets)) {
        await scene(key);
        assert.deepEqual((await state()).data, ds, key);
      }
      await scene("verified");
      assert.equal(await page.locator(".mobile").isVisible(), width === 390);
      assert.equal(await page.locator(".tools").isVisible(), width === 1440);
      assert.equal(await page.locator("tbody tr").count(), 3);
      assert.equal(await page.locator("#coverage").count(), 0);
      assert.equal(await page.locator(".running-sha").innerText(), "a".repeat(40));
      await scene("source-fallback");
      assert.ok(
        (await page.locator(".comparison-note").first().innerText()).includes("不是三方独立核验"),
      );
      await scene("current-missing");
      assert.equal(await page.locator("tbody tr").count(), 0);
      assert.ok((await page.locator(".record-match").innerText()).includes("没有匹配当前SHA"));
      assert.ok((await page.locator(".history").innerText()).includes("a".repeat(40)));
      await scene("newest-other");
      assert.equal((await state()).data.latest_release.id, "synthetic-current");
      assert.ok((await page.locator(".history").innerText()).includes("不同记录"));
      await scene("error-equal");
      assert.ok((await page.locator(".stage").first().innerText()).includes("门指标条件未满足"));
      assert.ok((await page.locator(".stage").first().innerText()).includes("原始状态：已通过"));
      await scene("read-equal");
      assert.ok((await page.locator(".stage").first().innerText()).includes("门指标条件满足"));
      await scene("missing-metric");
      assert.equal(
        await page.locator("tbody tr").first().locator("td").nth(2).innerText(),
        "未记录",
      );
      await scene("all-zero-metrics");
      assert.equal(await page.locator("tbody tr").first().locator("td").nth(2).innerText(), "0 ms");
      for (const [key, text] of [
        ["zero-duration", "0 ms"],
        ["legacy-duration", "未记录"],
        ["reverse-duration", "未记录"],
        ["missing-duration", "未记录"],
      ]) {
        await scene(key);
        assert.equal(await page.locator(".action-row header strong").first().innerText(), text);
      }
      for (const key of [
        "no-finish",
        "future-finish",
        "negative-metric",
        "wrong-traffic",
        "original",
      ]) {
        await scene(key);
        assert.equal(await page.locator("#fact-warning").count(), 1);
      }
      await scene("status-stopped");
      assert.equal((await state()).data.automatic_stop_verified, false);
      assert.ok((await page.locator(".verdict").innerText()).includes("已停止"));
      await scene("status-rollback");
      assert.equal((await state()).data.rollback_verified, false);
      await scene("duplicate-first-failed");
      assert.equal(await page.locator("tbody tr").count(), 4);
      assert.ok((await page.locator(".stage").first().innerText()).includes("未满足"));
      await scene("extra-gate");
      assert.equal(await page.locator("tbody tr").count(), 4);
      assert.equal(await page.locator(".stage").count(), 3);
      await scene("superadmin");
      await page.locator("#coverage").click();
      assert.deepEqual((await state()).navigation, ["/platform-admin/api-coverage"]);
      await scene("verified");
      await page.locator(".page-nav a").nth(1).click();
      assert.equal((await state()).reads.length, 0);
      assert.equal(
        await page.locator("#gates").evaluate((n) => n === document.activeElement),
        true,
      );
      if (width === 1440) {
        await page.locator("#column-menu summary").click();
        for (let i = 0; i < 5; i++) await page.locator(`[data-col="${i}"]`).uncheck();
        assert.equal(await page.locator("[data-col]:disabled").count(), 1);
        assert.equal(await page.locator("th").count(), 1);
        assert.equal(await page.locator("th.frozen").count(), 1);
        await page.locator("#freeze").click();
        assert.equal(await page.locator("th.frozen").count(), 0);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
      } else {
        await page.locator("[data-detail]").first().click();
        await page.locator("#close").click();
        assert.equal(
          await page
            .locator("[data-detail]")
            .first()
            .evaluate((n) => n === document.activeElement),
          true,
        );
      }
      for (const p of [5, 25, 100]) {
        await scene("detail-" + p);
        const d = page.locator("dialog");
        for (const text of [
          "原始观察状态",
          "门指标条件",
          "实际流量",
          "记录观察时长 / 样本",
          "服务错误率",
          "读取P95",
          "写入P95",
          "异步延迟",
          "开始时间",
          "完成时间",
          "起止间隔",
        ])
          assert.ok((await d.innerText()).includes(text));
        await d.locator("summary").click();
        assert.ok((await d.innerText()).includes(`synthetic-canary_${p}`));
        await page.locator("#close").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await d.locator("summary").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#close").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      await scene("detail-5");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await scene("verified");
      await page.locator("#refresh").click();
      const old = (await state()).pending;
      await page.evaluate(() => window.RELEASE_C.read());
      assert.equal((await state()).reads.length, 1);
      assert.equal(await page.locator("#refresh").isDisabled(), true);
      await done("timeout");
      assert.equal((await state()).data.state, "verified");
      await page.locator("#retry").click();
      await done();
      assert.equal((await state()).failure, null);
      await scene("verified");
      assert.equal(
        await page.evaluate((id) => window.RELEASE_C.completeRead("success", id), old),
        false,
      );
      for (const failure of ["rate_limited", "timeout", "unavailable", "expired", "forbidden"]) {
        await scene("verified");
        await page.locator("#refresh").click();
        await done(failure);
        assert.equal(Boolean((await state()).data), !["expired", "forbidden"].includes(failure));
        if (failure === "expired") {
          await page.locator("#login").click();
          assert.deepEqual((await state()).navigation, ["/login"]);
        }
        if (failure === "forbidden") assert.equal(await page.locator("#retry").count(), 0);
      }
      for (const failure of ["rate_limited", "timeout", "unavailable"]) {
        await scene(failure);
        assert.equal((await state()).data, null);
        await page.locator("#retry").click();
        await done();
        assert.equal((await state()).data.state, "verified");
      }
      await scene("copy-denied");
      assert.ok((await page.locator("#copy-production-sha").innerText()).includes("被拒绝"));
      await scene("copy-success");
      assert.ok(
        (await page.locator("#copy-production-sha").innerText()).includes("未写入系统剪贴板"),
      );
      await scene("verified");
      for (const k of ["local-sha", "remote-sha"]) {
        assert.match(
          await page.locator(`[data-copy="${k}"]`).getAttribute("aria-label"),
          /^复制(本地构建|远端分支)SHA$/,
        );
        await page.locator(`[data-copy="${k}"]`).click();
        assert.ok((await page.locator("#copy-" + k).innerText()).includes("已复制"));
      }
      await scene("refresh-unavailable");
      await page.locator("#refresh-request summary").click();
      await page.locator('[data-copy="refresh-request"]').click();
      assert.ok((await page.locator("#copy-refresh-request").innerText()).includes("已复制"));
      await scene("request-copy-denied");
      assert.ok((await page.locator("#copy-request").innerText()).includes("被拒绝"));
      await scene("review-tools");
      await page.locator("#scene").selectOption("current-missing");
      assert.equal((await state()).data.latest_release, null);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const k of [
          "current-missing",
          "verified",
          "long",
          "detail-long",
          "columns-open",
          "review-tools",
        ]) {
          await scene(k);
          await layout(page, `${w}/${k}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("verified");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      await page.evaluate(() => (document.documentElement.style.zoom = ""));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push(
        `${width}: all 46 datasets preserved, full SHA/source fallback caveat/current vs newest-history, exact single-gate threshold function/status separate, null-zero-duration/metric distinctions, all fact warnings, release status vs action flags, duplicate/extra gates, superadmin navigation, local anchors, six columns/min-one/freeze/density desktop, three full gate details/Tab/Escape/backdrop and mobile return focus, single-flight/late-read/retained versus cleared/retry/login, version and two request copy consumers, six breakpoints/CSS zoom2/font/touch, no HTTP/cookies/storage.`,
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
          proposal: "RELEASE-C-r1",
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
    const file = path.join(root, "README.md"),
      readme = await readFile(file, "utf8"),
      gallery =
        `正式PNG：${screenshots.length}张；${Object.keys(scenes).length}场景。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
        Object.entries(scenes)
          .map(
            ([k, t]) =>
              `| ${t} (${k}) | ` +
              [1440, 390]
                .map((w) =>
                  screenshots
                    .filter((s) => s.scene === k && s.width === w)
                    .map((s) => `[${s.file.includes("-part") ? "续图" : "主图"}](${s.file})`)
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
      "release.css",
      "release.js",
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
      checks,
    }),
  );
} finally {
  await browser.close();
}
