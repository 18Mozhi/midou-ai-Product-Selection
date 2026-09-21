import test from "node:test";
import { historicalAdapterReadSource } from "../../scripts/lib/ui-phase2-adapter-read-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { ref, computed } from "vue";
import { adapterReadRevision } from "../../scripts/lib/ui-phase2-adapter-read-baseline.mjs";

const file = adapterReadRevision.file;
const currentSource = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const captureRevision = "f2e8721892a226346d0e6f33ea3a36636f0f4152";
const captured = (path) =>
  execFileSync("git", ["show", `${captureRevision}:${path}`], { encoding: "utf8" }).replaceAll(
    "\r\n",
    "\n",
  );
// Immutable fix/counterexample pair; current behavior always executes the raw worktree source.
const source = captured(file);
const hash = (s) => createHash("sha256").update(s).digest("hex");
assert.equal(hash(source), adapterReadRevision.after);
const old = historicalAdapterReadSource(file, source);
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
      body +
        "\nglobalThis.api={probe,load,items,message,requestId,probing," +
        "probeFeedback,refreshing,state,lastUpdatedAt," +
        "};",
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
    ).outputText,
    sandbox,
  );
  return { ...sandbox.api, requests };
}

test("P47 frozen read-guard revision preserves template/styles and rejects unknown historical edits", () => {
  assert.equal(hash(source), adapterReadRevision.after);
  assert.equal(hash(old), adapterReadRevision.before);
  assert.equal(historicalAdapterReadSource(file, source + "\n// drift"), source + "\n// drift");
  const a = parse(old).descriptor,
    b = parse(source).descriptor;
  assert.equal(a.template.content, b.template.content);
  assert.deepEqual(
    a.styles.map((s) => s.content),
    b.styles.map((s) => s.content),
  );
  const stripped = b.scriptSetup.content
    .replace("let loadGeneration = 0,\n  probeRevision = 0;\n", "")
    .replace(/  const generation = \+\+loadGeneration,[\s\S]*?probing.value === null;\n/, "")
    .replaceAll("    if (!ownsRead()) return;\n", "")
    .replace(
      "    if (generation === loadGeneration) refreshing.value = false;",
      "    refreshing.value = false;",
    )
    .replace("  probeRevision += 1;\n", "")
    .replace(
      "    // Reads started during this probe cannot publish after it settles either.\n    probeRevision += 1;\n",
      "",
    );
  assert.equal(stripped, a.scriptSetup.content);
});
for (const outcome of ["success", "failure"]) {
  test("P47 superseded GET " + outcome + " cannot clear busy or override newest GET", async () => {
    const h = harness();
    h.items.value = [{ ...row, version: 1 }];
    const first = h.load(),
      second = h.load();
    if (outcome === "success")
      h.requests[0].resolve({ data: [{ ...row, version: 2 }], request_id: "old" });
    else h.requests[0].reject(new ApiClientError("旧错误", "old-error"));
    await first;
    assert.equal(h.refreshing.value, true);
    assert.equal(h.items.value[0].version, 1);
    assert.equal(h.requestId.value, "");
    h.requests[1].resolve({ data: [{ ...row, version: 3 }], request_id: "new" });
    await second;
    assert.equal(h.items.value[0].version, 3);
    assert.equal(h.requestId.value, "new");
    assert.equal(h.refreshing.value, false);
  });
  test(
    "P47 late superseded GET " + outcome + " cannot overwrite completed newest GET",
    async () => {
      const h = harness();
      h.items.value = [{ ...row, version: 1 }];
      const first = h.load(),
        second = h.load();
      h.requests[1].resolve({ data: [{ ...row, version: 3 }], request_id: "new" });
      await second;
      if (outcome === "success")
        h.requests[0].resolve({ data: [{ ...row, version: 2 }], request_id: "old" });
      else h.requests[0].reject(new ApiClientError("旧错误", "old-error"));
      await first;
      assert.equal(h.items.value[0].version, 3);
      assert.equal(h.requestId.value, "new");
      assert.equal(h.message.value, "已刷新 1 个来源适配器状态");
    },
  );
}
for (const outcome of ["success", "failure"]) {
  test(
    "P47 pre-probe GET " + outcome + " does not overwrite settled probe data/message/trace",
    async () => {
      for (const [mode, input] of [
        ["baseline", old],
        ["historical-fixed", source],
        ["current-raw", currentSource],
      ]) {
        const h = harness(input);
        h.items.value = [{ ...row, version: 1 }];
        const read = h.load(),
          write = h.probe(row);
        h.requests[1].resolve({ data: { ...row, version: 3 }, request_id: "probe" });
        await write;
        if (outcome === "success")
          h.requests[0].resolve({ data: [{ ...row, version: 1 }], request_id: "old-list" });
        else h.requests[0].reject(new ApiClientError("旧读取错误", "old-error"));
        await read;
        assert.equal(
          h.items.value[0].version,
          mode === "baseline" && outcome === "success" ? 1 : 3,
        );
        assert.equal(
          h.requestId.value,
          mode === "baseline" ? (outcome === "success" ? "old-list" : "old-error") : "probe",
        );
        assert.equal(h.probeFeedback.value.requestId, "probe");
        assert.equal(h.refreshing.value, false);
      }
    },
  );
}
for (const settleReadFirst of [true, false]) {
  test(
    "P47 read begun during probe stays invalid " +
      (settleReadFirst ? "before" : "after") +
      " probe settlement",
    async () => {
      const h = harness();
      h.items.value = [{ ...row, version: 1 }];
      const write = h.probe(row),
        read = h.load();
      if (settleReadFirst) {
        h.requests[1].resolve({ data: [], request_id: "during" });
        await read;
        assert.equal(h.items.value.length, 1);
      }
      h.requests[0].resolve({ data: { ...row, version: 3 }, request_id: "probe" });
      await write;
      if (!settleReadFirst) {
        h.requests[1].resolve({ data: [], request_id: "during" });
        await read;
      }
      assert.equal(h.items.value[0].version, 3);
      assert.equal(h.requestId.value, "probe");
      assert.equal(h.probeFeedback.value.message, "来源A 健康检查通过");
      assert.equal(h.refreshing.value, false);
    },
  );
}
test("P47 failed probe also invalidates older reads; a fresh post-probe load remains usable", async () => {
  const h = harness();
  h.items.value = [{ ...row, version: 1 }];
  const read = h.load(),
    write = h.probe(row);
  h.requests[1].reject(new ApiClientError("检查未完成", "probe-failure"));
  await write;
  h.requests[0].resolve({ data: [], request_id: "old-list" });
  await read;
  assert.equal(h.items.value.length, 1);
  assert.equal(h.message.value, "检查未完成");
  const fresh = h.load();
  h.requests[2].resolve({ data: [{ ...row, version: 4 }], request_id: "fresh" });
  await fresh;
  assert.equal(h.items.value[0].version, 4);
  assert.equal(h.requestId.value, "fresh");
  assert.equal(h.probeFeedback.value.requestId, "probe-failure");
});
test("P47 current read failure and12000ms timer cleanup remain unchanged", async () => {
  const h = harness();
  h.items.value = [row];
  const p = h.load();
  h.requests[0].reject(new ApiClientError("当前读取失败", "current-error"));
  await p;
  assert.equal(h.state.value, "ready");
  assert.equal(h.message.value, "当前读取失败");
  assert.equal(h.refreshing.value, false);
  assert.match(
    parse(currentSource).descriptor.scriptSetup.content,
    /setTimeout\(\(\) => controller.abort\(\), 12_000\)/,
  );
  assert.ok(h.requests[0].options.signal instanceof AbortSignal);
  assert.equal(h.requests[0].options.signal.aborted, false);
});

const evidenceRoot = "output/playwright/p47-read-order";
const evidence = JSON.parse(readFileSync(`${evidenceRoot}/evidence.json`, "utf8"));
test("P47 frozen read-order capture retains exact48 images and revision-specific component claims", () => {
  assert.equal(evidence.kind, "P47-READ-ORDER-IMPLEMENTATION-r1");
  assert.equal(evidence.checks.length, 152);
  assert.equal(evidence.screenshots.length, 48);
  assert.equal(evidence.runs.length, 6);
  assert.equal(Object.keys(evidence.sourceHashes).length, 166);
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(
    readdirSync(evidenceRoot).sort(),
    [...evidence.screenshots.map((s) => s.file), "evidence.json", "index.html"].sort(),
  );
  for (const s of evidence.screenshots) {
    const b = readFileSync(`${evidenceRoot}/${s.file}`);
    assert.equal(hash(b), s.sha256);
    assert.equal(b.readUInt32BE(16), s.pixelWidth);
    assert.equal(b.readUInt32BE(20), s.pixelHeight);
  }
  for (const run of evidence.runs) {
    assert.equal(run.rawComponentHash, hash(source));
    assert.equal(run.renderedComponentHash, hash(run.mode === "baseline" ? old : source));
    assert.equal(run.productionUntransformed, run.mode === "current");
  }
  assert.match(evidence.fixtureBoundary, /Explicit synthetic/);
  assert.match(evidence.remaining, /no route\/unmount/);
});

test("P47 archived read-order packet binds its complete original manifest and166 captured dependencies", () => {
  assert.deepEqual(evidence, JSON.parse(captured(`${evidenceRoot}/evidence.json`)));
  for (const [f, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(captured(f)), sha, f);
  // Current behavior is executed above from raw Vue, never substituted by this archive.
  assert.notEqual(hash(currentSource), evidence.sourceHashes[file]);
});
test("P47 captured browser observations retain version rollback and detail-dismissal counterexamples", () => {
  for (const mode of ["baseline", "current"])
    for (const width of [390, 760, 1440])
      for (const scenario of ["pre-success", "pre-error", "during-early", "during-late"]) {
        const get = (name) =>
          evidence.checks.find(
            (c) =>
              c.mode === mode && c.width === width && c.scenario === scenario && c.name === name,
          )?.actual;
        const lost = mode === "baseline" && scenario.startsWith("during");
        assert.equal(get("rows retained"), lost ? 0 : 2);
        if (width <= 760) assert.equal(get("detail remains open"), lost ? 0 : 1);
        if (!lost)
          assert.equal(
            get("visible adapter version"),
            mode === "baseline" && scenario === "pre-success" ? "rss-v1" : "rss-read-order-v3",
          );
        if (mode === "current") assert.equal(get("page message"), "公开趋势 RSS 健康检查通过");
        assert.equal(get("fresh post-probe read accepted"), true);
      }
  for (const n of evidence.network) {
    assert.equal(n.requests.filter((r) => r.key.startsWith("GET ")).length, 16);
    assert.equal(n.requests.filter((r) => r.key.startsWith("POST ")).length, 4);
    assert.ok(n.requests.every((r) => r.body === null));
  }
});
