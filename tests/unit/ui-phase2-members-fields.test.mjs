import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { assertOrganizationReasonContract } from "../../scripts/lib/ui-phase2-organization-reason-contract.mjs";
import {
  base,
  parentFile,
  dependencies,
  buildMembersReview,
} from "../../scripts/build-ui-phase2-members-review.mjs";
const folder = `${base}/design/members-fields-direction-c`;
const evidence = JSON.parse(readFileSync(`${folder}/evidence.json`, "utf8"));
const parent = JSON.parse(readFileSync(`${base}/design/members-direction-c/evidence.json`, "utf8"));
const controls = JSON.parse(
  readFileSync(`${base}/design/members-controls-direction-c/evidence.json`, "utf8"),
);
const sources = Object.fromEntries(dependencies.map((file) => [file, readFileSync(file, "utf8")]));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  plain = (v) => JSON.parse(JSON.stringify(v));
test("P30 fields bind current source hashes and all 164 unique field/form PNGs", () => {
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  assert.equal(evidence.screenshots.length, 164);
  assert.equal(new Set(evidence.screenshots.map((s) => s.file)).size, 164);
  for (const s of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256, s.file);
  assert.equal(evidence.catalog.length, 10);
  assert.equal(
    evidence.catalog.reduce((n, f) => n + f.states.length, 0),
    74,
  );
  assert.equal(evidence.combinations.length, 8);
  for (const [binding, ref] of Object.entries(evidence.fieldVisualReferences))
    for (const [state, scene] of Object.entries(ref.states))
      for (const width of [1440, 390]) {
        const shots = evidence.screenshots.filter((s) => s.scene === scene && s.width === width);
        assert.equal(shots.length, 1);
        assert.deepEqual(shots[0].control, { selector: ref.selector, binding, state });
      }
});
test("P30 field registry covers three models, six controlled values and shared reason without claiming approval", () => {
  const r = buildMembersReview(sources, parent, controls, evidence);
  const fields = [
    ...r.surfaceReview.inputs.filter((i) => i.file === dependencies[1]),
    ...r.controlledInputs,
    r.sharedReasonInput,
  ];
  assert.equal(fields.length, 10);
  for (const field of fields)
    assert.deepEqual(field.visualReferences, {
      package: "members-fields-direction-c",
      ...evidence.fieldVisualReferences[field.binding ?? field.value],
    });
  assert.equal(r.approval, "pending-user-review");
  for (const mode of ["missing", "extra", "stale"]) {
    const bad = structuredClone(evidence);
    if (mode === "missing") delete bad.fieldVisualReferences.reason;
    if (mode === "extra") bad.fieldVisualReferences.status = {};
    if (mode === "stale") bad.sourceHashes[dependencies[2]] = "stale";
    assert.throws(
      () => buildMembersReview(sources, parent, controls, bad),
      /exact ten members fields|verify current members fields/,
    );
  }
});
test("P30 every fixed-role/filter option is represented without inventing empty required-role or select errors", () => {
  const f = Object.fromEntries(evidence.catalog.map((f) => [f.id, f]));
  const roles = [
    "member",
    "selection_manager",
    "procurement_member",
    "organization_admin",
    "auditor",
  ];
  assert.deepEqual(
    f["invite-role"].options.map((o) => o.value),
    roles,
  );
  assert.deepEqual(
    f["row-role"].options.map((o) => o.value),
    roles,
  );
  assert.deepEqual(
    f.role.options.map((o) => o.value),
    ["", ...roles],
  );
  assert.deepEqual(
    f.status.options.map((o) => o.value),
    ["", "active", "disabled", "locked"],
  );
  assert.deepEqual(
    f.sort.options.map((o) => o.value),
    ["name_asc", "joined_desc", "status_asc"],
  );
  for (const field of evidence.catalog.filter((f) => f.select)) {
    assert.equal(field.states.filter((s) => s.startsWith("option_")).length, field.options.length);
    assert.ok(
      !field.states.includes("invalid") &&
        !field.states.includes("pressed") &&
        !field.states.includes("disabled"),
    );
  }
});
function actualFunction(file, name, bindings) {
  const source = parse(sources[file]).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(fn);
  const box = { exports: {}, ...bindings };
  vm.runInNewContext(
    ts.transpileModule(`${fn.getFullText(ast)} export { ${name} };`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    box,
  );
  return box.exports[name];
}
test("P30 actual shared Vue submit permits 501 characters but rejects trimmed length below two", async () => {
  for (const value of ["", " ", "短", "核验", "因".repeat(501)]) {
    const calls = [];
    actualFunction(dependencies[2], "submit", {
      reason: { value },
      props: {},
      emit: (...args) => calls.push(args),
    })();
    assert.deepEqual(calls, value.trim().length < 2 ? [] : [["submit", value.trim()]]);
  }
  await assertOrganizationReasonContract(sources[dependencies[2]], sources[parentFile]);
  assert.match(sources[dependencies[1]], /v-model="form.reason" required maxlength="500"/);
});
function invitationHarness(formValue, transport = async () => ({ request_id: "offline" })) {
  const calls = [],
    form = { value: formValue };
  const fn = actualFunction(parentFile, "inviteMembers", {
    form,
    busy: { value: false },
    invitationResults: { value: [] },
    noticeKind: { value: "" },
    notice: { value: "" },
    requestId: { value: "" },
    api: async (url, options) => {
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      return transport();
    },
    load: async () => {},
    ApiClientError: class extends Error {},
    applyFailure: () => assert.fail("unexpected failure"),
    rethrowUnexpectedError: (e) => {
      throw e;
    },
  });
  return { fn, form, calls };
}
test("P30 actual invitation function matches mixed/duplicate and 254/255-char preview boundaries", async () => {
  const e254 = "a".repeat(241) + "@example.test",
    e255 = "a".repeat(242) + "@example.test";
  const h = invitationHarness({
    emails: ` GOOD@example.test ;good@example.test\nbad;${e254};${e255}`,
    role_code: "auditor",
    reason: " 核验 ",
  });
  await h.fn();
  assert.deepEqual(
    plain(h.calls),
    ["good@example.test", e254].map((email) => ({
      url: "/org/admin/invitations",
      method: "POST",
      body: { email, role_code: "auditor", reason: "核验" },
    })),
  );
  for (const reason of ["   ", "因".repeat(501)]) {
    const invalid = invitationHarness({ emails: "good@example.test", role_code: "member", reason });
    await invalid.fn();
    assert.deepEqual(invalid.calls, []);
  }
});
test("P30 actual invitation snapshots emails role and reason before an editable in-flight draft changes", async () => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const h = invitationHarness(
    { emails: "first@example.test;second@example.test", role_code: "member", reason: "原原因" },
    async () => {
      await pending;
      return { request_id: "offline" };
    },
  );
  const task = h.fn();
  assert.equal(h.calls.length, 1);
  h.form.value = { emails: "edited@example.test", role_code: "auditor", reason: "新原因" };
  release();
  await task;
  assert.deepEqual(
    plain(h.calls.map((c) => c.body)),
    ["first@example.test", "second@example.test"].map((email) => ({
      email,
      role_code: "member",
      reason: "原原因",
    })),
  );
});
test("P30 field evidence keeps warnings accessible, inputs editable and long reason intentions offline", () => {
  assert.equal(evidence.checks.length, 148);
  assert.equal(evidence.interactions.length, 16);
  for (const c of evidence.checks) {
    const m = c.metrics;
    assert.ok(
      m.label &&
        m.described &&
        m.hit &&
        !m.overflow &&
        !m.disabled &&
        m.font >= 16 &&
        m.width >= 44 &&
        m.height >= 44,
    );
  }
  assert.equal(
    evidence.interactions.filter((i) => i.intentionsOnly && i.length === 501 && i.closed).length,
    8,
  );
  assert.equal(evidence.scope, "proposal-not-Vue-or-user-accepted");
});
