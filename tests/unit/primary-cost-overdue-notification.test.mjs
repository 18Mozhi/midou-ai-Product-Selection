import assert from "node:assert/strict";
import test from "node:test";
import { NotificationOutboxWorker } from "../../apps/worker/dist/notification-outbox-worker.js";

function fixture({ primaryVisible = true, direct = "reviewer", pending = true,
  scopeColumns = ["organization_id", "workspace_id"], realtimeColumns = scopeColumns,
  account = false, validLineage = true, eventType = "approval.cost_input.overdue",
  nativeOwner = false, coordinateFree = false, leaseLost = false, outboxOwned = true } = {}) {
  const recipients = [];
  const deliveries = [];
  const realtime = [];
  let lookups = 0;
  const event = {
    id: "event",
    ...(coordinateFree ? {} : { organization_id: "org", workspace_id: "workspace" }),
    version: 7, schema_version: 1,
    event_type: eventType,
    request_id: "request", trace_id: "trace",
    payload_json: { review_id: "review", recipient_id: direct,
      resource_type: "opportunity", resource_id: "opportunity", opportunity_id: "opportunity" },
  };
  const pool = {
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async query(sql, args) {
          if (sql.startsWith("SELECT * FROM outbox_events")) {
            if (sql.includes("WHERE id=?")) {
              assert.equal(args[1], 8);
              return [leaseLost ? [] : [event]];
            }
            return [[event]];
          }
          if (sql.startsWith("UPDATE outbox_events SET status='leased'")) return [{ affectedRows:1 }];
          return view(sql,args);
        },
      };
    },
    async query(sql, args) {
      if (sql.startsWith("UPDATE outbox_events SET status=IF")) {
        assert.match(sql,/AND status='leased' AND version=\?$/);
        assert.equal(args.at(-1),8);
        return [{ affectedRows:1 }];
      }
      assert.fail("cost reminder used a query outside its delivery transaction: " + sql);
    },
  };
  async function view(sql,args) {
      if (sql.startsWith("SELECT primary_account_id,contract_version")) {
        assert.match(sql,/LOCK IN SHARE MODE$/);
        return [account ? [{ primary_account_id: "primary", contract_version: 25 }] : []];
      }
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [(nativeOwner ? ["account_id"] : ["organization_id","workspace_id"]).map(Field=>({Field}))];
      if (sql.startsWith("SHOW COLUMNS FROM notification_preferences"))
        return [[{Field:"historical_context"},{Field:"user_id"}]];
      if (sql.startsWith("SELECT r.reviewer_id,CASE")) {
        assert.equal(account, true);
        assert.deepEqual(args, ["2313645627@qq.com", "primary", "review", "opportunity", "request", "trace",...(coordinateFree?["event"]:[])]);
        assert.doesNotMatch(sql, /memberships|organization_id|workspace_id/);
        assert.match(sql, /po.account_id=u.id AND u.status='active'/);
        assert.match(sql, /u.email_verified_at IS NOT NULL/);
        assert.match(sql, /ro.account_id=po.account_id/);
        assert.match(sql, /io.account_id=po.account_id/);
        assert.match(sql, /r.status='pending'/);
        assert.match(sql, /BINARY LEFT\(r.trace_id,64\)=BINARY \?/);
        assert.match(sql,/po.account_id=cut.primary_account_id/);
        assert.equal(sql.includes("p.account_id=po.account_id"),nativeOwner);
        assert.equal(sql.includes("eo.source_table='outbox_events'"),coordinateFree);
        assert.match(sql,/LOCK IN SHARE MODE$/);
        return [validLineage && pending && (!coordinateFree||outboxOwned) ? [{ reviewer_id: "reviewer", primary_recipient: primaryVisible ? "primary" : null }] : []];
      }
      if (sql.startsWith("SHOW COLUMNS FROM notification_deliveries"))
        return [scopeColumns.map((Field) => ({ Field }))];
      if (sql.startsWith("SHOW COLUMNS FROM realtime_events"))
        return [realtimeColumns.map((Field) => ({ Field }))];
      if (sql.includes("FROM opportunity_cost_input_reviews")) {
        assert.equal(account, false, "account escalation must not query legacy coordinates");
        assert.deepEqual(args, ["review", "org", "workspace"]);
        assert.match(sql, /JOIN opportunities o ON o.id=r.opportunity_id/);
        assert.match(sql, /i.id=r.cost_input_id AND i.opportunity_id=o.id/);
        assert.match(sql, /r.id=\? AND o.organization_id=\? AND o.workspace_id=\?/);
        return [[{ status: pending ? "pending" : "approved" }]];
      }
      if (sql.includes("FROM users u JOIN memberships")) {
        lookups++;
        assert.deepEqual(args, ["workspace", "org", "2313645627@qq.com"]);
        assert.match(sql, /u.email_verified_at IS NOT NULL AND u.status='active'/);
        assert.match(sql, /w.status='active'/);
        assert.match(sql, /o.status='active'/);
        assert.match(sql, /m.status='active'/);
        assert.match(sql, /s.workspace_id=w.id/);
        assert.match(sql, /notification:read/);
        assert.doesNotMatch(sql, /organization_admin/);
        return [primaryVisible ? [{ user_id: "primary" }] : []];
      }
      if (sql.includes("FROM notifications WHERE")) return [[{ id: "notification" }]];
      if (sql.startsWith("INSERT IGNORE INTO notifications ")) {
        assert.deepEqual(args.slice(1, 3), coordinateFree?[undefined,undefined]:["org", "workspace"]);
        recipients.push(args[3]);
      }
      if (sql.startsWith("INSERT IGNORE INTO notification_deliveries"))
        deliveries.push({ sql, args });
      if (sql.startsWith("INSERT IGNORE INTO realtime_events")) realtime.push({ sql, args });
      if (/^(INSERT IGNORE|UPDATE outbox_events|SELECT \* FROM notification_preferences)/.test(sql))
        return [[]];
      throw new Error(`unexpected query: ${sql}`);
  }
  return {
    recipients,
    deliveries,
    realtime,
    get lookups() {
      return lookups;
    },
    worker: new NotificationOutboxWorker(pool, 30, 3),
  };
}

test("overdue escalation reaches the reviewer and scoped verified primary account exactly once", async () => {
  for (const [options, recipients, lookups] of [
    [{}, ["reviewer", "primary"], 1],
    [{ primaryVisible: false }, ["reviewer"], 1],
    [{ direct: "primary" }, ["primary"], 1],
    [{ pending: false }, [], 0],
  ]) {
    const f = fixture(options);
    const result = await f.worker.processOnce();
    assert.deepEqual(result, {
      status: "published",
      event_id: "event",
      notifications: recipients.length,
    });
    assert.deepEqual(f.recipients, recipients);
    assert.equal(f.lookups, lookups);
  }
});

test("coordinate-free reminders require a matching owned outbox; an expired lease cannot deliver", async () => {
  for (const [options,status,expected] of [
    [{},"published",["reviewer","primary"]],
    [{outboxOwned:false},"published",[]],
    [{account:false},"published",[]],
    [{validLineage:false},"published",[]],
    [{leaseLost:true},"lease_lost",[]],
  ]) {
    const f=fixture({account:true,nativeOwner:true,coordinateFree:true,...options});
    assert.equal((await f.worker.processOnce()).status,status);
    assert.deepEqual(f.recipients,expected);
  }
});

test("sealed account escalation preserves the named reviewer without relying on legacy membership", async () => {
  for (const [options, expected] of [
    [{}, ["reviewer", "primary"]],
    [{ primaryVisible: false }, ["reviewer"]],
    [{ validLineage: false }, []],
  ]) {
    const f = fixture({ account: true, direct: "untrusted-recipient", ...options });
    const result = await f.worker.processOnce();
    assert.equal(result.status, "published");
    assert.deepEqual(f.recipients, expected);
    assert.equal(f.lookups, 0);
  }
});

test("sealed due-soon reminder validates account lineage and notifies only the persisted reviewer", async () => {
  for (const [options, expected] of [[{}, ["reviewer"]], [{ validLineage: false }, []], [{ pending: false }, []]]) {
    const f = fixture({ account: true, direct: "untrusted-recipient", ...options,
      eventType: "approval.cost_input.review_due_soon" });
    assert.equal((await f.worker.processOnce()).status, "published");
    assert.deepEqual(f.recipients, expected);
    assert.equal(f.lookups, 0);
  }
});

test("legacy due-soon reminder still reaches only the named reviewer for a pending review", async () => {
  for (const pending of [true, false]) {
    const f = fixture({ pending, eventType: "approval.cost_input.review_due_soon" });
    assert.equal((await f.worker.processOnce()).status, "published");
    assert.deepEqual(f.recipients, pending ? ["reviewer"] : []);
    assert.equal(f.lookups, 0);
  }
});

test("normalized approval deliveries retain recipient, channel and status without duplicate scope", async () => {
  const f = fixture({ scopeColumns: [], primaryVisible: false });
  assert.equal((await f.worker.processOnce()).status, "published");
  assert.equal(f.deliveries.length, 2);
  for (const { sql, args } of f.deliveries) {
    assert.doesNotMatch(sql, /organization_id|workspace_id/);
    assert.deepEqual(args.slice(1, 3), ["notification", "reviewer"]);
  }
  assert.match(f.deliveries[0].sql, /'in_app'/);
  assert.equal(f.deliveries[0].args[3], "delivered");
  assert.match(f.deliveries[1].sql, /'email'/);
  assert.equal(f.deliveries[1].args[3], "suppressed");
  assert.equal(f.realtime.length, 1);
  assert.doesNotMatch(f.realtime[0].sql, /organization_id|workspace_id/);
  assert.deepEqual(f.realtime[0].args.slice(0, 2), ["reviewer", "notification"]);
});

test("partial delivery schema does not create a notification or delivery", async () => {
  const f = fixture({ scopeColumns: ["organization_id"] });
  assert.notEqual((await f.worker.processOnce()).status, "published");
  assert.deepEqual(f.recipients, []);
  assert.deepEqual(f.deliveries, []);
});
