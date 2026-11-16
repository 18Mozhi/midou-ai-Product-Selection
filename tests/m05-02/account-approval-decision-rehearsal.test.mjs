import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { ApprovalService } from "../../apps/api/dist/approval-service.js";
import { MySqlApprovalRepository } from "../../apps/api/dist/mysql-approval-repository.js";

const id = "10000000-0000-4000-8000-000000000001",
  primary = "primary",
  named = "named-approver";
const value = { action: "approve", expected_version: 1, reason: "checked evidence" };

function fixture({
  invalidNext = false,
  hasNext = false,
  nullableDelivery = true,
  deliveryColumns = 2,
  nativeOwnerMismatch = false,
  partialParent = false,
} = {}) {
  const writes = [],
    ledgers = [],
    commits = [];
  let receipt,
    pending = true;
  const db = {
    async beginTransaction() {},
    async commit() {
      commits.push("commit");
    },
    async rollback() {
      commits.push("rollback");
    },
    release() {},
    async query(sql, args = []) {
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates "))
        return [[{ Field: "account_id" }, { Field: "historical_context" }]];
      if (/^SHOW COLUMNS FROM (tasks|opportunities) /.test(sql))
        return [
          partialParent
            ? [{ Field: "account_id" }, { Field: "workspace_id" }]
            : [{ Field: "account_id" }],
        ];
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT id FROM users")) {
        assert.match(sql, /email_verified_at IS NOT NULL FOR UPDATE/);
        return [[{ id: args[0] }]];
      }
      if (sql.startsWith("SHOW COLUMNS FROM outbox_events"))
        return [
          [
            { Field: "organization_id", Null: nullableDelivery ? "YES" : "NO" },
            { Field: "workspace_id", Null: "YES" },
          ].slice(0, deliveryColumns),
        ];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      if (sql.includes("ownership_reason,ar.account_id ownership_account_id")) {
        assert.deepEqual(args.slice(1, 4), Array(3).fill(args[1]));
        assert.match(sql, /nr.ordinal=r.current_node_ordinal.*nr.active_approver_id=\?/);
        assert.match(sql, /op.resource_id=r.id/);
        assert.match(sql, /ra.source_table='tasks'/);
        assert.match(sql, /task_resource.account_id=ar.account_id/);
        assert.match(sql, /o.account_id=ar.account_id/);
        assert.match(sql, /t.account_id=ar.account_id/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        if (nativeOwnerMismatch) return [[]];
        if (args[1] !== primary && !(args[1] === named && (pending || receipt))) return [[]];
        return [
          [
            {
              status: pending ? "pending" : "approved",
              version: 1,
              current_node_ordinal: 1,
              template_version_id: "original-version",
              ownership_account_id: primary,
              ownership_reason: "shared",
            },
          ],
        ];
      }
      if (sql.startsWith("SELECT result_json")) {
        assert.match(args[1], /#account-v1$/);
        return [args[0] === named && receipt ? [{ resource_id: id, result_json: receipt }] : []];
      }
      if (sql.startsWith("SELECT n.*")) {
        assert.deepEqual(args, ["original-version", id, 1, primary, primary]);
        assert.match(sql, /d.ordinal=n.ordinal/);
        return [[{ id: "original-node", status: "pending", active_approver_id: named }]];
      }
      if (sql.startsWith("SELECT r.*,n.sla_minutes")) {
        assert.deepEqual(args, [id, 2, "original-version", primary, primary]);
        return [hasNext ? [{ id: "next-node", status: "waiting", sla_minutes: 60 }] : []];
      }
      if (sql.startsWith("SELECT d.id FROM approval_template_nodes")) {
        assert.deepEqual(args, ["original-version", 1]);
        return [invalidNext ? [{ id: "missing-next-run" }] : []];
      }
      if (sql.startsWith("SELECT id FROM approval_node_runs"))
        return [invalidNext ? [{ id: "invalid-next" }] : []];
      writes.push([sql, args]);
      if (sql.startsWith("INSERT INTO account_owned_records")) ledgers.push(args);
      if (sql.startsWith("INSERT INTO approval_operations")) {
        receipt = JSON.parse(args[5]);
        pending = false;
      }
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlApprovalRepository({
    query: () => assert.fail("read outside transaction"),
    getConnection: async () => db,
  });
  const app = buildApp({
    approvals: {
      service: new ApprovalService(repo),
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: "https://fixture.invalid",
      auth: {
        async authenticate(actor) {
          return {
            user: { id: actor, email_verified_at: actor === "unverified" ? null : new Date() },
          };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy session resolution");
        },
      },
    },
  });
  const decide = (actor, body = value) =>
    app.inject({
      method: "POST",
      url: `/api/v1/tasks/approvals/${id}/actions`,
      payload: { ...body, accountId: primary },
      headers: {
        cookie: `scoutops_session=${actor}`,
        origin: "https://fixture.invalid",
        "idempotency-key": "fixture-key",
      },
    });
  return { app, decide, writes, ledgers, commits };
}

test("a named signer cannot decide with mismatched or partially migrated native ownership", async () => {
  for (const [options, status, code] of [
    [{ nativeOwnerMismatch: true }, 404, "approval_request_not_found"],
    [{ partialParent: true }, 503, "approval_account_schema_not_ready"],
  ]) {
    const f = fixture(options);
    try {
      const response = await f.decide(named);
      assert.equal(response.statusCode, status, response.body);
      assert.equal(response.json().error.code, code);
      assert.deepEqual(f.writes, []);
      assert.deepEqual(f.commits, ["rollback"]);
    } finally {
      await f.app.close();
    }
  }
});

test("only the named active approver can decide, facts stay with owner, and replay is exact", async () => {
  const f = fixture();
  try {
    assert.equal((await f.decide("unverified")).statusCode, 403);
    assert.equal((await f.decide("unrelated")).statusCode, 404);
    assert.equal((await f.decide(primary)).statusCode, 403);
    assert.deepEqual(f.writes, []);
    const approved = await f.decide(named);
    assert.equal(approved.statusCode, 200, approved.body);
    assert.equal(approved.json().data.status, "approved");
    assert.equal(f.writes.find(([s]) => s.startsWith("INSERT INTO approval_actions"))[1][5], named);
    const [outboxSql, outboxArgs] = f.writes.find(([s]) =>
      s.startsWith("INSERT INTO outbox_events"),
    );
    assert.doesNotMatch(outboxSql, /organization_id|workspace_id/);
    assert.equal(JSON.parse(outboxArgs[2]).account_projection_contract, 25);
    assert.equal(
      JSON.parse(outboxArgs[2]).approval_action_id,
      f.writes.find(([s]) => s.startsWith("INSERT INTO approval_actions"))[1][0],
    );
    assert.ok(f.writes.some(([s]) => s.startsWith("INSERT INTO platform_audit_events")));
    assert.ok(!f.writes.some(([s]) => s.startsWith("INSERT INTO audit_logs")));
    assert.deepEqual(
      f.ledgers.map((a) => [a[0], a[2], a[3]]),
      [
        ["approval_actions", primary, "shared"],
        ["outbox_events", primary, "shared"],
      ],
    );
    const count = f.writes.length;
    assert.deepEqual((await f.decide(named)).json().data, approved.json().data);
    assert.equal((await f.decide(named, { ...value, action: "reject" })).statusCode, 409);
    assert.equal(f.writes.length, count);
  } finally {
    await f.app.close();
  }
});

test("account decision rolls back if the shared outbox still requires an organization", async () => {
  const f = fixture({ nullableDelivery: false });
  try {
    assert.equal((await f.decide(named)).statusCode, 503);
    assert.equal(f.commits.at(-1), "rollback");
    assert.ok(
      !f.writes.some(
        ([s]) =>
          s.startsWith("INSERT INTO outbox_events") ||
          s.startsWith("INSERT INTO approval_operations"),
      ),
    );
  } finally {
    await f.app.close();
  }
});

test("account approval keeps its original signer and owned delivery when both old columns are removed", async () => {
  const f = fixture({ deliveryColumns: 0 });
  try {
    const result = await f.decide(named);
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(f.writes.find(([s]) => s.startsWith("INSERT INTO approval_actions"))[1][5], named);
    const [sql, params] = f.writes.find(([s]) => s.startsWith("INSERT INTO outbox_events"));
    assert.doesNotMatch(sql, /organization_id|workspace_id/);
    assert.ok(
      f.ledgers.some(
        ([source, id, account, reason]) =>
          source === "outbox_events" &&
          id === params[0] &&
          account === primary &&
          reason === "shared",
      ),
    );
    assert.equal(f.commits.at(-1), "commit");
  } finally {
    await f.app.close();
  }
});

test("account approval refuses a partially retired outbox", async () => {
  const f = fixture({ deliveryColumns: 1 });
  try {
    assert.equal((await f.decide(named)).statusCode, 503);
    assert.equal(f.commits.at(-1), "rollback");
    assert.ok(!f.writes.some(([sql]) => sql.startsWith("INSERT INTO outbox_events")));
  } finally {
    await f.app.close();
  }
});
test("an unowned or malformed successor rolls back instead of finishing the workflow", async () => {
  const f = fixture({ invalidNext: true });
  try {
    assert.equal((await f.decide(named)).statusCode, 409);
    assert.equal(f.commits.at(-1), "rollback");
    assert.equal(
      f.writes.some(
        ([s]) =>
          s.startsWith("UPDATE approval_requests") || s.startsWith("INSERT INTO outbox_events"),
      ),
      false,
    );
  } finally {
    await f.app.close();
  }
});

test("approval opens the original successor and transfers no ownership to the named signer", async () => {
  const f = fixture({ hasNext: true });
  try {
    const response = await f.decide(named);
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json().data, {
      id,
      status: "pending",
      current_node_ordinal: 2,
      version: 2,
    });
    const [, args] = f.writes.find(([s]) => s.startsWith("INSERT INTO approval_escalation_jobs"));
    assert.deepEqual(args.slice(1, 3), [id, "next-node"]);
    assert.ok(
      f.ledgers.some(
        (a) => a[0] === "approval_escalation_jobs" && a[1] === args[0] && a[2] === primary,
      ),
    );
  } finally {
    await f.app.close();
  }
});

test("a named rejection closes the request without opening a successor", async () => {
  const f = fixture({ hasNext: true });
  try {
    const response = await f.decide(named, { ...value, action: "reject" });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().data.status, "rejected");
    assert.equal(
      f.writes.some(([s]) => s.startsWith("INSERT INTO approval_escalation_jobs")),
      false,
    );
  } finally {
    await f.app.close();
  }
});
