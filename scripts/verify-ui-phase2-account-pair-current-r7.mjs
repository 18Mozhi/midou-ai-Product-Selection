import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const driver = "scripts/verify-ui-phase2-account-pair-app.mjs";
const wrapper = "scripts/verify-ui-phase2-account-pair-current-r7.mjs";
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
  '  "scripts/verify-ui-phase2-account-pair-app.mjs",',
  `  "scripts/verify-ui-phase2-account-pair-app.mjs",\n  "${wrapper}",\n  "${approvalFile}",`,
);
replace("const evidence = {", `const evidence = {\n    visualApproval: { decision: "${approval.visualApproval}", source: "${approvalFile}", sha256: "${approvalSha}" },`);
replace(
  "narrow approvals do not approve this whole composition.",
  "the user auto-approved remaining visual directions; action acceptance and production permissions remain unverified.",
);
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (_, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
process.argv = [...process.argv.slice(0, 2), "--capture", "--revision", "r7"];
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(
    (error.stack ?? error.message).replace(/data:text\/javascript;base64,[^:]+/g, "generated verifier"),
  );
  process.exitCode = 1;
}
