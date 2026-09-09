import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { buildWorkDesignData } from "./lib/ui-phase2-work-design-data.mjs";

// P23 source functions with inert boundaries, not a mounted Vue or service test.
const plain = (value) => JSON.parse(JSON.stringify(value));
export async function verifyTaskListReview() {
  const shared = await buildWorkDesignData(process.cwd());
  const source = await readFile("apps/web/src/components/TaskWorkspace.vue", "utf8");
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("TaskWorkspace.ts", script, ts.ScriptTarget.Latest, true);
  function extract(name) {
    const nodes = ast.statements.filter(
      (n) => ts.isFunctionDeclaration(n) && n.name?.text === name,
    );
    assert.equal(nodes.length, 1, name);
    return nodes[0].getText(ast);
  }
  function run(name, bindings) {
    const box = { exports: {}, URLSearchParams, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(`${extract(name)}; export const result=${name}();`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    return box.exports.result;
  }
  const ref = (value) => ({ value });
  const checks = [];
  const readCases = [];
  for (const [view, allowed] of [
    ["business", true],
    ["exports", true],
    ["exports", false],
  ]) {
    const calls = [],
      changedViews = [];
    const state = ref("ready"),
      tasks = ref([]),
      summary = ref(null),
      exportTasks = ref([]),
      total = ref(0);
    const read = {};
    await run("load", {
      active: ref(true),
      ownsTaskRoute: () => true,
      beginRead: () => read,
      assertCurrentRead: (owner) => assert.equal(owner, read),
      state,
      tasks,
      summary,
      exportTasks,
      total,
      activeView: ref(view),
      canReadExports: ref(allowed),
      props: { mode: "all" },
      page: ref(2),
      pageSize: 10,
      pageCount: ref(2),
      status: ref("paused"),
      query: ref("证据"),
      sort: ref("due_asc"),
      api: async (url, options, metadata, owner) => {
        assert.equal(owner, read);
        assert.equal(options, undefined);
        calls.push(url);
        if (url === "/report-exports")
          return [{ id: "export-example", queue_position: null, estimated_completion_at: null }];
        if (url === "/tasks/summary") return shared.summary;
        assert.ok(url.startsWith("/tasks?"));
        metadata({ total: 12 });
        return shared.list.data;
      },
      loadMembers: async (owner) => {
        assert.equal(owner, read);
        calls.push("/tasks/member-options");
      },
      setView: async (next) => changedViews.push(next),
      setPage: () => {
        throw Error("unexpected pagination correction");
      },
      SupersededTaskRead: class extends Error {},
      rethrowUnexpectedError: (e) => {
        throw e;
      },
    });
    if (view === "business") {
      assert.equal(calls.length, 3);
      const params = new URLSearchParams(calls[0].split("?")[1]);
      assert.deepEqual(Object.fromEntries(params), {
        page: "2",
        page_size: "10",
        status: "paused",
        query: "证据",
        sort: "due_asc",
      });
      assert.equal(total.value, 12);
      assert.deepEqual(plain(summary.value), shared.summary);
      assert.equal(state.value, "ready");
    } else if (allowed) {
      assert.deepEqual(calls, ["/report-exports"]);
      assert.equal(exportTasks.value[0].queue_position, null);
      assert.equal(exportTasks.value[0].estimated_completion_at, null);
    } else {
      assert.deepEqual(calls, []);
      assert.deepEqual(changedViews, ["business"]);
    }
    readCases.push({ view, allowed, calls, changedViews });
  }
  checks.push(
    "P23 all list omits mine and retains exact filters/pagination; separate summary and list total; read ownership internals stubbed, not re-proven",
  );
  checks.push(
    "Exports permitted: report-exports only, unknown queue/ETA preserved; denied: zero API and return to business view",
  );

  // The shared not_found illustration belongs to detail, not the P23 list 404 branch.
  class ApiClientError extends Error {}
  for (const taskId of [undefined, "A"]) {
    const state = ref("loading");
    const failure = Object.assign(new ApiClientError("isolated 404"), {
      status: 404,
      kind: "error",
      requestId: "isolated-list-404",
      actionHint: "核对对象",
    });
    await assert.rejects(
      run("api", {
        props: { mode: "all", taskId },
        state,
        notice: ref(""),
        requestId: ref(""),
        ApiClientError,
        request: async () => {
          throw failure;
        },
      }),
      (error) => error === failure,
    );
    assert.equal(state.value, taskId ? "not_found" : "error");
  }
  checks.push(
    "Actual API 404 mapping: P23 list becomes error; taskId detail becomes not_found, so shared not_found design is not a P23 state",
  );

  const deleting = ref({ id: "A", version: 2 }),
    deleteReason = ref("核对后删除"),
    busy = ref(false),
    calls = [];
  let release,
    refreshed = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const deletion = run("removeTask", {
    busy,
    deleting,
    deleteReason,
    canUpdate: ref(true),
    selected: ref(null),
    props: { mode: "all" },
    notice: ref(""),
    api: async (url, options) => {
      calls.push(plain({ url, ...options }));
      await pending;
    },
    load: async () => {
      refreshed += 1;
    },
    rethrowUnexpectedError: (error) => {
      throw error;
    },
  });
  assert.equal(busy.value, true);
  assert.deepEqual(calls, [
    { url: "/tasks/A", method: "DELETE", body: { expected_version: 2, reason: "核对后删除" } },
  ]);
  // Native Escape delegates to this actual arrow; it has no busy guard.
  const closeDeclaration = ast.statements
    .flatMap((n) => (ts.isVariableStatement(n) ? [...n.declarationList.declarations] : []))
    .find((n) => n.name.getText(ast) === "closeDeleteDialog");
  assert.ok(closeDeclaration);
  vm.runInNewContext(`(${closeDeclaration.initializer.getText(ast)})();`, {
    deleting,
    deleteReason,
  });
  assert.equal(deleting.value, null);
  release();
  await assert.rejects(deletion, (error) => error.name === "TypeError" && /id/.test(error.message));
  assert.equal(refreshed, 0);
  assert.equal(busy.value, false);
  checks.push(
    "UNFIXED: pending DELETE then actual closeDeleteDialog clears target; successful response dereferences null target before list refresh. Source composition only, not a mounted Escape/service proof",
  );
  return {
    shared: {
      routeCases: Object.keys(shared.routeCases).length,
      writeBodies: Object.keys(shared.contracts).length,
      eligibility: Object.keys(shared.eligibility).length,
    },
    readCases,
    checks,
    limits:
      "Inert function/SQL-construction probes; no browser DOM, transport, authentication, database, side-effect rollback or production proof.",
  };
}
if (process.argv[1]?.endsWith("verify-ui-phase2-task-list-review.mjs"))
  console.log(JSON.stringify(await verifyTaskListReview()));
