import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { computed, reactive, ref, watch, nextTick } from "vue";

const source = readFileSync("apps/web/src/components/PlatformDashboard.vue", "utf8");
const ast = ts.createSourceFile(
  "dashboard.ts",
  source.split('<script setup lang="ts">')[1].split("</script>")[0],
  ts.ScriptTarget.Latest,
  true,
);
const script = ts.transpileModule(
  ast.statements
    .filter((s) => !ts.isImportDeclaration(s))
    .map((s) => s.getFullText(ast))
    .join("\n") +
    ";globalThis.result={load,changeWindow,windowCode,data,pending,state,requestId,refreshError};",
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const flush = async () => {
  await nextTick();
  await Promise.resolve();
  await nextTick();
};
const facts = (window, marker = window) => ({
  data: { window, summary: { active_users: 1 }, queues: [], alerts: [], marker },
  request_id: marker,
});
class ApiClientError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind;
    this.requestId = `failure-${kind}`;
  }
}
function harness(window = "24h") {
  const route = reactive({ path: "/platform-admin", query: { window, keep: "yes" } });
  const calls = [],
    timers = new Map(),
    stops = [];
  let unmount,
    sequence = 0;
  const box = {
    computed,
    ref,
    watch: (...args) => stops.push(watch(...args)),
    onMounted: () => {},
    onUnmounted: (fn) => {
      unmount = fn;
    },
    useRoute: () => route,
    useRouter: () => ({
      replace: async ({ query }) => {
        route.query = query;
        await nextTick();
      },
    }),
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    ApiClientError,
    AbortController,
    window: {
      setTimeout: (fn, ms) => {
        assert.equal(ms, 12000);
        timers.set(++sequence, fn);
        return sequence;
      },
      clearTimeout: (id) => timers.delete(id),
    },
    createApiClient: () => (url, options) =>
      new Promise((resolve, reject) => {
        calls.push({ url, options, resolve, reject });
      }),
  };
  vm.runInNewContext(script, box);
  return {
    h: box.result,
    calls,
    route,
    timers,
    nav: async (value, path = "/platform-admin") => {
      route.path = path;
      route.query = { ...route.query, window: value };
      await flush();
    },
    destroy: () => {
      unmount();
      for (const stop of stops) stop();
    },
  };
}

test("P38 history updates control and reads the matching window", async () => {
  const t = harness("30d");
  try {
    const initial = t.h.load();
    t.calls[0].resolve(facts("30d"));
    await initial;
    await t.nav("15m");
    assert.equal(t.h.windowCode.value, "15m");
    assert.equal(t.calls[1].url, "/platform/dashboard?window=15m");
    t.calls[1].resolve(facts("15m"));
    await flush();
    assert.equal(t.h.data.value.window, "15m");
    assert.equal(t.route.query.keep, "yes");
  } finally {
    t.destroy();
  }
});

test("P38 existing select change issues one GET, not both watcher and handler", async () => {
  const t = harness();
  try {
    t.h.windowCode.value = "7d";
    const changing = t.h.changeWindow();
    await flush();
    assert.equal(t.calls.length, 1);
    assert.equal(t.route.query.window, "7d");
    t.calls[0].resolve(facts("7d"));
    await changing;
    assert.equal(t.h.pending.value, false);
  } finally {
    t.destroy();
  }
});

test("P38 direct repeated load remains single-flight before any route change", async () => {
  const t = harness();
  try {
    const initial = t.h.load();
    await t.h.load();
    await t.h.load();
    assert.equal(t.calls.length, 1);
    assert.equal(t.timers.size, 1);
    assert.equal(t.h.pending.value, true);
    t.calls[0].resolve(facts("24h"));
    await initial;
    assert.equal(t.h.data.value.window, "24h");
    assert.equal(t.h.pending.value, false);
    assert.equal(t.timers.size, 0);
  } finally {
    t.destroy();
  }
});

test("P38 direct load on a hidden route creates neither request nor timer", async () => {
  const t = harness();
  try {
    await t.nav("24h", "/platform-admin/status");
    await t.h.load();
    assert.equal(t.calls.length, 0);
    assert.equal(t.timers.size, 0);
    assert.equal(t.h.pending.value, false);
    assert.equal(t.h.data.value, null);
    assert.equal(t.h.requestId.value, "");
  } finally {
    t.destroy();
  }
});

for (const outcome of ["success", "failure"])
  test(`P38 queued history changes coalesce and ignore old ${outcome}`, async () => {
    const t = harness();
    try {
      const initial = t.h.load();
      t.calls[0].resolve(facts("24h", "original"));
      await initial;
      const refresh = t.h.load();
      await t.nav("15m");
      await t.nav("7d");
      assert.equal(t.calls.length, 2);
      if (outcome === "success") t.calls[1].resolve(facts("24h", "stale"));
      else t.calls[1].reject(new ApiClientError("forbidden"));
      await refresh;
      await flush();
      assert.equal(t.calls.length, 3);
      assert.equal(t.calls[2].url, "/platform/dashboard?window=7d");
      assert.equal(t.h.data.value.marker, "original");
      assert.equal(t.h.requestId.value, "original");
      assert.equal(t.h.refreshError.value, "");
      assert.equal(t.h.pending.value, true);
      t.calls[2].resolve(facts("7d"));
      await flush();
      assert.equal(t.h.data.value.window, "7d");
      assert.equal(t.h.pending.value, false);
      assert.equal(t.timers.size, 0);
    } finally {
      t.destroy();
    }
  });

test("P38 returning to the in-flight window does not add another read", async () => {
  const t = harness();
  try {
    const load = t.h.load();
    await t.nav("7d");
    await t.nav("24h");
    t.calls[0].resolve(facts("24h"));
    await load;
    await flush();
    assert.equal(t.calls.length, 1);
    assert.equal(t.h.data.value.window, "24h");
  } finally {
    t.destroy();
  }
});

test("P38 hidden route does not fetch or accept its late response; return reloads", async () => {
  const t = harness();
  try {
    const load = t.h.load();
    await t.nav("7d", "/platform-admin/data");
    t.calls[0].resolve(facts("24h"));
    await load;
    assert.equal(t.h.data.value, null);
    assert.equal(t.calls.length, 1);
    await t.nav("7d");
    assert.equal(t.calls.length, 2);
    t.calls[1].resolve(facts("7d"));
    await flush();
    assert.equal(t.h.data.value.window, "7d");
  } finally {
    t.destroy();
  }
});

test("P38 destroy aborts client and rejects late writes and queued drain", async () => {
  const t = harness();
  const load = t.h.load();
  await t.nav("7d");
  t.destroy();
  assert.equal(t.calls[0].options.signal.aborted, true);
  t.calls[0].resolve(facts("24h"));
  await load;
  await flush();
  assert.equal(t.h.data.value, null);
  assert.equal(t.calls.length, 1);
  assert.equal(t.timers.size, 0);
  await t.h.load();
  assert.equal(t.calls.length, 1);
});

test("P38 invalid history window keeps existing 24h fallback without rewriting URL", async () => {
  const t = harness("7d");
  try {
    await t.nav("invalid");
    assert.equal(t.h.windowCode.value, "24h");
    assert.equal(t.route.query.window, "invalid");
    assert.equal(t.calls[0].url, "/platform/dashboard?window=24h");
    t.calls[0].resolve(facts("24h"));
    await flush();
  } finally {
    t.destroy();
  }
});

test("P38 current-window failure retains existing snapshot policy", async () => {
  const t = harness();
  try {
    const initial = t.h.load();
    t.calls[0].resolve(facts("24h"));
    await initial;
    await t.nav("7d");
    t.calls[1].reject(new ApiClientError("forbidden"));
    await flush();
    assert.equal(t.h.state.value, "ready");
    assert.equal(t.h.data.value.window, "24h");
    assert.match(t.h.refreshError.value, /刷新失败/);
    assert.equal(t.h.requestId.value, "failure-forbidden");
  } finally {
    t.destroy();
  }
});
