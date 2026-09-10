import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildBackupRecoveryDesignData } from "./lib/ui-phase2-backup-recovery-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/backup-recovery-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (s) => createHash("sha256").update(s).digest("hex"),
  lf = (s) => s.replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const data = await buildBackupRecoveryDesignData(repo),
  dataFile = path.join(root, "data.js"),
  generated = await format(`window.BACKUP_DATA=${JSON.stringify(data)};`, {
    ...(await resolveConfig(dataFile)),
    parser: "babel",
  });
if (capture) await writeFile(dataFile, generated);
else assert.equal(lf(await readFile(dataFile, "utf8")), generated);
const contract = await readFile(
    path.join(repo, "design-plans/ui-phase-2-2026-09-07/log-backup-release-contract-review.md"),
    "utf8",
  ),
  bindings = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(([, f]) =>
    data.sourcePaths.includes(f),
  );
assert.equal(bindings.length, 11);
for (const [, f, h] of bindings)
  assert.equal(
    hash(lf(await readFile(path.join(repo, f), "utf8"))),
    responsiveFocusContractHash(f, h),
    f,
  );
const sourcePaths = [
    "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
    ...data.sourcePaths,
    "scripts/lib/ui-phase2-backup-recovery-design-data.mjs",
    "scripts/verify-ui-phase2-backup-recovery-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    ...["index.html", "backup.css", "backup.js", "data.js"].map((f) => relative + "/" + f),
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
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
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
      scenes = await page.evaluate(() => window.BACKUP_C.scenes);
      const scene = (key) => page.evaluate((k) => window.BACKUP_C.scene(k), key),
        state = () => page.evaluate(() => window.BACKUP_C.state()),
        done = (outcome = "success") =>
          page.evaluate((o) => window.BACKUP_C.completeRead(o), outcome);
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
      await scene("verified");
      assert.equal(await page.locator(".mobile").isVisible(), width === 390);
      assert.equal(await page.locator(".tools").isVisible(), width === 1440);
      assert.equal(await page.locator("tbody tr").count(), 10);
      assert.equal(await page.locator("[data-detail]").count(), 10);
      for (const key of [
        "verified",
        "blocked",
        "stale",
        "empty",
        "no-drill",
        "null-measurements",
        "past-exact-expiry",
        "window-no-backup",
      ]) {
        await scene(key);
        assert.deepEqual((await state()).data, data.datasets[key]);
      }
      for (const key of [
        "null-measurements",
        "negative-measurements",
        "no-finished-at",
        "past-exact-expiry",
        "future-drill",
        "window-no-backup",
      ]) {
        await scene(key);
        assert.equal(await page.locator("#fact-warning").count(), 1);
      }
      for (const days of [30, 120]) {
        await scene(`policy-${days}`);
        assert.ok((await page.locator(".drill h3").innerText()).includes(`${days} 天`));
      }
      await scene("zero-size");
      assert.ok((await page.locator("tbody tr").first().innerText()).includes("0.0 MB"));
      await scene("original");
      assert.equal((await state()).data.latest_drill, null);
      assert.equal((await state()).data.targets.length, 1);
      await scene("verified");
      await page.locator("aside a").nth(1).click();
      assert.equal((await state()).reads.length, 0);
      assert.equal(
        await page.locator("#assets").evaluate((n) => n === document.activeElement),
        true,
      );
      if (width === 1440) {
        await page.locator("#column-menu summary").click();
        for (let i = 0; i < 6; i++) await page.locator(`[data-col="${i}"]`).uncheck();
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
      for (const kind of ["mysql_full", "mysql_binlog", "evidence", "export", "config"]) {
        await scene("detail-" + kind);
        const d = page.locator("dialog");
        for (const t of ["角色", "区域", "数量", "体积", "加密", "完整性", "最新资产时间"])
          assert.ok((await d.innerText()).includes(t));
        await d.locator("summary").click();
        assert.ok((await d.innerText()).includes(kind));
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
      await scene("detail-config");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await scene("verified");
      await page.locator("#refresh").click();
      const pending = (await state()).pending;
      await page.evaluate(() => window.BACKUP_C.read());
      assert.equal((await state()).reads.length, 1);
      assert.equal(await page.locator("#refresh").isDisabled(), true);
      await done("timeout");
      assert.equal((await state()).data.state, "verified");
      assert.equal((await state()).failure, "timeout");
      await page.locator("#retry").click();
      await done();
      assert.equal((await state()).failure, null);
      await scene("verified");
      assert.equal(
        await page.evaluate((id) => window.BACKUP_C.completeRead("success", id), pending),
        false,
      );
      for (const outcome of ["rate_limited", "unavailable", "timeout", "expired", "forbidden"]) {
        await scene("verified");
        await page.locator("#refresh").click();
        await done(outcome);
        assert.equal(Boolean((await state()).data), !["expired", "forbidden"].includes(outcome));
        if (outcome === "expired") {
          await page.locator("#login").click();
          assert.deepEqual((await state()).navigation, ["/login"]);
        }
        if (outcome === "forbidden") assert.equal(await page.locator("#retry").count(), 0);
      }
      for (const outcome of ["rate_limited", "unavailable", "timeout"]) {
        await scene(outcome);
        assert.equal((await state()).data, null);
        await page.locator("#retry").click();
        await done();
        assert.equal((await state()).data.state, "verified");
      }
      await scene("copy-denied");
      assert.ok((await page.locator("#request-tech-feedback").innerText()).includes("被拒绝"));
      await scene("copy-success");
      assert.ok(
        (await page.locator("#request-tech-feedback").innerText()).includes("未写入系统剪贴板"),
      );
      await scene("refresh-unavailable");
      await page.locator("#refresh-tech summary").click();
      await page.locator('[data-copy="refresh-tech"]').click();
      assert.ok((await page.locator("#refresh-tech-feedback").innerText()).includes("已复制"));
      await scene("verified");
      await page.locator("#review-tools summary").click();
      await layout(page, `${width}/review-tools`);
      await page.locator("#scene").selectOption("blocked");
      assert.equal((await state()).data.state, "blocked");
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("verified");
        await page.locator("#review-tools summary").click();
        await layout(page, `${w}/review-tools`);
        for (const key of [
          "verified",
          "long",
          "detail-long",
          "null-measurements",
          "columns-open",
        ]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
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
        `${width}: service datasets/partial original kept, signed/null/expiry warnings, policy30/120, zero-size, page-nav focus, seven columns/min-one/freeze/density on desktop, five complete asset details with Tab/Escape/backdrop/close, mobile return focus, single-flight and late-read rejection, snapshot retention versus 401/403 clearing, retries/login intent, two copy consumers, scene selector, six breakpoints/CSS zoom2/font/touch metrics; no HTTP/cookies/storage.`,
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
          proposal: "BACKUP-RECOVERY-C-r1",
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
            ([key, title]) =>
              `| ${title} (${key}) | ` +
              [1440, 390]
                .map((w) =>
                  screenshots
                    .filter((s) => s.scene === key && s.width === w)
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
      "backup.css",
      "backup.js",
      "data.js",
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
