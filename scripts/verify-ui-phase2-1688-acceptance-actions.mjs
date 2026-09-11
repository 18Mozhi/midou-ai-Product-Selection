import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildAcceptanceDesignData } from "./lib/ui-phase2-1688-acceptance-design-data.mjs";
import {
  acceptanceActionCopy,
  previewAlibaba1688AcceptanceActions,
} from "./lib/ui-phase2-1688-acceptance-actions-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p49-acceptance-actions-review",
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  styles = [
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-page-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-read-states-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-actions-preview.css",
  ],
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewAlibaba1688AcceptanceActions(source),
  { data: acceptanceData } = await buildAcceptanceDesignData(process.cwd());

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
  scenes = [
    { name: "scope-loading", mode: "scope-loading" },
    { name: "no-active-organizations", mode: "no-organizations" },
    { name: "organizations-failed", mode: "organizations-failed" },
    { name: "workspace-loading", mode: "workspace-loading" },
    { name: "no-active-workspaces", mode: "no-workspaces" },
    { name: "workspaces-failed", mode: "workspaces-failed" },
    { name: "query-filled", mode: "query-filled" },
    { name: "submission-in-progress", mode: "submitting" },
    { name: "submission-succeeded", mode: "succeeded" },
    { name: "submission-failed", mode: "submit-failed" },
    { name: "submission-forbidden", mode: "submit-forbidden" },
    { name: "submission-session-expired", mode: "submit-expired" },
    { name: "submitted-reread-failed", mode: "reread-failed" },
  ],
  widths = [390, 760, 1024, 1440],
  errorPayload = (status, scope = "request") => ({
    error: {
      code:
        status === 401
          ? "session_expired"
          : status === 403
            ? "permission_denied"
            : "dependency_unavailable",
      message:
        status === 401
          ? "登录状态已失效"
          : status === 403
            ? "当前账号没有提交验收运行的权限"
            : `${scope === "scope" ? "执行范围" : scope === "read" ? "启用检查" : "验收任务"}服务暂不可用`,
      action_hint:
        status === 401
          ? "请重新登录后再提交。"
          : status === 403
            ? "如需提交，请联系平台管理员调整权限。"
            : `请稍后重新${scope === "scope" ? "读取执行范围" : scope === "read" ? "读取检查结果" : "提交"}。`,
    },
    request_id: `p49-action-${scope}-${status}`,
    trace_id: `p49-action-${scope}-${status}`,
  }),
  loadedSources = new Set([
    component,
    ...styles,
    fixture,
    "scripts/lib/ui-phase2-1688-acceptance-design-data.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-page-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-read-states-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-actions-preview.mjs",
    "scripts/verify-ui-phase2-1688-acceptance-actions.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];

let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  const reservation = reservePort();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  ports.push(port);
  const origin = `http://127.0.0.1:${port}`;
  server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
    plugins: [
      {
        name: "p49-acceptance-actions-review-only",
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
          if (normalized !== path.resolve(component).replaceAll("\\", "/")) return null;
          assert.equal(text.replaceAll("\r\n", "\n"), source);
          return { code: replacement, map: null };
        },
        transformIndexHtml(html) {
          const links = styles
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace(
              "<body>",
              '<body class="p49-acceptance-review p49-acceptance-read-review p49-acceptance-actions-review">',
            )
            .replace("</head>", `${links}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P49 acceptance actions ${origin}`);

  for (const width of widths)
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 980 : 1080 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          pageErrors = [],
          consoleErrors = [],
          checks = [],
          check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          },
          picture = async (suffix = "full") => {
            if (!capture) return;
            const file = `${width}-${scene.name}-${suffix}.png`,
              bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              width,
              scene: scene.name,
              suffix,
              sha256: hash(bytes),
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
            });
          };
        let membershipReads = 0,
          workspaceReads = 0,
          acceptanceReads = 0,
          postCount = 0,
          releaseScope,
          releasePost;
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push(`external ${key}`);
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const allowed = [
            "GET /api/v1/me/navigation",
            "GET /api/v1/auth/session-status",
            "GET /api/v1/platform/provider-sources/1688-acceptance",
            "GET /api/v1/org/memberships",
            `GET /api/v1/org/${acceptanceData.organizations[0].id}/workspaces`,
            `POST /api/v1/platform/provider-sources/${acceptanceData.original.provider_id}/replays`,
          ];
          if (!allowed.includes(key)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({
            key,
            body: request.postDataJSON?.() ?? request.postData(),
            idempotencyKey: request.headers()["idempotency-key"] ?? "",
          });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: navigation, request_id: "p49-navigation" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/org/memberships")) {
            membershipReads += 1;
            if (scene.mode === "scope-loading")
              await new Promise((resolve) => {
                releaseScope = resolve;
              });
            if (scene.mode === "organizations-failed")
              return route.fulfill({ status: 503, json: errorPayload(503, "scope") });
            return route.fulfill({
              json: {
                data: scene.mode === "no-organizations" ? [] : acceptanceData.organizations,
                request_id: "p49-organizations",
              },
            });
          }
          if (url.pathname.includes("/workspaces")) {
            workspaceReads += 1;
            if (scene.mode === "workspace-loading")
              await new Promise((resolve) => {
                releaseScope = resolve;
              });
            if (scene.mode === "workspaces-failed")
              return route.fulfill({ status: 503, json: errorPayload(503, "scope") });
            return route.fulfill({
              json: {
                data: scene.mode === "no-workspaces" ? [] : acceptanceData.workspaces,
                request_id: "p49-workspaces",
              },
            });
          }
          if (request.method() === "POST") {
            postCount += 1;
            if (scene.mode === "submitting")
              await new Promise((resolve) => {
                releasePost = resolve;
              });
            if (scene.mode === "submit-failed")
              return route.fulfill({ status: 503, json: errorPayload(503) });
            if (scene.mode === "submit-forbidden")
              return route.fulfill({ status: 403, json: errorPayload(403) });
            if (scene.mode === "submit-expired")
              return route.fulfill({ status: 401, json: errorPayload(401) });
            return route.fulfill({
              status: 202,
              json: { data: acceptanceData.scheduled, request_id: "p49-task-created" },
            });
          }
          acceptanceReads += 1;
          if (scene.mode === "reread-failed" && acceptanceReads > 1)
            return route.fulfill({ status: 503, json: errorPayload(503, "read") });
          return route.fulfill({
            json: { data: acceptanceData.original, request_id: `p49-${scene.name}` },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources/1688-acceptance");
        const root = page.locator(".p49-acceptance"),
          form = root.locator(".p49-action"),
          organization = form.getByLabel("组织", { exact: true }),
          workspace = form.getByLabel("工作区", { exact: true }),
          query = form.getByLabel("验收关键词"),
          submit = form.locator('button[type="submit"]');
        await expect(root.getByRole("heading", { name: "尚未满足启用条件" })).toHaveCount(1);
        await expect(form.getByText(acceptanceActionCopy.requirements)).toBeVisible();
        await expect(submit).toHaveAttribute("aria-describedby", "p49-run-requirements");
        await expect(query).toHaveAttribute("aria-describedby", "p49-query-help");

        if (["scope-loading", "workspace-loading"].includes(scene.mode)) {
          await expect(form.getByText("正在读取可用执行范围…")).toBeVisible();
          await expect(organization).toBeDisabled();
          await expect(workspace).toBeDisabled();
          await expect(submit).toBeDisabled();
        } else if (
          [
            "no-organizations",
            "organizations-failed",
            "no-workspaces",
            "workspaces-failed",
          ].includes(scene.mode)
        ) {
          await expect(form.getByText(acceptanceActionCopy.scopeFailure)).toBeVisible();
          await expect(form.getByRole("button", { name: "重新读取执行范围" })).toBeVisible();
          await expect(submit).toBeDisabled();
          const invalid = ["no-organizations", "organizations-failed"].includes(scene.mode)
            ? organization
            : workspace;
          await expect(invalid).toHaveAttribute("aria-invalid", "true");
          await expect(invalid).toHaveAttribute("aria-describedby", "p49-scope-message");
        } else {
          await expect(organization).toHaveValue(acceptanceData.organizations[0].id);
          await expect(workspace).toHaveValue(acceptanceData.workspaces[0].id);
          await query.fill("桌面灯");
          await expect(submit).toBeEnabled();
          if (scene.mode !== "query-filled") await submit.click();
          if (scene.mode === "submitting") {
            await expect(form.getByText("正在创建一次受控验收运行，请稍候。")).toBeVisible();
            await expect(organization).toBeDisabled();
            await expect(workspace).toBeDisabled();
            await expect(query).toBeDisabled();
            await expect(submit).toBeDisabled();
            await expect(submit).toHaveText("提交中…");
          } else if (["succeeded", "reread-failed"].includes(scene.mode)) {
            await expect(form.getByText(acceptanceActionCopy.taskCreated)).toBeVisible();
            await expect(form.getByText(acceptanceActionCopy.taskBoundary)).toBeVisible();
            await expect(form.getByText(acceptanceData.scheduled.task_id)).not.toBeVisible();
            if (scene.mode === "reread-failed") {
              await expect(form.getByText(acceptanceActionCopy.rereadFailure)).toBeVisible();
              await expect(root.getByText(acceptanceActionCopy.rereadPreserved)).toBeVisible();
              await expect(root.getByText("已显示最新启用条件")).toHaveCount(0);
              await expect(root.getByRole("button", { name: "重新刷新" })).toBeVisible();
            } else
              check(
                "dual reread warning absent on clean success",
                await form.getByText(acceptanceActionCopy.rereadFailure).count(),
                0,
              );
          } else if (["submit-failed", "submit-forbidden", "submit-expired"].includes(scene.mode)) {
            await expect(form.getByText(acceptanceActionCopy.submitFailure)).toBeVisible();
            await expect(query).toHaveAttribute("aria-invalid", "true");
            await expect(query).toHaveAttribute(
              "aria-describedby",
              "p49-query-help p49-submit-message",
            );
            await expect(submit).toBeEnabled();
            check(
              "task result absent after failed POST",
              await form.getByText(acceptanceActionCopy.taskCreated).count(),
              0,
            );
          } else await expect(submit).toBeEnabled();
        }

        const expectedMembershipReads = scene.mode === "organizations-failed" ? 3 : 1,
          expectedWorkspaceReads = [
            "scope-loading",
            "no-organizations",
            "organizations-failed",
          ].includes(scene.mode)
            ? 0
            : scene.mode === "workspaces-failed"
              ? 3
              : 1,
          expectedPosts = [
            "submitting",
            "succeeded",
            "submit-failed",
            "submit-forbidden",
            "submit-expired",
            "reread-failed",
          ].includes(scene.mode)
            ? 1
            : 0,
          expectedAcceptanceReads =
            scene.mode === "succeeded" ? 2 : scene.mode === "reread-failed" ? 4 : 1;
        check("expected membership GET count", membershipReads, expectedMembershipReads);
        check("expected workspace GET count", workspaceReads, expectedWorkspaceReads);
        check("expected acceptance GET count", acceptanceReads, expectedAcceptanceReads);
        check("expected acceptance POST count", postCount, expectedPosts);
        const post = requests.find((request) => request.key.startsWith("POST "));
        if (post) {
          check("exact acceptance body", post.body, {
            organization_id: acceptanceData.organizations[0].id,
            workspace_id: acceptanceData.workspaces[0].id,
            query: "桌面灯",
            acceptance_run: true,
          });
          check("idempotency key present", Boolean(post.idempotencyKey));
        }
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        const controls = [organization, workspace, query, submit];
        if (form.getByRole("button", { name: "重新读取执行范围" })) {
          const retry = form.getByRole("button", { name: "重新读取执行范围" });
          if ((await retry.count()) > 0) controls.push(retry);
        }
        check(
          "44px representative controls",
          await Promise.all(
            controls.map(async (locator) => {
              const bounds = await locator.boundingBox();
              return Boolean(bounds && bounds.height >= 44);
            }),
          ),
          controls.map(() => true),
        );
        check("no unknown network", unexpected, []);
        check("no page runtime errors", pageErrors, []);
        const expectedConsoleErrors =
          scene.mode === "organizations-failed" || scene.mode === "workspaces-failed"
            ? 3
            : ["submit-failed", "submit-forbidden", "submit-expired"].includes(scene.mode)
              ? 1
              : scene.mode === "reread-failed"
                ? 3
                : 0;
        check("expected HTTP console errors", consoleErrors.length, expectedConsoleErrors);
        check(
          "console errors are expected HTTP responses",
          consoleErrors.every((message) => message.includes("Failed to load resource")),
        );
        check(
          "no unexpected writes",
          requests.filter((request) => request.key.startsWith("POST ")).length,
          expectedPosts,
        );
        await picture();
        if (width === 390 && ["succeeded", "reread-failed"].includes(scene.mode)) {
          await form.getByText("查看任务编号").click();
          await expect(form.getByText(acceptanceData.scheduled.task_id)).toBeVisible();
          await picture("task-details");
        }
        runs.push({
          width,
          scene: scene.name,
          mode: scene.mode,
          requestCount: requests.length,
          checks,
        });
        releaseScope?.();
        releasePost?.();
      } finally {
        await context.close();
      }
    }
} finally {
  await browser?.close();
  await server?.close();
}

if (capture) {
  const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...loadedSources].sort().map(async (file) => [file, hash(await read(file))]),
      ),
    ),
    evidence = {
      kind: "P49-ACCEPTANCE-ACTIONS-REVIEW-r1",
      generatedAt: new Date().toISOString(),
      reviewOnly: true,
      productionChanged: false,
      deployed: false,
      fixtureNotice:
        "Acceptance and scope facts are parsed from authoritative E2E fixtures. Empty/error/held/success variants are local review fixtures following the actual component and ApiClientError contracts.",
      behaviorBoundary:
        "Only the explicit acceptance POST scenes write to the intercepted local route. No enable/disable, polling, database write, permission mutation, credential access, external request, or deployment was performed.",
      accessibilityBoundary:
        "Review-only markup associates range errors with the invalid select, submission errors with the query, describes the disabled submit requirement, announces loading/submitting/feedback, and uses native buttons/details.",
      layoutMechanicalScan: {
        status: "not_run",
        reason:
          "The optional external scanner did not finish first-use initialization and remains unclaimed.",
        substituteChecks: [
          "Vue SFC compile",
          "PostCSS parse and selector isolation",
          "four responsive widths",
          "document overflow",
          "44px representative targets",
          "ARIA description and invalid ownership",
          "exact POST body and idempotency key",
          "safe GET retry and request counts",
          "dual submission/reread feedback",
        ],
      },
      widths,
      runs,
      screenshots,
      sourceHashes,
      ports,
      processesClosed: true,
    };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const cards = screenshots
    .map(
      (shot) =>
        `<article><a href="${shot.file}"><img src="${shot.file}" alt="${shot.width} ${shot.scene} ${shot.suffix}"></a><h2>${shot.scene}</h2><p>${shot.width}px · ${shot.suffix}</p></article>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P49 范围与提交状态评审</title><style>body{margin:0;padding:24px;background:#eef2f7;color:#172033;font-family:system-ui,sans-serif}header{max-width:1440px;margin:auto auto 24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px;max-width:1440px;margin:auto}article{background:white;padding:12px;border-radius:10px;box-shadow:0 8px 24px #173b6920}img{width:100%;height:520px;object-fit:cover;object-position:top;border:1px solid #dbe2ed}h1{margin:.2em 0}h2{font-size:16px;margin:10px 0 4px}p{color:#60708a;margin:0}</style><header><p>P49 / review only</p><h1>1688 执行范围与验收提交状态</h1><p>真实 Vue 路由；空值、错误和排队结果为明确标注的本地评审夹具。点击查看完整长图。</p></header><main>${cards}</main></html>`,
  );
}

console.log(
  `P49 actions passed: ${runs.length} runs, ${runs.reduce((sum, run) => sum + run.checks.length, 0)} checks, ${screenshots.length} screenshots`,
);
