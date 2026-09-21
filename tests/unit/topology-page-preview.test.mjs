import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import { previewTopologyPage } from "../../scripts/lib/topology-page-preview.mjs";
import { topologyReviewFixtures } from "../../scripts/lib/topology-review-fixtures.mjs";
const source = readFileSync("apps/web/src/components/RuntimeTopologyCenter.vue", "utf8").replaceAll(
  "\r\n",
  "\n",
);
const preview = previewTopologyPage(source),
  template = parse(preview).descriptor.template.content;
test("P66 C keeps all production script, request, queue filtering and lifecycle unchanged", () => {
  assert.equal(
    parse(preview).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
});
test("P66 actual C Vue template compiles without new runtime imports", () => {
  assert.deepEqual(
    compileTemplate({ source: template, filename: "RuntimeTopologyCenter.vue", id: "p66" }).errors,
    [],
  );
});
test("P66 four named evidence workspaces replace metrics cards and nested topology pile", () => {
  assert.equal((template.match(/<h1>/g) ?? []).length, 1);
  for (const id of ["nodes", "health", "queues", "alerts"]) {
    assert.equal(template.split(`id="p66-${id}"`).length, 2);
    assert.equal(template.split(`href="#p66-${id}"`).length, 2);
  }
  assert.doesNotMatch(template, /class="topology-metrics"|class="topology-layout"|实时拓扑/);
  assert.equal((template.match(/class="topology-panel topology-alerts"/g) ?? []).length, 1);
  assert.equal((template.match(/class="topology-panel topology-blockers"/g) ?? []).length, 1);
  assert.match(template, /不是本次网络连通性实测/);
});
test("P66 restart records retain actual time, cumulative, delta and reset without an index-spaced chart", () => {
  assert.doesNotMatch(template, /<svg|restartPoints\(/);
  for (const field of ["observed_at", "restart_count", "restart_delta", "counter_reset", "status"])
    assert.ok(template.includes(`row.${field}`));
  assert.match(template, /不代表无人查看时持续采样/);
  assert.match(template, /node\.build_sha \|\| '未记录'/);
});
test("P66 no samples are not presented as measured zero availability, running is not called idle", () => {
  assert.match(template, /v-if="endpoint.sample_count > 0"/);
  assert.match(template, /无样本，暂不提供实测可用率/);
  assert.match(template, /当前执行中，不处于等待队列/);
  assert.match(template, /class="p66-queue-code">{{ queue.name }}/);
});
test("P66 original business association target and disclosures remain, with no execution controls", () => {
  assert.match(template, /RouterLink v-if="object.href" :to="object.href"/);
  assert.match(template, /:aria-expanded="showAllQueues"/);
  assert.match(template, /v-if="process.last_failure"/);
  assert.match(template, /v-if="data.worker_scheduler.snapshot_publish_failed_total"/);
  assert.doesNotMatch(template, /<dialog|role="dialog"|@click="(?:restart|deploy|rollback)/);
});
test("P66 fixtures preserve original partial data and load current registered policies", async () => {
  const { fixture, policies } = await topologyReviewFixtures();
  assert.equal(fixture.state, "ready");
  assert.equal(fixture.nodes[0].build_sha.length, 40);
  assert.equal(fixture.worker_scheduler.queues.length, 2);
  assert.equal(fixture.worker_scheduler.due_queue_count, 2);
  assert.equal(fixture.worker_scheduler.queues.filter((q) => q.due).length, 1);
  assert.equal(fixture.restart_trend.length, 3);
  assert.ok(Object.keys(policies).length > 18);
  assert.ok("automatic_selection_evaluation" in policies);
});
