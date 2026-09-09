import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildTopologyDesignData } from "./lib/ui-phase2-topology-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/topology-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (s) => createHash("sha256").update(s).digest("hex"),
  lf = (s) => s.replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const { data, logic } = await buildTopologyDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.TOPOLOGY_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const file = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(file)), parser: "babel" });
  if (capture) await writeFile(file, formatted);
  else assert.equal(lf(await readFile(file, "utf8")), formatted);
}
const contract = await readFile(
    path.join(repo, "design-plans/ui-phase-2-2026-09-07/runtime-resilience-contract-review.md"),
    "utf8",
  ),
  bindings = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(([, f]) =>
    data.sourcePaths.includes(f),
  );
assert.equal(bindings.length, 9);
for (const [, f, h] of bindings)
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), h, f);
const sourcePaths = [
    ...data.sourcePaths,
    "scripts/lib/ui-phase2-topology-design-data.mjs",
    "scripts/verify-ui-phase2-topology-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    ...["index.html", "topology.css", "topology.js", "data.js", "source-logic.js"].map(
      (f) => relative + "/" + f,
    ),
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
    ),
  );
if (!capture) {
  const previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
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
  assert.equal(ids.length, new Set(ids).size, label + " duplicate ID");
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.locator("dialog,input,textarea").count(),
    0,
    "No invented business modal/input",
  );
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
      scenes = await page.evaluate(() => window.TOPOLOGY_C.scenes);
      const scene = (k) => page.evaluate((k) => window.TOPOLOGY_C.scene(k), k),
        state = () => page.evaluate(() => window.TOPOLOGY_C.state()),
        done = (o = "success") => page.evaluate((o) => window.TOPOLOGY_C.completeRead(o), o);
      for (const key of Object.keys(scenes)) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, width + "/" + key);
        const file = `${width}-${key}.png`;
        expected.push(file);
        if (capture) {
          await page.screenshot({ path: path.join(root, file), fullPage: true });
          screenshots.push({
            scene: key,
            width,
            file,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
        if (width === 390 && key.startsWith("policy-")) {
          const detailFile = `${width}-${key}-detail.png`;
          expected.push(detailFile);
          if (capture) {
            await page
              .locator(`#${key}`)
              .locator("..")
              .screenshot({ path: path.join(root, detailFile) });
            screenshots.push({
              scene: key,
              width,
              file: detailFile,
              sha256: hash(await readFile(path.join(root, detailFile))),
            });
          }
        }
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
      assert.equal(await page.locator(".queue").count(), 0);
      await page.locator("#toggle").click();
      assert.equal(await page.locator(".queue").count(), 19);
      assert.equal(await page.locator("#toggle").getAttribute("aria-expanded"), "true");
      assert.equal((await state()).reads.length, 0);
      await page.locator("#policy-18 summary").click();
      assert.ok((await page.locator("#policy-18").innerText()).includes("120000"));
      await page.locator("#toggle").click();
      assert.equal(await page.locator(".queue").count(), 0);
      for (let i = 0; i < 19; i++) {
        await scene("policy-" + i);
        assert.equal(await page.locator(".queue").count(), 19);
        assert.equal(await page.locator("#policy-" + i).getAttribute("open"), "");
        for (const text of ["并发配额", "最大调度重试", "超时累计", "结果错误码"])
          assert.ok((await page.locator("#policy-" + i).innerText()).includes(text));
      }
      await scene("circuit");
      assert.equal(await page.locator(".queue").count(), 1);
      assert.equal(
        await page.locator(".queue").getAttribute("data-queue"),
        "automatic_selection_evaluation",
      );
      await scene("running");
      assert.ok((await page.locator(".queue-head").innerText()).includes("运行中 · 非等待老化"));
      await scene("backpressure");
      assert.ok(
        (await page.locator('[data-queue="notification_outbox"] .queue-head').innerText()).includes(
          "饥饿风险",
        ),
      );
      await scene("health-empty");
      assert.deepEqual(await page.locator(".ratio").allInnerTexts(), [
        "无样本",
        "无样本",
        "无样本",
      ]);
      await scene("health-mixed");
      assert.equal(await page.locator(".ratio").last().innerText(), "25%");
      assert.ok((await page.locator(".probe").last().innerText()).includes("5000"));
      await scene("supervisor-blocked");
      assert.ok((await page.locator(".verdict").innerText()).includes("单机运行门满足"));
      assert.equal(await page.locator("#alerts .alert").count(), 1);
      await scene("restart-loop");
      assert.ok((await page.locator(".verdict").innerText()).includes("1 告警"));
      await scene("restart-detail");
      assert.ok((await page.locator("#restart-details").innerText()).includes("计数已重置"));
      assert.equal(await page.locator(".history-row").count(), 4);
      await scene("business");
      await page.locator("#alerts a").click();
      assert.deepEqual((await state()).navigation, [
        "/platform-admin/collection?task=synthetic-task-66",
      ]);
      await scene("association-invalid");
      assert.equal(await page.locator("#alerts a").count(), 0);
      assert.ok((await page.locator("#alerts").innerText()).includes("无导航地址"));
      await scene("ready");
      await page.locator('.page-nav a[href="#queues"]').click();
      assert.equal(
        await page.locator("#queues").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal((await state()).reads.length, 0);
      await page.locator("#refresh").click();
      const old = (await state()).pending;
      await page.evaluate(() => window.TOPOLOGY_C.read());
      assert.equal((await state()).reads.length, 1);
      assert.equal(await page.locator("#refresh").isDisabled(), true);
      await done("timeout");
      assert.equal((await state()).data.state, "ready");
      await page.locator("#retry").click();
      await done();
      assert.equal((await state()).failure, null);
      await scene("ready");
      assert.equal(
        await page.evaluate((id) => window.TOPOLOGY_C.completeRead("success", id), old),
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
      for (const [k, id] of [
        ["request-detail", "request"],
        ["failure-copy", "failure-request"],
        ["refresh-copy", "refresh-request"],
      ]) {
        await scene(k);
        await page.locator(`[data-copy="${id}"]`).click();
        assert.ok((await page.locator("#copy-" + id).innerText()).includes("未写入系统剪贴板"));
      }
      await scene("copy-denied");
      assert.ok((await page.locator("#copy-request").innerText()).includes("复制被拒绝"));
      for (const [key, id] of [
        ["failure-copy-denied", "failure-request"],
        ["refresh-copy-denied", "refresh-request"],
      ]) {
        await scene(key);
        assert.ok((await page.locator("#copy-" + id).innerText()).includes("复制被拒绝"));
      }
      await scene("request-detail");
      await page.locator("#request summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#request").getAttribute("open"), null);
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#request").getAttribute("open"), "");
      await scene("review-tools");
      await page.locator("#scene").selectOption("worker-stale");
      assert.equal((await state()).data.state, "stale");
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const k of ["ready", "long", "policy-18", "review-tools", "health-mixed"]) {
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
        `${width}: all 35 source datasets unchanged, 19 queue disclosures/exceptional last queue/local toggle, running non-due and starvation text, zero samples/all-outcome percentiles, ready with blocker/critical alert, irregular restart reset rows, exact business href/no fabricated missing link, local anchors/focus, single-flight/late response/retained versus auth-cleared snapshots/retry/login, three request details/simulated copy/denial, keyboard native disclosure, six breakpoints/CSS200%/font/touch/no business modal, no HTTP/storage/cookies.`,
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
          proposal: "TOPOLOGY-C-r1",
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
    const readme = path.join(root, "README.md"),
      content = await readFile(readme, "utf8"),
      gallery =
        `正式PNG：${screenshots.length}张；${Object.keys(scenes).length}场景。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
        Object.entries(scenes)
          .map(
            ([k, t]) =>
              `| ${t} (${k}) | [主图](1440-${k}.png) | [主图](390-${k}.png)${k.startsWith("policy-") ? ` · [详情近图](390-${k}-detail.png)` : ""} |`,
          )
          .join("\n");
    await writeFile(
      readme,
      content.replace(
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
      "topology.css",
      "topology.js",
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
