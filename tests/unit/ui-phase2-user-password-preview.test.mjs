import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import test from "node:test";
import { historicalUserCreationSource } from "../../scripts/lib/ui-phase2-user-creation-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { userPasswordPreview } from "../../scripts/lib/ui-phase2-user-password-preview.mjs";
import { userPagePreview } from "../../scripts/lib/ui-phase2-user-page-preview.mjs";
const read = (f) =>
  historicalAdminResultsSource(f, readFileSync(f, "utf8").replaceAll("\r\n", "\n"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const child = "apps/web/src/components/PlatformAccountDialogs.vue";
const folder = "output/playwright/p43-password-vue-preview";
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
test("P43 password/reason composition preserves scripts, all native controls and original creation dialog", () => {
  const source = read(child),
    result = userPasswordPreview(source);
  assert.deepEqual(parse(result).errors, []);
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  assert.deepEqual(contracts(result), contracts(source));
  const first = (value) =>
    baseParse(parse(value).descriptor.template.content).children.find((n) => n.type === 1).loc
      .source;
  assert.equal(first(result), first(source));
  assert.throws(
    () => userPasswordPreview(source.replace("<h3>强制重置密码</h3>", "<h3>changed</h3>")),
    /drift/,
  );
});
test("P43 password captures have exact historical source revisions, transformed code and88 images", () => {
  const e = JSON.parse(read(folder + "/evidence.json"));
  assert.equal(e.kind, "P43-PASSWORD-VUE-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 415);
  assert.equal(e.screenshots.length, 88);
  assert.equal(Object.keys(e.sourceHashes).length, 40);
  for (const [f, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(historicalUserCreationSource(f, read(f))), sha, f);
  for (const [file, surface] of [
    ["apps/web/src/components/PlatformAccountCenter.vue", "parent"],
    ["apps/web/src/components/PlatformUserDetailDialog.vue", "detail"],
  ])
    assert.equal(
      e.transformedHashes[file],
      hash(userPagePreview(historicalUserCreationSource(file, read(file)), surface)),
    );
  assert.equal(e.transformedHashes[child], hash(userPasswordPreview(read(child))));
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(folder + "/" + s.file)), s.sha256, s.file);
});
test("P43 two-step current flow waits in password dialog and preserves original exact write contract", () => {
  const e = JSON.parse(read(folder + "/evidence.json"));
  assert.deepEqual(
    e.observations.map((o) => o.width),
    [390, 760, 761, 1440],
  );
  for (const o of e.observations) {
    assert.deepEqual(
      o.requests.map((r) => r.method),
      ["GET", "GET", "POST", "POST", "GET"],
    );
    assert.deepEqual(o.errors, []);
    assert.deepEqual(o.unexpected, []);
    const writes = o.requests.filter((r) => r.method === "POST");
    assert.deepEqual(
      writes.map((r) => r.mode),
      ["failure", "success"],
    );
    for (const w of writes) {
      assert.equal(
        w.path,
        "/api/v1/platform/accounts/users/00000000-0000-4000-8000-000000000621/password",
      );
      assert.equal(w.idempotencyKeyPresent, true);
      assert.deepEqual(Object.keys(w.body).sort(), ["reason", "temporary_password"]);
      assert.equal(w.body.temporary_password, "[known synthetic value matched]");
      assert.equal(w.body.reason, "隔离审核样例：核对账号登录状态后重置临时密码。");
    }
    const checks = e.checks.filter((c) => c.width === o.width);
    const get = (name) => {
      const found = checks.filter((c) => c.name === name);
      assert.equal(found.length, 1, name);
      return found[0].actual;
    };
    assert.equal(get("first confirmation sends no write"), 0);
    assert.equal(get("reason closes before original write"), false);
    assert.equal(get("all invalid confirmation writes blocked"), 0);
    assert.equal(get("reason cancel returns password confirm"), true);
    assert.equal(get("failure remains in password dialog"), true);
    assert.equal(get("success all three dialogs closed"), 0);
    const states = e.screenshots.filter((s) => s.width === o.width).map((s) => s.state);
    assert.equal(states.length, o.width === 390 ? 25 : 21);
    assert.equal(new Set(states).size, states.length);
    for (const state of [
      "password-default",
      "password-confirm-pressed",
      "reason-default",
      "reason-confirm-pressed",
      "password-pending",
      "password-failure",
    ])
      assert.ok(states.includes(state));
  }
});
test("P43 two-step review does not claim target ownership, actual credential change or production import", () => {
  assert.ok(!read(folder + "/evidence.json").includes("PreviewOnly-123"));
  const e = JSON.parse(read(folder + "/evidence.json"));
  assert.match(e.scope, /Not target ownership/);
  assert.match(e.scope, /real RBAC\/SQL\/audit\/MFA/);
  assert.ok(!read("apps/web/src/main.ts").includes("user-password-preview"));
  assert.ok(!read(child).includes("p43-security-sheet"));
});
