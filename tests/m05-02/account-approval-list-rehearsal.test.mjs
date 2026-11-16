import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { ApprovalService } from "../../apps/api/dist/approval-service.js";
import { MySqlApprovalRepository } from "../../apps/api/dist/mysql-approval-repository.js";

test("approval queue scopes rows, count, target and current node to the verified account", async () => {
  let version = 11;
  let queries = 0;
  const pool = {
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates "))
        return [[{ Field: "account_id" }, { Field: "historical_context" }]];
      if (/^SHOW COLUMNS FROM (tasks|opportunities) /.test(sql)) return [[{ Field: "account_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM approval_requests")) return [[]];
      if (sql.includes("FROM account_ownership_cutover")) {
        assert.match(sql, /contract_version=25/);
        return [version === 14 ? [{ slot: "current" }] : []];
      }
      queries++;
      assert.match(sql, /ar.source_table='approval_requests' AND ar.source_id=r.id/);
      assert.match(sql, /ar.account_id=\?/);
      assert.match(sql, /ar.account_id=cut.primary_account_id/);
      assert.match(sql, /t.account_id=ar.account_id/);
      assert.match(sql, /task_resource.account_id=ar.account_id/);
      assert.match(sql, /o.account_id=ar.account_id/);
      assert.match(
        sql,
        /FROM opportunity_decisions x JOIN opportunities o ON o.id=x.opportunity_id/,
      );
      assert.match(sql, /FROM tasks task_resource WHERE task_resource.id=r.resource_id/);
      assert.match(
        sql,
        /JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id/,
      );
      assert.doesNotMatch(sql, /v\.(?:organization_id|workspace_id)/);
      assert.doesNotMatch(sql, /r\.(?:organization_id|workspace_id)/);
      for (const source of [
        "approval_templates",
        "approval_template_versions",
        "tasks",
        "opportunity_decisions",
        "opportunities",
      ]) {
        assert.ok(sql.includes(`ra.source_table='${source}'`), source);
      }
      assert.match(sql, /nr.active_approver_id=\?.*nr.status='pending'/);
      assert.match(
        sql,
        /JOIN approval_template_nodes nd ON nd.id=nr.template_node_id AND nd.ordinal=nr.ordinal WHERE nd.template_version_id=r.template_version_id/,
      );
      assert.match(
        sql,
        /ra.source_table='approval_node_runs' AND ra.source_id=nr.id AND ra.account_id=ar.account_id/,
      );
      assert.equal(args[0], args[1]);
      if (sql.startsWith("SELECT COUNT")) return [[{ total: args[0] === "primary" ? 1 : 0 }]];
      assert.match(
        sql,
        /ra.source_table='approval_node_runs' AND ra.source_id=n.id AND ra.account_id=ar.account_id/,
      );
      assert.match(sql, /LIMIT \? OFFSET \?/);
      assert.deepEqual(args.slice(2), [args[0], 2, 0]);
      return [
        args[0] === "primary"
          ? [
              {
                id: "shared-request",
                resource_type: "task",
                resource_id: "owned-task",
                status: "pending",
                current_node_status: "pending",
                active_approver_id: "primary",
                requested_by: "original-requester",
              },
            ]
          : [],
      ];
    },
  };
  const app = buildApp({
    approvals: {
      service: new ApprovalService(new MySqlApprovalRepository(pool)),
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      auth: {
        async authenticate(id) {
          return { user: { id, email_verified_at: id === "unverified" ? null : new Date() } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope was consulted");
        },
      },
    },
  });
  const queue = (id) =>
    app.inject({
      url: "/api/v1/tasks/approvals?involvement=decidable&page_size=2&accountId=primary",
      headers: { cookie: `scoutops_session=${id}` },
    });
  try {
    assert.equal((await queue("primary")).statusCode, 503);
    version = 14;
    assert.equal((await queue("unverified")).statusCode, 403);
    assert.equal(queries, 0);
    const owned = await queue("primary");
    assert.equal(owned.statusCode, 200, owned.body);
    assert.equal(owned.headers["cache-control"], "private, no-store");
    const {
      data: [item],
      meta,
    } = owned.json();
    assert.equal(item.id, "shared-request");
    assert.equal(item.requested_by, "original-requester");
    assert.equal(item.active_approver_id, "primary");
    assert.equal(item.can_decide, true);
    assert.equal(meta.total, 1);
    const foreign = await queue("other-account");
    assert.equal(foreign.statusCode, 200, foreign.body);
    assert.deepEqual(foreign.json().data, []);
    assert.equal(foreign.json().meta.total, 0);
    assert.equal(queries, 4);
  } finally {
    await app.close();
  }
});
