import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { providerPagePreview } from "../../scripts/lib/ui-phase2-provider-page-preview.mjs";

const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const folder = "output/playwright/p46-provider-page-vue-preview";
const source = "apps/web/src/components/ProviderRegistry.vue";
const evidence = () => JSON.parse(read(folder + "/evidence.json"));

test("P46 preview changes only two exact presentation strings; all original code survives", () => {
  const original = read(source),
    result = providerPagePreview(original);
  assert.deepEqual(parse(result).errors, []);
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.equal(
    result
      .replace("<th>操作</th>", "<th></th>")
      .replace('      primary-label="重新读取来源"\n', ""),
    original,
  );
  assert.throws(
    () => providerPagePreview(original.replace("<th></th>", "<th>changed</th>")),
    /drift/,
  );
  assert.throws(
    () => providerPagePreview(original.replace("    <UiStatePanel\n", "    <OtherPanel\n")),
    /drift/,
  );
  assert.match(original, /@primary="load"/);
  assert.doesNotMatch(original, /@secondary=/);
});

test("P46 source and formal image manifest match current files exactly", () => {
  const e = evidence();
  assert.equal(e.kind, "P46-PROVIDER-PAGE-VUE-PREVIEW-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 284);
  assert.equal(e.screenshots.length, 104);
  assert.equal(Object.keys(e.sourceHashes).length, 38);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  assert.deepEqual(e.transformedHashes, { [source]: hash(providerPagePreview(read(source))) });
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(folder + "/" + s.file);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(s.imageDimensions.width, s.width);
  }
});

test("P46 real Vue validates local filtering, exact pages, table controls and read-only recovery", () => {
  const e = evidence();
  assert.deepEqual(
    e.observations.map((o) => o.width),
    [390, 760, 761, 1440],
  );
  for (const o of e.observations) {
    const value = (name) => {
      const c = e.checks.find((c) => c.width === o.width && c.name === name);
      assert.ok(c, name);
      return c.actual;
    };
    assert.deepEqual(o.errors, []);
    assert.deepEqual(o.unexpected, []);
    assert.equal(o.requests.length, 18);
    assert.ok(
      o.requests.every((r) => r.method === "GET" && r.path === "/api/v1/platform/providers"),
    );
    for (const [status, count] of [
      [200, 9],
      [401, 2],
      [403, 2],
      [500, 2],
      [429, 3],
    ])
      assert.equal(o.requests.filter((r) => r.status === status).length, count);
    assert.deepEqual(value("global counts"), ["25", "1", "1", "24"]);
    assert.deepEqual(value("filter not global counts"), value("global counts"));
    assert.equal(value("first page exact name order").length, 20);
    assert.equal(value("second page five names").length, 5);
    assert.deepEqual(value("search keeps blocked definition"), ["待复核公开来源"]);
    assert.deepEqual(value("case insensitive code search"), ["公开趋势 RSS"]);
    assert.deepEqual(value("combined filter empty"), []);
    assert.deepEqual(value("manual mode empty"), []);
    assert.equal(value("local filters and pagination require only initial GET"), 1);
    assert.equal(value("query unchanged by local filters"), "?keep=p46");
    assert.equal(value("navigation native Tab focus"), true);
    assert.equal(value("create native Tab focus"), true);
    assert.equal(value("create blue action"), "rgb(41, 76, 175)");
    for (const code of [500, 403, 401]) {
      assert.equal(value("refresh " + code + " retains 25"), "25");
      assert.equal(value("refresh " + code + " declares stale"), true);
    }
    for (const code of [500, 403, 401, 429]) {
      assert.equal(value("initial " + code + " hides records"), 0);
      assert.deepEqual(value("initial " + code + " only real reload action"), ["重新读取来源"]);
    }
    const states = e.screenshots.filter((s) => s.width === o.width).map((s) => s.state);
    assert.equal(states.length, o.width <= 760 ? 24 : 28);
    assert.equal(new Set(states).size, states.length);
    for (const state of [
      "loading",
      "default",
      "default-top",
      "navigation-focus",
      "create-focus",
      "filters",
      "records",
      "page-two",
      "blocked-filter",
      "filter-empty",
      "code-search",
      "recent-order",
      "admission-order",
      "search-focus",
      "refresh-pending",
      "refresh-error-500",
      "refresh-error-403",
      "refresh-error-401",
      "initial-error",
      "initial-forbidden",
      "initial-expired",
      "initial-blocked",
      "empty",
      "long-name",
    ])
      assert.ok(states.includes(state), state);
    if (o.width > 760) {
      assert.deepEqual(value("seven named columns"), [
        "来源",
        "模式 / 市场",
        "频率 / 并发",
        "超时 / 重试",
        "解析器",
        "状态",
        "操作",
      ]);
      assert.equal(value("freeze follows first visible column"), true);
      assert.equal(value("unfreeze"), 0);
      assert.equal(value("table scroll reaches right columns"), true);
      for (const state of ["columns", "hidden-first-column", "compact-unfrozen", "table-right"])
        assert.ok(states.includes(state));
    } else assert.equal(value("detail close focus returns to original record"), true);
  }
});

test("P46 review isolates CSS, keeps editor production source untouched and does not claim permissions", () => {
  assert.doesNotMatch(read("apps/web/src/main.ts"), /provider-page-preview/);
  assert.doesNotMatch(read(source), /primary-label="重新读取来源"/);
  const css = read("design-plans/ui-phase-2-2026-09-07/implementation/provider-page-preview.css");
  assert.match(css, /body\.p46-page-review/);
  assert.match(css, /:where\(:not\(\.provider-editor-layer\)\)/);
  assert.match(evidence().scope, /GET-only intercepted/);
  assert.match(evidence().scope, /no real RBAC\/MySQL\/collection or provider writes/);
  assert.match(evidence().scope, /Editor and mobile details unchanged, not redesigned\/accepted/);
  assert.match(evidence().scope, /prior page approvals do not apply/);
});
