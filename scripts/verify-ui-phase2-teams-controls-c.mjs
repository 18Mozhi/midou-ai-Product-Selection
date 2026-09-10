import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";

const base = "design-plans/ui-phase-2-2026-09-07/design";
const output = `${base}/teams-controls-direction-c`,
  sourceFile = "apps/web/src/components/OrganizationTeamPanel.vue";
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(await readFile(`${base}/teams-direction-c/evidence.json`, "utf8"));
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
for (const file of ["index.html", "controls.js", "controls.css"]
  .map((f) => `${output}/${f}`)
  .concat("scripts/verify-ui-phase2-teams-controls-c.mjs", "scripts/lib/ui-phase2-inventory.mjs"))
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
const sourceCandidates = scanSource(await readFile(sourceFile, "utf8"), sourceFile).candidates;
const sourceSignatures = sourceCandidates.map((c) => c.candidateId.split("#")[1]).sort();
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[a-z_-]+-(1440|390)\.png$/);
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
  }
}
const checks = [],
  screenshots = [],
  interactions = [];
let controls;
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
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/u, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.resolve(output, "index.html")).href);
      await page.waitForFunction(() => !!window.TEAM_CONTROLS_C);
      controls = await page.evaluate(() => window.TEAM_CONTROLS_C.controls);
      assert.deepEqual(
        controls.flatMap((c) => c.signatures).sort(),
        sourceSignatures,
        "every child candidate accounted once, not parent/shared-page completion",
      );
      const prepare = async (id, state) => {
        await page.evaluate(([i, s]) => window.TEAM_CONTROLS_C.prepare(i, s), [id, state]);
        // Native details dispatches toggle asynchronously; observe its settled source state.
        await page.waitForFunction(() => {
          const filters = document.querySelector("#filters");
          return !filters || filters.open === window.TEAMS_C.state().filtersOpen;
        });
      };
      const state = () => page.evaluate(() => window.TEAMS_C.state());
      for (const c of controls) {
        const locate = () => page.locator(c.selector).first();
        for (const variant of smoke ? [c.disabledOnly ? "disabled" : "focus"] : c.states) {
          await prepare(c.id, variant);
          const before = await state(),
            target = locate();
          await page.mouse.move(1, 1);
          if (variant === "focus") {
            await page.keyboard.press("Tab");
            await target.focus();
            assert.ok(
              await target.evaluate(
                (n) => n === document.activeElement && n.matches(":focus-visible"),
              ),
              `${c.id} focus`,
            );
          } else await page.evaluate(() => document.activeElement?.blur());
          await target.scrollIntoViewIfNeeded();
          if (["hover", "pressed"].includes(variant)) await target.hover();
          if (variant === "pressed") await page.mouse.down();
          assert.equal(
            await target.isDisabled(),
            ["disabled", "busy"].includes(variant),
            `${c.id}/${variant}`,
          );
          if (Object.hasOwn(c, "selected"))
            assert.equal(await target.getAttribute("aria-pressed"), String(c.selected));
          if (["hover", "pressed"].includes(variant))
            assert.ok(
              await target.evaluate(
                (n, s) => n.matches(s),
                variant === "pressed" ? ":active" : ":hover",
              ),
            );
          const metrics = await target.evaluate((n) => {
            const r = n.getBoundingClientRect(),
              s = getComputedStyle(n),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(s.fontSize),
              hit: hit === n || n.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              outline: s.outlineColor,
              background: s.backgroundColor,
            };
          });
          assert.ok(
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              !metrics.overflow,
            JSON.stringify({ c: c.id, variant, width, metrics }),
          );
          if (variant === "focus") assert.equal(metrics.outline, "rgb(40, 94, 199)");
          if (c.id === "reason-remove-confirm" && variant === "default")
            assert.equal(metrics.background, "rgb(173, 41, 60)");
          if (["disabled", "busy"].includes(variant)) {
            assert.equal(metrics.background, "rgb(230, 235, 241)");
            await target.evaluate((n) => n.click());
          }
          assert.deepEqual(
            await state(),
            before,
            "styling and disabled actions do not mutate facts or intents",
          );
          if (capture) {
            const scene = `${c.id}-${variant}`,
              file = `${scene}-${width}.png`;
            await page.screenshot({ path: `${output}/${file}` });
            screenshots.push({
              file,
              scene,
              width,
              pageId: "P33",
              scope: c.proposalOnly ? "proposal-only-control" : "individual-control-not-full-page",
              sha256: hash(await readFile(`${output}/${file}`)),
              control: { id: c.id, selector: c.selector, variant, actionId: c.actionId },
            });
          }
          checks.push({ id: c.id, variant, width, nativeStateVerified: true, noSideEffect: true });
          if (variant === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
          }
        }
        if (c.disabledOnly) continue;
        await prepare(c.id, "default");
        await page.evaluate(() => window.TEAMS_C.setMode("hold"));
        const before = await state();
        const selectedId = await locate().getAttribute("data-select");
        await locate().click();
        const after = await state();
        if (c.actionId === "OG-REFRESH" || c.actionId === "OG-RETRY")
          assert.deepEqual(
            after.intents,
            ["summary", "teams", "members"].map((p) => ({ url: `/org/admin/${p}`, method: "GET" })),
          );
        else if (c.actionId === "OG-T-OPEN") {
          assert.ok(after.createOpen);
          assert.deepEqual(after.form, before.form);
          assert.ok(await page.locator("#team-name").evaluate((n) => n === document.activeElement));
        } else if (c.actionId === "OG-T-CREATE") {
          assert.deepEqual(after.intents, [
            {
              url: "/org/admin/teams",
              method: "POST",
              body: Object.fromEntries(Object.entries(before.form).map(([k, v]) => [k, v.trim()])),
            },
          ]);
          assert.equal(after.busy, "create");
        } else if (c.actionId === "OG-T-CANCEL") {
          assert.equal(after.createOpen, false);
          assert.deepEqual(after.form, {
            name: "",
            lead_membership_id: "",
            default_workflow_key: "",
            reason: "",
          });
        } else if (c.status) {
          assert.equal(after.status, c.status);
          assert.equal(after.page, 1);
        } else if (c.actionId === "OG-T-FILTER")
          assert.deepEqual(
            [after.query, after.status, after.sort, after.page],
            ["", "all", "name_asc", 1],
          );
        else if (c.actionId === "OG-T-SELECT") {
          assert.equal(after.selectedId, selectedId);
          assert.equal(after.memberId, "");
        } else if (c.actionId === "OG-T-PAGE")
          assert.equal(after.page, before.page + (c.id === "next" ? 1 : -1));
        else if (c.actionId === "OG-T-MEMBER") {
          if (c.member) {
            assert.deepEqual(
              after.dialog.team,
              before.items.find((t) => t.id === before.selectedId),
            );
            assert.equal(after.dialog.member.id, before.memberId);
            assert.equal(after.dialog.action, c.id.startsWith("assign") ? "assign" : "remove");
            assert.equal(after.memberBusy, true);
          } else {
            assert.equal(after.dialog, null);
            assert.match(after.memberFeedback, /请先选择/);
          }
          assert.deepEqual(after.intents, []);
        } else if (c.actionId === "OG-T-LINK")
          assert.deepEqual(after.intents, [
            {
              url: c.id === "members" ? "/org-admin/members" : "/org-admin/workspaces",
              method: "NAVIGATE",
            },
          ]);
        else if (c.actionId === "OG-TECH")
          assert.equal(
            await page.locator("#technical").evaluate((n) => n.open),
            c.id !== "technical-open",
          );
        else if (c.actionId === "PROPOSAL-FILTERS")
          assert.equal(await page.locator("#filters").evaluate((n) => n.open), !c.filtersOpen);
        else if (c.actionId === "D-OG-REASON") {
          assert.equal(after.dialog, null);
          if (c.id.endsWith("confirm")) {
            assert.deepEqual(after.intents, [
              {
                url: `/org/admin/teams/${before.dialog.team.id}/members`,
                method: "POST",
                body: {
                  action: c.reasonAction,
                  membership_id: before.dialog.member.id,
                  reason: c.reasonAction === "assign" ? "分配团队成员" : "移除团队成员",
                },
              },
            ]);
            assert.equal(after.memberBusy, true);
          } else {
            assert.deepEqual(after.intents, []);
            assert.ok(
              await page
                .locator(`[data-member-action="${c.reasonAction}"]`)
                .evaluate((n) => n === document.activeElement),
            );
          }
        } else assert.fail(`Unverified action ${c.id}`);
        assert.deepEqual(after.items, before.items, "no fabricated team fact after action");
        interactions.push({ id: c.id, width, actionId: c.actionId, intents: after.intents });
      }
      for (const action of ["assign", "remove"]) {
        await prepare(`reason-${action}-confirm`, "default");
        if (capture) {
          const scene = `composition-${action}`,
            file = `${scene}-${width}.png`;
          await page.locator("#reason-dialog").screenshot({ path: `${output}/${file}` });
          screenshots.push({
            file,
            scene,
            width,
            pageId: "P33",
            scope: "pending-reason-composition",
            sha256: hash(await readFile(`${output}/${file}`)),
          });
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.cookies(), []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  assert.equal(screenshots.length, controls.reduce((n, c) => n + c.states.length, 0) * 2 + 4);
  const evidence = {
    kind: "TEAMS-CONTROLS-C-r1",
    approval: "pending-user-review",
    boundary:
      "Individual offline control states only. All child candidates linked; not formal full parent/field registry or real Vue/API/production acceptance. Inherited pending-field locks, reason500 and result ownership are proposals, not source rules.",
    sourceHashes,
    sourceFile,
    sourceSignatures,
    controls,
    checks,
    interactions,
    screenshots,
  };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const sections = controls
    .map(
      (c) =>
        `<section><h2>${c.label}</h2><p>${c.actionId} / ${c.proposalOnly ? "仅提案入口" : "源动作或其变体"}</p><div class="shots">${screenshots
          .filter((s) => s.control?.id === c.id)
          .map(
            (s) =>
              `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${c.label} ${s.control.variant} ${s.width}px"></a><figcaption>${s.control.variant} / ${s.width}px</figcaption></figure>`,
          )
          .join("")}</div></section>`,
    )
    .join("\n");
  const compositions = screenshots
    .filter((s) => !s.control)
    .map(
      (s) =>
        `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}px"></a><figcaption>${s.scene} / ${s.width}px</figcaption></figure>`,
    )
    .join("");
  await writeFile(
    `${output}/gallery.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P33 团队控件图册</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}
section{background:white;padding:20px;margin:24px 0;border-left:4px solid #254a9c}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
figure{margin:0}img{max-width:100%;height:350px;object-fit:contain;object-position:top left}a{color:#193b80}</style>
<h1>P33 团队 · 逐控件图册</h1><p>${controls.length}个控件/变体，${screenshots.length}张双端图；全部待审，不等于整页或生产完成。</p>
<p><a href="README.md">来源与边界</a> · <a href="index.html">离线交互</a></p>
<section><h2>分配 / 移除原因组合</h2><div class="shots">${compositions}</div></section>${sections}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(interactions, previous.interactions);
}
console.log(
  JSON.stringify({
    controls: controls.length,
    checks: checks.length,
    interactions: interactions.length,
    screenshots: screenshots.length,
    browserClosed: true,
    noHttpOrStorage: true,
  }),
);
