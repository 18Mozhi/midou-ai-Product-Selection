import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./lib/ui-phase2-shell-vue-preview.mjs";
import {
  buildShellOrgFixture,
  orgFixtureFile,
  orgReviewCss,
} from "./lib/ui-phase2-shell-org-fixture.mjs";
import { previewOrgRefresh, orgRefreshCss } from "./lib/ui-phase2-org-refresh-preview.mjs";
import { previewOrgReadState, orgReadStateCss } from "./lib/ui-phase2-org-read-state-preview.mjs";
import {
  previewOrgProfileForm,
  orgProfileFormCss,
  buildProfileConflictFixture,
} from "./lib/ui-phase2-org-profile-form-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/org-profile-form-vue-c-r3";
const shell = "apps/web/src/components/NavigationShell.vue";
const orgComponent = "apps/web/src/components/OrganizationAdminCenter.vue";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = await read(shell),
  replacement = previewShellVue(source),
  fixture = await buildShellOrgFixture();
const orgSource = await read(orgComponent),
  orgReplacement = previewOrgProfileForm(orgSource);
const sources = new Set([
  shell,
  orgComponent,
  shellReviewCss,
  shellReviewModule,
  orgFixtureFile,
  orgReviewCss,
  orgRefreshCss,
  orgReadStateCss,
  orgProfileFormCss,
  "scripts/lib/ui-phase2-org-profile-form-preview.mjs",
  "scripts/lib/ui-phase2-org-read-state-preview.mjs",
  "scripts/lib/ui-phase2-org-refresh-preview.mjs",
  "scripts/verify-ui-phase2-org-profile-form-vue-c.mjs",
  "scripts/lib/ui-phase2-shell-org-fixture.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const conflictFixture = await buildProfileConflictFixture();
const runs = [],
  screenshots = [],
  ports = [];
if (capture) await mkdir(output); // Exclusive versioned deliverable, never overwrite a prior review.
let browser, server;
try {
  browser = await chromium.launch();
  for (const mode of smoke ? ["review"] : ["baseline", "review"]) {
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
          name: "org-summary-c-review-only",
          enforce: "pre",
          transform(text, id) {
            if (id.replaceAll("\\", "/") === path.resolve(orgComponent).replaceAll("\\", "/")) {
              assert.equal(text.replaceAll("\r\n", "\n"), orgSource);
              return {
                code: mode === "baseline" ? previewOrgReadState(orgSource) : orgReplacement,
                map: null,
              };
            }
            if (id.replaceAll("\\", "/") !== path.resolve(shell).replaceAll("\\", "/")) return null;
            assert.equal(text.replaceAll("\r\n", "\n"), source);
            return { code: replacement, map: null };
          },
          transformIndexHtml(html) {
            return html
              .replace(
                "<body>",
                '<body class="shell-vue-c org-refresh-c org-read-state-c org-profile-form-c">',
              )
              .replace(
                "</head>",
                [
                  shellReviewCss,
                  orgReviewCss,
                  orgRefreshCss,
                  orgReadStateCss,
                  ...(mode === "review" ? [orgProfileFormCss] : []),
                ]
                  .map(
                    (file) =>
                      `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
                  )
                  .join("") + "</head>",
              );
          },
        },
      ],
    });
    await server.listen();
    console.log(`Organization ${mode} ${origin}`);

    for (const width of [390, 1440]) {
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
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        let gate = new Promise((done) => {
          release = done;
        });
        const shot = async (scene, selector) => {
          if (!capture) return;
          await page.locator(selector).evaluate((n) => n.scrollIntoView({ block: "center" }));
          await page.evaluate(() => document.fonts.ready);
          let clip;
          if (selector.startsWith("label:")) {
            const bounds = await page.locator(selector).boundingBox();
            assert.ok(bounds);
            clip = {
              x: Math.max(0, bounds.x - 8),
              y: Math.max(0, bounds.y - 8),
              width: Math.min(width, bounds.x + bounds.width + 8) - Math.max(0, bounds.x - 8),
              height: bounds.height + 16,
            };
            assert.ok(
              clip.y + clip.height < 930,
              "Field crop must stay above fixed mobile navigation",
            );
          }
          const bytes = clip
            ? await page.screenshot({ clip, animations: "disabled" })
            : await page.locator(selector).screenshot({ animations: "disabled" });
          const file = `${mode}-${width}-${scene}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            mode,
            width,
            scene,
            selector,
            clip: clip ?? null,
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
          const values = {
            "GET /api/v1/me/navigation?shell=organization_admin": fixture.navigation,
            "GET /api/v1/auth/session-status": { authenticated: true },
            "GET /api/v1/org/admin/summary": fixture.summary,
            "GET /api/v1/org/admin/profile": fixture.profile,
            "GET /api/v1/org/admin/workspaces": fixture.workspaces,
          };
          if (key === "GET /api/v1/me/ui-preferences") {
            requests.push({ key, body: req.postData() });
            return route.fulfill({ status: 500, json: {} });
          }
          if (key === "PATCH /api/v1/org/admin/profile") {
            requests.push({
              key,
              body: req.postDataJSON(),
              hasIdempotency: !!req.headers()["idempotency-key"],
              hasRequest: !!req.headers()["x-request-id"],
            });
            await gate;
            return route.fulfill({ status: 409, json: conflictFixture });
          }
          if (!(key in values)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: req.postData() });
          return route.fulfill({
            json: { data: values[key], request_id: "org-form-local", trace_id: "org-form-local" },
          });
        });
        await page.goto(origin + "/org-admin");
        await page.waitForSelector('.org-admin-center[data-state="ready"]');
        const form = page.locator(".org-admin-grid > form"),
          save = form.getByRole("button", { name: "保存并审计", exact: true });
        const controls = {
          name: form.locator('input[maxlength="120"]'),
          logo_url: form.locator('input[type="url"]'),
          timezone: form.locator('input[maxlength="64"]'),
          data_retention_days: form.locator('input[type="number"]'),
          default_workspace_id: form.locator("select"),
          reason: form.locator("textarea"),
        };
        const restore = async () => {
          await controls.name.fill(fixture.profile.name);
          await controls.logo_url.fill(fixture.profile.logo_url);
          await controls.timezone.fill(fixture.profile.timezone);
          await controls.data_retention_days.fill(String(fixture.profile.data_retention_days));
          await controls.reason.fill("本地表单审核原因");
        };
        check("six original fields", await form.locator("input,select,textarea").count(), 6);
        check(
          "original native constraints",
          await form.locator("input,select,textarea").evaluateAll((nodes) =>
            nodes.map((n) => ({
              required: n.required,
              maxLength: n.maxLength ?? null,
              min: n.min ?? null,
              max: n.max ?? null,
              pattern: n.pattern ?? null,
            })),
          ),
          [
            { required: true, maxLength: 120, min: "", max: "", pattern: "" },
            { required: false, maxLength: 2048, min: "", max: "", pattern: "https://.*" },
            { required: true, maxLength: 64, min: "", max: "", pattern: "" },
            { required: true, maxLength: -1, min: "30", max: "3650", pattern: "" },
            { required: true, maxLength: null, min: null, max: null, pattern: null },
            { required: true, maxLength: 500, min: null, max: null, pattern: null },
          ],
        );
        const cases = [
          { key: "name", value: "", name: "name-required" },
          { key: "reason", value: "", name: "reason-required" },
          { key: "timezone", value: "", name: "timezone-required" },
          { key: "logo_url", value: "http://example.test/logo.png", name: "logo-https" },
          { key: "data_retention_days", value: "29", name: "retention-low" },
          { key: "data_retention_days", value: "3651", name: "retention-high" },
        ];
        for (const item of cases) {
          await restore();
          await controls[item.key].fill(item.value);
          await save.click();
          check(
            item.name + " blocks native submission",
            requests.filter((r) => r.key.startsWith("PATCH ")).length,
            0,
          );
          check(
            item.name + " invalid",
            await controls[item.key].evaluate((n) => !n.validity.valid),
          );
          check(
            item.name + " native focus",
            await controls[item.key].evaluate((n) => n === document.activeElement),
          );
          if (mode === "review") {
            await page.waitForFunction(
              (key) =>
                document
                  .querySelector('[data-profile-field="' + key + '"]')
                  ?.getAttribute("aria-invalid") === "true",
              item.key,
            );
            check(
              item.name + " linked visible error",
              await controls[item.key].evaluate((n) => {
                const id = n.getAttribute("aria-describedby").split(" ")[0],
                  message = document.getElementById(id);
                return !!message?.textContent.trim() && message.getClientRects().length > 0;
              }),
            );
            await page.keyboard.press("Escape");
            await page.keyboard.press("Tab");
            // Native browser validation bubbles are outside the DOM/CSS animation controls.
            // Capture the persistent inline error after a real keyboard blur and native fade.
            await page.waitForTimeout(250);
            check(
              item.name + " capture is after keyboard blur",
              await controls[item.key].evaluate((n) => n !== document.activeElement),
            );
            await shot(item.name, `label:has([data-profile-field="${item.key}"])`);
          }
          await restore();
          if (mode === "review") {
            await page.waitForFunction(
              (key) =>
                !document
                  .querySelector('[data-profile-field="' + key + '"]')
                  ?.hasAttribute("aria-invalid"),
              item.key,
            );
            check(
              item.name + " clears only presentation after valid input",
              await controls[item.key].evaluate((n) => ({
                valid: n.validity.valid,
                value: n.value,
                message: n.validationMessage,
              })),
              {
                valid: true,
                value: String(
                  item.key === "reason" ? "本地表单审核原因" : fixture.profile[item.key],
                ),
                message: "",
              },
            );
          }
        }
        await controls.logo_url.fill("");
        check(
          "optional logo may be empty",
          await controls.logo_url.evaluate((n) => n.validity.valid),
        );
        await restore();
        await controls.name.fill("本地版本冲突草稿");
        await save.focus();
        await page.keyboard.press("Enter");
        await page.waitForSelector(".org-admin-grid > form > button:disabled");
        check("one versioned PATCH", requests.filter((r) => r.key.startsWith("PATCH ")).length, 1);
        const patch = requests.find((r) => r.key.startsWith("PATCH "));
        check("original PATCH payload", patch.body, {
          name: "本地版本冲突草稿",
          logo_url: fixture.profile.logo_url,
          timezone: fixture.profile.timezone,
          data_retention_days: fixture.profile.data_retention_days,
          default_workspace_id: fixture.profile.default_workspace_id,
          reason: "本地表单审核原因",
          expected_version: fixture.profile.version,
        });
        check("idempotency and request headers present", patch.hasIdempotency && patch.hasRequest);
        const focus = await page.evaluate(() => ({
          tag: document.activeElement.tagName,
          body: document.activeElement === document.body,
          heading: document.activeElement === document.querySelector(".org-admin-grid > form h3"),
        }));
        checks.push({ name: "saving focus observation", actual: focus });
        if (mode === "review") check("saving keeps visible heading focus", focus.heading);
        await page.keyboard.press("Enter");
        check(
          "repeat Enter does not resubmit",
          requests.filter((r) => r.key.startsWith("PATCH ")).length,
          1,
        );
        await shot("saving", ".org-admin-grid > form");
        release();
        await page.waitForSelector('.org-admin-notice[data-kind="error"]');
        await page.waitForSelector(".org-admin-grid > form > button:not(:disabled)");
        check(
          "conflict keeps form ready",
          await page.locator(".org-admin-center").getAttribute("data-state"),
          "ready",
        );
        check(
          "conflict retains submitted draft",
          await controls.name.inputValue(),
          "本地版本冲突草稿",
        );
        check("conflict retains reason", await controls.reason.inputValue(), "本地表单审核原因");
        check(
          "conflict shows actual existing message",
          await page
            .locator(".org-admin-notice")
            .textContent()
            .then((t) => t.includes("数据已被其他操作更新")),
        );
        check(
          "no automatic PATCH retry",
          requests.filter((r) => r.key.startsWith("PATCH ")).length,
          1,
        );
        check(
          "no automatic reread on conflict",
          requests.filter((r) => r.key === "GET /api/v1/org/admin/summary").length,
          1,
        );
        await page.locator(".org-admin-notice summary").click();
        check(
          "original conflict request retained",
          await page.locator(".org-admin-notice code").textContent(),
          conflictFixture.request_id,
        );
        await shot("conflict", ".org-admin-notice");
        if (mode === "review") await shot("draft-after-conflict", ".org-admin-grid > form");
        check(
          "no save success claim",
          await page.locator('.org-admin-notice[data-kind="success"]').count(),
          0,
        );
        check(
          "only expected local writes",
          requests.filter((r) => !r.key.startsWith("GET ")).map((r) => r.key),
          ["PATCH /api/v1/org/admin/profile"],
        );
        check(
          "no overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ mode, width, checks, requests });
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
  await includeImportedStyleSources(sources, (file) =>
    file.startsWith("apps/web/src/") ? read(file) : "",
  );
  await browser.close();
  browser = null;
  const evidence = {
    kind: "ORG-PROFILE-FORM-VUE-C-r3",
    reviewOnly: true,
    userReview: "pending",
    processesClosed: true,
    ports,
    runs,
    screenshots,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    boundary:
      "Actual App and current organization profile; baseline prior read-state proposal. Adds only native-validity presentation and own-submitter focus; original constraints, PATCH payload/version/idempotency and409 fixture. Local intercepted PATCH only, no production changes or actual save/audit proof. Draft policy unchanged; no approval of other states.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>组织资料表单审核</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%}article{margin:32px 0}</style><h1>组织资料 · 校验与保存冲突</h1><p>本地测试样例，待审核；只核对展示区域，不代表保存、真实权限、其他页面或生产验收。</p><a href="evidence.json">机器证据</a>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.scene}</h2><img loading="lazy" src="${s.file}" alt="${s.mode} ${s.width} ${s.scene}"></article>`,
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
