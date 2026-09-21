import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import { previewRedisPage } from "../../scripts/lib/redis-page-preview.mjs";
import { buildRedisDesignData } from "../../scripts/lib/ui-phase2-redis-design-data.mjs";
const source = readFileSync("apps/web/src/components/RedisResilienceCenter.vue", "utf8").replaceAll(
  "\r\n",
  "\n",
);
const preview = previewRedisPage(source),
  template = parse(preview).descriptor.template.content;
test("P67 C preserves production script, GET, timeout, thresholds and lifecycle", () => {
  assert.equal(
    parse(preview).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
});
test("P67 C Vue template compiles", () => {
  assert.deepEqual(
    compileTemplate({ source: template, filename: "RedisResilienceCenter.vue", id: "p67" }).errors,
    [],
  );
});
test("P67 replaces old metrics and persistence cards with named observed/target/sample workspaces", () => {
  for (const id of ["conclusion", "findings", "resources", "persistence", "policy", "sampling"])
    assert.equal(template.split(`id="p67-${id}-title"`).length, 2);
  assert.equal((template.match(/<h1>/g) ?? []).length, 1);
  assert.doesNotMatch(
    template,
    /redis-resilience__metrics|redis-resilience__persistence-grid|<svg/,
  );
});
test("P67 preserves native read controls and three disclosures without execution actions", () => {
  // Three rendered regions; the initial-state region selects empty-response or failure trace.
  assert.equal((template.match(/<TechnicalDetails /g) ?? []).length, 4);
  assert.equal((template.match(/@click="load"/g) ?? []).length, 3);
  assert.match(template, /to="\/login"/);
  assert.doesNotMatch(template, /<dialog|v-model|@click="(?:clear|restore|restart|save)/);
});
test("P67 unavailable placeholders, local threshold and unmeasured targets are explicit", () => {
  assert.match(template, /item.code === 'redis_unavailable'/);
  assert.match(template, /不是容量承诺/);
  assert.match(template, /当前探针没有读取 appendfsync/);
  assert.match(template, /内存阈值为 80%/);
  assert.match(template, /服务比例已封顶为 100%/);
});
test("P67 sampling distinguishes partial failure, zero denominator and independent verdict", () => {
  assert.match(template, /status === 'partial'/);
  assert.match(template, /不能据此判断没有业务键/);
  assert.match(template, /无比例分母/);
  assert.match(template, /v-if="data.keyspace_sample.total_sampled_bytes > 0" class="p67-bar"/);
});
test("P67 review datasets run actual inert probe/evaluator/service and preserve original E2E", async () => {
  const { data } = await buildRedisDesignData(process.cwd());
  assert.equal(Object.keys(data.datasets).length, 37);
  assert.equal(data.datasets.original.memory.used_bytes, 134217728);
  assert.equal(data.datasets.original.keyspace_sample.hotspots.length, 2);
  assert.equal(data.datasets.ready.keyspace_sample.hotspots.length, 12);
  assert.equal(data.datasets["sample-all-failed"].keyspace_sample.status, "partial");
  assert.equal(data.datasets["sample-all-failed"].keyspace_sample.hotspots.length, 0);
  assert.equal(data.datasets["sample-zero"].keyspace_sample.status, "sampled");
  assert.equal(data.datasets["sample-zero"].keyspace_sample.total_sampled_bytes, 0);
  assert.equal(data.datasets["probe-failed"].memory.usage_basis_points, 10000);
  assert.ok(data.datasets["probe-failed"].findings.some((f) => f.code === "redis_unavailable"));
});
