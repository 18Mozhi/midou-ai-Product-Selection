import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { SelectionJourneyService } from "../../apps/api/dist/selection-journey-service.js";
import { MySqlSelectionJourneyRepository } from "../../apps/api/dist/mysql-selection-journey-repository.js";

for (const native of [false,true]) test(`account journey history retains original references: native=${native}`, async () => {
  const id = "00000000-0000-4000-8000-000000000097";
  const date = new Date("2026-10-15T00:00:00Z");
  let reads = 0;
  let invalidSchema = false;
  const pool = {
    async query(sql, args) {
      assert.match(sql, /^SELECT/);
      reads++;
      if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
      if (sql.includes("information_schema.COLUMNS")) {
        return [["collection_tasks","opportunities","raw_evidence"].flatMap(table_name =>
          (invalidSchema ? ["account_id","workspace_id"] :
            native ? ["account_id"] : ["organization_id","workspace_id"]).map(column_name => ({table_name,column_name})))];
      }
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      for(const alias of ["t","o","e"])
        assert.equal(sql.includes(`${alias}.account_id=jo.account_id`),native);
      for (const table of [
        "selection_journeys",
        "collection_tasks",
        "selection_journey_decisions",
        "raw_evidence",
        "opportunities",
      ])
        assert.ok(sql.includes(`a.source_table='${table}'`));
      assert.match(sql, /a\.account_id=c\.primary_account_id/);
      assert.equal(args[0], id);
      return [
        args[1] === "owner"
          ? [
              {
                id,
                task_id: "original-task",
                opportunity_id: "original-selection",
                decision_id: "original-decision",
                actor_id: "original-actor",
                selected_raw_evidence_id: "original-evidence",
                decision_at: date,
                created_at: date,
              },
            ]
          : [],
      ];
    },
  };
  const app = buildApp({
    selectionJourneys: {
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: "http://127.0.0.1",
      service: new SelectionJourneyService(new MySqlSelectionJourneyRepository(pool), 180000),
      auth: {
        async authenticate(id) {
          return { user: { id, email_verified_at: id === "unverified" ? null : date } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope lookup");
        },
      },
    },
  });
  const url = `/api/v1/selection-journeys/${id}`;
  const get = (actor) => app.inject({ url, headers: { cookie: `scoutops_session=${actor}` } });
  try {
    assert.equal((await get("unverified")).statusCode, 403);
    assert.equal(reads, 0);
    assert.equal((await get("foreign")).statusCode, 404);
    const result = await get("owner");
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.headers["cache-control"], "private, no-store");
    const { data } = result.json();
    assert.equal(data.read_only, true);
    assert.equal(data.task_id, "original-task");
    assert.equal(data.opportunity_id, "original-selection");
    assert.equal(data.decision.actor_id, "original-actor");
    assert.equal(data.decision.selected_raw_evidence_id, "original-evidence");
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/v1/selection-journeys" })).statusCode,
      404,
    );
    assert.equal((await app.inject({ method: "POST", url: `${url}/decisions` })).statusCode, 404);
    assert.equal(reads, 6);
    invalidSchema = true;
    const invalid = await get("owner");
    assert.equal(invalid.statusCode, 503);
    assert.equal(invalid.json().error.code, "selection_journey_account_schema_invalid");
    assert.equal(reads, 8);
  } finally {
    await app.close();
  }
});
