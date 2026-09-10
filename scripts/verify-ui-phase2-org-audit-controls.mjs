import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { auditControls, auditCompositions } from "./lib/ui-phase2-audit-controls.mjs";
import { buildOrgAuditDesignData } from "./lib/ui-phase2-org-audit-design-data.mjs";

const root = process.cwd();
const design = "design-plans/ui-phase-2-2026-09-07/design/";
const proposal = design + "org-audit-controls/";
const output = "output/playwright/p37-controls-review/";
const capture = process.argv.includes("--capture");
const smoke = process.argv.includes("--smoke");
assert.ok(process.argv.slice(2).every((x) => ["--capture", "--smoke"].includes(x)));
assert.ok(!(capture && smoke));
const hash = (x) => createHash("sha256").update(x).digest("hex");
const normalized = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const retained = {};
for (const dir of [design + "org-audit-direction-c/", "output/playwright/p37-fields-review/"]) {
  const raw = await readFile(dir + "evidence.json");
  const evidence = JSON.parse(raw);
  retained[dir] = { manifest: hash(raw), images: evidence.screenshots.length };
  for (const s of evidence.screenshots) assert.equal(hash(await readFile(dir + s.file)), s.sha256);
}
assert.equal(
  Object.values(retained).reduce((sum, x) => sum + x.images, 0),
  142,
);
const sources = [
  ...["index.html", "controls.css"].map((f) => proposal + f),
  ...["index.html", "fields.css", "fields.js"].map((f) => design + "org-audit-fields/" + f),
  ...["index.html", "audit.css", "audit.js", "data.js"].map(
    (f) => design + "org-audit-direction-c/" + f,
  ),
  "apps/web/src/components/OrganizationAuditPanel.vue",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "scripts/lib/ui-phase2-audit-controls.mjs",
  "scripts/lib/ui-phase2-org-audit-design-data.mjs",
  "scripts/verify-ui-phase2-org-audit-controls.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sources.map(async (f) => [f, hash(await normalized(f))])),
);
const data = await buildOrgAuditDesignData(root);
const shots = [],
  checks = [];
const check = (width, name, actual, expected) => {
  assert.deepEqual(actual, expected, `${width}:${name}`);
  checks.push({ width, name });
};
if (capture) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        http = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) http.push(r.url());
      });
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto(pathToFileURL(path.join(root, proposal, "index.html")).href);
      const state = () => page.evaluate(() => window.ORG_AUDIT_C.state());
      const scene = async (name, filters = false) => {
        await page.evaluate((n) => window.ORG_AUDIT_C.scene(n), name);
        if (filters && width === 390 && !(await state()).filtersOpen)
          await page.locator("#filters-toggle").click();
        await page.mouse.move(0, 0);
      };
      async function shot(name, selector, meta = {}) {
        check(
          width,
          name + ":no-overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
        if (capture) {
          const file = `${name}-${width}.png`;
          const bytes = await page
            .locator(selector)
            .first()
            .screenshot({ path: output + file, animations: "disabled" });
          shots.push({ file, width, name, ...meta, sha256: hash(bytes), approval: "pending" });
        }
      }
      for (const item of auditControls.filter((x) => !x.mobile || width === 390)) {
        for (const visual of item.states) {
          await scene(visual === "disabled" ? item.disabledScene : item.scene, item.filters);
          const control = page.locator(item.selector).first();
          await control.scrollIntoViewIfNeeded();
          const prior = (await state()).intents.length;
          if (visual === "hover" || visual === "pressed") await control.hover();
          if (visual === "focus") {
            // Tab away and Shift+Tab back proves native keyboard focus rather than a CSS class.
            await control.focus();
            await page.keyboard.press("Tab");
            await page.keyboard.press("Shift+Tab");
            check(
              width,
              item.id + ":keyboard-focus",
              await control.evaluate(
                (n) => n === document.activeElement && n.matches(":focus-visible"),
              ),
              true,
            );
          }
          if (visual === "pressed") await page.mouse.down();
          check(
            width,
            `${item.id}:${visual}:disabled`,
            await control.isDisabled(),
            visual === "disabled",
          );
          if (visual === "hover")
            check(
              width,
              item.id + ":hover",
              await control.evaluate((n) => n.matches(":hover")),
              true,
            );
          if (visual === "pressed")
            check(
              width,
              item.id + ":active",
              await control.evaluate((n) => n.matches(":active")),
              true,
            );
          if (item.id.startsWith("event-"))
            check(
              width,
              `${item.id}:${visual}:selection`,
              await control.getAttribute("aria-pressed"),
              String(item.id === "event-selected"),
            );
          check(
            width,
            `${item.id}:${visual}:height`,
            await control.evaluate((n) => n.getBoundingClientRect().height >= 44),
            true,
          );
          await shot(`control-${item.id}-${visual}`, item.selector, {
            control: item.id,
            visual,
            source: item.source,
            proposalOnly:
              item.source.startsWith("proposal:") ||
              (visual === "disabled" && !!item.disabledProposalOnly),
          });
          if (visual === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
          check(
            width,
            `${item.id}:${visual}:no-write-intent`,
            (await state()).intents.length,
            prior,
          );
        }
      }
      for (const [name, selectedScene, selector] of auditCompositions) {
        await scene(selectedScene);
        await shot(name, selector, { type: "composition" });
      }
      for (const field of ["request", "trace"]) {
        for (const result of ["copied", "failed"]) {
          await scene("normal");
          await page.evaluate((failed) => {
            window.ORG_AUDIT_C_CLIPBOARD = async (value) => {
              window.lastSyntheticCopy = value;
              if (failed) throw Error("Synthetic clipboard rejection");
            };
          }, result === "failed");
          await page.locator(`[data-copy="${field}"]`).click();
          check(width, `copy:${field}:${result}`, (await state()).copy[field], result);
          check(
            width,
            `copy:${field}:value`,
            await page.evaluate(() => window.lastSyntheticCopy),
            data.events[0][field + "_id"],
          );
          await shot(`copy-${field}-${result}`, ".correlation", {
            type: "composition",
            clipboard: "in-memory only",
          });
        }
      }
      await scene("normal", true);
      await page.evaluate(() => window.ORG_AUDIT_C.setMode("hold"));
      await page.locator("#apply").click();
      check(width, "apply:read-first-page", (await state()).intents[0], {
        method: "GET",
        path: `/organizations/${data.events[0].organization_id}/audit-events?limit=50`,
      });
      await page.evaluate(() => window.ORG_AUDIT_C.complete("success"));
      await page.locator("#advanced summary").click();
      check(width, "advanced:open", await page.locator("#advanced").evaluate((n) => n.open), true);
      await scene("system_collapsed");
      await page.locator("#system").click();
      check(width, "system:show50", await page.locator("[data-event]").count(), 50);
      await page.locator("#system").click();
      check(width, "system:show10", await page.locator("[data-event]").count(), 10);
      await scene("normal");
      await page.locator(".event-row[aria-pressed=false]").first().focus();
      await page.keyboard.press("Enter");
      check(width, "selection:second-id", (await state()).selected, data.events[1].id);
      check(
        width,
        "selection:focus-detail",
        await page.locator("#detail-title").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator(".technical summary").focus();
      await page.keyboard.press("Enter");
      check(
        width,
        "technical:keyboard-open",
        await page.locator(".technical").evaluate((n) => n.open),
        true,
      );
      if (width === 390) {
        await page.locator("#back-to-list").click();
        check(
          width,
          "back:focus-timeline",
          await page.locator("#timeline-title").evaluate((n) => n === document.activeElement),
          true,
        );
      }
      await scene("normal");
      await page.evaluate(() => window.ORG_AUDIT_C.setMode("hold"));
      await page.locator("#more").click();
      check(
        width,
        "more:cursor",
        new URL((await state()).intents[0].path, "https://fixture.invalid").searchParams.get(
          "cursor",
        ),
        data.events[49].id,
      );
      await page.evaluate(() => window.ORG_AUDIT_C.complete("success"));
      check(width, "more:55", (await state()).events.length, 55);
      for (const [s, selector] of [
        ["normal", "#refresh"],
        ["error", "#retry"],
      ]) {
        await scene(s);
        await page.evaluate(() => window.ORG_AUDIT_C.setMode("hold"));
        await page.locator(selector).click();
        check(width, selector + ":read-only", (await state()).intents[0].method, "GET");
      }
      await scene("local_failed");
      await page.locator("#clear-query").click();
      check(width, "clear:local-only", (await state()).intents.length, 0);
      check(width, "clear:value", (await state()).query, "");
      check(width, "zero-dialogs", await page.locator("dialog,[role=dialog]").count(), 0);
      check(width, "zero-http", http, []);
      check(width, "zero-errors", errors, []);
      check(
        width,
        "zero-storage",
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
      check(width, "zero-cookies", (await context.cookies()).length, 0);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
for (const [dir, old] of Object.entries(retained))
  assert.equal(hash(await readFile(dir + "evidence.json")), old.manifest);
if (capture) {
  await writeFile(
    output + "evidence.json",
    JSON.stringify(
      {
        proposal: "P37-CONTROLS-C-r1",
        sourceHashes,
        retained,
        controls: auditControls,
        compositions: auditCompositions,
        checks,
        screenshots: shots,
        scope:
          "Standalone synthetic proposal, not actual Vue/API/permission/OS clipboard/production proof. Missing-ID disabled and three convenience actions remain proposals. All visuals pending. Browsers closed, no server or temporary files.",
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    output + "index.html",
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P37 控件及详情待审</title>
<style>body{font:16px/1.6 'Microsoft YaHei';margin:24px;background:#edf1f6;color:#202c3d}img{max-width:100%;height:auto}figure{padding:16px;background:white;margin:24px 0}small{display:block}</style><h1>P37 控件及详情 · 全部待审</h1><p>原生状态及合成详情；不是实际 Vue 或生产验收。原142图保留。</p>
${shots.map((s) => `<figure><figcaption>${s.name} · ${s.width}px<small>${s.source || "详情组合"}${s.proposalOnly ? " · 仅提案" : ""}</small></figcaption><img loading="lazy" src="${s.file}" alt="${s.name}"></figure>`).join("\n")}</html>`,
  );
} else if (!smoke) {
  const e = JSON.parse(await normalized(output + "evidence.json"));
  assert.deepEqual(e.sourceHashes, sourceHashes);
  assert.deepEqual(e.checks, checks);
  for (const s of e.screenshots) assert.equal(hash(await readFile(output + s.file)), s.sha256);
  assert.deepEqual(
    (await readdir(output)).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
}
console.log(
  JSON.stringify({
    mode: smoke ? "smoke" : capture ? "capture" : "verify",
    controls: auditControls.length,
    checks: checks.length,
    screenshots: shots.length,
    browser: "closed",
    temporaryFiles: 0,
  }),
);
