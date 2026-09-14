import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewStatusPage,
  statusOriginalRegions,
  statusReviewImport,
  statusReviewComponent,
} from "../../scripts/lib/platform-status-page-preview.mjs";
import { statusReviewFixtures } from "../../scripts/lib/status-review-fixtures.mjs";
const source = readFileSync(
    "apps/web/src/components/PlatformManagementCenter.vue",
    "utf8",
  ).replaceAll("\r\n", "\n"),
  reviewed = previewStatusPage(source),
  r = statusOriginalRegions(source);
test("P61 review retains actual business script except isolated review component import", () => {
  assert.equal(
    parse(reviewed).descriptor.scriptSetup.content.replace(statusReviewImport, ""),
    parse(source).descriptor.scriptSetup.content,
  );
});
test("P61 topology facts, actual hrefs, session and business groups preserved", () => {
  for (const key of ["header", "lanes", "collections", "sources"])
    assert.ok(reviewed.includes(r[key]), key);
  assert.ok(
    reviewed.includes(
      r.attention.replace("<h4>当前需核查的传播范围</h4>", "<h3>当前需核查的传播范围</h3>"),
    ),
  );
  assert.ok(reviewed.includes(r.session.replace("<h4>实时连接退化</h4>", "<h3>实时连接退化</h3>")));
  assert.ok(reviewed.includes(r.kpis.replace(` v-if="domain !== 'api-coverage'"`, "")));
});
test("P61 transformation compiles actual Vue and isolated slot wrapper", () => {
  for (const code of [reviewed, readFileSync(statusReviewComponent, "utf8")]) {
    const { descriptor, errors } = parse(code);
    assert.deepEqual(errors, []);
    const script = compileScript(descriptor, { id: "p61" });
    assert.deepEqual(
      compileTemplate({
        source: descriptor.template.content,
        filename: "p61.vue",
        id: "p61",
        compilerOptions: { bindingMetadata: script.bindings },
      }).errors,
      [],
    );
  }
});
test("P61 unexpected anchors fail closed", () => {
  assert.throws(() =>
    previewStatusPage(source.replace('class="platform-status-grid"', 'class="changed"')),
  );
});
test("P61 review adds no management writes or browser persistence", () => {
  const s = readFileSync(statusReviewComponent, "utf8");
  assert.doesNotMatch(
    s,
    /fetch\(|localStorage|sessionStorage|location\.|history\.|setInterval|setTimeout/,
  );
  assert.match(s, /:aria-pressed="active === view.key"/);
  assert.match(s, /v-show="active === view.key"/);
});
test("P61 samples derive from original status E2E and separate browser metrics", async () => {
  const { fixture, metrics, nav } = await statusReviewFixtures();
  assert.equal(fixture.domain, "status");
  assert.equal(fixture.services.length, 6);
  assert.equal(metrics.reconnect_count, 2);
  assert.equal(metrics.connection_open_count, 8);
  assert.deepEqual(nav.platform_capabilities, ["platform:operate"]);
});
