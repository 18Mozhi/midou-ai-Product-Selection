import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildAcceptanceDesignData } from "./lib/ui-phase2-1688-acceptance-design-data.mjs";
import {
  acceptanceLifecycleCopy,
  previewAlibaba1688AcceptanceLifecycle,
} from "./lib/ui-phase2-1688-acceptance-lifecycle-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p49-acceptance-lifecycle-review",
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  styles = [
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-page-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-read-states-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-actions-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-robustness-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-lifecycle-preview.css",
  ],
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  proposedSource = previewAlibaba1688AcceptanceLifecycle(source),
  { data: acceptanceData } = await buildAcceptanceDesignData(process.cwd()),
  clone = (value) => JSON.parse(JSON.stringify(value));

const fixtureAst = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(fixtureAst);
const navigationDeclaration = declarations.filter(
  (node) => node.name.getText(fixtureAst) === "navigation",
);
assert.equal(navigationDeclaration.length, 1, "one navigation fixture");
const fixtureBox = {};
vm.runInNewContext(
  ts.transpileModule(
    `const navigation=${navigationDeclaration[0].initializer.getText(fixtureAst)};globalThis.value=navigation("platform_admin");`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  fixtureBox,
);

const navigation = JSON.parse(JSON.stringify(fixtureBox.value)),
  widths = [390, 1440],
  target = "/platform-admin/providers/sources/1688-acceptance",
  away = "/platform-admin/providers/adapters",
  secondOrganization = {
    ...clone(acceptanceData.organizations[0]),
    id: "00000000-0000-4000-8000-000000000b74",
    name: "旧请求测试组织",
    default_workspace_id: "00000000-0000-4000-8000-000000000b75",
  },
  secondWorkspace = {
    ...clone(acceptanceData.workspaces[0]),
    id: "00000000-0000-4000-8000-000000000b75",
    name: "不应覆盖返回页的旧工作区",
  },
  returnedWorkspace = {
    ...clone(acceptanceData.workspaces[0]),
    name: "返回后重新读取的工作区",
  },
  staleAcceptance = clone(acceptanceData.variants["all-passed-disabled"]),
  returnedAcceptance = clone(acceptanceData.pending),
  baselineRuns = [],
  proposedRuns = [],
  screenshots = [],
  ports = [],
  loadedSources = new Set([
    component,
    fixture,
    ...styles,
    "apps/web/src/App.vue",
    "apps/web/src/router.ts",
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/components/ProviderRuntimeSurface.vue",
    "config/route-catalog.json",
    "scripts/lib/ui-phase2-1688-acceptance-design-data.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-page-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-read-states-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-actions-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-robustness-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-lifecycle-preview.mjs",
    "scripts/verify-ui-phase2-1688-acceptance-lifecycle.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]);

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

async function startServer(mode) {
  const reservation = reservePort();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  ports.push(port);
  const origin = `http://127.0.0.1:${port}`,
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
      plugins: [
        {
          name: `p49-acceptance-lifecycle-${mode}`,
          enforce: "pre",
          transform(text, id) {
            if (id.includes("?")) return null;
            const bare = id.split("?", 1)[0],
              normalized = bare.replaceAll("\\", "/");
            if (path.isAbsolute(bare)) {
              const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
              if (
                !relative.includes("/node_modules/") &&
                (relative.startsWith("apps/") || relative.startsWith("packages/"))
              )
                loadedSources.add(relative);
            }
            if (mode !== "proposed") return null;
            if (normalized !== path.resolve(component).replaceAll("\\", "/")) return null;
            assert.equal(text.replaceAll("\r\n", "\n"), source);
            return { code: proposedSource, map: null };
          },
          transformIndexHtml(html) {
            if (mode !== "proposed") return html;
            const links = styles
              .map(
                (file) =>
                  `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
              )
              .join("");
            return html
              .replace(
                "<body>",
                '<body class="p49-acceptance-review p49-acceptance-read-review p49-acceptance-actions-review p49-acceptance-robustness-review p49-acceptance-lifecycle-review">',
              )
              .replace("</head>", `${links}</head>`);
          },
        },
      ],
    });
  await server.listen();
  console.log(`P49 acceptance lifecycle ${mode} ${origin}`);
  return { server, origin, port };
}

const navigate = (page, route) =>
  page.evaluate(async (route) => {
    const { router } = await import("/src/router.ts");
    await router.push(route);
  }, route);

let browser;
try {
  browser = await chromium.launch();
  if (capture) {
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
  }

  {
    const harness = await startServer("baseline");
    try {
      for (const width of widths) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 980 : 1080 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        try {
          const page = await context.newPage(),
            checks = [],
            pageErrors = [],
            blockedReads = [],
            check = (name, actual, expected = true) => {
              assert.deepEqual(actual, expected, `baseline/${width}:${name}`);
              checks.push({ name, actual });
            };
          let acceptanceReads = 0,
            membershipReads = 0,
            workspaceReads = 0;
          page.on("pageerror", (error) => pageErrors.push(error.message));
          await page.route("**/*", async (route) => {
            const request = route.request(),
              url = new URL(request.url()),
              key = `${request.method()} ${url.pathname}`;
            if (url.origin !== harness.origin) return route.abort();
            if (!url.pathname.startsWith("/api/")) return route.continue();
            if (key === "GET /api/v1/me/navigation")
              return route.fulfill({ json: { data: navigation, request_id: "p49-nav" } });
            if (key === "GET /api/v1/auth/session-status")
              return route.fulfill({ json: { data: { authenticated: true } } });
            if (key === "GET /api/v1/platform/provider-sources/1688-acceptance") {
              acceptanceReads += 1;
              return route.fulfill({
                json: { data: acceptanceData.original, request_id: "p49-baseline" },
              });
            }
            if (key === "GET /api/v1/org/memberships") {
              membershipReads += 1;
              return route.fulfill({
                json: { data: acceptanceData.organizations, request_id: "p49-memberships" },
              });
            }
            if (key.includes("/workspaces")) {
              workspaceReads += 1;
              return route.fulfill({
                json: { data: acceptanceData.workspaces, request_id: "p49-workspaces" },
              });
            }
            if (request.method() === "GET") {
              blockedReads.push(key);
              return route.abort("blockedbyclient");
            }
            return route.abort();
          });
          await page.goto(harness.origin + target);
          const root = page.locator(".acceptance-1688");
          await expect(root.getByRole("heading", { name: "尚未满足启用条件" })).toBeVisible();
          await expect(root.getByLabel("组织", { exact: true })).toHaveValue(
            acceptanceData.organizations[0].id,
          );
          await navigate(page, away);
          await expect(root).toHaveCount(0);
          await navigate(page, target);
          await expect(root).toBeVisible();
          await page.waitForTimeout(250);
          check("baseline acceptance reads after return", acceptanceReads, 1);
          check("baseline membership reads after return", membershipReads, 1);
          check("baseline workspace reads after return", workspaceReads, 1);
          check(
            "baseline returns cached 2 of 3 facts",
            await root.textContent().then((text) => text.includes("2 / 3")),
          );
          check(
            "baseline has no reactivation notice",
            await root.getByText(acceptanceLifecycleCopy.title).count(),
            0,
          );
          check("baseline no page runtime errors", pageErrors, []);
          baselineRuns.push({ width, checks, blockedReads });
        } finally {
          await context.close();
        }
      }
      for (const mod of harness.server.moduleGraph.idToModuleMap.values()) {
        const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
        if (
          file &&
          !file.startsWith("..") &&
          !file.includes("node_modules") &&
          /\.(vue|ts|css|json)$/.test(file)
        )
          loadedSources.add(file);
      }
    } finally {
      await harness.server.close();
    }
  }

  {
    const harness = await startServer("proposed");
    try {
      for (const width of widths) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 980 : 1080 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        try {
          const page = await context.newPage(),
            checks = [],
            pageErrors = [],
            unexpected = [],
            failedRequests = [],
            oldAcceptanceGate = deferred(),
            oldWorkspaceGate = deferred(),
            returnAcceptanceGate = deferred(),
            returnScopeGate = deferred(),
            requestKeys = [],
            check = (name, actual, expected = true) => {
              assert.deepEqual(actual, expected, `proposed/${width}:${name}`);
              checks.push({ name, actual });
            },
            picture = async (state) => {
              if (!capture) return;
              const file = `${width}-${state}.png`,
                bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
              await writeFile(`${output}/${file}`, bytes);
              screenshots.push({
                file,
                width,
                state,
                sha256: hash(bytes),
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
              });
            };
          let acceptanceReads = 0,
            membershipReads = 0,
            firstWorkspaceReads = 0,
            secondWorkspaceReads = 0,
            oldAcceptanceSettled = false,
            oldWorkspaceSettled = false;
          page.on("pageerror", (error) => pageErrors.push(error.message));
          page.on("requestfailed", (request) =>
            failedRequests.push(`${request.method()} ${new URL(request.url()).pathname}`),
          );
          await page.route("**/*", async (route) => {
            const request = route.request(),
              url = new URL(request.url()),
              key = `${request.method()} ${url.pathname}`;
            if (url.origin !== harness.origin) {
              unexpected.push(`external ${key}`);
              return route.abort();
            }
            if (!url.pathname.startsWith("/api/")) return route.continue();
            requestKeys.push(key);
            if (key === "GET /api/v1/me/navigation")
              return route.fulfill({ json: { data: navigation, request_id: "p49-nav" } });
            if (key === "GET /api/v1/auth/session-status")
              return route.fulfill({ json: { data: { authenticated: true } } });
            if (key === "GET /api/v1/platform/provider-sources/1688-acceptance") {
              acceptanceReads += 1;
              if (acceptanceReads === 1)
                return route.fulfill({
                  json: { data: acceptanceData.original, request_id: "p49-initial" },
                });
              if (acceptanceReads === 2) {
                await oldAcceptanceGate.promise;
                try {
                  await route.fulfill({
                    json: { data: staleAcceptance, request_id: "p49-stale-acceptance" },
                  });
                } catch (error) {
                  void error;
                }
                oldAcceptanceSettled = true;
                return;
              }
              assert.equal(acceptanceReads, 3, "one fresh acceptance read on return");
              await returnAcceptanceGate.promise;
              return route.fulfill({
                json: { data: returnedAcceptance, request_id: "p49-returned-acceptance" },
              });
            }
            if (key === "GET /api/v1/org/memberships") {
              membershipReads += 1;
              if (membershipReads === 2) await returnScopeGate.promise;
              return route.fulfill({
                json: {
                  data: [acceptanceData.organizations[0], secondOrganization],
                  request_id: `p49-memberships-${membershipReads}`,
                },
              });
            }
            if (key === `GET /api/v1/org/${acceptanceData.organizations[0].id}/workspaces`) {
              firstWorkspaceReads += 1;
              return route.fulfill({
                json: {
                  data: firstWorkspaceReads === 1 ? acceptanceData.workspaces : [returnedWorkspace],
                  request_id: `p49-first-workspaces-${firstWorkspaceReads}`,
                },
              });
            }
            if (key === `GET /api/v1/org/${secondOrganization.id}/workspaces`) {
              secondWorkspaceReads += 1;
              await oldWorkspaceGate.promise;
              try {
                await route.fulfill({
                  json: { data: [secondWorkspace], request_id: "p49-stale-workspace" },
                });
              } catch (error) {
                void error;
              }
              oldWorkspaceSettled = true;
              return;
            }
            if (request.method() === "GET") return route.abort("blockedbyclient");
            unexpected.push(key);
            return route.abort();
          });

          await page.goto(harness.origin + target);
          const root = page.locator(".p49-robustness"),
            organization = root.getByLabel("组织", { exact: true }),
            workspace = root.getByLabel("工作区", { exact: true });
          await expect(root.getByText("2 / 3", { exact: true })).toBeVisible();
          await expect(organization).toHaveValue(acceptanceData.organizations[0].id);
          await expect(workspace).toHaveValue(acceptanceData.workspaces[0].id);
          await organization.selectOption(secondOrganization.id);
          await expect.poll(() => secondWorkspaceReads).toBe(1);
          await root.getByRole("button", { name: "刷新检查结果" }).click();
          await expect.poll(() => acceptanceReads).toBe(2);

          await navigate(page, away);
          await expect(root).toHaveCount(0);
          oldAcceptanceGate.resolve();
          oldWorkspaceGate.resolve();
          await expect.poll(() => oldAcceptanceSettled).toBe(true);
          await expect.poll(() => oldWorkspaceSettled).toBe(true);
          await expect
            .poll(() =>
              failedRequests.includes("GET /api/v1/platform/provider-sources/1688-acceptance"),
            )
            .toBe(true);
          await expect
            .poll(() =>
              failedRequests.includes(`GET /api/v1/org/${secondOrganization.id}/workspaces`),
            )
            .toBe(true);

          await navigate(page, target);
          await expect(root).toBeVisible();
          await expect(
            root.getByText(acceptanceLifecycleCopy.title, { exact: true }),
          ).toBeVisible();
          await expect(
            root.getByText(acceptanceLifecycleCopy.boundary, { exact: true }),
          ).toBeVisible();
          await expect(root.getByText("2 / 3", { exact: true })).toBeVisible();
          await expect(root.getByText("3 / 3", { exact: true })).toHaveCount(0);
          await expect(organization).toBeDisabled();
          await picture("returned-refreshing");

          returnScopeGate.resolve();
          await expect(organization).toHaveValue(acceptanceData.organizations[0].id);
          await expect(workspace).toHaveValue(returnedWorkspace.id);
          await expect(workspace.locator("option:checked")).toHaveText(returnedWorkspace.name);
          returnAcceptanceGate.resolve();
          await expect(root.getByText("0 / 3", { exact: true })).toBeVisible();
          await expect(root.getByText(acceptanceLifecycleCopy.title, { exact: true })).toHaveCount(
            0,
          );
          await expect(root.getByText("刷新完成", { exact: true })).toBeVisible();
          await picture("returned-fresh");

          check(
            "old acceptance request aborted",
            failedRequests.includes("GET /api/v1/platform/provider-sources/1688-acceptance"),
          );
          check(
            "old workspace request aborted",
            failedRequests.includes(`GET /api/v1/org/${secondOrganization.id}/workspaces`),
          );
          check("fresh acceptance read on return", acceptanceReads, 3);
          check("fresh membership read on return", membershipReads, 2);
          check("fresh first-org workspace read on return", firstWorkspaceReads, 2);
          check("one stale second-org workspace read", secondWorkspaceReads, 1);
          check(
            "no acceptance writes",
            requestKeys.filter((key) => key.startsWith("POST ")).length,
            0,
          );
          check(
            "no horizontal overflow",
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
          );
          check("no unexpected or external requests", unexpected, []);
          check("no page runtime errors", pageErrors, []);
          proposedRuns.push({ width, checks, requestKeys, failedRequests });
        } finally {
          await context.close();
        }
      }
      for (const mod of harness.server.moduleGraph.idToModuleMap.values()) {
        const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
        if (
          file &&
          !file.startsWith("..") &&
          !file.includes("node_modules") &&
          /\.(vue|ts|css|json)$/.test(file)
        )
          loadedSources.add(file);
      }
    } finally {
      await harness.server.close();
    }
  }
} finally {
  await browser?.close();
}

if (capture) {
  const evidence = {
    kind: "P49-ACCEPTANCE-LIFECYCLE-REVIEW-r1",
    generatedAt: new Date().toISOString(),
    reviewOnly: true,
    productionChanged: false,
    deployed: false,
    baselineBoundary:
      "The untransformed actual App/router/NavigationShell/KeepAlive returned the cached P49 instance without a new acceptance, membership, or workspace GET at both widths. This is a local intercepted runtime reproduction, not a production incident claim.",
    proposedBoundary:
      "The review-only Vue transform invalidates and aborts acceptance and scope reads on deactivation, preserves the last successful facts while returning, rereads both surfaces on activation, and rejects late old results by sequence/controller ownership.",
    writeBoundary:
      "No POST was made. The proposal deliberately does not cancel or replay scheduleAcceptanceRun; write completion while away and unknown write-result policy remain separate work.",
    routeBoundary:
      "Navigation uses the exported real Vue router between registered P49 and P47 routes inside the actual KeepAlive shell. P47 data GETs are locally blocked because its business behavior is outside this batch.",
    baselineRuns,
    proposedRuns,
    screenshots,
    ports,
    sourceHashes: Object.fromEntries(
      await Promise.all(
        [...loadedSources].sort().map(async (file) => [file, hash(await read(file))]),
      ),
    ),
    processesClosed: true,
  };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      "<title>P49 缓存往返与迟到响应评审</title>",
      "<style>body{font:16px/1.7 sans-serif;margin:24px;background:#eef2f7;color:#172033}",
      "main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:24px}",
      "article{background:white;padding:12px}img{width:100%;height:560px;object-fit:cover;object-position:top}</style>",
      "<h1>P49 缓存往返与迟到响应</h1>",
      "<p>真实 App/Router/KeepAlive，本地拦截数据；评审变体不等于生产修复。</p><main>",
      ...screenshots.map(
        (shot) =>
          `<article><h2>${shot.width}px · ${shot.state}</h2><a href="${shot.file}"><img src="${shot.file}" alt="${shot.width}px ${shot.state}"></a></article>`,
      ),
      "</main></html>",
    ].join("\n"),
  );
}

console.log(
  `P49 lifecycle passed: ${baselineRuns.length} baseline, ${proposedRuns.length} proposed, ${screenshots.length} screenshots`,
);
