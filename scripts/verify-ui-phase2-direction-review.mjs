import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "design-plans/ui-phase-2-2026-09-07");
const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === "--capture"));
const capture = args.includes("--capture");
execFileSync(process.execPath, ["scripts/build-ui-phase2-direction-review.mjs", "--check"], {
  cwd: repo,
  stdio: "inherit",
});
const browser = await chromium.launch({ headless: true });
const outputs = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (event) => {
        if (event.type() === "error") errors.push(event.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "direction-review.html")).href);
      await page.evaluate(() => document.fonts.ready);
      const data = await page.evaluate(() => window.SCOUTOPS_DIRECTION_REVIEW);
      assert.equal(data.shots.length, 106);
      assert.equal(data.approval, "pending-user-review");
      await page.locator("#new-image").evaluate((img) => img.decode());
      if (capture) {
        const file = `direction-review-${width}.png`;
        await page.screenshot({
          path: path.join(root, file),
          fullPage: true,
          animations: "disabled",
        });
        outputs.push({
          file,
          width,
          sha256: createHash("sha256")
            .update(await readFile(path.join(root, file)))
            .digest("hex"),
        });
      }
      for (const shot of data.shots) {
        await page.locator("#surface").selectOption(shot.surface);
        await page.locator("#direction").selectOption(shot.direction);
        await page.locator("#scene").selectOption(shot.state);
        await page.locator("#viewport").selectOption(String(shot.width));
        assert.equal(await page.locator("#new-image").getAttribute("src"), shot.file);
        await page.locator("#new-image").evaluate((img) => img.decode());
        assert.equal(await page.locator("#new-original").getAttribute("href"), shot.file);
        assert.match(await page.locator("#new-evidence").textContent(), new RegExp(shot.sha256));
        if (shot.baseline) {
          assert.equal(await page.locator("#old-image").getAttribute("src"), shot.baseline.file);
          await page.locator("#old-image").evaluate((img) => img.decode());
          assert.match(
            await page.locator("#old-evidence").textContent(),
            new RegExp(shot.baseline.revision),
          );
          assert.equal(await page.locator("#old-missing").isVisible(), false);
        } else {
          assert.equal(await page.locator("#old-image").getAttribute("src"), null);
          assert.equal(await page.locator("#old-missing").isVisible(), true);
          assert.equal(await page.locator("#old-original").isVisible(), false);
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          `${width}/${shot.file}: overflow`,
        );
      }
      await page.locator("#surface").selectOption("accounts");
      assert.equal(await page.locator("#direction option").count(), 1);
      assert.equal(await page.locator("#direction").inputValue(), "clear");
      await page.locator("#scene").selectOption("membership");
      await page.locator("#decision").selectOption("修改当前方向后重新审核");
      await page.locator("#notes").fill("<script>这只是审核文字</script> 移动授权弹窗需要调整");
      await page.getByRole("button", { name: "生成本次审核回复" }).click();
      const reply = await page.locator("#reply").inputValue();
      assert.ok(
        reply.includes(data.fingerprint) &&
          reply.includes("P43") &&
          reply.includes("加入组织") &&
          reply.includes("<script>这只是审核文字</script>"),
      );
      assert.match(await page.locator("#feedback-status").textContent(), /尚未发送或保存/);
      await page.locator("#scene").selectOption("directory");
      assert.equal(await page.locator("#reply").inputValue(), "");
      assert.equal(await page.locator("#reply-label").isVisible(), false);
      assert.equal(await page.locator("#decision").inputValue(), "");
      await page.getByRole("button", { name: "生成本次审核回复" }).click();
      assert.equal(
        await page.locator("#decision").evaluate((node) => node.validity.valueMissing),
        true,
      );
      await page.locator("#surface").selectOption("tasks");
      assert.equal(await page.locator("#direction option").count(), 2);
      await page.locator("#surface").focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#direction").evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.locator("#surface").evaluate((node) => node === document.activeElement),
        true,
      );
      const smallTargets = await page
        .locator("a,button,select,textarea,summary")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => node.checkVisibility())
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.width < 44 || rect.height < 44;
            })
            .map((node) => node.id || node.textContent),
        );
      assert.deepEqual(smallTargets, []);
      assert.equal(
        await page.evaluate(() => window.SCOUTOPS_DIRECTION_REVIEW.approval),
        "pending-user-review",
      );
      assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `direction_review_browser width=${width} scenes=106 exactImagesAndBaselines=passed feedback=passed keyboard=passed targets=passed errors=0 network=0 approval=pending`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    path.join(root, "direction-review-evidence.json"),
    JSON.stringify(
      {
        kind: "review-ui-not-new-page-design",
        capturedAt: new Date().toISOString(),
        outputs,
        browser: browser.version(),
        platform: process.platform,
        dataSha256: createHash("sha256")
          .update(
            (await readFile(path.join(root, "direction-review-data.js"), "utf8")).replaceAll(
              "\r\n",
              "\n",
            ),
          )
          .digest("hex"),
        approval: "pending-user-review",
      },
      null,
      2,
    ) + "\n",
  );
