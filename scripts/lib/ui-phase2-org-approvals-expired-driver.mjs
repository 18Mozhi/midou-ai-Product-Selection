import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import {
  permissionVueDriver,
  permissionDriverEdits,
} from "./ui-phase2-org-approvals-permission-driver.mjs";

export const expiredOutput = "output/playwright/p34-expired-vue-c-r1";
export function expiredVueDriver(input) {
  assert.equal(
    createHash("sha256")
      .update(
        readFileSync(
          "scripts/lib/ui-phase2-org-approvals-permission-driver.mjs",
          "utf8",
        ).replaceAll("\r\n", "\n"),
      )
      .digest("hex"),
    "e886e563e7851791084b1102b459a5b842b7a6ad8efc50c627e05d0b20f2a270",
  );
  let source = permissionVueDriver(input);
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `One expired driver anchor: ${before}`);
    source = source.replace(before, after);
  };
  replace(
    'const output = "output/playwright/p34-permission-vue-c-r1";',
    `const output = "${expiredOutput}";`,
  );
  replace(
    "previewApprovalsPermission(previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile)))",
    "previewApprovalsExpired(previewApprovalsPermission(previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile))))",
  );
  replace(
    "const currentSources = new Set([...sources,",
    `const currentSources = new Set([...sources,
  "scripts/lib/ui-phase2-org-approvals-expired-preview.mjs",
  "scripts/lib/ui-phase2-org-approvals-expired-driver.mjs",
  "scripts/verify-ui-phase2-org-approvals-expired-vue.mjs",`,
  );
  replace('kind: "P34-PERMISSION-VUE-C-r1",', 'kind: "P34-EXPIRED-VUE-C-r1",');
  replace(
    "approvalsParentFrameCss, approvalsPermissionCss].map",
    "approvalsParentFrameCss, approvalsPermissionCss, approvalsExpiredCss].map",
  );
  replace(
    '"scripts/verify-ui-phase2-org-approvals-expired-vue.mjs",',
    '"scripts/verify-ui-phase2-org-approvals-expired-vue.mjs", approvalsExpiredCss,',
  );
  // Reuse the pinned keyboard sequence, retaining every existing permission assertion.
  const sequence = permissionDriverEdits.find(([before]) =>
    before.startsWith("            await shot(name);"),
  )[1];
  const start = sequence.indexOf("            if (failure.status === 403) {");
  const end = sequence.lastIndexOf('            plan = { mode: "normal", marker: "original" };');
  const expiredSequence = sequence
    .slice(start, end)
    .replaceAll("failure.status === 403", "failure.status === 401")
    .replaceAll('".org-approval-permission-c"', '".org-approval-expired-c"')
    .replaceAll("one permission region", "one expired region")
    .replaceAll("approved permission title", "existing expired title")
    .replaceAll("approved permission copy", "existing expired copy")
    .replaceAll("当前无法查看审批内容", "登录已失效")
    .replaceAll(
      "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
      "重新登录后返回当前页面。",
    )
    .replaceAll("permission-forbidden", "session-expired");
  replace(sequence, sequence.slice(0, end) + expiredSequence + sequence.slice(end));
  replace(
    '            if (failure.status === 403) await page.keyboard.press("Enter");',
    '            if ([401, 403].includes(failure.status)) await page.keyboard.press("Enter");',
  );
  replace("[500, 403, 0]", "[401, 403]");
  const url = pathToFileURL(
    path.resolve("scripts/lib/ui-phase2-org-approvals-expired-preview.mjs"),
  ).href;
  return (
    `import { approvalsExpiredCss, previewApprovalsExpired } from ${JSON.stringify(url)};\n` +
    source
  );
}
