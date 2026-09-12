import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { verifyAuditedReasonFocus } from "./helpers/audited-reason-focus";
import { capturePhase2Evidence, finalizePhase2Evidence } from "./helpers/ui-phase2-evidence";
test.afterEach(async ({}, testInfo) => finalizePhase2Evidence(testInfo));
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
  await expect(detail.getByRole("link", { name: "进入规则编辑" })).toHaveAttribute(
    "href",
    "/automations?rule=auto-55&action=edit",
  );
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
  await expect(page.getByRole("heading", { name: "规则、工作流与自动化", level: 2 })).toBeVisible();
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
  await expect(detail.getByRole("link", { name: "进入规则编辑" })).toHaveAttribute(
    "href",
    "/automations?rule=automation-c-55&action=edit",
  );
  await capturePhase2Evidence(page, testInfo, "P55", "governance-automation-detail", [
    "自动化详情在桌面与手机均展示触发、动作和频控",
    "0 次频控按原始事实显示而不隐藏",
    "编辑入口绑定当前自动化规则 ID",
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

test("API coverage dashboard exposes the current production truth dimensions on desktop and mobile", async ({
  page,
}) => {
  await nav(page, "platform_super_admin", "platform:superadmin");
  await page.route("**/api/v1/platform/management?domain=api_coverage**", (route) =>
    route.fulfill({
      json: env({
        domain: "api_coverage",
        report_status: "current",
        catalog_fingerprint: "a".repeat(64),
        summary: {
          paths: 223,
          operations: 256,
          verified: 256,
          coverage_percent: 100,
          evidence_applicable: 1080,
          evidence_passed: 512,
          evidence_coverage_percent: 47.41,
          ui_consumed: 180,
          crawler_side_effects: 12,
        },
        by_outcome: [{ key: "success", count: 255 }],
        evidence_dimensions: [
          {
            key: "normal",
            applicable: 256,
            passed: 256,
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
            not_applicable: 11,
            coverage_percent: 100,
          },
          {
            key: "parameters",
            applicable: 184,
            passed: 11,
            failed: 0,
            not_run: 173,
            not_applicable: 72,
            coverage_percent: 5.98,
          },
          {
            key: "idempotency",
            applicable: 139,
            passed: 0,
            failed: 0,
            not_run: 139,
            not_applicable: 117,
            coverage_percent: 0,
          },
          {
            key: "fault",
            applicable: 256,
            passed: 0,
            failed: 0,
            not_run: 256,
            not_applicable: 0,
            coverage_percent: 0,
          },
        ],
        by_role: [
          {
            key: "platform_super_admin",
            expected_allowed: 256,
            verified: 256,
            success: 256,
            empty: 0,
            blocked: 0,
            unauthorized: 0,
          },
        ],
        by_data_source: [{ key: "mysql57_business", count: 256 }],
        by_ui_consumer: [{ key: "/platform-admin/api-coverage", count: 1 }],
        by_crawler_side_effect: [{ key: "none", count: 255 }],
        operations: [
          {
            operation_id: "get_platform_management",
            method: "GET",
            path: "/api/v1/platform/management",
            expected_roles: ["platform_super_admin"],
            verification_role: "platform_super_admin",
            outcome: "success",
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
          },
        ],
        total_filtered: 256,
        captured_at: "2026-08-23T12:00:00.000Z",
        age_seconds: 60,
      }),
    }),
  );
  await page.goto("/platform-admin/api-coverage");
  await expect(page.getByRole("heading", { name: "接口覆盖证据", level: 2 })).toBeVisible();
  for (const heading of [
    "结果覆盖",
    "证据维度",
    "六角色覆盖",
    "数据来源",
    "UI 消费方",
    "爬虫副作用",
  ])
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.getByText("100.00%", { exact: true })).toBeVisible();
  await expect(page.getByText("47.41%", { exact: true })).toBeVisible();
  await expect(page.getByText("get_platform_management", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("/api/v1/platform/management", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test("M06-02.A07/A08/A15 desktop and 390 cockpit use factual states", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/dashboard?**", (r) => r.fulfill({ json: env(dashboard) }));
  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "平台运行概览", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: /等待处理 7/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /需要关注 2/ })).toBeVisible();
  const facts = page.getByRole("region", { name: "平台事实" });
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
}) => {
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
  await sourceSection.getByRole("button", { name: /查看全部 15 个来源/ }).click();
  await expect(visibleRows).toHaveCount(15);
  await expect(sourceName("待观测来源 14")).toBeVisible();
  await sourceSection.getByRole("button", { name: /收起来源/ }).click();
  await expect(visibleRows).toHaveCount(8);
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
  await expect(page.getByRole("region", { name: "平台事实" })).toContainText("活跃组织42");
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
  await expect(page.getByRole("heading", { name: "内容管理", level: 2 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "内容分页" })).toContainText("共 135 条");
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await page.getByRole("button", { name: "筛选内容管理" }).click();
  await expect(page.getByLabel("内容状态").getByRole("option", { name: "已归档" })).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await page
      .getByRole("dialog", { name: "筛选内容管理" })
      .getByRole("button", { name: "关闭筛选条件" })
      .click();
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
  await expect(page.getByRole("heading", { name: "内容管理", level: 2 })).toBeVisible();
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
  await expect(
    page.getByRole("link", { name: "选择组织与工作区后进入用户工作台" }),
  ).toHaveAttribute("href", /\/select-context\?return_to=%2Fhome/);
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
  await expect(page.getByRole("heading", { name: "规则、工作流与自动化", level: 2 })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "通知管理", level: 2 })).toBeVisible();
  await expect(page.getByText("任务状态通知")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /采集任务完成.*查看详情/ })).toBeVisible();
  else await expect(page.getByRole("table").getByText("member@example.test")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "通知管理", level: 2 })).toBeVisible();
  await expect(page.getByText("站内通知 · 启用", { exact: true })).toBeVisible();
  await expect(page.getByText("启用站内通知", { exact: true })).toBeVisible();
  await expect(page.getByText("启用邮件", { exact: true })).toBeVisible();
  await expect(page.getByText("停用全部通知", { exact: true })).toBeVisible();
  await expect(page.getByText("in_app", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "筛选通知管理" }).click();
  const notificationFilters = page.getByRole("dialog", { name: "筛选通知管理" });
  await notificationFilters.getByLabel("搜索通知管理").fill("采集");
  await notificationFilters.getByLabel("通知类型").selectOption("task");
  await notificationFilters.getByRole("button", { name: "关闭筛选条件" }).click();
  await page.getByRole("button", { name: /筛选通知管理.*2 项已选/ }).click();
  await expect(notificationFilters.getByLabel("搜索通知管理")).toHaveValue("采集");
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
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
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
    }),
  );
  await page.goto("/platform-admin/status");
  await expect(page.getByRole("heading", { name: "系统状态", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "依赖拓扑与故障传播", level: 3 })).toBeVisible();
  await expect(page.getByText("访问入口", { exact: true })).toBeVisible();
  await expect(page.getByText("共享依赖", { exact: true })).toBeVisible();
  await expect(page.getByText("异步执行", { exact: true })).toBeVisible();
  await expect(page.getByText("Python Crawler", { exact: true })).toBeVisible();
  await expect(page.getByText("1 个实例 · 1 个活动任务")).toBeVisible();
  const propagation = page.locator(".platform-propagation");
  await expect(propagation.getByText("Redis当前警告", { exact: true })).toBeVisible();
  await expect(propagation.getByText("文件存储当前已过期", { exact: true })).toBeVisible();
  await expect(propagation).toContainText("API 就绪、队列协调、限流与实时通知");
  await expect(propagation).toContainText("证据保存、报表导出与采集回执暂存");
  const realtime = page.getByRole("region", { name: "实时连接退化统计" });
  await expect(realtime.getByText("SSE 重连率", { exact: true })).toBeVisible();
  await expect(realtime.getByText("20.00%", { exact: true })).toBeVisible();
  await expect(realtime.getByText("降级轮询次数", { exact: true })).toBeVisible();
  await expect(realtime.getByText("2", { exact: true })).toBeVisible();
  await expect(realtime).toContainText("仅统计当前浏览器标签页会话");
  await expect(
    page.locator(".platform-topology-node").filter({ hasText: /^Redis/ }),
  ).toHaveAttribute("href", "/platform-admin/redis");
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
  await expect(page.getByText("1 个实例 · 1 个活动任务")).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P61", "refresh-failed-retained", [
    "expected-transport-abort",
    "last-success-data-retained",
    "failure-message-visible",
  ]);
  await page.unroute("**/api/v1/platform/management?**", failRefresh);
  await page.getByRole("button", { name: "刷新数据", exact: true }).click();
  await expect(page.locator(".platform-management-message")).toHaveCount(0);
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
  const sharedChain = page.locator(".platform-log-chain").filter({ hasText: "trace-shared" });
  await expect(sharedChain).toContainText("2 个事件 · 1 个异常");
  const workerChain = page.locator(".platform-log-chain").filter({ hasText: "trace-worker" });
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
    await expect(workerChain.getByRole("link", { name: "查看关联任务" })).toBeVisible();
    await expect(workerChain.getByRole("link", { name: "查看关联来源" })).toHaveCount(0);
  }
  const logQuery = page.getByPlaceholder("请求编号、链路编号、任务、事件或错误码");
  if (!(await logQuery.isVisible())) {
    await page.getByRole("button", { name: "筛选链路日志" }).click();
  }
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
