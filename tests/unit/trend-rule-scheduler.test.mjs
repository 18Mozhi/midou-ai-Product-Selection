import test from "node:test";
import assert from "node:assert/strict";
import { MySqlAutomaticSourceScheduler } from "../../apps/worker/dist/automatic-source-scheduler.js";

for (const mode of ["shared", "unassigned", "exclusive_owner", "missing", "ledger_error", "account_scope_mismatch", "native_task"]) {
  test(`native trend rule scheduling: ${mode}`, async () => {
    const now = new Date("2026-08-19T10:00:00.000Z");
    const rule = {
      id: "rule", account_id: "sealed-account", created_by: "different-creator",
      historical_context: mode==="native_task" ? "do not parse" : {organization_id: "org", workspace_id: "workspace"}, market: "US", language: "en",
      include_keywords_json: ["portable fan"], collection_interval_minutes: 60, source_cursor: 0,
    };
    const calls = [];
    const connection = {
      beginTransaction: async () => calls.push(["begin"]),
      commit: async () => calls.push(["commit"]),
      rollback: async () => calls.push(["rollback"]),
      release: () => calls.push(["release"]),
      query: async (sql, values = []) => {
        calls.push([sql, values]);
        if (sql.startsWith("SHOW COLUMNS FROM automatic_source_schedules"))
          return [["account_id","historical_context","is_enabled","ownership_reason"].map(Field=>({Field}))];
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules")) return [[{Field:"historical_context"}]];
        if (sql.startsWith("SHOW COLUMNS FROM collection_tasks "))
          return [(mode==="native_task"?["account_id"]:["organization_id","workspace_id"]).map(Field=>({Field}))];
        if (sql.startsWith("SELECT primary_account_id FROM account_ownership_cutover")) return [[{primary_account_id:rule.account_id}]];
        if (sql.startsWith("SELECT 1 FROM collection_tasks WHERE status IN")) return [[]];
        if (sql.startsWith("SELECT s.account_id FROM account_retirement_scopes")) {
          assert.deepEqual(values,["org","workspace",rule.account_id,mode]);
          return [mode==="account_scope_mismatch"?[]:[{account_id:rule.account_id}]];
        }
        if (sql.startsWith("SELECT COUNT(*) count FROM collection_tasks") ||
            sql.startsWith("SELECT (SELECT COUNT(*) FROM collection_tasks backlog")) return [[{ count: 0 }]];
        if (sql.startsWith("SELECT r.* FROM trend_monitoring_rules r JOIN users")) {
          assert.match(sql,/ow.account_id=r.account_id/);
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          return [[rule]];
        }
        if (sql.includes("FROM account_owned_records")) {
          assert.deepEqual(values, [rule.id, rule.account_id]);
          assert.match(sql, /contract_version=25.*primary_account_id.*LOCK IN SHARE MODE/);
          return [mode === "missing" ? [] : [{ account_id: rule.account_id, reason: mode==="native_task" ? "shared" : mode }]];
        }
        if (sql.includes("FROM providers")) return [[{ id: "provider", code: "google_news_search", markets_json: ["US"] }]];
        if (sql.includes("SELECT id FROM users WHERE id=?")) return [[{ id: values[0] }]];
        if (sql.startsWith("INSERT INTO account_owned_records") && mode === "ledger_error")
          throw new Error("fixture_ledger_write_error");
        if (/^(INSERT|UPDATE)/.test(sql)) return [{ affectedRows: 1 }];
        throw new Error("Unexpected query: " + sql);
      },
    };
    const scheduler = new MySqlAutomaticSourceScheduler({ getConnection: async () => connection },
      16, () => now, { systemActorId: "system-actor", tenantActiveTaskBudget: 2, queueBacklogLimit: 1000 });
    if (["missing","ledger_error","account_scope_mismatch"].includes(mode)) {
      await assert.rejects(scheduler.processRuleOnce(), {
        message: mode === "missing" ? "trend_rule_schedule_owner_mismatch" : mode === "account_scope_mismatch" ? "trend_rule_task_context_owner_mismatch" : "fixture_ledger_write_error",
      });
      assert.deepEqual(calls.slice(-2), [["rollback"], ["release"]]);
      assert.equal(calls.some(([sql]) => sql.startsWith("UPDATE trend_monitoring_rules")), false);
      if (mode === "missing") assert.equal(calls.some(([sql]) => sql.startsWith("INSERT")), false);
      return;
    }
    const result = await scheduler.processRuleOnce();
    const tables = ["collection_tasks", "collection_subqueries", "collection_task_events", "collection_task_outbox"];
    const records = tables.map((t) => calls.find(([sql]) => sql.startsWith(`INSERT INTO ${t} `))[1]);
    const ledger = calls.find(([sql]) => sql.startsWith("INSERT INTO account_owned_records"));
    assert.deepEqual(ledger[1][0], tables.map((t, i) => [t, records[i][0], rule.account_id, mode==="native_task" ? "shared" : mode]));
    if(mode==="native_task"){
      assert.equal(records[0][1],rule.account_id);
      assert.equal(Object.hasOwn(result,"workspaceId"),false);
      assert.equal(calls.some(([sql])=>sql.includes("FROM account_retirement_scopes")),false);
      assert.ok(calls.filter(([sql])=>sql.startsWith("INSERT")).every(([sql])=>!/organization_id|workspace_id/.test(sql)));
    }
    assert.equal(records[0][0], result.taskId);
    assert.equal(records[2][3], "system-actor");
    assert.equal(JSON.parse(records[2][6]).monitoring_rule_id, rule.id);
    const update = calls.findIndex(([sql]) => sql.startsWith("UPDATE trend_monitoring_rules"));
    assert.ok(update > calls.indexOf(ledger));
    assert.equal(calls[update][1][2].toISOString(), "2026-08-19T11:00:00.000Z");
    assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
  });
}

test("rule scheduler queries the manual keyword crawler and completes all source batches before the interval", async () => {
  const now = new Date("2026-08-19T10:00:00.000Z");
  const statements = [];
  const targets = [];
  let ruleUpdate = null;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values = []) => {
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM automatic_source_schedules"))
        return [[{ Field:"organization_id" },{ Field:"workspace_id" }]];
      statements.push(sql);
      if (sql.startsWith("SELECT COUNT(*) count FROM collection_tasks"))
        return [[{ count: 0 }], []];
      if (sql.includes("FROM trend_monitoring_rules r WHERE"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000004301",
              organization_id: "00000000-0000-4000-8000-000000004302",
              workspace_id: "00000000-0000-4000-8000-000000004303",
              created_by: "00000000-0000-4000-8000-000000004304",
              market: "GLOBAL",
              language: "multi",
              include_keywords_json: JSON.stringify(["portable fan"]),
              collection_interval_minutes: 60,
              source_cursor: 0,
            },
          ],
          [],
        ];
      if (sql.includes("SELECT id FROM users WHERE id=?")) return [[{ id: values[0] }], []];
      if (sql.includes("SELECT id,code,markets_json FROM providers"))
        return [
          Array.from({ length: 18 }, (_, index) => ({
            id: `provider-${index}`,
            code:
              index === 0
                ? "google_news_search"
                : index === 1
                  ? "amazon_product"
                  : index === 2
                    ? "1688_search"
                    : `source-${index}`,
            markets_json: JSON.stringify([index % 2 ? "US" : "JP"]),
          })),
          [],
        ];
      if (sql.startsWith("INSERT INTO collection_tasks ")) return [{affectedRows:1}];
      if (sql.includes("INSERT INTO collection_subqueries")) {
        targets.push(JSON.parse(values[3]));
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE trend_monitoring_rules SET source_cursor")) ruleUpdate = values;
      return [[], []];
    },
  };
  const pool = { getConnection: async () => connection };
  const result = await new MySqlAutomaticSourceScheduler(pool, 16, () => now, {
    systemActorId: "00000000-0000-4000-8000-000000004399",
    tenantActiveTaskBudget: 2,
    queueBacklogLimit: 1000,
  }).processRuleOnce();

  assert.equal(result.status, "scheduled");
  assert.equal(result.sourceCount, 16);
  assert.equal(statements.some((sql) => sql.includes("account_owned_records")), false);
  assert.ok(
    statements.some((sql) => sql.includes("next_collection_at IS NULL OR r.next_collection_at<=?")),
  );
  assert.ok(
    statements.some(
      (sql) => sql.includes("google-news-rss-v1") && sql.includes("google-news-fixed-rss-v1"),
    ),
  );
  assert.ok(statements.some((sql) => sql.includes("code<>'1688_search'")));
  assert.equal(
    statements.some((sql) => sql.includes("1688-browser-contract-v3")),
    false,
  );
  assert.ok(
    statements.some(
      (sql) =>
        sql.includes("terms_review_status='approved'") &&
        sql.includes("terms_version IS NOT NULL") &&
        !sql.includes("terms_reference_url IS NOT NULL") &&
        sql.includes("terms_expires_at>NOW(3)"),
    ),
  );
  assert.equal(ruleUpdate[0], 16);
  assert.equal(new Date(ruleUpdate[2]).toISOString(), "2026-08-19T10:01:00.000Z");
  assert.ok(
    statements.some(
      (sql) =>
        sql.includes("ct.organization_id=r.organization_id") &&
        sql.includes("COALESCE(r.last_collection_at") &&
        sql.includes("r.organization_id,r.id"),
    ),
  );
  assert.ok(statements.some((sql) => sql.includes("SELECT id FROM users WHERE id=?")));
  assert.deepEqual(
    targets.find((target) => target.projection_type === "rule_product_discovery"),
    {
      monitoring_rule_id: "00000000-0000-4000-8000-000000004301",
      query: "portable fan",
      market: "GLOBAL",
      language: "multi",
      projection_type: "rule_product_discovery",
    },
  );
  assert.equal(
    targets.filter((target) => target.projection_type === "rule_product_discovery").length,
    1,
  );
});

test("automatic source scheduler writes one approved 16-source batch and advances its cursor", async () => {
  const now = new Date("2026-08-19T10:00:00.000Z");
  const statements = [];
  const subqueries = [];
  const events = [];
  const outbox = [];
  let scheduleUpdate = null;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values = []) => {
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM automatic_source_schedules"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      statements.push(sql);
      if (sql.startsWith("SELECT COUNT(*) count FROM collection_tasks"))
        return [[{ count: 0 }], []];
      if (sql.includes("SELECT r.* FROM trend_monitoring_rules r WHERE")) return [[], []];
      if (sql.startsWith("SELECT COUNT(*) count FROM trend_monitoring_rules"))
        return [[{ count: 0 }], []];
      if (sql.includes("SELECT s.* FROM automatic_source_schedules"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000004501",
              organization_id: "00000000-0000-4000-8000-000000004502",
              workspace_id: "00000000-0000-4000-8000-000000004503",
              provider_offset: 0,
            },
          ],
          [],
        ];
      if (sql.includes("SELECT id,code FROM providers"))
        return [
          Array.from({ length: 18 }, (_, index) => ({
            id: `approved-provider-${index}`,
            code: `source-${index}`,
          })),
          [],
        ];
      if (sql.startsWith("SELECT id FROM users WHERE id=?")) return [[{ id: values[0] }], []];
      if (sql.startsWith("INSERT INTO collection_tasks ")) return [{affectedRows:1}];
      if (sql.includes("INSERT INTO collection_subqueries")) {
        subqueries.push(values);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("INSERT INTO collection_task_events")) events.push(values);
      if (sql.includes("INSERT INTO collection_task_outbox")) outbox.push(values);
      if (sql.startsWith("UPDATE automatic_source_schedules SET last_task_id="))
        scheduleUpdate = values;
      return [[], []];
    },
  };
  const result = await new MySqlAutomaticSourceScheduler(
    { getConnection: async () => connection },
    16,
    () => now,
    {
      systemActorId: "00000000-0000-4000-8000-000000004599",
      tenantActiveTaskBudget: 2,
      queueBacklogLimit: 1000,
    },
  ).processOnce();

  assert.equal(result.status, "scheduled");
  assert.equal(result.organizationId, "00000000-0000-4000-8000-000000004502");
  assert.equal(result.workspaceId, "00000000-0000-4000-8000-000000004503");
  assert.equal(result.sourceCount, 16);
  assert.equal(subqueries.length, 16);
  assert.ok(
    statements.some(
      (sql) => sql.startsWith("INSERT INTO collection_tasks") && sql.includes("NULL,'high'"),
    ),
  );
  assert.ok(subqueries.every((values) => values.at(-1) === result.taskId));
  assert.equal(events.length, 1);
  assert.equal(events[0][2], "hotspot.automatic.scheduled");
  assert.deepEqual(JSON.parse(events[0][6]), { source_count: 16, provider_offset: 0 });
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0][2], "hotspot.automatic.scheduled");
  assert.ok(
    statements.some(
      (sql) =>
        sql.includes("terms_review_status='approved'") &&
        !sql.includes("terms_reference_url IS NOT NULL") &&
        sql.includes("terms_expires_at>NOW(3)"),
    ),
  );
  assert.equal(scheduleUpdate[0], result.taskId);
  assert.equal(scheduleUpdate[1], 16);
  assert.equal(new Date(scheduleUpdate[3]).toISOString(), "2026-08-19T10:01:00.000Z");
  assert.equal(scheduleUpdate[5], "00000000-0000-4000-8000-000000004501");
});

test("full automatic source scheduler skips persistence when no terms-approved provider is eligible", async () => {
  const now = new Date("2026-08-19T10:00:00.000Z");
  const statements = [];
  let scheduleUpdate = null;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values = []) => {
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM automatic_source_schedules"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      statements.push(sql);
      if (sql.startsWith("SELECT COUNT(*) count FROM collection_tasks"))
        return [[{ count: 0 }], []];
      if (sql.includes("SELECT s.* FROM automatic_source_schedules"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000004401",
              organization_id: "00000000-0000-4000-8000-000000004402",
              workspace_id: "00000000-0000-4000-8000-000000004403",
              provider_offset: 0,
            },
          ],
          [],
        ];
      if (sql.includes("SELECT id,code FROM providers")) return [[], []];
      if (sql.startsWith("UPDATE automatic_source_schedules SET next_scheduled_at"))
        scheduleUpdate = values;
      return [[], []];
    },
  };
  const result = await new MySqlAutomaticSourceScheduler(
    { getConnection: async () => connection },
    16,
    () => now,
    {
      systemActorId: "00000000-0000-4000-8000-000000004399",
      tenantActiveTaskBudget: 2,
      queueBacklogLimit: 1000,
    },
  ).processFullOnce();

  assert.deepEqual(result, { status: "idle" });
  assert.ok(
    statements.some(
      (sql) =>
        sql.includes("SELECT id,code FROM providers") &&
        sql.includes("terms_review_status='approved'") &&
        sql.includes("terms_expires_at>NOW(3)"),
    ),
  );
  assert.equal(
    statements.some((sql) => sql.startsWith("INSERT INTO collection_tasks")),
    false,
  );
  assert.equal(new Date(scheduleUpdate[0]).toISOString(), now.toISOString());
  assert.equal(scheduleUpdate[2], "00000000-0000-4000-8000-000000004401");
});

test("automatic source scheduler blocks new work at the global backlog gate", async () => {
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM automatic_source_schedules"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      statements.push(sql);
      if (sql.startsWith("SELECT COUNT(*) count FROM collection_tasks"))
        return [[{ count: 20 }], []];
      return [[], []];
    },
  };
  const scheduler = new MySqlAutomaticSourceScheduler(
    { getConnection: async () => connection },
    16,
    () => new Date("2026-08-19T10:00:00.000Z"),
    {
      systemActorId: "00000000-0000-4000-8000-000000004399",
      tenantActiveTaskBudget: 2,
      queueBacklogLimit: 20,
    },
  );
  const result = await scheduler.processFullOnce();
  assert.deepEqual(result, {
    status: "backpressure",
    reason: "queue_backlog_limit",
  });
  assert.equal(
    statements.some((sql) => sql.startsWith("INSERT INTO collection_tasks")),
    false,
  );
});
