import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildJourneyDesignData } from "./lib/ui-phase2-journey-design-data.mjs";
import { journeyFieldsMode } from "./lib/ui-phase2-journey-fields-mode.mjs";
import { verifyJourneyFieldsHistory } from "./lib/ui-phase2-journey-fields-history.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "output/playwright/p16-c-r2-fields-review",
  root = path.join(repo, relative);
const { smoke, capture, current } = journeyFieldsMode(process.argv.slice(2));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(
  await readFile(path.join(repo, "output/playwright/p16-c-r2-review/evidence.json"), "utf8"),
);
const files = [
  ...new Set([
    ...Object.keys(parent.sourceHashes),
    "apps/web/src/design/theme.ts",
    "apps/web/src/use-navigation-shell-theme.ts",
    "scripts/verify-ui-phase2-journey-fields.mjs",
    "scripts/lib/ui-phase2-journey-fields-mode.mjs",
    "scripts/lib/ui-phase2-journey-fields-history.mjs",
  ]),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let previous;
if (!smoke && !capture && !current) {
  // Validate immutable capture provenance separately; the browser below uses current files.
  previous = await verifyJourneyFieldsHistory(repo);
}
const data = await buildJourneyDesignData(repo),
  checks = [],
  groupChecks = [],
  screenshots = [];
const fixture = structuredClone(data.sample);
fixture.results[1] = structuredClone(data.qualified);
const envelope = (data) => ({ data, request_id: "p16-fields", trace_id: "p16-fields" });
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  if (capture) await mkdir(root, { recursive: true });
  for (const width of smoke ? [390] : [1440, 390]) {
    for (const theme of smoke ? ["deep-ocean"] : ["deep-ocean", "aurora-purple", "cloud-white"]) {
      const dimensions = {};
      for (const density of ["standard", "compact"]) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          reducedMotion: "reduce",
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
        });
        try {
          const page = await context.newPage(),
            errors = [],
            unexpected = [],
            writes = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.route("**/*", (route) => {
            const request = route.request(),
              url = new URL(request.url());
            if (!url.pathname.startsWith("/api/")) {
              if (url.origin === "http://127.0.0.1:5175") return route.continue();
              unexpected.push(url.href);
              return route.abort();
            }
            if (request.method() !== "GET") {
              writes.push(url.pathname);
              return route.abort();
            }
            if (url.pathname === "/api/v1/me/ui-preferences")
              return route.fulfill({ json: envelope({ theme, version: 1 }) });
            if (url.pathname === "/api/v1/me/navigation")
              return route.fulfill({
                json: envelope({
                  shell: "member",
                  organization_id: fixture.organization_id,
                  workspace_id: fixture.workspace_id,
                  roles: ["member"],
                  capabilities: ["task:create", "opportunity:read", "opportunity:decide"],
                  platform_roles: [],
                  platform_capabilities: [],
                  guard_reason: "allowed",
                }),
              });
            if (url.pathname === `/api/v1/selection-journeys/${fixture.id}`)
              return route.fulfill({ json: envelope(fixture) });
            unexpected.push(url.pathname);
            return route.abort();
          });
          const applyDensity = () =>
            page.evaluate(async (value) => {
              const { applyDensity } = await import("/src/design/theme.ts");
              applyDensity(value);
            }, density);
          const settle = () =>
            page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
          const verifyGroup = async (name, radioName, count) => {
            if (!current) return;
            const group = page.getByRole("radiogroup", { name, exact: true });
            assert.equal(await group.count(), 1, `unique radio group: ${name}`);
            const radios = group.getByRole("radio");
            assert.equal(await radios.count(), count, `radio count: ${name}`);
            assert.equal(
              await radios.evaluateAll(
                (nodes, expectedName) =>
                  nodes.every(
                    (node) =>
                      node.tagName === "INPUT" &&
                      node.getAttribute("type") === "radio" &&
                      node.getAttribute("name") === expectedName &&
                      !node.hasAttribute("tabindex"),
                  ),
                radioName,
              ),
              true,
              `native keyboard semantics: ${name}`,
            );
            groupChecks.push({ width, theme, density, name, radioName, count });
          };
          const metrics = async (selector, { radio = false, focus = false } = {}) => {
            const target = page.locator(selector).first();
            await target.scrollIntoViewIfNeeded();
            await settle();
            const result = await target.evaluate(
              (el, options) => {
                const c = getComputedStyle(el),
                  parent = el.closest("label"),
                  r = (options.radio ? parent : el).getBoundingClientRect();
                const color = (v) =>
                  v
                    .match(/[\d.]+/g)
                    .slice(0, 3)
                    .map(Number);
                const luminance = (v) =>
                  color(v)
                    .map((n) => {
                      const k = n / 255;
                      return k <= 0.04045 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4;
                    })
                    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
                const contrast = (a, b) => {
                  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
                  return (values[0] + 0.05) / (values[1] + 0.05);
                };
                const p = getComputedStyle(parent),
                  hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return {
                  width: r.width,
                  height: r.height,
                  right: r.right,
                  x: r.x,
                  font: parseFloat((options.radio ? p : c).fontSize),
                  hit: (options.radio ? parent : el).contains(hit),
                  borderContrast: options.radio
                    ? null
                    : contrast(c.borderTopColor, c.backgroundColor),
                  textContrast: options.radio ? null : contrast(c.color, c.backgroundColor),
                  placeholderContrast:
                    el.tagName === "INPUT" && !options.radio
                      ? contrast(getComputedStyle(el, "::placeholder").color, c.backgroundColor)
                      : null,
                  focusVisible: el.matches(":focus-visible"),
                  rowFocus: p.outlineStyle !== "none" && parseFloat(p.outlineWidth) >= 2,
                  outlineWidth: parseFloat(c.outlineWidth),
                  opacity: c.opacity,
                  border: c.borderTopColor,
                  overflow: document.documentElement.scrollWidth > innerWidth + 1,
                };
              },
              { radio },
            );
            assert.ok(
              result.width >= 44 &&
                result.height >= 44 &&
                result.font >= 16 &&
                result.hit &&
                result.x >= 0 &&
                result.right <= width + 1 &&
                !result.overflow,
              JSON.stringify({ selector, theme, density, width, result }),
            );
            if (!radio) {
              assert.ok(result.borderContrast >= 3, `field boundary: ${JSON.stringify(result)}`);
              assert.ok(result.textContrast >= 4.5);
              if (result.placeholderContrast !== null)
                assert.ok(
                  result.placeholderContrast >= 4.5,
                  `placeholder: ${JSON.stringify(result)}`,
                );
            }
            if (focus) {
              assert.equal(result.focusVisible, true);
              assert.ok(
                radio ? result.rowFocus : result.outlineWidth >= 3,
                `focus: ${JSON.stringify(result)}`,
              );
            }
            checks.push({ width, theme, density, selector, radio, focus, metrics: result });
          };
          const shot = async (scene) => {
            if (!capture) return;
            const file = `${width}-${theme}-${density}-${scene}.png`;
            const bytes = await page.screenshot({ fullPage: false, animations: "disabled" });
            await writeFile(path.join(root, file), bytes);
            screenshots.push({ width, theme, density, scene, file, sha256: hash(bytes) });
          };
          await page.goto("http://127.0.0.1:5175/opportunities/start");
          await page.locator(".selection-start").waitFor();
          await page.waitForFunction(
            (value) => document.documentElement.dataset.theme === value,
            theme,
          );
          await applyDensity();
          await settle();
          dimensions[density] = await page.locator(".selection-start").evaluate((el) => ({
            height: el.getBoundingClientRect().height,
            padding: parseFloat(getComputedStyle(el).paddingTop),
            gap: parseFloat(getComputedStyle(el).gap),
          }));
          await metrics(".selection-input input");
          await verifyGroup("输入类型", "input-kind", 3);
          const keyword = page.getByRole("radio", { name: "关键词", exact: true });
          await keyword.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          await metrics('.selection-kind input[value="keyword"]', { radio: true, focus: true });
          await page.keyboard.press("ArrowRight");
          assert.equal(
            await page.getByRole("radio", { name: "ASIN", exact: true }).isChecked(),
            true,
          );
          await metrics('.selection-kind input[value="asin"]', { radio: true, focus: true });
          await page.keyboard.press("Tab");
          const input = page.locator(".selection-input input");
          await input.fill("B0TEST0001");
          await metrics(".selection-input input", { focus: true });
          assert.equal(
            await input.evaluate((el) => el.validity.valid && el.maxLength === 200 && el.required),
            true,
          );
          await input.fill("short");
          assert.equal(await input.evaluate((el) => el.validity.patternMismatch), true);
          await shot("input-focus");
          await page.getByRole("radio", { name: "商品链接", exact: true }).check();
          assert.equal(await input.getAttribute("type"), "url");
          await input.fill("https://example.com/product");
          await metrics(".selection-input input");
          assert.equal(await input.evaluate((el) => el.validity.valid), true);
          await page.evaluate(
            (id) => localStorage.setItem("scoutops.selection-journey.active-id", id),
            fixture.id,
          );
          await page.reload();
          await page.locator(".selection-decision").waitFor();
          await applyDensity();
          await settle();
          await verifyGroup("候选结果", "selection-candidate", fixture.results.length);
          await verifyGroup("决策方式", "decision", 3);
          await page.getByText("隔离候选 2", { exact: true }).click();
          const candidate = page.locator(".selection-candidate-grid input").nth(1);
          await candidate.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          await metrics(".selection-candidate-grid > label:nth-child(2) input", {
            radio: true,
            focus: true,
          });
          const adopt = page.getByRole("radio", { name: "采纳合格机会", exact: true });
          assert.equal(await adopt.isEnabled(), true);
          await adopt.check();
          await adopt.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          await metrics('.selection-actions input[value="adopt"]', { radio: true, focus: true });
          await page.keyboard.press("ArrowRight");
          assert.equal(
            await page.getByRole("radio", { name: "继续观察", exact: true }).isChecked(),
            true,
          );
          await page.keyboard.press("Tab");
          await page.getByLabel("决策原因").fill("三主题与两密度隔离审阅；不提交真实决策。");
          await metrics(".selection-decision textarea", { focus: true });
          await shot("reason-focus");
          assert.equal(
            await page
              .getByLabel("决策原因")
              .evaluate((el) => el.required && el.maxLength === 1000),
            true,
          );
          await page.getByText("隔离候选 1", { exact: true }).click();
          assert.equal(await adopt.isDisabled(), true);
          assert.equal(
            await page.getByRole("radio", { name: "继续观察", exact: true }).isChecked(),
            true,
          );
          assert.deepEqual(writes, []);
          assert.deepEqual(unexpected, []);
          assert.deepEqual(errors, []);
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
          assert.equal(
            await page.evaluate(() => document.documentElement.dataset.density),
            density,
          );
        } finally {
          await context.close();
        }
      }
      assert.ok(
        dimensions.compact.padding < dimensions.standard.padding &&
          dimensions.compact.gap < dimensions.standard.gap &&
          dimensions.compact.height < dimensions.standard.height,
        `density must affect spacing: ${JSON.stringify(dimensions)}`,
      );
    }
  }
  if (capture) {
    assert.equal(screenshots.length, 24);
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          version: "P16-C-r2-fields-1",
          boundary:
            "Mounted Vue; three existing theme IDs compatibility, not three redesigned palettes; two densities; intercepted HTTP, no writes; pending detailed visual review",
          sourceHashes,
          checks,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const cards = screenshots
      .map(
        (s) =>
          `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.theme} ${s.density} ${s.width}"></a><figcaption>${s.theme} · ${s.density} · ${s.width} · ${s.scene}</figcaption></figure>`,
      )
      .join("");
    await writeFile(
      path.join(root, "index.html"),
      [
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P16真实表单主题与密度审阅</title>',
        "<style>body{font:16px/1.6 system-ui;margin:24px;background:#edf1f6;color:#202c3d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:20px}figure{margin:0;padding:16px;background:white}img{width:100%;height:420px;object-fit:contain;object-position:top}a{color:#254a9c}</style>",
        "<h1>P16真实表单 · 待审</h1><p>原三主题环境、两密度；P16保持获审C配色，不是三套新主题。滚动到焦点字段的视口图；隔离数据，不连接真实业务服务。</p><main>",
        cards,
        "</main>\n",
      ].join(""),
    );
  } else if (!smoke && !current) assert.deepEqual(previous.checks, checks);
  if (current) {
    assert.equal(checks.length, 96);
    assert.equal(groupChecks.length, 36);
    assert.equal(screenshots.length, 0);
  }
  console.log(
    JSON.stringify({
      mode: smoke ? "smoke" : capture ? "capture" : current ? "current" : "verify",
      checks: checks.length,
      screenshots: capture ? screenshots.length : (previous?.screenshots.length ?? 0),
      businessWrites: 0,
      ...(current
        ? {
            groupChecks: groupChecks.length,
            runs: groupChecks.length / 3,
            sourceFingerprint: hash(JSON.stringify(sourceHashes)),
            historicalPacketValidated: false,
          }
        : {}),
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
