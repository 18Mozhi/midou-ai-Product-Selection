import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildCredentialDesignData } from "./lib/ui-phase2-credential-assets-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/credential-assets-direction-c";
const root = path.join(repo, relative),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const data = await buildCredentialDesignData(repo);
const contractText = await readFile(
  path.join(
    repo,
    "design-plans/ui-phase-2-2026-09-07/source-channel-credential-contract-review.md",
  ),
  "utf8",
);
const contracts = [...contractText.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)];
assert.equal(contracts.length, 19);
for (const [, file, expectedHash] of contracts)
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    expectedHash,
    file,
  );
const dataFile = path.join(root, "data.js");
const generated = await format(`window.CREDENTIAL_C_DATA=${JSON.stringify(data)};`, {
  ...(await resolveConfig(dataFile)),
  parser: "babel",
});
if (capture) await writeFile(dataFile, generated);
else {
  const box = { window: {} };
  vm.runInNewContext(await readFile(dataFile, "utf8"), box);
  assert.deepEqual(JSON.parse(JSON.stringify(box.window.CREDENTIAL_C_DATA)), data);
}
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-credential-assets-design-data.mjs",
  "scripts/verify-ui-phase2-credential-assets-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...["index.html", "credentials.css", "credentials.js", "data.js"].map((f) => relative + "/" + f),
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
const browser = await chromium.launch({ headless: true });
const screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  requests = [];
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  if (await page.locator("dialog[open]").count())
    assert.ok(
      await page.locator("dialog").evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      label + " dialog overflow",
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
      const scene = (key) => page.evaluate((k) => window.CREDENTIAL_C.scene(k), key);
      const state = () => page.evaluate(() => window.CREDENTIAL_C.state());
      const finish = (o = "success", id) =>
        page.evaluate(({ o, id }) => window.CREDENTIAL_C.complete(o, id), { o, id });
      const scenes = await page.evaluate(() => window.CREDENTIAL_C.scenes);
      for (const [key, label] of Object.entries(scenes)) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, key);
        assert.equal((await state()).intents.length, 0, key + " scenes have no request");
        const modal = await page.locator("dialog[open]").count();
        let part = 0;
        while (true) {
          const file = `${width}-${key}${part ? "-part" + part : ""}.png`;
          expected.push(file);
          if (capture) {
            const bytes = await page.screenshot({
              path: path.join(root, file),
              fullPage: !modal,
              animations: "disabled",
            });
            screenshots.push({
              file,
              width,
              scene: key,
              label,
              pageId: "P50",
              proposal: "CREDENTIAL-ASSETS-C-r1",
              part,
              sha256: hash(bytes),
            });
          }
          if (!modal) break;
          const moved = await page.locator("dialog").evaluate((n) => {
            const before = n.scrollTop;
            n.scrollTop = Math.min(
              n.scrollHeight - n.clientHeight,
              n.scrollTop + n.clientHeight * 0.8,
            );
            return n.scrollTop > before + 1;
          });
          if (!moved) break;
          part++;
          assert.ok(part < 10, "bounded dialog scroll");
        }
        if (key === "pressed") await page.mouse.up();
      }
      await scene("default");
      assert.deepEqual((await state()).assets, [data.original.asset]);
      await page.locator("#asset-meta-0 summary").click();
      await page.locator("#refresh").click();
      assert.ok(await page.locator("#refresh").isDisabled());
      assert.equal(await page.evaluate(() => window.CREDENTIAL_C.read()), false);
      assert.equal((await state()).intents.length, 3);
      await finish("error");
      assert.deepEqual((await state()).assets, [data.original.asset]);
      assert.equal(await page.locator("#asset-meta-0").getAttribute("open"), "");
      assert.equal(await page.evaluate(() => document.activeElement.id), "refresh");
      for (const [type, trigger] of [
        ["asset", "#new-asset"],
        ["rotate", "#rotate-0"],
        ["revoke", "#revoke-0"],
      ]) {
        await page.locator(trigger).click();
        assert.equal((await state()).dialog, type);
        for (let i = 0; i < 14; i++) {
          await page.keyboard.press("Tab");
          assert.ok(
            await page.evaluate(() =>
              document.querySelector("dialog").contains(document.activeElement),
            ),
          );
        }
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => document.activeElement.id), trigger.slice(1));
      }
      for (const key of ["profile", "login", "compat-detail"]) {
        await scene(key);
        for (const direction of ["Tab", "Shift+Tab"])
          for (let i = 0; i < 16; i++) {
            await page.keyboard.press(direction);
            assert.ok(
              await page.evaluate(() =>
                document.querySelector("dialog").contains(document.activeElement),
              ),
            );
          }
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      await scene("asset-empty");
      await page.locator("#name").fill("合成凭证");
      await page.locator("#value").fill("inert-verifier-input");
      await page.locator("#submit").click();
      let op = (await state()).pending;
      assert.deepEqual((await state()).intents[0].body, {
        provider_id: data.original.provider.id,
        name: "合成凭证",
        kind: "api_key",
        secret_payload: { encoding: "utf8", value: "[REDACTED: in-memory only]" },
        expires_at: null,
      });
      assert.ok(await page.locator("#provider_id").isDisabled());
      assert.equal(await page.evaluate(() => window.CREDENTIAL_C.submit()), false);
      await page.locator("#dialog-close").click();
      await page.locator("#new-asset").click();
      await page.locator("#name").fill("新的合成凭证");
      assert.equal(await finish("error", op.id), false);
      assert.equal(await page.locator("#name").inputValue(), "新的合成凭证");
      for (const outcome of ["error", "unknown", "success"]) {
        await scene("asset-filled");
        await page.locator("#submit").click();
        await finish(outcome);
        if (outcome === "success") {
          assert.equal((await state()).pending.kind, "read");
          await finish("error");
          assert.match((await state()).notice, /重读失败/);
        } else {
          assert.equal(await page.locator("#value").inputValue(), "");
          assert.ok(await page.locator("#submit").isDisabled());
        }
      }
      await scene("profile-filled");
      await page.locator("#submit").click();
      assert.equal((await state()).intents[0].body.status, "disabled");
      assert.equal((await state()).intents[0].body.timezone, "America/Los_Angeles");
      await finish("error");
      assert.match(await page.locator("#editor-notice").innerText(), /明确拒绝/);
      await scene("revoke");
      assert.ok(await page.locator("#submit").isDisabled());
      await page.locator("#acknowledge").check();
      assert.ok(await page.locator("#submit").isDisabled());
      await page.locator("#typed").fill("  确认撤销  ");
      assert.ok(await page.locator("#submit").isEnabled());
      await page.locator("#submit").click();
      assert.deepEqual((await state()).intents[0].body, {
        expected_version: 2,
        reason: "平台安全管理员确认撤销",
      });
      await finish("error");
      for (const mode of ["cookie_file", "browser", "archive"]) {
        await scene("login");
        await page.locator("#login-mode").selectOption(mode);
        await page.locator(mode === "browser" ? "#helper-read" : "#choose-file").click();
        const materialOp = (await state()).pending.id;
        await page.locator("#dialog-close").click();
        await page.locator("#new-login").click();
        assert.equal(await finish("success", materialOp), false);
        assert.equal((await state()).material, false);
        await page.locator("#login-mode").selectOption(mode);
        await page.locator(mode === "browser" ? "#helper-read" : "#choose-file").click();
        await finish();
        assert.equal((await state()).material, true);
        await page.locator("#login-provider").selectOption(data.original.secondProvider.id);
        assert.equal((await state()).material, false);
        await page.locator(mode === "browser" ? "#helper-read" : "#choose-file").click();
        await finish();
        await page.locator("#submit").click();
        let writes = (await state()).intents.filter((i) => i.method === "POST");
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.provider_id, data.original.secondProvider.id);
        assert.equal(writes[0].body.kind, mode === "archive" ? "browser_profile" : "cookie_bundle");
        await finish();
        writes = (await state()).intents.filter((i) => i.method === "POST");
        assert.equal(writes.length, 2);
        assert.equal(writes[1].body.status, "active");
        assert.equal(writes[1].body.timezone, "Asia/Shanghai");
        await finish("error");
        assert.ok(await page.locator("#submit").isDisabled());
        assert.match(await page.locator("#editor-notice").innerText(), /无需重新导入/);
        await page.locator("#cancel").click();
        await page.locator("#refresh").click();
        await finish();
        await page.locator('[data-view="profiles"]').click();
        await page.locator("#new-profile").click();
        await page.locator("#credential_asset_id").selectOption("synthetic-saved-asset");
        await page.locator("#code").fill("recovery_profile");
        await page.locator("#name").fill("恢复档案");
        await page.locator("#submit").click();
        assert.equal(
          (await state()).intents.filter(
            (i) => i.method === "POST" && i.path === "/platform/credential-assets",
          ).length,
          1,
        );
        assert.equal(
          (await state()).intents.at(-1).body.credential_asset_id,
          "synthetic-saved-asset",
        );
        await finish();
        await finish();
      }
      await scene("login");
      await page.locator("#external").click();
      await page.locator("#helper-download").click();
      assert.deepEqual((await state()).intents, [
        { method: "EXTERNAL", path: data.original.provider.target_url },
        { method: "DOWNLOAD", path: "/browser-helper/scoutops-browser-helper.zip" },
      ]);
      await scene("compatibility");
      if (width === 1440) {
        await page.locator("#columns summary").click();
        for (const i of [0, 1, 2]) await page.locator(`[data-column="${i}"]`).uncheck();
        assert.ok(await page.locator('[data-column="3"]').isDisabled());
        assert.equal(await page.locator("th:not([hidden])").count(), 1);
        await page.locator("#freeze").click();
        assert.equal((await state()).freeze, false);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
      } else {
        await page.locator("#compat-0").click();
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => document.activeElement.id), "compat-0");
      }
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of [
          "long",
          "asset-filled",
          "profile-filled",
          "login-partial",
          "compat-detail",
        ]) {
          await scene(key);
          await layout(page, w + " " + key);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("profile-filled");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.equal(
        await page.evaluate(() => document.body.innerText.includes("inert-verifier-input")),
        false,
      );
      checks.push(
        `${width}: ${Object.keys(scenes).length} scenes with continuous dialog parts; exact redacted intents, three login partial-save/recovery modes, stale material/write rejection, busy/unknown guards, keyboard/focus, columns/freeze/density, six extra breakpoints and CSS zoom2. No production Vue/auth/encryption/SQL/extension or full theme/lifecycle proof.`,
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
          proposal: "CREDENTIAL-ASSETS-C-r1",
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
    const readme = path.join(root, "README.md"),
      text = await readFile(readme, "utf8");
    const gallery =
      `正式 PNG：${screenshots.length} 张。\n\n| 场景 | 桌面 1440 | 移动 390 |\n| --- | --- | --- |\n` +
      [...new Set(screenshots.map((s) => s.scene))]
        .map((key) => {
          const group = screenshots.filter((s) => s.scene === key);
          const links = (width) =>
            group
              .filter((s) => s.width === width)
              .map((s) => `[${s.part ? "连续 " + s.part : "主图"}](${s.file})`)
              .join(" · ");
          return `| ${group[0].label} | ${links(1440)} | ${links(390)} |`;
        })
        .join("\n");
    await writeFile(
      readme,
      text.replace(
        /<!-- GALLERY:START -->[\s\S]*<!-- GALLERY:END -->/,
        `<!-- GALLERY:START -->\n\n${gallery}\n\n<!-- GALLERY:END -->`,
      ),
    );
  } else
    assert.deepEqual(
      prior.screenshots.map((s) => s.file),
      expected,
    );
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    [...expected].sort(),
  );
  assert.deepEqual(
    (await readdir(root)).sort(),
    [
      ...expected,
      "README.md",
      "index.html",
      "credentials.css",
      "credentials.js",
      "data.js",
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
      errors,
      httpRequests: requests.length,
      contractSourceFiles: contracts.length,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
