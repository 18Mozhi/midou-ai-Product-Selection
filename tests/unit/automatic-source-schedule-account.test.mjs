import assert from "node:assert/strict";
import test from "node:test";
import { MySqlAutomaticSourceScheduler } from "../../apps/worker/dist/automatic-source-scheduler.js";

const now = new Date("2026-10-15T12:00:00Z");
const scope = { organization_id: "old-org", workspace_id: "old-workspace" };

function fixture({ reason = "shared", count = 0, backlog = 0, brokenLedger = false, incomplete = false,
  accountOnly = false, cursorChanged = false, foreignSharedOwner = false, waveArrives = false } = {}) {
  const statements = [], steps = [];
  let waveReads = 0;
  const owner = reason === "exclusive_owner" || foreignSharedOwner ? "private-account" : "primary-account";
  const c = {
    beginTransaction: async () => steps.push("begin"),
    commit: async () => steps.push("commit"),
    rollback: async () => steps.push("rollback"),
    release: () => steps.push("release"),
    async query(sql, values = []) {
      statements.push([sql, values]);
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks "))
        return [(accountOnly ? ["account_id"] : ["organization_id","workspace_id"]).map(Field => ({Field}))];
      if (sql.startsWith("SHOW COLUMNS")) return [[...(incomplete
        ? ["account_id"] : ["account_id", "ownership_reason", "is_enabled", "historical_context"]
      ).map(Field => ({ Field }))]];
      if (sql.startsWith("SELECT primary_account_id")) return [[{ primary_account_id: "primary-account" }]];
      if (sql.startsWith("SELECT 1 FROM collection_tasks WHERE status IN")) {
        assert.match(sql,/LIMIT 1$/);
        assert.doesNotMatch(sql,/FOR UPDATE|COUNT\(/);
        return [backlog > 0 || (++waveReads > 1 && waveArrives) ? [{present:1}] : []];
      }
      if (sql.startsWith("SELECT (SELECT COUNT(*) FROM collection_tasks backlog")) {
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /task_account.status='active'.*contract_version=25.*source_table='collection_tasks'.*task_owner.account_id=task_cut.primary_account_id.*task_owner.source_id=backlog.id/);
        assert.equal(sql.includes("task_owner.account_id=backlog.account_id"),accountOnly);
        return [[{ count: backlog }]];
      }
      if (sql.startsWith("SELECT COUNT(*) count FROM automatic_source_schedules")) return [[{ count: 1 }]];
      if (sql.startsWith("SELECT s.id")) {
        assert.equal(sql.includes("ct.account_id=a.account_id"),accountOnly);
        return [count >= values[1] ? [] : [{
        id: "old-schedule", account_id: owner, ownership_reason: reason,
        provider_offset: 1, historical_context: accountOnly ? "do not parse" : JSON.stringify(scope),
        }]];
      }
      if (sql.startsWith("SELECT id,code FROM providers"))
        return [[{ id: "provider1" }, { id: "provider2" }]];
      if (sql.startsWith("SELECT id FROM users")) return [[{ id: "system" }]];
      if (brokenLedger && sql.startsWith("INSERT INTO account_owned_records")) throw new Error("ledger_write_failed");
      if (sql.startsWith("UPDATE automatic_source_schedules") && accountOnly) {
        assert.match(sql,/AND account_id=\? AND ownership_reason=\? AND is_enabled=1$/);
        assert.deepEqual(values.slice(-3),["old-schedule",owner,reason]);
        return [{affectedRows:cursorChanged?0:1}];
      }
      assert.equal(sql.startsWith("INSERT IGNORE"), false, sql);
      return [{ affectedRows: 1 }];
    },
  };
  const scheduler = new MySqlAutomaticSourceScheduler({ getConnection: async () => c }, 16, () => now,
    { systemActorId: "system", tenantActiveTaskBudget: 2, queueBacklogLimit: 1000 });
  return { owner, scheduler, steps, statements, setBacklog: value => { backlog=value; } };
}

for (const reason of ["shared", "unassigned", "exclusive_owner"]) {
  test(`account scheduling preserves ${reason} ownership and advances the original cursor`, async () => {
    const f = fixture({ reason });
    const r = await f.scheduler.processFullOnce();
    assert.equal(r.status, "scheduled");
    assert.equal(r.sourceCount, 1);
    const pick = f.statements.find(([sql]) => sql.startsWith("SELECT s.id"));
    assert.match(pick[0], /u.id=s.account_id AND u.status='active'/);
    assert.match(pick[0], /s.is_enabled=1/);
    assert.match(pick[0], /a.account_id=s.account_id/);
    assert.match(pick[0], /source_event.event_type='hotspot.automatic.scheduled'/);
    assert.doesNotMatch(pick[0], /organization_id|workspace_id|JOIN organizations|JOIN workspaces/);
    assert.deepEqual(pick[1], [now, 2]);
    assert.match(f.statements.find(([sql])=>sql.startsWith("SELECT primary_account_id"))[0], /FOR UPDATE$/);
    const [, task] = f.statements.find(([sql]) => sql.startsWith("INSERT INTO collection_tasks"));
    assert.deepEqual(task.slice(0, 3), [r.taskId, scope.organization_id, scope.workspace_id]);
    const [, [ledger]] = f.statements.find(([sql]) => sql.startsWith("INSERT INTO account_owned_records"));
    assert.deepEqual(ledger.map(([table]) => table).sort(),
      ["collection_subqueries", "collection_task_events", "collection_task_outbox", "collection_tasks"]);
    assert.ok(ledger.every(([, , account, why]) => account === f.owner && why === reason));
    const [, cursor] = f.statements.find(([sql]) => sql.startsWith("UPDATE automatic_source_schedules"));
    assert.deepEqual(cursor, [r.taskId, 0, now, new Date(+now + 15 * 60_000), now, "old-schedule"]);
    assert.deepEqual(f.steps, ["begin", "commit", "release"]);
  });
}

test("full-source account budget throttles before any write", async () => {
  const f = fixture({ count: 2 });
  assert.deepEqual(await f.scheduler.processFullOnce(), { status: "backpressure", reason: "tenant_active_task_budget" });
  assert.ok(f.statements.every(([sql]) => !/^(INSERT|UPDATE)/.test(sql)));
  assert.deepEqual(f.steps, ["begin", "commit", "release"]);
});

test("account-only full-source task does not read archived coordinates", async () => {
  const f=fixture({accountOnly:true});
  const result=await f.scheduler.processFullOnce();
  assert.equal(result.status,"scheduled");
  assert.equal(Object.hasOwn(result,"organizationId"),false);
  const writes=f.statements.filter(([sql])=>sql.startsWith("INSERT"));
  assert.deepEqual(writes[0][1].slice(0,2),[result.taskId,f.owner]);
  for(const [sql] of writes)assert.doesNotMatch(sql,/organization_id|workspace_id/);
  assert.deepEqual(writes.at(-1)[1][0].map(row=>row[2]),Array(4).fill(f.owner));
  assert.deepEqual(f.steps,["begin","commit","release"]);
});

test("an incomplete schedule schema fails closed", async () => {
  const f = fixture({ incomplete: true });
  await assert.rejects(f.scheduler.processFullOnce(), /automatic_source_schedule_schema_incomplete/);
  assert.equal(f.statements.length, 1);
  assert.deepEqual(f.steps, ["release"]);
});

test("ownership failure rolls back all task writes and does not advance the schedule", async () => {
  const f = fixture({ brokenLedger: true });
  await assert.rejects(f.scheduler.processFullOnce(), /ledger_write_failed/);
  assert.ok(f.statements.every(([sql]) => !sql.startsWith("UPDATE automatic_source_schedules")));
  assert.deepEqual(f.steps, ["begin", "rollback", "release"]);
});

test("sealed global backlog retains the existing completion reserve before any write", async () => {
  const f = fixture({ backlog: 997 });
  assert.deepEqual(await f.scheduler.processFullOnce(), {status:"backpressure", reason:"queue_backlog_limit"});
  assert.ok(f.statements.every(([sql]) => !/^(INSERT|UPDATE)/.test(sql)));
});

for (const method of ["processRuleOnce","processFullOnce"]) {
  test(`native ${method} waits for a single outstanding task without opening a transaction`, async () => {
    const f=fixture({accountOnly:true,backlog:1});
    assert.deepEqual(await f.scheduler[method](),{status:"backpressure",reason:"queue_backlog_limit"});
    assert.deepEqual(f.steps,["release"]);
    assert.ok(f.statements.every(([sql])=>!/FOR UPDATE|^(INSERT|UPDATE)/.test(sql)));
  });
  test(`native ${method} rechecks for a competing wave after taking the producer lock`, async () => {
    const f=fixture({accountOnly:true,waveArrives:true});
    assert.deepEqual(await f.scheduler[method](),{status:"backpressure",reason:"queue_backlog_limit"});
    assert.deepEqual(f.steps,["begin","commit","release"]);
    assert.equal(f.statements.filter(([sql])=>sql.startsWith("SELECT 1 FROM collection_tasks")).length,2);
    assert.ok(f.statements.every(([sql])=>!/^(INSERT|UPDATE)/.test(sql)));
  });
}
test("a full wave resumes on the next poll only after the previous backlog is gone", async () => {
  const f=fixture({accountOnly:true,backlog:1});
  for(let i=0;i<2;i++) assert.equal((await f.scheduler.processFullOnce()).status,"backpressure");
  assert.ok(f.statements.every(([sql]) => !/^(INSERT|UPDATE)/.test(sql)));
  f.setBacklog(0);
  assert.equal((await f.scheduler.processFullOnce()).status,"scheduled");
  assert.equal(f.statements.filter(([sql])=>sql.startsWith("INSERT INTO collection_tasks")).length,1);
  assert.equal(f.statements.filter(([sql])=>sql.startsWith("UPDATE automatic_source_schedules")).length,1);
});

test("native source task and ledger roll back when the original cursor no longer matches", async () => {
  const f=fixture({accountOnly:true,cursorChanged:true});
  await assert.rejects(f.scheduler.processFullOnce(),/automatic_source_cursor_changed/);
  assert.ok(f.statements.some(([s])=>s.startsWith("INSERT INTO account_owned_records")));
  assert.deepEqual(f.steps,["begin","rollback","release"]);
});

test("shared schedule with a foreign account cannot modify a cursor or create a task", async () => {
  const f=fixture({accountOnly:true,foreignSharedOwner:true});
  await assert.rejects(f.scheduler.processFullOnce(),/automatic_source_owner_mismatch/);
  assert.ok(f.statements.every(([s])=>!/^(INSERT|UPDATE)/.test(s)));
  assert.deepEqual(f.steps,["begin","rollback","release"]);
});
