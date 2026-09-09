import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07",
  relative = `${base}/design/approval-lifecycle-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
const parentFile = `${base}/design/approval-navigation-direction-c/evidence.json`,
  parent = JSON.parse(await read(parentFile));
for (const [f, h] of Object.entries(parent.sourceHashes)) assert.equal(hash(await read(f)), h, f);
const files = [
  ...Object.keys(parent.sourceHashes),
  parentFile,
  `${base}/design/approval-navigation-direction-c/navigation.js`,
  `${base}/design/approval-navigation-direction-c/navigation.css`,
  ...["index.html", "lifecycle.js", "lifecycle.css"].map((f) => `${relative}/${f}`),
  "scripts/verify-ui-phase2-approval-lifecycle-c.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all([...new Set(files)].map(async (f) => [f, hash(await read(f))])),
);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256, s.file);
}
const screenshots = [],
  expected = [],
  checks = [];
const actionVisualReferences = Object.fromEntries(
  ["template", "request", "publish"].map((id) => [
    `AN-A-${id.toUpperCase()}-SUBMIT`,
    {
      scope: "representative-control-only-not-all-variants-or-Vue",
      pageId: "P25",
      selector: id === "publish" ? "#publish-confirm" : "#form-submit",
      states: { disabled: `${id}-pending` },
    },
  ]),
);
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
        requests = [],
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => !!window.APPROVAL_LIFECYCLE_C);
      const facts = await page.evaluate(() => window.APPROVAL_C_DATA);
      const controls = await page.evaluate(() => window.APPROVAL_LIFECYCLE_C.controls);
      const core = () => page.evaluate(() => window.APPROVAL_C.state());
      const state = () => page.evaluate(() => window.APPROVAL_LIFECYCLE_C.state());
      const field = (c) =>
        ({
          detail: "#decision-reason",
          template: "#template-name",
          request: "#request-title",
          publish: "#publish-reason",
        })[c.kind];
      const dialog = (c) =>
        c.kind === "detail"
          ? "#detail-dialog"
          : c.kind === "publish"
            ? "#publish-dialog"
            : "#form-dialog";
      async function prepare(c, pagination = false) {
        await page.evaluate(
          ({ id, pagination }) => window.APPROVAL_LIFECYCLE_C.prepare(id, pagination),
          { id: c.id, pagination },
        );
        await page.evaluate(() => window.APPROVAL_LIFECYCLE_C.sync());
      }
      async function submit(c, pagination = false) {
        await prepare(c, pagination);
        const before = await core();
        await page.locator(c.selector).click();
        const op = (await state()).pending;
        assert.ok(op && op.ownerStillOpen, c.id);
        const contract = structuredClone(facts.contracts[c.id]);
        if (pagination) contract.url = `/tasks/approvals/${before.currentDetail.id}/actions`;
        assert.deepEqual(op.request, contract);
        assert.equal((await core()).intents.length, 1);
        assert.equal(await page.locator(c.selector).isDisabled(), true);
        assert.equal(await page.locator(field(c)).evaluate((n) => n.readOnly), true);
        // Programmatic submit/click bypasses native disabled but must not append another intent.
        await page
          .locator(c.selector)
          .evaluate((n) => n.dispatchEvent(new MouseEvent("click", { bubbles: true })));
        if (c.kind !== "detail")
          await page
            .locator(`${dialog(c)} form`)
            .evaluate((n) =>
              n.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
            );
        assert.equal((await core()).intents.length, 1);
        return op;
      }
      async function settle(op, outcome, pointer = false) {
        if (pointer) {
          await page
            .locator(
              `dialog[open] .response-tools[data-token='${op.token}'] [data-result='${outcome}']`,
            )
            .last()
            .click();
        } else
          assert.equal(
            await page.evaluate(
              ({ token, outcome }) => window.APPROVAL_LIFECYCLE_C.settle(token, outcome),
              { token: op.token, outcome },
            ),
            true,
          );
        assert.equal((await state()).pending, null);
        assert.deepEqual((await state()).lastResult.request, op.request);
        assert.equal(
          await page.evaluate(
            ({ token, outcome }) => window.APPROVAL_LIFECYCLE_C.settle(token, outcome),
            { token: op.token, outcome },
          ),
          false,
        );
      }
      async function shot(scene, selector) {
        if (smoke) return;
        const target = page.locator(selector);
        await target.scrollIntoViewIfNeeded();
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const info = await target.evaluate((node) => {
          const b = node.getBoundingClientRect(),
            hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          const modal = node.closest("dialog");
          return {
            width: b.width,
            height: b.height,
            font: parseFloat(getComputedStyle(node).fontSize),
            hit: hit === node || node.contains(hit),
            visible:
              b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1,
            overflow:
              document.documentElement.scrollWidth > innerWidth + 1 ||
              (modal && modal.scrollWidth > modal.clientWidth + 1),
          };
        });
        assert.ok(info.hit && info.visible && !info.overflow, `${width}/${scene}:geometry`);
        if (scene.endsWith("-pending") && !scene.includes("closed") && !scene.includes("reopened"))
          assert.ok(info.width >= 44 && info.height >= 44 && info.font >= 16);
        const file = `${width}-${scene}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: false,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            pageId: "P25",
            viewport,
            fullPage: false,
            selector,
            sha256: hash(bytes),
          });
        }
      }
      async function close(c, method) {
        const before = await core();
        const trigger =
          c.kind === "detail"
            ? `open-${before.currentDetail.id}`
            : c.kind === "publish"
              ? `publish-${before.publishTarget.id}`
              : c.kind === "template"
                ? "manage"
                : "new-request";
        if (method === "button") await page.locator(c.close).click();
        if (method === "escape") await page.keyboard.press("Escape");
        if (method === "backdrop") await page.mouse.click(1, 1);
        if (method === "cancel")
          await page.locator(c.kind === "publish" ? "#publish-cancel" : "#form-cancel").click();
        assert.equal(
          await page.locator(dialog(c)).evaluate((n) => n.open),
          false,
          `${c.id}/${method}`,
        );
        assert.equal(
          await page.evaluate(() => document.activeElement.id),
          trigger,
          `${c.id}/${method}:focus`,
        );
        if (c.kind === "publish")
          assert.equal(await page.locator("#form-dialog").evaluate((n) => n.open), true);
        return trigger;
      }
      for (const c of controls) {
        let op = await submit(c);
        await shot(`${c.id}-pending`, c.selector);
        const value = await page.locator(field(c)).inputValue();
        await settle(op, "failure", true);
        assert.equal(await page.locator(dialog(c)).evaluate((n) => n.open), true);
        assert.equal(await page.locator(field(c)).inputValue(), value);
        assert.equal(await page.locator(field(c)).evaluate((n) => n.readOnly), false);
        await shot(`${c.id}-owner-failure`, c.message);
        await page.locator(c.selector).click();
        assert.equal((await core()).intents.length, 2);
        assert.deepEqual((await state()).pending.request, op.request);
        const retryToken = (await state()).pending.token;
        assert.equal(
          await page.evaluate(
            (token) => window.APPROVAL_LIFECYCLE_C.settle(token, "success"),
            op.token,
          ),
          false,
        );
        assert.equal(
          (await state()).pending.token,
          retryToken,
          "duplicate old result affected retry",
        );
        await settle((await state()).pending, "failure");
        checks.push({ width, id: c.id, case: "owner-failure-retry", passed: true });
        op = await submit(c);
        await settle(op, "success");
        assert.equal(await page.locator(dialog(c)).evaluate((n) => n.open), false);
        // A simulated success closes only its owner; it does not update rows/templates/history.
        assert.deepEqual((await core()).rows, facts.list.data);
        assert.deepEqual((await core()).templates, facts.templates);
        await shot(
          `${c.id}-owner-success`,
          c.kind === "publish" ? "#form-title" : "#operation-ledger strong",
        );
        checks.push({ width, id: c.id, case: "owner-success-only", passed: true });
        const methods = smoke
          ? ["escape"]
          : ["button", "escape", "backdrop", ...(c.kind === "detail" ? [] : ["cancel"])];
        for (const method of methods)
          for (const outcome of ["success", "failure"]) {
            op = await submit(c);
            await close(c, method);
            assert.equal((await state()).pending.token, op.token);
            assert.equal((await state()).pending.ownerStillOpen, false);
            if (method === "escape" && outcome === "failure")
              await shot(
                `${c.id}-closed-pending`,
                c.kind === "publish" ? "#form-title" : "#operation-ledger strong",
              );
            const before = await core(),
              focused = await page.evaluate(() => document.activeElement.id);
            await settle(op, outcome);
            const after = await core();
            assert.deepEqual(after.intents, before.intents);
            assert.equal(after.currentDetail, null);
            assert.equal(await page.locator(dialog(c)).evaluate((n) => n.open), false);
            assert.equal(await page.evaluate(() => document.activeElement.id), focused);
            checks.push({ width, id: c.id, case: `closed-${method}-${outcome}`, passed: true });
          }
        op = await submit(c);
        const trigger = await close(c, "escape");
        await page.locator(`#${trigger}`).click();
        await page.locator(field(c)).fill("后来打开窗口中的草稿");
        assert.match(
          await page.locator(`${dialog(c)} .other-operation`).textContent(),
          /当前草稿可以编辑/u,
        );
        assert.equal(
          await page.locator(c.selector).isDisabled(),
          true,
          "global pending write guard",
        );
        await shot(`${c.id}-reopened-pending`, field(c));
        const before = await core();
        await settle(op, "success");
        assert.equal(
          await page.locator(dialog(c)).evaluate((n) => n.open),
          true,
          "old success closed reopened window",
        );
        assert.equal(await page.locator(field(c)).inputValue(), "后来打开窗口中的草稿");
        assert.equal(await page.locator(`${dialog(c)} .other-operation`).count(), 0);
        assert.deepEqual((await core()).intents, before.intents);
        checks.push({ width, id: c.id, case: "reopened-generation-preserved", passed: true });
      }
      const c = controls[0];
      for (const outcome of ["success", "failure"]) {
        const op = await submit(c, true),
          a = (await core()).currentDetail.id;
        await close(c, "escape");
        const b = (await core()).rows[1].id;
        await page.locator(`#open-${b}`).click();
        await page.locator("#decision-reason").fill("只属于后来打开的审批B");
        const before = await core(),
          focused = await page.evaluate(() => document.activeElement.id);
        const messageBefore = await page.locator("#decision-message").textContent();
        await settle(op, outcome);
        const after = await core();
        assert.notEqual(a, b);
        assert.equal(after.currentDetail.id, b);
        assert.equal(new URL(page.url()).searchParams.get("approval"), b);
        assert.equal(after.reasons.decision, before.reasons.decision);
        assert.equal(
          await page.locator("#decision-message").textContent(),
          messageBefore,
          "old result leaked into new dialog message",
        );
        assert.equal(await page.evaluate(() => document.activeElement.id), focused);
        assert.equal(await page.locator("#detail-dialog").evaluate((n) => n.open), true);
        assert.equal(after.intents.length, 1);
        assert.match(after.intents[0].url, new RegExp(a));
        assert.equal(after.rows[0].status, "pending");
        await shot(`old-A-${outcome}-current-B`, "#decision-reason");
        checks.push({ width, id: c.id, case: `old-A-${outcome}-current-B`, passed: true });
      }
      assert.deepEqual(await page.evaluate(() => window.APPROVAL_C_DATA), facts);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (!smoke) assert.equal(expected.length, 54);
if (capture) {
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "APPROVAL-LIFECYCLE-C-r1",
        approval: "pending",
        kind: "pending-dialog-ownership-proposal-not-Vue",
        sourceHashes,
        actionVisualReferences,
        screenshots,
        checks,
        boundary:
          "Five exact source-aligned request previews; globally guard writes while pending,close never cancels. Success closes original owner only,failure preserves original input;closed/reopened/other dialog ignores old result. Simulated response tools are not business functions;no HTTP/facts/storage mutation. A/B use existing synthetic pagination rows,not real approval records. Source Vue races and old non-detail backdrop/publish close differences remain unfixed.",
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P25 提交中弹窗交互审核</title>',
      '<style>body{font:16px "Microsoft YaHei",sans-serif;margin:24px;background:#edf3fd;color:#243650}summary{padding:16px;cursor:pointer}img{max-width:100%;height:auto}a{color:#254a9c}</style>',
      '<h1>P25 提交中关闭与迟到结果 · 待审核</h1><p>54张双端图：五类操作等待、原窗失败/模拟成功、关闭后等待、重开等待，及旧A结果返回时的新B。模拟响应不代表真实审批成功。</p><a href="index.html">交互稿</a> · <a href="README.md">范围与差异</a>',
      ...screenshots.map(
        (s) =>
          `<details><summary>${s.scene} · ${s.viewport.width}</summary><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.viewport.width}"></details>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke) {
  assert.deepEqual(previous.checks, checks);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
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
    smoke,
    capture,
    checks: checks.length,
    screenshots: expected.length,
    productionUnchanged: true,
  }),
);
