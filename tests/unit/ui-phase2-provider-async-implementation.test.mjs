import { historicalAdapterCSource } from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import ts from "typescript";
import { historicalProviderFeedbackSource } from "../../scripts/lib/ui-phase2-provider-feedback-baseline.mjs";
import {
  historicalProviderAsyncSource,
  providerAsyncRevisions,
} from "../../scripts/lib/ui-phase2-provider-async-baseline.mjs";

const read = (f) =>
  historicalProviderFeedbackSource(f, historicalAdapterCSource(f, readFileSync(f, "utf8")));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const file = "apps/web/src/components/ProviderRegistry.vue",
  current = read(file),
  old = historicalProviderAsyncSource(file, current);
const folder = "output/playwright/p46-provider-async-implementation";
const evidence = (mode) => JSON.parse(read(folder + "/" + mode + "/evidence.json"));
const ast = (s) =>
  ts.createSourceFile(file, parse(s).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
function sourceFunction(s, name) {
  const tree = ast(s);
  const nodes = tree.statements.filter((n) => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.equal(nodes.length, 1);
  return { node: nodes[0], tree };
}

test("P46 async implementation preserves request serialization, business helpers,23 models and prior focus", () => {
  const r = providerAsyncRevisions.find((r) => r.file === file);
  assert.equal(hash(current), r.after);
  assert.equal(hash(old), r.before);
  for (const name of ["closeEditor", "applyTemplate", "nextStep", "resetFilters"]) {
    const a = sourceFunction(current, name),
      b = sourceFunction(old, name);
    assert.equal(a.node.getText(a.tree), b.node.getText(b.tree), name);
  }
  const body = (s) => {
    const { node, tree } = sourceFunction(s, "save");
    const statements = node.body.statements
      .filter(ts.isVariableStatement)
      .filter((n) => n.declarationList.declarations.some((d) => d.name.getText(tree) === "body"));
    assert.equal(statements.length, 1);
    return statements[0].getText(tree);
  };
  assert.equal(body(current), body(old));
  const initializer = (s, name) => {
    const tree = ast(s);
    const matches = tree.statements
      .filter(ts.isVariableStatement)
      .flatMap((n) => [...n.declarationList.declarations])
      .filter((d) => d.name.getText(tree) === name);
    assert.equal(matches.length, 1, name);
    return matches[0].initializer.getText(tree);
  };
  for (const name of ["validHttpUrl", "formErrors", "steps", "stepForField", "form"])
    assert.equal(initializer(current, name), initializer(old, name), name);
  const models = (s) => [...s.matchAll(/v-model(?:\.[\w]+)?="form\.(\w+)"/g)].map((m) => m[1]);
  assert.equal(models(current).length, 23);
  assert.deepEqual(models(current), models(old));
  assert.match(current, /if \(saving\.value \|\| !pageActive \|\| !editorOpen\.value\) return/);
  assert.match(current, /<details v-if="editorRequestId">/);
  assert.match(current, /等待上一项保存/);
});

test("P46 historical mapping recognizes only exact known changes and keeps earlier evidence immutable", () => {
  for (const r of providerAsyncRevisions) {
    const s = read(r.file);
    assert.equal(hash(s), r.after);
    assert.equal(hash(historicalProviderAsyncSource(r.file, s)), r.before);
    assert.equal(
      historicalProviderAsyncSource(r.file, s + "\n/* unexpected drift */"),
      s + "\n/* unexpected drift */",
    );
  }
  assert.equal(
    JSON.parse(read("output/playwright/p46-provider-focus-implementation/current/evidence.json"))
      .sourceHashes[file],
    hash(old),
  );
});

test("P46 historical async Vue120 formal pictures and source hashes match exact captured files", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      dir = folder + "/" + mode;
    assert.equal(e.kind, "P46-ASYNC-OWNERSHIP-r1");
    assert.equal(e.mode, mode);
    assert.equal(e.processesClosed, true);
    assert.equal(e.screenshots.length, 60);
    assert.equal(e.checks.length, mode === "baseline" ? 208 : 228);
    assert.equal(Object.keys(e.sourceHashes).length, 40);
    for (const [f, sha] of Object.entries(e.sourceHashes))
      assert.equal(
        hash(mode === "baseline" ? historicalProviderAsyncSource(f, read(f)) : read(f)),
        sha,
        mode + ":" + f,
      );
    assert.deepEqual(
      readdirSync(dir).sort(),
      ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots) {
      const bytes = readFileSync(dir + "/" + s.file);
      assert.equal(hash(bytes), s.sha256);
      assert.equal(bytes.readUInt32BE(16), s.width);
      assert.equal(bytes.readUInt32BE(20), 900);
    }
    assert.match(e.scope, /isolated KeepAlive harness, not full NavigationShell\/App/);
    assert.match(e.scope, /no real persistence or permissions/);
  }
});

test("P46 async evidence proves serial writes, stale isolation, refresh truth and unchanged payloads", () => {
  const baseline = evidence("baseline"),
    e = evidence("current");
  const cases = [
    "late-success-create",
    "late-failure-edit",
    "refresh-success-create",
    "refresh-failure-edit",
    "reload-new-create",
    "inactive-success-edit",
    "inactive-failure-edit",
    "read-deactivate",
  ];
  assert.equal(e.observations.length, 32);
  assert.equal(baseline.observations.length, 32);
  assert.equal(e.observations.flatMap((o) => o.requests).length, 80);
  assert.equal(baseline.observations.flatMap((o) => o.requests).length, 84);
  for (const surface of ["production", "review"])
    for (const width of [390, 1440]) {
      for (const scenario of cases) {
        const o = e.observations.find(
          (o) => o.surface === surface && o.width === width && o.scenario === scenario,
        );
        assert.ok(o);
        const prior = baseline.observations.find(
          (o) => o.surface === surface && o.width === width && o.scenario === scenario,
        );
        const writes = (o) => o.requests.filter((r) => r.method !== "GET");
        assert.deepEqual(
          writes(o),
          writes(prior),
          scenario + " exact baseline/current write contract",
        );
        assert.equal(writes(o).length, scenario === "read-deactivate" ? 0 : 1);
        for (const w of writes(o)) {
          assert.equal(w.idempotencyPresent, true);
          if (w.method === "POST") assert.equal(w.status, 201);
        }
        const value = (name) => {
          const c = e.checks.find(
            (c) =>
              c.surface === surface &&
              c.width === width &&
              c.scenario === scenario &&
              c.name === name,
          );
          assert.ok(c, scenario + ":" + name);
          return c.actual;
        };
        if (scenario.startsWith("late")) {
          assert.equal(value("new editor remains"), 1);
          assert.equal(value("new draft name retained"), "新窗口草稿");
          assert.equal(value("feedback belongs to current window"), true);
          assert.equal(value("no stale editor request id"), 0);
          assert.equal(value("serial pending disabled"), true);
          assert.equal(value("new window pending label"), "等待上一项保存…");
          assert.equal(value("stale success does not reload"), 1);
        }
        if (scenario.startsWith("refresh")) {
          assert.equal(value("save is confirmed"), true);
          assert.equal(value("refresh fact matches outcome"), scenario.includes("failure"));
          assert.equal(value("current save closes editor"), 0);
          if (scenario.includes("failure"))
            assert.equal(value("obsolete save-refresh caption cleared on retry"), 0);
        }
        if (scenario === "reload-new-create") {
          assert.equal(value("editor survives earlier refresh"), 1);
          assert.equal(value("old success not posted into new window session"), 0);
          assert.equal(value("editor technical id isolated from read"), 0);
        }
        if (scenario.startsWith("inactive")) {
          assert.equal(value("no inactive followup read"), 1);
          assert.equal(value("cached editor retained"), 1);
          assert.equal(value("cached editor has no stale error"), 0);
        }
        if (scenario === "read-deactivate")
          assert.equal(value("read count after cached return"), 2);
      }
    }
});
