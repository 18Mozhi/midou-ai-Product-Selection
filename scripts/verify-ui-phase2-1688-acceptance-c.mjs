import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildAcceptanceDesignData } from "./lib/ui-phase2-1688-acceptance-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/1688-acceptance-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const hash = (s) => createHash("sha256").update(s).digest("hex"),
  { data, sourceLogic } = await buildAcceptanceDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ACCEPTANCE_C_DATA)), data);
assert.equal(
  (await readFile(path.join(root, "source-logic.js"), "utf8")).replaceAll("\r\n", "\n"),
  await format(sourceLogic, {
    ...(await resolveConfig(path.join(root, "source-logic.js"))),
    parser: "babel",
  }),
);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-1688-acceptance-design-data.mjs",
  "scripts/verify-ui-phase2-1688-acceptance-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "acceptance.css", "acceptance.js", "data.js", "source-logic.js"].map(
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
  for (const shot of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  requests = [];
async function layout(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  assert.equal(await page.locator('dialog,[role="dialog"],[role="alertdialog"]').count(), 0);
  await checkPrototypeMetrics(page);
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
      await context.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      const scene = (key) => page.evaluate((key) => window.ACCEPTANCE_C.scene(key), key),
        state = () => page.evaluate(() => window.ACCEPTANCE_C.state());
      const scenes = await page.evaluate(() => window.ACCEPTANCE_C.scenes);
      for (const [key, label] of Object.entries(scenes)) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, key);
        if (data.variants[key]) assert.deepEqual((await state()).data, data.variants[key]);
        if (key === "default") assert.deepEqual((await state()).data, data.original);
        if (key === "pending") assert.deepEqual((await state()).data, data.pending);
        assert.equal((await state()).intents.length, 0, key + " scene creates no request");
        const file = `${width}-${key}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({
            file,
            width,
            scene: key,
            label,
            pageId: "P49",
            proposal: "1688-ACCEPTANCE-C-r1",
            sha256: hash(bytes),
          });
        }
        if (key === "pressed") await page.mouse.up();
      }
      await scene("default");
      assert.equal(await page.locator("#run").isDisabled(), true);
      await page.locator("#query").fill("   ");
      assert.equal(await page.locator("#run").isDisabled(), true);
      await page.locator("#query").fill("  桌面灯  ");
      assert.equal(await page.evaluate(() => document.activeElement.id), "query");
      assert.equal(await page.locator("#run").isEnabled(), true);
      const before = (await state()).data;
      await page.locator("#run").click();
      assert.equal(await page.locator("#organization").isDisabled(), true);
      assert.equal(await page.locator("#workspace").isDisabled(), true);
      assert.equal(await page.locator("#query").isDisabled(), true);
      let s = await state();
      assert.equal(s.intents.length, 1);
      assert.deepEqual(s.intents[0].body, {
        organization_id: data.organizations[0].id,
        workspace_id: data.workspaces[0].id,
        query: "桌面灯",
        acceptance_run: true,
      });
      assert.equal(
        s.intents[0].path,
        `/platform/provider-sources/${data.original.provider_id}/replays`,
      );
      assert.equal(await page.evaluate(() => window.ACCEPTANCE_C.schedule()), false);
      await page.evaluate(() => window.ACCEPTANCE_C.complete("success"));
      s = await state();
      assert.equal(s.task, data.scheduled.task_id);
      assert.deepEqual(
        s.intents.map((i) => i.method),
        ["POST", "GET"],
      );
      assert.equal(s.scheduling, true);
      await page.evaluate(() => window.ACCEPTANCE_C.complete("error"));
      s = await state();
      assert.match(s.resultNotice, /已排队/);
      assert.match(s.readNotice, /重读失败/);
      assert.deepEqual(s.data, before);
      assert.equal(s.scheduling, false);
      await page.locator("#task-detail summary").click();
      assert.equal(await page.locator("#task-detail").getAttribute("open"), "");
      assert.equal((await state()).intents.length, 2, "no polling or enable request");
      for (const outcome of ["error", "unknown", "expired", "forbidden"]) {
        await scene("query-filled");
        await page.locator("#run").click();
        await page.evaluate((o) => window.ACCEPTANCE_C.complete(o), outcome);
        s = await state();
        assert.equal(s.query, "桌面灯");
        assert.equal(s.data.source_status, "disabled");
        assert.equal(s.task, "");
        if (outcome === "unknown") {
          assert.equal(await page.locator("#run").isDisabled(), true);
          await page.locator("#refresh").click();
          await page.evaluate(() => window.ACCEPTANCE_C.complete());
          assert.equal((await state()).unknown, true);
        }
      }
      for (const outcome of ["success", "error", "timeout", "expired", "forbidden"]) {
        await scene("query-filled");
        const old = (await state()).data;
        await page.locator("#refresh").click();
        assert.equal(await page.locator("#refresh").isDisabled(), true);
        assert.equal(await page.evaluate(() => window.ACCEPTANCE_C.read()), false);
        assert.equal((await state()).intents.length, 1);
        await page.evaluate((o) => window.ACCEPTANCE_C.complete(o), outcome);
        assert.deepEqual((await state()).data, old);
        assert.equal((await state()).query, "桌面灯");
        assert.equal(await page.locator("#refresh").isEnabled(), true);
      }
      for (const outcome of ["success", "empty", "error"]) {
        await scene("scope-error");
        await page.locator("#scope-retry").click();
        assert.equal(await page.locator("#organization").isDisabled(), true);
        await page.evaluate((o) => window.ACCEPTANCE_C.complete(o), outcome);
        if (outcome === "success") {
          assert.equal(
            (await state()).pending[0].path,
            `/org/${data.organizations[0].id}/workspaces`,
          );
          await page.evaluate(() => window.ACCEPTANCE_C.complete());
          assert.equal((await state()).workspace, data.workspaces[0].id);
        } else assert.equal((await state()).workspace, "");
        await layout(page, "scope " + outcome);
      }
      await scene("query-filled");
      await page.locator("#organization").selectOption("");
      assert.equal((await state()).workspace, "");
      assert.equal((await state()).intents.length, 0);
      await page.locator("#organization").selectOption(data.organizations[0].id);
      assert.equal((await state()).scopeLoading, true);
      await page.evaluate(() => window.ACCEPTANCE_C.complete("empty"));
      assert.match((await state()).scopeMessage, /没有/);
      await scene("default");
      if (width === 390) await page.locator("#context").click();
      for (const [name, url] of [
        [
          "配置或续期登录档案",
          `/platform-admin/credentials?provider_id=${data.original.provider_id}&mode=login`,
        ],
        [
          "定位 1688 固定样本",
          `/platform-admin/providers/sources?provider_id=${data.original.provider_id}`,
        ],
      ]) {
        await page.getByRole("link", { name, exact: true }).click();
        assert.deepEqual((await state()).intents.at(-1), { method: "NAVIGATE", path: url });
      }
      await page.locator("#technical summary").click();
      assert.ok(await page.locator("#technical code").first().isVisible());
      await scene("default");
      await page.locator('[data-gate="login"] summary').focus();
      await page.keyboard.press("Enter");
      await layout(page, "gate keyboard");
      await scene("query-filled");
      await page.locator("#technical summary").click();
      await page.locator("#query").fill("保留已展开详情");
      assert.equal(await page.locator("#technical").getAttribute("open"), "");
      await page.locator("#refresh").click();
      await page.evaluate(() => window.ACCEPTANCE_C.complete());
      assert.equal(await page.evaluate(() => document.activeElement.id), "refresh");
      await page.locator("#refresh").click();
      await page.locator("#query").focus();
      await page.evaluate(() => window.ACCEPTANCE_C.complete());
      assert.equal(await page.evaluate(() => document.activeElement.id), "query");
      await scene("query-filled");
      await page.locator("#run").click();
      const id = (await state()).pending[0].id;
      await scene("pending");
      assert.equal(
        await page.evaluate((id) => window.ACCEPTANCE_C.complete("success", id), id),
        false,
      );
      assert.deepEqual((await state()).data, data.pending);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("long-content");
        await layout(page, `${w} long`);
        await scene("query-limit");
        await layout(page, `${w} form`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("default");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: ${Object.keys(scenes).length} full-page scenes, 24 source-method gate/status combinations, original fixtures, zero dialogs; exact POST/one GET and failed reread separation, four submit/five read/three scope results, active scope selection, unknown no retry, route intents, disclosure/keyboard, stale scene, six breakpoints and CSS zoom2; no real Vue/API/SQL/AT/theme/density/lifecycle proof`,
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
          proposal: "1688-ACCEPTANCE-C-r1",
          sourceHashes,
          sourceChecks: data.checks,
          checks,
          errors,
          httpRequests: 0,
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
