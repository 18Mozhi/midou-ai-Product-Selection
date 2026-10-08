import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const surface = process.argv[2];
const revision = process.argv[3];
const configurations = {
  profile: {
    driver: "scripts/verify-ui-phase2-org-profile-form-vue-c.mjs",
    wrapper: "scripts/verify-ui-phase2-org-current-captures.mjs",
    outputBefore: "output/playwright/org-profile-form-vue-c-r3",
    outputPrefix: "output/playwright/org-profile-form-vue-c",
    kindBefore: "ORG-PROFILE-FORM-VUE-C-r3",
    kindPrefix: "ORG-PROFILE-FORM-VUE-C",
  },
  readState: {
    driver: "scripts/verify-ui-phase2-org-read-state-vue-c.mjs",
    wrapper: "scripts/verify-ui-phase2-org-current-captures.mjs",
    outputBefore: "output/playwright/org-read-state-vue-c-r1",
    outputPrefix: "output/playwright/org-read-state-vue-c",
    kindBefore: "ORG-READ-STATE-VUE-C-r1",
    kindPrefix: "ORG-READ-STATE-VUE-C",
  },
  refresh: {
    driver: "scripts/verify-ui-phase2-org-refresh-vue-c.mjs",
    wrapper: "scripts/verify-ui-phase2-org-current-captures.mjs",
    outputBefore: "output/playwright/org-refresh-vue-c-r1",
    outputPrefix: "output/playwright/org-refresh-vue-c",
    kindBefore: "ORG-REFRESH-VUE-C-r1",
    kindPrefix: "ORG-REFRESH-VUE-C",
  },
};
assert.ok(Object.hasOwn(configurations, surface), "Use profile, readState, or refresh.");
assert.match(revision ?? "", /^r[1-9]\d*$/, "Provide a new revision such as r9.");
const config = configurations[surface];
const outputAfter = `${config.outputPrefix}-${revision}`;
const kindAfter = `${config.kindPrefix}-${revision}`;
const approvalFile = "design-plans/ui-phase-2-2026-09-07/action-reviews/P49.json";
const normalize = (text) => text.replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
let runner = normalize(await readFile(config.driver, "utf8"));
const approval = JSON.parse(await readFile(approvalFile, "utf8"));
assert.equal(approval.visualApproval, "user-approved-remaining-pages-auto");
const approvalSha = hash(normalize(await readFile(approvalFile, "utf8")));
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, `current capture anchor: ${before}`);
  runner = runner.replace(before, after);
}
replace(`const output = "${config.outputBefore}";`, `const output = "${outputAfter}";`);
replace(`kind: "${config.kindBefore}",`, `kind: "${kindAfter}",`);
replace(
  `  "${config.driver}",`,
  `  "${config.driver}",\n  "${config.wrapper}",\n  "${approvalFile}",`,
);
replace(
  '    userReview: "pending",',
  `    userReview: "pending",\n    visualApproval: { decision: "${approval.visualApproval}", source: "${approvalFile}", sha256: "${approvalSha}" },`,
);
const staleHeading = ".org-admin-hero h2";
if (surface === "profile") {
  assert.ok(!runner.includes(staleHeading), `${config.driver}: unexpected heading selector`);
} else {
  assert.ok(runner.includes(staleHeading), `${config.driver}: heading selector was not found`);
  runner = runner.replaceAll(staleHeading, ".org-admin-hero :is(h1, h2)");
}
if (surface === "profile") {
  const staleButton = ".org-admin-grid > form > button";
  assert.ok(runner.includes(staleButton), `${config.driver}: submit selector was not found`);
  runner = runner.replaceAll(staleButton, ".org-admin-grid > form fieldset > button");
  assert.ok(!runner.includes(staleButton), `${config.driver}: stale submit selector remains`);
}
replace(
  "本地测试样例，待审核；只核对展示区域",
  "本地测试样例；视觉方向已按全局批准，交互/真实权限及生产验收仍待验证；只核对展示区域",
);
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (_, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
process.argv = [...process.argv.slice(0, 2), "--capture"];
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(
    (error.stack ?? error.message).replace(
      /data:text\/javascript;base64,[^:]+/g,
      "generated verifier",
    ),
  );
  process.exitCode = 1;
}
