import assert from "node:assert/strict";
import test from "node:test";
import { MySqlProviderSourceVersionRepository } from "../../apps/api/dist/mysql-provider-source-version-repository.js";
import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";

const now = new Date("2026-10-17T00:00:00Z");
const input = {
  providerId: "1688",
  actorId: "admin",
  expectedVersion: 3,
  targetVersion: 1,
  route: "/provider/configuration",
  idempotencyKey: "operation",
  requestId: "request",
  traceId: "trace",
  scheduleMinutes: 30,
  timeoutMs: 45000,
  retryLimit: 3,
  status: "enabled",
  reason: "LAN image service",
  now,
};
function fixture(configured, targetStatus = "enabled") {
  const calls = [];
  let commits = 0,
    rollbacks = 0;
  const current = {
    id: "1688",
    code: "1688_search",
    access_mode: "authenticated_browser",
    status: "disabled",
    version: 3,
  };
  const connection = {
    beginTransaction: async () => {},
    release() {},
    commit: async () => {
      commits++;
    },
    rollback: async () => {
      rollbacks++;
    },
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("FROM provider_source_operations")) return [[]];
      if (sql.startsWith("SELECT * FROM providers")) return [[current]];
      if (sql.startsWith("SELECT snapshot_json"))
        return [
          [
            {
              snapshot_json: {
                status: targetStatus,
                schedule_minutes: 30,
                timeout_ms: 45000,
                retry_limit: 3,
              },
            },
          ],
        ];
      if (sql.startsWith("SELECT")) throw new Error(`Unexpected browser or other read: ${sql}`);
      return [{ affectedRows: 1 }];
    },
  };
  return {
    repository: new MySqlProviderSourceVersionRepository(
      { getConnection: async () => connection },
      configured,
    ),
    calls,
    counts: () => ({ commits, rollbacks }),
  };
}
for (const method of ["updateConfiguration", "rollbackConfiguration"]) {
  test(`${method} enables LAN sourcing without claiming browser acceptance`, async () => {
    const f = fixture(true);
    const result = await f.repository[method](input);
    assert.equal(result.status, "enabled");
    assert.equal(result.version, 4);
    assert.equal(
      f.calls.some(({ sql }) =>
        /crawler_profiles|crawler_browser_runs|provider_parser_samples/.test(sql),
      ),
      false,
    );
    assert.equal(f.calls.filter(({ sql }) => sql.startsWith("UPDATE providers")).length, 1);
    assert.equal(
      f.calls.filter(({ sql }) => sql.startsWith("INSERT INTO platform_audit_events")).length,
      1,
    );
    assert.deepEqual(f.counts(), { commits: 1, rollbacks: 0 });
  });
  test(`${method} fails closed when server LAN authorization is not configured`, async () => {
    const f = fixture(false);
    await assert.rejects(
      f.repository[method](input),
      (error) =>
        error.code === "provider_source_setup_required" && /LAN_1688_TOKEN/.test(error.actionHint),
    );
    assert.equal(
      f.calls.some(({ sql }) => sql.startsWith("UPDATE providers")),
      false,
    );
    assert.deepEqual(f.counts(), { commits: 0, rollbacks: 1 });
  });
  test(`${method} can disable sourcing without LAN credentials`, async () => {
    const f = fixture(false, "disabled");
    const result = await f.repository[method]({ ...input, status: "disabled" });
    assert.equal(result.status, "disabled");
    assert.deepEqual(f.counts(), { commits: 1, rollbacks: 0 });
  });
}

test("normal LAN sourcing without a primary image cannot fall back to a browser", async () => {
  let browserCalls = 0,
    lanCalls = 0;
  const query = async (sql) =>
    sql.includes("FROM providers p")
      ? [
          [
            {
              id: "1688",
              code: "1688_search",
              status: "enabled",
              access_mode: "authenticated_browser",
              target_url: "https://s.1688.com/selloffer/offer_search.htm",
              fields_json: ["title"],
              timeout_ms: 45000,
              parser_version: "old-browser",
              runtime_circuit_state: "closed",
              circuit_failure_threshold: 5,
            },
          ],
        ]
      : sql.startsWith("SELECT")
        ? [[]]
        : [{ affectedRows: 1 }];
  const pool = {
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    }),
  };
  const executor = new ProviderSourceExecutor(
    pool,
    {},
    {},
    "worker",
    {
      collect: async () => {
        browserCalls++;
      },
    },
    undefined,
    {
      collect: async () => {
        lanCalls++;
      },
    },
  );
  await assert.rejects(
    executor.execute(
      {
        id: "task",
        organizationId: "org",
        workspaceId: "workspace",
        requestId: "request",
        traceId: "trace",
        subqueries: [
          { id: "query", providerId: "1688", required: true, target: { query: "kitchen rack" } },
        ],
      },
      async () => {},
    ),
    (error) => error.code === "parse_failed",
  );
  assert.equal(browserCalls, 0);
  assert.equal(lanCalls, 0);
});
