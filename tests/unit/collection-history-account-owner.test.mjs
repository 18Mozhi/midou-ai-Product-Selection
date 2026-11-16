import test from "node:test";
import assert from "node:assert/strict";
import { MySqlCollectionTaskWorkerRepository } from "../../apps/worker/dist/collection-task-state-machine.js";

const now = new Date("2026-10-15T12:00:00Z");
const task = { id: "task", organization_id: "org", workspace_id: "ws",
  status: "scheduled", request_id: "request", trace_id: "trace" };

for (const mode of ["shared", "unassigned", "exclusive_owner", "no_receipt", "legacy_task",
  "legacy_schema", "missing_ledger", "wrong_shared", "outbox_ledger_failure", "native_foreign", "native_missing_owner"]) {
  test(`queue transition keeps exact task ownership: ${mode}`, async () => {
    const calls = [];
    const connection = {
      beginTransaction: async () => calls.push(["begin"]),
      commit: async () => calls.push(["commit"]),
      rollback: async () => calls.push(["rollback"]),
      release: () => calls.push(["release"]),
      query: async (sql, values = []) => {
        calls.push([sql, values]);
        if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
          return [mode.startsWith("native_")?[{Field:"account_id"}]:[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM competitors") || sql.startsWith("SHOW COLUMNS FROM opportunities"))
          return [[{Field:"account_id"}]];
        if (sql.startsWith("SELECT slot FROM account_ownership_cutover")) {
          if (mode === "legacy_schema")
            throw Object.assign(new Error(mode), { code: "ER_NO_SUCH_TABLE",
              sqlMessage: "Table 'isolate.account_ownership_cutover' doesn't exist" });
          return [mode === "no_receipt" ? [] : [{ slot: "current" }]];
        }
        if (sql.startsWith("SELECT collection_tasks.*") || sql.startsWith("SELECT * FROM collection_tasks"))
          return [[mode.startsWith("native_")?{...task,account_id:"native",queue_account_id:"native"}:task]];
        if (sql.startsWith("SELECT cut.primary_account_id")) {
          assert.deepEqual(values, [task.id]);
          assert.match(sql, /source_table='collection_tasks'.*contract_version=25.*LOCK IN SHARE MODE/);
          if (mode === "legacy_schema" || mode === "missing_ledger")
            throw Object.assign(new Error(mode), { code: "ER_NO_SUCH_TABLE",
              sqlMessage: `Table 'isolate.${mode === "legacy_schema" ? "account_ownership_cutover" : "account_owned_records"}' doesn't exist` });
          if (mode === "no_receipt") return [[]];
          const owner = mode === "legacy_task" || mode === "native_missing_owner" ? null :
            mode === "exclusive_owner" || mode === "wrong_shared" ? "exclusive" : "primary";
          return [[{ primary_account_id: "primary", account_id: owner,
            reason: ["wrong_shared", "outbox_ledger_failure", "native_foreign"].includes(mode) ? "shared" : mode }]];
        }
        if (sql.startsWith("INSERT INTO account_owned_records") &&
          mode === "outbox_ledger_failure" && values[0] === "collection_task_outbox")
          throw new Error("fixture_outbox_owner_failure");
        if (/^(UPDATE|INSERT)/.test(sql)) return [{ affectedRows: 1 }];
        throw new Error("Unexpected query: " + sql);
      },
    };
    const repository = new MySqlCollectionTaskWorkerRepository({ getConnection: async () => connection });
    const result = repository.queueReady(now, "scheduler-not-owner");
    const failure = { missing_ledger: "missing_ledger", wrong_shared: "collection_history_owner_mismatch",
      native_foreign: "collection_history_owner_mismatch", native_missing_owner: "collection_history_owner_mismatch",
      outbox_ledger_failure: "fixture_outbox_owner_failure" }[mode];
    if (failure) {
      await assert.rejects(result, { message: failure });
      assert.deepEqual(calls.slice(-2), [["rollback"], ["release"]]);
      assert.equal(calls.some(([sql]) => sql === "commit"), false);
      return;
    }
    assert.equal((await result).id, task.id);
    assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
    const event = calls.find(([sql]) => sql.startsWith("INSERT INTO collection_task_events"))[1];
    const outbox = calls.find(([sql]) => sql.startsWith("INSERT INTO collection_task_outbox"))[1];
    assert.deepEqual(event.slice(1, 9), [task.id, "collection.task.queued", "scheduled",
      "queued", "system", "scheduler-not-owner", task.request_id, task.trace_id]);
    assert.deepEqual(outbox.slice(1, 3), [task.id, "collection.task.queued"]);
    const owners = calls.filter(([sql]) => sql.startsWith("INSERT INTO account_owned_records"));
    const account = mode === "exclusive_owner" ? "exclusive" : "primary";
    assert.deepEqual(owners.map(([, values]) => values), ["shared", "unassigned", "exclusive_owner"].includes(mode)
      ? [["collection_task_events", event[0], account, mode],
         ["collection_task_outbox", outbox[0], account, mode]] : []);
  });
}

test("a stale native lease cannot start, heartbeat, or finalize an account task", async () => {
  const calls=[];
  const c={query:async(sql,values)=>{
    calls.push([sql,values]);
    assert.match(sql,/account_id=\? AND attempt_count=\? AND lease_expires_at>UTC_TIMESTAMP\(3\)/);
    assert.deepEqual(values.slice(-2),["native",2]);
    return [sql.startsWith("SELECT")?[]:{affectedRows:0}];
  }};
  const repository=new MySqlCollectionTaskWorkerRepository(c);
  const claimed={...task,accountId:"native",nativeAccountScope:true,leaseToken:"private-token",attemptCount:2};
  for(const action of [()=>repository.start(claimed,now),()=>repository.heartbeat(claimed,now,60),()=>repository.lock(c,claimed)])
    await assert.rejects(action,{message:"collection_task_lease_invalid"});
  assert.equal(calls.length,3);
  assert.ok(calls.every(([,values])=>!values.includes(claimed.leaseToken)));
});
