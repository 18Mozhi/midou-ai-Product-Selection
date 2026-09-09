import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "design-plans/ui-phase-2-2026-09-07");
const capture = process.argv.includes("--capture");
if (process.argv.slice(2).some((argument) => argument !== "--capture"))
  throw new Error("Only --capture is supported");
const allowed = new Map([
  ["/review.html", ["review.html", "text/html"]],
  ["/review.css", ["review.css", "text/css"]],
  ["/review.js", ["review.js", "text/javascript"]],
  ["/review-data.js", ["review-data.js", "text/javascript"]],
  ["/review-evidence.js", ["review-evidence.js", "text/javascript"]],
]);
const server = createServer(async (request, response) => {
  const asset = allowed.get(new URL(request.url, "http://127.0.0.1").pathname);
  if (!asset) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  try {
    const body = await readFile(path.join(root, asset[0]));
    response.writeHead(200, { "content-type": `${asset[1]}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(500);
    response.end("Asset unavailable");
  }
});
let browser;
const results = [];
const proof = [];
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${base}/review.html`, { waitUntil: "load" });
    assert.equal(await page.locator(".page-entry").count(), 73);
    assert.equal(await page.getByText("用户验收通过", { exact: true }).count(), 1);
    assert.equal(
      await page.evaluate(
        () =>
          window.SCOUTOPS_PHASE2_EVIDENCE.pages.filter((item) => item.packages.length > 0).length,
      ),
      73,
    );
    await page.locator("#page-search").fill("P16");
    assert.equal(await page.locator(".proposal-materials .material-card").count(), 1);
    assert.equal(await page.locator(".vue-materials .material-card").count(), 2);
    const vueLinks = await page
      .locator(".vue-materials a")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    assert.ok(vueLinks.includes("../../output/playwright/p16-c-r2-review/index.html"));
    assert.ok(vueLinks.includes("../../output/playwright/p16-c-r2-fields-review/index.html"));
    assert.equal(await page.getByText("设计图 · 未交付", { exact: true }).count(), 0);
    assert.equal(await page.locator("#counts .count").last().locator("strong").textContent(), "0");
    await page.locator("#page-search").fill("P26");
    assert.equal(await page.locator(".vue-materials .material-card").count(), 0);
    assert.ok(
      (await page.locator(".vue-materials").textContent()).includes("不据此断言该页没有实现"),
    );
    // Preserve old notes even though the design evidence index is newer than the baseline.
    await page.evaluate(() =>
      localStorage.setItem(
        `scoutops-phase2-review:${window.SCOUTOPS_PHASE2.fingerprint}`,
        JSON.stringify([
          {
            target: "P16",
            reviewer: "历史审核者",
            body: "旧清单意见保留",
            decision: "question",
            fingerprint: window.SCOUTOPS_PHASE2.fingerprint,
            createdAt: "2026-09-07T00:00:00Z",
          },
        ]),
      ),
    );
    await page.reload({ waitUntil: "load" });
    await page.locator("#page-search").fill("P16");
    assert.equal(await page.locator(".review-note").count(), 1);
    assert.match(await page.locator(".review-note").textContent(), /旧清单意见保留/u);
    await page.evaluate(() =>
      localStorage.removeItem(`scoutops-phase2-review:${window.SCOUTOPS_PHASE2.fingerprint}`),
    );
    await page.reload({ waitUntil: "load" });
    await page.locator("#batch-filter").selectOption("W04");
    assert.equal(await page.locator(".page-entry").count(), 9);
    await page.locator("#page-search").fill("不存在的关键词-qa");
    assert.equal(await page.locator(".page-entry").count(), 0);
    assert.equal(await page.getByRole("heading", { name: "没有匹配页面" }).count(), 1);
    await page.locator("#page-search").fill("");
    await page.locator("#batch-filter").selectOption("");
    await page.locator("#acceptance-filter").selectOption("internal");
    assert.equal(await page.locator(".page-entry").count(), 1);
    assert.equal(await page.getByText("生产不可达 · 待验证", { exact: true }).count(), 1);
    await page.locator("#acceptance-filter").selectOption("");
    await page.locator("#page-search").fill("P18");
    await page.getByRole("button", { name: "记录页面意见", exact: true }).click();
    assert.equal(await page.locator("#note-dialog").evaluate((node) => node.open), true);
    assert.equal(
      await page.locator("#reviewer").evaluate((node) => node === document.activeElement),
      true,
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .locator("#note-form button[type=submit]")
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#note-dialog").evaluate((node) => node.open), false);
    assert.equal(
      await page
        .getByRole("button", { name: "记录页面意见", exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "记录页面意见", exact: true }).click();
    await page.locator("#reviewer").fill("隔离审核测试");
    await page.locator("#note-body").fill("<img src=x onerror=alert(1)> 需补充移动态图");
    await page.getByRole("button", { name: "保存批注", exact: true }).click();
    assert.equal(await page.locator(".review-note").count(), 1);
    assert.equal(await page.locator(".review-note img").count(), 0);
    await page.reload({ waitUntil: "load" });
    await page.locator("#page-search").fill("P18");
    assert.equal(await page.locator(".review-note").count(), 1);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出审核意见 ↓", exact: true }).click();
    const download = await downloading;
    const temporaryDownload = await download.path();
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(exported.notes.length, 1);
    assert.equal(exported.notes[0].target, "P18");
    assert.equal(exported.notes[0].decision, "needs-change");
    assert.equal(exported.schemaVersion, 1);
    assert.deepEqual(Object.keys(exported).sort(), [
      "exportedAt",
      "notes",
      "schemaVersion",
      "sourceFingerprint",
    ]);
    await download.delete();
    console.log(`temporary_review_download_deleted ${temporaryDownload}`);
    await page.locator("#control-kind").selectOption("dialog-component-call");
    assert.ok((await page.locator(".candidate").count()) > 0);
    await page.locator(".candidate summary").first().click();
    await page.getByRole("button", { name: "记录此候选意见", exact: true }).first().click();
    assert.match(await page.locator("#note-target").textContent(), /\.vue#/u);
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await page.locator("#control-kind").selectOption("");
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    assert.match(await page.locator("#control-pager").textContent(), /2 \/ /u);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "page must not horizontally overflow",
    );
    assert.ok(
      await page
        .locator("button, input, select")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => node.getClientRects().length)
            .every((node) => node.getBoundingClientRect().height >= 44),
        ),
      "visible controls must keep 44px height",
    );
    assert.deepEqual(errors, []);
    // These are only this isolated browser context's scratch review notes.
    await page.evaluate(() =>
      localStorage.removeItem(`scoutops-phase2-review:${window.SCOUTOPS_PHASE2.fingerprint}`),
    );
    await page.reload({ waitUntil: "load" });
    await page.locator("#page-search").fill("P16");
    if (capture) {
      await mkdir(path.join(root, "review-proof"), { recursive: true });
      await page.screenshot({
        path: path.join(root, "review-proof", `${viewport.width}.png`),
        fullPage: true,
      });
      proof.push({
        kind: "local-review-tool-not-product-page",
        file: `${viewport.width}.png`,
        viewport,
        sourceFingerprint: await page.evaluate(() => window.SCOUTOPS_PHASE2.fingerprint),
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        platform: process.platform,
        sha256: createHash("sha256")
          .update(await readFile(path.join(root, "review-proof", `${viewport.width}.png`)))
          .digest("hex"),
      });
    }
    results.push({
      viewport,
      routeCount: 73,
      filters: "passed",
      focus: "passed",
      notesAndExport: "passed",
      currentEvidenceAndHistoricalNotes: "passed",
      overflow: "passed",
      errors: errors.length,
    });
    await context.close();
  }
  console.log(`ui_phase2_review_verified ${JSON.stringify(results)}`);
  if (capture) {
    const inputs = {};
    for (const file of [
      "review.html",
      "review.js",
      "review.css",
      "review-data.js",
      "review-evidence.js",
    ])
      inputs[file] = createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex");
    await writeFile(
      path.join(root, "review-proof", "manifest.json"),
      JSON.stringify({ schemaVersion: 1, inputs, proof, results }, null, 2) + "\n",
      "utf8",
    );
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
