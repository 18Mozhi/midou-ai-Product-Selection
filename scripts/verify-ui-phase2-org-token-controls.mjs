import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke),
);
const original = "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c";
const design = "design-plans/ui-phase-2-2026-09-07/design/org-token-controls";
const output = "output/playwright/p36-controls-review";
const sourceFile = "apps/web/src/components/OrganizationTokenPanel.vue";
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const retained = JSON.parse(await text(`${original}/evidence.json`));
const sourceHashes = { ...retained.sourceHashes };
for (const [f, sha] of Object.entries(sourceHashes)) assert.equal(hash(await text(f)), sha, f);
for (const s of retained.screenshots)
  assert.equal(hash(await readFile(`${original}/${s.file}`)), s.sha256, s.file);
for (const f of ["index.html", "controls.css", "controls.js"]
  .map((f) => `${design}/${f}`)
  .concat("scripts/verify-ui-phase2-org-token-controls.mjs", "scripts/lib/ui-phase2-inventory.mjs"))
  sourceHashes[f] = hash(await text(f));
const sourceSignatures = scanSource(await text(sourceFile), sourceFile)
  .candidates.map((c) => c.candidateId.split("#")[1])
  .sort();
assert.equal(sourceSignatures.length, 12);
let previous, controls;
if (!capture && !smoke) {
  previous = JSON.parse(await text(`${output}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const screenshots = [],
  checks = [],
  interactions = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      await context.addInitScript(() => {
        window.__clipboardAttempts = 0;
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              window.__clipboardAttempts++;
              throw Error("OS clipboard forbidden in design review");
            },
          },
        });
      });
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/u, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.resolve(design, "index.html")).href);
      await page.waitForFunction(() => !!window.ORG_TOKEN_CONTROLS_C);
      controls = await page.evaluate(() => window.ORG_TOKEN_CONTROLS_C.controls);
      assert.deepEqual(controls.flatMap((c) => c.signatures).sort(), sourceSignatures);
      const state = () => page.evaluate(() => window.ORG_TOKEN_C.state());
      const prepare = (id, variant = "default") =>
        page.evaluate(
          ([id, variant]) => window.ORG_TOKEN_CONTROLS_C.prepare(id, variant),
          [id, variant],
        );
      const save = async (file, bytes, extra) => {
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({ file, width, sha256: hash(bytes), ...extra });
      };
      for (const c of controls.filter((c) => c.widths.includes(width))) {
        const target = () => page.locator(c.selector).first();
        for (const variant of smoke ? [c.disabledOnly ? "disabled" : "focus"] : c.states) {
          await prepare(c.id, variant);
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.activeElement?.blur());
          const before = await state();
          const metricNode = c.crop ? page.locator(c.crop).first() : target();
          await metricNode.scrollIntoViewIfNeeded();
          if (c.crop) await metricNode.evaluate((n) => n.scrollIntoView({ block: "center" }));
          if (variant === "focus") {
            await page.keyboard.press("Tab");
            await target().focus();
          }
          if (["hover", "pressed"].includes(variant)) await target().hover();
          if (variant === "pressed") await page.mouse.down();
          const disabled = ["disabled", "busy"].includes(variant);
          assert.equal(await target().isDisabled(), disabled, `${c.id}/${variant}`);
          if (c.selected !== undefined)
            assert.equal(await target().getAttribute("aria-pressed"), String(c.selected));
          if (c.checked !== undefined) assert.equal(await target().isChecked(), c.checked);
          if (c.open !== undefined)
            assert.equal(await target().evaluate((n) => n.parentElement.open), c.open);
          if (["focus", "hover", "pressed"].includes(variant))
            assert.ok(
              await target().evaluate(
                (n, p) => n.matches(p),
                { focus: ":focus-visible", hover: ":hover", pressed: ":active" }[variant],
              ),
            );
          const metrics = await metricNode.evaluate((n) => {
            const r = n.getBoundingClientRect(),
              s = getComputedStyle(n);
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(s.fontSize),
              hit: hit === n || n.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          assert.ok(
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              !metrics.overflow,
            JSON.stringify({ id: c.id, variant, width, metrics }),
          );
          if (variant === "focus")
            assert.equal(await target().evaluate((n) => getComputedStyle(n).outlineWidth), "3px");
          if (disabled) {
            assert.equal(
              await target().evaluate((n) => getComputedStyle(n).backgroundColor),
              "rgb(230, 235, 241)",
            );
            await target().evaluate((n) => n.click());
          }
          assert.deepEqual(await state(), before, `${c.id} visual-only state no mutation`);
          if (capture) {
            const box = await metricNode.boundingBox(),
              x = Math.max(0, box.x - 12),
              y = Math.max(0, box.y - 16);
            await save(
              `${c.id}-${variant}-${width}.png`,
              await page.screenshot({
                clip: {
                  x,
                  y,
                  width: Math.min(width - x, box.width + 24),
                  height: Math.min(page.viewportSize().height - y, box.height + 32),
                },
                animations: "disabled",
              }),
              {
                controlId: c.id,
                variant,
                scope: "offline-native-control-proposal-not-Vue-or-approval",
              },
            );
          }
          checks.push({ controlId: c.id, variant, width, nativeState: true, unchangedFacts: true });
          if (variant === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
        }
        if (c.disabledOnly) continue;
        await prepare(c.id);
        const before = await state();
        const selectedId =
          c.action === "open-reason" ? await target().getAttribute("data-id") : undefined;
        await target().click();
        if (c.action === "copy")
          await page.waitForFunction(() => window.ORG_TOKEN_C.state().copyState !== "");
        const after = await state();
        assert.deepEqual(after.tokens, before.tokens);
        if (c.action === "read")
          assert.deepEqual(after.intents.slice(before.intents.length), [
            { method: "GET", path: "/org/admin/summary" },
            { method: "GET", path: "/org/admin/tokens" },
          ]);
        else if (c.action === "create")
          assert.deepEqual(after.intents.slice(before.intents.length), [
            {
              method: "POST",
              path: "/org/admin/tokens",
              body: {
                name: before.form.name.trim(),
                scopes: before.form.scopes,
                ttl_days: Number(before.form.ttl_days),
                reason: before.form.reason.trim(),
              },
            },
          ]);
        else if (c.action === "confirm") {
          assert.deepEqual(after.intents.slice(before.intents.length), [
            {
              method: "POST",
              path: `/org/admin/tokens/${before.dialog.item.id}/actions`,
              body: {
                action: c.tokenAction,
                expected_version: before.dialog.item.version,
                reason: before.dialog.reason.trim(),
              },
            },
          ]);
          assert.equal(await page.locator("dialog[open]").count(), 0);
        } else assert.deepEqual(after.intents, before.intents);
        if (c.action === "reset")
          assert.deepEqual(after.filter, {
            query: "",
            status: "all",
            scope: "all",
            sort: "created_desc",
            page: 1,
          });
        if (c.action === "page") assert.equal(after.filter.page, before.filter.page + c.delta);
        if (c.action === "ttl") assert.equal(after.form.ttl_days, c.days);
        if (c.action === "scope") assert.equal(await target().isChecked(), !c.checked);
        if (c.action === "technical") {
          assert.equal(await target().evaluate((n) => n.parentElement.open), !c.open);
          assert.deepEqual(after, before);
        }
        if (c.action === "filters") assert.equal(after.filtersOpen, !before.filtersOpen);
        if (c.action === "jump")
          assert.equal(
            await page
              .locator(c.focusTarget ?? "#create-name")
              .evaluate((n) => n === document.activeElement),
            true,
          );
        if (c.action === "copy") {
          assert.equal(after.copyState, c.scene === "copy_failure" ? "failed" : "copied");
          assert.equal(after.secret, before.secret);
        }
        if (c.action === "dismiss") {
          assert.equal(after.secret, "");
          assert.equal(after.copyState, "");
        }
        if (c.action === "open-reason") {
          assert.equal(after.dialog.item.id, selectedId);
          assert.equal(after.dialog.action, c.tokenAction);
          assert.equal(after.dialog.reason, "");
          await page.keyboard.press("Escape");
          assert.equal((await state()).dialog, null);
        }
        if (c.action === "cancel") {
          assert.equal(after.dialog, null);
          assert.equal(
            await page
              .locator(`[data-action="${c.tokenAction}"][data-id="${before.dialog.item.id}"]`)
              .evaluate((n) => n === document.activeElement),
            true,
          );
        }
        interactions.push({
          controlId: c.id,
          width,
          action: c.action,
          exactIntentOrLocalResult: true,
        });
      }
      for (const action of ["rotate", "revoke"]) {
        await prepare(`${action}-submit`);
        const dialog = page.locator("dialog[open]");
        const box = await dialog.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.y + box.height <= page.viewportSize().height + 1);
        const before = await state();
        await page.locator("#reason-close").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.locator("#reason-submit").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#reason-close").evaluate((n) => n === document.activeElement),
          true,
        );
        assert.deepEqual(await state(), before);
        if (capture)
          await save(`${action}-reason-composition-${width}.png`, await dialog.screenshot(), {
            composition: action,
            scope: "offline-reason-composition-pending-user-review",
          });
        await page.keyboard.press("Escape");
      }
      for (const id of ["copy", "copy-copied", "copy-failed"]) {
        await prepare(id);
        const panel = page.locator("#secret-panel");
        assert.ok(
          (await panel.textContent()).includes("SYNTHETIC_UI_REVIEW_ONLY_NOT_A_REAL_TOKEN"),
        );
        if (capture)
          await save(`${id}-composition-${width}.png`, await panel.screenshot(), {
            composition: id,
            scope: "offline-synthetic-secret-feedback-pending-user-review",
          });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.equal(await page.evaluate(() => window.__clipboardAttempts), 0);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.ok(!page.url().includes("SYNTHETIC"));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        pageId: "P36",
        approval: "pending-user-review",
        scope: "Offline controls; no mounted Vue/API/SQL/OS clipboard or production proof",
        sourceHashes,
        sourceSignatures,
        retainedOriginalImages: retained.screenshots.length,
        controls,
        checks,
        interactions,
        screenshots,
        externalRequests: 0,
        osClipboardCalls: 0,
      },
      null,
      2,
    ) + "\n",
  );
  const cards = screenshots
    .map(
      (s) =>
        `<article><h2>${s.controlId ?? s.composition} / ${s.variant ?? "组合"} / ${s.width}px</h2><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.file}"></a></article>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P36 控件状态审核</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%}</style>
<h1>P36 控件状态 · 待审</h1><p>独立HTML稿，全部样例无效；无真实请求或系统剪贴板。390px悬停是窄视口鼠标态。原因最长500与忙碌草稿锁定沿用旧提案，不代表已批准业务规则。</p>
${cards}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(interactions, previous.interactions);
  assert.deepEqual(controls, previous.controls);
}
console.log(
  JSON.stringify({
    checks: checks.length,
    interactions: interactions.length,
    controls: controls.length,
    screenshots: screenshots.length,
    retainedOriginalImages: retained.screenshots.length,
    browserClosed: true,
    noServer: true,
  }),
);
