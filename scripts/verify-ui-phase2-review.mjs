import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "design-plans/ui-phase-2-2026-09-07");
const capture = process.argv.includes("--capture");
const captureRecent = process.argv.includes("--capture-recent");
if (
  process.argv.slice(2).some((argument) => !["--capture", "--capture-recent"].includes(argument)) ||
  (capture && captureRecent)
)
  throw new Error("Use no argument, --capture or --capture-recent, separately");
const recentBox = { window: {} };
vm.runInNewContext(
  await readFile(path.join(root, "review-recent-materials.js"), "utf8"),
  recentBox,
);
const recentMaterials = recentBox.window.SCOUTOPS_PHASE2_RECENT_MATERIALS.materials;
const recentProof = [];
const allowed = new Map([
  ["/review.html", ["review.html", "text/html"]],
  ["/review.css", ["review.css", "text/css"]],
  ["/review.js", ["review.js", "text/javascript"]],
  ["/review-data.js", ["review-data.js", "text/javascript"]],
  ["/review-evidence.js", ["review-evidence.js", "text/javascript"]],
  ["/review-recent-materials.js", ["review-recent-materials.js", "text/javascript"]],
]);
for (const item of recentMaterials)
  for (const preview of item.previews) {
    const file = decodeURIComponent(preview.file);
    const absolute = path.resolve(root, file);
    assert.ok(absolute.startsWith(repo + path.sep), "Preview must stay in this repository");
    allowed.set(new URL(preview.file, "http://127.0.0.1/review.html").pathname, [
      file,
      "image/png",
    ]);
  }
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
  console.log(`review_verification_host ${base}`);
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
    assert.equal(await page.locator(".proposal-materials .material-card").count(), 2);
    assert.equal(
      await page
        .locator('.proposal-materials a[href="design/shell-journey-direction-c/index.html"]')
        .count(),
      1,
    );
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
    await page.locator("#page-search").fill("P36");
    assert.equal(await page.locator(".vue-materials .material-card").count(), 1);
    assert.equal(
      await page
        .locator(
          '.vue-materials a[href="../../output/playwright/p36-mobile-filters-vue/index.html"]',
        )
        .count(),
      1,
    );
    assert.ok(
      (await page.locator(".vue-materials").innerText()).includes("本地样例不代表真实后端或生产"),
    );
    assert.ok(
      await page.evaluate(() =>
        window.SCOUTOPS_PHASE2_EVIDENCE.pages
          .find((p) => p.id === "P36")
          .actualVue[0].scope.includes("不是父级/API/生产验收"),
      ),
    );
    const gallery = await context.newPage();
    try {
      await gallery.goto(
        pathToFileURL(path.join(repo, "output/playwright/p36-mobile-filters-vue/index.html")).href,
      );
      assert.equal(await gallery.locator("article img").count(), 10);
      await gallery.locator("article img").last().scrollIntoViewIfNeeded();
      // Load each lazy image by native scrolling; no replacement graphics or new PNG output.
      for (const img of await gallery.locator("article img").all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate((n) => n.decode());
        assert.ok(await img.evaluate((n) => n.naturalWidth > 0));
      }
      assert.ok(await gallery.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    } finally {
      await gallery.close();
    }
    const recentPageIds = [...new Set(recentMaterials.map((item) => item.page))];
    for (const pageId of recentPageIds) {
      await page.locator("#page-search").fill(pageId);
      const items = recentMaterials
        .filter((item) => item.page === pageId)
        .sort(
          (a, b) =>
            Number(a.sourceStatus !== "source-matched-at-index-build") -
            Number(b.sourceStatus !== "source-matched-at-index-build"),
        );
      assert.equal(await page.locator(".recent-material").count(), items.length);
      assert.equal(
        await page.locator(".recent-material").first().getAttribute("data-material-id"),
        items[0].id,
      );
      assert.ok(!(await page.locator(".vue-materials").innerText()).includes("尚未登记该页"));
      for (const item of items) {
        const card = page.locator(`[data-material-id="${item.id}"]`);
        assert.equal(
          await card
            .getByRole("link", { name: (item.galleryLabel ?? "完整实施图册") + " ↗", exact: true })
            .getAttribute("href"),
          item.gallery,
        );
        assert.ok((await card.innerText()).includes(item.manifestSha256.slice(0, 12)));
        assert.equal(
          await card.locator(".material-differences").count(),
          item.sourceDifferences.length ? 1 : 0,
        );
        if (item.sourceDifferences.length) {
          await card.locator(".material-differences summary").click();
          assert.equal(
            await card.locator(".material-differences li").count(),
            item.sourceDifferences.length,
          );
          await card.locator(".material-differences summary").click();
        }
        const summary = card.locator(".material-previews summary");
        await summary.focus();
        await page.keyboard.press("Space");
        assert.equal(await card.locator(".material-previews").evaluate((el) => el.open), true);
        for (const img of await card.locator("img").all()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate((el) => el.decode());
          assert.ok(await img.evaluate((el) => el.naturalWidth > 0 && Boolean(el.alt)));
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await summary.click();
      }
      const first = items[0];
      const card = page.locator(`[data-material-id="${first.id}"]`);
      if (captureRecent) {
        // Capture before adding scratch notes; originals and prior review screenshots stay intact.
        await card.locator(".material-previews summary").click();
        for (const img of await card.locator("img").all()) await img.evaluate((el) => el.decode());
        const directory = path.join(root, "review-proof/recent-materials");
        await mkdir(directory, { recursive: true });
        const file = `${viewport.width}-${pageId}.png`;
        const bytes = await page
          .locator(".vue-materials")
          .screenshot({ path: path.join(directory, file), animations: "disabled" });
        recentProof.push({
          file,
          pageId,
          viewport,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          kind: "review-tool-not-new-product-design",
        });
      }
      await card.getByRole("button", { name: "记录这组图的意见", exact: true }).click();
      assert.equal(
        await page.locator("#note-target").textContent(),
        `${pageId}/${first.id}@${first.manifestSha256}`,
      );
      await page.keyboard.press("Escape");
      assert.ok(await card.locator("button").evaluate((el) => el === document.activeElement));
      await card.locator("button").click();
      await page.locator("#reviewer").fill("隔离材料审核");
      await page.locator("#note-body").fill(`${pageId} <img src=x> 图组意见`);
      await page.getByRole("button", { name: "保存批注", exact: true }).click();
      assert.equal(await card.locator(".review-note").count(), 1);
      assert.equal(await card.locator(".review-note img").count(), 0);
      await page.reload({ waitUntil: "load" });
      await page.locator("#page-search").fill(pageId);
      assert.equal(await card.locator(".review-note").count(), 1);
    }
    const materialExport = page.waitForEvent("download");
    await page.locator("#export-notes").click();
    const materialDownload = await materialExport;
    const materialDownloadPath = await materialDownload.path();
    const materialStream = await materialDownload.createReadStream();
    const materialChunks = [];
    for await (const chunk of materialStream) materialChunks.push(chunk);
    const materialNotes = JSON.parse(Buffer.concat(materialChunks).toString("utf8"));
    assert.equal(materialNotes.schemaVersion, 1);
    assert.equal(materialNotes.notes.length, recentPageIds.length);
    for (const note of materialNotes.notes)
      assert.match(note.target, /^P(?:34|44|46|47|57|58)\/p\d{2}-[\w-]+@[a-f0-9]{64}$/);
    await materialDownload.delete();
    console.log(`temporary_review_download_deleted ${materialDownloadPath}`);
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
      supplementalMaterialsAndVersionedNotes: "passed",
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
      "review-recent-materials.js",
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
  if (captureRecent) {
    const inputs = {};
    for (const file of [
      "review.html",
      "review.js",
      "review.css",
      "review-data.js",
      "review-evidence.js",
      "review-recent-materials.js",
    ])
      inputs[file] = createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex");
    await writeFile(
      path.join(root, "review-proof/recent-materials/manifest.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          scope: "review-tool-only-not-product-approval",
          inputs,
          recentProof,
          results,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
