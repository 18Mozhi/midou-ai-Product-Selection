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
import { buildShellOrgFixture, orgFixtureFile } from "./lib/ui-phase2-shell-org-fixture.mjs";
import { buildTeamsDesignData } from "./lib/ui-phase2-teams-design-data.mjs";
import { teamsVueFile, teamsVueCss } from "./lib/ui-phase2-teams-vue-preview.mjs";
import {
  previewTeamsCreateStates,
  teamsCreateStatesCss,
} from "./lib/ui-phase2-teams-create-states-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((a) => ["--smoke", "--capture"].includes(a)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
const output = "output/playwright/p33-create-states-r2";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const shellFile = "apps/web/src/components/NavigationShell.vue";
const originals = new Map(
  await Promise.all([shellFile, teamsVueFile].map(async (f) => [f, await read(f)])),
);
const replacements = new Map([
  [shellFile, previewShellVue(originals.get(shellFile))],
  [teamsVueFile, previewTeamsCreateStates(originals.get(teamsVueFile))],
]);
const fixture = await buildShellOrgFixture(),
  teams = await buildTeamsDesignData(process.cwd());
const styles = [shellReviewCss, teamsVueCss, teamsCreateStatesCss];
const sources = new Set([
  ...originals.keys(),
  ...styles,
  shellReviewModule,
  orgFixtureFile,
  "scripts/verify-ui-phase2-teams-create-states.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-phase2-shell-org-fixture.mjs",
  "scripts/lib/ui-phase2-teams-vue-preview.mjs",
  "scripts/lib/ui-phase2-teams-create-focus-preview.mjs",
  "scripts/lib/ui-phase2-teams-create-states-preview.mjs",
  "scripts/lib/ui-phase2-teams-design-data.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/api/src/organization-admin-service.ts",
  "apps/api/src/organization-admin-routes.ts",
  "apps/api/src/mysql-organization-admin-repository.ts",
  "docs/openapi.yaml",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [];
if (capture) await mkdir(output);
const reservation = reservePort();
await new Promise((done) => reservation.listen(0, "127.0.0.1", done));
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const origin = `http://127.0.0.1:${port}`;
let browser, server;
try {
  server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
    plugins: [
      {
        name: "teams-create-states-review",
        enforce: "pre",
        transform(text, id) {
          const file = path.relative(process.cwd(), id).replaceAll("\\", "/");
          if (!replacements.has(file)) return null;
          assert.equal(text.replaceAll("\r\n", "\n"), originals.get(file));
          return { code: replacements.get(file), map: null };
        },
        transformIndexHtml(html) {
          return html
            .replace("<body>", '<body class="shell-vue-c teams-vue-c">')
            .replace(
              "</head>",
              styles
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
  console.log(JSON.stringify({ origin }));
  browser = await chromium.launch();
  for (const width of smoke ? [390] : [390, 840, 841, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    let releaseWrite;
    try {
      const page = await context.newPage(),
        checks = [],
        requests = [],
        errors = [],
        unexpected = [];
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ name, actual });
      };
      const rows = structuredClone(teams.teamRows);
      let writeMode = "reject",
        failRead = false;
      const envelope = (data, id = "p33-create-local-read") => ({
        data,
        request_id: id,
        trace_id: id,
      });
      page.setDefaultTimeout(15000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        const key = `${req.method()} ${url.pathname}${url.search}`;
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push({
          key,
          body: req.postData(),
          idempotency: req.headers()["idempotency-key"] ?? null,
        });
        if (key === "POST /api/v1/org/admin/teams") {
          const body = req.postDataJSON(),
            mode = writeMode;
          await new Promise((done) => {
            releaseWrite = done;
          });
          releaseWrite = undefined;
          if (mode === "reject") return route.fulfill({ status: 500, json: {} });
          const item = {
            ...rows[0],
            id:
              mode === "success"
                ? "00000000-0000-4000-8000-000000000999"
                : "00000000-0000-4000-8000-000000000998",
            name: body.name,
            status: "active",
            member_count: body.lead_membership_id ? 1 : 0,
            lead_membership_id: body.lead_membership_id || null,
            lead_email: body.lead_membership_id ? "buyer@example.test" : null,
            default_workflow_key: body.default_workflow_key || null,
            version: 1,
            created_at: "2026-08-27T00:00:00.000Z",
            updated_at: "2026-08-27T00:00:00.000Z",
          };
          rows.push(item);
          failRead = mode === "refresh-failed";
          return route.fulfill({
            status: 201,
            json: envelope(
              { id: item.id, name: item.name, status: item.status, version: item.version },
              "p33-create-local-write",
            ),
          });
        }
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ status: 500, json: {} });
        if (key === "GET /api/v1/org/admin/teams" && failRead)
          return route.fulfill({ status: 500, json: {} });
        const values = {
          "GET /api/v1/me/navigation?shell=organization_admin": fixture.navigation,
          "GET /api/v1/auth/session-status": { authenticated: true },
          "GET /api/v1/org/admin/summary": fixture.summary,
          "GET /api/v1/org/admin/teams": rows,
          "GET /api/v1/org/admin/members": teams.members,
        };
        if (!(key in values)) {
          unexpected.push(key);
          return route.abort();
        }
        return route.fulfill({ json: envelope(values[key]) });
      });
      const shot = async (scene, selector) => {
        if (!capture) return;
        await page.evaluate(() => document.fonts.ready);
        const target = page.locator(selector),
          box = await target.boundingBox();
        const height = Math.max(1000, Math.ceil(box.height) + 300);
        assert.ok(height <= 4000);
        await page.setViewportSize({ width, height });
        await target.evaluate((n) =>
          scrollTo({ top: scrollY + n.getBoundingClientRect().top - 100, behavior: "instant" }),
        );
        check(
          scene + " screenshot region clear of mobile bar",
          await target.evaluate((n) => {
            const r = n.getBoundingClientRect(),
              bar = document.querySelector(".role-mobile-nav");
            if (!bar || !bar.getClientRects().length) return true;
            const b = bar.getBoundingClientRect();
            return r.bottom <= b.top || r.top >= b.bottom;
          }),
        );
        const bytes = await target.screenshot({ animations: "disabled" }),
          file = `${width}-${scene}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          width,
          scene,
          selector,
          captureViewport: { width, height },
          sha256: hash(bytes),
        });
        await page.setViewportSize({ width, height: 1000 });
      };
      await page.goto(origin + "/org-admin/teams");
      await page.waitForSelector('.role-shell[data-state="ready"] .org-team-panel');
      const panel = page.locator(".org-team-panel"),
        form = panel.locator(".org-team-create");
      const writes = () => requests.filter((r) => r.key.startsWith("POST "));
      await panel.locator(".org-team-overview button").click();
      await page.waitForFunction(() => document.activeElement?.id === "team-name");
      check(
        "four fields linked to existing local help",
        await form.locator("input,select,textarea").evaluateAll((nodes) =>
          nodes.every((n) => {
            const id = n.getAttribute("aria-describedby");
            return id && document.getElementById(id)?.textContent.trim();
          }),
        ),
      );
      await form.locator('button[type="submit"]').click();
      check(
        "native required name blocks write and receives focus",
        await page
          .locator("#team-name")
          .evaluate((n) => n.validity.valueMissing && n === document.activeElement),
      );
      await page.locator("#team-name").fill("  亚太新品采购组  ");
      await form.locator('button[type="submit"]').click();
      check(
        "native required reason blocks write and receives focus",
        await page
          .locator("#team-reason")
          .evaluate((n) => n.validity.valueMissing && n === document.activeElement),
      );
      check("invalid form makes no write", writes().length, 0);
      await page.locator("#team-lead").selectOption(teams.members.items[1].id);
      await page.locator("#team-workflow").fill("  opportunity-review  ");
      await page.locator("#team-reason").fill("  建立亚太新品采购协作边界  ");
      const draft = await form
        .locator("input,select,textarea")
        .evaluateAll((nodes) => nodes.map((n) => n.value));
      await form.locator('button[type="submit"]').dblclick();
      await page.waitForFunction(
        () => document.querySelector('.org-team-create button[type="submit"]')?.disabled,
      );
      check("one write while pending", writes().length, 1);
      check("original payload trimmed exactly", JSON.parse(writes()[0].body), {
        name: "亚太新品采购组",
        lead_membership_id: teams.members.items[1].id,
        default_workflow_key: "opportunity-review",
        reason: "建立亚太新品采购协作边界",
      });
      check("idempotency header provided", Boolean(writes()[0].idempotency));
      check("form announced busy", await form.getAttribute("aria-busy"), "true");
      check(
        "busy status outside the busy form",
        await panel
          .locator(".teams-create-progress")
          .evaluate((n) => n.getAttribute("role") === "status" && !n.closest('[aria-busy="true"]')),
      );
      check(
        "cancel disabled while original fields remain editable",
        (await form.getByRole("button", { name: "取消", exact: true }).isDisabled()) &&
          (await form
            .locator("input,select,textarea")
            .evaluateAll((nodes) => nodes.every((n) => !n.disabled && !n.readOnly))),
      );
      await shot("saving", ".org-team-create");
      await shot("saving-status", ".teams-create-progress");
      releaseWrite();
      await page.waitForFunction(
        () => !document.querySelector('.org-team-create button[type="submit"]')?.disabled,
      );
      check(
        "write error preserves all input",
        await form
          .locator("input,select,textarea")
          .evaluateAll((nodes) => nodes.map((n) => n.value)),
        draft,
      );
      check(
        "failure is an alert with original fallback message",
        await page.locator(".org-admin-notice").getAttribute("role"),
        "alert",
      );
      check(
        "failure does not claim saved",
        (await page.locator(".org-admin-notice").textContent()).includes("请求暂时失败。"),
      );
      check(
        "no list reload after rejected write",
        requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length,
        1,
      );
      check(
        "failure uses C white/navy treatment with restrained red edge",
        await page.locator(".org-admin-notice").evaluate((n) => {
          const s = getComputedStyle(n);
          return [s.backgroundColor, s.color, s.borderLeftColor];
        }),
        ["rgb(255, 255, 255)", "rgb(23, 54, 111)", "rgb(180, 35, 24)"],
      );
      check(
        "failure trace is subordinate and can wrap",
        await page.locator(".org-admin-notice code").evaluate((n) => {
          const s = getComputedStyle(n);
          return [s.color, s.fontSize, s.overflowWrap];
        }),
        ["rgb(82, 98, 124)", "12px", "anywhere"],
      );
      await shot("write-failure", ".org-admin-notice");
      await shot("retained-form", ".org-team-create");
      writeMode = "success";
      await form.locator('button[type="submit"]').click();
      await page.waitForFunction(
        () => document.querySelector('.org-team-create button[type="submit"]')?.disabled,
      );
      check("user retry is one new logical write", writes().length, 2);
      check(
        "user retry has a distinct idempotency key",
        writes()[0].idempotency !== writes()[1].idempotency,
      );
      releaseWrite();
      await page.waitForFunction(() => !document.querySelector(".org-team-create"));
      check(
        "successful reload exposes eleven actual fixture teams",
        await panel.locator(".org-team-metrics b").first().textContent(),
        "11",
      );
      check(
        "success notice retains real write trace",
        (await page.locator(".org-admin-notice").textContent()).includes("p33-create-local-write"),
      );
      check(
        "selection stays on original team rather than invented auto-selection",
        await panel.locator(".org-team-detail h3").textContent(),
        teams.teamRows[0].name,
      );
      // Reduced-motion CSS still has 0.01ms transitions. Read the settled style, not its first frame.
      await page
        .locator(".org-admin-notice")
        .evaluate((n) => Promise.all(n.getAnimations().map((animation) => animation.finished)));
      check(
        "success uses C blue feedback treatment",
        await page
          .locator(".org-admin-notice")
          .evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(232, 239, 251)",
      );
      await shot("success", ".org-admin-notice");
      await panel.locator('.org-team-directory input[type="search"]').fill("亚太新品采购组");
      check(
        "new team is available in refreshed directory",
        await panel.locator(".org-team-list button").count(),
        1,
      );
      await shot("created-team", ".org-team-directory");
      await panel
        .locator(".org-team-directory")
        .getByRole("button", { name: "重置筛选", exact: true })
        .click();
      await panel.locator(".org-team-overview button").click();
      await page.locator("#team-name").fill("创建后读取失败样例");
      await page.locator("#team-reason").fill("只记录既有反馈风险，不提交生产");
      writeMode = "refresh-failed";
      await form.locator('button[type="submit"]').click();
      await page.waitForFunction(
        () => document.querySelector('.org-team-create button[type="submit"]')?.disabled,
      );
      releaseWrite();
      await page.waitForFunction(() => !document.querySelector(".org-team-create"));
      check(
        "known OG-G02: stale eleven rows remain after saved read failure",
        await panel.locator(".org-team-metrics b").first().textContent(),
        "11",
      );
      check(
        "known OG-G02: success notice overwrites read failure",
        await page.locator(".org-admin-notice").getAttribute("data-kind"),
        "success",
      );
      await shot("known-refresh-failure-overwrite", ".org-admin-notice");
      check("only three explicitly intercepted local writes", writes().length, 3);
      check(
        "one initial and two post-save teams reads",
        requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length,
        3,
      );
      check(
        "all other requests are bodyless GET",
        requests.every(
          (r) =>
            r.key === "POST /api/v1/org/admin/teams" ||
            (r.key.startsWith("GET ") && r.body === null),
        ),
      );
      check("no unexpected requests", unexpected, []);
      check("no browser exceptions", errors, []);
      runs.push({
        width,
        checks,
        requests,
        knownUnresolved:
          "OG-G02 write success masks reload failure; this is reproduced, not fixed or accepted.",
      });
    } finally {
      releaseWrite?.();
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
  await includeImportedStyleSources(sources, (file) =>
    file.startsWith("apps/web/src/") ? read(file) : "",
  );
  await browser.close();
  browser = null;
  await server.close();
  server = null;
  const evidence = {
    kind: "P33-C-CREATE-STATES-r2",
    reviewOnly: true,
    approval: "pending",
    runs,
    screenshots,
    port,
    processesClosed: true,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    transformedHashes: Object.fromEntries(
      [...replacements].map(([file, value]) => [file, hash(value)]),
    ),
    boundary:
      "Actual App/router/unchanged parent. Latest C cancel-focus preview plus field help relationships and busy announcement. Locally intercepted writes only, no backend transaction/RBAC proof. OG-G02 refresh failure overwrite reproduced, not fixed; overall page and production acceptance remain open.",
  };
  if (capture) await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      port,
      processesClosed: true,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
