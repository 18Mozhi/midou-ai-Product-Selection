import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { accountPagePreview } from "../../scripts/lib/ui-phase2-account-page-preview.mjs";
import {
  accountCaptureStages,
  accountHistoricalCapture,
} from "../../scripts/lib/ui-phase2-account-historical-capture.mjs";
import {
  accountReplayDriver,
  accountReplayRoot,
} from "../../scripts/lib/ui-phase2-account-current-replay.mjs";

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
test("P39 current layout insertion preserves the later administrator heading and all native bindings", () => {
  const source = read("apps/web/src/components/PlatformAccountCenter.vue"),
    transformed = accountPagePreview(source);
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
  const heading = source.match(
    /<header v-if="tab === 'admins'" class="admin-directory-heading">[\s\S]*?<\/header>/,
  )?.[0];
  assert.ok(heading);
  assert.ok(transformed.includes(heading));
  assert.throws(() => accountPagePreview(source.replace("</nav>", "</other>")), /source drift/);
});
test("P39 replay only redirects output and resolves imports; every original assertion remains", () => {
  for (const [stage, entry] of Object.entries(accountCaptureStages)) {
    const original = read(entry.driver),
      transformed = accountReplayDriver(stage, original);
    assert.equal(
      neutralImports(transformed).replace(
        `const output = "${accountReplayRoot}/${stage}";`,
        `const output = "${entry.folder}";`,
      ),
      neutralImports(original),
    );
    assert.throws(() => accountReplayDriver(stage, original + "\n"), /Original P39 driver changed/);
  }
  assert.throws(() => accountReplayDriver("../outside", ""), /Unknown P39 replay stage/);
});
test("P39 historical capture pins complete original manifests and all source blobs without current fallback", () => {
  for (const [stage, entry] of Object.entries(accountCaptureStages)) {
    const capture = accountHistoricalCapture(stage);
    assert.equal(hash(capture.manifest), entry.manifestHash);
    assert.equal(capture.manifest, read(`${entry.folder}/evidence.json`));
    for (const [file, sha] of Object.entries(JSON.parse(capture.manifest).sourceHashes))
      assert.equal(hash(capture.source(file)), sha, file);
    assert.throws(() => capture.source("missing.vue"), /Source absent/);
  }
  assert.throws(() => accountHistoricalCapture("invented"), /Unknown historical P39 stage/);
});
test("P39 current replay keeps raw source hashes, original checks, images and request evidence separate", () => {
  const e = JSON.parse(read(`${accountReplayRoot}/evidence.json`));
  assert.equal(e.kind, "P39-current-replay-r1");
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.deepEqual(
    e.summaries.map((item) => item.stage),
    ["filter", "create", "page"],
  );
  assert.equal(
    e.summaries.reduce((n, item) => n + item.checks, 0),
    260,
  );
  assert.equal(
    e.summaries.reduce((n, item) => n + item.images.length, 0),
    88,
  );
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  for (const item of e.summaries) {
    const bytes = readFileSync(item.manifest);
    assert.equal(hash(bytes), item.manifestSha);
    const current = JSON.parse(bytes),
      original = JSON.parse(accountHistoricalCapture(item.stage).manifest);
    assert.deepEqual(current.checks, original.checks);
    assert.deepEqual(
      current.requestsByWidth ?? current.observations,
      original.requestsByWidth ?? original.observations,
    );
    for (const [file, sha] of Object.entries(current.sourceHashes))
      assert.equal(hash(read(file)), sha, file);
    for (const image of item.images) {
      assert.equal(
        hash(readFileSync(`${accountReplayRoot}/${item.stage}/${image.file}`)),
        image.currentSha,
      );
      assert.equal(
        hash(readFileSync(`${accountCaptureStages[item.stage].folder}/${image.file}`)),
        image.previousSha,
      );
      assert.equal(image.byteEqual, image.currentSha === image.previousSha);
    }
  }
});
