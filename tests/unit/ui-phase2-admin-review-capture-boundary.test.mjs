import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { adminPagePreview } from "../../scripts/lib/ui-phase2-admin-page-preview.mjs";
import {
  adminReviewCaptureStages,
  adminReviewHistoricalCapture,
} from "../../scripts/lib/ui-phase2-admin-review-historical-capture.mjs";
import {
  adminReviewReplayDriver,
  adminReviewReplayRoot,
  adminReviewReplayStyle,
  adminReviewStyleImport,
  assertAdminReviewChecks,
} from "../../scripts/lib/ui-phase2-admin-review-current-replay.mjs";

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
test("P44 current layout insertion preserves the later administrator heading and all native bindings", () => {
  const source = read("apps/web/src/components/PlatformAccountCenter.vue"),
    transformed = adminPagePreview(source, "parent");
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
  assert.ok(
    transformed.includes(
      heading.replace('class="admin-directory-heading"', 'class="p43-directory-heading"'),
    ),
  );
  assert.throws(
    () => adminPagePreview(source.replace("</nav>", "</other>"), "parent"),
    /source drift/,
  );
});
test("P44 replay only redirects output, adds scoped CSS and resolves imports; every original assertion remains", () => {
  for (const [stage, entry] of Object.entries(adminReviewCaptureStages)) {
    const original = read(entry.driver),
      transformed = adminReviewReplayDriver(stage, original);
    assert.equal(
      neutralImports(transformed)
        .replace(`sources.add(${JSON.stringify(adminReviewReplayStyle)});\n`, "")
        .replace(adminReviewStyleImport, "")
        .replace(
          `const output = "${adminReviewReplayRoot}/${stage}";`,
          stage.startsWith("boundary-")
            ? 'const output = "output/playwright/p44-page-boundary-vue-" + (baseline ? "baseline" : "preview");'
            : `const output = "${entry.folder}";`,
        ),
      neutralImports(original),
    );
    assert.throws(
      () => adminReviewReplayDriver(stage, original + "\n"),
      /Original P44 driver changed/,
    );
  }
  assert.throws(() => adminReviewReplayDriver("../outside", ""), /Unknown P44 replay stage/);
});
test("P44 historical capture pins complete original manifests and all source blobs without current fallback", () => {
  for (const [stage, entry] of Object.entries(adminReviewCaptureStages)) {
    const capture = adminReviewHistoricalCapture(stage);
    assert.equal(hash(capture.manifest), entry.manifestHash);
    assert.equal(capture.manifest, read(`${entry.folder}/evidence.json`));
    for (const [file, sha] of Object.entries(JSON.parse(capture.manifest).sourceHashes))
      assert.equal(hash(capture.source(file)), sha, file);
    assert.throws(() => capture.source("missing.vue"), /Source absent/);
  }
  assert.throws(() => adminReviewHistoricalCapture("invented"), /Unknown historical P44 stage/);
});
test("P44 cross-run URL comparison ignores only a verified local port, never route/query/transport", () => {
  const original = JSON.parse(adminReviewHistoricalCapture("comparison").manifest).checks;
  const changed = structuredClone(original);
  for (const c of changed)
    if (c.name === "comparison URL untouched")
      c.actual = "http://127.0.0.1:12345/platform-admin/admins?keep=p44";
  assertAdminReviewChecks("comparison", changed, original);
  for (const url of [
    "https://127.0.0.1:12345/platform-admin/admins?keep=p44",
    "http://example.test:12345/platform-admin/admins?keep=p44",
    "http://127.0.0.1:12345/other?keep=p44",
    "http://127.0.0.1:12345/platform-admin/admins?keep=other",
  ]) {
    const drift = structuredClone(changed);
    drift.find((c) => c.name === "comparison URL untouched").actual = url;
    assert.throws(() => assertAdminReviewChecks("comparison", drift, original));
  }
  const drift = structuredClone(changed);
  drift[0].actual = 100;
  assert.throws(() => assertAdminReviewChecks("comparison", drift, original));
});
test("P44 inset reconciliation is review-only, mobile-only and changes only margin/padding", () => {
  const css = read(adminReviewReplayStyle);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /body\.p44-role-review/);
  const properties = [...css.matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1]);
  assert.ok(properties.length > 0);
  assert.ok(properties.every((p) => ["margin", "padding"].includes(p)));
  assert.doesNotMatch(read("apps/web/src/main.ts"), /admin-current-replay/);
  assert.doesNotMatch(
    read("apps/web/src/components/PlatformAccountCenter.vue"),
    /admin-current-replay/,
  );
});
test("P44 completed capture cannot be restarted, resumed or overwritten", () => {
  const manifest = read(`${adminReviewReplayRoot}/evidence.json`);
  for (const arg of ["--capture", "--resume"]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-admin-review-current-replay.mjs", arg],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Completed P44 packet is immutable/);
    assert.equal(read(`${adminReviewReplayRoot}/evidence.json`), manifest);
  }
});
test("P44 current replay keeps raw source hashes, original checks, images and request evidence separate", () => {
  const e = JSON.parse(read(`${adminReviewReplayRoot}/evidence.json`));
  assert.equal(e.kind, "P44-current-replay-r3");
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.deepEqual(
    e.summaries.map((item) => item.stage),
    Object.keys(adminReviewCaptureStages),
  );
  assert.equal(
    e.summaries.reduce((n, item) => n + item.checks, 0),
    1653,
  );
  assert.equal(
    e.summaries.reduce((n, item) => n + item.images.length, 0),
    322,
  );
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  for (const item of e.summaries) {
    const bytes = readFileSync(item.manifest);
    assert.equal(hash(bytes), item.manifestSha);
    const current = JSON.parse(bytes),
      original = JSON.parse(adminReviewHistoricalCapture(item.stage).manifest);
    assertAdminReviewChecks(item.stage, current.checks, original.checks);
    assert.deepEqual(
      current.requestsByWidth ?? current.observations,
      original.requestsByWidth ?? original.observations,
    );
    for (const [file, sha] of Object.entries(current.sourceHashes))
      assert.equal(hash(read(file)), sha, file);
    for (const image of item.images) {
      assert.equal(
        hash(readFileSync(`${adminReviewReplayRoot}/${item.stage}/${image.file}`)),
        image.currentSha,
      );
      assert.equal(
        hash(readFileSync(`${adminReviewCaptureStages[item.stage].folder}/${image.file}`)),
        image.previousSha,
      );
      assert.equal(image.byteEqual, image.currentSha === image.previousSha);
    }
  }
});
