import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildOpenPlatformDesignData } from "./lib/ui-phase2-open-platform-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/open-platform-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n");
const { data, logic } = await buildOpenPlatformDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.OPEN_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const file = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(file)), parser: "babel" });
  if (capture) await writeFile(file, formatted);
  else assert.equal(lf(await readFile(file, "utf8")), formatted);
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
for (const [, f, h] of contracts)
  assert.equal(hash(lf(await readFile(path.join(repo, f), "utf8"))), h, f);
const sourcePaths = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-open-platform-design-data.mjs",
  "scripts/verify-ui-phase2-open-platform-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c/quality.css",
  ...["index.html", "open-platform.css", "open-platform.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
  ),
);
if (!capture) {
  const before = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(before.sourceHashes, sourceHashes);
  for (const p of before.screenshots)
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
    label + " page overflow",
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
      label + " dialog overflow/ARIA",
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
      scenes = await page.evaluate(() => window.OPEN_C.scenes);
      const scene = (k) => page.evaluate((k) => window.OPEN_C.scene(k), k),
        state = () => page.evaluate(() => window.OPEN_C.state());
      const readDone = (outcome = "success") =>
        page.evaluate((v) => window.OPEN_C.completeRead(v), outcome);
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
        assert.deepEqual(errors, [], key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
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
      assert.equal((await state()).data.clients[0].id, "c1");
      await scene("default");
      await page.locator('[data-view="deliveries"]').click();
      assert.equal((await state()).reads.length, 0);
      assert.equal(await page.locator("#create").count(), 0);
      await page.locator("#query").fill("task");
      await page.locator("#status").selectOption("dead_letter");
      await page.locator("#sort").selectOption("attempts_desc");
      await page.locator("#page-size").selectOption("10");
      await page.locator("#apply").click();
      assert.equal((await state()).applied.deliveries.query, "");
      assert.equal((await state()).read.target.filters.deliveries.query, "task");
      await readDone("error");
      assert.equal((await state()).data.deliveries.length, 5);
      await page.locator("#apply").click();
      await readDone();
      assert.equal((await state()).applied.deliveries.pageSize, 10);
      assert.equal((await state()).data.summary.deliveries.total, 5);
      await page.locator("#reset").click();
      await readDone();
      assert.equal((await state()).applied.deliveries.query, "");
      await scene("default");
      await page.locator("#org").fill(data.org);
      await page.locator("#org-form").evaluate((n) => n.requestSubmit());
      const first = (await state()).read.id;
      await page.evaluate(() => {
        window.OPEN_C.read();
      });
      const second = (await state()).read.id;
      assert.notEqual(first, second);
      assert.equal(
        await page.evaluate((id) => window.OPEN_C.completeRead("success", id), first),
        false,
      );
      await readDone();
      assert.equal((await state()).orgApplied, data.org);
      for (const k of Object.keys(data.statuses)) {
        for (const status of data.statuses[k]) {
          await scene(`status-${k}-${status}`);
          assert.ok((await state()).data[k].every((r) => r.status === status));
          assert.equal((await state()).data[k].length, 1);
        }
        await scene(`page-${k}`);
        assert.equal((await state()).data[k].length, 20);
        await page.locator("#next").click();
        await readDone();
        assert.equal((await state()).data[k].length, 1);
        assert.equal((await state()).data.pagination[k].page, 2);
        await scene(`tech-${k}`);
        assert.ok((await page.locator("dialog").innerText()).includes("组织 ID"));
        const ids = {
          clients: ["账号 ID", "账号前缀", "有效期", "最近调用", "每分钟限额"],
          webhooks: ["安全网址", "签名指纹", "订阅事件", "版本"],
          deliveries: ["响应状态", "尝试次数", "下次可用", "错误代码", "投递 ID", "回调 ID"],
        };
        for (const text of ids[k])
          assert.ok((await page.locator("dialog").innerText()).includes(text), text);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        await scene(`columns-${k}`);
        const count = await page.locator("[data-col]").count();
        for (let i = 0; i < count - 1; i++) await page.locator(`[data-col="${i}"]`).uncheck();
        assert.equal(await page.locator("[data-col]:disabled").count(), 1);
        await page.keyboard.press("Escape");
        assert.equal((await state()).settings[k].hidden.length, count - 1);
        for (const other of Object.keys(data.statuses).filter((v) => v !== k))
          assert.deepEqual((await state()).settings[other].hidden, []);
        if (width === 1440) {
          assert.equal(await page.locator("th.sticky-first").count(), 1);
          await page.locator("#freeze").click();
          assert.equal(await page.locator("th.sticky-first").count(), 0);
          await page.locator("#density").selectOption("compact");
          assert.equal((await state()).settings[k].density, "compact");
          for (const other of Object.keys(data.statuses).filter((v) => v !== k)) {
            assert.equal((await state()).settings[other].freeze, true);
            assert.equal((await state()).settings[other].density, "standard");
          }
        }
      }
      await scene("default");
      await page.locator("#org").fill("invalid-org");
      await page.locator("#org-form").evaluate((n) => n.requestSubmit());
      await page.locator("#read-success").click();
      assert.equal((await state()).orgApplied, null);
      assert.match((await state()).readError, /格式无效/);
      await scene("timeout");
      await page.locator("#refresh").click();
      await page.locator("#read-failure").click();
      assert.match((await state()).readError, /尚无成功数据/);
      assert.equal(
        await page.locator("#app").getByText("已读取：全部组织", { exact: true }).count(),
        0,
      );
      await scene("page-outside");
      assert.equal((await state()).data.pagination.clients.page, 3);
      assert.ok((await page.locator("#app").innerText()).includes("服务没有自动纠页"));
      for (const type of [
        "create-client",
        "create-webhook",
        "client-rotate",
        "client-revoke",
        "webhook-disable",
        "webhook-enable",
        "webhook-test",
        "webhook-rotate",
        "replay",
      ]) {
        await scene(`form-${type}`);
        await page.locator("#field-reason").fill("");
        await page.locator("#review-action").click();
        assert.equal(await page.locator("#error-reason").count(), 1);
        await page.locator("#field-reason").fill("本次测试原因");
        await page.locator("#review-action").click();
        assert.equal((await state()).dialog.kind, "confirm");
        assert.equal((await state()).dialog.pending.body.reason, "本次测试原因");
        assert.equal(await page.locator("#ack").count(), type === "client-revoke" ? 1 : 0);
        if (type === "client-revoke") {
          assert.equal(await page.locator("#execute").isDisabled(), true);
          await page.locator("#ack").check();
        }
        const body = (await state()).dialog.pending.body;
        await page.locator("#execute").click();
        await page.evaluate(() => window.OPEN_C.submit());
        assert.equal((await state()).writes.length, 1);
        assert.deepEqual((await state()).writes[0].body, body);
        await page.evaluate(() => window.OPEN_C.completeWrite("success"));
        assert.ok(["secret", "result"].includes((await state()).dialog.kind));
        if (["webhook-test", "replay"].includes(type))
          assert.ok((await page.locator("dialog").innerText()).includes("外部投递尚未确认"));
        await page.keyboard.press("Escape");
        assert.equal((await state()).secret, null);
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      for (const key of ["invalid-create-client", "invalid-create-webhook"]) {
        await scene(key);
        for (const el of await page.locator('[aria-invalid="true"]').all()) {
          const id = await el.getAttribute("aria-describedby");
          assert.ok(id);
          assert.equal(await page.locator(`#${id}`).count(), 1);
        }
      }
      await scene("write-read-error");
      assert.ok((await page.locator("dialog").innerText()).includes("随后读取失败"));
      await page.locator("#copy").click();
      assert.ok((await page.locator("dialog").innerText()).includes("浏览器未允许复制"));
      await page.locator("#saved").click();
      assert.equal((await state()).secret, null);
      await scene("unknown-result");
      assert.equal(await page.locator("#execute").count(), 0);
      assert.ok((await page.locator("dialog").innerText()).includes("可能已执行"));
      await scene("replay-no-secret");
      assert.equal((await state()).secret, null);
      assert.ok((await page.locator("dialog").innerText()).includes("不再携带密钥"));
      await scene("pending-write");
      const closedWrite = (await state()).dialog.id;
      await page.locator("#close").click();
      assert.equal(
        await page.evaluate((id) => window.OPEN_C.completeWrite("success", id), closedWrite),
        false,
      );
      assert.equal((await state()).secret, null);
      // Every modal stage has a real keyboard close target; native dialog keeps Tab inside.
      for (const key of [
        "detail-clients",
        "detail-webhooks",
        "detail-deliveries",
        "columns-clients",
        "form-create-client",
        "form-create-webhook",
        "form-replay",
        "confirm-client-revoke",
        "confirm-webhook-test",
        "pending-write",
        "secret-client-rotate",
        "unknown-result",
        "queued-replay",
      ]) {
        await scene(key);
        await page.locator("#close").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.evaluate(() =>
            document.querySelector("dialog").contains(document.activeElement),
          ),
          true,
          key,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(() =>
            document.querySelector("dialog").contains(document.activeElement),
          ),
          true,
          key,
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal(
          await page.evaluate(() => document.activeElement === document.body),
          false,
          key,
        );
      }
      await scene("default");
      const trigger =
        width === 390
          ? page.locator("[data-detail]").last()
          : page.locator("[data-detail]").first();
      await trigger.click();
      await page.keyboard.press("Escape");
      assert.equal(await trigger.evaluate((n) => n === document.activeElement), true);
      await scene("detail-clients");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("webhooks");
        await layout(page, `breakpoint-${w}`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("default");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS-zoom2");
      await page.evaluate(() => (document.documentElement.style.zoom = ""));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push(
        `${width}: three workspaces/no-read switch, eleven status values, filter drafts/snapshot and organization request ownership, 20/21 independent pagination/outside page, full details, three column minima, nine exact-body action flows/revoke-only acknowledgement, no duplicate write, secret clearing/denied copy/idempotent no-secret, split write/read result, thirteen modal consumers keyboard/return/backdrop, six breakpoints and CSS zoom2; no storage or network.`,
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
          proposal: "OPEN-PLATFORM-C-r1",
          sourceHashes,
          sourceChecks: data.sourceChecks,
          checks,
          httpRequests: 0,
          errors,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const f = path.join(root, "README.md"),
      readme = await readFile(f, "utf8");
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
      readme.replace(
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
      "open-platform.css",
      "open-platform.js",
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
      scenes: Object.keys(scenes).length,
      sourceChecks: data.sourceChecks.length,
      contractSources: contracts.length,
      checks,
      httpRequests: requests.length,
      errors,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
