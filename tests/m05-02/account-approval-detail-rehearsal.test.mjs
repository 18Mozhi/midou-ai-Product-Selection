import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { ApprovalService } from "../../apps/api/dist/approval-service.js";
import { MySqlApprovalRepository } from "../../apps/api/dist/mysql-approval-repository.js";

const id = "10000000-0000-4000-8000-000000000001";
const target = "10000000-0000-4000-8000-000000000002";
const opportunity = "10000000-0000-4000-8000-000000000003";
const date = "2026-11-11T01:00:00.000Z";
const owner = "account";
const legacyScope = ["historic-org", "historic-workspace"];

test("account approval detail is fail-closed, read-only and filters its live evidence and history", async () => {
  let receipt = false;
  let targetType = "task";
  let snapshot = null;
  let childReads = 0;
  let requestReads = 0;
  let legacyVersionScope = false;
  let legacyRequestScope = false;
  const pool = {
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates "))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (/^SHOW COLUMNS FROM (tasks|opportunities) /.test(sql))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM approval_template_versions"))
        return [
          legacyVersionScope ? [{ Field: "organization_id" }, { Field: "workspace_id" }] : [],
        ];
      if (sql.startsWith("SHOW COLUMNS FROM approval_requests"))
        return [
          legacyRequestScope ? [{ Field: "organization_id" }, { Field: "workspace_id" }] : [],
        ];
      assert.match(sql, /^SELECT /);
      if (sql.includes("FROM account_ownership_cutover")) {
        assert.match(sql, /contract_version=25/);
        return [receipt ? [{ slot: "current" }] : []];
      }
      const owns = (source, alias) => {
        assert.ok(sql.includes(`ra.source_table='${source}' AND ra.source_id=${alias}`), sql);
      };
      if (sql.includes("FROM approval_requests r")) {
        requestReads++;
        assert.match(sql, /ar.source_table='approval_requests' AND ar.source_id=r.id/);
        assert.match(sql, /WHERE r.id=\?[\s\S]*ar.account_id=\?/);
        assert.match(sql, /v.template_id=t.id/);
        assert.doesNotMatch(sql, /v\.(organization_id|workspace_id)=/);
        assert.match(
          sql,
          /FROM opportunity_decisions x JOIN opportunities o ON o.id=x.opportunity_id/,
        );
        if (!legacyRequestScope) assert.doesNotMatch(sql, /r\.(?:organization_id|workspace_id)/);
        assert.match(sql, /r.resource_type='opportunity_decision' AND EXISTS/);
        for (const [source, alias] of [
          ["approval_templates", "t.id"],
          ["approval_template_versions", "v.id"],
          ["approval_node_runs", "n.id"],
          ["tasks", "task_resource.id"],
          ["opportunity_decisions", "x.id"],
          ["opportunities", "o.id"],
        ])
          owns(source, alias);
        assert.equal(args[0], id);
        assert.deepEqual(args, [id, args[1], args[1]]);
        return [
          args[1] !== owner
            ? []
            : [
                {
                  id,
                  organization_id: legacyScope[0],
                  workspace_id: legacyScope[1],
                  rule_version: 3,
                  resource_type: targetType,
                  resource_id: target,
                  status: "pending",
                  current_node_status: "pending",
                  ownership_account_id: owner,
                  active_approver_id: owner,
                  requested_by: "historic-requester",
                  current_node_ordinal: 1,
                  decision_context_json: snapshot,
                },
              ],
        ];
      }
      childReads++;
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT n.*")) {
        assert.deepEqual(args, [id, owner]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        owns("approval_node_runs", "n.id");
        return [[{ id: "node", ordinal: 1, approver_id: "historic-approver", status: "pending" }]];
      }
      if (sql.includes("FROM approval_actions a")) {
        assert.deepEqual(args, [id, owner, owner]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        owns("approval_actions", "a.id");
        owns("approval_node_runs", "an.id");
        assert.match(sql, /an.approval_request_id=a.approval_request_id/);
        return [
          [
            {
              id: "action",
              node_run_id: "node",
              action: "approved",
              actor_id: "historic-approver",
              created_at: date,
            },
          ],
        ];
      }
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      assert.ok(args.slice(1).every((value) => value === owner));
      if (sql.includes("FROM tasks t")) {
        owns("tasks", "t.id");
        return [
          [{ title: "任务", status: "in_progress", priority: "normal", progress_percent: 30 }],
        ];
      }
      if (sql.includes("FROM opportunity_decisions")) {
        owns("opportunity_decisions", "d.id");
        owns("opportunities", "o.id");
        return [
          [
            {
              opportunity_id: opportunity,
              opportunity_name: "选品",
              action: "observe",
              opportunity_version: 2,
              risk_level: "low",
              recommendation_status: "observe",
            },
          ],
        ];
      }
      if (sql.includes("FROM opportunity_score_runs"))
        owns("opportunity_score_runs", "opportunity_score_runs.id");
      else if (sql.includes("FROM opportunity_profit_runs"))
        owns("opportunity_profit_runs", "opportunity_profit_runs.id");
      else if (sql.includes("opportunity_evidence_links")) {
        owns("opportunity_evidence_links", "opportunity_evidence_links.id");
        owns("raw_evidence", "opportunity_evidence_links.raw_evidence_id");
        owns("trend_signals", "opportunity_evidence_links.evidence_id");
        return [[{ evidence_count: 1, source_count: 1 }]];
      } else assert.fail(sql);
      return [[]];
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
          return { user: { id, email_verified_at: id === "unverified" ? null : date } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope consulted");
        },
      },
    },
  });
  const get = (account) =>
    app.inject({
      url: `/api/v1/tasks/approvals/${id}?accountId=${owner}`,
      headers: { cookie: `scoutops_session=${account}` },
    });
  try {
    assert.equal((await get(owner)).statusCode, 503);
    receipt = true;
    assert.equal((await get("unverified")).statusCode, 403);
    assert.equal(requestReads, 0);
    assert.equal((await get("foreign")).statusCode, 404);
    assert.equal(childReads, 0);
    const response = await get(owner);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "private, no-store");
    const { data } = response.json();
    assert.equal(data.can_decide, true);
    assert.equal(data.requested_by, "historic-requester");
    assert.equal(data.actions[0].actor_id, "historic-approver");
    assert.equal(data.nodes[0].approver_id, "historic-approver");
    assert.equal(data.decision_context.resource.id, target);
    assert.equal(data.decision_context_diff.available, false);
    legacyVersionScope = true;
    legacyRequestScope = true;
    assert.equal((await get(owner)).statusCode, 200);
    legacyVersionScope = false;
    legacyRequestScope = false;

    targetType = "opportunity_decision";
    snapshot = {
      resource: { type: "opportunity", id: opportunity },
      evidence: { requirements: [] },
      rule_versions: { approval_template: "v3" },
      basis_items: [],
      observed_at: date,
    };
    const decision = await get(owner);
    assert.equal(decision.statusCode, 200, decision.body);
    assert.equal(decision.json().data.decision_context_diff.available, true);
    snapshot.resource.id = "foreign-opportunity";
    assert.equal((await get(owner)).statusCode, 404);
  } finally {
    await app.close();
  }
});
