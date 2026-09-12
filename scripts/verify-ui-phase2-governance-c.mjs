import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildGovernanceDesignData } from "./lib/ui-phase2-governance-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/governance-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildGovernanceDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.GOVERNANCE_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const f = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(f)), parser: "babel" });
  if (capture) await writeFile(f, formatted);
  else assert.equal(lf(await readFile(f, "utf8")), formatted);
}
const contract = await readFile(
  path.join(repo, "design-plans/ui-phase-2-2026-09-07/data-governance-contract-review.md"),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)];
assert.equal(contracts.length, 25);
const contractRebindings = [
  {
    file: "apps/web/src/components/PlatformDataCenter.vue",
    old: "10f653d56272859493121550b668ec02a88e7a2586aa9590e9cf31659115ccf4",
    current: "73f961e34f708defa5ab73cf2e03c349e8b58e8369a399ca80cbb98ad15d8b5f",
    baseline: "3d297b78d6e26abe803a10bd1a688fc4254d38bb",
    reason: "P54 current records implementation is independent from this frozen proposal.",
  },
  {
    file: "apps/web/src/components/DataQualityCenter.vue",
    old: "92bfec2ad010bc6f6b0c82571a911a0107075acba1c3b5643376f86716b94d2c",
    current: "2c523882706ad74b43905b29a9d3ee6396b1bdbd676bef32089edcf311be9120",
    baseline: "3d297b78d6e26abe803a10bd1a688fc4254d38bb",
    reason: "P54 current quality implementation is independent from this frozen proposal.",
  },
  {
    file: "tests/e2e/m03-06-evidence-data-quality.spec.ts",
    old: "e5a582642e3b35d2ccfa82872cc91bc00412a1521893508433c31cfaad3b45cb",
    current: "88f67bd991684fe5bc3d6c8adbea9df78501d755b9bc173beb2db60ed253635d",
    baseline: "3d297b78d6e26abe803a10bd1a688fc4254d38bb",
    reason: "P54 current interaction tests are independent from this frozen proposal.",
  },
];
for (const [, rawFile, h] of contracts) {
  const f = rawFile.trim();
  const binding = contractRebindings.find((v) => v.file === f);
  if (binding) {
    assert.equal(h, binding.old);
    const beforeRevision = binding.baseline ?? `${binding.commit}^`;
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `${beforeRevision}:${f}`], {
            cwd: repo,
            encoding: "utf8",
          }),
        ),
      ),
      binding.old,
    );
    if (binding.commit)
      assert.equal(
        hash(
          lf(
            execFileSync("git", ["show", `${binding.commit}:${f}`], {
              cwd: repo,
              encoding: "utf8",
            }),
          ),
        ),
        binding.current,
      );
  }
  assert.equal(
    hash(lf(await readFile(path.join(repo, f), "utf8"))),
    responsiveFocusContractHash(f, binding?.current ?? h),
    f,
  );
}
const sourcePaths = [
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
  ...data.sourcePaths,
  "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c/quality.css",
  "scripts/lib/ui-phase2-governance-design-data.mjs",
  "scripts/verify-ui-phase2-governance-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "governance.css", "governance.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const historicalProposalSources = new Set([
  "apps/web/src/components/PlatformGovernanceCenter.vue",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
]);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [
      f,
      hash(
        lf(
          historicalProposalSources.has(f)
            ? execFileSync("git", ["show", `ce50835aa9972dd2b50b1977270cc998b09ba5fd:${f}`], {
                cwd: repo,
                encoding: "utf8",
              })
            : await readFile(path.join(repo, f), "utf8"),
        ),
      ),
    ]),
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
      scenes = await page.evaluate(() => window.GOVERNANCE_C.scenes);
      const scene = (key) => page.evaluate((k) => window.GOVERNANCE_C.scene(k), key),
        state = () => page.evaluate(() => window.GOVERNANCE_C.state()),
        complete = (outcome) => page.evaluate((v) => window.GOVERNANCE_C.complete(v), outcome);
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

      await scene("default");
      assert.equal((await state()).data.items[0].id, "score-55");
      await page.locator('[data-section="automation_rules"]').click();
      assert.equal((await state()).snapshot, "score_rules");
      await page.locator(width === 390 ? "#mobile-detail-0" : "#detail-0").click();
      assert.ok((await page.locator("#modal").innerText()).includes("第 2 版"));
      await page.locator("#record-workbench").click();
      assert.equal((await state()).routeIntent, "/opportunities/scoring-rules");
      await page.locator("#cancel").click();
      await complete("error");
      assert.equal((await state()).snapshot, "score_rules");
      await page.locator("#refresh").click();
      await complete("success");
      assert.equal((await state()).snapshot, "automation_rules");
      await page.locator(width === 390 ? "#mobile-detail-0" : "#detail-0").click();
      await page.locator("#record-workbench").click();
      assert.equal((await state()).routeIntent, "/automations?rule=auto-55&action=edit");
      for (const entry of data.sections) {
        await scene(entry.value + "-route");
        assert.equal(
          (await state()).routeIntent,
          entry.value === "automation_rules"
            ? "/automations?rule=synthetic-automation_rules&action=edit"
            : entry.href,
        );
        await scene(entry.value + "-filter");
        assert.equal(
          await page.locator("#modal #status option").count(),
          data.statuses[entry.value].length + 1,
        );
        await page.locator("#query").fill(" 保留草稿 ");
        await page.locator("#cancel").click();
        if (width === 390) await page.locator("#open-filter").click();
        assert.equal(await page.locator("#query").inputValue(), " 保留草稿 ");
        await page.locator("#apply").click();
        assert.ok((await state()).calls.at(-1).includes("query="));
        assert.equal((await state()).query, "保留草稿");
        await complete("empty");
        assert.equal((await state()).data.pagination.total, 0);
      }
      for (const key of [
        "score_rules-detail",
        "automation_rules-detail",
        "releases-technical",
        "filter-draft",
        "settings",
        "provider-route",
      ]) {
        await scene(key);
        assert.ok(
          await page.evaluate(() =>
            document.querySelector("#modal").contains(document.activeElement),
          ),
        );
        const f = page
          .locator("#modal button:not(:disabled),#modal input,#modal select,#modal summary")
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
      await scene("filter-draft");
      assert.equal(await page.locator("#query").getAttribute("maxlength"), "120");
      await page.locator("#reset").click();
      assert.equal((await state()).query, "");
      assert.equal((await state()).status, "");
      await scene("automation_rules-detail");
      assert.ok((await page.locator("#modal").innerText()).includes("3 次 / 60 分钟"));
      await scene("automation-zero");
      assert.ok((await page.locator("#modal").innerText()).includes("不据此推断不限频率"));
      await scene("page-pending");
      assert.equal((await state()).data.pagination.page, 1);
      await complete("error");
      assert.equal((await state()).data.pagination.page, 1);
      await scene("page-first");
      await page.locator("#next").click();
      await complete("success");
      assert.equal((await state()).data.pagination.page, 2);
      await scene("settings");
      const cols = page.locator("[data-column]");
      for (let i = 0; i < 4; i++) await cols.nth(i).uncheck();
      await cols.last().click();
      assert.equal((await state()).columns.filter(Boolean).length, 1);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of [
          "default",
          "long-detail",
          "filter-draft",
          "automation_rules-detail",
          "settings",
        ]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("long-detail");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: five category/status filters and precise original workbench targets, retained snapshot ownership, draft/apply/reset, server pagination, complete automation fields, six modal consumer focus loops and return, column minimum, six breakpoints/CSS zoom2; local prototype only, no target navigation or business writes.`,
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
          proposal: "GOVERNANCE-C-r1",
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
      "governance.css",
      "governance.js",
      "data.js",
      "source-logic.js",
      "README.md",
      "evidence.json",
      "vue-implementation",
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
