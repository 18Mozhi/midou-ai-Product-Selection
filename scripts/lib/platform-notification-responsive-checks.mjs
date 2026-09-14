import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function checkNotificationResponsive({ page, width, checks, shot }) {
  const frame = page.locator(".role-navigation-frame");
  const brand = page.locator(".role-brand");
  const trigger = page.getByRole("button", { name: "打开导航菜单", exact: true });
  const url = page.url();
  await page.setViewportSize({ width: 840, height: 1000 });
  await trigger.click();
  await expect(frame).toBeVisible();
  assert.ok(await frame.evaluate((el) => el.matches(":modal")));
  await page.setViewportSize({ width: 841, height: 1000 });
  await expect(frame).toBeVisible();
  await expect.poll(() => frame.evaluate((el) => el.matches(":modal"))).toBe(false);
  await expect(brand).toBeFocused();
  checks.push({ name: "840-open-menu-to-841-visible-brand" });

  await frame.getByRole("searchbox", { name: "搜索导航菜单" }).focus();
  await page.setViewportSize({ width: 840, height: 1000 });
  await expect(frame).not.toBeVisible();
  await expect(brand).toBeFocused();
  checks.push({ name: "841-focused-menu-to-840-visible-brand" });

  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(frame).not.toBeVisible();
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => frame.evaluate((el) => el.matches(":modal"))).toBe(false);
  await expect(brand).toBeFocused();
  await page.setViewportSize({ width: width, height: 1000 });
  if (width <= 840) await expect(frame).not.toBeVisible();
  else await expect(frame).toBeVisible();
  assert.equal(page.url(), url);
  assert.equal(await page.locator("#role-navigation").count(), 1);
  checks.push({ name: "390-1440-resize-restores-original-route-and-single-menu" });

  const workspace = page.locator(".platform-notifications");
  const reading = await workspace
    .locator(".message-workbench__body > .message-reader")
    .evaluate((el) => {
      const badge = el.querySelector("header > i"),
        r = badge.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(badge);
      return {
        width: el.getBoundingClientRect().width,
        badgeHeight: r.height,
        textLines: [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
          .length,
      };
    });
  assert.ok(reading.width >= 300 && reading.textLines === 1, JSON.stringify({ width, reading }));
  checks.push({ name: "readable-inline-message-and-single-line-status", reading });
  for (const startWidth of [840, 841]) {
    await page.setViewportSize({ width: startWidth, height: 1000 });
    const begin = workspace.getByRole("button", { name: "新建草稿", exact: true });
    await begin.click();
    const editor = page.getByRole("dialog", { name: "新建平台消息草稿" });
    const title = editor.getByLabel("标题", { exact: true });
    await title.fill("本地视口切换草稿");
    await page.setViewportSize({ width: startWidth === 840 ? 841 : 840, height: 1000 });
    await expect(editor).toBeVisible();
    await expect(title).toBeFocused();
    await expect(title).toHaveValue("本地视口切换草稿");
    await page.keyboard.press("Escape");
    await expect(begin).toBeFocused();
    checks.push({ name: `editor-keeps-input-focus-across-${startWidth}` });
  }
  await page.setViewportSize({ width, height: 1000 });
  for (const [label, locator] of [
    ["new-draft", workspace.getByRole("button", { name: "新建草稿", exact: true })],
    [
      "message-next",
      workspace
        .getByRole("navigation", { name: "人工消息分页" })
        .getByRole("button", { name: "下一页" }),
    ],
    ["snapshot-trace", workspace.getByText("快照读取追踪", { exact: true })],
  ]) {
    await page.evaluate(() => scrollTo(0, 0));
    await locator.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(locator).toBeFocused();
    const geometry = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      const points = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + 3, r.top + 3],
        [r.right - 3, r.bottom - 3],
      ];
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
        viewportHeight: innerHeight,
        outline: s.outlineColor,
        hit: points.every(([x, y]) => el.contains(document.elementFromPoint(x, y))),
      };
    });
    assert.ok(
      geometry.hit && geometry.y >= 0 && geometry.bottom <= geometry.viewportHeight,
      JSON.stringify({ label, geometry }),
    );
    checks.push({ name: `keyboard-target-not-covered-${label}`, geometry });
  }
  await shot("responsive-bottom-keyboard", true);
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    scrollTo(0, 0);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const topbar = await page.locator(".role-topbar").evaluate((el) => {
    const r = el.getBoundingClientRect(),
      s = getComputedStyle(el);
    const brand = el.querySelector(".role-brand"),
      b = brand.getBoundingClientRect();
    return {
      y: r.y,
      height: r.height,
      visibility: s.visibility,
      opacity: s.opacity,
      brandHit: brand.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)),
    };
  });
  assert.ok(
    topbar.y === 0 &&
      topbar.height > 0 &&
      topbar.visibility === "visible" &&
      topbar.opacity === "1" &&
      topbar.brandHit,
    JSON.stringify(topbar),
  );
  checks.push({ name: "topbar-visible-after-editor-resize-and-scroll", topbar });
  await shot("responsive-first-viewport", true);
}
