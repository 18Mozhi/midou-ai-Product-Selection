import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";

const at = new Date("2026-08-23T02:00:00.000Z");
const rows = {
  source: [
    {
      source_id: "source-1",
      source_name: "Google 新闻",
      source_status: "enabled",
      source_error_code: null,
      source_checked_at: at,
      evidence_id: "evidence-1",
      evidence_status: "active",
      captured_at: at,
      request_id: "request-source",
      trace_id: "trace-business",
      collection_task_id: "collection-1",
      collection_status: "completed_with_warnings",
      task_created_at: at,
      task_request_id: "request-collection",
      task_trace_id: "trace-business",
    },
  ],
  attempt: [
    {
      id: "attempt-1",
      task_id: "collection-1",
      status: "failed_terminal",
      error_code: "parser_failed",
      created_at: at,
      request_id: "request-attempt",
      trace_id: "trace-business",
    },
  ],
  quality: [
    {
      id: "quality-1",
      metric_code: "source_freshness",
      severity: "critical",
      status: "open",
      updated_at: at,
      request_id: "request-quality",
      trace_id: "trace-business",
    },
  ],
  trend: [
    {
      id: "trend-1",
      title: "便携净水",
      status: "active",
      source_fresh_at: at,
      request_id: "request-trend",
      trace_id: "trace-business",
    },
  ],
  opportunity: [
    {
      id: "opportunity-1",
      name: "便携净水机会",
      decision_status: "observing",
      updated_at: at,
      request_id: "request-opportunity",
      trace_id: "trace-business",
    },
  ],
  score: [
    {
      id: "score-1",
      status: "calculated",
      scored_at: at,
      request_id: "request-score",
      trace_id: "trace-business",
    },
  ],
  profit: [
    {
      id: "profit-1",
      status: "calculated",
      calculated_at: at,
      request_id: "request-profit",
      trace_id: "trace-business",
    },
  ],
  task: [
    {
      id: "task-1",
      title: "补齐证据",
      status: "todo",
      updated_at: at,
      request_id: "request-task",
      trace_id: "trace-business",
    },
  ],
  notification: [
    {
      id: "notification-1",
      title: "需要重新决策",
      severity: "warning",
      created_at: at,
      request_id: "request-notification",
      trace_id: "trace-business",
    },
  ],
};

test("business lineage joins the persisted source-to-notification chain and exposes factual impact", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT DISTINCT p.id source_id")) return [rows.source];
      if (sql.includes("FROM collection_task_attempts")) return [rows.attempt];
      if (sql.includes("FROM data_quality_issues")) return [rows.quality];
      if (sql.includes("JOIN trend_topics")) return [rows.trend];
      if (sql.includes("LEFT JOIN opportunity_events")) return [rows.opportunity];
      if (sql.includes("FROM opportunity_score_runs")) return [rows.score];
      if (sql.includes("FROM opportunity_profit_runs")) return [rows.profit];
      if (sql.includes("FROM tasks t LEFT JOIN task_events")) return [rows.task];
      if (sql.includes("FROM notifications")) return [rows.notification];
      throw new Error("unexpected query: " + sql);
    },
  };
  const repository = new MySqlOpportunityRepository(pool);
  const lineage = await repository.lineage({
    organizationId: "organization-1",
    workspaceId: "workspace-1",
    opportunityId: "opportunity-1",
  });
  assert.deepEqual(
    lineage.nodes.map((node) => node.kind),
    [
      "source",
      "collection_task",
      "collection_attempt",
      "evidence",
      "quality_issue",
      "trend",
      "opportunity",
      "score",
      "profit",
      "task",
      "notification",
    ],
  );
  assert.equal(lineage.failure_impact.level, "blocked");
  assert.deepEqual(lineage.trace_ids, ["trace-business"]);
  assert.equal(lineage.freshness.observed_at, at.toISOString());
  assert.match(lineage.nodes.find((node) => node.kind === "profit").route, /tab=profit/);
});

test("business lineage UI keeps correlation, freshness and failure impact visible", async () => {
  const [web, feature] = await Promise.all([
    readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    readFile("docs/feature-map.json", "utf8"),
  ]);
  for (const copy of ["业务血缘追踪", "数据新鲜度", "失败影响", "request_id", "trace_id"])
    assert.match(web, new RegExp(copy));
  assert.match(JSON.parse(feature).implementation.opportunityDomain.scope, /lineage|血缘/i);
});
