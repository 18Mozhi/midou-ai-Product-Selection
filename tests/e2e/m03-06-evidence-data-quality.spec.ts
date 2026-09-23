import { test, expect, type Locator } from "@playwright/test";
import { capturePhase2Evidence, finalizePhase2Evidence } from "./helpers/ui-phase2-evidence";

test.afterEach(async ({}, testInfo) => finalizePhase2Evidence(testInfo));

const ids = {
  evidence: "00000000-0000-4000-8000-000000000a61",
  issue: "00000000-0000-4000-8000-000000000a62",
  run: "00000000-0000-4000-8000-000000000a63",
  org: "00000000-0000-4000-8000-000000000a64",
  ws: "00000000-0000-4000-8000-000000000a65",
  provider: "00000000-0000-4000-8000-000000000a66",
};
const navigation = {
  shell: "platform_admin",
  organization_id: null,
  workspace_id: null,
  roles: [],
  capabilities: [],
  platform_roles: ["platform_operations_admin"],
  platform_capabilities: ["platform:operate"],
  guard_reason: "navigation_platform_admin_allowed",
};
const evidence = {
  id: ids.evidence,
  organization_id: ids.org,
  workspace_id: ids.ws,
  collection_task_id: "00000000-0000-4000-8000-000000000a67",
  provider_id: ids.provider,
  provider_name: "Market Evidence",
  source_url: "https://example.test/raw/desk",
  canonical_url: "https://example.test/products/desk",
  content_sha256: "a".repeat(64),
  content_type: "application/json",
  size_bytes: 18742,
  captured_at: "2026-08-07T12:00:00.000Z",
  parser_version: "parser-v3",
  adapter_version: "adapter-v2",
  retention_until: "2026-09-06T12:00:00.000Z",
  status: "active",
  request_id: "m03-06-evidence-request",
  trace_id: "m03-06-evidence-trace",
};
const issue = {
  id: ids.issue,
  organization_id: ids.org,
  workspace_id: ids.ws,
  provider_id: ids.provider,
  provider_name: "Market Evidence",
  reconciliation_run_id: ids.run,
  raw_evidence_id: ids.evidence,
  parser_version: "parser-v3",
  metric_code: "title_accuracy",
  field_path: "title",
  severity: "critical",
  status: "open",
  actual_value: 0.97,
  threshold_value: 0.98,
  resolution_reason: null,
  version: 1,
  created_at: "2026-08-07T12:05:00.000Z",
  updated_at: "2026-08-07T12:05:00.000Z",
};
const run = {
  id: ids.run,
  organization_id: ids.org,
  workspace_id: ids.ws,
  provider_id: ids.provider,
  provider_name: "Market Evidence",
  parser_version: "parser-v3",
  market: "US",
  sample_count: 100,
  metrics: [
    { code: "title_accuracy", value: 0.97, threshold: 0.98, status: "failed" },
    { code: "source_success_rate", value: 0.99, threshold: 0.95, status: "passed" },
  ],
  status: "failed",
  window_started_at: "2026-08-07T11:00:00.000Z",
  window_ended_at: "2026-08-07T12:00:00.000Z",
  created_at: "2026-08-07T12:05:00.000Z",
};
async function nav(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: navigation, request_id: "m03-06-nav", trace_id: "m03-06-nav" }),
    }),
  );
}
async function dashboard(
  page: any,
  data = {
    evidence: [evidence],
    issues: [issue],
    reconciliationRuns: [run],
    totalEvidence: 1,
    totalIssues: 1,
    observedAt: "2026-09-02T12:00:00.000Z",
  },
) {
  await page.route("**/api/v1/platform/data-quality?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data,
        meta: {
          page: 1,
          page_size: 50,
          total_evidence: data.totalEvidence,
          total_issues: data.totalIssues,
        },
        request_id: "m03-06-list",
        trace_id: "m03-06-list",
      }),
    }),
  );
}
async function selectCurrentIssue(page: any) {
  await page.getByRole("button", { name: "质量问题" }).click();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /标题准确率 · 待处理/ }).click();
    await page.getByRole("checkbox", { name: "选择此问题用于批量处理" }).check();
    await page.getByRole("button", { name: "关闭详情" }).last().click();
    return;
  }
  await page.getByRole("checkbox", { name: "选择 标题准确率" }).check();
}

test("M03-06.A07/A08/A15 evidence quality dashboard is responsive and visual", async ({
  page,
}, testInfo) => {
  await nav(page);
  await dashboard(page);
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  await expect(page.getByRole("heading", { name: "从证据，核对每个结论", level: 2 })).toBeVisible();
  await expect(page.getByText("Market Evidence").first()).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P54", "quality-default", [
    "原始证据、规范版本、字段来源与质量问题构成连续审计链",
    "蓝色任务轨与白色工作区清晰分离",
    "桌面数据表或手机摘要列表使用同一真实Vue数据",
  ]);
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await expect(page.getByRole("button", { name: /Market Evidence · 18.3 KB/ })).toBeVisible();
    await page.getByRole("button", { name: /Market Evidence · 18.3 KB/ }).click();
    await expect(page.getByText("4 天内到期").last()).toBeVisible();
    await page
      .getByRole("dialog", { name: /Market Evidence/ })
      .getByText("技术详情")
      .click();
    await expect(page.getByText(ids.evidence, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "关闭详情" }).last().click();
  } else {
    await expect(page.getByText("18.3 KB", { exact: true })).toBeVisible();
    await expect(page.getByText("4 天内到期").first()).toBeVisible();
  }
  await page.getByRole("button", { name: "质量问题" }).click();
  await capturePhase2Evidence(page, testInfo, "P54", "quality-issues", [
    "问题处置与证据读取分区明确",
    "批量操作先选择问题并预览影响范围",
    "严重级别、状态、门槛与解析版本同时可见",
  ]);
  await page.getByRole("button", { name: "核对运行" }).click();
  await capturePhase2Evidence(page, testInfo, "P54", "quality-runs", [
    "核对批次展示样本量、指标门槛与通过状态",
    "批次可以下钻异常字段、样本和解析版本",
    "批次视图不与质量处置表单混排",
  ]);
  const navigationButton = page.locator(".quality-task-nav button").first();
  expect(
    await navigationButton.evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(",")
        .some((value) => parseFloat(value) > 0.001),
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      navigationButton.evaluate((element) =>
        getComputedStyle(element)
          .transitionDuration.split(",")
          .every((value) => parseFloat(value) <= 0.00001),
      ),
    )
    .toBe(true);
  await expect(navigationButton).toHaveCSS("scroll-behavior", "auto");
});
test("data quality run drills into affected fields, samples and parser version", async ({
  page,
}) => {
  await nav(page);
  await dashboard(page);
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  await page.getByRole("button", { name: "核对运行" }).click();
  await expect(page.getByText("US · parser-v3")).toBeVisible();
  await page.getByRole("button", { name: "查看异常字段与样本" }).click();
  await expect(page.getByText("异常样本下钻")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /标题准确率 · 待处理/ }).click();
    await expect(page.getByText("title", { exact: true })).toBeVisible();
    await expect(page.getByText("parser-v3", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "关闭详情" }).last().click();
  } else await expect(page.getByText(/title · 解析 parser-v3/)).toBeVisible();
  await page.getByRole("button", { name: "返回全部问题" }).click();
  await expect(page.getByText("异常样本下钻")).toBeHidden();
});
test("M02-01 semantic roles keep data quality readable in every theme", async ({ page }) => {
  await nav(page);
  await dashboard(page);
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  await expect(page.locator(".quality-task")).toBeVisible();
  const samples = [];
  for (const theme of ["deep-ocean", "aurora-purple", "cloud-white"]) {
    samples.push(
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        const cardElement = document.querySelector(".quality-task"),
          textElement = [
            ...document.querySelectorAll(
              ".quality-task table td, .quality-task .responsive-data-view__summary strong",
            ),
          ].find((element) => element.getClientRects().length > 0);
        if (!(cardElement instanceof HTMLElement) || !(textElement instanceof HTMLElement)) {
          throw new Error("No visible data-quality text sample for the current viewport.");
        }
        const card = getComputedStyle(cardElement),
          cell = getComputedStyle(textElement);
        const rgb = (input) =>
            input
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number),
          luminance = (input) => {
            const values = rgb(input).map((part) => {
              const channel = part / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
          },
          foreground = luminance(cell.color),
          background = luminance(card.backgroundColor),
          contrast =
            (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        return { theme: value, background: card.backgroundColor, color: cell.color, contrast };
      }, theme),
    );
  }
  expect(new Set(samples.map((item) => item.background)).size).toBe(3);
  for (const sample of samples) expect(sample.contrast).toBeGreaterThanOrEqual(4.5);
});
test("M03-06.A08/A09/A15 evidence lineage and confirmed issue resolution preserve history", async ({
  page,
}, testInfo) => {
  await nav(page);
  await dashboard(page);
  await page.route(`**/api/v1/platform/data/evidence/${ids.evidence}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          evidence,
          normalized_records: [
            {
              id: "record-1",
              record_key: "desk-1",
              schema_version: "v1",
              record_version: 1,
              status: "active",
            },
          ],
          field_provenance: [
            {
              id: "provenance-1",
              field_path: "title",
              source_path: "$.title",
              transform_version: "copy-v1",
              source_value_sha256: "b".repeat(64),
            },
          ],
          quality_issues: [issue],
        },
        request_id: "m03-06-detail",
        trace_id: "m03-06-detail",
      }),
    }),
  );
  let resolved = false;
  await page.route(`**/api/v1/platform/data-quality/issues/${ids.issue}/resolve`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ reason: "已按原文重新核对标题字段", expected_version: 1 });
    resolved = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { ...issue, status: "resolved", resolution_reason: body.reason, version: 2 },
        request_id: "m03-06-resolve",
        trace_id: "m03-06-resolve",
      }),
    });
  });
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /Market Evidence · 18.3 KB/ }).click();
    await page.getByRole("button", { name: "读取完整溯源" }).click();
  } else await page.getByRole("button", { name: "详情" }).click();
  await expect(page.getByText("$.title · copy-v1")).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P54", "quality-lineage", [
    "原始证据、规范记录、字段来源和质量问题在同一原生模态中分段展示",
    "完整溯源保留请求和追踪标识",
    "关闭后键盘焦点返回触发入口",
  ]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const lineageClose = page.getByRole("button", { name: "关闭证据详情" });
  await expect
    .poll(() =>
      lineageClose.evaluate((element) =>
        getComputedStyle(element)
          .transitionDuration.split(",")
          .every((value) => parseFloat(value) <= 0.00001),
      ),
    )
    .toBe(true);
  await expect(lineageClose).toHaveCSS("scroll-behavior", "auto");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "关闭证据详情" }).click();
  await page.getByRole("button", { name: "质量问题" }).click();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /标题准确率 · 待处理/ }).click();
    await page.getByRole("button", { name: "记录解决" }).click();
  } else await page.getByRole("button", { name: "记录解决" }).click();
  await page
    .getByPlaceholder("说明修复方式与验证依据（2–500 字）")
    .fill("已按原文重新核对标题字段");
  await page.getByRole("button", { name: "确认前检查" }).click();
  await page.getByPlaceholder("确认解决").fill("确认解决");
  await capturePhase2Evidence(page, testInfo, "P54", "quality-resolve-confirm", [
    "解决原因在当前问题上下文中填写",
    "提交前再次展示不可改写历史的后果说明",
    "逐字确认与取消操作均在焦点约束内",
  ]);
  await page.getByRole("button", { name: "确认解决" }).click();
  await expect.poll(() => resolved).toBe(true);
});
test("M03-06.A08/A16 empty forbidden and dependency states are truthful", async ({ page }) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/data-quality?**", (route) =>
    route.fulfill(
      status === 200
        ? {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                evidence: [],
                issues: [],
                reconciliationRuns: [],
                totalEvidence: 0,
                totalIssues: 0,
              },
              request_id: "m03-06-empty",
              trace_id: "m03-06-empty",
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: status === 403 ? "authorization_denied" : "dependency_unavailable",
                message: "请求失败",
                action_hint: "按状态恢复",
              },
              request_id: `m03-06-${status}`,
              trace_id: `m03-06-${status}`,
            }),
          },
    ),
  );
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  await expect(page.locator('[data-kind="empty"]')).toBeVisible();
  status = 403;
  await page.reload();
  await page.getByRole("button", { name: "证据与质量" }).click();
  await expect(page.locator('[data-kind="forbidden"]')).toBeVisible();
  status = 503;
  await page.reload();
  await page.getByRole("button", { name: "证据与质量" }).click();
  await expect(page.locator('[data-kind="blocked"]')).toBeVisible();
});

test("UI2-P54 preserves the quality search workspace while switching data views", async ({
  page,
}) => {
  await nav(page);
  await dashboard(page);
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  const search = page.getByRole("textbox", { name: "搜索证据与质量" });
  await search.fill("Market Evidence");
  await search.press("Tab");
  await expect(page).toHaveURL(/quality_q=Market(?:\+|%20)Evidence/);
  await page.getByRole("button", { name: "近期记录" }).click();
  await page.getByRole("button", { name: "证据与质量" }).click();
  await expect(search).toHaveValue("Market Evidence");
  await expect(page).toHaveURL(/quality_q=Market(?:\+|%20)Evidence/);
});

test("UI2-P54 evidence lineage uses a native modal and returns keyboard focus", async ({
  page,
}) => {
  await nav(page);
  await dashboard(page);
  await page.route(`**/api/v1/platform/data/evidence/${ids.evidence}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          evidence,
          normalized_records: [],
          field_provenance: [],
          quality_issues: [issue],
        },
        request_id: "ui2-quality-detail",
        trace_id: "ui2-quality-detail",
      }),
    }),
  );
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  let returnTarget: Locator;
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    returnTarget = page.getByRole("button", { name: /Market Evidence · 18.3 KB/ });
    await returnTarget.click();
    await page.getByRole("button", { name: "读取完整溯源" }).click();
  } else {
    returnTarget = page.getByRole("button", { name: "详情" });
    await returnTarget.click();
  }
  const dialog = page.getByRole("dialog", { name: "证据完整溯源" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭证据详情" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(returnTarget).toBeFocused();
});

test("UI2-P54 freezes the reviewed batch scope before the typed confirmation", async ({
  page,
}, testInfo) => {
  await nav(page);
  await dashboard(page, {
    evidence: [evidence],
    issues: [issue],
    reconciliationRuns: [run],
    memberOptions: [],
    totalEvidence: 1,
    totalIssues: 1,
    observedAt: "2026-09-02T12:00:00.000Z",
  });
  let submitted: any = null;
  await page.route("**/api/v1/platform/data-quality/issues/batch", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ ...issue, status: "resolved", version: 2 }],
        request_id: "ui2-quality-batch",
        trace_id: "ui2-quality-batch",
      }),
    });
  });
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  await selectCurrentIssue(page);
  await page.getByPlaceholder("说明归因、指派或关闭依据").fill("核对来源后记录归因");
  await page.getByRole("button", { name: "预览影响范围" }).click();
  await capturePhase2Evidence(page, testInfo, "P54", "quality-batch-confirm", [
    "批量处置先冻结动作、对象版本、原因和影响范围",
    "确认层展示已审阅范围而非读取可变表单值",
    "逐字确认前不会提交写操作",
  ]);
  await page.evaluate(() => {
    const action = document.querySelector<HTMLSelectElement>(".quality-batch-toolbar select");
    const reason = document.querySelector<HTMLInputElement>(
      '.quality-batch-toolbar input[placeholder="说明归因、指派或关闭依据"]',
    );
    if (!action || !reason) throw new Error("batch controls missing");
    action.value = "close";
    action.dispatchEvent(new Event("change", { bubbles: true }));
    reason.value = "确认后发生的界面变化";
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByPlaceholder("确认处理").fill("确认处理");
  await page.getByRole("button", { name: "确认批量处理" }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toEqual({
    items: [{ id: ids.issue, expected_version: 1 }],
    action: "attribute",
    reason: "核对来源后记录归因",
    assignee_membership_id: null,
  });
});

test("UI2-P54 keeps write success separate when the following quality reload fails", async ({
  page,
}) => {
  await nav(page);
  let reads = 0;
  await page.route("**/api/v1/platform/data-quality?**", (route) => {
    reads += 1;
    if (reads === 1)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            evidence: [evidence],
            issues: [issue],
            reconciliationRuns: [run],
            totalEvidence: 1,
            totalIssues: 1,
            observedAt: "2026-09-02T12:00:00.000Z",
          },
          request_id: "ui2-quality-first-read",
          trace_id: "ui2-quality-first-read",
        }),
      });
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "dependency_unavailable",
          message: "刷新失败",
          action_hint: "质量问题已处理，但最新列表暂时无法读取。",
        },
        request_id: "ui2-quality-reload-failed",
        trace_id: "ui2-quality-reload-failed",
      }),
    });
  });
  await page.route(`**/api/v1/platform/data-quality/issues/${ids.issue}/resolve`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { ...issue, status: "resolved", version: 2 },
        request_id: "ui2-quality-resolved",
        trace_id: "ui2-quality-resolved",
      }),
    }),
  );
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  await selectCurrentIssue(page);
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /标题准确率 · 待处理/ }).click();
    await page.getByRole("button", { name: "记录解决" }).click();
  } else await page.getByRole("button", { name: "记录解决" }).click();
  await page.getByPlaceholder("说明修复方式与验证依据（2–500 字）").fill("重新核对原始标题");
  await page.getByRole("button", { name: "确认前检查" }).click();
  await page.getByPlaceholder("确认解决").fill("确认解决");
  await page.getByRole("button", { name: "确认解决" }).click();
  await expect(page.getByText(/已记录解决原因。原始证据和历史核对未被改写/)).toBeVisible();
  await expect(page.getByText("质量问题已处理，但最新列表暂时无法读取。")).toBeVisible();
});

test("UI2-P54 blocks a repeated batch write after an unknown result until a successful read", async ({
  page,
}, testInfo) => {
  await nav(page);
  await dashboard(page);
  await page.route("**/api/v1/platform/data-quality/issues/batch", (route) =>
    route.abort("failed"),
  );
  await page.goto("/platform-admin/data");
  await page.getByRole("button", { name: "证据与质量" }).click();
  await selectCurrentIssue(page);
  await page.getByPlaceholder("说明归因、指派或关闭依据").fill("核对来源后记录归因");
  const preview = page.getByRole("button", { name: "预览影响范围" });
  await preview.click();
  await page.getByPlaceholder("确认处理").fill("确认处理");
  await page.getByRole("button", { name: "确认批量处理" }).click();
  await expect(page.getByText(/批量处理结果未知/)).toBeVisible();
  await expect(preview).toBeDisabled();
  await capturePhase2Evidence(page, testInfo, "P54", "quality-batch-unknown", [
    "无HTTP结果时明确标记操作结果未知",
    "同一快照禁止再次预览和重复提交",
    "仅成功重新读取后解除未知结果锁定",
  ]);
  await page.getByRole("button", { name: "刷新读取" }).click();
  await selectCurrentIssue(page);
  await expect(preview).toBeEnabled();
});
