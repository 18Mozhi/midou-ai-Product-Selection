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
import {
  base,
  parentFile,
  childFile,
  dependencies,
  buildRolesReview,
} from "../../scripts/build-ui-phase2-roles-review.mjs";

const sources = Object.fromEntries(
  dependencies.map((f) => [f, readFileSync(f, "utf8").replaceAll("\r\n", "\n")]),
);
const evidence = JSON.parse(readFileSync(`${base}/design/roles-direction-c/evidence.json`, "utf8"));
const packages = new Map([["roles-direction-c", evidence]]);
const context = {
  candidates: [parentFile, childFile].flatMap((f) => scanSource(sources[f], f).candidates),
  sourceHashes: Object.fromEntries(
    Object.entries(sources).map(([f, s]) => [f, createHash("sha256").update(s).digest("hex")]),
  ),
  contracts: runContractAudit().records,
  packages,
  files: new Set(["scripts/verify-ui-phase2-roles-c.mjs"]),
};
const review = () => JSON.parse(readFileSync(`${base}/action-reviews/P31.json`, "utf8"));
const plain = (v) => JSON.parse(JSON.stringify(v));

test("P31 covers 30 sites with 20 actions, six exact forwards and no implied approval", () => {
  const r = review(),
    result = validateActionReview(r, context);
  assert.equal(result.sourceSites, 30);
  assert.equal(result.semanticGroups, 24);
  assert.equal(result.routeActions, 20);
  assert.equal(result.writeActions, 3);
  assert.equal(result.wiringGroups, 1);
  assert.equal(result.excludedGroups, 3);
  assert.equal(result.unmappedVisualSlots, 120);
  const wire = r.actions.find((a) => a.kind === "wiring");
  assert.equal(wire.forwardBindings.length, 6);
  assert.equal(wire.forwardsTo.length, 8);
  assert.deepEqual(r, buildRolesReview(sources, evidence));
});
test("P31 preserves explicit F04 source semantics rather than deriving them from button text", () => {
  for (const a of review().actions)
    for (const id of a.sourceCandidateIds)
      assert.ok(
        context.contracts.some(
          (r) =>
            r.candidateId === id &&
            r.document !== review().contract &&
            ["identity-current", "line-moved"].includes(r.status) &&
            a.priorContractKeys.some((key) => r.claim.includes(key)),
        ),
        id,
      );
});
test("P31 registers 20 models, one controlled type and shared reason separately", () => {
  const r = review(),
    result = validateReviewSurfaces(r.surfaceReview, { sources, packages });
  assert.equal(result.localModelBindings, 20);
  assert.equal(result.callerContainers, 4);
  assert.equal(result.consumerVariants, 11);
  const values = [];
  function visit(n) {
    if (n.type === 1 && ["input", "textarea", "select"].includes(n.tag)) {
      const binding = n.props.find(
        (p) => p.type === 7 && p.name === "bind" && p.arg?.content === "value",
      );
      // Checkbox :value=action is an option value, not a controlled field.
      if (binding && !n.props.some((p) => p.type === 7 && p.name === "model"))
        values.push(binding.exp.content);
    }
    for (const c of n.children ?? []) visit(c);
  }
  visit(baseParse(parse(sources[childFile]).descriptor.template.content));
  assert.deepEqual(
    values,
    r.controlledInputs.map((i) => i.value),
  );
  assert.equal(r.sharedReasonInput.maximumLength, null);
  assert.doesNotMatch(sources[dependencies[2]], /maxlength=/);
  assert.match(sources[childFile], /v-model.trim="grantForm.reason" required maxlength="500"/);
});
test("P31 rejects omitted identities, changed wiring, fields, stale sources and invented approval", () => {
  for (const mutation of ["omit", "handler", "target", "approval"]) {
    const r = review(),
      wire = r.actions.find((a) => a.kind === "wiring");
    if (mutation === "omit") r.actions.pop();
    if (mutation === "handler") wire.forwardBindings[0].handler = "invented";
    if (mutation === "target") wire.forwardsTo.push("unknown");
    if (mutation === "approval") r.approval = "approved";
    assert.throws(() => validateActionReview(r, context));
  }
  const r = review();
  r.surfaceReview.inputs.pop();
  assert.throws(
    () => validateReviewSurfaces(r.surfaceReview, { sources, packages }),
    /input omissions/,
  );
  assert.throws(
    () =>
      buildRolesReview(
        { ...sources, [childFile]: sources[childFile] + "\n<!-- drift -->" },
        evidence,
      ),
    /verify current roles proposal/,
  );
});
test("P31 keeps 48 contextual images distinct from 120 exact missing state references", () => {
  assert.equal(evidence.screenshots.length, 48);
  for (const a of review().actions.filter((a) => !["wiring", "excluded"].includes(a.kind))) {
    assert.ok(Object.values(a.visualStates).every((v) => v === "not-mapped"));
    assert.equal(a.visualStateReferences, undefined);
  }
  const missing = structuredClone(evidence);
  missing.screenshots = missing.screenshots.filter(
    (s) => !(s.scene === "revoke" && (s.width ?? s.viewport.width) === 390),
  );
  assert.throws(
    () =>
      validateActionReview(review(), {
        ...context,
        packages: new Map([["roles-direction-c", missing]]),
      }),
    /missing scene\/viewport/,
  );
});

const ref = (value) => ({ value });
const computed = (fn) => ({
  get value() {
    return fn();
  },
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
const frozen = Date.parse("2026-08-28T10:00:00.000Z");
class ReviewDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [frozen]));
  }
  static now() {
    return frozen;
  }
}
function childHarness() {
  const box = { window: {} };
  vm.runInNewContext(readFileSync(`${base}/design/roles-direction-c/data.js`, "utf8"), box);
  const d = plain(box.window.SCOUTOPS_ROLE_DESIGN);
  const props = {
    ...d,
    grants: [d.grant],
    workspaces: [d.workspace],
    grantMeta: { total: 1, limit: 20, page: 1 },
    grantCounts: { active: 1, expired: 0, revoked: 0 },
    capabilities: ["organization:manage", "membership:manage", "audit:read"],
    grantTargets: d.members.filter((m) => d.grantTargets.includes(m.id)),
    capabilityText: (v) =>
      ({
        "organization:manage": "管理组织",
        "membership:manage": "管理成员",
        "audit:read": "审计记录",
        "opportunity:read": "查看机会",
        "opportunity:decide": "采纳机会",
      })[v] ?? v,
  };
  const script = parse(sources[childFile]).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile("child.ts", script, ts.ScriptTarget.Latest, true);
  const watches = [];
  const exposed = [
    "roleQuery",
    "filteredRoles",
    "selectedRole",
    "selectedRoleCode",
    "capabilityQuery",
    "capabilityGroup",
    "filteredCapabilities",
    "scopeCounts",
    "scopeQuery",
    "scopeFilter",
    "filteredScopeMembers",
    "grantQuery",
    "filteredGrants",
    "selectedGrant",
    "grantMutation",
    "minGrantExpiry",
    "maxGrantExpiry",
    "canManage",
  ];
  const h = run(
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast))
      .join("\n") + `\nexport {${exposed.join(",")}}`,
    {
      ref,
      computed,
      Date: ReviewDate,
      defineProps: () => props,
      defineEmits: () => () => {},
      watch: (source, cb, opts) => {
        watches.push({ source, cb });
        if (opts?.immediate) cb(typeof source === "function" ? source() : source.value);
      },
    },
  );
  return { h, props, watches };
}
test("P31 actual computed search boundaries distinguish roles, raw capabilities and current-page grants", () => {
  const { h, props } = childHarness();
  assert.equal(h.filteredRoles.value.length, 2);
  h.roleQuery.value = props.roles[0].code;
  assert.equal(h.filteredRoles.value.length, 0);
  h.roleQuery.value = "  审计  ";
  assert.equal(h.selectedRole.value.code, "auditor");
  h.capabilityQuery.value = "AUDIT:READ";
  assert.deepEqual(plain(h.filteredCapabilities.value), ["audit:read"]);
  h.capabilityGroup.value = "供应链";
  assert.equal(h.filteredCapabilities.value.length, 0);
  h.grantQuery.value = props.grants[0].resource_id;
  assert.equal(h.filteredGrants.value.length, 0);
  h.grantQuery.value = props.grants[0].reason;
  assert.equal(h.filteredGrants.value.length, 0);
  h.grantQuery.value = "采购";
  assert.equal(h.filteredGrants.value.length, 1);
});
test("P31 actual scope counts overlap and permission derives from capability not selected role", () => {
  const { h, props } = childHarness();
  assert.deepEqual(plain(h.scopeCounts.value), { own: 0, team: 0, workspace: 1, organization: 2 });
  props.members[0].scopes.push("workspace");
  assert.equal(
    Object.values(h.scopeCounts.value).reduce((a, b) => a + b, 0),
    4,
  );
  h.scopeQuery.value = "采购协作组";
  h.scopeFilter.value = "workspace";
  assert.equal(h.filteredScopeMembers.value.length, 1);
  props.authorization.capabilities = ["role:read"];
  h.selectedRoleCode.value = props.roles[0].code;
  assert.equal(h.canManage.value, false);
});
test("P31 manually invoked actual watcher reproduces refresh draft reset without claiming mounted Vue", () => {
  const { h, props, watches } = childHarness();
  assert.equal(watches.length, 3);
  h.grantMutation.value.reason = "未提交的新原因";
  watches[2].cb({ ...props.grants[0] });
  assert.equal(h.grantMutation.value.reason, "");
  assert.equal(new Date(h.grantMutation.value.expires_at).valueOf(), frozen + 7 * 86400000);
  h.grantMutation.value.reason = "筛选后仍留存";
  watches[2].cb(undefined);
  assert.equal(h.grantMutation.value.reason, "筛选后仍留存");
  assert.equal(new Date(h.minGrantExpiry).valueOf(), frozen + 60000);
  assert.equal(new Date(h.maxGrantExpiry).valueOf(), frozen + 30 * 86400000);
});
function parentHarness(overrides = {}) {
  const names = [
    "defaultGrantExpiry",
    "updateResourceGrantType",
    "validateGrantExpiry",
    "createResourceGrant",
    "updateResourceGrantStatus",
    "updateResourceGrantPage",
    "extendResourceGrant",
    "revokeResourceGrant",
  ];
  const ast = ts.createSourceFile(
    "parent.ts",
    parse(sources[parentFile]).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const nodes = ast.statements.filter(
    (n) =>
      (ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) ||
      (ts.isVariableStatement(n) &&
        n.declarationList.declarations.some((d) => d.name.getText(ast) === "resourceActions")),
  );
  assert.equal(nodes.length, names.length + 1);
  const calls = [],
    submits = [],
    loads = [];
  const b = {
    Date: ReviewDate,
    busy: ref(false),
    refreshing: ref(false),
    props: { organizationId: "org-a" },
    resourceGrantPage: ref(3),
    resourceGrantStatus: ref("active"),
    resourceGrantForm: ref({
      workspace_id: "workspace-a",
      resource_type: "opportunity",
      resource_id: "resource-a",
      grantee_membership_id: "member-a",
      actions: ["opportunity:read", "opportunity:read"],
      reason: " 核对报价 ",
      expires_at: "2026-09-01T10:00:00.000Z",
    }),
    notice: ref(""),
    noticeKind: ref(""),
    requestId: ref(""),
    api: async (...args) => {
      calls.push(args);
      return { request_id: "write-a" };
    },
    submit: async (...args) => {
      submits.push(args);
      return true;
    },
    load: async (...args) => {
      loads.push(args);
    },
    auditedReason: async () => "核验撤销",
    applyFailure: () => assert.fail("unexpected failure"),
    rethrowUnexpectedError: (e) => {
      throw e;
    },
    ApiClientError: class extends Error {},
    ...overrides,
  };
  const h = run(
    nodes.map((n) => n.getFullText(ast)).join("\n") +
      `\nexport {${names.join(",")},resourceActions}`,
    b,
  );
  return { h, b, calls, submits, loads };
}
test("P31 actual create keeps exact payload, deduplicates actions and resets only existing success fields", async () => {
  const { h, b, calls, loads } = parentHarness();
  await h.createResourceGrant();
  assert.equal(calls[0][0], "/org/org-a/resource-grants");
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    workspace_id: "workspace-a",
    resource_type: "opportunity",
    resource_id: "resource-a",
    grantee_membership_id: "member-a",
    actions: ["opportunity:read"],
    reason: "核对报价",
    expires_at: "2026-09-01T10:00:00.000Z",
  });
  assert.equal(b.resourceGrantForm.value.workspace_id, "workspace-a");
  assert.equal(b.resourceGrantForm.value.resource_id, "");
  assert.equal(b.resourceGrantStatus.value, "all");
  assert.equal(b.resourceGrantPage.value, 1);
  assert.deepEqual(plain(loads), [[{ background: true, preserveNotice: true }]]);
});
test("P31 actual expiry rejects now/past/invalid/over30 days and busy or empty actions never submit", async () => {
  const { h, b, calls } = parentHarness();
  for (const v of [
    "invalid",
    new Date(frozen).toISOString(),
    new Date(frozen - 1).toISOString(),
    new Date(frozen + 30 * 86400000 + 1).toISOString(),
  ])
    assert.equal(h.validateGrantExpiry(v), null);
  assert.equal(
    h.validateGrantExpiry(new Date(frozen + 30 * 86400000).toISOString()),
    new Date(frozen + 30 * 86400000).toISOString(),
  );
  b.busy.value = true;
  await h.createResourceGrant();
  b.busy.value = false;
  b.resourceGrantForm.value.actions = [];
  await h.createResourceGrant();
  assert.equal(calls.length, 0);
});
test("P31 actual type changes keep four whitelists and reproduce in-flight draft clearing", async () => {
  let finish;
  const calls = [];
  const { h, b } = parentHarness({
    api: (...args) => {
      calls.push(args);
      return new Promise((r) => {
        finish = r;
      });
    },
  });
  assert.deepEqual(plain(h.resourceActions), {
    task: ["task:read", "task:update"],
    opportunity: ["opportunity:read", "opportunity:decide"],
    competitor: ["competitor:read"],
    sourcing: ["sourcing:read", "supplier_quote:manage", "cost:confirm"],
  });
  const pending = h.createResourceGrant();
  h.updateResourceGrantType("sourcing");
  b.resourceGrantForm.value.resource_id = "later-resource";
  b.resourceGrantForm.value.reason = "后来草稿";
  finish({ request_id: "original" });
  await pending;
  assert.equal(JSON.parse(calls[0][1].body).resource_id, "resource-a");
  assert.equal(b.resourceGrantForm.value.resource_type, "sourcing");
  assert.equal(b.resourceGrantForm.value.resource_id, "");
  assert.equal(b.resourceGrantForm.value.reason, "");
  assert.deepEqual(plain(b.resourceGrantForm.value.actions), ["sourcing:read"]);
});
test("P31 actual extend and revoke carry versions and cancelled reason causes zero writes", async () => {
  const { h, submits } = parentHarness();
  const grant = { id: "grant-a", version: 7, expires_at: "2026-09-20T10:00:00.000Z" };
  await h.extendResourceGrant({
    grant,
    reason: " 核对有效期 ",
    expires_at: "2026-09-01T10:00:00.000Z",
  });
  await h.revokeResourceGrant(grant);
  assert.deepEqual(plain(submits), [
    [
      "/org/org-a/resource-grants/grant-a/expiry",
      { expected_version: 7, reason: "核对有效期", expires_at: "2026-09-01T10:00:00.000Z" },
      "PATCH",
      { preserveForm: true },
    ],
    [
      "/org/org-a/resource-grants/grant-a/revoke",
      { expected_version: 7, reason: "核验撤销" },
      "POST",
      { preserveForm: true },
    ],
  ]);
  const cancelled = parentHarness({ auditedReason: async () => null });
  await cancelled.h.revokeResourceGrant(grant);
  assert.equal(cancelled.submits.length, 0);
});
test("P31 actual revoke reads changed organization and grant version after reason await (unfixed)", async () => {
  let answer;
  const { h, b, submits } = parentHarness({
    auditedReason: () =>
      new Promise((r) => {
        answer = r;
      }),
  });
  const grant = { id: "grant-a", version: 7 },
    pending = h.revokeResourceGrant(grant);
  b.props.organizationId = "org-b";
  grant.version = 8;
  answer("继续撤销");
  await pending;
  assert.equal(submits[0][0], "/org/org-b/resource-grants/grant-a/revoke");
  assert.equal(submits[0][1].expected_version, 8);
});
test("P31 actual status and page readers reset or reject in-flight edits without local paging", async () => {
  const { h, b, loads } = parentHarness();
  b.refreshing.value = true;
  await h.updateResourceGrantStatus("revoked");
  await h.updateResourceGrantPage(2);
  assert.equal(loads.length, 0);
  assert.equal(b.resourceGrantPage.value, 3);
  b.refreshing.value = false;
  await h.updateResourceGrantStatus("expired");
  assert.equal(b.resourceGrantPage.value, 1);
  assert.equal(b.resourceGrantStatus.value, "expired");
  await h.updateResourceGrantPage(0);
  assert.equal(loads.length, 1);
  await h.updateResourceGrantPage(2);
  assert.equal(loads.length, 2);
});
