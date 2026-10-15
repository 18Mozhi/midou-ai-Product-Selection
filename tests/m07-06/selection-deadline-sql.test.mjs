import test from "node:test";
import assert from "node:assert/strict";
import { MySqlSelectionJourneyRepository } from "../../apps/api/dist/mysql-selection-journey-repository.js";

function fixture({ expired = true, terminal = false, failEvent = false, circuit = "closed" } = {}) {
  const calls = [];
  const now = new Date("2026-10-15T16:00:00Z");
  let journeyState = "accepted";
  const connection = {
    async beginTransaction() {
      calls.push("begin");
    },
    async commit() {
      calls.push("commit");
    },
    async rollback() {
      calls.push("rollback");
    },
    release() {
      calls.push("release");
    },
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT j.*"))
        return [
          [
            {
              state: journeyState,
              circuit_state: circuit,
              deadline_at: new Date(now.getTime() + (expired ? -1 : 1)),
              task_status: terminal ? "succeeded_empty" : "scheduled",
              request_id: "original-request",
              trace_id: "original-trace",
            },
          ],
        ];
      assert.equal(
        (sql.match(/\?/g) ?? []).length,
        values.length,
        "SQL bindings must match placeholders",
      );
      if (failEvent && sql.startsWith("INSERT INTO selection_journey_events"))
        throw new Error("event unavailable");
      if (sql.startsWith("UPDATE selection_journeys")) journeyState = "blocked";
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new MySqlSelectionJourneyRepository({ getConnection: async () => connection });
  repository.read = async () => ({ state: "blocked" });
  const input = {
    journeyId: "journey",
    organizationId: "organization",
    workspaceId: "workspace",
    now,
  };
  return { repository, input, calls };
}

test("open source circuit blocks an unexpired journey immediately with its actual reason", async () => {
  const { repository, input, calls } = fixture({ expired: false, circuit: "open" });
  await repository.get(input);
  await repository.get(input);
  assert.equal(
    calls.filter((call) => call.sql?.startsWith("INSERT INTO selection_journey_events")).length,
    1,
  );
  const event = calls.find((call) => call.sql?.startsWith("INSERT INTO selection_journey_events"));
  assert.equal(JSON.parse(event.values[7]).reason, "source_circuit_open");
  assert.equal(JSON.parse(event.values[7]).deadline_ms, 180000);
  assert.ok(
    !calls.some((call) =>
      /UPDATE (?:collection_tasks|provider_runtime_circuits)/.test(call.sql ?? ""),
    ),
  );
});

test("terminal collection result is not overridden by a subsequently open circuit", async () => {
  const { repository, input, calls } = fixture({ expired: false, terminal: true, circuit: "open" });
  await repository.get(input);
  assert.equal(calls.filter((call) => typeof call === "object").length, 1);
});

test("persisted block reason and terminal time survive later task errors and an observe decision", async () => {
  const at = "2026-10-16T01:00:01.000Z";
  const db = {
    query: async (sql) => {
      if (sql.includes("JOIN providers p"))
        return [
          [
            {
              id: "j",
              organization_id: "o",
              workspace_id: "w",
              task_id: "t",
              state: "decided",
              task_status: "retry_scheduled",
              last_error_code: "later_network_error",
              created_at: "2026-10-16T01:00:00Z",
              updated_at: "2026-10-16T01:00:03Z",
              deadline_at: "2026-10-16T01:03:00Z",
              available_result_count: 0,
              blocked_payload: JSON.stringify({ reason: "source_circuit_open", blocked_at: at }),
            },
          ],
        ];
      if (sql.includes("FROM selection_journey_decisions"))
        return [
          [
            {
              action: "observe",
              reason: "观察",
              actor_id: "member",
              created_at: "2026-10-16T01:00:02Z",
            },
          ],
        ];
      return [[]];
    },
  };
  const repository = new MySqlSelectionJourneyRepository(db);
  const result = await repository.read(db, "j", "o", "w", new Date("2026-10-16T01:00:04Z"));
  assert.equal(result.state, "decided");
  assert.equal(result.blocked_reason, "source_circuit_open");
  assert.equal(result.terminal_at, at);
  assert.equal(result.within_deadline, true);
});

test("expired pending journey commits the deadline event and outbox with exact bindings", async () => {
  const { repository, input, calls } = fixture();
  await repository.get(input);
  const writes = calls.filter((call) => typeof call === "object" && !call.sql.startsWith("SELECT"));
  assert.equal(writes.length, 3);
  const event = writes.find((call) => call.sql.startsWith("INSERT INTO selection_journey_events"));
  assert.equal(event.values.length, 9);
  assert.deepEqual(event.values.slice(5, 7), ["original-request", "original-trace"]);
  assert.equal(JSON.parse(event.values[7]).reason, "selection_deadline_exceeded");
  assert.ok(calls.includes("commit"));
  assert.ok(!calls.includes("rollback"));
  assert.equal(calls.at(-1), "release");
});

for (const options of [{ expired: false }, { terminal: true }]) {
  test(`deadline write is skipped for ${options.terminal ? "terminal" : "unexpired"} journey`, async () => {
    const { repository, input, calls } = fixture(options);
    await repository.get(input);
    assert.equal(calls.filter((call) => typeof call === "object").length, 1);
    assert.ok(calls.includes("commit"));
    assert.equal(calls.at(-1), "release");
  });
}

test("deadline event failure rolls back and releases without committing", async () => {
  const { repository, input, calls } = fixture({ failEvent: true });
  await assert.rejects(repository.get(input), /event unavailable/);
  assert.ok(calls.includes("rollback"));
  assert.ok(!calls.includes("commit"));
  assert.equal(calls.at(-1), "release");
});
