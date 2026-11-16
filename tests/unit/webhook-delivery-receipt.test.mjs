import assert from "node:assert/strict";
import test from "node:test";
import { WebhookDeliveryWorker } from "../../apps/worker/dist/webhook-delivery-worker.js";

const now = new Date("2026-11-16T00:00:00Z");
const row = { id:"original-delivery", endpoint_id:"original-endpoint", attempt_count:2,
  request_id:"original-request", trace_id:"original-trace" };
const options = { workerId:"worker", leaseSeconds:120, timeoutMs:1000, retrySeconds:[60,300,900] };

for (const mode of ["native", "legacy", "stale", "event-write-failed"]) {
  test(`Webhook finishes the exact delivery attempt with an atomic receipt: ${mode}`, async () => {
    const calls=[], transitions=[];
    const c={
      beginTransaction:async()=>transitions.push("begin"), commit:async()=>transitions.push("commit"),
      rollback:async()=>transitions.push("rollback"), release:()=>transitions.push("release"),
      async query(sql,args=[]) {
        calls.push([sql,args]);
        assert.equal((sql.match(/\?/g)??[]).length,args.length);
        if (sql.startsWith("UPDATE webhook_deliveries")) {
          assert.match(sql,/WHERE id=\? AND endpoint_id=\? AND status='leased' AND lease_owner=\? AND attempt_count=\? AND lease_expires_at>\?$/);
          assert.deepEqual(args.slice(-5),[row.id,row.endpoint_id,"worker",row.attempt_count,now]);
          assert.equal(args[1].getTime(),now.getTime()+300_000);
          return [{affectedRows:mode==="stale"?0:1}];
        }
        if (sql.startsWith("SHOW COLUMNS")) return [[{Field:"delivery_id"},...(mode==="legacy"?[{Field:"organization_id"}]:[])]];
        assert.match(sql,/FROM webhook_deliveries d WHERE d.id=\?$/);
        assert.match(sql,/SELECT \?,d.id,d.endpoint_id/);
        assert.equal(sql.includes("organization_id"),mode==="legacy");
        assert.deepEqual(args.slice(1),["leased","retry_scheduled",2,"http_503",null,row.request_id,row.trace_id,now,row.id]);
        if(mode==="event-write-failed") throw Error("fixture_event_write_failed");
        return [{affectedRows:1}];
      },
    };
    const worker=new WebhookDeliveryWorker({getConnection:async()=>c},options,()=>now);
    const finish=worker.finish(row,"retry_scheduled",503,"http_503",null);
    if (mode==="event-write-failed") await assert.rejects(finish,/fixture_event_write_failed/);
    else assert.equal(await finish,mode!=="stale");
    assert.deepEqual(transitions,["begin",mode==="event-write-failed"?"rollback":"commit","release"]);
    assert.equal(calls.length,mode==="stale"?1:3);
  });
}
