import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewOpenReadState } from "../../scripts/lib/open-read-state-preview.mjs";
import { openReviewFixtures } from "../../scripts/lib/open-review-fixtures.mjs";
const file = "apps/web/src/components/OpenPlatformCenter.vue";
const source = readFileSync(file, "utf8");
const script = parse(source).descriptor.scriptSetup.content;
const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(ast))
    .join("\n") + "\nglobalThis.subject={load,state,refreshing,hasSnapshot,notice,requestId,data};",
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const { fixture } = await openReviewFixtures();
function harness() {
  const calls = [],
    timers = new Map();
  let timerId = 0;
  class ApiClientError extends Error {
    constructor(status) {
      super("local failure");
      Object.assign(this, {
        status,
        requestId: "p60-failed-read",
        actionHint: "测试读取暂不可用。",
      });
    }
  }
  const box = {
    ApiClientError,
    AbortController,
    URLSearchParams,
    innerWidth: 1440,
    location: { search: "", pathname: "/platform-admin/open-platform" },
    history: { state: null, replaceState() {} },
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    ref: (value) => ({ value }),
    reactive: (value) => value,
    computed: (get) => ({
      get value() {
        return get();
      },
    }),
    nextTick: async () => {},
    onMounted: (fn) => {
      box.mount = fn;
    },
    onBeforeUnmount: (fn) => {
      box.unmount = fn;
    },
    createApiClient: () => (url, options) =>
      new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
    window: {
      setTimeout(fn, delay) {
        assert.equal(delay, 15000);
        timers.set(++timerId, fn);
        return timerId;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
  };
  vm.runInNewContext(code, box);
  return {
    box,
    calls,
    timers,
    subject: box.subject,
    async ready() {
      const pending = box.subject.load();
      calls.at(-1).resolve({ data: structuredClone(fixture), request_id: "p60-snapshot" });
      await pending;
    },
    timeout() {
      const callback = [...timers.values()][0];
      assert.ok(callback);
      callback();
      calls.at(-1).reject(new DOMException("aborted", "AbortError"));
    },
  };
}
test("P60 first timeout does not claim a previous snapshot or server cancellation", async () => {
  const h = harness(),
    pending = h.subject.load();
  h.timeout();
  await pending;
  assert.equal(h.subject.notice.value, "读取超过 15 秒，已停止本次等待。");
  assert.equal(h.subject.hasSnapshot.value, false);
  assert.equal(h.subject.state.value, "blocked");
  assert.equal(h.timers.size, 0);
});
test("P60 retained timeout identifies the old snapshot without deleting it", async () => {
  const h = harness();
  await h.ready();
  const old = h.subject.data.value;
  const pending = h.subject.load();
  h.timeout();
  await pending;
  assert.equal(h.subject.notice.value, "读取超过 15 秒，已停止本次等待。 当前仍显示上次成功结果。");
  assert.equal(h.subject.data.value, old);
  assert.equal(h.subject.state.value, "ready");
  assert.equal(h.subject.refreshing.value, false);
});
for (const [status, state] of [
  [401, "expired"],
  [403, "forbidden"],
  [429, "rate_limited"],
  [503, "blocked"],
  [400, "error"],
])
  test(`P60 first ${status} retains its actual hint and classification`, async () => {
    const h = harness(),
      pending = h.subject.load();
    h.calls[0].reject(new h.box.ApiClientError(status));
    await pending;
    assert.equal(h.subject.state.value, state);
    assert.equal(h.subject.notice.value, "测试读取暂不可用。");
    assert.equal(h.subject.requestId.value, "p60-failed-read");
  });
test("P60 retained dependency failure explicitly identifies stale results", async () => {
  const h = harness();
  await h.ready();
  const pending = h.subject.load();
  h.calls.at(-1).reject(new h.box.ApiClientError(503));
  await pending;
  assert.equal(h.subject.notice.value, "测试读取暂不可用。 当前仍显示上次成功结果。");
  assert.equal(h.subject.hasSnapshot.value, true);
});
test("P60 a non-timeout abort is not described as a fifteen-second timeout", async () => {
  const h = harness(),
    pending = h.subject.load();
  h.box.unmount();
  h.calls[0].reject(new DOMException("aborted", "AbortError"));
  await pending;
  assert.equal(h.subject.notice.value, "读取失败，请检查网络后重试。");
  assert.equal(h.timers.size, 0);
});
test("P60 single-flight and subsequent read recovery remain unchanged", async () => {
  const h = harness(),
    pending = h.subject.load();
  await h.subject.load();
  assert.equal(h.calls.length, 1);
  h.calls[0].reject(new h.box.ApiClientError(503));
  await pending;
  await h.ready();
  assert.equal(h.calls.length, 2);
  assert.equal(h.subject.notice.value, "");
  assert.equal(h.subject.requestId.value, "p60-snapshot");
  assert.equal(h.subject.state.value, "ready");
  assert.equal(h.timers.size, 0);
});
test("P60 read review promotes only the two state headings and compiles actual Vue", () => {
  const reviewed = previewOpenReadState(source),
    { descriptor, errors } = parse(reviewed);
  assert.deepEqual(errors, []);
  assert.equal(descriptor.scriptSetup.content, script);
  assert.equal((reviewed.match(/<h2 id="open-read-state-title">/g) || []).length, 2);
  const compiled = compileScript(descriptor, { id: "p60-read" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      id: "p60-read",
      filename: file,
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
  assert.throws(() =>
    previewOpenReadState(source.replaceAll('id="open-read-state-title"', 'id="changed"')),
  );
});
test("P60 first failure and retained notice have separate semantic containers", () => {
  assert.match(source, /<div v-if="notice && hasSnapshot" class="open-notice" role="status">/);
  assert.doesNotMatch(source, /<p[^>]*class="open-notice"/);
  assert.match(source, /:aria-busy="refreshing"/);
  assert.equal((source.match(/aria-labelledby="open-read-state-title"/g) || []).length, 2);
});
