import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  historicalShellFile,
  historicalStyleFile,
  beforeP34SharedChanges,
  assertP34LegacySourceHash,
} from "../../scripts/lib/ui-phase2-org-approvals-shared-history.mjs";
import { assertCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const evidence = JSON.parse(read("output/playwright/p34-parent-read-states/evidence.json"));
const current = JSON.parse(read("output/playwright/p34-route-lifecycle-vue-c-r1/evidence.json"));

test("the five legacy manifests and their listed pictures remain immutable", () => {
  const packets = {
    "output/playwright/p34-mobile-template-filters":
      "5f8afd90d4e31e1f5ab83ebe8a622c475bb153ad5c870485074535ef5ae47e6b",
    "output/playwright/p34-rate-limit-vue":
      "75ba85c1dd9a2533d59657ebca39804b4443a2abd29ed8b476f4eaa3e258e388",
    "output/playwright/p34-parent-read-states":
      "d30d2fbf8f178d33123b95252524cdc54273aae3f94d8e7383cc54220d857ecd",
    "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c":
      "80ea91b7f0fd1376eaeb4d20ac83edea9382b4502e496a1ed2f9f463270c7cec",
    "output/playwright/p34-permission-tone-r2":
      "a8c68010fc27e7998ff14a8d95e9a4d697bc97744c8a622a41cb6473565835c3",
  };
  for (const [folder, expected] of Object.entries(packets)) {
    const bytes = readFileSync(folder + "/evidence.json");
    assert.equal(hash(bytes), expected, folder);
    for (const image of JSON.parse(bytes).screenshots)
      assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256, image.file);
  }
});

test("P34 legacy and current shared sources remain exact Git-history revisions", () => {
  for (const file of [historicalShellFile, historicalStyleFile]) {
    const source = read(file);
    assertCaptureSourceRevision(file, source, evidence.sourceHashes[file]);
    assertCaptureSourceRevision(file, source, current.sourceHashes[file]);
    assertP34LegacySourceHash(file, source, evidence.sourceHashes[file]);
    assert.notEqual(evidence.sourceHashes[file], current.sourceHashes[file]);
  }
});

test("mutated shared sources cannot borrow legacy hashes from another Git revision", () => {
  for (const file of [historicalShellFile, historicalStyleFile]) {
    const source = read(file);
    for (const mutated of [source + "\n/* unexpected */", source.replace(/^./u, "_")])
      assert.throws(() => assertP34LegacySourceHash(file, mutated, evidence.sourceHashes[file]));
    assertCaptureSourceRevision(file, source, current.sourceHashes[file]);
  }
});

test("unrelated files are not altered and existing P34 ownership inverse remains bounded", () => {
  assert.equal(beforeP34SharedChanges("unknown.css", "abc\r\n"), "abc\n");
  assertP34LegacySourceHash("unknown.css", "abc", hash("abc"));
  assert.throws(() => assertP34LegacySourceHash("unknown.css", "abcd", hash("abc")));
  for (const file of [
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/components/OrganizationApprovalPanel.vue",
  ])
    assertP34LegacySourceHash(file, read(file), evidence.sourceHashes[file]);
});
