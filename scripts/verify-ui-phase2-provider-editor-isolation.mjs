import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const baseline = process.argv.includes("--baseline"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => ["--baseline", "--capture"].includes(v)));
const mode = baseline ? "baseline" : "current";
const output = `output/playwright/p46-editor-isolation/${mode}`;
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const registry = "apps/web/src/components/ProviderRegistry.vue";
const source = await read(registry);
const previous = execFileSync("git", ["show", `2bfb9038:${registry}`], {
  encoding: "utf8",
}).replaceAll("\r\n", "\n");
assert.equal(hash(previous), "ebd8b3876f9911ca6d5a0be6bac7a9352d977fa2446f4407342e54cd92b1fe1c");
const fixture = "tests/e2e/m03-01-provider-registry.spec.ts";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const box = {};
vm.runInNewContext(
  ["definition", "blockedDefinition", "definitions", "navigation"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1);
      return `const ${name}=${matches[0].initializer.getText(ast)};`;
    })
    .join("\n") + "globalThis.data={definition,definitions,navigation};",
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const sources = new Set([
  registry,
  fixture,
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-provider-editor-isolation.mjs",
]);
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p46-isolation-baseline-only",
      enforce: "pre",
      transform(text, id) {
        if (id.replaceAll("\\", "/") !== path.resolve(registry).replaceAll("\\", "/")) return null;
        assert.equal(text.replaceAll("\r\n", "\n"), source);
        return baseline ? { code: previous, map: null } : null;
      },
    },
  ],
});

const observations = [],
  screenshots = [],
  checks = [],
  network = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log("p46_isolation_host " + origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const [width, height] of [
    [390, 1000],
    [760, 1000],
    [761, 1000],
    [1440, 1000],
    [390, 568],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    let releaseWrite;
    try {
      const page = await context.newPage(),
        requests = [],
        unexpected = [],
        errors = [];
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}x${height}:${name}`);
        checks.push({ width, height, name, actual });
      };
      await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          method = req.method();
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = method + " " + url.pathname;
        if (
          ![
            "GET /api/v1/auth/session-status",
            "GET /api/v1/me/navigation",
            "GET /api/v1/platform/providers",
            "GET /api/v1/platform/provider-adapters",
            "PUT /api/v1/platform/providers/" + data.definition.id,
          ].includes(key)
        ) {
          unexpected.push(key);
          return route.abort();
        }
        requests.push({ key, body: method === "PUT" ? req.postDataJSON() : null });
        if (method === "PUT") {
          await new Promise((r) => {
            releaseWrite = r;
          });
          return route.fulfill({
            status: 409,
            json: {
              error: {
                code: "provider_version_conflict",
                message: "本地冲突样例",
                action_hint: "请重新核对来源版本。",
              },
              request_id: "isolation-conflict",
              trace_id: "isolation",
            },
          });
        }
        const payload = url.pathname.endsWith("session-status")
          ? { authenticated: true }
          : url.pathname.endsWith("navigation")
            ? data.navigation
            : url.pathname.endsWith("providers")
              ? data.definitions
              : [];
        return route.fulfill({
          json: { data: payload, request_id: "isolation-read", trace_id: "isolation" },
        });
      });
      const settle = async () => {
        await page.clock.runFor(160);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(async () => {
          await Promise.all(
            document
              .getAnimations()
              .filter(
                (a) =>
                  a.playState === "running" &&
                  Number.isFinite(a.effect?.getComputedTiming().endTime),
              )
              .map((a) =>
                a.finished.catch((e) => {
                  if (e?.name !== "AbortError") throw e;
                }),
              ),
          );
        });
      };
      const panel = () => page.locator(".provider-editor");
      const create = () => page.locator(".provider-hero > button");
      const shot = async (state) => {
        await settle();
        if (!capture) return;
        const bytes = await page.screenshot({ animations: "allow" }),
          file = `${width}x${height}-${state}.png`;
        await writeFile(output + "/" + file, bytes);
        screenshots.push({ width, height, state, file, sha256: hash(bytes) });
      };
      const background = async (state) => {
        const result = await page.evaluate(() => {
          const editor = document.querySelector(".provider-editor"),
            button = document.querySelector(".provider-hero > button");
          const targets = [
            button,
            document.querySelector(".provider-runtime-tabs"),
            document.querySelector(".role-topbar"),
          ].filter(Boolean);
          button.focus({ preventScroll: true });
          return {
            focusEscaped: document.activeElement === button,
            editorInert: !!editor.closest("[inert]"),
            targets: targets.map((n) => ({ class: n.className, inert: !!n.closest("[inert]") })),
            overflow: document.documentElement.style.getPropertyValue("overflow"),
          };
        });
        observations.push({ width, height, state, ...result });
        check(state + " background focus", result.focusEscaped, baseline);
        check(state + " editor remains interactive", result.editorInert, false);
        check(
          state + " background inert",
          result.targets.every((t) => t.inert),
          !baseline,
        );
        if (!baseline) check(state + " scroll lock", result.overflow, "hidden");
        await panel().locator("input,select").first().focus();
      };
      const released = async (state) => {
        await settle();
        const result = await page.evaluate(() => ({
          inert: [...document.querySelectorAll("[inert]")].map((n) => n.id || n.className),
          overflow: document.documentElement.style.getPropertyValue("overflow"),
          priority: document.documentElement.style.getPropertyPriority("overflow"),
        }));
        observations.push({ width, height, state, ...result });
        check(state + " no leaked inert", result.inert, []);
        check(state + " original overflow", result.overflow, "");
      };
      await page.goto(origin + "/platform-admin/providers/adapters");
      await expect(page.locator(".provider-runtime-tabs")).toBeVisible();
      await page
        .locator('.provider-runtime-tabs a[href="/platform-admin/providers"]')
        .filter({ hasText: "来源设置" })
        .click();
      await expect(page.locator(".provider-list-tools")).toBeVisible();
      await settle();
      check("production body class", await page.locator("body").getAttribute("class"), null);
      await create().click();
      await expect(panel()).toBeVisible();
      await settle();
      await shot("create-open");
      await background("create");
      // A real wheel over the scrim must not scroll the document behind the editor.
      await page.mouse.move(2, Math.floor(height / 2));
      const geometry = () =>
        page.evaluate(() => {
          const rect = document.querySelector(".provider-editor").getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            scrollY,
            viewportTop: visualViewport?.offsetTop ?? null,
          };
        });
      const beforeGeometry = await geometry();
      const beforeY = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 620);
      await settle();
      // Native scrolling can finish in the compositor after JS timer advancement.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const afterY = await page.evaluate(() => scrollY);
      observations.push({ width, height, state: "scrim-wheel", beforeY, afterY });
      if (!baseline) check("scrim wheel stays", afterY, beforeY);
      await shot("scrim-wheel");
      const afterGeometry = await geometry();
      observations.push({
        width,
        height,
        state: "scrim-wheel-layout",
        beforeGeometry,
        afterGeometry,
      });
      if (!baseline) check("painted editor remains in place", afterGeometry, beforeGeometry);
      const innerBefore = await panel().evaluate((n) => {
        n.scrollTop = 0;
        return { top: n.scrollTop, maximum: n.scrollHeight - n.clientHeight };
      });
      const rect = await panel().boundingBox();
      await page.mouse.move(rect.x + rect.width - 10, rect.y + rect.height / 2);
      await page.mouse.wheel(0, 320);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const innerAfter = await panel().evaluate((n) => n.scrollTop);
      observations.push({
        width,
        height,
        state: "inner-scroll",
        ...innerBefore,
        after: innerAfter,
      });
      check(
        "editor content remains scrollable",
        innerBefore.maximum <= 0 || innerAfter > innerBefore.top,
      );
      await panel().locator("input").first().focus();
      await page.keyboard.press("Escape");
      await expect(panel()).toHaveCount(0);
      await released("create-close");
      await expect(create()).toBeFocused();
      check("create return focus", true);
      await create().click();
      await settle();
      // Existing inert values and dynamically inserted siblings are a synthetic lifecycle probe.
      await page.evaluate(() => {
        const n = document.createElement("button");
        n.id = "p46-dynamic-background";
        n.textContent = "隔离验证节点";
        document.querySelector(".provider-registry").append(n);
      });
      await settle();
      check(
        "dynamic sibling inert",
        await page.locator("#p46-dynamic-background").evaluate((n) => n.inert),
        !baseline,
      );
      await panel().getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
      await settle();
      check(
        "dynamic sibling restored",
        await page.locator("#p46-dynamic-background").evaluate((n) => n.hasAttribute("inert")),
        false,
      );
      await page.locator("#p46-dynamic-background").evaluate((n) => n.remove());
      await released("dynamic-close");
      await page.evaluate(() => {
        document.querySelector(".provider-overview").setAttribute("inert", "retained-before-open");
        document.documentElement.style.setProperty("overflow", "auto", "important");
      });
      await create().click();
      await settle();
      await panel().getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
      await settle();
      check(
        "preexisting inert restored",
        await page.locator(".provider-overview").getAttribute("inert"),
        "retained-before-open",
      );
      check(
        "preexisting scroll declaration restored",
        await page.evaluate(() => [
          document.documentElement.style.getPropertyValue("overflow"),
          document.documentElement.style.getPropertyPriority("overflow"),
        ]),
        ["auto", "important"],
      );
      await page.evaluate(() => {
        document.querySelector(".provider-overview").removeAttribute("inert");
        document.documentElement.style.removeProperty("overflow");
      });
      await released("preexisting-close");
      // Actual history navigation can leave the modal without activating an inert page control.
      await create().click();
      await settle();
      await page.goBack();
      await expect(page).toHaveURL(/\/providers\/adapters$/);
      await expect(panel()).toHaveCount(0);
      await released("history-away");
      await shot("history-away");
      await page.goForward();
      await expect(panel()).toBeVisible();
      await settle();
      check("cached return retains open editor", await panel().count(), 1);
      await background("history-return");
      await shot("history-return");
      await panel().getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
      await released("history-return-close");
      const record = () =>
        width <= 760
          ? page
              .locator(".responsive-data-view__mobile article > button")
              .filter({ hasText: "公开趋势 RSS" })
          : page
              .locator(".responsive-data-view__desktop tr")
              .filter({ hasText: "公开趋势 RSS" })
              .getByRole("button", { name: "编辑", exact: true });
      await record().click();
      if (width <= 760) {
        await expect(page.locator(".responsive-data-view__drawer")).toBeVisible();
        check("detail isolates App", await page.locator("#app").evaluate((n) => n.inert));
        await page
          .locator(".responsive-data-view__drawer")
          .getByRole("button", { name: "编辑来源", exact: true })
          .click();
        await expect(page.locator(".responsive-data-view__drawer")).toHaveCount(0);
      }
      await expect(panel()).toBeVisible();
      await settle();
      await background("edit-handoff");
      await shot("edit-open");
      await panel().getByRole("button", { name: "4 合规与发布", exact: true }).click();
      await panel().locator('button[type="submit"]').click();
      await expect(panel().locator('button[type="submit"]')).toBeDisabled();
      for (let i = 0; i < 500 && !releaseWrite; i++) await new Promise((r) => setTimeout(r, 10));
      assert.ok(releaseWrite, "held write");
      await background("pending");
      await shot("pending-save");
      releaseWrite();
      releaseWrite = null;
      await expect(panel().locator(".provider-editor-message")).toContainText(
        "请重新核对来源版本。",
      );
      await background("conflict");
      await shot("conflict");
      await page.keyboard.press("Escape");
      await expect(panel()).toHaveCount(0);
      await released("edit-close");
      await expect(record()).toBeFocused();
      check("edit returns record", true);
      await shot("edit-closed");
      check("no errors", errors, []);
      check("no unexpected requests", unexpected, []);
      network.push({ width, height, requests });
      console.log(`isolation passed ${width}x${height}`);
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
  const sourceHashes = Object.fromEntries(
    await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
  );
  await browser.close();
  browser = null;
  await server.close();
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P46-EDITOR-ISOLATION-r1",
          mode,
          sourceHashes,
          renderedRegistryHash: hash(baseline ? previous : source),
          checks,
          observations,
          screenshots,
          network,
          processesClosed: true,
          scope:
            "Actual App with local GET and rejected held PUT; focus/inert/wheel/history/detail handoff and cleanup. Synthetic dynamic/preexisting DOM probes explicitly separate. Not real save/auth, full modal/screen-reader/production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46模态交互</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P46 背景隔离 · ' +
        mode +
        "</h1><p>真实Vue、本地样例、未上线；截图不代表权限或保存验收。</p>" +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.width}×${s.height} · ${s.state}</h2><img loading="lazy" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      checks: checks.length,
      observations: observations.length,
      images: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
