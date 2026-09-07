import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "../../scripts/lib/ui-phase2-prototype-metrics.mjs";

test("prototype measurements reject undersized type and controls using computed browser geometry", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <style>body { font-size:16px } button { font-size:12px; width:80px; height:44px }</style>
      <button>提交</button><p>正文</p><small style="display:none;font-size:10px">隐藏文字</small>
    `);
    await assert.rejects(() => checkPrototypeMetrics(page), /font\/touch-size contract/);
    await page.locator("button").evaluate((node) => {
      node.style.fontSize = "16px";
      node.style.height = "30px";
    });
    await assert.rejects(() => checkPrototypeMetrics(page), /font\/touch-size contract/);
    await page.locator("button").evaluate((node) => (node.style.height = "44px"));
    const valid = await checkPrototypeMetrics(page);
    assert.equal(valid.controlsChecked, 1);
    assert.equal(valid.minControlFont, 16);
    assert.equal(valid.minTextFont, 16);
    await page.locator("p").evaluate((node) => (node.style.fontSize = "12px"));
    await assert.rejects(() => checkPrototypeMetrics(page), /font\/touch-size contract/);
  } finally {
    await browser.close();
  }
});
