import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { computed, ref, shallowRef } from "vue";

function load(name) {
  const source = readFileSync(`apps/web/src/components/${name}.ts`, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const box = {
    exports: {},
    require: (name) => {
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
const { usePlatformMessageEditor } = load("use-platform-message-editor");
const { usePlatformNotificationAction } = load("use-platform-notification-action");
const { usePlatformNotificationList } = load("use-platform-notification-list");
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
          domain: "notifications",
          items: [{}],
          messages: [{}],
          pagination: { page: Number(p.get("page")), total_pages: 3 },
          message_pagination: { page: Number(p.get("message_page")), total_pages: 3 },
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
