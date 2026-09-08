import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildCommercialDesignData } from "./lib/ui-phase2-commercial-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/commercial-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildCommercialDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.COMMERCIAL_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const f = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(f)), parser: "babel" });
  if (capture) await writeFile(f, formatted);
  else assert.equal(lf(await readFile(f, "utf8")), formatted);
}
const contract = await readFile(
  path.join(
    repo,
    "design-plans/ui-phase-2-2026-09-07/commercial-security-open-platform-contract-review.md",
  ),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(
  ([, f]) => data.sourcePaths.includes(f),
);
assert.equal(contracts.length, 7);
const contractRebindings = [];
for (const [, f, h] of contracts) {
  const binding = contractRebindings.find((v) => v.file === f);
  if (binding) {
    assert.equal(h, binding.old);
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `${binding.commit}^:${f}`], { cwd: repo, encoding: "utf8" }),
        ),
      ),
      binding.old,
    );
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `${binding.commit}:${f}`], { cwd: repo, encoding: "utf8" }),
        ),
      ),
      binding.current,
    );
  }
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), binding?.current ?? h, f);
}
const sourcePaths = [
  ...data.sourcePaths,
  "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c/quality.css",
  "scripts/lib/ui-phase2-commercial-design-data.mjs",
  "scripts/verify-ui-phase2-commercial-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "commercial.css", "commercial.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
  ),
);
if (!capture) {
  const previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const p of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, p.file))), p.sha256);
}
const browser = await chromium.launch({ headless: true }),
  errors = [],
  requests = [],
  screenshots = [],
  expected = [],
  checks = [];
let scenes;
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  for (const d of await page.locator("dialog[open]").all())
    assert.ok(
      await d.evaluate(
        (n) =>
          n.scrollWidth <= n.clientWidth + 1 &&
          document.getElementById(n.getAttribute("aria-labelledby")) &&
          document.getElementById(n.getAttribute("aria-describedby")),
      ),
      label + " dialog",
    );
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
      assert.deepEqual(errors, []);
      scenes = await page.evaluate(() => window.COMMERCIAL_C.scenes);
      const scene = (key) => page.evaluate((k) => window.COMMERCIAL_C.scene(k), key),
        state = () => page.evaluate(() => window.COMMERCIAL_C.state()),
        complete = (outcome) => page.evaluate((v) => window.COMMERCIAL_C.complete(v), outcome);
      async function shot(key, suffix = "") {
        const file = `${width}-${key}${suffix}.png`;
        expected.push(file);
        if (capture) {
          await page.screenshot({
            path: path.join(root, file),
            fullPage: !(await page.locator("dialog[open]").count()),
          });
          screenshots.push({
            scene: key,
            width,
            file,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      }
      for (const key of Object.keys(scenes)) {
        await scene(key);
        if (key === "hover" || key === "pressed") await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, `${width}/${key}`);
        await shot(key);
        if (key === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        if (await page.locator("dialog[open]").count()) {
          const d = page.locator("dialog[open]");
          let part = 0;
          while (await d.evaluate((n) => n.scrollTop + n.clientHeight < n.scrollHeight - 2)) {
            const before = await d.evaluate((n) => n.scrollTop);
            await d.evaluate((n) => (n.scrollTop += Math.floor(n.clientHeight * 0.8)));
            assert.ok((await d.evaluate((n) => n.scrollTop)) > before);
            await shot(key, `-part${++part}`);
          }
        }
      }

      await scene("original");
      assert.equal((await state()).data.plans[0].id, data.original.plans[0].id);
      await scene("default");
      assert.equal(await page.locator(".plan-row").count(), 3);
      await page.locator("#query").fill("审核");
      await page.locator("#filter-status").selectOption("draft");
      await page.locator("#apply-filter").click();
      assert.equal((await state()).snapshot.status, "");
      assert.equal((await state()).pending.status, "draft");
      await complete("error");
      assert.equal((await state()).data.plans.length, 3);
      await page.locator("#apply-filter").click();
      await complete("success");
      assert.equal((await state()).snapshot.status, "draft");
      assert.equal((await state()).data.plans.length, 1);
      await scene("organization");
      const originalOrg = (await state()).snapshot.org;
      await page.locator("#organization-input").fill("00000000-0000-4000-8000-000000000059");
      await page.locator("#read-organization").click();
      await complete("error");
      assert.equal((await state()).snapshot.org, originalOrg);
      await page.locator("#assign").click();
      assert.equal((await state()).operation.body.organization_id, originalOrg);
      await scene("page-first");
      assert.equal((await state()).data.plans.length, 20);
      await page.locator("#plans-next").click();
      await complete("error");
      assert.equal((await state()).data.pagination.page, 1);
      await page.locator("#plans-next").click();
      await complete("success");
      assert.equal((await state()).data.pagination.page, 2);
      assert.equal((await state()).data.plans.length, 1);
      await scene("adjustment-first");
      await page.locator("#adjustments-next").click();
      await complete("success");
      assert.equal((await state()).data.adjustment_pagination.page, 2);
      assert.equal((await state()).data.pagination.page, 1);
      assert.equal((await state()).data.adjustments.length, 1);
      for (const key of [
        "create",
        "edit-active",
        "confirm-save",
        "confirm-assign",
        "confirm-adjust",
        "confirm-revoke",
        "technical",
        "source-boundary",
      ]) {
        await scene(key);
        assert.ok(
          await page.evaluate(() =>
            document.querySelector("#modal").contains(document.activeElement),
          ),
        );
        const f = page
          .locator(
            "#modal button:not(:disabled),#modal input:not(:disabled),#modal select:not(:disabled),#modal textarea:not(:disabled),#modal summary",
          )
          .filter({ visible: true });
        await f.last().focus();
        await page.keyboard.press("Tab");
        assert.ok(await f.first().evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Shift+Tab");
        assert.ok(await f.last().evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.ok(await page.evaluate(() => document.activeElement !== document.body));
      }
      await scene("create");
      assert.equal(
        await page.locator("#plan-form input,#plan-form textarea,#plan-form select").count(),
        7,
      );
      await page.locator("#plan-code").fill("Bad Code");
      assert.equal(
        await page.locator("#plan-code").evaluate((n) => n.validity.patternMismatch),
        true,
      );
      await page.locator("#plan-code").fill("audit-58_test");
      assert.equal(
        await page.locator("#plan-code").evaluate((n) => n.validity.patternMismatch),
        false,
      );
      await page.locator("#plan-code").fill("audit_58");
      await page.locator("#plan-name").fill("审核方案");
      await page.locator("#plan-submit").click();
      await page.evaluate(() => window.COMMERCIAL_C.submitCreate());
      assert.equal((await state()).calls.length, 1);
      assert.equal((await state()).calls[0].path, "/platform/commercial/plans");
      assert.equal((await state()).calls[0].body.quotas.collection_tasks, 100);
      assert.equal(await page.locator("#confirm-submit").count(), 0);
      const createKey = (await state()).calls[0].idempotencyKey;
      await page.evaluate(() => window.COMMERCIAL_C.finishWrite("error"));
      assert.ok(await page.locator("#plan-name").isDisabled());
      await page.locator("#plan-submit").click();
      assert.equal((await state()).calls.at(-1).idempotencyKey, createKey);
      await scene("edit-active");
      assert.equal(
        await page.locator("#plan-form input,#plan-form textarea,#plan-form select").count(),
        7,
      );
      assert.equal(await page.locator("#plan-code").count(), 0);
      assert.equal(await page.locator("#plan-status option").count(), 3);
      await page.locator("#plan-collection_tasks").fill("120");
      await page.locator("#plan-submit").click();
      assert.equal((await state()).operation.body.quotas.collection_tasks, 120);
      assert.equal((await state()).operation.body.expected_version, 2);
      assert.equal(await page.locator("#plan-form").count(), 0);
      await page.locator("#confirm-submit").click();
      await page.evaluate(() => window.COMMERCIAL_C.submitConfirm());
      assert.equal((await state()).calls.filter((c) => c.method === "PATCH").length, 1);
      assert.equal((await state()).calls.at(-1).body.expected_version, 2);
      await page.evaluate(() => window.COMMERCIAL_C.finishWrite("conflict"));
      assert.ok(await page.locator("#confirm-submit").isDisabled());
      for (const [key, method, suffix] of [
        ["confirm-activate", "PATCH", "/plans/"],
        ["confirm-retire", "PATCH", "/plans/"],
        ["confirm-assign", "POST", "/assignments"],
        ["confirm-renew", "POST", "/assignments"],
        ["confirm-suspend", "POST", "/actions"],
        ["confirm-resume", "POST", "/actions"],
        ["confirm-end", "POST", "/actions"],
        ["confirm-adjust", "POST", "/adjustments"],
        ["confirm-revoke", "POST", "/revoke"],
      ]) {
        await scene(key);
        const operation = (await state()).operation;
        assert.equal(operation.method, method);
        assert.ok(operation.path.includes(suffix));
        assert.equal(await page.locator("#modal input").count(), 0);
        await page.locator("#confirm-submit").click();
        assert.deepEqual((await state()).calls.at(-1).body, operation.body);
      }
      for (const key of ["confirm-conflict", "confirm-unknown"]) {
        await scene(key);
        assert.ok(await page.locator("#confirm-submit").isDisabled());
      }
      await scene("confirm-error");
      assert.ok(await page.locator("#confirm-submit").isEnabled());
      await scene("success-refresh-error");
      assert.ok((await state()).message.includes("列表刷新失败"));
      await scene("closed-pending");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.ok((await state()).write);
      await scene("new-dialog-old-result");
      assert.ok(await page.locator("#plan-submit").isEnabled());
      assert.ok(
        await page
          .locator("#plan-name")
          .inputValue()
          .then((v) => v.includes("新开的")),
      );
      await scene("cancelled");
      assert.equal((await state()).calls.length, 0);
      await scene("current-off-page");
      assert.equal(await page.locator("#assignment-plan option").count(), 2);
      await scene("no-selectable");
      assert.equal(await page.locator("#assignment-plan option").count(), 1);
      await scene("adjustment-timing");
      assert.equal(await page.locator("[data-revoke]").count(), 2);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of [
          "default",
          "organization",
          "create-max",
          "confirm-assign",
          "confirm-adjust-future",
          "source-boundary",
        ]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("create-max");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: catalog and organization snapshot separation, independent20/10 pages, seven-field create/edit, four-field assignment/five-field adjustment, nine confirmation families and frozen single-flight payloads, original keys on retry, modal focus loops/Escape/return, conflict/unknown, old dialog and write/reload ownership; six breakpoints/CSS zoom2; offline only.`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  if (capture) {
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          proposal: "COMMERCIAL-C-r1",
          contractRebindings,
          sourceHashes,
          sourceChecks: data.sourceChecks,
          checks,
          errors,
          httpRequests: 0,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const f = path.join(root, "README.md"),
      text = await readFile(f, "utf8");
    const gallery =
      `正式PNG：${screenshots.length}张；${Object.keys(scenes).length}场景。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
      Object.entries(scenes)
        .map(
          ([key, label]) =>
            `| ${label} (${key}) | ` +
            [1440, 390]
              .map((width) =>
                screenshots
                  .filter((p) => p.scene === key && p.width === width)
                  .map(
                    (p) =>
                      `[${p.file.match(/-part(\d+)\.png$/)?.[1] ? "局部" + p.file.match(/-part(\d+)\.png$/)[1] : "主图"}](${p.file})`,
                  )
                  .join(" · "),
              )
              .join(" | ") +
            " |",
        )
        .join("\n");
    await writeFile(
      f,
      text.replace(
        /<!-- GALLERY:START -->[\s\S]*?<!-- GALLERY:END -->/,
        `<!-- GALLERY:START -->\n${gallery}\n<!-- GALLERY:END -->`,
      ),
    );
  }
  assert.deepEqual(
    (await readdir(root)).sort(),
    [
      ...expected,
      "index.html",
      "commercial.css",
      "commercial.js",
      "data.js",
      "source-logic.js",
      "README.md",
      "evidence.json",
    ].sort(),
  );
  const links = [
    ...(await readFile(path.join(root, "README.md"), "utf8")).matchAll(/\]\(([^)]+)\)/g),
  ];
  for (const [, link] of links) await readFile(path.resolve(root, link));
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      sourceChecks: data.sourceChecks.length,
      contractSources: contracts.length,
      httpRequests: requests.length,
      errors,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
