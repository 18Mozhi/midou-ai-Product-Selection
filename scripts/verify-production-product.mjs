import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  authorizedRoutesFor,
  readProtectedRouteCatalog,
  readRouteCatalogManifest,
  roleRouteMatrix,
} from "./production-route-catalog.mjs";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const credentials = (prefix) => ({
  email: required(`${prefix}_EMAIL`),
  password: required(`${prefix}_PASSWORD`),
});

const baseUrl = (process.env.SCOUTOPS_QA_BASE_URL ?? "https://midouai.medouai.com").replace(
  /\/$/,
  "",
);
const screenshotDirectory = resolve(
  process.env.SCOUTOPS_QA_SCREENSHOT_DIR ?? ".artifacts/production-product-qa",
);
const reportFile = resolve(
  process.env.SCOUTOPS_QA_REPORT_FILE ??
    ".artifacts/verification/production-product-functional.json",
);
const organizationLabel =
  process.env.SCOUTOPS_QA_ORGANIZATION_LABEL?.trim() || "AI选品功能验收组织";
const workspaceLabel = process.env.SCOUTOPS_QA_WORKSPACE_LABEL?.trim() || "功能验收工作区";
const qaTraceId = process.env.SCOUTOPS_QA_TRACE_ID?.trim() || randomUUID();
const routeManifest = await readRouteCatalogManifest();
const profiles = routeManifest.productionAcceptance.roles.map((profile) => ({
  key: profile.key,
  role: profile.role,
  shell: profile.shell,
  landing: new RegExp(`${profile.landingPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  account: credentials(profile.credentialPrefix),
  forbidden: profile.forbiddenCapabilities,
}));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const protectedRouteCatalog = await readProtectedRouteCatalog();
await mkdir(screenshotDirectory, { recursive: true });
await mkdir(resolve(reportFile, ".."), { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  schema_version: 3,
  base_url: baseUrl,
  started_at: new Date().toISOString(),
  route_catalog_count: protectedRouteCatalog.length,
  roles: {},
  status: "failed",
  trace_id: qaTraceId,
};

async function selectContextIfNeeded(profile, page) {
  if (profile.shell === "platform_admin" || !/\/select-context$/.test(page.url())) return;
  await page.getByRole("button").filter({ hasText: organizationLabel }).click();
  await page.getByRole("button").filter({ hasText: workspaceLabel }).click();
  await page.getByText("工作范围已就绪", { exact: true }).waitFor();
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
}

async function readGuard(profile, context) {
  const response = await context.request.get(
    `${baseUrl}/api/v1/me/navigation?shell=${profile.shell}`,
    {
      headers: {
        accept: "application/json",
        "x-request-id": randomUUID(),
        "x-trace-id": qaTraceId,
      },
    },
  );
  const body = await response.json().catch(() => null);
  assert(response.ok(), `${profile.key} navigation guard returned ${response.status()}`);
  return body?.data;
}

function verifyRoleBoundary(profile, guard) {
  const roles = profile.shell === "platform_admin" ? guard?.platform_roles : guard?.roles;
  const capabilities =
    profile.shell === "platform_admin" ? guard?.platform_capabilities : guard?.capabilities;
  assert(
    JSON.stringify([...(roles ?? [])].sort()) === JSON.stringify([profile.role]),
    `${profile.key} must have exactly the ${profile.role} role`,
  );
  assert(Array.isArray(capabilities), `${profile.key} guard returned no capability list`);
  assert(
    !profile.forbidden.some((capability) => capabilities.includes(capability)),
    `${profile.key} contains a forbidden capability`,
  );
  if (profile.shell !== "platform_admin")
    assert(
      (guard?.platform_roles?.length ?? 0) === 0 &&
        (guard?.platform_capabilities?.length ?? 0) === 0,
      `${profile.key} must not have a platform role`,
    );
  return capabilities;
}

async function createRoleSession(profile) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/api/**", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-trace-id": qaTraceId } }),
  );
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
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(profile.account.email);
  await page.locator('input[type="password"]').fill(profile.account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login");
  await selectContextIfNeeded(profile, page);
  await page.waitForURL(profile.landing);
  const guard = await readGuard(profile, context);
  const capabilities = verifyRoleBoundary(profile, guard);
  return { context, page, apiFailures, consoleErrors, guard, capabilities };
}

async function concreteRoute(page, route) {
  if (!route.dynamic) return route.path;
  const resolver = route.resolver;
  assert(resolver, `no production resolver for ${route.path}`);
  await page.goto(`${baseUrl}${resolver.parentPath}`, { waitUntil: "networkidle" });
  const paths = await page
    .locator('a[href^="/"]')
    .evaluateAll((links) => links.map((link) => new URL(link.href).pathname));
  const pattern = new RegExp(resolver.pathPattern, "i");
  const resolved = paths.find((path) => pattern.test(path));
  assert(resolved, `${route.path} has no persisted acceptance record`);
  return resolved;
}

async function checkRoutes(profile, session) {
  const { page, apiFailures, capabilities } = session;
  const routes = authorizedRoutesFor(protectedRouteCatalog, profile.shell, capabilities);
  assert(routes.length >= 1, `${profile.key} has no authorized protected route`);
  const checked = [];
  for (const route of routes) {
    const path = await concreteRoute(page, route);
    const failureStart = apiFailures.length;
    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    const text = await page.locator("body").innerText();
    const heading =
      (await page.getByRole("heading").allTextContents()).find((value) => value.trim()) ?? "";
    const newFailures = apiFailures.slice(failureStart);
    assert(text.length > 120, `${profile.key}:${path} rendered no usable content`);
    assert(!text.includes("FOUNDATION / M00-01"), `${profile.key}:${path} exposed the harness`);
    assert(!text.includes("当前页面还没有接入"), `${profile.key}:${path} exposed a placeholder`);
    assert(!text.includes("登录已失效"), `${profile.key}:${path} lost its authenticated session`);
    assert(
      newFailures.length === 0,
      `${profile.key}:${path} returned API failures: ${JSON.stringify(newFailures)}`,
    );
    checked.push({ template: route.path, route: path, heading, body_length: text.length });
  }
  return checked;
}

async function verifyQuickActions(profile, session) {
  const { page } = session;
  if (profile.key === "platform_super_admin") {
    await page.goto(`${baseUrl}/platform-admin`, { waitUntil: "networkidle" });
    await page.getByRole("button").filter({ hasText: "创建" }).first().click();
    const dialog = page.getByRole("dialog", { name: "快捷创建" });
    await dialog.waitFor();
    await dialog.locator('.discovery-results a[href^="/"]').first().waitFor();
    const links = await dialog.locator('.discovery-results a[href^="/"]').evaluateAll((items) =>
      items.map((item) => ({
        href: item.getAttribute("href"),
        label: item.textContent?.trim() ?? "",
      })),
    );
    assert(links.length > 0, "platform quick create returned no authorized action");
    assert(!(await dialog.innerText()).includes("ERROR"), "platform quick create exposed ERROR");
    await page.screenshot({
      path: resolve(screenshotDirectory, "02-platform-quick-create.png"),
      fullPage: true,
    });
    return links;
  }
  if (profile.key !== "member") return [];
  await page.goto(`${baseUrl}/home`, { waitUntil: "networkidle" });
  await page.keyboard.press("Control+K");
  const search = page.getByRole("dialog", { name: "全局搜索" });
  await search.getByPlaceholder("输入至少 2 个字符").fill("验收");
  await search.getByPlaceholder("输入至少 2 个字符").press("Enter");
  await page.waitForTimeout(500);
  assert(!(await search.innerText()).includes("ERROR"), "member global search exposed ERROR");
  await page.keyboard.press("Escape");
  await page.getByRole("button").filter({ hasText: "创建" }).first().click();
  const dialog = page.getByRole("dialog", { name: "快捷创建" });
  await dialog.waitFor();
  await dialog.locator('.discovery-results a[href^="/"]').first().waitFor();
  const links = await dialog.locator('.discovery-results a[href^="/"]').evaluateAll((items) =>
    items.map((item) => ({
      href: item.getAttribute("href"),
      label: item.textContent?.trim() ?? "",
    })),
  );
  assert(
    links.some((item) => item.href === "/tasks?create=1"),
    "member task action missing",
  );
  assert(
    links.some((item) => item.href === "/sourcing?create=1"),
    "member sourcing action missing",
  );
  await page.screenshot({
    path: resolve(screenshotDirectory, "04-member-quick-create.png"),
    fullPage: true,
  });
  return links;
}

try {
  for (const profile of profiles) {
    const session = await createRoleSession(profile);
    try {
      if (profile.key === "platform_super_admin")
        await session.page.screenshot({
          path: resolve(screenshotDirectory, "01-platform-dashboard.png"),
          fullPage: true,
        });
      if (profile.key === "member")
        await session.page.screenshot({
          path: resolve(screenshotDirectory, "03-member-home.png"),
          fullPage: true,
        });
      const routes = await checkRoutes(profile, session);
      const routeMatrix = roleRouteMatrix(
        protectedRouteCatalog,
        profile.shell,
        session.capabilities,
      );
      assert(
        routeMatrix.filter((entry) => entry.decision === "allow").length === routes.length,
        `${profile.key} route allow matrix drifted from traversal`,
      );
      const quickActions = await verifyQuickActions(profile, session);
      assert(
        session.consoleErrors.length === 0,
        `${profile.key} console errors: ${JSON.stringify(session.consoleErrors)}`,
      );
      report.roles[profile.key] = {
        role: profile.role,
        shell: profile.shell,
        capabilities: [...session.capabilities].sort(),
        routes,
        route_count: routes.length,
        route_matrix: routeMatrix,
        allow_count: routeMatrix.filter((entry) => entry.decision === "allow").length,
        deny_count: routeMatrix.filter((entry) => entry.decision === "deny").length,
        quick_actions: quickActions,
        api_failures: session.apiFailures,
        console_errors: session.consoleErrors,
      };
    } finally {
      await session.context.close();
    }
  }
  const coveredTemplates = new Set(
    Object.values(report.roles).flatMap((role) => role.routes.map((route) => route.template)),
  );
  const uncovered = protectedRouteCatalog
    .map((route) => route.path)
    .filter((route) => !coveredTemplates.has(route));
  assert(uncovered.length === 0, `authorized route catalog is not fully covered: ${uncovered}`);
  report.covered_route_templates = [...coveredTemplates].sort();
  report.status = "passed";
} catch (error) {
  report.failure =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  throw error;
} finally {
  report.finished_at = new Date().toISOString();
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(
  JSON.stringify(
    {
      status: report.status,
      report_file: reportFile,
      screenshot_directory: screenshotDirectory,
      route_catalog_count: report.route_catalog_count,
      route_counts: Object.fromEntries(
        Object.entries(report.roles).map(([role, value]) => [role, value.route_count]),
      ),
    },
    null,
    2,
  ),
);
