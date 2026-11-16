import test from "node:test";
import assert from "node:assert/strict";
import { recoverSupersededIntelligenceProjections } from "../../apps/worker/dist/intelligence-provenance-recovery.js";
const jobId = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-18T07:00:00Z"),
  scope = { organizationId: "org", workspaceId: "workspace", projectionJobIds: [jobId] };
function fixture({
  empty = false,
  lost = false,
  changed = false,
  auditFailure = false,
  eligibilityLost = false,
  native = false,
  topicFields = ["account_id"],
  auditMissing = false,
  ledgerFailure = false,
} = {}) {
  const calls = [],
    state = { commits: 0, rollbacks: 0, releases: 0 };
  let scanned = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => state.commits++,
    rollback: async () => state.rollbacks++,
    release: () => state.releases++,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (params && !sql.startsWith("INSERT INTO account_owned_records")) assert.equal((sql.match(/\?/g) ?? []).length, params.length);
      if (sql.startsWith("SHOW COLUMNS FROM trend_events"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SELECT id FROM trend_projection_jobs"))
        return [lost ? [] : [{ id: jobId }]];
      if (sql.startsWith("SELECT"))
        return [
          eligibilityLost
            ? []
            : [
                {
                  id: jobId,
                  attempt_count: 1,
                  updated_at: "original-time",
                  topic_id: "topic",
                  actor_id: "system-actor",
                  source_record_id: "source",
                  owner_reason: "shared",
                },
              ],
        ];
      if (sql.startsWith("UPDATE")) return [{ affectedRows: changed ? 0 : 1 }];
      if (auditFailure) throw new Error("audit_write_failed");
      if (ledgerFailure && sql.startsWith("INSERT INTO account_owned_records")) throw new Error("owner_write_failed");
      if (auditMissing && sql.startsWith("INSERT INTO trend_events")) return [{ affectedRows: 0 }];
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: async (sql, params) => {
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records"))
        return [(native ? ["account_id"] : ["organization_id","workspace_id"]).map(Field => ({ Field }))];
      if (sql.startsWith("SHOW COLUMNS FROM trend_topics"))
        return [topicFields.map(Field => ({ Field }))];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
        return [[{Field:"account_id"}]];
      calls.push({ sql, params });
      if (empty || scanned) return [[]];
      scanned = true;
      return [[{ id: jobId }]];
    },
    getConnection: async () => connection,
  };
  return { pool, calls, state };
}
test("historical provenance correction is scoped, bounded and atomically audited without resetting attempts", async () => {
  const f = fixture(),
    result = await recoverSupersededIntelligenceProjections(f.pool, scope, now);
  assert.deepEqual(result.requeued, [jobId]);
  assert.equal(result.inspected, 1);
  assert.equal(f.state.commits, 1);
  const candidate = f.calls[0];
  assert.match(candidate.sql, /LIMIT 20$/);
  assert.deepEqual(candidate.params, ["org", "workspace", jobId]);
  assert.match(candidate.sql, /original.status='superseded'/);
  assert.match(candidate.sql, /last_error_code='intelligence_provenance_invalid'/);
  assert.match(candidate.sql, /history.actor_type='worker'/);
  assert.match(candidate.sql, /JSON_CONTAINS/);
  assert.match(candidate.sql, /collection_scope_org.status='active'/);
  assert.match(candidate.sql, /q\.task_id=e\.collection_task_id AND q\.provider_id=n\.provider_id/);
  assert.match(candidate.sql, /original_task\.organization_id=t\.organization_id AND original_task\.workspace_id=t\.workspace_id/);
  assert.doesNotMatch(candidate.sql, /\b(?:n|e|original|original_evidence)\.(?:organization_id|workspace_id)/);
  assert.match(
    f.calls[1].sql,
    /WHERE id=\? AND EXISTS \(SELECT 1 FROM normalized_records n JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id JOIN collection_tasks t ON t.id=e.collection_task_id WHERE n.id=trend_projection_jobs.normalized_record_id AND t.organization_id=\? AND t.workspace_id=\?\).*FOR UPDATE$/,
  );
  assert.doesNotMatch(f.calls[1].sql, /ORDER BY/);
  assert.doesNotMatch(f.calls[2].sql, /FOR UPDATE/);
  assert.match(f.calls[2].sql, /AND trend_projection_jobs.id=\? LIMIT 1$/);
  const update = f.calls.find((c) => c.sql.startsWith("UPDATE"));
  assert.doesNotMatch(update.sql, /attempt_count\s*=/);
  assert.deepEqual(update.params, [now, now, jobId, "org", "workspace"]);
  const audit = f.calls.find((c) => c.sql.startsWith("INSERT INTO trend_events"));
  const payload = JSON.parse(audit.params.at(-2));
  assert.equal(payload.previous_attempt_count, 1);
  assert.equal(payload.previous_status, "failed_terminal");
  assert.equal(payload.previous_error_code, "intelligence_provenance_invalid");
  assert.equal(payload.previous_updated_at, "original-time");
  assert.equal(payload.intelligence_source_record_id, "source");
  assert.equal(audit.params[8], result.request_id);
  assert.equal(audit.params[9], result.request_id);
  assert.equal(
    (await recoverSupersededIntelligenceProjections(f.pool, scope, now)).requeued.length,
    0,
  );
});
test("no matching historical false negative performs no writes or transaction", async () => {
  const f = fixture({ empty: true });
  assert.deepEqual(
    (await recoverSupersededIntelligenceProjections(f.pool, scope, now)).requeued,
    [],
  );
  assert.equal(f.calls.length, 1);
  assert.equal(f.state.releases, 0);
});
test("eligibility lost before locked recheck leaves the terminal job unchanged", async () => {
  const f = fixture({ lost: true });
  assert.deepEqual(
    (await recoverSupersededIntelligenceProjections(f.pool, scope, now)).requeued,
    [],
  );
  assert.equal(
    f.calls.some((c) => c.sql.startsWith("UPDATE")),
    false,
  );
  assert.equal(f.state.releases, 1);
});
for (const options of [{ auditFailure: true }, { changed: true }])
  test(`recovery rolls back if atomic update/audit fails ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(recoverSupersededIntelligenceProjections(f.pool, scope, now));
    assert.equal(f.state.commits, 0);
    assert.equal(f.state.rollbacks, 1);
    assert.equal(f.state.releases, 1);
  });

test("recovery requires an explicit bounded list of verified projection IDs", async () => {
  const f = fixture();
  for (const projectionJobIds of [[], ["invalid"], ["-".repeat(36)], Array.from({ length: 21 }, () => jobId)])
    await assert.rejects(
      recoverSupersededIntelligenceProjections(f.pool, { ...scope, projectionJobIds }, now),
      /targets_invalid/,
    );
  assert.equal(f.calls.length, 0);
});

test("evidence eligibility lost after the primary-key lock performs no requeue", async () => {
  const f = fixture({ eligibilityLost: true });
  assert.deepEqual(
    (await recoverSupersededIntelligenceProjections(f.pool, scope, now)).requeued,
    [],
  );
  assert.equal(
    f.calls.some((c) => c.sql.startsWith("UPDATE")),
    false,
  );
});

const accountScope = { accountId: "account", projectionJobIds: [jobId] };
test("0191 recovery reads the precise account-owned chain and audits the requeue under that account", async () => {
  const f = fixture({ native: true });
  assert.deepEqual((await recoverSupersededIntelligenceProjections(f.pool, accountScope, now)).requeued, [jobId]);
  assert.deepEqual(f.calls[0].params, ["account", jobId]);
  assert.doesNotMatch(f.calls.map(c => c.sql).join("\n"), /organization_id|workspace_id|organizations|workspaces/);
  for (const {sql} of [f.calls[0], f.calls[2]]) {
    assert.match(sql, /e.account_id=n.account_id/);
    assert.match(sql, /t.account_id=n.account_id/);
    assert.match(sql, /original_task.account_id=n.account_id/);
    assert.match(sql, /source_signal.normalized_record_id=original.id AND source_signal.raw_evidence_id=original_evidence.id/);
    assert.match(sql, /source_task_owner.account_id=n.account_id/);
    assert.match(sql, /history_owner.account_id=n.account_id/);
    assert.match(sql, /cut.primary_account_id=n.account_id/);
  }
  assert.match(f.calls[2].sql, /FOR UPDATE$/);
  assert.match(f.calls[1].sql,/jo.source_id=trend_projection_jobs.id AND jo.account_id=n.account_id/);
  const audit = f.calls.find(c => c.sql.startsWith("INSERT INTO trend_events"));
  const owners = f.calls.find(c => c.sql.startsWith("INSERT INTO account_owned_records"));
  assert.deepEqual(owners.params[0], [["trend_events", audit.params[0], "account", "shared"]]);
  assert.equal(JSON.parse(audit.params[5]).previous_attempt_count, 1);
});

test("0191 rejects a legacy selector, incomplete topic schema, or lost audit parent", async () => {
  await assert.rejects(recoverSupersededIntelligenceProjections(fixture({ native: true }).pool, scope, now), /scope_invalid/);
  await assert.rejects(recoverSupersededIntelligenceProjections(fixture({ native: true, topicFields: ["workspace_id"] }).pool, accountScope, now), /trend_topic_scope_schema_invalid/);
  const f = fixture({ native: true, auditMissing: true });
  await assert.rejects(recoverSupersededIntelligenceProjections(f.pool, accountScope, now), /topic_owner_mismatch/);
  assert.equal(f.state.rollbacks, 1);
  assert.equal(f.state.commits, 0);
});

test("0191 never commits a requeue and audit without its account ledger entry", async () => {
  const f = fixture({ native: true, ledgerFailure: true });
  await assert.rejects(recoverSupersededIntelligenceProjections(f.pool, accountScope, now), /owner_write_failed/);
  assert.equal(f.state.commits, 0);
  assert.equal(f.state.rollbacks, 1);
});
