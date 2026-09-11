import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { ref, computed } from "vue";
import {
  adapterFeedbackRevision,
  historicalAdapterFeedbackSource,
} from "../../scripts/lib/ui-phase2-adapter-feedback-baseline.mjs";

const file = adapterFeedbackRevision.file;
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const old = historicalAdapterFeedbackSource(file, source);
const row = { id: "source-a", name: "来源A", health_status: "ready" };
class ApiClientError extends Error {
  constructor(hint, id) {
    super(hint);
    this.actionHint = hint;
    this.requestId = id;
  }
}
function harness(text = source) {
  const script = parse(text).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const body = ast.statements
    .filter((s) => !ts.isImportDeclaration(s))
    .map((s) => s.getText(ast))
    .join("\n");
  const requests = [];
  const sandbox = {
    ref,
    computed,
    watch: () => {},
    onMounted: () => {},
    defineProps: () => ({ apiBaseUrl: "local" }),
    ApiClientError,
    HTMLElement: class {},
    AbortController,
    DOMException,
    Date,
    window: { setTimeout, clearTimeout },
    createApiClient: () => (path, options) =>
      new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })),
  };
  vm.runInNewContext(
    ts.transpileModule(
      body +
        "\nglobalThis.api={probe,load,items,message,requestId,probing," +
        (text === old ? "" : "probeFeedback,") +
        "};",
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
    ).outputText,
    sandbox,
  );
  return { ...sandbox.api, requests };
}

test("P47 exact historic association rejects drift and original load/probe business code stays intact", () => {
  assert.equal(hash(source), adapterFeedbackRevision.after);
  assert.equal(hash(old), adapterFeedbackRevision.before);
  assert.equal(historicalAdapterFeedbackSource(file, source + "\n// drift"), source + "\n// drift");
  assert.equal(historicalAdapterFeedbackSource("other.vue", source), source);
  const a = parse(old).descriptor,
    b = parse(source).descriptor;
  const originalLoad = a.scriptSetup.content.match(
    /async function load\(\)[\s\S]*?\nasync function probe/,
  )[0];
  assert.ok(b.scriptSetup.content.includes(originalLoad));
  const template = b.template.content
    .replace("probe(row, $event)", "probe(row)")
    .replace(/\n          <div class="adapter-detail-feedback">[\s\S]*?\n          <\/div>/, "");
  assert.equal(template, a.template.content);
  assert.match(b.template.content, /<p role="status" aria-atomic="true" tabindex="-1">/);
  assert.match(b.template.content, /probeFeedback\?\.providerId === row.id/);
});

test("P47 pending uses existing global lock, successful result binds source and probe trace", async () => {
  const h = harness();
  h.items.value = [row];
  const pending = h.probe(row);
  assert.equal(h.probing.value, row.id);
  assert.equal(h.probeFeedback.value, null);
  await h.probe({ id: "source-b", name: "来源B" });
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].path, "/platform/provider-adapters/source-a/health-check");
  assert.deepEqual(Object.keys(h.requests[0].options), ["method"]);
  assert.equal(h.requests[0].options.method, "POST");
  h.requests[0].resolve({ data: { ...row, version: 2 }, request_id: "probe-a" });
  await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(h.probeFeedback.value)), {
    providerId: "source-a",
    message: "来源A 健康检查通过",
    requestId: "probe-a",
  });
  assert.equal(h.probing.value, null);
  assert.equal(h.items.value[0].version, 2);
});

test("P47 later list refresh does not relabel the completed probe or replace its trace", async () => {
  const h = harness();
  h.items.value = [row];
  const read = h.load(),
    pending = h.probe(row);
  h.requests[1].reject(new ApiClientError("检查拒绝", "probe-rejected"));
  await pending;
  h.requests[0].resolve({ data: [row], request_id: "later-list" });
  await read;
  assert.equal(h.message.value, "已刷新 1 个来源适配器状态");
  assert.equal(h.requestId.value, "later-list");
  assert.equal(h.probeFeedback.value.message, "检查拒绝");
  assert.equal(h.probeFeedback.value.requestId, "probe-rejected");
  assert.equal(h.probeFeedback.value.providerId, "source-a");
});

test("P47 list finishing before probe cannot contaminate result; next source clears old feedback", async () => {
  const h = harness();
  h.items.value = [row];
  const read = h.load(),
    pending = h.probe(row);
  h.requests[0].resolve({ data: [row], request_id: "first-list" });
  await read;
  h.requests[1].reject(new ApiClientError("稍后检查", "probe-last"));
  await pending;
  assert.equal(h.probeFeedback.value.requestId, "probe-last");
  const second = h.probe({ id: "source-b", name: "来源B" });
  assert.equal(h.probeFeedback.value, null);
  h.requests[2].reject(new Error("transport"));
  await second;
  assert.equal(h.probeFeedback.value.providerId, "source-b");
  assert.equal(h.probeFeedback.value.message, "依赖不可用，未伪造健康结果");
  assert.equal(h.probeFeedback.value.requestId, "");
});

const evidenceRoot = "output/playwright/p47-probe-feedback";
const evidence = JSON.parse(readFileSync(`${evidenceRoot}/evidence.json`, "utf8"));
test("P47 current feedback evidence binds raw production, historic negative and C composition separately", () => {
  assert.equal(evidence.kind, "P47-PROBE-FEEDBACK-IMPLEMENTATION-r1");
  assert.equal(evidence.checks.length, 122);
  assert.equal(evidence.screenshots.length, 44);
  assert.equal(evidence.runs.length, 8);
  assert.equal(Object.keys(evidence.sourceHashes).length, 170);
  assert.equal(evidence.processesClosed, true);
  for (const [f, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(f, "utf8").replaceAll("\r\n", "\n")), sha, f);
  assert.deepEqual(
    readdirSync(evidenceRoot).sort(),
    [...evidence.screenshots.map((s) => s.file), "evidence.json", "index.html"].sort(),
  );
  for (const s of evidence.screenshots) {
    const bytes = readFileSync(`${evidenceRoot}/${s.file}`);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.equal(bytes.readUInt32BE(16), s.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), s.pixelHeight);
  }
  for (const run of evidence.runs) {
    assert.equal(run.rawComponentHash, hash(source));
    if (run.mode === "baseline") assert.equal(run.renderedComponentHash, hash(old));
    if (run.mode === "current") {
      assert.equal(run.renderedComponentHash, hash(source));
      assert.equal(run.productionUntransformed, true);
    } else assert.equal(run.productionUntransformed, false);
  }
  assert.match(evidence.fixtureBoundary, /All API locally fulfilled/);
  assert.match(evidence.remaining, /stale GET/);
});

test("P47 actual browser covers owned in-dialog result, pending focus and no focus theft after completion", () => {
  for (const mode of ["baseline", "current", "review"]) {
    for (const width of [390, 760]) {
      const value = (name) =>
        evidence.checks.find((c) => c.mode === mode && c.width === width && c.name === name)
          ?.actual;
      assert.equal(value("local region exists before request"), mode === "baseline" ? 0 : 1);
      assert.equal(value("pending focus remains inside drawer"), mode !== "baseline");
      if (mode !== "baseline") {
        assert.equal(value("pending focus is the live region"), true);
        assert.equal(value("owned feedback outside inert background"), true);
        assert.equal(value("owned feedback source identity"), "公开趋势 RSS");
        assert.equal(value("completion leaves current focus unchanged"), true);
        assert.equal(value("trace44px"), true);
      }
      assert.equal(value("late other-source result does not steal focus"), true);
      assert.equal(value("new source result cannot leak to previous source"), true);
      assert.equal(value("final background released"), true);
      assert.deepEqual(value("no unexpected network"), []);
      assert.deepEqual(value("no browser errors"), []);
    }
  }
  const requests = evidence.network.flatMap((n) => n.requests);
  assert.equal(requests.filter((r) => r.key.startsWith("POST ")).length, 20);
  assert.equal(requests.filter((r) => r.key.startsWith("GET ")).length, 28);
  assert.ok(requests.every((r) => r.body === null));
});
