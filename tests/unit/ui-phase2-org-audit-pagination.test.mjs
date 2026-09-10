import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const file = "apps/web/src/components/OrganizationAdminCenter.vue";
const source = readFileSync(file, "utf8")
  .split(/<script setup[^>]*>/)[1]
  .split("</script>")[0];
const ast = ts.createSourceFile("parent.ts", source, ts.ScriptTarget.Latest, true);
const fn = (name) =>
  ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast);
const filters = () => ({
  action: "",
  outcome: "",
  resource_type: "",
  request_id: "",
  trace_id: "",
  occurred_from: "",
  occurred_to: "",
});
function setup() {
  class ApiClientError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
    }
  }
  const failures = [],
    pending = [];
  const box = {
    URLSearchParams,
    ApiClientError,
    loadSequence: 1,
    props: { organizationId: "synthetic-org-a", routePath: "/org-admin/audit" },
    auditFilters: { value: filters() },
    busy: { value: false },
    data: { value: { items: [{ id: "first" }], nextCursor: "cursor-1" } },
    requestId: { value: "original-request" },
    notice: { value: "original-notice" },
    noticeKind: { value: "info" },
    state: { value: "ready" },
    api: (path) => new Promise((resolve, reject) => pending.push({ path, resolve, reject })),
    applyFailure: (error, replace) => failures.push({ error, replace }),
    rethrowUnexpectedError: (error) => {
      if (!(error instanceof ApiClientError)) throw error;
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      fn("auditPath") + "\n" + fn("loadAuditPage") + "\nglobalThis.read=loadAuditPage;",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  return { box, pending, failures, ApiClientError };
}
const plain = (v) => JSON.parse(JSON.stringify(v));
const response = {
  data: { items: [{ id: "next" }], nextCursor: "cursor-2" },
  request_id: "page-request",
};

test("P37 normal page appends once with exact cursor and normal first-page filter replaces", async () => {
  const { box, pending } = setup();
  let p = box.read(filters(), true);
  assert.equal(box.busy.value, true);
  await box.read(filters(), true);
  assert.equal(pending.length, 1);
  assert.equal(
    pending[0].path,
    "/organizations/synthetic-org-a/audit-events?limit=50&cursor=cursor-1",
  );
  pending[0].resolve(response);
  await p;
  assert.deepEqual(plain(box.data.value), {
    items: [{ id: "first" }, { id: "next" }],
    nextCursor: "cursor-2",
  });
  assert.equal(box.busy.value, false);
  assert.equal(box.requestId.value, "page-request");
  p = box.read({ ...filters(), action: " selected " });
  assert.equal(
    pending[1].path,
    "/organizations/synthetic-org-a/audit-events?limit=50&action=selected",
  );
  pending[1].resolve(response);
  await p;
  assert.deepEqual(plain(box.data.value), response.data);
});
test("P37 refresh generation rejects old page before or after refreshed data arrives", async () => {
  for (const replace of [false, true]) {
    const { box, pending } = setup(),
      p = box.read(filters(), true);
    box.loadSequence++;
    if (replace) box.data.value = { items: [{ id: "refreshed" }], nextCursor: null };
    box.requestId.value = "new-request";
    box.notice.value = "new-notice";
    const snapshot = plain(box.data.value);
    pending[0].resolve(response);
    await p;
    assert.deepEqual(plain(box.data.value), snapshot);
    assert.equal(box.requestId.value, "new-request");
    assert.equal(box.notice.value, "new-notice");
    assert.equal(box.busy.value, false);
  }
});
test("P37 replaced list and changed organization/route reject stale success", async () => {
  for (const change of [
    (b) => {
      b.data.value = { items: [{ id: "replacement" }], nextCursor: null };
    },
    (b) => {
      b.props.organizationId = "synthetic-org-b";
    },
    (b) => {
      b.props.routePath = "/org-admin/tokens";
    },
  ]) {
    const { box, pending } = setup(),
      p = box.read(filters(), true);
    change(box);
    const before = plain(box.data.value);
    pending[0].resolve(response);
    await p;
    assert.deepEqual(plain(box.data.value), before);
    assert.equal(box.requestId.value, "original-request");
    assert.equal(box.busy.value, false);
  }
});
test("P37 late API failures cannot replace newer success, permission or notice state", async () => {
  for (const kind of ["error", "forbidden", "expired", "conflict", "blocked", "rate_limited"]) {
    const { box, pending, failures, ApiClientError } = setup(),
      p = box.read(filters(), true);
    box.loadSequence++;
    box.state.value = "forbidden";
    box.notice.value = "new-permission-notice";
    pending[0].reject(new ApiClientError(kind));
    await p;
    assert.deepEqual(failures, []);
    assert.equal(box.state.value, "forbidden");
    assert.equal(box.notice.value, "new-permission-notice");
    assert.equal(box.busy.value, false);
  }
});
test("P37 current failures retain existing page-replacement rules and unexpected errors propagate", async () => {
  for (const [kind, replace] of [
    ["error", false],
    ["forbidden", true],
    ["expired", true],
  ]) {
    const { box, pending, failures, ApiClientError } = setup(),
      p = box.read(filters(), true);
    pending[0].reject(new ApiClientError(kind));
    await p;
    assert.equal(failures[0].replace, replace);
    assert.equal(box.busy.value, false);
  }
  const { box, pending } = setup(),
    p = box.read(filters(), true);
  box.loadSequence++;
  const error = new Error("synthetic implementation error");
  pending[0].reject(error);
  await assert.rejects(p, (e) => e === error);
  assert.equal(box.busy.value, false);
});
