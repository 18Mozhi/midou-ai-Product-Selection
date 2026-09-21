import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = "scripts/verify-ui-phase2-commercial-create.mjs";
let runner = (await readFile(base, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  "29950b8199909b9afb7020d11561576cabcdb5a2e117472ccd024ae4497d601d",
);
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
}
replace(
  'output = "output/playwright/p58-create-current-review"',
  'output = "output/playwright/p58-create-write-review"',
);
replace(
  "preview = previewCommercialCreate(source);",
  "preview = previewCommercialCreateWrite(source);",
);
replace(
  'implementation/commercial-create-preview.css";',
  'implementation/commercial-create-write-preview.css";',
);
replace(
  '"scripts/verify-ui-phase2-commercial-create.mjs",',
  '"scripts/verify-ui-phase2-commercial-create.mjs",\n  "scripts/verify-ui-phase2-commercial-create-write.mjs",\n  "scripts/lib/ui-phase2-commercial-create-write-preview.mjs",',
);
replace(
  "for (const width of [390, 760, 1440]) {",
  'for (const width of [390, 760, 1440]) for (const scene of ["conflict", "forbidden"]) {',
);
replace(
  "  await includeImportedStyleSources(sources, read);",
  `  const appSources = new Set([...sources].filter((file) => file.startsWith("apps/web/")));
  await includeImportedStyleSources(appSources, read);
  for (const file of appSources) sources.add(file);
  sources.add("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-preview.css");`,
);
replace(
  "      try {\n        const page",
  "      let releaseWrite;\n      try {\n        const page",
);
replace(
  "      } finally {\n        await context.close();",
  "      } finally {\n        releaseWrite?.();\n        await context.close();",
);
const routeStart = runner.indexOf('        await page.route("**/*",'),
  routeEnd = runner.indexOf("        await page.goto(", routeStart);
assert.ok(routeStart > 0 && routeEnd > routeStart);
runner =
  runner.slice(0, routeStart) +
  `        let writes = 0;
        const writeGate = new Promise((resolve) => { releaseWrite = resolve; });
        const failureHint = scene === "conflict" ? "标识发生冲突，请核对后再创建。" : "当前权限暂不能创建草稿。";
        await page.route("**/*", (route) => {
          const req = route.request(), url = new URL(req.url()), key = req.method() + " " + url.pathname;
          if (url.origin !== origin) { unexpected.push(key); return route.abort(); }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (!["GET /api/v1/me/navigation", "GET /api/v1/auth/session-status", "GET /api/v1/platform/commercial", "POST /api/v1/platform/commercial/plans"].includes(key)) { unexpected.push(key); return route.abort(); }
          requests.push({ key, body: req.postData(), idempotencyKey: req.headers()["idempotency-key"] ?? null });
          if (key.startsWith("POST ")) {
            writes++;
            return writeGate.then(() => route.fulfill({ status: scene === "conflict" ? 409 : 403, json: { error: { code: "p58_local_" + scene, message: "本地拒绝样例", action_hint: failureHint }, request_id: "p58-create-" + scene } }));
          }
          return route.fulfill({ json: { data: url.pathname.endsWith("navigation") ? fixtures.navigation : url.pathname.endsWith("session-status") ? { authenticated: true } : fixtures.data, request_id: "p58-local-read" } });
        });
` +
  runner.slice(routeEnd);
const pictureStart = runner.indexOf("        const picture = async (suffix) => {"),
  pictureEnd = runner.indexOf(
    "        await page.evaluate(() => document.fonts.ready);",
    pictureStart,
  );
assert.ok(pictureStart > 0 && pictureEnd > pictureStart);
const pictures = runner
  .slice(pictureStart, pictureEnd)
  .replace("const picture = async (suffix)", "const picture = async (suffix, locator = dialog)")
  .replace("await dialog.screenshot(", "await locator.screenshot(")
  .replace("`${mode}-${width}-${suffix}.png`", "`${mode}-${width}-${scene}-${suffix}.png`")
  .replace("            suffix,", "            suffix,\n            scene,");
const flowStart = runner.indexOf('        await expect(page.getByText("380 / 1050"))'),
  flowLast =
    "        runs.push({ mode, width, checks, requests, backgroundSha256: hash(background) });",
  flowEnd = runner.indexOf(flowLast, flowStart) + flowLast.length;
assert.ok(flowStart > 0 && flowEnd > flowStart);
runner =
  runner.slice(0, flowStart) +
  pictures +
  `
        await expect(page.getByText("380 / 1050")).toBeVisible();
        await page.getByRole("button", { name: "方案目录 全局配置与额度" }).click();
        await trigger.focus(); await page.keyboard.press("Enter"); await expect(dialog).toBeVisible();
        await dialog.getByLabel("内部标识", { exact: true }).fill("basic_2026");
        await dialog.getByLabel("方案名称", { exact: true }).fill("审核样例配额方案");
        await dialog.getByLabel("方案说明", { exact: true }).fill("只用于本地拒绝状态验证");
        await dialog.getByLabel("创建原因", { exact: true }).fill("验证创建窗错误反馈");
        const submit = dialog.locator("footer button.primary"), close = dialog.getByRole("button", { name: "关闭新建配额方案" });
        await submit.focus(); await page.keyboard.press("Enter"); await expect.poll(() => writes).toBe(1);
        await expect(submit).toBeDisabled(); await expect(submit).toHaveText("创建中…");
        check("one initial POST", writes, 1);
        check("pending disabled fields", await dialog.locator("input:disabled,textarea:disabled").count(), mode === "review" ? 7 : 0);
        check("pending close disabled", await close.isDisabled(), mode === "review");
        if (mode === "review") {
          await expect(dialog.getByRole("heading", { name: "创建配额方案草稿", exact: true })).toBeFocused();
          await expect(dialog.getByRole("status")).toContainText("请等待本次结果");
          check("pending persistent heading focus", true);
        }
        await dialog.locator("form").evaluate((form) => form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })));
        check("duplicate submit blocked", writes, 1);
        await page.evaluate(() => document.fonts.ready); await sequence("pending");
        await page.keyboard.press("Escape");
        if (mode === "review") { await expect(dialog).toBeVisible(); check("pending Escape keeps dialog open", true); }
        else { await expect(dialog).not.toBeVisible(); check("pending Escape keeps dialog open", false, false); await trigger.click(); await expect(dialog).toBeVisible(); }
        releaseWrite();
        await expect(submit).toBeEnabled();
        await expect(page.locator(".commercial > .notice")).toContainText(failureHint);
        check("error inside dialog", await dialog.getByText(failureHint, { exact: true }).count(), mode === "review" ? 1 : 0);
        check("error restores fields", await dialog.locator("input:disabled,textarea:disabled").count(), 0);
        await expect(dialog.getByLabel("方案名称", { exact: true })).toHaveValue("审核样例配额方案");
        check("error retains input", true);
        if (mode === "review") {
          await expect(dialog.getByRole("alert")).toContainText("本次创建未完成");
          await dialog.locator(".p58-draft-feedback summary").click();
          await expect(dialog.locator(".p58-draft-feedback code")).toHaveText("p58-create-" + scene);
          check("owned error request ID", await dialog.locator(".p58-draft-feedback code").textContent(), "p58-create-" + scene);
          await picture("error-feedback", dialog.locator(".p58-draft-feedback"));
        }
        await sequence("error");
        await submit.click(); await expect.poll(() => writes).toBe(2); await expect(submit).toBeEnabled();
        const posts = requests.filter((r) => r.key.startsWith("POST "));
        check("explicit retry keeps body", posts[1].body, posts[0].body);
        check("explicit retry keeps key", posts[1].idempotencyKey, posts[0].idempotencyKey);
        check("idempotency key present", Boolean(posts[0].idempotencyKey));
        check("exact create payload", JSON.parse(posts[0].body), { code: "basic_2026", name: "审核样例配额方案", description: "只用于本地拒绝状态验证", quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 }, reason: "验证创建窗错误反馈" });
        await dialog.getByRole("button", { name: "取消", exact: true }).click(); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
        check("cancel after rejection returns focus", true);
        check("one commercial GET", requests.filter((r) => r.key === "GET /api/v1/platform/commercial").length, 1);
        check("exact two explicit local POSTs", writes, 2);
        check("no unexpected network", unexpected, []); check("no runtime errors", errors, []);
        runs.push({ mode, width, scene, checks, requests });
` +
  runner.slice(flowEnd);
replace('kind: "P58-CREATE-CURRENT-REVIEW-r1"', 'kind: "P58-CREATE-WRITE-REVIEW-r1"');
replace(
  '"Actual App and existing E2E fixtures. Only create-dialog presentation/help and equivalent HTML-v pattern escaping in review. Production/GET/POST/API/permissions unchanged; no submit or real writes, no busy/error/save/complete-page acceptance."',
  '"Actual App and production createPlan with local held409/403 POST fixtures. Review-only busy fields/close guard, persistent heading focus and owned inline error. Original payload/single-flight/key and global notice preserved. Two explicit local rejected POSTs per run; no real writes, success/unknown-result/refresh/lifecycle/permission or production acceptance."',
);
replace(
  "本地样例，未提交。连续局部图覆盖滚动区域；不代表保存或完整页面验收。",
  "本地 POST 全部以409/403拒绝；没有真实写入。等待与失败为独立提案，不代表成功、未知结果或完整页面验收。",
);
replace("P58 实际 Vue 创建窗 · C 方向", "P58 实际 Vue 创建窗 · 等待与拒绝反馈");
runner =
  'import { previewCommercialCreateWrite } from "./lib/ui-phase2-commercial-create-write-preview.mjs";\n' +
  runner;
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (_, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
