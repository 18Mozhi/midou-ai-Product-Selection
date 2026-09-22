import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { permissionPagePreview } from "../../scripts/lib/ui-phase2-permission-page-preview.mjs";

const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const folder = "output/playwright/p45-permission-page-vue-preview";
const child = "apps/web/src/components/PlatformRoleComparison.vue";
const evidence = () => JSON.parse(read(folder + "/evidence.json"));
const historicalSource = (file) => {
  const revision = [
    "design-plans/ui-phase-2-2026-09-07/implementation/permission-page-preview.css",
    "scripts/lib/ui-phase2-permission-page-preview.mjs",
    "scripts/verify-ui-phase2-permission-page-preview.mjs",
  ].includes(file)
    ? "4ab8631b"
    : "42909c61";
  return execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }).replaceAll(
    "\r\n",
    "\n",
  );
};
function contracts(source) {
  const directives = [],
    controls = [],
    expressions = [];
  function walk(n) {
    if (n.type === 5) expressions.push(n.content.content);
    if (n.type === 1) {
      for (const p of n.props) if (p.type === 7) directives.push(p.loc.source);
      if (["button", "input", "select", "option", "textarea"].includes(n.tag))
        controls.push({ tag: n.tag, props: n.props.map((p) => p.loc.source).sort() });
    }
    for (const c of n.children ?? []) walk(c);
  }
  walk(baseParse(parse(source).descriptor.template.content));
  return { directives: directives.sort(), controls, expressions: expressions.sort() };
}

test("P45 production uses the approved role-context and reading regions without changing behavior", () => {
  const original = read(child),
    updated = permissionPagePreview(original);
  assert.deepEqual(parse(updated).errors, []);
  assert.equal(updated, original);
  assert.equal(
    parse(updated).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(contracts(updated), contracts(original));
  assert.ok(updated.includes("'role-comparison--permission-page': persistSelection"));
  for (const marker of [
    "role-comparison__workspace",
    "role-comparison__context",
    "role-comparison__reading",
    "role-comparison__selectors",
    "role-comparison__filters",
    "role-comparison__summaries",
    "role-comparison__matrix",
  ])
    assert.ok(updated.includes(`class="${marker}"`), marker);
  assert.ok(
    updated.indexOf('class="role-comparison__selectors"') <
      updated.indexOf('class="role-comparison__reading"'),
  );
  assert.ok(
    updated.indexOf('class="role-comparison__summaries"') <
      updated.indexOf('class="role-comparison__reading"'),
  );
  assert.throws(
    () => permissionPagePreview(original.replace("role-comparison__context", "context-drift")),
    /drift/,
  );
});

test("P45 evidence pins current source, transformed template and exact formal image inventory", () => {
  const e = evidence();
  assert.equal(e.kind, "P45-PERMISSION-PAGE-VUE-PREVIEW-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 344);
  assert.equal(e.screenshots.length, 92);
  assert.equal(Object.keys(e.sourceHashes).length, 40);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(historicalSource(file)), sha, file);
  assert.deepEqual(e.transformedHashes, {
    [child]: hash(permissionPagePreview(historicalSource(child))),
  });
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(folder + "/" + s.file);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.deepEqual(s.viewport, { width: s.width, height: 900 });
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(s.imageDimensions.width, s.width);
  }
});

test("P45 actual Vue preserves URL reload, correct counts and observed single-role/auth-error edges", () => {
  const e = evidence();
  assert.deepEqual(
    e.observations.map((o) => o.width),
    [390, 760, 761, 1440],
  );
  for (const o of e.observations) {
    assert.deepEqual(o.errors, []);
    assert.deepEqual(o.unexpected, []);
    assert.ok(o.requests.length > 20, "URL changes retain original parent rereads, unlike P44");
    assert.ok(o.requests.every((r) => r.method === "GET" && r.path === "/api/v1/platform/roles"));
    for (const [status, count] of [
      [500, 2],
      [403, 1],
      [401, 1],
    ])
      assert.equal(o.requests.filter((r) => r.status === status).length, count);
    const states = e.screenshots.filter((s) => s.width === o.width).map((s) => s.state);
    assert.equal(states.length, 23);
    assert.equal(new Set(states).size, 23);
    for (const state of [
      "loading",
      "default",
      "default-top",
      "role-focus",
      "same-none",
      "same-all",
      "super-all",
      "super-differences",
      "code-search",
      "group",
      "search-empty",
      "url-restored",
      "refresh-pending",
      "refresh-error-500",
      "refresh-error-403",
      "refresh-error-401",
      "initial-error",
      "retry-success",
      "empty",
      "single-role",
      "single-reset-pending",
      "single-reset-recovered",
      "long-content",
    ])
      assert.ok(states.includes(state), state);
    const value = (name) => {
      const c = e.checks.find((c) => c.width === o.width && c.name === name);
      assert.ok(c, name);
      return c.actual;
    };
    assert.deepEqual(value("only real role directory metrics"), ["3", "7", "MySQL"]);
    for (const [name, count] of [
      ["selected union six not global seven", 6],
      ["same role no differences", 0],
      ["same role show all three", 3],
      ["super and operations union seven", 7],
      ["super and operations four differences", 4],
      ["case-insensitive code query", 2],
      ["security group two", 2],
      ["combined no result", 0],
      ["reload combined result", 1],
      ["reset removes only owned URL keys", 6],
    ])
      assert.equal(value(name), count);
    assert.deepEqual(value("reload restores all five controls"), [
      "platform_security_admin",
      "platform_super_admin",
      false,
      "会话",
      "安全治理",
    ]);
    assert.deepEqual(value("single reset pending missing role options"), ["", ""]);
    assert.deepEqual(value("single reset recovers after actual reread"), [
      "platform_super_admin",
      "platform_super_admin",
    ]);
    assert.equal(value("role-only reset still disabled"), true);
    assert.equal(value("Tab reaches left role"), true);
    assert.equal(value("role focus white"), "rgb(255, 255, 255)");
    for (const code of [500, 403, 401]) {
      assert.equal(value("retained matrix after " + code), 6);
      assert.equal(value("stale notice after " + code), true);
    }
  }
});

test("P45 preview does not import into production or extend P44 approvals/security acceptance", () => {
  assert.doesNotMatch(read(child), /p45-workspace|p45-role-context|p45-reading/);
  assert.doesNotMatch(read("apps/web/src/main.ts"), /permission-page-preview/);
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/implementation/permission-page-preview.css"),
    /body\.p45-page-review/,
  );
  assert.match(evidence().scope, /GET roles only, no accounts or writes/);
  assert.match(evidence().scope, /no real RBAC\/DB\/MFA/);
  assert.match(evidence().scope, /prior P44 approvals do not apply/);
  assert.match(evidence().scope, /back-forward\/KeepAlive/);
});
