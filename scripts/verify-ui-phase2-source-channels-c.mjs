import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildSourceChannelsDesignData } from "./lib/ui-phase2-source-channels-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/source-channels-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  { data, sourceLogic } = await buildSourceChannelsDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.CHANNEL_C_DATA)), data);
assert.equal(
  (await readFile(path.join(root, "source-logic.js"), "utf8")).replaceAll("\r\n", "\n"),
  await format(sourceLogic, {
    ...(await resolveConfig(path.join(root, "source-logic.js"))),
    parser: "babel",
  }),
);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-source-channels-design-data.mjs",
  "scripts/verify-ui-phase2-source-channels-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/platform-organizations-direction-c/organizations.css",
  ...["index.html", "channels.css", "channels.js", "data.js", "source-logic.js"].map(
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
async function layout(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    label + " page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  await checkPrototypeMetrics(page);
  if (await page.locator("dialog[open]").count())
    assert.equal(
      await page.locator("#dialog").evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      true,
      label + " dialog overflow",
    );
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
      const url = pathToFileURL(path.join(root, "index.html")).href;
      await page.goto(url);
      const scene = (key) =>
          page.evaluate((key) => {
            window.CHANNEL_C.scene(key);
            window.scrollTo(0, 0);
          }, key),
        state = () => page.evaluate(() => window.CHANNEL_C.state());
      const all = await page.evaluate(() => Object.keys(window.CHANNEL_C.scenes));
      for (const key of all) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, key);
        if (await page.locator("dialog[open]").count())
          assert.equal(
            await page.locator("#dialog").evaluate((n) => n.scrollTop),
            0,
            key + " starts at top",
          );
        const test = data.cases.find((t) => t.key === key);
        if (test) {
          assert.deepEqual((await state()).ids, test.ids, key);
          assert.deepEqual((await state()).groups, test.groups, key + " groups");
        }
        const shot = async (suffix = "") => {
          const file = `${width}-${key}${suffix}.png`;
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
              scene: key,
              pageId: "P48",
              proposal: "SOURCE-CHANNELS-C-r1",
              sha256: hash(bytes),
            });
          }
        };
        await shot();
        if (await page.locator("dialog[open]").count()) {
          const d = await page.locator("#dialog").evaluate((n) => ({
            max: n.scrollHeight - n.clientHeight,
            step: Math.max(1, Math.floor(n.clientHeight * 0.8)),
          }));
          let part = 0;
          for (let y = d.step; y < d.max; y += d.step) {
            await page.locator("#dialog").evaluate((n, y) => (n.scrollTop = y), y);
            await shot(`-part-${++part}`);
          }
          if (d.max > 0) {
            await page.locator("#dialog").evaluate((n) => (n.scrollTop = n.scrollHeight));
            await shot("-bottom");
          }
        }
        if (key === "pressed") await page.mouse.up();
      }
      await scene("default");
      assert.equal(await page.locator(".source-row").count(), 20);
      await page.locator("#next").click();
      assert.equal((await state()).page, 2);
      assert.equal(new URL(page.url()).searchParams.get("page"), "2");
      await scene("page-eight");
      assert.equal(await page.locator(".source-row").count(), 6);
      await scene("default");
      if (width === 390) await page.locator("#filter-toggle").click();
      await page.locator("#query").fill("amazon");
      assert.equal((await state()).ids.length, 1);
      assert.equal(new URL(page.url()).searchParams.get("q"), "amazon");
      assert.equal(await page.evaluate(() => document.activeElement.id), "query");
      for (const [id, value] of Object.entries({
        category: "product_supply",
        availability: "manual",
        market: "GLOBAL",
        language: "zh-CN",
        accessMode: "import",
        sort: "attention",
      }))
        await page.locator("#" + id).selectOption(value);
      await page.locator("#reset").click();
      assert.deepEqual((await state()).controls, data.cases[0].controls);
      assert.deepEqual((await state()).intents, []);
      await page.goto(
        url + `?provider_id=${data.provider.provisioned.id}&keep=1&q=1688&sort=name&page=1`,
      );
      await page.reload();
      assert.equal((await state()).ids.length, 1);
      if (width === 390) await page.locator("#filter-toggle").click();
      await page.locator("#reset").click();
      assert.equal((await state()).ids.length, 1);
      assert.equal(
        new URL(page.url()).searchParams.get("provider_id"),
        data.provider.provisioned.id,
      );
      assert.equal(new URL(page.url()).searchParams.get("keep"), "1");
      checks.push(
        `${width}: ${all.length} scenes, 12 exact source ID/group cases; 20-item pages/6 final rows; seven-control reset, file-URL init/reload/omission/preserved provider_id and unrelated key; not VueRouter history proof`,
      );
      for (const key of ["config", "versions", "samples", "matrix"]) {
        await scene(key);
        assert.equal(await page.evaluate(() => document.activeElement.id), "close-dialog");
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.evaluate(() => document.activeElement.closest("dialog")?.id),
          "dialog",
        );
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.id), "close-dialog");
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      await scene("detail-login");
      await page.locator("#edit").click();
      await page.locator("#close-dialog").click();
      assert.equal(await page.evaluate(() => document.activeElement.id), "edit");
      await scene("config");
      await page.locator("#schedule_minutes").fill("0");
      await page.locator("#save").click();
      assert.equal((await state()).intents.length, 0);
      assert.ok((await state()).errors.length);
      await page.locator("#schedule_minutes").fill("45");
      await page.locator("#reason").fill("调整当前来源频率");
      await page.locator("#save").click();
      assert.equal(await page.locator("#reason").isDisabled(), true);
      assert.equal(await page.evaluate(() => window.CHANNEL_C.save()), null);
      assert.deepEqual((await state()).intents[0].body, {
        schedule_minutes: 45,
        timeout_ms: 20000,
        retry_limit: 3,
        status: "disabled",
        reason: "调整当前来源频率",
        expected_version: 1,
      });
      await page.evaluate(() => window.CHANNEL_C.complete("success"));
      for (const outcome of ["blocked", "conflict", "unknown", "success"]) {
        await scene("config-smoke");
        await page.locator("#save").click();
        await page.evaluate(() => window.CHANNEL_C.complete("success"));
        let s = await state();
        assert.deepEqual(
          s.intents.map((i) => i.method),
          ["PUT", "POST"],
        );
        assert.equal(s.intents[0].body.status, "disabled");
        assert.equal("body" in s.intents[1], false);
        assert.equal(s.rows[0].provisioned.status, "disabled");
        if (outcome === "success") {
          await page.evaluate(() => window.CHANNEL_C.complete("ready"));
          s = await state();
          assert.deepEqual(s.intents[2].body, { ...s.write.snapshot, expected_version: 2 });
          await page.evaluate(() => window.CHANNEL_C.complete("success"));
          assert.equal((await state()).rows[0].provisioned.status, "enabled");
        } else {
          await page.evaluate((outcome) => window.CHANNEL_C.complete(outcome), outcome);
          assert.equal((await state()).rows[0].provisioned.status, "disabled");
          assert.match((await state()).modalNote, /停用配置已保存/);
        }
      }
      await scene("config");
      await page.locator("#save").click();
      const old = (await state()).write.id;
      await page.locator("#close-dialog").click();
      await page.evaluate((code) => window.CHANNEL_C.open("config", code), data.sources[138].code);
      const newer = (await state()).modal.owner;
      await page.evaluate((id) => window.CHANNEL_C.complete("success", id), old);
      assert.equal((await state()).modal.owner, newer);
      assert.equal((await state()).modalNote, "");
      await scene("versions");
      await page.locator("#rollback-reason").fill("恢复已核对版本");
      await page.getByRole("button", { name: "恢复此版本", exact: true }).click();
      assert.deepEqual((await state()).intents.at(-1).body, data.rollbackIntent.body);
      await page.evaluate(() => window.CHANNEL_C.complete("conflict"));
      assert.equal((await state()).modal.type, "versions");
      const sampleId = data.samples.samples[0].id;
      await scene("samples");
      await page.locator(`#review-${sampleId}`).fill(" 核对字段 ");
      await page.getByRole("button", { name: "审批通过", exact: true }).click();
      assert.deepEqual(
        (await state()).intents.at(-1).body,
        data.sampleIntents.find((i) => i.name === "approve").body,
      );
      await page.evaluate(() => window.CHANNEL_C.complete("success"));
      assert.equal(await page.getByRole("button", { name: "审批通过", exact: true }).count(), 0);
      await scene("sample-self");
      assert.equal(await page.locator(`#review-${sampleId}`).isDisabled(), true);
      assert.equal(
        await page.evaluate((id) => window.CHANNEL_C.actionWrite("approve", id), sampleId),
        null,
      );
      await scene("samples-candidate");
      await page.getByRole("button", { name: "固定为样本", exact: true }).click();
      assert.deepEqual(
        (await state()).intents.at(-1).body,
        data.sampleIntents.find((i) => i.name === "create").body,
      );
      await page.evaluate(() => window.CHANNEL_C.complete("success"));
      for (const outcome of ["passed", "changed", "failed"]) {
        await scene("samples");
        await page.getByRole("button", { name: "运行差异回放", exact: true }).click();
        assert.equal("body" in (await state()).intents.at(-1), false);
        await page.evaluate((outcome) => window.CHANNEL_C.complete(outcome), outcome);
        assert.equal((await state()).rows[0].provisioned.status, "disabled");
        await layout(page, outcome);
      }
      checks.push(
        `${width}: four modal types keyboard loop/Escape/trigger return, config fields and exact body, disabled-save/smoke/enable three intents with partial failures, stale write cannot close new window, rollback/sample-create/bodyless-replay/second-person review intents`,
      );
      for (const type of ["versions", "samples", "matrix"]) {
        for (const outcome of ["success", "empty", "error"]) {
          await scene(type);
          await page.evaluate(() =>
            window.CHANNEL_C.startRead(window.CHANNEL_C.state().modal.type),
          );
          await page.evaluate((outcome) => window.CHANNEL_C.completeRead(outcome), outcome);
          assert.equal((await state()).modal.type, type);
          await layout(page, type + outcome);
        }
      }
      await scene("matrix-loading");
      const oldRead = Number(Object.keys((await state()).reads)[0]);
      await page.locator("#close-dialog").click();
      await page.evaluate((code) => window.CHANNEL_C.open("config", code), data.sources[136].code);
      assert.equal(
        await page.evaluate((id) => window.CHANNEL_C.completeRead("success", id), oldRead),
        false,
      );
      assert.equal((await state()).modal.type, "config");
      for (const outcome of ["success", "empty", "error", "timeout", "expired", "forbidden"]) {
        await scene("default");
        await page.locator("#refresh").click();
        assert.equal(await page.evaluate(() => window.CHANNEL_C.startRead()), null);
        await page.evaluate((outcome) => window.CHANNEL_C.completeRead(outcome), outcome);
        if (!["success", "empty"].includes(outcome)) assert.equal((await state()).rows.length, 146);
      }
      await scene("matrix-technical");
      assert.match(await page.locator("dialog code").textContent(), /^a{64}$/);
      assert.ok((await state()).intents.every((i) => i.method === "GET"));
      for (const key of ["detail-public", "detail-import", "detail-login"]) {
        await scene(key);
        const external = page.locator('.source-detail [data-external="true"]');
        if (await external.count()) {
          assert.equal(await external.getAttribute("rel"), "noopener noreferrer");
          await external.click();
          assert.equal((await state()).intents.at(-1).method, "EXTERNAL");
        } else assert.equal(key, "detail-import");
      }
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("long-content");
        await layout(page, `${w} long`);
        await scene("config-smoke");
        await layout(page, `${w} config`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("default");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: nine modal-read result paths, stale modal read, six catalog refresh outcomes, read-only matrix full fingerprint, intercepted HTTPS navigation, responsive long/config and CSS zoom2; no storage. No live API/SQL/AT/full-theme/lifecycle proof`,
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
          proposal: "SOURCE-CHANNELS-C-r1",
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
