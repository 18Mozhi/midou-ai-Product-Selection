import { expect, test } from "@playwright/test";

const previews = [
  {
    view: "mysql",
    buttons: ["合同通过", "验收受阻", "回滚中"],
    states: ["可用 · 合同通过", "已阻断 · 停止下游", "回滚 · 逆序恢复"],
  },
  {
    view: "redis",
    buttons: ["可连接", "依赖失败", "恢复中"],
    states: ["可用 · 可连接", "不可用 · 已阻塞", "恢复中 · 恢复检查"],
  },
  {
    view: "file-audit",
    buttons: ["隔离通过", "授权拒绝", "审计脱敏"],
    states: ["PROTECTED · 已隔离", "DENIED · 默认拒绝", "REDACTED · 已脱敏"],
  },
];
for (const preview of previews) {
  test(`UI2.scope.${preview.view} all preview controls only change local display`, async ({
    page,
  }) => {
    const apiCalls: string[] = [];
    await page.route("**/api/v1/**", (route) => {
      apiCalls.push(route.request().url());
      return route.abort();
    });
    await page.goto(`/?view=${preview.view}`);
    for (let index = 0; index < preview.buttons.length; index += 1) {
      await page.getByRole("button", { name: preview.buttons[index], exact: true }).click();
      await expect(page.getByText(preview.states[index], { exact: true })).toBeVisible();
    }
    expect(apiCalls).toEqual([]);
  });
}
