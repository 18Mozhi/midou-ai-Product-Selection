import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { topologyNodes, previewTopologyPage } from "../../scripts/lib/topology-page-preview.mjs";
const source = readFileSync("apps/web/src/components/RuntimeTopologyCenter.vue", "utf8");
const { byClass } = topologyNodes(source);
test("P66 C primary border does not inherit the former orange palette", () => {
  const css = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/implementation/topology-page-preview.css",
    "utf8",
  );
  assert.match(css, /--so-primary-border: #1748a0;/);
});
test("P66 loading and first failure have associated headings and busy state", () => {
  for (const name of ["topology-state", "topology-state topology-state--danger"]) {
    const region = byClass(name).loc.source;
    assert.match(region, /aria-labelledby="topology-read-title"/);
    assert.match(region, /:aria-busy="refreshing"/);
    assert.match(region, /<h2 id="topology-read-title">{{ verdict\[0\] }}<\/h2>/);
  }
});
test("P66 retained failure is independently named without changing retry or trace bindings", () => {
  const region = byClass("topology-refresh-notice").loc.source;
  assert.match(region, /aria-labelledby="topology-refresh-title"/);
  assert.match(region, /:aria-busy="refreshing"/);
  assert.match(region, /<h2 id="topology-refresh-title">/);
  assert.match(region, /:request-id="readFailureId"/);
  assert.match(region, /ref="noticeRetryButton"/);
});
test("P66 C read regions follow h1 with h2, remove decorative danger icon and preserve script", () => {
  const preview = parse(previewTopologyPage(source)).descriptor;
  assert.equal(
    preview.scriptSetup.content,
    parse(source.replaceAll("\r\n", "\n")).descriptor.scriptSetup.content,
  );
  assert.equal((preview.template.content.match(/<h2 id="topology-read-title">/g) ?? []).length, 2);
  assert.match(preview.template.content, /<h2 id="topology-refresh-title">/);
  assert.doesNotMatch(preview.template.content, /<strong aria-hidden="true">!<\/strong>/);
});
