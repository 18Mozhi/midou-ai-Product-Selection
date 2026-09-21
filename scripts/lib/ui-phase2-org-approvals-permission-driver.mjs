import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { approvalsParentCurrentDriver } from "./ui-phase2-org-approvals-parent-current-driver.mjs";

export const permissionDriverBase = "scripts/lib/ui-phase2-org-approvals-parent-current-driver.mjs";
export const permissionDriverBaseHash =
  "e6cac68bfb0e461245dcb680ca539bc1cd7639dc578999753f474b16023f35eb";
export const permissionOutput = "output/playwright/p34-permission-vue-c-r1";
const url = pathToFileURL(
  path.resolve("scripts/lib/ui-phase2-org-approvals-permission-preview.mjs"),
).href;
export const permissionDriverEdits = [
  [
    '            await target.evaluate((n) => scrollTo({ top: scrollY + n.getBoundingClientRect().top - 90, behavior: "instant" }));',
    '            if (!scene.endsWith("-reload-focus")) await target.evaluate((n) => scrollTo({ top: scrollY + n.getBoundingClientRect().top - 90, behavior: "instant" }));',
  ],
  [
    'const output = "output/playwright/p34-parent-current-c-r3";',
    `const output = "${permissionOutput}";`,
  ],
  [
    "[approvalsParentFile, previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile))]",
    "[approvalsParentFile, previewApprovalsPermission(previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile)))]",
  ],
  [
    "[shellReviewCss, approvalsVueCss, approvalsParentFrameCss].map",
    "[shellReviewCss, approvalsVueCss, approvalsParentFrameCss, approvalsPermissionCss].map",
  ],
  [
    "const currentSources = new Set([...sources,",
    `const currentSources = new Set([...sources,
  "scripts/verify-ui-phase2-org-approvals-permission-vue.mjs",
  "scripts/lib/ui-phase2-org-approvals-permission-driver.mjs",
  "scripts/lib/ui-phase2-org-approvals-permission-preview.mjs", approvalsPermissionCss,`,
  ],
  ['kind: "P34-PARENT-CURRENT-C-r3",', 'kind: "P34-PERMISSION-VUE-C-r1",'],
  [
    '            await shot(name);\n            plan = { mode: "normal", marker: "original" };',
    `            await shot(name);
            if (failure.status === 403) {
              const permission = center.locator(".org-approval-permission-c"), trace = permission.locator("details");
              const readCount = reads.length;
              check(name + ": one permission region", await permission.count(), 1);
              check(name + ": approved permission title", await permission.locator("h3").textContent(), "当前无法查看审批内容");
              check(name + ": approved permission copy", await permission.locator(".org-approval-permission-copy").textContent(), "当前权限还不能读取这些内容。权限调整后，可以重新加载。");
              check(name + ": hidden content is not empty catalog", await permission.locator(".org-approval-permission-boundary").textContent(), "审批内容目前未显示，不代表记录或模板为空。");
              check(name + ": original duplicate state hidden", await center.locator(".org-admin-state").isVisible(), false);
              check(name + ": one accessible reload", await center.getByRole("button", { name: "重新加载", exact: true }).count(), 1);
              check(name + ": trace initially closed", await trace.getAttribute("open"), null);
              await trace.locator("summary").focus();
              await page.keyboard.press("Enter");
              check(name + ": native trace opens", await trace.getAttribute("open"), "");
              check(name + ": actual error retained", await trace.locator("p").textContent(), "隔离permission-forbidden读取失败 检查服务或权限后重新加载。");
              check(name + ": actual request id retained", await trace.locator("code").textContent(), "p34-permission-forbidden-" + target);
              await shot(name + "-details");
              await page.keyboard.press("Tab");
              check(name + ": Tab reaches reload", await permission.locator("button").evaluate((n) => n === document.activeElement && n.matches(":focus-visible")));
              check(name + ": reload is visible and unobscured", await permission.locator("button").evaluate((n) => {
                const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                return r.top >= 0 && r.bottom <= innerHeight && (hit === n || n.contains(hit));
              }));
              check(name + ": trace interaction is read-only", reads.length, readCount);
              await shot(name + "-reload-focus");
            }
            plan = { mode: "normal", marker: "original" };`,
  ],
  [
    '            await center\n              .getByRole("button", { name: replace ? "重新加载" : "刷新数据", exact: true })\n              .click();',
    `            if (failure.status === 403) await page.keyboard.press("Enter");
            else await center
              .getByRole("button", { name: replace ? "重新加载" : "刷新数据", exact: true })
              .click();`,
  ],
];
export function permissionVueDriver(input) {
  assert.equal(
    createHash("sha256")
      .update(readFileSync(permissionDriverBase, "utf8").replaceAll("\r\n", "\n"))
      .digest("hex"),
    permissionDriverBaseHash,
    "Inspect changed P34 r3 driver",
  );
  let source = approvalsParentCurrentDriver(input);
  for (const [before, after] of permissionDriverEdits) {
    assert.equal(source.split(before).length, 2, `One exact permission driver anchor: ${before}`);
    source = source.replace(before, after);
  }
  return (
    `import { approvalsPermissionCss, previewApprovalsPermission } from ${JSON.stringify(url)};\n` +
    source
  );
}
