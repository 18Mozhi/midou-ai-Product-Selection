import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { buildProfileSaveResult } from "../../scripts/lib/ui-phase2-org-save-feedback-preview.mjs";

const componentPath = "apps/web/src/components/OrganizationAdminCenter.vue";
const source = (await readFile(componentPath, "utf8")).replaceAll("\r\n", "\n");

test("production profile receipt compiles and exposes bounded accessible states", () => {
  const descriptor = parse(source).descriptor;
  const compiled = compileScript(descriptor, { id: "org-save-receipt" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: componentPath,
      id: "org-save-receipt",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
  assert.match(source, /type ProfileSaveReceipt = \{[\s\S]*?"pending" \| "ready" \| "failed"/);
  assert.match(source, /class="org-profile-receipt"/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /<summary>保存与读取追踪<\/summary>/);
  assert.match(source, /:disabled="Boolean\(profileSaveReadFailure\)"/);
});

test("profile save receipt preserves write/read identity and invalidates stale ownership", () => {
  const script = parse(source).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile(
    "OrganizationAdminCenter.vue.ts",
    script,
    ts.ScriptTarget.Latest,
    true,
  );
  assert.match(script, /profileSaveReceipt = ref<ProfileSaveReceipt \| null>\(null\)/);
  assert.match(script, /readRequestId: viewResponse\.requestId/);
  assert.match(script, /phase: "failed",\s*readRequestId: failure\?\.requestId/);
  assert.match(
    script,
    /ownsProfileWrite = \(\) => surfaceActive && receiptGeneration === profileReceiptGeneration/,
  );
  assert.match(script, /if \(isProfileSave && !ownsProfileWrite\(\)\) return true/);
  const receiptReferences = ast.statements.filter((statement) =>
    statement.getText(ast).includes("clearProfileReceipt"),
  );
  assert.ok(receiptReferences.length >= 1);
});

test("profile receipt reports the repository's actual PATCH result shape", async () => {
  const profile = {
    id: "org-local",
    version: 3,
    updated_at: "2026-10-05T09:00:00.000Z",
  };
  assert.deepEqual(await buildProfileSaveResult(profile), {
    id: profile.id,
    version: profile.version + 1,
    updated_at: new Date(profile.updated_at).toISOString(),
  });
});

test("approved r2 review packet remains byte-integral as frozen historical evidence", async () => {
  const root = "output/playwright/org-save-feedback-vue-c-r2";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "ORG-SAVE-FEEDBACK-VUE-C-r2");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "user-approved-remaining-pages-auto");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 12);
  assert.equal(evidence.screenshots.length, 24);
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
});
