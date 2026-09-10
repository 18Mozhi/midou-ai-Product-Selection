import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildOrgAuditDesignData } from "./lib/ui-phase2-org-audit-design-data.mjs";

const repo = process.cwd();
const base = "design-plans/ui-phase-2-2026-09-07/design/";
const original = base + "org-audit-direction-c/";
const proposal = base + "org-audit-fields/";
const output = "output/playwright/p37-fields-review/";
const capture = process.argv.includes("--capture");
const smoke = process.argv.includes("--smoke");
assert.ok(process.argv.slice(2).every((x) => ["--capture", "--smoke"].includes(x)));
const hash = (x) => createHash("sha256").update(x).digest("hex");
const old = JSON.parse(await readFile(original + "evidence.json", "utf8"));
assert.equal(old.screenshots.length, 104);
for (const item of old.screenshots)
  assert.equal(hash(await readFile(original + item.file)), item.sha256);
const retainedManifest = hash(await readFile(original + "evidence.json"));
const data = await buildOrgAuditDesignData(repo);
const sources = [
  ...["index.html", "fields.css", "fields.js"].map((x) => proposal + x),
  ...["index.html", "audit.css", "audit.js", "data.js"].map((x) => original + x),
  "apps/web/src/components/OrganizationAuditPanel.vue",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "scripts/lib/ui-phase2-org-audit-design-data.mjs",
  "scripts/verify-ui-phase2-org-audit-fields.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
const fields = [
  "action",
  "outcome",
  "resource_type",
  "request_id",
  "trace_id",
  "occurred_from",
  "occurred_to",
];
const lengths = { action: 128, resource_type: 80, request_id: 128, trace_id: 128 };
const shots = [];
let checks = 0;
const equal = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
if (capture) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      timezoneId: "Asia/Shanghai",
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors = [],
        http = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) http.push(r.url());
      });
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto(pathToFileURL(path.join(repo, proposal, "index.html")).href);
      const state = () => page.evaluate(() => window.ORG_AUDIT_C.state());
      async function scene(name, advanced = false) {
        await page.evaluate((x) => window.ORG_AUDIT_C.scene(x), name);
        if (width === 390 && !(await state()).filtersOpen)
          await page.locator("#filters-toggle").click();
        if (advanced && !(await page.locator("#advanced").evaluate((x) => x.open)))
          await page.locator("#advanced summary").click();
        await page.locator("#filter-action-help").waitFor();
      }
      async function shot(name, selector) {
        equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
        const file = `${name}-${width}.png`;
        if (capture) {
          const bytes = await page
            .locator(selector)
            .screenshot({ path: output + file, animations: "disabled" });
          shots.push({ file, width, name, selector, sha256: hash(bytes), approval: "pending" });
        }
      }
      await scene("normal", true);
      equal(await page.locator("#server-actions-help").count(), 1);
      equal(await page.locator("#reset").getAttribute("aria-describedby"), "server-actions-help");
      equal(await page.locator("#server-form input,#server-form select").count(), 7);
      equal(
        await page
          .locator("#filter-outcome option")
          .evaluateAll((nodes) => nodes.map((n) => n.value)),
        ["", "succeeded", "failed", "blocked"],
      );
      for (const key of fields) {
        const input = page.locator("#filter-" + key);
        equal(await input.getAttribute("aria-labelledby"), `filter-${key}-name`);
        equal((await input.getAttribute("aria-describedby")).includes(`filter-${key}-help`), true);
        if (key in lengths) equal(await input.getAttribute("maxlength"), String(lengths[key]));
        await input.focus();
        equal(await input.evaluate((n) => n === document.activeElement), true);
        await shot("field-" + key + "-focus", `label[for="filter-${key}"]`);
      }
      for (const [key, length] of Object.entries(lengths)) {
        const input = page.locator("#filter-" + key);
        await input.fill("x".repeat(length));
        await input.press("End");
        await page.keyboard.type("z");
        equal((await input.inputValue()).length, length);
        equal(await page.locator(`#filter-${key}-count`).textContent(), `${length} / ${length}`);
        await shot("field-" + key + "-maximum", `label[for="filter-${key}"]`);
      }
      for (const name of [
        "normal",
        "exact_draft",
        "advanced",
        "range_error",
        "filter_busy",
        "filter_failure",
      ]) {
        await scene(name);
        await shot("combination-" + name, "#server-form");
      }
      await scene("range_error");
      equal((await state()).intents.length, 0);
      equal(
        (await page.locator("#filter-occurred_from").getAttribute("aria-describedby")).includes(
          "range-error",
        ),
        true,
      );
      equal(await page.locator("#filter-occurred_from").getAttribute("max"), "2026-08-27T12:00");
      await page.locator("#filter-occurred_from").fill("2026-08-27T11:00");
      equal(await page.locator("#filter-occurred_to").getAttribute("min"), "2026-08-27T11:00");
      await page.evaluate(() => window.ORG_AUDIT_C.setMode("hold"));
      await page.locator("#apply").click();
      equal(await page.locator("#range-error").count(), 0);
      equal(
        new URL((await state()).intents.at(-1).path, "https://fixture.invalid").searchParams.get(
          "occurred_from",
        ),
        "2026-08-27T03:00:00.000Z",
      );
      equal(await page.locator("#apply").isDisabled(), true);
      equal(await page.locator("#reset").isDisabled(), true);
      equal(await page.locator("#filter-action").isEnabled(), true);
      await scene("normal");
      for (const [query, ids] of Object.entries(data.oracle)) {
        await page.locator("#loaded-query").fill(query);
        equal(await page.evaluate(() => window.ORG_AUDIT_C.visible().map((e) => e.id)), ids);
        equal((await state()).intents.length, 0);
      }
      await page.locator("#loaded-query").fill("失败");
      await shot("local-search-filled", ".loaded-search");
      await page.locator("#loaded-query").fill("x".repeat(160));
      await page.keyboard.type("z");
      equal((await page.locator("#loaded-query").inputValue()).length, 160);
      await shot("local-search-maximum", ".loaded-search");
      await page.locator("#loaded-query").fill("失败");
      await page.keyboard.press("Home");
      await page.keyboard.type("a");
      equal(await page.locator("#loaded-query").inputValue(), "a失败");
      equal(await page.locator("#loaded-query").evaluate((n) => n.selectionStart), 1);
      await page.evaluate(() => window.ORG_AUDIT_C.setMode("hold"));
      await page.locator("#reset").click();
      equal((await state()).query, "");
      equal(
        Object.values((await state()).draft),
        fields.map(() => ""),
      );
      equal(
        new URL((await state()).intents.at(-1).path, "https://fixture.invalid").search,
        "?limit=50",
      );
      await scene("normal", true);
      await page.locator("#filter-action").focus();
      await page.keyboard.press("Tab");
      equal(
        await page.locator("#filter-outcome").evaluate((n) => n === document.activeElement),
        true,
      );
      equal(await page.locator("dialog,[role=dialog]").count(), 0);
      equal(errors, []);
      equal(http, []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
equal(hash(await readFile(original + "evidence.json")), retainedManifest);
if (capture) {
  const evidence = {
    proposal: "P37-FIELDS-C-r1",
    sourceHashes,
    retainedManifest,
    retainedImages: 104,
    checks,
    screenshots: shots,
    scope:
      "Synthetic prototype only; not actual Vue, backend, authorization or production acceptance. All images pending review. Browser closed; no server started.",
  };
  await writeFile(output + "evidence.json", JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    output + "index.html",
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P37 字段组合待审</title><style>body{font:16px/1.6 'Microsoft YaHei';margin:24px;background:#edf1f6;color:#202c3d}img{max-width:100%;height:auto}figure{margin:24px 0;padding:16px;background:white}</style><h1>P37 字段组合 · 全部待审</h1><p>测试样例原型，不是实际 Vue 或生产验收；原104图保留。</p>${shots.map((s) => `<figure><figcaption>${s.name} · ${s.width}px</figcaption><img loading="lazy" src="${s.file}" alt="${s.name}"></figure>`).join("\n")}</html>`,
  );
} else if (!smoke) {
  const evidence = JSON.parse(await readFile(output + "evidence.json", "utf8"));
  equal(evidence.sourceHashes, sourceHashes);
  for (const s of evidence.screenshots) equal(hash(await readFile(output + s.file)), s.sha256);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks,
    screenshots: shots.length,
    browser: "closed",
    temporaryFiles: 0,
  }),
);
