import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildOrgTokenDesignData } from "./lib/ui-phase2-org-token-design-data.mjs";
import { undoTokenQuerySync } from "./lib/ui-phase2-token-query-delta.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke"),
  refreshSource = process.argv.includes("--refresh-source");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke", "--refresh-source"].includes(a)) &&
    [capture, smoke, refreshSource].filter(Boolean).length <= 1,
);
const output = "output/playwright/p36-mobile-filters-vue";
const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const baselineCommit = "c380b995b3a6d55d7f1742dc42baf9479be0e8e7";
const baselineSource = execFileSync("git", ["show", `${baselineCommit}:${component}`], {
  encoding: "utf8",
});
const baselineId = path
  .resolve("apps/web/src/components/__P36FilterBaseline.vue")
  .replaceAll("\\", "/");
const entry = "/__p36_mobile_filters.js";
const data = await buildOrgTokenDesignData(process.cwd());
const hash = (v) => createHash("sha256").update(v).digest("hex");
const files = [
  component,
  "apps/web/src/design/token-filter-tokens.css",
  "scripts/verify-ui-phase2-org-token-mobile-filters.mjs",
  "scripts/lib/ui-phase2-org-token-design-data.mjs",
  "scripts/lib/ui-phase2-token-query-delta.mjs",
  "tests/e2e/m06-01-organization-admin.spec.ts",
  "apps/web/vite.config.ts",
  ...[
    "styles.css",
    "organization-admin.css",
    "design/tokens.css",
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
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  if (!refreshSource) assert.deepEqual(previous.sourceHashes, sourceHashes);
  else
    for (const [file, sha] of Object.entries(previous.sourceHashes)) {
      if (file === "scripts/verify-ui-phase2-org-token-mobile-filters.mjs") continue;
      const content = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
      assert.equal(
        hash(file === component ? undoTokenQuerySync(content) : content),
        sha,
        `Only query fix may advance source binding: ${file}`,
      );
    }
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
} else if (capture) await mkdir(output, { recursive: true });
const host = `import {createApp,h,ref} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/OrganizationTokenPanel.vue';import Baseline from '/src/components/__P36FilterBaseline.vue';
import '/src/styles.css';import '/src/organization-admin.css';import '/src/design/tokens.css';import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';const data=${JSON.stringify(data.tokens)};
const params=new URL(location.href).searchParams;const tokens=params.has('empty')?[]:data;const busy=ref(params.has('busy'));window.__writes=[];window.__busy=(v)=>busy.value=v;
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const props=()=>({tokens,secret:'',busy:busy.value,formatTime:v=>v,createToken:async v=>{window.__writes.push(v);return false},performTokenAction:async()=>{window.__writes.push('action');return false},dismissSecret:()=>window.__writes.push('dismiss')});
const app=createApp({render:()=>h('main',{class:'org-admin-center'},h(params.has('baseline')?Baseline:Current,props()))}).use(router);await router.isReady();app.mount('#host');`;
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port, strictPort: true, open: false, hmr: false },
  plugins: [
    {
      name: "p36-mobile-filter-isolated-host",
      enforce: "pre",
      resolveId: (id) =>
        id === entry
          ? entry
          : id === "/src/components/__P36FilterBaseline.vue"
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
          if (req.url?.split("?")[0] !== "/org-admin/tokens") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 手机筛选真实 Vue</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
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
  console.log(`p36_mobile_filter_host_started http://127.0.0.1:${port}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      await context.addInitScript((time) => {
        const RealDate = Date;
        class FixedDate extends RealDate {
          constructor(...a) {
            super(...(a.length ? a : [time]));
          }
          static now() {
            return new RealDate(time).getTime();
          }
        }
        window.Date = FixedDate;
        window.__clipboardCalls = 0;
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async () => {
              window.__clipboardCalls++;
              throw Error("OS clipboard forbidden");
            },
          },
        });
      }, data.fixedTime);
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) => {
        const u = new URL(r.request().url());
        if (u.origin === `http://127.0.0.1:${port}` && !u.pathname.startsWith("/api/"))
          return r.continue();
        requests.push(u.pathname);
        return r.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const visit = async (q) => {
        await page.goto(`http://127.0.0.1:${port}/org-admin/tokens?${q}`);
        await page.locator(".org-token-toolbar").waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const pixel = async (selector) => {
        const node = page.locator(selector);
        // Added help shifts later regions vertically; align both crops to whole pixels.
        const margin = await node.evaluate((n) => {
          const old = n.style.marginTop,
            r = n.getBoundingClientRect();
          n.style.marginTop = `${parseFloat(getComputedStyle(n).marginTop) + Math.ceil(r.y) - r.y}px`;
          return old;
        });
        try {
          const bytes = await node.screenshot({ animations: "disabled" });
          return hash(bytes);
        } finally {
          await node.evaluate((n, old) => {
            n.style.marginTop = old;
          }, margin);
        }
      };
      for (const query of smoke ? [""] : ["", "org_token_query=不存在", "busy=1", "empty=1"]) {
        const selectors =
          width <= 760
            ? [
                ".org-token-overview",
                ".org-token-metrics",
                ".org-token-truth",
                ".org-token-create",
                ".org-token-ledger-heading",
                query.includes("不存在") || query.includes("empty")
                  ? ".org-token-empty"
                  : ".org-token-list",
              ]
            : [".org-token-panel"];
        await visit(`baseline=1&${query}`);
        const before = [];
        for (const selector of selectors) before.push(await pixel(selector));
        await visit(query);
        for (const [i, sel] of selectors.entries())
          check(
            `${query || "normal"}: ${sel} pixel identical to baseline`,
            await pixel(sel),
            before[i],
          );
      }
      await visit("keep=external&org_token_page=2");
      const toolbar = page.locator(".org-token-filters-c"),
        fields = toolbar.locator("input,select"),
        query = toolbar.getByRole("searchbox", { name: "搜索令牌", exact: true }),
        reset = toolbar.getByRole("button", { name: "重置筛选", exact: true });
      check("four existing native fields", await fields.count(), 4);
      check(
        "native rules unchanged",
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
      await reset.click();
      check(
        "default reset does not force page one",
        (await page.locator(".org-token-pagination").innerText()).includes("第 2 /"),
      );
      const defaults = ["", "all", "all", "created_desc"];
      check(
        "reset defaults retained",
        await fields.evaluateAll((ns) => ns.map((n) => n.value)),
        defaults,
      );
      const accessibleNames = ["搜索令牌", "生命周期", "读取范围", "排序"];
      for (let i = 0; i < 4; i++)
        check(
          `label ${i} remains exact`,
          await fields.nth(i).getAttribute("aria-labelledby"),
          `org-token-${["query", "status", "scope", "sort"][i]}-label`,
        );
      check(
        "description IDs resolve",
        await fields.evaluateAll((ns) =>
          ns.every((n) =>
            n
              .getAttribute("aria-describedby")
              .split(" ")
              .every((id) => document.getElementById(id)?.textContent.trim()),
          ),
        ),
      );
      if (width <= 760) {
        const g = await fields.evaluateAll((ns) =>
          ns.map((n) => {
            const r = n.getBoundingClientRect(),
              s = getComputedStyle(n);
            return { x: r.x, y: r.y, w: r.width, h: r.height, font: parseFloat(s.fontSize) };
          }),
        );
        check(
          "single column 46px 16px fields",
          g.every(
            (r, i) =>
              r.x === g[0].x &&
              r.w === g[0].w &&
              r.h >= 46 &&
              r.font >= 16 &&
              (i === 0 || r.y > g[i - 1].y + g[i - 1].h),
          ),
        );
        check("five nearby help lines visible", await toolbar.locator("small:visible").count(), 5);
        check(
          "mobile approved palette",
          await toolbar.evaluate((n) => ({
            label: getComputedStyle(n.querySelector("label span")).color,
            help: getComputedStyle(n.querySelector("small")).color,
            input: getComputedStyle(n.querySelector("input")).color,
            border: getComputedStyle(n.querySelector("input")).borderTopColor,
            paper: getComputedStyle(n).backgroundColor,
            reset: getComputedStyle(n.querySelector("button")).color,
          })),
          {
            label: "rgb(32, 44, 61)",
            help: "rgb(88, 103, 123)",
            input: "rgb(32, 44, 61)",
            border: "rgb(102, 128, 162)",
            paper: "rgb(255, 255, 255)",
            reset: "rgb(37, 74, 156)",
          },
        );
        check(
          "reset below explanation and full width",
          await reset.evaluate((n) => {
            const b = n.getBoundingClientRect(),
              h = n.previousElementSibling.getBoundingClientRect();
            return b.y >= h.bottom && b.width === h.width && b.height >= 44;
          }),
        );
      } else check("desktop help hidden", await toolbar.locator("small:visible").count(), 0);
      const shot = async (scene) => {
        check(
          `${scene}: no horizontal overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture || width > 760) return;
        await page.mouse.move(0, 0);
        const file = `${scene}-${width}.png`,
          bytes = await toolbar.screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          sha256: hash(bytes),
          scope: "mounted-child-fixture-mobile-filter-not-parent-API-or-production-acceptance",
        });
      };
      await reset.blur();
      await shot("default");
      const selections = [
        ["生命周期", ["all", "active", "expiring", "never_used", "revoked", "rotated", "expired"]],
        ["读取范围", ["all", ...data.scopeOptions.map((s) => s.value)]],
        ["排序", Object.keys(data.oracle)],
      ];
      const ids = () =>
        page
          .locator(".org-token-list details code")
          .evaluateAll((ns) => ns.map((n) => n.textContent.replace("令牌记录 ID：", "").trim()));
      for (const [name, options] of selections) {
        const select = toolbar.getByRole("combobox", { name, exact: true });
        check(
          `${name} options unchanged`,
          await select.locator("option").evaluateAll((ns) => ns.map((n) => n.value)),
          options,
        );
      }
      const status = toolbar.getByRole("combobox", { name: "生命周期", exact: true }),
        scope = toolbar.getByRole("combobox", { name: "读取范围", exact: true }),
        sort = toolbar.getByRole("combobox", { name: "排序", exact: true });
      await query.fill("月度");
      await status.selectOption("active");
      await scope.selectOption("report:read");
      check(
        "combined filter keeps actual matching token",
        await ids(),
        data.tokens
          .filter(
            (t) =>
              t.name.includes("月度") && t.status === "active" && t.scopes.includes("report:read"),
          )
          .map((t) => t.id),
      );
      await query.blur();
      await shot("matching");
      await query.fill("不存在的令牌");
      check(
        "no match not validation error",
        await query.evaluate((n) => n.validity.valid && !n.hasAttribute("aria-invalid")),
      );
      check("zero result", await ids(), []);
      await query.blur();
      await shot("no-result");
      await query.focus();
      for (let i = 0; i < 4; i++) {
        check(
          `native Tab field ${i}`,
          await fields.nth(i).evaluate((n) => n === document.activeElement),
        );
        await page.keyboard.press("Tab");
      }
      check(
        "Tab ends at existing reset",
        await reset.evaluate((n) => n === document.activeElement),
      );
      await shot("reset-focus");
      await page.keyboard.press("Enter");
      check(
        "Enter reset restores defaults",
        await fields.evaluateAll((ns) => ns.map((n) => n.value)),
        defaults,
      );
      await page.waitForFunction(() => !new URL(location.href).searchParams.has("org_token_query"));
      check(
        "reset preserves unrelated query",
        new URL(page.url()).searchParams.get("keep"),
        "external",
      );
      check(
        "changed filters reset page one",
        new URL(page.url()).searchParams.get("org_token_page"),
        null,
      );
      for (const order of Object.keys(data.oracle)) {
        await sort.selectOption(order);
        check(`full sorting ${order} page one`, await ids(), data.oracle[order].slice(0, 6));
        await page.getByRole("button", { name: "下一页", exact: true }).click();
        check(`full sorting ${order} page two`, await ids(), data.oracle[order].slice(6));
        await page.getByRole("button", { name: "上一页", exact: true }).click();
      }
      for (const value of selections[0][1]) {
        await status.selectOption(value);
        const expected = data.tokens.filter(
          (t) =>
            value === "all" ||
            (value === "never_used"
              ? t.status === "active" && !t.last_used_at
              : value === "expiring"
                ? t.status === "active" &&
                  Math.ceil((Date.parse(t.expires_at) - Date.parse(data.fixedTime)) / 86400000) >=
                    0 &&
                  Math.ceil((Date.parse(t.expires_at) - Date.parse(data.fixedTime)) / 86400000) <= 7
                : t.status === value),
        );
        check(
          `status ${value} full count`,
          (await page.locator(".org-token-ledger-heading > span").innerText()).replace(/\s/g, ""),
          `共${expected.length}条匹配记录`,
        );
      }
      await reset.click();
      await query.fill(data.tokens[0].id);
      check("technical ID excluded", await ids(), []);
      await query.fill("");
      await query.pressSequentially("甲乙");
      await query.press("ArrowLeft");
      await query.pressSequentially("中");
      check("native editing retains caret", await query.inputValue(), "甲中乙");
      await page.evaluate(() => window.__busy(true));
      check(
        "busy filters remain editable",
        await fields.evaluateAll((ns) => ns.every((n) => !n.disabled)),
      );
      await shot("busy");
      await reset.click();
      check(
        "busy reset remains local",
        await fields.evaluateAll((ns) => ns.map((n) => n.value)),
        defaults,
      );
      await query.fill("长".repeat(220));
      check("local input 220 allowed", (await query.inputValue()).length, 220);
      await page.waitForFunction(
        () => new URL(location.href).searchParams.get("org_token_query")?.length === 220,
      );
      check("no business callbacks", await page.evaluate(() => window.__writes), []);
      check(
        "no storage or OS clipboard",
        await page.evaluate(() => [
          localStorage.length,
          sessionStorage.length,
          window.__clipboardCalls,
        ]),
        [0, 0, 0],
      );
      await page.reload();
      await toolbar.waitFor();
      check("URL initial reader still truncates to200", (await query.inputValue()).length, 200);
      check("zero API/external requests", requests, []);
      check("zero browser errors", errors, []);
      check("zero cookies", await context.cookies(), []);
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
        kind: "P36-MOBILE-FILTERS-VUE",
        boundary:
          "Actual child with isolated fixtures; approved mobile filter layout only. Exact scripts and non-target pixels preserved; no parent/API/MySQL/RBAC/OS clipboard or production proof.",
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
else if (!smoke) assert.deepEqual(checks, previous.checks);
if (refreshSource) {
  previous.sourceHashes = sourceHashes;
  previous.sourceAssociation = {
    kind: "query-sync-only-after-live-replay",
    proof: "scripts/lib/ui-phase2-token-query-delta.mjs",
    pngRewritten: 0,
    checksReplayed: checks.length,
  };
  await writeFile(`${output}/evidence.json`, JSON.stringify(previous, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    browserAndServerClosed: true,
  }),
);
