import test from "node:test";
import assert from "node:assert/strict";
import { recoverSupersededIntelligenceProjections } from "../../apps/worker/dist/intelligence-provenance-recovery.js";
const jobId = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-18T07:00:00Z"),
  scope = { organizationId: "org", workspaceId: "workspace", projectionJobIds: [jobId] };
function fixture({ empty = false, lost = false, changed = false, auditFailure = false } = {}) {
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
      if (sql.startsWith("SELECT"))
        return [
          lost
            ? []
            : [
                {
                  id: jobId,
                  attempt_count: 1,
                  updated_at: "original-time",
                  topic_id: "topic",
                  actor_id: "system-actor",
                  source_record_id: "source",
                },
              ],
        ];
      if (sql.startsWith("UPDATE")) return [{ affectedRows: changed ? 0 : 1 }];
      if (auditFailure) throw new Error("audit_write_failed");
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: async (sql, params) => {
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
  assert.match(f.calls[1].sql, /AND trend_projection_jobs.id=\? LIMIT 1 FOR UPDATE$/);
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
  assert.equal(audit.params[5], result.request_id);
  assert.equal(audit.params[6], result.request_id);
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
  for (const projectionJobIds of [[], ["invalid"], Array.from({ length: 21 }, () => jobId)])
    await assert.rejects(
      recoverSupersededIntelligenceProjections(f.pool, { ...scope, projectionJobIds }, now),
      /targets_invalid/,
    );
  assert.equal(f.calls.length, 0);
});
