export async function verifySecurityDetailRemoval({
  page,
  surface,
  check,
  width,
  deferRead,
  snapshot,
  capture,
  origin,
}) {
  const cases = [
    ["events", "security_events", "events", "登录失败", false],
    ["sessions", "sessions", "sessions", "security@example.test", false],
    ["credentials", "credential_assets", "credentials", "生产读取凭证", false],
    ["credentials", "organization_tokens", "tokens", "报表客户端", false],
    ["audit", "audit_events", "audit", "查看安全运营事实", false],
    ["audit", "audit_events", "audit", "查看安全运营事实", true],
  ];
  for (let index = 0; index < cases.length; index++) {
    const [view, key, regionKey, title, retainOther] = cases[index];
    if (index) await page.goto(`${origin}/platform-admin/security?view=${view}`);
    await page.waitForFunction(() => !!document.querySelector('.security-grid[aria-busy="false"]'));
    const region = surface.locator(`section[aria-labelledby="security-${regionKey}-heading"]`);
    const changed = snapshot(view);
    changed[key] = retainOther ? [{ ...changed[key][0], id: "a2" }] : [];
    changed.pagination[key] = {
      page: 1,
      page_size: 20,
      total: changed[key].length,
      total_pages: 1,
    };
    const pending = deferRead(changed);
    await surface.getByRole("button", { name: "刷新数据", exact: true }).click();
    await pending.arrived;
    await region.locator(".responsive-data-view__mobile article > button").focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await dialog.waitFor({ state: "visible" });
    check(
      await page.locator("#app").evaluate((node) => node.inert),
      true,
      `${regionKey} pending record is modal`,
    );
    pending.release();
    await dialog.waitFor({ state: "detached" });
    await page.waitForFunction(() => !!document.querySelector('.security-grid[aria-busy="false"]'));
    check(
      await page.locator("#app").evaluate((node) => node.inert),
      false,
      `${regionKey} disappeared record releases background`,
    );
    check(
      await region.locator(".security-inline-empty").count(),
      retainOther ? 0 : 1,
      `${regionKey} correct empty state`,
    );
    check(
      await region.locator(".responsive-data-view__mobile article").count(),
      retainOther ? 1 : 0,
      `${regionKey} remaining row count`,
    );
    const focus = await region.evaluate((node) => ({
      inside: node.contains(document.activeElement),
      tag: document.activeElement?.tagName,
      visible: document.activeElement?.checkVisibility({ visibilityProperty: true }),
    }));
    check(
      focus.inside && focus.visible,
      true,
      `${regionKey} removal returns focus to its visible result region (${focus.tag})`,
    );
    if (!retainOther)
      check(
        await region.evaluate((node) => document.activeElement === node),
        true,
        "fully empty list focuses its named result region",
      );
    else
      check(
        await region
          .locator(".responsive-data-view__mobile")
          .evaluate((node) => document.activeElement === node),
        true,
        "remaining records preserve existing mobile list fallback",
      );
    if (view === "credentials") {
      const otherKey = regionKey === "credentials" ? "tokens" : "credentials";
      check(
        await surface
          .locator(
            `section[aria-labelledby="security-${otherKey}-heading"] .responsive-data-view__mobile article`,
          )
          .count(),
        1,
        "other credential collection stays intact",
      );
    }
    await page.waitForFunction(
      () =>
        document.activeElement?.matches(":focus-visible") &&
        getComputedStyle(document.activeElement).outlineColor === "rgb(47, 110, 229)",
      undefined,
      { timeout: 3000 },
    );
    check(
      await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor),
      "rgb(47, 110, 229)",
      "keyboard removal focus has the C blue outline",
    );
    await region.evaluate((node) => node.scrollIntoView({ block: "center" }));
    if (retainOther) {
      const button = region.locator(".responsive-data-view__mobile article > button");
      await button.hover();
      await page.waitForFunction(
        (selector) => {
          const node = document.querySelector(selector);
          return (
            node?.matches(":hover") &&
            [...node.querySelectorAll("strong, small, .responsive-data-view__action")].every(
              (child) => getComputedStyle(child).color === "rgb(255, 255, 255)",
            )
          );
        },
        `section[aria-labelledby="security-${regionKey}-heading"] .responsive-data-view__mobile article > button`,
        { timeout: 3000 },
      );
      check(
        await button
          .locator("strong, small, .responsive-data-view__action")
          .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color)),
        ["rgb(255, 255, 255)", "rgb(255, 255, 255)", "rgb(255, 255, 255)"],
        "remaining row hover keeps title, secondary text and action readable",
      );
    }
    await capture(`${regionKey}-${retainOther ? "remaining" : "empty"}`, "removed-selection");
    await page.keyboard.press("Shift+Tab");
    check(
      await page.evaluate(
        () =>
          document.activeElement?.tagName !== "BODY" &&
          document.activeElement?.checkVisibility({ visibilityProperty: true }) &&
          !document.activeElement?.closest("[inert]"),
      ),
      true,
      "keyboard can continue after removal",
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
      `${width} no page overflow after removal`,
    );
  }
}
