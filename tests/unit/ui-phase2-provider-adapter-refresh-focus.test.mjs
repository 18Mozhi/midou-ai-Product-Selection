import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { p47HistoricalSource } from "../../scripts/lib/ui-phase2-adapter-historical-source.mjs";
import {
  beforeAdapterRefreshFocus,
  refreshFocusFunction,
  refreshFocusBeforeSha,
} from "../../scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs";

const source = readFileSync("apps/web/src/components/ProviderAdapterCenter.vue", "utf8").replaceAll(
  "\r\n",
  "\n",
);
test("P47 historical refresh focus patch changes only the wrapper, native handler and persistent tabindex", () => {
  const stage = p47HistoricalSource(
    "apps/web/src/components/ProviderAdapterCenter.vue",
    source,
    "pre-mobile",
  );
  const old = beforeAdapterRefreshFocus(stage);
  assert.notEqual(old, stage);
  const a = parse(old).descriptor,
    b = parse(stage).descriptor;
  assert.equal(b.scriptSetup.content.replace(refreshFocusFunction, ""), a.scriptSetup.content);
  const styles = (descriptor) =>
    descriptor.styles.map(({ content, attrs }) => ({ content, attrs }));
  assert.deepEqual(styles(b), styles(a));
  assert.equal(
    b.template.content
      .replace(' tabindex="-1"', "")
      .replace('@click="refreshFromButton"', '@click="load"'),
    a.template.content,
  );
  for (const mutation of [
    stage + "\n// drift",
    stage.replace("preventScroll: true", "preventScroll: false"),
    stage.replace("12_000", "13_000"),
  ])
    assert.throws(() => beforeAdapterRefreshFocus(mutation));
});

for (const scene of ["owned", "other-focus", "disconnected", "inert", "missing", "non-element"]) {
  test(`P47 refresh wrapper ${scene} preserves one original load and guards focus ownership`, () => {
    const script = parse(source).descriptor.scriptSetup.content;
    const ast = ts.createSourceFile("test.ts", script, ts.ScriptTarget.Latest, true);
    const candidates = ast.statements.filter(
      (s) => ts.isFunctionDeclaration(s) && s.name?.text === "refreshFromButton",
    );
    assert.equal(candidates.length, 1);
    const order = [];
    const heading = {
      isConnected: scene !== "disconnected",
      closest: () => (scene === "inert" ? {} : null),
      focus: (options) => {
        assert.equal(options.preventScroll, true);
        order.push("focus");
      },
    };
    class Element {
      closest(selector) {
        assert.equal(selector, ".adapter-heading");
        return scene === "missing" ? null : heading;
      }
    }
    const trigger = scene === "non-element" ? {} : new Element();
    const box = {
      HTMLElement: Element,
      document: { activeElement: scene === "other-focus" ? {} : trigger },
      load: () => order.push("load"),
    };
    vm.runInNewContext(
      ts.transpileModule(candidates[0].getText(ast) + "\nglobalThis.run=refreshFromButton;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    box.run({ currentTarget: trigger });
    assert.deepEqual(order, scene === "owned" ? ["focus", "load"] : ["load"]);
  });
}

test("P47 pre-mobile refresh focus packet binds exact captured sources, imported styles and eight review images", () => {
  const root = "output/playwright/p47-refresh-focus";
  const e = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  assert.equal(
    hash(readFileSync(`${root}/evidence.json`, "utf8").replaceAll("\r\n", "\n")),
    "711afa5e256fbfab29981c7b70ed56079ba099d32b2c1ed5340601c44b7c03a1",
  );
  assert.equal(e.kind, "P47-REFRESH-FOCUS-r1");
  assert.equal(e.beforeSha, refreshFocusBeforeSha);
  assert.equal(
    e.currentSha,
    hash(
      p47HistoricalSource(
        "apps/web/src/components/ProviderAdapterCenter.vue",
        source,
        "pre-mobile",
      ),
    ),
  );
  assert.equal(Object.keys(e.sourceHashes).length, 173);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 16);
  assert.equal(
    e.runs.reduce((n, r) => n + r.checks.length, 0),
    280,
  );
  assert.equal(e.pictures.length, 8);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.pictures.map((p) => p.file)].sort(),
  );
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(
      hash(p47HistoricalSource(file, readFileSync(file, "utf8"), "pre-mobile")),
      sha,
      file,
    );
  assert.ok(e.sourceHashes["apps/web/src/design/provider-adapter-tokens.css"]);
  for (const p of e.pictures) {
    const bytes = readFileSync(`${root}/${p.file}`);
    assert.equal(hash(bytes), p.sha256, p.file);
    assert.equal(bytes.readUInt32BE(16), p.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), p.pixelHeight);
  }
  for (const mode of ["before", "current"])
    for (const width of [390, 760, 761, 1440])
      for (const outcome of ["success", "failure"]) {
        const matches = e.runs.filter(
          (r) => r.mode === mode && r.width === width && r.outcome === outcome,
        );
        assert.equal(matches.length, 1);
        const r = matches[0],
          value = (name) => r.checks.find((c) => c.name === name)?.actual;
        for (const action of ["Enter", "Space", "pointer"]) {
          assert.equal(value(action + " pending focus"), mode === "current" ? "heading" : "BODY");
          assert.equal(value(action + " settlement does not steal focus"), true);
          assert.equal(value(action + " retained snapshot and real fixture outcome"), true);
        }
        if (mode === "current") {
          assert.equal(value("Enter visible focus"), true);
          assert.equal(value("Space visible focus"), true);
          assert.equal(value("Tab skips disabled refresh to existing link"), true);
        }
        assert.equal(value("one initial and three explicit GETs"), 4);
        assert.ok(r.requests.every((req) => req.key.startsWith("GET ") && req.body === null));
        assert.deepEqual(value("no unexpected transport"), []);
        assert.deepEqual(value("no browser errors"), []);
      }
});
