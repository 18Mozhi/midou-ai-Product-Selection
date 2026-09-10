import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildMembersDesignData } from "../../scripts/lib/ui-phase2-members-design-data.mjs";
import {
  base,
  parentFile,
  childFile,
  dependencies,
  buildMembersReview as buildReview,
} from "../../scripts/build-ui-phase2-members-review.mjs";

const sources = Object.fromEntries(
  dependencies.map((file) => [file, readFileSync(file, "utf8").replaceAll("\r\n", "\n")]),
);
const evidence = JSON.parse(
  readFileSync(`${base}/design/members-direction-c/evidence.json`, "utf8"),
);
const controlsEvidence = JSON.parse(
  readFileSync(`${base}/design/members-controls-direction-c/evidence.json`, "utf8"),
);
const fieldEvidence = JSON.parse(
  readFileSync(`${base}/design/members-fields-direction-c/evidence.json`, "utf8"),
);
const buildMembersReview = (sources, evidence) =>
  buildReview(sources, evidence, controlsEvidence, fieldEvidence);
const packages = new Map([
  ["members-direction-c", evidence],
  ["members-controls-direction-c", controlsEvidence],
  ["members-fields-direction-c", fieldEvidence],
]);
const context = {
  candidates: [parentFile, childFile].flatMap((file) => scanSource(sources[file], file).candidates),
  sourceHashes: Object.fromEntries(
    Object.entries(sources).map(([file, s]) => [
      file,
      createHash("sha256").update(s).digest("hex"),
    ]),
  ),
  contracts: runContractAudit().records,
  packages,
  files: new Set([
    "scripts/verify-ui-phase2-members-c.mjs",
    "scripts/verify-ui-phase2-members-controls-c.mjs",
  ]),
};
const review = () => JSON.parse(readFileSync(`${base}/action-reviews/P30.json`, "utf8"));
const plain = (v) => JSON.parse(JSON.stringify(v));

test("P30 registers all 28 local sites without duplicating parent event forwards", () => {
  const r = validateActionReview(review(), context);
  assert.equal(r.sourceSites, 28);
  assert.equal(r.semanticGroups, 23);
  assert.equal(r.routeActions, 19);
  assert.equal(r.wiringGroups, 1);
  assert.equal(r.excludedGroups, 3);
  assert.equal(r.writeActions, 4);
  assert.equal(r.unmappedVisualSlots, 30);
  assert.deepEqual(review(), buildMembersReview(sources, evidence));
});
test("P30 registers thirteen exact event forwards, including both tabs and both pages", () => {
  const r = review(),
    wire = r.actions.find((a) => a.kind === "wiring");
  assert.equal(wire.forwardBindings.length, 13);
  assert.equal(wire.forwardsTo.length, 15);
  for (const suffix of ["query", "status", "role", "team", "sort"])
    assert.match(
      wire.forwardBindings.find((e) => e.event === `@update-member-${suffix}`).handler,
      /memberPage = 1/,
    );
  assert.deepEqual(wire.forwardBindings.find((e) => e.event === "@update-member-page").targets, [
    "OG-M-PREV",
    "OG-M-NEXT",
  ]);
  const reset = wire.forwardBindings.find((e) => e.event === "@reset-member-filters");
  assert.doesNotMatch(reset.handler, /invitationTab|form|memberRoles/);
});

test("P30 multiline event handlers render as thirteen intact Markdown rows without changing JSON", () => {
  const report = readFileSync(`${base}/ACTION-COVERAGE-REVIEW.md`, "utf8");
  const rows = report.split(/\r?\n/).filter((line) => line.startsWith("| WIRE-MEMBERS |"));
  const wire = review().actions.find((a) => a.kind === "wiring");
  assert.equal(rows.length, 13);
  for (const [i, edge] of wire.forwardBindings.entries()) {
    assert.equal(
      rows[i],
      `| WIRE-MEMBERS | ${edge.event} / ${edge.handler.replaceAll("|", "\\|").replace(/\s+/gu, " ").trim()} | ${edge.targets.join("、")} |`,
    );
    assert.equal(rows[i].split("|").length, 5);
  }
  assert.match(wire.forwardBindings.find((e) => e.event === "@update-member-query").handler, /\n/);
});
test("P30 distinguishes nine local models from six controlled values and shared reason input", () => {
  const r = review();
  const result = validateReviewSurfaces(r.surfaceReview, { sources, packages });
  assert.equal(result.localModelBindings, 9); // Six summary-only models plus three visible invite models.
  assert.equal(result.callerContainers, 3);
  assert.equal(result.consumerVariants, 13);
  const values = [];
  function visit(node) {
    if (node.type === 1 && ["input", "select", "textarea"].includes(node.tag)) {
      const binding = node.props.find(
        (p) => p.type === 7 && p.name === "bind" && p.arg?.content === "value",
      );
      if (binding) values.push(binding.exp.content);
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(parse(sources[childFile]).descriptor.template.content));
  assert.deepEqual(
    r.controlledInputs.map((i) => i.value),
    values,
  );
  assert.equal(values.length, 6);
  assert.equal(r.sharedReasonInput.binding, "reason");
  assert.equal(r.sharedReasonInput.maximumLength, null);
  assert.match(sources[childFile], /v-model="form.reason" required maxlength="500"/);
  assert.doesNotMatch(sources[dependencies[2]], /maxlength=/);
});
test("P30 four shared reason variants do not imply a dialog for invitation creation or other routes", () => {
  const r = review(),
    containers = r.surfaceReview.containers;
  assert.equal(containers[0].variants[0].evidenceScope, "route-excluded-reference");
  assert.deepEqual(
    containers[1].variants.map((v) => v.name),
    ["reason_disable", "reason_restore", "reason_role", "reason_revoke"],
  );
  assert.ok(containers[2].variants.every((v) => v.evidenceScope === "matching-inline-form-scene"));
  assert.equal(r.actions.find((a) => a.actionId === "D-OG-REASON").kind, "local");
  assert.match(r.dialogs.remaining, /不是四独立dialog/);
});
test("P30 refuses invented completion, missing source identities and stale dependencies", () => {
  const missing = review();
  missing.actions.pop();
  assert.throws(() => validateActionReview(missing, context), /forward target|unmapped candidates/);
  const accepted = review();
  accepted.approval = "approved";
  assert.throws(() => validateActionReview(accepted, context), /cannot grant approval/);
  const drift = { ...sources, [dependencies[2]]: sources[dependencies[2]] + "\n<!-- drift -->" };
  assert.throws(() => buildMembersReview(drift, evidence), /verify current members proposal/);
  const input = review();
  input.surfaceReview.inputs.pop();
  assert.throws(
    () => validateReviewSurfaces(input.surfaceReview, { sources, packages }),
    /input omissions/,
  );
});
test("P30 rejects missing events, changed handlers and unresolved forwarding targets", () => {
  for (const change of ["omit", "handler", "target"]) {
    const r = review(),
      wire = r.actions.find((a) => a.kind === "wiring");
    if (change === "omit") wire.forwardBindings.pop();
    if (change === "handler") wire.forwardBindings[0].handler = "inventedInvite";
    if (change === "target") {
      wire.forwardsTo.push("unknown");
      wire.forwardBindings[0].targets = ["unknown"];
    }
    assert.throws(() => validateActionReview(r, context), /forward event|forward target/);
  }
});
test("P30 keeps contextual screenshots separate from exact control-state approval", () => {
  const r = review();
  assert.equal(evidence.screenshots.length, 94);
  for (const a of r.actions.filter((a) => !["wiring", "excluded"].includes(a.kind))) {
    assert.ok(Object.values(a.visualStates).some((v) => v === "scene-reference-not-acceptance"));
    assert.ok(
      Object.values(a.visualStateReferences).every(
        (ref) => ref.package === "members-controls-direction-c",
      ),
    );
  }
  const missing = structuredClone(evidence);
  missing.screenshots = missing.screenshots.filter(
    (s) => !(s.scene === "reason_role" && s.width === 390),
  );
  assert.throws(
    () =>
      validateActionReview(r, {
        ...context,
        packages: new Map([...packages, ["members-direction-c", missing]]),
      }),
    /missing scene\/viewport/,
  );
});
test("P30 existing source function checks retain exact bodies and reproduce interrupted invitation tail loss", async () => {
  const data = await buildMembersDesignData(process.cwd());
  assert.equal(data.members.items.length, 3);
  assert.equal(data.unauthorized.calls.length, 1);
  assert.equal(data.unauthorized.form.emails, "a@example.test");
  assert.match(data.unauthorized.notice, /处理完成/);
  assert.deepEqual(Object.keys(data.contracts.role.body).sort(), [
    "expected_version",
    "reason",
    "role_code",
  ]);
  assert.deepEqual(Object.keys(data.contracts.disable.body).sort(), [
    "action",
    "expected_version",
    "reason",
  ]);
  assert.equal(data.contracts.restore.body.action, "restore");
});
function run(code, bindings) {
  const box = { exports: {}, ...bindings };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    box,
  );
  return box.exports;
}
test("P30 shared reason replaces an earlier ask and closes before the selected answer continues", async () => {
  const source = sources[dependencies[3]],
    ast = ts.createSourceFile("reason.ts", source, ts.ScriptTarget.Latest, true);
  const h = run(
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast))
      .join("\n"),
    {
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
    },
  ).useAuditedReason();
  const first = h.ask({ title: "禁用原因" });
  const second = h.ask({ title: "角色原因", initialValue: "分配普通成员" });
  assert.equal(await first, null);
  assert.equal(h.request.value.minimumLength, 2);
  h.submit("核验");
  assert.equal(h.open.value, false);
  assert.equal(await second, "核验");
  const third = h.ask({ title: "撤销" });
  h.cancel();
  assert.equal(await third, null);
});
test("P30 role_code is selected before awaiting a reason and not changed by a later selection", async () => {
  const source = sources[parentFile],
    ast = ts.createSourceFile("parent.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "assignRole",
  );
  assert.ok(fn);
  const calls = [],
    memberRoles = { value: { m: "auditor" } };
  let answer;
  const h = run(`${fn.getFullText(ast)} export { assignRole };`, {
    memberRoles,
    roleText: (value) => value,
    auditedReason: () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
    submit: async (...args) => calls.push(args),
  });
  const pending = h.assignRole({ id: "m", version: 7, roles: ["member"] });
  memberRoles.value.m = "organization_admin";
  answer("核验角色");
  await pending;
  assert.deepEqual(plain(calls[0]), [
    "/org/admin/members/m/roles",
    { role_code: "auditor", expected_version: 7, reason: "核验角色" },
    "POST",
    { preserveForm: true },
  ]);
});
