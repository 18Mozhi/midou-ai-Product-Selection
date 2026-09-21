import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const original = "scripts/verify-ui-phase2-provider-adapter-empty.mjs";
let runner = (await readFile(original, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  "db56f1e99c7d4e49e9eb8fb1bc7e8ee5120d898da36946bd3c48e90dc0e8d353",
);
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
}
replace(
  'const output = "output/playwright/p47-empty-review";',
  'const output = "output/playwright/p47-empty-mobile-implementation";',
);
replace(
  "  replacement = previewAdapterEmpty(source);",
  "  previous = beforeAdapterEmptyMobile(source),\n  replacement = previewCurrentAdapterEmpty(previous);",
);
replace(
  'for (const mode of ["baseline", "review"])',
  'for (const mode of ["baseline", "review", "current"])',
);
replace('        mode === "baseline"', '        mode === "current"');
replace(
  "return { code: replacement, map: null };",
  'return { code: mode === "baseline" ? previous : replacement, map: null };',
);
replace(
  "                transformIndexHtml(html) {",
  '                transformIndexHtml(html) {\n                  if (mode !== "review") return html;',
);
replace("for (const width of [390, 760, 1440])", "for (const width of [390, 760, 761, 1440])");
replace('              mode === "review" ? "search" : "BODY",', '              "search",');
replace(
  '          if (scene !== "catalog") {',
  '          if (scene !== "catalog") {\n            await picture(center, "default");',
);
// Canonical framing avoids different native post-reset scroll positions including the fixed topbar.
replace(
  '            const bytes = await locator.screenshot({ animations: "disabled" });',
  `            await locator.evaluate(el => {
              const topbar = document.querySelector(".role-topbar");
              const offset = topbar && getComputedStyle(topbar).position === "fixed" ? topbar.getBoundingClientRect().height + 16 : 16;
              window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset), behavior: "instant" });
            });
            await page.evaluate(() => document.fonts.ready);
            const bytes = await locator.screenshot({ animations: "disabled" });`,
);
// Hidden responsive copy must not duplicate the visible or accessible heading.
replace(
  '          check("one empty state", await panel.count(), 1);',
  `          if (mode === "current") {
            const mobile = width <= 760;
            const expected = mobile ? emptyCopy[scene === "catalog" ? "catalog" : "filtered"] : scene === "catalog"
              ? ["还没有来源可绑定适配器", "先在来源注册中心登记技术合同；不会创建模拟来源。"]
              : ["没有符合筛选条件的适配器", "调整搜索或筛选条件，清除后显示当前来源目录。"];
            await expect(panel.getByRole("heading")).toHaveAccessibleName(expected[0]);
            check("visible heading is not duplicated", (await panel.locator("h3").innerText()).trim(), expected[0]);
            check("visible help is not duplicated", (await panel.locator("p").innerText()).trim(), expected[1]);
            check("responsive hidden copy stays hidden", await panel.locator(mobile ? ".adapter-empty-copy-wide" : ".adapter-empty-copy-mobile").evaluateAll(els => els.every(el => getComputedStyle(el).display === "none")), true);
          }
          check("one empty state", await panel.count(), 1);`,
);
replace(
  '            await expect(page.locator(".provider-registry")).toBeVisible();',
  '            await expect(page.locator(".provider-registry")).toBeVisible();\n            await picture(page.locator(".provider-registry"), "registration");',
);
replace(
  '          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });',
  '          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });\n          await page.clock.setFixedTime(new Date("2026-09-11T06:00:00Z"));',
);
replace(
  '  "scripts/verify-ui-phase2-provider-adapter-empty.mjs",',
  '  "scripts/verify-ui-phase2-provider-adapter-empty.mjs",\n' +
    [
      "scripts/verify-provider-adapter-empty-mobile.mjs",
      "scripts/lib/ui-phase2-adapter-empty-mobile-baseline.mjs",
      "scripts/lib/ui-phase2-adapter-current-empty-preview.mjs",
      "scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs",
      "scripts/lib/ui-imported-style-sources.mjs",
      "apps/web/src/provider-adapters-empty-mobile.css",
    ]
      .map((f) => `  "${f}",`)
      .join("\n"),
);
replace(
  "  await browser.close();\n  browser = null;",
  `  await includeImportedStyleSources(sources, read);
  await browser.close();
  browser = null;
  const comparisons = [];
  if (capture) for (const shot of screenshots.filter(s => s.mode === "current")) {
    const expectedMode = shot.width <= 760 && shot.suffix === "empty" ? "review" : "baseline";
    const target = screenshots.find(s => s.mode === expectedMode && s.width === shot.width && s.scene === shot.scene && s.suffix === shot.suffix);
    assert.ok(target);
    assert.equal(shot.sha256, target.sha256, "Exact mobile approval / desktop and neighboring-state parity: " + shot.file);
    comparisons.push({ actual: shot.file, expected: target.file, sha256: shot.sha256 });
  }`,
);
replace(
  '          kind: "P47-EMPTY-REVIEW-r1",',
  '          kind: "P47-EMPTY-MOBILE-IMPLEMENTATION-r1",\n          comparisons,\n          productionMobileEmptyImplemented: true,',
);
replace("          reviewOnly: true,", "          reviewOnly: false,");
replace(
  "Actual Vue baseline and isolated review. Only empty copy/classes/CSS plus local post-reset focus wrapper differ. Existing reset, six filter values, APIs and permissions unchanged. Local empty array/original M03 fixtures; no real API/probe/registration writes or deployment. Not full-page or a11y acceptance.",
  "Actual raw current Vue implements only approved mobile empty copy/style at max760px; exact pre-change baseline and original empty review provide independent comparisons. Both existing focus handlers and all runtime contracts unchanged. Current mobile empty regions equal reference; wide empty regions and neighboring default/reset/registration pictures equal baseline. Local fixtures only, no real writes, full-page approval, complete a11y or production deployment.",
);
replace("<h1>P47 空态 · 独立审核稿</h1>", "<h1>P47 手机空态 · 实际组件实施</h1>");
replace(
  "生产未改。baseline保留原状，review为待审提案。",
  "手机区域已接入实际组件，未部署。baseline为实施前，review为原审核参考，current为原样当前组件。",
);
replace("清除筛选焦点修复仅在预览。", "两处焦点保护均保留；桌面与非空态区域不变，不扩大原批准。");
runner =
  'import { beforeAdapterEmptyMobile } from "./lib/ui-phase2-adapter-empty-mobile-baseline.mjs";\nimport { previewCurrentAdapterEmpty } from "./lib/ui-phase2-adapter-current-empty-preview.mjs";\nimport { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";\n' +
  runner;
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (_, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
