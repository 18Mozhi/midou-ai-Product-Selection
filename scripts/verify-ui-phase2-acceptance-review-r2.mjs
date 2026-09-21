import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { acceptanceCaptureRoot } from "./lib/ui-phase2-acceptance-current-capture.mjs";
import { buildAcceptanceReviewR2 } from "./lib/ui-phase2-acceptance-review-r2.mjs";

assert.ok(
  process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--capture"),
);
const capture = process.argv.includes("--capture");
const indexSource = await readFile(`${acceptanceCaptureRoot}/index.html`, "utf8");
const summarySource = await readFile(`${acceptanceCaptureRoot}/review.json`, "utf8");
const summary = JSON.parse(summarySource);
const checked = await buildAcceptanceReviewR2(process.cwd());
assert.equal(indexSource, checked.html);
assert.deepEqual(summary, checked.summary);
const url = pathToFileURL(path.resolve(acceptanceCaptureRoot, "index.html")).href;
const proof = `${acceptanceCaptureRoot}/${summary.sourceMatchesCurrent ? "review-proof" : "review-proof-versioned"}`;
if (capture) await mkdir(proof);
const browser = await chromium.launch(),
  runs = [],
  images = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        external = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.route(/^https?:/, (route) => {
        external.push(route.request().url());
        return route.abort();
      });
      await page.goto(url);
      assert.equal(await page.title(), "P49 · 设计图审核 r2");
      await page.locator(".version-status").waitFor();
      if (!summary.sourceMatchesCurrent) {
        assert.ok(
          (await page.locator(".version-status").innerText()).includes("当前源码已有后续改动"),
        );
        assert.equal(await page.getByText("捕获版本 · r2 · 待审核", { exact: true }).count(), 1);
        for (const section of summary.sections) {
          assert.ok(
            (await page.locator(`#${section.stage} > p`).first().innerText()).includes(
              `${section.sourceChanges.length}处后续源码变更`,
            ),
          );
        }
      }
      assert.equal(await page.locator("figure").count(), 145);
      assert.equal(await page.locator("details[open]").count(), 0);
      await page
        .getByText("现有导航壳尚未重构；长图中的固定导航可能出现在截图中段。", { exact: true })
        .waitFor();
      for (const section of summary.sections) {
        const root = page.locator(`#${section.stage}`),
          toggle = root.locator("summary");
        await toggle.focus();
        await page.keyboard.press("Space");
        assert.equal(await root.locator("details[open]").count(), 1);
        assert.equal(await root.locator("figure").count(), section.count);
        const last = root.locator("img").last();
        await last.scrollIntoViewIfNeeded();
        await page.waitForFunction(
          (src) =>
            [...document.images].some(
              (img) => img.getAttribute("src") === src && img.complete && img.naturalWidth > 0,
            ),
          await last.getAttribute("src"),
        );
        await toggle.focus();
        assert.equal(await toggle.evaluate((node) => node.matches(":focus-visible")), true);
        assert.ok((await toggle.boundingBox()).height >= 44);
        await page.keyboard.press("Space");
        assert.equal(await root.locator("details[open]").count(), 0);
      }
      const original = page.locator(".hero .original").first();
      await page.getByRole("link", { name: "查看版本差异", exact: true }).click();
      assert.ok(page.url().endsWith("review.json"));
      await page.goBack();
      await original.click();
      assert.ok(page.url().endsWith("1440-authoritative-2-of-3.png"));
      await page.goBack();
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".hero img")].every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      );
      await page.evaluate(() => scrollTo(0, 0));
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      if (capture) {
        const bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
        const file = `${width}-review-index.png`;
        await writeFile(`${proof}/${file}`, bytes);
        images.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
        if (width === 390) {
          const region = await page
            .locator(".version-status")
            .screenshot({ animations: "disabled" });
          const regionFile = "390-version-status.png";
          await writeFile(`${proof}/${regionFile}`, region);
          images.push({
            file: regionFile,
            sha256: createHash("sha256").update(region).digest("hex"),
          });
        }
      }
      runs.push({
        width,
        sections: 5,
        images: 143,
        overflow: false,
        errors,
        external,
        nativeKeyboard: true,
        originalImageNavigation: true,
        versionStatusVisible: true,
        sourceMatchesCurrent: summary.sourceMatchesCurrent,
        versionLinkNavigation: true,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    `${proof}/evidence.json`,
    JSON.stringify(
      {
        kind: "P49-REVIEW-TOOL-VERSION-STATUS-r1",
        indexSha256: createHash("sha256").update(indexSource).digest("hex"),
        summarySha256: createHash("sha256").update(summarySource).digest("hex"),
        sourceMatchesCurrent: summary.sourceMatchesCurrent,
        runs,
        images,
        browserClosed: true,
        productAcceptance: false,
      },
      null,
      2,
    ) + "\n",
  );
console.log(JSON.stringify({ runs, captures: images.length, browserClosed: true }));
