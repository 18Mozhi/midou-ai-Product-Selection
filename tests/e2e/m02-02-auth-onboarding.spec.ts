import { expect, test, type Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000231",
  workspace = "00000000-0000-4000-8000-000000000232";
const envelope = (data: unknown) => ({
  data,
  request_id: "onboarding-e2e-request",
  trace_id: "onboarding-e2e-trace",
});
async function identityColor(page: Page, token: string) {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

for (const [path, root] of [
  ["/login", ".p02-login-page"],
  ["/register", ".p03-registration-page"],
  ["/forgot-password", ".p04-recovery-page"],
  ["/verify-email", ".p05-verification-page"],
  ["/reset-password?token=layout-only", ".p06-reset-page"],
  ["/security/mfa", ".p07-mfa-page"],
]) {
  test(`identity workspace uses compact single-column forms without read-only writes: ${path}`, async ({
    page,
  }) => {
    let writes = 0;
    await page.route("**/api/v1/**", (route) => {
      if (route.request().method() !== "GET") writes += 1;
      const data = route.request().url().includes("session-status")
        ? { authenticated: true }
        : { totp_enabled: false };
      return route.fulfill({ json: envelope(data) });
    });
    await page.goto(path);
    const surface = page.locator(root);
    await expect(surface).toBeVisible();
    await expect(surface).toHaveCSS("font-size", "13px");
    const workspace = surface.locator('[class$="-workspace"]');
    await expect(workspace).toHaveCount(1);
    await expect(workspace).toHaveCSS("border-radius", "8px");
    const widths = await surface.evaluate((element) => ({
      root: element.getBoundingClientRect().width,
      workspace: element.querySelector('[class$="-workspace"]')!.getBoundingClientRect().width,
    }));
    expect(Math.abs(widths.root - widths.workspace)).toBeLessThan(2);
    expect(widths.root).toBeLessThanOrEqual(720);
    const controls = await surface.locator("input, button").evaluateAll((items) =>
      items.map((item) => ({
        height: item.getBoundingClientRect().height,
        input: item.tagName === "INPUT",
        font: parseFloat(getComputedStyle(item).fontSize),
      })),
    );
    for (const control of controls) {
      expect(control.height).toBeGreaterThanOrEqual(44);
      if (control.input) expect(control.font).toBeGreaterThanOrEqual(16);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(writes).toBe(0);
  });
}

test("P03 registration ignores synchronous duplicate submit while the request is pending", async ({
  page,
}) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/v1/auth/register", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await pendingResponse;
    await route.fulfill({
      status: 201,
      json: envelope({ id: "u", email: "single@example.test", status: "pending_verification" }),
    });
  });
  await page.goto("/register");
  await page.locator("#p03-registration-email").fill("single@example.test");
  await page.locator("#p03-registration-password").fill("Long-enough-password-123!");
  await page.locator("#p03-registration-confirm").fill("Long-enough-password-123!");
  await page.locator(".p03-registration-form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(() => writes.length).toBe(1);
  await expect(page.locator("[data-testid='registration']")).toHaveAttribute(
    "data-state",
    "loading",
  );
  expect(writes).toEqual([
    {
      method: "POST",
      body: { email: "single@example.test", password: "Long-enough-password-123!" },
    },
  ]);
  releaseResponse();
  await expect(page.getByRole("heading", { name: "检查验证邮件" })).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("P04 recovery ignores synchronous duplicate submit while the request is pending", async ({
  page,
}) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/v1/auth/password-reset/request", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await pendingResponse;
    await route.fulfill({ status: 202, json: envelope({ status: "accepted" }) });
  });
  await page.goto("/forgot-password");
  await page.locator("#p04-recovery-email").fill("recover@example.test");
  await page.locator(".p04-recovery-form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(() => writes.length).toBe(1);
  await expect(page.locator("[data-testid='password-recovery']")).toHaveAttribute(
    "data-state",
    "loading",
  );
  expect(writes).toEqual([{ method: "POST", body: { email: "recover@example.test" } }]);
  releaseResponse();
  await expect(page.getByRole("status")).toContainText("请求已受理");
  expect(writes).toHaveLength(1);
});

test("P06 reset ignores synchronous duplicate submit and retains explicit retry after failure", async ({
  page,
}) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/v1/auth/password-reset/confirm", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await pendingResponse;
    await route.fulfill({
      status: 503,
      json: {
        error: { code: "service_unavailable", message: "更新暂时无法完成，请稍后重试。" },
        request_id: "reset-pending-request",
        trace_id: "reset-pending-trace",
      },
    });
  });
  await page.goto("/reset-password?token=single-use-token");
  await page.locator("#p06-new-password").fill("Long-enough-password-123!");
  await page
    .locator("form[aria-labelledby='p06-reset-title']")
    .evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
  await expect.poll(() => writes.length).toBe(1);
  await expect(page.locator("[data-testid='reset-password']")).toHaveAttribute(
    "data-state",
    "loading",
  );
  expect(writes).toEqual([
    {
      method: "POST",
      body: { token: "single-use-token", new_password: "Long-enough-password-123!" },
    },
  ]);
  releaseResponse();
  await expect(page.getByRole("alert")).toContainText("更新暂时无法完成，请稍后重试。");
  expect(writes).toHaveLength(1);
  await page
    .locator("form[aria-labelledby='p06-reset-title']")
    .evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
    });
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toEqual(writes[0]);
});

test("M02-02.A07/A15 login brand and mobile auxiliary actions keep compact touch targets", async ({
  page,
}) => {
  await page.goto("/login");
  const brand = page.getByRole("link", { name: "ScoutOps 首页" });
  await expect(brand).toBeVisible();
  expect((await brand.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const actionControls = page.locator(".p02-login-actions > :is(button, a)");
  await expect(actionControls).toHaveCount(3);
  const actions = await actionControls.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }),
  );
  expect(actions).toHaveLength(3);
  for (let index = 0; index < actions.length; index += 1) {
    const box = actions[index];
    expect(box.width).toBeGreaterThanOrEqual(44);
    for (const other of actions.slice(index + 1)) {
      const overlapX =
        Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
      const overlapY =
        Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
      expect(overlapX <= 0 || overlapY <= 0).toBe(true);
    }
  }
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
  await page.getByLabel("账号（邮箱或用户名）").fill("member@example.test");
  await page.getByLabel("密码").fill("Long-enough-password-123!");
  await page.getByRole("button", { name: "登录", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/select-context$/);
  await expect(page.getByRole("heading", { name: "选择组织" })).toBeVisible();
  await expect(page.getByText("暂无可用组织")).toBeVisible();
  if (process.platform === "win32")
    await expect(page).toHaveScreenshot("identity-workspace-context-empty-20261017.png", {
      fullPage: true,
      maxDiffPixels: 140,
    });
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
  await expect(page.getByRole("heading", { name: /创建账号/ })).toBeVisible();
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
  await expect(page).toHaveScreenshot("identity-workspace-register-verify-20261017.png", {
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
  await expect(page.getByRole("heading", { name: "安全登录" })).toBeVisible();
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
    await identityColor(page, "--so-primary"),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(writes).toEqual([]);

  await page.goto("/verify-email?state=expired");
  await expect(page.getByRole("heading", { name: "验证未完成" })).toBeVisible();
  await expect(page.getByText(/验证链接已过期，请联系管理员/)).toBeVisible();
  expect(writes).toEqual([]);

  await page.goto("/verify-email?token=synthetic-single-use-token");
  await expect(page.getByRole("heading", { name: "邮箱验证完成" })).toBeVisible();
  await expect(page.getByText("synthetic-single-use-token")).toHaveCount(0);
  await expect(page).toHaveURL(/\/verify-email\?/);
  expect(writes).toEqual([{ method: "POST", body: { token: "synthetic-single-use-token" } }]);

  await page.getByRole("button", { name: "返回登录" }).click();
  await expect(page.getByRole("heading", { name: "安全登录" })).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText(
    "请求已受理。若该邮箱已注册，请留意重置说明。",
  );
  expect(writes).toEqual([{ method: "POST", body: { email: "member@example.test" } }]);
  await page.mouse.move(8, 8);
  await expect(submit).toHaveCSS("background-color", await identityColor(page, "--so-primary"));
  expect((await submit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByText(/若该邮箱已注册，请留意重置说明/)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "安全登录" })).toBeVisible();
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
  await expect(page.getByText("请求已受理。若该邮箱已注册，请留意重置说明。")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "安全登录" })).toBeVisible();
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
    await expect(page).toHaveScreenshot("identity-workspace-onboarding-20261017.png", {
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

test("Identity workspace shows actual lazy loading and honors reduced motion", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/src/components/LocalIdentity.vue*", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const loading = page.locator(".ui-state-panel[data-kind='loading']");
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading.locator(".ui-state-skeleton i").first()).toHaveCSS("animation-name", "none");
  release();
  await expect(page.getByRole("heading", { name: "安全登录", exact: true })).toBeVisible();
  await expect(loading).toHaveCount(0);
  await expect(page.locator(".p02-login-workspace")).toHaveCSS("border-radius", "8px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Identity workspace failed page chunk offers a working reload", async ({ page }) => {
  await page.route("**/src/components/LocalIdentity.vue*", (route) => route.abort(), { times: 1 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "页面资源未能加载" })).toBeVisible();
  await page.getByRole("button", { name: "重新加载页面" }).click();
  await expect(page.getByRole("heading", { name: "安全登录", exact: true })).toBeVisible();
});
