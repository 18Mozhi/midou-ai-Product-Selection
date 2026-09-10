import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildOrgApprovalsDesignData } from "./lib/ui-phase2-org-approvals-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const output = "output/playwright/p34-mobile-template-filters";
const component = "apps/web/src/components/OrganizationApprovalPanel.vue";
const baselineCommit = "bae3cbe722ecfee23b6b8331fd9104599ffa22a2";
const baselineSource = execFileSync("git", ["show", `${baselineCommit}:${component}`], {
  encoding: "utf8",
});
const baselineId = path
  .resolve("apps/web/src/components/__P34FilterBaseline.vue")
  .replaceAll("\\", "/");
const entry = "/__p34_mobile_filters.js";
const data = await buildOrgApprovalsDesignData(process.cwd());
const hash = (v) => createHash("sha256").update(v).digest("hex");
const files = [
  component,
  "apps/web/src/design/approval-filter-tokens.css",
  "scripts/verify-ui-phase2-org-approvals-mobile-filters.mjs",
  "scripts/lib/ui-phase2-org-approvals-design-data.mjs",
  "tests/e2e/m06-01-organization-admin.spec.ts",
  ...[
    "styles.css",
    "organization-admin.css",
    "design/tokens.css",
    "design/roles-tokens.css",
    "accessibility.css",
    "responsive-baselines.css",
    "signal-ledger.css",
  ].map((f) => `apps/web/src/${f}`),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
} else await mkdir(output, { recursive: true });
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/OrganizationApprovalPanel.vue';import Baseline from '/src/components/__P34FilterBaseline.vue';
import '/src/styles.css';import '/src/organization-admin.css';import '/src/design/tokens.css';import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';
const data=${JSON.stringify(data)};const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const baseline=new URL(location.href).searchParams.has('baseline');
if(new URL(location.href).searchParams.has('empty_catalog')) data.templates=[];
const app=createApp({render:()=>h('main',{class:'org-admin-center'},h(baseline?Baseline:Current,{templates:data.templates,approvals:data.items,summary:data.summary,statusText:v=>v,summaryText:v=>v,formatTime:v=>v}))}).use(router);
await router.isReady();app.mount('#host');`;
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port, strictPort: true, open: false },
  plugins: [
    {
      name: "p34-mobile-filter-isolated-host",
      enforce: "pre",
      resolveId: (id) =>
        id === entry
          ? entry
          : id === "/src/components/__P34FilterBaseline.vue"
            ? baselineId
            : undefined,
      load: (id) =>
        id === entry
          ? host
          : id.split("?")[0] === baselineId && !id.includes("type=")
            ? baselineSource
            : undefined,
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/org-admin/approvals") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P34 手机筛选真实Vue验证</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
let browser;
const checks = [],
  screenshots = [];
try {
  await server.listen();
  console.log(`p34_mobile_filter_host_started http://127.0.0.1:${port}`);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === `http://127.0.0.1:${port}` && !url.pathname.startsWith("/api/"))
          return route.continue();
        requests.push(url.pathname);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const visit = async (query) => {
        await page.goto(`http://127.0.0.1:${port}/org-admin/approvals?${query}`);
        await page.locator(".org-approval-toolbar").waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const panel = () => page.locator(".org-approval-governance");
      // Render the immutable pre-change SFC in the same CSS host; compare pixels in memory.
      for (const view of width <= 760 ? ["requests"] : ["requests", "templates"]) {
        await visit(`baseline=1&approval_view=${view}`);
        const before = await panel().screenshot({ animations: "disabled" });
        await visit(`approval_view=${view}`);
        check(
          `${view}: pixel identical to pre-change child`,
          hash(await panel().screenshot({ animations: "disabled" })),
          hash(before),
        );
      }
      const unchangedCases = [
        ["request empty", "approval_view=requests&approval_request_query=不存在"],
        ["no returned templates", "approval_view=templates&empty_catalog=1"],
        ...(width > 760
          ? [
              [
                "desktop template no match",
                "approval_view=templates&approval_template_query=不存在",
              ],
            ]
          : []),
      ];
      for (const [name, query] of unchangedCases) {
        await visit(`baseline=1&${query}`);
        const before = await panel().screenshot({ animations: "disabled" });
        await visit(query);
        check(
          `${name}: pixel identical to pre-change child`,
          hash(await panel().screenshot({ animations: "disabled" })),
          hash(before),
        );
        if (name === "no returned templates")
          check(
            "no catalog has no misleading clear-filter action",
            await page.locator(".org-template-empty-clear").count(),
            0,
          );
      }
      await visit("approval_view=templates&keep=external&approval_request_query=审批");
      const toolbar = page.locator(".org-approval-template-filters-c");
      const fields = toolbar.locator("input,select");
      check("five existing native fields", await fields.count(), 5);
      check(
        "native constraints unchanged",
        await fields.evaluateAll((ns) =>
          ns.every(
            (n) =>
              !n.required &&
              !n.disabled &&
              !n.hasAttribute("maxlength") &&
              !n.hasAttribute("aria-invalid"),
          ),
        ),
      );
      if (width <= 760) {
        const geometry = await fields.evaluateAll((ns) =>
          ns.map((n) => {
            const r = n.getBoundingClientRect();
            const s = getComputedStyle(n);
            return { x: r.x, y: r.y, w: r.width, h: r.height, font: parseFloat(s.fontSize) };
          }),
        );
        check(
          "single column and 44px/16px controls",
          geometry.every(
            (r, i) =>
              r.x === geometry[0].x &&
              r.w === geometry[0].w &&
              r.h >= 44 &&
              r.font >= 16 &&
              (i === 0 || r.y > geometry[i - 1].y + geometry[i - 1].h),
          ),
        );
        check("six help/count lines visible", await toolbar.locator("small:visible").count(), 6);
        check(
          "C field colors are not overridden by old theme",
          await toolbar.evaluate((n) => ({
            label: getComputedStyle(n.querySelector("label > span")).color,
            help: getComputedStyle(n.querySelector("small")).color,
            input: getComputedStyle(n.querySelector("input")).color,
            inputBorder: getComputedStyle(n.querySelector("input")).borderTopColor,
            reset: getComputedStyle(n.querySelector("button")).color,
            background: getComputedStyle(n).backgroundColor,
          })),
          {
            label: "rgb(32, 44, 61)",
            help: "rgb(88, 103, 123)",
            input: "rgb(32, 44, 61)",
            inputBorder: "rgb(102, 128, 162)",
            reset: "rgb(37, 74, 156)",
            background: "rgb(255, 255, 255)",
          },
        );
        check(
          "help IDs resolve",
          await fields.evaluateAll((ns) =>
            ns.every((n) =>
              n
                .getAttribute("aria-describedby")
                .split(" ")
                .every((id) => !!document.getElementById(id)),
            ),
          ),
        );
        const reset = toolbar.getByRole("button", { name: "重置", exact: true });
        check(
          "bottom full width reset",
          await reset.evaluate((n) => {
            const r = n.getBoundingClientRect(),
              last = n.previousElementSibling.getBoundingClientRect();
            return r.y >= last.bottom && r.width === last.width && r.height >= 44;
          }),
        );
      } else
        check("desktop help visually hidden", await toolbar.locator("small:visible").count(), 0);
      const shot = async (scene, selector = ".org-approval-template-filters-c") => {
        check(
          `${scene}: no horizontal overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture || width !== 390) return;
        const file = `${scene}-390.png`,
          bytes = await page.locator(selector).screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          pageId: "P34",
          scope: "mounted-Vue-mobile-template-filters-only-not-production-or-whole-page-approval",
          sha256: hash(bytes),
        });
      };
      await shot("default");
      const query = toolbar.getByRole("searchbox", { name: "搜索模板", exact: true });
      await query.fill("选品");
      await toolbar.getByRole("combobox", { name: "状态", exact: true }).selectOption("published");
      await toolbar
        .getByRole("combobox", { name: "工作区", exact: true })
        .selectOption(data.templates[0].workspace_name);
      await toolbar
        .getByRole("combobox", { name: "资源类型", exact: true })
        .selectOption("opportunity_decision");
      await toolbar
        .getByRole("combobox", { name: "排序", exact: true })
        .selectOption("updated_desc");
      check(
        "combined filters one real fixture match",
        await page.locator(".org-approval-template-directory > button").count(),
        1,
      );
      await query.blur();
      await shot("matching");
      await query.fill("不存在的模板");
      check(
        "no result is not validation error",
        await query.evaluate((n) => n.checkValidity() && !n.hasAttribute("aria-invalid")),
      );
      check(
        "empty result has no directory rows",
        await page.locator(".org-approval-template-directory > button").count(),
        0,
      );
      await query.blur();
      await shot("no-result", ".org-approval-section");
      const empty = page.locator(".org-template-empty-c");
      if (width <= 760) {
        check(
          "empty count reflects returned templates not organization summary",
          (await empty.locator(".org-template-empty-count").innerText()).replace(/\s/g, ""),
          `筛选0/已返回${data.templates.length}个模板；每页6个`,
        );
        check(
          "approved neutral empty palette and readable title",
          await empty.evaluate((n) => ({
            background: getComputedStyle(n.querySelector(":scope > div")).backgroundColor,
            title: getComputedStyle(n.querySelector("h5")).color,
            titleSize: parseFloat(getComputedStyle(n.querySelector("h5")).fontSize),
            buttonHeight: n.querySelector("button").getBoundingClientRect().height,
          })),
          {
            background: "rgb(245, 247, 251)",
            title: "rgb(32, 44, 61)",
            titleSize: 19,
            buttonHeight: 44,
          },
        );
        await shot("empty-region", ".org-template-empty-c");
      } else
        check("desktop empty clear stays hidden", await empty.locator("button").isVisible(), false);
      await query.focus();
      const tabOrder = [];
      for (let i = 0; i < 6; i++) {
        tabOrder.push(
          await page.evaluate(
            () =>
              document.activeElement.getAttribute("aria-label") ||
              document.activeElement.textContent.trim(),
          ),
        );
        if (i < 5) await page.keyboard.press("Tab");
      }
      check("keyboard order stays fields then reset", tabOrder, [
        "搜索模板",
        "状态",
        "工作区",
        "资源类型",
        "排序",
        "重置",
      ]);
      await shot("reset-focus");
      await page.keyboard.press("Enter");
      check(
        "reset keeps five existing defaults",
        await fields.evaluateAll((ns) => ns.map((n) => n.value)),
        ["", "all", "all", "all", "name_asc"],
      );
      await page.waitForFunction(
        () => !new URL(location.href).searchParams.has("approval_template_query"),
      );
      check(
        "reset preserves other view and unrelated URL",
        [
          new URL(page.url()).searchParams.get("approval_request_query"),
          new URL(page.url()).searchParams.get("keep"),
        ],
        ["审批", "external"],
      );
      await toolbar.getByRole("button", { name: "重置", exact: true }).blur();
      await shot("reset-result");
      if (width <= 760) {
        await query.fill("不存在的模板");
        const clear = empty.getByRole("button", { name: "清除筛选", exact: true });
        await clear.focus();
        await shot("empty-clear-focus", ".org-template-empty-c");
        await page.keyboard.press("Space");
        check(
          "keyboard clear restores existing defaults",
          await fields.evaluateAll((ns) => ns.map((n) => n.value)),
          ["", "all", "all", "all", "name_asc"],
        );
        check(
          "removed empty action returns focus to persistent search",
          await query.evaluate((n) => document.activeElement === n),
        );
        await page.waitForFunction(
          () => !new URL(location.href).searchParams.has("approval_template_query"),
        );
        check(
          "clear preserves other view and unrelated query",
          [
            new URL(page.url()).searchParams.get("approval_request_query"),
            new URL(page.url()).searchParams.get("keep"),
          ],
          ["审批", "external"],
        );
        await query.fill("再次无匹配");
        await clear.click();
        check(
          "pointer clear restores results",
          await page.locator(".org-approval-template-directory > button").count(),
          data.templates.length,
        );
        check(
          "pointer clear also returns focus",
          await query.evaluate((n) => document.activeElement === n),
        );
      }
      await query.fill("长".repeat(220));
      check("220 input remains allowed", (await query.inputValue()).length, 220);
      await page.waitForFunction(
        () => new URL(location.href).searchParams.get("approval_template_query")?.length === 220,
      );
      await page.reload();
      await toolbar.waitFor();
      check("existing URL reader still restores 200 units", (await query.inputValue()).length, 200);
      check("zero external/API requests", requests, []);
      check("zero browser errors", errors, []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
if (capture)
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P34-MOBILE-TEMPLATE-FILTERS",
        boundary:
          "Actual child with isolated fixtures. Mobile filter and approved no-match region implemented; desktop/request/no-catalog pixels compared to pre-change SFC. Local clear restores focus, not parent/API/permission/production or other visual approval.",
        baselineCommit,
        baselineSha256: hash(baselineSource.replaceAll("\r\n", "\n")),
        sourceHashes,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
else assert.deepEqual(checks, previous.checks);
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    browserAndServerClosed: true,
  }),
);
