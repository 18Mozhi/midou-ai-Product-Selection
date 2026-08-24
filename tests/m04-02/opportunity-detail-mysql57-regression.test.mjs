import test from "node:test";
import assert from "node:assert/strict";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";

test("opportunity lineage trend query is valid under MySQL 5.7 DISTINCT ordering", async () => {
  let trendQuery = "";
  const pool = {
    async query(sql) {
      if (sql.includes("JOIN trend_topics")) {
        trendQuery = sql;
        const selectList = sql.match(/^SELECT DISTINCT (.*?) FROM /)?.[1] ?? "";
        if (sql.includes("ORDER BY s.observed_at") && !selectList.includes("s.observed_at")) {
          const error = new Error(
            "Expression #1 of ORDER BY clause is not in SELECT list; this is incompatible with DISTINCT",
          );
          error.code = "ER_FIELD_IN_ORDER_NOT_SELECT";
          throw error;
        }
      }
      return [[]];
    },
  };

  const repository = new MySqlOpportunityRepository(pool);
  const lineage = await repository.lineage({
    organizationId: "organization-1",
    workspaceId: "workspace-1",
    opportunityId: "opportunity-1",
  });

  assert.match(trendQuery, /SELECT DISTINCT .*s\.observed_at.* ORDER BY s\.observed_at DESC/);
  assert.deepEqual(lineage.nodes, []);
});
