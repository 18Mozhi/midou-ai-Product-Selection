import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRouter, createMemoryHistory } from "vue-router";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildRecoveryDesignData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  function extract(text, name, kind = "variable") {
    const ast = ts.createSourceFile(
      "source.ts",
      text.includes("<script")
        ? text.split('<script setup lang="ts">')[1].split("</script>")[0]
        : text,
      ts.ScriptTarget.Latest,
      true,
    );
    const matches = [];
    function visit(n) {
      if (kind === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        matches.push(n.initializer.getText(ast));
      if (kind === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        matches.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(matches.length, 1, name);
    return matches[0];
  }
  function run(code, bindings = {}) {
    const context = { exports: {}, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    return context.exports;
  }
  const contract = await read("apps/web/src/ui/state-contract.ts"),
    api = run(contract);
  const showcase = await read("apps/web/src/components/UiStateShowcase.vue");
  const labels = plain(run(`export const value=${extract(showcase, "labels")};`).value);
  const stateFromQuery = run(`export const value=${extract(showcase, "stateFromQuery")};`, {
    UI_STATE_KINDS: api.UI_STATE_KINDS,
  }).value;
  for (const v of [null, undefined, "unknown", ["error", "blocked"]])
    assert.equal(stateFromQuery(v), null);
  for (const v of api.UI_STATE_KINDS) assert.equal(stateFromQuery(v), v);
  const functions = ["selectState", "primary", "secondary"]
    .map((n) => extract(showcase, n, "function"))
    .join("\n");
  async function action(kind, method, recent = "/home") {
    const current = { value: kind },
      actionResult = { value: "" },
      route = { path: "/ui-states", query: { state: kind, context: "review" } },
      navigation = [];
    await run(`${functions}\nexport const result=${method}();`, {
      current,
      actionResult,
      route,
      props: {},
      recentRoute: { value: recent },
      router: {
        resolve: (p) => ({ path: p.split("?")[0] }),
        push: async (v) => {
          navigation.push(plain(v));
          if (v.query) route.query = plain(v.query);
        },
      },
    }).result;
    return plain({ kind: current.value, message: actionResult.value, navigation });
  }
  const actions = {};
  for (const kind of api.UI_STATE_KINDS) {
    actions[kind] = {};
    if (kind !== "loading") {
      actions[kind].primary = await action(kind, "primary");
      if (api.DEFAULT_STATE_COPY[kind].secondary)
        actions[kind].secondary = await action(kind, "secondary");
    }
  }
  const selfReturn = await action("not_found", "primary", "/ui-states?state=blocked");
  assert.equal(selfReturn.kind, "empty");
  const selectCases = [];
  for (const [value, initial] of [
    ["error", false],
    ["empty", false],
    [["error", "blocked"], false],
    ["error", true],
  ]) {
    const navigation = [],
      current = { value: "empty" },
      actionResult = { value: "old" };
    await run(
      `${extract(showcase, "selectState", "function")} export const result=selectState('error');`,
      {
        current,
        actionResult,
        props: initial ? { initialState: "empty" } : {},
        route: { query: { state: value, context: "review" } },
        router: { push: async (v) => navigation.push(plain(v)) },
      },
    ).result;
    assert.equal(actionResult.value, "");
    assert.equal(current.value, "error");
    assert.equal(navigation.length, value === "error" || initial ? 0 : 1);
    selectCases.push({ value, initial, navigation });
  }
  const confirmations = [
    { acknowledged: false, typedText: "" },
    { acknowledged: true, typedText: "" },
    { acknowledged: false, typedText: "确认撤销" },
    { acknowledged: true, typedText: "确认删除" },
    { acknowledged: true, typedText: "  确认撤销  " },
  ].map((input) => ({
    ...input,
    enabled: api.canConfirm({ destructive: true, confirmationText: "确认撤销", ...input }),
  }));
  assert.deepEqual(
    confirmations.map((v) => v.enabled),
    [false, false, false, false, true],
  );
  const correlations = [
    "m02-04-request",
    "m02-04-trace",
    "a".repeat(128),
    "a".repeat(129),
    "<script>",
    "token=value",
    null,
  ].map((input) => ({ input, output: api.sanitizeCorrelationId(input) }));
  assert.deepEqual(
    correlations.map((v) => v.output.length),
    [14, 12, 128, 0, 0, 0, 0],
  );
  const catalog = await read("apps/web/src/route-catalog.ts"),
    manifest = JSON.parse(await read("apps/web/src/route-catalog.generated.json"));
  const routeExports = run(
    `const runtimeRoutes=${extract(catalog, "runtimeRoutes").replaceAll("import.meta.env.DEV", "IS_DEV")};export const routes=${extract(catalog, "appRoutes")};`,
    { manifest, IS_DEV: false, ApplicationSurface: () => null },
  );
  const router = createRouter({ history: createMemoryHistory(), routes: routeExports.routes });
  assert.equal(router.resolve("/ui-states").meta.notFound, true);
  assert.notEqual(router.resolve("/home").meta.notFound, true);
  const nf = await read("apps/web/src/components/NotFoundPage.vue"),
    memory = await read("apps/web/src/navigation-memory.ts");
  const computed = (fn) => ({
    get value() {
      return fn();
    },
  });
  const variables = [
    "requestedPath",
    "recentDestination",
    "hasDistinctRecentDestination",
    "recentTitle",
  ]
    .map((n) => `const ${n}=${extract(nf, n)};`)
    .join("\n");
  const inputs = {
    home: { stored: null, path: "/catalog/deleted-entry" },
    recent: { stored: "/tasks?status=active&filter=qa-only", path: "/unknown/recent-return" },
    "home-query": { stored: "/home?section=review", path: "/unknown/home-query" },
    retired: { stored: "/retired/module?filter=stale", path: "/unknown/retired-return" },
    external: { stored: "https://example.invalid/private", path: "/unknown/external" },
    protocol: { stored: "//example.invalid/private", path: "/unknown/protocol" },
    "storage-error": { stored: null, path: "/unknown/storage", storageError: true },
    long: { stored: "/tasks?status=active", path: `/missing/${"x".repeat(150)}` },
    "internal-unavailable": { stored: "/ui-states?state=blocked", path: "/ui-states" },
  };
  const notFound = {};
  for (const [key, input] of Object.entries(inputs)) {
    const writes = [];
    const mem = run(memory, {
      window: {
        localStorage: {
          getItem: (key) => {
            if (input.storageError) throw Error("SecurityError");
            return key.endsWith("last-valid-route") ? input.stored : null;
          },
          setItem: (...args) => writes.push(args),
        },
      },
    });
    const result = run(
      `${variables}\nexport const value={requestedPath:requestedPath.value,recent:{fullPath:recentDestination.value.fullPath,path:recentDestination.value.path,title:recentTitle.value},distinct:hasDistinctRecentDestination.value};`,
      {
        computed,
        router,
        getLastValidRoute: mem.getLastValidRoute,
        route: { path: input.path, fullPath: input.path + "?filter=qa-only#details" },
      },
    ).value;
    assert.deepEqual(writes, []);
    assert.ok(!result.requestedPath.includes("qa-only"));
    notFound[key] = plain({ input, ...result });
  }
  assert.equal(notFound.long.requestedPath.length, 94);
  for (const key of ["retired", "external", "protocol", "storage-error", "internal-unavailable"])
    assert.equal(notFound[key].recent.fullPath, "/home");
  assert.equal(notFound["home-query"].distinct, false);
  assert.equal(notFound["home-query"].recent.fullPath, "/home?section=review");
  const routerSource = await read("apps/web/src/router.ts"),
    app = await read("apps/web/src/App.vue");
  assert.ok(
    routerSource.includes("if (to.meta.notFound !== true) rememberValidRoute(to.fullPath)"),
  );
  assert.ok(app.includes("const UiStateShowcase = import.meta.env.DEV"));
  assert.ok(app.includes("const isUiStatesView = computed(() => import.meta.env.DEV"));
  return {
    version: "RECOVERY-C-r1",
    kinds: plain(api.UI_STATE_KINDS),
    copy: plain(api.DEFAULT_STATE_COPY),
    labels,
    actions,
    selfReturn,
    selectCases,
    confirmations,
    correlations,
    notFound,
    knownGaps: {
      genericErrorClaimsNoSuccessfulWrite: api.DEFAULT_STATE_COPY.error.description,
      notFoundStateMentionsRole: api.DEFAULT_STATE_COPY.not_found.description,
      sourceFixed: false,
    },
    boundary:
      "P72 internal-dev and P73 standalone design proposals. Actual source helpers executed in VM; actual Vue Router memory resolver uses production-filtered source route catalog, no router guards or production HTTP/bundle evidence. Inert storage proves only tested inputs. Browser prototype records navigation intents only and never reads or writes real navigation memory or business APIs.",
  };
}
