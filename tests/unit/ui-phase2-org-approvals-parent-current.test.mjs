import test from "node:test";
import {
  beforeP34OwnerPath,
  assertP34HistoricalSourceHash,
} from "../../scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import {
  approvalsParentBase,
  approvalsParentBaseHash,
  approvalsParentOutput,
  approvalsParentCurrentDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-parent-current-driver.mjs";
import {
  approvalsVueFile,
  previewApprovalsVue,
} from "../../scripts/lib/ui-phase2-org-approvals-vue-preview.mjs";
import { previewShellVue } from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import {
  approvalsParentFile,
  approvalsParentFrameAnchor,
  approvalsParentFrameReplacement,
  previewApprovalsParentFrame,
} from "../../scripts/lib/ui-phase2-org-approvals-parent-frame-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const base = read(approvalsParentBase),
  source = approvalsParentCurrentDriver(base);
function nodes(text, predicate) {
  const ast = ts.createSourceFile("driver.mjs", text, ts.ScriptTarget.Latest, true),
    result = [];
  const visit = (node) => {
    if (predicate(node)) result.push(node.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return result;
}
test("current-parent composition retains original failure and HTTP fixture logic", () => {
  assert.equal(hash(base), approvalsParentBaseHash);
  assert.throws(() => approvalsParentCurrentDriver(base + "\n"), /Inspect changed/);
  for (const name of ["failures", "wire", "waitState", "visit", "hold"]) {
    const predicate = (n) => ts.isVariableDeclaration(n) && n.name.getText() === name;
    assert.deepEqual(nodes(source, predicate), nodes(base, predicate), name);
  }
  const checks = (text) =>
    nodes(text, (n) => ts.isCallExpression(n) && n.expression.getText() === "check");
  const originalChecks = checks(base).filter(
    (c) => !c.includes('"no business dialogs fabricated"'),
  );
  for (const check of originalChecks) assert.ok(checks(source).includes(check), check);
  assert.match(source, /dialog\[open\]:not\(\.role-navigation-frame\)/);
  assert.match(source, /dialog:modal/);
  assert.match(source, /width > 840 \? 1 : 0/);
  assert.match(source, /includeImportedStyleSources\(currentSources/);
  assert.match(source, /server\.moduleGraph\.idToModuleMap/);
  assert.match(source, /finally \{\s*await browser\?\.close\(\)/);
  assert.match(source, /await mkdir\(output\);/);
  assert.match(source, /fullPage: false/);
});

test("current-parent unknown and combined flags fail without starting a service", () => {
  for (const args of [["--unknown"], ["--capture", "--smoke"], ["--smoke", "--smoke"]]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-org-approvals-parent-current.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
  }
});

test("historical P34 evidence and previously reviewed r4 packet remain byte-identical", () => {
  const historical = {
    "output/playwright/p34-parent-current-c-r2/evidence.json":
      "cbed8b21cdd66f8c102286afb242a04b445ec5a48cff55fed4fbd98fa6ffd9b7",
    "output/playwright/p34-parent-read-states/evidence.json":
      "31d5fcdc44694c6a09a5121e5dee6c18f4dcdbdb4d4715021e28fb78ead7a26d",
    "output/playwright/p34-mobile-template-filters/evidence.json":
      "5f8afd90d4e31e1f5ab83ebe8a622c475bb153ad5c870485074535ef5ae47e6b",
    "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c/evidence.json":
      "0c96d81d75ccdf951b66adefb2bb46a3adfcc74331c1112b1c26e3c180edba54",
    "output/playwright/p34-permission-tone-r2/evidence.json":
      "a8c68010fc27e7998ff14a8d95e9a4d697bc97744c8a622a41cb6473565835c3",
    "output/playwright/p34-rate-limit-vue/evidence.json":
      "75ba85c1dd9a2533d59657ebca39804b4443a2abd29ed8b476f4eaa3e258e388",
    "output/playwright/p34-approvals-vue-c-r4/evidence.json":
      "964863ad52207745c61d701db6dab99c02917d85c59f4cabea6819cc78b430a4",
  };
  for (const [file, expected] of Object.entries(historical)) {
    const bytes = readFileSync(file);
    assert.equal(hash(bytes), expected, file);
    for (const image of JSON.parse(bytes).screenshots) {
      const imagePath = file.replace(/evidence\.json$/, image.file);
      assert.equal(hash(readFileSync(imagePath)), image.sha256, imagePath);
    }
  }
});

test("parent frame composition changes only a display hook, not error or permission logic", () => {
  const original = read(approvalsParentFile),
    revised = previewApprovalsParentFrame(original);
  assert.equal(
    revised.replace(approvalsParentFrameReplacement, approvalsParentFrameAnchor),
    original,
  );
  const before = parse(original).descriptor,
    after = parse(revised).descriptor;
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: approvalsParentFile,
      id: "p34-parent-frame",
    }).errors,
    [],
  );
});

test("historical parent r3 packet binds its source lineage and two-endpoint failure matrix", () => {
  const e = JSON.parse(read(`${approvalsParentOutput}/evidence.json`));
  assert.equal(e.kind, "P34-PARENT-CURRENT-C-r3");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 182);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, read(file), expected);
  assert.equal(
    e.transformedHashes[approvalsVueFile],
    hash(previewApprovalsVue(beforeP34OwnerPath(approvalsVueFile, read(approvalsVueFile)))),
  );
  const shell = "apps/web/src/components/NavigationShell.vue";
  assert.equal(e.transformedHashes[shell], hash(previewShellVue(read(shell))));
  assert.equal(
    e.transformedHashes[approvalsParentFile],
    hash(
      previewApprovalsParentFrame(
        beforeP34OwnerPath(approvalsParentFile, read(approvalsParentFile)),
      ),
    ),
  );
  assert.equal(e.checks.length, 790);
  assert.equal(e.scenarios.length, 56);
  assert.deepEqual(
    e.failures.map((f) => f.status),
    [500, 503, 409, 429, 401, 403, 0],
  );
  for (const width of [1440, 390]) {
    for (const target of ["summary", "approvals"]) {
      for (const phase of ["initial", "background"]) {
        for (const failure of e.failures) {
          const group = e.scenarios.filter(
            (s) =>
              s.width === width &&
              s.target === target &&
              s.phase === phase &&
              s.failure === failure.id,
          );
          assert.equal(group.length, 1);
          const replaces = phase === "initial" || [401, 403].includes(failure.status);
          assert.equal(group[0].childVisible, !replaces);
          assert.equal(group[0].state, replaces ? failure.state : "ready");
          assert.equal(group[0].attempts, failure.attempts);
          assert.equal(group[0].recovery, "passed");
        }
      }
    }
    assert.deepEqual(
      e.requestCounts.find((r) => r.width === width),
      { width, parentReads: 168, writes: 0 },
    );
    for (const name of [
      "no business writes",
      "no unmatched or external requests",
      "no page errors",
      "no business dialogs fabricated",
      "only desktop navigation container remains open",
      "no unexpected modal blocks content",
      "selected C view is keyboard focused",
      "selected C view focus contrasts with selected background",
      "selected C view focus target is visible and unobscured",
    ])
      assert.ok(e.checks.some((c) => c.width === width && c.name === name));
  }
  assert.equal(e.screenshots.length, 64);
  assert.equal(new Set(e.screenshots.map((s) => s.file)).size, 64);
  for (const image of e.screenshots) {
    const bytes = readFileSync(`${approvalsParentOutput}/${image.file}`);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.width === 390 ? 844 : 1000);
  }
});

test("current parent packet cannot be overwritten by capture", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-parent-current.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /EEXIST/);
});
