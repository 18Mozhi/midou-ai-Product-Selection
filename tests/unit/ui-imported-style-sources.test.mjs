import test from "node:test";
import assert from "node:assert/strict";
import { includeImportedStyleSources } from "../../scripts/lib/ui-imported-style-sources.mjs";

test("style provenance includes nested imports and terminates cycles without duplication", async () => {
  const files = {
    "apps/web/src/components/Test.vue": '<style scoped>@import "../design/test.css";</style>',
    "apps/web/src/design/test.css": '@import "./base.css"; .test { color: var(--test); }',
    "apps/web/src/design/base.css": '@import "./test.css"; .test { --test: white; }',
  };
  const sources = new Set(["apps/web/src/components/Test.vue"]);
  const reads = [];
  await includeImportedStyleSources(sources, async (file) => {
    reads.push(file);
    assert.ok(file in files);
    return files[file];
  });
  assert.deepEqual([...sources].sort(), Object.keys(files).sort());
  assert.equal(reads.length, 3);
});

test("style provenance rejects local imports outside the web source boundary", async () => {
  const sources = new Set(["apps/web/src/example.css"]);
  await assert.rejects(
    includeImportedStyleSources(sources, async () => '@import "../../../secret.css";'),
    /leaves web source/,
  );
});
