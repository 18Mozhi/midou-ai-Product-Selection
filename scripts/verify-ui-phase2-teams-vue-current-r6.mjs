import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const driver = "scripts/verify-ui-phase2-teams-vue-c.mjs";
const wrapper = "scripts/verify-ui-phase2-teams-vue-current-r6.mjs";
const approvalFile = "design-plans/ui-phase-2-2026-09-07/action-reviews/P49.json";
const normalize = (text) => text.replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
let runner = normalize(await readFile(driver, "utf8"));
const approval = JSON.parse(await readFile(approvalFile, "utf8"));
assert.equal(approval.visualApproval, "user-approved-remaining-pages-auto");
const approvalSha = hash(normalize(await readFile(approvalFile, "utf8")));
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, `current capture anchor: ${before}`);
  runner = runner.replace(before, after);
}
replace(
  'const output = "output/playwright/p33-teams-vue-c-r5";',
  'const output = "output/playwright/p33-teams-vue-c-r6";',
);
replace('kind: "P33-ACTUAL-VUE-C-r5",', 'kind: "P33-ACTUAL-VUE-C-r6",');
replace(
  '  "scripts/verify-ui-phase2-teams-vue-c.mjs",',
  `  "scripts/verify-ui-phase2-teams-vue-c.mjs",\n  "${wrapper}",\n  "${approvalFile}",`,
);
replace(
  '    approval: "pending-user-review",',
  `    approval: "pending-user-review",\n    visualApproval: { decision: "${approval.visualApproval}", source: "${approvalFile}", sha256: "${approvalSha}" },`,
);
replace("本地样例，待审核。", "本地样例；视觉方向按用户全局授权自动通过，交互与生产验收仍未通过。");
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (_, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(
    (error.stack ?? error.message).replace(/data:text\/javascript;base64,[^:]+/g, "generated verifier"),
  );
  process.exitCode = 1;
}
