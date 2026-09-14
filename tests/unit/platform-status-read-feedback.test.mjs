import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
const source = readFileSync("apps/web/src/components/use-platform-status.ts", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(snapshot = null) {
  const timers = new Map(),
    calls = [],
    box = {
      exports: {},
      AbortController,
      DOMException,
      Error,
      window: {
        setTimeout(fn, ms) {
          assert.equal(ms, 15000);
          timers.set(fn, fn);
          return fn;
        },
        clearTimeout(id) {
          timers.delete(id);
        },
      },
    };
  vm.runInNewContext(code, box);
  const options = {
    domain: { value: "status" },
    data: { value: snapshot },
    state: { value: snapshot ? "ready" : "loading" },
    message: { value: "" },
    refreshing: { value: false },
    request: (path, init) =>
      new Promise((resolve, reject) => calls.push({ path, init, resolve, reject })),
  };
  const subject = box.exports.usePlatformStatus(options);
  return {
    options,
    subject,
    calls,
    timers,
    timeout() {
      [...timers.values()][0]();
      calls.at(-1).reject(new DOMException("local abort", "AbortError"));
    },
  };
}
for (const retained of [false, true]) {
  test(`P61 ${retained ? "retained" : "first"} timeout describes only available data and client waiting`, async () => {
    const snapshot = retained ? { domain: "status", services: [] } : null,
      h = harness(snapshot),
      pending = h.subject.load();
    h.timeout();
    await pending;
    assert.equal(
      h.options.message.value,
      retained
        ? "读取超过 15 秒，已停止本次等待。 已保留上次成功数据。"
        : "读取超过 15 秒，已停止本次等待。 尚未取得系统状态数据。",
    );
    assert.equal(h.options.data.value, snapshot);
    assert.equal(h.options.state.value, retained ? "ready" : "error");
    assert.equal(h.options.refreshing.value, false);
    assert.equal(h.timers.size, 0);
    assert.equal(h.calls[0].init.signal.aborted, true);
  });
  test(`P61 ${retained ? "retained" : "first"} failure preserves original error and snapshot identity`, async () => {
    const snapshot = retained ? { domain: "status", services: [] } : null,
      h = harness(snapshot),
      pending = h.subject.load();
    h.calls[0].reject(new Error("测试读取失败。"));
    await pending;
    assert.equal(
      h.options.message.value,
      "测试读取失败。" + (retained ? " 已保留上次成功数据。" : ""),
    );
    assert.equal(h.options.data.value, snapshot);
    assert.equal(h.options.state.value, retained ? "ready" : "error");
  });
}
test("P61 single-flight and successful retry keep the original GET contract", async () => {
  const h = harness(),
    pending = h.subject.load();
  await h.subject.load();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].path, "/platform/management?domain=status");
  assert.deepEqual(Object.keys(h.calls[0].init), ["signal"]);
  h.calls[0].reject(new Error("test"));
  await pending;
  const recovery = h.subject.load(),
    next = { domain: "status", services: [] };
  h.calls[1].resolve(next);
  await recovery;
  assert.equal(h.options.data.value, next);
  assert.equal(h.options.message.value, "");
  assert.equal(h.options.state.value, "ready");
  assert.equal(h.timers.size, 0);
});
test("P61 stopped read cannot overwrite a later successful read", async () => {
  const h = harness(),
    old = h.subject.load();
  h.subject.stop();
  assert.equal(h.calls[0].init.signal.aborted, true);
  const next = h.subject.load(),
    snapshot = { domain: "status", services: [{ code: "api" }] };
  h.calls[1].resolve(snapshot);
  await next;
  h.calls[0].resolve({ domain: "status", services: [] });
  await old;
  assert.equal(h.options.data.value, snapshot);
  assert.equal(h.options.message.value, "");
  assert.equal(h.options.refreshing.value, false);
  assert.equal(h.timers.size, 0);
});
test("P61 foreign domain does not start a status request", async () => {
  const h = harness();
  h.options.domain.value = "email";
  assert.equal(await h.subject.load(), false);
  assert.equal(h.calls.length, 0);
});
test("P61 first read uses one named busy region without changing other domains", () => {
  const file = "apps/web/src/components/PlatformManagementCenter.vue",
    s = readFileSync(file, "utf8");
  assert.match(s, /\(domain !== 'status' \|\| state === 'ready'\)/);
  assert.match(s, /:aria-busy="domain === 'status' \? refreshing : undefined"/);
  assert.match(
    s,
    /:aria-labelledby="domain === 'status' \? 'platform-status-read-title' : undefined"/,
  );
  assert.match(s, /<h2 v-if="domain === 'status'" id="platform-status-read-title">/);
  assert.match(s, /<h3 v-else>/);
  const { descriptor, errors } = parse(s);
  assert.deepEqual(errors, []);
  const compiled = compileScript(descriptor, { id: "p61-read" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      id: "p61-read",
      filename: file,
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
});
