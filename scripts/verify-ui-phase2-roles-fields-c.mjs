import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/roles-fields-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(
  await readFile(path.join(root, "../roles-controls-direction-c/evidence.json"), "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [f, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")), sha, f);
for (const f of ["index.html", "fields.css", "fields.js"]
  .map((f) => `${relative}/${f}`)
  .concat("scripts/verify-ui-phase2-roles-fields-c.mjs"))
  sourceHashes[f] = hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"));
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[\w-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
  }
}
const checks = [],
  screenshots = [],
  interactions = [],
  fieldVisualReferences = {};
const combinations = [
  "create-ready",
  "create-errors",
  "create-no-actions",
  "create-pending",
  "extend-ready",
  "extend-not-later",
  "extend-pending",
  "revoke-short",
  "revoke-long",
];
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
      await page.waitForFunction(() => window.ROLES_FIELDS_C);
      const all = await page.evaluate(() => window.ROLES_FIELDS_C.fields),
        fields = smoke
          ? all.filter((c) => ["resource-id", "extend-expiry", "revoke-reason"].includes(c.id))
          : all;
      const prepare = async (id, mode) =>
        page.evaluate(({ id, mode }) => window.ROLES_FIELDS_C.prepare(id, mode), { id, mode });
      async function shot(scene, extra, target) {
        if (!capture) return;
        const file = `${scene}-${width}.png`;
        if (target)
          await target.screenshot({ path: path.join(root, file), animations: "disabled" });
        else await page.screenshot({ path: path.join(root, file), animations: "disabled" });
        screenshots.push({
          file,
          width,
          scene,
          sha256: hash(await readFile(path.join(root, file))),
          ...extra,
        });
      }
      for (const c of fields) {
        fieldVisualReferences[c.binding] = {
          pageId: "P31",
          scope: "representative-field-states-not-all-combinations-or-Vue",
          selector: c.selector,
          states: {},
        };
        for (const mode of c.states) {
          await page.mouse.move(1, 1);
          await prepare(c.id, mode);
          const target = page.locator(c.selector);
          await target.scrollIntoViewIfNeeded();
          await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
          if (mode === "hover") await target.hover();
          if (mode === "focus") {
            await page.keyboard.press("Tab");
            await target.focus();
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true);
          }
          const m = await target.evaluate((el, kind) => {
            const area = kind === "actions" ? el.closest("label") : el,
              r = area.getBoundingClientRect(),
              css = getComputedStyle(area);
            const helpIds = el.getAttribute("aria-describedby")?.split(" ") ?? [];
            const check = kind === "actions" ? el.closest("fieldset") : el;
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(css.fontSize),
              name: el.labels?.[0]?.textContent ?? "",
              help:
                helpIds.length >= 2 && helpIds.every((id) => Boolean(document.getElementById(id))),
              invalid: check.getAttribute("aria-invalid") === "true",
              errorVisible: helpIds.some((id) => {
                const n = document.getElementById(id);
                return n.classList.contains("field-error") && !n.hidden && Boolean(n.textContent);
              }),
              outline: getComputedStyle(check).outlineWidth,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              disabled: el.disabled,
            };
          }, c.kind);
          assert.ok(
            m.width >= 44 &&
              m.height >= 44 &&
              m.font >= 16 &&
              m.name.trim() &&
              m.help &&
              !m.overflow &&
              !m.disabled,
            JSON.stringify({ id: c.id, mode, width, m }),
          );
          const invalid = [
            "empty",
            "invalid",
            "spaces",
            "short",
            "none",
            "past",
            "over-limit",
            "not-extended",
          ].includes(mode);
          assert.equal(m.invalid, invalid, `${c.id}/${mode}`);
          assert.equal(m.errorVisible, invalid, `${c.id}/${mode}/error`);
          if (mode === "focus") assert.ok(parseFloat(m.outline) >= 3);
          if (mode === "limit") assert.equal((await target.inputValue()).length, 500);
          if (mode === "long") {
            assert.equal((await target.inputValue()).length, 501);
            assert.equal(await target.getAttribute("maxlength"), null);
          }
          if (mode === "pending") {
            assert.equal(
              await page
                .locator(c.scene === "grants" ? "#extend-submit" : "#create-submit")
                .isDisabled(),
              true,
            );
            const before = await target.inputValue();
            await target.fill(
              c.kind === "uuid"
                ? "00000000-0000-4000-8000-000000000624"
                : ["expiry", "extend"].includes(c.kind)
                  ? "2026-09-05T18:00"
                  : "处理中新增草稿",
            );
            assert.equal(await target.isDisabled(), false);
            assert.ok((await target.inputValue()).length);
            await target.fill(before);
          }
          const scene = `${c.id}-${mode}`;
          await shot(scene, { field: { binding: c.binding, selector: c.selector, state: mode } });
          fieldVisualReferences[c.binding].states[mode] = scene;
          checks.push({ id: c.id, binding: c.binding, width, state: mode, metrics: m });
        }
      }
      for (const combo of combinations) {
        const f = combo.startsWith("revoke")
          ? "revoke-reason"
          : combo.startsWith("extend")
            ? "extend-expiry"
            : "resource-id";
        const mode = combo.endsWith("pending")
          ? "pending"
          : combo === "extend-not-later"
            ? "not-extended"
            : combo === "revoke-short"
              ? "short"
              : combo === "revoke-long"
                ? "long"
                : "default";
        await prepare(f, mode);
        if (combo === "create-errors") {
          await page.locator("#resource-id").fill("invalid");
          await page.locator("#create-reason").fill("   ");
          await page.locator("#expires-at").fill("2026-09-28T18:00");
        }
        if (combo === "create-no-actions") await prepare("grant-actions", "none");
        const target = page.locator(
          combo.startsWith("revoke")
            ? "#revoke-dialog"
            : combo.startsWith("extend")
              ? "#extend-form"
              : "#create-form",
        );
        await target.scrollIntoViewIfNeeded();
        await shot(`${combo}-form`, { scope: "field-combination-not-production" }, target);
        const note = await page.locator("#review-note").textContent();
        if (["create-ready", "extend-ready"].includes(combo)) {
          await page
            .locator(combo === "create-ready" ? "#create-submit" : "#extend-submit")
            .click();
          assert.match(await page.locator("#review-note").textContent(), /输入演示已核对/);
        } else if (combo === "extend-not-later") {
          await page.locator("#extend-submit").click();
          assert.equal(await page.locator("#review-note").textContent(), note);
          assert.equal(await page.locator("#error-extend-expiry").isVisible(), true);
        } else if (combo === "create-errors") {
          assert.equal(await page.locator("#error-resource-id").isVisible(), true);
          assert.equal(await page.locator("#error-create-reason").isVisible(), true);
          assert.equal(await page.locator("#error-expires-at").isVisible(), true);
          await page.locator("#resource-id").fill("00000000-0000-4000-8000-000000000624");
          assert.equal(await page.locator("#error-resource-id").isVisible(), false);
        } else if (combo === "create-no-actions")
          assert.equal(await page.locator("#create-submit").isDisabled(), true);
        else if (combo.endsWith("pending"))
          assert.equal(
            await page
              .locator(combo.startsWith("extend") ? "#extend-submit" : "#create-submit")
              .isDisabled(),
            true,
          );
        else if (combo === "revoke-short")
          assert.equal(await page.locator("#confirm-revoke").isDisabled(), true);
        else if (combo === "revoke-long") {
          assert.equal(await page.locator("#confirm-revoke").isDisabled(), false);
          await page.locator("#cancel-revoke").click();
          assert.equal(await page.locator("#review-note").textContent(), note);
        }
        interactions.push({ combo, width, outcome: "offline-field-combination-only" });
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
if (capture) {
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "ROLE-FIELDS-C-r1",
        scope: "offline-field-proposal-not-runtime-or-user-accepted",
        sourceHashes,
        fieldVisualReferences,
        combinations,
        checks,
        interactions,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const rows = screenshots
    .filter((s) => s.width === 1440)
    .map((s) => `| ${s.scene} | [桌面](${s.scene}-1440.png) | [手机](${s.scene}-390.png) |`)
    .join("\n");
  await writeFile(
    path.join(root, "README.md"),
    `# P31 字段与表单组合待审

ROLE-FIELDS-C-r1，16字段（14本地模型、1受控类型、1共享原因）。${checks.length / 2}单端代表状态、9组合，双端${screenshots.length}PNG。

[图册](gallery.html) · [交互稿](index.html) · [页面规格](../../page-specs/P31.md) · [批准范围](../../P31-CONTROL-VISUAL-APPROVAL.md)

沿用四项已批准控件视觉；使用fixing-accessibility新增就近说明/aria-describedby、无效状态及live错误和原因字数。全部只在新子稿中，旧48+378图/源Vue保持不变。UUID继续复制真实详情，格式正确不等于可访问。四类型/四范围与已返回能力组保留；工作区只有一个选项，不伪造切换。

创建/延期原因必填至500；共享撤销前端至少2字且无maxlength，501字图只证明前端输入，不证明服务端接受。延期必须晚于原到期时间，按已存在后端规则补提案就地错误；真实Vue未修。busy字段保持可编辑，不更改未审草稿归属规则。九组合覆盖创建可用/多错误/无动作/等待、延期可用/未延长/等待、撤销不足/501字取消。

原型输入演示不发API、不写审计或授权；没有真实后端、权限/MySQL、完整Vue生命周期验收。全部字段排列/原生日期弹层/软键盘/主题密度等组合、更多多页样本、具体字段批准和全站C实施/宝塔仍待。无新配置/依赖/重启/部署，PNG是永久审核交付物，不是临时文件。

验证：node scripts/verify-ui-phase2-roles-fields-c.mjs --smoke；--capture生成，默认只读复验来源与PNG并执行全部状态/组合。

| 场景 | 1440 | 390 |
| --- | --- | --- |
${rows}
`,
  );
  const cards = screenshots
    .filter((s) => s.width === 1440)
    .map(
      (s) =>
        `<section><h2>${s.scene}</h2><div>${[1440, 390].map((w) => `<a href="${s.scene}-${w}.png"><img loading="lazy" alt="${s.scene} ${w}px" src="${s.scene}-${w}.png"></a>`).join("")}</div></section>`,
    )
    .join("\n");
  await writeFile(
    path.join(root, "gallery.html"),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P31 字段与组合待审</title><style>body{background:#edf2f8;color:#172944;font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px}section{padding:20px;background:white;margin:20px 0}section div{display:flex;flex-wrap:wrap;gap:20px}img{max-width:100%;height:320px;object-fit:contain}a:focus-visible{outline:3px solid #153e92}h2{overflow-wrap:anywhere}</style>
<h1>P31 / 字段与组合</h1><p>16字段及9组合，仅新字段样式待审，不是生产验证。点击图片查看原尺寸。<a href="index.html">交互稿</a></p>${cards}</html>
`,
  );
} else if (!smoke) {
  assert.deepEqual(previous.fieldVisualReferences, fieldVisualReferences);
  assert.equal(previous.checks.length, checks.length);
  assert.deepEqual(previous.combinations, combinations);
  assert.deepEqual(previous.interactions, interactions);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "check",
    fields: Object.keys(fieldVisualReferences).length,
    checks: checks.length,
    combinations: combinations.length,
    interactions: interactions.length,
    pngs: screenshots.length,
  }),
);
