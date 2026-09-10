import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/roles-controls-direction-c",
  root = path.join(repo, relative);
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(
  await readFile(path.join(root, "../roles-direction-c/evidence.json"), "utf8"),
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
  .concat("scripts/verify-ui-phase2-roles-controls-c.mjs"))
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[\w-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
  }
}
const screenshots = [],
  checks = [],
  interactions = [],
  controlReferences = {},
  actionVisualReferences = {},
  controlVariantReferences = {};
function contrast(a, b) {
  const light = (v) =>
    v
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((x) => x / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      .reduce((n, x, i) => n + x * [0.2126, 0.7152, 0.0722][i], 0);
  return (Math.max(light(a), light(b)) + 0.05) / (Math.min(light(a), light(b)) + 0.05);
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
        http = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) http.push(r.url());
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => window.ROLES_CONTROLS_C);
      const all = await page.evaluate(() => window.ROLES_CONTROLS_C.controls);
      const controls = smoke
        ? all.filter((c) =>
            [
              "create-opportunity",
              "reason-confirm",
              "section-roles-selected",
              "page-prev",
              "scope-reset",
            ].includes(c.id),
          )
        : all;
      const prepare = async (c, mode = "default") => {
        await page.mouse.move(1, 1);
        await page.evaluate(({ id, mode }) => window.ROLES_CONTROLS_C.prepare(id, mode), {
          id: c.id,
          mode,
        });
        await page.locator(c.selector).scrollIntoViewIfNeeded();
      };
      const state = () =>
        page.evaluate(() => ({
          note: document.getElementById("review-note").textContent,
          form: [
            ...document.querySelectorAll(
              "#create-form input,#create-form textarea,#create-form select,#extend-form input,#revoke-reason",
            ),
          ].map((el) => [el.id, el.value, el.checked ?? null]),
          selected: [...document.querySelectorAll("[aria-pressed]")].map((el) => [
            el.id || el.dataset.role || el.dataset.section || el.dataset.status,
            el.getAttribute("aria-pressed"),
          ]),
          dialog: document.getElementById("revoke-dialog").open,
        }));
      for (const c of controls) {
        controlReferences[c.id] = { ...c, states: {} };
        for (const mode of c.states) {
          await prepare(c, mode);
          const target = page.locator(c.selector),
            before = await state();
          if (mode === "hover") await target.hover();
          if (mode === "focus") {
            await page.keyboard.press("Tab");
            await target.focus();
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true);
          }
          if (mode === "pressed") {
            await target.hover();
            await page.mouse.down();
            assert.equal(await target.evaluate((el) => el.matches(":active")), true);
          }
          const m = await target.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              css = getComputedStyle(el),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            let p = el.parentElement,
              bg = "rgb(255, 255, 255)";
            while (p) {
              const v = getComputedStyle(p).backgroundColor;
              if (v !== "rgba(0, 0, 0, 0)" && v !== "transparent") {
                bg = v;
                break;
              }
              p = p.parentElement;
            }
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(css.fontSize),
              disabled: el.matches(":disabled"),
              hit: el === hit || el.contains(hit),
              outline: css.outlineColor,
              bg,
              selected: el.getAttribute("aria-pressed"),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              name: el.getAttribute("aria-label") || el.labels?.[0]?.textContent || el.textContent,
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
              m.width >= 44 &&
              m.height >= 44 &&
              m.font >= 16 &&
              m.name?.trim() &&
              m.described,
            JSON.stringify({ id: c.id, mode, width, m }),
          );
          assert.equal(m.disabled, ["busy", "disabled"].includes(mode), `${c.id}/${mode}`);
          if (c.selected !== undefined) assert.equal(m.selected, String(c.selected));
          if (mode === "focus")
            assert.ok(contrast(m.outline, m.bg) >= 3, JSON.stringify({ id: c.id, m }));
          assert.deepEqual(await state(), before, `${c.id} ${mode} visual must not activate`);
          if (m.disabled) {
            const b = await target.boundingBox();
            await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
            assert.deepEqual(await state(), before);
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
                key: `P31-${c.id}`,
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
      for (const c of controls.filter((c) => !c.disabledOnly)) {
        await prepare(c);
        const target = page.locator(c.selector),
          before = await state();
        const open = await target.evaluate((el) =>
          el.tagName === "SUMMARY" ? el.parentElement.open : null,
        );
        if (c.select) await target.selectOption("sourcing");
        else await target.click();
        if (c.select)
          assert.deepEqual(
            await page
              .locator("#grant-actions input")
              .evaluateAll((els) => els.map((e) => e.value)),
            ["sourcing:read", "supplier_quote:manage", "cost:confirm"],
          );
        else if (c.id.startsWith("section-"))
          assert.equal(await target.getAttribute("aria-pressed"), "true");
        else if (c.id.startsWith("role-") && open === null)
          assert.equal(await target.getAttribute("aria-pressed"), "true");
        else if (open !== null)
          assert.equal(await target.evaluate((el) => el.parentElement.open), !open);
        else if (c.id === "capability-reset")
          assert.equal(await page.locator("#capability-query").inputValue(), "");
        else if (c.id === "scope-reset")
          assert.equal(await page.locator("#member-query").inputValue(), "");
        else if (["create-open", "first-grant"].includes(c.id))
          assert.equal(await page.locator("#create-form").isVisible(), true);
        else if (c.id === "create-cancel") {
          assert.equal(await page.locator("#create-form").isVisible(), false);
          assert.deepEqual((await state()).form, before.form);
        } else if (c.id.startsWith("create-") || c.id === "extend")
          assert.match((await state()).note, /输入演示已核对/);
        else if (c.id.startsWith("status-"))
          assert.equal(await target.getAttribute("aria-pressed"), "true");
        else if (c.id === "all-grants")
          assert.equal(
            await page.locator("[data-status='all']").getAttribute("aria-pressed"),
            "true",
          );
        else if (c.id === "revoke") {
          assert.equal(await page.locator("#revoke-dialog").evaluate((el) => el.open), true);
          await page.keyboard.press("Escape");
          assert.equal(await target.evaluate((el) => el === document.activeElement), true);
        } else if (c.id.startsWith("reason-"))
          assert.equal(await page.locator("#revoke-dialog").evaluate((el) => el.open), false);
        else if (c.id === "select-grant")
          assert.deepEqual(await state(), before); // One already-selected fixture; not switching between two grants.
        else assert.fail(`No interaction assertion for ${c.id}`);
        interactions.push({ id: c.id, width, outcome: "passed-offline-input-demo-not-Vue-or-API" });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(http, []);
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
  if (c.primary)
    actionVisualReferences[c.actionId] = {
      pageId: "P31",
      scope: "representative-control-only-not-all-variants-or-Vue",
      selector: c.selector,
      states: c.states,
    };
  else
    controlVariantReferences[`P31-${id}`] = {
      pageId: "P31",
      scope: "additional-control-variant-not-new-action",
      actionId: c.actionId,
      selector: c.selector,
      states: c.states,
    };
}
if (capture) {
  const evidence = {
    version: "ROLE-CONTROLS-C-r1",
    scope: "offline-proposal-not-runtime-or-user-accepted",
    sourceHashes,
    controlReferences,
    actionVisualReferences,
    controlVariantReferences,
    checks,
    interactions,
    screenshots,
  };
  await writeFile(path.join(root, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  const cards = Object.entries(controlReferences)
    .map(
      ([id, c]) =>
        `<section id="${id}"><h2>${c.label}</h2><p>${c.actionId} · 非真实Vue/接口成功证明</p><div class="grid">${Object.entries(
          c.states,
        )
          .flatMap(([mode, scene]) =>
            [1440, 390].map(
              (width) =>
                `<figure><a href="${scene}-${width}.png"><img loading="lazy" src="${scene}-${width}.png" alt="${c.label} ${mode} ${width}" /></a><figcaption>${mode} · ${width}px</figcaption></figure>`,
            ),
          )
          .join("")}</div></section>`,
    )
    .join("\n");
  await writeFile(
    path.join(root, "gallery.html"),
    `<!doctype html>\
<html lang="zh-CN">\
<meta charset="utf-8">\
<meta name="viewport" content="width=device-width,initial-scale=1">\
<title>P31 控件状态待审</title>\
<style>body{margin:0;background:#edf2f8;color:#172944;font:16px/1.65 'Microsoft YaHei',sans-serif}main{max-width:1400px;margin:auto;padding:24px}h1{font-size:32px;color:#244d9c}\
section{background:white;padding:24px;margin:24px 0;border-radius:14px}\
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}\
figure{margin:0;border:1px solid #b5c4da;padding:10px}\
img{display:block;max-width:100%;height:260px;object-fit:contain}a{color:#214993}a:focus-visible{outline:3px solid #153e92}figcaption{margin-top:8px}</style>\
<main>\
<h1>P31 / 角色与授权控件状态</h1>\
<p>C方向待审。保留详情复制UUID。仅隔离历史样本与控件输入演示，未修改生产。</p>\
<p>点击图片查看原尺寸；状态图不等于所有组合或用户批准。<a href="index.html">交互稿</a>\
</p>${cards}</main>\
</html>
`,
  );
  const rows = Object.values(controlReferences)
    .flatMap((c) =>
      Object.entries(c.states).map(
        ([mode, scene]) =>
          `| ${c.label} | ${mode} | [桌面](${scene}-1440.png) | [手机](${scene}-390.png) |`,
      ),
    )
    .join("\n");
  await writeFile(
    path.join(root, "README.md"),
    `# P31 角色与权限 / 控件状态待审

ROLE-CONTROLS-C-r1，2026-09-10。使用ui-skills-root/frontend-design及现有Playwright，保留已选C方向、蓝分区/白工作面；仅新子稿强化44px点击区、16px技术入口、蓝焦点/危险按下反馈和等待说明。原48图/renderer/fixture与真实Vue未改。

[图册](gallery.html) · [交互稿](index.html) · [页面规格](../../page-specs/P31.md) · [源合同](../../roles-semantic-contract-review.md)

${Object.keys(controlReferences).length}控件/变体、${checks.length / 2}个单端状态、双端${screenshots.length}PNG，${interactions.length}次离线点击/选择核对。${Object.keys(actionVisualReferences).length}代表动作及${Object.keys(controlVariantReferences).length}附加变体；这些不是新增业务动作。

分区/角色/状态筛选的已选与未选分别出图；鼠标按下不冒充逻辑选中。四类型创建表单保留白名单与真实详情复制UUID，空动作禁用、创建等待、延期等待、撤销原因不足分别列明。原因窗先关闭再演示输入确认，不补造窗内提交busy；共享前端无maxlength，服务端max500仍须单独验证。

分页夹具仅一页：两按钮只展示disabled，不伪造可翻页数据。当前唯一授权已选按钮不证明跨授权切换。父级刷新/错误尚未出图，类型select不截图原生系统弹层/pressed。状态筛选busy只模拟目标按钮禁用，不宣称全页异步时序通过。现有原型延期期限仅验未来30天，真实后端另要求晚于原expiry；本批只用合法延期样本，不宣称服务器接受输入演示。

所有字段六态、完整组合、真实C实施/跨范围/草稿归属、具体审核及全站宝塔验收仍待。无API请求、cookies/storage、真实授权写入；不改权限/API/OpenAPI/MySQL/env/依赖，无新增配置、无需重启、未部署。全部图为永久审核交付物，非临时测试产物。

验证：node scripts/verify-ui-phase2-roles-controls-c.mjs --smoke；--capture生成永久PNG/图册/evidence；无参数核对来源与PNG哈希并重演交互。

| 控件/变体 | 状态 | 1440 | 390 |
| --- | --- | --- | --- |
${rows}
`,
  );
} else if (!smoke) {
  assert.deepEqual(previous.controlReferences, controlReferences);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(previous.controlVariantReferences, controlVariantReferences);
  assert.equal(previous.checks.length, checks.length);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "check",
    controls: Object.keys(controlReferences).length,
    actions: Object.keys(actionVisualReferences).length,
    variants: Object.keys(controlVariantReferences).length,
    checks: checks.length,
    interactions: interactions.length,
    pngs: screenshots.length,
  }),
);
