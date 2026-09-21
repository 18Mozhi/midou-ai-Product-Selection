import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./lib/ui-phase2-shell-vue-preview.mjs";
import { buildShellOrgFixture, orgFixtureFile } from "./lib/ui-phase2-shell-org-fixture.mjs";
import { buildOrgApprovalsDesignData } from "./lib/ui-phase2-org-approvals-design-data.mjs";
import {
  approvalsVueFile,
  approvalsVueCss,
  previewApprovalsVue,
} from "./lib/ui-phase2-org-approvals-vue-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((a) => ["--smoke", "--capture"].includes(a)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke"),
  output = "output/playwright/p34-approvals-vue-c-r4";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const shellFile = "apps/web/src/components/NavigationShell.vue";
const originals = new Map(
  await Promise.all([shellFile, approvalsVueFile].map(async (f) => [f, await read(f)])),
);
const replacements = new Map([
  [shellFile, previewShellVue(originals.get(shellFile))],
  [approvalsVueFile, previewApprovalsVue(originals.get(approvalsVueFile))],
]);
const fixture = await buildShellOrgFixture(),
  data = await buildOrgApprovalsDesignData(process.cwd());
const originalData = { summary: data.summary, items: data.items, templates: data.templates };
const sources = new Set([
  ...originals.keys(),
  shellReviewCss,
  shellReviewModule,
  approvalsVueCss,
  orgFixtureFile,
  "scripts/verify-ui-phase2-org-approvals-vue-c.mjs",
  "scripts/lib/ui-phase2-org-approvals-vue-preview.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-phase2-shell-org-fixture.mjs",
  "scripts/lib/ui-phase2-org-approvals-design-data.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/api/src/mysql-organization-admin-repository.ts",
  "apps/api/src/organization-admin-service.ts",
  "docs/openapi.yaml",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [],
  baselineStyles = new Map();
if (capture) await mkdir(output);
let browser, server;
try {
  browser = await chromium.launch();
  for (const mode of ["baseline", "review"]) {
    const reservation = reservePort();
    await new Promise((done) => reservation.listen(0, "127.0.0.1", done));
    const port = reservation.address().port;
    await new Promise((done) => reservation.close(done));
    ports.push(port);
    const origin = `http://127.0.0.1:${port}`;
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
      plugins: [
        {
          name: "p34-real-c-review",
          enforce: "pre",
          transform(text, id) {
            const file = path.relative(process.cwd(), id).replaceAll("\\", "/");
            if (!replacements.has(file) || (mode === "baseline" && file === approvalsVueFile))
              return null;
            assert.equal(text.replaceAll("\r\n", "\n"), originals.get(file));
            return { code: replacements.get(file), map: null };
          },
          transformIndexHtml(html) {
            return html
              .replace("<body>", '<body class="shell-vue-c approvals-vue-c">')
              .replace(
                "</head>",
                [shellReviewCss, ...(mode === "review" ? [approvalsVueCss] : [])]
                  .map(
                    (f) =>
                      `<link rel="stylesheet" href="/@fs/${path.resolve(f).replaceAll("\\", "/")}">`,
                  )
                  .join("") + "</head>",
              );
          },
        },
      ],
    });
    await server.listen();
    console.log(JSON.stringify({ mode, origin }));
    for (const width of smoke
      ? [390]
      : mode === "baseline"
        ? [390, 760]
        : [390, 760, 761, 840, 841, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          checks = [],
          requests = [],
          unexpected = [],
          errors = [];
        let payload = structuredClone(originalData),
          failure = 0;
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        page.setDefaultTimeout(15000);
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = request.method() + " " + url.pathname + url.search;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          requests.push({ key, body: request.postData() });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ status: 500, json: {} });
          if (key === "GET /api/v1/org/admin/approvals" && failure)
            return route.fulfill({ status: failure, json: {} });
          const values = {
            "GET /api/v1/me/navigation?shell=organization_admin": fixture.navigation,
            "GET /api/v1/auth/session-status": { authenticated: true },
            "GET /api/v1/org/admin/summary": fixture.summary,
            "GET /api/v1/org/admin/approvals": payload,
          };
          if (!(key in values)) {
            unexpected.push(key);
            return route.abort();
          }
          return route.fulfill({
            json: { data: values[key], request_id: "p34-local-read", trace_id: "p34-local-read" },
          });
        });
        const shot = async (scene, selector) => {
          if (!capture || mode !== "review") return;
          await page.evaluate(() => document.fonts.ready);
          if (
            [
              "template-detail",
              "first-version",
              "mixed-version-diff",
              "cross-page-selection",
              "unchanged-version",
            ].includes(scene)
          ) {
            const height = Math.max(
              1000,
              Math.ceil((await page.locator(selector).boundingBox()).height) + 220,
            );
            assert.ok(height <= 4000, "Inspect unusually tall template detail");
            await page.setViewportSize({ width, height });
          }
          if (selector)
            await page.locator(selector).evaluate((n) =>
              scrollTo({
                top: scrollY + n.getBoundingClientRect().top - 60,
                behavior: "instant",
              }),
            );
          else await page.evaluate(() => scrollTo(0, 0));
          const bytes = await page.screenshot({ animations: "disabled", fullPage: false }),
            file = width + "-" + scene + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            file,
            width,
            scene,
            sha256: hash(bytes),
            viewport: page.viewportSize(),
          });
          await page.setViewportSize({ width, height: 1000 });
        };
        const signature = (locator) =>
          locator.evaluate((n) =>
            [n, ...n.querySelectorAll("*")].map((e) => {
              const s = getComputedStyle(e);
              return {
                tag: e.tagName,
                props: [
                  "display",
                  "color",
                  "backgroundColor",
                  "fontFamily",
                  "fontSize",
                  "lineHeight",
                  "paddingTop",
                  "paddingRight",
                  "borderTopColor",
                  "borderTopWidth",
                  "borderRadius",
                  "gap",
                ].map((k) => s[k]),
              };
            }),
          );
        await page.goto(origin + "/org-admin/approvals");
        const panel = page.locator(".org-approval-governance"),
          nav = panel.locator(".org-approval-section-tabs");
        await panel.waitFor();
        check(
          "ten original approvals",
          await panel.locator(".org-approval-metrics b").first().textContent(),
          "10",
        );
        check(
          "eight request rows on first page",
          await panel.locator(".org-approval-request-list > article").count(),
          8,
        );
        await shot("requests-default");
        const row = panel.locator(".org-approval-request-list > article").first();
        await row.locator("summary").focus();
        await page.keyboard.press("Enter");
        check(
          "request technical details keyboard expandable",
          await row.locator("details").getAttribute("open"),
          "",
        );
        await shot("request-technical", ".org-approval-request-list");
        await panel
          .locator(".org-approval-pagination")
          .getByRole("button", { name: "下一页", exact: true })
          .click();
        check(
          "request pagination retains two remaining rows",
          await panel.locator(".org-approval-request-list > article").count(),
          2,
        );
        await nav.getByRole("button", { name: /模板版本/ }).focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(/approval_view=templates/);
        const filters = panel.locator(".org-approval-template-filters-c"),
          directory = panel.locator(".org-approval-template-directory"),
          detail = panel.locator(".org-approval-template-detail");
        if (width <= 760) {
          const styles = await signature(filters);
          if (mode === "baseline") baselineStyles.set(width + "-filters", styles);
          else
            check(
              "approved mobile filter style signature retained",
              styles,
              baselineStyles.get(width + "-filters"),
            );
        }
        check("original two templates", await directory.locator(":scope > button").count(), 2);
        await shot("templates-default");
        const changedVersionButton = directory.locator(":scope > button").filter({
          hasText: data.templates.find((template) => template.version_diff.from_version).name,
        });
        await changedVersionButton.click();
        await shot("template-detail", ".org-approval-template-detail");
        const firstVersionButton = directory.locator(":scope > button").filter({
          hasText: data.templates.find((template) => !template.version_diff.from_version).name,
        });
        await firstVersionButton.click();
        check(
          "template selection uses actual source id",
          await firstVersionButton.getAttribute("aria-pressed"),
          "true",
        );
        check("first-version boundary explicit", (await detail.textContent()).includes("首个"));
        await shot("first-version", ".org-approval-template-detail");
        await filters.locator('input[type="search"]').fill("找不到的审核模板");
        await page.waitForSelector(".org-template-empty-c");
        if (width <= 760) {
          const styles = await signature(panel.locator(".org-template-empty-c"));
          if (mode === "baseline") baselineStyles.set(width + "-empty", styles);
          else
            check(
              "approved mobile empty style signature retained",
              styles,
              baselineStyles.get(width + "-empty"),
            );
        }
        await shot("template-empty", ".org-template-empty-c");
        if (width <= 760) {
          await panel.getByRole("button", { name: "清除筛选", exact: true }).click();
          check(
            "approved clear returns to template input",
            await filters.locator("input").evaluate((n) => n === document.activeElement),
          );
        } else await filters.getByRole("button", { name: "重置", exact: true }).click();
        if (mode === "review") {
          for (const [selector, property, expected] of [
            ['.org-approval-section-tabs button[aria-pressed="true"]', "boxShadow", "none"],
            [".org-approval-template-directory", "backgroundColor", "rgb(255, 255, 255)"],
            [".org-approval-template-directory > button.is-selected", "boxShadow", "none"],
            [".org-admin-refresh button", "backgroundColor", "rgb(37, 74, 156)"],
            [".org-approval-c-index-title span", "backgroundColor", "rgba(0, 0, 0, 0)"],
            [".org-approval-template-detail > dl > div", "backgroundColor", "rgba(0, 0, 0, 0)"],
            [".org-approval-version-diff > header span", "color", "rgb(37, 74, 156)"],
            [".org-approval-pagination", "backgroundColor", "rgba(0, 0, 0, 0)"],
            [".org-approval-links span", "color", "rgb(37, 74, 156)"],
            [".org-approval-template-detail", "fontFamily", '"Microsoft YaHei", sans-serif'],
          ]) {
            check(
              `C residual style ${selector}/${property}`,
              await page
                .locator(selector)
                .first()
                .evaluate((n, key) => getComputedStyle(n)[key], property),
              expected,
            );
          }
          check(
            "C blue view directory",
            await nav.evaluate((n) => getComputedStyle(n).backgroundColor),
            "rgb(37, 74, 156)",
          );
          payload.templates = Array.from({ length: 8 }, (_, i) => ({
            ...originalData.templates[0],
            id: "p34-synthetic-template-" + i,
            name: "合成模板 " + String(i + 1).padStart(2, "0"),
            version_diff:
              i === 0
                ? data.multiDiff
                : i === 1
                  ? data.noDiff
                  : originalData.templates[0].version_diff,
          }));
          await page
            .locator(".org-admin-hero")
            .getByRole("button", { name: "刷新数据", exact: true })
            .click();
          await page.waitForFunction(
            () =>
              document.querySelectorAll(".org-approval-template-directory > button").length === 6,
          );
          check(
            "synthetic mixed diff has three ordinal entries",
            await detail.locator(".org-approval-version-diff > article").count(),
            3,
          );
          check(
            "before/after values are explicitly labelled",
            await detail.locator("del small").allTextContents(),
            ["变更前", "变更前", "变更前", "变更前"],
          );
          await shot("mixed-version-diff", ".org-approval-template-detail");
          await directory.locator(":scope > button").nth(1).click();
          check(
            "unchanged prior version remains explicit",
            (await detail.locator(".org-approval-diff-empty").textContent()).includes("均未变化"),
          );
          await shot("unchanged-version", ".org-approval-template-detail");
          await directory.getByRole("button", { name: "下一页", exact: true }).click();
          check(
            "template second page has two entries",
            await directory.locator(":scope > button").count(),
            2,
          );
          check(
            "cross-page detail selection is disclosed",
            await detail.locator(".org-approval-c-selection-note").count(),
            1,
          );
          await shot("cross-page-selection", ".org-approval-template-browser");
          for (const status of [500, 429]) {
            failure = status;
            await page.reload();
            await page.waitForSelector(
              '.org-admin-center[data-state="' + (status === 500 ? "error" : "rate_limited") + '"]',
            );
            check(status + " first failure hides child", await panel.count(), 0);
            if (width <= 760) {
              check(
                status + " approved failure card retained",
                await page.locator(".org-approval-first-failure-c").isVisible(),
              );
              await shot("first-" + status, ".org-approval-first-failure-c");
            }
            failure = 0;
            const retry = page
              .locator(width <= 760 ? ".org-approval-first-failure-c" : ".org-admin-state")
              .getByRole("button", { name: "重新加载", exact: true });
            await retry.click();
            await panel.waitFor();
            check(
              status + " recovery retains template view",
              await nav.getByRole("button", { name: /模板版本/ }).getAttribute("aria-pressed"),
              "true",
            );
          }
          check("no business dialog opened", await page.locator("dialog:modal").count(), 0);
          check(
            "no horizontal page overflow",
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
        }
        check(
          "read-only network",
          requests.every((r) => r.key.startsWith("GET ") && r.body === null),
        );
        check("no unexpected requests", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ mode, width, checks, requests });
      } finally {
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
    kind: "P34-ACTUAL-VUE-C-r4",
    reviewOnly: true,
    approval: "pending",
    runs,
    screenshots,
    ports,
    processesClosed: true,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    transformedHashes: Object.fromEntries(
      [...replacements].map(([file, text]) => [file, hash(text)]),
    ),
    boundary:
      "Original10 requests/2 templates, explicit8-template synthetic diff fixture via actual repository pure diff method. Original parent and child script/query/API unchanged. Mobile filter/empty style signatures compare with current baseline, not pixel equality. First500/429 and local recovery only; no real backend,RBAC,complete lifecycle,all-page or production acceptance.",
  };
  if (capture) await writeFile(output + "/evidence.json", JSON.stringify(evidence, null, 2) + "\n");
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
