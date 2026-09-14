import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";

const file = "apps/web/src/components/CommercialOperationsCenter.vue";
const script = parse(await readFile(file, "utf8")).descriptor.scriptSetup.content;
const ast = ts.createSourceFile(file + ".ts", script, ts.ScriptTarget.Latest, true);
const functions = ast.statements.filter(
  (n) => ts.isFunctionDeclaration(n) && n.name?.text === "load",
);
assert.equal(functions.length, 1);
const loadCode = ts.transpileModule(functions[0].getText(ast), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

async function run(loaded, failureStatus = null) {
  const snapshot = { marker: loaded ? "original-successful-snapshot" : "no-successful-snapshot" };
  let timer,
    delay,
    cleared = false,
    requested;
  class ApiClientError extends Error {
    constructor(status) {
      super("fixture");
      this.status = status;
      this.actionHint = "请求未完成，请稍后重试。";
    }
  }
  const context = {
    AbortController,
    DOMException,
    URLSearchParams,
    ApiClientError,
    loadSequence: 0,
    loadController: null,
    refreshing: { value: false },
    loadedOnce: { value: loaded },
    state: { value: loaded ? "ready" : "loading" },
    data: { value: snapshot },
    page: { value: 1 },
    adjustmentPage: { value: 1 },
    organizationId: { value: "" },
    query: { value: "" },
    status: { value: "" },
    notice: "",
    kind: "",
    setNotice(message, kind) {
      context.notice = message;
      context.kind = kind;
    },
    window: {
      setTimeout(fn, ms) {
        timer = fn;
        delay = ms;
        return 7;
      },
      clearTimeout(id) {
        assert.equal(id, 7);
        cleared = true;
      },
    },
    call(url, method, body, options) {
      requested = { url, method, body };
      if (failureStatus !== null) return Promise.reject(new ApiClientError(failureStatus));
      return new Promise((resolve, reject) =>
        options.signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        ),
      );
    },
  };
  vm.createContext(context);
  vm.runInContext(loadCode, context);
  const pending = context.load();
  assert.equal(delay, 15000);
  if (failureStatus === null) timer();
  await pending;
  assert.equal(context.refreshing.value, false);
  assert.equal(context.loadedOnce.value, loaded);
  assert.equal(context.data.value, snapshot);
  assert.equal(cleared, true);
  assert.equal(requested.method, "GET");
  return context;
}
test("first read timeout never claims a successful snapshot exists", async () => {
  const result = await run(false);
  assert.equal(result.notice, "读取超时，尚未取得数据，请稍后重试。");
  assert.equal(result.state.value, "error");
});
test("timeout after success retains original data and the original accurate hint", async () => {
  const result = await run(true);
  assert.equal(result.notice, "读取超时，已保留上次成功数据，请稍后重试。");
  assert.equal(result.state.value, "ready");
});
test("first 429 and retained 503 keep their existing behavior", async () => {
  const initial = await run(false, 429),
    retained = await run(true, 503);
  assert.equal(initial.state.value, "rate_limited");
  assert.equal(initial.notice, "请求未完成，请稍后重试。");
  assert.equal(retained.state.value, "ready");
  assert.equal(retained.notice, "请求未完成，请稍后重试。；已保留上次成功数据。");
});
