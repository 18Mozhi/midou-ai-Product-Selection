import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import { historicalOrganizationActionSource } from "../../scripts/lib/ui-phase2-organization-action-baseline.mjs";
import test from "node:test";
import { historicalFilterResetSource } from "../../scripts/lib/ui-phase2-filter-reset-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const output = "output/playwright/p39-create-user-preview";
// Frozen visual/diagnostic captures use their exact pre-repair source, not current acceptance.
const read = (f) =>
  historicalAdminResultsSource(f, historicalOrganizationActionSource(f, readFileSync(f, "utf8")));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const style = "design-plans/ui-phase-2-2026-09-07/implementation/account-create-preview.css";
const script = "scripts/verify-ui-phase2-account-create-preview.mjs";
test("Historical P39 creation preview preserves its original production source or native validation contract", () => {
  for (const file of [
    "PlatformAccountCenter.vue",
    "PlatformAccountDialogs.vue",
    "PlatformAccountDialogs.css",
  ]
    .map((f) => "apps/web/src/components/" + f)
    .concat(["apps/web/src/use-modal-dialog.ts", "apps/web/src/api-client.ts"])) {
    assert.equal(
      read(file),
      execFileSync("git", ["show", `797e8af3:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
      file,
    );
  }
  const host = read(script);
  assert.doesNotMatch(host, /\btransform\s*\(|innerHTML\s*=|\.setCustomValidity\(/);
  assert.doesNotMatch(read("apps/web/src/main.ts"), /account-create-preview/);
  assert.doesNotMatch(read(style), /!important|:user-invalid|:invalid/);
  assert.match(
    read(style),
    /html body\.p39-create-preview #app dialog\[aria-label="新建用户或平台管理员"\]/,
  );
});
test("P39 creation exact42 PNG and121 browser checks retain captured source revisions", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.match(e.scope, /Original current Vue parent and child scripts\/templates/);
  assert.equal(e.checks.length, 121);
  assert.equal(e.screenshots.length, 42);
  assert.deepEqual(
    e.requestsByWidth.map((r) => r.width),
    [390, 760, 761, 1440],
  );
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(historicalFilterResetSource(file, read(file))), sha, file);
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${output}/${s.file}`);
    assert.equal(hash(bytes), s.sha256);
    assert.equal(s.kind, "vue-isolated-css");
    assert.equal(s.sourceSha, hash(JSON.stringify(e.sourceHashes)));
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
  }
  assert.equal(e.screenshots.filter((s) => s.viewport.height === 568).length, 2);
});
test("P39 simulated writes preserve five fields and nullable defaults without retaining test password text", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  for (const group of e.requestsByWidth) {
    assert.deepEqual(
      group.requests.map((r) => r.method),
      ["GET", "POST", "GET", "GET", "POST", "GET"],
    );
    const writes = group.requests.filter((r) => r.method === "POST");
    for (const w of writes) {
      assert.equal(w.path, "/api/v1/platform/accounts/users");
      assert.equal(w.idempotencyKeyPresent, true);
      assert.equal(w.body.temporary_password, "[known synthetic value matched]");
      assert.deepEqual(
        Object.keys(w.body).sort(),
        [
          "email",
          "temporary_password",
          "platform_role_code",
          "organization_id",
          "organization_role_code",
        ].sort(),
      );
    }
    assert.equal(writes[0].body.organization_role_code, "organization_admin");
    assert.ok(writes[0].body.organization_id);
    assert.equal(writes[1].body.organization_id, null);
    assert.equal(writes[1].body.platform_role_code, null);
    assert.equal(writes[1].body.organization_role_code, "member");
  }
  assert.doesNotMatch(read(`${output}/evidence.json`), /PreviewOnly-123/);
});
test("prior P39 proposal86 PNG and filter18 PNG remain unchanged", () => {
  for (const folder of [
    "design-plans/ui-phase-2-2026-09-07/design/account-overview-direction-c",
    "output/playwright/p39-filter-preview",
  ]) {
    const old = JSON.parse(
      execFileSync("git", ["show", `797e8af3:${folder}/evidence.json`], { encoding: "utf8" }),
    );
    assert.equal(
      read(`${folder}/evidence.json`),
      execFileSync("git", ["show", `797e8af3:${folder}/evidence.json`], {
        encoding: "utf8",
      }).replaceAll("\r\n", "\n"),
    );
    for (const s of old.screenshots)
      assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256);
  }
});
