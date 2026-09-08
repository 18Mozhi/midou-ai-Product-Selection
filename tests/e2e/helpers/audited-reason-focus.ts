import { expect, type Locator, type Page, type Request } from "@playwright/test";

// Exercise the real shared dialog in its caller; restore the caller's initial draft.
export async function verifyAuditedReasonFocus(page: Page, dialog: Locator) {
  const input = dialog.getByRole("textbox");
  await expect(input).toBeFocused();
  const original = await input.inputValue();
  const writes: string[] = [];
  const onRequest = (request: Request) => {
    if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
      writes.push(request.method());
  };
  page.on("request", onRequest);
  try {
    const first = dialog.getByRole("button", { name: "关闭原因填写" });
    const submit = dialog.getByRole("button", { name: "确认提交" });
    for (const value of [" ", "隔离焦点验证原因"]) {
      await input.fill(value);
      const last = value.trim()
        ? submit
        : dialog.getByRole("button", { name: "取消", exact: true });
      if (value.trim()) await expect(submit).toBeEnabled();
      else await expect(submit).toBeDisabled();
      await first.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(last).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(first).toBeFocused();
    }
    await input.fill(original);
    await input.focus();
    expect(writes).toEqual([]);
  } finally {
    page.off("request", onRequest);
  }
}
