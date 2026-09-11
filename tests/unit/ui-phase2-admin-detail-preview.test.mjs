import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { adminDetailPreview } from "../../scripts/lib/ui-phase2-admin-detail-preview.mjs";
import { adminPageAssemblyPreview } from "../../scripts/lib/ui-phase2-admin-page-assembly-preview.mjs";

const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const folder = "output/playwright/p44-admin-detail-vue-preview";
const detail = "apps/web/src/components/PlatformUserDetailDialog.vue";
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const evidence = () => JSON.parse(read(folder + "/evidence.json"));
const variants = [
  "normal",
  "password-pending",
  "mfa-pending",
  "both-pending",
  "disabled",
  "all-roles",
  "no-roles",
  "long-email",
];
const presentation = ":class=\"{ 'p44-detail-reenable': selected?.status !== 'active' }\" ";
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
    for (const child of n.children ?? []) walk(child);
  }
  walk(baseParse(parse(source).descriptor.template.content));
  return { directives: directives.sort(), controls, expressions: expressions.sort() };
}

test("P44 detail adds only exact restore presentation; script, actions and controls remain intact", () => {
  const original = read(detail),
    updated = adminDetailPreview(original);
  assert.deepEqual(parse(updated).errors, []);
  assert.equal(
    parse(updated).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.equal(updated.split(presentation).length, 2);
  assert.deepEqual(contracts(updated.replace(presentation, "")), contracts(original));
  assert.throws(
    () =>
      adminDetailPreview(
        original.replace("$emit('toggleStatus', selected)", "$emit('unknownStatus', selected)"),
      ),
    /drift/,
  );
});

test("P44 administrator detail evidence pins current sources, transforms and exact image inventory", () => {
  const e = evidence();
  assert.equal(e.kind, "P44-ADMIN-DETAIL-VUE-PREVIEW-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 747);
  assert.equal(e.screenshots.length, 94);
  assert.equal(Object.keys(e.sourceHashes).length, 46);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  assert.equal(e.transformedHashes[parent], hash(adminPageAssemblyPreview(read(parent), "parent")));
  assert.equal(e.transformedHashes[detail], hash(adminDetailPreview(read(detail))));
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
  }
});

test("P44 detail tests administrator identity, selected role truth, pending flags and retry without writes", () => {
  const e = evidence();
  assert.deepEqual(
    e.observations.map((o) => o.width),
    [390, 760, 761, 1440],
  );
  for (const o of e.observations) {
    assert.deepEqual(o.errors, []);
    assert.deepEqual(o.unexpected, []);
    assert.equal(o.requests.length, 26);
    assert.ok(o.requests.every((r) => r.method === "GET"));
    assert.equal(o.requests.filter((r) => r.target === "accounts").length, 8);
    assert.equal(o.requests.filter((r) => r.target === "roles").length, 8);
    const reads = o.requests.filter((r) => r.target === "detail");
    assert.equal(reads.length, 10);
    assert.ok(
      reads.every(
        (r) => r.path === "/api/v1/platform/accounts/users/00000000-0000-4000-8000-000000000624",
      ),
    );
    assert.equal(reads.filter((r) => r.status === 500).length, 1);
    const images = e.screenshots.filter((s) => s.width === o.width),
      names = images.map((s) => s.state);
    assert.equal(new Set(names).size, names.length);
    assert.equal(images.length, o.width === 390 ? 26 : o.width === 760 ? 24 : 22);
    for (const variant of variants) {
      assert.ok(names.includes(variant + "-default"));
      assert.ok(names.includes(variant + "-actions"));
      const checks = e.checks.filter((c) => c.width === o.width && c.variant === variant);
      const value = (name) => {
        const c = checks.find((c) => c.name === name);
        assert.ok(c, name);
        return c.actual;
      };
      assert.equal(
        value("native dialog accessible name matches identity"),
        value("detail belongs to selected administrator"),
      );
      assert.deepEqual(value("facts match original or explicit variant"), [
        variant === "disabled" ? "已停用" : "正常使用",
        variant.endsWith("pending") ? "待完成" : "已完成",
        "0",
        "0",
      ]);
      assert.equal(value("disabled account role actions"), variant === "disabled");
      assert.equal(value("restore-only presentation class"), variant === "disabled");
      assert.equal(
        value("status action label unchanged"),
        variant === "disabled" ? "恢复登录" : "停用登录",
      );
      if (variant === "disabled")
        assert.equal(value("restore blue background"), "rgb(41, 76, 175)");
      if (variant === "normal") {
        assert.equal(value("detail belongs to selected administrator"), "admin@example.test");
        assert.equal(value("error hides prior facts and actions"), 0);
        assert.equal(value("retry restores same admin identity"), "admin@example.test");
      }
    }
    for (const state of [
      "normal-loading",
      "normal-facts",
      "normal-access",
      "normal-close-focus",
      "normal-first-error",
      "normal-retry-wait",
    ])
      assert.ok(names.includes(state));
  }
});

test("P44 detail review leaves production and permission semantics unchanged", () => {
  assert.doesNotMatch(read(detail), /p44-detail-reenable/);
  assert.doesNotMatch(read("apps/web/src/main.ts"), /admin-detail-preview/);
  const css = read("design-plans/ui-phase-2-2026-09-07/implementation/admin-detail-preview.css");
  assert.match(css, /body\.p44-detail-review/);
  assert.match(css, /button\.p44-detail-reenable:not\(:disabled\)/);
  assert.match(evidence().scope, /GET-only intercepted/);
  assert.match(evidence().scope, /No role\/status\/password\/session or membership writes/);
  assert.match(evidence().scope, /not buyer detail/);
});
