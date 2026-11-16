import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlUiPreferenceRepository } from "../../apps/api/dist/mysql-ui-preference-repository.js";
import {
  InMemoryUiPreferenceRepository,
  UiPreferenceService,
} from "../../packages/preferences/dist/index.js";
const user = "00000000-0000-4000-8000-000000000211",
  org = "00000000-0000-4000-8000-000000000212",
  workspace = "00000000-0000-4000-8000-000000000213",
  session = "00000000-0000-4000-8000-000000000214";
const setup = (scoped = true) => {
  const repository = new InMemoryUiPreferenceRepository();
  if (scoped)
    repository.scopes.set(session, { userId: user, organizationId: org, workspaceId: workspace });
  const auth = { authenticate: async () => ({ user: { id: user }, session: { id: session } }) };
  return buildApp({
    uiPreferences: {
      service: new UiPreferenceService(repository, () => new Date("2026-08-07T14:10:00.000Z")),
      auth,
      webOrigin: "http://127.0.0.1:5173",
      secureCookie: false,
    },
  });
};
const headers = {
  cookie: "scoutops_session=e2e",
  "x-request-id": "m02-api-request",
  "x-trace-id": "m02-api-trace",
};
test("M02-01.A06/A09/A13 GET returns scoped deep-ocean default without accepting client scope", async () => {
  const app = setup(),
    response = await app.inject({ method: "GET", url: "/api/v1/me/ui-preferences", headers });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, {
    theme: "deep-ocean",
    source: "default",
    organization_id: org,
    workspace_id: workspace,
    version: 0,
    updated_at: null,
  });
  assert.equal(response.headers["cache-control"], "private, no-store");
  await app.close();
});
test("M02-01.A04/A06/A13 PUT enforces origin idempotency version and response correlation", async () => {
  const app = setup();
  const denied = await app.inject({
    method: "PUT",
    url: "/api/v1/me/ui-preferences",
    headers: { ...headers, origin: "https://evil.example" },
    payload: { theme: "cloud-white", expected_version: 0 },
  });
  assert.equal(denied.statusCode, 403);
  const missing = await app.inject({
    method: "PUT",
    url: "/api/v1/me/ui-preferences",
    headers: { ...headers, origin: "http://127.0.0.1:5173" },
    payload: { theme: "cloud-white", expected_version: 0 },
  });
  assert.equal(missing.statusCode, 400);
  const response = await app.inject({
    method: "PUT",
    url: "/api/v1/me/ui-preferences",
    headers: { ...headers, origin: "http://127.0.0.1:5173", "idempotency-key": "m02-api-key" },
    payload: { theme: "cloud-white", expected_version: 0 },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.theme, "cloud-white");
  assert.equal(response.json().data.version, 1);
  assert.equal(response.json().request_id, "m02-api-request");
  await app.close();
});
test("M02-01.A08/A16 missing selected context returns explicit recovery code", async () => {
  const app = setup(false),
    response = await app.inject({ method: "GET", url: "/api/v1/me/ui-preferences", headers });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "preference_scope_required");
  assert.match(response.json().error.action_hint, /组织与工作区/);
  await app.close();
});

test("account theme uses only authenticated identity, omits legacy scope and preserves idempotency", async () => {
  const rows = new Map(), operations = new Map(), audits = [];
  const query = async (sql, args) => {
    assert.doesNotMatch(sql, /organization_id|workspace_id|user_session_contexts/);
    assert.equal((sql.match(/\?/g) ?? []).length, args.length, sql);
    if (sql.startsWith("SELECT o.request_hash")) {
      const op = operations.get(args.join(":"));
      return [op ? [{ ...rows.get(args[0]), request_hash: op }] : []];
    }
    if (sql.startsWith("SELECT")) return [rows.has(args[0]) ? [rows.get(args[0])] : []];
    if (sql.startsWith("INSERT INTO user_ui_preferences ")) {
      const [id, user_id, theme, version, created_at, updated_at] = args;
      rows.set(user_id, { id, user_id, theme, version, created_at, updated_at });
    } else if (sql.startsWith("UPDATE")) {
      const [theme, version, updated_at, id, actor, expected] = args;
      const old = rows.get(actor);
      assert.equal(old.id, id);
      assert.equal(old.version, expected);
      rows.set(actor, { ...old, theme, version, updated_at });
      return [{ affectedRows: 1 }];
    } else if (sql.startsWith("INSERT INTO user_ui_preference_audit_events")) audits.push(args);
    else if (sql.startsWith("INSERT INTO user_ui_preference_operations"))
      operations.set(args.slice(1, 3).join(":"), args[3]);
    else assert.fail(sql);
    return [{}];
  };
  const pool = { query, async getConnection() {
    return { query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
  } };
  const app = buildApp({ uiPreferences: {
    service: new UiPreferenceService(new MySqlUiPreferenceRepository(pool, true)),
    auth: { async authenticate(token) { return { user: { id: token }, session: { id: "session" } }; } },
    webOrigin: "http://127.0.0.1:5173", secureCookie: false,
  } });
  const invoke = (method, actor, key, payload) => app.inject({
    method, url: "/api/v1/me/ui-preferences", payload,
    headers: { ...headers, cookie: `scoutops_session=${actor}`, "idempotency-key": key },
  });
  try {
    const first = { theme: "cloud-white", expected_version: 0 };
    const created = await invoke("PUT", "account-a", "same-key", first);
    assert.equal(created.statusCode, 200, created.body);
    assert.deepEqual(Object.keys(created.json().data).sort(), ["source", "theme", "updated_at", "version"]);
    assert.deepEqual((await invoke("PUT", "account-a", "same-key", first)).json().data, created.json().data);
    assert.equal((await invoke("PUT", "account-a", "same-key", { ...first, theme: "deep-ocean" })).statusCode, 409);
    assert.equal((await invoke("GET", "account-b", "unused")).json().data.source, "default");
    assert.equal((await invoke("PUT", "account-b", "same-key", first)).statusCode, 200);
    const updated = await invoke("PUT", "account-a", "next-key", { theme: "aurora-purple", expected_version: 1 });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json().data.version, 2);
    assert.equal((await invoke("GET", "account-b", "unused")).json().data.theme, "cloud-white");
    assert.equal(audits.length, 3);
  } finally {
    await app.close();
  }
});
