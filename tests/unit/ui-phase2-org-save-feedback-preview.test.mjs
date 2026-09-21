import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewOrgProfileForm } from "../../scripts/lib/ui-phase2-org-profile-form-preview.mjs";
import {
  previewOrgSaveFeedback,
  saveFeedbackReplacements,
  saveReceiptScript,
  buildProfileSaveResult,
} from "../../scripts/lib/ui-phase2-org-save-feedback-preview.mjs";
import { buildShellOrgFixture } from "../../scripts/lib/ui-phase2-shell-org-fixture.mjs";

const source = (
  await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8")
).replaceAll("\r\n", "\n");
const proposed = previewOrgSaveFeedback(source);
test("receipt proposal is reversible and keeps native form constraints and unrelated contracts", () => {
  let restored = proposed;
  for (const [before, after] of [...saveFeedbackReplacements].reverse()) {
    assert.equal(restored.split(after).length, 2);
    restored = restored.replace(after, before);
  }
  assert.equal(restored, previewOrgProfileForm(source));
  const descriptor = parse(proposed).descriptor;
  const compiled = compileScript(descriptor, { id: "org-save" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: "OrganizationAdminCenter.vue",
      id: "org-save",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
  assert.throws(() =>
    previewOrgSaveFeedback(
      source.replace(
        "const secretGeneration = tokenSecretGeneration",
        "const secretGeneration = 0",
      ),
    ),
  );
});
test("save fixture uses repository result fields rather than older E2E full-profile PATCH response", async () => {
  const { profile } = await buildShellOrgFixture();
  assert.deepEqual(await buildProfileSaveResult(profile), {
    id: profile.id,
    version: profile.version + 1,
    updated_at: new Date(profile.updated_at).toISOString(),
  });
});

function harness({ failed = false, token = false, heldWrite = false, heldRead = false } = {}) {
  const script = parse(proposed).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile("preview.ts", script, ts.ScriptTarget.Latest, true);
  const functions = ast.statements
    .filter((node) => ts.isFunctionDeclaration(node) && ["load", "submit"].includes(node.name.text))
    .map((node) => node.getText(ast));
  assert.equal(functions.length, 2);
  const ref = (value) => ({ value });
  let releaseWrite, releaseRead;
  const writeGate = new Promise((done) => {
    releaseWrite = done;
  });
  const readGate = new Promise((done) => {
    releaseRead = done;
  });
  class ApiError extends Error {
    constructor() {
      super("read failed");
      this.kind = "server";
      this.status = 500;
    }
  }
  const box = {
    ref,
    watch: () => {},
    onDeactivated: () => {},
    onBeforeUnmount: () => {},
    props: { routePath: token ? "/org-admin/tokens" : "/org-admin", organizationId: "org-local" },
    view: ref(token ? "tokens" : "summary"),
    data: ref({ name: "old", version: 3 }),
    summary: ref({ observed_at: "old" }),
    form: ref({ name: "draft", reason: "reason" }),
    state: ref("ready"),
    busy: ref(false),
    refreshing: ref(false),
    notice: ref(""),
    noticeKind: ref("info"),
    requestId: ref("initial"),
    secret: ref(""),
    lastReadFailureStatus: ref(500),
    ApiClientError: ApiError,
    calls: [],
    api: async (path, options) => {
      box.calls.push({ path, options });
      if (options) {
        if (heldWrite) await writeGate;
        return { data: {}, request_id: "write-id" };
      }
      if (heldRead) await readGate;
      if (failed) throw new ApiError();
      return { data: { observed_at: "new" }, request_id: "summary-id" };
    },
    readView: async () => ({
      value: {
        name: "new",
        version: 4,
        timezone: "Asia/Shanghai",
        data_retention_days: 365,
        default_workspace_id: "workspace",
      },
      requestId: "read-id",
    }),
    applyFailure: () => {
      box.notice.value = "read failed";
      box.noticeKind.value = "error";
      box.requestId.value = "failed-read-id";
    },
    rethrowUnexpectedError: (error) => {
      if (!(error instanceof ApiError)) throw error;
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      `let loadSequence=0;let tokenSecretGeneration=0;let surfaceActive=true;\n${saveReceiptScript}\n${functions.join("\n")}\nglobalThis.submit=submit;globalThis.receipt=profileSaveReceipt;globalThis.clear=clearProfileReceipt;globalThis.invalidate=()=>{loadSequence++};`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  return { box, releaseWrite, releaseRead };
}
test("per-read outcome preserves failed read ID and ignores stale lastReadFailureStatus on success", async () => {
  for (const failed of [false, true]) {
    const { box } = harness({ failed });
    assert.equal(await box.submit("/org/admin/profile", {}, "PATCH"), true);
    assert.equal(box.receipt.value.phase, failed ? "failed" : "ready");
    assert.equal(box.receipt.value.writeId, "write-id");
    assert.equal(box.receipt.value.readId, failed ? "failed-read-id" : "read-id");
    assert.equal(box.requestId.value, failed ? "failed-read-id" : "read-id");
    assert.equal(box.notice.value, failed ? "read failed" : "");
    assert.equal(box.form.value.reason, "");
    assert.equal(box.lastReadFailureStatus.value, 500);
  }
});
test("stale profile writes do not mutate new context or start a reread", async () => {
  const { box, releaseWrite } = harness({ heldWrite: true });
  const result = box.submit("/org/admin/profile", {}, "PATCH");
  box.clear();
  releaseWrite();
  assert.equal(await result, true);
  assert.equal(box.receipt.value, null);
  assert.equal(box.form.value.name, "draft");
  assert.equal(box.calls.length, 1);
});
test("superseded read cannot publish a receipt from stale data", async () => {
  const { box, releaseRead } = harness({ heldRead: true });
  const result = box.submit("/org/admin/profile", {}, "PATCH");
  await new Promise((done) => setImmediate(done));
  assert.equal(box.receipt.value.phase, "pending");
  box.invalidate();
  releaseRead();
  await result;
  assert.equal(box.receipt.value, null);
  assert.equal(box.data.value.name, "old");
});
test("non-profile submit retains existing generic success behavior", async () => {
  const { box } = harness({ token: true });
  assert.equal(await box.submit("/org/admin/tokens", {}, "POST"), true);
  assert.equal(box.receipt.value, null);
  assert.equal(box.notice.value, "操作已完成并写入审计。");
  assert.equal(box.requestId.value, "write-id");
});

test("save receipt packet binds current sources and separated write/read evidence", async () => {
  const root = "output/playwright/org-save-feedback-vue-c-r1";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "ORG-SAVE-FEEDBACK-VUE-C-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 12);
  assert.equal(evidence.screenshots.length, 24);
  assert.equal(Object.keys(evidence.sourceHashes).length, 183);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    const actual = (name) => run.checks.find((c) => c.name === name)?.actual;
    assert.equal(run.requests.filter((r) => r.key.startsWith("PATCH ")).length, 1);
    assert.equal(actual("manual reread never resaves"), 1);
    assert.equal(actual("manual reread once"), 3);
    assert.equal(actual("original request headers present"), true);
    assert.deepEqual(actual("no unexpected network"), []);
    assert.deepEqual(actual("no runtime errors"), []);
    if (run.mode === "review") {
      assert.equal(actual("no premature page updated claim"), true);
      assert.equal(actual("receipt phase"), run.status === 200 ? "ready" : "failed");
      assert.equal(actual("write trace preserved"), "org-save-local-write");
      assert.equal(actual("read trace separate"), `org-save-local-read-${run.status}`);
    } else assert.equal(actual("baseline overwrites reread result with generic success"), true);
  }
});
