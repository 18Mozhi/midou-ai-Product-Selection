import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlProfitRepository } from "../../apps/api/dist/mysql-profit-repository.js";
import { ProfitService } from "../../apps/api/dist/profit-service.js";

const origin = "http://127.0.0.1:5173";
const own = "00000000-0000-4000-8000-000000000501";
const foreign = "00000000-0000-4000-8000-000000000502";
const primary = "2313645627@qq.com";

test("account cost switch routes bind the verified session without consulting workspace", async (t) => {
  const calls = [];
  let email = primary;
  const app = buildApp({
    profit: {
      accountReadRehearsal: true,
      webOrigin: origin,
      secureCookie: false,
      service: new ProfitService({
        async actRule(input) {
          calls.push(input);
          return { id: own, status: "active" };
        },
      }),
      auth: {
        async authenticate() {
          return { user: { id: own, email_normalized: email, email_verified_at: new Date() } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("unexpected workspace");
        },
      },
    },
  });
  t.after(() => app.close());
  const send = (payload) =>
    app.inject({
      method: "POST",
      url: `/api/v1/cost-rules/${own}/actions`,
      headers: { origin, cookie: "scoutops_session=token", "idempotency-key": "switch" },
      payload: { reason: "verified", expected_revision: 3, ...payload },
    });
  assert.equal((await send({ action: "publish" })).statusCode, 200);
  assert.equal((await send({ action: "rollback", target_rule_id: foreign })).statusCode, 200);
  assert.equal(calls[1].targetRuleId, foreign);
  assert.equal((await send({ action: "submit", selection_manager_id: foreign })).statusCode, 200);
  assert.equal(calls[2].selectionManagerId, foreign);
  assert.equal((await send({ action: "publish", selection_manager_id: foreign })).statusCode, 400);
  assert.equal((await send({ action: "submit", selection_manager_id: "invalid" })).statusCode, 400);
  assert.ok(calls.every((x) => x.actorId === own && !("organizationId" in x)));
  email = "other@example.test";
  assert.equal((await send({ action: "publish" })).statusCode, 403);
  assert.equal((await send({ action: "submit", selection_manager_id: foreign })).statusCode, 400);
  assert.equal(calls.length, 3);
});

test("account cost publication requires independent signatures and queues only owned profit work", async () => {
  const calls = [];
  let signer = "primary-account",
    result,
    targetOwned = false,
    signatureMissing = false;
  const row = {
    id: own,
    account_id: "primary-account",
    ownership_reason: "shared",
    status: "approved",
    revision: 3,
    market: "US",
    platform: "amazon",
    effective_from: "2026-01-01",
    fee_lines_json: [],
  };
  const c = {
    async beginTransaction() {},
    async commit() {
      calls.push(["commit"]);
    },
    async rollback() {
      calls.push(["rollback"]);
    },
    release() {},
    async query(sql, args) {
      calls.push([sql, args]);
      if (sql.startsWith("SELECT cut.primary_account_id"))
        return [[{ primary_account_id: "primary-account" }]];
      if (sql.startsWith("SELECT r.*, o.reason")) return [[row]];
      if (sql.includes("LEFT JOIN account_owned_records ar")) return [[]];
      if (sql.includes("FROM cost_operations")) return [result ? [{ result_json: result }] : []];
      if (sql.startsWith("SELECT a.approval_role"))
        return [
          [
            { approval_role: "selection_manager", actor_id: "manager" },
            ...(signatureMissing ? [] : [{ approval_role: "primary_account", actor_id: signer }]),
          ],
        ];
      if (sql.startsWith("SELECT r.id"))
        return [targetOwned ? [{ id: foreign, reason: "exclusive_owner" }] : []];
      if (sql.startsWith("SELECT o.id,ow.reason")) return [[{ id: foreign, reason: "unassigned" }]];
      if (sql.startsWith("SELECT r.*"))
        return [[{ ...row, id: args[2], status: "active", revision: 4 }]];
      if (sql.startsWith("INSERT INTO cost_operations")) result = args[5];
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new MySqlProfitRepository({ getConnection: async () => c });
  const input = {
    accountOwnedApproval: true,
    actorId: "primary-account",
    ruleId: own,
    action: "publish",
    expectedRevision: 3,
    route: `POST:/api/v1/cost-rules/${own}/actions:account`,
    idempotencyKey: "publish",
    reason: "verified",
    requestId: "r",
    traceId: "t",
  };
  await assert.rejects(() => repository.actRule({ ...input, accountOwnedApproval: "manager" }), {
    code: "cost_rule_approval_role_forbidden",
  });
  signer = "manager";
  await assert.rejects(() => repository.actRule(input), { code: "cost_rule_approval_incomplete" });
  assert.ok(calls.every(([sql]) => !sql.startsWith("UPDATE")));
  calls.length = 0;
  signer = "primary-account";
  assert.equal((await repository.actRule(input)).status, "active");
  assert.match(calls[0][0], /FOR UPDATE$/);
  assert.deepEqual(calls.find(([sql]) => sql.startsWith("SELECT o.id,ow.reason"))[1], [
    "primary-account",
    "US",
    "amazon",
  ]);
  assert.ok(
    calls.some(
      ([sql, args]) => sql.includes("'opportunity_profit_jobs'") && args[1] === "primary-account",
    ),
  );
  assert.ok(
    calls.every(
      ([sql]) => !/^INSERT INTO (cost_rule_approvals|account_cost_approval_events)/.test(sql),
    ),
  );
  calls.length = 0;
  assert.equal((await repository.actRule(input)).status, "active");
  assert.ok(calls.every(([sql]) => !/^(INSERT|UPDATE)/.test(sql)));
  signatureMissing = true;
  calls.length = 0;
  await assert.rejects(() => repository.actRule(input), { code: "cost_rule_approval_incomplete" });
  assert.ok(calls.every(([sql]) => !/^(INSERT|UPDATE)/.test(sql)));
  signatureMissing = false;
  result = undefined;
  row.status = "active";
  calls.length = 0;
  const rollback = {
    ...input,
    action: "rollback",
    targetRuleId: foreign,
    idempotencyKey: "rollback",
  };
  await assert.rejects(() => repository.actRule(rollback), {
    code: "cost_rule_rollback_target_invalid",
  });
  assert.ok(calls.every(([sql]) => !sql.startsWith("UPDATE")));
  targetOwned = true;
  calls.length = 0;
  assert.equal((await repository.actRule(rollback)).id, foreign);
  assert.deepEqual(calls.find(([sql]) => sql.startsWith("SELECT a.approval_role"))[1], [
    foreign,
    "primary-account",
  ]);
  assert.ok(
    calls.some(
      ([sql, args]) => sql.startsWith("INSERT INTO opportunity_profit_jobs") && args[2] === foreign,
    ),
  );
  signer = "manager";
  await assert.rejects(() => repository.actRule(rollback), {
    code: "cost_rule_approval_incomplete",
  });
  signer = "primary-account";
  targetOwned = false;
  await assert.rejects(() => repository.actRule(rollback), {
    code: "cost_rule_rollback_target_invalid",
  });
});

test("account cost submission needs a readable grant for an independent active manager", async () => {
  let granted = false,
    saved,
    state = "draft";
  const writes = [];
  const c = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, args) {
      if (sql.startsWith("SELECT cut.primary_account_id"))
        return [[{ primary_account_id: "primary" }]];
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT r.*"))
        return [
          [
            {
              id: own,
              account_id: "primary",
              ownership_reason: "exclusive_owner",
              status: state,
              revision: state === "draft" ? 1 : 2,
              effective_from: "2026-01-01",
              fee_lines_json: [],
            },
          ],
        ];
      if (sql.startsWith("SELECT a.id")) return [[]];
      if (sql.includes("FROM cost_operations")) return [saved ? [{ result_json: saved }] : []];
      if (sql.startsWith("SELECT g.manager_id")) {
        assert.match(sql, /g\.can_read=1 AND g\.manager_id<>\? AND u\.status='active'/);
        assert.deepEqual(args, [own, "primary"]);
        return [granted ? [{ manager_id: "manager" }] : []];
      }
      writes.push(sql);
      if (sql.startsWith("UPDATE cost_rules")) state = "pending_approval";
      if (sql.startsWith("INSERT INTO cost_operations")) saved = args[5];
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlProfitRepository({ getConnection: async () => c });
  const input = {
    accountOwnedApproval: true,
    actorId: "primary",
    ruleId: own,
    action: "submit",
    expectedRevision: 1,
    route: `POST:/api/v1/cost-rules/${own}/actions:account`,
    idempotencyKey: "submit",
    reason: "review",
    requestId: "r",
    traceId: "t",
  };
  await assert.rejects(() => repo.actRule(input), { code: "cost_rule_manager_required" });
  assert.deepEqual(writes, []);
  granted = true;
  assert.equal((await repo.actRule(input)).status, "pending_approval");
  assert.ok(writes.some((sql) => sql.startsWith("INSERT INTO opportunity_outbox")));
  assert.ok(!writes.some((sql) => sql.startsWith("INSERT INTO cost_rule_approvals")));
  writes.length = 0;
  assert.equal((await repo.actRule(input)).status, "pending_approval");
  assert.deepEqual(writes, []);
});

test("primary can grant one active independent manager at submit without replacing historical grants", async () => {
  const primary = "00000000-0000-4000-8000-000000000811";
  const nominee = "00000000-0000-4000-8000-000000000812";
  let grant,
    receipt,
    snapshot,
    historical = false,
    state = "draft",
    candidateActive = true,
    failOutbox = false;
  const writes = [];
  const c = {
    async beginTransaction() {
      snapshot = { grant, receipt, state };
    },
    async commit() {},
    async rollback() {
      ({ grant, receipt, state } = snapshot);
    },
    release() {},
    async query(sql, args) {
      if (sql.startsWith("SELECT cut.primary_account_id"))
        return [[{ primary_account_id: primary }]];
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT r.*"))
        return [
          [
            {
              id: own,
              account_id: primary,
              ownership_reason: "exclusive_owner",
              historical_context: historical ? {} : null,
              status: state,
              revision: state === "draft" ? 1 : 2,
              effective_from: "2026-01-01",
              fee_lines_json: [],
            },
          ],
        ];
      if (sql.startsWith("SELECT a.id")) return [[]];
      if (sql.includes("FROM cost_operations")) return [receipt ? [{ result_json: receipt }] : []];
      if (sql.startsWith("SELECT manager_id")) return [grant ? [{ manager_id: grant }] : []];
      if (sql.startsWith("SELECT id FROM users")) {
        assert.match(sql, /id<>\? AND status='active' FOR UPDATE/);
        assert.equal(args[1], primary);
        return [candidateActive && args[0] === nominee ? [{ id: nominee }] : []];
      }
      if (sql.startsWith("SELECT g.manager_id")) return [grant ? [{ manager_id: grant }] : []];
      writes.push({ sql, args });
      if (sql.startsWith("INSERT INTO account_cost_rule_manager_grants")) {
        assert.deepEqual(args, [own, nominee]);
        grant = args[1];
      }
      if (sql.startsWith("UPDATE cost_rules")) state = "pending_approval";
      if (failOutbox && sql.startsWith("INSERT INTO opportunity_outbox"))
        throw new Error("injected_outbox_failure");
      if (sql.startsWith("INSERT INTO cost_operations")) receipt = args[5];
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlProfitRepository({ getConnection: async () => c });
  const service = new ProfitService(repo);
  const submit = (selection_manager_id, idempotencyKey = "nominate") =>
    service.actRule({
      accountOwnedApproval: true,
      isPrimaryApprover: true,
      roleCodes: [],
      actorId: primary,
      ruleId: own,
      idempotencyKey,
      requestId: "r",
      traceId: "t",
      value: { action: "submit", expected_revision: 1, reason: "review", selection_manager_id },
    });
  await assert.rejects(() => submit(primary), { code: "cost_rule_manager_invalid" });
  candidateActive = false;
  await assert.rejects(() => submit(nominee), { code: "cost_rule_manager_invalid" });
  candidateActive = true;
  historical = true;
  await assert.rejects(() => submit(nominee), { code: "cost_rule_manager_already_configured" });
  historical = false;
  grant = primary;
  await assert.rejects(() => submit(nominee), { code: "cost_rule_manager_already_configured" });
  grant = undefined;
  assert.deepEqual(writes, []);
  failOutbox = true;
  await assert.rejects(() => submit(nominee), /injected_outbox_failure/);
  assert.deepEqual(
    { grant, receipt, state },
    { grant: undefined, receipt: undefined, state: "draft" },
  );
  writes.length = 0;
  failOutbox = false;
  assert.equal((await submit(nominee)).status, "pending_approval");
  assert.equal(grant, nominee);
  assert.ok(
    writes.some(
      ({ sql, args }) =>
        sql.startsWith("INSERT INTO opportunity_events") &&
        args.some(
          (value) =>
            typeof value === "string" && value.includes('"selection_manager_id":"' + nominee + '"'),
        ),
    ),
  );
  assert.ok(!writes.some(({ sql }) => sql.startsWith("INSERT INTO cost_rule_approvals")));
  writes.length = 0;
  assert.equal((await submit(nominee)).status, "pending_approval");
  await assert.rejects(() => submit(primary), { code: "cost_rule_approval_idempotency_conflict" });
  assert.deepEqual(writes, []);
});

test("account cost draft is exclusively owned and does not grant manager access", async () => {
  let saved;
  const writes = [];
  const c = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, args) {
      if (sql.startsWith("SELECT cut.primary_account_id"))
        return [[{ primary_account_id: "primary" }]];
      if (sql.includes("FROM cost_operations")) return [saved ? [{ result_json: saved }] : []];
      if (sql.startsWith("SELECT r.*"))
        return [
          [
            {
              id: own,
              status: "draft",
              revision: 1,
              effective_from: "2026-01-01",
              fee_lines_json: [],
            },
          ],
        ];
      writes.push([sql, args]);
      if (sql.startsWith("INSERT INTO cost_operations")) saved = args[5];
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlProfitRepository({ getConnection: async () => c });
  const draft = {
    id: own,
    actorId: "primary",
    idempotencyKey: "draft",
    requestId: "r",
    traceId: "t",
    value: {
      market: "US",
      platform: "amazon",
      version_code: "v2",
      name: "Draft",
      fee_lines: [],
      conversion_rates: [],
      effective_from: "2026-01-01",
    },
  };
  assert.equal((await repo.createAccountRule(draft)).status, "draft");
  const [sql, args] = writes.find(([sql]) => sql.startsWith("INSERT INTO account_owned_records"));
  assert.match(sql, /'cost_rules',\?,\?,'exclusive_owner'/);
  assert.deepEqual(args, [own, "primary"]);
  assert.ok(writes.every(([sql]) => !/organization_id|workspace_id|manager_grants/.test(sql)));
  writes.length = 0;
  assert.equal((await repo.createAccountRule({ ...draft, id: foreign })).id, own);
  assert.deepEqual(writes, []);
  await assert.rejects(
    () => repo.createAccountRule({ ...draft, value: { ...draft.value, name: "Different" } }),
    { code: "cost_rule_approval_idempotency_conflict" },
  );
});

test("account profit routes do not resolve a legacy workspace for unsupported operations", async () => {
  const disabled = [
    ["GET", "/api/v1/cost-input-reviewers"],
    ["POST", "/api/v1/exchange-rates"],
    ["POST", `/api/v1/opportunities/${own}/cost-inputs`],
    ["POST", `/api/v1/opportunities/${own}/cost-input-reviews/${foreign}/actions`],
    ["POST", `/api/v1/opportunities/${own}/profit-runs`],
  ];
  const app = buildApp({
    profit: {
      accountReadRehearsal: true,
      webOrigin: origin,
      secureCookie: false,
      service: {},
      auth: {
        async authenticate() {
          assert.fail("unexpected authentication");
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("unexpected legacy workspace lookup");
        },
      },
    },
  });
  try {
    for (const [method, url] of disabled) {
      assert.equal(
        app.hasRoute({ method, url: url.replaceAll(own, ":id").replaceAll(foreign, ":reviewId") }),
        false,
        url,
      );
      assert.equal((await app.inject({ method, url, headers: { origin } })).statusCode, 404, url);
    }
    for (const action of ["unknown"]) {
      const result = await app.inject({
        method: "POST",
        url: `/api/v1/cost-rules/${own}/actions`,
        headers: { origin },
        payload: { action },
      });
      assert.equal(result.statusCode, 403, result.body);
      assert.match(result.body, /cost_rule_action_not_available_in_account_mode/);
    }
  } finally {
    await app.close();
  }
  const legacy = buildApp({
    profit: { webOrigin: origin, secureCookie: false, service: {}, auth: {}, authorization: {} },
  });
  try {
    for (const [method, url] of disabled)
      assert.equal(
        legacy.hasRoute({
          method,
          url: url.replaceAll(own, ":id").replaceAll(foreign, ":reviewId"),
        }),
        true,
        url,
      );
  } finally {
    await legacy.close();
  }
});

test("manager locks an exact account-rule grant without reading workspace; approval follows the rule owner", async () => {
  let grantsReady = false;
  let granted = false;
  let validOwner = true;
  let activeManager = true;
  let alreadySignedOtherSlot = false;
  let approved = false;
  let approvalId;
  let eventId;
  const writes = [];
  const row = () => ({
    id: own,
    ownership_reason: "shared",
    ownership_account_id: "primary-account",
    revision: approved ? 2 : 1,
    status: "pending_approval",
    effective_from: "2026-01-01",
    fee_lines_json: [],
  });
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, args) {
      if (sql.startsWith("SELECT cut.primary_account_id"))
        assert.fail("manager must use the exact grant");
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT r.*, o.reason")) {
        assert.match(
          sql,
          /o.reason IN \('shared','unassigned'\) AND o.account_id=ownership_receipt.primary_account_id/,
        );
        assert.match(
          sql,
          /JOIN account_cost_rule_manager_grants g ON g\.cost_rule_id=r\.id JOIN users manager_user ON manager_user\.id=g\.manager_id AND manager_user\.status='active' WHERE r\.id=\? AND g\.manager_id=\? FOR UPDATE/,
        );
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.equal(args[1], "named-manager");
        if (!grantsReady)
          throw Object.assign(new Error("not installed"), { code: "ER_NO_SUCH_TABLE" });
        return [granted && validOwner && activeManager && args[0] === own ? [row()] : []];
      }
      if (sql.startsWith("SELECT a.id FROM cost_rule_approvals")) {
        assert.deepEqual(args, ["primary-account", "shared", own]);
        return [[]];
      }
      if (sql.startsWith("SELECT result_json")) {
        assert.deepEqual(args, [
          "named-manager",
          `POST:/api/v1/cost-rules/${own}/actions:account`,
          "manager-key-001",
        ]);
        return [[]];
      }
      if (sql.startsWith("SELECT id FROM cost_rule_approvals")) {
        assert.deepEqual(args, [own, "named-manager", "selection_manager"]);
        return [alreadySignedOtherSlot ? [{ id: "original-signature" }] : []];
      }
      if (sql.startsWith("INSERT INTO cost_rule_approvals")) {
        [approvalId] = args;
        assert.deepEqual(args.slice(1, 5), [own, "selection_manager", "fixture", "named-manager"]);
      } else if (sql.startsWith("INSERT INTO account_owned_records")) {
        assert.deepEqual(args, [approvalId, "primary-account", "shared"]);
      } else if (sql.startsWith("SELECT LEAST(COUNT(DISTINCT")) {
        assert.deepEqual(args, [own, "primary-account", "shared"]);
        return [[{ count: 1 }]];
      } else if (sql.startsWith("UPDATE cost_rules")) {
        assert.equal(args[0], "pending_approval");
        approved = true;
      } else if (sql.startsWith("SELECT r.*,GROUP_CONCAT")) {
        assert.deepEqual(args, ["primary-account", "shared", own, "primary-account"]);
        return [[{ ...row(), approvals: "selection_manager" }]];
      } else if (sql.startsWith("INSERT INTO account_cost_approval_events")) {
        [eventId] = args;
        assert.deepEqual(args.slice(1, 6), [
          "primary-account",
          own,
          approvalId,
          "cost_rule.approve",
          "shared",
        ]);
      } else if (sql.startsWith("INSERT INTO account_cost_approval_outbox")) {
        assert.equal(args[0], eventId);
      } else if (sql.startsWith("INSERT INTO cost_operations")) {
        assert.equal(args[1], "named-manager");
      } else assert.fail(sql);
      writes.push(sql);
      return [[]];
    },
  };
  const app = buildApp({
    profit: {
      accountReadRehearsal: true,
      webOrigin: origin,
      secureCookie: false,
      service: new ProfitService(
        new MySqlProfitRepository({
          async getConnection() {
            return connection;
          },
        }),
      ),
      auth: {
        async authenticate() {
          return { user: { id: "named-manager" }, session: { id: "server-session" } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("workspace session not allowed");
        },
        async authorize() {
          assert.fail("legacy authorization not allowed");
        },
      },
    },
  });
  const post = (id = own) =>
    app.inject({
      method: "POST",
      url: `/api/v1/cost-rules/${id}/actions`,
      headers: { origin, cookie: "scoutops_session=manager", "idempotency-key": "manager-key-001" },
      payload: {
        action: "approve",
        reason: "fixture",
        expected_revision: 1,
        approval_role: "selection_manager",
      },
    });
  try {
    assert.equal((await post()).statusCode, 503);
    grantsReady = true;
    assert.equal((await post()).statusCode, 404);
    granted = true;
    assert.equal((await post(foreign)).statusCode, 404);
    validOwner = false;
    assert.equal((await post()).statusCode, 404);
    validOwner = true;
    activeManager = false;
    assert.equal((await post()).statusCode, 404);
    activeManager = true;
    alreadySignedOtherSlot = true;
    const conflict = await post();
    assert.equal(conflict.statusCode, 409, conflict.body);
    assert.match(conflict.body, /cost_rule_distinct_approver_required/);
    alreadySignedOtherSlot = false;
    assert.deepEqual(writes, []);
    const response = await post();
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().data.status, "pending_approval");
    assert.ok(approvalId && eventId);
  } finally {
    await app.close();
  }
});

for (const [verb, decision, status] of [
  ["approve", "approved", "approved"],
  ["reject", "rejected", "rejected"],
]) {
  test(`account cost-rule ${verb} checks ownership before replay and persists owned history`, async () => {
    let ready = false;
    let boundPrimary = true;
    let owner = "primary";
    let cached;
    let storedDecision;
    let ledgerWrites = 0;
    let rollbacks = 0;
    let commits = 0;
    let revision = 1;
    let state = "pending_approval";
    let approvalId;
    let eventId;
    let foreignHistory = false;
    let signaturePresent = true;
    let operationReads = 0;
    const row = () => ({
      id: own,
      organization_id: "legacy-org",
      workspace_id: "legacy-space",
      ownership_reason: "shared",
      revision,
      status: state,
      effective_from: "2026-01-01",
      fee_lines_json: [],
    });
    const connection = {
      async beginTransaction() {},
      async commit() {
        commits++;
      },
      async rollback() {
        rollbacks++;
      },
      release() {},
      async query(sql, args) {
        if (sql.startsWith("SELECT cut.primary_account_id")) {
          assert.match(sql, /JOIN users u ON u\.id=cut\.primary_account_id/);
          assert.match(sql, /cut\.contract_version=25 AND cut\.primary_account_id=\?/);
          assert.match(
            sql,
            /u\.status='active' AND u\.email_verified_at IS NOT NULL AND BINARY u\.email_normalized=BINARY \? LIMIT 1 LOCK IN SHARE MODE$/,
          );
          assert.deepEqual(args, ["primary", primary]);
          return [boundPrimary ? [{ primary_account_id: "primary" }] : []];
        }
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25.*LOCK IN SHARE MODE/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.startsWith("SELECT r.*, o.reason")) {
          assert.match(sql, /ownership_receipt.contract_version=25/);
          assert.match(sql, /o.reason='exclusive_owner'/);
          assert.match(sql, /o.source_table='cost_rules'.*o.account_id=\? FOR UPDATE/);
          return [args[0] === own && args[1] === owner ? [row()] : []];
        }
        if (sql.startsWith("SELECT result_json")) {
          operationReads++;
          assert.match(sql, /FOR UPDATE$/);
          assert.deepEqual(args, [
            "primary",
            `POST:/api/v1/cost-rules/${own}/actions:account`,
            "approval-key-001",
          ]);
          return [cached ? [{ result_json: cached }] : []];
        }
        if (sql.includes("JOIN account_owned_records signature_owner")) {
          assert.match(sql, /BINARY a.reason=BINARY \?/);
          assert.match(sql, /signature_owner.account_id=\? AND signature_owner.reason=\?/);
          assert.deepEqual(args, [
            own,
            "primary_account",
            "primary",
            decision,
            "fixture",
            "primary",
            "shared",
          ]);
          return [signaturePresent ? [{ id: approvalId }] : []];
        }
        if (sql.startsWith("SELECT a.id FROM cost_rule_approvals")) {
          assert.match(sql, /ar.account_id=\? AND ar.reason=\?/);
          assert.match(sql, /a.cost_rule_id=\? AND ar.source_id IS NULL/);
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.match(sql, /FOR UPDATE$/);
          assert.deepEqual(args, ["primary", "shared", own]);
          return [foreignHistory ? [{ id: "foreign-approval" }] : []];
        }
        if (sql.startsWith("SELECT id FROM cost_rule_approvals")) return [[]];
        if (sql.startsWith("INSERT INTO cost_rule_approvals")) {
          assert.match(sql, new RegExp(`'${decision}'`));
          approvalId = args[0];
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args.slice(1, 5), [own, "primary_account", "fixture", "primary"]);
          storedDecision = decision;
        } else if (sql.startsWith("SELECT LEAST(COUNT(DISTINCT")) {
          assert.equal(ledgerWrites, 1);
          assert.match(sql, /ar.source_table='cost_rule_approvals'/);
          assert.match(sql, /ar.account_id=\? AND ar.reason=\?/);
          assert.deepEqual(args, [own, "primary", "shared"]);
          return [[{ count: 2 }]]; // Existing independent manager approval.
        } else if (sql.startsWith("UPDATE cost_rules")) {
          state = verb === "reject" ? "rejected" : args[0];
          revision++;
        } else if (sql.startsWith("SELECT r.*,GROUP_CONCAT")) {
          assert.match(sql, /ra.source_table='cost_rule_approvals'/);
          assert.match(sql, /ra.source_table='cost_rules'/);
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args, ["primary", "shared", own, "primary"]);
          return [
            [
              {
                ...row(),
                approvals:
                  verb === "approve" ? "selection_manager,primary_account" : "selection_manager",
              },
            ],
          ];
        } else if (sql.startsWith("INSERT INTO account_cost_approval_events")) {
          [eventId] = args;
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args.slice(1, 6), [
            "primary",
            own,
            approvalId,
            `cost_rule.${verb}`,
            "shared",
          ]);
          assert.equal(JSON.parse(args[8]).resulting_status, status);
        } else if (sql.startsWith("INSERT INTO account_cost_approval_outbox")) {
          assert.equal(args[0], eventId);
          ledgerWrites++;
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.match(sql, /'cost_rule_approvals'/);
          assert.deepEqual(args, [approvalId, "primary", "shared"]);
          ledgerWrites++;
        } else if (sql.startsWith("INSERT INTO cost_operations")) {
          cached = args[5];
        } else assert.fail(sql);
        return [[]];
      },
    };
    const app = buildApp({
      profit: {
        accountReadRehearsal: true,
        webOrigin: origin,
        secureCookie: false,
        service: new ProfitService(
          new MySqlProfitRepository({
            async getConnection() {
              return connection;
            },
          }),
        ),
        auth: {
          async authenticate(id) {
            return {
              user: {
                id,
                email_normalized: id === "old-admin" ? "admin@example.invalid" : primary,
                email_verified_at: id === "unverified" ? null : new Date(),
              },
            };
          },
        },
        authorization: {
          async resolveSession() {
            assert.fail("legacy membership was consulted");
          },
        },
      },
    });
    const action = (id = own, actor = "primary", headers = {}, extra = {}) =>
      app.inject({
        method: "POST",
        url: `/api/v1/cost-rules/${id}/actions`,
        headers: {
          origin,
          cookie: `scoutops_session=${actor}`,
          "idempotency-key": "approval-key-001",
          ...headers,
        },
        payload: {
          action: verb,
          reason: "fixture",
          expected_revision: 1,
          approval_role: "primary_account",
          ...extra,
        },
      });
    try {
      assert.equal((await action()).statusCode, 503);
      ready = true;
      boundPrimary = false;
      const unbound = await action();
      assert.equal(unbound.statusCode, 403);
      assert.equal(unbound.json().error.code, "cost_rule_approval_role_forbidden");
      assert.equal(operationReads, 0);
      assert.equal(ledgerWrites, 0);
      boundPrimary = true;
      assert.equal((await action(own, "unverified")).statusCode, 403);
      assert.equal(
        (await action(own, "old-admin", {}, { isPrimaryApprover: true })).statusCode,
        403,
      );
      assert.equal(
        (await action(own, "primary", { origin: "https://other.invalid" })).statusCode,
        403,
      );
      assert.equal((await action(own, "primary", { "idempotency-key": "" })).statusCode, 400);
      assert.equal((await action(foreign)).statusCode, 404);
      assert.equal((await action(own, "primary", {}, { expected_revision: 2 })).statusCode, 409);
      foreignHistory = true;
      const reads = operationReads;
      const corrupt = await action();
      assert.equal(corrupt.statusCode, 409);
      assert.equal(corrupt.json().error.code, "cost_rule_approval_ownership_conflict");
      assert.equal(operationReads, reads);
      foreignHistory = false;
      assert.equal(storedDecision, undefined);
      const allowed = await action();
      assert.equal(allowed.statusCode, 200, allowed.body);
      assert.equal(allowed.json().data.status, status);
      assert.equal(allowed.json().data.revision, 2);
      assert.equal(storedDecision, decision);
      assert.equal(ledgerWrites, 2);
      boundPrimary = false;
      const beforeReplay = operationReads;
      assert.equal((await action()).statusCode, 403);
      assert.equal(operationReads, beforeReplay);
      assert.equal(ledgerWrites, 2);
      boundPrimary = true;
      assert.deepEqual((await action()).json().data, allowed.json().data);
      signaturePresent = false;
      const missingSignature = await action();
      assert.equal(missingSignature.statusCode, 409);
      assert.equal(missingSignature.json().error.code, "cost_rule_approval_idempotency_conflict");
      signaturePresent = true;
      assert.equal(
        (await action(own, "primary", {}, { approval_role: "organization_admin" })).statusCode,
        403,
      );
      const currentReceipt = cached;
      cached = JSON.stringify({
        ...JSON.parse(currentReceipt),
        fingerprint: createHash("sha256")
          .update(JSON.stringify([own, verb, "organization_admin", 1, "fixture", null]))
          .digest("hex"),
        result: {
          ...allowed.json().data,
          approvals: allowed
            .json()
            .data.approvals.map((role) =>
              role === "primary_account" ? "organization_admin" : role,
            ),
        },
      });
      assert.deepEqual((await action()).json().data, allowed.json().data);
      const conflict = await action(
        own,
        "primary",
        {},
        { action: verb === "approve" ? "reject" : "approve" },
      );
      assert.equal(conflict.statusCode, 409);
      assert.equal(conflict.json().error.code, "cost_rule_approval_idempotency_conflict");
      cached = JSON.stringify(allowed.json().data); // Old rehearsal operation without fingerprint.
      assert.equal((await action()).statusCode, 409);
      assert.equal(ledgerWrites, 2);
      owner = "other-account";
      assert.equal((await action()).statusCode, 404);
      assert.equal(commits, 3);
      assert.equal(rollbacks, 10);
    } finally {
      await app.close();
    }
  });
}
