import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { computed, ref } from "vue";

const file = "apps/web/src/use-audited-reason.ts";
const source = readFileSync(file, "utf8");
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
function harness() {
  const box = { exports: {}, computed, ref };
  vm.runInNewContext(
    ts.transpileModule(
      ast.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getText(ast))
        .join("\n"),
      {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      },
    ).outputText,
    box,
  );
  return box.exports.useAuditedReason();
}
const plain = (v) => JSON.parse(JSON.stringify(v));
test("P32 presentation context does not alter default shared reason requests", async () => {
  const h = harness();
  const answer = h.ask({ title: "撤销邀请原因", initialValue: "撤销邀请" });
  assert.deepEqual(plain(h.request.value), {
    title: "撤销邀请原因",
    initialValue: "撤销邀请",
    description: "原因会写入审计记录。",
    minimumLength: 2,
  });
  h.cancel();
  assert.equal(h.request.value, null);
  assert.equal(await answer, null);
});
test("P32 restore metadata is a snapshot and is discarded before submission continues", async () => {
  const h = harness(),
    target = { name: "恢复对象", version: 3, memberCount: 0 };
  const answer = h.ask({ title: "恢复工作区原因", workspaceRestore: target });
  target.name = "后来对象";
  target.version = 4;
  assert.deepEqual(plain(h.request.value.workspaceRestore), {
    name: "恢复对象",
    version: 3,
    memberCount: 0,
  });
  h.submit("核验后恢复");
  assert.equal(h.open.value, false);
  assert.equal(h.request.value, null);
  assert.equal(await answer, "核验后恢复");
});
test("P32 restore context cannot leak into a replacement archive or another caller", async () => {
  const h = harness();
  const old = h.ask({ title: "恢复工作区原因", workspaceRestore: { name: "旧对象" } });
  const latest = h.ask({ title: "归档工作区原因", minimumLength: 4, initialValue: "归档工作区" });
  assert.equal(await old, null);
  assert.equal(h.request.value.workspaceRestore, undefined);
  assert.equal(h.request.value.minimumLength, 4);
  h.cancel();
  assert.equal(await latest, null);
});
test("P32 actual Vue evidence binds current production sources and adjacent caller checks", () => {
  const base = "output/playwright/p32-approved-restore-review";
  const proof = JSON.parse(readFileSync(`${base}/evidence.json`, "utf8"));
  const hash = (v) => createHash("sha256").update(v).digest("hex");
  for (const [f, sha] of Object.entries(proof.sourceHashes))
    assert.equal(hash(readFileSync(f, "utf8").replaceAll("\r\n", "\n")), sha, f);
  assert.equal(proof.screenshots.length, 20);
  for (const shot of proof.screenshots)
    assert.equal(hash(readFileSync(`${base}/${shot.file}`)), shot.sha256);
  for (const width of [1440, 390]) {
    const checks = proof.checks.filter((c) => c.width === width).map((c) => c.name);
    for (const name of [
      "no new upper length rule",
      "501 chars not truncated",
      "exact first POST",
      "busy prevents duplicate",
      "archive does not inherit restore style",
      "P30 does not inherit restore style",
      "reopening resets reason",
    ])
      assert.ok(checks.includes(name), name);
  }
});
