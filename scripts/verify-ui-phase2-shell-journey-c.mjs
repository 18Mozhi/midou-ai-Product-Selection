import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import ts from "typescript";
import { buildJourneyDesignData } from "./lib/ui-phase2-journey-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/shell-journey-direction-c";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const data = await buildJourneyDesignData(repo);
const fixture = ts.createSourceFile(
  "fixture.ts",
  await readFile(path.join(repo, "tests/e2e/ui-phase2-journey-contracts.spec.ts"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const guard = {};
for (const field of ["roles", "capabilities", "platform_roles", "platform_capabilities"]) {
  const matches = [];
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(fixture) === field)
      matches.push(node.initializer.getText(fixture));
    ts.forEachChild(node, visit);
  };
  visit(fixture);
  assert.equal(matches.length, 1, `Ambiguous P16 fixture ${field}`);
  guard[field] = JSON.parse(matches[0]);
}
const catalog = JSON.parse(await readFile(path.join(repo, "config/route-catalog.json"), "utf8"));
const p16 = catalog.routes.find((entry) => entry.path === "/opportunities/start");
assert.ok(p16.capabilities.some((value) => guard.capabilities.includes(value)));
const expectedMenu = catalog.routes.filter(
  (entry) =>
    entry.shell === "member" &&
    entry.navigation &&
    (!entry.capabilities.length ||
      entry.capabilities.some((value) => guard.capabilities.includes(value))),
);
const journey = structuredClone(data.sample);
journey.results[1] = structuredClone(data.qualified);
journey.first_result = journey.results[0];
const key = "scoutops.selection-journey.active-id";
const files = [
  `${relative}/Preview.vue`,
  `${relative}/composition.css`,
  "apps/web/src/components/SelectionJourney.vue",
  "apps/web/src/selection-journey.css",
  "apps/web/src/design/selection-tokens.css",
  "apps/web/src/components/UiStatePanel.vue",
  "apps/web/src/ui/state-contract.ts",
  "apps/web/src/ui/status-labels.ts",
  "apps/web/src/api-client.ts",
  "apps/web/src/components/NavigationShell.vue",
  "apps/web/src/navigation-shell-permissions.ts",
  "apps/web/src/navigation-shell-route-state.ts",
  "apps/web/src/route-catalog.ts",
  "apps/web/src/route-catalog.generated.json",
  "config/route-catalog.json",
  "tests/e2e/ui-phase2-journey-contracts.spec.ts",
  "scripts/lib/ui-phase2-journey-design-data.mjs",
  "scripts/verify-ui-phase2-shell-journey-c.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => [
      file,
      hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
if (!capture && !smoke) {
  const previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  const expectedShots = [1440, 390].flatMap((width) =>
    [
      "input",
      "return-draft",
      "candidate-unselected",
      "five-gates",
      ...(width === 390 ? ["navigation-open"] : []),
      ...(expectedMenu.length >= 8 ? ["navigation-empty"] : []),
    ].map((scene) => `${width}-${scene}.png`),
  );
  assert.deepEqual(
    previous.screenshots.map((shot) => shot.file),
    expectedShots,
  );
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const entry = "/__shell_journey_preview.js";
const code = `import {createApp} from 'vue';import {createRouter,createMemoryHistory} from 'vue-router';
import Preview from ${JSON.stringify(`/@fs/${path.join(root, "Preview.vue").replaceAll("\\", "/")}`)};
import {authorizedNavigation,shellRoleSummary,canOpenRoute} from '/src/navigation-shell-permissions.ts';
const guard=${JSON.stringify(guard)};
if(!canOpenRoute(${JSON.stringify(p16.capabilities)},guard.capabilities,'member',guard.roles))throw new Error('P16 fixture denied');
const profile={items:authorizedNavigation('member',guard.capabilities,guard.roles),roleLabel:shellRoleSummary('member',guard)};
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
await router.push('/opportunities/start');await router.isReady();createApp(Preview,{profile}).use(router).mount('#app');`;
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
  plugins: [
    {
      name: "review-only-shell-journey",
      resolveId(id) {
        if (id === entry) return id;
      },
      load(id) {
        if (id === entry) return code;
      },
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== "/__shell_journey_preview/") return next();
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>C壳层与P16组合待审</title></head><body><div id="app"></div><script type="module" src="${entry}"></script></body></html>`,
          );
        });
      },
    },
  ],
});
const screenshots = [],
  checks = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        writes = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.origin !== "http://127.0.0.1:5175") {
          unexpected.push(url.href);
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (request.method() !== "GET")
          writes.push({ path: url.pathname, method: request.method() });
        if (
          request.method() === "GET" &&
          url.pathname === `/api/v1/selection-journeys/${journey.id}`
        )
          return route.fulfill({
            json: {
              data: journey,
              request_id: "composition-fixture",
              trace_id: "composition-fixture",
            },
          });
        unexpected.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({
          status: 503,
          json: { error: { code: "unregistered_preview_request" } },
        });
      });
      const check = (name, result) => {
        assert.ok(result, `${width}: ${name}`);
        checks.push({ width, name });
      };
      async function shot(scene, fullPage = true) {
        check(
          `${scene} no horizontal overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (capture) {
          const bytes = await page.screenshot({ fullPage, animations: "disabled" });
          const file = `${width}-${scene}.png`;
          await writeFile(path.join(root, file), bytes);
          screenshots.push({ file, scene, width, sha256: hash(bytes) });
        }
      }
      await page.goto("http://127.0.0.1:5175/__shell_journey_preview/");
      await page.locator(".selection-start").waitFor();
      check(
        "mobile opener matches breakpoint",
        (await page.locator(".composition-menu-trigger").isVisible()) === width <= 840,
      );
      check(
        "stage circles stay square",
        await page.locator(".selection-stage-rail li > span").evaluateAll((nodes) =>
          nodes.every((node) => {
            const r = node.getBoundingClientRect();
            return r.width >= 34 && Math.abs(r.width - r.height) < 1;
          }),
        ),
      );
      if (width === 390)
        check(
          "bottom menu has no empty columns",
          await page
            .locator(".composition-mobile")
            .evaluate(
              (node) =>
                getComputedStyle(node).gridTemplateColumns.split(" ").length ===
                node.children.length,
            ),
        );
      check(
        "real P16 with four source stages",
        (await page.locator(".selection-stage-rail li").count()) === 4,
      );
      check(
        "source-derived member menu",
        (await page.locator(".composition-directory nav a").count()) === expectedMenu.length,
      );
      await shot("input");
      if (smoke) {
        check("no errors", !errors.length && !unexpected.length);
        continue;
      }
      await page.getByLabel("商品关键词", { exact: true }).fill("组合审核草稿");
      await page.locator(".selection-workspace > header a").click();
      await page.locator(".composition-destination").waitFor();
      check(
        "real router target is opportunities",
        (await page.locator(".composition-destination").innerText()).includes("/opportunities"),
      );
      await page.getByRole("link", { name: "返回创建选品", exact: true }).click();
      check(
        "KeepAlive return retains P16 input",
        (await page.getByLabel("商品关键词", { exact: true }).inputValue()) === "组合审核草稿",
      );
      await shot("return-draft");
      await page.evaluate(({ key, id }) => localStorage.setItem(key, id), { key, id: journey.id });
      await page.reload();
      await page.locator(".selection-decision").waitFor();
      await shot("candidate-unselected");
      await page.getByText("隔离候选 2", { exact: true }).click();
      check(
        "five actual source gate rows",
        (await page.locator('.selection-quality-gates dd[data-passed="true"]').count()) === 5,
      );
      await shot("five-gates");
      const before = await page.locator(".selection-journey").innerText();
      if (width === 390) {
        await page.getByRole("button", { name: "导航", exact: true }).click();
        check(
          "native modal open",
          await page.locator("#composition-menu").evaluate((node) => node.open),
        );
        await shot("navigation-open", false);
        await page.keyboard.press("Shift+Tab");
        check(
          "modal focus loop",
          await page
            .locator("#composition-menu nav a")
            .last()
            .evaluate((node) => node === document.activeElement),
        );
        if (expectedMenu.length >= 8) {
          await page.locator("#composition-menu input").fill("不存在的菜单");
          await shot("navigation-empty", false);
        }
        await page.keyboard.press("Escape");
        check(
          "Escape restores opener",
          await page
            .getByRole("button", { name: "导航", exact: true })
            .evaluate((node) => node === document.activeElement),
        );
        await page.getByRole("button", { name: "导航", exact: true }).click();
        await page.setViewportSize({ width: 1024, height: 1000 });
        await page.waitForFunction(() => !document.getElementById("composition-menu").open);
        check(
          "desktop transition closes native modal",
          await page.locator("#composition-menu").evaluate((node) => !node.open),
        );
        check(
          "desktop transition restores visible brand focus",
          await page
            .locator(".composition-brand")
            .evaluate((node) => node === document.activeElement),
        );
        await page.setViewportSize({ width: 390, height: 844 });
      } else if (expectedMenu.length >= 8) {
        await page.locator(".composition-directory input").fill("不存在的菜单");
        await shot("navigation-empty");
      }
      check(
        "navigation disclosure preserves P16 facts",
        (await page.locator(".selection-journey").innerText()) === before,
      );
      const visibleQuery = width === 390 ? null : page.locator(".composition-directory input");
      if (visibleQuery && expectedMenu.length >= 8) await visibleQuery.fill("");
      for (const breakpoint of width === 1440 ? [1024, 768, 1280] : [390]) {
        await page.setViewportSize({ width: breakpoint, height: 1000 });
        check(
          `${breakpoint} assembled overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        const reset = page.getByRole("button", { name: "开始下一次", exact: true });
        await reset.scrollIntoViewIfNeeded();
        // A control already inside the viewport can still be behind the fixed bottom bar.
        // Verify the user can reach the final action at the end of the scroll range.
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        check(
          `${breakpoint} footer hit`,
          await reset.evaluate((node) => {
            const r = node.getBoundingClientRect();
            return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
      }
      check("no write or unexpected network", !writes.length && !unexpected.length);
      check("no page errors", !errors.length);
      await page.evaluate((key) => localStorage.removeItem(key), key);
    } finally {
      await context.close();
    }
  }
  if (capture) {
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          kind: "review-only-shell-with-real-P16-and-intercepted-data",
          approval: "pending-composed-layout-review",
          sourceHashes,
          screenshots,
          checks,
          limits: [
            "Shell is review Vue, not production NavigationShell",
            "No real authorization, backend, production or full shell overlay acceptance",
            "Horizontal local stage layout is a new composition proposal, not previously approved",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    const rows = screenshots
      .map(
        (shot) =>
          `<figure><a href="${shot.file}"><img loading="lazy" src="${shot.file}" alt="${shot.width} ${shot.scene}"></a><figcaption>${shot.width} / ${shot.scene}</figcaption></figure>`,
      )
      .join("\n");
    await writeFile(
      path.join(root, "index.html"),
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C壳层与P16组合审核</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6;color:#202c3d}a{color:#254a9c}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;background:white;padding:16px;border-radius:12px}
img{width:100%;height:560px;object-fit:contain;object-position:top}a:focus-visible{outline:3px solid #254a9c}</style>
<h1>C壳层与P16组合待审</h1><p>左侧为新壳层提案，右侧为真实P16加组合专用CSS；拦截样本，非生产。横向阶段栏尚未获得批准。</p>
<p><a href="README.md">范围说明</a> · <a href="../../../../output/playwright/p16-c-r2-review/index.html">原获审P16布局与旧壳层对照</a></p><main>${rows}</main></html>\n`,
    );
  }
  console.log(
    `shell_journey_composition_verified ${JSON.stringify({ smoke, checks: checks.length, screenshots: screenshots.length })}`,
  );
} finally {
  if (browser) await browser.close();
  await server.close();
}
