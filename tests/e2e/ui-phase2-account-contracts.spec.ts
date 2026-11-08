import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({
  data,
  request_id: "ui2-account-request",
  trace_id: "ui2-account-trace",
});
const preference = (theme = "deep-ocean", version = 5) => ({
  theme,
  version,
  source: "saved",
  organization_id: "00000000-0000-4000-8000-000000000221",
  workspace_id: "00000000-0000-4000-8000-000000000222",
  updated_at: "2026-09-07T00:00:00.000Z",
});
const profile = {
  email: "member@example.test",
  email_verified_at: "2026-09-07T00:00:00.000Z",
  username: "member.test",
  display_name: "隔离成员",
  avatar_url: null,
  phone: null,
  phone_verified_at: null,
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
  version: 3,
};

async function accountSession(page: Page) {
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({ json: envelope({ authenticated: true }) }),
  );
}

for (const section of ["profile", "permissions", "security", "notifications", "assets"]) {
  test(`personal workspace keeps compact navigation and full-width sections: ${section}`, async ({
    page,
  }) => {
    await accountSession(page);
    if (section === "profile") {
      await page.route("**/api/v1/me/navigation?shell=member", (route) =>
        route.fulfill({
          json: envelope({
            shell: "member",
            organization_name: "组织夹具",
            workspace_name: "工作区夹具",
            roles: ["member"],
            capabilities: [],
            platform_roles: [],
            platform_capabilities: [],
          }),
        }),
      );
    }
    let writes = 0;
    const resources: Record<string, unknown> = {
      profile,
      authorization: { roles: ["member"], capabilities: ["audit:read"], data_scopes: [] },
      sessions: [
        { id: "session-layout", device_label: "浏览器设备", status: "active", last_seen_at: null },
      ],
      assets: {
        followed_trends: [
          { id: "trend-assets", title: "关注的商品情报", market: "US", created_at: null },
        ],
        decisions: [
          {
            id: "decision-assets",
            opportunity_id: "product-assets",
            opportunity_name: "已分析商品",
            action: "reject",
            created_at: null,
          },
        ],
        tasks: [
          {
            id: "legacy-task",
            title: "历史任务仍在响应中",
            status: "open",
            priority: "high",
            due_at: null,
          },
        ],
      },
      "notification-preferences": {
        version: 7,
        in_app_enabled: true,
        email_enabled: false,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
      },
    };
    for (const [endpoint, data] of Object.entries(resources)) {
      await page.route(`**/api/v1/me/${endpoint}`, (route) => {
        if (route.request().method() !== "GET") writes += 1;
        return route.fulfill({ json: envelope(data) });
      });
    }
    await page.goto(`/me?section=${section}`);
    await expect(page.locator(".personal-center")).toHaveAttribute("data-state", "ready");
    const directory = page.getByRole("navigation", { name: "个人中心分区", exact: true });
    await expect(directory.getByRole("link")).toHaveCount(6);
    await expect(directory.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator(".p11-page-heading")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    expect((await page.locator(".p11-page-heading").boundingBox())!.height).toBeLessThan(80);
    const center = page.locator(".personal-center");
    if (section === "profile") {
      await expect(center.locator(".midou-profile-context")).toContainText("组织夹具");
      await expect(center.locator(".midou-profile-context")).toContainText("工作区夹具");
      await expect(center.locator(".midou-profile-security-facts")).toContainText("未绑定");
    }
    if (section === "assets") {
      await expect(center.getByRole("heading", { name: "关注热点", exact: true })).toBeVisible();
      await expect(center.getByRole("heading", { name: "我的决策", exact: true })).toBeVisible();
      await expect(center.getByRole("link", { name: "关注的商品情报" })).toHaveAttribute(
        "href",
        "/trends?topic=trend-assets",
      );
      await expect(center.getByRole("link", { name: "已分析商品" })).toHaveAttribute(
        "href",
        "/opportunities/product-assets",
      );
      await expect(center.getByRole("heading", { name: "我的任务", exact: true })).toHaveCount(0);
      await expect(center.getByText("历史任务仍在响应中")).toHaveCount(0);
      await expect(center.locator('a[href="/tasks"]')).toHaveCount(0);
    }
    await expect(center).toHaveCSS("font-size", "13px");
    const panels = center.locator(".p11-panel");
    await expect(panels.first()).toBeVisible();
    const bounds = await panels.evaluateAll((items) =>
      items.map((item) => ({
        width: item.getBoundingClientRect().width,
        parent: item.parentElement!.getBoundingClientRect().width,
      })),
    );
    for (const item of bounds) {
      if (section === "profile" && page.viewportSize()!.width > 1050) {
        expect(item.width).toBeGreaterThan(item.parent * 0.6);
        expect(item.width).toBeLessThan(item.parent);
      } else expect(Math.abs(item.width - item.parent)).toBeLessThan(3);
    }
    await expect(page.locator("body")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (section === "profile") {
      await page.getByLabel("显示名称", { exact: true }).fill("未提交资料草稿");
      await page.getByLabel("修改原因", { exact: true }).fill("尚未提交");
      expect(writes).toBe(0);
      await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue("未提交资料草稿");
    }
    expect(writes).toBe(0);
  });
}

test("UI2-A01 theme preview and restore do not persist density or write preferences", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() !== "GET") writes += 1;
    await route.fulfill({ json: envelope(preference()) });
  });
  await accountSession(page);
  await page.goto("/settings/theme");
  await expect(page).toHaveURL(/\/me\?section=appearance$/);
  const save = page.getByRole("button", { name: "保存主题偏好", exact: true });
  await page.getByRole("radio", { name: /紧凑/ }).click();
  await expect(save).toBeDisabled();
  await page.getByRole("radio", { name: /石墨/ }).press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "aurora-purple");
  await expect(save).toBeEnabled();
  await page.getByRole("button", { name: "撤销主题预览", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "deep-ocean");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await expect(save).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("scoutops:ui-theme"))).toBe("deep-ocean");
  await page.reload();
  await expect(page.getByRole("radio", { name: /标准/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-density", "standard");
  expect(writes).toBe(0);
});

test("UI2-A02 theme saves exact versioned payloads and uses the returned revision", async ({
  page,
}) => {
  let saved = preference();
  const bodies: unknown[] = [];
  const keys: string[] = [];
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { theme: string; expected_version: number };
      bodies.push(body);
      keys.push(route.request().headers()["idempotency-key"] ?? "");
      saved = preference(body.theme, saved.version + 1);
    }
    await route.fulfill({ json: envelope(saved) });
  });
  await accountSession(page);
  await page.goto("/settings/theme");
  await expect(page).toHaveURL(/\/me\?section=appearance$/);
  await page.getByRole("radio", { name: /石墨/ }).click();
  await page.getByRole("button", { name: "保存主题偏好", exact: true }).click();
  await expect(page.getByRole("button", { name: "已保存", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /青蓝/ }).click();
  await page.getByRole("button", { name: "保存主题偏好", exact: true }).click();
  await expect(page.getByRole("button", { name: "已保存", exact: true })).toBeVisible();
  expect(bodies).toEqual([
    { theme: "aurora-purple", expected_version: 5 },
    { theme: "cloud-white", expected_version: 6 },
  ]);
  expect(keys.every((key) => key.length > 0)).toBe(true);
  expect(new Set(keys).size).toBe(2);
  await page.reload();
  await expect(page.getByRole("radio", { name: /青蓝/ })).toHaveAttribute("aria-checked", "true");
  expect(bodies).toHaveLength(2);
});

test("UI2-A03 theme conflict requires fresh preference before the next versioned save", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: envelope(bodies.length === 0 ? preference() : preference("cloud-white", 9)),
      });
    }
    const body = route.request().postDataJSON() as { theme: string; expected_version: number };
    bodies.push(body);
    if (bodies.length === 1)
      return route.fulfill({
        status: 409,
        json: {
          error: { code: "preference_version_conflict", action_hint: "刷新最新偏好后重新选择。" },
          request_id: "ui2-theme-conflict",
          trace_id: "ui2-theme-conflict",
        },
      });
    await route.fulfill({ json: envelope(preference(body.theme, 10)) });
  });
  await accountSession(page);
  await page.goto("/settings/theme");
  await expect(page).toHaveURL(/\/me\?section=appearance$/);
  await page.getByRole("radio", { name: /石墨/ }).click();
  await page.getByRole("button", { name: "保存主题偏好", exact: true }).click();
  await expect(page.getByText("偏好已在其他窗口更新", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存主题偏好", exact: true })).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await expect(page.getByRole("radio", { name: /青蓝/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /石墨/ }).click();
  await page.getByRole("button", { name: "保存主题偏好", exact: true }).click();
  await expect(page.getByRole("button", { name: "已保存", exact: true })).toBeVisible();
  expect(bodies).toEqual([
    { theme: "aurora-purple", expected_version: 5 },
    { theme: "aurora-purple", expected_version: 9 },
  ]);
});

test("profile shows saved avatar but never loads an unsaved URL", async ({ page }) => {
  const wide = page.viewportSize()!.width >= 1101;
  if (wide) await page.setViewportSize({ width: 1717, height: 916 });
  await accountSession(page);
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_name: "组织夹具",
        workspace_name: "工作区夹具",
        roles: ["member"],
        capabilities: ["opportunity:read", "trend:read", "notification:read"],
        platform_roles: [],
        platform_capabilities: [],
      }),
    }),
  );
  const savedUrl = "https://avatar.example.test/saved.svg";
  let draftReads = 0;
  await page.route("https://avatar.example.test/**", (route) => {
    if (route.request().url() !== savedUrl) draftReads++;
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="blue"/></svg>',
    });
  });
  await page.route("**/api/v1/me/profile", (route) =>
    route.fulfill({ json: envelope({ ...profile, avatar_url: savedUrl }) }),
  );
  await page.goto("/me");
  const preview = page.locator(".p11-avatar-preview img");
  await preview.scrollIntoViewIfNeeded();
  await expect
    .poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(24);
  await page.getByLabel("头像 HTTPS 地址").fill("https://avatar.example.test/draft.svg");
  await expect(preview).toHaveAttribute("src", savedUrl);
  await expect(page.locator(".midou-profile-avatar img")).toHaveAttribute("src", savedUrl);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/me/profile"))
      writes++;
  });
  const displayName = page.getByLabel("显示名称");
  await displayName.fill("尚未保存的显示名称");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(displayName).toHaveValue(profile.display_name);
  await expect(page.getByLabel("头像 HTTPS 地址")).toHaveValue(savedUrl);
  if (wide) {
    const form = page.locator(".midou-profile-grid .p11-form");
    const avatar = form.locator(".p11-avatar-frame");
    await expect(form).toHaveCSS("row-gap", "18px");
    await expect(page.locator(".midou-profile-context")).toContainText("工作区夹具");
    await expect(page.locator(".midou-sidebar-settings")).not.toHaveAttribute("aria-current");
    expect((await form.boundingBox())!.x).toBeCloseTo(645, -1);
    expect(Math.abs((await form.boundingBox())!.y - 301)).toBeLessThanOrEqual(6);
    await expect(avatar).toHaveCSS("border-radius", "8px");
    const [input, frame] = await Promise.all([
      page.getByLabel("头像 HTTPS 地址").boundingBox(),
      avatar.boundingBox(),
    ]);
    expect(Math.abs(input!.y + input!.height / 2 - frame!.y - frame!.height / 2)).toBeLessThan(1);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  expect(writes).toBe(0);
  const security = page.locator(".midou-profile-security");
  const email = page.getByLabel("邮箱", { exact: true });
  await expect(email).toBeDisabled();
  await expect(email).toHaveAccessibleDescription(/邮箱暂不支持修改/);
  await expect(security.locator("dt > svg[aria-hidden='true']")).toHaveCount(2);
  await expect(page.locator('.midou-profile-email [data-verified="true"] > svg')).toHaveCount(1);
  await expect(security.locator('[data-verified="false"] > svg')).toHaveCount(0);
  await expect(security.getByRole("link", { name: "管理安全设置" })).toHaveAttribute(
    "href",
    "/me?section=security",
  );
  if ((page.viewportSize()?.width ?? 0) >= 1440)
    await expect(security.getByRole("heading", { name: "安全信息" })).toHaveCSS(
      "font-size",
      "22px",
    );
  expect(draftReads).toBe(0);
});

test("UI2-A04 profile remains writable when tenant sections and optional navigation fail", async ({
  page,
}) => {
  await accountSession(page);
  let saved = { ...profile };
  const bodies: unknown[] = [];
  const navigationMethods: string[] = [];
  await page.route("**/api/v1/me/navigation**", (route) => {
    navigationMethods.push(route.request().method());
    return route.abort();
  });
  await page.route("**/api/v1/me/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { display_name: string };
      bodies.push(body);
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      saved = { ...saved, display_name: body.display_name, version: saved.version + 1 };
    }
    await route.fulfill({ json: envelope(saved) });
  });
  await page.route("**/api/v1/me/sessions", (route) => route.fulfill({ json: envelope([]) }));
  for (const endpoint of ["authorization", "notification-preferences", "assets"]) {
    await page.route(`**/api/v1/me/${endpoint}`, (route) =>
      route.fulfill({
        status: 403,
        json: {
          error: { code: "forbidden", action_hint: "当前隔离账号尚未选择工作区。" },
          request_id: "ui2-section-unavailable",
          trace_id: "ui2-section-unavailable",
        },
      }),
    );
  }
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "隔离成员", exact: true })).toBeVisible();
  await expect(page.getByText("个人资料已读取，另有 3 个分区暂不可用，可稍后刷新。")).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: /我的权限/ }).click();
  await expect(page.getByText("权限读取未完成", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /基本资料/ }).click();
  await expect(page.getByLabel("邮箱", { exact: false }).first()).toBeDisabled();
  await page.getByLabel("显示名称", { exact: true }).fill("隔离成员新名称");
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.getByRole("heading", { name: "隔离成员新名称", exact: true })).toBeVisible();
  expect(bodies).toEqual([
    {
      username: "member.test",
      display_name: "隔离成员新名称",
      avatar_url: "",
      phone: "",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      reason: "更新个人资料",
      expected_version: 3,
    },
  ]);
  expect([...new Set(navigationMethods)]).toEqual(["GET"]);
  await expect(page.locator(".midou-profile-context")).toHaveCount(0);
});

test("UI2-A05 notification preferences keep five booleans and the latest server version", async ({
  page,
}) => {
  await accountSession(page);
  const initial = {
    version: 7,
    in_app_enabled: true,
    email_enabled: false,
    task_enabled: true,
    approval_enabled: true,
    competitor_enabled: true,
  };
  const bodies: unknown[] = [];
  let version = initial.version;
  await page.route("**/api/v1/me/profile", (route) => route.fulfill({ json: envelope(profile) }));
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({ json: envelope({ roles: [], capabilities: [], data_scopes: [] }) }),
  );
  await page.route("**/api/v1/me/sessions", (route) => route.fulfill({ json: envelope([]) }));
  await page.route("**/api/v1/me/assets", (route) =>
    route.fulfill({ json: envelope({ followed_trends: [], decisions: [], tasks: [] }) }),
  );
  await page.route("**/api/v1/me/notification-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      bodies.push(body);
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      if (bodies.length === 1) {
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "mail_provider_pending",
              action_hint: "邮件服务尚未接入，请关闭邮件通知并使用站内通知。",
            },
            request_id: "ui2-mail-pending",
            trace_id: "ui2-mail-pending",
          },
        });
      }
      version += 1;
      return route.fulfill({
        json: envelope({
          version,
          in_app_enabled: body.in_app_enabled,
          email_enabled: body.email_enabled,
          task_enabled: body.task_enabled,
          approval_enabled: body.approval_enabled,
          competitor_enabled: body.competitor_enabled,
        }),
      });
    }
    await route.fulfill({ json: envelope(initial) });
  });
  await page.goto("/me?section=notifications");
  await expect(page.getByRole("heading", { name: "五项可保存开关", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "邮件通知", exact: true }).check();
  await page.getByRole("checkbox", { name: "任务通知", exact: true }).uncheck();
  await page.getByRole("button", { name: "保存偏好", exact: true }).click();
  await expect(page.locator('.p11-action-feedback[data-status="error"]')).toContainText(
    "邮件服务尚未接入，请关闭邮件通知并使用站内通知。",
  );
  await page.getByRole("checkbox", { name: "邮件通知", exact: true }).uncheck();
  await page.getByRole("button", { name: "保存偏好", exact: true }).click();
  await expect(
    page.getByText("通知偏好已保存。保存偏好不代表邮件已送达。", { exact: true }),
  ).toBeVisible();
  expect(bodies).toEqual([
    {
      expected_version: 7,
      in_app_enabled: true,
      email_enabled: true,
      task_enabled: false,
      approval_enabled: true,
      competitor_enabled: true,
    },
    {
      expected_version: 7,
      in_app_enabled: true,
      email_enabled: false,
      task_enabled: false,
      approval_enabled: true,
      competitor_enabled: true,
    },
  ]);
});
