import assert from "node:assert/strict";
import test from "node:test";
import { MySqlRuntimeTopologyRepository } from "../../apps/api/dist/mysql-runtime-topology-repository.js";

for (const retired of [false, true]) {
  test(`topology heartbeat and audit use the verified ${retired ? "retired" : "legacy"} schema`, async () => {
    const writes = [];
    let committed = 0;
    const db = {
      beginTransaction: async () => {},
      commit: async () => {
        committed++;
      },
      rollback: async () => assert.fail("must commit"),
      release: () => {},
      query: async (sql, values) => {
        assert.equal((sql.match(/\?/g) ?? []).length, values.length);
        if (sql.startsWith("SELECT id FROM runtime_nodes")) return [[{ id: "node-row" }]];
        if (
          /^INSERT INTO (?:runtime_nodes|runtime_node_heartbeats|platform_audit_events)\(/.test(sql)
        ) {
          assert.equal(sql.includes("organization_id,workspace_id,"), !retired);
          assert.equal(sql.includes("NULL,NULL,"), !retired);
          writes.push(sql);
        }
        return [[]];
      },
    };
    const repo = new MySqlRuntimeTopologyRepository({ getConnection: async () => db }, retired);
    const now = new Date("2026-11-17T01:00:00Z");
    await repo.heartbeat({
      nodeId: "api",
      hostId: "host",
      region: "cn",
      zone: "primary",
      buildSha: "a".repeat(40),
      version: "1",
      status: "ready",
      requestId: "r",
      traceId: "t",
      observedAt: now,
    });
    await repo.recordView({
      actorId: "actor",
      requestId: "r",
      traceId: "t",
      observedAt: now,
      state: "ready",
      activeApiInstances: 1,
      processes: [],
    });
    assert.equal(committed, 2);
    assert.equal(writes.length, 3);
  });
}
