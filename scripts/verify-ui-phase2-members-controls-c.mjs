import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/members-controls-direction-c";
const root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke));
const parent = JSON.parse(
  await readFile(path.join(root, "../members-direction-c/evidence.json"), "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
for (const file of ["index.html", "controls.css", "controls.js"]
  .map((f) => `${relative}/${f}`)
  .concat("scripts/verify-ui-phase2-members-controls-c.mjs"))
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
const checks = [],
  interactions = [],
  screenshots = [],
  controlReferences = {},
  actionVisualReferences = {},
  controlVariantReferences = {};
const contexts = [
  "invite_partial",
  "invite_interrupted",
  "invite_success",
  "action_conflict",
  "refresh_error",
  "action_busy",
];
function contrast(a, b) {
  const light = (v) =>
    v
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((x) => x / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      .reduce((n, x, i) => n + x * [0.2126, 0.7152, 0.0722][i], 0);
  const x = light(a),
    y = light(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
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
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.MEMBERS_CONTROLS_C));
      const controls = await page.evaluate(() => window.MEMBERS_CONTROLS_C.controls);
      assert.equal(controls.length, 51);
      const prepare = (id, mode = "default") =>
        page.evaluate(({ id, mode }) => window.MEMBERS_CONTROLS_C.prepare(id, mode), { id, mode });
      const state = () => page.evaluate(() => window.MEMBERS_C.state());
      for (const c of controls) {
        controlReferences[c.id] ??= {
          actionId: c.actionId,
          pageId: "P30",
          scope: c.scope,
          label: c.label,
          selector: c.selector,
          sourceScene: c.scene,
          primary: Boolean(c.primary),
          states: {},
        };
        for (const mode of smoke ? [c.disabledOnly ? "disabled" : "focus"] : c.states) {
          await prepare(c.id, mode);
          const target = page.locator(c.selector);
          assert.equal(await target.count(), 1, c.id);
          await page.mouse.move(1, 1);
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
          const before = await state();
          if (mode === "focus") {
            for (
              let i = 0;
              i < 120 &&
              !(await target.evaluate(
                (el) => el === document.activeElement && el.matches(":focus-visible"),
              ));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(
              await target.evaluate(
                (el) => el === document.activeElement && el.matches(":focus-visible"),
              ),
              true,
              `keyboard ${c.id}`,
            );
          }
          await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
          if (["hover", "pressed"].includes(mode)) await target.hover();
          if (mode === "pressed") await page.mouse.down();
          if (["hover", "pressed"].includes(mode))
            assert.equal(
              await target.evaluate(
                (el, mode) => el.matches(mode === "pressed" ? ":active" : ":hover"),
                mode,
              ),
              true,
            );
          const m = await target.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              css = getComputedStyle(el),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            let parent = el.parentElement,
              adjacent = "rgb(237, 241, 246)";
            while (parent) {
              const bg = getComputedStyle(parent).backgroundColor;
              if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
                adjacent = bg;
                break;
              }
              parent = parent.parentElement;
            }
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(css.fontSize),
              outline: css.outlineColor,
              adjacent,
              disabled: el.matches(":disabled"),
              hit: el === hit || el.contains(hit),
              selected: el.getAttribute("aria-pressed") ?? el.getAttribute("aria-current"),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              name:
                el.getAttribute("aria-label") ||
                (el.labels?.length
                  ? [...el.labels].map((n) => n.textContent).join(" ")
                  : el.textContent),
              described:
                el
                  .getAttribute("aria-describedby")
                  ?.split(" ")
                  .every((id) => Boolean(document.getElementById(id))) ?? true,
            };
          });
          assert.ok(
            m.hit &&
              !m.overflow &&
              m.font >= 16 &&
              m.width >= 44 &&
              m.height >= 44 &&
              m.name?.trim() &&
              m.described,
            JSON.stringify({ id: c.id, mode, m }),
          );
          assert.equal(m.disabled, ["disabled", "busy"].includes(mode));
          if (mode === "focus")
            assert.ok(contrast(m.outline, m.adjacent) >= 3, JSON.stringify({ id: c.id, m }));
          if (c.selected !== undefined) assert.equal(m.selected, String(c.selected));
          const after = await state();
          for (const key of ["items", "invitations", "form", "selections", "intents", "results"])
            assert.deepEqual(after[key], before[key], `${c.id} ${mode} ${key}`);
          if (m.disabled) {
            const box = await target.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            assert.deepEqual((await state()).intents, before.intents);
            assert.equal(await target.isDisabled(), true);
          }
          await page.evaluate(() => window.getSelection()?.removeAllRanges());
          const scene = `${c.id}-${mode}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.screenshot({ path: path.join(root, file), animations: "disabled" });
            screenshots.push({
              file,
              width,
              scene,
              sha256: hash(await readFile(path.join(root, file))),
              control: {
                key: `P30-${c.id}`,
                actionId: c.actionId,
                selector: c.selector,
                state: mode,
                scope: c.scope,
              },
            });
          }
          controlReferences[c.id].states[mode] = scene;
          checks.push({ id: c.id, width, state: mode, metrics: m });
          if (mode === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
          }
        }
      }
      // Real local interaction per explicit variant; read and write intentions never contact services.
      for (const c of controls.filter((c) => !c.disabledOnly)) {
        await prepare(c.id);
        const before = await state(),
          target = page.locator(c.selector);
        const wasOpen = await target.evaluate((el) =>
          el.tagName === "SUMMARY" ? el.parentElement.open : null,
        );
        if (c.shortReason) await page.locator("#reason-input").fill("核验成员变更");
        if (c.select) await target.selectOption(c.value);
        else if (c.id === "search") await target.fill(c.value);
        else await target.click();
        const after = await state();
        assert.deepEqual(after.items, before.items);
        assert.deepEqual(after.invitations, before.invitations);
        if (c.busyAction) {
          assert.equal(after.dialog.action, c.busyAction);
          assert.equal(after.dialog.item.id, c.targetId);
          await page.locator("#reason-cancel").click();
          assert.equal(await target.evaluate((el) => el === document.activeElement), true);
          assert.deepEqual(after.intents, []);
        } else if (c.shortReason) {
          const contract = await page.evaluate((action) => {
            const { options, ...body } = window.MEMBERS_C_DATA.contracts[action];
            return body;
          }, c.reasonAction);
          assert.deepEqual(after.intents, [contract]);
          assert.equal(await page.locator("dialog[open]").count(), 0);
        } else if (c.selector === "#invite-submit") {
          const emails = [
            ...new Set(
              before.form.emails
                .split(/[\n,;]+/)
                .map((v) => v.trim().toLowerCase())
                .filter(Boolean),
            ),
          ];
          assert.deepEqual(
            after.intents,
            emails.map((email) => ({
              url: "/org/admin/invitations",
              method: "POST",
              body: { email, role_code: before.form.role_code, reason: before.form.reason.trim() },
            })),
          );
        } else if (["#refresh", "#retry"].includes(c.selector))
          assert.deepEqual(
            after.intents,
            ["/org/admin/summary", "/org/admin/members"].map((url) => ({ url, method: "GET" })),
          );
        else {
          assert.deepEqual(after.intents, []);
          if (c.reasonAction) assert.equal(await page.locator("dialog[open]").count(), 0);
          if (c.selector.startsWith("[data-tab="))
            assert.equal(after.tab, c.actionId === "OG-M-TAB-PENDING" ? "pending" : "expired");
          if (["prev", "next"].includes(c.id)) assert.equal(after.page, c.id === "prev" ? 1 : 2);
          if (["reset", "reset-empty"].includes(c.id))
            assert.deepEqual(after.filters, {
              query: "",
              status: "",
              role: "",
              team: "",
              sort: "name_asc",
            });
          if (c.id === "row-role")
            assert.equal(after.selections[await target.getAttribute("data-selection")], c.value);
          if (c.id.startsWith("filter-")) assert.equal(after.filters[c.id.slice(7)], c.value);
          if (c.id === "search") assert.equal(after.filters.query, c.value);
          if (wasOpen !== null)
            assert.equal(await target.evaluate((el) => el.parentElement.open), !wasOpen);
          if (c.target) assert.equal(await target.getAttribute("aria-current"), "true");
        }
        interactions.push({
          id: c.id,
          width,
          intents: after.intents,
          outcome: "passed-offline-not-Vue",
        });
      }
      if (!smoke)
        for (const scene of contexts) {
          await page.evaluate((scene) => window.MEMBERS_C.scene(scene), scene);
          const target = scene.startsWith("invite_")
            ? page.locator("#invitation-section")
            : page.locator(".page-head");
          await target.scrollIntoViewIfNeeded();
          const file = `${scene}-context-${width}.png`;
          if (capture) {
            if (scene.startsWith("invite_"))
              await target.screenshot({ path: path.join(root, file) });
            else await page.screenshot({ path: path.join(root, file) });
            screenshots.push({
              file,
              width,
              scene: `${scene}-context`,
              sha256: hash(await readFile(path.join(root, file))),
              scope: "feedback-context-not-control-state",
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
for (const [id, c] of Object.entries(controlReferences)) {
  if (c.scope !== "source-action-representative-or-variant") continue;
  if (c.primary)
    actionVisualReferences[c.actionId] = {
      pageId: "P30",
      scope: "representative-control-only-not-all-variants-or-Vue",
      selector: c.selector,
      states: c.states,
    };
  else
    controlVariantReferences[`P30-${id}`] = {
      pageId: "P30",
      scope: "additional-control-variant-not-new-action",
      actionId: c.actionId,
      selector: c.selector,
      states: c.states,
    };
}
if (capture) {
  assert.equal(checks.length, 432); // 84 primary + 92 source variants + 40 proposal-only states, twice.
  assert.equal(screenshots.length, checks.length + contexts.length * 2);
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "MEMBERS-CONTROLS-C-r1",
        scope: "offline-proposal-not-runtime-or-user-accepted",
        sourceHashes,
        controlReferences,
        actionVisualReferences,
        controlVariantReferences,
        checks,
        interactions,
        contexts,
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
    disabled: "禁用",
    busy: "处理中",
  };
  const contextLabels = {
    invite_partial: "逐条部分失败",
    invite_interrupted: "中断保留未处理项（仅提案）",
    invite_success: "创建待投递",
    action_conflict: "操作版本冲突",
    refresh_error: "刷新失败",
    action_busy: "操作处理中",
  };
  const html = [
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>P30 按钮状态待审</title><style>body{margin:24px;background:#edf1f6;color:#202c3d;font:16px/1.6 sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain}a{color:#254a9c}</style>",
    '<h1>P30 成员与邀请 · 逐按钮状态待审</h1><p>51控件/变体，432状态图＋12反馈上下文图。只读原型，不是生产或用户批准。</p><p><a href="index.html">交互稿</a> · <a href="README.md">范围与未完成项</a></p><main>',
  ];
  for (const shot of screenshots) {
    const c = shot.control ? controlReferences[shot.control.key.slice(4)] : null;
    const caption = c
      ? `${c.label} · ${labels[shot.control.state]} · ${c.scope.startsWith("proposal") ? "仅提案" : "现有动作的提案呈现"}`
      : `${contextLabels[shot.scene.replace(/-context$/, "")]} · 反馈上下文`;
    html.push(
      `<figure><a href="${shot.file}"><img src="${shot.file}" loading="lazy" alt="${caption} ${shot.width}"></a><figcaption>${caption} · ${shot.width}px</figcaption></figure>`,
    );
  }
  await writeFile(path.join(root, "gallery.html"), html.join("\n") + "\n</main></html>\n");
} else if (!smoke) {
  for (const [key, value] of Object.entries({
    checks,
    interactions,
    controlReferences,
    actionVisualReferences,
    controlVariantReferences,
  }))
    assert.deepEqual(previous[key], value, key);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    interactions: interactions.length,
    screenshots: screenshots.length || previous?.screenshots.length || 0,
    httpRequests: 0,
    browserClosed: true,
  }),
);
