import assert from "node:assert/strict";
import test from "node:test";
import { NotificationOutboxWorker } from "../../apps/worker/dist/notification-outbox-worker.js";

test("0194 alerts publish only to the exact owner within the live lease transaction", async () => {
  for (const valid of [false, true]) {
    const writes = [], now = new Date("2026-10-15T12:00:00Z");
    const event = {id:"alert",event_type:"competitor.threshold.triggered",schema_version:1,version:3,
      payload_json:{competitor_account_contract:25, resource_type:"competitor",resource_id:"competitor",
        competitor_id:"competitor",task_id:"task",change_id:"change",rule_id:"rule",evidence_id:"raw",recipient_id:"owner"}};
    const connection = {
      async beginTransaction() {}, async commit() {}, async rollback() { assert.fail("unexpected rollback"); }, release() {},
      async query(sql,args) {
        if (sql.startsWith("SELECT *") && !sql.includes("WHERE id=?")) return [[event]];
        if (sql.startsWith("SELECT *")) {
          assert.deepEqual(args,["alert",4,now]); return [[event]];
        }
        if (sql.startsWith("SELECT c.account_id")) {
          assert.match(sql,/t.account_id=c.account_id AND t.source_type='selection_verification'/);
          assert.match(sql,/s.evidence_id=ch.evidence_id/);
          assert.match(sql,/oo.source_table='outbox_events' AND oo.source_id=a.id/);
          assert.deepEqual(args,["task","alert","competitor","change","rule","raw","owner"]);
          return [valid ? [{account_id:"owner"}] : []];
        }
        assert.match(sql,/^UPDATE (competitor_alerts|outbox_events)/);
        if (sql.startsWith("UPDATE competitor_alerts")) {
          assert.deepEqual(args, ["delivered",now,"alert","competitor"]);
          writes.push("alert");
        }
        return [{}];
      },
    };
    const worker = new NotificationOutboxWorker({getConnection:async()=>connection},30,3,()=>now);
    worker.create = async (_event,_payload,category,recipient,_now,db) => {
      assert.equal(db,connection); assert.equal(category,"competitor"); assert.equal(recipient,"owner");
      writes.push("notification"); return true;
    };
    assert.deepEqual(await worker.processOnce(),{status:"published",event_id:"alert",notifications:Number(valid)});
    assert.deepEqual(writes,valid ? ["notification","alert"] : []);
  }
});
