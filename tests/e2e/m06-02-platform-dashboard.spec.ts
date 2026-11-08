import { test, expect, chromium } from "@playwright/test";
import { CAPABILITIES } from "../../packages/authorization/src/index";
import type { Locator, Page, Route } from "@playwright/test";
import { verifyAuditedReasonFocus } from "./helpers/audited-reason-focus";
import { capturePhase2Evidence, finalizePhase2Evidence } from "./helpers/ui-phase2-evidence";
test.afterEach(async ({}, testInfo) => finalizePhase2Evidence(testInfo));

async function expectGovernancePrimary(locator: Locator) {
  const expected = await locator.evaluate((element) => {
    const hex = getComputedStyle(element).getPropertyValue("--so-primary-strong").trim();
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Unexpected primary token: ${hex}`);
    return `rgb(${[1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(", ")})`;
  });
  await expect(locator).toHaveCSS("background-color", expected);
  await expect(locator).toHaveCSS("border-top-color", expected);
  await locator.hover();
  await expect(locator).toHaveCSS("background-color", expected);
  await expect(locator).toHaveCSS("border-top-color", expected);
}
const env = (data: any) => ({ data, request_id: "m06-02-e2e", trace_id: "m06-02-e2e" }),
  dashboard = {
    window: "24h",
    summary: {
      active_organizations: 42,
      active_users: 318,
      enabled_providers: 3,
      task_success_rate: 96.4,
      queue_backlog: 7,
      open_alerts: 2,
      storage_bytes: 734003200,
      file_growth_bytes: 12582912,
    },
    queues: [
      { status: "queued", total: 5 },
      { status: "retry_scheduled", total: 2 },
    ],
    provider_health: [
      {
        id: "p1",
        code: "news_rss",
        name: "公开趋势 RSS",
        status: "healthy",
        observed_count: 28,
        success_count: 28,
        failed_count: 0,
        last_observed_at: "2026-08-08T11:50:00.000Z",
      },
      {
        id: "p2",
        code: "supplier",
        name: "供应商公开页",
        status: "degraded",
        observed_count: 12,
        success_count: 10,
        failed_count: 2,
        last_observed_at: "2026-08-08T11:40:00.000Z",
      },
      {
        id: "p3",
        code: "new",
        name: "待观测来源",
        status: "unknown",
        observed_count: 0,
        success_count: 0,
        failed_count: 0,
        last_observed_at: null,
      },
    ],
    task_trend: [],
    health_signals: [
      { code: "mysql", status: "healthy", value: "query_succeeded" },
      { code: "queue", status: "healthy", value: 7 },
      { code: "expired_leases", status: "critical", value: 1 },
      { code: "data_quality", status: "warning", value: 1 },
    ],
    alerts: [
      {
        id: "a1",
        organization_id: "00000000-0000-4000-8000-000000000601",
        workspace_id: "00000000-0000-4000-8000-000000000602",
        kind: "quality",
        severity: "warning",
        code: "title_accuracy",
        observed_at: "2026-08-08T11:45:00.000Z",
      },
      {
        id: "a2",
        organization_id: "00000000-0000-4000-8000-000000000601",
        workspace_id: "00000000-0000-4000-8000-000000000602",
        kind: "task",
        severity: "critical",
        code: "parser_changed",
        observed_at: "2026-08-08T11:40:00.000Z",
      },
    ],
    activity: [],
    observed_at: "2026-08-08T12:00:00.000Z",
  };
async function nav(
  page: Page,
  platformRole = "platform_operations_admin",
  platformCapability = "platform:operate",
) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (r) =>
    r.fulfill({
      json: env({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: [platformRole],
        platform_capabilities: [platformCapability],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/me/ui-preferences", (r) =>
    r.fulfill({
      json: env({ theme: "dark", density: "comfortable", motion_enabled: true, version: 1 }),
    }),
  );
}
const contentRecord = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-000000000756",
  title: "便携式照明热度上升",
  category: "家居照明",
  market: "US",
  language: "en-US",
  status: "active",
  signal_count: 18,
  source_count: 5,
  heat_value: 82,
  confidence_status: "measured",
  version: 4,
  last_seen_at: "2026-09-12T08:00:00.000Z",
  organization_name: "米豆选品",
  workspace_name: "北美工作区",
  ...overrides,
});
const contentEnvelope = (items: Record<string, unknown>[] = [contentRecord()]) =>
  env({
    domain: "content",
    summary: { total: 135, active: 90, irrelevant: 25, stale: 19, archived: 1 },
    items,
    pagination: {
      page: 1,
      page_size: 20,
      total: items.length ? 135 : 0,
      total_pages: items.length ? 7 : 0,
    },
    observed_at: "2026-09-12T08:00:00.000Z",
  });
test("UI2-DG54 retained data keeps its entity semantics until the new scope succeeds", async ({
  page,
}) => {
  await nav(page);
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const entered = new Promise<void>((resolve) => (started = resolve));
  let supplierReads = 0;
  await page.route("**/api/v1/platform/management?**", async (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    if (entity === "suppliers" && ++supplierReads === 1) {
      started();
      await held;
      return route.fulfill({
        status: 404,
        json: {
          error: {
            code: "not_found",
            message: "隔离读取失败",
            action_hint: "供应商读取失败，请重新筛选。",
          },
          request_id: "ui2-dg54-failed",
          trace_id: "ui2-dg54-failed",
        },
      });
    }
    const supplier = entity === "suppliers";
    return route.fulfill({
      json: env({
        domain: "data",
        entity,
        summary: { total: 1, [supplier ? "ready" : "active"]: 1 },
        items: [
          {
            id: supplier ? "supplier-54" : "trend-54",
            title: supplier ? "隔离供应商" : "隔离热点",
            organization_name: "测试组织",
            workspace_name: "测试工作区",
            status: supplier ? "ready" : "active",
            metric_primary: 8,
            metric_secondary: 2,
            updated_at: "2026-09-08T00:00:00.000Z",
          },
        ],
        observed_at: "2026-09-08T00:00:00.000Z",
      }),
    });
  });
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  const assertTrend = async () => {
    if (mobile) {
      await expect(page.getByRole("button", { name: /^隔离热点 · 展示中/ })).toBeVisible();
      await page.getByRole("button", { name: /^隔离热点 · 展示中/ }).click();
      const detail = page.getByRole("dialog", { name: "隔离热点", exact: true });
      await expect(detail.getByText("信号 / 来源", { exact: true })).toBeVisible();
      await detail.getByRole("button", { name: "关闭详情" }).click();
    } else {
      await expect(
        page.getByRole("columnheader", { name: "信号 / 来源", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("table").getByText("展示中", { exact: true })).toBeVisible();
    }
  };
  await page.goto("/platform-admin/data");
  await assertTrend();
  await page
    .getByRole("navigation", { name: "数据类型", exact: true })
    .getByRole("button", { name: "供应商" })
    .click();
  await entered;
  try {
    await assertTrend();
  } finally {
    release();
  }
  await expect(page.getByText("供应商读取失败，请重新筛选。", { exact: true })).toBeVisible();
  await assertTrend();
  await expect(page.getByRole("status").filter({ hasText: "仍显示" })).toContainText("热点");
  if (mobile) await page.getByRole("button", { name: "筛选近期数据", exact: true }).click();
  await expect(page.getByRole("button", { name: "导出表格文件", exact: true })).toBeDisabled();
  await expect(page.getByLabel("记录状态")).toContainText("可评估");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  if (mobile) await expect(page.getByRole("dialog", { name: "筛选近期数据" })).not.toBeVisible();
  if (mobile)
    await expect(page.getByRole("button", { name: /^隔离供应商 · 可评估/ })).toBeVisible();
  else
    await expect(
      page.getByRole("columnheader", { name: "最小起订量 / 报价", exact: true }),
    ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "仍显示" })).toHaveCount(0);
  expect(supplierReads).toBe(2);
});

test("UI2-P54 restores the applied record scope from same-route history", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) => {
    const url = new URL(route.request().url()),
      entity = url.searchParams.get("entity") ?? "trends",
      query = url.searchParams.get("query") ?? "",
      opportunity = entity === "opportunities",
      competitor = entity === "competitors",
      count = opportunity ? 21 : 1,
      status = opportunity ? "pending" : competitor ? "paused" : "active";
    return route.fulfill({
      json: env({
        domain: "data",
        entity,
        summary: { total: count, [status]: count },
        items: Array.from({ length: count }, (_, index) => ({
          id: `${entity}-${index + 1}`,
          title: competitor ? "历史竞品" : `${query || "初始"}机会 ${index + 1}`,
          organization_name: "测试组织",
          workspace_name: "测试工作区",
          category: "家居",
          market: "US",
          status,
          metric_primary: index + 1,
          metric_secondary: 1,
          updated_at: "2026-09-08T00:00:00.000Z",
        })),
        observed_at: "2026-09-08T00:00:00.000Z",
      }),
    });
  });
  await page.goto("/platform-admin/data?entity=opportunities&q=first&status=pending&page=2");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  if (mobile) await page.getByRole("button", { name: "筛选近期数据" }).click();
  await expect(page.getByPlaceholder("搜索名称、组织或工作区")).toHaveValue("first");
  await expect(page.getByLabel("记录状态")).toHaveValue("pending");
  if (mobile)
    await page
      .getByRole("dialog", { name: "筛选近期数据" })
      .getByRole("button", { name: "关闭筛选条件" })
      .click();
  await expect(page.getByText(/第 2 \/ 2 页/)).toBeVisible();

  await page.evaluate(() => {
    history.pushState({}, "", "/platform-admin/data?entity=competitors&q=second&status=paused");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page
      .getByRole("navigation", { name: "数据类型", exact: true })
      .getByRole("button", { name: "竞品" }),
  ).toHaveAttribute("aria-current", "page");
  if (mobile) await page.getByRole("button", { name: "筛选近期数据" }).click();
  await expect(page.getByPlaceholder("搜索名称、组织或工作区")).toHaveValue("second");
  await expect(page.getByLabel("记录状态")).toHaveValue("paused");
  if (mobile)
    await page
      .getByRole("dialog", { name: "筛选近期数据" })
      .getByRole("button", { name: "关闭筛选条件" })
      .click();
  if (mobile) await expect(page.getByRole("button", { name: /^历史竞品 · 已暂停/ })).toBeVisible();
  else await expect(page.getByText("历史竞品", { exact: true })).toBeVisible();
});

test("UI2-P54 keeps quality work state mounted while switching data workspaces", async ({
  page,
}) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: env({
        domain: "data",
        entity: "trends",
        summary: { total: 1, active: 1 },
        items: [
          {
            id: "trend-p54",
            title: "隔离热点",
            organization_name: "测试组织",
            workspace_name: "测试工作区",
            status: "active",
            metric_primary: 1,
            metric_secondary: 1,
            updated_at: "2026-09-08T00:00:00.000Z",
          },
        ],
        observed_at: "2026-09-08T00:00:00.000Z",
      }),
    }),
  );
  let qualityReads = 0;
  await page.route("**/api/v1/platform/data-quality?**", (route) => {
    qualityReads += 1;
    return route.fulfill({
      json: env({
        evidence: [],
        issues: [
          {
            id: "00000000-0000-4000-8000-000000000954",
            organization_id: "00000000-0000-4000-8000-000000000601",
            reconciliation_run_id: null,
            raw_evidence_id: null,
            parser_version: "parser-v3",
            provider_name: "Market Evidence",
            metric_code: "title_accuracy",
            field_path: "title",
            severity: "warning",
            status: "open",
            actual_value: 0.97,
            threshold_value: 0.98,
            assigned_membership_id: null,
            assigned_member_label: null,
            attribution_reason: null,
            resolution_reason: null,
            version: 1,
            updated_at: "2026-09-08T00:00:00.000Z",
          },
        ],
        reconciliationRuns: [],
        memberOptions: [],
        totalEvidence: 0,
        totalIssues: 1,
        openIssues: 1,
        criticalIssues: 0,
        observedAt: "2026-09-08T00:00:00.000Z",
      }),
    });
  });
  await page.goto("/platform-admin/data");
  const workspace = page.getByRole("navigation", { name: "平台数据视图" });
  await workspace.getByRole("button", { name: "证据与质量" }).click();
  await page.getByRole("button", { name: "质量问题" }).click();
  await page.getByLabel("搜索证据与质量").fill("标题");
  const readsBeforeHide = qualityReads;
  await workspace.getByRole("button", { name: "近期记录" }).click();
  await workspace.getByRole("button", { name: "证据与质量" }).click();
  await expect(page.getByLabel("搜索证据与质量")).toHaveValue("标题");
  await expect(
    page.getByRole("navigation", { name: "数据质量视图" }).getByRole("button", {
      name: "质量问题",
    }),
  ).toHaveAttribute("aria-current", "page");
  expect(qualityReads).toBe(readsBeforeHide);
});

test("UI2-P54 locks record scope during export and blocks repeat after an unknown result", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: env({
        domain: "data",
        entity: new URL(route.request().url()).searchParams.get("entity") ?? "trends",
        summary: { total: 1, active: 1 },
        items: [
          {
            id: "trend-p54-export",
            title: "导出范围热点",
            organization_name: "测试组织",
            workspace_name: "测试工作区",
            status: "active",
            metric_primary: 1,
            metric_secondary: 1,
            updated_at: "2026-09-08T00:00:00.000Z",
          },
        ],
        observed_at: "2026-09-08T00:00:00.000Z",
      }),
    }),
  );
  let attempts = 0;
  let releaseExport!: () => void;
  let exportStarted!: () => void;
  const exportHeld = new Promise<void>((resolve) => (releaseExport = resolve));
  const exportEntered = new Promise<void>((resolve) => (exportStarted = resolve));
  await page.route("**/api/v1/platform/management/data/exports", async (route) => {
    attempts += 1;
    expect(route.request().postDataJSON()).toMatchObject({
      entity: "trends",
      query: "",
      status: "",
    });
    exportStarted();
    await exportHeld;
    return route.abort("failed");
  });
  await page.goto("/platform-admin/data");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  if (mobile)
    await expect(page.getByRole("button", { name: /^导出范围热点 · 展示中/ })).toBeVisible();
  else await expect(page.getByText("导出范围热点", { exact: true })).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P54", "records-default", [
    "C方向蓝色类型目录与白色记录工作面可见",
    "当前快照、筛选范围与最近100条说明彼此分开",
    "真实Vue桌面表格或手机摘要卡已渲染",
  ]);
  if (mobile) await page.getByRole("button", { name: "筛选近期数据" }).click();
  const exportButton = page.getByRole("button", { name: "导出表格文件", exact: true });
  await exportButton.click();
  const dialog = page.getByRole("dialog", { name: "填写受控导出原因" });
  const reason = dialog.getByRole("textbox", { name: /原因/ });
  await reason.fill("x");
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAttribute("aria-describedby", /audited-reason-validation-error/);
  await expect(dialog.getByRole("alert")).toHaveText("请至少填写 2 个字的原因。");
  await expect(dialog.getByRole("button", { name: "确认提交" })).toBeDisabled();
  expect(attempts).toBe(0);
  await reason.fill("导出当前快照用于报表");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await exportEntered;
  const supplierButton = page
    .getByRole("navigation", { name: "数据类型", exact: true })
    .getByRole("button", { name: "供应商" });
  await expect(supplierButton).toBeDisabled();
  releaseExport();
  await expect(page.getByRole("status").filter({ hasText: "导出结果未知" })).toBeVisible();
  await expect(exportButton).toBeDisabled();
  await expect(supplierButton).toBeEnabled();
  if (mobile)
    await page
      .getByRole("dialog", { name: "筛选近期数据" })
      .getByRole("button", { name: "关闭筛选条件" })
      .click();
  await capturePhase2Evidence(page, testInfo, "P54", "records-export-unknown", [
    "无HTTP响应时明确说明导出结果未知",
    "当前快照导出按钮保持禁用以阻止重复提交",
    "数据类型入口恢复可用，允许读取新范围后解除锁定",
  ]);
  expect(attempts).toBe(1);
});

test("UI2-DG55 retained governance records keep their original workbench and version", async ({
  page,
}, testInfo) => {
  await nav(page);
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const entered = new Promise<void>((resolve) => (started = resolve));
  let autoReads = 0;
  await page.route("**/api/v1/platform/management?**", async (route) => {
    const section = new URL(route.request().url()).searchParams.get("section");
    if (section === "automation_rules" && ++autoReads === 1) {
      started();
      await held;
      return route.fulfill({
        status: 404,
        json: {
          error: {
            code: "not_found",
            message: "隔离读取失败",
            action_hint: "自动化读取失败，请刷新事实。",
          },
          request_id: "ui2-dg55-failed",
          trace_id: "ui2-dg55-failed",
        },
      });
    }
    const automation = section === "automation_rules";
    return route.fulfill({
      json: env({
        domain: "governance",
        section,
        summary: { score_rules: 1, automation_rules: 1, provider_versions: 0 },
        items: [
          {
            id: automation ? "auto-55" : "score-55",
            name: automation ? "隔离自动化" : "隔离评分",
            status: "active",
            ...(automation ? { version: 3 } : { revision: 2 }),
            updated_at: "2026-09-08T00:00:00.000Z",
          },
        ],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
        observed_at: "2026-09-08T00:00:00.000Z",
      }),
    });
  });
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  const assertScore = async () => {
    if (mobile) await page.getByRole("button", { name: /^隔离评分 · 启用/ }).click();
    else await page.getByRole("table").getByRole("button", { name: "查看详情" }).click();
    const dialog = page.getByRole("dialog", {
      name: mobile ? "隔离评分" : "隔离评分详情",
      exact: true,
    });
    await expect(dialog.getByText("第 2 版", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "进入所属工作台" })).toHaveAttribute(
      "href",
      "/opportunities/scoring-rules",
    );
    await dialog.press("Escape");
    await expect(dialog).not.toBeVisible();
  };
  await page.goto("/platform-admin/governance");
  await assertScore();
  await page
    .getByRole("navigation", { name: "治理数据类型" })
    .getByRole("button", { name: "自动化规则" })
    .click();
  await entered;
  try {
    await assertScore();
  } finally {
    release();
  }
  await expect(page.getByText("自动化读取失败，请刷新事实。", { exact: true })).toBeVisible();
  await assertScore();
  await expect(page.getByRole("status").filter({ hasText: "仍显示" })).toContainText("评分规则");
  await capturePhase2Evidence(page, testInfo, "P55", "governance-retained-failed", [
    "新分类读取失败后保留原评分规则快照",
    "范围提示说明当前仍显示的分类与版本",
    "行入口仍指向原所属工作台",
  ]);
  await page.getByRole("button", { name: "刷新事实", exact: true }).click();
  if (mobile) await page.getByRole("button", { name: /^隔离自动化 · 启用/ }).click();
  else await page.getByRole("table").getByRole("button", { name: "查看详情" }).click();
  const detail = page.getByRole("dialog", {
    name: mobile ? "隔离自动化" : "隔离自动化详情",
    exact: true,
  });
  await expect(detail.getByText("第 3 版", { exact: true })).toBeVisible();
  await expect(detail.getByRole("link", { name: "进入规则编辑" })).toHaveCount(0);
  await expect(page.locator('a[href^="/automations"]')).toHaveCount(0);
  expect(autoReads).toBe(2);
});

test("UI2-DG55 C directory exposes factual counts and complete automation details", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) => {
    const section = new URL(route.request().url()).searchParams.get("section") ?? "score_rules";
    const automation = section === "automation_rules";
    return route.fulfill({
      json: env({
        domain: "governance",
        section,
        summary: {
          score_rules: 3,
          cost_rules: 2,
          approval_templates: 4,
          automation_rules: 1,
          releases: 2,
          provider_versions: 7,
        },
        items: [
          automation
            ? {
                id: "automation-c-55",
                name: "竞品价格变化通知",
                organization_name: "合成组织",
                workspace_name: "合成工作区",
                trigger_event_type: "competitor.changed",
                condition_severity: "any",
                action_type: "notify_owner",
                action_title: "竞品价格变化：通知负责人",
                rate_limit_count: 0,
                rate_limit_window_minutes: 60,
                status: "active",
                version: 3,
                updated_at: "2026-09-12T08:00:00.000Z",
              }
            : {
                id: "score-c-55",
                name: "全渠道评分基线",
                version_code: "score-2026-09",
                organization_name: "平台全局",
                workspace_name: null,
                status: "active",
                revision: 6,
                updated_at: "2026-09-12T08:00:00.000Z",
              },
        ],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
        provider_versions_latest_at: "2026-09-12T07:30:00.000Z",
        observed_at: "2026-09-12T08:00:00.000Z",
      }),
    });
  });

  await page.goto("/platform-admin/governance");
  await expect(page.getByRole("heading", { name: "规则、工作流与自动化", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "治理数据类型" })).toContainText("评分规则");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  if (mobile)
    await expect(page.getByRole("button", { name: /^全渠道评分基线 · 启用/ })).toBeVisible();
  else await expect(page.getByText("全渠道评分基线", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await capturePhase2Evidence(page, testInfo, "P55", "governance-directory", [
    "桌面为左侧蓝色目录，手机为可横向滚动的顶部目录",
    "五类全量计数与当前分类状态可同时辨认",
    "目录不混入任何写操作",
  ]);
  await capturePhase2Evidence(page, testInfo, "P55", "governance-default", [
    "蓝色五分类版本目录显示全量计数",
    "白色工作面优先呈现成功快照与记录版本",
    "来源配置历史作为相关事实而非第六类规则",
  ]);

  const governanceFont = await page
    .locator(".platform-governance")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  await expect(page.getByRole("heading", { name: "规则、工作流与自动化", level: 1 })).toHaveCSS(
    "font-family",
    governanceFont,
  );
  await expectGovernancePrimary(page.locator(".platform-page-header .is-primary"));
  if (mobile) await page.getByRole("button", { name: "筛选治理记录", exact: true }).click();
  await expectGovernancePrimary(page.getByRole("button", { name: "应用筛选", exact: true }));
  if (mobile)
    await page
      .getByRole("dialog", { name: "筛选治理记录" })
      .getByRole("button", { name: "关闭筛选条件", exact: true })
      .click();

  await page
    .getByRole("navigation", { name: "治理数据类型" })
    .getByRole("button", { name: /自动化规则/ })
    .click();
  await expect(page).toHaveURL(/section=automation_rules/);
  if (mobile) await page.getByRole("button", { name: /^竞品价格变化通知 · 启用/ }).click();
  else await page.getByRole("table").getByRole("button", { name: "查看详情" }).click();
  const detail = page.getByRole("dialog", {
    name: mobile ? "竞品价格变化通知" : "竞品价格变化通知详情",
    exact: true,
  });
  await expect(detail.getByText("竞品发生变化", { exact: true })).toBeVisible();
  await expect(detail.getByText("通知负责人", { exact: true })).toBeVisible();
  await expect(detail.getByText("竞品价格变化：通知负责人", { exact: true })).toBeVisible();
  await expect(detail.getByText("0 次 / 60 分钟", { exact: true })).toBeVisible();
  await expect(detail.getByRole("link", { name: "进入规则编辑" })).toHaveCount(0);
  await expect(page.locator('a[href^="/automations"]')).toHaveCount(0);
  await capturePhase2Evidence(page, testInfo, "P55", "governance-automation-detail", [
    "自动化详情在桌面与手机均展示触发、动作和频控",
    "0 次频控按原始事实显示而不隐藏",
    "已退役的成员规则编辑入口不再展示",
  ]);
});

test("UI2-DG55 C directory distinguishes a filtered empty result from global counts", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) => {
    const url = new URL(route.request().url());
    const filtered = url.searchParams.has("query") || url.searchParams.has("status");
    return route.fulfill({
      json: env({
        domain: "governance",
        section: "score_rules",
        summary: {
          score_rules: 8,
          cost_rules: 3,
          approval_templates: 2,
          automation_rules: 5,
          releases: 1,
          provider_versions: 9,
        },
        items: filtered
          ? []
          : [
              {
                id: "score-filter-55",
                name: "标准评分规则",
                status: "active",
                revision: 2,
                updated_at: "2026-09-12T08:00:00.000Z",
              },
            ],
        pagination: {
          page: 1,
          page_size: 20,
          total: filtered ? 0 : 1,
          total_pages: filtered ? 0 : 1,
        },
        provider_versions_latest_at: "2026-09-12T07:30:00.000Z",
        observed_at: "2026-09-12T08:00:00.000Z",
      }),
    });
  });

  await page.goto("/platform-admin/governance");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  if (mobile) await page.getByRole("button", { name: "筛选治理记录" }).click();
  const filterScope = mobile
    ? page.getByRole("dialog", { name: "筛选治理记录" })
    : page.locator(".governance-filter");
  await filterScope.getByPlaceholder("搜索规则、版本、组织或工作区").fill("不存在");
  await filterScope.getByLabel("治理状态").selectOption("active");
  await filterScope.getByRole("button", { name: "应用筛选" }).click();
  await expect(
    mobile
      ? page.locator(".responsive-data-view__empty")
      : page.locator(".governance-table__empty"),
  ).toContainText("当前分类没有匹配记录");
  await expect(page.getByRole("navigation", { name: "治理数据类型" })).toContainText("8");
  await capturePhase2Evidence(page, testInfo, "P55", "governance-filtered-empty", [
    "筛选结果显示 0 条而不冒充全局无规则",
    "左侧全量计数和来源历史仍保留",
    "已应用的搜索与状态反映在 URL 中",
  ]);
  await expect(page).toHaveURL(/q=%E4%B8%8D%E5%AD%98%E5%9C%A8/);
  await expect(page).toHaveURL(/status=active/);
});

test("UI2-DG55 C directory presents a gentle first-load permission state", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: "forbidden",
          message: "无权读取治理目录",
          action_hint: "权限调整后重新加载。",
        },
        request_id: "governance-forbidden-55",
        trace_id: "governance-forbidden-55",
      },
    }),
  );

  await page.goto("/platform-admin/governance");
  await expect(page.getByRole("heading", { name: "当前无法查看治理目录" })).toBeVisible();
  await expect(page.getByText(/当前权限还不能读取这些内容/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P55", "governance-forbidden", [
    "权限拒绝文案说明当前状态和可恢复下一步",
    "不展示伪造的规则计数或记录",
    "重新加载是唯一主操作",
  ]);
});

test("UI2-DG55 cached governance suspends off-route reads and refreshes on return", async ({
  page,
}) => {
  await nav(page);
  let governanceReads = 0;
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({ json: env(dashboard) }),
  );
  await page.route("**/api/v1/platform/management?**", (route) => {
    governanceReads += 1;
    return route.fulfill({
      json: env({
        domain: "governance",
        section: "score_rules",
        summary: { score_rules: 1, provider_versions: 0 },
        items: [
          {
            id: `cached-score-${governanceReads}`,
            name: `缓存评分规则 ${governanceReads}`,
            status: "active",
            revision: governanceReads,
            updated_at: "2026-09-12T08:00:00.000Z",
          },
        ],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
        observed_at: "2026-09-12T08:00:00.000Z",
      }),
    });
  });

  await page.goto("/platform-admin/governance");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  const visibleRecord = (revision: number) =>
    mobile
      ? page.getByRole("button", { name: new RegExp(`^缓存评分规则 ${revision} · 启用`) })
      : page.getByText(`缓存评分规则 ${revision}`, { exact: true });
  await expect(visibleRecord(1)).toBeVisible();
  expect(governanceReads).toBe(1);
  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "平台运行概览", level: 2 })).toBeVisible();
  expect(governanceReads).toBe(1);
  await page.goto("/platform-admin/governance");
  await expect(visibleRecord(2)).toBeVisible();
  expect(governanceReads).toBe(2);
});

test("UI2-PN56 C ledger exposes complete facts and the review contract", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({ json: contentEnvelope() }),
  );

  await page.goto("/platform-admin/content");
  await expect(
    page.locator(".platform-content--review").getByRole("heading", {
      name: "内容管理",
      level: 1,
    }),
  ).toBeVisible();
  const summary = page.getByRole("region", { name: "当前查询统计" });
  await expect(summary).toContainText("135");
  await expect(summary).toContainText("90");
  await expect(summary).toContainText("25");
  await expect(summary).toContainText("19");
  await expect(summary).toContainText("1");
  await expect(page.getByText("当前快照：全部主题 · 全部状态。", { exact: false })).toBeVisible();
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  if (mobile) {
    const record = page.getByRole("button", { name: /便携式照明热度上升.*查看详情/ });
    await expect(record).toContainText("18 / 5");
    await expect(record).toContainText("82");
  } else {
    const table = page.getByRole("table");
    await expect(table.getByText("便携式照明热度上升", { exact: true })).toBeVisible();
    await expect(table.getByText("家居照明 · 最近观测", { exact: false })).toBeVisible();
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await capturePhase2Evidence(page, testInfo, "P56", "content-default", [
    "五项统计包含真实零值并与状态筛选解耦",
    "桌面七列表格和手机事实卡保留相同业务事实",
    "内容工作台只提供展示状态审核，不提供正文编辑或归档写入",
  ]);
  if (mobile)
    await capturePhase2Evidence(page, testInfo, "P56", "content-records", [
      "手机记录卡直接展示状态、信号、来源、热度和置信度",
      "市场、语言与最近观测时间无需进入详情即可核对",
      "详情入口为整张事实卡并保持 44px 以上触控目标",
    ]);

  if (mobile) {
    await page.getByRole("button", { name: /便携式照明热度上升.*查看详情/ }).click();
    await page
      .getByRole("dialog", { name: "便携式照明热度上升" })
      .getByRole("button", { name: "标记过期" })
      .click();
  } else await page.getByTitle("标记为过期").click();
  const dialog = page.getByRole("dialog", { name: "审核热点内容" });
  await expect(dialog).toContainText("米豆选品 / 北美工作区 · 当前展示中 · v4");
  await expect(dialog.getByRole("combobox", { name: "目标状态" })).toHaveValue("stale");
  await expect(dialog.getByRole("button", { name: "确认审核" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "审核依据" }).fill("最近观测信号已过期");
  await expect(dialog.getByRole("button", { name: "确认审核" })).toBeEnabled();
  await capturePhase2Evidence(page, testInfo, "P56", "content-review-stale", [
    "审核窗保留标题、组织、工作区、原状态和提交版本",
    "原因在去除首尾空白后必须为 2 至 300 字",
    "审核窗只允许展示中、无关和已过期三种写状态",
  ]);
  await dialog.getByRole("button", { name: "取消" }).click();
});

test("UI2-PN56 draft filters preserve the snapshot and empty results keep query totals", async ({
  page,
}, testInfo) => {
  await nav(page);
  const requests: string[] = [];
  await page.route("**/api/v1/platform/management?**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const filtered =
      url.searchParams.get("query") === "不存在" && url.searchParams.get("status") === "stale";
    return route.fulfill({ json: contentEnvelope(filtered ? [] : [contentRecord()]) });
  });

  await page.goto("/platform-admin/content");
  await page.getByRole("button", { name: "筛选内容管理" }).click();
  let filters = page.getByRole("dialog", { name: "筛选内容管理" });
  await filters.getByRole("textbox", { name: "搜索热点内容" }).fill("不存在");
  await filters.getByRole("combobox", { name: "内容状态" }).selectOption("stale");
  await filters.getByRole("button", { name: "关闭筛选条件" }).click();
  await expect(page).toHaveURL(/\/platform-admin\/content$/);
  await expect(page.getByText("当前快照：全部主题 · 全部状态。", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: /筛选内容管理.*2 项已选/ }).click();
  filters = page.getByRole("dialog", { name: "筛选内容管理" });
  await filters.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page.getByRole("heading", { name: "当前筛选没有内容记录" })).toBeVisible();
  await expect(page.getByRole("region", { name: "当前查询统计" })).toContainText("135");
  await expect(page).toHaveURL(/query=%E4%B8%8D%E5%AD%98%E5%9C%A8/);
  await expect(page).toHaveURL(/status=stale/);
  await capturePhase2Evidence(page, testInfo, "P56", "content-filtered-empty", [
    "关闭筛选窗只保留草稿，不改变快照标签或 URL",
    "应用后空结果与查询统计同时保留",
    "URL 只记录已应用的搜索词、状态和页码",
  ]);
  expect(requests).toHaveLength(2);
});

test("UI2-PN56 reports a committed review separately when the list refresh fails", async ({
  page,
}, testInfo) => {
  await nav(page);
  let reads = 0;
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/v1/platform/management/content/**", async (route) => {
    body = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({ json: env({ id: contentRecord().id, status: "stale", version: 5 }) });
  });
  await page.route("**/api/v1/platform/management?**", (route) => {
    reads += 1;
    if (reads === 1) return route.fulfill({ json: contentEnvelope() });
    return route.fulfill({
      status: 503,
      json: {
        error: {
          code: "service_unavailable",
          message: "列表读取失败",
          action_hint: "请重新加载内容台账。",
        },
        request_id: "content-refresh-failed-56",
        trace_id: "content-refresh-failed-56",
      },
    });
  });

  await page.goto("/platform-admin/content");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  if (mobile) {
    await page.getByRole("button", { name: /便携式照明热度上升.*查看详情/ }).click();
    await page
      .getByRole("dialog", { name: "便携式照明热度上升" })
      .getByRole("button", { name: "标记过期" })
      .click();
  } else await page.getByTitle("标记为过期").click();
  const dialog = page.getByRole("dialog", { name: "审核热点内容" });
  await dialog.getByRole("textbox", { name: "审核依据" }).fill("超过有效观察周期");
  await dialog.getByRole("button", { name: "确认审核" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "内容状态已更新，但列表未能刷新。请重新加载后核对最新状态。",
  );
  await expect(
    mobile
      ? page.getByRole("button", { name: /便携式照明热度上升.*查看详情/ })
      : page.getByRole("table").getByText("便携式照明热度上升", { exact: true }),
  ).toBeVisible();
  expect(body).toEqual({
    status: "stale",
    expected_version: 4,
    reason: "超过有效观察周期",
  });
  await capturePhase2Evidence(page, testInfo, "P56", "content-success-refresh-failed", [
    "PATCH 成功而后续 GET 失败时明确区分写成功与刷新失败",
    "页面保留旧快照并要求重新读取核对",
    "提交体保持 status、expected_version 与 trim 后 reason 的既有合同",
  ]);
});

test("UI2-PN56 an older write result cannot close a newer review", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "A desktop case proves request ownership.",
  );
  await nav(page);
  let release!: () => void;
  let entered!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (entered = resolve));
  let patches = 0;
  await page.route("**/api/v1/platform/management/content/**", async (route) => {
    patches += 1;
    entered();
    await held;
    await route.fulfill({ json: env({ status: "stale", version: 5 }) });
  });
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: contentEnvelope([
        contentRecord(),
        contentRecord({
          id: "00000000-0000-4000-8000-000000000757",
          title: "庭院灯需求回落",
          status: "irrelevant",
          version: 2,
        }),
      ]),
    }),
  );

  await page.goto("/platform-admin/content");
  await page.getByTitle("标记为过期").first().click();
  let dialog = page.getByRole("dialog", { name: "审核热点内容" });
  await dialog.getByRole("textbox", { name: "审核依据" }).fill("超过有效观察周期");
  await dialog.getByRole("button", { name: "确认审核" }).click();
  await started;
  await dialog.getByRole("button", { name: "关闭窗口" }).click();
  await page.getByTitle("设为展示中").last().click();
  dialog = page.getByRole("dialog", { name: "审核热点内容" });
  await expect(dialog).toContainText("庭院灯需求回落");
  release();
  await expect(page.getByRole("status")).toContainText("内容状态已更新");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("庭院灯需求回落");
  expect(patches).toBe(1);
});

test("UI2-PN56 presents a gentle first-load permission state", async ({ page }, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: "forbidden",
          message: "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
          action_hint: "权限调整后重新加载。",
        },
        request_id: "content-forbidden-56",
        trace_id: "content-forbidden-56",
      },
    }),
  );

  await page.goto("/platform-admin/content");
  await expect(page.getByRole("heading", { name: "当前无法读取内容台账" })).toBeVisible();
  await expect(page.getByText(/当前权限还不能读取这些内容/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expect(page.getByRole("region", { name: "当前查询统计" })).toHaveCount(0);
  await capturePhase2Evidence(page, testInfo, "P56", "content-forbidden", [
    "权限拒绝采用温和措辞并提供明确恢复动作",
    "首次读取失败不展示伪造统计或内容记录",
    "追踪编号留在请求层，不冒充业务事实",
  ]);
});

test("UI2-PN56 cached content stops off-route reads and refreshes on return", async ({ page }) => {
  await nav(page);
  let contentReads = 0;
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({ json: env(dashboard) }),
  );
  await page.route("**/api/v1/platform/management?**", (route) => {
    contentReads += 1;
    return route.fulfill({
      json: contentEnvelope([
        contentRecord({
          id: `cached-content-${contentReads}`,
          title: `缓存内容记录 ${contentReads}`,
          version: contentReads,
        }),
      ]),
    });
  });

  await page.goto("/platform-admin/content");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
  const visibleRecord = (revision: number) =>
    mobile
      ? page.getByRole("button", { name: new RegExp(`缓存内容记录 ${revision}.*查看详情`) })
      : page.getByRole("table").getByText(`缓存内容记录 ${revision}`, { exact: true });
  await expect(visibleRecord(1)).toBeVisible();
  expect(contentReads).toBe(1);
  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "平台运行概览", level: 2 })).toBeVisible();
  expect(contentReads).toBe(1);
  await page.goto("/platform-admin/content");
  await expect(visibleRecord(2)).toBeVisible();
  expect(contentReads).toBe(2);
});

test("API coverage dashboard exposes the current production truth dimensions on desktop and mobile", async ({
  page,
}) => {
  await nav(page, "platform_super_admin", "platform:superadmin");
  const operationFixture = {
    operation_id: "get_platform_management",
    method: "GET",
    path: "/api/v1/platform/management",
    required_capability: null,
    expected_roles: ["platform_super_admin"],
    verification_role: "platform_super_admin",
    http_status: 200,
    outcome: "success",
    request_id: "request-p63-0",
    trace_id: "trace-p63-0",
    data_source: "mysql57_business",
    ui_consumers: ["/platform-admin/api-coverage"],
    crawler_side_effect: "none",
    evidence: {
      normal: {
        applicable: true,
        status: "passed",
        test_id: "production:trace:get_platform_management:normal",
        latest_result: "200:success",
      },
      authorization: {
        applicable: true,
        status: "passed",
        test_id: "production:trace:get_platform_management:authorization",
        latest_result: "401:unauthenticated",
      },
      parameters: {
        applicable: true,
        status: "not_run",
        test_id: null,
        latest_result: null,
      },
      idempotency: {
        applicable: false,
        status: "not_applicable",
        test_id: null,
        latest_result: null,
      },
      fault: {
        applicable: true,
        status: "not_run",
        test_id: null,
        latest_result: null,
      },
    },
  };
  await page.route("**/api/v1/platform/management?domain=api_coverage**", (route) =>
    route.fulfill({
      json: env({
        domain: "api_coverage",
        report_status: "current",
        catalog_fingerprint: "a".repeat(64),
        summary: {
          paths: 225,
          operations: 258,
          verified: 258,
          coverage_percent: 100,
          evidence_applicable: 1080,
          evidence_passed: 512,
          evidence_coverage_percent: 47.41,
          ui_consumed: 180,
          crawler_side_effects: 12,
        },
        by_outcome: [
          { key: "success", count: 255 },
          { key: "empty", count: 2 },
          { key: "unauthorized", count: 1 },
        ],
        evidence_dimensions: [
          {
            key: "normal",
            applicable: 258,
            passed: 258,
            failed: 0,
            not_run: 0,
            not_applicable: 0,
            coverage_percent: 100,
          },
          {
            key: "authorization",
            applicable: 245,
            passed: 245,
            failed: 0,
            not_run: 0,
            not_applicable: 13,
            coverage_percent: 100,
          },
          {
            key: "parameters",
            applicable: 184,
            passed: 11,
            failed: 0,
            not_run: 173,
            not_applicable: 74,
            coverage_percent: 5.98,
          },
          {
            key: "idempotency",
            applicable: 139,
            passed: 0,
            failed: 0,
            not_run: 139,
            not_applicable: 119,
            coverage_percent: 0,
          },
          {
            key: "fault",
            applicable: 258,
            passed: 0,
            failed: 0,
            not_run: 258,
            not_applicable: 0,
            coverage_percent: 0,
          },
        ],
        by_role: [
          {
            key: "platform_super_admin",
            expected_allowed: 258,
            verified: 258,
            success: 255,
            empty: 2,
            blocked: 0,
            unauthorized: 1,
          },
        ],
        by_data_source: [{ key: "mysql57_business", count: 258 }],
        by_ui_consumer: [{ key: "/platform-admin/api-coverage", count: 258 }],
        by_crawler_side_effect: [{ key: "none", count: 258 }],
        operations: Array.from({ length: 258 }, (_, index) => ({
          ...operationFixture,
          operation_id: index ? `fixture_operation_${index}` : operationFixture.operation_id,
          path: index ? `/api/v1/fixture/operation-${index}` : operationFixture.path,
          request_id: `request-p63-${index}`,
          trace_id: `trace-p63-${index}`,
        })),
        total_filtered: 258,
        captured_at: "2026-08-23T12:00:00.000Z",
        age_seconds: 60,
      }),
    }),
  );
  await page.goto("/platform-admin/api-coverage");
  await expect(page.getByRole("heading", { name: "接口覆盖证据", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "接口覆盖核验", level: 1 })).toBeVisible();
  for (const heading of [
    "运行结果记录",
    "五维验证证据",
    "角色验证记录",
    "数据来源声明",
    "UI 消费方声明",
    "爬虫副作用声明",
  ])
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.locator(".p63-summary")).toContainText("100.00%");
  await expect(page.locator(".p63-summary")).toContainText("47.41%");
  await expect(page.getByText("get_platform_management", { exact: true })).toBeVisible();
  await expect(page.locator(".p63-operation")).toHaveCount(258);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("/api/v1/platform/management", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test("platform cockpit gives live operations the full workspace and accessible alert scrolling", async ({
  page,
}) => {
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (!mobile) await page.setViewportSize({ width: 1858, height: 1000 });
  await nav(page);
  const overview = {
    ...dashboard,
    task_trend: [
      { bucket: "2026-08-08T10:00:00.000Z", succeeded: 4, failed: 1 },
      { bucket: "2026-08-08T11:00:00.000Z", succeeded: 8, failed: 0 },
    ],
    provider_health: Array.from({ length: 8 }, (_, index) => ({
      ...dashboard.provider_health[index % 3],
      id: `source-${index}`,
      name: `来源 ${index + 1} · Amazon 美国商品与行业趋势`,
    })),
    alerts: Array.from({ length: 20 }, (_, index) => ({
      ...dashboard.alerts[index % 2],
      id: `alert-${index}`,
    })),
  };
  await page.route("**/api/v1/platform/dashboard?**", (r) => r.fulfill({ json: env(overview) }));
  await page.goto("/platform-admin");
  await expect(page.getByRole("region", { name: "平台指标" })).toContainText("活跃组织42");
  await expect(page.locator(".platform-alerts > li")).toHaveCount(20);
  const bounds = await page.locator(".platform-dashboard").evaluate((root) => {
    const rect = (selector: string) => {
      const r = root.querySelector(selector)!.getBoundingClientRect();
      return { top: r.top, right: r.right, left: r.left, bottom: r.bottom };
    };
    const parent = root.parentElement!,
      style = getComputedStyle(parent);
    return {
      width: root.getBoundingClientRect().width,
      available:
        parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      trend: rect(".platform-trend-chart"),
      sources: rect(".platform-source-health"),
      grid: rect(".platform-dashboard-grid"),
      shortcuts: rect(".platform-get-started"),
    };
  });
  expect(bounds.shortcuts.top).toBeGreaterThanOrEqual(bounds.grid.bottom);
  const alerts = page.getByRole("list", { name: "需要关注记录" });
  if (mobile) {
    expect(bounds.sources.top).toBeGreaterThanOrEqual(bounds.trend.bottom);
    await expect(alerts).not.toHaveCSS("overflow-y", "auto");
    const metrics = page.locator(".platform-facts article");
    const first = await metrics.nth(0).boundingBox(),
      second = await metrics.nth(1).boundingBox(),
      last = await metrics.last().boundingBox();
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
    expect(last!.width).toBeGreaterThan(first!.width * 1.8);
  } else {
    expect(bounds.width).toBeGreaterThan(1400);
    expect(Math.abs(bounds.width - bounds.available)).toBeLessThan(2);
    expect(Math.abs(bounds.sources.top - bounds.trend.top)).toBeLessThan(2);
    expect(bounds.sources.left).toBeGreaterThan(bounds.trend.right);
    expect(
      Math.abs(
        bounds.sources.right - bounds.sources.left - (bounds.trend.right - bounds.trend.left),
      ),
    ).toBeLessThan(2);
    await expect(alerts).toHaveCSS("overflow-y", "auto");
    const timestamps = page.locator(".platform-source-health tbody td:last-child");
    expect(await timestamps.count()).toBe(8);
    const preview = page.locator(".platform-source-health .table-view-controls__content");
    const lastRowVisible = await preview.evaluate((el) => {
      const viewport = el.getBoundingClientRect();
      const rows = el.querySelectorAll("tbody tr");
      return (
        rows[rows.length - 1]!.getBoundingClientRect().bottom <=
        viewport.top + el.clientTop + el.clientHeight + 1
      );
    });
    expect(lastRowVisible).toBe(true);
    expect(
      await timestamps.evaluateAll((cells) =>
        cells.every((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const text = range.getBoundingClientRect();
          return (
            range.getClientRects().length === 1 && text.right <= cell.getBoundingClientRect().right
          );
        }),
      ),
    ).toBe(true);
    await alerts.focus();
    await alerts.press("End");
    await expect.poll(() => alerts.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await alerts.evaluate((el) => (el as HTMLElement).blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("platform-overview-workbench.png", { fullPage: false });
});

test("platform overview has one create organization action in its page header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page, "platform_super_admin", "platform:superadmin");
  await page.route("**/api/v1/platform/dashboard?**", (r) => r.fulfill({ json: env(dashboard) }));
  await page.goto("/platform-admin");
  const create = page.getByRole("link", { name: "新建组织", exact: true });
  await expect(create).toHaveCount(1);
  const header = page.locator(".platform-page-header");
  const range = header.getByRole("combobox", { name: "查看范围", exact: true });
  const refresh = header.getByRole("button", { name: "刷新", exact: true });
  await expect(refresh).toBeEnabled();
  const [a, b, c] = await Promise.all([create, range, refresh].map((part) => part.boundingBox()));
  expect([a!.width, b!.width, c!.width]).toEqual([122, 145, 92]);
  expect(b!.x - a!.x - a!.width).toBe(16);
  expect(c!.x - b!.x - b!.width).toBe(16);
  await expect(
    page.locator(".platform-page-header").getByRole("link", { name: "新建组织", exact: true }),
  ).toHaveAttribute("href", "/platform-admin/organizations/new");
  await expect(
    page.locator(".role-topbar").getByRole("link", { name: "新建组织", exact: true }),
  ).toHaveCount(0);
});

test("tablet platform metric rows fill the card without empty cells", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Tablet platform grid");
  await page.setViewportSize({ width: 900, height: 900 });
  await nav(page, "platform_super_admin", "platform:superadmin");
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({ json: env(dashboard) }),
  );
  await page.goto("/platform-admin");
  const facts = page.getByRole("region", { name: "平台指标", exact: true });
  const cells = facts.locator("article");
  await expect(cells).toHaveCount(5);
  for (const width of [900, 761, 841, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    const [a, b, c, d, e] = await Promise.all(
      (await cells.all()).map((cell) => cell.boundingBox()),
    );
    expect(Math.abs(a!.y - c!.y), `width=${width}: upper row alignment`).toBeLessThanOrEqual(1);
    expect(Math.abs(d!.y - e!.y), `width=${width}: lower row alignment`).toBeLessThanOrEqual(1);
    expect(Math.abs(d!.x - a!.x), `width=${width}: left edge`).toBeLessThanOrEqual(1);
    expect(
      Math.abs(e!.x + e!.width - c!.x - c!.width),
      `width=${width}: right edge`,
    ).toBeLessThanOrEqual(1);
    expect(d!.width, `width=${width}: balanced lower row`).toBeCloseTo(e!.width, 0);
    expect(d!.y).toBeGreaterThan(a!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await expect(cells.locator("> strong")).toHaveText(["42", "318", "3", "96.4%", "12.0 MB"]);
  await expect(facts.getByRole("link", { name: "查看来源" })).toHaveAttribute(
    "href",
    "/platform-admin/providers/sources",
  );
  await page.setViewportSize({ width: 900, height: 900 });
});

test("platform metric cards share label, value and action baselines when one value wraps", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop and tablet metric tracks");
  const large = 987654321012345;
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page, "platform_super_admin", "platform:superadmin");
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({
      json: env({ ...dashboard, summary: { ...dashboard.summary, active_organizations: large } }),
    }),
  );
  await page.goto("/platform-admin");
  const cards = page.getByRole("region", { name: "平台指标" }).locator("article");
  await expect(cards).toHaveCount(5);
  await expect(cards.first().locator("strong")).toHaveText(String(large));
  for (const [width, cols] of [
    [1672, 5],
    [900, 3],
  ] as const) {
    await page.setViewportSize({ width, height: 941 });
    const geometry = await cards.evaluateAll((cells) =>
      cells.map((cell) => {
        const value = cell.querySelector("strong")!;
        const range = document.createRange();
        range.selectNodeContents(value);
        const bound = cell.getBoundingClientRect();
        return {
          labelY: cell.querySelector(":scope > span")!.getBoundingClientRect().top,
          valueY: value.getBoundingClientRect().top,
          actionY: cell.querySelector(":scope > a")!.getBoundingClientRect().top,
          lines: range.getClientRects().length,
          withinCell: [...range.getClientRects()].every(
            (line) => line.left >= bound.left && line.right <= bound.right + 0.5,
          ),
        };
      }),
    );
    console.log("platform metric tracks", width, JSON.stringify(geometry));
    expect(geometry[0]!.lines).toBeGreaterThan(1);
    expect(geometry.every((card) => card.withinCell)).toBe(true);
    for (const group of [geometry.slice(0, cols), geometry.slice(cols)].filter(
      (row) => row.length,
    )) {
      for (const card of group) {
        expect(card.labelY).toBeCloseTo(group[0]!.labelY, 0);
        expect(card.valueY).toBeCloseTo(group[0]!.valueY, 0);
        expect(card.actionY).toBeCloseTo(group[0]!.actionY, 0);
      }
    }
  }
});

test("platform attention cards keep large counts and labels in separate tracks", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Check several responsive widths");
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page);
  const count = 9007199254740991;
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({
      json: env({
        ...dashboard,
        summary: {
          ...dashboard.summary,
          queue_backlog: count,
          open_alerts: count,
        },
      }),
    }),
  );
  await page.goto("/platform-admin");
  const cards = page.locator(".platform-action-summary > a");
  await expect(cards.locator("strong")).toHaveText([String(count), String(count)]);
  const insets = await cards.evaluateAll((links) =>
    links.map((link) => getComputedStyle(link).paddingInlineEnd),
  );
  console.log("PLATFORM_SUMMARY_COUNT_INSETS", JSON.stringify(insets));
  expect(insets).toEqual(["36px", "24px"]);
  await expect(cards.first()).toHaveAttribute("href", "/platform-admin/collection");
  await expect(cards.last()).toHaveAttribute(
    "href",
    "/platform-admin/collection/overview?root_cause=1",
  );
  for (const width of [1672, 1101, 390]) {
    await page.setViewportSize({ width, height: 941 });
    const layout = await cards.evaluateAll((rows) =>
      rows.map((row) => {
        const bounds = row.getBoundingClientRect();
        const label = row.querySelector("span")!.getBoundingClientRect();
        const number = row.querySelector("strong")!;
        const numberBounds = number.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(number);
        const lines = [...range.getClientRects()];
        return {
          fraction: numberBounds.width / bounds.width,
          labelWidth: label.width,
          inside: lines.every(
            (line) => line.left >= label.right && line.right <= bounds.right + 0.5,
          ),
        };
      }),
    );
    console.log("platform attention layout", width, JSON.stringify(layout));
    for (const card of layout) {
      expect(card.fraction).toBeLessThanOrEqual(0.5);
      expect(card.labelWidth).toBeGreaterThan(70);
      expect(card.inside).toBe(true);
    }
  }
});

test("platform overview refresh keeps the action group fixed while a read is pending", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide action track");
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page, "platform_super_admin", "platform:superadmin");
  let reads = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/platform/dashboard?**", async (route) => {
    if (++reads === 2) await held;
    await route.fulfill({ json: env(dashboard) });
  });
  await page.goto("/platform-admin");
  const header = page.locator(".platform-dashboard > .platform-page-header");
  const create = header.getByRole("link", { name: "新建组织", exact: true });
  const period = header.getByRole("combobox", { name: "查看范围", exact: true });
  const refresh = header.locator(".platform-page-header__actions > button");
  const read = () => Promise.all([create, period, refresh].map((item) => item.boundingBox()));
  await expect(refresh).toHaveText("刷新");
  const baseline = await read();
  await refresh.click();
  try {
    await expect(refresh).toHaveText("刷新中…");
    await expect(refresh).toBeDisabled();
    await expect(period).toBeDisabled();
    const loading = await read();
    const contentFits = await refresh.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    console.log(
      "PLATFORM_PENDING_ACTION_TRACK",
      JSON.stringify({ baseline, loading, contentFits }),
    );
    expect(loading).toEqual(baseline);
    expect(contentFits).toBe(true);
  } finally {
    release();
  }
  await expect(refresh).toHaveText("刷新");
  await expect(period).toBeEnabled();
  expect(await read()).toEqual(baseline);
  expect(reads).toBe(2);
});

test("platform reference first fold fits system checks and source health without hiding storage data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page, "platform_super_admin", "platform:superadmin");
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: env({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_super_admin"],
        platform_capabilities: CAPABILITIES,
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/platform/dashboard?**", (r) => r.fulfill({ json: env(dashboard) }));
  await page.goto("/platform-admin");
  await expect(page.locator(".platform-dashboard--review")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  const sidebar = page.getByRole("complementary", { name: "工作区导航" });
  const overview = sidebar.getByRole("link", { name: "平台概览", exact: true });
  await expect(sidebar.getByRole("link", { name: "组织管理", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "开放平台", exact: true })).toHaveAttribute(
    "href",
    "/platform-admin/open-platform",
  );
  await expect(sidebar.locator(".midou-organization-help summary")).toBeInViewport({ ratio: 1 });
  await expect(
    sidebar.getByRole("link", { name: "开放平台", exact: true }).locator("svg path").nth(2),
  ).toHaveAttribute("d", "m14.5 4-5 16");
  await expect(
    sidebar.getByRole("link", { name: "来源设置", exact: true }).locator("svg path").first(),
  ).toHaveAttribute("d", /^m12 2 10 5/);
  await expect(
    sidebar.getByRole("link", { name: "采集管理", exact: true }).locator("svg circle"),
  ).toHaveAttribute("r", "3");
  const areaTabs = sidebar.getByRole("navigation", { name: "工作台类型", exact: true });
  const areaTabsBounds = (await areaTabs.boundingBox())!;
  expect(areaTabsBounds.y).toBeCloseTo(82, 0);
  await expect(areaTabs).toHaveCSS("translate", "0px -3px");
  const contextLink = sidebar.getByRole("link", { name: "选择组织与工作区后进入用户工作台" });
  expect((await contextLink.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await expect(contextLink).toHaveCSS("padding-inline-start", "15px");
  await expect(sidebar.locator("footer")).toHaveCSS("inset-block-start", "3px");
  await expect(sidebar.locator(".midou-organization-help")).toHaveCSS("justify-self", "end");
  expect((await sidebar.boundingBox())!.width).toBeCloseTo(243, 0);
  await expect(sidebar).toHaveCSS("padding-inline-end", "16px");
  expect((await overview.boundingBox())!.y).toBeCloseTo(170, 0);
  const navGroups = sidebar.locator(".commerce-sidebar-menu > section");
  await expect(navGroups).toHaveCount(4);
  await expect(navGroups.nth(1)).toHaveCSS("padding-block-start", "3px");
  await expect(navGroups.nth(3)).toHaveCSS("padding-block-start", "9px");
  const organizations = sidebar.getByRole("link", { name: "组织管理", exact: true });
  expect((await organizations.boundingBox())!.y - (await overview.boundingBox())!.y).toBe(33);
  expect((await overview.locator("span").boundingBox())!.x).toBeCloseTo(66, 0);
  const settings = (await sidebar.getByRole("link", { name: "设置", exact: true }).boundingBox())!;
  const help = (await sidebar.locator(".midou-organization-help summary").boundingBox())!;
  expect(settings.y + settings.height / 2).toBeCloseTo(help.y + help.height / 2, 0);
  expect(settings.x + settings.width).toBeLessThanOrEqual(help.x);
  await expect(page.locator(".platform-dashboard--review")).toHaveCSS(
    "font-family",
    /^"Segoe UI", "?DengXian"?,/,
  );
  const signals = page.locator(".platform-system-checks");
  const sources = page.locator(".platform-source-health");
  await expect(signals).toBeVisible();
  await expect(signals.locator(".platform-signals li")).toHaveCount(
    dashboard.health_signals.length,
  );
  await expect(signals.locator(".platform-signal-icon[aria-hidden='true']")).toHaveCount(
    dashboard.health_signals.length,
  );
  await expect(signals.locator(".platform-signal-ok")).toHaveText("正常");
  await expect(signals.locator(".platform-signal-icon[data-health='critical']")).toHaveCount(1);
  const healthyIcon = signals.locator(".platform-signal-icon[data-health='healthy']").first();
  await expect(healthyIcon).toHaveCSS("border-radius", "50%");
  await expect(healthyIcon.locator("circle")).toHaveCount(0);
  const facts = page.getByRole("region", { name: "平台指标" });
  const [factsBox, metricRow, checksBox] = await Promise.all(
    [facts, facts.locator(":scope > div"), signals].map((part) => part.boundingBox()),
  );
  expect(Math.abs(factsBox!.x - 273)).toBeLessThanOrEqual(2);
  expect(Math.abs(factsBox!.y - 303)).toBeLessThanOrEqual(3);
  const workQueue = (await page.locator(".platform-action-summary").boundingBox())!;
  expect(Math.abs(workQueue.y - 208)).toBeLessThanOrEqual(2);
  const queueLinks = page.locator(".platform-action-summary > a");
  const pending = (await queueLinks.first().boundingBox())!;
  const alerts = (await queueLinks.last().boundingBox())!;
  expect(Math.abs(pending.x + pending.width - 940)).toBeLessThanOrEqual(3);
  expect(Math.abs(alerts.x - 940)).toBeLessThanOrEqual(3);
  await expect(queueLinks.first().locator("svg")).toHaveCSS("width", "28px");
  await expect(queueLinks.first().locator("svg")).toHaveCSS("grid-area", "icon");
  await expect(queueLinks.first().locator("svg")).toHaveCSS("translate", "none");
  await expect(queueLinks.first().locator("span")).toHaveCSS("font-size", "17px");
  const [iconBox, countBox, labelBox, noteBox] = await Promise.all(
    ["svg", "strong", "span", "small"].map((selector) =>
      queueLinks.first().locator(selector).boundingBox(),
    ),
  );
  expect(iconBox!.y + iconBox!.height / 2).toBeCloseTo(countBox!.y + countBox!.height / 2, 0);
  expect(labelBox!.x).toBe(noteBox!.x);
  await expect(queueLinks.last().locator("strong")).toHaveCSS(
    "font-variant-numeric",
    "tabular-nums",
  );
  await expect(queueLinks.first().locator("small")).toHaveCSS("font-size", "14px");
  await expect(page.locator(".platform-page-header h2")).toHaveCSS("inset-block-start", "-1px");
  await expect(facts.locator(":scope > header")).toHaveCSS("padding-inline-start", "4px");
  await expect(signals.locator("h3")).toHaveCSS("inset-inline-start", "0px");
  await expect(signals.locator("h3")).toHaveCSS("inset-block-start", "-3px");
  await expect(sources.locator("thead th").first()).toHaveCSS("padding-inline-start", "16px");
  const headingActions = page.locator(".platform-page-header__actions");
  await expect(headingActions).toHaveCSS("translate", "-1px 1px");
  for (const action of await headingActions.locator("a, button, select").all()) {
    expect((await action.boundingBox())!.height).toBe(38);
  }
  const rangeBorder = await headingActions
    .locator("select")
    .evaluate((node) => getComputedStyle(node).borderTopColor);
  await expect(headingActions.getByRole("button", { name: "刷新", exact: true })).toHaveCSS(
    "border-top-color",
    rangeBorder,
  );
  expect(Math.abs(metricRow!.x - 293)).toBeLessThanOrEqual(2);
  const metricTracks = await facts.locator("article").evaluateAll((cards) =>
    cards.map((card) => {
      const title = card.querySelector(":scope > span")!;
      const titleText = Array.from(title.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE,
      )!;
      const range = document.createRange();
      range.selectNodeContents(titleText);
      const icon = title.querySelector("svg")!.getBoundingClientRect();
      const label = range.getBoundingClientRect();
      const value = card.querySelector(":scope > strong")!.getBoundingClientRect();
      const action = card.querySelector(":scope > :is(a, small)")!.getBoundingClientRect();
      return { value: value.x, label: label.x, action: action.x, gap: label.x - icon.right };
    }),
  );
  for (const [index, x] of [356, 623, 887, 1155, 1426].entries()) {
    const metric = metricTracks[index]!;
    expect(Math.abs(metric.value - x)).toBeLessThanOrEqual(5);
    expect(metric.value).toBeCloseTo(metric.label, 0);
    expect(metric.action).toBeCloseTo(metric.label, 0);
    expect(metric.gap).toBeCloseTo(13, 0);
  }
  expect(Math.abs(metricRow!.y + metricRow!.height - 463)).toBeLessThanOrEqual(3);
  const trendCard = (await page.locator(".platform-trend-chart").boundingBox())!;
  const emptyTrend = page.locator(".platform-trend-empty");
  await expect(page.locator(".platform-trend-chart > header > span")).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(emptyTrend.locator(":scope > strong")).toHaveCSS("font-size", "18px");
  await expect(emptyTrend.locator(":scope > span")).toHaveCSS("font-size", "14px");
  await expect(emptyTrend.getByRole("link", { name: "查看采集队列" })).toBeVisible();
  const sourceCard = (await sources.boundingBox())!;
  expect(Math.abs(trendCard.y - 499)).toBeLessThanOrEqual(2);
  expect(Math.abs(sourceCard.x - 974)).toBeLessThanOrEqual(3);
  expect(sourceCard.x - trendCard.x - trendCard.width).toBeCloseTo(19, 0);
  expect(checksBox!.x).toBe(factsBox!.x);
  const sourceLink = facts.getByRole("link", { name: "查看来源", exact: true });
  await expect(sourceLink).toHaveAttribute("href", "/platform-admin/providers/sources");
  await expect(sourceLink.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(sourceLink).toHaveCSS("column-gap", "6px");
  for (const card of [signals, sources]) {
    const bounds = await card.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(925);
  }
  await expect(sources.locator("tbody i[data-health]").first()).toHaveCSS("font-weight", "600");
  await expect(sources.locator("tbody i[data-health]").first()).toHaveCSS("border-radius", "999px");
  const cell = sources.locator("tbody td").first();
  const sourceTable = sources.locator("table");
  const sourceToolbar = sources.locator(".table-view-controls__toolbar");
  await expect(sourceToolbar).toHaveCSS("translate", "none");
  await expect(sourceToolbar).toHaveCSS("inset-block-start", "-1.5px");
  await expect(sourceToolbar).toHaveCSS("padding-inline-end", "6px");
  await expect(sourceToolbar).toHaveCSS("column-gap", "9px");
  const columnControl = sourceToolbar.locator("details > summary");
  const freezeControl = sourceToolbar.getByRole("button", { name: "首列已冻结" });
  const densityCaption = sourceToolbar.locator("label > span");
  await expect(columnControl).toHaveCSS("min-inline-size", "90px");
  await expect(freezeControl).toHaveCSS("min-inline-size", "116px");
  await expect(densityCaption).toHaveCSS("min-inline-size", "100px");
  await expect(densityCaption.locator("path")).toHaveAttribute("d", /^M3 3h7v7H3/);
  const toolbarParts = [
    columnControl,
    freezeControl,
    densityCaption,
    sourceToolbar.locator("select"),
  ];
  const toolbarBoxes = await Promise.all(toolbarParts.map((control) => control.boundingBox()));
  expect(Math.abs(toolbarBoxes[0]!.x - 1212)).toBeLessThanOrEqual(4);
  const centerY = toolbarBoxes[0]!.y + toolbarBoxes[0]!.height / 2;
  for (const box of toolbarBoxes) expect(box!.y + box!.height / 2).toBeCloseTo(centerY, 0);
  const [densityBox, sourceTableBox] = await Promise.all([
    sourceToolbar.locator("select").boundingBox(),
    sourceTable.boundingBox(),
  ]);
  expect(Math.abs(densityBox!.y - 555)).toBeLessThanOrEqual(3);
  expect(Math.abs(sourceTableBox!.y - 602)).toBeLessThanOrEqual(3);
  await expect(sourceTable).toHaveCSS("table-layout", "fixed");
  const sourceHeaders = await sourceTable
    .locator("th")
    .evaluateAll((headers) =>
      headers.map(
        (header) =>
          header.getBoundingClientRect().left + parseFloat(getComputedStyle(header).paddingLeft),
      ),
    );
  expect(Math.abs(sourceHeaders[0] - 1008)).toBeLessThanOrEqual(6);
  expect(sourceHeaders[1] - sourceHeaders[0]).toBeGreaterThanOrEqual(220);
  expect(sourceHeaders[2] - sourceHeaders[1]).toBeGreaterThanOrEqual(75);
  await expect(sourceTable.locator("tbody td:last-child").first()).toHaveCSS(
    "white-space",
    "normal",
  );
  await expect(sourceTable.getByRole("columnheader", { name: "最近观测" })).toHaveCSS(
    "text-align",
    "center",
  );
  await expect(sourceTable.locator("tbody td:last-child").last()).toHaveCSS("text-align", "center");
  await expect(sourceTable.locator("tbody td:last-child").first()).toHaveText(
    /^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}:\d{2}$/,
  );
  await expect(sourceTable.locator("tbody td:last-child").last()).toHaveText("无样本");
  await expect(sources.getByRole("heading", { name: "来源健康" })).toHaveCSS("font-size", "19px");
  await expect(signals.getByRole("heading", { name: "系统检查" })).toHaveCSS("font-size", "19px");
  await expect(signals.locator(":scope > header")).toHaveCSS("margin-block-end", "16px");
  const signalRows = signals.locator(".platform-signals li");
  await expect(signalRows.first()).toHaveCSS("padding-inline-start", "12px");
  const checksRhythm = {
    row: await signalRows.first().evaluate((el) => getComputedStyle(el).minBlockSize),
    tail: await signals.evaluate((el) => getComputedStyle(el).paddingBlockEnd),
    bottom: (await signals.boundingBox())!.y + (await signals.boundingBox())!.height,
  };
  console.log("PLATFORM_SYSTEM_CHECK_RHYTHM", JSON.stringify(checksRhythm));
  expect(checksRhythm).toMatchObject({ row: "33px", tail: "0px" });
  expect(checksRhythm.bottom).toBeLessThanOrEqual(925);
  await expect(signals.locator(".platform-signal-ok")).toHaveCSS("margin-inline-end", "3px");
  for (const row of await signalRows.all()) {
    await expect(row).toHaveCSS("min-block-size", "33px");
    await expect(row).toBeInViewport({ ratio: 1 });
  }
  await expect(signals).toBeInViewport({ ratio: 1 });
  await expect(signalRows.first().locator(":scope > span")).toHaveCSS("line-height", "20px");
  await expect(signalRows.first().locator(".platform-signal-ok")).toHaveCSS(
    "min-inline-size",
    "54px",
  );
  await expect(cell).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(cell.locator("b")).toHaveCSS("letter-spacing", "-0.12px");
  await expect(cell.locator("b")).toHaveCSS("font-size", "15px");
  await expect(sourceTable.locator("tbody td:nth-child(3)").first()).toHaveCSS("font-size", "16px");
  const density = sources.getByLabel("表格密度");
  await expect(
    sources.locator(".table-view-controls__toolbar svg[aria-hidden='true']"),
  ).toHaveCount(3);
  const freezeGlyph = sources.getByRole("button", { name: "首列已冻结" }).locator("svg");
  await expect(freezeGlyph).toHaveAttribute("focusable", "false");
  await expect(freezeGlyph.locator(":scope > path").first()).toHaveAttribute(
    "d",
    "m12 2.75 9.25 9.25L12 21.25 2.75 12Z",
  );
  await expect(sources.locator(".table-view-controls__content")).toHaveCSS("border-radius", "10px");
  const freeze = sources.getByRole("button", { name: "首列已冻结" });
  await expect(freeze).toHaveAttribute("aria-pressed", "true");
  await freeze.click();
  await expect(cell).not.toHaveClass(/table-view-controls__frozen/);
  await sources.getByRole("button", { name: "首列未冻结" }).click();
  await expect(cell).toHaveClass(/table-view-controls__frozen/);
  const stripedRow = sourceTable.locator("tbody tr").nth(1);
  const stripeColor = await stripedRow.evaluate((row) => getComputedStyle(row).backgroundColor);
  await expect(stripedRow.locator("td").first()).toHaveCSS("background-color", stripeColor);
  await sources.getByText("列设置", { exact: true }).click();
  const statusColumn = sources.getByRole("checkbox", { name: "切换第 2 列" });
  const readVisibleFacts = () =>
    sourceTable.evaluate((table) => {
      const row = table.querySelector("tbody tr")!;
      const cells = Array.from(row.querySelectorAll("td"));
      const css = (index: number) => getComputedStyle(cells[index]!);
      return {
        sourceInset: css(0).paddingInlineStart,
        countSize: css(2).fontSize,
        countNumerals: css(2).fontVariantNumeric,
        timeSize: css(3).fontSize,
        timeNumerals: css(3).fontVariantNumeric,
        timeWrap: css(3).overflowWrap,
        timeWhiteSpace: css(3).whiteSpace,
      };
    });
  const visibleFactsBefore = await readVisibleFacts();
  await statusColumn.uncheck();
  await expect(sources.locator("th").nth(1)).toBeHidden();
  const visibleFactsAfter = await readVisibleFacts();
  console.log(
    "SOURCE_FACT_STYLES",
    JSON.stringify({ before: visibleFactsBefore, after: visibleFactsAfter }),
  );
  expect(visibleFactsAfter).toEqual(visibleFactsBefore);
  expect(visibleFactsBefore).toMatchObject({
    timeSize: "14px",
    timeNumerals: "tabular-nums",
    timeWrap: "anywhere",
    timeWhiteSpace: "normal",
  });
  await expect(sourceTable.locator("tbody td.platform-source-observation").first()).toBeVisible();
  await expect(sourceTable).toHaveCSS("table-layout", "auto");
  await statusColumn.check();
  await expect(sources.locator("th").nth(1)).toBeVisible();
  await expect(sourceTable).toHaveCSS("table-layout", "fixed");
  await sources.getByText("列设置", { exact: true }).click();
  await expect(cell).toHaveCSS("padding-top", "8px");
  await expect(cell).toHaveCSS("line-height", "20px");
  await density.selectOption("compact");
  await expect(cell).toHaveCSS("padding-top", "6px");
  await density.selectOption("standard");
  await expect(cell).toHaveCSS("padding-top", "8px");
  const storage = page.locator(".platform-storage-details");
  await expect(storage.locator("dl")).toBeHidden();
  const metricActions = page.locator(".platform-facts article > a");
  await expect(metricActions.first()).toHaveCSS("padding-inline-start", "4px");
  await expect(metricActions.last()).toHaveCSS("padding-inline-start", "6px");
  const groupedLegend = page.locator(".platform-trend-chart > header > span");
  const legendGeometry = await groupedLegend.evaluate((legend) => ({
    keyCount: legend.querySelectorAll(":scope > .platform-trend-key").length,
    wrap: getComputedStyle(legend).flexWrap,
    gap: getComputedStyle(legend).columnGap,
  }));
  console.log("PLATFORM_TREND_LEGEND_GROUPING", JSON.stringify(legendGeometry));
  expect(legendGeometry).toEqual({ keyCount: 3, wrap: "wrap", gap: "20px" });
  const keys = groupedLegend.locator(":scope > .platform-trend-key");
  await expect(keys).toHaveText(["成功 0", "失败 0", "0 个时间点"]);
  for (const key of await keys.all()) {
    await expect(key).toHaveCSS("font-size", "14px");
    await expect(key).toHaveCSS("column-gap", "8px");
    await expect(key.locator("i[data-series]")).toHaveAttribute("aria-hidden", "true");
  }
  await expect(page.locator(".platform-system-checks .platform-signals > li").first()).toHaveCSS(
    "padding-inline-end",
    "6px",
  );
  await expect(page.getByRole("columnheader", { name: "最近观测" })).toHaveCSS(
    "padding-inline-end",
    "21px",
  );
  const panelTitles = page.locator(
    ".platform-dashboard--review :is(.platform-facts, .platform-trend-chart, .platform-source-health, .platform-system-checks) > header h3",
  );
  await expect(panelTitles).toHaveCount(4);
  for (const title of await panelTitles.all()) await expect(title).toHaveCSS("font-weight", "750");
  const sourceScan = page.locator(".platform-source-health");
  const scanTable = sourceScan.locator("table");
  await expect(sourceScan.locator(":scope > header > span")).toHaveCSS("translate", "-3px 1px");
  await expect(page.locator(".platform-system-checks > header > span")).toHaveCSS(
    "translate",
    "-1px -2px",
  );
  await expect(scanTable.getByRole("columnheader", { name: "来源", exact: true })).toHaveCSS(
    "padding-inline-start",
    "16px",
  );
  await expect(scanTable.locator("tbody td:first-child").first()).toHaveCSS(
    "padding-inline-start",
    "16px",
  );
  for (const column of ["td:nth-child(3)", "td:last-child"]) {
    const firstValue = scanTable.locator("tbody tr:first-child " + column);
    await expect(firstValue).toHaveCSS("font-variant-numeric", "tabular-nums");
    const contained = await firstValue.evaluate((cell) => {
      const text = document.createRange();
      text.selectNodeContents(cell);
      const bounds = cell.getBoundingClientRect();
      return [...text.getClientRects()].every(
        (part) => part.left >= bounds.left && part.right <= bounds.right,
      );
    });
    expect(contained).toBe(true);
  }
  const semanticBadges = page.locator(
    ".platform-source-health td > i[data-health], .platform-system-checks .platform-signal-ok",
  );
  await expect(semanticBadges).toHaveCount(4);
  const readableBadges = await semanticBadges.evaluateAll((badges) => {
    const context = document.createElement("canvas").getContext("2d")!;
    const rgb = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const luminance = (values: number[]) =>
      values
        .map((value) => value / 255)
        .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    return badges.map((badge) => {
      const positive = badge.matches('[data-health="healthy"], .platform-signal-ok');
      const token = positive
        ? "--midou-status-positive-surface"
        : "--midou-status-attention-surface";
      const style = getComputedStyle(badge);
      const surface = style.backgroundColor;
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${token})`;
      badge.append(probe);
      const matches = getComputedStyle(probe).backgroundColor === surface;
      probe.remove();
      const fg = luminance(rgb(style.color));
      const bg = luminance(rgb(surface));
      return { matches, contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) };
    });
  });
  for (const badge of readableBadges) {
    expect(badge.matches).toBe(true);
    expect(badge.contrast).toBeGreaterThanOrEqual(4.5);
  }
  const successMetric = page
    .getByRole("region", { name: "平台指标" })
    .locator("article")
    .filter({ hasText: "任务成功率" });
  await expect(successMetric.locator('span > svg path[d="M12 13V2l8 4-8 4"]')).toHaveCount(1);
  await expect(successMetric.locator("span > svg")).toHaveAttribute("aria-hidden", "true");
  await expect(successMetric.getByRole("link", { name: "查看任务" })).toHaveAttribute(
    "href",
    "/platform-admin/collection",
  );
  const sourceFooterGap = await sources.evaluate((card) => {
    const content = card.querySelector(".table-view-controls__content")!;
    return {
      align: getComputedStyle(card).alignSelf,
      rows: card.querySelectorAll("tbody tr").length,
      gap: card.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom,
    };
  });
  console.log("PLATFORM_SHORT_SOURCE_CARD", JSON.stringify(sourceFooterGap));
  expect(sourceFooterGap.rows).toBe(3);
  expect(sourceFooterGap.align).toBe("start");
  expect(sourceFooterGap.gap).toBeLessThanOrEqual(24);
  const footer = sidebar.locator("footer");
  const footerInsets = await footer.evaluate((node) =>
    [".midou-platform-return", ".midou-sidebar-settings"].map(
      (selector) => getComputedStyle(node.querySelector(selector)!).paddingInlineStart,
    ),
  );
  console.log("PLATFORM_RAIL_FOOTER", JSON.stringify(footerInsets));
  expect(footerInsets).toEqual(["15px", "14px"]);
  await storage.getByText("存储统计", { exact: true }).click();
  await expect(storage.locator("dl")).toContainText("活动文件体积");
  await expect(storage.locator("dl")).toContainText("窗内文件增长");
  await page.setViewportSize({ width: 1600, height: 941 });
  await expect(sourceTable).toHaveCSS("table-layout", "fixed");
  await expect(sourceTable.locator("tbody td:last-child").first()).toHaveCSS(
    "white-space",
    "normal",
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(signalRows.first()).not.toHaveCSS("min-block-size", "33px");
  await expect(signalRows).toHaveCount(dashboard.health_signals.length);
  const sourceContent = sources.locator(".table-view-controls__content");
  expect(
    await sourceContent.evaluate((node) => node.scrollWidth - node.clientWidth),
  ).toBeLessThanOrEqual(1);
});

test("wide platform system checks give a short list more room without hiding signals", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide system-check spacing");
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page);
  const health_signals = dashboard.health_signals.slice(0, 3);
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({ json: env({ ...dashboard, health_signals }) }),
  );
  await page.goto("/platform-admin");
  const rows = page.locator(".platform-system-checks .platform-signals > li");
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    await expect(row).toHaveCSS("min-block-size", "38px");
    await expect(row.locator(":scope > span")).toHaveCSS("translate", "1px 2px");
    await expect(row).toBeInViewport({ ratio: 1 });
  }
});

test("M06-02.A07/A08/A15 desktop and 390 cockpit use factual states", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/dashboard?**", (r) => r.fulfill({ json: env(dashboard) }));
  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "平台运行概览", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "新建组织", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /等待处理 7/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /需要关注 2/ })).toBeVisible();
  await expect(
    page.locator(".platform-action-summary a > .platform-action-icon[aria-hidden='true']"),
  ).toHaveCount(2);
  const facts = page.getByRole("region", { name: "平台指标" });
  await expect(facts).toContainText("活跃组织42");
  await expect(facts).toContainText("活跃用户318");
  await expect(facts).toContainText("启用来源3");
  await expect(facts).toContainText("任务成功率96.4%");
  await expect(page.getByText("过期任务租约", { exact: true })).toBeVisible();
  await expect(page.getByText("页面解析规则可能变化", { exact: true })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await expect(page.getByText("待观测来源 · 未知", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText("待观测来源", { exact: true })).toBeVisible();
    await expect(page.getByText("未知", { exact: true })).toBeVisible();
  }
  await expect(page.getByText("数据库", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /检查来源是否启用/ })).toBeVisible();
  await expect(page.locator(".platform-trend-empty")).toContainText("暂无趋势数据");
  const emptyIcon = await page.locator(".platform-trend-empty > svg").boundingBox();
  expect(emptyIcon!.width).toBeLessThan(60);
  const legend = page.locator(".platform-trend-chart header");
  await expect(legend.locator("i[data-series]")).toHaveCount(3);
  await expect(legend).toContainText("0 个时间点");
  await expect(legend.locator(".platform-trend-key")).toHaveCount(3);
  for (const key of await legend.locator(".platform-trend-key").all()) {
    await expect(key).toHaveCSS("white-space", "nowrap");
    await expect(key.locator("i[data-series]")).toBeVisible();
  }
  const colors = await legend
    .locator("i[data-series]")
    .evaluateAll((dots) => dots.map((dot) => getComputedStyle(dot).backgroundColor));
  expect(new Set(colors).size).toBe(3);
  await expect(facts.locator("article > span > svg")).toHaveCount(5);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("查看排队、运行或受阻的采集任务 →")).toBeVisible();
  await page.getByRole("button", { name: /公开趋势 RSS/ }).click();
  const dialog = page.getByRole("dialog", { name: "公开趋势 RSS" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("技术详情").click();
  await expect(dialog.getByText("p1", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭详情" }).click();
});
test("platform cockpit prioritizes source exceptions and progressively reveals the full catalog", async ({
  page,
}, testInfo) => {
  const wideDesktop = testInfo.project.name === "desktop-chromium";
  if (wideDesktop) await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page);
  const providerHealth = Array.from({ length: 15 }, (_, index) => ({
    id: `provider-${index + 1}`,
    code: `provider_${index + 1}`,
    name: index === 14 ? "异常来源 15" : `待观测来源 ${index + 1}`,
    status: index === 14 ? "degraded" : "unknown",
    observed_count: index === 14 ? 4 : 0,
    success_count: index === 14 ? 1 : 0,
    failed_count: index === 14 ? 3 : 0,
    last_observed_at: index === 14 ? "2026-08-08T11:40:00.000Z" : null,
  }));
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({
      json: env({
        ...dashboard,
        summary: { ...dashboard.summary, enabled_providers: providerHealth.length },
        provider_health: providerHealth,
      }),
    }),
  );

  await page.goto("/platform-admin");
  const sourceSection = page.getByRole("heading", { name: "来源健康" }).locator("../..");
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  const sourceName = (name: string) =>
    mobile
      ? sourceSection.locator(".responsive-data-view__mobile strong").filter({ hasText: name })
      : sourceSection.locator("tbody b").filter({ hasText: name });
  await expect(sourceName("异常来源 15")).toBeVisible();
  await expect(sourceName("待观测来源 14")).toBeHidden();
  const visibleRows = mobile
    ? sourceSection.locator(".responsive-data-view__mobile article:visible")
    : sourceSection.locator("tbody tr");
  await expect(visibleRows).toHaveCount(8);
  const previewHeight = (await sourceSection.boundingBox())!.height;
  await sourceSection.getByRole("button", { name: /查看全部 15 个来源/ }).click();
  await expect(visibleRows).toHaveCount(15);
  await expect(sourceName("待观测来源 14")).toBeVisible();
  if (wideDesktop) {
    expect((await sourceSection.boundingBox())!.height).toBeCloseTo(previewHeight, 0);
    const table = sourceSection.getByRole("region", { name: "来源健康表格", exact: true });
    await table.focus();
    await table.press("End");
    await expect(visibleRows.last()).toBeInViewport({ ratio: 1 });
  }
  await sourceSection.getByRole("button", { name: /收起来源/ }).click();
  await expect(visibleRows).toHaveCount(8);
});
for (const matchReferenceCounts of [false, true]) {
  test(
    matchReferenceCounts
      ? "platform reference counts and complete source dataset render without fabricated samples"
      : "wide source health six-row composition stays aligned with mixed names",
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "Wide table composition");
      await page.setViewportSize({ width: 1672, height: 941 });
      await nav(page, "platform_super_admin", "platform:superadmin");
      const names = [
        "1688 搜索",
        "Amazon 美国畅销榜",
        "Ars Technica",
        "BBC Business",
        "BigCommerce 电商资讯",
        "DHgate 批发供应商搜索",
      ];
      const allNames = matchReferenceCounts
        ? [...names, ...Array.from({ length: 193 }, (_, i) => "其他测试来源 " + (i + 1))]
        : names;
      const sources = allNames.map((name, index) => ({
        ...dashboard.provider_health[2],
        id: "six-provider-" + index,
        code: "six_provider_" + index,
        name,
      }));
      await page.route("**/api/v1/platform/dashboard?**", (r) =>
        r.fulfill({
          json: env({
            ...dashboard,
            summary: matchReferenceCounts
              ? {
                  ...dashboard.summary,
                  active_organizations: 84,
                  active_users: 104,
                  enabled_providers: 199,
                  task_success_rate: null,
                  queue_backlog: 0,
                  open_alerts: 0,
                  file_growth_bytes: 0,
                }
              : { ...dashboard.summary, enabled_providers: sources.length },
            provider_health: sources,
            health_signals: matchReferenceCounts
              ? [
                  dashboard.health_signals[0],
                  { ...dashboard.health_signals[1], value: 0 },
                  { ...dashboard.health_signals[2], value: 0, status: "healthy" },
                ]
              : dashboard.health_signals.slice(0, 3),
            queues: matchReferenceCounts ? [] : dashboard.queues,
            alerts: matchReferenceCounts ? [] : dashboard.alerts,
          }),
        }),
      );
      await page.goto("/platform-admin");
      const section = page.locator(".platform-source-health");
      const table = section.locator("table");
      const previewNames = allNames.slice(0, 8);
      await expect(table.locator("tbody tr")).toHaveCount(previewNames.length);
      await expect(table.locator("tbody td:first-child")).toHaveText(previewNames);
      await expect(table.locator("tbody td:last-child")).toHaveText(
        previewNames.map(() => "无样本"),
      );
      await expect(table).toHaveCSS("table-layout", "fixed");
      const columnStarts = await table
        .locator("th")
        .evaluateAll((headers) =>
          headers.map(
            (header) =>
              header.getBoundingClientRect().left +
              parseFloat(getComputedStyle(header).paddingLeft),
          ),
        );
      for (const [index, expected] of [1008, 1281, 1386].entries())
        expect(Math.abs(columnStarts[index]! - expected)).toBeLessThanOrEqual(6);
      await expect(section).toBeInViewport({ ratio: 1 });
      if (matchReferenceCounts) {
        const facts = page.getByRole("region", { name: "平台指标" });
        await expect(facts.locator("article > strong")).toHaveText([
          "84",
          "104",
          "199",
          "暂无样本",
          "0 B",
        ]);
        await expect(page.locator(".platform-action-summary strong")).toHaveText(["0", "0"]);
      }
      if (matchReferenceCounts) {
        await expect(section.locator(":scope > header")).toContainText("199 个启用来源");
        const checks = page.locator(".platform-system-checks");
        const before = {
          source: (await section.boundingBox())!,
          checks: (await checks.boundingBox())!,
        };
        await section.getByRole("button", { name: /查看全部 199 个来源/ }).click();
        await expect(table.locator("tbody tr")).toHaveCount(199);
        const after = {
          source: (await section.boundingBox())!,
          checks: (await checks.boundingBox())!,
        };
        console.log(
          "platform source expansion",
          JSON.stringify({
            preview: before.source.height,
            expanded: after.source.height,
            checksBeforeY: before.checks.y,
            checksAfterY: after.checks.y,
          }),
        );
        expect(after.source.height).toBeCloseTo(before.source.height, 0);
        expect(after.checks.y).toBeCloseTo(before.checks.y, 0);
        const scroller = section.getByRole("region", { name: "来源健康表格", exact: true });
        await scroller.focus();
        await scroller.press("End");
        const last = table.locator("tbody tr").last();
        await expect(last).toContainText(allNames.at(-1)!);
        await expect(last).toBeInViewport({ ratio: 1 });
        await expect(scroller.getByRole("columnheader", { name: "最近观测" })).toBeInViewport({
          ratio: 1,
        });
        await section.getByRole("button", { name: /收起来源/ }).click();
        await expect(table.locator("tbody tr")).toHaveCount(8);
        expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
      }
    },
  );
}

test("source health bounds six wrapped rows by rendered height", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide source health layout");
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page);
  const health = Array.from({ length: 6 }, (_, index) => ({
    ...dashboard.provider_health[2],
    id: "wrapped-source-" + index,
    code: "wrapped_source_" + index,
    name: "AmazonSellerCatalogueSource".repeat(5) + (index + 1),
  }));
  let reads = 0;
  await page.route("**/api/v1/platform/dashboard?**", (route) => {
    reads += 1;
    return route.fulfill({ json: env({ ...dashboard, provider_health: health }) });
  });
  await page.goto("/platform-admin");
  const sources = page.locator(".platform-source-health");
  const content = sources.locator(".table-view-controls__content");
  await expect(content.locator("tbody tr")).toHaveCount(6);
  await expect(content.getByText(health[5].name, { exact: true })).toHaveCount(1);
  const layout = await content.evaluate((node) => ({
    bottom: node.getBoundingClientRect().bottom,
    overflow: node.scrollHeight - node.clientHeight,
    pageScroll: window.scrollY,
  }));
  console.log("six wrapped source rows", JSON.stringify(layout));
  await expect(sources).toHaveCSS("align-self", "stretch");
  expect(layout.bottom).toBeLessThanOrEqual(941);
  expect(layout.overflow).toBeGreaterThan(0);
  const region = sources.getByRole("region", { name: "来源健康表格", exact: true });
  await expect(region).toBeVisible();
  await expect(content.locator("thead th").first()).toHaveCSS("position", "sticky");
  await region.focus();
  await region.press("End");
  await expect.poll(() => content.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(layout.pageScroll);
  await expect(region.getByRole("columnheader", { name: "来源", exact: true })).toBeInViewport({
    ratio: 1,
  });
  await expect(sources.getByRole("button", { name: /查看全部|收起来源/ })).toHaveCount(0);
  await sources.getByText("列设置", { exact: true }).click();
  const firstColumn = sources.getByRole("checkbox", { name: "切换第 1 列" });
  await firstColumn.uncheck();
  await expect(region).toHaveCount(0);
  await firstColumn.check();
  await expect(region).toBeVisible();
  expect(reads).toBe(1);
});

test("platform source controls stay aligned across short and wrapped tables", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide source toolbar geometry");
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page);
  let reads = 0;
  const long = Array.from({ length: 8 }, (_, index) => ({
    ...dashboard.provider_health[index % dashboard.provider_health.length],
    id: "source-layout-" + index,
    name: "供应链商品目录AmazonSourceFeed".repeat(6) + index,
  }));
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({
      json: env({
        ...dashboard,
        provider_health: ++reads === 1 ? dashboard.provider_health : long,
      }),
    }),
  );
  await page.goto("/platform-admin");
  const sources = page.locator(".platform-source-health");
  const tools = sources.locator(".table-view-controls__toolbar");
  const table = sources.locator("table");
  const density = tools.getByRole("combobox", { name: "表格密度", exact: true });
  const read = () =>
    tools.evaluate((node) => {
      const controls = [
        ...node.querySelectorAll("details > summary, button[aria-pressed], label > span, select"),
      ];
      const rect = (item: Element) => {
        const { x, y, width, height } = item.getBoundingClientRect();
        return [x, y, width, height];
      };
      return {
        box: rect(node),
        controls: controls.map(rect),
        gap: getComputedStyle(node).columnGap,
      };
    });
  const headerPadding = () =>
    table
      .locator("thead th")
      .first()
      .evaluate((node) => {
        const css = getComputedStyle(node);
        return [css.paddingBlockStart, css.paddingBlockEnd];
      });
  await expect(table.locator("tbody tr")).toHaveCount(3);
  const short = await read();
  const standard = await headerPadding();
  const freeze = tools.getByRole("button", { name: "首列已冻结", exact: true });
  await freeze.click();
  await expect(tools.getByRole("button", { name: "首列未冻结", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const unfrozen = await read();
  await density.selectOption("compact");
  await expect(table).toHaveAttribute("data-table-density", "compact");
  const compact = await headerPadding();
  const compactTrack = await read();
  await density.selectOption("standard");
  await page
    .locator(".platform-page-header")
    .getByRole("button", { name: "刷新", exact: true })
    .click();
  await expect(sources.getByText("8 个启用来源 · 异常优先", { exact: true })).toBeVisible();
  await expect(sources.getByRole("region", { name: "来源健康表格", exact: true })).toBeVisible();
  const wrapped = await read();
  console.log(
    "PLATFORM_SOURCE_CONTROL_TRACK",
    JSON.stringify({ short, unfrozen, standard, compact, compactTrack, wrapped, reads }),
  );
  expect(short.controls.map((box) => box[3])).toEqual([35, 35, 35, 35]);
  expect(short.gap).toBe("9px");
  expect(unfrozen).toEqual(short);
  expect(compactTrack).toEqual(short);
  expect(wrapped).toEqual(short);
  expect(standard).toEqual(["7px", "9px"]);
  expect(compact).toEqual(["6px", "6px"]);
  expect(reads).toBe(2);
});

test("wide source health keeps the preview in the first fold without dropping records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page);
  const longName = "AmazonSellerCatalogueSource".repeat(4);
  const names = [
    "1688 搜索",
    "Amazon 美国畅销榜",
    "Ars Technica",
    "BBC Business",
    "BigCommerce 电商资讯",
    "DHgate 批发供应商搜索",
    longName,
    "来源 8",
    "来源 9",
  ];
  const health = names.map((name, index) => ({
    ...dashboard.provider_health[2],
    id: `wide-provider-${index}`,
    code: `wide_provider_${index}`,
    name,
  }));
  await page.route("**/api/v1/platform/dashboard?**", (r) =>
    r.fulfill({
      json: env({
        ...dashboard,
        provider_health: health,
        summary: { ...dashboard.summary, enabled_providers: health.length },
      }),
    }),
  );
  await page.goto("/platform-admin");
  const sources = page.locator(".platform-source-health");
  const content = sources.locator(".table-view-controls__content");
  await expect(content.locator("tbody tr")).toHaveCount(8);
  await expect(content.getByText(longName, { exact: true })).toHaveCount(1);
  expect(await content.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await expect(content.getByRole("columnheader", { name: "最近观测" })).toBeInViewport({
    ratio: 1,
  });
  expect(
    (await sources.boundingBox())!.y + (await sources.boundingBox())!.height,
  ).toBeLessThanOrEqual(941);
  expect(await content.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(sources.getByRole("region", { name: "来源健康表格" })).toBeVisible();
  await expect(content.locator("thead th").first()).toHaveCSS("position", "sticky");
  const disclosure = sources.getByRole("button", { name: /查看全部 9 个来源/ });
  await expect(disclosure).toBeInViewport({ ratio: 1 });
  await expect(disclosure).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(disclosure).toHaveCSS("text-align", "end");
  await expect(disclosure).toHaveCSS("min-block-size", "36px");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  expect((await disclosure.boundingBox())!.width).toBeCloseTo(
    (await content.boundingBox())!.width,
    0,
  );
  const preview = await content.evaluate((el) => {
    const rows = el.querySelectorAll("tbody tr");
    const top = el.getBoundingClientRect().top + el.clientTop;
    return {
      sixthBottom: rows[5]!.getBoundingClientRect().bottom - top,
      visibleBottom: el.clientHeight,
    };
  });
  expect(preview.sixthBottom).toBeLessThanOrEqual(preview.visibleBottom + 0.5);
  await content.focus();
  await expect(content).toBeFocused();
  await content.press("End");
  await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await expect(disclosure).toHaveCSS("outline-offset", "-2px");
  await disclosure.press("Enter");
  await expect(content.locator("tbody tr")).toHaveCount(9);
  await expect(content.getByText("来源 9", { exact: true })).toBeVisible();
  const collapse = sources.getByRole("button", { name: /收起来源/ });
  await expect(collapse).toBeFocused();
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await collapse.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(content.locator("tbody tr")).toHaveCount(8);
});

test("wide source health columns keep their position when native scrolling changes", async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop native scroll gutter");
  const nativeBrowser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    const page = await nativeBrowser.newPage({ baseURL, viewport: { width: 1672, height: 941 } });
    await nav(page);
    const providerHealth = Array.from({ length: 12 }, (_, i) => ({
      ...dashboard.provider_health[2],
      id: `stable-source-${i}`,
      code: `stable_source_${i}`,
      name: `来源 ${i + 1}`,
    }));
    await page.route("**/api/v1/platform/dashboard?**", (r) =>
      r.fulfill({
        json: env({ ...dashboard, provider_health: providerHealth }),
      }),
    );
    await page.goto("/platform-admin");
    await expect(page.locator(".role-shell")).toHaveAttribute("data-native-scrollbar", "true");
    const section = page.locator(".platform-source-health");
    const content = section.locator(".table-view-controls__content");
    const rows = content.locator("tbody tr");
    const measure = () =>
      content.evaluate((node) => {
        const { left } = node.getBoundingClientRect();
        return {
          scrollable: node.scrollHeight > node.clientHeight,
          usableWidth: node.clientWidth,
          columns: [...node.querySelectorAll("thead th")].map(
            (cell) => Math.round((cell.getBoundingClientRect().left - left) * 100) / 100,
          ),
        };
      });
    await expect(rows).toHaveCount(8);
    const preview = await measure();
    expect(preview.scrollable).toBe(true);
    await section.getByRole("button", { name: /查看全部 12 个来源/ }).click();
    await expect(rows).toHaveCount(12);
    const expanded = await measure();
    expect(expanded.scrollable).toBe(true);
    console.log("platform native source columns", JSON.stringify({ preview, expanded }));
    expect(expanded.usableWidth).toBe(preview.usableWidth);
    expect(expanded.columns).toEqual(preview.columns);
    await section.getByRole("button", { name: /收起来源/ }).click();
    await expect(rows).toHaveCount(8);
    expect(await measure()).toEqual(preview);
  } finally {
    await nativeBrowser.close();
  }
});

test("M06-02.A08/A16 empty forbidden and dependency states recover truthfully", async ({
  page,
}) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/dashboard?**", (r) =>
    r.fulfill(
      status === 200
        ? {
            json: env({
              ...dashboard,
              summary: {
                active_organizations: 0,
                active_users: 0,
                enabled_providers: 0,
                task_success_rate: null,
                queue_backlog: 0,
                open_alerts: 0,
                storage_bytes: 0,
                file_growth_bytes: 0,
              },
              queues: [],
              provider_health: [],
              task_trend: [],
              health_signals: [],
              alerts: [],
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: status === 403 ? "permission_denied" : "dependency_unavailable",
                message: "failed",
                action_hint: "按状态恢复",
              },
              request_id: `m06-02-${status}`,
              trace_id: `m06-02-${status}`,
            }),
          },
    ),
  );
  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "平台还没有可展示的业务事实" })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "当前账号不能进入平台管理后台" })).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "管理首页暂时无法读取数据" })).toBeVisible();
});

test("platform window persists and failed refresh keeps the last factual snapshot", async ({
  page,
}) => {
  await nav(page);
  let failRefresh = false;
  const logicalReads = new Set<string>();
  await page.route("**/api/v1/platform/dashboard?**", async (route) => {
    logicalReads.add(route.request().headers()["x-request-id"] ?? "missing");
    if (failRefresh) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "dependency_unavailable",
            message: "数据库暂不可用",
            action_hint: "检查测试数据库。",
          },
          request_id: "m06-02-refresh-failed",
          trace_id: "m06-02-refresh-failed",
        }),
      });
      return;
    }
    await route.fulfill({ json: env(dashboard) });
  });

  await page.goto("/platform-admin");
  await page.getByRole("combobox", { name: "查看范围" }).selectOption("7d");
  await expect(page).toHaveURL(/window=7d/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "查看范围" })).toHaveValue("7d");

  const readsBeforeFailure = logicalReads.size;
  failRefresh = true;
  await page.getByRole("button", { name: "刷新" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole("alert")).toContainText("继续显示上一份观测结果");
  await expect(page.getByRole("region", { name: "平台指标" })).toContainText("活跃组织42");
  expect(logicalReads.size).toBe(readsBeforeFailure + 1);
});

test("platform dashboard reports a bounded timeout instead of waiting forever", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser proves the 12s timeout.");
  await nav(page);
  await page.route("**/api/v1/platform/dashboard?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 13_000));
    await route.abort("timedout");
  });

  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "管理首页暂时无法读取数据" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("请求超过 12 秒，请检查 API 与数据库状态。")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新读取" })).toBeVisible();
});

test("platform completion renders trend and management without overflow or console errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await nav(page);
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({
      json: env({
        ...dashboard,
        task_trend: [
          { bucket: "2026-08-08T10:00:00.000Z", succeeded: 8, failed: 2 },
          { bucket: "2026-08-08T11:00:00.000Z", succeeded: 14, failed: 1 },
          { bucket: "2026-08-08T12:00:00.000Z", succeeded: 21, failed: 0 },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: env({
        domain: "content",
        summary: { total: 135, active: 90, irrelevant: 25, stale: 19, archived: 1 },
        items: [
          {
            id: "00000000-0000-4000-8000-000000000701",
            title: "便携式照明热度上升",
            category: "home",
            market: "US",
            language: "en-US",
            status: "active",
            signal_count: 18,
            source_count: 5,
            heat_value: 82,
            confidence_status: "measured",
            version: 1,
            last_seen_at: "2026-08-08T12:00:00.000Z",
            organization_name: "米豆选品",
            workspace_name: "默认工作区",
          },
        ],
        pagination: { page: 1, page_size: 20, total: 135, total_pages: 7 },
        observed_at: "2026-08-08T12:00:00.000Z",
      }),
    }),
  );
  await page.goto("/platform-admin");
  await expect(page.getByLabel(/采集任务成功和失败趋势折线图：成功 43，失败 3/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.goto("/platform-admin/content");
  await expect(page.getByRole("heading", { name: "内容管理", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "内容分页" })).toContainText("共 135 条");
  await page.getByRole("button", { name: "筛选内容管理" }).click();
  const initialContentFilters = page.getByRole("dialog", { name: "筛选内容管理" });
  await expect(
    initialContentFilters.getByLabel("内容状态").getByRole("option", { name: "已归档" }),
  ).toHaveCount(1);
  await initialContentFilters.getByRole("button", { name: "关闭筛选条件" }).click();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /便携式照明热度上升.*查看详情/ }).click();
    await page
      .getByRole("dialog", { name: "便携式照明热度上升" })
      .getByRole("button", { name: "标记无关" })
      .click();
  } else {
    await expect(page.getByRole("table").getByText("便携式照明热度上升")).toBeVisible();
    await page.getByTitle("标记为无关").click();
  }
  await expect(page.getByRole("heading", { name: "审核热点内容" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "内容管理", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "筛选内容管理" }).click();
  const contentFilters = page.getByRole("dialog", { name: "筛选内容管理" });
  await contentFilters.getByPlaceholder("搜索主题、分类或市场").fill("照明");
  await contentFilters.getByLabel("内容状态").selectOption("active");
  await contentFilters.getByRole("button", { name: "关闭筛选条件" }).click();
  await page.getByRole("button", { name: /筛选内容管理.*2 项已选/ }).click();
  await expect(contentFilters.getByPlaceholder("搜索主题、分类或市场")).toHaveValue("照明");
  await expect(contentFilters.getByLabel("内容状态")).toHaveValue("active");
  await contentFilters.getByRole("button", { name: "关闭筛选条件" }).click();
  await page.getByRole("button", { name: /便携式照明热度上升.*查看详情/ }).click();
  const contentDetail = page.getByRole("dialog", { name: "便携式照明热度上升" });
  await expect(contentDetail.getByText("00000000-0000-4000-8000-000000000701")).not.toBeVisible();
  await contentDetail.getByText("技术详情").click();
  await expect(contentDetail.getByText("00000000-0000-4000-8000-000000000701")).toBeVisible();
  await contentDetail.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: /便携式照明热度上升.*查看详情/ }).click();
  await page
    .getByRole("dialog", { name: "便携式照明热度上升" })
    .getByRole("button", { name: "标记无关" })
    .click();
  await expect(page.getByRole("heading", { name: "审核热点内容" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if (testInfo.project.name === "mobile-390") expect(errors).toEqual([]);
});

test("platform completion exposes data governance notifications and user-panel switch", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) => {
    const url = new URL(route.request().url()),
      domain = url.searchParams.get("domain"),
      governanceSection = url.searchParams.get("section") ?? "score_rules";
    const data =
      domain === "data"
        ? {
            domain,
            summary: { total: 1, active: 1 },
            items: [
              {
                id: "trend-1",
                title: "便携照明趋势",
                organization_name: "米豆选品",
                workspace_name: "默认工作区",
                category: "home",
                market: "US",
                status: "active",
                metric_primary: 18,
                metric_secondary: 5,
                updated_at: "2026-08-18T12:00:00.000Z",
              },
            ],
            observed_at: "2026-08-18T12:00:00.000Z",
          }
        : domain === "governance"
          ? {
              domain,
              section: governanceSection,
              summary: {
                score_rules: 1,
                cost_rules: 0,
                approval_templates: 0,
                automation_rules: 1,
                releases: 0,
                provider_versions: 2,
              },
              items:
                governanceSection === "automation_rules"
                  ? [
                      {
                        id: "auto-1",
                        name: "竞品降价提醒",
                        trigger_event_type: "competitor.changed",
                        status: "active",
                        version: 1,
                        updated_at: "2026-08-18T12:00:00.000Z",
                      },
                    ]
                  : [
                      {
                        id: "rule-1",
                        name: "标准评分规则",
                        version_code: "score-v1",
                        organization_name: "米豆选品",
                        workspace_name: "默认工作区",
                        status: "active",
                        revision: 1,
                        updated_at: "2026-08-18T12:00:00.000Z",
                      },
                    ],
              pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
              provider_versions_latest_at: "2026-08-18T12:00:00.000Z",
              observed_at: "2026-08-18T12:00:00.000Z",
            }
          : {
              domain: "notifications",
              summary: { total: 1, unread: 1, critical: 0 },
              messages: [],
              templates: [
                {
                  category: "task",
                  title: "任务状态通知",
                  event_pattern: "task.*",
                  status: "active",
                },
              ],
              channels: [
                {
                  code: "in_app",
                  name: "站内通知",
                  status: "enabled",
                  deliveries: [{ status: "delivered", total: 1 }],
                },
              ],
              subscriptions: { in_app: 3, email: 0, disabled: 0 },
              alert_routes: [
                {
                  id: "route-1",
                  name: "竞品变更提醒",
                  event_type: "competitor.changed",
                  action_type: "notify",
                  status: "enabled",
                },
              ],
              items: [
                {
                  id: "notice-1",
                  title: "采集任务完成",
                  recipient_email: "member@example.test",
                  organization_name: "米豆选品",
                  category: "task",
                  severity: "info",
                  read_at: null,
                  delivery_status: "in_app:delivered",
                  created_at: "2026-08-18T12:00:00.000Z",
                },
              ],
              observed_at: "2026-08-18T12:00:00.000Z",
            };
    return route.fulfill({ json: env(data) });
  });

  await page.goto("/platform-admin/data");
  await expect(page.getByRole("heading", { name: "数据中心", level: 2 })).toBeVisible();
  const exportTrigger = page.getByRole("button", { name: "导出表格文件", exact: true });
  const exportFilter = page.getByRole("dialog", { name: "筛选近期数据" });
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await page.getByRole("button", { name: "筛选近期数据", exact: true }).click();
  await exportTrigger.click();
  const exportReason = page.getByRole("dialog", { name: "填写受控导出原因" });
  await verifyAuditedReasonFocus(page, exportReason);
  await exportReason.getByRole("button", { name: "取消", exact: true }).click();
  await expect(exportReason).toBeHidden();
  await expect(exportTrigger).toBeFocused();
  if (await exportFilter.isVisible())
    await exportFilter.getByRole("button", { name: "关闭筛选条件" }).click();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /^便携照明趋势 · 展示中/ })).toBeVisible();
  else await expect(page.getByText("便携照明趋势", { exact: true })).toBeVisible();
  await expect(page.getByText("trend-1", { exact: true })).not.toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await page.getByRole("button", { name: "打开导航菜单" }).click();
  await expect(
    page.getByRole("link", { name: "选择组织与工作区后进入用户工作台" }),
  ).toHaveAttribute("href", /\/select-context\?return_to=%2Fhome/);
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await page.getByRole("button", { name: "关闭导航菜单" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: "筛选近期数据" }).click();
    const dataFilters = page.getByRole("dialog", { name: "筛选近期数据" });
    await dataFilters.getByPlaceholder("搜索名称、组织或工作区").fill("便携");
    await dataFilters.getByLabel("记录状态").selectOption("active");
    await dataFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /筛选近期数据.*2 项已选/ }).click();
    await expect(dataFilters.getByPlaceholder("搜索名称、组织或工作区")).toHaveValue("便携");
    await expect(dataFilters.getByLabel("记录状态")).toHaveValue("active");
    await dataFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /^便携照明趋势 · 展示中/ }).click();
    const dataDialog = page.getByRole("dialog", { name: "便携照明趋势" });
    await dataDialog.getByText("技术详情").click();
    await expect(dataDialog.getByText("trend-1", { exact: true })).toBeVisible();
    await dataDialog.getByRole("button", { name: "关闭详情" }).click();
  }

  await page.goto("/platform-admin/governance");
  await expect(page.getByRole("heading", { name: "规则、工作流与自动化", level: 1 })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /^标准评分规则 · 启用/ })).toBeVisible();
  else await expect(page.getByText("标准评分规则", { exact: true })).toBeVisible();
  await expect(page.getByText("score-v1", { exact: true })).not.toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: "筛选治理记录" }).click();
    const governanceFilters = page.getByRole("dialog", { name: "筛选治理记录" });
    await governanceFilters.getByPlaceholder("搜索规则、版本、组织或工作区").fill("标准");
    await governanceFilters.getByLabel("治理状态").selectOption("active");
    await governanceFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /筛选治理记录.*2 项已选/ }).click();
    await expect(governanceFilters.getByPlaceholder("搜索规则、版本、组织或工作区")).toHaveValue(
      "标准",
    );
    await expect(governanceFilters.getByLabel("治理状态")).toHaveValue("active");
    await governanceFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /^标准评分规则 · 启用/ }).click();
    const governanceDialog = page.getByRole("dialog", { name: "标准评分规则" });
    await governanceDialog.getByText("技术详情").click();
    await expect(governanceDialog.getByText("rule-1", { exact: true })).toBeVisible();
    await governanceDialog.getByRole("button", { name: "关闭详情" }).click();
  }
  await page.getByRole("button", { name: "自动化规则" }).click();
  await expect(page).toHaveURL(/section=automation_rules/);
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /^竞品降价提醒 · 启用/ })).toBeVisible();
  else await expect(page.getByText("竞品降价提醒", { exact: true })).toBeVisible();
  await expect(page.getByText("active", { exact: true })).toHaveCount(0);

  await page.goto("/platform-admin/notifications");
  await expect(page.getByRole("heading", { name: "通知管理", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /系统事实/ }).click();
  await expect(page.getByText("任务状态通知")).toBeVisible();
  await page.getByRole("button", { name: /投递观测/ }).click();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /采集任务完成.*查看详情/ })).toBeVisible();
  else await expect(page.getByRole("table").getByText("member@example.test")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "通知管理", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /系统事实/ }).click();
  await expect(page.getByText("站内通知 · 启用", { exact: true })).toBeVisible();
  await expect(page.getByText("启用站内通知", { exact: true })).toBeVisible();
  await expect(page.getByText("启用邮件", { exact: true })).toBeVisible();
  await expect(page.getByText("停用全部通知", { exact: true })).toBeVisible();
  await expect(page.getByText("in_app", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /投递观测/ }).click();
  await page.getByRole("button", { name: "筛选投递记录" }).click();
  const notificationFilters = page.getByRole("dialog", { name: "筛选投递记录" });
  await notificationFilters.getByLabel("搜索投递记录").fill("采集");
  await notificationFilters.getByLabel("通知类型").selectOption("task");
  await notificationFilters.getByRole("button", { name: "关闭筛选条件" }).click();
  await page.getByRole("button", { name: /筛选投递记录.*2 项已选/ }).click();
  await expect(notificationFilters.getByLabel("搜索投递记录")).toHaveValue("采集");
  await expect(notificationFilters.getByLabel("通知类型")).toHaveValue("task");
  await notificationFilters.getByRole("button", { name: "关闭筛选条件" }).click();
  await page.getByRole("button", { name: /采集任务完成.*查看详情/ }).click();
  const notificationDetail = page.getByRole("dialog", { name: "采集任务完成" });
  await expect(notificationDetail.getByText("站内通知：已送达")).toBeVisible();
  await expect(notificationDetail.getByText("notice-1", { exact: true })).not.toBeVisible();
  await notificationDetail.getByText("技术详情").click();
  await expect(notificationDetail.getByText("notice-1", { exact: true })).toBeVisible();
  await expect(notificationDetail.getByText("in_app:delivered", { exact: true })).toBeVisible();
  await notificationDetail.getByRole("button", { name: "关闭详情" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if (testInfo.project.name === "mobile-390") expect(errors).toEqual([]);
});

test("system status aggregates real operations observations and management links", async ({
  page,
}, testInfo) => {
  let statusReads = 0;
  await nav(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "scoutops:realtime-client-metrics",
      JSON.stringify({
        session_started_at: "2026-08-18T11:30:00.000Z",
        connection_open_count: 8,
        reconnect_count: 2,
        fallback_poll_count: 2,
        last_open_at: "2026-08-18T11:59:30.000Z",
        last_reconnect_at: "2026-08-18T11:59:00.000Z",
        last_fallback_poll_at: "2026-08-18T11:59:01.000Z",
        reconnecting: false,
      }),
    ),
  );
  await page.route("**/api/v1/platform/management?**", (route) => {
    return route.fulfill({
      json: env({
        domain: "status",
        summary: {
          api: "ready",
          database: "healthy",
          dashboard_reads: 5,
          active_organizations: 2,
          active_users: 8,
        },
        services: [
          {
            code: "api",
            name: "Node API",
            status: "ready",
            detail: "0.1.0 · abcdef123456",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/topology",
          },
          {
            code: "mysql",
            name: "MySQL",
            status: "healthy",
            detail: "最近一次韧性检查",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/mysql",
          },
          {
            code: "redis",
            name: "Redis",
            status: "warning",
            detail: "最近一次韧性检查",
            observed_at: "2026-08-18T11:59:00.000Z",
            href: "/platform-admin/redis",
          },
          {
            code: "files",
            name: "文件存储",
            status: "stale",
            detail: "最近一次存储检查",
            observed_at: "2026-08-18T10:00:00.000Z",
            href: "/platform-admin/files",
          },
          {
            code: "worker",
            name: "Node Worker",
            status: "ready",
            detail: "1 个实例 · 1 个活动任务",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/crawler-scheduler",
          },
          {
            code: "crawler",
            name: "Python Crawler",
            status: "ready",
            detail: "1 个实例 · 0 个活动运行",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/crawler-scheduler",
          },
        ],
        collections: [{ status: "running", total: 1 }],
        sources: [{ status: "enabled", total: 138 }],
        observed_at: "2026-08-18T12:00:00.000Z",
      }),
    });
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      request.method() === "GET" &&
      url.pathname.endsWith("/api/v1/platform/management") &&
      url.searchParams.get("domain") === "status"
    )
      statusReads += 1;
  });
  await page.goto("/platform-admin/status");
  await expect(
    page
      .locator(".platform-management--status-c .platform-page-header")
      .getByRole("heading", { name: "系统状态", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".role-page-title")).toHaveCount(0);
  const statusScope = page.getByRole("region", { name: "运行观测范围" });
  const scopeBox = await statusScope.boundingBox(),
    panelBox = await page.locator(".p61-panel:visible").boundingBox();
  expect(scopeBox && panelBox && scopeBox.y + scopeBox.height <= panelBox.y).toBeTruthy();
  expect(Math.abs(scopeBox!.width - panelBox!.width)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const sectionGroup = page.getByRole("group", { name: "系统状态分区" });
  await expect(sectionGroup.getByRole("button")).toHaveCount(4);
  await expect(sectionGroup.locator('[data-status-view="attention"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('[data-status-view="dependencies"]').click();
  await expect(sectionGroup.locator('[data-status-view="dependencies"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "依赖关系与最新观测", level: 3 })).toBeVisible();
  await expect(page.getByText("访问入口", { exact: true })).toBeVisible();
  await expect(page.getByText("共享依赖", { exact: true })).toBeVisible();
  await expect(page.getByText("异步执行", { exact: true })).toBeVisible();
  await expect(page.getByText("Python Crawler", { exact: true })).toBeVisible();
  await expect(page.getByText("1 个实例 · 1 个活动任务")).toBeVisible();
  expect(statusReads).toBe(1);
  await page.locator('[data-status-view="attention"]').click();
  const propagation = page.locator(".platform-propagation");
  await expect(propagation.getByText("Redis当前警告", { exact: true })).toBeVisible();
  await expect(propagation.getByText("文件存储当前已过期", { exact: true })).toBeVisible();
  await expect(propagation).toContainText("API 就绪、队列协调、限流与实时通知");
  await expect(propagation).toContainText("证据保存、报表导出与采集回执暂存");
  await page.locator('[data-status-view="session"]').click();
  const realtime = page.getByRole("region", { name: "实时连接退化统计" });
  await expect(realtime.getByText("SSE 重连率", { exact: true })).toBeVisible();
  await expect(realtime.getByText("20.00%", { exact: true })).toBeVisible();
  await expect(realtime.getByText("降级轮询次数", { exact: true })).toBeVisible();
  await expect(realtime.getByText("2", { exact: true })).toBeVisible();
  await expect(realtime).toContainText("仅统计当前浏览器标签页会话");
  expect(statusReads).toBe(1);
  await expect(
    page.locator(".platform-topology-node").filter({ hasText: /^Redis/ }),
  ).toHaveAttribute("href", "/platform-admin/redis");
  await page.locator('[data-status-view="attention"]').click();
  await capturePhase2Evidence(page, testInfo, "P61", "dependency-degraded", [
    "redis-warning",
    "files-stale",
    "propagation-visible",
    "session-metrics-not-global",
  ]);
  const failRefresh = (route: Route) => route.abort("failed");
  await page.route("**/api/v1/platform/management?**", failRefresh);
  await page.getByRole("button", { name: "刷新数据", exact: true }).click();
  await expect(page.locator(".platform-management-message")).toContainText("已保留上次成功数据");
  expect(statusReads).toBe(4);
  await page.locator('[data-status-view="activity"]').click();
  const activityPanel = page.locator("#p61-panel-activity");
  await expect(activityPanel.getByRole("heading", { name: "采集任务状态" })).toBeVisible();
  await expect(activityPanel.getByText("运行中", { exact: true })).toBeVisible();
  await expect(activityPanel.getByText("138", { exact: true })).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P61", "refresh-failed-retained", [
    "expected-transport-abort",
    "last-success-data-retained",
    "failure-message-visible",
  ]);
  await page.unroute("**/api/v1/platform/management?**", failRefresh);
  await page.getByRole("button", { name: "刷新数据", exact: true }).click();
  await expect(page.locator(".platform-management-message")).toHaveCount(0);
  expect(statusReads).toBe(5);
  await expect(page.getByRole("button", { name: "刷新数据", exact: true })).toBeEnabled();
  await capturePhase2Evidence(page, testInfo, "P61", "refresh-recovered", [
    "refresh-retry-succeeds",
    "failure-message-cleared",
    "dependency-warning-still-truthful",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("chain logs group trace events and deep-link exceptional task and source facts", async ({
  page,
}) => {
  await nav(page);
  let exportBody: Record<string, string> | null = null;
  await page.route("**/api/v1/platform/management/logs/exports", async (route) => {
    exportBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      headers: {
        "content-disposition": 'attachment; filename="platform-logs.csv"',
        "x-request-id": "request-log-export",
      },
      body: "\ufeffoccurred_at,trace_id,source\r\n2026-08-18T12:00:02.000Z,trace-shared,crawler",
    });
  });
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: env({
        domain: "logs",
        summary: { total: 3, api: 1, worker: 1, crawler: 1 },
        items: [
          {
            id: "crawler-event",
            source: "crawler",
            event_type: "crawler.run.failed",
            resource_type: "crawler_run",
            resource_id: "00000000-0000-4000-8000-000000000613",
            status: "failed",
            error_code: "blocked_login",
            request_id: "request-crawler",
            trace_id: "trace-shared",
            occurred_at: "2026-08-18T12:00:02.000Z",
            task_id: "00000000-0000-4000-8000-000000000611",
            provider_id: "00000000-0000-4000-8000-000000000612",
            provider_name: "1688 网页采集",
          },
          {
            id: "api-event",
            source: "api",
            event_type: "collection.task.read",
            resource_type: "collection_task",
            resource_id: "00000000-0000-4000-8000-000000000611",
            status: "succeeded",
            error_code: null,
            request_id: "request-api",
            trace_id: "trace-shared",
            occurred_at: "2026-08-18T12:00:01.000Z",
            task_id: null,
            provider_id: null,
            provider_name: null,
          },
          {
            id: "worker-event",
            source: "worker",
            event_type: "collection.task.failed",
            resource_type: "collection_task",
            resource_id: "00000000-0000-4000-8000-000000000614",
            status: "failed_terminal",
            error_code: "parser_failed",
            request_id: "request-worker",
            trace_id: "trace-worker",
            occurred_at: "2026-08-18T11:59:00.000Z",
            task_id: "00000000-0000-4000-8000-000000000614",
            provider_id: null,
            provider_name: null,
          },
        ],
        observed_at: "2026-08-18T12:00:03.000Z",
      }),
    }),
  );
  await page.goto("/platform-admin/logs");
  await expect(page.getByText("调用链 2 条", { exact: true })).toBeVisible();
  const directoryBox = await page.getByRole("region", { name: "调用链目录" }).boundingBox();
  const eventBox = await page.locator(".p62-events:visible").boundingBox();
  expect(
    directoryBox && eventBox && directoryBox.y + directoryBox.height <= eventBox.y,
  ).toBeTruthy();
  expect(Math.abs(directoryBox!.width - eventBox!.width)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const sharedChain = page.locator(".platform-log-chain").filter({ hasText: "trace-shared" });
  await expect(sharedChain).toContainText("2 个事件 · 1 个异常");
  const workerChain = page.locator(".platform-log-chain").filter({ hasText: "trace-worker" });
  await expect(sharedChain).toBeVisible();
  await expect(workerChain).toBeHidden();
  if ((page.viewportSize()?.width ?? 1280) <= 760) {
    const sharedEvents = sharedChain.locator(".responsive-data-view__mobile article > button");
    await expect(sharedEvents.first()).toContainText("collection.task.read");
    await expect(sharedEvents.last()).toContainText("crawler.run.failed");
    await sharedEvents.last().click();
    const crawlerDetail = page.getByRole("dialog", { name: "爬虫 · crawler.run.failed" });
    await expect(crawlerDetail.getByRole("link", { name: "查看关联任务" })).toHaveAttribute(
      "href",
      /\/platform-admin\/collection\?task=/,
    );
    await expect(crawlerDetail.getByRole("link", { name: "查看关联来源" })).toHaveAttribute(
      "href",
      /\/platform-admin\/providers\/sources\?provider_id=/,
    );
    await crawlerDetail.getByRole("button", { name: "关闭详情" }).click();
    await page.locator('[data-log-chain="trace-worker"]').click();
    await expect(workerChain).toBeVisible();
    await workerChain.locator(".responsive-data-view__mobile article > button").click();
    const workerDetail = page.getByRole("dialog", { name: "Worker · collection.task.failed" });
    await expect(workerDetail.getByRole("link", { name: "查看关联任务" })).toBeVisible();
    await expect(workerDetail.getByRole("link", { name: "查看关联来源" })).toHaveCount(0);
    await workerDetail.getByRole("button", { name: "关闭详情" }).click();
  } else {
    await expect(sharedChain.locator("tbody tr").first()).toContainText("collection.task.read");
    await expect(sharedChain.locator("tbody tr").last()).toContainText("crawler.run.failed");
    await expect(sharedChain.getByRole("link", { name: "查看关联任务" })).toHaveAttribute(
      "href",
      /\/platform-admin\/collection\?task=/,
    );
    await expect(sharedChain.getByRole("link", { name: "查看关联来源" })).toHaveAttribute(
      "href",
      /\/platform-admin\/providers\/sources\?provider_id=/,
    );
    await page.locator('[data-log-chain="trace-worker"]').click();
    await expect(workerChain).toBeVisible();
    await expect(workerChain.getByRole("link", { name: "查看关联任务" })).toBeVisible();
    await expect(workerChain.getByRole("link", { name: "查看关联来源" })).toHaveCount(0);
  }
  await page.locator('[data-log-chain="trace-shared"]').click();
  const logQuery = page.getByPlaceholder("请求编号、链路编号、任务、事件或错误码");
  if (!(await logQuery.isVisible())) {
    await page.getByRole("button", { name: "筛选链路日志" }).click();
  }
  await expect(logQuery).toHaveCSS("min-height", "44px");
  expect(await logQuery.evaluate((el) => getComputedStyle(el.closest("form")!).display)).toBe(
    "grid",
  );
  await logQuery.fill("trace-shared");
  await page.getByLabel("运行面").selectOption("crawler");
  const mobileFilter = page.getByRole("dialog", { name: "筛选链路日志" });
  if (await mobileFilter.isVisible()) {
    await mobileFilter.getByRole("button", { name: "检索" }).click();
  } else await page.getByRole("button", { name: "检索" }).click();
  await page.getByRole("button", { name: "导出当前筛选" }).click();
  const dialog = page.getByRole("dialog", { name: "填写日志导出原因" });
  await expect(dialog).toBeVisible();
  await verifyAuditedReasonFocus(page, dialog);
  const reason = dialog.getByRole("textbox", { name: /原因/ });
  await reason.fill("x");
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAttribute("aria-describedby", /audited-reason-validation-error/);
  await expect(dialog.getByRole("alert")).toHaveText("请至少填写 2 个字的原因。");
  await expect(dialog.getByRole("button", { name: "确认提交" })).toBeDisabled();
  expect(exportBody).toBeNull();
  await reason.fill("导出当前链路日志用于故障排查");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await download;
  expect(exportBody).toEqual({
    query: "trace-shared",
    source: "crawler",
    reason: "导出当前链路日志用于故障排查",
  });
  await expect(page.getByText("当前筛选日志已导出", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("chain directory keeps two hundred returned traces bounded and keyboard reachable", async ({
  page,
}) => {
  await nav(page);
  const { logReviewFixtures } = await import("../../scripts/lib/log-review-fixtures.mjs");
  const { fixture } = await logReviewFixtures();
  const items = Array.from({ length: 200 }, (_, index) => ({
    ...fixture.items[0],
    id: `volume-${index}`,
    trace_id: `trace-volume-${String(index).padStart(3, "0")}`,
  }));
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({ json: env({ ...fixture, items }) }),
  );
  await page.goto("/platform-admin/logs");
  const directory = page.getByRole("navigation", { name: "选择日志调用链" });
  const buttons = directory.getByRole("button");
  await expect(buttons).toHaveCount(200);
  const bounds = await directory.evaluate((el) => ({
    height: el.clientHeight,
    content: el.scrollHeight,
  }));
  expect(bounds.height).toBeLessThanOrEqual(270);
  expect(bounds.content).toBeGreaterThan(bounds.height);
  const last = buttons.last();
  await last.focus();
  await last.press("Enter");
  await expect(last).toHaveAttribute("aria-pressed", "true");
  const target = await last.getAttribute("aria-controls");
  await expect(page.locator(`#${target}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("wide source health full timestamp wraps only when its column needs it", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop source health columns");
  const observedAt = "2026-12-28T11:50:00.000Z";
  await page.setViewportSize({ width: 1641, height: 941 });
  await nav(page);
  await page.route("**/api/v1/platform/dashboard?**", (r) =>
    r.fulfill({
      json: env({
        ...dashboard,
        provider_health: dashboard.provider_health.map((source) => ({
          ...source,
          last_observed_at: observedAt,
        })),
      }),
    }),
  );
  await page.goto("/platform-admin");
  const timestamp = page.locator(".platform-source-health tbody tr:first-child td:last-child");
  const expected = await page.evaluate(
    (date) => new Date(date).toLocaleString("zh-CN", { hour12: false }),
    observedAt,
  );
  await expect(timestamp).toHaveText(expected);
  for (const width of [1440, 1536, 1600, 1640, 1641, 1672, 1858]) {
    await page.setViewportSize({ width, height: 941 });
    const metrics = await timestamp.evaluate((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const bounds = cell.getBoundingClientRect();
      const style = getComputedStyle(cell);
      const start = bounds.left + parseFloat(style.paddingInlineStart);
      const end = bounds.right - parseFloat(style.paddingInlineEnd);
      const lines = [...range.getClientRects()];
      return {
        lines: lines.length,
        overflow: Math.max(...lines.map((part) => Math.max(start - part.left, part.right - end))),
      };
    });
    expect(
      metrics.overflow,
      `width ${width}: timestamp crosses its cell padding`,
    ).toBeLessThanOrEqual(1);
    if (width === 1641 || width === 1672) expect(metrics.lines).toBe(2);
    if (width === 1858) expect(metrics.lines).toBe(1);
  }
});

test("wide system check values wrap without covering neighboring signals", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide system-check tracks");
  await page.setViewportSize({ width: 1672, height: 941 });
  await nav(page);
  const diagnostic = "diagnostic-" + "uninterrupted".repeat(16);
  const health_signals = dashboard.health_signals.map((signal, index) =>
    index === 1 ? { ...signal, value: diagnostic, status: "warning" } : signal,
  );
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({ json: env({ ...dashboard, health_signals }) }),
  );
  await page.goto("/platform-admin");
  const rows = page.locator(".platform-system-checks .platform-signals > li");
  await expect(rows).toHaveCount(health_signals.length);
  const row = rows.nth(1);
  await expect(row.locator("strong")).toHaveText(diagnostic);
  const reading = await page.evaluate(() => {
    const label = document.querySelector(".platform-system-checks .platform-signals > li > span")!;
    const tally = document.querySelector(".platform-source-health > header > span")!;
    const labelStyle = getComputedStyle(label);
    const sourceStyle = getComputedStyle(tally);
    return { checkLabel: labelStyle.fontSize, sourceTally: sourceStyle.fontSize };
  });
  console.log("PLATFORM_WIDE_READING", JSON.stringify(reading));
  expect(reading).toEqual({ checkLabel: "16px", sourceTally: "15px" });
  const result = await row.evaluate((item) => {
    const bounds = item.getBoundingClientRect();
    const label = item.querySelector("span")!.getBoundingClientRect();
    const value = item.querySelector("strong")!;
    const valueRect = value.getBoundingClientRect();
    const content = document.createRange();
    content.selectNodeContents(value);
    const lines = [...content.getClientRects()];
    return {
      labelWidth: label.width,
      fraction: valueRect.width / bounds.width,
      inside: lines.every(
        ({ left, right, top, bottom }) =>
          left >= label.right &&
          right <= bounds.right &&
          top >= bounds.top &&
          bottom <= bounds.bottom,
      ),
      lines: lines.length,
    };
  });
  console.log("SYSTEM_CHECK_TRACKS", JSON.stringify(result));
  expect(result.inside).toBe(true);
  expect(result.labelWidth).toBeGreaterThan(100);
  expect(result.fraction).toBeLessThan(0.38);
  expect(result.lines).toBeGreaterThan(1);
});
