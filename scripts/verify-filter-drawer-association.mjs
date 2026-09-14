import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

// Permanent, component-only browser regression. No business API, files or screenshots written.
assert.equal(process.argv.length, 2, "This verifier takes no arguments");
const styles = [
  ...(await readFile("apps/web/src/main.ts", "utf8")).matchAll(/import "\.\/(.*?\.css)";/g),
];
const entry = "/__filter_association.js";
const host = `import {createApp,h,ref} from 'vue';
import Drawer from '/src/components/ResponsiveFilterDrawer.vue';
${styles.map((match) => `import '/src/${match[1]}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const count=ref(0),mounted=ref(true),mode=ref('responsive'),appearance=ref('default');
window.fixture={count,mounted,mode,appearance};
createApp({setup:()=>()=>h('main',[
 h('h1','筛选面板关联验证'),
 ...['甲','乙','丙'].map((label,index)=>mounted.value || index!==0 ?
 h(Drawer,{key:label,label,activeCount:count.value,appearance:appearance.value,mode:index===2?'dialog':mode.value},{
 default:()=>[h('input',{'aria-label':label+'字段'}),h('button',{type:'button'},label+'末项')]
 }):null)
])}).mount('#app');`;
const reservation = reservePort();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const availablePort = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: availablePort, strictPort: true, open: false, proxy: {} },
  plugins: [
    {
      name: "filter-association-fixture",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url !== "/__filter_association") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>筛选关联验证</title>
<div id="app"></div><script type="module" src="${entry}"></script></html>`);
        });
      },
    },
  ],
});
let browser;
const results = [];
try {
  await server.listen();
  const port = server.httpServer.address().port;
  console.log(`filter_association_host=http://127.0.0.1:${port} pid=${process.pid}`);
  browser = await chromium.launch();
  for (const reducedMotion of ["reduce", "no-preference"]) {
    for (const width of [390, 760, 761, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
      try {
        const page = await context.newPage(),
          errors = [],
          blocked = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (
            url.hostname === "127.0.0.1" &&
            url.port === String(port) &&
            !url.pathname.startsWith("/api/") &&
            route.request().method() === "GET"
          )
            return route.continue();
          blocked.push(route.request().url());
          return route.abort();
        });
        await page.goto(`http://127.0.0.1:${port}/__filter_association`);
        await page.locator(".responsive-filter-drawer__trigger").nth(2).waitFor();
        async function associations() {
          return page.locator(".responsive-filter-drawer__trigger").evaluateAll((buttons) =>
            buttons.map((button) => {
              const id = button.getAttribute("aria-controls");
              const panel = id && document.getElementById(id);
              return {
                id,
                matches: id ? document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length : 0,
                name: panel?.getAttribute("aria-label"),
                role: panel?.getAttribute("role"),
                expanded: button.getAttribute("aria-expanded"),
              };
            }),
          );
        }
        const initial = await associations();
        assert.equal(initial.length, 3);
        assert.ok(
          initial.every((item) => item.id && item.matches === 1),
          "each trigger must resolve exactly one panel",
        );
        assert.equal(
          new Set(initial.map((item) => item.id)).size,
          3,
          "instances require distinct IDs",
        );
        assert.deepEqual(
          initial.map((item) => item.name),
          ["甲", "乙", "丙"],
        );
        assert.deepEqual(
          initial.map((item) => item.role),
          width <= 760 ? ["dialog", "dialog", "dialog"] : ["group", "group", "dialog"],
        );
        const ids = initial.map((item) => item.id);
        // Use the teleported sheet: ancestor page variables must not conceal missing local roles.
        for (const appearance of ["governance", "content", "notifications"]) {
          await page.evaluate((value) => (window.fixture.appearance.value = value), appearance);
          const panel = page.locator(`[id="${ids[2]}"]`);
          await page
            .locator(`.responsive-filter-drawer--${appearance}`)
            .first()
            .waitFor({ state: "attached" });
          const palette = await panel.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              background: style.backgroundColor,
              color: style.color,
              primary: style.getPropertyValue("--so-primary").trim(),
              border: style.getPropertyValue("--so-border").trim(),
            };
          });
          assert.deepEqual(
            palette,
            {
              background: "rgb(255, 255, 255)",
              color: "rgb(23, 36, 61)",
              primary: appearance === "governance" ? "#2d63cd" : "#2558bd",
              border: "#cfd9e8",
            },
            `${appearance}: teleported sheet palette`,
          );
        }
        await page.evaluate(() => (window.fixture.appearance.value = "default"));
        const assertStable = async () =>
          assert.deepEqual(
            (await associations()).map((item) => item.id),
            ids,
          );
        await page.evaluate(() => (window.fixture.count.value = 2));
        await page.getByText("2 项已选").first().waitFor({ state: "attached" });
        await assertStable();
        for (const index of width <= 760 ? [0, 1, 2] : [2]) {
          const trigger = page.locator(".responsive-filter-drawer__trigger").nth(index);
          const panel = page.locator(`[id="${ids[index]}"]`);
          await trigger.click();
          await page.waitForFunction(
            (id) => document.getElementById(id)?.getAttribute("aria-modal") === "true",
            ids[index],
          );
          assert.equal(await trigger.getAttribute("aria-expanded"), "true");
          await page.waitForFunction(
            (id) =>
              document.getElementById(id)?.querySelector("header button") ===
              document.activeElement,
            ids[index],
            { timeout: 3000 },
          );
          if (reducedMotion === "reduce") {
            for (const selector of [
              "header button",
              "input",
              ".responsive-filter-drawer__content button",
            ])
              assert.equal(
                await panel
                  .locator(selector)
                  .evaluate((el) => getComputedStyle(el).transitionProperty),
                "none",
              );
          }
          await page.keyboard.press("Shift+Tab");
          assert.equal(
            await panel
              .locator(".responsive-filter-drawer__content button")
              .evaluate((el) => el === document.activeElement),
            true,
          );
          await page.keyboard.press("Tab");
          assert.equal(
            await panel.locator("header button").evaluate((el) => el === document.activeElement),
            true,
          );
          await page.keyboard.press("Escape");
          await page.waitForFunction(
            (id) => document.querySelector(`[aria-controls="${id}"]`) === document.activeElement,
            ids[index],
          );
          assert.equal(await trigger.getAttribute("aria-expanded"), "false");
          await trigger.click();
          await panel.locator("header button").click();
          assert.equal(await trigger.getAttribute("aria-expanded"), "false");
          await assertStable();
        }
        // Real matchMedia/Teleport changes must preserve the same component-to-panel association.
        for (const nextWidth of [390, 1440, 760, 761, width]) {
          await page.setViewportSize({ width: nextWidth, height: 900 });
          await page.waitForFunction(
            ({ id, role }) => document.getElementById(id)?.getAttribute("role") === role,
            { id: ids[0], role: nextWidth <= 760 ? "dialog" : "group" },
          );
          await assertStable();
        }
        await page.evaluate(() => (window.fixture.mode.value = "dialog"));
        await page.waitForFunction(
          (id) => document.getElementById(id)?.getAttribute("role") === "dialog",
          ids[0],
        );
        await assertStable();
        await page.evaluate(() => (window.fixture.mounted.value = false));
        await page.locator(`[id="${ids[0]}"]`).waitFor({ state: "detached" });
        await page.evaluate(() => (window.fixture.mounted.value = true));
        await page.waitForFunction(
          () => document.querySelectorAll(".responsive-filter-drawer__trigger").length === 3,
        );
        const remounted = await associations();
        assert.ok(remounted.every((item) => item.id && item.matches === 1));
        assert.equal(new Set(remounted.map((item) => item.id)).size, 3);
        assert.notEqual(remounted[0].id, ids[0]);
        assert.deepEqual(
          remounted.slice(1).map((item) => item.id),
          ids.slice(1),
        );
        assert.deepEqual(errors, []);
        assert.deepEqual(blocked, []);
        results.push({
          width,
          reducedMotion,
          instances: 3,
          viewportChanges: 5,
          keyboardCases: width <= 760 ? 3 : 1,
          paletteCases: 3,
          errors: 0,
          blocked: 0,
        });
      } finally {
        await context.close();
      }
    }
  }
  console.log(
    JSON.stringify({
      passed: true,
      results,
      scope: "actual shared Vue; synthetic slots; no business API or full-page acceptance",
    }),
  );
} finally {
  await browser?.close();
  await server.close();
  console.log("filter_association_cleanup=browser-and-server-closed; no artifacts written");
}
