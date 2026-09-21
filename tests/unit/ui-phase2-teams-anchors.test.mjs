import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import {
  teamsAnchorBase,
  teamsAnchorDriver,
  teamsAnchorEdits,
  teamsAnchorScenario,
} from "../../scripts/lib/ui-phase2-teams-anchor-driver.mjs";

const base = readFileSync(teamsAnchorBase, "utf8").replaceAll("\r\n", "\n");
const composed = teamsAnchorDriver(base);

test("anchor checks compose without changing original r4 checks or fixture wiring", () => {
  let changed = base;
  for (const [before, after] of teamsAnchorEdits) changed = changed.replace(before, after);
  for (const [before, after] of [...teamsAnchorEdits].reverse()) {
    assert.equal(changed.split(after).length, 2);
    changed = changed.replace(after, before);
  }
  assert.equal(changed, base);
  const ast = ts.createSourceFile("anchors.mjs", composed, ts.ScriptTarget.Latest, true);
  assert.equal(ast.parseDiagnostics.length, 0);
  for (const n of ast.statements.filter(ts.isImportDeclaration))
    assert.match(n.moduleSpecifier.text, /^(node:|file:)/);
  assert.match(composed, /const capture = false/);
  assert.match(composed, /GET only, no bodies/);
  assert.match(composed, /one teams read/);
});

test("anchor verification covers native keyboard continuation, identity, drafts and history", () => {
  for (const token of [
    ".click()",
    'press("Enter")',
    'press("Tab")',
    "goBack()",
    "goForward()",
    "isConnected",
    "team-reason",
    "team-member-select",
    ":focus-visible",
    "elementFromPoint",
  ])
    assert.ok(teamsAnchorScenario.includes(token), token);
  assert.doesNotMatch(teamsAnchorScenario, /\.fill\(|\.selectOption\(|submit|route\.fulfill/);
});

test("unknown source changes fail before launching a browser", () => {
  assert.throws(() => teamsAnchorDriver(base + "\n"), /Inspect changed P33/);
  assert.equal(teamsAnchorDriver(base.replaceAll("\n", "\r\n")), composed);
});

test("anchor runner rejects capture and unknown args without creating files or a server", () => {
  for (const arg of ["--capture", "--unknown"]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-teams-anchors.mjs", arg],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /data:text\/javascript;base64/);
  }
});
