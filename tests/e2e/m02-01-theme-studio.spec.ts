import { expect, test, type Page } from "@playwright/test";

const org = "00000000-0000-4000-8000-000000000221";
const workspace = "00000000-0000-4000-8000-000000000222";
const envelope = (data: unknown) => ({
  data,
  request_id: "theme-e2e-request",
  trace_id: "theme-e2e-trace",
});

async function ready(page: Page) {
  let preference = {
    theme: "deep-ocean",
    source: "saved",
    organization_id: org,
    workspace_id: workspace,
    version: 1,
    updated_at: "2026-08-07T14:00:00.000Z",
  };
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      preference = {
        ...preference,
        theme: body.theme,
        version: preference.version + 1,
        updated_at: "2026-08-07T14:05:00.000Z",
      };
    }
    await route.fulfill({ json: envelope(preference) });
  });
}

test("M02-01 theme studio previews and saves theme without changing semantics", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/settings/theme");
  await expect(page.getByRole("heading", { name: "界面外观" })).toBeVisible();
  const aurora = page.getByRole("radio", { name: /档案纸/ });
  await aurora.focus();
  await page.keyboard.press("Enter");
  await expect(aurora).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "aurora-purple");
  await page.getByRole("button", { name: "保存主题偏好" }).click();
  await expect(page.getByText("服务器已确认当前主题偏好。")).toBeVisible();
  await expect(page.getByText("权限、数据范围或业务结论")).toBeVisible();
});

test("M02-01 blocked scope has an explicit recovery path and trace", async ({ page }) => {
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: { code: "preference_scope_required" },
        request_id: "theme-blocked-request",
        trace_id: "theme-blocked-trace",
      },
    }),
  );
  await page.goto("/settings/theme");
  await expect(page.getByText("还需要选择组织和工作区")).toBeVisible();
  await expect(page.getByRole("link", { name: "选择工作区" })).toHaveAttribute(
    "href",
    "/select-context",
  );
  await page.getByText("查看关联编号").click();
  await expect(page.getByText("theme-blocked-request")).toBeVisible();
});

test("M02-01 radio groups support arrow and Home/End keyboard navigation", async ({ page }) => {
  await ready(page);
  await page.goto("/settings/theme");
  const themes = page.getByRole("radiogroup", { name: "界面主题" });
  const signal = themes.getByRole("radio", { name: /信号纸/ });
  const archive = themes.getByRole("radio", { name: /档案纸/ });
  const white = themes.getByRole("radio", { name: /净页白/ });
  await signal.focus();
  await page.keyboard.press("ArrowRight");
  await expect(archive).toBeFocused();
  await expect(archive).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("End");
  await expect(white).toBeFocused();
  await page.keyboard.press("Home");
  await expect(signal).toBeFocused();
  await expect(signal).toHaveAttribute("aria-checked", "true");
});

test("M02-01 save locks theme and density choices until the request settles", async ({ page }) => {
  await ready(page);
  let releaseSave!: () => void;
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      await new Promise<void>((resolve) => (releaseSave = resolve));
      await route.fulfill({
        json: envelope({
          theme: "cloud-white",
          source: "saved",
          organization_id: org,
          workspace_id: workspace,
          version: 2,
          updated_at: "2026-08-07T14:05:00.000Z",
        }),
      });
      return;
    }
    await route.fulfill({
      json: envelope({
        theme: "deep-ocean",
        source: "saved",
        organization_id: org,
        workspace_id: workspace,
        version: 1,
        updated_at: "2026-08-07T14:00:00.000Z",
      }),
    });
  });
  await page.goto("/settings/theme");
  await page.getByRole("radio", { name: /净页白/ }).click();
  await page.getByRole("button", { name: "保存主题偏好" }).click();
  await expect(page.getByRole("button", { name: "正在保存…" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "撤销主题预览" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /档案纸/ })).toBeDisabled();
  await expect(page.getByRole("radiogroup", { name: "页面密度" }).getByRole("radio")).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("radiogroup", { name: "页面密度" }).getByRole("radio").first(),
  ).toBeDisabled();
  releaseSave();
  await expect(page.getByText("服务器已确认当前主题偏好。")).toBeVisible();
});

test("M02-01 rate limits do not masquerade as missing organization context", async ({ page }) => {
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({
      status: 429,
      json: {
        error: { code: "rate_limited", action_hint: "请稍后再试。" },
        request_id: "theme-rate-limited",
        trace_id: "theme-rate-limited",
      },
    }),
  );
  await page.goto("/settings/theme");
  await expect(page.getByText("请求较频繁，请稍后再试")).toBeVisible();
  await expect(page.getByText("请稍后再试。")).toBeVisible();
  await expect(page.getByText("还需要选择组织和工作区")).toHaveCount(0);
});

test("M02-01 density is immediate, session-only and keyboard accessible", async ({ page }) => {
  await ready(page);
  await page.goto("/settings/theme");
  const density = page.getByRole("radiogroup", { name: "页面密度" });
  const compact = density.getByRole("radio", { name: /紧凑/ });
  await density.getByRole("radio", { name: /标准/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(compact).toBeFocused();
  await expect(compact).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});
