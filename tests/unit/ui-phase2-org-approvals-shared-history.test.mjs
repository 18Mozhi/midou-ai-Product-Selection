import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  historicalShellFile,
  historicalStyleFile,
  beforeP34SharedChanges,
  assertP34LegacySourceHash,
} from "../../scripts/lib/ui-phase2-org-approvals-shared-history.mjs";

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
      "31d5fcdc44694c6a09a5121e5dee6c18f4dcdbdb4d4715021e28fb78ead7a26d",
    "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c":
      "0c96d81d75ccdf951b66adefb2bb46a3adfcc74331c1112b1c26e3c180edba54",
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

test("P34 shared-source reconstruction equals independently identified Git snapshots", () => {
  for (const [file, commit] of [
    [historicalShellFile, "af239b08b69f7d97cd0372f9840a70009eeef0c7"],
    [historicalStyleFile, "093d643b789cc887edd4762c8612dd3c8904560a^"],
  ]) {
    const source = read(file),
      old = execFileSync("git", ["show", `${commit}:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      );
    assert.equal(beforeP34SharedChanges(file, source), old);
    assertP34LegacySourceHash(file, source, evidence.sourceHashes[file]);
    assert.equal(hash(source), current.sourceHashes[file]);
    assert.notEqual(hash(source), evidence.sourceHashes[file]);
  }
});

test("partial, duplicate or extra shared-source changes still fail closed", () => {
  for (const [file, needle] of [
    [historicalShellFile, '  "!./PlatformNotificationFacts.vue",\n'],
    [historicalStyleFile, "  border-left-color: var(--so-danger);\n"],
  ]) {
    const source = read(file);
    for (const mutated of [
      source.replace(needle, ""),
      source.replace(needle, needle + needle),
      source + "\n/* unexpected */",
      source.replace(needle, needle.replace(";", "!important;").replace("Facts", "OtherFacts")),
    ])
      assert.throws(() => assertP34LegacySourceHash(file, mutated, evidence.sourceHashes[file]));
    assert.throws(() => assertP34LegacySourceHash(file, source, current.sourceHashes[file]));
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
