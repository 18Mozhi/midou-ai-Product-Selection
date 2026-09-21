import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import {
  accountPairLifecycleDriver,
  originalAccountLifecycleDriver,
  pairLifecycleEdits,
} from "../../scripts/lib/ui-phase2-account-pair-lifecycle-driver.mjs";
import {
  accountPairLifecyclePreview,
  pairCompositionPacket,
  pairCompositionHash,
} from "../../scripts/lib/ui-phase2-account-pair-lifecycle-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
function neutralImports(source) {
  const ast = ts.createSourceFile("driver.mjs", source, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements.filter(ts.isImportDeclaration).reverse())
    source =
      source.slice(0, node.moduleSpecifier.getStart(ast)) +
      '"IMPORT"' +
      source.slice(node.moduleSpecifier.end);
  return source;
}
test("C composition preserves original flow apart from explicit navigation-aware dialog closure", () => {
  const original = read(originalAccountLifecycleDriver);
  let transformed = accountPairLifecycleDriver(original);
  const ast = ts.createSourceFile("driver.mjs", transformed, ts.ScriptTarget.Latest, true);
  assert.ok(
    ast.statements[0].moduleSpecifier.text.endsWith(
      "/ui-phase2-account-pair-lifecycle-preview.mjs",
    ),
  );
  transformed = transformed.slice(ast.statements[0].end + 1);
  for (const [before, after] of [...pairLifecycleEdits].reverse()) {
    assert.equal(transformed.split(after).length, 2);
    transformed = transformed.replace(after, before);
  }
  assert.equal(neutralImports(transformed), neutralImports(original));
  assert.throws(
    () =>
      accountPairLifecycleDriver(original.replace("replacement remains open", "other assertion")),
    /Original actual App lifecycle driver changed/,
  );
});

const packet = "output/playwright/account-pair-c-lifecycle-r2";
const manifestHash = "716fe28fc63aa9568558d79e754f56fecb63aa086750384e27d0ec463f42831d";
const hash = (value) => createHash("sha256").update(value).digest("hex");
test("C lifecycle capture retains every original result plus strict desktop navigation inventory", () => {
  const bytes = readFileSync(`${packet}/evidence.json`);
  assert.equal(hash(bytes), manifestHash);
  const evidence = JSON.parse(bytes);
  const original = JSON.parse(read("output/playwright/p43-actual-app-lifecycle-r1/evidence.json"));
  assert.equal(evidence.runs.length, 16);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    240,
  );
  assert.equal(evidence.screenshots.length, 48);
  assert.equal(evidence.reviewComposition.sha256, pairCompositionHash);
  assert.equal(evidence.designApproval, "r2_whole_layout_pending");
  assert.equal(evidence.processesClosed, true);
  for (let index = 0; index < evidence.runs.length; index++) {
    const run = evidence.runs[index],
      previous = original.runs[index];
    assert.deepEqual(
      [run.width, run.action, run.destination, run.outcome],
      [previous.width, previous.action, previous.destination, previous.outcome],
    );
    assert.deepEqual(
      run.checks.filter(
        (check) => check.name !== "only expected non-modal desktop navigation remains",
      ),
      previous.checks,
    );
    assert.deepEqual(
      run.checks.find(
        (check) => check.name === "only expected non-modal desktop navigation remains",
      ).actual,
      run.width > 840 ? [{ label: "工作台导航", modal: false, inAccounts: false }] : [],
    );
    assert.equal(run.requests.filter((request) => request.key.startsWith("POST ")).length, 1);
    // Navigation may overlap existing loadAccounts' refreshing guard. Do not claim cumulative GET totals are identical.
    assert.deepEqual(
      [...new Set(run.requests.map((request) => request.key))].sort(),
      [...new Set(previous.requests.map((request) => request.key))].sort(),
    );
  }
  assert.equal(Object.keys(evidence.sourceHashes).length, 183);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), sha, `Captured current source drift: ${file}`);
  for (const shot of evidence.screenshots) {
    assert.match(shot.file, /^[a-z0-9-]+\.png$/);
    const png = readFileSync(`${packet}/${shot.file}`);
    assert.equal(hash(png), shot.sha256);
    assert.equal(png.readUInt32BE(16), shot.pixelWidth);
    assert.equal(png.readUInt32BE(20), shot.pixelHeight);
  }
});

test("completed C lifecycle packet rejects capture before starting a service", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-account-pair-lifecycle.mjs", "--capture"],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EEXIST/);
  assert.ok(!result.stdout.includes("actual App lifecycle http"));
  assert.ok(!result.stderr.includes("data:text/javascript;base64,"));
  assert.equal(hash(readFileSync(`${packet}/evidence.json`)), manifestHash);
});

test("preview plugin produces the exact four pending r2 components and same CSS host", async () => {
  const sources = new Set();
  const review = await accountPairLifecyclePreview(read, sources);
  const evidence = JSON.parse(read(pairCompositionPacket));
  assert.equal(review.metadata.sha256, pairCompositionHash);
  assert.deepEqual(review.metadata.transformedHashes, evidence.transformedHashes);
  const html = review.plugin.transformIndexHtml("<html><head></head><body></body></html>");
  assert.ok(html.includes("p44-role-review p44-assembled"));
  assert.equal((html.match(/rel="stylesheet"/g) ?? []).length, 6);
  assert.ok(sources.has("apps/web/src/components/NavigationShell.vue"));
  assert.ok(sources.has("scripts/verify-ui-phase2-account-pair-lifecycle.mjs"));
  assert.equal(review.plugin.transform("unrelated", "unrelated.vue"), null);
});

test("composition rejects changed review metadata or any source drift before browser startup", async () => {
  await assert.rejects(
    accountPairLifecyclePreview(
      (file) => (file === pairCompositionPacket ? read(file) + " " : read(file)),
      new Set(),
    ),
    /Original C r2 review packet changed/,
  );
  await assert.rejects(
    accountPairLifecyclePreview(
      (file) =>
        file.endsWith("account-pair-app-preview.css") ? read(file) + "\n/* drift */" : read(file),
      new Set(),
    ),
    /C r2 composition source drift/,
  );
});
