import test from "node:test";
import assert from "node:assert/strict";
import { MySqlApprovalRepository } from "../../apps/api/dist/mysql-approval-repository.js";

test("0180 account template draft and publish keep named users and avoid legacy coordinates", async () => {
  let resource,
    receipt,
    publishing = false;
  const owned = [],
    writes = [];
  const c = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, args = []) {
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates"))
        return [[{ Field: "account_id" }, { Field: "historical_context" }]];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      if (sql.startsWith("SELECT id FROM users WHERE id=?")) return [[{ id: "owner" }]];
      if (sql.startsWith("SELECT id FROM users WHERE id IN")) {
        assert.deepEqual(args, [["escalation", "signer"]]);
        return [[{ id: "escalation" }, { id: "signer" }]];
      }
      if (sql.startsWith("SELECT op.result_json"))
        return [receipt && !publishing ? [{ result_json: receipt }] : []];
      if (sql.startsWith("SELECT t.* FROM approval_templates")) {
        assert.deepEqual(args, ["template", "owner"]);
        return [[{ status: "draft", current_version: 1, revision: 1 }]];
      }
      if (sql.startsWith("SELECT v.id")) return [[{ id: "version" }]];
      if (sql.startsWith("SELECT COUNT(*)")) return [[{ total: 1, owned: 1 }]];
      if (sql.startsWith("INSERT INTO approval_templates"))
        assert.deepEqual(args.slice(0, 4), ["template", "owner", "rule", "task"]);
      if (sql.startsWith("INSERT INTO approval_template_nodes"))
        assert.deepEqual(args.slice(-3), ["signer", 60, "escalation"]);
      if (sql.startsWith("INSERT INTO account_owned_records")) owned.push(args);
      if (sql.startsWith("INSERT INTO approval_operations")) {
        assert.match(args[2], /#account-v1$/);
        resource = args[4];
        if (!publishing) receipt = args[5];
      }
      writes.push(sql);
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlApprovalRepository({
    async getConnection() {
      return c;
    },
  });
  const input = {
    id: "template",
    versionId: "version",
    accountId: "owner",
    route: "POST:template",
    idempotencyKey: "key",
    requestId: "r",
    traceId: "t",
    value: {
      name: "rule",
      resource_type: "task",
      nodes: [
        {
          ordinal: 1,
          name: "review",
          approver_id: "signer",
          escalation_assignee_id: "escalation",
          sla_minutes: 60,
        },
      ],
    },
  };
  const first = await repo.createTemplate(input);
  assert.equal(first.status, "draft");
  assert.equal(resource, "template");
  assert.deepEqual(
    owned.map((v) => [v[0], ...v.slice(2)]),
    [
      ["approval_templates", "owner", "exclusive_owner"],
      ["approval_template_versions", "owner", "exclusive_owner"],
      ["approval_template_nodes", "owner", "exclusive_owner"],
    ],
  );
  const before = writes.length;
  assert.deepEqual(await repo.createTemplate(input), first);
  await assert.rejects(
    repo.createTemplate({ ...input, value: { ...input.value, name: "different" } }),
    /approval_idempotency_conflict/,
  );
  assert.equal(writes.length, before);
  publishing = true;
  assert.equal(
    (
      await repo.publishTemplate({
        ...input,
        templateId: "template",
        expectedRevision: 1,
        reason: "validated",
        route: "POST:publish",
      })
    ).status,
    "published",
  );
  assert.equal(writes.filter((s) => s.startsWith("INSERT INTO platform_audit_events")).length, 2);
  assert.equal(
    writes.some((s) => s.includes("INTO outbox_events")),
    false,
  );
});

test("0180 account request locks an owned published version and starts the original named node", async () => {
  const captured = [],
    ledger = [];
  let targetExists = false;
  let saved;
  const c = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, args = []) {
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates"))
        return [[{ Field: "account_id" }, { Field: "historical_context" }]];
      if (sql.startsWith("SHOW COLUMNS FROM outbox_events"))
        return [
          [
            { Field: "organization_id", Null: "YES" },
            { Field: "workspace_id", Null: "YES" },
          ],
        ];
      if (/^SHOW COLUMNS FROM (tasks|opportunities) /.test(sql)) return [[{ Field: "account_id" }]];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      if (sql.startsWith("SELECT id FROM users")) return [[{ id: "owner" }]];
      if (sql.startsWith("SELECT op.result_json")) return [saved ? [saved] : []];
      if (sql.startsWith("SELECT r.id FROM approval_requests")) {
        assert.match(sql, /t.account_id=ar.account_id/);
        assert.match(sql, /task_resource.account_id=ar.account_id/);
        assert.deepEqual(args, ["request", "owner", "template", "task", "task"]);
        return [targetExists ? [{ id: "request" }] : []];
      }
      if (sql.startsWith("SELECT t.*,v.id")) {
        assert.match(sql, /t.account_id=\?[\s\S]*approval_template_versions/);
        return [
          [{ id: "template", version_id: "version", current_version: 3, resource_type: "task" }],
        ];
      }
      if (sql.startsWith("SELECT ow.reason")) {
        assert.deepEqual(args, ["task", "owner"]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /ow.account_id=cut.primary_account_id/);
        assert.match(sql, /o.account_id=ow.account_id/);
        return [targetExists ? [{ reason: "shared" }] : []];
      }
      if (sql.startsWith("SELECT t.title")) {
        assert.match(sql, /t.account_id=\?/);
        assert.deepEqual(args, ["task", "owner", "owner"]);
        return [[{ title: "original task", status: "in_progress" }]];
      }
      if (sql.startsWith("SELECT * FROM approval_template_nodes"))
        return [
          [
            {
              id: "node",
              ordinal: 1,
              name: "review",
              approver_id: "named",
              escalation_assignee_id: "backup",
              sla_minutes: 60,
            },
          ],
        ];
      if (sql.startsWith("SELECT source_id")) return [[{ source_id: "node" }]];
      assert.match(sql, /^INSERT /);
      captured.push([sql, args]);
      if (sql.startsWith("INSERT INTO approval_operations"))
        saved = { resource_id: args[4], result_json: args[5] };
      if (sql.startsWith("INSERT INTO account_owned_records")) ledger.push(args);
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlApprovalRepository({
    async getConnection() {
      return c;
    },
  });
  const input = {
    id: "request",
    accountId: "owner",
    route: "POST:request",
    idempotencyKey: "key",
    requestId: "r",
    traceId: "t",
    value: { template_id: "template", resource_type: "task", resource_id: "task", title: "review" },
  };
  await assert.rejects(repo.createRequest(input), /approval_resource_not_found/);
  assert.equal(captured.length, 0);
  targetExists = true;
  const created = await repo.createRequest(input);
  assert.equal(created.status, "pending");
  const count = captured.length;
  assert.deepEqual(await repo.createRequest(input), created);
  targetExists = false;
  await assert.rejects(repo.createRequest(input), /approval_request_not_found/);
  assert.equal(captured.length, count);
  const [sql, args] = captured.find(([q]) => q.startsWith("INSERT INTO approval_requests"));
  assert.doesNotMatch(sql, /organization_id|workspace_id/);
  assert.equal(args[2], "version");
  assert.equal(JSON.parse(args[6]).snapshot_status, "captured");
  assert.deepEqual(
    captured.find(([q]) => q.startsWith("INSERT INTO approval_node_runs"))[1].slice(5, 8),
    ["named", "named", "backup"],
  );
  assert.deepEqual(
    ledger.map((x) => [x[0], x[2]]),
    [
      ["approval_requests", "owner"],
      ["approval_node_runs", "owner"],
      ["approval_escalation_jobs", "owner"],
      ["outbox_events", "owner"],
    ],
  );
  const [outboxSql, outbox] = captured.find(([q]) => q.startsWith("INSERT INTO outbox_events"));
  assert.doesNotMatch(outboxSql, /organization_id|workspace_id/);
  assert.equal(JSON.parse(outbox[2]).approval_request_id, "request");
  assert.equal(JSON.parse(outbox[2]).account_projection_contract, 25);
  assert.equal(
    JSON.parse(outbox[2]).approval_escalation_job_id,
    captured.find(([q]) => q.startsWith("INSERT INTO approval_escalation_jobs"))[1][0],
  );
  assert.ok(captured.some(([q]) => q.startsWith("INSERT INTO platform_audit_events")));
});

test("0180 template options expose write readiness only with the account schema and an active verified account", async () => {
  let native = false,
    legacyChild = false,
    active = true;
  const repo = new MySqlApprovalRepository({
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates"))
        return [
          (native ? ["account_id", "historical_context"] : ["organization_id", "workspace_id"]).map(
            (Field) => ({ Field }),
          ),
        ];
      if (sql.startsWith("SHOW COLUMNS"))
        return [legacyChild ? [{ Field: "organization_id" }, { Field: "workspace_id" }] : []];
      if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT id FROM users")) {
        assert.deepEqual(args, ["verified"]);
        return [active ? [{ id: "verified" }] : []];
      }
      assert.match(sql, /approval_templates[\s\S]*ra.account_id=\?/);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      assert.ok(args.every((x) => x === "verified"));
      if (native) assert.match(sql, /t.account_id=\?/);
      return [[]];
    },
  });
  assert.deepEqual(await repo.accountTemplateOptions({ accountId: "verified" }), {
    items: [],
    canManage: false,
  });
  native = true;
  legacyChild = true;
  assert.deepEqual(await repo.accountTemplateOptions({ accountId: "verified" }), {
    items: [],
    canManage: false,
  });
  legacyChild = false;
  assert.deepEqual(await repo.accountTemplateOptions({ accountId: "verified" }), {
    items: [],
    canManage: true,
  });
  active = false;
  assert.deepEqual(await repo.accountTemplateOptions({ accountId: "verified" }), {
    items: [],
    canManage: false,
  });
});
