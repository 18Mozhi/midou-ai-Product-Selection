import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { userCreatePreview } from "../../scripts/lib/ui-phase2-user-create-preview.mjs";
import { userPagePreview } from "../../scripts/lib/ui-phase2-user-page-preview.mjs";

const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const child = "apps/web/src/components/PlatformAccountDialogs.vue";
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const folder = "output/playwright/p43-create-user-preview";
function contracts(source) {
  const directives = [],
    controls = [],
    expressions = [];
  function walk(n) {
    if (n.type === 5) expressions.push(n.content.content);
    if (n.type === 1) {
      for (const p of n.props) if (p.type === 7) directives.push(p.loc.source);
      if (["button", "input", "select", "option", "textarea"].includes(n.tag))
        controls.push(
          JSON.stringify({
            tag: n.tag,
            props: n.props
              .filter((p) => p.name !== "aria-describedby")
              .map((p) => p.loc.source)
              .sort(),
          }),
        );
    }
    for (const c of n.children ?? []) walk(c);
  }
  walk(baseParse(parse(source).descriptor.template.content));
  return {
    directives: directives.sort(),
    controls: controls.sort(),
    expressions: expressions.sort(),
  };
}
test("P43 create composition preserves full script, conditions, bindings, native fields and other dialogs", () => {
  const original = read(child),
    updated = userCreatePreview(original);
  assert.deepEqual(parse(updated).errors, []);
  assert.equal(
    parse(updated).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(contracts(updated), contracts(original));
  const marker = '<dialog ref="passwordDialogElement"';
  assert.equal(updated.slice(updated.indexOf(marker)), original.slice(original.indexOf(marker)));
  assert.throws(
    () => userCreatePreview(original.replace("<h3>{{ createUserTitle }}</h3>", "<h3>drift</h3>")),
    /drift/,
  );
});
test("P43 creation evidence pins current production plus review-only composition and every PNG", () => {
  const e = JSON.parse(read(`${folder}/evidence.json`));
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 293);
  assert.equal(e.screenshots.length, 86);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  assert.equal(e.transformedHashes[child], hash(userCreatePreview(read(child))));
  assert.equal(e.transformedHashes[parent], hash(userPagePreview(read(parent), "parent")));
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256);
    assert.equal(s.routeId, "P43");
    assert.equal(new URL(s.concreteUrl).pathname, "/platform-admin/users");
    assert.equal(s.sourceSha, hash(JSON.stringify(e.sourceHashes)));
  }
});
test("P43 actual parent submits exact five-field fixture payloads with unchanged null defaults", () => {
  const e = JSON.parse(read(`${folder}/evidence.json`));
  assert.deepEqual(
    e.requestsByWidth.map((r) => r.width),
    [390, 760, 761, 1440],
  );
  for (const r of e.requestsByWidth) {
    assert.equal(r.requests.length, 6);
    const writes = r.requests.filter((v) => v.method === "POST");
    assert.equal(writes.length, 2);
    assert.equal(r.requests.filter((v) => v.method === "GET").length, 4);
    for (const w of writes) {
      assert.equal(w.path, "/api/v1/platform/accounts/users");
      assert.equal(w.idempotencyKeyPresent, true);
      assert.equal(w.body.temporary_password, "[known synthetic value matched]");
      assert.deepEqual(Object.keys(w.body).sort(), [
        "email",
        "organization_id",
        "organization_role_code",
        "platform_role_code",
        "temporary_password",
      ]);
    }
    assert.equal(writes[0].body.organization_role_code, "organization_admin");
    assert.equal(writes[1].body.organization_id, null);
    assert.equal(writes[1].body.platform_role_code, null);
    assert.equal(writes[1].body.organization_role_code, "member");
    const states = e.screenshots.filter((s) => s.viewport.width === r.width).map((s) => s.state);
    assert.equal(states.length, r.width === 390 ? 23 : 21);
    assert.equal(new Set(states).size, states.length);
    for (const state of [
      "default",
      "default-bottom",
      "member",
      "org-admin",
      "failure",
      "failure-bottom",
      "pending",
      "confirm-focus",
      "confirm-hover",
      "confirm-pressed",
      "reopened",
    ])
      assert.ok(states.includes(state));
  }
});
test("P43 review containers avoid legacy action heuristics and have no production import", () => {
  const updated = userCreatePreview(read(child));
  assert.ok(!updated.includes('class="p43-create'));
  assert.ok(!read("apps/web/src/main.ts").includes("user-create-preview"));
  assert.ok(!read(child).includes("p43-user-onboarding"));
  const scope = JSON.parse(read(`${folder}/evidence.json`)).scope;
  assert.match(scope, /review-only template/);
  assert.match(scope, /All GET\/POST intercepted/);
  assert.match(scope, /Not production C/);
});
