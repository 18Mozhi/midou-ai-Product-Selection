import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildOrganizationProfileDesignData } from "./lib/ui-phase2-organization-profile-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/organization-profile-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildOrganizationProfileDesignData(repo),
  sources = [
    ...["index.html", "profile.css", "profile.js", "data.js"].map((f) => `${relative}/${f}`),
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/api/src/organization-admin-service.ts",
    "apps/api/src/organization-admin-routes.ts",
    "apps/api/src/mysql-organization-admin-repository.ts",
    "tests/e2e/m06-01-organization-admin.spec.ts",
    "scripts/lib/ui-phase2-organization-profile-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-organization-profile-c.mjs",
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(
      sources.map(async (f) => [
        f,
        hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
      ]),
    ),
  );
const box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ORG_PROFILE_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const item of previous.screenshots) {
    assert.match(item.file, /^[a-z0-9_-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, item.file))), item.sha256);
  }
}
const screenshots = [],
  expected = [],
  checks = [],
  browser = await chromium.launch({ headless: true });
async function metrics(page) {
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "page overflow",
  );
  assert.equal(await page.locator("dialog").count(), 0, "P29 has no business modal");
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual(
    await page.locator("a,summary").evaluateAll((nodes) =>
      nodes
        .filter((n) => n.getClientRects().length)
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width < 43.9 || r.height < 43.9;
        })
        .map((n) => n.textContent),
    ),
    [],
  );
  assert.equal(
    await page
      .locator("#profile-form input,#profile-form select,#profile-form textarea")
      .evaluateAll((nodes) =>
        nodes.every(
          (n) =>
            Boolean(document.querySelector(`label[for="${n.id}"]`)) &&
            n
              .getAttribute("aria-describedby")
              .split(" ")
              .every((id) => Boolean(document.getElementById(id))),
        ),
      ),
    true,
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
      const page = await context.newPage(),
        errors = [],
        http = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) http.push(r.url());
      });
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => window.ORG_PROFILE_C?.state());
      const scene = (name) => page.evaluate((v) => window.ORG_PROFILE_C.scene(v), name),
        state = () => page.evaluate(() => window.ORG_PROFILE_C.state()),
        complete = (outcome) => page.evaluate((v) => window.ORG_PROFILE_C.complete(v), outcome),
        hold = () => page.evaluate(() => window.ORG_PROFILE_C.setMode("hold")),
        names = await page.evaluate(() => Object.keys(window.ORG_PROFILE_C.scenes));
      assert.equal(names.length, 37);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#save-profile").hover();
          if (name === "pressed") await page.mouse.down();
        }
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
        }
        if (name === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      await scene("normal");
      assert.equal(
        await page
          .locator("#profile-form input,#profile-form select,#profile-form textarea")
          .count(),
        6,
      );
      for (const label of ["删除组织", "停用组织", "迁移组织", "修改套餐", "取消保存"])
        assert.equal(await page.getByRole("button", { name: label, exact: true }).count(), 0);
      await page.locator("#save-profile").click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(
        await page.locator("#reason").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#reason").fill("核验组织资料");
      await page.locator("#save-profile").click();
      assert.deepEqual((await state()).intents.at(-1), data.contract);
      assert.equal((await state()).profile.version, 3);
      await scene("editing");
      await page.locator("#logo_url").fill("http://example.test/logo.png");
      await page.locator("#save-profile").click();
      assert.equal((await state()).intents.length, 0);
      assert.match(await page.locator("#logo_url-error").innerText(), /https/);
      await page.locator("#logo_url").fill("");
      await page.locator("#save-profile").click();
      assert.equal((await state()).intents.at(-1).body.logo_url, "");
      await scene("editing");
      await page.locator("#data_retention_days").fill("30.5");
      await page.locator("#save-profile").click();
      assert.equal((await state()).intents.length, 0);
      for (const days of ["30", "3650"]) {
        await page.locator("#data_retention_days").fill(days);
        await page.locator("#save-profile").click();
        assert.equal((await state()).intents.at(-1).body.data_retention_days, Number(days));
      }
      for (const name of ["missing_workspace", "no_options"]) {
        await scene(name);
        await page.locator("#reason").fill("核验工作区");
        await page.locator("#save-profile").click();
        assert.equal((await state()).intents.length, 0);
      }
      await scene("archived_option");
      assert.equal(await page.locator("#default_workspace_id option:checked").isDisabled(), false);
      await page.locator("#reason").fill("核验原始选项");
      await page.locator("#save-profile").click();
      assert.equal(
        (await state()).intents.at(-1).body.default_workspace_id,
        data.profile.default_workspace_id,
      );
      await scene("zero_summary");
      assert.match(await page.locator("#summary").innerText(), /0/);
      assert.doesNotMatch(await page.locator("#summary").innerText(), /未取得数据/);
      await scene("missing_summary");
      assert.match(await page.locator("#summary").innerText(), /未取得数据/);
      await scene("normal");
      await page.getByRole("link", { name: "更新资料", exact: true }).click();
      assert.equal(
        await page
          .getByRole("link", { name: "更新资料", exact: true })
          .getAttribute("aria-current"),
        "true",
      );
      assert.equal(await page.locator('.directory a[aria-current="true"]').count(), 1);
      assert.equal(
        await page.locator("#profile-form").evaluate((n) => n === document.activeElement),
        true,
      );
      for (const outcome of [
        "error",
        "conflict",
        "forbidden",
        "read_failed",
        "timeout",
        "success",
      ]) {
        await scene("editing");
        const draft = (await state()).form;
        await hold();
        await page.locator("#save-profile").click();
        const token = (await state()).generation;
        assert.equal(await page.locator("#save-profile").isDisabled(), true);
        assert.equal((await state()).intents.length, 1);
        await complete(outcome);
        if (outcome === "forbidden") {
          assert.equal((await state()).page, "forbidden");
          assert.equal(await page.locator("#profile-form").count(), 0);
        } else if (outcome === "success") {
          assert.equal((await state()).profile.name, draft.name);
          assert.equal((await state()).profile.version, 4);
          assert.equal((await state()).form.reason, "");
        } else {
          assert.deepEqual((await state()).form, draft);
          assert.equal(
            await page.locator("#form-feedback").evaluate((n) => n === document.activeElement),
            true,
          );
          assert.equal(
            await page.locator("#form-feedback").evaluate((n) => {
              const r = n.getBoundingClientRect();
              return r.top >= 0 && r.top < innerHeight;
            }),
            true,
          );
        }
        if (["read_failed", "timeout"].includes(outcome))
          assert.equal(await page.locator("#save-profile").isDisabled(), true);
        assert.equal(
          await page.evaluate((t) => window.ORG_PROFILE_C.complete("success", t), token),
          false,
          "completed intent cannot replay",
        );
      }
      await scene("editing");
      await hold();
      await page.locator("#save-profile").click();
      const oldToken = (await state()).generation;
      await scene("normal");
      assert.equal(
        await page.evaluate((t) => window.ORG_PROFILE_C.complete("success", t), oldToken),
        false,
      );
      assert.equal((await state()).profile.version, 3);
      await scene("editing");
      await hold();
      const draft = (await state()).form;
      await page.locator("#refresh-profile").click();
      assert.equal(await page.locator("#refresh-profile").isDisabled(), true);
      assert.deepEqual((await state()).form, draft);
      await complete("error");
      assert.deepEqual((await state()).form, draft);
      await page.locator("#refresh-profile").click();
      await complete("success");
      assert.deepEqual((await state()).form, data.initialForm);
      assert.equal((await state()).intents.filter((v) => v.method === "PATCH").length, 0);
      await scene("editing");
      await page.locator("#name").fill("未保存名称");
      await page.reload();
      await page.waitForFunction(() => window.ORG_PROFILE_C?.state());
      assert.equal((await state()).form.name, data.profile.name);
      if (width === 1440)
        for (const w of [768, 1024]) {
          await page.setViewportSize({ width: w, height: 1000 });
          for (const name of ["normal", "long_name", "long_workspace", "save_conflict"]) {
            await scene(name);
            await metrics(page);
          }
        }
      assert.deepEqual(errors, []);
      assert.deepEqual(http, []);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push({
        width,
        scenes: names.length,
        dialogs: 0,
        fields: 6,
        interactions: "passed",
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        boundary:
          "Independent proposal and source inert adapters; not mounted Vue, real API/SQL transaction, audit or production verification.",
        sourceHashes,
        sourceChecks: data.sourceChecks,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
else
  assert.deepEqual(
    previous.screenshots.map((v) => v.file),
    expected,
  );
assert.deepEqual(
  (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
  [...expected].sort(),
);
console.log(
  JSON.stringify(
    {
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      sourceChecks: data.sourceChecks,
      temporaryProcesses: "all browser contexts closed",
    },
    null,
    2,
  ),
);
