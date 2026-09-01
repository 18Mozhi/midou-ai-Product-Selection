import { test, expect } from "@playwright/test";
test("M02-04.A07/A15 state library is visually stable", async ({ page }) => {
  await page.goto("/ui-states");
  await expect(page.getByRole("heading", { name: "这里还没有内容" })).toBeVisible();
  await expect(page).toHaveScreenshot("m02-04-state-library.png", { fullPage: true });
});
test("M02-04.A08/A16 blocked state recovers through an explicit action", async ({ page }) => {
  await page.goto("/ui-states");
  await page.getByRole("button", { name: "受阻" }).click();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await page.getByRole("button", { name: "稍后重试" }).click();
  await expect(page.getByRole("heading", { name: "服务已恢复" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("没有调用业务接口");
});
test("M02-04 state selection survives refresh and browser history", async ({ page }) => {
  await page.goto("/ui-states");
  await page.getByRole("button", { name: "受阻" }).click();
  await expect(page).toHaveURL(/state=blocked/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await page.getByRole("button", { name: "无权限" }).click();
  await expect(page).toHaveURL(/state=forbidden/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "你没有此项权限" })).toBeVisible();
});
test("M02-04 showcase gives every state action an observable result", async ({ page }) => {
  await page.goto("/ui-states");
  const panel = page.locator("#ui-state-preview");
  for (const [label, kind] of [
    ["加载", "loading"],
    ["空结果", "empty"],
    ["错误", "error"],
    ["无权限", "forbidden"],
    ["已过期", "expired"],
    ["受阻", "blocked"],
    ["已恢复", "recovery"],
    ["404", "not_found"],
  ] as const) {
    await page.getByRole("button", { name: label }).click();
    await expect(panel).toHaveAttribute("data-kind", kind);
  }

  await page.getByRole("button", { name: "空结果" }).click();
  await page.getByRole("button", { name: "开始创建" }).click();
  await expect(page.getByRole("status")).toContainText("未执行写入");
  await page.getByRole("button", { name: "调整筛选" }).click();
  await expect(page.getByRole("status")).toContainText("没有真实筛选条件");

  await page.getByRole("button", { name: "错误" }).click();
  await page.getByRole("button", { name: "返回上一页" }).click();
  await expect(panel).toHaveAttribute("data-kind", "empty");
  await page.getByRole("button", { name: "无权限" }).click();
  await page.getByRole("button", { name: "申请权限" }).click();
  await expect(page.getByRole("status")).toContainText("不会伪造申请成功");
  await page.getByRole("button", { name: "受阻" }).click();
  await page.getByRole("button", { name: "查看影响" }).click();
  await expect(page.getByRole("status")).toContainText("限流、超时或依赖不可用");
  await page.getByRole("button", { name: "已恢复" }).click();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(panel).toHaveAttribute("data-kind", "empty");
  await page.getByRole("button", { name: "404" }).click();
  await page.getByRole("button", { name: "返回最近页面" }).click();
  await expect(panel).toHaveAttribute("data-kind", "empty");
});
test("M02-04 navigation actions reach their declared destinations", async ({ page }) => {
  await page.goto("/ui-states?state=forbidden");
  await page.getByRole("button", { name: "返回工作台" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goBack();
  await page.getByRole("button", { name: "已过期" }).click();
  await page.getByRole("button", { name: "重新登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await page.getByRole("button", { name: "404" }).click();
  await page.getByRole("button", { name: "返回今日行动" }).click();
  await expect(page).toHaveURL(/\/home$/);
});
test("M02-04.A07/A15 unknown route renders the reference-grounded 404 state", async ({ page }) => {
  await page.goto("/ui-states");
  await page.goto("/route-that-does-not-exist");
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await expect(page.getByText("最近有效页面：/ui-states")).toBeVisible();
  await page.getByRole("button", { name: "返回最近页面" }).click();
  await expect(page).toHaveURL(/\/ui-states$/);
  await page.goto("/route-that-does-not-exist");
  await expect(page).toHaveScreenshot("m02-04-not-found.png", { fullPage: true });
});
test("M02-04.A08/A15 high-impact confirmation is keyboard safe and fail-closed", async ({
  page,
}) => {
  await page.goto("/ui-states");
  const trigger = page.getByRole("button", { name: "查看高影响确认弹窗" });
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const submit = page.getByRole("button", { name: "确认演示" });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByPlaceholder("确认撤销").fill("确认撤销");
  await expect(submit).toBeEnabled();
  await expect(page).toHaveScreenshot("m02-04-confirm-dialog.png", { fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
test("M02-04 high-impact confirmation remains reachable on a short mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/ui-states");
  await page.getByRole("button", { name: "查看高影响确认弹窗" }).click();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const bounds = await page.locator(".confirm-dialog").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewport: window.innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);
  await expect(page.getByRole("button", { name: "确认演示" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
