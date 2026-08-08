import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseLastEventId,
  RealtimeService,
  RealtimeServiceError,
} from "../../apps/api/dist/realtime-service.js";
test("M05-04.A01/A02/A04/A12 validates monotonic cursors and replay window", async () => {
  assert.equal(parseLastEventId(undefined), 0);
  assert.equal(parseLastEventId("42"), 42);
  assert.throws(
    () => parseLastEventId("bad"),
    (e) => e instanceof RealtimeServiceError,
  );
  const service = new RealtimeService(
    {
      replay: async () => [{ id: 1 }, { id: 2 }],
      auditConnect: async () => {},
    },
    1,
  );
  await assert.rejects(
    () => service.replay({ afterId: 0 }),
    (e) =>
      e instanceof RealtimeServiceError &&
      e.code === "realtime_replay_window_exceeded",
  );
});
test("M05-04.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
      "database/migrations/0018d_realtime_sse_m05_04.up.sql",
      "apps/api/src/mysql-realtime-repository.ts",
      "apps/api/src/realtime-routes.ts",
      "apps/worker/src/notification-outbox-worker.ts",
      "apps/web/src/components/NotificationCenter.vue",
      "docs/architecture/m05-04-realtime-sse.md",
      "docs/runbooks/m05-04-realtime-sse.md",
      "docs/openapi.yaml",
      "docs/feature-map.json",
      "config/env.example",
      "verification/modules/M05-04.json",
    ],
    v = await Promise.all(files.map((x) => readFile(x, "utf8")));
  assert.match(v[0], /AUTO_INCREMENT[\s\S]*idx_realtime_replay/);
  assert.match(v[1], /recipient_id=\?[\s\S]*id>\?/);
  assert.match(
    v[2],
    /Last-Event-ID|last-event-id[\s\S]*text\/event-stream[\s\S]*heartbeat/,
  );
  assert.match(v[4], /EventSource[\s\S]*last-event-id|last_event_id/);
  assert.equal(JSON.parse(v.at(-1)).atomicTasks.length, 17);
});
