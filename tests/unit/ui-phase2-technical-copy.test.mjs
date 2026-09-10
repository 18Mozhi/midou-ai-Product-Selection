import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { computed, effectScope, reactive, ref, watch } from "vue";

const source = readFileSync("apps/web/src/components/TechnicalDetails.vue", "utf8");
const script = source.split(/<script setup[^>]*>/)[1].split("</script>")[0];
const ast = ts.createSourceFile("component.ts", script, ts.ScriptTarget.Latest, true);
const body = ast.statements
  .filter((n) => !ts.isImportDeclaration(n))
  .map((n) => n.getFullText(ast))
  .join("\n");
function mount() {
  const props = reactive({ requestId: "fixture-request", traceId: "fixture-trace", items: [] });
  const hooks = {},
    pending = [],
    timers = new Map(),
    scope = effectScope();
  let timerId = 0;
  const box = {
    computed,
    ref,
    watch,
    defineProps: () => props,
    withDefaults: (p) => p,
    onBeforeUnmount: (f) => (hooks.unmount = f),
    onDeactivated: (f) => (hooks.deactivate = f),
    navigator: {
      clipboard: {
        writeText: (value) =>
          new Promise((resolve, reject) => pending.push({ value, resolve, reject })),
      },
    },
    window: {
      setTimeout: (fn, delay) => {
        assert.equal(delay, 1500);
        timers.set(++timerId, fn);
        return timerId;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  };
  scope.run(() =>
    vm.runInNewContext(
      ts.transpileModule(body + "\nglobalThis.result={copy,copied,copyError,rows};", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    ),
  );
  return {
    ...box.result,
    props,
    hooks,
    pending,
    timers,
    box,
    stop: () => {
      hooks.unmount();
      scope.stop();
    },
  };
}
async function run(fn) {
  const h = mount();
  try {
    await fn(h);
  } finally {
    h.stop();
  }
}

test("technical copy catches denial, preserves exact text, and clears error on retry success", () =>
  run(async (h) => {
    const denied = h.copy("请求编号", h.props.requestId);
    assert.equal(h.pending[0].value, "fixture-request");
    h.pending[0].reject(new Error("sensitive browser error"));
    await denied;
    assert.equal(h.copied.value, "");
    assert.equal(h.copyError.value, "暂时无法复制请求编号，可以选中上方内容后手动复制。");
    const retry = h.copy("请求编号", h.props.requestId);
    assert.equal(h.copyError.value, "");
    h.pending[1].resolve();
    await retry;
    assert.equal(h.copied.value, "请求编号");
    [...h.timers.values()][0]();
    assert.equal(h.copied.value, "");
  }));
test("missing browser Clipboard API is a handled failure, not an uncaught rejection", () =>
  run(async (h) => {
    delete h.box.navigator.clipboard;
    await h.copy("请求编号", "fixture");
    assert.match(h.copyError.value, /暂时无法复制请求编号/);
  }));
test("only latest copy attempt owns success, failure and expiry feedback", () =>
  run(async (h) => {
    const first = h.copy("请求编号", "first"),
      second = h.copy("链路编号", "second");
    h.pending[1].resolve();
    await second;
    h.pending[0].reject(new Error("late"));
    await first;
    assert.equal(h.copied.value, "链路编号");
    assert.equal(h.copyError.value, "");
    const oldTimer = [...h.timers.values()][0];
    const third = h.copy("链路编号", "third");
    h.pending[2].resolve();
    await third;
    oldTimer();
    assert.equal(h.copied.value, "链路编号");
  }));
test("changed rows invalidate pending feedback even when label is unchanged", () =>
  run(async (h) => {
    const p = h.copy("请求编号", h.props.requestId);
    h.props.requestId = "new-request";
    h.pending[0].resolve();
    await p;
    assert.equal(h.copied.value, "");
    assert.equal(h.copyError.value, "");
    assert.equal(h.timers.size, 0);
    const q = h.copy("请求编号", h.props.requestId);
    h.pending[1].reject(new Error("denied"));
    await q;
    h.props.items = [{ label: "版本", value: 0 }];
    assert.equal(h.copyError.value, "");
  }));
for (const hook of ["deactivate", "unmount"])
  test(`technical copy ${hook} clears timer and suppresses late receipts`, () =>
    run(async (h) => {
      const p = h.copy("请求编号", "fixture");
      h.pending[0].resolve();
      await p;
      assert.equal(h.timers.size, 1);
      h.hooks[hook]();
      assert.equal(h.timers.size, 0);
      const q = h.copy("请求编号", "fixture");
      h.hooks[hook]();
      h.pending[1].reject(new Error("late"));
      await q;
      assert.equal(h.copied.value, "");
      assert.equal(h.copyError.value, "");
    }));
test("technical copy keeps zero values, native disclosure and accessible local feedback", () =>
  run((h) => {
    h.props.items = [
      { label: "零", value: 0 },
      { label: "空", value: null },
    ];
    assert.equal(h.rows.value.at(-1).value, 0);
    assert.match(source, /<p v-if="copyError" role="status"/);
    assert.doesNotMatch(source, /execCommand|readText|fetch\(|localStorage/);
  }));
