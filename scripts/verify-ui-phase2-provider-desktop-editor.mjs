import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const output = `output/playwright/p46-desktop-editor/${mode}`;
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const registry = "apps/web/src/components/ProviderRegistry.vue";
const source = await read(registry);
const preview =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-desktop-editor-preview.css";
const names = [...source.matchAll(/<span id="provider-field-(\w+)-label">([^<]+)<\/span\s*>/g)].map(
  (m) => ({ key: m[1], name: m[2] }),
);
assert.equal(names.length, 23);
const groups = [names.slice(0, 5), names.slice(5, 11), names.slice(11, 18), names.slice(18)];
const fixture = "tests/e2e/m03-01-provider-registry.spec.ts";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const box = {};
vm.runInNewContext(
  ["definition", "navigation"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1);
      return `const ${name}=${matches[0].initializer.getText(ast)};`;
    })
    .join("\n") + "globalThis.data={definition,navigation};",
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const sources = new Set([
  registry,
  fixture,
  preview,
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-provider-desktop-editor.mjs",
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
      name: "p46-desktop-editor-review-only",
      transformIndexHtml(html) {
        return baseline
          ? html
          : html
              .replace("<body>", '<body class="p46-desktop-editor-review">')
              .replace(
                "</head>",
                '<link rel="stylesheet" href="/@fs/' +
                  path.resolve(preview).replaceAll("\\", "/") +
                  '"></head>',
              );
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
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  console.log("p46_desktop_host " + origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1024, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        unexpected = [],
        errors = [],
        requests = [];
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}:${name}`);
        checks.push({ width, name, actual });
      };
      await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = req.method() + " " + url.pathname;
        if (
          ![
            "GET /api/v1/auth/session-status",
            "GET /api/v1/me/navigation",
            "GET /api/v1/platform/providers",
          ].includes(key)
        ) {
          unexpected.push(key);
          return route.abort();
        }
        requests.push(key);
        return route.fulfill({
          json: {
            data: url.pathname.endsWith("session-status")
              ? { authenticated: true }
              : url.pathname.endsWith("navigation")
                ? data.navigation
                : [data.definition],
            request_id: "field-sample",
            trace_id: "field-sample",
          },
        });
      });
      await page.goto(origin + "/platform-admin/providers");
      await expect(page.locator(".provider-list-tools")).toBeVisible();
      check(
        "review body marker",
        await page.locator("body").getAttribute("class"),
        baseline ? null : "p46-desktop-editor-review",
      );
      await page.getByRole("button", { name: "＋ 新建来源", exact: true }).click();
      const panel = page.locator(".provider-editor");
      const settle = async () => {
        await page.clock.runFor(100);
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
      const shot = async (state, locator = null) => {
        await settle();
        if (locator) await locator.scrollIntoViewIfNeeded();
        else
          await panel.evaluate((n) => {
            n.scrollTop = 0;
          });
        await settle();
        check(
          state + " width",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const bytes = locator
          ? await locator.screenshot({ animations: "allow" })
          : await page.screenshot({ animations: "allow" });
        const file = `${width}-${state}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          width,
          state,
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };
      for (let step = 0; step < groups.length; step++) {
        await panel.locator(".provider-editor-steps button").nth(step).click();
        const fields = panel.locator(".provider-fields label");
        check(`step${step + 1} field count`, await fields.count(), groups[step].length);
        const inspect = async (phase) => {
          for (let i = 0; i < groups[step].length; i++) {
            const { key, name } = groups[step][i],
              label = fields.nth(i),
              control = label.locator("input,select"),
              error = label.locator("small");
            const errorText = (await error.count()) ? (await error.innerText()).trim() : "";
            const hasValidation = source.includes(`id="provider-field-${key}-error"`);
            {
              await expect(control).toHaveAccessibleName(name, { exact: true });
              await expect(control).toHaveAccessibleDescription(errorText);
              check(
                `${phase}:${key} invalid`,
                await control.getAttribute("aria-invalid"),
                hasValidation ? String(Boolean(errorText)) : null,
              );
              check(
                `${phase}:${key} description reference`,
                await control.getAttribute("aria-describedby"),
                errorText ? `provider-field-${key}-error` : null,
              );
            }
            observations.push({
              width,
              step: step + 1,
              phase,
              key,
              name,
              errorText,
              value: await control.inputValue(),
              invalid: await control.getAttribute("aria-invalid"),
              describedby: await control.getAttribute("aria-describedby"),
              ax: await control.ariaSnapshot(),
            });
          }
          check(
            `${phase}:unique IDs step${step + 1}`,
            await panel.evaluate((n) => {
              const ids = [...n.querySelectorAll("[id]")].map((e) => e.id);
              return new Set(ids).size === ids.length;
            }),
          );
        };
        await inspect("initial");
        for (let i = 0; i < groups[step].length; i++) {
          const { key } = groups[step][i],
            control = fields.nth(i).locator("input,select");
          if (key === "terms_review_status") await control.selectOption("approved");
          else if (key === "status") await control.selectOption("enabled");
          else if (key === "access_mode") await control.selectOption("public_rss");
          else await control.fill(key === "healthcheck_url" ? "not-a-url" : "");
        }
        await inspect("invalid");
        for (let i = 0; i < groups[step].length; i++) {
          const { key } = groups[step][i],
            label = fields.nth(i),
            control = label.locator("input,select");
          if (i === 0 && (await label.locator("small").count())) {
            await control.focus();
            await shot(`step${step + 1}-${key}-invalid`, label);
          }
        }
        await shot(`step${step + 1}-invalid`);
        if (step < 3) {
          await panel.getByRole("button", { name: "下一步", exact: true }).click();
          await expect(panel.locator(".provider-editor-message")).toContainText("需要修正");
          check(
            `step${step + 1} blocked by same rules`,
            (
              await panel.locator('.provider-editor-steps button[aria-current="step"]').innerText()
            ).replace(/\s+/g, " "),
            `${step + 1} ${["基本信息", "范围与字段", "执行策略"][step]}`,
          );
        }
        for (let i = 0; i < groups[step].length; i++) {
          const { key } = groups[step][i],
            control = fields.nth(i).locator("input,select");
          const value = data.definition[key];
          if (["access_mode", "terms_review_status", "status"].includes(key))
            await control.selectOption(key === "status" ? "enabled" : value);
          else
            await control.fill(
              key === "terms_expires_at"
                ? "2027-08-07T17:00"
                : Array.isArray(value)
                  ? value.join(",")
                  : String(value ?? ""),
            );
        }
        await inspect("repaired");
        check(`step${step + 1} errors clear`, await fields.locator("small").count(), 0);
        await shot(`step${step + 1}-repaired`);
      }
      await expect(panel.locator('button[type="submit"]')).toBeEnabled();
      check("all repaired permits submit", true);
      // Preserve the real repaired-but-stale summary above. Clear it only through
      // the existing successful Next action, never by mutating Vue or the DOM.
      await panel.locator(".provider-editor-steps button").nth(0).click();
      await panel.getByRole("button", { name: "下一步", exact: true }).click();
      await expect(panel.locator(".provider-editor-message")).toHaveCount(0);
      check("successful next clears summary", true);
      for (let step = 0; step < groups.length; step++) {
        await panel.locator(".provider-editor-steps button").nth(step).click();
        const first = panel.locator(".provider-fields input, .provider-fields select").first();
        await first.focus();
        await shot(`step${step + 1}-ready`);
        await page.keyboard.press("Tab");
        check(
          `step${step + 1} field Tab stays inside`,
          await panel.evaluate((n) => n.contains(document.activeElement)),
        );
        const geometry = await panel.evaluate((n) => {
          const r = n.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            columns: getComputedStyle(
              n.querySelector(".provider-fields"),
            ).gridTemplateColumns.split(" ").length,
          };
        });
        check(
          `step${step + 1} dialog fits viewport`,
          geometry.left >= 0 &&
            geometry.right <= width + 1 &&
            geometry.top >= 0 &&
            geometry.bottom <= 1001,
        );
        if (!baseline && width > 760)
          check(`step${step + 1} responsive columns`, geometry.columns, width < 1024 ? 1 : 2);
      }
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(page.getByRole("button", { name: "＋ 新建来源", exact: true })).toBeFocused();
      check("close restores trigger", true);
      check("no unexpected network", unexpected, []);
      check("no browser errors", errors, []);
      check(
        "only GET",
        requests.every((r) => r.startsWith("GET ")),
      );
      network.push({ width, requests });
      console.log(`fields passed ${width}`);
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
          kind: "P46-DESKTOP-EDITOR-REVIEW-r1",
          mode,
          sourceHashes,
          renderedRegistryHash: hash(source),
          observations,
          screenshots,
          checks,
          network,
          processesClosed: true,
          scope:
            "Current real App route; review-only desktop CSS toggled. All 23 fields checked initial/invalid/repaired; existing validation unchanged. GET fixtures only; no writes, no full modal, permissions, screen-reader or production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46桌面编辑窗审核</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P46 桌面编辑窗 C 方向 · ' +
        mode +
        "</h1><p>真实 Vue、本地样例、未上线。语义观察见 evidence.json；截图不能证明读屏器播报。</p>" +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.width} · ${s.state}</h2><img loading="lazy" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      checks: checks.length,
      observations: observations.length,
      screenshots: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
