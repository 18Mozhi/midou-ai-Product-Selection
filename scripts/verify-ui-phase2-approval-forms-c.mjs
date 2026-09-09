import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseSfc } from "@vue/compiler-sfc";
import { parse as parseTemplate } from "@vue/compiler-dom";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07";
const relative = `${base}/design/approval-forms-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
const parentPath = `${base}/design/approval-controls-direction-c/evidence.json`;
const parent = JSON.parse(await read(parentPath));
for (const [f, h] of Object.entries(parent.sourceHashes)) assert.equal(hash(await read(f)), h, f);
const sources = [
  ...Object.keys(parent.sourceHashes),
  parentPath,
  ...["index.html", "fields.js", "fields.css"].map((f) => `${relative}/${f}`),
  "scripts/verify-ui-phase2-approval-forms-c.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sources.map(async (f) => [f, hash(await read(f))])),
);
const fields = [
  ["template-name", "template", "templateForm.name"],
  ["resource-type", "template", "templateForm.resource_type"],
  ["node-name", "template", "templateForm.node_name"],
  ["sla", "template", "templateForm.sla_minutes"],
  ["approver", "template", "templateForm.approver_id"],
  ["escalation", "template", "templateForm.escalation_assignee_id"],
  ["request-template", "request", "requestForm.template_id"],
  ["resource-id", "request", "requestForm.resource_id"],
  ["request-title", "request", "requestForm.title"],
  ["publish-reason", "publish", "publishReason"],
  ["decision-reason", "approve", "reason"],
];
const sourceConstraints = {};
const ast = parseTemplate(
  parseSfc(await read("apps/web/src/components/ApprovalWorkspace.vue")).descriptor.template.content,
);
function walk(node) {
  if (node.type === 1 && ["input", "textarea", "select"].includes(node.tag)) {
    const model = node.props.find((p) => p.type === 7 && p.name === "model")?.exp?.content;
    if (model)
      sourceConstraints[model] = Object.fromEntries(
        node.props.filter((p) => p.type === 6).map((p) => [p.name, p.value?.content ?? ""]),
      );
  }
  for (const child of node.children || []) walk(child);
}
walk(ast);
for (const [, , binding] of fields) assert.ok(sourceConstraints[binding], binding);
const invalidCases = [
  ["name-required", "template-name", ""],
  ["node-required", "node-name", ""],
  ["sla-required", "sla", ""],
  ["sla-low", "sla", "0"],
  ["sla-high", "sla", "43201"],
  ["sla-fraction", "sla", "1.5"],
  ["approver-required", "approver", ""],
  ["escalation-required", "escalation", ""],
  ["template-required", "request-template", ""],
  ["resource-required", "resource-id", ""],
  ["title-required", "request-title", ""],
  ["publish-required", "publish-reason", ""],
  ["name-whitespace", "template-name", "   "],
  ["resource-whitespace", "resource-id", "   "],
  ["publish-whitespace", "publish-reason", "   "],
];
const windows = [
  {
    kind: "approve",
    dialog: "detail-dialog",
    close: "detail-close",
    actionId: "AN-A-CLOSE-FOCUS",
    field: "decision-reason",
    preserve: false,
  },
  {
    kind: "template",
    dialog: "form-dialog",
    close: "form-close",
    actionId: "AN-A-TEMPLATE-CLOSE",
    field: "template-name",
    preserve: true,
  },
  {
    kind: "publish",
    dialog: "publish-dialog",
    close: "publish-close",
    actionId: "AN-A-PUBLISH-CLOSE",
    field: "publish-reason",
    preserve: false,
  },
  {
    kind: "request",
    dialog: "form-dialog",
    close: "form-close",
    actionId: "AN-A-REQUEST-CLOSE",
    field: "request-title",
    preserve: true,
  },
];
const actionVisualReferences = Object.fromEntries(
  windows.map((w) => [
    w.actionId,
    {
      scope: "representative-control-only-not-all-variants-or-Vue",
      pageId: "P25",
      selector: `#${w.close}`,
      states: { focus: `${w.kind}-close-focus` },
    },
  ]),
);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256, shot.file);
}
const screenshots = [],
  observations = [],
  checks = [],
  expected = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 };
    const context = await browser.newContext({
      viewport,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => !!window.APPROVAL_FIELDS_C);
      const facts = await page.evaluate(() => window.APPROVAL_C_DATA);
      const baselineStorage = await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }));
      async function prepare(kind) {
        await page.mouse.move(1, 1);
        await page.evaluate((k) => {
          window.APPROVAL_CONTROL_C.prepare(k);
          window.APPROVAL_FIELDS_C.enhance();
        }, kind);
      }
      async function set(id, value) {
        const target = page.locator(`#${id}`);
        if (await target.evaluate((n) => n.tagName === "SELECT")) await target.selectOption(value);
        else await target.fill(value);
      }
      async function shot(scene, id, label, control) {
        const target = page.locator(`#${id}`);
        await target.scrollIntoViewIfNeeded();
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const data = await target.evaluate((n) => {
          const r = n.getBoundingClientRect(),
            css = getComputedStyle(n),
            hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const heading = n.closest("dialog").querySelector(".form-heading,.detail-header");
          const headingRect = heading.getBoundingClientRect();
          const headingHit = document.elementFromPoint(
            headingRect.x + headingRect.width / 2,
            headingRect.y + headingRect.height / 2,
          );
          const desc = (n.getAttribute("aria-describedby") || "")
            .split(" ")
            .filter(Boolean)
            .map((id) => ({ id, exists: !!document.getElementById(id) }));
          return {
            width: r.width,
            height: r.height,
            font: parseFloat(css.fontSize),
            focus: n.matches(":focus-visible"),
            hit: hit === n || n.contains(hit),
            inViewport:
              r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
            overflow:
              document.documentElement.scrollWidth > innerWidth + 1 ||
              n.closest("dialog").scrollWidth > n.closest("dialog").clientWidth + 1,
            headingVisible:
              headingRect.top >= 0 &&
              headingRect.bottom <= innerHeight &&
              (headingHit === heading || heading.contains(headingHit)),
            invalid: n.getAttribute("aria-invalid"),
            describedBy: desc,
          };
        });
        assert.ok(data.hit && data.inViewport && !data.overflow, `${width}/${scene}: visibility`);
        assert.ok(data.headingVisible, `${width}/${scene}: sticky heading`);
        assert.ok(
          data.width >= 43.9 && data.height >= 43.9 && data.font >= 16,
          `${scene}: target size`,
        );
        if (!control)
          assert.ok(data.describedBy.length >= 2 && data.describedBy.every((x) => x.exists), scene);
        const file = `${width}-${scene}.png`;
        expected.push(file);
        observations.push({ viewportWidth: width, scene, selector: `#${id}`, ...data });
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: false,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            label,
            pageId: "P25",
            viewport,
            fullPage: false,
            ...(control ? { control } : {}),
            sha256: hash(bytes),
          });
        }
      }
      for (const [id, kind, binding] of fields) {
        if (smoke && !["sla", "request-template", "publish-reason"].includes(id)) continue;
        await prepare(kind);
        const node = page.locator(`#${id}`),
          attrs = await node.evaluate((n) =>
            Object.fromEntries(
              ["required", "maxlength", "min", "max", "type", "step"].map((a) => [
                a,
                n.getAttribute(a),
              ]),
            ),
          );
        const source = sourceConstraints[binding];
        for (const a of ["required", "maxlength", "min", "max", "type"])
          assert.equal(attrs[a], source[a] ?? null, `${binding}/${a}`);
        if (id === "sla") assert.equal(attrs.step || "1", source.step || "1");
        const labels = await node.evaluate((n) => [...n.labels].map((l) => l.textContent.trim()));
        assert.ok(labels.some(Boolean));
        assert.ok(
          labels.every((label) => !label.includes("浏览器计数") && !label.includes("不能为空")),
          "help/error must not pollute native label",
        );
        await node.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        assert.equal(await node.evaluate((n) => n.matches(":focus-visible")), true);
        await shot(`${id}-focus`, id, `${binding} · 键盘焦点与说明`);
        assert.equal(await page.evaluate(() => window.APPROVAL_C.state().intents.length), 0);
      }
      await prepare("template");
      for (const id of ["template-name", "node-name", "sla", "approver", "escalation"])
        await set(id, "");
      await page.locator("#form-submit").click();
      assert.equal(await page.locator('#form-dialog [aria-invalid="true"]').count(), 5);
      assert.equal(await page.evaluate(() => document.activeElement.id), "template-name");
      assert.ok((await page.locator("#form-dialog .field-summary").textContent()).includes("5"));
      assert.equal(await page.evaluate(() => window.APPROVAL_C.state().intents.length), 0);
      for (const [name, id, value] of invalidCases) {
        if (smoke && !["sla-fraction", "template-required", "publish-whitespace"].includes(name))
          continue;
        const kind = fields.find((f) => f[0] === id)[1];
        await prepare(kind);
        await set(id, value);
        await page.locator(kind === "publish" ? "#publish-confirm" : "#form-submit").click();
        assert.equal(await page.evaluate(() => window.APPROVAL_C.state().intents.length), 0, name);
        assert.equal(await page.locator(`#${id}`).getAttribute("aria-invalid"), "true", name);
        assert.equal(
          await page.locator(`#${id}`).evaluate((n) => n === document.activeElement),
          true,
          name,
        );
        assert.equal(await page.locator(`#${id}-error`).isVisible(), true);
        assert.ok(await page.locator(`#${id}-error`).textContent());
        await shot(name, id, `${name} · 原生校验与就近提示`);
      }
      for (const [id, kind, binding] of fields.filter((f) => sourceConstraints[f[2]].maxlength)) {
        if (smoke && id !== "publish-reason") continue;
        await prepare(kind);
        const max = Number(sourceConstraints[binding].maxlength),
          node = page.locator(`#${id}`);
        await node.fill("核".repeat(max));
        await page.keyboard.press("End");
        await page.keyboard.type("X");
        assert.equal((await node.inputValue()).length, max);
        assert.ok((await page.locator(`#${id}-help`).textContent()).includes(`${max} / ${max}`));
        await shot(`${id}-limit`, id, `${binding} · ${max}字符边界`);
        assert.equal(await page.evaluate(() => window.APPROVAL_C.state().intents.length), 0);
      }
      if (!smoke)
        for (const value of ["1", "43200"]) {
          await prepare("template");
          await set("sla", value);
          assert.equal(await page.locator("#sla").evaluate((n) => n.validity.valid), true);
          await shot(`sla-boundary-${value}`, "sla", `SLA合法边界 · ${value}分钟`);
        }
      for (const [kind, id] of [
        ["template", "template-name"],
        ["request", "resource-id"],
        ["publish", "publish-reason"],
      ]) {
        if (smoke && kind !== "publish") continue;
        await prepare(kind);
        const original = await page.locator(`#${id}`).inputValue(),
          submit = kind === "publish" ? "#publish-confirm" : "#form-submit";
        await set(id, kind === "publish" ? "   " : "");
        await page.locator(submit).click();
        await set(id, original);
        assert.equal(await page.locator(`#${id}`).getAttribute("aria-invalid"), "false");
        assert.equal(await page.locator(`#${id}-error`).isVisible(), false);
        await page.locator(submit).click();
        assert.deepEqual(
          await page.evaluate(() => window.APPROVAL_CONTROL_C.state().pending.request),
          facts.contracts[kind],
        );
        await page.locator("dialog[open] .review-failure").click();
        assert.equal(await page.locator(`#${id}`).inputValue(), original);
        await shot(`${kind}-corrected-failure`, id, `${kind} · 校正后离线失败仍保留输入`);
      }
      for (const w of windows) {
        await prepare(w.kind);
        const close = page.locator(`#${w.close}`);
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.evaluate(
            (dialog) => document.activeElement.closest("dialog")?.id === dialog,
            w.dialog,
          ),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await close.evaluate((n) => n === document.activeElement && n.matches(":focus-visible")),
          true,
        );
        await shot(`${w.kind}-close-focus`, w.close, `${w.kind} · 首尾Tab循环`, {
          actionId: w.actionId,
          selector: `#${w.close}`,
          state: "focus",
        });
        // Test each close path while idle. These do not claim pending-result ownership or source-Vue parity.
        for (const method of [
          "button",
          "escape",
          "backdrop",
          ...(w.kind === "approve" ? [] : ["cancel"]),
        ]) {
          await prepare(w.kind);
          await set(w.field, "草稿保留核对");
          const core = await page.evaluate(() => window.APPROVAL_C.state());
          const trigger =
            w.kind === "publish"
              ? `publish-${core.publishTarget.id}`
              : w.kind === "approve"
                ? `open-${core.currentDetail.id}`
                : w.kind === "template"
                  ? "manage"
                  : "new-request";
          if (method === "button") await page.locator(`#${w.close}`).click();
          if (method === "escape") await page.keyboard.press("Escape");
          if (method === "cancel")
            await page.locator(w.kind === "publish" ? "#publish-cancel" : "#form-cancel").click();
          if (method === "backdrop") await page.mouse.click(1, 1);
          assert.equal(
            await page.locator(`#${w.dialog}`).evaluate((n) => n.open),
            false,
            `${w.kind}/${method}`,
          );
          assert.equal(
            await page.evaluate(() => document.activeElement.id),
            trigger,
            `${w.kind}/${method}: return focus`,
          );
          assert.equal(await page.evaluate(() => window.APPROVAL_C.state().intents.length), 0);
          if (w.kind === "publish")
            assert.equal(await page.locator("#form-dialog").evaluate((n) => n.open), true);
          if (w.kind === "approve")
            assert.equal(new URL(page.url()).searchParams.has("approval"), false);
          await page.locator(`#${trigger}`).click();
          await page.evaluate(() => window.APPROVAL_FIELDS_C.enhance());
          assert.equal(
            await page.locator(`#${w.field}`).inputValue(),
            w.preserve ? "草稿保留核对" : "",
          );
          checks.push({
            viewportWidth: width,
            kind: w.kind,
            method,
            focusReturned: true,
            draftRule: w.preserve ? "preserved" : "cleared",
            intents: 0,
          });
          if (method === "escape")
            await shot(`${w.kind}-reopened`, w.field, `${w.kind} · Escape关闭再打开`);
        }
      }
      assert.deepEqual(await page.evaluate(() => window.APPROVAL_C_DATA), facts);
      assert.deepEqual(
        await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
        baselineStorage,
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `approval_forms ${width}: source attributes, native validation/focus, limits, corrections, idle close/drafts; HTTP/storage/errors=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (!smoke) assert.equal(expected.length, 88);
if (capture) {
  const evidence = {
    version: "APPROVAL-FORMS-C-r1",
    approval: "pending",
    kind: "field-and-idle-dialog-proposal-not-Vue",
    sourceHashes,
    sourceConstraints,
    actionVisualReferences,
    observations,
    checks,
    screenshots,
    boundary:
      "11 field focus cases,15 native/custom-existing-prototype invalid cases,5 maxlength and2 SLA limits,3 corrected failures,4 close-focus and4 reopened scenes at1440/390. 88 PNG. Four modal idle close paths tested; backdrop on non-detail and publication reason cleanup follow OLD PROPOSAL, not production parity. Native required/max/min unchanged, whitespace blocking already in old prototype; no claim source Vue blocks all whitespace before HTTP. Pending close/reopen, all roles/themes/mobile IME/real services unverified.",
  };
  await writeFile(path.join(root, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  const esc = (v) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  await writeFile(
    path.join(root, "gallery.html"),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P25 表单与弹窗审核</title><style>body{font:16px "Microsoft YaHei",sans-serif;margin:24px;background:#edf1f6;color:#202c3d}summary{min-height:44px;padding:12px;cursor:pointer}img{max-width:100%;height:auto}section{margin-top:32px;border-top:2px solid #254a9c}a{color:#254a9c}</style><h1>P25 表单与弹窗 · 待审核</h1><p>11字段的说明、校验、边界与四类弹窗关闭。离线演示不等于真实审批成功或Vue已上线。</p><a href="index.html">打开交互稿</a> · <a href="README.md">范围与来源差异</a>${[
      1440, 390,
    ]
      .map(
        (width) =>
          `<section><h2>${width}宽度</h2>${screenshots
            .filter((s) => s.viewport.width === width)
            .map(
              (s) =>
                `<details><summary>${esc(s.label)}</summary><img loading="lazy" src="${s.file}" alt="${esc(s.label)} ${width}"></details>`,
            )
            .join("")}</section>`,
      )
      .join("")}</html>\n`,
  );
} else if (!smoke) {
  assert.deepEqual(previous.observations, observations);
  assert.deepEqual(previous.checks, checks);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(previous.sourceConstraints, sourceConstraints);
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
}
if (!smoke)
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    [...expected].sort(),
  );
console.log(
  JSON.stringify({
    passed: true,
    capture,
    smoke,
    observations: observations.length,
    closeChecks: checks.length,
  }),
);
