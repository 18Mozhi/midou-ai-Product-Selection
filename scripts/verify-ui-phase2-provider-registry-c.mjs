import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildProviderRegistryDesignData } from "./lib/ui-phase2-provider-registry-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/provider-registry-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const { data, sourceLogic } = await buildProviderRegistryDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.PROVIDER_C_DATA)), data);
const logicPath = path.join(root, "source-logic.js"),
  config = await resolveConfig(logicPath);
assert.equal(
  (await readFile(logicPath, "utf8")).replaceAll("\r\n", "\n"),
  (await format(sourceLogic, { ...config, filepath: logicPath })).replaceAll("\r\n", "\n"),
);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-provider-registry-design-data.mjs",
  "scripts/verify-ui-phase2-provider-registry-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/platform-organizations-direction-c/organizations.css",
  ...["index.html", "registry.css", "registry.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let prior;
if (!capture) {
  prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(prior.sourceHashes, sourceHashes);
  for (const s of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  requests = [];
async function layout(page, name) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    name + " page overflow",
  );
  assert.equal(
    await page
      .locator("dialog[open]")
      .evaluateAll((ns) => ns.every((n) => n.scrollWidth <= n.clientWidth + 1)),
    true,
    name + " dialog overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  await checkPrototypeMetrics(page);
}
async function shot(page, width, scene, suffix = "") {
  const file = `${width}-${scene}${suffix}.png`;
  expected.push(file);
  if (capture) {
    const bytes = await page.screenshot({
      path: path.join(root, file),
      fullPage: !(await page.locator("dialog[open]").count()),
      animations: "disabled",
    });
    screenshots.push({
      file,
      width,
      scene,
      pageId: "P46",
      proposal: "PROVIDER-REGISTRY-C-r1",
      sha256: hash(bytes),
    });
  }
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      await context.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      const url = pathToFileURL(path.join(root, "index.html")).href;
      await page.goto(url);
      const scene = (key) =>
        page.evaluate((key) => {
          window.PROVIDER_C.scene(key);
          document.querySelectorAll("dialog").forEach((n) => {
            n.scrollTop = 0;
          });
          window.scrollTo(0, 0);
        }, key);
      const state = () => page.evaluate(() => window.PROVIDER_C.state());
      const allScenes = await page.evaluate(() => Object.keys(window.PROVIDER_C.scenes));
      for (const key of allScenes) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#create").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, key);
        if (["admission-disabled", "admission-pending"].includes(key))
          assert.match(await page.locator("#data-note").textContent(), /不是完整25条目录/);
        if ((await state()).counts.all === 0)
          assert.match(await page.locator("#data-note").textContent(), /没有原始25条成功快照/);
        await shot(page, width, key);
        const dialog = page.locator("dialog[open]");
        if (await dialog.count()) {
          const { max, step } = await dialog.evaluate((n) => ({
            max: n.scrollHeight - n.clientHeight,
            step: Math.floor(n.clientHeight * 0.8),
          }));
          let part = 1;
          for (let top = Math.min(step, max); top > 1; top = Math.min(top + step, max)) {
            await dialog.evaluate((n, top) => {
              n.scrollTop = top;
            }, top);
            await shot(page, width, key, top >= max ? "--bottom" : `--part-${part++}`);
            if (top >= max) break;
          }
        }
        if (key === "pressed") await page.mouse.up();
      }
      await scene("default");
      assert.deepEqual((await state()).counts, { all: 25, enabled: 1, blocked: 1, inactive: 24 });
      for (const c of data.listCases) {
        await page.locator("#sort").selectOption(c.order);
        assert.deepEqual((await state()).filteredIds, c.ids);
      }
      assert.equal((await state()).visibleIds.length, 20);
      await page.locator("#next-page").click();
      assert.equal((await state()).visibleIds.length, 5);
      assert.equal(await page.locator("#next-page").isDisabled(), true);
      await page.locator("#search").fill("PUBLIC_SIGNAL");
      assert.equal((await state()).controls.page, 1);
      assert.deepEqual((await state()).filteredIds, [data.definition.id]);
      await page.locator("#search").fill("example.test");
      assert.equal((await state()).filteredIds.length, 0);
      await page.locator("#clear-filters").click();
      assert.equal((await state()).filteredIds.length, 25);
      await page.locator("#admission-filter").selectOption("blocked");
      assert.equal((await state()).filteredIds.length, 1);
      assert.equal((await state()).counts.all, 25);
      await page.locator("#reset").click();
      if (width === 1440) {
        await page.locator("#columns summary").click();
        for (let i = 0; i < 6; i++) await page.locator(`[data-column="${i}"]`).uncheck();
        assert.equal(await page.locator('[data-column="6"]').isDisabled(), true);
        assert.equal(await page.locator("thead th:visible").count(), 1);
        assert.equal(await page.locator("thead .frozen-cell:visible").textContent(), "操作");
        await page.locator("#freeze").click();
        assert.equal(await page.locator("thead .frozen-cell").count(), 0);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
      }
      checks.push(
        `${width}: original 25/1/1/24 counts, exact three-sort ID sequences, 20/5 paging, five filters/reset/search excludes target URL; desktop seven columns/last-column guard/freeze/density`,
      );
      await scene("default");
      if (width === 390) {
        await page.locator(`[data-preview="${data.definition.id}"]`).click();
        await page.locator("#preview-tech summary").click();
        assert.ok((await page.locator("#preview-tech").getAttribute("open")) !== null);
        await page.locator("#preview-edit").click();
        assert.equal(await page.locator("dialog[open]").count(), 1);
        await page.keyboard.press("Escape");
        assert.equal(
          await page.evaluate(() => document.activeElement.dataset.preview),
          data.definition.id,
        );
      }
      await scene("default"); // Fresh creation is distinct from edit-to-create residual-field coverage below.
      await page.locator("#create").click();
      assert.equal(await page.evaluate(() => document.activeElement.id), "field-code");
      await page.locator("#next-step").click();
      assert.equal((await state()).step, 1);
      await page.locator("#field-code").fill(data.validDraft.code);
      await page.locator("#field-name").fill(data.validDraft.name);
      await page.locator("#field-target_url").fill(data.validDraft.target_url);
      await page.locator("#next-step").click();
      assert.equal((await state()).step, 2);
      for (const f of data.fields.filter((f) => f.step === 2))
        assert.equal(
          await page.locator("#field-" + f.key).inputValue(),
          String(data.validDraft[f.key]),
        );
      await page.locator("#next-step").click();
      await page.locator("#field-retry_limit").fill("11");
      assert.equal((await state()).errors.retry_limit !== undefined, true);
      await page.locator("#next-step").click();
      assert.equal((await state()).step, 3);
      await page.locator("#field-retry_limit").fill("2");
      await page.locator("#next-step").click();
      assert.equal((await state()).step, 4);
      await page.locator("#save").click();
      const write = (await state()).intents.find((v) => v.method === "POST");
      assert.deepEqual(write.body, data.post.body);
      assert.equal(write.path, "/api/v1/platform/providers");
      assert.equal(await page.locator("#save").isDisabled(), true);
      assert.equal(await page.evaluate(() => window.PROVIDER_C.submit()), null);
      await page.evaluate(() => window.PROVIDER_C.completeWrite("conflict"));
      assert.equal((await state()).editor, true);
      assert.equal((await state()).form.name, data.validDraft.name);
      await page.locator("#editor-close").click();
      assert.equal(await page.evaluate(() => document.activeElement.id), "create");
      checks.push(
        `${width}: 23 source-backed fields, four steps/next validation/direct jumps, exact source POST arrays/nulls, duplicate save disabled and 409 draft preservation; mobile preview-to-editor and focus return`,
      );
      for (const mode of data.modes) {
        await scene(`template-${mode}`);
        const now = (await state()).form;
        for (const [key, value] of Object.entries(data.templates[mode]))
          assert.deepEqual(now[key], value, mode + key);
        const expectedBody = { ...data.templates[mode] };
        for (const field of ["markets", "languages", "fields", "failure_rules"])
          expectedBody[field] = expectedBody[field]
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        for (const field of [
          "healthcheck_url",
          "terms_reference_url",
          "terms_version",
          "terms_expires_at",
        ])
          expectedBody[field] = expectedBody[field] || null;
        await page.evaluate(() => window.PROVIDER_C.submit());
        assert.deepEqual((await state()).intents[0].body, expectedBody);
        assert.equal((await state()).intents[0].method, "POST");
      }
      await scene("edit-4");
      assert.deepEqual(await page.evaluate(() => window.PROVIDER_C.buildRequest()), data.put);
      await page.locator("#field-terms_version").press("Enter");
      assert.equal((await state()).intents[0].method, "PUT");
      await page.evaluate(() => window.PROVIDER_C.completeWrite("conflict"));
      const dialog = page.locator("#editor");
      await page.locator("#save").focus();
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.dataset.step), "1");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "save");
      await scene("edit-to-create");
      assert.deepEqual(
        await page.evaluate(() => window.PROVIDER_C.buildRequest()),
        data.editToCreate,
      );
      await scene("edit-4");
      const saveId = await page.evaluate(() => window.PROVIDER_C.submit());
      await page.locator("#editor-close").click();
      await page.locator("#create").click();
      await page.locator("#field-name").fill("新窗口草稿");
      await page.evaluate((id) => window.PROVIDER_C.completeWrite("success", id), saveId);
      assert.equal((await state()).editor, true);
      assert.equal((await state()).form.name, "新窗口草稿");
      for (const outcome of ["error", "forbidden", "unknown", "success", "reload-failed"]) {
        await scene("edit-4");
        await page.locator("#save").click();
        await page.evaluate((v) => window.PROVIDER_C.completeWrite(v), outcome);
        const now = await state();
        assert.equal(now.editor, !["success", "reload-failed"].includes(outcome));
        if (outcome === "unknown") assert.equal(await page.locator("#save").isDisabled(), true);
        if (outcome === "reload-failed") assert.match(now.feedback, /重读失败/);
      }
      checks.push(
        `${width}: five exact template models; exact source PUT expected_version/read-only fields/time conversion and edit-to-create residual body; native Tab wrap; late-write protection/unknown-result disable are proposal-only`,
      );
      for (const from of ["default", "error"])
        for (const outcome of [
          "success",
          "empty",
          "error",
          "timeout",
          "forbidden",
          "expired",
          "blocked",
        ]) {
          await scene(from);
          const id = await page.evaluate(() => window.PROVIDER_C.read());
          await page.evaluate(({ id, outcome }) => window.PROVIDER_C.completeRead(outcome, id), {
            id,
            outcome,
          });
          const now = await state();
          assert.equal(now.readBusy, false);
          if (from === "default" && !["success", "empty"].includes(outcome)) {
            assert.equal(now.counts.all, 25);
            assert.match(now.readError, /保留/);
          }
          await layout(page, from + outcome);
        }
      await scene("default");
      const oldId = await page.evaluate(() => window.PROVIDER_C.read());
      const newId = await page.evaluate(() => window.PROVIDER_C.read());
      assert.equal(
        await page.evaluate((id) => window.PROVIDER_C.completeRead("success", id), oldId),
        false,
      );
      assert.equal(
        await page.evaluate((id) => window.PROVIDER_C.completeRead("success", id), newId),
        true,
      );
      const beforeUrl = page.url();
      await page.locator('[data-route="/platform-admin/providers/adapters"]').click();
      assert.equal(page.url(), beforeUrl);
      assert.deepEqual((await state()).navigation, ["/platform-admin/providers/adapters"]);
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("create-3");
        await layout(page, `${w} editor`);
        await scene("default");
        await layout(page, `${w} list`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() => {
        document.documentElement.style.zoom = "2";
      });
      await scene("default");
      await layout(page, "CSS zoom2 list");
      await scene("create-3");
      await layout(page, "CSS zoom2 editor");
      checks.push(
        `${width}: 14 offline read outcomes, stale read rejected in proposal, source retained-snapshot semantics, exact local navigation intent/no real destination; boundary widths, CSS zoom2 list/editor and no storage. Full Vue/RBAC/SQL/history/AT not tested`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  if (capture)
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          proposal: "PROVIDER-REGISTRY-C-r1",
          sourceHashes,
          sourceChecks: data.checks,
          checks,
          httpRequests: 0,
          errors,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
  else
    assert.deepEqual(
      prior.screenshots.map((s) => s.file),
      expected,
    );
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    [...expected].sort(),
  );
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      errors,
      httpRequests: requests.length,
    }),
  );
} finally {
  await browser.close();
}
