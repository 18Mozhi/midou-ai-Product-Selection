import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { ref, computed } from "vue";
import {
  adapterFeedbackRevision,
  historicalAdapterFeedbackSource,
} from "../../scripts/lib/ui-phase2-adapter-feedback-baseline.mjs";

const file = adapterFeedbackRevision.file;
const currentSource = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const captureRevision = "004c3e0e5d9835488036a5052b31ed93a505f145";
const captured = (path) =>
  execFileSync("git", ["show", `${captureRevision}:${path}`], { encoding: "utf8" }).replaceAll(
    "\r\n",
    "\n",
  );
// The original feedback revision predates read ownership; never infer history from equality.
const source = captured(file);
const hash = (s) => createHash("sha256").update(s).digest("hex");
assert.equal(hash(source), adapterFeedbackRevision.after);
const old = historicalAdapterFeedbackSource(file, source);
const row = { id: "source-a", name: "来源A", health_status: "ready" };
class ApiClientError extends Error {
  constructor(hint, id) {
    super(hint);
    this.actionHint = hint;
    this.requestId = id;
  }
}
function harness(text = currentSource) {
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
      body + "\nglobalThis.api={probe,load,items,message,requestId,probing,probeFeedback};",
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
    ).outputText,
    sandbox,
  );
  return { ...sandbox.api, requests };
}

test("P47 frozen feedback revision rejects drift and preserves its original load/probe contract", () => {
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

for (const [revision, input] of [
  ["historical-feedback", source],
  ["current-raw", currentSource],
]) {
  test(`P47 ${revision} pending uses existing global lock, successful result binds source and probe trace`, async () => {
    const h = harness(input);
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

  test(`P47 ${revision} late pre-probe read preserves the revision-specific ownership contract`, async () => {
    const h = harness(input);
    h.items.value = [row];
    const read = h.load(),
      pending = h.probe(row);
    h.requests[1].reject(new ApiClientError("检查拒绝", "probe-rejected"));
    await pending;
    h.requests[0].resolve({ data: [row], request_id: "later-list" });
    await read;
    assert.equal(
      h.message.value,
      revision === "historical-feedback" ? "已刷新 1 个来源适配器状态" : "检查拒绝",
    );
    assert.equal(
      h.requestId.value,
      revision === "historical-feedback" ? "later-list" : "probe-rejected",
    );
    assert.equal(h.probeFeedback.value.message, "检查拒绝");
    assert.equal(h.probeFeedback.value.requestId, "probe-rejected");
    assert.equal(h.probeFeedback.value.providerId, "source-a");
  });

  test(`P47 ${revision} list finishing before probe cannot contaminate result; next source clears old feedback`, async () => {
    const h = harness(input);
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
}

test("P47 current harness requires the real feedback binding instead of omitting a missing field", () => {
  assert.equal(harness().probeFeedback.value, null);
  const missingBinding = currentSource.replace("probeFeedback = ref", "removedFeedback = ref");
  assert.notEqual(missingBinding, currentSource);
  assert.throws(() => harness(missingBinding), /probeFeedback is not defined/);
});

const evidenceRoot = "output/playwright/p47-probe-feedback";
const evidence = JSON.parse(readFileSync(`${evidenceRoot}/evidence.json`, "utf8"));
test("P47 frozen feedback capture retains exact images and revision-specific component claims", () => {
  assert.equal(evidence.kind, "P47-PROBE-FEEDBACK-IMPLEMENTATION-r1");
  assert.equal(evidence.checks.length, 122);
  assert.equal(evidence.screenshots.length, 44);
  assert.equal(evidence.runs.length, 8);
  assert.equal(Object.keys(evidence.sourceHashes).length, 170);
  assert.equal(evidence.processesClosed, true);
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

test("P47 archived feedback packet binds its complete original manifest and170 captured dependencies", () => {
  assert.deepEqual(evidence, JSON.parse(captured(`${evidenceRoot}/evidence.json`)));
  for (const [f, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(captured(f)), sha, f);
  // Current behavior above and the current browser runner use raw Vue, not archive substitution.
  assert.notEqual(hash(currentSource), evidence.sourceHashes[file]);
});

test("P47 captured browser observations retain owned feedback, pending focus and completion boundaries", () => {
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
