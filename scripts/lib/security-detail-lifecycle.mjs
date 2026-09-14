export async function verifySecurityDetailLifecycle({
  page,
  surface,
  check,
  width,
  deferRead,
  snapshot,
  capture,
}) {
  const trigger = surface.locator(".responsive-data-view__mobile article > button");
  const dialog = page.getByRole("dialog", { name: "查看安全运营事实", exact: true });
  const desktopWidth = width === 390 ? 1440 : 761;
  await trigger.focus();
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "visible" });
  await page.setViewportSize({ width: desktopWidth, height: 1000 });
  check(await dialog.isVisible(), true, "resize retains the open record");
  check(await trigger.isVisible(), false, "original mobile trigger is now hidden");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  const returned = await surface.locator(".responsive-data-view").evaluate((node) => ({
    within: node.contains(document.activeElement),
    visible: document.activeElement?.checkVisibility({ visibilityProperty: true }) ?? false,
    activeTag: document.activeElement?.tagName,
  }));
  check(
    returned.within && returned.visible,
    true,
    `close after resize has a visible local focus target (${returned.activeTag})`,
  );
  await page.waitForFunction(
    () => {
      const node = document.activeElement;
      return (
        node?.matches(".responsive-data-view:focus-visible") &&
        getComputedStyle(node).outlineColor === "rgb(47, 110, 229)"
      );
    },
    undefined,
    { timeout: 3000 },
  );
  check(
    await surface
      .locator(".responsive-data-view")
      .evaluate((node) => getComputedStyle(node).outlineColor),
    "rgb(47, 110, 229)",
    "C fallback focus is blue",
  );
  // A tight region crop cuts off the 3px outline outside the group; capture the real viewport.
  await surface
    .locator(".responsive-data-view")
    .evaluate((node) => node.scrollIntoView({ block: "center" }));
  await capture("audit", "desktop-focus-return");
  check(
    await page.locator("#app").evaluate((node) => node.inert),
    false,
    "resized close releases background",
  );
  await page.keyboard.press("Tab");
  check(
    await surface
      .locator(".responsive-data-view")
      .evaluate((node) => node.contains(document.activeElement)),
    true,
    "keyboard continues within the visible desktop record list",
  );

  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await trigger.click();
  await dialog.waitFor({ state: "visible" });
  await page.setViewportSize({ width: desktopWidth, height: 1000 });
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  check(
    await trigger.evaluate((node) => node === document.activeElement),
    true,
    "round-trip resize still restores the original visible trigger",
  );

  await trigger.click();
  await dialog.waitFor({ state: "visible" });
  await page.goBack();
  await page.waitForURL(/view=credentials/);
  await page.waitForFunction(() => !!document.querySelector('.security-grid[aria-busy="false"]'));
  check(
    await page.locator(".responsive-data-view__overlay").count(),
    0,
    "browser Back removes old-view drawer",
  );
  check(
    await page.locator("#app").evaluate((node) => node.inert),
    false,
    "browser Back releases background",
  );
  check(
    await surface.locator(".responsive-data-view__mobile article > button").count(),
    2,
    "new credentials and tokens remain usable",
  );

  // Begin a same-query refresh before opening a retained row; deliver only after the drawer opens.
  const updated = snapshot("credentials");
  updated.organization_tokens[0].last_used_at = updated.observed_at;
  const pending = deferRead(updated);
  await surface.getByRole("button", { name: "刷新数据", exact: true }).click();
  await pending.arrived;
  const tokenTrigger = surface.getByRole("button", { name: /报表客户端/ });
  await tokenTrigger.click();
  const tokenDialog = page.getByRole("dialog", { name: "报表客户端", exact: true });
  await tokenDialog.waitFor({ state: "visible" });
  const lastUsed = tokenDialog
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: "最近使用" }) })
    .locator("dd");
  check(await lastUsed.innerText(), "未设置", "pending refresh retains the original record");
  pending.release();
  const expected = await page.evaluate(
    (value) => new Date(value).toLocaleString("zh-CN"),
    updated.observed_at,
  );
  await page.waitForFunction(
    (value) =>
      [...document.querySelectorAll(".responsive-data-view__drawer dd")].some(
        (node) => node.textContent === value,
      ),
    expected,
  );
  check(
    await lastUsed.innerText(),
    expected,
    "same identity updates the open record from the new snapshot",
  );
  check(await tokenDialog.isVisible(), true, "same identity refresh keeps the drawer open");
  check(
    await tokenDialog
      .getByRole("button", { name: "关闭详情" })
      .evaluate((node) => node === document.activeElement),
    true,
    "same identity refresh keeps dialog focus",
  );
  await page.keyboard.press("Escape");
  await tokenDialog.waitFor({ state: "detached" });
  check(
    await tokenTrigger.evaluate((node) => node === document.activeElement),
    true,
    "updated record returns to its current visible trigger",
  );
  check(
    await page.locator("#app").evaluate((node) => node.inert),
    false,
    "updated record close releases background",
  );
}
