import { expect, test, type Page } from "@playwright/test";

function observeApiRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
  });
  return requests;
}

test("UI2-ST01 invalid and repeated query states fall back without rewriting the URL", async ({
  page,
}) => {
  const requests = observeApiRequests(page);
  for (const query of ["state=unknown", "state=blocked&state=error"]) {
    await page.goto(`/ui-states?${query}&context=review`);
    await expect(page.locator("#ui-state-preview")).toHaveAttribute("data-kind", "empty");
    expect(new URL(page.url()).search).toBe(`?${query}&context=review`);
  }
  await page.getByRole("button", { name: "受阻", exact: true }).click();
  await expect(page).toHaveURL(/state=blocked&context=review$/);
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "受阻", exact: true }).click();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.getByRole("button", { name: "受阻", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(requests).toEqual([]);
});

test("UI2-ST02 loading hides actions and query navigation clears old demo feedback", async ({
  page,
}) => {
  const requests = observeApiRequests(page);
  await page.goto("/ui-states?state=loading");
  const panel = page.locator("#ui-state-preview");
  await expect(panel).toHaveAttribute("aria-busy", "true");
  await expect(panel.getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "空结果", exact: true }).click();
  await panel.getByRole("button", { name: "开始创建", exact: true }).click();
  await expect(page.locator(".state-action-result")).toContainText("未执行写入");
  await page.getByRole("button", { name: "已过期", exact: true }).click();
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel.getByRole("button")).toHaveCount(1);
  await expect(panel.getByRole("button", { name: "重新登录", exact: true })).toBeVisible();
  await expect(page.locator(".state-action-result")).toHaveCount(0);
  await page.goBack();
  await expect(panel).toHaveAttribute("data-kind", "empty");
  await expect(page.locator(".state-action-result")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("UI2-ST03 confirmation traps keyboard focus and cancellation resets only the demo form", async ({
  page,
}) => {
  const requests = observeApiRequests(page);
  await page.goto("/ui-states?state=blocked");
  const trigger = page.getByRole("button", { name: "查看高影响确认弹窗", exact: true });
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "确认撤销示例授权？", exact: true });
  const cancel = dialog.getByRole("button", { name: "取消", exact: true });
  const submit = dialog.getByRole("button", { name: "确认演示", exact: true });
  const check = dialog.getByRole("checkbox");
  const phrase = dialog.getByRole("textbox");
  await expect(cancel).toBeFocused();
  await expect(submit).toBeDisabled();
  await cancel.press("Tab");
  await expect(check).toBeFocused();
  await check.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await check.check();
  await phrase.fill("确认撤销");
  await expect(submit).toBeEnabled();
  await check.focus();
  await check.press("Shift+Tab");
  await expect(submit).toBeFocused();
  await submit.press("Tab");
  await expect(check).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(check).not.toBeChecked();
  await expect(phrase).toHaveValue("");
  await expect(submit).toBeDisabled();
  await cancel.click();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".confirm-result")).toHaveCount(0);
  await expect(page.locator("#ui-state-preview")).toHaveAttribute("data-kind", "blocked");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  expect(requests).toEqual([]);
});

test("UI2-ST04 confirmation requires acknowledgement plus trimmed phrase and never writes business data", async ({
  page,
}) => {
  const requests = observeApiRequests(page);
  await page.goto("/ui-states");
  const trigger = page.getByRole("button", { name: "查看高影响确认弹窗", exact: true });
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  const submit = dialog.getByRole("button", { name: "确认演示", exact: true });
  const check = dialog.getByRole("checkbox");
  const phrase = dialog.getByRole("textbox");
  await phrase.fill("确认撤销");
  await expect(submit).toBeDisabled();
  await check.check();
  await phrase.fill("确认撤销错误");
  await expect(submit).toBeDisabled();
  await phrase.fill("  确认撤销  ");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".confirm-result")).toContainText("未触发任何业务写入");
  await trigger.click();
  await expect(phrase).toHaveValue("");
  await expect(check).not.toBeChecked();
  await expect(submit).toBeDisabled();
  await page.locator(".confirm-backdrop").click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(requests).toEqual([]);
});

for (const stored of ["https://example.invalid/outside", "//example.invalid/outside"]) {
  test(`UI2-NF01 unsafe stored destination uses home: ${stored}`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("scoutops:navigation:last-valid-route", value);
    }, stored);
    const requests = observeApiRequests(page);
    await page.goto("/missing/ui2-recovery?context=private-review#detail");
    await expect(
      page.getByRole("heading", { name: "没有找到这个页面", exact: true }),
    ).toBeFocused();
    await expect(page.getByRole("link", { name: "返回最近页面", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "返回今日行动", exact: true })).toHaveAttribute(
      "href",
      "/home",
    );
    await expect(page.locator(".not-found-path code")).toHaveText("/missing/ui2-recovery");
    await expect(page.locator(".not-found-page")).not.toContainText("private-review");
    await expect(page.locator(".not-found-page")).not.toContainText("example.invalid");
    expect(
      await page.evaluate(() => localStorage.getItem("scoutops:navigation:last-valid-route")),
    ).toBe(stored);
    expect(requests).toEqual([]);
  });
}

test("UI2-NF02 unavailable local storage still renders a usable fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = observeApiRequests(page);
  await page.goto("/missing/ui2-storage");
  await expect(page.getByRole("heading", { name: "没有找到这个页面", exact: true })).toBeFocused();
  await expect(page.getByRole("link", { name: "返回今日行动", exact: true })).toHaveAttribute(
    "href",
    "/home",
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "没有找到这个页面", exact: true })).toBeVisible();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
