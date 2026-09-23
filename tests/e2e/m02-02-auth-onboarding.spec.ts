import { expect, test, type Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000231",
  workspace = "00000000-0000-4000-8000-000000000232";
const envelope = (data: unknown) => ({
  data,
  request_id: "onboarding-e2e-request",
  trace_id: "onboarding-e2e-trace",
});
test("M02-02.A07/A15 login brand and mobile auxiliary actions keep compact touch targets", async ({
  page,
}) => {
  await page.goto("/login");
  const brand = page.getByRole("link", { name: /智能选品/ }).first();
  await expect(brand).toBeVisible();
  expect((await brand.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const actions = await page.locator(".identity-card__foot .text-button").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { y: box.y, height: box.height };
    }),
  );
  expect(actions).toHaveLength(3);
  expect(Math.abs(actions[0].y - actions[1].y)).toBeLessThanOrEqual(1);
  for (const action of actions) expect(action.height).toBeGreaterThanOrEqual(44);
});
test("M02-02.A07/A08/A15 login uses the real contract and continues to tenancy by keyboard", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      json: envelope({
        user: { id: "u", email: "member@example.test", status: "active" },
        session: { id: "s" },
        security_setup: { required: false, must_change_password: false, must_enroll_mfa: false },
      }),
    }),
  );
  await page.route("**/api/v1/me/landing", (route) =>
    route.fulfill({
      json: envelope({
        shell: "select_context",
        route: "/select-context",
        reason: "landing_context_required",
      }),
    }),
  );
  await page.route("**/api/v1/org/memberships", (route) => route.fulfill({ json: envelope([]) }));
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("member@example.test");
  await page.getByLabel("密码").fill("Long-enough-password-123!");
  await page.getByRole("button", { name: "登录", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/select-context$/);
  await expect(page.getByRole("heading", { name: "选择组织" })).toBeVisible();
  await expect(page.getByText("暂无可用组织")).toBeVisible();
  await expect(page).toHaveScreenshot("m02-02-login.png", { fullPage: true, maxDiffPixels: 140 });
});
test("M02-02.A07/A08 registration and email confirmation preserve single-use truth", async ({
  page,
}) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  await page.route("**/api/v1/auth/register", (route) =>
    (async () => {
      writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
      await route.fulfill({
        status: 201,
        json: envelope({ id: "u", email: "new@example.test", status: "pending_verification" }),
      });
    })(),
  );
  await page.goto("/register");
  await expect(page.getByTestId("registration")).toBeVisible();
  await expect(page.getByRole("heading", { name: /从可信信息开始/ })).toBeVisible();
  const email = page.locator("#p03-registration-email");
  const password = page.locator("#p03-registration-password");
  const confirmPassword = page.locator("#p03-registration-confirm");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("maxlength", "254");
  await expect(password).toHaveAttribute("minlength", "12");
  await expect(password).toHaveAttribute("maxlength", "128");
  await email.fill("new@example.test");
  await password.fill("Long-enough-password-123!");
  await confirmPassword.fill("Different-password-456!");
  await page.getByRole("button", { name: "创建账号" }).click();
  await expect(page.getByRole("alert")).toContainText("两次输入的密码不一致。");
  expect(writes).toEqual([]);
  await expect(email).toHaveValue("new@example.test");
  await expect(password).toHaveValue("Long-enough-password-123!");
  await confirmPassword.fill("Long-enough-password-123!");
  await page.getByRole("button", { name: "创建账号" }).click();
  await expect(page.getByRole("heading", { name: "检查验证邮件" })).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  expect(writes).toEqual([
    { method: "POST", body: { email: "new@example.test", password: "Long-enough-password-123!" } },
  ]);
  expect(await page.locator(".p03-registration-primary").count()).toBe(0);
  await expect(page).toHaveScreenshot("m02-02-register-verify.png", {
    fullPage: true,
    maxDiffPixels: 140,
  });
  await page.route("**/api/v1/auth/email-verification/confirm", (route) =>
    route.fulfill({ json: envelope({ status: "verified" }) }),
  );
  await page.goto("/verify-email?token=single-use-token");
  await expect(page.getByRole("heading", { name: "邮箱验证完成" })).toBeVisible();
});
test("P03 registration shows service feedback and preserves local navigation", async ({ page }) => {
  await page.route("**/api/v1/auth/register", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "service_unavailable",
          message: "注册暂时无法完成，请稍后重试。",
          action_hint: "请保留此编号并稍后再试。",
        },
        request_id: "registration-request-id",
        trace_id: "registration-trace-id",
      },
    }),
  );
  await page.goto("/register");
  await page.locator("#p03-registration-email").fill("new@example.test");
  await page.locator("#p03-registration-password").fill("Long-enough-password-123!");
  await page.locator("#p03-registration-confirm").fill("Long-enough-password-123!");
  await page.getByRole("button", { name: "创建账号" }).click();
  await expect(page.getByRole("alert")).toContainText("注册暂时无法完成，请稍后重试。");
  await expect(page.getByRole("alert")).toContainText("请保留此编号并稍后再试。");
  await expect(page.getByRole("alert")).toContainText("请求标识：registration-request-id");
  await expect(page.getByRole("alert")).toContainText("链路标识：registration-trace-id");
  await expect(page.locator("#p03-registration-email")).toHaveValue("new@example.test");
  await expect(page).toHaveURL(/\/register$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId("registration")).toBeVisible();
  const submit = page.getByRole("button", { name: "创建账号" });
  expect((await submit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "返回登录" }).click();
  await expect(page.getByRole("heading", { name: "欢迎回到智能选品" })).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});
test("P05 verification uses one token-gated confirmation and explicit return", async ({ page }) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  await page.route("**/api/v1/auth/email-verification/confirm", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await route.fulfill({ json: envelope({ status: "verified" }) });
  });

  await page.goto("/verify-email");
  await expect(page.getByTestId("email-verification")).toBeVisible();
  await expect(page.getByRole("heading", { name: "检查验证邮件" })).toBeVisible();
  const returnButton = page.getByRole("button", { name: "返回登录" });
  await expect(returnButton).toBeVisible();
  expect((await returnButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await returnButton.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgb(23, 72, 160)",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(writes).toEqual([]);

  await page.goto("/verify-email?state=expired");
  await expect(page.getByRole("heading", { name: "验证未完成" })).toBeVisible();
  await expect(page.getByText(/当前页面标记为链接已过期/)).toBeVisible();
  expect(writes).toEqual([]);

  await page.goto("/verify-email?token=synthetic-single-use-token");
  await expect(page.getByRole("heading", { name: "邮箱验证完成" })).toBeVisible();
  await expect(page.getByText("synthetic-single-use-token")).toHaveCount(0);
  await expect(page).toHaveURL(/\/verify-email\?/);
  expect(writes).toEqual([{ method: "POST", body: { token: "synthetic-single-use-token" } }]);

  await page.getByRole("button", { name: "返回登录" }).click();
  await expect(page.getByRole("heading", { name: "欢迎回到智能选品" })).toBeVisible();
});
test("P05 verification failures replace the loading title and retain service guidance", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/email-verification/confirm", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "service_unavailable",
          message: "验证暂未完成，请稍后重试。",
          action_hint: "请稍后重新打开验证邮件中的链接。",
        },
        request_id: "verify-request-id",
        trace_id: "verify-trace-id",
      },
    }),
  );
  await page.goto("/verify-email?token=synthetic-failed-token");
  await expect(page.getByRole("heading", { name: "验证未完成" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("验证暂未完成，请稍后重试。");
  await expect(page.getByRole("alert")).toContainText("请稍后重新打开验证邮件中的链接。");
  await expect(page.getByRole("alert")).toContainText("关联编号：verify-request-id");
  await expect(page.getByRole("alert")).toContainText("链路标识：verify-trace-id");
  await expect(page.getByText("synthetic-failed-token")).toHaveCount(0);
});
test("P04 recovery validates the email and submits one generic reset request", async ({ page }) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  await page.route("**/api/v1/auth/password-reset/request", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await route.fulfill({ status: 202, json: envelope({ accepted: true }) });
  });

  await page.goto("/forgot-password");
  await expect(page.getByTestId("password-recovery")).toBeVisible();
  await expect(page.getByRole("heading", { name: "找回密码" })).toBeVisible();
  const email = page.getByLabel("邮箱");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("required", "");
  await expect(email).toHaveAttribute("maxlength", "254");
  await email.fill("not-an-email");
  expect(await email.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
  await page.getByRole("button", { name: "发送重置说明" }).click();
  expect(writes).toEqual([]);

  await email.fill("member@example.test");
  const submit = page.getByRole("button", { name: "发送重置说明" });
  await submit.click();
  await expect(page.getByRole("status")).toContainText("如账号存在，重置邮件会进入受控投递队列。");
  expect(writes).toEqual([{ method: "POST", body: { email: "member@example.test" } }]);
  await page.mouse.move(8, 8);
  await expect(submit).toHaveCSS("background-color", "rgb(23, 72, 160)");
  expect((await submit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByText(/不表示邮件已经送达或账号存在/)).toBeVisible();
});
test("P04 recovery renders rate-limit guidance and keeps local login navigation", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/password-reset/request", (route) =>
    route.fulfill({
      status: 429,
      json: {
        error: {
          code: "rate_limited",
          message: "请求过于频繁。",
          action_hint: "稍后重试。",
        },
        request_id: "p04-rate-request",
        trace_id: "p04-rate-trace",
      },
    }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "忘记密码？" }).click();
  await expect(page.getByTestId("password-recovery")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("邮箱").fill("member@example.test");
  await page.getByRole("button", { name: "发送重置说明" }).click();
  await expect(page.getByRole("alert")).toContainText("请求过于频繁");
  await expect(page.getByRole("alert")).toContainText("稍后重试。");
  await expect(page.getByRole("alert")).toContainText("请求标识：p04-rate-request");
  await expect(page.getByRole("alert")).toContainText("链路标识：p04-rate-trace");
  await page.getByRole("button", { name: "返回登录" }).click();
  await expect(page.getByRole("heading", { name: "欢迎回到智能选品" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
test("M02-02.A08/A16 password recovery covers generic request reset and rate-limit recovery", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/password-reset/request", (route) =>
    route.fulfill({ status: 202, json: envelope({ accepted: true }) }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("邮箱").fill("unknown@example.test");
  await page.getByRole("button", { name: "发送重置说明" }).click();
  await expect(page.getByText("如账号存在，重置邮件会进入受控投递队列。")).toBeVisible();
  await page.route("**/api/v1/auth/password-reset/confirm", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.goto("/reset-password?token=reset-token");
  await page.getByLabel("新密码").fill("New-long-password-456!");
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByText("密码已更新，请重新登录。")).toBeVisible();
  await page.unroute("**/api/v1/auth/password-reset/request");
  await page.route("**/api/v1/auth/password-reset/request", (route) =>
    route.fulfill({
      status: 429,
      json: {
        error: { code: "rate_limited", message: "请求过于频繁。", action_hint: "稍后重试。" },
        request_id: "rate-request",
        trace_id: "rate-trace",
      },
    }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("邮箱").fill("member@example.test");
  await page.getByRole("button", { name: "发送重置说明" }).click();
  await expect(page.getByText("请求标识：rate-request")).toBeVisible();
});
test("P06 reset password keeps the one-field contract and explicit successful return", async ({
  page,
}) => {
  let completeRequest!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    completeRequest = resolve;
  });
  let requestBody: unknown;
  await page.route("**/api/v1/auth/password-reset/confirm", async (route) => {
    requestBody = route.request().postDataJSON();
    await responseGate;
    await route.fulfill({ status: 204 });
  });

  await page.goto("/reset-password?token=synthetic-reset-token");
  await expect(page.getByTestId("reset-password")).toBeVisible();
  await expect(page.getByRole("heading", { name: "设置新的登录密码" })).toBeVisible();
  await expect(page.getByLabel("新密码")).toHaveAttribute("minlength", "12");
  await expect(page.getByLabel("新密码")).toHaveAttribute("maxlength", "128");
  await expect(page.getByLabel("确认密码")).toHaveCount(0);
  await expect(page.getByText("synthetic-reset-token")).toHaveCount(0);

  await page.getByLabel("新密码").fill("New-long-password-456!");
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByRole("button", { name: "正在安全处理…" })).toBeDisabled();
  completeRequest();

  await expect(page.getByText("密码已更新，请重新登录。")).toBeVisible();
  await expect(page.getByRole("button", { name: "返回登录" })).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password\?/);
  expect(requestBody).toEqual({
    token: "synthetic-reset-token",
    new_password: "New-long-password-456!",
  });
  await page.getByRole("button", { name: "返回登录" }).click();
  await expect(page.getByRole("heading", { name: "欢迎回到智能选品" })).toBeVisible();
});
test("P06 expired reset link cannot be resubmitted and returns to the existing recovery entry", async ({
  page,
}) => {
  const writes: unknown[] = [];
  await page.route("**/api/v1/auth/password-reset/confirm", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  await page.goto("/reset-password?state=expired&token=synthetic-expired-token");
  await expect(page.getByRole("heading", { name: "链接已过期" })).toBeVisible();
  await expect(page.getByLabel("新密码")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "找回密码" })).toBeVisible();
  await expect(page.getByText("synthetic-expired-token")).toHaveCount(0);
  await expect(
    page.getByText("重置链接为单次使用。请重新申请，不要继续使用旧链接。"),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "找回密码" }).click();
  await expect(page.getByRole("heading", { name: "找回密码" })).toBeVisible();
});
test("P06 reset API failure shows server guidance and correlation id without changing route", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/password-reset/confirm", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "service_unavailable",
          message: "密码暂未更新，请稍后重试。",
          action_hint: "请稍后重新提交。",
        },
        request_id: "reset-request-id",
        trace_id: "reset-trace-id",
      },
    }),
  );
  await page.goto("/reset-password?token=synthetic-reset-token");
  await page.getByLabel("新密码").fill("New-long-password-456!");
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByRole("alert")).toContainText("密码暂未更新，请稍后重试。");
  await expect(page.getByRole("alert")).toContainText("请稍后重新提交。");
  await expect(page.getByRole("alert")).toContainText("关联编号：reset-request-id");
  await expect(page.getByText("链路标识：reset-trace-id")).toHaveCount(0);
  await expect(page).toHaveURL(/\/reset-password\?/);
});
test("M02-02.A07/A08/A15 tenancy hands off to all three onboarding steps at desktop and 390px", async ({
  page,
}) => {
  await page.route("**/api/v1/org/memberships", (route) =>
    route.fulfill({
      json: envelope([
        {
          id: org,
          name: "华南增长中心",
          slug: "south-growth",
          status: "active",
          timezone: "Asia/Shanghai",
          default_workspace_id: workspace,
          membership_status: "active",
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/org/${org}/workspaces`, (route) =>
    route.fulfill({
      json: envelope([
        {
          id: workspace,
          organization_id: org,
          name: "新品决策工作区",
          slug: "new-products",
          status: "active",
          version: 1,
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/org/${org}/teams`, (route) => route.fulfill({ json: envelope([]) }));
  await page.route("**/api/v1/auth/context", (route) =>
    route.fulfill({
      json: envelope({
        organization: { id: org, name: "华南增长中心" },
        workspace: {
          id: workspace,
          organization_id: org,
          name: "新品决策工作区",
          slug: "new-products",
          status: "active",
          version: 1,
        },
      }),
    }),
  );
  await page.goto("/select-context");
  await page.getByRole("button", { name: /华南增长中心/ }).click();
  await page.getByRole("button", { name: /新品决策工作区/ }).click();
  await page.getByRole("link", { name: "继续快速引导" }).click();
  await expect(page.getByRole("heading", { name: "把市场变化，变成今天的行动" })).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "让协作围绕同一份证据展开" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "先看事实，再做可解释的决定" })).toBeVisible();
  const finish = page.getByRole("link", { name: "进入智能选品" });
  await expect(finish).toBeFocused();
  await expect(finish).toBeVisible();
  for (const step of await page
    .getByRole("navigation", { name: "引导步骤" })
    .getByRole("button")
    .all())
    expect((await step.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await finish.evaluate((element) => element.blur());
  if (process.platform === "win32")
    await expect(page).toHaveScreenshot("m02-02-onboarding.png", {
      fullPage: true,
      maxDiffPixels: 140,
    });
  await finish.click();
  await expect(page).toHaveURL(/\/$/);
});

test("M02-02 P09 onboarding clamps query state, does not persist progress, and keeps exits local", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  await page.route("**/api/**", (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });

  for (const [query, title] of [
    ["", "把市场变化，变成今天的行动"],
    ["?step=1", "把市场变化，变成今天的行动"],
    ["?step=2", "让协作围绕同一份证据展开"],
    ["?step=3", "先看事实，再做可解释的决定"],
    ["?step=0", "把市场变化，变成今天的行动"],
    ["?step=99", "先看事实，再做可解释的决定"],
    ["?step=1.5", "把市场变化，变成今天的行动"],
    ["?step=invalid", "把市场变化，变成今天的行动"],
  ]) {
    await page.goto(`/onboarding${query}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }

  await page.goto("/onboarding?step=1");
  await expect(page.getByRole("button", { name: "下一步" })).toBeInViewport();
  await page.goto("/onboarding?step=2");
  await expect(page.getByRole("button", { name: "下一步" })).toBeInViewport();
  await page.goto("/onboarding?step=3");
  await expect(page.getByRole("link", { name: "进入智能选品" })).toBeInViewport();
  await page.goto("/onboarding?step=2");
  await page.reload();
  await expect(page.getByRole("heading", { name: "让协作围绕同一份证据展开" })).toBeVisible();
  expect(apiRequests).toEqual([]);
  await page.getByRole("link", { name: "跳过引导" }).click();
  await expect(page).toHaveURL(/\/$/);
});
