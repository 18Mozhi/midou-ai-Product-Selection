import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { chromium } from "playwright";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const baseUrl = (process.env.SCOUTOPS_QA_BASE_URL ?? "https://midouai.medouai.com").replace(
  /\/$/,
  "",
);
const account = {
  email: required("SCOUTOPS_QA_ORGANIZATION_ADMIN_EMAIL"),
  password: required("SCOUTOPS_QA_ORGANIZATION_ADMIN_PASSWORD"),
};
const resources = JSON.parse(required("SCOUTOPS_ACCEPTANCE_RESOURCE_IDS"));
const traceId = process.env.SCOUTOPS_QA_TRACE_ID?.trim() || randomUUID();
const browserExecutablePath = process.env.SCOUTOPS_PLAYWRIGHT_EXECUTABLE_PATH?.trim();
if (browserExecutablePath && !isAbsolute(browserExecutablePath))
  throw new Error("SCOUTOPS_PLAYWRIGHT_EXECUTABLE_PATH must be absolute");
if (browserExecutablePath) await access(browserExecutablePath, constants.X_OK);
const screenshotDirectory = resolve(
  process.env.SCOUTOPS_CORE_E2E_SCREENSHOT_DIR ?? ".artifacts/production-core-e2e",
);
const reportFile = resolve(
  process.env.SCOUTOPS_CORE_E2E_REPORT_FILE ?? ".artifacts/verification/production-core-e2e.json",
);
const organizationLabel =
  process.env.SCOUTOPS_QA_ORGANIZATION_LABEL?.trim() || "AI选品功能验收组织";
const workspaceLabel = process.env.SCOUTOPS_QA_WORKSPACE_LABEL?.trim() || "功能验收工作区";
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

await mkdir(screenshotDirectory, { recursive: true });
await mkdir(dirname(reportFile), { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(browserExecutablePath ? { executablePath: browserExecutablePath } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { "x-trace-id": traceId },
});
const page = await context.newPage();
const apiFailures = [];
const consoleErrors = [];
page.on("response", (response) => {
  if (response.url().startsWith(`${baseUrl}/api/`) && response.status() >= 400)
    apiFailures.push({ status: response.status(), url: response.url() });
});
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
const report = {
  schema_version: 1,
  status: "failed",
  base_url: baseUrl,
  trace_id: traceId,
  dependencies: null,
  chains: {},
  screenshots: [],
  api_failures: apiFailures,
  console_errors: consoleErrors,
  failure: null,
};

async function selectContextIfNeeded() {
  if (!/\/select-context$/.test(page.url())) return;
  await page.getByRole("button").filter({ hasText: organizationLabel }).click();
  await page.getByRole("button").filter({ hasText: workspaceLabel }).click();
  await page.getByText("工作范围已就绪", { exact: true }).waitFor();
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
}

async function screenshot(name) {
  const path = resolve(screenshotDirectory, name);
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}

try {
  const ready = await context.request.get(`${baseUrl}/api/v1/health/ready`, {
    headers: { "x-request-id": randomUUID(), "x-trace-id": traceId },
  });
  const readyBody = await ready.json();
  assert(ready.ok(), `real stack readiness returned ${ready.status()}`);
  assert(
    readyBody?.data?.dependencies?.mysql === "available" &&
      readyBody?.data?.dependencies?.redis === "available",
    "real core E2E requires available MySQL and Redis",
  );
  report.dependencies = readyBody.data.dependencies;

  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("账号（邮箱或用户名）").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login");
  await selectContextIfNeeded();

  await page.goto(`${baseUrl}/trends?topic=${resources.trendTopicId}`, {
    waitUntil: "networkidle",
  });
  await page
    .getByText(/生产验收趋势/)
    .first()
    .waitFor();
  await page.goto(`${baseUrl}/opportunities/${resources.opportunityId}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "生产验收机会" }).waitFor();
  await page.getByRole("heading", { name: "建议采纳", exact: true }).waitFor();
  await page.getByText("5/5 已通过", { exact: true }).waitFor();
  await page.getByRole("button", { name: "采纳建议", exact: true }).click();
  const decisionDialog = page.getByRole("dialog");
  await decisionDialog
    .getByLabel("原因（必填）")
    .fill("生产真实栈验收：五项质量门全部通过后人工采纳建议");
  await decisionDialog.getByRole("button", { name: "确认记录" }).click();
  await page.getByText("决策已记录；原始评分与证据未被改写。").waitFor();
  await page.goto(`${baseUrl}/tasks/${resources.taskId}`, { waitUntil: "networkidle" });
  await page.getByText("生产验收任务", { exact: true }).first().waitFor();
  await screenshot("01-source-decision-task.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("更多任务操作", { exact: true }).click();
  const secondaryActions = page.locator(".task-detail-more > div");
  await secondaryActions.waitFor();
  const secondaryBounds = await secondaryActions.boundingBox();
  assert(
    secondaryBounds && secondaryBounds.x >= 0 && secondaryBounds.x + secondaryBounds.width <= 390,
    "task mobile secondary actions overflowed the viewport",
  );
  await screenshot("02-task-mobile-actions.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  report.chains.source_decision_task = {
    status: "passed",
    trend_topic_id: resources.trendTopicId,
    opportunity_id: resources.opportunityId,
    task_id: resources.taskId,
    selection_stage: "recommended",
    quality_gates_passed: 5,
    decision_action: "adopt",
  };

  await page.goto(`${baseUrl}/tasks/approvals?approval=${resources.approvalRequestId}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "生产验收任务审批" }).waitFor();
  await page.getByLabel("审批依据与影响范围").waitFor();
  await screenshot("03-approval-decision-desk.png");
  report.chains.approval_decision_desk = {
    status: "passed",
    approval_request_id: resources.approvalRequestId,
    task_id: resources.taskId,
  };

  await page.goto(`${baseUrl}/sourcing?record=${resources.sourcingSearchId}`, {
    waitUntil: "networkidle",
  });
  await page.getByText("生产验收供应商", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "确认报价" }).click();
  const quoteDialog = page.getByRole("dialog");
  await quoteDialog.getByLabel("规格").fill("500ml / 蓝色 / 单只彩盒");
  await quoteDialog.getByLabel("所在地").fill("浙江宁波");
  await quoteDialog.getByLabel("稳定性").selectOption("stable");
  await quoteDialog.getByLabel("风险").selectOption("low");
  await quoteDialog.getByRole("button", { name: "确认新版本" }).click();
  await page.getByText("报价已按新版本确认，原始候选和证据未改写。").waitFor();
  await page.goto(`${baseUrl}/opportunities/${resources.opportunityId}?tab=profit`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "利润与成本" }).click();
  await page.getByText(/69\.4/).first().waitFor();
  await screenshot("04-sourcing-cost-profit.png");
  report.chains.sourcing_cost_profit = {
    status: "passed",
    sourcing_search_id: resources.sourcingSearchId,
    sourcing_candidate_id: resources.sourcingCandidateId,
    profit_run_id: resources.profitRunId,
  };

  assert(apiFailures.length === 0, `core E2E API failures: ${JSON.stringify(apiFailures)}`);
  assert(consoleErrors.length === 0, `core E2E console errors: ${JSON.stringify(consoleErrors)}`);
  report.status = "passed";
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 2;
} finally {
  report.captured_at = new Date().toISOString();
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(reportFile, 0o600).catch(() => {});
  await context.close();
  await browser.close();
}

console.log(
  JSON.stringify({
    status: report.status,
    dependencies: report.dependencies,
    chains: report.chains,
    screenshots: report.screenshots.length,
    report_file: reportFile,
    request_id: traceId,
    trace_id: traceId,
  }),
);
