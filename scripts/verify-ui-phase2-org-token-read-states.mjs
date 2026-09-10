import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((s) => s === "--capture"));
const design = "design-plans/ui-phase-2-2026-09-07/design/org-token-read-states";
const output = "output/playwright/p36-read-states-review";
const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
const apiFile = "apps/web/src/api-client.ts";
const original = "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const parent = await text(parentFile),
  api = await text(apiFile);
function initializer(source, name) {
  const ast = ts.createSourceFile("input.ts", source, ts.ScriptTarget.Latest, true),
    found = [];
  function walk(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
      found.push(n.initializer.getText(ast));
    ts.forEachChild(n, walk);
  }
  walk(ast);
  assert.equal(found.length, 1, name);
  return found[0];
}
const failureKind = new Function(
  ts.transpileModule(`return (${initializer(api, "failureKind")});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText,
)();
const replacementExpression = initializer(
  parent.split(/<script setup[^>]*>/)[1].split("</script>")[0],
  "mustReplacePage",
);
const replacePage = new Function("background", "failure", `return ${replacementExpression};`);
assert.match(parent, /@click="load\(\{ background: true \}\)"/);
assert.match(parent, /<button @click="load\(\)">重新加载<\/button>/);
assert.match(parent, /const response = await api\(`\/org\/admin\/\$\{currentView\}`\)/);
assert.match(parent, /api\("\/org\/admin\/summary"\)/);
const sourceFiles = [
  parentFile,
  apiFile,
  `${original}/data.js`,
  `${original}/tokens.css`,
  `${design}/index.html`,
  `${design}/read-states.css`,
  `${design}/read-states.js`,
  "scripts/verify-ui-phase2-org-token-read-states.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (f) => [f, hash(await text(f))])),
);
const retained = {};
for (const dir of [
  original,
  "output/playwright/p36-controls-review",
  "output/playwright/p36-fields-review",
  "output/playwright/p36-mobile-filters-vue",
  "output/playwright/p36-parent-read-vue",
  "output/playwright/p36-parent-read-vue-r2",
]) {
  const raw = await text(`${dir}/evidence.json`),
    evidence = JSON.parse(raw);
  for (const s of evidence.screenshots)
    assert.equal(hash(await readFile(`${dir}/${s.file}`)), s.sha256, s.file);
  retained[dir] = { manifest: hash(raw), pngCount: evidence.screenshots.length };
}
const previous = capture ? null : JSON.parse(await text(`${output}/evidence.json`));
if (previous) {
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  assert.deepEqual(previous.retained, retained);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const checks = [],
  screenshots = [],
  scenes = [],
  bindings = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (r) => {
      if (new URL(r.request().url()).protocol === "file:") return r.continue();
      external.push({ method: r.request().method(), url: r.request().url() });
      return r.abort();
    });
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, `${width}: ${name}`);
      checks.push({ width, name });
    };
    const open = async (id) => {
      await page.goto(`${pathToFileURL(path.resolve(`${design}/index.html`)).href}?scene=${id}`);
      await page.locator("#state-title").waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    const shot = async (name, selector) => {
      if (!capture) return;
      const file = `${name}-${width}.png`,
        bytes = await page.locator(selector).screenshot({ animations: "disabled" });
      await writeFile(`${output}/${file}`, bytes);
      screenshots.push({
        name,
        width,
        selector,
        file,
        sha256: hash(bytes),
        approval: "pending-user-review",
        scope: "isolated C proposal, not actual Vue or production acceptance",
      });
    };
    const focusByTab = async (selector) => {
      for (let i = 0; i < 12; i++) {
        if (await page.locator(selector).evaluate((n) => document.activeElement === n)) return;
        await page.keyboard.press("Tab");
      }
      throw Error(`cannot reach ${selector} with Tab`);
    };
    try {
      await open("initial-error");
      const definitions = await page.evaluate(() => window.P36_READ_STATES.scenes);
      if (width === 390) scenes.push(...definitions);
      check(
        "fourteen distinct phase and kind combinations",
        new Set(definitions.map((s) => s.id)).size,
        14,
      );
      for (const scene of definitions) {
        await open(scene.id);
        const pending = scene.kind === "loading";
        const status = await page.evaluate(
          (k) => window.P36_READ_STATES.variants[k][2],
          scene.kind,
        );
        const kind = pending ? "loading" : failureKind(status);
        check(`${scene.id} matches actual client failure kind`, scene.kind, kind);
        const keep = scene.phase === "background" && (pending || !replacePage(true, { kind }));
        const retry = !pending && !keep;
        check(
          `${scene.id} retained content follows actual parent`,
          await page.locator(".retained").count(),
          keep ? 1 : 0,
        );
        check(
          `${scene.id} retry follows actual parent branch`,
          await page.locator("#retry").count(),
          retry ? 1 : 0,
        );
        check(
          `${scene.id} refresh disabled only while reading`,
          await page.locator("#refresh").isDisabled(),
          pending,
        );
        check(
          `${scene.id} busy attribute`,
          await page.locator(".read-card").getAttribute("aria-busy"),
          String(pending),
        );
        check(
          `${scene.id} trace omitted while no response`,
          await page.locator("details").count(),
          pending ? 0 : 1,
        );
        check(
          `${scene.id} no secret or creation fields`,
          await page.locator("#surface input,#surface textarea,#surface form").count(),
          0,
        );
        check(
          `${scene.id} no overflow`,
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        );
        check(
          `${scene.id} controls at least44`,
          await page.locator("#surface button,#surface summary").evaluateAll((ns) =>
            ns.every((n) => {
              const r = n.getBoundingClientRect();
              return r.height >= 44 && r.width >= 44;
            }),
          ),
        );
        check(
          `${scene.id} main text at least16`,
          await page
            .locator(".read-description,.content-boundary")
            .evaluateAll((ns) => ns.every((n) => parseFloat(getComputedStyle(n).fontSize) >= 16)),
        );
        check(
          `${scene.id} no duplicate alert`,
          await page.locator('[role="alert"]').count(),
          pending ? 0 : 1,
        );
        check(
          `${scene.id} no animated countdown`,
          await page
            .locator("#surface *")
            .evaluateAll((ns) => ns.every((n) => getComputedStyle(n).animationName === "none")),
        );
        if (!pending) {
          await page.locator(".trace summary").click();
          check(
            `${scene.id} trace exposes existing request ID only`,
            await page.locator(".trace code").allTextContents(),
            ["p36-local-read-fixture"],
          );
          check(
            `${scene.id} raw fixture retained in trace`,
            (await page.locator(".trace dd").last().innerText()).includes(String(status)),
          );
          await page.locator(".trace summary").click();
        }
        await page.mouse.move(0, 0);
        await page.locator("#state-title").click();
        await shot(`scene-${scene.id}`, "#surface");
        if (scene.id === "initial-forbidden") await shot("panel-permission", ".read-card");
        if (!pending) {
          await page.locator("#refresh").click();
          if (retry) await page.locator("#retry").click();
          const expected = [
            {
              control: "refresh",
              scene: scene.id,
              method: "GET",
              paths: ["/org/admin/summary", "/org/admin/tokens"],
              background: true,
            },
          ];
          if (retry)
            expected.push({
              control: "retry",
              scene: scene.id,
              method: "GET",
              paths: ["/org/admin/summary", "/org/admin/tokens"],
              background: false,
            });
          check(
            `${scene.id} exact read-only intentions`,
            await page.evaluate(() => window.P36_READ_STATES.intents),
            expected,
          );
          if (width === 390)
            bindings.push({
              scene: scene.id,
              refresh: "OG-REFRESH:load({background:true})",
              retry: retry ? "OG-RETRY:load()" : null,
              trace: "native details proposal only",
              retained: keep,
              status,
            });
        } else {
          await page.locator("#refresh").evaluate((n) => n.click());
          check(
            `${scene.id} disabled native click does nothing`,
            await page.evaluate(() => window.P36_READ_STATES.intents),
            [],
          );
          if (width === 390)
            bindings.push({
              scene: scene.id,
              refresh: "OG-REFRESH:disabled",
              retry: null,
              trace: null,
              retained: keep,
              status: null,
            });
        }
      }
      for (const control of ["refresh", "retry"])
        for (const state of ["default", "hover", "focus", "pressed"]) {
          await open("initial-error");
          const target = page.locator(`#${control}`);
          if (["hover", "pressed"].includes(state)) await target.hover();
          if (state === "focus") await focusByTab(`#${control}`);
          if (state === "pressed") await page.mouse.down();
          const style = await target.evaluate((n) => ({
            background: getComputedStyle(n).backgroundColor,
            outline: getComputedStyle(n).outlineStyle,
            outlineWidth: getComputedStyle(n).outlineWidth,
          }));
          if (state === "focus") {
            check(`${control} native keyboard outline`, style.outline, "solid");
            check(`${control} focus width3`, style.outlineWidth, "3px");
          }
          if (state === "hover")
            check(
              `${control} hover visible`,
              style.background,
              control === "retry" ? "rgb(25, 59, 128)" : "rgb(228, 236, 255)",
            );
          if (state === "pressed")
            check(
              `${control} pressed visible`,
              style.background,
              control === "retry" ? "rgb(16, 43, 99)" : "rgb(208, 221, 246)",
            );
          await shot(
            `control-${control}-${state}`,
            control === "refresh" ? ".page-heading" : ".read-card",
          );
          if (state === "pressed") await page.mouse.up();
        }
      for (const state of ["focus", "open"]) {
        await open("initial-forbidden");
        await focusByTab(".trace summary");
        if (state === "open") await page.keyboard.press("Enter");
        check(
          `trace ${state} native details state`,
          await page.locator(".trace").evaluate((n) => n.open),
          state === "open",
        );
        await shot(`trace-${state}`, ".read-card");
      }
      check("zero external requests", external, []);
      check("zero browser errors", errors, []);
      check("zero cookies", await context.cookies(), []);
      check(
        "zero storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const result = {
  kind: "P36-READ-STATES-C-PROPOSAL",
  approval: "pending-user-review",
  sourceHashes,
  retained,
  scenes,
  bindings,
  checks,
  screenshots,
  boundary:
    "14 isolated parent-region proposals. No actual Vue implementation, API, permissions, secrets, storage, production or whole-page acceptance. Retained list is two existing synthetic fixture rows, not an invented count.",
  browserClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(result, null, 2) + "\n");
  const cards = screenshots
    .map(
      (s) =>
        `<figure><figcaption>${s.name} · ${s.width}px</figcaption><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="P36 ${s.name} ${s.width}像素"></a></figure>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 读取区域 C 方向审核图</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}a{color:#254a9c}figure{background:white;padding:16px;margin:0;min-width:0}img{max-width:100%;height:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:20px}</style>
<h1>P36 · 读取区域 C 方向审核图</h1><p>14种组合与按钮/追踪状态，共${screenshots.length}图。全部待审核，不是实际Vue或权限验收；列表仅为两条旧样例节选。</p><p><a href="../../../${design}/index.html">打开可操作提案</a> · <a href="evidence.json">源码对应与验证证据</a></p><div class="grid">${cards}</div></html>\n`,
  );
} else {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(bindings, previous.bindings);
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    scenes: scenes.length,
    oldImagesRetained: Object.values(retained).reduce((n, r) => n + r.pngCount, 0),
    browserClosed: true,
    externalRequests: 0,
    approval: "pending-user-review",
  }),
);
