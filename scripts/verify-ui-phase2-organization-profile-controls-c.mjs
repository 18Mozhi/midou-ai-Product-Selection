import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative =
  "design-plans/ui-phase-2-2026-09-07/design/organization-profile-controls-direction-c";
const root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const parent = JSON.parse(
  await readFile(path.join(root, "../organization-profile-direction-c/evidence.json"), "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
for (const file of ["index.html", "controls.js", "controls.css"]
  .map((f) => `${relative}/${f}`)
  .concat("scripts/verify-ui-phase2-organization-profile-controls-c.mjs"))
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[\w-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
  }
}
const screenshots = [],
  checks = [],
  interactions = [],
  controlReferences = {};
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
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
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.ORG_PROFILE_CONTROLS_C));
      const controls = await page.evaluate(() => window.ORG_PROFILE_CONTROLS_C.controls);
      assert.equal(controls.length, 22);
      for (const c of controls) {
        controlReferences[c.id] ??= {
          actionId: c.actionId,
          scope: c.scope,
          label: c.label,
          selector: c.selector,
          sourceScene: c.scene,
          states: {},
        };
        for (const state of smoke ? [c.disabledOnly ? "disabled" : "focus"] : c.states) {
          await page.evaluate(({ id, mode }) => window.ORG_PROFILE_CONTROLS_C.prepare(id, mode), {
            id: c.id,
            mode: state === "pending" ? "pending" : "default",
          });
          const before = await page.evaluate(() => window.ORG_PROFILE_C.state());
          const target = page.locator(c.selector);
          assert.equal(await target.count(), 1, c.id);
          if (Object.hasOwn(c, "selected"))
            assert.equal(await target.getAttribute("aria-current"), String(c.selected));
          await page.mouse.move(1, 1);
          if (state === "focus") {
            await page.keyboard.press("Tab");
            for (
              let i = 0;
              i < 80 && !(await target.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true, c.id);
          } else
            await page.evaluate(() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            });
          await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
          if (["hover", "pressed"].includes(state)) await target.hover();
          if (state === "pressed") await page.mouse.down();
          if (["hover", "pressed"].includes(state))
            assert.equal(
              await target.evaluate(
                (el, s) => el.matches(s === "pressed" ? ":active" : ":hover"),
                state,
              ),
              true,
            );
          assert.equal(await target.isDisabled(), ["pending", "disabled"].includes(state));
          if (state === "pending") assert.ok(["save", "refresh"].includes(before.busy));
          if (c.actionId === "PROPOSAL-RECHECK") {
            assert.equal(before.busy, "");
            assert.equal(before.recheck, true);
            assert.equal(await target.evaluate((el) => getComputedStyle(el).cursor), "not-allowed");
          }
          const metrics = await target.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(getComputedStyle(el).fontSize),
              hit: el === hit || el.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          assert.ok(
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              !metrics.overflow,
            JSON.stringify({ id: c.id, width, state, metrics }),
          );
          assert.deepEqual(
            await page.evaluate(() => window.ORG_PROFILE_C.state()),
            before,
            "Visual state cannot mutate facts or intents",
          );
          assert.equal(await page.locator("dialog").count(), 0);
          await page.evaluate(() => window.getSelection()?.removeAllRanges());
          const scene = `${c.id}-${state}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
              control: { selector: c.selector, actionId: c.actionId, scope: c.scope, state },
            });
          }
          controlReferences[c.id].states[state] = scene;
          checks.push({ id: c.id, width, state, metrics, unchangedFacts: true });
          if (state === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
          }
        }
        if (c.context && !smoke) {
          await page.evaluate((id) => window.ORG_PROFILE_CONTROLS_C.prepare(id), c.id);
          const form = page.locator("#profile-form");
          assert.equal(await form.locator("#form-feedback").getAttribute("role"), "alert");
          assert.equal(
            await form
              .locator("#form-feedback p")
              .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
            16,
          );
          const scene = `${c.id}-context`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await form.screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
              control: {
                selector: "#profile-form",
                actionId: c.actionId,
                scope: c.scope,
                state: "context",
              },
            });
          }
          controlReferences[c.id].context = scene;
        }
      }
      // Real clicks in the offline proposal: no API transport, invented fields or hidden draft persistence.
      for (const c of controls.filter((item) => !item.disabledOnly)) {
        await page.evaluate((id) => window.ORG_PROFILE_CONTROLS_C.prepare(id), c.id);
        const before = await page.evaluate(() => window.ORG_PROFILE_C.state());
        const target = page.locator(c.selector);
        await target.click();
        const after = await page.evaluate(() => window.ORG_PROFILE_C.state());
        if (c.target) {
          assert.equal(await target.getAttribute("aria-current"), "true");
          assert.equal(await page.evaluate(() => document.activeElement.id), c.target);
          assert.deepEqual(after, before);
        } else if (c.actionId === "PROPOSAL-TECH") {
          assert.equal(await target.evaluate((el) => el.parentElement.open), true);
          assert.deepEqual(after, before);
        } else {
          if (c.actionId === "OG-PROFILE-SAVE")
            assert.deepEqual(after.intents, [
              {
                url: "/org/admin/profile",
                method: "PATCH",
                body: { ...before.form, expected_version: before.profile.version },
              },
            ]);
          else
            assert.deepEqual(
              after.intents,
              ["summary", "profile", "workspaces"].map((p) => ({
                url: `/org/admin/${p}`,
                method: "GET",
              })),
            );
          assert.deepEqual(after.form, before.form);
          assert.deepEqual(after.profile, before.profile);
        }
        interactions.push({ width, id: c.id, exactIntentOrLocalNavigation: true });
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
  assert.equal(screenshots.length, 170);
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "ORG-PROFILE-CONTROLS-C-r1",
        scope: "offline-proposal-not-runtime-or-user-accepted",
        sourceHashes,
        controlReferences,
        checks,
        interactions,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const labels = {
    default: "默认",
    hover: "悬停",
    focus: "键盘焦点",
    pressed: "按下",
    pending: "处理中",
    disabled: "禁用",
    context: "表单与反馈全景",
  };
  const intro = [
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>P29 逐按钮状态审核</title><style>body{margin:24px;background:#edf1f6;color:#202c3d;font:16px/1.6 sans-serif}",
    "main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}",
    "img{width:100%;height:480px;object-fit:contain}a{color:#254a9c}</style><h1>P29 组织资料 · 逐按钮状态待审</h1>",
    "<p>170图：162控件状态与8反馈全景。现有业务动作与目录/技术详情/结果核验提案分别标注；无业务弹窗，未获审、未部署。</p>",
    '<p><a href="index.html">交互稿</a> · <a href="README.md">范围与未完成项</a></p><main>',
  ];
  for (const shot of screenshots) {
    const ref = Object.values(controlReferences).find(
      (r) => Object.values(r.states).includes(shot.scene) || r.context === shot.scene,
    );
    intro.push(
      `<figure><a href="${shot.file}"><img src="${shot.file}" loading="lazy" alt="${ref.label} ${labels[shot.control.state]} ${shot.width}"></a><figcaption>${ref.label} · ${labels[shot.control.state]} · ${shot.width}px · ${ref.scope.startsWith("proposal") ? "仅提案" : "现有动作"}</figcaption></figure>`,
    );
  }
  await writeFile(path.join(root, "gallery.html"), intro.join("\n") + "\n</main></html>\n");
} else if (!smoke) {
  assert.deepEqual(previous.checks, checks);
  assert.deepEqual(previous.interactions, interactions);
  assert.deepEqual(previous.controlReferences, controlReferences);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    interactions: interactions.length,
    screenshots: capture ? screenshots.length : (previous?.screenshots.length ?? 0),
    browserClosed: true,
    httpRequests: 0,
  }),
);
