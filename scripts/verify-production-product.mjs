import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const baseUrl = (process.env.SCOUTOPS_QA_BASE_URL ?? "https://midouai.mozhiz.cn").replace(/\/$/, "");
const screenshotDirectory = resolve(process.env.SCOUTOPS_QA_SCREENSHOT_DIR ?? ".artifacts/production-product-qa");
const reportFile = resolve(process.env.SCOUTOPS_QA_REPORT_FILE ?? ".artifacts/verification/production-product-functional.json");
const accounts = {
  platform: { email: required("SCOUTOPS_QA_ADMIN_EMAIL"), password: required("SCOUTOPS_QA_ADMIN_PASSWORD") },
  member: { email: required("SCOUTOPS_QA_MEMBER_EMAIL"), password: required("SCOUTOPS_QA_MEMBER_PASSWORD") },
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

await mkdir(screenshotDirectory, { recursive: true });
await mkdir(resolve(reportFile, ".."), { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { schema_version: 1, base_url: baseUrl, started_at: new Date().toISOString(), roles: {}, status: "failed" };

async function createRoleSession(role) {
  const context = await browser.newContext({ ignoreHTTPSErrors: false, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const apiFailures = [];
  const consoleErrors = [];
  page.on("response", (response) => {
    if (response.url().startsWith(`${baseUrl}/api/`) && response.status() >= 400) {
      apiFailures.push({ status: response.status(), url: response.url() });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(accounts[role].email);
  await page.locator('input[type="password"]').fill(accounts[role].password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2_000);
  if (role === "platform") {
    await page.waitForURL(/\/platform-admin$/);
  } else {
    await page.waitForURL(/\/select-context$/);
    const organizationButton = page.getByRole("button").filter({ hasText: "AI选品功能验收组织" });
    await organizationButton.click();
    const workspaceButton = page.getByRole("button").filter({ hasText: "功能验收工作区" });
    await workspaceButton.click();
    await page.getByText("工作范围已就绪", { exact: true }).waitFor();
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.waitForURL(/\/home$/);
  }
  return { context, page, apiFailures, consoleErrors };
}

async function visibleRoutes(page) {
  const routes = await page.locator('.role-sidebar a[href^="/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  return [...new Set(routes.filter(Boolean))];
}

async function checkRoutes(role, session) {
  const { page, apiFailures } = session;
  const routes = await visibleRoutes(page);
  assert(routes.length >= 3, `${role} navigation exposed only ${routes.length} routes`);
  const checked = [];
  for (const route of routes) {
    const failureStart = apiFailures.length;
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    const text = await page.locator("body").innerText();
    const heading = (await page.getByRole("heading").allTextContents()).find((value) => value.trim()) ?? "";
    const newFailures = apiFailures.slice(failureStart);
    assert(text.length > 120, `${role}:${route} rendered no usable content`);
    assert(!text.includes("FOUNDATION / M00-01"), `${role}:${route} exposed the foundation harness`);
    assert(!text.includes("当前页面还没有接入"), `${role}:${route} exposed a placeholder`);
    assert(!text.includes("登录已失效"), `${role}:${route} lost its authenticated session`);
    assert(newFailures.length === 0, `${role}:${route} returned API failures: ${JSON.stringify(newFailures)}`);
    checked.push({ route, heading, body_length: text.length });
  }
  return checked;
}

try {
  const platform = await createRoleSession("platform");
  await platform.page.screenshot({ path: resolve(screenshotDirectory, "01-platform-dashboard.png"), fullPage: true });
  const platformRoutes = await checkRoutes("platform", platform);
  await platform.page.goto(`${baseUrl}/platform-admin`, { waitUntil: "networkidle" });
  await platform.page.getByRole("button").filter({ hasText: "创建" }).first().click();
  const platformCreate = platform.page.getByRole("dialog", { name: "快捷创建" });
  await platformCreate.waitFor();
  await platformCreate.locator('.discovery-results a[href^="/"]').first().waitFor();
  const platformActionLinks = await platformCreate.locator('.discovery-results a[href^="/"]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), label: link.textContent?.trim() ?? "" })));
  assert(platformActionLinks.length > 0, "platform quick create returned no authorized action");
  assert(!(await platformCreate.innerText()).includes("ERROR"), "platform quick create exposed the generic ERROR state");
  await platform.page.screenshot({ path: resolve(screenshotDirectory, "02-platform-quick-create.png"), fullPage: true });
  report.roles.platform = { landing: "/platform-admin", routes: platformRoutes, quick_actions: platformActionLinks, api_failures: platform.apiFailures, console_errors: platform.consoleErrors };
  await platform.context.close();

  const member = await createRoleSession("member");
  await member.page.screenshot({ path: resolve(screenshotDirectory, "03-member-home.png"), fullPage: true });
  const memberRoutes = await checkRoutes("member", member);
  await member.page.goto(`${baseUrl}/home`, { waitUntil: "networkidle" });
  await member.page.keyboard.press("Control+K");
  const search = member.page.getByRole("dialog", { name: "全局搜索" });
  await search.getByPlaceholder("输入至少 2 个字符").fill("验收");
  await search.getByPlaceholder("输入至少 2 个字符").press("Enter");
  await member.page.waitForTimeout(500);
  assert(!(await search.innerText()).includes("ERROR"), "member global search exposed the generic ERROR state");
  await member.page.keyboard.press("Escape");
  await member.page.getByRole("button").filter({ hasText: "创建" }).first().click();
  const memberCreate = member.page.getByRole("dialog", { name: "快捷创建" });
  await memberCreate.waitFor();
  await memberCreate.locator('.discovery-results a[href^="/"]').first().waitFor();
  const memberActionLinks = await memberCreate.locator('.discovery-results a[href^="/"]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), label: link.textContent?.trim() ?? "" })));
  assert(memberActionLinks.some((item) => item.href === "/tasks?create=1"), "member task creation entry is missing");
  assert(memberActionLinks.some((item) => item.href === "/sourcing?create=1"), "member sourcing entry is missing");
  await member.page.screenshot({ path: resolve(screenshotDirectory, "04-member-quick-create.png"), fullPage: true });
  await member.page.goto(`${baseUrl}/tasks?create=1`, { waitUntil: "networkidle" });
  assert(
    (await member.page.locator('dialog[open], [role="dialog"]').count()) > 0,
    "task create route did not open its form",
  );
  await member.page.screenshot({ path: resolve(screenshotDirectory, "05-task-create.png"), fullPage: true });
  await member.page.goto(`${baseUrl}/sourcing?create=1`, { waitUntil: "networkidle" });
  assert(
    (await member.page.locator('dialog[open], [role="dialog"]').count()) > 0,
    "sourcing route did not open its form",
  );
  await member.page.screenshot({ path: resolve(screenshotDirectory, "06-sourcing-create.png"), fullPage: true });
  report.roles.member = { landing: "/home", routes: memberRoutes, quick_actions: memberActionLinks, api_failures: member.apiFailures, console_errors: member.consoleErrors };
  await member.context.close();

  assert(report.roles.platform.console_errors.length === 0, `platform console errors: ${JSON.stringify(report.roles.platform.console_errors)}`);
  assert(report.roles.member.console_errors.length === 0, `member console errors: ${JSON.stringify(report.roles.member.console_errors)}`);
  report.status = "passed";
} catch (error) {
  report.failure = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) };
  throw error;
} finally {
  report.finished_at = new Date().toISOString();
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(JSON.stringify({ status: report.status, report_file: reportFile, screenshot_directory: screenshotDirectory, route_counts: { platform: report.roles.platform.routes.length, member: report.roles.member.routes.length } }, null, 2));
