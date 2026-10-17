import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

test("market intelligence uses actual Vue and preserves evidence and workflow bindings", async () => {
  const source = await readFile("apps/web/src/components/TrendDashboard.vue", "utf8");
  const parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "market-intelligence" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: "TrendDashboard.vue",
      id: "market-intelligence",
    }).errors,
    [],
  );
  for (const contract of [
    "/trends/monitoring-rules",
    "/trends/change-requests",
    "/trends/${currentId}",
    "TrendDetailPanel",
    "TrendChangeQueue",
    "refreshHotspots",
    "trend-collection-status",
    "新建监控",
  ])
    assert.ok(source.includes(contract), contract);
  assert.ok(source.includes("记录已读取"));
  assert.doesNotMatch(
    source,
    /:status="trendReadiness.summary.status"|:title="trendReadiness.summary.title"/,
  );
  const cli = await readFile("scripts/verify-trend-page-preview.mjs", "utf8");
  assert.match(cli, /tests\/e2e\/m04-01-trends.spec.ts/);
  assert.doesNotMatch(cli, /transform\(|trendPagePlugin|previewTrendDashboard|createServer/);
});

test("historical trend proposal refuses the retired manual opportunity entry", async () => {
  const { buildTrendDesignData } =
    await import("../../scripts/lib/ui-phase2-trend-design-data.mjs");
  await assert.rejects(buildTrendDesignData(process.cwd()), /manual_opportunity_creation_retired/);
  const detail = await readFile("apps/web/src/components/TrendDetailPanel.vue", "utf8");
  assert.doesNotMatch(detail, /opportunityRoute|转为机会/);
});
