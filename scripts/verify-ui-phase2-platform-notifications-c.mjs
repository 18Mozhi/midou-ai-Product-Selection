import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildPlatformNotificationsDesignData } from "./lib/ui-phase2-platform-notifications-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/platform-notifications-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildPlatformNotificationsDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.PN_DATA=${JSON.stringify(data)};`],
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
    "design-plans/ui-phase-2-2026-09-07/content-notification-evidence-contract-review.md",
  ),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(
  ([, f]) => data.sourcePaths.includes(f),
);
assert.equal(contracts.length, 21);
const proposalRevision = "05a5152fee9ce562579d5470de019c0fbce4bcb9";
const implementationHashes = new Map([
  [
    "apps/web/src/components/use-platform-notification-list.ts",
    "43b46c51afce786c288cb9ce3f1382f2ef3b926360b9d892ee6652e1a0d7a9e7",
  ],
  [
    "apps/web/src/components/PlatformManagementCenter.vue",
    "c3dba75b134c70ff7bd23a9310395eb9e6f78c73d53a738a061e0071f2c89bf9",
  ],
  [
    "apps/web/src/components/PlatformMessageEditor.vue",
    "135ab00609dac3dc7fddf54085972594e80f6d1e6f2a0609973c3d7f7d6eea31",
  ],
  [
    "apps/web/src/components/PlatformMessageWorkbench.vue",
    "7c46437db21c0874d138bb249c4cead5afceebc19e4d6a3fe62aec2e83e9cc7a",
  ],
  [
    "apps/web/src/components/PlatformNotificationOperations.vue",
    "73bfa7089471ce53ea44f747727211684cb840df62a22a86b70dbaa4c9ba5e07",
  ],
  [
    "apps/web/src/components/PlatformNotificationManagement.vue",
    "7cced021643a3af6a23a07f8afca71d943cabcd13cf963d97ac3b698a3dfe2e8",
  ],
  [
    "apps/web/src/components/PlatformNotificationPagination.vue",
    "56968271bcfcf600901782eea6601eaae49a5a84bc5d3ab7bc0a9618596f0849",
  ],
  [
    "apps/web/src/components/PlatformManagementFilter.vue",
    "0ac6f1cd0c812b6f3455d3288f91c8b9ab6bf2028b7a1cafd35c823e26da08f6",
  ],
  [
    "apps/web/src/components/ResponsiveFilterDrawer.vue",
    "5f9d10aa91421ee10f5187e2051d90bcadf7479d54456c60e91dfb3d2eb0c8a0",
  ],
  [
    "tests/unit/platform-notification-operations.test.mjs",
    "635a55afd06851ee69db325c9d0553afd3cf43707be87192464291c7b11efaae",
  ],
  [
    "tests/e2e/platform-message-management.spec.ts",
    "868bbb4d3245ee960d579d207ed412ba161e4d83d7ef4fbdd8876f1319f6cdc5",
  ],
  [
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "d164a18d6808823272c34b6f612446370d4802cb34aca1722b94b2cec3865f66",
  ],
]);
const carriedCurrentHashes = new Map([
  [
    "apps/web/src/use-audited-reason.ts",
    "e31e580799041d994e58d011f991d96918e6ca5b699473a94577967f63302eab",
  ],
  [
    "apps/web/src/components/AuditedReasonDialog.vue",
    "3191e4ba14aa0919d5083e048f89a6ef99497d01aa6c5d8d5bcbbc47f42e1a9a",
  ],
  [
    "apps/web/src/components/ResponsiveDataView.vue",
    "6d3088d1c82d962e748dec1b68ae9b4dd5eeff6895fa3e42ba84c6f59a01f8ac",
  ],
  [
    "apps/web/src/use-modal-dialog.ts",
    "5f3488e444f30c86d9f7e7424cc0f5463118fac0d3e78422251167dbd571b2fc",
  ],
]);
const contractRebindings = [
  ...[...implementationHashes].map(([file, current]) => ({
    file,
    proposalRevision,
    current,
    reason: "P57 current Vue implementation; historical proposal contract retained.",
  })),
  ...[...carriedCurrentHashes].map(([file, current]) => ({
    file,
    proposalRevision,
    current,
    reason: "Previously reviewed shared audited-reason revision; historical proposal retained.",
  })),
];
for (const [, f, h] of contracts) {
  const proposalHash = hash(
    lf(execFileSync("git", ["show", `${proposalRevision}:${f}`], { cwd: repo, encoding: "utf8" })),
  );
  const historicalFocusBinding =
    f === "tests/e2e/platform-message-management.spec.ts"
      ? {
          old: "e73f8e2ce373e2f4ac2a4fc6207c3772c84cb3159855e219b447be5ecfaf5f72",
          proposal: "ed45f8df2572d35492fe289a6de397b861dacee8d552fd9b77bc6bf0934c2dad",
        }
      : f === "tests/e2e/m06-02-platform-dashboard.spec.ts"
        ? {
            old: "dc949ced1becd59f1e0c7bf98b9fe0ab126e5b59744cb197d70c65ec861bbc66",
            proposal: "7d0f9118b740aa7844bd63796e5cf5ede3ebefda1f88d58419257b962e68cd58",
          }
        : null;
  const historicalSharedRevision =
    f === "apps/web/src/use-audited-reason.ts" ||
    f === "apps/web/src/components/AuditedReasonDialog.vue"
      ? "4a6368ef1178908688cd6519c5cafafb25c1afcb"
      : f === "apps/web/src/components/ResponsiveDataView.vue"
        ? "d99f047c95a15508066cdd191275344d3086f46a"
        : null;
  if (historicalFocusBinding) {
    assert.equal(h, historicalFocusBinding.old);
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `ff46bfe9c620a422d95cab9689489b07fb6b95ea^:${f}`], {
            cwd: repo,
            encoding: "utf8",
          }),
        ),
      ),
      historicalFocusBinding.old,
    );
    assert.equal(proposalHash, historicalFocusBinding.proposal);
  } else if (historicalSharedRevision) {
    assert.equal(
      hash(
        lf(
          execFileSync("git", ["show", `${historicalSharedRevision}:${f}`], {
            cwd: repo,
            encoding: "utf8",
          }),
        ),
      ),
      h,
      `${f} historical contract`,
    );
  } else assert.equal(proposalHash, h, `${f} proposal`);
  let currentExpected = implementationHashes.get(f) ?? carriedCurrentHashes.get(f);
  if (!currentExpected) currentExpected = responsiveFocusContractHash(f, h);
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), currentExpected, f);
}
const sourcePaths = [
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
  ...data.sourcePaths,
  "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c/quality.css",
  "scripts/lib/ui-phase2-platform-notifications-design-data.mjs",
  "scripts/verify-ui-phase2-platform-notifications-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "notifications.css", "notifications.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const historicalProposalSources = new Set(implementationHashes.keys());
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [
      f,
      hash(
        lf(
          historicalProposalSources.has(f)
            ? execFileSync("git", ["show", `${proposalRevision}:${f}`], {
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
      scenes = await page.evaluate(() => window.PN_C.scenes);
      const scene = (key) => page.evaluate((k) => window.PN_C.scene(k), key),
        state = () => page.evaluate(() => window.PN_C.state()),
        complete = (outcome) => page.evaluate((v) => window.PN_C.complete(v), outcome);
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
      const clickMessage = async () => {
        await page.locator("[data-message]").first().click();
      };
      if (width === 390) await clickMessage();
      const reader = page.locator(width === 390 ? "#modal" : ".reader.desktop");
      await reader.locator(".message-body summary").focus();
      await page.keyboard.press("Enter");
      assert.ok(await reader.locator(".body-full").isVisible());
      await page.keyboard.press("Space");
      assert.ok(!(await reader.locator(".body-full").isVisible()));
      if (width === 390) await page.locator("#close-modal").click();
      for (const status of ["draft", "published", "cancelled"]) {
        await scene("original-" + status);
        if (width === 390) await clickMessage();
        const r = page.locator(width === 390 ? "#modal" : ".reader.desktop");
        await r.locator(".message-body summary").click();
        assert.equal(
          await r.locator(".body-full").textContent(),
          data.originalMessages[status].messages[0].body,
        );
        assert.equal(await r.locator("[data-edit]").count(), status === "draft" ? 1 : 0);
        assert.equal((await state()).calls.length, 0);
      }
      await scene("body-plain-text");
      assert.equal(await page.locator("#modal img").count(), 0);
      assert.ok((await page.locator("#modal .body-full").textContent()).includes("<img"));
      for (const key of [
        "message-reader",
        "delivery-detail",
        "filter-draft",
        "settings",
        "new-all",
        "edit-user",
        "publish",
        "cancel",
        "source-boundary",
        "personal-route",
      ]) {
        await scene(key);
        assert.ok(
          await page.evaluate(() =>
            document.querySelector("#modal").contains(document.activeElement),
          ),
          key,
        );
        const f = page
          .locator(
            "#modal button:not(:disabled),#modal input:not(:disabled),#modal select:not(:disabled),#modal textarea:not(:disabled),#modal summary",
          )
          .filter({ visible: true });
        await f.last().focus();
        await page.keyboard.press("Tab");
        assert.ok(await f.first().evaluate((n) => n === document.activeElement), key);
        await page.keyboard.press("Shift+Tab");
        assert.ok(await f.last().evaluate((n) => n === document.activeElement), key);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.ok(await page.evaluate(() => document.activeElement !== document.body), key);
      }
      for (const prefix of ["new", "edit"])
        for (const target of ["all", "organization", "user"]) {
          await scene(prefix + "-" + target);
          assert.equal(
            await page.locator("#audience").inputValue(),
            target === "all" ? "all_users" : target,
          );
          assert.ok(await page.locator("#email").isDisabled());
          assert.equal(await page.locator("#reason").count(), prefix === "edit" ? 1 : 0);
          await page.locator("#submit").click();
          await page.evaluate(() => window.PN_C.submit());
          let v = await state();
          assert.equal(v.calls.filter((c) => c.method !== "GET").length, 1);
          const call = v.calls.at(-1);
          assert.equal(call.method, prefix === "new" ? "POST" : "PATCH");
          assert.equal(call.body.audience_type, target === "all" ? "all_users" : target);
          assert.equal(call.body.email_enabled, false);
          assert.equal(call.body.expected_version, prefix === "new" ? 1 : 2);
          await page.evaluate(() => window.PN_C.finish("error"));
          assert.ok((await page.locator("#modal").innerText()).includes("请求失败"));
          assert.equal(await page.locator("#title").inputValue(), "系统维护提醒");
        }
      for (const key of [
        "editor-empty",
        "editor-over",
        "editor-no-target",
        "editor-no-options",
        "editor-no-channel",
        "editor-reason-short",
        "action-reason-short",
        "action-reason-over",
        "editor-unknown",
        "publish-unknown",
        "publish-conflict",
        "publish-empty",
      ]) {
        await scene(key);
        assert.ok(await page.locator("#submit").isDisabled(), key);
      }
      for (const key of ["editor-min", "editor-max", "editor-reason-max", "action-reason-max"]) {
        await scene(key);
        assert.ok(await page.locator("#submit").isEnabled(), key);
      }
      await scene("new-all");
      await page.locator("#audience").selectOption("organization");
      assert.equal(await page.locator("#target").inputValue(), "");
      await page
        .locator("#target")
        .selectOption(data.synthetic.audience_options.organizations[0].id);
      assert.ok(await page.locator("#submit").isEnabled());
      for (const action of ["publish", "cancel"]) {
        await scene(action);
        await page.locator("#reason").fill(" 原因 ");
        await page.locator("#submit").click();
        await page.evaluate(() => window.PN_C.submit());
        const v = await state();
        assert.equal(v.calls.length, 1);
        assert.deepEqual(v.calls[0].body, { action, expected_version: 2, reason: "原因" });
      }
      await scene("publish-success");
      assert.ok((await state()).message.includes("覆盖2人"));
      assert.equal((await state()).data.messages[0].status, "published");
      await scene("publish-refresh-error");
      assert.equal((await state()).data.messages[0].status, "draft");
      await scene("cancel-success");
      assert.equal((await state()).data.messages[0].status, "cancelled");
      await scene("reason-cancelled");
      assert.equal((await state()).calls.length, 0);
      await scene("closed-pending");
      assert.ok((await state()).write);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await page.evaluate(() => window.PN_C.finish("success"));
      assert.ok((await state()).message.includes("尚未发布"));
      await scene("new-editor-old-result");
      assert.equal(await page.locator("#title").inputValue(), "另一条新草稿");
      await scene("delivery-page-last");
      assert.equal((await state()).data.pagination.page, 2);
      assert.equal((await state()).data.message_pagination.page, 1);
      await page.locator("#filter").click();
      await page.locator("#query").fill(" 采集 ");
      await page.locator("#category-filter").selectOption("task");
      await page.locator("#cancel-dialog").click();
      assert.equal((await state()).query, "");
      await page.locator("#filter").click();
      assert.equal(await page.locator("#query").inputValue(), " 采集 ");
      await page.locator("#apply").click();
      assert.equal((await state()).pending.page, 1);
      assert.equal((await state()).pending.message_page, 1);
      assert.equal((await state()).snapshot.status, "");
      await complete("empty");
      assert.equal((await state()).data.items.length, 0);
      assert.ok((await state()).data.messages.length > 0);
      await scene("message-page-last");
      await page.locator('[data-view="deliveries"]').click();
      await page.locator("#filter").click();
      await page.locator("#reset").click();
      assert.equal((await state()).pending.message_page, 2);
      await scene("page-pending");
      assert.equal((await state()).data.message_pagination.page, 1);
      await complete("error");
      assert.equal((await state()).data.message_pagination.page, 1);
      await scene("settings");
      for (let i = 0; i < 5; i++) await page.locator("[data-column]").nth(i).uncheck();
      await page.locator("[data-column]").last().click();
      assert.equal((await state()).columns.filter(Boolean).length, 1);
      await scene("routes-limited");
      assert.equal(await page.locator(".configuration section").last().locator("li").count(), 6);
      await page.locator('[data-route="/platform-admin/governance"]').click();
      assert.equal((await state()).routeIntent, "/platform-admin/governance");
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of [
          "default",
          "deliveries",
          "configuration",
          "new-organization",
          "publish",
          "body-max",
          "settings",
        ]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("new-organization");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: three-state complete plain-text reading, six create/edit audience variants, exact save/action bodies, reason/title/body boundaries, single-flight/frozen ownership, cancelled/closed/newer editor, independent 20/10 paging and filter scope, six-column minimum, limited alert routes and exact link intents, ten modal consumer focus loops and return, six breakpoints/CSS zoom2; offline no notifications or navigation.`,
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
          proposal: "PLATFORM-NOTIFICATIONS-C-r1",
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
      "notifications.css",
      "notifications.js",
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
