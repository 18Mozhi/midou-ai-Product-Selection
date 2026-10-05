import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildShellOrgFixture, orgFixtureFile } from "./lib/ui-phase2-shell-org-fixture.mjs";
import {
  buildProfileSaveResult,
  profileRepository,
} from "./lib/ui-phase2-org-save-feedback-preview.mjs";

assert.ok(
  process.argv.slice(2).length <= 1 &&
    process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)),
);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/org-save-feedback-vue-c-r3";
const shell = "apps/web/src/components/NavigationShell.vue",
  orgComponent = "apps/web/src/components/OrganizationAdminCenter.vue";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = await read(shell),
  orgSource = await read(orgComponent),
  fixture = await buildShellOrgFixture();
const saveResult = await buildProfileSaveResult(fixture.profile);
const sources = new Set([
  shell,
  orgComponent,
  orgFixtureFile,
  profileRepository,
  "scripts/lib/ui-phase2-shell-org-fixture.mjs",
  "scripts/lib/ui-phase2-org-save-feedback-preview.mjs",
  "scripts/verify-ui-phase2-org-save-feedback-vue-c.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [];
if (capture) await mkdir(output); // Fail closed: never overwrite a previous image packet.
let browser, server;
try {
  browser = await chromium.launch();
  for (const mode of ["actual"]) {
    const reserved = reservePort();
    await new Promise((done) => reserved.listen(0, "127.0.0.1", done));
    const port = reserved.address().port;
    await new Promise((done) => reserved.close(done));
    ports.push(port);
    const origin = `http://127.0.0.1:${port}`;
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
      plugins: [
        {
          name: "org-save-receipt-actual-vue",
          enforce: "pre",
          transform(text, id) {
            const file = id.replaceAll("\\", "/");
            if (
              file === path.resolve(orgComponent).replaceAll("\\", "/") &&
              text.replaceAll("\r\n", "\n") !== orgSource
            )
              throw new Error("OrganizationAdminCenter changed during actual Vue review");
            if (
              file === path.resolve(shell).replaceAll("\\", "/") &&
              text.replaceAll("\r\n", "\n") !== source
            )
              throw new Error("NavigationShell changed during actual Vue review");
            return null;
          },
        },
      ],
    });
    await server.listen();
    console.log(`Profile save ${mode} ${origin}`);
    for (const width of [390, 1440])
      for (const status of smoke ? [500] : [200, 500, 403]) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        let release = () => {};
        try {
          const page = await context.newPage(),
            requests = [],
            unexpected = [],
            errors = [],
            checks = [];
          page.setDefaultTimeout(15000);
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${mode}/${width}/${status}: ${name}`);
            checks.push({ name, actual });
          };
          const gate = new Promise((done) => {
            release = done;
          });
          let saved = false,
            recovering = false,
            summaryReads = 0;
          const writeId = "org-save-local-write",
            readId = `org-save-local-read-${status}`,
            recoveryReadId = `org-save-local-recovery-read-${status}`;
          const shot = async (scene, selector) => {
            if (!capture) return;
            const locator = page.locator(selector);
            await locator.evaluate((node) => node.scrollIntoView({ block: "center" }));
            await page.evaluate(() => document.fonts.ready);
            const bytes = await locator.screenshot({ animations: "disabled" });
            const file = `${mode}-${width}-${status}-${scene}.png`;
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              mode,
              width,
              status,
              scene,
              selector,
              sha256: hash(bytes),
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
            });
          };
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route("**/*", async (route) => {
            const req = route.request(),
              url = new URL(req.url()),
              key = `${req.method()} ${url.pathname}${url.search}`;
            if (url.origin !== origin) {
              unexpected.push("external");
              return route.abort();
            }
            if (!url.pathname.startsWith("/api/")) return route.continue();
            if (key === "PATCH /api/v1/org/admin/profile") {
              requests.push({
                key,
                body: req.postDataJSON(),
                hasIdempotency: !!req.headers()["idempotency-key"],
                hasRequest: !!req.headers()["x-request-id"],
              });
              saved = true;
              return route.fulfill({
                json: { data: saveResult, request_id: writeId, trace_id: writeId },
              });
            }
            const values = {
              "GET /api/v1/me/navigation?shell=organization_admin": fixture.navigation,
              "GET /api/v1/auth/session-status": { authenticated: true },
              "GET /api/v1/org/admin/summary": fixture.summary,
              "GET /api/v1/org/admin/profile": saved
                ? { ...fixture.profile, ...saveResult }
                : fixture.profile,
              "GET /api/v1/org/admin/workspaces": fixture.workspaces,
            };
            if (key === "GET /api/v1/me/ui-preferences") {
              requests.push({ key });
              return route.fulfill({ status: 500, json: {} });
            }
            if (!(key in values)) {
              unexpected.push(key);
              return route.abort();
            }
            requests.push({ key });
            if (key === "GET /api/v1/org/admin/summary") {
              summaryReads++;
              if (saved && !recovering) {
                await gate;
                if (status !== 200 && !recovering)
                  return route.fulfill({ status, json: { request_id: readId, trace_id: readId } });
              }
            }
            return route.fulfill({
              json: {
                data: values[key],
                request_id: saved
                  ? recovering
                    ? recoveryReadId
                    : readId
                  : "org-save-local-initial",
                trace_id: saved ? (recovering ? recoveryReadId : readId) : "org-save-local-initial",
              },
            });
          });
          await page.goto(origin + "/org-admin");
          await page.waitForSelector('.org-admin-center[data-state="ready"]');
          const form = page.locator(".org-admin-grid > form");
          await form.getByLabel("变更原因", { exact: true }).fill("本地保存反馈审核");
          await form.getByRole("button", { name: "保存并审计", exact: true }).click();
          await page.waitForFunction(() =>
            document.querySelector('.org-admin-center[aria-busy="true"]'),
          );
          check(
            "one PATCH before reread",
            requests.filter((r) => r.key.startsWith("PATCH ")).length,
            1,
          );
          const patch = requests.find((r) => r.key.startsWith("PATCH "));
          check("original PATCH payload", patch.body, {
            name: fixture.profile.name,
            logo_url: fixture.profile.logo_url ?? "",
            timezone: fixture.profile.timezone,
            data_retention_days: fixture.profile.data_retention_days,
            default_workspace_id: fixture.profile.default_workspace_id,
            reason: "本地保存反馈审核",
            expected_version: fixture.profile.version,
          });
          check("original request headers present", patch.hasIdempotency && patch.hasRequest);
          check(
            "save disabled while rereading",
            await form.getByRole("button", { name: "正在保存…", exact: true }).isDisabled(),
          );
          check(
            "old facts remain while waiting",
            await page.locator(".org-admin-metrics article").count(),
            6,
          );
          await page.waitForSelector('.org-profile-receipt[data-phase="pending"]');
          check(
            "no premature page updated claim",
            !(await page.locator(".org-profile-receipt").textContent()).includes("页面已更新"),
          );
          await shot("reread-pending", ".org-profile-receipt");
          release();
          await page.waitForSelector('.org-admin-center[aria-busy="false"]');
          await page.waitForFunction(
            () => !document.querySelector(".org-admin-grid > form > button:disabled"),
          );
          check(
            "result page state",
            await page.locator(".org-admin-center").getAttribute("data-state"),
            status === 403 ? "forbidden" : "ready",
          );
          check("permission withdraws form", await form.count(), status === 403 ? 0 : 1);
          if (status === 500)
            check(
              "failed reread retains old facts",
              await page.locator(".org-admin-metrics article").count(),
              6,
            );
          const receipt = page.locator(".org-profile-receipt");
          check(
            "receipt phase",
            await receipt.getAttribute("data-phase"),
            status === 200 ? "ready" : "failed",
          );
          check(
            "write trace preserved",
            await receipt.locator("code").first().textContent(),
            writeId,
          );
          check("read trace separate", await receipt.locator("code").last().textContent(), readId);
          check(
            "no generic saved notice masking read failure",
            await page.locator('.org-admin-notice[data-kind="success"]').count(),
            0,
          );
          if (status === 500)
            check(
              "failure request not overwritten",
              await page.locator(".org-admin-notice code").last().textContent(),
              readId,
            );
          await shot("result", ".org-profile-receipt");
          await receipt.locator("summary").focus();
          await page.keyboard.press("Enter");
          check(
            "keyboard expands trace",
            await receipt.locator("details").evaluate((node) => node.open),
          );
          await shot("trace", ".org-profile-receipt");
          check("exact automatic read count", summaryReads, 2);
          recovering = true;
          const reload = page.getByRole("button", {
            name: status === 403 ? "重新加载" : "刷新数据",
            exact: true,
          });
          await reload.click();
          await page.waitForSelector('.org-admin-center[data-state="ready"][aria-busy="false"]');
          check(
            "manual reread never resaves",
            requests.filter((r) => r.key.startsWith("PATCH ")).length,
            1,
          );
          check("manual reread once", summaryReads, 3);
          check(
            "manual reread restores name",
            await form.getByLabel("名称", { exact: true }).inputValue(),
            fixture.profile.name,
          );
          check(
            "original reason reset unchanged",
            await form.getByLabel("变更原因", { exact: true }).inputValue(),
            "",
          );
          if (status === 200) {
            check("new manual read clears old success receipt", await receipt.count(), 0);
          } else {
            check(
              "manual read receipt updated without resave",
              await receipt.getAttribute("data-phase"),
              "ready",
            );
            check(
              "write trace remains distinct",
              await receipt.locator("code").first().textContent(),
              writeId,
            );
            check(
              "recovery read trace is new",
              await receipt.locator("code").last().textContent(),
              recoveryReadId,
            );
          }
          check(
            "only expected local write",
            requests.filter((r) => !r.key.startsWith("GET ")).map((r) => r.key),
            ["PATCH /api/v1/org/admin/profile"],
          );
          check(
            "no overflow",
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          check("no unexpected network", unexpected, []);
          check("no runtime errors", errors, []);
          runs.push({ mode, width, status, checks, requests });
        } finally {
          release();
          await context.close();
        }
      }
    for (const mod of server.moduleGraph.idToModuleMap.values()) {
      const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
      if (
        file &&
        !file.startsWith("..") &&
        !file.includes("node_modules") &&
        /\.(vue|ts|css|json)$/.test(file)
      )
        sources.add(file);
    }
    await server.close();
    server = null;
  }
  await browser.close();
  browser = null;
  const evidence = {
    kind: "ORG-SAVE-FEEDBACK-VUE-C-r3",
    reviewOnly: false,
    userReview: "actual-vue-regression-local-fixture-not-production",
    processesClosed: true,
    ports,
    runs,
    screenshots,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    boundary:
      "Actual Vue component integrated through the real application shell with same-origin local API fixtures. PATCH success shape extracted from repository; local fixture, not a real persisted write or audit. Summary reread200/500/403 plus GET-only recovery; existing request/form/permission rules are asserted. This is component-level regression evidence only, not production data or broad acceptance.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>组织资料保存反馈实际 Vue 回归</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%}article{margin:32px 0}</style><h1>组织资料 · 保存结果与页面更新</h1><p>实际 Vue，本地测试样例；不代表真实保存、审计、权限或生产验收。</p><a href="evidence.json">机器证据</a>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.status} / ${s.scene}</h2><img loading="lazy" src="${s.file}" alt="${s.scene}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      ports,
      processesClosed: true,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
