import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import { releaseNodes, previewReleasePage } from "../../scripts/lib/release-page-preview.mjs";
import { releaseReviewFixtures } from "../../scripts/lib/release-review-fixtures.mjs";
const original = readFileSync(
  "apps/web/src/components/ReleaseRolloutCenter.vue",
  "utf8",
).replaceAll("\r\n", "\n");
const preview = previewReleasePage(original),
  template = parse(preview).descriptor.template.content;
test("P65 table labels and column guidance are production markup with existing input constraints", () => {
  const source = readFileSync("apps/web/src/components/TableViewControls.vue", "utf8");
  assert.match(source, /<label\s+v-if="props\.columnLabels"/);
  assert.match(source, /<p v-if="props\.columnHelp" class="table-view-controls__help"/);
  assert.match(
    source,
    /<label\s+v-if="props\.columnLabels"[\s\S]*?:for="`\$\{controlId\}-column-\$\{column.index\}`"/,
  );
  assert.match(source, /:aria-label="`切换第 \$\{column.index \+ 1\} 列`"/);
  assert.match(
    source,
    /:disabled="!hiddenColumns.includes\(column.index\) && visibleColumnCount <= 1"/,
  );
  assert.match(original, /column-help="至少保留一列"/);
  assert.deepEqual(
    compileTemplate({
      source: parse(source).descriptor.template.content,
      filename: "TableViewControls.vue",
      id: "p65-table",
    }).errors,
    [],
  );
});
test("P65 compact review style preserves the shared six-pixel density and focus includes checkboxes", () => {
  const css = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/implementation/release-page-preview.css",
    "utf8",
  );
  assert.match(
    css,
    /table\[data-table-density="compact"\] :is\(th, td\)\s*\{\s*padding-top: 6px;\s*padding-bottom: 6px;/,
  );
  assert.match(css, /:is\(button, a, summary, select, input\):focus-visible/);
});
test("P65 C verdict labels do not infer an automatic stop or an audited stable rollback from state alone", () => {
  assert.doesNotMatch(template, /发布已自动停止|已回滚到稳定版本|回滚事实已审计/);
  assert.match(template, /服务返回停止结论/);
  assert.match(template, /服务返回回滚结论/);
  assert.match(template, /服务返回观察门通过结论/);
  assert.match(template, /请结合下方回滚记录与证据标记核对/);
});
test("P65 read feedback has named headings, busy regions and separate trace consumers", () => {
  const t = parse(original).descriptor.template.content;
  assert.equal((t.match(/id="release-read-title"/g) ?? []).length, 2);
  assert.equal((t.match(/aria-labelledby="release-read-title"/g) ?? []).length, 2);
  assert.match(t, /aria-labelledby="release-refresh-title"/);
  assert.equal((t.match(/:aria-busy="refreshing"/g) ?? []).length, 4);
  assert.match(template, /<h3 id="release-read-title">/);
  assert.match(t, /state === "timeout"\s*\? "读取超过 15 秒，已停止本次等待。请重新核验。"/);
});
test("P65 review adds only a review marker to the production SFC", () => {
  assert.equal(
    parse(preview).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.match(template, /capabilities\?\.includes\('platform:superadmin'\)/);
  assert.match(template, /to="\/platform-admin\/api-coverage"/);
  assert.match(template, /release-center--c release-center--review/);
  assert.match(template, /p65-review-note/);
});
test("P65 C actual template compiles", () => {
  assert.deepEqual(
    compileTemplate({ source: template, filename: "ReleaseRolloutCenter.vue", id: "p65-review" })
      .errors,
    [],
  );
});
test("P65 original six-column table and complete mobile slots are unchanged", () => {
  const table = (s) =>
    releaseNodes(s).nodes.find((n) => n.type === 1 && n.tag === "ResponsiveDataView").loc.source;
  assert.equal(table(preview), table(original));
  assert.equal((table(preview).match(/<th>/g) ?? []).length, 6);
});
test("P65 removes old layout from render and shows full source identities with fallback caveat", () => {
  assert.match(template, /v-if="false" class="identity-grid"/);
  assert.match(template, /v-if="false" class="panel p65-legacy-stages"/);
  assert.match(template, /返回文本一致不代表独立核验/);
  for (const key of ["local", "remote", "production"])
    assert.ok(template.includes(`data.versions?.${key}?.build_sha`));
  assert.match(template, /data\.versions\?\.production\?\.config_fingerprint/);
});
test("P65 separates matching versus latest historical release and preserves null-aware durations", () => {
  assert.match(template, /data\.latest_release\.build_sha/);
  assert.match(template, /data\.latest_historical_release\.build_sha/);
  assert.match(template, /duration\(gate\("migration"\)\?\.duration_ms\)/);
  assert.match(template, /duration\(gate\("rollback"\)\?\.duration_ms\)/);
  assert.match(template, /data\.automatic_stop_verified/);
  assert.match(template, /data\.rollback_verified/);
  assert.equal((template.match(/<h1>/g) ?? []).length, 1);
  assert.equal((template.match(/href="#p65-/g) ?? []).length, 3);
});
test("P65 fixture retains original E2E contradictory facts and does not invent production proof", async () => {
  const { fixture } = await releaseReviewFixtures();
  assert.equal(fixture.state, "verified");
  assert.equal(fixture.gates.find((g) => g.gate_kind === "rollback").status, "rolled_back");
  assert.equal(fixture.rollback_verified, false);
  assert.equal(fixture.latest_historical_release.status, undefined);
  assert.equal(fixture.versions.production.build_sha.length, 40);
});
