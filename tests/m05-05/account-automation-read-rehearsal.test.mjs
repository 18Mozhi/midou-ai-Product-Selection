import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { AutomationService } from "../../apps/api/dist/automation-service.js";
import { MySqlAutomationRepository } from "../../apps/api/dist/mysql-automation-repository.js";

const id = "00000000-0000-4000-8000-000000000351";
const now = new Date("2026-01-01T00:00:00.000Z");
const rule = {
  id,
  name: "Preserved rule",
  organization_id: "org",
  workspace_id: "ws",
  owner_id: "original-operator",
  action_assignee_id: "original-assignee",
  version: 2,
};

test("0196 rule history keeps only own notification and native task references", async () => {
  const seen = [];
  const repository = new MySqlAutomationRepository({
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM automation_rules"))
        return [[{ Field: "account_id" }, { Field: "historical_context" }]];
      if (
        sql.startsWith("SHOW COLUMNS FROM automation_executions") ||
        sql.startsWith("SHOW COLUMNS FROM outbox_events")
      )
        return [[]];
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT r.*")) {
        assert.match(sql, /owner\.reason IN \('shared','unassigned'\) AND owner\.account_id=cut\.primary_account_id/);
        assert.match(sql, /r\.account_id=owner\.account_id/);
        assert.deepEqual(args, [id, "main"]);
        return [[{ ...rule, account_id: "main" }]];
      }
      seen.push([sql, args]);
      return [[]];
    },
  });
  const result = await repository.detail({ ruleId: id, accountId: "main" });
  assert.equal(result.owner_id, "original-operator");
  const [[sql, args]] = seen;
  assert.match(sql, /LEFT JOIN notifications n ON n.id=e.notification_id AND n.recipient_id=\?/);
  assert.match(sql, /h.legacy_org_id=r.organization_id/);
  assert.match(
    sql,
    /ra.source_table='outbox_events' AND ra.source_id=n.source_event_id AND ra.account_id=r.account_id/,
  );
  assert.match(sql, /t.account_id=r.account_id/);
  assert.match(
    sql,
    /ra.source_table='automation_executions' AND ra.source_id=e.id AND ra.account_id=\?/,
  );
  assert.doesNotMatch(sql, /\b(?:n|t|parent)\.(?:organization_id|workspace_id)\b/);
  assert.deepEqual(args, ["main", "main", id, "main", "main"]);
});

for (const legacy of [true, false])
  test(`account automation protects notifications on both schema shapes (legacy=${legacy})`, async () => {
    let ready = false;
    let reads = 0;
    let executionReads = 0;
    const pool = {
      async query(sql, args) {
        if (sql.startsWith("SHOW COLUMNS FROM automation_rules "))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM notifications"))
          return [
            ["organization_id", "workspace_id", "recipient_id", "source_event_id"].map((Field) => ({
              Field,
            })),
          ];
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.startsWith("SHOW COLUMNS FROM automation_executions"))
          return [(legacy ? ["organization_id", "workspace_id"] : []).map((Field) => ({ Field }))];
        reads++;
        if (sql.includes("LEFT JOIN automation_executions e ON e.id=")) {
          assert.match(sql, /owner.source_table='automation_rules' AND owner.source_id=r.id/);
          assert.match(sql, /owner\.reason IN \('shared','unassigned'\) AND owner\.account_id=cut\.primary_account_id/);
          assert.match(
            sql,
            /ra.source_table='automation_executions' AND ra.source_id=e2.id AND ra.account_id=owner.account_id/,
          );
          assert.equal(
            sql.includes("e2.organization_id=r.organization_id AND e2.workspace_id=r.workspace_id"),
            legacy,
          );
          assert.match(sql, /WHERE owner.account_id=\?/);
          assert.equal(args.length, 1);
          return [
            args[0] === "main"
              ? [{ ...rule, latest_execution_status: "succeeded", latest_execution_at: now }]
              : [],
          ];
        }
        if (sql.includes("SELECT r.* FROM automation_rules")) {
          assert.match(sql, /owner.source_table='automation_rules' AND owner.source_id=r.id/);
          assert.match(sql, /owner\.reason IN \('shared','unassigned'\) AND owner\.account_id=cut\.primary_account_id/);
          return [args[0] === id && args[1] === "main" ? [rule] : []];
        }
        executionReads++;
        assert.match(sql, /n.id notification_id/);
        assert.match(sql, /n.recipient_id=\?/);
        const scope = legacy ? "e" : "r";
        assert.ok(
          sql.includes(
            `n.organization_id=${scope}.organization_id AND n.workspace_id=${scope}.workspace_id`,
          ),
        );
        if (!legacy) assert.match(sql, /JOIN automation_rules r ON r.id=e.rule_id/);
        assert.match(sql, /t.id action_resource_id/);
        assert.match(sql, /t.deleted_at IS NULL/);
        assert.match(sql, /ra.source_table='tasks' AND ra.source_id=t.id AND ra.account_id=\?/);
        assert.match(
          sql,
          /ra.source_table='automation_executions' AND ra.source_id=e.id AND ra.account_id=\?/,
        );
        assert.deepEqual(args, ["main", "main", id, "org", "ws", "main"]);
        return [
          [
            {
              id: "execution-1",
              rule_version: 1,
              attempt_count: 2,
              notification_id: null,
              action_resource_type: "notification",
              action_resource_id: null,
              created_at: now,
              updated_at: now,
            },
            {
              id: "execution-2",
              rule_version: 2,
              attempt_count: 1,
              notification_id: "own-notification",
              action_resource_type: "task",
              action_resource_id: "own-task",
              created_at: now,
              updated_at: now,
            },
          ],
        ];
      },
    };
    const app = buildApp({
      automations: {
        service: new AutomationService(new MySqlAutomationRepository(pool)),
        accountReadRehearsal: true,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
        auth: {
          async authenticate(id) {
            return { user: { id, email_verified_at: id === "unverified" ? null : now } };
          },
        },
        authorization: {
          async resolveSession() {
            assert.fail("legacy scope was consulted");
          },
        },
      },
    });
    const get = (account, detail = false) =>
      app.inject({
        url: `/api/v1/automations${detail ? "/" + id : ""}?accountId=main`,
        headers: { cookie: `scoutops_session=${account}` },
      });
    try {
      for (const [method, url] of [
        ["POST", "/api/v1/automations"],
        ["POST", "/api/v1/automations/preview"],
        ["PATCH", "/api/v1/automations/" + id],
      ]) {
        assert.equal((await app.inject({ method, url })).statusCode, 404);
      }
      assert.equal((await get("unverified", true)).statusCode, 403);
      assert.equal((await get("main")).statusCode, 503);
      assert.equal(reads, 0);
      ready = true;
      const foreign = await get("other");
      assert.equal(foreign.statusCode, 200);
      assert.deepEqual(foreign.json().data, []);
      assert.equal((await get("other", true)).statusCode, 404);
      assert.equal(executionReads, 0);
      const listing = await get("main");
      assert.equal(listing.statusCode, 200, listing.body);
      assert.equal(listing.headers["cache-control"], "private, no-store");
      assert.equal(listing.json().data[0].latest_execution_status, "succeeded");
      const detail = await get("main", true);
      assert.equal(detail.statusCode, 200, detail.body);
      const row = detail.json().data;
      assert.equal(row.owner_id, "original-operator");
      assert.equal(row.action_assignee_id, "original-assignee");
      assert.equal(row.executions[0].notification_id, null);
      assert.equal(row.executions[0].action_resource_id, null);
      assert.equal(row.executions[0].attempt_count, 2);
      assert.equal(row.executions[1].notification_id, "own-notification");
      assert.equal(row.executions[1].action_resource_id, "own-task");
    } finally {
      await app.close();
    }
  });
