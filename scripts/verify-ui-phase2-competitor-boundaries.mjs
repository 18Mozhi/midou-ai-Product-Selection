import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";

// Regress fixed ownership boundaries and characterize remaining source gaps.
// UNFIXED assertions are reproductions, never the desired product behavior.
export async function verifyCompetitorBoundaries() {
  const file = "apps/web/src/components/CompetitorMonitor.vue";
  const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const ast = ts.createSourceFile("competitor-setup.ts", script, ts.ScriptTarget.Latest, true);
  for (const statement of [...ast.statements].reverse())
    if (ts.isImportDeclaration(statement))
      script = script.slice(0, statement.pos) + script.slice(statement.end);
  const exposed = [
    "items",
    "rules",
    "selected",
    "state",
    "notice",
    "busy",
    "showCreate",
    "showRule",
    "createStep",
    "rule",
    "deleting",
    "deleteReason",
    "detail",
    "collect",
    "createRule",
    "openDelete",
    "remove",
    "handleEscape",
  ];
  const compiled = ts.transpileModule(script + `\nreturn {${exposed.join(",")}};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const scopes = [],
    checks = [];
  class ApiClientError extends Error {}
  function setup({ mode = "list", capabilities = ["competitor:manage"], query = {} } = {}) {
    const scope = effectScope();
    scopes.push(scope);
    const calls = [],
      replies = [],
      mounts = [],
      unmounts = [],
      timers = new Map(),
      routes = [];
    const route = {
      query,
      fullPath: mode === "rules" ? "/competitors/monitoring-rules" : "/competitors",
    };
    const env = {
      ref,
      reactive,
      computed,
      watch,
      nextTick,
      ApiClientError,
      defineProps: () => ({ mode, capabilities, apiBaseUrl: "inert" }),
      withDefaults: (props) => props,
      useRoute: () => route,
      useRouter: () => ({
        push: (value) => routes.push(value),
        replace: (value) => {
          routes.push(value);
          route.query = value.query;
        },
        back: () => routes.push("back"),
      }),
      onMounted: (fn) => mounts.push(fn),
      onUnmounted: (fn) => unmounts.push(fn),
      window: { addEventListener() {}, removeEventListener() {} },
      buildCompetitionMonitoringReadiness: () => ({}),
      setTimeout: (fn, ms) => {
        const id = {};
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      createApiClient: () => async (url, options) => {
        calls.push({ url, options });
        assert.ok(replies.length, "unexpected request " + url);
        const reply = await replies.shift();
        if (reply instanceof Error) throw reply;
        return reply;
      },
    };
    return {
      ...scope.run(() => new Function(...Object.keys(env), compiled)(...Object.values(env))),
      calls,
      replies,
      mounts,
      unmounts,
      timers,
      routes,
      route,
    };
  }
  const response = (data) => ({ data, request_id: "synthetic-boundary" });
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const item = (id) => ({
    id,
    title: "隔离对象 " + id,
    status: "active",
    revision: 7,
    source_site: "amazon.com",
    external_id: "B000000001",
    market: "US",
    latest_snapshot: null,
    latest_collection: null,
    snapshots: [],
    changes: [],
    alerts: [],
  });
  const a = item("object-a"),
    b = item("object-b");
  try {
    // Same actual onMounted callback, including its unawaited load; no HTTP or DOM.
    for (const mode of ["list", "rules"]) {
      const s = setup({ mode, query: { create: "1", competitor: a.id } });
      s.replies.push(response([]), response([]));
      s.mounts.forEach((fn) => fn());
      await new Promise(setImmediate);
      assert.equal(s.showCreate.value, true);
      assert.equal(s.showRule.value, mode === "rules");
      assert.equal(s.state.value, mode === "rules" ? "ready" : "empty");
      assert.equal(s.calls.filter((call) => call.options?.method).length, 0);
      if (mode === "rules") {
        assert.equal(s.rule.competitor_id, a.id);
        s.handleEscape({ key: "Escape" });
        assert.equal(s.showRule.value, false);
        assert.equal(s.showCreate.value, true);
        assert.equal(s.route.query.competitor, undefined);
        s.handleEscape({ key: "Escape" });
        assert.equal(s.showCreate.value, false);
        assert.equal(s.route.query.create, undefined);
      }
    }
    const reader = setup({
      mode: "rules",
      capabilities: [],
      query: { create: "1", competitor: a.id },
    });
    reader.replies.push(response([]), response([]));
    reader.mounts.forEach((fn) => fn());
    await new Promise(setImmediate);
    assert.equal(reader.showCreate.value, false);
    assert.equal(reader.showRule.value, false);
    checks.push({
      id: "CP-B01",
      status: "UNFIXED-reproduced",
      result:
        "P20 manager create+competitor query opens both flags; Escape closes rule then create. P19 only create. Read-only opens neither; no writes.",
    });

    let s = setup(),
      late = deferred();
    s.items.value = [a, b];
    s.replies.push(late.promise, response(b));
    const firstRead = s.detail(a);
    await s.detail(b);
    assert.equal(s.selected.value.id, b.id);
    late.resolve(response(a));
    await firstRead;
    assert.equal(s.selected.value.id, b.id);
    assert.equal(s.routes.at(-1).query.competitor, b.id);
    late = deferred();
    s.replies.push(late.promise, response(b));
    const failedRead = s.detail(a);
    await s.detail(b);
    late.resolve(new Error("late A failure"));
    await failedRead;
    assert.equal(s.selected.value.id, b.id);
    assert.equal(s.notice.value, "");
    checks.push({
      id: "CP-B02",
      status: "fixed-source-regression",
      result:
        "Late A detail success/failure cannot replace newer B selection/query/feedback; read generation enforced.",
    });

    s = setup();
    late = deferred();
    s.items.value = [a, b];
    s.selected.value = a;
    s.replies.push(late.promise, response(b));
    const collecting = s.collect();
    assert.equal(s.busy.value, true);
    await s.detail(b);
    late.resolve(response({ task_id: "task-for-a", status: "queued" }));
    await collecting;
    assert.equal(s.calls[0].url, "/competitors/object-a/collect");
    assert.deepEqual(s.calls[0].options.body, {});
    assert.equal(s.selected.value.id, b.id);
    assert.equal(s.selected.value.latest_collection, null);
    assert.equal(s.notice.value, "");
    assert.equal(
      s.items.value.find((row) => row.id === a.id).latest_collection.task_id,
      "task-for-a",
    );
    assert.equal(s.items.value.find((row) => row.id === b.id).latest_collection, null);
    assert.equal(s.timers.size, 0);
    s.replies.push(response({ task_id: "task-for-b", status: "queued" }));
    await s.collect();
    s.replies.push(response(a));
    await s.detail(a);
    assert.equal(s.selected.value.latest_collection.task_id, "task-for-a");
    s.replies.push(
      response({ ...a, latest_collection: { task_id: "task-for-a", status: "succeeded" } }),
    );
    await s.detail(a);
    assert.equal(s.selected.value.latest_collection.status, "succeeded");
    assert.equal(s.timers.size, 0);
    s.replies.push(response(b));
    await s.detail(b);
    assert.equal(s.selected.value.latest_collection.task_id, "task-for-b");
    assert.equal(s.timers.size, 1);
    s.unmounts.forEach((fn) => fn());
    assert.equal(s.timers.size, 0);
    checks.push({
      id: "CP-B03",
      status: "fixed-source-regression",
      result:
        "Collect A updates only A, without B feedback/poll; A and B pending tasks survive independent stale details, exact terminal A clears only A, unmount clears inert timer.",
    });

    s = setup();
    late = deferred();
    s.selected.value = a;
    s.openDelete();
    s.deleteReason.value = "删除 A";
    s.replies.push(late.promise, response([b]), response([]), response(b));
    const deleting = s.remove();
    s.selected.value = b;
    s.openDelete();
    s.deleteReason.value = "B 的新草稿";
    assert.equal(s.deleting.value.id, b.id);
    late.resolve(response({}));
    await deleting;
    assert.equal(s.calls[0].url, "/competitors/object-a");
    assert.deepEqual(s.calls[0].options, {
      method: "DELETE",
      body: { expected_revision: 7, reason: "删除 A" },
    });
    assert.equal(s.deleting.value, null);
    assert.equal(s.deleteReason.value, "");
    assert.equal(s.notice.value, "");
    assert.equal(s.calls.filter((call) => call.options?.method === "DELETE").length, 1);
    checks.push({
      id: "CP-B04",
      status: "UNFIXED-reproduced",
      result:
        "Function-level A delete completion clears a newer B dialog/draft and reload clears success notice. Only A DELETE intended; DOM reachability/SQL unproven.",
    });

    s = setup({ mode: "rules" });
    const first = deferred(),
      second = deferred();
    s.replies.push(first.promise, second.promise);
    const one = s.createRule();
    assert.equal(s.busy.value, true);
    const two = s.createRule();
    assert.equal(s.calls.length, 2);
    assert.ok(
      s.calls.every(
        (call) => call.url === "/competitor-monitor-rules" && call.options.method === "POST",
      ),
    );
    first.resolve(response(null));
    second.resolve(response(null));
    await Promise.all([one, two]);
    assert.equal(s.busy.value, false);
    checks.push({
      id: "CP-B05",
      status: "UNFIXED-reproduced",
      result:
        "Direct re-entry of createRule issues two request intents despite busy; disabled button, actual Enter/double-click and server idempotency are not tested.",
    });

    return {
      source: file,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      checks,
      limits:
        "Actual setup with inert router/transport/timers; no Vue mount, real permission/HTTP/idempotency/SQL/Worker/production assertion. UNFIXED assertions must be replaced by desired-behavior regressions when implementing fixes.",
    };
  } finally {
    for (const scope of scopes) scope.stop();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await verifyCompetitorBoundaries()));
