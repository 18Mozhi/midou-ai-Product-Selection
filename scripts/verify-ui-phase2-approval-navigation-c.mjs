import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { approvalNavigationCases as cases } from "./lib/ui-phase2-approval-navigation-cases.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07",
  relative = `${base}/design/approval-navigation-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke));
assert.equal(cases.length, 41);
assert.equal(new Set(cases.map((c) => c.key)).size, cases.length);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
const parentPath = `${base}/design/approval-forms-direction-c/evidence.json`,
  parent = JSON.parse(await read(parentPath));
for (const [f, h] of Object.entries(parent.sourceHashes)) assert.equal(hash(await read(f)), h, f);
const files = [
  ...Object.keys(parent.sourceHashes),
  parentPath,
  `${relative}/index.html`,
  `${relative}/navigation.css`,
  `${relative}/navigation.js`,
  "scripts/verify-ui-phase2-approval-navigation-c.mjs",
  "scripts/lib/ui-phase2-approval-navigation-cases.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(files.map(async (f) => [f, hash(await read(f))])),
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
  observations = [],
  effects = [],
  actionVisualReferences = {},
  controlVariantReferences = {};
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
      await page.waitForFunction(() => !!window.APPROVAL_FIELDS_C);
      const facts = await page.evaluate(() => window.APPROVAL_C_DATA);
      const selector = (c) =>
        c.selector === "$row"
          ? `#open-${facts.list.data[0].id}`
          : c.selector === "$publish"
            ? `#publish-${facts.templates.find((t) => t.status === "draft").id}`
            : c.selector;
      const core = () => page.evaluate(() => window.APPROVAL_C.state());
      const state = () =>
        page.evaluate(() => ({
          core: window.APPROVAL_C.state(),
          dialogs: [...document.querySelectorAll("dialog[open]")].map((n) => n.id),
          disclosures: [...document.querySelectorAll("dialog[open] details")].map((n) => ({
            id: n.id,
            open: n.open,
          })),
          url: location.search,
        }));
      async function prepare(c) {
        await page.mouse.move(1, 1);
        await page.evaluate(({ scene, before }) => {
          const url = new URL(location.href);
          url.search = "";
          history.replaceState(null, "", url);
          window.APPROVAL_C.scene(scene);
          if (before === "return") {
            url.searchParams.set("from", "/notifications?unread=1");
            history.replaceState(null, "", url);
            window.APPROVAL_C.scene("normal", true);
            window.APPROVAL_C.openDetail(window.APPROVAL_C_DATA.list.data[0].id);
          }
          window.APPROVAL_FIELDS_C.enhance();
          window.APPROVAL_NAVIGATION_C.sync();
        }, c);
        if (c.before === "page2") await page.locator("#next").click();
        await page.evaluate(() => document.activeElement?.blur());
      }
      async function measure(target) {
        await target.scrollIntoViewIfNeeded();
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        return target.evaluate((n) => {
          const b = n.getBoundingClientRect(),
            css = getComputedStyle(n),
            hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
            dialog = n.closest("dialog");
          return {
            label: n.textContent.trim(),
            width: b.width,
            height: b.height,
            font: parseFloat(css.fontSize),
            hover: n.matches(":hover"),
            focus: n.matches(":focus-visible"),
            pressed: n.matches(":active"),
            disabled: !!n.disabled,
            selected: n.getAttribute("aria-pressed") || n.getAttribute("aria-current"),
            hit: hit === n || n.contains(hit),
            visible:
              b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1,
            overflow:
              document.documentElement.scrollWidth > innerWidth + 1 ||
              (dialog && dialog.scrollWidth > dialog.clientWidth + 1),
            background: css.backgroundColor,
            color: css.color,
          };
        });
      }
      async function save(c, mode, target) {
        const info = await measure(target),
          scene = `${c.key}-${mode}`,
          file = `${width}-${scene}.png`;
        assert.ok(info.hit && info.visible && !info.overflow, `${width}/${scene}:visibility`);
        assert.ok(info.width >= 43.9 && info.height >= 43.9 && info.font >= 16, `${scene}:size`);
        if (mode === "default")
          assert.equal(info.hover || info.focus || info.pressed, false, scene);
        if (["hover", "focus", "pressed"].includes(mode)) assert.equal(info[mode], true, scene);
        assert.equal(info.disabled, mode === "disabled", scene);
        if (mode === "selected") assert.equal(info.selected, "true", scene);
        observations.push({ viewportWidth: width, scene, selector: selector(c), ...info });
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
            control: { key: c.key, actionId: c.actionId, selector: selector(c), state: mode },
            sha256: hash(bytes),
          });
        }
      }
      async function verifyClick(c) {
        await prepare(c);
        const target = page.locator(selector(c)),
          before = await core(),
          href = await target.getAttribute("href");
        await target.click();
        const after = await core();
        assert.equal(after.intents.length, 0, c.key);
        if (c.effect === "form") assert.equal(after.formKind, c.value);
        if (c.effect === "queue") {
          assert.equal(after.queue, c.value);
          assert.equal(after.page, 1);
          assert.equal(after.currentDetail, null);
        }
        if (c.effect === "filter") {
          assert.equal(after.status, c.value);
          assert.equal(after.page, 1);
          assert.equal(after.currentDetail, null);
          assert.equal(
            new URL(page.url()).searchParams.get("status"),
            c.value === "pending" ? null : c.value,
          );
        }
        if (c.effect === "page") assert.equal(after.page, c.value);
        if (c.effect === "reload") {
          assert.equal(after.read, before.read);
          assert.ok(after.message.includes("未请求API"));
        }
        if (c.effect === "dismiss") {
          assert.equal(after.detailState, "");
          assert.equal(await page.locator("#dismiss-detail").count(), 0);
        }
        if (c.effect === "detail") {
          assert.equal(after.currentDetail.id, facts.list.data[0].id);
          assert.equal(new URL(page.url()).searchParams.get("approval"), facts.list.data[0].id);
        }
        if (c.effect === "link") {
          const route =
            c.value === "resource"
              ? facts.detail.decision_context.resource.route
              : c.value === "return"
                ? "/notifications?unread=1"
                : facts.detail.decision_context.evidence.requirements[c.value].route;
          assert.equal(href, route);
          assert.ok(after.message.includes(route));
          assert.equal(after.currentDetail, null);
        }
        if (c.effect === "disclosure") {
          assert.equal(await page.locator("#technical").evaluate((n) => n.open), true);
          assert.deepEqual(after, before);
        }
        if (c.effect === "publish")
          assert.equal(
            after.publishTarget.id,
            facts.templates.find((t) => t.status === "draft").id,
          );
        if (c.effect === "close") {
          assert.equal(await page.locator(`#${c.value}`).evaluate((n) => n.open), false);
          if (c.value === "publish-dialog")
            assert.equal(await page.locator("#form-dialog").evaluate((n) => n.open), true);
        }
        if (c.effect === "section") {
          assert.equal(await page.locator(selector(c)).getAttribute("aria-current"), "true");
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const targetVisible = await page.evaluate((section) => {
            const target = document.getElementById(`section-${section}`).getBoundingClientRect();
            const header = document.querySelector(".detail-header").getBoundingClientRect();
            const index = document.querySelector(".detail-index").getBoundingClientRect();
            const top = innerWidth <= 780 ? Math.max(header.bottom, index.bottom) : header.bottom;
            return target.top >= top - 1 && target.top < innerHeight - 20;
          }, c.value);
          assert.ok(targetVisible, `${width}/${c.key}: chapter hidden under sticky layers`);
        }
        if (["queue", "filter", "section"].includes(c.effect))
          await save(c, "selected", page.locator(selector(c)));
        effects.push({
          viewportWidth: width,
          key: c.key,
          effect: c.effect,
          verified: true,
          intents: after.intents.length,
        });
      }
      for (const c of cases) {
        if (
          smoke &&
          ![
            "row",
            "page-next",
            "page-previous",
            "technical",
            "evidence-0",
            "publish-cancel",
            "reading-decision",
            "reading-compare",
            "filter-all",
          ].includes(c.key)
        )
          continue;
        const states = Object.fromEntries(
          ["default", "hover", "focus", "pressed"].map((s) => [s, `${c.key}-${s}`]),
        );
        controlVariantReferences[c.key] = {
          scope: "additional-control-variant-not-new-action",
          pageId: "P25",
          actionId: c.actionId,
          selector: selector(c),
          states,
        };
        if (c.actionId && !actionVisualReferences[c.actionId])
          actionVisualReferences[c.actionId] = {
            scope: "representative-control-only-not-all-variants-or-Vue",
            pageId: "P25",
            selector: selector(c),
            states,
          };
        for (const mode of smoke
          ? ["focus", "pressed"]
          : ["default", "hover", "focus", "pressed"]) {
          await prepare(c);
          const target = page.locator(selector(c));
          assert.equal(await target.count(), 1, c.key);
          await target.scrollIntoViewIfNeeded();
          const before = await state();
          let down = false;
          try {
            if (mode === "hover") await target.hover();
            if (mode === "focus") {
              await target.focus();
              await page.keyboard.press("Shift+Tab");
              await page.keyboard.press("Tab");
            }
            if (mode === "pressed") {
              await target.hover();
              await page.mouse.down();
              down = true;
            }
            await save(c, mode, target);
          } finally {
            if (down) {
              const box = await target.evaluate(
                (n) => n.closest("dialog")?.getBoundingClientRect().toJSON() || null,
              );
              await page.mouse.move(box ? box.x + 8 : 1, box ? box.y + 8 : 1);
              await page.mouse.up();
            }
          }
          assert.deepEqual(await state(), before, `${c.key}/${mode}:appearance caused action`);
        }
        await verifyClick(c);
      }
      for (const key of ["page-next", "page-previous"]) {
        const c = cases.find((c) => c.key === key);
        await prepare({ ...c, before: key === "page-next" ? "page2" : undefined });
        const target = page.locator(selector(c)),
          before = await state();
        await save(c, "disabled", target);
        const box = await target.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        assert.deepEqual(await state(), before);
        controlVariantReferences[c.key].states.disabled = `${key}-disabled`;
        if (key === "page-next")
          actionVisualReferences[c.actionId].states.disabled = `${key}-disabled`;
      }
      await page.evaluate(() => window.APPROVAL_C.scene("readonly"));
      assert.equal(await page.locator("#manage,#new-request,#empty-action").count(), 0);
      await page.evaluate(() => window.APPROVAL_C.scene("no_templates"));
      assert.equal(await page.locator("#new-request").count(), 0);
      assert.deepEqual(await page.evaluate(() => window.APPROVAL_C_DATA), facts);
      assert.deepEqual(
        await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
        { local: {}, session: {} },
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `approval_navigation ${width}: native control states, exact local results, source-derived links, page bounds; HTTP/storage/errors=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (!smoke) assert.equal(expected.length, 354);
if (capture) {
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "APPROVAL-NAVIGATION-C-r1",
        approval: "pending",
        kind: "control-variants-and-offline-effects-not-Vue",
        sourceHashes,
        actionVisualReferences,
        controlVariantReferences,
        observations,
        effects,
        screenshots,
        boundary:
          "41 variants x4 native states x2 widths=328PNG;11 logical selected cases x2=22PNG;2 page-disabled x2=4PNG,total354.17 source semantic groups;5 reading-index controls are proposal-only,not new source actions. No fake disabled/busy where not evidenced. Local reload/route/synthetic21-row paging is not server navigation,full Vue or approval. Source All filter empty-query bug and pending ownership remain unchanged.",
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P25 入口导航按钮审核</title>',
      '<style>body{font:16px "Microsoft YaHei",sans-serif;margin:24px;background:#edf1f6;color:#202c3d}summary{padding:12px;min-height:44px;cursor:pointer}img{max-width:100%;height:auto}section{margin-top:32px;border-top:2px solid #254a9c}a{color:#254a9c}</style>',
      '<h1>P25 入口、导航与关闭按钮 · 待审核</h1><p>实际控件原生状态。selected是逻辑选中，不等于鼠标按下。离线行为检查不代表真实Vue或服务已验收。</p><a href="index.html">交互稿</a> · <a href="README.md">范围与差异</a>',
      ...cases.map(
        (c) =>
          `<section><h2>${c.key} · ${c.actionId || "新增阅读目录提案"}</h2>${screenshots
            .filter((s) => s.scene.startsWith(`${c.key}-`))
            .map(
              (s) =>
                `<details><summary>${s.scene} · ${s.viewport.width}</summary><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.viewport.width}"></details>`,
            )
            .join("")}</section>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke) {
  assert.deepEqual(previous.observations, observations);
  assert.deepEqual(previous.effects, effects);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(previous.controlVariantReferences, controlVariantReferences);
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
    clickChecks: effects.length,
  }),
);
