import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildSecurityDesignData } from "./lib/ui-phase2-security-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/security-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildSecurityDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.SECURITY_DATA=${JSON.stringify(data)};`],
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
assert.equal(contracts.length, 10);
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
  "scripts/lib/ui-phase2-security-design-data.mjs",
  "scripts/verify-ui-phase2-security-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "security.css", "security.js", "data.js", "source-logic.js"].map(
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
      scenes = await page.evaluate(() => window.SECURITY_C.scenes);
      const scene = (key) => page.evaluate((k) => window.SECURITY_C.scene(k), key),
        state = () => page.evaluate(() => window.SECURITY_C.state()),
        complete = (outcome) => page.evaluate((v) => window.SECURITY_C.complete(v), outcome);
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
      assert.equal((await state()).data.security_events[0].id, data.original.security_events[0].id);
      assert.equal((await state()).data.pagination.security_events.total, 41);
      await scene("default");
      assert.equal(await page.locator("[data-view]").count(), 4);
      assert.equal(await page.locator("#status option").count(), 4);
      await page.locator("#query").fill(" login.failed ");
      await page.locator("#status").selectOption("failed");
      await page.locator("#apply").click();
      assert.equal((await state()).snapshot.query, "");
      assert.equal((await state()).pending.scope.query, "login.failed");
      await complete("error");
      assert.equal((await state()).data.security_events.length, 3);
      await page.locator("#apply").click();
      await complete("success");
      assert.equal((await state()).snapshot.query, "login.failed");
      await page.locator("#reset").click();
      await complete("success");
      assert.equal((await state()).snapshot.query, "");
      await scene("default");
      await page.locator('[data-view="credentials"]').click();
      const first = (await state()).pending.token;
      await page.locator('[data-view="sessions"]').click();
      const second = (await state()).pending.token;
      await page.evaluate((t) => window.SECURITY_C.complete("success", t), first);
      assert.equal((await state()).snapshot.view, "events");
      await page.evaluate((t) => window.SECURITY_C.complete("success", t), second);
      assert.equal((await state()).snapshot.view, "sessions");
      assert.equal((await state()).data.security_events.length, 0);
      for (const [view, statuses] of [
        ["events", ["succeeded", "failed", "blocked"]],
        ["sessions", ["active", "expired", "revoked"]],
        ["credentials", ["active", "expired", "revoked"]],
        ["audit", ["succeeded", "failed", "blocked"]],
      ]) {
        for (const status of statuses) {
          await scene("status-" + view + "-" + status);
          assert.equal((await state()).snapshot.status, status);
          assert.equal(await page.locator("#status").inputValue(), status);
        }
      }
      for (const key of ["history-sessions", "history-credentials", "history-audit"]) {
        await scene(key);
        assert.deepEqual(Object.values((await state()).data.summary), [0, 0, 0, 0, 0, 0]);
        assert.ok(await page.locator("[data-detail]").count());
        assert.ok(await page.locator("#query").isVisible());
      }
      await scene("empty");
      assert.ok(await page.locator("#query").isVisible());
      await scene("credentials-empty-only");
      assert.equal((await state()).data.credential_assets.length, 0);
      assert.equal((await state()).data.organization_tokens.length, 3);
      const fields = {
        security_events: [
          "event_type",
          "outcome",
          "occurred_at",
          "id",
          "user_id",
          "request_id",
          "trace_id",
        ],
        sessions: [
          "email",
          "status",
          "device_label",
          "last_seen_at",
          "expires_at",
          "created_at",
          "id",
          "user_id",
        ],
        credential_assets: [
          "name",
          "provider_name",
          "kind",
          "status",
          "expires_at",
          "rotated_at",
          "version",
          "updated_at",
          "id",
          "provider_id",
          "key_version",
          "fingerprint",
        ],
        organization_tokens: [
          "name",
          "status",
          "scopes",
          "expires_at",
          "last_used_at",
          "version",
          "updated_at",
          "id",
          "organization_id",
          "token_prefix",
        ],
        audit_events: [
          "action",
          "resource_type",
          "outcome",
          "occurred_at",
          "id",
          "resource_id",
          "actor_id",
          "request_id",
          "trace_id",
        ],
      };
      for (const k of Object.keys(fields)) {
        await scene("tech-" + k);
        for (const field of fields[k])
          assert.equal(
            await page.locator('#modal [data-field="' + field + '"]').count(),
            1,
            k + "/" + field,
          );
        const f = page
          .locator(
            "#modal button:not(:disabled),#modal input:not(:disabled),#modal select,#modal summary",
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
        await page
          .locator('[data-detail="' + k + '"]')
          .filter({ visible: true })
          .first()
          .click();
        await page.locator("#close").click();
        assert.ok(
          await page
            .locator('[data-detail="' + k + '"]')
            .filter({ visible: true })
            .first()
            .evaluate((n) => n === document.activeElement),
        );
        await page
          .locator('[data-detail="' + k + '"]')
          .filter({ visible: true })
          .first()
          .click();
        await page.mouse.click(1, 1);
        assert.equal(await page.locator("dialog[open]").count(), 0);
        await scene("settings-" + k);
        const count = await page.locator("[data-column]").count();
        for (let i = 0; i < count - 1; i++) await page.locator("[data-column]").nth(i).uncheck();
        assert.ok(await page.locator("[data-column]").last().isDisabled());
        assert.equal((await state()).settings[k].visible.filter(Boolean).length, 1);
        await page.keyboard.press("Escape");
        assert.equal((await state()).calls.length, 0);
        await scene("page-" + k + "-first");
        assert.equal((await state()).data[k].length, 20);
        await page.locator('[data-page="' + k + '"][data-next="2"]').click();
        await complete("error");
        assert.equal((await state()).data.pagination[k].page, 1);
        await page.locator('[data-page="' + k + '"][data-next="2"]').click();
        await complete("success");
        assert.equal((await state()).data[k].length, 1);
        assert.equal((await state()).data.pagination[k].page, 2);
        if (k === "organization_tokens")
          assert.equal((await state()).data.pagination.credential_assets.page, 1);
        if (k === "credential_assets")
          assert.equal((await state()).data.pagination.organization_tokens.page, 1);
      }
      await scene("credentials");
      if (width === 1440) {
        await page.locator('[data-freeze="credential_assets"]').click();
        assert.equal((await state()).settings.credential_assets.freeze, false);
        assert.equal((await state()).settings.organization_tokens.freeze, true);
        await page.locator('[data-density="organization_tokens"]').selectOption("compact");
        assert.equal((await state()).settings.organization_tokens.density, "compact");
        assert.equal((await state()).settings.credential_assets.density, "standard");
      }
      await page.locator("#manage").click();
      assert.ok((await page.locator("#modal").innerText()).includes("/platform-admin/credentials"));
      assert.equal((await state()).calls.length, 0);
      for (const key of ["expired", "forbidden"]) {
        await scene(key);
        assert.equal(await page.locator("#retry").count(), 0);
      }
      await scene("refresh-forbidden");
      assert.ok((await state()).message.includes("403"));
      assert.equal((await state()).phase, "ready");
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of [
          "default",
          "credentials",
          "tech-credential_assets",
          "tech-organization_tokens",
          "tech-audit_events",
          "settings-sessions",
          "long-name",
        ]) {
          await scene(key);
          await layout(page, `${w}/${key}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("tech-credential_assets");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: four view and twelve status cases, query draft/snapshot/reset and obsolete-response ownership; five full detail field sets, Tab/Escape/backdrop/return, independent column minimum/freeze/density and20/21 paging, zero-summary history, dual-collection emptiness, exact management target without navigation; six breakpoints/CSS zoom2 and offline-only.`,
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
          proposal: "SECURITY-C-r1",
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
      "security.css",
      "security.js",
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
