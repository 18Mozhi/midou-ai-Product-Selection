import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";

// Real source functions at inert boundaries. No mounted Vue, HTTP, SQL or production claim.
const plain = (value) => JSON.parse(JSON.stringify(value));
const ref = (value) => ({ value });
export async function verifyTaskDetailReview() {
  const source = await readFile("apps/web/src/components/TaskWorkspace.vue", "utf8");
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("TaskWorkspace.ts", script, ts.ScriptTarget.Latest, true);
  function extract(name) {
    const nodes = ast.statements.filter(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.equal(nodes.length, 1, name);
    return nodes[0].getText(ast);
  }
  function run(name, bindings, args = [], helpers = []) {
    const box = { exports: {}, URLSearchParams, args, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(
        `${[...helpers, name].map(extract).join("\n")}; export const result=${name}(...args);`,
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
      ).outputText,
      box,
    );
    return box.exports.result;
  }
  const task = { id: "A", version: 2, assignee_id: "member-A" };
  const checks = [];
  for (const [view, allowed] of [
    ["business", true],
    ["exports", true],
    ["exports", false],
  ]) {
    const calls = [],
      changedViews = [],
      read = {},
      selected = ref(null),
      state = ref("ready");
    await run(
      "load",
      {
        active: ref(true),
        ownsTaskRoute: () => true,
        beginRead: () => read,
        assertCurrentRead: (owner) => assert.equal(owner, read),
        activeView: ref(view),
        canReadExports: ref(allowed),
        props: { mode: "all", taskId: "A" },
        selected,
        state,
        exportTasks: ref([]),
        api: async (url, options, meta, owner) => {
          assert.equal(owner, read);
          calls.push(url);
          return url === "/report-exports" ? [] : task;
        },
        loadMembers: async (owner, detail) => {
          assert.equal(owner, read);
          assert.equal(detail, true);
          calls.push("/tasks/member-options");
        },
        setView: async (next) => changedViews.push(next),
        SupersededTaskRead: class extends Error {},
        rethrowUnexpectedError: (error) => {
          throw error;
        },
      },
      [],
      ["openById"],
    );
    if (view === "business") {
      assert.deepEqual(calls, ["/tasks/A", "/tasks/member-options"]);
      assert.equal(selected.value.id, "A");
      assert.equal(state.value, "ready");
    } else if (allowed) {
      assert.deepEqual(calls, ["/report-exports"]);
      assert.equal(selected.value, null);
      assert.equal(state.value, "empty");
    } else {
      assert.deepEqual(calls, []);
      assert.deepEqual(changedViews, ["business"]);
    }
  }
  checks.push(
    "Business deep link reads detail then members only; UNFIXED permitted view=exports precedes taskId and returns no task; denied exports restores business intent, follow-up watcher not simulated",
  );

  const calls = [],
    refreshes = [],
    opened = [],
    busy = ref(false),
    notice = ref("");
  const bindings = {
    busy,
    notice,
    selected: ref(task),
    canUpdate: ref(true),
    canAssign: ref(true),
    api: async (url, options) => {
      calls.push(plain({ url, ...options }));
      return {};
    },
    openById: async (...args) => {
      refreshes.push(args);
    },
    openActionEditor: (name) => opened.push(name),
    rethrowUnexpectedError: (error) => {
      throw error;
    },
  };
  for (const name of ["start", "resume", "complete"]) {
    await run("action", bindings, [name]);
    assert.deepEqual(calls.at(-1), {
      url: "/tasks/A/actions",
      method: "POST",
      body: { action: name, expected_version: 2 },
    });
    assert.deepEqual(refreshes.at(-1), ["A", true]);
    assert.equal(busy.value, false);
  }
  for (const name of ["pause", "cancel", "delay", "transfer", "progress"])
    await run("action", bindings, [name]);
  assert.deepEqual(opened, ["pause", "cancel", "delay", "transfer", "progress"]);
  assert.equal(calls.length, 3);
  for (const [status, message] of [
    ["queued", "任务已完成，机会重新评分已自动入队。"],
    ["waiting_for_active_rule", "任务已完成；当前没有活动评分规则，暂未生成评分任务。"],
  ]) {
    await run("action", { ...bindings, api: async () => ({ auto_score_status: status }) }, [
      "complete",
    ]);
    assert.equal(notice.value, message);
  }
  checks.push(
    "Three immediate action bodies, five local editor openings, and both complete auto-score messages preserve actual response semantics",
  );

  const fields = {
    reason: "  核对原因  ",
    due_at: "2026-09-11T10:30",
    assignee_id: "member-B",
    progress_percent: 35,
    progress_note: "  已核对事实  ",
  };
  const actionFields = {
    pause: { reason: "核对原因" },
    cancel: { reason: "核对原因" },
    delay: { reason: "核对原因", due_at: new Date(fields.due_at).toISOString() },
    transfer: { reason: "核对原因", assignee_id: "member-B" },
    progress: { progress_percent: 35, progress_note: "已核对事实" },
  };
  for (const name of Object.keys(actionFields)) {
    const editor = ref(name);
    await run("submitTaskAction", {
      ...bindings,
      taskActionEditor: editor,
      taskActionForm: ref({ ...fields }),
    });
    assert.deepEqual(calls.at(-1), {
      url: "/tasks/A/actions",
      method: "POST",
      body: { action: name, expected_version: 2, ...actionFields[name] },
    });
    assert.equal(editor.value, null);
  }
  for (const [canUpdate, canAssign, name, permitted] of [
    [false, true, "transfer", true],
    [false, true, "pause", false],
    [true, false, "transfer", false],
  ]) {
    const before = calls.length;
    await run("submitTaskAction", {
      ...bindings,
      canUpdate: ref(canUpdate),
      canAssign: ref(canAssign),
      taskActionEditor: ref(name),
      taskActionForm: ref({ ...fields }),
    });
    assert.equal(calls.length - before, permitted ? 1 : 0);
  }
  checks.push(
    "Five exact form bodies/version, independent single-transfer capability; no inferred terminal-state change or backend authorization proof",
  );

  // Inputs and Return remain active in source during this request; newer typing is not this body.
  for (const outcome of ["success", "failure"]) {
    let release;
    const deferred = new Promise((resolve, reject) => {
      release = () =>
        outcome === "success" ? resolve({}) : reject(new Error("isolated conflict"));
    });
    const editor = ref("progress"),
      form = ref({ ...fields }),
      captured = [];
    const promise = run("submitTaskAction", {
      ...bindings,
      taskActionEditor: editor,
      taskActionForm: form,
      api: async (url, options) => {
        captured.push(plain(options.body));
        return deferred;
      },
    });
    assert.equal(busy.value, true);
    form.value.progress_note = "等待期间新增的说明";
    release();
    if (outcome === "success") {
      await promise;
      assert.equal(editor.value, null);
    } else {
      await assert.rejects(promise, /isolated conflict/);
      assert.equal(editor.value, "progress");
    }
    assert.equal(captured[0].progress_note, "已核对事实");
    assert.equal(form.value.progress_note, "等待期间新增的说明");
    assert.equal(busy.value, false);
  }
  checks.push(
    "UNFIXED draft/result distinction: in-flight edited note is not sent; success closes editor while newer note is only local, failure leaves current draft open. Source refs, not a browser typing proof",
  );

  const editForm = { title: "事实复核", description: "已有说明", priority: "high", due_at: "" };
  let editorClosed = 0,
    detailReloads = 0,
    quickQueryCleared = 0;
  await run("create", {
    ...bindings,
    canCreate: ref(false),
    editing: ref(task),
    form: ref({ ...editForm }),
    closeTaskEditor: () => {
      editorClosed += 1;
    },
    clearQuickCreate: async () => {
      quickQueryCleared += 1;
    },
    load: async () => {
      detailReloads += 1;
    },
  });
  assert.deepEqual(calls.at(-1), {
    url: "/tasks/A",
    method: "PATCH",
    body: {
      ...editForm,
      due_at: null,
      assignee_id: "member-A",
      expected_version: 2,
      reason: "更新任务内容",
    },
  });
  assert.deepEqual([editorClosed, detailReloads, quickQueryCleared], [1, 1, 1]);
  checks.push(
    "Edit uses update capability without create, PATCH preserves assignee/version/reason, empty due becomes null; successful close/query cleanup/refresh invoked with inert boundaries",
  );

  const comment = ref("  保留评论原文  ");
  await run("addComment", { ...bindings, comment });
  assert.deepEqual(calls.at(-1), {
    url: "/tasks/A/comments",
    method: "POST",
    body: { body: "  保留评论原文  " },
  });
  assert.equal(comment.value, "");
  comment.value = "保留失败评论";
  await assert.rejects(
    run("addComment", {
      ...bindings,
      comment,
      api: async () => {
        throw Error("isolated comment failure");
      },
    }),
    /isolated comment failure/,
  );
  assert.equal(comment.value, "保留失败评论");
  checks.push(
    "Comment sends raw body after trim guard, clears only on success and preserves failure draft; no extra version or fields invented",
  );

  const routeReplacements = [],
    deleting = ref(task);
  await run("removeTask", {
    ...bindings,
    deleting,
    deleteReason: ref("  原因  "),
    props: { taskId: "A" },
    returnPath: ref("/tasks?status=paused"),
    router: { replace: async (path) => routeReplacements.push(path) },
    load: async () => {
      throw Error("detail deletion must return to origin");
    },
  });
  assert.deepEqual(calls.at(-1), {
    url: "/tasks/A",
    method: "DELETE",
    body: { expected_version: 2, reason: "原因" },
  });
  assert.deepEqual(routeReplacements, ["/tasks?status=paused"]);
  checks.push(
    "Successful selected-detail deletion returns to returnPath; pending-close null-target defect remains covered by P23 verifier, not fixed here",
  );

  const file = "apps/web/src/components/TaskDetailPanel.vue";
  const detail = await readFile(file, "utf8"),
    candidates = scanSource(detail, file).candidates;
  const transfer = candidates.find((c) => c.events?.["@click"] === "$emit('action', 'transfer')");
  assert.equal(transfer.attributes["v-if"], "canAssign");
  const ret = candidates.find((c) => c.events?.["@click"] === "$emit('closeAction')");
  assert.equal(ret.attributes[":disabled"], undefined);
  const mutableFields = candidates.filter((c) =>
    Object.values(c.events ?? {}).some((handler) => handler.includes("updateActionForm(")),
  );
  assert.equal(mutableFields.length, 5);
  for (const field of mutableFields) assert.equal(field.attributes[":disabled"], undefined);
  const css = await readFile("apps/web/src/task-workspace-enhancements.css", "utf8");
  assert.match(
    css,
    /\.task-detail-route > :not\(\.task-detail\):not\(dialog\):not\(\.task-detail-state\):not\(\.task-notice\)\s*\{\s*display: none;/,
  );
  checks.push(
    "Source-only presentation: transfer has no terminal predicate, five form fields/Return lack busy disabling, detail CSS hides list/tabs/title/exports but keeps dialogs/status/notice",
  );
  return {
    checks,
    limits:
      "Inert AST/VM and source-presentation probes; no mounted DOM, transport, SQL, permissions, complete GET lifecycle or production proof. Known-defect expectations must change with approved fixes.",
  };
}
if (process.argv[1]?.endsWith("verify-ui-phase2-task-detail-review.mjs"))
  console.log(JSON.stringify(await verifyTaskDetailReview()));
