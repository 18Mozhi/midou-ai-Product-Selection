import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { computed, ref, shallowRef } from "vue";

function load(name) {
  const source = readFileSync(
    `apps/web/src/${name === "api-client" ? name : `components/${name}`}.ts`,
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const box = {
    exports: {},
    require: (name) => {
      if (name === "../api-client") return apiClient;
      assert.equal(name, "vue");
      return { computed, ref, shallowRef };
    },
    Error,
    DOMException,
    AbortController,
    URLSearchParams,
    window: {
      setTimeout,
      clearTimeout,
      location: { search: "", pathname: "/platform-admin/notifications" },
      history: { state: null, replaceState() {} },
    },
  };
  vm.runInNewContext(code, box);
  return box.exports;
}
const apiClient = load("api-client");
const { usePlatformMessageEditor } = load("use-platform-message-editor");
const { usePlatformNotificationAction } = load("use-platform-notification-action");
const { usePlatformNotificationList } = load("use-platform-notification-list");
const { notificationWriteRequest } = load("platform-notification-request");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const item = {
  id: "fixture-message",
  title: "测试草稿",
  body: "测试正文",
  kind: "notification",
  status: "draft",
  version: 3,
  category: "system",
  severity: "info",
  audience_type: "all_users",
  in_app_enabled: true,
  email_enabled: false,
};

for (const kind of ["editor", "action"]) {
  for (const outcome of ["success", "failure"]) {
    test(`${kind} late ${outcome} after page exit cannot reload or overwrite a new visit`, async () => {
      const pending = deferred(),
        message = ref(""),
        calls = [];
      let reloads = 0,
        newest = 0;
      const options = {
        message,
        request: (url, options) => {
          calls.push({ url, ...options });
          return pending.promise;
        },
        reload: async () => {
          reloads++;
          return true;
        },
        showNewestMessages: () => newest++,
      };
      const ui =
        kind === "editor"
          ? usePlatformMessageEditor(options)
          : usePlatformNotificationAction(options);
      ui.begin(item, "publish");
      const run = kind === "editor" ? ui.save() : ui.submit();
      ui.stop();
      ui.begin({ ...item, id: "new-visit" }, "cancel");
      message.value = "新页面提示";
      if (outcome === "success")
        pending.resolve({ recipient_count: 1, in_app_count: 1, email_count: 0 });
      else pending.reject(new Error("旧请求失败"));
      await run;
      assert.equal(reloads, 0);
      assert.equal(newest, 0);
      assert.equal(message.value, "新页面提示");
      assert.equal((ui.editor ?? ui.target).value.id, "new-visit");
      assert.equal(ui.error.value, "");
      assert.equal(calls.length, 1);
      assert.equal(JSON.parse(calls[0].body).expected_version, 3);
    });
  }
  test(`${kind} page exit during refresh also invalidates completion feedback`, async () => {
    const refresh = deferred(),
      message = ref("");
    const options = {
      message,
      request: async () => ({ recipient_count: 1, in_app_count: 1, email_count: 0 }),
      reload: () => refresh.promise,
      showNewestMessages() {},
    };
    const ui =
      kind === "editor"
        ? usePlatformMessageEditor(options)
        : usePlatformNotificationAction(options);
    ui.begin(item, "publish");
    const run = kind === "editor" ? ui.save() : ui.submit();
    await new Promise(setImmediate);
    ui.stop();
    message.value = "新页面提示";
    refresh.resolve(true);
    await run;
    assert.equal(message.value, "新页面提示");
  });
}

for (const kind of ["editor", "action"]) {
  test(`${kind} current save still refreshes and closing only the dialog does not discard its result`, async () => {
    const pending = deferred(),
      message = ref("");
    let reloads = 0;
    const options = {
      message,
      request: () => pending.promise,
      reload: async () => {
        reloads++;
        return true;
      },
      showNewestMessages() {},
    };
    const ui =
      kind === "editor"
        ? usePlatformMessageEditor(options)
        : usePlatformNotificationAction(options);
    ui.begin(item, "publish");
    const run = kind === "editor" ? ui.save() : ui.submit();
    ui.close();
    pending.resolve({ recipient_count: 1, in_app_count: 1, email_count: 0 });
    await run;
    assert.equal(reloads, 1);
    assert.match(message.value, kind === "editor" ? /草稿已更新/ : /发布完成/);
  });
  test(`${kind} old completion cannot clear a newly submitting visit`, async () => {
    const old = deferred(),
      current = deferred(),
      message = ref("");
    let requests = 0;
    const options = {
      message,
      request: () => (++requests === 1 ? old.promise : current.promise),
      reload: async () => true,
      showNewestMessages() {},
    };
    const ui =
      kind === "editor"
        ? usePlatformMessageEditor(options)
        : usePlatformNotificationAction(options);
    ui.begin(item, "publish");
    const first = kind === "editor" ? ui.save() : ui.submit();
    ui.stop();
    ui.begin(item, "publish");
    const second = kind === "editor" ? ui.save() : ui.submit();
    old.resolve({});
    await first;
    assert.equal((ui.saving ?? ui.submitting).value, true);
    if (kind === "action") assert.equal(ui.busyId.value, item.id);
    current.resolve({ recipient_count: 1, in_app_count: 1, email_count: 0 });
    await second;
    assert.equal((ui.saving ?? ui.submitting).value, false);
  });
}

test("an earlier publish failure is not relabeled as the later cancel dialog", async () => {
  const pending = deferred(),
    message = ref("");
  const ui = usePlatformNotificationAction({
    message,
    request: () => pending.promise,
    reload: async () => true,
  });
  ui.begin(item, "publish");
  const run = ui.submit();
  ui.close();
  ui.begin({ ...item, id: "second" }, "cancel");
  pending.reject(new Error("测试失败"));
  await run;
  assert.match(message.value, /先前的发布操作/);
  assert.equal(ui.error.value, "");
});

for (const kind of ["delivery", "message"]) {
  test(`${kind} next-page button can retry a failed read of that same next page`, async () => {
    const calls = [],
      reads = [],
      data = ref(null);
    let fail = false,
      ui;
    const options = {
      domain: ref("notifications"),
      query: ref(""),
      status: ref(""),
      data,
      state: ref("loading"),
      message: ref(""),
      refreshing: ref(false),
      request: async (url) => {
        calls.push(url);
        if (fail) throw new Error("读取失败");
        const p = new URLSearchParams(url.split("?")[1]);
        return {
          data: {
            domain: "notifications",
            items: [{}],
            messages: [{}],
            pagination: { page: Number(p.get("page")), total_pages: 3 },
            message_pagination: { page: Number(p.get("message_page")), total_pages: 3 },
          },
          request_id: "read-fixture",
          trace_id: "read-fixture",
        };
      },
      reload: () => reads.push(ui.load()),
    };
    ui = usePlatformNotificationList(options);
    await ui.load();
    const turn = kind === "delivery" ? ui.changePage : ui.changeMessagePage;
    fail = true;
    turn(2);
    await reads.at(-1);
    assert.equal(data.value[kind === "delivery" ? "pagination" : "message_pagination"].page, 1);
    assert.equal(options.refreshing.value, false);
    fail = false;
    turn(2);
    await reads.at(-1);
    assert.equal(calls.length, 3);
    assert.equal(data.value[kind === "delivery" ? "pagination" : "message_pagination"].page, 2);
    assert.equal(data.value[kind === "delivery" ? "message_pagination" : "pagination"].page, 1);
  });
}

function traceList() {
  const pending = [];
  const options = {
    domain: ref("notifications"),
    query: ref(""),
    status: ref(""),
    data: ref(null),
    state: ref("loading"),
    message: ref(""),
    refreshing: ref(false),
    request: () => {
      const task = deferred();
      pending.push(task);
      return task.promise;
    },
    reload() {},
  };
  return { ui: usePlatformNotificationList(options), pending, options };
}
const traceResponse = (id) => ({
  data: { domain: "notifications", items: [], messages: [], observed_at: id },
  request_id: id,
  trace_id: `trace-${id}`,
});
const traceFailure = (id) =>
  new apiClient.ApiClientError(
    403,
    "denied",
    "forbidden",
    "拒绝",
    "请核对权限。",
    id,
    `trace-${id}`,
  );

test("snapshot and failed-read diagnostics belong to separate accepted read outcomes", async () => {
  const { ui, pending, options } = traceList();
  const initial = ui.load();
  pending[0].resolve(traceResponse("read-1"));
  await initial;
  assert.equal(ui.snapshotRequestId.value, "read-1");
  const failed = ui.load();
  pending[1].reject(traceFailure("failed-2"));
  await failed;
  assert.equal(ui.snapshotRequestId.value, "read-1");
  assert.equal(ui.failureRequestId.value, "failed-2");
  assert.equal(options.data.value.observed_at, "read-1");
  assert.match(options.message.value, /当前权限还不能/);
  const retry = ui.load();
  assert.equal(ui.failureRequestId.value, "");
  assert.equal(ui.snapshotRequestId.value, "read-1");
  pending[2].resolve(traceResponse("read-3"));
  await retry;
  assert.equal(ui.snapshotRequestId.value, "read-3");
});

test("first failure exposes its own ID without inventing a successful snapshot ID", async () => {
  const { ui, pending, options } = traceList();
  const run = ui.load();
  pending[0].reject(traceFailure("first-denied"));
  await run;
  assert.equal(ui.snapshotRequestId.value, "");
  assert.equal(ui.failureRequestId.value, "first-denied");
  assert.equal(options.data.value, null);
});

for (const outcome of ["success", "failure"]) {
  for (const boundary of ["superseded", "exit-return"]) {
    test(`late ${outcome} after ${boundary} cannot replace accepted data or either trace ID`, async () => {
      const { ui, pending, options } = traceList();
      const old = ui.load();
      if (boundary === "exit-return") ui.stop();
      const current = ui.load();
      pending[1].resolve(traceResponse("current"));
      await current;
      if (outcome === "success") pending[0].resolve(traceResponse("old"));
      else pending[0].reject(traceFailure("old"));
      await old;
      assert.equal(ui.snapshotRequestId.value, "current");
      assert.equal(ui.failureRequestId.value, "");
      assert.equal(options.data.value.observed_at, "current");
    });
  }
}

test("a failure without server/request metadata never reuses the previous failure ID", async () => {
  const { ui, pending } = traceList();
  const first = ui.load();
  pending[0].reject(traceFailure("known"));
  await first;
  const next = ui.load();
  pending[1].reject(new Error("本地读取失败"));
  await next;
  assert.equal(ui.failureRequestId.value, "");
});

test("write adapter preserves data, original payload, action hint and cause without publishing read metadata", async () => {
  const options = { method: "POST", body: '{"action":"publish"}' },
    calls = [];
  const response = traceResponse("write-only");
  const write = notificationWriteRequest(async (...args) => {
    calls.push(args);
    return response;
  });
  assert.equal(await write("/platform/management/messages/id/actions", options), response.data);
  assert.equal(calls[0][1], options);
  const failure = traceFailure("write-failed");
  await assert.rejects(
    notificationWriteRequest(async () => {
      throw failure;
    })("/write"),
    (error) => error.message === failure.actionHint && error.cause === failure,
  );
  const abort = new DOMException("cancelled", "AbortError");
  await assert.rejects(
    notificationWriteRequest(async () => {
      throw abort;
    })("/write"),
    (error) => error === abort,
  );
});
