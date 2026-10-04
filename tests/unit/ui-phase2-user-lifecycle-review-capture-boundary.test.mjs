import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { userPagePreview } from "../../scripts/lib/ui-phase2-user-page-current-preview.mjs";
import {
  userLifecycleReviewCaptureStages,
  userLifecycleReviewHistoricalCapture,
} from "../../scripts/lib/ui-phase2-user-lifecycle-review-historical-capture.mjs";
import {
  userLifecycleReviewReplayDriver,
  userLifecycleReviewReplayRoot,
} from "../../scripts/lib/ui-phase2-user-lifecycle-review-current-replay.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function neutralImports(source) {
  const ast = ts.createSourceFile("driver.mjs", source, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements.filter(ts.isImportDeclaration).reverse()) {
    const specifier = node.moduleSpecifier;
    source = source.slice(0, specifier.getStart(ast)) + '"IMPORT"' + source.slice(specifier.end);
  }
  return source;
}
test("P43 current route preserves the directory workspace and all native bindings", () => {
  const source = read("apps/web/src/components/PlatformAccountCenter.vue"),
    workspace = read("apps/web/src/components/PlatformAccountDirectoryWorkspace.vue"),
    transformed = userPagePreview(source, "parent");
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  const bindings = (text) => {
    const result = [];
    function visit(node) {
      if (node.type === 1)
        for (const prop of node.props)
          if (prop.type === 7)
            result.push(
              JSON.stringify([
                node.tag,
                prop.name,
                prop.arg?.content,
                prop.exp?.content,
                prop.modifiers.map((item) => item.content),
              ]),
            );
      for (const child of node.children ?? []) visit(child);
    }
    visit(baseParse(parse(text).descriptor.template.content));
    return result.sort();
  };
  assert.deepEqual(bindings(transformed), bindings(source));
  assert.match(transformed, /<PlatformAccountDirectoryWorkspace/);
  assert.match(workspace, /class="admin-directory-heading"/);
  assert.throws(
    () =>
      userPagePreview(
        source.replace("<PlatformAccountDirectoryWorkspace", "<ChangedDirectory"),
        "parent",
      ),
    /source drift/,
  );
});
test("P43 replay only redirects output and resolves imports through the current preview helper; every original assertion remains", () => {
  for (const [stage, entry] of Object.entries(userLifecycleReviewCaptureStages).filter(([name]) =>
    name.endsWith("-current"),
  )) {
    const original = read(entry.driver),
      transformed = userLifecycleReviewReplayDriver(stage, original);
    assert.equal(
      neutralImports(transformed).replace(
        `const output = "${userLifecycleReviewReplayRoot}/${stage}";`,
        `const output = "${entry.folder.slice(0, -7)}" + (baseline ? "baseline" : "current");`,
      ),
      neutralImports(original),
    );
    assert.ok(transformed.includes("ui-phase2-user-page-current-preview.mjs"));
    assert.throws(
      () => userLifecycleReviewReplayDriver(stage, original + "\n"),
      /Original P43 driver changed/,
    );
  }
  assert.throws(
    () => userLifecycleReviewReplayDriver("../outside", ""),
    /Unknown P43 replay stage/,
  );
  assert.throws(
    () => userLifecycleReviewReplayDriver("create-baseline", ""),
    /Only current lifecycle/,
  );
});
test("P43 historical capture pins complete original manifests and all source blobs without current fallback", () => {
  for (const [stage, entry] of Object.entries(userLifecycleReviewCaptureStages)) {
    const capture = userLifecycleReviewHistoricalCapture(stage);
    assert.equal(hash(capture.manifest), entry.manifestHash);
    assert.equal(capture.manifest, read(`${entry.folder}/evidence.json`));
    for (const [file, sha] of Object.entries(JSON.parse(capture.manifest).sourceHashes))
      assert.equal(hash(capture.source(file)), sha, file);
    assert.throws(() => capture.source("missing.vue"), /Source absent/);
  }
  assert.throws(
    () => userLifecycleReviewHistoricalCapture("invented"),
    /Unknown historical P43 stage/,
  );
});
test("P43 captured replay remains immutable and keeps checks, images and request evidence separate", () => {
  const manifest = read(`${userLifecycleReviewReplayRoot}/evidence.json`),
    e = JSON.parse(manifest);
  assert.equal(hash(manifest), "0f076f4be1f0207bfbc170aadf82ca1ace13f5d9d78871a113e517a908f82b3c");
  assert.equal(e.kind, "P43-lifecycle-current-replay-r1");
  assert.equal(e.approval, "not-user-approved");
  assert.equal(e.processesClosed, true);
  assert.deepEqual(
    e.summaries.map((item) => item.stage),
    ["create-current", "password-current"],
  );
  assert.equal(
    e.summaries.reduce((n, item) => n + item.checks, 0),
    380,
  );
  assert.equal(
    e.summaries.reduce((n, item) => n + item.images.length, 0),
    72,
  );
  for (const item of e.summaries) {
    const bytes = readFileSync(item.manifest);
    assert.equal(hash(bytes), item.manifestSha);
    const current = JSON.parse(bytes),
      original = JSON.parse(userLifecycleReviewHistoricalCapture(item.stage).manifest);
    assert.deepEqual(current.checks, original.checks);
    assert.equal(current.mode, "current-regression");
    assert.deepEqual(
      current.requestsByWidth ?? current.observations,
      original.requestsByWidth ?? original.observations,
    );
    for (const image of item.images) {
      assert.equal(
        hash(readFileSync(`${userLifecycleReviewReplayRoot}/${item.stage}/${image.file}`)),
        image.currentSha,
      );
      assert.equal(
        hash(readFileSync(`${userLifecycleReviewCaptureStages[item.stage].folder}/${image.file}`)),
        image.previousSha,
      );
      assert.equal(image.byteEqual, image.currentSha === image.previousSha);
    }
  }
});
test("P43 completed packet rejects capture and resume before browser startup", () => {
  const before = read(`${userLifecycleReviewReplayRoot}/evidence.json`);
  for (const arg of ["--capture", "--resume"]) {
    const r = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-user-lifecycle-review-current-replay.mjs", arg],
      { encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /Completed P43 packet is immutable/);
    assert.equal(read(`${userLifecycleReviewReplayRoot}/evidence.json`), before);
  }
});
