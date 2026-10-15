import test from "node:test";
import assert from "node:assert/strict";
import { MySqlSelectionJourneyRepository } from "../../apps/api/dist/mysql-selection-journey-repository.js";

function fixture({ expired = true, terminal = false, failEvent = false } = {}) {
  const calls = [];
  const now = new Date("2026-10-15T16:00:00Z");
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
              state: "accepted",
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
