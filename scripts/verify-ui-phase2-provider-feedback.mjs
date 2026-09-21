import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Reuse the exact, independently verified async driver; only its host/evidence configuration
// and visual observations change. Actual current Vue template/script are never rewritten.
const file = "scripts/verify-ui-phase2-provider-async.mjs";
let runner = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  "c8e55ee26aa57a200be0ef4173c35331069602148cd311ab16a9c91fcfa097fd",
  "Review driver changed: inspect it before adapting this replay",
);
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
}
replace(
  'import { historicalProviderAsyncSource } from "./lib/ui-phase2-provider-async-baseline.mjs";',
  'import { historicalProviderFeedbackSource as historicalProviderAsyncSource } from "./lib/ui-phase2-provider-feedback-baseline.mjs";',
);
replace(
  'const baseline = process.argv.includes("--baseline");',
  'const baseline = false, visualBaseline = process.argv.includes("--baseline");',
);
replace(
  'const mode = baseline ? "baseline" : "current";',
  'const mode = visualBaseline ? "baseline" : "current";',
);
replace(
  'const output = "output/playwright/p46-provider-async-implementation/" + mode;',
  'const output = "output/playwright/p46-provider-feedback-implementation/" + mode;',
);
replace("[child]: baseline ?", "[child]: visualBaseline ?");
replace("[registryStyle]: baseline\n", "[registryStyle]: visualBaseline\n");
replace(
  '  "scripts/verify-ui-phase2-provider-async.mjs",',
  '  "scripts/verify-ui-phase2-provider-async.mjs",\n  "scripts/verify-ui-phase2-provider-feedback.mjs",\n  "scripts/lib/ui-phase2-provider-feedback-baseline.mjs",',
);
replace("  observations = [];", "  observations = [], visuals = [];");
const cases = runner.slice(runner.indexOf("const cases = ["), runner.indexOf("let browser;"));
replace(
  cases,
  'const cases = ["late-success-create", "refresh-success-create", "refresh-failure-edit"];\n',
);
replace("for (const width of [390, 1440])", "for (const width of [390, 760, 761, 1440])");
replace("if (width === 390)", "if (width <= 760)");
replace(
  "P46 异步归属 · 实际Vue隔离KeepAlive · 测试数据 · 未上线",
  "P46 已批准反馈接入 · 实际Vue隔离宿主 · 测试数据 · 未上线",
);
const oldShotScroll = runner.slice(
  runner.indexOf('          if (await page.locator(".provider-editor").count()) {'),
  runner.indexOf("          if (!capture) return;"),
);
replace(
  oldShotScroll,
  `
          await page.evaluate(() => document.fonts.ready);
          await page.clock.runFor(100);
          // Let close restoration finish first, then frame both modes identically.
          // This is screenshot positioning, not proof of production scroll behavior.
          await page.evaluate(() => {
            const editor = document.querySelector('.provider-editor');
            if (editor) {
              window.scrollTo({top: 0, behavior: 'instant'});
              editor.scrollTo({top: editor.scrollHeight, behavior: 'instant'});
            } else {
              const target = document.querySelector('.provider-feedback[data-tone=success]')
                || document.querySelector('.provider-registry');
              window.scrollTo({top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant'});
            }
          });
          await page.clock.runFor(100);
`,
);
replace(
  "          if (!capture) return;",
  `
          const entries = await page.evaluate(() => {
            const selectors = {
              waiting: '.provider-editor button[type=submit]',
              saved: '.provider-feedback[data-tone=success]',
              warning: '.provider-feedback[data-tone=warning]',
              retry: '.provider-feedback[data-tone=warning] > button',
            };
            return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
              const el = document.querySelector(selector);
              if (!el) return [key, null];
              const s = getComputedStyle(el), r = el.getBoundingClientRect();
              return [key, {text: el.textContent.trim(), disabled: !!el.disabled,
                width:r.width,height:r.height,x:r.x,y:r.y,
                styles:Object.fromEntries(['color','backgroundColor','borderTopColor','borderTopWidth',
                  'borderRadius','paddingTop','paddingRight','fontSize','fontFamily','lineHeight','display','opacity']
                  .map(k=>[k,s[k]]))}];
            }));
          });
          visuals.push({surface,width,scenario,state,entries});
          if (width <= 760 && (surface === 'review' || !visualBaseline)) {
            if (state === 'pending-new') {
              check('approved wait gray', entries.waiting.styles.backgroundColor, 'rgb(232, 237, 244)');
              check('approved wait radius', entries.waiting.styles.borderRadius, '6px');
              check('approved wait touch height', entries.waiting.height >= 44);
            }
            if (scenario === 'refresh-failure-edit' && state === 'settled') {
              check('approved feedback background', entries.saved.styles.backgroundColor, 'rgb(255, 248, 239)');
              check('approved warning grid', entries.warning.styles.display, 'grid');
              check('approved retry blue', entries.retry.styles.color, 'rgb(41, 76, 175)');
              check('approved retry touch size', entries.retry.height >= 44 && entries.retry.width >= 44);
            }
          }
          if (!capture) return;`,
);
replace(
  '          kind: "P46-ASYNC-OWNERSHIP-r1",',
  '          kind: "P46-APPROVED-FEEDBACK-r1",\n          visuals,',
);
const scope = runner.slice(
  runner.indexOf("          scope:\n"),
  runner.indexOf("          sourceHashes,"),
);
replace(
  scope,
  '          scope: "P46 two approved mobile feedback regions only. Exact b055029b baseline versus current raw Vue; production/review surfaces at390/760/761/1440. Original async driver with three scenarios, actual Vue in isolated KeepAlive not full App. Every API request intercepted, no real persistence/permissions. No page/editor layout approval expansion. Other current scripts, styles, actions and source hashes are independently checked.",\n',
);
replace("<title>P46异步归属</title>", "<title>P46已批准反馈接入</title>");
replace("<h1>P46异步归属 · ", "<h1>P46已批准反馈接入 · ");
// Data modules resolve package/local imports explicitly; no scratch scripts or new dependency.
replace(
  "  const sourceHashes = Object.fromEntries(",
  '  sources.add("scripts/lib/ui-imported-style-sources.mjs");\n  await includeImportedStyleSources(sources, async (f) => transformed[f] ?? (await read(f)));\n  const sourceHashes = Object.fromEntries(',
);
runner =
  'import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";\n' + runner;
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (full, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
