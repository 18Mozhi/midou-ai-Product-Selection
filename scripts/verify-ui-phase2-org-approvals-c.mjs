import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildOrgApprovalsDesignData } from "./lib/ui-phase2-org-approvals-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
import { assertRetainedProposalSources } from "./lib/ui-phase2-org-approvals-retained-sources.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  refreshSources = process.argv.includes("--refresh-sources"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--refresh-sources"].includes(v)) &&
    !(capture && refreshSources),
);
const data = await buildOrgApprovalsDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ORG_APPROVALS_C_DATA)), data);
const sources = [
  ...["index.html", "approvals.css", "approvals.js", "data.js"].map((f) => relative + "/" + f),
  "scripts/lib/ui-phase2-org-approvals-design-data.mjs",
  "scripts/verify-ui-phase2-org-approvals-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "scripts/lib/ui-phase2-org-approvals-retained-sources.mjs",
  "apps/web/src/components/OrganizationApprovalPanel.vue",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "apps/api/src/organization-admin-routes.ts",
  "apps/api/src/organization-admin-service.ts",
  "apps/api/src/mysql-organization-admin-repository.ts",
  "tests/e2e/m06-01-organization-admin.spec.ts",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  if (refreshSources) assertRetainedProposalSources(previous.sourceHashes, sourceHashes);
  else assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [];
async function metrics(page) {
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "Page overflow",
  );
  assert.equal(await page.locator("dialog,[role=dialog]").count(), 0);
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    await page
      .locator("input,select")
      .evaluateAll((ns) => ns.every((n) => document.querySelector('label[for="' + n.id + '"]'))),
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
      await page.waitForFunction(() => window.ORG_APPROVALS_C?.state());
      const scene = (n) => page.evaluate((v) => window.ORG_APPROVALS_C.scene(v), n),
        state = () => page.evaluate(() => window.ORG_APPROVALS_C.state());
      const names = await page.evaluate(() => Object.keys(window.ORG_APPROVALS_C.scenes));
      assert.equal(names.length, 45);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#refresh").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") {
          if (width === 390) await page.locator("#filters-toggle").click();
          await page.locator("#request-query").focus();
        }
        if (name === "template_no_diff")
          assert.match(await page.locator("#detail").innerText(), /均未变化/);
        if (name === "template_first")
          assert.match(await page.locator("#detail").innerText(), /没有上一持久化版本/);
        if (name === "template_multi_diff") assert.equal(await page.locator(".node").count(), 3);
        if (name === "template_page_two")
          assert.match(await page.locator(".off-page").innerText(), /不会自动切换/);
        const file = width + "-" + name + ".png";
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
      assert.equal(await page.locator(".request").count(), 8);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator(".request").count(), 2);
      assert.match(page.url(), /approval_request_page=2/);
      if (width === 390) await page.locator("#filters-toggle").click();
      await page.locator("#request-query").fill("厨房");
      assert.equal(await page.locator(".request").count(), 1);
      assert.equal((await state()).request.page, 1);
      await page.locator("#request-status").selectOption("approved");
      assert.equal(await page.locator(".request").count(), 0);
      await page.locator("#clear-filter").click();
      assert.equal(await page.locator(".request").count(), 8);
      await page.locator("#request-workspace").selectOption("采购协作工作区");
      assert.equal(await page.locator(".request").count(), 5);
      await page.locator("#request-resource").selectOption("opportunity_decision");
      assert.equal(await page.locator(".request").count(), 0);
      await page.locator("#reset").click();
      await page.locator("#request-sort").selectOption("created_asc");
      assert.match(await page.locator(".request h3").first().innerText(), /审批记录 10/);
      await page.locator("[data-view=templates]").click();
      await page.locator("#template-status").selectOption("draft");
      assert.equal(await page.locator("[data-select]").count(), 1);
      assert.match(await page.locator("#detail").innerText(), /首个版本/);
      assert.match(page.url(), /approval_view=templates/);
      await page.reload();
      assert.equal((await state()).view, "templates");
      assert.equal((await state()).template.status, "draft");
      assert.equal((await state()).request.sort, "created_asc");
      if (width === 390) await page.locator("#filters-toggle").click();
      await page.locator("#reset").click();
      assert.equal(await page.locator("[data-select]").count(), 2);
      assert.equal(new URL(page.url()).searchParams.has("approval_template_status"), false);
      await page.locator("#template-resource").selectOption("opportunity_decision");
      assert.equal(await page.locator("[data-select]").count(), 1);
      await page.locator("#template-query").fill("采购首次");
      assert.equal(await page.locator("[data-select]").count(), 0);
      await page.locator("#clear-filter").click();
      await scene("template_catalog");
      assert.equal(await page.locator("[data-select]").count(), 6);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator("[data-select]").count(), 2);
      assert.match(await page.locator("#detail h2").innerText(), /治理模板 01/);
      await page.locator("[data-select]").last().focus();
      await page.keyboard.press("Enter");
      assert.match(await page.locator("#detail h2").innerText(), /治理模板 08/);
      assert.equal(
        await page.locator("#detail").evaluate((n) => document.activeElement === n),
        true,
      );
      if (width === 390) {
        await page.locator("#back-directory").click();
        assert.equal(
          await page.locator("#directory").evaluate((n) => document.activeElement === n),
          true,
        );
      }
      if (width === 390) await page.locator("#filters-toggle").click();
      await page.locator("#template-query").fill("治理模板 01");
      assert.match(await page.locator("#detail h2").innerText(), /治理模板 01/);
      assert.equal((await state()).template.page, 1);
      await scene("template_multi_diff");
      assert.deepEqual(
        await page.locator(".node").evaluateAll((ns) => ns.map((n) => n.dataset.kind)),
        ["changed", "removed", "added"],
      );
      assert.equal(await page.locator(".field").count(), 4);
      assert.match(await page.locator(".field").nth(2).innerText(), /变更后\s*0/);
      await scene("missing_template");
      assert.match(await page.locator(".request").first().innerText(), /未知工作区/);
      assert.match(await page.locator(".request").first().innerText(), /模板已不可见/);
      await scene("summary_gap");
      assert.match(await page.locator(".summary").innerText(), /130/);
      assert.equal((await state()).items.length, 10);
      await scene("normal");
      assert.equal(await page.getByText(data.items[0].id, { exact: false }).isVisible(), false);
      await page.locator(".technical summary").first().click();
      assert.equal(
        await page.getByText("审批记录 ID：" + data.items[0].id, { exact: true }).isVisible(),
        true,
      );
      await page.locator("#refresh").click();
      assert.deepEqual((await state()).intents, [
        { method: "GET", path: "/org/admin/summary" },
        { method: "GET", path: "/org/admin/approvals" },
      ]);
      assert.equal((await state()).items.length, 10);
      await page.getByRole("link", { name: "前往审批工作台" }).click();
      assert.deepEqual((await state()).intents.at(-1), { navigation: "/tasks/approvals" });
      await page.getByRole("link", { name: "查看组织审计" }).click();
      assert.deepEqual((await state()).intents.at(-1), { navigation: "/org-admin/audit" });
      assert.equal(
        (await state()).intents.some((i) => i.method && !["GET", "HEAD"].includes(i.method)),
        false,
      );
      for (const forbidden of ["发布", "回退", "批准", "拒绝", "创建模板", "保存"])
        assert.equal(await page.getByRole("button", { name: forbidden, exact: true }).count(), 0);
      assert.deepEqual(http, []);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.equal((await context.cookies()).length, 0);
      checks.push({
        width,
        scenes: names.length,
        dialogVariants: 0,
        interactions: "passed",
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
      });
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of ["normal", "templates", "long_request", "long_diff", "template_catalog"]) {
        await page.evaluate((n) => window.ORG_APPROVALS_C.scene(n), name);
        await metrics(page);
      }
    }
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual((await readdir(root)).filter((f) => f.endsWith(".png")).sort(), expected.sort());
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        proposal: "ORG-APPROVALS-C-r1",
        sourceHashes,
        screenshots,
        checks,
        sourceChecks: data.sourceChecks,
        scope:
          "Standalone read-only design. No mounted Vue, HTTP/API, SQL, production or user approval. Browser contexts closed.",
      },
      null,
      2,
    ) + "\n",
  );
else {
  assert.deepEqual(previous.screenshots.map((s) => s.file).sort(), expected);
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(data.sourceChecks, previous.sourceChecks);
  if (refreshSources)
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify({ ...previous, sourceHashes }, null, 2) + "\n",
    );
}
console.log(
  JSON.stringify(
    {
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      sourceChecks: data.sourceChecks,
      temporaryProcesses: "All browser contexts closed",
    },
    null,
    2,
  ),
);
